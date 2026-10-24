import { useMemo, useState } from "react";
import { PageHead } from "@/components/StatusBadge";
import { formatNGN } from "@/lib/money";
import ProToolsSections from "@/components/ProToolsSections";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
function Num({label,value,set,step="0.1"}:{label:string;value:number;set:(n:number)=>void;step?:string}){ return (<div><label className="label-tech">{label}</label><input type="number" step={step} value={value} onChange={e=>set(parseFloat(e.target.value)||0)} className="field-tech font-tech" /></div>); }
function Card({title,children,result}:{title:string;children:React.ReactNode;result:React.ReactNode}){ return (<section className="border hairline bg-card p-6"><h3 className="font-display font-bold uppercase text-xl">{title}</h3><div className="grid grid-cols-2 gap-4 mt-5">{children}</div><div className="mt-5 border-t hairline pt-4 font-tech text-sm space-y-1">{result}</div></section>); }
export default function Tools(){
 const [rise,setRise]=useState(2.5); const [run,setRun]=useState(5);
 const pitch=useMemo(()=>{ const deg=Math.atan(rise/run)*180/Math.PI; return {deg, pct: run? (rise/run)*100:0, factor: 1/Math.cos(Math.atan(rise/run)), rafter: Math.sqrt(rise*rise+run*run)}; },[rise,run]);
 const [L,setL]=useState(6); const [W,setW]=useState(1); const [T,setT]=useState(0.45); const [coilLen,setCoilLen]=useState(100);
 const weight=L*W*(T/1000)*2700; const coilWeight=coilLen*W*(T/1000)*2700;
 const [gArea,setGArea]=useState(150); const [rain,setRain]=useState(150);
 const flow=gArea*rain/3600; const gutterSize=flow<=3?"125mm half-round":flow<=6?"150mm box":"200mm box / 2 outlets"; const downpipes=Math.max(1,Math.ceil(gArea/40)); const downDia=gArea/downpipes<=40?"75mm":"100mm";
 const [winType,setWinType]=useState("casement"); const [ww,setWw]=useState(1.2); const [wh,setWh]=useState(1.2); const [glass,setGlass]=useState(1); const [finish,setFinish]=useState(1);
 const winArea=ww*wh; const winPrice=useMemo(()=>{ const base= winType==="casement"?145000/1.44 : winType==="sliding"?160000/1.44 : 95000/1.44; return Math.round(base*winArea*glass*finish/1000)*1000; },[winType,winArea,glass,finish]);
 const [convArea,setConvArea]=useState(150);
 return (<div><PageHead kicker="Engineering Tools Hub" title="Calculators that do the maths" lead="Ten live tools used by our estimators and pros on site — pitch, weight, rainwater, windows, coverage, tape fractions, squaring, cut optimisation and block & concrete quantities. All computed in your browser." />
 <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 grid lg:grid-cols-2 gap-6">
  <Card title="(a) Pitch Finder" result={<><p>Pitch: <b className="text-primary">{pitch.deg.toFixed(1)}°</b> · {pitch.pct.toFixed(0)}%</p><p>Slope factor: {pitch.factor.toFixed(3)} · Rafter length for this run: {pitch.rafter.toFixed(2)} m</p><p className="text-muted-foreground text-xs">deg = atan(rise/run), factor = 1/cos(deg)</p></>}>
   <Num label="Rise (m)" value={rise} set={setRise} /><Num label="Run (m)" value={run} set={setRun} /></Card>
  <Card title="(b) Aluminium Weight Calculator" result={<><p>Sheet weight: <b className="text-primary">{weight.toFixed(2)} kg</b></p><p>Coil ({coilLen}m × {W}m): {coilWeight.toFixed(1)} kg</p><p className="text-muted-foreground text-xs">kg = L × W × thickness(m) × 2700 kg/m³ — i.e. L×W×t(mm)×2.7</p></>}>
   <Num label="Length (m)" value={L} set={setL} /><Num label="Width (m)" value={W} set={setW} /><Num label="Thickness (mm)" value={T} set={setT} step="0.01" /><Num label="Coil length (m)" value={coilLen} set={setCoilLen} /></Card>
  <Card title="(c) Gutter & Rainwater Sizer" result={<><p>Design flow: <b className="text-primary">{flow.toFixed(2)} L/s</b></p><p>Recommended gutter: {gutterSize}</p><p>Downpipes: {downpipes} × {downDia} (1 per ~40m²)</p></>}>
   <Num label="Roof plan area (m²)" value={gArea} set={setGArea} /><Num label="Rainfall (mm/hr)" value={rain} set={setRain} /></Card>
  <Card title="(d) Window & Door Pricer" result={<><p>Area: {winArea.toFixed(2)} m²</p><p>Estimate: <b className="text-primary">{formatNGN(winPrice)}</b></p><p className="text-muted-foreground text-xs">Casement baseline ₦145,000 per 1.44m² (catalog). Glass/finish multipliers are estimates — survey confirms.</p></>}>
   <div><label className="label-tech">Type</label><select value={winType} onChange={e=>setWinType(e.target.value)} className="field-tech font-tech bg-background w-full"><option value="casement">Casement window</option><option value="sliding">Sliding window/door</option><option value="fixed">Fixed lite</option></select></div><div></div>
   <Num label="Width (m)" value={ww} set={setWw} /><Num label="Height (m)" value={wh} set={setWh} />
   <div><label className="label-tech">Glass</label><select value={glass} onChange={e=>setGlass(Number(e.target.value))} className="field-tech font-tech bg-background w-full"><option value={1}>5mm clear (×1.0)</option><option value={1.15}>Tinted (×1.15)</option><option value={1.35}>Reflective (×1.35)</option><option value={1.6}>Toughened (×1.6)</option></select></div>
   <div><label className="label-tech">Finish</label><select value={finish} onChange={e=>setFinish(Number(e.target.value))} className="field-tech font-tech bg-background w-full"><option value={1}>Mill (×1.0)</option><option value={1.1}>Anodized (×1.1)</option><option value={1.2}>Powder-coated (×1.2)</option></select></div></Card>
  <Card title="(e) Coverage Converter" result={<><p>Stone-coated tiles: {Math.ceil(convArea/0.48).toLocaleString()} tiles</p><p>Longspan (1.0m cover, per slope metre): {(convArea).toFixed(0)} m² ÷ slope — use Pro Calculator for cutting list</p><p>Metcoppo metres ≈ {(convArea/0.96).toFixed(1)} m of width-coverage equivalent</p><p>Corrugated 3m sheets (0.9m cover): ~{Math.ceil(convArea/(3*0.9))} sheets (flat approx, slope increases this)</p><p>Insulation rolls: {Math.ceil(convArea/30)} rolls</p></>}>
   <Num label="Roof area (m²)" value={convArea} set={setConvArea} /><div className="font-tech text-xs text-muted-foreground self-end pb-3">For exact slope-corrected quantities, use the Pro Roof Calculator.</div></Card>
  <Link to="/roofing-guide" className="border hairline bg-card p-6 block hover:border-primary group"><h3 className="font-display font-bold uppercase text-xl group-hover:text-primary">Roofing Guide — Styles, Methods & Measurements</h3><p className="text-sm text-muted-foreground mt-2">Roof anatomy with every part explained, the styles & patterns library, standard measurements (eaves, fascia, gutters, laps, fixings, pitches) and the eaves-angle / plumb-cut calculator.</p><p className="font-tech text-xs text-primary mt-4 inline-flex items-center gap-2">Open the guide <ArrowRight className="h-3.5 w-3.5" /></p></Link>
  <Link to="/documents" className="border hairline bg-card p-6 block hover:border-primary group"><h3 className="font-display font-bold uppercase text-xl group-hover:text-primary">Pro Documents — Notes, Quotations, Contracts & Invoices</h3><p className="text-sm text-muted-foreground mt-2">Your paperwork office on your own letterhead: an engineer's notebook, quotation creator, contract writer and digital invoices with balance tracking.</p><p className="font-tech text-xs text-primary mt-4 inline-flex items-center gap-2">Open Pro Documents <ArrowRight className="h-3.5 w-3.5" /></p></Link>
 </div>
 <ProToolsSections />
</div>);
}
