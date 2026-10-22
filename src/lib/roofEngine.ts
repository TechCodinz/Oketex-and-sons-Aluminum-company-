// Engineering roof estimator — all totals computed here, no hardcoded totals.
// Catalog prices: Longspan 0.45 ₦9,800/m, 0.55 ₦11,500/m, Metcoppo ₦12,800/m,
// Stone-coated ₦6,900/tile (0.48m²), Gutter ₦6,500/m, Insulation ₦46,500/roll (30m²),
// Fasteners ₦38,500/bucket (500). Estimator rates (ridge caps, timber purlins,
// installation labour, and all delivery zone prices) are read at calculation
// time from lib/settings.ts — defaults below, admin-overridable in
// /admin → Settings & Rates.
import { getRates } from "./settings";
export type RoofStyle = "gable" | "hip" | "shed" | "flat" | "mansard";
export type ProfileId = "longspan-045" | "longspan-055" | "metcoppo" | "corrugated" | "stone-coated";
export interface RoofInput {
  length: number; width: number; overhang: number; style: RoofStyle; pitchDeg: number;
  profile: ProfileId; colour: string; wastePct: number | null; // null = auto
  extras: { gutters: boolean; insulation: boolean; installation: boolean; timber: boolean; ceilingTransportNote?: boolean };
  deliveryZone: string;
}
export interface BoqLine { item: string; spec: string; qty: number; unit: string; unitPrice: number; total: number; note?: string }
export interface RoofResult {
  effLength: number; effWidth: number; effPlanArea: number; slopeFactor: number; pitchUsed: number;
  slopeLength: number; trueRoofArea: number; slopes: number;
  sheetsAcross: number; totalMetres: number; cuttingList: string;
  ridgeLength: number; hipLength: number; wastePct: number;
  lines: BoqLine[]; subtotal: number; transport: number; grandTotal: number;
  tiles?: number;
}
export const DELIVERY_ZONES = [
  { id: "pickup", label: "Pickup from Ibafo plant — Free", price: 0 },
  { id: "ogun-lagos", label: "Ogun / Lagos", price: 45000 },
  { id: "south-west", label: "South-West (Oyo, Osun, Ondo, Ekiti)", price: 85000 },
  { id: "ss-se", label: "South-South / South-East", price: 145000 },
  { id: "abuja-north", label: "Abuja / North", price: 185000 },
];
export const PROFILES: Record<ProfileId, { label: string; coverWidth: number; pricePerMetre: number; kind: string }> = {
  "longspan-045": { label: "Longspan 0.45mm", coverWidth: 1.0, pricePerMetre: 9800, kind: "sheet" },
  "longspan-055": { label: "Longspan 0.55mm", coverWidth: 1.0, pricePerMetre: 11500, kind: "sheet" },
  "metcoppo": { label: "Metcoppo Step-Tile 0.50mm", coverWidth: 0.96, pricePerMetre: 12800, kind: "sheet" },
  "corrugated": { label: "Corrugated (3m sheets)", coverWidth: 0.9, pricePerMetre: 0, kind: "corrugated" }, // priced per sheet below
  "stone-coated": { label: "Stone-Coated Classic Bond", coverWidth: 0, pricePerMetre: 0, kind: "tile" },
};
export const AUTO_WASTE: Record<RoofStyle, number> = { gable: 8, hip: 12, shed: 5, flat: 5, mansard: 12 };
export function calculateRoof(input: RoofInput): RoofResult {
  const rates = getRates(); // admin-editable estimator rates (Settings & Rates)
  const wastePct = input.wastePct ?? AUTO_WASTE[input.style];
  const waste = wastePct / 100;
  const pitchUsed = input.style === "flat" ? Math.max(input.pitchDeg, 3) : input.pitchDeg;
  const pitchRad = (pitchUsed * Math.PI) / 180;
  const slopeFactor = 1 / Math.cos(pitchRad);
  const effLength = input.length + input.overhang * 2;
  const effWidth = input.width + input.overhang * 2;
  const effPlanArea = effLength * effWidth;
  const trueRoofArea = effPlanArea * slopeFactor;
  const slopes = input.style === "shed" || input.style === "flat" ? 1 : 2;
  // slope length
  let slopeLength: number;
  if (input.style === "shed" || input.style === "flat") slopeLength = effWidth * slopeFactor;
  else slopeLength = (effWidth / 2) * slopeFactor;
  const prof = PROFILES[input.profile];
  const lines: BoqLine[] = [];
  let sheetsAcross = 0, totalMetres = 0, cuttingList = "", tiles: number | undefined;
  if (prof.kind === "sheet") {
    sheetsAcross = Math.ceil(effLength / prof.coverWidth);
    const rawMetres = sheetsAcross * slopeLength * slopes;
    totalMetres = rawMetres * (1 + waste);
    cuttingList = `${sheetsAcross * slopes} sheets × ${slopeLength.toFixed(2)} m (${sheetsAcross} across × ${slopes} slope${slopes>1?"s":""}) — order ${totalMetres.toFixed(1)} m incl. ${wastePct}% waste`;
    const roundedMetres = Math.round(totalMetres*10)/10;
    lines.push({ item: prof.label, spec: `Cover ${prof.coverWidth}m, cut ${slopeLength.toFixed(2)}m`, qty: roundedMetres, unit: "m", unitPrice: prof.pricePerMetre, total: Math.round(roundedMetres * prof.pricePerMetre) });
  } else if (prof.kind === "corrugated") {
    // Corrugated: 3m sheets, cover 0.9m wide. Sheets along slope: ceil(slopeLength/3 with 0.15 lap approx -> use 2.85 effective)
    const alongSlope = Math.ceil(slopeLength / 2.85);
    sheetsAcross = Math.ceil(effLength / 0.9);
    const count = Math.ceil(sheetsAcross * alongSlope * slopes * (1 + waste));
    totalMetres = count * 3;
    cuttingList = `${count} sheets × 3.00 m (${sheetsAcross} across × ${alongSlope} up slope × ${slopes} slope${slopes>1?"s":""}) incl. ${wastePct}% waste`;
    // colour corrugated ₦8,900/sheet from catalog (use colour price as default estimator)
    lines.push({ item: "Corrugated Aluminium Sheet (Colour)", spec: "3m sheet, 0.9m cover", qty: count, unit: "sheet", unitPrice: 8900, total: count * 8900 });
  } else {
    tiles = Math.ceil((trueRoofArea * (1 + waste)) / 0.48);
    lines.push({ item: "Stone-Coated Classic Bond Tile", spec: "0.48m² coverage per tile", qty: tiles, unit: "tile", unitPrice: 6900, total: tiles * 6900 });
    const nails = Math.ceil(trueRoofArea * 12);
    lines.push({ item: "Stone-coated nails & fixings (estimate)", spec: "~12 per m²", qty: nails, unit: "pc", unitPrice: 45, total: nails * 45, note: "estimator rate" });
  }
  // Ridge / hips
  let ridgeLength = 0, hipLength = 0;
  if (input.style === "gable" || input.style === "mansard") ridgeLength = effLength;
  if (input.style === "hip" || input.style === "mansard") {
    ridgeLength = Math.max(effLength - effWidth, 0);
    const hipRafter = Math.sqrt(slopeLength * slopeLength + Math.pow(effWidth / 2, 2));
    hipLength = hipRafter * 4;
  }
  const ridgeTotalLen = ridgeLength + hipLength;
  if (ridgeTotalLen > 0 && prof.kind !== "tile") {
    const qty = Math.ceil(ridgeTotalLen * (1 + waste));
    lines.push({ item: "Ridge caps & flashing", spec: `Ridge ${ridgeLength.toFixed(1)}m${hipLength?` + hips ${hipLength.toFixed(1)}m`:""}`, qty, unit: "m", unitPrice: rates.ridgePerM, total: qty * rates.ridgePerM, note: "estimator rate" });
  }
  if (prof.kind === "tile" && ridgeTotalLen > 0) {
    const pieces = Math.ceil(ridgeTotalLen / 1.0);
    lines.push({ item: "Ridge pieces (stone-coated)", spec: "~1.0m per piece", qty: pieces, unit: "pc", unitPrice: rates.ridgePerM, total: pieces * rates.ridgePerM, note: "estimator rate" });
  }
  // Fasteners for metal profiles
  if (prof.kind === "sheet" || prof.kind === "corrugated") {
    const screws = Math.ceil(trueRoofArea * 7);
    const buckets = Math.ceil(screws / 500);
    lines.push({ item: "Self-drilling screws (500pc bucket)", spec: `${screws.toLocaleString()} screws @ ~7/m²`, qty: buckets, unit: "bucket", unitPrice: 38500, total: buckets * 38500 });
  }
  // Timber purlins
  if (input.extras.timber) {
    const rowsPerSlope = Math.ceil(slopeLength / 0.9);
    const timberMetres = Math.ceil(rowsPerSlope * effLength * slopes);
    lines.push({ item: "Timber purlins / battens", spec: `Rows every 0.9m — ${rowsPerSlope} rows/slope`, qty: timberMetres, unit: "m", unitPrice: rates.timberPerM, total: timberMetres * rates.timberPerM, note: "estimator rate" });
  }
  if (input.extras.insulation) {
    const rolls = Math.ceil(trueRoofArea / 30);
    lines.push({ item: "Reflective Foil Insulation Roll", spec: "30m² per roll", qty: rolls, unit: "roll", unitPrice: 46500, total: rolls * 46500 });
  }
  if (input.extras.gutters) {
    const gutterLen = input.style === "hip" || input.style === "mansard" ? Math.ceil(2 * (effLength + effWidth)) : Math.ceil(2 * effLength);
    lines.push({ item: "Aluminium Gutter & Downpipe", spec: input.style==="hip"?"Perimeter eaves": "2 eaves sides", qty: gutterLen, unit: "m", unitPrice: 6500, total: gutterLen * 6500 });
  }
  if (input.extras.installation) {
    const qty = Math.round(trueRoofArea);
    lines.push({ item: "Professional installation labour", spec: "Per m² of true roof area", qty, unit: "m²", unitPrice: rates.installationPerM2, total: qty * rates.installationPerM2, note: "estimator rate" });
  }
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const zone = DELIVERY_ZONES.find(z => z.id === input.deliveryZone) ?? DELIVERY_ZONES[0];
  const transport = rates.deliveryZones[zone.id] ?? zone.price;
  return { effLength, effWidth, effPlanArea, slopeFactor, pitchUsed, slopeLength, trueRoofArea, slopes, sheetsAcross, totalMetres, cuttingList, ridgeLength, hipLength, wastePct, lines, subtotal, transport, grandTotal: subtotal + transport, tiles };
}
