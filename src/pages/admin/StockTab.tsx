import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getStockDoc, addCoil, updateCoilKg, removeCoil, setStockThreshold, lowStockFlags, type StockDoc } from "@/lib/stock";
import { getProductionJobsAsync, productionActionAsync, type ProductionJob } from "@/lib/production";

// Admin → Stock (warehouse keeper + store keeper + owner). Coil inventory
// by gauge/colour/kg with an editable low-stock threshold, and the
// finished-goods side: QC-passed cards get bundled here. Starts empty —
// the warehouse enters the real coils; nothing is invented.
export default function StockTab() {
  const [doc, setDoc] = useState<StockDoc>(() => getStockDoc());
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [form, setForm] = useState({ gauge: "", colour: "", kg: "" });
  const [threshold, setThreshold] = useState(String(doc.thresholdKg));
  const loadJobs = async () => setJobs(await getProductionJobsAsync());
  useEffect(() => { void loadJobs(); }, []);
  const low = lowStockFlags(doc);
  const passed = jobs.filter(j => j.status === "QC Passed");
  const bundled = jobs.filter(j => j.status === "Bundled");
  const add = () => {
    if (!form.gauge.trim() || !form.colour.trim()) return toast.error("Enter gauge and colour");
    const kg = parseFloat(form.kg) || 0;
    if (kg <= 0) return toast.error("Enter the kilograms on hand");
    setDoc(addCoil({ gauge: form.gauge, colour: form.colour, kg }));
    setForm({ gauge: "", colour: "", kg: "" });
    toast.success("Coil added to stock");
  };
  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display font-bold uppercase text-2xl mb-1">Coil stock ({doc.items.length})</h2>
        <p className="font-tech text-[11px] text-muted-foreground max-w-3xl">Raw coil on hand by gauge and colour. A coil below the low-stock threshold is flagged here and in the Ops Agent briefing, next to the metres already queued. Stock is kept on this device until a stock sync endpoint ships.</p>
        {low.length > 0 && <p className="font-tech text-xs text-amber-400 mt-3">⚠ Low stock: {low.map(c => `${c.gauge} ${c.colour} (${c.kg}kg)`).join(" · ")}</p>}
      </section>
      <section className="border hairline bg-card p-5">
        <div className="grid md:grid-cols-4 gap-4 items-end">
          <div><label className="label-tech">Gauge</label><input className="field-tech" value={form.gauge} onChange={e => setForm({ ...form, gauge: e.target.value })} placeholder="0.45mm" /></div>
          <div><label className="label-tech">Colour</label><input className="field-tech" value={form.colour} onChange={e => setForm({ ...form, colour: e.target.value })} placeholder="Charcoal" /></div>
          <div><label className="label-tech">Kilograms</label><input type="number" min={0} className="field-tech font-tech" value={form.kg} onChange={e => setForm({ ...form, kg: e.target.value })} placeholder="1250" /></div>
          <Button className="rounded-none font-display uppercase h-11" onClick={add}>Add coil</Button>
        </div>
        <div className="flex flex-wrap gap-3 items-end mt-5">
          <div><label className="label-tech">Low-stock threshold (kg)</label><input type="number" min={0} className="field-tech font-tech !w-36" value={threshold} onChange={e => setThreshold(e.target.value)} /></div>
          <Button variant="outline" className="rounded-none font-display uppercase h-11" onClick={() => { setDoc(setStockThreshold(parseFloat(threshold) || 0)); toast.success("Threshold saved"); }}>Save threshold</Button>
        </div>
      </section>
      <section>
        {!doc.items.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-5">No coils recorded yet — add the first one above.</p>
        : <div className="border hairline overflow-x-auto"><table className="w-full text-sm min-w-[560px]">
          <thead><tr className="border-b hairline text-left font-tech text-[10px] uppercase tracking-widest text-muted-foreground"><th className="px-4 py-3">Gauge</th><th className="px-4 py-3">Colour</th><th className="px-4 py-3">On hand (kg)</th><th className="px-4 py-3">Flag</th><th className="px-4 py-3">Adjust</th></tr></thead>
          <tbody>{doc.items.map(c => (
            <tr key={c.id} className="border-b hairline last:border-0">
              <td className="px-4 py-3 font-semibold">{c.gauge}</td>
              <td className="px-4 py-3">{c.colour}</td>
              <td className="px-4 py-3"><input type="number" min={0} defaultValue={c.kg} aria-label={`kg for ${c.gauge} ${c.colour}`} onBlur={e => setDoc(updateCoilKg(c.id, parseFloat(e.target.value) || 0))} className="bg-background border hairline font-tech text-xs px-2 py-2 w-28" /></td>
              <td className="px-4 py-3">{c.kg < doc.thresholdKg ? <span className="font-tech text-[10px] uppercase tracking-widest border border-amber-500/60 text-amber-400 px-2 py-0.5">Low stock</span> : <span className="font-tech text-[11px] text-muted-foreground">OK</span>}</td>
              <td className="px-4 py-3"><button onClick={() => setDoc(removeCoil(c.id))} className="font-tech text-xs text-muted-foreground hover:text-red-400 cursor-pointer">Remove</button></td>
            </tr>))}
          </tbody>
        </table></div>}
      </section>
      <section>
        <h2 className="font-display font-bold uppercase text-xl mb-4">Finished bundles</h2>
        <p className="label-tech mb-3">QC passed — ready to bundle ({passed.length})</p>
        {!passed.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-4">Nothing waiting — QC passes appear here.</p>
        : <div className="border hairline">{passed.map((j, i) => (
          <div key={j.code} className={`px-4 py-3 flex flex-wrap gap-3 justify-between items-center ${i > 0 ? "border-t hairline" : ""}`}>
            <p className="font-tech text-sm"><b>{j.code}</b> · {j.product.name} · {j.totalMetres}m · {j.customerName}</p>
            <Button className="rounded-none font-display uppercase h-10" onClick={async () => { await productionActionAsync(j.code, "bundle"); await loadJobs(); toast.success(`${j.code} bundled — dispatch can load it`); }}>Mark bundled</Button>
          </div>))}
        </div>}
        <p className="label-tech mt-6 mb-3">Bundled — with dispatch ({bundled.length})</p>
        {!bundled.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-4">No bundles waiting.</p>
        : <div className="border hairline">{bundled.map((j, i) => (<p key={j.code} className={`px-4 py-3 font-tech text-sm ${i > 0 ? "border-t hairline" : ""}`}><b>{j.code}</b> · {j.product.name} · {j.customerName}</p>))}
        </div>}
      </section>
    </div>
  );
}
