import { createObject } from "../core/objectEngine.js";

export function createTableObject(props = {}) {
  return createObject("table", {
    width: 420,
    height: 180,
    style: {
      borderColor: "#d1d5db",
      headerFill: "#f9fafb",
      textColor: "#111827",
      ...(props.style || {}),
    },
    data: {
      columns: ["Item", "Description", "Total"],
      rows: [],
      ...(props.data || {}),
    },
    ...props,
  });
}
