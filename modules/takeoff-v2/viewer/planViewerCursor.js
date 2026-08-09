const WALL_DRAW_TOOLS = ["exterior-wall", "internal-wall"];

export function cursorForPlanViewer({ activeTool = "select", isSpacePanning = false, dragMode = null, editHoverTarget = null } = {}) {
  if (dragMode === "pan") return "grabbing";
  if (dragMode === "vertex") return "grabbing";
  if (activeTool === "pan" || isSpacePanning) return "grab";
  if (WALL_DRAW_TOOLS.includes(activeTool)) return "crosshair";
  if (activeTool === "exterior-highlighter") return "pointer";
  if (activeTool === "edit-walls" || activeTool === "edit") {
    if (editHoverTarget?.type === "point") return "grab";
    if (editHoverTarget?.type === "segment") return "pointer";
    return "default";
  }
  if (activeTool === "set-scale" || activeTool === "measure" || activeTool === "area" || activeTool === "plan-region") return "crosshair";
  return "default";
}
