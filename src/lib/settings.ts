// Admin Settings & Rates store — every platform number that the business may
// want to change lives behind these helpers. Defaults come from the source
// files (data/partnerTerms.ts, the roof-engine constants, contracts/constants
// BUSINESS); anything saved in /admin → Settings & Rates overrides them in
// localStorage under `oketex-settings`. Reads happen at call time (localStorage
// is synchronous), so engine quotes, partner terms and contact details always
// use the current effective values — while artefacts already created (leads,
// quotes) keep the values they snapshotted at creation.
import { PARTNER_TERMS } from "@/data/partnerTerms";
import { BUSINESS } from "@/contracts/constants";
import { apiFetch, probeApi } from "./api";

export interface EffectivePartnerTerms {
  referralCommissionPct: number; verificationFeeNgn: number; featuredFeeNgn: number; currencyNote: string;
}
export interface EffectiveRates {
  /** Delivery price per zone id (ids match DELIVERY_ZONES in roofEngine). */
  deliveryZones: Record<string, number>;
  installationPerM2: number; ridgePerM: number; timberPerM: number;
}
export interface EffectiveBusiness {
  name: string; shortName: string; phone: string; whatsapp: string; email: string; address: string; hours: string;
}
// ---- Phase 6: promotions + price watch (admin-editable, same merge) ----
export interface Coupon {
  code: string; kind: "percent" | "fixed"; value: number;
  /** Minimum cart subtotal (₦) before the coupon applies. 0 = no minimum. */
  minSpend: number; active: boolean; /** ISO date; empty/undefined = no expiry. */
  expiresAt?: string;
}
export interface PromoBanner { text: string; active: boolean }
export interface PricePoint { date: string; priceNgn: number; source: string }
export interface PriceWatchMaterial { material: string; unit: string; points: PricePoint[] }

export interface OketexSettings {
  /** Subscription plans (Deliverable F) — full array replaces defaults when set. PlanDef lives in lib/plans.ts. */
  plans?: import("./plans").PlanDef[];
  partnerTerms?: Partial<EffectivePartnerTerms>;
  rates?: { deliveryZones?: Record<string, number>; installationPerM2?: number; ridgePerM?: number; timberPerM?: number };
  business?: Partial<Pick<EffectiveBusiness, "phone" | "whatsapp" | "email" | "address" | "hours">>;
  /** Phase 6 promotions: discount coupons + the site-wide promo banner. */
  coupons?: Coupon[];
  promoBanner?: PromoBanner;
  /** Phase 6 price watch: admin-compiled market prices (starts EMPTY — no invented numbers). */
  priceWatch?: PriceWatchMaterial[];
}

export const DELIVERY_ZONE_IDS = ["pickup", "ogun-lagos", "south-west", "ss-se", "abuja-north"] as const;
export const DEFAULT_RATES: EffectiveRates = {
  deliveryZones: { pickup: 0, "ogun-lagos": 45000, "south-west": 85000, "ss-se": 145000, "abuja-north": 185000 },
  installationPerM2: 2200,
  ridgePerM: 4500,
  timberPerM: 1800,
};

const KEY = "oketex-settings";
const SERVER_KEY = "oketex-server-settings";
function parseKey(k: string): OketexSettings {
  try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as OketexSettings) : {}; } catch { return {}; }
}
/** Effective settings document: code defaults ← local admin override ←
 *  SERVER settings (Phase 5). The server copy (when the API is live) wins
 *  per-field so one admin change updates every visitor; the local override
 *  remains the demo-mode path. */
export function getSettings(): OketexSettings {
  const local = parseKey(KEY);
  const server = parseKey(SERVER_KEY);
  if (!Object.keys(server).length) return local;
  return {
    plans: server.plans ?? local.plans,
    partnerTerms: { ...local.partnerTerms, ...server.partnerTerms },
    rates: {
      ...local.rates, ...server.rates,
      deliveryZones: { ...local.rates?.deliveryZones, ...server.rates?.deliveryZones },
    },
    business: { ...local.business, ...server.business },
    coupons: server.coupons ?? local.coupons,
    promoBanner: server.promoBanner ?? local.promoBanner,
    priceWatch: server.priceWatch ?? local.priceWatch,
  };
}
export function saveSettings(patch: OketexSettings) {
  const cur = getSettings();
  const next: OketexSettings = {
    plans: patch.plans ?? cur.plans,
    partnerTerms: { ...cur.partnerTerms, ...patch.partnerTerms },
    rates: {
      ...cur.rates, ...patch.rates,
      deliveryZones: { ...cur.rates?.deliveryZones, ...patch.rates?.deliveryZones },
    },
    business: { ...cur.business, ...patch.business },
    coupons: patch.coupons ?? cur.coupons,
    promoBanner: patch.promoBanner ?? cur.promoBanner,
    priceWatch: patch.priceWatch ?? cur.priceWatch,
  };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
}
export function resetSettings() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

export function getPartnerTerms(): EffectivePartnerTerms {
  const o = getSettings().partnerTerms ?? {};
  const num = (v: number | undefined, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    referralCommissionPct: num(o.referralCommissionPct, PARTNER_TERMS.referralCommissionPct),
    verificationFeeNgn: num(o.verificationFeeNgn, PARTNER_TERMS.verificationFeeNgn),
    featuredFeeNgn: num(o.featuredFeeNgn, PARTNER_TERMS.featuredFeeNgn),
    currencyNote: o.currencyNote ?? PARTNER_TERMS.currencyNote,
  };
}
export function getRates(): EffectiveRates {
  const o = getSettings().rates ?? {};
  const zones: Record<string, number> = { ...DEFAULT_RATES.deliveryZones };
  for (const id of DELIVERY_ZONE_IDS) {
    const v = o.deliveryZones?.[id];
    if (typeof v === "number" && Number.isFinite(v)) zones[id] = v;
  }
  const num = (v: number | undefined, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    deliveryZones: zones,
    installationPerM2: num(o.installationPerM2, DEFAULT_RATES.installationPerM2),
    ridgePerM: num(o.ridgePerM, DEFAULT_RATES.ridgePerM),
    timberPerM: num(o.timberPerM, DEFAULT_RATES.timberPerM),
  };
}
export function getBusiness(): EffectiveBusiness {
  const o = getSettings().business ?? {};
  return {
    name: BUSINESS.name, shortName: BUSINESS.shortName,
    phone: o.phone ?? BUSINESS.phone,
    whatsapp: o.whatsapp ?? BUSINESS.whatsapp,
    email: o.email ?? BUSINESS.email,
    address: o.address ?? BUSINESS.address,
    hours: o.hours ?? BUSINESS.hours,
  };
}
/** WhatsApp link built from the EFFECTIVE business number (admin-editable). */
export function businessWaLink(text: string): string {
  return `https://wa.me/${getBusiness().whatsapp}?text=${encodeURIComponent(text)}`;
}

// ---------------- Phase 6: promotions (coupons + banner) ----------------
export function getCoupons(): Coupon[] { return getSettings().coupons ?? []; }
export function getPromoBanner(): PromoBanner { return getSettings().promoBanner ?? { text: "", active: false }; }
export function getPriceWatch(): PriceWatchMaterial[] { return getSettings().priceWatch ?? []; }

/** Coupon discount on a subtotal, in whole naira.
 *  ROUNDING RULE: percent discounts are rounded HALF UP (Math.round on a
 *  positive value rounds .5 upward) — e.g. 10% of ₦125,775 = ₦12,577.50 →
 *  ₦12,578. A discount never exceeds the subtotal (total never below ₦0). */
export function couponDiscountNgn(coupon: Coupon, subtotalNgn: number): number {
  const sub = Math.max(0, Math.round(subtotalNgn || 0));
  if (sub <= 0) return 0;
  const raw = coupon.kind === "percent" ? (sub * Math.max(0, coupon.value)) / 100 : Math.max(0, coupon.value);
  return Math.min(sub, Math.round(raw));
}
export type CouponCheck = { ok: true; coupon: Coupon; discountNgn: number } | { ok: false; error: string };
/** Validate a code against a subtotal: must exist, be active, be unexpired
 *  and meet its minimum spend. Pure (coupons + clock injected) for testing. */
export function validateCoupon(rawCode: string, subtotalNgn: number, coupons: Coupon[] = getCoupons(), nowMs: number = Date.now()): CouponCheck {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a coupon code." };
  const coupon = coupons.find(c => c.code.trim().toUpperCase() === code);
  if (!coupon) return { ok: false, error: "That code is not recognised." };
  if (!coupon.active) return { ok: false, error: "That coupon is not active right now." };
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < nowMs) return { ok: false, error: "That coupon has expired." };
  const sub = Math.max(0, Math.round(subtotalNgn || 0));
  if (sub < (coupon.minSpend || 0)) return { ok: false, error: `This coupon needs an order of at least ₦${(coupon.minSpend || 0).toLocaleString("en-NG")}.` };
  return { ok: true, coupon, discountNgn: couponDiscountNgn(coupon, sub) };
}
/** The shopper's applied coupon code persists across cart → checkout. */
const APPLIED_COUPON_KEY = "oketex-applied-coupon";
export function getAppliedCouponCode(): string {
  try { return localStorage.getItem(APPLIED_COUPON_KEY) || ""; } catch { return ""; }
}
export function setAppliedCouponCode(code: string) {
  try { if (code) localStorage.setItem(APPLIED_COUPON_KEY, code); else localStorage.removeItem(APPLIED_COUPON_KEY); } catch { /* ignore */ }
}
/** What is currently overridden vs default — for the Settings tab summary. */
export function overrideSummary(): string[] {
  const s = getSettings(); const out: string[] = [];
  if (s.partnerTerms && Object.keys(s.partnerTerms).length) out.push(`Partner terms: ${Object.keys(s.partnerTerms).join(", ")}`);
  if (s.rates) {
    const keys = Object.keys(s.rates).filter(k => k !== "deliveryZones");
    if (s.rates.deliveryZones && Object.keys(s.rates.deliveryZones).length) keys.push(`deliveryZones (${Object.keys(s.rates.deliveryZones).join(", ")})`);
    if (keys.length) out.push(`Engineering rates: ${keys.join(", ")}`);
  }
  if (s.business && Object.keys(s.business).length) out.push(`Business details: ${Object.keys(s.business).join(", ")}`);
  if (s.coupons && s.coupons.length) out.push(`Coupons: ${s.coupons.length}`);
  if (s.promoBanner?.active) out.push("Promo banner active");
  if (s.priceWatch && s.priceWatch.length) out.push(`Price watch: ${s.priceWatch.length} materials`);
  return out;
}

// ---------------- Phase 5: server-backed settings ----------------
/** Pull the server settings document (GET /api/settings) into the local
 *  cache. Called once on app start and after admin saves. No-op in demo. */
export async function fetchServerSettings(): Promise<OketexSettings | null> {
  if (!(await probeApi())) return null;
  try {
    const { live, settings } = await apiFetch<{ live: boolean; settings: OketexSettings | null }>("/api/settings");
    if (!live) return null;
    try {
      if (settings) localStorage.setItem(SERVER_KEY, JSON.stringify(settings));
      else localStorage.removeItem(SERVER_KEY);
    } catch { /* ignore */ }
    return settings;
  } catch { return null; }
}
/** Save settings: always writes the local override (demo path); when the
 *  API is live, also PUTs the full override document to the server so it
 *  becomes effective for every visitor. */
export async function saveSettingsAsync(patch: OketexSettings): Promise<{ live: boolean }> {
  saveSettings(patch);
  if (!(await probeApi())) return { live: false };
  try {
    // PUT the full EFFECTIVE override document (local merged with whatever
    // the server already held) so saving one group never wipes another.
    const doc = getSettings();
    await apiFetch("/api/settings", { method: "PUT", body: JSON.stringify(doc) });
    await fetchServerSettings();
    return { live: true };
  } catch { return { live: false }; }
}
/** Reset: clears local overrides; when live, PUTs an empty document too. */
export async function resetSettingsAsync(): Promise<void> {
  resetSettings();
  try { localStorage.removeItem(SERVER_KEY); } catch { /* ignore */ }
  if (await probeApi()) {
    try { await apiFetch("/api/settings", { method: "PUT", body: JSON.stringify({}) }); } catch { /* ignore */ }
  }
}
