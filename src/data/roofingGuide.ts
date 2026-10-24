// Roofing Guide data — anatomy, styles & patterns, standard methods and
// measurements. Every figure here is TYPICAL NIGERIAN PRACTICE, offered as a
// field reference only — always confirm dimensions and manufacturer data on
// site before ordering or fixing.

export interface AnatomyPart {
  id: string; n: number; label: string;
  does: string; material: string; size: string;
  /** marker position in the main SVG viewBox (0 0 840 520) */
  x: number; y: number;
}
export const ANATOMY_PARTS: AnatomyPart[] = [
  { id: "ridge", n: 1, label: "Ridge Cap", does: "Caps the very top of the roof where the two slopes meet, sealing the joint against driven rain and finishing the roof line.", material: "Aluminium ridge roll or stone-coated ridge barrels, colour-matched to the covering.", size: "Girth typically 400–600mm; lengths 2m (aluminium) or ~0.42m per stone-coated piece.", x: 430, y: 160 },
  { id: "hip", n: 2, label: "Hip", does: "The sloped edge where two roof planes meet at an external corner (shown in the plan inset). It sheds water down to the eaves and is capped like the ridge.", material: "Hip caps / ridge pieces to match the covering, bedded on the hip rafter.", size: "Cap girth 400–600mm; hip rafter usually 50×75mm timber or bigger by span.", x: 700, y: 52 },
  { id: "valley", n: 3, label: "Valley", does: "The internal channel where two roof planes meet (plan inset). It collects the most water on the roof, so it must be wide, smooth and unobstructed.", material: "Valley tray in aluminium or galvanised steel, or a formed valley board with membrane.", size: "Tray width typically 450–600mm; keep the open channel clear of fixings.", x: 776, y: 116 },
  { id: "slope", n: 4, label: "Roof Slope (Pitch)", does: "The inclined plane of the roof. Its angle decides which coverings can be used, how laps behave, and how fast water leaves the roof.", material: "Covering sheets or tiles fixed over battens/purlins on rafters.", size: "Measured in degrees or rise-over-run. True slope length = horizontal run ÷ cos(pitch).", x: 322, y: 232 },
  { id: "eaves", n: 5, label: "Eaves", does: "The bottom edge of the slope where the roof overhangs the wall. Rain leaves the roof here, into the gutter.", material: "Sheet ends dressed into the gutter; eaves flashing or closure strips as required.", size: "Overhang typically 450–600mm beyond the wall face.", x: 238, y: 310 },
  { id: "verge", n: 6, label: "Verge (Barge)", does: "The sloped edge at the gable end of the roof. The barge board trims it and the covering must be turned up or capped so wind-driven rain cannot get under.", material: "Barge/verge flashing in matching aluminium, or stone-coated barge tiles.", size: "Barge board typically 150–225mm deep × 25mm thick, following the slope.", x: 292, y: 268 },
  { id: "fascia", n: 7, label: "Fascia Board", does: "The vertical board fixed to the rafter tails at the eaves. It carries the gutter and closes the roof edge.", material: "Timber board (often wrapped in aluminium), aluminium fascia sheet, or uPVC board.", size: "Typically 150, 200 or 225mm deep × 25mm thick.", x: 233, y: 334 },
  { id: "soffit", n: 8, label: "Soffit", does: "The horizontal board closing the underside of the eaves overhang, from the back of the fascia to the wall. Ventilated soffits help the roof space breathe.", material: "Aluminium soffit sheet, PVC ceiling boards, treated timber T&G, or cement board.", size: "Width = eaves projection less the fascia thickness (about 25mm).", x: 272, y: 356 },
  { id: "gutter", n: 9, label: "Gutter & Downpipe", does: "Collects the water at the eaves and carries it down the wall to the drainage. Sized to the roof catchment so it does not overflow in heavy rain.", material: "Aluminium gutter (half-round, box or OG profile) with matching downpipes, outlets and brackets.", size: "Half-round 100/125mm typical; allow one downpipe per roughly 40–50m² of roof area.", x: 214, y: 366 },
  { id: "flashing", n: 10, label: "Flashing", does: "Metal sealing where the roof meets a wall, chimney or parapet — the most common leak point on any roof when done badly.", material: "Aluminium or lead flashing with a separate counter-flashing chased into the wall.", size: "Upstand at least 150mm above the roof surface; counter-flashing chased ~25mm into the wall and sealed.", x: 540, y: 226 },
  { id: "battens", n: 11, label: "Battens & Purlins", does: "The horizontal timber (or steel) members the covering is fixed to. Battens carry tiles at a fixed gauge; purlins carry sheets and span between rafters/trusses.", material: "Treated timber 50×50mm battens; purlins 50×75mm or 50×100mm by span and load.", size: "Tile batten gauge typically 345–350mm; purlin spacing depends on sheet gauge — see Methods.", x: 356, y: 262 },
  { id: "joist", n: 12, label: "Ceiling Joist Line", does: "The horizontal timbers at wall-plate level that carry the ceiling and tie the walls together against the outward push of the rafters.", material: "Timber typically 50×100mm or 50×150mm, with noggins for ceiling boards/POP.", size: "Spacing commonly 600–1200mm centres depending on span and ceiling type.", x: 478, y: 316 },
  { id: "wallplate", n: 13, label: "Wall Plate", does: "The timber bedded level on top of the wall/ring beam. Rafters and trusses sit on it, and it spreads their load along the wall.", material: "Treated hardwood typically 75×100mm (3×4in), strapped down to the wall.", size: "Must be level and continuous; straps at roughly 1.2–2m centres in exposed areas.", x: 306, y: 308 },
];

export type PatternKind = "longspan" | "steptiles" | "metcoppo" | "stone-classic" | "stone-shingle" | "stone-milano" | "stone-roman" | "standing-seam" | "corrugated" | "flat";
export interface RoofStyleInfo {
  id: string; name: string; pattern: PatternKind;
  minPitch: string; gauge: string; coverWidth: string;
  fixing: string; laps: string; bestFor: string; watchOut: string;
}
export const ROOF_STYLES: RoofStyleInfo[] = [
  { id: "longspan", name: "Aluminium Longspan", pattern: "longspan", minPitch: "5° (7.5°+ preferred for very long sheets)", gauge: "0.45 / 0.50 / 0.55mm", coverWidth: "1000mm effective", fixing: "Self-drilling screws with EPDM washers through the crest into purlins", laps: "Side lap 1 rib; end lap 150–300mm by pitch", bestFor: "Homes, churches, warehouses — cut to exact slope length, fewest joints of any sheet system.", watchOut: "Oil-canning (wavy look) on wide flat pans in harsh sun; walk only on purlin lines." },
  { id: "steptiles", name: "Steptiles (Aluminium Step-Tile)", pattern: "steptiles", minPitch: "10°", gauge: "0.50 / 0.55mm", coverWidth: "~960–1000mm effective", fixing: "Self-drilling screws through the step profile into battens/purlins", laps: "Side lap 1 profile step; end lap follows the step (min ~150mm)", bestFor: "Houses that want the tiled look in lightweight aluminium.", watchOut: "Steps must align course to course — set out from the eaves, not the ridge." },
  { id: "metcoppo", name: "Metcoppo", pattern: "metcoppo", minPitch: "10°", gauge: "0.50mm typical", coverWidth: "960mm effective (Oketex catalog)", fixing: "Self-drilling screws with EPDM washers, fixed on the crown of the profile", laps: "Side lap 1 corrugation of the tile profile; end lap 150–200mm", bestFor: "Residential roofs wanting a Mediterranean tile profile in aluminium.", watchOut: "Profile is directional — sheets must all run the same way; check before cutting." },
  { id: "stone-classic", name: "Stone-Coated — Classic / Bond", pattern: "stone-classic", minPitch: "12–15°", gauge: "0.45mm steel core, stone-chip coated", coverWidth: "~0.48m² effective per tile (1290×370mm exposed)", fixing: "Nails/screws through the tile nose into battens at the tile gauge", laps: "Head lap ~80–100mm set by the tile gauge; side lap 1 tile rib", bestFor: "Premium homes — quiet in rain, strong colour warranty class.", watchOut: "Never fix through the water channel of the tile; touch up cut edges to protect the steel core." },
  { id: "stone-shingle", name: "Stone-Coated — Shingle", pattern: "stone-shingle", minPitch: "12–15°", gauge: "0.45mm steel core, stone-chip coated", coverWidth: "~0.48m² effective per tile", fixing: "As Classic — battens at tile gauge, fixings hidden by the course above", laps: "As Classic; keep the flat shingle pattern aligned across the slope", bestFor: "Low-profile modern roofs that want texture without deep ribs.", watchOut: "Flat profile shows batten unevenness — battens must be packed level." },
  { id: "stone-milano", name: "Stone-Coated — Milano", pattern: "stone-milano", minPitch: "12–15°", gauge: "0.45mm steel core, stone-chip coated", coverWidth: "~0.48m² effective per tile", fixing: "As Classic — battens at tile gauge", laps: "As Classic; the deep roll profile needs its matching ridge/barge pieces", bestFor: "Bold Mediterranean-style roofs with a deep, shadowed profile.", watchOut: "Deep profile uses more ridge and valley accessories — count them in the BOQ." },
  { id: "stone-roman", name: "Stone-Coated — Roman", pattern: "stone-roman", minPitch: "12–15°", gauge: "0.45mm steel core, stone-chip coated", coverWidth: "~0.48m² effective per tile", fixing: "As Classic — battens at tile gauge", laps: "As Classic; align the double-roll pattern at valleys", bestFor: "Classic double-roll tile look on family homes.", watchOut: "Valley cuts on the roll profile waste more material — allow extra tiles." },
  { id: "standing-seam", name: "Standing Seam", pattern: "standing-seam", minPitch: "3–5° (system-dependent)", gauge: "0.50–0.70mm aluminium or coated steel", coverWidth: "400–500mm pan, seams ~25–65mm high", fixing: "Concealed clips — no exposed screws through the sheet", laps: "Seamed joints (single/double lock); end laps usually avoided — sheets run full slope", bestFor: "Low-pitch and architectural roofs; the cleanest modern finish.", watchOut: "Needs the right seaming tools and trained installers; thermal movement must be allowed at clips." },
  { id: "corrugated", name: "Corrugated (Old-Style)", pattern: "corrugated", minPitch: "10–15°", gauge: "0.30–0.45mm typical (zinc & aluminium)", coverWidth: "900mm effective (Oketex 3m sheets)", fixing: "Roofing screws/nails with washers through the crest", laps: "Side lap 1–2 corrugations; end lap 150–250mm by pitch", bestFor: "Budget roofs, boys' quarters, workshops, temporary structures.", watchOut: "Thin gauges dent and corrode sooner; low pitches leak at laps — seal low-pitch end laps." },
  { id: "flat-deck", name: "Flat / Concrete Deck", pattern: "flat", minPitch: "Falls of 1:60 minimum to outlets (not a pitch)", gauge: "Waterproofing system — felt, membrane or liquid coating over screeded deck", coverWidth: "Full deck coverage, lapped membrane sheets", fixing: "Bonded/torched membrane; parapet upstands and outlet detailing decide success", laps: "Membrane laps 75–100mm, sealed; upstands min 150mm at parapets", bestFor: "Roof terraces, hidden roofs behind parapets, commercial decks.", watchOut: "Ponding is failure — falls must be formed in the screed, and outlets kept clear." },
];

export interface MethodGroup { title: string; rows: { topic: string; spec: string }[] }
export const METHOD_GROUPS: MethodGroup[] = [
  { title: "Eaves, Fascia & Soffits", rows: [
    { topic: "Eaves overhang", spec: "450–600mm beyond the wall face is typical practice — enough to throw water clear of the wall and shade the top of the wall." },
    { topic: "Fascia boards", spec: "150, 200 or 225mm deep × 25mm thick. The fascia must be straight and level — the gutter and the whole roof edge read off it." },
    { topic: "Soffit options", spec: "Aluminium soffit sheet, PVC ceiling boards, treated timber T&G, or cement board. Ventilated soffit strips help hot roof spaces breathe." },
    { topic: "Rafter tails", spec: "Cut plumb (vertical face) for a plumb fascia, or level (horizontal) for a level soffit return — decide before cutting; mixing the two looks broken." },
  ] },
  { title: "Gutters & Rainwater", rows: [
    { topic: "Gutter profiles", spec: "Half-round 100mm and 125mm are the common residential sizes; box and OG profiles carry more water for big roofs." },
    { topic: "Gutter fall", spec: "Lay gutters to a fall of about 1:350 to 1:600 toward the outlet — roughly 2–3mm drop per metre of run. A level gutter ponds and overflows at the joints." },
    { topic: "Downpipes", spec: "Allow one downpipe per roughly 40–50m² of roof catchment; 75mm pipe for small areas, 100mm for larger. Discharge away from the foundation." },
    { topic: "Bracket spacing", spec: "Gutter brackets typically every 600–900mm, and either side of outlets and corners." },
  ] },
  { title: "Battens, Purlins & Structure", rows: [
    { topic: "Tile batten gauge", spec: "Battens for interlocking tiles are set at the tile gauge — typically 345–350mm for standard tiles; stone-coated tiles follow the tile maker's gauge (about 370mm exposed for a 420mm tile)." },
    { topic: "Purlin spacing — longspan", spec: "Typically up to about 1.2m centres for 0.45mm and 1.5m for 0.55mm on residential spans — the engineer's design governs on wide spans." },
    { topic: "Wall plate", spec: "75×100mm treated hardwood bedded level on the ring beam, strapped down. Every rafter/truss position reads off it." },
    { topic: "Timber treatment", spec: "Treat all roof timber against termites and borers before fixing; keep cut ends re-treated on site." },
  ] },
  { title: "Laps & Fixings", rows: [
    { topic: "Sheet end laps", spec: "By pitch: about 150mm on steep roofs (30°+), 200mm mid-pitch, and 250–300mm on low pitches (under 15°) — low pitches hold water longer at the lap." },
    { topic: "Side laps", spec: "Longspan: 1 rib. Corrugated: 1–2 corrugations. Always lap away from the prevailing rain-bearing wind where you can." },
    { topic: "Screw pattern", spec: "Fix on the crest (never in the valley where water runs): every crest at eaves, ridge and laps, and on every purlin line — typically 6–8 self-drilling screws with EPDM washers per m²." },
    { topic: "Stone-coated fixings", spec: "About 12 nails/screws per m² through the tile nose into battens (the Oketex estimator's allowance), hidden by the next course." },
  ] },
  { title: "Ridges, Valleys & Flashings", rows: [
    { topic: "Ridge cap girth", spec: "400–600mm girth covers both slopes generously; close the profile gaps at the ridge with foam closures or folded ends so birds and driven rain stay out." },
    { topic: "Valley tray", spec: "450–600mm wide, laid smooth with no fixings in the open water channel; tiles/sheets cut clear of the centre line." },
    { topic: "Flashing upstand", spec: "At least 150mm up the wall above the roof surface, with a counter-flashing chased about 25mm into the wall and sealed — never rely on surface sealant alone." },
    { topic: "Abutments", spec: "Where a slope dies into a wall, use a proper abutment flashing dressed over the last profile crest, not cement fillets (they crack within a season)." },
  ] },
];
export const PITCH_MINIMUMS: { material: string; minimum: string; note: string }[] = [
  { material: "Aluminium Longspan", minimum: "5°", note: "7.5°+ preferred on very long single sheets" },
  { material: "Steptiles / Metcoppo", minimum: "10°", note: "Profile steps need fall to clear water" },
  { material: "Stone-Coated Tiles", minimum: "12–15°", note: "Per tile manufacturer; steeper is safer" },
  { material: "Standing Seam", minimum: "3–5°", note: "Double-lock systems go lowest" },
  { material: "Corrugated Sheets", minimum: "10°", note: "Seal laps below 15°" },
  { material: "Concrete Interlocking Tiles", minimum: "17.5–22.5°", note: "By tile profile and head lap" },
  { material: "Flat Concrete Deck", minimum: "1:60 fall", note: "Formed in screed to outlets — never dead flat" },
];

// ---------------- Eaves & angles math (importable / testable) ----------------
export interface EavesResult {
  projectionM: number; dropM: number; plumbCutDeg: number;
  fasciaExposureM: number; soffitWidthM: number;
}
/**
 * Eaves geometry. The overhang input is the rafter-tail length measured ALONG
 * THE SLOPE from the outside wall face to the tail end.
 *  - horizontal projection = slopeLen × cos(pitch)
 *  - vertical drop         = slopeLen × sin(pitch)
 *  - plumb-cut angle       = pitch (the tail's vertical cut face tilts by the pitch from the square cut)
 *  - fascia exposure       = rafter depth ÷ cos(pitch) — the vertical height of the plumb-cut face
 *  - soffit width          = projection − fascia thickness
 */
export function eavesCalc(pitchDeg: number, slopeOverhangM: number, rafterDepthM = 0.15, fasciaThicknessM = 0.025): EavesResult {
  const rad = (pitchDeg * Math.PI) / 180;
  const projection = slopeOverhangM * Math.cos(rad);
  const drop = slopeOverhangM * Math.sin(rad);
  const fasciaExposure = rafterDepthM / Math.cos(rad);
  const soffitWidth = Math.max(0, projection - fasciaThicknessM);
  return { projectionM: projection, dropM: drop, plumbCutDeg: pitchDeg, fasciaExposureM: fasciaExposure, soffitWidthM: soffitWidth };
}
export const pitchFromRiseRun = (rise: number, run: number): number => (run > 0 ? (Math.atan(rise / run) * 180) / Math.PI : 0);
