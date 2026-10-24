import { sendJson, methodNotAllowed, readJson, wrap } from "../http.js";
import { dbQuery, isDbConfigured } from "../db.js";
import { isAdmin } from "../auth.js";
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
    if (!(await isAdmin(req))) return sendJson(res, 401, { error: "Admin session required" });
    const b = await readJson(req);
    const value = { partnerTerms: b.partnerTerms || undefined, rates: b.rates || undefined, business: b.business || undefined };
    await dbQuery(
      `INSERT INTO settings (key, value, updated_at) VALUES ('site', $1::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [JSON.stringify(value)],
    );
    return sendJson(res, 200, { ok: true, settings: value });
  }
  return methodNotAllowed(res, ["GET", "PUT"]);
});
