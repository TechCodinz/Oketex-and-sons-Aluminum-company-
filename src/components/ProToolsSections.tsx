import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { getBusiness, businessWaLink } from "@/lib/settings";
import {
  parseMeasurementToMetres, metresToImperial, diagonalOf, checkSquare,
  optimizeCuts, blockEstimate, concreteEstimate, type CutReq,
} from "@/lib/proTools";

function Num({ label, value, set, step = "0.1" }: { label: string; value: number; set: (n: number) => void; step?: string }) {
  return (<div><label className="label-tech">{label}</label><input type="number" step={step} value={value} onChange={e => set(parseFloat(e.target.value) || 0)} className="field-tech font-tech" /></div>);
}
function Section({ id, title, children, result }: { id: string; title: string; children: ReactNode; result?: ReactNode }) {
  return (<section id={id} className="border hairline bg-card p-6 scroll-mt-32"><h3 className="font-display font-bold uppercase text-xl">{title}</h3><div className="mt-5">{children}</div>{result && <div className="mt-5 border-t hairline pt-4 font-tech text-sm space-y-1">{result}</div>}</section>);
}
const fmt = (n: number, d = 2) => n.toLocaleString("en-NG", { minimumFractionDigits: d, maximumFractionDigits: d });

// ---------------- (f) Tape & Fraction Converter ----------------
function TapeStrip({ metres }: { metres: number }) {
  const ranges = [1, 2, 3, 5, 8, 10, 15, 20, 30, 50];
  const range = ranges.find(r => r >= metres * 1.15) ?? 50;
  const X = (v: number) => 40 + (v / range) * 556;
  const topTicks = Array.from({ length: 51 }, (_, i) => (range / 50) * i);
  const totalIn = range / 0.0254;
  const inStep = totalIn > 260 ? 6 : totalIn > 130 ? 3 : 1;
  const inTicks: number[] = []; for (let i = 0; i <= totalIn; i += inStep) inTicks.push(i);
  const mx = X(Math.min(metres, range));
  return (<svg viewBox="0 0 640 118" className="w-full mt-4 border hairline bg-background" role="img" aria-label="Tape measure visual">
    <rect x="0" y="34" width="640" height="26" fill="#F5C518" opacity="0.9" />
    {topTicks.map((v, i) => (<g key={i}><line x1={X(v)} y1="34" x2={X(v)} y2={i % 5 === 0 ? 48 : 42} stroke="#222" strokeWidth="1" />{i % 10 === 0 && <text x={X(v)} y="28" fontSize="9" fill="#999" textAnchor="middle" fontFamily="monospace">{v.toFixed(v < 1 ? 1 : 0)}m</text>}</g>))}
    {inTicks.map((inch, i) => { const v = inch * 0.0254; return (<g key={i}><line x1={X(v)} y1="60" x2={X(v)} y2={inch % 12 === 0 ? 46 : 53} stroke="#222" strokeWidth="1" />{inch % 12 === 0 && <text x={X(v)} y="72" fontSize="9" fill="#999" textAnchor="middle" fontFamily="monospace">{inch / 12}ft</text>}</g>); })}
    <line x1={mx} y1="8" x2={mx} y2="80" stroke="#FF6026" strokeWidth="2.5" />
    <polygon points={`${mx - 5},8 ${mx + 5},8 ${mx},16`} fill="#FF6026" />
    <text x={Math.min(Math.max(mx, 90), 550)} y="96" fontSize="11" fill="#FF6026" textAnchor="middle" fontFamily="monospace">{metres.toFixed(3)} m</text>
    <text x="40" y="112" fontSize="9" fill="#777" fontFamily="monospace">Top scale: metres · Bottom scale: feet — tape shown to {range} m</text>
  </svg>);
}
function TapeConverter() {
  const [raw, setRaw] = useState(`12' 7 3/8"`);
  const [den, setDen] = useState<8 | 16 | 32>(16);
  const metres = parseMeasurementToMetres(raw);
  const imp = metres !== null ? metresToImperial(metres, den) : null;
  return (<Section id="tape" title="(f) Tape & Fraction Converter — the tape measuring system" result={metres !== null && imp ? (<>
    <p>Metres: <b className="text-primary">{metres.toFixed(4)} m</b> · Millimetres: {(metres * 1000).toLocaleString("en-NG", { maximumFractionDigits: 1 })} mm</p>
    <p>Decimal feet: {(metres / 0.3048).toFixed(4)} ft · Total inches: {imp.totalInches.toFixed(3)} in</p>
    <p>Tape reading (nearest 1/{den}): <b className="text-primary">{imp.text}</b></p>
    <p className="text-muted-foreground text-xs">Type any form: 12' 7 3/8" · 12 ft 7 3/8 in · 3851 (bare number = mm) · 385.1cm · 3.851m. Fractions are reduced (e.g. 4/16 shows as 1/4).</p>
  </>) : (<p className="text-red-400">Could not read that measurement — try 12' 7 3/8" or 3851mm.</p>)}>
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 sm:col-span-1"><label className="label-tech">Measurement (any form)</label><input value={raw} onChange={e => setRaw(e.target.value)} className="field-tech font-tech" placeholder={`12' 7 3/8"`} /></div>
      <div><label className="label-tech">Fraction precision</label><select value={den} onChange={e => setDen(Number(e.target.value) as 8 | 16 | 32)} className="field-tech font-tech bg-background w-full"><option value={8}>Nearest 1/8"</option><option value={16}>Nearest 1/16"</option><option value={32}>Nearest 1/32"</option></select></div>
    </div>
    {metres !== null && <TapeStrip metres={metres} />}
  </Section>);
}

// ---------------- (g) Square & Diagonal Check ----------------
function SquareCheck() {
  const [l, setL] = useState(10); const [w, setW] = useState(8);
  const [da, setDa] = useState(12.8); const [db, setDb] = useState(12.803);
  const expected = diagonalOf(l, w);
  const chk = checkSquare(l, w, da, db);
  return (<Section id="square" title="(g) Square & Diagonal Check" result={<>
    <p>True diagonal for {l}m × {w}m: <b className="text-primary">{expected.toFixed(3)} m</b> ( √(L² + W²) )</p>
    <p>Your diagonals differ by <b className={chk.square ? "text-emerald-400" : "text-red-400"}>{chk.diffMm.toFixed(0)} mm</b> — tolerance ≤{chk.toleranceMm.toFixed(0)}mm → {chk.square ? "SQUARE ✓ — proceed" : "NOT square — adjust a corner and re-measure"}</p>
    <p className="text-muted-foreground text-xs">Pro rule: diagonals of a true rectangle are equal. ≤5mm difference per 10m of length is professional-square.</p>
  </>}>
    <div className="grid grid-cols-2 gap-4">
      <Num label="Length (m)" value={l} set={setL} /><Num label="Width (m)" value={w} set={setW} />
      <Num label="Measured diagonal A (m)" value={da} set={setDa} step="0.01" /><Num label="Measured diagonal B (m)" value={db} set={setDb} step="0.01" />
    </div>
    <div className="flex flex-wrap gap-6 items-center mt-5">
      <svg viewBox="0 0 150 120" className="w-[150px] border hairline bg-background" role="img" aria-label="3-4-5 triangle">
        <polygon points="15,100 115,100 15,25" fill="rgba(255,96,38,0.15)" stroke="#FF6026" strokeWidth="1.5" />
        <rect x="15" y="88" width="12" height="12" fill="none" stroke="#999" />
        <text x="60" y="114" fontSize="10" fill="#ccc" textAnchor="middle" fontFamily="monospace">4 m</text>
        <text x="6" y="60" fontSize="10" fill="#ccc" fontFamily="monospace" transform="rotate(-90 10 62)">3 m</text>
        <text x="72" y="52" fontSize="10" fill="#FF6026" fontFamily="monospace">5 m</text>
      </svg>
      <p className="font-tech text-xs text-muted-foreground max-w-sm">THE 3-4-5 METHOD: mark 3m along one wall line and 4m along the adjoining line from the corner. If the distance between the two marks is exactly 5m, the corner is a perfect 90°. Scale it up (6-8-10) for big layouts — bigger triangles, smaller error.</p>
    </div>
  </Section>);
}

// ---------------- (h) Cut-Length Optimizer ----------------
const PIECE_COLOURS = ["#FF6026", "#FF9F2F", "#4EA8FF", "#7BC47F", "#C792EA", "#FF6B81", "#4DD0E1", "#FFD54F"];
function CutOptimizer() {
  const [stockSel, setStockSel] = useState("6.0"); const [customStock, setCustomStock] = useState(6);
  const [kerf, setKerf] = useState(3);
  const [cuts, setCuts] = useState<CutReq[]>([{ length: 2.4, qty: 4 }, { length: 1.8, qty: 3 }, { length: 1.2, qty: 5 }]);
  const stock = stockSel === "custom" ? customStock : parseFloat(stockSel);
  const plan = useMemo(() => optimizeCuts(stock || 0, kerf, cuts), [stock, kerf, cuts]);
  const colourOf = (len: number) => { const uniq = [...new Set(cuts.map(c => c.length))].sort((a, b) => b - a); return PIECE_COLOURS[Math.max(0, uniq.indexOf(len)) % PIECE_COLOURS.length]; };
  const patch = (i: number, p: Partial<CutReq>) => setCuts(cs => cs.map((c, x) => (x === i ? { ...c, ...p } : c)));
  return (<Section id="cut" title="(h) Cut-Length Optimizer — timber, profiles, pipes" result={<>
    <p>Stock bars needed: <b className="text-primary">{plan.barCount}</b> × {stock}m = {plan.totalStock.toFixed(1)}m bought · Cuts total {plan.totalPiecesLen.toFixed(2)}m</p>
    <p>Waste: <b className="text-primary">{plan.wastePct.toFixed(1)}%</b> (incl. kerf) · Reusable offcuts (≥0.3m): {plan.offcuts.length ? plan.offcuts.map(o => o.toFixed(2) + "m").join(", ") : "none"}</p>
    {plan.oversize.length > 0 && <p className="text-red-400">Warning: {plan.oversize.length} cut(s) longer than the stock length — increase stock or split the cut.</p>}
    <p className="text-muted-foreground text-xs">First-fit decreasing packing: longest cuts placed first into the earliest bar they fit. Kerf = blade thickness lost per cut.</p>
  </>}>
    <div className="grid grid-cols-2 gap-4">
      <div><label className="label-tech">Stock length (m)</label><select value={stockSel} onChange={e => setStockSel(e.target.value)} className="field-tech font-tech bg-background w-full">{["3.6", "4.2", "4.8", "5.4", "6.0"].map(s => <option key={s} value={s}>{s} m</option>)}<option value="custom">Custom…</option></select></div>
      {stockSel === "custom" ? <Num label="Custom stock (m)" value={customStock} set={setCustomStock} /> : <Num label="Kerf / blade (mm)" value={kerf} set={setKerf} step="0.5" />}
      {stockSel === "custom" && <Num label="Kerf / blade (mm)" value={kerf} set={setKerf} step="0.5" />}
    </div>
    <div className="mt-5 space-y-2">
      {cuts.map((c, i) => (<div key={i} className="flex gap-3 items-end">
        <div className="flex-1"><label className="label-tech">Cut length (m)</label><input type="number" step="0.05" value={c.length} onChange={e => patch(i, { length: parseFloat(e.target.value) || 0 })} className="field-tech font-tech" /></div>
        <div className="w-24"><label className="label-tech">Qty</label><input type="number" step="1" value={c.qty} onChange={e => patch(i, { qty: parseFloat(e.target.value) || 0 })} className="field-tech font-tech" /></div>
        <button className="text-muted-foreground hover:text-red-400 font-tech pb-3" aria-label="Remove cut" onClick={() => setCuts(cs => cs.filter((_, x) => x !== i))}>✕</button>
      </div>))}
      <button className="font-tech text-xs uppercase tracking-widest text-primary" onClick={() => setCuts(cs => [...cs, { length: 1.0, qty: 1 }])}>+ Add cut</button>
    </div>
    <div className="mt-6 space-y-3">
      {plan.bars.map((bar, bi) => (<div key={bi}>
        <p className="font-tech text-[11px] text-muted-foreground mb-1">Bar {bi + 1} — used {bar.used.toFixed(2)}m · offcut {bar.offcut.toFixed(2)}m</p>
        <div className="flex h-7 border hairline overflow-hidden">
          {bar.pieces.map((p, pi) => (<div key={pi} className="h-full flex items-center justify-center font-tech text-[10px] text-black/80 border-r border-black/30 overflow-hidden" style={{ width: `${(p / stock) * 100}%`, background: colourOf(p) }}>{p}m</div>))}
          {bar.offcut > 0.01 && <div className="h-full bg-white/10 flex items-center justify-center font-tech text-[10px] text-muted-foreground" style={{ width: `${(bar.offcut / stock) * 100}%` }}>{bar.offcut.toFixed(2)}</div>}
        </div>
      </div>))}
    </div>
  </Section>);
}

// ---------------- (i) Block & Concrete Estimator ----------------
function BlockConcrete() {
  const [wl, setWl] = useState(10); const [wh, setWh] = useState(3); const [size, setSize] = useState<"9" | "6">("9");
  const blk = blockEstimate(wl, wh, size);
  const [sl, setSl] = useState(10); const [sw, setSw] = useState(8); const [th, setTh] = useState(150);
  const [mixSel, setMixSel] = useState("1:2:4");
  const mix = mixSel.split(":").map(Number) as [number, number, number];
  const conc = concreteEstimate(sl, sw, th, mix);
  return (<Section id="block-concrete" title="(i) Block & Concrete Estimator — site estimator, engineer to confirm" result={<>
    <div className="grid md:grid-cols-2 gap-6">
      <div><p className="font-display font-semibold uppercase">Wall result</p>
        <p>Wall area: {fmt(blk.area)} m² → blocks: <b className="text-primary">{blk.blocks.toLocaleString()}</b> ({size}" block)</p>
        <p className="text-muted-foreground text-xs">Blocks = area × 10/m² (450×225mm face + 10mm joint ≈ 9.9/m²) × 1.05 breakage. Raw: {blk.rawBlocks.toLocaleString()}.</p>
        <p>Mortar (estimator): {fmt(blk.mortarM3)} m³ at {blk.mortarPerM2} m³/m² for {size}" blockwork.</p></div>
      <div><p className="font-display font-semibold uppercase">Slab result — mix {mixSel}</p>
        <p>Wet volume: {fmt(conc.wetM3)} m³ · Dry volume ×1.54: {fmt(conc.dryM3)} m³</p>
        <p>Cement: <b className="text-primary">{conc.bags} bags</b> of 50kg ({conc.bagsExact.toFixed(1)} exact · {conc.cementKg.toLocaleString("en-NG", { maximumFractionDigits: 0 })} kg · {fmt(conc.cementM3)} m³ at 1440 kg/m³)</p>
        <p>Sharp sand: {fmt(conc.sandTonnes)} tonnes ({fmt(conc.sandM3)} m³ at 1600 kg/m³) · Granite: {fmt(conc.graniteTonnes)} tonnes ({fmt(conc.graniteM3)} m³ at 1550 kg/m³)</p>
        <p className="text-muted-foreground text-xs">Dry-volume method: split dry volume by ratio parts ({conc.parts}), then convert with standard densities. Site estimator only — your engineer confirms for structural work.</p></div>
    </div>
  </>}>
    <div className="grid md:grid-cols-2 gap-8">
      <div className="grid grid-cols-2 gap-4">
        <Num label="Wall length (m)" value={wl} set={setWl} /><Num label="Wall height (m)" value={wh} set={setWh} />
        <div><label className="label-tech">Block size</label><select value={size} onChange={e => setSize(e.target.value as "9" | "6")} className="field-tech font-tech bg-background w-full"><option value="9">9 inch (225mm)</option><option value="6">6 inch (150mm)</option></select></div><div />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Num label="Slab length (m)" value={sl} set={setSl} /><Num label="Slab width (m)" value={sw} set={setSw} />
        <Num label="Thickness (mm)" value={th} set={setTh} step="25" />
        <div><label className="label-tech">Mix ratio</label><select value={mixSel} onChange={e => setMixSel(e.target.value)} className="field-tech font-tech bg-background w-full"><option>1:2:4</option><option>1:3:6</option><option>1:1.5:3</option></select></div>
      </div>
    </div>
  </Section>);
}

// ---------------- (j) Pro Equipment Guide ----------------
const EQUIPMENT: { name: string; use: string; spec: string; toolLabel: string; toolTo: string }[] = [
  { name: "Laser distance measurer", use: "Point-and-shoot lengths, heights and room areas on site — one person, no tape sag.", spec: "±1.5mm accuracy · 40–100m range · area/volume memory", toolLabel: "Pairs with Snap-Measure", toolTo: "/snap-measure" },
  { name: "8m / 26ft tape measure", use: "Everyday lengths, openings and sheet checks.", spec: "Class II blade · 3m+ standout · metric + imperial face", toolLabel: "Tape & Fraction Converter", toolTo: "/tools#tape" },
  { name: "30m / 50m long tape (fibreglass)", use: "Plots, foundations and long spans no short tape can reach.", spec: "Fibreglass won't stretch like steel in heat · open-reel frame", toolLabel: "Square & Diagonal Check", toolTo: "/tools#square" },
  { name: "Digital angle finder / inclinometer", use: "Reading true roof pitch before ordering sheets.", spec: "0.1° resolution · magnetic base for steel", toolLabel: "Pitch Finder", toolTo: "/tools" },
  { name: "Chalk line reel", use: "Snapping straight cut lines and layout lines over long distances.", spec: "30m line · fast rewind · fine chalk for finished surfaces", toolLabel: "Square & Diagonal Check", toolTo: "/tools#square" },
  { name: "Combination square / roofing (rafter) square", use: "Marking 90°/45° and rafter/purlin angles.", spec: "300mm blade · cast stock · etched graduations", toolLabel: "Pitch Finder", toolTo: "/tools" },
  { name: "Spirit level 1200mm & laser level", use: "Levels for wall plates, windows, ceilings and screeds.", spec: "Laser: self-levelling ±3mm/10m · green beam reads better outdoors", toolLabel: "Square & Diagonal Check", toolTo: "/tools#square" },
  { name: "Plumb bob", use: "Transferring points vertically — walls, columns, cladding lines.", spec: "300–500g steel bob · braided line won't twist", toolLabel: "Build A–Z Hub", toolTo: "/build" },
  { name: "Tile cutter (manual + wet saw)", use: "Straight and wet cuts on stone-coated and floor tiles.", spec: "Wet saw keeps stone-chip edges clean · spare diamond blade", toolLabel: "Block & Concrete Estimator", toolTo: "/tools#block-concrete" },
  { name: "Angle grinder 115mm", use: "Cutting ACP, profiles and light steel.", spec: "Use thin metal-cutting discs · guard on, eye protection on", toolLabel: "Cut-Length Optimizer", toolTo: "/tools#cut" },
  { name: "Cordless drill / driver + impact driver", use: "Self-drilling screws, fixings and fabrication.", spec: "18V brushless · torque clutch prevents over-driving EPDM screws", toolLabel: "Pro Roof Calculator", toolTo: "/quote" },
  { name: "Metal nibblers / aviation shears", use: "Cutting sheets without burning or peeling the colour coat.", spec: "Nibblers leave the factory edge intact · left/right snips for curves", toolLabel: "Cut-Length Optimizer", toolTo: "/tools#cut" },
  { name: "Safety kit — harness, gloves, boots, eye protection", use: "Roof work is falls work: harness, non-slip boots and gloves are not optional.", spec: "Full-body harness + anchor strap · cut-resistant gloves", toolLabel: "Book an installation crew", toolTo: "/book?service=installation" },
];
function EquipmentGuide() {
  return (<section id="equipment" className="scroll-mt-32">
    <div className="flex items-end justify-between flex-wrap gap-3 mb-5"><div><p className="font-tech text-[11px] uppercase tracking-[0.3em] text-primary">Pro Equipment Guide</p><h3 className="font-display font-bold uppercase text-2xl md:text-3xl mt-1">The kit the pros measure with</h3></div><p className="font-tech text-[11px] text-muted-foreground max-w-sm">No prices listed — specs only. Ask us on WhatsApp to supply any item with your materials order.</p></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {EQUIPMENT.map(e => (<div key={e.name} className="border hairline bg-card p-5">
        <h4 className="font-display font-bold uppercase text-lg leading-tight">{e.name}</h4>
        <p className="text-sm text-muted-foreground mt-2">{e.use}</p>
        <p className="font-tech text-[11px] mt-3 border-t hairline pt-3">PRO SPEC — {e.spec}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Link to={e.toolTo} className="font-tech text-[11px] uppercase tracking-widest border hairline px-3 py-2 hover:text-primary hover:border-primary">Used for: {e.toolLabel}</Link>
          <a target="_blank" rel="noreferrer" href={businessWaLink(`Hello Oketex, please quote supply of: ${e.name}`)} className="font-tech text-[11px] uppercase tracking-widest border border-primary/50 text-primary px-3 py-2 hover:bg-primary hover:text-primary-foreground">Ask for supply</a>
        </div>
      </div>))}
    </div>
  </section>);
}

export default function ProToolsSections() {
  return (<>
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-6 grid lg:grid-cols-2 gap-6">
      <TapeConverter /><SquareCheck />
    </div>
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-6 grid gap-6">
      <CutOptimizer /><BlockConcrete />
    </div>
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-14"><EquipmentGuide /></div>
  </>);
}
