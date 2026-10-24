import { sendJson, methodNotAllowed, readJson, wrap } from "../../http.js";
import { dbQuery, isDbConfigured } from "../../db.js";
import { notificationFromRow } from "../../records.js";
import { isAdmin } from "../../auth.js";
// POST (admin) → attempt REAL sends for queued/logged SMS + email records.
// Providers are env-gated and honest: no TERMII_API_KEY → SMS stays
// "logged" with the dispatch result saying enabled:false; same for
// RESEND_API_KEY and email. WhatsApp records are never dispatched here —
// they go out via the admin's wa.me click-through (see Admin →
// Notifications), because there is no WhatsApp Business API key in scope.
export function smsConfigured(): boolean { return !!(process.env.TERMII_API_KEY || "").trim(); }
export function emailConfigured(): boolean { return !!(process.env.RESEND_API_KEY || "").trim(); }

async function sendSms(rec: any): Promise<{ ok: boolean; detail: string }> {
  const to = String(rec.phone || "").replace(/\D/g, "");
  if (!to) return { ok: false, detail: "No phone number on the record" };
  try {
    const r = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to, from: process.env.TERMII_SENDER_ID || "Oketex", sms: rec.message,
        type: "plain", channel: "generic", api_key: process.env.TERMII_API_KEY,
      }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (r.ok && (j.code === "ok" || j.message_id || j.messageId)) return { ok: true, detail: `Termii accepted (${j.message_id || j.messageId || "ok"})` };
    return { ok: false, detail: `Termii responded ${r.status}: ${String(j.message || j.detail || "").slice(0, 160)}` };
  } catch (e: any) { return { ok: false, detail: `Termii request failed: ${String(e?.message || e).slice(0, 160)}` }; }
}
async function sendEmail(rec: any): Promise<{ ok: boolean; detail: string }> {
  const to = String(rec.email || "").trim();
  if (!to) return { ok: false, detail: "No email address on the record" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Oketex <onboarding@resend.dev>",
        to, subject: `Oketex & Sons — update on ${rec.ref_code || "your request"}`,
        text: rec.message,
      }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (r.ok && j.id) return { ok: true, detail: `Resend accepted (${j.id})` };
    return { ok: false, detail: `Resend responded ${r.status}: ${String(j.message || "").slice(0, 160)}` };
  } catch (e: any) { return { ok: false, detail: `Resend request failed: ${String(e?.message || e).slice(0, 160)}` }; }
}

export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!(await isAdmin(req))) return sendJson(res, 401, { error: "Admin session required" });
  const sms = smsConfigured(), email = emailConfigured();
  if (!sms && !email) {
    // Honest no-op: nothing can be sent, records keep their status.
    return sendJson(res, 200, { enabled: false, sms, email, attempted: 0, sent: 0, results: [], note: "No provider keys configured (TERMII_API_KEY / RESEND_API_KEY) — records stay logged." });
  }
  const b = await readJson(req);
  const ids: string[] = Array.isArray(b.ids) ? b.ids.map((x: any) => String(x)) : [];
  const rows = ids.length
    ? await dbQuery(`SELECT * FROM notifications WHERE id = ANY($1) AND channel IN ('sms','email') AND status <> 'sent'`, [ids])
    : await dbQuery(`SELECT * FROM notifications WHERE channel IN ('sms','email') AND status <> 'sent' ORDER BY created_at ASC LIMIT 100`);
  const results: any[] = [];
  let sent = 0;
  for (const rec of rows) {
    const can = rec.channel === "sms" ? sms : email;
    if (!can) { results.push({ id: rec.id, skipped: true, detail: `No ${rec.channel} provider configured` }); continue; }
    const out = rec.channel === "sms" ? await sendSms(rec) : await sendEmail(rec);
    const next = out.ok ? "sent" : rec.status;
    if (out.ok) sent++;
    const upd = await dbQuery(`UPDATE notifications SET status = $1, detail = $2 WHERE id = $3 RETURNING *`, [next, out.detail, rec.id]);
    results.push({ id: rec.id, sent: out.ok, detail: out.detail, notification: notificationFromRow(upd[0]) });
  }
  return sendJson(res, 200, { enabled: true, sms, email, attempted: rows.length, sent, results });
});
