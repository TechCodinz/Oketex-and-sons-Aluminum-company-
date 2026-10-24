import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Briefcase, CheckCircle2, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHead } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatNGN } from "@/lib/money";
import { PRO_TRADES } from "@/data/partnerTerms";
import { getJobs, getJobsAsync, postJobAsync, bidsForJob, budgetLabel, type Job } from "@/lib/jobs";
import { getQuotes } from "@/lib/storage";
import { getEstimates } from "@/lib/projectEstimator";

const TRADES = [...PRO_TRADES, "General Building", "Other"];
export default function Jobs() {
  const [params] = useSearchParams();
  const from = params.get("from") || "";
  const [jobs, setJobs] = useState<Job[]>(() => getJobs().filter(j => j.status === "Open"));
  const [tradeFilter, setTradeFilter] = useState("");
  const [showForm, setShowForm] = useState(!!from);
  const [done, setDone] = useState<string | null>(null);
  const [form, setForm] = useState(() => {
    const base = { title: "", trade: "Roofer", description: "", location: "", budgetLow: "", budgetHigh: "", name: "", phone: "", sourceQuoteCode: "" as string };
    if (from.toUpperCase().startsWith("QT-")) {
      const q = getQuotes().find(x => x.code.toUpperCase() === from.toUpperCase());
      if (q) return { ...base, title: `Roofing job — ${q.roofType}`, trade: "Roofer", description: `Based on saved quotation ${q.code} (${q.areaM2} m², estimate ${formatNGN(q.estimateNgn)}). ${q.boqSummary ? q.boqSummary.split("\n").slice(0, 3).join(" ") : ""}`.trim(), budgetLow: String(Math.round(q.estimateNgn * 0.9)), budgetHigh: String(Math.round(q.estimateNgn * 1.1)), name: q.name || "", phone: q.phone || "", sourceQuoteCode: q.code };
    }
    if (from.toUpperCase().startsWith("EST-")) {
      const e = getEstimates().find(x => x.code.toUpperCase() === from.toUpperCase());
      if (e) return { ...base, title: `${e.styleName} — ${e.tradeLabel}`, description: `Based on saved estimate ${e.code}: ${e.tradeLabel}, ${e.styleName}. Priced materials total ${formatNGN(e.pricedTotal)}${e.unpricedCount ? ` plus ${e.unpricedCount} item(s) to confirm` : ""}.`, budgetLow: String(Math.round(e.pricedTotal * 0.9)), budgetHigh: String(Math.round(e.pricedTotal * 1.1)), sourceQuoteCode: e.code };
    }
    return base;
  });
  useEffect(() => { let on = true; getJobsAsync().then(list => { if (on) setJobs(list.filter(j => j.status === "Open")); }); return () => { on = false; }; }, [done]);
  const list = useMemo(() => jobs.filter(j => !tradeFilter || j.trade === tradeFilter), [jobs, tradeFilter]);

  const submit = async () => {
    if (form.title.trim().length < 3) return toast.error("Give the job a short title");
    if (form.name.trim().length < 2) return toast.error("Enter your full name");
    if (form.phone.replace(/\D/g, "").length < 10) return toast.error("Enter a valid phone / WhatsApp number (at least 10 digits)");
    if (form.description.trim().length < 10) return toast.error("Describe the job in a little more detail");
    const low = parseInt(form.budgetLow.replace(/\D/g, ""), 10) || 0;
    const high = parseInt(form.budgetHigh.replace(/\D/g, ""), 10) || 0;
    if (high > 0 && low > high) return toast.error("Budget low cannot be above budget high");
    const job = await postJobAsync({
      title: form.title.trim(), trade: form.trade, description: form.description.trim(), location: form.location.trim(),
      budgetLow: low, budgetHigh: high, customerName: form.name.trim(), customerPhone: form.phone.trim(),
      sourceQuoteCode: form.sourceQuoteCode || undefined,
    });
    setDone(job.code);
    toast.success(`Job ${job.code} posted`);
  };

  if (done) return (<div className="mx-auto max-w-2xl px-4 py-24 text-center">
    <CheckCircle2 className="h-14 w-14 text-primary mx-auto" />
    <h1 className="font-display font-bold uppercase text-4xl mt-6">Job posted</h1>
    <p className="text-muted-foreground mt-3">Your job code is <span className="font-tech text-primary">{done}</span>. Approved Oketex partners can now bid on it. Track bids, compare prices and accept the bid you like — the winner becomes a tracked Oketex network lead.</p>
    <div className="flex flex-wrap gap-3 justify-center mt-8">
      <Button asChild className="rounded-none font-display uppercase"><Link to={`/track?code=${done}`}>Track bids</Link></Button>
      <Button variant="outline" className="rounded-none font-display uppercase" onClick={() => { setDone(null); setShowForm(false); }}>Back to the board</Button>
    </div>
  </div>);

  return (<div>
    <PageHead kicker="Jobs Board" title="Post a job. Pros bid. You pick." lead="Describe the work once — approved Oketex partner pros bid with price and timeline. You compare bids in Track, accept the one you like, and the job is tracked as a network lead. Your phone number is never shown on this public board." />
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <div className="flex flex-wrap gap-3 items-center justify-between mb-8">
        <select value={tradeFilter} onChange={e => setTradeFilter(e.target.value)} className="field-tech font-tech text-sm !w-64" aria-label="Filter by trade">
          <option value="">All trades</option>{TRADES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <Button className="rounded-none font-display uppercase" onClick={() => setShowForm(s => !s)}><Plus className="h-4 w-4 mr-2" /> Post a job</Button>
      </div>

      {showForm && (
        <section className="border hairline bg-card p-6 mb-10">
          <h2 className="font-display font-bold uppercase text-2xl mb-1">Post a job for pros to bid</h2>
          <p className="font-tech text-[11px] text-muted-foreground mb-6">{from ? `Prefilled from ${from.toUpperCase()} — check and adjust before posting. ` : ""}Demo note: on this device the board shows jobs posted here; with the production backend live, jobs and bids sync across every visitor and partner.</p>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="md:col-span-2"><label className="label-tech">Job title</label><input className="field-tech" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Re-roof a 4-bedroom duplex with longspan" /></div>
            <div><label className="label-tech">Trade</label><select className="field-tech bg-background" value={form.trade} onChange={e => setForm({ ...form, trade: e.target.value })}>{TRADES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="label-tech">Location (town / area)</label><input className="field-tech" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Sangotedo, Lagos" /></div>
            <div className="md:col-span-2"><label className="label-tech">Describe the job</label><textarea rows={4} className="field-tech resize-none" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Sizes, materials, what is included, access notes…" /></div>
            <div><label className="label-tech">Budget from ₦ (optional)</label><input className="field-tech" inputMode="numeric" value={form.budgetLow} onChange={e => setForm({ ...form, budgetLow: e.target.value })} placeholder="e.g. 1500000" /></div>
            <div><label className="label-tech">Budget up to ₦ (optional)</label><input className="field-tech" inputMode="numeric" value={form.budgetHigh} onChange={e => setForm({ ...form, budgetHigh: e.target.value })} placeholder="e.g. 2200000" /></div>
            <div><label className="label-tech">Your name</label><input className="field-tech" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></div>
            <div><label className="label-tech">Phone / WhatsApp</label><input className="field-tech" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0803 000 0000" /><p className="font-tech text-[10px] text-muted-foreground mt-1">Shared only with the partner whose bid you accept — never displayed publicly.</p></div>
          </div>
          <Button className="rounded-none font-display uppercase h-12 mt-6" onClick={() => void submit()}>Post job — free</Button>
        </section>
      )}

      <p className="font-tech text-xs text-muted-foreground mb-5">{list.length} open job{list.length === 1 ? "" : "s"}{tradeFilter ? ` · ${tradeFilter}` : ""}</p>
      {!list.length ? (
        <div className="border hairline py-16 text-center"><Briefcase className="h-10 w-10 text-muted-foreground mx-auto" /><p className="font-tech text-sm uppercase tracking-widest text-muted-foreground mt-4">No open jobs right now — post the first one above.</p></div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {list.map(j => (
            <div key={j.code} className="border hairline bg-card p-6 flex flex-col">
              <div className="flex items-center justify-between gap-3">
                <span className="font-tech text-[10px] uppercase tracking-widest px-2 py-1 border border-sky-500/40 text-sky-400">{j.trade}</span>
                <span className="font-tech text-[10px] text-muted-foreground">{j.code} · {new Date(j.createdAt).toLocaleDateString("en-NG")}</span>
              </div>
              <h3 className="font-display font-bold uppercase text-xl mt-4 leading-tight">{j.title}</h3>
              {j.location && <p className="font-tech text-xs text-muted-foreground mt-2 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {j.location}</p>}
              <p className="text-sm text-muted-foreground mt-3 line-clamp-4 flex-1">{j.description}</p>
              <p className="font-tech text-sm mt-4">{budgetLabel(j)}</p>
              <p className="font-tech text-[11px] text-muted-foreground mt-1">{bidsForJob(j.code).length} bid(s) so far · Pros bid from their Partner Status dashboard</p>
              <Link to="/partner-status" className="font-tech text-xs text-primary mt-4 inline-block">Partners: bid on this job →</Link>
            </div>
          ))}
        </div>
      )}
      <p className="font-tech text-[11px] text-muted-foreground mt-10">Customers: track your job and its bids under <Link to="/track" className="text-primary">Track → Jobs</Link> with your JB code or phone number. Accepting a bid shares your phone with that partner and creates a tracked Oketex lead (the partner settles the network referral commission — never added to your price).</p>
    </div>
  </div>);
}
