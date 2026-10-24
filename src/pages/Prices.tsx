import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { PageHead } from "@/components/StatusBadge";
import { formatNGN } from "@/lib/money";
import { getPriceWatch, type PriceWatchMaterial } from "@/lib/settings";

// Price Watch (Phase 6) — data is compiled by the Oketex admin from real
// market checks (Admin → Settings & Rates → Price Watch). The page starts
// EMPTY on purpose: no invented numbers, ever. A material appears here
// only after the admin records dated price points with sources.
function Sparkline({ points }: { points: { priceNgn: number }[] }) {
  if (points.length < 2) return null;
  const vals = points.map(p => p.priceNgn);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const W = 220, H = 56, PAD = 4;
  const coords = vals.map((v, i) => `${(PAD + (i / (vals.length - 1)) * (W - PAD * 2)).toFixed(1)},${(H - PAD - ((v - min) / span) * (H - PAD * 2)).toFixed(1)}`).join(" ");
  const last = vals[vals.length - 1], prev = vals[vals.length - 2];
  const up = last > prev;
  return (<svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" role="img" aria-label="Price trend">
    <polyline points={coords} fill="none" stroke={up ? "#f87171" : "#34d399"} strokeWidth="2" />
    {vals.map((v, i) => (<circle key={i} cx={PAD + (i / (vals.length - 1)) * (W - PAD * 2)} cy={H - PAD - ((v - min) / span) * (H - PAD * 2)} r="2.5" fill={up ? "#f87171" : "#34d399"} />))}
  </svg>);
}
function MaterialCard({ m }: { m: PriceWatchMaterial }) {
  const pts = [...m.points].sort((a, b) => a.date.localeCompare(b.date));
  const cur = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const diff = cur && prev ? cur.priceNgn - prev.priceNgn : 0;
  const pct = cur && prev && prev.priceNgn > 0 ? (diff / prev.priceNgn) * 100 : 0;
  return (
    <div className="border hairline bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display font-bold uppercase text-xl leading-tight">{m.material}</h3>
          <p className="font-tech text-[11px] text-muted-foreground mt-1">per {m.unit}</p>
        </div>
        {cur && <div className="text-right shrink-0">
          <p className="font-display font-bold text-2xl text-primary">{formatNGN(cur.priceNgn)}</p>
          {prev && <p className={`font-tech text-[11px] inline-flex items-center gap-1 ${diff > 0 ? "text-red-400" : diff < 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
            {diff > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : diff < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
            {diff === 0 ? "No change" : `${diff > 0 ? "+" : "−"}${formatNGN(Math.abs(diff))} (${pct > 0 ? "+" : ""}${pct.toFixed(1)}%)`} vs {new Date(prev.date).toLocaleDateString("en-NG")}
          </p>}
        </div>}
      </div>
      <Sparkline points={pts} />
      <div className="border-t hairline mt-4 pt-3 space-y-1.5">
        {pts.slice().reverse().map((p, i) => (
          <p key={i} className="font-tech text-[11px] text-muted-foreground flex justify-between gap-3">
            <span>{new Date(p.date).toLocaleDateString("en-NG")} · {p.source}</span>
            <span className="text-foreground">{formatNGN(p.priceNgn)}</span>
          </p>
        ))}
      </div>
      {cur && <p className="font-tech text-[10px] text-muted-foreground mt-3">Last updated {new Date(cur.date).toLocaleDateString("en-NG")} · Source: {cur.source}</p>}
    </div>
  );
}
export default function Prices() {
  const materials = getPriceWatch().filter(m => m.points.length > 0);
  return (<div>
    <PageHead kicker="Price Watch" title="Building material prices, watched" lead="Indicative market watch compiled by Oketex from dated supplier and market checks — every point shows its source. Use it to time your purchases; confirm the exact price when ordering." />
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      {!materials.length ? (
        <div className="border hairline py-20 text-center px-6">
          <p className="font-display font-bold uppercase text-2xl">Price watch launches soon — first data being compiled</p>
          <p className="font-tech text-sm text-muted-foreground mt-3 max-w-xl mx-auto">We publish only prices we have actually checked, with the date and source attached. The first materials are being compiled now — check back shortly, or ask for today's price on WhatsApp from any product page.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">{materials.map(m => <MaterialCard key={m.material} m={m} />)}</div>
      )}
      <p className="font-tech text-[11px] text-muted-foreground mt-10 border hairline p-4">
        Disclaimer: Indicative market watch compiled by Oketex — confirm prices when ordering. Prices move with the exchange rate, haulage and supplier stock; the figure on your quotation or invoice is the one that counts.
      </p>
    </div>
  </div>);
}
