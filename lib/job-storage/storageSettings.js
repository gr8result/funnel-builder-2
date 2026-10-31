// Where this builder's jobs are stored, chosen on the Storage Settings screen:
//
//   local    LOCAL ONLY - single user. Jobs live in this browser's storage on this computer.
//   shared   SHARED - multi-user. Every job save is also committed to the builder's own job
//            server (office server / NAS or the builder's cloud host), which refuses a save based
//            on an older revision than another user has since saved.
//
// Nothing changes mode by itself. Switching to shared sends nothing until a job is next saved or
// is explicitly published; switching back to local leaves every local job exactly as it is.
// The settings are per builder workspace and stay on this computer (the access token included).

import { browserTenantKey } from "../builders/browserTenantStorage.js";

export const STORAGE_SETTINGS_KEY = "gr8:job-storage-settings";
export const STORAGE_MODES = Object.freeze({
  local: { key: "local", label: "Local Only", description: "Single-user storage on this computer. Nobody else can open these jobs." },
  shared: { key: "shared", label: "Shared Storage", description: "Multi-user storage on your own office server / NAS or cloud host. Staff open and save the same jobs, with conflict protection." },
});
const text = (value) => String(value ?? "").trim();
const DEFAULTS = Object.freeze({ mode: "local", serverUrl: "", companyId: "", token: "", userName: "", lastTest: null });

export function normaliseStorageSettings(value = {}) {
  return { mode: value?.mode === "shared" ? "shared" : "local", serverUrl: text(value?.serverUrl).replace(/\/+$/, ""), companyId: text(value?.companyId), token: text(value?.token), userName: text(value?.userName), lastTest: value?.lastTest || null };
}
export function loadStorageSettings(storage = typeof window !== "undefined" ? window.localStorage : null) {
  if (!storage) return { ...DEFAULTS };
  try { return normaliseStorageSettings(JSON.parse(storage.getItem(browserTenantKey(STORAGE_SETTINGS_KEY)) || "null") || DEFAULTS); } catch { return { ...DEFAULTS }; }
}
export function saveStorageSettings(settings, storage = typeof window !== "undefined" ? window.localStorage : null) {
  const next = normaliseStorageSettings(settings);
  if (next.mode === "shared") { const problem = sharedSettingsProblem(next); if (problem) throw new Error(problem); }
  storage?.setItem(browserTenantKey(STORAGE_SETTINGS_KEY), JSON.stringify(next));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("gr8:job-storage-settings", { detail: { mode: next.mode } }));
  return next;
}

// A shared server reached from outside the office must be HTTPS (or sit behind a VPN, which gives
// it a private address). Plain HTTP is accepted only for this computer and private office-network
// addresses; anything else would send the access token and the job in the clear.
const PRIVATE_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|[^.]+|.+\.(local|lan|home|internal))$/i;
export function serverAddressCheck(serverUrl = "") {
  let url;
  try { url = new URL(text(serverUrl)); } catch { return { ok: false, reason: "Enter the server address, for example https://jobs.yourcompany.com.au or http://office-server:4780." }; }
  if (url.protocol === "https:") return { ok: true, secure: true, scope: "HTTPS" };
  if (url.protocol !== "http:") return { ok: false, reason: "The address must start with https:// (or http:// on the office network)." };
  if (PRIVATE_HOST.test(url.hostname)) return { ok: true, secure: false, scope: "Office network (private address)", warning: "Plain HTTP is only safe inside the office network or over a VPN." };
  return { ok: false, reason: "A server reached over the internet must use https://. Plain http:// is accepted only for an office-network address or over a VPN." };
}
export function sharedSettingsProblem(settings = {}) {
  const check = serverAddressCheck(settings.serverUrl);
  if (!check.ok) return check.reason;
  if (!text(settings.companyId)) return "Enter the company ID your administrator gave you.";
  if (!text(settings.token)) return "Enter your access token.";
  return "";
}

// Asks the server who this token is. { ok, user, storage, secure } or { ok: false, reason }.
export async function testStorageConnection(settings = {}, fetchImpl = globalThis.fetch) {
  const problem = sharedSettingsProblem(settings);
  if (problem) return { ok: false, reason: problem };
  const address = serverAddressCheck(settings.serverUrl);
  let response;
  try { response = await fetchImpl(`${text(settings.serverUrl).replace(/\/+$/, "")}/v1/whoami`, { headers: { authorization: `Bearer ${settings.token}` } }); }
  catch { return { ok: false, reason: "The server could not be reached. Check the address, that the job server is running, and that this computer is on the office network or VPN." }; }
  if (response.status === 401) return { ok: false, reason: "The server refused this access token." };
  if (!response.ok) return { ok: false, reason: `The server answered with an error (${response.status}).` };
  const body = await response.json().catch(() => null);
  if (!body?.user) return { ok: false, reason: "That address is not a GR8 Result job server." };
  if (body.user.companyId !== text(settings.companyId)) return { ok: false, reason: "This access token belongs to a different company than the company ID entered." };
  return { ok: true, user: body.user, storage: body.storage, secure: address.secure, scope: address.scope, warning: address.warning || "", testedAt: new Date().toISOString() };
}
