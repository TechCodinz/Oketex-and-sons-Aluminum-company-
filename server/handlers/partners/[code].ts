import { sendJson, methodNotAllowed, wrap } from "../../http.js";
import { dbQuery, isDbConfigured } from "../../db.js";
import { partnerFromRow, publicPartnerFromRow } from "../../records.js";
import { isAdmin } from "../../auth.js";
// GET /api/partners/<code> — Admin-Routing rule: the PUBLIC response strips
// the partner's phone + email (customers reach partners only through Oketex
// admin). The FULL record is returned only to:
//   • an admin session, or
//   • the partner themselves, proving ownership with the phone number they
//     registered with (?phone=…, same last-10 proof as the PATCH toggle).
// Status/visibility is unchanged: any status resolves so /partner-status
// works for pending applications too.
export default wrap(async (req: any, res: any) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  const code = String(req.query?.code || "").trim().toUpperCase();
  const rows = await dbQuery(`SELECT * FROM partners WHERE code = $1`, [code]);
  if (!rows.length) return sendJson(res, 404, { error: "Partner not found" });
  const stored = String(rows[0].phone || "").replace(/\D/g, "");
  const given = String(req.query?.phone || "").replace(/\D/g, "");
  const ownerProof = given.length >= 7 && stored.length >= 10 && stored.endsWith(given.slice(-10));
  const full = ownerProof || (await isAdmin(req));
  return sendJson(res, 200, { partner: full ? partnerFromRow(rows[0]) : publicPartnerFromRow(rows[0]) });
});
