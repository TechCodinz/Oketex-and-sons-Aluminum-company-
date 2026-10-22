import { useState } from "react";
import { PageHead } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { products, categories } from "@/data/catalog";
import { formatNGN } from "@/lib/money";
import { BUSINESS } from "@/contracts/constants";
type Msg={role:"user"|"assistant";content:string};
function answer(qRaw:string):string{
 const q=qRaw.toLowerCase();
 const find=(...keys:string[])=>products.filter(p=>keys.some(k=> (p.name+" "+p.slug+" "+p.summary).toLowerCase().includes(k)));
 if(q.includes("longspan")&&(q.includes("price")||q.includes("cost")||q.includes("how much"))){ const ps=find("longspan"); return ps.map(p=>`${p.name}: ${formatNGN(p.priceNgn)} ${p.unit}.`).join(" ") + " Use the Pro Calculator for a full BOQ with pitch and waste."; }
 if(q.includes("stone")||q.includes("tile")){ const p=products.find(x=>x.slug.includes("stone-coated"))!; return `${p.name} is ${formatNGN(p.priceNgn)} ${p.unit} (covers 0.48m², so ~${Math.ceil(1/0.48)} tiles per m² before waste). Warranty: ${p.specs.Warranty}.`; }
 if(q.includes("deliver")||q.includes("delivery")||q.includes("transport")) return `We deliver nationwide. In the Pro Calculator: Ogun/Lagos ₦45,000, South-West ₦85,000, South-South/South-East ₦145,000, Abuja/North ₦185,000, pickup from Ibafo is free. Call ${BUSINESS.phone} to confirm timing.`;
 if(q.includes("gauge")||q.includes("0.45")||q.includes("0.55")||q.includes("thickness")) return `0.45mm suits most homes. 0.55mm (${formatNGN(11500)}/m) is stiffer for wide purlin spacing, churches, halls and high-wind/coastal areas. 0.50mm Metcoppo is ${formatNGN(12800)}/m. All our coil is gauge-verified at the plant.`;
 if(q.includes("measure")||q.includes("how to measure")||q.includes("size")) return `Measure building length × width, add eaves overhang (usually 0.6m each side), and note the pitch. Or use Snap-Measure: photograph the house, calibrate with a 2.1m door, and draw the roof lines. We also offer a FREE site survey in Ogun & Lagos — call ${BUSINESS.phone}.`;
 if(q.includes("warrant")) return `Stone-coated tiles carry a 50-year warranty class. ACP has a 15-year colour warranty. Installation workmanship is warranted — ask on your quote for the exact terms for your profile.`;
 if(q.includes("window")||q.includes("door")){ const ps=find("window","door","sliding","casement"); return ps.map(p=>`${p.name}: ${formatNGN(p.priceNgn)} ${p.unit}.`).join(" ") + " Try the Window & Door Pricer in Tools for made-to-measure estimates."; }
 if(q.includes("gutter")){ const p=products.find(x=>x.slug.includes("gutter"))!; return `${p.name}: ${formatNGN(p.priceNgn)} ${p.unit}, colour-matched, formed on site. The Rainwater Sizer in Tools recommends gutter/downpipe sizes.`; }
 if(q.includes("colour")||q.includes("color")) return `14 baked-on colours including Charcoal, Brick Red, Forest Green, Ocean Blue, Terracotta, Ivory, Chocolate, Wine and Navy. Open the Visualizer Studio to see them on a house in real time.`;
 if(q.includes("pay")||q.includes("order")) return `Browse the Shop, add to your order sheet and checkout — your order saves with a code (OKX-…) you can track and send to us on WhatsApp (${BUSINESS.phone}). Payment terms are confirmed by the office when they confirm stock and delivery.`;
 if(q.includes("price")||q.includes("cost")||q.includes("catalog")||q.includes("list")){ return categories.map(c=>{ const ps=products.filter(p=>p.categoryId===c.id); return `${c.name}: `+ps.map(p=>`${p.name} ${formatNGN(p.priceNgn)} ${p.unit}`).join("; "); }).join("\n"); }
 if(q.includes("hello")||q.includes("hi")) return `Hello! Ask me about longspan prices, stone-coated tiles, gauges, delivery, measuring, colours or windows — or tap a quick prompt below.`;
 return `I can help with catalog prices, gauges, delivery zones, measuring, colours and warranties — all from our live catalog, no invented prices. Try: "Longspan price?", "How do I measure my roof?" or "Delivery to Abuja?" For a full price, use the Pro Roof Calculator. Or call/WhatsApp ${BUSINESS.phone}.`;
}
const CHIPS=["Longspan price?","Stone-coated tiles?","Which gauge should I choose?","How do I measure my roof?","Delivery to Abuja?","Window prices?","What colours are available?"];
export default function Assistant(){
 const [msgs,setMsgs]=useState<Msg[]>([{role:"assistant",content:`Welcome to ${BUSINESS.name}. I work offline from the real catalog — ask me anything below.`}]);
 const [input,setInput]=useState("");
 const send=(text:string)=>{ const t=text.trim(); if(!t) return; setMsgs(m=>[...m,{role:"user",content:t},{role:"assistant",content:answer(t)}]); setInput(""); };
 return (<div><PageHead kicker="Advisor — Offline, Catalog-True" title="Ask Oketex" lead="Rule-based advisor using only real catalog prices. It never invents a price." />
 <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10"><div className="flex flex-wrap gap-2 mb-6">{CHIPS.map(c=>(<button key={c} onClick={()=>send(c)} className="px-3 py-2 font-tech text-xs border hairline hover:border-primary hover:text-primary cursor-pointer">{c}</button>))}</div>
 <div className="border hairline bg-card divide-y divide-white/10">{msgs.map((m,i)=>(<div key={i} className={`px-5 py-4 ${m.role==="user"?"bg-primary/10 text-right":""}`}><p className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{m.role}</p><p className="text-sm whitespace-pre-line text-left">{m.content}</p></div>))}</div>
 <div className="flex gap-3 mt-4"><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send(input)} placeholder="Ask about prices, gauges, delivery…" className="field-tech" aria-label="Ask a question" /><Button onClick={()=>send(input)} className="rounded-none font-display uppercase shrink-0">Ask</Button></div></div></div>);
}
