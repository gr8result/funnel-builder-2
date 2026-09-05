import { withFreedomApi } from "../../../platform-core/api-guards/freedomApiGuard.js";
import { TRADER_WATCHLIST } from "../../../modules/freedom/data/watchlist.js";

function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, watchlist: [], error: "Method not allowed." });
  }

  return res.status(200).json({
    ok: true,
    watchlist: TRADER_WATCHLIST,
    count: TRADER_WATCHLIST.length,
    updatedAt: new Date().toISOString(),
  });
}

// M2.1: authentication + freedom entitlement enforced before this handler.
export default withFreedomApi(handler);
