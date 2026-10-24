// Assistant quotation brain (Deliverable D) — the guided "Write my quotation"
// flow. Every price comes from the REAL engines: calculateRoof for roofing,
// estimateProject for tiling/painting/ACP, and the live catalog for gutters.
// The brain NEVER invents a price: quality tiers only scale the engine total
// by the declared factors below, and the result is always a RANGE carrying an
// "unverified measurements" disclaimer until a pro checks it.
import { calculateRoof } from "./roofEngine";
import { estimateProject, defaultEstimatorInput } from "./projectEstimator";
import { products } from "@/data/catalog";
import { formatNGN } from "./money";
import { quoteCode, saveQuoteAsync, type LocalQuote } from "./storage";
import { bookingCode, saveBookingAsync } from "./proStorage";
import { getEntitlements } from "./plans";
import { notify } from "./notify";

// ---- Tier model -------------------------------------------------------------
// Tier factors scale the engine's Standard total. Basic = an economy spec of
// the same measured job (0.85x), Premium = a heavier spec (1.25x). Within a
// tier, the quoted range is anchor x 0.95 (low) to anchor x 1.10 (high) to
// absorb site unknowns. These are presentation bands over real engine output,
// not prices in themselves.
export const TIER_FACTORS = { basic: 0.85, standard: 1.0, premium: 1.25 } as const;
export type TierId = keyof typeof TIER_FACTORS;
export const RANGE_LOW_FACTOR = 0.95;
export const RANGE_HIGH_FACTOR = 1.1;

export type AssistantTrade = "roofing" | "tiling" | "painting" | "acp" | "gutters" | "other";
export const ASSISTANT_TRADES: { id: AssistantTrade; label: string }[] = [
  { id: "roofing", label: "Roofing" }, { id: "tiling", label: "Tiling" },
  { id: "painting", label: "Painting" }, { id: "acp", label: "ACP Cladding" },
  { id: "gutters", label: "Gutters" }, { id: "other", label: "Something else" },
];

export interface AssistantQuoteInput {
  trade: AssistantTrade; tier: TierId;
  length?: number; width?: number; pitch?: number; roofStyle?: "gable" | "hip";
  areaM2?: number; gutterMetres?: number;
}
export interface AssistantQuoteResult {
  anchor: number; low: number; high: number;
  lines: string[]; assumptions: string[];
}
export function computeAssistantRange(inp: AssistantQuoteInput): AssistantQuoteResult | null {
  const f = TIER_FACTORS[inp.tier];
  let engineTotal = 0; const lines: string[] = []; const assumptions: string[] = [];
  if (inp.trade === "roofing") {
    const L = inp.length ?? 0, W = inp.width ?? 0;
    if (L <= 0 || W <= 0) return null;
    const res = calculateRoof({
      length: L, width: W, overhang: 0.6, style: inp.roofStyle ?? "gable",
      pitchDeg: inp.pitch ?? 25, profile: "longspan-045", colour: "Charcoal", wastePct: null,
      extras: { gutters: false, insulation: false, installation: true, timber: false }, deliveryZone: "pickup",
    });
    engineTotal = res.grandTotal;
    lines.push(`Roof covering & materials (${res.cuttingList})`);
    lines.push(`True roof area ${res.trueRoofArea.toFixed(1)} m2 at ${inp.pitch ?? 25} deg pitch, incl. installation labour`);
    assumptions.push("Longspan 0.45mm profile, 0.6m eaves overhang, pickup from Ibafo (delivery extra).");
  } else if (inp.trade === "tiling" || inp.trade === "painting" || inp.trade === "acp") {
    const area = inp.areaM2 ?? 0;
    if (area <= 0) return null;
    if (inp.trade === "tiling") {
      const side = Math.sqrt(area);
      const est = estimateProject({ ...defaultEstimatorInput("tiling", "tile-large"), length: side, width: side, wallsPct: 0 });
      engineTotal = est.pricedTotal;
      lines.push(`Tiles, adhesive, grout & labour for ${area} m2 of floor (large-format straight lay)`);
      assumptions.push("Square-room assumption, floor only (no wall tiling), 600x600-class tiles at estimator rates.");
    } else {
      const styleId = inp.trade === "acp" ? "ext-acp" : "ext-render";
      const est = estimateProject({ ...defaultEstimatorInput("exterior", styleId), length: area / 3, height: 3, elevations: 1, openingsPct: 10 });
      engineTotal = est.pricedTotal;
      lines.push(inp.trade === "acp" ? `ACP panels, subframe, sealant & labour for ~${area} m2 of facade` : `Weather-shield paint system & labour for ~${area} m2 of wall`);
      assumptions.push("3m wall height, 10% deducted for openings, estimator rates.");
    }
  } else if (inp.trade === "gutters") {
    const m = inp.gutterMetres ?? 0;
    if (m <= 0) return null;
    const g = products.find(p => p.slug === "rain-gutter-system");
    if (!g) return null;
    engineTotal = m * g.priceNgn;
    lines.push(`${g.name} — ${m} m at ${formatNGN(g.priceNgn)} ${g.unit} (kit includes downpipes, outlets & brackets)`);
    assumptions.push("Gutter length as given; downpipes sized on site.");
  } else {
    return null; // "other" — no engine, no invented price: the flow offers a pro visit instead.
  }
  const anchor = Math.round(engineTotal * f);
  return { anchor, low: Math.round(anchor * RANGE_LOW_FACTOR), high: Math.round(anchor * RANGE_HIGH_FACTOR), lines, assumptions };
}

export const ASSISTANT_DISCLAIMER = "Assistant estimate — measurements not yet verified. A pro check confirms final measurements and price before any work starts.";

/** Save the assistant quotation to oketex-quotes with its range + Unverified status. */
export async function saveAssistantQuote(inp: AssistantQuoteInput, res: AssistantQuoteResult, customer: { name?: string; phone?: string }): Promise<LocalQuote> {
  const tradeLabel = ASSISTANT_TRADES.find(t => t.id === inp.trade)?.label ?? inp.trade;
  const tierLabel = inp.tier === "basic" ? "Basic" : inp.tier === "premium" ? "Premium" : "Standard";
  const area = inp.trade === "roofing" ? (inp.length ?? 0) * (inp.width ?? 0) : (inp.areaM2 ?? inp.gutterMetres ?? 0);
  const q: LocalQuote = {
    code: quoteCode(), name: customer.name ?? "Assistant customer", phone: customer.phone ?? "",
    roofType: `${tradeLabel} — ${tierLabel} tier (assistant)`, areaM2: Math.round(area * 10) / 10,
    estimateNgn: res.anchor, rangeLow: res.low, rangeHigh: res.high, source: "assistant",
    boqSummary: [...res.lines, ...res.assumptions].join("\n"),
    note: ASSISTANT_DISCLAIMER, status: "Unverified", createdAt: new Date().toISOString(),
  };
  await saveQuoteAsync(q);
  return q;
}

// ---- Text parsing (best effort) ---------------------------------------------
export function parseDims(text: string): { l: number; w: number } | null {
  const m = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(?:x|by|\*)\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const l = parseFloat(m[1]), w = parseFloat(m[2]);
  return l > 0 && w > 0 ? { l, w } : null;
}
export function parseArea(text: string): number | null {
  const m = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(?:m2|m²|sqm|square)/i) ?? text.replace(/,/g, "").match(/^\s*(\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return n > 0 ? n : null;
}
export function parsePitch(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:deg|°|degrees)/i);
  if (m) { const n = parseFloat(m[1]); if (n >= 3 && n <= 60) return n; }
  return null;
}
export function isQuoteIntent(text: string): boolean {
  return /quotation|quote me|write.*quote|estimate my|price my (roof|house|building|tiling|painting)/i.test(text);
}

// ---- Pro verification requests ----------------------------------------------
export type VerifyStatus = "Requested" | "Pro Assigned" | "Verified" | "Completed";
export const VERIFY_STATUSES: VerifyStatus[] = ["Requested", "Pro Assigned", "Verified", "Completed"];
export interface VerifyRequest {
  code: string; quoteCode: string;
  name: string; phone: string; address: string; preferredDate: string;
  status: VerifyStatus; proNote: string; finalTotal: number | null;
  priority: boolean; createdAt: string;
}
const VERIFY_KEY = "oketex-verify-requests";
export function getVerifyRequests(): VerifyRequest[] {
  try { const r = localStorage.getItem(VERIFY_KEY); return r ? (JSON.parse(r) as VerifyRequest[]) : []; } catch { return []; }
}
export function saveVerifyRequests(list: VerifyRequest[]) { try { localStorage.setItem(VERIFY_KEY, JSON.stringify(list)); } catch { /* ignore */ } }
export function verifyCode() { return `VR-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; }
export function findVerifyRequests(q: string): VerifyRequest[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return getVerifyRequests().filter(r => r.code.toLowerCase() === s || r.phone.replace(/\s/g, "").endsWith(s.replace(/\s/g, "")));
}
/** Create a verification request + its linked site booking (flows into Bookings/Admin/Track surfaces). Pro-plan customers are flagged priority. */
export async function createVerifyRequest(input: { quoteCode: string; name: string; phone: string; address: string; preferredDate: string }): Promise<VerifyRequest> {
  const priority = getEntitlements().isPro;
  const rec: VerifyRequest = {
    code: verifyCode(), quoteCode: input.quoteCode, name: input.name, phone: input.phone,
    address: input.address, preferredDate: input.preferredDate, status: "Requested",
    proNote: "", finalTotal: null, priority, createdAt: new Date().toISOString(),
  };
  saveVerifyRequests([rec, ...getVerifyRequests()]);
  notify({ templateKey: "verify_requested", audience: "admin", refCode: rec.code, vars: { name: input.name, phone: input.phone } });
  await saveBookingAsync({
    code: bookingCode(), service: "quote-verification", serviceLabel: "Quote Verification Visit",
    date: input.preferredDate || new Date().toISOString().slice(0, 10), slot: "Morning 8-11",
    name: input.name, phone: input.phone, address: input.address, lgaState: "", buildingType: "",
    stage: "", notes: `Verify assistant quotation ${input.quoteCode} — request ${rec.code}${priority ? " (PRIORITY — Pro plan)" : ""}`,
    status: "pending", createdAt: new Date().toISOString(),
  });
  return rec;
}
