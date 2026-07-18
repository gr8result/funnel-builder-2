export function appendProjectEstimatePageRevision(history: any[] = [], revision: any) {
  const pageId = revision.pageId || "";
  const next = [
    ...history,
    {
      pageId,
      templateVersion: revision.templateVersion || "",
      contentOverrides: revision.contentOverrides || {},
      savedAt: revision.savedAt || new Date().toISOString(),
      source: revision.source || "editor",
    },
  ];
  const perPageCounts: Record<string, number> = {};
  return next.reverse().filter((item) => {
    const key = item.pageId || "";
    perPageCounts[key] = (perPageCounts[key] || 0) + 1;
    return perPageCounts[key] <= 10;
  }).reverse();
}

export function projectEstimateRevisionsForPage(history: any[] = [], pageId = "") {
  return history.filter((revision) => revision.pageId === pageId).slice(-10).reverse();
}
