export function applyDefaultAnchorStyles(root, { color = "", textDecoration = "inherit" } = {}) {
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

export function withDefaultAnchorStyles(html = "", options = {}) {
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

export function focusEditableInBlock(blockId) {
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

export function wrapRootContents(root, element) {
  if (!root || !element || typeof document === "undefined") return null;
  element.innerHTML = root.innerHTML || "&#8203;";
  root.innerHTML = "";
  root.appendChild(element);
  return element;
}

export function ensureRangeInRoot(root, restoreSelection) {
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

export function runRichTextCommand(root, restoreSelection, rememberSelection, commit, command, value = null, normalize) {
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
