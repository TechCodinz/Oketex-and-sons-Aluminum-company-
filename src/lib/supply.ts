// Supply Requests — procurement (Stage S3, partner two-way flow). Oketex
// buys/hires FROM its partner network: staff raise a request, targeted or
// broadcast; partners quote; staff approve one; delivery is marked
// Received. No commission — it is an Oketex purchase, and the approved
// total is committed spend. Partner views NEVER contain other partners'
// quotes: the server strips them, and the local helpers below apply the
// same rule in demo mode. Local copy in `oketex-supply`; API-first
// wrappers mirror the other stores.
import { apiFetch, probeApi } from "./api";
import type { Partner } from "./partnerStorage";

export type SupplyType = "buy" | "hire";
export type SupplyStatus = "Open" | "Quoted" | "Approved" | "Received" | "Cancelled";
export interface SupplyQuote {
  partnerCode: string; partnerName: string; unitPriceNgn: number; totalNgn: number;
  leadDays: number; note: string; at: string;
}
export interface SupplyRequest {
  code: string; type: SupplyType; item: string; spec: string;
  qty: number; unit: string; neededBy: string; note: string;
  targetPartnerCodes: string[];
  status: SupplyStatus; quotes: SupplyQuote[];
  chosenPartnerCode: string | null; chosenTotalNgn: number | null;
  createdBy: string; createdAt: string; updatedAt: string;
}

export function supplyQuoteTotal(qty: number, unitPriceNgn: number): number {
  return Math.round(Math.max(0, qty || 0) * Math.max(0, unitPriceNgn || 0));
}
export function supplyCode(): string {
  return `SUP-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
/** Can this partner see this request? Targeted → named partners only.
 *  Broadcast → approved partners whose kind supplies (seller or both);
 *  a pro-only partner never sees a seller broadcast. */
export function supplyVisibleTo(req: SupplyRequest, partner: Pick<Partner, "code" | "role" | "status">): boolean {
  if (partner.status !== "approved") return false;
  if (req.targetPartnerCodes.length) return req.targetPartnerCodes.includes(partner.code);
  return partner.role === "seller" || partner.role === "both";
}
/** The partner's own view of a request: quotes stripped to theirs only. */
export function supplyPartnerView(req: SupplyRequest, partnerCode: string): SupplyRequest {
  return { ...req, quotes: (req.quotes || []).filter(q => q.partnerCode === partnerCode) };
}
/** Won / Lost / pending for a partner on a request (their own outcome). */
export function supplyOutcome(req: SupplyRequest, partnerCode: string): "Won" | "Lost" | "Quoted" | "Awaiting quote" {
  if (req.chosenPartnerCode) return req.chosenPartnerCode === partnerCode ? "Won" : "Lost";
  return (req.quotes || []).some(q => q.partnerCode === partnerCode) ? "Quoted" : "Awaiting quote";
}
/** Capability matching: does any of the partner's declared supply
 *  capabilities share a meaningful word with the requested item? Used to
 *  pre-filter the target picker in Admin — admin always has the final say. */
export function capabilityMatch(capabilities: string[] | undefined, item: string): boolean {
  const words = new Set((item || "").toLowerCase().split(/[^a-z0-9.]+/).filter(w => w.length >= 3));
  return (capabilities || []).some(cap =>
    cap.toLowerCase().split(/[^a-z0-9.]+/).some(w => w.length >= 3 && words.has(w)),
  );
}
export function supplyCandidates(partners: Partner[], item: string): Partner[] {
  return partners.filter(p => p.status === "approved" && (p.role === "seller" || p.role === "both") && capabilityMatch(p.supplyCapabilities, item));
}
/** Committed procurement spend — approved + received chosen totals. */
export function committedSpend(requests: SupplyRequest[]): number {
  return requests
    .filter(r => ["Approved", "Received"].includes(r.status) && r.chosenTotalNgn != null)
    .reduce((s, r) => s + (r.chosenTotalNgn || 0), 0);
}

const KEY = "oketex-supply";
export function getSupplyRequests(): SupplyRequest[] {
  try { const r = localStorage.getItem(KEY); return r ? (JSON.parse(r) as SupplyRequest[]) : []; } catch { return []; }
}
function writeAll(list: SupplyRequest[]) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } }
export function saveSupplyRequest(rec: SupplyRequest): SupplyRequest {
  const all = getSupplyRequests(); const i = all.findIndex(r => r.code === rec.code);
  if (i >= 0) all[i] = rec; else all.unshift(rec);
  writeAll(all); return rec;
}
function dedupeByCode(...lists: SupplyRequest[][]): SupplyRequest[] {
  const seen = new Set<string>(); const out: SupplyRequest[] = [];
  for (const list of lists) for (const r of list) { const k = r.code.toUpperCase(); if (!seen.has(k)) { seen.add(k); out.push(r); } }
  return out;
}

export async function getSupplyRequestsAsync(): Promise<SupplyRequest[]> {
  if (await probeApi()) {
    try {
      const { requests } = await apiFetch<{ requests: SupplyRequest[] }>("/api/supply");
      requests.forEach(r => saveSupplyRequest(r));
      return dedupeByCode(requests, getSupplyRequests());
    } catch { /* staff-only endpoint — local stands */ }
  }
  return getSupplyRequests();
}
export async function getSupplyForPartnerAsync(partner: Partner, phone: string): Promise<SupplyRequest[]> {
  if (await probeApi()) {
    try {
      const { requests } = await apiFetch<{ requests: SupplyRequest[] }>(`/api/supply?partnerCode=${encodeURIComponent(partner.code)}&phone=${encodeURIComponent(phone)}`);
      return requests;
    } catch { /* fall through to the local masked view */ }
  }
  return getSupplyRequests().filter(r => supplyVisibleTo(r, partner)).map(r => supplyPartnerView(r, partner.code));
}
export async function createSupplyRequestAsync(input: Omit<SupplyRequest, "code" | "status" | "quotes" | "chosenPartnerCode" | "chosenTotalNgn" | "createdAt" | "updatedAt"> & { code?: string }): Promise<SupplyRequest> {
  const now = new Date().toISOString();
  const local: SupplyRequest = { ...input, code: input.code || supplyCode(), status: "Open", quotes: [], chosenPartnerCode: null, chosenTotalNgn: null, createdAt: now, updatedAt: now };
  if (await probeApi()) {
    try {
      const { request } = await apiFetch<{ request: SupplyRequest }>("/api/supply", { method: "POST", body: JSON.stringify(local) });
      return saveSupplyRequest(request);
    } catch { /* local stands */ }
  }
  return saveSupplyRequest(local);
}
export async function quoteSupplyAsync(code: string, partner: Partner, phone: string, input: { unitPriceNgn: number; leadDays: number; note: string }): Promise<{ request?: SupplyRequest; error?: string }> {
  if (await probeApi()) {
    try {
      const { request } = await apiFetch<{ request: SupplyRequest }>("/api/supply", { method: "PATCH", body: JSON.stringify({ code, action: "quote", partnerCode: partner.code, phone, ...input }) });
      // Keep the local copy complete for staff on this device; the partner
      // only ever receives their masked view back.
      const full = getSupplyRequests().find(r => r.code === code);
      if (full) {
        const quotes = full.quotes.filter(q => q.partnerCode !== partner.code);
        quotes.push({ partnerCode: partner.code, partnerName: partner.businessName, unitPriceNgn: input.unitPriceNgn, totalNgn: supplyQuoteTotal(full.qty, input.unitPriceNgn), leadDays: input.leadDays, note: input.note, at: new Date().toISOString() });
        saveSupplyRequest({ ...full, quotes, status: full.status === "Open" ? "Quoted" : full.status, updatedAt: new Date().toISOString() });
      }
      return { request };
    } catch (e: any) { return { error: String(e?.message || e) }; }
  }
  const rec = getSupplyRequests().find(r => r.code === code);
  if (!rec) return { error: "Request not found" };
  if (!supplyVisibleTo(rec, partner)) return { error: "This request is not open to your business" };
  if (!["Open", "Quoted"].includes(rec.status)) return { error: "Quoting is closed on this request" };
  const quotes = rec.quotes.filter(q => q.partnerCode !== partner.code);
  quotes.push({ partnerCode: partner.code, partnerName: partner.businessName, unitPriceNgn: input.unitPriceNgn, totalNgn: supplyQuoteTotal(rec.qty, input.unitPriceNgn), leadDays: input.leadDays, note: input.note, at: new Date().toISOString() });
  const saved = saveSupplyRequest({ ...rec, quotes, status: rec.status === "Open" ? "Quoted" : rec.status, updatedAt: new Date().toISOString() });
  return { request: supplyPartnerView(saved, partner.code) };
}
export async function supplyActionAsync(code: string, action: "approve" | "received" | "cancel", partnerCode?: string): Promise<{ request?: SupplyRequest; error?: string }> {
  if (await probeApi()) {
    try {
      const { request } = await apiFetch<{ request: SupplyRequest }>("/api/supply", { method: "PATCH", body: JSON.stringify({ code, action, partnerCode }) });
      return { request: saveSupplyRequest(request) };
    } catch (e: any) { return { error: String(e?.message || e) }; }
  }
  const rec = getSupplyRequests().find(r => r.code === code);
  if (!rec) return { error: "Request not found" };
  if (action === "approve") {
    const q = rec.quotes.find(x => x.partnerCode === partnerCode);
    if (!q) return { error: "That partner has not quoted on this request" };
    if (!["Open", "Quoted"].includes(rec.status)) return { error: "This request cannot be approved now" };
    return { request: saveSupplyRequest({ ...rec, status: "Approved", chosenPartnerCode: q.partnerCode, chosenTotalNgn: q.totalNgn, updatedAt: new Date().toISOString() }) };
  }
  if (action === "received") {
    if (rec.status !== "Approved") return { error: "Only an approved request can be marked received" };
    return { request: saveSupplyRequest({ ...rec, status: "Received", updatedAt: new Date().toISOString() }) };
  }
  if (["Received", "Cancelled"].includes(rec.status)) return { error: "This request can no longer be cancelled" };
  return { request: saveSupplyRequest({ ...rec, status: "Cancelled", updatedAt: new Date().toISOString() }) };
}
