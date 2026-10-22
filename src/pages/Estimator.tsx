import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowLeft, ArrowRight, Bath, Building2, CalendarCheck, Camera, CheckCircle2,
  ClipboardList, Download, FolderPlus, Hammer, Info, LayoutGrid, Minus,
  PaintRoller, AppWindow, Plus, Printer, Ruler, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHead } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatNGN } from "@/lib/money";
import { BUSINESS } from "@/contracts/constants";
import { getBusiness, businessWaLink } from "@/lib/settings";
import { ROOF_COLOURS } from "@/data/catalog";
import { PROFILES, type ProfileId, type RoofStyle } from "@/lib/roofEngine";
import {
  TRADES, stylesForTrade, styleById, PLUMBING_FIXTURES, TILE_SIZES, TILING_WASTE,
  type TradeId, type StyleDef,
} from "@/data/styleRecipes";
import {
  estimateProject, defaultEstimatorInput, estimateCode, getEstimates, saveEstimate,
  deleteEstimate, tradeLabel, bookServiceFor, profileForRoofStyle,
  type EstimatorInput, type SavedEstimate,
} from "@/lib/projectEstimator";
import { getProProjects, saveProProjects, uid, type ProProject, type MeasureRow, type TakeOffRow } from "@/lib/proStorage";

const TRADE_ICONS: Record<TradeId, typeof Hammer> = {
  roofing: Hammer, tiling: LayoutGrid, woodwork: Ruler, plumbing: Bath,
  interior: PaintRoller, "windows-doors": AppWindow, exterior: Building2,
};

// ---------------- SVG pattern previews for the style library -------------------
function PatternPreview({ kind, accent, accent2 }: { kind: string; accent: string; accent2?: string }) {
  const rawId = useRef(`p${Math.random().toString(36).slice(2, 8)}`).current;
  const a = accent, b = accent2 ?? "#3A3F44";
  const S = { stroke: "rgba(255,255,255,0.35)", sw: 1 } as const;
  const common = "h-full w-full";
  switch (kind) {
    case "longspan":
      return (<svg viewBox="0 0 120 84" className={common} preserveAspectRatio="none">{Array.from({ length: 10 }).map((_, i) => (<g key={i}><rect x={4 + i * 12} y="6" width="7" height="72" fill={a} opacity={0.55 + (i % 2) * 0.2} /><line x1={7.5 + i * 12} y1="6" x2={7.5 + i * 12} y2="78" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" /></g>))}</svg>);
    case "corrugated":
      return (<svg viewBox="0 0 120 84" className={common} preserveAspectRatio="none">{[18, 42, 66].map(y => (<path key={y} d={`M0 ${y} Q 7.5 ${y - 12} 15 ${y} T 30 ${y} T 45 ${y} T 60 ${y} T 75 ${y} T 90 ${y} T 105 ${y} T 120 ${y}`} fill="none" stroke={a} strokeWidth="5" opacity="0.8" />))}</svg>);
    case "metcoppo":
      return (<svg viewBox="0 0 120 84" className={common} preserveAspectRatio="none">{[0, 1, 2, 3].map(r => (<g key={r}>{Array.from({ length: 6 }).map((_, i) => (<path key={i} d={`M${i * 20} ${14 + r * 18} a10 8 0 0 1 20 0`} fill={a} opacity={0.45 + r * 0.12} stroke="rgba(255,255,255,0.35)" />))}</g>))}</svg>);
    case "stone":
      return (<svg viewBox="0 0 120 84" className={common}>{[0, 1, 2, 3].map(r => (<g key={r}>{Array.from({ length: 4 }).map((_, i) => (<rect key={i} x={(i * 32 + (r % 2) * 16) - 8} y={6 + r * 19} width="30" height="15" rx="4" fill={a} opacity={0.4 + ((i + r) % 3) * 0.18} stroke="rgba(255,255,255,0.25)" />))}</g>))}</svg>);
    case "large-format":
      return (<svg viewBox="0 0 120 84" className={common}>{[0, 1, 2].map(r => [0, 1].map(c => (<rect key={`${r}${c}`} x={6 + c * 55} y={6 + r * 25} width="52" height="22" fill={a} opacity="0.35" stroke="rgba(255,255,255,0.4)" />)))}</svg>);
    case "subway": case "brick":
      return (<svg viewBox="0 0 120 84" className={common}>{[0, 1, 2, 3, 4].map(r => (<g key={r}>{Array.from({ length: 4 }).map((_, i) => (<rect key={i} x={(i * 34 + (r % 2) * 17) - 10} y={5 + r * 16} width="31" height="13" fill={a} opacity={kind === "brick" ? 0.75 : 0.4} stroke="rgba(255,255,255,0.3)" />))}</g>))}</svg>);
    case "checkerboard":
      return (<svg viewBox="0 0 120 84" className={common}>{[0, 1, 2, 3].map(r => [0, 1, 2, 3, 4, 5].map(c => (<rect key={`${r}${c}`} x={c * 20} y={r * 21} width="20" height="21" fill={(r + c) % 2 ? b : a} />)))}</svg>);
    case "mosaic":
      return (<svg viewBox="0 0 120 84" className={common}>{[0, 1, 2, 3, 4, 5].map(r => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(c => (<rect key={`${r}${c}`} x={c * 12 + 1} y={r * 14 + 1} width="10" height="12" fill={a} opacity={0.25 + ((r * 7 + c * 3) % 5) * 0.15} />)))}</svg>);
    case "diagonal":
      return (<svg viewBox="0 0 120 84" className={common}><defs><pattern id={rawId} width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="24" height="24" fill={a} fillOpacity="0.35" /><path d="M0 0H24V24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" /></pattern></defs><rect width="120" height="84" fill={`url(#${rawId})`} /></svg>);
    case "herringbone":
      return (<svg viewBox="0 0 120 84" className={common}><defs><pattern id={rawId} width="28" height="28" patternUnits="userSpaceOnUse"><g fill={a}><rect x="2" y="8" width="18" height="6" transform="rotate(45 11 11)" opacity="0.75" /><rect x="12" y="8" width="18" height="6" transform="rotate(-45 21 11)" opacity="0.5" /><rect x="2" y="22" width="18" height="6" transform="rotate(45 11 25)" opacity="0.5" /><rect x="12" y="22" width="18" height="6" transform="rotate(-45 21 25)" opacity="0.75" /></g></pattern></defs><rect width="120" height="84" fill={`url(#${rawId})`} /></svg>);
    case "shaker":
      return (<svg viewBox="0 0 120 84" className={common}>{[0, 1, 2].map(i => (<g key={i}><rect x={8 + i * 37} y="8" width="32" height="68" fill={a} opacity="0.5" {...S} /><rect x={14 + i * 37} y="14" width="20" height="56" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" /><circle cx={36 + i * 37} cy="42" r="2" fill="#fff" /></g>))}</svg>);
    case "kitchen":
      return (<svg viewBox="0 0 120 84" className={common}><rect x="4" y="6" width="112" height="8" fill={b} /><rect x="4" y="34" width="112" height="5" fill="#C9CDD2" />{[0, 1, 2, 3].map(i => (<rect key={i} x={6 + i * 28} y="16" width="24" height="16" fill={a} opacity="0.55" {...S} />))}{[0, 1, 2].map(i => (<rect key={i} x={6 + i * 37} y="42" width="33" height="36" fill={a} opacity="0.7" {...S} />))}</svg>);
    case "louvre":
      return (<svg viewBox="0 0 120 84" className={common}><rect x="38" y="4" width="44" height="76" fill={a} opacity="0.4" {...S} />{[0, 1, 2, 3, 4, 5, 6, 7].map(i => (<line key={i} x1="44" y1={12 + i * 6} x2="76" y2={16 + i * 6} stroke="rgba(255,255,255,0.6)" strokeWidth="2" />))}<rect x="44" y="58" width="32" height="16" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" /><circle cx="76" cy="46" r="2.2" fill="#fff" /></svg>);
    case "shelving":
      return (<svg viewBox="0 0 120 84" className={common}><rect x="34" y="18" width="52" height="34" fill="#0c0d0e" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />{[64, 76].map(y => (<g key={y}><line x1="6" y1={y} x2="114" y2={y} stroke={a} strokeWidth="4" />{[24, 60, 96].map(x => (<rect key={x} x={x} y={y - 10} width="5" height="10" fill={a} opacity="0.7" />))}</g>))}<line x1="6" y1="30" x2="28" y2="30" stroke={a} strokeWidth="4" /><line x1="92" y1="30" x2="114" y2="30" stroke={a} strokeWidth="4" /></svg>);
    case "bath-standard": case "bath-ensuite": case "bath-luxury":
      return (<svg viewBox="0 0 120 84" className={common}><rect x="6" y="8" width="34" height="30" fill="none" {...S} /><path d="M12 32 L23 14 L34 32" stroke={a} strokeWidth="2.5" fill="none" /><circle cx="58" cy="20" r="10" fill={a} opacity="0.6" /><rect x="48" y="30" width="20" height="8" fill={a} opacity="0.4" /><ellipse cx="92" cy="22" rx="14" ry="10" fill="none" {...S} /><ellipse cx="92" cy="22" rx="7" ry="5" fill={a} opacity="0.5" />{(kind !== "bath-standard") && <rect x="66" y="50" width="48" height="24" rx="9" fill={a} opacity="0.45" {...S} />}{kind === "bath-luxury" && <circle cx="26" cy="58" r="9" fill={a} opacity="0.6" />}</svg>);
    case "kitchen-plumb":
      return (<svg viewBox="0 0 120 84" className={common}><rect x="4" y="40" width="112" height="6" fill={b} /><path d="M38 40 v10 a6 6 0 0 0 6 6 h32 a6 6 0 0 0 6-6 v-10" fill="none" stroke={a} strokeWidth="4" /><path d="M60 40 V26 a8 8 0 0 1 16 0" fill="none" stroke={a} strokeWidth="4" />{[0, 1, 2].map(i => (<rect key={i} x={8 + i * 38} y="52" width="32" height="26" fill={a} opacity="0.3" {...S} />))}</svg>);
    case "interior-modern": case "interior-classic": case "interior-minimal":
      return (<svg viewBox="0 0 120 84" className={common}><rect x="4" y="4" width="112" height="12" fill={b} opacity="0.85" />{kind === "interior-classic" && <rect x="4" y="16" width="112" height="4" fill={a} opacity="0.8" />}<rect x="4" y={kind === "interior-classic" ? 22 : 18} width="112" height="42" fill={a} opacity="0.9" /><rect x="4" y="62" width="112" height="18" fill={b} />{[0, 1, 2, 3].map(i => (<line key={i} x1={10 + i * 28} y1="62" x2={10 + i * 28} y2="80" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />))}</svg>);
    case "casement":
      return (<svg viewBox="0 0 120 84" className={common}><rect x="22" y="6" width="76" height="72" fill={a} opacity="0.25" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" /><line x1="60" y1="6" x2="60" y2="78" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" /><line x1="22" y1="42" x2="98" y2="42" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" /><path d="M30 70 L52 14 M68 70 L90 14" stroke={a} strokeWidth="2" opacity="0.6" /></svg>);
    case "sliding":
      return (<svg viewBox="0 0 120 84" className={common}><rect x="10" y="8" width="62" height="68" fill={a} opacity="0.3" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" /><rect x="48" y="8" width="62" height="68" fill={a} opacity="0.5" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" /><path d="M84 42 h14 M92 36 l6 6-6 6" stroke="#fff" strokeWidth="2" fill="none" /></svg>);
    case "full-glaze":
      return (<svg viewBox="0 0 120 84" className={common}><rect x="6" y="4" width="108" height="76" fill={a} opacity="0.3" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />{[32, 60, 88].map(x => (<line key={x} x1={x} y1="4" x2={x} y2="80" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />))}<path d="M14 74 L52 12 M58 74 L96 12" stroke="rgba(255,255,255,0.35)" strokeWidth="3" /></svg>);
    case "acp":
      return (<svg viewBox="0 0 120 84" className={common}>{[0, 1].map(r => [0, 1, 2].map(c => (<rect key={`${r}${c}`} x={5 + c * 38} y={6 + r * 37} width="34" height="33" fill={a} opacity={0.35 + ((r + c) % 2) * 0.2} stroke="rgba(0,0,0,0.5)" strokeWidth="2" />)))}</svg>);
    case "stone-clad":
      return (<svg viewBox="0 0 120 84" className={common}>{["M4 8 h34 l4 12 -6 8 H6 Z", "M44 6 h30 l6 14 -8 10 H46 Z", "M84 8 h32 v20 H88 Z", "M8 34 h28 l2 14 -8 8 H6 Z", "M42 34 h36 l4 12 -6 12 H44 Z", "M86 32 h30 v24 H90 Z", "M8 60 h30 v18 H8 Z", "M44 62 h34 v16 H44 Z", "M86 60 h30 v18 H86 Z"].map((d, i) => (<path key={i} d={d} fill={a} opacity={0.35 + (i % 4) * 0.13} stroke="rgba(0,0,0,0.45)" />))}</svg>);
    case "render":
      return (<svg viewBox="0 0 120 84" className={common}><rect x="4" y="4" width="112" height="76" fill={a} opacity="0.75" />{[0, 1, 2, 3, 4].map(i => (<path key={i} d={`M6 ${18 + i * 13} q 28 ${i % 2 ? 5 : -5} 56 0 t 52 0`} stroke="rgba(0,0,0,0.18)" fill="none" strokeWidth="2" />))}</svg>);
    default:
      return (<svg viewBox="0 0 120 84" className={common}><rect x="6" y="6" width="108" height="72" fill={a} opacity="0.4" {...S} /></svg>);
  }
}

// ---------------- small field helpers -------------------
function Num({ label, value, set, step = "0.1", min, hint }: { label: string; value: number; set: (n: number) => void; step?: string; min?: number; hint?: string }) {
  return (<div><label className="label-tech">{label}</label><input type="number" step={step} min={min} value={value} onChange={e => set(parseFloat(e.target.value) || 0)} className="field-tech font-tech" />{hint && <p className="font-tech text-[11px] text-muted-foreground mt-1">{hint}</p>}</div>);
}
function Sel({ label, value, set, options }: { label: string; value: string; set: (v: string) => void; options: [string, string][] }) {
  return (<div><label className="label-tech">{label}</label><select value={value} onChange={e => set(e.target.value)} className="field-tech font-tech bg-background w-full">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>);
}
const STEPS = ["Trade", "Style", "Photo & Dimensions", "Materials List & Estimate"];

export default function Estimator() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [trade, setTrade] = useState<TradeId>("tiling");
  const [styleId, setStyleId] = useState("tile-herringbone");
  const [input, setInput] = useState<EstimatorInput>(() => defaultEstimatorInput("tiling", "tile-herringbone"));
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<SavedEstimate[]>(() => getEstimates());
  const [savedCode, setSavedCode] = useState<string | null>(null);

  const style = styleById(styleId);
  const set = (patch: Partial<EstimatorInput>) => setInput(prev => ({ ...prev, ...patch }));

  const pickTrade = (t: TradeId) => {
    const first = stylesForTrade(t)[0];
    setTrade(t); setStyleId(first.id);
    setInput(prev => ({ ...defaultEstimatorInput(t, first.id), length: prev.length, width: prev.width, height: prev.height, tileSizeId: prev.tileSizeId }));
    setStep(2);
  };
  const pickStyle = (s: StyleDef) => {
    setStyleId(s.id);
    setInput(prev => ({ ...prev, styleId: s.id, fixtures: Object.fromEntries((PLUMBING_FIXTURES[s.id] ?? []).map(f => [f.key, f.count])) }));
  };

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);
  const onPhoto = (f: File | undefined) => {
    if (!f) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(f)); setPhotoName(f.name);
    toast.success("Photo attached for this session");
  };

  const result = useMemo(() => estimateProject({ ...input, trade, styleId }), [input, trade, styleId]);
  const allLines = useMemo(() => result.groups.flatMap(g => g.lines.map(l => ({ ...l, key: `${g.name}:${l.name}` }))), [result]);
  useEffect(() => { setChecked(new Set()); setSavedCode(null); }, [trade, styleId, input]);

  const resultInput: EstimatorInput = { ...input, trade, styleId };

  function doSave() {
    const code = estimateCode();
    saveEstimate({
      code, createdAt: new Date().toISOString(), trade, tradeLabel: tradeLabel(trade),
      styleId, styleName: style?.name ?? styleId, photoAttached: !!photoUrl,
      input: resultInput, drivers: result.drivers, groups: result.groups,
      pricedTotal: result.pricedTotal, unpricedCount: result.unpricedCount, bookService: bookServiceFor(trade),
    });
    setSaved(getEstimates()); setSavedCode(code);
    toast.success(`Estimate saved — ${code}`);
  }
  function loadSaved(e: SavedEstimate) {
    setTrade(e.trade); setStyleId(e.styleId); setInput({ ...e.input, trade: e.trade, styleId: e.styleId });
    if (photoUrl) { URL.revokeObjectURL(photoUrl); setPhotoUrl(null); setPhotoName(""); }
    setStep(4); window.scrollTo({ top: 0 });
    toast.success(`Loaded ${e.code}${e.photoAttached ? " — photo was session-only and is not stored" : ""}`);
  }
  function downloadCSV() {
    const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines: string[] = [
      ["OKETEX PROJECT ESTIMATE", savedCode ?? "(unsaved)"].map(esc).join(","),
      ["Trade", tradeLabel(trade)].map(esc).join(","), ["Style", style?.name ?? styleId].map(esc).join(","),
      ["Photo attached at creation", photoUrl ? "Yes" : "No"].map(esc).join(","), "",
      ["Key figures", ""].map(esc).join(","),
      ...result.drivers.map(d => [d.label, d.value].map(esc).join(",")),
      "", ["Group", "Item", "Qty", "Unit", "Unit price NGN", "Total NGN", "Price basis", "Note"].map(esc).join(","),
    ];
    result.groups.forEach(g => g.lines.forEach(l => lines.push([g.name, l.name, l.qty, l.unit, l.unitPrice ?? "", l.total ?? "", l.priceSource ?? "quantity only", l.note ?? ""].map(esc).join(","))));
    lines.push("");
    lines.push(["PRICED SUBTOTAL (NGN)", result.pricedTotal].map(esc).join(","));
    lines.push(["Items to confirm price", result.unpricedCount].map(esc).join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `oketex-estimate-${(style?.name ?? "project").replace(/[^\w-]+/g, "-").toLowerCase()}.csv`; a.click(); URL.revokeObjectURL(a.href);
    toast.success("CSV downloaded");
  }
  const waText = () => {
    const body = result.groups.map(g => `${g.name.toUpperCase()}\n${g.lines.map(l => `- ${l.name}: ${l.qty} ${l.unit}${l.total !== undefined ? ` — ${formatNGN(l.total)}${l.priceSource === "estimator" ? " (estimator rate)" : ""}` : " — price to confirm"}`).join("\n")}`).join("\n\n");
    return `PROJECT ESTIMATE — ${BUSINESS.name}\nTrade: ${tradeLabel(trade)} · Style: ${style?.name ?? styleId}\n${result.drivers.map(d => `${d.label}: ${d.value}`).join(" · ")}\nPhoto attached at creation: ${photoUrl ? "Yes" : "No"}\n\n${body}\n\nPRICED SUBTOTAL: ${formatNGN(result.pricedTotal)}${result.unpricedCount ? `\nPlus ${result.unpricedCount} item(s) to confirm price.` : ""}\nPlease confirm my materials list. Thank you.`;
  };
  function createWorkspaceProject() {
    const code = savedCode ?? estimateCode();
    const tradeMap: Record<TradeId, ProProject["trade"]> = { roofing: "Roofer", woodwork: "Carpenter", tiling: "Builder", plumbing: "Builder", interior: "Builder", "windows-doors": "Builder", exterior: "Builder" };
    const measures: MeasureRow[] = allLines.map(l => ({
      id: uid(), item: l.name, location: style?.name ?? "", l: 0, w: 0, h: 0,
      qty: typeof l.qty === "number" ? l.qty : 0, unit: l.unit,
      note: `${l.group}${l.total !== undefined ? ` · ${formatNGN(l.total)}` : " · price to confirm"}`,
    }));
    const takeoff: TakeOffRow[] = trade === "roofing" ? [{
      id: uid(), section: style?.name ?? "Roof",
      length: input.roofLength, width: input.roofWidth, pitch: input.roofPitch,
      style: input.roofStyle === "mansard" ? "hip" : input.roofStyle,
      profile: profileForRoofStyle(styleId, input.roofProfile), overhang: input.roofOverhang,
    }] : [];
    const proj: ProProject = {
      id: uid(), name: `${style?.name ?? "Project"} — ${tradeLabel(trade)}`,
      client: "", siteAddress: "", date: new Date().toISOString().slice(0, 10),
      trade: tradeMap[trade], status: "Measuring",
      notes: `Created from Project Estimator (${code}). Style: ${style?.name}. ${result.drivers.map(d => `${d.label}: ${d.value}`).join(" · ")}. Photo attached at creation: ${photoUrl ? "yes" : "no"} (photos are session-only).`,
      takeoff, measures,
      checklist: allLines.map(l => ({ id: uid(), label: `${l.name} — ${l.qty} ${l.unit}`, done: false })),
      createdAt: new Date().toISOString(),
    };
    saveProProjects([proj, ...getProProjects()]);
    toast.success("Workspace project created");
    navigate("/workspace");
  }

  const bookService = bookServiceFor(trade);

  return (<div>
    <PageHead kicker="Project Estimator — Style · Photo · Full Materials List" title="Snap it. Style it. Get the full list."
      lead="Pick a trade, choose a style, add a photo and your real dimensions — the estimator lists every material, fixing, consumable and labour line the job needs, with catalog prices where we sell it and honest estimator rates where we don't." />
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      {/* Stepper */}
      <div className="flex flex-wrap gap-px bg-border border hairline no-print">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => i + 1 < step && setStep(i + 1)} className={`flex-1 min-w-[140px] px-4 py-3 text-left font-display font-semibold uppercase tracking-wider text-sm cursor-pointer ${step === i + 1 ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>
            <span className="font-tech text-[10px] block">{String(i + 1).padStart(2, "0")}</span>{s}
          </button>
        ))}
      </div>

      {/* STEP 1 — Trade */}
      {step === 1 && (<section className="mt-10">
        <p className="label-tech mb-4">01 — What are you working on?</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {TRADES.map(t => { const Icon = TRADE_ICONS[t.id]; return (
            <button key={t.id} onClick={() => pickTrade(t.id)} className={`text-left border hairline bg-card p-6 cursor-pointer hover:border-primary ${trade === t.id ? "border-primary bg-primary/10" : ""}`}>
              <Icon className="h-8 w-8 text-primary" />
              <h3 className="font-display font-bold uppercase text-xl mt-4">{t.name}</h3>
              <p className="text-sm text-muted-foreground mt-2">{t.tagline}</p>
              <span className="font-tech text-xs text-primary mt-4 inline-flex gap-1">Choose <ArrowRight className="h-4 w-4" /></span>
            </button>); })}
        </div>
      </section>)}

      {/* STEP 2 — Style */}
      {step === 2 && (<section className="mt-10">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <p className="label-tech">02 — Choose your style · {tradeLabel(trade)}</p>
          <button onClick={() => setStep(1)} className="font-tech text-xs uppercase tracking-widest text-muted-foreground hover:text-primary inline-flex gap-1 cursor-pointer"><ArrowLeft className="h-4 w-4" /> Change trade</button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {stylesForTrade(trade).map(s => (
            <button key={s.id} onClick={() => pickStyle(s)} className={`text-left border hairline bg-card overflow-hidden cursor-pointer hover:border-primary ${styleId === s.id ? "border-primary ring-1 ring-primary" : ""}`}>
              <div className="h-28 bg-black/40 border-b hairline"><PatternPreview kind={s.preview} accent={s.accent} accent2={s.accent2} /></div>
              <div className="p-5">
                <h3 className="font-display font-bold uppercase text-lg leading-tight">{s.name}</h3>
                <p className="text-sm text-muted-foreground mt-2">{s.desc}</p>
                {s.wastePct !== undefined && <span className="inline-block mt-3 font-tech text-[10px] uppercase tracking-widest border border-primary/50 text-primary px-2 py-0.5">Pattern waste {s.wastePct}%</span>}
                {s.paintFamily && (<span className="flex items-center gap-1.5 mt-3">{s.paintFamily.colours.map(c => <span key={c} className="w-5 h-5 border border-white/25" style={{ background: c }} />)}<span className="font-tech text-[10px] text-muted-foreground ml-1">{s.paintFamily.label}</span></span>)}
              </div>
            </button>
          ))}
        </div>
        <div className="mt-8 flex justify-end"><Button className="rounded-none font-display uppercase h-12 px-8" onClick={() => setStep(3)}>Continue — photo & dimensions <ArrowRight className="h-4 w-4 ml-2" /></Button></div>
      </section>)}

      {/* STEP 3 — Photo & dimensions */}
      {step === 3 && (<section className="mt-10 grid lg:grid-cols-[380px_1fr] gap-10">
        <div>
          <p className="label-tech mb-4">03 — Project photo (optional)</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => onPhoto(e.target.files?.[0])} />
          {photoUrl ? (
            <div className="border hairline">
              <img src={photoUrl} alt="Your project" className="w-full max-h-72 object-cover" />
              <div className="flex items-center justify-between px-4 py-3 bg-card">
                <span className="font-tech text-[11px] text-muted-foreground truncate">{photoName}</span>
                <button className="text-muted-foreground hover:text-red-400 cursor-pointer" aria-label="Remove photo" onClick={() => { URL.revokeObjectURL(photoUrl); setPhotoUrl(null); setPhotoName(""); }}><X className="h-4 w-4" /></button>
              </div>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="w-full border hairline border-dashed bg-card p-10 text-center cursor-pointer hover:border-primary">
              <Camera className="h-10 w-10 text-primary mx-auto" />
              <span className="font-display font-semibold uppercase block mt-3">Take / upload a photo</span>
              <span className="font-tech text-[11px] text-muted-foreground">Roof, room, bathroom, facade — any space</span>
            </button>
          )}
          <p className="font-tech text-[11px] text-muted-foreground mt-3">The photo stays in this session only (it is never uploaded or stored) — it appears on your estimate so you remember the job at a glance. Saved estimates record only that a photo was attached.</p>
          <div className="border hairline bg-primary/10 p-4 mt-5">
            <p className="text-sm">Don't know your measurements? <Link to="/snap-measure" className="text-primary font-semibold">Use Snap-Measure</Link> — photograph the building, calibrate with a door, and read real metres off the photo.</p>
          </div>
          <p className="font-tech text-[11px] text-muted-foreground mt-4">Style selected: <span className="text-primary">{style?.name}</span> · <button className="underline cursor-pointer" onClick={() => setStep(2)}>change style</button></p>
        </div>

        <div>
          <p className="label-tech mb-4">Dimensions — {tradeLabel(trade)} · {style?.name}</p>
          {trade === "roofing" && (<div className="space-y-7">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Num label="Building length (m)" value={input.roofLength} set={v => set({ roofLength: v })} />
              <Num label="Building width (m)" value={input.roofWidth} set={v => set({ roofWidth: v })} />
              <Num label="Eaves overhang (m)" value={input.roofOverhang} set={v => set({ roofOverhang: v })} />
              <Sel label="Roof style" value={input.roofStyle} set={v => set({ roofStyle: v as RoofStyle })} options={[["gable", "Gable"], ["hip", "Hip"], ["shed", "Shed / Mono-pitch"], ["flat", "Flat / Parapet"], ["mansard", "Mansard"]]} />
            </div>
            <div><label className="label-tech">Pitch: {input.roofPitch}°</label>
              <input type="range" min={5} max={50} value={input.roofPitch} onChange={e => set({ roofPitch: Number(e.target.value) })} className="w-full accent-[#FF6026]" aria-label="Pitch degrees" /></div>
            {styleId === "roof-longspan" ? (
              <Sel label="Longspan gauge" value={input.roofProfile} set={v => set({ roofProfile: v as ProfileId })} options={[["longspan-045", "Longspan 0.45mm — ₦9,800/m"], ["longspan-055", "Longspan 0.55mm — ₦11,500/m"]]} />
            ) : (
              <p className="font-tech text-xs text-muted-foreground">Profile for this style: <span className="text-primary">{PROFILES[profileForRoofStyle(styleId, input.roofProfile)].label}</span> — full options in the Pro Roof Calculator.</p>
            )}
            <div><label className="label-tech">Colour</label>
              <div className="flex flex-wrap gap-2 mt-2">{ROOF_COLOURS.map(c => (<button key={c.name} title={c.name} onClick={() => set({ roofColour: c.name })} className={`w-9 h-9 border-2 cursor-pointer ${input.roofColour === c.name ? "border-[#FF6026] scale-110" : "border-white/20"}`} style={{ background: c.hex }} aria-label={c.name} />))}</div>
              <p className="font-tech text-xs mt-2">Colour: <span className="text-primary">{input.roofColour}</span></p></div>
            <div className="grid sm:grid-cols-2 gap-4">
              {([["gutters", "Seamless gutters & downpipes"], ["insulation", "Reflective foil insulation"], ["installation", "Professional installation"], ["timber", "Timber purlins"]] as const).map(([id, label]) => (
                <label key={id} className="flex items-center gap-3 border hairline p-4 cursor-pointer hover:border-primary/60"><Checkbox checked={input.roofExtras[id]} onCheckedChange={c => set({ roofExtras: { ...input.roofExtras, [id]: !!c } })} /><span className="text-sm">{label}</span></label>
              ))}
            </div>
            <Sel label="Delivery zone" value={input.deliveryZone} set={v => set({ deliveryZone: v })} options={[["pickup", "Pickup from Ibafo plant — Free"], ["ogun-lagos", "Ogun / Lagos — ₦45,000"], ["south-west", "South-West — ₦85,000"], ["ss-se", "South-South / South-East — ₦145,000"], ["abuja-north", "Abuja / North — ₦185,000"]]} />
          </div>)}

          {trade === "tiling" && (<div className="space-y-7">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Num label="Room length (m)" value={input.length} set={v => set({ length: v })} />
              <Num label="Room width (m)" value={input.width} set={v => set({ width: v })} />
              <Num label="Wall height to tile (m)" value={input.height} set={v => set({ height: v })} hint="0 = floor only" />
              <Num label="Walls tiled (%)" value={input.wallsPct} set={v => set({ wallsPct: v })} step="5" hint="Share of the wall perimeter actually tiled" />
              <Sel label="Tile size" value={input.tileSizeId} set={v => set({ tileSizeId: v })} options={TILE_SIZES.map(t => [t.id, `${t.label} — est. ₦${t.pricePerTile.toLocaleString("en-NG")}/tile`] as [string, string])} />
            </div>
            <p className="font-tech text-xs text-muted-foreground">Pattern: <span className="text-primary">{style?.name}</span> — waste {TILING_WASTE[styleId] ?? 10}% is added to the tile count. Floor area: {(input.length * input.width).toFixed(1)} m².</p>
          </div>)}

          {trade === "woodwork" && (<div className="space-y-7">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Num label={styleId === "wood-louvre" ? "Total door frontage width (m)" : "Run / frontage width (m)"} value={input.width} set={v => set({ width: v })} hint={styleId === "wood-kitchen" ? "Length of the kitchen run" : styleId === "wood-shaker" ? "Total wardrobe width" : undefined} />
              <Num label="Height (m)" value={input.height} set={v => set({ height: v })} hint={styleId === "wood-kitchen" ? "Base + wall unit height ≈ 2.1–2.4m" : undefined} />
              <Num label={styleId === "wood-louvre" ? "Number of doors" : "Doors/fronts override (0 = auto)"} value={input.unitCount} set={v => set({ unitCount: v })} step="1" hint={styleId === "wood-louvre" ? "Each door gets boards, frame, hinges & locks" : styleId === "wood-kitchen" ? "Auto: 1 front per 0.55m" : "Auto: 1 door per 0.6m"} />
            </div>
            <p className="font-tech text-xs text-muted-foreground">Boards are costed from the frontage area (width × height) with the carcass factor for this style.</p>
          </div>)}

          {trade === "plumbing" && (<div className="space-y-7">
            <div>
              <p className="label-tech mb-3">Fixtures — adjust counts</p>
              <div className="border hairline divide-y divide-white/10">
                {(PLUMBING_FIXTURES[styleId] ?? []).map(f => {
                  const count = input.fixtures[f.key] ?? f.count;
                  return (<div key={f.key} className="flex items-center gap-3 px-4 py-3 bg-card">
                    <span className="text-sm flex-1">{f.label}<span className="block font-tech text-[10px] text-muted-foreground">quantity only — confirm price</span></span>
                    <button className="border hairline w-8 h-8 grid place-items-center hover:text-primary cursor-pointer" aria-label={`Remove one ${f.label}`} onClick={() => set({ fixtures: { ...input.fixtures, [f.key]: Math.max(0, count - 1) } })}><Minus className="h-4 w-4" /></button>
                    <span className="font-tech w-8 text-center">{count}</span>
                    <button className="border hairline w-8 h-8 grid place-items-center hover:text-primary cursor-pointer" aria-label={`Add one ${f.label}`} onClick={() => set({ fixtures: { ...input.fixtures, [f.key]: Math.min(20, count + 1) } })}><Plus className="h-4 w-4" /></button>
                  </div>);
                })}
              </div>
            </div>
            <label className="flex items-center gap-3 border hairline p-4 cursor-pointer hover:border-primary/60 max-w-md"><Checkbox checked={input.waterHeater} onCheckedChange={c => set({ waterHeater: !!c })} /><span className="text-sm">Add water heater point</span></label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Num label="Room length (m)" value={input.length} set={v => set({ length: v })} />
              <Num label="Room width (m)" value={input.width} set={v => set({ width: v })} />
            </div>
            <label className="flex items-center gap-3 border hairline p-4 cursor-pointer hover:border-primary/60 max-w-md"><Checkbox checked={input.tileAddon} onCheckedChange={c => set({ tileAddon: !!c })} /><span className="text-sm">Add bathroom tiling (floor + walls to 2.4m)</span></label>
            {input.tileAddon && (<div className="grid grid-cols-2 gap-4 max-w-md">
              <Num label="Walls tiled (%)" value={input.tileWallsPct} set={v => set({ tileWallsPct: v })} step="5" />
              <Sel label="Tile size" value={input.tileSizeId} set={v => set({ tileSizeId: v })} options={TILE_SIZES.map(t => [t.id, t.label] as [string, string])} />
            </div>)}
          </div>)}

          {trade === "interior" && (<div className="space-y-7">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Num label="Room length (m)" value={input.length} set={v => set({ length: v })} />
              <Num label="Room width (m)" value={input.width} set={v => set({ width: v })} />
              <Num label="Room height (m)" value={input.height} set={v => set({ height: v })} />
              <Num label="Openings deduction (%)" value={input.openingsPct} set={v => set({ openingsPct: v })} step="1" hint="Doors/windows share of wall area" />
            </div>
            {style?.paintFamily && (<p className="font-tech text-xs text-muted-foreground">Paint family: <span className="text-primary">{style.paintFamily.label}</span> — paint litres are the same for any colour in the family.</p>)}
            <Sel label="Ceiling type" value={input.ceilingType} set={v => set({ ceilingType: v as EstimatorInput["ceilingType"] })} options={[["pop", "POP (cast in place)"], ["plasterboard", "Plasterboard (1.2 × 2.4m sheets)"], ["pvc", "PVC ceiling panels"]]} />
            <Sel label="Floor finish" value={input.floorFinish} set={v => set({ floorFinish: v })} options={[["none", "None / existing floor"], ...stylesForTrade("tiling").map(s => [s.id, `Tiles — ${s.name}`] as [string, string])]} />
            {input.floorFinish !== "none" && <Sel label="Floor tile size" value={input.tileSizeId} set={v => set({ tileSizeId: v })} options={TILE_SIZES.map(t => [t.id, t.label] as [string, string])} />}
          </div>)}

          {trade === "windows-doors" && (<div className="space-y-7">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Num label="Number of openings" value={input.openingsCount} set={v => set({ openingsCount: v })} step="1" />
              <Num label="Average width (m)" value={input.avgOpeningW} set={v => set({ avgOpeningW: v })} />
              <Num label="Average height (m)" value={input.avgOpeningH} set={v => set({ avgOpeningH: v })} />
              <Num label="…or total glazed area (m²)" value={input.directArea} set={v => set({ directArea: v })} hint="Leave 0 to use count × average size" />
            </div>
            <p className="font-tech text-xs text-muted-foreground">Priced per m² prorated from the catalog unit (see the basis note on the result). Current area: <span className="text-primary">{(input.directArea > 0 ? input.directArea : input.openingsCount * input.avgOpeningW * input.avgOpeningH).toFixed(2)} m²</span>.</p>
          </div>)}

          {trade === "exterior" && (<div className="space-y-7">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Num label="Wall length (m)" value={input.length} set={v => set({ length: v })} hint="Per elevation" />
              <Num label="Wall height (m)" value={input.height} set={v => set({ height: v })} />
              <Num label="Elevations (walls)" value={input.elevations} set={v => set({ elevations: v })} step="1" />
              <Num label="Openings deduction (%)" value={input.openingsPct} set={v => set({ openingsPct: v })} step="1" />
            </div>
            <p className="font-tech text-xs text-muted-foreground">Gross area: {(input.length * input.height * Math.max(1, input.elevations)).toFixed(1)} m² before the openings deduction.</p>
          </div>)}

          <div className="flex flex-wrap gap-3 mt-10">
            <Button variant="outline" className="rounded-none font-display uppercase h-12" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-2" /> Style</Button>
            <Button className="rounded-none font-display uppercase h-12 px-8" onClick={() => setStep(4)}>See my materials list <ArrowRight className="h-4 w-4 ml-2" /></Button>
          </div>
        </div>
      </section>)}

      {/* STEP 4 — Result */}
      {step === 4 && (<section className="mt-10">
        <div className="border border-primary/60 bg-primary/10 p-5 flex gap-3 no-print">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm"><b>Guided estimator</b> — you picked the style, added a photo and real dimensions; a <b>free site measurement</b> confirms the final list before you buy. Lines marked <span className="font-tech text-[11px] border border-primary/50 text-primary px-1.5 py-0.5">CATALOG</span> are live shop prices; <span className="font-tech text-[11px] border border-white/30 px-1.5 py-0.5">ESTIMATOR RATE</span> lines are honest site estimates; fixtures are quantities only.</p>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-8 mt-8 items-start">
          <div className="print-boq border hairline bg-card">
            <div className="px-6 py-5 border-b hairline flex flex-wrap gap-4 items-start justify-between">
              <div>
                <h2 className="font-display font-bold uppercase text-2xl leading-tight">{style?.name} — Materials List</h2>
                <p className="font-tech text-[11px] text-muted-foreground mt-1">{tradeLabel(trade)} · {BUSINESS.name}{savedCode ? ` · ${savedCode}` : ""} · Photo attached at creation: {photoUrl ? "yes" : "no"}</p>
              </div>
              {photoUrl && <img src={photoUrl} alt="Your project" className="w-28 h-20 object-cover border hairline" />}
            </div>
            <div className="px-6 py-4 border-b hairline flex flex-wrap gap-2">
              {result.drivers.map(d => (<span key={d.label} className="border hairline px-3 py-1.5 font-tech text-[11px]"><span className="text-muted-foreground">{d.label}:</span> <span className="text-primary">{d.value}</span></span>))}
              {result.wastePct !== undefined && <span className="border hairline px-3 py-1.5 font-tech text-[11px]"><span className="text-muted-foreground">Waste:</span> <span className="text-primary">{result.wastePct}%</span></span>}
            </div>
            {result.groups.map(g => (
              <div key={g.name} className="px-6 py-5 border-b hairline">
                <h3 className="font-display font-bold uppercase text-lg">{g.name}</h3>
                <div className="overflow-x-auto mt-3"><table className="w-full text-sm min-w-[620px]"><thead><tr className="border-b hairline text-left font-tech text-[10px] uppercase tracking-widest text-muted-foreground"><th className="py-2 pr-2 no-print">Buy</th><th className="py-2 pr-2">Item</th><th className="py-2 pr-2 text-right">Qty</th><th className="py-2 pr-2 text-right">Rate</th><th className="py-2 text-right">Total</th></tr></thead>
                <tbody>{g.lines.map(l => { const key = `${g.name}:${l.name}`; const ticked = checked.has(key); return (
                  <tr key={key} className="border-b hairline align-top">
                    <td className="py-2 pr-2 no-print"><Checkbox checked={ticked} onCheckedChange={v => setChecked(prev => { const n = new Set(prev); if (v) n.add(key); else n.delete(key); return n; })} aria-label={`Tick off ${l.name}`} /></td>
                    <td className={`py-2 pr-2 ${ticked ? "line-through text-muted-foreground" : ""}`}><span className="font-medium">{l.name}</span>
                      <span className="flex flex-wrap gap-1.5 mt-1">
                        {l.priceSource === "catalog" && <span className="font-tech text-[9px] border border-primary/50 text-primary px-1 py-px uppercase tracking-widest">Catalog</span>}
                        {l.priceSource === "estimator" && <span className="font-tech text-[9px] border border-white/30 text-muted-foreground px-1 py-px uppercase tracking-widest">Estimator rate</span>}
                        {l.priceSource === null && <span className="font-tech text-[9px] border border-white/20 text-muted-foreground px-1 py-px uppercase tracking-widest">Confirm price</span>}
                      </span>
                      {l.note && <span className="block font-tech text-[10px] text-muted-foreground mt-1">{l.note}</span>}</td>
                    <td className="py-2 pr-2 text-right font-tech whitespace-nowrap">{l.qty.toLocaleString()} {l.unit}</td>
                    <td className="py-2 pr-2 text-right font-tech whitespace-nowrap">{l.unitPrice !== undefined ? formatNGN(l.unitPrice) : "—"}</td>
                    <td className="py-2 text-right font-tech whitespace-nowrap">{l.total !== undefined ? formatNGN(l.total) : "confirm"}</td>
                  </tr>); })}
                </tbody></table></div>
              </div>
            ))}
            <div className="px-6 py-5">
              <p className="label-tech mb-2">Assumptions & how quantities were worked out</p>
              <ul className="space-y-1.5">{result.assumptions.map((a, i) => (<li key={i} className="font-tech text-[11px] text-muted-foreground flex gap-2"><span className="text-primary">///</span>{a}</li>))}</ul>
            </div>
          </div>

          <aside className="border hairline bg-card h-fit lg:sticky lg:top-28 no-print">
            <div className="px-6 py-4 border-b hairline"><span className="label-tech">Estimate summary</span></div>
            <div className="px-6 py-5 space-y-4">
              <div><p className="font-tech text-[11px] text-muted-foreground">Priced subtotal (catalog + estimator lines)</p>
                <p className="font-display font-bold text-4xl text-primary mt-1">{formatNGN(result.pricedTotal)}</p>
                {result.unpricedCount > 0 && <p className="font-tech text-[11px] text-yellow-400 mt-1">+ {result.unpricedCount} item{result.unpricedCount === 1 ? "" : "s"} to confirm price (quantities listed)</p>}
              </div>
              <p className="font-tech text-[11px] text-muted-foreground">Tick-off progress: {checked.size} of {allLines.length} items bought/collected.</p>
              <div className="grid grid-cols-1 gap-2.5">
                <Button className="rounded-none font-display uppercase h-11" onClick={doSave}><CheckCircle2 className="h-4 w-4 mr-2" /> Save estimate</Button>
                <Button variant="outline" className="rounded-none font-display uppercase h-11" onClick={createWorkspaceProject}><FolderPlus className="h-4 w-4 mr-2" /> Create Workspace Project</Button>
                <Button variant="outline" className="rounded-none font-display uppercase h-11" onClick={downloadCSV}><Download className="h-4 w-4 mr-2" /> Download CSV</Button>
                <Button variant="outline" className="rounded-none font-display uppercase h-11" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Print list</Button>
                <Button variant="outline" className="rounded-none font-display uppercase h-11" asChild><a target="_blank" rel="noreferrer" href={businessWaLink(waText())}>WhatsApp summary</a></Button>
                <Button variant="outline" className="rounded-none font-display uppercase h-11" asChild><Link to={`/book?service=${bookService}`}><CalendarCheck className="h-4 w-4 mr-2" /> Book a pro</Link></Button>
                <Link to="/partners" className="inline-flex items-center font-tech text-xs text-muted-foreground hover:text-primary self-center">or pick a pro in the directory →</Link>
                <Button variant="ghost" className="rounded-none font-display uppercase h-11" onClick={() => setStep(3)}><ArrowLeft className="h-4 w-4 mr-2" /> Edit dimensions</Button>
              </div>
              {savedCode && <p className="font-tech text-[11px] text-primary">Saved as {savedCode} — find it in Saved Estimates below.</p>}
              <p className="font-tech text-[11px] text-muted-foreground">Confirm the final list free: book a site measurement and our team verifies every quantity on site.</p>
            </div>
          </aside>
        </div>
      </section>)}

      {/* Saved estimates */}
      <section className="mt-14 no-print">
        <div className="flex items-center gap-3 mb-5"><ClipboardList className="h-6 w-6 text-primary" /><h2 className="font-display font-bold uppercase text-2xl">Saved estimates</h2><span className="font-tech text-[11px] text-muted-foreground">stored on this device (oketex-estimates) — photos are never stored</span></div>
        {saved.length === 0 ? (
          <div className="border hairline py-14 text-center"><p className="font-tech text-sm uppercase tracking-widest text-muted-foreground">No saved estimates yet — run the wizard above and tap “Save estimate”</p></div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {saved.map(e => (
              <div key={e.code} className="border hairline bg-card p-5">
                <div className="flex justify-between items-start gap-3">
                  <div><p className="font-tech text-[11px] text-primary">{e.code}</p>
                  <h3 className="font-display font-bold uppercase text-lg leading-tight mt-1">{e.styleName}</h3>
                  <p className="font-tech text-[11px] text-muted-foreground mt-1">{e.tradeLabel} · {new Date(e.createdAt).toLocaleDateString("en-NG")} · Photo attached at creation: {e.photoAttached ? "yes" : "no"}</p></div>
                  <button className="text-muted-foreground hover:text-red-400 cursor-pointer" aria-label={`Delete ${e.code}`} onClick={() => { deleteEstimate(e.code); setSaved(getEstimates()); toast.success("Estimate deleted"); }}><Trash2 className="h-4 w-4" /></button>
                </div>
                <p className="font-display font-bold text-2xl text-primary mt-3">{formatNGN(e.pricedTotal)}</p>
                {e.unpricedCount > 0 && <p className="font-tech text-[11px] text-muted-foreground">+ {e.unpricedCount} item(s) to confirm price</p>}
                <Button variant="outline" className="rounded-none font-display uppercase text-xs mt-4 w-full" onClick={() => loadSaved(e)}>Load estimate</Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  </div>);
}
