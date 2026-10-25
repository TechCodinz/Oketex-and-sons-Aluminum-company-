import { sendJson, methodNotAllowed, readJson, wrap } from "../http.js";
import { dbQuery, isDbConfigured } from "../db.js";
import { bookingFromRow } from "../records.js";
import { requireRole, roleErrorBody } from "../auth.js";
// POST (public) → create booking. GET ?code= | ?phone= → lookups (track
// page + account). GET (admin, no query) → all. PATCH (admin) → {code,status}.
export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "POST") {
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    if (!code || String(b.name || "").trim().length < 2) return sendJson(res, 400, { error: "Missing booking code or name" });
    const rows = await dbQuery(
      `INSERT INTO bookings (code, service, service_label, date, slot, name, phone, address, lga_state, building_type, stage, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending') RETURNING *`,
      [code, b.service || "", b.serviceLabel || "", b.date || "", b.slot || "", b.name, b.phone || "", b.address || "", b.lgaState || "", b.buildingType || "", b.stage || "", b.notes || null],
    );
    return sendJson(res, 201, { booking: bookingFromRow(rows[0]) });
  }
  if (req.method === "GET") {
    const code = String(req.query?.code || "").trim().toUpperCase();
    const phone = String(req.query?.phone || "").replace(/\D/g, "");
    if (code) {
      const rows = await dbQuery(`SELECT * FROM bookings WHERE code = $1`, [code]);
      return sendJson(res, 200, { bookings: rows.map(bookingFromRow) });
    }
    if (phone) {
      const rows = await dbQuery(`SELECT * FROM bookings WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE '%' || $1 ORDER BY created_at DESC`, [phone.slice(-10)]);
      return sendJson(res, 200, { bookings: rows.map(bookingFromRow) });
    }
    const gate = await requireRole(req, ["admin", "sales", "operations", "field"]);
    if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));
    const rows = await dbQuery(`SELECT * FROM bookings ORDER BY created_at DESC LIMIT 500`);
    return sendJson(res, 200, { bookings: rows.map(bookingFromRow) });
  }
  if (req.method === "PATCH") {
    const gate = await requireRole(req, ["admin", "sales", "operations", "field"]);
    if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));
    const b = await readJson(req);
    if (!b.code || !["pending", "confirmed", "scheduled", "completed", "cancelled"].includes(b.status)) return sendJson(res, 400, { error: "Missing code or bad status" });
    const rows = await dbQuery(`UPDATE bookings SET status = $1 WHERE code = $2 RETURNING *`, [b.status, String(b.code).toUpperCase()]);
    if (!rows.length) return sendJson(res, 404, { error: "Booking not found" });
    return sendJson(res, 200, { booking: bookingFromRow(rows[0]) });
  }
  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
});
