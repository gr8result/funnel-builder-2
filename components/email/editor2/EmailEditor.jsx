/**
 * EmailEditor v2 — zero GrapesJS, pure React
 * Left panel: block catalog  |  Center: 600px canvas  |  Right: inspector
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
const ImageEditModal = dynamic(() => import("./ImageEditModal"), { ssr: false });
const ImageLibraryModal = dynamic(() => import("./ImageLibraryModal"), { ssr: false });
const AiGenerateModal = dynamic(() => import("./AiGenerateModal"), { ssr: false });
const AiImageModal = dynamic(() => import("./AiImageModal"), { ssr: false });

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function rich(s) {
  const str = String(s ?? "");
  return /<\/?[a-z][\s\S]*>/i.test(str) ? str : esc(str);
}
function applyDefaultAnchorStyles(root, { color = "", textDecoration = "inherit" } = {}) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll("a[href]").forEach((anchor) => {
    if (color && !anchor.style.color) {
      anchor.style.color = color;
    }
    if (!anchor.style.textDecoration) {
      anchor.style.textDecoration = textDecoration;
    }
    if (!anchor.style.textDecorationColor) {
      anchor.style.textDecorationColor = "currentColor";
    }
    if (!anchor.getAttribute("target")) {
      anchor.setAttribute("target", "_blank");
    }
    if (!anchor.getAttribute("rel")) {
      anchor.setAttribute("rel", "noopener noreferrer");
    }
  });
}
function withDefaultAnchorStyles(html = "", options = {}) {
  const source = String(html || "");
  if (!source || !/<a\b/i.test(source)) return source;

  if (typeof document === "undefined") {
    return source.replace(/<a\b([^>]*)>/gi, (match, attrs) => {
      let nextAttrs = attrs;
      const styleMatch = nextAttrs.match(/\sstyle\s*=\s*(["'])(.*?)\1/i);
      let styleValue = styleMatch ? styleMatch[2].trim() : "";

      if (options.color && !/color\s*:/i.test(styleValue)) {
        styleValue = `${styleValue}${styleValue ? ";" : ""}color:${options.color}`;
      }
      if (!/text-decoration\s*:/i.test(styleValue)) {
        styleValue = `${styleValue}${styleValue ? ";" : ""}text-decoration:${options.textDecoration || "inherit"}`;
      }
      if (!/text-decoration-color\s*:/i.test(styleValue)) {
        styleValue = `${styleValue}${styleValue ? ";" : ""}text-decoration-color:currentColor`;
      }

      if (styleMatch) {
        nextAttrs = nextAttrs.replace(styleMatch[0], ` style="${styleValue}"`);
      } else if (styleValue) {
        nextAttrs += ` style="${styleValue}"`;
      }
      if (!/\starget\s*=/i.test(nextAttrs)) {
        nextAttrs += ' target="_blank"';
      }
      if (!/\srel\s*=/i.test(nextAttrs)) {
        nextAttrs += ' rel="noopener noreferrer"';
      }
      return `<a${nextAttrs}>`;
    });
  }

  const template = document.createElement("template");
  template.innerHTML = source;
  applyDefaultAnchorStyles(template.content, options);
  return template.innerHTML;
}
function toAbsoluteUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(data:|mailto:|tel:|#|blob:)/i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (/^https?:/i.test(raw)) return raw;
  const supabaseBase =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    (typeof process !== "undefined" && process.env.SUPABASE_URL) ||
    "";
  if (raw.startsWith("/email-assets/") && supabaseBase) {
    const cleanBase = String(supabaseBase).replace(/\/+$/, "");
    return `${cleanBase}/storage/v1/object/public${raw}`;
  }
  const publicBase =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SITE_URL) ||
    (typeof process !== "undefined" && process.env.SITE_URL) ||
    "";
  const runtimeBase = typeof window !== "undefined" ? window.location.origin : "";
  const base = String(publicBase || runtimeBase || "").replace(/\/$/, "");
  if (raw.startsWith("/") && base) return `${base}${raw}`;
  return raw;
}
function unwrapElement(node) {
  if (!node || !node.parentNode) return;
  const parent = node.parentNode;
  while (node.firstChild) parent.insertBefore(node.firstChild, node);
  parent.removeChild(node);
}
function findAncestorWithin(node, root, matcher) {
  let current = node?.nodeType === 1 ? node : node?.parentElement || null;
  while (current && current !== root) {
    if (matcher(current)) return current;
    current = current.parentElement;
  }
  return null;
}
function placeCaretAfter(sel, node) {
  if (!sel || !node || typeof document === "undefined") return;
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}
function focusEditableInBlock(blockId) {
  if (typeof document === "undefined" || !blockId) return null;
  const rawId = String(blockId || "");
  const safeId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(rawId) : rawId.replace(/"/g, '\\"');
  const editable = document.querySelector(`[data-block-id="${safeId}"] [data-inline-editor="true"], [data-block-id="${safeId}"] [contenteditable="true"]`);
  if (!editable) return null;

  editable.focus?.();

  if (typeof window !== "undefined") {
    const sel = window.getSelection?.();
    if (sel && (!sel.rangeCount || !editable.contains(sel.anchorNode))) {
      const range = document.createRange();
      range.selectNodeContents(editable);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  return editable;
}
function wrapSelection(range, element) {
  if (!range || !element) return null;
  try {
    range.surroundContents(element);
  } catch {
    const fragment = range.extractContents();
    element.appendChild(fragment);
    range.insertNode(element);
  }
  return element;
}
function wrapRootContents(root, element) {
  if (!root || !element || typeof document === "undefined") return null;
  element.innerHTML = root.innerHTML || "&#8203;";
  root.innerHTML = "";
  root.appendChild(element);
  return element;
}
function ensureRangeInRoot(root, restoreSelection) {
  if (!root || typeof window === "undefined" || typeof document === "undefined") return { sel: null, range: null };
  const sel = restoreSelection?.() || window.getSelection?.();
  let range = sel?.rangeCount ? sel.getRangeAt(0) : null;

  if (!range || !root.contains(range.commonAncestorContainer)) {
    range = document.createRange();
    if ((root.textContent || "").trim() || root.childNodes.length) {
      range.selectNodeContents(root);
    } else {
      range.setStart(root, 0);
      range.collapse(true);
    }
    sel?.removeAllRanges?.();
    sel?.addRange?.(range);
  }

  return { sel, range };
}
function fallbackRichTextCommand(root, range, sel, command, value = null) {
  if (!root || !range || typeof document === "undefined") return false;
  const currentElement = range.startContainer?.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;

  switch (command) {
    case "bold":
    case "italic":
    case "underline": {
      const existing = findAncestorWithin(range.commonAncestorContainer, root, (el) => {
        if (command === "bold") return el.tagName === "STRONG" || el.tagName === "B";
        if (command === "italic") return el.tagName === "EM" || el.tagName === "I";
        return el.tagName === "U" || String(el.style?.textDecoration || "").includes("underline");
      });
      if (existing) {
        unwrapElement(existing);
        return true;
      }
      if (range.collapsed) {
        if (currentElement?.style && currentElement !== root) {
          if (command === "bold") currentElement.style.fontWeight = String(currentElement.style.fontWeight || "") === "700" ? "" : "700";
          if (command === "italic") currentElement.style.fontStyle = currentElement.style.fontStyle === "italic" ? "" : "italic";
          if (command === "underline") currentElement.style.textDecoration = String(currentElement.style.textDecoration || "").includes("underline") ? "" : "underline";
          return true;
        }
        const persistentWrapper = document.createElement(command === "bold" ? "strong" : command === "italic" ? "em" : "span");
        if (command === "bold") persistentWrapper.style.fontWeight = "700";
        if (command === "italic") persistentWrapper.style.fontStyle = "italic";
        if (command === "underline") persistentWrapper.style.textDecoration = "underline";
        wrapRootContents(root, persistentWrapper);
        placeCaretAfter(sel, persistentWrapper);
        return true;
      }
      const wrapper = document.createElement(command === "bold" ? "strong" : command === "italic" ? "em" : "span");
      if (command === "bold") wrapper.style.fontWeight = "700";
      if (command === "italic") wrapper.style.fontStyle = "italic";
      if (command === "underline") wrapper.style.textDecoration = "underline";
      wrapSelection(range, wrapper);
      placeCaretAfter(sel, wrapper);
      return true;
    }
    case "createLink": {
      const href = String(value || "").trim();
      if (!href) return false;
      const existing = findAncestorWithin(range.commonAncestorContainer, root, (el) => el.tagName === "A");
      if (existing) {
        existing.setAttribute("href", href);
        existing.setAttribute("target", "_blank");
        existing.setAttribute("rel", "noopener noreferrer");
        return true;
      }
      const link = document.createElement("a");
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.style.color = "inherit";
      if (range.collapsed) {
        link.textContent = href;
        range.insertNode(link);
      } else {
        wrapSelection(range, link);
      }
      placeCaretAfter(sel, link);
      return true;
    }
    case "unlink": {
      const anchor = findAncestorWithin(range.commonAncestorContainer, root, (el) => el.tagName === "A");
      if (!anchor) return false;
      unwrapElement(anchor);
      return true;
    }
    case "removeFormat": {
      if (!range.collapsed) {
        const plainText = range.toString();
        range.deleteContents();
        const textNode = document.createTextNode(plainText);
        range.insertNode(textNode);
        placeCaretAfter(sel, textNode);
        return true;
      }
      const wrapper = findAncestorWithin(range.commonAncestorContainer, root, (el) => ["A", "STRONG", "B", "EM", "I", "U", "SPAN", "FONT"].includes(el.tagName));
      if (wrapper) {
        unwrapElement(wrapper);
        return true;
      }
      if (currentElement?.style && currentElement !== root) {
        currentElement.removeAttribute("style");
        return true;
      }
      return false;
    }
    case "formatBlock": {
      const nextTag = String(value || "p").replace(/[<>]/g, "").toLowerCase();
      if (!/^(p|div|h1|h2|h3|h4|h5|h6)$/.test(nextTag)) return false;
      const block = findAncestorWithin(range.startContainer, root, (el) => /^(P|DIV|H1|H2|H3|H4|H5|H6)$/.test(el.tagName));
      if (block && block !== root) {
        const replacement = document.createElement(nextTag);
        replacement.innerHTML = block.innerHTML;
        Array.from(block.attributes || []).forEach((attr) => replacement.setAttribute(attr.name, attr.value));
        block.parentNode?.replaceChild(replacement, block);
        placeCaretAfter(sel, replacement);
        return true;
      }
      if (!range.collapsed) {
        const wrapper = document.createElement(nextTag);
        wrapSelection(range, wrapper);
        placeCaretAfter(sel, wrapper);
        return true;
      }
      const persistentBlock = document.createElement(nextTag);
      wrapRootContents(root, persistentBlock);
      placeCaretAfter(sel, persistentBlock);
      return true;
    }
    default:
      return false;
  }
}
function fallbackToggleList(root, range, sel, ordered = false) {
  if (!root || !range || typeof document === "undefined") return false;
  const desiredTag = ordered ? "OL" : "UL";
  const existing = findAncestorWithin(range.commonAncestorContainer, root, (el) => el.tagName === "UL" || el.tagName === "OL");

  if (existing) {
    if (existing.tagName === desiredTag) {
      const fragment = document.createDocumentFragment();
      Array.from(existing.children).forEach((child) => {
        const p = document.createElement("p");
        p.innerHTML = child.innerHTML;
        fragment.appendChild(p);
      });
      existing.parentNode?.replaceChild(fragment, existing);
      return true;
    }
    const replacement = document.createElement(ordered ? "ol" : "ul");
    replacement.innerHTML = existing.innerHTML;
    replacement.style.paddingLeft = "1.5em";
    replacement.style.margin = "0.75em 0";
    existing.parentNode?.replaceChild(replacement, existing);
    placeCaretAfter(sel, replacement);
    return true;
  }

  const list = document.createElement(ordered ? "ol" : "ul");
  list.style.paddingLeft = "1.5em";
  list.style.margin = "0.75em 0";

  if (range.collapsed) {
    const block = findAncestorWithin(range.startContainer, root, (el) => /^(P|DIV|H1|H2|H3|H4|H5|H6)$/.test(el.tagName));
    const item = document.createElement("li");
    item.innerHTML = block?.innerHTML || String(range.startContainer?.textContent || "").trim() || "List item";
    list.appendChild(item);
    if (block && block !== root && block.parentNode) {
      block.parentNode.replaceChild(list, block);
    } else {
      root.appendChild(list);
    }
    placeCaretAfter(sel, list);
    return true;
  }

  const fragment = range.extractContents();
  const bucket = document.createElement("div");
  bucket.appendChild(fragment);
  const html = bucket.innerHTML.trim();
  const chunks = html ? html.split(/<br\s*\/?>/i).map((entry) => entry.trim()).filter(Boolean) : [];

  if (chunks.length) {
    chunks.forEach((entry) => {
      const item = document.createElement("li");
      item.innerHTML = entry;
      list.appendChild(item);
    });
  } else {
    const item = document.createElement("li");
    item.textContent = bucket.textContent?.trim() || "List item";
    list.appendChild(item);
  }

  range.insertNode(list);
  placeCaretAfter(sel, list);
  return true;
}
function runRichTextCommand(root, restoreSelection, rememberSelection, commit, command, value = null, normalize) {
  if (!root || typeof document === "undefined" || typeof window === "undefined") return "";
  root.focus();
  let { sel, range } = ensureRangeInRoot(root, restoreSelection);
  if (!range) {
    return commit?.() || "";
  }

  const before = root.innerHTML;
  let nativeResult = false;
  try {
    nativeResult = document.execCommand(command, false, value);
  } catch {
    nativeResult = false;
  }

  normalize?.();
  rememberSelection?.();

  if (root.innerHTML === before || nativeResult === false) {
    sel = restoreSelection?.() || window.getSelection?.();
    range = sel?.rangeCount ? sel.getRangeAt(0) : null;
    if (range && root.contains(range.commonAncestorContainer)) {
      if (command === "insertOrderedList" || command === "insertUnorderedList") {
        fallbackToggleList(root, range, sel, command === "insertOrderedList");
      } else {
        fallbackRichTextCommand(root, range, sel, command, value);
      }
      normalize?.();
      rememberSelection?.();
    }
  }

  return commit?.() || "";
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, Number(v) || 0));
}

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

function updateAlignmentGuides(root, x, y) {
  const layer = ensureAlignmentGuideLayer(root);
  if (!layer) return;
  const vertical = layer.querySelector('[data-guide-axis="vertical"]');
  const horizontal = layer.querySelector('[data-guide-axis="horizontal"]');
  const showVertical = Math.abs(Number(x || 0) - 50) <= ALIGNMENT_GUIDE_TOLERANCE;
  const showHorizontal = Math.abs(Number(y || 0) - 50) <= ALIGNMENT_GUIDE_TOLERANCE;
  if (vertical) vertical.style.display = showVertical ? "block" : "none";
  if (horizontal) horizontal.style.display = showHorizontal ? "block" : "none";
}

function clearAlignmentGuides(root) {
  const layer = root?.querySelector?.(`[${ALIGNMENT_GUIDE_ATTR}]`);
  if (layer) layer.remove();
}

function parseColorToRgb(color) {
  const raw = String(color || "").trim();
  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const value = hex[1].length === 3
      ? hex[1].split("").map((part) => part + part).join("")
      : hex[1];
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }

  const rgb = raw.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgb) {
    return {
      r: clamp(Number(rgb[1]), 0, 255),
      g: clamp(Number(rgb[2]), 0, 255),
      b: clamp(Number(rgb[3]), 0, 255),
    };
  }

  return null;
}
function rgbToHex({ r = 0, g = 0, b = 0 } = {}) {
  const toHex = (value) => clamp(value, 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function parseAlphaFromColor(color, fallback = 0.38) {
  const raw = String(color || "").trim();
  if (/^transparent$/i.test(raw)) return 0;
  const match = raw.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([0-9]*\.?[0-9]+)\s*\)$/i);
  if (!match) return fallback;
  return clamp(Number(match[1]) * 100, 0, 100) / 100;
}
function composeOverlayColor(baseColor, opacity = 0.38) {
  if (String(baseColor || "").trim().toLowerCase() === "transparent") return "transparent";
  const rgb = parseColorToRgb(baseColor) || { r: 15, g: 23, b: 42 };
  const alpha = clamp(Number(opacity) * 100, 0, 100) / 100;
  if (alpha >= 1) return rgbToHex(rgb);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}
function getColorLuminance(color) {
  const rgb = parseColorToRgb(color);
  if (!rgb) return null;
  const channels = [rgb.r, rgb.g, rgb.b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}
function ensureReadableColor(color, background, lightFallback = "#ffffff", darkFallback = "#0f172a") {
  const bgLum = getColorLuminance(background);
  const fgLum = getColorLuminance(color);
  if (bgLum == null) return color || lightFallback;
  if (fgLum == null) return bgLum < 0.5 ? lightFallback : darkFallback;
  return Math.abs(fgLum - bgLum) < 0.36 ? (bgLum < 0.5 ? lightFallback : darkFallback) : color;
}
function resolvePreferredColor(color, background, lightFallback = "#ffffff", darkFallback = "#0f172a") {
  const preferred = String(color || "").trim();
  return preferred ? preferred : ensureReadableColor("", background, lightFallback, darkFallback);
}
function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}
function chunkItems(items = [], size = 1) {
  const n = Math.max(1, Number(size) || 1);
  const rows = [];
  for (let i = 0; i < items.length; i += n) rows.push(items.slice(i, i + n));
  return rows;
}

const SOCIAL_ICONS = {
  facebook:  "/email-assets/social/facebook.svg",
  instagram: "/email-assets/social/instagram.svg",
  linkedin:  "/email-assets/social/linkedin.svg",
  x:         "/email-assets/social/x.svg",
  youtube:   "/email-assets/social/youtube.svg",
  pinterest: "/email-assets/social/pinterest.svg",
};

const SOCIAL_EMAIL_ICONS = {
  facebook:  "/email-assets/social/facebook.png",
  instagram: "/email-assets/social/instagram.png",
  linkedin:  "/email-assets/social/linkedin.png",
  x:         "/email-assets/social/x.png",
  youtube:   "/email-assets/social/youtube.png",
  pinterest: "/email-assets/social/pinterest.png",
};

const SOCIAL_ICON_SVG = {
  facebook: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-label="Facebook"><rect width="24" height="24" rx="4" fill="#1877F2"/><path fill="#fff" d="M14.5 8.7V7.2c0-.7.4-1.2 1.2-1.2H17V3h-2.4C12.4 3 11 4.5 11 6.8v1.9H9v3h2V21h3.3v-9.3H17l.5-3h-3z"/></svg>',
  instagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-label="Instagram"><defs><linearGradient id="ig" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f58529"/><stop offset="0.35" stop-color="#dd2a7b"/><stop offset="0.7" stop-color="#8134af"/><stop offset="1" stop-color="#515bd4"/></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#ig)"/><rect x="6.5" y="6.5" width="11" height="11" rx="3" fill="none" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="#fff" stroke-width="2"/><circle cx="16.8" cy="7.8" r="1.1" fill="#fff"/></svg>',
  linkedin: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-label="LinkedIn"><rect width="24" height="24" rx="4" fill="#0A66C2"/><circle cx="7" cy="8" r="1.5" fill="#fff"/><rect x="5.75" y="10" width="2.5" height="8" fill="#fff"/><path fill="#fff" d="M10.5 10h2.4v1.1h.03c.34-.64 1.17-1.31 2.42-1.31 2.6 0 3.08 1.71 3.08 3.93V18H16v-3.73c0-.89-.02-2.03-1.24-2.03-1.24 0-1.43.97-1.43 1.97V18H10.5z"/></svg>',
  x: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-label="X"><rect width="24" height="24" rx="4" fill="#111111"/><path fill="#fff" d="M14.1 10.3 19.3 4h-1.2l-4.5 5.5L10 4H4l5.5 8-5.5 6.7h1.2l4.9-5.9 4.1 5.9H20zM10.7 12l-.5-.7L6 5.2h2.7l3.4 4.9.5.7 4.4 6.3h-2.7z"/></svg>',
  youtube: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-label="YouTube"><rect width="24" height="24" rx="5" fill="#FF0033"/><path fill="#fff" d="M17.8 8.7a2 2 0 0 0-1.4-1.4C15.2 7 12 7 12 7s-3.2 0-4.4.3a2 2 0 0 0-1.4 1.4C6 9.9 6 12 6 12s0 2.1.2 3.3a2 2 0 0 0 1.4 1.4C8.8 17 12 17 12 17s3.2 0 4.4-.3a2 2 0 0 0 1.4-1.4C18 14.1 18 12 18 12s0-2.1-.2-3.3"/><path fill="#fff" d="m10.5 14.6 4.2-2.6-4.2-2.6z"/></svg>',
  pinterest: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-label="Pinterest"><rect width="24" height="24" rx="5" fill="#E60023"/><path fill="#fff" d="M12.3 5C8.6 5 7 7.6 7 9.8c0 1.4.5 2.7 1.6 3.2.2.1.3 0 .4-.2l.2-.9c.1-.2 0-.3-.1-.5-.3-.4-.5-.9-.5-1.6 0-2 1.5-3.8 4-3.8 2.2 0 3.4 1.3 3.4 3.1 0 2.3-1 4.3-2.5 4.3-.8 0-1.4-.7-1.2-1.5.2-1 .7-2.2.7-3 0-.7-.4-1.3-1.2-1.3-.9 0-1.6 1-1.6 2.3 0 .8.3 1.4.3 1.4l-1.1 4.7c-.3 1.1 0 2.5.1 2.6.1.1.2 0 .2-.1.1-.2 1.1-1.4 1.4-2.8l.4-1.6c.2.4 1 .8 1.8.8 2.3 0 3.9-2.1 3.9-4.9C18 7 15.7 5 12.3 5"/></svg>',
};

function svgToDataUri(svg = "") {
  return `data:image/svg+xml;utf8,${encodeURIComponent(String(svg || ""))}`;
}

const SOCIAL_ICON_ALIASES = {
  fb: "facebook",
  facebookicon: "facebook",
  insta: "instagram",
  ig: "instagram",
  linkedincompany: "linkedin",
  linkedinicon: "linkedin",
  twitter: "x",
  tweet: "x",
  xcom: "x",
  yt: "youtube",
  youTube: "youtube",
  pin: "pinterest",
};

const SOCIAL_BADGES = {
  facebook: { label: "f", bg: "#1877f2", color: "#ffffff", fontSize: 18 },
  instagram: { label: "IG", bg: "#e1306c", color: "#ffffff", fontSize: 11 },
  linkedin: { label: "in", bg: "#0a66c2", color: "#ffffff", fontSize: 14 },
  x: { label: "X", bg: "#111111", color: "#ffffff", fontSize: 14 },
  youtube: { label: ">", bg: "#ff0033", color: "#ffffff", fontSize: 16 },
  pinterest: { label: "P", bg: "#e60023", color: "#ffffff", fontSize: 16 },
};

const SOCIAL_ICON_SIZE = 48;

const BLOCK_RADIUS_DEFAULTS = {
  header: 8,
  text: 0,
  image: 0,
  button: 0,
  divider: 0,
  spacer: 0,
  hero: 12,
  imageText: 12,
  quote: 12,
  promo: 14,
  video: 12,
  contact: 12,
  grid: 0,
  list: 0,
  gridCard: 12,
  listCard: 12,
  social: 10,
  footer: 8,
};

function defaultBlockRadius(type = "") {
  return BLOCK_RADIUS_DEFAULTS[String(type || "")] ?? 0;
}

function resolveBlockRadius(props = {}, fallback = 0) {
  return clamp(Number(props?.blockRadius ?? fallback), 0, 120);
}

function withNormalizedBlockProps(type, props = {}) {
  const merged = { ...deepClone(DEFAULTS[type] || {}), ...(props || {}) };
  if (merged.blockRadius === undefined) {
    merged.blockRadius = defaultBlockRadius(type);
  }
  if (type === "image" && (!Object.prototype.hasOwnProperty.call(props || {}, "bgColor") || String(merged.bgColor || "").toLowerCase() === "#f8fafc")) {
    merged.bgColor = "transparent";
  }
  if (type === "imageText") {
    const isLegacyDefaultLayout = Number(props?.headlineY ?? 28) === 28
      && Number(props?.subtextY ?? 56) === 56
      && Number(props?.buttonY ?? 84) === 84;
    if (!Object.prototype.hasOwnProperty.call(props || {}, "buttonY") || isLegacyDefaultLayout) {
      merged.buttonY = 78;
    }
    if (!Object.prototype.hasOwnProperty.call(props || {}, "buttonBoxHeightPx") || isLegacyDefaultLayout) {
      merged.buttonBoxHeightPx = Math.max(84, Number(merged.buttonBoxHeightPx || 72));
    }
  }
  return merged;
}

function getSocialIconPath(name = "") {
  const normalized = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const key = SOCIAL_ICON_ALIASES[normalized] || (normalized === "twitter" ? "x" : normalized);
  return SOCIAL_ICONS[key] || "";
}

function getSocialIconUrl(name = "") {
  const normalized = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const key = SOCIAL_ICON_ALIASES[normalized] || (normalized === "twitter" ? "x" : normalized);
  const inlineSvg = SOCIAL_ICON_SVG[key];
  if (inlineSvg) return svgToDataUri(inlineSvg);
  return toAbsoluteUrl(getSocialIconPath(name));
}

function getSocialIconExportUrl(name = "") {
  const normalized = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const key = SOCIAL_ICON_ALIASES[normalized] || (normalized === "twitter" ? "x" : normalized);
  return toAbsoluteUrl(SOCIAL_EMAIL_ICONS[key] || getSocialIconPath(name));
}

function toEmailAssetUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(blob:)/i.test(raw)) return "";
  if (/^data:/i.test(raw)) return raw;
  return toAbsoluteUrl(raw);
}

function isEmailRenderableUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (/^data:image\//i.test(raw)) return true;
  if (/^https?:\/\//i.test(raw)) return true;
  return false;
}

function normalizeSocialPlatformName(name = "") {
  const normalized = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return SOCIAL_ICON_ALIASES[normalized] || (normalized === "twitter" ? "x" : normalized);
}

function getSocialBadge(name = "") {
  return SOCIAL_BADGES[normalizeSocialPlatformName(name)] || { label: String(name || "?").slice(0, 2).toUpperCase(), bg: "#475569", color: "#ffffff", fontSize: 12 };
}

function pixelWidthFromPercent(totalWidth, percent = 100, horizontalPadding = 0) {
  const safeTotal = Math.max(0, Number(totalWidth || 600) - Number(horizontalPadding || 0));
  const safePercent = clamp(Number(percent || 100), 1, 100);
  return Math.max(1, Math.round((safeTotal * safePercent) / 100));
}

function clampOverlayCenterPct(value, boxSizePx, containerSizePx, edgePaddingPx = 28) {
  const safeContainer = Math.max(1, Number(containerSizePx || 1));
  const halfBox = Math.max(0, Number(boxSizePx || 0)) / 2;
  const minPct = ((halfBox + Math.max(0, Number(edgePaddingPx || 0))) / safeContainer) * 100;
  const maxPct = 100 - minPct;
  if (minPct >= maxPct) return 50;
  return clamp(Number(value ?? 50), minPct, maxPct);
}

const COLOR_PRESETS = [
  "#ffffff",
  "#000000",
  "#1e293b",
  "#64748b",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#2563eb",
  "#7c3aed",
  "#ec4899",
];

const TEXT_COLOR_OPTIONS = [
  "#111827",
  "#475569",
  "#2563eb",
  "#7c3aed",
  "#16a34a",
  "#ea580c",
  "#dc2626",
  "#ec4899",
];

const HIGHLIGHT_COLOR_OPTIONS = [
  "transparent",
  "#fff59d",
  "#fed7aa",
  "#bfdbfe",
  "#bbf7d0",
  "#fbcfe8",
  "#ddd6fe",
];

const TEXT_VARIANT_OPTIONS = [
  { value: "body", label: "Body Text" },
  { value: "headline", label: "Headline" },
  { value: "h1", label: "H1" },
  { value: "h2", label: "H2" },
  { value: "h3", label: "H3" },
  { value: "small", label: "Small Text" },
];

const TEXT_SIZE_OPTIONS = [
  { value: "12", label: "12 px" },
  { value: "14", label: "14 px" },
  { value: "16", label: "16 px" },
  { value: "18", label: "18 px" },
  { value: "20", label: "20 px" },
  { value: "24", label: "24 px" },
  { value: "28", label: "28 px" },
  { value: "32", label: "32 px" },
  { value: "36", label: "36 px" },
  { value: "40", label: "40 px" },
  { value: "48", label: "48 px" },
  { value: "56", label: "56 px" },
  { value: "64", label: "64 px" },
];

const BACKGROUND_REPEAT_OPTIONS = [
  { value: "no-repeat", label: "No Repeat" },
  { value: "repeat", label: "Repeat" },
  { value: "repeat-x", label: "Repeat X" },
  { value: "repeat-y", label: "Repeat Y" },
];

const FONT_FAMILY_OPTIONS = [
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: 'Tahoma, Geneva, sans-serif', label: 'Tahoma' },
  { value: 'Trebuchet MS, Helvetica, sans-serif', label: 'Trebuchet MS' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Times New Roman, Times, serif', label: 'Times New Roman' },
  { value: 'Garamond, serif', label: 'Garamond' },
  { value: 'Palatino, URW Palladio L, serif', label: 'Palatino' },
  { value: 'Courier New, Courier, monospace', label: 'Courier New' },
  { value: 'Lucida Sans Unicode, Lucida Grande, sans-serif', label: 'Lucida Sans' },
  { value: 'Segoe UI, Tahoma, sans-serif', label: 'Segoe UI' },
  { value: 'Impact, Haettenschweiler, sans-serif', label: 'Impact' },
  { value: 'Comic Sans MS, Comic Sans, cursive', label: 'Comic Sans MS' },
  { value: 'Inter, Arial, sans-serif', label: 'Inter' },
  { value: 'Roboto, Arial, sans-serif', label: 'Roboto' },
  { value: 'Open Sans, Arial, sans-serif', label: 'Open Sans' },
  { value: 'Lato, Arial, sans-serif', label: 'Lato' },
  { value: 'Montserrat, Arial, sans-serif', label: 'Montserrat' },
  { value: 'Poppins, Arial, sans-serif', label: 'Poppins' },
  { value: 'Merriweather, Georgia, serif', label: 'Merriweather' },
  { value: 'Playfair Display, Georgia, serif', label: 'Playfair Display' },
];

let activeRichTextApi = null;

// ─────────────────────────────────────────────────────────────────
// Default props per block type
// ─────────────────────────────────────────────────────────────────

const DEFAULT_EMAIL_SETTINGS = {
  preheaderText: "",
  outerBgColor: "#dbe3ea",
  outerBgImageSrc: "",
  outerBgRepeat: "no-repeat",
  canvasBgColor: "#ffffff",
  canvasWidth: 600,
  canvasRadius: 16,
};

function normalizeEmailSettings(raw = {}) {
  return {
    ...DEFAULT_EMAIL_SETTINGS,
    ...raw,
    canvasWidth: clamp(raw?.canvasWidth ?? DEFAULT_EMAIL_SETTINGS.canvasWidth, 420, 900),
    canvasRadius: clamp(raw?.canvasRadius ?? DEFAULT_EMAIL_SETTINGS.canvasRadius, 0, 32),
  };
}

export function extractEmailSettings(blocks = []) {
  const meta = (Array.isArray(blocks) ? blocks : []).find((b) => b?.type === "__emailSettings");
  return normalizeEmailSettings(meta?.props || {});
}

function stripEmailMetaBlocks(blocks = []) {
  return (Array.isArray(blocks) ? blocks : []).filter((b) => b?.type !== "__emailSettings");
}

function packBlocksForSave(blocks = [], emailSettings = {}) {
  return [
    { id: uid(), type: "__emailSettings", props: normalizeEmailSettings(emailSettings) },
    ...stripEmailMetaBlocks(blocks),
  ];
}

const DEFAULTS = {
  header: {
    logoSrc: "", title: "Your Email Title", subtitle: "Subtitle or tagline here",
    bgColor: "#1d4ed8", textColor: "#ffffff", bgImageSrc: "", bgRepeat: "no-repeat",
    titleColor: "#ffffff", subtitleColor: "#dbeafe", titleSize: 28, subtitleSize: 16,
    logoWidthPct: 28, logoHeightPx: 84,
  },
  text: {
    html: "<p>Your text goes here.</p>",
    bgColor: "#ffffff", textColor: "#1e293b", fontSize: 20, align: "left", variant: "body", fontFamily: "Arial, Helvetica, sans-serif", bgImageSrc: "", bgRepeat: "no-repeat",
  },
  image: {
    src: "", alt: "Image", linkHref: "", align: "center", widthPct: 100, borderRadius: 0,
    bgColor: "transparent", fitMode: "cover",
    imageX: 50, imageY: 50,
    heightPx: 220, overlayEnabled: true, overlayTitle: "Click to edit headline", overlayText: "Click to edit supporting text", overlayPosition: "center", overlayBgColor: "rgba(15,23,42,0.38)", textColor: "#ffffff", overlayX: 50, overlayY: 50,
    overlayTitleColor: "#ffffff", overlayTextColor: "#f8fafc", overlayTitleSize: 24, overlayTextSize: 14,
    overlayImageSrc: "", overlayImageX: 50, overlayImageY: 22, overlayImageWidthPct: 24, overlayImageHeightPx: 72, overlayImageRadius: 8,
  },
  button: {
    text: "Click Here", href: "#",
    bgColor: "#2563eb", textColor: "#ffffff", borderRadius: 8, align: "center",
    blockBgColor: "transparent",
    widthMode: "auto", widthPx: 200, paddingY: 12,
  },
  divider: { color: "#e2e8f0", thickness: 1, style: "solid", widthPct: 100 },
  spacer: { height: 36, bgColor: "transparent" },
  hero: {
    imageSrc: "", headline: "Your Big Headline",
    subtext: "Supporting text that explains the value proposition.",
    ctaText: "Get Started", ctaHref: "#",
    bgColor: "#0f172a", textColor: "#ffffff", bgImageSrc: "", bgRepeat: "no-repeat",
    ctaBgColor: "#2563eb", ctaTextColor: "#ffffff",
    imageWidthPct: 100, imageHeightPx: 220, imageX: 50, imageY: 50,
    headlineColor: "#ffffff", subtextColor: "#e5e7eb", headlineSize: 30, subtextSize: 15,
    paddingY: 36,
  },
  imageText: {
    imageSrc: "",
    headline: "Text over your image",
    subtext: "Add a headline and supporting copy directly on top of the image.",
    buttonText: "Learn More",
    href: "#",
    textColor: "#ffffff",
    headlineColor: "#ffffff",
    subtextColor: "#e5e7eb",
    headlineSize: 30,
    subtextSize: 15,
    buttonBgColor: "#2563eb",
    buttonTextColor: "#ffffff",
    overlayShade: "rgba(15,23,42,0.45)",
    overlayImageSrc: "",
    overlayImageX: 50,
    overlayImageY: 18,
    overlayImageWidthPct: 24,
    overlayImageHeightPx: 72,
    overlayImageRadius: 8,
    headlineX: 50,
    headlineY: 28,
    headlineBoxWidthPct: 78,
    headlineBoxHeightPx: 84,
    subtextX: 50,
    subtextY: 56,
    subtextBoxWidthPct: 84,
    subtextBoxHeightPx: 92,
    buttonX: 50,
    buttonY: 78,
    buttonBoxWidthPct: 36,
    buttonBoxHeightPx: 84,
    align: "center",
    height: 320,
  },
  quote: {
    avatarSrc: "",
    quote: "This is a powerful testimonial from a happy client.",
    author: "Client Name",
    role: "Company or Role",
    bgColor: "#eff6ff",
    textColor: "#0f172a",
  },
  promo: {
    badge: "Limited Offer",
    headline: "Special promotion for your clients",
    details: "Add urgency, discount details, or a quick benefit statement here.",
    code: "SAVE20",
    buttonText: "Claim Offer",
    href: "#",
    bgColor: "#111827",
    accentColor: "#f59e0b",
    textColor: "#ffffff",
  },
  video: {
    thumbnailSrc: "",
    title: "Watch our latest video",
    caption: "Use this block to send people to a webinar, product demo, or case study video.",
    buttonText: "Watch Now",
    href: "#",
    bgColor: "#0f172a",
    textColor: "#ffffff",
  },
  contact: {
    heading: "Need help?",
    name: "Your Name",
    role: "Customer Success",
    email: "hello@example.com",
    phone: "+1 (555) 123-4567",
    address: "123 Business Street, City",
    buttonText: "Book a Call",
    href: "#",
    bgColor: "#f8fafc",
    textColor: "#0f172a",
  },
  grid: {
    bgColor: "#ffffff",
    sectionHeadline: "",
    sectionSubtext: "",
    columnsPerRow: 2,
    columns: [
      { imageSrc: "", title: "Card One", text: "Description text goes here.", linkHref: "", bgColor: "#ffffff", imageWidthPct: 100, imageHeightPx: 160, overlayEnabled: false, overlayBgColor: "rgba(15,23,42,0.38)", overlayX: 50, overlayY: 50 },
      { imageSrc: "", title: "Card Two", text: "Description text goes here.", linkHref: "", bgColor: "#ffffff", imageWidthPct: 100, imageHeightPx: 160, overlayEnabled: false, overlayBgColor: "rgba(15,23,42,0.38)", overlayX: 50, overlayY: 50 },
    ],
  },
  list: {
    bgColor: "#ffffff",
    sectionHeadline: "",
    sectionSubtext: "",
    itemsPerRow: 1,
    items: [
      { imageSrc: "", title: "Item One", text: "Description here.", linkHref: "", bgColor: "#ffffff", imageWidthPct: 100, imageHeightPx: 110, overlayEnabled: false, overlayBgColor: "rgba(15,23,42,0.38)", overlayX: 50, overlayY: 50 },
      { imageSrc: "", title: "Item Two", text: "Description here.", linkHref: "", bgColor: "#ffffff", imageWidthPct: 100, imageHeightPx: 110, overlayEnabled: false, overlayBgColor: "rgba(15,23,42,0.38)", overlayX: 50, overlayY: 50 },
    ],
  },
  gridCard: {
    groupId: "",
    sectionBgColor: "#ffffff",
    sectionHeadline: "",
    sectionSubtext: "",
    perRow: 2,
    bgColor: "#ffffff",
    imageSrc: "",
    imageWidthPct: 100,
    imageHeightPx: 160,
    overlayEnabled: false,
    overlayBgColor: "rgba(15,23,42,0.38)",
    overlayX: 50,
    overlayY: 50,
    title: "Card Title",
    text: "Description text goes here.",
    linkHref: "",
  },
  listCard: {
    groupId: "",
    sectionBgColor: "#ffffff",
    sectionHeadline: "",
    sectionSubtext: "",
    perRow: 1,
    bgColor: "#ffffff",
    imageSrc: "",
    imageWidthPct: 100,
    imageHeightPx: 110,
    overlayEnabled: false,
    overlayBgColor: "rgba(15,23,42,0.38)",
    overlayX: 50,
    overlayY: 50,
    title: "List Item",
    text: "Description here.",
    linkHref: "",
  },
  social: {
    bgColor: "#eff6ff",
    platforms: [
      { name: "facebook",  href: "https://facebook.com/" },
      { name: "instagram", href: "https://instagram.com/" },
      { name: "linkedin",  href: "https://linkedin.com/" },
      { name: "x",        href: "https://x.com/" },
      { name: "youtube",  href: "https://youtube.com/" },
    ],
  },
  footer: {
    company: "Your Company", address: "123 Street, City, Country",
    unsubscribeHref: "#", unsubscribeText: "Unsubscribe", bgColor: "#f1f5f9", textColor: "#64748b",
  },
};

function makeBlock(type) {
  return { id: uid(), type, props: withNormalizedBlockProps(type) };
}

function isCardBlockType(type) {
  return type === "gridCard" || type === "listCard";
}

function makeGroupedCardBlocks(type) {
  const groupId = uid();
  const count = type === "gridCard" ? 2 : 2;
  return Array.from({ length: count }, (_, idx) => ({
    id: uid(),
    type,
    props: {
      ...withNormalizedBlockProps(type),
      groupId,
      title: type === "gridCard" ? `Card ${idx + 1}` : `Item ${idx + 1}`,
    },
  }));
}

function normalizeBlocksForEditor(blocks = []) {
  const next = [];

  for (const rawBlock of Array.isArray(blocks) ? blocks : []) {
    if (!rawBlock?.type) continue;

    if (rawBlock.type === "grid") {
      const groupId = uid();
      const sectionBgColor = rawBlock.props?.bgColor || "#ffffff";
      const perRow = clamp(rawBlock.props?.columnsPerRow || (rawBlock.props?.columns?.length || 2), 1, 4);
      const columns = Array.isArray(rawBlock.props?.columns) && rawBlock.props.columns.length
        ? rawBlock.props.columns
        : [deepClone(DEFAULTS.gridCard), deepClone(DEFAULTS.gridCard)];

      columns.forEach((col, idx) => {
        next.push({
          id: uid(),
          type: "gridCard",
          props: {
            ...withNormalizedBlockProps("gridCard"),
            groupId,
            sectionBgColor,
            sectionHeadline: rawBlock.props?.sectionHeadline || "",
            sectionSubtext: rawBlock.props?.sectionSubtext || "",
            perRow,
            blockRadius: resolveBlockRadius(col, defaultBlockRadius("gridCard")),
            imageSrc: col.imageSrc || "",
            title: col.title || `Card ${idx + 1}`,
            text: col.text || "Description text goes here.",
            linkHref: col.linkHref || "",
            bgColor: col.bgColor || "#ffffff",
            imageWidthPct: clamp(col.imageWidthPct || 100, 20, 100),
            imageHeightPx: clamp(col.imageHeightPx || 160, 60, 420),
            overlayEnabled: Boolean(col.overlayEnabled),
            overlayBgColor: col.overlayBgColor || "rgba(15,23,42,0.38)",
            overlayX: clamp(col.overlayX || 50, 0, 100),
            overlayY: clamp(col.overlayY || 50, 0, 100),
          },
        });
      });
      continue;
    }

    if (rawBlock.type === "list") {
      const groupId = uid();
      const sectionBgColor = rawBlock.props?.bgColor || "#ffffff";
      const perRow = clamp(rawBlock.props?.itemsPerRow || 1, 1, 4);
      const items = Array.isArray(rawBlock.props?.items) && rawBlock.props.items.length
        ? rawBlock.props.items
        : [deepClone(DEFAULTS.listCard), deepClone(DEFAULTS.listCard)];

      items.forEach((item, idx) => {
        next.push({
          id: uid(),
          type: "listCard",
          props: {
            ...withNormalizedBlockProps("listCard"),
            groupId,
            sectionBgColor,
            sectionHeadline: rawBlock.props?.sectionHeadline || "",
            sectionSubtext: rawBlock.props?.sectionSubtext || "",
            perRow,
            blockRadius: resolveBlockRadius(item, defaultBlockRadius("listCard")),
            imageSrc: item.imageSrc || "",
            title: item.title || `Item ${idx + 1}`,
            text: item.text || "Description here.",
            linkHref: item.linkHref || "",
            bgColor: item.bgColor || "#ffffff",
            imageWidthPct: clamp(item.imageWidthPct || 100, 20, 100),
            imageHeightPx: clamp(item.imageHeightPx || 110, 60, 420),
            overlayEnabled: Boolean(item.overlayEnabled),
            overlayBgColor: item.overlayBgColor || "rgba(15,23,42,0.38)",
            overlayX: clamp(item.overlayX || 50, 0, 100),
            overlayY: clamp(item.overlayY || 50, 0, 100),
          },
        });
      });
      continue;
    }

    if (rawBlock.type === "gridCard" || rawBlock.type === "listCard") {
      next.push({
        ...rawBlock,
        props: {
          ...deepClone(DEFAULTS[rawBlock.type] || {}),
          ...rawBlock.props,
          groupId: rawBlock.props?.groupId || uid(),
          sectionBgColor: rawBlock.props?.sectionBgColor || "#ffffff",
          sectionHeadline: rawBlock.props?.sectionHeadline || "",
          sectionSubtext: rawBlock.props?.sectionSubtext || "",
          perRow: clamp(rawBlock.props?.perRow || (rawBlock.type === "gridCard" ? 2 : 1), 1, 4),
          imageWidthPct: clamp(rawBlock.props?.imageWidthPct || 100, 20, 100),
          imageHeightPx: clamp(rawBlock.props?.imageHeightPx || (rawBlock.type === "gridCard" ? 160 : 110), 60, 420),
          overlayEnabled: Boolean(rawBlock.props?.overlayEnabled),
          overlayBgColor: rawBlock.props?.overlayBgColor || "rgba(15,23,42,0.38)",
          overlayX: clamp(rawBlock.props?.overlayX || 50, 0, 100),
          overlayY: clamp(rawBlock.props?.overlayY || 50, 0, 100),
        },
      });
      continue;
    }

    next.push({
      ...rawBlock,
      props: {
        ...deepClone(DEFAULTS[rawBlock.type] || {}),
        ...rawBlock.props,
      },
    });
  }

  return next;
}

function collapseBlocksForExport(blocks = []) {
  const normalized = normalizeBlocksForEditor(blocks);
  const next = [];

  for (let i = 0; i < normalized.length; i += 1) {
    const block = normalized[i];

    if (block?.type === "gridCard" && block?.props?.groupId) {
      const group = [block];
      while (
        i + 1 < normalized.length &&
        normalized[i + 1]?.type === "gridCard" &&
        normalized[i + 1]?.props?.groupId === block.props.groupId
      ) {
        group.push(normalized[i + 1]);
        i += 1;
      }

      next.push({
        id: uid(),
        type: "grid",
        props: {
          bgColor: block.props.sectionBgColor || "#ffffff",
          sectionHeadline: block.props.sectionHeadline || "",
          sectionSubtext: block.props.sectionSubtext || "",
          columnsPerRow: block.props.perRow || 2,
          columns: group.map((entry) => ({
            imageSrc: entry.props.imageSrc || "",
            title: entry.props.title || "Card",
            text: entry.props.text || "",
            linkHref: entry.props.linkHref || "",
            bgColor: entry.props.bgColor || "#ffffff",
            imageWidthPct: entry.props.imageWidthPct || 100,
            imageHeightPx: entry.props.imageHeightPx || 160,
            overlayEnabled: Boolean(entry.props.overlayEnabled),
            overlayBgColor: entry.props.overlayBgColor || "rgba(15,23,42,0.38)",
            overlayX: entry.props.overlayX || 50,
            overlayY: entry.props.overlayY || 50,
          })),
        },
      });
      continue;
    }

    if (block?.type === "listCard" && block?.props?.groupId) {
      const group = [block];
      while (
        i + 1 < normalized.length &&
        normalized[i + 1]?.type === "listCard" &&
        normalized[i + 1]?.props?.groupId === block.props.groupId
      ) {
        group.push(normalized[i + 1]);
        i += 1;
      }

      next.push({
        id: uid(),
        type: "list",
        props: {
          bgColor: block.props.sectionBgColor || "#ffffff",
          sectionHeadline: block.props.sectionHeadline || "",
          sectionSubtext: block.props.sectionSubtext || "",
          itemsPerRow: block.props.perRow || 1,
          items: group.map((entry) => ({
            imageSrc: entry.props.imageSrc || "",
            title: entry.props.title || "Item",
            text: entry.props.text || "",
            linkHref: entry.props.linkHref || "",
            bgColor: entry.props.bgColor || "#ffffff",
            imageWidthPct: entry.props.imageWidthPct || 100,
            imageHeightPx: entry.props.imageHeightPx || 110,
            overlayEnabled: Boolean(entry.props.overlayEnabled),
            overlayBgColor: entry.props.overlayBgColor || "rgba(15,23,42,0.38)",
            overlayX: entry.props.overlayX || 50,
            overlayY: entry.props.overlayY || 50,
          })),
        },
      });
      continue;
    }

    next.push({
      ...block,
      props: withNormalizedBlockProps(block.type, block.props || {}),
    });
  }

  return next;
}

function renderBlockRowsForExport(blocks = [], emailWidth = 600) {
  const normalized = Array.isArray(blocks) ? blocks : [];
  const gapPx = 16;

  return normalized
    .map((block, index) => {
      const isLast = index === normalized.length - 1;
      const bottomPad = block?.type === "spacer" || isLast ? 0 : gapPx;
      const radius = resolveBlockRadius(block?.props || {}, defaultBlockRadius(block?.type));
      const blockHtml = radius > 0 && block?.type !== "divider" && block?.type !== "spacer"
        ? wrapEmailBlockTable(
            `<tr><td style="border-radius:${radius}px;overflow:hidden;">${blockToHtml(block, emailWidth)}</td></tr>`,
            emailWidth
          )
        : blockToHtml(block, emailWidth);
      return `<tr><td align="center" style="padding:0 0 ${bottomPad}px;">${blockHtml}</td></tr>`;
    })
    .join("\n");
}

function wrapEmailBlockTable(innerHtml, width) {
  const safeWidth = Number(width || 600);
  return `<!--[if mso]>
<table role="presentation" width="${safeWidth}" cellpadding="0" cellspacing="0" border="0" align="center" style="width:${safeWidth}px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td>
<![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="width:100%;max-width:${safeWidth}px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
${innerHtml}
</table>
<!--[if mso]></td></tr></table><![endif]-->`;
}

function renderEmailBackgroundTable({
  width,
  bgColor,
  bgImageSrc,
  bgRepeat = "no-repeat",
  borderRadius = 0,
  fixedHeightPx = 0,
  msoInset = "0,0,0,0",
  tdStyle = "",
  innerHtml = "",
}) {
  const safeWidth = Number(width || 600);
  const safeHeight = Math.max(0, Number(fixedHeightPx || 0));
  const safeBgColor = esc(bgColor || "#ffffff");
  const safeImage = esc(bgImageSrc || "");
  const safeRepeat = esc(bgRepeat || "no-repeat");
  const safeMsoInset = esc(msoInset || "0,0,0,0");
  const webBgStyle = bgImageSrc
    ? `background-color:${safeBgColor};background-image:url(${safeImage});background-size:${bgRepeat === "no-repeat" ? "cover" : "auto"};background-position:center;background-repeat:${safeRepeat};`
    : `background-color:${safeBgColor};`;
  const vmlFillAttrs = bgRepeat === "no-repeat"
    ? `type="frame" aspect="atleast" focusposition="0.5,0.5"`
    : `type="tile"`;
  const vmlOpen = bgImageSrc
    ? `<!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:${safeWidth}px;${safeHeight ? `height:${safeHeight}px;` : ""}"><v:fill ${vmlFillAttrs} src="${safeImage}" color="${safeBgColor}" /><v:textbox inset="${safeMsoInset}" style="${safeHeight ? "mso-fit-shape-to-text:false;v-text-anchor:top;" : "mso-fit-shape-to-text:true;v-text-anchor:top;"}"><div><![endif]-->`
    : "";
  const vmlClose = bgImageSrc ? "<!--[if gte mso 9]></div></v:textbox></v:rect><![endif]-->" : "";

  return wrapEmailBlockTable(
    `<tr><td style="${webBgStyle}${tdStyle}border-radius:${Number(borderRadius || 0)}px;">${vmlOpen}${innerHtml}${vmlClose}</td></tr>`,
    safeWidth
  );
}

// ─────────────────────────────────────────────────────────────────
// HTML Export
// ─────────────────────────────────────────────────────────────────

function blockToHtml(block, emailWidth = 600) {
  const { type, props: p } = block;
  const W = emailWidth;

  switch (type) {
    case "header": {
      const logoSrc = toEmailAssetUrl(p.logoSrc);
      const exportLogoHeight = Math.min(Number(p.logoHeightPx || 84), 52);
      const exportLogoWidth = Math.min(160, Math.max(96, Math.round((Math.min(Number(p.logoWidthPct || 28), 26) / 100) * W)));
      const logo = logoSrc
        ? `<tr><td style="padding:18px 24px 8px;text-align:center;">
            <img src="${esc(logoSrc)}" alt="Logo" width="${exportLogoWidth}" style="width:${exportLogoWidth}px;max-width:100%;height:${exportLogoHeight}px;object-fit:contain;display:block;margin:0 auto;" />
           </td></tr>`
        : "";
      const pt = logoSrc ? "8px" : "20px";
      return renderEmailBackgroundTable({
        width: W,
        bgColor: p.bgColor,
        bgImageSrc: toEmailAssetUrl(p.bgImageSrc),
        bgRepeat: p.bgRepeat,
        borderRadius: 8,
        tdStyle: "padding:0;text-align:center;",
        innerHtml: `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;border-collapse:collapse;">
    ${logo}<tr><td style="padding:${pt} 24px 28px;text-align:center;">
  <h1 style="margin:0 0 8px;font-size:${Number(p.titleSize || 28)}px;font-weight:700;font-family:Arial,Helvetica,sans-serif;color:${esc(ensureReadableColor(p.titleColor || p.textColor, p.bgColor || "#1d4ed8", "#ffffff", "#0f172a"))};line-height:1.15;text-shadow:0 2px 8px rgba(15,23,42,0.22);">${rich(p.title)}</h1>
  <p style="margin:0;font-size:${Number(p.subtitleSize || 16)}px;font-family:Arial,Helvetica,sans-serif;color:${esc(ensureReadableColor(p.subtitleColor || p.textColor, p.bgColor || "#1d4ed8", "#dbeafe", "#334155"))};opacity:0.96;line-height:1.55;">${rich(p.subtitle)}</p>
    </td></tr></table>`,
      });
    }

    case "text":
      const textColor = ensureReadableColor(p.textColor || "#1e293b", p.bgColor || "#ffffff", "#ffffff", "#0f172a");
      const htmlWithStyledLinks = withDefaultAnchorStyles(p.html || "", { color: textColor, textDecoration: "inherit" });
      return renderEmailBackgroundTable({
        width: W,
        bgColor: p.bgColor,
        bgImageSrc: toEmailAssetUrl(p.bgImageSrc),
        bgRepeat: p.bgRepeat,
        tdStyle: "padding:16px 24px;",
        innerHtml: `
  <div style="width:${clamp(Number(p.widthPct || 100), 20, 100)}%;max-width:100%;min-height:${Number(p.boxHeightPx || 120)}px;margin:0 auto;font-family:${esc(p.fontFamily || "Arial, Helvetica, sans-serif")};font-size:${p.fontSize || 18}px;color:${esc(textColor)};text-align:${p.align || "left"};box-sizing:border-box;">${htmlWithStyledLinks}</div>
`,
      });

    case "image": {
      const imageSrc = toEmailAssetUrl(p.src);
      const overlayImageSrc = toEmailAssetUrl(p.overlayImageSrc);
      const imageWidthPx = pixelWidthFromPercent(W, p.widthPct || 100, 32);
      const imageHeightPx = clamp(Number(p.heightPx || 220), 60, 900);
      const overlayTitleColor = ensureReadableColor(p.overlayTitleColor || p.textColor, p.overlayBgColor || "rgba(15,23,42,0.38)", "#ffffff", "#0f172a");
      const overlayTextColor = ensureReadableColor(p.overlayTextColor || p.textColor, p.overlayBgColor || "rgba(15,23,42,0.38)", "#f8fafc", "#334155");
      if (imageSrc && p.overlayEnabled) {
        const contentAlign = Number(p.overlayX ?? 50) <= 38 ? "left" : Number(p.overlayX ?? 50) >= 62 ? "right" : "center";
        const tableAlignAttr = (align) => (align === "right" ? "right" : align === "left" ? "left" : "center");
        const overlayImageWidth = Math.min(180, Math.max(56, Math.round((Number(p.overlayImageWidthPct || 24) / 100) * Math.max(220, imageWidthPx - 48))));
        const topSpacer = Math.max(14, Math.round(imageHeightPx * 0.14));
        const contentWidth = Math.max(220, Math.min(imageWidthPx - 48, Math.round((imageWidthPx - 48) * 0.82)));
        const overlayImageHtml = overlayImageSrc
          ? `<tr><td align="${tableAlignAttr(contentAlign)}" style="padding:0 0 18px;text-align:${contentAlign};"><img src="${esc(overlayImageSrc)}" alt="" width="${overlayImageWidth}" height="${Number(p.overlayImageHeightPx || 72)}" style="width:${overlayImageWidth}px;max-width:100%;height:${Number(p.overlayImageHeightPx || 72)}px;object-fit:contain;display:block;margin:${contentAlign === "left" ? "0 auto 0 0" : contentAlign === "right" ? "0 0 0 auto" : "0 auto"};border-radius:${Number(p.overlayImageRadius || 8)}px;" /></td></tr>`
          : "";
        const titleHtml = String(p.overlayTitle || "").trim()
          ? `<tr><td align="${tableAlignAttr(contentAlign)}" style="padding:0 0 ${String(p.overlayText || "").trim() ? 10 : 0}px;text-align:${contentAlign};"><div style="font-size:${Number(p.overlayTitleSize || 24)}px;font-weight:800;line-height:1.15;color:${esc(overlayTitleColor)};text-shadow:0 2px 8px rgba(15,23,42,0.4);">${rich(p.overlayTitle || "")}</div></td></tr>`
          : "";
        const textHtml = String(p.overlayText || "").trim()
          ? `<tr><td align="${tableAlignAttr(contentAlign)}" style="padding:0;text-align:${contentAlign};"><div style="font-size:${Number(p.overlayTextSize || 14)}px;font-weight:600;line-height:1.5;color:${esc(overlayTextColor)};text-shadow:0 2px 8px rgba(15,23,42,0.35);">${rich(p.overlayText || "")}</div></td></tr>`
          : "";
        const innerHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;height:${imageHeightPx}px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
  <tr>
    <td valign="middle" style="padding:24px;background:${esc(p.overlayBgColor || "rgba(15,23,42,0.38)")};vertical-align:middle;">
      <table role="presentation" width="${contentWidth}" cellpadding="0" cellspacing="0" border="0" align="${tableAlignAttr(contentAlign)}" style="width:${contentWidth}px;max-width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr><td height="${topSpacer}" style="height:${topSpacer}px;font-size:0;line-height:0;">&nbsp;</td></tr>
        ${overlayImageHtml}
        ${titleHtml}
        ${textHtml}
      </table>
    </td>
  </tr>
</table>`;
        const blockHtml = renderEmailBackgroundTable({
          width: imageWidthPx,
          bgColor: p.bgColor || "#0f172a",
          bgImageSrc: imageSrc,
          bgRepeat: "no-repeat",
          borderRadius: p.borderRadius || 0,
          fixedHeightPx: imageHeightPx,
          msoInset: "0,0,0,0",
          tdStyle: `padding:0;background-color:transparent;color:${esc(p.textColor || "#ffffff")};font-family:Arial,Helvetica,sans-serif;`,
          innerHtml,
        });
        const linkedBlock = p.linkHref ? `<a href="${esc(p.linkHref)}" style="display:block;text-decoration:none;">${blockHtml}</a>` : blockHtml;
        return wrapEmailBlockTable(`<tr><td style="padding:12px 16px;text-align:${p.align || "center"};">${linkedBlock}</td></tr>`, W);
      }

      const imgTag = imageSrc
        ? `<img src="${esc(imageSrc)}" alt="${esc(p.alt)}" width="${imageWidthPx}" height="${imageHeightPx}" style="width:${imageWidthPx}px;max-width:100%;height:${imageHeightPx}px;object-fit:${esc(p.fitMode || "cover")};object-position:${Number(p.imageX ?? 50)}% ${Number(p.imageY ?? 50)}%;display:block;margin:0 auto;border-radius:${p.borderRadius || 0}px;" />`
        : "";
      const wrapped = `<div style="position:relative;display:block;width:${imageWidthPx}px;max-width:100%;margin:0 auto;">${imgTag}</div>`;
      const inner = p.linkHref
        ? `<a href="${esc(p.linkHref)}" style="display:block;text-align:${p.align || "center"};">${wrapped}</a>`
        : `<div style="text-align:${p.align || "center"};">${wrapped}</div>`;
      const imageBlockBg = p.bgColor || "transparent";
      return wrapEmailBlockTable(
        `<tr><td style="padding:12px 16px;background:${esc(imageBlockBg)};">${inner}</td></tr>`,
        W
      );
    }

    case "button":
      const buttonTextColor = resolvePreferredColor(p.textColor || "#ffffff", p.bgColor || "#2563eb", "#ffffff", "#0f172a");
      return wrapEmailBlockTable(
        `<tr><td style="padding:16px 24px;text-align:${p.align || "center"};background:${esc(p.blockBgColor || "transparent")};">
  <a href="${esc(p.href)}" style="display:inline-block;padding:12px 28px;background-color:${esc(p.bgColor || "#2563eb")};color:${esc(buttonTextColor)};text-decoration:none;border-radius:${p.borderRadius || 8}px;font-size:15px;font-weight:600;font-family:Arial,Helvetica,sans-serif;">${rich(p.text || "Button")}</a>
</td></tr>`,
        W
      );

    case "divider": {
      const side = Math.round((100 - (p.widthPct || 100)) / 2);
      return wrapEmailBlockTable(
        `<tr><td style="padding:8px ${side}%;"><hr style="border:0;border-top:${p.thickness || 1}px ${p.style || "solid"} ${esc(p.color)};margin:0;" /></td></tr>`,
        W
      );
    }

    case "hero": {
      const heroImageWidthPx = pixelWidthFromPercent(W, p.imageWidthPct || 100, 56);
      const heroImageSrc = toEmailAssetUrl(p.imageSrc);
      const img = heroImageSrc
        ? `<img src="${esc(heroImageSrc)}" alt="Hero" width="${heroImageWidthPx}" style="width:${heroImageWidthPx}px;max-width:100%;height:${Number(p.imageHeightPx || 220)}px;object-fit:cover;object-position:${Number(p.imageX ?? 50)}% ${Number(p.imageY ?? 50)}%;display:block;border-radius:8px;margin:0 auto 20px;" />`
        : "";
      const py = p.paddingY ?? 36;
      const ctaTextColor = resolvePreferredColor(p.ctaTextColor || "#ffffff", p.ctaBgColor || "#2563eb", "#ffffff", "#0f172a");
      return renderEmailBackgroundTable({
        width: W,
        bgColor: p.bgColor,
        bgImageSrc: toEmailAssetUrl(p.bgImageSrc),
        bgRepeat: p.bgRepeat,
        borderRadius: 12,
        fixedHeightPx: Number(p.height || 320),
        tdStyle: `padding:${py}px 28px;text-align:center;`,
        innerHtml: `${img}
  <h2 style="margin:0 0 12px;font-size:${Number(p.headlineSize || 30)}px;font-weight:700;font-family:Arial,Helvetica,sans-serif;color:${esc(ensureReadableColor(p.headlineColor || p.textColor, p.bgColor || "#0f172a", "#ffffff", "#0f172a"))};line-height:1.15;text-shadow:0 2px 8px rgba(15,23,42,0.28);">${rich(p.headline)}</h2>
  <p style="margin:0 0 24px;font-size:${Number(p.subtextSize || 15)}px;font-family:Arial,Helvetica,sans-serif;color:${esc(ensureReadableColor(p.subtextColor || p.textColor, p.bgColor || "#0f172a", "#e5e7eb", "#334155"))};opacity:0.96;line-height:1.55;">${rich(p.subtext)}</p>
  <a href="${esc(p.ctaHref)}" style="display:inline-block;padding:12px 28px;background-color:${esc(p.ctaBgColor)};color:${esc(ctaTextColor)};text-decoration:none;border-radius:999px;font-size:15px;font-weight:600;font-family:Arial,Helvetica,sans-serif;">${rich(p.ctaText)}</a>
    `,
      });
    }

    case "grid": {
      const perRow = clamp(p.columnsPerRow || 2, 1, 4);
      const width = `${Math.floor(100 / perRow)}%`;
      const cardWidthPx = Math.max(120, Math.floor((W - perRow * 16) / perRow));
      const uniformGridImageHeightPx = clamp(
        Math.max(...(Array.isArray(p.columns) && p.columns.length
          ? p.columns.map((col) => Number(col?.imageHeightPx || 160))
          : [160])),
        60,
        420
      );
      const sectionTitleColor = ensureReadableColor("", p.bgColor || "#ffffff", "#ffffff", "#0f172a");
      const sectionSubtextColor = ensureReadableColor("", p.bgColor || "#ffffff", "#e5e7eb", "#475569");
      const intro = (p.sectionHeadline || p.sectionSubtext)
        ? `<tr><td colspan="${perRow}" style="padding:20px 18px 6px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
            ${p.sectionHeadline ? `<div style="font-size:24px;font-weight:800;line-height:1.2;color:${esc(sectionTitleColor)};margin-bottom:${p.sectionSubtext ? 6 : 0}px;">${rich(p.sectionHeadline)}</div>` : ""}
            ${p.sectionSubtext ? `<div style="font-size:14px;font-weight:600;line-height:1.5;color:${esc(sectionSubtextColor)};">${rich(p.sectionSubtext)}</div>` : ""}
          </td></tr>`
        : "";
      const rows = chunkItems(p.columns || [], perRow).map((row) => {
        const cells = row.map((col) => {
          const cardTitleColor = ensureReadableColor("", col.bgColor || "#ffffff", "#ffffff", "#1e293b");
          const cardTextColor = ensureReadableColor("", col.bgColor || "#ffffff", "#e5e7eb", "#475569");
          const overlayTextColor = ensureReadableColor("", col.overlayBgColor || "rgba(15,23,42,0.38)", "#ffffff", "#0f172a");
          const overlay = col.overlayEnabled
            ? `<div style="position:absolute;inset:0;border-radius:8px;overflow:hidden;">
                <div style="position:absolute;inset:0;background:${esc(col.overlayBgColor || "rgba(15,23,42,0.38)")};"></div>
                <div style="position:absolute;left:${Number(col.overlayX || 50)}%;top:${Number(col.overlayY || 50)}%;transform:translate(-50%,-50%);width:84%;text-align:center;color:${esc(overlayTextColor)};font-family:Arial,Helvetica,sans-serif;">
                  <div style="font-size:18px;font-weight:800;line-height:1.2;margin-bottom:${col.text ? 6 : 0}px;">${rich(col.title)}</div>
                  <div style="font-size:13px;font-weight:600;line-height:1.5;">${rich(col.text)}</div>
                </div>
              </div>`
            : "";
          const colImageSrc = toEmailAssetUrl(col.imageSrc);
          const gridImageWidthPx = Math.max(96, cardWidthPx - 24);
          const img = colImageSrc
            ? `<div style="position:relative;width:${gridImageWidthPx}px;max-width:100%;margin:0 auto 10px;"><img src="${esc(colImageSrc)}" alt="${esc(col.title)}" width="${gridImageWidthPx}" height="${uniformGridImageHeightPx}" style="width:${gridImageWidthPx}px;max-width:100%;height:${uniformGridImageHeightPx}px;object-fit:cover;display:block;border-radius:8px;" />${overlay}</div>`
            : "";
          const body = col.overlayEnabled ? "" : `<h3 style="margin:0 0 6px;font-size:16px;font-weight:600;font-family:Arial,Helvetica,sans-serif;color:${esc(cardTitleColor)};">${rich(col.title)}</h3><p style="margin:0;font-size:14px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;color:${esc(cardTextColor)};">${rich(col.text)}</p>`;
          return `<td style="width:${width};vertical-align:top;padding:8px;" valign="top"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${esc(col.bgColor || "#ffffff")};border-collapse:separate;border-spacing:0;border-radius:12px;"><tr><td style="padding:12px;border-radius:12px;overflow:hidden;">${img}${body}</td></tr></table></td>`;
        });
        return `<tr>${cells.join("")}</tr>`;
      });
      return wrapEmailBlockTable(
        `${intro}${rows.join("")}`,
        W
      ).replace('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="width:100%;max-width:' + W + 'px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="width:100%;max-width:${W}px;background-color:${esc(p.bgColor || "#ffffff")};border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">`);
    }

    case "list": {
      const perRow = clamp(p.itemsPerRow || 1, 1, 4);
      const width = `${Math.floor(100 / perRow)}%`;
      const listCardWidthPx = Math.max(140, Math.floor((W - perRow * 16) / perRow));
      const sectionTitleColor = ensureReadableColor("", p.bgColor || "#ffffff", "#ffffff", "#0f172a");
      const sectionSubtextColor = ensureReadableColor("", p.bgColor || "#ffffff", "#e5e7eb", "#475569");
      const intro = (p.sectionHeadline || p.sectionSubtext)
        ? `<tr><td colspan="${perRow}" style="padding:20px 18px 6px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
            ${p.sectionHeadline ? `<div style="font-size:24px;font-weight:800;line-height:1.2;color:${esc(sectionTitleColor)};margin-bottom:${p.sectionSubtext ? 6 : 0}px;">${rich(p.sectionHeadline)}</div>` : ""}
            ${p.sectionSubtext ? `<div style="font-size:14px;font-weight:600;line-height:1.5;color:${esc(sectionSubtextColor)};">${rich(p.sectionSubtext)}</div>` : ""}
          </td></tr>`
        : "";
      const rows = chunkItems(p.items || [], perRow).map((row) => {
        const cells = row.map((item) => {
          const cardTitleColor = ensureReadableColor("", item.bgColor || "#ffffff", "#ffffff", "#1e293b");
          const cardTextColor = ensureReadableColor("", item.bgColor || "#ffffff", "#e5e7eb", "#475569");
          const overlayTextColor = ensureReadableColor("", item.overlayBgColor || "rgba(15,23,42,0.38)", "#ffffff", "#0f172a");
          const stackedListItem = perRow <= 1;
          const inlineImageWidthPx = Math.min(220, Number(item.imageHeightPx || 110));
          const overlay = item.overlayEnabled
            ? `<div style="position:absolute;inset:0;border-radius:8px;overflow:hidden;">
                <div style="position:absolute;inset:0;background:${esc(item.overlayBgColor || "rgba(15,23,42,0.38)")};"></div>
                <div style="position:absolute;left:${Number(item.overlayX || 50)}%;top:${Number(item.overlayY || 50)}%;transform:translate(-50%,-50%);width:84%;text-align:center;color:${esc(overlayTextColor)};font-family:Arial,Helvetica,sans-serif;">
                  <div style="font-size:18px;font-weight:800;line-height:1.2;margin-bottom:${item.text ? 6 : 0}px;">${rich(item.title)}</div>
                  <div style="font-size:13px;font-weight:600;line-height:1.5;">${rich(item.text)}</div>
                </div>
              </div>`
            : "";
          const itemImageSrc = toEmailAssetUrl(item.imageSrc);
          const img = itemImageSrc
            ? `<div style="position:relative;width:${stackedListItem ? inlineImageWidthPx : pixelWidthFromPercent(listCardWidthPx, item.imageWidthPct || 100)}px;max-width:100%;margin:${stackedListItem ? "0" : "0 auto 10px"};"><img src="${esc(itemImageSrc)}" alt="${esc(item.title)}" width="${stackedListItem ? inlineImageWidthPx : pixelWidthFromPercent(listCardWidthPx, item.imageWidthPct || 100)}" style="width:${stackedListItem ? inlineImageWidthPx : pixelWidthFromPercent(listCardWidthPx, item.imageWidthPct || 100)}px;max-width:100%;height:${item.imageHeightPx || 110}px;object-fit:cover;display:block;border-radius:8px;" />${overlay}</div>`
            : "";
          const body = item.overlayEnabled ? "" : `<h3 style="margin:0 0 6px;font-size:17px;font-weight:600;font-family:Arial,Helvetica,sans-serif;color:${esc(cardTitleColor)};">${rich(item.title)}</h3><p style="margin:0;font-size:14px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;color:${esc(cardTextColor)};">${rich(item.text)}</p>`;
          const content = stackedListItem
            ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>${img ? `<td style="width:${inlineImageWidthPx}px;vertical-align:top;padding-right:12px;" valign="top">${img}</td>` : ""}<td style="vertical-align:top;" valign="top">${body}</td></tr></table>`
            : `${img}${body}`;
          return `<td style="width:${width};vertical-align:top;padding:8px;" valign="top"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${esc(item.bgColor || "#ffffff")};border-collapse:separate;border-spacing:0;border-radius:12px;"><tr><td style="padding:12px;text-align:${stackedListItem ? "left" : "center"};border-radius:12px;overflow:hidden;">${content}</td></tr></table></td>`;
        });
        return `<tr>${cells.join("")}</tr>`;
      });
      return wrapEmailBlockTable(
        `<tr><td style="padding:8px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">${intro}${rows.join("")}</table></td></tr>`,
        W
      ).replace('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="width:100%;max-width:' + W + 'px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="width:100%;max-width:${W}px;background-color:${esc(p.bgColor || "#ffffff")};border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">`);
    }

    case "spacer": {
      return wrapEmailBlockTable(
        `<tr><td style="height:${Number(p.height || 36)}px;font-size:0;line-height:0;background-color:${esc(p.bgColor || "transparent")};">&nbsp;</td></tr>`,
        W
      );
    }

    case "imageText": {
      const imageTextBgImage = toEmailAssetUrl(p.imageSrc);
      const imageTextOverlayImage = toEmailAssetUrl(p.overlayImageSrc);
      const stagePadding = 28;
      const stageHeight = Math.max(220, Number(p.height || 320));
      const stageContentWidth = Math.max(220, W - (stagePadding * 2));
      const overlayImageWidth = Math.min(180, Math.max(56, Math.round((Number(p.overlayImageWidthPct || 24) / 100) * stageContentWidth)));
      const imageButtonTextColor = resolvePreferredColor(p.buttonTextColor || "#ffffff", p.buttonBgColor || "#2563eb", "#ffffff", "#0f172a");
      const msoOverlayRgb = parseColorToRgb(p.overlayShade || "rgba(15,23,42,0.45)") || { r: 15, g: 23, b: 42 };
      const msoOverlayColor = rgbToHex(msoOverlayRgb);
      const contentAlign = p.align === "left" || p.align === "right" ? p.align : "center";
      const tableAlignAttr = (align) => (align === "right" ? "right" : align === "left" ? "left" : "center");
      const contentWidth = Math.max(240, Math.min(stageContentWidth, Math.round(stageContentWidth * 0.86)));
      const topSpacer = Math.max(16, Math.round(stageHeight * 0.1));
      const headlineColor = ensureReadableColor(p.headlineColor || p.textColor, p.overlayShade || "rgba(15,23,42,0.45)", "#ffffff", "#0f172a");
      const subtextColor = ensureReadableColor(p.subtextColor || p.textColor, p.overlayShade || "rgba(15,23,42,0.45)", "#e5e7eb", "#334155");
      const buttonPillHeightPx = 44;
      const buttonHtml = (align) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${tableAlignAttr(align)}" style="border-collapse:separate;mso-table-lspace:0pt;mso-table-rspace:0pt;">
  <tr>
    <td bgcolor="${esc(p.buttonBgColor || "#2563eb")}" height="${buttonPillHeightPx}" style="border-radius:999px;height:${buttonPillHeightPx}px;padding:0 24px;text-align:center;mso-padding-alt:0 24px 0 24px;">
      <a href="${esc(p.href || "#")}" style="display:inline-block;color:${esc(imageButtonTextColor)};text-decoration:none;font-size:15px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:${buttonPillHeightPx}px;height:${buttonPillHeightPx}px;mso-line-height-rule:exactly;white-space:nowrap;">${rich(p.buttonText || "Learn More")}</a>
    </td>
  </tr>
</table>`;
      const overlayImageHtml = isEmailRenderableUrl(imageTextOverlayImage)
        ? `<tr><td align="${tableAlignAttr(contentAlign)}" style="padding:0 0 18px;text-align:${contentAlign};"><img src="${esc(imageTextOverlayImage)}" alt="" width="${overlayImageWidth}" height="${Number(p.overlayImageHeightPx || 72)}" style="width:${overlayImageWidth}px;max-width:100%;height:${Number(p.overlayImageHeightPx || 72)}px;object-fit:contain;display:block;margin:${contentAlign === "left" ? "0 auto 0 0" : contentAlign === "right" ? "0 0 0 auto" : "0 auto"};border-radius:${Number(p.overlayImageRadius || 8)}px;" /></td></tr>`
        : "";
      const headlineHtml = String(p.headline || "").trim()
        ? `<tr><td align="${tableAlignAttr(contentAlign)}" style="padding:0 0 ${String(p.subtext || "").trim() ? 12 : 0}px;text-align:${contentAlign};"><div style="font-size:${Number(p.headlineSize || 30)}px;font-weight:800;line-height:1.15;margin:0;color:${esc(headlineColor)};text-shadow:0 2px 8px rgba(15,23,42,0.35);">${rich(p.headline)}</div></td></tr>`
        : "";
      const subtextHtml = String(p.subtext || "").trim()
        ? `<tr><td align="${tableAlignAttr(contentAlign)}" style="padding:0 0 ${String(p.buttonText || "").trim() ? 20 : 0}px;text-align:${contentAlign};"><div style="font-size:${Number(p.subtextSize || 15)}px;line-height:1.6;margin:0;color:${esc(subtextColor)};">${rich(p.subtext)}</div></td></tr>`
        : "";
      const buttonRowHtml = String(p.buttonText || "").trim()
        ? `<tr><td align="${tableAlignAttr(contentAlign)}" style="padding:0;text-align:${contentAlign};font-size:0;line-height:0;">${buttonHtml(contentAlign)}</td></tr>`
        : "";
      const flowTableHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;height:${stageHeight}px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
  <tr>
    <td valign="middle" style="padding:${stagePadding}px;background:${esc(imageTextBgImage ? (p.overlayShade || "rgba(15,23,42,0.45)") : msoOverlayColor)};vertical-align:middle;">
      <table role="presentation" width="${contentWidth}" cellpadding="0" cellspacing="0" border="0" align="${tableAlignAttr(contentAlign)}" style="width:${contentWidth}px;max-width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr><td height="${topSpacer}" style="height:${topSpacer}px;font-size:0;line-height:0;">&nbsp;</td></tr>
        ${overlayImageHtml}
        ${headlineHtml}
        ${subtextHtml}
        ${buttonRowHtml}
      </table>
    </td>
  </tr>
</table>`;
      return renderEmailBackgroundTable({
        width: W,
        bgColor: imageTextBgImage ? (p.bgColor || "#334155") : msoOverlayColor,
        bgImageSrc: imageTextBgImage,
        bgRepeat: "no-repeat",
        borderRadius: 12,
        fixedHeightPx: stageHeight,
        msoInset: "0,0,0,0",
        tdStyle: `padding:0;background-color:${esc(imageTextBgImage ? "transparent" : msoOverlayColor)};color:${esc(p.textColor || "#ffffff")};font-family:Arial,Helvetica,sans-serif;`,
        innerHtml: flowTableHtml,
      });
    }

    case "quote": {
      const quoteTextColor = ensureReadableColor(p.textColor || "#0f172a", p.bgColor || "#eff6ff", "#ffffff", "#0f172a");
      const avatar = p.avatarSrc
        ? `<img src="${esc(p.avatarSrc)}" alt="${esc(p.author)}" width="68" height="68" style="width:68px;height:68px;border-radius:999px;display:block;margin:0 auto 12px;object-fit:cover;" />`
        : "";
      return wrapEmailBlockTable(
        `<tr><td style="padding:24px;text-align:center;font-family:Arial,Helvetica,sans-serif;color:${esc(quoteTextColor)};background-color:${esc(p.bgColor)};border-radius:12px;overflow:hidden;">${avatar}
  <div style="font-size:22px;line-height:1.5;font-style:italic;margin-bottom:12px;">“${rich(p.quote)}”</div>
  <div style="font-size:15px;font-weight:700;">${rich(p.author)}</div>
  <div style="font-size:13px;opacity:0.8;">${rich(p.role)}</div>
</td></tr>`,
        W
      );
    }

    case "promo": {
      const promoTextColor = ensureReadableColor(p.textColor || "#ffffff", p.bgColor || "#111827", "#ffffff", "#0f172a");
      const promoAccentTextColor = ensureReadableColor("#111827", p.accentColor || "#f59e0b", "#ffffff", "#111827");
      return wrapEmailBlockTable(
        `<tr><td style="padding:24px;font-family:Arial,Helvetica,sans-serif;color:${esc(promoTextColor)};text-align:center;background-color:${esc(p.bgColor)};border-radius:14px;overflow:hidden;">
  <div style="display:inline-block;background:${esc(p.accentColor)};color:${esc(promoAccentTextColor)};font-size:12px;font-weight:800;padding:6px 10px;border-radius:999px;margin-bottom:12px;">${rich(p.badge)}</div>
  <div style="font-size:28px;font-weight:800;line-height:1.2;margin-bottom:8px;">${rich(p.headline)}</div>
  <div style="font-size:15px;line-height:1.6;opacity:0.9;margin-bottom:14px;">${rich(p.details)}</div>
  <div style="display:inline-block;border:2px dashed ${esc(p.accentColor)};padding:10px 16px;border-radius:10px;font-size:22px;font-weight:800;letter-spacing:0.08em;margin-bottom:16px;">${rich(p.code)}</div><br/>
  <a href="${esc(p.href)}" style="display:inline-block;padding:12px 24px;background:${esc(p.accentColor)};color:${esc(promoAccentTextColor)};text-decoration:none;border-radius:999px;font-size:15px;font-weight:700;">${rich(p.buttonText)}</a>
</td></tr>`,
        W
      );
    }

    case "video": {
      const videoTextColor = ensureReadableColor(p.textColor || "#ffffff", p.bgColor || "#0f172a", "#ffffff", "#0f172a");
      const videoThumbWidth = Math.max(120, W - 40);
      const thumb = p.thumbnailSrc
        ? `<a href="${esc(p.href)}" style="display:block;text-decoration:none;margin-bottom:14px;"><img src="${esc(p.thumbnailSrc)}" alt="${esc(p.title)}" width="${videoThumbWidth}" style="width:${videoThumbWidth}px;max-width:100%;height:auto;display:block;border-radius:12px;" /></a>`
        : "";
      return wrapEmailBlockTable(
        `<tr><td style="padding:20px;text-align:center;font-family:Arial,Helvetica,sans-serif;color:${esc(videoTextColor)};background-color:${esc(p.bgColor)};border-radius:12px;overflow:hidden;">${thumb}
  <div style="font-size:24px;font-weight:700;line-height:1.3;margin-bottom:8px;">${rich(p.title)}</div>
  <div style="font-size:14px;line-height:1.6;opacity:0.9;margin-bottom:16px;">${rich(p.caption)}</div>
  <a href="${esc(p.href)}" style="display:inline-block;padding:11px 22px;background:#ef4444;color:#ffffff;text-decoration:none;border-radius:999px;font-size:15px;font-weight:700;">▶ ${rich(p.buttonText)}</a>
</td></tr>`,
        W
      );
    }

    case "contact": {
      const contactTextColor = ensureReadableColor(p.textColor || "#0f172a", p.bgColor || "#f8fafc", "#ffffff", "#0f172a");
      return wrapEmailBlockTable(
        `<tr><td style="padding:22px 24px;font-family:Arial,Helvetica,sans-serif;color:${esc(contactTextColor)};background-color:${esc(p.bgColor)};border-radius:12px;overflow:hidden;">
  <div style="font-size:22px;font-weight:800;margin-bottom:8px;">${rich(p.heading)}</div>
  <div style="font-size:16px;font-weight:700;margin-bottom:2px;">${rich(p.name)}</div>
  <div style="font-size:13px;opacity:0.8;margin-bottom:12px;">${rich(p.role)}</div>
  <div style="font-size:14px;line-height:1.8;">📧 ${rich(p.email)}<br/>📞 ${rich(p.phone)}<br/>📍 ${rich(p.address)}</div>
  <div style="margin-top:16px;"><a href="${esc(p.href)}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:700;">${rich(p.buttonText)}</a></div>
</td></tr>`,
        W
      );
    }

    case "social": {
      const icons = (p.platforms || []).map(pl => {
        const iconUrl = getSocialIconExportUrl(pl.name);
        if (isEmailRenderableUrl(iconUrl)) {
          return `<td style="padding:0 10px;" valign="middle"><a href="${esc(pl.href)}" target="_blank" rel="noopener" aria-label="${esc(pl.name)}" style="display:inline-block;text-decoration:none;"><img src="${esc(iconUrl)}" alt="${esc(pl.name)}" width="${SOCIAL_ICON_SIZE}" height="${SOCIAL_ICON_SIZE}" style="width:${SOCIAL_ICON_SIZE}px;height:${SOCIAL_ICON_SIZE}px;display:block;border:0;outline:none;text-decoration:none;" /></a></td>`;
        }
        const badge = getSocialBadge(pl.name);
        return `<td style="padding:0 10px;" valign="middle"><a href="${esc(pl.href)}" target="_blank" rel="noopener" aria-label="${esc(pl.name)}" style="display:inline-block;width:${SOCIAL_ICON_SIZE}px;height:${SOCIAL_ICON_SIZE}px;line-height:${SOCIAL_ICON_SIZE}px;text-align:center;text-decoration:none;border-radius:${Math.round(SOCIAL_ICON_SIZE / 2)}px;background:${esc(badge.bg)};color:${esc(badge.color)};font-family:Arial,Helvetica,sans-serif;font-size:${Math.max(14, Number(badge.fontSize || 14))}px;font-weight:700;overflow:hidden;">${esc(badge.label)}</a></td>`;
      });
      return wrapEmailBlockTable(
        `<tr><td style="padding:20px;text-align:center;background-color:${esc(p.bgColor)};border-radius:10px;overflow:hidden;">
  <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr>${icons.join("")}</tr></table>
</td></tr>`,
        W
      );
    }

    case "footer":
      const footerTextColor = ensureReadableColor(p.textColor || "#64748b", p.bgColor || "#f1f5f9", "#ffffff", "#0f172a");
      const footerCompanyHtml = withDefaultAnchorStyles(rich(p.company), { color: footerTextColor, textDecoration: "underline" });
      const footerAddressHtml = withDefaultAnchorStyles(rich(p.address), { color: footerTextColor, textDecoration: "underline" });
      const footerLegalSource = String(p.unsubscribeText || "Unsubscribe");
      const footerLegalHtml = /<a\b/i.test(footerLegalSource)
        ? withDefaultAnchorStyles(footerLegalSource, { color: footerTextColor, textDecoration: "underline" })
        : `<a href="${esc(p.unsubscribeHref)}" style="color:${esc(footerTextColor)};text-decoration:underline;font-size:11px;">${rich(footerLegalSource)}</a>`;
      return wrapEmailBlockTable(
        `<tr><td style="padding:20px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${esc(footerTextColor)};background-color:${esc(p.bgColor)};border-radius:8px;overflow:hidden;">
  <p style="margin:0 0 6px;">&copy; ${new Date().getFullYear()} ${footerCompanyHtml}</p>
  <p style="margin:0 0 8px;">${footerAddressHtml}</p>
  <div style="font-size:11px;line-height:1.6;">${footerLegalHtml}</div>
</td></tr>`,
        W
      );

    default:
      return "";
  }
}

export function exportFullHtml(blocks, name = "Email", emailSettings = {}) {
  const settings = normalizeEmailSettings(emailSettings);
  const pageBgColor = esc(settings.outerBgColor);
  const pageBgImage = esc(settings.outerBgImageSrc || "");
  const effectiveCanvasBgColor = settings.outerBgImageSrc && String(settings.canvasBgColor || "").toLowerCase() === "#ffffff"
    ? "transparent"
    : settings.canvasBgColor;
  const bodyBgStyle = settings.outerBgImageSrc
    ? `background-color:${pageBgColor};background-image:url(${pageBgImage});background-position:center top;background-size:${settings.outerBgRepeat === "no-repeat" ? "cover" : "auto"};background-repeat:${esc(settings.outerBgRepeat || "no-repeat")};`
    : `background-color:${pageBgColor};`;
  const preheader = esc(settings.preheaderText || "");
  const exportedBlocks = renderBlockRowsForExport(
    collapseBlocksForExport(stripEmailMetaBlocks(blocks)),
    settings.canvasWidth
  );
  const msoBackground = settings.outerBgImageSrc
    ? `<!--[if gte mso 9]>
<xml>
  <o:OfficeDocumentSettings>
    <o:AllowPNG/>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings>
</xml>
<v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
  <v:fill ${settings.outerBgRepeat === "no-repeat" ? 'type="frame" aspect="atleast" focusposition="0.5,0.5"' : 'type="tile"'} src="${pageBgImage}" color="${pageBgColor}" />
</v:background>
<![endif]-->`
    : "<!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(name)}</title>
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
${msoBackground}
</head>
<body bgcolor="${pageBgColor}" style="margin:0;padding:0;${bodyBgStyle}font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${pageBgColor}" style="width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;${bodyBgStyle}">
<tr><td align="center" style="padding:24px 12px;">
<!--[if mso]>
<table role="presentation" width="${settings.canvasWidth}" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${esc(effectiveCanvasBgColor)}" style="width:${settings.canvasWidth}px;background-color:${esc(effectiveCanvasBgColor)};border-collapse:separate;border-spacing:0;mso-table-lspace:0pt;mso-table-rspace:0pt;border-radius:${settings.canvasRadius}px;"><tr><td style="padding:0;">
<![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${esc(effectiveCanvasBgColor)}" style="width:100%;max-width:${settings.canvasWidth}px;background-color:${esc(effectiveCanvasBgColor)};border-collapse:separate;border-spacing:0;mso-table-lspace:0pt;mso-table-rspace:0pt;border-radius:${settings.canvasRadius}px;">
<tr><td style="padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
${exportedBlocks}
</table>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────
// Canvas block renderers (visual preview, not final HTML)
// ─────────────────────────────────────────────────────────────────

function ImgBtn({ src, onClick, onImageMouseDown, label = "Click to add image", style = {} }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        title="Double-click to replace image"
        onMouseDown={(event) => {
          onImageMouseDown?.(event);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onClick?.();
        }}
        style={{ width: "100%", height: "auto", display: "block", borderRadius: 4, cursor: "default", userSelect: "none", ...style }}
      />
    );
  }
  return (
    <div
      data-direct-action="true"
      onClick={onClick}
      style={{
        background: "#e2e8f0", borderRadius: 6, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 6,
        padding: "28px 12px", color: "#94a3b8", fontSize: 16, fontWeight: 600,
        width: "100%", boxSizing: "border-box", ...style,
      }}
    >
      <span style={{ fontSize: 24 }}>🖼️</span>
      {label}
    </div>
  );
}

function openCanvasHref(href) {
  const url = toAbsoluteUrl(href || "");
  if (!url || url === "#" || typeof window === "undefined") return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

function CanvasLinkShell({ href, children, style = {}, title }) {
  const resolvedHref = toAbsoluteUrl(href || "");
  const canOpen = !!resolvedHref && resolvedHref !== "#";

  return (
    <a
      data-direct-action="true"
      href={canOpen ? resolvedHref : undefined}
      target={canOpen ? "_blank" : undefined}
      rel={canOpen ? "noopener noreferrer" : undefined}
      tabIndex={canOpen ? 0 : undefined}
      title={title || (canOpen ? resolvedHref : undefined)}
      onClick={(event) => {
        event.stopPropagation();
        if (!canOpen) {
          event.preventDefault();
        }
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      style={{ display: "inline-block", cursor: canOpen ? "pointer" : "default", textDecoration: "none", ...style }}
    >
      {children}
    </a>
  );
}

function canvasControlChipStyle({ emphasis = false, compact = false } = {}) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: compact ? 28 : 30,
    padding: compact ? "5px 10px" : "6px 11px",
    borderRadius: 999,
    border: emphasis ? "1px solid rgba(37,99,235,0.28)" : "1px solid rgba(15,23,42,0.12)",
    background: emphasis ? "rgba(239,246,255,0.96)" : "rgba(255,255,255,0.96)",
    color: "#0f172a",
    fontSize: compact ? 11 : 12,
    lineHeight: 1.2,
    fontWeight: 800,
    boxShadow: "0 6px 16px rgba(15,23,42,0.16)",
    maxWidth: "100%",
    textAlign: "center",
    whiteSpace: "normal",
    wordBreak: "break-word",
    backdropFilter: "blur(6px)",
  };
}

function CanvasControlButton({ children, onClick, emphasis = false, compact = false, style = {} }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...canvasControlChipStyle({ emphasis, compact }),
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function CanvasControlBadge({ children, onMouseDown, emphasis = false, compact = false, style = {} }) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        ...canvasControlChipStyle({ emphasis, compact }),
        cursor: "move",
        userSelect: "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function ResizeHandle({ widthPct = 100, heightPx = 160, onChange, visible = true, widthKey = "widthPct", heightKey = "heightPx", label = "image" }) {
  if (!visible) return null;

  const startDrag = (dir) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    const sx = event.clientX;
    const sy = event.clientY;
    const startWidth = Number(widthPct || 100);
    const startHeight = Number(heightPx || 160);

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - sx;
      const dy = moveEvent.clientY - sy;
      const next = {};

      if (/[ew]/.test(dir)) {
        const widthDelta = dir.includes("e") ? dx / 2 : -dx / 2;
        next[widthKey] = clamp(Math.round(startWidth + widthDelta), 20, 100);
      }
      if (/[ns]/.test(dir)) {
        const heightDelta = dir.includes("s") ? dy : -dy;
        next[heightKey] = clamp(Math.round(startHeight + heightDelta), 60, 420);
      }
      onChange?.(next);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handles = [
    { dir: "nw", style: { left: -7, top: -7, cursor: "nwse-resize" } },
    { dir: "n", style: { left: "50%", top: -7, transform: "translateX(-50%)", cursor: "ns-resize" } },
    { dir: "ne", style: { right: -7, top: -7, cursor: "nesw-resize" } },
    { dir: "e", style: { right: -7, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } },
    { dir: "se", style: { right: -7, bottom: -7, cursor: "nwse-resize" } },
    { dir: "s", style: { left: "50%", bottom: -7, transform: "translateX(-50%)", cursor: "ns-resize" } },
    { dir: "sw", style: { left: -7, bottom: -7, cursor: "nesw-resize" } },
    { dir: "w", style: { left: -7, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } },
  ];

  return (
    <>
      <div style={{ position: "absolute", inset: -2, border: "1.5px dashed #93c5fd", borderRadius: 10, pointerEvents: "none" }} />
      {handles.map((handle) => (
        <button
          key={handle.dir}
          type="button"
          data-direct-action="true"
          onMouseDown={startDrag(handle.dir)}
          title={`Drag to resize ${label} (${handle.dir})`}
          style={{
            position: "absolute",
            width: 14,
            height: 14,
            borderRadius: 999,
            border: "1px solid #93c5fd",
            background: "rgba(255,255,255,0.98)",
            boxShadow: "0 2px 8px rgba(15,23,42,0.15)",
            ...handle.style,
          }}
        />
      ))}
    </>
  );
}

function OverlayLayerBox({ rootSelector, src, x = 50, y = 22, widthPct = 24, heightPx = 72, radius = 8, isSelected = false, onPatch, onPick }) {
  if (!src) return null;

  const startMove = (event) => {
    if (!isSelected) return;
    event.preventDefault();
    event.stopPropagation();
    const root = event.currentTarget.closest(rootSelector);
    if (!root) return;
    const rect = root.getBoundingClientRect();

    const updatePosition = (clientX, clientY) => {
      const nextX = clamp(Math.round(((clientX - rect.left) / rect.width) * 100), 5, 95);
      const nextY = clamp(Math.round(((clientY - rect.top) / rect.height) * 100), 5, 95);
      updateAlignmentGuides(root, nextX, nextY);
      onPatch?.({ overlayImageX: nextX, overlayImageY: nextY });
    };

    updatePosition(event.clientX, event.clientY);
    const handleMove = (moveEvent) => updatePosition(moveEvent.clientX, moveEvent.clientY);
    const handleUp = () => {
      clearAlignmentGuides(root);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const startResize = (dir) => (event) => {
    if (!isSelected) return;
    event.preventDefault();
    event.stopPropagation();
    const root = event.currentTarget.closest(rootSelector);
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const sx = event.clientX;
    const sy = event.clientY;
    const startWidth = Number(widthPct || 24);
    const startHeight = Number(heightPx || 72);
    const startX = Number(x || 50);
    const startY = Number(y || 22);

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - sx;
      const dy = moveEvent.clientY - sy;
      const next = {};

      if (/[ew]/.test(dir)) {
        const widthDelta = dir.includes("e") ? (dx / rect.width) * 100 : (-dx / rect.width) * 100;
        next.overlayImageWidthPct = clamp(Math.round(startWidth + widthDelta), 8, 60);
        next.overlayImageX = clamp(Math.round(startX + (dx / rect.width) * 50), 5, 95);
      }
      if (/[ns]/.test(dir)) {
        const heightDelta = dir.includes("s") ? dy : -dy;
        next.overlayImageHeightPx = clamp(Math.round(startHeight + heightDelta), 24, 260);
        next.overlayImageY = clamp(Math.round(startY + (dy / rect.height) * 50), 5, 95);
      }
      onPatch?.(next);
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", handleUp);
  };

  const handles = [
    { dir: "nw", style: { left: -7, top: -7, cursor: "nwse-resize" } },
    { dir: "n", style: { left: "50%", top: -7, transform: "translateX(-50%)", cursor: "ns-resize" } },
    { dir: "ne", style: { right: -7, top: -7, cursor: "nesw-resize" } },
    { dir: "e", style: { right: -7, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } },
    { dir: "se", style: { right: -7, bottom: -7, cursor: "nwse-resize" } },
    { dir: "s", style: { left: "50%", bottom: -7, transform: "translateX(-50%)", cursor: "ns-resize" } },
    { dir: "sw", style: { left: -7, bottom: -7, cursor: "nesw-resize" } },
    { dir: "w", style: { left: -7, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } },
  ];

  return (
    <div
      data-direct-action="true"
      onMouseDown={startMove}
      style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)", zIndex: 3, textAlign: "center", width: `clamp(56px, ${widthPct}%, 180px)`, cursor: isSelected ? "move" : "default" }}
    >
      {isSelected && <div style={{ position: "absolute", inset: -2, border: "1.5px dashed #c084fc", borderRadius: (radius || 8) + 2, pointerEvents: "none" }} />}
      <img src={src} alt="" onClick={(e) => { e.stopPropagation(); if (!isSelected) onPick?.(); }} style={{ width: "100%", height: `${heightPx}px`, objectFit: "contain", display: "block", borderRadius: radius || 8, cursor: isSelected ? "move" : "pointer" }} />
      {isSelected && handles.map((handle) => (
        <button
          key={handle.dir}
          type="button"
          data-direct-action="true"
          onMouseDown={startResize(handle.dir)}
          style={{ position: "absolute", width: 14, height: 14, borderRadius: 999, border: "1px solid #c084fc", background: "rgba(255,255,255,0.98)", boxShadow: "0 2px 8px rgba(15,23,42,0.15)", ...handle.style }}
        />
      ))}
    </div>
  );
}

function textVariantStyle(variant = "body", fontSize = 18) {
  const size = Number(fontSize) || 18;
  switch (variant) {
    case "headline":
      return { fontSize: size, fontWeight: 800, lineHeight: 1.15 };
    case "h1":
      return { fontSize: size, fontWeight: 800, lineHeight: 1.2 };
    case "h2":
      return { fontSize: size, fontWeight: 700, lineHeight: 1.25 };
    case "h3":
      return { fontSize: size, fontWeight: 700, lineHeight: 1.3 };
    case "small":
      return { fontSize: size, fontWeight: 500, lineHeight: 1.6 };
    case "body":
    default:
      return { fontSize: size, fontWeight: 500, lineHeight: 1.6 };
  }
}

function InlineEditableText({ as = "div", value = "", onChange, style = {}, placeholder = "Text", normalize = null }) {
  const Tag = as;
  const ref = useRef(null);
  const savedRangeRef = useRef(null);
  const isEditingRef = useRef(false);
  const safeValue = String(value ?? "");
  const resolvedStyle = {
    outline: "none",
    whiteSpace: "pre-wrap",
    cursor: "text",
    direction: "ltr",
    unicodeBidi: "plaintext",
    ...(as === "span" ? {} : { display: style.display || "block", minHeight: style.minHeight || "1em" }),
    ...style,
  };

  useEffect(() => {
    if (!ref.current) return;
    if (document.activeElement === ref.current || isEditingRef.current) return;
    const hasMarkup = /<\/?[a-z][\s\S]*>/i.test(safeValue);
    const nextValue = safeValue || placeholder;
    if (hasMarkup) {
      if (ref.current.innerHTML !== nextValue) {
        ref.current.innerHTML = nextValue;
      }
    } else if (ref.current.textContent !== nextValue) {
      ref.current.textContent = nextValue;
    }
    normalize?.(ref.current);
  }, [safeValue, placeholder, normalize]);

  const commit = () => {
    normalize?.(ref.current);
    const html = ref.current?.innerHTML || "";
    const text = ref.current?.textContent || "";
    const nextValue = /<\/?[a-z][\s\S]*>/i.test(html) ? html : text;
    onChange?.(nextValue);
    return nextValue;
  };

  const rememberSelection = () => {
    if (typeof window === "undefined") return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (ref.current?.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    if (typeof window === "undefined") return null;
    const sel = window.getSelection();
    if (!sel) return null;
    if (savedRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
    return sel;
  };

  const applyInlineStyle = (styles = {}) => {
    if (!ref.current || typeof document === "undefined" || typeof window === "undefined") return "";
    ref.current.focus();
    const { sel, range } = ensureRangeInRoot(ref.current, restoreSelection);

    if (!range) {
      return commit();
    }

    // Helper to merge styles for CSSStyleDeclaration
    function mergeStylesOnElement(el, update) {
      if (!el || !el.style) return;
      for (const key in update) {
        if (update[key] === null || update[key] === "") {
          el.style.removeProperty(key.replace(/[A-Z]/g, m => '-' + m.toLowerCase()));
        } else {
          el.style[key] = update[key];
        }
      }
    }

    if (range.collapsed) {
      let target = (range.startContainer?.nodeType === window.Node.TEXT_NODE
        ? range.startContainer.parentElement
        : range.startContainer) || ref.current;
      if (target && target !== ref.current) {
        mergeStylesOnElement(target, styles);
      } else {
        const span = document.createElement("span");
        for (const key in styles) {
          if (styles[key] !== null && styles[key] !== "") {
            span.style[key] = styles[key];
          }
        }
        wrapRootContents(ref.current, span);
        const nextRange = document.createRange();
        nextRange.selectNodeContents(span);
        nextRange.collapse(false);
        sel.removeAllRanges();
        sel.addRange(nextRange);
        savedRangeRef.current = nextRange.cloneRange();
      }
    } else {
      const span = document.createElement("span");
      for (const key in styles) {
        if (styles[key] !== null && styles[key] !== "") {
          span.style[key] = styles[key];
        }
      }
      try {
        const contents = range.cloneContents();
        const walker = document.createTreeWalker(contents, NodeFilter.SHOW_ELEMENT, null);
        let node;
        while ((node = walker.nextNode())) {
          if (node.nodeType === 1 && node.tagName === "SPAN") {
            mergeStylesOnElement(node, styles);
          }
        }
        range.deleteContents();
        span.appendChild(contents);
        range.insertNode(span);
      } catch {
        const fragment = range.extractContents();
        span.appendChild(fragment);
        range.insertNode(span);
      }
      const nextRange = document.createRange();
      nextRange.selectNodeContents(span);
      nextRange.collapse(false);
      sel.removeAllRanges();
      sel.addRange(nextRange);
      savedRangeRef.current = nextRange.cloneRange();
    }

    rememberSelection();
    return commit();
  };

  const api = {
    focus: () => {
      ref.current?.focus();
      restoreSelection();
    },
    exec: (command, value = null) => runRichTextCommand(ref.current, restoreSelection, rememberSelection, commit, command, value),
    applyStyle: (styles = {}) => applyInlineStyle(styles),
    toggleList: (ordered = false) => runRichTextCommand(ref.current, restoreSelection, rememberSelection, commit, ordered ? "insertOrderedList" : "insertUnorderedList"),
    commit,
  };

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      dir="ltr"
      data-inline-editor="true"
      onFocus={(e) => {
        isEditingRef.current = true;
        activeRichTextApi = api;
        const current = String(e.currentTarget.textContent || "").trim();
        if (!safeValue && current === String(placeholder || "").trim()) {
          e.currentTarget.textContent = "";
        }
        rememberSelection();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onMouseUp={rememberSelection}
      onKeyUp={rememberSelection}
      onInput={() => {
        isEditingRef.current = true;
        rememberSelection();
        normalize?.(ref.current);
      }}
      onBlur={() => {
        window.setTimeout(() => {
          const activeEl = document.activeElement;
          const inToolbar = activeEl?.closest?.('[data-email-text-toolbar="true"]');
          const inEditor = activeEl?.closest?.('[contenteditable="true"], [data-inline-editor="true"]');
          if (inToolbar || inEditor) {
            isEditingRef.current = true;
            return;
          }
          isEditingRef.current = false;
          commit();
        }, 0);
      }}
      style={resolvedStyle}
    />
  );
}

function RichTextCanvas({ props, onPatch, isSelected }) {
  const ref = useRef(null);
  const savedRangeRef = useRef(null);
  const [frameHeight, setFrameHeight] = useState(1200);
  const variantStyle = textVariantStyle(props.variant || "body", props.fontSize || 18);
  const isRawHtml = !!props.rawHtml;
  const readableTextColor = ensureReadableColor(props.textColor || "#1e293b", props.bgColor || "#ffffff", "#ffffff", "#0f172a");

  const normalizeRichContent = useCallback(() => {
    if (!ref.current || isRawHtml) return;
    ref.current.querySelectorAll("p").forEach((el) => {
      el.style.marginTop = "0";
      el.style.marginBottom = "0.75em";
    });
    ref.current.querySelectorAll("ul").forEach((el) => {
      el.style.listStyleType = "disc";
      el.style.paddingLeft = "1.5em";
      el.style.margin = "0.75em 0";
    });
    ref.current.querySelectorAll("ol").forEach((el) => {
      el.style.listStyleType = "decimal";
      el.style.paddingLeft = "1.5em";
      el.style.margin = "0.75em 0";
    });
    ref.current.querySelectorAll("li").forEach((el) => {
      el.style.margin = "0.25em 0";
    });
    applyDefaultAnchorStyles(ref.current, { color: readableTextColor, textDecoration: "inherit" });
  }, [isRawHtml, readableTextColor]);

  useEffect(() => {
    if (!ref.current) return;
    if (document.activeElement === ref.current) return;
    const incoming = String(props.html || "").trim() || "<p>Your text goes here.</p>";
    if (ref.current.innerHTML !== incoming) {
      ref.current.innerHTML = incoming;
    }
    normalizeRichContent();
  }, [props.html, normalizeRichContent]);

  const commit = () => {
    if (!ref.current) return "";
    normalizeRichContent();
    const html = ref.current.innerHTML || "";
    onPatch?.({ html });
    return html;
  };

  const rememberSelection = () => {
    if (typeof window === "undefined") return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (ref.current?.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    if (typeof window === "undefined") return null;
    const sel = window.getSelection();
    if (!sel) return null;
    if (savedRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
    return sel;
  };

  const mergeStylesOnElement = (el, update) => {
    if (!el || !el.style) return;
    for (const key in update) {
      if (update[key] === null || update[key] === "") {
        el.style.removeProperty(key.replace(/[A-Z]/g, m => '-' + m.toLowerCase()));
      } else {
        el.style[key] = update[key];
      }
    }
  };

  const applyInlineStyle = (styles = {}) => {
    if (!ref.current || typeof document === "undefined" || typeof window === "undefined") return "";
    ref.current.focus();
    const { sel, range } = ensureRangeInRoot(ref.current, restoreSelection);

    if (!range) {
      return commit();
    }

    if (range.collapsed) {
      const target = (range.startContainer?.nodeType === window.Node.TEXT_NODE
        ? range.startContainer.parentElement
        : range.startContainer) || ref.current;
      if (target && target !== ref.current) {
        mergeStylesOnElement(target, styles);
      } else {
        const span = document.createElement("span");
        for (const key in styles) {
          if (styles[key] !== null && styles[key] !== "") {
            span.style[key] = styles[key];
          }
        }
        wrapRootContents(ref.current, span);
        const nextRange = document.createRange();
        nextRange.selectNodeContents(span);
        nextRange.collapse(false);
        sel.removeAllRanges();
        sel.addRange(nextRange);
        savedRangeRef.current = nextRange.cloneRange();
      }
    } else {
      const span = document.createElement("span");
      for (const key in styles) {
        if (styles[key] !== null && styles[key] !== "") {
          span.style[key] = styles[key];
        }
      }
      try {
        const contents = range.cloneContents();
        const walker = document.createTreeWalker(contents, NodeFilter.SHOW_ELEMENT, null);
        let node;
        while ((node = walker.nextNode())) {
          if (node.nodeType === 1 && node.tagName === "SPAN") {
            mergeStylesOnElement(node, styles);
          }
        }
        range.deleteContents();
        span.appendChild(contents);
        range.insertNode(span);
      } catch {
        const fragment = range.extractContents();
        span.appendChild(fragment);
        range.insertNode(span);
      }
      const nextRange = document.createRange();
      nextRange.selectNodeContents(span);
      nextRange.collapse(false);
      sel.removeAllRanges();
      sel.addRange(nextRange);
      savedRangeRef.current = nextRange.cloneRange();
    }

    normalizeRichContent();
    rememberSelection();
    return commit();
  };

  const api = {
    focus: () => {
      ref.current?.focus();
      restoreSelection();
    },
    exec: (command, value = null) => runRichTextCommand(ref.current, restoreSelection, rememberSelection, commit, command, value, normalizeRichContent),
    applyStyle: (styles = {}) => applyInlineStyle(styles),
    toggleList: (ordered = false) => runRichTextCommand(ref.current, restoreSelection, rememberSelection, commit, ordered ? "insertOrderedList" : "insertUnorderedList", null, normalizeRichContent),
    commit,
  };

  const activateApi = () => {
    activeRichTextApi = api;
  };

  useEffect(() => {
    if (isSelected) {
      activateApi();
      return () => {
        if (activeRichTextApi === api) activeRichTextApi = null;
      };
    }
  }, [isSelected, props.html, props.variant, props.fontSize, props.align, props.textColor, props.fontFamily]);

  if (isRawHtml) {
    return (
      <div style={{ background: "#e5e7eb", padding: "16px 12px", borderRadius: 12 }}>
        <iframe
          title="Imported email preview"
          srcDoc={String(props.html || "")}
          sandbox="allow-same-origin"
          scrolling="no"
          onLoad={(e) => {
            try {
              const doc = e.currentTarget.contentWindow?.document;
              const h = Math.max(
                doc?.documentElement?.scrollHeight || 0,
                doc?.body?.scrollHeight || 0,
                700
              );
              setFrameHeight(Math.min(h + 24, 3200));
            } catch {}
          }}
          style={{
            width: "100%",
            minHeight: 700,
            height: frameHeight,
            border: isSelected ? "2px solid rgba(37,99,235,0.45)" : "1px solid #cbd5e1",
            borderRadius: 10,
            background: "#ffffff",
            pointerEvents: "none",
          }}
        />
      </div>
    );
  }

  const boxWidthPct = clamp(Number(props.widthPct || 100), 20, 100);
  const boxHeightPx = clamp(Number(props.boxHeightPx || 120), 60, 420);

  return (
    <div style={{ background: props.bgColor, backgroundImage: props.bgImageSrc ? `linear-gradient(rgba(255,255,255,0.16), rgba(255,255,255,0.16)), url(${props.bgImageSrc})` : undefined, backgroundSize: props.bgRepeat === "no-repeat" ? "cover" : "auto", backgroundPosition: "center", backgroundRepeat: props.bgRepeat || "no-repeat", padding: "16px 24px" }}>
      <div style={{ position: "relative", width: `${boxWidthPct}%`, maxWidth: "100%", margin: "0 auto" }}>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-inline-editor="true"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            e.stopPropagation();
            activateApi();
          }}
          onFocus={() => {
            activateApi();
            rememberSelection();
          }}
          onKeyUp={() => {
            activateApi();
            rememberSelection();
          }}
          onMouseUp={() => {
            activateApi();
            rememberSelection();
          }}
          onInput={() => {
            activateApi();
            rememberSelection();
          }}
          onBlur={() => {
            commit();
            window.setTimeout(() => {
              const activeEl = document.activeElement;
              const inToolbar = activeEl?.closest?.('[data-email-text-toolbar="true"]');
              const inEditor = activeEl?.closest?.('[contenteditable="true"], [data-inline-editor="true"]');
              if (!inToolbar && !inEditor && activeRichTextApi === api) {
                activeRichTextApi = null;
              }
            }, 0);
          }}
          style={{
            color: readableTextColor,
            textAlign: props.align || "left",
            fontFamily: props.fontFamily || "Arial, Helvetica, sans-serif",
            ...variantStyle,
            minHeight: boxHeightPx,
            outline: isSelected ? "1px dashed rgba(37,99,235,0.35)" : "none",
            outlineOffset: 4,
            cursor: "text",
            boxSizing: "border-box",
          }}
        />
        <ResizeHandle
          widthPct={boxWidthPct}
          heightPx={boxHeightPx}
          onChange={onPatch}
          visible={isSelected}
          widthKey="widthPct"
          heightKey="boxHeightPx"
          label="text box"
        />
      </div>
    </div>
  );
}

// Each block type's canvas renderer — receives { props, onImg(field, idx?) }
const CANVAS = {
  header({ props, onImg, onPatch, isSelected }) {
    const titleColor = ensureReadableColor(props.titleColor || props.textColor, props.bgColor || "#1d4ed8", "#ffffff", "#0f172a");
    const subtitleColor = ensureReadableColor(props.subtitleColor || props.textColor, props.bgColor || "#1d4ed8", "#dbeafe", "#334155");
    return (
      <div style={{ background: props.bgColor, backgroundImage: props.bgImageSrc ? `linear-gradient(rgba(15,23,42,0.28), rgba(15,23,42,0.28)), url(${props.bgImageSrc})` : undefined, backgroundSize: props.bgRepeat === "no-repeat" ? "cover" : "auto", backgroundPosition: "center", backgroundRepeat: props.bgRepeat || "no-repeat", borderRadius: 8, padding: "24px 20px", textAlign: "center" }}>
        {props.logoSrc
          ? <div style={{ position: "relative", width: `${props.logoWidthPct || 28}%`, minWidth: 84, maxWidth: 220, margin: "0 auto 12px" }}>
              <img src={props.logoSrc} alt="Logo" title="Double-click to replace logo" onDoubleClick={(event) => { event.stopPropagation(); onImg("logoSrc"); }} style={{ width: "100%", height: `${props.logoHeightPx || 84}px`, objectFit: "contain", display: "block", cursor: "default", userSelect: "none" }} />
              {isSelected && (
                <>
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); onImg("logoSrc"); }}
                    style={{ position: "absolute", top: 8, left: 8, border: "none", borderRadius: 999, background: "rgba(15,23,42,0.82)", color: "#fff", fontSize: 11, fontWeight: 800, padding: "6px 10px", cursor: "pointer", zIndex: 3 }}
                  >
                    Replace Logo
                  </button>
                  <ResizeHandle widthPct={props.logoWidthPct || 28} heightPx={props.logoHeightPx || 84} onChange={onPatch} visible={isSelected} widthKey="logoWidthPct" heightKey="logoHeightPx" label="logo" />
                </>
              )}
            </div>
          : <ImgBtn onClick={() => onImg("logoSrc")} label="Click to add logo" style={{ maxWidth: 200, margin: "0 auto 12px" }} />
        }
        <InlineEditableText
          as="h1"
          value={props.title || "Email Title"}
          onChange={(v) => onPatch?.({ title: v })}
          style={{ margin: "12px 0 6px", color: titleColor, fontSize: props.titleSize || 28, fontWeight: 700, lineHeight: 1.15, textShadow: "0 2px 8px rgba(15,23,42,0.22)" }}
        />
        <InlineEditableText
          as="p"
          value={props.subtitle || "Subtitle or tagline here"}
          onChange={(v) => onPatch?.({ subtitle: v })}
          style={{ margin: 0, color: subtitleColor, opacity: 0.96, fontSize: props.subtitleSize || 16, lineHeight: 1.55, fontWeight: 600 }}
        />
      </div>
    );
  },
  text({ props, onPatch, isSelected }) {
    return <RichTextCanvas props={props} onPatch={onPatch} isSelected={isSelected} />;
  },
  image({ props, onImg, onPatch, isSelected }) {
    const startImageDrag = (event) => {
      if (!props.src || !isSelected) return;
      event.preventDefault();
      event.stopPropagation();
      const root = event.currentTarget.closest("[data-main-image-root]");
      if (!root) return;
      const rect = root.getBoundingClientRect();

      const updatePosition = (clientX, clientY) => {
        const nextX = clamp(Math.round(((clientX - rect.left) / rect.width) * 100), 0, 100);
        const nextY = clamp(Math.round(((clientY - rect.top) / rect.height) * 100), 0, 100);
        onPatch?.({ imageX: nextX, imageY: nextY });
      };

      updatePosition(event.clientX, event.clientY);
      const handleMove = (moveEvent) => updatePosition(moveEvent.clientX, moveEvent.clientY);
      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    };

    const startOverlayDrag = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const root = event.currentTarget.closest("[data-image-overlay-root]");
      if (!root) return;
      const rect = root.getBoundingClientRect();

      const updatePosition = (clientX, clientY) => {
        const nextX = clamp(Math.round(((clientX - rect.left) / rect.width) * 100), 5, 95);
        const nextY = clamp(Math.round(((clientY - rect.top) / rect.height) * 100), 8, 92);
        updateAlignmentGuides(root, nextX, nextY);
        onPatch?.({ overlayEnabled: true, overlayX: nextX, overlayY: nextY });
      };

      updatePosition(event.clientX, event.clientY);

      const handleMove = (moveEvent) => updatePosition(moveEvent.clientX, moveEvent.clientY);
      const handleUp = () => {
        clearAlignmentGuides(root);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    };

    const startLayerDrag = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const root = event.currentTarget.closest("[data-image-overlay-root]");
      if (!root) return;
      const rect = root.getBoundingClientRect();

      const updatePosition = (clientX, clientY) => {
        const nextX = clamp(Math.round(((clientX - rect.left) / rect.width) * 100), 5, 95);
        const nextY = clamp(Math.round(((clientY - rect.top) / rect.height) * 100), 5, 95);
        onPatch?.({ overlayImageX: nextX, overlayImageY: nextY });
      };

      updatePosition(event.clientX, event.clientY);
      const handleMove = (moveEvent) => updatePosition(moveEvent.clientX, moveEvent.clientY);
      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    };

    const overlayTitle = String(props.overlayTitle || "").trim() || "Click to edit headline";
    const overlayText = String(props.overlayText || "").trim() || "Click to edit supporting text";
    const overlayTitleColor = ensureReadableColor(props.overlayTitleColor || props.textColor, props.overlayBgColor || "rgba(15,23,42,0.38)", "#ffffff", "#0f172a");
    const overlayTextColor = ensureReadableColor(props.overlayTextColor || props.textColor, props.overlayBgColor || "rgba(15,23,42,0.38)", "#f8fafc", "#334155");
    const showOverlay = !!props.src && (props.overlayEnabled || isSelected);
    const enableOverlay = () => onPatch?.({
      overlayEnabled: true,
      overlayTitle,
      overlayText,
      overlayBgColor: props.overlayBgColor || "rgba(15,23,42,0.38)",
      overlayX: props.overlayX ?? 50,
      overlayY: props.overlayY ?? 50,
    });

    const imageControls = props.src && isSelected ? (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
        <CanvasControlButton
          emphasis
          onClick={(e) => {
            e.stopPropagation();
            if (props.overlayEnabled) onPatch?.({ overlayEnabled: false });
            else enableOverlay();
          }}
        >
          {props.overlayEnabled ? "Hide Text" : "Add Text Overlay"}
        </CanvasControlButton>
        <CanvasControlButton onClick={(e) => { e.stopPropagation(); onImg("src"); }}>
          Replace Image
        </CanvasControlButton>
        <CanvasControlButton onClick={(e) => { e.stopPropagation(); onImg("overlayImageSrc"); }}>
          {props.overlayImageSrc ? "Change Top Image" : "Add Top Image"}
        </CanvasControlButton>
        <CanvasControlBadge onMouseDown={startImageDrag} compact>
          ✥ Drag image
        </CanvasControlBadge>
      </div>
    ) : null;

    const content = (
      <div data-main-image-root style={{ display: "inline-block", position: "relative", width: `${props.widthPct || 100}%`, minWidth: 80 }}>
        <ImgBtn
          src={props.src}
          onClick={() => onImg("src")}
          onImageMouseDown={startImageDrag}
          style={{ borderRadius: props.borderRadius || 0, height: props.src ? `${props.heightPx || 220}px` : undefined, objectFit: props.src ? (props.fitMode || "cover") : undefined, objectPosition: props.src ? `${props.imageX ?? 50}% ${props.imageY ?? 50}%` : undefined, cursor: props.src ? (isSelected ? "move" : "default") : "pointer" }}
        />
        {showOverlay && (
          <div data-image-overlay-root style={{ position: "absolute", inset: 0, borderRadius: props.borderRadius || 0, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: props.overlayEnabled ? (props.overlayBgColor || "rgba(15,23,42,0.38)") : "rgba(15,23,42,0.12)" }} />
            <OverlayLayerBox
              rootSelector="[data-image-overlay-root]"
              src={props.overlayImageSrc}
              x={props.overlayImageX ?? 50}
              y={props.overlayImageY ?? 22}
              widthPct={props.overlayImageWidthPct ?? 24}
              heightPx={props.overlayImageHeightPx ?? 72}
              radius={props.overlayImageRadius ?? 8}
              isSelected={isSelected}
              onPatch={onPatch}
              onPick={() => { if (isSelected) onImg("overlayImageSrc"); }}
            />
            <div
              style={{ position: "absolute", left: `${props.overlayX ?? 50}%`, top: `${props.overlayY ?? 50}%`, transform: "translate(-50%, -50%)", width: "min(84%, 420px)", color: props.textColor || "#ffffff", textAlign: "center", zIndex: 4 }}
            >
              {isSelected && (
                <CanvasControlBadge onMouseDown={startOverlayDrag} compact style={{ marginBottom: 8 }}>
                  ✥ Drag text
                </CanvasControlBadge>
              )}
              <div style={{ padding: "10px 12px", borderRadius: 14, background: isSelected ? "rgba(15,23,42,0.28)" : "rgba(15,23,42,0.16)", outline: isSelected ? "1px dashed rgba(255,255,255,0.45)" : "none", boxShadow: "0 10px 24px rgba(15,23,42,0.18)" }}>
                <InlineEditableText as="div" value={overlayTitle} onChange={(v) => onPatch?.({ overlayEnabled: true, overlayTitle: v })} style={{ fontSize: props.overlayTitleSize || 24, fontWeight: 800, lineHeight: 1.15, marginBottom: overlayText ? 8 : 0, color: overlayTitleColor, textShadow: "0 2px 8px rgba(15,23,42,0.4)" }} />
                <InlineEditableText as="div" value={overlayText} onChange={(v) => onPatch?.({ overlayEnabled: true, overlayText: v })} style={{ fontSize: props.overlayTextSize || 14, fontWeight: 600, lineHeight: 1.5, color: overlayTextColor, textShadow: "0 2px 8px rgba(15,23,42,0.35)" }} />
              </div>
            </div>
          </div>
        )}
        {props.src && (
          <ResizeHandle widthPct={props.widthPct || 100} heightPx={props.heightPx || 220} onChange={onPatch} visible={isSelected} />
        )}
      </div>
    );

    return (
      <div style={{ padding: "12px 16px", textAlign: props.align || "center", background: props.bgColor || "transparent" }}>
        {imageControls}
        {content}
      </div>
    );
  },
  button({ props, onPatch }) {
    const py = props.paddingY ?? 12;
    const btnWidth = props.widthMode === "full" ? "100%" : props.widthMode === "px" ? `${props.widthPx || 200}px` : "auto";
    const readableButtonTextColor = resolvePreferredColor(props.textColor || "#ffffff", props.bgColor || "#2563eb", "#ffffff", "#0f172a");
    return (
      <div style={{ padding: "16px 24px", textAlign: props.align || "center", background: props.blockBgColor || "transparent" }}>
        <CanvasLinkShell href={props.href}>
          <InlineEditableText
            as="span"
            value={props.text || "Button"}
            onChange={(v) => onPatch?.({ text: v })}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              verticalAlign: "middle",
              padding: `${py}px 28px`,
              background: props.bgColor || "#2563eb", color: readableButtonTextColor,
              borderRadius: props.borderRadius || 8, fontSize: 16, fontWeight: 600,
              width: btnWidth,
              minHeight: `calc(${py}px * 2 + 1em)`,
              boxSizing: "border-box",
              textAlign: "center",
              lineHeight: 1.2,
              border: "1px solid rgba(15,23,42,0.10)",
              boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
            }}
          />
        </CanvasLinkShell>
      </div>
    );
  },
  divider({ props }) {
    const side = `${Math.round((100 - (props.widthPct || 100)) / 2)}%`;
    return (
      <div style={{ padding: "12px 20px", background: "#fff" }}>
        <hr style={{ border: "none", borderTop: `${props.thickness || 1}px ${props.style || "solid"} ${props.color || "#e2e8f0"}`, margin: `0 ${side}` }} />
      </div>
    );
  },
  spacer({ props }) {
    return (
      <div style={{ background: props.bgColor || "transparent", padding: "0 16px" }}>
        <div
          style={{
            height: Number(props.height || 36),
            borderRadius: 8,
            border: "1px dashed #cbd5e1",
            background: "rgba(148,163,184,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#64748b",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Spacer • {Number(props.height || 36)} px
        </div>
      </div>
    );
  },
  hero({ props, onImg, onPatch, isSelected }) {
    const py = props.paddingY ?? 32;
    const headlineColor = ensureReadableColor(props.headlineColor || props.textColor, props.bgColor || "#0f172a", "#ffffff", "#0f172a");
    const subtextColor = ensureReadableColor(props.subtextColor || props.textColor, props.bgColor || "#0f172a", "#e5e7eb", "#334155");
    const ctaTextColor = resolvePreferredColor(props.ctaTextColor || "#ffffff", props.ctaBgColor || "#2563eb", "#ffffff", "#0f172a");

    const startHeroImageDrag = (event) => {
      if (!props.imageSrc || !isSelected) return;
      event.preventDefault();
      event.stopPropagation();
      const root = event.currentTarget.closest("[data-hero-image-root]");
      if (!root) return;
      const rect = root.getBoundingClientRect();

      const updatePosition = (clientX, clientY) => {
        const nextX = clamp(Math.round(((clientX - rect.left) / rect.width) * 100), 0, 100);
        const nextY = clamp(Math.round(((clientY - rect.top) / rect.height) * 100), 0, 100);
        onPatch?.({ imageX: nextX, imageY: nextY });
      };

      updatePosition(event.clientX, event.clientY);
      const handleMove = (moveEvent) => updatePosition(moveEvent.clientX, moveEvent.clientY);
      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    };

    const heroImageControls = props.imageSrc && isSelected ? (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
        <CanvasControlButton onClick={(e) => { e.stopPropagation(); onImg("imageSrc"); }}>
          Replace Image
        </CanvasControlButton>
        <CanvasControlBadge onMouseDown={startHeroImageDrag} compact>
          ✥ Drag image
        </CanvasControlBadge>
      </div>
    ) : null;

    return (
      <div style={{ background: props.bgColor, backgroundImage: props.bgImageSrc ? `linear-gradient(rgba(15,23,42,0.35), rgba(15,23,42,0.35)), url(${props.bgImageSrc})` : undefined, backgroundSize: props.bgRepeat === "no-repeat" ? "cover" : "auto", backgroundPosition: "center", backgroundRepeat: props.bgRepeat || "no-repeat", borderRadius: 12, padding: `${py}px 28px`, textAlign: "center" }}>
        {heroImageControls}
        <div data-hero-image-root style={{ position: "relative", width: `${props.imageWidthPct || 100}%`, minWidth: 80, margin: "0 auto 16px" }}>
          <ImgBtn
            src={props.imageSrc}
            onClick={() => onImg("imageSrc")}
            onImageMouseDown={startHeroImageDrag}
            label="Click to add hero image"
            style={{ borderRadius: 8, height: props.imageSrc ? `${props.imageHeightPx || 220}px` : undefined, objectFit: props.imageSrc ? "cover" : undefined, objectPosition: props.imageSrc ? `${props.imageX ?? 50}% ${props.imageY ?? 50}%` : undefined, cursor: props.imageSrc ? (isSelected ? "move" : "default") : "pointer" }}
          />
          {props.imageSrc && isSelected && <ResizeHandle widthPct={props.imageWidthPct || 100} heightPx={props.imageHeightPx || 220} onChange={onPatch} visible={isSelected} widthKey="imageWidthPct" heightKey="imageHeightPx" />}
        </div>
        <InlineEditableText
          as="h2"
          value={props.headline || "Your Big Headline"}
          onChange={(v) => onPatch?.({ headline: v })}
          style={{ margin: "16px 0 10px", color: headlineColor, fontSize: props.headlineSize || 30, fontWeight: 700, lineHeight: 1.15, textShadow: "0 2px 8px rgba(15,23,42,0.28)" }}
        />
        <InlineEditableText
          as="p"
          value={props.subtext || "Supporting text that explains the value proposition."}
          onChange={(v) => onPatch?.({ subtext: v })}
          style={{ margin: "0 0 20px", color: subtextColor, opacity: 0.96, fontSize: props.subtextSize || 16, fontWeight: 600, lineHeight: 1.55 }}
        />
        <CanvasLinkShell href={props.ctaHref}>
          <InlineEditableText
            as="span"
            value={props.ctaText || "Get Started"}
            onChange={(v) => onPatch?.({ ctaText: v })}
            style={{ display: "inline-block", padding: "11px 26px", background: props.ctaBgColor, color: ctaTextColor, borderRadius: 999, fontSize: 16, fontWeight: 600 }}
          />
        </CanvasLinkShell>
      </div>
    );
  },
  imageText({ props, onImg, onPatch, isSelected }) {
    const headlineColor = ensureReadableColor(props.headlineColor || props.textColor, props.overlayShade || "rgba(15,23,42,0.45)", "#ffffff", "#0f172a");
    const subtextColor = ensureReadableColor(props.subtextColor || props.textColor, props.overlayShade || "rgba(15,23,42,0.45)", "#e5e7eb", "#334155");
    const buttonTextColor = resolvePreferredColor(props.buttonTextColor || "#ffffff", props.buttonBgColor || "#2563eb", "#ffffff", "#0f172a");
    const startElementDrag = (xKey, yKey) => (event) => {
      if (!isSelected) return;
      if (event.target?.closest?.('[contenteditable="true"], [data-inline-editor="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      const stage = event.currentTarget.closest("[data-image-text-stage]");
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const updatePosition = (clientX, clientY) => {
        const nextX = clamp(Math.round(((clientX - rect.left) / rect.width) * 100), 5, 95);
        const nextY = clamp(Math.round(((clientY - rect.top) / rect.height) * 100), 8, 92);
        updateAlignmentGuides(stage, nextX, nextY);
        onPatch?.({ [xKey]: nextX, [yKey]: nextY });
      };
      updatePosition(event.clientX, event.clientY);
      const handleMove = (moveEvent) => updatePosition(moveEvent.clientX, moveEvent.clientY);
      const handleUp = () => {
        clearAlignmentGuides(stage);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    };
    const startLayerDrag = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const root = event.currentTarget.closest("[data-image-text-root]");
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const updatePosition = (clientX, clientY) => {
        const nextX = clamp(Math.round(((clientX - rect.left) / rect.width) * 100), 5, 95);
        const nextY = clamp(Math.round(((clientY - rect.top) / rect.height) * 100), 5, 95);
        updateAlignmentGuides(root, nextX, nextY);
        onPatch?.({ overlayImageX: nextX, overlayImageY: nextY });
      };
      updatePosition(event.clientX, event.clientY);
      const handleMove = (moveEvent) => updatePosition(moveEvent.clientX, moveEvent.clientY);
      const handleUp = () => {
        clearAlignmentGuides(root);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    };
    const renderElementBox = ({
      label,
      xKey,
      yKey,
      widthKey,
      heightKey,
      defaultX,
      defaultY,
      defaultWidth,
      defaultHeight,
      minWidth = 22,
      minHeight = 56,
      edgePadding = 28,
      children,
    }) => {
      const stageVisualHeight = Math.max(220, Number(props.height || 320)) + 56;
      const boxX = clamp(Number(props[xKey] ?? defaultX), 5, 95);
      const boxWidth = clamp(Number(props[widthKey] ?? defaultWidth), minWidth, 100);
      const boxHeight = clamp(Number(props[heightKey] ?? defaultHeight), minHeight, 420);
      const boxY = clampOverlayCenterPct(Number(props[yKey] ?? defaultY), boxHeight, stageVisualHeight, edgePadding);

      return (
        <div
          onMouseDown={startElementDrag(xKey, yKey)}
          style={{
            position: "absolute",
            left: `${boxX}%`,
            top: `${boxY}%`,
            transform: "translate(-50%, -50%)",
            width: `${boxWidth}%`,
            minWidth: 120,
            maxWidth: "calc(100% - 12px)",
            height: boxHeight,
            color: props.textColor || "#ffffff",
            textAlign: props.align || "center",
            cursor: isSelected ? "move" : "default",
            zIndex: 3,
          }}
        >
          <div
            data-image-text-box
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              padding: "12px 14px",
              borderRadius: 16,
              outline: isSelected ? "1.5px dashed rgba(147,197,253,0.95)" : "none",
              background: isSelected ? "rgba(15,23,42,0.18)" : "transparent",
              boxShadow: isSelected ? "0 12px 30px rgba(15,23,42,0.18)" : "none",
              overflow: "visible",
            }}
          >
            {isSelected && (
              <CanvasControlBadge
                onMouseDown={startElementDrag(xKey, yKey)}
                compact
                style={{
                  position: "absolute",
                  top: -30,
                  left: props.align === "left" ? 0 : props.align === "right" ? "auto" : "50%",
                  right: props.align === "right" ? 0 : "auto",
                  transform: props.align === "center" ? "translateX(-50%)" : "none",
                }}
              >
                ✥ Drag {label}
              </CanvasControlBadge>
            )}
            {children}
            {isSelected && (
              <ResizeHandle
                widthPct={boxWidth}
                heightPx={boxHeight}
                onChange={onPatch}
                visible={isSelected}
                widthKey={widthKey}
                heightKey={heightKey}
                label={label}
              />
            )}
          </div>
        </div>
      );
    };

    return (
      <div data-image-text-root style={{ position: "relative", minHeight: Number(props.height || 320), borderRadius: 12, overflow: "hidden", background: "#334155", backgroundImage: props.imageSrc ? `linear-gradient(${props.overlayShade || "rgba(15,23,42,0.45)"}, ${props.overlayShade || "rgba(15,23,42,0.45)"}), url(${props.imageSrc})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
        {!props.imageSrc && <div style={{ padding: 18 }}><ImgBtn src={props.imageSrc} onClick={() => onImg("imageSrc")} label="Add background image" /></div>}
        {isSelected && (
          <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", justifyContent: "flex-end", zIndex: 4 }}>
            <CanvasControlButton onClick={(e) => { e.stopPropagation(); onImg("overlayImageSrc"); }}>
            {props.overlayImageSrc ? "Change Top Image" : "Add Top Image"}
            </CanvasControlButton>
          </div>
        )}
        <OverlayLayerBox
          rootSelector="[data-image-text-root]"
          src={props.overlayImageSrc}
          x={props.overlayImageX ?? 50}
          y={props.overlayImageY ?? 18}
          widthPct={props.overlayImageWidthPct ?? 24}
          heightPx={props.overlayImageHeightPx ?? 72}
          radius={props.overlayImageRadius ?? 8}
          isSelected={isSelected}
          onPatch={onPatch}
          onPick={() => { if (isSelected) onImg("overlayImageSrc"); }}
        />
        <div data-image-text-stage style={{ position: "relative", zIndex: 2, minHeight: Number(props.height || 320), padding: "28px" }}>
          {renderElementBox({
            label: "title",
            xKey: "headlineX",
            yKey: "headlineY",
            widthKey: "headlineBoxWidthPct",
            heightKey: "headlineBoxHeightPx",
            defaultX: 50,
            defaultY: 28,
            defaultWidth: 78,
            defaultHeight: 84,
            minWidth: 26,
            minHeight: 60,
            edgePadding: 22,
            children: (
              <InlineEditableText
                as="div"
                value={props.headline || "Text over your image"}
                onChange={(v) => onPatch?.({ headline: v })}
                style={{
                  fontSize: props.headlineSize || 30,
                  fontWeight: 800,
                  lineHeight: 1.15,
                  color: headlineColor,
                  textShadow: "0 2px 8px rgba(15,23,42,0.35)",
                  textAlign: props.align || "center",
                }}
              />
            ),
          })}
          {renderElementBox({
            label: "subtitle",
            xKey: "subtextX",
            yKey: "subtextY",
            widthKey: "subtextBoxWidthPct",
            heightKey: "subtextBoxHeightPx",
            defaultX: 50,
            defaultY: 56,
            defaultWidth: 84,
            defaultHeight: 92,
            minWidth: 28,
            minHeight: 64,
            edgePadding: 24,
            children: (
              <InlineEditableText
                as="div"
                value={props.subtext || "Add a headline and supporting copy directly on top of the image."}
                onChange={(v) => onPatch?.({ subtext: v })}
                style={{
                  fontSize: props.subtextSize || 15,
                  fontWeight: 600,
                  lineHeight: 1.6,
                  color: subtextColor,
                  textAlign: props.align || "center",
                }}
              />
            ),
          })}
          {renderElementBox({
            label: "button",
            xKey: "buttonX",
            yKey: "buttonY",
            widthKey: "buttonBoxWidthPct",
            heightKey: "buttonBoxHeightPx",
            defaultX: 50,
            defaultY: 78,
            defaultWidth: 36,
            defaultHeight: 84,
            minWidth: 18,
            minHeight: 56,
            edgePadding: 42,
            children: (
              <div style={{ display: "flex", alignItems: "center", justifyContent: props.align === "left" ? "flex-start" : props.align === "right" ? "flex-end" : "center", width: "100%", height: "100%" }}>
                <CanvasLinkShell href={props.href}>
                  <InlineEditableText as="span" value={props.buttonText || "Learn More"} onChange={(v) => onPatch?.({ buttonText: v })} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "42px", padding: "10px 22px", background: props.buttonBgColor || "#2563eb", color: buttonTextColor, borderRadius: 999, fontSize: 15, fontWeight: 700, lineHeight: 1.2, textAlign: "center", boxSizing: "border-box" }} />
                </CanvasLinkShell>
              </div>
            ),
          })}
        </div>
      </div>
    );
  },
  quote({ props, onImg, onPatch }) {
    const quoteTextColor = ensureReadableColor(props.textColor || "#0f172a", props.bgColor || "#eff6ff", "#ffffff", "#0f172a");
    return (
      <div style={{ background: props.bgColor || "#eff6ff", borderRadius: 12, padding: 20, textAlign: "center" }}>
        <div style={{ width: 72, margin: "0 auto 12px" }}>
          <ImgBtn src={props.avatarSrc} onClick={() => onImg("avatarSrc")} label="Avatar" style={{ borderRadius: 999 }} />
        </div>
        <InlineEditableText as="div" value={props.quote} onChange={(v) => onPatch?.({ quote: v })} style={{ fontSize: 20, fontWeight: 600, fontStyle: "italic", lineHeight: 1.6, color: quoteTextColor, marginBottom: 10 }} />
        <InlineEditableText as="div" value={props.author} onChange={(v) => onPatch?.({ author: v })} style={{ fontSize: 16, fontWeight: 800, color: quoteTextColor }} />
        <InlineEditableText as="div" value={props.role} onChange={(v) => onPatch?.({ role: v })} style={{ fontSize: 14, fontWeight: 600, color: quoteTextColor, opacity: 0.75 }} />
      </div>
    );
  },
  promo({ props, onPatch }) {
    const promoTextColor = ensureReadableColor(props.textColor || "#ffffff", props.bgColor || "#111827", "#ffffff", "#0f172a");
    const promoAccentTextColor = ensureReadableColor("#111827", props.accentColor || "#f59e0b", "#ffffff", "#111827");
    return (
      <div style={{ background: props.bgColor || "#111827", color: promoTextColor, borderRadius: 14, padding: 24, textAlign: "center" }}>
        <div style={{ display: "inline-block", background: props.accentColor || "#f59e0b", color: promoAccentTextColor, padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800, marginBottom: 12 }}>{props.badge}</div>
        <InlineEditableText as="div" value={props.headline} onChange={(v) => onPatch?.({ headline: v })} style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2, marginBottom: 8, color: promoTextColor }} />
        <InlineEditableText as="div" value={props.details} onChange={(v) => onPatch?.({ details: v })} style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.6, opacity: 0.9, marginBottom: 14, color: promoTextColor }} />
        <InlineEditableText as="div" value={props.code} onChange={(v) => onPatch?.({ code: v })} style={{ display: "inline-block", border: `2px dashed ${props.accentColor || "#f59e0b"}`, borderRadius: 10, padding: "8px 14px", fontSize: 22, fontWeight: 800, letterSpacing: "0.08em", marginBottom: 14, color: promoTextColor }} />
        <div>
          <CanvasLinkShell href={props.href}>
            <InlineEditableText as="span" value={props.buttonText} onChange={(v) => onPatch?.({ buttonText: v })} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "42px", padding: "11px 24px", background: props.accentColor || "#f59e0b", color: promoAccentTextColor, borderRadius: 999, fontSize: 15, fontWeight: 700, lineHeight: 1.2, textAlign: "center", boxSizing: "border-box" }} />
          </CanvasLinkShell>
        </div>
      </div>
    );
  },
  video({ props, onImg, onPatch }) {
    const videoTextColor = ensureReadableColor(props.textColor || "#ffffff", props.bgColor || "#0f172a", "#ffffff", "#0f172a");
    return (
      <div style={{ background: props.bgColor || "#0f172a", color: videoTextColor, borderRadius: 12, padding: 18, textAlign: "center" }}>
        <ImgBtn src={props.thumbnailSrc} onClick={() => onImg("thumbnailSrc")} label="Add video thumbnail" style={{ marginBottom: 14, borderRadius: 12 }} />
        <InlineEditableText as="div" value={props.title} onChange={(v) => onPatch?.({ title: v })} style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: videoTextColor }} />
        <InlineEditableText as="div" value={props.caption} onChange={(v) => onPatch?.({ caption: v })} style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.6, opacity: 0.9, marginBottom: 12, color: videoTextColor }} />
        <CanvasLinkShell href={props.href}>
          <InlineEditableText as="span" value={props.buttonText} onChange={(v) => onPatch?.({ buttonText: v })} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "42px", padding: "10px 22px", background: "#ef4444", color: "#fff", borderRadius: 999, fontSize: 15, fontWeight: 700, lineHeight: 1.2, textAlign: "center", boxSizing: "border-box" }} />
        </CanvasLinkShell>
      </div>
    );
  },
  contact({ props, onPatch }) {
    const contactTextColor = ensureReadableColor(props.textColor || "#0f172a", props.bgColor || "#f8fafc", "#ffffff", "#0f172a");
    return (
      <div style={{ background: props.bgColor || "#f8fafc", color: contactTextColor, borderRadius: 12, padding: 20 }}>
        <InlineEditableText as="div" value={props.heading} onChange={(v) => onPatch?.({ heading: v })} style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: contactTextColor }} />
        <InlineEditableText as="div" value={props.name} onChange={(v) => onPatch?.({ name: v })} style={{ fontSize: 17, fontWeight: 800, color: contactTextColor }} />
        <InlineEditableText as="div" value={props.role} onChange={(v) => onPatch?.({ role: v })} style={{ fontSize: 14, fontWeight: 600, opacity: 0.75, marginBottom: 10, color: contactTextColor }} />
        <InlineEditableText as="div" value={props.email} onChange={(v) => onPatch?.({ email: v })} style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: contactTextColor }} />
        <InlineEditableText as="div" value={props.phone} onChange={(v) => onPatch?.({ phone: v })} style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: contactTextColor }} />
        <InlineEditableText as="div" value={props.address} onChange={(v) => onPatch?.({ address: v })} style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.6, marginBottom: 12, color: contactTextColor }} />
        <CanvasLinkShell href={props.href}>
          <InlineEditableText as="span" value={props.buttonText} onChange={(v) => onPatch?.({ buttonText: v })} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "40px", padding: "10px 20px", background: "#2563eb", color: "#fff", borderRadius: 999, fontSize: 15, fontWeight: 700, lineHeight: 1.2, textAlign: "center", boxSizing: "border-box" }} />
        </CanvasLinkShell>
      </div>
    );
  },
  grid({ props, onImg, onPatch }) {
    const perRow = Math.max(1, Math.min(4, Number(props.columnsPerRow || 2)));
    const rows = chunkItems(props.columns || [], perRow);
    return (
      <div style={{ display: "grid", gap: 12, padding: 8, background: props.bgColor || "transparent" }}>
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} style={{ display: "flex", gap: 12 }}>
            {row.map((col, i) => {
              const absoluteIndex = rowIdx * perRow + i;
              return (
                <div key={absoluteIndex} style={{ flex: 1, minWidth: 0, background: col.bgColor || "transparent", borderRadius: 12, padding: 10, boxShadow: col.bgColor === "transparent" ? "none" : "0 1px 3px rgba(15,23,42,0.08)" }}>
                  <ImgBtn src={col.imageSrc} onClick={() => onImg("imageSrc_col", absoluteIndex)} label="Add image" style={{ marginBottom: 10, borderRadius: 8 }} />
                  <InlineEditableText
                    as="div"
                    value={col.title}
                    onChange={(v) => {
                      const next = (props.columns || []).map((entry, idx) => idx === absoluteIndex ? { ...entry, title: v } : entry);
                      onPatch?.({ columns: next });
                    }}
                    style={{ fontWeight: 700, fontSize: 16, color: "#1e293b", marginBottom: 4 }}
                  />
                  <InlineEditableText
                    as="div"
                    value={col.text}
                    onChange={(v) => {
                      const next = (props.columns || []).map((entry, idx) => idx === absoluteIndex ? { ...entry, text: v } : entry);
                      onPatch?.({ columns: next });
                    }}
                    style={{ fontSize: 15, fontWeight: 600, color: "#475569", lineHeight: 1.5 }}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  },
  list({ props, onImg, onPatch }) {
    const perRow = Math.max(1, Math.min(4, Number(props.itemsPerRow || 1)));
    const rows = chunkItems(props.items || [], perRow);
    return (
      <div style={{ display: "grid", gap: 12, background: props.bgColor || "transparent", padding: "8px" }}>
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} style={{ display: "flex", gap: 12 }}>
            {row.map((item, i) => {
              const absoluteIndex = rowIdx * perRow + i;
              return (
                <div key={absoluteIndex} style={{ flex: 1, minWidth: 0, display: "flex", gap: 12, padding: 12, background: item.bgColor || "transparent", borderRadius: 12, boxShadow: item.bgColor === "transparent" ? "none" : "0 1px 3px rgba(15,23,42,0.08)", alignItems: "flex-start" }}>
                  <div style={{ flexShrink: 0, width: perRow > 1 ? 90 : 110 }}>
                    <ImgBtn src={item.imageSrc} onClick={() => onImg("imageSrc_item", absoluteIndex)} label="Image" style={{ width: "100%", borderRadius: 8 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <InlineEditableText
                      as="div"
                      value={item.title}
                      onChange={(v) => {
                        const next = (props.items || []).map((entry, idx) => idx === absoluteIndex ? { ...entry, title: v } : entry);
                        onPatch?.({ items: next });
                      }}
                      style={{ fontWeight: 700, fontSize: 16, color: "#1e293b", marginBottom: 5 }}
                    />
                    <InlineEditableText
                      as="div"
                      value={item.text}
                      onChange={(v) => {
                        const next = (props.items || []).map((entry, idx) => idx === absoluteIndex ? { ...entry, text: v } : entry);
                        onPatch?.({ items: next });
                      }}
                      style={{ fontSize: 15, fontWeight: 600, color: "#475569", lineHeight: 1.5 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  },
  gridCard({ props, onImg, onPatch, isSelected }) {
    const bodyTitleColor = ensureReadableColor("", props.bgColor || "#ffffff", "#ffffff", "#1e293b");
    const bodyTextColor = ensureReadableColor("", props.bgColor || "#ffffff", "#e5e7eb", "#475569");

    return (
      <div style={{ background: props.bgColor || "transparent", borderRadius: 12, padding: 10, boxShadow: props.bgColor === "transparent" ? "none" : undefined }}>
        <div style={{ position: "relative", width: `${props.imageWidthPct || 100}%`, marginBottom: 10 }}>
          <ImgBtn src={props.imageSrc} onClick={() => onImg("imageSrc")} label="Add image" style={{ borderRadius: 8, height: props.imageSrc ? `${props.imageHeightPx || 160}px` : undefined, objectFit: props.imageSrc ? "cover" : undefined }} />
          <ResizeHandle widthPct={props.imageWidthPct || 100} heightPx={props.imageHeightPx || 160} onChange={onPatch} visible={isSelected} widthKey="imageWidthPct" heightKey="imageHeightPx" />
        </div>
        <InlineEditableText
          as="div"
          value={props.title}
          onChange={(v) => onPatch?.({ title: v, overlayEnabled: false })}
          placeholder="Card headline"
          style={{ fontWeight: 700, fontSize: 16, color: bodyTitleColor, marginBottom: 4 }}
        />
        <InlineEditableText
          as="div"
          value={props.text}
          onChange={(v) => onPatch?.({ text: v, overlayEnabled: false })}
          placeholder="Card description"
          style={{ fontSize: 15, fontWeight: 600, color: bodyTextColor, lineHeight: 1.5 }}
        />
      </div>
    );
  },
  listCard({ props, onImg, onPatch, isSelected }) {
    const stacked = Number(props.perRow || 1) <= 1;
    const bodyTitleColor = ensureReadableColor("", props.bgColor || "#ffffff", "#ffffff", "#1e293b");
    const bodyTextColor = ensureReadableColor("", props.bgColor || "#ffffff", "#e5e7eb", "#475569");

    return (
      <div style={{ display: stacked ? "flex" : "block", gap: 12, padding: 12, background: props.bgColor || "transparent", borderRadius: 12, alignItems: "flex-start", boxShadow: props.bgColor === "transparent" ? "none" : undefined }}>
        <div style={{ width: stacked ? `${Math.min(220, props.imageHeightPx || 110)}px` : `${props.imageWidthPct || 100}%`, flexShrink: 0, marginBottom: stacked ? 0 : 10, position: "relative" }}>
          <ImgBtn src={props.imageSrc} onClick={() => onImg("imageSrc")} label="Image" style={{ width: "100%", borderRadius: 8, height: props.imageSrc ? `${props.imageHeightPx || 110}px` : undefined, objectFit: props.imageSrc ? "cover" : undefined }} />
          <ResizeHandle widthPct={props.imageWidthPct || 100} heightPx={props.imageHeightPx || 110} onChange={onPatch} visible={isSelected} widthKey="imageWidthPct" heightKey="imageHeightPx" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <InlineEditableText
            as="div"
            value={props.title}
            onChange={(v) => onPatch?.({ title: v, overlayEnabled: false })}
            placeholder="List headline"
            style={{ fontWeight: 700, fontSize: 16, color: bodyTitleColor, marginBottom: 5 }}
          />
          <InlineEditableText
            as="div"
            value={props.text}
            onChange={(v) => onPatch?.({ text: v, overlayEnabled: false })}
            placeholder="List description"
            style={{ fontSize: 15, fontWeight: 600, color: bodyTextColor, lineHeight: 1.5 }}
          />
        </div>
      </div>
    );
  },
  social({ props }) {
    const radius = resolveBlockRadius(props, 10);
    return (
      <div style={{ background: props.bgColor, borderRadius: radius, padding: "20px 16px", textAlign: "center", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
          {(props.platforms || []).map(pl => (
            <CanvasLinkShell key={pl.name} href={pl.href} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }} title={pl.href || pl.name}>
              <img src={getSocialIconUrl(pl.name)} alt={pl.name} style={{ width: SOCIAL_ICON_SIZE, height: SOCIAL_ICON_SIZE }} />
            </CanvasLinkShell>
          ))}
        </div>
      </div>
    );
  },
  footer({ props, onPatch }) {
    const footerTextColor = ensureReadableColor(props.textColor || "#64748b", props.bgColor || "#f1f5f9", "#ffffff", "#0f172a");
    const normalizeFooterLinks = (root) => applyDefaultAnchorStyles(root, { color: footerTextColor, textDecoration: "underline" });
    const radius = resolveBlockRadius(props, 8);
    return (
      <div style={{ background: props.bgColor, borderRadius: radius, padding: "20px 16px", textAlign: "center", overflow: "hidden" }}>
        <div style={{ color: footerTextColor, fontSize: 16, fontWeight: 600, lineHeight: 1.8, direction: "ltr", unicodeBidi: "plaintext" }}>
          <div>
            <span>{`© ${new Date().getFullYear()} `}</span>
            <InlineEditableText
              as="span"
              value={props.company}
              onChange={(v) => onPatch?.({ company: v })}
              placeholder="Your Company"
              normalize={normalizeFooterLinks}
              style={{ display: "inline" }}
            />
          </div>
          <InlineEditableText
            as="div"
            value={props.address}
            onChange={(v) => onPatch?.({ address: v })}
            placeholder="123 Street, City, Country"
            normalize={normalizeFooterLinks}
          />
          <InlineEditableText
            as="div"
            value={props.unsubscribeText || "Unsubscribe"}
            onChange={(v) => onPatch?.({ unsubscribeText: v })}
            placeholder="Unsubscribe"
            normalize={normalizeFooterLinks}
            style={{ marginTop: 6 }}
          />
        </div>
      </div>
    );
  },
};

// ─────────────────────────────────────────────────────────────────
// Shared inspector form controls
// ─────────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#056dff", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      {children}
    </div>
  );
}

function InlineEditHint({ children }) {
  return (
    <div style={{ margin: "-2px 0 12px", fontSize: 13, fontWeight: 700, color: "#64748b", lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

const INSPECTOR_INPUT_STYLE = {
  width: "100%",
  minHeight: 38,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "0 12px",
  fontSize: 16,
  fontWeight: 700,
  color: "#0f172a",
  background: "#ffffff",
  boxSizing: "border-box",
  colorScheme: "light",
  WebkitTextFillColor: "#0f172a",
};

const INSPECTOR_TEXTAREA_STYLE = {
  ...INSPECTOR_INPUT_STYLE,
  minHeight: 110,
  padding: "10px 12px",
  resize: "vertical",
  lineHeight: 1.5,
};

const INSPECTOR_SELECT_STYLE = {
  ...INSPECTOR_INPUT_STYLE,
  minHeight: 42,
  padding: "8px 12px",
  background: "#fffef7",
  border: "1px solid #d6b54c",
  cursor: "pointer",
  lineHeight: 1.3,
  whiteSpace: "normal",
};

function TxtIn({ value, onChange, placeholder = "", type = "text", dark = false }) {
  return (
    <input
      type={type} value={value ?? ""} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ ...INSPECTOR_INPUT_STYLE, border: dark ? "1px solid #2563eb" : INSPECTOR_INPUT_STYLE.border, background: "#ffffff", color: "#0f172a", WebkitTextFillColor: "#0f172a" }}
    />
  );
}
function TxtArea({ value, onChange, rows = 5 }) {
  return (
    <textarea
      value={value ?? ""} onChange={e => onChange(e.target.value)} rows={rows}
      style={INSPECTOR_TEXTAREA_STYLE}
    />
  );
}
function ColIn({ value, onChange, allowTransparent = false }) {
  const current = value || "#000000";
  const swatchValue = /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(String(current || "")) ? current : "#000000";
  const [matchedColors, setMatchedColors] = useState([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("email_matched_colors_v1") || "[]");
      setMatchedColors(Array.isArray(saved) ? saved.slice(0, 12) : []);
    } catch {
      setMatchedColors([]);
    }
  }, []);

  const rememberColor = (color) => {
    const nextColor = String(color || "").trim();
    if (!nextColor) return;
    const next = [nextColor, ...matchedColors.filter((entry) => String(entry).toLowerCase() !== nextColor.toLowerCase())].slice(0, 12);
    setMatchedColors(next);
    try {
      localStorage.setItem("email_matched_colors_v1", JSON.stringify(next));
    } catch {}
  };

  const applyColor = (color) => {
    onChange(color);
    rememberColor(color);
  };

  const matchColour = async () => {
    if (typeof window !== "undefined" && "EyeDropper" in window) {
      try {
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) applyColor(result.sRGBHex);
        return;
      } catch {}
    }

    const typed = window.prompt("Paste a colour value to match:", String(current || "#000000"));
    if (typed) applyColor(typed);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="color"
          value={swatchValue}
          onChange={e => applyColor(e.target.value)}
          style={{ width: 34, height: 34, border: "1px solid #cbd5e1", borderRadius: 6, padding: 2, cursor: "pointer", flexShrink: 0, background: "#fff" }}
        />
        <input
          type="text"
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          style={{ ...INSPECTOR_INPUT_STYLE, flex: 1 }}
        />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={matchColour}
          style={{ height: 32, padding: "0 10px", border: "1px solid #2563eb", borderRadius: 8, background: "#eff6ff", color: "#1d4ed8", fontSize: 13, fontWeight: 800, cursor: "pointer" }}
        >
          🎯 Match Colour
        </button>
        {allowTransparent && (
          <button
            type="button"
            onClick={() => applyColor("transparent")}
            style={{ height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 13, fontWeight: 800, cursor: "pointer" }}
          >
            Transparent
          </button>
        )}
        <button
          type="button"
          onClick={() => rememberColor(current)}
          style={{ height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#334155", fontSize: 13, fontWeight: 800, cursor: "pointer" }}
        >
          ★ Save Colour
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {COLOR_PRESETS.map((color) => {
          const isActive = String(current).toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              onClick={() => applyColor(color)}
              title={color}
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: isActive ? "3px solid #2563eb" : color === "#ffffff" ? "1px solid #94a3b8" : "1px solid rgba(15,23,42,0.18)",
                background: color,
                cursor: "pointer",
                boxShadow: isActive ? "0 0 0 2px rgba(37,99,235,0.18)" : "none",
                padding: 0,
              }}
            />
          );
        })}
      </div>
      {matchedColors.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Matched Colours</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {matchedColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => applyColor(color)}
                title={color}
                style={{ height: 28, minWidth: 28, padding: "0 8px", borderRadius: 999, border: "1px solid rgba(15,23,42,0.14)", background: color, cursor: "pointer" }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function SlideIn({ value, onChange, min = 0, max = 100, unit = "%" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <input className="email-editor-range" type="range" min={min} max={max} value={value ?? min} onChange={e => onChange(Number(e.target.value))} style={{ flex: 1 }} />
      <span style={{ minWidth: 44, fontSize: 16, fontWeight: 600, color: "#0f172a", textAlign: "right" }}>{value ?? min}{unit}</span>
    </div>
  );
}
function OverlayColorField({ value, onChange }) {
  const rgb = parseColorToRgb(value) || { r: 15, g: 23, b: 42 };
  const hex = rgbToHex(rgb);
  const opacity = parseAlphaFromColor(value, 0.38);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <ColIn value={hex} onChange={(next) => onChange(composeOverlayColor(next, opacity))} allowTransparent />
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Opacity</div>
        <SlideIn value={Math.round(opacity * 100)} onChange={(next) => onChange(composeOverlayColor(hex, next / 100))} min={0} max={100} unit="%" />
      </div>
    </div>
  );
}
function NumIn({ value, onChange, min = 0, max = 9999, unit = "px", step = 1 }) {
  const [draft, setDraft] = useState(String(value ?? ""));

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  const commit = (raw) => {
    if (raw === "" || raw == null) {
      const safe = clamp(Number(min), min, max);
      setDraft(String(safe));
      onChange(safe);
      return;
    }
    const num = Number(raw);
    if (!Number.isFinite(num)) {
      setDraft(String(value ?? min));
      return;
    }
    const safe = clamp(num, min, max);
    setDraft(String(safe));
    onChange(safe);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        style={{ ...INSPECTOR_INPUT_STYLE, flex: 1 }}
      />
      <span style={{ minWidth: 34, fontSize: 14, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{unit}</span>
    </div>
  );
}
function SelIn({ value, onChange, options }) {
  const selected = options.find((opt) => String(opt.value) === String(value ?? "")) || options[0];
  const resolvedValue = String(selected?.value ?? "");

  return (
    <select
      className="email-editor-select"
      value={resolvedValue}
      onChange={e => onChange(e.target.value)}
      style={INSPECTOR_SELECT_STYLE}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} style={{ color: "#0f172a", background: "#fffef7", whiteSpace: "normal" }}>{opt.label}</option>
      ))}
    </select>
  );
}

function ToolbarSelect({ label, value, onChange, options, width = 180, beforeAction }) {
  const selectRef = useRef(null);
  const selected = options.find((opt) => String(opt.value) === String(value ?? "")) || options[0];
  const resolvedValue = String(selected?.value ?? "");
  const selectedLabel = selected?.label || "";

  const openPicker = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    beforeAction?.();
    const control = selectRef.current;
    if (!control) return;
    control.focus?.();
    if (typeof control.showPicker === "function") {
      control.showPicker();
      return;
    }
    control.click?.();
  };

  return (
    <label data-direct-action="true" style={{ display: "flex", flexDirection: "column", gap: 4, width, minWidth: width, flexShrink: 0 }}>
      <span style={{ fontSize: 10, fontWeight: 900, color: "#854d0e", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <div style={{ position: "relative", width: "100%", height: 34 }}>
        <button
          type="button"
          onMouseDown={openPicker}
          data-direct-action="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            width: "100%",
            minHeight: 38,
            padding: "8px 34px 8px 10px",
            border: "1px solid #d6b54c",
            borderRadius: 10,
            background: "#fffef7",
            color: "#0f172a",
            fontSize: 14,
            fontWeight: 800,
            boxSizing: "border-box",
            cursor: "pointer",
            overflow: "hidden",
            whiteSpace: "normal",
            textOverflow: "ellipsis",
            lineHeight: 1.25,
            textAlign: "left",
          }}
        >
          {selectedLabel}
          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#854d0e" }}>▼</span>
        </button>
        <select
          ref={selectRef}
          className="email-editor-select"
          value={resolvedValue}
          aria-label={label}
          onChange={(e) => {
            const next = e.target.value;
            const run = () => onChange(next);
            if (typeof window !== "undefined") {
              window.requestAnimationFrame(run);
            } else {
              run();
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1,
            height: 1,
            border: 0,
            padding: 0,
            margin: 0,
            background: "transparent",
            color: "transparent",
            fontSize: 14,
            fontWeight: 800,
            boxSizing: "border-box",
            cursor: "default",
            WebkitTextFillColor: "transparent",
            colorScheme: "light",
            opacity: 0,
            pointerEvents: "none",
            appearance: "none",
            WebkitAppearance: "none",
          }}
          tabIndex={-1}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ color: "#0f172a", background: "#fffef7" }}>{opt.label}</option>
          ))}
        </select>
      </div>
    </label>
  );
}

function ToolbarColorDropdown({ label, value, onChange, matchedColors = [], standardColors = [], onRemember, allowTransparent = false, beforeAction }) {
  const current = String(value || (allowTransparent ? "transparent" : "#111827"));
  const quickColors = [...new Set([...(allowTransparent ? ["transparent"] : []), ...matchedColors, ...standardColors])].slice(0, 12);

  const applyColor = (color) => {
    beforeAction?.();
    const run = () => {
      onChange(color);
      onRemember?.(color);
    };
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(run);
    } else {
      run();
    }
  };

  return (
    <div data-direct-action="true" style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 168, flexShrink: 0 }}>
      <span style={{ fontSize: 10, fontWeight: 900, color: "#854d0e", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 34 }}>
        <span style={{ width: 18, height: 18, borderRadius: 999, border: "1px solid rgba(15,23,42,0.18)", background: current === "transparent" ? "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)" : current, flexShrink: 0 }} />
        <input
          type="color"
          value={current === "transparent" ? "#fff59d" : current}
          onChange={(e) => applyColor(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ width: 34, height: 34, border: "1px solid #d6b54c", borderRadius: 8, background: "#fffef7", padding: 2, cursor: "pointer" }}
        />
        {allowTransparent && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              applyColor("transparent");
            }}
            style={{ height: 34, padding: "0 10px", border: "1px solid #d6b54c", borderRadius: 8, background: "#fff", color: "#0f172a", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            No fill
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {quickColors.map((color) => {
          const active = String(current).toLowerCase() === String(color).toLowerCase();
          return (
            <button
              key={color}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                applyColor(color);
              }}
              title={color === "transparent" ? "No highlight" : color}
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                border: active ? "2px solid #0f172a" : "1px solid rgba(15,23,42,0.18)",
                background: color === "transparent" ? "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)" : color,
                cursor: "pointer",
                padding: 0,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
function ImgField({ label, value, onUpload, onClear, onEdit, onLibrary, onAiImage }) {
  const ref = useRef();
  const handlePress = (fn) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    fn?.();
  };

  return (
    <Field label={label}>
      {value && (
        <div style={{ marginBottom: 8 }}>
          <img src={value} alt="" style={{ maxWidth: "100%", height: "auto", borderRadius: 4, display: "block", marginBottom: 6 }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 2 }}>
            <button type="button" onMouseDown={handlePress(onClear)} style={{ fontSize: 16, fontWeight: 600, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>✕ Remove</button>
            {onEdit && (
              <button type="button" onMouseDown={handlePress(onEdit)} style={{ fontSize: 16, fontWeight: 600, color: "#6366f1", background: "none", border: "none", cursor: "pointer", padding: 0 }}>✏️ Crop / Remove BG</button>
            )}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" onMouseDown={handlePress(() => ref.current?.click())}
          style={{ flex: 1, height: 36, border: "1px dashed #94a3b8", borderRadius: 6, background: "#f8fafc", color: "#475569", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
          {value ? "Replace" : "⬆ Upload"}
        </button>
        {onLibrary && (
          <button type="button" onMouseDown={handlePress(onLibrary)}
            style={{ height: 36, padding: "0 12px", border: "1px solid #6366f1", borderRadius: 6, background: "#eef2ff", color: "#4f46e5", fontSize: 16, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            🗂️ Library
          </button>
        )}
        {onAiImage && (
          <button type="button" onMouseDown={handlePress(onAiImage)}
            style={{ height: 36, padding: "0 12px", border: "1px solid #7c3aed", borderRadius: 6, background: "#ede9fe", color: "#7c3aed", fontSize: 16, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            ✨ AI
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUpload(f); }} />
    </Field>
  );
}

// ─────────────────────────────────────────────────────────────────
// Inspector panels (one per block type)
// ─────────────────────────────────────────────────────────────────

function HeaderInspector({ props, patch, upload, edit, library, aiImage }) {
  return <>
    <ImgField label="Background Image" value={props.bgImageSrc} onUpload={f => upload(f, "bgImageSrc")} onClear={() => patch({ bgImageSrc: "" })} onEdit={props.bgImageSrc ? () => edit("bgImageSrc", null, props.bgImageSrc) : null} onLibrary={() => library("bgImageSrc", null)} onAiImage={() => aiImage("bgImageSrc", null)} />
    <ImgField label="Logo Image" value={props.logoSrc} onUpload={f => upload(f, "logoSrc")} onClear={() => patch({ logoSrc: "" })} onEdit={props.logoSrc ? () => edit("logoSrc", null, props.logoSrc) : null} onLibrary={() => library("logoSrc", null)} onAiImage={() => aiImage("logoSrc", null)} />
    <InlineEditHint>
      Click the header text on the canvas to edit it directly. Use this panel for images and colours.
    </InlineEditHint>
    <Field label="Background"><ColIn value={props.bgColor} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
    {!!props.bgImageSrc && <Field label="Background Repeat"><SelIn value={props.bgRepeat || "no-repeat"} onChange={v => patch({ bgRepeat: v })} options={BACKGROUND_REPEAT_OPTIONS} /></Field>}
    <Field label="Title Size"><NumIn value={props.titleSize ?? 28} onChange={v => patch({ titleSize: v })} min={14} max={72} unit="px" /></Field>
    <Field label="Subtitle Size"><NumIn value={props.subtitleSize ?? 16} onChange={v => patch({ subtitleSize: v })} min={10} max={40} unit="px" /></Field>
  </>;
}
function TextInspector({ blockId, props, patch, upload, edit, library, aiImage }) {
  const ensureActiveEditor = () => {
    if (activeRichTextApi?.focus) {
      activeRichTextApi.focus();
      return true;
    }
    return !!focusEditableInBlock(blockId);
  };

  const runWithEditor = (callback) => {
    ensureActiveEditor();
    const run = () => callback?.();
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(run);
    } else {
      run();
    }
  };

  const runCommand = (command, value = null) => {
    runWithEditor(() => {
      const html = activeRichTextApi?.exec?.(command, value);
      if (typeof html === "string") {
        patch({ html });
      }
    });
  };

  const applyTextSize = (value) => {
    const size = Number(value) || 18;
    runWithEditor(() => {
      const html = activeRichTextApi?.applyStyle?.({ fontSize: `${size}px` });
      patch(typeof html === "string" ? { fontSize: size, html } : { fontSize: size });
    });
  };

  const applyFontFamily = (value) => {
    runWithEditor(() => {
      const html = activeRichTextApi?.applyStyle?.({ fontFamily: value });
      patch(typeof html === "string" ? { fontFamily: value, html } : { fontFamily: value });
    });
  };

  const runListCommand = (ordered = false) => {
    runWithEditor(() => {
      const html = activeRichTextApi?.toggleList?.(ordered);
      if (typeof html === "string") {
        patch({ html });
      }
    });
  };

  const applyLink = () => {
    ensureActiveEditor();
    const url = window.prompt("Enter link URL:", "https://");
    if (!url) return;
    runWithEditor(() => {
      const html = activeRichTextApi?.exec?.("createLink", url);
      if (typeof html === "string") {
        patch({ html });
      }
    });
  };

  const clearLink = () => {
    runWithEditor(() => {
      const html = activeRichTextApi?.exec?.("unlink");
      if (typeof html === "string") {
        patch({ html });
      }
    });
  };

  const actionBtnStyle = {
    minWidth: 40,
    height: 34,
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  };
  const press = (action) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    activeRichTextApi?.focus?.();
    action();
  };

  const alignBtn = (label, value) => (
    <button
      type="button"
      onMouseDown={press(() => {
        runCommand(value === "center" ? "justifyCenter" : value === "right" ? "justifyRight" : "justifyLeft");
        patch({ align: value });
      })}
      style={{
        ...actionBtnStyle,
        minWidth: 48,
        background: props.align === value ? "#dbeafe" : "#ffffff",
        borderColor: props.align === value ? "#60a5fa" : "#cbd5e1",
      }}
    >
      {label}
    </button>
  );

  return <>
    {props.rawHtml ? (
      <div style={{ background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>
        This imported HTML layout has limited editing. Use the editable template themes for full colour and image controls.
      </div>
    ) : (
      <ImgField label="Background Image" value={props.bgImageSrc} onUpload={f => upload(f, "bgImageSrc")} onClear={() => patch({ bgImageSrc: "" })} onEdit={props.bgImageSrc ? () => edit("bgImageSrc", null, props.bgImageSrc) : null} onLibrary={() => library("bgImageSrc", null)} onAiImage={() => aiImage("bgImageSrc", null)} />
    )}
    <InlineEditHint>
      Click the text on the canvas to edit the wording directly. Use the controls below for styling.
    </InlineEditHint>
    <Field label="Formatting">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button type="button" onMouseDown={press(() => runCommand("bold"))} style={actionBtnStyle}>B</button>
        <button type="button" onMouseDown={press(() => runCommand("italic"))} style={actionBtnStyle}>I</button>
        <button type="button" onMouseDown={press(() => runCommand("underline"))} style={actionBtnStyle}>U</button>
        <button type="button" onMouseDown={press(() => runListCommand(false))} style={{ ...actionBtnStyle, minWidth: 70 }}>• List</button>
        <button type="button" onMouseDown={press(() => runListCommand(true))} style={{ ...actionBtnStyle, minWidth: 78 }}>1. List</button>
        <button type="button" onMouseDown={press(() => applyLink())} style={{ ...actionBtnStyle, minWidth: 72 }}>🔗 Link</button>
        <button type="button" onMouseDown={press(() => clearLink())} style={{ ...actionBtnStyle, minWidth: 82 }}>✕ Link</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr 84px", gap: 8, alignItems: "end" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Style</div>
          <SelIn value={props.variant || "body"} onChange={v => patch({ variant: v })} options={TEXT_VARIANT_OPTIONS} />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Font</div>
          <SelIn value={props.fontFamily || "Arial, Helvetica, sans-serif"} onChange={applyFontFamily} options={FONT_FAMILY_OPTIONS} />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Size</div>
          <SelIn value={String(props.fontSize || 18)} onChange={applyTextSize} options={TEXT_SIZE_OPTIONS} />
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Alignment</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {alignBtn("Left", "left")}
          {alignBtn("Center", "center")}
          {alignBtn("Right", "right")}
        </div>
      </div>
    </Field>
    <Field label="Background"><ColIn value={props.bgColor} onChange={v => patch({ bgColor: v })} /></Field>
    {!!props.bgImageSrc && <Field label="Background Repeat"><SelIn value={props.bgRepeat || "no-repeat"} onChange={v => patch({ bgRepeat: v })} options={BACKGROUND_REPEAT_OPTIONS} /></Field>}
  </>;
}
function ImageInspector({ props, patch, upload, edit, library, aiImage }) {
  const enableTextLayer = () => patch({
    overlayEnabled: true,
    overlayTitle: String(props.overlayTitle || "").trim() || "Click to edit headline",
    overlayText: String(props.overlayText || "").trim() || "Click to edit supporting text",
    overlayBgColor: props.overlayBgColor || "rgba(15,23,42,0.38)",
    overlayX: props.overlayX ?? 50,
    overlayY: props.overlayY ?? 50,
  });

  return <>
    <ImgField label="Image" value={props.src} onUpload={f => upload(f, "src")} onClear={() => patch({ src: "" })} onEdit={props.src ? () => edit("src", null, props.src) : null} onLibrary={() => library("src", null)} onAiImage={() => aiImage("src", null)} />
    <InlineEditHint>
      This image block now has layers: background image, text layer, and top logo or image layer.
    </InlineEditHint>
    <Field label="Layer Options">
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={enableTextLayer} style={{ flex: 1, height: 36, border: props.overlayEnabled ? "2px solid #2563eb" : "1px solid #cbd5e1", borderRadius: 8, background: props.overlayEnabled ? "#eff6ff" : "#fff", color: "#0f172a", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Text Layer On</button>
          <button type="button" onClick={() => patch({ overlayEnabled: false })} style={{ flex: 1, height: 36, border: !props.overlayEnabled ? "2px solid #2563eb" : "1px solid #cbd5e1", borderRadius: 8, background: !props.overlayEnabled ? "#eff6ff" : "#fff", color: "#0f172a", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Text Layer Off</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => { if (props.overlayImageSrc) patch({ overlayImageSrc: "" }); else library("overlayImageSrc", null); }} style={{ flex: 1, height: 36, border: props.overlayImageSrc ? "2px solid #7c3aed" : "1px solid #cbd5e1", borderRadius: 8, background: props.overlayImageSrc ? "#f5f3ff" : "#fff", color: "#0f172a", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>{props.overlayImageSrc ? "Remove Top Layer" : "Add Top Layer"}</button>
        </div>
      </div>
    </Field>
    <ImgField label="Top Layer Image / Logo" value={props.overlayImageSrc} onUpload={f => upload(f, "overlayImageSrc")} onClear={() => patch({ overlayImageSrc: "" })} onEdit={props.overlayImageSrc ? () => edit("overlayImageSrc", null, props.overlayImageSrc) : null} onLibrary={() => library("overlayImageSrc", null)} onAiImage={() => aiImage("overlayImageSrc", null)} />
    <Field label="Link URL"><TxtIn value={props.linkHref} onChange={v => patch({ linkHref: v })} placeholder="https://…" /></Field>
    <Field label="Background"><ColIn value={props.bgColor || "transparent"} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
    <Field label="Image Fit">
      <SelIn value={props.fitMode || "cover"} onChange={v => patch({ fitMode: v })} options={[{ value: "cover", label: "Full Fill" }, { value: "contain", label: "Contain" }]} />
    </Field>
    <InlineEditHint>
      Use the on-canvas drag handles to resize this image directly.
    </InlineEditHint>
    <Field label="Border Radius"><NumIn value={props.borderRadius || 0} onChange={v => patch({ borderRadius: v })} min={0} max={120} unit="px" /></Field>
    {props.overlayEnabled && (
      <>
        <Field label="Overlay Color"><OverlayColorField value={props.overlayBgColor || "rgba(15,23,42,0.38)"} onChange={v => patch({ overlayBgColor: v })} /></Field>
        <Field label="Title Size"><NumIn value={props.overlayTitleSize ?? 24} onChange={v => patch({ overlayTitleSize: v })} min={12} max={72} unit="px" /></Field>
        <Field label="Subtitle Size"><NumIn value={props.overlayTextSize ?? 14} onChange={v => patch({ overlayTextSize: v })} min={10} max={40} unit="px" /></Field>
      </>
    )}
    {!!props.overlayImageSrc && <Field label="Layer Radius"><NumIn value={props.overlayImageRadius ?? 8} onChange={v => patch({ overlayImageRadius: v })} min={0} max={80} unit="px" /></Field>}
    <Field label="Alignment">
      <SelIn value={props.align} onChange={v => patch({ align: v })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
    </Field>
  </>;
}
function ButtonInspector({ props, patch }) {
  return <>
    <InlineEditHint>
      Click the button on the canvas to edit its wording directly. Use the color controls below for the button styling.
    </InlineEditHint>
    <Field label="Link URL"><TxtIn value={props.href} onChange={v => patch({ href: v })} placeholder="https://…" /></Field>
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => patch({ bgColor: "transparent" })}
        style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
      >
        Transparent Button
      </button>
      <button
        type="button"
        onClick={() => patch({ blockBgColor: "transparent" })}
        style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
      >
        Transparent Block
      </button>
    </div>
    <Field label="Button Background"><ColIn value={props.bgColor || "#2563eb"} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
    <Field label="Block Background"><ColIn value={props.blockBgColor || "transparent"} onChange={v => patch({ blockBgColor: v })} allowTransparent /></Field>
    <Field label="Border Radius"><NumIn value={props.borderRadius ?? 8} onChange={v => patch({ borderRadius: v })} min={0} max={50} unit="px" /></Field>
    <Field label="Vertical Padding"><NumIn value={props.paddingY ?? 12} onChange={v => patch({ paddingY: v })} min={4} max={40} unit="px" /></Field>
    <Field label="Width">
      <SelIn value={props.widthMode || "auto"} onChange={v => patch({ widthMode: v })} options={[
        { value: "auto", label: "Auto (shrink to text)" },
        { value: "px", label: "Fixed width (px)" },
        { value: "full", label: "Full width" },
      ]} />
    </Field>
    {(props.widthMode === "px") && (
      <Field label="Button Width"><SlideIn value={props.widthPx ?? 200} onChange={v => patch({ widthPx: v })} min={80} max={580} unit="px" /></Field>
    )}
    <Field label="Alignment">
      <SelIn value={props.align} onChange={v => patch({ align: v })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
    </Field>
  </>;
}
function DividerInspector({ props, patch }) {
  return <>
    <Field label="Color"><ColIn value={props.color} onChange={v => patch({ color: v })} /></Field>
    <Field label="Line Style">
      <SelIn value={props.style} onChange={v => patch({ style: v })} options={[{ value: "solid", label: "Solid" }, { value: "dashed", label: "Dashed" }, { value: "dotted", label: "Dotted" }]} />
    </Field>
    <Field label="Thickness"><SlideIn value={props.thickness} onChange={v => patch({ thickness: v })} min={1} max={12} unit="px" /></Field>
    <Field label="Width"><SlideIn value={props.widthPct} onChange={v => patch({ widthPct: v })} min={10} max={100} unit="%" /></Field>
  </>;
}
function SpacerInspector({ props, patch }) {
  return <>
    <Field label="Spacer Height"><SelIn value={String(props.height || 36)} onChange={v => patch({ height: Number(v) })} options={TEXT_SIZE_OPTIONS} /></Field>
    <Field label="Background"><ColIn value={props.bgColor || "transparent"} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
  </>;
}
function HeroInspector({ props, patch, upload, edit, library, aiImage }) {
  return <>
    <ImgField label="Background Image" value={props.bgImageSrc} onUpload={f => upload(f, "bgImageSrc")} onClear={() => patch({ bgImageSrc: "" })} onEdit={props.bgImageSrc ? () => edit("bgImageSrc", null, props.bgImageSrc) : null} onLibrary={() => library("bgImageSrc", null)} onAiImage={() => aiImage("bgImageSrc", null)} />
    <ImgField label="Hero Image" value={props.imageSrc} onUpload={f => upload(f, "imageSrc")} onClear={() => patch({ imageSrc: "" })} onEdit={props.imageSrc ? () => edit("imageSrc", null, props.imageSrc) : null} onLibrary={() => library("imageSrc", null)} onAiImage={() => aiImage("imageSrc", null)} />
    <InlineEditHint>
      Edit the headline, supporting copy, and button label directly on the canvas. Keep this panel for images, links, spacing, and colours.
    </InlineEditHint>
    <Field label="Button Link"><TxtIn value={props.ctaHref} onChange={v => patch({ ctaHref: v })} placeholder="https://…" /></Field>
    <Field label="Background"><ColIn value={props.bgColor} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
    {!!props.bgImageSrc && <Field label="Background Repeat"><SelIn value={props.bgRepeat || "no-repeat"} onChange={v => patch({ bgRepeat: v })} options={BACKGROUND_REPEAT_OPTIONS} /></Field>}
    <Field label="Headline Size"><NumIn value={props.headlineSize ?? 30} onChange={v => patch({ headlineSize: v })} min={14} max={72} unit="px" /></Field>
    <Field label="Sub-text Size"><NumIn value={props.subtextSize ?? 15} onChange={v => patch({ subtextSize: v })} min={10} max={40} unit="px" /></Field>
    <Field label="Button Color"><ColIn value={props.ctaBgColor} onChange={v => patch({ ctaBgColor: v })} allowTransparent /></Field>
    <Field label="Vertical Padding"><NumIn value={props.paddingY ?? 36} onChange={v => patch({ paddingY: v })} min={8} max={100} unit="px" /></Field>
  </>;
}
function ImageTextInspector({ props, patch, upload, edit, library, aiImage }) {
  return <>
    <ImgField label="Background Image" value={props.imageSrc} onUpload={f => upload(f, "imageSrc")} onClear={() => patch({ imageSrc: "" })} onEdit={props.imageSrc ? () => edit("imageSrc", null, props.imageSrc) : null} onLibrary={() => library("imageSrc", null)} onAiImage={() => aiImage("imageSrc", null)} />
    <InlineEditHint>
      This section uses layers so you can stack text and a logo or image on top of the background.
    </InlineEditHint>
    <Field label="Layer Options">
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => library("overlayImageSrc", null)} style={{ flex: 1, height: 36, border: props.overlayImageSrc ? "2px solid #7c3aed" : "1px solid #cbd5e1", borderRadius: 8, background: props.overlayImageSrc ? "#f5f3ff" : "#fff", color: "#0f172a", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>{props.overlayImageSrc ? "Change Top Layer" : "Add Top Layer"}</button>
          {props.overlayImageSrc && <button type="button" onClick={() => patch({ overlayImageSrc: "" })} style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", color: "#0f172a", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Remove Top Layer</button>}
        </div>
      </div>
    </Field>
    <ImgField label="Top Layer Image / Logo" value={props.overlayImageSrc} onUpload={f => upload(f, "overlayImageSrc")} onClear={() => patch({ overlayImageSrc: "" })} onEdit={props.overlayImageSrc ? () => edit("overlayImageSrc", null, props.overlayImageSrc) : null} onLibrary={() => library("overlayImageSrc", null)} onAiImage={() => aiImage("overlayImageSrc", null)} />
    <Field label="Link"><TxtIn value={props.href} onChange={v => patch({ href: v })} placeholder="https://…" /></Field>
    <Field label="Headline Size"><NumIn value={props.headlineSize ?? 30} onChange={v => patch({ headlineSize: v })} min={14} max={72} unit="px" /></Field>
    <Field label="Subtitle Size"><NumIn value={props.subtextSize ?? 15} onChange={v => patch({ subtextSize: v })} min={10} max={40} unit="px" /></Field>
    <Field label="Button Color"><ColIn value={props.buttonBgColor || "#2563eb"} onChange={v => patch({ buttonBgColor: v })} allowTransparent /></Field>
    <Field label="Overlay Shade"><TxtIn value={props.overlayShade || "rgba(15,23,42,0.45)"} onChange={v => patch({ overlayShade: v })} /></Field>
    {!!props.overlayImageSrc && <Field label="Layer Radius"><NumIn value={props.overlayImageRadius ?? 8} onChange={v => patch({ overlayImageRadius: v })} min={0} max={80} unit="px" /></Field>}
    <Field label="Height"><NumIn value={props.height || 320} onChange={v => patch({ height: v })} min={180} max={600} unit="px" /></Field>
    <Field label="Alignment">
      <SelIn value={props.align || "center"} onChange={v => patch({ align: v })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
    </Field>
  </>;
}

function QuoteInspector({ props, patch, upload, edit, library, aiImage }) {
  return <>
    <ImgField label="Avatar" value={props.avatarSrc} onUpload={f => upload(f, "avatarSrc")} onClear={() => patch({ avatarSrc: "" })} onEdit={props.avatarSrc ? () => edit("avatarSrc", null, props.avatarSrc) : null} onLibrary={() => library("avatarSrc", null)} onAiImage={() => aiImage("avatarSrc", null)} />
    <InlineEditHint>
      Edit the quote, author, and role directly on the canvas. Use this panel for the avatar and visual styling.
    </InlineEditHint>
    <Field label="Background"><ColIn value={props.bgColor} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
  </>;
}

function PromoInspector({ props, patch }) {
  return <>
    <InlineEditHint>
      Edit the badge, headline, details, offer code, and button label directly on the canvas. Use this panel for colours and the link.
    </InlineEditHint>
    <Field label="Link"><TxtIn value={props.href} onChange={v => patch({ href: v })} placeholder="https://…" /></Field>
    <Field label="Background"><ColIn value={props.bgColor} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
    <Field label="Accent"><ColIn value={props.accentColor} onChange={v => patch({ accentColor: v })} /></Field>
  </>;
}

function VideoInspector({ props, patch, upload, edit, library, aiImage }) {
  return <>
    <ImgField label="Thumbnail" value={props.thumbnailSrc} onUpload={f => upload(f, "thumbnailSrc")} onClear={() => patch({ thumbnailSrc: "" })} onEdit={props.thumbnailSrc ? () => edit("thumbnailSrc", null, props.thumbnailSrc) : null} onLibrary={() => library("thumbnailSrc", null)} onAiImage={() => aiImage("thumbnailSrc", null)} />
    <InlineEditHint>
      Edit the title, caption, and button label directly on the canvas. Use this panel for the thumbnail, link, and colours.
    </InlineEditHint>
    <Field label="Video Link"><TxtIn value={props.href} onChange={v => patch({ href: v })} placeholder="https://…" /></Field>
    <Field label="Background"><ColIn value={props.bgColor} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
  </>;
}

function ContactInspector({ props, patch }) {
  return <>
    <InlineEditHint>
      Edit the contact text and button label directly on the canvas. Use this panel for the button link and visual styling.
    </InlineEditHint>
    <Field label="Button Link"><TxtIn value={props.href} onChange={v => patch({ href: v })} placeholder="https://…" /></Field>
    <Field label="Background"><ColIn value={props.bgColor} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
  </>;
}

function GridInspector({ props, patch, upload, edit, library, aiImage }) {
  const cols = props.columns || [];
  const setCol = (i, field, value) => {
    const next = cols.map((c, j) => j === i ? { ...c, [field]: value } : c);
    patch({ columns: next });
  };
  const addCol = () => patch({ columns: [...cols, { imageSrc: "", title: "New Card", text: "Description text goes here.", linkHref: "", bgColor: "transparent" }] });
  const duplicateCol = (i) => patch({ columns: [...cols.slice(0, i + 1), deepClone(cols[i]), ...cols.slice(i + 1)] });
  const removeCol = (i) => patch({ columns: cols.filter((_, j) => j !== i) });
  const makeAllCardsTransparent = () => patch({ columns: cols.map((col) => ({ ...col, bgColor: "transparent" })) });
  return <>
    <InlineEditHint>
      Edit each card title and description directly on the canvas. Use this panel for images, links, layout, and backgrounds.
    </InlineEditHint>
    <Field label="Section Background"><ColIn value={props.bgColor || "#ffffff"} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={() => patch({ bgColor: "transparent" })} style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Transparent Section</button>
          <button onClick={makeAllCardsTransparent} style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>All Cards Transparent</button>
        </div>
    <Field label="Cards Per Row">
      <SelIn value={String(props.columnsPerRow || 2)} onChange={v => patch({ columnsPerRow: Number(v) })} options={[{ value: "1", label: "1 wide" }, { value: "2", label: "2 across" }, { value: "3", label: "3 across" }, { value: "4", label: "4 across" }]} />
    </Field>
    {cols.map((col, i) => (
      <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 16, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#334155" }}>CARD {i + 1}</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => duplicateCol(i)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Copy</button>
            {cols.length > 1 && <button onClick={() => removeCol(i)} style={{ border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Remove</button>}
          </div>
        </div>
        <ImgField label="Image" value={col.imageSrc} onUpload={f => upload(f, "imageSrc_col", i)} onClear={() => setCol(i, "imageSrc", "")} onEdit={col.imageSrc ? () => edit("imageSrc_col", i, col.imageSrc) : null} onLibrary={() => library("imageSrc_col", i)} onAiImage={() => aiImage("imageSrc_col", i)} />
        <Field label="Card Background"><ColIn value={col.bgColor || "#ffffff"} onChange={v => setCol(i, "bgColor", v)} allowTransparent /></Field>
        <Field label="Link"><TxtIn value={col.linkHref} onChange={v => setCol(i, "linkHref", v)} placeholder="https://…" /></Field>
      </div>
    ))}
    <button onClick={addCol} style={{ width: "100%", height: 40, border: "1px dashed #94a3b8", borderRadius: 6, background: "#f8fafc", color: "#475569", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>+ Add Card</button>
  </>;
}
function ListInspector({ props, patch, upload, edit, library, aiImage }) {
  const items = props.items || [];
  const setItem = (i, field, value) => {
    const next = items.map((it, j) => j === i ? { ...it, [field]: value } : it);
    patch({ items: next });
  };
  const addItem = () => patch({ items: [...items, { imageSrc: "", title: "New Item", text: "Description.", linkHref: "", bgColor: "transparent" }] });
  const duplicateItem = (i) => patch({ items: [...items.slice(0, i + 1), deepClone(items[i]), ...items.slice(i + 1)] });
  const removeItem = i => patch({ items: items.filter((_, j) => j !== i) });
  const makeAllCardsTransparent = () => patch({ items: items.map((item) => ({ ...item, bgColor: "transparent" })) });
  return <>
    <InlineEditHint>
      Edit each item title and description directly on the canvas. Use this panel for images, links, layout, and backgrounds.
    </InlineEditHint>
    <Field label="Section Background"><ColIn value={props.bgColor || "#ffffff"} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <button onClick={() => patch({ bgColor: "transparent" })} style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Transparent Section</button>
      <button onClick={makeAllCardsTransparent} style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>All Cards Transparent</button>
    </div>
    <Field label="Items Per Row">
      <SelIn value={String(props.itemsPerRow || 1)} onChange={v => patch({ itemsPerRow: Number(v) })} options={[{ value: "1", label: "1 deep" }, { value: "2", label: "2 across" }, { value: "3", label: "3 across" }, { value: "4", label: "4 across" }]} />
    </Field>
    {items.map((item, i) => (
      <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 16, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#334155" }}>ITEM {i + 1}</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => duplicateItem(i)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Copy</button>
            {items.length > 1 && <button onClick={() => removeItem(i)} style={{ border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Remove</button>}
          </div>
        </div>
        <ImgField label="Image" value={item.imageSrc} onUpload={f => upload(f, "imageSrc_item", i)} onClear={() => setItem(i, "imageSrc", "")} onEdit={item.imageSrc ? () => edit("imageSrc_item", i, item.imageSrc) : null} onLibrary={() => library("imageSrc_item", i)} onAiImage={() => aiImage("imageSrc_item", i)} />
        <Field label="Card Background"><ColIn value={item.bgColor || "#ffffff"} onChange={v => setItem(i, "bgColor", v)} allowTransparent /></Field>
        <Field label="Link"><TxtIn value={item.linkHref} onChange={v => setItem(i, "linkHref", v)} placeholder="https://…" /></Field>
      </div>
    ))}
    <button onClick={addItem} style={{ width: "100%", height: 40, border: "1px dashed #94a3b8", borderRadius: 6, background: "#f8fafc", color: "#475569", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>+ Add Item</button>
  </>;
}
function GridCardInspector({ props, patch, upload, edit, library, aiImage, patchCommon, addSibling, duplicateCurrent, removeCurrent }) {
  return <>
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <button onClick={addSibling} style={{ flex: 1, height: 36, border: "1px dashed #94a3b8", borderRadius: 6, background: "#f8fafc", color: "#475569", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Add Card</button>
      <button onClick={duplicateCurrent} style={{ height: 36, border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#334155", fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "0 10px" }}>Copy</button>
      <button onClick={removeCurrent} style={{ height: 36, border: "1px solid #fecaca", borderRadius: 6, background: "#fff1f2", color: "#b91c1c", fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "0 10px" }}>Delete</button>
    </div>
    <InlineEditHint>
      Edit the card title and description directly on the canvas. Use this panel for image, link, layout, and background controls.
    </InlineEditHint>
    <Field label="Section Background"><ColIn value={props.sectionBgColor || "#ffffff"} onChange={v => patchCommon?.({ sectionBgColor: v })} allowTransparent /></Field>
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <button onClick={() => patchCommon?.({ sectionBgColor: "transparent" })} style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Transparent Section</button>
      <button onClick={() => patch({ bgColor: "transparent" })} style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Transparent Card</button>
    </div>
    <Field label="Cards Per Row"><SelIn value={String(props.perRow || 2)} onChange={v => patchCommon?.({ perRow: Number(v) })} options={[{ value: "1", label: "1 wide" }, { value: "2", label: "2 across" }, { value: "3", label: "3 across" }, { value: "4", label: "4 across" }]} /></Field>
    <ImgField label="Image" value={props.imageSrc} onUpload={f => upload(f, "imageSrc")} onClear={() => patch({ imageSrc: "" })} onEdit={props.imageSrc ? () => edit("imageSrc", null, props.imageSrc) : null} onLibrary={() => library("imageSrc", null)} onAiImage={() => aiImage("imageSrc", null)} />
    <InlineEditHint>Use the drag handles on the selected image to resize it.</InlineEditHint>
    <Field label="Card Background"><ColIn value={props.bgColor || "#ffffff"} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
    <Field label="Link"><TxtIn value={props.linkHref} onChange={v => patch({ linkHref: v })} placeholder="https://…" /></Field>
  </>;
}

function ListCardInspector({ props, patch, upload, edit, library, aiImage, patchCommon, addSibling, duplicateCurrent, removeCurrent }) {
  return <>
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <button onClick={addSibling} style={{ flex: 1, height: 36, border: "1px dashed #94a3b8", borderRadius: 6, background: "#f8fafc", color: "#475569", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Add Item</button>
      <button onClick={duplicateCurrent} style={{ height: 36, border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#334155", fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "0 10px" }}>Copy</button>
      <button onClick={removeCurrent} style={{ height: 36, border: "1px solid #fecaca", borderRadius: 6, background: "#fff1f2", color: "#b91c1c", fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "0 10px" }}>Delete</button>
    </div>
    <InlineEditHint>
      Edit the item title and description directly on the canvas. Use this panel for image, link, layout, and background controls.
    </InlineEditHint>
    <Field label="Section Background"><ColIn value={props.sectionBgColor || "#ffffff"} onChange={v => patchCommon?.({ sectionBgColor: v })} allowTransparent /></Field>
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <button onClick={() => patchCommon?.({ sectionBgColor: "transparent" })} style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Transparent Section</button>
      <button onClick={() => patch({ bgColor: "transparent" })} style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Transparent Card</button>
    </div>
    <Field label="Items Per Row"><SelIn value={String(props.perRow || 1)} onChange={v => patchCommon?.({ perRow: Number(v) })} options={[{ value: "1", label: "1 deep" }, { value: "2", label: "2 across" }, { value: "3", label: "3 across" }, { value: "4", label: "4 across" }]} /></Field>
    <ImgField label="Image" value={props.imageSrc} onUpload={f => upload(f, "imageSrc")} onClear={() => patch({ imageSrc: "" })} onEdit={props.imageSrc ? () => edit("imageSrc", null, props.imageSrc) : null} onLibrary={() => library("imageSrc", null)} onAiImage={() => aiImage("imageSrc", null)} />
    <InlineEditHint>Use the drag handles on the selected image to resize it.</InlineEditHint>
    <Field label="Card Background"><ColIn value={props.bgColor || "#ffffff"} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
    <Field label="Link"><TxtIn value={props.linkHref} onChange={v => patch({ linkHref: v })} placeholder="https://…" /></Field>
  </>;
}

function GroupedSectionInspector({ type, props, patchCommon, addSibling }) {
  const isGrid = type === "gridCard";
  return <>
    <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: "#64748b", lineHeight: 1.5 }}>
      You are editing the whole {isGrid ? "grid" : "list"} section. Click the headline on the canvas to edit its wording directly.
    </div>
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <button onClick={addSibling} style={{ flex: 1, height: 36, border: "1px dashed #94a3b8", borderRadius: 6, background: "#f8fafc", color: "#475569", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{isGrid ? "+ Add Card" : "+ Add Item"}</button>
    </div>
    <Field label="Section Background"><ColIn value={props.sectionBgColor || "#ffffff"} onChange={v => patchCommon?.({ sectionBgColor: v })} allowTransparent /></Field>
    <div style={{ marginBottom: 14 }}>
      <button onClick={() => patchCommon?.({ sectionBgColor: "transparent" })} style={{ width: "100%", height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Transparent Section</button>
    </div>
    <Field label={isGrid ? "Cards Per Row" : "Items Per Row"}>
      <SelIn value={String(props.perRow || (isGrid ? 2 : 1))} onChange={v => patchCommon?.({ perRow: Number(v) })} options={[{ value: "1", label: isGrid ? "1 wide" : "1 deep" }, { value: "2", label: "2 across" }, { value: "3", label: "3 across" }, { value: "4", label: "4 across" }]} />
    </Field>
  </>;
}

function SocialInspector({ props, patch }) {
  const plats = props.platforms || [];
  return <>
    <Field label="Background"><ColIn value={props.bgColor} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Platform Links</div>
      {plats.map((pl, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <img src={getSocialIconUrl(pl.name)} alt={pl.name} style={{ width: 22, height: 22, flexShrink: 0 }} />
          <span style={{ width: 80, fontSize: 16, color: "#334155", fontWeight: 600, textTransform: "capitalize" }}>{pl.name}</span>
          <input
            type="text" value={pl.href}
            onChange={e => {
              const next = plats.map((p, j) => j === i ? { ...p, href: e.target.value } : p);
              patch({ platforms: next });
            }}
            placeholder="https://…"
            style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 10px", fontSize: 16, fontWeight: 600, background: "#ffffff", color: "#0f172a" }}
          />
        </div>
      ))}
    </div>
  </>;
}
function FooterInspector({ props, patch }) {
  return <>
    <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>
      Edit the company name, address, and footer legal line directly on the canvas, then use the text toolbar to add separate links for items like Privacy Policy and Terms of Use.
    </div>
    <Field label="Background"><ColIn value={props.bgColor} onChange={v => patch({ bgColor: v })} allowTransparent /></Field>
  </>;
}

function CommonBlockInspector({ block, patch }) {
  if (!block) return null;

  return (
    <Field label="Block Corner Radius">
      <NumIn
        value={resolveBlockRadius(block.props || {}, defaultBlockRadius(block.type))}
        onChange={v => patch({ blockRadius: v })}
        min={0}
        max={120}
        unit="px"
      />
    </Field>
  );
}

function TextOnlyInspector({ block, patch }) {
  const props = block?.props || {};
  const linkField = block?.type === "footer"
    ? null
    : props.linkHref !== undefined
    ? "linkHref"
    : props.href !== undefined
      ? "href"
      : props.ctaHref !== undefined
        ? "ctaHref"
        : props.unsubscribeHref !== undefined
          ? "unsubscribeHref"
          : null;

  return <>
    <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>
      Use the horizontal toolbar above the canvas for full Word-style text editing.
    </div>
    {linkField && (
      <Field label="Link URL">
        <TxtIn value={props[linkField] || ""} onChange={v => patch({ [linkField]: v })} placeholder="https://…" />
      </Field>
    )}
  </>;
}

function TextRibbon({ block, patch, patchCommon, compact = false }) {
  const props = block?.props || {};
  const isRichTextBlock = block?.type === "text";
  const linkField = block?.type === "footer"
    ? null
    : props.linkHref !== undefined
    ? "linkHref"
    : props.href !== undefined
      ? "href"
      : props.ctaHref !== undefined
        ? "ctaHref"
        : props.unsubscribeHref !== undefined
          ? "unsubscribeHref"
          : null;
  const textColorField = props.textColor !== undefined
    ? "textColor"
    : props.buttonTextColor !== undefined
      ? "buttonTextColor"
      : props.ctaTextColor !== undefined
        ? "ctaTextColor"
        : null;
  const alignField = props.align !== undefined ? "align" : null;

  const contrastBg = props.bgColor || props.sectionBgColor || props.blockBgColor || props.overlayBgColor || props.overlayShade || "#ffffff";
  const rawCurrentTextColor = /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(String(props[textColorField] || "")) ? props[textColorField] : "#111827";
  const currentTextColor = ensureReadableColor(rawCurrentTextColor, contrastBg, "#ffffff", "#111827");
  const currentHighlightColor = /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(String(props.highlightColor || "")) ? props.highlightColor : "#fff59d";
  const currentBlockStyle = String(props.variant || "body").toLowerCase();
  const [matchedColors, setMatchedColors] = useState([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("email_matched_colors_v1") || "[]");
      setMatchedColors(Array.isArray(saved) ? saved.slice(0, 12) : []);
    } catch {
      setMatchedColors([]);
    }
  }, []);

  const rememberMatchedColor = (color) => {
    const nextColor = String(color || "").trim();
    if (!nextColor || nextColor === "transparent") return;
    const next = [nextColor, ...matchedColors.filter((entry) => String(entry).toLowerCase() !== nextColor.toLowerCase())].slice(0, 12);
    setMatchedColors(next);
    try {
      localStorage.setItem("email_matched_colors_v1", JSON.stringify(next));
    } catch {}
  };

  const btnStyle = {
    height: 38,
    minWidth: 36,
    borderRadius: 10,
    border: "1px solid #d6b54c",
    background: "#fffef7",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    padding: "0 10px",
    flexShrink: 0,
    whiteSpace: "nowrap",
    lineHeight: 1,
  };
  const selectStyle = {
    height: 38,
    borderRadius: 10,
    border: "1px solid #d6b54c",
    background: "#fffef7",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 800,
    padding: "0 10px",
    flexShrink: 0,
  };
  const labelStyle = {
    fontSize: 11,
    fontWeight: 900,
    color: "#854d0e",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    flexShrink: 0,
  };
  const ensureActiveEditor = () => {
    if (activeRichTextApi?.focus) {
      activeRichTextApi.focus();
      return;
    }
    if (typeof document === "undefined" || !block?.id) return;
    const rawId = String(block.id || "");
    const safeId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(rawId) : rawId.replace(/"/g, '\\"');
    const editable = document.querySelector(`[data-block-id="${safeId}"] [data-inline-editor="true"], [data-block-id="${safeId}"] [contenteditable="true"]`);
    editable?.focus?.();
  };
  const press = (action) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    ensureActiveEditor();
    const run = () => action();
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(run);
    } else {
      run();
    }
  };

  const commitHtml = (html, extra = {}) => {
    if (isRichTextBlock && typeof html === "string") {
      patch({ ...extra, html });
    } else if (Object.keys(extra).length) {
      patch(extra);
    }
  };

  const exec = (command, value = null) => {
    const html = activeRichTextApi?.exec?.(command, value);
    commitHtml(html);
  };

  const applyStyle = (styles = {}, extra = {}) => {
    const html = activeRichTextApi?.applyStyle?.(styles);
    commitHtml(html, extra);
  };

  const toggleList = (ordered = false) => {
    const html = activeRichTextApi?.toggleList?.(ordered);
    commitHtml(html);
  };

  const openLink = () => {
    const url = window.prompt("Enter a link URL:", props[linkField] || "https://");
    if (!url) return;
    if (linkField) patch({ [linkField]: url });
    exec("createLink", url);
  };

  const clearLink = () => {
    if (linkField) patch({ [linkField]: "" });
    exec("unlink");
  };

  const applyAlign = (value) => {
    if (alignField) patch({ [alignField]: value });
    applyStyle({ display: "block", textAlign: value });
  };

  const applyTextColor = (value) => {
    if (textColorField) patch({ [textColorField]: value });
    rememberMatchedColor(value);
    applyStyle({ color: value });
  };

  const applyHighlightColor = (value) => {
    const next = value || "transparent";
    rememberMatchedColor(next);
    applyStyle({ backgroundColor: next }, { highlightColor: next });
  };

  const applyFontSize = (value) => {
    const size = Number(value) || 16;
    applyStyle({ fontSize: `${size}px` }, props.fontSize !== undefined ? { fontSize: size } : {});
  };

  const applyFontFamily = (value) => {
    applyStyle({ fontFamily: value }, props.fontFamily !== undefined ? { fontFamily: value } : {});
  };

  const applyBlockFormat = (value) => {
    const nextValue = String(value || "body").toLowerCase();
    const formatMap = {
      body: { tag: "p", variant: "body" },
      headline: { tag: "div", variant: "headline" },
      h1: { tag: "h1", variant: "h1" },
      h2: { tag: "h2", variant: "h2" },
      h3: { tag: "h3", variant: "h3" },
      small: { tag: "p", variant: "small" },
    };
    const nextFormat = formatMap[nextValue] || formatMap.body;
    exec("formatBlock", nextFormat.tag);
    applyStyle(textVariantStyle(nextFormat.variant, props.fontSize || 16), props.variant !== undefined ? { variant: nextFormat.variant } : {});
  };

  return (
    <div className="email-editor-toolbar-scroll" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "nowrap", width: "100%", overflowX: "auto", overflowY: "visible", whiteSpace: "nowrap", position: "relative", zIndex: 2 }}>
      <ToolbarSelect label="Style" value={currentBlockStyle} onChange={applyBlockFormat} options={TEXT_VARIANT_OPTIONS} width={154} beforeAction={ensureActiveEditor} />
      <ToolbarSelect label="Font" value={props.fontFamily || "Arial, Helvetica, sans-serif"} onChange={applyFontFamily} options={FONT_FAMILY_OPTIONS} width={220} beforeAction={ensureActiveEditor} />
      <ToolbarSelect label="Size" value={String(props.fontSize || 16)} onChange={applyFontSize} options={TEXT_SIZE_OPTIONS} width={104} beforeAction={ensureActiveEditor} />
      <button type="button" onMouseDown={press(() => exec("bold"))} style={btnStyle}>B</button>
      <button type="button" onMouseDown={press(() => exec("italic"))} style={btnStyle}>I</button>
      <button type="button" onMouseDown={press(() => exec("underline"))} style={btnStyle}>U</button>
      <button type="button" onMouseDown={press(() => applyAlign("left"))} style={btnStyle}>⟸</button>
      <button type="button" onMouseDown={press(() => applyAlign("center"))} style={btnStyle}>≡</button>
      <button type="button" onMouseDown={press(() => applyAlign("right"))} style={btnStyle}>⟹</button>
      <button type="button" onMouseDown={press(() => toggleList(false))} style={btnStyle}>• List</button>
      <button type="button" onMouseDown={press(() => toggleList(true))} style={btnStyle}>1. List</button>
      <button type="button" onMouseDown={press(() => openLink())} style={btnStyle}>🔗 Link</button>
      <button type="button" onMouseDown={press(() => clearLink())} style={btnStyle}>✕ Link</button>
      <button type="button" onMouseDown={press(() => exec("removeFormat"))} style={btnStyle}>Clear</button>
      <ToolbarColorDropdown label="Text" value={currentTextColor} onChange={applyTextColor} onRemember={rememberMatchedColor} matchedColors={matchedColors} standardColors={TEXT_COLOR_OPTIONS} beforeAction={ensureActiveEditor} />
      <ToolbarColorDropdown label="Highlight" value={currentHighlightColor} onChange={applyHighlightColor} onRemember={rememberMatchedColor} matchedColors={matchedColors} standardColors={HIGHLIGHT_COLOR_OPTIONS} allowTransparent beforeAction={ensureActiveEditor} />
    </div>
  );
}

function FloatingTextToolbar({ visible, position, onDragStart, onClose, children }) {
  if (!visible) return null;

  return (
    <div
      data-email-text-toolbar="true"
      style={{
        position: "fixed",
        left: position?.x ?? 260,
        top: position?.y ?? 140,
        zIndex: 5000,
        width: "min(calc(100vw - 24px), 1200px)",
        padding: 0,
        borderRadius: 16,
        background: "rgba(254, 243, 199, 0.98)",
        border: "1px solid rgba(217, 119, 6, 0.45)",
        boxShadow: "0 18px 40px rgba(146, 64, 14, 0.20)",
        backdropFilter: "blur(10px)",
        overflow: "visible",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div onMouseDown={onDragStart} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "linear-gradient(180deg, #fef3c7 0%, #fde68a 100%)", borderBottom: "1px solid #f59e0b", cursor: "move", userSelect: "none" }}>
        <button
          type="button"
          onMouseDown={onDragStart}
          style={{
            height: 32,
            minWidth: 74,
            borderRadius: 9,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#334155",
            fontSize: 13,
            fontWeight: 800,
            cursor: "move",
            padding: "0 12px",
            whiteSpace: "nowrap",
          }}
          title="Move toolbar"
        >
          ⋮⋮ Move
        </button>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Text Toolbar
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose?.();
            }}
            style={{
              height: 32,
              minWidth: 56,
              borderRadius: 9,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              padding: "0 12px",
              whiteSpace: "nowrap",
            }}
          >
            Hide
          </button>
        </div>
      </div>
      <div className="email-editor-toolbar-scroll" style={{ padding: "12px 12px", overflowX: "auto", overflowY: "visible" }}>
        {children}
      </div>
    </div>
  );
}

function EmailCanvasInspector({ props, patch, upload, edit, library, aiImage }) {
  return <>
    <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>
      These tools style the whole email canvas and outer page background.
    </div>
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => patch({ outerBgColor: "transparent" })}
        style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
      >
        Transparent Page
      </button>
      <button
        type="button"
        onClick={() => patch({ canvasBgColor: "transparent" })}
        style={{ flex: 1, height: 36, border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
      >
        Transparent Canvas
      </button>
    </div>
    <Field label="Inbox Preview Text"><TxtIn value={props.preheaderText} onChange={v => patch({ preheaderText: v })} placeholder="Short preview text shown beside the subject line" /></Field>
    <ImgField label="Page Background Image" value={props.outerBgImageSrc} onUpload={f => upload(f, "outerBgImageSrc")} onClear={() => patch({ outerBgImageSrc: "" })} onEdit={props.outerBgImageSrc ? () => edit("outerBgImageSrc", null, props.outerBgImageSrc) : null} onLibrary={() => library("outerBgImageSrc", null)} onAiImage={() => aiImage("outerBgImageSrc", null)} />
    <Field label="Page Background"><ColIn value={props.outerBgColor} onChange={v => patch({ outerBgColor: v })} allowTransparent /></Field>
    {!!props.outerBgImageSrc && <Field label="Page Background Repeat"><SelIn value={props.outerBgRepeat || "no-repeat"} onChange={v => patch({ outerBgRepeat: v })} options={BACKGROUND_REPEAT_OPTIONS} /></Field>}
    <Field label="Canvas Background"><ColIn value={props.canvasBgColor} onChange={v => patch({ canvasBgColor: v })} allowTransparent /></Field>
    <Field label="Canvas Width"><NumIn value={props.canvasWidth} onChange={v => patch({ canvasWidth: v })} min={420} max={900} unit="px" /></Field>
    <Field label="Corner Radius"><NumIn value={props.canvasRadius} onChange={v => patch({ canvasRadius: v })} min={0} max={32} unit="px" /></Field>
  </>;
}

const INSPECTORS = {
  imageText: ImageTextInspector,
  quote: QuoteInspector,
  promo: PromoInspector,
  video: VideoInspector,
  contact: ContactInspector,
  header: HeaderInspector,
  text: TextInspector,
  image: ImageInspector,
  button: ButtonInspector,
  divider: DividerInspector,
  spacer: SpacerInspector,
  hero: HeroInspector,
  grid: GridInspector,
  list: ListInspector,
  gridCard: GridCardInspector,
  listCard: ListCardInspector,
  social: SocialInspector,
  footer: FooterInspector,
};

// ─────────────────────────────────────────────────────────────────
// Block catalog
// ─────────────────────────────────────────────────────────────────

const CATALOG = [
  { type: "header",  label: "Header",      icon: "🧾" },
  { type: "text",    label: "Text",         icon: "✍️" },
  { type: "image",   label: "Image",        icon: "🖼️" },
  { type: "imageText", label: "Text On Image", icon: "🏞️" },
  { type: "button",  label: "Button",       icon: "🔘" },
  { type: "divider", label: "Divider",      icon: "➖" },
  { type: "spacer",  label: "Spacer",       icon: "↕️" },
  { type: "hero",    label: "Hero Banner",  icon: "🚀" },
  { type: "quote",   label: "Quote",        icon: "💬" },
  { type: "promo",   label: "Promo Box",    icon: "🏷️" },
  { type: "video",   label: "Video CTA",    icon: "🎬" },
  { type: "contact", label: "Contact Card", icon: "📇" },
  { type: "gridCard", label: "Card Grid",   icon: "⊞" },
  { type: "listCard", label: "Card List",   icon: "☰" },
  { type: "social",  label: "Social Bar",   icon: "🌐" },
  { type: "footer",  label: "Footer",       icon: "🏁" },
];

// ─────────────────────────────────────────────────────────────────
// Small components
// ─────────────────────────────────────────────────────────────────

function ToolBtn({ onClick, children, title, danger = false }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? (danger ? "#ef4444" : "#334155") : "transparent",
        border: "none", cursor: "pointer", padding: "3px 8px", borderRadius: 4,
        fontSize: 16, fontWeight: 600,
        color: danger ? (hov ? "#fff" : "#fca5a5") : (hov ? "#fff" : "#cbd5e1"),
        transition: "background 0.1s",
      }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Canvas block wrapper (hover toolbar + selection ring)
// ─────────────────────────────────────────────────────────────────

function BlockWrapper({ block, isSelected, isFirst, isLast, onClick, onTextFocus, onUp, onDown, onDelete, onDuplicate, onSave, uploadForBlock, onDragStart, onDragEnd, onPatch }) {
  const [hov, setHov] = useState(false);
  const Renderer = CANVAS[block.type];
  const showBar = hov || isSelected;
  const blockRadius = resolveBlockRadius(block.props || {}, defaultBlockRadius(block.type));

  const getInteractiveTarget = (target) => {
    if (!(target instanceof Element)) return null;
    return target.closest('[contenteditable="true"], [data-inline-editor="true"], [data-direct-action="true"], button, input, textarea, select, a');
  };

  // onImg: called by canvas renderers when user clicks an img placeholder
  // field: the prop key to set, idx: optional column/item index
  const onImg = useCallback((field, idx = null) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = e => {
      const f = e.target.files?.[0];
      if (f) uploadForBlock(f, field, idx);
      input.remove();
    };
    input.click();
  }, [uploadForBlock]);

  return (
    <div
      data-block-id={block.id}
      draggable={!isSelected}
      onDragStart={e => {
        if (getInteractiveTarget(e.target)) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onMouseDownCapture={(e) => {
        const interactive = getInteractiveTarget(e.target);
        if (interactive?.matches?.('[contenteditable="true"], [data-inline-editor="true"]')) {
          onTextFocus?.();
          return;
        }
        if (!isSelected && !interactive) onClick?.();
      }}
      onFocusCapture={(e) => {
        const editable = e.target instanceof Element
          ? e.target.closest('[contenteditable="true"], [data-inline-editor="true"]')
          : null;
        if (editable) {
          onTextFocus?.();
        }
      }}
      onClick={(e) => {
        if (getInteractiveTarget(e.target)) return;
        onClick?.();
      }}
      title="Drag to reposition this block"
      style={{
        position: "relative",
        marginBottom: 6,
        borderRadius: Math.max(blockRadius, 8),
        cursor: isSelected ? "default" : "grab",
        outline: isSelected
          ? "2.5px solid #2563eb"
          : hov ? "1.5px solid #94a3b8" : "1.5px solid transparent",
        outlineOffset: 2,
        transition: "outline-color 0.1s",
      }}
    >
      {/* Hover/selected toolbar */}
      {showBar && (
        <div
          style={{
            position: "absolute", top: -34, right: 8,
            display: "flex", gap: 2,
            background: "#1e293b", borderRadius: 6, padding: "3px 4px",
            zIndex: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
          }}
        >
          {!isFirst && <ToolBtn onClick={onUp} title="Move up">↑</ToolBtn>}
          {!isLast && <ToolBtn onClick={onDown} title="Move down">↓</ToolBtn>}
          <ToolBtn onClick={onDuplicate} title="Duplicate">⧉</ToolBtn>
          <ToolBtn onClick={onSave} title="Save block for reuse">⭐</ToolBtn>
          <ToolBtn onClick={onDelete} title="Delete" danger>✕</ToolBtn>
        </div>
      )}

      {/* Block content — allow direct one-click editing while still selecting the block */}
      <div style={{ pointerEvents: "auto", borderRadius: blockRadius, overflow: "hidden" }}>
        {Renderer
          ? <Renderer props={block.props} onImg={onImg} onPatch={onPatch} isSelected={isSelected} />
          : <div style={{ padding: 16, background: "#fef2f2", color: "#ef4444", borderRadius: 6 }}>Unknown block: {block.type}</div>
        }
      </div>
    </div>
  );
}

function DropZone({ active = false, onDragOver, onDrop }) {
  return (
    <div
      onDragOver={e => {
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDrop={e => {
        e.preventDefault();
        onDrop?.(e);
      }}
      style={{
        height: active ? 28 : 12,
        margin: "2px 0",
        borderRadius: 10,
        background: active ? "rgba(37,99,235,0.12)" : "transparent",
        border: active ? "2px dashed #2563eb" : "2px dashed transparent",
        transition: "all 0.12s ease",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// Main EmailEditor
// ─────────────────────────────────────────────────────────────────

export default function EmailEditor({
  userId = "",
  initialBlocks = [],
  initialDocId = null,
  initialDocName = "Untitled Email",
  initialTemplateScope = "",
  initialTemplatePath = "",
  onExportHtml = null,
  onSaved = null,
  previewMode = false,
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(() =>
    normalizeBlocksForEditor(stripEmailMetaBlocks(initialBlocks.length ? deepClone(initialBlocks) : []))
  );
  const [docSettings, setDocSettings] = useState(() =>
    extractEmailSettings(initialBlocks.length ? deepClone(initialBlocks) : [])
  );
  const [selectedId, setSelectedId] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const style = document.createElement("style");
    style.setAttribute("data-email-editor-dropdown-styles", "true");
    style.textContent = `
      .email-editor-dropdown,
      .email-editor-dropdown * {
        background: #fff !important;
      }
      .email-editor-inspector input:not([type="color"]):not([type="range"]):not([type="file"]),
      .email-editor-inspector select,
      .email-editor-inspector textarea {
        background: #ffffff !important;
        color: #0f172a !important;
        border: 1px solid #cbd5e1 !important;
        -webkit-text-fill-color: #0f172a !important;
        caret-color: #0f172a !important;
        box-shadow: none !important;
      }
      .email-editor-inspector input:not([type="color"]):not([type="range"]):not([type="file"])::placeholder,
      .email-editor-inspector textarea::placeholder {
        color: #64748b !important;
        -webkit-text-fill-color: #64748b !important;
      }
      .email-editor-inspector input:not([type="color"]):not([type="range"]):not([type="file"]):focus,
      .email-editor-inspector select:focus,
      .email-editor-inspector textarea:focus {
        background: #ffffff !important;
        color: #0f172a !important;
        outline: 2px solid rgba(37, 99, 235, 0.32) !important;
        border-color: #2563eb !important;
        -webkit-text-fill-color: #0f172a !important;
      }
      .email-editor-inspector button {
        -webkit-text-fill-color: currentColor !important;
      }
      .email-editor-select,
      .email-editor-select option,
      .email-editor-select optgroup {
        background: #fffef7 !important;
        color: #0f172a !important;
      }
      .email-editor-select:focus {
        outline: 2px solid rgba(245, 158, 11, 0.45);
        outline-offset: 1px;
      }
      .email-editor-dropdown .dropdown-item:hover {
        background: #2563eb !important;
        color: #fff !important;
      }
      .email-editor-range {
        -webkit-appearance: none;
        appearance: none;
        height: 24px;
        background: transparent;
        cursor: pointer;
      }
      .email-editor-range::-webkit-slider-runnable-track {
        height: 12px;
        border-radius: 999px;
        background: linear-gradient(90deg, #1e293b 0%, #334155 100%);
        border: 1px solid rgba(148, 163, 184, 0.6);
      }
      .email-editor-range::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 24px;
        height: 24px;
        margin-top: -7px;
        border-radius: 999px;
        background: linear-gradient(180deg, #ffffff 0%, #fde68a 100%);
        border: 2px solid #b45309;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.24);
      }
      .email-editor-range::-moz-range-track {
        height: 12px;
        border-radius: 999px;
        background: linear-gradient(90deg, #1e293b 0%, #334155 100%);
        border: 1px solid rgba(148, 163, 184, 0.6);
      }
      .email-editor-range::-moz-range-thumb {
        width: 24px;
        height: 24px;
        border-radius: 999px;
        background: linear-gradient(180deg, #ffffff 0%, #fde68a 100%);
        border: 2px solid #b45309;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.24);
      }
      .email-editor-toolbar-scroll {
        scrollbar-width: auto;
        scrollbar-color: #0f172a #fde68a;
      }
      .email-editor-toolbar-scroll::-webkit-scrollbar {
        height: 16px;
        width: 16px;
      }
      .email-editor-toolbar-scroll::-webkit-scrollbar-track {
        background: rgba(245, 158, 11, 0.18);
        border-radius: 999px;
      }
      .email-editor-toolbar-scroll::-webkit-scrollbar-thumb {
        background: #0f172a;
        border-radius: 999px;
        border: 3px solid rgba(254, 243, 199, 0.98);
      }
      .email-editor-toolbar-scroll::-webkit-scrollbar-thumb:hover {
        background: #1e293b;
      }
      .email-editor-link-btn {
        background: #fff !important;
        border: 1.5px solid #2563eb !important;
        font-weight: 700;
        border-radius: 8px;
        padding: 6px 16px;
        transition: background 0.2s, color 0.2s;
      }
      .email-editor-link-btn:hover {
        background: #2563eb !important;
        color: #fff !important;
      }
    `;

    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  // ── AI modals ─────────────────────────────────────────────────
  const [showAiGenerate, setShowAiGenerate] = useState(false);
  const [aiImageState, setAiImageState] = useState(null); // { blockId, field, fieldIdx }

  const openAiImage = useCallback((blockId, field, fieldIdx) => {
    setAiImageState({ blockId, field, fieldIdx });
  }, []);

  const applyAiImage = useCallback((url) => {
    if (!aiImageState) return;
    const { blockId, field, fieldIdx } = aiImageState;

    if (blockId === "__emailSettings") {
      setDocSettings(prev => normalizeEmailSettings({ ...prev, [field]: url }));
      setAiImageState(null);
      return;
    }

    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      const p = { ...b.props };
      if (field === "imageSrc_col" && fieldIdx !== null) {
        const columns = p.columns.map((c, i) => i === fieldIdx ? { ...c, imageSrc: url } : c);
        return { ...b, props: { ...p, columns } };
      }
      if (field === "imageSrc_item" && fieldIdx !== null) {
        const items = p.items.map((it, i) => i === fieldIdx ? { ...it, imageSrc: url } : it);
        return { ...b, props: { ...p, items } };
      }
      return { ...b, props: { ...p, [field]: url } };
    }));
    setAiImageState(null);
  }, [aiImageState]);

  // ── Image library modal ───────────────────────────────────────
  const [libraryState, setLibraryState] = useState(null); // { blockId, field, fieldIdx }

  const openLibrary = useCallback((blockId, field, fieldIdx) => {
    if (!blockId || !field) return;
    setLibraryState(null);
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        setLibraryState({ blockId, field, fieldIdx: fieldIdx ?? null });
      });
      return;
    }
    setLibraryState({ blockId, field, fieldIdx: fieldIdx ?? null });
  }, []);

  const applyLibraryImage = useCallback((url) => {
    if (!libraryState) return;
    const { blockId, field, fieldIdx } = libraryState;

    if (blockId === "__emailSettings") {
      setDocSettings(prev => normalizeEmailSettings({ ...prev, [field]: url }));
      setLibraryState(null);
      return;
    }

    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      const p = { ...b.props };
      if (field === "imageSrc_col" && fieldIdx !== null) {
        const columns = p.columns.map((c, i) => i === fieldIdx ? { ...c, imageSrc: url } : c);
        return { ...b, props: { ...p, columns } };
      }
      if (field === "imageSrc_item" && fieldIdx !== null) {
        const items = p.items.map((it, i) => i === fieldIdx ? { ...it, imageSrc: url } : it);
        return { ...b, props: { ...p, items } };
      }
      return { ...b, props: { ...p, [field]: url } };
    }));
    setLibraryState(null);
  }, [libraryState]);

  // ── Image edit modal ─────────────────────────────────────────
  const [imageEditState, setImageEditState] = useState(null); // { blockId, field, fieldIdx, src }

  const openImageEdit = useCallback((blockId, field, fieldIdx, src) => {
    if (!src) return;
    setImageEditState(null);
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        setImageEditState({ blockId, field, fieldIdx: fieldIdx ?? null, src });
      });
      return;
    }
    setImageEditState({ blockId, field, fieldIdx: fieldIdx ?? null, src });
  }, []);

  const applyEditedImage = useCallback((newUrl) => {
    if (!imageEditState) return;
    const { blockId, field, fieldIdx } = imageEditState;

    if (blockId === "__emailSettings") {
      setDocSettings(prev => normalizeEmailSettings({ ...prev, [field]: newUrl }));
      setImageEditState(null);
      return;
    }

    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      const p = { ...b.props };
      if (field === "imageSrc_col" && fieldIdx !== null) {
        const columns = p.columns.map((c, i) => i === fieldIdx ? { ...c, imageSrc: newUrl } : c);
        return { ...b, props: { ...p, columns } };
      }
      if (field === "imageSrc_item" && fieldIdx !== null) {
        const items = p.items.map((it, i) => i === fieldIdx ? { ...it, imageSrc: newUrl } : it);
        return { ...b, props: { ...p, items } };
      }
      return { ...b, props: { ...p, [field]: newUrl } };
    }));
    setImageEditState(null);
  }, [imageEditState]);

  // ── Saved blocks (localStorage) ────────────────────────────────
  const [savedBlocks, setSavedBlocks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("email_saved_blocks_v2") || "[]"); } catch { return []; }
  });
  const persistSaved = useCallback((next) => {
    setSavedBlocks(next);
    localStorage.setItem("email_saved_blocks_v2", JSON.stringify(next));
  }, []);
  const saveBlock = useCallback((block) => {
    const label = window.prompt("Name this saved block:", CATALOG.find(c => c.type === block.type)?.label || block.type);
    if (!label) return;
    persistSaved([...savedBlocks, { label, block: deepClone(block) }]);
  }, [savedBlocks, persistSaved]);
  const deleteSavedBlock = useCallback((i) => {
    if (!window.confirm("Remove this saved block?")) return;
    persistSaved(savedBlocks.filter((_, idx) => idx !== i));
  }, [savedBlocks, persistSaved]);
  const insertSavedBlockAt = useCallback((entry, index = null) => {
    const b = { ...deepClone(entry.block), id: uid() };
    setBlocks(prev => {
      const arr = [...prev];
      const safeIndex = Math.max(0, Math.min(index == null ? arr.length : index, arr.length));
      arr.splice(safeIndex, 0, b);
      return arr;
    });
    setSelectedId(b.id);
  }, []);
  const insertSavedBlock = useCallback((entry) => {
    const selectedIndex = blocks.findIndex(b => b.id === selectedId);
    insertSavedBlockAt(entry, selectedIndex >= 0 ? selectedIndex + 1 : null);
  }, [blocks, selectedId, insertSavedBlockAt]);
  const [docName, setDocName] = useState(initialDocName);
  const [docId, setDocId] = useState(() => initialDocId || uid());
  const [isSaving, setIsSaving] = useState(false);
  const [templateScope, setTemplateScope] = useState(initialTemplateScope || "");
  const [templatePath, setTemplatePath] = useState(initialTemplatePath || "");
  const [toast, setToast] = useState(null);
  const [saveDialog, setSaveDialog] = useState(null);
  const [panelMode, setPanelMode] = useState("block");
  const [selectedSection, setSelectedSection] = useState(null);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [recentDocs, setRecentDocs] = useState([]);
  const [loadingRecentDocs, setLoadingRecentDocs] = useState(false);
  const [floatingTextBar, setFloatingTextBar] = useState({ visible: false, x: 360, y: 160 });
  const toastRef = useRef(null);
  const canvasRef = useRef(null);
  const fileMenuRef = useRef(null);

  useEffect(() => {
    const source = Array.isArray(initialBlocks) ? deepClone(initialBlocks) : [];
    const nextBlocks = normalizeBlocksForEditor(stripEmailMetaBlocks(source));
    setDocSettings(extractEmailSettings(source));
    setBlocks(nextBlocks);
    setSelectedId(nextBlocks[0]?.id || null);
    setSelectedSection(null);
    setDragState(null);
    setDropIndex(null);
  }, [initialBlocks]);

  useEffect(() => {
    setDocName(initialDocName || "Untitled Email");
  }, [initialDocName]);

  useEffect(() => {
    setDocId(initialDocId || uid());
  }, [initialDocId]);

  useEffect(() => {
    setTemplateScope(initialTemplateScope || "");
  }, [initialTemplateScope]);

  useEffect(() => {
    setTemplatePath(initialTemplatePath || "");
  }, [initialTemplatePath]);

  useEffect(() => {
    if (selectedId) {
      setPanelMode("block");
      setSelectedSection(null);
    }
  }, [selectedId]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const getToolbarPosition = () => {
      const canvasRect = canvasRef.current?.getBoundingClientRect?.();
      const viewportWidth = window.innerWidth || 1280;
      const viewportHeight = window.innerHeight || 900;
      const estimatedToolbarWidth = Math.min(viewportWidth - 24, 920);
      const estimatedToolbarHeight = 116;
      const safeTopMargin = 24;
      const gapAboveCanvas = 24;
      const canvasCenterX = canvasRect ? (canvasRect.left + (canvasRect.width / 2)) : (viewportWidth / 2);
      const preferredX = canvasCenterX - (estimatedToolbarWidth / 2);
      const preferredY = canvasRect
        ? Math.max(safeTopMargin, canvasRect.top - estimatedToolbarHeight - gapAboveCanvas)
        : 40;

      return {
        x: clamp(preferredX, 12, Math.max(12, viewportWidth - estimatedToolbarWidth - 12)),
        y: clamp(preferredY, safeTopMargin, Math.max(safeTopMargin, viewportHeight - estimatedToolbarHeight - 12)),
      };
    };

    const syncFloatingTextBar = () => {
      const selection = window.getSelection?.();
      const activeElement = document.activeElement;
      const anchorNode = selection?.anchorNode;
      const selectionElement = anchorNode?.nodeType === window.Node.ELEMENT_NODE ? anchorNode : anchorNode?.parentElement;
      const editable = activeElement?.closest?.('[contenteditable="true"], [data-inline-editor="true"]')
        || selectionElement?.closest?.('[contenteditable="true"], [data-inline-editor="true"]')
        || null;

      if (!editable) return;

      const toolbarPosition = getToolbarPosition();
      const blockRoot = editable.closest?.("[data-block-id]");
      const blockId = blockRoot?.getAttribute?.("data-block-id");

      if (blockId) {
        setSelectedId((prev) => (prev === blockId ? prev : blockId));
      }

      setSelectedSection(null);
      setPanelMode("block");
      setFloatingTextBar((prev) => ({ ...prev, visible: true, x: toolbarPosition.x, y: toolbarPosition.y }));
    };

    const handlePointerDown = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const inEditable = target?.closest?.('[contenteditable="true"], [data-inline-editor="true"]');
      const inToolbar = target?.closest?.('[data-email-text-toolbar="true"]');
      if (!inEditable && !inToolbar) {
        setFloatingTextBar((prev) => ({ ...prev, visible: false }));
      }
    };

    document.addEventListener("selectionchange", syncFloatingTextBar);
    document.addEventListener("focusin", syncFloatingTextBar);
    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      document.removeEventListener("selectionchange", syncFloatingTextBar);
      document.removeEventListener("focusin", syncFloatingTextBar);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, []);

  useEffect(() => {
    if (!fileMenuOpen) return;

    let live = true;
    const handleClickOutside = (event) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target)) {
        setFileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    (async () => {
      if (!userId) {
        if (live) setRecentDocs([]);
        return;
      }

      if (live) setLoadingRecentDocs(true);
      try {
        const resp = await fetch(`/api/email/builder-doc-list?userId=${encodeURIComponent(userId)}`);
        const data = await resp.json().catch(() => ({}));
        if (!live) return;
        setRecentDocs(Array.isArray(data?.docs) ? data.docs.slice(0, 4) : []);
      } catch {
        if (live) setRecentDocs([]);
      } finally {
        if (live) setLoadingRecentDocs(false);
      }
    })();

    return () => {
      live = false;
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [fileMenuOpen, userId]);

  const showToast = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const showSaveDialog = useCallback((msg, type = "ok") => {
    setSaveDialog({ msg, type });
  }, []);

  const handleAiInsert = useCallback((newBlocks, mode) => {
    const withIds = newBlocks.map(b => ({ ...b, id: uid(), props: { ...DEFAULTS[b.type], ...b.props } }));
    if (mode === "append") {
      setBlocks(prev => [...prev, ...withIds]);
    } else {
      setBlocks(withIds);
      setSelectedId(null);
    }
    showToast(`✨ ${withIds.length} blocks generated!`, "ok");
  }, [showToast]);

  // ── Block mutations ────────────────────────────────────────────
  const insertBlockAt = useCallback((type, index = null) => {
    if (type === "gridCard" || type === "listCard") {
      const groupBlocks = makeGroupedCardBlocks(type);
      setBlocks(prev => {
        const arr = [...prev];
        const safeIndex = Math.max(0, Math.min(index == null ? arr.length : index, arr.length));
        arr.splice(safeIndex, 0, ...groupBlocks);
        return arr;
      });
      setSelectedId(groupBlocks[0]?.id || null);
      return;
    }

    const b = makeBlock(type);
    setBlocks(prev => {
      const arr = [...prev];
      const safeIndex = Math.max(0, Math.min(index == null ? arr.length : index, arr.length));
      arr.splice(safeIndex, 0, b);
      return arr;
    });
    setSelectedId(b.id);
  }, []);

  const addBlock = useCallback((type) => {
    const selectedIndex = blocks.findIndex(b => b.id === selectedId);
    insertBlockAt(type, selectedIndex >= 0 ? selectedIndex + 1 : null);
  }, [blocks, selectedId, insertBlockAt]);

  const patchBlock = useCallback((id, partial) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, props: { ...b.props, ...partial } } : b));
  }, []);

  const moveBlock = useCallback((id, dir) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      const next = dir === "up" ? idx - 1 : idx + 1;
      if (idx < 0 || next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }, []);

  const moveBlockToIndex = useCallback((id, targetIndex) => {
    setBlocks(prev => {
      const fromIndex = prev.findIndex(b => b.id === id);
      if (fromIndex < 0) return prev;

      const arr = [...prev];
      const [moved] = arr.splice(fromIndex, 1);
      let safeIndex = Math.max(0, Math.min(Number(targetIndex), arr.length));
      if (fromIndex < safeIndex) safeIndex -= 1;
      arr.splice(safeIndex, 0, moved);
      return arr;
    });
    setSelectedId(id);
  }, []);

  const handleDropAtIndex = useCallback((index) => {
    if (!dragState) return;

    if (dragState.kind === "catalog" && dragState.type) {
      insertBlockAt(dragState.type, index);
    } else if (dragState.kind === "saved" && dragState.entry) {
      insertSavedBlockAt(dragState.entry, index);
    } else if (dragState.kind === "canvas" && dragState.blockId) {
      moveBlockToIndex(dragState.blockId, index);
    }

    setDropIndex(null);
    setDragState(null);
  }, [dragState, insertBlockAt, insertSavedBlockAt, moveBlockToIndex]);

  const deleteBlock = useCallback((id) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    setSelectedId(s => s === id ? null : s);
  }, []);

  const patchCommonCardProps = useCallback((groupId, type, partial) => {
    if (!groupId || !type) return;
    setBlocks(prev => prev.map((b) => (
      b.type === type && b.props?.groupId === groupId
        ? { ...b, props: { ...b.props, ...partial } }
        : b
    )));
  }, []);

  const addSiblingCardBlock = useCallback((type, currentId) => {
    let nextId = null;
    setBlocks(prev => {
      const idx = prev.findIndex((b) => b.id === currentId);
      if (idx < 0) return prev;
      const current = prev[idx];
      const groupId = current?.props?.groupId;
      let insertIndex = idx;

      while (
        insertIndex + 1 < prev.length &&
        prev[insertIndex + 1]?.type === type &&
        prev[insertIndex + 1]?.props?.groupId === groupId
      ) {
        insertIndex += 1;
      }

      const clone = {
        id: uid(),
        type,
        props: {
          ...withNormalizedBlockProps(type),
          groupId,
          sectionBgColor: current?.props?.sectionBgColor || "#ffffff",
          sectionHeadline: current?.props?.sectionHeadline || "",
          sectionSubtext: current?.props?.sectionSubtext || "",
          perRow: current?.props?.perRow || (type === "gridCard" ? 2 : 1),
          blockRadius: resolveBlockRadius(current?.props || {}, defaultBlockRadius(type)),
          bgColor: current?.props?.bgColor || "#ffffff",
          imageWidthPct: current?.props?.imageWidthPct || 100,
          imageHeightPx: current?.props?.imageHeightPx || (type === "gridCard" ? 160 : 110),
          overlayEnabled: false,
          overlayBgColor: current?.props?.overlayBgColor || "rgba(15,23,42,0.38)",
          overlayX: current?.props?.overlayX || 50,
          overlayY: current?.props?.overlayY || 50,
          imageSrc: "",
          linkHref: "",
          title: type === "gridCard" ? "New Card" : "New Item",
          text: type === "gridCard" ? "Description text goes here." : "Description here.",
        },
      };

      nextId = clone.id;
      const arr = [...prev];
      arr.splice(insertIndex + 1, 0, clone);
      return arr;
    });
    if (nextId) {
      setSelectedId(nextId);
      setSelectedSection(null);
      setPanelMode("block");
    }
  }, []);

  const duplicateBlock = useCallback((id) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx < 0) return prev;
      const clone = { ...prev[idx], id: uid(), props: deepClone(prev[idx].props) };
      const arr = [...prev];
      arr.splice(idx + 1, 0, clone);
      return arr;
    });
  }, []);

  // ── Image upload ───────────────────────────────────────────────
  const uploadImage = useCallback(async (file, blockId, field, idx = null) => {
    const safeUid = String(userId || "").trim();
    if (!safeUid) { showToast("Sign in required to upload images.", "err"); return; }
    showToast("Uploading…", "ok");
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const resp = await fetch(`/api/email/editor-images?userId=${encodeURIComponent(safeUid)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: safeUid, filename: file.name || "upload.png", base64 }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.url) throw new Error(data?.error || "Upload failed");
      const url = data.url;

      if (blockId === "__emailSettings") {
        setDocSettings(prev => normalizeEmailSettings({ ...prev, [field]: url }));
        showToast("Image uploaded!", "ok");
        return;
      }

      setBlocks(prev => prev.map(b => {
        if (b.id !== blockId) return b;
        const p = { ...b.props };

        if (field === "imageSrc_col" && idx !== null) {
          const columns = p.columns.map((c, i) => i === idx ? { ...c, imageSrc: url } : c);
          return { ...b, props: { ...p, columns } };
        }
        if (field === "imageSrc_item" && idx !== null) {
          const items = p.items.map((it, i) => i === idx ? { ...it, imageSrc: url } : it);
          return { ...b, props: { ...p, items } };
        }
        return { ...b, props: { ...p, [field]: url } };
      }));

      showToast("Image uploaded!", "ok");
    } catch (err) {
      showToast(err?.message || "Upload failed.", "err");
    }
  }, [userId, showToast]);

  // ── Thumbnail capture ──────────────────────────────────────────
  const captureThumbnail = useCallback(async (targetDocId) => {
    if (!canvasRef.current || !userId) return null;
    try {
      const h2c = (await import("html2canvas")).default;
      const cvs = await h2c(canvasRef.current, { useCORS: true, scale: 0.5, backgroundColor: "#ffffff", logging: false });
      return new Promise((resolve) => {
        cvs.toBlob(async (blob) => {
          if (!blob) return resolve(null);
          const reader = new FileReader();
          reader.onload = async (e) => {
            const base64 = e.target.result;
            try {
              const resp = await fetch(`/api/email/editor-images?userId=${encodeURIComponent(userId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, filename: `thumb-${targetDocId}.png`, base64, folder: "builder-docs" }),
              });
              const data = await resp.json().catch(() => ({}));
              resolve(data?.url || null);
            } catch { resolve(null); }
          };
          reader.readAsDataURL(blob);
        }, "image/png");
      });
    } catch (e) {
      console.warn("Thumbnail capture failed:", e);
      return null;
    }
  }, [userId]);

  // ── Save ───────────────────────────────────────────────────────
  const saveDoc = useCallback(async () => {
    if (!userId) {
      const message = "Sign in required to save.";
      showToast(message, "err");
      showSaveDialog(message, "err");
      return;
    }
    setIsSaving(true);
    try {
      // If this editor was opened from an existing template path, save back in place.
      if (!docId && templatePath) {
        const html = exportFullHtml(blocks, docName, docSettings);
        const resp = await fetch("/api/email/save-base-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            name: docName,
            html,
            path: templatePath,
            scope: templateScope || "public",
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data?.ok) throw new Error(data?.error || "Save failed");
        if (data?.path) setTemplatePath(data.path);
        if (data?.scope) setTemplateScope(data.scope);
        showToast("Template saved in place!", "ok");
        showSaveDialog("Your email template was saved successfully.", "ok");
        return;
      }

      const thumbUrl = await captureThumbnail(docId);
      const resp = await fetch("/api/email/builder-doc-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, docId, name: docName, blocks: packBlocksForSave(blocks, docSettings), html: exportFullHtml(blocks, docName, docSettings), thumbUrl }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!data.ok) throw new Error(data.error || "Save failed");
      showToast("Saved!", "ok");
      showSaveDialog(`Saved successfully as "${docName}".`, "ok");
      onSaved?.(docId, docName);
    } catch (err) {
      const message = err?.message || "Save failed.";
      showToast(message, "err");
      showSaveDialog(message, "err");
    } finally {
      setIsSaving(false);
    }
  }, [userId, docId, docName, blocks, docSettings, showToast, onSaved, captureThumbnail, templatePath, templateScope]);

  // ── Save As ────────────────────────────────────────────────────
  const saveAs = useCallback(async () => {
    if (!userId) {
      const message = "Sign in required to save a copy.";
      showToast(message, "err");
      showSaveDialog(message, "err");
      return;
    }
    const newName = window.prompt("Save a copy as:", (docName || "Email") + " Copy");
    if (!newName) return;
    const newId = uid();
    setIsSaving(true);
    try {
      const thumbUrl = await captureThumbnail(newId);
      const resp = await fetch("/api/email/builder-doc-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, docId: newId, name: newName, blocks: packBlocksForSave(blocks, docSettings), html: exportFullHtml(blocks, newName, docSettings), thumbUrl }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!data.ok) throw new Error(data.error || "Save failed");
      setDocId(newId);
      setDocName(newName);
      // Update URL without reload so the user edits the new copy
      const url = new URL(window.location.href);
      url.searchParams.set("id", newId);
      window.history.replaceState({}, "", url.toString());
      showToast(`Saved as "${newName}"!`, "ok");
      showSaveDialog(`Your file was saved properly as "${newName}".`, "ok");
      onSaved?.(newId, newName);
    } catch (err) {
      const message = err?.message || "Save As failed.";
      showToast(message, "err");
      showSaveDialog(message, "err");
    } finally {
      setIsSaving(false);
    }
  }, [userId, docId, docName, blocks, docSettings, showToast, onSaved, captureThumbnail]);

  // ── Export ─────────────────────────────────────────────────────
  const openRecentDoc = useCallback((nextDocId) => {
    if (!nextDocId) return;
    setFileMenuOpen(false);
    router.push(`/modules/email/editor?id=${encodeURIComponent(nextDocId)}`);
  }, [router]);

  const doExport = useCallback(() => {
    const html = exportFullHtml(blocks, docName, docSettings);
    if (onExportHtml) { onExportHtml(html); return; }
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(docName || "email").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("HTML downloaded!", "ok");
  }, [blocks, docName, docSettings, onExportHtml, showToast]);

  // ── Copy HTML ──────────────────────────────────────────────────
  const copyHtml = useCallback(() => {
    const html = exportFullHtml(blocks, docName, docSettings);
    navigator.clipboard?.writeText(html).then(() => showToast("HTML copied!", "ok")).catch(() => showToast("Copy failed — use Export instead.", "err"));
  }, [blocks, docName, docSettings, showToast]);

  const openPreviewPage = useCallback(() => {
    try {
      const html = exportFullHtml(blocks, docName, docSettings);
      const blob = new Blob([html], { type: "text/html" });
      const previewUrl = URL.createObjectURL(blob);
      const previewWindow = window.open(previewUrl, "_blank");
      if (!previewWindow) {
        URL.revokeObjectURL(previewUrl);
        showToast("Allow popups to open the preview.", "err");
        return;
      }
      setTimeout(() => URL.revokeObjectURL(previewUrl), 60000);
    } catch {
      showToast("Preview could not be opened.", "err");
    }
  }, [blocks, docName, docSettings, showToast]);

  const startTextToolbarDrag = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const originX = floatingTextBar.x;
    const originY = floatingTextBar.y;

    const handleMove = (moveEvent) => {
      const nextX = clamp(originX + (moveEvent.clientX - startX), 12, (window.innerWidth || 1280) - 120);
      const nextY = clamp(originY + (moveEvent.clientY - startY), 12, (window.innerHeight || 900) - 56);
      setFloatingTextBar((prev) => ({ ...prev, visible: true, x: nextX, y: nextY }));
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [floatingTextBar.x, floatingTextBar.y]);


  // Preview mode: render only exported HTML, no overlays/toolbars
  if (previewMode) {
    const html = exportFullHtml(blocks, docName, docSettings);
    return (
      <div style={{ width: "100vw", minHeight: "100vh", background: "#e0f0fa" }}>
        <iframe
          title="Email Preview"
          srcDoc={html}
          style={{ width: "100%", minHeight: "100vh", border: "none", background: "#e0f0fa" }}
          sandbox="allow-same-origin"
        />
      </div>
    );
  }

  const selectedBlock = blocks.find(b => b.id === selectedId) ?? null;
  const selectedSectionBlock = selectedSection
    ? blocks.find(b => isCardBlockType(b.type) && b.props?.groupId === selectedSection.groupId) ?? null
    : null;
  const isLegacyHtmlMode = blocks.length === 1 && blocks[0]?.type === "text" && blocks[0]?.props?.rawHtml;
  const renderGroups = [];

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (isCardBlockType(block?.type) && block?.props?.groupId) {
      const grouped = [block];
      const startIndex = i;
      while (
        i + 1 < blocks.length &&
        blocks[i + 1]?.type === block.type &&
        blocks[i + 1]?.props?.groupId === block.props.groupId
      ) {
        grouped.push(blocks[i + 1]);
        i += 1;
      }
      renderGroups.push({ kind: "group", blocks: grouped, startIndex });
    } else {
      renderGroups.push({ kind: "single", block, startIndex: i });
    }
  }

  return (
    <div className="email-editor-shell" style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "Inter,system-ui,Arial,sans-serif", background: "#e0f0fa", overflowY: "auto", overflowX: "hidden" }}>
      <style>{`
        .email-editor-shell,
        .email-editor-shell input,
        .email-editor-shell select,
        .email-editor-shell textarea,
        .email-editor-shell button {
          color-scheme: light;
        }

        .email-editor-shell input:not([type="color"]):not([type="range"]):not([type="file"]),
        .email-editor-shell select,
        .email-editor-shell textarea {
          -webkit-text-fill-color: currentColor;
        }

        .email-editor-shell input:-webkit-autofill,
        .email-editor-shell textarea:-webkit-autofill,
        .email-editor-shell select:-webkit-autofill {
          -webkit-text-fill-color: #0f172a;
          box-shadow: 0 0 0 1000px #ffffff inset;
          transition: background-color 9999s ease-out 0s;
        }

        .email-editor-inspector,
        .email-editor-inspector input,
        .email-editor-inspector select,
        .email-editor-inspector textarea,
        .email-editor-inspector button {
          color-scheme: light;
        }

        .email-editor-inspector input:not([type="color"]):not([type="range"]):not([type="file"]),
        .email-editor-inspector select,
        .email-editor-inspector textarea {
          background: #ffffff;
          color: #0f172a;
          -webkit-text-fill-color: #0f172a;
          caret-color: #0f172a;
        }

        .email-editor-inspector button {
          color: #0f172a;
        }

        .email-editor-inspector input::placeholder,
        .email-editor-inspector textarea::placeholder {
          color: #64748b;
          -webkit-text-fill-color: #64748b;
        }
      `}</style>
      {imageEditState && (
        <ImageEditModal
          src={imageEditState.src}
          userId={userId}
          onDone={applyEditedImage}
          onCancel={() => setImageEditState(null)}
        />
      )}
      {showAiGenerate && (
        <AiGenerateModal
          userId={userId}
          onClose={() => setShowAiGenerate(false)}
          onInsert={handleAiInsert}
        />
      )}
      {aiImageState && (
        <AiImageModal
          userId={userId}
          onClose={() => setAiImageState(null)}
          onSelect={applyAiImage}
        />
      )}
      {libraryState && (
        <ImageLibraryModal
          userId={userId}
          onPick={applyLibraryImage}
          onClose={() => setLibraryState(null)}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, background: toast.type === "err" ? "#ef4444" : "#16a34a",
          color: "#fff", padding: "10px 22px", borderRadius: 8,
          fontWeight: 600, fontSize: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.22)",
          pointerEvents: "none",
        }}>
          {toast.msg}
        </div>
      )}
      {saveDialog && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "min(100%, 420px)", background: "#fff", borderRadius: 14, boxShadow: "0 20px 60px rgba(15,23,42,0.24)", overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", background: saveDialog.type === "err" ? "#fff1f2" : "#ecfdf5", color: saveDialog.type === "err" ? "#b91c1c" : "#166534", fontSize: 16, fontWeight: 800 }}>
              {saveDialog.type === "err" ? "Save Problem" : "Save Complete"}
            </div>
            <div style={{ padding: 16, color: "#0f172a", fontSize: 15, fontWeight: 600, lineHeight: 1.6 }}>
              {saveDialog.msg}
            </div>
            <div style={{ padding: "0 16px 16px", display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setSaveDialog(null)} style={{ height: 38, padding: "0 16px", border: "none", borderRadius: 8, background: "#2563eb", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAGE BANNER ── */}
      <div style={{ padding: "24px 32px 0", flexShrink: 0 }}>
      <div style={{ background: "linear-gradient(135deg, #0a5c38 0%, #052b1b 100%)", borderRadius: 18, padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1320, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <b style={{ fontSize: 48, fontWeight: "normal" }}>💌</b>
          <div>
            <h1 style={{ color: "#fff", fontSize: 48, fontWeight: 600, margin: 0, lineHeight: 1.05 }}>Email Editor</h1>
            <h2 style={{ color: "rgba(255,255,255,0.85)", fontSize: 18, fontWeight: 600, margin: "4px 0 0" }}>Design and send beautiful email campaigns</h2>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div ref={fileMenuRef} style={{ position: "relative", flexShrink: 0 }}>
            <TopBtn onClick={() => setFileMenuOpen(v => !v)} color="#0f172a">📁 File ▾</TopBtn>
            {fileMenuOpen && (
              <div style={{ position: "absolute", top: 44, right: 0, width: 290, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12, boxShadow: "0 18px 36px rgba(15,23,42,0.18)", overflow: "hidden", zIndex: 60 }}>
                <div style={{ padding: "10px 12px", fontSize: 12, fontWeight: 800, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>File</div>
                <FileMenuItem onClick={() => { setFileMenuOpen(false); setShowAiGenerate(true); }}>✨ AI Generate</FileMenuItem>
                <FileMenuItem onClick={() => { setFileMenuOpen(false); saveDoc(); }} disabled={isSaving}>{isSaving ? "Saving…" : "💾 Save"}</FileMenuItem>
                <FileMenuItem onClick={() => { setFileMenuOpen(false); saveAs(); }} disabled={isSaving}>📄 Save As</FileMenuItem>
                <FileMenuItem onClick={() => { setFileMenuOpen(false); doExport(); }}>⬇ Export HTML</FileMenuItem>
                <FileMenuItem onClick={() => { setFileMenuOpen(false); copyHtml(); }}>📋 Copy HTML</FileMenuItem>

                <div style={{ padding: "10px 12px", fontSize: 12, fontWeight: 800, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", background: "#f8fafc", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>Recent Files</div>
                {loadingRecentDocs ? (
                  <div style={{ padding: "12px", fontSize: 14, color: "#64748b" }}>Loading recent files…</div>
                ) : recentDocs.length ? (
                  recentDocs.map((doc) => (
                    <button
                      key={doc.docId}
                      type="button"
                      onClick={() => openRecentDoc(doc.docId)}
                      style={{ width: "100%", border: "none", background: "#fff", padding: "10px 12px", textAlign: "left", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}
                      title={doc.name || "Untitled Email"}
                    >
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.name || "Untitled Email"}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{doc.updatedAt ? new Date(doc.updatedAt).toLocaleString() : "Saved file"}</div>
                    </button>
                  ))
                ) : (
                  <div style={{ padding: "12px", fontSize: 14, color: "#64748b" }}>No recent saved files yet.</div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => router.push('/modules/email/templates/select')}
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "2px solid rgba(255,255,255,0.4)", borderRadius: 10, padding: "10px 20px", fontSize: 16, fontWeight: 700, cursor: "pointer" }}
          >← Back</button>
        </div>
      </div>
      </div>

      {/* ── PANELS ── */}
      <div style={{ flex: 1, display: "flex", maxWidth: isLegacyHtmlMode ? 1500 : 1320, width: "100%", margin: "16px auto 0", overflow: "hidden", borderRadius: "16px 16px 0 0", boxShadow: "0 -2px 20px rgba(0,0,0,0.08)" }}>
      {/* ── LEFT: block catalog ── */}
      <div style={{ width: 196, flexShrink: 0, background: "#0f172a", display: "flex", flexDirection: "column", borderRight: "1px solid #1e293b", overflow: "hidden", borderRadius: "16px 0 0 0" }}>
        <div style={{ padding: "14px 16px 8px", fontSize: 16, fontWeight: 600, color: "#05f5f9", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          + Add Or Drag Blocks
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {CATALOG.map(c => (
            <CatalogBtn
              key={c.type}
              icon={c.icon}
              label={c.label}
              onClick={() => addBlock(c.type)}
              onDragStart={() => setDragState({ kind: "catalog", type: c.type })}
              onDragEnd={() => { setDragState(null); setDropIndex(null); }}
            />
          ))}

          {/* Saved blocks section */}
          {savedBlocks.length > 0 && (
            <>
              <div style={{ padding: "12px 14px 6px", fontSize: 20, fontWeight: 600, color: "#f9ae00", letterSpacing: "0.12em", textTransform: "uppercase", borderTop: "1px solid #1e293b", marginTop: 8 }}>
                Saved
              </div>
              {savedBlocks.map((entry, i) => (
                <SavedBtn
                  key={i}
                  label={entry.label}
                  onInsert={() => insertSavedBlock(entry)}
                  onDelete={() => deleteSavedBlock(i)}
                  onDragStart={() => setDragState({ kind: "saved", entry })}
                  onDragEnd={() => { setDragState(null); setDropIndex(null); }}
                />
              ))}
            </>
          )}
          {savedBlocks.length === 0 && (
            <div style={{ padding: "14px", fontSize: 18, color: "#0068f9", borderTop: "1px solid #1e293b", marginTop: 8 }}>
              Click or drag blocks into the canvas, then save favorites for reuse
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: canvas ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 16px",
          background: "#fff", borderBottom: "1px solid #e2e8f0", flexShrink: 0,
        }}>
          <input
            value={docName}
            onChange={e => setDocName(e.target.value)}
            style={{ flex: 1, height: 40, border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, padding: "0 12px", fontSize: 16, fontWeight: 600, color: "#ffffff", background: "#0f172a", WebkitTextFillColor: "#ffffff", colorScheme: "dark", minWidth: 0 }}
            placeholder="Email name…"
          />
          <TopBtn onClick={() => { setSelectedId(null); setSelectedSection(null); setPanelMode("canvas"); openPreviewPage(); }} color="#7c3aed">Preview Email</TopBtn>
          <TopBtn onClick={() => { setSelectedId(null); setSelectedSection(null); setPanelMode("canvas"); }} color="#0f766e">🎨 Email Style</TopBtn>
        </div>
        <FloatingTextToolbar
          visible={!!selectedBlock && !!floatingTextBar.visible}
          position={floatingTextBar}
          onDragStart={startTextToolbarDrag}
          onClose={() => setFloatingTextBar((prev) => ({ ...prev, visible: false }))}
        >
          {selectedBlock ? (
            <TextRibbon
              block={selectedBlock}
              patch={partial => patchBlock(selectedBlock.id, partial)}
              patchCommon={partial => patchCommonCardProps(selectedBlock.props?.groupId, selectedBlock.type, partial)}
              compact
            />
          ) : null}
        </FloatingTextToolbar>

        {/* Scrollable canvas */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isLegacyHtmlMode ? "16px" : "28px 0",
            background: docSettings.outerBgColor || "transparent",
            backgroundImage: docSettings.outerBgImageSrc ? `linear-gradient(rgba(255,255,255,0.2), rgba(255,255,255,0.2)), url(${docSettings.outerBgImageSrc})` : undefined,
            backgroundSize: docSettings.outerBgRepeat === "no-repeat" ? "cover" : "auto",
            backgroundPosition: "center",
            backgroundRepeat: docSettings.outerBgRepeat || "no-repeat",
          }}
          onClick={e => { if (e.target === e.currentTarget) { setSelectedId(null); setPanelMode("canvas"); } }}
        >
          <div ref={canvasRef} style={{ width: isLegacyHtmlMode ? "min(100%, 1100px)" : docSettings.canvasWidth, margin: "0 auto", paddingBottom: 60, background: docSettings.canvasBgColor || "transparent", borderRadius: docSettings.canvasRadius, boxShadow: isLegacyHtmlMode || docSettings.canvasBgColor === "transparent" ? "none" : "0 12px 30px rgba(15,23,42,0.12)", overflow: "hidden" }}>
            {blocks.length === 0 && (
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setDropIndex(0);
                }}
                onDrop={e => {
                  e.preventDefault();
                  handleDropAtIndex(0);
                }}
                style={{
                  textAlign: "center",
                  color: "#1d6ad6",
                  padding: "80px 20px",
                  border: dropIndex === 0 ? "2px dashed #2563eb" : "2px dashed #cbd5e1",
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 600,
                  background: dropIndex === 0 ? "rgba(37,99,235,0.08)" : "transparent",
                }}
              >
                Drag blocks here or click from the left panel
              </div>
            )}
            {renderGroups.map((entry, groupIdx) => {
              const groupSelected = entry.kind === "group" && (
                entry.blocks.some((block) => block.id === selectedId) ||
                (panelMode === "section" && selectedSection?.groupId === entry.blocks[0]?.props?.groupId)
              );
              const groupPerRow = entry.kind === "group"
                ? Math.max(1, Math.min(4, Number(entry.blocks[0]?.props?.perRow || (entry.blocks[0]?.type === "gridCard" ? 2 : 1))))
                : 1;
              return (
              <div key={entry.kind === "group" ? `${entry.blocks[0]?.props?.groupId}-${groupIdx}` : entry.block.id}>
                <DropZone
                  active={dropIndex === entry.startIndex}
                  onDragOver={() => setDropIndex(entry.startIndex)}
                  onDrop={() => handleDropAtIndex(entry.startIndex)}
                />
                {entry.kind === "single" ? (
                  <BlockWrapper
                    block={entry.block}
                    isSelected={entry.block.id === selectedId}
                    isFirst={entry.startIndex === 0}
                    isLast={entry.startIndex === blocks.length - 1}
                    onClick={() => setSelectedId(entry.block.id)}
                    onTextFocus={() => { setSelectedId(entry.block.id); setPanelMode("block"); setSelectedSection(null); }}
                    onUp={() => moveBlock(entry.block.id, "up")}
                    onDown={() => moveBlock(entry.block.id, "down")}
                    onDelete={() => deleteBlock(entry.block.id)}
                    onDuplicate={() => duplicateBlock(entry.block.id)}
                    onSave={() => saveBlock(entry.block)}
                    onDragStart={() => setDragState({ kind: "canvas", blockId: entry.block.id })}
                    onDragEnd={() => { setDragState(null); setDropIndex(null); }}
                    onPatch={(partial) => patchBlock(entry.block.id, partial)}
                    uploadForBlock={(file, field, i) => uploadImage(file, entry.block.id, field, i)}
                  />
                ) : (
                  <div
                    onClick={(e) => {
                      if (e.target === e.currentTarget) {
                        setSelectedId(null);
                        setSelectedSection({ groupId: entry.blocks[0]?.props?.groupId, type: entry.blocks[0]?.type });
                        setPanelMode("section");
                      }
                    }}
                    title="Click this section background to edit grid/list colours"
                    style={{
                      position: "relative",
                      background: entry.blocks[0]?.props?.sectionBgColor || "#ffffff",
                      borderRadius: 14,
                      padding: "42px 10px 10px",
                      outline: groupSelected ? "2px solid #2563eb" : "1px dashed rgba(148,163,184,0.45)",
                      outlineOffset: 2,
                      cursor: "pointer",
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(null);
                        setSelectedSection({ groupId: entry.blocks[0]?.props?.groupId, type: entry.blocks[0]?.type });
                        setPanelMode("section");
                      }}
                      style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        border: "1px solid #93c5fd",
                        borderRadius: 999,
                        background: groupSelected ? "#dbeafe" : "rgba(255,255,255,0.96)",
                        color: "#1d4ed8",
                        fontSize: 12,
                        fontWeight: 800,
                        padding: "6px 10px",
                        cursor: "pointer",
                        zIndex: 2,
                      }}
                    >
                      🎨 Edit Section Background
                    </button>
                    {((groupSelected || entry.blocks[0]?.props?.sectionHeadline || entry.blocks[0]?.props?.sectionSubtext) ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(entry.blocks[0]?.id || null);
                          setSelectedSection(null);
                          setPanelMode("block");
                        }}
                        style={{ width: "100%", padding: "0 8px 10px", textAlign: "center" }}
                      >
                        <InlineEditableText
                          as="div"
                          value={entry.blocks[0]?.props?.sectionHeadline}
                          onChange={(v) => patchCommonCardProps(entry.blocks[0]?.props?.groupId, entry.blocks[0]?.type, { sectionHeadline: v })}
                          placeholder="Click to add section headline"
                          style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2, color: ensureReadableColor("", entry.blocks[0]?.props?.sectionBgColor || "#ffffff", "#ffffff", "#0f172a"), marginBottom: entry.blocks[0]?.props?.sectionSubtext ? 6 : 0 }}
                        />
                        {(groupSelected || entry.blocks[0]?.props?.sectionSubtext) && (
                          <InlineEditableText
                            value={entry.blocks[0]?.props?.sectionSubtext}
                            onChange={(v) => patchCommonCardProps(entry.blocks[0]?.props?.groupId, entry.blocks[0]?.type, { sectionSubtext: v })}
                            placeholder="Optional intro text"
                            style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5, color: ensureReadableColor("", entry.blocks[0]?.props?.sectionBgColor || "#ffffff", "#e5e7eb", "#475569") }}
                          />
                        )}
                      </div>
                    ) : null)}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${groupPerRow}, minmax(0, 1fr))`,
                        gap: 12,
                        width: "100%",
                        alignItems: "start",
                      }}
                    >
                    {entry.blocks.map((block) => {
                      return (
                        <div key={block.id} style={{ minWidth: 0 }}>
                          <BlockWrapper
                            block={block}
                            isSelected={block.id === selectedId}
                            isFirst={false}
                            isLast={false}
                            onClick={() => setSelectedId(block.id)}
                            onTextFocus={() => { setSelectedId(block.id); setPanelMode("block"); setSelectedSection(null); }}
                            onUp={() => moveBlock(block.id, "up")}
                            onDown={() => moveBlock(block.id, "down")}
                            onDelete={() => deleteBlock(block.id)}
                            onDuplicate={() => duplicateBlock(block.id)}
                            onSave={() => saveBlock(block)}
                            onDragStart={() => setDragState({ kind: "canvas", blockId: block.id })}
                            onDragEnd={() => { setDragState(null); setDropIndex(null); }}
                            onPatch={(partial) => patchBlock(block.id, partial)}
                            uploadForBlock={(file, field, i) => uploadImage(file, block.id, field, i)}
                          />
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>
              );
            })}
            {blocks.length > 0 && (
              <DropZone
                active={dropIndex === blocks.length}
                onDragOver={() => setDropIndex(blocks.length)}
                onDrop={() => handleDropAtIndex(blocks.length)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT: inspector ── */}
      <div className="email-editor-inspector" style={{ width: 296, flexShrink: 0, background: "#fff", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden", color: "#0f172a" }}>
        {selectedSectionBlock && panelMode === "section" ? (
          <>
            <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 18 }}>🧩</span>
              <span style={{ fontWeight: 600, fontSize: 16, color: "#0f172a" }}>{selectedSectionBlock.type === "gridCard" ? "Grid Section" : "List Section"}</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 80px" }}>
              <GroupedSectionInspector
                type={selectedSectionBlock.type}
                props={selectedSectionBlock.props}
                patchCommon={partial => patchCommonCardProps(selectedSectionBlock.props?.groupId, selectedSectionBlock.type, partial)}
                addSibling={() => addSiblingCardBlock(selectedSectionBlock.type, selectedSectionBlock.id)}
              />
            </div>
          </>
        ) : selectedBlock && panelMode === "text" ? (
          <>
            <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 18 }}>✍️</span>
              <span style={{ fontWeight: 600, fontSize: 16, color: "#0f172a" }}>Text Editor</span>
              <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "#64748b" }}>Focused text only</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 80px" }}>
              <TextOnlyInspector
                block={selectedBlock}
                patch={partial => patchBlock(selectedBlock.id, partial)}
                patchCommon={partial => patchCommonCardProps(selectedBlock.props?.groupId, selectedBlock.type, partial)}
              />
            </div>
          </>
        ) : selectedBlock && panelMode === "block" ? (
          <>
            <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 18 }}>{CATALOG.find(c => c.type === selectedBlock.type)?.icon}</span>
              <span style={{ fontWeight: 600, fontSize: 16, color: "#0f172a", textTransform: "capitalize" }}>{selectedBlock.type}</span>
              <span style={{ marginLeft: "auto", fontSize: 16, fontWeight: 600, color: "#94a3b8" }}>Block {blocks.indexOf(selectedBlock) + 1} of {blocks.length}</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 80px" }}>
              {(() => {
                const Panel = INSPECTORS[selectedBlock.type];
                if (!Panel) return <div style={{ color: "#ef4444", fontSize: 16, fontWeight: 600 }}>No inspector for {selectedBlock.type}</div>;
                return (
                  <>
                    <CommonBlockInspector
                      block={selectedBlock}
                      patch={partial => patchBlock(selectedBlock.id, partial)}
                    />
                    <Panel
                      blockId={selectedBlock.id}
                      props={selectedBlock.props}
                      patch={partial => patchBlock(selectedBlock.id, partial)}
                      patchCommon={partial => patchCommonCardProps(selectedBlock.props?.groupId, selectedBlock.type, partial)}
                      addSibling={() => addSiblingCardBlock(selectedBlock.type, selectedBlock.id)}
                      duplicateCurrent={() => duplicateBlock(selectedBlock.id)}
                      removeCurrent={() => deleteBlock(selectedBlock.id)}
                      upload={(file, field, idx) => uploadImage(file, selectedBlock.id, field, idx)}
                      edit={(field, idx, src) => openImageEdit(selectedBlock.id, field, idx, src)}
                      library={(field, idx) => openLibrary(selectedBlock.id, field, idx)}
                      aiImage={(field, idx) => openAiImage(selectedBlock.id, field, idx)}
                    />
                  </>
                );
              })()}
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 18 }}>🎨</span>
              <span style={{ fontWeight: 600, fontSize: 16, color: "#0f172a" }}>Email Canvas</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 80px" }}>
              <div style={{ color: "#64748b", fontSize: 14, fontWeight: 700, marginBottom: 12, lineHeight: 1.5 }}>
                Click empty space or use Email Style to edit the whole email background and canvas look.
              </div>
              <EmailCanvasInspector
                props={docSettings}
                patch={partial => setDocSettings(prev => normalizeEmailSettings({ ...prev, ...partial }))}
                upload={(file, field, idx) => uploadImage(file, "__emailSettings", field, idx)}
                edit={(field, idx, src) => openImageEdit("__emailSettings", field, idx, src)}
                library={(field, idx) => openLibrary("__emailSettings", field, idx)}
                aiImage={(field, idx) => openAiImage("__emailSettings", field, idx)}
              />
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Small UI helpers
// ─────────────────────────────────────────────────────────────────

function CatalogBtn({ icon, label, onClick, onDragStart, onDragEnd }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = "copy";
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Click to add or drag onto the email"
      style={{
        display: "flex", alignItems: "center", gap: 9,
        width: "100%", padding: "10px 16px",
        background: hov ? "#1e40af" : "transparent",
        border: "none", color: hov ? "#fff" : "#cbd5e1",
        cursor: "grab", fontSize: 16, fontWeight: 600, textAlign: "left", borderRadius: 0,
        transition: "background 0.15s, color 0.15s",
      }}
    >
      <span style={{ fontSize: 17 }}>{icon}</span>
      {label}
    </button>
  );
}

function SavedBtn({ label, onInsert, onDelete, onDragStart, onDragEnd }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center",
        background: hov ? "#1e293b" : "transparent",
        transition: "background 0.1s",
      }}
    >
      <button
        draggable
        onDragStart={e => {
          e.dataTransfer.effectAllowed = "copy";
          onDragStart?.();
        }}
        onDragEnd={() => onDragEnd?.()}
        onClick={onInsert}
        style={{
          flex: 1, padding: "8px 14px", background: "none", border: "none",
          color: hov ? "#fbbf24" : "#78716c", cursor: "grab",
          fontSize: 16, fontWeight: 600, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}
        title={`Insert or drag: ${label}`}
      >
        ⭐ {label}
      </button>
      <button
        onClick={onDelete}
        title="Remove saved block"
        style={{
          background: "none", border: "none", color: "#6b7280", cursor: "pointer",
          fontSize: 16, fontWeight: 600, padding: "0 10px 0 0", flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

function FileMenuItem({ onClick, disabled = false, children }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%",
        border: "none",
        borderBottom: "1px solid #f1f5f9",
        background: hov && !disabled ? "#f8fafc" : "#ffffff",
        padding: "10px 12px",
        textAlign: "left",
        cursor: disabled ? "default" : "pointer",
        fontSize: 14,
        fontWeight: 700,
        color: "#0f172a",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

function TopBtn({ onClick, disabled = false, color = "#2563eb", children }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 36, padding: "0 14px",
        background: hov ? color : color + "dd",
        color: "#fff", border: "none", borderRadius: 7,
        fontSize: 16, fontWeight: 600, cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.65 : 1, whiteSpace: "nowrap",
        transition: "opacity 0.1s",
      }}
    >
      {children}
    </button>
  );
}
