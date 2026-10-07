import { useState, useCallback } from "react";
import { normalizeEmailSettings } from "./blockModel.js";
import { openSharedMediaPicker } from "../../../lib/openSharedMediaPicker";

// These setters come directly from EmailEditor useState calls and remain stable.
// Keep the existing callback dependencies when moving this workflow.
export function useEditorMedia({ setBlocks, setDocSettings }) {
  const [showAiGenerate, setShowAiGenerate] = useState(false);
  const [aiImageState, setAiImageState] = useState(null); // { blockId, field, fieldIdx }

  const openAiImage = useCallback((blockId, field, fieldIdx) => {
    setAiImageState({ blockId, field, fieldIdx });
  }, []);

  const applyAiImage = useCallback((url) => {
    if (!aiImageState) return;
    const { blockId, field, fieldIdx } = aiImageState;

    if (blockId === "__emailSettings") {
      setDocSettings(prev => normalizeEmailSettings({ ...prev, [field]: url }));
      setAiImageState(null);
      return;
    }

    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      const p = { ...b.props };
      if (field === "imageSrc_col" && fieldIdx !== null) {
        const columns = p.columns.map((c, i) => i === fieldIdx ? { ...c, imageSrc: url } : c);
        return { ...b, props: { ...p, columns } };
      }
      if (field === "imageSrc_item" && fieldIdx !== null) {
        const items = p.items.map((it, i) => i === fieldIdx ? { ...it, imageSrc: url } : it);
        return { ...b, props: { ...p, items } };
      }
      return { ...b, props: { ...p, [field]: url } };
    }));
    setAiImageState(null);
  }, [aiImageState]);

  // ── Image library modal ───────────────────────────────────────
  const [libraryState, setLibraryState] = useState(null); // { blockId, field, fieldIdx }

  const applyLibraryImageToTarget = useCallback((target, url) => {
    if (!target || !url) return;
    const { blockId, field, fieldIdx } = target;

    if (blockId === "__emailSettings") {
      setDocSettings(prev => normalizeEmailSettings({ ...prev, [field]: url }));
      return;
    }

    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      const p = { ...b.props };
      if (field === "imageSrc_col" && fieldIdx !== null) {
        const columns = p.columns.map((c, i) => i === fieldIdx ? { ...c, imageSrc: url } : c);
        return { ...b, props: { ...p, columns } };
      }
      if (field === "imageSrc_item" && fieldIdx !== null) {
        const items = p.items.map((it, i) => i === fieldIdx ? { ...it, imageSrc: url } : it);
        return { ...b, props: { ...p, items } };
      }
      return { ...b, props: { ...p, [field]: url } };
    }));
  }, []);

  const openLibrary = useCallback((blockId, field, fieldIdx) => {
    if (!blockId || !field) return;
    const nextState = { blockId, field, fieldIdx: fieldIdx ?? null };
    const opened = openSharedMediaPicker({
      onPick: (asset) => applyLibraryImageToTarget(nextState, asset?.url || ""),
      onBlocked: () => {
        setLibraryState(null);
        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(() => {
            setLibraryState(nextState);
          });
          return;
        }
        setLibraryState(nextState);
      },
    });
    if (opened) {
      setLibraryState(null);
      return;
    }
    setLibraryState(nextState);
  }, [applyLibraryImageToTarget]);

  const applyLibraryImage = useCallback((url) => {
    if (!libraryState) return;
    applyLibraryImageToTarget(libraryState, url);
    setLibraryState(null);
  }, [applyLibraryImageToTarget, libraryState]);

  // ── Image edit modal ─────────────────────────────────────────
  const [imageEditState, setImageEditState] = useState(null); // { blockId, field, fieldIdx, src }

  const openImageEdit = useCallback((blockId, field, fieldIdx, src) => {
    if (!src) return;
    setImageEditState(null);
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        setImageEditState({ blockId, field, fieldIdx: fieldIdx ?? null, src });
      });
      return;
    }
    setImageEditState({ blockId, field, fieldIdx: fieldIdx ?? null, src });
  }, []);

  const applyEditedImage = useCallback((newUrl) => {
    if (!imageEditState) return;
    const { blockId, field, fieldIdx } = imageEditState;

    if (blockId === "__emailSettings") {
      setDocSettings(prev => normalizeEmailSettings({ ...prev, [field]: newUrl }));
      setImageEditState(null);
      return;
    }

    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      const p = { ...b.props };
      if (field === "imageSrc_col" && fieldIdx !== null) {
        const columns = p.columns.map((c, i) => i === fieldIdx ? { ...c, imageSrc: newUrl } : c);
        return { ...b, props: { ...p, columns } };
      }
      if (field === "imageSrc_item" && fieldIdx !== null) {
        const items = p.items.map((it, i) => i === fieldIdx ? { ...it, imageSrc: newUrl } : it);
        return { ...b, props: { ...p, items } };
      }
      return { ...b, props: { ...p, [field]: newUrl } };
    }));
    setImageEditState(null);
  }, [imageEditState]);

  return { showAiGenerate, setShowAiGenerate, aiImageState, setAiImageState, openAiImage, applyAiImage, libraryState, setLibraryState, openLibrary, applyLibraryImage, imageEditState, setImageEditState, openImageEdit, applyEditedImage };
}
