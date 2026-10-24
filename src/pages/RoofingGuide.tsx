import { useMemo, useState } from "react";
import { Link } from "react-router";
import { PageHead } from "@/components/StatusBadge";
import { ArrowRight, Info } from "lucide-react";
import { ANATOMY_PARTS, ROOF_STYLES, METHOD_GROUPS, PITCH_MINIMUMS, eavesCalc, pitchFromRiseRun, type PatternKind } from "@/data/roofingGuide";

function PatternPreview({ kind, accent }: { kind: PatternKind; accent: string }) {
  const id = `gp-${kind}`;
  return (<svg viewBox="0 0 220 64" className="w-full h-16 block" aria-hidden="true">
    <defs>
      <pattern id={id} width="22" height="12" patternUnits="userSpaceOnUse"><rect width="22" height="12" fill={accent} /><rect x="0" width="3" height="12" fill="rgba(255,255,255,0.25)" /><rect x="18" width="4" height="12" fill="rgba(0,0,0,0.3)" /></pattern>
    </defs>
    {kind === "longspan" && <rect width="220" height="64" fill={`url(#${id})`} />}
    {kind === "corrugated" && <g fill={accent}>{Array.from({ length: 8 }).map((_, i) => (<path key={i} d={`M${i * 28} 64 Q ${i * 28 + 7} 8 ${i * 28 + 14} 64 Q ${i * 28 + 21} 8 ${i * 28 + 28} 64 Z`} opacity={i % 2 ? 0.85 : 1} />))}</g>}
    {kind === "steptiles" && <g fill={accent}>{[0, 1, 2].map(r => (<g key={r}>{[0, 1, 2, 3].map(c => (<rect key={c} x={c * 56 + (r % 2) * 10} y={r * 21} width="50" height="17" rx="3" opacity={0.75 + r * 0.1} stroke="rgba(0,0,0,0.35)" />))}</g>))}</g>}
    {kind === "metcoppo" && <g fill={accent}>{[0, 1].map(r => (<g key={r}>{[0, 1, 2].map(c => (<path key={c} d={`M${c * 74 + 4} ${r * 32 + 26} a33 20 0 0 1 66 0 Z`} stroke="rgba(0,0,0,0.35)" />))}</g>))}<rect width="220" height="64" fill="rgba(255,255,255,0.06)" /></g>}
    {kind === "stone-classic" && <g>{[0, 1].map(r => (<g key={r}>{[0, 1, 2, 3].map(c => (<rect key={c} x={c * 58 + (r % 2) * 20 - 10} y={r * 30 + 2} width="54" height="24" rx="6" fill={accent} stroke="rgba(0,0,0,0.4)" />))}</g>))}</g>}
    {kind === "stone-shingle" && <g>{[0, 1, 2].map(r => (<g key={r}>{[0, 1, 2, 3, 4].map(c => (<rect key={c} x={c * 46 + (r % 2) * 23 - 8} y={r * 20 + 2} width="42" height="16" fill={accent} stroke="rgba(0,0,0,0.4)" opacity={0.8 + (c % 2) * 0.15} />))}</g>))}</g>}
    {kind === "stone-milano" && <g fill={accent}>{[0, 1].map(r => (<g key={r}>{[0, 1, 2].map(c => (<path key={c} d={`M${c * 76 + 2} ${r * 32 + 28} a36 24 0 0 1 72 0 Z`} stroke="rgba(0,0,0,0.4)" strokeWidth="2" />))}</g>))}</g>}
    {kind === "stone-roman" && <g fill={accent}>{[0, 1, 2, 3, 4, 5].map(c => (<g key={c}><path d={`M${c * 38} 64 a19 40 0 0 1 38 0 Z`} opacity="0.9" stroke="rgba(0,0,0,0.3)" /><rect x={c * 38 + 34} y="0" width="5" height="64" fill="rgba(0,0,0,0.25)" /></g>))}</g>}
    {kind === "standing-seam" && <g fill={accent}><rect width="220" height="64" />{Array.from({ length: 7 }).map((_, i) => (<rect key={i} x={i * 32 + 14} y="0" width="4" height="64" fill="rgba(255,255,255,0.35)" />))}</g>}
    {kind === "flat" && <g><rect width="220" height="64" fill={accent} /><path d="M10 50 L210 38" stroke="#FF6026" strokeWidth="3" /><text x="12" y="24" fill="#fff" fontSize="11" fontFamily="monospace">fall 1:60 →</text></g>}
  </svg>);
}

function AnatomyDiagram({ sel, setSel }: { sel: string; setSel: (id: string) => void }) {
  return (<svg viewBox="0 0 840 520" className="w-full block" role="img" aria-label="Labelled roof anatomy diagram">
    <defs><pattern id="anat-roof" width="16" height="10" patternUnits="userSpaceOnUse"><rect width="16" height="10" fill="#3a3a3a" /><rect width="3" height="10" fill="rgba(255,255,255,0.18)" /><rect x="13" width="3" height="10" fill="rgba(0,0,0,0.35)" /></pattern></defs>
    {/* ground */}
    <line x1="50" y1="440" x2="800" y2="440" stroke="#555" strokeWidth="2" /><path d="M50 440 h750" stroke="#333" strokeDasharray="2 8" />
    {/* wall */}
    <rect x="300" y="320" width="260" height="120" fill="#242424" stroke="#777" strokeWidth="2" />
    <rect x="330" y="352" width="52" height="44" fill="#17181A" stroke="#777" /><rect x="478" y="352" width="52" height="44" fill="#17181A" stroke="#777" />
    <rect x="410" y="370" width="42" height="70" fill="#17181A" stroke="#777" />
    {/* wall plate + ceiling joist line */}
    <rect x="296" y="311" width="268" height="9" fill="#8A6844" />
    <line x1="300" y1="327" x2="560" y2="327" stroke="#999" strokeWidth="1.5" strokeDasharray="7 5" />
    {/* roof planes */}
    <polygon points="240,320 430,170 430,186 240,336" fill="url(#anat-roof)" stroke="#999" strokeWidth="1.5" />
    <polygon points="430,170 620,320 620,336 430,186" fill="url(#anat-roof)" stroke="#999" strokeWidth="1.5" opacity="0.92" />
    {/* battens (dashed, under surface) */}
    <line x1="262" y1="326" x2="428" y2="200" stroke="#C2A878" strokeWidth="2" strokeDasharray="10 6" />
    <line x1="598" y1="326" x2="432" y2="200" stroke="#C2A878" strokeWidth="2" strokeDasharray="10 6" />
    {/* ridge cap */}
    <path d="M412 174 L430 156 L448 174" fill="none" stroke="#FF6026" strokeWidth="7" strokeLinecap="round" />
    {/* fascia + soffit + gutter + downpipe (left eaves) */}
    <rect x="229" y="314" width="11" height="36" fill="#8A6844" />
    <rect x="240" y="343" width="60" height="7" fill="#6E7276" />
    <path d="M212 352 a17 11 0 0 0 34 0" fill="none" stroke="#B9BEC2" strokeWidth="4" />
    <path d="M240 356 L300 356" stroke="#B9BEC2" strokeWidth="3" />
    <rect x="303" y="356" width="9" height="84" fill="none" stroke="#B9BEC2" strokeWidth="3" />
    {/* chimney + flashing (right slope) */}
    <rect x="516" y="192" width="30" height="66" fill="#4a4a4a" stroke="#888" />
    <polygon points="506,250 556,266 556,254 506,238" fill="#FF6026" opacity="0.85" />
    {/* plan inset: hip & valley */}
    <g transform="translate(648,24)">
      <rect x="0" y="0" width="176" height="126" fill="#1d1d1f" stroke="#777" />
      <text x="8" y="16" fill="#999" fontSize="9" fontFamily="monospace">PLAN — HIP &amp; VALLEY</text>
      <polygon points="14,26 110,26 110,58 162,58 162,112 14,112" fill="none" stroke="#aaa" strokeWidth="2" />
      <line x1="14" y1="44" x2="110" y2="44" stroke="#666" strokeDasharray="4 3" />
      <line x1="14" y1="26" x2="50" y2="50" stroke="#FF6026" strokeWidth="2" />
      <line x1="110" y1="58" x2="146" y2="94" stroke="#FF6026" strokeWidth="2" />
    </g>
    <text x="60" y="470" fill="#777" fontSize="11" fontFamily="monospace">Schematic cross-section — tap a number (or a part name) to learn what it does.</text>
    {/* markers */}
    {ANATOMY_PARTS.map(pt => (<g key={pt.id} onClick={() => setSel(pt.id)} className="cursor-pointer">
      <circle cx={pt.x} cy={pt.y} r={sel === pt.id ? 13 : 11} fill={sel === pt.id ? "#fff" : "#FF6026"} stroke="#000" strokeWidth="1.5" />
      <text x={pt.x} y={pt.y + 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill={sel === pt.id ? "#FF6026" : "#fff"} fontFamily="monospace">{pt.n}</text>
    </g>))}
  </svg>);
}

export default function RoofingGuide() {
  const [sel, setSel] = useState("ridge");
  const part = ANATOMY_PARTS.find(p => p.id === sel) ?? ANATOMY_PARTS[0];
  const [pitch, setPitch] = useState(30);
  const [rise, setRise] = useState(1.73); const [run, setRun] = useState(3);
  const [useRiseRun, setUseRiseRun] = useState(false);
  const [slopeOv, setSlopeOv] = useState(0.75);
  const [rafterMm, setRafterMm] = useState(150);
  const effPitch = useRiseRun ? pitchFromRiseRun(rise, run) : pitch;
  const ev = useMemo(() => eavesCalc(effPitch, slopeOv, rafterMm / 1000), [effPitch, slopeOv, rafterMm]);
  const ACCENTS: Record<string, string> = { longspan: "#4A4F54", steptiles: "#6E4A3A", metcoppo: "#8E3B2F", "stone-classic": "#5A4632", "stone-shingle": "#3E4A42", "stone-milano": "#7A3B2E", "stone-roman": "#6B4E2E", "standing-seam": "#37424E", corrugated: "#7C8288", flat: "#55524C" };

  return (<div><PageHead kicker="Roofing Guide — Styles, Methods & Measurements" title="Know your roof, part by part" lead="Roof anatomy, every major covering style, and the standard measurements Nigerian pros work to — eaves, fascia, gutters, laps, fixings and pitches, explained plainly." />
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 space-y-16">

      {/* 1 — Anatomy */}
      <section id="anatomy" className="scroll-mt-28">
        <h2 className="font-display font-bold uppercase text-3xl">1 · Roof anatomy</h2>
        <p className="text-muted-foreground mt-2 max-w-3xl">Every part of a roof has a name and a job. Tap a number on the drawing — or a name in the list — to see what it does, what it is made of, and its typical size.</p>
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 mt-6">
          <div className="border hairline bg-card p-3"><AnatomyDiagram sel={sel} setSel={setSel} /></div>
          <div>
            <div className="flex flex-wrap gap-1.5">{ANATOMY_PARTS.map(p => (<button key={p.id} onClick={() => setSel(p.id)} className={`font-tech text-[11px] border px-2.5 py-1.5 cursor-pointer ${sel === p.id ? "bg-primary text-primary-foreground border-primary" : "hairline hover:border-primary hover:text-primary"}`}>{p.n}. {p.label}</button>))}</div>
            <div className="border border-primary/60 bg-card p-5 mt-4">
              <p className="font-tech text-[10px] uppercase tracking-widest text-primary">Part {part.n} of {ANATOMY_PARTS.length}</p>
              <h3 className="font-display font-bold uppercase text-2xl mt-1">{part.label}</h3>
              <p className="text-sm mt-3">{part.does}</p>
              <p className="font-tech text-xs mt-4"><span className="text-muted-foreground">Typical material:</span> {part.material}</p>
              <p className="font-tech text-xs mt-2"><span className="text-muted-foreground">Typical size:</span> {part.size}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2 — Styles & patterns */}
      <section id="styles" className="scroll-mt-28">
        <h2 className="font-display font-bold uppercase text-3xl">2 · Styles &amp; patterns library</h2>
        <p className="text-muted-foreground mt-2 max-w-3xl">The covering systems we supply and install, with the numbers that matter on site: minimum pitch, gauge, effective cover width, fixing method and laps. Figures are typical practice — the manufacturer&apos;s data sheet for the exact product governs.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">{ROOF_STYLES.map(st => (<article key={st.id} className="border hairline bg-card overflow-hidden">
          <PatternPreview kind={st.pattern} accent={ACCENTS[st.id] ?? "#4A4F54"} />
          <div className="p-5">
            <h3 className="font-display font-bold uppercase text-lg leading-tight">{st.name}</h3>
            <dl className="font-tech text-xs mt-3 space-y-1.5">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Min pitch</dt><dd className="text-right">{st.minPitch}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Gauge / spec</dt><dd className="text-right">{st.gauge}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Cover width</dt><dd className="text-right">{st.coverWidth}</dd></div>
              <div><dt className="text-muted-foreground">Fixing</dt><dd className="mt-0.5">{st.fixing}</dd></div>
              <div><dt className="text-muted-foreground">Laps</dt><dd className="mt-0.5">{st.laps}</dd></div>
            </dl>
            <p className="text-sm mt-3"><span className="text-primary font-tech text-[11px] uppercase tracking-widest">Best for — </span>{st.bestFor}</p>
            <p className="text-sm mt-2 text-muted-foreground"><span className="font-tech text-[11px] uppercase tracking-widest">Watch out — </span>{st.watchOut}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Link to="/visualizer" className="font-tech text-[11px] border hairline px-3 py-1.5 hover:border-primary hover:text-primary">See it in the Visualizer</Link>
              <Link to="/quote" className="font-tech text-[11px] border hairline px-3 py-1.5 hover:border-primary hover:text-primary">Price it in the Calculator</Link>
            </div>
          </div></article>))}</div>
      </section>

      {/* 3 — Methods & measurements */}
      <section id="methods" className="scroll-mt-28">
        <h2 className="font-display font-bold uppercase text-3xl">3 · Methods &amp; standard measurements</h2>
        <div className="flex gap-3 border border-amber-500/50 bg-amber-500/10 p-4 mt-4 max-w-3xl"><Info className="h-5 w-5 text-amber-500 shrink-0" /><p className="text-sm">Every value below is <b>typical Nigerian practice</b> — a field reference, not a regulation. Spans, loads and manufacturer instructions can override any of them: <b>always confirm on site</b> before cutting or ordering.</p></div>
        <div className="grid lg:grid-cols-2 gap-5 mt-6">{METHOD_GROUPS.map(g => (<section key={g.title} className="border hairline bg-card p-6">
          <h3 className="font-display font-bold uppercase text-xl">{g.title}</h3>
          <div className="mt-4 divide-y divide-white/10">{g.rows.map(r => (<div key={r.topic} className="py-3"><p className="font-tech text-xs uppercase tracking-widest text-primary">{r.topic}</p><p className="text-sm mt-1">{r.spec}</p></div>))}</div>
        </section>))}
          <section className="border hairline bg-card p-6">
            <h3 className="font-display font-bold uppercase text-xl">Minimum pitch by material</h3>
            <div className="overflow-x-auto mt-4"><table className="w-full text-sm min-w-[420px]"><thead><tr className="border-b hairline text-left font-tech text-[10px] uppercase tracking-widest text-muted-foreground"><th className="py-2 pr-3">Material</th><th className="py-2 pr-3">Minimum</th><th className="py-2">Note</th></tr></thead>
              <tbody>{PITCH_MINIMUMS.map(r => (<tr key={r.material} className="border-b hairline"><td className="py-2.5 pr-3 font-medium">{r.material}</td><td className="py-2.5 pr-3 font-tech text-primary">{r.minimum}</td><td className="py-2.5 text-muted-foreground">{r.note}</td></tr>))}</tbody></table></div>
            <p className="font-tech text-[11px] text-muted-foreground mt-3">Below the minimum, water sits at laps and fixings instead of running off — no sealant fully fixes a too-flat roof.</p>
          </section>
        </div>
      </section>

      {/* 4 — Eaves & angles */}
      <section id="eaves" className="scroll-mt-28">
        <h2 className="font-display font-bold uppercase text-3xl">4 · Eaves &amp; angles — the plumb cut</h2>
        <div className="grid lg:grid-cols-2 gap-6 mt-4">
          <div className="border hairline bg-card p-6 space-y-4 text-sm leading-relaxed">
            <p><b className="font-display uppercase">Why the angle matters.</b> The rafter leaves the wall plate at the roof pitch. Where it ends at the eaves you must choose a cut: a <b>plumb cut</b> makes the tail&apos;s end face vertical, so a standard vertical fascia board sits flat against it; a <b>level (square) cut</b> makes the end face horizontal, suiting a level soffit return. Most Nigerian residential work uses the plumb cut with a vertical fascia.</p>
            <p><b className="font-display uppercase">Birdsmouth basics.</b> Where the rafter sits on the wall plate it is notched — the birdsmouth: a horizontal seat cut that bears on the plate and a vertical heel cut against the plate&apos;s face. The seat carries the load; keep the notch shallow (rule of thumb: no more than about a third of the rafter depth) so the tail stays strong.</p>
            <p><b className="font-display uppercase">The geometry.</b> Measure the overhang <i>along the slope</i> from the outside wall face to the tail end. Its horizontal reach (what shades the wall, and what the soffit must cover) is that length × cos(pitch); its vertical drop is × sin(pitch). The plumb-cut face tilts by exactly the pitch, so the fascia board&apos;s exposed height is the rafter depth ÷ cos(pitch) — a 150mm rafter at 30° needs about 173mm of fascia cover, which is why 200mm fascia boards are the safe buy at steep pitches.</p>
          </div>
          <div className="border hairline bg-card p-6">
            <h3 className="font-display font-bold uppercase text-xl">Eaves angle calculator</h3>
            <div className="flex gap-2 mt-4">{([["pitch", "Pitch (°)"], ["riserun", "Rise / Run"]] as const).map(([v, l]) => (<button key={v} onClick={() => setUseRiseRun(v === "riserun")} className={`px-3 py-2 font-tech text-xs border cursor-pointer ${(useRiseRun === (v === "riserun")) ? "bg-primary text-primary-foreground border-primary" : "hairline hover:text-primary"}`}>{l}</button>))}</div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              {!useRiseRun
                ? <div><label className="label-tech">Roof pitch (degrees)</label><input type="number" step="0.5" value={pitch} onChange={e => setPitch(parseFloat(e.target.value) || 0)} className="field-tech font-tech" /></div>
                : (<><div><label className="label-tech">Rise (m)</label><input type="number" step="0.01" value={rise} onChange={e => setRise(parseFloat(e.target.value) || 0)} className="field-tech font-tech" /></div><div><label className="label-tech">Run (m)</label><input type="number" step="0.01" value={run} onChange={e => setRun(parseFloat(e.target.value) || 0)} className="field-tech font-tech" /></div></>)}
              <div><label className="label-tech">Overhang along slope (m)</label><input type="number" step="0.05" value={slopeOv} onChange={e => setSlopeOv(parseFloat(e.target.value) || 0)} className="field-tech font-tech" /></div>
              <div><label className="label-tech">Rafter depth (mm)</label><input type="number" step="5" value={rafterMm} onChange={e => setRafterMm(parseFloat(e.target.value) || 0)} className="field-tech font-tech" /></div>
            </div>
            <p className="font-tech text-[11px] text-muted-foreground mt-3">Overhang is measured ALONG THE SLOPE from the outside wall face to the rafter tail end. Fascia thickness allowed at 25mm for the soffit width.</p>
            <div className="border-t hairline mt-5 pt-4 font-tech text-sm space-y-2">
              <p>Pitch used: <b className="text-primary">{effPitch.toFixed(1)}°</b></p>
              <p>Horizontal eaves projection: <b className="text-primary">{ev.projectionM.toFixed(3)} m</b> <span className="text-muted-foreground">({(ev.projectionM * 1000).toFixed(0)}mm — how far the roof shades past the wall)</span></p>
              <p>Vertical drop over the overhang: <b className="text-primary">{ev.dropM.toFixed(3)} m</b></p>
              <p>Plumb-cut angle: <b className="text-primary">{ev.plumbCutDeg.toFixed(1)}°</b> <span className="text-muted-foreground">(set the saw to the pitch)</span></p>
              <p>Fascia height exposure: <b className="text-primary">{(ev.fasciaExposureM * 1000).toFixed(0)}mm</b> <span className="text-muted-foreground">(rafter depth ÷ cos(pitch) — pick the next fascia board size up)</span></p>
              <p>Soffit board width: <b className="text-primary">{(ev.soffitWidthM * 1000).toFixed(0)}mm</b> <span className="text-muted-foreground">(projection less 25mm fascia)</span></p>
            </div>
          </div>
        </div>
      </section>

      <section className="border hairline bg-card p-6 flex flex-wrap gap-3 items-center justify-between">
        <p className="font-display font-semibold uppercase">Put it to work</p>
        <div className="flex flex-wrap gap-3">
          <Link to="/quote" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-display font-semibold uppercase tracking-wider px-5 h-11 hover:bg-primary/90">Pro Roof Calculator <ArrowRight className="h-4 w-4" /></Link>
          <Link to="/visualizer" className="inline-flex items-center gap-2 border border-foreground/40 font-display font-semibold uppercase tracking-wider px-5 h-11 hover:border-primary hover:text-primary">Visualizer Studio</Link>
          <Link to="/workspace" className="inline-flex items-center gap-2 border border-foreground/40 font-display font-semibold uppercase tracking-wider px-5 h-11 hover:border-primary hover:text-primary">Pro Workspace</Link>
          <Link to="/documents" className="inline-flex items-center gap-2 border border-foreground/40 font-display font-semibold uppercase tracking-wider px-5 h-11 hover:border-primary hover:text-primary">Pro Documents</Link>
        </div>
      </section>
    </div></div>);
}
