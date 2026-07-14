import { createObject } from "../core/objectEngine.js";

export function createDynamicFieldObject(fieldId, props = {}) {
  return createObject("dynamicField", {
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
    dynamicFieldId: fieldId,
    data: {
      text: `{{${fieldId}}}`,
      ...(props.data || {}),
    },
    ...props,
  });
}
