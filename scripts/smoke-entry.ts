// Bundle entry for scripts/smoke-api.mjs — re-exports every API handler plus
// the server libs under test. esbuild redirects ../server/db to the pg-mem
// mock (scripts/mock-db.mjs) so handlers run against in-memory Postgres.
export { default as health } from "../api/health";
export { default as setup } from "../api/setup";
export { default as register } from "../api/auth/register";
export { default as login } from "../api/auth/login";
export { default as logout } from "../api/auth/logout";
export { default as me } from "../api/auth/me";
export { default as partners } from "../api/partners";
export { default as partnerByCode } from "../api/partners/[code]";
export { default as adminPartners } from "../api/admin/partners";
export { default as leads } from "../api/leads";
export { default as bookings } from "../api/bookings";
export { default as orders } from "../api/orders";
export { default as quotes } from "../api/quotes";
export { default as settings } from "../api/settings";
export { default as offers } from "../api/offers";
export { default as payInit } from "../api/payments/initialize";
export { default as webhook } from "../api/payments/webhook";
export * as authLib from "../server/auth";
export * as paystackLib from "../server/paystack";
export { SCHEMA_STATEMENTS, SCHEMA_SQL } from "../server/schema.sql";
export { dbQuery } from "../server/db";
