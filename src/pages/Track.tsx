import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router";
import { toast } from "sonner";
import { PageHead, StatusBadge } from "@/components/StatusBadge";
import { formatNGN } from "@/lib/money";
import { findOrder, findOrdersAsync, getOrders } from "@/lib/storage";
import { findBooking, findBookingsAsync, getBookings, type LocalBooking } from "@/lib/proStorage";
import { findVerifyRequests, VERIFY_STATUSES, type VerifyRequest } from "@/lib/assistantBrain";
import { findJobsAsync, getJobBidsAsync, awardBidAsync, budgetLabel, type Job, type Bid } from "@/lib/jobs";
import { addReviewAsync, starsText } from "@/lib/reviews";
import { Button } from "@/components/ui/button";
import { BUSINESS } from "@/contracts/constants";
import { getBusiness, businessWaLink } from "@/lib/settings";

export default function Track() {
  const [params] = useSearchParams();
  const initialCode = params.get("code") ?? "";
  const detectTab = (c: string): "orders" | "bookings" | "verify" | "jobs" => (c.toUpperCase().startsWith("BK-") ? "bookings" : c.toUpperCase().startsWith("VR-") ? "verify" : c.toUpperCase().startsWith("JB-") ? "jobs" : "orders");
  const [tab, setTab] = useState<"orders" | "bookings" | "verify" | "jobs">(detectTab(initialCode));
  const [vrResults, setVrResults] = useState<VerifyRequest[]>(() => (initialCode.toUpperCase().startsWith("VR-") ? findVerifyRequests(initialCode) : []));
  const [jbResults, setJbResults] = useState<{ job: Job; bids: Bid[] }[]>([]);
  const [rvText, setRvText] = useState("");
  const [rvRating, setRvRating] = useState(5);
  const [q, setQ] = useState(initialCode);
  const [results, setResults] = useState(() => (initialCode && !initialCode.toUpperCase().startsWith("BK-") ? findOrder(initialCode) : []));
  const [bkResults, setBkResults] = useState<LocalBooking[]>(() => (initialCode.toUpperCase().startsWith("BK-") ? findBooking(initialCode) : []));
  const wa = params.get("wa");
  // API-first: server records merge with this device's local copies.
  const loadJobs = async (query: string) => { const jobs = await findJobsAsync(query); const withBids = await Promise.all(jobs.map(async job => ({ job, bids: await getJobBidsAsync(job.code) }))); setJbResults(withBids); };
  const search = async () => { if (tab === "orders") setResults(await findOrdersAsync(q)); else if (tab === "bookings") setBkResults(await findBookingsAsync(q)); else if (tab === "jobs") await loadJobs(q); else setVrResults(findVerifyRequests(q)); };
  useEffect(() => { if (initialCode) { if (initialCode.toUpperCase().startsWith("BK-")) findBookingsAsync(initialCode).then(setBkResults); else if (initialCode.toUpperCase().startsWith("JB-")) void loadJobs(initialCode); else findOrdersAsync(initialCode).then(setResults); } /* eslint-disable-next-line */ }, []);
  const switchTab = (t: "orders" | "bookings" | "verify" | "jobs") => { setTab(t); setResults([]); setBkResults([]); setVrResults([]); setJbResults([]); };
  const acceptBid = async (job: Job, bid: Bid) => { const r = await awardBidAsync(job.code, bid.id); if (r) { toast.success(`Awarded to ${r.bid.partnerName} — connection ${r.lead.id} opened with ${r.lead.commissionPct}% commission snapshotted`); await loadJobs(q || job.code); } else toast.error("Could not award this bid"); };
  const submitReview = async (job: Job, partnerCode: string, partnerName: string) => { if (rvText.trim().length < 3) return toast.error("Write a few words about the work"); await addReviewAsync({ partnerCode, customerName: job.customerName, rating: rvRating, text: rvText.trim(), refCode: job.code }); setRvText(""); toast.success(`Thank you — your review of ${partnerName} is published`); };

  return (<div><PageHead kicker="Tracking" title="Track orders & bookings" lead="Enter your order code (OKX-…), booking code (BK-…), pro-check code (VR-…) or phone number." />
  <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
    {wa && <div className="border hairline bg-card p-5 mb-6"><p className="font-tech text-xs text-muted-foreground mb-3">Order placed — send it to the office on WhatsApp:</p><Button asChild className="rounded-none font-display uppercase"><a target="_blank" rel="noreferrer" href={businessWaLink(wa)}>Send order on WhatsApp</a></Button><Link to="/track" className="font-tech text-xs text-muted-foreground ml-4">Refresh</Link></div>}
    <div className="flex gap-px bg-border border hairline w-fit mb-6">
      {(["orders", "bookings", "verify", "jobs"] as const).map(t => (<button key={t} onClick={() => switchTab(t)} className={`px-5 py-2.5 font-tech text-xs uppercase tracking-widest cursor-pointer ${tab === t ? "bg-primary text-primary-foreground" : "bg-background hover:text-primary"}`}>{t === "orders" ? "Orders" : t === "bookings" ? "Bookings" : t === "verify" ? "Pro Check" : "Jobs"}</button>))}
    </div>
    <div className="flex gap-3"><input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder={tab === "orders" ? "OKX-2026-… or phone" : tab === "bookings" ? "BK-2026-… or phone" : tab === "jobs" ? "JB-2026-… or phone" : "VR-2026-… or phone"} className="field-tech font-tech" aria-label="Code or phone" /><Button onClick={() => void search()} className="rounded-none font-display uppercase shrink-0">Track</Button></div>

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
    {tab === "verify" && (<>
      {!vrResults.length && <p className="font-tech text-sm text-muted-foreground mt-8">No pro-check requests found. Requests are created in this browser when you tap "Request a pro check" on an assistant quotation.</p>}
      {vrResults.map(r => (<div key={r.code} className="border hairline mt-8 bg-card"><div className="px-5 py-4 border-b hairline flex justify-between items-center flex-wrap gap-3"><div><p className="font-tech font-semibold">{r.code} — Pro Check{r.priority ? " · PRIORITY" : ""}</p><p className="font-tech text-[11px] text-muted-foreground">For quotation {r.quoteCode} · {r.name} · {r.phone}</p></div><StatusBadge status={r.status} /></div>
        <div className="px-5 py-4 font-tech text-sm space-y-2">
          <div className="flex justify-between border-b hairline pb-2"><span className="text-muted-foreground">Site</span><span className="text-right">{r.address}</span></div>
          <div className="flex justify-between border-b hairline pb-2"><span className="text-muted-foreground">Preferred date</span><span>{r.preferredDate || "As soon as possible"}</span></div>
          {r.proNote && <div className="flex justify-between border-b hairline pb-2"><span className="text-muted-foreground">Pro note</span><span className="text-right">{r.proNote}</span></div>}
          {r.finalTotal !== null && <div className="flex justify-between"><span className="text-muted-foreground">Final confirmed total</span><span className="font-display font-bold text-xl text-primary">{formatNGN(r.finalTotal)}</span></div>}
          <div className="flex gap-1 flex-wrap pt-2">{VERIFY_STATUSES.map(st => (<span key={st} className={`font-tech text-[10px] uppercase tracking-widest border px-2 py-1 ${r.status === st ? "border-primary text-primary" : "hairline text-muted-foreground"}`}>{st}</span>))}</div>
        </div></div>))}
    </>)}
    {tab === "jobs" && (<>
      {!jbResults.length && <p className="font-tech text-sm text-muted-foreground mt-8">No jobs found for that code or phone. Jobs you post on the <Link className="text-primary" to="/jobs">Jobs Board</Link> appear here with their bids.</p>}
      {jbResults.map(({ job, bids }) => { const accepted = bids.find(b => b.status === "Accepted"); return (<div key={job.code} className="border hairline mt-8 bg-card"><div className="px-5 py-4 border-b hairline flex justify-between items-center flex-wrap gap-3"><div><p className="font-tech font-semibold">{job.code} — {job.title}</p><p className="font-tech text-[11px] text-muted-foreground">{job.trade} · {job.location} · Budget {budgetLabel(job)} · posted {new Date(job.createdAt).toLocaleDateString("en-NG")}</p></div><StatusBadge status={job.status} /></div>
        <div className="px-5 py-4">
          <p className="text-sm text-muted-foreground">{job.description}</p>
          <p className="label-tech mt-4 mb-2">Bids ({bids.length})</p>
          {!bids.length && <p className="font-tech text-xs text-muted-foreground">No bids yet — approved partners see your job on the board.</p>}
          <div className="space-y-3">{bids.map(b => (<div key={b.id} className="flex flex-wrap items-center gap-3 border hairline px-4 py-3">
            <div className="min-w-0 flex-1"><p className="font-display font-semibold uppercase text-sm truncate">{b.partnerName || b.partnerCode}</p><p className="font-tech text-[11px] text-muted-foreground">{b.days ? `Ready in ~${b.days} day${b.days === 1 ? "" : "s"}` : "Timeline on request"}{b.note ? ` · ${b.note}` : ""}</p></div>
            <span className="font-display font-bold text-lg text-primary">{formatNGN(b.amount)}</span>
            <span className={`font-tech text-[10px] uppercase tracking-widest border px-2 py-0.5 ${b.status === "Accepted" ? "border-emerald-500/60 text-emerald-400" : b.status === "Rejected" ? "border-red-500/50 text-red-400" : "hairline text-muted-foreground"}`}>{b.status}</span>
            {job.status === "Open" && b.status === "Pending" && <Button className="rounded-none font-display uppercase text-xs" onClick={() => void acceptBid(job, b)}>Accept bid</Button>}
          </div>))}</div>
          {accepted && (<div className="border-t hairline mt-5 pt-4">
            <p className="label-tech mb-2">Review this pro</p>
            <p className="font-tech text-xs text-muted-foreground mb-3">Your review of {accepted.partnerName} publishes on their profile, tied to job {job.code}.</p>
            <div className="flex gap-1 mb-3">{[1, 2, 3, 4, 5].map(n => (<button key={n} onClick={() => setRvRating(n)} aria-label={`${n} stars`} className={`text-2xl cursor-pointer ${n <= rvRating ? "text-primary" : "text-muted-foreground"}`}>★</button>))}<span className="font-tech text-xs self-center ml-2">{starsText(rvRating)}</span></div>
            <textarea value={rvText} onChange={e => setRvText(e.target.value)} rows={3} className="field-tech resize-none" placeholder="How was the work? Quality, punctuality, value…" aria-label="Review text" />
            <Button className="rounded-none font-display uppercase mt-3" onClick={() => void submitReview(job, accepted.partnerCode, accepted.partnerName)}>Publish review</Button>
          </div>)}
        </div></div>); })}
    </>)}
    <p className="font-tech text-xs text-muted-foreground mt-8">Prefer to call? <a className="text-primary" href={`tel:${getBusiness().phone.replace(/\s/g, "")}`}>{getBusiness().phone}</a></p>
  </div></div>);
}
