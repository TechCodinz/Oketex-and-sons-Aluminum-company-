import { sendJson, wrap } from "../../http.js";
import { clearCookieHeader } from "../../auth.js";
export default wrap(async (_req: any, res: any) => {
  res.setHeader("Set-Cookie", clearCookieHeader());
  return sendJson(res, 200, { ok: true });
});
