import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, Square } from "lucide-react";

// Voice guide — reads a card aloud with the DEVICE voice
// (window.speechSynthesis). Honest label: the founder's recorded Legacy
// Voice replaces this when the recordings arrive. Speech is cancelled
// on unmount/navigation so a guide never talks over the next page.
export default function VoiceGuide({ title, lines }: { title: string; lines: string[] }) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);

  const stop = () => { window.speechSynthesis.cancel(); setSpeaking(false); };
  const speak = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const text = [title + ".", ...lines].join(" ");
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utterRef.current = u;
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  if (!supported) return <p className="font-tech text-[11px] text-muted-foreground">Voice guide needs a browser with speech support — the steps are all written out below.</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {!speaking
        ? <Button className="rounded-none font-display uppercase h-10" onClick={speak}><Volume2 className="h-4 w-4 mr-2" /> Listen to the guide</Button>
        : <Button variant="outline" className="rounded-none font-display uppercase h-10" onClick={stop}><Square className="h-4 w-4 mr-2" /> Stop</Button>}
      <p className="font-tech text-[11px] text-muted-foreground max-w-md">Device voice for now — the founder's Legacy Voice will replace this when recordings arrive.</p>
    </div>
  );
}
