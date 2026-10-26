import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Download, Play, Pause } from "lucide-react";
import { PageHead } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ROOF_COLOURS } from "@/data/catalog";
import { toast } from "sonner";
type RoofShape="gable"|"hip"|"shed"; type Pattern="longspan"|"metcoppo"|"stone"|"corrugated"|"steptiles"|"shingle"|"milano"|"roman"|"eurotile"|"seam"; type Wall="plaster"|"brick"|"stone"|"acp"|"timber"; type Light="day"|"golden"|"dusk"|"night";
const WALL_COLOURS=[{name:"Warm White",hex:"#EDE8DC"},{name:"Sand",hex:"#C2A878"},{name:"Light Grey",hex:"#B8BABC"},{name:"Peach",hex:"#D9A07A"},{name:"Pale Green",hex:"#A8BFA5"}];
const SKIES:Record<Light,{sky:[string,string];sun:string;wallShade:string;label:string}>={
 day:{sky:["#7EC8E3","#EAF6FB"],sun:"#FFF3B0",wallShade:"rgba(0,0,0,0)",label:"Day"},
 golden:{sky:["#FF9A3C","#FFD194"],sun:"#FFDF6B",wallShade:"rgba(120,40,0,0.12)",label:"Golden Hour"},
 dusk:{sky:["#2B3A67","#7A6FA0"],sun:"#E8DFF5",wallShade:"rgba(10,10,60,0.22)",label:"Dusk Blue"},
 night:{sky:["#060913","#1B2340"],sun:"#E6EDF7",wallShade:"rgba(0,0,30,0.45)",label:"Night — Lit Windows"},
};
export default function Visualizer(){
 const navigate=useNavigate();
 const [shape,setShape]=useState<RoofShape>("gable"); const [pattern,setPattern]=useState<Pattern>("longspan");
 const [roofColour,setRoofColour]=useState(ROOF_COLOURS[0]); const [wall,setWall]=useState<Wall>("plaster");
 const [wallColour,setWallColour]=useState(WALL_COLOURS[0]); const [acpColour,setAcpColour]=useState("#274B63");
 const [winStyle,setWinStyle]=useState<"casement"|"sliding"|"fixed">("casement"); const [doorColour,setDoorColour]=useState("#4A3428");
 const [light,setLight]=useState<Light>("day"); const [tour,setTour]=useState(false);
 const svgRef=useRef<SVGSVGElement>(null);
 // cinematic tour
 useMemo(()=>{},[]);
 // tour timer via effect in render-safe way
 if(tour && typeof window!=="undefined"){ /* handled below with useEffect-like interval stored */ }
 const [tourTick]=useState(0); void tourTick;
 // Use a ref interval
 const timerRef=useRef<number|null>(null);
 const toggleTour=()=>{
   if(tour){ if(timerRef.current) window.clearInterval(timerRef.current); timerRef.current=null; setTour(false); return; }
   setTour(true); const order:Light[]=["day","golden","dusk","night"]; let i=order.indexOf(light);
   timerRef.current=window.setInterval(()=>{ i=(i+1)%order.length; setLight(order[i]); },2200);
 };
 const wallFill = wall==="plaster"? wallColour.hex : wall==="acp"? acpColour : wall==="brick"? "url(#wall-brick)" : wall==="stone"? "url(#wall-stone)" : "url(#wall-timber)";
 const winFill = light==="night"? "#FFD166" : light==="dusk"? "#FFE9A8" : "#BFE3F0";
 const download=()=>{
   const svg=svgRef.current; if(!svg) return;
   const xml=new XMLSerializer().serializeToString(svg); const blob=new Blob([xml],{type:"image/svg+xml;charset=utf-8"}); const url=URL.createObjectURL(blob);
   const img=new Image(); img.onload=()=>{ const c=document.createElement("canvas"); c.width=1200; c.height=800; const ctx=c.getContext("2d")!; ctx.drawImage(img,0,0,1200,800); URL.revokeObjectURL(url); const a=document.createElement("a"); a.download="oketex-visualizer.png"; a.href=c.toDataURL("image/png"); a.click(); toast.success("PNG snapshot downloaded"); }; img.src=url;
 };
 const priceLook=()=>{ const map:Partial<Record<Pattern,string>>={longspan:"longspan-045",metcoppo:"metcoppo",corrugated:"corrugated",stone:"stone-coated",steptiles:"metcoppo",shingle:"stone-coated",milano:"stone-coated",roman:"stone-coated",eurotile:"stone-coated"}; const profile=map[pattern]; navigate(profile?`/quote?profile=${profile}&colour=${encodeURIComponent(roofColour.name)}&style=${shape==="shed"?"shed":"gable"}`:"/quote"); };
 const sky=SKIES[light];
 return (<div><PageHead kicker="Visualizer Studio — Real-Time" title="See your house before you roof it" lead="Every control redraws the house instantly: roof shape, profile pattern, 14 baked colours, wall types and cinematic lighting." />
 <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 grid lg:grid-cols-[1fr_340px] gap-8">
  <div>
   <div className={`border hairline overflow-hidden ${tour?"cinematic-tour":""}`}>
   <svg ref={svgRef} viewBox="0 0 900 600" className="w-full block" role="img" aria-label="House visualizer">
    <defs>
     <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={sky.sky[0]} /><stop offset="100%" stopColor={sky.sky[1]} /></linearGradient>
     <pattern id="pat-longspan" width="18" height="10" patternUnits="userSpaceOnUse"><rect width="18" height="10" fill={roofColour.hex} /><rect x="0" width="3" height="10" fill="rgba(255,255,255,0.28)" /><rect x="15" width="3" height="10" fill="rgba(0,0,0,0.28)" /></pattern>
     <pattern id="pat-corrugated" width="20" height="10" patternUnits="userSpaceOnUse"><rect width="20" height="10" fill={roofColour.hex} /><path d="M0 10 Q5 0 10 10 Q15 0 20 10" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" /></pattern>
     <pattern id="pat-metcoppo" width="48" height="24" patternUnits="userSpaceOnUse"><rect width="48" height="24" fill={roofColour.hex} /><path d="M0 12 H48 M0 24 H48" stroke="rgba(0,0,0,0.35)" strokeWidth="3" /><path d="M12 0 V12 M36 12 V24" stroke="rgba(0,0,0,0.25)" strokeWidth="2" /></pattern>
     <pattern id="pat-stone" width="44" height="22" patternUnits="userSpaceOnUse"><rect width="44" height="22" fill={roofColour.hex} /><rect x="1" y="1" width="42" height="9" rx="4" fill="rgba(255,255,255,0.14)" stroke="rgba(0,0,0,0.3)" /><rect x="12" y="12" width="42" height="9" rx="4" fill="rgba(0,0,0,0.12)" stroke="rgba(0,0,0,0.3)" /></pattern>
     <pattern id="pat-steptiles" width="40" height="20" patternUnits="userSpaceOnUse"><rect width="40" height="20" fill={roofColour.hex} /><path d="M0 10 H40 M0 20 H40" stroke="rgba(0,0,0,0.4)" strokeWidth="3" /><path d="M0 2 H40" stroke="rgba(255,255,255,0.22)" strokeWidth="2" /></pattern>
     <pattern id="pat-shingle" width="36" height="24" patternUnits="userSpaceOnUse"><rect width="36" height="24" fill={roofColour.hex} /><path d="M0 12 H36 M0 24 H36 M18 0 V12 M0 12 V24 M36 12 V24" stroke="rgba(0,0,0,0.38)" strokeWidth="2" /></pattern>
     <pattern id="pat-milano" width="56" height="26" patternUnits="userSpaceOnUse"><rect width="56" height="26" fill={roofColour.hex} /><path d="M0 13 Q14 2 28 13 Q42 24 56 13 M0 26 H56" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="3" /><path d="M0 13 Q14 2 28 13" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" /></pattern>
     <pattern id="pat-roman" width="30" height="24" patternUnits="userSpaceOnUse"><rect width="30" height="24" fill={roofColour.hex} /><path d="M7 0 V24 M22 0 V24" stroke="rgba(0,0,0,0.4)" strokeWidth="4" /><path d="M4 0 V24" stroke="rgba(255,255,255,0.28)" strokeWidth="2" /><path d="M0 24 H30" stroke="rgba(0,0,0,0.3)" strokeWidth="2" /></pattern>
     <pattern id="pat-eurotile" width="48" height="24" patternUnits="userSpaceOnUse"><rect width="48" height="24" fill={roofColour.hex} /><rect x="1" y="1" width="46" height="10" rx="2" fill="rgba(255,255,255,0.12)" stroke="rgba(0,0,0,0.32)" /><rect x="13" y="13" width="46" height="10" rx="2" fill="rgba(0,0,0,0.1)" stroke="rgba(0,0,0,0.32)" /><circle cx="8" cy="6" r="1" fill="rgba(255,255,255,0.35)" /><circle cx="30" cy="18" r="1" fill="rgba(255,255,255,0.3)" /><circle cx="40" cy="5" r="1" fill="rgba(0,0,0,0.3)" /></pattern>
     <pattern id="pat-seam" width="46" height="10" patternUnits="userSpaceOnUse"><rect width="46" height="10" fill={roofColour.hex} /><rect x="0" width="4" height="10" fill="rgba(255,255,255,0.4)" /><rect x="4" width="2" height="10" fill="rgba(0,0,0,0.35)" /></pattern>
     <pattern id="wall-brick" width="44" height="20" patternUnits="userSpaceOnUse"><rect width="44" height="20" fill="#8E4A38" /><path d="M0 10 H44 M0 20 H44 M22 0 V10 M11 10 V20 M33 10 V20" stroke="#D8C3B0" strokeWidth="2" /></pattern>
     <pattern id="wall-stone" width="52" height="34" patternUnits="userSpaceOnUse"><rect width="52" height="34" fill="#8A8378" /><ellipse cx="14" cy="10" rx="12" ry="7" fill="#9A9284" stroke="#6E675C" /><ellipse cx="38" cy="24" rx="13" ry="8" fill="#7E7668" stroke="#6E675C" /><ellipse cx="12" cy="27" rx="9" ry="6" fill="#A39A8B" stroke="#6E675C" /></pattern>
     <pattern id="wall-timber" width="12" height="60" patternUnits="userSpaceOnUse"><rect width="12" height="60" fill="#8A6844" /><rect x="10" width="2" height="60" fill="#5E452A" /></pattern>
     <pattern id="wall-acp" width="90" height="60" patternUnits="userSpaceOnUse"><rect width="90" height="60" fill={acpColour} /><path d="M0 0 H90 V60" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="3" /></pattern>
    </defs>
    <rect width="900" height="600" fill="url(#sky)" />
    <circle cx="770" cy="85" r="42" fill={sky.sun} opacity="0.95" />
    <rect x="0" y="470" width="900" height="130" fill={light==="night"?"#101826":"#5E7A4A"} />
    <rect x="0" y="470" width="900" height="10" fill="rgba(0,0,0,0.18)" />
    {/* house body - isometric-ish front + side */}
    <polygon points="170,470 170,300 560,300 560,470" fill={wall==="acp"?"url(#wall-acp)":wallFill} stroke="#222" strokeWidth="2" />
    <polygon points="560,470 560,300 730,250 730,420" fill={wall==="acp"?"url(#wall-acp)":wallFill} opacity="0.82" stroke="#222" strokeWidth="2" />
    <rect x="170" y="300" width="560" height="170" fill={sky.wallShade} pointerEvents="none" style={{display: wall==="plaster"?"block":"none"}} />
    {/* windows */}
    {winStyle==="casement" && <g stroke="#222" strokeWidth="3"><rect x="210" y="340" width="90" height="90" fill={winFill} /><line x1="255" y1="340" x2="255" y2="430" /><line x1="210" y1="385" x2="300" y2="385" /><rect x="450" y="340" width="90" height="90" fill={winFill} /><line x1="495" y1="340" x2="495" y2="430" /></g>}
    {winStyle==="sliding" && <g stroke="#222" strokeWidth="3"><rect x="205" y="345" width="130" height="85" fill={winFill} /><line x1="270" y1="345" x2="270" y2="430" /><rect x="440" y="345" width="130" height="85" fill={winFill} /><line x1="505" y1="345" x2="505" y2="430" /></g>}
    {winStyle==="fixed" && <g stroke="#222" strokeWidth="3"><rect x="215" y="335" width="110" height="100" fill={winFill} /><rect x="445" y="335" width="110" height="100" fill={winFill} /></g>}
    {/* side window */}
    <rect x="610" y="320" width="70" height="70" fill={winFill} stroke="#222" strokeWidth="3" transform="skewY(-8)" />
    {/* door */}
    <rect x="355" y="360" width="70" height="110" fill={doorColour} stroke="#1a1a1a" strokeWidth="3" /><circle cx="415" cy="420" r="4" fill="#FFD166" />
    {/* roof */}
    {shape==="gable" && <g><polygon points="140,305 365,170 590,305" fill={`url(#pat-${pattern==="stone"?"stone":pattern})`} stroke="#1a1a1a" strokeWidth="3" /><polygon points="365,170 590,305 745,255 520,125" fill={`url(#pat-${pattern==="stone"?"stone":pattern})`} opacity="0.8" stroke="#1a1a1a" strokeWidth="3" /><rect x="355" y="158" width="180" height="10" fill="#222" transform="rotate(28 355 158)" opacity="0" /></g>}
    {shape==="hip" && <g><polygon points="140,305 250,185 480,185 590,305" fill={`url(#pat-${pattern==="stone"?"stone":pattern})`} stroke="#1a1a1a" strokeWidth="3" /><polygon points="480,185 590,305 745,255 610,150" fill={`url(#pat-${pattern==="stone"?"stone":pattern})`} opacity="0.8" stroke="#1a1a1a" strokeWidth="3" /><line x1="250" y1="185" x2="610" y2="150" stroke="#111" strokeWidth="4" /></g>}
    {shape==="shed" && <g><polygon points="140,260 590,320 590,350 140,295" fill={`url(#pat-${pattern==="stone"?"stone":pattern})`} stroke="#1a1a1a" strokeWidth="3" /><polygon points="140,260 310,215 745,270 590,320" fill={`url(#pat-${pattern==="stone"?"stone":pattern})`} opacity="0.85" stroke="#1a1a1a" strokeWidth="3" /></g>}
    <text x="24" y="585" fill={light==="night"||light==="dusk"?"#fff":"#222"} fontFamily="monospace" fontSize="15">OKETEX VISUALIZER — {shape.toUpperCase()} · {pattern.toUpperCase()} · {roofColour.name.toUpperCase()} · {sky.label.toUpperCase()}</text>
   </svg>
   </div>
   <div className="flex flex-wrap gap-3 mt-4"><Button className="rounded-none font-display uppercase" onClick={toggleTour}>{tour?<><Pause className="h-4 w-4 mr-2" /> Stop tour</>:<><Play className="h-4 w-4 mr-2" /> Cinematic Tour</>}</Button><Button variant="outline" className="rounded-none font-display uppercase" onClick={download}><Download className="h-4 w-4 mr-2" /> Download PNG</Button><Button variant="outline" className="rounded-none font-display uppercase" onClick={priceLook}>Price this look →</Button><Link to="/roofing-guide" className="inline-flex items-center border border-foreground/40 font-display font-semibold uppercase tracking-wider px-4 h-10 hover:border-primary hover:text-primary text-sm">Roofing styles & methods guide</Link></div>
   <p className="font-tech text-[11px] text-muted-foreground mt-3">Cinematic Tour cycles Day → Golden Hour → Dusk → Night with a slow pan/zoom. PNG snapshot renders this exact SVG.</p>
  </div>
  <aside className="space-y-6">
   <div className="border hairline bg-card p-5"><p className="label-tech mb-3">Roof shape</p><div className="flex gap-2">{(["gable","hip","shed"] as RoofShape[]).map(s=>(<button key={s} onClick={()=>setShape(s)} className={`px-3 py-2 font-tech text-xs uppercase border hairline cursor-pointer ${shape===s?"bg-primary text-primary-foreground":"hover:text-primary"}`}>{s}</button>))}</div></div>
   <div className="border hairline bg-card p-5"><p className="label-tech mb-3">Roof profile pattern</p><div className="flex flex-wrap gap-2">{([["longspan","Longspan ribs"],["metcoppo","Metcoppo steps"],["steptiles","Steptiles"],["stone","Stone-coated bond"],["eurotile","Eurotile"],["milano","Milano"],["roman","Roman"],["shingle","Shingle"],["seam","Standing seam"],["corrugated","Corrugated waves"]] as [Pattern,string][]).map(([id,l])=>(<button key={id} onClick={()=>setPattern(id)} className={`px-3 py-2 font-tech text-xs border hairline cursor-pointer ${pattern===id?"bg-primary text-primary-foreground":"hover:text-primary"}`}>{l}</button>))}</div></div>
   <div className="border hairline bg-card p-5"><p className="label-tech mb-3">Roof colour — {roofColour.name}</p><div className="flex flex-wrap gap-2">{ROOF_COLOURS.map(c=>(<button key={c.name} title={`${c.name} ${c.hex}`} onClick={()=>setRoofColour(c)} className={`w-9 h-9 border-2 cursor-pointer ${roofColour.name===c.name?"border-[#FF6026] scale-110":"border-white/20"}`} style={{background:c.hex}} aria-label={c.name} />))}</div></div>
   <div className="border hairline bg-card p-5"><p className="label-tech mb-3">Wall type</p><div className="flex flex-wrap gap-2">{([["plaster","Painted plaster"],["brick","Red brick"],["stone","Stone cladding"],["acp","ACP panels"],["timber","Timber boards"]] as [Wall,string][]).map(([id,l])=>(<button key={id} onClick={()=>setWall(id)} className={`px-3 py-2 font-tech text-xs border hairline cursor-pointer ${wall===id?"bg-primary text-primary-foreground":"hover:text-primary"}`}>{l}</button>))}</div>
   {wall==="plaster" && <div className="flex flex-wrap gap-2 mt-4">{WALL_COLOURS.map(c=>(<button key={c.name} title={c.name} onClick={()=>setWallColour(c)} className={`w-8 h-8 border-2 cursor-pointer ${wallColour.name===c.name?"border-[#FF6026]":"border-white/20"}`} style={{background:c.hex}} aria-label={c.name} />))}</div>}
   {wall==="acp" && <div className="flex flex-wrap gap-2 mt-4">{["#274B63","#6E7276","#B33A2B","#EDEEF0","#2E4B3F"].map(h=>(<button key={h} onClick={()=>setAcpColour(h)} className={`w-8 h-8 border-2 cursor-pointer ${acpColour===h?"border-[#FF6026]":"border-white/20"}`} style={{background:h}} aria-label={h} />))}</div>}</div>
   <div className="border hairline bg-card p-5"><p className="label-tech mb-3">Windows &amp; door</p><div className="flex gap-2 mb-4">{(["casement","sliding","fixed"] as const).map(s=>(<button key={s} onClick={()=>setWinStyle(s)} className={`px-3 py-2 font-tech text-xs uppercase border hairline cursor-pointer ${winStyle===s?"bg-primary text-primary-foreground":"hover:text-primary"}`}>{s}</button>))}</div><div className="flex gap-2">{["#4A3428","#2B2F33","#8E3B2F","#EDEEF0","#274B63"].map(h=>(<button key={h} title="Door colour" onClick={()=>setDoorColour(h)} className={`w-8 h-8 border-2 cursor-pointer ${doorColour===h?"border-[#FF6026]":"border-white/20"}`} style={{background:h}} aria-label={h} />))}</div></div>
   <div className="border hairline bg-card p-5"><p className="label-tech mb-3">Cinematic lighting</p><div className="grid grid-cols-2 gap-2">{(Object.keys(SKIES) as Light[]).map(l=>(<button key={l} onClick={()=>setLight(l)} className={`px-3 py-2.5 font-tech text-xs uppercase border hairline cursor-pointer ${light===l?"bg-primary text-primary-foreground":"hover:text-primary"}`}>{SKIES[l].label}</button>))}</div></div>
  </aside>
 </div></div>);
}
