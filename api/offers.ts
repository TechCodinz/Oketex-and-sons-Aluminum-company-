import { sendJson, methodNotAllowed, readJson, wrap } from "../server/http";
import { dbQuery, isDbConfigured } from "../server/db";
import { offerFromRow } from "../server/records";
import { isAdmin } from "../server/auth";
// Supply offers pushed by admin to the partner network.
// GET (public) → all offers (frontend filters by audience). POST/DELETE admin.
export default wrap(async (req: any, res: any) => {
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  if (req.method === "GET") {
    const rows = await dbQuery(`SELECT * FROM offers ORDER BY created_at DESC LIMIT 200`);
    return sendJson(res, 200, { offers: rows.map(offerFromRow) });
  }
  if (!(await isAdmin(req))) return sendJson(res, 401, { error: "Admin session required" });
  if (req.method === "POST") {
    const b = await readJson(req);
    if (String(b.productName || "").trim().length < 2) return sendJson(res, 400, { error: "Missing product name" });
    const id = `OFF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const rows = await dbQuery(
      `INSERT INTO offers (id, product_name, price_ngn, unit, note, audience) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, b.productName, Math.round(Number(b.priceNgn) || 0), b.unit || "per piece", b.note || "", ["all", "pros", "sellers"].includes(b.audience) ? b.audience : "all"],
    );
    return sendJson(res, 201, { offer: offerFromRow(rows[0]) });
  }
  if (req.method === "DELETE") {
    const id = String(req.query?.id || "");
    if (!id) return sendJson(res, 400, { error: "Missing offer id" });
    await dbQuery(`DELETE FROM offers WHERE id = $1`, [id]);
    return sendJson(res, 200, { ok: true });
  }
  return methodNotAllowed(res, ["GET", "POST", "DELETE"]);
});
