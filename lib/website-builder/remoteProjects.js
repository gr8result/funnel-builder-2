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
    return { __rawText: text };
  }
}

const PRESERVE_DATA_URL_SENTINEL = "__WB_PRESERVE_DATA_URL__";

function pageNameFromValue(value) {
  if (typeof value === "string") {
    const text = value.trim();
    return text && text !== "[object Object]" ? text : "";
  }
  if (value && typeof value === "object") {
    return pageNameFromValue(value.name || value.title || value.slug || "");
  }
  return "";
}

function buildPageScopedProject(project, pageName, siteOnly = false) {
  const {
    pageBlocks: _pageBlocks,
    pagesContent: _pagesContent,
    chaiData: _chaiData,
    brandAssets,
    ...siteProject
  } = project && typeof project === "object" ? project : {};

  if (siteOnly && project && typeof project === "object") {
    return siteProject;
  }

  const selectedPage = pageNameFromValue(pageName);
  if (!project || typeof project !== "object") return project;
  if (!selectedPage) return siteProject;

  const pageBlocks = Array.isArray(project?.pageBlocks?.[selectedPage]) ? project.pageBlocks[selectedPage] : [];
  const pagesContent = Object.prototype.hasOwnProperty.call(project?.pagesContent || {}, selectedPage)
    ? { [selectedPage]: project.pagesContent[selectedPage] || "" }
    : {};
  const chaiData = Object.prototype.hasOwnProperty.call(project?.chaiData || {}, selectedPage)
    ? { [selectedPage]: sanitizePageBlocksForTransport(project.chaiData[selectedPage], brandAssets) }
    : {};

  return {
    ...siteProject,
    pageBlocks: {
      [selectedPage]: sanitizePageBlocksForTransport(pageBlocks, brandAssets),
    },
    pagesContent,
    chaiData,
  };
}

function buildAssetSrcIndex(brandAssets) {
  const assets = [
    brandAssets?.logo,
    ...(Array.isArray(brandAssets?.images) ? brandAssets.images : []),
    ...(Array.isArray(brandAssets?.videos) ? brandAssets.videos : []),
  ].filter((asset) => asset?.src && asset?.id);
  return new Map(assets.map((asset) => [String(asset.src), asset]));
}

function assetIdKeyForField(key) {
  if (!key) return "assetId";
  if (key === "src") return "assetId";
  return `${key}AssetId`;
}

function sanitizePageBlocksForTransport(value, brandAssets) {
  const assetBySrc = buildAssetSrcIndex(brandAssets);

  const visit = (entry) => {
    if (Array.isArray(entry)) return entry.map(visit);
    if (!entry || typeof entry !== "object") return entry;

    const next = {};
    for (const [key, child] of Object.entries(entry)) {
      if (typeof child === "string" && /^data:image\//i.test(child)) {
        const asset = assetBySrc.get(child);
        const assetIdKey = assetIdKeyForField(key);
        if (asset?.id) {
          next[key] = PRESERVE_DATA_URL_SENTINEL;
          next[assetIdKey] = asset.id;
          continue;
        }

        if (entry[assetIdKey]) {
          next[assetIdKey] = entry[assetIdKey];
          next[key] = PRESERVE_DATA_URL_SENTINEL;
          continue;
        }

        next[key] = PRESERVE_DATA_URL_SENTINEL;
        continue;
      }

      next[key] = visit(child);
    }
    return next;
  };

  return visit(value);
}

async function requestDraftProjects(auth, { method = "GET", projectId = "", project = null, pageName = "", siteOnly = false, saveSource = "" } = {}) {
  const accessToken = getAccessToken(auth);
  if (!accessToken) {
    throw new Error("You must be logged in to sync website drafts.");
  }

  const selectedPageName = pageNameFromValue(pageName);
  const params = new URLSearchParams();
  if (projectId) params.set("projectId", projectId);
  if (selectedPageName) params.set("page", selectedPageName);
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`/api/website-builder/projects${query}`, {
    method,
    headers: {
      ...(project ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${accessToken}`,
    },
    ...(project ? { body: JSON.stringify({
      project: buildPageScopedProject(project, selectedPageName, siteOnly),
      pageName: selectedPageName,
      siteOnly,
      saveSource,
      pageVersion: project?.projectVersion || "",
      baseUpdatedAt: project?.__saveBaseUpdatedAt || project?.baseUpdatedAt || "",
      requestId: project?.__saveRequestId || project?.requestId || "",
    }) } : {}),
  });

  const payload = await readJson(response);
  if (!response.ok || !payload?.ok) {
    const rawMessage = String(payload?.__rawText || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const message = payload?.error || payload?.message || rawMessage || `Could not sync website drafts (HTTP ${response.status})`;
    throw new Error(message);
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
    saveSource: options?.saveSource || "",
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
