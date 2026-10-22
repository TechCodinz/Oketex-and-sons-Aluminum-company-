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
export interface OketexSettings {
  partnerTerms?: Partial<EffectivePartnerTerms>;
  rates?: { deliveryZones?: Record<string, number>; installationPerM2?: number; ridgePerM?: number; timberPerM?: number };
  business?: Partial<Pick<EffectiveBusiness, "phone" | "whatsapp" | "email" | "address" | "hours">>;
}

export const DELIVERY_ZONE_IDS = ["pickup", "ogun-lagos", "south-west", "ss-se", "abuja-north"] as const;
export const DEFAULT_RATES: EffectiveRates = {
  deliveryZones: { pickup: 0, "ogun-lagos": 45000, "south-west": 85000, "ss-se": 145000, "abuja-north": 185000 },
  installationPerM2: 2200,
  ridgePerM: 4500,
  timberPerM: 1800,
};

const KEY = "oketex-settings";
export function getSettings(): OketexSettings {
  try { const r = localStorage.getItem(KEY); return r ? (JSON.parse(r) as OketexSettings) : {}; } catch { return {}; }
}
export function saveSettings(patch: OketexSettings) {
  const next: OketexSettings = {
    partnerTerms: { ...getSettings().partnerTerms, ...patch.partnerTerms },
    rates: {
      ...getSettings().rates, ...patch.rates,
      deliveryZones: { ...getSettings().rates?.deliveryZones, ...patch.rates?.deliveryZones },
    },
    business: { ...getSettings().business, ...patch.business },
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
  return out;
}
