import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { PageHead } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, BookOpen, Camera, Check, ChevronRight, CircleStop, Hammer, Mic, Search, Send, Sparkles, Video } from "lucide-react";
import {
  GUIDE_AREAS, GUIDE_TRADES, PATTERN_FAMILIES, ROOF_DETAILS, ROOF_PATTERNS, detailById, identifyGuide, overlapSummary, patternById,
  type GuideAreaId, type GuideTrade, type IdentifyMaterial, type IdentifyProblem, type RoofDetail, type RoofPattern,
} from "@/data/roofPatterns";
import { TRADE_CARDS, cardsForTrade, tradeCardById, type TradeGuideCard } from "@/data/tradeGuides";
import { SketchCaption, SketchFor, CabinetSketchPanel } from "@/components/ProSketches";
import VoiceGuide from "@/components/VoiceGuide";
import AiAssistPanel from "@/components/AiAssistPanel";
import {
  confirmKnowledgeAsync, getPartnerProof, getSeedConfirmations, listKnowledgeAsync, mergeLibrary, savePartnerProof, seedConfirmedBy,
  type KnowledgeEntry, type MergedEntry,
} from "@/lib/knowledge";
import { findPartnerOwnerAsync } from "@/lib/partnerStorage";
import { defaultChecklist, emptyTakeOffRow, getProProjects, saveProProjects, uid, type ProProject, type ProTrade } from "@/lib/proStorage";
import { getEntitlements } from "@/lib/plans";
import type { ProfileId } from "@/lib/roofEngine";

type View =
  | { kind: "pattern"; id: string }
  | { kind: "detail"; id: string }
  | { kind: "card"; id: string }
  | { kind: "community"; id: string };

const TRADE_TO_PRO_TRADE: Record<GuideTrade, ProTrade> = {
  Roofing: "Roofer", Plumbing: "Builder", Tiling: "Builder", "Carpentry & Woodwork": "Carpenter",
  Electrical: "Builder", "Painting & Finishing": "Builder", "Concrete & Masonry": "Builder", "Welding & Metalwork": "Builder",
  "Interior & Cabinetry": "Carpenter",
};

function createProjectFromGuide(name: string, trade: GuideTrade, notes: string, profile?: string): boolean {
  const ent = getEntitlements();
  const mine = getProProjects().filter(p => !p.sample);
  if (!ent.isPro && mine.length >= ent.freeProjects) return false;
  const row = emptyTakeOffRow();
  if (profile) row.profile = profile as ProfileId;
  const project: ProProject = {
    id: uid(), name: `${name} — site job`, client: "", siteAddress: "",
    date: new Date().toISOString().slice(0, 10), trade: TRADE_TO_PRO_TRADE[trade], status: "Measuring",
    notes, takeoff: [row], measures: [], checklist: defaultChecklist(), createdAt: new Date().toISOString(),
  };
  saveProProjects([project, ...getProProjects()]);
  return true;
}

// ---------- field confirmation ("This worked for me") ----------
function ConfirmButton({ targetId, isSeed, seedTitle, seedTrade, initialCount }: {
  targetId: string; isSeed: boolean; seedTitle?: string; seedTrade?: string; initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);
  const [proof, setProof] = useState(getPartnerProof());
  const [form, setForm] = useState({ code: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { setCount(initialCount); }, [initialCount]);
  useEffect(() => {
    if (proof && isSeed) setDone(seedConfirmedBy(targetId, proof.code));
  }, [proof, isSeed, targetId]);

  const confirm = async (p: { code: string; phone: string }) => {
    setBusy(true);
    try {
      const partner = await findPartnerOwnerAsync(p.code, p.phone);
      if (!partner) { toast.error("No approved partner matches that code + phone. Pros confirm from their registered details."); return; }
      savePartnerProof({ code: partner.code, phone: p.phone, name: partner.businessName });
      setProof({ code: partner.code, phone: p.phone, name: partner.businessName });
      const r = await confirmKnowledgeAsync({ id: targetId, isSeed, seedTitle, seedTrade }, partner, p.phone);
      if (r.error) { toast.error(r.error); return; }
      setCount(r.confirmations); setDone(true);
      toast.success(r.alreadyConfirmed ? "You already confirmed this one — one tap per pro." : "Confirmed — thank you. Field confirmations rank this library.");
    } finally { setBusy(false); }
  };

  return (
    <div className="border hairline p-4 bg-card">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" className="rounded-none font-display uppercase h-10" disabled={busy || done} onClick={() => proof && void confirm(proof)}>
          <Check className="h-4 w-4 mr-2" /> {done ? "You confirmed this worked" : "This worked for me"}
        </Button>
        {count >= 1 && <span className="font-tech text-xs text-emerald-400">✓ Verified in the field by {count} pro{count === 1 ? "" : "s"}</span>}
        {!proof && <span className="font-tech text-[11px] text-muted-foreground">Registered pros only — confirm with your partner code + phone.</span>}
      </div>
      {!proof && (
        <div className="grid sm:grid-cols-3 gap-3 mt-3">
          <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Partner code (PRT-…)" className="field-tech font-tech" />
          <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Registered phone" className="field-tech font-tech" />
          <Button className="rounded-none font-display uppercase h-10" disabled={busy || !form.code || !form.phone} onClick={() => void confirm(form)}>Confirm as this pro</Button>
        </div>
      )}
    </div>
  );
}

// ---------- shared bits ----------
function SpecRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 py-2 border-b hairline last:border-0"><span className="font-tech text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span><span className="font-tech text-sm text-right">{value}</span></div>;
}
function StepsList({ steps }: { steps: string[] }) {
  return <ol className="space-y-3">{steps.map((s, i) => (
    <li key={i} className="flex gap-3"><span className="font-display font-bold text-primary text-lg leading-none mt-0.5">{i + 1}.</span><span className="text-sm leading-relaxed">{s}</span></li>
  ))}</ol>;
}
function FixesList({ fixes }: { fixes: { problem: string; fix: string }[] }) {
  return <div className="space-y-3">{fixes.map((f, i) => (
    <div key={i} className="border hairline p-4"><p className="font-display font-bold uppercase text-sm text-primary">{f.problem}</p><p className="text-sm text-muted-foreground mt-1 leading-relaxed">{f.fix}</p></div>
  ))}</div>;
}
function Checklist({ tools, materials }: { tools: string[]; materials: string[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setChecked(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const items = [...tools.map(t => ({ k: `t:${t}`, label: t, tag: "Tool" })), ...materials.map(m => ({ k: `m:${m}`, label: m, tag: "Material" }))];
  return <div className="grid sm:grid-cols-2 gap-2">{items.map(it => (
    <label key={it.k} className="flex items-start gap-2 border hairline px-3 py-2 cursor-pointer hover:border-primary text-sm">
      <input type="checkbox" checked={checked.has(it.k)} onChange={() => toggle(it.k)} className="mt-1 accent-[#FF6026]" />
      <span>{it.label} <span className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground">· {it.tag}</span></span>
    </label>
  ))}</div>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display font-bold uppercase text-xl mt-10 mb-4">{children}</h3>;
}

function ActionRow({ trade, name, notes, quoteProfile, roofRelated }: { trade: GuideTrade; name: string; notes: string; quoteProfile?: string; roofRelated: boolean }) {
  const navigate = useNavigate();
  const create = () => {
    if (createProjectFromGuide(name, trade, notes, quoteProfile)) { toast.success("Workspace project created — your take-off sheet is ready."); navigate("/workspace"); }
    else { toast.error("Free plan project limit reached — opening the Workspace, where you can upgrade or finish a project first."); navigate("/workspace"); }
  };
  return (
    <div className="flex flex-wrap gap-3 mt-10">
      {roofRelated && <Link to={quoteProfile ? `/quote?profile=${quoteProfile}` : "/quote"}><Button className="rounded-none font-display uppercase h-11">Open in Calculator <ArrowRight className="h-4 w-4 ml-2" /></Button></Link>}
      <Button variant="outline" className="rounded-none font-display uppercase h-11" onClick={create}>Create Workspace project</Button>
      <Link to="/snap-send"><Button variant="outline" className="rounded-none font-display uppercase h-11"><Send className="h-4 w-4 mr-2" /> Snap &amp; Send this problem</Button></Link>
    </div>
  );
}

// ---------- pattern view ----------
function PatternView({ pattern, community, onBack }: { pattern: RoofPattern; community: KnowledgeEntry[]; onBack: () => void }) {
  const [sheetLen, setSheetLen] = useState(5.08);
  const [pitch, setPitch] = useState(() => Math.min(pattern.pitchRangeDeg[1], Math.max(pattern.pitchRangeDeg[0], 25)));
  const [overhang, setOverhang] = useState(0.6);
  const voiceLines = [
    `Pitch range ${pattern.pitchRangeDeg[0]} to ${pattern.pitchRangeDeg[1]} degrees. Gauges: ${pattern.gaugeOptions}.`,
    `Laps: ${overlapSummary(pattern)}. ${pattern.overlapMm.note}`,
    `Fixing: ${pattern.fastenerPattern}`,
    "Installation steps.", ...pattern.installSteps.map((s, i) => `Step ${i + 1}. ${s}`),
  ];
  return (
    <div>
      <BackBtn onBack={onBack} />
      <p className="font-tech text-[11px] uppercase tracking-[0.3em] text-primary mt-6">{pattern.family} · Roofing pattern</p>
      <h2 className="font-display font-bold uppercase text-3xl md:text-4xl mt-1">{pattern.name}</h2>
      <p className="text-muted-foreground mt-2 max-w-3xl">Best for: {pattern.bestFor}</p>
      <div className="mt-6"><VoiceGuide title={pattern.name} lines={voiceLines} /></div>
      <div className="grid lg:grid-cols-5 gap-8 mt-8">
        <div className="lg:col-span-2 border hairline bg-card p-5 h-fit">
          <p className="label-tech mb-2">The standard</p>
          <SpecRow label="Pitch range" value={`${pattern.pitchRangeDeg[0]}° – ${pattern.pitchRangeDeg[1]}°`} />
          <SpecRow label="Gauges" value={pattern.gaugeOptions} />
          <SpecRow label="Laps" value={overlapSummary(pattern)} />
          <SpecRow label="Fixing" value={pattern.fastenerPattern} />
          <p className="font-tech text-[11px] text-muted-foreground mt-3">{pattern.overlapMm.note}</p>
          <p className="font-tech text-[11px] text-amber-400 mt-2">Avoid: {pattern.avoidWhen}</p>
        </div>
        <div className="lg:col-span-3">
          <SectionTitle>Installation steps</SectionTitle>
          <StepsList steps={pattern.installSteps} />
        </div>
      </div>
      <SectionTitle>Installation sketch — set your numbers</SectionTitle>
      <div className="grid grid-cols-3 gap-4 max-w-2xl mb-4">
        <NumField label="Sheet length (m)" value={sheetLen} set={setSheetLen} step="0.01" />
        <NumField label="Pitch (°)" value={pitch} set={setPitch} step="1" />
        <NumField label="Eave overhang (m)" value={overhang} set={setOverhang} step="0.05" />
      </div>
      <SketchFor kind={pattern.sketchKind} pattern={pattern} sheetLengthM={sheetLen} pitchDeg={pitch} overhangM={overhang} runM={8} ratioDenominator={200} />
      <SketchCaption />
      <SectionTitle>Common fixes</SectionTitle>
      <FixesList fixes={pattern.commonFixes} />
      <SectionTitle>Tools &amp; materials checklist</SectionTitle>
      <Checklist tools={pattern.tools} materials={pattern.materials} />
      <div className="mt-10"><ConfirmButton targetId={pattern.id} isSeed seedTitle={pattern.name} seedTrade="Roofing" initialCount={seedCountOf(pattern.id, community)} /></div>
      <ActionRow trade="Roofing" name={pattern.name} quoteProfile={pattern.quoteProfile} roofRelated
        notes={`Pro Guide pattern: ${pattern.name} (${pattern.family}). Pitch ${pattern.pitchRangeDeg[0]}–${pattern.pitchRangeDeg[1]}°. ${overlapSummary(pattern)}. Fixing: ${pattern.fastenerPattern}`} />
    </div>
  );
}

// ---------- roofing detail view ----------
function DetailView({ detail, community, onBack }: { detail: RoofDetail; community: KnowledgeEntry[]; onBack: () => void }) {
  const [overhang, setOverhang] = useState(0.6);
  const [run, setRun] = useState(8);
  const [ratio, setRatio] = useState(200);
  const voiceLines = [...detail.keySpecs, "Steps.", ...detail.steps.map((s, i) => `Step ${i + 1}. ${s}`)];
  return (
    <div>
      <BackBtn onBack={onBack} />
      <p className="font-tech text-[11px] uppercase tracking-[0.3em] text-primary mt-6">Roofing detail</p>
      <h2 className="font-display font-bold uppercase text-3xl md:text-4xl mt-1">{detail.name}</h2>
      <div className="mt-6"><VoiceGuide title={detail.name} lines={voiceLines} /></div>
      <div className="grid lg:grid-cols-5 gap-8 mt-8">
        <div className="lg:col-span-2 border hairline bg-card p-5 h-fit">
          <p className="label-tech mb-2">Standard measurements</p>
          <ul className="space-y-2">{detail.keySpecs.map((s, i) => <li key={i} className="font-tech text-sm flex gap-2"><span className="text-primary">▪</span>{s}</li>)}</ul>
        </div>
        <div className="lg:col-span-3">
          <SectionTitle>How it is done</SectionTitle>
          <StepsList steps={detail.steps} />
        </div>
      </div>
      <SectionTitle>Installation sketch{detail.sketchKind === "gutter" ? " — set your run and fall" : ""}</SectionTitle>
      {detail.sketchKind === "gutter" && (
        <div className="grid grid-cols-2 gap-4 max-w-xl mb-4">
          <NumField label="Gutter run (m)" value={run} set={setRun} step="0.5" />
          <div><label className="label-tech">Fall ratio</label>
            <select value={ratio} onChange={e => setRatio(Number(e.target.value))} className="field-tech font-tech bg-background w-full">
              {[100, 200, 350, 600].map(r => <option key={r} value={r}>1:{r}{r === 200 ? " (sketch default)" : ""}</option>)}
            </select></div>
        </div>
      )}
      {detail.sketchKind === "fascia" && (
        <div className="grid grid-cols-2 gap-4 max-w-xl mb-4"><NumField label="Eave overhang (m)" value={overhang} set={setOverhang} step="0.05" /></div>
      )}
      <SketchFor kind={detail.sketchKind} sheetLengthM={5.08} pitchDeg={25} overhangM={overhang} runM={run} ratioDenominator={ratio} />
      <SketchCaption />
      <SectionTitle>Common fixes</SectionTitle>
      <FixesList fixes={detail.commonFixes} />
      <SectionTitle>Tools &amp; materials checklist</SectionTitle>
      <Checklist tools={detail.tools} materials={detail.materials} />
      <div className="mt-10"><ConfirmButton targetId={detail.id} isSeed seedTitle={detail.name} seedTrade="Roofing" initialCount={seedCountOf(detail.id, community)} /></div>
      <ActionRow trade="Roofing" name={detail.name} roofRelated notes={`Pro Guide detail: ${detail.name}. ${detail.keySpecs.join(" · ")}`} />
    </div>
  );
}

// ---------- trade card view ----------
function CardView({ card, community, onBack }: { card: TradeGuideCard; community: KnowledgeEntry[]; onBack: () => void }) {
  const voiceLines = [`Used for: ${card.whereUsed}`, ...card.keySpecs, "Steps.", ...card.steps.map((s, i) => `Step ${i + 1}. ${s}`)];
  return (
    <div>
      <BackBtn onBack={onBack} />
      <p className="font-tech text-[11px] uppercase tracking-[0.3em] text-primary mt-6">{card.trade} · {card.kind === "pattern" ? "Pattern" : "Detail"}</p>
      <h2 className="font-display font-bold uppercase text-3xl md:text-4xl mt-1">{card.name}</h2>
      <p className="text-muted-foreground mt-2 max-w-3xl">{card.whereUsed}</p>
      <div className="mt-6"><VoiceGuide title={card.name} lines={voiceLines} /></div>
      <div className="grid lg:grid-cols-5 gap-8 mt-8">
        <div className="lg:col-span-2 border hairline bg-card p-5 h-fit">
          <p className="label-tech mb-2">Key specs — typical practice</p>
          <ul className="space-y-2">{card.keySpecs.map((s, i) => <li key={i} className="font-tech text-sm flex gap-2"><span className="text-primary">▪</span>{s}</li>)}</ul>
        </div>
        <div className="lg:col-span-3">
          <SectionTitle>Steps</SectionTitle>
          <StepsList steps={card.steps} />
        </div>
      </div>
      {(card.id === "cab-guide-kitchen" || card.id === "cab-guide-wardrobe") && (<>
        <SectionTitle>Cabinet elevation sketch</SectionTitle>
        <CabinetSketchPanel />
      </>)}
      {card.trade !== "Interior & Cabinetry" && (
        <p className="font-tech text-[11px] text-muted-foreground mt-8 border hairline px-3 py-2 max-w-3xl">Sketches are roofing-only in this pass — this card carries the full written standard instead.</p>
      )}
      <SectionTitle>Common fixes</SectionTitle>
      <FixesList fixes={card.commonFixes} />
      <SectionTitle>Tools &amp; materials checklist</SectionTitle>
      <Checklist tools={card.tools} materials={card.materials} />
      <div className="mt-10"><ConfirmButton targetId={card.id} isSeed seedTitle={card.name} seedTrade={card.trade} initialCount={seedCountOf(card.id, community)} /></div>
      <ActionRow trade={card.trade} name={card.name} roofRelated={false}
        notes={`Pro Guide card: ${card.name} (${card.trade}). ${card.keySpecs.join(" · ")}`} />
    </div>
  );
}

// ---------- community entry view ----------
function CommunityView({ entry, onBack }: { entry: KnowledgeEntry; onBack: () => void }) {
  const steps = entry.body.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const voiceLines = steps.length > 1 ? steps : [entry.body];
  return (
    <div>
      <BackBtn onBack={onBack} />
      <p className="font-tech text-[11px] uppercase tracking-[0.3em] text-primary mt-6">{entry.trade} · {entry.kind} · From the field</p>
      <h2 className="font-display font-bold uppercase text-3xl md:text-4xl mt-1">{entry.title}</h2>
      <p className="font-tech text-xs text-muted-foreground mt-2">Contributed by {entry.contributorName || "an Oketex pro"} · approved by Oketex staff before publishing</p>
      <div className="mt-6"><VoiceGuide title={entry.title} lines={voiceLines} /></div>
      <SectionTitle>{entry.kind === "fix" ? "The fix" : entry.kind === "pattern" ? "The pattern" : "The tip"}</SectionTitle>
      {steps.length > 1 ? <StepsList steps={steps} /> : <p className="text-sm leading-relaxed whitespace-pre-line max-w-3xl">{entry.body}</p>}
      {!!entry.tools?.length && (<><SectionTitle>Tools</SectionTitle>
        <div className="flex flex-wrap gap-2">{entry.tools.map(t => <span key={t} className="font-tech text-xs border hairline px-2.5 py-1">{t}</span>)}</div></>)}
      <div className="mt-10"><ConfirmButton targetId={entry.id} isSeed={false} initialCount={entry.confirmations || 0} /></div>
      <ActionRow trade={(entry.trade as GuideTrade) || "Roofing"} name={entry.title} roofRelated={entry.trade === "Roofing"} notes={`Community knowledge: ${entry.title} (${entry.trade}).`} />
    </div>
  );
}

function BackBtn({ onBack }: { onBack: () => void }) {
  return <button onClick={onBack} className="font-tech text-[11px] uppercase tracking-widest inline-flex items-center gap-2 hover:text-primary cursor-pointer"><ArrowLeft className="h-3.5 w-3.5" /> Back to the guide</button>;
}
function NumField({ label, value, set, step }: { label: string; value: number; set: (n: number) => void; step: string }) {
  return <div><label className="label-tech">{label}</label><input type="number" step={step} value={value} onChange={e => set(parseFloat(e.target.value) || 0)} className="field-tech font-tech" /></div>;
}
function seedCountOf(id: string, community: KnowledgeEntry[]): number {
  const ptr = community.find(e => e.id === id && e.kind === "seedref");
  return (ptr?.confirmations || 0) + (getSeedConfirmations()[id]?.count || 0);
}

// ---------- snap / record intake + guided identification ----------
function SnapIntake({ onOpen }: { onOpen: (v: View) => void }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [clip, setClip] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [area, setArea] = useState<GuideAreaId>("roof-surface");
  const [material, setMaterial] = useState<IdentifyMaterial>("aluminium");
  const [problem, setProblem] = useState<IdentifyProblem>("forgot-pattern");
  const result = useMemo(() => identifyGuide({ area, material, problem }), [area, material, problem]);

  const stopCam = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; setCamOn(false); setRecording(false); };
  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); if (photo) URL.revokeObjectURL(photo); if (clip) URL.revokeObjectURL(clip); }, []); // eslint-disable-line
  const startCam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = s; setCamOn(true);
      requestAnimationFrame(() => { if (videoRef.current) videoRef.current.srcObject = s; });
    } catch { toast.error("Camera unavailable here — upload a photo instead."); }
  };
  const snapFrame = () => {
    const v = videoRef.current; if (!v) return;
    const c = document.createElement("canvas"); c.width = v.videoWidth || 960; c.height = v.videoHeight || 540;
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    setPhoto(c.toDataURL("image/jpeg", 0.85)); stopCam();
  };
  const toggleRecord = () => {
    if (recording) { recRef.current?.stop(); return; }
    const s = streamRef.current; if (!s) return;
    chunksRef.current = [];
    try {
      const rec = new MediaRecorder(s);
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => { const url = URL.createObjectURL(new Blob(chunksRef.current, { type: "video/webm" })); setClip(url); setRecording(false); stopCam(); };
      recRef.current = rec; rec.start(); setRecording(true);
    } catch { toast.error("Recording is not supported in this browser — a photo works too."); }
  };
  const openResult = () => {
    if (result.kind === "detail") onOpen({ kind: "detail", id: result.id });
    else onOpen({ kind: "pattern", id: result.id });
  };
  const sel = "field-tech font-tech bg-background w-full";
  return (
    <section className="border hairline bg-card p-6">
      <h3 className="font-display font-bold uppercase text-xl flex items-center gap-2"><Camera className="h-5 w-5 text-primary" /> Snap it / record it — then answer 3 questions</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-3xl">Forgot the pattern? Looking at a problem you cannot name? Photograph or film it, answer three quick questions, and the guide narrows to the card that matches. Media stays in this session only — never uploaded or stored.</p>
      <div className="grid md:grid-cols-2 gap-6 mt-5">
        <div>
          {!camOn && !photo && (
            <div className="flex flex-wrap gap-3">
              <label className="cursor-pointer"><span className="inline-flex items-center gap-2 border hairline px-4 h-11 font-display uppercase text-sm hover:border-primary"><Camera className="h-4 w-4" /> Take / upload photo</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setPhoto(URL.createObjectURL(f)); }} /></label>
              <Button variant="outline" className="rounded-none font-display uppercase h-11" onClick={() => void startCam()}><Video className="h-4 w-4 mr-2" /> Open camera</Button>
            </div>
          )}
          {camOn && (
            <div>
              <video ref={videoRef} autoPlay playsInline muted className="w-full border hairline bg-black aspect-video object-cover" />
              <div className="flex flex-wrap gap-3 mt-3">
                <Button className="rounded-none font-display uppercase h-10" onClick={snapFrame}><Camera className="h-4 w-4 mr-2" /> Capture photo</Button>
                <Button variant="outline" className="rounded-none font-display uppercase h-10" onClick={toggleRecord}>{recording ? <><CircleStop className="h-4 w-4 mr-2 text-red-500" /> Stop clip</> : <><Video className="h-4 w-4 mr-2" /> Record clip</>}</Button>
                <Button variant="ghost" className="rounded-none font-display uppercase h-10" onClick={stopCam}>Close camera</Button>
              </div>
            </div>
          )}
          {photo && !camOn && (<div><img src={photo} alt="What you are looking at — session only" className="w-full border hairline object-cover max-h-72" />
            <button onClick={() => setPhoto(null)} className="font-tech text-[11px] uppercase tracking-widest mt-2 hover:text-primary cursor-pointer">Clear photo</button></div>)}
          {clip && (<div className="mt-3"><video src={clip} controls className="w-full border hairline max-h-72" />
            <p className="font-tech text-[11px] text-muted-foreground mt-1">Your clip — session only. Walk it slowly past the detail you forgot; the answers below do the identifying.</p></div>)}
          <div className="mt-5"><AiAssistPanel context="pro-guide" /></div>
        </div>
        <div>
          <p className="label-tech mb-3">Guided identification — pick what matches your photo</p>
          <div className="space-y-4">
            <div><label className="label-tech">1 · What do you see?</label>
              <select value={area} onChange={e => setArea(e.target.value as GuideAreaId)} className={sel}>
                {GUIDE_AREAS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select></div>
            <div><label className="label-tech">2 · What material is it?</label>
              <select value={material} onChange={e => setMaterial(e.target.value as IdentifyMaterial)} className={sel}>
                <option value="aluminium">Aluminium sheet</option><option value="stone-coated">Stone-coated tiles</option>
                <option value="shingle">Shingle (flat tile / asphalt)</option><option value="standing-seam">Standing seam / concealed pans</option>
                <option value="concrete-flat">Concrete / flat deck</option><option value="traditional">Heavy traditional tiles</option>
                <option value="not-sure">Not sure</option>
              </select></div>
            <div><label className="label-tech">3 · What is the problem?</label>
              <select value={problem} onChange={e => setProblem(e.target.value as IdentifyProblem)} className={sel}>
                <option value="forgot-pattern">I forgot the pattern / standard</option><option value="leak">It leaks</option>
                <option value="damaged">Damaged or bent</option><option value="fixings-loose">Fixings loose / lifting</option>
                <option value="checking">Just checking the standard</option>
              </select></div>
          </div>
          <div className="border border-primary/50 p-4 mt-5">
            <p className="font-tech text-sm">{result.reason}</p>
            <Button className="rounded-none font-display uppercase h-10 mt-3" onClick={openResult}>Open the matching guide <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- the page ----------
export default function ProGuide() {
  const [params, setParams] = useSearchParams();
  const [trade, setTrade] = useState<GuideTrade>("Roofing");
  const [view, setView] = useState<View | null>(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("pattern")) return { kind: "pattern", id: p.get("pattern")! };
    if (p.get("detail")) return { kind: "detail", id: p.get("detail")! };
    if (p.get("card")) return { kind: "card", id: p.get("card")! };
    return null;
  });
  const [area, setArea] = useState<GuideAreaId>("roof-surface");
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<string>("All");
  const [community, setCommunity] = useState<KnowledgeEntry[]>([]);
  useEffect(() => { void listKnowledgeAsync().then(setCommunity); }, []);
  useEffect(() => {
    const p = params.get("pattern"); const d = params.get("detail"); const c = params.get("card");
    if (p) setView({ kind: "pattern", id: p }); else if (d) setView({ kind: "detail", id: d }); else if (c) { setView({ kind: "card", id: c }); const card = tradeCardById(c); if (card) setTrade(card.trade); }
  }, [params]); // eslint-disable-line
  const openView = (v: View) => { setView(v); window.scrollTo({ top: 0 }); };
  const back = () => { setView(null); setParams({}, { replace: true }); };

  const seeds = useMemo(() => [
    ...ROOF_PATTERNS.map(p => ({ id: p.id, kind: "pattern", trade: "Roofing", title: p.name })),
    ...ROOF_DETAILS.map(d => ({ id: d.id, kind: "detail", trade: "Roofing", title: d.name })),
    ...TRADE_CARDS.map(c => ({ id: c.id, kind: c.kind, trade: c.trade as string, title: c.name })),
  ], []);
  const merged = useMemo(() => mergeLibrary(seeds, community, getSeedConfirmations()), [seeds, community]);
  const fieldForTrade = merged.filter(m => m.trade === trade);
  const openMerged = (m: MergedEntry) => {
    if (m.source !== "seed" && m.entry) return openView({ kind: "community", id: m.id });
    if (patternById(m.id)) return openView({ kind: "pattern", id: m.id });
    if (detailById(m.id)) return openView({ kind: "detail", id: m.id });
    if (tradeCardById(m.id)) return openView({ kind: "card", id: m.id });
  };

  const browsePatterns = ROOF_PATTERNS.filter(p => (family === "All" || p.family === family) && (!query || `${p.name} ${p.family} ${p.bestFor}`.toLowerCase().includes(query.toLowerCase())));
  const tradeCards = trade === "Roofing" ? [] : cardsForTrade(trade);

  return (
    <div>
      <PageHead kicker="Pro Guide — Pattern Intelligence" title="Forgot the pattern? Ask the guide."
        lead="The field companion for every trade: pick what you are working on, snap or record it, and get the pattern, the standard measurements, step-by-step installation, fixes, a parametric sketch and a voice walk-through. A library that grows with the trade — pros teach it, Oketex staff approve every lesson before it publishes." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        {view?.kind === "pattern" && patternById(view.id) && <PatternView pattern={patternById(view.id)!} community={community} onBack={back} />}
        {view?.kind === "detail" && detailById(view.id) && <DetailView detail={detailById(view.id)!} community={community} onBack={back} />}
        {view?.kind === "card" && tradeCardById(view.id) && <CardView card={tradeCardById(view.id)!} community={community} onBack={back} />}
        {view?.kind === "community" && (() => { const e = community.find(x => x.id === view.id); return e ? <CommunityView entry={e} onBack={back} /> : <p className="font-tech text-sm">That entry is no longer published.</p>; })()}
        {view && ((view.kind === "pattern" && !patternById(view.id)) || (view.kind === "detail" && !detailById(view.id)) || (view.kind === "card" && !tradeCardById(view.id))) && (
          <p className="font-tech text-sm">That guide card is not in the library. <button onClick={back} className="text-primary underline cursor-pointer">Back to the guide</button></p>
        )}

        {!view && (
          <div className="space-y-12">
            {/* trade picker */}
            <section>
              <p className="label-tech mb-3"><Hammer className="h-3.5 w-3.5 inline mr-2" /> Pick your trade</p>
              <div className="flex flex-wrap gap-2">
                {GUIDE_TRADES.map(t => (
                  <button key={t} onClick={() => setTrade(t)} className={`font-display uppercase text-sm px-4 py-2.5 border cursor-pointer ${trade === t ? "bg-primary text-primary-foreground border-primary" : "hairline hover:border-primary"}`}>{t}</button>
                ))}
              </div>
            </section>

            {trade === "Roofing" && (<>
              {/* (a) what are you working on */}
              <section>
                <h3 className="font-display font-bold uppercase text-2xl mb-1">What are you working on?</h3>
                <p className="text-sm text-muted-foreground mb-4">Pick the area — get its standard detail, or browse the full pattern library below.</p>
                <div className="flex flex-wrap gap-2">
                  {GUIDE_AREAS.map(a => (
                    <button key={a.id} onClick={() => setArea(a.id)} className={`font-tech text-xs uppercase tracking-widest px-3.5 py-2 border cursor-pointer ${area === a.id ? "bg-primary text-primary-foreground border-primary" : "hairline hover:border-primary"}`}>{a.label}</button>
                  ))}
                </div>
                <div className="mt-5">
                  {area === "roof-surface" && (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border border hairline">
                      {ROOF_PATTERNS.slice(0, 9).map(p => <PatternCard key={p.id} p={p} onOpen={() => openView({ kind: "pattern", id: p.id })} />)}
                    </div>
                  )}
                  {area !== "roof-surface" && detailById(area) && (
                    <button onClick={() => openView({ kind: "detail", id: area })} className="block w-full text-left border hairline bg-card p-6 hover:border-primary cursor-pointer">
                      <p className="font-display font-bold uppercase text-xl">{detailById(area)!.name}</p>
                      <p className="font-tech text-sm text-muted-foreground mt-2">{detailById(area)!.keySpecs[0]} · {detailById(area)!.keySpecs[1] || ""}</p>
                      <p className="font-tech text-xs text-primary mt-3 inline-flex items-center gap-2">Open the detail <ArrowRight className="h-3.5 w-3.5" /></p>
                    </button>
                  )}
                </div>
              </section>

              {/* (c) snap intake */}
              <SnapIntake onOpen={openView} />

              {/* (b) browse all patterns */}
              <section>
                <h3 className="font-display font-bold uppercase text-2xl mb-4"><BookOpen className="h-5 w-5 inline mr-2 text-primary" /> Browse all patterns</h3>
                <div className="flex flex-wrap gap-3 mb-5">
                  <div className="relative flex-1 min-w-56">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search patterns — e.g. low pitch, warehouse, quiet…" className="field-tech font-tech pl-10" />
                  </div>
                  <select value={family} onChange={e => setFamily(e.target.value)} className="field-tech font-tech bg-background w-auto">
                    <option>All</option>{PATTERN_FAMILIES.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border border hairline">
                  {browsePatterns.map(p => <PatternCard key={p.id} p={p} onOpen={() => openView({ kind: "pattern", id: p.id })} />)}
                  {!browsePatterns.length && <p className="bg-background p-6 font-tech text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">No pattern matches that search.</p>}
                </div>
              </section>
            </>)}

            {trade !== "Roofing" && (
              <section>
                <h3 className="font-display font-bold uppercase text-2xl mb-1">{trade} — patterns &amp; details</h3>
                <p className="text-sm text-muted-foreground mb-4">Field standards in the same shape as the roofing library: where it is used, key specs, steps, fixes, tools and materials.{trade === "Interior & Cabinetry" ? " This trade carries the cabinet elevation sketch below." : " Sketches are roofing-only in this pass (plus the cabinetry elevation)."}</p>
                {trade === "Interior & Cabinetry" && <div className="mb-6"><CabinetSketchPanel /></div>}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border border hairline">
                  {tradeCards.map(c => (
                    <button key={c.id} onClick={() => openView({ kind: "card", id: c.id })} className="bg-background p-5 text-left hover:bg-card cursor-pointer">
                      <p className="font-tech text-[10px] uppercase tracking-widest text-primary">{c.kind}</p>
                      <p className="font-display font-bold uppercase text-lg mt-1">{c.name}</p>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{c.whereUsed}</p>
                      <p className="font-tech text-xs text-primary mt-3 inline-flex items-center gap-2">Open the card <ArrowRight className="h-3.5 w-3.5" /></p>
                    </button>
                  ))}
                </div>
                <p className="font-tech text-[11px] text-muted-foreground mt-5 border hairline px-3 py-2">Snap-guided identification covers roofing in this pass. For a problem in this trade, <Link to="/snap-send" className="text-primary underline">Snap &amp; Send it</Link> — Oketex assesses it and channels a pro.</p>
              </section>
            )}

            {/* living library */}
            <section>
              <h3 className="font-display font-bold uppercase text-2xl mb-1"><Sparkles className="h-5 w-5 inline mr-2 text-primary" /> The living library — {trade}</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-3xl">Every card here is ranked by field confirmations from working pros. Community lessons are badged <b>From the field</b> and were approved by Oketex staff before publishing — nothing auto-publishes. Pros teach the system from <Link to="/partner-status" className="text-primary underline">Partner Status</Link>.</p>
              <div className="border hairline">
                {fieldForTrade.slice(0, 12).map((m, i) => (
                  <button key={m.id} onClick={() => openMerged(m)} className={`w-full px-4 py-3 flex flex-wrap gap-3 items-center justify-between text-left hover:bg-card cursor-pointer ${i > 0 ? "border-t hairline" : ""}`}>
                    <span className="font-tech text-sm">
                      <span className="text-primary">{m.title}</span>
                      {m.source !== "seed" && <span className="ml-2 font-tech text-[10px] uppercase tracking-widest border border-primary/60 text-primary px-2 py-0.5">From the field — {m.contributorName}</span>}
                      <span className="text-muted-foreground"> · {m.kind}</span>
                    </span>
                    {m.confirmations >= 1
                      ? <span className="font-tech text-xs text-emerald-400">✓ Verified in the field by {m.confirmations} pro{m.confirmations === 1 ? "" : "s"}</span>
                      : <span className="font-tech text-xs text-muted-foreground">Not yet field-confirmed</span>}
                  </button>
                ))}
                {!fieldForTrade.length && <p className="px-4 py-4 font-tech text-sm text-muted-foreground">No cards for this trade yet — the library grows as pros teach it.</p>}
              </div>
              <p className="font-tech text-[11px] text-muted-foreground mt-3 flex items-center gap-2"><Mic className="h-3.5 w-3.5" /> Every card has a voice walk-through. Today it is your device's voice — the founder's recorded Legacy Voice will take over when the recordings arrive.</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function PatternCard({ p, onOpen }: { p: RoofPattern; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="bg-background p-5 text-left hover:bg-card cursor-pointer">
      <p className="font-tech text-[10px] uppercase tracking-widest text-primary">{p.family}</p>
      <p className="font-display font-bold uppercase text-lg mt-1">{p.name}</p>
      <p className="font-tech text-xs text-muted-foreground mt-1">Pitch {p.pitchRangeDeg[0]}°–{p.pitchRangeDeg[1]}° · {overlapSummary(p)}</p>
      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{p.bestFor}</p>
      <p className="font-tech text-xs text-primary mt-3 inline-flex items-center gap-2">Open the pattern <ArrowRight className="h-3.5 w-3.5" /></p>
    </button>
  );
}
