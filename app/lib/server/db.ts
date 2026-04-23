import { Pool, type QueryResultRow } from "pg";

declare global {
  var __arymaPool: Pool | undefined;
}

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL");
  }

  if (!global.__arymaPool) {
    global.__arymaPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // optional if your URL already has sslmode=require:
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      max: 10,
    });
  }

  return global.__arymaPool;
}

export { getPool };

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  return getPool().query<T>(text, params);
}
