import { createId, normaliseObject } from "./objectEngine.js";
import { normaliseLayers } from "./layerEngine.js";

export const A4_PORTRAIT_PAGE = {
  name: "A4 Portrait",
  width: 794,
  height: 1123,
  unit: "px",
};

export function createA4Page(props = {}) {
  return {
    id: props.id || createId("page"),
    name: props.name || "Untitled Page",
    width: props.width || A4_PORTRAIT_PAGE.width,
    height: props.height || A4_PORTRAIT_PAGE.height,
    unit: props.unit || A4_PORTRAIT_PAGE.unit,
    background: {
      color: "#ffffff",
      imageRef: null,
      ...(props.background || {}),
    },
    objects: normaliseLayers((props.objects || []).map(normaliseObject)),
  };
}

export function addObjectToPage(page, object) {
  const current = createA4Page(page);
  const nextObject = normaliseObject({
    ...object,
    layer: current.objects.length,
  });
  return {
    ...current,
    objects: normaliseLayers([...current.objects, nextObject]),
  };
}

export function updateObjectOnPage(page, objectId, updater) {
  const current = createA4Page(page);
  return {
    ...current,
    objects: normaliseLayers(current.objects.map((object) => {
      if (object.id !== objectId) return object;
      const next = typeof updater === "function" ? updater(object) : { ...object, ...updater };
      return normaliseObject(next);
    })),
  };
}

export function removeObjectFromPage(page, objectId) {
  const current = createA4Page(page);
  return {
    ...current,
    objects: normaliseLayers(current.objects.filter((object) => object.id !== objectId)),
  };
}

export function duplicateObjectOnPage(page, objectId, duplicateObject) {
  const current = createA4Page(page);
  const object = current.objects.find((item) => item.id === objectId);
  if (!object) return current;
  return addObjectToPage(current, duplicateObject(object));
}
