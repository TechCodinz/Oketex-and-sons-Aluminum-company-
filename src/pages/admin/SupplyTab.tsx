import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatNGN } from "@/lib/money";
import { getSupplyRequestsAsync, createSupplyRequestAsync, supplyActionAsync, supplyCandidates, committedSpend, type SupplyRequest } from "@/lib/supply";
import { getPartners } from "@/lib/partnerStorage";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity";
import type { Partner } from "@/lib/partnerStorage";

// Admin → Supply (owner + operations run it; store + accounts can view).
// Procurement THROUGH the partner network: raise a buy/hire request,
// target it at capability-matched partners (or broadcast to approved
// sellers), compare the quotes side by side, approve one. No commission —
// this is Oketex buying; the approved totals are committed spend.
export default function SupplyTab({ canManage, actorName }: { canManage: boolean; actorName: string }) {
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [partners, setPartners] = useState<Partner[]>(() => getPartners());
  const [form, setForm] = useState({ type: "buy" as "buy" | "hire", item: "", spec: "", qty: "1", unit: "pcs", neededBy: "", note: "", broadcast: true });
  const [targets, setTargets] = useState<string[]>([]);
  const load = async () => { setRequests(await getSupplyRequestsAsync()); setPartners(getPartners()); };
  useEffect(() => { void load(); }, []);
  const candidates = useMemo(() => supplyCandidates(partners, form.item), [partners, form.item]);
  const spend = committedSpend(requests);

  const create = async () => {
    if (form.item.trim().length < 2) return toast.error("Name the item or equipment");
    const qty = parseFloat(form.qty) || 0;
    if (qty <= 0) return toast.error("Enter a quantity");
    if (!form.broadcast && !targets.length) return toast.error("Pick at least one target partner — or switch to broadcast");
    const rec = await createSupplyRequestAsync({
      type: form.type, item: form.item.trim(), spec: form.spec.trim(), qty, unit: form.unit.trim() || "pcs",
      neededBy: form.neededBy, note: form.note.trim(),
      targetPartnerCodes: form.broadcast ? [] : targets, createdBy: actorName,
    });
    logActivity("supply_created", rec.code, `${rec.type} ${rec.qty} ${rec.unit} — ${rec.item}`);
    // Tell the partners (targeted ones, or every approved seller on a broadcast).
    const recipients = partners.filter(p => p.status === "approved" && (rec.targetPartnerCodes.length ? rec.targetPartnerCodes.includes(p.code) : p.role === "seller" || p.role === "both"));
    for (const p of recipients) {
      void notify({ templateKey: "supply_requested", audience: "partner", refCode: rec.code, phone: p.phone || undefined, vars: { partner: p.businessName, code: rec.code, title: `${rec.qty} ${rec.unit} of ${rec.item}` } });
    }
    setForm({ type: "buy", item: "", spec: "", qty: "1", unit: "pcs", neededBy: "", note: "", broadcast: true });
    setTargets([]);
    await load();
    toast.success(`Supply request ${rec.code} raised — ${recipients.length} partner(s) notified`);
  };
  const act = async (rec: SupplyRequest, action: "approve" | "received" | "cancel", partnerCode?: string) => {
    const r = await supplyActionAsync(rec.code, action, partnerCode);
    if (r.error || !r.request) return toast.error(r.error || "Action failed");
    if (action === "approve") {
      const winner = partners.find(p => p.code === partnerCode);
      const quote = rec.quotes.find(q => q.partnerCode === partnerCode);
      logActivity("supply_approved", rec.code, `${winner?.businessName || partnerCode} at ${quote ? formatNGN(quote.totalNgn) : ""}`);
      if (winner && quote) void notify({ templateKey: "supply_won", audience: "partner", refCode: rec.code, phone: winner.phone || undefined, vars: { partner: winner.businessName, code: rec.code, amount: formatNGN(quote.totalNgn) } });
      toast.success(`Approved — ${winner?.businessName || partnerCode} supplies ${rec.item}`);
    } else if (action === "received") { logActivity("supply_received", rec.code, rec.item); toast.success(`${rec.code} marked Received — warehouse adjusts stock`); }
    else { logActivity("supply_cancelled", rec.code, rec.item); toast.message(`${rec.code} cancelled`); }
    await load();
  };

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display font-bold uppercase text-2xl mb-1">Supply requests ({requests.length})</h2>
        <p className="font-tech text-[11px] text-muted-foreground max-w-3xl">Buy and hire THROUGH the partner network — the reverse direction of leads and job assignments. Partners quote against each other without ever seeing each other's prices; you approve one quote. Committed spend so far: <span className="text-primary">{formatNGN(spend)}</span> (approved + received). No commission on procurement — these are Oketex purchases.</p>
      </section>

      {canManage && <section className="border hairline bg-card p-5">
        <p className="label-tech mb-4">Raise a supply request</p>
        <div className="grid md:grid-cols-3 gap-4">
          <div><label className="label-tech">Type</label><select className="field-tech bg-background" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as "buy" | "hire" })}><option value="buy">Buy</option><option value="hire">Hire</option></select></div>
          <div className="md:col-span-2"><label className="label-tech">Item / equipment</label><input className="field-tech" value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} placeholder="e.g. Aluminium rain gutter & downpipe" /></div>
          <div className="md:col-span-2"><label className="label-tech">Spec</label><input className="field-tech" value={form.spec} onChange={e => setForm({ ...form, spec: e.target.value })} placeholder="Gauge, colour, standard — what exactly is needed" /></div>
          <div><label className="label-tech">Needed by</label><input type="date" className="field-tech font-tech" value={form.neededBy} onChange={e => setForm({ ...form, neededBy: e.target.value })} /></div>
          <div><label className="label-tech">Quantity</label><input type="number" min={0} className="field-tech font-tech" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} /></div>
          <div><label className="label-tech">Unit</label><input className="field-tech" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="pcs · metres · bags · days (hire)" /></div>
          <div><label className="label-tech">Note</label><input className="field-tech" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Delivery to Ibafo plant…" /></div>
        </div>
        <div className="mt-5">
          <label className="flex items-center gap-2 font-tech text-xs cursor-pointer"><input type="checkbox" checked={form.broadcast} onChange={e => setForm({ ...form, broadcast: e.target.checked })} /> Broadcast to all approved sellers &amp; both-kind partners</label>
          {!form.broadcast && (
            <div className="mt-3">
              <p className="font-tech text-[11px] text-muted-foreground mb-2">Capability matches for “{form.item || "…"}” are pre-highlighted — tick who should receive this request:</p>
              <div className="flex flex-wrap gap-2">
                {partners.filter(p => p.status === "approved" && (p.role === "seller" || p.role === "both")).map(p => {
                  const matched = candidates.some(c => c.code === p.code);
                  const on = targets.includes(p.code);
                  return (<button key={p.code} onClick={() => setTargets(t => on ? t.filter(x => x !== p.code) : [...t, p.code])} className={`font-tech text-[11px] border px-3 py-1.5 cursor-pointer ${on ? "border-primary text-primary" : "hairline text-muted-foreground"}`}>{p.businessName}{matched ? " · capability match" : ""}{on ? " ✓" : ""}</button>);
                })}
                {!partners.some(p => p.status === "approved" && (p.role === "seller" || p.role === "both")) && <span className="font-tech text-[11px] text-amber-400">No approved sellers yet — approve partners in the Partners tab.</span>}
              </div>
            </div>
          )}
        </div>
        <Button className="rounded-none font-display uppercase h-11 mt-5" onClick={() => void create()}>Raise request &amp; notify partners</Button>
      </section>}

      <section className="space-y-4">
        {!requests.length ? <p className="font-tech text-sm text-muted-foreground border hairline p-5">No supply requests yet — the queue starts empty.</p>
        : requests.map(rec => (
          <div key={rec.code} className="border hairline bg-card p-5">
            <div className="flex flex-wrap gap-3 justify-between items-start">
              <div>
                <p className="font-tech font-semibold">{rec.code} — {rec.type === "hire" ? "HIRE" : "BUY"} · {rec.item}</p>
                <p className="font-tech text-[11px] text-muted-foreground mt-1">{rec.qty} {rec.unit}{rec.spec ? ` · ${rec.spec}` : ""}{rec.neededBy ? ` · needed by ${rec.neededBy}` : ""} · raised by {rec.createdBy} · {new Date(rec.createdAt).toLocaleString("en-NG")}{rec.note ? ` · ${rec.note}` : ""}</p>
                <p className="font-tech text-[11px] text-muted-foreground">{rec.targetPartnerCodes.length ? `Targeted: ${rec.targetPartnerCodes.join(", ")}` : "Broadcast to approved sellers"}{rec.chosenPartnerCode ? ` · Chosen: ${rec.chosenPartnerCode} at ${rec.chosenTotalNgn != null ? formatNGN(rec.chosenTotalNgn) : "—"}` : ""}</p>
              </div>
              <span className="font-tech text-[10px] uppercase tracking-widest border hairline px-2 py-0.5">{rec.status}</span>
            </div>
            {rec.quotes.length ? <div className="border hairline mt-4 overflow-x-auto"><table className="w-full text-sm min-w-[620px]">
              <thead><tr className="border-b hairline text-left font-tech text-[10px] uppercase tracking-widest text-muted-foreground"><th className="px-4 py-2.5">Partner</th><th className="px-4 py-2.5">Unit price</th><th className="px-4 py-2.5">Total ({rec.qty} {rec.unit})</th><th className="px-4 py-2.5">Lead time</th><th className="px-4 py-2.5">Note</th><th className="px-4 py-2.5"></th></tr></thead>
              <tbody>{[...rec.quotes].sort((a, b) => a.totalNgn - b.totalNgn).map(q => (
                <tr key={q.partnerCode} className={`border-b hairline last:border-0 ${rec.chosenPartnerCode === q.partnerCode ? "text-primary" : ""}`}>
                  <td className="px-4 py-2.5 font-semibold">{q.partnerName}{rec.chosenPartnerCode === q.partnerCode ? " ✓ chosen" : ""}</td>
                  <td className="px-4 py-2.5 font-tech">{formatNGN(q.unitPriceNgn)}</td>
                  <td className="px-4 py-2.5 font-tech font-semibold">{formatNGN(q.totalNgn)}</td>
                  <td className="px-4 py-2.5 font-tech">{q.leadDays ? `${q.leadDays} day(s)` : "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{q.note || "—"}</td>
                  <td className="px-4 py-2.5">{canManage && ["Open", "Quoted"].includes(rec.status) && <button onClick={() => void act(rec, "approve", q.partnerCode)} className="font-tech text-[11px] border hairline px-2.5 py-1.5 hover:border-primary hover:text-primary cursor-pointer">Approve quote</button>}</td>
                </tr>))}
              </tbody>
            </table></div>
            : <p className="font-tech text-xs text-muted-foreground mt-3">No quotes yet — partners respond from their Partner Status inbox.</p>}
            {canManage && <div className="flex gap-2 mt-4 flex-wrap">
              {rec.status === "Approved" && <Button className="rounded-none font-display uppercase h-10" onClick={() => void act(rec, "received")}>Mark received</Button>}
              {!["Received", "Cancelled"].includes(rec.status) && <button onClick={() => void act(rec, "cancel")} className="font-tech text-[11px] border hairline px-3 py-2 hover:border-destructive hover:text-destructive cursor-pointer">Cancel request</button>}
            </div>}
          </div>
        ))}
      </section>
    </div>
  );
}
