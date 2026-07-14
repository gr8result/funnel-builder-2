import { createObject } from "../core/objectEngine.js";

export function createLogoObject(props = {}) {
  return createObject("logo", {
    width: 160,
    height: 90,
    style: {
      objectFit: "contain",
      ...(props.style || {}),
    },
    data: {
      imageRef: null,
      alt: "Logo",
      ...(props.data || {}),
    },
    ...props,
  });
}
