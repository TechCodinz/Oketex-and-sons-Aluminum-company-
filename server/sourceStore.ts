// Shared DB helpers for Source-Anything requests (server/handlers/source-requests.ts).
// Mirrors snapStore.ts: the full frontend record lives in the `data` jsonb
// column; scalar columns mirror the queryable fields.
import { dbQuery } from "./db.js";
import { sourceRequestFromRow } from "./records.js";

export const SOURCE_STATUSES = ["Received", "Quoted", "Approved", "Sourcing", "Shipped", "Delivered", "Declined"];

export function srcDigits(p: unknown): string { return String(p || "").replace(/\D/g, ""); }
export function srcPhoneMatches(stored: unknown, given: unknown): boolean {
  const a = srcDigits(stored), b = srcDigits(given);
  return b.length >= 7 && a.endsWith(b.slice(-10));
}
export function quoteTotalOf(q: any): number {
  if (!q) return 0;
  return Math.round((Number(q.itemNgn) || 0) + (Number(q.shippingNgn) || 0) + (Number(q.serviceNgn) || 0));
}
export function cleanQuote(q: any): any {
  const nonNeg = (v: any) => Math.max(0, Math.round(Number(v) || 0));
  return {
    itemNgn: nonNeg(q?.itemNgn), shippingNgn: nonNeg(q?.shippingNgn), serviceNgn: nonNeg(q?.serviceNgn),
    costTotalNgn: nonNeg(q?.costTotalNgn),
    leadDays: q?.leadDays == null || q?.leadDays === "" ? null : Math.max(0, Math.round(Number(q.leadDays) || 0)),
    note: String(q?.note || "").slice(0, 1000),
    quotedAt: String(q?.quotedAt || new Date().toISOString()),
  };
}
export async function loadSource(code: string): Promise<any | null> {
  const rows = await dbQuery(`SELECT * FROM source_requests WHERE code = $1`, [code]);
  return rows.length ? sourceRequestFromRow(rows[0]) : null;
}
export async function saveSource(rec: any): Promise<any> {
  const rows = await dbQuery(
    `UPDATE source_requests SET status=$2, customer_name=$3, customer_phone=$4, product_name=$5,
       landed_total_ngn=$6, data=$7::jsonb, updated_at=now()
     WHERE code=$1 RETURNING *`,
    [rec.code, rec.status || "Received", rec.customerName || "", rec.customerPhone || "",
     rec.productName || "", quoteTotalOf(rec.quote), JSON.stringify(rec)],
  );
  return rows.length ? sourceRequestFromRow(rows[0]) : rec;
}
export function pushSourceTimeline(rec: any, by: "customer" | "admin", text: string): any {
  return { ...rec, timeline: [...(Array.isArray(rec.timeline) ? rec.timeline : []), { ts: new Date().toISOString(), by, text }], updatedAt: new Date().toISOString() };
}
