// Database access for the Oketex API.
// - DATABASE_URL unset  → everything returns null/empty and the API reports
//   db:false on /api/health, so the frontend stays in demo (localStorage)
//   mode. The backend can never take the site down by being unconfigured.
// - Neon URL            → @neondatabase/serverless (HTTP) + drizzle-orm/neon-http.
// - Any other postgres:// → `pg` Pool + drizzle-orm/node-postgres (this is
//   also what lets the smoke tests exercise handlers against a local PG).
// Data access goes through dbQuery() (driver-native parameterised SQL);
// the drizzle instance is exported for typed queries and used for the
// health ping.
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

const url = process.env.DATABASE_URL || "";
export function isDbConfigured(): boolean { return !!url; }
function isNeonUrl(u: string): boolean { return /neon\.(tech|build)/i.test(u) || u.includes("-pooler.") && /neon/i.test(u); }

let _neonClient: any = null;
let _pool: any = null;
let _drizzle: any = null;

export function getDrizzle(): any {
  if (!url) return null;
  if (_drizzle) return _drizzle;
  if (isNeonUrl(url)) {
    _neonClient = neon(url);
    _drizzle = drizzleNeonHttp(_neonClient);
  } else {
    _pool = new Pool({ connectionString: url, max: 3 });
    _drizzle = drizzleNodePg(_pool);
  }
  return _drizzle;
}

/** Parameterised SQL → rows array. Throws when the DB is not configured. */
export async function dbQuery<T = any>(text: string, params: any[] = []): Promise<T[]> {
  if (!url) throw new Error("DATABASE_URL is not set");
  if (isNeonUrl(url)) {
    if (!_neonClient) { _neonClient = neon(url); }
    const rows = await _neonClient.query(text, params);
    return rows as T[];
  }
  if (!_pool) { _pool = new Pool({ connectionString: url, max: 3 }); }
  const r = await _pool.query(text, params);
  return r.rows as T[];
}

/** Health ping through drizzle (SELECT 1). false when unconfigured/down. */
export async function dbPing(): Promise<boolean> {
  if (!url) return false;
  try {
    const d = getDrizzle();
    await d.execute(sql`select 1 as one`);
    return true;
  } catch { return false; }
}
