import masterTemplate from "../../standard-inclusions/premier-inclusions-template.full.json";

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createPremierInclusionsWorkingCopy({ builderId = "local-builder", workbookId = "" } = {}) {
  const now = new Date().toISOString();
  const document = cloneJson(masterTemplate);
  return {
    ...document,
    id: `premier-inclusions-working-copy-${builderId || "builder"}-${workbookId || "local"}`,
    name: document.name || "Premier Inclusions Schedule",
    metadata: {
      ...(document.metadata || {}),
      documentSource: "native-master-working-copy",
      masterTemplateId: masterTemplate.id,
      immutableMaster: false,
      clonedFromMasterAt: now,
      lastSavedAt: now,
      builderId,
      workbookId,
    },
  };
}

export function isPremierInclusionsWorkingCopyCurrent(document) {
  return Boolean(
    document
      && Array.isArray(document.pages)
      && document.pages.length === 10
      && document.metadata?.documentSource !== "starter-template"
      && document.metadata?.isFallback !== true
  );
}

export function premierInclusionsMasterPageCount() {
  return Array.isArray(masterTemplate.pages) ? masterTemplate.pages.length : 0;
}
