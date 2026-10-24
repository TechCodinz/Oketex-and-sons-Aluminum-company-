import { sendJson, methodNotAllowed, readJson, wrap } from "../http.js";
import { dbQuery, isDbConfigured } from "../db.js";
import { snapRequestFromRow } from "../records.js";
import { isAdmin } from "../auth.js";
import { loadSnap, saveSnap, pushTimeline, snapDigits, snapPhoneMatches, SNAP_STATUSES } from "../snapStore.js";
// Snap & Send requests (src/lib/snapRequests.ts).
// POST (public) → create, status Received.
// GET ?code= (+ optional &phone= proof) → one request; without phone proof
//   the record is publicSafe (phone stripped) — same trust model as jobs.
// GET ?phone= → every request for that phone (owner view, full records).
// GET ?partnerCode= → requests assigned to that partner (full records — the
//   assigned pro legitimately sees the customer's phone + site).
// GET ?all=1 (admin) → the whole queue.
// PATCH {code, action} → approve (customer, phone proof) · progress / start /
//   complete (assigned partner) · decline / status / timeline (admin).
// Pricing lives in snap-requests/assess.ts, assignment (with the commission
// snapshot) in snap-requests/assign.ts.
export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });

  if (req.method === "POST") {
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase() || `SR-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    if (String(b.customerName || "").trim().length < 2) return sendJson(res, 400, { error: "Missing your name" });
    if (snapDigits(b.customerPhone).length < 10) return sendJson(res, 400, { error: "Enter a valid phone number" });
    if (String(b.description || "").trim().length < 3) return sendJson(res, 400, { error: "Tell us what you need in a few words" });
    const existing = await dbQuery(`SELECT code FROM snap_requests WHERE code = $1`, [code]);
    if (existing.length) return sendJson(res, 409, { error: "Request code already exists" });
    const now = new Date().toISOString();
    const rec: any = {
      ...b, code, status: "Received",
      assessment: null, totalNgn: 0, agreedPriceNgn: null, commissionPct: null, commissionNgn: null, assignedPartnerCode: null,
      timeline: Array.isArray(b.timeline) && b.timeline.length ? b.timeline : [{ ts: now, by: "customer", text: "Request sent to Oketex." }],
      createdAt: b.createdAt || now, updatedAt: now,
    };
    const rows = await dbQuery(
      `INSERT INTO snap_requests (code, intent, status, customer_name, customer_phone, data)
       VALUES ($1,$2,'Received',$3,$4,$5::jsonb) RETURNING *`,
      [code, ["fix", "build", "sell", "other"].includes(b.intent) ? b.intent : "fix", b.customerName, b.customerPhone, JSON.stringify(rec)],
    );
    return sendJson(res, 201, { request: snapRequestFromRow(rows[0]) });
  }

  if (req.method === "GET") {
    const q = req.query || {};
    if (String(q.all || "") === "1") {
      if (!(await isAdmin(req))) return sendJson(res, 401, { error: "Admin session required" });
      const rows = await dbQuery(`SELECT * FROM snap_requests ORDER BY created_at DESC LIMIT 500`);
      return sendJson(res, 200, { requests: rows.map((r: any) => snapRequestFromRow(r)) });
    }
    const partnerCode = String(q.partnerCode || "").trim().toUpperCase();
    if (partnerCode) {
      const rows = await dbQuery(`SELECT * FROM snap_requests WHERE assigned_partner_code = $1 ORDER BY created_at DESC LIMIT 200`, [partnerCode]);
      return sendJson(res, 200, { requests: rows.map((r: any) => snapRequestFromRow(r)) });
    }
    const code = String(q.code || "").trim().toUpperCase();
    if (code) {
      const rec = await loadSnap(code);
      if (!rec) return sendJson(res, 404, { error: "Request not found" });
      const proved = q.phone ? snapPhoneMatches(rec.customerPhone, q.phone) : false;
      return sendJson(res, 200, { request: proved ? rec : { ...rec, customerPhone: "" } });
    }
    const phone = String(q.phone || "");
    if (phone) {
      const rows = await dbQuery(`SELECT * FROM snap_requests ORDER BY created_at DESC LIMIT 500`);
      const mine = rows.map((r: any) => snapRequestFromRow(r)).filter((r: any) => snapPhoneMatches(r.customerPhone, phone));
      return sendJson(res, 200, { requests: mine });
    }
    return sendJson(res, 400, { error: "Pass ?code=, ?phone=, ?partnerCode= or ?all=1" });
  }

  if (req.method === "PATCH") {
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    const action = String(b.action || "");
    if (!code) return sendJson(res, 400, { error: "Missing request code" });
    let rec = await loadSnap(code);
    if (!rec) return sendJson(res, 404, { error: "Request not found" });

    if (action === "approve") {
      if (!snapPhoneMatches(rec.customerPhone, b.phone)) return sendJson(res, 403, { error: "Phone number does not match this request" });
      if (rec.status !== "Priced") return sendJson(res, 400, { error: "Only a priced request can be approved" });
      rec = pushTimeline({ ...rec, status: "Approved" }, "customer", "Customer approved the price.");
      return sendJson(res, 200, { request: await saveSnap(rec) });
    }
    if (action === "progress" || action === "start" || action === "complete") {
      const partnerCode = String(b.partnerCode || "").trim().toUpperCase();
      if (!rec.assignedPartnerCode || rec.assignedPartnerCode !== partnerCode) return sendJson(res, 403, { error: "Only the assigned partner can update this job" });
      if (action === "progress") {
        const text = String(b.text || "").trim();
        if (!text && !b.photo) return sendJson(res, 400, { error: "Write an update or attach a photo" });
        rec = pushTimeline(rec, "partner", text || "Photo update", b.photo ? String(b.photo) : undefined);
      } else if (action === "start") {
        if (rec.status !== "Assigned") return sendJson(res, 400, { error: "Only an assigned job can be started" });
        rec = pushTimeline({ ...rec, status: "In Progress" }, "partner", "The pro has started the job.");
      } else {
        if (!["Assigned", "In Progress"].includes(rec.status)) return sendJson(res, 400, { error: "This job cannot be marked complete yet" });
        rec = pushTimeline({ ...rec, status: "Completed" }, "partner", "The pro marked the job complete.");
      }
      return sendJson(res, 200, { request: await saveSnap(rec) });
    }
    if (action === "decline" || action === "status" || action === "timeline") {
      if (!(await isAdmin(req))) return sendJson(res, 401, { error: "Admin session required" });
      if (action === "decline") {
        const note = String(b.note || "").trim();
        rec = pushTimeline({ ...rec, status: "Declined" }, "admin", note ? `Declined by Oketex: ${note}` : "Declined by Oketex.");
      } else if (action === "status") {
        if (!SNAP_STATUSES.includes(b.status)) return sendJson(res, 400, { error: "Bad status" });
        rec = { ...rec, status: b.status };
      } else {
        const text = String(b.text || "").trim();
        if (!text) return sendJson(res, 400, { error: "Missing note text" });
        rec = pushTimeline(rec, "admin", text);
      }
      return sendJson(res, 200, { request: await saveSnap(rec) });
    }
    return sendJson(res, 400, { error: "Unknown action" });
  }

  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
});
