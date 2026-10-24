import { sendJson, methodNotAllowed, wrap } from "../../http";
import { dbQuery, isDbConfigured } from "../../db";
import { partnerFromRow } from "../../records";
// GET /api/partners/<code> — the code acts as the partner's capability key
// (same trust model as the demo): returns the full record for ANY status so
// /partner-status works for pending applications too. The public directory
// (GET /api/partners) only ever exposes approved partners.
export default wrap(async (req: any, res: any) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
  const code = String(req.query?.code || "").trim().toUpperCase();
  const rows = await dbQuery(`SELECT * FROM partners WHERE code = $1`, [code]);
  if (!rows.length) return sendJson(res, 404, { error: "Partner not found" });
  return sendJson(res, 200, { partner: partnerFromRow(rows[0]) });
});
