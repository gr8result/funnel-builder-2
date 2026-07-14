import { createObject } from "../core/objectEngine.js";

export function createShapeObject(props = {}) {
  return createObject("shape", {
    width: 160,
    height: 96,
    style: {
      fill: "#f3f4f6",
      stroke: "#d1d5db",
      strokeWidth: 1,
      borderRadius: 0,
      ...(props.style || {}),
    },
    data: {
      shape: "rectangle",
      ...(props.data || {}),
    },
    ...props,
  });
}
