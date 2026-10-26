import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatNGN } from "@/lib/money";
import { buildBriefing, buildChasers, type OpsData } from "@/lib/opsAgent";
import { markNotificationSentAsync, notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity";
import { getDocuments } from "@/lib/docStorage";
import { getProductionJobsAsync } from "@/lib/production";
import { getStockDoc } from "@/lib/stock";
import { getStaffAsync } from "@/lib/staff";
import { getSupplyRequestsAsync } from "@/lib/supply";
import { KNOWLEDGE_TRADES, listKnowledgeAllAsync, moderateKnowledgeAsync, submitKnowledgeAsync, type KnowledgeEntry, type KnowledgeKind } from "@/lib/knowledge";
import { STANDARD_TOOLS } from "@/lib/snapRequests";
import type { GuideTrade } from "@/data/roofPatterns";
import type { LocalOrder, LocalQuote } from "@/lib/storage";
import type { LocalBooking } from "@/lib/proStorage";
import type { Partner, Lead } from "@/lib/partnerStorage";
import type { SnapRequest } from "@/lib/snapRequests";
import type { VerifyRequest } from "@/lib/assistantBrain";

interface Props {
  orders: LocalOrder[]; quotes: LocalQuote[]; bookings: LocalBooking[]; leads: Lead[];
  snapRequests: SnapRequest[]; partners: Partner[];
  jobs: { status: string; bids?: unknown[] }[];
  verifyRequests: VerifyRequest[];
  goTab: (tab: string) => void;
}

// Admin → Ops Agent (rules mode). The agent briefs, flags bottlenecks and
// drafts chaser messages — a human taps send. It never moves money, sets
// prices or assigns work by itself.
export default function OpsTab(props: Props) {
  const [extra, setExtra] = useState<Pick<OpsData, "invoices" | "productionJobs" | "stock" | "staffPhones" | "supplyRequests"> | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [teach, setTeach] = useState<{ kind: KnowledgeKind; trade: GuideTrade; title: string; body: string; tools: string }>({ kind: "tip", trade: "Roofing", title: "", body: "", tools: "" });
  const loadKnowledge = async () => setKnowledge(await listKnowledgeAllAsync());
  useEffect(() => {
    void (async () => {
      const [productionJobs, staff, supplyRequests] = await Promise.all([getProductionJobsAsync(), getStaffAsync(), getSupplyRequestsAsync()]);
      setExtra({
        invoices: getDocuments().invoices, productionJobs,
        stock: getStockDoc(),
        staffPhones: staff.map(s => ({ name: s.name, phone: s.phone })),
        supplyRequests,
      });
      await loadKnowledge();
    })();
  }, []);
  const data: OpsData | null = useMemo(() => extra ? {
    orders: props.orders, quotes: props.quotes, bookings: props.bookings, leads: props.leads,
    snapRequests: props.snapRequests, jobs: props.jobs, verifyRequests: props.verifyRequests,
    partners: props.partners, reviews: [], knowledgeEntries: knowledge, ...extra,
  } : null, [extra, knowledge, props.orders, props.quotes, props.bookings, props.leads, props.snapRequests, props.jobs, props.verifyRequests, props.partners]);
  const briefing = useMemo(() => (data ? buildBriefing(data) : null), [data]);
  const chasers = useMemo(() => (data ? buildChasers(data) : []), [data]);
  const [sent, setSent] = useState<Set<string>>(new Set());

  if (!briefing || !data) return <p className="font-tech text-sm text-muted-foreground">Preparing the briefing…</p>;
  const prod = briefing.production;
  const bottlenecks: { label: string; tab: string }[] = [
    ...prod.queuedStale.map(j => ({ label: `Production ${j.code} queued ${Math.round((Date.now() - new Date(j.updatedAt).getTime()) / 3600000)}h — ${j.product.name}`, tab: "production" })),
    ...(prod.qcFailuresToday ? [{ label: `${prod.qcFailuresToday} QC failure(s) today`, tab: "qc" }] : []),
    ...prod.lowStock.map(c => ({ label: `Coil stock low: ${c.gauge} ${c.colour} — ${c.kg}kg on hand (threshold ${data.stock.thresholdKg}kg)`, tab: "stock" })),
    ...prod.bundledStale.map(j => ({ label: `${j.code} bundled and waiting dispatch over 24h — ${j.customerName}`, tab: "dispatch" })),
    ...briefing.supply.awaitingQuotesStale.map(r => ({ label: `Supply ${r.code} (${r.item}) open over 48h with no approved quote`, tab: "supply" })),
    ...briefing.supply.approvedOverdue.map(r => ({ label: `Supply ${r.code} (${r.item}) approved but NOT received — needed by ${r.neededBy}`, tab: "supply" })),
  ];

  const sendChaser = (i: number) => {
    const c = chasers[i];
    logActivity("ops_agent_chaser_sent", c.code, `Chaser to ${c.name} (${c.audience}) — ${c.reason}`, { name: "Ops Agent (draft)", role: "ops_agent" });
    if (c.waLink) window.open(c.waLink, "_blank");
    setSent(s => new Set(s).add(`${c.kind}-${c.code}`));
    toast.success(`Chaser for ${c.code} opened in WhatsApp — drafted by the Ops Agent, sent by you`);
  };

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display font-bold uppercase text-2xl mb-1">Ops Agent — daily briefing</h2>
        <p className="font-tech text-[11px] text-emerald-400 border border-emerald-500/40 px-3 py-2 max-w-3xl">
          Guardrail: the agent drafts and recommends — people approve money, prices and assignments. Rules mode (no AI key): every figure below is computed from the live queues, and every chaser is sent by a human tap.
        </p>
      </section>

      <section>
        <p className="label-tech mb-3">New today</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-border border hairline">
          {briefing.newToday.map(n => (<div key={n.key} className="bg-background p-4"><div className="font-display font-bold text-2xl text-primary">{n.count}</div><div className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{n.label}</div></div>))}
        </div>
      </section>

      <section>
        <p className="label-tech mb-3">Money snapshot</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border hairline">
          {[
            { l: "Orders today", v: formatNGN(briefing.money.ordersTodayNgn) },
            { l: "Orders — last 7 days", v: formatNGN(briefing.money.ordersWeekNgn) },
            { l: "Commissions earned (paid leads)", v: formatNGN(briefing.money.commissionsEarnedNgn) },
            { l: "Commissions pipeline (won)", v: formatNGN(briefing.money.commissionsPipelineNgn) },
          ].map(c => (<div key={c.l} className="bg-background p-4"><div className="font-display font-bold text-2xl text-primary">{c.v}</div><div className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{c.l}</div></div>))}
        </div>
      </section>

      <section>
        <p className="label-tech mb-3">Factory &amp; supply bottlenecks</p>
        {!bottlenecks.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-4">No factory bottlenecks flagged — production is moving.</p>
        : <div className="border hairline">{bottlenecks.map((b, i) => (
          <div key={i} className={`px-4 py-3 flex flex-wrap gap-3 items-center justify-between ${i > 0 ? "border-t hairline" : ""}`}>
            <p className="font-tech text-sm">⚠ {b.label}</p>
            <button onClick={() => props.goTab(b.tab)} className="font-tech text-[11px] uppercase tracking-widest border hairline px-3 py-1.5 cursor-pointer hover:border-primary hover:text-primary">Open →</button>
          </div>))}
        </div>}
      </section>

      <section>
        <p className="label-tech mb-3">Stuck items — no movement in 24h+ ({briefing.stuck.length})</p>
        {!briefing.stuck.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-4">Nothing is stuck — every queue moved in the last day.</p>
        : <div className="border hairline">{briefing.stuck.slice(0, 20).map((s, i) => (
          <div key={`${s.kind}-${s.code}`} className={`px-4 py-3 flex flex-wrap gap-3 items-center justify-between ${i > 0 ? "border-t hairline" : ""}`}>
            <p className="font-tech text-sm"><span className="text-primary">{s.code}</span> · {s.label} <span className="text-muted-foreground">· stuck {s.ageHours}h</span></p>
            <button onClick={() => props.goTab(s.tab)} className="font-tech text-[11px] uppercase tracking-widest border hairline px-3 py-1.5 cursor-pointer hover:border-primary hover:text-primary">Open →</button>
          </div>))}
        </div>}
      </section>

      <section>
        <p className="label-tech mb-3">Chaser list — drafted messages, you press send ({chasers.length})</p>
        {!chasers.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-4">Nobody needs a nudge right now.</p>
        : <div className="space-y-3">{chasers.map((c, i) => { const key = `${c.kind}-${c.code}`; return (
          <div key={key} className="border hairline bg-card p-4">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <p className="font-tech text-xs text-muted-foreground">{c.code} · to {c.audience} {c.name} · {c.reason}</p>
              {sent.has(key) && <span className="font-tech text-[10px] uppercase tracking-widest border border-emerald-500/60 text-emerald-400 px-2 py-0.5">Opened</span>}
            </div>
            <p className="text-sm mt-2 whitespace-pre-line">{c.message}</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {c.waLink
                ? <Button className="rounded-none font-display uppercase h-10" onClick={() => sendChaser(i)}>Send via WhatsApp</Button>
                : <p className="font-tech text-[11px] text-amber-400">No phone on record for {c.name} — message drafted above; reach them another way.</p>}
            </div>
          </div>); })}
        </div>}
        <p className="font-tech text-[11px] text-muted-foreground mt-3">The agent never sends on its own — each chaser above goes out only when you tap. Sent chasers are recorded in the Activity log as agent drafts approved by you.</p>
      </section>

      <section>
        <p className="label-tech mb-3">Pro Guide knowledge — the living library</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border border hairline mb-5">
          <div className="bg-background p-4"><div className="font-display font-bold text-2xl text-primary">{briefing.knowledge.pendingReview}</div><div className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Knowledge contributions waiting for review</div></div>
          <div className="bg-background p-4"><div className="font-display font-bold text-lg leading-snug">{briefing.knowledge.topFixThisWeek ? `${briefing.knowledge.topFixThisWeek.title} — ✓ ${briefing.knowledge.topFixThisWeek.confirmations}` : "—"}</div><div className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Most confirmed fix this week</div></div>
        </div>

        {(() => {
          const pending = knowledge.filter(e => e.status === "pending" && e.kind !== "seedref");
          const moderate = async (e: KnowledgeEntry, action: "approve" | "reject") => {
            const res = await moderateKnowledgeAsync(e.id, action, rejectNotes[e.id] || "");
            if (res.error) { toast.error(res.error); return; }
            logActivity(action === "approve" ? "knowledge_approved" : "knowledge_rejected", e.id, `${e.trade} — ${e.title}`);
            await loadKnowledge();
            toast.success(action === "approve" ? "Approved — it is live in the Pro Guide for everyone, badged 'From the field'." : "Rejected — the contributor sees your note on their dashboard.");
          };
          return (<>
            {!pending.length
              ? <p className="font-tech text-sm text-muted-foreground border hairline p-4">No contributions waiting — pros submit from Partner Status ("Teach the system"), staff from the form below. Nothing publishes without a human approval here.</p>
              : <div className="space-y-3">{pending.map(e => (
                <div key={e.id} className="border hairline bg-card p-4">
                  <p className="font-tech text-xs text-muted-foreground">{e.trade} · {e.kind} · from {e.contributorName || "staff"} ({e.source}) · {new Date(e.createdAt).toLocaleString("en-NG")}</p>
                  <p className="font-display font-bold uppercase mt-1">{e.title}</p>
                  <p className="text-sm mt-2 whitespace-pre-line max-w-3xl">{e.body}</p>
                  {!!e.tools?.length && <p className="font-tech text-[11px] text-muted-foreground mt-2">Tools: {e.tools.join(", ")}</p>}
                  <div className="flex flex-wrap gap-2 mt-3 items-center">
                    <Button className="rounded-none font-display uppercase h-10" onClick={() => void moderate(e, "approve")}>Approve — publish to the library</Button>
                    <input value={rejectNotes[e.id] || ""} onChange={ev => setRejectNotes({ ...rejectNotes, [e.id]: ev.target.value })} placeholder="Reason if rejecting (contributor sees it)" className="field-tech font-tech !w-72" />
                    <Button variant="outline" className="rounded-none font-display uppercase h-10" onClick={() => void moderate(e, "reject")}>Reject</Button>
                  </div>
                </div>))}
              </div>}
          </>);
        })()}

        <div className="border hairline bg-card p-5 mt-6">
          <p className="label-tech mb-3">Staff — add a lesson yourselves</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="label-tech">Kind</label>
              <select value={teach.kind} onChange={e => setTeach({ ...teach, kind: e.target.value as KnowledgeKind })} className="field-tech font-tech bg-background w-full">
                <option value="pattern">Pattern</option><option value="fix">Fix</option><option value="tip">Tip</option>
              </select></div>
            <div><label className="label-tech">Trade</label>
              <select value={teach.trade} onChange={e => setTeach({ ...teach, trade: e.target.value as GuideTrade })} className="field-tech font-tech bg-background w-full">
                {KNOWLEDGE_TRADES.map(t => <option key={t}>{t}</option>)}
              </select></div>
            <div className="md:col-span-2"><label className="label-tech">Title</label>
              <input value={teach.title} onChange={e => setTeach({ ...teach, title: e.target.value })} className="field-tech" placeholder="e.g. Factory note: checking crimp-curved sheets on arrival" /></div>
            <div className="md:col-span-2"><label className="label-tech">Lesson (steps / fix, in full)</label>
              <textarea value={teach.body} onChange={e => setTeach({ ...teach, body: e.target.value })} rows={4} className="field-tech" placeholder="One step per line." /></div>
            <div className="md:col-span-2"><label className="label-tech">Tools (comma-separated)</label>
              <input value={teach.tools} onChange={e => setTeach({ ...teach, tools: e.target.value })} list="ops-teach-tools" className="field-tech font-tech" placeholder="Measuring tape, Spirit level" />
              <datalist id="ops-teach-tools">{STANDARD_TOOLS.map(t => <option key={t} value={t} />)}</datalist></div>
            <div className="md:col-span-2"><Button variant="outline" className="rounded-none font-display uppercase h-10" onClick={async () => {
              const actor = (() => { try { return JSON.parse(sessionStorage.getItem("oketex-admin-session") || "null"); } catch { return null; } })();
              const res = await submitKnowledgeAsync({ kind: teach.kind, trade: teach.trade, title: teach.title, body: teach.body, tools: teach.tools.split(",").map(t => t.trim()).filter(Boolean) }, { staffName: actor?.name || "Oketex staff" });
              if (res.error) { toast.error(res.error); return; }
              setTeach({ kind: "tip", trade: teach.trade, title: "", body: "", tools: "" });
              await loadKnowledge();
              toast.success("Submitted — staff lessons also pass the review queue above, so a second pair of eyes checks everything.");
            }}>Submit for review</Button></div>
          </div>
        </div>
      </section>
    </div>
  );
}
