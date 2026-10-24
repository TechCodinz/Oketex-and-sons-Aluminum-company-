import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, BadgeCheck, MapPin, Search, Star } from "lucide-react";
import { PageHead } from "@/components/StatusBadge";
import { formatNGN } from "@/lib/money";
import { getPartners, getPartnersAsync, type Partner } from "@/lib/partnerStorage";
import { PRO_TRADES, SELLER_CATEGORIES } from "@/data/partnerTerms";
import { getPartnerTerms } from "@/lib/settings";
import { reviewSummaryFor, starsText, syncReviewsAsync } from "@/lib/reviews";
import { cn } from "@/lib/utils";

export function lowestPrice(p: Partner): number | null {
  if (!p.products.length) return null;
  return Math.min(...p.products.map(x => x.priceNgn));
}

export function PartnerCard({ p }: { p: Partner }) {
  const from = lowestPrice(p);
  const tags = p.role === "pro" ? p.trades : p.categories;
  return (
    <div className={cn("border hairline bg-card p-6 flex flex-col relative", p.featured && "border-primary/70")}>
      {p.featured && <span className="absolute -top-3 left-4 bg-primary text-primary-foreground font-tech text-[10px] uppercase tracking-widest px-2 py-1 inline-flex items-center gap-1"><Star className="h-3 w-3" /> Featured</span>}
      <div className="flex items-start justify-between gap-3">
        <span className={cn("font-tech text-[10px] uppercase tracking-widest px-2 py-1 border", p.role === "pro" ? "border-sky-500/40 text-sky-400" : "border-violet-500/40 text-violet-400")}>{p.role === "pro" ? "Pro" : "Seller"}</span>
        {p.sample && <span className="font-tech text-[10px] uppercase tracking-widest text-yellow-400 border border-yellow-500/40 px-2 py-1">Sample listing</span>}
      </div>
      <h3 className="font-display font-bold uppercase text-xl mt-4 leading-tight flex items-center gap-2">{p.businessName}{p.verified && <BadgeCheck className="h-5 w-5 text-primary shrink-0" aria-label="Verified by Oketex" />}</h3>
      {p.verified && <p className="font-tech text-[10px] uppercase tracking-widest text-primary mt-1">Verified by Oketex</p>}
      {(() => { const s = reviewSummaryFor(p.code); return s.count > 0
        ? <p className="font-tech text-xs mt-1.5"><span className="text-primary">{starsText(s.avg)}</span> <span className="font-semibold">{s.avg.toFixed(1)}</span> <span className="text-muted-foreground">({s.count} review{s.count === 1 ? "" : "s"})</span></p>
        : <p className="font-tech text-[11px] text-muted-foreground mt-1.5">No reviews yet</p>; })()}
      <p className="font-tech text-xs text-muted-foreground mt-2 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {p.location}{p.role === "pro" && p.yearsExperience ? ` · ${p.yearsExperience} yrs experience` : ""}</p>
      <p className="font-tech text-[11px] text-muted-foreground">Serves: {p.areas}</p>
      <div className="flex flex-wrap gap-1.5 mt-3">{tags.map(t => <span key={t} className="border hairline px-2 py-1 font-tech text-[10px] uppercase tracking-wider">{t}</span>)}</div>
      <p className="text-sm text-muted-foreground mt-3 line-clamp-3 flex-1">{p.bio}</p>
      {from !== null && <p className="font-tech text-sm mt-4">From <span className="text-primary font-semibold">{formatNGN(from)}</span>{p.products[0] ? ` ${p.products.reduce((a, b) => (b.priceNgn < a.priceNgn ? b : a)).unit}` : ""} · {p.products.length} products listed</p>}
      <Link to={`/partners/${p.code}`} className="inline-flex items-center gap-2 mt-5 bg-primary text-primary-foreground font-display font-semibold uppercase tracking-wider px-5 h-11 hover:bg-primary/90 w-fit">View {p.role === "pro" ? "profile" : "storefront"} <ArrowRight className="h-4 w-4" /></Link>
    </div>
  );
}

export default function Partners() {
  const TERMS = getPartnerTerms();
  const [role, setRole] = useState<"all" | "pro" | "seller">("all");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [loc, setLoc] = useState("");
  const [all, setAll] = useState<Partner[]>(() => getPartners().filter(p => p.status === "approved"));
  const [, setReviewTick] = useState(0);
  useEffect(() => { let on = true; getPartnersAsync().then(list => { if (on) setAll(list); }); syncReviewsAsync().then(() => { if (on) setReviewTick(n => n + 1); }); return () => { on = false; }; }, []);
  const tagOptions = role === "pro" ? [...PRO_TRADES] : role === "seller" ? [...SELLER_CATEGORIES] : [...PRO_TRADES, ...SELLER_CATEGORIES];
  const list = useMemo(() => {
    const s = search.trim().toLowerCase(), l = loc.trim().toLowerCase();
    return all.filter(p =>
      (role === "all" || p.role === role) &&
      (!tag || p.trades.includes(tag) || p.categories.includes(tag)) &&
      (!l || `${p.location} ${p.areas}`.toLowerCase().includes(l)) &&
      (!s || `${p.businessName} ${p.bio} ${p.trades.join(" ")} ${p.categories.join(" ")} ${p.products.map(x => x.name).join(" ")}`.toLowerCase().includes(s))
    ).sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.verified) - Number(a.verified));
  }, [all, role, tag, search, loc]);

  return (<div>
    <PageHead kicker="Partner Network" title="Nigeria's building pros & materials sellers — vetted by Oketex" lead="Hire approved pros for your job, or order materials from approved sellers. Requests placed through Oketex are tracked as network leads — partners settle a flat referral commission with Oketex only when they win the work (current launch terms)." />
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <div className="flex flex-wrap gap-3 items-center justify-between mb-8">
        <div className="flex gap-px bg-border border hairline w-fit flex-wrap">
          {([["all", "All partners"], ["pro", "Pros"], ["seller", "Sellers"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => { setRole(v); setTag(""); }} className={cn("px-4 py-2.5 font-tech text-xs uppercase tracking-widest cursor-pointer", role === v ? "bg-primary text-primary-foreground" : "bg-background hover:text-primary")}>{l}</button>
          ))}
        </div>
        <Link to="/join" className="inline-flex items-center gap-2 border border-primary text-primary font-display font-semibold uppercase tracking-wider px-5 h-11 hover:bg-primary hover:text-primary-foreground">Join as Pro / Seller <ArrowRight className="h-4 w-4" /></Link>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="relative"><Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="SEARCH BUSINESS, TRADE, PRODUCT…" className="field-tech pl-7 font-tech text-sm" aria-label="Search partners" /></div>
        <select value={tag} onChange={e => setTag(e.target.value)} className="field-tech font-tech text-sm" aria-label="Filter by trade or category"><option value="">All trades & categories</option>{tagOptions.map(t => <option key={t} value={t}>{t}</option>)}</select>
        <input value={loc} onChange={e => setLoc(e.target.value)} placeholder="LOCATION / AREA (e.g. Lekki, Abuja)" className="field-tech font-tech text-sm" aria-label="Filter by location" />
      </div>

      <p className="font-tech text-xs text-muted-foreground mb-5">{list.length} approved partner{list.length === 1 ? "" : "s"} · Referral commission under current launch terms: {TERMS.referralCommissionPct}% of won work, paid by the partner — never added to your price.</p>
      {!list.length ? <div className="border hairline py-16 text-center"><p className="font-tech text-sm uppercase tracking-widest text-muted-foreground">No partners match — try a wider search, or <Link to="/join" className="text-primary">join the network</Link>.</p></div>
        : <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">{list.map(p => <PartnerCard key={p.code} p={p} />)}</div>}

      <div className="border hairline bg-card p-6 mt-12 flex flex-wrap gap-6 items-center justify-between">
        <div><h3 className="font-display font-bold uppercase text-2xl">Are you a pro or a materials seller?</h3><p className="text-sm text-muted-foreground mt-1 max-w-xl">Register free, get approved by Oketex, receive tracked job & supply leads, and push your offers to the network. Verified badge {formatNGN(TERMS.verificationFeeNgn)} one-time · Featured {formatNGN(TERMS.featuredFeeNgn)}/month (current launch terms).</p></div>
        <Link to="/join" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-display font-semibold uppercase tracking-wider px-6 h-12 hover:bg-primary/90 shrink-0">Register now <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </div>
  </div>);
}
