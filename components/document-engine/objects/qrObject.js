import { createObject } from "../core/objectEngine.js";

export function createQrObject(props = {}) {
  return createObject("qr", {
    width: 96,
    height: 96,
    style: {
      color: "#111827",
      backgroundColor: "#ffffff",
      ...(props.style || {}),
    },
    data: {
      value: "",
      ...(props.data || {}),
    },
    ...props,
  });
}
