export type LocalOrder = { code: string; name: string; phone: string; email?: string; address: string; note?: string; items: { name: string; unit: string; unitPriceNgn: number; quantity: number; lineTotalNgn: number }[]; totalNgn: number; status: string; createdAt: string };
export type LocalQuote = { code: string; name: string; phone: string; email?: string; note?: string; roofType: string; colour?: string; areaM2: number; estimateNgn: number; boqSummary?: string; status: string; createdAt: string };
function read<T>(key: string): T[] { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) as T[] : []; } catch { return []; } }
function write<T>(key: string, v: T[]) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }
export const getOrders = () => read<LocalOrder>("oketex-orders-v1");
export const saveOrder = (o: LocalOrder) => { const all = getOrders(); all.unshift(o); write("oketex-orders-v1", all); };
export const getQuotes = () => read<LocalQuote>("oketex-quotes-v1");
export const saveQuote = (q: LocalQuote) => { const all = getQuotes(); all.unshift(q); write("oketex-quotes-v1", all); };
export function orderCode() { return `OKX-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`; }
export function quoteCode() { return `QT-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`; }
export function findOrder(q: string) { const s = q.trim().toLowerCase(); return getOrders().filter(o => o.code.toLowerCase() === s || o.phone.replace(/\s/g,"").endsWith(s.replace(/\s/g,"")) ); }

// ---------------- Phase 5: API-first wrappers (demo fallback) ----------------
import { apiFetch, probeApi } from "./api";
function dedupeByCode<T extends { code: string }>(...lists: T[][]): T[] {
  const seen = new Set<string>(); const out: T[] = [];
  for (const list of lists) for (const item of list) { const k = item.code.toUpperCase(); if (!seen.has(k)) { seen.add(k); out.push(item); } }
  return out;
}
export async function saveOrderAsync(o: LocalOrder): Promise<void> {
  saveOrder(o);
  if (await probeApi()) { try { await apiFetch("/api/orders", { method: "POST", body: JSON.stringify(o) }); } catch { /* local copy stands */ } }
}
export async function getOrdersAsync(): Promise<LocalOrder[]> {
  if (await probeApi()) {
    try { const { orders } = await apiFetch<{ orders: LocalOrder[] }>("/api/orders"); return dedupeByCode(orders, getOrders()); }
    catch { /* fall through to local */ }
  }
  return getOrders();
}
export async function findOrdersAsync(q: string): Promise<LocalOrder[]> {
  const local = findOrder(q);
  if (await probeApi()) {
    try {
      const isCode = /^(OKX)-/i.test(q.trim());
      const path = isCode ? `/api/orders?code=${encodeURIComponent(q.trim())}` : `/api/orders?phone=${encodeURIComponent(q.trim())}`;
      const { orders } = await apiFetch<{ orders: LocalOrder[] }>(path);
      return dedupeByCode(orders, local);
    } catch { /* local only */ }
  }
  return local;
}
export async function saveQuoteAsync(q: LocalQuote): Promise<void> {
  saveQuote(q);
  if (await probeApi()) { try { await apiFetch("/api/quotes", { method: "POST", body: JSON.stringify(q) }); } catch { /* local copy stands */ } }
}
export async function getQuotesAsync(): Promise<LocalQuote[]> {
  if (await probeApi()) {
    try { const { quotes } = await apiFetch<{ quotes: LocalQuote[] }>("/api/quotes"); return dedupeByCode(quotes, getQuotes()); }
    catch { /* fall through to local */ }
  }
  return getQuotes();
}
