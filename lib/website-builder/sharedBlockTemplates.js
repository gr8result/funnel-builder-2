import { BlockTypes } from "./page-blocks/blockTypes";

export const SHARED_FREE_TRIAL_CTA_ID = "free-trial-cta";
export const SHARED_FREE_TRIAL_CTA_NAME = "14 Day Free Trial CTA";

export function getSharedBlockTemplates(project = {}) {
  const source = project?.sharedBlockTemplates || project?.sharedTemplates || {};
  if (!source || typeof source !== "object") return {};
  return source;
}

export function getSharedTemplateId(block = {}) {
  return String(block?.sharedTemplateId || block?.props?.sharedTemplateId || "").trim();
}

export function getSharedBlockTemplate(project = {}, sharedTemplateId = "") {
  const id = String(sharedTemplateId || "").trim();
  if (!id) return null;
  const templates = getSharedBlockTemplates(project);
  const template = templates[id] || null;
  return template && typeof template === "object" ? template : null;
}

export function getSharedBlockTemplateUsage(project = {}, sharedTemplateId = "") {
  const id = String(sharedTemplateId || "").trim();
  if (!id) return [];
  const usage = [];
  const visitBlocks = (pageName, blocks) => {
    (Array.isArray(blocks) ? blocks : []).forEach((block, index) => {
      if (getSharedTemplateId(block) === id) {
        usage.push({
          pageName,
          blockId: String(block?.id || ""),
          index,
          type: String(block?.type || ""),
        });
      }
    });
  };
  Object.entries(project?.pageBlocks || {}).forEach(([pageName, blocks]) => visitBlocks(pageName, blocks));
  return usage;
}

export function toSharedTemplateBlockData(block = {}) {
  const props = { ...(block?.props || {}) };
  delete props.sharedTemplateId;
  delete props.sharedTemplateName;
  delete props.sharedTemplateType;
  return {
    id: block?.id || "",
    type: block?.type || BlockTypes.CTA_BUTTON,
    props,
  };
}

export function buildSharedBlockTemplate({ id, name, blockType, blockData, updatedAt } = {}) {
  const templateId = String(id || "").trim();
  return {
    sharedTemplateId: templateId,
    templateName: String(name || templateId || "Shared Template").trim(),
    blockType: String(blockType || blockData?.type || BlockTypes.CTA_BUTTON).trim(),
    blockData: toSharedTemplateBlockData(blockData || { type: blockType || BlockTypes.CTA_BUTTON, props: {} }),
    updatedAt: updatedAt || new Date().toISOString(),
  };
}

export function upsertSharedBlockTemplate(project = {}, template = {}) {
  const normalized = buildSharedBlockTemplate(template);
  if (!normalized.sharedTemplateId) return project;
  return {
    ...project,
    sharedBlockTemplates: {
      ...getSharedBlockTemplates(project),
      [normalized.sharedTemplateId]: normalized,
    },
  };
}

export function updateSharedBlockTemplateFromBlock(project = {}, sharedTemplateId = "", block = {}) {
  const current = getSharedBlockTemplate(project, sharedTemplateId);
  if (!current) return project;
  return upsertSharedBlockTemplate(project, {
    ...current,
    id: current.sharedTemplateId,
    name: current.templateName,
    blockType: current.blockType || block?.type,
    blockData: {
      ...toSharedTemplateBlockData(block),
      type: current.blockType || block?.type || BlockTypes.CTA_BUTTON,
    },
    updatedAt: new Date().toISOString(),
  });
}

export function resolveSharedBlockInstance(block = {}, project = {}) {
  const sharedTemplateId = getSharedTemplateId(block);
  if (!sharedTemplateId) return block;
  const template = getSharedBlockTemplate(project, sharedTemplateId);
  if (!template?.blockData) return block;
  const blockType = String(template.blockType || template.blockData.type || block.type || "");
  if (block?.type && blockType && String(block.type) !== blockType) return block;
  return {
    ...template.blockData,
    id: block?.id || template.blockData.id || sharedTemplateId,
    type: blockType || block?.type,
    sharedTemplateId,
    props: {
      ...(template.blockData.props || {}),
      sharedTemplateId,
      sharedTemplateName: template.templateName || sharedTemplateId,
      sharedTemplateType: "shared",
    },
  };
}

export function resolveSharedBlockInstances(blocks = [], project = {}) {
  return (Array.isArray(blocks) ? blocks : []).map((block) => resolveSharedBlockInstance(block, project));
}

export function detachSharedBlockInstance(block = {}, project = {}) {
  const resolved = resolveSharedBlockInstance(block, project);
  const props = { ...(resolved?.props || {}) };
  delete props.sharedTemplateId;
  delete props.sharedTemplateName;
  delete props.sharedTemplateType;
  return {
    ...resolved,
    sharedTemplateId: undefined,
    props,
  };
}

export function normalizeSharedBlockTemplateProject(project = {}) {
  if (!project || typeof project !== "object") return project;
  return {
    ...project,
    sharedBlockTemplates: getSharedBlockTemplates(project),
  };
}
