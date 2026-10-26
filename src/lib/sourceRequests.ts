// Source-Anything (Global Sourcing) — customers ask Oketex to source ANY
// product they cannot find locally; admin quotes ONE landed total (item +
// shipping/import + service), the customer approves in Track, and Oketex
// sources, ships and delivers. Mirrors the Snap & Send architecture
// (src/lib/snapRequests.ts): local-first storage + API-first wrappers,
// timeline on every record, codes SC-YYYY-####.
//
// PRIVACY RULE: the quote's cost side (costTotalNgn — what Oketex pays)
// is ADMIN-ONLY. Customer surfaces render the landed total, lead time and
// note only; the server strips costTotalNgn from unproven public lookups.
import { apiFetch, probeApi } from "./api";
import { suggestedPrice } from "./profit";
import type { Product } from "@/data/catalog";

export type SourceStatus = "Received" | "Quoted" | "Approved" | "Sourcing" | "Shipped" | "Delivered" | "Declined";
export const SOURCE_STATUSES: SourceStatus[] = ["Received", "Quoted", "Approved", "Sourcing", "Shipped", "Delivered", "Declined"];

/** The admin-built quote. item/shipping/service are the QUOTED lines;
 *  costTotalNgn is what Oketex actually pays (admin-only, feeds Profit). */
export interface SourceQuote {
  itemNgn: number; shippingNgn: number; serviceNgn: number;
  costTotalNgn: number; leadDays: number | null; note: string; quotedAt: string;
}
export interface SourceTimelineEntry { ts: string; by: "customer" | "admin"; text: string }

/** The Sourcing Agent's brief (src/lib/sourcingAgent.ts builds it).
 *  Persisted on the record so it survives reloads. */
export interface SourcingBrief {
  generatedAt: string;
  catalogue: { slug: string; name: string; priceNgn: number } | null;
  partners: { code: string; name: string }[];
  links: { label: string; url: string }[];
  /** AI-assist seam: when server-side AI is enabled later, its draft
   *  lands here. Always empty in rules mode — no fake AI output. */
  aiNote?: string;
}

export interface SourceRequest {
  code: string;
  productName: string;
  description: string;
  /** Photo (compressed dataURL) OR a reference link — same dual path as Snap & Send. */
  photo: string | null;
  referenceLink: string;
  quantity: number;
  /** Delivery zone id (DELIVERY_ZONES ids) — the customer's delivery area. */
  area: string;
  customerName: string;
  customerPhone: string;
  status: SourceStatus;
  quote: SourceQuote | null;
  agentBrief: SourcingBrief | null;
  timeline: SourceTimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

const KEY = "oketex-source-requests";
function read(): SourceRequest[] { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) as SourceRequest[] : []; } catch { return []; } }
function write(list: SourceRequest[]) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* quota — server copy stands when live */ } }
export function getSourceRequests(): SourceRequest[] { return read(); }
export function saveSourceRequest(r: SourceRequest): SourceRequest {
  const all = read(); const i = all.findIndex(x => x.code === r.code);
  if (i >= 0) all[i] = r; else all.unshift(r);
  write(all); return r;
}
function dedupeByCode(server: SourceRequest[], local: SourceRequest[]): SourceRequest[] {
  const seen = new Set<string>(); const out: SourceRequest[] = [];
  for (const r of [...server, ...local]) { if (!seen.has(r.code)) { seen.add(r.code); out.push(r); } }
  return out;
}
export function sourceRequestCode(existing: SourceRequest[] = read()): string {
  const year = new Date().getFullYear();
  let n = existing.filter(r => r.code.startsWith(`SC-${year}-`)).length + 1;
  let code = `SC-${year}-${String(n).padStart(4, "0")}`;
  while (existing.some(r => r.code === code)) { n += 1; code = `SC-${year}-${String(n).padStart(4, "0")}`; }
  return code;
}
export function quoteTotal(q: SourceQuote | null | undefined): number {
  if (!q) return 0;
  return Math.round((Number(q.itemNgn) || 0) + (Number(q.shippingNgn) || 0) + (Number(q.serviceNgn) || 0));
}
/** Sourcing profit on one request: quoted landed total − real cost.
 *  Counts only once the customer has approved (money committed). */
export function sourcingProfitFor(r: SourceRequest): number | null {
  if (!r.quote || !["Approved", "Sourcing", "Shipped", "Delivered"].includes(r.status)) return null;
  return quoteTotal(r.quote) - (Number(r.quote.costTotalNgn) || 0);
}
export function sourcingProfitTotal(requests: SourceRequest[]): { totalNgn: number; counted: number } {
  let total = 0, counted = 0;
  for (const r of requests) { const p = sourcingProfitFor(r); if (p != null) { total += p; counted += 1; } }
  return { totalNgn: Math.round(total), counted };
}

const STOP = new Set(["the", "a", "an", "for", "my", "i", "need", "want", "please", "with", "and", "of", "in", "to"]);
export function demandKeyword(productName: string): string {
  const words = String(productName || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w && !STOP.has(w));
  return words.slice(0, 3).join(" ") || "unspecified";
}
export interface DemandRow { keyword: string; count: number; areas: Record<string, number>; topArea: string }
/** Market-survey aggregation: what customers keep asking for, and where. */
export function aggregateDemand(requests: SourceRequest[]): DemandRow[] {
  const byKey = new Map<string, DemandRow>();
  for (const r of requests) {
    const k = demandKeyword(r.productName);
    const row = byKey.get(k) ?? { keyword: k, count: 0, areas: {}, topArea: "" };
    row.count += 1;
    row.areas[r.area] = (row.areas[r.area] ?? 0) + 1;
    byKey.set(k, row);
  }
  const rows = [...byKey.values()];
  for (const row of rows) row.topArea = Object.entries(row.areas).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  return rows.sort((a, b) => b.count - a.count);
}

/** Finds → Shelf: draft a catalogue product from a completed sourcing
 *  request. Draft = stock 0 + active:false — it stays OUT of the shop
 *  until the admin publishes it from the Catalog tab. */
export function draftProductFromSourceRequest(r: SourceRequest, targetMarginPct: number): Product {
  const cost = Math.max(0, Number(r.quote?.costTotalNgn) || 0);
  const slugBase = (demandKeyword(r.productName) || "sourced-find").replace(/\s+/g, "-");
  const ref = String(r.referenceLink || "");
  const isImage = /\.(jpe?g|png|webp)(\?|$)/i.test(ref);
  return {
    id: 1000 + Math.abs([...r.code].reduce((s, c) => s + c.charCodeAt(0), 0)) % 9000,
    categoryId: 14, categorySlug: "hard-to-find",
    slug: `${slugBase}-find`,
    name: r.productName.trim().slice(0, 80),
    summary: "Sourced via Oketex Global Sourcing — now stocked as a Global Find.",
    description: `First sourced through Oketex Global Sourcing after customers requested it (delivery area: ${r.area}). ${r.description ? r.description.slice(0, 220) : ""} Imported line — lead time confirmed on order.`.trim(),
    priceNgn: cost > 0 ? suggestedPrice(cost, targetMarginPct) : quoteTotal(r.quote),
    unit: "per item",
    image: isImage ? ref : "/images/products/solar-flood-light-200w.jpg",
    specs: { Source: "Oketex Global Sourcing", Shelf: "Hard to Find / Global Finds", Lead: "Imported — lead time confirmed on order" },
    stock: 0, featured: false, active: false, hardToFind: true,
    costPriceNgn: cost > 0 ? cost : null,
  };
}

// ---- API-first wrappers (demo fallback = local record stands) ----
export async function submitSourceRequestAsync(input: Omit<SourceRequest, "code" | "status" | "quote" | "agentBrief" | "timeline" | "createdAt" | "updatedAt">): Promise<SourceRequest> {
  const now = new Date().toISOString();
  const local: SourceRequest = {
    ...input, code: sourceRequestCode(), status: "Received", quote: null, agentBrief: null,
    timeline: [{ ts: now, by: "customer", text: "Sourcing request sent to Oketex." }], createdAt: now, updatedAt: now,
  };
  saveSourceRequest(local);
  if (await probeApi()) {
    try { const { request } = await apiFetch<{ request: SourceRequest }>("/api/source-requests", { method: "POST", body: JSON.stringify(local) }); return saveSourceRequest(request); }
    catch { /* local stands */ }
  }
  return local;
}
export async function getSourceRequestsAdminAsync(): Promise<SourceRequest[]> {
  if (await probeApi()) {
    try { const { requests } = await apiFetch<{ requests: SourceRequest[] }>("/api/source-requests?all=1"); return dedupeByCode(requests, getSourceRequests()); }
    catch { /* local stands */ }
  }
  return getSourceRequests();
}
export async function findSourceRequestsAsync(q: string): Promise<SourceRequest[]> {
  const query = String(q || "").trim();
  if (await probeApi()) {
    try {
      if (/^SC-/i.test(query)) { const { request } = await apiFetch<{ request: SourceRequest }>(`/api/source-requests?code=${encodeURIComponent(query.toUpperCase())}`); return [saveSourceRequest(request)]; }
      const { requests } = await apiFetch<{ requests: SourceRequest[] }>(`/api/source-requests?phone=${encodeURIComponent(query)}`);
      requests.forEach(r => saveSourceRequest(r));
      return dedupeByCode(requests, getSourceRequests().filter(r => r.customerPhone.replace(/\D/g, "").endsWith(query.replace(/\D/g, "").slice(-10))));
    } catch { /* local stands */ }
  }
  const digits = query.replace(/\D/g, "");
  return getSourceRequests().filter(r => r.code.toUpperCase() === query.toUpperCase() || (digits.length >= 7 && r.customerPhone.replace(/\D/g, "").endsWith(digits.slice(-10))));
}
async function patch(code: string, body: Record<string, unknown>): Promise<SourceRequest | undefined> {
  if (await probeApi()) {
    try { const { request } = await apiFetch<{ request: SourceRequest }>("/api/source-requests", { method: "PATCH", body: JSON.stringify({ code, ...body }) }); return saveSourceRequest(request); }
    catch { /* local stands */ }
  }
  return undefined;
}
function localUpdate(code: string, fn: (r: SourceRequest) => SourceRequest): SourceRequest | undefined {
  const r = getSourceRequests().find(x => x.code === code); if (!r) return undefined;
  return saveSourceRequest(fn({ ...r, updatedAt: new Date().toISOString() }));
}
export async function quoteSourceRequestAsync(code: string, quote: SourceQuote): Promise<SourceRequest | undefined> {
  const server = await patch(code, { action: "quote", quote });
  if (server) return server;
  return localUpdate(code, r => ({ ...r, status: "Quoted", quote, timeline: [...r.timeline, { ts: new Date().toISOString(), by: "admin", text: `Quote ready: landed total ₦${quoteTotal(quote).toLocaleString("en-US")}${quote.leadDays ? ` · about ${quote.leadDays} days` : ""}.` }] }));
}
export async function approveSourceRequestAsync(code: string, phone: string): Promise<{ ok: boolean; error?: string }> {
  if (await probeApi()) {
    try { const { request } = await apiFetch<{ request: SourceRequest }>("/api/source-requests", { method: "PATCH", body: JSON.stringify({ code, action: "approve", phone }) }); saveSourceRequest(request); return { ok: true }; }
    catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Could not approve — check your phone number." }; }
  }
  const r = getSourceRequests().find(x => x.code === code);
  if (!r) return { ok: false, error: "Request not found on this device." };
  const digits = (s: string) => s.replace(/\D/g, "");
  if (!(digits(phone).length >= 7 && digits(r.customerPhone).endsWith(digits(phone).slice(-10)))) return { ok: false, error: "That phone number does not match this request." };
  if (r.status !== "Quoted") return { ok: false, error: "This request is not waiting for approval." };
  localUpdate(code, x => ({ ...x, status: "Approved", timeline: [...x.timeline, { ts: new Date().toISOString(), by: "customer", text: "Customer approved the quote." }] }));
  return { ok: true };
}
export async function setSourceStatusAsync(code: string, status: SourceStatus): Promise<SourceRequest | undefined> {
  const server = await patch(code, { action: "status", status });
  if (server) return server;
  return localUpdate(code, r => ({ ...r, status, timeline: [...r.timeline, { ts: new Date().toISOString(), by: "admin", text: `Status: ${status}.` }] }));
}
export async function saveSourceBriefAsync(code: string, brief: SourcingBrief): Promise<SourceRequest | undefined> {
  const server = await patch(code, { action: "brief", brief });
  if (server) return server;
  return localUpdate(code, r => ({ ...r, agentBrief: brief }));
}
