import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { formatNGN } from "@/lib/money";
import { PageHead } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { saveOrderAsync, orderCode } from "@/lib/storage";
import { paymentsApi } from "@/lib/api";
import { CreditCard } from "lucide-react";
import { BUSINESS } from "@/contracts/constants";
import { getBusiness, businessWaLink, getAppliedCouponCode, setAppliedCouponCode, validateCoupon, getRates, getDeliveryZoneId, setDeliveryZoneId, dispatchFor, orderGrandTotal } from "@/lib/settings";
import { DELIVERY_ZONES } from "@/lib/roofEngine";
import { notify } from "@/lib/notify";
export default function Checkout(){
 const { lines, totalNgn, clear } = useCart(); const navigate=useNavigate();
 const [f,setF]=useState({name:"",phone:"",email:"",address:"",note:""});
 const [placing,setPlacing]=useState(false);
 const [couponInput,setCouponInput]=useState(()=>getAppliedCouponCode());
 const [appliedCode,setAppliedCode]=useState(()=>getAppliedCouponCode());
 const check=appliedCode?validateCoupon(appliedCode,totalNgn):null;
 const discountNgn=check?.ok?check.discountNgn:0;
 const finalTotal=Math.max(0,totalNgn-discountNgn);
 // Delivery method + dispatch & handling (Snap & Send): zone choice is
 // persisted and shared with the cart drawer. Pickup stays free and never
 // pays dispatch; a paid zone adds its delivery fee plus the flat dispatch
 // fee when Admin has switched it on (rates.dispatchFeeNgn > 0).
 const rates=getRates();
 const [zoneId,setZoneId]=useState(()=>getDeliveryZoneId());
 const deliveryNgn=rates.deliveryZones[zoneId]??0;
 const dispatchNgn=dispatchFor(rates.dispatchFeeNgn,zoneId);
 const grandTotal=orderGrandTotal(finalTotal,deliveryNgn,rates.dispatchFeeNgn,zoneId);
 const zoneLabel=(id:string)=>DELIVERY_ZONES.find(z=>z.id===id)?.label||id;
 const applyCoupon=()=>{ const r=validateCoupon(couponInput,totalNgn); if(!r.ok) return toast.error(r.error); setAppliedCouponCode(r.coupon.code); setAppliedCode(r.coupon.code); toast.success(`Coupon ${r.coupon.code} applied — ${formatNGN(r.discountNgn)} off`); };
 const place=async(payNow=false)=>{
  if(!lines.length) return toast.error("Cart is empty");
  if(f.name.length<2) return toast.error("Enter your full name");
  if(f.phone.length<7) return toast.error("Enter a valid phone number");
  if(f.address.length<5) return toast.error("Enter a delivery address");
  if(payNow && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return toast.error("Add a valid email — Paystack sends your receipt there.");
  setPlacing(true);
  const code=orderCode();
  const items=lines.map(l=>({name:l.name,unit:l.unit,unitPriceNgn:l.priceNgn,quantity:l.quantity,lineTotalNgn:l.priceNgn*l.quantity}));
  const wa=`Hello ${BUSINESS.name}, my order ${code} totals ${formatNGN(grandTotal)} (${lines.map(l=>`${l.quantity}× ${l.name}`).join(", ")})${discountNgn>0&&check?.ok?` — includes coupon ${check.coupon.code} discount of ${formatNGN(discountNgn)} on a ${formatNGN(totalNgn)} subtotal`:""}${deliveryNgn>0?` — includes delivery (${zoneLabel(zoneId)}) ${formatNGN(deliveryNgn)}`:" — pickup from Ibafo"}${dispatchNgn>0?` and dispatch & handling ${formatNGN(dispatchNgn)}`:""}. Name: ${f.name}, Address: ${f.address}. Please confirm.`;
  await saveOrderAsync({code,name:f.name,phone:f.phone,email:f.email,address:f.address,note:f.note,items,totalNgn:grandTotal,...(discountNgn>0&&check?.ok?{subtotalNgn:totalNgn,couponCode:check.coupon.code,discountNgn}:{}),deliveryZoneId:zoneId,deliveryNgn,...(dispatchNgn>0?{dispatchNgn}:{}),status:"pending",createdAt:new Date().toISOString()});
  notify({templateKey:"order_placed",audience:"admin",refCode:code,vars:{name:f.name,phone:f.phone,amount:formatNGN(grandTotal)}});
  if(discountNgn>0) setAppliedCouponCode("");
  if(payNow){
    // Paystack — only redirects when the server confirms payments are enabled.
    const init=await paymentsApi.initialize({email:f.email.trim(),amountNgn:grandTotal,purpose:"order",refId:code});
    if(init.enabled && init.authorizationUrl){ clear(); window.location.href=init.authorizationUrl; return; }
    setPlacing(false);
    toast.message(init.enabled ? "Payment could not start — order saved; pay on WhatsApp instead." : "Online payment isn't enabled yet — order saved; complete it on WhatsApp.");
  }
  clear();
  navigate(`/track?code=${encodeURIComponent(code)}&wa=${encodeURIComponent(wa)}`);
 };
 return (<div><PageHead kicker="Checkout" title="Place your order" lead="Review your sheet and give us delivery details. Your order saves with a trackable code — on this device in demo mode, in our system when the backend is live." />
 <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 grid lg:grid-cols-[1fr_360px] gap-10">
 <div className="space-y-4">
  {[["name","Full name","Adaeze Okonkwo"],["phone","Phone / WhatsApp","0803 000 0000"],["email","Email (for receipts)",""],["address","Delivery address","Street, town, state"],["note","Note (optional)","Landmark, timeline…"]].map(([id,label,ph])=>(
   <div key={id}><label className="label-tech" htmlFor={`c-${id}`}>{label}</label>{id==="address"||id==="note"?<textarea id={`c-${id}`} className="field-tech" rows={id==="address"?2:1} placeholder={ph} value={(f as any)[id]} onChange={e=>setF({...f,[id]:e.target.value})} />:<input id={`c-${id}`} className="field-tech" placeholder={ph} value={(f as any)[id]} onChange={e=>setF({...f,[id]:e.target.value})} />}</div>))}
  <div><label className="label-tech" htmlFor="c-zone">Delivery method</label><select id="c-zone" value={zoneId} onChange={e=>{setZoneId(e.target.value);setDeliveryZoneId(e.target.value);}} className="field-tech cursor-pointer">{DELIVERY_ZONES.map(z=>(<option key={z.id} value={z.id}>{z.id==="pickup"?"Pickup from Ibafo — Free":`${z.label} — ${formatNGN(rates.deliveryZones[z.id]??z.price)}`}</option>))}</select><p className="font-tech text-[11px] text-muted-foreground mt-1.5">Zone delivery is priced openly here — no surprise charges later.{dispatchNgn>0?` A flat dispatch & handling fee of ${formatNGN(dispatchNgn)} applies to delivered orders.`:""}</p></div>
 </div>
 <aside className="border hairline bg-card h-fit p-6"><p className="label-tech mb-4">Order summary</p>{lines.map(l=>(<div key={l.productId} className="flex justify-between text-sm py-2 border-b hairline"><span>{l.quantity}× {l.name}</span><span className="font-tech">{formatNGN(l.priceNgn*l.quantity)}</span></div>))}
 <div className="mt-4">
  {appliedCode && check?.ok ? (<div className="flex items-center justify-between border border-primary/50 bg-primary/10 px-3 py-2"><span className="font-tech text-xs">{check.coupon.code} — {formatNGN(discountNgn)} off</span><button onClick={()=>{setAppliedCouponCode("");setAppliedCode("");setCouponInput("");}} className="font-tech text-[11px] text-muted-foreground hover:text-destructive cursor-pointer">Remove</button></div>)
  : (<div className="flex gap-2"><input value={couponInput} onChange={e=>setCouponInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&applyCoupon()} placeholder="COUPON CODE" className="field-tech font-tech text-xs" aria-label="Coupon code" /><Button variant="outline" className="rounded-none font-display uppercase text-xs shrink-0" onClick={applyCoupon}>Apply</Button></div>)}
  {appliedCode && check && !check.ok && <p className="font-tech text-[11px] text-amber-400 mt-2">{check.error}</p>}
 </div>
 {discountNgn>0 && (<><div className="flex justify-between mt-4 font-tech text-xs text-muted-foreground"><span>Subtotal</span><span>{formatNGN(totalNgn)}</span></div><div className="flex justify-between font-tech text-xs text-emerald-400 mt-1"><span>Coupon discount</span><span>−{formatNGN(discountNgn)}</span></div></>)}
 <div className="flex justify-between mt-4 font-tech text-xs text-muted-foreground"><span>Delivery ({zoneId==="pickup"?"Pickup — Ibafo":zoneLabel(zoneId)})</span><span>{deliveryNgn>0?formatNGN(deliveryNgn):"Free"}</span></div>
 {dispatchNgn>0 && (<div className="flex justify-between font-tech text-xs text-muted-foreground mt-1"><span>Dispatch &amp; handling</span><span>{formatNGN(dispatchNgn)}</span></div>)}
 <div className="flex justify-between mt-4"><span className="label-tech">Total</span><span className="font-display font-bold text-2xl text-primary">{formatNGN(grandTotal)}</span></div><Button className="w-full mt-6 rounded-none h-12 font-display uppercase" disabled={placing} onClick={()=>void place(false)}>Place order</Button><Button variant="outline" className="w-full mt-2 rounded-none h-11 font-display uppercase" disabled={placing} onClick={()=>void place(true)}><CreditCard className="h-4 w-4 mr-2" /> Pay now with Paystack</Button><p className="font-tech text-[11px] text-muted-foreground mt-3">Card payment opens Paystack's secure checkout when online payments are enabled; otherwise the order is saved and you pay on WhatsApp as usual.</p><a className="font-tech text-xs text-primary mt-2 inline-block" target="_blank" rel="noreferrer" href={businessWaLink(`Hello ${BUSINESS.name}, I want to place an order.`)}>WhatsApp {getBusiness().phone}</a></aside>
 </div></div>);
}
