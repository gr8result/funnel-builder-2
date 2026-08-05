import { getMarketWatchService } from "../../../lib/freedom-trader/marketWatchService.js";
import {
  addMarketWatchPlans,
  clearCompletedMarketWatchAlerts,
  updateMarketWatchPlan,
  updateMarketWatchAlert,
  updateMarketWatchSettings,
} from "../../../lib/freedom-trader/marketWatchStore.js";

export default async function handler(req, res) {
  try {
    const service = getMarketWatchService();
    if (req.method === "GET") {
      return res.status(200).json(await service.status());
    }

    if (req.method === "POST") {
      const action = String(req.body?.action || "status").toLowerCase();
      if (action === "register") {
        const plans = Array.isArray(req.body?.plans) ? req.body.plans : [];
        await addMarketWatchPlans(plans);
        return res.status(200).json(await service.start());
      }
      if (action === "settings") {
        await updateMarketWatchSettings(req.body?.settings || {});
        const store = await service.status();
        return res.status(200).json(store.service?.enabled ? await service.start() : store);
      }
      if (action === "start") return res.status(200).json(await service.start());
      if (action === "pause") return res.status(200).json(await service.pause());
      if (action === "run-now") return res.status(200).json(await service.runNow());
      if (action === "clear-completed") return res.status(200).json(await clearCompletedMarketWatchAlerts());
      if (action === "order-entered") {
        const planId = req.body?.planId || req.body?.id;
        if (!planId) return res.status(400).json({ ok: false, error: "Plan id is required." });
        return res.status(200).json(await updateMarketWatchPlan(planId, { brokerState: "ORDER ENTERED IN CMC", orderEnteredAt: new Date().toISOString() }));
      }
      if (action === "order-filled") {
        const planId = req.body?.planId || req.body?.id;
        const actualEntryPrice = Number(req.body?.actualEntryPrice ?? req.body?.fillPrice);
        if (!planId || !Number.isFinite(actualEntryPrice) || actualEntryPrice <= 0) return res.status(400).json({ ok: false, error: "Plan id and actual filled price are required." });
        return res.status(200).json(await updateMarketWatchPlan(planId, {
          brokerState: "ORDER FILLED",
          state: "ACTIVE",
          actualEntryPrice,
          entryPrice: actualEntryPrice,
          orderFilledAt: new Date().toISOString(),
          entryFilledAt: new Date().toISOString(),
        }));
      }
      return res.status(200).json(await service.status());
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
