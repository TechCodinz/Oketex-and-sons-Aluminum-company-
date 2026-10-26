import { sendJson, methodNotAllowed, readJson, wrap } from "../http.js";
import { dbQuery, isDbConfigured } from "../db.js";
import { knowledgeFromRow } from "../records.js";
import { requireRole, roleErrorBody, STAFF_ROLES } from "../auth.js";
import { logActivityServer } from "../activityLog.js";
// Pro Guide living knowledge — a library that grows with the trade.
// Community entries (partner "pro" + staff submissions) are moderated by
// humans: nothing is public until a staff member approves it. Built-in
// seed cards live in code and are NEVER duplicated into this table; the
// only seed rows here are 'seedref' pointers holding field-confirmation
// counts for a seed id. Confirmations are one-per-partner, enforced by
// the confirmedBy list on the record.
const TRADES = ["Roofing", "Plumbing", "Tiling", "Carpentry & Woodwork", "Electrical", "Painting & Finishing", "Concrete & Masonry", "Welding & Metalwork", "Interior & Cabinetry"];
const KINDS = ["pattern", "fix", "tip"];
const MOD_ROLES = ["admin", "operations", "support"] as const;

const digits = (p: unknown) => String(p || "").replace(/\D/g, "");
function phoneMatches(stored: string, given: string): boolean {
  const g = digits(given); if (g.length < 7) return false;
  return digits(stored).endsWith(g.slice(-10));
}
async function loadPartner(code: string): Promise<any | null> {
  const rows = await dbQuery(`SELECT * FROM partners WHERE code = $1`, [code]);
  return rows.length ? rows[0] : null;
}
async function loadEntry(id: string): Promise<any | null> {
  const rows = await dbQuery(`SELECT * FROM knowledge_entries WHERE id = $1`, [id]);
  return rows.length ? knowledgeFromRow(rows[0]) : null;
}
async function saveEntry(rec: any): Promise<any> {
  const rows = await dbQuery(
    `UPDATE knowledge_entries SET kind=$2, trade=$3, status=$4, contributor_code=$5, data=$6::jsonb, updated_at=now() WHERE id=$1 RETURNING *`,
    [rec.id, rec.kind, rec.trade, rec.status, rec.contributorCode || "", JSON.stringify(rec)],
  );
  return rows.length ? knowledgeFromRow(rows[0]) : rec;
}
function cleanText(v: unknown, max: number): string { return String(v || "").trim().slice(0, max); }
function cleanTools(v: unknown): string[] {
  return (Array.isArray(v) ? v : []).map((t: any) => cleanText(t, 80)).filter(Boolean).slice(0, 20);
}
/** Public shape — moderation internals (confirmedBy) never leave the server. */
function publicEntry(rec: any): any {
  const { confirmedBy, rejectNote, ...rest } = rec;
  return rest;
}

export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });

  if (req.method === "GET") {
    // A partner's own submissions, any status (phone-proofed like the rest).
    const mine = String(req.query?.mine || "").trim().toUpperCase();
    if (mine) {
      const prow = await loadPartner(mine);
      if (!prow) return sendJson(res, 404, { error: "Partner not found" });
      if (!phoneMatches(prow.phone || "", String(req.query?.phone || ""))) return sendJson(res, 403, { error: "Phone number does not match this partner" });
      const rows = await dbQuery(`SELECT * FROM knowledge_entries WHERE contributor_code = $1 ORDER BY created_at DESC LIMIT 200`, [mine]);
      return sendJson(res, 200, { entries: rows.map((r: any) => publicEntry(knowledgeFromRow(r))) });
    }
    if (String(req.query?.all || "") === "1") {
      const gate = await requireRole(req, [...MOD_ROLES]);
      if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));
      const rows = await dbQuery(`SELECT * FROM knowledge_entries ORDER BY created_at DESC LIMIT 300`);
      return sendJson(res, 200, { entries: rows.map((r: any) => knowledgeFromRow(r)) });
    }
    const rows = await dbQuery(`SELECT * FROM knowledge_entries WHERE status = 'approved' ORDER BY created_at DESC LIMIT 300`);
    return sendJson(res, 200, { entries: rows.map((r: any) => publicEntry(knowledgeFromRow(r))) });
  }

  if (req.method === "POST") {
    const b = await readJson(req);
    const title = cleanText(b.title, 160);
    const body = cleanText(b.body, 6000);
    const trade = TRADES.includes(String(b.trade)) ? String(b.trade) : "";
    const kind = KINDS.includes(String(b.kind)) ? String(b.kind) : "tip";
    if (title.length < 4) return sendJson(res, 400, { error: "Give the entry a title (at least 4 characters)" });
    if (body.length < 20) return sendJson(res, 400, { error: "Write the steps or the fix out in full (at least 20 characters)" });
    if (!trade) return sendJson(res, 400, { error: "Pick the trade this belongs to" });

    // Staff session OR approved-partner phone proof. Customers cannot contribute.
    let source = ""; let contributorName = ""; let contributorCode = "";
    const staff = await requireRole(req, [...STAFF_ROLES]);
    if (!("error" in staff)) {
      source = "staff"; contributorName = staff.user.name || staff.user.email || "Oketex staff"; contributorCode = "";
    } else {
      const code = String(b.partnerCode || "").trim().toUpperCase();
      const prow = code ? await loadPartner(code) : null;
      if (!prow) return sendJson(res, 404, { error: "Partner not found — contributions come from registered pros and staff" });
      if (!phoneMatches(prow.phone || "", String(b.phone || ""))) return sendJson(res, 403, { error: "Phone number does not match this partner" });
      if (prow.status !== "approved") return sendJson(res, 403, { error: "Only approved partners can teach the system" });
      source = "pro"; contributorName = prow.business_name || code; contributorCode = code;
    }
    const now = new Date().toISOString();
    const id = `KNW-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const rec: any = {
      id, kind, trade, title, body, tools: cleanTools(b.tools),
      source, contributorName, contributorCode,
      status: "pending", confirmations: 0, confirmedBy: [], rejectNote: "",
      createdAt: now, updatedAt: now,
    };
    const rows = await dbQuery(
      `INSERT INTO knowledge_entries (id, kind, trade, status, contributor_code, data) VALUES ($1,$2,$3,'pending',$4,$5::jsonb) RETURNING *`,
      [rec.id, rec.kind, rec.trade, rec.contributorCode, JSON.stringify(rec)],
    );
    return sendJson(res, 201, { entry: publicEntry(knowledgeFromRow(rows[0])) });
  }

  if (req.method === "PATCH") {
    const b = await readJson(req);
    const id = String(b.id || "").trim();
    const action = String(b.action || "");
    if (!id || !action) return sendJson(res, 400, { error: "Missing entry id or action" });

    if (action === "confirm") {
      const code = String(b.partnerCode || "").trim().toUpperCase();
      const prow = code ? await loadPartner(code) : null;
      if (!prow) return sendJson(res, 404, { error: "Partner not found" });
      if (!phoneMatches(prow.phone || "", String(b.phone || ""))) return sendJson(res, 403, { error: "Phone number does not match this partner" });
      if (prow.status !== "approved") return sendJson(res, 403, { error: "Only approved partners can confirm field results" });
      let rec = await loadEntry(id);
      if (!rec) {
        // Seed pointer: first confirmation of a built-in card creates its
        // seedref row (title/trade come from the client card; content stays in code).
        const title = cleanText(b.seedTitle, 160); const trade = TRADES.includes(String(b.seedTrade)) ? String(b.seedTrade) : "Roofing";
        if (!title) return sendJson(res, 404, { error: "Entry not found" });
        rec = { id, kind: "seedref", trade, title, body: "", tools: [], source: "seed", contributorName: "", contributorCode: "", status: "approved", confirmations: 0, confirmedBy: [], rejectNote: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await dbQuery(
          `INSERT INTO knowledge_entries (id, kind, trade, status, contributor_code, data) VALUES ($1,'seedref',$2,'approved','',$3::jsonb) ON CONFLICT (id) DO NOTHING`,
          [rec.id, rec.trade, JSON.stringify(rec)],
        );
        rec = (await loadEntry(id)) || rec;
      }
      if (rec.status !== "approved") return sendJson(res, 400, { error: "Only published entries can be confirmed" });
      const confirmedBy: string[] = Array.isArray(rec.confirmedBy) ? rec.confirmedBy : [];
      if (confirmedBy.includes(code)) return sendJson(res, 200, { entry: publicEntry(rec), alreadyConfirmed: true });
      const saved = await saveEntry({ ...rec, confirmations: (Number(rec.confirmations) || 0) + 1, confirmedBy: [...confirmedBy, code], updatedAt: new Date().toISOString() });
      return sendJson(res, 200, { entry: publicEntry(saved), alreadyConfirmed: false });
    }

    if (action === "approve" || action === "reject") {
      const gate = await requireRole(req, [...MOD_ROLES]);
      if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));
      const rec = await loadEntry(id);
      if (!rec) return sendJson(res, 404, { error: "Entry not found" });
      if (rec.kind === "seedref") return sendJson(res, 400, { error: "Seed pointers are not moderated" });
      if (action === "approve") {
        const saved = await saveEntry({ ...rec, status: "approved", rejectNote: "", updatedAt: new Date().toISOString() });
        await logActivityServer(gate.user, "knowledge_approved", rec.id, `${rec.trade} — ${rec.title}`);
        return sendJson(res, 200, { entry: publicEntry(saved) });
      }
      const note = cleanText(b.note, 500);
      const saved = await saveEntry({ ...rec, status: "rejected", rejectNote: note, updatedAt: new Date().toISOString() });
      await logActivityServer(gate.user, "knowledge_rejected", rec.id, note ? `${rec.title} — ${note}` : rec.title);
      return sendJson(res, 200, { entry: publicEntry(saved) });
    }
    return sendJson(res, 400, { error: `Unknown action "${action}"` });
  }

  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
});
