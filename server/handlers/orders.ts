import { sendJson, methodNotAllowed, readJson, wrap } from "../http.js";
import { dbQuery, isDbConfigured } from "../db.js";
import { orderFromRow } from "../records.js";
import { isAdmin } from "../auth.js";
// POST (public) → place order (items snapshot as jsonb).
// GET ?code= | ?phone= → lookups. GET (admin) → all. PATCH (admin) → {code, status?, paid?}.
export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "POST") {
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    if (!code || String(b.name || "").trim().length < 2) return sendJson(res, 400, { error: "Missing order code or name" });
    const items = Array.isArray(b.items) ? b.items : [];
    const total = Math.round(Number(b.totalNgn) || items.reduce((s: number, i: any) => s + (Number(i.lineTotalNgn) || 0), 0));
    const rows = await dbQuery(
      `INSERT INTO orders (code, name, phone, email, address, note, items, total_ngn, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'pending') RETURNING *`,
      [code, b.name, b.phone || "", b.email || null, b.address || "", b.note || null, JSON.stringify(items), total],
    );
    return sendJson(res, 201, { order: orderFromRow(rows[0]) });
  }
  if (req.method === "GET") {
    const code = String(req.query?.code || "").trim().toUpperCase();
    const phone = String(req.query?.phone || "").replace(/\D/g, "");
    if (code) {
      const rows = await dbQuery(`SELECT * FROM orders WHERE code = $1`, [code]);
      return sendJson(res, 200, { orders: rows.map(orderFromRow) });
    }
    if (phone) {
      const rows = await dbQuery(`SELECT * FROM orders WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE '%' || $1 ORDER BY created_at DESC`, [phone.slice(-10)]);
      return sendJson(res, 200, { orders: rows.map(orderFromRow) });
    }
    if (!(await isAdmin(req))) return sendJson(res, 401, { error: "Admin session required" });
    const rows = await dbQuery(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 500`);
    return sendJson(res, 200, { orders: rows.map(orderFromRow) });
  }
  if (req.method === "PATCH") {
    if (!(await isAdmin(req))) return sendJson(res, 401, { error: "Admin session required" });
    const b = await readJson(req);
    const code = String(b.code || "").trim().toUpperCase();
    if (!code) return sendJson(res, 400, { error: "Missing order code" });
    const sets: string[] = []; const vals: any[] = [];
    if (typeof b.status === "string" && ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].includes(b.status)) { vals.push(b.status); sets.push(`status = $${vals.length}`); }
    if (typeof b.paid === "boolean") { vals.push(b.paid); sets.push(`paid = $${vals.length}`); }
    if (!sets.length) return sendJson(res, 400, { error: "Nothing to update" });
    vals.push(code);
    const rows = await dbQuery(`UPDATE orders SET ${sets.join(", ")} WHERE code = $${vals.length} RETURNING *`, vals);
    if (!rows.length) return sendJson(res, 404, { error: "Order not found" });
    return sendJson(res, 200, { order: orderFromRow(rows[0]) });
  }
  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
});
