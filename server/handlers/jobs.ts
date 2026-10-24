import { sendJson, methodNotAllowed, readJson, wrap } from "../http.js";
import { dbQuery, isDbConfigured } from "../db.js";
import { jobFromRow, bidFromRow } from "../records.js";
import { isAdmin } from "../auth.js";
// Jobs board (Phase 6). POST (public) → post a job.
// GET (no query) → PUBLIC board: Open jobs only, customer phones stripped.
// GET ?code= → one job (phone included only with a matching ?phone= or admin).
// GET ?phone= → that customer's jobs (any status, phone included — they
//   supplied their own number, same rule as bookings/orders track lookups).
// PATCH (admin) → {code, status} moderation: Open|Awarded|In Progress|Completed|Closed.
const JOB_STATUSES = ["Open", "Awarded", "In Progress", "Completed", "Closed"];
export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "POST") {
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    if (!code || String(b.title || "").trim().length < 3) return sendJson(res, 400, { error: "Missing job code or title" });
    if (String(b.customerName || "").trim().length < 2) return sendJson(res, 400, { error: "Missing customer name" });
    if (String(b.customerPhone || "").replace(/\D/g, "").length < 10) return sendJson(res, 400, { error: "Missing customer phone" });
    const rows = await dbQuery(
      `INSERT INTO jobs (code, title, trade, description, location, budget_low, budget_high, customer_name, customer_phone, source_quote_code, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Open') RETURNING *`,
      [code, b.title, b.trade || "General", b.description || "", b.location || "",
       Math.max(0, Math.round(Number(b.budgetLow) || 0)), Math.max(0, Math.round(Number(b.budgetHigh) || 0)),
       b.customerName, b.customerPhone, b.sourceQuoteCode || null],
    );
    return sendJson(res, 201, { job: jobFromRow(rows[0]) });
  }
  if (req.method === "GET") {
    const code = String(req.query?.code || "").trim().toUpperCase();
    const phone = String(req.query?.phone || "").replace(/\D/g, "");
    if (code) {
      const rows = await dbQuery(`SELECT * FROM jobs WHERE code = $1`, [code]);
      if (!rows.length) return sendJson(res, 404, { error: "Job not found" });
      const ownPhone = phone && rows[0].customer_phone.replace(/\D/g, "").endsWith(phone.slice(-10));
      const full = ownPhone || (await isAdmin(req));
      const bids = await dbQuery(`SELECT * FROM bids WHERE job_code = $1 ORDER BY created_at ASC`, [code]);
      return sendJson(res, 200, { job: jobFromRow(rows[0], { publicSafe: !full }), bids: bids.map(bidFromRow) });
    }
    if (phone) {
      const rows = await dbQuery(`SELECT * FROM jobs WHERE regexp_replace(customer_phone, '[^0-9]', '', 'g') LIKE '%' || $1 ORDER BY created_at DESC`, [phone.slice(-10)]);
      return sendJson(res, 200, { jobs: rows.map((r: any) => jobFromRow(r)) });
    }
    if (await isAdmin(req) && String(req.query?.all || "") === "1") {
      const rows = await dbQuery(`SELECT * FROM jobs ORDER BY created_at DESC LIMIT 500`);
      return sendJson(res, 200, { jobs: rows.map((r: any) => jobFromRow(r)) });
    }
    const rows = await dbQuery(`SELECT * FROM jobs WHERE status = 'Open' ORDER BY created_at DESC LIMIT 200`);
    const counts = await dbQuery(`SELECT job_code, COUNT(*)::int AS n FROM bids GROUP BY job_code`);
    const countMap = new Map(counts.map((c: any) => [c.job_code, Number(c.n)]));
    return sendJson(res, 200, { jobs: rows.map((r: any) => ({ ...jobFromRow(r, { publicSafe: true }), bidsCount: countMap.get(r.code) || 0 })) });
  }
  if (req.method === "PATCH") {
    if (!(await isAdmin(req))) return sendJson(res, 401, { error: "Admin session required" });
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    if (!code || !JOB_STATUSES.includes(b.status)) return sendJson(res, 400, { error: "Missing code or bad status" });
    const rows = await dbQuery(`UPDATE jobs SET status = $1 WHERE code = $2 RETURNING *`, [b.status, code]);
    if (!rows.length) return sendJson(res, 404, { error: "Job not found" });
    return sendJson(res, 200, { job: jobFromRow(rows[0]) });
  }
  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
});
