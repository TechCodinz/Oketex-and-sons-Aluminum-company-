// Profit Intelligence (2026-10-26) — a PURE module: no storage, no DOM.
// Every number here is computed from a price and a cost the owner can see
// and edit. A product without a cost yields nulls — never an invented
// margin. Prices/costs enter through the catalogue + settings overrides;
// realized profit enters through order-line cost snapshots taken at
// checkout (orders keep the cost that was true when they were placed).

/** Round to the nearest ₦50 — Nigerian price points land on 50s. */
export function round50(n: number): number { return Math.round(n / 50) * 50; }

export function profitPerUnit(price: number, cost: number): number { return Math.round(price - cost); }
/** Margin = profit as a share of the SELLING price. */
export function marginPct(price: number, cost: number): number { return price > 0 ? ((price - cost) / price) * 100 : 0; }
/** Markup = profit as a share of the COST. */
export function markupPct(price: number, cost: number): number { return cost > 0 ? ((price - cost) / cost) * 100 : 0; }

/** The price that earns `targetMarginPct` on the selling price:
 *  price = cost / (1 − target/100), rounded to the nearest ₦50.
 *  Fixture: cost 7,500 @ 30% → 7,500/0.7 = 10,714.28… → ₦10,700. */
export function suggestedPrice(cost: number, targetMarginPct: number): number {
  if (!(cost > 0)) return 0;
  const t = Math.min(95, Math.max(0, targetMarginPct));
  return round50(cost / (1 - t / 100));
}

export interface ProductProfit {
  slug: string; name: string; categorySlug: string;
  price: number; cost: number | null;
  profitPerUnit: number | null; marginPct: number | null; markupPct: number | null;
  belowTarget: boolean; suggested: number | null;
}

export function productProfit(row: { slug: string; name: string; categorySlug: string; price: number; cost: number | null }, targetMarginPct: number): ProductProfit {
  if (row.cost == null || !(row.cost > 0)) {
    return { ...row, profitPerUnit: null, marginPct: null, markupPct: null, belowTarget: false, suggested: null };
  }
  const m = marginPct(row.price, row.cost);
  return {
    ...row,
    profitPerUnit: profitPerUnit(row.price, row.cost),
    marginPct: m,
    markupPct: markupPct(row.price, row.cost),
    belowTarget: m < targetMarginPct,
    suggested: suggestedPrice(row.cost, targetMarginPct),
  };
}

export interface CategoryRollup {
  categorySlug: string; products: number; costed: number;
  avgMarginPct: number | null; potentialProfitNgn: number;
}

/** Category rollups: average margin over COSTED products only, and the
 *  total profit locked in current stock (profit/unit × units in stock). */
export function categoryRollups(rows: (ProductProfit & { stock: number })[]): CategoryRollup[] {
  const byCat = new Map<string, { products: number; costed: number; marginSum: number; potential: number }>();
  for (const r of rows) {
    const c = byCat.get(r.categorySlug) ?? { products: 0, costed: 0, marginSum: 0, potential: 0 };
    c.products += 1;
    if (r.marginPct != null && r.profitPerUnit != null) { c.costed += 1; c.marginSum += r.marginPct; c.potential += r.profitPerUnit * Math.max(0, r.stock || 0); }
    byCat.set(r.categorySlug, c);
  }
  return [...byCat.entries()].map(([categorySlug, c]) => ({
    categorySlug, products: c.products, costed: c.costed,
    avgMarginPct: c.costed ? c.marginSum / c.costed : null,
    potentialProfitNgn: Math.round(c.potential),
  })).sort((a, b) => (b.avgMarginPct ?? -1) - (a.avgMarginPct ?? -1));
}

export interface RealizedProfit {
  totalNgn: number; costedLines: number; uncostedLines: number;
  perCategory: { categorySlug: string; profitNgn: number }[];
  perProduct: { name: string; profitNgn: number; qty: number }[];
}

type OrderLike = { items?: { name: string; quantity: number; unitPriceNgn: number; costPriceNgn?: number | null; categorySlug?: string }[] };

/** Realized profit from order snapshots: a line counts only when the
 *  order recorded the cost at placement time. Lines/orders without a
 *  snapshot (all demo orders) are excluded and counted separately so the
 *  UI can label them honestly. */
export function realizedProfit(orders: OrderLike[]): RealizedProfit {
  let total = 0, costed = 0, uncosted = 0;
  const perCat = new Map<string, number>();
  const perProd = new Map<string, { profitNgn: number; qty: number }>();
  for (const o of orders || []) {
    for (const it of o.items || []) {
      const qty = Number(it.quantity) || 0;
      if (typeof it.costPriceNgn === "number" && it.costPriceNgn > 0) {
        const p = (Number(it.unitPriceNgn) - it.costPriceNgn) * qty;
        total += p; costed += 1;
        const cat = it.categorySlug || "uncategorised";
        perCat.set(cat, (perCat.get(cat) ?? 0) + p);
        const cur = perProd.get(it.name) ?? { profitNgn: 0, qty: 0 };
        cur.profitNgn += p; cur.qty += qty; perProd.set(it.name, cur);
      } else uncosted += 1;
    }
  }
  return {
    totalNgn: Math.round(total), costedLines: costed, uncostedLines: uncosted,
    perCategory: [...perCat.entries()].map(([categorySlug, profitNgn]) => ({ categorySlug, profitNgn: Math.round(profitNgn) })).sort((a, b) => b.profitNgn - a.profitNgn),
    perProduct: [...perProd.entries()].map(([name, v]) => ({ name, profitNgn: Math.round(v.profitNgn), qty: v.qty })).sort((a, b) => b.profitNgn - a.profitNgn),
  };
}
