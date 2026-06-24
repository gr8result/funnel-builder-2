import { withAuth } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import {
  listWebsiteBuilderBackups,
  restoreWebsiteBuilderBackup,
} from "../../../lib/website-builder/backupStorage";
import { loadFullSplitWebsiteProject as loadLocalSplitWebsiteProject } from "../../../lib/website-builder/siteStorage";
import {
  loadFullSplitWebsiteProject,
  saveSplitWebsiteProject,
} from "../../../lib/website-builder/supabaseSiteStorage";

function getBearerToken(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

function toErrorMessage(error, fallback) {
  return error?.message || fallback;
}

async function requireUserId(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: "Missing Bearer token" });
    return null;
  }

  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !userData?.user?.id) {
    res.status(401).json({ ok: false, error: toErrorMessage(authError, "Authentication failed") });
    return null;
  }

  return userData.user.id;
}

async function handler(req, res) {
  const userId = await requireUserId(req, res);
  if (!userId) return;

  const projectId = String(req.query?.projectId || req.body?.projectId || "").trim().replace(/^draft:/, "");
  if (!projectId) {
    return res.status(400).json({ ok: false, error: "projectId is required" });
  }

  if (req.method === "GET") {
    const backups = await listWebsiteBuilderBackups(userId, projectId);
    return res.status(200).json({ ok: true, backups });
  }

  if (req.method === "POST") {
    const backupId = String(req.body?.backupId || "").trim();
    if (!backupId) {
      return res.status(400).json({ ok: false, error: "backupId is required" });
    }

    const restored = await restoreWebsiteBuilderBackup(userId, projectId, backupId);
    const localProject = await loadLocalSplitWebsiteProject(userId, projectId);
    if (localProject) {
      await saveSplitWebsiteProject(userId, localProject, { backupSource: "restore", backupReason: `Restored backup ${backupId}` });
    }
    const project = await loadFullSplitWebsiteProject(userId, projectId);
    return res.status(200).json({ ok: true, restored, project });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

export default withAuth(handler);
