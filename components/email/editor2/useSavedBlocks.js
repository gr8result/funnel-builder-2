import { useState, useCallback } from "react";
import { CATALOG } from "./editorOptions.js";
import { deepClone, uid } from "./editorUtils.js";

// The supplied setters are stable useState setters owned by EmailEditor.
export function useSavedBlocks({ blocks, selectedId, setBlocks, setSelectedId }) {
  const [savedBlocks, setSavedBlocks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("email_saved_blocks_v2") || "[]"); } catch { return []; }
  });
  const persistSaved = useCallback((next) => {
    setSavedBlocks(next);
    localStorage.setItem("email_saved_blocks_v2", JSON.stringify(next));
  }, []);
  const saveBlock = useCallback((block) => {
    const label = window.prompt("Name this saved block:", CATALOG.find(c => c.type === block.type)?.label || block.type);
    if (!label) return;
    persistSaved([...savedBlocks, { label, block: deepClone(block) }]);
  }, [savedBlocks, persistSaved]);
  const deleteSavedBlock = useCallback((i) => {
    if (!window.confirm("Remove this saved block?")) return;
    persistSaved(savedBlocks.filter((_, idx) => idx !== i));
  }, [savedBlocks, persistSaved]);
  const insertSavedBlockAt = useCallback((entry, index = null) => {
    const b = { ...deepClone(entry.block), id: uid() };
    setBlocks(prev => {
      const arr = [...prev];
      const safeIndex = Math.max(0, Math.min(index == null ? arr.length : index, arr.length));
      arr.splice(safeIndex, 0, b);
      return arr;
    });
    setSelectedId(b.id);
  }, []);
  const insertSavedBlock = useCallback((entry) => {
    const selectedIndex = blocks.findIndex(b => b.id === selectedId);
    insertSavedBlockAt(entry, selectedIndex >= 0 ? selectedIndex + 1 : null);
  }, [blocks, selectedId, insertSavedBlockAt]);

  return { savedBlocks, saveBlock, deleteSavedBlock, insertSavedBlockAt, insertSavedBlock };
}
