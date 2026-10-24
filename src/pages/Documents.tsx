import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { PageHead } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatNGN } from "@/lib/money";
import {
  NotebookPen, FileText, ScrollText, Receipt, FolderArchive, Plus, Trash2, Copy,
  Printer, Pin, Search, Upload, Download, X, Check, MessageCircle,
} from "lucide-react";
import {
  getDocuments, saveDocuments, getLetterhead, saveLetterhead, getVaultFiles, saveVaultFiles,
  quotationTotals, invoiceTotals, invoiceBalance, invoiceDisplayStatus, milestoneTotalPct,
  newQuotation, newContract, newInvoice, invoiceFromQuotation, emptyLineItem,
  quotationFromSavedQuote, quotationFromEstimate, quotationFromProject,
  LETTERHEAD_MAX_BYTES, VAULT_MAX_BYTES, VAULT_CATEGORIES,
  type DocumentsStore, type DocNote, type DocQuotation, type DocContract, type DocInvoice,
  type Letterhead, type VaultFile, type LineItem,
} from "@/lib/docStorage";
import { getQuotes } from "@/lib/storage";
import PlanGate, { PlanChip } from "@/components/PlanGate";
import { useEntitlements, FREE_DOCUMENT_LIMIT } from "@/lib/plans";
import { getEstimates } from "@/lib/projectEstimator";
import { getProProjects, uid } from "@/lib/proStorage";
import { notify } from "@/lib/notify";

type Tab = "notes" | "quotations" | "contracts" | "invoices" | "files";
const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "quotations", label: "Quotations", icon: FileText },
  { id: "contracts", label: "Contracts", icon: ScrollText },
  { id: "invoices", label: "Invoices", icon: Receipt },
  { id: "files", label: "Letterhead & Files", icon: FolderArchive },
];
const cellCls = "bg-transparent border-b border-input px-1 py-1.5 font-tech text-[13px] w-full focus:outline-none focus:border-primary";
const numCls = cellCls + " text-right";

/** WhatsApp deep link to the CLIENT (normalises Nigerian numbers to intl format). */
export function clientWaLink(phone: string, text: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "234" + d.slice(1);
  const enc = encodeURIComponent(text);
  return d.length >= 10 ? `https://wa.me/${d}?text=${enc}` : `https://wa.me/?text=${enc}`;
}
const readAsDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }); } catch { return iso; } };

/** Letterhead banner used at the top of every printed document. */
export function LetterheadBlock({ lh }: { lh: Letterhead }) {
  return (<div className="border-b-4 border-black pb-4 mb-5">
    {lh.imageDataUrl
      ? <img src={lh.imageDataUrl} alt={lh.companyName} className="max-h-24 w-auto object-contain" />
      : (<div><p className="font-display font-bold uppercase text-3xl tracking-tight" style={{ color: "#FF6026" }}>{lh.companyName}</p>{lh.tagline ? <p className="font-tech text-xs uppercase tracking-widest mt-1">{lh.tagline}</p> : null}</div>)}
    <p className="font-tech text-[11px] mt-2">{[lh.address, lh.phone, lh.email, lh.website].filter(Boolean).join(" · ")}</p>
  </div>);
}
function TotalsRows({ totals, discountType, discountValue, vatPct }: { totals: ReturnType<typeof quotationTotals>; discountType: "flat" | "pct"; discountValue: number; vatPct: number }) {
  return (<div className="ml-auto w-full max-w-xs font-tech text-sm">
    <div className="flex justify-between py-1"><span>Subtotal</span><span>{formatNGN(totals.subtotal)}</span></div>
    {totals.discountAmount > 0 && <div className="flex justify-between py-1"><span>Discount {discountType === "pct" ? `(${discountValue}%)` : ""}</span><span>−{formatNGN(totals.discountAmount)}</span></div>}
    {vatPct > 0 && <div className="flex justify-between py-1"><span>VAT ({vatPct}%)</span><span>{formatNGN(totals.vatAmount)}</span></div>}
    <div className="flex justify-between py-2 border-t-2 border-black font-bold text-base"><span>GRAND TOTAL</span><span>{formatNGN(totals.grandTotal)}</span></div>
  </div>);
}
function ItemsEditor({ items, onChange }: { items: LineItem[]; onChange: (items: LineItem[]) => void }) {
  const patch = (id: string, p: Partial<LineItem>) => onChange(items.map(i => (i.id === id ? { ...i, ...p } : i)));
  return (<div>
    <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]"><thead><tr className="border-b hairline text-left font-tech text-[10px] uppercase tracking-widest text-muted-foreground">
      <th className="py-2 pr-2">Description</th><th className="py-2 pr-2 text-right w-20">Qty</th><th className="py-2 pr-2 w-20">Unit</th><th className="py-2 pr-2 text-right w-32">Unit price (₦)</th><th className="py-2 pr-2 text-right w-28">Amount</th><th className="py-2 w-8"></th></tr></thead>
      <tbody>{items.map(i => (<tr key={i.id} className="border-b hairline align-top">
        <td className="py-1 pr-2"><input className={cellCls} value={i.description} onChange={e => patch(i.id, { description: e.target.value })} placeholder="e.g. Longspan 0.45mm Charcoal, cut to 5.08m" /></td>
        <td className="py-1 pr-2"><input type="number" step="0.01" className={numCls} value={i.qty} onChange={e => patch(i.id, { qty: parseFloat(e.target.value) || 0 })} /></td>
        <td className="py-1 pr-2"><input className={cellCls} value={i.unit} onChange={e => patch(i.id, { unit: e.target.value })} /></td>
        <td className="py-1 pr-2"><input type="number" step="1" className={numCls} value={i.unitPrice} onChange={e => patch(i.id, { unitPrice: parseFloat(e.target.value) || 0 })} /></td>
        <td className="py-2 pr-2 text-right font-tech">{formatNGN(i.qty * i.unitPrice)}</td>
        <td className="py-1"><button onClick={() => onChange(items.filter(x => x.id !== i.id))} className="text-muted-foreground hover:text-destructive cursor-pointer" aria-label="Remove line"><X className="h-4 w-4" /></button></td>
      </tr>))}</tbody></table></div>
    <Button variant="outline" className="rounded-none font-display uppercase text-xs mt-3" onClick={() => onChange([...items, emptyLineItem()])}><Plus className="h-3.5 w-3.5 mr-1" /> Add line</Button>
  </div>);
}
function MoneySettings({ doc, onChange }: { doc: { discountType: "flat" | "pct"; discountValue: number; vatPct: number }; onChange: (p: { discountType: "flat" | "pct"; discountValue: number; vatPct: number }) => void }) {
  return (<div className="grid grid-cols-3 gap-4">
    <div><label className="label-tech">Discount type</label><select value={doc.discountType} onChange={e => onChange({ ...doc, discountType: e.target.value as "flat" | "pct" })} className="field-tech font-tech bg-background w-full"><option value="pct">Percent %</option><option value="flat">Flat ₦</option></select></div>
    <div><label className="label-tech">Discount value</label><input type="number" step="0.1" value={doc.discountValue} onChange={e => onChange({ ...doc, discountValue: parseFloat(e.target.value) || 0 })} className="field-tech font-tech" /></div>
    <div><label className="label-tech">VAT %</label><div className="flex gap-2"><input type="number" step="0.1" value={doc.vatPct} onChange={e => onChange({ ...doc, vatPct: parseFloat(e.target.value) || 0 })} className="field-tech font-tech" /><button onClick={() => onChange({ ...doc, vatPct: 7.5 })} className="font-tech text-[11px] border hairline px-2 hover:border-primary hover:text-primary cursor-pointer shrink-0" title="Nigerian standard VAT">7.5%</button></div></div>
  </div>);
}

export default function Documents() {
  const [store, setStore] = useState<DocumentsStore>(() => getDocuments());
  const [lh, setLh] = useState<Letterhead>(() => getLetterhead());
  const [files, setFiles] = useState<VaultFile[]>(() => getVaultFiles());
  const [tab, setTab] = useState<Tab>("notes");
  const ent = useEntitlements();
  const docCount = store.quotations.length + store.contracts.length + store.invoices.length;
  const limitHit = !ent.isPro && docCount >= FREE_DOCUMENT_LIMIT;
  const update = (fn: (s: DocumentsStore) => DocumentsStore) => setStore(prev => { const next = fn(prev); saveDocuments(next); return next; });
  const updateLh = (next: Letterhead) => { setLh(next); saveLetterhead(next); };
  const updateFiles = (next: VaultFile[]) => { setFiles(next); saveVaultFiles(next); };

  return (<div><PageHead kicker="Pro Documents" title="Notes, quotes, contracts & invoices" lead="Your paperwork office: an engineer's notebook, a quotation creator, a contract writer and digital invoices — all on your letterhead, all stored on this device." />
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="flex flex-wrap gap-3 items-center justify-between mb-8 no-print">
        <div className="flex gap-px bg-border border hairline w-fit flex-wrap">{TABS.map(t => { const Icon = t.icon; return (<button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2.5 font-tech text-xs uppercase tracking-widest cursor-pointer inline-flex items-center gap-2 ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-background hover:text-primary"}`}><Icon className="h-3.5 w-3.5" />{t.label}</button>); })}</div>
        <div className="flex items-center gap-3"><PlanChip />{!ent.isPro && <span className="font-tech text-[11px] text-muted-foreground">Documents used: {docCount} / {FREE_DOCUMENT_LIMIT} on Free (Notes are unlimited)</span>}</div>
      </div>
      {tab === "notes" && <NotesTab store={store} update={update} />}
      {tab === "quotations" && <QuotationsTab store={store} update={update} lh={lh} limitHit={limitHit} goInvoices={(inv) => { if (limitHit) { toast.error("Free plan document limit reached — upgrade to Pro for unlimited documents."); return; } update(s => ({ ...s, invoices: [inv, ...s.invoices] })); setTab("invoices"); toast.success(`Invoice ${inv.code} created from quotation`); }} />}
      {tab === "contracts" && <ContractsTab store={store} update={update} lh={lh} limitHit={limitHit} />}
      {tab === "invoices" && <InvoicesTab store={store} update={update} lh={lh} limitHit={limitHit} />}
      {tab === "files" && (ent.isPro ? <FilesTab lh={lh} updateLh={updateLh} files={files} updateFiles={updateFiles} /> : <PlanGate feature="Letterhead & Document Vault"><FilesTab lh={lh} updateLh={updateLh} files={files} updateFiles={updateFiles} /></PlanGate>)}
      <p className="font-tech text-[11px] text-muted-foreground mt-10 no-print">Everything on this page is stored in this browser only (demo storage) — production cloud documents arrive with the backend. Export important documents with Print / PDF.</p>
    </div></div>);
}

/* ============================== NOTES ============================== */
function NotesTab({ store, update }: { store: DocumentsStore; update: (fn: (s: DocumentsStore) => DocumentsStore) => void }) {
  const projects = useMemo(() => getProProjects(), []);
  const [selId, setSelId] = useState<string>(() => store.notes[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const notes = store.notes.filter(n => (n.title + " " + n.body).toLowerCase().includes(search.toLowerCase()))
    .slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  const sel = store.notes.find(n => n.id === selId) ?? notes[0];
  const patch = (p: Partial<DocNote>) => { if (!sel) return; update(s => ({ ...s, notes: s.notes.map(n => (n.id === sel.id ? { ...n, ...p, updatedAt: new Date().toISOString() } : n)) })); };
  const create = () => { const n: DocNote = { id: uid(), title: "Untitled note", body: "", pinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; update(s => ({ ...s, notes: [n, ...s.notes] })); setSelId(n.id); };
  const remove = () => { if (!sel || !window.confirm(`Delete note "${sel.title}"?`)) return; update(s => ({ ...s, notes: s.notes.filter(n => n.id !== sel.id) })); setSelId(""); };
  return (<div className="grid lg:grid-cols-[320px_1fr] gap-6">
    <div className="no-print">
      <div className="flex gap-2 mb-3"><div className="relative flex-1"><Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes…" className="field-tech font-tech pl-9" /></div><Button className="rounded-none font-display uppercase shrink-0" onClick={create}><Plus className="h-4 w-4 mr-1" /> New</Button></div>
      <div className="border hairline divide-y divide-white/10">{notes.length === 0 && <p className="px-4 py-6 font-tech text-xs text-muted-foreground">No notes match.</p>}{notes.map(n => (<button key={n.id} onClick={() => setSelId(n.id)} className={`w-full text-left px-4 py-3 cursor-pointer ${sel?.id === n.id ? "bg-primary/15 border-l-2 border-l-primary" : "hover:bg-card"}`}>
        <span className="font-display font-semibold uppercase block leading-tight text-sm">{n.pinned && <Pin className="h-3 w-3 inline mr-1 text-primary" />}{n.title || "Untitled"}{n.sample && <span className="ml-2 font-tech text-[9px] border border-primary text-primary px-1.5 py-0.5 align-middle">SAMPLE</span>}</span>
        <span className="font-tech text-[11px] text-muted-foreground block mt-1">{n.projectName ? `${n.projectName} · ` : ""}{fmtDate(n.updatedAt)} · {n.body.length} chars</span>
      </button>))}</div>
    </div>
    {sel ? (<div className="border hairline bg-card p-6">
      <div className="flex flex-wrap gap-2 justify-between items-start no-print">
        <p className="font-tech text-[11px] text-muted-foreground">Created {fmtDate(sel.createdAt)} · last edited {fmtDate(sel.updatedAt)} · auto-saves as you type</p>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-none font-display uppercase text-xs" onClick={() => patch({ pinned: !sel.pinned })}><Pin className="h-3.5 w-3.5 mr-1" />{sel.pinned ? "Unpin" : "Pin"}</Button>
          <Button variant="outline" className="rounded-none font-display uppercase text-xs" onClick={remove}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
        </div>
      </div>
      <input value={sel.title} onChange={e => patch({ title: e.target.value })} placeholder="Note title" className="w-full bg-transparent font-display font-bold uppercase text-2xl mt-3 border-b hairline pb-2 focus:outline-none focus:border-primary" />
      <div className="mt-4 no-print"><label className="label-tech">Linked project (optional)</label><select value={sel.projectId ?? ""} onChange={e => { const p = projects.find(x => x.id === e.target.value); patch({ projectId: p?.id, projectName: p?.name }); }} className="field-tech font-tech bg-background w-full sm:w-80"><option value="">— No project —</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <textarea value={sel.body} onChange={e => patch({ body: e.target.value })} placeholder={"Write measurements, site observations, client instructions, follow-ups…\n\ne.g. Main roof 11.0 x 9.2m, pitch 28 deg. Purlins sound. Client confirmed Charcoal."} className="w-full bg-transparent border hairline mt-4 p-4 font-tech text-sm leading-relaxed min-h-[340px] focus:outline-none focus:border-primary" />
      <p className="font-tech text-[11px] text-muted-foreground mt-2">{sel.body.length} characters</p>
    </div>) : (<div className="border hairline bg-card p-10 text-center font-tech text-sm text-muted-foreground">Create your first note to start your site notebook.</div>)}
  </div>);
}

/* ============================== QUOTATIONS ============================== */
function QuotationsTab({ store, update, lh, goInvoices, limitHit }: { store: DocumentsStore; update: (fn: (s: DocumentsStore) => DocumentsStore) => void; lh: Letterhead; goInvoices: (inv: DocInvoice) => void; limitHit: boolean }) {
  const savedQuotes = useMemo(() => getQuotes(), []);
  const estimates = useMemo(() => getEstimates(), []);
  const projects = useMemo(() => getProProjects(), []);
  const [selId, setSelId] = useState<string>(() => store.quotations[0]?.id ?? "");
  const sel = store.quotations.find(q => q.id === selId) ?? store.quotations[0];
  const patch = (p: Partial<DocQuotation>) => { if (!sel) return; update(s => ({ ...s, quotations: s.quotations.map(q => (q.id === sel.id ? { ...q, ...p, updatedAt: new Date().toISOString() } : q)) })); };
  const [showLock, setShowLock] = useState(false);
  const create = (q?: DocQuotation) => { if (limitHit) { setShowLock(true); return; } const doc = q ?? newQuotation(); update(s => ({ ...s, quotations: [doc, ...s.quotations] })); setSelId(doc.id); toast.success(q ? `Imported as ${doc.code}` : `Quotation ${doc.code} created`); };
  if (showLock) return (<div className="py-4"><PlanGate feature="Unlimited documents"><span /></PlanGate><div className="text-center mt-4"><button onClick={() => setShowLock(false)} className="font-tech text-xs text-muted-foreground hover:text-primary cursor-pointer">← Back to my quotations (viewing is always free)</button></div></div>);
  const totals = sel ? quotationTotals(sel) : null;
  const waText = sel && totals ? `QUOTATION ${sel.code} — ${lh.companyName}\n${sel.title}\nFor: ${sel.clientName}\nItems: ${sel.items.length}\nGrand total: ${formatNGN(totals.grandTotal)}${sel.vatPct ? ` (incl. VAT ${sel.vatPct}%)` : ""}\nValid for ${sel.validityDays} days.\n${lh.phone} · ${lh.email}` : "";
  return (<div>
    <div className="flex flex-wrap gap-3 items-end mb-6 no-print">
      <Button className="rounded-none font-display uppercase" onClick={() => create()}><Plus className="h-4 w-4 mr-1" /> New quotation</Button>
      <div><label className="label-tech">Import from saved quote</label><select defaultValue="" onChange={e => { if (e.target.value) { const q = quotationFromSavedQuote(e.target.value); if (q) create(q); e.target.value = ""; } }} className="field-tech font-tech bg-background w-full"><option value="">Choose a QT-… quote…</option>{savedQuotes.map(q => <option key={q.code} value={q.code}>{q.code} — {q.roofType} ({formatNGN(q.estimateNgn)})</option>)}</select></div>
      <div><label className="label-tech">Import from estimate</label><select defaultValue="" onChange={e => { if (e.target.value) { const q = quotationFromEstimate(e.target.value); if (q) create(q); e.target.value = ""; } }} className="field-tech font-tech bg-background w-full"><option value="">Choose an EST-… estimate…</option>{estimates.map(e2 => <option key={e2.code} value={e2.code}>{e2.code} — {e2.styleName} ({formatNGN(e2.pricedTotal)})</option>)}</select></div>
      <div><label className="label-tech">Import from workspace project</label><select defaultValue="" onChange={e => { if (e.target.value) { const q = quotationFromProject(e.target.value); if (q) create(q); e.target.value = ""; } }} className="field-tech font-tech bg-background w-full"><option value="">Choose a project…</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
    </div>
    <div className="grid lg:grid-cols-[300px_1fr] gap-6">
      <div className="no-print"><div className="border hairline divide-y divide-white/10">{store.quotations.length === 0 && <p className="px-4 py-6 font-tech text-xs text-muted-foreground">No quotations yet — create one or import a saved quote, estimate or project.</p>}{store.quotations.map(q => { const t = quotationTotals(q); return (<div key={q.id} className={`px-4 py-3 ${sel?.id === q.id ? "bg-primary/15 border-l-2 border-l-primary" : ""}`}>
        <button onClick={() => setSelId(q.id)} className="w-full text-left cursor-pointer"><span className="font-tech font-semibold block">{q.code}</span><span className="font-display font-semibold uppercase block leading-tight text-sm">{q.title}</span><span className="font-tech text-[11px] text-muted-foreground block mt-1">{q.clientName || "No client"} · {formatNGN(t.grandTotal)} · {fmtDate(q.updatedAt)}</span></button>
        <div className="flex gap-2 mt-2">
          <button onClick={() => { const copy = { ...q, id: uid(), code: newQuotation().code, title: q.title + " (copy)", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), items: q.items.map(i => ({ ...i, id: uid() })) }; update(s => ({ ...s, quotations: [copy, ...s.quotations] })); setSelId(copy.id); }} className="font-tech text-[11px] border hairline px-2 py-1 hover:border-primary hover:text-primary cursor-pointer inline-flex items-center gap-1"><Copy className="h-3 w-3" /> Duplicate</button>
          <button onClick={() => goInvoices(invoiceFromQuotation(q))} className="font-tech text-[11px] border hairline px-2 py-1 hover:border-primary hover:text-primary cursor-pointer inline-flex items-center gap-1"><Receipt className="h-3 w-3" /> To invoice</button>
          <button onClick={() => { if (window.confirm(`Delete quotation ${q.code}?`)) update(s => ({ ...s, quotations: s.quotations.filter(x => x.id !== q.id) })); }} className="font-tech text-[11px] border hairline px-2 py-1 hover:border-destructive hover:text-destructive cursor-pointer inline-flex items-center gap-1"><Trash2 className="h-3 w-3" /> Delete</button>
        </div></div>); })}</div></div>
      {sel && totals ? (<div className="space-y-6">
        <div className="border hairline bg-card p-6 no-print">
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label-tech">Quote title</label><input value={sel.title} onChange={e => patch({ title: e.target.value })} className="field-tech font-tech" /></div>
            <div><label className="label-tech">Validity (days)</label><input type="number" value={sel.validityDays} onChange={e => patch({ validityDays: parseInt(e.target.value) || 0 })} className="field-tech font-tech" /></div>
            <div><label className="label-tech">Client name</label><input value={sel.clientName} onChange={e => patch({ clientName: e.target.value })} className="field-tech font-tech" /></div>
            <div><label className="label-tech">Client phone</label><input value={sel.clientPhone} onChange={e => patch({ clientPhone: e.target.value })} className="field-tech font-tech" placeholder="0803…" /></div>
            <div className="sm:col-span-2"><label className="label-tech">Client address</label><input value={sel.clientAddress} onChange={e => patch({ clientAddress: e.target.value })} className="field-tech font-tech" /></div>
          </div>
          <div className="mt-5"><ItemsEditor items={sel.items} onChange={items => patch({ items })} /></div>
          <div className="mt-5"><MoneySettings doc={sel} onChange={p => patch(p)} /></div>
          <div className="mt-5"><label className="label-tech">Notes / terms printed on the quotation</label><textarea value={sel.terms} onChange={e => patch({ terms: e.target.value })} className="field-tech font-tech min-h-[90px]" /></div>
          <div className="flex flex-wrap gap-3 mt-6">
            <Button className="rounded-none font-display uppercase" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Print / PDF</Button>
            <Button variant="outline" className="rounded-none font-display uppercase" asChild><a target="_blank" rel="noreferrer" href={clientWaLink(sel.clientPhone, waText)}><MessageCircle className="h-4 w-4 mr-2" /> WhatsApp client</a></Button>
            <Button variant="outline" className="rounded-none font-display uppercase" onClick={() => goInvoices(invoiceFromQuotation(sel))}><Receipt className="h-4 w-4 mr-2" /> Convert to invoice</Button>
          </div>
          <p className="font-tech text-[11px] text-muted-foreground mt-3">Saved automatically as {sel.code}{sel.source ? ` · Source: ${sel.source}` : ""}. Company details come from your letterhead (Letterhead &amp; Files tab).</p>
        </div>
        {/* A4 preview */}
        <div className="print-boq bg-white text-black p-8 sm:p-10 shadow-xl mx-auto max-w-[820px]">
          <LetterheadBlock lh={lh} />
          <div className="flex flex-wrap justify-between gap-4">
            <div><h3 className="font-display font-bold uppercase text-2xl">Quotation</h3><p className="font-tech text-xs mt-1">Ref: {sel.code} · Date: {fmtDate(sel.createdAt)} · Valid for {sel.validityDays} days</p></div>
            <div className="font-tech text-xs text-right"><p className="uppercase tracking-widest text-[10px]">Prepared for</p><p className="font-bold text-sm mt-1">{sel.clientName || "—"}</p><p>{sel.clientPhone}</p><p className="max-w-[240px]">{sel.clientAddress}</p></div>
          </div>
          <p className="font-display font-semibold uppercase mt-5">{sel.title}</p>
          <table className="w-full text-sm mt-3 border-collapse">
            <thead><tr className="border-y-2 border-black font-tech text-[11px] uppercase tracking-widest text-left"><th className="py-2 pr-2 w-8">#</th><th className="py-2 pr-2">Description</th><th className="py-2 pr-2 text-right">Qty</th><th className="py-2 pr-2">Unit</th><th className="py-2 pr-2 text-right">Unit price</th><th className="py-2 text-right">Amount</th></tr></thead>
            <tbody>{sel.items.map((i, ix) => (<tr key={i.id} className="border-b border-neutral-300"><td className="py-2 pr-2">{ix + 1}</td><td className="py-2 pr-2">{i.description}</td><td className="py-2 pr-2 text-right font-tech">{i.qty}</td><td className="py-2 pr-2 font-tech">{i.unit}</td><td className="py-2 pr-2 text-right font-tech">{formatNGN(i.unitPrice)}</td><td className="py-2 text-right font-tech">{formatNGN(i.qty * i.unitPrice)}</td></tr>))}</tbody>
          </table>
          <div className="mt-4"><TotalsRows totals={totals} discountType={sel.discountType} discountValue={sel.discountValue} vatPct={sel.vatPct} /></div>
          {sel.terms && <div className="mt-6"><p className="font-tech text-[10px] uppercase tracking-widest">Terms &amp; notes</p><p className="text-xs whitespace-pre-line mt-1">{sel.terms}</p></div>}
          <div className="mt-10 flex justify-between font-tech text-xs"><p>Prepared by: {lh.companyName}</p><p>Signature: ______________________</p></div>
        </div>
      </div>) : (<div className="border hairline bg-card p-10 text-center font-tech text-sm text-muted-foreground">No quotation selected.</div>)}
    </div></div>);
}

/* ============================== CONTRACTS ============================== */
function ContractsTab({ store, update, lh, limitHit }: { store: DocumentsStore; update: (fn: (s: DocumentsStore) => DocumentsStore) => void; lh: Letterhead; limitHit: boolean }) {
  const [selId, setSelId] = useState<string>(() => store.contracts[0]?.id ?? "");
  const sel = store.contracts.find(c => c.id === selId) ?? store.contracts[0];
  const patch = (p: Partial<DocContract>) => { if (!sel) return; update(s => ({ ...s, contracts: s.contracts.map(c => (c.id === sel.id ? { ...c, ...p, updatedAt: new Date().toISOString() } : c)) })); };
  const [showLock, setShowLock] = useState(false);
  const create = () => { if (limitHit) { setShowLock(true); return; } const doc = newContract(); update(s => ({ ...s, contracts: [doc, ...s.contracts] })); setSelId(doc.id); toast.success(`Contract ${doc.code} created`); };
  if (showLock) return (<div className="py-4"><PlanGate feature="Unlimited documents"><span /></PlanGate><div className="text-center mt-4"><button onClick={() => setShowLock(false)} className="font-tech text-xs text-muted-foreground hover:text-primary cursor-pointer">← Back to my contracts (viewing is always free)</button></div></div>);
  const pctSum = sel ? milestoneTotalPct(sel.milestones) : 0;
  const linkQuote = (code: string) => { const q = store.quotations.find(x => x.code === code); if (!q || !sel) return; patch({ quotationCode: q.code, contractSum: Math.round(quotationTotals(q).grandTotal), title: sel.title || q.title, clientName: sel.clientName || q.clientName, clientPhone: sel.clientPhone || q.clientPhone, clientAddress: sel.clientAddress || q.clientAddress }); toast.success(`Linked ${q.code} — sum pulled from its grand total`); };
  return (<div>
    <div className="flex flex-wrap gap-3 items-center mb-6 no-print"><Button className="rounded-none font-display uppercase" onClick={create}><Plus className="h-4 w-4 mr-1" /> New contract</Button>
      <p className="font-tech text-[11px] text-amber-500 border border-amber-500/50 px-3 py-2 max-w-xl">Template only — this contract writer produces a standard-form draft, not legal advice. Have a lawyer review it before relying on it for a major job.</p></div>
    <div className="grid lg:grid-cols-[300px_1fr] gap-6">
      <div className="no-print"><div className="border hairline divide-y divide-white/10">{store.contracts.length === 0 && <p className="px-4 py-6 font-tech text-xs text-muted-foreground">No contracts yet.</p>}{store.contracts.map(c => (<div key={c.id} className={`px-4 py-3 ${sel?.id === c.id ? "bg-primary/15 border-l-2 border-l-primary" : ""}`}>
        <button onClick={() => setSelId(c.id)} className="w-full text-left cursor-pointer"><span className="font-tech font-semibold block">{c.code}</span><span className="font-display font-semibold uppercase block leading-tight text-sm">{c.title || "Untitled contract"}</span><span className="font-tech text-[11px] text-muted-foreground block mt-1">{c.clientName || "No client"} · {formatNGN(c.contractSum)} · {fmtDate(c.updatedAt)}</span></button>
        <div className="flex gap-2 mt-2"><button onClick={() => { if (window.confirm(`Delete contract ${c.code}?`)) update(s => ({ ...s, contracts: s.contracts.filter(x => x.id !== c.id) })); }} className="font-tech text-[11px] border hairline px-2 py-1 hover:border-destructive hover:text-destructive cursor-pointer inline-flex items-center gap-1"><Trash2 className="h-3 w-3" /> Delete</button></div></div>))}</div></div>
      {sel ? (<div className="space-y-6">
        <div className="border hairline bg-card p-6 no-print">
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label-tech">Project title</label><input value={sel.title} onChange={e => patch({ title: e.target.value })} className="field-tech font-tech" placeholder="e.g. Roofing of 4-bedroom duplex" /></div>
            <div><label className="label-tech">Site address</label><input value={sel.siteAddress} onChange={e => patch({ siteAddress: e.target.value })} className="field-tech font-tech" /></div>
            <div><label className="label-tech">Client name</label><input value={sel.clientName} onChange={e => patch({ clientName: e.target.value })} className="field-tech font-tech" /></div>
            <div><label className="label-tech">Client phone</label><input value={sel.clientPhone} onChange={e => patch({ clientPhone: e.target.value })} className="field-tech font-tech" /></div>
            <div className="sm:col-span-2"><label className="label-tech">Client address</label><input value={sel.clientAddress} onChange={e => patch({ clientAddress: e.target.value })} className="field-tech font-tech" /></div>
            <div><label className="label-tech">Link a saved quotation (pulls its grand total)</label><select value={sel.quotationCode ?? ""} onChange={e => linkQuote(e.target.value)} className="field-tech font-tech bg-background w-full"><option value="">— None —</option>{store.quotations.map(q => <option key={q.code} value={q.code}>{q.code} — {q.title} ({formatNGN(quotationTotals(q).grandTotal)})</option>)}</select></div>
            <div><label className="label-tech">Contract sum (₦)</label><input type="number" value={sel.contractSum} onChange={e => patch({ contractSum: parseFloat(e.target.value) || 0 })} className="field-tech font-tech" /></div>
            <div><label className="label-tech">Start date</label><input type="date" value={sel.startDate} onChange={e => patch({ startDate: e.target.value })} className="field-tech font-tech" /></div>
            <div><label className="label-tech">Duration</label><input value={sel.duration} onChange={e => patch({ duration: e.target.value })} className="field-tech font-tech" placeholder="e.g. 3 weeks from start / materials on site" /></div>
            <div><label className="label-tech">Warranty (months)</label><input type="number" value={sel.warrantyMonths} onChange={e => patch({ warrantyMonths: parseInt(e.target.value) || 0 })} className="field-tech font-tech" /></div>
          </div>
          <div className="mt-5"><label className="label-tech">Scope of work</label><textarea value={sel.scope} onChange={e => patch({ scope: e.target.value })} className="field-tech font-tech min-h-[110px]" /></div>
          <div className="mt-6"><p className="label-tech mb-2">Payment schedule (milestones)</p>
            {sel.milestones.map(m => (<div key={m.id} className="flex gap-2 mb-2"><input value={m.label} onChange={e => patch({ milestones: sel.milestones.map(x => (x.id === m.id ? { ...x, label: e.target.value } : x)) })} className="field-tech font-tech flex-1" placeholder="Milestone label" /><input type="number" value={m.pct} onChange={e => patch({ milestones: sel.milestones.map(x => (x.id === m.id ? { ...x, pct: parseFloat(e.target.value) || 0 } : x)) })} className="field-tech font-tech w-24 text-right" aria-label="Percent" /><span className="font-tech text-sm self-center w-28 text-right">{formatNGN((sel.contractSum * m.pct) / 100)}</span><button onClick={() => patch({ milestones: sel.milestones.filter(x => x.id !== m.id) })} className="text-muted-foreground hover:text-destructive cursor-pointer" aria-label="Remove milestone"><X className="h-4 w-4" /></button></div>))}
            <div className="flex items-center gap-3 mt-2"><Button variant="outline" className="rounded-none font-display uppercase text-xs" onClick={() => patch({ milestones: [...sel.milestones, { id: uid(), label: "", pct: 0 }] })}><Plus className="h-3.5 w-3.5 mr-1" /> Add milestone</Button>
            {pctSum !== 100 && <p className="font-tech text-xs text-amber-500 border border-amber-500/50 px-3 py-1.5">Milestones add up to {pctSum}% — they should total 100%.</p>}
            {pctSum === 100 && <p className="font-tech text-xs text-emerald-500 inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Milestones total 100%</p>}</div></div>
          <div className="mt-6"><p className="label-tech mb-2">Clauses (editable standard terms)</p>
            {sel.clauses.map((c, ix) => (<div key={c.id} className="border hairline p-4 mb-3"><div className="flex gap-2 items-center"><span className="font-tech text-xs text-muted-foreground">{ix + 1}.</span><input value={c.title} onChange={e => patch({ clauses: sel.clauses.map(x => (x.id === c.id ? { ...x, title: e.target.value } : x)) })} className="field-tech font-tech flex-1" /><button onClick={() => patch({ clauses: sel.clauses.filter(x => x.id !== c.id) })} className="text-muted-foreground hover:text-destructive cursor-pointer" aria-label="Remove clause"><X className="h-4 w-4" /></button></div>
            <textarea value={c.body} onChange={e => patch({ clauses: sel.clauses.map(x => (x.id === c.id ? { ...x, body: e.target.value } : x)) })} className="field-tech font-tech min-h-[70px] mt-2" /></div>))}
            <Button variant="outline" className="rounded-none font-display uppercase text-xs" onClick={() => patch({ clauses: [...sel.clauses, { id: uid(), title: "New clause", body: "" }] })}><Plus className="h-3.5 w-3.5 mr-1" /> Add clause</Button></div>
          <div className="flex flex-wrap gap-3 mt-6"><Button className="rounded-none font-display uppercase" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Print / PDF contract</Button></div>
          <p className="font-tech text-[11px] text-muted-foreground mt-3">Contractor details come from your letterhead (Letterhead &amp; Files tab). Saved automatically as {sel.code}.</p>
        </div>
        {/* A4 preview */}
        <div className="print-boq bg-white text-black p-8 sm:p-10 shadow-xl mx-auto max-w-[820px]">
          <LetterheadBlock lh={lh} />
          <h3 className="font-display font-bold uppercase text-2xl text-center">Building Works Contract</h3>
          <p className="font-tech text-xs text-center mt-1">Ref: {sel.code}{sel.quotationCode ? ` · Based on quotation ${sel.quotationCode}` : ""}</p>
          <p className="text-sm mt-6">This contract is made between <b>{lh.companyName}</b> of {lh.address} (the &ldquo;Contractor&rdquo;) and <b>{sel.clientName || "___________"}</b>{sel.clientAddress ? ` of ${sel.clientAddress}` : ""}{sel.clientPhone ? ` (phone: ${sel.clientPhone})` : ""} (the &ldquo;Client&rdquo;), for the works described below.</p>
          <table className="w-full text-sm mt-5 border-collapse">
            <tbody className="font-tech">
              <tr className="border-b border-neutral-300"><td className="py-2 pr-3 uppercase text-[11px] tracking-widest w-44">Project</td><td className="py-2">{sel.title}</td></tr>
              <tr className="border-b border-neutral-300"><td className="py-2 pr-3 uppercase text-[11px] tracking-widest">Site address</td><td className="py-2">{sel.siteAddress}</td></tr>
              <tr className="border-b border-neutral-300"><td className="py-2 pr-3 uppercase text-[11px] tracking-widest">Contract sum</td><td className="py-2 font-bold">{formatNGN(sel.contractSum)}</td></tr>
              <tr className="border-b border-neutral-300"><td className="py-2 pr-3 uppercase text-[11px] tracking-widest">Start date</td><td className="py-2">{sel.startDate ? fmtDate(sel.startDate) : "—"}</td></tr>
              <tr className="border-b border-neutral-300"><td className="py-2 pr-3 uppercase text-[11px] tracking-widest">Duration</td><td className="py-2">{sel.duration}</td></tr>
              <tr className="border-b border-neutral-300"><td className="py-2 pr-3 uppercase text-[11px] tracking-widest">Warranty period</td><td className="py-2">{sel.warrantyMonths} months from practical completion</td></tr>
            </tbody>
          </table>
          <h4 className="font-display font-bold uppercase mt-7">1. Scope of Work</h4><p className="text-sm whitespace-pre-line mt-2">{sel.scope}</p>
          <h4 className="font-display font-bold uppercase mt-7">2. Payment Schedule</h4>
          <table className="w-full text-sm mt-2 border-collapse"><thead><tr className="border-y-2 border-black font-tech text-[11px] uppercase tracking-widest text-left"><th className="py-2 pr-2">Milestone</th><th className="py-2 pr-2 text-right">%</th><th className="py-2 text-right">Amount</th></tr></thead>
          <tbody>{sel.milestones.map(m => (<tr key={m.id} className="border-b border-neutral-300"><td className="py-2 pr-2">{m.label}</td><td className="py-2 pr-2 text-right font-tech">{m.pct}%</td><td className="py-2 text-right font-tech">{formatNGN((sel.contractSum * m.pct) / 100)}</td></tr>))}</tbody></table>
          {sel.clauses.map((c, ix) => (<div key={c.id} className="mt-6"><h4 className="font-display font-bold uppercase">{ix + 3}. {c.title}</h4><p className="text-sm whitespace-pre-line mt-2">{c.body}</p></div>))}
          <div className="grid grid-cols-2 gap-8 mt-12 font-tech text-xs">
            <div><p className="uppercase tracking-widest">For the Contractor</p><p className="mt-8 border-t border-black pt-2">{lh.companyName}</p><p className="mt-6">Signature: ______________________</p><p className="mt-4">Name / Date: ______________________</p></div>
            <div><p className="uppercase tracking-widest">For the Client</p><p className="mt-8 border-t border-black pt-2">{sel.clientName || "Client"}</p><p className="mt-6">Signature: ______________________</p><p className="mt-4">Name / Date: ______________________</p></div>
            <div><p className="uppercase tracking-widest">Witness 1</p><p className="mt-8">Signature: ______________________</p><p className="mt-4">Name / Date: ______________________</p></div>
            <div><p className="uppercase tracking-widest">Witness 2</p><p className="mt-8">Signature: ______________________</p><p className="mt-4">Name / Date: ______________________</p></div>
          </div>
          <p className="font-tech text-[10px] mt-10 text-neutral-500">Template document generated with the Oketex Pro Documents contract writer. It is a standard-form draft, not legal advice — both parties should read it fully and have it reviewed before signing where the job value is significant.</p>
        </div>
      </div>) : (<div className="border hairline bg-card p-10 text-center font-tech text-sm text-muted-foreground">No contract selected.</div>)}
    </div></div>);
}

/* ============================== INVOICES ============================== */
const STATUS_STYLES: Record<string, string> = {
  Draft: "border-neutral-400 text-neutral-500", Sent: "border-sky-500 text-sky-500",
  "Part Paid": "border-amber-500 text-amber-500", Paid: "border-emerald-500 text-emerald-500",
  Overdue: "border-red-500 text-red-500",
};
export function StatusChip({ status }: { status: string }) {
  return <span className={`font-tech text-[10px] uppercase tracking-widest border px-2 py-0.5 ${STATUS_STYLES[status] ?? STATUS_STYLES.Draft}`}>{status}</span>;
}
function InvoicesTab({ store, update, lh, limitHit }: { store: DocumentsStore; update: (fn: (s: DocumentsStore) => DocumentsStore) => void; lh: Letterhead; limitHit: boolean }) {
  const [selId, setSelId] = useState<string>(() => store.invoices[0]?.id ?? "");
  const [payAmt, setPayAmt] = useState("");
  const sel = store.invoices.find(i => i.id === selId) ?? store.invoices[0];
  const patch = (p: Partial<DocInvoice>) => { if (!sel) return; update(s => ({ ...s, invoices: s.invoices.map(i => (i.id === sel.id ? { ...i, ...p, updatedAt: new Date().toISOString() } : i)) })); };
  const [showLock, setShowLock] = useState(false);
  const create = () => { if (limitHit) { setShowLock(true); return; } const doc = newInvoice(); update(s => ({ ...s, invoices: [doc, ...s.invoices] })); setSelId(doc.id); toast.success(`Invoice ${doc.code} created`); };
  if (showLock) return (<div className="py-4"><PlanGate feature="Unlimited documents"><span /></PlanGate><div className="text-center mt-4"><button onClick={() => setShowLock(false)} className="font-tech text-xs text-muted-foreground hover:text-primary cursor-pointer">← Back to my invoices (viewing is always free)</button></div></div>);
  const totals = sel ? invoiceTotals(sel) : null;
  const balance = sel ? invoiceBalance(sel) : 0;
  const display = sel ? invoiceDisplayStatus(sel) : "Draft";
  const waText = sel && totals ? `INVOICE ${sel.code} — ${lh.companyName}\n${sel.title}\nItems: ${sel.items.length}\nTotal: ${formatNGN(totals.grandTotal)}\nPaid so far: ${formatNGN(sel.amountPaid)}\nBALANCE DUE: ${formatNGN(balance)}\nDue date: ${fmtDate(sel.dueDate)}${lh.bankName ? `\n\nPlease pay to:\nBank: ${lh.bankName}\nAccount: ${lh.bankAccount}\nName: ${lh.bankAccountName}` : ""}\nThank you.` : "";
  const recordPayment = () => { const amt = parseFloat(payAmt) || 0; if (!sel || amt <= 0) return; const paid = Math.min((sel.amountPaid || 0) + amt, totals?.grandTotal ?? amt); patch({ amountPaid: paid }); setPayAmt(""); toast.success(`Payment of ${formatNGN(amt)} recorded — balance ${formatNGN(Math.max(0, (totals?.grandTotal ?? 0) - paid))}`); };
  return (<div>
    <div className="flex flex-wrap gap-3 items-center mb-6 no-print"><Button className="rounded-none font-display uppercase" onClick={create}><Plus className="h-4 w-4 mr-1" /> New invoice</Button>
      <p className="font-tech text-[11px] text-muted-foreground">Tip: any saved quotation converts to an invoice in one tap (Quotations tab → “To invoice”).</p></div>
    <div className="grid lg:grid-cols-[300px_1fr] gap-6">
      <div className="no-print"><div className="border hairline divide-y divide-white/10">{store.invoices.length === 0 && <p className="px-4 py-6 font-tech text-xs text-muted-foreground">No invoices yet.</p>}{store.invoices.map(inv => { const t = invoiceTotals(inv); const st = invoiceDisplayStatus(inv); return (<div key={inv.id} className={`px-4 py-3 ${sel?.id === inv.id ? "bg-primary/15 border-l-2 border-l-primary" : ""}`}>
        <button onClick={() => setSelId(inv.id)} className="w-full text-left cursor-pointer"><span className="font-tech font-semibold">{inv.code}</span> <StatusChip status={st} /><span className="font-display font-semibold uppercase block leading-tight text-sm mt-1">{inv.title}</span><span className="font-tech text-[11px] text-muted-foreground block mt-1">{inv.clientName || "No client"} · Total {formatNGN(t.grandTotal)} · Balance {formatNGN(invoiceBalance(inv))}</span></button>
        <div className="flex gap-2 mt-2"><button onClick={() => { if (window.confirm(`Delete invoice ${inv.code}?`)) update(s => ({ ...s, invoices: s.invoices.filter(x => x.id !== inv.id) })); }} className="font-tech text-[11px] border hairline px-2 py-1 hover:border-destructive hover:text-destructive cursor-pointer inline-flex items-center gap-1"><Trash2 className="h-3 w-3" /> Delete</button></div></div>); })}</div></div>
      {sel && totals ? (<div className="space-y-6">
        <div className="border hairline bg-card p-6 no-print">
          <div className="flex flex-wrap gap-3 items-center justify-between"><p className="font-tech text-sm">Status: <StatusChip status={display} /></p>
            <div className="flex flex-wrap gap-2">
              {sel.status !== "Sent" && display !== "Paid" && <Button variant="outline" className="rounded-none font-display uppercase text-xs" onClick={() => { patch({ status: "Sent" }); notify({ templateKey: "invoice_sent", audience: "customer", refCode: sel.code, phone: sel.clientPhone, vars: { name: sel.clientName || "Customer", total: formatNGN(invoiceTotals(sel).grandTotal), balance: formatNGN(invoiceBalance(sel)), due: fmtDate(sel.dueDate) } }); }}>Mark as sent</Button>}
              <Button variant="outline" className="rounded-none font-display uppercase text-xs" asChild><a target="_blank" rel="noreferrer" href={clientWaLink(sel.clientPhone, waText)}><MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp client</a></Button>
              <Button className="rounded-none font-display uppercase text-xs" onClick={() => window.print()}><Printer className="h-3.5 w-3.5 mr-1" /> Print / PDF</Button>
            </div></div>
          <div className="grid sm:grid-cols-2 gap-4 mt-5">
            <div><label className="label-tech">Invoice title</label><input value={sel.title} onChange={e => patch({ title: e.target.value })} className="field-tech font-tech" /></div>
            <div><label className="label-tech">Client name</label><input value={sel.clientName} onChange={e => patch({ clientName: e.target.value })} className="field-tech font-tech" /></div>
            <div><label className="label-tech">Client phone (WhatsApp)</label><input value={sel.clientPhone} onChange={e => patch({ clientPhone: e.target.value })} className="field-tech font-tech" placeholder="0803…" /></div>
            <div><label className="label-tech">Client address</label><input value={sel.clientAddress} onChange={e => patch({ clientAddress: e.target.value })} className="field-tech font-tech" /></div>
            <div><label className="label-tech">Issue date</label><input type="date" value={sel.issueDate} onChange={e => patch({ issueDate: e.target.value })} className="field-tech font-tech" /></div>
            <div><label className="label-tech">Due date</label><input type="date" value={sel.dueDate} onChange={e => patch({ dueDate: e.target.value })} className="field-tech font-tech" /></div>
          </div>
          <div className="mt-5"><ItemsEditor items={sel.items} onChange={items => patch({ items })} /></div>
          <div className="mt-5"><MoneySettings doc={sel} onChange={p => patch(p)} /></div>
          <div className="mt-5 border hairline p-4">
            <p className="label-tech mb-2">Payments received</p>
            <div className="flex flex-wrap gap-4 items-end">
              <p className="font-tech text-sm">Paid so far: <b className="text-primary">{formatNGN(sel.amountPaid)}</b> · Balance due: <b>{formatNGN(balance)}</b> of {formatNGN(totals.grandTotal)}</p>
              <div className="flex gap-2"><input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)} placeholder="Amount received ₦" className="field-tech font-tech w-44" aria-label="Payment amount" /><Button variant="outline" className="rounded-none font-display uppercase text-xs" onClick={recordPayment}>Record payment</Button></div>
            </div>
          </div>
          <div className="mt-5"><label className="label-tech">Notes printed on the invoice</label><textarea value={sel.notes} onChange={e => patch({ notes: e.target.value })} className="field-tech font-tech min-h-[70px]" placeholder="e.g. Thank you for your business. Materials warranty as per contract." /></div>
          <p className="font-tech text-[11px] text-muted-foreground mt-3">Payment bank details print from your letterhead settings (Letterhead &amp; Files tab). Saved automatically as {sel.code}{sel.quotationCode ? ` · From quotation ${sel.quotationCode}` : ""}.</p>
        </div>
        {/* A4 preview */}
        <div className="print-boq bg-white text-black p-8 sm:p-10 shadow-xl mx-auto max-w-[820px]">
          <LetterheadBlock lh={lh} />
          <div className="flex flex-wrap justify-between gap-4">
            <div><h3 className="font-display font-bold uppercase text-2xl">Invoice</h3><p className="font-tech text-xs mt-1">Ref: {sel.code} · Issued: {fmtDate(sel.issueDate)} · Due: {fmtDate(sel.dueDate)}</p><p className="mt-2"><span className={`font-tech text-[10px] uppercase tracking-widest border px-2 py-0.5 ${STATUS_STYLES[display]}`}>{display}</span></p></div>
            <div className="font-tech text-xs text-right"><p className="uppercase tracking-widest text-[10px]">Billed to</p><p className="font-bold text-sm mt-1">{sel.clientName || "—"}</p><p>{sel.clientPhone}</p><p className="max-w-[240px]">{sel.clientAddress}</p></div>
          </div>
          <p className="font-display font-semibold uppercase mt-5">{sel.title}</p>
          <table className="w-full text-sm mt-3 border-collapse">
            <thead><tr className="border-y-2 border-black font-tech text-[11px] uppercase tracking-widest text-left"><th className="py-2 pr-2 w-8">#</th><th className="py-2 pr-2">Description</th><th className="py-2 pr-2 text-right">Qty</th><th className="py-2 pr-2">Unit</th><th className="py-2 pr-2 text-right">Unit price</th><th className="py-2 text-right">Amount</th></tr></thead>
            <tbody>{sel.items.map((i, ix) => (<tr key={i.id} className="border-b border-neutral-300"><td className="py-2 pr-2">{ix + 1}</td><td className="py-2 pr-2">{i.description}</td><td className="py-2 pr-2 text-right font-tech">{i.qty}</td><td className="py-2 pr-2 font-tech">{i.unit}</td><td className="py-2 pr-2 text-right font-tech">{formatNGN(i.unitPrice)}</td><td className="py-2 text-right font-tech">{formatNGN(i.qty * i.unitPrice)}</td></tr>))}</tbody>
          </table>
          <div className="mt-4"><TotalsRows totals={totals} discountType={sel.discountType} discountValue={sel.discountValue} vatPct={sel.vatPct} />
            <div className="ml-auto w-full max-w-xs font-tech text-sm">
              <div className="flex justify-between py-1"><span>Amount paid</span><span>{formatNGN(sel.amountPaid)}</span></div>
              <div className="flex justify-between py-2 border-t-2 border-black font-bold text-base"><span>BALANCE DUE</span><span>{formatNGN(balance)}</span></div>
            </div></div>
          <div className="mt-6 border-2 border-black p-4 font-tech text-xs max-w-md"><p className="uppercase tracking-widest text-[10px] mb-1">Payment details</p>
            {lh.bankName ? <p>Bank: <b>{lh.bankName}</b><br />Account number: <b>{lh.bankAccount}</b><br />Account name: <b>{lh.bankAccountName}</b></p>
            : <p>Please contact {lh.companyName} ({lh.phone}) for payment details.</p>}</div>
          {sel.notes && <p className="text-xs whitespace-pre-line mt-5">{sel.notes}</p>}
          <div className="mt-10 flex justify-between font-tech text-xs"><p>Issued by: {lh.companyName}</p><p>Signature: ______________________</p></div>
        </div>
      </div>) : (<div className="border hairline bg-card p-10 text-center font-tech text-sm text-muted-foreground">No invoice selected.</div>)}
    </div></div>);
}

/* ============================== LETTERHEAD & FILES ============================== */
function FilesTab({ lh, updateLh, files, updateFiles }: { lh: Letterhead; updateLh: (l: Letterhead) => void; files: VaultFile[]; updateFiles: (f: VaultFile[]) => void }) {
  const [vaultName, setVaultName] = useState("");
  const [vaultCat, setVaultCat] = useState<VaultFile["category"]>("Other");
  const set = (p: Partial<Letterhead>) => updateLh({ ...lh, ...p });
  const onLetterheadImage = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > LETTERHEAD_MAX_BYTES) { toast.error(`Letterhead image is ${(f.size / 1048576).toFixed(1)}MB — the limit is 1.5MB. Please compress it first.`); return; }
    set({ imageDataUrl: await readAsDataUrl(f) }); toast.success("Letterhead image saved");
  };
  const onVaultFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > VAULT_MAX_BYTES) { toast.error(`"${f.name}" is ${(f.size / 1048576).toFixed(1)}MB — the vault limit is 2MB per file in this demo.`); return; }
    const dataUrl = await readAsDataUrl(f);
    const rec: VaultFile = { id: uid(), name: vaultName.trim() || f.name, category: vaultCat, mime: f.type || "application/octet-stream", dataUrl, sizeKb: Math.round(f.size / 1024), createdAt: new Date().toISOString() };
    updateFiles([rec, ...files]); setVaultName(""); toast.success("File added to the vault");
  };
  const field = (label: string, key: keyof Letterhead, placeholder?: string) => (<div><label className="label-tech">{label}</label><input value={String(lh[key] ?? "")} onChange={e => set({ [key]: e.target.value } as Partial<Letterhead>)} placeholder={placeholder} className="field-tech font-tech" /></div>);
  return (<div className="grid lg:grid-cols-2 gap-6">
    <section className="border hairline bg-card p-6">
      <h3 className="font-display font-bold uppercase text-xl">Letterhead</h3>
      <p className="font-tech text-[11px] text-muted-foreground mt-1">Used on every quotation, contract and invoice. Company name/address/phone/email start from your business details and can be specialised for your own pro brand here.</p>
      <div className="mt-4 border hairline p-4">
        {lh.imageDataUrl ? (<div><img src={lh.imageDataUrl} alt="Letterhead" className="max-h-28 w-auto object-contain bg-white p-2" /><div className="flex gap-2 mt-3"><label className="font-tech text-[11px] border hairline px-3 py-1.5 cursor-pointer hover:border-primary hover:text-primary inline-flex items-center gap-1"><Upload className="h-3 w-3" /> Replace<input type="file" accept="image/png,image/jpeg" className="hidden" onChange={e => void onLetterheadImage(e.target.files?.[0])} /></label><button onClick={() => set({ imageDataUrl: null })} className="font-tech text-[11px] border hairline px-3 py-1.5 hover:border-destructive hover:text-destructive cursor-pointer">Remove</button></div></div>)
        : (<label className="flex flex-col items-center justify-center border border-dashed hairline py-8 cursor-pointer hover:border-primary"><Upload className="h-6 w-6 text-muted-foreground" /><span className="font-tech text-xs mt-2">Upload letterhead image (PNG/JPG, max 1.5MB)</span><input type="file" accept="image/png,image/jpeg" className="hidden" onChange={e => void onLetterheadImage(e.target.files?.[0])} /></label>)}
        <p className="font-tech text-[11px] text-muted-foreground mt-2">No image? Documents print with a styled company-name banner instead (orange name + details line).</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mt-5">
        {field("Company name", "companyName")}{field("Tagline", "tagline", "e.g. Roofing & building materials, done right")}
        {field("Address", "address")}{field("Phone", "phone")}
        {field("Email", "email")}{field("Website", "website", "www.example.com")}
      </div>
      <h4 className="font-display font-bold uppercase mt-7">Payment details (printed on invoices)</h4>
      <div className="grid sm:grid-cols-2 gap-4 mt-3">
        {field("Bank name", "bankName", "e.g. GTBank")}{field("Account number", "bankAccount")}
        {field("Account name", "bankAccountName")}
      </div>
    </section>
    <section className="border hairline bg-card p-6">
      <h3 className="font-display font-bold uppercase text-xl">Document Vault</h3>
      <p className="font-tech text-[11px] text-muted-foreground mt-1">Certificates, IDs, past quotes, drawings and receipts — kept with your pro paperwork. Files are stored in this browser (demo) — production cloud storage arrives with the backend.</p>
      <div className="flex flex-wrap gap-2 mt-4">
        <input value={vaultName} onChange={e => setVaultName(e.target.value)} placeholder="File name (optional)" className="field-tech font-tech flex-1 min-w-[160px]" />
        <select value={vaultCat} onChange={e => setVaultCat(e.target.value as VaultFile["category"])} className="field-tech font-tech bg-background w-40">{VAULT_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        <label className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-display font-semibold uppercase px-4 py-2.5 cursor-pointer text-sm"><Upload className="h-4 w-4" /> Upload<input type="file" accept="image/*,.pdf" className="hidden" onChange={e => { void onVaultFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
      </div>
      <p className="font-tech text-[11px] text-muted-foreground mt-2">Images or PDF, max 2MB per file.</p>
      <div className="border hairline divide-y divide-white/10 mt-4">{files.length === 0 && <p className="px-4 py-6 font-tech text-xs text-muted-foreground">The vault is empty.</p>}{files.map(f => (<div key={f.id} className="px-4 py-3 flex flex-wrap gap-3 items-center justify-between">
        <div><p className="font-tech font-semibold text-sm">{f.name}</p><p className="font-tech text-[11px] text-muted-foreground">{f.category} · {f.sizeKb} KB · {fmtDate(f.createdAt)}</p></div>
        <div className="flex gap-2">
          <a href={f.dataUrl} download={f.name} className="font-tech text-[11px] border hairline px-2.5 py-1.5 hover:border-primary hover:text-primary inline-flex items-center gap-1"><Download className="h-3 w-3" /> Download</a>
          <button onClick={() => { if (window.confirm(`Delete "${f.name}" from the vault?`)) updateFiles(files.filter(x => x.id !== f.id)); }} className="font-tech text-[11px] border hairline px-2.5 py-1.5 hover:border-destructive hover:text-destructive cursor-pointer inline-flex items-center gap-1"><Trash2 className="h-3 w-3" /> Delete</button>
        </div></div>))}</div>
    </section>
  </div>);
}
