import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { PageHead } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatNGN } from "@/lib/money";
import { BUSINESS } from "@/contracts/constants";
import { getBusiness, businessWaLink } from "@/lib/settings";
import { Link } from "react-router";
import PlanGate, { PlanChip } from "@/components/PlanGate";
import InstallCard from "@/components/InstallCard";
import { useEntitlements, FREE_PROJECT_LIMIT } from "@/lib/plans";
import { calculateRoof, PROFILES, type RoofResult } from "@/lib/roofEngine";
import { ROOF_PATTERNS } from "@/data/roofPatterns";
import {
  getProProjects, saveProProjects, uid, emptyTakeOffRow, emptyMeasureRow, defaultChecklist,
  type ProProject, type TakeOffRow,
} from "@/lib/proStorage";

const TRADES = ["Roofer", "Carpenter", "Engineer", "Builder"] as const;
const STATUSES = ["Measuring", "Quoted", "In Progress", "Completed"] as const;
const PROFILE_IDS = Object.keys(PROFILES) as (keyof typeof PROFILES)[];

function rowCalc(r: TakeOffRow): RoofResult {
  return calculateRoof({
    length: r.length || 0, width: r.width || 0, overhang: r.overhang || 0, style: r.style,
    pitchDeg: r.pitch || 0, profile: r.profile, colour: "Charcoal", wastePct: null,
    extras: { gutters: false, insulation: false, installation: false, timber: false }, deliveryZone: "pickup",
  });
}
function measureValue(m: { l: number; w: number; h: number; qty: number }): { label: string; value: number; kind: string } {
  const qty = m.qty || 0;
  if (m.h > 0) return { label: `${(m.l * m.w * m.h * qty).toFixed(2)} m³`, value: m.l * m.w * m.h * qty, kind: "vol" };
  if (m.l > 0 && m.w > 0) return { label: `${(m.l * m.w * qty).toFixed(2)} m²`, value: m.l * m.w * qty, kind: "area" };
  return { label: `${((m.l || m.w) * qty).toFixed(2)} m`, value: (m.l || m.w) * qty, kind: "len" };
}
const cellCls = "bg-transparent border-b border-input px-1 py-1.5 font-tech text-[13px] w-full focus:outline-none focus:border-primary";
const numCls = cellCls + " text-right";

export default function Workspace() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProProject[]>(() => getProProjects());
  const [activeId, setActiveId] = useState<string>(() => getProProjects()[0]?.id ?? "");
  const ent = useEntitlements();
  const [showPlanLock, setShowPlanLock] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCheck, setNewCheck] = useState("");
  useEffect(() => { saveProProjects(projects); }, [projects]);
  const active = projects.find(p => p.id === activeId) ?? projects[0];

  const calcs = useMemo(() => (active ? active.takeoff.map(rowCalc) : []), [active]);
  const totalArea = calcs.reduce((s, c) => s + c.trueRoofArea, 0);
  const totalCost = calcs.reduce((s, c) => s + c.subtotal, 0);
  const measureTotals = useMemo(() => {
    let area = 0, vol = 0;
    (active?.measures ?? []).forEach(m => { const v = measureValue(m); if (v.kind === "area") area += v.value; if (v.kind === "vol") vol += v.value; });
    return { area, vol };
  }, [active]);

  if (!active) return (<div><PageHead kicker="Pro Workspace" title="Field workspace for pros" lead="Create your first project to start a take-off sheet." /><div className="mx-auto max-w-3xl px-4 py-12"><div className="flex gap-3"><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Project name — e.g. Duplex at Ajah" className="field-tech font-tech" /><Button className="rounded-none font-display uppercase shrink-0" onClick={createProject}>Create project</Button></div></div></div>);

  function patchActive(patch: Partial<ProProject>) { setProjects(ps => ps.map(p => (p.id === active.id ? { ...p, ...patch } : p))); }
  function createProject() {
    if (!ent.isPro && projects.length >= FREE_PROJECT_LIMIT) { setShowPlanLock(true); return; }
    const name = newName.trim() || `Project ${projects.length + 1}`;
    const p: ProProject = { id: uid(), name, client: "", siteAddress: "", date: new Date().toISOString().slice(0, 10), trade: "Roofer", status: "Measuring", notes: "", takeoff: [emptyTakeOffRow()], measures: [emptyMeasureRow()], checklist: defaultChecklist(), createdAt: new Date().toISOString() };
    setProjects(ps => [p, ...ps]); setActiveId(p.id); setNewName(""); toast.success("Project created");
  }
  function duplicateProject() {
    const copy: ProProject = { ...JSON.parse(JSON.stringify(active)) as ProProject, id: uid(), name: active.name + " (copy)", sample: false, createdAt: new Date().toISOString() };
    setProjects(ps => [copy, ...ps]); setActiveId(copy.id); toast.success("Project duplicated");
  }
  function deleteProject() {
    if (!window.confirm(`Delete "${active.name}"? This cannot be undone.`)) return;
    const rest = projects.filter(p => p.id !== active.id);
    setProjects(rest); setActiveId(rest[0]?.id ?? ""); toast.success("Project deleted");
  }
  const patchRow = (id: string, patch: Partial<TakeOffRow>) => patchActive({ takeoff: active.takeoff.map(r => (r.id === id ? { ...r, ...patch } : r)) });
  const patchMeasure = (id: string, patch: Partial<ProProject["measures"][number]>) => patchActive({ measures: active.measures.map(m => (m.id === id ? { ...m, ...patch } : m)) });

  function downloadCSV() {
    const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines: string[] = [];
    lines.push(["OKETEX PRO WORKSHEET"].map(esc).join(","));
    lines.push(["Project", active.name].map(esc).join(",")); lines.push(["Client", active.client].map(esc).join(","));
    lines.push(["Site address", active.siteAddress].map(esc).join(",")); lines.push(["Date", active.date].map(esc).join(","));
    lines.push(["Trade", active.trade].map(esc).join(",")); lines.push(["Status", active.status].map(esc).join(",")); lines.push("");
    lines.push(["ROOF TAKE-OFF SHEET"].map(esc).join(","));
    lines.push(["Section", "Length m", "Width m", "Pitch deg", "Style", "Profile", "Overhang m", "True area m2", "Cutting list", "Section subtotal NGN"].map(esc).join(","));
    active.takeoff.forEach((r, i) => { const c = calcs[i]; lines.push([r.section, r.length, r.width, r.pitch, r.style, PROFILES[r.profile].label, r.overhang, c.trueRoofArea.toFixed(2), c.cuttingList, c.subtotal].map(esc).join(",")); });
    lines.push(["TOTALS", "", "", "", "", "", "", totalArea.toFixed(2), "", totalCost].map(esc).join(",")); lines.push("");
    lines.push(["BUILDING MEASUREMENT SHEET"].map(esc).join(","));
    lines.push(["Item", "Location", "L", "W", "H", "Qty", "Unit", "Computed", "Note"].map(esc).join(","));
    active.measures.forEach(m => lines.push([m.item, m.location, m.l, m.w, m.h, m.qty, m.unit, measureValue(m).label, m.note].map(esc).join(",")));
    lines.push(["TOTALS", "", "", "", "", "", "", `Area ${measureTotals.area.toFixed(2)} m2 · Volume ${measureTotals.vol.toFixed(2)} m3`].map(esc).join(",")); lines.push("");
    lines.push(["SITE NOTES"].map(esc).join(",")); lines.push([active.notes].map(esc).join(","));
    lines.push(["CHECKLIST"].map(esc).join(","));
    active.checklist.forEach(c => lines.push([c.done ? "DONE" : "TODO", c.label].map(esc).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${active.name.replace(/[^\w-]+/g, "-").toLowerCase()}-worksheet.csv`; a.click(); URL.revokeObjectURL(a.href);
    toast.success("CSV downloaded");
  }
  const waSummary = () => businessWaLink(`PRO WORKSHEET — ${active.name}\nClient: ${active.client || "—"} · Site: ${active.siteAddress || "—"}\nRoof take-off: ${active.takeoff.length} section(s), ${totalArea.toFixed(1)}m² true area, materials ${formatNGN(totalCost)}\nMeasurements: ${measureTotals.area.toFixed(1)}m² area · ${measureTotals.vol.toFixed(2)}m³ volume\nNotes: ${active.notes || "—"}\n— Sent from Oketex Pro Workspace`);
  const openInCalculator = (r: TakeOffRow) => {
    try { localStorage.setItem("oketex-prefill", JSON.stringify({ length: r.length, width: r.width })); } catch { /* ignore */ }
    navigate(`/quote?length=${r.length}&width=${r.width}&style=${r.style}&profile=${r.profile}`);
  };

  return (<div><PageHead kicker="Pro Workspace — Roofers · Carpenters · Engineers" title="Your site spreadsheet & notes" lead="Projects with a live roof take-off sheet (priced by the same engine as the Pro Calculator), a building measurement sheet for any trade, site notes and a kit checklist. Saved on this device." />
  <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-8 flex flex-wrap gap-3 items-center no-print">
    <Link to="/documents" className="inline-flex items-center gap-2 border border-foreground/40 font-display font-semibold uppercase tracking-wider px-4 h-10 hover:border-primary hover:text-primary">Pro Documents — notes, quotes, contracts & invoices</Link>
    <Link to="/roofing-guide" className="inline-flex items-center gap-2 border border-foreground/40 font-display font-semibold uppercase tracking-wider px-4 h-10 hover:border-primary hover:text-primary">Roofing Guide — styles & measurements</Link>
    <Link to="/pro-guide" className="inline-flex items-center gap-2 border border-primary/70 text-primary font-display font-semibold uppercase tracking-wider px-4 h-10 hover:bg-primary hover:text-primary-foreground">Forgot a pattern? Ask the Pro Guide</Link>
    <select aria-label="Open a pattern in the Pro Guide" defaultValue="" onChange={e => { if (e.target.value) navigate(`/pro-guide?pattern=${e.target.value}`); }} className="field-tech font-tech bg-background h-10 w-auto cursor-pointer">
      <option value="" disabled>Pattern quick-pick…</option>
      {ROOF_PATTERNS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
    <span className="ml-auto"><PlanChip /></span>
  </div>
  <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-8 no-print"><InstallCard /></div>
  {showPlanLock && (<div className="mx-auto max-w-7xl px-4 sm:px-6 pt-8 no-print"><PlanGate feature="Unlimited Workspace projects"><span /></PlanGate><div className="text-center mt-3"><button onClick={() => setShowPlanLock(false)} className="font-tech text-xs text-muted-foreground hover:text-primary cursor-pointer">← Back to my project (your existing project keeps working)</button></div></div>)}
  <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 grid lg:grid-cols-[300px_1fr] gap-8">
    {/* Project list */}
    <aside className="no-print space-y-4">
      <div className="flex gap-2"><input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && createProject()} placeholder="New project name…" className="field-tech font-tech text-sm" aria-label="New project name" /><Button className="rounded-none font-display uppercase shrink-0" onClick={createProject}>+ New</Button></div>
      <div className="border hairline divide-y divide-white/10">
        {projects.map(p => (<button key={p.id} onClick={() => setActiveId(p.id)} className={`w-full text-left px-4 py-3 cursor-pointer ${p.id === active.id ? "bg-primary/15 border-l-2 border-l-primary" : "hover:bg-card"}`}>
          <span className="font-display font-semibold uppercase block leading-tight">{p.name}</span>
          <span className="font-tech text-[11px] text-muted-foreground">{p.trade} · {p.status} · {p.takeoff.length} roof section{p.takeoff.length === 1 ? "" : "s"}{p.sample ? " · SAMPLE" : ""}</span>
        </button>))}
      </div>
      <p className="font-tech text-[11px] text-muted-foreground">Everything is stored locally in this browser — download the CSV before switching devices.</p>
    </aside>

    {/* Project detail */}
    <div className="print-boq border hairline bg-card">
      <div className="px-6 py-5 border-b hairline">
        <div className="flex flex-wrap gap-3 justify-between items-start">
          <div><h2 className="font-display font-bold uppercase text-2xl leading-tight">{active.name}{active.sample && <span className="ml-2 align-middle font-tech text-[10px] border border-primary text-primary px-2 py-0.5">SAMPLE</span>}</h2>
          <p className="font-tech text-[11px] text-muted-foreground mt-1">{BUSINESS.name} · Pro Worksheet</p></div>
          <div className="flex flex-wrap gap-2 no-print">
            <Button variant="outline" className="rounded-none font-display uppercase text-xs" onClick={duplicateProject}>Duplicate</Button>
            <Button variant="outline" className="rounded-none font-display uppercase text-xs" onClick={deleteProject}>Delete</Button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
          <div><label className="label-tech">Project name</label><input className={cellCls} value={active.name} onChange={e => patchActive({ name: e.target.value })} /></div>
          <div><label className="label-tech">Client</label><input className={cellCls} value={active.client} onChange={e => patchActive({ client: e.target.value })} placeholder="Client name" /></div>
          <div><label className="label-tech">Site address</label><input className={cellCls} value={active.siteAddress} onChange={e => patchActive({ siteAddress: e.target.value })} placeholder="Street, area, town" /></div>
          <div><label className="label-tech">Date</label><input type="date" className={cellCls} value={active.date} onChange={e => patchActive({ date: e.target.value })} /></div>
          <div><label className="label-tech">Trade</label><select className={cellCls + " bg-card"} value={active.trade} onChange={e => patchActive({ trade: e.target.value as ProProject["trade"] })}>{TRADES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="label-tech">Status</label><select className={cellCls + " bg-card"} value={active.status} onChange={e => patchActive({ status: e.target.value as ProProject["status"] })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
        </div>
      </div>

      {/* Take-off sheet */}
      <div className="px-6 py-5 border-b hairline">
        <div className="flex justify-between items-center flex-wrap gap-3"><h3 className="font-display font-bold uppercase text-xl">Roof take-off spreadsheet</h3><Button variant="outline" className="rounded-none font-display uppercase text-xs no-print" onClick={() => patchActive({ takeoff: [...active.takeoff, emptyTakeOffRow()] })}>+ Add section</Button></div>
        <p className="font-tech text-[11px] text-muted-foreground mt-1">Each row is priced live by the roof engine (slope factor, waste, ridge &amp; screws included; pickup, no extras).</p>
        <div className="overflow-x-auto mt-4"><table className="w-full text-sm min-w-[980px]"><thead><tr className="border-b hairline text-left font-tech text-[10px] uppercase tracking-widest text-muted-foreground">
          <th className="py-2 pr-2">Section</th><th className="py-2 pr-2 text-right">L (m)</th><th className="py-2 pr-2 text-right">W (m)</th><th className="py-2 pr-2 text-right">Pitch°</th><th className="py-2 pr-2">Style</th><th className="py-2 pr-2">Profile</th><th className="py-2 pr-2 text-right">Ov. (m)</th><th className="py-2 pr-2 text-right">True area</th><th className="py-2 pr-2">Sheets / tiles</th><th className="py-2 pr-2 text-right">Subtotal</th><th className="py-2 no-print"></th>
        </tr></thead><tbody>
          {active.takeoff.map((r, i) => { const c = calcs[i]; return (<tr key={r.id} className="border-b hairline align-top">
            <td className="py-1 pr-2 min-w-[130px]"><input className={cellCls} value={r.section} onChange={e => patchRow(r.id, { section: e.target.value })} /></td>
            <td className="py-1 pr-2 w-20"><input type="number" step="0.1" className={numCls} value={r.length} onChange={e => patchRow(r.id, { length: parseFloat(e.target.value) || 0 })} /></td>
            <td className="py-1 pr-2 w-20"><input type="number" step="0.1" className={numCls} value={r.width} onChange={e => patchRow(r.id, { width: parseFloat(e.target.value) || 0 })} /></td>
            <td className="py-1 pr-2 w-16"><input type="number" step="1" className={numCls} value={r.pitch} onChange={e => patchRow(r.id, { pitch: parseFloat(e.target.value) || 0 })} /></td>
            <td className="py-1 pr-2 w-24"><select className={cellCls + " bg-card"} value={r.style} onChange={e => patchRow(r.id, { style: e.target.value as TakeOffRow["style"] })}>{(["gable", "hip", "shed", "flat"] as const).map(s => <option key={s} value={s}>{s}</option>)}</select></td>
            <td className="py-1 pr-2 w-40"><select className={cellCls + " bg-card"} value={r.profile} onChange={e => patchRow(r.id, { profile: e.target.value as TakeOffRow["profile"] })}>{PROFILE_IDS.map(id => <option key={id} value={id}>{PROFILES[id].label}</option>)}</select></td>
            <td className="py-1 pr-2 w-16"><input type="number" step="0.1" className={numCls} value={r.overhang} onChange={e => patchRow(r.id, { overhang: parseFloat(e.target.value) || 0 })} /></td>
            <td className="py-2 pr-2 text-right font-tech whitespace-nowrap">{c.trueRoofArea.toFixed(1)} m²</td>
            <td className="py-2 pr-2 font-tech text-[11px] min-w-[180px]">{c.tiles ? `${c.tiles.toLocaleString()} tiles` : c.cuttingList}<button className="block text-primary text-[10px] uppercase tracking-widest mt-1 no-print" onClick={() => openInCalculator(r)}>Open in Pro Calculator →</button></td>
            <td className="py-2 pr-2 text-right font-tech whitespace-nowrap">{formatNGN(c.subtotal)}</td>
            <td className="py-2 no-print"><button className="text-muted-foreground hover:text-red-400 font-tech" aria-label="Remove section" onClick={() => patchActive({ takeoff: active.takeoff.filter(x => x.id !== r.id) })}>✕</button></td>
          </tr>); })}
        </tbody><tfoot><tr className="font-tech"><td className="py-3" colSpan={7}>TOTALS — {active.takeoff.length} section(s)</td><td className="py-3 text-right text-primary">{totalArea.toFixed(1)} m²</td><td></td><td className="py-3 text-right text-primary">{formatNGN(totalCost)}</td><td></td></tr></tfoot></table></div>
      </div>

      {/* Measurement sheet */}
      <div className="px-6 py-5 border-b hairline">
        <div className="flex justify-between items-center flex-wrap gap-3"><h3 className="font-display font-bold uppercase text-xl">Building measurement sheet</h3><Button variant="outline" className="rounded-none font-display uppercase text-xs no-print" onClick={() => patchActive({ measures: [...active.measures, emptyMeasureRow()] })}>+ Add row</Button></div>
        <p className="font-tech text-[11px] text-muted-foreground mt-1">Any trade: windows, doors, rooms, slabs, walls. Leave H empty for area (L×W); add H for volume (L×W×H).</p>
        <div className="overflow-x-auto mt-4"><table className="w-full text-sm min-w-[900px]"><thead><tr className="border-b hairline text-left font-tech text-[10px] uppercase tracking-widest text-muted-foreground">
          <th className="py-2 pr-2">Item</th><th className="py-2 pr-2">Location</th><th className="py-2 pr-2 text-right">L</th><th className="py-2 pr-2 text-right">W</th><th className="py-2 pr-2 text-right">H</th><th className="py-2 pr-2 text-right">Qty</th><th className="py-2 pr-2">Unit</th><th className="py-2 pr-2 text-right">Computed</th><th className="py-2 pr-2">Note</th><th className="py-2 no-print"></th>
        </tr></thead><tbody>
          {active.measures.map(m => (<tr key={m.id} className="border-b hairline align-top">
            <td className="py-1 pr-2 min-w-[140px]"><input className={cellCls} value={m.item} onChange={e => patchMeasure(m.id, { item: e.target.value })} placeholder="e.g. Bedroom 1 window" /></td>
            <td className="py-1 pr-2 min-w-[110px]"><input className={cellCls} value={m.location} onChange={e => patchMeasure(m.id, { location: e.target.value })} /></td>
            <td className="py-1 pr-2 w-16"><input type="number" step="0.01" className={numCls} value={m.l} onChange={e => patchMeasure(m.id, { l: parseFloat(e.target.value) || 0 })} /></td>
            <td className="py-1 pr-2 w-16"><input type="number" step="0.01" className={numCls} value={m.w} onChange={e => patchMeasure(m.id, { w: parseFloat(e.target.value) || 0 })} /></td>
            <td className="py-1 pr-2 w-16"><input type="number" step="0.01" className={numCls} value={m.h} onChange={e => patchMeasure(m.id, { h: parseFloat(e.target.value) || 0 })} /></td>
            <td className="py-1 pr-2 w-14"><input type="number" step="1" className={numCls} value={m.qty} onChange={e => patchMeasure(m.id, { qty: parseFloat(e.target.value) || 0 })} /></td>
            <td className="py-1 pr-2 w-20"><select className={cellCls + " bg-card"} value={m.unit} onChange={e => patchMeasure(m.id, { unit: e.target.value })}>{["m", "m²", "m³", "pcs"].map(u => <option key={u}>{u}</option>)}</select></td>
            <td className="py-2 pr-2 text-right font-tech whitespace-nowrap text-primary">{measureValue(m).label}</td>
            <td className="py-1 pr-2 min-w-[110px]"><input className={cellCls} value={m.note} onChange={e => patchMeasure(m.id, { note: e.target.value })} /></td>
            <td className="py-2 no-print"><button className="text-muted-foreground hover:text-red-400 font-tech" aria-label="Remove row" onClick={() => patchActive({ measures: active.measures.filter(x => x.id !== m.id) })}>✕</button></td>
          </tr>))}
        </tbody><tfoot><tr className="font-tech"><td className="py-3" colSpan={7}>TOTALS</td><td className="py-3 text-right text-primary whitespace-nowrap">{measureTotals.area.toFixed(2)} m² · {measureTotals.vol.toFixed(2)} m³</td><td colSpan={2}></td></tr></tfoot></table></div>
      </div>

      {/* Notes + checklist */}
      <div className="px-6 py-5 grid md:grid-cols-2 gap-8">
        <div><h3 className="font-display font-bold uppercase text-xl mb-3">Site notes</h3>
          <textarea value={active.notes} onChange={e => patchActive({ notes: e.target.value })} rows={8} placeholder="Access, ground conditions, client decisions, things to confirm…" className="w-full bg-transparent border hairline p-3 text-sm focus:outline-none focus:border-primary" /></div>
        <div><h3 className="font-display font-bold uppercase text-xl mb-3">Materials &amp; kit checklist</h3>
          <div className="space-y-2">{active.checklist.map(c => (<label key={c.id} className="flex items-center gap-3 text-sm cursor-pointer"><Checkbox checked={c.done} onCheckedChange={v => patchActive({ checklist: active.checklist.map(x => (x.id === c.id ? { ...x, done: !!v } : x)) })} /><span className={c.done ? "line-through text-muted-foreground" : ""}>{c.label}</span><button className="ml-auto text-muted-foreground hover:text-red-400 font-tech text-xs no-print" aria-label="Remove checklist item" onClick={e => { e.preventDefault(); patchActive({ checklist: active.checklist.filter(x => x.id !== c.id) }); }}>✕</button></label>))}</div>
          <div className="flex gap-2 mt-4 no-print"><input value={newCheck} onChange={e => setNewCheck(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newCheck.trim()) { patchActive({ checklist: [...active.checklist, { id: uid(), label: newCheck.trim(), done: false }] }); setNewCheck(""); } }} placeholder="Add item — e.g. Valley gutter roll" className="field-tech font-tech text-sm" /><Button variant="outline" className="rounded-none font-display uppercase text-xs shrink-0" onClick={() => { if (newCheck.trim()) { patchActive({ checklist: [...active.checklist, { id: uid(), label: newCheck.trim(), done: false }] }); setNewCheck(""); } }}>Add</Button></div>
        </div>
      </div>

      <div className="px-6 py-5 border-t hairline flex flex-wrap gap-3 no-print">
        <Button className="rounded-none font-display uppercase" onClick={downloadCSV}>Download CSV</Button>
        <Button variant="outline" className="rounded-none font-display uppercase" onClick={() => window.print()}>Print sheet</Button>
        <Button variant="outline" className="rounded-none font-display uppercase" asChild><a target="_blank" rel="noreferrer" href={waSummary()}>Send summary on WhatsApp</a></Button>
      </div>
    </div>
  </div></div>);
}
