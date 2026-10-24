import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router";
import { toast } from "sonner";
import { PageHead, StatusBadge } from "@/components/StatusBadge";
import { formatNGN } from "@/lib/money";
import { findOrder, findOrdersAsync, getOrders } from "@/lib/storage";
import { findBooking, findBookingsAsync, getBookings, type LocalBooking } from "@/lib/proStorage";
import { findVerifyRequests, VERIFY_STATUSES, type VerifyRequest } from "@/lib/assistantBrain";
import { findJobsAsync, getJobBidsAsync, awardBidAsync, budgetLabel, type Job, type Bid } from "@/lib/jobs";
import { addReviewAsync, starsText, reviewSummaryFor, syncReviewsAsync } from "@/lib/reviews";
import { Button } from "@/components/ui/button";
import { BUSINESS } from "@/contracts/constants";
import { getBusiness, businessWaLink } from "@/lib/settings";
import { findSnapRequestAsync, findSnapRequestsByPhoneAsync, approveSnapRequestAsync, SNAP_INTENT_LABEL, type SnapRequest } from "@/lib/snapRequests";
import { getPartnersAsync, type Partner } from "@/lib/partnerStorage";
import { MapCard } from "@/components/MapCard";
import { paymentsApi, apiLiveSync } from "@/lib/api";

export default function Track() {
  const [params] = useSearchParams();
  const initialCode = params.get("code") ?? "";
  const detectTab = (c: string): "orders" | "bookings" | "verify" | "jobs" | "snap" => (c.toUpperCase().startsWith("BK-") ? "bookings" : c.toUpperCase().startsWith("VR-") ? "verify" : c.toUpperCase().startsWith("JB-") ? "jobs" : c.toUpperCase().startsWith("SR-") ? "snap" : "orders");
  const [tab, setTab] = useState<"orders" | "bookings" | "verify" | "jobs" | "snap">(detectTab(initialCode));
  const [snapResults, setSnapResults] = useState<SnapRequest[]>([]);
  const [snapPartners, setSnapPartners] = useState<Partner[]>([]);
  const [approvePhone, setApprovePhone] = useState("");
  const [snapPhoto, setSnapPhoto] = useState<string | null>(null);
  const loadSnapPartners = async (list: SnapRequest[]) => { if (list.some(r => r.assignedPartnerCode)) { setSnapPartners(await getPartnersAsync()); void syncReviewsAsync(); } };
  const loadSnap = async (query: string) => { const t = query.trim(); let list: SnapRequest[] = []; if (t.toUpperCase().startsWith("SR-")) { const r = await findSnapRequestAsync(t); list = r ? [r] : []; } else if (t.replace(/\D/g, "").length >= 7) { list = await findSnapRequestsByPhoneAsync(t); } setSnapResults(list); void loadSnapPartners(list); };
  const approveSnap = async (r: SnapRequest) => { const phone = approvePhone.trim() || r.customerPhone; if (phone.replace(/\D/g, "").length < 7) return toast.error("Enter the phone number you used for this request to approve"); const res = await approveSnapRequestAsync(r.code, phone); if (res.ok) { toast.success("Approved — Oketex will assign a trusted pro at the agreed price"); await loadSnap(r.code); } else toast.error(res.error || "Could not approve — check the phone number"); };
  const paySnap = async (r: SnapRequest) => { const amount = r.agreedPriceNgn ?? r.totalNgn; const init = await paymentsApi.initialize({ email: "customer@oketex.local", amountNgn: amount, purpose: "snap_job", refId: r.code }); if (init.enabled && init.authorizationUrl) { window.location.href = init.authorizationUrl; return; } toast.message(init.enabled ? "Payment could not start — the office will confirm payment with you." : "Online payment isn't enabled yet — approve here and the office confirms payment on WhatsApp."); };
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
  const search = async () => { if (tab === "orders") setResults(await findOrdersAsync(q)); else if (tab === "bookings") setBkResults(await findBookingsAsync(q)); else if (tab === "jobs") await loadJobs(q); else if (tab === "snap") await loadSnap(q); else setVrResults(findVerifyRequests(q)); };
  useEffect(() => { if (initialCode) { if (initialCode.toUpperCase().startsWith("BK-")) findBookingsAsync(initialCode).then(setBkResults); else if (initialCode.toUpperCase().startsWith("JB-")) void loadJobs(initialCode); else if (initialCode.toUpperCase().startsWith("SR-")) void loadSnap(initialCode); else findOrdersAsync(initialCode).then(setResults); } /* eslint-disable-next-line */ }, []);
  const switchTab = (t: "orders" | "bookings" | "verify" | "jobs" | "snap") => { setTab(t); setResults([]); setBkResults([]); setVrResults([]); setJbResults([]); setSnapResults([]); };
  const acceptBid = async (job: Job, bid: Bid) => { const r = await awardBidAsync(job.code, bid.id); if (r) { toast.success(`Awarded to ${r.bid.partnerName} — connection ${r.lead.id} opened with ${r.lead.commissionPct}% commission snapshotted`); await loadJobs(q || job.code); } else toast.error("Could not award this bid"); };
  const submitReview = async (job: Job, partnerCode: string, partnerName: string) => { if (rvText.trim().length < 3) return toast.error("Write a few words about the work"); await addReviewAsync({ partnerCode, customerName: job.customerName, rating: rvRating, text: rvText.trim(), refCode: job.code }); setRvText(""); toast.success(`Thank you — your review of ${partnerName} is published`); };

  return (<div><PageHead kicker="Tracking" title="Track orders & bookings" lead="Enter your order code (OKX-…), booking code (BK-…), pro-check code (VR-…), job code (JB-…), Snap & Send code (SR-…) or phone number." />
  <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
    {wa && <div className="border hairline bg-card p-5 mb-6"><p className="font-tech text-xs text-muted-foreground mb-3">Order placed — send it to the office on WhatsApp:</p><Button asChild className="rounded-none font-display uppercase"><a target="_blank" rel="noreferrer" href={businessWaLink(wa)}>Send order on WhatsApp</a></Button><Link to="/track" className="font-tech text-xs text-muted-foreground ml-4">Refresh</Link></div>}
    <div className="flex gap-px bg-border border hairline w-fit mb-6">
      {(["orders", "bookings", "verify", "jobs", "snap"] as const).map(t => (<button key={t} onClick={() => switchTab(t)} className={`px-5 py-2.5 font-tech text-xs uppercase tracking-widest cursor-pointer ${tab === t ? "bg-primary text-primary-foreground" : "bg-background hover:text-primary"}`}>{t === "orders" ? "Orders" : t === "bookings" ? "Bookings" : t === "verify" ? "Pro Check" : t === "jobs" ? "Jobs" : "Snap Requests"}</button>))}
    </div>
    <div className="flex gap-3"><input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder={tab === "orders" ? "OKX-2026-… or phone" : tab === "bookings" ? "BK-2026-… or phone" : tab === "jobs" ? "JB-2026-… or phone" : tab === "snap" ? "SR-2026-… or phone" : "VR-2026-… or phone"} className="field-tech font-tech" aria-label="Code or phone" /><Button onClick={() => void search()} className="rounded-none font-display uppercase shrink-0">Track</Button></div>

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
    {tab === "snap" && (<>
      {!snapResults.length && <p className="font-tech text-sm text-muted-foreground mt-8">No Snap &amp; Send requests found for that code or phone. <Link className="text-primary" to="/snap-send">Send a Snap &amp; Send request</Link></p>}
      {snapResults.map(r => { const pro = r.assignedPartnerCode ? snapPartners.find(p => p.code === r.assignedPartnerCode) : undefined; const rating = r.assignedPartnerCode ? reviewSummaryFor(r.assignedPartnerCode) : { avg: 0, count: 0 }; const mainPhoto = r.photo || r.videoPoster; return (<div key={r.code} className="border hairline mt-8 bg-card">
        <div className="px-5 py-4 border-b hairline flex justify-between items-center flex-wrap gap-3"><div><p className="font-tech font-semibold">{r.code} — {SNAP_INTENT_LABEL[r.intent] || r.intent}</p><p className="font-tech text-[11px] text-muted-foreground">{r.customerName} · {r.urgency} · sent {new Date(r.createdAt).toLocaleString("en-NG")}</p></div><StatusBadge status={r.status} /></div>
        <div className="px-5 py-4 space-y-5">
          {mainPhoto && <button onClick={() => setSnapPhoto(mainPhoto)} className="block cursor-pointer"><img src={mainPhoto} alt="Your snap" className="max-h-64 w-auto border hairline" />{r.videoPoster && !r.photo && <span className="font-tech text-[10px] text-muted-foreground block mt-1 text-left">Frame from your video — tap to enlarge</span>}</button>}
          <p className="text-sm text-muted-foreground">{r.description}</p>
          {r.intent === "sell" && r.sellItemName && <p className="font-tech text-xs text-muted-foreground">Item: <b className="text-foreground">{r.sellItemName}</b>{r.sellAskingNgn ? ` · asking ${formatNGN(r.sellAskingNgn)}` : ""}{r.sellCondition ? ` · ${r.sellCondition}` : ""}</p>}
          <MapCard geo={r.geo} address={r.address} />
          {r.assessment && (<div className="border hairline">
            <p className="label-tech px-4 py-3 border-b hairline">Our price breakdown</p>
            <div className="px-4 py-3 space-y-1.5 font-tech text-sm">
              {r.assessment.items.map((it, i) => (<div key={i} className="flex justify-between"><span>{it.qty}× {it.name}</span><span>{formatNGN(it.qty * it.unitPrice)}</span></div>))}
              {r.assessment.workmanshipNgn > 0 && <div className="flex justify-between"><span>Workmanship</span><span>{formatNGN(r.assessment.workmanshipNgn)}</span></div>}
              {r.assessment.transportNgn > 0 && <div className="flex justify-between"><span>Transport</span><span>{formatNGN(r.assessment.transportNgn)}</span></div>}
              {r.assessment.dispatchNgn > 0 && <div className="flex justify-between"><span>Dispatch</span><span>{formatNGN(r.assessment.dispatchNgn)}</span></div>}
              <div className="flex justify-between border-t hairline pt-2 mt-2"><span className="label-tech">Total</span><span className="font-display font-bold text-xl text-primary">{formatNGN(r.totalNgn)}</span></div>
              {r.agreedPriceNgn != null && r.agreedPriceNgn !== r.totalNgn && <div className="flex justify-between"><span>Agreed price</span><span className="font-display font-bold text-primary">{formatNGN(r.agreedPriceNgn)}</span></div>}
              {r.assessment.notes && <p className="text-muted-foreground text-xs pt-1">Note from Oketex: {r.assessment.notes}</p>}
            </div>
          </div>)}
          {r.status === "Priced" && (<div className="border border-primary/50 bg-primary/5 p-4">
            <p className="font-display font-semibold uppercase">Approve this price to proceed</p>
            <p className="font-tech text-xs text-muted-foreground mt-1">Approving tells Oketex to assign a trusted pro at {formatNGN(r.agreedPriceNgn ?? r.totalNgn)}. Nothing is charged here unless you choose to pay online.</p>
            {!r.customerPhone && <input value={approvePhone} onChange={e => setApprovePhone(e.target.value)} placeholder="Phone number you used for this request" className="field-tech font-tech mt-3" aria-label="Your phone number" />}
            <div className="flex flex-wrap gap-3 mt-3">
              <Button className="rounded-none font-display uppercase" onClick={() => void approveSnap(r)}>Approve price</Button>
              {apiLiveSync() ? <Button variant="outline" className="rounded-none font-display uppercase" onClick={() => void paySnap(r)}>Pay online (Paystack)</Button>
                : <a href={businessWaLink(`Hello ${BUSINESS.name}, I approve the price for my Snap & Send request ${r.code} (${formatNGN(r.agreedPriceNgn ?? r.totalNgn)}).`)} target="_blank" rel="noreferrer" className="inline-flex items-center border hairline font-display font-semibold uppercase text-sm px-4 h-10 hover:border-primary hover:text-primary">Confirm on WhatsApp</a>}
            </div>
          </div>)}
          {r.assignedPartnerCode && (<div className="border hairline p-4">
            <p className="label-tech mb-2">Your assigned pro</p>
            <p className="font-display font-bold uppercase text-lg">{pro?.businessName || r.assignedPartnerName || r.assignedPartnerCode}</p>
            <p className="font-tech text-xs text-muted-foreground mt-1">{pro ? `${pro.trades.join(" · ")}${pro.location ? ` · ${pro.location}` : ""}` : ""}{rating.count ? ` · ${starsText(rating.avg)} ${rating.avg} (${rating.count} review${rating.count === 1 ? "" : "s"})` : " · No reviews yet"}</p>
            {r.agreedPriceNgn != null && <p className="font-tech text-xs mt-2">Agreed price: <b className="text-primary">{formatNGN(r.agreedPriceNgn)}</b></p>}
            <Link to={`/partners/${r.assignedPartnerCode}`} className="font-tech text-xs text-primary mt-2 inline-block">View pro profile</Link>
          </div>)}
          <div>
            <p className="label-tech mb-3">Progress</p>
            <div className="space-y-3">{r.timeline.map((e, i) => (<div key={i} className="flex gap-3">
              <span className={`font-tech text-[10px] uppercase tracking-widest border px-2 py-0.5 h-fit shrink-0 ${e.by === "partner" ? "border-primary text-primary" : e.by === "admin" ? "border-sky-500/50 text-sky-400" : "hairline text-muted-foreground"}`}>{e.by === "admin" ? "Oketex" : e.by}</span>
              <div className="min-w-0"><p className="text-sm">{e.text}</p><p className="font-tech text-[11px] text-muted-foreground">{new Date(e.ts).toLocaleString("en-NG")}</p>
              {e.photo && <button onClick={() => setSnapPhoto(e.photo!)} className="block mt-2 cursor-pointer"><img src={e.photo} alt="Progress update" className="max-h-40 w-auto border hairline" /></button>}</div>
            </div>))}</div>
          </div>
        </div></div>); })}
    </>)}
    <p className="font-tech text-xs text-muted-foreground mt-8">Prefer to call? <a className="text-primary" href={`tel:${getBusiness().phone.replace(/\s/g, "")}`}>{getBusiness().phone}</a></p>
  </div>
  {snapPhoto && <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setSnapPhoto(null)}><img src={snapPhoto} alt="Enlarged snap" className="max-h-[90vh] max-w-full object-contain" /></div>}
  </div>);
}
