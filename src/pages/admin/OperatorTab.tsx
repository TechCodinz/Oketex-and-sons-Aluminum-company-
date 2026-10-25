import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getProductionJobsAsync, productionActionAsync, type ProductionJob } from "@/lib/production";

// Admin → Production Jobs (machine operator). Only the operator's own
// assigned cards (plus unassigned ones they can ask the manager about):
// Start the run, Finish with metres actually produced + a scrap note.
export default function OperatorTab({ sessionName }: { sessionName: string }) {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [finishForm, setFinishForm] = useState<Record<string, { metres: string; scrap: string }>>({});
  const load = async () => setJobs(await getProductionJobsAsync());
  useEffect(() => { void load(); }, []);
  const mine = jobs.filter(j => (j.operatorName || "").trim().toLowerCase() === sessionName.trim().toLowerCase() && !["Delivered"].includes(j.status));
  const act = async (job: ProductionJob, action: "start" | "finish") => {
    if (action === "finish") {
      const f = finishForm[job.code] || { metres: "", scrap: "" };
      const metres = parseFloat(f.metres) || 0;
      if (metres <= 0) return toast.error("Enter the metres actually produced");
      await productionActionAsync(job.code, "finish", { metresProduced: metres, scrapNote: f.scrap });
      toast.success(`${job.code} finished — ${metres}m produced, sent to QC`);
    } else {
      await productionActionAsync(job.code, "start", {});
      toast.success(`${job.code} started — good run!`);
    }
    await load();
  };
  return (
    <section>
      <h2 className="font-display font-bold uppercase text-2xl mb-1">My production jobs ({mine.length})</h2>
      <p className="font-tech text-[11px] text-muted-foreground mb-4">Cards assigned to {sessionName}. Cut exactly to the list on the card; when the run ends, record the metres produced and any scrap — QC inspects next.</p>
      {!mine.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-5">No jobs assigned to you right now — the production manager assigns cards from the Production board.</p>
      : <div className="space-y-4">{mine.map(j => (
        <div key={j.code} className="border hairline bg-card p-5">
          <div className="flex flex-wrap gap-3 justify-between items-start">
            <div>
              <p className="font-tech font-semibold">{j.code} · order {j.orderCode || "—"} · {j.customerName}</p>
              <p className="text-sm mt-1">{j.product.name}{j.product.gauge ? ` · ${j.product.gauge}` : ""}{j.product.colour ? ` · ${j.product.colour}` : ""}</p>
              <p className="font-tech text-[11px] text-muted-foreground mt-1">{j.scheduleNote ? `Schedule: ${j.scheduleNote} · ` : ""}Status: <span className="text-primary">{j.status}</span></p>
            </div>
            <span className="font-tech text-sm">Total <b className="text-primary">{j.totalMetres}m</b></span>
          </div>
          <div className="border hairline mt-4">
            <p className="label-tech px-3 py-2 border-b hairline">Cutting list</p>
            {j.cuttingList.length ? j.cuttingList.map((l, i) => (<p key={i} className="px-3 py-2 font-tech text-sm border-b hairline last:border-0">{l.qty} × {l.lengthM}m <span className="text-muted-foreground">= {(l.qty * l.lengthM).toFixed(2)}m</span></p>))
            : <p className="px-3 py-3 font-tech text-xs text-amber-400">No cutting list on this card — check the order note / ask the production manager before cutting.</p>}
          </div>
          {j.qc && j.qc.result === "fail" && j.status === "In Production" && <p className="font-tech text-xs text-red-400 mt-3">QC sent this back: {j.qc.notes || "see the QC officer"} — re-run and finish again.</p>}
          <div className="flex flex-wrap gap-3 mt-4 items-end">
            {j.status === "Queued" && <Button className="rounded-none font-display uppercase h-11" onClick={() => void act(j, "start")}>Start run</Button>}
            {j.status === "In Production" && (<>
              <div><label className="label-tech">Metres produced</label><input type="number" min={0} step="0.01" className="field-tech font-tech !w-36" value={(finishForm[j.code] || {}).metres || ""} onChange={e => setFinishForm(f => ({ ...f, [j.code]: { metres: e.target.value, scrap: (f[j.code] || {}).scrap || "" } }))} placeholder={String(j.totalMetres)} /></div>
              <div className="flex-1 min-w-52"><label className="label-tech">Scrap note</label><input className="field-tech font-tech" value={(finishForm[j.code] || {}).scrap || ""} onChange={e => setFinishForm(f => ({ ...f, [j.code]: { metres: (f[j.code] || {}).metres || "", scrap: e.target.value } }))} placeholder="e.g. 1.2m trim waste, one dented sheet" /></div>
              <Button className="rounded-none font-display uppercase h-11" onClick={() => void act(j, "finish")}>Finish — send to QC</Button>
            </>)}
            {j.status === "Produced" && <p className="font-tech text-xs text-muted-foreground">Finished — waiting for QC inspection.</p>}
            {["QC Passed", "Bundled", "Dispatched"].includes(j.status) && <p className="font-tech text-xs text-emerald-400">Done on the floor — this card is with {j.status === "QC Passed" ? "the warehouse" : "dispatch"}.</p>}
          </div>
        </div>))}
      </div>}
    </section>
  );
}
