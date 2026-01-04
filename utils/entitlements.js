// utils/entitlements.js
// Simple cookie-based entitlement store you can ship now.
// Later: replace read/write with Supabase without changing page code.

import cookie from "cookie";

// Key names
const COOKIE_NAME = "gr8_entitlements";
const MODULES = {
  affiliateManagement: "affiliateManagement", // paid
  affiliateMarketplace: "affiliateMarketplace", // always free
};

// ----- Helpers -----
function parseCookie(req) {
  try {
    const cookies = cookie.parse(req?.headers?.cookie || "");
    return JSON.parse(cookies[COOKIE_NAME] || "{}");
  } catch {
    return {};
  }
}
function serializeCookie(obj) {
  return cookie.serialize(COOKIE_NAME, JSON.stringify(obj), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}

// ----- Public API (SSR) -----
export function getEntitlementSSR(req, moduleKey) {
  const store = parseCookie(req);
  const e = store[moduleKey];

  // Marketplace is always "free"
  if (moduleKey === MODULES.affiliateMarketplace) {
    return { status: "included", plan: "free" };
  }

  if (!e) return { status: "none" };

  // If it's a trial and expired, treat as none
  if (e.plan === "trial" && e.trialEndsAt) {
    const now = Date.now();
    const exp = new Date(e.trialEndsAt).getTime();
    if (now > exp) return { status: "expired" };
    return { status: "trial", plan: "trial", trialEndsAt: e.trialEndsAt };
  }

  // Active paid plan
  return { status: "active", plan: e.plan || "paid" };
}

export function setEntitlementSSR(res, moduleKey, payload) {
  // payload: { plan: 'trial'|'growth'|'scale', trialEndsAt?: ISO }
  // merge into cookie
  const existing = res.getHeader("Set-Cookie");
  const store = {};
  // We cannot read existing Set-Cookie reliably here; read from empty and trust incoming cookie on next request.
  // For simplicity: overwrite entirely based on incoming cookie isn't available; callers should pass previous cookie if needed.
  // Instead, we read from client on /api route via req... (use API below).
  // This helper is here if you want to set from getServerSideProps; not used in this starter.
}

// ----- Public API (Client) -----
export function readEntitlementsClient() {
  try {
    const raw = document.cookie.split("; ").find((c) => c.startsWith(COOKIE_NAME + "="));
    if (!raw) return {};
    return JSON.parse(decodeURIComponent(raw.split("=")[1] || "{}"));
  } catch {
    return {};
  }
}

export function moduleStateClient(moduleKey) {
  if (moduleKey === MODULES.affiliateMarketplace) {
    return { status: "included", plan: "free" };
  }
  const store = readEntitlementsClient();
  const e = store[moduleKey];
  if (!e) return { status: "none" };
  if (e.plan === "trial" && e.trialEndsAt && Date.now() > new Date(e.trialEndsAt).getTime()) {
    return { status: "expired" };
  }
  if (e.plan === "trial") return { status: "trial", trialEndsAt: e.trialEndsAt };
  return { status: "active", plan: e.plan };
}

export const MODULE_KEYS = MODULES;
