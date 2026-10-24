import { useEffect, useState } from "react";
import { PageHead, StatusBadge } from "@/components/StatusBadge";
import { formatNGN } from "@/lib/money";
import { getOrders, getQuotes, getOrdersAsync, getQuotesAsync, type LocalOrder, type LocalQuote } from "@/lib/storage";
import { getBookings, getBookingsAsync, updateBookingStatusAsync, BOOKING_STATUSES, type BookingStatus, type LocalBooking } from "@/lib/proStorage";
import { getPartners, getLeads, getOffers, getPartnersAdminAsync, updatePartnerAsync, getLeadsAsync, updateLeadStatusAsync, deleteLeadAsync, getOffersAsync, addOfferAsync, deleteOfferAsync, type Partner, type Lead, type Offer } from "@/lib/partnerStorage";
import type { LeadStatus } from "@/data/partnerTerms";
import { getPartnerTerms, getRates, getBusiness, saveSettingsAsync, resetSettingsAsync, fetchServerSettings, overrideSummary, DEFAULT_RATES, getCoupons, getPromoBanner, getPriceWatch, type Coupon, type PriceWatchMaterial } from "@/lib/settings";
import { getJobsAdminAsync, getJobBidsAsync, updateJobStatusAsync, deleteJob, budgetLabel, type Job, type Bid } from "@/lib/jobs";
import { getReviewsAdminAsync, setReviewStatusAsync, deleteReviewAsync, starsText, type Review } from "@/lib/reviews";
import { getNotificationsAsync, markNotificationSentAsync, dispatchNotificationsAsync, notificationWaLink, type NotificationRecord } from "@/lib/notify";
import { useApiLive, apiLiveSync } from "@/lib/api";
import { login as authLogin, logout as authLogout, fetchMe } from "@/lib/auth";
import { DELIVERY_ZONES } from "@/lib/roofEngine";
import { products, categories } from "@/data/catalog";
import { getVerifyRequests, saveVerifyRequests, VERIFY_STATUSES, type VerifyRequest, type VerifyStatus } from "@/lib/assistantBrain";
import { getPlans, issuePlanCode, getPlanCodes, revokePlanCode, type PlanDef, type PlanCode } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Tab = "quotes" | "orders" | "bookings" | "partners" | "settings" | "catalog" | "verify" | "plans" | "jobs" | "reviews" | "notifications";
const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "won", "paid", "lost"];
export default function Admin() {
  const [pw, setPw] = useState(""); const [email, setEmail] = useState("");
  const [ok, setOk] = useState(sessionStorage.getItem("oketex-admin") === "1");
  const [tab, setTab] = useState<Tab>("quotes");
  const live = useApiLive();
  // Phase 5: lists are state, hydrated through the API-first wrappers —
  // server data when the backend is live, this browser's data otherwise.
  const [orders, setOrders] = useState<LocalOrder[]>(() => getOrders());
  const [quotes, setQuotes] = useState<LocalQuote[]>(() => getQuotes());
  const [bookings, setBookings] = useState<LocalBooking[]>(() => getBookings());
  const [partners, setPartners] = useState<Partner[]>(() => getPartners());
  const [leads, setLeads] = useState<Lead[]>(() => getLeads());
  const [offers, setOffers] = useState<Offer[]>(() => getOffers());
  const [verifyReqs, setVerifyReqs] = useState<VerifyRequest[]>(() => getVerifyRequests());
  const [adminJobs, setAdminJobs] = useState<{ job: Job; bids: Bid[] }[]>([]);
  const [adminReviews, setAdminReviews] = useState<Review[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<NotificationRecord[]>([]);
  const [promoForm, setPromoForm] = useState(() => getPromoBanner());
  const [couponsForm, setCouponsForm] = useState<Coupon[]>(() => getCoupons());
  const [pwForm, setPwForm] = useState<PriceWatchMaterial[]>(() => getPriceWatch());
  const [pwNew, setPwNew] = useState({ material: "", unit: "per metre" });
  const [pwPoint, setPwPoint] = useState({ price: "", source: "", date: new Date().toISOString().slice(0, 10) });
  const [planCodes, setPlanCodes] = useState<PlanCode[]>(() => getPlanCodes());
  const [issuePlanId, setIssuePlanId] = useState("pro-monthly");
  const [plansForm, setPlansForm] = useState(() => getPlans().map(pl => ({ id: pl.id, name: pl.name, price: String(pl.priceNgn), days: String(pl.periodDays), blurb: pl.blurb, featuresText: pl.features.join("\n"), active: pl.active })));
  const patchVerify = (code: string, patch: Partial<VerifyRequest>) => { const next = verifyReqs.map(r => (r.code === code ? { ...r, ...patch } : r)); setVerifyReqs(next); saveVerifyRequests(next); };
  const openVerify = verifyReqs.filter(r => r.status === "Requested" || r.status === "Pro Assigned").length;
  const savePlans = async () => { const plans: PlanDef[] = plansForm.map(f => ({ id: f.id, name: f.name.trim() || f.id, priceNgn: Math.max(0, Math.round(parseFloat(f.price) || 0)), periodDays: Math.max(0, Math.round(parseFloat(f.days) || 0)), blurb: f.blurb, features: f.featuresText.split("\n").map(x => x.trim()).filter(Boolean), active: f.active })); const r = await saveSettingsAsync({ plans }); toast.success(r.live ? "Plans saved to the server" : "Plans saved — gates and the Plans page now use them"); };
  const waCustomer = (phone: string, text: string) => { let d = phone.replace(/\D/g, ""); if (d.startsWith("0")) d = "234" + d.slice(1); return `https://wa.me/${d}?text=${encodeURIComponent(text)}`; };
  const hydrate = async () => {
    const [o, q, b, pa, l, of] = await Promise.all([getOrdersAsync(), getQuotesAsync(), getBookingsAsync(), getPartnersAdminAsync(), getLeadsAsync(), getOffersAsync()]);
    setOrders(o); setQuotes(q); setBookings(b); setPartners(pa); setLeads(l); setOffers(of);
    const jobs = await getJobsAdminAsync();
    setAdminJobs(await Promise.all(jobs.map(async job => ({ job, bids: await getJobBidsAsync(job.code) }))));
    setAdminReviews(await getReviewsAdminAsync());
    setAdminNotifications(await getNotificationsAsync());
  };
  const savePromo = async () => { const cleaned = couponsForm.map(c => ({ ...c, code: c.code.trim().toUpperCase(), value: Math.max(0, Number(c.value) || 0), minSpend: Math.max(0, Number(c.minSpend) || 0), expiresAt: c.expiresAt || undefined })).filter(c => c.code.length >= 2); const r = await saveSettingsAsync({ promoBanner: { text: promoForm.text.trim(), active: promoForm.active }, coupons: cleaned }); toast.success(r.live ? "Promotions saved to the server" : "Promotions saved"); };
  const savePriceWatch = async () => { const r = await saveSettingsAsync({ priceWatch: pwForm }); toast.success(r.live ? "Price Watch saved to the server — /prices updates for every visitor" : "Price Watch saved — /prices updates now"); };
  const refresh = () => { void hydrate(); };
  useEffect(() => { if (ok) void hydrate(); /* eslint-disable-next-line */ }, [ok ]);
  // In LIVE mode the demo flag alone is not enough — verify a real admin session.
  useEffect(() => {
    if (ok && apiLiveSync()) fetchMe(true).then(u => { if (!u || u.role !== "admin") { sessionStorage.removeItem("oketex-admin"); setOk(false); } });
    /* eslint-disable-next-line */
  }, [ok, live]);
  const ModeBadge = () => (<span className={`inline-flex items-center gap-2 border px-3 py-1.5 font-tech text-[11px] uppercase tracking-widest ${live ? "border-emerald-500/50 text-emerald-500" : "border-yellow-500/50 text-yellow-500"}`}>{live ? "Mode: LIVE (database)" : "Mode: DEMO (this browser only)"}</span>);
  const terms = getPartnerTerms();
  const [offerForm, setOfferForm] = useState({ name: "", price: "", unit: "per piece", note: "", audience: "all" as "all" | "pros" | "sellers" });
  // ---- Settings & Rates form state (initialised from EFFECTIVE values) ----
  const [nonce, setNonce] = useState(0);
  const [termsForm, setTermsForm] = useState(() => { const t = getPartnerTerms(); return { pct: String(t.referralCommissionPct), verification: String(t.verificationFeeNgn), featured: String(t.featuredFeeNgn) }; });
  const [ratesForm, setRatesForm] = useState(() => { const r = getRates(); return { zones: Object.fromEntries(Object.entries(r.deliveryZones).map(([k, v]) => [k, String(v)])), installation: String(r.installationPerM2), ridge: String(r.ridgePerM), timber: String(r.timberPerM) }; });
  const [bizForm, setBizForm] = useState(() => { const b = getBusiness(); return { phone: b.phone, whatsapp: b.whatsapp, email: b.email, address: b.address, hours: b.hours }; });
  const numOr = (v: string, fallback: number) => { const n = parseFloat(v.replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : fallback; };
  const saveTerms = async () => { const r = await saveSettingsAsync({ partnerTerms: { referralCommissionPct: numOr(termsForm.pct, terms.referralCommissionPct), verificationFeeNgn: Math.round(numOr(termsForm.verification, terms.verificationFeeNgn)), featuredFeeNgn: Math.round(numOr(termsForm.featured, terms.featuredFeeNgn)) } }); refresh(); toast.success(r.live ? "Partner terms saved to the server — every visitor now uses them" : "Partner terms saved — new leads and pages now use them"); };
  const saveRates = async () => { const zones: Record<string, number> = {}; for (const z of DELIVERY_ZONES) zones[z.id] = Math.round(numOr(ratesForm.zones[z.id] ?? "", getRates().deliveryZones[z.id] ?? z.price)); const r = await saveSettingsAsync({ rates: { deliveryZones: zones, installationPerM2: Math.round(numOr(ratesForm.installation, DEFAULT_RATES.installationPerM2)), ridgePerM: Math.round(numOr(ratesForm.ridge, DEFAULT_RATES.ridgePerM)), timberPerM: Math.round(numOr(ratesForm.timber, DEFAULT_RATES.timberPerM)) } }); refresh(); toast.success(r.live ? "Engineering rates saved to the server — every calculator now uses them" : "Engineering rates saved — the roof calculator now uses them"); };
  const saveBusiness = async () => { await saveSettingsAsync({ business: { phone: bizForm.phone.trim(), whatsapp: bizForm.whatsapp.replace(/\D/g, ""), email: bizForm.email.trim(), address: bizForm.address.trim(), hours: bizForm.hours.trim() } }); toast.success("Business details saved — reloading so header, footer & WhatsApp buttons update…"); setTimeout(() => window.location.reload(), 700); };
  const resetAll = async () => { await resetSettingsAsync(); toast.success("All settings reset to defaults — reloading…"); setTimeout(() => window.location.reload(), 700); };
  const pendingPartners = partners.filter(p => p.status === "pending");
  const wonLeads = leads.filter(l => l.status === "won" || l.status === "paid");
  const wonValue = wonLeads.reduce((s, l) => s + l.estValueNgn, 0);
  const commissionEarned = leads.filter(l => l.status === "paid").reduce((s, l) => s + l.commissionNgn, 0);
  const commissionPipeline = leads.filter(l => l.status === "won").reduce((s, l) => s + l.commissionNgn, 0);
  if (!ok) return (<div><PageHead kicker={live ? "Admin — LIVE" : "Demo Admin"} title="Admin" lead={live ? "The production backend is live. Sign in with the admin email and password configured on the server (or any account with the admin role)." : "Demo admin for this standalone version. Password: admin123. When the production backend goes live, this page switches to real sign-in automatically."} /><div className="mx-auto max-w-md px-4 py-12"><ModeBadge />{live && <div className="mt-6"><label className="label-tech">Admin email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="field-tech font-tech" /></div>}<div className="mt-4"><label className="label-tech">Password</label><input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && void tryLogin()} className="field-tech font-tech" /></div><Button className="w-full mt-6 rounded-none font-display uppercase" onClick={() => void tryLogin()}>{live ? "Sign in" : "Sign in (Demo)"}</Button></div></div>);
  async function tryLogin() {
    if (apiLiveSync()) {
      try {
        const u = await authLogin(email.trim(), pw);
        if (u.role !== "admin") { toast.error("That account is signed in but is not an admin."); return; }
        sessionStorage.setItem("oketex-admin", "1"); setOk(true); toast.success("Signed in — LIVE mode");
      } catch (e: any) { toast.error(String(e?.message || "Sign-in failed")); }
      return;
    }
    if (pw === "admin123" || sessionStorage.getItem("oketex-admin") === "1") { sessionStorage.setItem("oketex-admin", "1"); setOk(true); } else alert("Wrong password — demo password is admin123");
  }
  const revenue = orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + o.totalNgn, 0);
  const TABS: { id: Tab; label: string }[] = [
    { id: "quotes", label: `Quotes (${quotes.length})` }, { id: "orders", label: `Orders (${orders.length})` },
    { id: "bookings", label: `Bookings (${bookings.length})` }, { id: "verify", label: `Verification (${verifyReqs.length})${openVerify ? ` · ${openVerify} open` : ""}` }, { id: "jobs", label: `Jobs (${adminJobs.length})` }, { id: "reviews", label: `Reviews (${adminReviews.length})` }, { id: "notifications", label: `Notifications (${adminNotifications.length})` }, { id: "settings", label: "Settings & Rates" }, { id: "partners", label: `Partners (${partners.length})${pendingPartners.length ? ` · ${pendingPartners.length} pending` : ""}` }, { id: "plans", label: "Plans" }, { id: "catalog", label: "Catalog" },
  ];
  const pushOffer = () => {
    const price = parseInt(offerForm.price.replace(/\D/g, ""), 10) || 0;
    if (offerForm.name.trim().length < 2) return toast.error("Enter the offer product name");
    if (price <= 0) return toast.error("Enter a valid offer price");
    void addOfferAsync({ productName: offerForm.name.trim(), priceNgn: price, unit: offerForm.unit || "per piece", note: offerForm.note.trim(), audience: offerForm.audience });
    setOfferForm({ name: "", price: "", unit: "per piece", note: "", audience: "all" });
    refresh(); toast.success("Supply offer pushed to the network");
  };
  return (<div><PageHead kicker={live ? "Admin — LIVE data" : "Demo Admin — local data only"} title={live ? "Oketex Admin" : "Oketex Admin (Demo)"} lead={live ? "Connected to the production database — quotes, orders, bookings, partners, leads and settings below are the server copies every visitor shares." : "Reads quotes, orders, bookings & partner network data saved in this browser. Demo only — not a real backend."} />
  <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 space-y-8">
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-px bg-border border hairline">{[{ l: "Revenue (local orders)", v: formatNGN(revenue) }, { l: "Orders (local)", v: String(orders.length) }, { l: "Quotes (local)", v: String(quotes.length) }, { l: "Bookings (local)", v: String(bookings.length) }, { l: "Partners", v: String(partners.length) }, { l: "Network leads", v: String(leads.length) }, { l: "Commission earned (paid)", v: formatNGN(commissionEarned) }, { l: "Products live", v: String(products.length) }, { l: "Verify requests open", v: String(openVerify) }].map(c => (<div key={c.l} className="bg-background p-5"><div className="font-display font-bold text-2xl text-primary">{c.v}</div><div className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{c.l}</div></div>))}</div>
    <div className="flex items-center gap-4 flex-wrap"><ModeBadge />{live && <button className="font-tech text-[11px] text-primary cursor-pointer uppercase tracking-widest" onClick={() => { void fetchServerSettings(); refresh(); }}>Reload server data</button>}</div>
    <div className="flex gap-px bg-border border hairline w-fit flex-wrap">{TABS.map(t => (<button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2.5 font-tech text-xs uppercase tracking-widest cursor-pointer ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-background hover:text-primary"}`}>{t.label}</button>))}</div>

    {tab === "quotes" && (<section><h2 className="font-display font-bold uppercase text-2xl mb-4">Quotes ({quotes.length}){live ? " — server" : " saved on this device"}</h2>{!quotes.length ? <p className="font-tech text-sm text-muted-foreground">None yet — create one in the Pro Calculator.</p> : <div className="border hairline">{quotes.map((q, i) => (<div key={q.code} className={`px-5 py-4 flex flex-wrap gap-4 justify-between ${i > 0 ? "border-t hairline" : ""}`}><div><p className="font-tech font-semibold">{q.code} — {q.name} ({q.phone})</p><p className="font-tech text-[11px] text-muted-foreground">{q.roofType} · {q.areaM2}m² · {new Date(q.createdAt).toLocaleString("en-NG")}</p></div><div className="flex items-center gap-4"><span className="font-tech">{formatNGN(q.estimateNgn)}</span><StatusBadge status={q.status} /></div></div>))}</div>}</section>)}

    {tab === "orders" && (<section><h2 className="font-display font-bold uppercase text-2xl mb-4">Orders ({orders.length}){live ? " — server" : " saved on this device"}</h2>{!orders.length ? <p className="font-tech text-sm text-muted-foreground">None yet.</p> : <div className="border hairline">{orders.map((o, i) => (<div key={o.code} className={`px-5 py-4 flex flex-wrap gap-4 justify-between ${i > 0 ? "border-t hairline" : ""}`}><div><p className="font-tech font-semibold">{o.code} — {o.name} ({o.phone})</p><p className="font-tech text-[11px] text-muted-foreground">{o.items.length} items · {o.address}</p></div><div className="flex items-center gap-4"><span className="font-tech">{formatNGN(o.totalNgn)}</span><StatusBadge status={o.status} /></div></div>))}</div>}</section>)}

    {tab === "bookings" && (<section><h2 className="font-display font-bold uppercase text-2xl mb-4">Bookings ({bookings.length}){live ? " — server" : " saved on this device — demo"}</h2>{!bookings.length ? <p className="font-tech text-sm text-muted-foreground">None yet — create one on the Book page.</p> : <div className="border hairline">{bookings.map((b, i) => (<div key={b.code} className={`px-5 py-4 flex flex-wrap gap-4 justify-between items-center ${i > 0 ? "border-t hairline" : ""}`}>
      <div><p className="font-tech font-semibold">{b.code} — {b.serviceLabel}</p><p className="font-tech text-[11px] text-muted-foreground">{b.name} ({b.phone}) · {b.date} · {b.slot} · {b.address}{b.lgaState ? `, ${b.lgaState}` : ""} · {b.buildingType} · {b.stage}</p></div>
      <div className="flex items-center gap-3"><StatusBadge status={b.status} />
        <select value={b.status} aria-label={`Status for ${b.code}`} onChange={e => { void updateBookingStatusAsync(b.code, e.target.value as BookingStatus); refresh(); }} className="bg-background border hairline font-tech text-xs px-2 py-2">
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
                <Button className="rounded-none font-display uppercase h-10" onClick={() => { void updatePartnerAsync(p.code, { status: "approved" }); refresh(); toast.success(`${p.businessName} approved — live in the directory`); }}>Approve</Button>
                <Button variant="outline" className="rounded-none font-display uppercase h-10 hover:text-red-400" onClick={() => { void updatePartnerAsync(p.code, { status: "rejected" }); refresh(); }}>Reject</Button>
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
            <td className="px-4 py-3"><button onClick={() => { void updatePartnerAsync(p.code, { verified: !p.verified }); refresh(); }} className={`border px-3 py-1.5 font-tech text-[11px] cursor-pointer ${p.verified ? "border-primary text-primary" : "hairline text-muted-foreground hover:text-primary"}`}>{p.verified ? "Verified ✓" : "Set verified"}</button></td>
            <td className="px-4 py-3"><button onClick={() => { void updatePartnerAsync(p.code, { featured: !p.featured }); refresh(); }} className={`border px-3 py-1.5 font-tech text-[11px] cursor-pointer ${p.featured ? "border-primary text-primary" : "hairline text-muted-foreground hover:text-primary"}`}>{p.featured ? "Featured ✓" : "Set featured"}</button></td>
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
              <select value={l.status} aria-label={`Status for ${l.id}`} onChange={e => { void updateLeadStatusAsync(l.id, e.target.value as LeadStatus); refresh(); }} className="bg-background border hairline font-tech text-xs px-2 py-2">{LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
              <button onClick={() => { void deleteLeadAsync(l.id); refresh(); }} className="font-tech text-xs text-muted-foreground hover:text-red-400 cursor-pointer">Delete</button></div>
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
            <button onClick={() => { void deleteOfferAsync(o.id); refresh(); }} className="font-tech text-xs text-muted-foreground hover:text-red-400 cursor-pointer">Delete</button>
          </div>))}</div>}
      </section>
      <p className="font-tech text-[11px] text-muted-foreground">{live ? "LIVE mode: partners, leads and offers below are the server records. Verification and featured fees settle via Paystack and activate automatically; commissions are tracked per lead." : "Demo mode: all partner data lives in this browser (localStorage). Production step: the Neon backend + Paystack (Phase 5) — see BUILD_NOTES.md."}</p>
    </div>)}

    {tab === "settings" && (<div className="space-y-10" key={nonce}>
      <section>
        <h2 className="font-display font-bold uppercase text-2xl mb-1">Settings &amp; Rates{live ? " — LIVE" : " — demo"}</h2>
        <p className="font-tech text-[11px] text-muted-foreground">Every number here takes effect immediately across the site: partner terms drive the Join page, upgrade cards, new-lead commission snapshots and this dashboard; engineering rates drive the Pro Roof Calculator and Workspace take-off; business details drive the header, footer and WhatsApp buttons. Existing leads and quotes keep the values they were created with.</p>
        <div className="border hairline bg-card p-4 mt-4 flex flex-wrap gap-3 items-center justify-between">
          <p className="font-tech text-xs">{overrideSummary().length ? <>Currently overridden vs defaults: <span className="text-primary">{overrideSummary().join(" · ")}</span></> : "Nothing is overridden — every value below is the built-in default."}</p>
          <Button variant="outline" className="rounded-none font-display uppercase h-10" onClick={() => { void resetAll(); setNonce(n => n + 1); }}>Reset all to defaults</Button>
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
        <Button className="rounded-none font-display uppercase h-11 mt-6" onClick={() => void saveTerms()}>Save partner terms</Button>
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
        <Button className="rounded-none font-display uppercase h-11 mt-6" onClick={() => void saveRates()}>Save engineering rates</Button>
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
        <Button className="rounded-none font-display uppercase h-11 mt-6" onClick={() => void saveBusiness()}>Save &amp; reload</Button>
      </section>
      <section className="border hairline bg-card p-6">
        <h3 className="font-display font-bold uppercase text-xl mb-1">Promotions — banner &amp; coupons</h3>
        <p className="font-tech text-[11px] text-muted-foreground mb-5">The banner shows under the header on every page while active. Coupons apply in the cart and at checkout: percent coupons round half up to the nearest naira; a discount never takes an order below ₦0. Orders record the coupon used and the discount given.</p>
        <div className="grid md:grid-cols-[1fr_auto] gap-5 items-end">
          <div><label className="label-tech">Promo banner text</label><input className="field-tech" value={promoForm.text} onChange={e => setPromoForm({ ...promoForm, text: e.target.value })} placeholder="e.g. Rainy-season offer: free delivery within Lagos on orders above ₦500,000" /></div>
          <label className="flex items-center gap-2 font-tech text-xs pb-2"><input type="checkbox" checked={promoForm.active} onChange={e => setPromoForm({ ...promoForm, active: e.target.checked })} /> Banner active</label>
        </div>
        <p className="label-tech mt-7 mb-3">Coupons ({couponsForm.length})</p>
        <div className="space-y-3">{couponsForm.map((c, ix) => (<div key={ix} className="flex flex-wrap gap-3 items-end border hairline p-3">
          <div><label className="label-tech">Code</label><input className="field-tech font-tech !w-36 uppercase" value={c.code} onChange={e => setCouponsForm(cs => cs.map((x, i) => (i === ix ? { ...x, code: e.target.value } : x)))} placeholder="WELCOME10" /></div>
          <div><label className="label-tech">Kind</label><select className="field-tech bg-background !w-32" value={c.kind} onChange={e => setCouponsForm(cs => cs.map((x, i) => (i === ix ? { ...x, kind: e.target.value as Coupon["kind"] } : x)))}><option value="percent">Percent %</option><option value="fixed">Fixed ₦</option></select></div>
          <div><label className="label-tech">Value</label><input className="field-tech font-tech !w-28" inputMode="numeric" value={c.value} onChange={e => setCouponsForm(cs => cs.map((x, i) => (i === ix ? { ...x, value: parseFloat(e.target.value) || 0 } : x)))} /></div>
          <div><label className="label-tech">Min spend ₦</label><input className="field-tech font-tech !w-32" inputMode="numeric" value={c.minSpend} onChange={e => setCouponsForm(cs => cs.map((x, i) => (i === ix ? { ...x, minSpend: parseFloat(e.target.value) || 0 } : x)))} /></div>
          <div><label className="label-tech">Expires (optional)</label><input type="date" className="field-tech font-tech !w-40" value={c.expiresAt ?? ""} onChange={e => setCouponsForm(cs => cs.map((x, i) => (i === ix ? { ...x, expiresAt: e.target.value || undefined } : x)))} /></div>
          <label className="flex items-center gap-2 font-tech text-xs pb-2"><input type="checkbox" checked={c.active} onChange={e => setCouponsForm(cs => cs.map((x, i) => (i === ix ? { ...x, active: e.target.checked } : x)))} /> Active</label>
          <button onClick={() => setCouponsForm(cs => cs.filter((_, i) => i !== ix))} className="font-tech text-[11px] border hairline px-2.5 py-2 mb-0.5 hover:border-destructive hover:text-destructive cursor-pointer">Delete</button>
        </div>))}</div>
        <div className="flex gap-3 mt-5 flex-wrap"><Button variant="outline" className="rounded-none font-display uppercase h-11" onClick={() => setCouponsForm(cs => [...cs, { code: "", kind: "percent", value: 10, minSpend: 0, active: true }])}>+ Add coupon</Button>
        <Button className="rounded-none font-display uppercase h-11" onClick={() => void savePromo()}>Save promotions</Button></div>
      </section>

      <section className="border hairline bg-card p-6">
        <h3 className="font-display font-bold uppercase text-xl mb-1">Price Watch — market prices for /prices</h3>
        <p className="font-tech text-[11px] text-muted-foreground mb-5">These are the ONLY numbers the public Price Watch page shows — add a dated point whenever you check the market, with its source (market, supplier, survey). Nothing is invented: with no points, the page honestly says the watch is launching soon.</p>
        <div className="flex flex-wrap gap-3 items-end mb-6">
          <div className="flex-1 min-w-52"><label className="label-tech">New material</label><input className="field-tech" value={pwNew.material} onChange={e => setPwNew({ ...pwNew, material: e.target.value })} placeholder="e.g. Longspan 0.45mm (per metre)" /></div>
          <div><label className="label-tech">Unit</label><input className="field-tech !w-36" value={pwNew.unit} onChange={e => setPwNew({ ...pwNew, unit: e.target.value })} /></div>
          <Button variant="outline" className="rounded-none font-display uppercase h-11" onClick={() => { if (pwNew.material.trim().length < 2) return toast.error("Name the material"); setPwForm(pw => [...pw, { material: pwNew.material.trim(), unit: pwNew.unit.trim() || "per unit", points: [] }]); setPwNew({ material: "", unit: "per metre" }); }}>+ Add material</Button>
        </div>
        <div className="space-y-5">{pwForm.map((m, mi) => (<div key={mi} className="border hairline p-4">
          <div className="flex flex-wrap gap-3 justify-between items-center"><p className="font-display font-semibold uppercase">{m.material} <span className="font-tech text-[11px] text-muted-foreground font-normal">{m.unit} · {m.points.length} point{m.points.length === 1 ? "" : "s"}</span></p>
          <button onClick={() => setPwForm(pw => pw.filter((_, i) => i !== mi))} className="font-tech text-[11px] border hairline px-2.5 py-1 hover:border-destructive hover:text-destructive cursor-pointer">Delete material</button></div>
          {m.points.length > 0 && <div className="mt-3 space-y-1">{m.points.map((pt, pi) => (<p key={pi} className="font-tech text-xs flex gap-3 flex-wrap"><span>{pt.date}</span><span className="font-semibold">{formatNGN(pt.priceNgn)}</span><span className="text-muted-foreground">{pt.source}</span><button onClick={() => setPwForm(pw => pw.map((x, i) => (i === mi ? { ...x, points: x.points.filter((_, j) => j !== pi) } : x)))} className="text-muted-foreground hover:text-destructive cursor-pointer">remove</button></p>))}</div>}
          <div className="flex flex-wrap gap-3 mt-3 items-end">
            <div><label className="label-tech">Date</label><input type="date" className="field-tech font-tech !w-40" value={pwPoint.date} onChange={e => setPwPoint({ ...pwPoint, date: e.target.value })} /></div>
            <div><label className="label-tech">Price ₦</label><input className="field-tech font-tech !w-32" inputMode="numeric" value={pwPoint.price} onChange={e => setPwPoint({ ...pwPoint, price: e.target.value })} /></div>
            <div className="flex-1 min-w-44"><label className="label-tech">Source</label><input className="field-tech font-tech" value={pwPoint.source} onChange={e => setPwPoint({ ...pwPoint, source: e.target.value })} placeholder="e.g. Ibafo market survey" /></div>
            <Button variant="outline" className="rounded-none font-display uppercase h-11" onClick={() => { const price = parseFloat(pwPoint.price) || 0; if (price <= 0) return toast.error("Enter the price"); if (!pwPoint.source.trim()) return toast.error("Add the source — price watch never shows unsourced numbers"); setPwForm(pw => pw.map((x, i) => (i === mi ? { ...x, points: [...x.points, { date: pwPoint.date, priceNgn: price, source: pwPoint.source.trim() }].sort((a, b) => a.date.localeCompare(b.date)) } : x))); setPwPoint({ ...pwPoint, price: "", source: "" }); }}>Add point</Button>
          </div>
        </div>))}</div>
        <Button className="rounded-none font-display uppercase h-11 mt-6" onClick={() => void savePriceWatch()}>Save price watch</Button>
      </section>
      <p className="font-tech text-[11px] text-muted-foreground">{live ? <>LIVE mode: saving here writes the settings document to the server (key <span className="text-primary">site</span>) and every visitor picks it up. A local copy is kept as cache.</> : <>Demo mode: settings live in this browser (localStorage, key <span className="text-primary">oketex-settings</span>) — they affect this device only. When the backend is live, the same saves go to the server so one change updates every visitor.</>}</p>
    </div>)}

    {tab === "verify" && (<section><h2 className="font-display font-bold uppercase text-2xl mb-4">Verification Requests ({verifyReqs.length})</h2>
      <p className="font-tech text-xs text-muted-foreground mb-4">Customers who asked a pro to verify an assistant quotation. Each request also created a Quote Verification Visit booking. Update the status as the job moves; record the pro note and the final confirmed total, then notify the customer on WhatsApp.</p>
      {!verifyReqs.length ? <p className="font-tech text-sm text-muted-foreground">None yet — customers request pro checks from the Assistant's quotation flow.</p> : <div className="space-y-4">{verifyReqs.map(r => (<div key={r.code} className="border hairline bg-card p-5">
        <div className="flex flex-wrap gap-3 justify-between"><div><p className="font-tech font-semibold">{r.code} — {r.name} ({r.phone}){r.priority && <span className="ml-2 font-tech text-[10px] border border-primary text-primary px-2 py-0.5 uppercase tracking-widest">Priority — Pro plan</span>}</p>
        <p className="font-tech text-[11px] text-muted-foreground mt-1">Quote {r.quoteCode} · {r.address} · Preferred: {r.preferredDate || "ASAP"} · Requested {new Date(r.createdAt).toLocaleString("en-NG")}</p></div>
        <span className="font-tech text-xs border hairline px-2.5 py-1 h-fit">{r.status}</span></div>
        <div className="flex flex-wrap gap-2 mt-4">{VERIFY_STATUSES.map(st => (<button key={st} onClick={() => patchVerify(r.code, { status: st as VerifyStatus })} className={`font-tech text-[11px] border px-3 py-1.5 cursor-pointer ${r.status === st ? "bg-primary text-primary-foreground border-primary" : "hairline hover:border-primary hover:text-primary"}`}>{st}</button>))}</div>
        <div className="grid md:grid-cols-[1fr_220px] gap-3 mt-4">
          <input defaultValue={r.proNote} onBlur={e => patchVerify(r.code, { proNote: e.target.value })} placeholder="Pro note — verified measurements, site findings…" className="field-tech font-tech" aria-label="Pro note" />
          <input defaultValue={r.finalTotal ?? ""} type="number" onBlur={e => patchVerify(r.code, { finalTotal: e.target.value ? parseFloat(e.target.value) : null })} placeholder="Final confirmed total ₦" className="field-tech font-tech" aria-label="Final total" />
        </div>
        <div className="mt-4"><a target="_blank" rel="noreferrer" href={waCustomer(r.phone, `Hello ${r.name}, update on your Oketex pro check ${r.code} (quote ${r.quoteCode}): status — ${r.status}.${r.finalTotal ? ` Final confirmed total: ${formatNGN(r.finalTotal)}.` : ""}${r.proNote ? ` Note: ${r.proNote}` : ""}`)} className="font-tech text-[11px] border hairline px-3 py-1.5 hover:border-primary hover:text-primary inline-block">Notify customer on WhatsApp</a></div>
      </div>))}</div>}</section>)}

    {tab === "plans" && (<div className="space-y-10"><section><h2 className="font-display font-bold uppercase text-2xl mb-4">Subscription Plans</h2>
      <p className="font-tech text-xs text-muted-foreground mb-4">These plans drive the /plans page and every Pro gate. Admin and business accounts always have full access free — plans never apply to you. Prices are launch defaults; change them here any time (existing activations keep their terms until expiry).</p>
      <div className="space-y-4">{plansForm.map((f, ix) => (<div key={f.id} className="border hairline bg-card p-5">
        <div className="flex flex-wrap gap-3 items-center justify-between"><p className="font-tech font-semibold">{f.id}</p><label className="flex items-center gap-2 font-tech text-xs"><input type="checkbox" checked={f.active} onChange={e => setPlansForm(pf => pf.map((x, i) => (i === ix ? { ...x, active: e.target.checked } : x)))} /> Active</label></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <div><label className="label-tech">Name</label><input value={f.name} onChange={e => setPlansForm(pf => pf.map((x, i) => (i === ix ? { ...x, name: e.target.value } : x)))} className="field-tech font-tech" /></div>
          <div><label className="label-tech">Price (₦)</label><input type="number" value={f.price} onChange={e => setPlansForm(pf => pf.map((x, i) => (i === ix ? { ...x, price: e.target.value } : x)))} className="field-tech font-tech" /></div>
          <div><label className="label-tech">Period (days, 0 = forever)</label><input type="number" value={f.days} onChange={e => setPlansForm(pf => pf.map((x, i) => (i === ix ? { ...x, days: e.target.value } : x)))} className="field-tech font-tech" /></div>
          <div><label className="label-tech">Blurb</label><input value={f.blurb} onChange={e => setPlansForm(pf => pf.map((x, i) => (i === ix ? { ...x, blurb: e.target.value } : x)))} className="field-tech font-tech" /></div>
        </div>
        <div className="mt-3"><label className="label-tech">Features (one per line — list ONLY features that exist)</label><textarea value={f.featuresText} onChange={e => setPlansForm(pf => pf.map((x, i) => (i === ix ? { ...x, featuresText: e.target.value } : x)))} className="field-tech font-tech min-h-[110px]" /></div>
      </div>))}</div>
      <Button className="rounded-none font-display uppercase mt-5" onClick={() => void savePlans()}>Save plans</Button></section>

      <section><h2 className="font-display font-bold uppercase text-2xl mb-4">Activation Codes</h2>
      <p className="font-tech text-xs text-muted-foreground mb-4">A customer pays on WhatsApp (or in the office) → you issue a code here → they redeem it on /plans or any gate screen. Codes work once only and start counting from redemption.</p>
      <div className="flex flex-wrap gap-3 items-end"><div><label className="label-tech">Plan</label><select value={issuePlanId} onChange={e => setIssuePlanId(e.target.value)} className="field-tech font-tech bg-background w-56">{getPlans().filter(pl => pl.priceNgn > 0).map(pl => <option key={pl.id} value={pl.id}>{pl.name} — {formatNGN(pl.priceNgn)}</option>)}</select></div>
      <Button className="rounded-none font-display uppercase" onClick={() => { const rec = issuePlanCode(issuePlanId); setPlanCodes(getPlanCodes()); toast.success(`Code issued: ${rec.code} — send it to the customer`); }}>Issue activation code</Button></div>
      <div className="border hairline mt-5 divide-y divide-white/10">{planCodes.length === 0 && <p className="px-4 py-5 font-tech text-xs text-muted-foreground">No codes issued yet.</p>}{planCodes.map(c => (<div key={c.code} className="px-4 py-3 flex flex-wrap gap-3 items-center justify-between"><p className="font-tech text-sm"><b>{c.code}</b> · {c.planId} · issued {new Date(c.createdAt).toLocaleDateString("en-NG")}</p>
        <div className="flex items-center gap-3"><span className="font-tech text-[11px] text-muted-foreground">{c.revoked ? "REVOKED" : c.usedAt ? `Used ${new Date(c.usedAt).toLocaleDateString("en-NG")}` : "Unused"}</span>{!c.usedAt && !c.revoked && <button onClick={() => { revokePlanCode(c.code); setPlanCodes(getPlanCodes()); }} className="font-tech text-[11px] border hairline px-2.5 py-1 hover:border-destructive hover:text-destructive cursor-pointer">Revoke</button>}</div></div>))}</div>
      </section></div>)}

    {tab === "jobs" && (<section><h2 className="font-display font-bold uppercase text-2xl mb-4">Job Board ({adminJobs.length})</h2>
      <p className="font-tech text-xs text-muted-foreground mb-4">Jobs customers post for partners to bid on. Close a job to stop new bids, reopen it, or remove it. Awarding happens on the customer's tracking page (they pick the bid they want) — accepting a bid automatically opens a lead with the commission snapshotted.</p>
      {!adminJobs.length ? <p className="font-tech text-sm text-muted-foreground">No jobs posted yet.</p> : <div className="space-y-4">{adminJobs.map(({ job, bids }) => (<div key={job.code} className="border hairline bg-card p-5">
        <div className="flex flex-wrap gap-3 justify-between"><div><p className="font-tech font-semibold">{job.code} — {job.title}</p><p className="font-tech text-[11px] text-muted-foreground mt-1">{job.trade} · {job.location} · Budget {budgetLabel(job)} · {job.customerName} ({job.customerPhone}) · {new Date(job.createdAt).toLocaleString("en-NG")}{job.sourceQuoteCode ? ` · from ${job.sourceQuoteCode}` : ""}</p><p className="text-sm text-muted-foreground mt-1 max-w-2xl">{job.description}</p></div>
        <div className="flex gap-2 items-start"><StatusBadge status={job.status} />
          {job.status !== "Closed" ? <button onClick={() => { void updateJobStatusAsync(job.code, "Closed"); refresh(); }} className="font-tech text-[11px] border hairline px-2.5 py-1 hover:border-amber-500 hover:text-amber-400 cursor-pointer">Close</button> : <button onClick={() => { void updateJobStatusAsync(job.code, "Open"); refresh(); }} className="font-tech text-[11px] border hairline px-2.5 py-1 hover:border-primary hover:text-primary cursor-pointer">Reopen</button>}
          <button onClick={() => { if (window.confirm(`Delete job ${job.code}?`)) { deleteJob(job.code); refresh(); } }} className="font-tech text-[11px] border hairline px-2.5 py-1 hover:border-destructive hover:text-destructive cursor-pointer">Delete</button></div></div>
        {bids.length > 0 && <div className="mt-3 border-t hairline pt-3 space-y-1.5">{bids.map(b => (<p key={b.id} className="font-tech text-xs flex flex-wrap gap-x-3"><span className="font-semibold">{b.partnerName || b.partnerCode}</span><span>{formatNGN(b.amount)}</span><span className="text-muted-foreground">{b.days ? `${b.days} days` : ""}</span><span className={b.status === "Accepted" ? "text-emerald-400" : b.status === "Rejected" ? "text-red-400" : "text-muted-foreground"}>{b.status}</span>{b.note && <span className="text-muted-foreground">· {b.note}</span>}</p>))}</div>}
      </div>))}</div>}</section>)}

    {tab === "reviews" && (<section><h2 className="font-display font-bold uppercase text-2xl mb-4">Partner Reviews ({adminReviews.length})</h2>
      <p className="font-tech text-xs text-muted-foreground mb-4">Reviews publish from real customers with a reference code. Hide anything abusive or unverifiable — hidden reviews stop counting in partner averages immediately.</p>
      {!adminReviews.length ? <p className="font-tech text-sm text-muted-foreground">No reviews yet.</p> : <div className="border hairline">{adminReviews.map((r, i) => (<div key={r.id} className={`px-5 py-4 ${i > 0 ? "border-t hairline" : ""}`}>
        <div className="flex flex-wrap gap-3 justify-between"><div><p className="font-tech text-sm"><span className="text-primary">{starsText(r.rating)}</span> <span className="font-semibold">{r.customerName}</span> <span className="text-muted-foreground">→ partner {r.partnerCode} · ref {r.refCode} · {new Date(r.createdAt).toLocaleDateString("en-NG")}</span></p><p className="text-sm text-muted-foreground mt-1 max-w-2xl">{r.text}</p></div>
        <div className="flex gap-2 items-start"><span className={`font-tech text-[10px] uppercase tracking-widest border px-2 py-0.5 ${r.status === "Published" ? "border-emerald-500/60 text-emerald-400" : "hairline text-muted-foreground"}`}>{r.status}</span>
          {r.status === "Published" ? <button onClick={() => { void setReviewStatusAsync(r.id, "Hidden"); refresh(); }} className="font-tech text-[11px] border hairline px-2.5 py-1 hover:border-amber-500 hover:text-amber-400 cursor-pointer">Hide</button> : <button onClick={() => { void setReviewStatusAsync(r.id, "Published"); refresh(); }} className="font-tech text-[11px] border hairline px-2.5 py-1 hover:border-primary hover:text-primary cursor-pointer">Unhide</button>}
          <button onClick={() => { if (window.confirm("Delete this review permanently?")) { void deleteReviewAsync(r.id); refresh(); } }} className="font-tech text-[11px] border hairline px-2.5 py-1 hover:border-destructive hover:text-destructive cursor-pointer">Delete</button></div></div>
      </div>))}</div>}</section>)}

    {tab === "notifications" && (<section><h2 className="font-display font-bold uppercase text-2xl mb-4">Notifications ({adminNotifications.length})</h2>
      <p className="font-tech text-xs text-muted-foreground mb-4">Every booking, lead, verification, invoice and order event writes a message here. Send any item on WhatsApp in one tap. SMS/email auto-dispatch only works when the office configures Termii (SMS) or Resend (email) keys on the server — until then items stay <b>logged</b>, never fake-sent.</p>
      <Button className="rounded-none font-display uppercase mb-5" onClick={() => { void dispatchNotificationsAsync().then(r => { refresh(); if (!r.enabled) toast.message("Auto-dispatch is not configured — no SMS/email keys on the server. Items stay logged; send them on WhatsApp."); else toast.success(`Dispatch attempted ${r.attempted} — ${r.sent} sent`); }); }}>Dispatch queued SMS/email</Button>
      {!adminNotifications.length ? <p className="font-tech text-sm text-muted-foreground">No notifications yet — they appear as events happen.</p> : <div className="space-y-3">{adminNotifications.map(n => { const wa = notificationWaLink(n); return (<div key={n.id} className="border hairline bg-card p-4">
        <div className="flex flex-wrap gap-2 items-center justify-between"><p className="font-tech text-[11px] text-muted-foreground">{new Date(n.ts).toLocaleString("en-NG")} · {n.templateKey} · ref {n.refCode} · to {n.audience}{n.phone ? ` (${n.phone})` : ""}</p>
        <span className={`font-tech text-[10px] uppercase tracking-widest border px-2 py-0.5 ${n.status === "sent" ? "border-emerald-500/60 text-emerald-400" : n.status === "queued" ? "border-primary text-primary" : "hairline text-muted-foreground"}`}>{n.status}</span></div>
        <p className="text-sm mt-2 whitespace-pre-line">{n.message}</p>
        <div className="flex gap-2 mt-3 flex-wrap">{wa && <a href={wa} target="_blank" rel="noreferrer" onClick={() => { void markNotificationSentAsync(n.id); setTimeout(refresh, 400); }} className="font-tech text-[11px] border hairline px-3 py-1.5 hover:border-primary hover:text-primary">Send via WhatsApp</a>}
        {n.status !== "sent" && <button onClick={() => { void markNotificationSentAsync(n.id); refresh(); }} className="font-tech text-[11px] border hairline px-3 py-1.5 hover:border-primary hover:text-primary cursor-pointer">Mark sent</button>}</div>
      </div>); })}</div>}</section>)}

    {tab === "catalog" && (<section><h2 className="font-display font-bold uppercase text-2xl mb-4">Catalog ({products.length} products, {categories.length} categories)</h2><div className="border hairline">{products.map((p, i) => (<div key={p.id} className={`px-5 py-3 flex justify-between text-sm ${i > 0 ? "border-t hairline" : ""}`}><span>{p.name}</span><span className="font-tech">{formatNGN(p.priceNgn)} {p.unit} · stock {p.stock}</span></div>))}</div></section>)}

    <Button variant="outline" className="rounded-none font-display uppercase" onClick={() => { sessionStorage.removeItem("oketex-admin"); if (apiLiveSync()) void authLogout(); setOk(false); }}>Sign out</Button>
  </div></div>);
}
