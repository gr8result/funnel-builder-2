const ALIGNMENT_GUIDE_ATTR = "data-canvas-alignment-guides";

const ALIGNMENT_GUIDE_TOLERANCE = 3;

function ensureAlignmentGuideLayer(root) {
  if (!root) return null;
  let layer = root.querySelector(`[${ALIGNMENT_GUIDE_ATTR}]`);
  if (!layer) {
    layer = document.createElement("div");
    layer.setAttribute(ALIGNMENT_GUIDE_ATTR, "true");
    layer.style.position = "absolute";
    layer.style.inset = "0";
    layer.style.pointerEvents = "none";
    layer.style.zIndex = "25";

    const vertical = document.createElement("div");
    vertical.setAttribute("data-guide-axis", "vertical");
    vertical.style.position = "absolute";
    vertical.style.left = "50%";
    vertical.style.top = "0";
    vertical.style.bottom = "0";
    vertical.style.width = "0";
    vertical.style.borderLeft = "1.5px dashed rgba(56,189,248,0.95)";
    vertical.style.transform = "translateX(-50%)";
    vertical.style.display = "none";

    const horizontal = document.createElement("div");
    horizontal.setAttribute("data-guide-axis", "horizontal");
    horizontal.style.position = "absolute";
    horizontal.style.top = "50%";
    horizontal.style.left = "0";
    horizontal.style.right = "0";
    horizontal.style.height = "0";
    horizontal.style.borderTop = "1.5px dashed rgba(56,189,248,0.95)";
    horizontal.style.transform = "translateY(-50%)";
    horizontal.style.display = "none";

    layer.appendChild(vertical);
    layer.appendChild(horizontal);
    root.appendChild(layer);
  }
  return layer;
}

export function updateAlignmentGuides(root, x, y) {
  const layer = ensureAlignmentGuideLayer(root);
  if (!layer) return;
  const vertical = layer.querySelector('[data-guide-axis="vertical"]');
  const horizontal = layer.querySelector('[data-guide-axis="horizontal"]');
  const showVertical = Math.abs(Number(x || 0) - 50) <= ALIGNMENT_GUIDE_TOLERANCE;
  const showHorizontal = Math.abs(Number(y || 0) - 50) <= ALIGNMENT_GUIDE_TOLERANCE;
  if (vertical) vertical.style.display = showVertical ? "block" : "none";
  if (horizontal) horizontal.style.display = showHorizontal ? "block" : "none";
}

export function clearAlignmentGuides(root) {
  const layer = root?.querySelector?.(`[${ALIGNMENT_GUIDE_ATTR}]`);
  if (layer) layer.remove();
}
