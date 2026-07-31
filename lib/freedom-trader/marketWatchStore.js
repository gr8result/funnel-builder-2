import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_MARKET_WATCH_SETTINGS,
  buildMarketWatchAnswer,
  normalizeMarketWatchSettings,
  updateAlertState,
  upsertMonitoredPlans,
} from "./marketWatchEngine.js";

const STORE_PATH = path.join(process.cwd(), "tmp", "freedom-market-watch.json");

function emptyStore() {
  return {
    version: 1,
    settings: DEFAULT_MARKET_WATCH_SETTINGS,
    plans: [],
    alerts: [],
    cycles: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function readMarketWatchStore() {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...emptyStore(),
      ...parsed,
      settings: normalizeMarketWatchSettings(parsed?.settings || {}),
      plans: Array.isArray(parsed?.plans) ? parsed.plans : [],
      alerts: Array.isArray(parsed?.alerts) ? parsed.alerts : [],
      cycles: Array.isArray(parsed?.cycles) ? parsed.cycles : [],
    };
  } catch {
    return emptyStore();
  }
}

export async function writeMarketWatchStore(store) {
  const next = { ...store, updatedAt: new Date().toISOString() };
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(next, null, 2));
  return next;
}

export async function addMarketWatchPlans(plans = []) {
  const store = await readMarketWatchStore();
  const { plans: nextPlans, created } = upsertMonitoredPlans(store.plans, plans, store.settings);
  const saved = await writeMarketWatchStore({ ...store, plans: nextPlans });
  return marketWatchSnapshot(saved, { created });
}

export async function saveMarketWatchCycle(result) {
  const store = await readMarketWatchStore();
  const cycles = [{ checkedAt: result.checkedAt, newAlerts: result.newAlerts.length, monitored: result.plans.length }, ...store.cycles].slice(0, 25);
  const saved = await writeMarketWatchStore({
    ...store,
    settings: result.settings,
    plans: result.plans,
    alerts: result.alerts,
    cycles,
  });
  return marketWatchSnapshot(saved, { newAlerts: result.newAlerts, evaluations: result.evaluations, checkedAt: result.checkedAt });
}

export async function updateMarketWatchSettings(settings = {}) {
  const store = await readMarketWatchStore();
  const saved = await writeMarketWatchStore({ ...store, settings: normalizeMarketWatchSettings({ ...store.settings, ...settings }) });
  return marketWatchSnapshot(saved);
}

export async function updateMarketWatchAlert(id, action) {
  const store = await readMarketWatchStore();
  const now = new Date().toISOString();
  let patch = {};
  if (action === "acknowledge") patch = { acknowledgedAt: now };
  if (action === "dismiss") patch = { dismissedAt: now, acknowledgedAt: now };
  if (action === "complete") patch = { completedAt: now, acknowledgedAt: now };
  const saved = await writeMarketWatchStore({ ...store, alerts: updateAlertState(store.alerts, id, patch) });
  return marketWatchSnapshot(saved);
}

export function marketWatchSnapshot(store, extra = {}) {
  const alerts = [...(store.alerts || [])].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const plans = store.plans || [];
  return {
    ok: true,
    settings: normalizeMarketWatchSettings(store.settings),
    plans,
    alerts,
    answer: buildMarketWatchAnswer(plans, alerts),
    storageMode: "local",
    localStorePath: STORE_PATH,
    error: null,
    ...extra,
  };
}
