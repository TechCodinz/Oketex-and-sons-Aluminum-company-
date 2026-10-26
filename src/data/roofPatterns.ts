// Shared roof pattern library — ONE dataset consumed by the Roofing Guide,
// the Visualizer and the Pro Guide (field companion). The 10 established
// guide styles are mapped from src/data/roofingGuide.ts (ROOF_STYLES stays
// the source for their base specs — min pitch, gauge, cover, fixing, laps)
// and enriched here with installation steps, fixes, tools and sketch data.
// Advanced profiles and roof forms are added below. NO PRICES anywhere in
// this file — patterns are practice, not products. All figures are typical
// Nigerian practice: always confirm on site and with the manufacturer.
import { ROOF_STYLES, type PatternKind } from "./roofingGuide";

export type PatternFamily = "Aluminium profile" | "Stone-coated" | "Shingle" | "Standing seam" | "Concrete/flat" | "Traditional";
export type SketchKind = "overlap" | "valley" | "gutter" | "ridge" | "flashing" | "fascia";
export type GuideTrade = "Roofing" | "Plumbing" | "Tiling" | "Carpentry & Woodwork" | "Electrical" | "Painting & Finishing" | "Concrete & Masonry" | "Welding & Metalwork" | "Interior & Cabinetry";
export const GUIDE_TRADES: GuideTrade[] = ["Roofing", "Plumbing", "Tiling", "Carpentry & Woodwork", "Electrical", "Painting & Finishing", "Concrete & Masonry", "Welding & Metalwork", "Interior & Cabinetry"];

export interface OverlapSpec { sideMm?: number; endMm?: number; note: string }
export interface PatternFix { problem: string; fix: string }

export interface RoofPattern {
  id: string;
  name: string;
  family: PatternFamily;
  /** Recommended working pitch range in degrees. */
  pitchRangeDeg: [number, number];
  gaugeOptions: string;
  overlapMm: OverlapSpec;
  fastenerPattern: string;
  bestFor: string;
  avoidWhen: string;
  installSteps: string[];
  commonFixes: PatternFix[];
  /** Tools — strictly from the STANDARD_TOOLS vocabulary (lib/snapRequests). */
  tools: string[];
  materials: string[];
  sketchKind: SketchKind;
  /** Roofing-guide preview kind, when this pattern is one of the guide styles. */
  guideKind?: PatternKind;
  /** Visualizer surface pattern key, when the profile can be rendered honestly. */
  visualPattern?: string;
  /** Roof-engine profile for the "Open in Calculator" deep link, when one honestly applies. */
  quoteProfile?: string;
}

const T_ROOF: string[] = ["Ladder", "Drill machine", "Measuring tape", "Spirit level", "Safety boots/gloves"];
const T_ROOF_SEAL: string[] = [...T_ROOF, "Sealant gun"];
const T_TILE: string[] = ["Drill machine", "Angle grinder", "Measuring tape", "Spirit level", "Ladder", "Safety boots/gloves"];

// Enrichment for the 10 established guide styles, keyed by guide style id.
interface Enrichment {
  pitchRangeDeg: [number, number]; overlapMm: OverlapSpec;
  installSteps: string[]; commonFixes: PatternFix[]; tools: string[]; materials: string[];
  sketchKind: SketchKind; visualPattern?: string; quoteProfile?: string;
}
const ENRICH: Record<string, Enrichment> = {
  longspan: {
    pitchRangeDeg: [5, 45], overlapMm: { endMm: 200, note: "Side lap 1 rib; end lap 150–300mm by pitch (200mm shown — steeper roofs lap less, shallow roofs more)." },
    installSteps: [
      "Set out purlins level and true — 2\"×3\" timber at max 1.2m spacing, closer at eaves and ridge.",
      "Check the first sheet for square against the eaves line; every error multiplies across the roof.",
      "Lay sheets from the leeward end so side laps face away from the driving rain.",
      "Fix through the crest with self-drilling screws and EPDM washers — snug, never crushed.",
      "Close the eaves with the fascia line straight; fit ridge caps with laps facing away from the weather.",
      "Seal every end lap and cut edge; walk the roof and check each fixing line before handover.",
    ],
    commonFixes: [
      { problem: "Leak at an end lap after heavy rain", fix: "Lift the lap, clean out old sealant, re-bed on butyl/flashing tape and add a stitch screw line through the lap." },
      { problem: "Screw washers split or perished", fix: "Replace with new EPDM-washer screws one-for-one; never over-tighten — the washer should spread, not squash flat." },
      { problem: "Sheets rattle in wind", fix: "Add crest fixings at the eaves and ridge lines and check purlin spacing — rattle means a fixing line is missing." },
    ],
    tools: T_ROOF_SEAL,
    materials: ["Longspan sheets cut to length", "Ridge caps", "Valley trays / secret gutter", "Self-drilling screws with EPDM washers", "2\"×3\" purlins", "Flashing tape / sealant", "Fascia boards + soffit"],
    sketchKind: "overlap", visualPattern: "longspan", quoteProfile: "longspan-045",
  },
  steptiles: {
    pitchRangeDeg: [10, 45], overlapMm: { endMm: 150, note: "End lap follows the step (min ~150mm); side lap 1 profile step." },
    installSteps: [
      "Set purlins to the step gauge so every step lands supported — measure twice, the steps cannot stretch.",
      "Start at the eaves with the first row dead level; the whole roof reads off this row.",
      "Work up the slope row by row, keeping steps aligned in straight vertical columns.",
      "Fix every sheet at eaves, ridge and laps per the fixing pattern; hide heads where the step allows.",
      "Fit ridge and hip caps with foam closers where supplied; seal cut edges at valleys.",
    ],
    commonFixes: [
      { problem: "Steps drift out of line up the slope", fix: "Stop and re-set from a string line — drift comes from the first two rows; do not try to bend it back higher up." },
      { problem: "Leak where a valley cuts the steps", fix: "Check the valley tray is wide enough under the cut ends and the cut edges are turned up 25mm against driving rain." },
    ],
    tools: T_ROOF_SEAL,
    materials: ["Steptiles sheets", "Ridge caps + closers", "Valley trays", "Self-drilling screws with washers", "Purlins to step gauge", "Sealant"],
    sketchKind: "overlap", visualPattern: "steptiles", quoteProfile: "metcoppo",
  },
  metcoppo: {
    pitchRangeDeg: [10, 50], overlapMm: { endMm: 150, note: "End lap 150–200mm; side lap 1 corrugation of the tile profile; tile steps gauge the rows." },
    installSteps: [
      "Gauge the purlins to the tile step (typically 350–400mm) before the first sheet goes up.",
      "Lay from eaves to ridge in full-length sheets wherever the slope allows — fewer end laps, fewer leaks.",
      "Keep the tile columns plumb with a string line every third sheet.",
      "Fix on the step flat per pattern; fit ridge rolls/caps and close the eaves.",
      "Touch up every cut edge with matching paint the same day — bare edges rust first.",
    ],
    commonFixes: [
      { problem: "Faded or chalky colour patches", fix: "Usually cut-edge and scratch damage: clean, prime bare metal and touch up with the matching colour coat." },
      { problem: "Drumming noise in rain", fix: "Add the missing fixing line at the lap and check for a purlin gap under the sheet mid-span." },
    ],
    tools: T_ROOF_SEAL,
    materials: ["Metcoppo sheets", "Ridge caps", "Valley trays", "Colour-matched screws", "Purlins", "Touch-up paint", "Sealant"],
    sketchKind: "overlap", visualPattern: "metcoppo", quoteProfile: "metcoppo",
  },
  "stone-classic": {
    pitchRangeDeg: [12, 60], overlapMm: { endMm: 90, note: "Head lap 80–100mm set by the tile gauge (≈370mm exposure); side lap 1 tile rib. Effective cover ≈0.48m² per tile." },
    installSteps: [
      "Fix battens at the tile gauge (typically 370mm exposure) over counter-battens and underlay.",
      "Start at the eaves, second row offset so joints never line up.",
      "Nail/screw every tile per pattern — typically 4 fixings per tile (2 front, 2 through the lap).",
      "Cut valley tiles to leave a 100–150mm open channel over the tray; never butt tiles into the valley centre.",
      "Fit ridge tiles on a ridge board with mortar or dry-fix kits; point and clean down.",
    ],
    commonFixes: [
      { problem: "Granules washing off / bald patches", fix: "Impact or foot damage: replace the affected tiles — slid out after removing the fixings of the row above. Never walk mid-tile; step on the batten lines." },
      { problem: "Leak at a hip or ridge", fix: "Check ridge pointing and hip cuts first; re-bed loose ridge tiles and renew perished mortar with a flexible ridge system." },
    ],
    tools: T_TILE,
    materials: ["Stone-coated tiles (Bond/Classic)", "Ridge + hip tiles", "Battens 50×50mm + counter-battens", "Roofing underlay", "Galvanised nails / tile screws", "Valley tray", "Mortar or dry ridge kit"],
    sketchKind: "overlap", visualPattern: "stone", quoteProfile: "stone-coated",
  },
  "stone-shingle": {
    pitchRangeDeg: [12, 60], overlapMm: { endMm: 90, note: "As Classic/Bond: head lap 80–100mm at the tile gauge; joints staggered half a tile." },
    installSteps: [
      "Batten out at the tile gauge and snap chalk lines every row — shingles show every wobble.",
      "Lay from the eaves with joints staggered half a tile each row.",
      "Fix every tile through the head lap per pattern; keep fixing heads covered by the next course.",
      "Dress valleys open-cut over the tray; fit ridges and verge trims.",
    ],
    commonFixes: [
      { problem: "Wavy rows visible from the ground", fix: "A batten line has drifted — strip back to the last true chalk line and re-lay; shingles cannot be nudged straight afterwards." },
      { problem: "Wind lift at the verge", fix: "Add verge trim fixings and check the first tile column is fixed through both laps." },
    ],
    tools: T_TILE,
    materials: ["Stone-coated shingle tiles", "Ridge tiles", "Battens + counter-battens", "Underlay", "Tile nails/screws", "Verge trims", "Valley tray"],
    sketchKind: "overlap", visualPattern: "shingle", quoteProfile: "stone-coated",
  },
  "stone-milano": {
    pitchRangeDeg: [12, 60], overlapMm: { endMm: 90, note: "As Classic/Bond: head lap 80–100mm at the tile gauge; keep the deep roll alignment true." },
    installSteps: [
      "Set battens to gauge and confirm the roll profile aligns at the eaves before fixing anything.",
      "Lay eaves-up, rolling each tile into the side lap so the deep profile seats fully.",
      "Fix per pattern; take extra care at hips where the deep cuts need careful mitres.",
      "Fit ridge rolls; seal and point all cuts the same day.",
    ],
    commonFixes: [
      { problem: "Side lap will not seat / tile rocks", fix: "A batten is off gauge or a tile is bent — replace the tile, never force the lap down with extra fixings." },
      { problem: "Water tracking under the deep roll", fix: "Check pitch is at or above the stone-coated minimum (12°) and the valley channel is clear." },
    ],
    tools: T_TILE,
    materials: ["Milano-profile tiles", "Ridge rolls", "Battens + counter-battens", "Underlay", "Tile fixings", "Valley tray"],
    sketchKind: "overlap", visualPattern: "milano", quoteProfile: "stone-coated",
  },
  "stone-roman": {
    pitchRangeDeg: [12, 60], overlapMm: { endMm: 90, note: "As Classic/Bond: head lap 80–100mm at the tile gauge; rolls must run in straight columns." },
    installSteps: [
      "String a line from eaves to ridge for the first roll column — Roman shows drift immediately.",
      "Batten to gauge; lay eaves-up with rolls aligned column by column.",
      "Fix per pattern, keeping heads under the next course.",
      "Cut hips/valleys carefully to keep a roll landing on each cut where possible; fit ridges.",
    ],
    commonFixes: [
      { problem: "Roll columns wander up the roof", fix: "Re-set from the string line at the next batten row; small drifts are corrected a few mm per row, never in one jump." },
      { problem: "Leak at a valley cut", fix: "Open the channel to the full 100–150mm width and check the tray extends under both cuts." },
    ],
    tools: T_TILE,
    materials: ["Roman-profile tiles", "Ridge tiles", "Battens + counter-battens", "Underlay", "Tile fixings", "Valley tray"],
    sketchKind: "overlap", visualPattern: "roman", quoteProfile: "stone-coated",
  },
  "standing-seam": {
    pitchRangeDeg: [3, 60], overlapMm: { note: "Seamed joints (single/double lock) — no exposed side laps; end laps usually avoided (sheets run full slope); where unavoidable, stepped/soldered ≥150mm." },
    installSteps: [
      "Deck or purlin line must be true — standing seam shows every ripple (oil-canning).",
      "Lay the first pan square to the eaves and clip it at the specified spacing (typically 400–600mm).",
      "Engage the next pan over the clips and seam with a mechanical seamer — never exposed screws through the pan.",
      "Form eaves and ridge closures with hemmed edges and cleats so pans can expand and contract.",
      "Flash penetrations with welded/ soldered collars or proprietary boots matched to the metal.",
    ],
    commonFixes: [
      { problem: "Seam popping open in heat", fix: "Thermal movement has nowhere to go: check fixed points are only where designed and clips can slide; re-seam the opened length." },
      { problem: "Oil-canning (wavy pans)", fix: "Usually deck unevenness or over-tight clips — lift the affected pans, true the support line and re-clip at spec spacing." },
    ],
    tools: T_ROOF_SEAL,
    materials: ["Standing-seam pans (site-rolled or factory)", "Concealed clips", "Cleats + closures", "Seam sealant", "Penetration boots", "Underlay / deck boards"],
    sketchKind: "overlap", visualPattern: "seam",
  },
  corrugated: {
    pitchRangeDeg: [10, 45], overlapMm: { sideMm: 76, endMm: 200, note: "Side lap 1–2 corrugations (76mm corrugation pitch); end lap 150–250mm by pitch." },
    installSteps: [
      "Set purlins at max 900mm–1.2m spacing; check the eaves line is square.",
      "Lay sheets with side laps facing away from the prevailing rain, 1 corrugation minimum.",
      "Fix with hook bolts or self-drilling screws on the crest at every purlin on lap lines.",
      "End laps 200mm sealed with lap tape at low pitches.",
      "Fit ridge caps and barge flashings; check every crest fixing from below for missed purlins.",
    ],
    commonFixes: [
      { problem: "Rust around fixings", fix: "Old hook bolts corrode first — replace with modern washered screws and treat the surrounding sheet before it perforates." },
      { problem: "Leak through a side lap in driven rain", fix: "Increase to a 1.5-corrugation lap with butyl tape on shallow pitches, and confirm the lap faces away from the weather." },
    ],
    tools: T_ROOF_SEAL,
    materials: ["Corrugated sheets (10ft class)", "Ridge caps", "Hook bolts / crest screws with washers", "Lap tape", "Purlins", "Barge flashings"],
    sketchKind: "overlap", visualPattern: "corrugated", quoteProfile: "corrugated",
  },
  "flat-deck": {
    pitchRangeDeg: [0, 10], overlapMm: { sideMm: 100, endMm: 100, note: "Membrane laps 75–100mm, sealed/welded; upstands min 150mm at parapets. Deck falls 1:60 minimum to outlets." },
    installSteps: [
      "Screed the deck to falls — minimum 1:80 to outlets; ponding water finds every fault.",
      "Prime the deck and let it dry fully before any membrane goes down.",
      "Lay membrane rolls from the low point up, laps ≥100mm, welded and probe-tested seam by seam.",
      "Dress upstands at least 150mm up walls and around outlets with clamping rings.",
      "Flood or hose-test the whole deck before any finish or protection layer hides it.",
    ],
    commonFixes: [
      { problem: "Blisters in the membrane", fix: "Moisture is trapped under the sheet: cut, dry the deck, and patch with a welded repair piece extending 150mm past the blister." },
      { problem: "Leak that only shows in long rain", fix: "Suspect a seam, not the field of the sheet — probe every lap with a seam tester and re-weld the failures." },
    ],
    tools: ["Trowel", "Measuring tape", "Spirit level", "Ladder", "Safety boots/gloves"],
    materials: ["Felt / APP membrane rolls", "Primer / bitumen paint", "Outlet bowls + clamping rings", "Protection boards", "Seam roller + hot-air welder (site kit)"],
    sketchKind: "overlap",
  },
};

// Advanced profiles and roof forms added to the shared library. Families
// are marked honestly: forms (Skillion, Butterfly, Gambrel) describe the
// ROOF SHAPE and are sheeted in the profile noted in their steps.
const ADVANCED: RoofPattern[] = [
  {
    id: "eurotile", name: "Eurotile Stone-Coated", family: "Stone-coated",
    pitchRangeDeg: [12, 60], gaugeOptions: "Stone-coated steel tiles ≈0.45mm core",
    overlapMm: { endMm: 90, note: "Standard tile module: head lap 80–100mm at the tile gauge (≈370mm exposure); side lap 1 tile rib." },
    fastenerPattern: "4 fixings per tile (2 front edge, 2 through the side lap into the batten), heads hidden by the next course.",
    bestFor: "European tile look with a flatter, broader tile face; prestige homes that want stone-coated durability.",
    avoidWhen: "Pitches under 12° — water tracks under the tile laps.",
    installSteps: [
      "Batten out at the tile gauge over counter-battens and underlay; snap a chalk line for the eaves row.",
      "Lay the eaves row level, then work up with joints staggered.",
      "Fix every tile per pattern — 4 fixings, heads covered by the course above.",
      "Keep valley channels open 100–150mm over the tray; cut tiles, never mortar, in the valley.",
      "Fit ridge tiles with a dry-fix kit or well-pointed mortar; clean granule spill from gutters.",
    ],
    commonFixes: [
      { problem: "Tiles lifting at the front edge", fix: "Front-edge fixings were skipped — add the two front fixings per tile working from the row above, slid up and back down." },
      { problem: "Rust specks on the tile face", fix: "Grinder sparks from cutting nearby steel burn the coating — brush off, touch up with the tile repair kit, and cut tiles on the ground away from laid roof." },
    ],
    tools: T_TILE,
    materials: ["Eurotile stone-coated tiles", "Ridge tiles", "Battens + counter-battens", "Underlay", "Tile nails/screws", "Valley tray", "Touch-up kit"],
    sketchKind: "overlap", visualPattern: "eurotile", quoteProfile: "stone-coated",
  },
  {
    id: "asphalt-shingle", name: "Asphalt Shingle (imported system)", family: "Shingle",
    pitchRangeDeg: [15, 60], gaugeOptions: "Fibreglass asphalt shingles, 3-tab or architectural (laminated)",
    overlapMm: { endMm: 50, note: "Courses overlap so only ≈125mm (5\") of each shingle shows; head lap ≥50mm. Requires a full deck — not battens." },
    fastenerPattern: "4–6 roofing nails per shingle on the nail line, covered by the course above; 6 nails in high-wind fixing.",
    bestFor: "Low-slope-to-steep roofs on a full plywood/OSB deck; quiet in rain; North-American style homes.",
    avoidWhen: "On battens or open purlins — shingles need a continuous deck and underlayment over the whole roof.",
    installSteps: [
      "Deck the whole roof with plywood/OSB, then cover 100% with underlayment (ice-and-water at eaves and valleys).",
      "Fix a metal drip edge at eaves and rakes before shingling.",
      "Chalk course lines at 125mm exposure; lay the starter course upside-down or use starter strip.",
      "Nail on the nail line — 4 nails per shingle (6 for wind zones), never through the exposed face.",
      "Shingle valleys woven or closed-cut per system; cap the ridge with ridge shingles.",
    ],
    commonFixes: [
      { problem: "Shingles curling or losing granules early", fix: "Heat and poor attic ventilation age asphalt fast in this climate — add ridge/soffit vents; replace curled shingles before the deck is exposed." },
      { problem: "Nail heads showing and leaking", fix: "Nails were placed below the nail line — lift the course above, re-nail on the line and seal the old holes with roof cement." },
    ],
    tools: T_TILE,
    materials: ["Asphalt shingles + ridge caps", "Underlayment (full deck)", "Drip edge metal", "Roofing nails", "Plywood/OSB deck", "Roof cement / sealant"],
    sketchKind: "overlap", visualPattern: "shingle",
  },
  {
    id: "ibr-profile", name: "IBR Industrial Profile", family: "Aluminium profile",
    pitchRangeDeg: [5, 45], gaugeOptions: "0.40 / 0.45 / 0.50 / 0.55mm aluminium; also aluzinc steel",
    overlapMm: { endMm: 200, note: "Side lap 1 rib (rib pitch ≈230mm class); end lap 200mm, 300mm under 7.5°." },
    fastenerPattern: "Crest fixings into purlins at every rib on eaves/ridge lines, every other rib mid-span; stitch screws on side laps at 450–600mm centres.",
    bestFor: "Factories, warehouses and churches — wide cover (≈680mm per sheet), long spans, low pitches.",
    avoidWhen: "Short residential slopes where the big industrial rib looks out of scale.",
    installSteps: [
      "Set purlins to span tables for the gauge — IBR spans further than longspan but not without limits.",
      "Square the first sheet to the eaves; the wide cover punishes a crooked start.",
      "Fix crests per pattern and stitch every side lap; laps face away from driving rain.",
      "Seal end laps at pitches under 10° with butyl tape as you lay.",
      "Fit big-profile ridge and barge flashings; check underside fixings from a lift, not a ladder guess.",
    ],
    commonFixes: [
      { problem: "Lap leaks on a low-pitch warehouse", fix: "At 5–7.5° the end lap must be 300mm with double butyl tape — open the lap, re-tape and add stitch screws." },
      { problem: "Sheet ends dented by foot traffic", fix: "Walk only on purlin lines over the ribs; replace crushed end sections — bent ribs break the lap seal." },
    ],
    tools: T_ROOF_SEAL,
    materials: ["IBR sheets cut to length", "Ridge + barge flashings (IBR profile)", "Crest screws with EPDM washers", "Butyl lap tape", "Stitch screws", "Purlins"],
    sketchKind: "overlap",
  },
  {
    id: "kliplok", name: "Klip-Lok Concealed-Fix Profile", family: "Standing seam",
    pitchRangeDeg: [3, 45], gaugeOptions: "0.45 / 0.50mm aluminium or aluzinc, concealed clip system",
    overlapMm: { note: "No through-laps: wide pans lock over concealed clips; end joints stepped ≥150mm or avoided with full-length sheets." },
    fastenerPattern: "NO exposed screws in the field of the roof — pans clip to concealed clips fixed to purlins at 900–1200mm centres per span tables.",
    bestFor: "Very low pitches and long unbroken slopes; clean modern lines; roofs where every screw hole is a future leak.",
    avoidWhen: "Where installers cannot get the exact clip system — improvised clips void the whole idea.",
    installSteps: [
      "Fix the clip line dead straight along the eaves — clips set the geometry of the whole roof.",
      "Lay the first pan over the clips and engage it fully before moving on.",
      "Roll/lock each new pan onto the previous rib per the system tool — hand pressure is not enough.",
      "Keep one fixed point per pan where the system specifies; everywhere else must slide for thermal movement.",
      "Close eaves and ridge with the system's closures, never foam and hope.",
    ],
    commonFixes: [
      { problem: "Pan unclipping in storm wind", fix: "Clip spacing was stretched beyond the span table or clips were not engaged — re-open the rib, re-clip at spec centres, re-lock." },
      { problem: "Clicking noises as the roof heats up", fix: "Normal thermal movement IF clips can slide; if a pan is screw-fixed mid-field by mistake, remove the rogue fixing and repair the hole from below the lap." },
    ],
    tools: T_ROOF_SEAL,
    materials: ["Klip-lok pans", "Concealed clips (system-matched)", "System closures (eaves/ridge)", "Butyl tape", "Underlay", "Purlins"],
    sketchKind: "overlap",
  },
  {
    id: "concrete-tile", name: "Concrete Interlocking Tiles", family: "Traditional",
    pitchRangeDeg: [18, 60], gaugeOptions: "Concrete tiles ≈10–12mm thick, ~40–45kg/m² laid — structure must be designed for the weight",
    overlapMm: { endMm: 100, note: "Head lap 75–100mm depending on pitch (100mm at the lowest pitches); side joints interlock." },
    fastenerPattern: "Every tile clipped or nailed at pitches over 45° and in exposed locations; eaves row and every third row fixed as a minimum elsewhere.",
    bestFor: "Heavy, quiet, fireproof roofs with a traditional tile read; very long life when the structure carries it.",
    avoidWhen: "On light timber trusses designed for aluminium — the dead load is roughly ten times a metal roof. Engineer confirms first.",
    installSteps: [
      "Engineer confirms trusses and battens for ≈45kg/m² before a single tile is ordered.",
      "Lay underlay, then battens at the tile gauge from a set-out rod.",
      "Load tiles evenly across the roof — never stack one slope.",
      "Lay eaves-up, interlocking side joints; fix rows per pattern and all perimeter tiles.",
      "Bed ridge tiles in mortar on a full bed, or use a dry ridge system; point neatly and wash down.",
    ],
    commonFixes: [
      { problem: "Cracked tiles after foot traffic", fix: "Concrete tiles crack under point loads — use roof ladders/crawling boards, and replace cracked tiles (a crack is a leak path). Keep spares from the same batch." },
      { problem: "Slipped tiles after storms", fix: "Fixing was skipped on exposed rows — re-fix the eaves, verge and every third row with clips/nails per pattern." },
    ],
    tools: ["Ladder", "Scaffold", "Trowel", "Measuring tape", "Spirit level", "Safety boots/gloves"],
    materials: ["Concrete interlocking tiles", "Ridge tiles", "Battens (heavier scantling)", "Underlay", "Tile clips/nails", "Mortar for bedding", "Verge units"],
    sketchKind: "overlap",
  },
  {
    id: "skillion", name: "Skillion (Mono-Pitch) Roof", family: "Aluminium profile",
    pitchRangeDeg: [5, 30], gaugeOptions: "Sheeted in Longspan / IBR / Klip-lok — pick the profile for the pitch (see its card)",
    overlapMm: { endMm: 200, note: "Profile laps as per the sheeting card; the defining detail is the high-side flashing and the single fall." },
    fastenerPattern: "As per sheeting profile; the high edge gets a full apron flashing fixed to the wall, not just the sheet.",
    bestFor: "Modern single-slope homes, extensions and solar-ready roofs — one fall, one gutter, simple drainage.",
    avoidWhen: "Where the tall high-side wall cannot be flashed properly into the building behind it.",
    installSteps: [
      "Build the single slope true — one plane, one fall; check the high wall line before sheeting.",
      "Sheet in full lengths from high side to eaves wherever possible — a mono-pitch should have no end laps.",
      "Flash the high side with a generous apron (150mm upstand minimum) tucked into the wall or over the high fascia.",
      "Close the low eaves with fascia + gutter sized for the WHOLE roof area on one outlet line.",
      "Seal side barges with folded flashings; check the underside for the light line that betrays a gap.",
    ],
    commonFixes: [
      { problem: "Leak at the high-side wall junction", fix: "The apron flashing is too short or face-fixed only — re-form with a 150mm upstand chased/sealed into the wall and a cover flashing over it." },
      { problem: "Gutter overflows in storms", fix: "One gutter takes the entire roof — upsize the gutter and add an outlet; check the fall is not back-graded." },
    ],
    tools: T_ROOF_SEAL,
    materials: ["Profile sheets (full slope lengths)", "High-side apron flashing", "Barge flashings", "Oversized gutter + downpipe", "Crest screws with washers", "Sealant / flashing tape"],
    sketchKind: "overlap", visualPattern: "longspan",
  },
  {
    id: "butterfly", name: "Butterfly Roof (Inverted Gable)", family: "Aluminium profile",
    pitchRangeDeg: [3, 15], gaugeOptions: "Sheeted in Klip-lok / standing seam preferred — the centre valley is the whole game",
    overlapMm: { endMm: 200, note: "Profile laps as per sheeting card; centre valley tray laps 300mm with sealed joints." },
    fastenerPattern: "As per sheeting profile; NO fixings in the valley waterway — the centre gutter must be a clean, fast channel.",
    bestFor: "Striking modern homes; rainwater harvested at one central point; high side windows under the raised edges.",
    avoidWhen: "Where leaves and debris cannot be cleaned out — a blocked butterfly valley floods INTO the house plan, and anywhere without an overflow path.",
    installSteps: [
      "Form the central valley as a proper box gutter: minimum 1:200 fall to the outlet, generous width for cleaning.",
      "Sheet both slopes toward the centre in concealed-fix or sealed-lap profiles only.",
      "Keep every lap and cut edge out of the waterway; turn sheet ends up at the valley sides per the tray detail.",
      "Fit an overflow spout that discharges VISIBLY outside — the day the outlet blocks, the overflow is the roof's alarm.",
      "Test with a hose from both ridges before ceilings close; then schedule valley cleaning into handover notes.",
    ],
    commonFixes: [
      { problem: "Centre gutter overflows into the building", fix: "Blocked outlet or flat fall — clear, re-grade to 1:200 minimum, and add/verify the external overflow spout." },
      { problem: "Leaks at the valley sheet ends", fix: "Sheet ends were dressed INTO the waterway — lift, re-form upstands at the tray edges and re-seal the tray laps at 300mm." },
    ],
    tools: T_ROOF_SEAL,
    materials: ["Concealed-fix / seam sheets", "Central box-gutter tray (formed)", "Overflow spout", "Outlet + downpipe", "Sealant / butyl tape", "Flashing set"],
    sketchKind: "valley",
  },
  {
    id: "gambrel", name: "Gambrel (Barn) Roof", family: "Aluminium profile",
    pitchRangeDeg: [20, 75], gaugeOptions: "Sheeted in Longspan or stone-coated; two pitches on one slope — lower ≈55–75°, upper ≈20–30°",
    overlapMm: { endMm: 200, note: "Profile laps as per sheeting card; at the knuckle (pitch break) the upper sheets lap OVER a formed break flashing by ≥150mm." },
    fastenerPattern: "As per sheeting profile, plus a dedicated fixing line into the break flashing at the knuckle on both faces.",
    bestFor: "Maximum attic/loft room under the roof — barns, chalets and homes that need a full upper floor.",
    avoidWhen: "Where the knuckle flashing cannot be formed properly — the pitch break is the classic leak point of this shape.",
    installSteps: [
      "Frame both pitches true and mark the knuckle line with a string — both planes must meet on one straight line.",
      "Sheet the STEEP lower plane first, finishing at the knuckle with a formed break flashing dressed over the sheet tops.",
      "Sheet the upper plane so its eaves-side ends lap over the break flashing by at least 150mm.",
      "Fix a line through the lap at the knuckle; seal the flashing ends at hips and verges.",
      "Ridge and hips as per profile; check from below at the knuckle for daylight before closing ceilings.",
    ],
    commonFixes: [
      { problem: "Leak exactly at the pitch break", fix: "The break flashing is missing or too flat — strip back to the knuckle, form a proper break flashing with an upstand, and re-lap the upper sheets 150mm over it." },
      { problem: "Upper slope sheets lift at their bottom edge", fix: "The knuckle fixing line was skipped — add crest fixings through the lap into the flashing batten." },
    ],
    tools: T_ROOF_SEAL,
    materials: ["Profile sheets (two slope lengths)", "Formed break flashing", "Ridge caps", "Crest screws with washers", "Sealant / flashing tape", "Purlins for both pitches"],
    sketchKind: "overlap",
  },
  {
    id: "crimp-curved", name: "Crimp-Curved Longspan", family: "Aluminium profile",
    pitchRangeDeg: [10, 45], gaugeOptions: "0.45 / 0.55mm aluminium, factory crimp-curved to radius",
    overlapMm: { sideMm: 76, endMm: 200, note: "Side lap 1 rib; curved sheets are ordered to the true radius — they cannot be re-bent on site." },
    fastenerPattern: "Crest fixings per longspan pattern; fixing lines follow the curve — mark purlin lines on the sheet before lifting.",
    bestFor: "Barrel-vault roofs, canopies, filling stations and church halls — a curved profile with no extra structure.",
    avoidWhen: "When the as-built radius differs from the drawing — measure the built curve and order to it, not to the plan.",
    installSteps: [
      "Measure the as-built curve radius at three points and order sheets crimped to the true radius.",
      "Trial-lay one sheet on the ground against a template of the curve before lifting the bundle.",
      "Fix from the crown outward so the curve seats evenly on the purlins.",
      "Keep side laps following the curve — a lap that bridges will leak and drum.",
      "Flash the springing lines (where the curve leaves the wall) with curved flashings formed to the same radius.",
    ],
    commonFixes: [
      { problem: "Sheet springs off the purlins between fixings", fix: "Crimp radius is off the built curve — do not force it flat with extra screws (it will oil-can and crack paint); re-crimp or replace the sheet to the measured radius." },
      { problem: "Leak at the wall springing line", fix: "The curved flashing was approximated straight — form a flashing to the true radius with a 150mm upstand and re-seal." },
    ],
    tools: T_ROOF_SEAL,
    materials: ["Crimp-curved longspan sheets", "Curved flashings to radius", "Ridge/crown caps", "Crest screws with washers", "Purlins set to the curve", "Sealant"],
    sketchKind: "overlap",
  },
];

const FAMILY_BY_KIND: Record<string, PatternFamily> = {
  longspan: "Aluminium profile", steptiles: "Aluminium profile", metcoppo: "Aluminium profile",
  "stone-classic": "Stone-coated", "stone-shingle": "Shingle", "stone-milano": "Stone-coated",
  "stone-roman": "Stone-coated", "standing-seam": "Standing seam", corrugated: "Traditional", "flat-deck": "Concrete/flat",
};

const MAPPED: RoofPattern[] = ROOF_STYLES.map(s => {
  const e = ENRICH[s.id];
  // Every pattern carries 5-8 steps: guide enrichments under 5 get the
  // standard closing check appended (honest generic practice, not filler data).
  const steps = e.installSteps.length >= 5 ? e.installSteps : [...e.installSteps, "Final walk-over: every lap seated, no exposed fasteners, offcuts and sharp edges cleared from the roof."];
  return {
    id: s.id, name: s.name, family: FAMILY_BY_KIND[s.id] || "Aluminium profile",
    pitchRangeDeg: e.pitchRangeDeg, gaugeOptions: s.gauge, overlapMm: e.overlapMm,
    fastenerPattern: s.fixing, bestFor: s.bestFor, avoidWhen: s.watchOut,
    installSteps: steps, commonFixes: e.commonFixes, tools: e.tools, materials: e.materials,
    sketchKind: e.sketchKind, guideKind: s.pattern, visualPattern: e.visualPattern, quoteProfile: e.quoteProfile,
  };
});

export const ROOF_PATTERNS: RoofPattern[] = [...MAPPED, ...ADVANCED];
export const patternById = (id: string) => ROOF_PATTERNS.find(p => p.id === id);
export const PATTERN_FAMILIES: PatternFamily[] = ["Aluminium profile", "Stone-coated", "Shingle", "Standing seam", "Concrete/flat", "Traditional"];

/** Human label for a pattern's laps — used on sketches and cards; always from data. */
export function overlapSummary(p: RoofPattern): string {
  const parts: string[] = [];
  if (p.overlapMm.endMm) parts.push(`End lap ${p.overlapMm.endMm}mm`);
  if (p.overlapMm.sideMm) parts.push(`Side lap ${p.overlapMm.sideMm}mm`);
  return parts.length ? parts.join(" · ") : p.overlapMm.note;
}

// ---------------- Detail cards (areas of the roof) ----------------
// The Pro Guide's area chips resolve to these. Same shape family as
// patterns so one view renders both. Key specs are typical practice.

export type GuideAreaId = "roof-surface" | "valley" | "ridge" | "flashing" | "gutter" | "fascia-soffit" | "leak-hunt";
export const GUIDE_AREAS: { id: GuideAreaId; label: string }[] = [
  { id: "roof-surface", label: "Roof surface" },
  { id: "valley", label: "Valley" },
  { id: "ridge", label: "Ridge" },
  { id: "flashing", label: "Flashing" },
  { id: "gutter", label: "Gutter" },
  { id: "fascia-soffit", label: "Fascia / soffit" },
  { id: "leak-hunt", label: "Leak hunt" },
];

/** Standard valley tray width used across the guide and the valley sketch. */
export const VALLEY_TRAY_WIDTH_MM = 450;

export interface RoofDetail {
  id: Exclude<GuideAreaId, "roof-surface">;
  name: string;
  area: GuideAreaId;
  keySpecs: string[];
  steps: string[];
  commonFixes: PatternFix[];
  tools: string[];
  materials: string[];
  sketchKind: SketchKind;
}

export const ROOF_DETAILS: RoofDetail[] = [
  {
    id: "valley", name: "Valley detail — where two slopes meet", area: "valley",
    keySpecs: [
      `Valley tray ${VALLEY_TRAY_WIDTH_MM}–600mm wide (galv or aluminium), dressed under both slopes`,
      "Underlay carried 150mm past each side of the tray",
      "Valley boards close-butted under the sheeting",
      "Longitudinal tray laps 300mm, sealed; fall along the valley at least 1:200",
      "Tiles/sheets held 100–150mm clear of the valley centre line — an open channel for water",
    ],
    steps: [
      "Fix valley boards level along the valley line; any step in the boards prints through the tray.",
      "Dress underlay down each slope and 150mm past the tray edges.",
      "Lay the tray from eaves to ridge, laps 300mm sealed, edges folded up 25mm as a water check.",
      "Sheet/tile down to the tray keeping the 100–150mm open channel; cut edges dressed, not raw toward the waterway.",
      "Never fix through the centre of the tray — fixings live on the flanges only.",
      "Hose-test the valley from the ridge before moving on.",
    ],
    commonFixes: [
      { problem: "Leak in the valley only during heavy rain", fix: "The channel is bridged by cut tiles/debris or the tray is too narrow for the catchment — clear it, widen the open channel, and check the tray width against the slopes it drains." },
      { problem: "Water escaping the tray sides at the eaves", fix: "Tray edges were not folded up, or the eaves end is cut short — extend the tray past the fascia line and fold 25mm water checks." },
      { problem: "Debris dam forming mid-valley", fix: "A fixing or mortar blob is in the waterway — clear it; valleys must stay a clean, fast channel." },
    ],
    tools: T_ROOF_SEAL,
    materials: ["Valley tray 450–600mm", "Valley boards", "Underlay", "Sealant / butyl tape", "Tray clips"],
    sketchKind: "valley",
  },
  {
    id: "ridge", name: "Ridge detail — capping the top", area: "ridge",
    keySpecs: [
      "Ridge cap girth 400–600mm depending on profile depth",
      "Cap laps at least 100mm, laps facing away from prevailing rain",
      "Foam/profile closers under caps on profiled sheets",
      "Screw both sides of the cap into the sheet crests/purlin line",
      "Stone-coated ridges: ridge board + mortar bed or dry-fix kit",
    ],
    steps: [
      "Finish both slopes at the ridge with the sheet ends close and level — gaps here defeat any cap.",
      "Fit closers along both crests if the profile is open.",
      "Lay caps from the leeward end, laps away from the weather, 100mm minimum.",
      "Fix both sides of every cap; stitch the laps.",
      "Seal cap ends at hips and gables; check the whole line from the ground for a straight read.",
    ],
    commonFixes: [
      { problem: "Ridge caps lifting in storms", fix: "Fixings went into the sheet only, or one side was skipped — re-fix both sides into the purlin/ridge line and stitch every lap." },
      { problem: "Rain blown under the cap", fix: "Closers are missing — fit profile closers and check cap girth covers the profile depth with room for the closer." },
      { problem: "Cracked mortar on stone-coated ridges", fix: "Re-bed the loose ridge tiles or convert to a dry-fix ridge kit; cracked pointing alone is the leak path." },
    ],
    tools: T_ROOF_SEAL,
    materials: ["Ridge caps / ridge tiles", "Profile closers", "Crest screws with washers", "Ridge board (tile roofs)", "Mortar or dry-fix kit", "Sealant"],
    sketchKind: "ridge",
  },
  {
    id: "flashing", name: "Flashing detail — walls, chimneys & junctions", area: "flashing",
    keySpecs: [
      "Upstand at least 150mm up the wall above the roof line",
      "Cover flashing chased 25mm into a mortar joint (or reglet) and wedged + sealed",
      "Apron flashings at the downhill face; soakers/step flashing up stepped walls",
      "Sheet side dressed up under the flashing by at least 75mm",
      "Never rely on surface sealant alone — it is the backup, not the waterproofing",
    ],
    steps: [
      "Measure and fold the apron/soaker pieces on the bench — folded metal beats folded hopes.",
      "Dress the sheeting up the junction by 75mm minimum, or lay soakers with each course on stepped walls.",
      "Set the upstand flashing to 150mm, chase the cover flashing 25mm into the joint, wedge and point it.",
      "Seal the chase with a quality sealant as backup; tool it neat — it is seen from below forever.",
      "Hose-test from below the junction upward, slowly, watching inside.",
    ],
    commonFixes: [
      { problem: "Stain on the ceiling below a chimney/wall", fix: "Nine times in ten it is the flashing, not the field of the roof: check the chase has not cracked out, the upstand height, and that soakers rise with each course." },
      { problem: "Sealant peeling off a face-fixed flashing", fix: "Face-fixed-and-sealed is a temporary repair — re-form with a chased cover flashing so water sheds mechanically, not chemically." },
      { problem: "Back-flashing leak at a parapet", fix: "Check the coping above first: a failed coping joint pours straight behind good flashing. Re-point coping joints, then re-test." },
    ],
    tools: T_ROOF_SEAL,
    materials: ["Flashing coil / formed flashings", "Soakers (step flashing pieces)", "Sealant (backup only)", "Lead wedges / chase fixings", "Flashing tape"],
    sketchKind: "flashing",
  },
  {
    id: "gutter", name: "Gutter detail — falls, outlets & downpipes", area: "gutter",
    keySpecs: [
      "Working fall 1:350–1:600 (≈2–3mm per metre) on typical runs — test other falls on the sketch below",
      "Outlets at the low end; one downpipe per ~40m² of roof plan area",
      "Brackets at 600–900mm centres, closer at outlets and corners",
      "Expansion/union joints sealed per gutter system; never hard-solder PVC",
      "Gutter top edge sits below the sheet drip edge so overflow spills OUTSIDE the fascia",
    ],
    steps: [
      "String a line from the high end at the chosen fall before fixing a single bracket.",
      "Fix brackets to the line at 600–900mm centres; double up at outlets and corners.",
      "Lay the gutter from the outlet backwards, joints sealed per system.",
      "Set the outlet and downpipe; check the shoe discharges clear of the wall base.",
      "Flood-test with a hose at the high end — watch every joint from below.",
    ],
    commonFixes: [
      { problem: "Gutter holds standing water", fix: "A bracket has slipped or the fall was never set — re-string the line and re-grade; standing water breeds mosquitoes and rust." },
      { problem: "Overflow at one corner in storms", fix: "The outlet is undersized or blocked for the catchment — clear it, and add an outlet rather than deepening the gutter." },
      { problem: "Drips behind the gutter onto the wall", fix: "The gutter sits too high or too far out — the sheet drip must land INSIDE the gutter, and overflow must spill outside the fascia, not behind it." },
    ],
    tools: ["Ladder", "Spirit level", "Measuring tape", "Drill machine", "Sealant gun", "Safety boots/gloves"],
    materials: ["Gutter lengths (125/150/200mm)", "Brackets", "Outlet + downpipe + shoe", "Union joints / gutter sealant", "End caps"],
    sketchKind: "gutter",
  },
  {
    id: "fascia-soffit", name: "Fascia & soffit detail — closing the eaves", area: "fascia-soffit",
    keySpecs: [
      "Fascia depth from the eaves geometry — measure with the Eaves & Angles calculator in the Roofing Guide",
      "Sheet overhang past the wall line typically 450–600mm for weather protection",
      "Continuous vent gap 10–25mm at the soffit/wall junction (or vented soffit boards)",
      "Fascia fixed to every rafter tail, joints scarfed and sealed",
      "Soffit boards fixed level back to the wall — sagging soffits start at missing noggins",
    ],
    steps: [
      "Cut rafter tails to one line (the plumb cut) before any board goes on.",
      "Fix the fascia to every rafter tail, joints scarfed at 45° and sealed.",
      "Set noggins/ battens back to the wall for the soffit line.",
      "Fix soffit boards level, leaving the vent gap or fitting vented boards per spec.",
      "Prime/treat all cut ends and the wall-side faces before closing — you will never see them again.",
    ],
    commonFixes: [
      { problem: "Fascia rotting at a corner", fix: "Water is sitting in the scarf joint or the gutter overflows into it — fix the water path first, then splice in treated timber and re-seal the joint." },
      { problem: "Soffit sagging or open at the wall", fix: "Missing noggins: open a section, add support, re-fix level; check for birds/bats using the gap before closing vents with mesh." },
      { problem: "Ceiling stains at the wall head inside", fix: "Wind-driven rain through an unvented/unsealed eaves — check the sheet overhang and the soffit seal line before suspecting the roof field." },
    ],
    tools: ["Ladder", "Scaffold", "Spirit level", "Measuring tape", "Drill machine", "Safety boots/gloves"],
    materials: ["Fascia boards (treated timber / uPVC / fibre-cement)", "Soffit boards (vented where specified)", "Noggins / battens", "Wood treatment / primer", "Sealant"],
    sketchKind: "fascia",
  },
  {
    id: "leak-hunt", name: "Leak hunt — find it like a professional", area: "leak-hunt",
    keySpecs: [
      "Water travels: a stain is where water ARRIVES, rarely where it enters",
      "Check in order: laps & fixings → valleys → flashings → ridge → penetrations",
      "Hose-test in sections, lowest first, 10 minutes per section, one watcher inside",
      "Capillary leaks run UPHILL under laps on shallow pitches",
      "Mark every suspect with chalk and date it — intermittent leaks need evidence, not memory",
    ],
    steps: [
      "Inside first: photograph the stain, note when it leaks (wind direction + rain weight) and map it to the roof above.",
      "On the roof, work from the stain UPHILL — water enters above where it shows.",
      "Inspect the suspects in order: lifted laps, perished washers, valley channel, flashing chases, ridge closers, penetration seals.",
      "Hose-test section by section from the lowest suspect up, watcher inside with a phone — stop the moment it drips and mark the spot.",
      "Fix the cause, then re-test the same section before closing up. Record the fix on the job card.",
    ],
    commonFixes: [
      { problem: "Leak only in wind-driven rain", fix: "Wind is pushing water uphill under a lap or sideways through a valley/flashing — increase laps, add lap tape, and check lap orientation against the prevailing wind." },
      { problem: "Drip far from any roof feature", fix: "Water is tracking along a purlin or the underlay — follow the timber line uphill to the entry point; the stain is just the end of the journey." },
      { problem: "Leak stopped on its own", fix: "Debris dam or a seasonal wind direction — do not close the job; chalk-mark, photograph and revisit in the next storm, or hose-test both wind-side laps." },
    ],
    tools: T_ROOF_SEAL,
    materials: ["Chalk / marker", "Hose + water access", "Flashing tape", "Replacement washers/screws", "Sealant (backup)", "Torch for the roof void"],
    sketchKind: "flashing",
  },
];
export const detailById = (id: string) => ROOF_DETAILS.find(d => d.id === id);

// ---------------- Sketch maths (pure — everything on a sketch is computed) ----------------

/** Gutter fall: drop in mm over a run, at a fall of 1 : ratioDenominator. */
export function gutterFall(runM: number, ratioDenominator = 200): { dropMm: number; dropPerM: number; ratioLabel: string } {
  const run = Math.max(0, runM || 0); const ratio = Math.max(1, ratioDenominator || 200);
  const dropMm = Math.round((run * 1000 / ratio) * 10) / 10;
  return { dropMm, dropPerM: Math.round((1000 / ratio) * 10) / 10, ratioLabel: `1:${ratio}` };
}

/** Slope dimensions of a sheet of slope length L at a pitch. */
export function slopeDims(sheetLengthM: number, pitchDeg: number): { horizontalM: number; verticalM: number; slopeFactor: number } {
  const rad = (Math.max(0, Math.min(89, pitchDeg || 0)) * Math.PI) / 180;
  const L = Math.max(0, sheetLengthM || 0);
  return {
    horizontalM: Math.round(L * Math.cos(rad) * 100) / 100,
    verticalM: Math.round(L * Math.sin(rad) * 100) / 100,
    slopeFactor: Math.round((1 / Math.cos(rad)) * 1000) / 1000,
  };
}

// ---------------- Guided identification ----------------
// Three quick answers narrow the pro to the right card. Pure and testable:
// area beats everything (valley + leak → the valley detail), then material
// picks the pattern, and a plain leak on a surface still lands on the
// pattern whose fixes cover it, with the leak-hunt detail signposted.

export type IdentifyArea = GuideAreaId;
export type IdentifyMaterial = "aluminium" | "stone-coated" | "shingle" | "standing-seam" | "concrete-flat" | "traditional" | "not-sure";
export type IdentifyProblem = "leak" | "damaged" | "forgot-pattern" | "fixings-loose" | "checking";
export interface IdentifyResult { kind: "pattern" | "detail"; id: string; reason: string }

export function identifyGuide(a: { area: IdentifyArea; material: IdentifyMaterial; problem: IdentifyProblem }): IdentifyResult {
  if (a.area !== "roof-surface" && a.area !== "leak-hunt") {
    const d = detailById(a.area);
    return { kind: "detail", id: a.area, reason: `You are working on the ${d ? d.name.split(" — ")[0].toLowerCase() : a.area} — this detail card carries its standard measurements, steps and fixes${a.problem === "leak" ? ", including the leak fixes for this junction" : ""}.` };
  }
  if (a.area === "leak-hunt") {
    return { kind: "detail", id: "leak-hunt", reason: "Start with the leak-hunt method: work uphill from the stain, check laps, valleys and flashings in order, then hose-test in sections." };
  }
  const byMaterial: Record<IdentifyMaterial, { id: string; label: string }> = {
    aluminium: { id: "longspan", label: "aluminium sheeting — Longspan is the reference pattern" },
    "stone-coated": { id: "stone-classic", label: "stone-coated tiles — the Classic/Bond pattern is the reference" },
    shingle: { id: "stone-shingle", label: "shingle-profile tiles" },
    "standing-seam": { id: "standing-seam", label: "standing seam / concealed-fix pans" },
    "concrete-flat": { id: "flat-deck", label: "a flat concrete deck with membrane" },
    traditional: { id: "concrete-tile", label: "heavy traditional tiles" },
    "not-sure": { id: "longspan", label: "the most common sheeting pattern — compare its photo/specs with what is on the roof" },
  };
  const m = byMaterial[a.material] || byMaterial["not-sure"];
  const tail = a.problem === "leak" ? " Its common fixes cover lap and fixing leaks; if the water is at a junction, open the Leak hunt card too." : a.problem === "forgot-pattern" ? " Its laps, fixing pattern and steps are the standard to work to." : "";
  return { kind: "pattern", id: m.id, reason: `That reads as ${m.label}.${tail}` };
}
