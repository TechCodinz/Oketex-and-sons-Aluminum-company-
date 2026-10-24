import { sendJson, methodNotAllowed, readJson, wrap } from "../http.js";
import { dbQuery, isDbConfigured } from "../db.js";
import { partnerFromRow } from "../records.js";
// GET  → public directory list (approved only).
// POST → partner registration; always lands as status 'pending'.
// PATCH {code, phone, available} → partner self-service availability toggle
// (Snap & Send assignments), phone-proofed like the jobs owner view.
export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "PATCH") {
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    if (!code || typeof b.available !== "boolean") return sendJson(res, 400, { error: "Missing partner code or availability flag" });
    const rows = await dbQuery(`SELECT * FROM partners WHERE code = $1`, [code]);
    if (!rows.length) return sendJson(res, 404, { error: "Partner not found" });
    const stored = String(rows[0].phone || "").replace(/\D/g, "");
    const given = String(b.phone || "").replace(/\D/g, "");
    if (given.length < 7 || !stored.endsWith(given.slice(-10))) return sendJson(res, 403, { error: "Phone number does not match this partner" });
    const cur = typeof rows[0].data === "string" ? JSON.parse(rows[0].data || "{}") : (rows[0].data || {});
    const upd = await dbQuery(`UPDATE partners SET data = $1::jsonb WHERE code = $2 RETURNING *`, [JSON.stringify({ ...cur, available: b.available }), code]);
    return sendJson(res, 200, { partner: partnerFromRow(upd[0]) });
  }
  if (req.method === "GET") {
    const rows = await dbQuery(`SELECT * FROM partners WHERE status = 'approved' ORDER BY featured DESC, verified DESC, created_at DESC`);
    return sendJson(res, 200, { partners: rows.map(partnerFromRow) });
  }
  if (req.method === "POST") {
    const p = await readJson(req);
    const code = String(p.code || "").trim().toUpperCase();
    if (!code || String(p.businessName || "").trim().length < 2) return sendJson(res, 400, { error: "Missing partner code or business name" });
    if (String(p.phone || "").replace(/\D/g, "").length < 10) return sendJson(res, 400, { error: "Enter a valid phone number" });
    const existing = await dbQuery(`SELECT code FROM partners WHERE code = $1`, [code]);
    if (existing.length) return sendJson(res, 409, { error: "Partner code already exists" });
    const data = { ...p }; delete data.code;
    const rows = await dbQuery(
      `INSERT INTO partners (code, role, business_name, contact_name, phone, email, location, areas, status, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9::jsonb) RETURNING *`,
      [code, p.role === "seller" ? "seller" : "pro", p.businessName, p.contactName || "", p.phone, p.email || null, p.location || "", p.areas || "", JSON.stringify(data)],
    );
    return sendJson(res, 201, { partner: partnerFromRow(rows[0]) });
  }
  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
});
