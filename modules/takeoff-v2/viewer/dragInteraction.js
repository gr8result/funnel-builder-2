export const CLICK_THRESHOLD_PX = 6;

export function shouldForcePan(event, activeTool) {
  return (
    event?.code === "Space" ||
    event?.buttons === 4 ||
    activeTool === "pan" ||
    Boolean(event?.getModifierState?.("Space"))
  );
}

export function panViewFromDrag(previousView, drag, event) {
  if (!drag || drag.mode !== "pan" || !event) return previousView;
  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  return { ...previousView, panX: drag.panX + dx, panY: drag.panY + dy };
}

export function isClickPan(drag, event, threshold = CLICK_THRESHOLD_PX) {
  if (!drag || drag.mode !== "pan" || !event) return false;
  return Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <= threshold;
}
