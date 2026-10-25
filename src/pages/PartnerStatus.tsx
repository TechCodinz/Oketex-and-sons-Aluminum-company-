import { useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router";
import { BadgeCheck, CreditCard, Inbox, MessageCircle, Package, Search, Star } from "lucide-react";
import { PageHead, StatusBadge } from "@/components/StatusBadge";
import { formatNGN } from "@/lib/money";
import { findPartnerOwnerAsync, getLeadsForPartnerAsync, getOffersAsync, partnerAvailable, setPartnerAvailabilityAsync, type Lead, type Offer, type Partner } from "@/lib/partnerStorage";
import { getJobsAsync, getPartnerBidsAsync, placeBidAsync, budgetLabel, type Job, type Bid } from "@/lib/jobs";
import { getSnapRequestsForPartnerAsync, snapProgressAsync, snapPartnerStatusAsync, compressImageFile, SNAP_INTENT_LABEL, type SnapRequest } from "@/lib/snapRequests";
import { getSupplyForPartnerAsync, quoteSupplyAsync, supplyOutcome, type SupplyRequest } from "@/lib/supply";
import { MapCard } from "@/components/MapCard";
import { notify } from "@/lib/notify";
import { paymentsApi } from "@/lib/api";
import {  } from "@/data/partnerTerms";
import { getPartnerTerms, businessWaLink } from "@/lib/settings";
import { Button } from "@/components/ui/button";

export default function PartnerStatus() {
  const TERMS = getPartnerTerms();
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [searched, setSearched] = useState("");
  const [partner, setPartner] = useState<Partner | undefined>(undefined);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [openJobs, setOpenJobs] = useState<Job[]>([]);
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [bidForms, setBidForms] = useState<Record<string, { amount: string; days: string; note: string }>>({});
  const [payEmail, setPayEmail] = useState("");
  const [snapJobs, setSnapJobs] = useState<SnapRequest[]>([]);
  const [snapForms, setSnapForms] = useState<Record<string, { text: string; photo: string | null }>>({});
  const loadSnapJobs = async (p: Partner) => setSnapJobs(await getSnapRequestsForPartnerAsync(p.code));
  const [supplyReqs, setSupplyReqs] = useState<SupplyRequest[]>([]);
  const [supplyForms, setSupplyForms] = useState<Record<string, { price: string; days: string; note: string }>>({});
  const loadSupply = async (p: Partner) => setSupplyReqs(p.role === "pro" ? [] : await getSupplyForPartnerAsync(p, p.phone));
  const submitSupplyQuote = async (r: SupplyRequest) => {
    if (!partner) return;
    const f = supplyForms[r.code] ?? { price: "", days: "", note: "" };
    const unit = parseFloat(f.price) || 0;
    if (unit <= 0) { toast.error("Enter your unit price"); return; }
    const res = await quoteSupplyAsync(r.code, partner, partner.phone, { unitPriceNgn: unit, leadDays: parseInt(f.days) || 0, note: f.note.trim() });
    if (res.error || !res.request) { toast.error(res.error || "Quote failed"); return; }
    void notify({ templateKey: "supply_quoted", audience: "admin", refCode: r.code, vars: { code: r.code, partner: partner.businessName, amount: formatNGN(unit * r.qty) } });
    await loadSupply(partner);
    toast.success(`Quote sent — ${formatNGN(unit)} × ${r.qty} ${r.unit} = ${formatNGN(unit * r.qty)}. Oketex admin compares quotes privately.`);
  };
  const toggleAvailability = async () => {
    if (!partner) return;
    const next = !partnerAvailable(partner);
    await setPartnerAvailabilityAsync(partner.code, partner.phone, next);
    setPartner({ ...partner, available: next });
    toast.success(next ? "You are now AVAILABLE for Snap & Send assignments" : "You are now UNAVAILABLE — Oketex will not assign you new Snap & Send jobs");
  };
  const postSnapUpdate = async (r: SnapRequest) => {
    if (!partner) return;
    const f = snapForms[r.code] ?? { text: "", photo: null };
    if (!f.text.trim() && !f.photo) { toast.error("Write an update or attach a photo"); return; }
    await snapProgressAsync(r.code, partner.code, f.text.trim(), f.photo || undefined);
    setSnapForms({ ...snapForms, [r.code]: { text: "", photo: null } });
    await loadSnapJobs(partner);
    toast.success("Update posted — the customer sees it in their tracking page");
  };
  const snapStatus = async (r: SnapRequest, action: "start" | "complete") => {
    if (!partner) return;
    await snapPartnerStatusAsync(r.code, partner.code, action);
    if (action === "complete") void notify({ templateKey: "snap_completed", audience: "admin", refCode: r.code, vars: { code: r.code, partner: partner.businessName, name: r.customerName, phone: r.customerPhone } });
    await loadSnapJobs(partner);
    toast.success(action === "start" ? "Job started" : "Job marked complete — thank you");
  };
  // API-first OWNER lookup (server record when the backend is live, local
  // otherwise) — the full record is released only against the phone number
  // the partner registered with (Admin-Routing rule).
  const lookup = async (c: string) => {
    setSearched(c);
    const p = c.trim() ? await findPartnerOwnerAsync(c, phone) : undefined;
    if (c.trim() && !p) toast.error("No match — check your partner code and use the phone number you registered with.");
    setPartner(p);
    if (!p) { setLeads([]); setOffers([]); setOpenJobs([]); setMyBids([]); setSnapJobs([]); setSupplyReqs([]); return; }
    setLeads(await getLeadsForPartnerAsync(p.code));
    if (p.status === "approved") {
      const all = await getOffersAsync();
      const want = p.role === "pro" ? "pros" : p.role === "seller" ? "sellers" : "both";
      setOffers(all.filter(o => o.audience === "all" || o.audience === want || want === "both"));
      setOpenJobs(await getJobsAsync());
      setMyBids(await getPartnerBidsAsync(p.code));
      await loadSnapJobs(p);
      await loadSupply(p);
    } else { setOffers([]); setOpenJobs([]); setMyBids([]); setSnapJobs([]); setSupplyReqs([]); }
  };
  const submitBid = async (job: Job) => {
    if (!partner) return;
    const f = bidForms[job.code] ?? { amount: "", days: "", note: "" };
    const amount = parseFloat(f.amount) || 0;
    if (amount <= 0) { toast.error("Enter your bid amount"); return; }
    const bid = await placeBidAsync({ jobCode: job.code, partnerCode: partner.code, partnerName: partner.businessName, amount, days: parseInt(f.days) || 0, note: f.note.trim() });
    setMyBids(await getPartnerBidsAsync(partner.code));
    toast.success(`Bid placed on ${job.code} at ${formatNGN(bid.amount)} — the customer sees it in their tracking page`);
  };
  const payUpgrade = async (purpose: "partner_verification" | "partner_featured", amountNgn: number) => {
    if (!partner) return;
    const email = (partner.email || payEmail).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Enter your email below first — Paystack sends the receipt there."); return; }
    const init = await paymentsApi.initialize({ email, amountNgn, purpose, refId: partner.code });
    if (init.enabled && init.authorizationUrl) { window.location.href = init.authorizationUrl; return; }
    if (init.enabled) toast.error(init.error || "Payment could not start — try WhatsApp activation.");
    else toast.message("Online payment isn't enabled yet — use WhatsApp activation below.");
  };

  const upgradeWa = (kind: "Verified badge" | "Featured placement", fee: string) =>
    businessWaLink(`Hello Oketex, I want to activate an upgrade on the Partner Network.\n\nBusiness: ${partner?.businessName}\nPartner code: ${partner?.code}\nUpgrade: ${kind} (${fee})\n\nPlease confirm payment details.`);

  return (<div>
    <PageHead kicker="Partner Network" title="Partner Status & Dashboard" lead="Enter your partner code (PRT-…) and the phone number you registered with to see your approval status, the leads Oketex has sent you, supply offers, and upgrade options. Your contact details are never published — customers reach you only through Oketex admin." />
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <div className="border hairline bg-card px-5 py-4 mb-6 max-w-3xl">
        <p className="font-tech text-[11px] text-muted-foreground"><span className="text-primary uppercase tracking-widest">Network rule — </span>All customers and jobs that come through Oketex are served through Oketex admin. Contact details are exchanged by admin when a job is assigned. Taking platform customers off-platform to avoid commission may lead to removal from the network.</p>
      </div>
      <div className="flex gap-3 max-w-xl flex-wrap">
        <input value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === "Enter" && void lookup(code)} placeholder="PRT-2026-XXXXX" className="field-tech font-tech uppercase flex-1 min-w-44" aria-label="Partner code" />
        <input value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && void lookup(code)} placeholder="PHONE YOU REGISTERED WITH" className="field-tech font-tech flex-1 min-w-44" aria-label="Phone number you registered with" />
        <Button className="rounded-none font-display uppercase shrink-0 h-12" onClick={() => void lookup(code)}><Search className="h-4 w-4 mr-2" /> Look up</Button>
      </div>

      {searched && !partner && <div className="border hairline py-14 text-center mt-8"><p className="font-tech text-sm uppercase tracking-widest text-muted-foreground">No partner matched that code + phone — use the exact phone number from your application, or <Link to="/join" className="text-primary">register here</Link>.</p></div>}

      {partner && (
        <div className="mt-8 space-y-8">
          <section className="border hairline bg-card p-6 flex flex-wrap gap-6 items-center justify-between">
            <div>
              <p className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground">Partner · {partner.code}</p>
              <h2 className="font-display font-bold uppercase text-3xl mt-1 flex items-center gap-2">{partner.businessName}{partner.verified && <BadgeCheck className="h-6 w-6 text-primary" />}{partner.featured && <Star className="h-5 w-5 text-primary" />}</h2>
              <p className="font-tech text-xs text-muted-foreground mt-1">{partner.role === "pro" ? `Pro — ${partner.trades.join(", ")}` : partner.role === "seller" ? `Seller — ${partner.categories.join(", ")}` : `Pro + Seller — ${[...partner.trades, ...partner.categories].join(", ")}`} · {partner.location}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={partner.status === "approved" ? "delivered" : partner.status === "pending" ? "pending" : "cancelled"} />
              {partner.status === "approved" && (<button onClick={() => void toggleAvailability()} className={`font-tech text-[11px] border px-3 py-2 cursor-pointer ${partnerAvailable(partner) ? "border-emerald-500/60 text-emerald-400" : "hairline text-muted-foreground"}`}>Available for assignments: <b>{partnerAvailable(partner) ? "ON" : "OFF"}</b> — tap to change</button>)}
            </div>
          </section>

          {partner.status === "approved" && (
            <section className="border hairline bg-card p-5">
              <p className="label-tech mb-2">How work reaches you — both directions, through the office</p>
              <p className="font-tech text-xs text-muted-foreground leading-relaxed">{partner.role !== "seller" && <>Jobs are ASSIGNED to you by Oketex admin — tracked leads below, job-board awards and Snap &amp; Send dispatches. </>}{partner.role !== "pro" && <>Customer orders are routed to you by admin as leads — and when the Oketex factory itself needs materials or equipment, a Supply Request lands in your inbox below for a private quote. </>}Nothing runs direct: admin coordinates every deal, so both sides stay protected.</p>
            </section>
          )}

          {partner.status === "pending" && (
            <section className="border border-yellow-500/40 bg-yellow-500/5 p-6">
              <h3 className="font-display font-bold uppercase text-xl">Application under review</h3>
              <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><span className="text-primary font-tech">01</span> — The Oketex team checks your details (usually 1–2 working days).</li>
                <li><span className="text-primary font-tech">02</span> — Once approved, your listing appears in the public directory and leads start flowing here.</li>
                <li><span className="text-primary font-tech">03</span> — Keep this code safe. Speed things up by messaging us on WhatsApp with your code.</li>
              </ol>
            </section>
          )}
          {partner.status === "rejected" && (
            <section className="border border-red-500/40 bg-red-500/5 p-6">
              <h3 className="font-display font-bold uppercase text-xl">Application not approved</h3>
              <p className="text-sm text-muted-foreground mt-2">This application was not approved. Contact Oketex on WhatsApp with your partner code to discuss what is needed, or submit a fresh application with corrected details.</p>
            </section>
          )}

          {partner.status === "approved" && (<>
            <section>
              <h3 className="font-display font-bold uppercase text-2xl mb-4 flex items-center gap-2"><Inbox className="h-5 w-5 text-primary" /> Your leads ({leads.length})</h3>
              {!leads.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-5">No leads yet. Leads appear here when customers request you through your directory listing. Tip: a complete profile, the Verified badge and Featured placement all lift your lead count.</p>
                : <div className="border hairline">{leads.map((l, i) => (
                  <div key={l.id} className={`px-5 py-4 flex flex-wrap gap-4 justify-between items-center ${i > 0 ? "border-t hairline" : ""}`}>
                    <div><p className="font-tech font-semibold">{l.id} · {l.type === "job" ? "Job" : "Supply"} — {l.customerName} ({l.customerPhone})</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{l.description}</p>
                      <p className="font-tech text-[11px] text-muted-foreground">{new Date(l.createdAt).toLocaleString("en-NG")}{l.estValueNgn ? ` · Est. value ${formatNGN(l.estValueNgn)} · Commission ${l.commissionPct}% = ${formatNGN(l.commissionNgn)} (payable if won)` : ""}</p></div>
                    <StatusBadge status={l.status} />
                  </div>))}</div>}
            </section>

            <section>
              <h3 className="font-display font-bold uppercase text-2xl mb-4">Assigned Snap Jobs ({snapJobs.length})</h3>
              {!snapJobs.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-5">No Snap &amp; Send jobs assigned to you yet. When a customer sends a photo request and Oketex assigns it to you at an agreed price, it appears here with the site map. Keep "Available for assignments" ON (top of this page) to be picked.</p>
                : <div className="space-y-4">{snapJobs.map(r => { const f = snapForms[r.code] ?? { text: "", photo: null }; const firstName = r.customerName.split(" ")[0]; return (
                  <div key={r.code} className="border hairline bg-card p-5">
                    <div className="flex flex-wrap justify-between gap-3">
                      <div><p className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground">{r.code} · {SNAP_INTENT_LABEL[r.intent] || r.intent} · {r.urgency}</p>
                      <p className="font-display font-semibold uppercase mt-0.5">{r.description.slice(0, 90)}{r.description.length > 90 ? "…" : ""}</p>
                      <p className="font-tech text-[11px] text-muted-foreground mt-1">Customer: {firstName} · <a className="text-primary" href={`tel:${r.customerPhone.replace(/\s/g, "")}`}>{r.customerPhone}</a> · Site: {r.address}</p>
                      {r.agreedPriceNgn != null && <p className="font-tech text-[11px] mt-1">Agreed price: <b className="text-primary">{formatNGN(r.agreedPriceNgn)}</b></p>}</div>
                      <StatusBadge status={r.status} />
                    </div>
                    {(r.photo || r.videoPoster) && <img src={(r.photo || r.videoPoster) as string} alt="Customer snap" className="max-h-52 w-auto border hairline mt-4" />}
                    <div className="mt-4"><MapCard geo={r.geo} address={r.address} /></div>
                    {r.timeline.length > 0 && <div className="mt-4 border-t hairline pt-3 space-y-2">{r.timeline.map((e, i) => (<div key={i} className="flex gap-3 text-sm"><span className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground shrink-0 w-16">{e.by === "admin" ? "Oketex" : e.by}</span><div><p>{e.text}</p><p className="font-tech text-[11px] text-muted-foreground">{new Date(e.ts).toLocaleString("en-NG")}</p>{e.photo && <img src={e.photo} alt="Update" className="max-h-32 w-auto border hairline mt-1" />}</div></div>))}</div>}
                    {!["Completed", "Declined"].includes(r.status) && (<div className="mt-4 border-t hairline pt-4">
                      <div className="flex flex-wrap gap-2">
                        {r.status === "Assigned" && <Button className="rounded-none font-display uppercase h-11" onClick={() => void snapStatus(r, "start")}>Start job</Button>}
                        {r.status === "In Progress" && <Button className="rounded-none font-display uppercase h-11" onClick={() => void snapStatus(r, "complete")}>Mark complete</Button>}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-3 items-end">
                        <div className="flex-1 min-w-52"><label className="label-tech" htmlFor={`su-${r.code}`}>Progress update for the customer</label><input id={`su-${r.code}`} className="field-tech" placeholder="e.g. Arrived on site, old sheets removed…" value={f.text} onChange={e => setSnapForms({ ...snapForms, [r.code]: { ...f, text: e.target.value } })} /></div>
                        <label className="inline-flex items-center gap-2 border hairline font-display font-semibold uppercase text-xs px-4 h-11 cursor-pointer hover:border-primary hover:text-primary">Add photo<input type="file" accept="image/*" capture="environment" className="hidden" onChange={async e => { const file = e.target.files?.[0]; if (file) { try { const dataUrl = await compressImageFile(file); setSnapForms({ ...snapForms, [r.code]: { ...f, photo: dataUrl } }); toast.success("Photo attached"); } catch (err: any) { toast.error(String(err?.message || err)); } } e.target.value = ""; }} /></label>
                        <Button variant="outline" className="rounded-none font-display uppercase h-11" onClick={() => void postSnapUpdate(r)}>Post update</Button>
                      </div>
                      {f.photo && <img src={f.photo} alt="Attached update" className="max-h-32 w-auto border hairline mt-3" />}
                    </div>)}
                  </div>); })}</div>}
            </section>

            <section>
              <h3 className="font-display font-bold uppercase text-2xl mb-4">Jobs to bid ({openJobs.length} open)</h3>
              {!openJobs.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-5">No open jobs on the board right now. Customers post jobs from the <Link to="/jobs" className="text-primary">Jobs Board</Link> — check back soon.</p>
                : <div className="space-y-4">{openJobs.map(j => { const mine = myBids.find(b => b.jobCode === j.code); const f = bidForms[j.code] ?? { amount: "", days: "", note: "" }; return (
                  <div key={j.code} className="border hairline bg-card p-5">
                    <div className="flex flex-wrap justify-between gap-3"><div><p className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground">{j.code} · {j.trade}</p><p className="font-display font-semibold uppercase mt-0.5">{j.title}</p><p className="text-sm text-muted-foreground mt-1 max-w-2xl">{j.description}</p><p className="font-tech text-[11px] text-muted-foreground mt-1">{j.location} · Budget {budgetLabel(j)}</p></div>
                    {mine && <span className={`font-tech text-[10px] uppercase tracking-widest border px-2 py-1 h-fit ${mine.status === "Accepted" ? "border-emerald-500/60 text-emerald-400" : mine.status === "Rejected" ? "border-red-500/50 text-red-400" : "border-primary text-primary"}`}>Your bid: {formatNGN(mine.amount)} · {mine.status}</span>}</div>
                    {mine?.status !== "Accepted" && (<div className="flex flex-wrap gap-3 mt-4 items-end">
                      <div><label className="label-tech" htmlFor={`ba-${j.code}`}>Your price (₦)</label><input id={`ba-${j.code}`} inputMode="numeric" className="field-tech font-tech !w-40" placeholder="850,000" value={f.amount} onChange={e => setBidForms({ ...bidForms, [j.code]: { ...f, amount: e.target.value } })} /></div>
                      <div><label className="label-tech" htmlFor={`bd-${j.code}`}>Days to finish</label><input id={`bd-${j.code}`} inputMode="numeric" className="field-tech font-tech !w-28" placeholder="14" value={f.days} onChange={e => setBidForms({ ...bidForms, [j.code]: { ...f, days: e.target.value } })} /></div>
                      <div className="flex-1 min-w-44"><label className="label-tech" htmlFor={`bn-${j.code}`}>Note (optional)</label><input id={`bn-${j.code}`} className="field-tech font-tech" placeholder="Materials included, warranty…" value={f.note} onChange={e => setBidForms({ ...bidForms, [j.code]: { ...f, note: e.target.value } })} /></div>
                      <Button className="rounded-none font-display uppercase h-11" onClick={() => void submitBid(j)}>{mine ? "Update bid" : "Place bid"}</Button>
                    </div>)}
                    {mine?.status === "Pending" && <p className="font-tech text-[10px] text-muted-foreground mt-2">You can update a pending bid any time — the customer only ever sees your latest price.</p>}
                  </div>); })}</div>}
              {myBids.length > 0 && <p className="font-tech text-[11px] text-muted-foreground mt-3">Your bid history: {myBids.map(b => `${b.jobCode} ${formatNGN(b.amount)} (${b.status})`).join(" · ")}</p>}
            </section>

            <section>
              <h3 className="font-display font-bold uppercase text-2xl mb-4 flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Supply offers for you ({offers.length})</h3>
              {!offers.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-5">No offers right now. Oketex pushes bulk-supply offers (sheets, tiles, accessories…) to partners here — check back soon.</p>
                : <div className="grid md:grid-cols-2 gap-4">{offers.map(o => (
                  <div key={o.id} className="border hairline bg-card p-5">
                    <div className="flex justify-between gap-3"><p className="font-semibold">{o.productName}</p><span className="font-display font-bold text-lg text-primary shrink-0">{formatNGN(o.priceNgn)} <span className="font-tech text-[10px] text-muted-foreground font-normal">{o.unit}</span></span></div>
                    {o.note && <p className="text-sm text-muted-foreground mt-1">{o.note}</p>}
                    <p className="font-tech text-[10px] text-muted-foreground mt-2">Pushed by Oketex · {new Date(o.createdAt).toLocaleDateString("en-NG")}{o.audience !== "all" ? ` · For ${o.audience}` : ""}</p>
                    <a href={businessWaLink(`Hello Oketex, I want to take this Partner Network offer:\n\n${o.productName} — ${formatNGN(o.priceNgn)} ${o.unit}\nPartner: ${partner.businessName} (${partner.code})`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-3 font-tech text-xs uppercase tracking-widest text-primary hover:underline"><MessageCircle className="h-3.5 w-3.5" /> Take offer on WhatsApp</a>
                  </div>))}</div>}
            </section>

            {partner.role !== "pro" && (
            <section>
              <h3 className="font-display font-bold uppercase text-2xl mb-1">Supply Requests — Oketex is buying ({supplyReqs.length})</h3>
              <p className="font-tech text-[11px] text-muted-foreground mb-4">The factory raises these when it needs materials or equipment. Quote your unit price — the total is computed from the quantity. Your quote is visible ONLY to Oketex admin; you never see other partners' prices, and they never see yours. No commission on procurement.</p>
              {!supplyReqs.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-5">No open supply requests for you right now — targeted requests and broadcasts to approved sellers appear here.</p>
              : <div className="space-y-4">{supplyReqs.map(r => { const outcome = supplyOutcome(r, partner.code); const mine = r.quotes.find(q => q.partnerCode === partner.code); const f = supplyForms[r.code] ?? { price: "", days: "", note: "" }; return (
                <div key={r.code} className="border hairline bg-card p-5">
                  <div className="flex flex-wrap gap-3 justify-between items-start">
                    <div><p className="font-tech font-semibold">{r.code} — {r.type === "hire" ? "HIRE" : "BUY"} · {r.item}</p>
                    <p className="font-tech text-[11px] text-muted-foreground mt-1">{r.qty} {r.unit}{r.spec ? ` · ${r.spec}` : ""}{r.neededBy ? ` · needed by ${r.neededBy}` : ""}{r.note ? ` · ${r.note}` : ""}</p></div>
                    <span className={`font-tech text-[10px] uppercase tracking-widest border px-2 py-0.5 ${outcome === "Won" ? "border-emerald-500/60 text-emerald-400" : outcome === "Lost" ? "hairline text-muted-foreground" : "hairline"}`}>{outcome}</span>
                  </div>
                  {mine ? <p className="font-tech text-xs mt-3">Your quote: <b>{formatNGN(mine.unitPriceNgn)}</b> per {r.unit} × {r.qty} = <b>{formatNGN(mine.totalNgn)}</b>{mine.leadDays ? ` · ${mine.leadDays} day(s) lead` : ""}{mine.note ? ` · ${mine.note}` : ""} — you can re-quote below while the request is open.</p>
                  : <p className="font-tech text-xs text-muted-foreground mt-3">You have not quoted yet.</p>}
                  {["Open", "Quoted"].includes(r.status) && (<div className="flex flex-wrap gap-3 items-end mt-4">
                    <div className="w-44"><label className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Unit price ₦</label><input type="number" min={0} value={f.price} onChange={e => setSupplyForms({ ...supplyForms, [r.code]: { ...f, price: e.target.value } })} className="field-tech font-tech" /></div>
                    <div className="w-32"><label className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Lead days</label><input type="number" min={0} value={f.days} onChange={e => setSupplyForms({ ...supplyForms, [r.code]: { ...f, days: e.target.value } })} className="field-tech font-tech" /></div>
                    <div className="flex-1 min-w-52"><label className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Note</label><input value={f.note} onChange={e => setSupplyForms({ ...supplyForms, [r.code]: { ...f, note: e.target.value } })} className="field-tech" placeholder="Delivery terms, brand, warranty…" /></div>
                    <Button className="rounded-none font-display uppercase h-11" onClick={() => void submitSupplyQuote(r)}>{mine ? "Update quote" : "Send quote"}</Button>
                  </div>)}
                </div>); })}</div>}
            </section>
            )}

            <section>
              <h3 className="font-display font-bold uppercase text-2xl mb-4">Grow — upgrades (current launch terms)</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border hairline bg-card p-6">
                  <BadgeCheck className="h-8 w-8 text-primary" />
                  <h4 className="font-display font-bold uppercase text-xl mt-3">Verified badge</h4>
                  <p className="font-display font-bold text-3xl text-primary mt-1">{formatNGN(TERMS.verificationFeeNgn)} <span className="font-tech text-xs text-muted-foreground font-normal">one-time</span></p>
                  <p className="text-sm text-muted-foreground mt-2">Identity & business checks by Oketex, a Verified badge on your listing and a trust lift with customers.</p>
                  {partner.verified ? <p className="font-tech text-xs text-primary mt-4 uppercase tracking-widest">Active on your listing ✓</p>
                    : <div className="mt-4 flex flex-wrap gap-2">{!partner.email && <input value={payEmail} onChange={e => setPayEmail(e.target.value)} placeholder="Your email for the receipt" className="field-tech !w-56" aria-label="Email for payment receipt" />}<button onClick={() => void payUpgrade("partner_verification", TERMS.verificationFeeNgn)} className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-display font-semibold uppercase tracking-wider px-5 h-11 cursor-pointer hover:bg-primary/90"><CreditCard className="h-4 w-4" /> Pay with Paystack</button><a href={upgradeWa("Verified badge", `${formatNGN(TERMS.verificationFeeNgn)} one-time`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border hairline font-display font-semibold uppercase tracking-wider px-5 h-11 hover:text-primary"><MessageCircle className="h-4 w-4" /> Or WhatsApp</a></div>}
                  <p className="font-tech text-[10px] text-muted-foreground mt-3">Pay online with Paystack when enabled — the badge activates automatically on payment. Otherwise arrange on WhatsApp and the Oketex admin activates it after confirmation.</p>
                </div>
                <div className="border hairline bg-card p-6">
                  <Star className="h-8 w-8 text-primary" />
                  <h4 className="font-display font-bold uppercase text-xl mt-3">Featured placement</h4>
                  <p className="font-display font-bold text-3xl text-primary mt-1">{formatNGN(TERMS.featuredFeeNgn)} <span className="font-tech text-xs text-muted-foreground font-normal">/ month</span></p>
                  <p className="text-sm text-muted-foreground mt-2">Featured ribbon on your card and first position in the directory while active — more eyes, more leads.</p>
                  {partner.featured ? <p className="font-tech text-xs text-primary mt-4 uppercase tracking-widest">Active on your listing ✓</p>
                    : <div className="mt-4 flex flex-wrap gap-2">{!partner.email && <input value={payEmail} onChange={e => setPayEmail(e.target.value)} placeholder="Your email for the receipt" className="field-tech !w-56" aria-label="Email for payment receipt" />}<button onClick={() => void payUpgrade("partner_featured", TERMS.featuredFeeNgn)} className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-display font-semibold uppercase tracking-wider px-5 h-11 cursor-pointer hover:bg-primary/90"><CreditCard className="h-4 w-4" /> Pay with Paystack</button><a href={upgradeWa("Featured placement", `${formatNGN(TERMS.featuredFeeNgn)} per month`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border hairline font-display font-semibold uppercase tracking-wider px-5 h-11 hover:text-primary"><MessageCircle className="h-4 w-4" /> Or WhatsApp</a></div>}
                  <p className="font-tech text-[10px] text-muted-foreground mt-3">Pay online with Paystack when enabled — placement activates automatically on payment. Otherwise arrange on WhatsApp and the Oketex admin activates it after confirmation.</p>
                </div>
              </div>
            </section>
          </>)}
        </div>
      )}
    </div>
  </div>);
}
