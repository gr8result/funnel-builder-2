import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSupabaseAdmin } from "../supabaseAdmin.js";
import { developmentOwnerId } from "./paperTrading.js";
import {
  DEFAULT_MARKET_WATCH_SETTINGS,
  buildMarketWatchAnswer,
  normalizeMarketWatchSettings,
  updateAlertState,
  upsertMonitoredPlans,
} from "./marketWatchEngine.js";

const STORE_PATH = path.join(process.cwd(), "tmp", "freedom-market-watch.json");
const STORE_TABLE = "freedom_market_watch_state";

function emptyStore() {
  return {
    version: 1,
    settings: DEFAULT_MARKET_WATCH_SETTINGS,
    service: {
      enabled: false,
      running: false,
      pausedReason: "Monitoring paused.",
      lastCheckStartedAt: null,
      lastCheckFinishedAt: null,
      nextScheduledCheckAt: null,
      lastSuccessfulMarketUpdateAt: null,
      lastError: null,
    },
    plans: [],
    alerts: [],
    cycles: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeStore(parsed = {}, extra = {}) {
  return {
    ...emptyStore(),
    ...parsed,
    settings: normalizeMarketWatchSettings(parsed?.settings || {}),
    service: { ...emptyStore().service, ...(parsed?.service || {}) },
    plans: Array.isArray(parsed?.plans) ? parsed.plans : [],
    alerts: Array.isArray(parsed?.alerts) ? parsed.alerts : [],
    cycles: Array.isArray(parsed?.cycles) ? parsed.cycles : [],
    ...extra,
  };
}

function getSupabase() {
  try {
    return createSupabaseAdmin();
  } catch {
    return null;
  }
}

async function readLocalStore(extra = {}) {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    return normalizeStore(JSON.parse(raw), { _storageMode: "local", ...extra });
  } catch {
    return normalizeStore({}, { _storageMode: "local", ...extra });
  }
}

export async function readMarketWatchStore() {
  const supabase = getSupabase();
  if (!supabase) return readLocalStore({ _persistenceError: "Supabase is unavailable; using local server fallback." });
  try {
    const { data, error } = await supabase
      .from(STORE_TABLE)
      .select("state")
      .eq("user_id", developmentOwnerId())
      .maybeSingle();
    if (error) throw error;
    if (data?.state) return normalizeStore(data.state, { _storageMode: "supabase" });
    return readLocalStore();
  } catch (error) {
    return readLocalStore({ _persistenceError: error.message || "Market Watch database unavailable; using local server fallback." });
  }
}

export async function writeMarketWatchStore(store) {
  const next = { ...store, updatedAt: new Date().toISOString() };
  delete next._storageMode;
  delete next._persistenceError;
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.from(STORE_TABLE).upsert({
        user_id: developmentOwnerId(),
        state: next,
        updated_at: next.updatedAt,
      }, { onConflict: "user_id" });
      if (!error) return { ...next, _storageMode: "supabase" };
    } catch {
      // Fall through to the local server fallback below.
    }
  }
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(next, null, 2));
  return { ...next, _storageMode: "local", _persistenceError: supabase ? "Market Watch database unavailable; using local server fallback." : "Supabase is unavailable; using local server fallback." };
}

export async function addMarketWatchPlans(plans = []) {
  const store = await readMarketWatchStore();
  const { plans: nextPlans, created } = upsertMonitoredPlans(store.plans, plans, store.settings);
  const saved = await writeMarketWatchStore({ ...store, plans: nextPlans, service: { ...store.service, enabled: true, pausedReason: null } });
  return marketWatchSnapshot(saved, { created });
}

export async function saveMarketWatchCycle(result, servicePatch = {}) {
  const store = await readMarketWatchStore();
  const cycles = [{
    startedAt: servicePatch.lastCheckStartedAt || result.checkedAt,
    finishedAt: servicePatch.lastCheckFinishedAt || result.checkedAt,
    status: result.errors?.length && !result.evaluations?.some((item) => item.currentPrice != null) ? "failed" : "completed",
    symbolsChecked: result.evaluations?.map((item) => item.plan.symbol) || [],
    alertsCreated: result.newAlerts.length,
    errors: result.errors || [],
    marketDataQuality: result.marketDataQuality || "unavailable",
  }, ...store.cycles].slice(0, 50);
  const saved = await writeMarketWatchStore({
    ...store,
    settings: result.settings,
    service: { ...store.service, ...servicePatch },
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

export async function updateMarketWatchService(patch = {}) {
  const store = await readMarketWatchStore();
  const saved = await writeMarketWatchStore({ ...store, service: { ...store.service, ...patch } });
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

export async function clearCompletedMarketWatchAlerts() {
  const store = await readMarketWatchStore();
  const alerts = store.alerts.filter((alert) => !alert.completedAt && !alert.dismissedAt);
  const saved = await writeMarketWatchStore({ ...store, alerts });
  return marketWatchSnapshot(saved);
}

export function marketWatchSnapshot(store, extra = {}) {
  const alerts = [...(store.alerts || [])].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const plans = store.plans || [];
  return {
    ok: true,
    settings: normalizeMarketWatchSettings(store.settings),
    service: store.service || emptyStore().service,
    plans,
    alerts,
    cycles: store.cycles || [],
    lastCheck: store.service?.lastCheckFinishedAt || null,
    nextCheck: store.service?.nextScheduledCheckAt || null,
    lastSuccessfulMarketUpdate: store.service?.lastSuccessfulMarketUpdateAt || null,
    monitoringLabel: store.service?.enabled ? "Monitoring running" : "Monitoring paused",
    pausedReason: store.service?.pausedReason || null,
    answer: buildMarketWatchAnswer(plans, alerts),
    storageMode: store._storageMode || "local",
    localStorePath: STORE_PATH,
    persistenceError: store._persistenceError || null,
    error: null,
    ...extra,
  };
}
