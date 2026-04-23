import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const ENCRYPTION_ALGO = "aes-256-gcm";

function deriveKeyFromString(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function normalizeKey(raw: string): Buffer {
  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  try {
    const fromBase64 = Buffer.from(raw, "base64");
    if (fromBase64.length === 32) {
      return fromBase64;
    }
  } catch {
    // Ignore parse errors and fallback to string derivation.
  }

  return deriveKeyFromString(raw);
}

function getEncryptionKey(): Buffer {
  const raw = process.env.APP_DATA_ENCRYPTION_KEY;

  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing APP_DATA_ENCRYPTION_KEY in production.");
    }

    return deriveKeyFromString("dev-only-insecure-key-change-me");
  }

  const key = normalizeKey(raw);
  if (key.length !== 32) {
    throw new Error("APP_DATA_ENCRYPTION_KEY must resolve to 32 bytes.");
  }

  return key;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, storedDigest] = stored.split(":");
  if (!salt || !storedDigest) {
    return false;
  }

  const candidate = scryptSync(password, salt, 64).toString("hex");
  const left = Buffer.from(storedDigest, "hex");
  const right = Buffer.from(candidate, "hex");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function encryptJson(payload: unknown): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGO, key, iv);

  const source = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(source), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptJson<T>(encoded: string): T {
  const [version, ivB64, tagB64, ciphertextB64] = encoded.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !ciphertextB64) {
    throw new Error("Invalid encrypted payload format.");
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    ENCRYPTION_ALGO,
    key,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString("utf8")) as T;
}
