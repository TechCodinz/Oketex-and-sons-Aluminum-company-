import { sendJson, wrap } from "../../http.js";
import { getSessionUser } from "../../auth.js";
// Reflects the current session (including the env admin bootstrap identity).
export default wrap(async (req: any, res: any) => {
  const user = await getSessionUser(req);
  if (!user) return sendJson(res, 401, { user: null });
  return sendJson(res, 200, { user });
});
