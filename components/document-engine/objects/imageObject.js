import { createObject } from "../core/objectEngine.js";

export function createImageObject(props = {}) {
  return createObject("image", {
    width: 240,
    height: 160,
    style: {
      objectFit: "cover",
      borderRadius: 0,
      ...(props.style || {}),
    },
    data: {
      imageRef: null,
      alt: "",
      ...(props.data || {}),
    },
    ...props,
  });
}
