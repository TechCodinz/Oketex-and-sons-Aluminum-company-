import { sendJson, methodNotAllowed, readJson, wrap } from "../../http.js";
import { dbQuery, isDbConfigured } from "../../db.js";
import { requireRole, roleErrorBody } from "../../auth.js";
import { loadSnap, saveSnap, pushTimeline, ngn } from "../../snapStore.js";
import { getServerPartnerTerms, commissionForValue } from "../../siteSettings.js";
// POST /api/snap-requests/assign (admin) — assign a priced/approved Snap &
// Send request to an APPROVED partner at the agreed price. The commission %
// is snapshotted from the effective partner terms at this moment and the
// commission is computed on the AGREED price (never the list total) —
// mirrors award.ts for job bids. Assigning an unapproved partner → 400.
export default wrap(async (req: any, res: any) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  const gate = await requireRole(req, ["admin", "operations"]);
  if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));
  const b = await readJson(req);
  const code = String(b.code || "").trim().toUpperCase();
  const partnerCode = String(b.partnerCode || "").trim().toUpperCase();
  if (!code || !partnerCode) return sendJson(res, 400, { error: "Missing request or partner code" });
  let rec = await loadSnap(code);
  if (!rec) return sendJson(res, 404, { error: "Request not found" });
  if (!["Priced", "Approved", "Assigned"].includes(rec.status)) return sendJson(res, 400, { error: "Price and get approval for the request before assigning it" });
  const prow = await dbQuery(`SELECT * FROM partners WHERE code = $1`, [partnerCode]);
  if (!prow.length) return sendJson(res, 404, { error: "Partner not found" });
  if (prow[0].status !== "approved") return sendJson(res, 400, { error: "Partner is not approved — only approved partners can be assigned Snap & Send jobs" });
  const agreed = Number(b.agreedPriceNgn) > 0 ? Math.round(Number(b.agreedPriceNgn)) : Math.round(Number(rec.totalNgn) || 0);
  const terms = await getServerPartnerTerms();
  const pct = terms.referralCommissionPct;
  const commissionNgn = commissionForValue(agreed, pct);
  const partnerName = prow[0].business_name || partnerCode;
  rec = pushTimeline({
    ...rec, status: "Assigned", assignedPartnerCode: partnerCode, assignedPartnerName: partnerName,
    agreedPriceNgn: agreed, commissionPct: pct, commissionNgn,
  }, "admin", `Assigned to ${partnerName} at the agreed price of ${ngn(agreed)}.`);
  return sendJson(res, 200, { request: await saveSnap(rec) });
});
