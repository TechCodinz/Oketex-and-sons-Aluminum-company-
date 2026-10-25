import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getProductionJobsAsync, createProductionJobAsync, productionActionAsync, cuttingListTotal, type ProductionJob } from "@/lib/production";
import { getOrdersAsync, type LocalOrder } from "@/lib/storage";
import { getStaffAsync, type StaffMember } from "@/lib/staff";
import { logActivity } from "@/lib/activity";

// Admin → Production board (owner + production manager). The whole factory
// queue by status; assign operators, add schedule notes, and raise a job
// card manually from any order (confirmed orders also auto-create one).
const COLUMNS = ["Queued", "In Production", "Produced", "QC Passed", "Bundled", "Dispatched", "Delivered"] as const;
export default function ProductionBoard() {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [orderPick, setOrderPick] = useState("");
  const load = async () => { const [j, o, s] = await Promise.all([getProductionJobsAsync(), getOrdersAsync(), getStaffAsync()]); setJobs(j); setOrders(o); setStaff(s); };
  useEffect(() => { void load(); }, []);
  const operators = staff.filter(s => s.active && (s.role === "operator" || s.role === "production_manager"));
  const act = async (job: ProductionJob, action: "assign" | "schedule", patch: Record<string, unknown>, label: string) => {
    await productionActionAsync(job.code, action, patch);
    logActivity(`production_${action}`, job.code, label);
    await load();
    toast.success(label);
  };
  const createFromOrder = async () => {
    const order = orders.find(o => o.code === orderPick);
    if (!order) return toast.error("Pick an order first");
    const { ensureProductionJobForOrderAsync } = await import("@/lib/production");
    const job = await ensureProductionJobForOrderAsync(order);
    logActivity("production_created", job.code, `Raised from order ${order.code} (${job.totalMetres}m)`);
    await load();
    toast.success(`Production job ${job.code} on the board — ${job.cuttingList.length} cutting line(s), ${job.totalMetres}m total`);
  };
  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display font-bold uppercase text-2xl mb-1">Production board ({jobs.length})</h2>
        <p className="font-tech text-[11px] text-muted-foreground max-w-3xl">Every confirmed order becomes a job card with its cutting list. The card walks the floor: Queued → In Production → Produced → QC → Bundled → Dispatched → Delivered. Stages cannot be skipped — QC failure returns a job to production with the inspector's note.</p>
      </section>
      <section className="border hairline bg-card p-5 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-64"><label className="label-tech">New production job from an order</label>
          <select value={orderPick} onChange={e => setOrderPick(e.target.value)} className="field-tech bg-background">
            <option value="">Select an order…</option>
            {orders.map(o => <option key={o.code} value={o.code}>{o.code} — {o.name} — {o.status}</option>)}
          </select></div>
        <Button className="rounded-none font-display uppercase h-11" onClick={() => void createFromOrder()}>Raise job card</Button>
      </section>
      <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {COLUMNS.map(status => {
          const col = jobs.filter(j => j.status === status);
          return (
            <section key={status} className="border hairline">
              <p className="label-tech px-4 py-3 border-b hairline">{status} ({col.length})</p>
              <div className="divide-y divide-white/5">
                {!col.length && <p className="px-4 py-4 font-tech text-xs text-muted-foreground">Empty</p>}
                {col.map(j => (
                  <div key={j.code} className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-2 justify-between items-start">
                      <p className="font-tech font-semibold text-sm">{j.code} <span className="text-muted-foreground font-normal">· order {j.orderCode || "—"}</span></p>
                      <span className="font-tech text-[11px] text-primary">{j.totalMetres}m</span>
                    </div>
                    <p className="text-sm mt-1">{j.product.name}{j.product.gauge ? ` · ${j.product.gauge}` : ""}{j.product.colour ? ` · ${j.product.colour}` : ""}</p>
                    <p className="font-tech text-[11px] text-muted-foreground mt-1">{j.customerName} · {j.cuttingList.length} cutting line(s) ({j.cuttingList.map(l => `${l.qty} × ${l.lengthM}m`).join(", ") || "operator to fill from order note"}){j.metresProduced ? ` · produced ${j.metresProduced}m` : ""}{j.scrapNote ? ` · scrap: ${j.scrapNote}` : ""}</p>
                    {j.qc && <p className={`font-tech text-[11px] mt-1 ${j.qc.result === "pass" ? "text-emerald-400" : "text-red-400"}`}>QC {j.qc.result} by {j.qc.by}{j.qc.notes ? ` — ${j.qc.notes}` : ""}</p>}
                    {j.scheduleNote && <p className="font-tech text-[11px] text-amber-400 mt-1">Schedule: {j.scheduleNote}</p>}
                    <div className="flex flex-wrap gap-2 mt-3 items-end">
                      <div className="flex-1 min-w-40"><label className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Operator</label>
                        <select value={j.operatorName} aria-label={`Operator for ${j.code}`} onChange={e => void act(j, "assign", { operatorName: e.target.value }, `${j.code} assigned to ${e.target.value || "—"}`)} className="w-full bg-background border hairline font-tech text-xs px-2 py-2">
                          <option value="">Unassigned</option>
                          {operators.map(s => <option key={String(s.id)} value={s.name}>{s.name}</option>)}
                          {j.operatorName && !operators.some(s => s.name === j.operatorName) && <option value={j.operatorName}>{j.operatorName}</option>}
                        </select></div>
                      <div className="flex-1 min-w-40"><label className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Schedule note</label>
                        <input defaultValue={j.scheduleNote} onBlur={e => { if (e.target.value !== j.scheduleNote) void act(j, "schedule", { scheduleNote: e.target.value }, `${j.code} schedule note saved`); }} placeholder="e.g. Run after the Lekki job" className="w-full bg-background border hairline font-tech text-xs px-2 py-2" /></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <p className="font-tech text-[11px] text-muted-foreground">Cutting-list totals are computed from the card lines (length × qty) — currently {cuttingListTotal(jobs.flatMap(j => j.cuttingList))}m across all cards on the board.</p>
    </div>
  );
}
