import { sendJson, methodNotAllowed, readJson, wrap } from "../../http.js";
import { dbQuery, isDbConfigured } from "../../db.js";
import { bidFromRow } from "../../records.js";
// POST (public, partner code = capability like leads) → place/update a bid.
// The partner must exist and be APPROVED. One live bid per partner per job:
// a second POST from the same partner updates their Pending bid in place.
// GET ?jobCode= → bids for a job. GET ?partnerCode= → that partner's bids.
export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "GET") {
    const jobCode = String(req.query?.jobCode || "").trim().toUpperCase();
    const partnerCode = String(req.query?.partnerCode || "").trim().toUpperCase();
    if (jobCode) {
      const rows = await dbQuery(`SELECT * FROM bids WHERE job_code = $1 ORDER BY created_at ASC`, [jobCode]);
      return sendJson(res, 200, { bids: rows.map(bidFromRow) });
    }
    if (partnerCode) {
      const rows = await dbQuery(`SELECT * FROM bids WHERE partner_code = $1 ORDER BY created_at DESC`, [partnerCode]);
      return sendJson(res, 200, { bids: rows.map(bidFromRow) });
    }
    return sendJson(res, 400, { error: "Pass jobCode or partnerCode" });
  }
  if (req.method === "POST") {
    const b = await readJson(req);
    const jobCode = String(b.jobCode || "").trim().toUpperCase();
    const partnerCode = String(b.partnerCode || "").trim().toUpperCase();
    const amount = Math.round(Number(b.amount) || 0);
    if (!jobCode || !partnerCode || amount <= 0) return sendJson(res, 400, { error: "Missing job, partner or bid amount" });
    const jrows = await dbQuery(`SELECT status FROM jobs WHERE code = $1`, [jobCode]);
    if (!jrows.length) return sendJson(res, 404, { error: "Job not found" });
    if (jrows[0].status !== "Open") return sendJson(res, 409, { error: "Job is not open for bids" });
    const prow = await dbQuery(`SELECT business_name, status FROM partners WHERE code = $1`, [partnerCode]);
    if (!prow.length) return sendJson(res, 404, { error: "Partner not found" });
    if (prow[0].status !== "approved") return sendJson(res, 403, { error: "Only approved partners can bid" });
    const days = Math.max(0, Math.round(Number(b.days) || 0));
    const existing = await dbQuery(`SELECT * FROM bids WHERE job_code = $1 AND partner_code = $2 AND status = 'Pending'`, [jobCode, partnerCode]);
    if (existing.length) {
      const rows = await dbQuery(
        `UPDATE bids SET amount = $1, days = $2, note = $3 WHERE id = $4 RETURNING *`,
        [amount, days, b.note || "", existing[0].id],
      );
      return sendJson(res, 200, { bid: bidFromRow(rows[0]), updated: true });
    }
    const id = `BID-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const rows = await dbQuery(
      `INSERT INTO bids (id, job_code, partner_code, partner_name, amount, days, note, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Pending') RETURNING *`,
      [id, jobCode, partnerCode, prow[0].business_name, amount, days, b.note || ""],
    );
    return sendJson(res, 201, { bid: bidFromRow(rows[0]) });
  }
  return methodNotAllowed(res, ["GET", "POST"]);
});
