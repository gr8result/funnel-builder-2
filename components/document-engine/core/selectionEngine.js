export function createSelectionState(selectedObjectIds = []) {
  return {
    selectedObjectIds: uniqueIds(selectedObjectIds),
    lastSelectedObjectId: selectedObjectIds[selectedObjectIds.length - 1] || null,
  };
}

export function selectObject(selection, objectId, options = {}) {
  if (!objectId) return clearSelection();
  const current = selection || createSelectionState();
  if (options.multi) {
    return toggleObjectSelection(current, objectId);
  }
  return {
    selectedObjectIds: [objectId],
    lastSelectedObjectId: objectId,
  };
}

export function toggleObjectSelection(selection, objectId) {
  const current = selection || createSelectionState();
  const exists = current.selectedObjectIds.includes(objectId);
  const selectedObjectIds = exists
    ? current.selectedObjectIds.filter((id) => id !== objectId)
    : [...current.selectedObjectIds, objectId];
  return {
    selectedObjectIds,
    lastSelectedObjectId: selectedObjectIds[selectedObjectIds.length - 1] || null,
  };
}

export function clearSelection() {
  return createSelectionState();
}

export function isSelected(selection, objectId) {
  return Boolean(selection?.selectedObjectIds?.includes(objectId));
}

export function getSelectionBounds(objects = [], selectedObjectIds = []) {
  const selected = objects.filter((object) => selectedObjectIds.includes(object.id));
  if (!selected.length) return null;
  const left = Math.min(...selected.map((object) => object.x));
  const top = Math.min(...selected.map((object) => object.y));
  const right = Math.max(...selected.map((object) => object.x + object.width));
  const bottom = Math.max(...selected.map((object) => object.y + object.height));
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function uniqueIds(ids = []) {
  return [...new Set(ids.filter(Boolean))];
}
