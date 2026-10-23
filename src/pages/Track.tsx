import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router";
import { PageHead, StatusBadge } from "@/components/StatusBadge";
import { formatNGN } from "@/lib/money";
import { findOrder, findOrdersAsync, getOrders } from "@/lib/storage";
import { findBooking, findBookingsAsync, getBookings, type LocalBooking } from "@/lib/proStorage";
import { Button } from "@/components/ui/button";
import { BUSINESS } from "@/contracts/constants";
import { getBusiness, businessWaLink } from "@/lib/settings";

export default function Track() {
  const [params] = useSearchParams();
  const initialCode = params.get("code") ?? "";
  const [tab, setTab] = useState<"orders" | "bookings">(initialCode.toUpperCase().startsWith("BK-") ? "bookings" : "orders");
  const [q, setQ] = useState(initialCode);
  const [results, setResults] = useState(() => (initialCode && !initialCode.toUpperCase().startsWith("BK-") ? findOrder(initialCode) : []));
  const [bkResults, setBkResults] = useState<LocalBooking[]>(() => (initialCode.toUpperCase().startsWith("BK-") ? findBooking(initialCode) : []));
  const wa = params.get("wa");
  // API-first: server records merge with this device's local copies.
  const search = async () => { if (tab === "orders") setResults(await findOrdersAsync(q)); else setBkResults(await findBookingsAsync(q)); };
  useEffect(() => { if (initialCode) { if (initialCode.toUpperCase().startsWith("BK-")) findBookingsAsync(initialCode).then(setBkResults); else findOrdersAsync(initialCode).then(setResults); } /* eslint-disable-next-line */ }, []);
  const switchTab = (t: "orders" | "bookings") => { setTab(t); setResults([]); setBkResults([]); };

  return (<div><PageHead kicker="Tracking" title="Track orders & bookings" lead="Enter your order code (OKX-…), booking code (BK-…) or phone number." />
  <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
    {wa && <div className="border hairline bg-card p-5 mb-6"><p className="font-tech text-xs text-muted-foreground mb-3">Order placed — send it to the office on WhatsApp:</p><Button asChild className="rounded-none font-display uppercase"><a target="_blank" rel="noreferrer" href={businessWaLink(wa)}>Send order on WhatsApp</a></Button><Link to="/track" className="font-tech text-xs text-muted-foreground ml-4">Refresh</Link></div>}
    <div className="flex gap-px bg-border border hairline w-fit mb-6">
      {(["orders", "bookings"] as const).map(t => (<button key={t} onClick={() => switchTab(t)} className={`px-5 py-2.5 font-tech text-xs uppercase tracking-widest cursor-pointer ${tab === t ? "bg-primary text-primary-foreground" : "bg-background hover:text-primary"}`}>{t === "orders" ? "Orders" : "Bookings"}</button>))}
    </div>
    <div className="flex gap-3"><input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder={tab === "orders" ? "OKX-2026-… or phone" : "BK-2026-… or phone"} className="field-tech font-tech" aria-label="Code or phone" /><Button onClick={() => void search()} className="rounded-none font-display uppercase shrink-0">Track</Button></div>

    {tab === "orders" && (<>
      {!results.length && <p className="font-tech text-sm text-muted-foreground mt-8">No orders found. Orders placed on this device appear here. {getOrders().length ? `(${getOrders().length} saved on this device)` : ""}</p>}
      {results.map(o => (<div key={o.code} className="border hairline mt-8 bg-card"><div className="px-5 py-4 border-b hairline flex justify-between items-center flex-wrap gap-3"><div><p className="font-tech font-semibold">{o.code}</p><p className="font-tech text-[11px] text-muted-foreground">{new Date(o.createdAt).toLocaleString("en-NG")} · {o.name}</p></div><StatusBadge status={o.status} /></div><div className="px-5 py-4">{o.items.map((it, i) => (<div key={i} className="flex justify-between text-sm py-2 border-b hairline last:border-0"><span>{it.quantity}× {it.name}</span><span className="font-tech">{formatNGN(it.lineTotalNgn)}</span></div>))}<div className="flex justify-between mt-4"><span className="label-tech">Total</span><span className="font-display font-bold text-2xl text-primary">{formatNGN(o.totalNgn)}</span></div>{(o as any).paid && <p className="font-tech text-[11px] text-emerald-500 mt-3">Paid online via Paystack ✓</p>}<p className="font-tech text-[11px] text-muted-foreground mt-3">Deliver to: {o.address}</p></div></div>))}
    </>)}
    {tab === "bookings" && (<>
      {!bkResults.length && <p className="font-tech text-sm text-muted-foreground mt-8">No bookings found. Bookings made on this device appear here. {getBookings().length ? `(${getBookings().length} saved on this device)` : ""} <Link className="text-primary" to="/book">Make a booking</Link></p>}
      {bkResults.map(b => (<div key={b.code} className="border hairline mt-8 bg-card"><div className="px-5 py-4 border-b hairline flex justify-between items-center flex-wrap gap-3"><div><p className="font-tech font-semibold">{b.code} — {b.serviceLabel}</p><p className="font-tech text-[11px] text-muted-foreground">{b.name} · {b.phone}</p></div><StatusBadge status={b.status} /></div>
        <div className="px-5 py-4 font-tech text-sm space-y-2">
          <div className="flex justify-between border-b hairline pb-2"><span className="text-muted-foreground">When</span><span>{b.date} · {b.slot}</span></div>
          <div className="flex justify-between border-b hairline pb-2"><span className="text-muted-foreground">Site</span><span className="text-right">{b.address}{b.lgaState ? `, ${b.lgaState}` : ""}</span></div>
          <div className="flex justify-between border-b hairline pb-2"><span className="text-muted-foreground">Building</span><span>{b.buildingType} · {b.stage}</span></div>
          {b.notes && <div className="flex justify-between"><span className="text-muted-foreground">Notes</span><span className="text-right">{b.notes}</span></div>}
          <div className="flex gap-1 flex-wrap pt-2">{["pending", "confirmed", "scheduled", "completed"].map(s => (<span key={s} className={`font-tech text-[10px] uppercase tracking-widest border px-2 py-1 ${b.status === s || (s === "cancelled" && b.status === "cancelled") ? "border-primary text-primary" : "hairline text-muted-foreground"}`}>{s}</span>))}{b.status === "cancelled" && <span className="font-tech text-[10px] uppercase tracking-widest border px-2 py-1 border-red-500/50 text-red-400">cancelled</span>}</div>
        </div></div>))}
    </>)}
    <p className="font-tech text-xs text-muted-foreground mt-8">Prefer to call? <a className="text-primary" href={`tel:${getBusiness().phone.replace(/\s/g, "")}`}>{getBusiness().phone}</a></p>
  </div></div>);
}
