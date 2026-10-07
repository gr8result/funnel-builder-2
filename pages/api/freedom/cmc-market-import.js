import { withFreedomApi } from "../../../platform-core/api-guards/freedomApiGuard.js";

import { extractCmcMarketCandidatesFromSource } from "../../../lib/freedom/cmcMarketImport.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const result = await extractCmcMarketCandidatesFromSource({
      sourceType: req.body?.sourceType || "text",
      text: req.body?.text || "",
      csv: req.body?.csv || "",
      image: req.body?.image || null,
      imageText: req.body?.imageText || "",
      sourceSection: req.body?.sourceSection || "",
      sourceTimestamp: req.body?.sourceTimestamp || "",
    });
    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "CMC import failed.",
      candidates: [],
    });
  }
}

// M2.1: authentication + freedom entitlement enforced before this handler.
export default withFreedomApi(handler);
