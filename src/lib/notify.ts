// Notifications engine (Phase 6) — every business event worth telling
// someone about becomes a RECORD first. Records live in `oketex-notifications`
// and sync to POST /api/notifications when the backend is live.
// Honesty rule: a record says "logged" until something actually sends it.
// WhatsApp goes out via the admin's wa.me click-through (no WhatsApp API key
// in scope); SMS (Termii) and email (Resend) dispatch server-side ONLY when
// their env keys are configured — otherwise statuses stay "logged"/"queued"
// and the admin tab says so plainly.
import { getBusiness } from "./settings";
import { apiFetch, probeApi } from "./api";

export type NotifyAudience = "admin" | "customer" | "partner";
export type NotifyChannel = "whatsapp" | "sms" | "email" | "inapp";
export type NotifyStatus = "queued" | "sent" | "logged";
export interface NotificationRecord {
  id: string; ts: string; audience: NotifyAudience; refCode: string;
  channel: NotifyChannel; templateKey: string; message: string;
  status: NotifyStatus; phone?: string; email?: string; detail?: string;
}

export type NotifyTemplateKey =
  | "booking_created" | "lead_created_admin" | "lead_created_partner"
  | "verify_requested" | "invoice_sent" | "order_placed"
  | "job_posted" | "bid_accepted"
  | "snap_received" | "snap_priced" | "snap_assigned_partner" | "snap_assigned_customer" | "snap_completed"
  | "chase_snap_approval" | "chase_partner_progress" | "chase_invoice_payment" | "chase_operator_stale"
  | "supply_requested" | "supply_quoted" | "supply_won";
export interface NotifyVars {
  business?: string; code?: string; amount?: string; total?: string; balance?: string;
  name?: string; phone?: string; partner?: string; service?: string; date?: string;
  due?: string; title?: string; address?: string;
}
/** Every template in ONE place. Merge fields: {business} {code} {amount}
 *  {total} {balance} {name} {phone} {partner} {service} {date} {due} {title}. */
export const NOTIFY_TEMPLATES: Record<NotifyTemplateKey, string> = {
  booking_created: "New booking {code} at {business}: {service} for {name} on {date}. Customer phone: {phone}. See Admin → Bookings.",
  lead_created_admin: "New partner lead {code} at {business}: {name} ({phone}) requested {partner}. See Admin → Partners → Leads.",
  lead_created_partner: "Hello {partner}, you have a new lead via {business} (ref {code}): {name} — {phone}. Please reach out promptly; reply to Oketex when the job is won.",
  verify_requested: "Pro-check requested {code} at {business}: {name} ({phone}) asked a pro to verify a quotation. See Admin → Verification.",
  invoice_sent: "Hello {name}, your invoice {code} from {business} totals {total}. Balance due: {balance}. Due date: {due}. Thank you.",
  order_placed: "New order {code} at {business}: {name} ({phone}) — total {amount}. See Admin → Orders.",
  job_posted: "New job posted {code} at {business}: \"{title}\" by {name} ({phone}). Approved pros can bid on the Jobs board.",
  bid_accepted: "Hello {partner}, your bid was accepted for job {code} via {business}. Customer: {name}, {phone}. A tracked network lead has been created for you.",
  snap_received: "New Snap & Send request {code} at {business}: {name} ({phone}) sent a {title}. See Admin → Snap & Send to review and price it.",
  snap_priced: "Hello {name}, {business} has priced your Snap & Send request {code}: total {amount}. Open Track on our site, enter your code, review the breakdown and approve to proceed.",
  snap_assigned_partner: "Hello {partner}, you have been assigned Snap & Send job {code} via {business} at the agreed price {amount}. Customer: {name}, {phone}. Site: {address}. Open Partner Status to see the map and post progress updates.",
  snap_assigned_customer: "Hello {name}, good news — {business} assigned {partner} to your Snap & Send job {code} at the agreed price {amount}. Follow progress in Track on our site.",
  snap_completed: "Snap & Send job {code} at {business} was marked complete by {partner}. Customer: {name} ({phone}). Please confirm with the customer.",
  // Ops Agent chasers (Staff System, 2026-10-25) — drafted by the agent,
  // sent by a human's tap, never autonomously.
  chase_snap_approval: "Hello {name}, a gentle reminder from {business}: your Snap & Send job {code} is priced at {amount} and waiting for your approval. Open Track on our site, enter your code, review the breakdown and tap Approve — or reply here and we will help.",
  chase_partner_progress: "Hello {partner}, {business} is checking in on Snap & Send job {code} — no progress update has been posted in over 48 hours. Please open Partner Status and post an update so the customer stays informed.",
  chase_invoice_payment: "Hello {name}, a reminder from {business}: invoice {code} has a balance of {balance} which was due on {due}. Please arrange payment, or contact the office if you need the details again. Thank you.",
  chase_operator_stale: "Hello {name}, production job {code} ({title}) has been In Production for over 48 hours without a finish update. Please check the job card and update the floor board.",
  // Partner two-way flow (Stage S3) — procurement, no commission involved.
  supply_requested: "Hello {partner}, {business} needs a supply quote: {title} (ref {code}). Open Partner Status → Supply Requests to see the spec and send your price.",
  supply_quoted: "Supply quote received for {code} at {business}: {partner} quoted {amount}. See Admin → Supply to compare quotes.",
  supply_won: "Hello {partner}, good news — {business} approved your quote for supply request {code} at {amount}. Please confirm delivery timing with the office.",
};
export function renderTemplate(key: NotifyTemplateKey, vars: NotifyVars): string {
  const tpl = NOTIFY_TEMPLATES[key] || "";
  return tpl.replace(/\{(\w+)\}/g, (_m, k) => String((vars as Record<string, unknown>)[k] ?? "")).replace(/\s+/g, " ").trim();
}

/** Nigerian phone → wa.me digits (234…), same rule as the partner store. */
export function ngWaDigits(phone: string): string {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("234")) return d;
  if (d.startsWith("0")) return `234${d.slice(1)}`;
  return d;
}

const KEY = "oketex-notifications";
export function getNotifications(): NotificationRecord[] {
  try { const r = localStorage.getItem(KEY); return r ? (JSON.parse(r) as NotificationRecord[]) : []; } catch { return []; }
}
export function saveNotifications(list: NotificationRecord[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 500))); } catch { /* ignore */ }
}
function patchLocal(id: string, patch: Partial<NotificationRecord>) {
  saveNotifications(getNotifications().map(n => (n.id === id ? { ...n, ...patch } : n)));
}

export interface NotifyInput {
  templateKey: NotifyTemplateKey; audience: NotifyAudience; refCode: string;
  channel?: NotifyChannel; phone?: string; email?: string; vars?: NotifyVars;
}
/** Fire-and-record a notification. Returns the record synchronously; the
 *  server sync + any provider dispatch happen in the background and update
 *  the stored status when (and only when) they actually succeed. */
export function notify(input: NotifyInput): NotificationRecord {
  const b = getBusiness();
  const message = renderTemplate(input.templateKey, { business: b.name, ...input.vars });
  const channel: NotifyChannel = input.channel ?? (input.audience === "admin" ? "inapp" : "whatsapp");
  const rec: NotificationRecord = {
    id: `NTF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    ts: new Date().toISOString(), audience: input.audience, refCode: input.refCode,
    channel, templateKey: input.templateKey, message,
    // SMS/email wait for a provider dispatch; everything else is a log
    // entry until a human sends it (WhatsApp click-through marks it sent).
    status: channel === "sms" || channel === "email" ? "queued" : "logged",
    phone: input.phone, email: input.email,
  };
  saveNotifications([rec, ...getNotifications()]);
  void syncNotification(rec);
  return rec;
}
async function syncNotification(rec: NotificationRecord): Promise<void> {
  if (!(await probeApi())) return;
  try {
    await apiFetch("/api/notifications", { method: "POST", body: JSON.stringify(rec) });
    if (rec.channel === "sms" || rec.channel === "email") {
      const r = await apiFetch<{ enabled: boolean; results?: { id: string; sent: boolean; detail: string }[] }>("/api/notifications/dispatch", { method: "POST", body: JSON.stringify({ ids: [rec.id] }) });
      const mine = r.results?.find(x => x.id === rec.id);
      if (mine) patchLocal(rec.id, { status: mine.sent ? "sent" : rec.status, detail: mine.detail });
    }
  } catch { /* local copy stands — the record is the source of truth in demo */ }
}
/** Admin list: server records (live) merged with this device's, newest first. */
export async function getNotificationsAsync(): Promise<NotificationRecord[]> {
  const local = getNotifications();
  if (await probeApi()) {
    try {
      const { notifications } = await apiFetch<{ notifications: NotificationRecord[] }>("/api/notifications");
      const byId = new Map<string, NotificationRecord>();
      for (const n of [...notifications, ...local]) if (!byId.has(n.id)) byId.set(n.id, n);
      return [...byId.values()].sort((a, b) => b.ts.localeCompare(a.ts));
    } catch { /* local only (admin list needs an admin session when live) */ }
  }
  return local;
}
export async function markNotificationSentAsync(id: string): Promise<void> {
  patchLocal(id, { status: "sent" });
  if (await probeApi()) { try { await apiFetch("/api/notifications", { method: "PATCH", body: JSON.stringify({ id, status: "sent" }) }); } catch { /* local stands */ } }
}
/** Ask the server to dispatch every queued SMS/email record. Returns the
 *  server's verdict — enabled:false means no provider keys are configured
 *  and nothing was sent (records stay logged/queued, honestly). */
export async function dispatchNotificationsAsync(): Promise<{ enabled: boolean; attempted: number; sent: number; note?: string }> {
  if (!(await probeApi())) return { enabled: false, attempted: 0, sent: 0, note: "Backend not live — records are stored on this device only." };
  const r = await apiFetch<{ enabled: boolean; attempted: number; sent: number; note?: string; results?: { id: string; sent: boolean; detail: string }[] }>("/api/notifications/dispatch", { method: "POST", body: JSON.stringify({}) });
  for (const x of r.results || []) if (x.sent) patchLocal(x.id, { status: "sent", detail: x.detail });
  return r;
}
/** wa.me link that sends this record's message to the right person:
 *  admin-audience → the business's own WhatsApp; customer/partner → the
 *  phone captured on the record. Null when no phone is known. */
export function notificationWaLink(rec: NotificationRecord): string | null {
  const target = rec.audience === "admin" ? getBusiness().whatsapp : ngWaDigits(rec.phone || "");
  if (!target || target.length < 10) return null;
  return `https://wa.me/${target}?text=${encodeURIComponent(rec.message)}`;
}
