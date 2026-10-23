// Smoke-test stand-in for server/db.ts (Phase 5).
// Backed by pg-mem's pg adapter: the REAL handlers and REAL SQL run against
// an in-memory Postgres. Only the transport differs from production
// (Neon HTTP / node-postgres) — see BUILD_NOTES "what stays unverified".
import { newDb, DataType } from "pg-mem";

const mem = newDb();
const { Pool } = mem.adapters.createPg();
const pool = new Pool();

// pg-mem does not implement the 4-arg regexp_replace (real Postgres does —
// the phone lookups in api/orders.ts + api/bookings.ts use it). Register a
// faithful JS equivalent so the REAL handler SQL runs unchanged.
for (const argc of [3, 4]) {
  mem.public.registerFunction({
    name: "regexp_replace",
    args: Array(argc).fill(DataType.text),
    returns: DataType.text,
    implementation: (src, pattern, replacement, flags = "") => {
      if (src == null) return null;
      const jsFlags = String(flags || "").includes("g") ? "g" : "";
      return String(src).replace(new RegExp(String(pattern), jsFlags + (String(flags || "").includes("i") ? "i" : "")), String(replacement));
    },
  });
}

export function isDbConfigured() { return true; }
export async function dbQuery(text, params = []) {
  const r = await pool.query(text, params);
  return r.rows;
}
export async function dbPing() {
  try { await pool.query("SELECT 1"); return true; } catch { return false; }
}
export function getDrizzle() { return null; }
