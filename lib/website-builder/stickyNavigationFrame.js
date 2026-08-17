const NAVIGATION_BLOCK_TYPES = new Set(["nav-bar", "navigation-bar"]);

export function isStickyNavigationBlock(block) {
  const type = String(block?.type || "").trim().toLowerCase();
  if (!NAVIGATION_BLOCK_TYPES.has(type)) return false;

  const props = block?.props || {};
  if (props.sticky === false || props.positionSticky === false) return false;

  const stickyMode = String(props.stickyMode || "").trim().toLowerCase();
  if (stickyMode && stickyMode !== "normal" && stickyMode !== "none" && stickyMode !== "static") return true;

  return props.sticky === true || props.positionSticky === true;
}

export function stickyNavigationFrameStyle(block, { editor = false } = {}) {
  if (!isStickyNavigationBlock(block)) return {};

  return {
    position: "relative",
    top: 0,
    zIndex: editor ? 70 : 10000,
    overflow: "visible",
    overflowX: "visible",
    overflowY: "visible",
    alignSelf: "start",
  };
}
