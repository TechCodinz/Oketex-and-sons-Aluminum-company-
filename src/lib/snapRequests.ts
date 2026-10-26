// Snap & Send Jobs — a customer snaps a photo/video of a problem, something
// to build, or an item to SELL, and sends it to Oketex. Admin prices the fix
// (items + workmanship + transport + dispatch), the customer approves, and
// Oketex assigns the job to an approved, available partner pro at the agreed
// price with the commission snapshotted from the partner terms at that
// moment. Pros post photo progress updates the customer follows in Track.
// Local-first like the rest of the app: localStorage under
// `oketex-snap-requests` + API-first wrappers when the backend is live.
import { apiFetch, probeApi } from "./api";
import { getPartnerTerms } from "./settings";
import { commissionFor } from "@/data/partnerTerms";

export type SnapIntent = "fix" | "build" | "sell" | "other";
export type SnapStatus = "Received" | "Under Review" | "Priced" | "Approved" | "Assigned" | "In Progress" | "Completed" | "Declined";
export type SnapUrgency = "Normal" | "Urgent" | "Emergency";

export interface SnapItem { name: string; qty: number; unitPrice: number }
export interface SnapAssessment { items: SnapItem[]; workmanshipNgn: number; transportNgn: number; dispatchNgn: number; notes: string; tools: string[] }
/** Standard tools/equipment the assessment editor suggests (chips +
 *  datalist). Free text is always allowed on top of these. */
export const STANDARD_TOOLS = ["Ladder", "Scaffold", "Drill machine", "Angle grinder", "Sealant gun", "Pipe wrench", "Spirit level", "Measuring tape", "Trowel", "Welding machine", "Safety boots/gloves", "Water pump pliers"];
export interface SnapTimelineEntry { ts: string; by: "customer" | "admin" | "partner"; text: string; photo?: string }

export interface SnapRequest {
  code: string;
  intent: SnapIntent;
  mediaType: "photo" | "video";
  photo: string | null;          // compressed dataURL (max 1200px, JPEG q0.8)
  videoPoster: string | null;    // poster frame dataURL when a video was recorded
  videoNote: string;             // honest note: the clip itself stays on the customer's device
  description: string;
  address: string;
  geo: { lat: number; lng: number } | null;
  customerName: string;
  customerPhone: string;
  urgency: SnapUrgency;
  status: SnapStatus;
  // Sell-intent extras
  sellItemName?: string;
  sellAskingNgn?: number;
  sellCondition?: string;
  assessment: SnapAssessment | null;
  totalNgn: number;              // computed from the assessment
  agreedPriceNgn: number | null; // negotiated price (defaults to totalNgn at assignment)
  commissionPct: number | null;  // snapshot from partner terms at assignment
  commissionNgn: number | null;  // computed on the AGREED price
  assignedPartnerCode: string | null;
  assignedPartnerName?: string;
  timeline: SnapTimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

export const SNAP_INTENT_LABEL: Record<SnapIntent, string> = {
  fix: "Fix a problem / leak",
  build: "Build something like this",
  sell: "Sell an item",
  other: "Something else",
};

const KEY = "oketex-snap-requests";
function read(): SnapRequest[] { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) as SnapRequest[] : []; } catch { return []; } }
function write(list: SnapRequest[]) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* quota — photo may be large; server copy stands when live */ } }
export function getSnapRequests(): SnapRequest[] { return read(); }
export function snapRequestCode(): string { return `SR-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; }

export function assessmentTotal(a: SnapAssessment | null | undefined): number {
  if (!a) return 0;
  const items = (a.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);
  return Math.round(items + (Number(a.workmanshipNgn) || 0) + (Number(a.transportNgn) || 0) + (Number(a.dispatchNgn) || 0));
}
/** Commission is always computed on the AGREED price, never the list total. */
export function snapCommission(agreedPriceNgn: number, pct: number): number {
  return Math.round((Math.max(0, agreedPriceNgn || 0) * pct) / 100);
}

export function saveSnapRequest(r: SnapRequest): SnapRequest {
  const all = read(); const i = all.findIndex(x => x.code === r.code);
  if (i >= 0) all[i] = r; else all.unshift(r);
  write(all); return r;
}
export function updateSnapRequest(code: string, patch: Partial<SnapRequest>): SnapRequest | undefined {
  const all = read(); const i = all.findIndex(x => x.code.toUpperCase() === code.toUpperCase());
  if (i < 0) return undefined;
  all[i] = { ...all[i], ...patch, updatedAt: new Date().toISOString() };
  write(all); return all[i];
}
export function appendTimeline(code: string, entry: Omit<SnapTimelineEntry, "ts">): SnapRequest | undefined {
  const cur = read().find(x => x.code.toUpperCase() === code.toUpperCase());
  if (!cur) return undefined;
  return updateSnapRequest(code, { timeline: [...cur.timeline, { ...entry, ts: new Date().toISOString() }] });
}
export function findSnapRequest(code: string): SnapRequest | undefined {
  const s = code.trim().toUpperCase();
  return read().find(r => r.code.toUpperCase() === s);
}
const digits = (p: string) => String(p || "").replace(/\D/g, "");
export function findSnapRequestsByPhone(phone: string): SnapRequest[] {
  const d = digits(phone); if (d.length < 7) return [];
  return read().filter(r => digits(r.customerPhone).endsWith(d.slice(-10)));
}

/** Downscale an image file to a JPEG dataURL (canvas max 1200px, q0.8).
 *  Retries once smaller/lower-q, then rejects with a clear message when the
 *  result is still over ~900KB — oversized photos never enter storage. */
export async function compressImageFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("That file could not be read as a photo. Please pick a JPG or PNG image."));
      im.src = url;
    });
    const render = (maxPx: number, q: number): string => {
      const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * scale));
      c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = c.getContext("2d"); if (!ctx) throw new Error("Photo processing is not available in this browser.");
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", q);
    };
    const approxBytes = (dataUrl: string) => Math.round(dataUrl.length * 0.75);
    let out = render(1200, 0.8);
    if (approxBytes(out) > 900_000) out = render(900, 0.6);
    if (approxBytes(out) > 900_000) throw new Error("That photo is still too large after shrinking (over ~900KB). Please take the photo closer or pick a smaller one.");
    return out;
  } finally { URL.revokeObjectURL(url); }
}
/** Downscale an existing dataURL image (e.g. a video poster frame). */
export async function compressImageDataUrl(dataUrl: string, maxPx = 1200): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("Could not process that image."));
    im.src = dataUrl;
  });
  const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = c.getContext("2d"); if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}

// ---------------- API-first wrappers (demo fallback) ----------------
function dedupeByCode(...lists: SnapRequest[][]): SnapRequest[] {
  const seen = new Set<string>(); const out: SnapRequest[] = [];
  for (const list of lists) for (const item of list) { const k = item.code.toUpperCase(); if (!seen.has(k)) { seen.add(k); out.push(item); } }
  return out;
}

export async function createSnapRequestAsync(input: Omit<SnapRequest, "code" | "status" | "assessment" | "totalNgn" | "agreedPriceNgn" | "commissionPct" | "commissionNgn" | "assignedPartnerCode" | "timeline" | "createdAt" | "updatedAt"> & { code?: string }): Promise<SnapRequest> {
  const now = new Date().toISOString();
  const local: SnapRequest = {
    ...input, code: input.code || snapRequestCode(), status: "Received",
    assessment: null, totalNgn: 0, agreedPriceNgn: null, commissionPct: null, commissionNgn: null, assignedPartnerCode: null,
    timeline: [{ ts: now, by: "customer", text: "Request sent to Oketex." + (input.mediaType === "video" ? " A short video was recorded — poster frame attached." : "") }],
    createdAt: now, updatedAt: now,
  };
  if (await probeApi()) {
    try { const { request } = await apiFetch<{ request: SnapRequest }>("/api/snap-requests", { method: "POST", body: JSON.stringify(local) }); return saveSnapRequest(request); }
    catch { /* fall back to local */ }
  }
  return saveSnapRequest(local);
}

export async function getSnapRequestsAdminAsync(): Promise<SnapRequest[]> {
  if (await probeApi()) {
    try { const { requests } = await apiFetch<{ requests: SnapRequest[] }>("/api/snap-requests?all=1"); return dedupeByCode(requests, getSnapRequests()); }
    catch { /* fall through */ }
  }
  return getSnapRequests();
}

export async function findSnapRequestAsync(code: string, phone?: string): Promise<SnapRequest | null> {
  if (await probeApi()) {
    try {
      const qs = phone ? `?code=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}` : `?code=${encodeURIComponent(code)}`;
      const { request } = await apiFetch<{ request: SnapRequest }>(`/api/snap-requests${qs}`);
      if (request) { if (phone) saveSnapRequest(request); return request; }
    } catch { /* fall through */ }
  }
  return findSnapRequest(code) || null;
}

export async function findSnapRequestsByPhoneAsync(phone: string): Promise<SnapRequest[]> {
  if (await probeApi()) {
    try { const { requests } = await apiFetch<{ requests: SnapRequest[] }>(`/api/snap-requests?phone=${encodeURIComponent(phone)}`); requests.forEach(r => saveSnapRequest(r)); return dedupeByCode(requests, findSnapRequestsByPhone(phone)); }
    catch { /* fall through */ }
  }
  return findSnapRequestsByPhone(phone);
}

export async function getSnapRequestsForPartnerAsync(partnerCode: string): Promise<SnapRequest[]> {
  if (await probeApi()) {
    try { const { requests } = await apiFetch<{ requests: SnapRequest[] }>(`/api/snap-requests?partnerCode=${encodeURIComponent(partnerCode)}`); requests.forEach(r => saveSnapRequest(r)); return dedupeByCode(requests, getSnapRequests().filter(r => r.assignedPartnerCode === partnerCode)); }
    catch { /* fall through */ }
  }
  return getSnapRequests().filter(r => r.assignedPartnerCode === partnerCode);
}

export async function assessSnapRequestAsync(code: string, assessment: SnapAssessment): Promise<SnapRequest | undefined> {
  const total = assessmentTotal(assessment);
  const updated = (() => { const u = updateSnapRequest(code, { assessment, totalNgn: total, status: "Priced" }); return u ? appendTimeline(code, { by: "admin", text: `Oketex priced this job — total ${total.toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })}. Approve to proceed.` }) : u; })();
  if (await probeApi()) {
    try { const { request } = await apiFetch<{ request: SnapRequest }>("/api/snap-requests/assess", { method: "POST", body: JSON.stringify({ code, assessment }) }); return saveSnapRequest(request); }
    catch { /* local stands */ }
  }
  return updated;
}

export async function declineSnapRequestAsync(code: string, note: string): Promise<void> {
  updateSnapRequest(code, { status: "Declined" });
  appendTimeline(code, { by: "admin", text: note ? `Declined by Oketex: ${note}` : "Declined by Oketex." });
  if (await probeApi()) { try { await apiFetch("/api/snap-requests", { method: "PATCH", body: JSON.stringify({ code, action: "decline", note }) }); } catch { /* local stands */ } }
}

export async function adminSetSnapStatusAsync(code: string, status: SnapStatus): Promise<void> {
  updateSnapRequest(code, { status });
  if (await probeApi()) { try { await apiFetch("/api/snap-requests", { method: "PATCH", body: JSON.stringify({ code, action: "status", status }) }); } catch { /* local stands */ } }
}

export async function adminSnapTimelineNoteAsync(code: string, text: string): Promise<void> {
  appendTimeline(code, { by: "admin", text });
  if (await probeApi()) { try { await apiFetch("/api/snap-requests", { method: "PATCH", body: JSON.stringify({ code, action: "timeline", text }) }); } catch { /* local stands */ } }
}

export async function assignSnapRequestAsync(code: string, partnerCode: string, partnerName: string, agreedPriceNgn: number): Promise<{ request?: SnapRequest; error?: string }> {
  if (await probeApi()) {
    try {
      const { request } = await apiFetch<{ request: SnapRequest }>("/api/snap-requests/assign", { method: "POST", body: JSON.stringify({ code, partnerCode, agreedPriceNgn }) });
      return { request: saveSnapRequest(request) };
    } catch (e: any) { return { error: String(e?.message || e) }; }
  }
  const terms = getPartnerTerms();
  const pct = terms.referralCommissionPct;
  const updated = updateSnapRequest(code, { assignedPartnerCode: partnerCode, assignedPartnerName: partnerName, agreedPriceNgn, commissionPct: pct, commissionNgn: snapCommission(agreedPriceNgn, pct), status: "Assigned" });
  if (updated) appendTimeline(code, { by: "admin", text: `Assigned to ${partnerName} at the agreed price.` });
  return { request: updated ? findSnapRequest(code) : undefined };
}

export async function approveSnapRequestAsync(code: string, phone: string): Promise<{ ok: boolean; error?: string }> {
  const local = findSnapRequest(code);
  if (local && local.status === "Priced") { updateSnapRequest(code, { status: "Approved" }); appendTimeline(code, { by: "customer", text: "Customer approved the price." }); }
  if (await probeApi()) {
    try { const { request } = await apiFetch<{ request: SnapRequest }>("/api/snap-requests", { method: "PATCH", body: JSON.stringify({ code, action: "approve", phone }) }); saveSnapRequest(request); return { ok: true }; }
    catch (e: any) { if (!local) return { ok: false, error: String(e?.message || e) }; }
  }
  return { ok: !!local };
}

export async function snapProgressAsync(code: string, partnerCode: string, text: string, photo?: string): Promise<void> {
  appendTimeline(code, { by: "partner", text, ...(photo ? { photo } : {}) });
  if (await probeApi()) { try { const { request } = await apiFetch<{ request: SnapRequest }>("/api/snap-requests", { method: "PATCH", body: JSON.stringify({ code, action: "progress", partnerCode, text, photo }) }); saveSnapRequest(request); } catch { /* local stands */ } }
}

export async function snapPartnerStatusAsync(code: string, partnerCode: string, action: "start" | "complete"): Promise<void> {
  const status: SnapStatus = action === "start" ? "In Progress" : "Completed";
  updateSnapRequest(code, { status });
  appendTimeline(code, { by: "partner", text: action === "start" ? "The pro has started the job." : "The pro marked the job complete." });
  if (await probeApi()) { try { const { request } = await apiFetch<{ request: SnapRequest }>("/api/snap-requests", { method: "PATCH", body: JSON.stringify({ code, action, partnerCode }) }); saveSnapRequest(request); } catch { /* local stands */ } }
}

// Re-exported so verify-features can prove the commission snapshot uses the
// same rounding as the partner-terms helper used across the app.
export { commissionFor };
