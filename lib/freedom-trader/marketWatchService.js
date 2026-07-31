import { getCurrentPrice } from "./marketDataService.js";
import { runMarketWatchCycle } from "./marketWatchEngine.js";
import {
  marketWatchSnapshot,
  readMarketWatchStore,
  saveMarketWatchCycle,
  updateMarketWatchService,
} from "./marketWatchStore.js";

const SERVICE_KEY = "__freedomMarketWatchService";

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

export class MarketWatchService {
  constructor() {
    this.timer = null;
    this.running = false;
  }

  async status() {
    const store = await readMarketWatchStore();
    if (store.service?.enabled && !this.timer) this.schedule(store.settings.intervalSeconds);
    return marketWatchSnapshot({ ...store, service: { ...store.service, running: this.running } });
  }

  async start(reason = null) {
    const store = await readMarketWatchStore();
    const now = new Date();
    const nextScheduledCheckAt = new Date(now.getTime() + store.settings.intervalSeconds * 1000).toISOString();
    await updateMarketWatchService({ enabled: true, running: this.running, pausedReason: reason, nextScheduledCheckAt });
    this.schedule(store.settings.intervalSeconds);
    return this.status();
  }

  async pause(reason = "Monitoring paused.") {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await updateMarketWatchService({ enabled: false, running: false, pausedReason: reason, nextScheduledCheckAt: null });
    return this.status();
  }

  async runNow() {
    return this.runCycle({ manual: true });
  }

  schedule(intervalSeconds = 60) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.runCycle().catch((error) => console.error("Freedom Market Watch background cycle failed:", error));
    }, Math.max(1, Number(intervalSeconds) || 60) * 1000);
    if (typeof this.timer.unref === "function") this.timer.unref();
  }

  async runCycle({ manual = false } = {}) {
    const store = await readMarketWatchStore();
    if (!manual && !store.service?.enabled) return marketWatchSnapshot(store);
    if (this.running) {
      const skipped = await updateMarketWatchService({ pausedReason: "Previous market watch cycle is still running; skipped this cycle." });
      return { ...skipped, skipped: true };
    }

    this.running = true;
    const startedAt = new Date().toISOString();
    await updateMarketWatchService({ running: true, lastCheckStartedAt: startedAt, lastError: null });
    try {
      const result = await runMarketWatchCycle({
        plans: store.plans,
        alerts: store.alerts,
        settings: store.settings,
        fetchQuote,
      });
      const finishedAt = new Date().toISOString();
      const nextScheduledCheckAt = store.service?.enabled
        ? new Date(Date.now() + result.settings.intervalSeconds * 1000).toISOString()
        : null;
      const hasSuccessfulPrice = result.evaluations.some((item) => item.currentPrice != null);
      const snapshot = await saveMarketWatchCycle(result, {
        enabled: store.service?.enabled,
        running: false,
        pausedReason: store.service?.enabled ? null : "Monitoring paused.",
        lastCheckStartedAt: startedAt,
        lastCheckFinishedAt: finishedAt,
        nextScheduledCheckAt,
        lastSuccessfulMarketUpdateAt: hasSuccessfulPrice ? finishedAt : store.service?.lastSuccessfulMarketUpdateAt || null,
        lastError: result.errors.length ? `${result.errors.length} symbol${result.errors.length === 1 ? "" : "s"} had market data errors.` : null,
      });
      if (snapshot.service?.enabled) this.schedule(result.settings.intervalSeconds);
      return snapshot;
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const nextScheduledCheckAt = store.service?.enabled
        ? new Date(Date.now() + store.settings.intervalSeconds * 1000).toISOString()
        : null;
      const snapshot = await updateMarketWatchService({
        enabled: store.service?.enabled,
        running: false,
        pausedReason: store.service?.enabled ? null : "Monitoring paused.",
        lastCheckStartedAt: startedAt,
        lastCheckFinishedAt: finishedAt,
        nextScheduledCheckAt,
        lastError: error.message || "Market Watch cycle failed.",
      });
      if (snapshot.service?.enabled) this.schedule(store.settings.intervalSeconds);
      return snapshot;
    } finally {
      this.running = false;
    }
  }
}

export function getMarketWatchService() {
  if (!globalThis[SERVICE_KEY]) globalThis[SERVICE_KEY] = new MarketWatchService();
  return globalThis[SERVICE_KEY];
}
