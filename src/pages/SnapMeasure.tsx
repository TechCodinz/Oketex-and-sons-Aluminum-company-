import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Camera, Undo2, Trash2, ArrowRight } from "lucide-react";
import { PageHead } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
type Pt={x:number;y:number}; type Line={a:Pt;b:Pt;label:string;metres:number};
const PRESETS=[{label:"Standard door height 2.1m",m:2.1},{label:"Door width 0.9m",m:0.9},{label:"9-inch block course 0.225m",m:0.225},{label:"Custom",m:0}];
export default function SnapMeasure(){
 const navigate=useNavigate();
 const [img,setImg]=useState<string|null>(null);
 const [preset,setPreset]=useState(0); const [custom,setCustom]=useState("1");
 const [pxPerM,setPxPerM]=useState<number|null>(null);
 const [draft,setDraft]=useState<Pt|null>(null);
 const [lines,setLines]=useState<Line[]>([]);
 const [label,setLabel]=useState("Roof Width");
 const [mode,setMode]=useState<"calibrate"|"measure">("calibrate");
 const svgRef=useRef<SVGSVGElement>(null);
 const knownM=()=> preset===3? (parseFloat(custom)||1) : PRESETS[preset].m;
 const getPt=(e:React.PointerEvent)=>{
   const r=svgRef.current!.getBoundingClientRect();
   // SVG viewBox 0 0 1000 700 — map pointer to that space
   return { x: ((e.clientX-r.left)/r.width)*1000, y: ((e.clientY-r.top)/r.height)*700 };
 };
 const dist=(a:Pt,b:Pt)=>Math.hypot(a.x-b.x,a.y-b.y);
 const onTap=(e:React.PointerEvent)=>{
   if(!img) return; const p=getPt(e);
   if(!draft){ setDraft(p); return; }
   const d=dist(draft,p);
   if(mode==="calibrate"){ const ppm=d/knownM(); setPxPerM(ppm); toast.success(`Calibrated: ${ppm.toFixed(1)} px per metre`); setMode("measure"); }
   else { if(!pxPerM) return toast.error("Calibrate first"); setLines(prev=>[...prev,{a:draft,b:p,label,metres:d/pxPerM}]); }
   setDraft(null);
 };
 const w=lines.find(l=>l.label==="Roof Width")?.metres; const s=lines.find(l=>l.label==="Slope Length")?.metres;
 const areaEst = w&&s? w*s*2 : null;
 const sendToCalc=()=>{
   const L=w||undefined; const W=s? s*2 : undefined; // slope pair approx: width ~ 2*slope*cos ignored — send length + note; use roof width as length, derived width from slope if available
   localStorage.setItem("oketex-prefill", JSON.stringify({length: L||10, width: W||8}));
   navigate(`/quote?length=${L||10}&width=${W||8}`);
 };
 return (<div><PageHead kicker="Snap-Measure — Assisted Photo Measurement" title="Measure from a photo" lead="Honest assisted measurement — not magic AI. You calibrate with something you know, then draw. A free site survey always confirms final measurements." />
 <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 grid lg:grid-cols-[1fr_360px] gap-10">
  <div>
   <div className="flex flex-wrap gap-3 mb-4">
    <label className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-display font-semibold uppercase px-5 py-3 cursor-pointer"><Camera className="h-4 w-4" /> Upload / Take photo<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if(f) setImg(URL.createObjectURL(f)); }} /></label>
    <Button variant="outline" className="rounded-none font-display uppercase" onClick={()=>{setLines(lines.slice(0,-1));}}><Undo2 className="h-4 w-4 mr-2" /> Undo</Button>
    <Button variant="outline" className="rounded-none font-display uppercase" onClick={()=>{setLines([]); setPxPerM(null); setMode("calibrate"); setDraft(null);}}><Trash2 className="h-4 w-4 mr-2" /> Clear</Button>
   </div>
   <ol className="font-tech text-xs text-muted-foreground space-y-1 mb-4 list-decimal ml-4"><li>Upload a straight-on photo of the building.</li><li>CALIBRATE: pick a known size, tap both ends of that object in the photo.</li><li>MEASURE: choose a label, tap both ends of the wall / roof edge.</li><li>Send dimensions to the Pro Calculator.</li></ol>
   <div className="border hairline bg-card relative overflow-hidden touch-none">
    {img ? (<svg ref={svgRef} viewBox="0 0 1000 700" className="w-full block cursor-crosshair" onPointerDown={onTap} role="img" aria-label="Measurement canvas">
      <image href={img} x="0" y="0" width="1000" height="700" preserveAspectRatio="xMidYMid slice" />
      {lines.map((l,i)=>(<g key={i}><line x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke="#FF6026" strokeWidth="4" /><circle cx={l.a.x} cy={l.a.y} r="7" fill="#FF6026" /><circle cx={l.b.x} cy={l.b.y} r="7" fill="#FF6026" /><text x={(l.a.x+l.b.x)/2} y={(l.a.y+l.b.y)/2-10} fill="#fff" stroke="#000" strokeWidth="0.6" fontSize="22" textAnchor="middle" fontFamily="monospace">{l.label}: {l.metres.toFixed(2)}m</text></g>))}
      {draft && <circle cx={draft.x} cy={draft.y} r="8" fill="#FFD166" stroke="#000" />}
    </svg>) : (<div className="py-24 text-center font-tech text-sm text-muted-foreground uppercase tracking-widest px-6">No photo yet — upload or take one to start measuring</div>)}
   </div>
   {draft && <p className="font-tech text-xs text-primary mt-2">First point set — tap the other end.</p>}
  </div>
  <aside className="space-y-6">
   <div className="border hairline bg-card p-5"><p className="label-tech mb-3">Step 1 — Calibration reference</p><select value={preset} onChange={e=>setPreset(Number(e.target.value))} className="field-tech font-tech bg-background w-full">{PRESETS.map((p,i)=>(<option key={p.label} value={i}>{p.label}</option>))}</select>{preset===3 && <input value={custom} onChange={e=>setCustom(e.target.value)} placeholder="Metres (e.g. 3.6)" className="field-tech font-tech mt-2" /> }<p className="font-tech text-xs mt-3">{pxPerM?`Calibrated: ${pxPerM.toFixed(1)} px / metre`:"Not calibrated yet — draw over the reference object."}</p><Button variant={mode==="calibrate"?"default":"outline"} className="rounded-none font-display uppercase mt-3 w-full" onClick={()=>setMode("calibrate")}>{mode==="calibrate"?"Tap two ends of reference…":"Re-calibrate"}</Button></div>
   <div className="border hairline bg-card p-5"><p className="label-tech mb-3">Step 2 — Measure</p><div className="flex flex-wrap gap-2">{["Roof Width","Slope Length","Wall Height","Window","Door","Eaves Length"].map(l=>(<button key={l} onClick={()=>{setLabel(l); setMode("measure");}} className={`px-3 py-2 font-tech text-xs border hairline cursor-pointer ${label===l&&mode==="measure"?"bg-primary text-primary-foreground":"hover:text-primary"}`}>{l}</button>))}</div>
   {lines.length===0?<p className="font-tech text-xs text-muted-foreground mt-4">No measurements yet.</p>:<ul className="mt-4 space-y-2">{lines.map((l,i)=>(<li key={i} className="flex justify-between font-tech text-sm border-b hairline pb-2"><span>{l.label}</span><span className="text-primary">{l.metres.toFixed(2)} m</span></li>))}</ul>}
   {areaEst && <p className="font-tech text-xs mt-4">Facade / 2-slope roof estimate from Width × Slope × 2 ≈ <span className="text-primary">{areaEst.toFixed(1)} m²</span> (rough — survey confirms).</p>}
   <Button className="rounded-none font-display uppercase w-full mt-5 h-12" onClick={sendToCalc}>Send to Pro Calculator <ArrowRight className="h-4 w-4 ml-2" /></Button><p className="font-tech text-[11px] text-muted-foreground mt-2">Sends Roof Width as length. Adjust width/pitch in the calculator — slope length depends on pitch.</p></div>
  </aside>
 </div></div>);
}
