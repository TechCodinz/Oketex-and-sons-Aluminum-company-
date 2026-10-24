import { sendJson, methodNotAllowed, readJson, wrap } from "../http.js";
import { dbQuery, isDbConfigured } from "../db.js";
import { quoteFromRow } from "../records.js";
import { isAdmin } from "../auth.js";
// POST (public) → save a calculator quote. GET → admin list only.
export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "POST") {
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    if (!code || String(b.name || "").trim().length < 2) return sendJson(res, 400, { error: "Missing quote code or name" });
    const rows = await dbQuery(
      `INSERT INTO quotes (code, name, phone, email, note, roof_type, colour, area_m2, estimate_ngn, boq_summary, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'new') RETURNING *`,
      [code, b.name, b.phone || "", b.email || null, b.note || null, b.roofType || "", b.colour || null, Number(b.areaM2) || 0, Math.round(Number(b.estimateNgn) || 0), b.boqSummary || null],
    );
    return sendJson(res, 201, { quote: quoteFromRow(rows[0]) });
  }
  if (req.method === "GET") {
    if (!(await isAdmin(req))) return sendJson(res, 401, { error: "Admin session required" });
    const rows = await dbQuery(`SELECT * FROM quotes ORDER BY created_at DESC LIMIT 500`);
    return sendJson(res, 200, { quotes: rows.map(quoteFromRow) });
  }
  return methodNotAllowed(res, ["GET", "POST"]);
});
