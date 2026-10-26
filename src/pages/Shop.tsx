import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Search, Globe2 } from "lucide-react";
import { categoriesWithCount, catalogue, productPrice } from "@/data/catalog";
import { ProductCard } from "@/components/ProductCard";
import { PageHead } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

type SortKey = "featured" | "price-asc" | "price-desc" | "name";
const SORTS: { id: SortKey; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "price-asc", label: "Price ↑" },
  { id: "price-desc", label: "Price ↓" },
  { id: "name", label: "Name A–Z" },
];

export default function Shop(){
 const [params,setParams]=useSearchParams(); const category=params.get("category")??undefined; const [search,setSearch]=useState(""); const [sort,setSort]=useState<SortKey>("featured");
 const all=catalogue();
 const activeCat=useMemo(()=>categoriesWithCount.find(c=>c.slug===category),[category]);
 // Search runs over name + summary + description + spec values, so the
 // words customers actually use ("POP", "rod", "WC", "tank", "gum
 // cement"…) find the product even when its name says it differently.
 const q=search.trim().toLowerCase();
 const list=all.filter(p=>p.active && (!category||p.categorySlug===category) && (!q || (p.name+" "+p.summary+" "+p.description+" "+Object.values(p.specs||{}).join(" ")).toLowerCase().includes(q)));
 const sorted=useMemo(()=>{ const arr=[...list];
   if(sort==="price-asc") arr.sort((a,b)=>productPrice(a)-productPrice(b));
   else if(sort==="price-desc") arr.sort((a,b)=>productPrice(b)-productPrice(a));
   else if(sort==="name") arr.sort((a,b)=>a.name.localeCompare(b.name));
   else arr.sort((a,b)=>Number(b.featured)-Number(a.featured) || a.id-b.id);
   return arr; },[list,sort]);
 return (<div><PageHead kicker="Catalog" title={activeCat?activeCat.name:"All materials"} lead={activeCat?.tagline ?? "Every sheet, tile, profile and accessory — priced per unit, in stock at the plant."} />
 <div className="border-b hairline bg-primary/10"><div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3 justify-between"><p className="font-tech text-sm"><Globe2 className="inline h-4 w-4 mr-2 text-primary" />Can&apos;t find it anywhere near you? <span className="text-muted-foreground">We source it globally — to your doorstep.</span></p><Link to="/source" className="font-tech text-xs uppercase tracking-widest text-primary hover:underline">Source it for me →</Link></div></div>
 <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10"><div className="flex flex-col lg:flex-row gap-6 lg:items-center justify-between mb-8"><div className="flex flex-wrap gap-px bg-border border hairline"><button onClick={()=>setParams({})} className={cn("px-4 py-2.5 font-tech text-xs uppercase tracking-widest cursor-pointer",!category?"bg-primary text-primary-foreground":"bg-background hover:text-primary")}>All</button>{categoriesWithCount.map(c=>(<button key={c.id} onClick={()=>setParams({category:c.slug})} className={cn("px-4 py-2.5 font-tech text-xs uppercase tracking-widest cursor-pointer",category===c.slug?"bg-primary text-primary-foreground":"bg-background hover:text-primary")}>{c.name}</button>))}</div><div className="flex gap-3 items-center"><div className="relative lg:w-72"><Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="SEARCH MATERIALS" className="field-tech pl-7 font-tech text-sm uppercase" aria-label="Search materials" /></div><select id="shop-sort" value={sort} onChange={e=>setSort(e.target.value as SortKey)} className="field-tech font-tech text-xs uppercase cursor-pointer" aria-label="Sort products">{SORTS.map(s=>(<option key={s.id} value={s.id}>{s.label}</option>))}</select></div></div>
 {sorted.length? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">{sorted.map(p=><ProductCard key={p.id} product={p} />)}</div> : <div className="border hairline py-20 text-center"><p className="font-tech text-sm uppercase tracking-widest text-muted-foreground">No materials match</p><p className="font-tech text-xs text-muted-foreground mt-3">If we don&apos;t stock it, we can source it — <Link to="/source" className="text-primary hover:underline">ask the sourcing desk</Link>.</p></div>}
 </div></div>);
}
