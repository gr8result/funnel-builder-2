import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal, flushSync } from "react-dom";
import { applyAssetToProps, createStoredAsset, getAssetFromLibrary, normalizeSelectedAsset, resolveAssetField } from "../../lib/website-builder/mediaAssets";
import { saveWebsiteBuilderAssets } from "../../lib/website-builder/projectStore";
import { BlockTypes, BlockDefinitions } from "../../lib/website-builder/pageBlockComponents";
import { openSharedMediaPicker } from "../../lib/openSharedMediaPicker";
import { renderWebsiteBlock, websiteBlockKeyframes } from "./WebsiteBlockRenderer";
import { GRID_ICON_LIBRARY, renderGridLibraryIcon } from "./gridIconLibrary";
import RichText from "../RichText";
import {
  ImageEditModal,
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
  normalizeCustomStatsPreset, readCustomStatsPreset, writeCustomStatsPreset, matchesCustomStatsPreset,
  CUSTOM_STATS_PRESET_STORAGE_KEY, CUSTOM_STATS_PRESET_FIELDS,
} from "./page-builder/pbEditorUtils";
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
  PricingTablePropertiesPanel, FAQPropertiesPanel, SplitBlockPropertiesPanel,
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
} from "./page-builder/pbPropertiesPanels";
import { styles } from "./page-builder/pbStyles";
import {
  CanvasBlockPreview, CanvasBlock, DropInsertZone, GlobalBlockPreview,
  ImageStackPropertiesPanel,
  getColumnEditorConfigs, ColumnsPropertiesPanel,
  normalizeGridSectionItems, renderGridFontIcon, resolveGridIconLibraryName, renderGridEditorIcon,
  GridIconLibraryModal,
  isBuiltinGridDecorationAsset, LIVE_SERVICES_GRID_PRESET,
  SERVICES_STYLE_OPTIONS, SERVICES_COLOR_OPTIONS, SERVICES_LAYOUT_OPTIONS,
  GridSectionPropertiesPanel, ContactFormPropertiesPanel, PropertiesPanel,
  renderBlockPreview,
} from "./page-builder/pbCanvasComponents";

export default function PageBuilderCanvas({ project, brandAssets, pageBlocks = [], activePage = "", currentObjective = "", onSave, onForceSave, onUploadImage, onSelectAsset, onSaveAsGlobal, onSaveBlockDefault, onSaveTemplatePage, onSaveTemplateSite, onUpdateGlobalBlock, onRefreshAssetLibrary, onRegisterPreviewActions, blockDefaults = {}, showHeader = true }) {
  const [blocks, setBlocks] = useState(pageBlocks);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [selectedGlobalRole, setSelectedGlobalRole] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [draggedBlockIndex, setDraggedBlockIndex] = useState(null);
  const [isNarrowLayout, setIsNarrowLayout] = useState(false);
  const [showLibrary, setShowLibrary] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [rightPanelMode, setRightPanelMode] = useState("block");
  const [showCanvasGrid, setShowCanvasGrid] = useState(true);
  const [previewMode, setPreviewMode] = useState("desktop");
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [showTextToolbar, setShowTextToolbar] = useState(false);
  const [textToolbarState, setTextToolbarState] = useState({
    color: "#111827",
    highlight: "#ffffff",
    fontFamily: "Arial",
    fontSize: 18,
    lineHeight: 1.5,
    blockType: "P",
    canStyleBox: false,
    boxBackgroundColor: "transparent",
    boxBackgroundImage: "",
    boxWidth: 360,
    textAnimation: "none",
    textAnimationSpeed: 0.8,
    textAnimationDelay: 0,
    motionLabel: "Text Motion",
  });
  const [textToolbarPosition, setTextToolbarPosition] = useState({ x: 160, y: 120, width: 1120 });
  const [animationPopover, setAnimationPopover] = useState({ visible: false, index: null, x: 24, y: 120, width: 980 });
  const [animationReplayState, setAnimationReplayState] = useState({ index: null, tick: 0 });
  const [saveNotice, setSaveNotice] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [historyLen, setHistoryLen] = useState(0);
  const [futureLen, setFutureLen] = useState(0);
  const [imageEditState, setImageEditState] = useState(null);
  const activeEditableRef = useRef(null);
  const latestBlocksRef = useRef(Array.isArray(pageBlocks) ? pageBlocks : []);
  const selectionRangeRef = useRef(null);
  const textToolbarDraggedRef = useRef(false);
  const animationPopoverDraggedRef = useRef(false);
  const showTextToolbarRef = useRef(false);
  const saveNoticeTimerRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const skipNextAutosaveRef = useRef(true);
  const handleSaveRef = useRef(null);
  const pendingLocalBlocksRef = useRef(false);
  const onSaveRef = useRef(onSave);
  const onForceSaveRef = useRef(onForceSave);
  const prevOnSaveRef = useRef(null);
  const historyRef = useRef([]);
  const futureRef = useRef([]);
  const propEditSessionRef = useRef(false);
  const propEditTimerRef = useRef(null);
  const handleUndoRef = useRef(null);
  const handleRedoRef = useRef(null);
  const suppressBlurUpdateRef = useRef(false);
  const selectedIndexRef = useRef(null);
  const selectedGlobalRoleRef = useRef(null);
  const canvasMeasureRef = useRef(null);
  const blocksContainerRef = useRef(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const [blocksNaturalHeight, setBlocksNaturalHeight] = useState(0);

  const selectedBlock = typeof selectedIndex === "number" ? blocks[selectedIndex] || null : null;
  const selectedGlobalBlock = selectedGlobalRole === "nav"
    ? (project?.globalNavBlock || null)
    : selectedGlobalRole === "footer"
      ? (project?.globalFooterBlock || null)
      : null;
  const imageEditorUserId = project?.userId || project?.user_id || project?.ownerId || project?.owner_id || undefined;
  latestBlocksRef.current = blocks;
  selectedIndexRef.current = selectedIndex;
  selectedGlobalRoleRef.current = selectedGlobalRole;
  onSaveRef.current = onSave;
  onForceSaveRef.current = onForceSave;

  // Dev helper: allows external code (e.g. Playwright) to inject a block into the canvas
  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.__injectBlock = (index, blockData) => {
      const updated = [...latestBlocksRef.current];
      const safeIndex = Math.max(0, Math.min(index, updated.length));
      updated.splice(safeIndex, 0, blockData);
      pendingLocalBlocksRef.current = true;
      latestBlocksRef.current = updated;
      setBlocks(updated);
    };
    window.__deleteBlock = (index) => {
      const updated = latestBlocksRef.current.filter((_, i) => i !== index);
      pendingLocalBlocksRef.current = true;
      latestBlocksRef.current = updated;
      setBlocks(updated);
    };
    return () => { delete window.__injectBlock; delete window.__deleteBlock; };
  }, []);

  // When the user switches pages, flush any pending local edits to the page being left
  // BEFORE the canvas loads the new page's blocks. Without this, the autosave timer
  // fires after the page switch with the old blocks but the new activePage, silently
  // writing the wrong content to the wrong page.
  useEffect(() => {
    if (prevOnSaveRef.current !== null && pendingLocalBlocksRef.current) {
      // Cancel the pending autosave — we're flushing immediately instead
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      // Save the current blocks to the page we're navigating AWAY from
      const prevSave = prevOnSaveRef.current;
      Promise.resolve(prevSave(latestBlocksRef.current)).catch(() => {});
      pendingLocalBlocksRef.current = false;
    }
    // Capture the current onSave so the NEXT page switch can call it as "prev"
    prevOnSaveRef.current = onSaveRef.current;
  }, [activePage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const nextBlocks = Array.isArray(pageBlocks) ? pageBlocks : [];
    const localBlocks = latestBlocksRef.current;
    const blocksMatch = JSON.stringify(localBlocks) === JSON.stringify(nextBlocks);

    if (pendingLocalBlocksRef.current && !blocksMatch) {
      // Local edits are pending — keep the local version as source of truth.
      // Do not merge server blocks back in, as this would resurrect deleted blocks.
      return;
    }

    if (blocksMatch) {
      pendingLocalBlocksRef.current = false;
    }

    const previousSelectedIndex = selectedIndexRef.current;
    const previousSelectedGlobalRole = selectedGlobalRoleRef.current;
    const previousSelectedBlockId = Number.isInteger(previousSelectedIndex)
      ? localBlocks[previousSelectedIndex]?.id
      : null;

    latestBlocksRef.current = nextBlocks;
    setBlocks(nextBlocks);
    skipNextAutosaveRef.current = true;

    if (previousSelectedGlobalRole === "nav" && project?.globalNavBlock) {
      setSelectedGlobalRole("nav");
      setSelectedIndex(null);
    } else if (previousSelectedGlobalRole === "footer" && project?.globalFooterBlock) {
      setSelectedGlobalRole("footer");
      setSelectedIndex(null);
    } else if (previousSelectedBlockId != null) {
      const nextSelectedIndex = nextBlocks.findIndex((entry) => entry?.id === previousSelectedBlockId);
      setSelectedIndex(nextSelectedIndex >= 0 ? nextSelectedIndex : null);
      setSelectedGlobalRole(null);
    } else {
      setSelectedIndex(null);
      setSelectedGlobalRole(null);
    }

    setDropIndex(null);
  }, [pageBlocks, project?.globalFooterBlock, project?.globalNavBlock]);

  useEffect(() => {
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return undefined;
    }
    if (typeof onSaveRef.current !== "function") return undefined;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      // Use onSaveRef so the timer always calls the latest save function at fire-time
      Promise.resolve(onSaveRef.current(latestBlocksRef.current)).then((saved) => {
        if (saved) setLastSavedAt(Date.now());
      }).catch(() => {});
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [blocks]); // onSave intentionally omitted — always accessed via onSaveRef to avoid page-switch race

  // Flush any pending autosave edits to localStorage when the user navigates away.
  // This covers the 1500ms debounce window: if the user edits and closes the tab
  // before the debounce fires, their changes are still persisted locally.
  useEffect(() => {
    const handlePageHide = () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      if (typeof onSaveRef.current === "function") {
        onSaveRef.current(latestBlocksRef.current);
      }
      // Best-effort server sync: use force-save if available so the 5s throttle is bypassed.
      // The browser may not complete async work on pagehide, but desktop browsers typically do.
      if (typeof onForceSaveRef.current === "function") {
        Promise.resolve(onForceSaveRef.current(latestBlocksRef.current)).catch(() => {});
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []); // empty — all values accessed via refs

  useEffect(() => {
    if (selectedGlobalRole === "nav" && !project?.globalNavBlock) {
      setSelectedGlobalRole(null);
      return;
    }
    if (selectedGlobalRole === "footer" && !project?.globalFooterBlock) {
      setSelectedGlobalRole(null);
    }
  }, [project?.globalFooterBlock, project?.globalNavBlock, selectedGlobalRole]);

  useEffect(() => {
    showTextToolbarRef.current = showTextToolbar;
  }, [showTextToolbar]);

  const findEditable = (node) => {
    if (!(node instanceof Element)) return null;
    return node.closest?.('[contenteditable="true"], [data-inline-editor="true"], [data-layer-editor="true"], [data-website-inline-editor="true"]') || null;
  };

  const getTextToolbarDockPosition = () => {
    if (typeof window === "undefined") return { x: 24, y: 84, width: 720 };
    const viewportWidth = window.innerWidth || 1440;
    const toolbarWidth = Math.max(280, Math.min(viewportWidth - 24, 760));
    return {
      x: Math.max(12, viewportWidth - toolbarWidth - 12),
      y: 84,
      width: toolbarWidth,
    };
  };

  const syncToolbarForEditable = (editable, selection = typeof window !== "undefined" ? window.getSelection?.() : null, options = {}) => {
    if (!editable || typeof window === "undefined") return;

    activeEditableRef.current = editable;
    if (options?.reveal || showTextToolbarRef.current) {
      setShowTextToolbar(true);
    }

    const blockRoot = editable.closest?.("[data-canvas-block-index]");
    const blockIndex = Number(blockRoot?.getAttribute?.("data-canvas-block-index"));
    if (Number.isInteger(blockIndex)) {
      setSelectedGlobalRole(null);
      setSelectedIndex((prev) => (prev === blockIndex ? prev : blockIndex));
    }

    if (selection?.rangeCount) {
      const range = selection.getRangeAt(0).cloneRange();
      selectionRangeRef.current = range;
      if (!textToolbarDraggedRef.current && options?.reveal) {
        setTextToolbarPosition(getTextToolbarDockPosition());
      }
    }

    const styleSource = getSelectionStyleSource(editable, selection) || editable;
    const computed = window.getComputedStyle(styleSource);
    const backgroundTarget = getEditableBackgroundTarget(editable) || editable;
    const backgroundComputed = window.getComputedStyle(backgroundTarget);
    const tagName = String(editable.tagName || "P").toUpperCase();
    const fontFamilyRaw = String(computed.fontFamily || "Arial")
      .split(",")[0]
      .replace(/["']/g, "")
      .trim() || "Arial";
    const fontSizeValue = Math.max(12, Math.round(parseFloat(computed.fontSize || "18") || 18));
    const lineHeightValue = normalizeComputedLineHeight(computed.lineHeight, computed.fontSize, tagName === "P" ? 1.7 : 1.2);
    const currentBlock = Number.isInteger(blockIndex) ? blocks[blockIndex] || null : null;
    const layerIndex = Number.isInteger(currentBlock?.props?.selectedLayerIndex) ? currentBlock.props.selectedLayerIndex : null;
    const activeLayer = layerIndex != null && Array.isArray(currentBlock?.props?.images) ? currentBlock.props.images[layerIndex] : null;
    const motionBinding = getTextAnimationBinding(currentBlock, editable);
    setTextToolbarState({
      color: rgbToHex(computed.color, "#111827"),
      highlight: rgbToHex(computed.backgroundColor, "#ffffff"),
      fontFamily: fontFamilyRaw,
      fontSize: fontSizeValue,
      lineHeight: lineHeightValue,
      blockType: ["H1", "H2", "H3", "P"].includes(tagName) ? tagName : "P",
      canStyleBox: editable.hasAttribute?.("data-layer-editor"),
      boxBackgroundColor: normalizeToolbarBackgroundColor(backgroundComputed.backgroundColor),
      boxBackgroundImage: parseBackgroundImageUrl(backgroundComputed.backgroundImage),
      boxWidth: Number(activeLayer?.width || 360),
      textAnimation: motionBinding ? String(currentBlock?.props?.[motionBinding.animationKey] || "none") : "none",
      textAnimationSpeed: motionBinding ? Number(currentBlock?.props?.[motionBinding.speedKey] || 0.8) : 0.8,
      textAnimationDelay: motionBinding ? Number(currentBlock?.props?.[motionBinding.delayKey] || 0) : 0,
      motionLabel: motionBinding?.label || "Text Motion",
    });
  };

  const openTextEditorForBlock = (index, triggerNode) => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    selectCanvasBlock(index);
    setShowProperties(true);
    setRightPanelMode("block");
    setAnimationPopover((prev) => ({ ...prev, visible: false }));

    const blockRoot = triggerNode?.closest?.("[data-canvas-block-index]") || document.querySelector(`[data-canvas-block-index="${index}"]`);
    const editable = blockRoot?.querySelector?.('[data-website-inline-editor="true"], [contenteditable="true"], [data-layer-editor="true"]');
    if (!editable) return;

    editable.focus();
    const selection = window.getSelection?.();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(editable);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      selectionRangeRef.current = range.cloneRange();
    }
    textToolbarDraggedRef.current = false;
    syncToolbarForEditable(editable, window.getSelection?.(), { reveal: true });
  };

  const openAnimationPanelForBlock = (index, triggerNode) => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    const blockRoot = triggerNode?.closest?.("[data-canvas-block-index]") || document.querySelector(`[data-canvas-block-index="${index}"]`);
    const rect = blockRoot?.getBoundingClientRect?.();
    const panelWidth = Math.max(720, Math.min((window.innerWidth || 1440) - 48, 980));
    const nextX = rect
      ? Math.max(12, Math.min(rect.right - panelWidth, (window.innerWidth || 1280) - panelWidth - 12))
      : 24;
    const nextY = rect
      ? Math.max(12, Math.min(rect.top + 46, (window.innerHeight || 900) - 300))
      : 120;

    selectCanvasBlock(index);
    setShowProperties(true);
    setAnimationPopover({ visible: true, index, x: nextX, y: nextY, width: panelWidth });
  };

  useEffect(() => {
    if (!animationPopover.visible) return;
    if (!Number.isInteger(animationPopover.index) || !blocks[animationPopover.index]) {
      setAnimationPopover((prev) => ({ ...prev, visible: false }));
    }
  }, [animationPopover, blocks]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const computeIsNarrowLayout = () => {
      const viewportWidth = window.innerWidth || 1440;
      if (showLibrary && showProperties) return viewportWidth < 1000;
      if (showLibrary || showProperties) return viewportWidth < 820;
      return viewportWidth < 700;
    };

    const onResize = () => setIsNarrowLayout(computeIsNarrowLayout());
    onResize();
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [showLibrary, showProperties]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return undefined;

    const syncTextToolbar = () => {
      if (!showTextToolbarRef.current) return;

      const selection = window.getSelection?.();
      const activeElement = document.activeElement;
      const selectionNode = selection?.anchorNode;
      const selectionElement = selectionNode?.nodeType === 3 ? selectionNode.parentElement : selectionNode;
      const editable = findEditable(activeElement) || findEditable(selectionElement);
      const inToolbar = activeElement?.closest?.('[data-text-toolbar="true"]');

      if (!editable) {
        if (inToolbar && activeEditableRef.current) {
          setShowTextToolbar(true);
        }
        return;
      }

      syncToolbarForEditable(editable, selection, { reveal: false });
    };

    const handleEditableClick = (event) => {
      const editable = findEditable(event.target);
      if (!editable) return;
      // Only reset the drag flag when the toolbar is first being revealed (not already visible).
      // If the toolbar is already showing and the user just clicks into a different word/element,
      // keep the toolbar where they dragged it.
      if (!showTextToolbarRef.current) {
        textToolbarDraggedRef.current = false;
      }
      syncToolbarForEditable(editable, window.getSelection?.(), { reveal: true });
    };

    const handleOutside = (event) => {
      const inEditable = findEditable(event.target);
      const inToolbar = event.target?.closest?.('[data-text-toolbar="true"]');
      const inAnimationPopover = event.target?.closest?.('[data-animation-popover="true"]');
      const inSidePanel = event.target?.closest?.('[data-builder-sidepanel="true"]');
      if (inEditable) {
        // Switching from one inline editable to another — save current state
        // BEFORE the browser fires blur on the outgoing editable.
        const pendingEditable = activeEditableRef.current;
        if (pendingEditable && pendingEditable !== inEditable) {
          cleanupEditableMarkup();
          syncActiveEditableToBlock(latestBlocksRef.current);
          // Only suppress the blur-triggered handleUpdateBlock when syncActiveEditableToBlock
          // already saved this editable's content (i.e. it has data-text-prop). Blocks that
          // use onBlur to commit their content (e.g. FeatureAccordionBlock) don't have
          // data-text-prop, so their blur update must NOT be suppressed.
          suppressBlurUpdateRef.current = !!pendingEditable.getAttribute?.("data-text-prop");
          // The native blur fires synchronously during focus transfer; reset after.
          if (typeof window !== "undefined") {
            window.requestAnimationFrame(() => { suppressBlurUpdateRef.current = false; });
          } else {
            suppressBlurUpdateRef.current = false;
          }
        }
        if (showTextToolbarRef.current) {
          syncToolbarForEditable(inEditable, window.getSelection?.(), { reveal: false });
        }
        return;
      }
      if (inSidePanel) {
        return;
      }
      if (!inToolbar && !inAnimationPopover) {
        const pendingEditable = activeEditableRef.current;
        if (pendingEditable && typeof pendingEditable.blur === "function") {
          cleanupEditableMarkup();
          syncActiveEditableToBlock(latestBlocksRef.current);
          // Only suppress the blur-triggered handleUpdateBlock when syncActiveEditableToBlock
          // already saved this editable's content. Blocks without data-text-prop use onBlur
          // as their only save mechanism, so we must not suppress it.
          suppressBlurUpdateRef.current = !!pendingEditable.getAttribute?.("data-text-prop");
          pendingEditable.blur();
          suppressBlurUpdateRef.current = false;
        } else {
          syncActiveEditableToBlock(latestBlocksRef.current);
        }

        if (typeof window !== "undefined") {
          window.requestAnimationFrame(() => {
            activeEditableRef.current = null;
            selectionRangeRef.current = null;
            textToolbarDraggedRef.current = false;
            setShowTextToolbar(false);
            setAnimationPopover((prev) => ({ ...prev, visible: false }));
          });
        } else {
          activeEditableRef.current = null;
          selectionRangeRef.current = null;
          textToolbarDraggedRef.current = false;
          setShowTextToolbar(false);
          setAnimationPopover((prev) => ({ ...prev, visible: false }));
        }
      }
    };

    // Intercept Enter key inside any inline-editable element.
    // Default browser behavior creates a new block element (<div> or <p>) that has no
    // inline style spans, causing the toolbar to jump to the block's CSS base font-size
    // and wrecking the formatting. Instead, insert a <br> (line break) which stays within
    // the same element structure and preserves all surrounding span styles.
    const handleEditableKeyDown = (event) => {
      if (event.key !== "Enter") return;
      const editable = findEditable(document.activeElement);
      if (!editable) return;
      event.preventDefault();
      try {
        // insertLineBreak creates a <br> without a new block — formatting is preserved.
        document.execCommand("insertLineBreak");
      } catch {}
      // selectionchange + keyup events (already registered) will sync the toolbar.
    };

    document.addEventListener("selectionchange", syncTextToolbar);
    document.addEventListener("mouseup", syncTextToolbar, true);
    document.addEventListener("keyup", syncTextToolbar, true);
    document.addEventListener("keydown", handleEditableKeyDown, true);
    document.addEventListener("click", handleEditableClick, true);
    document.addEventListener("dblclick", handleEditableClick, true);
    document.addEventListener("pointerdown", handleOutside, true);

    return () => {
      document.removeEventListener("selectionchange", syncTextToolbar);
      document.removeEventListener("mouseup", syncTextToolbar, true);
      document.removeEventListener("keyup", syncTextToolbar, true);
      document.removeEventListener("keydown", handleEditableKeyDown, true);
      document.removeEventListener("click", handleEditableClick, true);
      document.removeEventListener("dblclick", handleEditableClick, true);
      document.removeEventListener("pointerdown", handleOutside, true);
    };
  }, []);

  // Delete selected block with Delete/Backspace key (only when not editing text)
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleKeyDelete = (event) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const activeEl = document.activeElement;
      if (!activeEl) return;
      // Skip standard form controls
      const tag = activeEl.tagName?.toLowerCase?.();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      // Skip if the focused element is or is inside a contentEditable
      if (activeEl.isContentEditable) return;
      if (activeEl.closest?.('[contenteditable="true"]')) return;
      // Skip if there is any non-collapsed text selection — user is editing/deleting text
      const sel = typeof window !== "undefined" ? window.getSelection?.() : null;
      if (sel && !sel.isCollapsed) return;
      // Also walk up the selection anchor to catch focus inside contentEditable that didn't update activeElement
      if (sel?.anchorNode) {
        let node = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
        while (node) {
          if (node.isContentEditable || node.getAttribute?.("contenteditable") === "true") return;
          node = node.parentElement;
        }
      }
      const idx = selectedIndexRef.current;
      if (idx == null || !Number.isInteger(idx)) return;
      event.preventDefault();
      handleDelete(idx);
    };
    document.addEventListener("keydown", handleKeyDelete);
    return () => document.removeEventListener("keydown", handleKeyDelete);
  }, []);

  // Ctrl+S / Cmd+S → manual save
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleCtrlS = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        handleSaveRef.current?.();
      }
    };
    document.addEventListener("keydown", handleCtrlS);
    return () => document.removeEventListener("keydown", handleCtrlS);
  }, []);

  // Ctrl+Z (undo) / Ctrl+Y or Ctrl+Shift+Z (redo)
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleUndoRedo = (event) => {
      const isUndo = (event.ctrlKey || event.metaKey) && event.key === "z" && !event.shiftKey;
      const isRedo = (event.ctrlKey || event.metaKey) && (event.key === "y" || (event.key === "z" && event.shiftKey));
      if (!isUndo && !isRedo) return;
      // Don't intercept while editing text inline
      const activeEl = document.activeElement;
      if (activeEl?.isContentEditable) return;
      if (activeEl?.closest?.('[contenteditable="true"]')) return;
      const tag = activeEl?.tagName?.toLowerCase?.();
      if (tag === "input" || tag === "textarea") return;
      event.preventDefault();
      if (isUndo) handleUndoRef.current?.();
      else handleRedoRef.current?.();
    };
    document.addEventListener("keydown", handleUndoRedo);
    return () => document.removeEventListener("keydown", handleUndoRedo);
  }, []);

  const pushHistory = (snapshot) => {
    const h = historyRef.current;
    h.push(snapshot);
    if (h.length > 50) h.shift();
    futureRef.current = [];
    setHistoryLen(h.length);
    setFutureLen(0);
  };

  const handleUndo = () => {
    const h = historyRef.current;
    if (h.length === 0) return;
    const prev = h.pop();
    futureRef.current.push(latestBlocksRef.current.slice());
    pendingLocalBlocksRef.current = true;
    latestBlocksRef.current = prev;
    setBlocks(prev);
    setHistoryLen(h.length);
    setFutureLen(futureRef.current.length);
  };
  handleUndoRef.current = handleUndo;

  const handleRedo = () => {
    const f = futureRef.current;
    if (f.length === 0) return;
    const next = f.pop();
    historyRef.current.push(latestBlocksRef.current.slice());
    pendingLocalBlocksRef.current = true;
    latestBlocksRef.current = next;
    setBlocks(next);
    setHistoryLen(historyRef.current.length);
    setFutureLen(f.length);
  };
  handleRedoRef.current = handleRedo;

  const workspaceColumns = useMemo(() => {
    if (isNarrowLayout) return "1fr";
    const columns = [];
    if (showLibrary) columns.push("248px");
    columns.push("minmax(0, 1.85fr)");
    if (showProperties) columns.push("minmax(220px, 280px)");
    return columns.join(" ");
  }, [isNarrowLayout, showLibrary, showProperties]);

  const workspaceRows = useMemo(() => {
    if (!isNarrowLayout) return undefined;
    const libRow = showLibrary ? "minmax(180px, auto)" : "0px";
    const propRow = showProperties ? "minmax(260px, auto)" : "0px";
    return `${libRow} minmax(60px, 1fr) ${propRow}`;
  }, [isNarrowLayout, showLibrary, showProperties]);

  const handleDragStart = (e, blockType) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("newBlockType", blockType);
  };

  const createNewBlock = (blockType) => {
    const currentWidth = Math.max(720, Number(pickGlobalStyleValue(blocks, ["baseLayoutWidth"], 1500)) || 1500);
    const extraProps = blockType === "icon-counter" ? { projectId: project?.id || "" } : {};
    return {
      id: Date.now() + Math.floor(Math.random() * 1000),
      type: blockType,
      props: { ...BlockDefinitions[blockType].defaultProps, ...(blockDefaults?.[blockType] || {}), baseLayoutWidth: currentWidth, ...extraProps },
    };
  };

  const handleInsertAt = (insertIndex, dataTransfer) => {
    const safeIndex = Math.max(0, Math.min(insertIndex, blocks.length));
    const newBlockType = dataTransfer.getData("newBlockType");

    if (newBlockType && BlockDefinitions[newBlockType]) {
      const newBlock = createNewBlock(newBlockType);
      const updated = [...blocks];
      updated.splice(safeIndex, 0, newBlock);
      pushHistory(latestBlocksRef.current.slice());
      pendingLocalBlocksRef.current = true;
      latestBlocksRef.current = updated;
      setBlocks(updated);
      selectCanvasBlock(safeIndex);
      return;
    }
  };

  const handleCanvasDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (dropIndex !== blocks.length) setDropIndex(blocks.length);
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    handleInsertAt(blocks.length, e.dataTransfer);
    setDropIndex(null);
  };

  const getInsertIndexFromPointer = (event, blockIndex) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    return offsetY < rect.height / 2 ? blockIndex : blockIndex + 1;
  };

  const handleBlockDragStart = (index) => {
    setDraggedBlockIndex(index);
    setDropIndex(null);
  };

  const handleBlockDragEnd = () => {
    setDraggedBlockIndex(null);
  };

  const handleColumnSlotDrop = (sourceBlockIndex, targetColumnsBlockIndex, slotKey) => {
    const sourceBlock = latestBlocksRef.current[sourceBlockIndex];
    if (!sourceBlock) return;
    // Remove source block from list
    const without = latestBlocksRef.current.filter((_, i) => i !== sourceBlockIndex);
    // Adjust target index after removal
    const adjustedTarget = sourceBlockIndex < targetColumnsBlockIndex ? targetColumnsBlockIndex - 1 : targetColumnsBlockIndex;
    const targetBlock = without[adjustedTarget];
    if (!targetBlock || (targetBlock.type !== "columns-2" && targetBlock.type !== "columns-3")) return;
    const ctKey = slotKey.replace("Block", "ContentType"); // e.g. rightColumnBlock → rightColumnContentType
    const updated = without.map((b, i) => {
      if (i !== adjustedTarget) return b;
      return {
        ...b,
        props: {
          ...b.props,
          [slotKey]: { type: sourceBlock.type, id: sourceBlock.id, props: sourceBlock.props },
          [ctKey]: "block",
        },
      };
    });
    pushHistory(latestBlocksRef.current.slice());
    pendingLocalBlocksRef.current = true;
    latestBlocksRef.current = updated;
    setBlocks(updated);
    selectCanvasBlock(adjustedTarget);
    setDraggedBlockIndex(null);
  };

  const handleBlockDragOver = (event, blockIndex) => {
    event.preventDefault();
    event.stopPropagation();
    const nextDropIndex = getInsertIndexFromPointer(event, blockIndex);
    event.dataTransfer.dropEffect = "copy";
    if (dropIndex !== nextDropIndex) setDropIndex(nextDropIndex);
  };

  const handleBlockDrop = (event, blockIndex) => {
    event.preventDefault();
    event.stopPropagation();
    handleInsertAt(getInsertIndexFromPointer(event, blockIndex), event.dataTransfer);
    setDropIndex(null);
  };

  const handleDelete = (index) => {
    const updated = blocks.filter((_, i) => i !== index);
    pushHistory(latestBlocksRef.current.slice());
    pendingLocalBlocksRef.current = true;
    latestBlocksRef.current = updated;
    setBlocks(updated);
    setSelectedIndex(null);
    setSelectedGlobalRole(null);
  };

  const selectCanvasBlock = (index) => {
    setSelectedGlobalRole(null);
    setSelectedIndex(index);
  };

  const clearCanvasSelection = () => {
    setSelectedIndex(null);
    setSelectedGlobalRole(null);
    setHoveredIndex(null);
  };

  const selectGlobalBlock = (role) => {
    setSelectedIndex(null);
    setShowProperties(true);
    setRightPanelMode("block");
    setSelectedGlobalRole(role);
  };

  const handleDuplicate = (index) => {
    const block = blocks[index];
    const copy = {
      ...block,
      id: Date.now(),
    };
    const updated = [...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)];
    pushHistory(latestBlocksRef.current.slice());
    pendingLocalBlocksRef.current = true;
    latestBlocksRef.current = updated;
    setBlocks(updated);
    selectCanvasBlock(index + 1);
  };

  const moveBlockByStep = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;
    const updated = [...blocks];
    const [moved] = updated.splice(index, 1);
    updated.splice(nextIndex, 0, moved);
    pushHistory(latestBlocksRef.current.slice());
    pendingLocalBlocksRef.current = true;
    latestBlocksRef.current = updated;
    setBlocks(updated);
    selectCanvasBlock(nextIndex);
  };

  const moveBlockToTop = (index) => {
    if (index <= 0 || index >= blocks.length) return;
    const updated = [...blocks];
    const [moved] = updated.splice(index, 1);
    updated.unshift(moved);
    pushHistory(latestBlocksRef.current.slice());
    pendingLocalBlocksRef.current = true;
    latestBlocksRef.current = updated;
    setBlocks(updated);
    selectCanvasBlock(0);
  };

  const handleUpdateBlock = (index, newProps) => {
    if (suppressBlurUpdateRef.current) return;
    // Push history once at the START of a prop-editing session (debounced)
    if (!propEditSessionRef.current) {
      pushHistory(latestBlocksRef.current.slice());
      propEditSessionRef.current = true;
    }
    if (propEditTimerRef.current) clearTimeout(propEditTimerRef.current);
    propEditTimerRef.current = setTimeout(() => { propEditSessionRef.current = false; }, 1200);
    const updated = [...blocks];
    updated[index] = { ...blocks[index], props: newProps };
    pendingLocalBlocksRef.current = true;
    latestBlocksRef.current = updated;
    setBlocks(updated);
  };

  const handleResizeBlockHeight = (index, nextHeight) => {
    const target = blocks[index];
    if (!target) return;
    handleUpdateBlock(index, {
      ...(target.props || {}),
      minHeight: `${Math.max(160, Number(nextHeight) || 160)}px`,
    });
  };

  const applyAssetToCanvasBlock = (index, key, asset) => {
    const normalizedAsset = normalizeSelectedAsset(asset);
    if (!normalizedAsset?.src || typeof index !== "number") return null;
    const updated = [...blocks];
    const target = updated[index];
    if (!target) return null;

    const nextProps = applyAssetToProps(target.props || {}, key, normalizedAsset);
    nextProps[key] = normalizedAsset.src || "";

    updated[index] = {
      ...target,
      props: nextProps,
    };

    pendingLocalBlocksRef.current = true;
    latestBlocksRef.current = updated;
    setBlocks(updated);
    return updated;
  };

  const handleCanvasAssetSelect = (index, key, asset) => {
    const normalizedAsset = normalizeSelectedAsset(asset);
    const updated = applyAssetToCanvasBlock(index, key, normalizedAsset);
    if (!updated) return;
    onSelectAsset?.(index, key, normalizedAsset, updated);
  };

  const handleGlobalAssetSelect = (role, key, asset) => {
    const normalizedAsset = normalizeSelectedAsset(asset);
    if (!normalizedAsset?.src) return;
    const block = role === "nav" ? project?.globalNavBlock : project?.globalFooterBlock;
    if (!block) return;

    const nextProps = applyAssetToProps(block.props || {}, key, normalizedAsset);
    nextProps[key] = normalizedAsset.src || "";
    onUpdateGlobalBlock?.(role, {
      ...block,
      props: nextProps,
    });
  };

  const handleCanvasImageUpload = async (index, key, file) => {
    const asset = await Promise.resolve(onUploadImage?.(index, key, file));
    if (!asset?.src) return asset;
    if (String(key || "").startsWith("__")) {
      return asset;
    }
    applyAssetToCanvasBlock(index, key, asset);
    return asset;
  };

  const handleGlobalImageUpload = async (role, key, file) => {
    const asset = await Promise.resolve(onUploadImage?.(-1, key, file));
    if (!asset?.src) return asset;
    handleGlobalAssetSelect(role, key, asset);
    return asset;
  };

  const openStructuredImageEditor = (blockIndex, collectionKey, itemIndex, imageKey, src) => {
    const cleanSrc = String(src || "").trim();
    if (!cleanSrc) return;
    setImageEditState({ blockIndex, collectionKey, itemIndex, imageKey, src: cleanSrc });
  };

  const openSimpleImageEditor = (blockIndex, propKey, src) => {
    const cleanSrc = String(src || "").trim();
    if (!cleanSrc) return;
    setImageEditState({ blockIndex, propKey, src: cleanSrc });
  };

  const applyEditedStructuredImage = (nextSrc) => {
    const state = imageEditState;
    setImageEditState(null);
    if (!nextSrc || typeof state?.blockIndex !== "number") return;

    // Simple top-level prop (e.g. IMAGE block's src field)
    if (state.propKey && !state.collectionKey) {
      const updated = latestBlocksRef.current.map((block, blockIndex) => {
        if (blockIndex !== state.blockIndex) return block;
        return {
          ...block,
          props: {
            ...(block?.props || {}),
            [state.propKey]: nextSrc,
            [`${state.propKey}AssetId`]: "",
          },
        };
      });
      latestBlocksRef.current = updated;
      setBlocks(updated);
      onSave?.(updated);
      return;
    }

    if (!state?.collectionKey || typeof state.itemIndex !== "number" || !state.imageKey) return;

    const updated = latestBlocksRef.current.map((block, blockIndex) => {
      if (blockIndex !== state.blockIndex) return block;
      const currentCollection = Array.isArray(block?.props?.[state.collectionKey]) ? block.props[state.collectionKey] : [];
      const nextCollection = currentCollection.map((entry, entryIndex) => (
        entryIndex === state.itemIndex
          ? { ...(entry || {}), [state.imageKey]: nextSrc, [`${state.imageKey}AssetId`]: "" }
          : entry
      ));

      return {
        ...block,
        props: {
          ...(block?.props || {}),
          [state.collectionKey]: nextCollection,
        },
      };
    });

    latestBlocksRef.current = updated;
    setBlocks(updated);
    onSave?.(updated);
  };

  const handleLayerImageUpload = async (blockIndex, layerIndex, file) => {
    const asset = await Promise.resolve(onUploadImage?.(blockIndex, "__image_stack_layer__", file));
    if (!asset?.src) return asset;

    const updated = [...latestBlocksRef.current];
    const target = updated[blockIndex];
    if (!target) return asset;

    const currentLayers = Array.isArray(target?.props?.images) ? target.props.images : [];
    const nextLayers = currentLayers.map((layer, currentIndex) => (
      currentIndex === layerIndex
        ? {
            ...layer,
            kind: "image",
            src: asset.src || layer?.src || "",
            assetId: asset.id || "",
          }
        : layer
    ));

    if (layerIndex >= 0 && layerIndex < nextLayers.length) {
      const [promotedLayer] = nextLayers.splice(layerIndex, 1);
      nextLayers.push(promotedLayer);
    }

    updated[blockIndex] = {
      ...target,
      props: {
        ...(target.props || {}),
        images: nextLayers,
        selectedLayerIndex: nextLayers.length ? nextLayers.length - 1 : null,
      },
    };

    pendingLocalBlocksRef.current = true;
    latestBlocksRef.current = updated;
    setBlocks(updated);
    onSave?.(updated);
    return asset;
  };

  const toggleSelectedProp = (key) => {
    if (typeof selectedIndex !== "number" || !blocks[selectedIndex]) return;
    const current = key === "fullWidthBackground"
      ? isFullWidthBackgroundEnabled(blocks[selectedIndex])
      : !!blocks[selectedIndex]?.props?.[key];
    handleUpdateBlock(selectedIndex, {
      ...(blocks[selectedIndex]?.props || {}),
      [key]: !current,
    });
  };

  const handleToolbarParallax = () => {
    if (selectedBlock && [BlockTypes.TEXT, BlockTypes.PARALLAX, BlockTypes.HERO, BlockTypes.SPLIT_BLOCK].includes(selectedBlock.type)) {
      const current = !!selectedBlock?.props?.enableParallax;
      const nextEnabled = !current;
      handleUpdateBlock(selectedIndex, {
        ...(selectedBlock?.props || {}),
        enableParallax: nextEnabled,
        ...(nextEnabled ? {
          backgroundStyle: selectedBlock?.props?.backgroundStyle || "image",
          backgroundImage: selectedBlock?.props?.backgroundImage || "https://placehold.co/1600x900/0f172a/1e293b?text=%20",
        } : {}),
      });
      return;
    }

    insertPresetBlock(BlockTypes.PARALLAX, {
      headline: "Parallax Section",
      subheadline: "Add a moving background section and customize it from the toolbar.",
      backgroundStyle: "image",
      backgroundImage: "https://placehold.co/1600x900/0f172a/1e293b?text=%20",
      enableParallax: true,
      minHeight: "480px",
    });
  };

  const insertPresetBlock = (blockType, patch = {}) => {
    if (!BlockDefinitions[blockType]) return;
    const newBlock = createNewBlock(blockType);
    newBlock.props = { ...newBlock.props, ...patch };
    const insertAt = typeof selectedIndex === "number" ? selectedIndex + 1 : blocks.length;
    const updated = [...blocks];
    updated.splice(insertAt, 0, newBlock);
    pushHistory(latestBlocksRef.current.slice());
    pendingLocalBlocksRef.current = true;
    latestBlocksRef.current = updated;
    setBlocks(updated);
    setSelectedIndex(insertAt);
  };

  const previewWidth = previewMode === "mobile" ? 430 : previewMode === "tablet" ? 920 : "100%";
  const pageCanvasWidth = Math.max(720, Number(pickGlobalStyleValue(blocks, ["baseLayoutWidth"], 1500)) || 1500);
  const pageCanvasBackground = pickGlobalStyleValue(blocks, ["pageBackground"], "#ffffff");

  // Auto-scale canvas to fit the panel width
  useEffect(() => {
    const el = canvasMeasureRef.current;
    if (!el) return undefined;
    let raf = null;
    const compute = (w) => {
      if (previewMode === "desktop" && w > 0 && pageCanvasWidth > 0) {
        const next = Math.max(0.2, w / pageCanvasWidth);
        setCanvasScale((prev) => (Math.abs(prev - next) > 0.002 ? next : prev));
      } else {
        setCanvasScale(1);
      }
    };
    const observer = new ResizeObserver((entries) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        for (const entry of entries) compute(Math.round(entry.contentRect.width));
      });
    });
    observer.observe(el);
    compute(el.clientWidth);
    return () => { observer.disconnect(); cancelAnimationFrame(raf); };
  }, [pageCanvasWidth, previewMode]);

  // Measure natural (un-scaled) height so the wrapper can collapse the
  // whitespace that transform:scale() leaves behind.
  useEffect(() => {
    const el = blocksContainerRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setBlocksNaturalHeight(Math.round(entry.contentRect.height));
    });
    observer.observe(el);
    setBlocksNaturalHeight(Math.round(el.offsetHeight));
    return () => observer.disconnect();
  }, []);

  const canvasBlockEntries = useMemo(() => {
    const hasGlobalNav = !!project?.globalNavBlock;
    const hasGlobalFooter = !!project?.globalFooterBlock;

    return blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => {
        if (hasGlobalNav && block?.type === BlockTypes.NAV_BAR) return false;
        if (hasGlobalFooter && block?.type === BlockTypes.FOOTER) return false;
        return true;
      });
  }, [blocks, project?.globalFooterBlock, project?.globalNavBlock]);

  const applyGlobalStyles = (patch = {}) => {
    setBlocks((prev) => prev.map((block) => {
      const props = { ...(block?.props || {}) };

      if (Object.prototype.hasOwnProperty.call(patch, "pageBackground")) {
        props.pageBackground = String(patch.pageBackground || "");
      }

      if (patch.headingFontFamily) {
        props.headlineFontFamily = patch.headingFontFamily;
        props.headingFontFamily = patch.headingFontFamily;
      }

      if (patch.textAlign) {
        props.headlineAlignment = patch.textAlign;
      }

      if (patch.bodyFontFamily) {
        props.fontFamily = patch.bodyFontFamily;
        props.bodyFontFamily = patch.bodyFontFamily;
      }

      if (Number.isFinite(Number(patch.headingSize)) && Number(patch.headingSize) > 0) {
        if ([BlockTypes.HERO, BlockTypes.PARALLAX].includes(block.type)) {
          props.headlineFontSize = Number(patch.headingSize);
        }
      }

      if (Number.isFinite(Number(patch.bodySize)) && Number(patch.bodySize) > 0) {
        const nextBodySize = Number(patch.bodySize);
        if ([BlockTypes.HERO, BlockTypes.PARALLAX].includes(block.type)) {
          props.subheadlineFontSize = nextBodySize;
        }
        if (block.type === BlockTypes.TEXT) {
          props.textFontSize = nextBodySize;
        }
        if (block.type === BlockTypes.NAV_BAR) {
          props.brandFontSize = Math.max(16, nextBodySize);
          props.linkFontSize = Math.max(14, nextBodySize);
          props.ctaFontSize = Math.max(14, nextBodySize);
        }
      }

      if (patch.primaryColor) {
        props.buttonColor = patch.primaryColor;
        if (block.type === BlockTypes.NAV_BAR) {
          props.activeLinkBackgroundColor = patch.primaryColor;
        }
      }

      if (patch.cardBackgroundColor) {
        props.cardBackgroundColor = patch.cardBackgroundColor;
        props.itemBackgroundColor = patch.cardBackgroundColor;
      }

      if (patch.headingColor) {
        if ([BlockTypes.HERO, BlockTypes.PARALLAX].includes(block.type)) {
          props.headlineColor = patch.headingColor;
        }
      }

      if (patch.bodyColor) {
        props.textColor = patch.bodyColor;
        if (block.type === BlockTypes.NAV_BAR) {
          props.textColor = patch.bodyColor;
          props.activeLinkTextColor = patch.bodyColor;
        }
      }

      if (patch.sectionBackground && block.type !== BlockTypes.NAV_BAR) {
        props.backgroundColor = patch.sectionBackground;
      }

      if (patch.layoutMode) {
        props.fullWidthBackground = patch.layoutMode === "full";
      }

      if (Number.isFinite(Number(patch.pageWidth)) && Number(patch.pageWidth) > 0) {
        props.baseLayoutWidth = Number(patch.pageWidth);
      }

      if (Number.isFinite(Number(patch.buttonRadius)) && Number(patch.buttonRadius) >= 0) {
        props.buttonRadius = Number(patch.buttonRadius);
      }

      if (patch.buttonTextColor) {
        props.buttonTextColor = patch.buttonTextColor;
      }

      return { ...block, props };
    }));
  };

  const applyInlinePropPatch = (props, propPath, rawHtml) => {
    const path = String(propPath || "").split(".").filter(Boolean);
    if (!path.length) return { ...(props || {}) };

    const nextProps = { ...(props || {}) };
    const nextValue = stripEditorArtifacts(rawHtml);

    const assignPath = (target, segments, value) => {
      const [head, ...rest] = segments;
      if (!head) return target;

      if (!rest.length) {
        if (Array.isArray(target)) {
          const index = Number(head);
          if (!Number.isInteger(index)) return target;
          const next = [...target];
          next[index] = value;
          return next;
        }
        // If the target slot is a plain string and we're setting "text", upgrade it to an object
        if (head === "text" && (typeof target === "string" || target === undefined || target === null)) {
          return value;
        }
        return { ...(typeof target === "object" && target !== null ? target : {}), [head]: value };
      }

      if (Array.isArray(target)) {
        const index = Number(head);
        if (!Number.isInteger(index)) return target;
        const next = [...target];
        const existing = next[index] ?? (Number.isInteger(Number(rest[0])) ? [] : {});
        next[index] = assignPath(existing, rest, value);
        return next;
      }

      const existing = target?.[head] ?? (Number.isInteger(Number(rest[0])) ? [] : {});
      return {
        ...(target || {}),
        [head]: assignPath(existing, rest, value),
      };
    };

    const patched = assignPath(nextProps, path, nextValue);

    if (path[0] === "items" && path[2] === "question") {
      return assignPath(patched, [path[0], path[1], "heading"], nextValue);
    }

    if (path[0] === "items" && path[2] === "answer") {
      return assignPath(patched, [path[0], path[1], "content"], nextValue);
    }

    if (path[0] === "faqBlock" && path[1] === "items" && path[3] === "question") {
      return assignPath(patched, [path[0], path[1], path[2], "heading"], nextValue);
    }

    if (path[0] === "faqBlock" && path[1] === "items" && path[3] === "answer") {
      return assignPath(patched, [path[0], path[1], path[2], "content"], nextValue);
    }

    return patched;
  };

  const serializeCanvasInlineEditors = (sourceBlocks = latestBlocksRef.current) => {
    if (typeof document === "undefined" || !Array.isArray(sourceBlocks)) return sourceBlocks;

    const nodes = Array.from(document.querySelectorAll('[data-builder-canvas="true"] [data-canvas-block-index] [data-website-inline-editor="true"][data-text-prop]'));
    if (!nodes.length) return sourceBlocks;

    const updated = [...sourceBlocks];

    nodes.forEach((node) => {
      const blockRoot = node.closest?.("[data-canvas-block-index]");
      const blockIndex = Number(blockRoot?.getAttribute?.("data-canvas-block-index"));
      const propPath = node.getAttribute?.("data-text-prop");

      if (!Number.isInteger(blockIndex) || !propPath || !updated[blockIndex]) return;

      updated[blockIndex] = {
        ...updated[blockIndex],
        props: applyInlinePropPatch(updated[blockIndex]?.props || {}, propPath, stripEditorArtifacts(node.innerHTML)),
      };
    });

    latestBlocksRef.current = updated;
    setBlocks(updated);
    return updated;
  };

  const syncActiveEditableToBlock = (sourceBlocks = blocks) => {
    const editable = activeEditableRef.current;
    if (!editable || typeof selectedIndex !== "number" || !Array.isArray(sourceBlocks) || !sourceBlocks[selectedIndex]) {
      return sourceBlocks;
    }

    const nextHtml = stripEditorArtifacts(editable.innerHTML);
    const updated = [...sourceBlocks];
    const currentBlock = updated[selectedIndex];

    // For image-stack layers we still need background geometry — read from the
    // layer container (not the text node) so we only get layout, not typography.
    if (editable.hasAttribute?.("data-layer-editor") && currentBlock?.type === BlockTypes.IMAGE_STACK) {
      const layerIndex = Number.isInteger(currentBlock?.props?.selectedLayerIndex)
        ? currentBlock.props.selectedLayerIndex
        : null;

      if (layerIndex == null || !Array.isArray(currentBlock?.props?.images)) {
        return sourceBlocks;
      }

      const backgroundTarget = getEditableBackgroundTarget(editable) || editable;
      const backgroundComputed = typeof window !== "undefined" ? window.getComputedStyle(backgroundTarget) : null;
      const boxBackgroundColor = normalizeToolbarBackgroundColor(backgroundComputed?.backgroundColor);
      const boxBackgroundImage = parseBackgroundImageUrl(backgroundComputed?.backgroundImage);

      // Read typography from the selection cursor position, not the outer container,
      // so we don't accidentally inherit a parent default (e.g. 16px) and overwrite
      // an intentional per-span size.
      const styleSource = getSelectionStyleSource(editable, typeof window !== "undefined" ? window.getSelection?.() : null) || editable;
      const computed = typeof window !== "undefined" ? window.getComputedStyle(styleSource) : null;
      const fontSize = Math.max(12, Math.round(parseFloat(computed?.fontSize || "18") || 18));
      const lineHeight = normalizeComputedLineHeight(computed?.lineHeight, computed?.fontSize, 1.6);
      const fontFamily = String(computed?.fontFamily || "Arial").split(",")[0].replace(/["']/g, "").trim() || "Arial";
      const fontWeight = String(computed?.fontWeight || "400");
      const textColor = rgbToHex(computed?.color, "#111827");
      const textAlign = String(computed?.textAlign || "left");

      updated[selectedIndex] = {
        ...currentBlock,
        props: {
          ...(currentBlock.props || {}),
          images: currentBlock.props.images.map((layer, idx) => (
            idx === layerIndex
              ? {
                  ...layer,
                  content: nextHtml,
                  fontSize,
                  lineHeight,
                  fontWeight,
                  textColor,
                  textAlign,
                  fontFamily,
                  background: boxBackgroundImage ? `url("${boxBackgroundImage}") center center / cover no-repeat` : boxBackgroundColor,
                  backgroundColor: boxBackgroundColor,
                  backgroundImage: boxBackgroundImage,
                  backgroundSize: boxBackgroundImage ? "cover" : (layer.backgroundSize || "cover"),
                  backgroundPosition: boxBackgroundImage ? "center center" : (layer.backgroundPosition || "center center"),
                  backgroundRepeat: boxBackgroundImage ? "no-repeat" : (layer.backgroundRepeat || "no-repeat"),
                }
              : layer
          )),
        },
      };
      setBlocks(updated);
      return updated;
    }

    const propName = editable.getAttribute?.("data-text-prop");
    if (!propName) return sourceBlocks;

    // Only patch the HTML content — never overwrite block-level typography props
    // (fontSize, color, fontFamily, etc.) from computed style here.
    //
    // Rationale: getComputedStyle(editable) reads the *container* element's
    // inherited style (often 16px), not the style of the text at the cursor.
    // Writing that back as headlineFontSize/textColor/etc. clobbers intentional
    // per-block sizing and colours every time the user types.
    //
    // Typography prop updates happen exclusively through the text toolbar
    // (applyTextToolbarCommand), which reads from getSelectionStyleSource and
    // writes correct values.
    const nextProps = applyInlinePropPatch(currentBlock?.props || {}, propName, nextHtml);

    // For headline/subheadline keep the content field on the block object in sync,
    // but preserve all existing typography props unchanged.
    if (propName === "headline" || propName === "headlineBlock.content") {
      nextProps.headlineBlock = {
        ...(currentBlock.props?.headlineBlock || {}),
        content: nextHtml,
      };
      nextProps.headline = nextHtml;
    } else if (propName === "subheadline" || propName === "bodyBlock.content") {
      nextProps.bodyBlock = {
        ...(currentBlock.props?.bodyBlock || {}),
        content: nextHtml,
      };
      nextProps.subheadline = nextHtml;
    }

    updated[selectedIndex] = {
      ...currentBlock,
      props: nextProps,
    };
    latestBlocksRef.current = updated;
    setBlocks(updated);
    return updated;
  };

  const commitPendingInlineEdits = async () => {
    if (typeof document === "undefined") return latestBlocksRef.current;
    const focusedEditable = findEditable(document.activeElement) || activeEditableRef.current;

    if (focusedEditable && typeof focusedEditable.blur === "function") {
      cleanupEditableMarkup();
      flushSync(() => {
        focusedEditable.blur();
      });

      if (typeof window !== "undefined") {
        await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
      }
    }

    const syncedActive = syncActiveEditableToBlock(latestBlocksRef.current);
    return serializeCanvasInlineEditors(syncedActive);
  };

  const handlePreviewPage = async () => {
    if (!project?.id) return;
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      showSavePopup("Enable popups to open the preview in a new tab", "error");
      return;
    }
    previewWindow.document.write("<title>Opening preview...</title><body style=\"font-family:system-ui;padding:24px;color:#0f172a\">Opening preview...</body>");
    const committedBlocks = await commitPendingInlineEdits();
    // Use forceSave so the server copy is up-to-date before the preview tab fetches it
    const saved = await Promise.resolve((onForceSave || onSave)?.(committedBlocks));
    if (!saved) {
      previewWindow.close();
      showSavePopup("Could not save before preview", "error");
      return;
    }
    // saved._saveError: forceSaveBlockPage hit an error but still returned truthy — proceed to preview anyway
    const pageName = String(activePage || project?.pages?.[0]?.name || "Home");
    const pageSlug = pageName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "home";
    const previewUrl = new URL(
      `/modules/website-builder/project/${project.id}/preview?page=${encodeURIComponent(pageSlug)}&viewport=${encodeURIComponent(previewMode)}`,
      window.location.origin,
    ).toString();
    previewWindow.location.replace(previewUrl);
  };

  const handlePreviewSite = async () => {
    if (!project?.id) return;
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      showSavePopup("Enable popups to open the preview in a new tab", "error");
      return;
    }
    previewWindow.document.write("<title>Opening preview...</title><body style=\"font-family:system-ui;padding:24px;color:#0f172a\">Opening preview...</body>");
    const committedBlocks = await commitPendingInlineEdits();
    // Use forceSave so the server copy is up-to-date before the preview tab fetches it
    const saved = await Promise.resolve((onForceSave || onSave)?.(committedBlocks));
    if (!saved) {
      previewWindow.close();
      showSavePopup("Could not save before preview", "error");
      return;
    }
    // saved._saveError: proceed to preview with whatever was last saved
    const previewUrl = new URL(
      `/modules/website-builder/project/${project.id}/preview?viewport=${encodeURIComponent(previewMode)}`,
      window.location.origin,
    ).toString();
    previewWindow.location.replace(previewUrl);
  };

  useEffect(() => {
    if (typeof onRegisterPreviewActions !== "function") return undefined;
    onRegisterPreviewActions({ previewPage: handlePreviewPage, previewSite: handlePreviewSite });
    return () => onRegisterPreviewActions(null);
  }, [onRegisterPreviewActions, handlePreviewPage, handlePreviewSite]);

  const restoreSavedSelection = () => {
    if (typeof window === "undefined") return;
    const editable = activeEditableRef.current;
    const savedRange = selectionRangeRef.current;
    if (!editable || !savedRange) return;
    editable.focus();
    const selection = window.getSelection?.();
    if (!selection) return;
    selection.removeAllRanges();
    try {
      selection.addRange(savedRange);
    } catch {
      // Range may reference a stale DOM node (e.g. from a previous innerHTML rebuild).
      // Clear the stale reference so subsequent operations start fresh.
      selectionRangeRef.current = null;
    }
  };

  const getActiveSelectionRange = () => {
    if (typeof window === "undefined") return null;
    restoreSavedSelection();
    const selection = window.getSelection?.();
    if (!selection?.rangeCount) return null;
    const range = selection.getRangeAt(0);
    const editable = activeEditableRef.current;
    if (!editable) return null;
    const commonNode = range.commonAncestorContainer?.nodeType === 3
      ? range.commonAncestorContainer.parentNode
      : range.commonAncestorContainer;
    if (commonNode && editable.contains(commonNode)) {
      return range;
    }
    return null;
  };

  const persistActiveEditableContent = () => {
    syncActiveEditableToBlock(latestBlocksRef.current);
  };

  const cleanupEditableMarkup = () => {
    const editable = activeEditableRef.current;
    if (!editable || typeof document === "undefined") return;
    // Remove zero-width spaces from text nodes in-place (preserves live DOM selection).
    // Previously this used editable.innerHTML = cleanedHtml which destroyed the DOM and
    // killed the selection, causing the toolbar to fall back to the block's CSS base
    // font-size (usually 16px) and leaving selectionRangeRef pointing to dead nodes.
    const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT, null);
    const zwsNodes = [];
    let twNode;
    while ((twNode = walker.nextNode())) {
      if (twNode.nodeValue && twNode.nodeValue.includes("\u200b")) {
        zwsNodes.push(twNode);
      }
    }
    zwsNodes.forEach((n) => { n.nodeValue = n.nodeValue.replace(/\u200b/g, ""); });
    // Remove empty/whitespace-only leaf spans in-place.
    const spans = Array.from(editable.querySelectorAll("span"));
    for (const span of spans) {
      if (!span.children.length && /^\s*$/.test(span.textContent)) {
        span.parentNode?.removeChild(span);
      }
    }
    // Strip data-temp-selection attributes.
    editable.querySelectorAll("[data-temp-selection]").forEach((el) => {
      el.removeAttribute("data-temp-selection");
    });
  };

  const applyStyleToActiveEditable = (stylePatch = {}) => {
    const editable = activeEditableRef.current;
    if (!editable) return false;
    const target = getEditableBackgroundTarget(editable) || editable;
    Object.entries(stylePatch).forEach(([key, val]) => {
      if (key === "background" || key === "backgroundColor" || key === "backgroundImage" || key === "backgroundSize" || key === "backgroundPosition" || key === "backgroundRepeat") {
        target.style[key] = val;
      } else {
        editable.style[key] = val;
      }
    });
    return true;
  };

  const applyTextBoxBackground = (patch = {}) => {
    const editable = activeEditableRef.current;
    if (!editable || !editable.hasAttribute?.("data-layer-editor")) return false;

    const target = getEditableBackgroundTarget(editable);
    if (!target) return false;

    const backgroundColor = patch.backgroundColor !== undefined
      ? String(patch.backgroundColor || "transparent")
      : (target.style.backgroundColor || "transparent");
    const backgroundImage = patch.backgroundImage !== undefined
      ? String(patch.backgroundImage || "")
      : parseBackgroundImageUrl(target.style.backgroundImage);

    target.style.backgroundColor = backgroundColor;
    target.style.backgroundImage = backgroundImage ? `url("${backgroundImage}")` : "none";
    target.style.backgroundSize = backgroundImage ? "cover" : "";
    target.style.backgroundPosition = backgroundImage ? "center center" : "";
    target.style.backgroundRepeat = backgroundImage ? "no-repeat" : "";

    syncActiveEditableToBlock(latestBlocksRef.current);
    preserveCurrentSelection();
    refreshToolbarFromEditable();
    return true;
  };

  const updateActiveTextLayer = (patch = {}) => {
    if (typeof selectedIndex !== "number") return false;
    const currentBlock = blocks[selectedIndex];
    if (!currentBlock || currentBlock.type !== BlockTypes.IMAGE_STACK) return false;

    const layerIndex = Number.isInteger(currentBlock?.props?.selectedLayerIndex)
      ? currentBlock.props.selectedLayerIndex
      : null;

    if (layerIndex == null || !Array.isArray(currentBlock?.props?.images)) return false;

    const nextImages = currentBlock.props.images.map((layer, idx) => (
      idx === layerIndex ? { ...layer, ...patch } : layer
    ));

    handleUpdateBlock(selectedIndex, {
      ...(currentBlock.props || {}),
      images: nextImages,
    });

    const editable = activeEditableRef.current;
    const target = getEditableBackgroundTarget(editable);
    if (target && patch.width !== undefined) {
      target.style.width = `${Math.max(120, Math.min(5600, Number(patch.width) || 360))}px`;
    }

    refreshToolbarFromEditable();
    return true;
  };

  const applyInlineStyleToSelection = (stylePatch = {}, options = {}) => {
    if (typeof document === "undefined" || typeof window === "undefined") return false;
    const editable = activeEditableRef.current;
    const range = getActiveSelectionRange();
    if (!editable) return false;
    if (!range) {
      if (options.fallbackToEditable) {
        return applyStyleToActiveEditable(stylePatch);
      }
      return false;
    }

    if (range.collapsed) {
      if (options.fallbackToEditable) {
        return applyStyleToActiveEditable(stylePatch);
      }
      return false;
    }

    // Before extracting, capture the computed font-size from the range's parent.
    // If the patch doesn't set fontSize and the parent has a size different from the
    // editable root (e.g. a <span style="font-size:48px"> wrapper), preserve it on the
    // new wrapper so text doesn't visually jump to the block's base size.
    const rangeParentEl = range.commonAncestorContainer?.nodeType === 3
      ? range.commonAncestorContainer.parentElement
      : (range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : null);
    let preservedFontSize = null;
    if (!stylePatch.fontSize && rangeParentEl instanceof Element && editable.contains(rangeParentEl) && rangeParentEl !== editable) {
      const parentComputedSize = window.getComputedStyle(rangeParentEl).fontSize;
      const editableBaseSize = window.getComputedStyle(editable).fontSize;
      if (parentComputedSize && parentComputedSize !== editableBaseSize) {
        preservedFontSize = parentComputedSize;
      }
    }

    const extracted = range.extractContents();
    const wrapper = document.createElement("span");
    if (preservedFontSize) {
      wrapper.style.fontSize = preservedFontSize;
    }
    Object.entries(stylePatch).forEach(([key, val]) => {
      wrapper.style[key] = val;
    });
    wrapper.appendChild(extracted);
    range.insertNode(wrapper);

    const selection = window.getSelection?.();
    const nextRange = document.createRange();
    nextRange.selectNodeContents(wrapper);
    selection?.removeAllRanges();
    selection?.addRange(nextRange);
    selectionRangeRef.current = nextRange.cloneRange();
    return true;
  };

  const refreshToolbarFromEditable = () => {
    if (typeof window === "undefined") return;
    const editable = activeEditableRef.current;
    if (!editable) return;
    const selection = window.getSelection?.();
    const styleSource = getSelectionStyleSource(editable, selection) || editable;
    const computed = window.getComputedStyle(styleSource);
    // Read font-size using the computed style of the element directly containing the
    // cursor/selection. This correctly reflects inherited sizes from CSS classes (e.g.
    // h1 font-size) and inline spans, regardless of whether a colour-only span was just
    // applied. Previously this only walked inline style.fontSize, causing the toolbar
    // to show the block's CSS default (16px) after applying a colour span.
    const editableComputed = window.getComputedStyle(editable);
    const backgroundTarget = getEditableBackgroundTarget(editable) || editable;
    const backgroundComputed = window.getComputedStyle(backgroundTarget);
    const tagName = String(editable.tagName || "P").toUpperCase();
    const fontFamilyRaw = String(computed.fontFamily || "Arial")
      .split(",")[0]
      .replace(/["']/g, "")
      .trim() || "Arial";
    const getExplicitFontSize = () => {
      const focusNode = selection?.focusNode || selection?.anchorNode;
      const el = focusNode?.nodeType === 3 ? focusNode.parentElement : (focusNode instanceof Element ? focusNode : null);
      if (el instanceof Element && editable.contains(el)) {
        // Use the computed style of the immediate element at the cursor — this gives
        // the actual rendered size including CSS-class sizes and inherited inline sizes.
        return window.getComputedStyle(el).fontSize || null;
      }
      return null;
    };
    const explicitFontSize = getExplicitFontSize();
    const fontSizeValue = Math.max(12, Math.round(parseFloat(explicitFontSize || editableComputed.fontSize || "18") || 18));
    const lineHeightValue = normalizeComputedLineHeight(editableComputed.lineHeight, editableComputed.fontSize, tagName === "P" ? 1.7 : 1.2);
    const currentBlock = typeof selectedIndex === "number" ? blocks[selectedIndex] || null : null;
    const layerIndex = Number.isInteger(currentBlock?.props?.selectedLayerIndex) ? currentBlock.props.selectedLayerIndex : null;
    const activeLayer = layerIndex != null && Array.isArray(currentBlock?.props?.images) ? currentBlock.props.images[layerIndex] : null;
    const motionBinding = getTextAnimationBinding(currentBlock, editable);
    setTextToolbarState((prev) => ({
      ...prev,
      color: rgbToHex(computed.color, "#111827"),
      highlight: rgbToHex(computed.backgroundColor, "#ffffff"),
      fontFamily: fontFamilyRaw,
      fontSize: fontSizeValue,
      lineHeight: lineHeightValue,
      blockType: ["H1", "H2", "H3", "P"].includes(tagName) ? tagName : prev.blockType || "P",
      canStyleBox: editable.hasAttribute?.("data-layer-editor"),
      boxBackgroundColor: normalizeToolbarBackgroundColor(backgroundComputed.backgroundColor),
      boxBackgroundImage: parseBackgroundImageUrl(backgroundComputed.backgroundImage),
      boxWidth: Number(activeLayer?.width || prev.boxWidth || 360),
      textAnimation: motionBinding ? String(currentBlock?.props?.[motionBinding.animationKey] || "none") : prev.textAnimation || "none",
      textAnimationSpeed: motionBinding ? Number(currentBlock?.props?.[motionBinding.speedKey] || 0.8) : (prev.textAnimationSpeed || 0.8),
      textAnimationDelay: motionBinding ? Number(currentBlock?.props?.[motionBinding.delayKey] || 0) : (prev.textAnimationDelay || 0),
      motionLabel: motionBinding?.label || prev.motionLabel || "Text Motion",
    }));
  };

  const applyTextAnimationChange = (patch = {}) => {
    if (typeof selectedIndex !== "number" || !blocks[selectedIndex]) return;
    const editable = activeEditableRef.current;
    const binding = getTextAnimationBinding(blocks[selectedIndex], editable);
    if (!binding) return;

    const nextPatch = {};
    if (patch.animation !== undefined) nextPatch[binding.animationKey] = patch.animation;
    if (patch.speed !== undefined) nextPatch[binding.speedKey] = Number(patch.speed);
    if (patch.delay !== undefined) nextPatch[binding.delayKey] = Number(patch.delay);

    handleUpdateBlock(selectedIndex, {
      ...(blocks[selectedIndex]?.props || {}),
      ...nextPatch,
    });

    setTextToolbarState((prev) => ({
      ...prev,
      textAnimation: patch.animation !== undefined ? String(patch.animation) : prev.textAnimation,
      textAnimationSpeed: patch.speed !== undefined ? Number(patch.speed) : prev.textAnimationSpeed,
      textAnimationDelay: patch.delay !== undefined ? Number(patch.delay) : prev.textAnimationDelay,
      motionLabel: binding.label,
    }));
  };

  const runTextCommand = (command, value = null) => {
    const editable = activeEditableRef.current;
    if (!editable || typeof document === "undefined") return;

    restoreSavedSelection();
    editable.focus();

    try {
      document.execCommand("styleWithCSS", false, true);
    } catch {}

    const activeRange = getActiveSelectionRange();
    const hasTextSelection = !!activeRange && !activeRange.collapsed;
    let nextValue = value;

    const finishTextCommand = () => {
      cleanupEditableMarkup();
      persistActiveEditableContent();
      preserveCurrentSelection();
      refreshToolbarFromEditable();
    };

    if (command === "createLink") {
      nextValue = typeof window !== "undefined" ? window.prompt("Enter link URL", "https://") : "";
      if (!hasTextSelection) return;
      if (!nextValue) {
        try { document.execCommand("unlink", false, null); } catch {}
        finishTextCommand();
        return;
      }
    }

    if (command === "formatBlock") {
      const blockKey = String(nextValue || "P").toUpperCase();
      const stylePreset = BLOCK_TYPE_STYLE_PRESETS[blockKey] || BLOCK_TYPE_STYLE_PRESETS.P;
      applyStyleToActiveEditable(stylePreset);
      setTextToolbarState((prev) => ({
        ...prev,
        blockType: blockKey,
        fontSize: Number.parseInt(stylePreset.fontSize, 10) || prev.fontSize,
      }));
      finishTextCommand();
      return;
    }

    // Helper: select all content inside the active editable so applyInlineStyleToSelection
    // can wrap it in a span. This is needed when the user changes font-size/family without
    // first highlighting text — the style change must land inside innerHTML (persisted) not
    // on the element's own style property (overwritten by React on next render).
    const selectAllInEditable = () => {
      if (!editable || typeof document === "undefined") return;
      const sel = window.getSelection?.();
      if (!sel) return;
      const range = document.createRange();
      range.selectNodeContents(editable);
      sel.removeAllRanges();
      sel.addRange(range);
      selectionRangeRef.current = range.cloneRange();
    };

    if (command === "fontSize") {
      const pxValue = `${Number(nextValue || 18)}px`;
      // Try to apply only to selected text first; if nothing is selected, apply to all.
      let applied = applyInlineStyleToSelection({ fontSize: pxValue });
      if (!applied) {
        selectAllInEditable();
        applyInlineStyleToSelection({ fontSize: pxValue });
      }
      setTextToolbarState((prev) => ({ ...prev, fontSize: Number(nextValue || 18) }));
      finishTextCommand();
      return;
    }

    if (command === "lineHeight") {
      applyInlineStyleToSelection({ lineHeight: String(Number(nextValue || 1.5)) }, { fallbackToEditable: true });
      setTextToolbarState((prev) => ({ ...prev, lineHeight: Number(nextValue || 1.5) }));
      finishTextCommand();
      return;
    }

    if (command === "fontName") {
      const fontValue = String(nextValue || "Arial");
      // Use span-based approach (consistent with fontSize/color) — avoids deprecated
      // <font face> elements that can conflict with inline style spans.
      let applied = applyInlineStyleToSelection({ fontFamily: fontValue });
      if (!applied) {
        selectAllInEditable();
        applyInlineStyleToSelection({ fontFamily: fontValue });
      }
      setTextToolbarState((prev) => ({ ...prev, fontFamily: fontValue }));
      finishTextCommand();
      return;
    }

    if (command === "foreColor") {
      const colorValue = String(nextValue || "#111827");
      if (hasTextSelection) {
        // Use span-based approach to avoid <font> elements that reset font-size
        const applied = applyInlineStyleToSelection({ color: colorValue });
        if (!applied) {
          applyStyleToActiveEditable({ color: colorValue });
        }
      } else {
        applyStyleToActiveEditable({ color: colorValue });
      }
      setTextToolbarState((prev) => ({ ...prev, color: colorValue }));
      finishTextCommand();
      return;
    }

    if (command === "hiliteColor") {
      const isRemove = nextValue === "transparent" || nextValue === "none" || !nextValue;
      const bgValue = isRemove ? "transparent" : String(nextValue);
      if (hasTextSelection) {
        // Use span-based approach to avoid <font> elements that reset font-size
        const applied = applyInlineStyleToSelection({ backgroundColor: bgValue });
        if (!applied) {
          applyStyleToActiveEditable({ backgroundColor: bgValue });
        }
      } else {
        applyStyleToActiveEditable({ backgroundColor: bgValue });
      }
      if (!isRemove) {
        setTextToolbarState((prev) => ({ ...prev, highlight: String(nextValue) }));
      }
      finishTextCommand();
      return;
    }

    if (command === "bold") {
      if (hasTextSelection) {
        try { document.execCommand("bold", false, null); } catch {}
      } else {
        const computedWeight = Number(window.getComputedStyle(editable).fontWeight || 400);
        applyStyleToActiveEditable({ fontWeight: computedWeight >= 600 ? "400" : "700" });
      }
      finishTextCommand();
      return;
    }

    if (command === "italic") {
      if (hasTextSelection) {
        try { document.execCommand("italic", false, null); } catch {}
      } else {
        applyStyleToActiveEditable({ fontStyle: editable.style.fontStyle === "italic" ? "normal" : "italic" });
      }
      finishTextCommand();
      return;
    }

    if (command === "underline") {
      if (hasTextSelection) {
        try { document.execCommand("underline", false, null); } catch {}
      } else {
        applyStyleToActiveEditable({ textDecoration: editable.style.textDecoration === "underline" ? "none" : "underline" });
      }
      finishTextCommand();
      return;
    }

    if (command === "justifyLeft" || command === "justifyCenter" || command === "justifyRight") {
      const align = command === "justifyCenter" ? "center" : command === "justifyRight" ? "right" : "left";
      applyStyleToActiveEditable({ textAlign: align, display: "block" });
      finishTextCommand();
      return;
    }

    if (["insertUnorderedList", "insertOrderedList", "unlink", "removeFormat", "createLink"].includes(command)) {
      try {
        document.execCommand(command, false, nextValue);
      } catch {}
      finishTextCommand();
      return;
    }

    try {
      document.execCommand(command, false, nextValue);
    } catch {}

    finishTextCommand();
  };

  const handleTextBoxBackgroundColorChange = (value) => {
    applyTextBoxBackground({ backgroundColor: value, backgroundImage: "" });
  };

  const handleClearTextBoxBackground = () => {
    applyTextBoxBackground({ backgroundColor: "transparent", backgroundImage: "" });
  };

  const handleClearTextBoxBackgroundImage = () => {
    applyTextBoxBackground({ backgroundImage: "" });
  };

  const handleTextBoxWidthChange = (value) => {
    const nextWidth = Math.max(120, Math.min(5600, Number(value) || 360));
    updateActiveTextLayer({ width: nextWidth });
  };

  const handleTextBoxBackgroundImageUpload = async (file) => {
    if (!file || typeof selectedIndex !== "number") return;
    const asset = await Promise.resolve(onUploadImage?.(selectedIndex, "__text_layer_background__", file));
    if (!asset?.src) return;
    applyTextBoxBackground({ backgroundImage: asset.src, backgroundColor: "transparent" });
  };

  const startTextToolbarDrag = (event) => {
    event.preventDefault();
    textToolbarDraggedRef.current = true;
    const originX = textToolbarPosition.x;
    const originY = textToolbarPosition.y;
    const startX = event.clientX;
    const startY = event.clientY;

    const handleMove = (moveEvent) => {
      const viewportWidth = typeof window !== "undefined" ? (window.innerWidth || 1440) : 1440;
      const toolbarWidth = Math.max(280, Math.min(Number(textToolbarPosition.width) || 720, viewportWidth - 24));
      setTextToolbarPosition({
        x: Math.min(Math.max(12, originX + (moveEvent.clientX - startX)), Math.max(12, viewportWidth - toolbarWidth - 12)),
        y: Math.max(16, originY + (moveEvent.clientY - startY)),
        width: toolbarWidth,
      });
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const startAnimationPopoverDrag = (event) => {
    event.preventDefault();
    animationPopoverDraggedRef.current = true;
    const originX = animationPopover.x;
    const originY = animationPopover.y;
    const startX = event.clientX;
    const startY = event.clientY;

    const handleMove = (moveEvent) => {
      setAnimationPopover((prev) => ({
        ...prev,
        x: Math.max(12, Math.min(originX + (moveEvent.clientX - startX), (window.innerWidth || 1280) - (prev.width || 980) - 12)),
        y: Math.max(12, Math.min(originY + (moveEvent.clientY - startY), (window.innerHeight || 900) - 220)),
      }));
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const triggerAnimationReplay = (index) => {
    if (!Number.isInteger(index) || !blocks[index]) return;
    setAnimationReplayState((prev) => ({ index, tick: prev.tick + 1 }));
  };

  const showSavePopup = (message, tone = "success") => {
    if (saveNoticeTimerRef.current) clearTimeout(saveNoticeTimerRef.current);
    setSaveNotice({ message, tone });
    saveNoticeTimerRef.current = setTimeout(() => setSaveNotice(null), 2400);
  };

  const preserveCurrentSelection = () => {
    if (typeof window === "undefined") return;
    const selection = window.getSelection?.();
    const editable = activeEditableRef.current;
    if (!selection?.rangeCount || !editable) return;
    const range = selection.getRangeAt(0);
    const commonNode = range.commonAncestorContainer?.nodeType === 3
      ? range.commonAncestorContainer.parentNode
      : range.commonAncestorContainer;
    if (commonNode && editable.contains(commonNode)) {
      selectionRangeRef.current = range.cloneRange();
    }
  };

  const handleSave = async () => {
    showSavePopup("Saving...", "info");
    try {
      const committedBlocks = await commitPendingInlineEdits();
      // Use onForceSave (awaits cloud sync) if available, otherwise fall back to onSave
      const saveFn = typeof onForceSave === "function" ? onForceSave : onSave;
      const saved = await Promise.resolve(saveFn?.(committedBlocks));
      // saved._saveError means forceSaveBlockPage already showed its own error toast — don't double-report
      if (!saved || saved?._saveError) {
        if (!saved) showSavePopup("Could not save page", "error");
        // else: error already shown by forceSaveBlockPage via flashNotice
        return;
      }
      setLastSavedAt(Date.now());
      showSavePopup("Saved ✓");
    } catch (err) {
      console.error("[handleSave]", err);
      showSavePopup(err?.message || "Could not save page", "error");
    }
  };
  handleSaveRef.current = handleSave;

  const handleSaveCurrentPageAsTemplate = async () => {
    if (!onSaveTemplatePage) return;
    showSavePopup("Saving template page...", "info");
    try {
      const committedBlocks = await commitPendingInlineEdits();
      const saved = await Promise.resolve(onSaveTemplatePage({
        pageName: activePage,
        blocks: committedBlocks,
        globalNavBlock: project?.globalNavBlock || null,
        globalFooterBlock: project?.globalFooterBlock || null,
      }));
      if (!saved) {
        showSavePopup("Could not save template page", "error");
        return;
      }
      showSavePopup("Template page saved");
    } catch (err) {
      console.error("[handleSaveTemplate]", err);
      showSavePopup("Could not save template page", "error");
    }
  };

  const handleSaveCurrentSiteAsTemplate = async () => {
    if (!onSaveTemplateSite) return;
    showSavePopup("Saving full template...", "info");
    try {
      const committedBlocks = await commitPendingInlineEdits();
      const saved = await Promise.resolve(onSaveTemplateSite({
        pageBlocks: {
          ...(project?.pageBlocks || {}),
          [activePage]: committedBlocks,
        },
        globalNavBlock: project?.globalNavBlock || null,
        globalFooterBlock: project?.globalFooterBlock || null,
      }));
      if (!saved) {
        showSavePopup("Could not save full template", "error");
        return;
      }
      showSavePopup("Template saved globally");
    } catch (err) {
      console.error("[handleSaveSite]", err);
      showSavePopup("Could not save full template", "error");
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        ${websiteBlockKeyframes()}
      `}</style>
      {showHeader ? (
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>🛠️ Website Page Builder</h2>
          <div style={styles.headerActions}>
            <button
              type="button"
              title="Undo (Ctrl+Z)"
              style={{ ...styles.panelToggleBtn, minWidth: 36, opacity: historyLen > 0 ? 1 : 0.35, cursor: historyLen > 0 ? "pointer" : "default" }}
              onClick={() => handleUndoRef.current?.()}
              disabled={historyLen === 0}
            >
              ↩
            </button>
            <button
              type="button"
              title="Redo (Ctrl+Y)"
              style={{ ...styles.panelToggleBtn, minWidth: 36, opacity: futureLen > 0 ? 1 : 0.35, cursor: futureLen > 0 ? "pointer" : "default" }}
              onClick={() => handleRedoRef.current?.()}
              disabled={futureLen === 0}
            >
              ↪
            </button>
            <button
              type="button"
              style={{ ...styles.panelToggleBtn, ...(showLibrary ? styles.panelToggleBtnActive : {}) }}
              onClick={() => setShowLibrary((v) => !v)}
            >
              {showLibrary ? "Hide Widgets" : "Show Widgets"}
            </button>
            <button
              type="button"
              style={{ ...styles.panelToggleBtn, ...(showProperties ? styles.panelToggleBtnActive : {}) }}
              onClick={() => setShowProperties((v) => !v)}
            >
              {showProperties ? "Hide Sidebar" : "Show Sidebar"}
            </button>
            <button
              type="button"
              style={{ ...styles.panelToggleBtn, ...(rightPanelMode === "global" ? styles.panelToggleBtnActive : {}) }}
              onClick={() => {
                setShowProperties(true);
                setRightPanelMode((value) => value === "global" ? "block" : "global");
              }}
            >
              {rightPanelMode === "global" ? "Block Editor" : "Global Styles"}
            </button>
            <button
              type="button"
              style={{ ...styles.panelToggleBtn, ...(rightPanelMode === "sections" ? styles.panelToggleBtnActive : {}) }}
              onClick={() => {
                setShowProperties(true);
                setRightPanelMode((value) => value === "sections" ? "block" : "sections");
              }}
            >
              {rightPanelMode === "sections" ? "Block Editor" : "Page Sections"}
            </button>
            <button
              type="button"
              style={{ ...styles.panelToggleBtn, ...(showCanvasGrid ? styles.panelToggleBtnActive : {}) }}
              onClick={() => setShowCanvasGrid((value) => !value)}
            >
              {showCanvasGrid ? "Grid On" : "Grid Off"}
            </button>
            <button
              type="button"
              style={styles.panelToggleBtn}
              onClick={() => onRefreshAssetLibrary?.()}
            >
              Refresh Library
            </button>
            <button
              type="button"
              style={styles.panelToggleBtn}
              onClick={() => insertPresetBlock(BlockTypes.IMAGE_STACK, {
                title: "Free Layout Image Canvas",
                minHeight: "72vh",
                backgroundColor: "transparent",
                showGrid: true,
                snapToGrid: true,
                images: [createImageStackLayer(0), createTextStackLayer(0), createImageStackLayer(1)],
              })}
            >
              + Image Stack
            </button>
            {[
              { id: "desktop", label: "Desktop" },
              { id: "tablet", label: "Tablet" },
              { id: "mobile", label: "Mobile" },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                style={{ ...styles.panelToggleBtn, ...(previewMode === mode.id ? styles.panelToggleBtnActive : {}) }}
                onClick={() => setPreviewMode(mode.id)}
              >
                {mode.label}
              </button>
            ))}
            {selectedBlock && [BlockTypes.HERO, BlockTypes.TEXT].includes(selectedBlock.type) ? (
              <button
                type="button"
                style={{ ...styles.panelToggleBtn, ...(isFullWidthBackgroundEnabled(selectedBlock) ? styles.panelToggleBtnActive : {}) }}
                onClick={() => toggleSelectedProp("fullWidthBackground")}
              >
                {isFullWidthBackgroundEnabled(selectedBlock) ? "Full Width On" : "Full Width Off"}
              </button>
            ) : null}
          </div>
          <div style={{ ...styles.primaryActionGroup, flexShrink: 0 }}>
            {project?.id ? (
              <button type="button" style={styles.previewBtn} onClick={handlePreviewPage}>
                👁 Preview Page
              </button>
            ) : null}
            <button style={styles.saveBtn} onClick={handleSave}>
              💾 Save  {lastSavedAt ? <span style={{ fontSize: 16, opacity: 0.7, marginLeft: 4 }}>· ✓ {formatSavedAgo(lastSavedAt)}</span> : null}
            </button>
          </div>
        </div>
      ) : null}

      {saveNotice ? (
        <div style={{
          position: "fixed",
          top: 18,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 120,
          padding: "10px 14px",
          borderRadius: 12,
          background: saveNotice.tone === "error"
            ? "#7f1d1d"
            : saveNotice.tone === "info"
              ? "#0c4a6e"
              : "#052e16",
          color: "#ffffff",
          border: `1px solid ${saveNotice.tone === "error" ? "#ef4444" : saveNotice.tone === "info" ? "#38bdf8" : "#22c55e"}`,
          boxShadow: "0 14px 28px rgba(15,23,42,0.28)",
          fontSize: 16,
          fontWeight: 600,
        }}>
          {saveNotice.message}
        </div>
      ) : null}

      <TextEditingToolbar
        visible={showTextToolbar}
        textColor={textToolbarState.color}
        highlightColor={textToolbarState.highlight}
        fontFamily={textToolbarState.fontFamily}
        fontSize={textToolbarState.fontSize}
        lineHeight={textToolbarState.lineHeight}
        blockType={textToolbarState.blockType}
        canStyleBox={textToolbarState.canStyleBox}
        boxBackgroundColor={textToolbarState.boxBackgroundColor}
        boxBackgroundImage={textToolbarState.boxBackgroundImage}
        boxWidth={textToolbarState.boxWidth}
        onClearBoxBackground={handleClearTextBoxBackground}
        onBoxBackgroundColor={handleTextBoxBackgroundColorChange}
        onBoxBackgroundImageUpload={handleTextBoxBackgroundImageUpload}
        onClearBoxBackgroundImage={handleClearTextBoxBackgroundImage}
        onBoxWidthChange={handleTextBoxWidthChange}
        onCommand={runTextCommand}
        onTextColor={(value) => runTextCommand("foreColor", value)}
        onHighlightColor={(value) => runTextCommand("hiliteColor", value)}
        onFontSize={(value) => runTextCommand("fontSize", value)}
        onLineHeight={(value) => runTextCommand("lineHeight", value)}
        onBlockType={(value) => runTextCommand("formatBlock", value)}
        onFontFamily={(value) => runTextCommand("fontName", value)}
        onOpenAnimations={(triggerNode) => {
          if (typeof selectedIndex !== "number") return;
          openAnimationPanelForBlock(selectedIndex, triggerNode);
        }}
        position={textToolbarPosition}
        onDragStart={startTextToolbarDrag}
        onPreserveSelection={preserveCurrentSelection}
        onClose={() => {
          textToolbarDraggedRef.current = false;
          setShowTextToolbar(false);
        }}
      />

      <BlockAnimationPopover
        visible={animationPopover.visible}
        block={Number.isInteger(animationPopover.index) ? blocks[animationPopover.index] || null : null}
        position={animationPopover}
        onClose={() => setAnimationPopover((prev) => ({ ...prev, visible: false }))}
        onDragStart={startAnimationPopoverDrag}
        onPreview={() => triggerAnimationReplay(animationPopover.index)}
        onApply={(patch) => {
          if (!Number.isInteger(animationPopover.index) || !blocks[animationPopover.index]) return;
          handleUpdateBlock(animationPopover.index, {
            ...(blocks[animationPopover.index]?.props || {}),
            ...patch,
          });
        }}
      />

      {imageEditState ? (
        <ImageEditModal
          src={imageEditState.src}
          userId={imageEditorUserId}
          onDone={applyEditedStructuredImage}
          onCancel={() => setImageEditState(null)}
        />
      ) : null}

      <div
        style={{
          ...styles.workspace,
          ...(isNarrowLayout ? styles.workspaceNarrow : {}),
          gridTemplateColumns: workspaceColumns,
          ...(workspaceRows ? { gridTemplateRows: workspaceRows, overflow: "auto" } : {}),
        }}
      >
        {showLibrary ? (
          <div style={styles.leftPanelShell}>
            <BlockLibraryPanel onDragStart={handleDragStart} />
          </div>
        ) : null}

        <div
          data-builder-canvas="true"
          style={{
            ...styles.canvas,
            ...(showCanvasGrid ? styles.canvasGridBg : {}),
            backgroundColor: pageCanvasBackground,
          }}
          onPointerDown={(event) => {
            if (event.target?.closest?.("[data-canvas-block-index], [data-global-block-preview='true']")) return;
            clearCanvasSelection();
          }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget)) return;
            setDropIndex(null);
          }}
        >
          <div style={styles.canvasLabel}>Drag widgets here • {previewMode}</div>
          <div ref={canvasMeasureRef} style={styles.canvasViewport}>
            <div
              style={{
                height: previewMode === "desktop" && blocksNaturalHeight > 0 && canvasScale < 1
                  ? `${Math.round(blocksNaturalHeight * canvasScale)}px`
                  : undefined,
                overflow: previewMode === "desktop" && canvasScale < 1 ? "hidden" : undefined,
              }}
            >
            <div
              ref={blocksContainerRef}
              data-canvas-scale={previewMode === "desktop" ? canvasScale : 1}
              style={{
                ...styles.blocksList,
                width: previewMode === "desktop" ? (canvasScale >= 1 ? "100%" : `${pageCanvasWidth}px`) : previewWidth,
                maxWidth: previewMode === "desktop" ? (canvasScale >= 1 ? "100%" : `${pageCanvasWidth}px`) : previewWidth,
                margin: "0 auto",
                transform: previewMode === "desktop" ? (canvasScale >= 1 ? undefined : `scale(${canvasScale})`) : undefined,
                transformOrigin: previewMode === "desktop" ? "top left" : undefined,
              }}
            >
              {project?.globalNavBlock ? (
                <GlobalBlockPreview
                  label="🌐 Global Navigation"
                  role="nav"
                  block={project.globalNavBlock}
                  brandAssets={brandAssets}
                  compact={previewMode === "mobile"}
                  selected={selectedGlobalRole === "nav"}
                  onSelect={() => selectGlobalBlock("nav")}
                  onChange={(nextBlock) => onUpdateGlobalBlock?.("nav", nextBlock)}
                  onSaveAsGlobal={onSaveAsGlobal}
                />
              ) : null}
              {canvasBlockEntries.length === 0 ? (
                <div style={styles.emptyState}>
                  📭 No widgets yet. Drag one in from the widgets panel to start building!
                </div>
              ) : (
                <>
                  {canvasBlockEntries.map(({ block, index: blockIndex }, idx) => (
                    <React.Fragment key={block.id || `${block.type}-${blockIndex}`}>
                      <DropInsertZone
                        active={dropIndex === blockIndex}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "copy";
                          if (dropIndex !== blockIndex) setDropIndex(blockIndex);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleInsertAt(blockIndex, e.dataTransfer);
                          setDropIndex(null);
                        }}
                      />
                      <CanvasBlock
                        block={block}
                        index={blockIndex}
                        pageCanvasWidth={pageCanvasWidth}
                        canvasScale={canvasScale}
                        brandAssets={brandAssets}
                        compactPreview={previewMode === "mobile"}
                        animationReplayToken={animationReplayState.index === blockIndex ? animationReplayState.tick : 0}
                        selected={selectedIndex === blockIndex}
                        hovered={hoveredIndex === blockIndex}
                        onSelect={selectCanvasBlock}
                        onHover={(value) => setHoveredIndex(value)}
                        onDelete={handleDelete}
                        onDuplicate={handleDuplicate}
                        onMoveStep={moveBlockByStep}
                        onMoveToTop={moveBlockToTop}
                        onEdit={openTextEditorForBlock}
                        onAnimate={openAnimationPanelForBlock}
                        onChange={handleUpdateBlock}
                        onResizeHeight={handleResizeBlockHeight}
                        onUploadImage={handleCanvasImageUpload}
                        onUploadLayerImage={handleLayerImageUpload}
                        onSelectAsset={handleCanvasAssetSelect}
                        onBlockDragOver={handleBlockDragOver}
                        onBlockDrop={handleBlockDrop}
                        activeDragIndex={draggedBlockIndex}
                        onBlockDragStart={handleBlockDragStart}
                        onBlockDragEnd={handleBlockDragEnd}
                        onColumnSlotDrop={handleColumnSlotDrop}
                        onSaveAsGlobal={onSaveAsGlobal}
                        onSaveBlockDefault={onSaveBlockDefault}
                      />
                    </React.Fragment>
                  ))}
                  <DropInsertZone
                    active={dropIndex === blocks.length}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "copy";
                      if (dropIndex !== blocks.length) setDropIndex(blocks.length);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleInsertAt(blocks.length, e.dataTransfer);
                      setDropIndex(null);
                    }}
                  />
                  {project?.globalFooterBlock ? (
                    <GlobalBlockPreview
                      label="🌐 Global Footer"
                      role="footer"
                      block={project.globalFooterBlock}
                      brandAssets={brandAssets}
                      compact={previewMode === "mobile"}
                      selected={selectedGlobalRole === "footer"}
                      onSelect={() => selectGlobalBlock("footer")}
                      onChange={(nextBlock) => onUpdateGlobalBlock?.("footer", nextBlock)}
                      onSaveAsGlobal={onSaveAsGlobal}
                      onDelete={() => onUpdateGlobalBlock?.("footer", null)}
                    />
                  ) : null}
                  <div style={styles.canvasEndSpacer} aria-hidden="true" />
                </>
              )}
            </div>
            </div>
          </div>
        </div>

        {showProperties ? (
          <div data-builder-sidepanel="true" style={{ ...styles.sidePanelShell, ...(isNarrowLayout ? { alignSelf: "stretch" } : {}) }}>
            {rightPanelMode === "global" ? (
              <GlobalStylePanel blocks={blocks} onApplyGlobal={applyGlobalStyles} />
            ) : rightPanelMode === "sections" ? (
              <PageSectionsPanel blocks={blocks} selectedIndex={selectedIndex} onSelect={selectCanvasBlock} onMove={moveBlockByStep} />
            ) : (
              <PropertiesPanel
                block={selectedGlobalBlock || blocks[selectedIndex] || null}
                index={selectedGlobalBlock ? -1 : selectedIndex}
                onChange={selectedGlobalBlock
                  ? (_index, nextProps) => {
                      if (!selectedGlobalRole || !selectedGlobalBlock) return;
                      onUpdateGlobalBlock?.(selectedGlobalRole, {
                        ...selectedGlobalBlock,
                        props: nextProps,
                      });
                    }
                  : handleUpdateBlock}
                brandAssets={brandAssets}
                onUploadImage={selectedGlobalBlock
                  ? (_index, key, file) => handleGlobalImageUpload(selectedGlobalRole, key, file)
                  : handleCanvasImageUpload}
                onSelectAsset={selectedGlobalBlock
                  ? (_index, key, asset) => handleGlobalAssetSelect(selectedGlobalRole, key, asset)
                  : handleCanvasAssetSelect}
                onOpenImageEditor={openStructuredImageEditor}
                onOpenSimpleImageEditor={openSimpleImageEditor}
                onRefreshAssetLibrary={onRefreshAssetLibrary}
                project={project}
                activePage={activePage}
                currentObjective={currentObjective}
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

