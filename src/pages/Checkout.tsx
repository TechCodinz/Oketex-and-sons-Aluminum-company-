import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { formatNGN } from "@/lib/money";
import { PageHead } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { saveOrder, orderCode } from "@/lib/storage";
import { BUSINESS } from "@/contracts/constants";
import { getBusiness, businessWaLink } from "@/lib/settings";
export default function Checkout(){
 const { lines, totalNgn, clear } = useCart(); const navigate=useNavigate();
 const [f,setF]=useState({name:"",phone:"",email:"",address:"",note:""});
 const place=()=>{
  if(!lines.length) return toast.error("Cart is empty");
  if(f.name.length<2) return toast.error("Enter your full name");
  if(f.phone.length<7) return toast.error("Enter a valid phone number");
  if(f.address.length<5) return toast.error("Enter a delivery address");
  const code=orderCode();
  saveOrder({code,name:f.name,phone:f.phone,email:f.email,address:f.address,note:f.note,items:lines.map(l=>({name:l.name,unit:l.unit,unitPriceNgn:l.priceNgn,quantity:l.quantity,lineTotalNgn:l.priceNgn*l.quantity})),totalNgn,status:"pending",createdAt:new Date().toISOString()});
  const wa=`Hello ${BUSINESS.name}, my order ${code} totals ${formatNGN(totalNgn)} (${lines.map(l=>`${l.quantity}× ${l.name}`).join(", ")}). Name: ${f.name}, Address: ${f.address}. Please confirm.`;
  clear();
  navigate(`/track?code=${encodeURIComponent(code)}&wa=${encodeURIComponent(wa)}`);
 };
 return (<div><PageHead kicker="Checkout" title="Place your order" lead="Review your sheet and give us delivery details. Your order saves on this device with a trackable code." />
 <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 grid lg:grid-cols-[1fr_360px] gap-10">
 <div className="space-y-4">
  {[["name","Full name","Adaeze Okonkwo"],["phone","Phone / WhatsApp","0803 000 0000"],["email","Email (optional)",""],["address","Delivery address","Street, town, state"],["note","Note (optional)","Landmark, timeline…"]].map(([id,label,ph])=>(
   <div key={id}><label className="label-tech" htmlFor={`c-${id}`}>{label}</label>{id==="address"||id==="note"?<textarea id={`c-${id}`} className="field-tech" rows={id==="address"?2:1} placeholder={ph} value={(f as any)[id]} onChange={e=>setF({...f,[id]:e.target.value})} />:<input id={`c-${id}`} className="field-tech" placeholder={ph} value={(f as any)[id]} onChange={e=>setF({...f,[id]:e.target.value})} />}</div>))}
 </div>
 <aside className="border hairline bg-card h-fit p-6"><p className="label-tech mb-4">Order summary</p>{lines.map(l=>(<div key={l.productId} className="flex justify-between text-sm py-2 border-b hairline"><span>{l.quantity}× {l.name}</span><span className="font-tech">{formatNGN(l.priceNgn*l.quantity)}</span></div>))}<div className="flex justify-between mt-4"><span className="label-tech">Total</span><span className="font-display font-bold text-2xl text-primary">{formatNGN(totalNgn)}</span></div><Button className="w-full mt-6 rounded-none h-12 font-display uppercase" onClick={place}>Place order</Button><p className="font-tech text-[11px] text-muted-foreground mt-3">Orders save locally on this device. You can also send to WhatsApp.</p><a className="font-tech text-xs text-primary mt-2 inline-block" target="_blank" rel="noreferrer" href={businessWaLink(`Hello ${BUSINESS.name}, I want to place an order.`)}>WhatsApp {getBusiness().phone}</a></aside>
 </div></div>);
}
