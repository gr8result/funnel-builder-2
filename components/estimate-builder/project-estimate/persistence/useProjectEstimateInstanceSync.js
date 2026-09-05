// Bridges the in-memory `builder` object already used throughout
// EstimateBuilderWorkbook.js to the multi-tenant Project Estimate instance
// API (pages/api/project-estimate/instances/**). This is additive: the
// existing per-browser IndexedDB save path (persistBuilder/saveStoredJob)
// keeps running unchanged as a local recovery cache. This hook is the
// authoritative, organisation-scoped, database-backed save path.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getExistingInstance,
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
  localFileOnly = false,
  builder,
  setBuilder,
  dirtyRef,
  readonly,
  hydratePage,
  preserveSavedDocument = false,
}) {
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const instanceRef = useRef({ id: null, templateId: null, updatedAt: null });
  const saveTimerRef = useRef(null);
  const loadedRef = useRef(false);

  const applyInstanceToBuilder = useCallback((instance, cancelled = false) => {
    if (cancelled || !instance?.id) return;
    instanceRef.current = { id: instance.id, templateId: instance.templateId, updatedAt: instance.updatedAt };
    const localHasContent = Array.isArray(builder?.pages)
      && builder.pages.some((page) => Array.isArray(page.blocks) && page.blocks.length);
    if (!dirtyRef.current && !localHasContent && !preserveSavedDocument) {
      const hydratedPages = (instance.pages || []).map((apiPage) => hydratePage(apiPageToBuilderPageShell(apiPage)));
      setBuilder((current) => ({
        ...current,
        pages: hydratedPages,
        importedDocuments: {
          ...(current.importedDocuments || {}),
          ...(instance.settings?.importedDocuments || {}),
        },
        instanceId: instance.id,
        templateId: instance.templateId,
      }));
    } else {
      setBuilder((current) => ({ ...current, instanceId: instance.id, templateId: instance.templateId }));
    }
  }, [builder?.pages, dirtyRef, hydratePage, preserveSavedDocument, setBuilder]);

  useEffect(() => {
    if (localFileOnly) {
      loadedRef.current = false;
      instanceRef.current = { id: null, templateId: null, updatedAt: null };
      setStatus("idle");
      setErrorMessage("");
      return undefined;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    loadedRef.current = false;
    instanceRef.current = { id: null, templateId: null, updatedAt: null };
    if (readonly || !workspaceId || !projectId) return undefined;
    loadedRef.current = true;
    let cancelled = false;
    setStatus("loading");
    getExistingInstance(workspaceId, { projectId: projectId || undefined })
      .then(({ instance }) => {
        if (cancelled) return;
        applyInstanceToBuilder(instance);
        setStatus("idle");
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ProjectEstimateApiError && error.status === 404) {
          instanceRef.current = { id: null, templateId: null, updatedAt: null };
          setStatus("missing_saved_instance");
          setErrorMessage("The saved Project Estimate could not be loaded. No replacement document has been created.");
          return;
        }
        setStatus("save_failed");
        setErrorMessage(error?.message || "Could not load your saved Project Estimate.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, projectId, readonly, localFileOnly]);

  const createFromTemplate = useCallback((templateId) => {
    if (readonly || localFileOnly || !workspaceId || !projectId) return Promise.resolve(null);
    setStatus("loading");
    setErrorMessage("");
    return getOrCreateInstance(workspaceId, { projectId: projectId || undefined, templateId: templateId || undefined, createIfMissing: true })
      .then(({ instance, created }) => {
        applyInstanceToBuilder(instance);
        setStatus(created ? "created_from_template" : "idle");
        return instance;
      })
      .catch((error) => {
        setStatus("save_failed");
        setErrorMessage(error?.message || "Could not create a Project Estimate from the selected template.");
        return null;
      });
  }, [applyInstanceToBuilder, localFileOnly, projectId, readonly, workspaceId]);

  const persistNow = useCallback((nextBuilder) => {
    const savingInstance = instanceRef.current;
    const instanceId = instanceRef.current.id;
    if (!instanceId || readonly || localFileOnly) return Promise.resolve(null);
    setStatus("saving");
    const pages = (nextBuilder.pages || []).map((page, index) => (
      builderPageToApiPage(page, index, nextBuilder.importedDocuments)
    ));
    return saveInstance(workspaceId, instanceId, {
      pages,
      pageOrder: pages.map((page) => page.pageKey),
      expectedUpdatedAt: instanceRef.current.updatedAt || undefined,
    }).then(({ instance }) => {
      if (instanceRef.current !== savingInstance) return instance;
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
  }, [workspaceId, readonly, localFileOnly]);

  const scheduleSave = useCallback((nextBuilder) => {
    if (!instanceRef.current.id || readonly || localFileOnly) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persistNow(nextBuilder), SAVE_DEBOUNCE_MS);
  }, [persistNow, readonly, localFileOnly]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  return {
    status,
    errorMessage,
    scheduleSave,
    persistNow,
    createFromTemplate,
    get instanceId() { return instanceRef.current.id; },
    get templateId() { return instanceRef.current.templateId; },
    setTemplateId: (templateId) => { instanceRef.current.templateId = templateId; },
  };
}
