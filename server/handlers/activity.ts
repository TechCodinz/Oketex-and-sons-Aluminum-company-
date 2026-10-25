import { sendJson, methodNotAllowed, readJson, wrap } from "../http.js";
import { dbQuery, isDbConfigured } from "../db.js";
import { activityFromRow } from "../records.js";
import { requireRole, roleErrorBody, getSessionUser, isStaffRole } from "../auth.js";
// Staff activity log (Staff System, 2026-10-25).
// POST (any signed-in staff) → append an entry; the actor is taken from the
// SESSION, never from the request body, so entries can't be spoofed.
// GET → owner only (the log covers every department).
export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "POST") {
    const user = await getSessionUser(req);
    if (!user || !isStaffRole(user.role)) return sendJson(res, 401, { error: "Staff session required" });
    const b = await readJson(req);
    const action = String(b.action || "").trim();
    if (!action) return sendJson(res, 400, { error: "Missing action" });
    const id = `ACT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const rows = await dbQuery(
      `INSERT INTO activity_log (id, actor_name, actor_role, action, ref_code, detail) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, user.name || "", user.role, action, String(b.refCode || ""), String(b.detail || "")],
    );
    return sendJson(res, 201, { entry: activityFromRow(rows[0]) });
  }
  if (req.method === "GET") {
    const gate = await requireRole(req, ["admin"]);
    if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));
    const rows = await dbQuery(`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 300`);
    return sendJson(res, 200, { entries: rows.map(activityFromRow) });
  }
  return methodNotAllowed(res, ["GET", "POST"]);
});
