import { createObject } from "../core/objectEngine.js";

export function createDividerObject(props = {}) {
  return createObject("divider", {
    width: 240,
    height: 2,
    style: {
      color: "#111827",
      thickness: 2,
      ...(props.style || {}),
    },
    data: {},
    ...props,
  });
}
