export function sectionStyle(block, theme) {
  const p = block?.props || {};
  return {
    padding: `${Number(p.paddingY ?? 48)}px ${Number(p.paddingX ?? 20)}px`,
    background: p.background || "transparent",
    borderRadius: Number(p.radius ?? 14),
    color: theme?.text || "white",
  };
}

export function editableStyle(theme) {
  return {
    outline: "none",
    borderRadius: 10,
    padding: "6px 8px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    color: theme?.text || "white",
  };
}
