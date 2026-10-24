// Shared DB helpers for Snap & Send requests (server/handlers/snap-requests*).
// The full frontend record lives in the `data` jsonb column; the scalar
// columns mirror the queryable fields (status, phone, partner, money).
import { dbQuery } from "./db.js";
import { snapRequestFromRow } from "./records.js";

export const SNAP_STATUSES = ["Received", "Under Review", "Priced", "Approved", "Assigned", "In Progress", "Completed", "Declined"];

export function snapDigits(p: unknown): string { return String(p || "").replace(/\D/g, ""); }
export function snapPhoneMatches(stored: unknown, given: unknown): boolean {
  const a = snapDigits(stored), b = snapDigits(given);
  return b.length >= 7 && a.endsWith(b.slice(-10));
}
/** Server-side assessment total — mirrors assessmentTotal() in the client lib. */
export function snapAssessmentTotal(a: any): number {
  if (!a) return 0;
  const items = (Array.isArray(a.items) ? a.items : []).reduce((s: number, i: any) => s + (Number(i?.qty) || 0) * (Number(i?.unitPrice) || 0), 0);
  return Math.round(items + (Number(a.workmanshipNgn) || 0) + (Number(a.transportNgn) || 0) + (Number(a.dispatchNgn) || 0));
}
export function cleanAssessment(a: any): any {
  const items = (Array.isArray(a?.items) ? a.items : []).map((i: any) => ({
    name: String(i?.name || "").slice(0, 160),
    qty: Math.max(0, Number(i?.qty) || 0),
    unitPrice: Math.max(0, Number(i?.unitPrice) || 0),
  })).filter((i: any) => i.name || i.qty > 0);
  const nonNeg = (v: any) => Math.max(0, Number(v) || 0);
  return { items, workmanshipNgn: nonNeg(a?.workmanshipNgn), transportNgn: nonNeg(a?.transportNgn), dispatchNgn: nonNeg(a?.dispatchNgn), notes: String(a?.notes || "").slice(0, 2000) };
}

export async function loadSnap(code: string): Promise<any | null> {
  const rows = await dbQuery(`SELECT * FROM snap_requests WHERE code = $1`, [code]);
  return rows.length ? snapRequestFromRow(rows[0]) : null;
}
export async function saveSnap(rec: any): Promise<any> {
  const rows = await dbQuery(
    `UPDATE snap_requests SET intent=$2, status=$3, customer_name=$4, customer_phone=$5, assigned_partner_code=$6,
       total_ngn=$7, agreed_price_ngn=$8, commission_pct=$9, commission_ngn=$10, data=$11::jsonb, updated_at=now()
     WHERE code=$1 RETURNING *`,
    [rec.code, rec.intent || "fix", rec.status || "Received", rec.customerName || "", rec.customerPhone || "",
     rec.assignedPartnerCode || null, Math.round(Number(rec.totalNgn) || 0),
     rec.agreedPriceNgn == null ? null : Math.round(Number(rec.agreedPriceNgn) || 0),
     rec.commissionPct == null ? null : Number(rec.commissionPct),
     rec.commissionNgn == null ? null : Math.round(Number(rec.commissionNgn) || 0),
     JSON.stringify(rec)],
  );
  return rows.length ? snapRequestFromRow(rows[0]) : rec;
}
export function pushTimeline(rec: any, by: "customer" | "admin" | "partner", text: string, photo?: string): any {
  const entry: any = { ts: new Date().toISOString(), by, text };
  if (photo) entry.photo = photo;
  return { ...rec, timeline: [...(Array.isArray(rec.timeline) ? rec.timeline : []), entry], updatedAt: new Date().toISOString() };
}
export const ngn = (n: number) => "₦" + Math.round(n).toLocaleString("en-US");
