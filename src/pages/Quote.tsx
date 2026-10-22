import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { CheckCircle2, Copy, Printer, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { PageHead } from "@/components/StatusBadge";
import { formatNGN, formatUSD } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BUSINESS } from "@/contracts/constants";
import { getBusiness, businessWaLink, getRates } from "@/lib/settings";
import { ROOF_COLOURS } from "@/data/catalog";
import { calculateRoof, DELIVERY_ZONES, type RoofStyle, type ProfileId, AUTO_WASTE } from "@/lib/roofEngine";
import { saveQuote, quoteCode } from "@/lib/storage";

export default function Quote(){
 const [params]=useSearchParams();
 const prefill = (()=>{ try{ const raw=localStorage.getItem("oketex-prefill"); return raw?JSON.parse(raw):null; }catch{ return null; } })();
 const [length,setLength]=useState<number>(Number(params.get("length")||prefill?.length||10));
 const [width,setWidth]=useState<number>(Number(params.get("width")||prefill?.width||8));
 const [overhang,setOverhang]=useState(0.6);
 const [style,setStyle]=useState<RoofStyle>((params.get("style") as RoofStyle)||"gable");
 const [pitch,setPitch]=useState(25);
 const [rise,setRise]=useState(""); const [run,setRun]=useState("");
 const [profile,setProfile]=useState<ProfileId>((params.get("profile") as ProfileId)||"longspan-045");
 const [colour,setColour]=useState(params.get("colour")||prefill?.colour||"Charcoal");
 const [wasteMode,setWasteMode]=useState<"auto"|"custom">("auto"); const [customWaste,setCustomWaste]=useState(8);
 const [extras,setExtras]=useState({gutters:false,insulation:false,installation:false,timber:false});
 const [zone,setZone]=useState("ogun-lagos");
 const [contact,setContact]=useState({name:"",phone:"",email:"",note:""});
 const [done,setDone]=useState<{code:string; total:number}|null>(null);
 const [showFormulas,setShowFormulas]=useState(false);
 useEffect(()=>{ if(rise&&run){ const r=parseFloat(rise), rn=parseFloat(run); if(r>0&&rn>0) setPitch(Math.round(Math.atan(r/rn)*180/Math.PI)); } },[rise,run]);
 const result=useMemo(()=>calculateRoof({length,width,overhang,style,pitchDeg:pitch,profile,colour,wastePct:wasteMode==="auto"?null:customWaste,extras,deliveryZone:zone}),[length,width,overhang,style,pitch,profile,colour,wasteMode,customWaste,extras,zone]);
 const boqText=()=>`PRO ROOF ESTIMATE — ${BUSINESS.name}\n${result.lines.map(l=>`- ${l.item} (${l.spec}): ${l.qty} ${l.unit} × ${formatNGN(l.unitPrice)} = ${formatNGN(l.total)}`).join("\n")}\nTransport: ${formatNGN(result.transport)}\nTOTAL: ${formatNGN(result.grandTotal)} (${formatUSD(result.grandTotal)})\nTrue roof area: ${result.trueRoofArea.toFixed(1)}m² · Slope: ${result.slopeLength.toFixed(2)}m · Cutting: ${result.cuttingList}\nContact: ${contact.name} ${contact.phone}`;
 const doSave=()=>{
  if(contact.name.length<2) return toast.error("Enter your full name");
  if(contact.phone.length<7) return toast.error("Enter a valid phone number");
  const code=quoteCode(); saveQuote({code,name:contact.name,phone:contact.phone,email:contact.email,note:contact.note,roofType:profile,colour,areaM2:Math.round(result.trueRoofArea),estimateNgn:result.grandTotal,boqSummary:boqText(),status:"new",createdAt:new Date().toISOString()}); setDone({code,total:result.grandTotal}); toast.success("Quote saved on this device");
 };
 if(done) return (<div className="mx-auto max-w-2xl px-4 py-24 text-center"><CheckCircle2 className="h-14 w-14 text-primary mx-auto" /><h1 className="font-display font-bold uppercase text-4xl mt-6">Quote saved</h1><p className="text-muted-foreground mt-3">Reference <span className="font-tech text-primary">{done.code}</span> — saved on this device. Send it to us on WhatsApp for confirmation within 24 hours.</p><div className="mt-8 border hairline bg-card p-6"><p className="label-tech">Grand total</p><p className="font-display font-bold text-4xl text-primary mt-2">{formatNGN(done.total)}</p><p className="font-tech text-[11px] text-muted-foreground">{formatUSD(done.total)}</p></div><div className="flex flex-wrap gap-3 justify-center mt-6"><Button asChild className="rounded-none font-display uppercase"><a target="_blank" rel="noreferrer" href={businessWaLink(boqText())}>Send via WhatsApp</a></Button><Button variant="outline" className="rounded-none font-display uppercase" onClick={()=>window.print()}>Print BOQ</Button><Button variant="outline" className="rounded-none font-display uppercase" onClick={()=>setDone(null)}>New estimate</Button></div></div>);

 return (<div><PageHead kicker="Pro Roof Calculator — Engineering Estimator" title="Price your roof properly" lead="Real slope math, cutting list and a full Bill of Quantities — not just area × price. Pitch matters, and here it is calculated." />
 <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 grid lg:grid-cols-[1fr_520px] gap-10">
  <div className="space-y-10 no-print">
   <section><p className="label-tech mb-4">01 — Building size (metres)</p><div className="grid grid-cols-3 gap-4">
    {[["Building length (m)",length,setLength],["Building width (m)",width,setWidth],["Eaves overhang (m)",overhang,setOverhang]].map(([label,val,set]:any)=>(<div key={label}><label className="label-tech">{label}</label><input type="number" step="0.1" min={0} value={val} onChange={e=>(set as any)(parseFloat(e.target.value)||0)} className="field-tech font-tech text-xl" /></div>))}
   </div><p className="font-tech text-[11px] text-muted-foreground mt-2">Effective plan: {result.effLength.toFixed(2)}m × {result.effWidth.toFixed(2)}m = {result.effPlanArea.toFixed(1)}m² (includes overhang all sides). Use Snap-Measure if you only have a photo.</p></section>

   <section><p className="label-tech mb-4">02 — Roof style</p><div className="flex flex-wrap gap-px bg-border border hairline">{(["gable","hip","shed","flat","mansard"] as RoofStyle[]).map(s=>(<button key={s} onClick={()=>setStyle(s)} className={`px-4 py-2.5 font-tech text-xs uppercase tracking-widest cursor-pointer ${style===s?"bg-primary text-primary-foreground":"bg-background hover:text-primary"}`}>{s==="shed"?"Shed / Mono-pitch":s==="flat"?"Flat / Parapet":s}</button>))}</div><p className="font-tech text-[11px] text-muted-foreground mt-2">Auto waste for {style}: {AUTO_WASTE[style]}%</p></section>

   <section><p className="label-tech mb-4">03 — Pitch: {pitch}° {style==="flat" && result.pitchUsed!==pitch ? `(calculated at ${result.pitchUsed}° minimum for drainage)`:""}</p>
    <input type="range" min={5} max={50} value={pitch} onChange={e=>setPitch(Number(e.target.value))} className="w-full accent-[#FF6026]" aria-label="Pitch degrees" />
    <div className="flex flex-wrap gap-2 mt-3">{[15,20,25,30,35,40].map(d=>(<button key={d} onClick={()=>setPitch(d)} className={`px-3 py-1.5 font-tech text-xs border hairline cursor-pointer ${pitch===d?"bg-primary text-primary-foreground":"hover:text-primary"}`}>{d}°</button>))}</div>
    <div className="grid grid-cols-2 gap-4 mt-4 max-w-md"><div><label className="label-tech">Rise (helper)</label><input value={rise} onChange={e=>setRise(e.target.value)} placeholder="e.g. 2.5" className="field-tech font-tech" /></div><div><label className="label-tech">Run (helper)</label><input value={run} onChange={e=>setRun(e.target.value)} placeholder="e.g. 5" className="field-tech font-tech" /></div></div>
    <p className="font-tech text-[11px] text-muted-foreground mt-2">Pitch = atan(rise ÷ run). Slope factor = 1 ÷ cos(pitch) = {result.slopeFactor.toFixed(3)}</p></section>

   <section><p className="label-tech mb-4">04 — Profile &amp; colour</p><div className="grid sm:grid-cols-2 gap-px bg-border border hairline">{([["longspan-045","Longspan 0.45mm — ₦9,800/m"],["longspan-055","Longspan 0.55mm — ₦11,500/m"],["metcoppo","Metcoppo 0.50mm — ₦12,800/m"],["corrugated","Corrugated — ₦8,900/sheet"],["stone-coated","Stone-Coated — ₦6,900/tile"]] as [ProfileId,string][]).map(([id,label])=>(<button key={id} onClick={()=>setProfile(id)} className={`text-left p-4 cursor-pointer ${profile===id?"bg-primary/15 border-l-2 border-l-primary":"bg-background hover:bg-card"}`}><span className="font-display font-semibold uppercase">{label}</span></button>))}</div>
    <div className="flex flex-wrap gap-2 mt-4">{ROOF_COLOURS.map(c=>(<button key={c.name} title={c.name} onClick={()=>setColour(c.name)} className={`w-9 h-9 border-2 cursor-pointer ${colour===c.name?"border-[#FF6026] scale-110":"border-white/20"}`} style={{background:c.hex}} aria-label={c.name} />))}</div><p className="font-tech text-xs mt-2">Colour: <span className="text-primary">{colour}</span></p></section>

   <section><p className="label-tech mb-4">05 — Waste &amp; extras</p><div className="flex gap-2 mb-4"><button onClick={()=>setWasteMode("auto")} className={`px-3 py-2 font-tech text-xs border hairline cursor-pointer ${wasteMode==="auto"?"bg-primary text-primary-foreground":""}`}>Auto waste ({result.wastePct}%)</button><button onClick={()=>setWasteMode("custom")} className={`px-3 py-2 font-tech text-xs border hairline cursor-pointer ${wasteMode==="custom"?"bg-primary text-primary-foreground":""}`}>Custom</button>{wasteMode==="custom" && <input type="number" value={customWaste} onChange={e=>setCustomWaste(Number(e.target.value)||0)} className="field-tech font-tech w-24" aria-label="Custom waste percent" />}</div>
    <div className="grid sm:grid-cols-2 gap-4">{([["gutters","Seamless gutters & downpipes — ₦6,500/m"],["insulation","Reflective foil insulation — ₦46,500/roll"],["installation","Professional installation — ₦2,200/m² (estimator rate)"],["timber","Timber purlins — ₦1,800/m (estimator rate)"]] as const).map(([id,label])=>(<label key={id} className="flex items-center gap-3 border hairline p-4 cursor-pointer hover:border-primary/60"><Checkbox checked={extras[id]} onCheckedChange={(c)=>setExtras({...extras,[id]:!!c})} /><span className="text-sm">{label}</span></label>))}</div></section>

   <section><p className="label-tech mb-4">06 — Delivery zone</p><select value={zone} onChange={e=>setZone(e.target.value)} className="field-tech font-tech bg-background" aria-label="Delivery zone">{DELIVERY_ZONES.map(z=>{ const zp=getRates().deliveryZones[z.id] ?? z.price; return (<option key={z.id} value={z.id}>{z.label}{zp?` — ${formatNGN(zp)}`:""}</option>); })}</select></section>

   <section><p className="label-tech mb-4">07 — Your details (to save quote)</p><div className="grid sm:grid-cols-2 gap-5">{[["name","Full name"],["phone","Phone / WhatsApp"],["email","Email (optional)"],["note","Note (optional)"]].map(([id,label])=>(<div key={id}><label className="label-tech">{label}</label><input className="field-tech" value={(contact as any)[id]} onChange={e=>setContact({...contact,[id]:e.target.value})} /></div>))}</div></section>

   <button onClick={()=>setShowFormulas(!showFormulas)} className="inline-flex items-center gap-2 font-tech text-xs uppercase tracking-widest text-primary cursor-pointer">How this is calculated <ChevronDown className={`h-4 w-4 transition-transform ${showFormulas?"rotate-180":""}`} /></button>
   {showFormulas && <div className="border hairline bg-card p-5 font-tech text-xs space-y-2 text-muted-foreground"><p>slopeFactor = 1 / cos(pitchRad)</p><p>Effective dims = building dims + 2 × overhang</p><p>trueRoofArea = effectivePlanArea × slopeFactor (flat roofs use minimum 3° pitch for drainage)</p><p>slopeLength (gable/hip) = (effWidth/2) / cos(pitch); shed = effWidth / cos(pitch)</p><p>Sheets: sheetsAcross = ceil(effLength / coverWidth); totalMetres = sheetsAcross × slopeLength × slopes × (1+waste)</p><p>Stone-coated: tiles = ceil(trueArea × (1+waste) / 0.48)</p><p>Hip rafter = sqrt(slopeLength² + (effWidth/2)²); Ridge caps at ₦4,500/m (estimator rate)</p><p>Fasteners ≈ 7 screws/m² in 500pc buckets. Purlin rows every 0.9m. Gutters: gable 2×effLength, hip = perimeter.</p></div>}
  </div>

  <aside className="print-boq border hairline bg-card h-fit lg:sticky lg:top-28">
   <div className="px-6 py-4 border-b hairline flex justify-between"><span className="label-tech">Bill of Quantities — Live</span><span className="font-tech text-[10px] text-primary uppercase animate-pulse">● live</span></div>
   <div className="px-6 py-5 space-y-4">
    <div className="grid grid-cols-2 gap-3 font-tech text-xs"><div className="border hairline p-3"><span className="text-muted-foreground block">True roof area</span><span className="text-lg text-foreground">{result.trueRoofArea.toFixed(1)} m²</span></div><div className="border hairline p-3"><span className="text-muted-foreground block">Slope length</span><span className="text-lg text-foreground">{result.slopeLength.toFixed(2)} m</span></div><div className="border hairline p-3 col-span-2"><span className="text-muted-foreground block">Cutting list</span><span className="text-foreground">{result.cuttingList}</span></div></div>
    <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b hairline text-left font-tech text-muted-foreground"><th className="py-2 pr-2">Item</th><th className="py-2 pr-2 text-right">Qty</th><th className="py-2 pr-2 text-right">Rate</th><th className="py-2 text-right">Total</th></tr></thead><tbody>{result.lines.map((l,i)=>(<tr key={i} className="border-b hairline align-top"><td className="py-2 pr-2"><span className="font-medium">{l.item}</span><span className="block text-muted-foreground font-tech text-[10px]">{l.spec}{l.note?` · ${l.note}`:""}</span></td><td className="py-2 pr-2 text-right font-tech">{l.qty.toLocaleString()} {l.unit}</td><td className="py-2 pr-2 text-right font-tech">{formatNGN(l.unitPrice)}</td><td className="py-2 text-right font-tech">{formatNGN(l.total)}</td></tr>))}<tr className="border-b hairline"><td className="py-2">Transport / delivery</td><td></td><td></td><td className="py-2 text-right font-tech">{formatNGN(result.transport)}</td></tr></tbody></table></div>
    <div><div className="flex justify-between font-tech text-xs text-muted-foreground"><span>Subtotal</span><span>{formatNGN(result.subtotal)}</span></div><div className="font-display font-bold text-4xl text-primary mt-2">{formatNGN(result.grandTotal)}</div><div className="font-tech text-[11px] text-muted-foreground">{formatUSD(result.grandTotal)} · incl. {result.wastePct}% waste · Indicative — confirmed after free site survey. Valid 14 days.</div></div>
    <div className="grid grid-cols-2 gap-3 no-print"><Button className="rounded-none font-display uppercase h-12" onClick={doSave}>Save quote</Button><Button variant="outline" className="rounded-none font-display uppercase h-12" onClick={()=>window.print()}><Printer className="h-4 w-4 mr-2" /> Print / PDF</Button><Button variant="outline" className="rounded-none font-display uppercase h-12" asChild><a target="_blank" rel="noreferrer" href={businessWaLink(boqText())}>WhatsApp BOQ</a></Button><Button variant="outline" className="rounded-none font-display uppercase h-12" onClick={()=>{navigator.clipboard.writeText(boqText()); toast.success("Summary copied");}}><Copy className="h-4 w-4 mr-2" /> Copy</Button></div>
    <p className="font-tech text-[11px] text-muted-foreground no-print">Or call {getBusiness().phone} for a free on-site survey.</p>
   </div>
  </aside>
 </div></div>);
}
