import { useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router";
import { BadgeCheck, CreditCard, Inbox, MessageCircle, Package, Search, Star } from "lucide-react";
import { PageHead, StatusBadge } from "@/components/StatusBadge";
import { formatNGN } from "@/lib/money";
import { findPartnerAsync, getLeadsForPartnerAsync, getOffersAsync, type Lead, type Offer, type Partner } from "@/lib/partnerStorage";
import { paymentsApi } from "@/lib/api";
import {  } from "@/data/partnerTerms";
import { getPartnerTerms, businessWaLink } from "@/lib/settings";
import { Button } from "@/components/ui/button";

export default function PartnerStatus() {
  const TERMS = getPartnerTerms();
  const [code, setCode] = useState("");
  const [searched, setSearched] = useState("");
  const [partner, setPartner] = useState<Partner | undefined>(undefined);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [payEmail, setPayEmail] = useState("");
  // API-first lookup (server record when the backend is live, local otherwise).
  const lookup = async (c: string) => {
    setSearched(c);
    const p = c.trim() ? await findPartnerAsync(c) : undefined;
    setPartner(p);
    if (!p) { setLeads([]); setOffers([]); return; }
    setLeads(await getLeadsForPartnerAsync(p.code));
    if (p.status === "approved") {
      const all = await getOffersAsync();
      const want = p.role === "pro" ? "pros" : "sellers";
      setOffers(all.filter(o => o.audience === "all" || o.audience === want));
    } else setOffers([]);
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
    <PageHead kicker="Partner Network" title="Partner Status & Dashboard" lead="Enter your partner code (PRT-…) to see your approval status, the leads Oketex has sent you, supply offers, and upgrade options." />
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <div className="flex gap-3 max-w-xl">
        <input value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === "Enter" && void lookup(code)} placeholder="PRT-2026-XXXXX" className="field-tech font-tech uppercase" aria-label="Partner code" />
        <Button className="rounded-none font-display uppercase shrink-0 h-12" onClick={() => void lookup(code)}><Search className="h-4 w-4 mr-2" /> Look up</Button>
      </div>

      {searched && !partner && <div className="border hairline py-14 text-center mt-8"><p className="font-tech text-sm uppercase tracking-widest text-muted-foreground">No partner found with that code — check it and try again, or <Link to="/join" className="text-primary">register here</Link>.</p></div>}

      {partner && (
        <div className="mt-8 space-y-8">
          <section className="border hairline bg-card p-6 flex flex-wrap gap-6 items-center justify-between">
            <div>
              <p className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground">Partner · {partner.code}</p>
              <h2 className="font-display font-bold uppercase text-3xl mt-1 flex items-center gap-2">{partner.businessName}{partner.verified && <BadgeCheck className="h-6 w-6 text-primary" />}{partner.featured && <Star className="h-5 w-5 text-primary" />}</h2>
              <p className="font-tech text-xs text-muted-foreground mt-1">{partner.role === "pro" ? `Pro — ${partner.trades.join(", ")}` : `Seller — ${partner.categories.join(", ")}`} · {partner.location}</p>
            </div>
            <StatusBadge status={partner.status === "approved" ? "delivered" : partner.status === "pending" ? "pending" : "cancelled"} />
          </section>

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
