import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import {
  createWebsiteUnlockSession,
  getWebsiteLockStatus,
  getWebsiteUnlockTokenFromRequest,
  isProtectedWebsiteProject,
  relockWebsite,
  WEBSITE_LOCK_CONFIRMATION,
} from "../../../lib/website-builder/contentLock";

function getBearerToken(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

async function requireUser(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: "Missing Bearer token" });
    return null;
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) {
    res.status(401).json({ ok: false, error: error?.message || "Authentication failed" });
    return null;
  }
  return data.user;
}

async function requireSiteOwner(userId, projectId) {
  if (!isProtectedWebsiteProject(projectId)) return true;
  const { data, error } = await supabaseAdmin
    .from("website_builder_sites")
    .select("user_id")
    .eq("site_id", String(projectId || "").replace(/^draft:/, ""))
    .maybeSingle();
  if (error) throw error;
  return data?.user_id === userId;
}

async function getCurrentDraftLockRevision(projectId) {
  const { data, error } = await supabaseAdmin
    .from("website_builder_sites")
    .select("site_data, updated_at")
    .eq("site_id", String(projectId || "").replace(/^draft:/, ""))
    .maybeSingle();
  if (error) throw error;
  const siteData = data?.site_data && typeof data.site_data === "object" ? data.site_data : {};
  return {
    draftRevision: String(siteData.projectVersion || siteData.savedAt || data?.updated_at || ""),
    draftUpdatedAt: String(data?.updated_at || siteData.updatedAt || siteData.savedAt || ""),
    contentHash: String(siteData.contentHash || ""),
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const projectId = String(req.query?.projectId || req.body?.projectId || "").trim().replace(/^draft:/, "");
  if (!projectId) return res.status(400).json({ ok: false, error: "projectId is required" });

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      ...getWebsiteLockStatus(projectId, getWebsiteUnlockTokenFromRequest(req)),
      confirmation: WEBSITE_LOCK_CONFIRMATION,
    });
  }

  const user = await requireUser(req, res);
  if (!user) return;
  const isOwner = await requireSiteOwner(user.id, projectId);
  if (!isOwner) return res.status(403).json({ ok: false, error: "Only the authenticated site owner can unlock this approved website." });

  if (req.method === "POST") {
    const action = String(req.body?.action || "").trim().toLowerCase();
    if (action !== "unlock") {
      return res.status(400).json({ ok: false, error: "Use action=unlock to deliberately unlock this protected website." });
    }
    const revision = await getCurrentDraftLockRevision(projectId);
    const session = createWebsiteUnlockSession({
      userId: user.id,
      projectId,
      confirmation: req.body?.confirmation,
      ...revision,
    });
    if (!session.ok) return res.status(session.status || 400).json({ ok: false, error: session.error });
    return res.status(200).json({
      ok: true,
      locked: false,
      unlockToken: session.token,
      editSessionRevision: session.editSessionRevision,
      expiresAt: session.expiresAt,
      session: session.session,
      warning: session.warning,
    });
  }

  if (req.method === "DELETE") {
    relockWebsite(projectId, getWebsiteUnlockTokenFromRequest(req));
    return res.status(200).json({ ok: true, ...getWebsiteLockStatus(projectId) });
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
