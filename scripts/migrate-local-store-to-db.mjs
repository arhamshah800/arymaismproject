import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnvLocal();

const sourcePath = process.env.MIGRATION_SOURCE_PATH
  ? resolve(process.env.MIGRATION_SOURCE_PATH)
  : resolve(process.cwd(), ".secure-data", "store.v1.json");

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

if (!existsSync(sourcePath)) {
  console.log(`No local secure store found at ${sourcePath}. Nothing to migrate.`);
  process.exit(0);
}

const raw = readFileSync(sourcePath, "utf8");
const parsed = JSON.parse(raw);
const accounts = parsed?.accounts ?? {};
const sessions = parsed?.sessions ?? {};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      email TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      encrypted_data TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS app_sessions (
      token_hash TEXT PRIMARY KEY,
      email TEXT NOT NULL REFERENCES app_users(email) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_app_sessions_email ON app_sessions(email);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON app_sessions(expires_at);
  `);
}

async function run() {
  const client = await pool.connect();

  let userCount = 0;
  let sessionCount = 0;

  try {
    await client.query("BEGIN");
    await ensureSchema(client);

    for (const [email, account] of Object.entries(accounts)) {
      await client.query(
        `
          INSERT INTO app_users (email, password_hash, encrypted_data, created_at, updated_at)
          VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), COALESCE($5::timestamptz, NOW()))
          ON CONFLICT (email) DO UPDATE
          SET password_hash = EXCLUDED.password_hash,
              encrypted_data = EXCLUDED.encrypted_data,
              updated_at = EXCLUDED.updated_at
        `,
        [
          String(email).toLowerCase(),
          account?.passwordHash ?? "",
          account?.encryptedData ?? "",
          account?.createdAt ?? null,
          account?.updatedAt ?? null,
        ],
      );
      userCount += 1;
    }

    const now = Date.now();
    for (const [tokenHash, session] of Object.entries(sessions)) {
      const expiresAt = new Date(session?.expiresAt ?? "").getTime();
      if (!Number.isFinite(expiresAt) || expiresAt <= now) {
        continue;
      }

      await client.query(
        `
          INSERT INTO app_sessions (token_hash, email, created_at, expires_at)
          VALUES ($1, $2, COALESCE($3::timestamptz, NOW()), $4::timestamptz)
          ON CONFLICT (token_hash) DO NOTHING
        `,
        [
          tokenHash,
          String(session?.email ?? "").toLowerCase(),
          session?.createdAt ?? null,
          session?.expiresAt,
        ],
      );
      sessionCount += 1;
    }

    await client.query("COMMIT");
    console.log(`Migrated ${userCount} users and ${sessionCount} active sessions from ${sourcePath}.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

run()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
