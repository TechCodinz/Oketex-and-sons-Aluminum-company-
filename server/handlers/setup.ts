import { sendJson, methodNotAllowed, wrap } from "../http";
import { dbQuery, isDbConfigured } from "../db";
import { SCHEMA_STATEMENTS } from "../schema.sql";
// One-time (idempotent) production bootstrap: POST with header
//   x-setup-secret: <SETUP_SECRET env>
// applies all CREATE TABLE IF NOT EXISTS statements. Safe to re-run.
export default wrap(async (req: any, res: any) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const expected = process.env.SETUP_SECRET || "";
  const given = req.headers["x-setup-secret"] || "";
  if (!expected || given !== expected) return sendJson(res, 401, { error: "Invalid or missing x-setup-secret" });
  if (!isDbConfigured()) return sendJson(res, 503, { error: "DATABASE_URL is not set" });
  const done: string[] = [];
  for (const stmt of SCHEMA_STATEMENTS) {
    await dbQuery(stmt);
    done.push(stmt.replace(/\s+/g, " ").slice(0, 60));
  }
  return sendJson(res, 200, { ok: true, statementsApplied: done.length, tables: ["users", "partners", "leads", "bookings", "orders", "quotes", "payments", "settings", "offers"] });
});
