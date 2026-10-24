import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageHead } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { BUSINESS } from "@/contracts/constants";
import { getBusiness, businessWaLink } from "@/lib/settings";
import { BOOKING_SERVICES, bookingCode, saveBookingAsync } from "@/lib/proStorage";
import { notify } from "@/lib/notify";

const SLOTS = ["Morning 8–11", "Midday 11–2", "Afternoon 2–5"] as const;
const BUILDING_TYPES = ["Bungalow", "Duplex", "Storey Building", "Commercial", "Warehouse", "Church"] as const;
const STAGES = ["Planning / Land", "Foundation", "Blockwork", "Roofing Stage", "Finishing", "Existing Building / Repair"] as const;

export default function Book() {
  const [params] = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    service: BOOKING_SERVICES.some(s => s.id === params.get("service")) ? params.get("service")! : "measurement",
    date: "", slot: SLOTS[0] as string, name: "", phone: "", address: "", lgaState: "",
    buildingType: BUILDING_TYPES[0] as string, stage: STAGES[3] as string, notes: "",
  });
  const [done, setDone] = useState<{ code: string; summary: string } | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  const serviceLabel = BOOKING_SERVICES.find(s => s.id === form.service)?.label ?? form.service;

  async function submit() {
    if (form.name.trim().length < 2) return toast.error("Enter your full name");
    if (form.phone.replace(/\D/g, "").length < 10) return toast.error("Enter a valid Nigerian phone / WhatsApp number (at least 10 digits)");
    if (!form.date) return toast.error("Pick a preferred date");
    if (form.date < today) return toast.error("Date cannot be in the past");
    if (form.address.trim().length < 5) return toast.error("Enter the site address");
    const code = bookingCode();
    await saveBookingAsync({
      code, service: form.service, serviceLabel, date: form.date, slot: form.slot, name: form.name.trim(),
      phone: form.phone.trim(), address: form.address.trim(), lgaState: form.lgaState.trim(),
      buildingType: form.buildingType, stage: form.stage, notes: form.notes.trim() || undefined,
      status: "pending", createdAt: new Date().toISOString(),
    });
    notify({ templateKey: "booking_created", audience: "admin", refCode: code, vars: { service: serviceLabel, name: form.name.trim(), date: `${form.date} · ${form.slot}`, phone: form.phone.trim() } });
    const summary = `BOOKING ${code} — ${BUSINESS.name}\nService: ${serviceLabel}\nWhen: ${form.date} · ${form.slot}\nName: ${form.name}\nPhone: ${form.phone}\nSite: ${form.address}${form.lgaState ? ` (${form.lgaState})` : ""}\nBuilding: ${form.buildingType} · Stage: ${form.stage}${form.notes ? `\nNotes: ${form.notes}` : ""}\nPlease confirm my booking. Thank you.`;
    setDone({ code, summary });
    toast.success("Booking saved");
  }

  if (done) return (<div className="mx-auto max-w-2xl px-4 py-24 text-center">
    <CheckCircle2 className="h-14 w-14 text-primary mx-auto" />
    <h1 className="font-display font-bold uppercase text-4xl mt-6">Booking received</h1>
    <p className="text-muted-foreground mt-3">Your booking code is <span className="font-tech text-primary">{done.code}</span> — saved on this device. Track it any time under Track → Bookings.</p>
    <div className="mt-8 border hairline bg-card p-6 text-left">
      <p className="label-tech mb-3">What happens next</p>
      <ol className="space-y-2 text-sm list-none">
        <li><span className="text-primary font-tech">01</span> — Tap “Confirm on WhatsApp” below so the office sees it immediately.</li>
        <li><span className="text-primary font-tech">02</span> — We call/WhatsApp you to confirm the exact visit time within working hours ({getBusiness().hours}).</li>
        <li><span className="text-primary font-tech">03</span> — Our team arrives in your chosen slot; measurement surveys are free within Ogun &amp; Lagos.</li>
      </ol>
    </div>
    <div className="flex flex-wrap gap-3 justify-center mt-6">
      <Button asChild className="rounded-none font-display uppercase"><a target="_blank" rel="noreferrer" href={businessWaLink(done.summary)}>Confirm on WhatsApp</a></Button>
      <Button variant="outline" className="rounded-none font-display uppercase" asChild><Link to={`/track?code=${done.code}`}>Track booking</Link></Button>
      <Button variant="outline" className="rounded-none font-display uppercase" onClick={() => setDone(null)}>Book another</Button>
    </div>
  </div>);

  return (<div><PageHead kicker="Customer Bookings" title="Book a visit, crew or delivery" lead="Pick a service, date and time slot — get a booking code instantly, then confirm on WhatsApp so the office locks it in." />
  <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
    <div className="border hairline bg-card p-6 space-y-7">
      <div><p className="label-tech mb-3">01 — Service</p>
        <div className="grid sm:grid-cols-2 gap-px bg-border border hairline">
          {BOOKING_SERVICES.map(s => (<button key={s.id} onClick={() => setForm({ ...form, service: s.id })} className={`text-left p-4 cursor-pointer ${form.service === s.id ? "bg-primary/15 border-l-2 border-l-primary" : "bg-background hover:bg-card"}`}><span className="font-display font-semibold uppercase">{s.label}</span></button>))}
        </div></div>
      <div className="grid sm:grid-cols-2 gap-5">
        <div><label className="label-tech">02 — Preferred date</label><input type="date" min={today} value={form.date} onChange={set("date")} className="field-tech font-tech" /></div>
        <div><label className="label-tech">03 — Time slot</label><select value={form.slot} onChange={set("slot")} className="field-tech font-tech bg-card w-full">{SLOTS.map(s => <option key={s}>{s}</option>)}</select></div>
        <div><label className="label-tech">Full name</label><input value={form.name} onChange={set("name")} className="field-tech" placeholder="e.g. Adaeze Okonkwo" /></div>
        <div><label className="label-tech">Phone / WhatsApp</label><input value={form.phone} onChange={set("phone")} className="field-tech" placeholder="0803 000 0000" /></div>
        <div className="sm:col-span-2"><label className="label-tech">Site address</label><input value={form.address} onChange={set("address")} className="field-tech" placeholder="Street, area, town" /></div>
        <div><label className="label-tech">LGA / State</label><input value={form.lgaState} onChange={set("lgaState")} className="field-tech" placeholder="e.g. Ifo LGA, Ogun State" /></div>
        <div><label className="label-tech">Building type</label><select value={form.buildingType} onChange={set("buildingType")} className="field-tech font-tech bg-card w-full">{BUILDING_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><label className="label-tech">Project stage</label><select value={form.stage} onChange={set("stage")} className="field-tech font-tech bg-card w-full">{STAGES.map(s => <option key={s}>{s}</option>)}</select></div>
        <div><label className="label-tech">Notes (optional)</label><textarea value={form.notes} onChange={set("notes")} rows={3} className="field-tech" placeholder="Roof size if known, access notes, landmarks…" /></div>
      </div>
      <Button className="w-full rounded-none h-12 font-display font-semibold uppercase tracking-wider" onClick={submit}>Book — {serviceLabel}</Button>
      <p className="font-tech text-[11px] text-muted-foreground">Bookings save on this device and get a code (BK-…). Confirming on WhatsApp lets the office confirm the exact time. Or call {getBusiness().phone}.</p>
    </div>
  </div></div>);
}
