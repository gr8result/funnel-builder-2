import { createObject } from "../core/objectEngine.js";

export function createSignatureObject(props = {}) {
  return createObject("signature", {
    width: 260,
    height: 96,
    style: {
      borderColor: "#111827",
      textColor: "#111827",
      ...(props.style || {}),
    },
    data: {
      label: "Signature",
      signerName: "",
      ...(props.data || {}),
    },
    ...props,
  });
}
