import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatNGN } from "@/lib/money";
import { catalogue, categories, productPrice, productCost } from "@/data/catalog";
import { getProfitTargetMargin, saveCatalogOverride, saveSettings, saveSettingsAsync } from "@/lib/settings";
import { productProfit, categoryRollups, realizedProfit, suggestedPrice } from "@/lib/profit";
import { sourcingProfitTotal, type SourceRequest } from "@/lib/sourceRequests";
import type { LocalOrder } from "@/lib/storage";
import { logActivity, currentActor } from "@/lib/activity";

// Profit & Margins (Profit Intelligence, 2026-10-26) — ADMIN EYES ONLY
// (tab gated to owner/accounts/sales in lib/staff.ts). Costs are the
// owner's real purchase costs once entered; researched seeds are marked
// as estimates in BUILD_NOTES. A product with no cost shows "cost not
// set" — margins are never invented.
export default function ProfitTab({ orders, sourceRequests }: { orders: LocalOrder[]; sourceRequests: SourceRequest[] }) {
  const [nonce, setNonce] = useState(0);
  const [target, setTarget] = useState(() => getProfitTargetMargin());
  const catName = (slug: string) => categories.find(c => c.slug === slug)?.name || slug;
  const rows = useMemo(() => catalogue().map(p => {
    const price = productPrice(p); const cost = productCost(p);
    return { ...productProfit({ slug: p.slug, name: p.name, categorySlug: p.categorySlug, price, cost }, target), stock: p.stock };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [nonce, target]);
  const rollups = useMemo(() => categoryRollups(rows), [rows]);
  const realized = useMemo(() => realizedProfit(orders), [orders]);
  const sourcing = useMemo(() => sourcingProfitTotal(sourceRequests), [sourceRequests]);
  const below = rows.filter(r => r.belowTarget);
  const uncosted = rows.filter(r => r.cost == null);

  const saveTarget = () => {
    const v = Math.min(90, Math.max(1, Math.round(Number(target) || 25)));
    setTarget(v); saveSettings({ profit: { targetMarginPct: v } });
    void saveSettingsAsync({ profit: { targetMarginPct: v } }).catch(() => { /* demo */ });
    logActivity("profit_target_set", "settings", `Target margin set to ${v}% by ${currentActor().name}`);
    toast.success(`Target margin set to ${v}%`);
  };

  return (<div className="space-y-10" key={nonce}>
    <section>
      <h2 className="font-display font-bold uppercase text-2xl mb-2">Profit &amp; Margins</h2>
      <p className="font-tech text-xs text-muted-foreground max-w-3xl">Margins come from price − cost per product. Costs are researched estimates until the owner enters real purchase costs (Catalog tab or the cost field on any row). <b className="text-foreground">Admin-only:</b> costs and margins never appear on customer pages or in the public catalogue.</p>
      <div className="flex flex-wrap items-end gap-3 mt-5">
        <div><label className="label-tech" htmlFor="pf-target">Target margin %</label><input id="pf-target" type="number" min={1} max={90} className="field-tech font-tech w-28" value={target} onChange={e => setTarget(Number(e.target.value))} /></div>
        <button onClick={saveTarget} className="border hairline px-4 h-10 font-tech text-xs uppercase tracking-widest hover:border-primary hover:text-primary cursor-pointer">Save target</button>
        <p className="font-tech text-xs text-muted-foreground">{below.length} product{below.length === 1 ? "" : "s"} below target · {uncosted.length} without a cost set</p>
      </div>
    </section>

    <section>
      <p className="label-tech mb-3">Realized profit — from orders placed (cost snapshotted at checkout)</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border hairline">
        <div className="bg-background p-4"><div className="font-display font-bold text-2xl text-primary">{realized.costedLines ? formatNGN(realized.totalNgn) : "—"}</div><div className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{realized.costedLines ? `Realized profit (${realized.costedLines} costed order lines)` : "No costed orders yet — orders placed before cost snapshots (incl. all demo orders) are excluded"}</div></div>
        <div className="bg-background p-4"><div className="font-display font-bold text-2xl">{realized.perCategory[0] ? catName(realized.perCategory[0].categorySlug) : "—"}</div><div className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Biggest realized-profit category{realized.perCategory[0] ? ` — ${formatNGN(realized.perCategory[0].profitNgn)}` : ""}</div></div>
        <div className="bg-background p-4"><div className="font-display font-bold text-2xl text-primary">{sourcing.counted ? formatNGN(sourcing.totalNgn) : "—"}</div><div className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Sourcing profit{sourcing.counted ? ` (${sourcing.counted} approved request${sourcing.counted === 1 ? "" : "s"})` : " — no approved sourcing quotes yet"}</div></div>
      </div>
      {realized.uncostedLines > 0 && <p className="font-tech text-[11px] text-muted-foreground mt-2">{realized.uncostedLines} order line(s) carry no cost snapshot and are excluded from realized profit.</p>}
    </section>

    <section>
      <p className="label-tech mb-3">Category ranking — average margin (costed products)</p>
      <div className="border hairline">{rollups.map((c, i) => (<div key={c.categorySlug} className={`px-5 py-3 flex flex-wrap gap-3 justify-between text-sm ${i > 0 ? "border-t hairline" : ""}`}><span>{catName(c.categorySlug)}</span><span className="font-tech">{c.avgMarginPct == null ? "no costs set" : `${c.avgMarginPct.toFixed(1)}% avg margin`} · {c.costed}/{c.products} costed · potential {formatNGN(c.potentialProfitNgn)} in stock</span></div>))}</div>
    </section>

    <section>
      <p className="label-tech mb-3">Products ({rows.length})</p>
      <div className="border hairline overflow-x-auto"><table className="w-full text-sm min-w-[880px]">
        <thead><tr className="text-left font-tech text-[10px] uppercase tracking-widest text-muted-foreground border-b hairline">{["Product", "Price", "Cost", "Profit/unit", "Margin", "At target", ""].map(h => (<th key={h} className="px-4 py-3 font-medium">{h}</th>))}</tr></thead>
        <tbody>{rows.map(r => (<ProfitRow key={r.slug} row={r} target={target} bump={() => setNonce(n => n + 1)} />))}</tbody>
      </table></div>
    </section>
  </div>);
}

function ProfitRow({ row, target, bump }: { row: ReturnType<typeof productProfit> & { stock: number }; target: number; bump: () => void }) {
  const [price, setPrice] = useState(String(row.price));
  const [cost, setCost] = useState(row.cost == null ? "" : String(row.cost));
  const dirty = Number(price) !== row.price || (cost === "" ? null : Number(cost)) !== row.cost;
  const save = () => {
    const p = Math.max(0, Math.round(Number(price) || 0));
    const c = cost.trim() === "" ? null : Math.max(0, Math.round(Number(cost) || 0));
    saveCatalogOverride(row.slug, { ...(p > 0 ? { priceNgn: p } : {}), costPriceNgn: c });
    logActivity("catalog_price_cost_set", row.slug, `${row.name}: price ${formatNGN(p || row.price)}${c != null ? `, cost ${formatNGN(c)}` : ", cost cleared"} by ${currentActor().name}`);
    toast.success(`${row.name} — price/cost saved`);
    bump();
  };
  const applySuggested = () => {
    if (row.suggested == null) return;
    saveCatalogOverride(row.slug, { priceNgn: row.suggested });
    logActivity("catalog_price_applied", row.slug, `${row.name}: price set to suggested ${formatNGN(row.suggested)} at ${target}% target by ${currentActor().name}`);
    toast.success(`${row.name} repriced to ${formatNGN(row.suggested)}`);
    bump();
  };
  return (<tr className="border-b hairline align-top">
    <td className="px-4 py-3"><span className="font-medium">{row.name}</span>{row.belowTarget && <span className="ml-2 bg-destructive/15 text-destructive font-tech text-[10px] uppercase tracking-widest px-1.5 py-0.5">Below target</span>}<span className="block font-tech text-[11px] text-muted-foreground">{row.categorySlug}</span></td>
    <td className="px-4 py-3"><input type="number" min={0} className="field-tech font-tech w-28" value={price} onChange={e => setPrice(e.target.value)} aria-label={`Price for ${row.name}`} /></td>
    <td className="px-4 py-3"><input type="number" min={0} placeholder="Not set" className="field-tech font-tech w-28" value={cost} onChange={e => setCost(e.target.value)} aria-label={`Cost for ${row.name}`} /></td>
    <td className="px-4 py-3 font-tech">{row.profitPerUnit == null ? <span className="text-muted-foreground">cost not set</span> : formatNGN(row.profitPerUnit)}</td>
    <td className="px-4 py-3 font-tech">{row.marginPct == null ? "—" : `${row.marginPct.toFixed(1)}%`}{row.markupPct != null && <span className="block text-[11px] text-muted-foreground">markup {row.markupPct.toFixed(0)}%</span>}</td>
    <td className="px-4 py-3 font-tech">{row.cost != null ? <>{formatNGN(suggestedPrice(row.cost, target))}<button onClick={applySuggested} className="block mt-1 font-tech text-[11px] text-primary hover:underline cursor-pointer">Apply</button></> : "—"}</td>
    <td className="px-4 py-3">{dirty && <button onClick={save} className="border hairline px-3 py-1.5 font-tech text-[11px] uppercase tracking-widest hover:border-primary hover:text-primary cursor-pointer">Save</button>}</td>
  </tr>);
}
