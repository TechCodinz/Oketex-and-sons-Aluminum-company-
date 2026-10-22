import { useState } from "react";
import { PageHead, StatusBadge } from "@/components/StatusBadge";
import { formatNGN } from "@/lib/money";
import { getOrders, getQuotes } from "@/lib/storage";
import { getBookings, updateBookingStatus, BOOKING_STATUSES, type BookingStatus } from "@/lib/proStorage";
import { getPartners, updatePartner, getLeads, updateLeadStatus, deleteLead, getOffers, addOffer, deleteOffer } from "@/lib/partnerStorage";
import type { LeadStatus } from "@/data/partnerTerms";
import { getPartnerTerms, getRates, getBusiness, saveSettings, resetSettings, overrideSummary, DEFAULT_RATES } from "@/lib/settings";
import { DELIVERY_ZONES } from "@/lib/roofEngine";
import { products, categories } from "@/data/catalog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Tab = "quotes" | "orders" | "bookings" | "partners" | "settings" | "catalog";
const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "won", "paid", "lost"];
export default function Admin() {
  const [pw, setPw] = useState(""); const [ok, setOk] = useState(sessionStorage.getItem("oketex-admin") === "1");
  const [tab, setTab] = useState<Tab>("quotes");
  const [, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const terms = getPartnerTerms();
  const [offerForm, setOfferForm] = useState({ name: "", price: "", unit: "per piece", note: "", audience: "all" as "all" | "pros" | "sellers" });
  // ---- Settings & Rates form state (initialised from EFFECTIVE values) ----
  const [nonce, setNonce] = useState(0);
  const [termsForm, setTermsForm] = useState(() => { const t = getPartnerTerms(); return { pct: String(t.referralCommissionPct), verification: String(t.verificationFeeNgn), featured: String(t.featuredFeeNgn) }; });
  const [ratesForm, setRatesForm] = useState(() => { const r = getRates(); return { zones: Object.fromEntries(Object.entries(r.deliveryZones).map(([k, v]) => [k, String(v)])), installation: String(r.installationPerM2), ridge: String(r.ridgePerM), timber: String(r.timberPerM) }; });
  const [bizForm, setBizForm] = useState(() => { const b = getBusiness(); return { phone: b.phone, whatsapp: b.whatsapp, email: b.email, address: b.address, hours: b.hours }; });
  const numOr = (v: string, fallback: number) => { const n = parseFloat(v.replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : fallback; };
  const saveTerms = () => { saveSettings({ partnerTerms: { referralCommissionPct: numOr(termsForm.pct, terms.referralCommissionPct), verificationFeeNgn: Math.round(numOr(termsForm.verification, terms.verificationFeeNgn)), featuredFeeNgn: Math.round(numOr(termsForm.featured, terms.featuredFeeNgn)) } }); refresh(); toast.success("Partner terms saved — new leads and pages now use them"); };
  const saveRates = () => { const zones: Record<string, number> = {}; for (const z of DELIVERY_ZONES) zones[z.id] = Math.round(numOr(ratesForm.zones[z.id] ?? "", getRates().deliveryZones[z.id] ?? z.price)); saveSettings({ rates: { deliveryZones: zones, installationPerM2: Math.round(numOr(ratesForm.installation, DEFAULT_RATES.installationPerM2)), ridgePerM: Math.round(numOr(ratesForm.ridge, DEFAULT_RATES.ridgePerM)), timberPerM: Math.round(numOr(ratesForm.timber, DEFAULT_RATES.timberPerM)) } }); refresh(); toast.success("Engineering rates saved — the roof calculator now uses them"); };
  const saveBusiness = () => { saveSettings({ business: { phone: bizForm.phone.trim(), whatsapp: bizForm.whatsapp.replace(/\D/g, ""), email: bizForm.email.trim(), address: bizForm.address.trim(), hours: bizForm.hours.trim() } }); toast.success("Business details saved — reloading so header, footer & WhatsApp buttons update…"); setTimeout(() => window.location.reload(), 700); };
  const resetAll = () => { resetSettings(); toast.success("All settings reset to defaults — reloading…"); setTimeout(() => window.location.reload(), 700); };
  const orders = getOrders(); const quotes = getQuotes(); const bookings = getBookings();
  const partners = getPartners(); const leads = getLeads(); const offers = getOffers();
  const pendingPartners = partners.filter(p => p.status === "pending");
  const wonLeads = leads.filter(l => l.status === "won" || l.status === "paid");
  const wonValue = wonLeads.reduce((s, l) => s + l.estValueNgn, 0);
  const commissionEarned = leads.filter(l => l.status === "paid").reduce((s, l) => s + l.commissionNgn, 0);
  const commissionPipeline = leads.filter(l => l.status === "won").reduce((s, l) => s + l.commissionNgn, 0);
  if (!ok) return (<div><PageHead kicker="Demo Admin" title="Admin — Demo" lead="Demo admin for this standalone version. Password: admin123. In production this must be replaced with real authentication." /><div className="mx-auto max-w-md px-4 py-12"><label className="label-tech">Password</label><input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && tryLogin()} className="field-tech font-tech" /><Button className="w-full mt-6 rounded-none font-display uppercase" onClick={tryLogin}>Sign in (Demo)</Button></div></div>);
  function tryLogin() { if (pw === "admin123" || sessionStorage.getItem("oketex-admin") === "1") { sessionStorage.setItem("oketex-admin", "1"); setOk(true); } else alert("Wrong password — demo password is admin123"); }
  const revenue = orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + o.totalNgn, 0);
  const TABS: { id: Tab; label: string }[] = [
    { id: "quotes", label: `Quotes (${quotes.length})` }, { id: "orders", label: `Orders (${orders.length})` },
    { id: "bookings", label: `Bookings (${bookings.length})` }, { id: "settings", label: "Settings & Rates" }, { id: "partners", label: `Partners (${partners.length})${pendingPartners.length ? ` · ${pendingPartners.length} pending` : ""}` }, { id: "catalog", label: "Catalog" },
  ];
  const pushOffer = () => {
    const price = parseInt(offerForm.price.replace(/\D/g, ""), 10) || 0;
    if (offerForm.name.trim().length < 2) return toast.error("Enter the offer product name");
    if (price <= 0) return toast.error("Enter a valid offer price");
    addOffer({ productName: offerForm.name.trim(), priceNgn: price, unit: offerForm.unit || "per piece", note: offerForm.note.trim(), audience: offerForm.audience });
    setOfferForm({ name: "", price: "", unit: "per piece", note: "", audience: "all" });
    refresh(); toast.success("Supply offer pushed to the network");
  };
  return (<div><PageHead kicker="Demo Admin — local data only" title="Oketex Admin (Demo)" lead="Reads quotes, orders, bookings & partner network data saved in this browser. Demo only — not a real backend." />
  <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 space-y-8">
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-px bg-border border hairline">{[{ l: "Revenue (local orders)", v: formatNGN(revenue) }, { l: "Orders (local)", v: String(orders.length) }, { l: "Quotes (local)", v: String(quotes.length) }, { l: "Bookings (local)", v: String(bookings.length) }, { l: "Partners", v: String(partners.length) }, { l: "Network leads", v: String(leads.length) }, { l: "Commission earned (paid)", v: formatNGN(commissionEarned) }, { l: "Products live", v: String(products.length) }].map(c => (<div key={c.l} className="bg-background p-5"><div className="font-display font-bold text-2xl text-primary">{c.v}</div><div className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{c.l}</div></div>))}</div>
    <div className="flex gap-px bg-border border hairline w-fit flex-wrap">{TABS.map(t => (<button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2.5 font-tech text-xs uppercase tracking-widest cursor-pointer ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-background hover:text-primary"}`}>{t.label}</button>))}</div>

    {tab === "quotes" && (<section><h2 className="font-display font-bold uppercase text-2xl mb-4">Quotes saved on this device ({quotes.length})</h2>{!quotes.length ? <p className="font-tech text-sm text-muted-foreground">None yet — create one in the Pro Calculator.</p> : <div className="border hairline">{quotes.map((q, i) => (<div key={q.code} className={`px-5 py-4 flex flex-wrap gap-4 justify-between ${i > 0 ? "border-t hairline" : ""}`}><div><p className="font-tech font-semibold">{q.code} — {q.name} ({q.phone})</p><p className="font-tech text-[11px] text-muted-foreground">{q.roofType} · {q.areaM2}m² · {new Date(q.createdAt).toLocaleString("en-NG")}</p></div><div className="flex items-center gap-4"><span className="font-tech">{formatNGN(q.estimateNgn)}</span><StatusBadge status={q.status} /></div></div>))}</div>}</section>)}

    {tab === "orders" && (<section><h2 className="font-display font-bold uppercase text-2xl mb-4">Orders saved on this device ({orders.length})</h2>{!orders.length ? <p className="font-tech text-sm text-muted-foreground">None yet.</p> : <div className="border hairline">{orders.map((o, i) => (<div key={o.code} className={`px-5 py-4 flex flex-wrap gap-4 justify-between ${i > 0 ? "border-t hairline" : ""}`}><div><p className="font-tech font-semibold">{o.code} — {o.name} ({o.phone})</p><p className="font-tech text-[11px] text-muted-foreground">{o.items.length} items · {o.address}</p></div><div className="flex items-center gap-4"><span className="font-tech">{formatNGN(o.totalNgn)}</span><StatusBadge status={o.status} /></div></div>))}</div>}</section>)}

    {tab === "bookings" && (<section><h2 className="font-display font-bold uppercase text-2xl mb-4">Bookings saved on this device ({bookings.length}) — demo</h2>{!bookings.length ? <p className="font-tech text-sm text-muted-foreground">None yet — create one on the Book page.</p> : <div className="border hairline">{bookings.map((b, i) => (<div key={b.code} className={`px-5 py-4 flex flex-wrap gap-4 justify-between items-center ${i > 0 ? "border-t hairline" : ""}`}>
      <div><p className="font-tech font-semibold">{b.code} — {b.serviceLabel}</p><p className="font-tech text-[11px] text-muted-foreground">{b.name} ({b.phone}) · {b.date} · {b.slot} · {b.address}{b.lgaState ? `, ${b.lgaState}` : ""} · {b.buildingType} · {b.stage}</p></div>
      <div className="flex items-center gap-3"><StatusBadge status={b.status} />
        <select value={b.status} aria-label={`Status for ${b.code}`} onChange={e => { updateBookingStatus(b.code, e.target.value as BookingStatus); refresh(); }} className="bg-background border hairline font-tech text-xs px-2 py-2">
          {BOOKING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select></div></div>))}</div>}
      <p className="font-tech text-[11px] text-muted-foreground mt-3">Demo only: in production, bookings would be confirmed by the office and statuses updated centrally.</p></section>)}

    {tab === "partners" && (<div className="space-y-10">
      <section>
        <h2 className="font-display font-bold uppercase text-2xl mb-1">Partner approvals ({pendingPartners.length} pending) — demo</h2>
        <p className="font-tech text-[11px] text-muted-foreground mb-4">Effective launch terms (defaults in src/data/partnerTerms.ts, admin-editable in Settings & Rates): referral commission {terms.referralCommissionPct}% · Verified {formatNGN(terms.verificationFeeNgn)} one-time · Featured {formatNGN(terms.featuredFeeNgn)}/month. Source: <span className="text-primary">src/data/partnerTerms.ts</span></p>
        {!pendingPartners.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-5">No applications waiting. New partners register at /join.</p>
        : <div className="space-y-4">{pendingPartners.map(p => (
          <div key={p.code} className="border hairline bg-card p-5">
            <div className="flex flex-wrap gap-4 justify-between items-start">
              <div className="min-w-[260px]">
                <p className="font-display font-bold uppercase text-xl">{p.businessName} <span className="font-tech text-[10px] text-muted-foreground font-normal">{p.code}</span></p>
                <p className="font-tech text-xs text-muted-foreground mt-1">{p.role === "pro" ? "Pro" : "Seller"} · {p.contactName} · {p.phone}{p.email ? ` · ${p.email}` : ""}</p>
                <p className="font-tech text-xs text-muted-foreground">{p.location} · Serves: {p.areas}{p.yearsExperience ? ` · ${p.yearsExperience} yrs exp` : ""}{p.cacNumber ? ` · CAC ${p.cacNumber}` : ""}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">{(p.role === "pro" ? p.trades : p.categories).map(t => <span key={t} className="border hairline px-2 py-0.5 font-tech text-[10px] uppercase">{t}</span>)}</div>
                {p.bio && <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{p.bio}</p>}
                {p.products.length > 0 && <p className="font-tech text-[11px] mt-2">{p.products.map(x => `${x.name} — ${formatNGN(x.priceNgn)} ${x.unit}`).join(" · ")}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button className="rounded-none font-display uppercase h-10" onClick={() => { updatePartner(p.code, { status: "approved" }); refresh(); toast.success(`${p.businessName} approved — live in the directory`); }}>Approve</Button>
                <Button variant="outline" className="rounded-none font-display uppercase h-10 hover:text-red-400" onClick={() => { updatePartner(p.code, { status: "rejected" }); refresh(); }}>Reject</Button>
              </div>
            </div>
          </div>))}
        </div>}
      </section>

      <section>
        <h2 className="font-display font-bold uppercase text-2xl mb-4">All partners ({partners.length})</h2>
        <div className="border hairline overflow-x-auto"><table className="w-full text-sm min-w-[760px]">
          <thead><tr className="border-b hairline text-left font-tech text-[10px] uppercase tracking-widest text-muted-foreground"><th className="px-4 py-3">Partner</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Verified ({formatNGN(terms.verificationFeeNgn)})</th><th className="px-4 py-3">Featured ({formatNGN(terms.featuredFeeNgn)}/mo)</th></tr></thead>
          <tbody>{partners.map(p => (<tr key={p.code} className="border-b hairline last:border-0">
            <td className="px-4 py-3"><span className="font-semibold">{p.businessName}</span>{p.sample ? " (sample)" : ""}<br /><span className="font-tech text-[11px] text-muted-foreground">{p.code} · {p.location}</span></td>
            <td className="px-4 py-3 font-tech text-xs uppercase">{p.role}</td>
            <td className="px-4 py-3"><StatusBadge status={p.status === "approved" ? "delivered" : p.status === "pending" ? "pending" : "cancelled"} /></td>
            <td className="px-4 py-3"><button onClick={() => { updatePartner(p.code, { verified: !p.verified }); refresh(); }} className={`border px-3 py-1.5 font-tech text-[11px] cursor-pointer ${p.verified ? "border-primary text-primary" : "hairline text-muted-foreground hover:text-primary"}`}>{p.verified ? "Verified ✓" : "Set verified"}</button></td>
            <td className="px-4 py-3"><button onClick={() => { updatePartner(p.code, { featured: !p.featured }); refresh(); }} className={`border px-3 py-1.5 font-tech text-[11px] cursor-pointer ${p.featured ? "border-primary text-primary" : "hairline text-muted-foreground hover:text-primary"}`}>{p.featured ? "Featured ✓" : "Set featured"}</button></td>
          </tr>))}</tbody>
        </table></div>
      </section>

      <section>
        <h2 className="font-display font-bold uppercase text-2xl mb-4">Leads &amp; revenue</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border hairline mb-5">
          {[{ l: "Total leads", v: String(leads.length) }, { l: "Won value (won + paid)", v: formatNGN(wonValue) }, { l: `Commission earned (${terms.referralCommissionPct}%, paid)`, v: formatNGN(commissionEarned) }, { l: "Commission pipeline (won, unpaid)", v: formatNGN(commissionPipeline) }].map(c => (<div key={c.l} className="bg-background p-5"><div className="font-display font-bold text-2xl text-primary">{c.v}</div><div className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{c.l}</div></div>))}
        </div>
        {!leads.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-5">No leads yet — customers create them from partner storefront/profile pages.</p>
        : <div className="border hairline">{leads.map((l, i) => (
          <div key={l.id} className={`px-5 py-4 flex flex-wrap gap-4 justify-between items-center ${i > 0 ? "border-t hairline" : ""}`}>
            <div><p className="font-tech font-semibold">{l.id} · {l.type} → {l.partnerName} <span className="text-muted-foreground font-normal">({l.partnerCode})</span></p>
              <p className="text-sm text-muted-foreground">{l.customerName} ({l.customerPhone}) — {l.description}</p>
              <p className="font-tech text-[11px] text-muted-foreground">{new Date(l.createdAt).toLocaleString("en-NG")} · Est. {formatNGN(l.estValueNgn)} · Commission {l.commissionPct}% = {formatNGN(l.commissionNgn)}</p></div>
            <div className="flex items-center gap-3"><StatusBadge status={l.status} />
              <select value={l.status} aria-label={`Status for ${l.id}`} onChange={e => { updateLeadStatus(l.id, e.target.value as LeadStatus); refresh(); }} className="bg-background border hairline font-tech text-xs px-2 py-2">{LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
              <button onClick={() => { deleteLead(l.id); refresh(); }} className="font-tech text-xs text-muted-foreground hover:text-red-400 cursor-pointer">Delete</button></div>
          </div>))}</div>}
        <p className="font-tech text-[11px] text-muted-foreground mt-3">Commission counts as earned only when a lead is marked <span className="text-primary">paid</span> (partner has settled with Oketex). Won-but-unpaid sits in the pipeline.</p>
      </section>

      <section>
        <h2 className="font-display font-bold uppercase text-2xl mb-4">Push a supply offer to the network</h2>
        <div className="border hairline bg-card p-5">
          <div className="grid md:grid-cols-5 gap-4">
            <div className="md:col-span-2"><label className="label-tech">Product</label><input list="catalog-products" className="field-tech" value={offerForm.name} onChange={e => setOfferForm({ ...offerForm, name: e.target.value })} placeholder="Catalog product or any item" /><datalist id="catalog-products">{products.map(p => <option key={p.slug} value={p.name} />)}</datalist></div>
            <div><label className="label-tech">Offer price ₦</label><input className="field-tech" inputMode="numeric" value={offerForm.price} onChange={e => setOfferForm({ ...offerForm, price: e.target.value })} placeholder="e.g. 9300" /></div>
            <div><label className="label-tech">Unit</label><input className="field-tech" value={offerForm.unit} onChange={e => setOfferForm({ ...offerForm, unit: e.target.value })} /></div>
            <div><label className="label-tech">Audience</label><select className="field-tech bg-background" value={offerForm.audience} onChange={e => setOfferForm({ ...offerForm, audience: e.target.value as "all" | "pros" | "sellers" })}><option value="all">All partners</option><option value="pros">Pros only</option><option value="sellers">Sellers only</option></select></div>
            <div className="md:col-span-4"><label className="label-tech">Note (terms, MOQ, validity)</label><input className="field-tech" value={offerForm.note} onChange={e => setOfferForm({ ...offerForm, note: e.target.value })} placeholder="e.g. Network price this week — min 100m, pickup Ibafo" /></div>
            <div className="flex items-end"><Button className="rounded-none font-display uppercase h-12 w-full" onClick={pushOffer}>Push offer</Button></div>
          </div>
        </div>
        {offers.length > 0 && <div className="border hairline mt-5">{offers.map((o, i) => (
          <div key={o.id} className={`px-5 py-3.5 flex flex-wrap gap-3 justify-between items-center ${i > 0 ? "border-t hairline" : ""}`}>
            <p className="text-sm"><span className="font-semibold">{o.productName}</span> — {formatNGN(o.priceNgn)} {o.unit} <span className="font-tech text-[11px] text-muted-foreground">· {o.audience} · {new Date(o.createdAt).toLocaleDateString("en-NG")}{o.note ? ` · ${o.note}` : ""}</span></p>
            <button onClick={() => { deleteOffer(o.id); refresh(); }} className="font-tech text-xs text-muted-foreground hover:text-red-400 cursor-pointer">Delete</button>
          </div>))}</div>}
      </section>
      <p className="font-tech text-[11px] text-muted-foreground">Demo mode: all partner data lives in this browser (localStorage). Production step: move partners/leads/offers to a real backend (Neon) and settle verification fees, featured fees and commissions via Paystack — see BUILD_NOTES.md, Phase 4.</p>
    </div>)}

    {tab === "settings" && (<div className="space-y-10" key={nonce}>
      <section>
        <h2 className="font-display font-bold uppercase text-2xl mb-1">Settings &amp; Rates — demo</h2>
        <p className="font-tech text-[11px] text-muted-foreground">Every number here takes effect immediately across the site: partner terms drive the Join page, upgrade cards, new-lead commission snapshots and this dashboard; engineering rates drive the Pro Roof Calculator and Workspace take-off; business details drive the header, footer and WhatsApp buttons. Existing leads and quotes keep the values they were created with.</p>
        <div className="border hairline bg-card p-4 mt-4 flex flex-wrap gap-3 items-center justify-between">
          <p className="font-tech text-xs">{overrideSummary().length ? <>Currently overridden vs defaults: <span className="text-primary">{overrideSummary().join(" · ")}</span></> : "Nothing is overridden — every value below is the built-in default."}</p>
          <Button variant="outline" className="rounded-none font-display uppercase h-10" onClick={() => { resetAll(); setNonce(n => n + 1); }}>Reset all to defaults</Button>
        </div>
      </section>

      <section className="border hairline bg-card p-6">
        <h3 className="font-display font-bold uppercase text-xl mb-1">Partner terms</h3>
        <p className="font-tech text-[11px] text-muted-foreground mb-5">Defaults: commission 5% · Verified ₦15,000 · Featured ₦20,000/mo (src/data/partnerTerms.ts). New leads snapshot the commission % saved here.</p>
        <div className="grid md:grid-cols-3 gap-5">
          <div><label className="label-tech">Referral commission %</label><input className="field-tech" inputMode="decimal" value={termsForm.pct} onChange={e => setTermsForm({ ...termsForm, pct: e.target.value })} /><p className="font-tech text-[10px] text-muted-foreground mt-1">Default 5% · current effective {terms.referralCommissionPct}%</p></div>
          <div><label className="label-tech">Verified badge fee ₦ (one-time)</label><input className="field-tech" inputMode="numeric" value={termsForm.verification} onChange={e => setTermsForm({ ...termsForm, verification: e.target.value })} /><p className="font-tech text-[10px] text-muted-foreground mt-1">Default ₦15,000 · current {formatNGN(terms.verificationFeeNgn)}</p></div>
          <div><label className="label-tech">Featured fee ₦ / month</label><input className="field-tech" inputMode="numeric" value={termsForm.featured} onChange={e => setTermsForm({ ...termsForm, featured: e.target.value })} /><p className="font-tech text-[10px] text-muted-foreground mt-1">Default ₦20,000 · current {formatNGN(terms.featuredFeeNgn)}</p></div>
        </div>
        <Button className="rounded-none font-display uppercase h-11 mt-6" onClick={saveTerms}>Save partner terms</Button>
      </section>

      <section className="border hairline bg-card p-6">
        <h3 className="font-display font-bold uppercase text-xl mb-1">Engineering rates (roof calculator)</h3>
        <p className="font-tech text-[11px] text-muted-foreground mb-5">The roof engine reads these at calculation time — Quote page and Workspace take-off follow automatically. Catalog material prices (sheets, tiles, gutters…) are NOT changed here.</p>
        <div className="grid md:grid-cols-3 gap-5">
          <div><label className="label-tech">Installation labour ₦/m²</label><input className="field-tech" inputMode="numeric" value={ratesForm.installation} onChange={e => setRatesForm({ ...ratesForm, installation: e.target.value })} /><p className="font-tech text-[10px] text-muted-foreground mt-1">Default {formatNGN(DEFAULT_RATES.installationPerM2)}</p></div>
          <div><label className="label-tech">Ridge caps &amp; flashing ₦/m</label><input className="field-tech" inputMode="numeric" value={ratesForm.ridge} onChange={e => setRatesForm({ ...ratesForm, ridge: e.target.value })} /><p className="font-tech text-[10px] text-muted-foreground mt-1">Default {formatNGN(DEFAULT_RATES.ridgePerM)}</p></div>
          <div><label className="label-tech">Timber purlins ₦/m</label><input className="field-tech" inputMode="numeric" value={ratesForm.timber} onChange={e => setRatesForm({ ...ratesForm, timber: e.target.value })} /><p className="font-tech text-[10px] text-muted-foreground mt-1">Default {formatNGN(DEFAULT_RATES.timberPerM)}</p></div>
        </div>
        <p className="label-tech mt-7 mb-3">Delivery zone prices ₦</p>
        <div className="grid md:grid-cols-5 gap-5">
          {DELIVERY_ZONES.map(z => (<div key={z.id}><label className="label-tech">{z.label.split("—")[0].trim()}</label><input className="field-tech" inputMode="numeric" value={ratesForm.zones[z.id] ?? ""} onChange={e => setRatesForm({ ...ratesForm, zones: { ...ratesForm.zones, [z.id]: e.target.value } })} /><p className="font-tech text-[10px] text-muted-foreground mt-1">Default {formatNGN(DEFAULT_RATES.deliveryZones[z.id] ?? 0)}</p></div>))}
        </div>
        <Button className="rounded-none font-display uppercase h-11 mt-6" onClick={saveRates}>Save engineering rates</Button>
      </section>

      <section className="border hairline bg-card p-6">
        <h3 className="font-display font-bold uppercase text-xl mb-1">Business details</h3>
        <p className="font-tech text-[11px] text-muted-foreground mb-5">Shown in the header, footer, floating WhatsApp button and across bookings, workspace and partner pages. Defaults are the template details in contracts/constants.ts — replace them with the owner's real details here, no code change needed. Saving reloads the page so the shell picks the new values up (Save &amp; reload).</p>
        <div className="grid md:grid-cols-2 gap-5">
          <div><label className="label-tech">Phone</label><input className="field-tech" value={bizForm.phone} onChange={e => setBizForm({ ...bizForm, phone: e.target.value })} /></div>
          <div><label className="label-tech">WhatsApp number (digits, country code)</label><input className="field-tech" value={bizForm.whatsapp} onChange={e => setBizForm({ ...bizForm, whatsapp: e.target.value })} placeholder="2348035550192" /></div>
          <div><label className="label-tech">Email</label><input className="field-tech" value={bizForm.email} onChange={e => setBizForm({ ...bizForm, email: e.target.value })} /></div>
          <div><label className="label-tech">Opening hours</label><input className="field-tech" value={bizForm.hours} onChange={e => setBizForm({ ...bizForm, hours: e.target.value })} /></div>
          <div className="md:col-span-2"><label className="label-tech">Address</label><input className="field-tech" value={bizForm.address} onChange={e => setBizForm({ ...bizForm, address: e.target.value })} /></div>
        </div>
        <Button className="rounded-none font-display uppercase h-11 mt-6" onClick={saveBusiness}>Save &amp; reload</Button>
      </section>
      <p className="font-tech text-[11px] text-muted-foreground">Demo mode: settings live in this browser (localStorage, key <span className="text-primary">oketex-settings</span>) — they affect this device only. Production: the same settings shape moves to the backend so one change updates every visitor.</p>
    </div>)}

    {tab === "catalog" && (<section><h2 className="font-display font-bold uppercase text-2xl mb-4">Catalog ({products.length} products, {categories.length} categories)</h2><div className="border hairline">{products.map((p, i) => (<div key={p.id} className={`px-5 py-3 flex justify-between text-sm ${i > 0 ? "border-t hairline" : ""}`}><span>{p.name}</span><span className="font-tech">{formatNGN(p.priceNgn)} {p.unit} · stock {p.stock}</span></div>))}</div></section>)}

    <Button variant="outline" className="rounded-none font-display uppercase" onClick={() => { sessionStorage.removeItem("oketex-admin"); setOk(false); }}>Sign out</Button>
  </div></div>);
}
