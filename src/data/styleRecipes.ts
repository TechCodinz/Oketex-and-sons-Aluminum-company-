// Phase 3 — Project Estimator data: trades, style library and recipe templates.
//
// HONESTY RULES (enforced across the estimator):
// - Prices come ONLY from the catalog (src/data/catalog.ts, via catalogSlug) or from
//   clearly-labelled estimator rates (estimatorPriceNgn -> UI shows "estimator rate").
// - Plumbing fixtures carry NO price at all: quantities only, "confirm price".
// - Waste factors and coverage rates are stated next to every recipe line template.

export type TradeId =
  | "roofing" | "tiling" | "woodwork" | "plumbing"
  | "interior" | "windows-doors" | "exterior" | "interior-cabinetry";

export interface TradeDef {
  id: TradeId; name: string; tagline: string;
  /** /book service id preselected by the "Book a pro" CTA */
  bookService: string;
}
export const TRADES: TradeDef[] = [
  { id: "roofing", name: "Roofing", tagline: "Full roof — sheets/tiles, ridge, fixings, labour", bookService: "installation" },
  { id: "tiling", name: "Tiling & Floors", tagline: "Floor & wall tiling in the pattern you love", bookService: "consultation" },
  { id: "woodwork", name: "Woodwork & Carpentry", tagline: "Wardrobes, kitchens, doors, shelving & TV units", bookService: "consultation" },
  { id: "plumbing", name: "Plumbing — Bathroom & Kitchen", tagline: "Fixtures, pipework rough-in, valves & labour points", bookService: "consultation" },
  { id: "interior", name: "Interior Room", tagline: "Paint, ceiling (POP / board / PVC) & floor finish", bookService: "consultation" },
  { id: "windows-doors", name: "Windows & Doors", tagline: "Casement, sliding & full-glaze openings, priced from catalog", bookService: "windows-doors-survey" },
  { id: "exterior", name: "Exterior & Cladding", tagline: "ACP facades, stone cladding, brick finish, painted render", bookService: "cladding-survey" },
  { id: "interior-cabinetry", name: "Interior & Cabinetry", tagline: "Kitchens, wardrobes, TV consoles, wall panels & doors — boards priced from live Settings rates", bookService: "consultation" },
];

export interface StyleDef {
  id: string; trade: TradeId; name: string; desc: string;
  /** key into the PatternPreview component on the Estimator page */
  preview: string;
  accent: string; accent2?: string;
  /** tiling only: pattern waste % (also in TILING_WASTE) */
  wastePct?: number;
  /** interior only: paint colour family shown as swatches */
  paintFamily?: { label: string; colours: string[] };
  /** windows only: how the m² price is derived from the catalog */
  winKind?: "casement" | "sliding" | "full-glaze";
}
export const STYLES: StyleDef[] = [
  // ---- Roofing (map to roofEngine ProfileIds in the engine) ----
  { id: "roof-longspan", trade: "roofing", name: "Longspan Classic", desc: "Clean longspan aluminium lines — the Nigerian standard. 0.45mm or 0.55mm, 14 colours.", preview: "longspan", accent: "#8A9299" },
  { id: "roof-metcoppo", trade: "roofing", name: "Metcoppo Step-Tile", desc: "Mediterranean step-tile profile in lightweight aluminium, 0.50mm PVDF coat.", preview: "metcoppo", accent: "#A9603C" },
  { id: "roof-stone", trade: "roofing", name: "Stone-Coated Bond", desc: "Premium stone-chip tiles on Aluzinc steel — 50-year warranty class.", preview: "stone", accent: "#5E2A35" },
  { id: "roof-corrugated", trade: "roofing", name: "Corrugated Traditional", desc: "Classic corrugated sheets — economical for homes, sheds and annexes.", preview: "corrugated", accent: "#6E7276" },
  // ---- Tiling patterns (waste % drives the recipe) ----
  { id: "tile-large", trade: "tiling", name: "Large-Format Straight", desc: "Big tiles, straight grid, minimal grout lines. Waste 7%.", preview: "large-format", accent: "#9AA0A3", wastePct: 7 },
  { id: "tile-subway", trade: "tiling", name: "Subway Brick", desc: "Classic brick-bond rectangles — kitchens & bathrooms. Waste 10%.", preview: "subway", accent: "#C7C2B4", wastePct: 10 },
  { id: "tile-checker", trade: "tiling", name: "Checkerboard", desc: "Black & white alternating squares — bold, timeless. Waste 10%.", preview: "checkerboard", accent: "#EDEEF0", accent2: "#17181A", wastePct: 10 },
  { id: "tile-mosaic", trade: "tiling", name: "Mosaic", desc: "Small-piece mosaic sheets for feature walls & wet floors. Waste 10%.", preview: "mosaic", accent: "#355E3B", wastePct: 10 },
  { id: "tile-diagonal", trade: "tiling", name: "Diagonal Diamond", desc: "Tiles laid at 45° — makes small rooms feel bigger. Waste 12%.", preview: "diagonal", accent: "#8E3B2F", wastePct: 12 },
  { id: "tile-herringbone", trade: "tiling", name: "Herringbone", desc: "Zig-zag herringbone — the premium feature pattern. Waste 15%.", preview: "herringbone", accent: "#C2A878", wastePct: 15 },
  // ---- Woodwork ----
  { id: "wood-shaker", trade: "woodwork", name: "Shaker Wardrobe", desc: "Framed-panel wardrobe doors, hanging + shelf carcasses in HDF/MDF.", preview: "shaker", accent: "#4A3428" },
  { id: "wood-kitchen", trade: "woodwork", name: "Modern Slab Kitchen", desc: "Flat slab cabinet fronts, base + wall units and a stone worktop.", preview: "kitchen", accent: "#2B2F33" },
  { id: "wood-louvre", trade: "woodwork", name: "Louvre & Panel Doors", desc: "Louvred/panelled internal doors, made to your openings.", preview: "louvre", accent: "#A9603C" },
  { id: "wood-shelving", trade: "woodwork", name: "Shelving & TV Unit", desc: "Floating shelves, media wall panelling and LED strip detail.", preview: "shelving", accent: "#274B63" },
  // ---- Plumbing ----
  { id: "plumb-standard", trade: "plumbing", name: "Standard Bathroom (3-piece)", desc: "WC, wash basin and shower — the dependable family bathroom.", preview: "bath-standard", accent: "#274B63" },
  { id: "plumb-ensuite", trade: "plumbing", name: "Ensuite (4-piece)", desc: "WC, basin, shower plus a bathtub for the master suite.", preview: "bath-ensuite", accent: "#355E3B" },
  { id: "plumb-luxury", trade: "plumbing", name: "Luxury Bathroom (5-piece + shower)", desc: "Double basin vanity, rain shower, freestanding tub, the works.", preview: "bath-luxury", accent: "#5E2A35" },
  { id: "plumb-kitchen", trade: "plumbing", name: "Kitchen Plumbing", desc: "Sink point, mixer tap, waste and water points for the kitchen run.", preview: "kitchen-plumb", accent: "#8E3B2F" },
  // ---- Interior ----
  { id: "int-modern", trade: "interior", name: "Modern Clean", desc: "Crisp whites & soft greys, flat ceiling lines, cool light.", preview: "interior-modern", accent: "#EDEEF0", accent2: "#6E7276", paintFamily: { label: "Whites & soft greys", colours: ["#F4F4F2", "#D9D9D6", "#A8ADB3", "#5B6066"] } },
  { id: "int-classic", trade: "interior", name: "Classic Warm", desc: "Creams, terracotta warmth and a traditional cornice line.", preview: "interior-classic", accent: "#E8E0CC", accent2: "#A9603C", paintFamily: { label: "Creams & terracotta", colours: ["#F1E8D2", "#E3CFA5", "#C89B6A", "#A9603C"] } },
  { id: "int-minimal", trade: "interior", name: "Warm Minimal", desc: "Warm off-whites and greige — calm, uncluttered, gallery-like.", preview: "interior-minimal", accent: "#E5DED2", accent2: "#8A7B63", paintFamily: { label: "Warm off-white & greige", colours: ["#EFEAE0", "#DDD3C0", "#B4A88F", "#8A7B63"] } },
  // ---- Interior & Cabinetry (boards priced LIVE from Settings & Rates via rateKey) ----
  { id: "cab-kitchen", trade: "interior-cabinetry", name: "Kitchen Cabinets", desc: "Base + wall cabinets per linear metre — HDF carcasses, marine ply at the sink, labour per metre from Settings.", preview: "kitchen", accent: "#2B2F33" },
  { id: "cab-wardrobe", trade: "interior-cabinetry", name: "Wardrobe", desc: "Carcass + doors per m² of frontage — hanging rails, shelves, soft-close hardware.", preview: "shaker", accent: "#4A3428" },
  { id: "cab-tv", trade: "interior-cabinetry", name: "TV Console & Media Wall", desc: "MDF console + panelled media wall with LED detail, per metre of run.", preview: "shelving", accent: "#274B63" },
  { id: "cab-panels", trade: "interior-cabinetry", name: "Wall Panels / Wainscoting", desc: "MDF wall panelling per m² — battens, boards, adhesive and paint finish.", preview: "interior-modern", accent: "#EDEEF0", accent2: "#6E7276" },
  { id: "cab-door", trade: "interior-cabinetry", name: "Interior Door", desc: "Blockboard-core door leaf, frame, hinges and lock set — priced per door.", preview: "louvre", accent: "#A9603C" },
  // ---- Windows & Doors ----
  { id: "win-casement", trade: "windows-doors", name: "Casement Classic", desc: "Hinged casement windows, fabricated to measure. Catalog-priced per m².", preview: "casement", accent: "#2B2F33", winKind: "casement" },
  { id: "win-sliding", trade: "windows-doors", name: "Sliding Modern", desc: "Wide sliding windows & doors on smooth double tracks.", preview: "sliding", accent: "#274B63", winKind: "sliding" },
  { id: "win-glaze", trade: "windows-doors", name: "Full-Glaze", desc: "Floor-to-ceiling fixed glazing for living spaces & facades.", preview: "full-glaze", accent: "#355E3B", winKind: "full-glaze" },
  // ---- Exterior ----
  { id: "ext-acp", trade: "exterior", name: "ACP Panel Facade", desc: "4mm aluminium composite panels on a subframe — catalog sheets.", preview: "acp", accent: "#6E7276" },
  { id: "ext-stone", trade: "exterior", name: "Stone Cladding", desc: "Natural stone veneer feature walls — quantities + labour, stone priced on survey.", preview: "stone-clad", accent: "#8A7B63" },
  { id: "ext-brick", trade: "exterior", name: "Brick Finish", desc: "Brick-slip finish over render — quantities + labour, slips priced on survey.", preview: "brick", accent: "#8E3B2F" },
  { id: "ext-render", trade: "exterior", name: "Painted Render", desc: "Weather-shield painted render in your colour — priced from paint rates.", preview: "render", accent: "#C2A878" },
];
export const stylesForTrade = (t: TradeId) => STYLES.filter(s => s.trade === t);
export const styleById = (id: string) => STYLES.find(s => s.id === id);

/** Tiling pattern waste table (industry estimating practice). */
export const TILING_WASTE: Record<string, number> = {
  "tile-large": 7, "tile-subway": 10, "tile-checker": 10,
  "tile-mosaic": 10, "tile-diagonal": 12, "tile-herringbone": 15,
};

export interface TileSize { id: string; label: string; area: number; pricePerTile: number }
export const TILE_SIZES: TileSize[] = [
  { id: "300x300", label: "300 × 300 mm", area: 0.09, pricePerTile: 650 },
  { id: "400x400", label: "400 × 400 mm", area: 0.16, pricePerTile: 950 },
  { id: "600x600", label: "600 × 600 mm", area: 0.36, pricePerTile: 2400 },
  { id: "600x1200", label: "600 × 1200 mm", area: 0.72, pricePerTile: 5800 },
  { id: "mosaic-sheet", label: "Mosaic sheet 300 × 300 mm", area: 0.09, pricePerTile: 1850 },
];
// NOTE: tile prices above are estimator rates (labelled in UI) — tiles are not in the Oketex catalog.

// ---------------------------------------------------------------------------
// Recipe templates. qty = driverValue × rate ÷ per(resolved) , then waste if flagged.
// Drivers: area | perimeter | fixtures | openings | frontage | doors | ceilingArea | wallArea | fixed
// Rounding: ceil (whole units, min 1 when raw > 0) | round1 | round2 | exact
// ---------------------------------------------------------------------------
export type LineGroupName = "Main Materials" | "Accessories & Fixings" | "Consumables" | "Tools & Equipment" | "Labour";
export const GROUP_ORDER: LineGroupName[] = ["Main Materials", "Accessories & Fixings", "Consumables", "Tools & Equipment", "Labour"];
export type DriverKey = "area" | "perimeter" | "fixtures" | "openings" | "frontage" | "doors" | "ceilingArea" | "wallArea" | "fixed";
export interface RecipeLine {
  name: string; group: LineGroupName; unit: string;
  driver: DriverKey; rate: number;
  /** divisor key resolved by the engine: tileArea | boardArea (2.98m²) | sheetArea (2.88m²) */
  perKey?: "tileArea" | "boardArea" | "sheetArea";
  rounding: "ceil" | "round1" | "round2" | "exact";
  wasteApplies?: boolean;
  catalogSlug?: string;
  estimatorPriceNgn?: number;
  /** Key into Settings & Rates (getRates) — the LIVE rate is the unit price
   *  (Boards & Panels sheets + cabinet labour). Wins over estimatorPriceNgn. */
  rateKey?: string;
  note?: string;
}

export const RECIPES: Record<string, RecipeLine[]> = {
  // ---------- TILING (shared by every tiling pattern; pattern waste comes from TILING_WASTE) ----------
  // Rates: adhesive 1 × 20kg bag per 4m²; grout 0.5kg/m²; spacers 1 pack per 10m²;
  // skirting priced per metre of floor perimeter; tiling labour ₦2,500/m² (estimator rate).
  tiling: [
    { name: "Floor/wall tiles", group: "Main Materials", unit: "tile", driver: "area", rate: 1, perKey: "tileArea", rounding: "ceil", wasteApplies: true, note: "Area × (1 + pattern waste) ÷ tile coverage" },
    { name: "Tile adhesive (20kg bag)", group: "Main Materials", unit: "bag", driver: "area", rate: 0.25, rounding: "ceil", estimatorPriceNgn: 6500, note: "1 bag per 4m² — estimator rate" },
    { name: "Skirting tiles/strips", group: "Main Materials", unit: "m", driver: "perimeter", rate: 1, rounding: "round1", estimatorPriceNgn: 900, note: "Floor perimeter — estimator rate" },
    { name: "Grout", group: "Consumables", unit: "kg", driver: "area", rate: 0.5, rounding: "round1", estimatorPriceNgn: 450, note: "0.5kg per m² — estimator rate" },
    { name: "Tile spacers (pack)", group: "Accessories & Fixings", unit: "pack", driver: "area", rate: 0.1, rounding: "ceil", estimatorPriceNgn: 1200, note: "1 pack per 10m² — estimator rate" },
    { name: "Edge trim / threshold strips", group: "Accessories & Fixings", unit: "m", driver: "fixed", rate: 2, rounding: "exact", estimatorPriceNgn: 1500, note: "Door thresholds & exposed edges — adjust to your room; estimator rate" },
    { name: "Tile cutter (hire, per day)", group: "Tools & Equipment", unit: "day", driver: "fixed", rate: 1, rounding: "exact", estimatorPriceNgn: 5000, note: "Estimator rate — or your tiler brings their own" },
    { name: "Tiling labour", group: "Labour", unit: "m²", driver: "area", rate: 1, rounding: "round1", estimatorPriceNgn: 2500, note: "Estimator rate — pattern work at the higher end" },
  ],
};

/** Woodwork recipes per style. Board = HDF/MDF sheet 1.22 × 2.44m = 2.98m² (boardArea).
 *  Carcass factor: boards needed = frontage area × factor ÷ 2.98 (factor covers carcass,
 *  shelves and doors vs the visible frontage). Hinges 2 per door (3 for louvre doors),
 *  handles 1 per door/drawer front. Labour is an estimator rate per metre of run / per door. */
export const WOODWORK_RECIPES: Record<string, RecipeLine[]> = {
  "wood-shaker": [
    { name: "HDF/MDF boards 18mm (1.22 × 2.44m)", group: "Main Materials", unit: "board", driver: "area", rate: 1.6, perKey: "boardArea", rounding: "ceil", estimatorPriceNgn: 38500, note: "Frontage area × 1.6 carcass factor — estimator rate" },
    { name: "Hinges (soft-close)", group: "Accessories & Fixings", unit: "pc", driver: "doors", rate: 2, rounding: "ceil", estimatorPriceNgn: 1200, note: "2 per door — estimator rate" },
    { name: "Handles / knobs", group: "Accessories & Fixings", unit: "pc", driver: "doors", rate: 1, rounding: "ceil", estimatorPriceNgn: 2500, note: "1 per door — estimator rate" },
    { name: "Edge banding (50m roll)", group: "Consumables", unit: "roll", driver: "frontage", rate: 0.34, rounding: "ceil", estimatorPriceNgn: 6000, note: "≈1 roll per 3m of frontage — estimator rate" },
    { name: "Screws & fixings (box)", group: "Consumables", unit: "box", driver: "frontage", rate: 0.5, rounding: "ceil", estimatorPriceNgn: 8500, note: "Estimator rate" },
    { name: "Wood glue (bottle)", group: "Consumables", unit: "bottle", driver: "frontage", rate: 0.34, rounding: "ceil", estimatorPriceNgn: 3500, note: "Estimator rate" },
    { name: "Finishing — varnish / lacquer", group: "Consumables", unit: "L", driver: "area", rate: 0.25, rounding: "round1", estimatorPriceNgn: 7500, note: "≈0.25L per m² of frontage, 2 coats — estimator rate" },
    { name: "Carpentry labour (wardrobe)", group: "Labour", unit: "m run", driver: "frontage", rate: 1, rounding: "round1", estimatorPriceNgn: 18000, note: "Per metre of wardrobe run — estimator rate" },
  ],
  "wood-kitchen": [
    { name: "HDF/MDF boards 18mm (1.22 × 2.44m)", group: "Main Materials", unit: "board", driver: "area", rate: 1.9, perKey: "boardArea", rounding: "ceil", estimatorPriceNgn: 38500, note: "Base + wall units: frontage area × 1.9 — estimator rate" },
    { name: "Stone worktop (granite/quartz)", group: "Main Materials", unit: "m", driver: "frontage", rate: 1, rounding: "round1", estimatorPriceNgn: 28000, note: "Per metre of counter run — estimator rate, stone priced finally on selection" },
    { name: "Hinges (soft-close)", group: "Accessories & Fixings", unit: "pc", driver: "doors", rate: 2, rounding: "ceil", estimatorPriceNgn: 1200, note: "2 per door — estimator rate" },
    { name: "Handles / bar pulls", group: "Accessories & Fixings", unit: "pc", driver: "doors", rate: 1, rounding: "ceil", estimatorPriceNgn: 2500, note: "1 per door/drawer front — estimator rate" },
    { name: "Drawer runners (pair)", group: "Accessories & Fixings", unit: "pair", driver: "frontage", rate: 0.67, rounding: "ceil", estimatorPriceNgn: 4500, note: "≈2 drawer banks per 3m run — estimator rate" },
    { name: "Edge banding (50m roll)", group: "Consumables", unit: "roll", driver: "frontage", rate: 0.34, rounding: "ceil", estimatorPriceNgn: 6000, note: "Estimator rate" },
    { name: "Screws & fixings (box)", group: "Consumables", unit: "box", driver: "frontage", rate: 0.5, rounding: "ceil", estimatorPriceNgn: 8500, note: "Estimator rate" },
    { name: "Wood glue (bottle)", group: "Consumables", unit: "bottle", driver: "frontage", rate: 0.34, rounding: "ceil", estimatorPriceNgn: 3500, note: "Estimator rate" },
    { name: "Carpentry labour (kitchen)", group: "Labour", unit: "m run", driver: "frontage", rate: 1, rounding: "round1", estimatorPriceNgn: 22000, note: "Per metre of kitchen run — estimator rate" },
  ],
  "wood-louvre": [
    { name: "HDF/MDF boards 18mm (1.22 × 2.44m)", group: "Main Materials", unit: "board", driver: "doors", rate: 0.8, perKey: undefined, rounding: "ceil", estimatorPriceNgn: 38500, note: "≈0.8 board per standard door leaf — estimator rate" },
    { name: "Door frame timber (set)", group: "Main Materials", unit: "set", driver: "doors", rate: 1, rounding: "ceil", estimatorPriceNgn: 15000, note: "Per door opening — estimator rate" },
    { name: "Butt hinges (heavy)", group: "Accessories & Fixings", unit: "pc", driver: "doors", rate: 3, rounding: "ceil", estimatorPriceNgn: 1800, note: "3 per door — estimator rate" },
    { name: "Door handles + lock set", group: "Accessories & Fixings", unit: "set", driver: "doors", rate: 1, rounding: "ceil", estimatorPriceNgn: 12500, note: "Per door — estimator rate" },
    { name: "Screws, nails & glue (allowance)", group: "Consumables", unit: "lot", driver: "doors", rate: 0.5, rounding: "ceil", estimatorPriceNgn: 6000, note: "Estimator rate" },
    { name: "Finishing — varnish / paint", group: "Consumables", unit: "L", driver: "doors", rate: 0.5, rounding: "round1", estimatorPriceNgn: 7500, note: "≈0.5L per door, 2 coats — estimator rate" },
    { name: "Carpentry labour (doors)", group: "Labour", unit: "door", driver: "doors", rate: 1, rounding: "exact", estimatorPriceNgn: 25000, note: "Make + hang per door — estimator rate" },
  ],
  "wood-shelving": [
    { name: "HDF/MDF boards 18mm (1.22 × 2.44m)", group: "Main Materials", unit: "board", driver: "area", rate: 1.3, perKey: "boardArea", rounding: "ceil", estimatorPriceNgn: 38500, note: "Frontage area × 1.3 (shelves + panelling) — estimator rate" },
    { name: "LED strip light (5m roll)", group: "Main Materials", unit: "roll", driver: "frontage", rate: 0.34, rounding: "ceil", estimatorPriceNgn: 9500, note: "Feature lighting for the media wall — estimator rate" },
    { name: "Shelf brackets / concealed pins", group: "Accessories & Fixings", unit: "pc", driver: "frontage", rate: 2, rounding: "ceil", estimatorPriceNgn: 1500, note: "2 per metre — estimator rate" },
    { name: "Edge banding (50m roll)", group: "Consumables", unit: "roll", driver: "frontage", rate: 0.34, rounding: "ceil", estimatorPriceNgn: 6000, note: "Estimator rate" },
    { name: "Screws & wall plugs (box)", group: "Consumables", unit: "box", driver: "frontage", rate: 0.5, rounding: "ceil", estimatorPriceNgn: 8500, note: "Estimator rate" },
    { name: "Wood glue (bottle)", group: "Consumables", unit: "bottle", driver: "frontage", rate: 0.34, rounding: "ceil", estimatorPriceNgn: 3500, note: "Estimator rate" },
    { name: "Finishing — paint / varnish", group: "Consumables", unit: "L", driver: "area", rate: 0.25, rounding: "round1", estimatorPriceNgn: 7500, note: "Estimator rate" },
    { name: "Carpentry labour (shelving/TV unit)", group: "Labour", unit: "m run", driver: "frontage", rate: 1, rounding: "round1", estimatorPriceNgn: 15000, note: "Per metre of unit run — estimator rate" },
  ],
};

/** Plumbing fixture sets per style. `points` weights the labour/rough-in driver:
 *  a floor drain or mirror is not a full wet point. Fixtures are QUANTITIES ONLY — no prices. */
export interface FixtureDef { key: string; label: string; unit: string; count: number; points: number }
export const PLUMBING_FIXTURES: Record<string, FixtureDef[]> = {
  "plumb-standard": [
    { key: "wc", label: "WC set (close-coupled)", unit: "set", count: 1, points: 1 },
    { key: "basin", label: "Wash hand basin + pedestal", unit: "set", count: 1, points: 1 },
    { key: "shower", label: "Shower set (mixer + head)", unit: "set", count: 1, points: 1 },
    { key: "drain", label: "Floor drain", unit: "pc", count: 1, points: 0 },
    { key: "mirror", label: "Bathroom mirror", unit: "pc", count: 1, points: 0 },
  ],
  "plumb-ensuite": [
    { key: "wc", label: "WC set (close-coupled)", unit: "set", count: 1, points: 1 },
    { key: "basin", label: "Wash hand basin + pedestal", unit: "set", count: 1, points: 1 },
    { key: "shower", label: "Shower set (mixer + head)", unit: "set", count: 1, points: 1 },
    { key: "bath", label: "Bathtub (acrylic/steel)", unit: "pc", count: 1, points: 1 },
    { key: "drain", label: "Floor drain", unit: "pc", count: 1, points: 0 },
    { key: "mirror", label: "Bathroom mirror", unit: "pc", count: 1, points: 0 },
  ],
  "plumb-luxury": [
    { key: "wc", label: "WC set (concealed/wall-hung)", unit: "set", count: 1, points: 1 },
    { key: "basin", label: "Basin + vanity unit (double)", unit: "set", count: 2, points: 1 },
    { key: "shower", label: "Rain shower set (thermostatic)", unit: "set", count: 1, points: 1 },
    { key: "bath", label: "Freestanding bathtub", unit: "pc", count: 1, points: 1 },
    { key: "drain", label: "Floor drain (linear)", unit: "pc", count: 2, points: 0 },
    { key: "mirror", label: "LED mirror", unit: "pc", count: 1, points: 0 },
    { key: "accessories", label: "Accessory set (towel rail, paper holder, robe hooks)", unit: "set", count: 1, points: 0 },
  ],
  "plumb-kitchen": [
    { key: "sink", label: "Kitchen sink (double bowl)", unit: "set", count: 1, points: 1 },
    { key: "tap", label: "Kitchen mixer tap", unit: "pc", count: 1, points: 0 },
    { key: "filter", label: "Drinking-water filter point", unit: "point", count: 1, points: 0 },
    { key: "drain", label: "Floor gully / drain", unit: "pc", count: 1, points: 0 },
  ],
};
/** Rough-in lines shared by all plumbing styles. Pipes/fittings are quantities only
 *  (routes are confirmed on site); labour is a labelled estimator rate per wet point. */
export const PLUMBING_COMMON: RecipeLine[] = [
  { name: "PPR/PVC pipework — rough-in", group: "Main Materials", unit: "m", driver: "fixtures", rate: 6, rounding: "ceil", note: "≈6m of pipe run per wet point — quantity only, routes confirmed on site" },
  { name: "Valve, trap & fitting sets", group: "Accessories & Fixings", unit: "set", driver: "fixtures", rate: 1, rounding: "ceil", note: "1 set per wet point — quantity only" },
  { name: "Angle valves & flex connectors", group: "Accessories & Fixings", unit: "pc", driver: "fixtures", rate: 2, rounding: "ceil", note: "2 per wet point — quantity only" },
  { name: "Silicone & thread seal (tube)", group: "Consumables", unit: "tube", driver: "fixtures", rate: 0.5, rounding: "ceil", estimatorPriceNgn: 3500, note: "Estimator rate" },
  { name: "Plumbing labour", group: "Labour", unit: "point", driver: "fixtures", rate: 1, rounding: "round1", estimatorPriceNgn: 15000, note: "Per wet fixture point, first + second fix — estimator rate" },
];

/** Interior paint/ceiling rates. Paint coverage: emulsion 11 m²/L per coat × 2 coats;
 *  primer 12 m²/L, 1 coat. POP: 1 × 25kg bag casts ≈2.5m² at ~12mm. Plasterboard sheet
 *  1.2 × 2.4m = 2.88m². PVC ceiling panel 0.25 × 6m = 1.5m² per panel. */
export const INTERIOR_PAINT_LINES: RecipeLine[] = [
  { name: "Emulsion paint (2 coats)", group: "Main Materials", unit: "L", driver: "wallArea", rate: 2 / 11, rounding: "round1", estimatorPriceNgn: 3800, note: "Wall area ÷ 11 m²/L per coat × 2 coats — estimator rate" },
  { name: "Primer / sealer (1 coat)", group: "Main Materials", unit: "L", driver: "wallArea", rate: 1 / 12, rounding: "round1", estimatorPriceNgn: 3200, note: "Wall area ÷ 12 m²/L — estimator rate" },
  { name: "Wall filler / screed putty", group: "Consumables", unit: "kg", driver: "wallArea", rate: 0.4, rounding: "round1", estimatorPriceNgn: 350, note: "≈0.4kg per m² — estimator rate" },
  { name: "Abrasives & masking (allowance)", group: "Consumables", unit: "lot", driver: "fixed", rate: 1, rounding: "exact", estimatorPriceNgn: 7500, note: "Estimator rate" },
  { name: "Painting labour", group: "Labour", unit: "m²", driver: "wallArea", rate: 1, rounding: "round1", estimatorPriceNgn: 800, note: "Per m² of wall — estimator rate" },
];
export const CEILING_LINES: Record<string, RecipeLine[]> = {
  pop: [
    { name: "POP powder (25kg bag)", group: "Main Materials", unit: "bag", driver: "ceilingArea", rate: 0.4, rounding: "ceil", estimatorPriceNgn: 9500, note: "1 bag casts ≈2.5m² at ~12mm — estimator rate" },
    { name: "POP fibre & casting consumables", group: "Consumables", unit: "lot", driver: "ceilingArea", rate: 0.1, rounding: "ceil", estimatorPriceNgn: 12000, note: "≈1 lot per 10m² — estimator rate" },
    { name: "Cornice / coving", group: "Accessories & Fixings", unit: "m", driver: "perimeter", rate: 1, rounding: "round1", estimatorPriceNgn: 1200, note: "Room perimeter — estimator rate" },
    { name: "POP ceiling labour", group: "Labour", unit: "m²", driver: "ceilingArea", rate: 1, rounding: "round1", estimatorPriceNgn: 3500, note: "Estimator rate" },
  ],
  plasterboard: [
    { name: "Plasterboard sheets (1.2 × 2.4m)", group: "Main Materials", unit: "sheet", driver: "ceilingArea", rate: 1, perKey: "sheetArea", rounding: "ceil", estimatorPriceNgn: 14500, note: "Ceiling area ÷ 2.88m² per sheet — estimator rate" },
    { name: "Joint compound & tape", group: "Consumables", unit: "lot", driver: "ceilingArea", rate: 0.1, rounding: "ceil", estimatorPriceNgn: 9000, note: "≈1 lot per 10m² — estimator rate" },
    { name: "Drywall screws (box)", group: "Accessories & Fixings", unit: "box", driver: "ceilingArea", rate: 0.1, rounding: "ceil", estimatorPriceNgn: 6500, note: "Estimator rate" },
    { name: "Cornice / coving", group: "Accessories & Fixings", unit: "m", driver: "perimeter", rate: 1, rounding: "round1", estimatorPriceNgn: 1200, note: "Room perimeter — estimator rate" },
    { name: "Board ceiling labour", group: "Labour", unit: "m²", driver: "ceilingArea", rate: 1, rounding: "round1", estimatorPriceNgn: 2800, note: "Estimator rate" },
  ],
  pvc: [
    { name: "PVC ceiling panels (0.25 × 6m)", group: "Main Materials", unit: "panel", driver: "ceilingArea", rate: 1 / 1.5, rounding: "ceil", estimatorPriceNgn: 8500, note: "Each panel covers 1.5m² — estimator rate" },
    { name: "PVC edge trim / cornice", group: "Accessories & Fixings", unit: "m", driver: "perimeter", rate: 1, rounding: "round1", estimatorPriceNgn: 900, note: "Room perimeter — estimator rate" },
    { name: "Ceiling labour (PVC)", group: "Labour", unit: "m²", driver: "ceilingArea", rate: 1, rounding: "round1", estimatorPriceNgn: 1500, note: "Estimator rate" },
  ],
};

/** Windows & Doors: the main line is priced per m² prorated from the catalog —
 *  casement ₦145,000 per 1.44m² unit (casement-window-system); sliding ₦385,000 per
 *  2.4 × 2.1m set = 5.04m² (sliding-glass-door); full-glaze uses the same sliding
 *  glazed-system baseline. The engine builds this line from catalog data. */
export const WINDOW_EXTRA_LINES: RecipeLine[] = [
  { name: "Silicone sealant (tube)", group: "Consumables", unit: "tube", driver: "area", rate: 0.34, rounding: "ceil", estimatorPriceNgn: 3500, note: "≈1 tube per 3m² of opening — estimator rate" },
  { name: "Frame screws & plugs (pack)", group: "Accessories & Fixings", unit: "pack", driver: "openings", rate: 1, rounding: "ceil", estimatorPriceNgn: 4500, note: "1 pack per opening — estimator rate" },
  { name: "Installation labour", group: "Labour", unit: "m²", driver: "area", rate: 1, rounding: "round1", estimatorPriceNgn: 12000, note: "Per m² of opening — estimator rate" },
];

/** Exterior recipes (ACP main line comes from the catalog in the engine). */
export const EXTERIOR_RECIPES: Record<string, RecipeLine[]> = {
  "ext-acp": [
    { name: "Aluminium subframe profiles (6m lengths)", group: "Main Materials", unit: "length", driver: "area", rate: 2.4 / 6, rounding: "ceil", catalogSlug: "extrusion-profiles-bundle", note: "≈2.4m of subframe profile per m² of facade, in 6m lengths — catalog price" },
    { name: "Structural sealant (tube)", group: "Consumables", unit: "tube", driver: "area", rate: 0.25, rounding: "ceil", estimatorPriceNgn: 3500, note: "≈1 tube per 4m² — estimator rate" },
    { name: "Brackets, anchors & fixings (set)", group: "Accessories & Fixings", unit: "set", driver: "area", rate: 0.2, rounding: "ceil", estimatorPriceNgn: 9500, note: "≈1 set per 5m² — estimator rate" },
    { name: "Cladding labour (subframe + panels)", group: "Labour", unit: "m²", driver: "area", rate: 1, rounding: "round1", estimatorPriceNgn: 8000, note: "Estimator rate" },
  ],
  "ext-stone": [
    { name: "Stone cladding veneer", group: "Main Materials", unit: "m²", driver: "area", rate: 1, rounding: "round1", wasteApplies: true, note: "Quantity only — stone varies widely, priced on survey/selection" },
    { name: "Tile/stone adhesive (20kg bag)", group: "Main Materials", unit: "bag", driver: "area", rate: 0.25, rounding: "ceil", estimatorPriceNgn: 6500, note: "1 bag per 4m² — estimator rate" },
    { name: "Stone sealant (5L)", group: "Consumables", unit: "tin", driver: "area", rate: 0.05, rounding: "ceil", estimatorPriceNgn: 18500, note: "≈1 tin per 20m² — estimator rate" },
    { name: "Cladding labour (stone)", group: "Labour", unit: "m²", driver: "area", rate: 1, rounding: "round1", estimatorPriceNgn: 6500, note: "Estimator rate" },
  ],
  "ext-brick": [
    { name: "Brick slips / facing bricks", group: "Main Materials", unit: "m²", driver: "area", rate: 1, rounding: "round1", wasteApplies: true, note: "Quantity only — priced on survey/selection" },
    { name: "Brick-slip adhesive (20kg bag)", group: "Main Materials", unit: "bag", driver: "area", rate: 0.25, rounding: "ceil", estimatorPriceNgn: 6500, note: "1 bag per 4m² — estimator rate" },
    { name: "Pointing mortar (bag)", group: "Consumables", unit: "bag", driver: "area", rate: 0.1, rounding: "ceil", estimatorPriceNgn: 7800, note: "≈1 bag per 10m² — estimator rate" },
    { name: "Cladding labour (brick finish)", group: "Labour", unit: "m²", driver: "area", rate: 1, rounding: "round1", estimatorPriceNgn: 5500, note: "Estimator rate" },
  ],
  "ext-render": [
    { name: "Weather-shield exterior paint (2 coats)", group: "Main Materials", unit: "L", driver: "area", rate: 2 / 10, rounding: "round1", estimatorPriceNgn: 4200, note: "Wall area ÷ 10 m²/L per coat × 2 coats — estimator rate" },
    { name: "Exterior primer / sealer (1 coat)", group: "Main Materials", unit: "L", driver: "area", rate: 1 / 12, rounding: "round1", estimatorPriceNgn: 3200, note: "Estimator rate" },
    { name: "Wall filler / crack repair", group: "Consumables", unit: "kg", driver: "area", rate: 0.4, rounding: "round1", estimatorPriceNgn: 350, note: "Estimator rate" },
    { name: "Painting labour (exterior)", group: "Labour", unit: "m²", driver: "area", rate: 1, rounding: "round1", estimatorPriceNgn: 900, note: "Includes scaffold-side access allowance — estimator rate" },
  ],
};
/** Exterior cutting/breakage waste for stone & brick finishes. */
export const EXTERIOR_WASTE = 10;

/** Interior & Cabinetry recipes. Board lines carry a `rateKey` into
 *  Settings & Rates (getRates): the board/labour price is the LIVE admin
 *  rate — the same value the Boards & Panels shop products sell at.
 *  Board sheet = 1.22 × 2.44m = 2.98m² (boardArea). Kitchen basis:
 *  per linear metre of run — boards from run length × unit height ×
 *  carcass factor; doors at 1 front per 0.55–0.6m; hinges 2/door;
 *  handles 1/door. Hardware (hinges/handles/runners) uses labelled
 *  estimator rates — no catalog hardware products exist yet. */
export const CABINETRY_RECIPES: Record<string, RecipeLine[]> = {
  "cab-kitchen": [
    { name: "HDF boards 18mm — carcass + doors (8×4ft sheet)", group: "Main Materials", unit: "sheet", driver: "area", rate: 1.9, perKey: "boardArea", rounding: "ceil", rateKey: "hdfSheet", note: "Run × height × 1.9 carcass factor (base + wall units) — live Boards rate from Settings" },
    { name: "Marine plywood 18mm — sink/wet-zone unit (8×4ft sheet)", group: "Main Materials", unit: "sheet", driver: "frontage", rate: 0.3, rounding: "ceil", rateKey: "marinePlywoodSheet", note: "≈1 sheet per 3m of run for the sink carcass (900mm wet zone) — live Boards rate from Settings" },
    { name: "Hinges (soft-close)", group: "Accessories & Fixings", unit: "pc", driver: "doors", rate: 2, rounding: "ceil", estimatorPriceNgn: 1200, note: "2 per door — estimator rate" },
    { name: "Handles / bar pulls", group: "Accessories & Fixings", unit: "pc", driver: "doors", rate: 1, rounding: "ceil", estimatorPriceNgn: 2500, note: "1 per door/drawer front — estimator rate" },
    { name: "Drawer runners (pair)", group: "Accessories & Fixings", unit: "pair", driver: "frontage", rate: 0.67, rounding: "ceil", estimatorPriceNgn: 4500, note: "≈2 drawer banks per 3m run — estimator rate" },
    { name: "Edge banding (50m roll)", group: "Consumables", unit: "roll", driver: "frontage", rate: 0.34, rounding: "ceil", estimatorPriceNgn: 6000, note: "≈1 roll per 3m of run — estimator rate" },
    { name: "Screws & fixings (box)", group: "Consumables", unit: "box", driver: "frontage", rate: 0.5, rounding: "ceil", estimatorPriceNgn: 8500, note: "Estimator rate" },
    { name: "Cabinet labour", group: "Labour", unit: "m run", driver: "frontage", rate: 1, rounding: "round1", rateKey: "cabinetLabourPerM", note: "Per linear metre of kitchen run — live rate from Settings & Rates" },
  ],
  "cab-wardrobe": [
    { name: "HDF boards 18mm — carcass + doors (8×4ft sheet)", group: "Main Materials", unit: "sheet", driver: "area", rate: 1.6, perKey: "boardArea", rounding: "ceil", rateKey: "hdfSheet", note: "Frontage area (run × height) × 1.6 carcass factor — live Boards rate from Settings" },
    { name: "Hanging rail (chrome tube)", group: "Main Materials", unit: "m", driver: "frontage", rate: 1, rounding: "round1", estimatorPriceNgn: 2800, note: "Per metre of hanging run — estimator rate" },
    { name: "Hinges (soft-close) — hinged doors", group: "Accessories & Fixings", unit: "pc", driver: "doors", rate: 2, rounding: "ceil", estimatorPriceNgn: 1200, note: "2 per door; sliding-door designs use a track kit instead — estimator rate" },
    { name: "Handles / knobs", group: "Accessories & Fixings", unit: "pc", driver: "doors", rate: 1, rounding: "ceil", estimatorPriceNgn: 2500, note: "1 per door — estimator rate" },
    { name: "Edge banding (50m roll)", group: "Consumables", unit: "roll", driver: "frontage", rate: 0.34, rounding: "ceil", estimatorPriceNgn: 6000, note: "Estimator rate" },
    { name: "Screws & fixings (box)", group: "Consumables", unit: "box", driver: "frontage", rate: 0.5, rounding: "ceil", estimatorPriceNgn: 8500, note: "Estimator rate" },
    { name: "Cabinet labour", group: "Labour", unit: "m run", driver: "frontage", rate: 1, rounding: "round1", rateKey: "cabinetLabourPerM", note: "Per linear metre of wardrobe run — live rate from Settings & Rates" },
  ],
  "cab-tv": [
    { name: "MDF boards 18mm — console + panels (8×4ft sheet)", group: "Main Materials", unit: "sheet", driver: "area", rate: 1.3, perKey: "boardArea", rounding: "ceil", rateKey: "mdfSheet", note: "Frontage area × 1.3 (console + panelling) — live Boards rate from Settings" },
    { name: "LED strip light (5m roll)", group: "Main Materials", unit: "roll", driver: "frontage", rate: 0.34, rounding: "ceil", estimatorPriceNgn: 9500, note: "Feature lighting — estimator rate" },
    { name: "Shelf brackets / concealed pins", group: "Accessories & Fixings", unit: "pc", driver: "frontage", rate: 2, rounding: "ceil", estimatorPriceNgn: 1500, note: "2 per metre — estimator rate" },
    { name: "Edge banding (50m roll)", group: "Consumables", unit: "roll", driver: "frontage", rate: 0.34, rounding: "ceil", estimatorPriceNgn: 6000, note: "Estimator rate" },
    { name: "Screws & wall plugs (box)", group: "Consumables", unit: "box", driver: "frontage", rate: 0.5, rounding: "ceil", estimatorPriceNgn: 8500, note: "Estimator rate" },
    { name: "Cabinet labour", group: "Labour", unit: "m run", driver: "frontage", rate: 1, rounding: "round1", rateKey: "cabinetLabourPerM", note: "Per linear metre of unit run — live rate from Settings & Rates" },
  ],
  "cab-panels": [
    { name: "MDF boards 18mm — wall panels (8×4ft sheet)", group: "Main Materials", unit: "sheet", driver: "area", rate: 1.05, perKey: "boardArea", rounding: "ceil", rateKey: "mdfSheet", note: "Wall area × 1.05 cutting allowance ÷ 2.98m² per sheet — live Boards rate from Settings" },
    { name: "Batten timber for panelling grounds", group: "Main Materials", unit: "m", driver: "area", rate: 1.2, rounding: "round1", estimatorPriceNgn: 900, note: "≈1.2m of batten per m² of panelled wall — estimator rate" },
    { name: "Panel adhesive & filler (allowance)", group: "Consumables", unit: "lot", driver: "area", rate: 0.1, rounding: "ceil", estimatorPriceNgn: 12000, note: "≈1 lot per 10m² — estimator rate" },
    { name: "Finishing paint / varnish", group: "Consumables", unit: "L", driver: "area", rate: 0.25, rounding: "round1", estimatorPriceNgn: 7500, note: "≈0.25L per m², 2 coats — estimator rate" },
    { name: "Panelling labour", group: "Labour", unit: "m²", driver: "area", rate: 1, rounding: "round1", estimatorPriceNgn: 3500, note: "Per m² of panelled wall — estimator rate" },
  ],
  "cab-door": [
    { name: "Blockboard 18mm — door leaves (8×4ft sheet)", group: "Main Materials", unit: "sheet", driver: "doors", rate: 0.8, rounding: "ceil", rateKey: "blockboardSheet", note: "≈0.8 sheet per standard leaf, offcuts to linings — live Boards rate from Settings" },
    { name: "Door frame timber (set)", group: "Main Materials", unit: "set", driver: "doors", rate: 1, rounding: "ceil", estimatorPriceNgn: 15000, note: "Per door opening — estimator rate" },
    { name: "Butt hinges (heavy)", group: "Accessories & Fixings", unit: "pc", driver: "doors", rate: 3, rounding: "ceil", estimatorPriceNgn: 1800, note: "3 per door — estimator rate" },
    { name: "Door handles + lock set", group: "Accessories & Fixings", unit: "set", driver: "doors", rate: 1, rounding: "ceil", estimatorPriceNgn: 12500, note: "Per door — estimator rate" },
    { name: "Screws, nails & glue (allowance)", group: "Consumables", unit: "lot", driver: "doors", rate: 0.5, rounding: "ceil", estimatorPriceNgn: 6000, note: "Estimator rate" },
    { name: "Finishing — varnish / paint", group: "Consumables", unit: "L", driver: "doors", rate: 0.5, rounding: "round1", estimatorPriceNgn: 7500, note: "≈0.5L per door, 2 coats — estimator rate" },
    { name: "Carpentry labour (doors)", group: "Labour", unit: "door", driver: "doors", rate: 1, rounding: "exact", estimatorPriceNgn: 25000, note: "Make + hang per door — estimator rate" },
  ],
};
