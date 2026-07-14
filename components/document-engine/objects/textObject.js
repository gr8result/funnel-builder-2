import { createObject } from "../core/objectEngine.js";

export function createTextObject(props = {}) {
  return createObject("text", {
    width: 240,
    height: 64,
    style: {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: 24,
      fontWeight: 600,
      color: "#111827",
      textAlign: "left",
      lineHeight: 1.2,
      ...(props.style || {}),
    },
    data: {
      text: "Text",
      ...(props.data || {}),
    },
    ...props,
  });
}
