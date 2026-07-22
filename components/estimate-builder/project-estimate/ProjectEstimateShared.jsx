import { projectEstimateStyles as styles } from "./luxuryProjectEstimateStyles";

export function luxuryBackground(imageUrl, opacity = 0.6) {
  const fallback = "linear-gradient(135deg, #07111f 0%, #12243a 55%, #3f321c 100%)";
  if (!imageUrl) return fallback;
  return `linear-gradient(rgba(7,17,31,${opacity}), rgba(7,17,31,${opacity})), url(${imageUrl})`;
}

export function LuxuryLogo({ logo, builderName, light = false }) {
  return (
    <div style={styles.luxuryLogoLockup}>
      {logo ? <img src={logo} alt={builderName} style={styles.luxuryLogoImage} /> : <div style={styles.luxuryLogoMark}>GR8</div>}
      <strong style={{ color: light ? "#fff" : "#0f172a" }}>{builderName}</strong>
    </div>
  );
}

export function LuxuryMasterPageHeader({ logo, builderName, title, accent, light = false }) {
  return (
    <header style={styles.luxuryPageHeader}>
      <LuxuryLogo logo={logo} builderName={builderName} light={light} />
      <div style={{ ...styles.luxuryHeaderTitle, color: light ? "#fff" : "#0f172a" }}>
        <span style={{ color: accent }}>{title}</span>
      </div>
    </header>
  );
}

export function LuxuryInfoCard({ item, accent, compact = false }) {
  return (
    <div style={{ ...styles.luxuryInfoCard, ...(compact ? styles.luxuryEstimateSummaryInfoCard : {}) }}>
      <span style={{ ...styles.luxuryInfoIcon, color: accent }}>{item.icon}</span>
      <small>{item.label}</small>
      <strong>{item.value}</strong>
      {item.detail ? <span style={styles.luxuryInfoDetail}>{item.detail}</span> : null}
    </div>
  );
}

export function LuxuryImageFrame({ src, label, wide = false, tall = false, deep = false }) {
  return src ? (
    <img src={src} alt={label} style={{ ...styles.luxuryImageFrame, ...(wide ? styles.luxuryImageFrameWide : {}), ...(tall ? styles.luxuryImageFrameTall : {}), ...(deep ? styles.luxuryImageFrameDeep : {}) }} />
  ) : (
    <div style={{ ...styles.luxuryImagePlaceholder, ...(wide ? styles.luxuryImageFrameWide : {}), ...(tall ? styles.luxuryImageFrameTall : {}), ...(deep ? styles.luxuryImageFrameDeep : {}) }}>{label}</div>
  );
}

export function nativeProjectEstimateTextProps(blockId, contentKey, editorBridge = {}) {
  const block = editorBridge.blockById?.[blockId] || {};
  const editMode = !!editorBridge?.editMode;
  const selected = editorBridge.selectedBlockId === blockId;
  const isLinkedProjectField = block.type === "quote_field";
  const editing = editMode && editorBridge.editingBlockId === blockId && !isLinkedProjectField;
  const design = block.design || {};
  const parentGroupId = design.parentGroupId || "";
  const designStyle = projectEstimateNativeDesignStyle(design, { ignoreFrameOverrides: projectEstimateTextUsesParentResize(block) });
  const baseProps = {
    "data-project-estimate-native-element": blockId,
    "data-project-estimate-content-key": contentKey,
    ...(editMode ? { contentEditable: editing, suppressContentEditableWarning: true, tabIndex: 0 } : {}),
    style: {
      ...designStyle,
      boxSizing: "border-box",
      whiteSpace: "normal",
      overflowWrap: "break-word",
      wordBreak: "normal",
      pointerEvents: editMode ? "auto" : undefined,
      outline: "none",
      cursor: editing ? "text" : editMode ? "pointer" : undefined,
      borderRadius: 3,
    },
  };
  if (!editMode) return baseProps;
  return {
    ...baseProps,
    onMouseDown: (event) => {
      event.stopPropagation();
      editorBridge.onSelectBlock?.(parentGroupId || blockId);
      if (!parentGroupId) editorBridge.onEditBlock?.("");
      if (process.env.NODE_ENV !== "production") {
        console.info("[Project Estimate editor] Clicked object", {
          pageId: editorBridge.pageId || "",
          objectId: parentGroupId || blockId,
          childTextId: parentGroupId ? blockId : "",
          type: block.type || "text",
          visible: block.design?.hidden !== true,
          locked: block.design?.locked === true,
          zIndex: block.design?.zIndex || block.order || 0,
        });
      }
    },
    onDoubleClick: (event) => {
      event.stopPropagation();
      const target = event.currentTarget;
      editorBridge.onSelectBlock?.(parentGroupId || blockId);
      if (isLinkedProjectField) return;
      editorBridge.onEditBlock?.(blockId);
      requestAnimationFrame(() => placeCaretAtEnd(target));
    },
    onBlur: (event) => {
      if (!editing) return;
      if (event.relatedTarget?.closest?.('[data-project-estimate-text-toolbar="true"], [data-text-toolbar="true"]')) return;
      editorBridge.onTextCommit?.(blockId, contentKey, projectEstimateCleanEditableHtml(event.currentTarget.innerHTML));
      editorBridge.onEditBlock?.("");
    },
    onKeyDown: (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        editorBridge.onTextCommit?.(blockId, contentKey, projectEstimateCleanEditableHtml(event.currentTarget.innerHTML));
        event.currentTarget.blur();
        editorBridge.onEditBlock?.("");
      }
    },
    onKeyUp: () => editorBridge.onPreserveSelection?.(),
    onMouseUp: () => editorBridge.onPreserveSelection?.(),
  };
}

export function projectEstimateRichTextProps(blockId, contentKey, value, editorBridge = {}) {
  const nativeProps = nativeProjectEstimateTextProps(blockId, contentKey, editorBridge);
  return {
    ...nativeProps,
    dangerouslySetInnerHTML: { __html: projectEstimateSanitizedRichHtml(value) },
  };
}

export function nativeProjectEstimateGroupProps(blockId, editorBridge = {}) {
  const block = editorBridge.blockById?.[blockId] || {};
  const editMode = !!editorBridge?.editMode;
  const selected = editorBridge.selectedBlockId === blockId;
  const designStyle = projectEstimateNativeDesignStyle(block.design || {});
  const baseProps = {
    "data-project-estimate-native-group": blockId,
    ...(editMode ? { tabIndex: 0 } : {}),
    style: {
      ...designStyle,
      boxSizing: "border-box",
      cursor: editMode ? (selected ? "move" : "pointer") : undefined,
    },
  };
  if (!editMode) return baseProps;
  return {
    ...baseProps,
    onMouseDown: (event) => {
      event.stopPropagation();
      editorBridge.onSelectBlock?.(blockId);
      editorBridge.onEditBlock?.("");
    },
  };
}

export function nativeProjectEstimateImageProps(blockId, editorBridge = {}) {
  const block = editorBridge.blockById?.[blockId] || {};
  const editMode = !!editorBridge?.editMode;
  const selected = editorBridge.selectedBlockId === blockId;
  const baseProps = {
    "data-project-estimate-native-element": blockId,
    style: {
      ...projectEstimateNativeDesignStyle(block.design || {}),
      outline: "none",
      cursor: editMode ? (selected ? "move" : "pointer") : undefined,
    },
  };
  if (!editMode) return baseProps;
  return {
    ...baseProps,
    onMouseDown: (event) => {
      event.stopPropagation();
      editorBridge.onSelectBlock?.(blockId);
      if (process.env.NODE_ENV !== "production") {
        console.info("[Project Estimate editor] Clicked object", {
          pageId: editorBridge.pageId || "",
          objectId: blockId,
          type: block.type || "image",
          visible: block.design?.hidden !== true,
          locked: block.design?.locked === true,
          zIndex: block.design?.zIndex || block.order || 0,
        });
      }
    },
    onDoubleClick: (event) => {
      event.stopPropagation();
      editorBridge.onSelectBlock?.(blockId);
      editorBridge.onReplaceImage?.(block);
    },
  };
}

function projectEstimateNativeDesignStyle(design = {}, options = {}) {
  const translateX = Number(design.translateX || 0);
  const translateY = Number(design.translateY || 0);
  return {
    ...(!options.ignoreFrameOverrides && (translateX || translateY) ? { transform: `translate(${translateX}px, ${translateY}px)` } : {}),
    ...(!options.ignoreFrameOverrides && design.widthOverride ? { width: Number(design.widthOverride) } : {}),
    ...(!options.ignoreFrameOverrides && design.heightOverride ? { minHeight: Number(design.heightOverride) } : {}),
    ...(design.zIndex !== undefined ? { position: "relative", zIndex: Number(design.zIndex || 0) } : {}),
    ...(design.color ? { color: design.color } : {}),
    ...(design.fontFamily ? { fontFamily: design.fontFamily } : {}),
    ...(design.fontSize ? { fontSize: Number(design.fontSize) } : {}),
    ...(design.fontWeight ? { fontWeight: Number(design.fontWeight) } : {}),
    ...(design.fontStyle ? { fontStyle: design.fontStyle } : {}),
    ...(design.textDecoration ? { textDecoration: design.textDecoration } : {}),
    ...(design.textAlign ? { textAlign: design.textAlign } : {}),
    ...(design.lineHeight ? { lineHeight: design.lineHeight } : {}),
    ...(design.letterSpacing !== undefined ? { letterSpacing: Number(design.letterSpacing) } : {}),
    ...(design.opacity !== undefined ? { opacity: Number(design.opacity) } : {}),
    ...(design.backgroundColor ? { backgroundColor: design.backgroundColor } : {}),
  };
}

const PROJECT_ESTIMATE_FREE_TEXT_PARENT_GROUP_IDS = new Set([
  "estimateSummary-intro-section",
  "about-top-section",
  "pricing-hero-panel",
]);

export function projectEstimateTextUsesParentResize(block = {}) {
  const parentGroupId = block?.design?.parentGroupId;
  if (!parentGroupId) return false;
  if (block.type === "quote_field") return true;
  return !PROJECT_ESTIMATE_FREE_TEXT_PARENT_GROUP_IDS.has(parentGroupId);
}

export function projectEstimateCleanEditableHtml(value = "") {
  return projectEstimateSanitizedRichHtml(value)
    .replace(/<p>\s*<\/p>/gi, "")
    .trim();
}

export function projectEstimateSanitizedRichHtml(value = "") {
  const normalized = projectEstimateDecodeMalformedHtml(String(value ?? ""));
  if (!projectEstimateLooksLikeHtml(normalized)) return escapeProjectEstimateHtml(normalized).replace(/\r?\n/g, "<br>");
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return projectEstimateFlattenParagraphShells(normalized
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ""));
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${normalized}</div>`, "text/html");
  doc.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach((node) => node.remove());
  doc.body.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const val = String(attribute.value || "");
      if (name.startsWith("on") || /javascript:/i.test(val)) node.removeAttribute(attribute.name);
      if (name === "style") {
        const safeStyle = val
          .split(";")
          .map((entry) => entry.trim())
          .filter((entry) => /^(color|background-color|font-weight|font-style|text-decoration|text-align|font-family|font-size|line-height)\s*:/i.test(entry) && !/javascript:/i.test(entry))
          .join("; ");
        if (safeStyle) node.setAttribute("style", safeStyle);
        else node.removeAttribute("style");
      }
    });
  });
  return projectEstimateFlattenParagraphShells(doc.body.firstElementChild?.innerHTML || "");
}

function projectEstimateDecodeMalformedHtml(value = "") {
  const trimmed = String(value || "");
  if (!/&lt;\/?[a-z][\s\S]*?&gt;/i.test(trimmed)) return trimmed;
  const textarea = typeof document !== "undefined" ? document.createElement("textarea") : null;
  if (!textarea) {
    return trimmed
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
  }
  textarea.innerHTML = trimmed;
  return textarea.value;
}

function projectEstimateLooksLikeHtml(value = "") {
  return /<\/?[a-z][\s\S]*?>/i.test(String(value || ""));
}

function projectEstimateFlattenParagraphShells(html = "") {
  return String(html || "")
    .replace(/^\s*<p(?:\s[^>]*)?>/i, "")
    .replace(/<\/p>\s*$/i, "")
    .replace(/<\/p>\s*<p(?:\s[^>]*)?>/gi, "<br>");
}

function escapeProjectEstimateHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function placeCaretAtEnd(target) {
  const selection = window.getSelection?.();
  const range = document.createRange?.();
  if (!selection || !range || !target) return;
  range.selectNodeContents(target);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export { styles };
