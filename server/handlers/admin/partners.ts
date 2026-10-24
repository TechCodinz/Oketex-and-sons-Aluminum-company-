import { sendJson, methodNotAllowed, readJson, wrap } from "../../http.js";
import { dbQuery, isDbConfigured } from "../../db.js";
import { partnerFromRow } from "../../records.js";
import { isAdmin } from "../../auth.js";
// Admin-only partner management: GET all (incl. pending) + PATCH one
// {code, status?, verified?, featured?}.
export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (!(await isAdmin(req))) return sendJson(res, 401, { error: "Admin session required" });
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
