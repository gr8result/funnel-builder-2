export function sortObjectsByLayer(objects = []) {
  return [...objects].sort((a, b) => {
    const layerDiff = (Number(a.layer) || 0) - (Number(b.layer) || 0);
    return layerDiff || String(a.id).localeCompare(String(b.id));
  });
}

export function normaliseLayers(objects = []) {
  return sortObjectsByLayer(objects).map((object, index) => ({
    ...object,
    layer: index,
  }));
}

export function bringForward(objects = [], objectId) {
  const ordered = normaliseLayers(objects);
  const index = ordered.findIndex((object) => object.id === objectId);
  if (index < 0 || index === ordered.length - 1) return ordered;
  [ordered[index], ordered[index + 1]] = [ordered[index + 1], ordered[index]];
  return normaliseLayers(ordered);
}

export function sendBackward(objects = [], objectId) {
  const ordered = normaliseLayers(objects);
  const index = ordered.findIndex((object) => object.id === objectId);
  if (index <= 0) return ordered;
  [ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]];
  return normaliseLayers(ordered);
}

export function bringToFront(objects = [], objectId) {
  const ordered = normaliseLayers(objects);
  const object = ordered.find((item) => item.id === objectId);
  if (!object) return ordered;
  return normaliseLayers([...ordered.filter((item) => item.id !== objectId), object]);
}

export function sendToBack(objects = [], objectId) {
  const ordered = normaliseLayers(objects);
  const object = ordered.find((item) => item.id === objectId);
  if (!object) return ordered;
  return normaliseLayers([object, ...ordered.filter((item) => item.id !== objectId)]);
}
