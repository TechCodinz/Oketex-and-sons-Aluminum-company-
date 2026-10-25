import { sendJson, methodNotAllowed, readJson, wrap } from "../http.js";
import { dbQuery, isDbConfigured } from "../db.js";
import { supplyFromRow } from "../records.js";
import { requireRole, roleErrorBody } from "../auth.js";
import { logActivityServer } from "../activityLog.js";
// Supply Requests — procurement (Stage S3, partner two-way flow). Oketex
// BUYS or HIRES from its partner network: staff raise a request (targeted
// at capability-matched partners, or broadcast to approved sellers/both),
// partners quote, staff approve one quote, goods get marked Received.
// NO commission — this is an Oketex purchase, and the chosen total is the
// committed spend the accounts view reports.
// PRIVACY (enforced here, mirroring the jobs phone-strip pattern):
//  - partner reads (?partnerCode=&phone= proof) return only requests the
//    partner may see, with `quotes` stripped to their OWN quote;
//  - a broadcast (no targets) is visible to APPROVED partners whose kind
//    is seller or both — a pro-only partner never sees seller broadcasts;
//  - quote totals are computed SERVER-side (qty × unit price).
const digits = (p: unknown) => String(p || "").replace(/\D/g, "");
function phoneMatches(stored: string, given: string): boolean {
  const g = digits(given); if (g.length < 7) return false;
  return digits(stored).endsWith(g.slice(-10));
}
async function loadPartner(code: string): Promise<any | null> {
  const rows = await dbQuery(`SELECT * FROM partners WHERE code = $1`, [code]);
  return rows.length ? rows[0] : null;
}
function visibleTo(rec: any, partnerRow: any): boolean {
  if (partnerRow.status !== "approved") return false;
  const targets: string[] = Array.isArray(rec.targetPartnerCodes) ? rec.targetPartnerCodes : [];
  if (targets.length) return targets.includes(partnerRow.code);
  return partnerRow.role === "seller" || partnerRow.role === "both";
}
async function loadRequest(code: string): Promise<any | null> {
  const rows = await dbQuery(`SELECT * FROM supply_requests WHERE code = $1`, [code]);
  return rows.length ? supplyFromRow(rows[0]) : null;
}
async function saveRequest(rec: any): Promise<any> {
  const rows = await dbQuery(
    `UPDATE supply_requests SET status = $1, chosen_partner_code = $2, chosen_total_ngn = $3, data = $4::jsonb, updated_at = now() WHERE code = $5 RETURNING *`,
    [rec.status, rec.chosenPartnerCode ?? null, rec.chosenTotalNgn ?? null, JSON.stringify(rec), rec.code],
  );
  return supplyFromRow(rows[0]);
}

export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });

  if (req.method === "GET") {
    const partnerCode = String(req.query?.partnerCode || "").trim().toUpperCase();
    if (partnerCode) {
      const prow = await loadPartner(partnerCode);
      if (!prow) return sendJson(res, 404, { error: "Partner not found" });
      if (!phoneMatches(prow.phone || "", String(req.query?.phone || ""))) return sendJson(res, 403, { error: "Phone number does not match this partner" });
      const rows = await dbQuery(`SELECT * FROM supply_requests ORDER BY created_at DESC LIMIT 300`);
      const mine = rows.map((r: any) => supplyFromRow(r)).filter((rec: any) => visibleTo(rec, prow));
      return sendJson(res, 200, { requests: mine.map((rec: any) => ({ ...rec, quotes: (rec.quotes || []).filter((q: any) => q.partnerCode === partnerCode) })) });
    }
    const gate = await requireRole(req, ["admin", "operations", "store", "accounts"]);
    if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));
    const rows = await dbQuery(`SELECT * FROM supply_requests ORDER BY created_at DESC LIMIT 300`);
    return sendJson(res, 200, { requests: rows.map((r: any) => supplyFromRow(r)) });
  }

  if (req.method === "POST") {
    const gate = await requireRole(req, ["admin", "operations"]);
    if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));
    const b = await readJson(req);
    const item = String(b.item || "").trim();
    const qty = Math.max(0, Number(b.qty) || 0);
    if (item.length < 2) return sendJson(res, 400, { error: "Name the item or equipment" });
    if (qty <= 0) return sendJson(res, 400, { error: "Enter a quantity" });
    const now = new Date().toISOString();
    const code = String(b.code || "").trim().toUpperCase() || `SUP-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const rec: any = {
      code, type: b.type === "hire" ? "hire" : "buy", item,
      spec: String(b.spec || ""), qty, unit: String(b.unit || "pcs"),
      neededBy: String(b.neededBy || ""), note: String(b.note || ""),
      targetPartnerCodes: Array.isArray(b.targetPartnerCodes) ? b.targetPartnerCodes.map((c: any) => String(c).toUpperCase()) : [],
      status: "Open", quotes: [], chosenPartnerCode: null, chosenTotalNgn: null,
      createdBy: gate.user.name || gate.user.email, createdAt: now, updatedAt: now,
    };
    const rows = await dbQuery(
      `INSERT INTO supply_requests (code, type, item, status, data) VALUES ($1,$2,$3,'Open',$4::jsonb) RETURNING *`,
      [rec.code, rec.type, rec.item, JSON.stringify(rec)],
    );
    await logActivityServer(gate.user, "supply_created", rec.code, `${rec.type === "hire" ? "Hire" : "Buy"} ${rec.qty} ${rec.unit} — ${rec.item}`);
    return sendJson(res, 201, { request: supplyFromRow(rows[0]) });
  }

  if (req.method === "PATCH") {
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    const action = String(b.action || "");
    if (!code || !action) return sendJson(res, 400, { error: "Missing request code or action" });
    let rec = await loadRequest(code);
    if (!rec) return sendJson(res, 404, { error: "Supply request not found" });

    if (action === "quote") {
      const partnerCode = String(b.partnerCode || "").trim().toUpperCase();
      const prow = await loadPartner(partnerCode);
      if (!prow) return sendJson(res, 404, { error: "Partner not found" });
      if (!phoneMatches(prow.phone || "", String(b.phone || ""))) return sendJson(res, 403, { error: "Phone number does not match this partner" });
      if (!visibleTo(rec, prow)) return sendJson(res, 403, { error: "This request is not open to your business" });
      if (!["Open", "Quoted"].includes(rec.status)) return sendJson(res, 400, { error: `This request is ${rec.status.toLowerCase()} — quoting is closed` });
      const unitPriceNgn = Math.max(0, Math.round(Number(b.unitPriceNgn) || 0));
      if (unitPriceNgn <= 0) return sendJson(res, 400, { error: "Enter your unit price" });
      const quote = {
        partnerCode, partnerName: prow.business_name || partnerCode,
        unitPriceNgn, totalNgn: Math.round(unitPriceNgn * (Number(rec.qty) || 0)),
        leadDays: Math.max(0, Math.round(Number(b.leadDays) || 0)),
        note: String(b.note || ""), at: new Date().toISOString(),
      };
      const quotes = (rec.quotes || []).filter((q: any) => q.partnerCode !== partnerCode);
      quotes.push(quote);
      rec = { ...rec, quotes, status: rec.status === "Open" ? "Quoted" : rec.status };
      const saved = await saveRequest(rec);
      // Partner view of their own quote (never the full quote list).
      return sendJson(res, 200, { request: { ...saved, quotes: saved.quotes.filter((q: any) => q.partnerCode === partnerCode) }, quote });
    }

    if (action === "approve" || action === "received" || action === "cancel") {
      const roles = action === "received" ? ["admin", "operations", "store"] as const : ["admin", "operations"] as const;
      const gate = await requireRole(req, [...roles]);
      if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));
      if (action === "approve") {
        if (!["Open", "Quoted"].includes(rec.status)) return sendJson(res, 400, { error: `A ${rec.status.toLowerCase()} request cannot be approved` });
        const partnerCode = String(b.partnerCode || "").trim().toUpperCase();
        const quote = (rec.quotes || []).find((q: any) => q.partnerCode === partnerCode);
        if (!quote) return sendJson(res, 400, { error: "That partner has not quoted on this request" });
        rec = { ...rec, status: "Approved", chosenPartnerCode: partnerCode, chosenTotalNgn: quote.totalNgn };
        await logActivityServer(gate.user, "supply_approved", rec.code, `Approved ${quote.partnerName} at ${quote.totalNgn} for ${rec.item}`);
      } else if (action === "received") {
        if (rec.status !== "Approved") return sendJson(res, 400, { error: "Only an approved request can be marked received" });
        rec = { ...rec, status: "Received" };
        await logActivityServer(gate.user, "supply_received", rec.code, `Received — ${rec.item}`);
      } else {
        if (["Received", "Cancelled"].includes(rec.status)) return sendJson(res, 400, { error: `A ${rec.status.toLowerCase()} request cannot be cancelled` });
        rec = { ...rec, status: "Cancelled" };
        await logActivityServer(gate.user, "supply_cancelled", rec.code, rec.item);
      }
      return sendJson(res, 200, { request: await saveRequest(rec) });
    }
    return sendJson(res, 400, { error: "Unknown action" });
  }
  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
});
