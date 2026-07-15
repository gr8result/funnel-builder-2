import crypto from "crypto";

export function stableWebsiteJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableWebsiteJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableWebsiteJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function websiteContentHash(value) {
  return crypto.createHash("sha256").update(stableWebsiteJson(value ?? null)).digest("hex");
}

export function buildWebsiteProjectVersion(project, savedAt = new Date().toISOString()) {
  const hash = websiteContentHash({
    pages: project?.pages || [],
    pageBlocks: project?.pageBlocks || {},
    pagesContent: project?.pagesContent || {},
    chaiData: project?.chaiData || {},
    globalNavBlock: project?.globalNavBlock || null,
    globalFooterBlock: project?.globalFooterBlock || null,
  });
  return {
    savedAt,
    projectVersion: `pv_${savedAt.replace(/[^0-9]/g, "").slice(0, 17)}_${hash.slice(0, 12)}`,
    contentHash: hash,
  };
}

export function summarizeWebsitePage(project, pageName = "") {
  const pages = Array.isArray(project?.pages) ? project.pages : [];
  const page = pages.find((entry) => String(entry?.name || "") === String(pageName || ""))
    || pages.find((entry) => String(entry?.slug || "") === String(pageName || ""))
    || pages[0]
    || null;
  const resolvedName = pageName || page?.name || "";
  const blocks = Array.isArray(project?.pageBlocks?.[resolvedName])
    ? project.pageBlocks[resolvedName]
    : Array.isArray(project?.chaiData?.[resolvedName]?.blocks)
      ? project.chaiData[resolvedName].blocks
      : [];
  return {
    pageId: page?.id || page?.slug || resolvedName || "",
    pageName: page?.name || resolvedName || "",
    blockCount: blocks.length,
    pageHash: websiteContentHash(blocks),
  };
}
