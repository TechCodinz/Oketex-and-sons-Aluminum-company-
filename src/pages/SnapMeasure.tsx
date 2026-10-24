import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Camera, Undo2, Trash2, ArrowRight, Video, Square, Circle, Download, Frame, Grid3x3, Compass, FolderPlus, X } from "lucide-react";
import { PageHead } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getProProjects, saveProProjects, uid } from "@/lib/proStorage";
import PlanGate, { PlanChip } from "@/components/PlanGate";
import AiAssistPanel from "@/components/AiAssistPanel";

type Pt = { x: number; y: number };
type Line = { a: Pt; b: Pt; label: string; metres: number };
/** The one calibration/measurement formula set shared by photo and video-frame modes:
 *  pxPerM = reference pixel distance / known metres; measured metres = pixel distance / pxPerM. */
const distPt = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const PRESETS = [{ label: "Standard door height 2.1m", m: 2.1 }, { label: "Door width 0.9m", m: 0.9 }, { label: "9-inch block course 0.225m", m: 0.225 }, { label: "Custom", m: 0 }];
const LIVE_PRESETS = [{ label: "Standard door 2.1m", m: 2.1 }, { label: "Block length 450mm", m: 0.45 }, { label: "Floor tile 600mm", m: 0.6 }, { label: "Floor tile 300mm", m: 0.3 }, { label: "Custom", m: 0 }];
const MEASURE_LABELS = ["Roof Width", "Slope Length", "Wall Height", "Window", "Door", "Eaves Length"];

/* ============================ PHOTO MODE (original flow) ============================ */
function PhotoMeasure() {
  const navigate = useNavigate();
  const [img, setImg] = useState<string | null>(null);
  const [preset, setPreset] = useState(0); const [custom, setCustom] = useState("1");
  const [pxPerM, setPxPerM] = useState<number | null>(null);
  const [draft, setDraft] = useState<Pt | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [label, setLabel] = useState("Roof Width");
  const [mode, setMode] = useState<"calibrate" | "measure">("calibrate");
  const svgRef = useRef<SVGSVGElement>(null);
  const knownM = () => (preset === 3 ? (parseFloat(custom) || 1) : PRESETS[preset].m);
  const getPt = (e: React.PointerEvent) => { const r = svgRef.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 1000, y: ((e.clientY - r.top) / r.height) * 700 }; };
  const onTap = (e: React.PointerEvent) => {
    if (!img) return; const p = getPt(e);
    if (!draft) { setDraft(p); return; }
    const d = distPt(draft, p);
    if (mode === "calibrate") { const ppm = d / knownM(); setPxPerM(ppm); toast.success(`Calibrated: ${ppm.toFixed(1)} px per metre`); setMode("measure"); }
    else { if (!pxPerM) return toast.error("Calibrate first"); setLines(prev => [...prev, { a: draft, b: p, label, metres: d / pxPerM }]); }
    setDraft(null);
  };
  const w = lines.find(l => l.label === "Roof Width")?.metres; const s = lines.find(l => l.label === "Slope Length")?.metres;
  const areaEst = w && s ? w * s * 2 : null;
  const sendToCalc = () => { const L = w || undefined; const W = s ? s * 2 : undefined; localStorage.setItem("oketex-prefill", JSON.stringify({ length: L || 10, width: W || 8 })); navigate(`/quote?length=${L || 10}&width=${W || 8}`); };
  return (<div className="grid lg:grid-cols-[1fr_360px] gap-10">
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <label className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-display font-semibold uppercase px-5 py-3 cursor-pointer"><Camera className="h-4 w-4" /> Upload / Take photo<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setImg(URL.createObjectURL(f)); }} /></label>
        <Button variant="outline" className="rounded-none font-display uppercase" onClick={() => { setLines(lines.slice(0, -1)); }}><Undo2 className="h-4 w-4 mr-2" /> Undo</Button>
        <Button variant="outline" className="rounded-none font-display uppercase" onClick={() => { setLines([]); setPxPerM(null); setMode("calibrate"); setDraft(null); }}><Trash2 className="h-4 w-4 mr-2" /> Clear</Button>
      </div>
      <ol className="font-tech text-xs text-muted-foreground space-y-1 mb-4 list-decimal ml-4"><li>Upload a straight-on photo of the building.</li><li>CALIBRATE: pick a known size, tap both ends of that object in the photo.</li><li>MEASURE: choose a label, tap both ends of the wall / roof edge.</li><li>Send dimensions to the Pro Calculator.</li></ol>
      <div className="border hairline bg-card relative overflow-hidden touch-none">
        {img ? (<svg ref={svgRef} viewBox="0 0 1000 700" className="w-full block cursor-crosshair" onPointerDown={onTap} role="img" aria-label="Measurement canvas">
          <image href={img} x="0" y="0" width="1000" height="700" preserveAspectRatio="xMidYMid slice" />
          {lines.map((l, i) => (<g key={i}><line x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke="#FF6026" strokeWidth="4" /><circle cx={l.a.x} cy={l.a.y} r="7" fill="#FF6026" /><circle cx={l.b.x} cy={l.b.y} r="7" fill="#FF6026" /><text x={(l.a.x + l.b.x) / 2} y={(l.a.y + l.b.y) / 2 - 10} fill="#fff" stroke="#000" strokeWidth="0.6" fontSize="22" textAnchor="middle" fontFamily="monospace">{l.label}: {l.metres.toFixed(2)}m</text></g>))}
          {draft && <circle cx={draft.x} cy={draft.y} r="8" fill="#FFD166" stroke="#000" />}
        </svg>) : (<div className="py-24 text-center font-tech text-sm text-muted-foreground uppercase tracking-widest px-6">No photo yet — upload or take one to start measuring</div>)}
      </div>
      {draft && <p className="font-tech text-xs text-primary mt-2">First point set — tap the other end.</p>}
    </div>
    <aside className="space-y-6">
      <div className="border hairline bg-card p-5"><p className="label-tech mb-3">Step 1 — Calibration reference</p><select value={preset} onChange={e => setPreset(Number(e.target.value))} className="field-tech font-tech bg-background w-full">{PRESETS.map((p, i) => (<option key={p.label} value={i}>{p.label}</option>))}</select>{preset === 3 && <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Metres (e.g. 3.6)" className="field-tech font-tech mt-2" />}<p className="font-tech text-xs mt-3">{pxPerM ? `Calibrated: ${pxPerM.toFixed(1)} px / metre` : "Not calibrated yet — draw over the reference object."}</p><Button variant={mode === "calibrate" ? "default" : "outline"} className="rounded-none font-display uppercase mt-3 w-full" onClick={() => setMode("calibrate")}>{mode === "calibrate" ? "Tap two ends of reference…" : "Re-calibrate"}</Button></div>
      <div className="border hairline bg-card p-5"><p className="label-tech mb-3">Step 2 — Measure</p><div className="flex flex-wrap gap-2">{MEASURE_LABELS.map(l => (<button key={l} onClick={() => { setLabel(l); setMode("measure"); }} className={`px-3 py-2 font-tech text-xs border hairline cursor-pointer ${label === l && mode === "measure" ? "bg-primary text-primary-foreground" : "hover:text-primary"}`}>{l}</button>))}</div>
        {lines.length === 0 ? <p className="font-tech text-xs text-muted-foreground mt-4">No measurements yet.</p> : <ul className="mt-4 space-y-2">{lines.map((l, i) => (<li key={i} className="flex justify-between font-tech text-sm border-b hairline pb-2"><span>{l.label}</span><span className="text-primary">{l.metres.toFixed(2)} m</span></li>))}</ul>}
        {areaEst && <p className="font-tech text-xs mt-4">Facade / 2-slope roof estimate from Width × Slope × 2 ≈ <span className="text-primary">{areaEst.toFixed(1)} m²</span> (rough — survey confirms).</p>}
        <Button className="rounded-none font-display uppercase w-full mt-5 h-12" onClick={sendToCalc}>Send to Pro Calculator <ArrowRight className="h-4 w-4 ml-2" /></Button><p className="font-tech text-[11px] text-muted-foreground mt-2">Sends Roof Width as length. Adjust width/pitch in the calculator — slope length depends on pitch.</p></div>
    </aside>
  </div>);
}

/* ============================ LIVE VIDEO MODE (Deliverable E, Pro) ============================ */
type CamState = "idle" | "starting" | "live" | "denied";
function LiveMeasure() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const [cam, setCam] = useState<CamState>("idle");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [gamma, setGamma] = useState<number | null>(null);
  const [levelOn, setLevelOn] = useState(false);
  const [preset, setPreset] = useState(0); const [custom, setCustom] = useState("1");
  const [pxPerM, setPxPerM] = useState<number | null>(null);
  const [draft, setDraft] = useState<Pt | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [label, setLabel] = useState("Roof Width");
  const [customLabel, setCustomLabel] = useState("");
  const [calibrating, setCalibrating] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const [projects, setProjects] = useState(() => getProProjects());
  const [projId, setProjId] = useState<string>(() => getProProjects()[0]?.id ?? "");

  const insecure = typeof window !== "undefined" && !window.isSecureContext;
  const unsupported = typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia;

  const stopStream = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  useEffect(() => () => { stopStream(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (!recording) return; const iv = window.setInterval(() => setElapsed(Date.now() - startRef.current), 250); return () => window.clearInterval(iv); }, [recording]);
  useEffect(() => {
    if (!levelOn) return;
    const h = (e: DeviceOrientationEvent) => { if (e.gamma !== null) setGamma(e.gamma); };
    window.addEventListener("deviceorientation", h);
    return () => window.removeEventListener("deviceorientation", h);
  }, [levelOn]);

  const startCamera = async () => {
    if (insecure || unsupported) return;
    setCam("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => undefined); }
      setCam("live");
    } catch { setCam("denied"); }
  };
  const stopCamera = () => { if (recording) stopRecording(); stopStream(); setCam("idle"); };

  const pickMime = (): string | undefined => {
    const cands = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", ""];
    for (const c of cands) { if (!c) return undefined; try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c; } catch { /* next */ } }
    return undefined;
  };
  const startRecording = () => {
    if (!streamRef.current || !("MediaRecorder" in window)) { toast.error("Recording is not supported in this browser — you can still capture frames."); return; }
    chunksRef.current = [];
    const rec = new MediaRecorder(streamRef.current, { mimeType: pickMime() });
    rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => { const blob = new Blob(chunksRef.current, { type: rec.mimeType || "video/webm" }); if (clipUrl) URL.revokeObjectURL(clipUrl); setClipUrl(URL.createObjectURL(blob)); };
    recRef.current = rec; startRef.current = Date.now(); setElapsed(0);
    rec.start(250); setRecording(true);
  };
  const stopRecording = () => { recRef.current?.stop(); setRecording(false); };

  const enableLevel = async () => {
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    if (!DOE) { toast.error("No orientation sensor available on this device/browser."); return; }
    if (typeof DOE.requestPermission === "function") {
      try { const r = await DOE.requestPermission(); if (r !== "granted") { toast.error("Motion permission was not granted — the level line stays off."); return; } } catch { toast.error("Could not enable the level sensor."); return; }
    }
    setLevelOn(true); toast.success("Level on — the orange line stays truly horizontal");
  };

  const useFrame = () => {
    const src = (clipUrl && previewRef.current) ? previewRef.current : videoRef.current;
    if (!src || !src.videoWidth) { toast.error("No video frame available yet — start the camera or record a clip first."); return; }
    const c = document.createElement("canvas"); c.width = src.videoWidth; c.height = src.videoHeight;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.drawImage(src, 0, 0);
    setFrameUrl(c.toDataURL("image/png"));
    setPxPerM(null); setLines([]); setDraft(null); setCalibrating(true);
    toast.success("Frame captured — calibrate on it, then measure");
  };

  const knownM = () => (preset === LIVE_PRESETS.length - 1 ? (parseFloat(custom) || 1) : LIVE_PRESETS[preset].m);
  const getPt = (e: React.PointerEvent) => { const r = svgRef.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 1000, y: ((e.clientY - r.top) / r.height) * 700 }; };
  const onTap = (e: React.PointerEvent) => {
    if (!frameUrl) return; const p = getPt(e);
    if (!draft) { setDraft(p); return; }
    const d = distPt(draft, p);
    if (calibrating) { const ppm = d / knownM(); setPxPerM(ppm); toast.success(`Calibrated: ${ppm.toFixed(1)} px per metre`); setCalibrating(false); }
    else { if (!pxPerM) return toast.error("Calibrate first"); setLines(prev => [...prev, { a: draft, b: p, label: customLabel.trim() || label, metres: d / pxPerM }]); }
    setDraft(null);
  };
  const sendToCalc = () => {
    const sorted = [...lines].sort((a, b) => Math.abs(b.b.x - b.a.x) - Math.abs(a.b.x - a.a.x));
    const L = sorted[0]?.metres, W = sorted[1]?.metres;
    localStorage.setItem("oketex-prefill", JSON.stringify({ length: L || 10, width: W || 8 }));
    navigate(`/quote?length=${L ? L.toFixed(2) : 10}&width=${W ? W.toFixed(2) : 8}`);
  };
  const addToWorkspace = () => {
    const proj = projects.find(p => p.id === projId);
    if (!proj || !lines.length) return;
    const rows = lines.map(l => ({ id: uid(), item: l.label, location: "Video snap measure", l: Math.round(l.metres * 100) / 100, w: 0, h: 0, qty: 1, unit: "m", note: "Measured on a video frame (assisted estimate — verify with a tape)" }));
    const next = projects.map(p => (p.id === proj.id ? { ...p, measures: [...p.measures, ...rows] } : p));
    saveProProjects(next); setProjects(next);
    toast.success(`${rows.length} measurement${rows.length === 1 ? "" : "s"} added to "${proj.name}"`);
  };
  const mmss = (ms: number) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
  const levelDeg = gamma === null ? null : Math.max(-45, Math.min(45, gamma));

  return (<div>
    <div className="border border-amber-500/50 bg-amber-500/10 p-4 mb-6 flex gap-3"><Video className="h-5 w-5 text-amber-500 shrink-0" />
      <p className="text-sm"><b>Live camera + frame measurement.</b> Video measurement is assisted estimation — perspective affects accuracy. Verify critical dimensions with a physical tape before ordering materials. This is not AR or LiDAR (web apps cannot access those) — you calibrate against a known size, exactly like photo mode. Clips and frames stay in this tab&apos;s memory only and are never uploaded or saved.</p></div>
    <div className="grid lg:grid-cols-[1fr_360px] gap-10">
      <div>
        <div className="relative border hairline bg-black overflow-hidden">
          <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-video object-cover" />
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/25" /><div className="absolute top-1/2 left-0 right-0 h-px bg-white/25" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 border-2 border-primary/80 rounded-full" />
            {showGrid && <><div className="absolute top-0 bottom-0 w-px bg-white/15" style={{ left: "33.33%" }} /><div className="absolute top-0 bottom-0 w-px bg-white/15" style={{ left: "66.66%" }} /><div className="absolute left-0 right-0 h-px bg-white/15" style={{ top: "33.33%" }} /><div className="absolute left-0 right-0 h-px bg-white/15" style={{ top: "66.66%" }} /></>}
            {levelOn && levelDeg !== null && (<div className="absolute left-[8%] right-[8%] top-1/2"><div className="h-0.5 bg-primary shadow" style={{ transform: `rotate(${-levelDeg}deg)` }} /><p className="font-tech text-[10px] text-primary mt-1 text-center">{Math.abs(gamma ?? 0) < 2 ? "LEVEL ✓" : `${Math.abs(gamma ?? 0).toFixed(0)}° off level`}</p></div>)}
            {recording && <p className="absolute top-3 left-3 font-tech text-xs bg-black/70 text-red-400 px-2.5 py-1.5 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> REC {mmss(elapsed)}</p>}
            {cam !== "live" && <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-6"><p className="font-tech text-xs text-white/80 uppercase tracking-widest text-center">{cam === "starting" ? "Starting camera…" : cam === "denied" ? "Camera permission was denied" : "Camera is off"}</p></div>}
          </div>
        </div>
        {cam === "denied" && <div className="border hairline bg-card p-4 mt-3 font-tech text-xs space-y-1.5"><p className="text-primary font-semibold uppercase tracking-widest">Camera blocked</p><p>Allow camera access for this site in your browser settings (tap the lock/site icon in the address bar → Permissions → Camera → Allow), then press Start Camera again. Or switch back to Photo mode above — it needs no permission.</p></div>}
        {insecure && <div className="border border-amber-500/50 p-4 mt-3 font-tech text-xs">This page is not in a secure context (HTTPS), so the browser will not allow camera access. Open the live site address (https://…) to use Live Video Measure, or use Photo mode.</div>}
        {unsupported && !insecure && <div className="border border-amber-500/50 p-4 mt-3 font-tech text-xs">This browser does not expose camera access to web pages. Use Photo mode, or open the site in Chrome/Safari on your phone.</div>}
        <div className="flex flex-wrap gap-3 mt-4">
          {cam !== "live" ? <Button className="rounded-none font-display uppercase" onClick={() => void startCamera()} disabled={insecure || unsupported}><Video className="h-4 w-4 mr-2" /> Start camera</Button>
            : <Button variant="outline" className="rounded-none font-display uppercase" onClick={stopCamera}><Square className="h-4 w-4 mr-2" /> Stop camera</Button>}
          {!recording ? <Button variant="outline" className="rounded-none font-display uppercase" onClick={startRecording} disabled={cam !== "live"}><Circle className="h-4 w-4 mr-2 text-red-500" /> Record walkthrough</Button>
            : <Button variant="outline" className="rounded-none font-display uppercase" onClick={stopRecording}><Square className="h-4 w-4 mr-2" /> Stop recording ({mmss(elapsed)})</Button>}
          <Button variant="outline" className="rounded-none font-display uppercase" onClick={useFrame}><Frame className="h-4 w-4 mr-2" /> Use this frame</Button>
          <Button variant={showGrid ? "default" : "outline"} className="rounded-none font-display uppercase" onClick={() => setShowGrid(g => !g)}><Grid3x3 className="h-4 w-4 mr-2" /> Thirds grid</Button>
          {!levelOn ? <Button variant="outline" className="rounded-none font-display uppercase" onClick={() => void enableLevel()}><Compass className="h-4 w-4 mr-2" /> Enable level</Button>
            : <Button variant="outline" className="rounded-none font-display uppercase" onClick={() => { setLevelOn(false); setGamma(null); }}><Compass className="h-4 w-4 mr-2" /> Level off</Button>}
          {clipUrl && <Button variant="outline" className="rounded-none font-display uppercase" asChild><a href={clipUrl} download="oketex-walkthrough.webm"><Download className="h-4 w-4 mr-2" /> Download clip</a></Button>}
          {frameUrl && <Button variant="outline" className="rounded-none font-display uppercase" asChild><a href={frameUrl} download="oketex-frame.png"><Download className="h-4 w-4 mr-2" /> Download frame</a></Button>}
        </div>
        {clipUrl && (<div className="mt-5"><p className="label-tech mb-2">Recorded walkthrough — scrub to the clearest view, then “Use this frame”</p><video ref={previewRef} src={clipUrl} controls playsInline className="w-full border hairline bg-black aspect-video" /></div>)}
        <div className="mt-6">
          <p className="label-tech mb-2">Measure on a captured frame</p>
          <div className="border hairline bg-card relative overflow-hidden touch-none">
            {frameUrl ? (<svg ref={svgRef} viewBox="0 0 1000 700" className="w-full block cursor-crosshair" onPointerDown={onTap} role="img" aria-label="Video frame measurement canvas">
              <image href={frameUrl} x="0" y="0" width="1000" height="700" preserveAspectRatio="xMidYMid slice" />
              {lines.map((l, i) => (<g key={i}><line x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke="#FF6026" strokeWidth="4" /><circle cx={l.a.x} cy={l.a.y} r="7" fill="#FF6026" /><circle cx={l.b.x} cy={l.b.y} r="7" fill="#FF6026" /><text x={(l.a.x + l.b.x) / 2} y={(l.a.y + l.b.y) / 2 - 10} fill="#fff" stroke="#000" strokeWidth="0.6" fontSize="22" textAnchor="middle" fontFamily="monospace">{l.label}: {l.metres.toFixed(2)}m</text></g>))}
              {draft && <circle cx={draft.x} cy={draft.y} r="8" fill="#FFD166" stroke="#000" />}
            </svg>) : (<div className="py-16 text-center font-tech text-sm text-muted-foreground uppercase tracking-widest px-6">No frame captured yet — start the camera (or record a clip) and tap “Use this frame”</div>)}
          </div>
          {draft && <p className="font-tech text-xs text-primary mt-2">First point set — tap the other end.</p>}
        </div>
      </div>
      <aside className="space-y-6">
        <div className="border hairline bg-card p-5"><p className="label-tech mb-3">Step 1 — Calibration reference (on the frame)</p>
          <select value={preset} onChange={e => setPreset(Number(e.target.value))} className="field-tech font-tech bg-background w-full">{LIVE_PRESETS.map((p, i) => (<option key={p.label} value={i}>{p.label}</option>))}</select>
          {preset === LIVE_PRESETS.length - 1 && <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Metres (e.g. 3.6)" className="field-tech font-tech mt-2" />}
          <p className="font-tech text-xs mt-3">{pxPerM ? `Calibrated: ${pxPerM.toFixed(1)} px / metre` : "Not calibrated — tap both ends of the reference object on the frame."}</p>
          <Button variant={calibrating ? "default" : "outline"} className="rounded-none font-display uppercase mt-3 w-full" onClick={() => setCalibrating(true)}>{calibrating ? "Tap two ends of reference…" : "Re-calibrate"}</Button></div>
        <div className="border hairline bg-card p-5"><p className="label-tech mb-3">Step 2 — Measure (tap point pairs on the frame)</p>
          <div className="flex flex-wrap gap-2">{MEASURE_LABELS.map(l => (<button key={l} onClick={() => { setLabel(l); setCustomLabel(""); setCalibrating(false); }} className={`px-3 py-2 font-tech text-xs border hairline cursor-pointer ${label === l && !customLabel && !calibrating ? "bg-primary text-primary-foreground" : "hover:text-primary"}`}>{l}</button>))}</div>
          <input value={customLabel} onChange={e => { setCustomLabel(e.target.value); setCalibrating(false); }} placeholder="…or name it yourself — e.g. Front slope length" className="field-tech font-tech mt-3" aria-label="Custom measurement name" />
          {lines.length === 0 ? <p className="font-tech text-xs text-muted-foreground mt-4">No measurements yet.</p> : <ul className="mt-4 space-y-2">{lines.map((l, i) => (<li key={i} className="flex justify-between items-center font-tech text-sm border-b hairline pb-2"><span>{l.label}</span><span className="flex items-center gap-2"><span className="text-primary">{l.metres.toFixed(2)} m</span><button onClick={() => setLines(lines.filter((_, ix) => ix !== i))} className="text-muted-foreground hover:text-destructive cursor-pointer" aria-label={`Delete ${l.label}`}><X className="h-3.5 w-3.5" /></button></span></li>))}</ul>}
          <Button className="rounded-none font-display uppercase w-full mt-5 h-12" onClick={sendToCalc} disabled={!lines.length}>Send to Pro Calculator <ArrowRight className="h-4 w-4 ml-2" /></Button>
          <p className="font-tech text-[11px] text-muted-foreground mt-2">Uses your two largest horizontal measurements as length × width. Adjust pitch in the calculator.</p>
          <div className="border-t hairline mt-5 pt-4"><p className="label-tech mb-2">Add measurements to a Workspace project</p>
            <div className="flex gap-2"><select value={projId} onChange={e => setProjId(e.target.value)} className="field-tech font-tech bg-background flex-1">{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <Button variant="outline" className="rounded-none font-display uppercase shrink-0" onClick={addToWorkspace} disabled={!lines.length || !projId}><FolderPlus className="h-4 w-4 mr-1" /> Add</Button></div>
            <p className="font-tech text-[11px] text-muted-foreground mt-2">Appends each measurement as a row in the project&apos;s measurement sheet, flagged as an assisted estimate.</p></div>
        </div>
      </aside>
    </div>
  </div>);
}

/* ============================ PAGE ============================ */
export default function SnapMeasure() {
  const [mode, setMode] = useState<"photo" | "video">("photo");
  return (<div><PageHead kicker="Snap-Measure — Photo & Live Video Measurement" title="Measure from a photo — or live video" lead="Honest assisted measurement — not magic AI. You calibrate with something you know, then draw. A free site survey always confirms final measurements." />
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <div className="flex flex-wrap gap-3 items-center justify-between mb-8">
        <div className="flex gap-px bg-border border hairline w-fit">
          <button onClick={() => setMode("photo")} className={`px-5 py-3 font-display font-semibold uppercase tracking-wider text-sm cursor-pointer inline-flex items-center gap-2 ${mode === "photo" ? "bg-primary text-primary-foreground" : "bg-background hover:text-primary"}`}><Camera className="h-4 w-4" /> Photo</button>
          <button onClick={() => setMode("video")} className={`px-5 py-3 font-display font-semibold uppercase tracking-wider text-sm cursor-pointer inline-flex items-center gap-2 ${mode === "video" ? "bg-primary text-primary-foreground" : "bg-background hover:text-primary"}`}><Video className="h-4 w-4" /> Live Video Measure</button>
        </div>
        <PlanChip />
      </div>
      {mode === "photo" ? <PhotoMeasure /> : (<PlanGate feature="Live Video Measure"><LiveMeasure /></PlanGate>)}
      <div className="mt-10"><AiAssistPanel context="snap-measure" /></div>
    </div></div>);
}
