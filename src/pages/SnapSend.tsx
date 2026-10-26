import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { PageHead } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Video, Square, MapPin, ChevronRight, ChevronLeft, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { businessWaLink, getBusiness } from "@/lib/settings";
import { notify } from "@/lib/notify";
import {
  createSnapRequestAsync, compressImageFile, compressImageDataUrl,
  SNAP_INTENT_LABEL, type SnapIntent, type SnapUrgency,
} from "@/lib/snapRequests";

const INTENTS: { id: SnapIntent; emoji: string; title: string; sub: string }[] = [
  { id: "fix", emoji: "🔧", title: "Fix a problem / leak", sub: "Leaking roof, damage, broken window — show us what is wrong" },
  { id: "build", emoji: "🏠", title: "Build something like this", sub: "Snap what you want built and we price the whole job" },
  { id: "sell", emoji: "🏷️", title: "Sell an item", sub: "Materials or items to sell? Send a photo and your price" },
  { id: "other", emoji: "💬", title: "Something else", sub: "Anything else — snap it, describe it, we reply" },
];
const URGENCIES: SnapUrgency[] = ["Normal", "Urgent", "Emergency"];
const inputCls = "rounded-none bg-background border-white/15 h-12";

export default function SnapSend() {
  const [step, setStep] = useState(1);
  const [intent, setIntent] = useState<SnapIntent>("fix");
  const [photo, setPhoto] = useState<string | null>(null);
  const [videoPoster, setVideoPoster] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [sellItemName, setSellItemName] = useState("");
  const [sellAsking, setSellAsking] = useState("");
  const [sellCondition, setSellCondition] = useState("Used — Good");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [urgency, setUrgency] = useState<SnapUrgency>("Normal");
  const [busy, setBusy] = useState(false);
  const [doneCode, setDoneCode] = useState<string | null>(null);

  // --- short video recording (SnapMeasure MediaRecorder pattern) ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const [camOn, setCamOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const stopStream = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  useEffect(() => () => stopStream(), []);
  useEffect(() => { if (!recording) return; const iv = window.setInterval(() => setElapsed(Date.now() - startRef.current), 250); return () => window.clearInterval(iv); }, [recording]);

  const onPhotoFile = async (f: File | undefined) => {
    if (!f) return;
    try { const dataUrl = await compressImageFile(f); setPhoto(dataUrl); setVideoPoster(null); toast.success("Photo added"); }
    catch (e: any) { toast.error(String(e?.message || e)); }
  };
  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { toast.error("Camera is not available in this browser — upload a photo instead."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => undefined); }
      setCamOn(true);
    } catch { toast.error("Camera permission was not granted — you can upload a photo instead."); }
  };
  const pickMime = (): string | undefined => {
    const cands = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", ""];
    for (const c of cands) { if (!c) return undefined; try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c; } catch { /* next */ } }
    return undefined;
  };
  const grabPoster = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) { toast.error("No video frame yet — start the camera first."); return; }
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    const poster = await compressImageDataUrl(c.toDataURL("image/jpeg", 0.85));
    setVideoPoster(poster); setPhoto(null);
    toast.success("Video frame saved — this frame is what we send with your request");
  };
  const startRecording = () => {
    if (!streamRef.current || !("MediaRecorder" in window)) { toast.error("Recording is not supported in this browser — capture a frame instead."); return; }
    chunksRef.current = [];
    const rec = new MediaRecorder(streamRef.current, { mimeType: pickMime() });
    rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => { void grabPoster(); };
    recRef.current = rec; startRef.current = Date.now(); setElapsed(0);
    rec.start(250); setRecording(true);
  };
  const stopRecording = () => { recRef.current?.stop(); setRecording(false); };
  const stopCamera = () => { if (recording) stopRecording(); stopStream(); setCamOn(false); };

  const useMyLocation = () => {
    if (!navigator.geolocation) { toast.error("Location is not available in this browser — type the address instead."); return; }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoBusy(false); toast.success("Location pinned — the pro gets directions straight to the site"); },
      () => { setGeoBusy(false); toast.error("Location was not shared — no problem, your written address works too."); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const step2Ok = description.trim().length >= 4 && address.trim().length >= 4 && (intent !== "sell" || sellItemName.trim().length >= 2);
  const submit = async () => {
    if (name.trim().length < 2) return toast.error("Please enter your name");
    if (phone.replace(/\D/g, "").length < 10) return toast.error("Enter a valid phone number — we reply on it");
    setBusy(true);
    try {
      const mediaType: "photo" | "video" = videoPoster ? "video" : "photo";
      const req = await createSnapRequestAsync({
        intent, mediaType, photo, videoPoster,
        videoNote: videoPoster ? "The customer recorded a short video on their phone. Only the poster frame is stored here — ask them to share the clip on WhatsApp for the full view." : "",
        description: description.trim(), address: address.trim(), geo,
        customerName: name.trim(), customerPhone: phone.trim(), urgency,
        ...(intent === "sell" ? { sellItemName: sellItemName.trim(), sellAskingNgn: Number(sellAsking) || 0, sellCondition } : {}),
      });
      void notify({ templateKey: "snap_received", audience: "admin", refCode: req.code, vars: { code: req.code, name: req.customerName, phone: req.customerPhone, title: SNAP_INTENT_LABEL[intent] } });
      setDoneCode(req.code);
      window.scrollTo({ top: 0 });
    } finally { setBusy(false); }
  };

  if (doneCode) {
    const waText = `Hello ${getBusiness().name}, I just sent a Snap & Send request (${doneCode}). My name is ${name}. Please review it.`;
    return (<div><PageHead kicker="Snap & Send" title="Sent — we are on it" lead="Your request is with the Oketex team. We review the photo, price the job openly — the items and tools the repair needs, workmanship, transport and dispatch — and you approve the price before anything starts. Then we channel the best available pro in your region to get it done — no surprises." />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <div className="border hairline bg-card p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
          <p className="font-tech text-[11px] uppercase tracking-[0.3em] text-muted-foreground mt-4">Your request code</p>
          <p className="font-display font-bold text-4xl md:text-5xl mt-2">{doneCode}</p>
          <p className="text-muted-foreground mt-4 text-sm">Keep this code. Track the request anytime — see our price breakdown, approve it, and follow the pro's photo updates live.</p>
          <div className="flex flex-wrap gap-3 justify-center mt-8">
            <Link to="/track" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-display font-semibold uppercase px-6 h-12 hover:bg-primary/90">Track it anytime</Link>
            <a href={businessWaLink(waText)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border hairline font-display font-semibold uppercase px-6 h-12 hover:border-primary hover:text-primary">Send a copy on WhatsApp</a>
          </div>
          {videoPoster && <p className="font-tech text-[11px] text-muted-foreground mt-6">You recorded a video: we received its poster frame. Please also send the clip itself on WhatsApp so the team sees the full picture.</p>}
        </div>
      </div></div>);
  }

  return (<div>
    <PageHead kicker="Snap & Send" title="Snap it. Send it. We fix it." lead="Snap or record anything — a leak or damage at home, at the shop or on site, something you want built, or an item you want to sell. Wherever you are, we assess it, list the items and tools the repair needs with prices, and channel the best available pro in your region to get it done — you approve the price first, then follow every step." />
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <div className="flex gap-2 mb-8">{[1, 2, 3].map(n => (<div key={n} className={`flex-1 border px-3 py-2 font-tech text-[11px] uppercase tracking-widest ${step >= n ? "border-primary text-primary" : "hairline text-muted-foreground"}`}>Step {n} — {n === 1 ? "What do you need?" : n === 2 ? "Snap & describe" : "Your details"}</div>))}</div>

      {step === 1 && (<div>
        <div className="grid sm:grid-cols-2 gap-px bg-border border hairline">
          {INTENTS.map(i => (<button key={i.id} onClick={() => setIntent(i.id)} className={`text-left p-6 cursor-pointer ${intent === i.id ? "bg-primary/10 border-2 border-primary" : "bg-background hover:bg-card"}`}>
            <span className="text-4xl">{i.emoji}</span>
            <span className="font-display font-bold uppercase text-xl block mt-3">{i.title}</span>
            <span className="text-sm text-muted-foreground block mt-1">{i.sub}</span>
          </button>))}
        </div>
        <div className="flex justify-end mt-8"><Button className="rounded-none font-display uppercase h-12 px-8" onClick={() => setStep(2)}>Continue <ChevronRight className="h-4 w-4 ml-1" /></Button></div>
      </div>)}

      {step === 2 && (<div className="space-y-8">
        <section>
          <h2 className="font-display font-bold uppercase text-2xl">1 · Show us</h2>
          <p className="text-sm text-muted-foreground mt-1">Take a photo now, upload one, or record a short video (up to ~30 seconds — we receive a frame from it, and you can send the clip on WhatsApp after).</p>
          <div className="flex flex-wrap gap-3 mt-4">
            <label className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-display font-semibold uppercase px-5 py-3.5 cursor-pointer hover:bg-primary/90"><Camera className="h-5 w-5" /> Take photo<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { void onPhotoFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
            <label className="inline-flex items-center gap-2 border hairline font-display font-semibold uppercase px-5 py-3.5 cursor-pointer hover:border-primary hover:text-primary"><Camera className="h-5 w-5" /> Upload photo<input type="file" accept="image/*" className="hidden" onChange={e => { void onPhotoFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
            {!camOn ? <button onClick={() => void startCamera()} className="inline-flex items-center gap-2 border hairline font-display font-semibold uppercase px-5 py-3.5 hover:border-primary hover:text-primary cursor-pointer"><Video className="h-5 w-5" /> Record a short video</button>
              : <button onClick={stopCamera} className="inline-flex items-center gap-2 border hairline font-display font-semibold uppercase px-5 py-3.5 hover:border-destructive hover:text-destructive cursor-pointer"><X className="h-5 w-5" /> Close camera</button>}
          </div>
          {camOn && (<div className="mt-4 border hairline bg-card p-4">
            <video ref={videoRef} playsInline muted className="w-full max-h-80 bg-black object-contain" />
            <div className="flex flex-wrap gap-3 mt-3 items-center">
              {!recording ? <button onClick={startRecording} className="inline-flex items-center gap-2 bg-destructive text-white font-display font-semibold uppercase px-5 py-3 cursor-pointer"><span className="h-2.5 w-2.5 rounded-full bg-white" /> Record</button>
                : <button onClick={stopRecording} className="inline-flex items-center gap-2 border hairline font-display font-semibold uppercase px-5 py-3 cursor-pointer"><Square className="h-4 w-4" /> Stop ({Math.floor(elapsed / 1000)}s)</button>}
              <button onClick={() => void grabPoster()} className="inline-flex items-center gap-2 border hairline font-display font-semibold uppercase px-5 py-3 hover:border-primary hover:text-primary cursor-pointer"><Camera className="h-4 w-4" /> Use this frame</button>
              <span className="font-tech text-[11px] text-muted-foreground">The video stays on your phone — we store one frame from it.</span>
            </div>
          </div>)}
          {(photo || videoPoster) && (<div className="mt-4 relative inline-block border hairline">
            <img src={(photo || videoPoster) as string} alt="Your snap" className="max-h-72 w-auto" />
            {videoPoster && <span className="absolute top-2 left-2 bg-black/70 text-white font-tech text-[10px] uppercase tracking-widest px-2 py-1">Video frame</span>}
            <button onClick={() => { setPhoto(null); setVideoPoster(null); }} className="absolute top-2 right-2 bg-black/70 text-white p-1.5 cursor-pointer" aria-label="Remove photo"><X className="h-4 w-4" /></button>
          </div>)}
        </section>

        <section>
          <h2 className="font-display font-bold uppercase text-2xl">2 · Tell us about it</h2>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={intent === "fix" ? "e.g. The roof leaks over the sitting room whenever it rains hard. Started last month." : intent === "sell" ? "e.g. 40 pieces of 0.45mm longspan offcuts, charcoal colour, still bundled." : "Tell us what you see / what you want, in your own words…"} className="rounded-none bg-background border-white/15 mt-3 min-h-28" />
          {intent === "sell" && (<div className="grid sm:grid-cols-3 gap-3 mt-4">
            <div><label className="font-tech text-[11px] uppercase tracking-widest text-muted-foreground block mb-1.5">Item name</label><Input value={sellItemName} onChange={e => setSellItemName(e.target.value)} placeholder="e.g. Longspan offcuts 0.45mm" className={inputCls} /></div>
            <div><label className="font-tech text-[11px] uppercase tracking-widest text-muted-foreground block mb-1.5">Your asking price (₦)</label><Input type="number" min={0} value={sellAsking} onChange={e => setSellAsking(e.target.value)} placeholder="85000" className={inputCls} /></div>
            <div><label className="font-tech text-[11px] uppercase tracking-widest text-muted-foreground block mb-1.5">Condition</label><select value={sellCondition} onChange={e => setSellCondition(e.target.value)} className="w-full bg-background border border-white/15 h-12 px-3 font-tech text-sm cursor-pointer">{["New", "Used — Good", "Used — Fair"].map(c => <option key={c}>{c}</option>)}</select></div>
          </div>)}
        </section>

        <section>
          <h2 className="font-display font-bold uppercase text-2xl">3 · Where is the site?</h2>
          <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Site address — street, area, town (e.g. 12 Adeyemi Street, Ibafo, Ogun State)" className={`${inputCls} mt-3`} />
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <button onClick={useMyLocation} disabled={geoBusy} className="inline-flex items-center gap-2 border hairline font-display font-semibold uppercase px-5 py-3 hover:border-primary hover:text-primary cursor-pointer disabled:opacity-50"><MapPin className="h-4 w-4" /> {geoBusy ? "Getting location…" : "Use my location"}</button>
            {geo ? <span className="font-tech text-xs text-emerald-400">📍 Location pinned ({geo.lat.toFixed(4)}, {geo.lng.toFixed(4)}) — directions will be exact.</span> : <span className="font-tech text-[11px] text-muted-foreground">Optional — only when you tap. Helps the pro drive straight to the site.</span>}
          </div>
        </section>

        <div className="flex justify-between">
          <Button variant="outline" className="rounded-none font-display uppercase h-12 px-6" onClick={() => setStep(1)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
          <Button className="rounded-none font-display uppercase h-12 px-8" disabled={!step2Ok} onClick={() => setStep(3)}>Continue <ChevronRight className="h-4 w-4 ml-1" /></Button>
        </div>
        {!step2Ok && <p className="font-tech text-[11px] text-muted-foreground text-right -mt-4">Add a short description and the site address to continue{intent === "sell" ? " (plus the item name)" : ""}.</p>}
      </div>)}

      {step === 3 && (<div className="space-y-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="font-tech text-[11px] uppercase tracking-widest text-muted-foreground block mb-1.5">Your name</label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className={inputCls} /></div>
          <div><label className="font-tech text-[11px] uppercase tracking-widest text-muted-foreground block mb-1.5">Phone number (WhatsApp)</label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0803 000 0000" className={inputCls} /></div>
        </div>
        <div>
          <label className="font-tech text-[11px] uppercase tracking-widest text-muted-foreground block mb-2">How urgent is it?</label>
          <div className="grid grid-cols-3 gap-px bg-border border hairline">
            {URGENCIES.map(u => (<button key={u} onClick={() => setUrgency(u)} className={`p-4 font-display font-semibold uppercase cursor-pointer ${urgency === u ? "bg-primary/10 border-2 border-primary" : "bg-background hover:bg-card"}`}>{u}{u === "Emergency" && <span className="block font-tech text-[10px] normal-case tracking-normal text-muted-foreground mt-1">Water pouring in now</span>}{u === "Urgent" && <span className="block font-tech text-[10px] normal-case tracking-normal text-muted-foreground mt-1">Within a few days</span>}{u === "Normal" && <span className="block font-tech text-[10px] normal-case tracking-normal text-muted-foreground mt-1">No rush</span>}</button>))}
          </div>
        </div>
        <div className="border hairline bg-card p-5">
          <p className="font-tech text-[11px] uppercase tracking-[0.2em] text-primary">What happens next</p>
          <ol className="text-sm text-muted-foreground mt-3 space-y-1.5 list-decimal list-inside">
            <li>We review your snap and price the job openly — items, workmanship, transport, dispatch.</li>
            <li>You see the full breakdown in Track and approve the price. Nothing starts before you approve.</li>
            <li>We assign a trusted, approved pro at the agreed price. You follow their photo updates live.</li>
          </ol>
        </div>
        <div className="flex justify-between">
          <Button variant="outline" className="rounded-none font-display uppercase h-12 px-6" onClick={() => setStep(2)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
          <Button className="rounded-none font-display uppercase h-12 px-8" disabled={busy} onClick={() => void submit()}>{busy ? "Sending…" : "Send to Oketex"}</Button>
        </div>
      </div>)}
    </div>
  </div>);
}
