import { useState } from "react";
import { galleryProjects } from "@/data/catalog";
import { PageHead } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
export default function Gallery(){
 const cats=["All",...Array.from(new Set(galleryProjects.map(g=>g.category)))]; const [cat,setCat]=useState("All");
 const list=galleryProjects.filter(g=>cat==="All"||g.category===cat);
 return (<div><PageHead kicker="Proof" title="Completed projects" lead="Real roofs, facades and glazing delivered across Nigeria." /><div className="mx-auto max-w-7xl px-4 sm:px-6 py-10"><div className="flex flex-wrap gap-px bg-border border hairline w-fit mb-8">{cats.map(c=>(<button key={c} onClick={()=>setCat(c)} className={cn("px-4 py-2.5 font-tech text-xs uppercase tracking-widest cursor-pointer",cat===c?"bg-primary text-primary-foreground":"bg-background hover:text-primary")}>{c}</button>))}</div><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">{list.map(g=>(<article key={g.id} className="border hairline bg-card overflow-hidden group"><div className="aspect-[4/3] overflow-hidden"><img src={g.image} alt={g.title} loading="lazy" className="h-full w-full object-cover group-hover:scale-[1.04] transition-transform" /></div><div className="p-5"><p className="font-tech text-[10px] uppercase tracking-widest text-primary">{g.category} · {g.location}</p><h3 className="font-display font-bold uppercase text-xl mt-1">{g.title}</h3><p className="text-sm text-muted-foreground mt-2">{g.description}</p></div></article>))}</div></div></div>);
}
