import React, { useRef, useState, useEffect } from "react";
import { styles } from "./pbStyles";
import { BlockDefinitions, BlockTypes } from "../../../lib/website-builder/pageBlockComponents";
import { supportsFullWidthBackground, isFullWidthBackgroundEnabled, parsePixelValue, supportsSectionHeight } from "./pbEditorUtils";
import { isBlockVisibleOnDevice } from "../../../lib/website-builder/responsiveValue";
import { renderWebsiteBlock } from "../WebsiteBlockRenderer";

export class BlockPreviewBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== "undefined") {
      console.error("Website builder block preview failed", {
        blockId: this.props.block?.id,
        blockType: this.props.block?.type,
        error,
        info,
      });
    }
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && (prevProps.block !== this.props.block || prevProps.resetKey !== this.props.resetKey)) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      const message = this.state.error?.message || "This block could not be rendered.";
      return (
        <div style={styles.blockPreviewError}>
          <strong style={styles.blockPreviewErrorTitle}>
            {this.props.label || "Block preview failed"}
          </strong>
          <span style={styles.blockPreviewErrorText}>
            {[
              this.props.pageName ? `Page: ${this.props.pageName}` : "",
              this.props.block?.id ? `Block ID: ${this.props.block.id}` : "",
              this.props.block?.type ? `Type: ${this.props.block.type}` : "",
              message,
            ].filter(Boolean).join(" | ")}
          </span>
        </div>
      );
    }

    return this.props.children;
  }
}

export const CanvasBlockPreview = React.memo(function CanvasBlockPreview({ block, index, brandAssets, onChange, onUploadImage, onUploadLayerImage, onSelectAsset, replayToken, compact, device, selected, layoutWidth }) {
  return renderBlockPreview(block, brandAssets, {
    compact,
    device,
    layoutWidth,
    animationPreview: Number(replayToken || 0) > 0,
    isSelected: selected,
    onChangeBlock: typeof onChange === "function" ? (nextProps) => onChange(index, nextProps) : undefined,
    onUploadImage: (key, file) => onUploadImage?.(index, key, file),
    onUploadLayerImage: (layerIndex, file) => onUploadLayerImage?.(index, layerIndex, file),
    onSelectAsset: (key, asset) => onSelectAsset?.(index, key, asset),
  });
}, (prev, next) => (
  prev.block === next.block
  && prev.index === next.index
  && prev.brandAssets === next.brandAssets
  && prev.replayToken === next.replayToken
  && prev.compact === next.compact
  && prev.device === next.device
  && prev.selected === next.selected
  && prev.layoutWidth === next.layoutWidth
));

export const CanvasBlock = ({ block, index, activePage = "", onSelect, onHover, selected, hovered, onDelete, onDuplicate, onEdit, onAnimate, onChange, onResizeHeight, onUploadImage, onUploadLayerImage, onSelectAsset, brandAssets, onBlockDragOver, onBlockDrop, animationReplayToken, onMoveStep, onMoveToTop, onSaveAsGlobal, onSaveBlockDefault, compactPreview, device, pageCanvasWidth, pageFullWidth = false, frameBackground = "transparent", canvasScale = 1, activeDragIndex = null, onBlockDragStart, onBlockDragEnd, onColumnSlotDrop, allowHoverOverlay = true, readOnly = false }) => {
  const def = BlockDefinitions[block.type];
  const showOverlay = !readOnly && (selected || (allowHoverOverlay && hovered));
  const resizeStateRef = useRef(null);
  const actionBarRef = useRef(null);
  const [actionBarHeight, setActionBarHeight] = useState(42);
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const isDragTarget = false;
  const stickyMode = String(block?.props?.stickyMode || "normal");
  const isStickyNavBlock = block?.type === "nav-bar" && stickyMode !== "normal";
  const canStretchFullWidth = supportsFullWidthBackground(block?.type);
  const isStretchToCanvasGrid = !compactPreview && block?.type === "grid-section" && block?.props?.stretchToCanvas === true;
  const isFullWidthBlock = !compactPreview && ((canStretchFullWidth && isFullWidthBackgroundEnabled(block)) || isStretchToCanvasGrid);
  const isPageFullWidthBlock = !compactPreview && pageFullWidth;
  // Hidden-on-this-device blocks still render in the editor (dimmed, with a badge) so they stay
  // selectable and can be un-hidden -- only real visitors (WebsitePreviewSurface / the published
  // site) actually skip rendering them.
  const isHiddenForDevice = device && device !== "desktop" && !isBlockVisibleOnDevice(block?.props, device);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const current = resizeStateRef.current;
      if (!current) return;
      const delta = (event.clientY - current.startY) / (current.canvasScale || 1);
      const nextHeight = Math.max(160, Math.round(current.startHeight + delta));
      onResizeHeight?.(index, nextHeight);
    };

    const handlePointerUp = () => {
      resizeStateRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("mouseup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [index, onResizeHeight]);

  // The selection toolbar overlays the top of the block (position: absolute) rather than
  // pushing it down in normal flow, so `blockPreview` reserves space for it via paddingTop.
  // A static reserve only covers a single button row; in tablet/mobile preview the narrower
  // block width forces the toolbar to wrap onto 2-4 rows, and a static reserve then leaves
  // the extra rows sitting on top of the block's real content. Measure the toolbar's actual
  // rendered height instead so the reserve always matches, at any preview width.
  useEffect(() => {
    if (!showOverlay) return undefined;
    const node = actionBarRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => setActionBarHeight(Math.ceil(node.getBoundingClientRect().height || 0));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [showOverlay, compactPreview, block?.type]);

  const startHeightResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      startY: event.clientY,
      startHeight: parsePixelValue(block?.props?.minHeight, block?.type === BlockTypes.HERO ? 420 : 280),
      canvasScale,
    };
  };

  const isEditingVideoHero = selected && block?.type === BlockTypes.VIDEO_HERO;
  const shouldIgnoreSelectionPointer = (target) => !!target?.closest?.(
    "button,input,select,textarea,label,[contenteditable='true'],[data-no-canvas-drag='true'],[data-builder-block-controls='true'],[data-wb-tiptap-toolbar='true'],.wb-tiptap-shell"
  );

  return (
    <div
      style={{
        ...styles.canvasBlock,
        width: "100%",
        maxWidth: (isPageFullWidthBlock || isFullWidthBlock) ? "none" : `${pageCanvasWidth}px`,
        margin: "0 auto",
        background: frameBackground,
        border: "none",
        outline: "none",
        boxShadow: "none",
        opacity: isHiddenForDevice ? 0.4 : 1,
        ...((block?.type === "columns-2" || block?.type === "columns-3" || block?.type === "grid-section") ? { padding: 0, background: block?.props?.backgroundColor || "transparent", border: "none", borderRadius: 0, boxShadow: "none" } : {}),
        ...(block?.type === "space" ? (() => {
          const sp    = block.props || {};
          const spColor = String(sp.backgroundColor || "").trim().toLowerCase();
          const defaultWhiteSpacer = spColor === "" || spColor === "#fff" || spColor === "#ffffff" || spColor === "white" || spColor === "rgb(255, 255, 255)";
          const spBg  = sp.backgroundStyle === "color"    ? (defaultWhiteSpacer ? "transparent" : sp.backgroundColor)
                      : sp.backgroundStyle === "gradient" ? sp.backgroundGradient || "transparent"
                      : sp.backgroundStyle === "image" && sp.backgroundImage
                          ? `url(${JSON.stringify(sp.backgroundImage)}) ${sp.backgroundPosition || "center center"} / ${sp.backgroundSize || "cover"} no-repeat`
                      : "repeating-linear-gradient(45deg,rgba(99,102,241,0.08) 0,rgba(99,102,241,0.08) 1px,transparent 0,transparent 50%) 0 0 / 8px 8px";
          return { padding: 0, background: spBg, border: "none", borderRadius: 0, outline: selected || hovered ? "1px solid rgba(14,165,233,0.65)" : "none", minHeight: Number(String(sp.height || "40").replace("px", "")) || 40, boxShadow: "none" };
        })() : {}),
        ...(hovered && !selected ? styles.canvasBlockHovered : {}),
        ...(selected && block?.type !== "columns-2" && block?.type !== "columns-3" && block?.type !== "grid-section" && block?.type !== "space" ? styles.canvasBlockSelected : {}),
        ...(selected && (block?.type === "columns-2" || block?.type === "columns-3" || block?.type === "grid-section") ? { outline: "2px solid #0ea5e9" } : {}),
      }}
      data-canvas-block-index={index}
      data-builder-block-active={showOverlay ? "true" : "false"}
      data-builder-block-selected={selected ? "true" : "false"}
      draggable={!readOnly && !isEditingVideoHero}
      onPointerDownCapture={(e) => {
        if (readOnly) return;
        if (shouldIgnoreSelectionPointer(e.target)) return;
        onSelect(index);
      }}
      onDragStart={(e) => {
        if (readOnly) {
          e.preventDefault();
          return;
        }
        if (e.target?.closest?.("button,input,select,textarea,label,[data-no-canvas-drag='true']")) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("existingBlockIndex", String(index));
        onBlockDragStart?.(index);
      }}
      onDragEnd={() => {
        setHoveredSlot(null);
        onBlockDragEnd?.();
      }}
      onClick={(e) => {
        if (readOnly) return;
        if (shouldIgnoreSelectionPointer(e.target)) return;
        onSelect(index);
      }}
      onMouseEnter={() => { if (!readOnly) onHover?.(index); }}
      onMouseLeave={() => { if (!readOnly) onHover?.(null); }}
      onDragOver={(e) => {
        if (readOnly) return;
        if (activeDragIndex !== null) return; // column slot overlay handles this
        onBlockDragOver(e, index);
      }}
      onDrop={(e) => {
        if (readOnly) return;
        if (activeDragIndex !== null) return;
        onBlockDrop(e, index);
      }}
    >
      {showOverlay ? (
        <div ref={actionBarRef} style={{ ...styles.blockActionBar, ...(compactPreview ? styles.blockActionBarCompact : {}) }} data-builder-block-controls="true">
          <div style={styles.blockActionLeft}>
            <span style={{ ...styles.blockActionLabel, ...(compactPreview ? styles.blockActionLabelCompact : {}) }}>{def?.name || block.type}</span>
          </div>
          <div style={styles.blockActionButtons}>
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("existingBlockIndex", String(index));
                onBlockDragStart?.(index);
              }}
              style={{ ...styles.blockActionBtnIcon, ...(compactPreview ? styles.blockActionBtnIconCompact : {}), cursor: "grab", touchAction: "none" }}
              title="Drag to reorder or drop into a column"
              aria-label="Drag block"
            >
              ⠿
            </button>
            {!compactPreview ? (
              <button
                type="button"
                style={styles.blockActionBtnIcon}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveToTop?.(index);
                }}
                title="Move to top"
                aria-label="Move to top"
              >
                ⇡
              </button>
            ) : null}
            <button
              type="button"
              style={{ ...styles.blockActionBtnIcon, ...(compactPreview ? styles.blockActionBtnIconCompact : {}) }}
              onClick={(e) => {
                e.stopPropagation();
                onMoveStep?.(index, -1);
              }}
              title="Move up"
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              style={{ ...styles.blockActionBtnIcon, ...(compactPreview ? styles.blockActionBtnIconCompact : {}) }}
              onClick={(e) => {
                e.stopPropagation();
                onMoveStep?.(index, 1);
              }}
              title="Move down"
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              style={{ ...styles.blockActionBtn, ...(compactPreview ? styles.blockActionBtnCompact : {}) }}
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(index, e.currentTarget);
              }}
              title="Open editor"
            >
              Edit
            </button>
            {!compactPreview ? (
              <button
                type="button"
                style={styles.blockActionBtnIcon}
                onClick={(e) => {
                  e.stopPropagation();
                  onAnimate?.(index, e.currentTarget);
                }}
                title="Animation settings"
                aria-label="Animation settings"
              >
                🕘
              </button>
            ) : null}
            <button
              type="button"
              style={{ ...styles.blockActionBtnIcon, ...(compactPreview ? styles.blockActionBtnIconCompact : {}) }}
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(index);
              }}
              title="Duplicate"
              aria-label="Duplicate"
            >
              ⧉
            </button>
            <button
              type="button"
              style={{ ...styles.blockActionBtnIcon, ...(compactPreview ? styles.blockActionBtnIconCompact : {}), ...styles.blockActionBtnDanger }}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(index);
              }}
              title="Delete"
              aria-label="Delete"
            >
              🗑
            </button>
            {!compactPreview && onSaveAsGlobal && block?.type === BlockTypes.NAV_BAR ? (
              <>
                <button
                  type="button"
                  style={{ ...styles.blockActionBtn, background: "#1e3a5f", color: "#7dd3fc", border: "1px solid #2563eb", fontSize: 16, padding: "2px 7px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSaveAsGlobal(block, "nav");
                  }}
                  title="Pin as global navigation (shows on every page)"
                >
                  📌 Nav
                </button>
              </>
            ) : null}
            {!compactPreview && onSaveAsGlobal && block?.type === BlockTypes.FOOTER ? (
              <>
                <button
                  type="button"
                  style={{ ...styles.blockActionBtn, background: "#1e3a5f", color: "#7dd3fc", border: "1px solid #2563eb", fontSize: 16, padding: "2px 7px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSaveAsGlobal(block, "footer");
                  }}
                  title="Pin as global footer (shows on every page)"
                >
                  📌 Footer
                </button>
              </>
            ) : null}
            {!compactPreview && onSaveBlockDefault ? (
              <button
                type="button"
                style={{ ...styles.blockActionBtn, background: "#132036", color: "#c4b5fd", border: "1px solid #7c3aed", fontSize: 16, padding: "2px 7px" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSaveBlockDefault(block);
                }}
                title="Save this block as the permanent template for this widget"
              >
                Save as Template
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {isHiddenForDevice ? (
        <div style={{ position: "absolute", top: 8, left: 8, zIndex: 17, display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: "rgba(15,23,42,0.9)", color: "#fca5a5", fontSize: 11, fontWeight: 700, letterSpacing: "0.02em", border: "1px solid rgba(248,113,113,0.4)", pointerEvents: "none" }}>
          🚫 Hidden on {device === "mobile" ? "Mobile" : "Tablet"}
        </div>
      ) : null}
      <div style={styles.blockPreviewShell}>
        {showOverlay ? (
        <div style={styles.blockInfoPill}>
          <span style={styles.blockIcon}>{def?.icon || "📦"}</span>
        </div>
        ) : null}
        <div style={{ ...styles.blockPreview, ...(showOverlay ? { paddingTop: actionBarHeight + 8 } : {}), ...(isStickyNavBlock ? styles.blockPreviewStickyNav : {}), ...(isFullWidthBlock ? styles.blockPreviewFullWidth : {}) }}>
          <BlockPreviewBoundary block={block} pageName={activePage} resetKey={animationReplayToken} label="Block preview failed">
            <CanvasBlockPreview
              key={`${block.id || index}-${animationReplayToken || 0}`}
              block={block}
              index={index}
              brandAssets={brandAssets}
              compact={compactPreview}
              device={device}
              layoutWidth={pageCanvasWidth}
              selected={selected}
              onChange={readOnly ? null : onChange}
              onUploadImage={readOnly ? null : onUploadImage}
              onUploadLayerImage={readOnly ? null : onUploadLayerImage}
              onSelectAsset={readOnly ? null : onSelectAsset}
              replayToken={animationReplayToken}
            />
          </BlockPreviewBoundary>
          {isDragTarget ? (
            <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 1fr", zIndex: 30, pointerEvents: "all" }}>
              {[{ key: "leftColumnBlock", label: "Left Column" }, { key: "rightColumnBlock", label: "Right Column" }].map(({ key, label }) => (
                <div
                  key={key}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setHoveredSlot(key); }}
                  onDragLeave={(e) => { e.stopPropagation(); setHoveredSlot(null); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setHoveredSlot(null);
                    onColumnSlotDrop?.(activeDragIndex, index, key);
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    background: hoveredSlot === key ? "rgba(14,165,233,0.35)" : "rgba(14,165,233,0.12)",
                    border: hoveredSlot === key ? "3px solid #0ea5e9" : "2px dashed rgba(14,165,233,0.6)",
                    borderRadius: 8,
                    transition: "background 0.15s, border 0.15s",
                    margin: 4,
                    cursor: "copy",
                  }}
                >
                  <span style={{ fontSize: 22 }}>📦</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: hoveredSlot === key ? "#fff" : "#7dd3fc", textAlign: "center" }}>Drop into {label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {supportsSectionHeight(block.type) ? (
        <button
          type="button"
          style={styles.sectionResizeHandle}
          onPointerDown={startHeightResize}
          onClick={(event) => event.stopPropagation()}
          title="Drag to resize section height"
          aria-label="Drag to resize section height"
        >
          ↕ Height
        </button>
      ) : null}
    </div>
  );
};

export function DropInsertZone({ active, onDragOver, onDrop }) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        ...styles.dropZone,
        ...(active ? styles.dropZoneActive : {}),
      }}
    >
      <div style={{ ...styles.dropLine, ...(active ? styles.dropLineActive : {}) }} />
    </div>
  );
}

export const renderBlockPreview = (block, assets, options = {}) => renderWebsiteBlock(block, { compact: false, assets, editor: true, ...options });
