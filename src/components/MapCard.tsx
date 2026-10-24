import { MapPin, Navigation } from "lucide-react";
// Site map + directions for Snap & Send jobs. With real coordinates → an
// OpenStreetMap embed centred on the site + a Google Maps directions link.
// Address only → the address text + a directions link (never a fake map).
export function MapCard({ geo, address, title = "Site location" }: { geo: { lat: number; lng: number } | null; address: string; title?: string }) {
  const dest = geo ? `${geo.lat},${geo.lng}` : encodeURIComponent(address || "");
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  const bbox = geo ? `${geo.lng - 0.01},${geo.lat - 0.01},${geo.lng + 0.01},${geo.lat + 0.01}` : "";
  return (
    <div className="border hairline bg-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b hairline">
        <p className="font-tech text-[11px] uppercase tracking-[0.2em] text-primary flex items-center gap-2"><MapPin className="h-4 w-4" /> {title}</p>
        <a href={directions} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-display font-semibold uppercase text-xs bg-primary text-primary-foreground px-3 py-2 hover:bg-primary/90"><Navigation className="h-3.5 w-3.5" /> Get Directions</a>
      </div>
      {geo ? (
        <iframe title="Site map" src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${geo.lat},${geo.lng}`} className="w-full h-56 border-0" loading="lazy" />
      ) : null}
      <p className="px-4 py-3 text-sm text-muted-foreground">{address}{geo ? <span className="font-tech text-[11px] block mt-1">{geo.lat.toFixed(5)}, {geo.lng.toFixed(5)} (shared by the customer)</span> : <span className="font-tech text-[11px] block mt-1">No pin shared — directions use the written address.</span>}</p>
    </div>
  );
}
