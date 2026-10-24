// Bundle entry for scripts/smoke-api.mjs — re-exports every API handler plus
// the server libs under test. esbuild redirects ../server/db to the pg-mem
// mock (scripts/mock-db.mjs) so handlers run against in-memory Postgres.
export { default as health } from "../server/handlers/health";
export { default as setup } from "../server/handlers/setup";
export { default as register } from "../server/handlers/auth/register";
export { default as login } from "../server/handlers/auth/login";
export { default as logout } from "../server/handlers/auth/logout";
export { default as me } from "../server/handlers/auth/me";
export { default as partners } from "../server/handlers/partners";
export { default as partnerByCode } from "../server/handlers/partners/[code]";
export { default as adminPartners } from "../server/handlers/admin/partners";
export { default as leads } from "../server/handlers/leads";
export { default as bookings } from "../server/handlers/bookings";
export { default as orders } from "../server/handlers/orders";
export { default as quotes } from "../server/handlers/quotes";
export { default as settings } from "../server/handlers/settings";
export { default as offers } from "../server/handlers/offers";
export { default as payInit } from "../server/handlers/payments/initialize";
export { default as webhook } from "../server/handlers/payments/webhook";
export * as authLib from "../server/auth";
export * as paystackLib from "../server/paystack";
export { SCHEMA_STATEMENTS, SCHEMA_SQL } from "../server/schema.sql";
export { dbQuery } from "../server/db";
