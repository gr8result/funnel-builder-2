const WALL_DRAW_TOOLS = ["exterior-wall", "internal-wall"];

export function cursorForPlanViewer({ activeTool = "select", isSpacePanning = false, dragMode = null } = {}) {
  if (dragMode === "pan") return "grabbing";
  if (activeTool === "pan" || isSpacePanning) return "grab";
  if (WALL_DRAW_TOOLS.includes(activeTool)) return "crosshair";
  if (activeTool === "edit-walls" || activeTool === "edit") return dragMode ? "move" : "default";
  if (activeTool === "set-scale" || activeTool === "measure" || activeTool === "area" || activeTool === "plan-region") return "crosshair";
  return "default";
}
