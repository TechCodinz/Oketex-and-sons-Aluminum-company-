import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getProductionJobsAsync, productionActionAsync, type ProductionJob } from "@/lib/production";
import { MapCard } from "@/components/MapCard";
import { logActivity } from "@/lib/activity";

// Admin → Dispatch (dispatch crew + operations + owner). Bundled cards are
// loaded against a checklist, dispatched with the destination + map the
// driver follows, and closed out as Delivered.
const LOAD_CHECKS = ["Bundles counted against the cutting list", "Strapping & edge protection on", "Delivery note / invoice copy in the cab"];
export default function DispatchTab() {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const load = async () => setJobs(await getProductionJobsAsync());
  useEffect(() => { void load(); }, []);
  const ready = jobs.filter(j => j.status === "Bundled");
  const out = jobs.filter(j => j.status === "Dispatched");
  const toggleCheck = async (job: ProductionJob, item: string) => {
    const has = job.checklist.includes(item);
    const checklist = has ? job.checklist.filter(c => c !== item) : [...job.checklist, item];
    await productionActionAsync(job.code, "checklist", { checklist });
    await load();
  };
  const move = async (job: ProductionJob, action: "dispatch" | "deliver") => {
    if (action === "dispatch" && !LOAD_CHECKS.every(c => job.checklist.includes(c))) return toast.error("Complete the load checklist first — every box must be ticked");
    await productionActionAsync(job.code, action);
    logActivity(action === "dispatch" ? "production_dispatched" : "production_delivered", job.code, job.address || job.customerName);
    await load();
    toast.success(action === "dispatch" ? `${job.code} dispatched — safe trip` : `${job.code} delivered — loop closed`);
  };
  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display font-bold uppercase text-2xl mb-1">Dispatch ({ready.length} ready)</h2>
        <p className="font-tech text-[11px] text-muted-foreground">Bundled orders waiting for a vehicle. Tick the load checklist, then dispatch — the destination and directions come straight off the job card.</p>
        {!ready.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-5 mt-4">Nothing bundled and waiting.</p>
        : <div className="space-y-4 mt-4">{ready.map(j => (
          <div key={j.code} className="border hairline bg-card p-5">
            <div className="grid lg:grid-cols-2 gap-5">
              <div>
                <p className="font-tech font-semibold">{j.code} · {j.product.name} · {j.totalMetres}m</p>
                <p className="font-tech text-[11px] text-muted-foreground mt-1">Order {j.orderCode || "—"} · {j.customerName}{j.customerPhone ? ` · ${j.customerPhone}` : ""}</p>
                <p className="text-sm mt-2">Destination: {j.address || "Address on the order paperwork — confirm with the office before leaving"}</p>
                <div className="mt-4 space-y-2">
                  {LOAD_CHECKS.map(c => (
                    <label key={c} className="flex gap-2 items-center font-tech text-xs cursor-pointer">
                      <input type="checkbox" checked={j.checklist.includes(c)} onChange={() => void toggleCheck(j, c)} /> {c}
                    </label>
                  ))}
                </div>
                <Button className="rounded-none font-display uppercase h-11 mt-4" onClick={() => void move(j, "dispatch")}>Mark dispatched</Button>
              </div>
              <MapCard geo={null} address={j.address} />
            </div>
          </div>))}
        </div>}
      </section>
      <section>
        <h2 className="font-display font-bold uppercase text-xl mb-4">Out for delivery ({out.length})</h2>
        {!out.length ? <p className="font-tech text-sm text-muted-foreground">No vehicles out right now.</p>
        : <div className="border hairline">{out.map((j, i) => (
          <div key={j.code} className={`px-5 py-4 flex flex-wrap gap-3 justify-between items-center ${i > 0 ? "border-t hairline" : ""}`}>
            <p className="font-tech text-sm"><b>{j.code}</b> · {j.customerName} · {j.address || "—"}</p>
            <Button variant="outline" className="rounded-none font-display uppercase h-10" onClick={() => void move(j, "deliver")}>Mark delivered</Button>
          </div>))}
        </div>}
      </section>
    </div>
  );
}
