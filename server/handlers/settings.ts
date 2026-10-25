import { sendJson, methodNotAllowed, readJson, wrap } from "../http.js";
import { dbQuery, isDbConfigured } from "../db.js";
import { requireRole, roleErrorBody } from "../auth.js";
import { getSiteSettings } from "../siteSettings.js";
// GET → public effective server settings, or {live:false} when there is no
// DB / nothing stored. PUT (admin) → replace the 'site' settings document.
// The stored shape mirrors src/lib/settings.ts OketexSettings.
export default wrap(async (req: any, res: any) => {
  if (req.method === "GET") {
    if (!isDbConfigured()) return sendJson(res, 200, { live: false, settings: null });
    const settings = await getSiteSettings();
    return sendJson(res, 200, { live: true, settings });
  }
  if (req.method === "PUT") {
    if (!isDbConfigured()) return sendJson(res, 503, { error: "Database not configured", live: false });
    // Settings hold the money numbers — OWNER only (Staff System role gate).
    const gate = await requireRole(req, ["admin"]);
    if ("error" in gate) return sendJson(res, gate.error, roleErrorBody(gate.error));
    const b = await readJson(req);
    // Pass through every settings group the frontend manages — dropping a
    // group here would silently wipe it for every visitor on the next save
    // (plans had this bug; coupons/promoBanner/priceWatch joined in Phase 6).
    const value = {
      partnerTerms: b.partnerTerms || undefined, rates: b.rates || undefined, business: b.business || undefined,
      plans: b.plans || undefined, coupons: b.coupons || undefined,
      promoBanner: b.promoBanner || undefined, priceWatch: b.priceWatch || undefined,
    };
    await dbQuery(
      `INSERT INTO settings (key, value, updated_at) VALUES ('site', $1::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [JSON.stringify(value)],
    );
    return sendJson(res, 200, { ok: true, settings: value });
  }
  return methodNotAllowed(res, ["GET", "PUT"]);
});
