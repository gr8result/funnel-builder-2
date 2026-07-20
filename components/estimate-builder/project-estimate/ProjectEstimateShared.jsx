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
  if (!editorBridge?.editMode) return {};
  const block = editorBridge.blockById?.[blockId] || {};
  const selected = editorBridge.selectedBlockId === blockId;
  const editing = editorBridge.editingBlockId === blockId;
  const design = block.design || {};
  const designStyle = projectEstimateNativeDesignStyle(design);
  return {
    "data-project-estimate-native-element": blockId,
    contentEditable: editing,
    suppressContentEditableWarning: true,
    tabIndex: 0,
    onMouseDown: (event) => {
      event.stopPropagation();
      editorBridge.onSelectBlock?.(blockId);
      if (process.env.NODE_ENV !== "production") {
        console.info("[Project Estimate editor] Clicked object", {
          pageId: editorBridge.pageId || "",
          objectId: blockId,
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
      editorBridge.onSelectBlock?.(blockId);
      editorBridge.onEditBlock?.(blockId);
      requestAnimationFrame(() => placeCaretAtEnd(target));
    },
    onBlur: (event) => {
      if (!editing) return;
      editorBridge.onTextCommit?.(blockId, contentKey, String(event.currentTarget.innerText || "").trim());
      editorBridge.onEditBlock?.("");
    },
    onKeyDown: (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.currentTarget.blur();
        editorBridge.onEditBlock?.("");
      }
    },
    style: {
      ...designStyle,
      outline: selected ? "1px solid #38bdf8" : "none",
      cursor: editing ? "text" : "pointer",
      borderRadius: 3,
    },
  };
}

export function nativeProjectEstimateImageProps(blockId, editorBridge = {}) {
  if (!editorBridge?.editMode) return {};
  const block = editorBridge.blockById?.[blockId] || {};
  const selected = editorBridge.selectedBlockId === blockId;
  return {
    "data-project-estimate-native-element": blockId,
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
    style: {
      outline: selected ? "1px solid #38bdf8" : "none",
      cursor: selected ? "move" : "pointer",
    },
  };
}

function projectEstimateNativeDesignStyle(design = {}) {
  const frame = design.frameEdited && design.frame ? {
    position: "absolute",
    left: Number(design.frame.x || 0),
    top: Number(design.frame.y || 0),
    width: Number(design.frame.width || 0) || undefined,
    minHeight: Number(design.frame.height || 0) || undefined,
    zIndex: Number(design.zIndex || 5),
    boxSizing: "border-box",
  } : {};
  return {
    ...frame,
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
