import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getProductionJobsAsync, productionActionAsync, type ProductionJob } from "@/lib/production";
import { logActivity } from "@/lib/activity";

// Admin → Quality Control (owner + QC officer). Inspect Produced batches:
// gauge, length tolerance, colour match. Pass moves the card to the
// warehouse; Fail returns it to production with the reason recorded.
export default function QcTab({ actorName }: { actorName: string }) {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = async () => setJobs(await getProductionJobsAsync());
  useEffect(() => { void load(); }, []);
  const awaiting = jobs.filter(j => j.status === "Produced");
  const history = jobs.flatMap(j => (j.qcHistory || []).map(q => ({ job: j, q }))).sort((a, b) => b.q.at.localeCompare(a.q.at));
  const inspect = async (job: ProductionJob, result: "pass" | "fail") => {
    const note = notes[job.code] || "";
    if (result === "fail" && !note.trim()) return toast.error("A failed batch needs a note — tell production what to fix");
    await productionActionAsync(job.code, "qc", { result, notes: note, by: actorName });
    logActivity(result === "pass" ? "production_qc_pass" : "production_qc_fail", job.code, note || undefined);
    await load();
    toast.success(result === "pass" ? `${job.code} PASSED — released to the warehouse` : `${job.code} FAILED — returned to production`);
  };
  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display font-bold uppercase text-2xl mb-1">Quality control ({awaiting.length} awaiting)</h2>
        <p className="font-tech text-[11px] text-muted-foreground max-w-3xl">Check every produced batch before it is bundled: gauge against the card, lengths within tolerance, colour match across the bundle. Nothing skips QC — a card cannot be bundled or dispatched without a pass recorded here.</p>
        {!awaiting.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-5 mt-4">No batches waiting for inspection.</p>
        : <div className="space-y-4 mt-4">{awaiting.map(j => (
          <div key={j.code} className="border hairline bg-card p-5">
            <div className="flex flex-wrap gap-3 justify-between">
              <div><p className="font-tech font-semibold">{j.code} · {j.product.name}</p>
              <p className="font-tech text-[11px] text-muted-foreground mt-1">Order {j.orderCode || "—"} · {j.customerName} · Operator {j.operatorName || "—"} · Card {j.totalMetres}m · Produced {j.metresProduced}m{j.scrapNote ? ` · Scrap: ${j.scrapNote}` : ""}</p>
              <p className="font-tech text-[11px] text-muted-foreground">Spec: gauge {j.product.gauge || "on card"} · colour {j.product.colour || "on card"} · cuts {j.cuttingList.map(l => `${l.qty} × ${l.lengthM}m`).join(", ") || "—"}</p></div>
            </div>
            <div className="flex flex-wrap gap-3 mt-4 items-end">
              <div className="flex-1 min-w-64"><label className="label-tech">Inspection notes</label><input className="field-tech font-tech" value={notes[j.code] || ""} onChange={e => setNotes(n => ({ ...n, [j.code]: e.target.value }))} placeholder="Gauge ok, lengths within 5mm, colour matched…" /></div>
              <Button className="rounded-none font-display uppercase h-11" onClick={() => void inspect(j, "pass")}>Pass batch</Button>
              <Button variant="outline" className="rounded-none font-display uppercase h-11 hover:text-red-400" onClick={() => void inspect(j, "fail")}>Fail — return to production</Button>
            </div>
          </div>))}
        </div>}
      </section>
      <section>
        <h2 className="font-display font-bold uppercase text-xl mb-4">QC history ({history.length})</h2>
        {!history.length ? <p className="font-tech text-sm text-muted-foreground">No inspections recorded yet.</p>
        : <div className="border hairline">{history.slice(0, 30).map(({ job, q }, i) => (
          <div key={`${job.code}-${i}`} className={`px-5 py-3 flex flex-wrap gap-3 items-baseline ${i > 0 ? "border-t hairline" : ""}`}>
            <span className={`font-tech text-[10px] uppercase tracking-widest border px-2 py-0.5 ${q.result === "pass" ? "border-emerald-500/60 text-emerald-400" : "border-red-500/60 text-red-400"}`}>{q.result}</span>
            <span className="font-tech text-sm font-semibold">{job.code}</span>
            <span className="font-tech text-[11px] text-muted-foreground">{new Date(q.at).toLocaleString("en-NG")} · by {q.by}</span>
            {q.notes && <span className="text-sm text-muted-foreground">{q.notes}</span>}
          </div>))}
        </div>}
      </section>
    </div>
  );
}
