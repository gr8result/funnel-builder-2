import { createObject } from "../core/objectEngine.js";

export function createIconObject(props = {}) {
  return createObject("icon", {
    width: 48,
    height: 48,
    style: {
      color: "#111827",
      ...(props.style || {}),
    },
    data: {
      icon: "square",
      label: "",
      ...(props.data || {}),
    },
    ...props,
  });
}
