import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Search } from "lucide-react";
import { categoriesWithCount, products } from "@/data/catalog";
import { ProductCard } from "@/components/ProductCard";
import { PageHead } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
export default function Shop(){
 const [params,setParams]=useSearchParams(); const category=params.get("category")??undefined; const [search,setSearch]=useState("");
 const activeCat=useMemo(()=>categoriesWithCount.find(c=>c.slug===category),[category]);
 const list=products.filter(p=>p.active && (!category||p.categorySlug===category) && (!search|| (p.name+" "+p.summary).toLowerCase().includes(search.toLowerCase())));
 return (<div><PageHead kicker="Catalog" title={activeCat?activeCat.name:"All materials"} lead={activeCat?.tagline ?? "Every sheet, tile, profile and accessory — priced per unit, in stock at the plant."} />
 <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10"><div className="flex flex-col lg:flex-row gap-6 lg:items-center justify-between mb-8"><div className="flex flex-wrap gap-px bg-border border hairline"><button onClick={()=>setParams({})} className={cn("px-4 py-2.5 font-tech text-xs uppercase tracking-widest cursor-pointer",!category?"bg-primary text-primary-foreground":"bg-background hover:text-primary")}>All</button>{categoriesWithCount.map(c=>(<button key={c.id} onClick={()=>setParams({category:c.slug})} className={cn("px-4 py-2.5 font-tech text-xs uppercase tracking-widest cursor-pointer",category===c.slug?"bg-primary text-primary-foreground":"bg-background hover:text-primary")}>{c.name}</button>))}</div><div className="relative lg:w-72"><Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="SEARCH MATERIALS" className="field-tech pl-7 font-tech text-sm uppercase" aria-label="Search materials" /></div></div>
 {list.length? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">{list.map(p=><ProductCard key={p.id} product={p} />)}</div> : <div className="border hairline py-20 text-center"><p className="font-tech text-sm uppercase tracking-widest text-muted-foreground">No materials match</p></div>}
 </div></div>);
}
