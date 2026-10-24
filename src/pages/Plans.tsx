import { PageHead } from "@/components/StatusBadge";
import { Check, Crown, HardHat, Ruler, Store, Building2 } from "lucide-react";
import { formatNGN } from "@/lib/money";
import { getPlans, useEntitlements } from "@/lib/plans";
import { UpgradePanel } from "@/components/PlanGate";
import { getBusiness } from "@/lib/settings";

export default function Plans() {
  const plans = getPlans().filter(p => p.active);
  const e = useEntitlements();
  const b = getBusiness();
  return (<div><PageHead kicker="Plans — Honest Pricing" title="Free for customers. Pro for professionals." lead="Shopping, the Pro Calculator, bookings and tracking are free forever. The paid plans unlock the professional paperwork and measurement toolkit — and every feature listed here exists and works today." />
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      {e.isAdmin && <div className="border border-primary bg-primary/10 p-5 mb-8 flex items-center gap-3"><Crown className="h-6 w-6 text-primary shrink-0" /><p className="font-tech text-sm">You are on an <b>admin / business account — full access, always free</b>. Plan gates never apply to the business itself.</p></div>}
      {e.isPro && !e.isAdmin && <div className="border border-primary bg-primary/10 p-5 mb-8 font-tech text-sm">Your <b>{e.planName}</b> plan is active{e.daysLeft !== null ? ` — ${e.daysLeft} day${e.daysLeft === 1 ? "" : "s"} left` : ""}. Renew below with a new code when it runs out; expiry returns you to Free (your saved work is never deleted).</div>}
      {e.expired && <div className="border border-amber-500/60 bg-amber-500/10 p-5 mb-8 font-tech text-sm">Your Pro plan has <b>expired</b> — you are on Free until you renew. Your projects and documents are still here; Pro limits apply again until renewal.</div>}

      <div className="grid md:grid-cols-3 gap-5">{plans.map(p => (<section key={p.id} className={`border p-6 flex flex-col ${p.priceNgn > 0 ? "border-primary bg-card" : "hairline bg-card"}`}>
        {p.priceNgn > 0 && <p className="font-tech text-[10px] uppercase tracking-widest text-primary mb-2">Most popular for pros</p>}
        <h2 className="font-display font-bold uppercase text-2xl">{p.name}</h2>
        <p className="font-display font-bold text-4xl text-primary mt-3">{p.priceNgn > 0 ? formatNGN(p.priceNgn) : "₦0"}<span className="font-tech text-xs text-muted-foreground font-normal">{p.periodDays > 0 ? ` / ${p.periodDays} days` : " forever"}</span></p>
        <p className="text-sm text-muted-foreground mt-2">{p.blurb}</p>
        <ul className="mt-5 space-y-2.5 flex-1">{p.features.map(f => (<li key={f} className="flex gap-2.5 text-sm"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />{f}</li>))}</ul>
      </section>))}</div>

      <h2 className="font-display font-bold uppercase text-3xl mt-14">Who Pro is for</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-5">
        {[
          { icon: HardHat, t: "Roofers & Installers", d: "Unlimited take-off projects, quotations and contracts on your own letterhead, and video measurement on site." },
          { icon: Ruler, t: "Engineers & Surveyors", d: "A real site notebook, measurement sheets and document vault that travel with every job." },
          { icon: Building2, t: "Contractors & Builders", d: "Standard-form contracts with payment schedules, digital invoices with balance tracking, client-ready paperwork in minutes." },
          { icon: Store, t: "Sellers & Partner Pros", d: "Priority pro-check requests from assistant quotations, plus the full paperwork kit for jobs won through the network." },
        ].map(c => { const Icon = c.icon; return (<div key={c.t} className="border hairline bg-card p-5"><Icon className="h-6 w-6 text-primary" /><h3 className="font-display font-semibold uppercase mt-3">{c.t}</h3><p className="text-sm text-muted-foreground mt-1.5">{c.d}</p></div>); })}
      </div>

      <div className="border hairline bg-card p-6 mt-10"><h2 className="font-display font-bold uppercase text-2xl flex items-center gap-2"><Crown className="h-5 w-5 text-primary" /> Business &amp; admin accounts: always free</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl">Plans exist so professionals who build their business on these tools share the cost of running them. The {b.name} team itself — and any admin account — always has full access at no charge, with no expiry and no activation codes. If you are staff, sign in with your admin account and everything simply works.</p></div>

      <h2 className="font-display font-bold uppercase text-3xl mt-12">Activate Pro</h2>
      <UpgradePanel />
      <p className="font-tech text-[11px] text-muted-foreground mt-8">No overselling: if a feature is not listed above, it is not part of a plan. Prices and plan contents are set by the admin and may change for future activations — an activated plan keeps its terms until it expires.</p>
    </div></div>);
}
