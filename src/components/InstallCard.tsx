import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
// PWA install card (Phase 6). Uses beforeinstallprompt when the browser
// offers it; otherwise shows plain "Add to Home Screen" instructions —
// the app is installable either way (manifest + service worker in public/).
export default function InstallCard() {
  const [deferred, setDeferred] = useState<any>(null);
  const [hidden, setHidden] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches) setInstalled(true);
    const onPrompt = (e: any) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  if (installed || hidden) return null;
  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { const choice = await deferred.userChoice; if (choice?.outcome === "accepted") setInstalled(true); } catch { /* prompt dismissed */ }
    setDeferred(null);
  };
  return (
    <div className="border hairline bg-card p-5 relative">
      <button onClick={() => setHidden(true)} aria-label="Dismiss install card" className="absolute top-3 right-3 text-muted-foreground hover:text-foreground cursor-pointer"><X className="h-4 w-4" /></button>
      <h3 className="font-display font-bold uppercase text-lg flex items-center gap-2"><Download className="h-5 w-5 text-primary" /> Install the Oketex app</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-xl">
        Put Oketex on your home screen: the shop, calculators, workspace and documents open full-screen and keep working on a weak site connection.
      </p>
      {deferred
        ? <Button className="rounded-none font-display uppercase mt-4" onClick={() => void install()}>Install app</Button>
        : <p className="font-tech text-xs text-muted-foreground mt-3">In your browser menu, tap <span className="text-foreground">“Add to Home Screen”</span> or <span className="text-foreground">“Install app”</span> — it takes ten seconds and uses almost no space.</p>}
    </div>
  );
}
