import { useState } from "react";
import { useSearchParams, Link } from "react-router";
import { PageHead, StatusBadge } from "@/components/StatusBadge";
import { formatNGN } from "@/lib/money";
import { findOrder, getOrders } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { WHATSAPP_LINK, BUSINESS } from "@/contracts/constants";
export default function Track(){
 const [params]=useSearchParams(); const [q,setQ]=useState(params.get("code")??"");
 const [results,setResults]=useState(()=>(params.get("code")?findOrder(params.get("code")!):[]));
 const wa=params.get("wa");
 const search=()=>setResults(findOrder(q));
 return (<div><PageHead kicker="Order tracking" title="Track your order" lead="Enter your order code (e.g. OKX-2026-XXXXX) or phone number." />
 <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
 {wa && <div className="border hairline bg-card p-5 mb-6"><p className="font-tech text-xs text-muted-foreground mb-3">Order placed — send it to the office on WhatsApp:</p><Button asChild className="rounded-none font-display uppercase"><a target="_blank" rel="noreferrer" href={WHATSAPP_LINK(wa)}>Send order on WhatsApp</a></Button><Link to="/track" className="font-tech text-xs text-muted-foreground ml-4" onClick={()=>{setResults(findOrder(q));}}>Refresh</Link></div>}
 <div className="flex gap-3"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} placeholder="OKX-2026-…" className="field-tech font-tech" aria-label="Order code or phone" /><Button onClick={search} className="rounded-none font-display uppercase shrink-0">Track</Button></div>
 {!results.length && <p className="font-tech text-sm text-muted-foreground mt-8">No orders found. Orders placed on this device appear here. {getOrders().length?`(${getOrders().length} saved on this device)`:""}</p>}
 {results.map(o=>(<div key={o.code} className="border hairline mt-8 bg-card"><div className="px-5 py-4 border-b hairline flex justify-between items-center flex-wrap gap-3"><div><p className="font-tech font-semibold">{o.code}</p><p className="font-tech text-[11px] text-muted-foreground">{new Date(o.createdAt).toLocaleString("en-NG")} · {o.name}</p></div><StatusBadge status={o.status} /></div><div className="px-5 py-4">{o.items.map((it,i)=>(<div key={i} className="flex justify-between text-sm py-2 border-b hairline last:border-0"><span>{it.quantity}× {it.name}</span><span className="font-tech">{formatNGN(it.lineTotalNgn)}</span></div>))}<div className="flex justify-between mt-4"><span className="label-tech">Total</span><span className="font-display font-bold text-2xl text-primary">{formatNGN(o.totalNgn)}</span></div><p className="font-tech text-[11px] text-muted-foreground mt-3">Deliver to: {o.address}</p></div></div>))}
 <p className="font-tech text-xs text-muted-foreground mt-8">Prefer to call? <a className="text-primary" href={`tel:${BUSINESS.phone.replace(/\s/g,"")}`}>{BUSINESS.phone}</a></p>
 </div></div>);
}
