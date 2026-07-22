// Bridges the in-memory `builder` object already used throughout
// EstimateBuilderWorkbook.js to the multi-tenant Project Estimate instance
// API (pages/api/project-estimate/instances/**). This is additive: the
// existing per-browser IndexedDB save path (persistBuilder/saveStoredJob)
// keeps running unchanged as a local recovery cache. This hook is the
// authoritative, organisation-scoped, database-backed save path.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getOrCreateInstance,
  saveInstance,
  builderPageToApiPage,
  apiPageToBuilderPageShell,
  ProjectEstimateApiError,
} from "./ProjectEstimateApiClient";

const SAVE_DEBOUNCE_MS = 1200;

export function useProjectEstimateInstanceSync({
  workspaceId,
  projectId,
  builder,
  setBuilder,
  dirtyRef,
  readonly,
  hydratePage,
}) {
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const instanceRef = useRef({ id: null, templateId: null, updatedAt: null });
  const saveTimerRef = useRef(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (readonly || !workspaceId || loadedRef.current) return undefined;
    loadedRef.current = true;
    let cancelled = false;
    setStatus("loading");
    getOrCreateInstance(workspaceId, { projectId: projectId || undefined })
      .then(({ instance }) => {
        if (cancelled) return;
        instanceRef.current = { id: instance.id, templateId: instance.templateId, updatedAt: instance.updatedAt };
        const localUpdatedAt = builder?.updatedAt ? new Date(builder.updatedAt).getTime() : 0;
        const serverUpdatedAt = instance.updatedAt ? new Date(instance.updatedAt).getTime() : 0;
        const localHasContent = Array.isArray(builder?.pages)
          && builder.pages.some((page) => Array.isArray(page.blocks) && page.blocks.length);

        if (!dirtyRef.current && (!localHasContent || serverUpdatedAt > localUpdatedAt)) {
          const hydratedPages = (instance.pages || []).map((apiPage) => hydratePage(apiPageToBuilderPageShell(apiPage)));
          setBuilder((current) => ({
            ...current,
            pages: hydratedPages,
            instanceId: instance.id,
            templateId: instance.templateId,
          }));
        } else {
          setBuilder((current) => ({ ...current, instanceId: instance.id, templateId: instance.templateId }));
        }
        setStatus("idle");
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus("save_failed");
        setErrorMessage(error?.message || "Could not load your saved Project Estimate.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, projectId, readonly]);

  const persistNow = useCallback((nextBuilder) => {
    const instanceId = instanceRef.current.id;
    if (!instanceId || readonly) return Promise.resolve(null);
    setStatus("saving");
    const pages = (nextBuilder.pages || []).map((page, index) => (
      builderPageToApiPage(page, index, nextBuilder.importedDocuments)
    ));
    return saveInstance(workspaceId, instanceId, {
      pages,
      pageOrder: pages.map((page) => page.pageKey),
      expectedUpdatedAt: instanceRef.current.updatedAt || undefined,
    }).then(({ instance }) => {
      instanceRef.current.updatedAt = instance.updatedAt;
      setStatus("saved");
      return instance;
    }).catch((error) => {
      if (error instanceof ProjectEstimateApiError && error.conflict) {
        setStatus("conflict");
        setErrorMessage(error.message);
        return null;
      }
      setStatus("save_failed");
      setErrorMessage(error?.message || "Save failed");
      return null;
    });
  }, [workspaceId, readonly]);

  const scheduleSave = useCallback((nextBuilder) => {
    if (!instanceRef.current.id || readonly) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persistNow(nextBuilder), SAVE_DEBOUNCE_MS);
  }, [persistNow, readonly]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  return {
    status,
    errorMessage,
    scheduleSave,
    persistNow,
    get instanceId() { return instanceRef.current.id; },
    get templateId() { return instanceRef.current.templateId; },
    setTemplateId: (templateId) => { instanceRef.current.templateId = templateId; },
  };
}
