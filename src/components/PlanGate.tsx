import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Lock, Check, MessageCircle, KeyRound, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNGN } from "@/lib/money";
import { getPlans, useEntitlements, redeemPlanCode, planWhatsAppLink, type PlanDef } from "@/lib/plans";

/** Activation panel: WhatsApp purchase (payment settles offline, admin sends a code) + code entry. */
export function UpgradePanel() {
  const plans = getPlans().filter(p => p.active);
  const paid = plans.filter(p => p.priceNgn > 0);
  const [code, setCode] = useState("");
  const redeem = () => {
    const r = redeemPlanCode(code);
    if (r.ok) { toast.success(`${r.plan.name} activated — enjoy full pro access.`); setCode(""); }
    else toast.error(r.error);
  };
  return (<div className="grid md:grid-cols-2 gap-6 mt-6 text-left">
    <div className="border hairline bg-card p-5">
      <p className="label-tech mb-3">1 — Get a plan on WhatsApp</p>
      <div className="space-y-3">{paid.map(p => (<div key={p.id} className="flex items-center justify-between gap-3 border hairline px-4 py-3">
        <div><p className="font-display font-semibold uppercase">{p.name}</p><p className="font-tech text-xs text-muted-foreground">{formatNGN(p.priceNgn)} / {p.periodDays} days</p></div>
        <Button asChild className="rounded-none font-display uppercase text-xs shrink-0"><a target="_blank" rel="noreferrer" href={planWhatsAppLink(p)}><MessageCircle className="h-3.5 w-3.5 mr-1" /> Activate</a></Button>
      </div>))}
      </div>
      <p className="font-tech text-[11px] text-muted-foreground mt-3">Payment settles with the office on WhatsApp (transfer or card link), then the admin sends your activation code. When the production backend is live, activation becomes instant in-app checkout.</p>
    </div>
    <div className="border hairline bg-card p-5">
      <p className="label-tech mb-3">2 — Enter your activation code</p>
      <div className="flex gap-2"><input value={code} onChange={e => setCode(e.target.value)} placeholder="PLAN-XXXXXX" className="field-tech font-tech uppercase" aria-label="Activation code" /><Button onClick={redeem} className="rounded-none font-display uppercase shrink-0"><KeyRound className="h-4 w-4 mr-1" /> Redeem</Button></div>
      <p className="font-tech text-[11px] text-muted-foreground mt-3">Codes work once only and start counting from the day you redeem them. Business / admin accounts never need a code — full access is always free for the business.</p>
      <p className="font-tech text-[11px] mt-3"><Link to="/plans" className="text-primary hover:underline">Compare Free vs Pro →</Link></p>
    </div>
  </div>);
}

function MiniCompare() {
  const plans = getPlans().filter(p => p.active);
  return (<div className="grid sm:grid-cols-3 gap-3 mt-6 text-left">{plans.map(p => (<div key={p.id} className={`border p-4 ${p.priceNgn > 0 ? "border-primary bg-primary/5" : "hairline bg-card"}`}>
    <p className="font-display font-bold uppercase">{p.name}</p>
    <p className="font-tech text-primary mt-1">{p.priceNgn > 0 ? `${formatNGN(p.priceNgn)} / ${p.periodDays} days` : "₦0 — always"}</p>
    <ul className="mt-3 space-y-1.5">{p.features.slice(0, 5).map(f => (<li key={f} className="font-tech text-[11px] flex gap-2"><Check className="h-3 w-3 text-primary shrink-0 mt-0.5" />{f}</li>))}</ul>
  </div>))}</div>);
}

/** Full lock screen. Renders children instead when the user is entitled (Pro or admin). */
export default function PlanGate({ feature, children }: { feature: string; children: React.ReactNode }) {
  const e = useEntitlements();
  if (e.isPro) return <>{children}</>;
  return (<div className="border hairline bg-card p-6 sm:p-8 text-center max-w-4xl mx-auto">
    <Lock className="h-10 w-10 text-primary mx-auto" />
    <h3 className="font-display font-bold uppercase text-2xl mt-4">{feature} is a Pro feature</h3>
    <p className="text-muted-foreground mt-2 max-w-xl mx-auto text-sm">You are on the <b className="text-foreground">Free</b> plan{e.expired ? " — your Pro plan has expired" : ""}. Upgrade to Pro to unlock {feature.toLowerCase()} and the rest of the professional toolkit. Customer shopping, booking and tracking always stay free.</p>
    <MiniCompare />
    <UpgradePanel />
  </div>);
}

/** Small chip showing the current plan (header areas of Workspace / Documents / Snap-Measure). */
export function PlanChip() {
  const e = useEntitlements();
  if (e.isAdmin) return (<span className="font-tech text-[10px] uppercase tracking-widest border border-primary text-primary px-2.5 py-1 inline-flex items-center gap-1.5"><Crown className="h-3 w-3" /> Admin — full access (free)</span>);
  if (e.isPro) return (<Link to="/plans" className="font-tech text-[10px] uppercase tracking-widest border border-primary text-primary px-2.5 py-1 inline-flex items-center gap-1.5 hover:bg-primary hover:text-primary-foreground"><Crown className="h-3 w-3" /> {e.planName}{e.daysLeft !== null ? ` — ${e.daysLeft} day${e.daysLeft === 1 ? "" : "s"} left` : ""}</Link>);
  return (<Link to="/plans" className="font-tech text-[10px] uppercase tracking-widest border hairline px-2.5 py-1 inline-flex items-center gap-1.5 hover:border-primary hover:text-primary">{e.expired ? "Pro expired — renew" : "Free plan — Go Pro"}</Link>);
}
export type { PlanDef };
