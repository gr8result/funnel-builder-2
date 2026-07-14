import { importCompany, previewCompany, searchCompanies } from "../../../lib/freedom-terminal/importEngine";
import { normalizeTicker } from "../../../lib/freedom-terminal/core";

function getAction(req) {
  return String(req.query.action || req.body?.action || "").trim().toLowerCase();
}

function getTicker(req) {
  return normalizeTicker(req.query.ticker || req.query.symbol || req.body?.ticker || req.body?.symbol);
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const action = getAction(req) || "search";

      if (action === "search") {
        const query = String(req.query.q || req.query.query || req.query.ticker || "").trim();
        const results = await searchCompanies(query);
        return res.status(200).json({ ok: true, results });
      }

      if (action === "preview") {
        const ticker = getTicker(req);
        if (!ticker) return res.status(400).json({ ok: false, error: "Ticker is required." });
        const preview = await previewCompany(ticker);
        return res.status(200).json({ ok: true, preview });
      }

      return res.status(400).json({ ok: false, error: "Unknown import action." });
    }

    if (req.method === "POST") {
      const action = getAction(req) || "import";
      if (action !== "import") return res.status(400).json({ ok: false, error: "Unknown import action." });

      const ticker = getTicker(req);
      if (!ticker) return res.status(400).json({ ok: false, error: "Ticker is required." });

      const result = await importCompany(ticker);
      return res.status(200).json(result);
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  } catch (error) {
    console.error("Freedom Terminal import API error:", error);
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message || "Unable to run company import.",
    });
  }
}
