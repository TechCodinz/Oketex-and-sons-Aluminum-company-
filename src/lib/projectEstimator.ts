// Phase 3 — Project Estimator engine (guided, formula-driven; NOT AI vision).
// Pick a trade + style, add real dimensions (and optionally a photo), and this
// engine expands the style's recipe into a full grouped materials list.
// Prices: catalog products only (by slug) or labelled estimator rates.
// Plumbing fixtures are quantities only — never priced here.
import { products } from "@/data/catalog";
import { calculateRoof, type ProfileId, type RoofStyle } from "./roofEngine";
import {
  TRADES, styleById, TILING_WASTE, TILE_SIZES, RECIPES, WOODWORK_RECIPES,
  PLUMBING_FIXTURES, PLUMBING_COMMON, INTERIOR_PAINT_LINES, CEILING_LINES,
  WINDOW_EXTRA_LINES, EXTERIOR_RECIPES, EXTERIOR_WASTE,
  type TradeId, type RecipeLine, type LineGroupName, GROUP_ORDER,
} from "@/data/styleRecipes";

export type { TradeId, LineGroupName };
export { TRADES, GROUP_ORDER };

export interface EstimatorInput {
  trade: TradeId;
  styleId: string;
  // roofing
  roofLength: number; roofWidth: number; roofPitch: number; roofStyle: RoofStyle;
  roofOverhang: number; roofProfile: ProfileId; roofColour: string;
  roofExtras: { gutters: boolean; insulation: boolean; installation: boolean; timber: boolean };
  deliveryZone: string;
  // generic room dims
  length: number; width: number; height: number;
  wallsPct: number;        // tiling: % of walls tiled
  openingsPct: number;     // interior / exterior: openings deduction %
  tileSizeId: string;
  // woodwork
  unitCount: number;       // kitchen units / louvre doors override (0 = auto)
  // windows
  openingsCount: number; avgOpeningW: number; avgOpeningH: number; directArea: number;
  // exterior
  elevations: number;
  // plumbing
  fixtures: Record<string, number>;
  waterHeater: boolean;
  tileAddon: boolean; tileWallsPct: number;
  // interior
  ceilingType: "pop" | "plasterboard" | "pvc";
  floorFinish: string;     // "none" or a tiling style id
}
export const defaultEstimatorInput = (trade: TradeId, styleId: string): EstimatorInput => ({
  trade, styleId,
  roofLength: 10, roofWidth: 8, roofPitch: 25, roofStyle: "gable", roofOverhang: 0.6,
  roofProfile: "longspan-045", roofColour: "Charcoal",
  roofExtras: { gutters: true, insulation: false, installation: true, timber: true },
  deliveryZone: "ogun-lagos",
  length: 4, width: 3, height: 2.7, wallsPct: 100, openingsPct: 15,
  tileSizeId: "600x600",
  unitCount: 0,
  openingsCount: 6, avgOpeningW: 1.2, avgOpeningH: 1.2, directArea: 0,
  elevations: 1,
  fixtures: Object.fromEntries((PLUMBING_FIXTURES[styleId] ?? []).map(f => [f.key, f.count])),
  waterHeater: false, tileAddon: false, tileWallsPct: 100,
  ceilingType: "pop", floorFinish: "none",
});

export interface ComputedLine {
  name: string; group: LineGroupName; qty: number; unit: string;
  unitPrice?: number; priceSource: "catalog" | "estimator" | null;
  total?: number; note?: string;
}
export interface DriverStat { label: string; value: string }
export interface EstimateResult {
  groups: { name: LineGroupName; lines: ComputedLine[] }[];
  drivers: DriverStat[];
  assumptions: string[];
  pricedTotal: number; unpricedCount: number;
  wastePct?: number; cuttingList?: string;
}

const BOARD_AREA = 2.98;  // 1.22 × 2.44m HDF/MDF board
const SHEET_AREA = 2.88;  // 1.2 × 2.4m plasterboard
const catalogPrice = (slug?: string) => (slug ? products.find(p => p.slug === slug)?.priceNgn : undefined);

type Drivers = Record<string, number>;
function runRecipe(lines: RecipeLine[], d: Drivers, per: Record<string, number>, waste: number, prefix = ""): ComputedLine[] {
  return lines.map(l => {
    const perVal = l.perKey ? per[l.perKey] ?? 1 : 1;
    let raw = ((d[l.driver] ?? 0) * l.rate) / perVal;
    if (l.wasteApplies && waste > 0) raw *= 1 + waste / 100;
    let qty = raw;
    if (l.rounding === "ceil") qty = raw > 0 ? Math.max(1, Math.ceil(raw)) : 0;
    else if (l.rounding === "round1") qty = Math.round(raw * 10) / 10;
    else if (l.rounding === "round2") qty = Math.round(raw * 100) / 100;
    else qty = Math.round(raw * 100) / 100;
    const catP = catalogPrice(l.catalogSlug);
    const unitPrice = catP ?? l.estimatorPriceNgn;
    const priceSource: ComputedLine["priceSource"] = catP !== undefined ? "catalog" : l.estimatorPriceNgn !== undefined ? "estimator" : null;
    return {
      name: prefix + l.name, group: l.group, qty, unit: l.unit,
      unitPrice, priceSource,
      total: unitPrice !== undefined ? Math.round(qty * unitPrice) : undefined,
      note: l.note,
    };
  }).filter(l => l.qty > 0);
}
function groupLines(lines: ComputedLine[]): EstimateResult["groups"] {
  return GROUP_ORDER
    .map(name => ({ name, lines: lines.filter(l => l.group === name) }))
    .filter(g => g.lines.length > 0);
}
function finish(lines: ComputedLine[], drivers: DriverStat[], assumptions: string[], extra?: Partial<EstimateResult>): EstimateResult {
  return {
    groups: groupLines(lines), drivers, assumptions,
    pricedTotal: lines.reduce((s, l) => s + (l.total ?? 0), 0),
    unpricedCount: lines.filter(l => l.total === undefined).length,
    ...extra,
  };
}
const m2 = (n: number) => `${n.toFixed(1)} m²`;

// ---------------------------------------------------------------------------
export function estimateProject(input: EstimatorInput): EstimateResult {
  const style = styleById(input.styleId);
  switch (input.trade) {
    case "roofing": return estimateRoofing(input);
    case "tiling": return estimateTiling(input, input.styleId, input.tileSizeId, input.length, input.width, input.height, input.wallsPct, "");
    case "woodwork": return estimateWoodwork(input);
    case "plumbing": return estimatePlumbing(input);
    case "interior": return estimateInterior(input);
    case "windows-doors": return estimateWindows(input);
    case "exterior": return estimateExterior(input);
    default: return finish([], [], [`Style: ${style?.name ?? input.styleId}`]);
  }
}

// ---------------- Roofing: roofEngine BOQ converted into grouped format -------
const ROOFING_PROFILE_BY_STYLE: Record<string, ProfileId> = {
  "roof-longspan": "longspan-045", "roof-metcoppo": "metcoppo",
  "roof-stone": "stone-coated", "roof-corrugated": "corrugated",
};
export function profileForRoofStyle(styleId: string, chosen: ProfileId): ProfileId {
  if (styleId === "roof-longspan") return chosen === "longspan-055" ? "longspan-055" : "longspan-045";
  return ROOFING_PROFILE_BY_STYLE[styleId] ?? chosen;
}
function estimateRoofing(input: EstimatorInput): EstimateResult {
  const profile = profileForRoofStyle(input.styleId, input.roofProfile);
  const r = calculateRoof({
    length: input.roofLength, width: input.roofWidth, overhang: input.roofOverhang,
    style: input.roofStyle, pitchDeg: input.roofPitch, profile, colour: input.roofColour,
    wastePct: null, extras: input.roofExtras, deliveryZone: input.deliveryZone,
  });
  const groupOf = (item: string): LineGroupName => {
    const s = item.toLowerCase();
    if (s.includes("installation") || s.includes("labour")) return "Labour";
    if (s.includes("ridge") || s.includes("screw") || s.includes("nails")) return "Accessories & Fixings";
    return "Main Materials";
  };
  const lines: ComputedLine[] = r.lines.map(l => ({
    name: l.item, group: groupOf(l.item), qty: l.qty, unit: l.unit,
    unitPrice: l.unitPrice, priceSource: l.note === "estimator rate" ? "estimator" : "catalog",
    total: l.total, note: l.spec + (l.note ? ` · ${l.note}` : ""),
  }));
  if (r.transport > 0) lines.push({
    name: "Transport / delivery", group: "Main Materials", qty: 1, unit: "trip",
    unitPrice: r.transport, priceSource: "catalog", total: r.transport, note: "Delivery zone rate from the Pro Calculator",
  });
  return finish(lines, [
    { label: "True roof area", value: m2(r.trueRoofArea) },
    { label: "Slope length", value: `${r.slopeLength.toFixed(2)} m` },
    { label: "Slope factor", value: r.slopeFactor.toFixed(3) },
    { label: "Waste allowance", value: `${r.wastePct}%` },
  ], [
    `Cutting list: ${r.cuttingList}`,
    "Quantities from the Pro Roof Calculator engine (slope factor 1 ÷ cos(pitch), auto waste by roof style).",
    "Ridge, timber and installation lines are labelled estimator rates; sheet/tile/gutter prices are the live catalog.",
  ], { wastePct: r.wastePct, cuttingList: r.cuttingList });
}

// ---------------- Tiling ------------------------------------------------------
export function estimateTiling(
  input: EstimatorInput, styleId: string, tileSizeId: string,
  L: number, W: number, wallH: number, wallsPct: number, prefix: string,
): EstimateResult {
  const waste = TILING_WASTE[styleId] ?? 10;
  const size = styleId === "tile-mosaic"
    ? TILE_SIZES.find(t => t.id === "mosaic-sheet")!
    : TILE_SIZES.find(t => t.id === tileSizeId) ?? TILE_SIZES[2];
  const floorArea = Math.max(0, L * W);
  const perimeter = 2 * (L + W);
  const wallArea = wallH > 0 ? perimeter * wallH * (Math.min(100, Math.max(0, wallsPct)) / 100) : 0;
  const area = floorArea + wallArea;
  const lines = runRecipe(RECIPES.tiling, {
    area, perimeter, fixtures: 0, openings: 0, frontage: 0, doors: 0, ceilingArea: 0, wallArea, fixed: 1,
  }, { tileArea: size.area }, waste, prefix);
  // Tile unit price is an estimator rate that depends on the chosen tile size.
  const tileLine = lines.find(l => l.name === prefix + "Floor/wall tiles");
  if (tileLine) {
    tileLine.unit = styleId === "tile-mosaic" || size.id === "mosaic-sheet" ? "sheet" : "tile";
    tileLine.unitPrice = size.pricePerTile; tileLine.priceSource = "estimator";
    tileLine.total = Math.round(tileLine.qty * size.pricePerTile);
    tileLine.note = `${size.label} @ estimator rate ₦${size.pricePerTile.toLocaleString("en-NG")} each — final tile price depends on your selection`;
  }
  return finish(lines, [
    { label: "Floor area", value: m2(floorArea) },
    ...(wallArea > 0 ? [{ label: "Wall area tiled", value: m2(wallArea) }] : []),
    { label: "Total tile area", value: m2(area) },
    { label: "Pattern waste", value: `${waste}%` },
    { label: "Tile size", value: size.label },
  ], [
    `Pattern waste ${waste}% is included in the tile count only; adhesive/grout use net area.`,
    "Adhesive: 1 × 20kg bag per 4m². Grout: 0.5kg/m². Spacers: 1 pack per 10m².",
    "Tile prices are estimator rates — the final price depends on the tile you select.",
  ], { wastePct: waste });
}

// ---------------- Woodwork ----------------------------------------------------
function estimateWoodwork(input: EstimatorInput): EstimateResult {
  const recipe = WOODWORK_RECIPES[input.styleId] ?? WOODWORK_RECIPES["wood-shaker"];
  const frontage = Math.max(0, input.width);            // run length (m)
  const area = frontage * Math.max(0, input.height);    // frontage face area
  const doorWidth = input.styleId === "wood-kitchen" ? 0.55 : 0.6;
  const doors = input.styleId === "wood-louvre"
    ? Math.max(0, input.unitCount || Math.round(frontage) || 1)
    : Math.max(1, Math.round(frontage / doorWidth));
  const lines = runRecipe(recipe, {
    area, frontage, doors, perimeter: 0, fixtures: 0, openings: 0, ceilingArea: 0, wallArea: 0, fixed: 1,
  }, { boardArea: BOARD_AREA }, 0);
  return finish(lines, [
    { label: "Run / frontage", value: `${frontage.toFixed(1)} m` },
    { label: "Frontage height", value: `${input.height.toFixed(2)} m` },
    { label: "Doors / fronts", value: `${doors}` },
    { label: "Frontage area", value: m2(area) },
  ], [
    "Boards are 18mm HDF/MDF sheets of 1.22 × 2.44m (2.98m²); the carcass factor in each board line covers shelves, sides and doors.",
    input.styleId === "wood-louvre" ? "Door count drives this list — set it in Step 3 (Number of doors)." : `Doors estimated at one front per ${doorWidth}m of run — adjust the count in Step 3 if your design differs.`,
    "All woodwork prices are labelled estimator rates — board and hardware prices move with the market.",
  ]);
}

// ---------------- Plumbing ----------------------------------------------------
function estimatePlumbing(input: EstimatorInput): EstimateResult {
  const defs = PLUMBING_FIXTURES[input.styleId] ?? [];
  const counts = { ...Object.fromEntries(defs.map(f => [f.key, f.count])), ...input.fixtures };
  const lines: ComputedLine[] = [];
  let points = 0;
  for (const f of defs) {
    const qty = Math.max(0, counts[f.key] ?? f.count);
    points += qty * f.points;
    if (qty > 0) lines.push({
      name: f.label, group: "Main Materials", qty, unit: f.unit,
      priceSource: null, note: "Fixture — quantity only, confirm model & price with your supplier",
    });
  }
  if (input.waterHeater) {
    lines.push({ name: "Water heater (15–20 gal)", group: "Main Materials", qty: 1, unit: "pc", priceSource: null, note: "Fixture — quantity only, confirm model & price" });
    lines.push({ name: "Heater pipe, valve & safety set", group: "Accessories & Fixings", qty: 1, unit: "set", priceSource: null, note: "Quantity only" });
    points += 1;
  }
  lines.push(...runRecipe(PLUMBING_COMMON, {
    fixtures: points, area: 0, perimeter: 0, openings: 0, frontage: 0, doors: 0, ceilingArea: 0, wallArea: 0, fixed: 1,
  }, {}, 0));
  const drivers: DriverStat[] = [
    { label: "Wet fixture points", value: `${points}` },
    { label: "Room (for tiling)", value: `${input.length} × ${input.width} m` },
  ];
  const assumptions = [
    "Fixtures are listed as quantities only — sanitary-ware prices vary too widely to estimate honestly.",
    "Pipework is estimated at ≈6m of run per wet point; exact routes are confirmed on site.",
    "Plumbing labour is a labelled estimator rate per wet point (first + second fix).",
  ];
  let res = finish(lines, drivers, assumptions);
  if (input.tileAddon) {
    const tile = estimateTiling(input, "tile-large", input.tileSizeId, input.length, input.width, 2.4, input.tileWallsPct, "Bathroom tiling — ");
    res = finish([...lines, ...tile.groups.flatMap(g => g.lines)], [...drivers,
      { label: "Bathroom tiling area", value: tile.drivers.find(d => d.label === "Total tile area")?.value ?? "" },
    ], [...assumptions, "Optional tiling add-on: floor + walls to 2.4m high at the % you set, straight-lay waste 7%."]);
    res.pricedTotal = [...lines, ...tile.groups.flatMap(g => g.lines)].reduce((s, l) => s + (l.total ?? 0), 0);
    res.unpricedCount = [...lines, ...tile.groups.flatMap(g => g.lines)].filter(l => l.total === undefined).length;
  }
  return res;
}

// ---------------- Interior ----------------------------------------------------
function estimateInterior(input: EstimatorInput): EstimateResult {
  const L = Math.max(0, input.length), W = Math.max(0, input.width), H = Math.max(0, input.height);
  const perimeter = 2 * (L + W);
  const grossWall = perimeter * H;
  const wallArea = grossWall * (1 - Math.min(90, Math.max(0, input.openingsPct)) / 100);
  const ceilingArea = L * W, floorArea = L * W;
  const d: Drivers = { wallArea, ceilingArea, area: floorArea, perimeter, fixtures: 0, openings: 0, frontage: 0, doors: 0, fixed: 1 };
  const lines = [
    ...runRecipe(INTERIOR_PAINT_LINES, d, {}, 0),
    ...runRecipe(CEILING_LINES[input.ceilingType] ?? CEILING_LINES.pop, d, { sheetArea: SHEET_AREA }, 0),
  ];
  const assumptions = [
    `Wall area = perimeter × height − ${input.openingsPct}% for doors/windows.`,
    "Paint: emulsion at 11 m²/L per coat × 2 coats; primer at 12 m²/L, 1 coat — estimator rates.",
    input.ceilingType === "pop" ? "POP: 1 × 25kg bag casts ≈2.5m²." : input.ceilingType === "plasterboard" ? "Plasterboard sheets are 1.2 × 2.4m (2.88m²)." : "PVC panels are 0.25 × 6m (1.5m² each).",
  ];
  const drivers: DriverStat[] = [
    { label: "Net wall area (paint)", value: m2(wallArea) },
    { label: "Ceiling area", value: m2(ceilingArea) },
    { label: "Floor area", value: m2(floorArea) },
    { label: "Room perimeter", value: `${perimeter.toFixed(1)} m` },
  ];
  if (input.floorFinish && input.floorFinish !== "none") {
    const tile = estimateTiling(input, input.floorFinish, input.tileSizeId, L, W, 0, 0, "Floor — ");
    const tileLines = tile.groups.flatMap(g => g.lines).filter(l => !l.name.includes("Skirting"));
    lines.push(...tileLines);
    assumptions.push(`Floor finish costed with the tiling recipe (${styleById(input.floorFinish)?.name ?? "tiles"}, waste ${TILING_WASTE[input.floorFinish] ?? 10}%). Skirting excluded — walls are painted.`);
    const all = [...lines];
    return { ...finish(all, drivers, assumptions), pricedTotal: all.reduce((s, l) => s + (l.total ?? 0), 0), unpricedCount: all.filter(l => l.total === undefined).length };
  }
  return finish(lines, drivers, assumptions);
}

// ---------------- Windows & Doors ----------------------------------------------
function estimateWindows(input: EstimatorInput): EstimateResult {
  const style = styleById(input.styleId);
  const kind = style?.winKind ?? "casement";
  const area = input.directArea > 0
    ? input.directArea
    : Math.max(0, input.openingsCount) * Math.max(0, input.avgOpeningW) * Math.max(0, input.avgOpeningH);
  const perimeter = input.directArea > 0 ? 0 : input.openingsCount * 2 * (input.avgOpeningW + input.avgOpeningH);
  // Catalog-derived ₦/m² baselines (see styleRecipes note).
  const casement = products.find(p => p.slug === "casement-window-system")!;
  const sliding = products.find(p => p.slug === "sliding-glass-door")!;
  const perM2 = kind === "casement" ? casement.priceNgn / 1.44 : sliding.priceNgn / (2.4 * 2.1);
  const basis = kind === "casement"
    ? `Prorated from catalog: ${casement.name} ${casement.priceNgn.toLocaleString("en-NG")} per 1.44m² unit`
    : `Prorated from catalog: ${sliding.name} ${sliding.priceNgn.toLocaleString("en-NG")} per 2.4 × 2.1m set (5.04m²)`;
  const mainQty = Math.round(area * 10) / 10;
  const lines: ComputedLine[] = [{
    name: `${style?.name ?? "Window/door system"} (fabricated, incl. glass & hardware)`,
    group: "Main Materials", qty: mainQty, unit: "m²",
    unitPrice: Math.round(perM2), priceSource: "catalog",
    total: Math.round(mainQty * perM2), note: basis,
  }];
  lines.push(...runRecipe(WINDOW_EXTRA_LINES, {
    area, openings: input.openingsCount, perimeter, fixtures: 0, frontage: 0, doors: 0, ceilingArea: 0, wallArea: 0, fixed: 1,
  }, {}, 0));
  return finish(lines, [
    { label: "Total glazed area", value: m2(area) },
    { label: "Openings", value: `${input.openingsCount}` },
    { label: "Catalog baseline", value: `₦${Math.round(perM2).toLocaleString("en-NG")}/m²` },
  ], [
    basis + ". Made-to-measure fabrication is confirmed after a site survey.",
    "Silicone ≈1 tube per 3m² of opening; 1 fixing pack per opening.",
  ]);
}

// ---------------- Exterior ------------------------------------------------------
function estimateExterior(input: EstimatorInput): EstimateResult {
  const gross = Math.max(0, input.length) * Math.max(0, input.height) * Math.max(1, input.elevations);
  const area = gross * (1 - Math.min(90, Math.max(0, input.openingsPct)) / 100);
  const perimeter = Math.max(0, input.length) * Math.max(1, input.elevations);
  const d: Drivers = { area, perimeter, fixtures: 0, openings: 0, frontage: 0, doors: 0, ceilingArea: 0, wallArea: area, fixed: 1 };
  const lines: ComputedLine[] = [];
  const waste = input.styleId === "ext-stone" || input.styleId === "ext-brick" ? EXTERIOR_WASTE : 0;
  if (input.styleId === "ext-acp") {
    const acp = products.find(p => p.slug === "acp-cladding-panel")!;
    const sheets = area > 0 ? Math.ceil(area / BOARD_AREA) : 0;
    lines.push({
      name: `${acp.name} (1.22 × 2.44m)`, group: "Main Materials", qty: sheets, unit: "sheet",
      unitPrice: acp.priceNgn, priceSource: "catalog", total: sheets * acp.priceNgn,
      note: "Net wall area ÷ 2.98m² per sheet — catalog price. Panel cutting waste is handled in fabrication; order spares on large facades.",
    });
  }
  lines.push(...runRecipe(EXTERIOR_RECIPES[input.styleId] ?? [], d, {}, waste));
  return finish(lines, [
    { label: "Gross wall area", value: m2(gross) },
    { label: "Net cladding area", value: m2(area) },
    { label: "Elevations", value: `${Math.max(1, input.elevations)}` },
    ...(waste ? [{ label: "Cutting waste", value: `${waste}%` }] : []),
  ], [
    `Net area deducts ${input.openingsPct}% for windows/doors.`,
    input.styleId === "ext-acp" ? "ACP sheets and subframe profiles are live catalog prices." : "Stone/brick finishes are quantities + labour only — the finish material is priced on survey and selection.",
  ], waste ? { wastePct: waste } : undefined);
}

// ---------------------------------------------------------------------------
// Saved estimates — localStorage key "oketex-estimates" (NO photo data stored).
// ---------------------------------------------------------------------------
export interface SavedEstimate {
  code: string; createdAt: string;
  trade: TradeId; tradeLabel: string; styleId: string; styleName: string;
  photoAttached: boolean;
  input: EstimatorInput;
  drivers: DriverStat[];
  groups: { name: LineGroupName; lines: ComputedLine[] }[];
  pricedTotal: number; unpricedCount: number;
  bookService: string;
}
const EST_KEY = "oketex-estimates";
export function estimateCode() { return `EST-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; }
export function getEstimates(): SavedEstimate[] {
  try { const r = localStorage.getItem(EST_KEY); return r ? (JSON.parse(r) as SavedEstimate[]) : []; } catch { return []; }
}
export function saveEstimate(e: SavedEstimate) {
  const all = getEstimates(); all.unshift(e);
  try { localStorage.setItem(EST_KEY, JSON.stringify(all)); } catch { /* ignore */ }
}
export function deleteEstimate(code: string) {
  try { localStorage.setItem(EST_KEY, JSON.stringify(getEstimates().filter(e => e.code !== code))); } catch { /* ignore */ }
}
export const tradeLabel = (t: TradeId) => TRADES.find(x => x.id === t)?.name ?? t;
export const bookServiceFor = (t: TradeId) => TRADES.find(x => x.id === t)?.bookService ?? "consultation";
