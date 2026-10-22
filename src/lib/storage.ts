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
