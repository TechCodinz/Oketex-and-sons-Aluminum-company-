import { useState } from "react";
import { Link } from "react-router";
import { PageHead } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { products, categories } from "@/data/catalog";
import { formatNGN } from "@/lib/money";
import { BUSINESS } from "@/contracts/constants";
import { getBusiness, businessWaLink, getRates } from "@/lib/settings";
import { toast } from "sonner";
import {
  ASSISTANT_TRADES, TIER_FACTORS, computeAssistantRange, saveAssistantQuote, createVerifyRequest,
  parseDims, parseArea, parsePitch, isQuoteIntent, ASSISTANT_DISCLAIMER,
  type AssistantTrade, type TierId, type AssistantQuoteInput, type VerifyRequest,
} from "@/lib/assistantBrain";
import type { LocalQuote } from "@/lib/storage";
type Msg={role:"user"|"assistant";content:string};
function answer(qRaw:string):string{
 const q=qRaw.toLowerCase();
 const find=(...keys:string[])=>products.filter(p=>keys.some(k=> (p.name+" "+p.slug+" "+p.summary).toLowerCase().includes(k)));
 if(q.includes("leak")||q.includes("damage")||q.includes("send a photo")||q.includes("send photo")||q.includes("sell an item")||q.includes("i want to sell")||q.includes("sell my")||q.includes("broken roof")||q.includes("roof problem")||q.includes("snap & send")||q.includes("snap and send")) return `Use Snap & Send (/snap-send): snap a photo or short video of the leak, damage, thing you want built, or item you want to sell, describe it, and send it to us. We price the job openly (items + workmanship + transport + dispatch), you approve the price in Track (/track), and a trusted approved pro does the job with live photo updates. Selling? Add the item name, your asking price and its condition.`;
 if(q.includes("register")||q.includes("join")||q.includes("partner")||q.includes("marketplace")||q.includes("directory")||q.includes("seller")||q.includes("find a pro")||q.includes("find pros")) return `The Oketex Partner Network is in the Partners directory (/partners): approved pros (roofers, engineers, carpenters, tilers, plumbers and more) and materials sellers, each with a profile or storefront you can request work or supplies from. Pros & sellers register free at Join (/join) — Oketex approves every listing, sends you tracked leads and supply offers, and charges a flat referral commission only on work won through the network (current launch terms are shown on the Join page). Partners check their leads at Partner Status (/partner-status).`;
 if(q.includes("book")||q.includes("appointment")||q.includes("visit")||q.includes("schedule")) return `You can book online on the Book page (/book): Free Site Measurement, Roof Installation, Re-Roofing & Leak Repair, Windows & Doors Survey, Cladding & Facade Survey, General Building Consultation or Materials Delivery. Pick a date and a Morning 8–11, Midday 11–2 or Afternoon 2–5 slot — you get a booking code (BK-…) you can track, and you can confirm instantly on WhatsApp.`;
 if(q.includes("spreadsheet")||q.includes("take-off")||q.includes("takeoff")||q.includes("site sheet")||q.includes("worksheet")||q.includes("note")) return `Pros use the free Pro Workspace (/workspace): create a project, build a roof take-off spreadsheet — every section auto-priced by the same engine as the Pro Calculator — keep a building measurement sheet and site notes, then download a CSV, print the sheet, or send a WhatsApp summary.`;
 if(q.includes("materials list")||q.includes("list of materials")||q.includes("estimate my project")||q.includes("project estimator")||q.includes("herringbone")||q.includes("wardrobe")||q.includes("bathroom")||q.includes("what do i need")||q.includes("style")) return `Use the Project Estimator (/estimator): pick your trade (roofing, tiling, woodwork, plumbing, interior room, windows & doors, or exterior cladding), choose a style — herringbone tiling, a shaker wardrobe, a luxury bathroom and more — add a photo and your real dimensions, and it lists ALL the materials, fixings, consumables and labour the job needs, with catalog prices where we sell it. Tick items off as you buy, save it, turn it into a Workspace project, or book a pro from the result.`;
 if(q.includes("foundation")||q.includes("block")||q.includes("paint")||q.includes("plumb")||q.includes("electric")||q.includes("solar")||q.includes("tiling")||q.includes("ceiling")||q.includes("pop")||q.includes("stage")||q.includes("section")||q.includes("a-z")||q.includes("whole building")) return `See Build A–Z (/build) — all 14 sections of a building from Foundation & Earthworks to Gutters, Drainage & External Works: what each stage involves, key materials, typical durations and pro tips. Oketex supplies roofing, windows & doors, ACP cladding and gutters directly (with Shop links); the other sections are partner trades you can book a General Building Consultation for.`;
 if(q.includes("longspan")&&(q.includes("price")||q.includes("cost")||q.includes("how much"))){ const ps=find("longspan"); return ps.map(p=>`${p.name}: ${formatNGN(p.priceNgn)} ${p.unit}.`).join(" ") + " Use the Pro Calculator for a full BOQ with pitch and waste."; }
 if(q.includes("stone")||q.includes("tile")){ const p=products.find(x=>x.slug.includes("stone-coated"))!; return `${p.name} is ${formatNGN(p.priceNgn)} ${p.unit} (covers 0.48m², so ~${Math.ceil(1/0.48)} tiles per m² before waste). Warranty: ${p.specs.Warranty}.`; }
 if(q.includes("deliver")||q.includes("delivery")||q.includes("transport")) { const z=getRates().deliveryZones; return `We deliver nationwide. In the Pro Calculator: Ogun/Lagos ${formatNGN(z["ogun-lagos"])}, South-West ${formatNGN(z["south-west"])}, South-South/South-East ${formatNGN(z["ss-se"])}, Abuja/North ${formatNGN(z["abuja-north"])}, pickup from Ibafo is free. Call ${getBusiness().phone} to confirm timing.`; }
 if(q.includes("gauge")||q.includes("0.45")||q.includes("0.55")||q.includes("thickness")) return `0.45mm suits most homes. 0.55mm (${formatNGN(11500)}/m) is stiffer for wide purlin spacing, churches, halls and high-wind/coastal areas. 0.50mm Metcoppo is ${formatNGN(12800)}/m. All our coil is gauge-verified at the plant.`;
 if(q.includes("measure")||q.includes("how to measure")||q.includes("size")) return `Measure building length × width, add eaves overhang (usually 0.6m each side), and note the pitch. Or use Snap-Measure: photograph the house, calibrate with a 2.1m door, and draw the roof lines. We also offer a FREE site survey in Ogun & Lagos — call ${getBusiness().phone}.`;
 if(q.includes("warrant")) return `Stone-coated tiles carry a 50-year warranty class. ACP has a 15-year colour warranty. Installation workmanship is warranted — ask on your quote for the exact terms for your profile.`;
 if(q.includes("window")||q.includes("door")){ const ps=find("window","door","sliding","casement"); return ps.map(p=>`${p.name}: ${formatNGN(p.priceNgn)} ${p.unit}.`).join(" ") + " Try the Window & Door Pricer in Tools for made-to-measure estimates."; }
 if(q.includes("gutter")){ const p=products.find(x=>x.slug.includes("gutter"))!; return `${p.name}: ${formatNGN(p.priceNgn)} ${p.unit}, colour-matched, formed on site. The Rainwater Sizer in Tools recommends gutter/downpipe sizes.`; }
 if(q.includes("colour")||q.includes("color")) return `14 baked-on colours including Charcoal, Brick Red, Forest Green, Ocean Blue, Terracotta, Ivory, Chocolate, Wine and Navy. Open the Visualizer Studio to see them on a house in real time.`;
 if(q.includes("pay")||q.includes("order")) return `Browse the Shop, add to your order sheet and checkout — your order saves with a code (OKX-…) you can track and send to us on WhatsApp (${getBusiness().phone}). Payment terms are confirmed by the office when they confirm stock and delivery.`;
 if(q.includes("price")||q.includes("cost")||q.includes("catalog")||q.includes("list")){ return categories.map(c=>{ const ps=products.filter(p=>p.categoryId===c.id); return `${c.name}: `+ps.map(p=>`${p.name} ${formatNGN(p.priceNgn)} ${p.unit}`).join("; "); }).join("\n"); }
 if(q.includes("hello")||q.includes("hi")) return `Hello! Ask me about longspan prices, stone-coated tiles, gauges, delivery, measuring, colours or windows — or tap a quick prompt below.`;
 return `I can help with catalog prices, gauges, delivery zones, measuring, colours and warranties — all from our live catalog, no invented prices. Try: "Longspan price?", "How do I measure my roof?" or "Delivery to Abuja?" For a full price, use the Pro Roof Calculator. Or call/WhatsApp ${getBusiness().phone}.`;
}
const CHIPS=["Longspan price?","Stone-coated tiles?","Which gauge should I choose?","How do I measure my roof?","Materials list for my project?","Book a site measurement","Building sections A–Z?","Pro spreadsheet?","Join as a pro/seller?","Delivery to Abuja?","Window prices?","What colours are available?"];

/* ---------- Guided "Write my quotation" flow (Deliverable D) ---------- */
type Flow =
  | { step: "trade" }
  | { step: "measure"; trade: AssistantTrade }
  | { step: "pitch"; trade: AssistantTrade; length: number; width: number }
  | { step: "rstyle"; trade: AssistantTrade; length: number; width: number; pitch: number }
  | { step: "tier"; data: Omit<AssistantQuoteInput, "tier"> }
  | { step: "done"; quote: LocalQuote }
  | { step: "verify"; quote: LocalQuote }
  | { step: "verified"; vr: VerifyRequest };
const TIER_LABEL: Record<TierId, string> = { basic: "Basic", standard: "Standard", premium: "Premium" };

export default function Assistant(){
 const [msgs,setMsgs]=useState<Msg[]>([{role:"assistant",content:`Welcome to ${BUSINESS.name}. I work offline from the real catalog — ask me anything below, or tap "Write my quotation" and I will build you a priced estimate step by step.`}]);
 const [input,setInput]=useState("");
 const [flow,setFlow]=useState<Flow|null>(null);
 const [vf,setVf]=useState({name:"",phone:"",address:"",date:""});
 const say=(content:string)=>setMsgs(m=>[...m,{role:"assistant",content}]);
 const userSay=(content:string)=>setMsgs(m=>[...m,{role:"user",content}]);

 const startFlow=()=>{ setFlow({step:"trade"}); say("Let's write your quotation. First — what kind of work is it? Tap a trade below."); };
 const pickTrade=(t:AssistantTrade)=>{
   userSay(ASSISTANT_TRADES.find(x=>x.id===t)?.label??t);
   if(t==="other"){ setFlow(null); say("That one needs eyes on the job before anyone can price it honestly — I won't invent a number. Book a General Building Consultation on the Book page (/book) and a pro will measure, then quote you properly. Or pick Roofing, Tiling, Painting, ACP or Gutters and I'll price it here."); return; }
   setFlow({step:"measure",trade:t});
   if(t==="roofing") say("Send the roof's length × width in metres — for example \"12 by 8\" or \"12x8\". Measure the building footprint; I add the standard 0.6m eaves overhang.");
   else if(t==="gutters") say("Send the total gutter length in metres (add up all the eaves runs) — for example \"36\".");
   else say(`Send the ${t==="tiling"?"floor":"wall"} area in square metres — for example \"45\" or \"45 m2\".`);
 };
 const finishWithTier=async(data:Omit<AssistantQuoteInput,"tier">,tier:TierId)=>{
   const inp:AssistantQuoteInput={...data,tier};
   const res=computeAssistantRange(inp);
   if(!res){ setFlow(null); say("I couldn't price that from the measurements given — a pro check is the honest next step. Book a free site measurement on /book."); return; }
   const quote=await saveAssistantQuote(inp,res,{});
   const tradeLabel=ASSISTANT_TRADES.find(t=>t.id===inp.trade)?.label??inp.trade;
   say(`YOUR ASSISTANT QUOTATION — ${quote.code}\nTrade: ${tradeLabel} · ${TIER_LABEL[tier]} tier\n${res.lines.map(l=>"• "+l).join("\n")}\n\nESTIMATE RANGE: ${formatNGN(res.low)} – ${formatNGN(res.high)}\n${res.assumptions.map(a=>"Assumption: "+a).join("\n")}\n\n${ASSISTANT_DISCLAIMER}\nSaved as ${quote.code} with status Unverified. Use the buttons below to print it, send it on WhatsApp, or request a pro check — a pro verifies the measurements on site and confirms the final price.`);
   setFlow({step:"done",quote});
 };
 const flowText=(text:string)=>{
   if(!flow) return;
   if(flow.step==="measure"){
     userSay(text);
     if(flow.trade==="roofing"){ const d=parseDims(text); if(!d){ say("I couldn't read two dimensions there. Try \"12 by 8\" or \"12x8\" (metres)."); return; } setFlow({step:"pitch",trade:flow.trade,length:d.l,width:d.w}); say(`Got it — ${d.l}m × ${d.w}m. What is the roof pitch? Tap one, or type it like \"30 degrees\".`); return; }
     const a=parseArea(text); if(!a){ say("I need one number — the area in square metres (or metres of gutter for gutters). For example \"45\"."); return; }
     if(flow.trade==="gutters"){ setFlow({step:"tier",data:{trade:"gutters",gutterMetres:a}}); say(`${a} metres of guttering. Last step — pick a quality tier.`); return; }
     setFlow({step:"tier",data:{trade:flow.trade,areaM2:a}}); say(`${a} m² noted. Last step — pick a quality tier.`); return;
   }
   if(flow.step==="pitch"){
     const p=parsePitch(text)??(parseFloat(text)||null);
     userSay(text);
     if(!p){ say("Tap a pitch below, or type it like \"30 degrees\". 25–30° is typical for Nigerian homes."); return; }
     setFlow({step:"rstyle",trade:flow.trade,length:flow.length,width:flow.width,pitch:p}); say(`Pitch ${p}°. Gable roof (two slopes) or hip roof (slopes all round)?`); return;
   }
   say("Use the buttons below to continue — or tap Cancel to exit the quotation flow.");
 };
 const send=(text:string)=>{ const t=text.trim(); if(!t) return; setInput("");
   if(flow){ flowText(t); return; }
   if(isQuoteIntent(t)){ userSay(t); startFlow(); return; }
   setMsgs(m=>[...m,{role:"user",content:t},{role:"assistant",content:answer(t)}]);
 };
 const submitVerify=async(quote:LocalQuote)=>{
   if(!vf.name.trim()||!vf.phone.trim()||!vf.address.trim()){ toast.error("Name, phone and site address are needed for the pro check."); return; }
   const vr=await createVerifyRequest({quoteCode:quote.code,name:vf.name.trim(),phone:vf.phone.trim(),address:vf.address.trim(),preferredDate:vf.date});
   say(`PRO CHECK REQUESTED — ${vr.code}${vr.priority?" (PRIORITY — Pro plan)":""}\nA pro will visit to verify the measurements behind ${quote.code}. Your request also created a site booking, and the office can see it in the admin Verification Requests list.\nTrack it any time on the Track page (/track) with code ${vr.code} or your phone number.`);
   setFlow({step:"verified",vr});
 };
 const quoteWa=(quote:LocalQuote)=>businessWaLink(`Hello ${getBusiness().name}, here is my assistant quotation ${quote.code} (${quote.roofType}). Estimate range: ${quote.rangeLow?formatNGN(quote.rangeLow):""} – ${quote.rangeHigh?formatNGN(quote.rangeHigh):""}. ${ASSISTANT_DISCLAIMER} Please confirm the next step.`);
 return (<div><PageHead kicker="Advisor — Offline, Catalog-True" title="Ask Oketex" lead="Rule-based advisor using only real catalog prices. It never invents a price — and it can now write you a step-by-step quotation." />
 <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
 <div className="flex flex-wrap gap-2 mb-6 no-print"><button onClick={startFlow} className="px-3 py-2 font-tech text-xs border border-primary text-primary hover:bg-primary hover:text-primary-foreground cursor-pointer">✎ Write my quotation</button>{CHIPS.map(c=>(<button key={c} onClick={()=>send(c)} className="px-3 py-2 font-tech text-xs border hairline hover:border-primary hover:text-primary cursor-pointer">{c}</button>))}</div>
 <div className="border hairline bg-card divide-y divide-white/10 print-boq">{msgs.map((m,i)=>(<div key={i} className={`px-5 py-4 ${m.role==="user"?"bg-primary/10 text-right":""}`}><p className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{m.role}</p><p className="text-sm whitespace-pre-line text-left">{m.content}</p></div>))}</div>

 {flow?.step==="trade" && (<div className="flex flex-wrap gap-2 mt-4 no-print">{ASSISTANT_TRADES.map(t=>(<button key={t.id} onClick={()=>pickTrade(t.id)} className="px-4 py-2.5 font-tech text-xs border hairline hover:border-primary hover:text-primary cursor-pointer">{t.label}</button>))}<button onClick={()=>setFlow(null)} className="px-4 py-2.5 font-tech text-xs text-muted-foreground cursor-pointer">Cancel</button></div>)}
 {flow?.step==="pitch" && (<div className="flex flex-wrap gap-2 mt-4 no-print">{[15,20,25,30,35].map(p=>(<button key={p} onClick={()=>{ userSay(`${p} degrees`); setFlow({step:"rstyle",trade:flow.trade,length:flow.length,width:flow.width,pitch:p}); say(`Pitch ${p}°. Gable roof (two slopes) or hip roof (slopes all round)?`); }} className="px-4 py-2.5 font-tech text-xs border hairline hover:border-primary hover:text-primary cursor-pointer">{p}°</button>))}<button onClick={()=>setFlow(null)} className="px-4 py-2.5 font-tech text-xs text-muted-foreground cursor-pointer">Cancel</button></div>)}
 {flow?.step==="rstyle" && (<div className="flex flex-wrap gap-2 mt-4 no-print">{([["gable","Gable"],["hip","Hip"]] as const).map(([v,l])=>(<button key={v} onClick={()=>{ userSay(l); setFlow({step:"tier",data:{trade:flow.trade,length:flow.length,width:flow.width,pitch:flow.pitch,roofStyle:v}}); say("Last step — pick a quality tier. Basic is an economy spec of the same measured job, Premium a heavier spec; the range already includes site unknowns."); }} className="px-4 py-2.5 font-tech text-xs border hairline hover:border-primary hover:text-primary cursor-pointer">{l}</button>))}<button onClick={()=>setFlow(null)} className="px-4 py-2.5 font-tech text-xs text-muted-foreground cursor-pointer">Cancel</button></div>)}
 {flow?.step==="tier" && (<div className="flex flex-wrap gap-2 mt-4 no-print">{(Object.keys(TIER_FACTORS) as TierId[]).map(t=>(<button key={t} onClick={()=>{ userSay(TIER_LABEL[t]); void finishWithTier(flow.data,t); }} className="px-4 py-2.5 font-tech text-xs border hairline hover:border-primary hover:text-primary cursor-pointer">{TIER_LABEL[t]}</button>))}<button onClick={()=>setFlow(null)} className="px-4 py-2.5 font-tech text-xs text-muted-foreground cursor-pointer">Cancel</button></div>)}
 {flow?.step==="done" && (<div className="flex flex-wrap gap-3 mt-4 no-print">
   <Button variant="outline" className="rounded-none font-display uppercase" onClick={()=>window.print()}>Print quotation</Button>
   <Button variant="outline" className="rounded-none font-display uppercase" asChild><a target="_blank" rel="noreferrer" href={quoteWa(flow.quote)}>Send on WhatsApp</a></Button>
   <Button className="rounded-none font-display uppercase" onClick={()=>setFlow({step:"verify",quote:flow.quote})}>Request a pro check</Button>
   <button onClick={startFlow} className="px-3 py-2 font-tech text-xs text-muted-foreground cursor-pointer">Write another</button></div>)}
 {flow?.step==="verify" && (<div className="border hairline bg-card p-5 mt-4 no-print">
   <p className="font-display font-semibold uppercase">Request a pro check — {flow.quote.code}</p>
   <p className="font-tech text-[11px] text-muted-foreground mt-1">A pro visits, verifies the measurements, and confirms the final price. Pro-plan customers are flagged priority.</p>
   <div className="grid sm:grid-cols-2 gap-3 mt-4">
     <input value={vf.name} onChange={e=>setVf({...vf,name:e.target.value})} placeholder="Your name" className="field-tech font-tech" aria-label="Your name" />
     <input value={vf.phone} onChange={e=>setVf({...vf,phone:e.target.value})} placeholder="Phone / WhatsApp" className="field-tech font-tech" aria-label="Phone" />
     <input value={vf.address} onChange={e=>setVf({...vf,address:e.target.value})} placeholder="Site address / LGA" className="field-tech font-tech" aria-label="Site address" />
     <input type="date" value={vf.date} onChange={e=>setVf({...vf,date:e.target.value})} className="field-tech font-tech" aria-label="Preferred date" />
   </div>
   <div className="flex gap-3 mt-4"><Button className="rounded-none font-display uppercase" onClick={()=>void submitVerify(flow.quote)}>Book the pro check</Button><button onClick={()=>setFlow({step:"done",quote:flow.quote})} className="px-3 py-2 font-tech text-xs text-muted-foreground cursor-pointer">Back</button></div></div>)}
 {flow?.step==="verified" && (<div className="flex flex-wrap gap-3 mt-4 no-print"><Button variant="outline" className="rounded-none font-display uppercase" asChild><Link to={`/track?code=${flow.vr.code}`}>Track {flow.vr.code}</Link></Button><button onClick={startFlow} className="px-3 py-2 font-tech text-xs text-muted-foreground cursor-pointer">Write another quotation</button></div>)}

 <div className="flex gap-3 mt-4 no-print"><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send(input)} placeholder={flow?"Type your answer…" :"Ask about prices, gauges, delivery…"} className="field-tech" aria-label="Ask a question" /><Button onClick={()=>send(input)} className="rounded-none font-display uppercase shrink-0">Ask</Button></div></div></div>);
}
