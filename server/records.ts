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
export function leadFromRow(r: any): any {
  return {
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
export function offerFromRow(r: any): any {
  return {
    id: r.id, productName: r.product_name, priceNgn: Number(r.price_ngn) || 0, unit: r.unit,
    note: r.note, audience: r.audience,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : r.createdAt,
  };
}
