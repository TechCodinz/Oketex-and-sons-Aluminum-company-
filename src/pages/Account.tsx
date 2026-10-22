import { Link } from "react-router";
import { PageHead, StatusBadge } from "@/components/StatusBadge";
import { formatNGN } from "@/lib/money";
import { getOrders, getQuotes } from "@/lib/storage";
import { getBookings } from "@/lib/proStorage";
export default function Account(){
 const orders=getOrders(); const quotes=getQuotes(); const bookings=getBookings();
 return (<div><PageHead kicker="My device" title="My orders, quotes & bookings" lead="Everything you saved on this device — no account needed in this standalone version." />
 <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 space-y-10">
  <section><h2 className="font-display font-bold uppercase text-2xl mb-4">Orders ({orders.length})</h2>{!orders.length?<p className="font-tech text-sm text-muted-foreground">No orders yet. <Link className="text-primary" to="/shop">Shop materials</Link></p>:<div className="border hairline">{orders.map((o,i)=>(<div key={o.code} className={`px-5 py-4 flex justify-between flex-wrap gap-3 ${i>0?"border-t hairline":""}`}><span className="font-tech font-semibold">{o.code}</span><span className="font-tech">{formatNGN(o.totalNgn)}</span><StatusBadge status={o.status} /></div>))}</div>}</section>
  <section><h2 className="font-display font-bold uppercase text-2xl mb-4">Quotes ({quotes.length})</h2>{!quotes.length?<p className="font-tech text-sm text-muted-foreground">No quotes yet. <Link className="text-primary" to="/quote">Get an estimate</Link></p>:<div className="border hairline">{quotes.map((q,i)=>(<div key={q.code} className={`px-5 py-4 flex justify-between flex-wrap gap-3 ${i>0?"border-t hairline":""}`}><span className="font-tech font-semibold">{q.code} · {q.roofType}</span><span className="font-tech">{formatNGN(q.estimateNgn)}</span><StatusBadge status={q.status} /></div>))}</div>}</section>
  <section><h2 className="font-display font-bold uppercase text-2xl mb-4">Bookings ({bookings.length})</h2>{!bookings.length?<p className="font-tech text-sm text-muted-foreground">No bookings yet. <Link className="text-primary" to="/book">Book a visit or crew</Link></p>:<div className="border hairline">{bookings.map((b,i)=>(<div key={b.code} className={`px-5 py-4 flex justify-between flex-wrap gap-3 ${i>0?"border-t hairline":""}`}><span className="font-tech font-semibold">{b.code} · {b.serviceLabel}</span><span className="font-tech">{b.date} · {b.slot}</span><StatusBadge status={b.status} /></div>))}</div>}</section>
 </div></div>);
}
