import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getMachines, addMachine, updateMachine, addBreakdown, resolveBreakdown, serviceOverdue, type Machine, type MachineStatus } from "@/lib/machines";

// Admin → Maintenance (maintenance technician + owner). The machine
// register: service dates with overdue flags, status, and a breakdown log
// the technician works from. Starts empty — real machines get entered.
export default function MaintenanceTab() {
  const [machines, setMachines] = useState<Machine[]>(() => getMachines());
  const [form, setForm] = useState({ name: "", type: "", lastService: "", nextServiceDue: "" });
  const [bdNote, setBdNote] = useState<Record<string, string>>({});
  const today = new Date().toISOString().slice(0, 10);
  const add = () => {
    if (form.name.trim().length < 2) return toast.error("Name the machine");
    addMachine(form);
    setMachines(getMachines());
    setForm({ name: "", type: "", lastService: "", nextServiceDue: "" });
    toast.success("Machine added to the register");
  };
  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display font-bold uppercase text-2xl mb-1">Maintenance ({machines.length} machines)</h2>
        <p className="font-tech text-[11px] text-muted-foreground max-w-3xl">Roll-forming lines, cutters, forklifts and generators — service due dates, current status and the breakdown log. An overdue service is flagged here and counts against nobody's memory.</p>
      </section>
      <section className="border hairline bg-card p-5">
        <p className="label-tech mb-4">Add a machine</p>
        <div className="grid md:grid-cols-4 gap-4 items-end">
          <div><label className="label-tech">Machine name</label><input className="field-tech" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Longspan roll-former 1" /></div>
          <div><label className="label-tech">Type</label><input className="field-tech" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} placeholder="Roll-forming line" /></div>
          <div><label className="label-tech">Last service</label><input type="date" className="field-tech font-tech" value={form.lastService} onChange={e => setForm({ ...form, lastService: e.target.value })} /></div>
          <div><label className="label-tech">Next service due</label><input type="date" className="field-tech font-tech" value={form.nextServiceDue} onChange={e => setForm({ ...form, nextServiceDue: e.target.value })} /></div>
        </div>
        <Button className="rounded-none font-display uppercase h-11 mt-4" onClick={add}>Add machine</Button>
      </section>
      {!machines.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-5">No machines on the register yet.</p>
      : <div className="space-y-4">{machines.map(m => { const overdue = serviceOverdue(m, today); const open = m.breakdowns.filter(b => !b.resolved); return (
        <div key={m.id} className="border hairline bg-card p-5">
          <div className="flex flex-wrap gap-3 justify-between items-start">
            <div>
              <p className="font-tech font-semibold">{m.name} <span className="text-muted-foreground font-normal">· {m.type}</span></p>
              <p className="font-tech text-[11px] text-muted-foreground mt-1">Last service {m.lastService || "—"} · Next due {m.nextServiceDue || "—"}{overdue && <span className="text-red-400"> · SERVICE OVERDUE</span>}</p>
            </div>
            <select value={m.status} aria-label={`Status for ${m.name}`} onChange={e => { updateMachine(m.id, { status: e.target.value as MachineStatus }); setMachines(getMachines()); }} className="bg-background border hairline font-tech text-xs px-2 py-2">
              {(["Running", "Down", "In Service"] as MachineStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-3 mt-3 items-end">
            <div><label className="label-tech">Record service done</label><input type="date" className="field-tech font-tech !w-44" onChange={e => { if (e.target.value) { updateMachine(m.id, { lastService: e.target.value, status: "Running" }); setMachines(getMachines()); toast.success(`${m.name} — service recorded`); } }} /></div>
            <div><label className="label-tech">Next due</label><input type="date" className="field-tech font-tech !w-44" defaultValue={m.nextServiceDue} onBlur={e => { updateMachine(m.id, { nextServiceDue: e.target.value }); setMachines(getMachines()); }} /></div>
          </div>
          <div className="mt-4">
            <p className="label-tech mb-2">Breakdown log ({m.breakdowns.length}{open.length ? ` · ${open.length} open` : ""})</p>
            {m.breakdowns.map(b => (
              <div key={b.id} className="flex flex-wrap gap-3 items-center py-1.5 border-t hairline first:border-0">
                <span className={`font-tech text-[10px] uppercase tracking-widest border px-2 py-0.5 ${b.resolved ? "hairline text-muted-foreground" : "border-red-500/60 text-red-400"}`}>{b.resolved ? "Resolved" : "Open"}</span>
                <span className="font-tech text-[11px] text-muted-foreground">{new Date(b.ts).toLocaleString("en-NG")}</span>
                <span className="text-sm flex-1">{b.note}</span>
                {!b.resolved && <button onClick={() => { resolveBreakdown(m.id, b.id); setMachines(getMachines()); }} className="font-tech text-[11px] border hairline px-2.5 py-1 hover:border-primary hover:text-primary cursor-pointer">Mark resolved</button>}
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <input className="field-tech font-tech flex-1" value={bdNote[m.id] || ""} onChange={e => setBdNote(n => ({ ...n, [m.id]: e.target.value }))} placeholder="Report a breakdown — what happened?" />
              <Button variant="outline" className="rounded-none font-display uppercase h-11" onClick={() => { if (!(bdNote[m.id] || "").trim()) return toast.error("Describe the breakdown"); addBreakdown(m.id, bdNote[m.id]); setBdNote(n => ({ ...n, [m.id]: "" })); setMachines(getMachines()); toast.success("Breakdown logged — machine marked Down"); }}>Log breakdown</Button>
            </div>
          </div>
        </div>); })}
      </div>}
    </div>
  );
}
