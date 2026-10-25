import { sendJson, methodNotAllowed, readJson, wrap } from "../http.js";
import { dbQuery, isDbConfigured } from "../db.js";
import { reviewFromRow } from "../records.js";
import { requireRole, roleErrorBody } from "../auth.js";
// Partner reviews (Phase 6). POST (public) → create, status Published.
// A refCode (lead / order / job code) is REQUIRED — reviews stay tied to
// real work, matching the UI honesty gate.
// GET ?partnerCode= → that partner's Published reviews + summary.
// GET ?all=published → every Published review (directory summaries).
// GET (admin, no query) → all incl. Hidden. PATCH/DELETE admin (hide/delete).
export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "POST") {
    const b = await readJson(req);
    const partnerCode = String(b.partnerCode || "").trim().toUpperCase();
    const rating = Math.round(Number(b.rating) || 0);
    if (!partnerCode) return sendJson(res, 400, { error: "Missing partner code" });
    if (String(b.customerName || "").trim().length < 2) return sendJson(res, 400, { error: "Missing your name" });
    if (rating < 1 || rating > 5) return sendJson(res, 400, { error: "Rating must be 1–5" });
    if (String(b.refCode || "").trim().length < 3) return sendJson(res, 400, { error: "A reference code (lead, order or job) is required" });
    const prow = await dbQuery(`SELECT code FROM partners WHERE code = $1`, [partnerCode]);
    if (!prow.length) return sendJson(res, 404, { error: "Partner not found" });
    const id = `REV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const rows = await dbQuery(
      `INSERT INTO reviews (id, partner_code, customer_name, rating, text, ref_code, status)
       VALUES ($1,$2,$3,$4,$5,$6,'Published') RETURNING *`,
      [id, partnerCode, b.customerName, rating, b.text || "", String(b.refCode).trim().toUpperCase()],
    );
    return sendJson(res, 201, { review: reviewFromRow(rows[0]) });
  }
  if (req.method === "GET") {
    const partnerCode = String(req.query?.partnerCode || "").trim().toUpperCase();
    if (partnerCode) {
      const rows = await dbQuery(`SELECT * FROM reviews WHERE partner_code = $1 AND status = 'Published' ORDER BY created_at DESC LIMIT 200`, [partnerCode]);
      const reviews = rows.map(reviewFromRow);
      const count = reviews.length;
      const avg = count ? Math.round((reviews.reduce((s: number, r: any) => s + r.rating, 0) / count) * 10) / 10 : 0;
      return sendJson(res, 200, { reviews, summary: { avg, count } });
    }
    if (String(req.query?.all || "") === "published") {
      const rows = await dbQuery(`SELECT * FROM reviews WHERE status = 'Published' ORDER BY created_at DESC LIMIT 1000`);
      return sendJson(res, 200, { reviews: rows.map(reviewFromRow) });
    }
    // Moderation list + actions: owner + support (Staff System role gate).
    const gate = await requireRole(req, ["admin", "support"]);
    if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));
    const rows = await dbQuery(`SELECT * FROM reviews ORDER BY created_at DESC LIMIT 500`);
    return sendJson(res, 200, { reviews: rows.map(reviewFromRow) });
  }
  if (req.method === "PATCH" || req.method === "DELETE") {
    const gate = await requireRole(req, ["admin", "support"]);
    if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));
    if (req.method === "DELETE") {
      const id = String(req.query?.id || "");
      if (!id) return sendJson(res, 400, { error: "Missing review id" });
      await dbQuery(`DELETE FROM reviews WHERE id = $1`, [id]);
      return sendJson(res, 200, { ok: true });
    }
    const b = await readJson(req);
    if (!b.id || !["Published", "Hidden"].includes(b.status)) return sendJson(res, 400, { error: "Missing id or bad status" });
    const rows = await dbQuery(`UPDATE reviews SET status = $1 WHERE id = $2 RETURNING *`, [b.status, b.id]);
    if (!rows.length) return sendJson(res, 404, { error: "Review not found" });
    return sendJson(res, 200, { review: reviewFromRow(rows[0]) });
  }
  return methodNotAllowed(res, ["GET", "POST", "PATCH", "DELETE"]);
});
