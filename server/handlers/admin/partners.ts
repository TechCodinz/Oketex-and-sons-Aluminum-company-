import { sendJson, methodNotAllowed, readJson, wrap } from "../../http.js";
import { dbQuery, isDbConfigured } from "../../db.js";
import { partnerFromRow } from "../../records.js";
import { requireRole, roleErrorBody } from "../../auth.js";
// Admin partner management: GET all (incl. pending) + PATCH one
// {code, status?, verified?, featured?}. Staff System role gate: owner +
// operations (the dispatch coordinator runs partner approvals day to day).
export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  const gate = await requireRole(req, ["admin", "operations"]);
  if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));
  if (req.method === "GET") {
    const rows = await dbQuery(`SELECT * FROM partners ORDER BY created_at DESC`);
    return sendJson(res, 200, { partners: rows.map(partnerFromRow) });
  }
  if (req.method === "PATCH") {
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    if (!code) return sendJson(res, 400, { error: "Missing partner code" });
    const sets: string[] = []; const vals: any[] = [];
    if (typeof b.status === "string" && ["pending", "approved", "rejected"].includes(b.status)) { vals.push(b.status); sets.push(`status = $${vals.length}`); }
    if (typeof b.verified === "boolean") { vals.push(b.verified); sets.push(`verified = $${vals.length}`); }
    if (typeof b.featured === "boolean") { vals.push(b.featured); sets.push(`featured = $${vals.length}`); if (!b.featured) sets.push(`featured_until = NULL`); }
    if (typeof b.available === "boolean") {
      const cur = await dbQuery(`SELECT data FROM partners WHERE code = $1`, [code]);
      const d = cur.length ? (typeof cur[0].data === "string" ? JSON.parse(cur[0].data || "{}") : (cur[0].data || {})) : {};
      vals.push(JSON.stringify({ ...d, available: b.available })); sets.push(`data = $${vals.length}::jsonb`);
    }
    if (!sets.length) return sendJson(res, 400, { error: "Nothing to update" });
    vals.push(code);
    const rows = await dbQuery(`UPDATE partners SET ${sets.join(", ")} WHERE code = $${vals.length} RETURNING *`, vals);
    if (!rows.length) return sendJson(res, 404, { error: "Partner not found" });
    return sendJson(res, 200, { partner: partnerFromRow(rows[0]) });
  }
  return methodNotAllowed(res, ["GET", "PATCH"]);
});
