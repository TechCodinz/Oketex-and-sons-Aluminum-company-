import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { SERVICES } from "@/data/catalog";
import { PageHead } from "@/components/StatusBadge";
export default function Services(){
 return (<div><PageHead kicker="Services" title="What we do, end to end" lead="From the first tape measure to the last ridge cap — one team, one warranty, one invoice." />
 <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 grid md:grid-cols-2 gap-5">{SERVICES.map((s,i)=>(<article key={s.slug} className="border hairline bg-card p-6"><p className="font-tech text-xs text-primary">{String(i+1).padStart(2,"0")}</p><h3 className="font-display font-bold uppercase text-2xl mt-2">{s.title}</h3><p className="text-muted-foreground mt-3">{s.desc}</p><ul className="mt-4 space-y-2">{s.includes.map(t=>(<li key={t} className="font-tech text-sm flex gap-2"><span className="text-primary">///</span>{t}</li>))}</ul><Link to="/quote" className="inline-flex gap-2 mt-6 font-tech text-xs uppercase tracking-widest text-primary">Get a quote <ArrowRight className="h-4 w-4" /></Link></article>))}</div>
 <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-16"><div className="border hairline p-8 bg-primary text-primary-foreground flex flex-col md:flex-row gap-6 items-start md:items-center justify-between"><div><h3 className="font-display font-bold uppercase text-2xl md:text-3xl">Not sure what you need? Start with the free survey.</h3><p className="text-primary-foreground/85 mt-2">We measure, confirm the pitch and structure, then send a fixed BOQ.</p></div><Link to="/quote" className="bg-background text-foreground font-display font-semibold uppercase px-8 py-4 inline-flex gap-2">Pro Calculator <ArrowRight className="h-4 w-4" /></Link></div></div></div>);
}
