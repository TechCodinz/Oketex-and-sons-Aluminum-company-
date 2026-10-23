import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { LogOut, UserRound } from "lucide-react";
import { PageHead, StatusBadge } from "@/components/StatusBadge";
import { formatNGN } from "@/lib/money";
import { getOrders, getQuotes, findOrdersAsync, type LocalOrder, type LocalQuote } from "@/lib/storage";
import { getBookings, findBookingsAsync, type LocalBooking } from "@/lib/proStorage";
import { useApiLive } from "@/lib/api";
import { useAuthUser, login, register, logout } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function Account(){
 const live = useApiLive();
 const user = useAuthUser();
 const [orders, setOrders] = useState<LocalOrder[]>(() => getOrders());
 const [quotes] = useState<LocalQuote[]>(() => getQuotes());
 const [bookings, setBookings] = useState<LocalBooking[]>(() => getBookings());
 const [mode, setMode] = useState<"login" | "register">("login");
 const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
 const [busy, setBusy] = useState(false);

 // When signed in, pull this phone's server records and merge with local.
 useEffect(() => {
   let on = true;
   if (user?.phone) {
     findOrdersAsync(user.phone).then(list => { if (on) setOrders(list); });
     findBookingsAsync(user.phone).then(list => { if (on) setBookings(list); });
   }
   return () => { on = false; };
 }, [user]);

 const submit = async () => {
   setBusy(true);
   try {
     if (mode === "login") { await login(form.email.trim(), form.password); toast.success("Welcome back"); }
     else { await register({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password }); toast.success("Account created — you're signed in"); }
   } catch (e: any) { toast.error(String(e?.message || "Could not sign in")); }
   setBusy(false);
 };

 return (<div><PageHead kicker={live ? "My account" : "My device"} title={user ? `Hello, ${user.name.split(" ")[0]}` : "My orders, quotes & bookings"} lead={live ? "Your account works on any device — orders and bookings tied to your phone number appear here alongside this device's." : "Everything you saved on this device — no account needed while the site runs in standalone mode. Accounts activate automatically when the production backend goes live."} />
 <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 space-y-10">

  {live && !user && (
    <section className="border hairline bg-card p-6 max-w-xl">
      <h2 className="font-display font-bold uppercase text-2xl flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" /> {mode === "login" ? "Sign in" : "Create account"}</h2>
      <div className="space-y-3 mt-4">
        {mode === "register" && <>
          <div><label className="label-tech" htmlFor="a-name">Full name</label><input id="a-name" className="field-tech" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
          <div><label className="label-tech" htmlFor="a-phone">Phone / WhatsApp</label><input id="a-phone" className="field-tech" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
        </>}
        <div><label className="label-tech" htmlFor="a-email">Email</label><input id="a-email" type="email" className="field-tech" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
        <div><label className="label-tech" htmlFor="a-password">Password</label><input id="a-password" type="password" className="field-tech" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} onKeyDown={e=>e.key==="Enter"&&void submit()} /></div>
        <Button className="w-full rounded-none h-12 font-display uppercase" disabled={busy} onClick={()=>void submit()}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</Button>
        <button className="font-tech text-xs text-primary cursor-pointer" onClick={()=>setMode(mode==="login"?"register":"login")}>{mode === "login" ? "New here? Create an account" : "Already registered? Sign in"}</button>
      </div>
    </section>
  )}

  {user && (
    <section className="border hairline bg-card p-5 flex flex-wrap gap-4 items-center justify-between">
      <p className="font-tech text-sm">Signed in as <span className="font-semibold">{user.email}</span> · {user.role}{user.partnerCode ? <> · Partner <Link className="text-primary" to="/partner-status">{user.partnerCode}</Link></> : null}</p>
      <Button variant="outline" className="rounded-none font-display uppercase" onClick={()=>void logout()}><LogOut className="h-4 w-4 mr-2" /> Sign out</Button>
    </section>
  )}

  <section><h2 className="font-display font-bold uppercase text-2xl mb-4">Orders ({orders.length})</h2>{!orders.length?<p className="font-tech text-sm text-muted-foreground">No orders yet. <Link className="text-primary" to="/shop">Shop materials</Link></p>:<div className="border hairline">{orders.map((o,i)=>(<div key={o.code} className={`px-5 py-4 flex justify-between flex-wrap gap-3 ${i>0?"border-t hairline":""}`}><span className="font-tech font-semibold">{o.code}{(o as any).paid ? " · Paid ✓" : ""}</span><span className="font-tech">{formatNGN(o.totalNgn)}</span><StatusBadge status={o.status} /></div>))}</div>}</section>
  <section><h2 className="font-display font-bold uppercase text-2xl mb-4">Quotes ({quotes.length})</h2>{!quotes.length?<p className="font-tech text-sm text-muted-foreground">No quotes yet. <Link className="text-primary" to="/quote">Get an estimate</Link></p>:<div className="border hairline">{quotes.map((q,i)=>(<div key={q.code} className={`px-5 py-4 flex justify-between flex-wrap gap-3 ${i>0?"border-t hairline":""}`}><span className="font-tech font-semibold">{q.code} · {q.roofType}</span><span className="font-tech">{formatNGN(q.estimateNgn)}</span><StatusBadge status={q.status} /></div>))}</div>}</section>
  <section><h2 className="font-display font-bold uppercase text-2xl mb-4">Bookings ({bookings.length})</h2>{!bookings.length?<p className="font-tech text-sm text-muted-foreground">No bookings yet. <Link className="text-primary" to="/book">Book a visit or crew</Link></p>:<div className="border hairline">{bookings.map((b,i)=>(<div key={b.code} className={`px-5 py-4 flex justify-between flex-wrap gap-3 ${i>0?"border-t hairline":""}`}><span className="font-tech font-semibold">{b.code} · {b.serviceLabel}</span><span className="font-tech">{b.date} · {b.slot}</span><StatusBadge status={b.status} /></div>))}</div>}</section>
 </div></div>);
}
