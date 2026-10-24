import { useEffect, useRef, useState } from "react";
import { Sparkles, Upload } from "lucide-react";
import { apiFetch, healthSync, probeApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
// AI Measurement Assist (Phase 6/7 slot) — ENV-GATED on the server.
// The panel reads /api/health once: unless the server reports ai:true
// (AI_VISION_URL + AI_VISION_KEY configured), it renders the honest
// "not switched on" state — no fake outputs, no dead button. When the
// service IS configured, the chosen photo is sent to /api/ai/assist,
// which forwards it to the configured vision service; whatever JSON
// comes back is displayed verbatim.
export default function AiAssistPanel({ context }: { context: string }) {
  const [aiOn, setAiOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let on = true;
    probeApi().then(() => { if (on) setAiOn(!!healthSync()?.ai); });
    return () => { on = false; };
  }, []);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { toast.error("That image is over 4MB — please use a smaller photo."); return; }
    setBusy(true); setResult(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Could not read that image"));
        r.readAsDataURL(f);
      });
      const data = await apiFetch<{ enabled: boolean; result?: unknown; error?: string }>("/api/ai/assist", {
        method: "POST", body: JSON.stringify({ imageDataUrl: dataUrl, context }),
      });
      if (!data.enabled) { setAiOn(false); return; }
      if (data.error) { toast.error(data.error); setResult(null); return; }
      setResult(typeof data.result === "string" ? data.result : JSON.stringify(data.result, null, 2));
    } catch (e: any) {
      toast.error(String(e?.message || "AI assist request failed"));
    } finally { setBusy(false); }
  };

  return (
    <section className="border hairline bg-card p-6 no-print">
      <h3 className="font-display font-bold uppercase text-xl flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> AI Measurement Assist</h3>
      {aiOn === null && <p className="font-tech text-xs text-muted-foreground mt-3">Checking whether AI assist is switched on…</p>}
      {aiOn === false && (
        <p className="text-sm text-muted-foreground mt-3 max-w-2xl">
          AI assist is not switched on yet — measurements work fully with the guided tools on this page.
          When the business connects an AI vision service, this panel will analyse your photo automatically.
        </p>
      )}
      {aiOn === true && (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground max-w-2xl">
            Upload a clear photo of the roof or space. Your photo is sent to the AI vision service the
            business has configured, and its reading is shown below — always confirm critical dimensions
            with a tape or a pro check before ordering.
          </p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => void onFile(e.target.files?.[0])} />
          <Button className="rounded-none font-display uppercase mt-4" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" /> {busy ? "Analysing…" : "Analyse a photo"}
          </Button>
          {result && <pre className="mt-4 border hairline bg-background p-4 font-tech text-xs overflow-x-auto whitespace-pre-wrap">{result}</pre>}
        </div>
      )}
    </section>
  );
}
