import { useState } from "react";
import { Link } from "react-router";
import { BadgeCheck, CheckCircle2, Copy, MessageCircle, Plus, Star, X } from "lucide-react";
import { PageHead } from "@/components/StatusBadge";
import { formatNGN } from "@/lib/money";
import { addPartnerAsync, partnerCode, type Partner } from "@/lib/partnerStorage";
import { register as registerAccount } from "@/lib/auth";
import { probeApi } from "@/lib/api";
import { PRO_TRADES, SELLER_CATEGORIES, type PartnerRole } from "@/data/partnerTerms";
import { getPartnerTerms, businessWaLink } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProdRow { name: string; price: string; unit: string }
const EMPTY_ROW: ProdRow = { name: "", price: "", unit: "per piece" };

export default function Join() {
  const TERMS = getPartnerTerms();
  const [role, setRole] = useState<PartnerRole>("pro");
  const [form, setForm] = useState({ business: "", contact: "", phone: "", email: "", location: "", areas: "", years: "", cac: "", bio: "", password: "" });
  const [tags, setTags] = useState<string[]>([]);
  const [supplyText, setSupplyText] = useState("");
  const [rows, setRows] = useState<ProdRow[]>([{ ...EMPTY_ROW }]);
  const [agree, setAgree] = useState(false);
  const [created, setCreated] = useState<Partner | null>(null);

  const toggleTag = (t: string) => setTags(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]));
  const tagOptions = role === "pro" ? [...PRO_TRADES] : role === "seller" ? [...SELLER_CATEGORIES] : [...PRO_TRADES, ...SELLER_CATEGORIES];

  const submit = async () => {
    if (form.business.trim().length < 2) return toast.error("Enter your business name");
    if (form.contact.trim().length < 2) return toast.error("Enter a contact person name");
    if (form.phone.replace(/\D/g, "").length < 10) return toast.error("Enter a valid phone / WhatsApp number (at least 10 digits)");
    if (form.location.trim().length < 2) return toast.error("Enter your base location (city / state)");
    if (role === "both" ? !(tags.some(t => (PRO_TRADES as readonly string[]).includes(t)) && tags.some(t => (SELLER_CATEGORIES as readonly string[]).includes(t))) : !tags.length) return toast.error(role === "both" ? "Pick at least one trade AND one category" : role === "pro" ? "Pick at least one trade" : "Pick at least one category");
    if (!agree) return toast.error("Please agree to the partner launch terms");
    const partner: Partner = {
      code: partnerCode(), role,
      businessName: form.business.trim(), contactName: form.contact.trim(),
      phone: form.phone.trim(), email: form.email.trim() || undefined,
      location: form.location.trim(), areas: form.areas.trim() || form.location.trim(),
      trades: role === "pro" ? tags : role === "both" ? tags.filter(t => (PRO_TRADES as readonly string[]).includes(t)) : [], categories: role === "seller" ? tags : role === "both" ? tags.filter(t => (SELLER_CATEGORIES as readonly string[]).includes(t)) : [],
      supplyCapabilities: role === "pro" ? [] : supplyText.split(/\n|,|;/).map(x => x.trim()).filter(Boolean),
      yearsExperience: form.years ? Math.max(0, parseInt(form.years, 10) || 0) : undefined,
      cacNumber: form.cac.trim() || undefined, bio: form.bio.trim(),
      products: role !== "pro" ? rows.filter(r => r.name.trim() && parseInt(r.price.replace(/\D/g, ""), 10) > 0).map(r => ({ id: Math.random().toString(36).slice(2, 9), name: r.name.trim(), priceNgn: parseInt(r.price.replace(/\D/g, ""), 10), unit: r.unit || "per piece" })) : [],
      status: "pending", verified: false, featured: false,
      createdAt: new Date().toISOString(),
    };
    await addPartnerAsync(partner);
    // Phase 5: when the backend is live and the partner chose a password,
    // also create their login (attached to this partner code) so
    // /partner-status and /account work with real credentials.
    if (form.password && form.password.length >= 8 && form.email.trim() && (await probeApi())) {
      try { await registerAccount({ name: form.contact.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password, partnerCode: partner.code }); }
      catch { /* account is a bonus — the application itself is saved */ }
    }
    setCreated(partner);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (created) {
    const notify = businessWaLink(`Hello Oketex, I just registered on the Partner Network.\n\nBusiness: ${created.businessName}\nRole: ${created.role === "pro" ? "Pro" : created.role === "seller" ? "Seller" : "Pro + Seller (both)"}\nPartner code: ${created.code}\nPhone: ${created.phone}\nLocation: ${created.location}\n\nPlease review my application.`);
    return (<div>
      <PageHead kicker="Partner Network" title="Application received" lead="Your listing is pending review by the Oketex team. Keep your partner code safe — you need it to check your status and see your leads." />
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <CheckCircle2 className="h-14 w-14 text-primary mx-auto" />
        <p className="label-tech mt-6">Your partner code</p>
        <p className="font-display font-bold text-4xl md:text-5xl text-primary mt-2 tracking-wide">{created.code}</p>
        <button className="mt-4 inline-flex items-center gap-2 font-tech text-xs uppercase tracking-widest text-muted-foreground hover:text-primary" onClick={() => { navigator.clipboard.writeText(created.code); toast.success("Partner code copied"); }}><Copy className="h-4 w-4" /> Copy code</button>
        <div className="border hairline bg-card p-6 mt-8 text-left">
          <p className="label-tech mb-3">What happens next</p>
          <ol className="space-y-2 text-sm">
            <li className="flex gap-3"><span className="text-primary">01</span> Oketex reviews your application (usually within 1–2 working days).</li>
            <li className="flex gap-3"><span className="text-primary">02</span> Once approved, your listing goes live in the directory.{created.role !== "seller" ? " Jobs get assigned to you by the office — leads, job-board wins and Snap & Send dispatches." : ""}{created.role !== "pro" ? " Sellers receive orders routed by admin — and Supply Requests when Oketex itself needs your items." : ""}</li>
            <li className="flex gap-3"><span className="text-primary">03</span> Optional upgrades: <BadgeCheck className="inline h-4 w-4 text-primary -mt-0.5" /> Verified badge {formatNGN(TERMS.verificationFeeNgn)} one-time · <Star className="inline h-4 w-4 text-primary -mt-0.5" /> Featured {formatNGN(TERMS.featuredFeeNgn)}/month (current launch terms).</li>
          </ol>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <a href={notify} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-display font-semibold uppercase tracking-wider px-6 h-12 hover:bg-primary/90"><MessageCircle className="h-4 w-4" /> Notify Oketex on WhatsApp</a>
          <Link to="/partner-status" className="inline-flex items-center gap-2 border border-foreground/40 font-display font-semibold uppercase tracking-wider px-6 h-12 hover:border-primary hover:text-primary">Check your status</Link>
        </div>
      </div>
    </div>);
  }

  return (<div>
    <PageHead kicker="Partner Network — Register" title="Join as a Pro, Seller — or Both" lead="Register free. The network runs BOTH directions through the Oketex office: pros and engineers get jobs assigned to them (leads, job-board wins, Snap & Send dispatches); sellers receive customer orders — and can also supply Oketex itself when the factory raises a Supply Request. Oketex approves every listing and tracks every deal." />
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 grid lg:grid-cols-[1fr_380px] gap-10">
      <div className="space-y-8">
        <div>
          <p className="label-tech mb-4">01 — I am a…</p>
          <div className="flex gap-px bg-border border hairline w-fit">
            {([["pro", "Professional / Pro"], ["seller", "Materials Seller"], ["both", "Both — Pro + Seller"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => { setRole(v); setTags([]); }} className={cn("px-6 py-3 font-display font-semibold uppercase tracking-wider cursor-pointer", role === v ? "bg-primary text-primary-foreground" : "bg-background hover:text-primary")}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="label-tech mb-4">02 — Business details</p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div><label className="label-tech" htmlFor="j-business">Business name *</label><input id="j-business" className="field-tech" value={form.business} onChange={e => setForm({ ...form, business: e.target.value })} placeholder="e.g. Musa Building Services" /></div>
            <div><label className="label-tech" htmlFor="j-contact">Contact person *</label><input id="j-contact" className="field-tech" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="Full name" /></div>
            <div><label className="label-tech" htmlFor="j-phone">Phone / WhatsApp *</label><input id="j-phone" className="field-tech" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0803 000 0000" /></div>
            <div><label className="label-tech" htmlFor="j-email">Email (optional)</label><input id="j-email" type="email" className="field-tech" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@business.ng" /></div>
            <div><label className="label-tech" htmlFor="j-location">Base location (city / state) *</label><input id="j-location" className="field-tech" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Ajah, Lagos" /></div>
            <div><label className="label-tech" htmlFor="j-areas">Areas you serve / deliver to</label><input id="j-areas" className="field-tech" value={form.areas} onChange={e => setForm({ ...form, areas: e.target.value })} placeholder="e.g. Lagos, Ogun, Oyo" /></div>
            {role !== "seller" && (<>
              <div><label className="label-tech" htmlFor="j-years">Years of experience</label><input id="j-years" inputMode="numeric" className="field-tech" value={form.years} onChange={e => setForm({ ...form, years: e.target.value })} placeholder="e.g. 8" /></div>
              <div><label className="label-tech" htmlFor="j-cac">CAC number (optional)</label><input id="j-cac" className="field-tech" value={form.cac} onChange={e => setForm({ ...form, cac: e.target.value })} placeholder="RC number if registered" /></div>
            </>)}
            <div><label className="label-tech" htmlFor="j-password">Account password (optional)</label><input id="j-password" type="password" className="field-tech" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="8+ characters — for partner login" /><p className="font-tech text-[10px] text-muted-foreground mt-1">Set a password (with an email above) to create a partner login when our backend is live. You can always use your partner code instead.</p></div>
            <div className="sm:col-span-2"><label className="label-tech" htmlFor="j-bio">About your business</label><textarea id="j-bio" rows={3} className="field-tech resize-none" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="What you do, typical jobs, why customers should pick you…" /></div>
          </div>
        </div>
        <div>
          <p className="label-tech mb-4">03 — {role === "pro" ? "Your trades" : role === "seller" ? "What you sell" : "Your trades & what you sell"}</p>
          <div className="flex flex-wrap gap-2">{tagOptions.map(t => (<button key={t} onClick={() => toggleTag(t)} className={cn("border px-3 py-2 font-tech text-xs uppercase tracking-wider cursor-pointer", tags.includes(t) ? "border-primary bg-primary/15 text-primary" : "hairline hover:border-primary/60")}>{t}</button>))}</div>
        </div>
        {role !== "pro" && (
          <div>
            <p className="label-tech mb-4">04 — Your products (shown on your storefront)</p>
            <div className="space-y-3">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_130px_120px_36px] gap-3">
                  <input className="field-tech" placeholder="Product name" value={r.name} onChange={e => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label={`Product ${i + 1} name`} />
                  <input className="field-tech" placeholder="Price ₦" inputMode="numeric" value={r.price} onChange={e => setRows(rows.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} aria-label={`Product ${i + 1} price`} />
                  <input className="field-tech" placeholder="Unit" value={r.unit} onChange={e => setRows(rows.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} aria-label={`Product ${i + 1} unit`} />
                  <button className="hover:text-red-400 cursor-pointer" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove product row"><X className="h-4 w-4 mx-auto" /></button>
                </div>
              ))}
              <button onClick={() => setRows([...rows, { ...EMPTY_ROW }])} className="inline-flex items-center gap-2 font-tech text-xs uppercase tracking-widest text-primary cursor-pointer"><Plus className="h-4 w-4" /> Add product</button>
            </div>
          </div>
        )}
        {role !== "pro" && (
          <div>
            <p className="label-tech mb-4">05 — What you can supply Oketex</p>
            <p className="font-tech text-[11px] text-muted-foreground mb-3">Items and equipment you sell or hire out to the Oketex factory itself — one per line. When admin raises a Supply Request matching this list, you are invited to quote; quotes stay private between you and Oketex, and procurement carries no commission.</p>
            <textarea rows={3} className="field-tech resize-none" value={supplyText} onChange={e => setSupplyText(e.target.value)} placeholder={"Aluminium coils 0.45mm\nRain gutters & downpipes\nGenerator hire (20kVA)"} aria-label="What you can supply Oketex" />
          </div>
        )}
      </div>

      <aside className="border hairline bg-card h-fit lg:sticky lg:top-28">
        <div className="px-6 py-4 border-b hairline"><span className="label-tech">Launch terms — please read</span></div>
        <div className="px-6 py-6 space-y-4 text-sm">
          <div className="flex justify-between border-b hairline pb-3"><span className="text-muted-foreground">Registration</span><span className="font-display font-bold text-primary">FREE</span></div>
          <div className="flex justify-between border-b hairline pb-3"><span className="text-muted-foreground">Referral commission</span><span className="font-tech">{TERMS.referralCommissionPct}% of any job / supply order you WIN through an Oketex lead</span></div>
          <div className="flex justify-between border-b hairline pb-3"><span className="text-muted-foreground">Verified badge (optional)</span><span className="font-tech">{formatNGN(TERMS.verificationFeeNgn)} one-time</span></div>
          <div className="flex justify-between border-b hairline pb-3"><span className="text-muted-foreground">Featured placement (optional)</span><span className="font-tech">{formatNGN(TERMS.featuredFeeNgn)} / month</span></div>
          <p className="font-tech text-[11px] text-muted-foreground">{TERMS.currencyNote} Commission is charged to you (the partner), never added to the customer's price. Current launch terms — Oketex will notify partners before any change.</p>
          <div className="border hairline p-4">
            <p className="label-tech mb-2">Admin-routed deals — the network rule</p>
            <p className="font-tech text-[11px] text-muted-foreground">All customers and jobs that come through Oketex are served through Oketex admin. Contact details are exchanged by admin when a job is assigned. Taking platform customers off-platform to avoid commission may lead to removal from the network.</p>
          </div>
          <label className="flex items-start gap-3 cursor-pointer border hairline p-4 hover:border-primary/60">
            <Checkbox checked={agree} onCheckedChange={v => setAgree(!!v)} className="mt-0.5" />
            <span>I agree to the Oketex Partner Network launch terms above, including the {TERMS.referralCommissionPct}% referral commission on work I win through Oketex leads.</span>
          </label>
          <Button className="w-full rounded-none h-12 font-display font-semibold uppercase tracking-wider" onClick={submit}>Submit application</Button>
          <p className="font-tech text-[11px] text-muted-foreground">Already registered? <Link to="/partner-status" className="text-primary">Check your status & leads →</Link></p>
        </div>
      </aside>
    </div>
  </div>);
}
