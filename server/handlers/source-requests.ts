import { sendJson, methodNotAllowed, readJson, wrap } from "../http.js";
import { dbQuery, isDbConfigured } from "../db.js";
import { sourceRequestFromRow } from "../records.js";
import { requireRole, roleErrorBody } from "../auth.js";
import { loadSource, saveSource, pushSourceTimeline, srcDigits, srcPhoneMatches, cleanQuote, quoteTotalOf, SOURCE_STATUSES } from "../sourceStore.js";
// Source-Anything requests (src/lib/sourceRequests.ts) — mirrors snap-requests.
// POST (public) → create, status Received, code SC-YYYY-####.
// GET ?code= (+ optional &phone= proof) → one request; without phone proof
//   the record is publicSafe (phone stripped, quote COST side stripped).
// GET ?phone= → every request for that phone (owner view, full records).
// GET ?all=1 (admin roles) → the whole queue.
// PATCH {code, action} → quote / brief / status (admin) · approve (customer,
//   phone proof). The Sourcing Agent only proposes; a human sends quotes.
export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });

  if (req.method === "POST") {
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    if (!code.startsWith("SC-")) return sendJson(res, 400, { error: "Invalid request code" });
    if (String(b.customerName || "").trim().length < 2) return sendJson(res, 400, { error: "Missing your name" });
    if (srcDigits(b.customerPhone).length < 10) return sendJson(res, 400, { error: "Enter a valid phone number" });
    if (String(b.productName || "").trim().length < 2) return sendJson(res, 400, { error: "Tell us the product you need" });
    const existing = await dbQuery(`SELECT code FROM source_requests WHERE code = $1`, [code]);
    if (existing.length) return sendJson(res, 409, { error: "Request code already exists" });
    const now = new Date().toISOString();
    const rec: any = {
      ...b, code, status: "Received", quote: null, agentBrief: b.agentBrief ?? null,
      timeline: Array.isArray(b.timeline) && b.timeline.length ? b.timeline : [{ ts: now, by: "customer", text: "Sourcing request sent to Oketex." }],
      createdAt: b.createdAt || now, updatedAt: now,
    };
    const rows = await dbQuery(
      `INSERT INTO source_requests (code, status, customer_name, customer_phone, product_name, landed_total_ngn, data)
       VALUES ($1,'Received',$2,$3,$4,0,$5::jsonb) RETURNING *`,
      [code, b.customerName, b.customerPhone, b.productName, JSON.stringify(rec)],
    );
    return sendJson(res, 201, { request: sourceRequestFromRow(rows[0]) });
  }

  if (req.method === "GET") {
    const q = req.query || {};
    if (String(q.all || "") === "1") {
      const gate = await requireRole(req, ["admin", "operations", "sales"]);
      if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));
      const rows = await dbQuery(`SELECT * FROM source_requests ORDER BY created_at DESC LIMIT 500`);
      return sendJson(res, 200, { requests: rows.map((r: any) => sourceRequestFromRow(r)) });
    }
    const code = String(q.code || "").trim().toUpperCase();
    if (code) {
      const rows = await dbQuery(`SELECT * FROM source_requests WHERE code = $1`, [code]);
      if (!rows.length) return sendJson(res, 404, { error: "Request not found" });
      const rec = sourceRequestFromRow(rows[0]);
      const proved = q.phone ? srcPhoneMatches(rec.customerPhone, q.phone) : false;
      return sendJson(res, 200, { request: proved ? rec : sourceRequestFromRow(rows[0], { publicSafe: true }) });
    }
    const phone = String(q.phone || "");
    if (phone) {
      const rows = await dbQuery(`SELECT * FROM source_requests ORDER BY created_at DESC LIMIT 500`);
      const mine = rows.map((r: any) => sourceRequestFromRow(r)).filter((r: any) => srcPhoneMatches(r.customerPhone, phone));
      return sendJson(res, 200, { requests: mine });
    }
    return sendJson(res, 400, { error: "Pass ?code=, ?phone= or ?all=1" });
  }

  if (req.method === "PATCH") {
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    const action = String(b.action || "");
    if (!code) return sendJson(res, 400, { error: "Missing request code" });
    let rec = await loadSource(code);
    if (!rec) return sendJson(res, 404, { error: "Request not found" });

    if (action === "approve") {
      // Customer action — phone proof, only from Quoted.
      if (!srcPhoneMatches(rec.customerPhone, b.phone)) return sendJson(res, 403, { error: "Phone number does not match this request" });
      if (rec.status !== "Quoted") return sendJson(res, 409, { error: "This request is not waiting for approval" });
      rec = pushSourceTimeline({ ...rec, status: "Approved" }, "customer", "Customer approved the quote.");
      return sendJson(res, 200, { request: await saveSource(rec) });
    }

    // Everything else is admin work: owner + operations run the desk, sales work intake.
    const gate = await requireRole(req, ["admin", "operations", "sales"]);
    if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));

    if (action === "quote") {
      const quote = cleanQuote(b.quote);
      if (quoteTotalOf(quote) <= 0) return sendJson(res, 400, { error: "Quote total must be above zero" });
      rec = pushSourceTimeline({ ...rec, status: "Quoted", quote }, "admin", `Quote ready: landed total ₦${quoteTotalOf(quote).toLocaleString("en-US")}${quote.leadDays ? ` · about ${quote.leadDays} days` : ""}.`);
      return sendJson(res, 200, { request: await saveSource(rec) });
    }
    if (action === "brief") {
      rec = { ...rec, agentBrief: b.brief ?? null };
      return sendJson(res, 200, { request: await saveSource(rec) });
    }
    if (action === "status") {
      const status = String(b.status || "");
      if (!SOURCE_STATUSES.includes(status)) return sendJson(res, 400, { error: "Unknown status" });
      rec = pushSourceTimeline({ ...rec, status }, "admin", `Status: ${status}.`);
      return sendJson(res, 200, { request: await saveSource(rec) });
    }
    return sendJson(res, 400, { error: "Unknown action" });
  }

  return methodNotAllowed(res, ["POST", "GET", "PATCH"]);
});
