import { withFreedomApi } from "../../../platform-core/api-guards/freedomApiGuard.js";

/**
 * AI Trade Import.
 *
 * Extracts broker rows for review and confirms checked rows into My Trades. This route
 * never contacts a broker and never stores source screenshots.
 */

import { extractBrokerImportFromSource, validateBrokerImportImage } from "../../../lib/freedom/tradeImport.js";
import { importReviewedTrades } from "../../../lib/freedom/tradeStore.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "30mb",
    },
  },
};

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const action = req.body?.action || "extract";
    if (action === "extract") {
      const sourceType = req.body?.sourceType || "text";
      if (sourceType === "image") {
        const validation = validateBrokerImportImage(req.body?.image || {});
        if (!validation.ok) return res.status(400).json({ ok: false, error: validation.error, rows: [] });
      }
      const result = await extractBrokerImportFromSource({
        sourceType: req.body?.sourceType || "text",
        text: req.body?.text || "",
        csv: req.body?.csv || "",
        image: req.body?.image || null,
      });
      if (result?.ok === false) return res.status(400).json(result);
      return res.status(200).json(result);
    }
    if (action === "confirm") {
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
      const result = await importReviewedTrades(rows);
      return res.status(200).json(result);
    }
    return res.status(400).json({ ok: false, error: "Unknown import action." });
  } catch (error) {
    console.error("Freedom trade import failed:", error);
    return res.status(500).json({ ok: false, error: error?.message || "Trade import failed." });
  }
}

// M2.1: authentication + freedom entitlement enforced before this handler.
export default withFreedomApi(handler);
