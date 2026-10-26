// Parametric installation sketches for the Pro Guide. Every number printed
// on a sketch is computed from the visitor's inputs or read from the
// pattern/detail data — nothing is a hardcoded "accurate" figure. All
// sketches carry the honesty caption: not to scale.
import { eavesCalc } from "@/data/roofingGuide";
import { gutterFall, overlapSummary, slopeDims, VALLEY_TRAY_WIDTH_MM, type RoofPattern } from "@/data/roofPatterns";

const INK = "#e8e4da"; const DIM = "#FF6026"; const MUT = "#9c978c"; const LINE = "#4a463f";
const txt = { fill: INK, fontSize: 12, fontFamily: "IBM Plex Mono, monospace" } as const;
const dim = { fill: DIM, fontSize: 12, fontFamily: "IBM Plex Mono, monospace", fontWeight: 700 } as const;
const mut = { fill: MUT, fontSize: 11, fontFamily: "IBM Plex Mono, monospace" } as const;

export function SketchCaption() {
  return <p className="font-tech text-[11px] text-muted-foreground mt-2">Sketch — not to scale; measurements as entered/typical. Confirm on site.</p>;
}

/** (a) Sheet-overlap cross-section on the true slope angle. */
export function OverlapSketch({ pattern, sheetLengthM, pitchDeg, overhangM }: { pattern: RoofPattern; sheetLengthM: number; pitchDeg: number; overhangM: number }) {
  const dims = slopeDims(sheetLengthM, pitchDeg);
  const eaves = eavesCalc(pitchDeg, overhangM);
  const rad = (pitchDeg * Math.PI) / 180;
  // Geometry: eave (wall line) at x=150; slope drawn 300px long.
  const SLOPE = 300;
  const eave = { x: 150, y: 300 };
  const dx = Math.cos(rad), dy = -Math.sin(rad);
  const along = (t: number) => ({ x: eave.x + dx * SLOPE * t, y: eave.y + dy * SLOPE * t });
  const ridge = along(1);
  const oh = along(-Math.min(0.22, overhangM / Math.max(sheetLengthM, 1) * 0.9 + 0.05)); // overhang stub past eave
  // End-lap zone: the last (endMm of slope length) of the upper sheet.
  const lapFrac = pattern.overlapMm.endMm ? Math.min(0.3, Math.max(0.06, (pattern.overlapMm.endMm / 1000) / Math.max(sheetLengthM, 0.5))) : 0;
  const lapStart = along(0.55); const lapEnd = along(0.55 + lapFrac);
  const off = { x: -Math.sin(rad) * 7, y: -Math.cos(rad) * 7 }; // sheet thickness offset (up-slope normal)
  return (
    <svg viewBox="0 0 640 400" className="w-full border hairline bg-black/30" role="img" aria-label={`Overlap cross-section for ${pattern.name}`}>
      {/* wall */}
      <line x1={eave.x} y1={eave.y - 190} x2={eave.x} y2={372} stroke={LINE} strokeDasharray="5 5" />
      <text x={eave.x - 8} y={386} {...mut} textAnchor="middle">wall line</text>
      {/* lower sheet (eaves sheet) */}
      <line x1={oh.x} y1={oh.y} x2={lapEnd.x} y2={lapEnd.y} stroke={INK} strokeWidth={3} />
      {/* upper sheet, offset, overlapping the lap zone */}
      <line x1={lapStart.x + off.x} y1={lapStart.y + off.y} x2={ridge.x + off.x} y2={ridge.y + off.y} stroke={DIM} strokeWidth={3} />
      {/* lap bracket */}
      <line x1={lapStart.x} y1={lapStart.y + 26} x2={lapEnd.x} y2={lapEnd.y + 26} stroke={DIM} strokeWidth={1.5} />
      <text x={(lapStart.x + lapEnd.x) / 2} y={lapStart.y + 46} {...dim} textAnchor="middle">
        {pattern.overlapMm.endMm ? `end lap ${pattern.overlapMm.endMm}mm` : "seamed joint"}
      </text>
      {/* pitch arc */}
      <path d={`M ${eave.x + 62} ${eave.y} A 62 62 0 0 0 ${eave.x + 62 * dx} ${eave.y + 62 * dy}`} fill="none" stroke={DIM} strokeWidth={1.5} />
      <text x={eave.x + 76} y={eave.y - 8} {...dim}>{pitchDeg}° pitch</text>
      {/* fascia at eave */}
      <line x1={oh.x} y1={oh.y} x2={oh.x} y2={oh.y + 34} stroke={INK} strokeWidth={4} />
      <text x={oh.x - 4} y={oh.y + 52} {...txt}>fascia</text>
      <text x={oh.x - 4} y={oh.y + 68} {...mut}>eaves line</text>
      {/* dims readouts */}
      <text x={16} y={30} {...txt}>Sheet (slope) length: <tspan {...dim}>{sheetLengthM.toFixed(2)}m</tspan></text>
      <text x={16} y={52} {...txt}>Covers horizontally: <tspan {...dim}>{dims.horizontalM.toFixed(2)}m</tspan> · rises: <tspan {...dim}>{dims.verticalM.toFixed(2)}m</tspan> · slope factor {dims.slopeFactor}</text>
      <text x={16} y={74} {...txt}>Overhang {overhangM.toFixed(2)}m along slope → projects <tspan {...dim}>{eaves.projectionM.toFixed(2)}m</tspan>, drops <tspan {...dim}>{eaves.dropM.toFixed(2)}m</tspan></text>
      <text x={16} y={96} {...txt}>{overlapSummary(pattern)}</text>
      {pattern.overlapMm.sideMm ? <text x={16} y={118} {...mut}>{pattern.overlapMm.note}</text> : null}
      <text x={ridge.x - 10} y={ridge.y - 14} {...txt}>ridge →</text>
    </svg>
  );
}

/** (b) Valley detail — two slopes meeting over the tray. */
export function ValleySketch({ trayWidthMm = VALLEY_TRAY_WIDTH_MM }: { trayWidthMm?: number }) {
  const half = 70; // px half-width of tray (schematic)
  const cx = 320;
  return (
    <svg viewBox="0 0 640 300" className="w-full border hairline bg-black/30" role="img" aria-label="Valley detail sketch">
      <polyline points={`60,60 ${cx - half},210 ${cx - 26},228 ${cx + 26},228 ${cx + half},210 580,60`} fill="none" stroke={INK} strokeWidth={3} />
      <line x1={cx - half} y1={196} x2={cx + half} y2={196} stroke={DIM} strokeWidth={2} />
      <text x={cx} y={186} {...dim} textAnchor="middle">valley tray {trayWidthMm}mm wide (typical 450–600)</text>
      <text x={88} y={48} {...txt}>slope A</text>
      <text x={520} y={48} {...txt}>slope B</text>
      <text x={cx} y={262} {...txt} textAnchor="middle">tiles/sheets held 100–150mm clear of the centre — open waterway</text>
      <text x={cx} y={282} {...mut} textAnchor="middle">tray laps 300mm sealed · underlay +150mm each side · no fixings in the waterway</text>
    </svg>
  );
}

/** (c) Gutter fall diagram — drop computed from run × fall ratio. */
export function GutterSketch({ runM, ratioDenominator }: { runM: number; ratioDenominator: number }) {
  const fall = gutterFall(runM, ratioDenominator);
  const dropPx = Math.max(8, Math.min(64, fall.dropMm * 1.1));
  return (
    <svg viewBox="0 0 640 260" className="w-full border hairline bg-black/30" role="img" aria-label="Gutter fall diagram">
      <line x1={60} y1={70} x2={580} y2={70} stroke={LINE} strokeDasharray="5 5" />
      <line x1={60} y1={70} x2={580} y2={70 + dropPx} stroke={DIM} strokeWidth={3.5} />
      {[60, 190, 320, 450, 580].map(x => (<line key={x} x1={x} y1={52} x2={x} y2={70 + (x - 60) / 520 * dropPx} stroke={INK} strokeWidth={1.5} />))}
      <line x1={596} y1={70} x2={596} y2={70 + dropPx} stroke={DIM} strokeWidth={1.5} />
      <text x={604} y={76 + dropPx / 2} {...dim}>{fall.dropMm}mm</text>
      <text x={60} y={40} {...txt}>high end (level line dashed)</text>
      <text x={580} y={110 + dropPx} {...txt} textAnchor="end">outlet → downpipe</text>
      <text x={60} y={216} {...txt}>Run {runM}m at fall {fall.ratioLabel} → total drop <tspan {...dim}>{fall.dropMm}mm</tspan> ({fall.dropPerM}mm per metre)</text>
      <text x={60} y={238} {...mut}>Guide practice for typical runs is 1:350–1:600 — test your run here before you fix brackets.</text>
    </svg>
  );
}

/** Ridge cross-section. */
export function RidgeSketch() {
  return (
    <svg viewBox="0 0 640 280" className="w-full border hairline bg-black/30" role="img" aria-label="Ridge detail sketch">
      <polyline points="60,220 290,90 350,90 580,220" fill="none" stroke={INK} strokeWidth={3} />
      <path d="M 268 96 Q 320 56 372 96" fill="none" stroke={DIM} strokeWidth={4} />
      <text x={320} y={44} {...dim} textAnchor="middle">ridge cap — girth 400–600mm</text>
      <text x={320} y={150} {...txt} textAnchor="middle">profile closers under the cap, both sides</text>
      <text x={320} y={248} {...mut} textAnchor="middle">cap laps ≥100mm, facing away from the weather · fix both sides into the crest line</text>
    </svg>
  );
}

/** Flashing cross-section at a wall junction. */
export function FlashingSketch() {
  return (
    <svg viewBox="0 0 640 300" className="w-full border hairline bg-black/30" role="img" aria-label="Flashing detail sketch">
      <rect x={430} y={30} width={150} height={240} fill="none" stroke={LINE} strokeWidth={2} />
      <text x={505} y={290} {...mut} textAnchor="middle">wall</text>
      <polyline points="60,240 398,140" fill="none" stroke={INK} strokeWidth={3} />
      <polyline points="380,146 430,132 430,60" fill="none" stroke={DIM} strokeWidth={3.5} />
      <line x1={452} y1={60} x2={452} y2={118} stroke={DIM} strokeWidth={2} />
      <text x={462} y={112} {...dim}>upstand ≥150mm</text>
      <line x1={430} y1={44} x2={520} y2={44} stroke={DIM} strokeWidth={1.5} />
      <text x={524} y={48} {...txt}>cover flashing chased 25mm into the joint</text>
      <text x={60} y={272} {...mut}>sheeting dressed up ≥75mm under the flashing · sealant is the backup, never the system</text>
    </svg>
  );
}

/** Fascia & soffit cross-section at the eaves. */
export function FasciaSketch({ overhangM = 0.6 }: { overhangM?: number }) {
  return (
    <svg viewBox="0 0 640 300" className="w-full border hairline bg-black/30" role="img" aria-label="Fascia and soffit sketch">
      <line x1={330} y1={40} x2={330} y2={270} stroke={LINE} strokeDasharray="5 5" />
      <text x={330} y={288} {...mut} textAnchor="middle">wall line</text>
      <polyline points="120,120 560,26" fill="none" stroke={INK} strokeWidth={3} />
      <line x1={128} y1={118} x2={128} y2={176} stroke={DIM} strokeWidth={5} />
      <text x={118} y={200} {...dim} textAnchor="middle">fascia</text>
      <line x1={128} y1={176} x2={330} y2={176} stroke={INK} strokeWidth={3} />
      <text x={228} y={196} {...txt} textAnchor="middle">soffit boards, level to the wall</text>
      <line x1={128} y1={222} x2={330} y2={222} stroke={DIM} strokeWidth={1.5} />
      <text x={228} y={242} {...dim} textAnchor="middle">overhang {overhangM.toFixed(2)}m as entered (typical 450–600mm)</text>
      <text x={470} y={70} {...mut}>vent gap 10–25mm at wall junction</text>
    </svg>
  );
}

export function SketchFor({ kind, pattern, sheetLengthM, pitchDeg, overhangM, runM, ratioDenominator }: {
  kind: RoofPattern["sketchKind"]; pattern?: RoofPattern;
  sheetLengthM: number; pitchDeg: number; overhangM: number; runM: number; ratioDenominator: number;
}) {
  if (kind === "valley") return <ValleySketch />;
  if (kind === "gutter") return <GutterSketch runM={runM} ratioDenominator={ratioDenominator} />;
  if (kind === "ridge") return <RidgeSketch />;
  if (kind === "flashing") return <FlashingSketch />;
  if (kind === "fascia") return <FasciaSketch overhangM={overhangM} />;
  if (pattern) return <OverlapSketch pattern={pattern} sheetLengthM={sheetLengthM} pitchDeg={pitchDeg} overhangM={overhangM} />;
  return <ValleySketch />;
}

// ---------------- Cabinet elevation (Interior & Cabinetry) ----------------
// The one non-roofing sketch: a run of base + wall units. Unit divisions
// come from cabinetUnits() (last unit absorbs the remainder, drawn at its
// true width); every printed dimension is an input or a stated standard.
import { useState } from "react";
import { cabinetUnits } from "@/data/tradeGuides";

export function CabinetSketch({ runM, unitWidthMm, wallUnitHeightMm }: { runM: number; unitWidthMm: number; wallUnitHeightMm: number }) {
  const { units, lastUnitMm } = cabinetUnits(runM, unitWidthMm);
  const runMm = Math.max(0, Math.round(runM * 1000));
  const BASE_H = 900, GAP = 550; // stated standards: worktop height + splashback zone
  const totalH = BASE_H + GAP + wallUnitHeightMm;
  const X0 = 70, X1 = 610, Y_TOP = 36, Y_FLOOR = 300;
  const pxPerMmX = runMm > 0 ? (X1 - X0) / runMm : 1;
  const pxPerMmY = (Y_FLOOR - Y_TOP) / Math.max(totalH, 1);
  const yOf = (mmFromFloor: number) => Y_FLOOR - mmFromFloor * pxPerMmY;
  const widths: number[] = [];
  for (let i = 0; i < units; i++) widths.push(i === units - 1 ? lastUnitMm : unitWidthMm);
  let cx = X0;
  const baseUnits = widths.map((w, i) => { const x = cx; cx += w * pxPerMmX; return { x, wPx: w * pxPerMmX, mm: w, i }; });
  cx = X0;
  const wallUnits = widths.map((w, i) => { const x = cx; cx += w * pxPerMmX; return { x, wPx: w * pxPerMmX, mm: w, i }; });
  return (
    <svg viewBox="0 0 680 360" className="w-full border hairline bg-black/30" role="img" aria-label="Cabinet elevation sketch">
      {/* wall units */}
      {wallUnits.map(u => (<g key={`w${u.i}`}>
        <rect x={u.x} y={yOf(BASE_H + GAP + wallUnitHeightMm)} width={u.wPx} height={wallUnitHeightMm * pxPerMmY} fill="none" stroke={INK} strokeWidth={2} />
        <line x1={u.x + u.wPx / 2} y1={yOf(BASE_H + GAP + wallUnitHeightMm) + 4} x2={u.x + u.wPx / 2} y2={yOf(BASE_H + GAP) - 4} stroke={LINE} strokeWidth={1} />
      </g>))}
      {/* worktop */}
      <rect x={X0 - 6} y={yOf(BASE_H) - 4} width={(X1 - X0) + 12} height={5} fill={DIM} />
      {/* base units */}
      {baseUnits.map(u => (<g key={`b${u.i}`}>
        <rect x={u.x} y={yOf(BASE_H)} width={u.wPx} height={(BASE_H - 120) * pxPerMmY} fill="none" stroke={INK} strokeWidth={2} />
        {u.i === 0
          ? <line x1={u.x + 3} y1={yOf(BASE_H) + (BASE_H - 120) * pxPerMmY * 0.28} x2={u.x + u.wPx - 3} y2={yOf(BASE_H) + (BASE_H - 120) * pxPerMmY * 0.28} stroke={LINE} strokeWidth={1.5} />
          : <line x1={u.x + u.wPx / 2} y1={yOf(BASE_H) + 4} x2={u.x + u.wPx / 2} y2={yOf(120) - 4} stroke={LINE} strokeWidth={1} />}
      </g>))}
      {/* plinth + floor */}
      <rect x={X0 + 8} y={yOf(120)} width={(X1 - X0) - 16} height={120 * pxPerMmY} fill="none" stroke={LINE} strokeWidth={1.5} />
      <line x1={30} y1={Y_FLOOR} x2={650} y2={Y_FLOOR} stroke={INK} strokeWidth={2} />
      {/* dims */}
      <line x1={X0} y1={Y_FLOOR + 22} x2={X1} y2={Y_FLOOR + 22} stroke={DIM} strokeWidth={1.5} />
      <text x={(X0 + X1) / 2} y={Y_FLOOR + 42} {...dim} textAnchor="middle">run {runM.toFixed(2)}m — {units} unit{units === 1 ? "" : "s"}{units > 1 ? ` (${unitWidthMm}mm modules, last ${lastUnitMm}mm)` : ""}</text>
      <text x={X1 + 12} y={yOf(BASE_H + GAP + wallUnitHeightMm) + 4} {...txt}>wall unit {wallUnitHeightMm}mm</text>
      <text x={X1 + 12} y={yOf(BASE_H + GAP / 2)} {...mut}>gap {GAP}mm</text>
      <text x={X1 + 12} y={yOf(BASE_H / 2)} {...txt}>base {BASE_H}mm to worktop</text>
      <text x={X0} y={22} {...mut}>front elevation — doors/drawer lines shown per unit</text>
    </svg>
  );
}

export function CabinetSketchPanel() {
  const [runM, setRunM] = useState(3);
  const [unitWidthMm, setUnitWidthMm] = useState(600);
  const [wallUnitHeightMm, setWallUnitHeightMm] = useState(720);
  return (
    <div className="border hairline bg-card p-5">
      <p className="label-tech mb-3">Cabinet elevation sketch — set your run</p>
      <div className="grid grid-cols-3 gap-4 max-w-2xl mb-4">
        <div><label className="label-tech">Run length (m)</label><input type="number" step="0.1" min="0.6" value={runM} onChange={e => setRunM(parseFloat(e.target.value) || 0)} className="field-tech font-tech" /></div>
        <div><label className="label-tech">Unit width (mm)</label>
          <select value={unitWidthMm} onChange={e => setUnitWidthMm(Number(e.target.value))} className="field-tech font-tech bg-background w-full">
            {[300, 400, 450, 500, 600, 900].map(w => <option key={w} value={w}>{w}mm{w === 600 ? " (standard module)" : ""}</option>)}
          </select></div>
        <div><label className="label-tech">Wall unit height (mm)</label><input type="number" step="10" min="300" value={wallUnitHeightMm} onChange={e => setWallUnitHeightMm(parseFloat(e.target.value) || 720)} className="field-tech font-tech" /></div>
      </div>
      <CabinetSketch runM={runM} unitWidthMm={unitWidthMm} wallUnitHeightMm={wallUnitHeightMm} />
      <p className="font-tech text-[11px] text-muted-foreground mt-2">Sketch — not to scale; dimensions as entered. Base height 900mm to worktop and a 550mm splashback gap are the stated standards drawn here.</p>
    </div>
  );
}
