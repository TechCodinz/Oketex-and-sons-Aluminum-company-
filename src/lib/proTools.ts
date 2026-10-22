// Phase 2 pro-tool math — pure functions, all live-computed in the browser.
// No prices here except where the task spec fixes estimator constants
// (blockwork / concrete site-estimator rates, labelled as such in the UI).

// ---------- Tape & fraction conversion ----------
export interface ImperialParts { feet: number; inches: number; num: number; den: number; text: string; totalInches: number }

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

/** Convert metres to feet + inches + fraction (to nearest 1/den). */
export function metresToImperial(m: number, den: 8 | 16 | 32 = 16): ImperialParts {
  const totalInches = m / 0.0254;
  let feet = Math.floor(totalInches / 12);
  let rem = totalInches - feet * 12;
  let whole = Math.floor(rem);
  let fracNum = Math.round((rem - whole) * den);
  if (fracNum === den) { whole += 1; fracNum = 0; }
  if (whole === 12) { feet += 1; whole = 0; }
  let num = fracNum, d = den;
  if (num > 0) { const g = gcd(num, d); num = num / g; d = d / g; }
  const fracText = num > 0 ? ` ${num}/${d}` : "";
  const text = `${feet}' ${whole}${fracText}"`;
  return { feet, inches: whole, num, den: d, text, totalInches };
}

/**
 * Parse a tape-style string into metres. Accepts:
 *  12' 7 3/8" · 12 ft 7 3/8 in · 7 3/8" · 3/8" · 12' · 2.5m · 250cm · 2500mm · 2500
 * Bare numbers are treated as millimetres (tape/site convention in NG metric work).
 */
export function parseMeasurementToMetres(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/,/g, "");
  if (!s) return null;
  // metric explicit
  const mm = s.match(/^(-?\d+(?:\.\d+)?)\s*mm$/); if (mm) return parseFloat(mm[1]) / 1000;
  const cm = s.match(/^(-?\d+(?:\.\d+)?)\s*cm$/); if (cm) return parseFloat(cm[1]) / 100;
  const mOnly = s.match(/^(-?\d+(?:\.\d+)?)\s*m$/); if (mOnly) return parseFloat(mOnly[1]);
  // imperial: feet part then optional inches part (whole and/or fraction)
  const imp = s.match(/^(?:(\d+(?:\.\d+)?)\s*(?:'|ft|feet))?\s*(?:(\d+(?:\.\d+)?)?\s*(?:(\d+)\s*\/\s*(\d+))?\s*(?:"|in|inch|inches))?$/);
  if (imp && (imp[1] !== undefined || imp[2] !== undefined || imp[3] !== undefined)) {
    const feet = imp[1] ? parseFloat(imp[1]) : 0;
    const wholeIn = imp[2] ? parseFloat(imp[2]) : 0;
    const fracIn = imp[3] ? parseInt(imp[3], 10) / parseInt(imp[4], 10) : 0;
    const totalIn = feet * 12 + wholeIn + fracIn;
    if (totalIn > 0) return totalIn * 0.0254;
    return null;
  }
  // bare number = mm
  const bare = s.match(/^(-?\d+(?:\.\d+)?)$/); if (bare) return parseFloat(bare[1]) / 1000;
  return null;
}

// ---------- Square & diagonal ----------
export function diagonalOf(l: number, w: number): number { return Math.sqrt(l * l + w * w); }
export interface SquareCheck { expected: number; diffMm: number; square: boolean; toleranceMm: number }
export function checkSquare(l: number, w: number, diagA: number, diagB: number): SquareCheck {
  const expected = diagonalOf(l, w);
  const diffMm = Math.abs(diagA - diagB) * 1000;
  const toleranceMm = Math.max(5, (Math.max(l, w) / 10) * 5); // ≤5mm per 10m of the long side
  return { expected, diffMm, square: diffMm <= toleranceMm, toleranceMm };
}

// ---------- Cut-length optimizer (first-fit decreasing) ----------
export interface CutReq { length: number; qty: number }
export interface CutBar { pieces: number[]; used: number; offcut: number }
export interface CutPlan { bars: CutBar[]; barCount: number; totalStock: number; totalPiecesLen: number; wastePct: number; offcuts: number[]; oversize: number[] }
export function optimizeCuts(stock: number, kerfMm: number, cuts: CutReq[]): CutPlan {
  const kerf = kerfMm / 1000;
  const pieces: number[] = [];
  const oversize: number[] = [];
  for (const c of cuts) {
    if (!(c.length > 0) || !(c.qty > 0)) continue;
    for (let i = 0; i < c.qty; i++) { if (c.length > stock + 1e-9) oversize.push(c.length); else pieces.push(c.length); }
  }
  pieces.sort((a, b) => b - a);
  const raw: { pieces: number[]; used: number }[] = [];
  for (const p of pieces) {
    let placed = false;
    for (const bar of raw) {
      const need = p + (bar.pieces.length ? kerf : 0);
      if (bar.used + need <= stock + 1e-9) { bar.pieces.push(p); bar.used += need; placed = true; break; }
    }
    if (!placed) raw.push({ pieces: [p], used: p });
  }
  const bars: CutBar[] = raw.map(b => ({ pieces: b.pieces, used: b.used, offcut: Math.max(0, stock - b.used) }));
  const totalPiecesLen = pieces.reduce((s, x) => s + x, 0);
  const totalStock = bars.length * stock;
  const wastePct = totalStock > 0 ? ((totalStock - totalPiecesLen) / totalStock) * 100 : 0;
  const offcuts = bars.map(b => Math.round(b.offcut * 1000) / 1000).filter(o => o >= 0.3);
  return { bars, barCount: bars.length, totalStock, totalPiecesLen, wastePct, offcuts, oversize };
}

// ---------- Block & concrete estimator ----------
export interface BlockResult { area: number; rawBlocks: number; blocks: number; mortarM3: number; mortarPerM2: number }
export function blockEstimate(length: number, height: number, size: "9" | "6"): BlockResult {
  const area = length * height;
  const rawBlocks = area * 10; // 450×225mm face incl. 10mm joint ≈ 9.9/m² → 10/m² site rule
  const blocks = Math.ceil(rawBlocks * 1.05); // +5% breakage/cutting
  const mortarPerM2 = size === "9" ? 0.03 : 0.02; // estimator rate
  return { area, rawBlocks, blocks, mortarM3: area * mortarPerM2, mortarPerM2 };
}

export interface ConcreteResult {
  wetM3: number; dryM3: number; parts: number;
  cementM3: number; cementKg: number; bagsExact: number; bags: number;
  sandM3: number; sandTonnes: number; graniteM3: number; graniteTonnes: number;
}
export function concreteEstimate(length: number, width: number, thickMm: number, mix: [number, number, number]): ConcreteResult {
  const wetM3 = length * width * (thickMm / 1000);
  const dryM3 = wetM3 * 1.54; // standard dry-volume factor
  const parts = mix[0] + mix[1] + mix[2];
  const cementM3 = (dryM3 * mix[0]) / parts;
  const cementKg = cementM3 * 1440; // density of cement
  const bagsExact = cementKg / 50;
  const sandM3 = (dryM3 * mix[1]) / parts;
  const graniteM3 = (dryM3 * mix[2]) / parts;
  return {
    wetM3, dryM3, parts, cementM3, cementKg, bagsExact, bags: Math.ceil(bagsExact),
    sandM3, sandTonnes: (sandM3 * 1600) / 1000,
    graniteM3, graniteTonnes: (graniteM3 * 1550) / 1000,
  };
}
