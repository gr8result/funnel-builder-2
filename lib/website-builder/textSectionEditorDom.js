const TEXT_SECTION_BLOCK_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,blockquote,div";
const TEXT_SECTION_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "div"]);

function normalizeTagName(value = "") {
  const tag = String(value || "").trim().toLowerCase();
  return TEXT_SECTION_TAGS.has(tag) ? tag : "p";
}

export function isTextSectionEditableNode(editable) {
  if (!(editable instanceof Element)) return false;
  if (!editable.classList?.contains("wb-text-block")) return false;
  return String(editable.getAttribute("data-text-prop") || "").toLowerCase() === "text";
}

export function resolveSelectionBlockElement(editable, selection = null) {
  if (!(editable instanceof Element)) return null;
  const activeSelection = selection || (typeof window !== "undefined" ? window.getSelection?.() : null);
  const range = activeSelection?.rangeCount ? activeSelection.getRangeAt(0) : null;
  const startNode = range?.startContainer || activeSelection?.focusNode || activeSelection?.anchorNode || null;
  let node = startNode?.nodeType === Node.TEXT_NODE ? startNode.parentElement : (startNode instanceof Element ? startNode : null);

  while (node && node !== editable) {
    if (node.matches?.(TEXT_SECTION_BLOCK_SELECTOR)) return node;
    node = node.parentElement;
  }

  return editable.querySelector?.(TEXT_SECTION_BLOCK_SELECTOR) || null;
}

export function replaceSelectionBlockTag(blockElement, nextTagName) {
  if (!(blockElement instanceof Element)) return null;
  const nextTag = normalizeTagName(nextTagName);
  if (blockElement.tagName.toLowerCase() === nextTag) return blockElement;

  const replacement = document.createElement(nextTag);
  for (const attr of Array.from(blockElement.attributes || [])) {
    replacement.setAttribute(attr.name, attr.value);
  }
  while (blockElement.firstChild) {
    replacement.appendChild(blockElement.firstChild);
  }
  blockElement.replaceWith(replacement);
  return replacement;
}

export function applyStylePatchToElement(element, stylePatch = {}) {
  if (!(element instanceof Element)) return false;
  const entries = Object.entries(stylePatch || {});
  if (!entries.length) return false;
  entries.forEach(([key, value]) => {
    element.style[key] = value;
  });
  return true;
}
