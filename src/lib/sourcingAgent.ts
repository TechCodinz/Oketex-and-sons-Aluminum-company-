// The Sourcing Agent (2026-10-26) — the Ops Agent's sibling for the
// Source-Anything desk. Same guardrail as opsAgent.ts: THE AGENT
// PROPOSES, A HUMAN APPROVES. The agent never sends a quote; it builds a
// Sourcing Brief per unquoted request — catalogue match, partner match,
// a global search pack, and draft quote math — and the admin turns the
// brief into a quote (or not) in the Sourcing tab.
//
// AI SEAM: when server-side AI assist is enabled later, its web-research
// draft plugs into SourcingBrief.aiNote and the found-cost field of the
// quote form. Rules mode leaves aiNote empty — no fake AI output.
import { products, productPrice, type Product } from "@/data/catalog";
import { capabilityMatch } from "./supply";
import { suggestedPrice } from "./profit";
import type { SourcingBrief, SourceRequest } from "./sourceRequests";

const STOP = new Set(["the", "a", "an", "for", "my", "i", "need", "want", "please", "with", "and", "of", "in", "to", "me", "buy"]);
export function reqTokens(text: string): string[] {
  return [...new Set(String(text || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length >= 3 && !STOP.has(w)))];
}

export interface CatalogueMatch { product: Product; score: number; priceNgn: number }
/** Fuzzy token-overlap match of the request against the stocked
 *  catalogue. Score = share of the request's meaningful tokens that
 *  appear in the product's name/summary/specs/category. ≥ 0.6 = match. */
export function catalogueMatch(req: Pick<SourceRequest, "productName" | "description">, catalogue: Product[] = products): CatalogueMatch | null {
  const tokens = reqTokens(`${req.productName} ${req.description}`);
  if (!tokens.length) return null;
  let best: CatalogueMatch | null = null;
  for (const p of catalogue) {
    const hay = `${p.name} ${p.summary} ${p.categorySlug} ${Object.values(p.specs || {}).join(" ")}`.toLowerCase();
    const hits = tokens.filter(t => hay.includes(t)).length;
    const score = hits / tokens.length;
    if (score >= 0.6 && (!best || score > best.score)) best = { product: p, score, priceNgn: productPrice(p) };
  }
  return best;
}

export interface PartnerMatch { code: string; name: string; capability: string }
/** Partners whose free-text supply capabilities match the request. */
export type PartnerLike = { code: string; name?: string; businessName?: string; supplyCapabilities?: string[]; status?: string };
export function partnerMatches(req: Pick<SourceRequest, "productName" | "description">, partners: PartnerLike[]): PartnerMatch[] {
  const text = `${req.productName} ${req.description}`;
  return partners
    .filter(p => (p.status ?? "approved") === "approved" && Array.isArray(p.supplyCapabilities) && capabilityMatch(p.supplyCapabilities, text))
    .map(p => ({ code: p.code, name: p.businessName || p.name || p.code, capability: (p.supplyCapabilities || []).join(", ") }));
}

/** Pre-built research links — the admin taps, checks LIVE prices on the
 *  marketplaces, and enters the found cost into the quote form. */
export function searchPack(productName: string): { label: string; url: string }[] {
  const q = encodeURIComponent(productName.trim());
  return [
    { label: "Jiji.ng", url: `https://jiji.ng/search?query=${q}` },
    { label: "Jumia", url: `https://www.jumia.com.ng/catalog/?q=${q}` },
    { label: "Alibaba", url: `https://www.alibaba.com/trade/search?searchText=${q}` },
    { label: "AliExpress", url: `https://www.aliexpress.com/wholesale?SearchText=${q}` },
    { label: "Google Shopping", url: `https://www.google.com/search?tbm=shop&q=${q}` },
  ];
}

export function buildSourcingBrief(
  req: SourceRequest,
  ctx: { catalogue?: Product[]; partners: PartnerLike[] },
): SourcingBrief {
  const match = catalogueMatch(req, ctx.catalogue);
  return {
    generatedAt: new Date().toISOString(),
    catalogue: match ? { slug: match.product.slug, name: match.product.name, priceNgn: match.priceNgn } : null,
    partners: partnerMatches(req, ctx.partners).map(p => ({ code: p.code, name: p.name })),
    links: searchPack(req.productName),
    // aiNote: intentionally unset in rules mode (see the AI seam note above).
  };
}

export interface DraftQuote { itemNgn: number; shippingNgn: number; serviceNgn: number; totalNgn: number }
/** Draft quote math: the suggested LANDED total prices (item cost +
 *  shipping) at the target margin via profit.suggestedPrice; the service
 *  line is the margin between real cost and the landed total.
 *  Fixture: cost 40,000 + shipping 15,000 @ 25% → 55,000/0.75 = 73,333.33
 *  → round50 → ₦73,350 total; lines 40,000 / 15,000 / 18,350. */
export function draftQuote(itemCostNgn: number, shippingNgn: number, targetMarginPct: number): DraftQuote {
  const item = Math.max(0, Math.round(itemCostNgn) || 0);
  const ship = Math.max(0, Math.round(shippingNgn) || 0);
  const total = suggestedPrice(item + ship, targetMarginPct);
  return { itemNgn: item, shippingNgn: ship, serviceNgn: Math.max(0, total - item - ship), totalNgn: total };
}
