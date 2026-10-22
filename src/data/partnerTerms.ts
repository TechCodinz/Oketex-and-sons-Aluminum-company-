// Partner Network — LAUNCH TERMS. Single source of truth for all partner
// revenue math on this site. Change the numbers here and every page, form,
// lead and admin dashboard follows. Presented to partners and customers as
// "current launch terms" — Oketex may revise them; the commission on a lead
// is snapshotted from these terms at the moment the lead is created.
export const PARTNER_TERMS = {
  /** Oketex referral commission on the value of a job / supply lead that the
   *  partner wins through the network. Charged to the partner, never added
   *  to the customer's price. */
  referralCommissionPct: 5,
  /** One-time fee for the Verified badge (identity / business checks). */
  verificationFeeNgn: 15000,
  /** Monthly fee for Featured placement (sorted first in the directory,
   *  featured ribbon on the storefront). */
  featuredFeeNgn: 20000,
  currencyNote: "All fees and commissions are in Nigerian Naira (₦). Commission is payable by the partner to Oketex only on leads marked Won, settled after the customer pays the partner.",
} as const;

export type PartnerRole = "pro" | "seller";
export type PartnerStatus = "pending" | "approved" | "rejected";
export type LeadType = "job" | "supply";
export type LeadStatus = "new" | "contacted" | "won" | "paid" | "lost";
export type OfferAudience = "all" | "pros" | "sellers";

export const PRO_TRADES = [
  "Roofer", "Engineer", "Carpenter", "Tiler", "Plumber", "Electrician",
  "Painter", "Builder", "Welder/Steel", "POP/Ceiling", "Surveyor",
] as const;

export const SELLER_CATEGORIES = [
  "Roofing Materials", "Timber", "Tiles", "Plumbing", "Electrical", "Paint",
  "Tools & Equipment", "Cement & Blocks", "Windows & Doors", "General Building Materials",
] as const;

/** Commission for a lead at a given value. The pct defaults to the launch
 *  terms; callers that must use admin-overridden terms (lib/settings.ts
 *  getPartnerTerms) pass the EFFECTIVE pct explicitly — the result is then
 *  snapshotted onto the lead and never rewritten by later term edits. */
export function commissionFor(estValueNgn: number, pctOverride?: number): { pct: number; commissionNgn: number } {
  const pct = pctOverride ?? PARTNER_TERMS.referralCommissionPct;
  return { pct, commissionNgn: Math.round((Math.max(0, estValueNgn) * pct) / 100) };
}
