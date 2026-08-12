export const TOOLS = {
  SELECT: "select",
  PAN: "pan",
  SET_SCALE: "set-scale",
  DETECT_EXTERIOR: "detect-exterior",
  DRAW_EXTERIOR: "draw-exterior",
  DRAW_INTERIOR: "draw-interior",
  EDIT: "edit",
  DELETE: "delete",
};

export function ownerForPointerDown({ tool, targetType, spaceKey = false }) {
  if (targetType === "vertex") return "geometry";
  if (targetType === "wall") return "geometry";
  if (tool === TOOLS.PAN || spaceKey) return "viewer";
  if (tool === TOOLS.DRAW_EXTERIOR || tool === TOOLS.DRAW_INTERIOR || tool === TOOLS.SET_SCALE) return "drawing";
  return "selection";
}

export function createPointerSession({ pointerId, tool, targetType = "empty", documentPoint = null, screenPoint = null, spaceKey = false }) {
  const owner = ownerForPointerDown({ tool, targetType, spaceKey });
  return {
    pointerId,
    tool,
    targetType,
    owner,
    startedAtDocument: documentPoint,
    startedAtScreen: screenPoint,
    currentDocument: documentPoint,
    currentScreen: screenPoint,
  };
}

export function canPan(session) {
  return session?.owner === "viewer";
}

export function canEditGeometry(session) {
  return session?.owner === "geometry" || session?.owner === "drawing" || session?.owner === "selection";
}
