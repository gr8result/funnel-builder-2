// pages/api/social/platform-settings.js
// GET  — returns configured platforms for the current user (secrets masked)
// POST — save credentials for one platform
// DELETE — remove credentials for one platform

import { requireUser } from "../../../lib/social/auth";
import { savePlatformCredentials, deletePlatformCredentials } from "../../../lib/social/platformCredentials";

const SUPPORTED_PLATFORMS = ["meta", "tiktok", "linkedin", "x", "youtube"];

export default async function handler(req, res) {
  const auth = await requireUser(req);
  if (auth.error) return res.status(401).json({ ok: false, error: auth.error });

  const { user, admin } = auth;

  // ── GET — list configured platforms ──────────────────────────────────
  if (req.method === "GET") {
    const { data, error } = await admin
      .from("social_app_credentials")
      .select("platform, app_id, updated_at")
      .eq("user_id", user.id)
      .in("platform", SUPPORTED_PLATFORMS);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    const configured = (data || []).reduce((acc, row) => {
      acc[row.platform] = { appId: row.app_id, updatedAt: row.updated_at };
      return acc;
    }, {});

    return res.status(200).json({ ok: true, configured });
  }

  // ── POST — save credentials ───────────────────────────────────────────
  if (req.method === "POST") {
    const { platform, appId, appSecret } = req.body || {};

    if (!platform || !SUPPORTED_PLATFORMS.includes(platform)) {
      return res.status(400).json({ ok: false, error: "Invalid platform" });
    }
    if (!appId || !String(appId).trim()) {
      return res.status(400).json({ ok: false, error: "App ID is required" });
    }

    try {
      await savePlatformCredentials(admin, user.id, platform, String(appId), String(appSecret || ""));
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ── DELETE — remove credentials ───────────────────────────────────────
  if (req.method === "DELETE") {
    const platform = String(req.query.platform || req.body?.platform || "").trim();
    if (!platform || !SUPPORTED_PLATFORMS.includes(platform)) {
      return res.status(400).json({ ok: false, error: "Invalid platform" });
    }
    try {
      await deletePlatformCredentials(admin, user.id, platform);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
