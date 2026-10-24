// Pro Documents storage — engineer's Notes, Quotation Creator documents,
// Contracts, Letterhead settings and the Document Vault.
// All state is local to this browser (localStorage), same pattern as
// lib/proStorage.ts. Cloud storage arrives with the production backend.
import { uid } from "./proStorage";
import { getQuotes } from "./storage";
import { getEstimates } from "./projectEstimator";
import { getProProjects } from "./proStorage";
import { calculateRoof, PROFILES } from "./roofEngine";
import { getBusiness } from "./settings";

// ---------------- Types ----------------
export interface DocNote {
  id: string; title: string; body: string;
  projectId?: string; projectName?: string;
  pinned: boolean; sample?: boolean;
  createdAt: string; updatedAt: string;
}
export interface LineItem { id: string; description: string; qty: number; unit: string; unitPrice: number }
export type DiscountType = "flat" | "pct";
export interface DocQuotation {
  id: string; code: string; title: string;
  clientName: string; clientPhone: string; clientAddress: string;
  validityDays: number; items: LineItem[];
  discountType: DiscountType; discountValue: number; vatPct: number;
  terms: string; source?: string;
  createdAt: string; updatedAt: string;
}
export interface PaymentMilestone { id: string; label: string; pct: number }
export interface ContractClause { id: string; title: string; body: string }
export interface DocContract {
  id: string; code: string; title: string; siteAddress: string;
  clientName: string; clientPhone: string; clientAddress: string;
  scope: string; quotationCode?: string; contractSum: number;
  milestones: PaymentMilestone[];
  startDate: string; duration: string; warrantyMonths: number;
  clauses: ContractClause[];
  createdAt: string; updatedAt: string;
}
export type InvoiceStatus = "Draft" | "Sent" | "Part Paid" | "Paid" | "Overdue";
export const INVOICE_STATUSES: InvoiceStatus[] = ["Draft", "Sent", "Part Paid", "Paid", "Overdue"];
export interface DocInvoice {
  id: string; code: string; title: string;
  clientName: string; clientPhone: string; clientAddress: string;
  issueDate: string; dueDate: string;
  items: LineItem[];
  discountType: DiscountType; discountValue: number; vatPct: number;
  amountPaid: number; status: InvoiceStatus; // manual base status; display status is derived (see invoiceDisplayStatus)
  notes: string; quotationCode?: string;
  createdAt: string; updatedAt: string;
}
export interface DocumentsStore { notes: DocNote[]; quotations: DocQuotation[]; contracts: DocContract[]; invoices: DocInvoice[] }
export interface Letterhead {
  imageDataUrl: string | null; companyName: string; tagline: string;
  address: string; phone: string; email: string; website: string;
  /** Payment details printed on invoices (Deliverable C). */
  bankName: string; bankAccount: string; bankAccountName: string;
}
export type VaultCategory = "Certificate" | "ID" | "Past Quote" | "Drawing" | "Receipt" | "Other";
export const VAULT_CATEGORIES: VaultCategory[] = ["Certificate", "ID", "Past Quote", "Drawing", "Receipt", "Other"];
export interface VaultFile {
  id: string; name: string; category: VaultCategory; mime: string;
  dataUrl: string; sizeKb: number; createdAt: string;
}

// ---------------- Storage keys ----------------
const DOCS_KEY = "oketex-documents";
const LETTERHEAD_KEY = "oketex-letterhead";
const FILES_KEY = "oketex-files";
export const LETTERHEAD_MAX_BYTES = 1.5 * 1024 * 1024; // 1.5 MB
export const VAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const now = () => new Date().toISOString();
export function quotationDocCode() { return `QD-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; }
export function contractDocCode() { return `CT-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; }

// ---------------- Documents store ----------------
function sampleNote(): DocNote {
  return {
    id: uid(), title: "Sample — Site note: Duplex at Ibafo", pinned: false, sample: true,
    body: "SAMPLE NOTE — edit or delete it, then write your own.\n\nMeasured main roof from the ground and checked again at the eaves: 11.0m x 9.2m, pitch about 28 degrees. Timber purlins sound, no rot at the wall plate.\n\nClient wants Charcoal Longspan 0.45. Remind office: confirm ridge length on delivery day and photograph the stacked sheets before fixing starts.",
    createdAt: now(), updatedAt: now(),
  };
}
function emptyStore(): DocumentsStore { return { notes: [sampleNote()], quotations: [], contracts: [], invoices: [] }; }
export function getDocuments(): DocumentsStore {
  try {
    const r = localStorage.getItem(DOCS_KEY);
    if (r) { const s = JSON.parse(r) as DocumentsStore; return { notes: s.notes ?? [], quotations: s.quotations ?? [], contracts: s.contracts ?? [], invoices: s.invoices ?? [] }; }
  } catch { /* fall through */ }
  const s = emptyStore();
  try { localStorage.setItem(DOCS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  return s;
}
export function saveDocuments(s: DocumentsStore) { try { localStorage.setItem(DOCS_KEY, JSON.stringify(s)); } catch { /* ignore */ } }

// ---------------- Letterhead ----------------
export function getLetterhead(): Letterhead {
  try {
    const r = localStorage.getItem(LETTERHEAD_KEY);
    if (r) return { imageDataUrl: null, tagline: "", website: "", bankName: "", bankAccount: "", bankAccountName: "", ...JSON.parse(r) } as Letterhead;
  } catch { /* ignore */ }
  const b = getBusiness();
  return { imageDataUrl: null, companyName: b.name, tagline: "", address: b.address, phone: b.phone, email: b.email, website: "", bankName: "", bankAccount: "", bankAccountName: "" };
}
export function saveLetterhead(l: Letterhead) { try { localStorage.setItem(LETTERHEAD_KEY, JSON.stringify(l)); } catch { /* ignore */ } }

// ---------------- Document vault ----------------
export function getVaultFiles(): VaultFile[] {
  try { const r = localStorage.getItem(FILES_KEY); return r ? (JSON.parse(r) as VaultFile[]) : []; } catch { return []; }
}
export function saveVaultFiles(list: VaultFile[]) { try { localStorage.setItem(FILES_KEY, JSON.stringify(list)); } catch { /* ignore */ } }

// ---------------- Pure math (importable / testable) ----------------
export const lineTotal = (i: LineItem): number => (i.qty || 0) * (i.unitPrice || 0);
export interface QuotationTotals { subtotal: number; discountAmount: number; afterDiscount: number; vatAmount: number; grandTotal: number }
/** Subtotal = sum of qty x price. Discount applies BEFORE VAT; VAT is charged on the discounted subtotal. */
export function quotationTotals(q: Pick<DocQuotation, "items" | "discountType" | "discountValue" | "vatPct">): QuotationTotals {
  const subtotal = q.items.reduce((s, i) => s + lineTotal(i), 0);
  const rawDiscount = q.discountType === "pct" ? (subtotal * (q.discountValue || 0)) / 100 : (q.discountValue || 0);
  const discountAmount = Math.min(Math.max(rawDiscount, 0), subtotal);
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const vatAmount = (afterDiscount * (q.vatPct || 0)) / 100;
  return { subtotal, discountAmount, afterDiscount, vatAmount, grandTotal: afterDiscount + vatAmount };
}
export const milestoneTotalPct = (ms: PaymentMilestone[]): number => ms.reduce((s, m) => s + (m.pct || 0), 0);

// ---------------- Factories ----------------
export function emptyLineItem(): LineItem { return { id: uid(), description: "", qty: 1, unit: "pcs", unitPrice: 0 }; }
export const DEFAULT_QUOTE_TERMS = "Prices are in Nigerian Naira (NGN) and remain valid for the validity period stated above. Materials are supplied strictly as listed; any additional materials or works will be quoted separately before they are carried out. Delivery dates are confirmed once payment terms are agreed.";
export function newQuotation(patch: Partial<DocQuotation> = {}): DocQuotation {
  return {
    id: uid(), code: quotationDocCode(), title: "Quotation", clientName: "", clientPhone: "", clientAddress: "",
    validityDays: 14, items: [emptyLineItem()], discountType: "pct", discountValue: 0, vatPct: 0,
    terms: DEFAULT_QUOTE_TERMS, createdAt: now(), updatedAt: now(), ...patch,
  };
}
export const DEFAULT_SCOPE = "Supply and installation of the roofing/building works itemised in the attached quotation: covering materials, ridge caps, flashings and fixings, installed on the Client's prepared structure. Timber structure, ceilings, and internal works are excluded unless expressly listed in the quotation.";
export const DEFAULT_CLAUSES: ContractClause[] = [
  { id: uid(), title: "Materials & Workmanship", body: "All materials shall be new and of the grades specified in the quotation. Workmanship shall be to the standard reasonably expected of a competent building contractor. Materials delivered to site and paid for become the Client's property." },
  { id: uid(), title: "Variations", body: "Any change to the agreed scope shall be recorded in writing (a signed note, email or WhatsApp confirmation is sufficient) together with its price effect, before the changed work is carried out." },
  { id: uid(), title: "Payment Terms", body: "Payments shall follow the payment schedule in this contract. The Contractor may pause work if a scheduled payment is more than 7 days overdue, and the completion date shall extend by the period of the pause." },
  { id: uid(), title: "Delays", body: "If completion is delayed by weather, late payment, late Client decisions, or other causes outside the Contractor's control, the completion date shall extend by a fair period. The Contractor shall inform the Client of any delay promptly." },
  { id: uid(), title: "Defects Liability & Warranty", body: "For the warranty period stated in this contract, counted from practical completion, the Contractor shall make good at no cost any defect arising from faulty materials supplied by the Contractor or from faulty workmanship. This does not cover storm damage, damage by others, or misuse." },
  { id: uid(), title: "Termination", body: "Either party may end this contract by 7 days' written notice if the other party materially breaches it and does not remedy the breach within that period. The Client shall pay for all work properly done and materials supplied up to the date of termination." },
  { id: uid(), title: "Dispute Resolution", body: "The parties shall first try to settle any dispute by discussion, and then by mediation in the state where the project is located. If mediation fails, either party may pursue remedies in the courts of that state." },
];
export function newContract(patch: Partial<DocContract> = {}): DocContract {
  return {
    id: uid(), code: contractDocCode(), title: "", siteAddress: "",
    clientName: "", clientPhone: "", clientAddress: "",
    scope: DEFAULT_SCOPE, contractSum: 0,
    milestones: [
      { id: uid(), label: "Mobilisation / materials deposit", pct: 60 },
      { id: uid(), label: "On completion of installation", pct: 30 },
      { id: uid(), label: "After final inspection & handover", pct: 10 },
    ],
    startDate: new Date().toISOString().slice(0, 10), duration: "2 weeks", warrantyMonths: 12,
    clauses: DEFAULT_CLAUSES.map(c => ({ ...c, id: uid() })),
    createdAt: now(), updatedAt: now(), ...patch,
  };
}

export function invoiceDocCode() { return `INV-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; }
export function newInvoice(patch: Partial<DocInvoice> = {}): DocInvoice {
  const issue = new Date();
  const due = new Date(issue.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    id: uid(), code: invoiceDocCode(), title: "Invoice",
    clientName: "", clientPhone: "", clientAddress: "",
    issueDate: issue.toISOString().slice(0, 10), dueDate: due.toISOString().slice(0, 10),
    items: [emptyLineItem()], discountType: "pct", discountValue: 0, vatPct: 0,
    amountPaid: 0, status: "Draft", notes: "",
    createdAt: now(), updatedAt: now(), ...patch,
  };
}
/** Invoice totals use the identical formula to quotations (discount before VAT, VAT on discounted subtotal). */
export function invoiceTotals(inv: Pick<DocInvoice, "items" | "discountType" | "discountValue" | "vatPct">): QuotationTotals {
  return quotationTotals(inv);
}
export const invoiceBalance = (inv: DocInvoice): number => Math.max(0, invoiceTotals(inv).grandTotal - (inv.amountPaid || 0));
/** Display status: Paid and Overdue are derived; the rest follow the stored (manual) status. Part Paid is derived whenever money has been received but a balance remains. */
export function invoiceDisplayStatus(inv: DocInvoice, today = new Date().toISOString().slice(0, 10)): InvoiceStatus {
  const bal = invoiceBalance(inv);
  if (bal <= 0 && invoiceTotals(inv).grandTotal > 0) return "Paid";
  if (inv.dueDate && inv.dueDate < today && bal > 0) return "Overdue";
  if ((inv.amountPaid || 0) > 0 && bal > 0) return "Part Paid";
  return inv.status;
}
/** Convert a saved quotation document into a new invoice draft (same items, client and money settings). */
export function invoiceFromQuotation(q: DocQuotation): DocInvoice {
  return newInvoice({
    title: q.title, clientName: q.clientName, clientPhone: q.clientPhone, clientAddress: q.clientAddress,
    items: q.items.map(i => ({ ...i, id: uid() })),
    discountType: q.discountType, discountValue: q.discountValue, vatPct: q.vatPct,
    notes: `Converted from quotation ${q.code}.`, quotationCode: q.code,
  });
}

// ---------------- Import builders ----------------
/** Build quotation line items from a saved Pro Roof Calculator quote (oketex-quotes-v1). */
export function quotationFromSavedQuote(code: string): DocQuotation | null {
  const q = getQuotes().find(x => x.code === code);
  if (!q) return null;
  const desc = `Roofing works — ${q.roofType}${q.colour ? `, ${q.colour}` : ""} (${q.areaM2} m2 plan area) per saved quote ${q.code}`;
  return newQuotation({
    title: `Roofing quotation — ${q.roofType}`,
    clientName: q.name, clientPhone: q.phone,
    items: [{ id: uid(), description: desc, qty: 1, unit: "lot", unitPrice: q.estimateNgn }],
    terms: q.boqSummary ? `${DEFAULT_QUOTE_TERMS}\n\nBill summary from calculator:\n${q.boqSummary}` : DEFAULT_QUOTE_TERMS,
    source: `Saved quote ${q.code}`,
  });
}
/** Build quotation line items from a saved Style & Photo estimate (oketex-estimates). */
export function quotationFromEstimate(code: string): DocQuotation | null {
  const e = getEstimates().find(x => x.code === code);
  if (!e) return null;
  const items: LineItem[] = [];
  e.groups.forEach(g => g.lines.forEach(l => items.push({
    id: uid(), description: l.note ? `${l.name} — ${l.note}` : l.name,
    qty: l.qty, unit: l.unit, unitPrice: l.unitPrice ?? 0,
  })));
  return newQuotation({
    title: `${e.tradeLabel} — ${e.styleName}`,
    items: items.length ? items : [emptyLineItem()],
    source: `Estimate ${e.code}`,
  });
}
/** Build quotation line items from a Pro Workspace project: take-off rows priced by the roof engine + measurement rows (price left at 0 for the engineer to fill). */
export function quotationFromProject(projectId: string): DocQuotation | null {
  const p = getProProjects().find(x => x.id === projectId);
  if (!p) return null;
  const items: LineItem[] = [];
  p.takeoff.forEach(r => {
    const res = calculateRoof({
      length: r.length || 0, width: r.width || 0, overhang: r.overhang || 0, style: r.style,
      pitchDeg: r.pitch || 0, profile: r.profile, colour: "Charcoal", wastePct: null,
      extras: { gutters: false, insulation: false, installation: false, timber: false }, deliveryZone: "pickup",
    });
    items.push({
      id: uid(),
      description: `${r.section} — ${PROFILES[r.profile].label}, ${r.length} x ${r.width} m at ${r.pitch} deg (${res.trueRoofArea.toFixed(1)} m2 true roof area, ${res.cuttingList})`,
      qty: 1, unit: "lot", unitPrice: Math.round(res.subtotal),
    });
  });
  p.measures.forEach(m => {
    let qty = 0; let unit = m.unit || "pcs";
    if (m.h > 0) { qty = m.l * m.w * m.h * (m.qty || 1); unit = "m3"; }
    else if (m.l > 0 && m.w > 0) { qty = m.l * m.w * (m.qty || 1); unit = "m2"; }
    else { qty = (m.l || m.w) * (m.qty || 1); unit = "m"; }
    items.push({ id: uid(), description: `${m.item || "Measured item"}${m.location ? ` — ${m.location}` : ""}${m.note ? ` (${m.note})` : ""} — price to confirm`, qty: Math.round(qty * 100) / 100, unit, unitPrice: 0 });
  });
  return newQuotation({
    title: p.name, clientName: p.client, clientAddress: p.siteAddress,
    items: items.length ? items : [emptyLineItem()],
    source: `Workspace project: ${p.name}`,
  });
}
