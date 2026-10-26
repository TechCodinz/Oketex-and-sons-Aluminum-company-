import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { PageHead } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { DELIVERY_ZONES } from "@/lib/roofEngine";
import { getBusiness, businessWaLink } from "@/lib/settings";
import { submitSourceRequestAsync, type SourceRequest } from "@/lib/sourceRequests";
import { Globe2, SearchCheck, HandCoins, Truck } from "lucide-react";

// Source-Anything desk (Addendum 3): "Can't find it? We source it —
// anywhere in the world, to your doorstep." The customer describes the
// product (photo OR reference link, like Snap & Send), Oketex quotes ONE
// landed total, the customer approves in Track, and we source + deliver.
export default function Source() {
  useEffect(() => {
    document.title = "Can't Find It? We Source It Globally — Oketex & Sons";
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute("content", "Can't find a building product anywhere near you? Oketex sources it globally and delivers to your doorstep — one landed price, quoted up front. Roofing, plumbing, electrical, finishes, tools and hard-to-find imports.");
  }, []);
  const [f, setF] = useState({ productName: "", description: "", referenceLink: "", quantity: 1, area: "ogun-lagos", customerName: "", customerPhone: "" });
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<SourceRequest | null>(null);
  const biz = getBusiness();

  const onPhoto = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result || ""));
    reader.readAsDataURL(file);
  };
  const submit = async () => {
    if (f.productName.trim().length < 2) return toast.error("Tell us the product you need");
    if (f.customerName.trim().length < 2) return toast.error("Your name is needed");
    if (f.customerPhone.replace(/\D/g, "").length < 10) return toast.error("Enter a valid phone number");
    setBusy(true);
    try {
      const req = await submitSourceRequestAsync({
        productName: f.productName.trim(), description: f.description.trim(), referenceLink: f.referenceLink.trim(),
        photo, quantity: Math.max(1, Math.round(Number(f.quantity) || 1)), area: f.area,
        customerName: f.customerName.trim(), customerPhone: f.customerPhone.trim(),
      });
      setDone(req);
      toast.success(`Request ${req.code} received — watch Track for your quote`);
    } finally { setBusy(false); }
  };

  return (<div>
    <PageHead kicker="Global Sourcing" title="Can't find it? We source it" lead="Any product, anywhere in the world, to your doorstep. Tell us what you can't find near you — we quote ONE landed price (item + shipping + service), you approve it, we source and deliver." />
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <div className="grid md:grid-cols-4 gap-px bg-border border hairline mb-10">
        {[{ icon: Globe2, t: "Tell us the product", d: "Name it, describe it, add a photo or a link to one you've seen anywhere." },
          { icon: SearchCheck, t: "We hunt it down", d: "Our sourcing desk checks local partners and global suppliers for the real thing." },
          { icon: HandCoins, t: "One landed price", d: "You get a single total — item, shipping and service included — plus the lead time. No surprises." },
          { icon: Truck, t: "Approve & we deliver", d: "Approve the quote in Track and we source it, ship it and bring it to your doorstep." }].map((s, i) => (
          <div key={s.t} className="bg-background p-5"><span className="font-tech text-xs text-primary">{String(i + 1).padStart(2, "0")}</span><s.icon className="h-6 w-6 mt-3 text-primary" /><p className="font-display font-semibold uppercase mt-3">{s.t}</p><p className="text-sm text-muted-foreground mt-1.5">{s.d}</p></div>
        ))}
      </div>
      {done ? (
        <div className="border hairline bg-card p-6 max-w-2xl">
          <p className="font-display font-bold uppercase text-2xl">Request received — {done.code}</p>
          <p className="text-muted-foreground mt-2">We&apos;re on it. Your quote will appear in Track under the <b className="text-foreground">Sourcing</b> tab — search with your code <b className="text-foreground">{done.code}</b> or your phone number. Nothing is charged until you approve the landed price.</p>
          <div className="flex flex-wrap gap-3 mt-5">
            <Button asChild className="rounded-none font-display uppercase"><Link to={`/track?code=${done.code}`}>Track my request</Link></Button>
            <Button asChild variant="outline" className="rounded-none font-display uppercase"><a target="_blank" rel="noreferrer" href={businessWaLink(`Hello ${biz.name}, I just sent a sourcing request ${done.code} for: ${done.productName}.`)}>WhatsApp the desk</a></Button>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
          <div className="border hairline bg-card p-6 space-y-5">
            <div><label className="label-tech" htmlFor="src-name">What are you looking for? *</label><input id="src-name" className="field-tech" placeholder="e.g. Marine plywood 18mm, Italian floor tiles, solar street light…" value={f.productName} onChange={e => setF({ ...f, productName: e.target.value })} /></div>
            <div><label className="label-tech" htmlFor="src-desc">Describe it (size, colour, spec, brand you saw — anything that helps)</label><textarea id="src-desc" className="field-tech" rows={3} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div><label className="label-tech" htmlFor="src-link">Reference link (where you saw it — optional)</label><input id="src-link" className="field-tech" placeholder="https://…" value={f.referenceLink} onChange={e => setF({ ...f, referenceLink: e.target.value })} /></div>
              <div><label className="label-tech" htmlFor="src-photo">…or a photo of it (optional)</label><input id="src-photo" type="file" accept="image/*" className="field-tech font-tech text-xs" onChange={e => onPhoto(e.target.files?.[0])} />{photo && <img src={photo} alt="Your reference" className="mt-2 max-h-32 border hairline" />}</div>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div><label className="label-tech" htmlFor="src-qty">Quantity</label><input id="src-qty" type="number" min={1} className="field-tech" value={f.quantity} onChange={e => setF({ ...f, quantity: Number(e.target.value) })} /></div>
              <div><label className="label-tech" htmlFor="src-area">Delivery area</label><select id="src-area" className="field-tech" value={f.area} onChange={e => setF({ ...f, area: e.target.value })}>{DELIVERY_ZONES.map(z => (<option key={z.id} value={z.id}>{z.label}</option>))}</select></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div><label className="label-tech" htmlFor="src-cname">Your name *</label><input id="src-cname" className="field-tech" value={f.customerName} onChange={e => setF({ ...f, customerName: e.target.value })} /></div>
              <div><label className="label-tech" htmlFor="src-phone">Phone / WhatsApp *</label><input id="src-phone" className="field-tech" placeholder="0803…" value={f.customerPhone} onChange={e => setF({ ...f, customerPhone: e.target.value })} /></div>
            </div>
            <Button className="rounded-none h-12 px-8 font-display uppercase" disabled={busy} onClick={() => void submit()}>{busy ? "Sending…" : "Send sourcing request"}</Button>
            <p className="font-tech text-[11px] text-muted-foreground">Free to request. You only pay after you approve the landed quote in Track.</p>
          </div>
          <aside className="border hairline p-6 bg-background">
            <p className="label-tech mb-3">Already requested?</p>
            <p className="text-sm text-muted-foreground">Track your quote under the <b className="text-foreground">Sourcing</b> tab with your SC code or phone number.</p>
            <Button asChild variant="outline" className="rounded-none font-display uppercase mt-4 w-full"><Link to="/track">Go to Track</Link></Button>
            <p className="label-tech mt-8 mb-3">Popular hard-to-find lines</p>
            <p className="text-sm text-muted-foreground">Solar flood lights · Laser levels · Smart locks &amp; breakers · Acoustic wall panels · UV marble sheets · Epoxy floor kits — see the <Link to="/shop?category=hard-to-find" className="text-primary hover:underline">Hard to Find shelf</Link>.</p>
          </aside>
        </div>
      )}
    </div>
  </div>);
}
