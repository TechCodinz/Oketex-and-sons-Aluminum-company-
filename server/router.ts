// Single-entry API router. All handlers live in server/handlers/ and are
// dispatched here by method + path. WHY ONE FUNCTION: with 17 separate
// Vercel functions (each tracing drizzle-orm + pg + the full server lib),
// the Hobby build failed deterministically once the function count passed
// ~12 (bisected on the deploy-test branch, 2026-10-24: 12 OK, 14 fail,
// content-independent). One function traces the shared deps once.
import { sendJson } from "./http";
import health from "./handlers/health";
import setup from "./handlers/setup";
import register from "./handlers/auth/register";
import login from "./handlers/auth/login";
import logout from "./handlers/auth/logout";
import me from "./handlers/auth/me";
import partners from "./handlers/partners";
import partnerByCode from "./handlers/partners/[code]";
import adminPartners from "./handlers/admin/partners";
import leads from "./handlers/leads";
import bookings from "./handlers/bookings";
import orders from "./handlers/orders";
import quotes from "./handlers/quotes";
import settings from "./handlers/settings";
import offers from "./handlers/offers";
import payInit from "./handlers/payments/initialize";
import payVerify from "./handlers/payments/verify";
import payWebhook from "./handlers/payments/webhook";

const exact: Record<string, any> = {
  "/api/health": health,
  "/api/setup": setup,
  "/api/auth/register": register,
  "/api/auth/login": login,
  "/api/auth/logout": logout,
  "/api/auth/me": me,
  "/api/partners": partners,
  "/api/admin/partners": adminPartners,
  "/api/leads": leads,
  "/api/bookings": bookings,
  "/api/orders": orders,
  "/api/quotes": quotes,
  "/api/settings": settings,
  "/api/offers": offers,
  "/api/payments/initialize": payInit,
  "/api/payments/verify": payVerify,
  "/api/payments/webhook": payWebhook,
};

export default async function router(req: any, res: any) {
  try {
    const u = new URL(req.url || "/", "http://localhost");
    const path = u.pathname.replace(/\/$/, "") || "/";
    // Handlers read req.query (Vercel normally populates it) - rebuild it
    // from the URL so behaviour is identical under the single function.
    req.query = Object.fromEntries(u.searchParams.entries());
    let handler = exact[path];
    if (!handler) {
      const m = path.match(/^\/api\/partners\/([^/]+)$/);
      if (m) { req.query.code = decodeURIComponent(m[1]); handler = partnerByCode; }
    }
    if (!handler) return sendJson(res, 404, { error: "Not found", path });
    return await handler(req, res);
  } catch (err) {
    console.error("[api-router]", req?.url, err);
    return sendJson(res, 500, { error: "Internal error" });
  }
}
