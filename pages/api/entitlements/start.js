// pages/api/entitlements/start.js
import cookie from "cookie";

const COOKIE_NAME = "gr8_entitlements";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  const { module: moduleKey, plan = "trial", trialDays = 14 } = req.query;
  if (!moduleKey) return res.status(400).json({ ok: false, error: "module required" });

  // read current cookie
  const cookies = cookie.parse(req.headers.cookie || "");
  let store = {};
  try { store = JSON.parse(cookies[COOKIE_NAME] || "{}"); } catch {}

  // set entitlement
  const body = { plan };
  if (plan === "trial") {
    const ends = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    body.trialEndsAt = ends.toISOString();
  }
  store[moduleKey] = body;

  res.setHeader(
    "Set-Cookie",
    cookie.serialize(COOKIE_NAME, JSON.stringify(store), {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    })
  );

  return res.status(200).json({ ok: true, store });
}

