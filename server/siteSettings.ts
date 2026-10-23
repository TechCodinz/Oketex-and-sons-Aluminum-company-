// Server-side copy of the site settings (settings table, key 'site').
// The value shape mirrors src/lib/settings.ts OketexSettings exactly, so the
// frontend can merge: server settings → local override → code defaults.
import { dbQuery } from "./db";

// Mirror of src/data/partnerTerms.ts PARTNER_TERMS defaults — kept in sync
// deliberately so lead commission snapshotting server-side matches the
// storefront when no admin override exists.
export const DEFAULT_PARTNER_TERMS = { referralCommissionPct: 5, verificationFeeNgn: 15000, featuredFeeNgn: 20000 };

export async function getSiteSettings(): Promise<any | null> {
  const rows = await dbQuery(`SELECT value FROM settings WHERE key = 'site' LIMIT 1`);
  if (!rows.length) return null;
  const v = rows[0].value;
  return typeof v === "string" ? JSON.parse(v || "{}") : v;
}
export async function getServerPartnerTerms(): Promise<{ referralCommissionPct: number; verificationFeeNgn: number; featuredFeeNgn: number }> {
  try {
    const s = await getSiteSettings();
    const t = s?.partnerTerms || {};
    const num = (v: any, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    return {
      referralCommissionPct: num(t.referralCommissionPct, DEFAULT_PARTNER_TERMS.referralCommissionPct),
      verificationFeeNgn: num(t.verificationFeeNgn, DEFAULT_PARTNER_TERMS.verificationFeeNgn),
      featuredFeeNgn: num(t.featuredFeeNgn, DEFAULT_PARTNER_TERMS.featuredFeeNgn),
    };
  } catch { return { ...DEFAULT_PARTNER_TERMS }; }
}
export function commissionForValue(estValueNgn: number, pct: number): number {
  return Math.round((Math.max(0, estValueNgn || 0) * pct) / 100);
}
