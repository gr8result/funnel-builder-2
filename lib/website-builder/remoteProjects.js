function getAccessToken(auth) {
  if (typeof auth === "string") return auth.trim();
  if (auth && typeof auth === "object") {
    return String(auth.access_token || "").trim();
  }
  return "";
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function buildPageScopedProject(project, pageName, siteOnly = false) {
  if (siteOnly && project && typeof project === "object") {
    const { pageBlocks: _pageBlocks, pagesContent: _pagesContent, chaiData: _chaiData, ...siteProject } = project;
    return siteProject;
  }

  const selectedPage = String(pageName || "").trim();
  if (!selectedPage || !project || typeof project !== "object") return project;

  return {
    ...project,
    pageBlocks: {
      [selectedPage]: Array.isArray(project?.pageBlocks?.[selectedPage]) ? project.pageBlocks[selectedPage] : [],
    },
    pagesContent: {
      [selectedPage]: project?.pagesContent?.[selectedPage] || "",
    },
    chaiData: project?.chaiData?.[selectedPage]
      ? { [selectedPage]: project.chaiData[selectedPage] }
      : {},
  };
}

async function requestDraftProjects(auth, { method = "GET", projectId = "", project = null, pageName = "", siteOnly = false } = {}) {
  const accessToken = getAccessToken(auth);
  if (!accessToken) {
    throw new Error("You must be logged in to sync website drafts.");
  }

  const params = new URLSearchParams();
  if (projectId) params.set("projectId", projectId);
  if (pageName) params.set("page", pageName);
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`/api/website-builder/projects${query}`, {
    method,
    headers: {
      ...(project ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${accessToken}`,
    },
    ...(project ? { body: JSON.stringify({ project: buildPageScopedProject(project, pageName, siteOnly), pageName, siteOnly }) } : {}),
  });

  const payload = await readJson(response);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `Could not sync website drafts (HTTP ${response.status})`);
  }

  return payload;
}

export async function fetchWebsiteProjectsFromServer(auth) {
  const payload = await requestDraftProjects(auth);
  return Array.isArray(payload?.projects) ? payload.projects : [];
}

export async function fetchWebsiteProjectFromServer(auth, projectId, options = {}) {
  if (!projectId) return null;
  const payload = await requestDraftProjects(auth, { projectId, pageName: options?.pageName || "" });
  return payload?.project || null;
}

export async function saveWebsiteProjectToServer(auth, project, options = {}) {
  if (!project || typeof project !== "object") {
    throw new Error("A valid website project is required for cloud sync.");
  }

  const payload = await requestDraftProjects(auth, {
    method: "POST",
    projectId: project.id,
    project,
    pageName: options?.pageName || "",
    siteOnly: options?.siteOnly === true,
  });

  return payload?.project || null;
}

export async function deleteWebsiteProjectFromServer(auth, projectId) {
  if (!projectId) return true;
  const payload = await requestDraftProjects(auth, { method: "DELETE", projectId });
  return !!payload?.ok;
}

export async function renameWebsiteProjectOnServer(auth, projectId, name) {
  const accessToken = getAccessToken(auth);
  if (!accessToken) throw new Error("You must be logged in to sync website drafts.");
  const response = await fetch("/api/website-builder/projects", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ projectId, name }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `Could not rename website (HTTP ${response.status})`);
  }
  return true;
}
