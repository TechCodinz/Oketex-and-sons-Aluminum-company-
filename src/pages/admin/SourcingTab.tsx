import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatNGN } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";
import { DELIVERY_ZONES } from "@/lib/roofEngine";
import { getRates, getProfitTargetMargin, getFindsDrafts, saveFindsDrafts } from "@/lib/settings";
import { catalogue, productPrice, productCost } from "@/data/catalog";
import {
  getSourceRequests, getSourceRequestsAdminAsync, quoteSourceRequestAsync, setSourceStatusAsync,
  saveSourceBriefAsync, aggregateDemand, quoteTotal, sourcingProfitFor, draftProductFromSourceRequest,
  SOURCE_STATUSES, type SourceRequest, type SourceStatus,
} from "@/lib/sourceRequests";
import { buildSourcingBrief, partnerMatches, draftQuote } from "@/lib/sourcingAgent";
import { createSupplyRequestAsync } from "@/lib/supply";
import type { Partner } from "@/lib/partnerStorage";
import { logActivity, currentActor } from "@/lib/activity";

// Admin → Sourcing (Source-Anything desk, Addenda 3+4). The Sourcing
// Agent PROPOSES (brief: catalogue match, partner matches, search pack,
// draft math) — a human approves and sends every quote. Customers see
// ONE landed total; cost lines live here and in the Profit view only.
export default function SourcingTab({ partners, onChanged }: { partners: Partner[]; onChanged?: (list: SourceRequest[]) => void }) {
  const [requests, setRequests] = useState<SourceRequest[]>(() => getSourceRequests());
  const [sel, setSel] = useState<string>("");
  const [form, setForm] = useState({ itemCost: "", shipping: "", itemNgn: "", shippingNgn: "", serviceNgn: "", costTotal: "", leadDays: "", note: "" });
  const target = getProfitTargetMargin();
  const demand = useMemo(() => aggregateDemand(requests), [requests]);
  const zoneLabel = (id: string) => DELIVERY_ZONES.find(z => z.id === id)?.label || id;
  const refresh = async () => { const list = await getSourceRequestsAdminAsync(); setRequests(list); onChanged?.(list); };
  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, []);
  const selected = requests.find(r => r.code === sel);

  useEffect(() => {
    if (!selected) return;
    setForm({
      itemCost: "", shipping: "",
      itemNgn: selected.quote ? String(selected.quote.itemNgn) : "", shippingNgn: selected.quote ? String(selected.quote.shippingNgn) : "",
      serviceNgn: selected.quote ? String(selected.quote.serviceNgn) : "", costTotal: selected.quote ? String(selected.quote.costTotalNgn) : "",
      leadDays: selected.quote?.leadDays != null ? String(selected.quote.leadDays) : "", note: selected.quote?.note || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const genBrief = async (r: SourceRequest) => {
    const brief = buildSourcingBrief(r, { catalogue: catalogue(), partners });
    const saved = await saveSourceBriefAsync(r.code, brief);
    setRequests(list => list.map(x => x.code === r.code ? (saved ?? { ...x, agentBrief: brief }) : x));
    toast.success("Sourcing brief ready — the agent proposes, you approve");
  };
  const applyDraft = () => {
    const d = draftQuote(Number(form.itemCost) || 0, Number(form.shipping) || 0, target);
    setForm(f => ({ ...f, itemNgn: String(d.itemNgn), shippingNgn: String(d.shippingNgn), serviceNgn: String(d.serviceNgn), costTotal: String((Number(f.itemCost) || 0) + (Number(f.shipping) || 0)) }));
    toast.success(`Draft landed total ${formatNGN(d.totalNgn)} at ${target}% target margin — review before sending`);
  };
  const quoteFromStock = (r: SourceRequest) => {
    const brief = r.agentBrief; if (!brief?.catalogue) return;
    const p = catalogue().find(x => x.slug === brief.catalogue!.slug);
    const zonePrice = (getRates().deliveryZones || {})[r.area] ?? DELIVERY_ZONES.find(z => z.id === r.area)?.price ?? 0;
    setForm(f => ({ ...f, itemNgn: String(brief.catalogue!.priceNgn), shippingNgn: String(zonePrice), serviceNgn: "0", costTotal: String(p ? (productCost(p) ?? productPrice(p)) : brief.catalogue!.priceNgn), itemCost: String(p ? (productCost(p) ?? productPrice(p)) : brief.catalogue!.priceNgn), shipping: String(zonePrice) }));
    toast.success("Quote filled from the stocked product + delivery zone — review and send");
  };
  const requestSupply = async (r: SourceRequest, partnerCode: string, partnerName: string) => {
    const rec = await createSupplyRequestAsync({
      type: "buy", item: r.productName, spec: r.description || "", qty: Math.max(1, r.quantity), unit: "pcs",
      neededBy: "", note: `From sourcing request ${r.code} — customer ${r.customerName} (${r.customerPhone}), delivery area: ${zoneLabel(r.area)}. Customer sees one landed total; quote your supply price here.`,
      targetPartnerCodes: [partnerCode], createdBy: currentActor().name,
    });
    logActivity("sourcing_supply_requested", r.code, `Supply request ${rec.code} sent to ${partnerName} from sourcing brief`);
    toast.success(`Supply request ${rec.code} created for ${partnerName}`);
  };
  const sendQuote = async (r: SourceRequest) => {
    const quote = {
      itemNgn: Math.max(0, Math.round(Number(form.itemNgn) || 0)), shippingNgn: Math.max(0, Math.round(Number(form.shippingNgn) || 0)),
      serviceNgn: Math.max(0, Math.round(Number(form.serviceNgn) || 0)), costTotalNgn: Math.max(0, Math.round(Number(form.costTotal) || 0)),
      leadDays: form.leadDays === "" ? null : Math.max(0, Math.round(Number(form.leadDays) || 0)), note: form.note.trim(), quotedAt: new Date().toISOString(),
    };
    if (quoteTotal(quote) <= 0) return toast.error("Enter the quote lines first (or use the draft math)");
    const saved = await quoteSourceRequestAsync(r.code, quote);
    if (saved) { setRequests(list => list.map(x => x.code === r.code ? saved : x)); onChanged?.(requests.map(x => x.code === r.code ? saved : x)); }
    logActivity("sourcing_quoted", r.code, `Landed quote ${formatNGN(quoteTotal(quote))} sent (cost ${formatNGN(quote.costTotalNgn)}) by ${currentActor().name}`);
    toast.success(`Quote sent for ${r.code} — customer approves in Track`);
  };
  const setStatus = async (r: SourceRequest, status: SourceStatus) => {
    const saved = await setSourceStatusAsync(r.code, status);
    if (saved) { setRequests(list => list.map(x => x.code === r.code ? saved : x)); onChanged?.(requests.map(x => x.code === r.code ? saved : x)); }
    toast.success(`${r.code} → ${status}`);
  };
  const addToCatalogue = (r: SourceRequest) => {
    const draft = draftProductFromSourceRequest(r, target);
    const drafts = getFindsDrafts();
    if (drafts.some(d => d.slug === draft.slug)) return toast.error("A draft for this find already exists in the Catalog tab");
    saveFindsDrafts([...drafts, draft]);
    logActivity("sourcing_to_catalogue", r.code, `Draft product "${draft.name}" created in Hard to Find / Global Finds at ${formatNGN(draft.priceNgn)} (draft — publish from Catalog)`);
    toast.success(`Draft "${draft.name}" created — publish it from the Catalog tab when ready`);
  };

  return (<div className="space-y-10">
    <section>
      <h2 className="font-display font-bold uppercase text-2xl mb-2">Sourcing — Source-Anything desk ({requests.length})</h2>
      <p className="font-tech text-xs text-muted-foreground max-w-3xl">Customers ask for anything they can&apos;t find; the Sourcing Agent drafts a brief, <b className="text-foreground">you approve every quote</b>. The customer sees one landed total + lead time; costs stay on this side and feed the Profit view.</p>
    </section>

    <section>
      <p className="label-tech mb-3">Market survey — what customers keep asking for</p>
      {!demand.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-4">No requests yet — demand signals appear here as customers ask.</p>
      : <div className="border hairline">{demand.slice(0, 10).map((d, i) => (<div key={d.keyword} className={`px-5 py-3 flex flex-wrap gap-3 justify-between text-sm ${i > 0 ? "border-t hairline" : ""}`}><span className="capitalize">{d.keyword}</span><span className="font-tech">{d.count} request{d.count === 1 ? "" : "s"} · mostly {zoneLabel(d.topArea)}</span></div>))}</div>}
    </section>

    {!requests.length ? <p className="font-tech text-sm text-muted-foreground">No sourcing requests yet — the queue fills as customers send from /source.</p> : (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{requests.map(r => (
        <button key={r.code} onClick={() => setSel(r.code)} className={`text-left border hairline bg-card cursor-pointer p-4 ${sel === r.code ? "border-primary" : "hover:border-primary/60"}`}>
          <div className="flex justify-between items-start gap-2"><p className="font-tech font-semibold">{r.code}</p><StatusBadge status={r.status} /></div>
          <p className="font-display font-semibold mt-1">{r.productName}</p>
          <p className="font-tech text-[11px] text-muted-foreground mt-1">{r.customerName} · Qty {r.quantity} · {zoneLabel(r.area)}</p>
          {r.quote && <p className="font-tech text-xs mt-2">Landed {formatNGN(quoteTotal(r.quote))}{sourcingProfitFor(r) != null ? ` · profit ${formatNGN(sourcingProfitFor(r)!)}` : ""}</p>}
        </button>))}
      </div>
    )}

    {selected && (<div className="border hairline bg-card p-5 space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div><p className="font-tech font-semibold">{selected.code} — {selected.productName}</p><p className="font-tech text-[11px] text-muted-foreground">{selected.customerName} · {selected.customerPhone} · Qty {selected.quantity} · {zoneLabel(selected.area)} · {new Date(selected.createdAt).toLocaleString("en-NG")}</p></div>
        <StatusBadge status={selected.status} />
      </div>
      {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
      {selected.photo && <img src={selected.photo} alt="Customer reference" className="max-h-52 border hairline" />}
      {selected.referenceLink && <p className="font-tech text-xs">Reference: <a className="text-primary break-all" href={selected.referenceLink} target="_blank" rel="noreferrer">{selected.referenceLink}</a></p>}

      <div className="border hairline p-4">
        <div className="flex flex-wrap justify-between items-center gap-3"><p className="label-tech">Sourcing Agent brief</p>
          <button onClick={() => void genBrief(selected)} className="border hairline px-3 py-1.5 font-tech text-[11px] uppercase tracking-widest hover:border-primary hover:text-primary cursor-pointer">{selected.agentBrief ? "Regenerate brief" : "Generate brief"}</button></div>
        {!selected.agentBrief ? <p className="font-tech text-xs text-muted-foreground mt-2">No brief yet — the agent checks the stocked catalogue, partner capabilities and builds a global search pack.</p> : (
          <div className="space-y-3 mt-3">
            {selected.agentBrief.catalogue ? (
              <div className="flex flex-wrap justify-between gap-3 items-center bg-primary/5 border border-primary/40 px-3 py-2"><p className="font-tech text-sm">Already stocked: <b>{selected.agentBrief.catalogue.name}</b> @ {formatNGN(selected.agentBrief.catalogue.priceNgn)}</p>
                <button onClick={() => quoteFromStock(selected)} className="font-tech text-[11px] uppercase tracking-widest text-primary hover:underline cursor-pointer">Quote it instantly</button></div>
            ) : <p className="font-tech text-xs text-muted-foreground">Not in the stocked catalogue.</p>}
            {partnerMatches(selected, partners).map(p => (
              <div key={p.code} className="flex flex-wrap justify-between gap-3 items-center border hairline px-3 py-2"><p className="font-tech text-sm">Partner <b>{p.name}</b> lists this capability — <span className="text-muted-foreground">{p.capability}</span></p>
                <button onClick={() => void requestSupply(selected, p.code, p.name)} className="font-tech text-[11px] uppercase tracking-widest text-primary hover:underline cursor-pointer">Request supply quote</button></div>
            ))}
            <div className="flex flex-wrap gap-2">{selected.agentBrief.links.map(l => (<a key={l.label} href={l.url} target="_blank" rel="noreferrer" className="border hairline px-3 py-1.5 font-tech text-[11px] uppercase tracking-widest hover:border-primary hover:text-primary">{l.label} ↗</a>))}</div>
            <p className="font-tech text-[11px] text-muted-foreground">Brief generated {new Date(selected.agentBrief.generatedAt).toLocaleString("en-NG")} · the agent proposes — a human approves every quote.</p>
          </div>
        )}
      </div>

      <div className="border hairline p-4 space-y-4">
        <p className="label-tech">Quote builder — costs first, the agent drafts the landed price</p>
        <div className="grid sm:grid-cols-3 gap-4">
          <div><label className="label-tech" htmlFor="sq-itemcost">Found item cost ₦</label><input id="sq-itemcost" type="number" min={0} className="field-tech font-tech" value={form.itemCost} onChange={e => setForm({ ...form, itemCost: e.target.value })} /></div>
          <div><label className="label-tech" htmlFor="sq-ship">Shipping / import estimate ₦</label><input id="sq-ship" type="number" min={0} className="field-tech font-tech" value={form.shipping} onChange={e => setForm({ ...form, shipping: e.target.value })} /></div>
          <div className="flex items-end"><button onClick={applyDraft} className="border hairline px-4 h-10 font-tech text-xs uppercase tracking-widest hover:border-primary hover:text-primary cursor-pointer w-full">Draft at {target}% margin</button></div>
        </div>
        <div className="grid sm:grid-cols-4 gap-4">
          <div><label className="label-tech" htmlFor="sq-item">Quoted item ₦</label><input id="sq-item" type="number" min={0} className="field-tech font-tech" value={form.itemNgn} onChange={e => setForm({ ...form, itemNgn: e.target.value })} /></div>
          <div><label className="label-tech" htmlFor="sq-shipq">Quoted shipping ₦</label><input id="sq-shipq" type="number" min={0} className="field-tech font-tech" value={form.shippingNgn} onChange={e => setForm({ ...form, shippingNgn: e.target.value })} /></div>
          <div><label className="label-tech" htmlFor="sq-service">Service ₦</label><input id="sq-service" type="number" min={0} className="field-tech font-tech" value={form.serviceNgn} onChange={e => setForm({ ...form, serviceNgn: e.target.value })} /></div>
          <div><label className="label-tech" htmlFor="sq-cost">Our total cost ₦ (admin only)</label><input id="sq-cost" type="number" min={0} className="field-tech font-tech" value={form.costTotal} onChange={e => setForm({ ...form, costTotal: e.target.value })} /></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label-tech" htmlFor="sq-lead">Lead time (days)</label><input id="sq-lead" type="number" min={0} className="field-tech font-tech" value={form.leadDays} onChange={e => setForm({ ...form, leadDays: e.target.value })} /></div>
          <div><label className="label-tech" htmlFor="sq-note">Note to customer</label><input id="sq-note" className="field-tech" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-tech text-sm">Customer sees: <b className="text-primary">{formatNGN((Number(form.itemNgn) || 0) + (Number(form.shippingNgn) || 0) + (Number(form.serviceNgn) || 0))}</b> landed{form.costTotal ? <span className="text-muted-foreground"> · margin {formatNGN((Number(form.itemNgn) || 0) + (Number(form.shippingNgn) || 0) + (Number(form.serviceNgn) || 0) - (Number(form.costTotal) || 0))} vs cost (admin only)</span> : null}</p>
          <button onClick={() => void sendQuote(selected)} className="bg-primary text-primary-foreground px-5 h-10 font-display uppercase text-sm cursor-pointer">Send quote</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="label-tech mr-1">Move to:</span>
        {SOURCE_STATUSES.filter(s => !["Received", "Quoted", "Approved"].includes(s)).map(s => (
          <button key={s} disabled={selected.status === s} onClick={() => void setStatus(selected, s)} className="border hairline px-3 py-1.5 font-tech text-[11px] uppercase tracking-widest hover:border-primary hover:text-primary disabled:opacity-40 cursor-pointer">{s}</button>
        ))}
        {selected.status === "Delivered" && <button onClick={() => addToCatalogue(selected)} className="border border-primary text-primary px-3 py-1.5 font-tech text-[11px] uppercase tracking-widest hover:bg-primary hover:text-primary-foreground cursor-pointer ml-2">Add to catalogue (draft)</button>}
      </div>
      <div className="space-y-2">{selected.timeline.map((e, i) => (<p key={i} className="font-tech text-xs text-muted-foreground"><span className="text-foreground">{e.by === "admin" ? "Oketex" : "Customer"}</span> — {e.text} <span>· {new Date(e.ts).toLocaleString("en-NG")}</span></p>))}</div>
    </div>)}
  </div>);
}
