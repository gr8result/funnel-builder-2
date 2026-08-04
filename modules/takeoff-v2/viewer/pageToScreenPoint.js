import { documentToScreenPoint } from "./rotationTransform.js";

// Converts base document coordinates (unrotated PDF points) to screen pixels
// inside the viewer container. The pdf.js viewport owns page rotation and base
// render scale; the app's pan and zoom are applied on top.
export function pageToScreenPoint({ viewport, panX = 0, panY = 0, zoomScale = 1 }, pageX, pageY) {
  return documentToScreenPoint({ viewport, panX, panY, zoomScale }, { x: pageX, y: pageY });
}
