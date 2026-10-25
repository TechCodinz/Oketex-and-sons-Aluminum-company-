import { sendJson, methodNotAllowed, readJson, wrap } from "../http.js";
import { dbQuery, isDbConfigured } from "../db.js";
import { staffFromRow } from "../records.js";
import { requireRole, roleErrorBody, hashPassword, findUserByEmail, STAFF_ROLES, type StaffRole } from "../auth.js";
import { logActivityServer } from "../activityLog.js";
// Staff accounts (Staff System, 2026-10-25) — OWNER ONLY. Staff live in the
// `users` table with a staff role; there is no separate staff table.
// GET → the staff directory (role != customer/partner).
// POST {name, email, phone, role, password} → create a login.
// PATCH {id, role?, active?, password?} → change role, activate/deactivate,
// reset password. Deactivation takes effect at the next login (login checks
// the flag) and is logged.
const CREATABLE: readonly string[] = STAFF_ROLES;
export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  const gate = await requireRole(req, ["admin"]);
  if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));

  if (req.method === "GET") {
    const rows = await dbQuery(
      `SELECT * FROM users WHERE role NOT IN ('customer','partner') ORDER BY created_at ASC`,
    );
    return sendJson(res, 200, { staff: rows.map(staffFromRow) });
  }
  if (req.method === "POST") {
    const b = await readJson(req);
    const name = String(b.name || "").trim();
    const email = String(b.email || "").trim().toLowerCase();
    const phone = String(b.phone || "").trim();
    const role = String(b.role || "") as StaffRole;
    const password = String(b.password || "");
    if (name.length < 2) return sendJson(res, 400, { error: "Enter the staff member's full name" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: "Enter a valid email" });
    if (!CREATABLE.includes(role)) return sendJson(res, 400, { error: "Pick a staff role" });
    if (password.length < 8) return sendJson(res, 400, { error: "Temporary password must be at least 8 characters" });
    if (await findUserByEmail(email)) return sendJson(res, 409, { error: "An account with this email already exists" });
    const hash = await hashPassword(password);
    const rows = await dbQuery(
      `INSERT INTO users (name, email, phone, password_hash, role, active) VALUES ($1,$2,$3,$4,$5,true) RETURNING *`,
      [name, email, phone, hash, role],
    );
    const member = staffFromRow(rows[0]);
    await logActivityServer(gate.user, "staff_created", email, `${name} added as ${role}`);
    return sendJson(res, 201, { staff: member });
  }
  if (req.method === "PATCH") {
    const b = await readJson(req);
    const id = Number(b.id);
    if (!Number.isFinite(id) || id <= 0) return sendJson(res, 400, { error: "Missing staff id" });
    const cur = await dbQuery(`SELECT * FROM users WHERE id = $1`, [id]);
    if (!cur.length) return sendJson(res, 404, { error: "Staff member not found" });
    if (cur[0].role === "customer" || cur[0].role === "partner") return sendJson(res, 400, { error: "That account is not a staff account" });
    const sets: string[] = []; const vals: any[] = [];
    const changes: string[] = [];
    if (typeof b.role === "string" && CREATABLE.includes(b.role) && b.role !== cur[0].role) { vals.push(b.role); sets.push(`role = $${vals.length}`); changes.push(`role → ${b.role}`); }
    if (typeof b.active === "boolean" && b.active !== (cur[0].active !== false)) { vals.push(b.active); sets.push(`active = $${vals.length}`); changes.push(b.active ? "reactivated" : "deactivated"); }
    if (typeof b.password === "string" && b.password.length >= 8) { vals.push(await hashPassword(b.password)); sets.push(`password_hash = $${vals.length}`); changes.push("password reset"); }
    if (!sets.length) return sendJson(res, 400, { error: "Nothing to update (passwords need 8+ characters)" });
    vals.push(id);
    const rows = await dbQuery(`UPDATE users SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING *`, vals);
    const member = staffFromRow(rows[0]);
    await logActivityServer(gate.user, "staff_updated", member.email, `${member.name}: ${changes.join(", ")}`);
    return sendJson(res, 200, { staff: member });
  }
  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
});
