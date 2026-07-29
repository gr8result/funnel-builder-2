// pages/api/dev/detection-health.js
// Development-only health check for the Takeoff Engine's automatic wall
// detection pipeline — lets you tell a configuration problem apart from an
// actual plan-analysis failure without ever exposing secrets. Gated by
// withAdmin (same convention as the other pages/api/dev/* diagnostics
// routes), which itself requires a valid Bearer token, so this still proves
// "applicationAuth" by virtue of having been reached at all.

import { withAdmin } from "../../../lib/withAdmin";

async function handler(_req, res) {
  const providerConfigured = Boolean(process.env.OPENAI_API_KEY);

  let providerReachable = false;
  if (providerConfigured) {
    try {
      // A cheap, unauthenticated-body request — we only care whether the
      // provider's network endpoint responds at all, not about a real
      // detection call. A 401 here (from a bad key) still means "reachable."
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      });
      providerReachable = response.status !== undefined; // any HTTP response at all
    } catch {
      providerReachable = false;
    }
  }

  return res.status(200).json({
    applicationAuth: "ready", // reaching this line at all means withAdmin's session check passed
    providerConfigured,
    providerReachable,
    modelConfigured: true, // the model name ("gpt-4o") is hardcoded in pages/api/ai/plan-detect.js, not env-driven
    pdfGeometryEngineReady: true, // local vector extraction (modules/takeoff-v2/geometry/) needs no external service
  });
}

export default withAdmin(handler);
