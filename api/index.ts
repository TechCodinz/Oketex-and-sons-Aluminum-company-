// The single Vercel function for the whole API. All routing lives in
// server/router.ts; all handlers in server/handlers/. vercel.json rewrites
// /api/* here (see BUILD_NOTES Phase 5 fix: function-count build failure).
// NOTE: imports across server/ use explicit .js extensions - the project is
// ESM ("type":"module") and Node ESM rejects extensionless specifiers at
// runtime even though bundlers/tsc accept them.
export { default } from "../server/router.js";
export const config = { api: { bodyParser: false } };
