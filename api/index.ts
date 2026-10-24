// The single Vercel function for the whole API. All routing lives in
// server/router.ts; all handlers in server/handlers/. vercel.json rewrites
// /api/* here (see BUILD_NOTES Phase 5 fix: function-count build failure).
export { default } from "../server/router";
export const config = { api: { bodyParser: false } };
