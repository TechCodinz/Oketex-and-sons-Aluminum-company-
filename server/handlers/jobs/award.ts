import { sendJson, methodNotAllowed, readJson, wrap } from "../../http.js";
import { dbQuery, isDbConfigured } from "../../db.js";
import { jobFromRow, bidFromRow, leadFromRow } from "../../records.js";
import { getServerPartnerTerms, commissionForValue } from "../../siteSettings.js";
import { logActivityServer } from "../../activityLog.js";
// POST {jobCode, bidId} → award a job to a bid: winning bid Accepted, other
// Pending bids Rejected, job → Awarded, and a tracked network LEAD is created
// for the winning partner with the commission % snapshotted from the
// EFFECTIVE server terms at award time — exactly the leads.ts rule, so the
// partner's referral commission is frozen even if terms change later.
export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const b = await readJson(req);
  const jobCode = String(b.jobCode || "").trim().toUpperCase();
  const bidId = String(b.bidId || "").trim();
  if (!jobCode || !bidId) return sendJson(res, 400, { error: "Missing jobCode or bidId" });
  const jrows = await dbQuery(`SELECT * FROM jobs WHERE code = $1`, [jobCode]);
  if (!jrows.length) return sendJson(res, 404, { error: "Job not found" });
  const job = jrows[0];
  if (job.status !== "Open") return sendJson(res, 409, { error: "Job is not open" });
  const brows = await dbQuery(`SELECT * FROM bids WHERE id = $1 AND job_code = $2`, [bidId, jobCode]);
  if (!brows.length) return sendJson(res, 404, { error: "Bid not found for this job" });
  const bid = brows[0];
  if (bid.status !== "Pending") return sendJson(res, 409, { error: "Bid is not pending" });
  await dbQuery(`UPDATE bids SET status = 'Rejected' WHERE job_code = $1 AND status = 'Pending' AND id <> $2`, [jobCode, bidId]);
  const winRows = await dbQuery(`UPDATE bids SET status = 'Accepted' WHERE id = $1 RETURNING *`, [bidId]);
  const jobRows = await dbQuery(`UPDATE jobs SET status = 'Awarded' WHERE code = $1 RETURNING *`, [jobCode]);
  const terms = await getServerPartnerTerms();
  const est = Math.max(0, Math.round(Number(bid.amount) || 0));
  const leadId = `LED-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const leadRows = await dbQuery(
    `INSERT INTO leads (id, partner_code, partner_name, type, customer_name, customer_phone, description, est_value_ngn, commission_pct, commission_ngn, status)
     VALUES ($1,$2,$3,'job',$4,$5,$6,$7,$8,$9,'new') RETURNING *`,
    [leadId, bid.partner_code, bid.partner_name, job.customer_name, job.customer_phone,
     `Won bid on job ${jobCode} — ${job.title}`, est, terms.referralCommissionPct, commissionForValue(est, terms.referralCommissionPct)],
  );
  const allBids = await dbQuery(`SELECT * FROM bids WHERE job_code = $1 ORDER BY created_at ASC`, [jobCode]);
  await logActivityServer({ name: "Customer (self-serve award)", role: "system" }, "job_awarded", jobCode, `Bid accepted from ${bid.partner_name} — lead ${leadId} created`);
  return sendJson(res, 200, { job: jobFromRow(jobRows[0]), bids: allBids.map(bidFromRow), bid: bidFromRow(winRows[0]), lead: leadFromRow(leadRows[0]) });
});
