// All-trades guide cards — the Pro Guide beyond roofing. Same card shape
// as the roofing details (where used, key specs, steps, fixes, tools,
// materials) so one view renders everything and the living knowledge
// store can grow every trade the same way. Materials and patterns agree
// with the Estimator's style recipes (src/data/styleRecipes.ts) wherever
// a recipe exists (styleId links back to it). Sketches stay roofing-only
// in this pass — non-roofing cards carry no sketch section. NO PRICES:
// quantities and typical practice only; confirm on site.
import type { GuideTrade, PatternFix } from "./roofPatterns";

export interface TradeGuideCard {
  id: string;
  trade: Exclude<GuideTrade, "Roofing">;
  name: string;
  kind: "pattern" | "detail";
  whereUsed: string;
  keySpecs: string[];
  steps: string[];
  commonFixes: PatternFix[];
  tools: string[];
  materials: string[];
  /** Estimator style recipe this card agrees with, when one exists. */
  styleId?: string;
}

const T_PLUMB = ["Pipe wrench", "Water pump pliers", "Spirit level", "Measuring tape", "Drill machine"];
const T_TILE = ["Trowel", "Spirit level", "Measuring tape", "Angle grinder", "Safety boots/gloves"];
const T_CARP = ["Drill machine", "Spirit level", "Measuring tape", "Ladder", "Safety boots/gloves"];
const T_ELEC = ["Drill machine", "Spirit level", "Measuring tape", "Ladder", "Safety boots/gloves"];
const T_PAINT = ["Trowel", "Spirit level", "Ladder", "Scaffold", "Measuring tape"];
const T_MASON = ["Trowel", "Spirit level", "Measuring tape", "Ladder", "Safety boots/gloves"];
const T_WELD = ["Welding machine", "Angle grinder", "Measuring tape", "Spirit level", "Safety boots/gloves"];

export const TRADE_CARDS: TradeGuideCard[] = [
  // ---------------- Plumbing ----------------
  {
    id: "plumb-soil-waste", trade: "Plumbing", name: "Soil & waste pipe layout", kind: "detail",
    whereUsed: "Every bathroom/WC stack — the falls decide whether the system works for decades or blocks monthly.",
    keySpecs: ["Soil pipe 110mm uPVC; waste branches 40–50mm", "Falls: 1:40 to 1:60 on branches — too steep is as bad as too flat (water outruns solids)", "Every fixture trapped; vent the stack to open air above the roof", "Inspection eyes at every change of direction and at the stack base"],
    steps: [
      "Set out the stack position first — shortest, straightest run to the chamber/septic.",
      "Dry-fit the whole branch run and mark falls with a level before any solvent weld.",
      "Weld from the stack outward, keeping the fall continuous — no bellies, no back-falls.",
      "Fit inspection eyes where the run changes direction; you will thank yourself at the first blockage.",
      "Water-test every joint before the floor or wall closes over it.",
    ],
    commonFixes: [
      { problem: "Frequent blockages on one branch", fix: "Check the fall: a belly or a too-steep section is the usual cause. Re-grade the branch to a steady 1:40–1:60 and add an inspection eye at the bend." },
      { problem: "Bad smell from a bathroom drain", fix: "A dry or missing trap, or an unvented stack siphoning traps — refill/replace the trap and confirm the stack vents to open air." },
    ],
    tools: T_PLUMB, materials: ["110mm soil pipe + bends", "40/50mm waste pipe", "P-traps / bottle traps", "Solvent cement", "Inspection eyes", "Vent cowl"],
  },
  {
    id: "plumb-ppr-runs", trade: "Plumbing", name: "PPR hot & cold water runs", kind: "pattern", styleId: "plumbing-modern",
    whereUsed: "Modern concealed water supply — PPR fusion-welded pipework for kitchens and bathrooms.",
    keySpecs: ["PPR pipe 20mm branches / 25mm mains typical residential", "Fusion weld: pipe and socket heated together, joined in one push, held still to cool", "Allow expansion loops on long hot runs", "Pressure-test at working pressure +50% before concealing"],
    steps: [
      "Plan runs to minimise joints inside walls — every concealed joint is a future excavation.",
      "Cut pipe square, mark the weld depth on the pipe end.",
      "Heat pipe and fitting together for the maker's time for that diameter — no more, no less.",
      "Join in one straight push to the depth mark; hold still — never twist a cooling joint.",
      "Pressure-test the whole system and leave it under pressure while walls are closed.",
    ],
    commonFixes: [
      { problem: "Weeping at a fusion joint", fix: "A moved or under-heated joint cannot be re-melted in place — cut it out and weld a fresh section with couplings." },
      { problem: "Low pressure at one tap only", fix: "Check the tap's filter/aerator and the isolation valve on that branch before opening any pipework." },
    ],
    tools: T_PLUMB, materials: ["PPR pipe 20/25mm", "PPR elbows/tees/couplings", "Fusion welding machine (site kit)", "Threaded transition fittings", "Isolation valves"],
  },
  {
    id: "plumb-wc-basin", trade: "Plumbing", name: "WC & basin setting", kind: "pattern", styleId: "plumbing-bathroom",
    whereUsed: "Bathroom suites — water closet, wash basin and shower points set to standard heights.",
    keySpecs: ["WC outlet centre typically 200–250mm from finished wall (confirm the pan)", "Basin rim height 800–850mm; taps on 150mm centres typical", "Shower mixer at 1000–1100mm, head at 2000–2100mm", "Isolate every fixture with its own valve"],
    steps: [
      "Confirm finished floor level first — every height is measured from FFL, not the slab.",
      "Set the WC connector and waste before tiling reaches the pan position.",
      "Fix the cistern/pan level and square; a rocking pan breaks its seal within months.",
      "Set basin brackets dead level at rim height; seal the wall junction after testing.",
      "Fill, flush and drain-test everything; check every trap and flex connection dry with tissue.",
    ],
    commonFixes: [
      { problem: "WC rocks and the base seal leaks", fix: "The floor is off level or bolts are uneven — lift, level the bed, renew the seal and re-fix evenly. Never pack a pan with cement blobs." },
      { problem: "Cistern keeps running", fix: "Flush valve seal or float level: clean/replace the seal washer and set the float so water stops 25mm below the overflow." },
    ],
    tools: T_PLUMB, materials: ["WC suite + connector", "Wash basin + taps", "P-traps", "Flexible connectors", "Isolation valves", "Silicone sealant"],
  },
  {
    id: "plumb-kitchen-waste", trade: "Plumbing", name: "Kitchen sink & waste run", kind: "pattern", styleId: "plumbing-kitchen",
    whereUsed: "Kitchen sinks, dishwasher/washing-machine standpipes and waste falls to the gully.",
    keySpecs: ["Sink waste 40mm minimum with a deep-seal trap", "Appliance standpipe 600mm high with its own trap", "Waste fall 1:40 steady to the gully — no dips", "Sink centre typically 450mm from the corner unit line — confirm the cabinet plan"],
    steps: [
      "Set the waste out position from the cabinet plan before first-fix walls close.",
      "Run the waste with a continuous fall; support long runs so they cannot sag into bellies.",
      "Fit the trap directly under the sink outlet — S-traps siphon; use P-traps into the wall.",
      "Standpipe for appliances with an air gap above the trap water line.",
      "Fill the sink to the overflow and release — watch every joint while it drains.",
    ],
    commonFixes: [
      { problem: "Sink drains slowly and gurgles", fix: "Partial blockage or a siphoning trap: clear the run, then check the trap type and the fall; gurgling means air is being pulled through the trap seal." },
      { problem: "Smell under the sink", fix: "A leaking trap joint or an unused appliance standpipe dried out — reseal the joint and cap or water-fill the standpipe trap." },
    ],
    tools: T_PLUMB, materials: ["Sink waste kit + P-trap", "40mm waste pipe", "Standpipe + trap", "Basket waste + overflow", "Pipe clips/supports"],
  },
  // ---------------- Tiling ----------------
  {
    id: "tile-herringbone", trade: "Tiling", name: "Herringbone floor pattern", kind: "pattern", styleId: "tiling-herringbone",
    whereUsed: "Feature floors and hallways in plank tiles — the 45° zigzag that reads premium instantly.",
    keySpecs: ["Set out at 45° from the longest wall; the pattern is unforgiving of a crooked start", "Order +10–15% extra for cuts (the Estimator recipe carries the same allowance)", "Work from a dry-laid first square metre — check the zigzag closes before adhesive", "Grout joints 2–3mm with spacers; movement joints at perimeters"],
    steps: [
      "Find the room centre lines and snap the 45° set-out lines from them.",
      "Dry-lay the first square metre and confirm the pattern closes without slivers.",
      "Adhesive in small sections; lay to the lines, checking the zigzag points stay on line.",
      "Cut borders last, once the field is fixed and true.",
      "Grout after the adhesive cures; wash joints even and seal the perimeter movement joint with silicone.",
    ],
    commonFixes: [
      { problem: "Pattern drifts and points stop meeting", fix: "Drift starts in the first metre — strip back to the last true section and re-lay to fresh chalk lines; never chase drift with widening joints." },
      { problem: "Hollow sound under tiles", fix: "Adhesive coverage was spot-bedded — lift the tile, back-butter fully and re-bed; floors need near-100% coverage." },
    ],
    tools: T_TILE, materials: ["Plank tiles (+10–15%)", "Tile adhesive", "2–3mm spacers", "Grout", "Notched trowel (in kit)", "Silicone for perimeter"],
  },
  {
    id: "tile-large-format", trade: "Tiling", name: "Large-format wall & floor tiles", kind: "pattern", styleId: "tiling-largeformat",
    whereUsed: "600×1200 and larger porcelain slabs on feature walls and floors — minimal joints, maximum flatness demanded.",
    keySpecs: ["Substrate flatness decides everything: max 3mm deviation over 2m", "Back-butter every tile AND comb the wall — comb in one direction for air escape", "Levelling clips to kill lippage between slabs", "Stagger joints by no more than 1/3 of tile length to avoid the bow in rectified tiles"],
    steps: [
      "Prove the substrate with a 2m straightedge; make good before tiling, not with adhesive.",
      "Set out so cuts land balanced at both ends — no slivers under 1/3 tile.",
      "Comb adhesive one direction on the wall, back-butter the tile, slide it home to collapse the ridges.",
      "Clip every joint with levelling wedges; check faces with the straightedge as you go.",
      "Leave clips to cure fully before knocking them out; grout with the specified joint width.",
    ],
    commonFixes: [
      { problem: "Lippage (edges standing proud)", fix: "Tiles are bowed or clips were skipped — use levelling clips on every joint and keep the 1/3 stagger rule; severe bow means the batch suits floors with wider joints." },
      { problem: "Tile debonds with clean adhesive ridges", fix: "Adhesive skinned over before the tile landed — work smaller areas, comb fresh, and back-butter." },
    ],
    tools: T_TILE, materials: ["Large-format porcelain tiles", "Flexible tile adhesive (S1 class)", "Levelling clips + wedges", "Suction lifters (site kit)", "Grout"],
  },
  {
    id: "tile-mosaic", trade: "Tiling", name: "Mosaic sheet tiling", kind: "pattern", styleId: "tiling-mosaic",
    whereUsed: "Bathroom feature bands, splashbacks and pool/wet areas — small pieces on mesh sheets.",
    keySpecs: ["Sheet joints must disappear: align sheet gaps to the piece joint width", "White adhesive for glass/light mosaics — grey shows through", "Beat sheets in with a grout float for a flat plane, never fingers", "Epoxy grout in wet areas per the recipe notes"],
    steps: [
      "Set out the field so sheet edges land invisibly; mark every sheet line.",
      "Comb a thin, even adhesive bed — too thick squeezes through the joints.",
      "Lay sheets and beat them flat with the float; check the plane with a straightedge often.",
      "Adjust within the open time — once it grabs, sheet lines telegraph through.",
      "Grout the whole area in one session for a uniform colour; wash carefully.",
    ],
    commonFixes: [
      { problem: "Sheet lines visible as a grid", fix: "Sheet gaps were wider than piece joints — on the next section set sheet spacing with a loose piece as the gauge; grout colour matched to the pieces hides minor sins." },
      { problem: "Pieces slump on a wall", fix: "Adhesive too wet/thick — use a finer notch and a stiffer mix; support the bottom row until it grabs." },
    ],
    tools: T_TILE, materials: ["Mosaic sheets", "White tile adhesive (light mosaics)", "Fine-notch trowel (in kit)", "Grout / epoxy grout (wet areas)", "Grout float (in kit)"],
  },
  {
    id: "tile-subway", trade: "Tiling", name: "Subway brick-bond walls", kind: "pattern", styleId: "tiling-subway",
    whereUsed: "Kitchen splashbacks and bathroom walls in 100×200/75×150 metro tiles, half-bond.",
    keySpecs: ["Half-bond: every course offset by half a tile — set the first course, the rest follow", "Start from a level datum batten, never from a sloping counter/floor", "Vertical joints must stay plumb through the bond — check every third course", "Trim the cut edges at ends; alternate cut pieces to keep the bond honest"],
    steps: [
      "Fix a level datum batten one course up from the worktop/floor line.",
      "Lay the first course to a string line; mark half-tile points for the bond.",
      "Build up course by course, spacer every joint, plumb-check the verticals.",
      "Remove the batten and tile the bottom course in last, cut to the worktop.",
      "Grout, then silicone the worktop junction — grout alone cracks there.",
    ],
    commonFixes: [
      { problem: "Bond wanders and joints creep", fix: "Spacers were skipped on verticals — re-set from the last true course; creep cannot be corrected higher up." },
      { problem: "Cracked grout at the worktop line", fix: "That junction is a movement joint — rake out and replace with silicone." },
    ],
    tools: T_TILE, materials: ["Subway/metro tiles", "Tile adhesive", "2mm spacers", "Grout", "Silicone (junction)", "Datum battens"],
  },
  // ---------------- Carpentry & Woodwork ----------------
  {
    id: "carp-flush-door", trade: "Carpentry & Woodwork", name: "Flush door hanging", kind: "pattern", styleId: "woodwork-flush",
    whereUsed: "Internal flush/HDF doors on timber frames — the standard internal door of Nigerian housing.",
    keySpecs: ["3 hinges per door (top hinge carries the load — never 2 on a solid door)", "Gaps: 2–3mm sides and head, 8–10mm at the floor over finishes", "Frame set plumb both faces before the door is offered up", "Latch keep aligned to the latch bolt centre — mark from the hung door, not the drawing"],
    steps: [
      "Prove the frame is plumb, square and fixed solid; plane/pack it true first.",
      "Offer the door, scribe to the frame, plane to 2–3mm gaps all round.",
      "Chop hinge recesses in door and frame to the leaf thickness — hinge knuckle outside the frame line.",
      "Hang on 3 hinges, swing-test, then mark and fit latch and keep from the actual door.",
      "Seal all edges (especially top and bottom) before final hanging — unsealed edges drink moisture and swell.",
    ],
    commonFixes: [
      { problem: "Door binds at the top corner in rainy season", fix: "Unsealed edges swelled — take the door down, dry it, ease the edge a shaving at a time and seal every edge before rehanging." },
      { problem: "Latch misses the keep", fix: "Frame moved or the keep was marked from drawings — re-mark from the hung door and deepen/raise the keep mortise." },
    ],
    tools: T_CARP, materials: ["Flush/HDF door slab", "3× butt hinges + screws", "Latch + handles + keep", "Timber frame", "Wood sealant/primer"],
  },
  {
    id: "carp-wardrobe", trade: "Carpentry & Woodwork", name: "Wardrobe carcass build", kind: "pattern", styleId: "woodwork-wardrobe",
    whereUsed: "Built-in and free-standing wardrobes in HDF/MDF board with hanging rails and shelves.",
    keySpecs: ["Hanging rail 400–500mm deep zone; long-hang drop 1400–1600mm, double-hang 900mm each", "Shelf spans over 800mm need a centre support or they bow", "Carcass must be squared before the back goes on — the back locks the square", "Wall units fixed into studs/blockwork, never into plaster alone"],
    steps: [
      "Measure the alcove at three heights — walls are never the same twice; build to the smallest.",
      "Cut and edge-band all panels before assembly; label every piece.",
      "Assemble the carcass flat, check diagonals equal, then fix the back to lock it.",
      "Stand, level and fix to the wall; fit rails at the planned drops and shelves on supports.",
      "Hang doors/drawers last and adjust gaps even all round.",
    ],
    commonFixes: [
      { problem: "Doors sit twisted with uneven gaps", fix: "The carcass is out of square or the floor is off — re-level the carcass on packers before adjusting hinges; hinge adjustment cannot fix a racked box." },
      { problem: "Shelf bowing under clothes", fix: "Span too long for the load — add a centre support or a front lipping rail." },
    ],
    tools: T_CARP, materials: ["HDF/MDF boards 18mm", "Edge banding", "Hanging rails + sockets", "Hinges/runners", "Screws + wall fixings"],
  },
  {
    id: "carp-kitchen-cabinets", trade: "Carpentry & Woodwork", name: "Kitchen cabinet run", kind: "pattern", styleId: "woodwork-kitchen",
    whereUsed: "Base and wall kitchen cabinets — the run must be level for the worktop and appliances to sit right.",
    keySpecs: ["Base units: worktop height 900–920mm finished", "Wall units bottom at 1400–1500mm (450–600mm above worktop)", "One level datum line around the whole room — every unit hangs off it", "Appliance gaps: allow maker's clearance, typically +5–10mm on nominal 600mm"],
    steps: [
      "Snap the datum line at worktop height around the room from the highest floor point.",
      "Fit wall units first (no bending over bases), fixed into solid structure on the datum.",
      "Set bases on adjustable legs to the datum, level front-to-back and along the run.",
      "Scribe filler pieces to walls; fix units together through the front rails.",
      "Template the worktop only after every unit is final and level.",
    ],
    commonFixes: [
      { problem: "Worktop rocks or gaps at the wall", fix: "A base is off the datum — find it with the level along the run and adjust legs; never pack the worktop itself." },
      { problem: "Doors collide at a corner", fix: "Corner geometry needs a filler/void per the plan — fit the corner filler and re-set the door swing." },
    ],
    tools: T_CARP, materials: ["Cabinet carcasses (HDF)", "Adjustable legs", "Wall fixing rails/brackets", "Doors + soft-close hinges", "Worktop (templated after)"],
  },
  {
    id: "carp-panel-finishes", trade: "Carpentry & Woodwork", name: "HDF/MDF panel finishing", kind: "detail", styleId: "woodwork-hdf",
    whereUsed: "Painted and laminated board finishes — wardrobes, wall panelling, TV units.",
    keySpecs: ["Seal MDF edges twice — edges drink paint and stay rough otherwise", "Sand between coats (240 grit) for a furniture finish", "Laminate: contact adhesive both faces, roll from centre out, trim with a bearing bit/file", "Keep panels off wet floors on site — one wet edge ruins a board"],
    steps: [
      "Cut, dry-fit and label everything before any finish touches a panel.",
      "Seal all edges and faces with primer/sealer; let it cure fully.",
      "Sand, dust off, first coat; sand again lightly between coats.",
      "Laminate work: dry-fit, glue both faces, roll centre-out, trim flush.",
      "Assemble with finished faces protected — finish first, assemble second, touch up last.",
    ],
    commonFixes: [
      { problem: "Rough, furry MDF edges after painting", fix: "Edges were not sealed — sand back, seal twice with primer, then repaint; paint alone never fixes a thirsty edge." },
      { problem: "Laminate bubbling", fix: "Air was trapped or adhesive was one-sided — pin-prick and roll small bubbles; large areas must be lifted and re-laid with adhesive on both faces." },
    ],
    tools: T_CARP, materials: ["HDF/MDF boards", "Primer/sealer", "Paint or laminate + contact adhesive", "Edge banding + iron (site kit)", "Abrasive papers"],
  },
  // ---------------- Electrical ----------------
  {
    id: "elec-conduit-wiring", trade: "Electrical", name: "PVC conduit & wiring runs", kind: "detail",
    whereUsed: "Concealed and surface conduit systems for lighting and power in residential builds.",
    keySpecs: ["Conduit runs vertical/horizontal only — never diagonal in walls", "Draw wires AFTER plaster; leave draw wire/rope in every run", "Circuits separated: lighting and power on different conduits and breakers", "Fill: leave spare capacity — max ~40% of conduit cross-section in wires"],
    steps: [
      "Mark every point (sockets, switches, lights) on the wall from the electrical plan and furniture layout.",
      "Chase and fix conduit with boxes at every point; runs plumb and level only.",
      "Prove every run with a draw wire before plastering — a blocked conduit found later costs a wall.",
      "After plaster and painting, draw cables, leaving 150mm tails at every box.",
      "Test continuity and insulation before terminating a single accessory.",
    ],
    commonFixes: [
      { problem: "Cannot pull cable through a run", fix: "A joint has slipped or debris is in the conduit — blow/rod the run; if a joint parted inside the wall, the chase must open at the joint. Prevention: prove with draw wire before plaster." },
      { problem: "Breaker trips when one socket is used", fix: "Isolate: unplug everything on the circuit, restore, then add loads one by one — the last one added is the suspect; check its flex and plug before suspecting the wiring." },
    ],
    tools: T_ELEC, materials: ["PVC conduit 20/25mm + boxes", "Draw wire", "Cables (sizes per circuit design)", "Accessories (sockets/switches)", "Breakers (per design)"],
  },
  {
    id: "elec-db-setup", trade: "Electrical", name: "Distribution board & circuit split", kind: "detail",
    whereUsed: "The consumer unit — how circuits are split, protected and labelled.",
    keySpecs: ["Split loads: lighting / sockets / kitchen / AC / water heater on separate breakers", "RCD/RCBO protection on socket circuits (30mA) as standard practice", "Every breaker labelled with the circuit it feeds — an unlabelled board is unfinished work", "Balance phases on 3-phase supplies; never load one phase with the whole house"],
    steps: [
      "List every load in the building and group into circuits by room and duty.",
      "Size breakers to the cable, not the load wish — the breaker protects the cable.",
      "Terminate neatly: tails dressed, no stray strands, earths sleeved and landed.",
      "Label every way before energising; draw the circuit chart inside the door.",
      "Test each circuit in turn, then RCD trip-test with the button and a tester.",
    ],
    commonFixes: [
      { problem: "Whole house trips at once", fix: "A single RCD feeding everything — split the board so one fault cannot black out the house; then hunt the faulty circuit by elimination." },
      { problem: "Breaker trips under AC + heater together", fix: "They share a circuit sized for one — separate heavy loads onto their own ways with cable sized to match." },
    ],
    tools: T_ELEC, materials: ["Distribution board + breakers", "RCD/RCBO units", "Cable (per circuit)", "Labels + circuit chart", "Earth sleeving"],
  },
  {
    id: "elec-points-setting", trade: "Electrical", name: "Socket & switch setting-out", kind: "detail",
    whereUsed: "Heights and positions for accessories — set at first fix, lived with forever.",
    keySpecs: ["Sockets 300–450mm above finished floor (worktop sockets 150mm above worktop)", "Switches 1200–1400mm, on the latch side of the door swing", "Kitchen: sockets clear of the hob zone and sink splash zone per plan", "Two-way switching at stairs and long corridors — plan the strappers at conduit stage"],
    steps: [
      "Walk the rooms with the furniture plan — points belong where life happens, not where the wall is empty.",
      "Mark heights from FINISHED floor level (allow for tiles/screed build-up).",
      "Set boxes plumb and at a common height per room; photograph every wall before plaster.",
      "At second fix, terminate with tails dressed and accessories level — a crooked socket is spotted daily.",
    ],
    commonFixes: [
      { problem: "Socket buried behind a later wardrobe", fix: "Setting-out ignored furniture — relocate the point onto the furniture plan line; prevention is the walk-through before conduit." },
      { problem: "Switch on the hinge side of the door", fix: "Move the point to the latch side at first-fix stage; after plaster it means a new chase — cheaper to re-mark than to live with it." },
    ],
    tools: T_ELEC, materials: ["Socket/switch boxes", "Accessories", "Conduit + draw wire", "Marker + level line"],
  },
  // ---------------- Painting & Finishing ----------------
  {
    id: "paint-pop-screed", trade: "Painting & Finishing", name: "POP screeding & wall prep", kind: "pattern", styleId: "interior-pop",
    whereUsed: "Smooth POP-screeded walls and ceilings — the base every premium paint finish stands on.",
    keySpecs: ["POP screed 3–5mm over a keyed, dampened wall — never on dry dusty blockwork", "Straightedge the screed in both directions while it is green", "Cure and dry fully before priming (pale patches = still wet)", "Prime with a sealer coat — skipping primer doubles paint consumption and shows every patch"],
    steps: [
      "Hack/key glossy surfaces, brush down dust and dampen the wall evenly.",
      "Mix POP to a working batch you can finish in 15 minutes — it waits for no one.",
      "Apply and rule off with the straightedge vertically and horizontally.",
      "Float and polish as it firms; cut corners and edges clean while green.",
      "Let it dry fully, sand high spots, seal with primer before any colour.",
    ],
    commonFixes: [
      { problem: "Screed crazing or shelling off", fix: "It dried too fast or went onto a dry dusty wall — hack off the failed area, key, dampen and re-screed in a thinner coat." },
      { problem: "Paint peeling in sheets", fix: "Paint went onto unsealed or still-damp screed — strip the failed paint, let the wall dry, prime with sealer, repaint." },
    ],
    tools: T_PAINT, materials: ["POP cement", "Wall sealer/primer", "Filler for defects", "Abrasive + sanding block", "Paint (finish coats)"],
  },
  {
    id: "paint-feature-wall", trade: "Painting & Finishing", name: "Feature wall & colour blocking", kind: "pattern", styleId: "interior-feature",
    whereUsed: "One statement wall — colour-blocked, textured or panelled — the Estimator's interior recipe in practice.",
    keySpecs: ["The feature wall must be the FLATTEST wall — screed standard is higher here", "Crisp lines: quality tape on fully cured base coat, seal the tape edge with base colour first", "Test the colour on a 1m² patch in the room's own light before committing", "Carry the theme: one feature per room; the other walls support, not compete"],
    steps: [
      "Prepare and prime the wall to screed standard; paint the base/field colour and let it cure hard.",
      "Mark the design with level lines and low-tack tape; seal tape edges with the base colour.",
      "Apply the feature colour in two thin coats; pull tape while the last coat is still tacky, at a low angle.",
      "Touch up any bleed with an artist's brush; step back to daylight distance to judge.",
    ],
    commonFixes: [
      { problem: "Paint bleeding under the tape", fix: "Tape went onto uncured paint or edges were not sealed — let coats cure fully, seal the tape edge with the base colour, and pull tape tacky, not dry." },
      { problem: "Colour looks wrong vs the chart", fix: "Room light changes every colour — judge only from the 1m² test patch in place; adjust the shade one step, not a new colour family." },
    ],
    tools: T_PAINT, materials: ["Feature + field paints", "Low-tack masking tape", "Primer/sealer", "Artist brushes for touch-up", "Roller + tray (site kit)"],
  },
  {
    id: "paint-exterior-weatherproof", trade: "Painting & Finishing", name: "Exterior weatherproof painting", kind: "pattern", styleId: "exterior-render",
    whereUsed: "External walls — textured/weatherproof systems that survive rainy seasons on render.",
    keySpecs: ["Never paint a damp wall: moisture meter or the hand-and-sun test after 2 dry days", "Fill and seal every crack first — paint bridges nothing structural", "Alkali-resistant primer on new render; two finish coats minimum on exteriors", "Paint in shade-side rotation — never onto a sun-baked wall"],
    steps: [
      "Pressure-wash or brush down; scrape every failed flake back to sound paint.",
      "Repair cracks and render defects; let repairs cure and dry.",
      "Prime bare and repaired areas with alkali-resistant primer.",
      "Apply two weatherproof finish coats, working shade-side around the building.",
      "Cut in around windows and the plinth last; keep the plinth coat off the soil line.",
    ],
    commonFixes: [
      { problem: "Bubbling/blistering within one season", fix: "Moisture is leaving the wall through the paint — find the water source (coping, gutter, rising damp) first; repaint only after the wall dries and is primed." },
      { problem: "Green algae on shaded walls", fix: "Wash with an anti-fungal wash, let dry, and use a fungicidal exterior paint; check the gutter above for the overflow feeding it." },
    ],
    tools: T_PAINT, materials: ["Weatherproof exterior paint", "Alkali-resistant primer", "Crack filler / render repair", "Anti-fungal wash", "Brushes/rollers (site kit)"],
  },
  // ---------------- Concrete & Masonry ----------------
  {
    id: "mason-block-wall", trade: "Concrete & Masonry", name: "Block wall setting-out", kind: "pattern", styleId: "exterior-fence",
    whereUsed: "225mm and 150mm block walls — houses and fences; the setting-out decides every later trade.",
    keySpecs: ["First course sets everything: level, plumb corners, gauged to the block module", "Mortar joints 10mm; gauge rod marked for the whole lift", "DPC at plinth level, lapped and continuous — never bridged by render", "Ties/lacing at openings and junctions; lintels bear min 150mm each side"],
    steps: [
      "Set out the wall lines and corners from the foundation; check diagonals for square.",
      "Build corners first to a gauge rod, 4–5 courses up, plumb both faces.",
      "Run the line between corners and fill in, joints 10mm, frogs/voids filled solid at bearings.",
      "Tool joints as you go; keep the wall damp-cured for the first days in hot weather.",
      "Cast/set lintels level with 150mm bearings; never load them the same day.",
    ],
    commonFixes: [
      { problem: "Wall drifting out of plumb mid-lift", fix: "The line was not checked against the corners — rebuild the drifted courses; blockwork cannot be pushed back once the mortar takes." },
      { problem: "Damp rising up internal walls", fix: "DPC missing or bridged by external render — cut out a course at plinth level in sections and insert DPC; unbridge the render." },
    ],
    tools: T_MASON, materials: ["Blocks 225/150mm", "Mortar (sand/cement)", "DPC roll", "Gauge rod (site-made)", "Lintels"],
  },
  {
    id: "mason-slab-cast", trade: "Concrete & Masonry", name: "Slab casting — 1:2:4 ground slab", kind: "detail",
    whereUsed: "Ground floor slabs and oversite concrete — the Estimator's concrete maths in the field.",
    keySpecs: ["Mix 1:2:4 by volume (cement:sand:granite) for general slabs", "150mm slab: compact hardcore + sand blind + DPM before any concrete", "Water is measured, not guessed — too much water halves the strength", "Cure under cover/wet hessian for at least 7 days"],
    steps: [
      "Compact the hardcore in layers, blind with sand, lay DPM with 150mm laps.",
      "Set levels and screed rails; one pour should finish in a day — plan the batch count first.",
      "Batch by the gauge box, mix to a workable slump, place and compact without delay.",
      "Screed off the rails, float, and cut control joints where spans demand.",
      "Cover and cure wet for 7 days minimum; keep traffic off for the first 48 hours.",
    ],
    commonFixes: [
      { problem: "Surface dusting and weak top", fix: "Too much water or the slab dried in sun as it set — cure properly on the next pour; a weak skin can be ground and sealed with a hardener." },
      { problem: "Random cracking across the slab", fix: "No control joints and poor curing — saw-cut joints into the pattern of cracks to relieve it, and seal; prevention is joints + curing on day one." },
    ],
    tools: T_MASON, materials: ["Cement bags", "Sharp sand", "Granite (20mm)", "Hardcore + sand blinding", "DPM sheet", "Timber screed rails"],
  },
  {
    id: "mason-plaster-render", trade: "Concrete & Masonry", name: "Plastering & external render", kind: "pattern", styleId: "exterior-render",
    whereUsed: "Sand-cement plaster inside and weather render outside — 12–15mm in two coats on blockwork.",
    keySpecs: ["Two coats: scratch/key coat then finish coat, each 6–8mm", "Wall dampened before each coat; never plaster onto a bone-dry wall in hot sun", "Rule off with a straightedge and check with the level both ways", "External render: stop beads at openings and a bellcast above the plinth"],
    steps: [
      "Brush down, dampen the wall, and fix plumb dots/beads to thickness.",
      "Apply the scratch coat, key it in a diamond pattern, and let it take up.",
      "Dampen again and apply the finish coat to the beads.",
      "Rule off, fill hollows, float to a true plane as it firms.",
      "Cure by misting for 2–3 days — render that dries in an hour cracks in a week.",
    ],
    commonFixes: [
      { problem: "Hollow, drummy patches", fix: "Bond failed from a dry wall or thick single coat — hack off the hollow area, dampen, and re-render in two thin coats." },
      { problem: "Map cracking (fine crazing)", fix: "Rich mix or fast drying — it is cosmetic if it is not hollow: seal with primer and paint; if hollow, it comes off." },
    ],
    tools: T_MASON, materials: ["Plaster sand", "Cement", "Plumb beads/stop beads", "Hawk + trowels (in kit)", "Straightedge (site tool)"],
  },
  {
    id: "mason-dpc-damp", trade: "Concrete & Masonry", name: "DPC & damp-proofing details", kind: "detail",
    whereUsed: "Keeping ground moisture out of walls and floors — plinth DPC, DPM laps and tanking in wet areas.",
    keySpecs: ["DPC continuous at plinth level, minimum 150mm above outside ground", "DPM under slabs lapped 150mm and turned up to meet the wall DPC", "Never bridge: external render/soil against the wall above DPC invites damp in", "Wet rooms: tanking carried 300mm up walls behind tiles"],
    steps: [
      "Lay DPC on a full mortar bed at plinth level, laps 100mm sealed.",
      "Turn the floor DPM up at edges to overlap the DPC line — one continuous barrier.",
      "Keep external ground and render below DPC level at finishes.",
      "In wet areas, tank walls to 300mm before tiling; seal every penetration.",
    ],
    commonFixes: [
      { problem: "Tide-mark damp at skirting level", fix: "Bridged or missing DPC: check render and soil levels outside first (the cheapest fix), then insert a remedial DPC course in sections if truly missing." },
      { problem: "Damp patch mid-floor", fix: "DPM punctured or laps unsealed — expose at the patch, patch the membrane with a 300mm overlap piece, re-screed." },
    ],
    tools: T_MASON, materials: ["DPC roll", "DPM sheet", "Tanking compound (wet areas)", "Mortar bed", "Sealant for laps"],
  },
  // ---------------- Welding & Metalwork ----------------
  {
    id: "weld-gate-frame", trade: "Welding & Metalwork", name: "Steel gate frame", kind: "pattern", styleId: "exterior-gate-steel",
    whereUsed: "Compound and pedestrian gates — a square frame that still swings true in five years.",
    keySpecs: ["Frame in 40×40/50×50mm angle or box section; diagonal brace from bottom-hinge corner to top-latch corner", "Weld sequence works around the frame to balance distortion — never one side fully first", "Hinges: 2 minimum, 3 on wide/heavy leaves; posts set in concrete to depth for the leaf weight", "Gap at meeting stiles 5–8mm; allow for paint build-up"],
    steps: [
      "Measure the opening at top, middle and bottom; build the frame to the smallest, minus clearances.",
      "Cut and mitre on a flat table; tack the frame and check diagonals equal before any full weld.",
      "Weld in a balanced sequence, flipping the frame; grind flush where infill sits.",
      "Fit hinges to the frame first, offer up to the posts, then weld hinges to posts plumb.",
      "Prime all steel the same day — flash rust starts overnight; hang, swing-test, then paint.",
    ],
    commonFixes: [
      { problem: "Gate sags and scrapes within months", fix: "The diagonal brace runs the wrong way or hinges are undersized — re-brace from bottom-hinge to top-latch corner (compression path) and upgrade hinges before re-hanging." },
      { problem: "Frame twisted after welding", fix: "Heat distortion from one-sided welding — clamp flat, apply heat-spot corrections, and on the next frame weld in balanced passes." },
    ],
    tools: T_WELD, materials: ["Angle/box section steel", "Plate/sheet infill or bars", "Hinges (heavy duty)", "Electrodes", "Primer + paint", "Posts + concrete"],
  },
  {
    id: "weld-burglar-bars", trade: "Welding & Metalwork", name: "Window burglar-proof bars", kind: "detail",
    whereUsed: "Window security grilles — fixed into the reveal, not the frame, and finished to disappear.",
    keySpecs: ["Bars 12–16mm square/round at max 120mm gaps (a child's head must not pass, a hand must not reach the latch)", "Fixings into blockwork/reveal with lugs and plugs — never into the window frame alone", "One window per sleeping room should open or release for escape — agree it with the client and note it", "All welds ground, primed and painted with the frame colour to read as one piece"],
    steps: [
      "Measure each window individually — no two reveals match on site.",
      "Fabricate the grille flat, bars spaced to the 120mm rule, frame mitred and tacked square.",
      "Offer up, mark lug positions, drill and plug into solid blockwork.",
      "Fix, check the window still opens fully, grind and touch up welds.",
      "Prime and paint to match the window colour.",
    ],
    commonFixes: [
      { problem: "Grille rattles in wind", fix: "A lug is in hollow block or a plug spun — re-fix into solid material with a longer lug; pack any rocking corner before tightening." },
      { problem: "Rust bleeding from welds", fix: "Welds were painted unprimed over mill scale — grind back to bright metal, prime with red oxide/zinc primer, repaint." },
    ],
    tools: T_WELD, materials: ["12–16mm bars", "Flat bar frame", "Fixing lugs + plugs/screws", "Electrodes", "Red-oxide primer + paint"],
  },
  {
    id: "weld-truss-fab", trade: "Welding & Metalwork", name: "Steel truss fabrication & welding sequence", kind: "detail",
    whereUsed: "Light steel roof trusses for workshops and wide-span sheds where timber cannot span.",
    keySpecs: ["Jig the first truss on a flat bed — every other truss copies it; a bad jig makes ten bad trusses", "Chords and webs cut to the jig, tacked, checked, then welded in sequence from centre out", "Camber: build in the specified rise (typically span/300) so the loaded truss sits level", "Connections: gussets at panel points where design calls for them — never weld webs to chords off-node"],
    steps: [
      "Set up the jig from the truss drawing and prove it with the first truss dry-assembled.",
      "Cut all members for one truss; lay them in the jig and tack every joint.",
      "Measure diagonals and camber on the tacked truss; correct before welding out.",
      "Weld centre-out, alternating sides to balance shrinkage; flip and repeat.",
      "Use truss #1 as the template check for every copy; stack finished trusses flat and supported.",
    ],
    commonFixes: [
      { problem: "Trusses vary in length/camber", fix: "The jig moved or members were cut per-truss — re-pin the jig to the drawing and cut all members for a batch from one stop setting." },
      { problem: "Truss sags after erection", fix: "Camber was skipped or a web is off-node — jack and prop, add the missing camber via the tie/bracing per the design, and never load a truss before its bracing is in." },
    ],
    tools: T_WELD, materials: ["Angle sections (chords/webs)", "Gusset plates", "Electrodes", "Bolts for site joints", "Primer"],
  },
];

export const cardsForTrade = (trade: GuideTrade): TradeGuideCard[] => TRADE_CARDS.filter(c => c.trade === trade);
export const tradeCardById = (id: string) => TRADE_CARDS.find(c => c.id === id);

// ---------------- Interior & Cabinetry ----------------
// The owner's boards-and-cabinetry line as field cards. Board choices
// agree with the shop's Boards & Panels category and the Estimator's
// Interior & Cabinetry recipes; prices live in Settings & Rates, never here.
const T_CAB = ["Drill machine", "Spirit level", "Measuring tape", "Ladder", "Safety boots/gloves"];
TRADE_CARDS.push(
  {
    id: "cab-guide-kitchen", trade: "Interior & Cabinetry", name: "Kitchen base & wall cabinets — carcass construction", kind: "pattern", styleId: "cab-kitchen",
    whereUsed: "Every fitted kitchen: base units carry the worktop, wall units hang above the splashback zone.",
    keySpecs: ["Base units 720mm carcass + 100–150mm plinth = worktop at 900–920mm", "Wall units 720mm tall typical, bottom at 1400–1500mm (450–600 above worktop)", "Unit widths in 150mm steps — 600mm is the workhorse module", "Wet/sink carcass in MARINE PLY, never particle board", "Level datum line around the room before any unit is fixed"],
    steps: [
      "Snap the datum line at finished worktop height from the highest floor point; every unit hangs off it.",
      "Build carcasses square on the bench — check diagonals before the back goes on (the back locks the square).",
      "Sink and hob units first: marine ply at the sink, heat clearances at the hob per the appliance book.",
      "Set bases on adjustable legs to the datum, level front-to-back and along the run; fix units to each other through front rails.",
      "Hang wall units into solid structure on the datum; doors and drawer fronts last, gaps adjusted even.",
      "Template the worktop only when every unit is final and level.",
    ],
    commonFixes: [
      { problem: "Door sags and scrapes its neighbour", fix: "A sagging hinge: check the hinge screws are in board, not a blown-out hole — move the hinge 20mm or fill and re-drill; adjust the hinge cams for gap, never bend the door." },
      { problem: "Sink unit floor swollen and soft", fix: "Particle/MDF carcass met water. Replace the sink unit base with marine ply, seal every cut edge, and fix the leak source first — the board is the symptom." },
      { problem: "Worktop rocks at one corner", fix: "One base is off the datum — adjust its legs to the line; never pack the worktop itself." },
    ],
    tools: T_CAB, materials: ["HDF boards 18mm (carcass)", "Marine plywood 18mm (sink unit)", "Soft-close hinges ×2/door", "Handles ×1/front", "Adjustable legs + plinth", "Edge banding", "Worktop (templated after)"],
  },
  {
    id: "cab-guide-wardrobe", trade: "Interior & Cabinetry", name: "Wardrobes — carcass, sliding & hinged doors", kind: "pattern", styleId: "cab-wardrobe",
    whereUsed: "Bedroom storage wall-to-wall: hanging, shelves and drawers behind hinged or sliding doors.",
    keySpecs: ["Depth 600mm for hanging (450mm minimum shelves-only)", "Long hang 1400–1600mm drop; double hang 900mm + 900mm", "Hanging rail set 400–500mm from the back panel line", "Sliding doors: overlap 25–30mm, track level within 2mm over the run or doors creep", "Shelf spans over 800mm need centre support"],
    steps: [
      "Measure the alcove at three heights and build to the smallest; scribe fillers to the walls.",
      "Assemble the carcass flat, square it on diagonals, fix the back to lock it.",
      "Stand, level on packers and fix to the wall into solid material.",
      "Fit rails at the planned drops, shelves on supports, drawer boxes square and free-running.",
      "Hinged doors: 2 soft-close hinges per door (3 over 1500mm tall). Sliding: hang from the top track, set the bottom guides, adjust until doors sit still at any position.",
      "Adjust all gaps even; a twisted door means a racked carcass — re-level the box before touching hinges.",
    ],
    commonFixes: [
      { problem: "Sliding door creeps open/closed by itself", fix: "The track is off level — re-level the top track to within 2mm over the run; wheel adjustment only fine-tunes." },
      { problem: "Door misalignment — gaps uneven top to bottom", fix: "Carcass is racked or the floor dips: level the carcass first, then use hinge adjustment for the last 2–3mm only." },
      { problem: "Shelf bows under clothes", fix: "Span too long — add a centre support or a front lipping rail; thin board shelves over 800mm always bow eventually." },
    ],
    tools: T_CAB, materials: ["HDF/MDF boards 18mm", "Hanging rails + sockets", "Hinges (soft-close) or sliding track kit", "Handles", "Edge banding", "Shelf supports"],
  },
  {
    id: "cab-guide-tv-panels", trade: "Interior & Cabinetry", name: "TV console & wall panels", kind: "pattern", styleId: "cab-tv",
    whereUsed: "Living-room media walls: floating console, panelled backdrop, concealed cables and LED detail.",
    keySpecs: ["TV centre at 1000–1200mm from floor for seated viewing — confirm with the client's sofa", "Cable management planned BEFORE panels: conduit or a void behind the panel line", "Console fixed into studs/blockwork with rated fixings — a floating unit is a loaded shelf", "Panel joints on a module (600/1200mm) so cuts land on battens", "LED strip in an aluminium channel — bare strip glued to board yellows and fails"],
    steps: [
      "Mark the TV position and viewing height with the client sitting on their own sofa.",
      "Run power + HDMI conduits in the wall/void first; photograph every run before closing.",
      "Fix panelling grounds (battens) level and plumb; board panels to the module, joints on battens.",
      "Build and hang the console carcass into solid structure; check it carries a man's lean — it will get one.",
      "Mount the TV bracket into structure, not board alone; dress cables through the void.",
      "Fit LED channels, diffuser and driver in a ventilated spot you can reach later.",
    ],
    commonFixes: [
      { problem: "Panel joints opening up", fix: "Boards were butted tight with no movement gap or battens missed the joints — re-fix joints onto battens with a 2mm shadow gap." },
      { problem: "Console tilts forward / fixings pulling", fix: "Fixings are in board or plaster only — re-fix into blockwork/studs with frame fixings; a loaded console never trusts the panel face." },
    ],
    tools: T_CAB, materials: ["MDF boards 18mm", "Batten timber", "LED strip + aluminium channel + driver", "TV bracket (rated)", "Conduit + cable trunking", "Frame fixings"],
  },
  {
    id: "cab-guide-doors", trade: "Interior & Cabinetry", name: "Interior doors — hanging & alignment", kind: "pattern", styleId: "cab-door",
    whereUsed: "Room doors in blockboard/HDF leaves on timber frames — hung true, latched sweet, gaps even.",
    keySpecs: ["3 hinges on solid/blockboard leaves — top hinge carries the load", "Gaps 2–3mm sides/head, 8–10mm at the floor over finished floors", "Seal all six faces/edges — the top and bottom edges everyone forgets drink moisture", "Latch keep marked from the HUNG door, never from the drawing"],
    steps: [
      "Prove the frame plumb, square and solid before the leaf is offered up.",
      "Scribe and plane the leaf to 2–3mm gaps; chop hinge recesses flush in leaf and frame.",
      "Hang on 3 hinges; swing-test through 180° — binding shows where to ease, a shaving at a time.",
      "Mark the latch position from the hung leaf; chop the keep into the frame.",
      "Seal every edge including top and bottom before final fit; fit handles and test the latch with the door pulled, not pushed.",
    ],
    commonFixes: [
      { problem: "Door misalignment after one rainy season", fix: "Unsealed edges swelled — dry the leaf, ease the binding edge, and seal all six faces before rehanging. The fix is the sealer, not the plane." },
      { problem: "Door will not stay shut / latch misses", fix: "Frame has moved or the keep was set from measurements — re-mark from the hung door and deepen/raise the keep; check hinge screws have not loosened in the frame." },
      { problem: "Sagging hinge side gap opens at the top", fix: "Top hinge screws are pulling out of a soft frame — longer screws into solid timber, or plug and re-drill; add the third hinge if the leaf only has two." },
    ],
    tools: T_CAB, materials: ["Blockboard/HDF door leaf", "Timber frame set", "3× butt hinges", "Latch + handles + keep", "Sealer/primer"],
  },
  {
    id: "cab-guide-boards", trade: "Interior & Cabinetry", name: "Board selection guide — which board where", kind: "detail",
    whereUsed: "The first decision on every cabinetry job: the wrong board fails early no matter how good the joinery is.",
    keySpecs: ["MARINE PLY — wet zones: sink carcasses, bathroom vanities, exterior joinery (waterproof glue line)", "MDF — painted smooth finishes: routed/Shaker doors, panelling (seal edges twice; hates water)", "HDF — hard-wearing carcasses and doors: denser than MDF, takes knocks", "PARTICLE BOARD — budget carcasses in DRY rooms only; swells if wetted", "BLOCKBOARD — long shelves and door leaves: timber core holds screws and spans without sag", "PLYWOOD 12mm — drawer boxes, cabinet bases, linings · 6mm — backs and drawer bottoms"],
    steps: [
      "Walk the job zone by zone and mark each WET (sink, bathroom), DRY (bedroom, lounge) or LOAD (long shelf, door).",
      "Wet zones get marine ply — no exceptions, no 'sealed MDF will do' at a sink.",
      "Painted smooth faces get MDF; hard-knock carcasses get HDF; budget dry carcasses get particle board with every edge sealed.",
      "Anything long, spanning or screw-holding (shelves, doors) gets blockboard.",
      "Order from the shop's Boards & Panels line; backs and drawer bottoms in 6mm ply, bases in 12mm.",
    ],
    commonFixes: [
      { problem: "Swollen board edge at a sink or door bottom", fix: "Wrong board or unsealed edge met water: cut back to sound material, replace with marine ply at wet zones, and seal every cut edge with two coats before refitting." },
      { problem: "Laminate peeling off a carcass", fix: "Adhesive was one-sided or the board face was dusty — lift, clean both faces, re-glue BOTH faces with contact adhesive, roll centre-out. Heat alone does not re-bond a dirty joint." },
    ],
    tools: T_CAB, materials: ["Marine plywood 18mm", "MDF board 18mm", "HDF board 18mm", "Particle board 18mm", "Blockboard 18mm", "Plywood 12mm + 6mm"],
  },
);

/** Cabinet elevation maths — how a run divides into units. Pure/testable:
 *  units are the nominal module; the LAST unit absorbs the remainder so
 *  the sketch can draw every unit at its true width. */
export function cabinetUnits(runM: number, unitWidthMm = 600): { units: number; lastUnitMm: number; unitWidthMm: number } {
  const runMm = Math.max(0, Math.round((runM || 0) * 1000));
  const w = Math.max(150, Math.round(unitWidthMm) || 600);
  if (!runMm) return { units: 0, lastUnitMm: 0, unitWidthMm: w };
  const units = Math.max(1, Math.round(runMm / w));
  const lastUnitMm = runMm - (units - 1) * w;
  return { units, lastUnitMm, unitWidthMm: w };
}
