import crypto from "node:crypto";

export const FINAL_APPROVED_WEBSITE_PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";

// Which projects the lock protects. Defaults to the approved live website. Tests set
// WEBSITE_LOCK_PROTECTED_PROJECT_IDS to an isolated fixture so the unlock -> save ->
// publish -> relock flow can be exercised without mutating the real website.
function protectedProjectIds() {
  const configured = String(process.env.WEBSITE_LOCK_PROTECTED_PROJECT_IDS || "").trim();
  if (!configured) return new Set([FINAL_APPROVED_WEBSITE_PROJECT_ID]);
  return new Set(
    configured
      .split(",")
      .map((value) => String(value || "").trim().replace(/^draft:/, ""))
      .filter(Boolean)
  );
}
export const WEBSITE_LOCK_CONFIRMATION = "UNLOCK";
export const WEBSITE_LOCK_MESSAGE = "Website protected - click Unlock for Editing before saving, publishing, restoring or changing settings.";

const DEFAULT_UNLOCK_TTL_MS = 60 * 60 * 1000;
const unlockSessions = globalThis.__websiteBuilderUnlockSessions || new Map();
globalThis.__websiteBuilderUnlockSessions = unlockSessions;

function normalizeProjectId(projectId = "") {
  return String(projectId || "").trim().replace(/^draft:/, "");
}

function nowIso() {
  return new Date().toISOString();
}

function sessionRevision(projectId) {
  const stamp = nowIso().replace(/[^0-9]/g, "").slice(0, 17);
  return `unlock_${stamp}_${normalizeProjectId(projectId).slice(0, 8)}`;
}

function isExpired(session) {
  return !session || Date.parse(session.expiresAt || "") <= Date.now();
}

function touchSession(session) {
  if (!session) return null;
  const now = Date.now();
  session.lastActivityAt = new Date(now).toISOString();
  session.expiresAt = new Date(now + DEFAULT_UNLOCK_TTL_MS).toISOString();
  unlockSessions.set(session.token, session);
  return session;
}

function publicSession(session) {
  if (!session) return null;
  return {
    editSessionRevision: session.editSessionRevision || "",
    expectedDraftRevision: session.expectedDraftRevision || "",
    expectedDraftUpdatedAt: session.expectedDraftUpdatedAt || "",
    expiresAt: session.expiresAt || null,
    savedAt: session.savedAt || null,
    publishedAt: session.publishedAt || null,
  };
}

function activeSessionsForProject(projectId) {
  pruneExpiredSessions();
  const safeProjectId = normalizeProjectId(projectId);
  return Array.from(unlockSessions.values()).filter((session) => session?.projectId === safeProjectId);
}

export function isProtectedWebsiteProject(projectId = "") {
  const safeProjectId = normalizeProjectId(projectId);
  return !!safeProjectId && protectedProjectIds().has(safeProjectId);
}

export function pruneExpiredSessions() {
  for (const [token, session] of unlockSessions.entries()) {
    if (isExpired(session)) unlockSessions.delete(token);
  }
}

export function websiteLockedResponse(res, lock = null) {
  const status = Number(lock?.status || 423);
  return res.status(status).json({
    ok: false,
    locked: true,
    code: lock?.code || "WEBSITE_LOCKED",
    error: lock?.error || WEBSITE_LOCK_MESSAGE,
    action: lock?.action || undefined,
  });
}

export function getWebsiteUnlockTokenFromRequest(req) {
  return String(
    req?.headers?.["x-website-unlock-token"]
    || req?.body?.unlockToken
    || req?.query?.unlockToken
    || ""
  ).trim();
}

export function getWebsiteLockStatus(projectId = "", token = "") {
  const safeProjectId = normalizeProjectId(projectId);
  if (!isProtectedWebsiteProject(safeProjectId)) {
    return { protected: false, locked: false, projectId: safeProjectId };
  }
  const activeSessions = activeSessionsForProject(safeProjectId);
  const session = token ? unlockSessions.get(String(token || "").trim()) : activeSessions[0];
  const usableSession = session && session.projectId === safeProjectId && !isExpired(session) ? session : null;
  return {
    protected: true,
    locked: !usableSession,
    projectId: safeProjectId,
    activeSessionCount: activeSessions.length,
    session: publicSession(usableSession),
    expiresAt: usableSession?.expiresAt || null,
    editSessionRevision: usableSession?.editSessionRevision || null,
    warning: "This approved website is protected. Unlock only for a deliberate owner-approved edit.",
  };
}

export function createWebsiteUnlockSession({
  userId = "",
  projectId = "",
  confirmation = "",
  draftRevision = "",
  draftUpdatedAt = "",
  contentHash = "",
  ttlMs = DEFAULT_UNLOCK_TTL_MS,
} = {}) {
  pruneExpiredSessions();
  const safeProjectId = normalizeProjectId(projectId);
  if (!isProtectedWebsiteProject(safeProjectId)) {
    return { ok: false, status: 400, error: "This website project is not protected by the final approved website lock." };
  }
  if (!userId) {
    return { ok: false, status: 401, error: "Authenticated site owner is required to unlock this website." };
  }
  if (String(confirmation || "").trim() !== WEBSITE_LOCK_CONFIRMATION) {
    return { ok: false, status: 400, error: `Type ${WEBSITE_LOCK_CONFIRMATION} to unlock this approved website for editing.` };
  }

  relockWebsite(safeProjectId);

  const token = crypto.randomUUID();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + Math.max(60_000, Number(ttlMs || DEFAULT_UNLOCK_TTL_MS))).toISOString();
  const session = {
    token,
    userId,
    projectId: safeProjectId,
    createdAt,
    lastActivityAt: createdAt,
    expiresAt,
    editSessionRevision: sessionRevision(safeProjectId),
    expectedDraftRevision: String(draftRevision || ""),
    expectedDraftUpdatedAt: String(draftUpdatedAt || ""),
    verifiedContentHash: String(contentHash || ""),
    savedAt: null,
    publishedAt: null,
    publishedRevision: "",
  };
  unlockSessions.set(token, session);
  return {
    ok: true,
    token,
    expiresAt,
    editSessionRevision: session.editSessionRevision,
    session: publicSession(session),
    warning: "Approved website protection is temporarily unlocked. Save, preview and publish are available until you lock the website again or the session times out.",
  };
}

export function relockWebsite(projectId = "", token = "") {
  const safeProjectId = normalizeProjectId(projectId);
  const safeToken = String(token || "").trim();
  if (safeToken) {
    unlockSessions.delete(safeToken);
    return;
  }
  for (const [entryToken, session] of unlockSessions.entries()) {
    if (session?.projectId === safeProjectId) unlockSessions.delete(entryToken);
  }
}

export function assertWebsiteUnlockedForMutation({ projectId = "", userId = "", unlockToken = "", action = "write" } = {}) {
  pruneExpiredSessions();
  const safeProjectId = normalizeProjectId(projectId);
  if (!isProtectedWebsiteProject(safeProjectId)) return { ok: true, locked: false };

  const safeToken = String(unlockToken || "").trim();
  const session = unlockSessions.get(safeToken);
  const activeForProject = activeSessionsForProject(safeProjectId);
  if (!safeToken) {
    return { ok: false, locked: true, code: "WEBSITE_LOCKED", status: 423, error: WEBSITE_LOCK_MESSAGE, action };
  }
  if (!session) {
    return {
      ok: false,
      locked: true,
      code: activeForProject.length ? "WEBSITE_STALE_SESSION" : "WEBSITE_SESSION_EXPIRED",
      status: activeForProject.length ? 409 : 423,
      error: activeForProject.length
        ? "This editing session is no longer current. Reload the builder, then unlock again."
        : "Editing session expired after 60 minutes of inactivity. Unlock for Editing again.",
      action,
    };
  }
  if (session.projectId !== safeProjectId || session.userId !== userId) {
    return {
      ok: false,
      locked: true,
      code: "WEBSITE_STALE_SESSION",
      status: 409,
      error: "This edit token does not match the authenticated owner and website. Unlock for Editing again.",
      action,
    };
  }
  if (isExpired(session)) {
    unlockSessions.delete(session.token);
    return {
      ok: false,
      locked: true,
      code: "WEBSITE_SESSION_EXPIRED",
      status: 423,
      error: "Editing session expired after 60 minutes of inactivity. Unlock for Editing again.",
      action,
    };
  }

  return { ok: true, locked: false, session: touchSession(session) };
}

export function markWebsiteMutationCommitted({
  projectId = "",
  unlockToken = "",
  action = "save",
  draftRevision = "",
  draftUpdatedAt = "",
  contentHash = "",
} = {}) {
  pruneExpiredSessions();
  const session = unlockSessions.get(String(unlockToken || "").trim());
  if (!session || session.projectId !== normalizeProjectId(projectId)) return null;
  touchSession(session);
  if (draftRevision) session.expectedDraftRevision = String(draftRevision || "");
  if (draftUpdatedAt) session.expectedDraftUpdatedAt = String(draftUpdatedAt || "");
  if (contentHash) session.verifiedContentHash = String(contentHash || "");
  if (action === "publish") {
    session.publishedAt = nowIso();
    session.publishedRevision = session.expectedDraftRevision || draftRevision || "";
  } else {
    session.savedAt = nowIso();
  }
  unlockSessions.set(session.token, session);
  return publicSession(session);
}
