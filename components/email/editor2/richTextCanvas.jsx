import { useRef, useEffect, useState, useCallback } from "react";
import { ensureRangeInRoot, wrapRootContents, runRichTextCommand, applyDefaultAnchorStyles } from "./richTextCommands.js";
import { ensureReadableColor } from "./colors.js";
import { clamp } from "./editorUtils.js";
import { ResizeHandle } from "./canvasControls.jsx";

export let activeRichTextApi = null;

export function textVariantStyle(variant = "body", fontSize = 18) {
  const size = Number(fontSize) || 18;
  switch (variant) {
    case "headline":
      return { fontSize: size, fontWeight: 600, lineHeight: 1.15 };
    case "h1":
      return { fontSize: size, fontWeight: 600, lineHeight: 1.2 };
    case "h2":
      return { fontSize: size, fontWeight: 600, lineHeight: 1.25 };
    case "h3":
      return { fontSize: size, fontWeight: 600, lineHeight: 1.3 };
    case "small":
      return { fontSize: size, fontWeight: 500, lineHeight: 1.6 };
    case "body":
    default:
      return { fontSize: size, fontWeight: 500, lineHeight: 1.6 };
  }
}

export function InlineEditableText({ as = "div", value = "", onChange, style = {}, placeholder = "Text", normalize = null }) {
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
        commit();
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

export function RichTextCanvas({ props, onPatch, isSelected }) {
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
            commit();
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
