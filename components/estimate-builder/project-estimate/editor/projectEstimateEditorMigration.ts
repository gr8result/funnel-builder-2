import { projectEstimatePageDefinitionFor } from "../ProjectEstimateRegistry";
import { isDiagnosticBlock, isRenderableProjectEstimateBlock, isSubscriberCreatedBlock } from "./projectEstimateObjectModel";

export type ProjectEstimateCleanupResult = {
  builder: any;
  removedBlockIds: string[];
  backup: any;
};

export function cleanupProjectEstimateEditorData(builder: any = {}): ProjectEstimateCleanupResult {
  const removedBlockIds: string[] = [];
  const backup = {
    createdAt: new Date().toISOString(),
    reason: "project-estimate-editor-cleanup",
    pages: (builder.pages || []).map((page: any) => ({
      id: page.id,
      page_type: page.page_type,
      blocks: page.blocks || [],
    })),
  };
  const pages = (builder.pages || []).map((page: any) => {
    const pageId = page.page_type || page.id || "";
    const definition = projectEstimatePageDefinitionFor(pageId);
    if (!definition) return page;
    const approvedIds = new Set((definition.defaultBlocks || []).map((block: any) => block.id));
    const seen = new Set<string>();
    const blocks = (page.blocks || []).filter((block: any) => {
      const id = String(block?.id || "");
      const keep = id
        && !seen.has(id)
        && !isDiagnosticBlock(block)
        && (approvedIds.has(id) || isSubscriberCreatedBlock(block, pageId))
        && isRenderableProjectEstimateBlock({ ...block, design: { ...(block.design || {}), hidden: false } }, pageId, approvedIds);
      if (keep) {
        seen.add(id);
        return true;
      }
      if (id) removedBlockIds.push(id);
      return false;
    });
    return { ...page, blocks };
  });
  return {
    builder: {
      ...builder,
      pages,
      editorCleanupBackups: [...(builder.editorCleanupBackups || []), backup].slice(-5),
      editorCleanupRemovedBlockIds: [...new Set([...(builder.editorCleanupRemovedBlockIds || []), ...removedBlockIds])],
      editorSchemaVersion: 2,
    },
    removedBlockIds,
    backup,
  };
}

export function cleanupProjectEstimateLocalOverrides(storage: Storage | null | undefined, keys: string[] = []) {
  if (!storage) return [];
  const removed: string[] = [];
  for (const key of keys) {
    try {
      const raw = storage.getItem(key);
      if (!raw || !/Progress payment source diagnostics|diagnostic|phantom|legacy quote/i.test(raw)) continue;
      storage.setItem(`${key}:project-estimate-recovery:${Date.now()}`, raw);
      storage.removeItem(key);
      removed.push(key);
    } catch {}
  }
  return removed;
}
