import { useState } from "react";
import { Link, NavLink } from "react-router";
import { Menu, Phone, ShoppingCart, UserRound, Megaphone } from "lucide-react";
import { useAuthUser } from "@/lib/auth";
import { BUSINESS } from "@/contracts/constants";
import { getBusiness, businessWaLink, getPromoBanner } from "@/lib/settings";
import { useLang, LanguageSelect } from "@/lib/i18n";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
// Nav labels resolve through the i18n dictionary (Phase 7) by path key.
const NAV = [
  { to: "/shop", k: "nav.shop" },
  { to: "/quote", k: "nav.quote" },
  { to: "/estimator", k: "nav.estimator" },
  { to: "/visualizer", k: "nav.visualizer" },
  { to: "/tools", k: "nav.tools" },
  { to: "/build", k: "nav.build" },
  { to: "/workspace", k: "nav.workspace" },
  { to: "/documents", k: "nav.documents" },
  { to: "/book", k: "nav.book" },
  { to: "/partners", k: "nav.partners" },
  { to: "/gallery", k: "nav.gallery" },
  { to: "/track", k: "nav.track" },
  { to: "/assistant", k: "nav.assistant" },
];
const NAV_EXTRA = [
  { to: "/documents", k: "nav.documents" },
  { to: "/roofing-guide", k: "nav.roofingGuide" },
  { to: "/plans", k: "nav.gopro" },
  { to: "/jobs", k: "nav.jobs" },
  { to: "/snap-send", k: "nav.snapSend" },
  { to: "/prices", k: "nav.prices" },
  { to: "/snap-measure", k: "nav.snap" },
  { to: "/services", k: "nav.services" },
  { to: "/join", k: "nav.join" },
  { to: "/partner-status", k: "nav.partnerStatus" },
];
export function LogoMark({ className }: { className?: string }) {
  return (<svg viewBox="0 0 40 40" className={className} aria-hidden="true"><rect x="2" y="2" width="36" height="36" fill="none" stroke="#FF6026" strokeWidth="2.5" /><path d="M9 29 L20 10 L31 29" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" /><line x1="14" y1="22" x2="26" y2="22" stroke="#FF6026" strokeWidth="2.5" /></svg>);
}
const MARQUEE_ITEMS = ["FREE SITE MEASUREMENT WITHIN OGUN & LAGOS","50-YEAR WARRANTY ON STONE-COATED TILES","SAME-DAY CUTTING ON LONGSPAN ORDERS","NATIONWIDE DELIVERY","0.45MM · 0.50MM · 0.55MM FULL GAUGE IN STOCK"];
export function SiteHeader() {
  const { count, openCart } = useCart();
  const authUser = useAuthUser();
  const { t } = useLang();
  const promo = getPromoBanner();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 no-print">
      <div className="bg-primary text-primary-foreground overflow-hidden"><div className="flex whitespace-nowrap animate-marquee py-1.5">{[0,1].map(dup=>(<div key={dup} className="flex shrink-0" aria-hidden={dup===1}>{MARQUEE_ITEMS.map(item=>(<span key={`${dup}-${item}`} className="font-tech text-[11px] tracking-[0.18em] mx-8">{item} <span className="text-primary-foreground/50 ml-8">///</span></span>))}</div>))}</div></div>
      <div className="bg-background/95 backdrop-blur border-b hairline"><div className="mx-auto max-w-7xl px-4 sm:px-6 flex items-center gap-4 h-16">
        <button className="lg:hidden p-2 -ml-2 hover:text-primary" onClick={()=>setMobileOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        <Link to="/" className="flex items-center gap-3 min-w-0"><LogoMark className="h-9 w-9 shrink-0 text-foreground" /><div className="leading-none min-w-0"><div className="font-display font-bold text-lg tracking-wide uppercase truncate">Oketex <span className="brand-gradient">&amp;</span> Sons</div><div className="font-tech text-[10px] tracking-[0.28em] text-muted-foreground uppercase">Aluminum Co.</div></div></Link>
        <nav className="hidden lg:flex items-center gap-1 ml-4 flex-wrap">{NAV.map(item=>(<NavLink key={item.to} to={item.to} className={({isActive})=>`px-2.5 py-2 font-display font-semibold uppercase tracking-wider text-[13px] transition-colors hover:text-primary ${isActive?"text-primary":"text-foreground/80"}`}>{t(item.k)}</NavLink>))}</nav>
        <div className="ml-auto flex items-center gap-2">
          <a href={`tel:${getBusiness().phone.replace(/\s/g,"")}`} className="hidden xl:flex items-center gap-2 font-tech text-xs text-muted-foreground hover:text-primary mr-2"><Phone className="h-3.5 w-3.5" />{getBusiness().phone}</a>
          <span className="hidden md:block"><LanguageSelect className="bg-background border hairline font-tech text-xs px-2 py-2 cursor-pointer" /></span>
          <Button variant="ghost" size="icon" className="relative hover:text-primary" onClick={openCart} aria-label="Open cart"><ShoppingCart className="h-5 w-5" />{count>0 && <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground font-tech text-[10px] h-4 min-w-4 px-1 flex items-center justify-center">{count}</span>}</Button>
          {authUser ? <Link to="/account" className="hidden sm:inline-flex items-center gap-1.5 border hairline px-3 py-2 font-display uppercase tracking-wider text-xs text-primary"><UserRound className="h-3.5 w-3.5" />{authUser.name.split(" ")[0]}</Link> : <Link to="/account" className="hidden sm:inline-flex border hairline px-3 py-2 font-display uppercase tracking-wider text-xs hover:text-primary">{t("header.signin")}</Link>}
          <Link to="/admin" className="hidden sm:inline-flex border hairline px-3 py-2 font-display uppercase tracking-wider text-xs hover:text-primary">{t("header.admin")}</Link>
        </div>
      </div></div>
      {promo.active && promo.text.trim() && (
        <div className="bg-foreground text-background"><div className="mx-auto max-w-7xl px-4 sm:px-6 py-2 flex items-center justify-center gap-2 text-center">
          <Megaphone className="h-3.5 w-3.5 shrink-0" /><p className="font-tech text-[11px] tracking-[0.14em] uppercase">{promo.text}</p>
        </div></div>
      )}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetContent side="left" className="w-72 max-w-[85vw] bg-background overflow-y-auto overscroll-contain max-h-dvh pb-10"><SheetHeader><SheetTitle className="flex items-center gap-2"><LogoMark className="h-7 w-7 text-foreground" /><span className="font-display uppercase">Oketex &amp; Sons</span></SheetTitle></SheetHeader><nav className="mt-8 flex flex-col gap-1">{[...NAV, ...NAV_EXTRA].filter((v,i,a)=>a.findIndex(x=>x.to===v.to)===i).map(item=>(<NavLink key={item.to} to={item.to} onClick={()=>setMobileOpen(false)} className="px-3 py-3 font-display font-semibold uppercase tracking-wider border-b hairline hover:text-primary">{t(item.k)}</NavLink>))}<NavLink to="/admin" onClick={()=>setMobileOpen(false)} className="px-3 py-3 font-display font-semibold uppercase tracking-wider border-b hairline">{t("header.admin")} (Demo)</NavLink></nav><div className="mt-6 px-3"><p className="label-tech mb-2">Language</p><LanguageSelect className="bg-background border hairline font-tech text-sm px-3 py-2.5 w-full cursor-pointer" /></div></SheetContent></Sheet>
    </header>
  );
}
