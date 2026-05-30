import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal, flushSync } from "react-dom";
import { applyAssetToProps, createStoredAsset, getAssetFromLibrary, normalizeSelectedAsset, resolveAssetField } from "../../../lib/website-builder/mediaAssets";
import { saveWebsiteBuilderAssets } from "../../../lib/website-builder/projectStore";
import { BlockTypes, BlockDefinitions } from "../../../lib/website-builder/pageBlockComponents";
import { openSharedMediaPicker } from "../../../lib/openSharedMediaPicker";
import { renderWebsiteBlock, websiteBlockKeyframes } from "../WebsiteBlockRenderer";
import { GRID_ICON_LIBRARY, renderGridLibraryIcon } from "../gridIconLibrary";
import RichText from "../../RichText";
import {
  formatLabel, isImageField, isColorField, isLongTextField, getSelectOptions,
  supportsSectionHeight, supportsFullWidthBackground, isFullWidthBackgroundEnabled,
  supportsCopyRegeneration, parsePixelValue,
  createImageStackLayer, createTextStackLayer,
  createFaqItem, normalizeFaqItems, createContactField, normalizeContactFields,
  isCssGradient, extractSolidColor, normalizeHeroBackgroundModeProps,
  AssetLibraryModal, openSharedLibraryAssetPicker,
  CONTACT_FORM_TEMPLATES, CONTACT_FORM_STYLE_TEMPLATES,
  DEFAULT_ENQUIRY_BOOKING_URL, resolveContactBookingUrl, htmlToPlainText,
  createPricingPlan, normalizePricingPlans,
  NAVBAR_STYLE_PRESETS, BLOCK_STYLE_PRESETS, COPY_TONE_OPTIONS,
  getHeroLayoutDefaults, applyHeroPresetLayout, withHeroOverlayDefaults,
  TEXT_SIZE_OPTIONS, ANIMATION_PRESETS,
} from "./pbEditorUtils";
import { styles } from "./pbStyles";
import {
  BlockPresetPicker, NavbarPresetPicker, NavbarLinksEditor,
  normalizeFeatureListItem, normalizeGalleryItem, createDefaultGalleryItem,
  normalizeTeamMember, normalizeTeamRowSizes, formatTeamRowSizes, deriveTeamRowSizesFromMembers,
  rebalanceTeamMembersForRows, buildEditableTeamRows,
  normalizeStatItem, StatsItemsEditor,
  normalizeTestimonialItemForEditor, normalizeTrustBadgeItem, TrustBadgesEditor,
  CustomHtmlPropertiesPanel, TrustBadgesPropertiesPanel,
  TestimonialItemsEditor, TestimonialPropertiesPanel,
  NewsletterPropertiesPanel, FooterPropertiesPanel,
  TextPropertiesPanel, StatsPropertiesPanel,
  ContainerImageControls, TeamMembersEditor, TeamPropertiesPanel,
  ensureGalleryImagesCount, ListItemsEditor, FeatureListPropertiesPanel,
  GalleryImagesEditor, ImageGalleryPropertiesPanel,
  PricingTablePropertiesPanel, FAQPropertiesPanel, SplitBlockPropertiesPanel, FeatureAccordionPropertiesPanel,
  ScrollStackPropertiesPanel,
  CompetitorComparisonPropertiesPanel,
  NumberField, ImagePropertiesPanel, NavbarLogoPicker, NavbarPropertiesPanel,
  normalizeColorInput, STANDARD_COLOR_SWATCHES, PRICING_COLOR_SWATCHES,
  ColorSelector, CompactColorField, rgbToHex, stripEditorArtifacts,
  TEXT_TOOLBAR_FONTS, TEXT_TOOLBAR_SIZES, TEXT_TOOLBAR_LINE_HEIGHTS,
  ANIMATION_PRESETS as ANIMATION_PRESETS_PANELS,
  ANIMATION_DELAY_OPTIONS, ANIMATION_SPEED_OPTIONS, BLOCK_TYPE_STYLE_PRESETS,
  getTextAnimationBinding, getSelectionStyleSource, getEditableBackgroundTarget,
  parseBackgroundImageUrl, normalizeToolbarBackgroundColor, normalizeComputedLineHeight,
  TextEditingToolbar, BlockAnimationPopover,
  formatSavedAgo, pickGlobalStyleValue, GlobalStylePanel,
  BlockLibraryPanel, PageSectionsPanel,
} from "./pbPropertiesPanels";

const CanvasBlockPreview = React.memo(function CanvasBlockPreview({ block, index, brandAssets, onChange, onUploadImage, onUploadLayerImage, onSelectAsset, replayToken, compact, selected, layoutWidth }) {
  return renderBlockPreview(block, brandAssets, {
    compact,
    layoutWidth,
    animationPreview: Number(replayToken || 0) > 0,
    isSelected: selected,
    onChangeBlock: (nextProps) => onChange(index, nextProps),
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
  && prev.selected === next.selected
  && prev.layoutWidth === next.layoutWidth
));

const CanvasBlock = ({ block, index, onSelect, onHover, selected, hovered, onDelete, onDuplicate, onEdit, onAnimate, onChange, onResizeHeight, onUploadImage, onUploadLayerImage, onSelectAsset, brandAssets, onBlockDragOver, onBlockDrop, animationReplayToken, onMoveStep, onMoveToTop, onSaveAsGlobal, onSaveBlockDefault, compactPreview, pageCanvasWidth, canvasScale = 1, activeDragIndex = null, onBlockDragStart, onBlockDragEnd, onColumnSlotDrop }) => {
  const def = BlockDefinitions[block.type];
  const showOverlay = selected || hovered;
  const resizeStateRef = useRef(null);
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const isDragTarget = activeDragIndex !== null && activeDragIndex !== index && block.type === "columns-2";
  const stickyMode = String(block?.props?.stickyMode || "normal");
  const isStickyNavBlock = block?.type === "nav-bar" && stickyMode !== "normal";
  const canStretchFullWidth = supportsFullWidthBackground(block?.type);
  const isStretchToCanvasGrid = !compactPreview && block?.type === "grid-section" && block?.props?.stretchToCanvas === true;
  const isFullWidthBlock = !compactPreview && ((canStretchFullWidth && isFullWidthBackgroundEnabled(block)) || isStretchToCanvasGrid);

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

  const startHeightResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      startY: event.clientY,
      startHeight: parsePixelValue(block?.props?.minHeight, block?.type === BlockTypes.HERO ? 420 : 280),
      canvasScale,
    };
  };

  return (
    <div
      style={{
        ...styles.canvasBlock,
        width: "100%",
        maxWidth: isFullWidthBlock ? "none" : `${pageCanvasWidth}px`,
        margin: "0 auto",
        ...((block?.type === "columns-2" || block?.type === "columns-3" || block?.type === "grid-section") ? { padding: 0, background: block?.props?.backgroundColor || "transparent", border: "none", borderRadius: 0, boxShadow: "none" } : {}),
        ...(block?.type === "space" ? (() => {
          const sp    = block.props || {};
          const spBg  = sp.backgroundStyle === "color"    ? sp.backgroundColor || "transparent"
                      : sp.backgroundStyle === "gradient" ? sp.backgroundGradient || "transparent"
                      : sp.backgroundStyle === "image" && sp.backgroundImage
                          ? `url(${JSON.stringify(sp.backgroundImage)}) ${sp.backgroundPosition || "center center"} / ${sp.backgroundSize || "cover"} no-repeat`
                      : "repeating-linear-gradient(45deg,rgba(99,102,241,0.08) 0,rgba(99,102,241,0.08) 1px,transparent 0,transparent 50%) 0 0 / 8px 8px";
          return { padding: 0, background: spBg, border: "1px dashed rgba(99,102,241,0.35)", borderRadius: 6, minHeight: Number(String(sp.height || "40").replace("px", "")) || 40, boxShadow: "none" };
        })() : {}),
        ...(selected && block?.type !== "columns-2" && block?.type !== "columns-3" && block?.type !== "grid-section" && block?.type !== "space" ? styles.canvasBlockSelected : {}),
        ...(selected && (block?.type === "columns-2" || block?.type === "columns-3" || block?.type === "grid-section") ? { outline: "2px solid #0ea5e9" } : {}),
      }}
      data-canvas-block-index={index}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("existingBlockIndex", String(index));
        onBlockDragStart?.(index);
      }}
      onDragEnd={() => {
        setHoveredSlot(null);
        onBlockDragEnd?.();
      }}
      onClick={() => onSelect(index)}
      onMouseEnter={() => onHover?.(index)}
      onMouseLeave={() => onHover?.(null)}
      onDragOver={(e) => {
        if (activeDragIndex !== null) return; // column slot overlay handles this
        onBlockDragOver(e, index);
      }}
      onDrop={(e) => {
        if (activeDragIndex !== null) return;
        onBlockDrop(e, index);
      }}
    >
      {showOverlay ? (
        <div style={styles.blockActionBar}>
          <div style={styles.blockActionLeft}>
            <span style={styles.blockActionLabel}>{def?.name || block.type}</span>
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
              style={{ ...styles.blockActionBtnIcon, cursor: "grab", touchAction: "none" }}
              title="Drag to reorder or drop into a column"
              aria-label="Drag block"
            >
              ⠿
            </button>
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
            <button
              type="button"
              style={styles.blockActionBtnIcon}
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
              style={styles.blockActionBtnIcon}
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
              style={styles.blockActionBtn}
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(index, e.currentTarget);
              }}
              title="Open editor"
            >
              Edit
            </button>
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
            <button
              type="button"
              style={styles.blockActionBtnIcon}
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
              style={{ ...styles.blockActionBtnIcon, ...styles.blockActionBtnDanger }}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(index);
              }}
              title="Delete"
              aria-label="Delete"
            >
              🗑
            </button>
            {!compactPreview && onSaveAsGlobal ? (
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
                title="Save this block's current presentation as the default for this block type"
              >
                Save Default
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div style={styles.blockPreviewShell}>
        {showOverlay ? (
        <div style={styles.blockInfoPill}>
          <span style={styles.blockIcon}>{def?.icon || "📦"}</span>
        </div>
        ) : null}
        <div style={{ ...styles.blockPreview, ...(showOverlay ? styles.blockPreviewWithOverlay : {}), ...(isStickyNavBlock ? styles.blockPreviewStickyNav : {}), ...(isFullWidthBlock ? styles.blockPreviewFullWidth : {}) }}>
          <CanvasBlockPreview
            key={`${block.id || index}-${animationReplayToken || 0}`}
            block={block}
            index={index}
            brandAssets={brandAssets}
            compact={compactPreview}
            layoutWidth={pageCanvasWidth}
            selected={selected}
            onChange={onChange}
            onUploadImage={onUploadImage}
            onUploadLayerImage={onUploadLayerImage}
            onSelectAsset={onSelectAsset}
            replayToken={animationReplayToken}
          />
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

function CounterLiveStats({ projectId, startNumber }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = React.useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    const base = Math.max(0, Number(startNumber || 0));
    fetch(`/api/website/track-visit?projectId=${encodeURIComponent(projectId)}&base=${base}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setStats(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId, startNumber]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const realVisits = stats?.totalVisits ?? 0;
  const totalShown = stats?.count ?? startNumber ?? 0;

  return (
    <div style={{ background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.25)", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: "#38bdf8", letterSpacing: "0.08em" }}>LIVE VISIT DATA</span>
        <button
          type="button"
          onClick={fetchStats}
          disabled={loading}
          style={{ fontSize: 16, padding: "2px 8px", borderRadius: 5, border: "1px solid rgba(14,165,233,0.4)", background: "transparent", color: "#38bdf8", cursor: loading ? "default" : "pointer", opacity: loading ? 0.5 : 1 }}
        >{loading ? "…" : "↻ Refresh"}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div style={{ textAlign: "center", background: "rgba(0,0,0,0.25)", borderRadius: 6, padding: "6px 4px" }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#0ea5e9", lineHeight: 1 }}>{totalShown.toLocaleString()}</div>
          <div style={{ fontSize: 16, color: "#94a3b8", marginTop: 2 }}>shown on counter</div>
        </div>
        <div style={{ textAlign: "center", background: "rgba(0,0,0,0.25)", borderRadius: 6, padding: "6px 4px" }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#10b981", lineHeight: 1 }}>{realVisits.toLocaleString()}</div>
          <div style={{ fontSize: 16, color: "#94a3b8", marginTop: 2 }}>real visits tracked</div>
        </div>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 16, color: "#64748b", lineHeight: 1.4 }}>
        Visits are recorded when someone opens your <strong style={{ color: "#94a3b8" }}>Preview</strong> or <strong style={{ color: "#94a3b8" }}>live published page</strong> — not this editor.
      </p>
    </div>
  );
}

function MarqueeItemEditor({ item, index, onChange, onRemove, stylesRef }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");

  // Normalize: plain string → { text: item }, object stays as-is
  const norm = item && typeof item === "object" ? item : { text: String(item || "") };
  const currentText = norm.text || "";
  const currentIconKey = norm.iconKey || null;

  const filteredIcons = useMemo(() => {
    const q = iconSearch.toLowerCase();
    if (!q) return GRID_ICON_LIBRARY;
    return GRID_ICON_LIBRARY.filter(
      (e) => e.key.toLowerCase().includes(q) || e.label.toLowerCase().includes(q) || e.group.toLowerCase().includes(q)
    );
  }, [iconSearch]);

  const panelStyle = stylesRef || styles;

  function update(patch) {
    const next = { ...norm, ...patch };
    // Simplify back to string if no icon and it's just text
    if (!next.iconKey && next.text !== undefined && Object.keys(next).filter(k => k !== "text").length === 0) {
      onChange(next.text);
    } else {
      onChange(next);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px", background: "#1e293b", borderRadius: 8, border: "1px solid #334155" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "#94a3b8", fontSize: 16, fontWeight: 600, minWidth: 22 }}>#{index + 1}</span>
        {/* Icon preview / pick button */}
        <button
          type="button"
          title={currentIconKey ? `Icon: ${currentIconKey} — click to change` : "Click to add an icon"}
          onClick={() => { setPickerOpen((v) => !v); setIconSearch(""); }}
          style={{
            width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 6, border: currentIconKey ? "1px solid #6366f1" : "1px dashed #475569",
            background: currentIconKey ? "#1e1b4b" : "#0f172a", cursor: "pointer", color: "#e2e8f0", flexShrink: 0,
          }}
        >
          {currentIconKey
            ? renderGridLibraryIcon(currentIconKey, { size: 16 })
            : <span style={{ fontSize: 16, color: "#475569" }}>+</span>}
        </button>
        {/* Text input */}
        <input
          type="text"
          value={currentText}
          onChange={(e) => update({ text: e.target.value })}
          style={{ ...panelStyle.propertyInput, margin: 0, flex: 1 }}
          placeholder="Item text (optional)"
        />
        {/* Remove icon button */}
        {currentIconKey && (
          <button
            type="button"
            title="Remove icon"
            onClick={() => { update({ iconKey: undefined }); setPickerOpen(false); }}
            style={{ padding: "2px 6px", borderRadius: 4, border: "none", fontSize: 16, cursor: "pointer", background: "#334155", color: "#94a3b8", flexShrink: 0 }}
          >no icon</button>
        )}
        {/* Delete item button */}
        <button
          type="button"
          onClick={onRemove}
          style={{ padding: "2px 6px", borderRadius: 4, border: "none", fontSize: 16, cursor: "pointer", background: "#334155", color: "#f87171", flexShrink: 0 }}
          title="Remove item"
        >✕</button>
      </div>

      {pickerOpen && (
        <div style={{ background: "#0f172a", borderRadius: 8, border: "1px solid #334155", padding: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 16, color: "#94a3b8" }}>Pick an icon</span>
            <button type="button" onClick={() => setPickerOpen(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          <input
            type="search"
            placeholder="Search icons…"
            value={iconSearch}
            onChange={(e) => setIconSearch(e.target.value)}
            style={{ ...panelStyle.propertyInput, margin: "0 0 8px", width: "100%", boxSizing: "border-box" }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 4, maxHeight: 220, overflowY: "auto" }}>
            {filteredIcons.map((entry) => (
              <button
                key={entry.key}
                type="button"
                title={`${entry.label} · ${entry.key}`}
                onClick={() => { update({ iconKey: entry.key }); setPickerOpen(false); setIconSearch(""); }}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 2, padding: 4, borderRadius: 6,
                  border: entry.key === currentIconKey ? "1px solid #6366f1" : "1px solid transparent",
                  background: entry.key === currentIconKey ? "#1e1b4b" : "transparent",
                  cursor: "pointer", color: "#e2e8f0",
                }}
              >
                <span style={{ fontSize: 18, display: "flex", alignItems: "center" }}>
                  {renderGridLibraryIcon(entry.key, { size: 18 })}
                </span>
                <span style={{ fontSize: 16, color: "#64748b", lineHeight: 1.2, textAlign: "center", wordBreak: "break-all" }}>
                  {entry.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DropInsertZone({ active, onDragOver, onDrop }) {
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

function GlobalBlockPreview({ label, role, block, brandAssets, compact, selected = false, onSelect, onChange, onSaveAsGlobal, onDelete }) {
  if (!block) return null;
  const [hovered, setHovered] = useState(false);
  const showOverlay = selected || hovered;

  return (
    <div
      data-global-block-preview="true"
      style={{
        ...styles.globalBlockPreviewWrap,
        ...(selected ? styles.globalBlockPreviewWrapSelected : {}),
      }}
      onPointerDownCapture={() => {
        onSelect?.();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onSelect?.();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {showOverlay ? (
        <div style={styles.blockActionBar}>
          <div style={styles.blockActionLeft}>
            <span style={styles.blockActionLabel}>{label}</span>
          </div>
          <div style={styles.blockActionButtons}>
            <button
              type="button"
              style={styles.blockActionBtn}
              onClick={(event) => {
                event.stopPropagation();
                onSelect?.();
              }}
              title="Edit global block"
            >
              Edit
            </button>
            <button
              type="button"
              style={{ ...styles.blockActionBtn, background: "#1e3a5f", color: "#7dd3fc", border: "1px solid #2563eb", fontSize: 16, padding: "2px 7px" }}
              onClick={(event) => {
                event.stopPropagation();
                onSaveAsGlobal?.(block, role);
              }}
              title={`Save as global ${role === "nav" ? "navigation" : "footer"}`}
            >
              📌 {role === "nav" ? "Nav" : "Footer"}
            </button>
            <span style={{ ...styles.blockActionBtn, cursor: "default", background: "rgba(59,130,246,0.18)", color: "#bfdbfe", border: "1px solid rgba(96,165,250,0.35)" }}>
              Global block
            </span>
            <button
              type="button"
              style={{ ...styles.blockActionBtn, background: "#3b0a0a", color: "#fca5a5", border: "1px solid #dc2626" }}
              onClick={(event) => {
                event.stopPropagation();
                if (window.confirm(`Remove the global ${role === "nav" ? "navigation" : "footer"} block?`)) {
                  onDelete?.();
                }
              }}
              title={`Delete global ${role === "nav" ? "navigation" : "footer"}`}
            >
              🗑 Delete
            </button>
          </div>
        </div>
      ) : null}
      <div style={styles.globalBlockPreviewSurface}>
        
        {renderWebsiteBlock(block, {
          compact,
          assets: brandAssets,
          editor: true,
          onChangeBlock: (nextProps) => onChange?.({ ...block, props: nextProps }),
        })}
      </div>
    </div>
  );
}

function ImageStackPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage }) {
  const props = block?.props || {};
  const layers = Array.isArray(props.images) ? props.images : [];
  const savedImages = Array.isArray(brandAssets?.images) ? brandAssets.images : [];
  const libraryImages = [brandAssets?.logo, ...savedImages].filter(Boolean).slice(0, 12);
  const selectedLayerIndex = Number.isInteger(props.selectedLayerIndex) && props.selectedLayerIndex >= 0 && props.selectedLayerIndex < layers.length
    ? props.selectedLayerIndex
    : null;
  const activeLayer = selectedLayerIndex !== null ? layers[selectedLayerIndex] : null;

  const update = (patch) => onChange(index, { ...props, ...patch });
  const normalizeLayers = (nextLayers) => nextLayers.map((layer, layerIndex) => ({
    ...layer,
    zIndex: layerIndex + 1,
  }));
  const updateLayer = (layerIndex, patch) => {
    update({
      images: layers.map((layer, currentIndex) => (
        currentIndex === layerIndex ? { ...layer, ...patch } : layer
      )),
    });
  };

  const addImageLayer = () => {
    update({ images: [...layers, createImageStackLayer(layers.length)], selectedLayerIndex: layers.length });
  };

  const addTextLayer = () => {
    update({ images: [...layers, createTextStackLayer(layers.length)], selectedLayerIndex: layers.length });
  };

  const addLogoLayer = () => {
    const logo = brandAssets?.logo;
    if (!logo?.src) return;
    update({
      images: [
        ...layers,
        {
          ...createImageStackLayer(layers.length),
          src: logo.src,
          assetId: logo.id || "",
          width: 180,
          height: 90,
          rotation: 0,
        },
      ],
      selectedLayerIndex: layers.length,
    });
  };

  const moveLayerOrder = (layerIndex, direction) => {
    const nextIndex = layerIndex + direction;
    if (nextIndex < 0 || nextIndex >= layers.length) return;
    const nextLayers = [...layers];
    const [moved] = nextLayers.splice(layerIndex, 1);
    nextLayers.splice(nextIndex, 0, moved);
    update({ images: normalizeLayers(nextLayers), selectedLayerIndex: nextIndex });
  };

  const alignLayerToCanvas = (layerIndex, axis, value) => {
    const layer = layers[layerIndex];
    if (!layer) return;

    if (axis === "x") {
      const canvasEl = document.querySelector("[data-image-stack-canvas]");
      const canvasWidth = canvasEl ? Math.round(canvasEl.getBoundingClientRect().width) : 1100;
      const layerWidth = Number(layer.width || 320);
      let nextX = Number(layer.x || 0);
      if (value === "left") nextX = 24;
      if (value === "center") nextX = Math.max(0, Math.round((canvasWidth - layerWidth) / 2));
      if (value === "right") nextX = Math.max(24, canvasWidth - layerWidth - 24);
      updateLayer(layerIndex, { x: nextX, textAlign: value });
      return;
    }

    const canvasHeight = parsePixelValue(props.minHeight, 560);
    const layerHeight = Number(layer.height || 140);
    let nextY = Number(layer.y || 0);
    if (value === "top") nextY = 24;
    if (value === "center") nextY = Math.max(0, Math.round((canvasHeight - layerHeight) / 2));
    if (value === "bottom") nextY = Math.max(24, canvasHeight - layerHeight - 24);
    updateLayer(layerIndex, { y: nextY, verticalAlign: value });
  };

  const removeLayer = (layerIndex) => {
    const nextLayers = normalizeLayers(layers.filter((_, currentIndex) => currentIndex !== layerIndex));
    update({
      images: nextLayers,
      selectedLayerIndex: nextLayers.length ? Math.min(layerIndex, nextLayers.length - 1) : null,
    });
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🖼️ Edit: Layered Image Stack</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Canvas Title</label>
          <input
            type="text"
            value={props.title || ""}
            onChange={(e) => update({ title: e.target.value })}
            style={styles.propertyInput}
          />
          <label style={styles.inlineToggle}>
            <input
              type="checkbox"
              checked={props.showGrid !== false}
              onChange={(e) => update({ showGrid: e.target.checked })}
            />
            Show design grid and snap layers to it
          </label>
          <div style={styles.colorGrid}>
            <NumberField
              label="Canvas Height"
              value={parsePixelValue(props.minHeight, 560)}
              min={240}
              max={1400}
              onChange={(value) => update({ minHeight: `${Math.max(240, value)}px` })}
            />
            <div style={styles.colorField}>
              <span style={styles.colorLabel}>Background</span>
              <input
                type="color"
                value={normalizeColorInput(props.backgroundColor, "#f8fafc")}
                onChange={(e) => update({ backgroundColor: e.target.value })}
                style={styles.colorInput}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button type="button" style={styles.formatBtn} onClick={() => update({ backgroundColor: "transparent" })}>
              Transparent Canvas
            </button>
          </div>
          <div style={styles.assetPicker}>
            <button type="button" style={styles.secondaryBtn} onClick={addImageLayer}>
              + Add Image Layer
            </button>
            <button type="button" style={styles.secondaryBtn} onClick={addTextLayer}>
              + Add Text Layer
            </button>
            {brandAssets?.logo?.src ? (
              <button type="button" style={styles.secondaryBtn} onClick={addLogoLayer}>
                + Add Logo Layer
              </button>
            ) : null}
          </div>
          {layers.length ? (
            <div style={styles.assetPicker}>
              {layers.map((layer, layerIndex) => (
                <button
                  key={layer.id || `select-layer-${layerIndex}`}
                  type="button"
                  style={{
                    ...styles.assetChip,
                    ...(selectedLayerIndex === layerIndex ? { background: "#7df9a1", borderColor: "#7df9a1", color: "#04202e" } : {}),
                  }}
                  onClick={() => update({ selectedLayerIndex: layerIndex })}
                >
                  {layer.kind === "text" ? `Text ${layerIndex + 1}` : `Image ${layerIndex + 1}`}
                </button>
              ))}
              {selectedLayerIndex !== null ? (
                <button
                  type="button"
                  style={{ ...styles.assetChip, background: "transparent", borderColor: "#475569", color: "#cbd5e1" }}
                  onClick={() => update({ selectedLayerIndex: null })}
                >
                  Clear Selection
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {activeLayer ? (
          <div key={activeLayer.id || `layer-${selectedLayerIndex}`} style={styles.linkRowCard}>
            <div style={styles.linkRowHeader}>
              <span style={styles.linkRowTitle}>{activeLayer.kind === "text" ? `Text Layer ${selectedLayerIndex + 1}` : `Image Layer ${selectedLayerIndex + 1}`}</span>
              <div style={styles.linkActions}>
                <button type="button" style={styles.linkMoveBtn} onClick={() => moveLayerOrder(selectedLayerIndex, -1)} title="Send back">←</button>
                <button type="button" style={styles.linkMoveBtn} onClick={() => moveLayerOrder(selectedLayerIndex, 1)} title="Bring forward">→</button>
                <button type="button" style={styles.linkRowDelete} onClick={() => removeLayer(selectedLayerIndex)}>
                  Remove
                </button>
              </div>
            </div>
            {activeLayer.kind === "text" ? (
              <div style={styles.sectionCard}>
                <p style={{ margin: 0, color: "#9fb0c5", fontSize: 16 }}>
                  Edit, resize, and move this text directly on the canvas. Use the top text bar when the text is selected.
                </p>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={activeLayer.src || ""}
                  onChange={(e) => updateLayer(selectedLayerIndex, { src: e.target.value, assetId: "", kind: "image" })}
                  style={styles.propertyInput}
                  placeholder="Paste image URL or upload one"
                />
                <div style={styles.colorGrid}>
                  <NumberField label="X" value={Number(activeLayer.x || 0)} min={0} max={2000} onChange={(value) => updateLayer(selectedLayerIndex, { x: value })} />
                  <NumberField label="Y" value={Number(activeLayer.y || 0)} min={0} max={2000} onChange={(value) => updateLayer(selectedLayerIndex, { y: value })} />
                  <NumberField label="Width" value={Number(activeLayer.width || 260)} min={80} max={1600} onChange={(value) => updateLayer(selectedLayerIndex, { width: value })} />
                  <NumberField label="Height" value={Number(activeLayer.height || 180)} min={80} max={1600} onChange={(value) => updateLayer(selectedLayerIndex, { height: value })} />
                </div>
                <div style={styles.colorGrid}>
                  <NumberField label="Rotate" value={Number(activeLayer.rotation || 0)} min={-45} max={45} onChange={(value) => updateLayer(selectedLayerIndex, { rotation: value })} />
                  <NumberField label="Radius" value={Number(activeLayer.radius || 18)} min={0} max={100} onChange={(value) => updateLayer(selectedLayerIndex, { radius: value })} />
                </div>
                <div style={styles.assetPicker}>
                  <label style={styles.assetUploadCta}>
                    Upload Image
                    <input
                      type="file"
                      accept="image/*"
                      style={styles.hiddenInput}
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        const asset = await Promise.resolve(onUploadImage?.(index, "__image_stack_layer__", file));
                        if (asset?.src) {
                          updateLayer(selectedLayerIndex, {
                            kind: "image",
                            src: String(asset.src || "").startsWith("data:") ? "" : asset.src,
                            assetId: asset.id || "",
                          });
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    style={styles.secondaryBtn}
                    onClick={() => openSharedLibraryAssetPicker((asset) => updateLayer(selectedLayerIndex, {
                      kind: "image",
                      src: String(asset.src || "").startsWith("data:") ? "" : (asset.src || ""),
                      assetId: asset.id || "",
                    }))}
                  >
                    Choose From Library
                  </button>
                  {libraryImages.map((image, imageIndex) => (
                    <button
                      key={`${image.id || image.name || "asset"}-${imageIndex}`}
                      type="button"
                      style={styles.assetThumbBtn}
                      onClick={() => updateLayer(selectedLayerIndex, { kind: "image", src: image.src || "", assetId: image.id || "" })}
                      title={image.name || `Asset ${imageIndex + 1}`}
                    >
                      <img src={image.src} alt={image.name || `Asset ${imageIndex + 1}`} style={styles.assetThumbPreview} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={styles.sectionCard}>
            <p style={{ margin: 0, color: "#9fb0c5", fontSize: 16 }}>
              Click one image or text layer on the canvas to edit only that layer here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function getColumnEditorConfigs(blockType) {
  if (blockType === BlockTypes.COLUMNS_2) {
    return [
      {
        id: "left-column",
        label: "Left Column",
        titleKey: "leftTitle",
        contentKey: "leftContent",
        imageKey: "leftImage",
        prefix: "leftColumn",
      },
      {
        id: "right-column",
        label: "Right Column",
        titleKey: "rightTitle",
        contentKey: "rightContent",
        imageKey: "rightImage",
        prefix: "rightColumn",
      },
    ];
  }

  if (blockType === BlockTypes.COLUMNS_3) {
    return [
      { id: "column-1", label: "Column 1", titleKey: "column1Title", contentKey: "column1", imageKey: "column1Image", prefix: "column1" },
      { id: "column-2", label: "Column 2", titleKey: "column2Title", contentKey: "column2", imageKey: "column2Image", prefix: "column2" },
      { id: "column-3", label: "Column 3", titleKey: "column3Title", contentKey: "column3", imageKey: "column3Image", prefix: "column3" },
    ];
  }

  return [];
}

function ColumnsPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage, onSelectAsset, onOpenImageEditor }) {
  const props = block?.props || {};
  const columnConfigs = getColumnEditorConfigs(block?.type);
  const savedImages = [brandAssets?.logo, ...(Array.isArray(brandAssets?.images) ? brandAssets.images : [])].filter(Boolean).slice(0, 8);
  const update = (patch) => onChange(index, { ...props, ...patch });

  function swapColumns() {
    if (block?.type !== BlockTypes.COLUMNS_2) return;
    onChange(index, {
      ...props,
      ratio: props.ratio === "60-40" ? "40-60" : props.ratio === "40-60" ? "60-40" : props.ratio,
      leftTitle: props.rightTitle,
      leftContent: props.rightContent,
      leftImage: props.rightImage,
      leftImageAssetId: props.rightImageAssetId,
      leftImageHeight: props.rightImageHeight,
      leftImageWidth: props.rightImageWidth,
      leftColumnContentType: props.rightColumnContentType,
      leftColumnNewsletterHeading: props.rightColumnNewsletterHeading,
      leftColumnNewsletterSubtitle: props.rightColumnNewsletterSubtitle,
      leftColumnNewsletterFields: props.rightColumnNewsletterFields,
      leftColumnNewsletterButtonText: props.rightColumnNewsletterButtonText,
      leftColumnNewsletterButtonColor: props.rightColumnNewsletterButtonColor,
      leftColumnNewsletterButtonTextColor: props.rightColumnNewsletterButtonTextColor,
      leftColumnNewsletterImage: props.rightColumnNewsletterImage,
      leftColumnNewsletterImageAssetId: props.rightColumnNewsletterImageAssetId,
      leftColumnNewsletterImageHeight: props.rightColumnNewsletterImageHeight,
      leftColumnNewsletterImageWidth: props.rightColumnNewsletterImageWidth,
      leftColumnWidth: props.rightColumnWidth,
      rightTitle: props.leftTitle,
      rightContent: props.leftContent,
      rightImage: props.leftImage,
      rightImageAssetId: props.leftImageAssetId,
      rightImageHeight: props.leftImageHeight,
      rightImageWidth: props.leftImageWidth,
      rightColumnContentType: props.leftColumnContentType,
      rightColumnNewsletterHeading: props.leftColumnNewsletterHeading,
      rightColumnNewsletterSubtitle: props.leftColumnNewsletterSubtitle,
      rightColumnNewsletterFields: props.leftColumnNewsletterFields,
      rightColumnNewsletterButtonText: props.leftColumnNewsletterButtonText,
      rightColumnNewsletterButtonColor: props.leftColumnNewsletterButtonColor,
      rightColumnNewsletterButtonTextColor: props.leftColumnNewsletterButtonTextColor,
      rightColumnNewsletterImage: props.leftColumnNewsletterImage,
      rightColumnNewsletterImageAssetId: props.leftColumnNewsletterImageAssetId,
      rightColumnNewsletterImageHeight: props.leftColumnNewsletterImageHeight,
      rightColumnNewsletterImageWidth: props.leftColumnNewsletterImageWidth,
      rightColumnWidth: props.leftColumnWidth,
    });
  }

  async function applyUploadedAsset(fieldKey, file) {
    const asset = await Promise.resolve(onUploadImage?.(index, fieldKey, file));
    if (!asset?.src) return;

    const nextProps = applyAssetToProps(props, fieldKey, asset);
    onChange(index, {
      ...nextProps,
      [fieldKey]: String(asset.src || "").startsWith("data:") ? "" : asset.src,
    });
  }

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🧱 Edit: Columns</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Section Background</label>
          <div style={styles.colorGrid}>
            <ColorSelector label="Background Color" value={props.backgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ backgroundColor: value })} />
            <ColorSelector label="Border Color" value={props.borderColor || "rgba(148,163,184,0.28)"} fallback="rgba(148,163,184,0.28)" onChange={(value) => update({ borderColor: value })} />
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Background Gradient</label>
          <input type="text" value={String(props.backgroundColor || "")} onChange={(e) => update({ backgroundColor: e.target.value })} style={styles.propertyInput} placeholder="e.g. linear-gradient(135deg,#0f172a,#1e3a5f)" />
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Section Layout</label>
          <label style={{ ...styles.propertyLabel, marginTop: 0 }}>Section Heading (leave blank to hide)</label>
          <input type="text" value={props.title || ""} onChange={(e) => update({ title: e.target.value })} style={styles.propertyInput} placeholder="Leave blank for no heading" />
          {block.type === BlockTypes.COLUMNS_2 ? (
            <button type="button" style={{ ...styles.secondaryBtn, marginTop: 8, width: "100%" }} onClick={swapColumns}>Swap Left / Right Columns</button>
          ) : null}
          <div style={{ ...styles.colorGrid, marginTop: 8 }}>
            {block.type === BlockTypes.COLUMNS_2 ? (
              <div style={styles.propertyField}>
                <label style={styles.propertyLabel}>Column Ratio</label>
                <select value={String(props.ratio || "50-50")} onChange={(e) => update({ ratio: e.target.value })} style={styles.propertyInput}>
                  <option value="50-50">50 / 50</option>
                  <option value="60-40">60 / 40</option>
                  <option value="40-60">40 / 60</option>
                </select>
              </div>
            ) : null}
            <NumberField label="Section Height" value={parsePixelValue(props.minHeight, 280)} min={160} max={1200} onChange={(value) => update({ minHeight: `${value}px` })} />
            <NumberField label="Block Max Width" value={Number(props.blockMaxWidth) || 1200} min={320} max={1800} onChange={(value) => update({ blockMaxWidth: value })} />
            <NumberField label="Columns Gap" value={Number(props.columnGap ?? 18)} min={0} max={120} onChange={(value) => update({ columnGap: value })} />
            <NumberField label="Top Margin" value={Number(props.columnsTopMargin ?? 16)} min={0} max={240} onChange={(value) => update({ columnsTopMargin: value })} />
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Vertical Alignment</label>
          <div style={styles.inlineChipRow}>
            {[
              { value: "top", label: "Top" },
              { value: "center", label: "Center" },
              { value: "bottom", label: "Bottom" },
            ].map((option) => (
              <button key={option.value} type="button" style={{ ...styles.presetChip, ...(String(props.columnsVerticalAlign || "top") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ columnsVerticalAlign: option.value })}>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Shared Column Design</label>
          <div style={styles.colorGrid}>
            <ColorSelector label="Background" value={props.columnBackgroundColor || props.cardBackgroundColor || "#f8fafc"} fallback="#f8fafc" onChange={(value) => update({ columnBackgroundColor: value })} />
            <ColorSelector label="Border" value={props.columnBorderColor || "#cbd5e1"} fallback="#cbd5e1" onChange={(value) => update({ columnBorderColor: value })} />
            <ColorSelector label="Title Color" value={props.columnTitleColor || props.textColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ columnTitleColor: value })} />
            <ColorSelector label="Body Color" value={props.columnBodyColor || "#334155"} fallback="#334155" onChange={(value) => update({ columnBodyColor: value })} />
          </div>
          <div style={styles.colorGrid}>
            <NumberField label="Padding" value={Number(props.columnPadding ?? 18)} min={0} max={96} onChange={(value) => update({ columnPadding: value })} />
            <NumberField label="Radius" value={Number(props.columnRadius ?? 18)} min={0} max={80} onChange={(value) => update({ columnRadius: value })} />
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Text Alignment</label>
          <div style={styles.inlineChipRow}>
            {[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ].map((option) => (
              <button key={option.value} type="button" style={{ ...styles.presetChip, ...(String(props.columnContentAlign || "left") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ columnContentAlign: option.value })}>
                {option.label}
              </button>
            ))}
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Shadow</label>
          <div style={styles.inlineChipRow}>
            {[
              { value: "none", label: "None" },
              { value: "soft", label: "Soft" },
              { value: "medium", label: "Medium" },
              { value: "strong", label: "Strong" },
            ].map((option) => (
              <button key={option.value} type="button" style={{ ...styles.presetChip, ...(String(props.columnShadow || "soft") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ columnShadow: option.value })}>
                {option.label}
              </button>
            ))}
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Gradient / Overlay</label>
          <input type="text" value={String(props.columnGradient || "")} onChange={(e) => update({ columnGradient: e.target.value })} style={styles.propertyInput} placeholder="linear-gradient(...)" />
          <div style={{ marginTop: 8 }}>
            <ColorSelector label="Overlay Color" value={props.columnOverlayColor || "transparent"} fallback="#000000" allowTransparent onChange={(value) => update({ columnOverlayColor: value })} />
          </div>
        </div>

        {columnConfigs.map((column) => {
          const imageValue = resolveAssetField(props, column.imageKey, brandAssets) || props?.[column.imageKey] || "";
          const colContentType = String(props?.[`${column.prefix}ContentType`] || "text");
          const isNewsletter = colContentType === "newsletter";
          const isBlock = colContentType === "block";
          const embeddedBlock = props?.[`${column.prefix}Block`] || null;
          return (
            <div key={column.id} style={styles.sectionCard}>
              <label style={styles.propertyLabel}>{column.label}</label>

              {/* Card width */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <NumberField label="Card Width (fr)" value={Number(props[`${column.prefix}Width`]) || 1} min={1} max={10} onChange={(value) => update({ [`${column.prefix}Width`]: value })} />
              </div>

              {/* Column type selector */}
              <div style={styles.inlineChipRow}>
                {[{ value: "text", label: "📝 Text / Image" }, { value: "newsletter", label: "📬 Newsletter" }, { value: "block", label: "📦 Embedded Block" }].map((opt) => (
                  <button key={opt.value} type="button"
                    style={{ ...styles.presetChip, ...(colContentType === opt.value ? styles.presetChipActive : {}) }}
                    onClick={() => update({ [`${column.prefix}ContentType`]: opt.value })}
                  >{opt.label}</button>
                ))}
              </div>

              {isBlock ? (
                <div style={{ marginTop: 8 }}>
                  {embeddedBlock ? (
                    <>
                      <p style={{ margin: "0 0 8px", fontSize: 13, color: "#94a3b8" }}>
                        Embedded: <strong style={{ color: "#e2e8f0" }}>{BlockDefinitions[embeddedBlock.type]?.name || embeddedBlock.type}</strong>
                      </p>
                      <button
                        type="button"
                        style={{ ...styles.secondaryBtn, borderColor: "rgba(239,68,68,0.4)", color: "#fca5a5" }}
                        onClick={() => update({ [`${column.prefix}Block`]: null, [`${column.prefix}ContentType`]: "text" })}
                      >
                        Remove Embedded Block
                      </button>
                    </>
                  ) : (
                    <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
                      Drag any block from the canvas using its ⠿ drag handle and drop it onto the column slot that appears on this block.
                    </p>
                  )}
                </div>
              ) : null}

              {isNewsletter ? (
                /* Newsletter column config */
                <>
                  <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Image Above Form</label>
                  <div style={styles.assetPicker}>
                    <label style={styles.assetUploadCta}>
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        style={styles.hiddenInput}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (!file) return;
                          await applyUploadedAsset(`${column.prefix}NewsletterImage`, file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      style={styles.secondaryBtn}
                      onClick={() => openSharedLibraryAssetPicker((asset) => {
                        const nextProps = applyAssetToProps(props, `${column.prefix}NewsletterImage`, asset);
                        onChange(index, { ...nextProps, [`${column.prefix}NewsletterImage`]: asset.src || "" });
                      })}
                    >
                      Choose From Library
                    </button>
                    {savedImages.map((asset) => (
                      <button
                        key={`nl-img-${column.id}-${asset.id || asset.src}`}
                        type="button"
                        style={styles.assetThumbBtn}
                        title={asset.name || "Image"}
                        onClick={() => {
                          const nextProps = applyAssetToProps(props, `${column.prefix}NewsletterImage`, asset);
                          onChange(index, { ...nextProps, [`${column.prefix}NewsletterImage`]: asset.src || "" });
                        }}
                      >
                        <img src={asset.src} alt={asset.name || "Image"} style={styles.assetThumbPreview} />
                      </button>
                    ))}
                    {resolveAssetField(props, `${column.prefix}NewsletterImage`, brandAssets) ? (
                      <button type="button" style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }} onClick={() => update({ [`${column.prefix}NewsletterImage`]: "", [`${column.prefix}NewsletterImageAssetId`]: undefined })}>
                        Remove Image
                      </button>
                    ) : null}
                  </div>
                  <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Heading</label>
                  <input type="text" value={String(props?.[`${column.prefix}NewsletterHeading`] || "")} onChange={(e) => update({ [`${column.prefix}NewsletterHeading`]: e.target.value })} style={styles.propertyInput} placeholder="Stay Updated" />
                  <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Subtitle</label>
                  <input type="text" value={String(props?.[`${column.prefix}NewsletterSubtitle`] || "")} onChange={(e) => update({ [`${column.prefix}NewsletterSubtitle`]: e.target.value })} style={styles.propertyInput} placeholder="Get the latest news." />

                  {/* Form Fields */}
                  <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Form Fields</label>
                  {(() => {
                    const fields = Array.isArray(props?.[`${column.prefix}NewsletterFields`]) ? props[`${column.prefix}NewsletterFields`] : [{ type: "email", placeholder: "Email address" }];
                    const fieldTypes = [
                      { value: "name", label: "Name" },
                      { value: "firstName", label: "First Name" },
                      { value: "lastName", label: "Last Name" },
                      { value: "email", label: "Email" },
                      { value: "phone", label: "Phone" },
                      { value: "company", label: "Company" },
                      { value: "message", label: "Message" },
                    ];
                    const setFields = (next) => update({ [`${column.prefix}NewsletterFields`]: next });
                    return (
                      <>
                        {fields.map((field, fi) => (
                          <div key={fi} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                            <select
                              value={field.type || "email"}
                              onChange={(e) => { const next = [...fields]; next[fi] = { ...next[fi], type: e.target.value, placeholder: fieldTypes.find(f => f.value === e.target.value)?.label || e.target.value }; setFields(next); }}
                              style={{ ...styles.propertyInput, flex: 1, margin: 0 }}
                            >
                              {fieldTypes.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                            </select>
                            <input
                              type="text"
                              value={field.placeholder || ""}
                              placeholder="Placeholder"
                              onChange={(e) => { const next = [...fields]; next[fi] = { ...next[fi], placeholder: e.target.value }; setFields(next); }}
                              style={{ ...styles.propertyInput, flex: 1, margin: 0 }}
                            />
                            <button
                              type="button"
                              style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca", flexShrink: 0, padding: "4px 8px" }}
                              onClick={() => setFields(fields.filter((_, i) => i !== fi))}
                            >✕</button>
                          </div>
                        ))}
                        <button
                          type="button"
                          style={{ ...styles.secondaryBtn, width: "100%", marginTop: 4 }}
                          onClick={() => setFields([...fields, { type: "email", placeholder: "Email address" }])}
                        >+ Add Field</button>
                      </>
                    );
                  })()}

                  <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Button Text</label>
                  <input type="text" value={String(props?.[`${column.prefix}NewsletterButtonText`] || "")} onChange={(e) => update({ [`${column.prefix}NewsletterButtonText`]: e.target.value })} style={styles.propertyInput} placeholder="Subscribe" />
                  <div style={{ ...styles.colorGrid, marginTop: 8 }}>
                    <CompactColorField label="Button Bg" value={props?.[`${column.prefix}NewsletterButtonColor`] || "#2563eb"} fallback="#2563eb" onChange={(v) => update({ [`${column.prefix}NewsletterButtonColor`]: v })} />
                    <CompactColorField label="Button Text" value={props?.[`${column.prefix}NewsletterButtonTextColor`] || "#ffffff"} fallback="#ffffff" onChange={(v) => update({ [`${column.prefix}NewsletterButtonTextColor`]: v })} />
                  </div>
                </>
              ) : (
                /* Text/Image column config */
                <>
                  <input type="text" value={String(props?.[column.titleKey] || "")} onChange={(e) => update({ [column.titleKey]: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="Column title" />
                  <textarea value={String(props?.[column.contentKey] || "")} onChange={(e) => update({ [column.contentKey]: e.target.value })} style={{ ...styles.propertyInput, minHeight: 96 }} placeholder="Column content" />
                  <div style={styles.assetPicker}>
                    <label style={styles.assetUploadCta}>
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        style={styles.hiddenInput}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (!file) return;
                          await applyUploadedAsset(column.imageKey, file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      style={styles.secondaryBtn}
                      onClick={() => openSharedLibraryAssetPicker((asset) => onSelectAsset?.(index, column.imageKey, asset))}
                    >
                      Choose From Library
                    </button>
                    {savedImages.map((asset) => (
                      <button
                        key={`${column.id}-${asset.id || asset.src}`}
                        type="button"
                        style={styles.assetThumbBtn}
                        title={asset.name || column.label}
                        onClick={() => {
                          const nextProps = applyAssetToProps(props, column.imageKey, asset);
                          onChange(index, { ...nextProps, [column.imageKey]: asset.src || "" });
                          onSelectAsset?.(index, column.imageKey, asset);
                        }}
                      >
                        <img src={asset.src} alt={asset.name || column.label} style={styles.assetThumbPreview} />
                      </button>
                    ))}
                    {imageValue ? (
                      <button type="button" style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }} onClick={() => update({ [column.imageKey]: "", [`${column.imageKey}AssetId`]: undefined })}>
                        Remove Image
                      </button>
                    ) : null}
                  </div>
                  {imageValue ? (
                    <button
                      type="button"
                      style={{ ...styles.secondaryBtn, marginTop: 8 }}
                      onClick={() => onOpenImageEditor?.(index, column.imageKey, imageValue)}
                    >
                      ✂️ Crop / Edit Image
                    </button>
                  ) : null}
                  {imageValue ? (
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <label style={styles.label}>Image Height (px)</label>
                      <input
                        type="number"
                        min={60}
                        max={1200}
                        step={10}
                        value={props?.[`${column.prefix}ImageHeight`] || ""}
                        placeholder="Auto"
                        onChange={(e) => {
                          const val = e.target.value === "" ? undefined : Number(e.target.value);
                          update({ [`${column.prefix}ImageHeight`]: val });
                        }}
                        style={{ ...styles.input, width: 90 }}
                      />
                      {props?.[`${column.prefix}ImageHeight`] ? (
                        <button type="button" style={{ ...styles.assetChip, fontSize: 16, padding: "2px 8px" }} onClick={() => update({ [`${column.prefix}ImageHeight`]: undefined })}>Auto</button>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Additional stacked images */}
                  {(() => {
                    const extraKey = `${column.prefix}ExtraImages`;
                    const extras = Array.isArray(props?.[extraKey]) ? props[extraKey] : [];
                    const setExtras = (next) => update({ [extraKey]: next });
                    return (
                      <div style={{ marginTop: 12 }}>
                        <label style={styles.propertyLabel}>Additional Images (stacked below)</label>
                        {extras.map((ei, eiIdx) => (
                          <div key={eiIdx} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px", background: "#1e293b", borderRadius: 8, border: "1px solid #334155", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, minWidth: 20 }}>#{eiIdx + 2}</span>
                              {ei.src ? (
                                <img src={ei.src} alt="" style={{ width: 40, height: 28, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                              ) : null}
                              <div style={{ flex: 1, display: "flex", gap: 4, flexWrap: "wrap" }}>
                                <label style={{ ...styles.assetUploadCta, margin: 0, fontSize: 12 }}>
                                  Upload
                                  <input type="file" accept="image/*" style={styles.hiddenInput} onChange={async (event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = "";
                                    if (!file) return;
                                    const asset = await Promise.resolve(onUploadImage?.(index, `${extraKey}_${eiIdx}`, file));
                                    if (asset?.src) {
                                      const next = extras.map((e2, i2) => i2 === eiIdx ? { ...e2, src: asset.src } : e2);
                                      setExtras(next);
                                    }
                                  }} />
                                </label>
                                <button type="button" style={{ ...styles.secondaryBtn, margin: 0, fontSize: 12, padding: "3px 8px" }} onClick={() => openSharedLibraryAssetPicker((asset) => {
                                  const next = extras.map((e2, i2) => i2 === eiIdx ? { ...e2, src: asset.src || "" } : e2);
                                  setExtras(next);
                                })}>Library</button>
                              </div>
                              <button type="button" style={{ padding: "2px 7px", borderRadius: 5, border: "none", background: "#334155", color: "#f87171", cursor: "pointer", flexShrink: 0 }} onClick={() => setExtras(extras.filter((_, i2) => i2 !== eiIdx))}>✕</button>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <label style={{ ...styles.label, fontSize: 12 }}>Height (px)</label>
                              <input type="number" min={40} max={1200} step={10} value={ei.height || ""} placeholder="Auto" onChange={(e) => {
                                const val = e.target.value === "" ? undefined : Number(e.target.value);
                                const next = extras.map((e2, i2) => i2 === eiIdx ? { ...e2, height: val } : e2);
                                setExtras(next);
                              }} style={{ ...styles.input, width: 80 }} />
                              <label style={{ ...styles.label, fontSize: 12, marginLeft: 4 }}>Gap (px)</label>
                              <input type="number" min={0} max={120} step={4} value={ei.gap ?? 8} onChange={(e) => {
                                const next = extras.map((e2, i2) => i2 === eiIdx ? { ...e2, gap: Number(e.target.value) } : e2);
                                setExtras(next);
                              }} style={{ ...styles.input, width: 60 }} />
                            </div>
                          </div>
                        ))}
                        <button type="button" style={{ ...styles.secondaryBtn, width: "100%", marginTop: 4 }} onClick={() => setExtras([...extras, { src: "", height: undefined, gap: 8 }])}>
                          + Add Image
                        </button>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Per-column style options (shared between both types) */}
              <div style={styles.colorGrid}>
                <NumberField label="Top Margin" value={Number(props?.[`${column.prefix}MarginTop`] ?? 0)} min={0} max={240} onChange={(value) => update({ [`${column.prefix}MarginTop`]: value })} />
                <NumberField label="Padding" value={Number(props?.[`${column.prefix}Padding`] ?? props.columnPadding ?? 18)} min={0} max={96} onChange={(value) => update({ [`${column.prefix}Padding`]: value })} />
                <NumberField label="Radius" value={Number(props?.[`${column.prefix}Radius`] ?? props.columnRadius ?? 18)} min={0} max={80} onChange={(value) => update({ [`${column.prefix}Radius`]: value })} />
                <NumberField label="Min Height" value={Number(props?.[`${column.prefix}MinHeight`] ?? 0)} min={0} max={1200} onChange={(value) => update({ [`${column.prefix}MinHeight`]: value })} />
              </div>
              <div style={styles.inlineChipRow}>
                {[
                  { value: "left", label: "Left" },
                  { value: "center", label: "Center" },
                  { value: "right", label: "Right" },
                ].map((option) => (
                  <button key={`${column.id}-${option.value}`} type="button" style={{ ...styles.presetChip, ...(String(props?.[`${column.prefix}ContentAlign`] || props.columnContentAlign || "left") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ [`${column.prefix}ContentAlign`]: option.value })}>
                    {option.label}
                  </button>
                ))}
              </div>
              <div style={styles.colorGrid}>
                <ColorSelector label="Background" value={props?.[`${column.prefix}BackgroundColor`] || props.columnBackgroundColor || props.cardBackgroundColor || "#f8fafc"} fallback="#f8fafc" onChange={(value) => update({ [`${column.prefix}BackgroundColor`]: value })} />
                <ColorSelector label="Border" value={props?.[`${column.prefix}BorderColor`] || props.columnBorderColor || "#cbd5e1"} fallback="#cbd5e1" onChange={(value) => update({ [`${column.prefix}BorderColor`]: value })} />
                <ColorSelector label="Title" value={props?.[`${column.prefix}TitleColor`] || props.columnTitleColor || props.textColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ [`${column.prefix}TitleColor`]: value })} />
                <ColorSelector label="Body" value={props?.[`${column.prefix}BodyColor`] || props.columnBodyColor || "#334155"} fallback="#334155" onChange={(value) => update({ [`${column.prefix}BodyColor`]: value })} />
              </div>
              <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Shadow</label>
              <div style={styles.inlineChipRow}>
                {[
                  { value: "none", label: "None" },
                  { value: "soft", label: "Soft" },
                  { value: "medium", label: "Medium" },
                  { value: "strong", label: "Strong" },
                ].map((option) => (
                  <button key={`${column.id}-shadow-${option.value}`} type="button" style={{ ...styles.presetChip, ...(String(props?.[`${column.prefix}Shadow`] || props.columnShadow || "soft") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ [`${column.prefix}Shadow`]: option.value })}>
                    {option.label}
                  </button>
                ))}
              </div>
              <input type="text" value={String(props?.[`${column.prefix}Gradient`] || "")} onChange={(e) => update({ [`${column.prefix}Gradient`]: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="linear-gradient(...)" />
              <div style={{ marginTop: 8 }}>
                <ColorSelector label="Overlay" value={props?.[`${column.prefix}OverlayColor`] || "transparent"} fallback="#000000" allowTransparent onChange={(value) => update({ [`${column.prefix}OverlayColor`]: value })} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function normalizeGridSectionItems(items) {
  if (!Array.isArray(items) || !items.length) {
    return [{ icon: "", iconName: "", iconGlyph: "", iconFontFamily: "", iconImage: "", iconAssetId: "", title: "", content: "", image: "", imageAlt: "" }];
  }

  return items.map((item) => ({
    icon: String(item?.icon || ""),
    iconName: String(item?.iconName || ""),
    iconGlyph: String(item?.iconGlyph || ""),
    iconFontFamily: String(item?.iconFontFamily || ""),
    iconImage: String(item?.iconImage || ""),
    iconAssetId: String(item?.iconAssetId || ""),
    title: htmlToPlainText(item?.title || ""),
    eyebrow: htmlToPlainText(item?.eyebrow || ""),
    content: htmlToPlainText(item?.content || ""),
    link: String(item?.link || ""),
    image: String(item?.image || ""),
    imageAlt: htmlToPlainText(item?.imageAlt || ""),
    imageHeight: item?.imageHeight,
    imageAssetId: item?.imageAssetId,
  }));
}

function renderGridFontIcon(item, color, size) {
  if (!item?.iconGlyph || !item?.iconFontFamily) return null;
  return (
    <span
      aria-hidden="true"
      style={{
        fontFamily: item.iconFontFamily,
        fontSize: size,
        lineHeight: 1,
        color,
        display: "block",
        fontStyle: "normal",
        fontWeight: 400,
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      {item.iconGlyph}
    </span>
  );
}

function resolveGridIconLibraryName(entry) {
  if (entry?.library) return String(entry.library);
  const key = String(entry?.key || "");
  const src = String(entry?.src || "");
  if (src) return "Social Files";
  if (key.startsWith("fi-")) return "Feather";
  if (key.startsWith("bs-")) return "Bootstrap";
  return "Font Awesome";
}

function renderGridEditorIcon(item, color, size) {
  const fontIcon = renderGridFontIcon(item, color, size);
  if (fontIcon) {
    return fontIcon;
  }
  const namedIcon = renderGridLibraryIcon(item?.iconName, { size, color });
  if (namedIcon) {
    return namedIcon;
  }
  if (item?.icon) {
    return <span style={{ fontSize: size, lineHeight: 1, color }}>{item.icon}</span>;
  }
  return <span style={{ fontSize: Math.max(16, Math.round(size * 0.72)), fontWeight: 600, color }}>Icon</span>;
}

function GridIconLibraryModal({ open, searchValue, onSearchChange, onClose, onSelect, entries = [] }) {
  const [activeLibrary, setActiveLibrary] = useState("all");
  const libraryOptions = useMemo(() => {
    const labels = [];
    const seen = new Set();
    entries.forEach((entry) => {
      const library = resolveGridIconLibraryName(entry);
      if (!seen.has(library)) {
        seen.add(library);
        labels.push(library);
      }
    });
    return [{ value: "all", label: "All" }, ...labels.map((label) => ({ value: label, label }))];
  }, [entries]);

  useEffect(() => {
    if (open) setActiveLibrary("all");
  }, [open]);

  const filteredIcons = useMemo(() => {
    const query = String(searchValue || "").trim().toLowerCase();
    return entries.filter((entry) => {
      const library = resolveGridIconLibraryName(entry);
      const matchesLibrary = activeLibrary === "all" || library === activeLibrary;
      const matchesQuery = !query || `${entry.label} ${entry.group} ${entry.key} ${library}`.toLowerCase().includes(query);
      return matchesLibrary && matchesQuery;
    });
  }, [activeLibrary, entries, searchValue]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.42)", display: "grid", placeItems: "center", zIndex: 10000, padding: 16 }} onClick={onClose}>
      <div style={{ width: "min(1160px, calc(100vw - 24px))", maxHeight: "min(860px, calc(100vh - 24px))", overflow: "hidden", borderRadius: 24, border: "1px solid rgba(148,163,184,0.24)", background: "#ffffff", boxShadow: "0 32px 80px rgba(2,6,23,0.28)", display: "grid", gridTemplateRows: "auto auto auto minmax(0, 1fr)" }} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "22px 24px 16px", borderBottom: "1px solid rgba(148,163,184,0.22)" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ color: "#0f172a", fontSize: 22, fontWeight: 600 }}>Icon Library</div>
            <div style={{ color: "#475569", fontSize: 16, fontWeight: 500 }}>Choose an icon. This is separate from the image library.</div>
          </div>
          <button type="button" style={{ ...styles.secondaryBtn, minWidth: 0 }} onClick={onClose}>Close</button>
        </div>

        <div style={{ padding: "18px 24px 0" }}>
          <input type="text" value={searchValue} onChange={(event) => onSearchChange(event.target.value)} style={{ ...styles.propertyInput, minHeight: 52, fontSize: 16, background: "#ffffff", color: "#0f172a", border: "1px solid rgba(148,163,184,0.35)" }} placeholder="Filter icons by name" autoFocus />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "14px 24px 0" }}>
          {libraryOptions.map((option) => {
            const isActive = activeLibrary === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setActiveLibrary(option.value)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 999,
                  border: isActive ? "1px solid #1d4ed8" : "1px solid rgba(148,163,184,0.35)",
                  background: isActive ? "#dbeafe" : "#ffffff",
                  color: isActive ? "#1e3a8a" : "#334155",
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 24, overflow: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(164px, 1fr))", gap: 16 }}>
            {filteredIcons.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => onSelect(entry)}
                style={{ display: "grid", gap: 12, justifyItems: "center", alignContent: "start", minHeight: 148, padding: 18, borderRadius: 18, border: "1px solid rgba(148,163,184,0.22)", background: "#162235", color: "#e2e8f0", cursor: "pointer", textAlign: "center" }}
              >
                <div style={{ width: 72, height: 72, borderRadius: 16, background: "#0b1220", border: "1px solid rgba(148,163,184,0.2)", display: "grid", placeItems: "center" }}>
                  {entry.src ? <img src={entry.src} alt={entry.label || "Icon"} style={{ width: 32, height: 32, objectFit: "contain", display: "block" }} /> : entry.fontFamily && entry.glyph ? renderGridFontIcon({ iconGlyph: entry.glyph, iconFontFamily: entry.fontFamily }, "#e2e8f0", 32) : renderGridLibraryIcon(entry.key, { size: 32, color: "#e2e8f0" })}
                </div>
                <div style={{ display: "grid", gap: 2 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25 }}>{entry.label}</div>
                  <div style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.25 }}>{resolveGridIconLibraryName(entry)}</div>
                </div>
              </button>
            ))}
          </div>
          {!filteredIcons.length ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "#64748b", fontSize: 17 }}>No icons match that search.</div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function isBuiltinGridDecorationAsset(asset) {
  return String(asset?.id || "").startsWith("builtin-deco-");
}

const LIVE_SERVICES_GRID_PRESET = {
  title: "Our Services",
  columns: 4,
  gridVariant: "services",
  columnBackgroundColor: "#ffffff",
  columnBorderColor: "rgba(148,163,184,0.18)",
  columnTitleColor: "#0f172a",
  columnBodyColor: "#475569",
  columnPadding: 18,
  columnRadius: 22,
  columnShadow: "soft",
  columnGap: 24,
  iconBackgroundColor: "#ffffff",
  iconColor: "#0f172a",
  iconSize: 20,
  imageRadius: 18,
  items: [
    { title: "Social Media", eyebrow: "Content Creation", iconName: "social", content: "", link: "https://gr8result.com/social-media/", image: "/imported/gr8-services/social-media.jpg", imageAlt: "Gr8 Result Digital Solutions.", imageHeight: 150 },
    { title: "Software", eyebrow: "Business Software", iconName: "software", content: "", link: "https://gr8result.com/software/", image: "/imported/gr8-services/software.png", imageAlt: "Gr8 Result Digital Solutions.", imageHeight: 150 },
    { title: "Graphic Arts", eyebrow: "Graphic Design", iconName: "design", content: "", link: "https://gr8result.com/graphic-design/", image: "/imported/gr8-services/graphic-arts.png", imageAlt: "Gr8 Result Digital Solutions.", imageHeight: 150 },
    { title: "Websites", eyebrow: "Design and SEO", iconName: "web", content: "", link: "https://gr8result.com/website-development/", image: "/imported/gr8-services/websites.jpg", imageAlt: "Gr8 Result Digital Solutions.", imageHeight: 150 },
    { title: "Videos", eyebrow: "AI Avatars", iconName: "video", content: "", link: "https://gr8result.com/videos/", image: "/imported/gr8-services/videos.jpg", imageAlt: "Gr8 Result Digital Solutions.", imageHeight: 150 },
    { title: "SEO", eyebrow: "Organic Growth", iconName: "seo", content: "", link: "https://gr8result.com/seo/", image: "/imported/gr8-services/seo.jpg", imageAlt: "Gr8 Result Digital Solutions.", imageHeight: 150 },
    { title: "Email", eyebrow: "Email marketing", iconName: "email", content: "", link: "https://gr8result.com/email-marketing/", image: "/imported/gr8-services/email.jpg", imageAlt: "Gr8 Result Digital Solutions.", imageHeight: 150 },
    { title: "Digital Marketing", eyebrow: "Google & Meta Ads", iconName: "marketing", content: "", link: "https://gr8result.com/branding-design/", image: "/imported/gr8-services/digital-marketing.jpg", imageAlt: "Gr8 Result Digital Solutions.", imageHeight: 150 },
  ],
};

const SERVICES_STYLE_OPTIONS = [
  { value: "style-01", label: "Style 01" },
  { value: "style-02", label: "Style 02" },
  { value: "style-03", label: "Style 03" },
];

const SERVICES_COLOR_OPTIONS = [
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
];

const SERVICES_LAYOUT_OPTIONS = [
  { value: "grid", label: "Grid" },
  { value: "slider", label: "Slider" },
];

function GridSectionPropertiesPanel({ block, index, onChange, brandAssets, onRefreshAssetLibrary }) {
  const props = block?.props || {};
  const [activeTab, setActiveTab] = useState("content");
  const [expandedCardIndex, setExpandedCardIndex] = useState(0);
  const [iconLibraryState, setIconLibraryState] = useState({ itemIndex: null, search: "" });
  const [discoveredIconEntries, setDiscoveredIconEntries] = useState([]);
  const safeItems = normalizeGridSectionItems(props.items);
  const update = (patch) => onChange(index, { ...props, ...patch });
  const updateItem = (itemIndex, patch) => {
    const nextItems = safeItems.map((item, currentIndex) => (
      currentIndex === itemIndex ? { ...item, ...patch } : item
    ));
    update({ items: nextItems });
  };
  const addItem = () => {
    update({
      items: [...safeItems, { icon: "", iconName: "", iconGlyph: "", iconFontFamily: "", iconImage: "", iconAssetId: "", title: `Grid card ${safeItems.length + 1}`, eyebrow: "", content: "Add your supporting detail here.", link: "", image: "", imageAlt: "", imageAssetId: "" }],
    });
    setExpandedCardIndex(safeItems.length);
  };
  const removeItem = (itemIndex) => {
    const nextItems = safeItems.filter((_, currentIndex) => currentIndex !== itemIndex);
    update({ items: nextItems.length ? nextItems : [{ icon: "", iconName: "", iconGlyph: "", iconFontFamily: "", iconImage: "", iconAssetId: "", title: "", eyebrow: "", content: "", link: "", image: "", imageAlt: "", imageAssetId: "" }] });
    setExpandedCardIndex((prev) => (prev === itemIndex ? Math.max(0, itemIndex - 1) : prev));
  };
  const moveItem = (itemIndex, direction) => {
    const targetIndex = itemIndex + direction;
    if (targetIndex < 0 || targetIndex >= safeItems.length) return;
    const nextItems = [...safeItems];
    const [moved] = nextItems.splice(itemIndex, 1);
    nextItems.splice(targetIndex, 0, moved);
    update({ items: nextItems });
    setExpandedCardIndex(targetIndex);
  };
  const updateItemText = (itemIndex, key, value) => {
    updateItem(itemIndex, { [key]: htmlToPlainText(value) });
  };
  const safeItemsRef = useRef(safeItems);
  safeItemsRef.current = safeItems;
  const updateItemRef = useRef(updateItem);
  updateItemRef.current = updateItem;
  const openLibraryFallback = () => {
    if (typeof window === "undefined") return;
    window.open("/assets?view=generic", "_blank", "noopener,noreferrer");
  };
  const openGridImagePicker = (itemIndex) => {
    openSharedMediaPicker({
      view: "generic",
      onPick: (asset) => {
        if (!asset?.src) return;
        updateItemRef.current(itemIndex, {
          image: asset.src || "",
          imageAssetId: asset.id || "",
          imageAlt: htmlToPlainText(asset.name || safeItemsRef.current[itemIndex]?.imageAlt || ""),
        });
      },
      onBlocked: openLibraryFallback,
    });
  };
  const openGridIconLibrary = (itemIndex) => {
    setIconLibraryState({ itemIndex, search: "" });
  };
  const closeGridIconLibrary = () => {
    setIconLibraryState({ itemIndex: null, search: "" });
  };
  const applyGridIcon = (entry) => {
    if (!Number.isInteger(iconLibraryState.itemIndex)) return;
    if (entry?.src) {
      updateItem(iconLibraryState.itemIndex, {
        iconName: "",
        icon: "",
        iconGlyph: "",
        iconFontFamily: "",
        iconImage: String(entry.src || ""),
        iconAssetId: String(entry.assetId || ""),
      });
    } else if (entry?.fontFamily && entry?.glyph) {
      updateItem(iconLibraryState.itemIndex, {
        iconName: "",
        icon: "",
        iconGlyph: String(entry.glyph || ""),
        iconFontFamily: String(entry.fontFamily || ""),
        iconImage: "",
        iconAssetId: "",
      });
    } else {
      updateItem(iconLibraryState.itemIndex, {
        iconName: String(entry?.key || ""),
        icon: "",
        iconGlyph: "",
        iconFontFamily: "",
        iconImage: "",
        iconAssetId: "",
      });
    }
    closeGridIconLibrary();
  };
  const serviceStyleValue = String(props.servicesStylePreset || "style-01");
  const serviceColorValue = String(props.servicesColorPreset || "blue");
  const serviceLayoutValue = String(props.servicesLayoutMode || "grid");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/website-builder/icon-library")
      .then((response) => response.ok ? response.json() : { entries: [] })
      .then((payload) => {
        if (cancelled) return;
        setDiscoveredIconEntries(Array.isArray(payload?.entries) ? payload.entries : []);
      })
      .catch(() => {
        if (!cancelled) setDiscoveredIconEntries([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const iconLibraryEntries = useMemo(() => {
    const seen = new Set();
    return [...GRID_ICON_LIBRARY, ...discoveredIconEntries].filter((entry) => {
      const dedupeKey = String(entry?.src || entry?.key || `${entry?.fontFamily || ""}-${entry?.glyph || ""}`);
      if (!dedupeKey || seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    });
  }, [discoveredIconEntries]);

  return (
    <div style={styles.properties}>
      <GridIconLibraryModal
        open={Number.isInteger(iconLibraryState.itemIndex)}
        searchValue={iconLibraryState.search}
        onSearchChange={(value) => setIconLibraryState((current) => ({ ...current, search: value }))}
        onClose={closeGridIconLibrary}
        onSelect={applyGridIcon}
        entries={iconLibraryEntries}
      />
      <h3 style={styles.propertiesTitle}>▦ Edit: Grid Section</h3>
      <div style={styles.tabRow}>
        {[
          { id: "content", label: `Content (${safeItems.length})` },
          { id: "layout", label: "Layout" },
          { id: "colors", label: "Appearance" },
          { id: "animations", label: "Animations" },
        ].map((tab) => (
          <button
            key={`grid-tab-${tab.id}`}
            type="button"
            style={{ ...styles.tabChip, ...(activeTab === tab.id ? styles.tabChipActive : {}) }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={styles.propertyGrid}>
        {activeTab === "layout" ? (
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Section Layout</label>
          <input type="text" value={props.title || ""} onChange={(event) => update({ title: event.target.value })} style={styles.propertyInput} placeholder="Section heading" />
          <button type="button" style={{ ...styles.secondaryBtn, width: "100%", marginTop: 8 }} onClick={() => update({ ...LIVE_SERVICES_GRID_PRESET, backgroundColor: props.backgroundColor || "transparent", textColor: props.textColor || "#0f172a", stretchToCanvas: true })}>Apply Live Services Preset</button>
          <div style={{ ...styles.colorGrid, marginTop: 8 }}>
            <NumberField label="Columns" value={Math.max(1, Math.min(6, Number(props.columns) || 3))} min={1} max={6} onChange={(value) => update({ columns: value })} />
            <NumberField label="Grid Gap" value={Number(props.columnGap ?? 20)} min={0} max={120} onChange={(value) => update({ columnGap: value })} />
            <NumberField label="Top Margin" value={Number(props.columnsTopMargin ?? 18)} min={0} max={240} onChange={(value) => update({ columnsTopMargin: value })} />
            <NumberField label="Block Max Width" value={Number(props.blockMaxWidth) || 1200} min={320} max={1800} onChange={(value) => update({ blockMaxWidth: value })} />
            <NumberField label="Section Height" value={parsePixelValue(props.sectionHeight || props.minHeight, 280)} min={160} max={1400} onChange={(value) => update({ sectionHeight: `${value}px`, minHeight: `${value}px` })} />
            <NumberField label="Item Min Height" value={Number(props.gridItemMinHeight ?? 0)} min={0} max={1200} onChange={(value) => update({ gridItemMinHeight: value })} />
            <NumberField label="Main Title Size" value={Number(props.cardTitleSize ?? 28)} min={16} max={72} onChange={(value) => update({ cardTitleSize: value })} />
            <NumberField label="Subtitle Size" value={Number(props.eyebrowFontSize ?? 18)} min={12} max={48} onChange={(value) => update({ eyebrowFontSize: value })} />
            <NumberField label="Icon Size" value={Number(props.iconSize ?? 36)} min={14} max={96} onChange={(value) => update({ iconSize: value })} />
          </div>
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input type="checkbox" checked={props.stretchToCanvas !== false} onChange={(event) => update({ stretchToCanvas: event.target.checked })} style={styles.checkboxInput} />
            Stretch services grid edge-to-edge on the canvas
          </label>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Vertical Alignment</label>
          <div style={styles.inlineChipRow}>
            {[
              { value: "top", label: "Top" },
              { value: "center", label: "Center" },
              { value: "bottom", label: "Bottom" },
            ].map((option) => (
              <button key={`grid-align-${option.value}`} type="button" style={{ ...styles.presetChip, ...(String(props.columnsVerticalAlign || "top") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ columnsVerticalAlign: option.value })}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
        ) : null}

        {activeTab === "content" ? (
          <>
        <div style={styles.sectionCard}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={styles.propertyLabel}>Services Styles</label>
              <select
                value={serviceStyleValue}
                onChange={(event) => update({ gridVariant: "services", servicesStylePreset: event.target.value })}
                style={styles.propertyInput}
              >
                {SERVICES_STYLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={styles.propertyLabel}>Color Styles</label>
              <select
                value={serviceColorValue}
                onChange={(event) => update({
                  gridVariant: "services",
                  servicesColorPreset: event.target.value,
                  backgroundColor: "",
                  cardBackgroundColor: "",
                  columnBackgroundColor: "",
                  columnTitleColor: "",
                  columnBodyColor: "",
                  eyebrowColor: "",
                  textColor: "",
                  sectionTitleColor: "",
                  iconBackgroundColor: "",
                  iconColor: "",
                })}
                style={styles.propertyInput}
              >
                {SERVICES_COLOR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div style={styles.colorGrid}>
              <div style={styles.propertyField}>
                <label style={styles.propertyLabel}>Layout</label>
                <select
                  value={serviceLayoutValue}
                  onChange={(event) => update({ gridVariant: "services", servicesLayoutMode: event.target.value })}
                  style={styles.propertyInput}
                >
                  {SERVICES_LAYOUT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div style={styles.propertyField}>
                <label style={styles.propertyLabel}>Grid Column</label>
                <select
                  value={String(Math.max(2, Math.min(5, Number(props.columns) || 4)))}
                  onChange={(event) => update({ columns: Number(event.target.value) || 4 })}
                  style={styles.propertyInput}
                  disabled={serviceLayoutValue === "slider"}
                >
                  {[2, 3, 4, 5].map((count) => <option key={`services-columns-${count}`} value={String(count)}>{`${count} column`}{count > 1 ? "s" : ""}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.sectionCard}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <label style={styles.propertyLabel}>Cards</label>
            <button type="button" style={styles.secondaryBtn} onClick={addItem}>Add New</button>
          </div>
        </div>

        {safeItems.map((item, itemIndex) => {
          const resolvedImage = String(item.image || getAssetFromLibrary(brandAssets, item.imageAssetId)?.src || "");
          const resolvedIconImage = String(item.iconImage || getAssetFromLibrary(brandAssets, item.iconAssetId)?.src || "");
          const isOpen = expandedCardIndex === itemIndex;
          return (
            <div key={`grid-item-panel-${itemIndex}`} style={styles.sectionCard}>
              <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => setExpandedCardIndex((prev) => (prev === itemIndex ? -1 : itemIndex))}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "56px 56px minmax(0, 1fr)",
                    gap: 10,
                    alignItems: "center",
                    width: "100%",
                    background: isOpen ? "#223653" : "#1a2940",
                    border: isOpen ? "1px solid #5f84b0" : "1px solid #41577a",
                    borderRadius: 14,
                    padding: 12,
                    cursor: "pointer",
                    textAlign: "left",
                    minWidth: 0,
                    boxShadow: isOpen ? "0 0 0 1px rgba(125,211,252,0.18)" : "none",
                  }}
                >
                  <div style={{ width: 56, height: 56, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(148,163,184,0.28)", background: "#0d1522", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    {resolvedImage ? <img src={resolvedImage} alt={item.imageAlt || item.title || `Card ${itemIndex + 1} image`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 16, fontWeight: 600, color: "#cbd5e1" }}>Image</span>}
                  </div>
                  <div style={{ width: 56, height: 56, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(148,163,184,0.28)", background: "#0d1522", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    {resolvedIconImage ? <img src={resolvedIconImage} alt={item.title || `Card ${itemIndex + 1} icon`} style={{ width: 36, height: 36, objectFit: "contain" }} /> : renderGridEditorIcon(item, "#cbd5e1", 22)}
                  </div>
                  <div style={{ minWidth: 0, display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#f8fafc", lineHeight: 1.3, wordBreak: "break-word", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{htmlToPlainText(item.title || item.eyebrow || `Card ${itemIndex + 1}`)}</div>
                    <div style={{ fontSize: 16, fontWeight: 500, color: "#cbd5e1", lineHeight: 1.35, wordBreak: "break-word", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{htmlToPlainText(item.eyebrow || item.link || "Click to edit this card")}</div>
                  </div>
                </button>
              </div>

              {isOpen ? (
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={{ display: "grid", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => openGridImagePicker(itemIndex)}
                      style={{ display: "grid", gap: 10, padding: 12, borderRadius: 14, background: "#1a2940", border: "1px solid #41577a", textAlign: "left", cursor: "pointer" }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>Image</div>
                      <div style={{ width: "100%", minHeight: 132, borderRadius: 14, border: "1px solid rgba(148,163,184,0.28)", background: "#0d1522", display: "grid", placeItems: "center", overflow: "hidden" }}>
                        {resolvedImage ? <img src={resolvedImage} alt={item.imageAlt || item.title || `Card ${itemIndex + 1} image`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 16, fontWeight: 600, color: "#cbd5e1" }}>Choose image</span>}
                      </div>
                    </button>
                    {resolvedImage ? (
                      <button type="button" style={{ ...styles.secondaryBtn, justifySelf: "start" }} onClick={() => updateItem(itemIndex, { image: "", imageAlt: "", imageAssetId: "" })}>Remove Image</button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => openGridIconLibrary(itemIndex)}
                      style={{ display: "grid", gap: 10, padding: 12, borderRadius: 14, background: "#1a2940", border: "1px solid #41577a", textAlign: "left", cursor: "pointer" }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>Icon</div>
                      <div style={{ width: "100%", minHeight: 132, borderRadius: 14, border: "1px solid rgba(148,163,184,0.28)", background: "#0d1522", display: "grid", placeItems: "center", overflow: "hidden" }}>
                        {resolvedIconImage ? <img src={resolvedIconImage} alt={item.title || `Card ${itemIndex + 1} icon`} style={{ width: 64, height: 64, objectFit: "contain" }} /> : renderGridEditorIcon(item, "#cbd5e1", 28)}
                      </div>
                    </button>
                    {resolvedIconImage ? (
                      <button type="button" style={{ ...styles.secondaryBtn, justifySelf: "start" }} onClick={() => updateItem(itemIndex, { iconImage: "", iconAssetId: "", iconName: "", icon: "" })}>Remove Icon</button>
                    ) : null}
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <label style={styles.propertyLabel}>Main Title</label>
                    <input type="text" value={htmlToPlainText(item.title || "")} onChange={(event) => updateItemText(itemIndex, "title", event.target.value)} style={styles.propertyInput} placeholder="Main card title" />
                    <label style={styles.propertyLabel}>Subtitle</label>
                    <input type="text" value={htmlToPlainText(item.eyebrow || "")} onChange={(event) => updateItemText(itemIndex, "eyebrow", event.target.value)} style={styles.propertyInput} placeholder="Subtitle under the title" />
                    <input type="text" value={item.link || ""} onChange={(event) => updateItem(itemIndex, { link: event.target.value })} style={styles.propertyInput} placeholder="https://..." />
                    <input type="text" value={htmlToPlainText(item.imageAlt || "")} onChange={(event) => updateItemText(itemIndex, "imageAlt", event.target.value)} style={styles.propertyInput} placeholder="Image alt text" />
                    <NumberField label="Image Height" value={Number(item.imageHeight ?? 0)} min={0} max={1200} onChange={(value) => updateItem(itemIndex, { imageHeight: value || undefined })} />
                    <textarea value={htmlToPlainText(item.content || "")} onChange={(event) => updateItemText(itemIndex, "content", event.target.value)} style={{ ...styles.propertyInput, minHeight: 112 }} placeholder="Card content" />
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-start" }}>
                    <button type="button" style={styles.secondaryBtn} onClick={() => moveItem(itemIndex, -1)} disabled={itemIndex === 0}>Up</button>
                    <button type="button" style={styles.secondaryBtn} onClick={() => moveItem(itemIndex, 1)} disabled={itemIndex === safeItems.length - 1}>Down</button>
                    <button type="button" style={{ ...styles.secondaryBtn, color: "#ef4444", borderColor: "rgba(239,68,68,0.35)" }} onClick={() => removeItem(itemIndex)}>Remove</button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
          </>
        ) : null}
        {activeTab === "colors" ? (
        <>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Section Background</label>
            <ColorSelector label="Section Background" value={props.backgroundColor || "transparent"} fallback="#0f172a" allowTransparent onChange={(value) => update({ backgroundColor: value })} />
            <ColorSelector label="Section Title Color" value={props.sectionTitleColor || "#f8fafc"} fallback="#f8fafc" onChange={(value) => update({ sectionTitleColor: value })} />
            {props.sectionBackgroundImage ? (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <img src={props.sectionBackgroundImage} alt="Section background" style={{ width: 64, height: 40, objectFit: "cover", borderRadius: 6, border: "1px solid rgba(148,163,184,0.28)", flexShrink: 0 }} />
                <button type="button" style={{ ...styles.secondaryBtn, color: "#ef4444", borderColor: "rgba(239,68,68,0.35)" }} onClick={() => update({ sectionBackgroundImage: "" })}>Clear Background Image</button>
              </div>
            ) : null}
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Card Colors</label>
            <ColorSelector label="Card Background" value={props.cardBackgroundColor || props.columnBackgroundColor || "transparent"} fallback="#1e293b" allowTransparent onChange={(value) => update({ cardBackgroundColor: value, columnBackgroundColor: value })} />
            <ColorSelector label="Card Title Color" value={props.columnTitleColor || "#f8fafc"} fallback="#f8fafc" onChange={(value) => update({ columnTitleColor: value })} />
            <ColorSelector label="Eyebrow / Subtitle Color" value={props.eyebrowColor || "#94a3b8"} fallback="#94a3b8" onChange={(value) => update({ eyebrowColor: value })} />
            <ColorSelector label="Body Text Color" value={props.columnBodyColor || "#cbd5e1"} fallback="#cbd5e1" onChange={(value) => update({ columnBodyColor: value })} />
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Icon Colors</label>
            <ColorSelector label="Icon Background" value={props.iconBackgroundColor || "transparent"} fallback="#0ea5e9" allowTransparent onChange={(value) => update({ iconBackgroundColor: value })} />
            <ColorSelector label="Icon Color" value={props.iconColor || "#38bdf8"} fallback="#38bdf8" onChange={(value) => update({ iconColor: value })} />
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Reset Colors</label>
            <button
              type="button"
              style={{ ...styles.secondaryBtn, width: "100%" }}
              onClick={() => update({
                backgroundColor: "", sectionTitleColor: "", cardBackgroundColor: "",
                columnBackgroundColor: "", columnTitleColor: "", columnBodyColor: "",
                eyebrowColor: "", iconBackgroundColor: "", iconColor: "",
                servicesColorPreset: "blue",
              })}
            >
              Reset to Color Preset Defaults
            </button>
          </div>
        </>
        ) : null}
        {activeTab === "animations" ? (
        <>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Section Entrance</label>
            <select value={String(props.sectionAnimation || "none")} onChange={(event) => update({ sectionAnimation: event.target.value })} style={styles.propertyInput}>
              {ANIMATION_PRESETS.map((preset) => <option key={`grid-section-anim-${preset.value}`} value={preset.value}>{preset.label}</option>)}
            </select>
            <div style={styles.colorGrid}>
              <NumberField label="Delay (s)" value={Number(props.sectionAnimationDelay ?? 0)} min={0} max={4} onChange={(value) => update({ sectionAnimationDelay: Number(value) })} />
              <NumberField label="Speed (s)" value={Number(props.sectionAnimationSpeed ?? 0.8)} min={0.2} max={4} onChange={(value) => update({ sectionAnimationSpeed: Number(value) })} />
            </div>
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Card Item Animation (Stagger)</label>
            <select value={String(props.cardAnimation || props.itemAnimation || "none")} onChange={(event) => update({ cardAnimation: event.target.value, itemAnimation: event.target.value })} style={styles.propertyInput}>
              {ANIMATION_PRESETS.map((preset) => <option key={`grid-card-anim-${preset.value}`} value={preset.value}>{preset.label}</option>)}
            </select>
            <div style={styles.colorGrid}>
              <NumberField label="Stagger Delay (s)" value={Number(props.cardAnimationStagger ?? props.itemAnimationStagger ?? 0.1)} min={0} max={1} onChange={(value) => update({ cardAnimationStagger: Number(value), itemAnimationStagger: Number(value) })} />
              <NumberField label="Speed (s)" value={Number(props.cardAnimationSpeed ?? props.itemAnimationSpeed ?? 0.7)} min={0.2} max={4} onChange={(value) => update({ cardAnimationSpeed: Number(value), itemAnimationSpeed: Number(value) })} />
            </div>
          </div>
        </>
        ) : null}
      </div>
    </div>
  );
}

// ─── Hover Cards Properties Panel ─────────────────────────────────────────────
function HoverCardsPropertiesPanel({ block, index, onChange, onUploadImage }) {
  const props = block?.props || {};
  const update = (patch) => onChange(index, { ...props, ...patch });
  const cards = Array.isArray(props.cards) ? props.cards : [];
  const [expandedCard, setExpandedCard] = useState(0);

  const updateCard = (cardIndex, patch) => {
    const nextCards = cards.map((card, i) => (i === cardIndex ? { ...card, ...patch } : card));
    update({ cards: nextCards });
  };

  const addCard = () => {
    const newId = `hc-${Date.now()}`;
    update({
      cards: [...cards, { id: newId, title: `Card ${cards.length + 1}`, description: "Add a short description here.", image: "", cardColor: "#dde3ea", link: "#" }],
    });
    setExpandedCard(cards.length);
  };

  const removeCard = (cardIndex) => {
    if (cards.length <= 1) return;
    const nextCards = cards.filter((_, i) => i !== cardIndex);
    update({ cards: nextCards });
    setExpandedCard((prev) => Math.min(prev, nextCards.length - 1));
  };

  const openCardImagePicker = (cardIndex) => {
    openSharedMediaPicker({
      view: "generic",
      onPick: (asset) => { if (asset?.src) updateCard(cardIndex, { image: asset.src }); },
      onBlocked: () => window.open("/assets?view=generic", "_blank", "noopener,noreferrer"),
    });
  };

  // Parse overlay color for color input (hex only)
  const overlayHex = (() => {
    const raw = String(props.overlayColor || "rgba(0,0,0,0.85)");
    const match = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match) {
      return "#" + [match[1], match[2], match[3]].map((n) => parseInt(n, 10).toString(16).padStart(2, "0")).join("");
    }
    return raw.startsWith("#") ? raw.slice(0, 7) : "#000000";
  })();

  const overlayOpacity = (() => {
    const match = String(props.overlayColor || "").match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)/);
    return match ? Math.round(parseFloat(match[1]) * 100) : 85;
  })();

  const setOverlay = (hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    update({ overlayColor: `rgba(${r},${g},${b},${(opacity / 100).toFixed(2)})` });
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🃏 Edit: Hover Cards</h3>
      <div style={styles.propertyGrid}>

        {/* Section title */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Section Title</label>
          <input type="text" value={String(props.sectionTitle || "")} onChange={(e) => update({ sectionTitle: e.target.value })} style={styles.propertyInput} placeholder="e.g. Our Services" />
          <div style={styles.colorGrid}>
            <div>
              <label style={styles.propertyLabel}>Title Color</label>
              <input type="color" value={String(props.sectionTitleColor || "#0f172a")} onChange={(e) => update({ sectionTitleColor: e.target.value })} style={styles.colorSwatch} />
            </div>
            <NumberField label="Title Size (px)" value={Number(props.sectionTitleSize || 32)} min={14} max={72} onChange={(v) => update({ sectionTitleSize: v })} />
          </div>
        </div>

        {/* Carousel layout */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Carousel</label>
          {/* Full-width toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <label style={{ ...styles.propertyLabel, marginBottom: 0, flex: 1 }}>Full Page Width</label>
            <div
              onClick={() => update({ fullWidth: !props.fullWidth })}
              style={{
                width: 42, height: 24, borderRadius: 12,
                background: props.fullWidth ? "#6366f1" : "rgba(255,255,255,0.15)",
                position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s",
              }}
            >
              <div style={{
                position: "absolute", top: 3, left: props.fullWidth ? 21 : 3,
                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
              }} />
            </div>
          </div>
          <div style={styles.colorGrid}>
            {!props.fullWidth ? (
              <NumberField label="Visible Cards" value={Number(props.visibleCards || 3)} min={1} max={6} onChange={(v) => update({ visibleCards: v })} />
            ) : (
              <NumberField label="Min Card Width (px)" value={Number(props.minCardWidth || 280)} min={160} max={600} onChange={(v) => update({ minCardWidth: v })} />
            )}
            <NumberField label="Card Height (px)" value={Number(props.cardHeight || 320)} min={120} max={720} onChange={(v) => update({ cardHeight: v })} />
            <NumberField label="Card Radius (px)" value={Number(props.cardRadius || 12)} min={0} max={48} onChange={(v) => update({ cardRadius: v })} />
            <NumberField label="Gap Between Cards (px)" value={Number(props.cardGap || 16)} min={0} max={64} onChange={(v) => update({ cardGap: v })} />
            <NumberField label="Card Padding (px)" value={Number(props.cardPadding || 20)} min={8} max={60} onChange={(v) => update({ cardPadding: v })} />
            <NumberField label="Auto-Play Interval (ms)" value={Number(props.autoPlayInterval || 3500)} min={1000} max={10000} onChange={(v) => update({ autoPlayInterval: v })} />
          </div>
        </div>

        {/* Section spacing */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Section Spacing</label>
          <div style={styles.colorGrid}>
            <NumberField label="Top Padding (px)" value={Number(props.paddingTop ?? 48)} min={0} max={200} onChange={(v) => update({ paddingTop: v })} />
            <NumberField label="Bottom Padding (px)" value={Number(props.paddingBottom ?? 48)} min={0} max={200} onChange={(v) => update({ paddingBottom: v })} />
            <NumberField label="Side Padding (px)" value={Number(props.paddingSides ?? 40)} min={0} max={120} onChange={(v) => update({ paddingSides: v })} />
            {!props.fullWidth ? (
              <NumberField label="Max Width (px)" value={Number(props.maxWidth || 1200)} min={400} max={1800} onChange={(v) => update({ maxWidth: v })} />
            ) : null}
          </div>
        </div>

        {/* Section & card background */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Background Colors</label>
          <div style={styles.colorGrid}>
            <div>
              <label style={styles.propertyLabel}>Section BG</label>
              <input type="color" value={String(props.backgroundColor || "#f8fafc")} onChange={(e) => update({ backgroundColor: e.target.value })} style={styles.colorSwatch} />
            </div>
            <div>
              <label style={styles.propertyLabel}>Default Card BG</label>
              <input type="color" value={String(props.cardColor || "#dde3ea")} onChange={(e) => update({ cardColor: e.target.value })} style={styles.colorSwatch} />
            </div>
          </div>
        </div>

        {/* Back card face color */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Hover (Back Face)</label>
          <div style={styles.colorGrid}>
            <div>
              <label style={styles.propertyLabel}>Back Color</label>
              <input type="color" value={overlayHex} onChange={(e) => setOverlay(e.target.value, overlayOpacity)} style={styles.colorSwatch} />
            </div>
            <NumberField label="Opacity (%)" value={overlayOpacity} min={10} max={100} onChange={(v) => setOverlay(overlayHex, v)} />
            <NumberField label="Title Size (px)" value={Number(props.backTitleSize || 20)} min={10} max={64} onChange={(v) => update({ backTitleSize: v })} />
            <NumberField label="Description Size (px)" value={Number(props.backDescSize || 15)} min={8} max={48} onChange={(v) => update({ backDescSize: v })} />
          </div>
        </div>

        {/* Button */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Learn More Button</label>
          <label style={styles.propertyLabel}>Button Text</label>
          <input type="text" value={String(props.buttonText || "Learn more →")} onChange={(e) => update({ buttonText: e.target.value })} style={styles.propertyInput} />
          <div style={styles.colorGrid}>
            <div>
              <label style={styles.propertyLabel}>Button BG</label>
              <input type="color" value={String(props.buttonColor || "#ffffff")} onChange={(e) => update({ buttonColor: e.target.value })} style={styles.colorSwatch} />
            </div>
            <div>
              <label style={styles.propertyLabel}>Button Text</label>
              <input type="color" value={String(props.buttonTextColor || "#0f172a")} onChange={(e) => update({ buttonTextColor: e.target.value })} style={styles.colorSwatch} />
            </div>
          </div>
        </div>

        {/* Arrow buttons */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Arrow Buttons</label>
          <div style={styles.colorGrid}>
            <div>
              <label style={styles.propertyLabel}>Arrow BG</label>
              <input type="color" value={String(props.arrowBg || "#ffffff")} onChange={(e) => update({ arrowBg: e.target.value })} style={styles.colorSwatch} />
            </div>
            <div>
              <label style={styles.propertyLabel}>Arrow Color</label>
              <input type="color" value={String(props.arrowColor || "#0f172a")} onChange={(e) => update({ arrowColor: e.target.value })} style={styles.colorSwatch} />
            </div>
          </div>
        </div>

        {/* Cards list */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Cards ({cards.length})</label>
          <div style={{ display: "grid", gap: 8 }}>
            {cards.map((card, cardIndex) => {
              const isOpen = expandedCard === cardIndex;
              return (
                <div key={card.id || cardIndex} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, overflow: "hidden" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(255,255,255,0.05)", cursor: "pointer" }}
                    onClick={() => setExpandedCard(isOpen ? -1 : cardIndex)}
                  >
                    <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {card.title || `Card ${cardIndex + 1}`}
                    </span>
                    {cards.length > 1 ? (
                      <button type="button" style={{ ...styles.linkMoveBtn, color: "#f87171", fontSize: 16 }} onClick={(e) => { e.stopPropagation(); removeCard(cardIndex); }} title="Remove">✕</button>
                    ) : null}
                    <span style={{ color: "#94a3b8", fontSize: 16 }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                  {isOpen ? (
                    <div style={{ padding: "10px 10px 14px", display: "grid", gap: 8 }}>
                      <div>
                        <label style={styles.propertyLabel}>Title</label>
                        <input type="text" value={String(card.title || "")} onChange={(e) => updateCard(cardIndex, { title: e.target.value })} style={styles.propertyInput} placeholder="Card title" />
                      </div>
                      <div>
                        <label style={styles.propertyLabel}>Description (shown on hover)</label>
                        <textarea value={String(card.description || "")} onChange={(e) => updateCard(cardIndex, { description: e.target.value })} style={{ ...styles.propertyInput, height: 68, resize: "vertical" }} placeholder="Short description..." />
                      </div>
                      <div>
                        <label style={styles.propertyLabel}>Link URL</label>
                        <input type="text" value={String(card.link || "")} onChange={(e) => updateCard(cardIndex, { link: e.target.value })} style={styles.propertyInput} placeholder="https://..." />
                      </div>
                      <div>
                        <label style={styles.propertyLabel}>Card Background Color</label>
                        <input type="color" value={String(card.cardColor || props.cardColor || "#dde3ea")} onChange={(e) => updateCard(cardIndex, { cardColor: e.target.value })} style={styles.colorSwatch} />
                      </div>
                      <div>
                        <label style={styles.propertyLabel}>Card Image</label>
                        {card.image ? (
                          <img src={card.image} alt="" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 8, marginBottom: 6, display: "block" }} />
                        ) : null}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button type="button" style={styles.secondaryBtn} onClick={() => openCardImagePicker(cardIndex)}>🖼 Library</button>
                          <label style={{ ...styles.secondaryBtn, cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
                            📁 Upload
                            <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (!file) return;
                              const asset = await Promise.resolve(onUploadImage?.(index, `__hc_card_${cardIndex}__`, file));
                              if (asset?.src) updateCard(cardIndex, { image: asset.src });
                            }} />
                          </label>
                          {card.image ? (
                            <button type="button" style={{ ...styles.secondaryBtn, color: "#f87171" }} onClick={() => updateCard(cardIndex, { image: "" })}>Remove</button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <button type="button" style={{ ...styles.secondaryBtn, marginTop: 10, width: "100%" }} onClick={addCard}>+ Add Card</button>
        </div>

      </div>
    </div>
  );
}

function ContactFormPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage, onSelectAsset }) {
  const props = block?.props || {};
  const fields = normalizeContactFields(props.fields);
  const update = (patch) => onChange(index, { ...props, ...patch });
  const savedImages = [brandAssets?.logo, ...(Array.isArray(brandAssets?.images) ? brandAssets.images : [])].filter(Boolean).slice(0, 8);

  const updateField = (fieldIndex, patch) => {
    const nextFields = fields.map((field, currentIndex) => (
      currentIndex === fieldIndex
        ? {
            ...field,
            ...patch,
            label: Object.prototype.hasOwnProperty.call(patch, "label") ? htmlToPlainText(patch.label) : field.label,
            name: Object.prototype.hasOwnProperty.call(patch, "name") ? String(patch.name || "") : field.name,
            placeholder: Object.prototype.hasOwnProperty.call(patch, "placeholder") ? htmlToPlainText(patch.placeholder) : field.placeholder,
          }
        : field
    ));
    update({ fields: nextFields });
  };

  const removeField = (fieldIndex) => {
    update({ fields: fields.filter((_, currentIndex) => currentIndex !== fieldIndex) });
  };

  const addField = () => {
    update({
      fields: [...fields, createContactField(fields.length, { label: `Field ${fields.length + 1}`, type: "text", required: false, placeholder: "" })],
    });
  };

  const applyTemplate = (template) => {
    onChange(index, {
      ...props,
      title: template.title,
      subtitle: template.subtitle,
      submitText: template.submitText,
      submitAction: template.submitAction || props.submitAction || "none",
      bookingUrl: resolveContactBookingUrl(template.bookingUrl || props.bookingUrl || ""),
      fields: normalizeContactFields(template.fields),
    });
  };

  const applyStyleTemplate = (template) => {
    onChange(index, { ...props, ...template.patch });
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>✉️ Edit: Contact Form</h3>
      <p style={{ margin: "0 0 12px 16px", color: "#64748b", fontSize: 16 }}>Click title, subtitle, field labels and the button directly on the page to edit text.</p>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Style</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
            {CONTACT_FORM_STYLE_TEMPLATES.map((template) => {
              const active = String(props.formVariant || "minimal-soft") === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyStyleTemplate(template)}
                  style={{
                    ...styles.secondaryBtn,
                    justifyContent: "center",
                    background: active ? "#2563eb" : undefined,
                    color: active ? "#ffffff" : undefined,
                    border: active ? "1px solid #2563eb" : undefined,
                    fontWeight: active ? 600 : undefined,
                  }}
                >{template.label}</button>
              );
            })}
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Form Type</label>
          <div style={styles.presetGrid}>
            {CONTACT_FORM_TEMPLATES.map((template) => (
              <button key={template.id} type="button" style={styles.presetChip} onClick={() => applyTemplate(template)}>
                {template.label}
              </button>
            ))}
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Layout</label>
          <NumberField label="Form Width" value={Number(props.formMaxWidth || 760)} min={360} max={1200} onChange={(value) => update({ formMaxWidth: value })} />
          <div style={{ marginTop: 8 }}>
            <label style={styles.propertyLabel}>Submit Action</label>
            <select value={String(props.submitAction || "none")} onChange={(e) => update({ submitAction: e.target.value })} style={styles.propertyInput}>
              <option value="none">Preview Only</option>
              <option value="calendar-booking">Open Calendar Booking</option>
            </select>
          </div>
          {String(props.submitAction || "none") === "calendar-booking" ? (
            <>
              <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Booking URL</label>
              <input type="text" value={resolveContactBookingUrl(props.bookingUrl || "")} onChange={(e) => update({ bookingUrl: e.target.value })} style={styles.propertyInput} placeholder={DEFAULT_ENQUIRY_BOOKING_URL} />
              <p style={styles.aiHint}>Your public calendar booking page, e.g. `/u/your-username`.</p>
            </>
          ) : null}
          <div style={{ marginTop: 8 }}>
            <label style={styles.propertyLabel}>Image Position</label>
            <select value={String(props.mediaPosition || "none")} onChange={(e) => update({ mediaPosition: e.target.value })} style={styles.propertyInput}>
              {[
                { value: "none", label: "No Image" },
                { value: "top", label: "Top" },
                { value: "left", label: "Left Side" },
                { value: "right", label: "Right Side" },
              ].map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
        {String(props.mediaPosition || "none") !== "none" ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Form Image</label>
            <div style={styles.assetPicker}>
              <label style={styles.assetUploadCta}>
                Upload Image
                <input
                  type="file"
                  accept="image/*"
                  style={styles.hiddenInput}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    onUploadImage(index, "mediaImage", file);
                  }}
                />
              </label>
              {props.mediaImage ? (
                <button type="button" style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }} onClick={() => update({ mediaImage: "" })}>
                  Remove
                </button>
              ) : null}
              {savedImages.map((image) => (
                <button
                  key={`contact-media-${image.id}`}
                  type="button"
                  style={styles.assetThumbBtn}
                  onClick={() => {
                    const nextProps = applyAssetToProps(props || {}, "mediaImage", image);
                    onChange(index, { ...nextProps, mediaImage: image.src || "" });
                    onSelectAsset(index, "mediaImage", image);
                  }}
                  title={image.name}
                >
                  <img src={image.src} alt={image.name} style={styles.assetThumbPreview} />
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Colours</label>
          <div style={styles.colorGrid}>
            <CompactColorField label="Section BG" value={props.backgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ backgroundColor: value })} />
            <CompactColorField label="Card BG" value={props.cardBackgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ cardBackgroundColor: value })} />
            <CompactColorField label="Text" value={props.textColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ textColor: value })} />
            <CompactColorField label="Muted Text" value={props.subtleTextColor || "#475569"} fallback="#475569" onChange={(value) => update({ subtleTextColor: value })} />
            <CompactColorField label="Button BG" value={props.buttonBackgroundColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ buttonBackgroundColor: value })} />
            <CompactColorField label="Button Text" value={props.buttonTextColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ buttonTextColor: value })} />
            <CompactColorField label="Input BG" value={props.inputBackgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ inputBackgroundColor: value })} />
            <CompactColorField label="Input Border" value={props.inputBorderColor || "#cbd5e1"} fallback="#cbd5e1" onChange={(value) => update({ inputBorderColor: value })} />
            <CompactColorField label="Input Text" value={props.inputTextColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ inputTextColor: value })} />
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Fields</label>
          <div style={styles.propertyGrid}>
            {fields.map((field, fieldIndex) => (
              <div key={`${field.name}-${fieldIndex}`} style={styles.linkRowCard}>
                <div style={styles.linkRowHeader}>
                  <span style={styles.linkRowTitle}>{field.label || `Field ${fieldIndex + 1}`}</span>
                  <button type="button" style={styles.iconDeleteBtn} aria-label={`Delete field ${fieldIndex + 1}`} title="Delete field" onClick={() => removeField(fieldIndex)}>×</button>
                </div>
                <input type="text" value={String(field.label || "")} onChange={(e) => updateField(fieldIndex, { label: e.target.value })} style={styles.propertyInput} placeholder="Field label" />
                <input type="text" value={String(field.name || "")} onChange={(e) => updateField(fieldIndex, { name: e.target.value.replace(/[^a-zA-Z0-9-_]/g, "-") })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="field-name" />
                <input type="text" value={String(field.placeholder || "")} onChange={(e) => updateField(fieldIndex, { placeholder: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="Placeholder text" />
                <div style={{ marginTop: 8 }}>
                  <label style={styles.propertyLabel}>Field Type</label>
                  <select value={String(field.type || "text")} onChange={(e) => updateField(fieldIndex, { type: e.target.value })} style={styles.propertyInput}>
                    {["text", "email", "tel", "textarea"].map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
                  <input type="checkbox" checked={field.required !== false} onChange={(e) => updateField(fieldIndex, { required: e.target.checked })} style={styles.checkboxInput} />
                  Required field
                </label>
              </div>
            ))}
          </div>
          <button type="button" style={{ ...styles.secondaryBtn, marginTop: 10 }} onClick={addField}>+ Add Field</button>
        </div>
      </div>
    </div>
  );
}

const PropertiesPanel = ({ block, index, onChange, brandAssets, onUploadImage, onSelectAsset, onOpenImageEditor, onOpenSimpleImageEditor, onRefreshAssetLibrary, project, activePage, currentObjective }) => {
  const [regenBusy, setRegenBusy] = useState(false);
  const [regenError, setRegenError] = useState("");
  const [regenTone, setRegenTone] = useState("balanced");
  const [sectionHeightDraft, setSectionHeightDraft] = useState("");
  const [assetBrowser, setAssetBrowser] = useState({ visible: false, fieldKey: "", title: "" });
  const [heroEditorSection, setHeroEditorSection] = useState("layout");

  useEffect(() => {
    setRegenBusy(false);
    setRegenError("");
    setSectionHeightDraft(String(parsePixelValue(block?.props?.minHeight, block?.type === BlockTypes.HERO ? 420 : 220)));
    setAssetBrowser({ visible: false, fieldKey: "", title: "" });
    setHeroEditorSection("layout");
  }, [block?.id, block?.props?.minHeight, block?.type]);

  if (!block) {
    return (
      <div style={styles.properties}>
        <p style={styles.noSelection}>Select a block to edit properties</p>
      </div>
    );
  }

  const def = BlockDefinitions[block.type];
  const savedImages = Array.isArray(brandAssets?.images) ? brandAssets.images : [];
  const savedLogo = brandAssets?.logo || null;
  const currentBackgroundPreview = resolveAssetField(block?.props || {}, "backgroundImage", brandAssets);
  const currentOverlayPreview = resolveAssetField(block?.props || {}, "floatingImage", brandAssets);
  const effectiveOverlayPreview = currentOverlayPreview || savedLogo?.src || "";
  const isHero = [BlockTypes.HERO, BlockTypes.PARALLAX].includes(block.type);
  const fontWeightKey = isHero ? "headlineFontWeight" : "fontWeight";
  const fontFamilyKey = isHero ? "headlineFontFamily" : "fontFamily";
  const colorKey = isHero ? "headlineColor" : "textColor";
  const alignKey = isHero ? "headlineAlignment" : "alignment";
  const supportsParallaxToggle = [BlockTypes.PARALLAX, BlockTypes.TEXT, BlockTypes.HERO].includes(block.type);
  const isPositionableText = block.type === BlockTypes.PARALLAX || (!!block?.props?.enableParallax && [BlockTypes.HERO, BlockTypes.TEXT].includes(block.type));
  const supportsOverlayImage = [BlockTypes.HERO, BlockTypes.PARALLAX].includes(block.type);
  const heroSections = [
    { id: "layout", label: "Layout" },
    { id: "media", label: "Media" },
    { id: "style", label: "Style" },
    { id: "animations", label: "Animations" },
    { id: "overlays", label: "Overlays" },
    { id: "counter", label: "Counter ✦" },
  ];
  const heroTabBtnStyle = (active) => ({
    ...styles.tabChip,
    ...(active ? styles.tabChipActive : {}),
    fontSize: 16,
    padding: "5px 0",
    textAlign: "center",
    flex: "1 1 0",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
  });
  const heroTabRowBase = { display: "flex", gap: 4, marginBottom: 4 };
  const heroLayoutKeys = new Set(["heroVariant", "spacingScale", "headlineAlignment"]);
  const heroContentKeys = new Set(["headline", "subheadline", "ctaText", "ctaLink", "ctaSubtext", "eyebrow", "tagline", "brand"]);
  const heroAnimationKeys = new Set([
    "sectionAnimation",
    "sectionAnimationDelay",
    "sectionAnimationSpeed",
    "textAnimation",
    "textAnimationDelay",
    "textAnimationSpeed",
    "subheadlineAnimation",
    "subheadlineAnimationDelay",
    "subheadlineAnimationSpeed",
    "ctaAnimation",
    "ctaAnimationDelay",
    "ctaAnimationSpeed",
    "contentOverlayAnimation",
    "contentOverlayAnimationDelay",
    "contentOverlayAnimationSpeed",
    "imageOverlayAnimation",
    "imageOverlayAnimationDelay",
    "imageOverlayAnimationSpeed",
  ]);

  function shouldShowHeroPanelSection(sectionId) {
    return !isHero || heroEditorSection === sectionId;
  }

  function shouldRenderHeroGenericField(key, value) {
    if (!isHero) return true;

    if (heroAnimationKeys.has(key) || /animation/i.test(key)) {
      return heroEditorSection === "animations";
    }

    if (heroContentKeys.has(key) || isLongTextField(key) || /^cta/i.test(key)) {
      return heroEditorSection === "layout";
    }

    if (heroLayoutKeys.has(key) || /align/i.test(key) || /layout/i.test(key) || /variant/i.test(key)) {
      return heroEditorSection === "layout";
    }

    if (isColorField(key) || /(font|weight|animation|shadow|border|radius|opacity|background)/i.test(key)) {
      return heroEditorSection === "style";
    }

    if (typeof value === "boolean" || typeof value === "number") {
      return heroEditorSection === "layout";
    }

    return heroEditorSection === "layout";
  }

  function renderAnimationControlCard(label, animationKey, delayKey, speedKey, defaults = {}) {
    return (
      <div style={styles.sectionCard}>
        <label style={styles.propertyLabel}>{label}</label>
        <select
          value={String(block?.props?.[animationKey] || defaults.animation || "none")}
          onChange={(event) => onChange(index, { ...block.props, [animationKey]: event.target.value })}
          style={styles.propertyInput}
        >
          {ANIMATION_PRESETS.map((preset) => (
            <option key={`${animationKey}-${preset.value}`} value={preset.value}>{preset.label}</option>
          ))}
        </select>
        <div style={styles.colorGrid}>
          <NumberField
            label="Delay (s)"
            value={Number(block?.props?.[delayKey] ?? defaults.delay ?? 0)}
            min={0}
            max={4}
            onChange={(value) => onChange(index, { ...block.props, [delayKey]: Number(value) })}
          />
          <NumberField
            label="Speed (s)"
            value={Number(block?.props?.[speedKey] ?? defaults.speed ?? 0.9)}
            min={0.2}
            max={4}
            onChange={(value) => onChange(index, { ...block.props, [speedKey]: Number(value) })}
          />
        </div>
      </div>
    );
  }

  function applyCanvasAlignment(axis, value) {
    const nextProps = { ...(block.props || {}) };

    if (axis === "x") {
      nextProps[alignKey] = value;
    } else {
      nextProps.verticalAlign = value;
    }

    onChange(index, nextProps);
  }

  function openAssetBrowser(fieldKey, title) {
    const opened = openSharedMediaPicker({
      onPick: (asset) => {
        if (!assetBrowser.fieldKey && !fieldKey) return;
        onSelectAsset(index, fieldKey, asset);
      },
      onBlocked: () => setAssetBrowser({ visible: true, fieldKey, title }),
    });
    if (opened) return;
    setAssetBrowser({ visible: true, fieldKey, title });
  }

  const selectedBrowserImage = assetBrowser.fieldKey ? String(block?.props?.[assetBrowser.fieldKey] || "") : "";
  const browserAssets = [savedLogo, ...savedImages].filter(Boolean);

  async function regenerateBlockCopy() {
    if (!block || typeof index !== "number") return;
    setRegenBusy(true);
    setRegenError("");
    try {
      const res = await fetch("/api/website/regenerate-section-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockType: block.type,
          blockProps: block.props || {},
          brief: project?.brief || {},
          projectName: project?.name || "",
          pageName: activePage || "",
          pageObjective: currentObjective || "",
          tone: regenTone,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setRegenError(json?.error || "Could not regenerate copy");
        return;
      }

      if (!json?.patch || typeof json.patch !== "object" || !Object.keys(json.patch).length) {
        setRegenError("No copy changes returned. Try again.");
        return;
      }

      onChange(index, { ...block.props, ...json.patch });
    } catch (e) {
      setRegenError(e?.message || "Could not regenerate copy");
    } finally {
      setRegenBusy(false);
    }
  }

  if (block.type === BlockTypes.NAV_BAR) {
    return (
      <NavbarPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onSelectAsset={onSelectAsset}
      />
    );
  }

  if (block.type === BlockTypes.IMAGE_STACK) {
    return (
      <ImageStackPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
      />
    );
  }

  if (block.type === BlockTypes.IMAGE) {
    return (
      <ImagePropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onSelectAsset={onSelectAsset}
        onOpenImageEditor={onOpenSimpleImageEditor || onOpenImageEditor}
      />
    );
  }

  if (block.type === BlockTypes.FEATURE_LIST) {
    return (
      <FeatureListPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onOpenImageEditor={onOpenImageEditor}
      />
    );
  }

  if (block.type === BlockTypes.IMAGE_GALLERY) {
    return (
      <ImageGalleryPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onOpenImageEditor={onOpenImageEditor}
      />
    );
  }

  if (block.type === BlockTypes.TEAM) {
    return (
      <TeamPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onOpenImageEditor={onOpenImageEditor}
        onUploadImage={onUploadImage}
      />
    );
  }

  if (block.type === BlockTypes.TESTIMONIAL) {
    return (
      <TestimonialPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
      />
    );
  }

  if (block.type === BlockTypes.TEXT) {
    return (
      <TextPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onSelectAsset={onSelectAsset}
      />
    );
  }

  if (block.type === BlockTypes.NEWSLETTER) {
    return (
      <NewsletterPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
      />
    );
  }

  if (block.type === BlockTypes.TRUST_BADGES) {
    return (
      <TrustBadgesPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onSelectAsset={onSelectAsset}
      />
    );
  }

  if (block.type === BlockTypes.STATS) {
    return (
      <StatsPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
      />
    );
  }

  if (block.type === BlockTypes.FOOTER) {
    return (
      <FooterPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onOpenSimpleImageEditor={onOpenSimpleImageEditor || onOpenImageEditor}
      />
    );
  }

  if (block.type === BlockTypes.PRICING_TABLE) {
    return (
      <PricingTablePropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
      />
    );
  }

  if (block.type === BlockTypes.CONTACT_FORM) {
    return (
      <ContactFormPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onSelectAsset={onSelectAsset}
      />
    );
  }

  if ([BlockTypes.FAQ, BlockTypes.ACCORDION].includes(block.type)) {
    return (
      <FAQPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onSelectAsset={onSelectAsset}
      />
    );
  }

  if (block.type === BlockTypes.SPLIT_BLOCK) {
    return (
      <SplitBlockPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onSelectAsset={onSelectAsset}
      />
    );
  }

  if (block.type === BlockTypes.FEATURE_ACCORDION) {
    return (
      <FeatureAccordionPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
      />
    );
  }

  if (block.type === BlockTypes.SCROLL_STACK) {
    return (
      <ScrollStackPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        onUploadImage={onUploadImage}
      />
    );
  }

  if (block.type === BlockTypes.CUSTOM_HTML) {
    return <CustomHtmlPropertiesPanel block={block} index={index} onChange={onChange} />;
  }

  if (block.type === BlockTypes.COMPETITOR_COMPARISON) {
    return <CompetitorComparisonPropertiesPanel block={block} index={index} onChange={onChange} />;
  }

  if (block.type === BlockTypes.SPACE) {
    const spacerPx   = parsePixelValue(block.props?.height, 40);
    const p          = block.props || {};
    const bgStyle    = p.backgroundStyle || "none";
    const updateSpacer = (patch) => onChange(index, { ...p, ...patch });
    return (
      <div style={styles.properties}>
        <h3 style={styles.propertiesTitle}>⬆️ Edit: Spacer</h3>
        <div style={styles.propertyGrid}>

          {/* ── Size ── */}
          <div style={styles.sectionCard}>
            <NumberField label="Height (px)" value={spacerPx} min={4} max={600} onChange={(value) => updateSpacer({ height: `${value}px` })} />
          </div>

          {/* ── Background type selector ── */}
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Background</label>
            <select
              value={bgStyle}
              onChange={(e) => updateSpacer({ backgroundStyle: e.target.value })}
              style={styles.propertyInput}
            >
              <option value="none">None (transparent)</option>
              <option value="color">Solid colour</option>
              <option value="gradient">Gradient</option>
              <option value="image">Image</option>
            </select>
          </div>

          {/* ── Solid colour ── */}
          {bgStyle === "color" && (
            <div style={styles.sectionCard}>
              <ColorSelector
                label="Background Colour"
                value={p.backgroundColor || "#ffffff"}
                fallback="#ffffff"
                allowTransparent
                onChange={(v) => updateSpacer({ backgroundColor: v })}
              />
            </div>
          )}

          {/* ── Gradient ── */}
          {bgStyle === "gradient" && (
            <div style={styles.sectionCard}>
              <label style={styles.propertyLabel}>CSS Gradient</label>
              <input
                type="text"
                value={p.backgroundGradient || ""}
                onChange={(e) => updateSpacer({ backgroundGradient: e.target.value })}
                style={styles.propertyInput}
                placeholder="e.g. linear-gradient(135deg,#0f172a,#1e3a5f)"
              />
              <p style={styles.aiHint}>Paste any CSS gradient — linear, radial, or conic.</p>
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {[
                  "linear-gradient(135deg,#0f172a,#1e3a5f)",
                  "linear-gradient(90deg,#7c3aed,#3b82f6)",
                  "linear-gradient(180deg,#f59e0b,#ef4444)",
                  "radial-gradient(circle,#1e293b,#0f172a)",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    style={{ ...styles.secondaryBtn, background: preset, color: "#fff", fontSize: 13, textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                    onClick={() => updateSpacer({ backgroundGradient: preset })}
                  >
                    {preset.split("(")[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Image ── */}
          {bgStyle === "image" && (
            <div style={styles.sectionCard}>
              <label style={styles.propertyLabel}>Background Image</label>
              {p.backgroundImage && (
                <div style={{ marginBottom: 8 }}>
                  <img src={p.backgroundImage} alt="Spacer background" style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid rgba(148,163,184,0.24)" }} />
                </div>
              )}
              <div style={styles.assetPicker}>
                <label style={styles.assetUploadCta}>
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    style={styles.hiddenInput}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      onUploadImage(index, "backgroundImage", file);
                    }}
                  />
                </label>
                <button
                  type="button"
                  style={styles.secondaryBtn}
                  onClick={() => openSharedLibraryAssetPicker((asset) => onSelectAsset(index, "backgroundImage", asset))}
                >
                  Library
                </button>
                {p.backgroundImage && (
                  <button
                    type="button"
                    style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }}
                    onClick={() => updateSpacer({ backgroundImage: "", backgroundImageAssetId: undefined })}
                  >
                    Remove
                  </button>
                )}
              </div>
              <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Image Size</label>
              <select
                value={p.backgroundSize || "cover"}
                onChange={(e) => updateSpacer({ backgroundSize: e.target.value })}
                style={styles.propertyInput}
              >
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="auto">Auto</option>
              </select>
              <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Image Position</label>
              <select
                value={p.backgroundPosition || "center center"}
                onChange={(e) => updateSpacer({ backgroundPosition: e.target.value })}
                style={styles.propertyInput}
              >
                <option value="center center">Centre</option>
                <option value="top center">Top</option>
                <option value="bottom center">Bottom</option>
                <option value="left center">Left</option>
                <option value="right center">Right</option>
              </select>
            </div>
          )}

        </div>
      </div>
    );
  }

  if ([BlockTypes.COLUMNS_2, BlockTypes.COLUMNS_3].includes(block.type)) {
    return (
      <ColumnsPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onSelectAsset={onSelectAsset}
        onOpenImageEditor={onOpenSimpleImageEditor || onOpenImageEditor}
      />
    );
  }

  if (block.type === BlockTypes.GRID_SECTION) {
    return (
      <GridSectionPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onRefreshAssetLibrary={onRefreshAssetLibrary}
      />
    );
  }

  if (block.type === BlockTypes.HOVER_CARDS) {
    return <HoverCardsPropertiesPanel block={block} index={index} onChange={onChange} onUploadImage={onUploadImage} />;
  }

  if (block.type === BlockTypes.VIDEO_HERO) {
    const vp = block.props || {};
    const updateVH = (patch) => onChange(index, { ...vp, ...patch });
    const vhHeight = String(vp.heightMode || "full");
    const vhFixed  = Number(vp.minHeight) || 620;
    const vhOverlayOpacity = Number(vp.overlayOpacity ?? 0.42);
    const vhObjectFit  = String(vp.objectFit || "cover");
    const vhObjectPos  = String(vp.objectPosition || "top center");
    const vhPadTop     = Number(vp.paddingTop ?? 0);
    const vhPadBottom  = Number(vp.paddingBottom ?? 0);

    const handleVideoUpload = async (file) => {
      if (!file) return;
      // Set a local blob URL immediately so the block shows the video right away.
      const blobUrl = URL.createObjectURL(file);
      updateVH({ videoSrc: blobUrl });
      // Upload to server in the background and replace with the CDN URL.
      try {
        const asset = await Promise.resolve(onUploadImage?.(index, "__video_hero_src__", file));
        if (asset?.src) updateVH({ videoSrc: asset.src });
      } catch {
        // blob URL stays as a local preview if server upload fails
      }
    };
    const handlePosterUpload = async (file) => {
      if (!file) return;
      const asset = await Promise.resolve(onUploadImage?.(index, "__video_hero_poster__", file));
      if (asset?.src) updateVH({ posterSrc: asset.src });
    };

    return (
      <div style={styles.properties}>
        <h3 style={styles.propertiesTitle}>🎬 Edit: Video Hero</h3>
        <div style={styles.propertyGrid}>

          {/* ── Media ── */}
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Video File</label>
            {vp.videoSrc ? (
              <video src={vp.videoSrc} poster={vp.posterSrc || undefined} muted autoPlay loop playsInline
                style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 6, display: "block", marginBottom: 8, background: "#000" }} />
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ ...styles.assetUploadCta, cursor: "pointer" }}>
                📹 {vp.videoSrc ? "Replace Video" : "Upload Video"}
                <input type="file" accept="video/mp4,video/webm,video/ogg,video/*" style={styles.hiddenInput}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleVideoUpload(f); }} />
              </label>
              {vp.videoSrc ? (
                <button type="button" style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }}
                  onClick={() => updateVH({ videoSrc: "" })}>Remove</button>
              ) : null}
            </div>
          </div>

          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Poster / Thumbnail</label>
            {vp.posterSrc ? (
              <img src={vp.posterSrc} alt="poster" style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 6, display: "block", marginBottom: 8 }} />
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ ...styles.assetUploadCta, cursor: "pointer" }}>
                🖼️ {vp.posterSrc ? "Replace Poster" : "Upload Poster"}
                <input type="file" accept="image/*" style={styles.hiddenInput}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handlePosterUpload(f); }} />
              </label>
              {vp.posterSrc ? (
                <button type="button" style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }}
                  onClick={() => updateVH({ posterSrc: "" })}>Remove</button>
              ) : null}
            </div>
          </div>

          {/* ── Text overlay ── */}
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Text Overlay</label>
            <label style={{ ...styles.propertyLabel, fontWeight: 400 }}>Eyebrow</label>
            <input value={String(vp.eyebrow || "")} onChange={(e) => updateVH({ eyebrow: e.target.value })} placeholder="Optional eyebrow label" style={styles.propertyInput} />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Headline</label>
            <input value={String(vp.title || "")} onChange={(e) => updateVH({ title: e.target.value })} placeholder="Hero headline" style={styles.propertyInput} />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Subheadline</label>
            <input value={String(vp.subtitle || "")} onChange={(e) => updateVH({ subtitle: e.target.value })} placeholder="Supporting sentence" style={styles.propertyInput} />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>CTA Button Text</label>
            <input value={String(vp.ctaText || "")} onChange={(e) => updateVH({ ctaText: e.target.value })} placeholder="Leave blank to hide" style={styles.propertyInput} />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>CTA URL</label>
            <input value={String(vp.ctaUrl || "")} onChange={(e) => updateVH({ ctaUrl: e.target.value })} placeholder="#" style={styles.propertyInput} />
            <div style={{ marginTop: 10, display: "flex", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#94a3b8", cursor: "pointer" }}>
                <input type="checkbox" checked={vp.showText !== false} onChange={(e) => updateVH({ showText: e.target.checked })} />
                Show text overlay
              </label>
            </div>
          </div>

          {/* ── Overlay / Colours ── */}
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Overlay &amp; Colours</label>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#94a3b8" }}>
                Overlay colour
                <input type="color" value={String(vp.overlayColor || "#000000")} onChange={(e) => updateVH({ overlayColor: e.target.value })}
                  style={{ width: 28, height: 28, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#94a3b8" }}>
                Accent
                <input type="color" value={String(vp.accentColor || "#6366f1")} onChange={(e) => updateVH({ accentColor: e.target.value })}
                  style={{ width: 28, height: 28, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#94a3b8" }}>
                Text colour
                <input type="color" value={String(vp.textColor || "#ffffff")} onChange={(e) => updateVH({ textColor: e.target.value })}
                  style={{ width: 28, height: 28, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }} />
              </label>
            </div>
            <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Overlay Opacity</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="range" min={0} max={0.9} step={0.01} value={vhOverlayOpacity}
                onChange={(e) => updateVH({ overlayOpacity: parseFloat(e.target.value) })} style={{ flex: 1 }} />
              <span style={{ fontSize: 13, color: "#64748b", minWidth: 36 }}>{Math.round(vhOverlayOpacity * 100)}%</span>
            </div>
          </div>

          {/* ── Height & sizing ── */}
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Height</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[["full", "Full screen"], ["fixed", "Fixed px"]].map(([m, label]) => (
                <button key={m} type="button"
                  style={{ ...styles.secondaryBtn, ...(vhHeight === m ? { background: "rgba(99,102,241,0.15)", borderColor: "rgba(99,102,241,0.5)", color: "#818cf8" } : {}) }}
                  onClick={() => updateVH({ heightMode: m })}>{label}</button>
              ))}
            </div>
            {vhHeight === "fixed" ? (
              <div style={{ marginTop: 8 }}>
                <NumberField label="Height (px)" value={vhFixed} min={200} max={1200} onChange={(v) => updateVH({ minHeight: v })} />
              </div>
            ) : null}

            <label style={{ ...styles.propertyLabel, marginTop: 12 }}>Object Fit</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["cover", "contain"].map((fit) => (
                <button key={fit} type="button"
                  style={{ ...styles.secondaryBtn, ...(vhObjectFit === fit ? { background: "rgba(99,102,241,0.15)", borderColor: "rgba(99,102,241,0.5)", color: "#818cf8" } : {}) }}
                  onClick={() => updateVH({ objectFit: fit })}>{fit}</button>
              ))}
            </div>

            <label style={{ ...styles.propertyLabel, marginTop: 12 }}>Video Position</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[["top center", "Top"], ["center center", "Mid"], ["bottom center", "Bottom"]].map(([val, label]) => (
                <button key={val} type="button"
                  style={{ ...styles.secondaryBtn, ...(vhObjectPos === val ? { background: "rgba(99,102,241,0.15)", borderColor: "rgba(99,102,241,0.5)", color: "#818cf8" } : {}) }}
                  onClick={() => updateVH({ objectPosition: val })}>{label}</button>
              ))}
            </div>
          </div>

          {/* ── Padding ── */}
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Padding</label>
            <div style={styles.colorGrid}>
              <NumberField label="Top (px)" value={vhPadTop} min={0} max={400} onChange={(v) => updateVH({ paddingTop: v })} />
              <NumberField label="Bottom (px)" value={vhPadBottom} min={0} max={400} onChange={(v) => updateVH({ paddingBottom: v })} />
            </div>
          </div>

          {/* ── Options ── */}
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Options</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#94a3b8", cursor: "pointer" }}>
              <input type="checkbox" checked={vp.unmuteOnScroll === true} onChange={(e) => updateVH({ unmuteOnScroll: e.target.checked })} />
              🔊 Unmute when scrolled into view
            </label>
          </div>

        </div>
      </div>
    );
  }

  if (block.type === BlockTypes.MARQUEE_STRIP) {
    const safeItems = Array.isArray(block.props?.items) ? block.props.items : [];
    const marqueeProps = block.props || {};
    const updateMarquee = (patch) => onChange(index, { ...marqueeProps, ...patch });
    return (
      <div style={styles.properties}>
        <h3 style={styles.propertiesTitle}>🎞 Edit: {def?.name}</h3>
        <div style={styles.propertyGrid}>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Marquee Items</label>
            <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 16 }}>Each item can be text or an icon. Text items can also be edited inline on the canvas.</p>
            <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              {safeItems.map((item, itemIndex) => (
                <MarqueeItemEditor
                  key={`marquee-item-${itemIndex}`}
                  item={item}
                  index={itemIndex}
                  onChange={(newItem) => {
                    const nextItems = safeItems.map((e, i) => i === itemIndex ? newItem : e);
                    updateMarquee({ items: nextItems });
                  }}
                  onRemove={() => updateMarquee({ items: safeItems.filter((_, i) => i !== itemIndex) })}
                  stylesRef={styles}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => updateMarquee({ items: [...safeItems, `New message ${safeItems.length + 1}`] })}
              >
                + Add Item
              </button>
            </div>
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Marquee Style</label>
            <div style={styles.colorGrid}>
              <NumberField label="Speed (s)" value={Number(marqueeProps.speed || 24)} min={10} max={80} onChange={(value) => updateMarquee({ speed: value })} />
              <NumberField label="Text Size" value={Number(marqueeProps.fontSize || 16)} min={10} max={48} onChange={(value) => updateMarquee({ fontSize: value })} />
              <NumberField label="Outline Width" value={Number(marqueeProps.textStrokeWidth || 0)} min={0} max={8} onChange={(value) => updateMarquee({ textStrokeWidth: value })} />
              <NumberField label="Divider Size" value={Number(marqueeProps.dividerSize || 14)} min={8} max={48} onChange={(value) => updateMarquee({ dividerSize: value })} />
              <NumberField label="Animation Duration" value={Number(marqueeProps.speed || 24)} min={10} max={80} onChange={(value) => updateMarquee({ speed: value })} />
              <NumberField label="Top Padding" value={Number(marqueeProps.paddingTop ?? 16)} min={0} max={64} onChange={(value) => updateMarquee({ paddingTop: value })} />
              <NumberField label="Bottom Padding" value={Number(marqueeProps.paddingBottom ?? 16)} min={0} max={64} onChange={(value) => updateMarquee({ paddingBottom: value })} />
              <NumberField label="Side Padding" value={Number(marqueeProps.itemPaddingX ?? 14)} min={0} max={64} onChange={(value) => updateMarquee({ itemPaddingX: value })} />
              <NumberField label="Line Height" value={Number(marqueeProps.lineHeight || 1.08)} min={1} max={3} onChange={(value) => updateMarquee({ lineHeight: value })} />
              <NumberField label="Top Margin" value={Number(marqueeProps.marginTop ?? 0)} min={0} max={96} onChange={(value) => updateMarquee({ marginTop: value })} />
              <NumberField label="Bottom Margin" value={Number(marqueeProps.marginBottom ?? 0)} min={0} max={96} onChange={(value) => updateMarquee({ marginBottom: value })} />
            </div>
            <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Direction</label>
            <select
              value={String(marqueeProps.direction || "left")}
              onChange={(event) => updateMarquee({ direction: event.target.value })}
              style={styles.propertyInput}
            >
              <option value="left">Move Left</option>
              <option value="right">Move Right</option>
            </select>
            <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Letter Case</label>
            <select
              value={String(marqueeProps.textTransform || "uppercase")}
              onChange={(event) => updateMarquee({ textTransform: event.target.value })}
              style={styles.propertyInput}
            >
              <option value="uppercase">UPPERCASE</option>
              <option value="none">Normal Case</option>
              <option value="lowercase">lowercase</option>
              <option value="capitalize">Capitalize</option>
            </select>
            <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Font Weight</label>
            <select
              value={String(marqueeProps.fontWeight || "800")}
              onChange={(event) => updateMarquee({ fontWeight: event.target.value })}
              style={styles.propertyInput}
            >
              <option value="400">Regular 400</option>
              <option value="500">Medium 500</option>
              <option value="600">Semi Bold 600</option>
              <option value="700">Bold 700</option>
              <option value="800">Extra Bold 800</option>
              <option value="900">Black 900</option>
            </select>
            <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Text Decoration</label>
            <select
              value={String(marqueeProps.textDecoration || "none")}
              onChange={(event) => updateMarquee({ textDecoration: event.target.value })}
              style={styles.propertyInput}
            >
              <option value="none">None</option>
              <option value="underline">Underline</option>
              <option value="overline">Overline</option>
              <option value="line-through">Strike Through</option>
            </select>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1", fontSize: 16, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={String(marqueeProps.fontStyle || "normal") === "italic"}
                  onChange={(event) => updateMarquee({ fontStyle: event.target.checked ? "italic" : "normal" })}
                />
                Italic
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1", fontSize: 16, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={String(marqueeProps.textDecoration || "none").includes("underline")}
                  onChange={(event) => updateMarquee({ textDecoration: event.target.checked ? "underline" : "none" })}
                />
                Underline quick toggle
              </label>
            </div>
            <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Divider Text</label>
            <input
              type="text"
              value={String(marqueeProps.dividerText || "✦")}
              onChange={(event) => updateMarquee({ dividerText: event.target.value })}
              style={styles.propertyInput}
              placeholder="Divider symbol or word"
            />
            <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 16, lineHeight: 1.5 }}>
              WordPress parity: direction, fill, stroke, stroke width, duration, padding, and margin are all editable here now.
            </p>
          </div>
          <ColorSelector
            label="Background Color"
            value={String(marqueeProps.backgroundColor || "#081120")}
            fallback="#081120"
            allowTransparent
            onChange={(nextValue) => updateMarquee({ backgroundColor: nextValue })}
          />
          <ColorSelector
            label="Text Color"
            value={String(marqueeProps.textColor || "#f8fafc")}
            fallback="#f8fafc"
            onChange={(nextValue) => updateMarquee({ textColor: nextValue })}
          />
          <ColorSelector
            label="Fill Color"
            value={String(marqueeProps.textFillColor || marqueeProps.textColor || "#f8fafc")}
            fallback="#f8fafc"
            onChange={(nextValue) => updateMarquee({ textFillColor: nextValue })}
          />
          <ColorSelector
            label="Outline Color"
            value={String(marqueeProps.textStrokeColor || "#0f172a")}
            fallback="#0f172a"
            allowTransparent
            onChange={(nextValue) => updateMarquee({ textStrokeColor: nextValue })}
          />
          <ColorSelector
            label="Accent Color"
            value={String(marqueeProps.accentColor || "#7dd3fc")}
            fallback="#7dd3fc"
            onChange={(nextValue) => updateMarquee({ accentColor: nextValue })}
          />
        </div>
      </div>
    );
  }

  if (block.type === BlockTypes.COMPETITOR_COMPARISON) {
    const ccProps = block.props || {};
    const updateCC = (patch) => onChange(index, { ...ccProps, ...patch });
    const safeRows = Array.isArray(ccProps.rows) ? ccProps.rows : [];
    return (
      <div style={styles.properties}>
        <h3 style={styles.propertiesTitle}>💸 Edit: Competitor Comparison</h3>
        <div style={styles.propertyGrid}>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Header Text</label>
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Eyebrow</label>
            <input type="text" value={String(ccProps.eyebrow || "")} onChange={(e) => updateCC({ eyebrow: e.target.value })} style={styles.propertyInput} placeholder="e.g. All-in-One Platform" />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Title</label>
            <input type="text" value={String(ccProps.title || "")} onChange={(e) => updateCC({ title: e.target.value })} style={styles.propertyInput} placeholder="e.g. What you'd pay elsewhere" />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Subtitle</label>
            <input type="text" value={String(ccProps.subtitle || "")} onChange={(e) => updateCC({ subtitle: e.target.value })} style={styles.propertyInput} placeholder="e.g. We replace every tool below..." />
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Your Plan Row (bottom)</label>
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Plan Name</label>
            <input type="text" value={String(ccProps.planName || "")} onChange={(e) => updateCC({ planName: e.target.value })} style={styles.propertyInput} />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Plan Price ($/mo)</label>
            <input type="number" value={Number(ccProps.planPrice ?? 199)} min={0} onChange={(e) => updateCC({ planPrice: Number(e.target.value) })} style={styles.propertyInput} />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Plan Tagline</label>
            <input type="text" value={String(ccProps.planTagline || "")} onChange={(e) => updateCC({ planTagline: e.target.value })} style={styles.propertyInput} placeholder="e.g. Everything above, included" />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Unique Feature Label</label>
            <input type="text" value={String(ccProps.uniqueLabel || "")} onChange={(e) => updateCC({ uniqueLabel: e.target.value })} style={styles.propertyInput} placeholder={`Unique to ${ccProps.planName || "us"}`} />
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Comparison Rows</label>
            <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
              {safeRows.map((row, rowIdx) => (
                <div key={rowIdx} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 12, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ color: "#94a3b8", fontSize: 16, fontWeight: 600 }}>Row {rowIdx + 1}</span>
                    <button
                      type="button"
                      style={{ background: "rgba(239,68,68,0.13)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5", borderRadius: 8, padding: "4px 12px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
                      onClick={() => updateCC({ rows: safeRows.filter((_, i) => i !== rowIdx) })}
                    >
                      Remove
                    </button>
                  </div>
                  <label style={styles.propertyLabel}>Category / Feature Name</label>
                  <input
                    type="text"
                    value={String(row.category || "")}
                    onChange={(e) => {
                      const next = safeRows.map((r, i) => i === rowIdx ? { ...r, category: e.target.value } : r);
                      updateCC({ rows: next });
                    }}
                    style={{ ...styles.propertyInput, marginBottom: 8 }}
                  />
                  <label style={styles.propertyLabel}>Competitor Logos</label>
                  <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
                    {(Array.isArray(row.logos) ? row.logos : []).map((logo, logoIdx) => (
                      <div key={logoIdx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, alignItems: "center" }}>
                        <input
                          type="text"
                          value={String(logo.domain || "")}
                          onChange={(e) => {
                            const nextLogos = row.logos.map((l, li) => li === logoIdx ? { ...l, domain: e.target.value } : l);
                            const next = safeRows.map((r, i) => i === rowIdx ? { ...r, logos: nextLogos } : r);
                            updateCC({ rows: next });
                          }}
                          style={styles.propertyInput}
                          placeholder="domain.com"
                        />
                        <input
                          type="text"
                          value={String(logo.name || "")}
                          onChange={(e) => {
                            const nextLogos = row.logos.map((l, li) => li === logoIdx ? { ...l, name: e.target.value } : l);
                            const next = safeRows.map((r, i) => i === rowIdx ? { ...r, logos: nextLogos } : r);
                            updateCC({ rows: next });
                          }}
                          style={styles.propertyInput}
                          placeholder="Tool name"
                        />
                        <button
                          type="button"
                          style={{ background: "rgba(239,68,68,0.13)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5", borderRadius: 8, padding: "4px 8px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
                          onClick={() => {
                            const nextLogos = row.logos.filter((_, li) => li !== logoIdx);
                            const next = safeRows.map((r, i) => i === rowIdx ? { ...r, logos: nextLogos } : r);
                            updateCC({ rows: next });
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    style={{ ...styles.secondaryBtn, marginBottom: 10 }}
                    onClick={() => {
                      const nextLogos = [...(Array.isArray(row.logos) ? row.logos : []), { domain: "", name: "" }];
                      const next = safeRows.map((r, i) => i === rowIdx ? { ...r, logos: nextLogos } : r);
                      updateCC({ rows: next });
                    }}
                  >
                    + Add Logo
                  </button>
                  <label style={styles.propertyLabel}>Cost ($/mo) — set 0 for &ldquo;Unique to us&rdquo;</label>
                  <input
                    type="number"
                    value={Number(row.price ?? 0)}
                    min={0}
                    onChange={(e) => {
                      const next = safeRows.map((r, i) => i === rowIdx ? { ...r, price: Number(e.target.value) } : r);
                      updateCC({ rows: next });
                    }}
                    style={styles.propertyInput}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => updateCC({ rows: [...safeRows, { category: "NEW FEATURE", logos: [{ domain: "", name: "" }], price: 0 }] })}
            >
              + Add Row
            </button>
          </div>
          <ColorSelector
            label="Background Color"
            value={String(ccProps.backgroundColor || "#070c18")}
            fallback="#070c18"
            onChange={(v) => updateCC({ backgroundColor: v })}
          />
        </div>
      </div>
    );
  }

  const textContentKeys = Object.keys(block.props || {}).filter((k) => isLongTextField(k));

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🎨 Edit: {def?.name}</h3>
      {isHero ? (
        <div style={{ marginBottom: 10 }}>
          <div style={heroTabRowBase}>
            {heroSections.slice(0, 3).map((item) => (
              <button key={item.id} type="button" style={heroTabBtnStyle(heroEditorSection === item.id)} onClick={() => setHeroEditorSection(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <div style={heroTabRowBase}>
            {heroSections.slice(3).map((item) => (
              <button key={item.id} type="button" style={heroTabBtnStyle(heroEditorSection === item.id)} onClick={() => setHeroEditorSection(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <AssetLibraryModal
        visible={assetBrowser.visible}
        title={assetBrowser.title || "Media Library"}
        assets={browserAssets}
        selectedSrc={selectedBrowserImage}
        onClose={() => setAssetBrowser({ visible: false, fieldKey: "", title: "" })}
        onSelect={(asset) => {
          if (!assetBrowser.fieldKey) return;
          onSelectAsset(index, assetBrowser.fieldKey, asset);
        }}
        onUpload={(file) => {
          if (!assetBrowser.fieldKey) return null;
          return onUploadImage(index, assetBrowser.fieldKey, file);
        }}
      />
      <div style={styles.propertyGrid}>
        {supportsSectionHeight(block.type) && shouldShowHeroPanelSection("layout") ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Section Height</label>
            <input
              type="text"
              inputMode="numeric"
              value={sectionHeightDraft}
              onChange={(e) => setSectionHeightDraft(String(e.target.value || "").replace(/[^\d]/g, ""))}
              onBlur={() => {
                const px = Math.max(120, Number(sectionHeightDraft || 0) || (block.type === BlockTypes.HERO ? 420 : 220));
                const next = String(px);
                setSectionHeightDraft(next);
                onChange(index, { ...block.props, minHeight: `${next}px` });
              }}
              placeholder="420"
              style={styles.propertyInput}
            />
          </div>
        ) : null}
        {supportsFullWidthBackground(block.type) && shouldShowHeroPanelSection("layout") ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Background Width</label>
            <label style={styles.inlineToggle}>
              <input
                type="checkbox"
                checked={isFullWidthBackgroundEnabled(block)}
                onChange={(e) => onChange(index, { ...block.props, fullWidthBackground: e.target.checked })}
                style={styles.checkboxInput}
              />
              Full width background
            </label>
          </div>
        ) : null}
        {supportsParallaxToggle && shouldShowHeroPanelSection("layout") ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Parallax Mode</label>
            <label style={styles.inlineToggle}>
              <input
                type="checkbox"
                checked={!!block?.props?.enableParallax}
                onChange={(e) => {
                  const nextEnabled = e.target.checked;
                  onChange(index, {
                    ...block.props,
                    enableParallax: nextEnabled,
                    ...(nextEnabled ? { backgroundStyle: "image" } : {}),
                  });
                }}
                style={styles.checkboxInput}
              />
              Enable parallax background
            </label>
          </div>
        ) : null}
        {isHero && shouldShowHeroPanelSection("layout") ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Hero Copy</label>
            <p style={styles.aiHint}>This sits with layout so the copy and positioning stay in one place.</p>
            <label style={styles.inlineToggle}>
              <input
                type="checkbox"
                checked={!block?.props?.hideTextOverlay}
                onChange={(e) => onChange(index, { ...block.props, hideTextOverlay: !e.target.checked })}
                style={styles.checkboxInput}
              />
              Show text overlay in preview
            </label>
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Eyebrow</label>
            <input
              type="text"
              value={htmlToPlainText(block?.props?.eyebrow || "")}
              onChange={(event) => onChange(index, { ...block.props, eyebrow: event.target.value })}
              style={styles.propertyInput}
              placeholder="Section label"
            />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Headline</label>
            <textarea
              value={htmlToPlainText(block?.props?.headline || "")}
              onChange={(event) => onChange(index, { ...block.props, headline: event.target.value })}
              placeholder="Write headline..."
              style={{ ...styles.propertyInput, minHeight: 88, resize: "vertical", lineHeight: 1.45 }}
            />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Body Copy</label>
            <textarea
              value={htmlToPlainText(block?.props?.subheadline || "")}
              onChange={(event) => onChange(index, { ...block.props, subheadline: event.target.value })}
              placeholder="Write supporting text..."
              style={{ ...styles.propertyInput, minHeight: 108, resize: "vertical", lineHeight: 1.5 }}
            />
            <div style={{ ...styles.colorGrid, marginTop: 8 }}>
              <div style={styles.propertyField}>
                <label style={styles.propertyLabel}>Primary CTA</label>
                <input
                  type="text"
                  value={String(block?.props?.ctaText || "")}
                  onChange={(event) => onChange(index, { ...block.props, ctaText: event.target.value })}
                  style={styles.propertyInput}
                  placeholder="Get Started"
                />
              </div>
              <div style={styles.propertyField}>
                <label style={styles.propertyLabel}>Primary Link</label>
                <input
                  type="text"
                  value={String(block?.props?.ctaLink || "")}
                  onChange={(event) => onChange(index, { ...block.props, ctaLink: event.target.value })}
                  style={styles.propertyInput}
                  placeholder="#contact"
                />
              </div>
              <div style={styles.propertyField}>
                <label style={styles.propertyLabel}>Secondary CTA</label>
                <input
                  type="text"
                  value={String(block?.props?.secondaryCtaText || "")}
                  onChange={(event) => onChange(index, { ...block.props, secondaryCtaText: event.target.value })}
                  style={styles.propertyInput}
                  placeholder="Learn More"
                />
              </div>
              <div style={styles.propertyField}>
                <label style={styles.propertyLabel}>Secondary Link</label>
                <input
                  type="text"
                  value={String(block?.props?.secondaryCtaLink || "")}
                  onChange={(event) => onChange(index, { ...block.props, secondaryCtaLink: event.target.value })}
                  style={styles.propertyInput}
                  placeholder="#services"
                />
              </div>
            </div>
          </div>
        ) : null}
        {isHero && shouldShowHeroPanelSection("layout") ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Text Block Position</label>
            <div style={styles.inlineChipRow}>
              {[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
              ].map((option) => (
                <button
                  key={`hero-align-${option.value}`}
                  type="button"
                  style={{ ...styles.presetChip, ...(String(block?.props?.headlineAlignment || "center") === option.value ? styles.presetChipActive : {}) }}
                  onClick={() => applyCanvasAlignment("x", option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div style={styles.inlineChipRow}>
              {[
                { value: "top", label: "Top" },
                { value: "center", label: "Middle" },
                { value: "bottom", label: "Bottom" },
              ].map((option) => (
                <button
                  key={`hero-vertical-${option.value}`}
                  type="button"
                  style={{ ...styles.presetChip, ...(String(block?.props?.verticalAlign || "center") === option.value ? styles.presetChipActive : {}) }}
                  onClick={() => applyCanvasAlignment("y", option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div style={styles.colorGrid}>
              <NumberField label="Text X %" value={Number(block?.props?.contentX ?? getHeroLayoutDefaults(block?.props?.heroVariant || "spotlight").contentX)} min={0} max={100} onChange={(value) => onChange(index, { ...block.props, contentX: value })} />
              <NumberField label="Text Y %" value={Number(block?.props?.contentY ?? getHeroLayoutDefaults(block?.props?.heroVariant || "spotlight").contentY)} min={0} max={100} onChange={(value) => onChange(index, { ...block.props, contentY: value })} />
              <NumberField label="Text Width" value={Number(block?.props?.contentWidth ?? getHeroLayoutDefaults(block?.props?.heroVariant || "spotlight").contentWidth)} min={180} max={1400} onChange={(value) => onChange(index, { ...block.props, contentWidth: value })} />
              <NumberField label="Text Height" value={Number(block?.props?.contentHeight ?? getHeroLayoutDefaults(block?.props?.heroVariant || "spotlight").contentHeight)} min={80} max={1000} onChange={(value) => onChange(index, { ...block.props, contentHeight: value })} />
            </div>
          </div>
        ) : null}
        {isHero && shouldShowHeroPanelSection("media") ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>{block.type === BlockTypes.PARALLAX ? "Section Background Image" : "Hero Background Image"}</label>
            <p style={styles.aiHint}>Use an actual hero image, not just the draggable overlay.</p>
            {currentBackgroundPreview ? (
              <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                <div style={{ width: "100%", minHeight: 132, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(148,163,184,0.24)", background: "#0f172a" }}>
                  <img src={currentBackgroundPreview} alt="Current hero background" style={{ width: "100%", height: 132, objectFit: "cover", display: "block" }} />
                </div>
                <div style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.5 }}>Current background used on the hero.</div>
              </div>
            ) : null}
            <div style={styles.assetPicker}>
              <label style={styles.assetUploadCta}>
                Upload Background
                <input
                  type="file"
                  accept="image/*"
                  style={styles.hiddenInput}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    onChange(index, { ...block.props, backgroundStyle: "image" });
                    onUploadImage(index, "backgroundImage", file);
                  }}
                />
              </label>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => openSharedLibraryAssetPicker((asset) => onSelectAsset(index, "backgroundImage", asset))}
              >
                Choose From Library
              </button>
              {block?.props?.backgroundImage ? (
                <button
                  type="button"
                  style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }}
                  onClick={() => onChange(index, { ...block.props, backgroundImage: "", backgroundImageAssetId: undefined, backgroundStyle: "gradient" })}
                >
                  Remove Background
                </button>
              ) : null}
            </div>
            <div style={styles.assetLibraryActionRow}>
              <button type="button" style={styles.assetLibraryBtn} onClick={() => openAssetBrowser("backgroundImage", block.type === BlockTypes.PARALLAX ? "Section Background Library" : "Hero Background Library")}>
                Open Media Library
              </button>
              <button type="button" style={styles.assetLibraryBtnSecondary} onClick={() => onRefreshAssetLibrary?.()}>
                Refresh Library
              </button>
            </div>
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Background Mode</label>
            <select
              value={String(block?.props?.backgroundStyle || "gradient")}
              onChange={(e) => onChange(index, normalizeHeroBackgroundModeProps(block.props, e.target.value))}
              style={styles.propertyInput}
            >
              <option value="gradient">Gradient</option>
              <option value="solid">Solid</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
            {((block?.props?.backgroundStyle || "gradient") === "image" || block.type === BlockTypes.PARALLAX) ? (
              <>
                <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Background Position</label>
                <select
                  value={String(block?.props?.backgroundPosition || "center center")}
                  onChange={(e) => onChange(index, { ...block.props, backgroundPosition: e.target.value, backgroundStyle: "image" })}
                  style={styles.propertyInput}
                >
                  <option value="top center">Top (show image top)</option>
                  <option value="center center">Middle (default)</option>
                  <option value="bottom center">Bottom (show image bottom)</option>
                  <option value="center left">Left</option>
                  <option value="center right">Right</option>
                </select>
                <input
                  type="text"
                  value={String(block?.props?.backgroundPosition || "center center")}
                  onChange={(e) => onChange(index, { ...block.props, backgroundPosition: e.target.value, backgroundStyle: "image" })}
                  placeholder="e.g. 50% 30% or center 120px"
                  style={{ ...styles.propertyInput, marginTop: 4 }}
                  title="Custom background-position CSS value"
                />
                <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Background Size</label>
                <select
                  value={String(block?.props?.backgroundSize || "cover")}
                  onChange={(e) => onChange(index, { ...block.props, backgroundSize: e.target.value, backgroundStyle: "image" })}
                  style={styles.propertyInput}
                >
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="auto">Auto</option>
                </select>
                <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={String(block?.props?.backgroundRepeat || "no-repeat") === "no-repeat"}
                    onChange={(e) => onChange(index, {
                      ...block.props,
                      backgroundRepeat: e.target.checked ? "no-repeat" : "repeat",
                      backgroundStyle: "image",
                    })}
                    style={styles.checkboxInput}
                  />
                  No repeat background image
                </label>
              </>
            ) : null}
            {(block?.props?.backgroundStyle || "gradient") === "video" ? (
              <>
                <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Video Background (MP4)</label>
                <label style={{ ...styles.secondaryBtn, display: "block", textAlign: "center", cursor: "pointer", marginBottom: 6 }}>
                  Upload MP4 Video
                  <input
                    type="file"
                    accept="video/mp4,video/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const localUrl = URL.createObjectURL(file);
                      onChange(index, { ...block.props, backgroundStyle: "video", backgroundVideoUrl: localUrl });
                      onUploadImage?.(index, "backgroundVideoUrl", file);
                    }}
                  />
                </label>
                <input
                  type="text"
                  value={String(block?.props?.backgroundVideoUrl || "")}
                  onChange={(e) => onChange(index, { ...block.props, backgroundStyle: "video", backgroundVideoUrl: e.target.value })}
                  style={styles.propertyInput}
                  placeholder="Or paste MP4 URL here"
                />
                {block?.props?.backgroundVideoUrl ? (
                  <button
                    type="button"
                    style={{ ...styles.secondaryBtn, marginTop: 4, color: "#ef4444" }}
                    onClick={() => onChange(index, { ...block.props, backgroundVideoUrl: "" })}
                  >Remove Video</button>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
        {isHero && shouldShowHeroPanelSection("layout") ? (
          <div style={styles.sectionCard}>
            <label style={styles.inlineToggle}>
              <input
                type="checkbox"
                checked={!!(block.props?.heroHtmlEmbed)}
                onChange={(e) => onChange(index, { ...block.props, heroHtmlEmbed: e.target.checked ? "<!-- paste embed code here -->" : "" })}
                style={styles.checkboxInput}
              />
              {"</>"} HTML Embed inside Hero
            </label>
            {block.props?.heroHtmlEmbed ? (
              <>
                <p style={{ margin: "8px 0 6px", color: "#64748b", fontSize: 16, lineHeight: 1.5 }}>Paste any iframe, widget, or embed code. It renders at the bottom of the hero section.</p>
                <textarea
                  value={block.props?.heroHtmlEmbed || ""}
                  onChange={(e) => onChange(index, { ...block.props, heroHtmlEmbed: e.target.value })}
                  placeholder={"<iframe src=\"...\"></iframe>\n<!-- or any embed code -->"}
                  style={{ ...styles.propertyInput, minHeight: 120, fontFamily: "monospace", fontSize: 16, resize: "vertical" }}
                  spellCheck={false}
                />
              </>
            ) : null}
          </div>
        ) : null}
        {supportsCopyRegeneration(block.type) && shouldShowHeroPanelSection("layout") ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>AI Copy</label>
            <label style={styles.propertyLabel}>Tone</label>
            <select
              value={regenTone}
              onChange={(e) => setRegenTone(e.target.value)}
              style={styles.propertyInput}
            >
              {COPY_TONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              type="button"
              style={styles.aiActionBtn}
              onClick={regenerateBlockCopy}
              disabled={regenBusy}
            >
              {regenBusy ? "Regenerating..." : "Regenerate Section Copy"}
            </button>
            <p style={styles.aiHint}>Keeps current layout/style settings and refreshes text only.</p>
            {regenError ? <p style={styles.aiErrorText}>{regenError}</p> : null}
          </div>
        ) : null}
        {shouldShowHeroPanelSection("layout") ? (
          <BlockPresetPicker
            blockType={block.type}
            onApply={(patch) => onChange(index, { ...block.props, ...patch })}
          />
        ) : null}
        {isHero && shouldShowHeroPanelSection("animations") ? (
          <>
            {renderAnimationControlCard("Section Entrance", "sectionAnimation", "sectionAnimationDelay", "sectionAnimationSpeed", { animation: "fade-up", delay: 0.06, speed: 0.9 })}
            {renderAnimationControlCard("Content Shell", "contentOverlayAnimation", "contentOverlayAnimationDelay", "contentOverlayAnimationSpeed", { animation: "sweep-right", delay: 0.22, speed: 1.05 })}
            {renderAnimationControlCard("Overlay Image", "imageOverlayAnimation", "imageOverlayAnimationDelay", "imageOverlayAnimationSpeed", { animation: "sweep-left", delay: 0.08, speed: 1.45 })}
            {renderAnimationControlCard("Headline", "textAnimation", "textAnimationDelay", "textAnimationSpeed", { animation: "fade-up", delay: 0, speed: 0.8 })}
            {renderAnimationControlCard("Body Copy", "subheadlineAnimation", "subheadlineAnimationDelay", "subheadlineAnimationSpeed", { animation: "fade-in", delay: 0.12, speed: 0.9 })}
            {renderAnimationControlCard("CTA Buttons", "ctaAnimation", "ctaAnimationDelay", "ctaAnimationSpeed", { animation: "fade-up", delay: 0.18, speed: 0.9 })}
          </>
        ) : null}
        {/* ─── Overlays tab ─── */}
        {isHero && shouldShowHeroPanelSection("overlays") ? (
          <>
            {/* Hero stat items */}
            <div style={styles.sectionCard}>
              <label style={styles.propertyLabel}>Inline Hero Stats (below CTA buttons)</label>
              <p style={styles.aiHint}>Small number + label pairs shown inline in the hero, e.g. "500+ Clients".</p>
              {(Array.isArray(block?.props?.heroStatItems) ? block.props.heroStatItems : []).map((stat, sIdx) => {
                const updateStat = (patch) => {
                  const next = (Array.isArray(block?.props?.heroStatItems) ? block.props.heroStatItems : []).map((s, i) => i !== sIdx ? s : { ...s, ...patch });
                  onChange(index, { ...block.props, heroStatItems: next });
                };
                const deleteStat = () => {
                  const next = (Array.isArray(block?.props?.heroStatItems) ? block.props.heroStatItems : []).filter((_, i) => i !== sIdx);
                  onChange(index, { ...block.props, heroStatItems: next });
                };
                return (
                  <div key={stat.id || sIdx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, alignItems: "center", marginBottom: 6 }}>
                    <input type="text" value={stat.number || ""} onChange={(e) => updateStat({ number: e.target.value })} style={styles.propertyInput} placeholder="e.g. 500+" />
                    <input type="text" value={stat.label || ""} onChange={(e) => updateStat({ label: e.target.value })} style={styles.propertyInput} placeholder="e.g. Clients" />
                    <button type="button" onClick={deleteStat} style={{ ...styles.secondaryBtn, color: "#ef4444", padding: "4px 8px" }}>✕</button>
                  </div>
                );
              })}
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => {
                  const current = Array.isArray(block?.props?.heroStatItems) ? block.props.heroStatItems : [];
                  onChange(index, { ...block.props, heroStatItems: [...current, { id: `stat-${Date.now()}`, number: "", label: "" }] });
                }}
              >+ Add Stat</button>
            </div>
            {/* Extra text overlays */}
            <div style={styles.sectionCard}>
              <label style={styles.propertyLabel}>Text Overlays</label>
              <p style={styles.aiHint}>Free-floating text blocks. Add them with the green "+ Text Block" chip on the hero canvas.</p>
              {(Array.isArray(block?.props?.extraTextOverlays) ? block.props.extraTextOverlays : []).length === 0 ? (
                <p style={{ margin: 0, fontSize: 16, color: "#64748b" }}>No text overlays yet.</p>
              ) : (Array.isArray(block?.props?.extraTextOverlays) ? block.props.extraTextOverlays : []).map((txt, tIdx) => {
                const deleteTxt = () => {
                  const next = (Array.isArray(block?.props?.extraTextOverlays) ? block.props.extraTextOverlays : []).filter((_, i) => i !== tIdx);
                  onChange(index, { ...block.props, extraTextOverlays: next });
                };
                return (
                  <div key={txt.id || tIdx} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, minWidth: 0 }}>
                    <div style={{ flex: 1, fontSize: 16, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", background: "rgba(0,0,0,0.2)", borderRadius: 6, padding: "4px 8px" }}>
                      {(txt.text || "(empty)").replace(/<[^>]*>/g, "").trim() || "(empty)"}
                    </div>
                    <button type="button" onClick={deleteTxt} style={{ ...styles.secondaryBtn, color: "#ef4444", padding: "4px 8px", flexShrink: 0 }}>Remove</button>
                  </div>
                );
              })}
            </div>
            {/* Floating images */}
            <div style={styles.sectionCard}>
              <label style={styles.propertyLabel}>Floating Images</label>
              <p style={styles.aiHint}>Images overlaid on the hero. Drag on canvas to reposition. Add via "+ Logo" or "+ Image / GIF" on the hero.</p>
              {(Array.isArray(block?.props?.floatingImages) ? block.props.floatingImages : []).length === 0 ? (
                <p style={{ margin: "0 0 8px", fontSize: 16, color: "#64748b" }}>No floating images yet.</p>
              ) : (Array.isArray(block?.props?.floatingImages) ? block.props.floatingImages : []).map((img, iIdx) => {
                const deleteImg = () => {
                  const next = (Array.isArray(block?.props?.floatingImages) ? block.props.floatingImages : []).filter((_, i) => i !== iIdx);
                  onChange(index, { ...block.props, floatingImages: next, floatingImage: next[0]?.src || "" });
                };
                const imgSrc = resolveAssetField(img, "src", brandAssets) || img?.src || "";
                const replaceInputId = `replace-float-img-${index}-${iIdx}`;
                return (
                  <div key={img.id || iIdx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, padding: 8, borderRadius: 8, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(0,0,0,0.15)", minWidth: 0 }}>
                    <label htmlFor={replaceInputId} title="Click to replace image" style={{ cursor: "pointer", flexShrink: 0, position: "relative" }}>
                      {imgSrc ? <img src={imgSrc} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, display: "block" }} /> : <div style={{ width: 44, height: 44, borderRadius: 6, background: "rgba(255,255,255,0.05)" }} />}
                      <div style={{ position: "absolute", inset: 0, borderRadius: 6, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0"}
                      >
                        <span style={{ fontSize: 18, color: "#fff" }}>✎</span>
                      </div>
                      <input id={replaceInputId} type="file" accept="image/*,image/gif" style={{ display: "none" }} onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        Promise.resolve(onUploadImage?.(index, "__addFloatingImage", file)).then((asset) => {
                          if (!asset?.src) return;
                          const current = Array.isArray(block?.props?.floatingImages) ? block.props.floatingImages : [];
                          const next = current.map((fi, i) => i !== iIdx ? fi : { ...fi, src: asset.src, assetId: asset.id || "" });
                          onChange(index, { ...block.props, floatingImages: next, floatingImage: next[0]?.src || "" });
                        });
                      }} />
                    </label>
                    <span style={{ flex: 1, fontSize: 16, color: "#94a3b8" }}>Image {iIdx + 1}</span>
                    <button type="button" onClick={deleteImg} style={{ ...styles.secondaryBtn, color: "#ef4444", padding: "4px 8px", flexShrink: 0 }}>Remove</button>
                  </div>
                );
              })}
              <label style={{ ...styles.secondaryBtn, display: "block", textAlign: "center", cursor: "pointer", marginTop: 4 }}>
                Upload Floating Image
                <input type="file" accept="image/*,image/gif" style={{ display: "none" }} onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  Promise.resolve(onUploadImage?.(index, "__addFloatingImage", file)).then((asset) => {
                    if (!asset?.src) return;
                    const current = Array.isArray(block?.props?.floatingImages) ? block.props.floatingImages : [];
                    onChange(index, { ...block.props, floatingImages: [...current, { src: asset.src, assetId: asset.id || "", x: 76, y: 52, width: 280, height: 320, animation: "sweep-left", animationDelay: 0.08, animationSpeed: 1.45 }] });
                  });
                }} />
              </label>
            </div>
            {/* Orbit feature cards editor */}
            {block?.props?.heroVariant === "orbit" ? (
              <div style={styles.sectionCard}>
                <label style={styles.propertyLabel}>Orbit Feature Cards</label>
                <p style={styles.aiHint}>6 floating cards shown around your avatar. Customize the title, icon (emoji), and up to 2 lines each.</p>
                {(Array.isArray(block?.props?.orbitCards) && block.props.orbitCards.length > 0
                  ? block.props.orbitCards
                  : [
                    { id: "oc1", title: "Integrations", icon: "🔗", accent: "#6366f1", lines: ["Slack, Gmail +26 more", "All connected"] },
                    { id: "oc2", title: "Dashboards",   icon: "📊", accent: "#10b981", lines: ["$120,760 revenue", "↑ 14% this month"] },
                    { id: "oc3", title: "Conversations",icon: "💬", accent: "#3b82f6", lines: ["3 unread threads", "Team standup done"] },
                    { id: "oc4", title: "Data records", icon: "🗂️", accent: "#f59e0b", lines: ["lead_scoring_model", "sales_targets_rev2"] },
                    { id: "oc5", title: "Files",        icon: "📁", accent: "#8b5cf6", lines: ["proposal_v2.pdf", "client_brief.docx"] },
                    { id: "oc6", title: "Updates",      icon: "🔔", accent: "#ec4899", lines: ["Ben shared a draft", "2 mentions today"] },
                  ]
                ).slice(0, 6).map((card, cIdx) => {
                  const updateCard = (patch) => {
                    const base = Array.isArray(block?.props?.orbitCards) && block.props.orbitCards.length > 0
                      ? block.props.orbitCards
                      : [
                        { id: "oc1", title: "Integrations", icon: "🔗", accent: "#6366f1", lines: ["Slack, Gmail +26 more", "All connected"] },
                        { id: "oc2", title: "Dashboards",   icon: "📊", accent: "#10b981", lines: ["$120,760 revenue", "↑ 14% this month"] },
                        { id: "oc3", title: "Conversations",icon: "💬", accent: "#3b82f6", lines: ["3 unread threads", "Team standup done"] },
                        { id: "oc4", title: "Data records", icon: "🗂️", accent: "#f59e0b", lines: ["lead_scoring_model", "sales_targets_rev2"] },
                        { id: "oc5", title: "Files",        icon: "📁", accent: "#8b5cf6", lines: ["proposal_v2.pdf", "client_brief.docx"] },
                        { id: "oc6", title: "Updates",      icon: "🔔", accent: "#ec4899", lines: ["Ben shared a draft", "2 mentions today"] },
                      ];
                    const next = base.map((c, i) => i !== cIdx ? c : { ...c, ...patch });
                    onChange(index, { ...block.props, orbitCards: next });
                  };
                  const SLOT_LABELS = ["Top Left", "Top Right", "Mid Left", "Mid Right", "Bot Left", "Bot Right"];
                  return (
                    <div key={card.id || cIdx} style={{ border: "1px solid rgba(148,163,184,0.18)", borderRadius: 10, padding: "10px 10px 8px", marginBottom: 10, background: "rgba(0,0,0,0.15)" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>Card {cIdx + 1} — {SLOT_LABELS[cIdx] || ""}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 52px", gap: 6, marginBottom: 6 }}>
                        <div>
                          <label style={styles.propertyLabel}>Icon</label>
                          <input type="text" value={card.icon || ""} onChange={(e) => updateCard({ icon: e.target.value })} style={{ ...styles.propertyInput, textAlign: "center", fontSize: 18 }} placeholder="📊" maxLength={4} />
                        </div>
                        <div>
                          <label style={styles.propertyLabel}>Title</label>
                          <input type="text" value={card.title || ""} onChange={(e) => updateCard({ title: e.target.value })} style={styles.propertyInput} placeholder="Feature name" />
                        </div>
                        <div>
                          <label style={styles.propertyLabel}>Accent</label>
                          <input type="color" value={card.accent || "#6366f1"} onChange={(e) => updateCard({ accent: e.target.value })} style={{ ...styles.propertyInput, padding: 2, height: 32, cursor: "pointer" }} title="Card accent colour" />
                        </div>
                      </div>
                      <label style={styles.propertyLabel}>Line 1</label>
                      <input type="text" value={(card.lines || [])[0] || ""} onChange={(e) => { const lines = [...(card.lines || [])]; lines[0] = e.target.value; updateCard({ lines }); }} style={styles.propertyInput} placeholder="e.g. 1,240 visits" />
                      <label style={{ ...styles.propertyLabel, marginTop: 5 }}>Line 2</label>
                      <input type="text" value={(card.lines || [])[1] || ""} onChange={(e) => { const lines = [...(card.lines || [])]; lines[1] = e.target.value; updateCard({ lines }); }} style={styles.propertyInput} placeholder="e.g. +8.4% this week" />
                    </div>
                  );
                })}
              </div>
            ) : null}
            {/* Counter Widgets */}
            {(Array.isArray(block?.props?.extraCounterOverlays) ? block.props.extraCounterOverlays : []).length > 0 ? (
              <div style={styles.sectionCard}>
                <label style={styles.propertyLabel}>Counter Widgets</label>
                <p style={styles.aiHint}>Counters dragged onto the hero. Edit each one below.</p>
                {(Array.isArray(block?.props?.extraCounterOverlays) ? block.props.extraCounterOverlays : []).map((ctr, cIdx) => {
                  const updateCtr = (patch) => {
                    const next = (Array.isArray(block?.props?.extraCounterOverlays) ? block.props.extraCounterOverlays : []).map((t, i) => i !== cIdx ? t : { ...t, ...patch });
                    onChange(index, { ...block.props, extraCounterOverlays: next });
                  };
                  const deleteCtr = () => {
                    const next = (Array.isArray(block?.props?.extraCounterOverlays) ? block.props.extraCounterOverlays : []).filter((_, i) => i !== cIdx);
                    onChange(index, { ...block.props, extraCounterOverlays: next });
                  };
                  return (
                    <div key={ctr.id || cIdx} style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 10, padding: "10px 10px 6px", marginBottom: 10, background: "rgba(0,0,0,0.15)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: "#94a3b8" }}>Counter {cIdx + 1}</span>
                        <button type="button" onClick={deleteCtr} style={{ ...styles.secondaryBtn, color: "#ef4444", padding: "2px 8px", fontSize: 16 }}>Remove</button>
                      </div>
                      <label style={styles.propertyLabel}>Label</label>
                      <input type="text" value={ctr.label || ""} onChange={(e) => updateCtr({ label: e.target.value })} style={styles.propertyInput} placeholder="e.g. Site Visits" />
                      <label style={{ ...styles.propertyLabel, marginTop: 6 }}>Background</label>
                      <input type="text" value={ctr.background || ""} onChange={(e) => updateCtr({ background: e.target.value })} style={styles.propertyInput} placeholder="e.g. rgba(0,0,0,0.6)" />
                      <div style={{ ...styles.colorGrid, marginTop: 6 }}>
                        <ColorSelector label="Number color" value={ctr.numberColor || "#0c8ce9"} fallback="#0c8ce9" onChange={(v) => updateCtr({ numberColor: v })} />
                        <ColorSelector label="Label color" value={ctr.labelColor || "#ffffff"} fallback="#ffffff" onChange={(v) => updateCtr({ labelColor: v })} />
                      </div>
                      <div style={{ ...styles.colorGrid, marginTop: 6 }}>
                        <ColorSelector label="Icon color" value={ctr.iconColor || "#ffffff"} fallback="#ffffff" onChange={(v) => updateCtr({ iconColor: v })} />
                        <NumberField label="Number size" value={Number(ctr.numberSize ?? 52)} min={20} max={120} onChange={(v) => updateCtr({ numberSize: v })} />
                      </div>
                      <label style={{ ...styles.propertyLabel, marginTop: 6 }}>Icon shape</label>
                      <select value={ctr.bgIcon || "diamond"} onChange={(e) => updateCtr({ bgIcon: e.target.value })} style={styles.propertyInput}>
                        <option value="diamond">Diamond</option>
                        <option value="circle">Circle</option>
                        <option value="star">Star</option>
                        <option value="hexagon">Hexagon</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : null}
        {/* ─── Counter tab ─── */}
        {isHero && shouldShowHeroPanelSection("counter") ? (
          <>
            <div style={styles.sectionCard}>
              <label style={styles.propertyLabel}>Hero Inline Counter</label>
              <p style={styles.aiHint}>Embed a draggable animated counter widget inside the hero. Drag it beside your image at the bottom.</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 16, color: "#e2e8f0" }}>
                  <input
                    type="checkbox"
                    checked={!!block?.props?.heroInlineCounter?.enabled}
                    onChange={(e) => {
                      const cur = block?.props?.heroInlineCounter || {};
                      onChange(index, { ...block.props, heroInlineCounter: { ...cur, enabled: e.target.checked } });
                    }}
                    style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#0ea5e9" }}
                  />
                  Enable counter in hero
                </label>
              </div>
              {block?.props?.heroInlineCounter?.enabled ? (
                <>
                  <CounterLiveStats
                    projectId={project?.id || ""}
                    startNumber={block?.props?.heroInlineCounter?.startNumber ?? 0}
                  />
                  <label style={styles.propertyLabel}>Starting visit count</label>
                  <p style={{ ...styles.aiHint, marginBottom: 4 }}>Set the number shown now. Every real page visit adds +1 on top of this.</p>
                  <input
                    type="number"
                    value={block?.props?.heroInlineCounter?.startNumber ?? 0}
                    onChange={(e) => {
                      const cur = block?.props?.heroInlineCounter || {};
                      const n = Number(e.target.value);
                      onChange(index, { ...block.props, heroInlineCounter: { ...cur, startNumber: n, targetNumber: n } });
                    }}
                    placeholder="e.g. 28642"
                    style={styles.propertyInput}
                  />
                  <label style={{ ...styles.propertyLabel, marginTop: 6 }}>Suffix (e.g. +, %)</label>
                  <input
                    type="text"
                    value={block?.props?.heroInlineCounter?.suffix || ""}
                    onChange={(e) => {
                      const cur = block?.props?.heroInlineCounter || {};
                      onChange(index, { ...block.props, heroInlineCounter: { ...cur, suffix: e.target.value } });
                    }}
                    placeholder="e.g. +"
                    style={styles.propertyInput}
                  />
                  <label style={{ ...styles.propertyLabel, marginTop: 6 }}>Label text</label>
                  <input
                    type="text"
                    value={block?.props?.heroInlineCounter?.label || ""}
                    onChange={(e) => {
                      const cur = block?.props?.heroInlineCounter || {};
                      onChange(index, { ...block.props, heroInlineCounter: { ...cur, label: e.target.value } });
                    }}
                    placeholder="e.g. Happy Customers"
                    style={styles.propertyInput}
                  />
                  <label style={{ ...styles.propertyLabel, marginTop: 6 }}>Background</label>
                  <input
                    type="text"
                    value={block?.props?.heroInlineCounter?.backgroundColor || "rgba(0,0,0,0.55)"}
                    onChange={(e) => {
                      const cur = block?.props?.heroInlineCounter || {};
                      onChange(index, { ...block.props, heroInlineCounter: { ...cur, backgroundColor: e.target.value } });
                    }}
                    placeholder="rgba(0,0,0,0.55) or #1e293b"
                    style={styles.propertyInput}
                  />
                  <div style={{ ...styles.colorGrid, marginTop: 8 }}>
                    <ColorSelector
                      label="Number color"
                      value={block?.props?.heroInlineCounter?.numberColor || "#0c8ce9"}
                      fallback="#0c8ce9"
                      onChange={(v) => {
                        const cur = block?.props?.heroInlineCounter || {};
                        onChange(index, { ...block.props, heroInlineCounter: { ...cur, numberColor: v } });
                      }}
                    />
                    <ColorSelector
                      label="Label color"
                      value={block?.props?.heroInlineCounter?.labelColor || "#ffffff"}
                      fallback="#ffffff"
                      onChange={(v) => {
                        const cur = block?.props?.heroInlineCounter || {};
                        onChange(index, { ...block.props, heroInlineCounter: { ...cur, labelColor: v } });
                      }}
                    />
                    <ColorSelector
                      label="Icon color"
                      value={block?.props?.heroInlineCounter?.iconColor || "#ffffff"}
                      fallback="#ffffff"
                      onChange={(v) => {
                        const cur = block?.props?.heroInlineCounter || {};
                        onChange(index, { ...block.props, heroInlineCounter: { ...cur, iconColor: v } });
                      }}
                    />
                  </div>
                  <div style={{ ...styles.colorGrid, marginTop: 8 }}>
                    <NumberField
                      label="Number size"
                      value={Number(block?.props?.heroInlineCounter?.numberFontSize ?? 64)}
                      min={24}
                      max={120}
                      onChange={(v) => {
                        const cur = block?.props?.heroInlineCounter || {};
                        onChange(index, { ...block.props, heroInlineCounter: { ...cur, numberFontSize: v } });
                      }}
                    />
                  </div>
                  <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Background icon shape</label>
                  <select
                    value={block?.props?.heroInlineCounter?.iconType || "diamond"}
                    onChange={(e) => {
                      const cur = block?.props?.heroInlineCounter || {};
                      onChange(index, { ...block.props, heroInlineCounter: { ...cur, iconType: e.target.value } });
                    }}
                    style={styles.propertyInput}
                  >
                    <option value="diamond">Diamond</option>
                    <option value="circle">Circle</option>
                    <option value="star">Star</option>
                    <option value="hexagon">Hexagon</option>
                    <option value="none">None</option>
                  </select>
                  <p style={{ ...styles.aiHint, marginTop: 8 }}>Drag the counter on the canvas to reposition it. The ✕ button on the widget disables it.</p>
                </>
              ) : null}
            </div>
          </>
        ) : null}
        {![BlockTypes.HERO, BlockTypes.PARALLAX, BlockTypes.STATS, BlockTypes.CTA_BUTTON].includes(block.type) && textContentKeys.length ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Text Editing</label>
            <p style={{ margin: 0, color: "#64748b", fontSize: 16, lineHeight: 1.5 }}>Edit text directly on the canvas. Use the floating text toolbar or the on-block size controls when available.</p>
          </div>
        ) : null}
        {supportsOverlayImage && shouldShowHeroPanelSection("media") ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Overlay Image / Logo</label>
            <p style={styles.aiHint}>Add a logo, badge, or product shot over the background image.</p>
            {effectiveOverlayPreview ? (
              <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                <div style={{ width: "100%", minHeight: 132, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(148,163,184,0.24)", background: "linear-gradient(180deg,#0f172a,#111827)", display: "grid", placeItems: "center", padding: 16, boxSizing: "border-box" }}>
                  <img src={effectiveOverlayPreview} alt="Current overlay media" style={{ maxWidth: "100%", maxHeight: 132, objectFit: currentOverlayPreview ? "cover" : "contain", display: "block" }} />
                </div>
                <div style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.5 }}>
                  {currentOverlayPreview ? "Current overlay image used on the hero." : "No custom overlay set, so the hero falls back to the saved brand logo."}
                </div>
              </div>
            ) : null}
            <div style={styles.assetPicker}>
              <label style={styles.assetUploadCta}>
                Upload Overlay
                <input
                  type="file"
                  accept="image/*"
                  style={styles.hiddenInput}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    onChange(index, withHeroOverlayDefaults(block.props || {}));
                    onUploadImage(index, "floatingImage", file);
                  }}
                />
              </label>
              {savedLogo ? (
                <button
                  type="button"
                  style={styles.assetChip}
                  onClick={() => {
                    const nextProps = applyAssetToProps(block.props || {}, "floatingImage", savedLogo);
                    onChange(index, {
                      ...withHeroOverlayDefaults(nextProps),
                      floatingImage: savedLogo.src || "",
                    });
                    onSelectAsset(index, "floatingImage", savedLogo);
                  }}
                >
                  Use Brand Logo
                </button>
              ) : null}
              {!block?.props?.floatingImage ? (
                <button
                  type="button"
                  style={styles.assetChip}
                  onClick={() => onChange(index, {
                    ...withHeroOverlayDefaults(block.props || {}),
                    floatingImage: "https://placehold.co/640x640/e2e8f0/475569?text=%20",
                  })}
                >
                  Add Placeholder
                </button>
              ) : (
                <button
                  type="button"
                  style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }}
                  onClick={() => onChange(index, { ...block.props, floatingImage: "" })}
                >
                  Remove Overlay
                </button>
              )}
              <button
                type="button"
                style={styles.assetLibraryBtn}
                onClick={() => openAssetBrowser("floatingImage", "Overlay Media Library")}
              >
                Open Media Library
              </button>
            </div>
            <div style={styles.colorGrid}>
              <NumberField label="Image X %" value={Number(block?.props?.floatingX ?? 76)} min={0} max={100} onChange={(value) => onChange(index, { ...block.props, enableParallax: true, floatingX: value })} />
              <NumberField label="Image Y %" value={Number(block?.props?.floatingY ?? 58)} min={0} max={100} onChange={(value) => onChange(index, { ...block.props, enableParallax: true, floatingY: value })} />
              <NumberField label="Image W" value={Number(block?.props?.floatingWidth ?? 220)} min={80} max={1000} onChange={(value) => onChange(index, { ...block.props, enableParallax: true, floatingWidth: value })} />
              <NumberField label="Image H" value={Number(block?.props?.floatingHeight ?? 220)} min={80} max={1000} onChange={(value) => onChange(index, { ...block.props, enableParallax: true, floatingHeight: value })} />
            </div>
          </div>
        ) : null}
        {isHero && shouldShowHeroPanelSection("style") ? (
          <ColorSelector
            label="Text Block Background"
            value={String(block?.props?.contentBackground || "transparent")}
            fallback="transparent"
            allowTransparent
            onChange={(nextValue) => onChange(index, { ...block.props, contentBackground: nextValue })}
          />
        ) : null}
        {isHero && shouldShowHeroPanelSection("style") ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Headline Text Style</label>
            <select
              value={String(block?.props?.headlineTextStyle || "fill")}
              onChange={(e) => onChange(index, { ...block.props, headlineTextStyle: e.target.value })}
              style={styles.propertyInput}
            >
              <option value="fill">Fill (default)</option>
              <option value="outline">Outline</option>
              <option value="gradient">Gradient</option>
              <option value="glow">Glow</option>
              <option value="shadow">Drop Shadow</option>
            </select>
            {block?.props?.headlineTextStyle === "outline" ? (
              <>
                <ColorSelector label="Outline Color" value={block?.props?.headlineOutlineColor || "#ffffff"} fallback="#ffffff" onChange={(v) => onChange(index, { ...block.props, headlineOutlineColor: v })} />
                <NumberField label="Outline Width (px)" value={Number(block?.props?.headlineOutlineWidth || 2)} min={1} max={12} onChange={(v) => onChange(index, { ...block.props, headlineOutlineWidth: v })} />
              </>
            ) : null}
            {block?.props?.headlineTextStyle === "gradient" ? (
              <>
                <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Gradient Presets</label>
                <div style={styles.inlineChipRow}>
                  {[
                    { label: "Purple → Pink", value: "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)" },
                    { label: "Blue → Cyan", value: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)" },
                    { label: "Gold → Orange", value: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)" },
                    { label: "Green → Teal", value: "linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)" },
                    { label: "White → Silver", value: "linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)" },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      style={{ ...styles.presetChip, ...(block?.props?.headlineGradient === preset.value ? styles.presetChipActive : {}) }}
                      onClick={() => onChange(index, { ...block.props, headlineGradient: preset.value })}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <label style={{ ...styles.propertyLabel, marginTop: 6 }}>Custom Gradient CSS</label>
                <input
                  type="text"
                  value={String(block?.props?.headlineGradient || "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)")}
                  onChange={(e) => onChange(index, { ...block.props, headlineGradient: e.target.value })}
                  style={{ ...styles.propertyInput, marginTop: 4 }}
                  placeholder="linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)"
                />
              </>
            ) : null}
            {block?.props?.headlineTextStyle === "glow" ? (
              <>
                <ColorSelector label="Glow Color" value={block?.props?.headlineGlowColor || "#7c3aed"} fallback="#7c3aed" onChange={(v) => onChange(index, { ...block.props, headlineGlowColor: v })} />
                <NumberField label="Glow Blur (px)" value={Number(block?.props?.headlineGlowBlur || 20)} min={4} max={80} onChange={(v) => onChange(index, { ...block.props, headlineGlowBlur: v })} />
              </>
            ) : null}
            {block?.props?.headlineTextStyle === "shadow" ? (
              <>
                <ColorSelector label="Shadow Color" value={block?.props?.headlineShadowColor || "rgba(0,0,0,0.6)"} fallback="#000000" onChange={(v) => onChange(index, { ...block.props, headlineShadowColor: v })} />
                <div style={styles.colorGrid}>
                  <NumberField label="Blur (px)" value={Number(block?.props?.headlineShadowBlur || 12)} min={0} max={60} onChange={(v) => onChange(index, { ...block.props, headlineShadowBlur: v })} />
                  <NumberField label="Offset X" value={Number(block?.props?.headlineShadowOffsetX ?? 2)} min={-30} max={30} onChange={(v) => onChange(index, { ...block.props, headlineShadowOffsetX: v })} />
                  <NumberField label="Offset Y" value={Number(block?.props?.headlineShadowOffsetY ?? 4)} min={-30} max={30} onChange={(v) => onChange(index, { ...block.props, headlineShadowOffsetY: v })} />
                </div>
              </>
            ) : null}
            <div style={{ ...styles.colorGrid, marginTop: 10 }}>
              <NumberField label="Headline Size" value={Number(block?.props?.headlineFontSize || 52)} min={18} max={120} onChange={(value) => onChange(index, { ...block.props, headlineFontSize: value })} />
              <NumberField label="Body Size" value={Number(block?.props?.subheadlineFontSize || 20)} min={12} max={72} onChange={(value) => onChange(index, { ...block.props, subheadlineFontSize: value })} />
            </div>
          </div>
        ) : null}
        {Object.entries(block.props || {}).map(([key, value]) => {
          // Skip internal/layout-only fields and long text fields (shown at top)
          if (["id", "type", "fullWidthBackground", "minHeight", "parallaxStrength", "enableParallax", "contentX", "contentY", "contentWidth", "contentHeight", "verticalAlign", "headlineFontSize", "subheadlineFontSize", "textFontSize", "textSize", "floatingX", "floatingY", "floatingWidth", "floatingHeight", "floatingImage", "floatingAlt", "floatingImageAssetId", "backgroundImage", "backgroundImageAssetId", "backgroundStyle", "backgroundVideoUrl", "backgroundPosition", "backgroundRepeat", "backgroundSize", "contentBackground", "headlineTextStyle", "headlineOutlineColor", "headlineOutlineWidth", "headlineGradient", "headlineGlowColor", "headlineGlowBlur", "headlineShadowColor", "headlineShadowBlur", "headlineShadowOffsetX", "headlineShadowOffsetY", "sectionAnimation", "sectionAnimationDelay", "sectionAnimationSpeed", "textAnimation", "textAnimationDelay", "textAnimationSpeed", "subheadlineAnimation", "subheadlineAnimationDelay", "subheadlineAnimationSpeed", "contentOverlayAnimation", "contentOverlayAnimationDelay", "contentOverlayAnimationSpeed", "imageOverlayAnimation", "imageOverlayAnimationDelay", "imageOverlayAnimationSpeed", "ctaAnimation", "ctaAnimationDelay", "ctaAnimationSpeed", "extraCounterOverlays", "extraTextOverlays", "floatingImages", "heroStatItems", "heroHtmlEmbed", "heroCounter", "heroInlineCounter", "orbitCards", "baseLayoutWidth", "projectId", "spacingScale", "headlineAlignment", "heroVariant", "headlineFontFamily", "headlineFontWeight", "headlineLineHeight", "fontFamily", "fontWeight", "splitColorPreset", "headlineBlock", "bodyBlock", "faqBlock", "items", "logo", "assetId", "overlayImageAssetId", "overlayImage"].includes(key)) return null;
          if (isLongTextField(key)) return null;
          // Never render raw arrays or objects — they're managed by their dedicated panel sections
          if (Array.isArray(value) || (typeof value === "object" && value !== null)) return null;
          if (!shouldRenderHeroGenericField(key, value)) return null;
          if (block.type === BlockTypes.CTA_BUTTON && key === "link") {
            return (
              <div key={key} style={styles.propertyField}>
                <label style={styles.propertyLabel}>{formatLabel(key)}</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) =>
                    onChange(index, { ...block.props, [key]: e.target.value })
                  }
                  style={styles.propertyInput}
                />
              </div>
            );
          }
          if (isColorField(key)) {
            return (
              <ColorSelector
                key={key}
                label={formatLabel(key)}
                value={String(value || "")}
                fallback="#0f172a"
                allowTransparent={key.toLowerCase().includes("background")}
                onChange={(nextValue) => onChange(index, { ...block.props, [key]: nextValue })}
              />
            );
          }

          return (
            <div key={key} style={styles.propertyField}>
              <label style={styles.propertyLabel}>{formatLabel(key)}</label>
              {getSelectOptions(key) ? (
                <select
                  value={String(value || "")}
                  onChange={(e) => onChange(index, { ...block.props, [key]: e.target.value })}
                  style={styles.propertyInput}
                >
                  {getSelectOptions(key).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : typeof value === "boolean" ? (
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) =>
                    onChange(index, { ...block.props, [key]: e.target.checked })
                  }
                  style={styles.checkboxInput}
                />
              ) : typeof value === "number" ? (
                <input
                  type="number"
                  value={value}
                  onChange={(e) =>
                    onChange(index, {
                      ...block.props,
                      [key]: Number(e.target.value),
                    })
                  }
                  style={styles.propertyInput}
                />
              ) : (
                isLongTextField(key) ? (
                  <RichText
                    value={String(value || "")}
                    onChange={(nextHtml) =>
                      onChange(index, { ...block.props, [key]: nextHtml })
                    }
                    placeholder={`Write ${formatLabel(key).toLowerCase()}...`}
                  />
                ) : (
                  <input
                    type="text"
                    value={value}
                    onChange={(e) =>
                      onChange(index, { ...block.props, [key]: e.target.value })
                    }
                    style={styles.propertyInput}
                  />
                )
              )}
              {isImageField(key) ? (
                <div style={styles.assetPicker}>
                  <label style={styles.assetUploadCta}>
                    Upload From Computer
                    <input
                      type="file"
                      accept="image/*"
                      style={styles.hiddenInput}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        onUploadImage(index, key, file);
                      }}
                    />
                  </label>
                  {savedLogo ? (
                    <button
                      type="button"
                      style={styles.assetChip}
                      onClick={() => onSelectAsset(index, key, savedLogo)}
                    >
                      Use Logo
                    </button>
                  ) : null}
                  <button
                    type="button"
                    style={styles.assetLibraryBtn}
                    onClick={() => openAssetBrowser(key, `${formatLabel(key)} Library`)}
                  >
                    Open Media Library
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const renderBlockPreview = (block, assets, options = {}) => renderWebsiteBlock(block, { compact: false, assets, editor: true, ...options });


// ─── exports ──────────────────────────────────────────────────────────────────
export {
  CanvasBlockPreview, CanvasBlock, DropInsertZone, GlobalBlockPreview,
  ImageStackPropertiesPanel,
  getColumnEditorConfigs, ColumnsPropertiesPanel,
  normalizeGridSectionItems, renderGridFontIcon, resolveGridIconLibraryName, renderGridEditorIcon,
  GridIconLibraryModal,
  isBuiltinGridDecorationAsset, LIVE_SERVICES_GRID_PRESET,
  SERVICES_STYLE_OPTIONS, SERVICES_COLOR_OPTIONS, SERVICES_LAYOUT_OPTIONS,
  GridSectionPropertiesPanel,
  ContactFormPropertiesPanel,
  HoverCardsPropertiesPanel,
  PropertiesPanel,
  renderBlockPreview,
};
