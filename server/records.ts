// Row ↔ frontend-record mappers. Shapes mirror the localStorage stores:
// partners (lib/partnerStorage.ts Partner), leads (Lead), bookings
// (lib/proStorage.ts LocalBooking), orders/quotes (lib/storage.ts).
export function partnerFromRow(r: any): any {
  const d = typeof r.data === "string" ? JSON.parse(r.data || "{}") : (r.data || {});
  return {
    ...d,
    code: r.code, role: r.role, businessName: r.business_name, contactName: r.contact_name,
    phone: r.phone, email: r.email ?? d.email, location: r.location, areas: r.areas,
    status: r.status, verified: !!r.verified, featured: !!r.featured,
    featuredUntil: r.featured_until ? new Date(r.featured_until).toISOString() : d.featuredUntil,
    sample: !!r.sample || d.sample || false,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : d.createdAt,
  };
}
/** PUBLIC partner shape (Admin-Routing rule): the directory and profile
 *  endpoints never expose a partner's phone or email — all contact is
 *  routed through Oketex admin. Mirrors the jobs customerPhone strip. */
export function publicPartnerFromRow(r: any): any {
  const p = partnerFromRow(r);
  return { ...p, phone: "", email: undefined };
}
export function leadFromRow(r: any): any {  return {
    id: r.id, partnerCode: r.partner_code, partnerName: r.partner_name, type: r.type,
    customerName: r.customer_name, customerPhone: r.customer_phone, description: r.description,
    estValueNgn: Number(r.est_value_ngn) || 0, commissionPct: Number(r.commission_pct) || 0,
    commissionNgn: Number(r.commission_ngn) || 0, status: r.status,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt,
  };
}
export function bookingFromRow(r: any): any {
  return {
    code: r.code, service: r.service, serviceLabel: r.service_label, date: r.date, slot: r.slot,
    name: r.name, phone: r.phone, address: r.address, lgaState: r.lga_state,
    buildingType: r.building_type, stage: r.stage, notes: r.notes ?? undefined,
    status: r.status, depositPaid: !!r.deposit_paid,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt,
  };
}
export function orderFromRow(r: any): any {
  const items = typeof r.items === "string" ? JSON.parse(r.items || "[]") : (r.items || []);
  return {
    code: r.code, name: r.name, phone: r.phone, email: r.email ?? undefined, address: r.address,
    note: r.note ?? undefined, items, totalNgn: Number(r.total_ngn) || 0, status: r.status,
    paid: !!r.paid, createdAt: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt,
  };
}
export function quoteFromRow(r: any): any {
  return {
    code: r.code, name: r.name, phone: r.phone, email: r.email ?? undefined, note: r.note ?? undefined,
    roofType: r.roof_type, colour: r.colour ?? undefined, areaM2: Number(r.area_m2) || 0,
    estimateNgn: Number(r.estimate_ngn) || 0, boqSummary: r.boq_summary ?? undefined, status: r.status,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt,
  };
}
export function jobFromRow(r: any, opts: { publicSafe?: boolean } = {}): any {
  // Public board/lookup responses never expose the customer's phone unless
  // the caller proved it (matching phone lookup or an admin session).
  return {
    code: r.code, title: r.title, trade: r.trade, description: r.description, location: r.location,
    budgetLow: Number(r.budget_low) || 0, budgetHigh: Number(r.budget_high) || 0,
    customerName: r.customer_name, customerPhone: opts.publicSafe ? "" : r.customer_phone,
    sourceQuoteCode: r.source_quote_code ?? undefined, status: r.status,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt,
  };
}
export function snapRequestFromRow(r: any, opts: { publicSafe?: boolean } = {}): any {
  // Full record lives in `data` jsonb; columns win where they exist.
  // Public lookups (code only, no phone proof) never expose the phone.
  const d = typeof r.data === "string" ? JSON.parse(r.data || "{}") : (r.data || {});
  return {
    ...d,
    code: r.code,
    intent: r.intent ?? d.intent ?? "fix",
    status: r.status ?? d.status ?? "Received",
    customerName: r.customer_name ?? d.customerName ?? "",
    customerPhone: opts.publicSafe ? "" : (r.customer_phone ?? d.customerPhone ?? ""),
    assignedPartnerCode: r.assigned_partner_code ?? d.assignedPartnerCode ?? null,
    totalNgn: Number(r.total_ngn ?? d.totalNgn ?? 0) || 0,
    agreedPriceNgn: r.agreed_price_ngn == null ? (d.agreedPriceNgn ?? null) : Number(r.agreed_price_ngn),
    commissionPct: r.commission_pct == null ? (d.commissionPct ?? null) : Number(r.commission_pct),
    commissionNgn: r.commission_ngn == null ? (d.commissionNgn ?? null) : Number(r.commission_ngn),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : d.createdAt,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : d.updatedAt,
  };
}
export function bidFromRow(r: any): any {
  return {
    id: r.id, jobCode: r.job_code, partnerCode: r.partner_code, partnerName: r.partner_name,
    amount: Number(r.amount) || 0, days: Number(r.days) || 0, note: r.note, status: r.status,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt,
  };
}
export function reviewFromRow(r: any): any {
  return {
    id: r.id, partnerCode: r.partner_code, customerName: r.customer_name, rating: Number(r.rating) || 0,
    text: r.text, refCode: r.ref_code, status: r.status,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt,
  };
}
export function notificationFromRow(r: any): any {
  return {
    id: r.id, ts: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt,
    audience: r.audience, refCode: r.ref_code, channel: r.channel, templateKey: r.template_key,
    message: r.message, status: r.status, phone: r.phone ?? undefined, email: r.email ?? undefined,
    detail: r.detail ?? undefined,
  };
}
export function offerFromRow(r: any): any {
  return {
    id: r.id, productName: r.product_name, priceNgn: Number(r.price_ngn) || 0, unit: r.unit,
    note: r.note, audience: r.audience,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt,
  };
}

/** Staff directory shape (Staff System) — a users row with a staff role.
 *  Never carries the password hash. */
export function staffFromRow(r: any): any {
  return {
    id: r.id, name: r.name || "", email: r.email, phone: r.phone || "",
    role: r.role || "customer", active: r.active !== false,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
  };
}
export function activityFromRow(r: any): any {
  return {
    id: r.id, ts: r.created_at ? new Date(r.created_at).toISOString() : r.created_at,
    actorName: r.actor_name || "", actorRole: r.actor_role || "",
    action: r.action || "", refCode: r.ref_code || "", detail: r.detail || "",
  };
}
/** Production job card (Factory wing) — full card in `data` jsonb, columns win. */
export function productionFromRow(r: any): any {
  const d = typeof r.data === "string" ? JSON.parse(r.data || "{}") : (r.data || {});
  return {
    ...d,
    code: r.code,
    orderCode: r.order_code ?? d.orderCode ?? "",
    customerName: r.customer_name ?? d.customerName ?? "",
    status: r.status ?? d.status ?? "Queued",
    operatorName: r.operator_name ?? d.operatorName ?? "",
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : d.createdAt,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : d.updatedAt,
  };
}

/** Supply request (Stage S3) — full record in `data` jsonb, columns win.
 *  PRIVACY: a partner reading a request sees ONLY their own quote — other
 *  partners' prices are stripped server-side, never merely hidden in the UI.
 *  Pass opts.partnerCode for the partner view; omit it for staff. */
export function supplyFromRow(r: any, opts: { partnerCode?: string } = {}): any {
  const d = typeof r.data === "string" ? JSON.parse(r.data || "{}") : (r.data || {});
  const allQuotes = Array.isArray(d.quotes) ? d.quotes : [];
  const quotes = opts.partnerCode
    ? allQuotes.filter((q: any) => q.partnerCode === opts.partnerCode)
    : allQuotes;
  return {
    ...d,
    code: r.code,
    type: r.type ?? d.type ?? "buy",
    item: r.item ?? d.item ?? "",
    status: r.status ?? d.status ?? "Open",
    chosenPartnerCode: r.chosen_partner_code ?? d.chosenPartnerCode ?? null,
    chosenTotalNgn: r.chosen_total_ngn == null ? (d.chosenTotalNgn ?? null) : Number(r.chosen_total_ngn),
    quotes,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : d.createdAt,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : d.updatedAt,
  };
}
