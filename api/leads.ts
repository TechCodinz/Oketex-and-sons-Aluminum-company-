import { sendJson, methodNotAllowed, readJson, wrap } from "../server/http";
import { dbQuery, isDbConfigured } from "../server/db";
import { leadFromRow } from "../server/records";
import { isAdmin } from "../server/auth";
import { getServerPartnerTerms, commissionForValue } from "../server/siteSettings";
// POST (public) → create a lead; commission % is snapshotted from the
//   EFFECTIVE server terms at creation, exactly like the demo store.
// GET ?partnerCode= → that partner's leads (code = capability).
// GET (admin, no query) → all leads. PATCH (admin) → {id, status}.
// DELETE (admin) → ?id=
export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "POST") {
    const b = await readJson(req);
    const partnerCode = String(b.partnerCode || "").trim().toUpperCase();
    if (!partnerCode || String(b.customerName || "").trim().length < 2) return sendJson(res, 400, { error: "Missing partner or customer name" });
    const prow = await dbQuery(`SELECT business_name FROM partners WHERE code = $1`, [partnerCode]);
    if (!prow.length) return sendJson(res, 404, { error: "Partner not found" });
    const est = Math.max(0, Math.round(Number(b.estValueNgn) || 0));
    const terms = await getServerPartnerTerms();
    const id = `LED-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const rows = await dbQuery(
      `INSERT INTO leads (id, partner_code, partner_name, type, customer_name, customer_phone, description, est_value_ngn, commission_pct, commission_ngn, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'new') RETURNING *`,
      [id, partnerCode, prow[0].business_name, b.type === "supply" ? "supply" : "job", b.customerName, b.customerPhone || "", b.description || "", est, terms.referralCommissionPct, commissionForValue(est, terms.referralCommissionPct)],
    );
    return sendJson(res, 201, { lead: leadFromRow(rows[0]) });
  }
  if (req.method === "GET") {
    const partnerCode = String(req.query?.partnerCode || "").trim().toUpperCase();
    if (partnerCode) {
      const rows = await dbQuery(`SELECT * FROM leads WHERE partner_code = $1 ORDER BY created_at DESC`, [partnerCode]);
      return sendJson(res, 200, { leads: rows.map(leadFromRow) });
    }
    if (!(await isAdmin(req))) return sendJson(res, 401, { error: "Admin session required" });
    const rows = await dbQuery(`SELECT * FROM leads ORDER BY created_at DESC LIMIT 500`);
    return sendJson(res, 200, { leads: rows.map(leadFromRow) });
  }
  if (req.method === "PATCH" || req.method === "DELETE") {
    if (!(await isAdmin(req))) return sendJson(res, 401, { error: "Admin session required" });
    if (req.method === "DELETE") {
      const id = String(req.query?.id || "");
      if (!id) return sendJson(res, 400, { error: "Missing lead id" });
      await dbQuery(`DELETE FROM leads WHERE id = $1`, [id]);
      return sendJson(res, 200, { ok: true });
    }
    const b = await readJson(req);
    if (!b.id || !["new", "contacted", "won", "paid", "lost"].includes(b.status)) return sendJson(res, 400, { error: "Missing id or bad status" });
    const rows = await dbQuery(`UPDATE leads SET status = $1 WHERE id = $2 RETURNING *`, [b.status, b.id]);
    if (!rows.length) return sendJson(res, 404, { error: "Lead not found" });
    return sendJson(res, 200, { lead: leadFromRow(rows[0]) });
  }
  return methodNotAllowed(res, ["GET", "POST", "PATCH", "DELETE"]);
});
