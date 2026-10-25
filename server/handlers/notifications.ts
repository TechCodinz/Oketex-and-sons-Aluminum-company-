import { sendJson, methodNotAllowed, readJson, wrap } from "../http.js";
import { dbQuery, isDbConfigured } from "../db.js";
import { notificationFromRow } from "../records.js";
import { requireRole, roleErrorBody } from "../auth.js";
// Notification log (Phase 6). The frontend fires notify() on business
// events (booking, lead, order, invoice, verification, job); each record is
// stored here when the backend is live. Sending is a SEPARATE step — see
// handlers/notifications/dispatch.ts. A record being "logged" never claims
// a message was delivered.
// POST (public) → create (client id honoured when it looks like NTF-…).
// GET (admin) → latest 500. PATCH (admin) → {id, status} (e.g. mark sent
// after a WhatsApp click-through from the admin tab).
const AUDIENCES = ["admin", "customer", "partner"];
const CHANNELS = ["whatsapp", "sms", "email", "inapp"];
const STATUSES = ["queued", "sent", "logged"];
export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "POST") {
    const b = await readJson(req);
    if (String(b.message || "").trim().length < 3) return sendJson(res, 400, { error: "Missing message" });
    const id = /^NTF-[A-Z0-9-]{4,}$/i.test(String(b.id || "")) ? String(b.id).toUpperCase() : `NTF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const status = STATUSES.includes(b.status) ? b.status : "logged";
    const rows = await dbQuery(
      `INSERT INTO notifications (id, audience, ref_code, channel, template_key, message, status, phone, email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
       RETURNING *`,
      [id, AUDIENCES.includes(b.audience) ? b.audience : "admin", b.refCode || "",
       CHANNELS.includes(b.channel) ? b.channel : "inapp", b.templateKey || "", b.message, status,
       b.phone || null, b.email || null],
    );
    return sendJson(res, 201, { notification: notificationFromRow(rows[0]) });
  }
  if (req.method === "GET") {
    // Owner + support run the outbox (Staff System role gate).
    const gate = await requireRole(req, ["admin", "support"]);
    if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));
    const rows = await dbQuery(`SELECT * FROM notifications ORDER BY created_at DESC LIMIT 500`);
    return sendJson(res, 200, { notifications: rows.map(notificationFromRow) });
  }
  if (req.method === "PATCH") {
    const gate = await requireRole(req, ["admin", "support"]);
    if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));
    const b = await readJson(req);
    if (!b.id || !STATUSES.includes(b.status)) return sendJson(res, 400, { error: "Missing id or bad status" });
    const rows = await dbQuery(`UPDATE notifications SET status = $1 WHERE id = $2 RETURNING *`, [b.status, b.id]);
    if (!rows.length) return sendJson(res, 404, { error: "Notification not found" });
    return sendJson(res, 200, { notification: notificationFromRow(rows[0]) });
  }
  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
});
