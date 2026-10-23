import { sendJson, wrap } from "../../server/http";
import { clearCookieHeader } from "../../server/auth";
export default wrap(async (_req: any, res: any) => {
  res.setHeader("Set-Cookie", clearCookieHeader());
  return sendJson(res, 200, { ok: true });
});
