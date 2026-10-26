import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, BadgeCheck, MapPin, MessageCircle, Star, ShieldCheck } from "lucide-react";
import { PageHead } from "@/components/StatusBadge";
import { formatNGN } from "@/lib/money";
import { findPartner, findPartnerAsync, addLeadAsync, toPublicPartner, partnerKindTags, type Partner } from "@/lib/partnerStorage";
import {  } from "@/data/partnerTerms";
import { getPartnerTerms, businessWaLink, getBusiness } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { addReviewAsync, reviewsForPartner, reviewSummaryFor, starsText, type Review } from "@/lib/reviews";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** Reviews block (Phase 6): published reviews + average from real reviews
 *  only; the form demands a reference code so reviews stay tied to real work. */
function PartnerReviews({ partner }: { partner: Partner }) {
  const [list, setList] = useState<Review[]>(() => reviewsForPartner(partner.code));
  const summary = reviewSummaryFor(partner.code);
  const [rf, setRf] = useState({ name: "", rating: 5, text: "", refCode: "" });
  const submit = async () => {
    if (rf.name.trim().length < 2) return toast.error("Enter your name");
    if (rf.refCode.trim().length < 3) return toast.error("Enter your reference code — the lead, order or job code from your request");
    if (rf.text.trim().length < 3) return toast.error("Write a few words about the work");
    const r = await addReviewAsync({ partnerCode: partner.code, customerName: rf.name.trim(), rating: rf.rating, text: rf.text.trim(), refCode: rf.refCode.trim() });
    setList(reviewsForPartner(partner.code));
    setRf({ name: "", rating: 5, text: "", refCode: "" });
    toast.success(`Thank you — your ${r.rating}★ review is published`);
  };
  return (
    <section className="border hairline bg-card p-6">
      <h2 className="font-display font-bold uppercase text-2xl mb-1">Customer reviews</h2>
      {summary.count > 0
        ? <p className="font-tech text-sm"><span className="text-primary">{starsText(summary.avg)}</span> <span className="font-semibold">{summary.avg.toFixed(1)}</span> average · {summary.count} review{summary.count === 1 ? "" : "s"}</p>
        : <p className="font-tech text-sm text-muted-foreground">No reviews yet — be the first customer to review this partner after a job.</p>}
      <div className="mt-5 space-y-4">
        {list.map(r => (
          <div key={r.id} className="border-t hairline pt-4">
            <p className="font-tech text-sm"><span className="text-primary">{starsText(r.rating)}</span> <span className="font-semibold">{r.customerName}</span> <span className="text-muted-foreground text-[11px]">· {new Date(r.createdAt).toLocaleDateString("en-NG")} · ref {r.refCode}</span></p>
            <p className="text-sm text-muted-foreground mt-1">{r.text}</p>
          </div>
        ))}
      </div>
      <div className="border-t hairline mt-6 pt-5">
        <p className="label-tech mb-3">Review this {partner.role === "pro" ? "pro" : "seller"}</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label-tech" htmlFor="rv-name">Your name</label><input id="rv-name" className="field-tech" value={rf.name} onChange={e => setRf({ ...rf, name: e.target.value })} placeholder="Full name" /></div>
          <div><label className="label-tech" htmlFor="rv-ref">Reference code (required)</label><input id="rv-ref" className="field-tech font-tech" value={rf.refCode} onChange={e => setRf({ ...rf, refCode: e.target.value })} placeholder="LED-…, OKX-… or JB-…" /></div>
        </div>
        <div className="mt-4"><label className="label-tech">Your rating</label><div className="flex gap-1">{[1, 2, 3, 4, 5].map(n => (<button key={n} onClick={() => setRf({ ...rf, rating: n })} aria-label={`${n} stars`} className={`text-2xl cursor-pointer ${n <= rf.rating ? "text-primary" : "text-muted-foreground"}`}>★</button>))}</div></div>
        <div className="mt-4"><label className="label-tech" htmlFor="rv-text">How was the work?</label><textarea id="rv-text" rows={3} className="field-tech resize-none" value={rf.text} onChange={e => setRf({ ...rf, text: e.target.value })} placeholder="Quality, punctuality, value for money…" /></div>
        <Button className="rounded-none font-display uppercase h-11 mt-4" onClick={() => void submit()}>Publish review</Button>
        <p className="font-tech text-[10px] text-muted-foreground mt-3">We ask for a reference code so reviews stay tied to real jobs and orders through Oketex. Reviews publish under your name; the Oketex admin can hide anything abusive.</p>
      </div>
    </section>
  );
}

export default function PartnerProfile() {
  const TERMS = getPartnerTerms();
  const { code } = useParams<{ code: string }>();
  const [partner, setPartner] = useState<Partner | undefined>(() => { const p = code ? findPartner(code) : undefined; return p ? toPublicPartner(p) : undefined; });
  useEffect(() => { let on = true; if (code) findPartnerAsync(code).then(p => { if (on && p) setPartner(p); }); return () => { on = false; }; }, [code]);
  const [form, setForm] = useState({ name: "", phone: "", desc: "", value: "" });
  const [leadRef, setLeadRef] = useState<string | null>(null);

  if (!partner) return (<div><PageHead kicker="Partner Network" title="Partner not found" lead="Check the code — partner codes look like PRT-2026-XXXXX." /><div className="mx-auto max-w-7xl px-4 py-10"><Link to="/partners" className="text-primary font-tech text-sm">← Back to directory</Link></div></div>);
  if (partner.status !== "approved") return (<div><PageHead kicker="Partner Network" title={partner.businessName} lead={`This partner's listing is ${partner.status === "pending" ? "under review and" : ""} not yet approved by Oketex — it is not visible in the directory.`} /><div className="mx-auto max-w-7xl px-4 py-10"><Link to="/partners" className="text-primary font-tech text-sm">← Back to directory</Link></div></div>);

  const isSeller = partner.role === "seller";
  const isBoth = partner.role === "both";
  // Admin-Routing rule: NO direct customer↔partner ordering. Every product
  // order goes through the tracked Oketex lead form (right-hand panel) —
  // it lands in Admin and in the partner's leads inbox, commission
  // snapshotted. "Order through Oketex" just pre-fills that form.
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const orderThroughOketex = (productName: string, price: number, unit: string, id: string) => {
    const qty = Math.max(1, parseInt(qtys[id] || "1", 10) || 1);
    setForm(f => ({ ...f, desc: `Order through Oketex: ${productName} — ${formatNGN(price)} ${unit} × ${qty}` }));
    document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast.success("Added to the request form — add your name & phone, then send. Oketex admin coordinates the rest.");
  };

  const submitLead = async () => {
    if (form.name.trim().length < 2) return toast.error("Enter your full name");
    if (form.phone.replace(/\D/g, "").length < 10) return toast.error("Enter a valid phone number (at least 10 digits)");
    if (form.desc.trim().length < 5) return toast.error(`Describe the ${isSeller ? "supply request" : "job"}`);
    const est = Math.max(0, parseInt(form.value.replace(/\D/g, ""), 10) || 0);
    const lead = await addLeadAsync({ partnerCode: partner.code, partnerName: partner.businessName, type: isSeller ? "supply" : "job", customerName: form.name.trim(), customerPhone: form.phone.trim(), description: form.desc.trim(), estValueNgn: est });
    notify({ templateKey: "lead_created_admin", audience: "admin", refCode: lead.id, vars: { name: form.name.trim(), phone: form.phone.trim(), partner: partner.businessName } });
    // No direct customer→partner notification: admin sees the lead first
    // and coordinates; the partner sees it in their leads inbox.
    setLeadRef(lead.id);
  };

  const waNotify = businessWaLink(`Hello Oketex, I just sent a ${isSeller ? "supply request" : "job request"} to ${partner.businessName} (${partner.code}) on the Partner Network.\nReference: ${leadRef}\nName: ${form.name}\nPhone: ${form.phone}\nDetails: ${form.desc}`);

  return (<div>
    <PageHead kicker="Partner Network" title={partner.businessName} lead={`${isBoth ? "Approved pro + materials seller" : isSeller ? "Approved materials seller" : "Approved pro"} on the Oketex Partner Network.`} />
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <Link to="/partners" className="inline-flex items-center gap-2 font-tech text-xs uppercase tracking-widest text-muted-foreground hover:text-primary mb-8"><ArrowLeft className="h-4 w-4" /> Directory</Link>
      <div className="grid lg:grid-cols-[1fr_380px] gap-8">
        <div className="space-y-8">
          <section className="border hairline bg-card p-6 relative">
            {partner.featured && <span className="absolute -top-3 left-4 bg-primary text-primary-foreground font-tech text-[10px] uppercase tracking-widest px-2 py-1 inline-flex items-center gap-1"><Star className="h-3 w-3" /> Featured</span>}
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-tech text-[10px] uppercase tracking-widest px-2 py-1 border border-white/20">{isBoth ? "Pro + Seller" : isSeller ? "Seller" : "Pro"}</span>
              {partnerKindTags(partner).map(k => <span key={k} className="font-tech text-[10px] uppercase tracking-widest px-2 py-1 border border-primary/50 text-primary">{k}</span>)}
              {partner.sample && <span className="font-tech text-[10px] uppercase tracking-widest text-yellow-400 border border-yellow-500/40 px-2 py-1">Sample listing</span>}
              {partner.verified && <span className="inline-flex items-center gap-1 font-tech text-[10px] uppercase tracking-widest text-primary"><BadgeCheck className="h-4 w-4" /> Verified by Oketex</span>}
            </div>
            <h2 className="font-display font-bold uppercase text-3xl mt-4">{partner.businessName}</h2>
            <p className="font-tech text-sm text-muted-foreground mt-2 flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {partner.location}</p>
            <p className="font-tech text-xs text-muted-foreground">Serves: {partner.areas}{partner.yearsExperience ? ` · ${partner.yearsExperience} years experience` : ""}{partner.cacNumber ? ` · CAC ${partner.cacNumber}` : ""}</p>
            <p className="text-sm mt-4 leading-relaxed">{partner.bio}</p>
            <p className="border hairline px-4 py-3 font-tech text-[11px] text-muted-foreground mt-4">Contact goes through Oketex — order or request this {isSeller ? "seller" : "pro"} and admin will connect you. Partner numbers are never published, so every deal stays tracked and protected.</p>
            <div className="flex flex-wrap gap-1.5 mt-4">{(isBoth ? [...partner.trades, ...partner.categories] : isSeller ? partner.categories : partner.trades).map(t => <span key={t} className="border hairline px-2 py-1 font-tech text-[10px] uppercase tracking-wider">{t}</span>)}</div>
          </section>

          {(partner.supplyCapabilities || []).length > 0 && (
            <section className="border hairline bg-card p-6">
              <h2 className="font-display font-bold uppercase text-2xl mb-1">Can supply Oketex</h2>
              <p className="font-tech text-[11px] text-muted-foreground mb-4">This partner also supplies the Oketex factory — when admin raises a matching Supply Request, they are invited to quote privately.</p>
              <div className="flex flex-wrap gap-1.5">{(partner.supplyCapabilities || []).map(x => <span key={x} className="border hairline px-2 py-1 font-tech text-[10px] uppercase tracking-wider">{x}</span>)}</div>
            </section>
          )}

          <PartnerReviews partner={partner} />

          {(isSeller || isBoth) && partner.products.length > 0 && (
            <section className="border hairline bg-card p-6">
              <h2 className="font-display font-bold uppercase text-2xl mb-1">Storefront — {partner.products.length} products</h2>
              <p className="font-tech text-[11px] text-muted-foreground mb-5">Prices set by the seller. Every order goes through Oketex: send the request and Oketex admin coordinates with the seller and connects you — tracked as a network lead, referral terms apply. There is no direct-to-seller checkout, so your deal is always protected.</p>
              <div className="border-t hairline">{partner.products.map((p, i) => (
                <div key={p.id} className={`py-4 flex flex-wrap gap-4 items-center justify-between ${i > 0 ? "border-t hairline" : ""}`}>
                  <div><p className="font-semibold">{p.name}</p><p className="font-tech text-xs text-muted-foreground">{p.unit}</p></div>
                  <div className="flex items-center gap-3">
                    <span className="font-display font-bold text-xl text-primary">{formatNGN(p.priceNgn)}</span>
                    <label className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground">Qty <input aria-label={`Quantity for ${p.name}`} inputMode="numeric" className="field-tech !w-16 !py-1.5 ml-1" value={qtys[p.id] ?? "1"} onChange={e => setQtys({ ...qtys, [p.id]: e.target.value.replace(/[^0-9]/g, "") })} /></label>
                    <button onClick={() => orderThroughOketex(p.name, p.priceNgn, p.unit, p.id)} className="inline-flex items-center gap-1.5 border hairline px-3 py-2 font-tech text-xs cursor-pointer hover:border-primary hover:text-primary"><ShieldCheck className="h-3.5 w-3.5" /> Order through Oketex</button>
                  </div>
                </div>))}
              </div>
            </section>
          )}
        </div>

        <aside id="lead-form" className="border hairline bg-card h-fit lg:sticky lg:top-28 scroll-mt-28">
          <div className="px-6 py-4 border-b hairline"><span className="label-tech">{isSeller ? "Order through Oketex" : "Request this pro — via Oketex"}</span></div>
          <div className="px-6 py-6">
            {leadRef ? (
              <div className="text-center py-4">
                <ShieldCheck className="h-12 w-12 text-primary mx-auto" />
                <h3 className="font-display font-bold uppercase text-2xl mt-4">Request sent</h3>
                <p className="font-tech text-sm mt-2">Reference <span className="text-primary font-semibold">{leadRef}</span></p>
                <p className="text-sm text-muted-foreground mt-3">Oketex admin has your request and will coordinate with {partner.businessName}. Keep your lead code — admin connects you with the {isSeller ? "seller" : "pro"} from there. Oketex tracks this as network lead {leadRef} under current launch terms.</p>
                <a href={waNotify} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 w-full mt-6 bg-primary text-primary-foreground font-display font-semibold uppercase tracking-wider px-5 h-12 hover:bg-primary/90"><MessageCircle className="h-4 w-4" /> Notify Oketex on WhatsApp</a>
                <Link to="/partners" className="block font-tech text-xs uppercase tracking-widest text-muted-foreground hover:text-primary mt-4">Back to directory</Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div><label className="label-tech" htmlFor="pl-name">Your name</label><input id="pl-name" className="field-tech" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></div>
                <div><label className="label-tech" htmlFor="pl-phone">Phone / WhatsApp</label><input id="pl-phone" className="field-tech" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0803 000 0000" /></div>
                <div><label className="label-tech" htmlFor="pl-desc">{isSeller ? "What do you want to buy?" : "Describe the job"}</label><textarea id="pl-desc" rows={3} className="field-tech resize-none" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} placeholder={isSeller ? "e.g. 200 longspan sheets 0.45mm charcoal, delivered to Lekki" : "e.g. Re-roof my 4-bedroom bungalow in Sangotedo"} /></div>
                <div><label className="label-tech" htmlFor="pl-value">Estimated value ₦ (optional)</label><input id="pl-value" inputMode="numeric" className="field-tech" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="e.g. 500000" /><p className="font-tech text-[10px] text-muted-foreground mt-1">Used to compute the partner's referral commission ({TERMS.referralCommissionPct}% under current launch terms) — not added to your price.</p></div>
                <Button className="w-full rounded-none h-12 font-display font-semibold uppercase tracking-wider" onClick={submitLead}>Send request via Oketex</Button>
                <p className="font-tech text-[10px] text-muted-foreground">Every request goes through Oketex admin first — tracked, coordinated and protected. {partner.businessName} is connected by admin; there are no side deals.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  </div>);
}
