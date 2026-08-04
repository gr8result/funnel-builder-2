import { screenToDocumentPoint } from "./rotationTransform.js";

// Inverse of pageToScreenPoint: screen pixels inside the viewer container back
// to base document coordinates (unrotated PDF points).
export function screenToPagePoint({ viewport, panX = 0, panY = 0, zoomScale = 1 }, screenX, screenY) {
  return screenToDocumentPoint({ viewport, panX, panY, zoomScale }, { x: screenX, y: screenY });
}
