import { getCurrentPrice } from "../../../lib/freedom-trader/marketDataService.js";
import { runMarketWatchCycle } from "../../../lib/freedom-trader/marketWatchEngine.js";
import {
  addMarketWatchPlans,
  marketWatchSnapshot,
  readMarketWatchStore,
  saveMarketWatchCycle,
  updateMarketWatchAlert,
  updateMarketWatchSettings,
} from "../../../lib/freedom-trader/marketWatchStore.js";

async function fetchQuote(symbol) {
  const quote = await getCurrentPrice(symbol);
  return {
    price: quote?.price,
    currentPrice: quote?.price,
    dataQuality: quote?.dataQuality,
    timestamp: quote?.timestamp,
    error: quote?.error,
  };
}

async function runCycle() {
  const store = await readMarketWatchStore();
  const result = await runMarketWatchCycle({
    plans: store.plans,
    alerts: store.alerts,
    settings: store.settings,
    fetchQuote,
  });
  return saveMarketWatchCycle(result);
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const store = await readMarketWatchStore();
      return res.status(200).json(marketWatchSnapshot(store));
    }

    if (req.method === "POST") {
      const action = String(req.body?.action || "cycle").toLowerCase();
      if (action === "register") {
        const plans = Array.isArray(req.body?.plans) ? req.body.plans : [];
        return res.status(200).json(await addMarketWatchPlans(plans));
      }
      if (action === "settings") {
        return res.status(200).json(await updateMarketWatchSettings(req.body?.settings || {}));
      }
      return res.status(200).json(await runCycle());
    }

    if (req.method === "PATCH") {
      const id = req.body?.id;
      const action = String(req.body?.action || "").toLowerCase();
      if (!id || !["acknowledge", "dismiss", "complete"].includes(action)) {
        return res.status(400).json({ ok: false, error: "Alert id and action are required." });
      }
      return res.status(200).json(await updateMarketWatchAlert(id, action));
    }

    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  } catch (error) {
    console.error("Freedom Market Watch failed:", error);
    return res.status(500).json({ ok: false, error: error.message || "Market Watch failed." });
  }
}
