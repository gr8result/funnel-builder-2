import { withFreedomApi } from "../../../platform-core/api-guards/freedomApiGuard.js";

import { AlpacaProvider, providerSummary } from "../../../lib/freedom-trader/marketDataProviders.js";

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const auth = await AlpacaProvider.authenticate().catch((error) => ({
    configured: AlpacaProvider.hasCredentials(),
    ok: false,
    provider: "Alpaca",
    error: error?.message || "Alpaca authentication failed.",
  }));

  return res.status(200).json({
    ok: auth.ok,
    configured: auth.configured,
    provider: "Alpaca",
    authentication: auth.ok ? "SUCCESS" : "FAILURE",
    status: auth.status || null,
    statusCode: auth.statusCode || null,
    error: auth.ok ? null : auth.error || "Alpaca authentication failed.",
    summary: providerSummary(),
    updatedAt: new Date().toISOString(),
  });
}

// M2.1: authentication + freedom entitlement enforced before this handler.
// External market-data proxy: no stored Freedom rows, so no owner-isolation gate.
export default withFreedomApi(handler, { touchesData: false });
