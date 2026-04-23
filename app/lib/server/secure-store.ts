import type { PoolClient } from "pg";
import {
  DEFAULT_PROFILE,
  type AppUserRole,
  type EmployeeAccountSummary,
  type RestaurantData,
  type RestaurantProfile,
  getDefaultRestaurantData,
} from "../models";
import { getPool } from "./db";
import {
  decryptJson,
  encryptJson,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from "./security";

type PrivateUserData = {
  profile: RestaurantProfile;
  restaurantData: RestaurantData;
};

type AccountRow = {
  email: string;
  password_hash: string;
  encrypted_data: string;
  role: AppUserRole;
  owner_email: string | null;
  display_name: string | null;
  position: string | null;
};

export type AuthenticatedUser = {
  email: string;
  role: AppUserRole;
  ownerEmail: string | null;
  displayName: string | null;
  position: string | null;
  profile: RestaurantProfile;
  restaurantData: RestaurantData;
  employees: EmployeeAccountSummary[];
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hydrateUserData(account: { encrypted_data: string }): PrivateUserData {
  const parsed = decryptJson<Partial<PrivateUserData>>(account.encrypted_data);

  return {
    profile: {
      ...DEFAULT_PROFILE,
      ...(parsed.profile ?? {}),
    },
    restaurantData: {
      ...getDefaultRestaurantData(),
      ...(parsed.restaurantData ?? {}),
    },
  };
}

function persistUserData(data: PrivateUserData): string {
  return encryptJson(data);
}

function createInitialPrivateData(email: string): PrivateUserData {
  return {
    profile: {
      ...DEFAULT_PROFILE,
      businessName: `${email.split("@")[0]} Restaurant`,
    },
    restaurantData: getDefaultRestaurantData(),
  };
}

async function withTransaction<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function cleanupExpiredSessions(client: PoolClient): Promise<void> {
  await client.query("DELETE FROM app_sessions WHERE expires_at <= NOW()");
}

async function listEmployeesForOwner(client: PoolClient, ownerEmail: string): Promise<EmployeeAccountSummary[]> {
  const result = await client.query<{
    email: string;
    display_name: string | null;
    position: string | null;
    created_at: string;
  }>(
    `
      SELECT email, display_name, position, created_at
      FROM app_users
      WHERE role = 'employee'
        AND owner_email = $1
      ORDER BY COALESCE(display_name, email) ASC
    `,
    [ownerEmail],
  );

  return result.rows.map((row) => ({
    email: row.email,
    displayName: row.display_name ?? row.email.split("@")[0],
    position: row.position ?? "",
    createdAt: row.created_at,
  }));
}

async function buildAuthenticatedUserFromAccount(
  client: PoolClient,
  account: AccountRow,
): Promise<AuthenticatedUser> {
  if (account.role === "employee" && account.owner_email) {
    const ownerResult = await client.query<AccountRow>(
      `
        SELECT email, password_hash, encrypted_data, role, owner_email, display_name, position
        FROM app_users
        WHERE email = $1
        LIMIT 1
      `,
      [account.owner_email],
    );

    const ownerAccount = ownerResult.rows[0];
    const ownerData = ownerAccount ? hydrateUserData(ownerAccount) : createInitialPrivateData(account.owner_email);

    return {
      email: account.email,
      role: "employee",
      ownerEmail: account.owner_email,
      displayName: account.display_name ?? account.email.split("@")[0],
      position: account.position,
      profile: ownerData.profile,
      restaurantData: ownerData.restaurantData,
      employees: [],
    };
  }

  const privateData = hydrateUserData(account);

  return {
    email: account.email,
    role: "owner",
    ownerEmail: null,
    displayName: account.display_name,
    position: account.position,
    profile: privateData.profile,
    restaurantData: privateData.restaurantData,
    employees: await listEmployeesForOwner(client, account.email),
  };
}

async function createSessionForEmail(client: PoolClient, email: string): Promise<string> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);

  await client.query(
    `
      INSERT INTO app_sessions (token_hash, email, created_at, expires_at)
      VALUES ($1, $2, NOW(), NOW() + INTERVAL '7 days')
    `,
    [tokenHash, email],
  );

  return token;
}

export async function registerUser(
  email: string,
  password: string,
): Promise<{ user: AuthenticatedUser; sessionToken: string }> {
  const normalizedEmail = normalizeEmail(email);

  return withTransaction(async (client) => {
    await cleanupExpiredSessions(client);

    const existing = await client.query<{ email: string }>(
      "SELECT email FROM app_users WHERE email = $1 LIMIT 1",
      [normalizedEmail],
    );

    if (existing.rowCount && existing.rowCount > 0) {
      throw new Error("Account already exists.");
    }

    const privateData = createInitialPrivateData(normalizedEmail);

    await client.query(
      `
        INSERT INTO app_users (
          email,
          password_hash,
          encrypted_data,
          role,
          owner_email,
          display_name,
          position,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, 'owner', NULL, NULL, NULL, NOW(), NOW())
      `,
      [normalizedEmail, hashPassword(password), persistUserData(privateData)],
    );

    const sessionToken = await createSessionForEmail(client, normalizedEmail);

    return {
      sessionToken,
      user: {
        email: normalizedEmail,
        role: "owner",
        ownerEmail: null,
        displayName: null,
        position: null,
        profile: privateData.profile,
        restaurantData: privateData.restaurantData,
        employees: [],
      },
    };
  });
}

export async function loginUser(
  email: string,
  password: string,
): Promise<{ user: AuthenticatedUser; sessionToken: string }> {
  const normalizedEmail = normalizeEmail(email);

  return withTransaction(async (client) => {
    await cleanupExpiredSessions(client);

    const accountResult = await client.query<AccountRow>(
      `
        SELECT email, password_hash, encrypted_data, role, owner_email, display_name, position
        FROM app_users
        WHERE email = $1
        LIMIT 1
      `,
      [normalizedEmail],
    );

    const account = accountResult.rows[0];
    if (!account || !verifyPassword(password, account.password_hash)) {
      throw new Error("Invalid credentials.");
    }

    const sessionToken = await createSessionForEmail(client, normalizedEmail);

    return {
      sessionToken,
      user: await buildAuthenticatedUserFromAccount(client, account),
    };
  });
}

export async function logoutUserByToken(token: string): Promise<void> {
  const tokenHash = hashSessionToken(token);
  await getPool().query("DELETE FROM app_sessions WHERE token_hash = $1", [tokenHash]);
}

export async function getUserBySessionToken(token: string): Promise<AuthenticatedUser | null> {
  const tokenHash = hashSessionToken(token);

  return withTransaction(async (client) => {
    await cleanupExpiredSessions(client);

    const result = await client.query<AccountRow>(
      `
        SELECT u.email, u.password_hash, u.encrypted_data, u.role, u.owner_email, u.display_name, u.position
        FROM app_sessions s
        JOIN app_users u ON u.email = s.email
        WHERE s.token_hash = $1
          AND s.expires_at > NOW()
        LIMIT 1
      `,
      [tokenHash],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return buildAuthenticatedUserFromAccount(client, row);
  });
}

export async function updateUserDataBySessionToken(
  token: string,
  patch: { profile?: RestaurantProfile; restaurantData?: RestaurantData },
): Promise<AuthenticatedUser> {
  const tokenHash = hashSessionToken(token);

  return withTransaction(async (client) => {
    await cleanupExpiredSessions(client);

    const sessionAccount = await client.query<AccountRow>(
      `
        SELECT u.email, u.password_hash, u.encrypted_data, u.role, u.owner_email, u.display_name, u.position
        FROM app_sessions s
        JOIN app_users u ON u.email = s.email
        WHERE s.token_hash = $1
          AND s.expires_at > NOW()
        LIMIT 1
        FOR UPDATE
      `,
      [tokenHash],
    );

    const account = sessionAccount.rows[0];
    if (!account || account.role !== "owner") {
      throw new Error("Unauthorized");
    }

    const current = hydrateUserData(account);
    const next: PrivateUserData = {
      profile: patch.profile
        ? {
            ...DEFAULT_PROFILE,
            ...patch.profile,
          }
        : current.profile,
      restaurantData: patch.restaurantData
        ? {
            ...getDefaultRestaurantData(),
            ...patch.restaurantData,
          }
        : current.restaurantData,
    };

    await client.query(
      `
        UPDATE app_users
        SET encrypted_data = $2,
            updated_at = NOW()
        WHERE email = $1
      `,
      [account.email, persistUserData(next)],
    );

    return {
      email: account.email,
      role: "owner",
      ownerEmail: null,
      displayName: account.display_name,
      position: account.position,
      profile: next.profile,
      restaurantData: next.restaurantData,
      employees: await listEmployeesForOwner(client, account.email),
    };
  });
}

export async function createEmployeeAccountByOwnerSessionToken(
  token: string,
  employee: {
    email: string;
    password: string;
    displayName: string;
    position?: string;
  },
): Promise<EmployeeAccountSummary[]> {
  const tokenHash = hashSessionToken(token);
  const normalizedEmail = normalizeEmail(employee.email);
  const displayName = employee.displayName.trim();
  const position = employee.position?.trim() ?? "";

  return withTransaction(async (client) => {
    await cleanupExpiredSessions(client);

    const ownerSession = await client.query<AccountRow>(
      `
        SELECT u.email, u.password_hash, u.encrypted_data, u.role, u.owner_email, u.display_name, u.position
        FROM app_sessions s
        JOIN app_users u ON u.email = s.email
        WHERE s.token_hash = $1
          AND s.expires_at > NOW()
        LIMIT 1
        FOR UPDATE
      `,
      [tokenHash],
    );

    const ownerAccount = ownerSession.rows[0];
    if (!ownerAccount || ownerAccount.role !== "owner") {
      throw new Error("Unauthorized");
    }

    const existing = await client.query<{ email: string }>(
      "SELECT email FROM app_users WHERE email = $1 LIMIT 1",
      [normalizedEmail],
    );

    if (existing.rowCount && existing.rowCount > 0) {
      throw new Error("An account with that email already exists.");
    }

    const employeeData = createInitialPrivateData(normalizedEmail);

    await client.query(
      `
        INSERT INTO app_users (
          email,
          password_hash,
          encrypted_data,
          role,
          owner_email,
          display_name,
          position,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, 'employee', $4, $5, $6, NOW(), NOW())
      `,
      [
        normalizedEmail,
        hashPassword(employee.password),
        persistUserData(employeeData),
        ownerAccount.email,
        displayName || normalizedEmail.split("@")[0],
        position || null,
      ],
    );

    return listEmployeesForOwner(client, ownerAccount.email);
  });
}

export async function issuePasswordResetToken(email: string): Promise<string | null> {
  const normalizedEmail = normalizeEmail(email);

  return withTransaction(async (client) => {
    await cleanupExpiredSessions(client);

    const accountResult = await client.query<{ email: string }>(
      `
        SELECT email
        FROM app_users
        WHERE email = $1
        LIMIT 1
      `,
      [normalizedEmail],
    );

    const account = accountResult.rows[0];
    if (!account) {
      return null;
    }

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);

    await client.query(
      `
        DELETE FROM app_password_resets
        WHERE email = $1
           OR expires_at <= NOW()
           OR used_at IS NOT NULL
      `,
      [normalizedEmail],
    );

    await client.query(
      `
        INSERT INTO app_password_resets (token_hash, email, created_at, expires_at, used_at)
        VALUES ($1, $2, NOW(), NOW() + INTERVAL '30 minutes', NULL)
      `,
      [tokenHash, normalizedEmail],
    );

    return token;
  });
}

export async function resetPasswordWithToken(
  token: string,
  password: string,
): Promise<{ userEmail: string }> {
  const tokenHash = hashSessionToken(token);

  return withTransaction(async (client) => {
    await cleanupExpiredSessions(client);

    await client.query(
      `
        DELETE FROM app_password_resets
        WHERE expires_at <= NOW()
      `,
    );

    const resetResult = await client.query<{ email: string }>(
      `
        SELECT email
        FROM app_password_resets
        WHERE token_hash = $1
          AND expires_at > NOW()
          AND used_at IS NULL
        LIMIT 1
        FOR UPDATE
      `,
      [tokenHash],
    );

    const resetRow = resetResult.rows[0];
    if (!resetRow) {
      throw new Error("This password reset link is invalid or expired.");
    }

    await client.query(
      `
        UPDATE app_users
        SET password_hash = $2,
            updated_at = NOW()
        WHERE email = $1
      `,
      [resetRow.email, hashPassword(password)],
    );

    await client.query(
      `
        UPDATE app_password_resets
        SET used_at = NOW()
        WHERE token_hash = $1
      `,
      [tokenHash],
    );

    await client.query("DELETE FROM app_sessions WHERE email = $1", [resetRow.email]);

    return { userEmail: resetRow.email };
  });
}

export async function initializeManagedSchema(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      email TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      encrypted_data TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner';`);
  await pool.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS owner_email TEXT NULL;`);
  await pool.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS display_name TEXT NULL;`);
  await pool.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS position TEXT NULL;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_sessions (
      token_hash TEXT PRIMARY KEY,
      email TEXT NOT NULL REFERENCES app_users(email) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_app_sessions_email ON app_sessions(email);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON app_sessions(expires_at);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_app_users_owner_email ON app_users(owner_email);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_password_resets (
      token_hash TEXT PRIMARY KEY,
      email TEXT NOT NULL REFERENCES app_users(email) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ NULL
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_app_password_resets_email ON app_password_resets(email);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_app_password_resets_expires_at ON app_password_resets(expires_at);
  `);
}

export function getSessionExpiryDate(): Date {
  return new Date(Date.now() + SESSION_TTL_MS);
}
