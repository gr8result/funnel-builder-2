import React from "react";
import { getAssetFromLibrary, resolveAssetField } from "../../../lib/website-builder/mediaAssets";
import { renderGridLibraryIcon } from "../gridIconLibrary";
import { cleanInlineEditorHtml } from "../../../modules/website-builder/utils/inlineHtml";
import { FAQAccordionItems, FAQAccordionBlock } from "../../../modules/website-builder/blocks/accordion/AccordionBlock";
import {
  MIN_TEXT_SIZE, MIN_TAP_SIZE, PREMIUM_SHADOW, PREMIUM_BORDER, DEFAULT_LAYOUT_WIDTH,
  asArray, slugifyText, resolveCurrentPageKey,
  ScrollReveal, getAnimationStyle, ambientMotionStyle, ensureWebsiteBlockAnimationStyles,
  isCurrentNavLink, shouldHighlightNavLink, isSystemAsset, resolvePublishedNavHref,
  IconCounterNumber,
} from "./wbAnimations";
import {
  colorWithAlpha, asStyleObject, asRichHtml, CANVAS_PLACEHOLDER_STRINGS, stripPlaceholder,
  computeHeadlineTextStyleCss, textLayerBackgroundStyle, headingTypography, bodyTypography,
  spacingMultiplier, scaleBoxPadding, parseSizeValue, fullWidthStyle, sectionContentStyle,
  normalizeOverlayLayoutProps, heroLayoutDefaults, heroVariantStyles, normalizeFeatureItem,
  featureVariantStyles, testimonialVariantStyles, ctaButtonVariantStyles,
  normalizeGalleryItem, normalizeTeamMember, normalizeTestimonialItem, normalizeTestimonialItems,
  normalizeTeamRowSizes, defaultTeamHierarchyRows, buildTeamHierarchyRows, renderHierarchyConnector,
  teamVariantStyles, normalizeStatItem, statsVariantStyles, imageGalleryVariantStyles,
  pricingVariantStyles, iconGlyph, normalizePricingPlan,
  navVariantTheme, contactFormVariantStyles, DEFAULT_ENQUIRY_BOOKING_URL, resolveContactBookingUrl, sharedStyles,
  trustBadgeVariantStyles, resolveNewsletterButtonUrl, resolveFooterEmailHref,
  resolveFooterPhoneHref, buildNewsletterMailtoHref,
  buildNavLinkStyle, applyNavHoverEffect, resetNavHoverEffect,
  findScrollParent, BrandMark,
} from "./wbVariantStyles";

function NavBarBlock({ blockProps, compact, logoSrc, editor = false, navigationContext = null }) {
  const wrapperRef = React.useRef(null);
  const shellRef = React.useRef(null);
  const navTheme = navVariantTheme(blockProps, compact);
  const navProps = { ...blockProps, fullWidthBackground: blockProps?.fullWidthBackground !== false };
  const stickyMode = blockProps.stickyMode || "normal";
  const isAlwaysMode = stickyMode === "always";
  const isStickyMode = stickyMode === "sticky" || stickyMode === "sticky-transparent" || stickyMode === "sticky-solid";
  const navFullWidth = fullWidthStyle(navProps, compact, editor);
  const isFullWidthNav = navProps.fullWidthBackground && !compact;
  const mobileMenuStyle = blockProps.mobileMenuStyle || "hamburger";
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [openDropdown, setOpenDropdown] = React.useState(null);
  const [isMobile, setIsMobile] = React.useState(!!compact);
  const [scrolled, setScrolled] = React.useState(false);
  const [browserPageKey, setBrowserPageKey] = React.useState("");
  const [navHeight, setNavHeight] = React.useState(0);
  const [stickyPinned, setStickyPinned] = React.useState(false);
  const [fixedFrame, setFixedFrame] = React.useState({ top: 0, left: 0, width: 0 });

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onResize = () => setIsMobile(!!compact || window.innerWidth < 900);

    onResize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [compact]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const measureTarget = wrapperRef.current || shellRef.current;
    if (!measureTarget) return undefined;

    const updateHeight = () => {
      setNavHeight(Math.ceil(measureTarget.getBoundingClientRect().height || 0));
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);

    let resizeObserver;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(measureTarget);
    }

    return () => {
      window.removeEventListener("resize", updateHeight);
      resizeObserver?.disconnect?.();
    };
  }, [compact, blockProps, mobileOpen]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const wrapperNode = wrapperRef.current;
    const scrollTarget = findScrollParent(wrapperNode || shellRef.current);
    const readScrollTop = () => {
      const usesWindowScroll = !scrollTarget || scrollTarget === window;
      const scrollAmount = usesWindowScroll ? (window.scrollY || 0) : (scrollTarget?.scrollTop || 0);
      const wrapperRect = wrapperNode?.getBoundingClientRect?.();
      const containerTop = usesWindowScroll ? 0 : (scrollTarget?.getBoundingClientRect?.().top || 0);

      setScrolled(scrollAmount > 18);

      if (isStickyMode) {
        setStickyPinned((wrapperRect?.top || 0) <= containerTop && scrollAmount > 0);
      }

      if ((isAlwaysMode || isStickyMode) && wrapperRect) {
        setFixedFrame((current) => {
          const next = {
            top: usesWindowScroll ? 0 : containerTop,
            left: wrapperRect.left,
            width: wrapperRect.width,
          };

          if (current.top === next.top && current.left === next.left && current.width === next.width) {
            return current;
          }

          return next;
        });
      }
    };

    readScrollTop();
    scrollTarget?.addEventListener?.("scroll", readScrollTop, { passive: true });
    window.addEventListener("resize", readScrollTop);

    return () => {
      scrollTarget?.removeEventListener?.("scroll", readScrollTop);
      window.removeEventListener("resize", readScrollTop);
    };
  }, [compact, isAlwaysMode, isStickyMode]);

  React.useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncCurrentPage = () => setBrowserPageKey(resolveCurrentPageKey());
    syncCurrentPage();

    window.addEventListener("popstate", syncCurrentPage);
    window.addEventListener("hashchange", syncCurrentPage);

    return () => {
      window.removeEventListener("popstate", syncCurrentPage);
      window.removeEventListener("hashchange", syncCurrentPage);
    };
  }, []);

  const currentPageKey = slugifyText(navigationContext?.currentPageKey || browserPageKey || "");

  const shouldUseMobileMenu = (compact || isMobile) && mobileMenuStyle === "hamburger";
  const visibleLinks = shouldUseMobileMenu && !mobileOpen ? [] : asArray(blockProps.links);
  const shouldUseStickyEditor = editor && (isAlwaysMode || isStickyMode);
  const useFixedSticky = !editor && isStickyMode;
  const shouldUseFixedNav = !editor && (isAlwaysMode || isStickyMode);
  const fixedTop = fixedFrame.top || 0;
  const fixedLeft = editor ? fixedFrame.left : (isFullWidthNav ? 0 : fixedFrame.left);
  const fixedWidth = editor ? (fixedFrame.width || undefined) : (isFullWidthNav ? "100vw" : (fixedFrame.width || "100%"));
  const brandMarkSize = compact ? 36 : Number(blockProps.logoWidth) || 44;
  const shouldShowBrandMark = blockProps.showLogo || !!logoSrc;

  const shellStyle = {
    ...navTheme.shell,
    ...navFullWidth,
    width: shouldUseFixedNav ? fixedWidth : (navFullWidth.width || "100%"),
    maxWidth: shouldUseFixedNav ? fixedWidth : navFullWidth.maxWidth,
    boxSizing: "border-box",
    position: shouldUseFixedNav ? "fixed" : shouldUseStickyEditor ? "sticky" : navTheme.shell.position,
    top: shouldUseFixedNav ? fixedTop : shouldUseStickyEditor ? 0 : navTheme.shell.top,
    left: shouldUseFixedNav ? fixedLeft : navTheme.shell.left,
    right: shouldUseFixedNav ? (editor || !isFullWidthNav ? "auto" : 0) : navTheme.shell.right,
    zIndex: isAlwaysMode ? (editor ? 28 : 120) : isStickyMode ? (editor ? 24 : 80) : navTheme.shell.zIndex,
    backdropFilter: stickyMode === "sticky-transparent" ? "blur(14px)" : navTheme.shell.backdropFilter,
    background:
      stickyMode === "sticky-transparent" && !scrolled
        ? "rgba(15,23,42,0.08)"
        : navTheme.shell.background,
    border:
      stickyMode === "sticky-transparent" && !scrolled
        ? "1px solid rgba(255,255,255,0.08)"
        : navTheme.shell.border,
    boxShadow:
      stickyMode !== "normal" && scrolled
        ? "0 18px 38px rgba(15,23,42,0.14)"
        : "none",
    isolation: stickyMode === "normal" ? navTheme.shell.isolation : "isolate",
    borderRadius: isFullWidthNav ? 0 : navTheme.shell.borderRadius,
    margin: shouldUseFixedNav ? 0 : (navFullWidth.margin ?? navTheme.shell.margin),
  };

  const menuWrapStyle = shouldUseMobileMenu
    ? {
        width: "100%",
        display: mobileOpen ? "grid" : "none",
        gap: 10,
        paddingTop: 10,
      }
    : navTheme.links;

  const renderNavSection = () => (
    <section ref={shellRef} data-website-nav-shell="true" style={asStyleObject(shellStyle)}>
      <div style={asStyleObject(navTheme.brandRow)}>
        {shouldShowBrandMark ? (
          <BrandMark
            brand={blockProps.brand}
            logoSrc={logoSrc}
            size={brandMarkSize}
            background={blockProps.buttonColor || blockProps.backgroundColor || "#0f172a"}
            color={blockProps.buttonTextColor || "#ffffff"}
            borderColor={blockProps.borderColor || "rgba(148,163,184,0.24)"}
            borderRadius={Math.max(8, Math.round(brandMarkSize * 0.24))}
          />
        ) : null}
        <p style={asStyleObject(navTheme.brand)}>{blockProps.brand || "Your Brand"}</p>
      </div>

      {shouldUseMobileMenu ? (
        <button
          type="button"
          style={{
            background: "transparent",
            border: `1px solid ${blockProps.borderColor || "rgba(148,163,184,0.24)"}`,
            color: blockProps.textColor || "#e2e8f0",
            borderRadius: 12,
            padding: "8px 10px",
            fontSize: 18,
            fontWeight: 600,
            minHeight: MIN_TAP_SIZE,
            minWidth: MIN_TAP_SIZE,
            cursor: "pointer",
          }}
          onClick={() => setMobileOpen((value) => !value)}
        >
          {mobileOpen ? "×" : "☰"}
        </button>
      ) : null}

      <div style={asStyleObject(menuWrapStyle)}>
        {visibleLinks.map((item, idx) => {
          const hasChildren = asArray(item?.children).length > 0;
          const isOpen = openDropdown === idx;
          const isCurrentPage = isCurrentNavLink(item, currentPageKey);
          const isHighlighted = shouldHighlightNavLink(item, currentPageKey);
          const linkState = { ...item, __isCurrentPage: isHighlighted };

          return (
            <div
              key={`${item?.label || "link"}-${idx}`}
              style={{ position: "relative", display: shouldUseMobileMenu ? "grid" : "block" }}
              onMouseEnter={() => {
                if (!isMobile && hasChildren) setOpenDropdown(idx);
              }}
              onMouseLeave={() => {
                if (!isMobile && hasChildren) setOpenDropdown(null);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <a
                  href={editor ? (item?.href || "#") : resolvePublishedNavHref(item, navigationContext)}
                  style={asStyleObject(buildNavLinkStyle(blockProps, navTheme, isHighlighted))}
                  onMouseEnter={(event) => applyNavHoverEffect(event, blockProps, isHighlighted)}
                  onMouseLeave={(event) => resetNavHoverEffect(event, blockProps, linkState)}
                >
                  {item?.label || "Link"}
                </a>
                {hasChildren ? (
                  <button
                    type="button"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: blockProps.textColor || "#e2e8f0",
                      cursor: "pointer",
                      padding: "6px 4px",
                      fontSize: MIN_TEXT_SIZE,
                      fontWeight: 600,
                      minHeight: MIN_TAP_SIZE,
                      minWidth: MIN_TAP_SIZE,
                    }}
                    onClick={() => setOpenDropdown((value) => (value === idx ? null : idx))}
                  >
                    ▾
                  </button>
                ) : null}
              </div>

              {hasChildren && isOpen ? (
                <div
                  style={{
                    position: isMobile ? "relative" : "absolute",
                    top: isMobile ? "auto" : "calc(100% + 8px)",
                    left: 0,
                    minWidth: isMobile ? "100%" : 220,
                    display: "grid",
                    gap: 6,
                    padding: 10,
                    borderRadius: 14,
                    background: blockProps.backgroundColor || "#0b1220",
                    border: `1px solid ${blockProps.borderColor || "rgba(148,163,184,0.24)"}`,
                    boxShadow: "0 20px 38px rgba(15,23,42,0.18)",
                    zIndex: 20,
                  }}
                >
                  {asArray(item.children).map((child, childIdx) => (
                    <a
                      key={`${child?.label || "child"}-${childIdx}`}
                      href={editor ? (child?.href || "#") : resolvePublishedNavHref(child, navigationContext)}
                      style={{
                        color: blockProps.textColor || "#e2e8f0",
                        textDecoration: "none",
                        fontSize: MIN_TEXT_SIZE,
                        fontWeight: 600,
                        padding: "8px 10px",
                        borderRadius: 10,
                        minHeight: MIN_TAP_SIZE,
                        minWidth: MIN_TAP_SIZE,
                        display: "inline-flex",
                        alignItems: "center",
                        background: "rgba(255,255,255,0.04)",
                      }}
                    >
                      {child?.label || "Sub link"}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {blockProps.ctaText ? (
        <a href={editor ? (blockProps.ctaLink || "#contact") : resolvePublishedNavHref({ href: blockProps.ctaLink || "#contact" }, navigationContext)} style={asStyleObject(navTheme.cta)}>
          {blockProps.ctaText}
        </a>
      ) : null}
    </section>
  );

  if (isAlwaysMode || isStickyMode) {
    return (
        <div
          ref={wrapperRef}
          style={{
            position: "relative",
            width: "100%",
            minHeight: shouldUseFixedNav ? (navHeight || undefined) : undefined,
            paddingTop: shouldUseFixedNav ? (navHeight || 0) : 0,
          }}
        >
        {renderNavSection()}
      </div>
    );
  }

  return renderNavSection();
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function snapToGrid(value, size = 24) {
  return Math.round(value / size) * size;
}

function shouldSkipToolbarBlur(event) {
  return !!event?.relatedTarget?.closest?.('[data-text-toolbar="true"]');
}

function htmlToPlainText(value) {
  const raw = String(value || "").replace(/\u200b/g, "");
  if (!/[<&]/.test(raw)) return raw;

  if (typeof document !== "undefined") {
    const container = document.createElement("div");
    container.innerHTML = raw;
    return (container.textContent || container.innerText || "").replace(/\u00a0/g, " ");
  }

  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderStatLabelHtml(value) {
  const raw = String(value ?? "");
  const looksLikePastedCodeBlock = /<(pre|code)\b/i.test(raw) || /code-block-viewer|cm-content|token-border-light/i.test(raw);
  return looksLikePastedCodeBlock ? escapeHtml(htmlToPlainText(raw).trim()) : asRichHtml(raw);
}

function LayeredImageStackBlock({ blockProps, compact, assets, editor = false, onChangeBlock, onUploadLayerImage, layoutWidth = null }) {
  const dragRef = React.useRef(null);
  const fileInputRefs = React.useRef({});
  const canvasRef = React.useRef(null);
  const latestPropsRef = React.useRef(blockProps || {});
  const latestLayersRef = React.useRef([]);
  const draftLayersRef = React.useRef(null);
  const [draftLayers, setDraftLayers] = React.useState(null);
  const [canvasGuides, setCanvasGuides] = React.useState({ showX: false, showY: false, active: false });
  const [canvasWidth, setCanvasWidth] = React.useState(0);
  const gridSize = compact ? 20 : 24;
  const snapEnabled = blockProps?.showGrid !== false && blockProps?.snapToGrid !== false;
  const fullWidthBlock = true;
  const selectedLayerIndex = Number.isInteger(blockProps?.selectedLayerIndex) ? blockProps.selectedLayerIndex : null;

  const layers = asArray(blockProps?.images)
    .map((layer, index) => ({
      id: layer?.id || `layer-${index}`,
      kind: layer?.kind || (layer?.content ? "text" : "image"),
      src: getAssetFromLibrary(assets, layer?.assetId)?.src || layer?.src || "",
      assetId: layer?.assetId || "",
      content: layer?.content || "Headline Text",
      x: Number(layer?.x ?? 40 + (index * 30)),
      y: Number(layer?.y ?? 40 + (index * 30)),
      width: Number(layer?.width ?? (layer?.kind === "text" ? 320 : 260)),
      height: Number(layer?.height ?? (layer?.kind === "text" ? 140 : 180)),
      rotation: Number(layer?.rotation ?? 0),
      radius: Number(layer?.radius ?? 18),
      zIndex: Number(layer?.zIndex ?? (index + 1)),
      fontSize: Number(layer?.fontSize ?? 40),
      fontWeight: String(layer?.fontWeight || "700"),
      textAlign: String(layer?.textAlign || "center"),
      verticalAlign: String(layer?.verticalAlign || "center"),
      textColor: (!layer?.background || layer?.background === "transparent") && (!layer?.textColor || layer?.textColor === "#ffffff") ? "#0f172a" : (layer?.textColor || "#0f172a"),
      background: typeof layer?.background === "string" && layer.background.trim() ? layer.background : "transparent",
    }))
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  const visibleLayers = draftLayers || layers;

  const bounds = visibleLayers.reduce((acc, layer) => {
    const x = Number(layer?.x || 0);
    const y = Number(layer?.y || 0);
    const width = Number(layer?.width || 0);
    const height = Number(layer?.height || 0);
    return {
      minX: Math.min(acc.minX, x),
      minY: Math.min(acc.minY, y),
      maxX: Math.max(acc.maxX, x + width),
      maxY: Math.max(acc.maxY, y + height),
    };
  }, { minX: 0, minY: 0, maxX: 900, maxY: 420 });
  const contentWidth = Math.max(320, bounds.maxX - bounds.minX);
  const contentHeight = Math.max(240, bounds.maxY - bounds.minY);
  const baseLayoutWidth = Math.max(720, Number(layoutWidth || blockProps?.baseLayoutWidth || DEFAULT_LAYOUT_WIDTH || 1100));
  const responsiveScale = 1;
  const previewOffsetX = 0;
  const previewOffsetY = 0;
  const stackHeight = editor
    ? (compact ? 320 : (blockProps?.minHeight || "72vh"))
    : Math.max(compact ? 320 : 420, Math.round((Math.max(bounds.maxY + 32, contentHeight + 32)) * responsiveScale));
  const stackFullWidth = fullWidthStyle({ ...blockProps, fullWidthBackground: fullWidthBlock }, compact, editor);
  const previewCanvasBackground = !editor && (!blockProps?.backgroundColor || blockProps.backgroundColor === "transparent")
    ? "linear-gradient(135deg, #09111f 0%, #0f172a 100%)"
    : (blockProps?.backgroundColor || "transparent");
  const stackContentFrame = sectionContentStyle({ ...blockProps, baseLayoutWidth }, compact, baseLayoutWidth);

  React.useEffect(() => {
    latestPropsRef.current = blockProps || {};
    if (!dragRef.current) latestLayersRef.current = layers;
  }, [blockProps, layers]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const node = canvasRef.current;
    if (!node) return undefined;

    const syncWidth = () => setCanvasWidth(node.clientWidth || 0);
    syncWidth();

    if (typeof window.ResizeObserver === "function") {
      const observer = new window.ResizeObserver(() => syncWidth());
      observer.observe(node);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", syncWidth);
    return () => window.removeEventListener("resize", syncWidth);
  }, [compact, editor, blockProps?.fullWidthBackground]);

  function applyLayerUpdate(nextLayers) {
    if (typeof onChangeBlock !== "function") return;
    onChangeBlock({
      ...latestPropsRef.current,
      images: nextLayers.map((layer, index) => ({ ...layer, zIndex: index + 1 })),
    });
  }

  function patchLayer(layerIndex, patch) {
    const next = latestLayersRef.current.map((layer, currentIndex) => (
      currentIndex === layerIndex ? { ...layer, ...patch } : layer
    ));
    applyLayerUpdate(next);
  }

  function moveLayer(layerIndex, direction) {
    const nextIndex = layerIndex + direction;
    if (nextIndex < 0 || nextIndex >= latestLayersRef.current.length) return;
    const next = [...latestLayersRef.current];
    const [moved] = next.splice(layerIndex, 1);
    next.splice(nextIndex, 0, moved);
    applyLayerUpdate(next);
  }

  function addImageLayer() {
    const next = [...latestLayersRef.current, createCanvasImageLayer(latestLayersRef.current.length)];
    applyLayerUpdate(next);
  }

  function addTextLayer(x = null, y = null) {
    const seed = latestLayersRef.current.length;
    const patch = {};
    if (Number.isFinite(x)) patch.x = x;
    if (Number.isFinite(y)) patch.y = y;
    const next = [...latestLayersRef.current, createCanvasTextLayer(seed, patch)];
    applyLayerUpdate(next);
  }

  function addLogoLayer() {
    const logo = assets?.logo;
    if (!logo?.src) return;
    const next = [
      ...latestLayersRef.current,
      createCanvasImageLayer(latestLayersRef.current.length, {
        src: logo.src,
        assetId: logo.id || "",
        width: 180,
        height: 90,
        rotation: 0,
        x: 460,
        y: 24,
      }),
    ];
    applyLayerUpdate(next);
  }

  React.useEffect(() => {
    if (!editor || typeof onChangeBlock !== "function") return undefined;

    const handleMove = (event) => {
      const current = dragRef.current;
      if (!current) return;

      const cs = current.canvasScale || 1;
      const dx = (event.clientX - current.startX) / cs;
      const dy = (event.clientY - current.startY) / cs;
      const currentLayers = current.baseLayers || latestLayersRef.current;

      const nextImages = currentLayers.map((layer, layerIndex) => {
        if (layerIndex !== current.layerIndex) return layer;

        if (current.mode === "resize") {
          let rawX = current.baseX;
          let rawY = current.baseY;
          let rawWidth = current.baseWidth;
          let rawHeight = current.baseHeight;

          if (current.handle === "nw") {
            rawX = current.baseX + dx;
            rawY = current.baseY + dy;
            rawWidth = current.baseWidth - dx;
            rawHeight = current.baseHeight - dy;
          } else if (current.handle === "ne") {
            rawY = current.baseY + dy;
            rawWidth = current.baseWidth + dx;
            rawHeight = current.baseHeight - dy;
          } else if (current.handle === "sw") {
            rawX = current.baseX + dx;
            rawWidth = current.baseWidth - dx;
            rawHeight = current.baseHeight + dy;
          } else {
            rawWidth = current.baseWidth + dx;
            rawHeight = current.baseHeight + dy;
          }

          rawWidth = clampValue(rawWidth, 96, current.rect.width);
          rawHeight = clampValue(rawHeight, 96, current.rect.height);
          rawX = clampValue(rawX, 0, Math.max(0, current.rect.width - rawWidth));
          rawY = clampValue(rawY, 0, Math.max(0, current.rect.height - rawHeight));
          rawWidth = snapEnabled ? snapToGrid(rawWidth, gridSize) : rawWidth;
          rawHeight = snapEnabled ? snapToGrid(rawHeight, gridSize) : rawHeight;
          rawX = snapEnabled ? snapToGrid(rawX, gridSize) : rawX;
          rawY = snapEnabled ? snapToGrid(rawY, gridSize) : rawY;
          const guideState = getPixelGuideState(rawX, rawY, rawWidth, rawHeight, current.rect);
          rawX = guideState.snappedX;
          rawY = guideState.snappedY;

          return {
            ...layer,
            x: rawX,
            y: rawY,
            width: rawWidth,
            height: rawHeight,
          };
        }

        let rawX = clampValue(current.baseX + dx, 0, Math.max(0, current.rect.width - current.baseWidth));
        let rawY = clampValue(current.baseY + dy, 0, Math.max(0, current.rect.height - current.baseHeight));
        rawX = snapEnabled ? snapToGrid(rawX, gridSize) : rawX;
        rawY = snapEnabled ? snapToGrid(rawY, gridSize) : rawY;
        const guideState = getPixelGuideState(rawX, rawY, current.baseWidth, current.baseHeight, current.rect);
        rawX = guideState.snappedX;
        rawY = guideState.snappedY;
        return {
          ...layer,
          x: rawX,
          y: rawY,
        };
      });

      const activeLayer = nextImages[current.layerIndex];
      const guideState = activeLayer
        ? getPixelGuideState(Number(activeLayer.x || 0), Number(activeLayer.y || 0), Number(activeLayer.width || 0), Number(activeLayer.height || 0), current.rect)
        : { showX: false, showY: false };
      latestLayersRef.current = nextImages;
      draftLayersRef.current = nextImages;
      setDraftLayers(nextImages);
      setCanvasGuides({ showX: guideState.showX, showY: guideState.showY, active: true });
    };

    const handleUp = () => {
      const nextLayers = draftLayersRef.current;
      dragRef.current = null;
      draftLayersRef.current = null;
      setDraftLayers(null);
      setCanvasGuides({ showX: false, showY: false, active: false });
      if (nextLayers) applyLayerUpdate(nextLayers);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [editor, onChangeBlock, gridSize, snapEnabled]);

  function startInteraction(event, layerIndex, mode = "move", handle = "se") {
    if (!editor || typeof onChangeBlock !== "function") return;
    if (latestPropsRef.current?.selectedLayerIndex !== layerIndex) {
      onChangeBlock({ ...latestPropsRef.current, selectedLayerIndex: layerIndex });
    }
    if (event.target?.closest?.('[data-layer-editor="true"]')) return;
    event.preventDefault();
    event.stopPropagation();

    const canvas = event.currentTarget.closest("[data-image-stack-canvas]");
    if (!canvas) return;

    const rectRaw = canvas.getBoundingClientRect();
    const canvasScaleVal = Number(event.target.closest('[data-canvas-scale]')?.dataset?.canvasScale || 1);
    const rect = { ...rectRaw, width: rectRaw.width / canvasScaleVal, height: rectRaw.height / canvasScaleVal };
    const layer = latestLayersRef.current[layerIndex];
    if (!layer) return;

    dragRef.current = {
      layerIndex,
      mode,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      rect,
      baseLayers: latestLayersRef.current,
      baseX: Number(layer.x || 0),
      baseY: Number(layer.y || 0),
      baseWidth: Number(layer.width || 200),
      baseHeight: Number(layer.height || 140),
      canvasScale: canvasScaleVal,
    };
  }

  async function handleFileChange(event, layerIndex) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (typeof onUploadLayerImage === "function") {
      await onUploadLayerImage(layerIndex, file);
    }
  }

  function justifyForVertical(align) {
    if (align === "top") return "flex-start";
    if (align === "bottom") return "flex-end";
    return "center";
  }

  function alignLayer(layerIndex, axis, alignment) {
    if (typeof window === "undefined") return;
    const canvas = document.querySelector("[data-image-stack-canvas]");
    const layer = latestLayersRef.current[layerIndex];
    if (!canvas || !layer) return;

    if (axis === "x") {
      const canvasWidth = canvas.clientWidth || 1200;
      let rawX = Number(layer.x || 0);
      if (alignment === "left") rawX = gridSize;
      if (alignment === "center") rawX = Math.max(0, (canvasWidth - Number(layer.width || 0)) / 2);
      if (alignment === "right") rawX = Math.max(0, canvasWidth - Number(layer.width || 0) - gridSize);
      patchLayer(layerIndex, {
        x: snapEnabled ? snapToGrid(rawX, gridSize) : rawX,
        textAlign: alignment,
      });
      return;
    }

    const canvasHeight = canvas.clientHeight || 560;
    let rawY = Number(layer.y || 0);
    if (alignment === "top") rawY = gridSize;
    if (alignment === "center") rawY = Math.max(0, (canvasHeight - Number(layer.height || 0)) / 2);
    if (alignment === "bottom") rawY = Math.max(0, canvasHeight - Number(layer.height || 0) - gridSize);
    patchLayer(layerIndex, {
      y: snapEnabled ? snapToGrid(rawY, gridSize) : rawY,
      verticalAlign: alignment,
    });
  }

  return (
    <section
      style={{
        width: "100%",
        maxWidth: "100%",
        padding: compact ? "18px 0" : "28px 0",
        margin: 0,
        background: previewCanvasBackground,
        border: "none",
        boxShadow: "none",
        ...stackFullWidth,
      }}
    >
      {editor && blockProps?.title ? <h2 style={{ ...sharedStyles.sectionTitle(compact), marginBottom: 12 }}>{blockProps.title}</h2> : null}
      <div
        style={{
          width: "100%",
          ...stackContentFrame,
          padding: compact ? "0 14px" : "0 24px",
          boxSizing: "border-box",
        }}
      >
        <div
          ref={canvasRef}
          data-image-stack-canvas
          onPointerDown={(event) => {
            if (!editor || typeof onChangeBlock !== "function") return;
            if (event.target === event.currentTarget && latestPropsRef.current?.selectedLayerIndex != null) {
              onChangeBlock({ ...latestPropsRef.current, selectedLayerIndex: null });
            }
          }}
          onDoubleClick={(event) => {
            if (!editor || event.target?.closest?.("[data-image-layer]")) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const nextX = clampValue(event.clientX - rect.left - 180, 0, Math.max(0, rect.width - 360));
            const nextY = clampValue(event.clientY - rect.top - 70, 0, Math.max(0, rect.height - 140));
            addTextLayer(nextX, nextY);
          }}
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "100%",
            minHeight: stackHeight,
            marginTop: 0,
            marginLeft: 0,
            marginRight: 0,
            overflow: "hidden",
            borderRadius: compact ? 16 : 20,
            border: editor ? "1px dashed rgba(125,211,252,0.42)" : "none",
            background: previewCanvasBackground,
            backgroundImage: blockProps?.showGrid !== false ? "linear-gradient(rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px)" : "none",
            backgroundSize: `${gridSize}px ${gridSize}px`,
          }}
        >
          {editor ? renderCanvasCenterGuides(canvasGuides) : null}
          {visibleLayers.map((layer, idx) => (
            <div
              key={layer.id || `${idx}`}
              data-image-layer={idx}
              data-layer-kind={layer.kind || "image"}
              onPointerDown={(event) => startInteraction(event, idx, "move")}
              onMouseDown={(event) => startInteraction(event, idx, "move")}
              onDoubleClick={() => {
                if (editor && layer.kind === "image") fileInputRefs.current[idx]?.click();
              }}
              style={{
                position: "absolute",
                left: Math.round((layer.x * responsiveScale) + previewOffsetX),
                top: Math.round((layer.y * responsiveScale) + previewOffsetY),
                width: Math.max(48, Math.round(layer.width * responsiveScale)),
                height: Math.max(48, Math.round(layer.height * responsiveScale)),
                zIndex: layer.zIndex,
                borderRadius: Math.max(8, Math.round(layer.radius * responsiveScale)),
                overflow: "hidden",
                cursor: editor ? "move" : "default",
                border: editor && selectedLayerIndex === idx ? (layer.kind === "text" ? "1px dashed rgba(125,211,252,0.9)" : "2px solid rgba(245,158,11,0.9)") : "none",
                boxShadow: (editor && selectedLayerIndex === idx) ? "0 0 0 2px rgba(255,255,255,0.18), 0 18px 32px rgba(15,23,42,0.18)" : (layer.kind === "text" && layer.background && layer.background !== "transparent" ? "0 18px 32px rgba(15,23,42,0.14)" : "none"),
                transform: `rotate(${layer.rotation}deg)`,
                ...(layer.kind === "text" ? textLayerBackgroundStyle(layer) : { background: "transparent" }),
                touchAction: "none",
                userSelect: "none",
              }}
            >
            {layer.kind === "text" ? (
              <>
                {editor && selectedLayerIndex === idx ? (
                  <div
                    data-layer-drag-handle="true"
                    onPointerDown={(event) => startInteraction(event, idx, "move")}
                    onMouseDown={(event) => startInteraction(event, idx, "move")}
                    style={{ position: "absolute", top: 6, left: 6, zIndex: 4, cursor: "move" }}
                  >
                    <span style={sharedStyles.editorChip}>Drag Text</span>
                  </div>
                ) : null}
                <div
                  data-layer-editor="true"
                  data-website-inline-editor="true"
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onPointerDown={(event) => {
                    if (editor && typeof onChangeBlock === "function" && latestPropsRef.current?.selectedLayerIndex !== idx) {
                      onChangeBlock({ ...latestPropsRef.current, selectedLayerIndex: idx });
                    }
                    event.stopPropagation();
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onBlur={(event) => {
                    if (shouldSkipToolbarBlur(event)) return;
                    patchLayer(idx, { content: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
                  }}
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: justifyForVertical(layer.verticalAlign),
                    alignItems: "stretch",
                    textAlign: layer.textAlign,
                    padding: editor ? "34px 12px 12px" : 12,
                    color: layer.textColor,
                    fontSize: compact ? Math.max(16, layer.fontSize - 6) : Math.max(16, Math.round(layer.fontSize * responsiveScale)),
                    fontWeight: layer.fontWeight,
                    lineHeight: 1.2,
                    outline: "none",
                    cursor: "text",
                  }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(layer.content || "Type text here") }}
                />
              </>
            ) : layer.src ? (
              <img src={layer.src} alt={`Layer ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#475569", fontWeight: 600, background: "linear-gradient(135deg,#e2e8f0,#f8fafc)", pointerEvents: "none" }}>
                Double-click to upload
              </div>
            )}


            {layer.kind === "image" ? (
              <input
                ref={(el) => {
                  fileInputRefs.current[idx] = el;
                }}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(event) => handleFileChange(event, idx)}
              />
            ) : null}

            {editor && selectedLayerIndex === idx ? [
              { key: "nw", left: 6, top: 6, cursor: "nwse-resize" },
              { key: "ne", right: 6, top: 6, cursor: "nesw-resize" },
              { key: "sw", left: 6, bottom: 6, cursor: "nesw-resize" },
              { key: "se", right: 6, bottom: 6, cursor: "nwse-resize" },
            ].map((handle) => (
              <div
                key={handle.key}
                data-resize-handle={handle.key}
                onPointerDown={(event) => startInteraction(event, idx, "resize", handle.key)}
                onMouseDown={(event) => startInteraction(event, idx, "resize", handle.key)}
                style={{
                  position: "absolute",
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background: layer.kind === "image" ? "#f59e0b" : "#0ea5e9",
                  border: "2px solid #fff",
                  boxShadow: "0 6px 16px rgba(15,23,42,0.24)",
                  touchAction: "none",
                  ...handle,
                }}
              />
            )) : null}

            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EditableImageBlock({ props, imageSrc, compact, editor = false, animationPreview = false, onChangeBlock }) {
  const resizeRef = React.useRef(null);
  const figureRef = React.useRef(null);
  const latestPropsRef = React.useRef(props || {});
  const [figureSize, setFigureSize] = React.useState({ width: 0, height: 0 });
  const [guides, setGuides] = React.useState({ showX: false, showY: false, active: false });
  const fullWidthProps = { ...props, fullWidthBackground: props?.fullWidthBackground !== false };
  const rawWidth = String(props?.width || "100%").trim().toLowerCase();
  const useFullWidth = fullWidthProps.fullWidthBackground || rawWidth === "100%" || rawWidth === "full" || rawWidth.includes("vw");
  const fullBleedImage = useFullWidth || String(props?.imageStyle || props?.fitMode || "").toLowerCase() === "bleed";
  const seamlessEdges = fullBleedImage && props?.seamlessEdges !== false;
  const seamlessBackground = props?.backgroundColor || props?.seamlessBackgroundColor || "transparent";
  const naturalFullWidthHeight = fullBleedImage && props?.autoHeight !== false;
  const widthPx = parseSizeValue(props?.width, compact ? 280 : 720);
  const heightPx = parseSizeValue(props?.height, compact ? 220 : 400);
  const effectiveWidth = Math.max(1, Math.round(figureSize.width || widthPx));
  const effectiveHeight = Math.max(1, Math.round(figureSize.height || heightPx));
  const showOverlayText = !!props?.showOverlayText || !!props?.headline || !!props?.subheadline;
  const overlayAlign = String(props?.overlayTextAlign || "center");
  const overlayJustify = overlayAlign === "left" ? "flex-start" : overlayAlign === "right" ? "flex-end" : "center";
  const overlayVertical = String(props?.overlayTextVerticalAlign || "center");
  const overlayTextColor = props?.overlayTextColor || props?.headlineColor || "#ffffff";
  const overlayBodyColor = props?.overlaySubheadlineColor || props?.textColor || "rgba(255,255,255,0.92)";
  const overlayBackground = props?.overlayTextBackground || "linear-gradient(180deg, rgba(15,23,42,0.18), rgba(15,23,42,0.42))";
  const overlayPad = compact ? 18 : 28;
  const overlayDefaultWidth = Math.min(Math.max(Math.round(effectiveWidth * (compact ? 0.52 : 0.36)), 240), compact ? 360 : 420);
  const overlayBoxWidth = Math.max(180, Math.min(effectiveWidth, Number(props?.overlayTextWidth || Math.min(effectiveWidth - (overlayPad * 2), overlayDefaultWidth)) || Math.min(effectiveWidth - (overlayPad * 2), overlayDefaultWidth)));
  const overlayEstimateHeight = props?.subheadline || editor ? (compact ? 120 : 170) : (compact ? 84 : 118);
  const overlayAvailableWidth = Math.max(0, effectiveWidth - overlayBoxWidth);
  const overlayAvailableHeight = Math.max(0, effectiveHeight - overlayEstimateHeight);
  const overlayStoredXRatio = Number(props?.overlayTextXRatio);
  const overlayStoredYRatio = Number(props?.overlayTextYRatio);
  const overlayDefaultX = overlayAlign === "left"
    ? overlayPad
    : overlayAlign === "right"
      ? Math.max(overlayPad, effectiveWidth - overlayPad - overlayBoxWidth)
      : Math.max(overlayPad, Math.round((effectiveWidth - overlayBoxWidth) / 2));
  const overlayDefaultY = overlayVertical === "top"
    ? overlayPad
    : overlayVertical === "bottom"
      ? Math.max(overlayPad, effectiveHeight - overlayPad - overlayEstimateHeight)
      : Math.max(overlayPad, Math.round((effectiveHeight - overlayEstimateHeight) / 2));
  const overlayX = Math.max(
    0,
    Math.min(
      Number.isFinite(overlayStoredXRatio)
        ? overlayStoredXRatio * overlayAvailableWidth
        : Number.isFinite(Number(props?.overlayTextX))
          ? Number(props.overlayTextX)
          : overlayDefaultX,
      overlayAvailableWidth,
    ),
  );
  const overlayY = Math.max(
    0,
    Math.min(
      Number.isFinite(overlayStoredYRatio)
        ? overlayStoredYRatio * overlayAvailableHeight
        : Number.isFinite(Number(props?.overlayTextY))
          ? Number(props.overlayTextY)
          : overlayDefaultY,
      overlayAvailableHeight,
    ),
  );

  React.useEffect(() => {
    latestPropsRef.current = props || {};
  }, [props]);

  React.useEffect(() => {
    const node = figureRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;

    const updateSize = () => {
      const rect = node.getBoundingClientRect?.();
      if (!rect) return;
      setFigureSize({ width: rect.width || 0, height: rect.height || 0 });
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(node);
    return () => observer.disconnect();
  }, [useFullWidth, widthPx, heightPx, imageSrc]);

  React.useEffect(() => {
    if (!editor || typeof onChangeBlock !== "function") return undefined;

    const handleMove = (event) => {
      const current = resizeRef.current;
      if (!current) return;
      const cs = current.canvasScale || 1;
      const dx = (event.clientX - current.startX) / cs;
      const dy = (event.clientY - current.startY) / cs;

      if (current.mode === "overlay-move") {
        const nextWidth = current.baseWidth > Math.round(effectiveWidth * 0.56)
          ? Math.max(220, Math.min(Math.round(effectiveWidth * 0.36), effectiveWidth - (overlayPad * 2)))
          : current.baseWidth;
        const nextAvailableWidth = Math.max(0, effectiveWidth - nextWidth);
        const nextAvailableHeight = Math.max(0, effectiveHeight - current.boxHeight);
        let nextX = Math.max(0, Math.min(current.baseX + dx, nextAvailableWidth));
        let nextY = Math.max(0, Math.min(current.baseY + dy, nextAvailableHeight));
        const centerThreshold = 12;
        const centerX = nextX + (nextWidth / 2);
        const centerY = nextY + (current.boxHeight / 2);
        const shouldSnapX = Math.abs(centerX - (effectiveWidth / 2)) <= centerThreshold;
        const shouldSnapY = Math.abs(centerY - (effectiveHeight / 2)) <= centerThreshold;

        if (shouldSnapX) {
          nextX = Math.max(0, Math.min((effectiveWidth - nextWidth) / 2, nextAvailableWidth));
        }

        if (shouldSnapY) {
          nextY = Math.max(0, Math.min((effectiveHeight - current.boxHeight) / 2, nextAvailableHeight));
        }

        setGuides({ showX: shouldSnapX, showY: shouldSnapY, active: true });
        onChangeBlock({
          ...latestPropsRef.current,
          showOverlayText: true,
          overlayTextWidth: nextWidth,
          overlayTextX: Math.round(nextX),
          overlayTextY: Math.round(nextY),
          overlayTextXRatio: nextAvailableWidth > 0 ? Number((nextX / nextAvailableWidth).toFixed(6)) : 0,
          overlayTextYRatio: nextAvailableHeight > 0 ? Number((nextY / nextAvailableHeight).toFixed(6)) : 0,
        });
        return;
      }

      if (current.mode === "overlay-resize") {
        const nextWidth = Math.max(180, Math.min(effectiveWidth - current.baseX, current.baseWidth + dx));
        const nextAvailableWidth = Math.max(0, effectiveWidth - nextWidth);
        const nextX = Math.max(0, Math.min(current.baseX, nextAvailableWidth));
        setGuides((prev) => ({ ...prev, active: true }));
        onChangeBlock({
          ...latestPropsRef.current,
          showOverlayText: true,
          overlayTextWidth: nextWidth,
          overlayTextX: Math.round(nextX),
          overlayTextXRatio: nextAvailableWidth > 0 ? Number((nextX / nextAvailableWidth).toFixed(6)) : 0,
        });
        return;
      }

      onChangeBlock({
        ...latestPropsRef.current,
        autoHeight: false,
        width: `${Math.max(160, current.baseWidth + dx)}px`,
        height: `${Math.max(120, current.baseHeight + dy)}px`,
      });
    };

    const handleUp = () => {
      resizeRef.current = null;
      setGuides({ showX: false, showY: false, active: false });
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [editor, onChangeBlock]);

  function startResize(event) {
    if (!editor || typeof onChangeBlock !== "function") return;
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = {
      mode: "image-resize",
      startX: event.clientX,
      startY: event.clientY,
      baseWidth: widthPx,
      baseHeight: heightPx,
      canvasScale: Number(event.target.closest('[data-canvas-scale]')?.dataset?.canvasScale || 1),
    };
  }

  function startOverlayMove(event) {
    if (!editor || typeof onChangeBlock !== "function") return;
    event.preventDefault();
    event.stopPropagation();
    setGuides((prev) => ({ ...prev, active: true }));
    resizeRef.current = {
      mode: "overlay-move",
      startX: event.clientX,
      startY: event.clientY,
      baseX: overlayX,
      baseY: overlayY,
      baseWidth: overlayBoxWidth,
      boxHeight: overlayEstimateHeight,
      canvasScale: Number(event.target.closest('[data-canvas-scale]')?.dataset?.canvasScale || 1),
    };
  }

  function startOverlayResize(event) {
    if (!editor || typeof onChangeBlock !== "function") return;
    event.preventDefault();
    event.stopPropagation();
    setGuides((prev) => ({ ...prev, active: true }));
    resizeRef.current = {
      mode: "overlay-resize",
      startX: event.clientX,
      startY: event.clientY,
      baseX: overlayX,
      baseY: overlayY,
      baseWidth: overlayBoxWidth,
      boxHeight: overlayEstimateHeight,
      canvasScale: Number(event.target.closest('[data-canvas-scale]')?.dataset?.canvasScale || 1),
    };
  }

  return (
    <section
      style={{
        ...fullWidthStyle(fullWidthProps, compact, editor),
        ...((!editor || animationPreview) ? getAnimationStyle(props?.sectionAnimation, props?.sectionAnimationDelay || 0, props?.sectionAnimationSpeed) : {}),
        padding: 0,
        marginTop: seamlessEdges ? -1 : 0,
        marginBottom: seamlessEdges ? -1 : 0,
        background: seamlessBackground,
        border: "none",
        boxShadow: "none",
        lineHeight: 0,
        fontSize: 0,
        overflow: "hidden",
        position: "relative",
        zIndex: seamlessEdges ? 1 : undefined,
      }}
    >
      <figure
        ref={figureRef}
        style={{
          ...sharedStyles.figure,
          position: "relative",
          width: useFullWidth ? "100%" : `${widthPx}px`,
          maxWidth: "100%",
          margin: 0,
          padding: 0,
          background: seamlessBackground,
          border: "none",
          boxShadow: "none",
          borderRadius: fullBleedImage ? 0 : sharedStyles.figure?.borderRadius,
          overflow: "hidden",
          lineHeight: 0,
          fontSize: 0,
        }}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={props.alt || "Image"}
            style={{
              ...sharedStyles.figureImage,
              width: "100%",
              height: naturalFullWidthHeight ? "auto" : `${heightPx}px`,
              maxHeight: "none",
              objectFit: naturalFullWidthHeight ? "contain" : (props?.objectFit || "cover"),
              objectPosition: props?.objectPosition || "center center",
              borderRadius: fullBleedImage ? 0 : sharedStyles.figureImage?.borderRadius,
              display: "block",
              verticalAlign: "top",
              margin: 0,
              padding: 0,
              border: 0,
              outline: "none",
            }}
          />
        ) : (
          <div style={{ ...sharedStyles.galleryPlaceholder, width: "100%", height: `${heightPx}px`, borderRadius: fullBleedImage ? 0 : 22, lineHeight: 1.2 }}>
            Upload or choose an image
          </div>
        )}
        {showOverlayText ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: fullBleedImage ? 0 : 22,
              pointerEvents: "none",
            }}
          >
            {editor ? renderOverlayGuides(guides) : null}
            <div
              style={{
                position: "absolute",
                left: overlayX,
                top: overlayY,
                width: overlayBoxWidth,
                maxWidth: `calc(100% - ${overlayPad * 2}px)`,
                textAlign: overlayAlign,
                padding: compact ? 14 : 18,
                borderRadius: 20,
                background: overlayBackground,
                boxShadow: editor ? "0 12px 28px rgba(15,23,42,0.22)" : "none",
                outline: editor ? "1px dashed rgba(255,255,255,0.38)" : "none",
                pointerEvents: "auto",
              }}
              onPointerDown={(event) => {
                if (!editor) return;
                if (event.target !== event.currentTarget) return;
                startOverlayMove(event);
              }}
              onMouseDown={(event) => {
                if (!editor) return;
                if (event.target !== event.currentTarget) return;
                startOverlayMove(event);
              }}
            >
              {editor ? (
                <div
                  onPointerDown={startOverlayMove}
                  onMouseDown={startOverlayMove}
                  style={{
                    position: "absolute",
                    left: 10,
                    right: 22,
                    top: -18,
                    height: 26,
                    borderRadius: 999,
                    border: "1px solid rgba(14,165,233,0.36)",
                    background: "rgba(255,255,255,0.97)",
                    color: "#0f3f73",
                    boxShadow: "0 10px 20px rgba(15,23,42,0.18)",
                    padding: "0 10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 16,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    cursor: "grab",
                    touchAction: "none",
                  }}
                >
                  <span>Move Text</span>
                  <span style={{ opacity: 0.72 }}>Drag Anywhere</span>
                </div>
              ) : null}
              <h2
                data-website-inline-editor="true"
                data-text-prop="headline"
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => {
                  if (!editor || typeof onChangeBlock !== "function") return;
                  onChangeBlock({ ...latestPropsRef.current, headline: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
                }}
                style={{
                  margin: 0,
                  color: overlayTextColor,
                  fontSize: compact ? 28 : (props?.headlineFontSize || 46),
                  lineHeight: 1.08,
                  fontWeight: Math.min(800, Number(props?.headlineFontWeight || 700) || 700),
                  fontFamily: props?.headlineFontFamily || "inherit",
                  ...((!editor || animationPreview) ? getAnimationStyle(props?.textAnimation, props?.textAnimationDelay || 0, props?.textAnimationSpeed) : {}),
                  outline: editor ? "1px dashed rgba(255,255,255,0.45)" : "none",
                  borderRadius: 10,
                  padding: editor ? "6px 8px" : 0,
                }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(props?.headline || "Add image headline") }}
              />
              {props?.subheadline || editor ? (
                <div
                  data-website-inline-editor="true"
                  data-text-prop="subheadline"
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    if (!editor || typeof onChangeBlock !== "function") return;
                    onChangeBlock({ ...latestPropsRef.current, subheadline: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
                  }}
                  style={{
                    marginTop: 10,
                    color: overlayBodyColor,
                    fontSize: compact ? 15 : (props?.subheadlineFontSize || 20),
                    lineHeight: 1.5,
                    fontWeight: Math.min(700, Number(props?.fontWeight || 400) || 400),
                    fontFamily: props?.fontFamily || props?.headlineFontFamily || "inherit",
                    ...((!editor || animationPreview) ? getAnimationStyle(props?.subheadlineAnimation, props?.subheadlineAnimationDelay || 0, props?.subheadlineAnimationSpeed) : {}),
                    outline: editor ? "1px dashed rgba(255,255,255,0.35)" : "none",
                    borderRadius: 10,
                    padding: editor ? "6px 8px" : 0,
                  }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(props?.subheadline || "Add supporting text") }}
                />
              ) : null}
              {editor ? (
                <>
                  <div
                    title="Resize text width"
                    aria-label="Resize text width"
                    onPointerDown={startOverlayResize}
                    onMouseDown={startOverlayResize}
                    style={{
                      position: "absolute",
                      top: 12,
                      right: -10,
                      bottom: 12,
                      width: 16,
                      borderRadius: 999,
                      background: "linear-gradient(180deg, #7dd3fc, #0ea5e9)",
                      border: "2px solid #ffffff",
                      boxShadow: "0 8px 18px rgba(14,165,233,0.3)",
                      cursor: "ew-resize",
                      touchAction: "none",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      right: 14,
                      bottom: -22,
                      borderRadius: 999,
                      border: "1px solid rgba(14,165,233,0.36)",
                      background: "rgba(255,255,255,0.97)",
                      color: "#0f3f73",
                      boxShadow: "0 10px 20px rgba(15,23,42,0.18)",
                      padding: "4px 10px",
                      fontSize: 16,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      pointerEvents: "none",
                    }}
                  >
                    Drag Right Edge
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
        {editor ? (
          <div style={{ position: "absolute", top: 10, left: 10, borderRadius: 999, background: "rgba(15,23,42,0.72)", color: "#fff", padding: "5px 9px", fontSize: 16, fontWeight: 600 }}>
            Resize handle enabled
          </div>
        ) : null}
        {editor ? (
          <div
            title="Drag to resize image"
            aria-label="Drag to resize image"
            data-resize-handle="image"
            onPointerDown={startResize}
            onMouseDown={startResize}
            style={{ position: "absolute", right: 10, bottom: props.caption ? 34 : 10, width: 18, height: 18, borderRadius: 999, background: "#0ea5e9", border: "2px solid #fff", cursor: "nwse-resize", boxShadow: "0 6px 16px rgba(14,165,233,0.35)" }}
          />
        ) : null}
        {props.caption ? (
          <figcaption
            data-website-inline-editor="true"
            contentEditable={editor}
            suppressContentEditableWarning
            onBlur={(event) => {
              if (!editor || typeof onChangeBlock !== "function") return;
              onChangeBlock({ ...latestPropsRef.current, caption: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
            }}
            style={{ ...sharedStyles.figureCaption, outline: editor ? "1px dashed rgba(14,165,233,0.45)" : "none", padding: editor ? "4px 6px" : 0, borderRadius: 8 }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(props.caption) }}
          />
        ) : null}
      </figure>
    </section>
  );
}

function getListMarker(style, index) {
  if (style === "number") return `${index + 1}.`;
  if (style === "disc") return "•";
  return "?";
}

function ColumnEditorCard({
  title,
  content,
  titleProp,
  contentProp,
  image,
  compact,
  editor,
  textColor,
  bodyTextColor,
  cardBackgroundColor,
  cardStyle,
  contentAlign,
  overlay,
  onSwap,
  sectionOrder,
  onReorderSection,
  onTitleChange,
  onContentChange,
  contentType,
  newsletterHeading,
  newsletterSubtitle,
  newsletterButtonText,
  newsletterButtonColor,
  newsletterButtonTextColor,
  onPatchNewsletter,
  imageHeight,
  onImageHeightChange,
  imageWidth,
  onImageWidthChange,
  newsletterImage,
  newsletterImageHeight,
  onNewsletterImageHeightChange,
  newsletterImageWidth,
  onNewsletterImageWidthChange,
  newsletterFields,
  subBlock,
  onRenderSubBlock,
  extraImages,
  onExtraImagesChange,
}) {
  const resolvedAlign = contentAlign || "left";
  const isNewsletter = contentType === "newsletter";
  const isBlock = false;
  const normalizedTitle = String(title || "").trim();
  const normalizedContent = String(content || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
  const [isImageHovered, setIsImageHovered] = React.useState(false);
  const [activeDrag, setActiveDrag] = React.useState(null);
  const imgContainerRef = React.useRef(null);
  const [isImageHoveredNL, setIsImageHoveredNL] = React.useState(false);
  const [activeDragNL, setActiveDragNL] = React.useState(null);
  const nlImgContainerRef = React.useRef(null);
  const normalizedExtraImages = Array.isArray(extraImages)
    ? extraImages
        .map((item) => (typeof item === "string" ? { src: item } : (item || {})))
        .filter((item) => editor || item.src)
    : [];
  const shouldShowEmptyTextPlaceholders = editor && !image && !normalizedExtraImages.length && !normalizedTitle && !normalizedContent;

  const startResizeNL = React.useCallback((e, dir) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startH = newsletterImageHeight || (nlImgContainerRef.current?.querySelector("img")?.offsetHeight || 180);
    const startW = newsletterImageWidth != null ? newsletterImageWidth : 100;
    const colW = nlImgContainerRef.current?.offsetWidth || 300;
    setActiveDragNL(dir);
    const onMove = (e2) => {
      const dx = e2.clientX - startX;
      const dy = e2.clientY - startY;
      if (dir.includes("s")) onNewsletterImageHeightChange?.(Math.max(40, Math.round(startH + dy)));
      if (dir.includes("n")) onNewsletterImageHeightChange?.(Math.max(40, Math.round(startH - dy)));
      if (dir.includes("e")) onNewsletterImageWidthChange?.(Math.round(Math.max(20, Math.min(100, startW + (dx / colW) * 100))));
      if (dir.includes("w")) onNewsletterImageWidthChange?.(Math.round(Math.max(20, Math.min(100, startW - (dx / colW) * 100))));
    };
    const onUp = () => {
      setActiveDragNL(null);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [newsletterImageHeight, newsletterImageWidth, onNewsletterImageHeightChange, onNewsletterImageWidthChange]);

  const startResize = React.useCallback((e, dir) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startH = imageHeight || (imgContainerRef.current?.querySelector("img")?.offsetHeight || 200);
    const startW = imageWidth != null ? imageWidth : 100;
    const colW = imgContainerRef.current?.offsetWidth || 300;
    setActiveDrag(dir);

    const onMove = (e2) => {
      const dx = e2.clientX - startX;
      const dy = e2.clientY - startY;
      if (dir.includes("s")) {
        onImageHeightChange?.(Math.max(40, Math.round(startH + dy)));
      }
      if (dir.includes("n")) {
        onImageHeightChange?.(Math.max(40, Math.round(startH - dy)));
      }
      if (dir.includes("e")) {
        const pct = Math.round(Math.max(20, Math.min(100, startW + (dx / colW) * 100)));
        onImageWidthChange?.(pct);
      }
      if (dir.includes("w")) {
        const pct = Math.round(Math.max(20, Math.min(100, startW - (dx / colW) * 100)));
        onImageWidthChange?.(pct);
      }
    };
    const onUp = () => {
      setActiveDrag(null);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [imageHeight, imageWidth, onImageHeightChange, onImageWidthChange]);

  const HANDLE_SIZE = 10;
  const HANDLE_BASE = {
    position: "absolute", width: HANDLE_SIZE, height: HANDLE_SIZE,
    background: "#fff", border: "2px solid #0ea5e9", borderRadius: 2,
    boxShadow: "0 1px 4px rgba(0,0,0,0.25)", zIndex: 10,
  };
  const handles = [
    { dir: "n",  style: { top: -HANDLE_SIZE/2, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" } },
    { dir: "s",  style: { bottom: -HANDLE_SIZE/2, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" } },
    { dir: "e",  style: { right: -HANDLE_SIZE/2, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } },
    { dir: "w",  style: { left: -HANDLE_SIZE/2, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } },
    { dir: "ne", style: { top: -HANDLE_SIZE/2, right: -HANDLE_SIZE/2, cursor: "nesw-resize" } },
    { dir: "nw", style: { top: -HANDLE_SIZE/2, left: -HANDLE_SIZE/2, cursor: "nwse-resize" } },
    { dir: "se", style: { bottom: -HANDLE_SIZE/2, right: -HANDLE_SIZE/2, cursor: "nwse-resize" } },
    { dir: "sw", style: { bottom: -HANDLE_SIZE/2, left: -HANDLE_SIZE/2, cursor: "nesw-resize" } },
  ];

  const nlBtnBg = newsletterButtonColor || "#2563eb";
  const nlBtnText = newsletterButtonTextColor || "#ffffff";

  const inlineEditStyle = (base) => ({
    ...base,
    outline: editor ? "1px dashed rgba(14,165,233,0.4)" : "none",
    borderRadius: 6,
    padding: editor ? "2px 4px" : 0,
  });

  return (
    <article style={{ borderRadius: 18, border: PREMIUM_BORDER, background: cardBackgroundColor || "#f8fafc", padding: isBlock ? 0 : compact ? 14 : 18, boxShadow: "0 10px 24px rgba(15,23,42,0.08)", textAlign: resolvedAlign, overflow: isBlock ? "hidden" : undefined, position: "relative", ...cardStyle }}>
      {overlay}
      {editor && onSwap ? (
        <button
          type="button"
          title="Swap columns"
          aria-label="Swap columns"
          onClick={(e) => { e.stopPropagation(); onSwap(); }}
          style={{ position: "absolute", top: 8, right: 8, zIndex: 20, background: "rgba(14,165,233,0.92)", border: "none", borderRadius: 8, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", padding: "4px 10px", boxShadow: "0 2px 8px rgba(14,165,233,0.4)", lineHeight: 1 }}
        >×</button>
      ) : null}
      <div style={{ position: "relative", zIndex: 1 }}>
      {isBlock ? (
        subBlock && onRenderSubBlock ? (
          onRenderSubBlock(subBlock)
        ) : (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: 14, border: "2px dashed rgba(148,163,184,0.3)", borderRadius: 12, margin: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
            Drag a block onto this column to embed it here
          </div>
        )
      ) : isNewsletter ? (
        <>
          {(newsletterImage || editor) ? (
            <div
              ref={nlImgContainerRef}
              onMouseEnter={() => editor && setIsImageHoveredNL(true)}
              onMouseLeave={() => { if (!activeDragNL) setIsImageHoveredNL(false); }}
              style={{ position: "relative", marginBottom: 12, display: "inline-block", width: newsletterImageWidth != null ? `${newsletterImageWidth}%` : "100%" }}
            >
              {newsletterImage ? (
                <img
                  src={newsletterImage}
                  alt="Newsletter image"
                  draggable={false}
                  style={{ width: "100%", height: newsletterImageHeight ? `${newsletterImageHeight}px` : undefined, aspectRatio: newsletterImageHeight ? undefined : "16 / 9", objectFit: "cover", borderRadius: 12, display: "block", userSelect: "none", pointerEvents: editor ? "none" : undefined }}
                />
              ) : (
                editor ? <div style={{ ...sharedStyles.galleryPlaceholder, borderRadius: 12, marginBottom: 0, minHeight: 80, fontSize: 16, opacity: 0.6 }}>Upload image above form</div> : null
              )}
              {editor && newsletterImage && (isImageHoveredNL || activeDragNL) && (
                <div style={{ position: "absolute", inset: 0, border: "2px solid #0ea5e9", borderRadius: 12, pointerEvents: "none" }} />
              )}
              {editor && newsletterImage && (isImageHoveredNL || activeDragNL) && handles.map(({ dir, style }) => (
                <div key={dir} onMouseDown={(e) => startResizeNL(e, dir)} style={{ ...HANDLE_BASE, ...style }} />
              ))}
            </div>
          ) : null}
          <h3
            contentEditable={editor} suppressContentEditableWarning
            onBlur={(e) => onPatchNewsletter?.({ newsletterHeading: e.currentTarget.textContent })}
            style={inlineEditStyle({ margin: 0, color: textColor || "#0f172a", fontSize: compact ? 17 : 20, fontWeight: 600 })}
          >{newsletterHeading || (editor ? "Newsletter Heading" : "Stay Updated")}</h3>
          {(newsletterSubtitle || editor) ? (
            <p
              contentEditable={editor} suppressContentEditableWarning
              onBlur={(e) => onPatchNewsletter?.({ newsletterSubtitle: e.currentTarget.textContent })}
              style={inlineEditStyle({ margin: "6px 0 0", color: bodyTextColor || "#475569", fontSize: compact ? 13 : 14, lineHeight: 1.5 })}
            >{newsletterSubtitle || (editor ? "Your subtitle here." : "")}</p>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {(newsletterFields && newsletterFields.length > 0 ? newsletterFields : [{ type: "email", placeholder: "Email address" }]).map((field, fi) => (
              editor ? (
                <div key={fi} style={{ borderRadius: 10, minHeight: 40, border: "1px solid #cbd5e1", background: "#ffffff", display: "flex", alignItems: "center", paddingLeft: 12, color: "#94a3b8", fontSize: 16 }}>
                  {field.placeholder || field.label || field.type}
                </div>
              ) : String(field?.type || "").toLowerCase() === "textarea" ? (
                <textarea
                  key={fi}
                  name={field?.name || `newsletter-field-${fi}`}
                  placeholder={field?.placeholder || field?.label || "Enter details"}
                  required={!!field?.required}
                  rows={4}
                  style={{ borderRadius: 10, minHeight: 108, border: "1px solid #cbd5e1", background: "#ffffff", display: "block", width: "100%", padding: "12px", color: "#0f172a", fontSize: 16, font: "inherit", boxSizing: "border-box", resize: "vertical" }}
                />
              ) : (
                <input
                  key={fi}
                  type={String(field?.type || "text").toLowerCase()}
                  name={field?.name || `newsletter-field-${fi}`}
                  placeholder={field?.placeholder || field?.label || "Enter details"}
                  required={!!field?.required}
                  style={{ borderRadius: 10, minHeight: 40, border: "1px solid #cbd5e1", background: "#ffffff", display: "block", width: "100%", padding: "0 12px", color: "#0f172a", fontSize: 16, font: "inherit", boxSizing: "border-box" }}
                />
              )
            ))}
            {editor ? (
              <div
                style={{ background: nlBtnBg, color: nlBtnText, border: "none", borderRadius: 10, padding: "0 12px", minHeight: 40, fontWeight: 600, fontSize: 16, cursor: "text", whiteSpace: "nowrap", alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <div
                  data-website-inline-editor="true"
                  data-text-prop="newsletterButtonText"
                  contentEditable
                  suppressContentEditableWarning
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === " ") {
                      event.preventDefault();
                      try {
                        document.execCommand("insertText", false, " ");
                      } catch {}
                    }
                  }}
                  onBlur={(e) => onPatchNewsletter?.({ newsletterButtonText: e.currentTarget.textContent })}
                  style={{
                    outline: "1px dashed rgba(255,255,255,0.45)",
                    borderRadius: 6,
                    padding: "2px 4px",
                    minWidth: 36,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {newsletterButtonText || "Subscribe"}
                </div>
              </div>
            ) : (
              <button type="button" style={{ background: nlBtnBg, color: nlBtnText, border: "none", borderRadius: 10, padding: "0 12px", minHeight: 40, fontWeight: 600, fontSize: 16, cursor: "pointer", whiteSpace: "nowrap", alignSelf: "stretch" }}>
                {newsletterButtonText || "Subscribe"}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {(function renderSections() {
            const order = Array.isArray(sectionOrder) ? sectionOrder : ["image", "title", "content"];
            const moveSection = (idx, dir) => {
              if (!onReorderSection) return;
              const next = [...order];
              const target = idx + dir;
              if (target < 0 || target >= next.length) return;
              [next[idx], next[target]] = [next[target], next[idx]];
              onReorderSection(next);
            };
            const sectionNodes = {
              image: ((image || normalizedExtraImages.length) ? (
                <div style={{ display: "grid", gap: 0, justifyItems: resolvedAlign === "center" ? "center" : resolvedAlign === "right" ? "end" : "start" }}>
                  {image ? (
                    <div
                      ref={imgContainerRef}
                      onMouseEnter={() => editor && setIsImageHovered(true)}
                      onMouseLeave={() => { if (!activeDrag) setIsImageHovered(false); }}
                      style={{ position: "relative", display: "inline-block", width: imageWidth != null ? `${imageWidth}%` : "100%" }}
                    >
                      <img
                        src={image}
                        alt={title || "Column image"}
                        draggable={false}
                        style={{ width: "100%", height: imageHeight ? `${imageHeight}px` : undefined, aspectRatio: imageHeight ? undefined : "16 / 10", objectFit: "cover", borderRadius: 14, display: "block", userSelect: "none", pointerEvents: editor ? "none" : undefined }}
                      />
                      {editor && (isImageHovered || activeDrag) && (
                        <div style={{ position: "absolute", inset: 0, border: "2px solid #0ea5e9", borderRadius: 14, pointerEvents: "none" }} />
                      )}
                      {editor && (isImageHovered || activeDrag) && handles.map(({ dir, style }) => (
                        <div key={dir} onMouseDown={(e) => startResize(e, dir)} style={{ ...HANDLE_BASE, ...style }} />
                      ))}
                    </div>
                  ) : null}
                  {normalizedExtraImages.map((extraImage, extraImageIndex) => {
                    const gap = Number.isFinite(Number(extraImage.gap)) ? Number(extraImage.gap) : 8;
                    const height = Number(extraImage.height) || undefined;
                    return extraImage.src ? (
                      <img
                        key={`${extraImage.src}-${extraImageIndex}`}
                        src={extraImage.src}
                        alt={extraImage.alt || title || "Column image"}
                        draggable={false}
                        style={{ width: "100%", height: height ? `${height}px` : undefined, aspectRatio: height ? undefined : "16 / 10", objectFit: "cover", borderRadius: 14, display: "block", marginTop: gap, userSelect: "none", pointerEvents: editor ? "none" : undefined }}
                      />
                    ) : editor ? (
                      <div key={`empty-extra-image-${extraImageIndex}`} style={{ ...sharedStyles.galleryPlaceholder, width: "100%", minHeight: height || 120, borderRadius: 14, marginTop: gap, fontSize: 14 }}>
                        Select image #{extraImageIndex + 2}
                      </div>
                    ) : null;
                  })}
                </div>
              ) : null),
              title: (normalizedTitle || shouldShowEmptyTextPlaceholders ? (
                <h3
                  data-website-inline-editor="true"
                  data-text-prop={titleProp}
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => onTitleChange?.(cleanInlineEditorHtml(event.currentTarget.innerHTML))}
                  style={{ margin: 0, color: textColor || "#0f172a", fontSize: compact ? 18 : 22, fontWeight: 600, textAlign: resolvedAlign, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0, minHeight: editor && !normalizedTitle ? 32 : undefined }}
                  dangerouslySetInnerHTML={{ __html: normalizedTitle ? asRichHtml(title) : "Column title" }}
                />
              ) : null),
              content: (normalizedContent || shouldShowEmptyTextPlaceholders ? (
                <div
                  data-website-inline-editor="true"
                  data-text-prop={contentProp}
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => onContentChange?.(event.currentTarget.innerHTML)}
                  style={{ color: bodyTextColor || textColor || "#334155", fontSize: compact ? 14 : 16, lineHeight: 1.7, textAlign: resolvedAlign, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "6px 8px" : 0, minHeight: editor && !normalizedContent ? 40 : undefined }}
                  dangerouslySetInnerHTML={{ __html: normalizedContent ? asRichHtml(content) : "Column content" }}
                />
              ) : null),
            };
            return order.map((key, idx) => {
              const node = sectionNodes[key];
              if (!node) return null;
              return (
                <div key={key} style={{ position: "relative", marginBottom: 12 }}>
                  {editor && onReorderSection ? (
                    <div style={{ position: "absolute", top: 4, right: 4, zIndex: 20, display: "flex", flexDirection: "column", gap: 2 }}>
                      <button type="button" onClick={(e) => { e.stopPropagation(); moveSection(idx, -1); }} disabled={idx === 0} style={{ background: idx === 0 ? "rgba(148,163,184,0.3)" : "rgba(14,165,233,0.85)", border: "none", borderRadius: 5, color: "#fff", fontSize: 12, fontWeight: 700, cursor: idx === 0 ? "default" : "pointer", padding: "1px 6px", lineHeight: 1.4 }}>×</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); moveSection(idx, 1); }} disabled={idx === order.length - 1} style={{ background: idx === order.length - 1 ? "rgba(148,163,184,0.3)" : "rgba(14,165,233,0.85)", border: "none", borderRadius: 5, color: "#fff", fontSize: 12, fontWeight: 700, cursor: idx === order.length - 1 ? "default" : "pointer", padding: "1px 6px", lineHeight: 1.4 }}>×</button>
                    </div>
                  ) : null}
                  {node}
                </div>
              );
            });
          })()}
        </>
      )}
      </div>
    </article>
  );
}

function resolveSplitFaqBlockProps(props = {}) {
  return {
    ...(props.faqBlock || {}),
    items: asArray(props.faqBlock?.items || props.items).map((item, idx) => {
      const question = item?.question || item?.heading || item?.q || `Question ${idx + 1}`;
      const answer = item?.answer || item?.content || item?.a || "Answer";
      return {
        ...item,
        id: item?.id || `split-faq-item-${idx}`,
        question,
        answer,
        heading: question,
        content: answer,
      };
    }),
    faqStartCollapsed: props.faqBlock?.faqStartCollapsed ?? props.faqStartCollapsed,
    faqAllowMultipleOpen: props.faqBlock?.faqAllowMultipleOpen ?? props.faqAllowMultipleOpen,
    itemBackgroundColor: props.faqBlock?.itemBackgroundColor ?? props.itemBackgroundColor,
    itemBorderColor: props.faqBlock?.itemBorderColor ?? props.itemBorderColor,
    arrowBackgroundColor: props.faqBlock?.arrowBackgroundColor ?? props.arrowBackgroundColor,
    chevronColor: props.faqBlock?.chevronColor ?? props.chevronColor,
    questionColor: props.faqBlock?.questionColor ?? props.questionColor,
    answerColor: props.faqBlock?.answerColor ?? props.answerColor,
    questionFontWeight: props.faqBlock?.questionFontWeight ?? props.questionFontWeight,
    questionFontSize: props.faqBlock?.questionFontSize ?? props.questionFontSize,
    answerFontSize: props.faqBlock?.answerFontSize ?? props.answerFontSize,
    questionLineHeight: props.faqBlock?.questionLineHeight ?? props.questionLineHeight,
    answerLineHeight: props.faqBlock?.answerLineHeight ?? props.answerLineHeight,
    faqVariant: props.faqBlock?.faqVariant ?? props.faqVariant ?? "source-split",
    faqAnimation: props.faqBlock?.faqAnimation ?? props.faqAnimation ?? "fade-up",
    faqAnimationDelay: props.faqBlock?.faqAnimationDelay ?? props.faqAnimationDelay ?? 0.18,
    faqAnimationSpeed: props.faqBlock?.faqAnimationSpeed ?? props.faqAnimationSpeed ?? 0.9,
    sectionAnimation: props.faqBlock?.sectionAnimation ?? "fade-up",
    sectionAnimationDelay: props.faqBlock?.sectionAnimationDelay ?? 0.12,
    sectionAnimationSpeed: props.faqBlock?.sectionAnimationSpeed ?? 0.9,
    faqPanelBackgroundColor: props.faqBlock?.faqPanelBackgroundColor ?? props.faqPanelBackgroundColor,
    faqPanelBorderColor: props.faqBlock?.faqPanelBorderColor ?? props.faqPanelBorderColor,
    faqMaxWidth: props.faqBlock?.faqMaxWidth ?? props.faqMaxWidth,
  };
}

function resolveSplitHeadlineBlockProps(props = {}) {
  return {
    ...(props.headlineBlock || {}),
    content: props.headlineBlock?.content ?? props.headline ?? "",
    animation: props.headlineBlock?.animation ?? props.textAnimation ?? "fade-up",
    animationDelay: props.headlineBlock?.animationDelay ?? props.textAnimationDelay ?? 0,
    animationSpeed: props.headlineBlock?.animationSpeed ?? props.textAnimationSpeed ?? 0.8,
    fontSize: props.headlineBlock?.fontSize ?? props.headlineFontSize ?? 48,
    lineHeight: props.headlineBlock?.lineHeight ?? props.headlineLineHeight ?? 1.2,
    fontFamily: props.headlineBlock?.fontFamily ?? props.headlineFontFamily ?? "Poppins, sans-serif",
    fontWeight: props.headlineBlock?.fontWeight ?? props.headlineFontWeight ?? "400",
    color: props.headlineBlock?.color ?? props.headlineColor ?? "#61ce70",
    alignment: props.headlineBlock?.alignment ?? props.headlineAlignment ?? "left",
  };
}

function resolveSplitBodyBlockProps(props = {}) {
  return {
    ...(props.bodyBlock || {}),
    content: props.bodyBlock?.content ?? props.subheadline ?? "",
    animation: props.bodyBlock?.animation ?? props.subheadlineAnimation ?? "fade-in",
    animationDelay: props.bodyBlock?.animationDelay ?? props.subheadlineAnimationDelay ?? 0.12,
    animationSpeed: props.bodyBlock?.animationSpeed ?? props.subheadlineAnimationSpeed ?? 0.9,
    fontSize: props.bodyBlock?.fontSize ?? props.subheadlineFontSize ?? props.textFontSize ?? 18,
    lineHeight: props.bodyBlock?.lineHeight ?? props.subheadlineLineHeight ?? props.textLineHeight ?? 1.6,
    fontFamily: props.bodyBlock?.fontFamily ?? props.fontFamily ?? "Arial",
    fontWeight: props.bodyBlock?.fontWeight ?? props.fontWeight ?? "400",
    color: props.bodyBlock?.color ?? props.textColor ?? "#bdbcbf",
    alignment: props.bodyBlock?.alignment ?? props.alignment ?? "left",
  };
}

function SplitFaqBlock({ props, compact, editor = false, onChangeBlock, sectionAnimationStyle, assets, layoutWidth = null }) {
  const faqBlockProps = resolveSplitFaqBlockProps(props);
  const headlineBlockProps = resolveSplitHeadlineBlockProps(props);
  const bodyBlockProps = resolveSplitBodyBlockProps(props);
  const items = faqBlockProps.items;
  const splitBackgroundImage = resolveAssetField(props, "backgroundImage", assets);
  const [viewportWidth, setViewportWidth] = React.useState(() => (typeof window !== "undefined" ? window.innerWidth : 1440));
  const [openItems, setOpenItems] = React.useState(() => {
    if (faqBlockProps.faqStartCollapsed) return [];
    return items.length ? [0] : [];
  });
  const allowMultipleOpen = !!faqBlockProps.faqAllowMultipleOpen;
  const isTabletLike = !compact && viewportWidth <= 1100;
  const shouldRunAnimations = !editor;
  const splitParallaxEnabled = !!splitBackgroundImage && !!props.enableParallax;
  const splitParallaxActive = splitParallaxEnabled && !compact;
  const splitContentWidth = Math.max(320, Number(props.blockMaxWidth || layoutWidth || props.baseLayoutWidth || DEFAULT_LAYOUT_WIDTH));
  const contentPanelPadX = compact
    ? 20
    : isTabletLike
      ? 40
      : Math.min(120, Math.max(40, Math.round(splitContentWidth * 0.08)));

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(() => {
    if (!items.length) {
      setOpenItems([]);
      return;
    }
    setOpenItems((current) => {
      const next = current.filter((idx) => idx >= 0 && idx < items.length);
      if (next.length) return next;
      return faqBlockProps.faqStartCollapsed ? [] : [0];
    });
  }, [items.length, faqBlockProps.faqStartCollapsed]);

  function toggleItem(itemIndex) {
    setOpenItems((current) => {
      const isOpen = current.includes(itemIndex);
      if (allowMultipleOpen) {
        return isOpen ? current.filter((idx) => idx !== itemIndex) : [...current, itemIndex];
      }
      if (isOpen) return [];
      return [itemIndex];
    });
  }

  function patchItem(itemIndex, patch) {
    if (!editor || typeof onChangeBlock !== "function") return;
    const nextItems = items.map((item, currentIndex) => {
      if (currentIndex !== itemIndex) return item;
      const nextQuestion = patch.question ?? item.question;
      const nextAnswer = patch.answer ?? item.answer;
      return {
        ...item,
        question: nextQuestion,
        heading: nextQuestion,
        answer: nextAnswer,
        content: nextAnswer,
      };
    });
    onChangeBlock({
      ...props,
      faqBlock: {
        ...(props.faqBlock || {}),
        items: nextItems,
      },
    });
  }

  const splitRatioMap = {
    "33-67": "1fr 2fr",
    "40-60": "2fr 3fr",
    "43-57": "434fr 563fr",
    "50-50": "1fr 1fr",
    "45-55": "0.9fr 1.1fr",
    "55-45": "1.1fr 0.9fr",
    "57-43": "1.325fr 1fr",
    "60-40": "3fr 2fr",
    "67-33": "2fr 1fr",
  };
  const splitLeftFractionMap = {
    "33-67": 1 / 3,
    "40-60": 0.4,
    "43-57": 434 / 997,
    "50-50": 0.5,
    "45-55": 0.45,
    "55-45": 0.55,
    "57-43": 0.57,
    "60-40": 0.6,
    "67-33": 2 / 3,
  };
  const splitLeftFraction = splitLeftFractionMap[props.splitLayout] || 0.5;
  const splitFixedBackgroundOffset = Math.round((splitLeftFraction - 1) * splitContentWidth * 0.5);
  const splitFixedBackgroundX = `calc(50% + ${splitFixedBackgroundOffset}px)`;
  const splitBackgroundPositionY = (() => {
    const tokens = String(props.backgroundPosition || "center center").trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return "center";
    if (tokens[0] === "top" || tokens[0] === "bottom") return tokens[0];
    return tokens[1] || "center";
  })();
  const splitIsFullWidth = props.fullWidthBackground !== false;
  const sectionSurface = {
    position: "relative",
    width: "100%",
    ...(splitIsFullWidth
      ? { maxWidth: "100%", marginLeft: 0, marginRight: 0 }
      : { maxWidth: `${splitContentWidth}px`, marginLeft: "auto", marginRight: "auto" }),
    boxSizing: "border-box",
    borderRadius: editor ? (compact ? 12 : 18) : undefined,
    background: props.sectionBackgroundColor || "#000000",
    boxShadow: "none",
    border: "none",
    padding: 0,
    // CSS transforms on ancestors interfere with section-aware parallax measurement — skip when parallax is active.
    ...(splitParallaxActive ? {} : sectionAnimationStyle),
  };
  const hasLeftPanelAnim = !editor && !!props.leftPanelAnimation && props.leftPanelAnimation !== "none";
  const hasRightPanelAnim = !editor && !!props.rightPanelAnimation && props.rightPanelAnimation !== "none";
  const panelShell = {
    display: "grid",
    gridTemplateColumns: compact ? "1fr" : (splitRatioMap[props.splitLayout] || "1fr 1fr"),
    width: "100%",
    maxWidth: `${splitContentWidth}px`,
    marginLeft: "auto",
    marginRight: "auto",
    boxSizing: "border-box",
    minHeight: compact ? undefined : props.minHeight || "760px",
    borderRadius: 0,
    overflow: (hasLeftPanelAnim || hasRightPanelAnim) ? "visible" : "hidden",
    alignItems: "stretch",
    background: props.sectionBackgroundColor || "#000000",
    border: "none",
    boxShadow: "none",
  };
  const textPanelOverlap = !compact ? Number(props.textPanelOverlap || 0) : 0;
  const mediaPanelStyle = splitBackgroundImage
    ? {
        position: "relative",
        minWidth: 0,
        overflow: "hidden",
        zIndex: textPanelOverlap > 0 ? 1 : undefined,
        backgroundImage: `url(${splitBackgroundImage})`,
        backgroundPosition: splitParallaxActive && !editor
          ? `${splitFixedBackgroundX} ${splitBackgroundPositionY}`
          : (props.backgroundPosition || "center center"),
        backgroundSize: props.backgroundSize || "cover",
        backgroundRepeat: props.backgroundRepeat || "no-repeat",
        backgroundAttachment: splitParallaxActive ? "fixed" : "scroll",
        backgroundColor: props.backgroundColor || "#0f172a",
      }
    : {
        position: "relative",
        minWidth: 0,
        overflow: "hidden",
        zIndex: textPanelOverlap > 0 ? 1 : undefined,
        minHeight: compact ? 122 : undefined,
        background: props.backgroundColor || "#0f172a",
      };
  const contentPanelStyle = {
    position: "relative",
    minWidth: 0,
    maxWidth: "100%",
    zIndex: textPanelOverlap > 0 ? 2 : undefined,
    marginLeft: textPanelOverlap > 0 ? `-${textPanelOverlap}%` : undefined,
    background: props.contentPanelBackgroundColor || "transparent",
    padding: compact ? "44px 20px 56px" : `115px ${contentPanelPadX}px`,
    display: "grid",
    alignContent: "start",
    gap: compact ? 16 : 20,
    boxSizing: "border-box",
    overflowWrap: "anywhere",
  };
  const faqWrapStyle = {
    width: "100%",
    maxWidth: `${compact ? 312 : Math.max(280, Number(faqBlockProps.faqMaxWidth || 720))}px`,
  };
  const faqSurfaceStyle = {
    width: "100%",
    borderRadius: compact ? 18 : 24,
    padding: compact ? "14px" : "18px",
    background: faqBlockProps.faqPanelBackgroundColor || "rgba(3, 18, 28, 0.26)",
    border: `1px solid ${faqBlockProps.faqPanelBorderColor || faqBlockProps.itemBorderColor || "rgba(0, 66, 96, 0.39)"}`,
    boxShadow: "0 18px 38px rgba(0,0,0,0.18)",
  };

  return (
    <ScrollReveal
      as="section"
      animationName={splitParallaxActive ? "" : (props.sectionAnimation || "fade-up")}
      delay={props.sectionAnimationDelay || 0.06}
      speed={props.sectionAnimationSpeed}
      disabled={editor || splitParallaxActive}
      style={asStyleObject(sectionSurface)}
    >
      <div style={asStyleObject(panelShell)}>
          <ScrollReveal
            as="div"
            animationName={splitParallaxActive ? "" : (props.leftPanelAnimation || "none")}
            delay={Number(props.leftPanelAnimationDelay ?? 0)}
            speed={props.leftPanelAnimationSpeed}
            disabled={editor || splitParallaxActive}
            style={mediaPanelStyle}
          >
            {!splitBackgroundImage && editor ? (
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 24, color: "rgba(255,255,255,0.9)", textAlign: "center", fontWeight: 600, letterSpacing: "0.02em" }}>
                Upload a background image
              </div>
            ) : null}
            {splitBackgroundImage && Number(props.imageOverlayOpacity || 0) > 0 ? (
              <div style={{ position: "absolute", inset: 0, background: props.imageOverlayColor || "#000000", opacity: Number(props.imageOverlayOpacity) / 100, pointerEvents: "none", zIndex: 2 }} />
            ) : null}
            {!!props.headlineOverImage ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: props.headlineOverImageAlign || "flex-end", justifyContent: "flex-start", padding: compact ? "24px 20px" : "48px 56px", zIndex: 3, pointerEvents: editor ? "auto" : "none" }}>
                <h2
                  data-website-inline-editor="true"
                  data-text-prop="headlineBlock.content"
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    if (!editor || typeof onChangeBlock !== "function") return;
                    const content = cleanInlineEditorHtml(event.currentTarget.innerHTML);
                    onChangeBlock({ ...props, headline: content, headlineBlock: { ...(props.headlineBlock || {}), content } });
                  }}
                  style={{
                    margin: 0,
                    fontSize: compact ? Math.max(28, Math.min(40, Number(headlineBlockProps.fontSize || 48))) : Math.max(32, Number(headlineBlockProps.fontSize || 48)),
                    lineHeight: Number(headlineBlockProps.lineHeight || 1.2),
                    fontWeight: headlineBlockProps.fontWeight || "700",
                    fontFamily: headlineBlockProps.fontFamily || "Poppins, sans-serif",
                    color: headlineBlockProps.color || "#ffffff",
                    textAlign: headlineBlockProps.alignment || "left",
                    letterSpacing: compact ? "-0.3px" : "-0.6px",
                    textShadow: "0 2px 16px rgba(0,0,0,0.55)",
                    outline: editor ? "1px dashed rgba(14,165,233,0.55)" : "none",
                    borderRadius: 8,
                    padding: editor ? "4px 6px" : 0,
                    maxWidth: "90%",
                  }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(headlineBlockProps.content || (editor ? "Headline" : "")) }}
                />
              </div>
            ) : null}
          </ScrollReveal>
          <ScrollReveal
            as="div"
            animationName={props.rightPanelAnimation || "none"}
            delay={Number(props.rightPanelAnimationDelay ?? 0)}
            speed={props.rightPanelAnimationSpeed}
            disabled={editor}
            style={asStyleObject(contentPanelStyle)}
          >
            {(editor || !!stripPlaceholder(props.eyebrow)) ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0,
                  marginBottom: compact ? 8 : 10,
                  minWidth: 0,
                  maxWidth: "100%",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: compact ? 44 : 70,
                    height: 2,
                    background: props.eyebrowColor || "linear-gradient(15deg, rgb(12, 140, 233) 15%, rgb(108, 92, 231) 10%, rgb(18, 213, 187) 45%, rgb(28, 165, 241) 130%)",
                    marginRight: 12,
                    borderRadius: 999,
                    flex: "0 0 auto",
                  }}
                />
                <p
                data-website-inline-editor="true"
                data-text-prop="eyebrow"
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => {
                  if (!editor || typeof onChangeBlock !== "function") return;
                  const cleaned = cleanInlineEditorHtml(event.currentTarget.innerHTML);
                  onChangeBlock({ ...props, eyebrow: (cleaned === "Section label" || cleaned === "Section Label") ? "" : cleaned });
                }}
                style={{
                  margin: 0,
                  fontSize: compact ? 16 : 16,
                  lineHeight: Number(props.eyebrowLineHeight || 1.2),
                  fontWeight: 600,
                  letterSpacing: "0.45px",
                  textTransform: "capitalize",
                  backgroundImage: props.eyebrowColor || "linear-gradient(15deg, rgb(12, 140, 233) 15%, rgb(108, 92, 231) 10%, rgb(18, 213, 187) 45%, rgb(28, 165, 241) 130%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                  textAlign: headlineBlockProps.alignment || "left",
                  minWidth: 0,
                  maxWidth: "100%",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                  borderRadius: 8,
                  padding: editor ? "4px 6px" : 0,
                  ...(shouldRunAnimations ? getAnimationStyle(headlineBlockProps.animation, Math.max(0, Number(headlineBlockProps.animationDelay || 0) - 0.08), headlineBlockProps.animationSpeed) : {}),
                }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(stripPlaceholder(props.eyebrow) || (editor ? "Section label" : "")) }}
                />
              </div>
            ) : null}
            <ScrollReveal
              as="div"
              animationName={headlineBlockProps.animation || "fade-up"}
              delay={headlineBlockProps.animationDelay || 0}
              speed={headlineBlockProps.animationSpeed}
              disabled={editor}
              style={{ width: "100%", maxWidth: "100%", minWidth: 0, display: props.headlineOverImage ? "none" : undefined }}
            >
              <h2
                data-website-inline-editor="true"
                data-text-prop="headlineBlock.content"
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => {
                  if (!editor || typeof onChangeBlock !== "function") return;
                  const content = cleanInlineEditorHtml(event.currentTarget.innerHTML);
                  onChangeBlock({
                    ...props,
                    headline: content,
                    headlineBlock: {
                      ...(props.headlineBlock || {}),
                      content,
                    },
                  });
                }}
                style={{
                  margin: 0,
                  fontSize: compact ? Math.max(30, Math.min(40, Number(headlineBlockProps.fontSize || 48))) : Math.max(32, Number(headlineBlockProps.fontSize || 48)),
                  lineHeight: Number(headlineBlockProps.lineHeight || 1.2),
                  fontWeight: headlineBlockProps.fontWeight || "400",
                  fontFamily: headlineBlockProps.fontFamily || "Poppins, sans-serif",
                  color: headlineBlockProps.color || "#61ce70",
                  textAlign: headlineBlockProps.alignment || "left",
                  letterSpacing: compact ? "-0.3px" : "-0.6px",
                  marginBottom: 10,
                  maxWidth: "100%",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                  borderRadius: 8,
                  padding: editor ? "4px 6px" : 0,
                }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(headlineBlockProps.content || (editor ? "Headline" : "")) }}
              />
            </ScrollReveal>
            {(bodyBlockProps.content || editor) ? (
              <ScrollReveal
                as="div"
                animationName={bodyBlockProps.animation || "fade-in"}
                delay={bodyBlockProps.animationDelay || 0}
                speed={bodyBlockProps.animationSpeed}
                disabled={editor}
                style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
              >
                <p
                  data-website-inline-editor="true"
                  data-text-prop="bodyBlock.content"
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    if (!editor || typeof onChangeBlock !== "function") return;
                    const content = cleanInlineEditorHtml(event.currentTarget.innerHTML);
                    onChangeBlock({
                      ...props,
                      subheadline: content,
                      bodyBlock: {
                        ...(props.bodyBlock || {}),
                        content,
                      },
                    });
                  }}
                  style={{
                    margin: 0,
                    fontSize: compact ? Math.max(16, Math.min(20, Number(bodyBlockProps.fontSize || 18))) : Math.max(14, Number(bodyBlockProps.fontSize || 18)),
                    lineHeight: Number(bodyBlockProps.lineHeight || 1.6),
                    color: bodyBlockProps.color || "#bdbcbf",
                    fontFamily: bodyBlockProps.fontFamily || undefined,
                    fontWeight: bodyBlockProps.fontWeight || undefined,
                    textAlign: bodyBlockProps.alignment || "left",
                    width: "100%",
                    maxWidth: "100%",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    marginBottom: compact ? 20 : 35,
                    outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                    borderRadius: 8,
                    padding: editor ? "4px 6px" : 0,
                  }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(bodyBlockProps.content || (editor ? "Supporting copy" : "")) }}
                />
              </ScrollReveal>
            ) : null}
            <div style={{ ...asStyleObject(faqWrapStyle), minWidth: 0, maxWidth: "100%" }}>
              <ScrollReveal as="div" animationName={faqBlockProps.sectionAnimation || "fade-up"} delay={faqBlockProps.sectionAnimationDelay || 0.12} speed={faqBlockProps.sectionAnimationSpeed} disabled={editor} style={asStyleObject(faqSurfaceStyle)}>
                <FAQAccordionItems items={items} compact={compact} editor={editor} props={faqBlockProps} openItems={openItems} onToggleItem={toggleItem} onPatchItem={patchItem} propPrefix="faqBlock.items" />
              </ScrollReveal>
            </div>
          </ScrollReveal>
        </div>
        {Number(props.sectionOverlayOpacity || 0) > 0 ? (
          <div style={{ position: "absolute", inset: 0, background: props.sectionOverlayColor || "#000000", opacity: Number(props.sectionOverlayOpacity) / 100, pointerEvents: "none", zIndex: 10 }} />
        ) : null}
    </ScrollReveal>
  );
}

function renderOverlayGuides(guides) {
  if (!guides?.active && !guides?.showX && !guides?.showY) return null;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          width: guides.showX ? 2 : 1,
          background: guides.showX ? "rgba(14,165,233,0.96)" : "rgba(14,165,233,0.28)",
          boxShadow: guides.showX ? "0 0 0 1px rgba(255,255,255,0.24), 0 0 18px rgba(14,165,233,0.24)" : "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: guides.showY ? 2 : 1,
          background: guides.showY ? "rgba(14,165,233,0.96)" : "rgba(14,165,233,0.28)",
          boxShadow: guides.showY ? "0 0 0 1px rgba(255,255,255,0.24), 0 0 18px rgba(14,165,233,0.24)" : "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: guides.showX || guides.showY ? 12 : 8,
          height: guides.showX || guides.showY ? 12 : 8,
          borderRadius: 999,
          background: guides.showX || guides.showY ? "#38bdf8" : "rgba(148,163,184,0.5)",
          border: "2px solid rgba(255,255,255,0.85)",
          boxShadow: guides.showX || guides.showY ? "0 0 18px rgba(56,189,248,0.28)" : "none",
        }}
      />
    </div>
  );
}

function getOverlayGuideState(x, y, rect) {
  const safeWidth = Math.max(rect?.width || 1, 1);
  const safeHeight = Math.max(rect?.height || 1, 1);
  const xThreshold = Math.max(1, (12 / safeWidth) * 100);
  const yThreshold = Math.max(1, (12 / safeHeight) * 100);
  const snappedX = Math.abs(x - 50) <= xThreshold ? 50 : x;
  const snappedY = Math.abs(y - 50) <= yThreshold ? 50 : y;

  return {
    snappedX,
    snappedY,
    showX: snappedX === 50,
    showY: snappedY === 50,
  };
}

function getPixelGuideState(x, y, width, height, rect, threshold = 10) {
  const safeWidth = Math.max(rect?.width || 1, 1);
  const safeHeight = Math.max(rect?.height || 1, 1);
  const centerX = x + (width / 2);
  const centerY = y + (height / 2);
  const targetX = safeWidth / 2;
  const targetY = safeHeight / 2;
  const showX = Math.abs(centerX - targetX) <= threshold;
  const showY = Math.abs(centerY - targetY) <= threshold;

  return {
    snappedX: showX ? targetX - (width / 2) : x,
    snappedY: showY ? targetY - (height / 2) : y,
    showX,
    showY,
  };
}

function renderCanvasCenterGuides(guides) {
  if (!guides?.active && !guides?.showX && !guides?.showY) return null;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 999 }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          width: guides.showX ? 2 : 1,
          background: guides.showX ? "rgba(56,189,248,0.98)" : "rgba(56,189,248,0.28)",
          boxShadow: guides.showX ? "0 0 0 1px rgba(255,255,255,0.28), 0 0 20px rgba(56,189,248,0.32)" : "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: guides.showY ? 2 : 1,
          background: guides.showY ? "rgba(56,189,248,0.98)" : "rgba(56,189,248,0.28)",
          boxShadow: guides.showY ? "0 0 0 1px rgba(255,255,255,0.28), 0 0 20px rgba(56,189,248,0.32)" : "none",
        }}
      />
    </div>
  );
}

function getOverlayBoundsElement(shell) {
  if (!shell) return null;
  return shell.closest?.('[data-overlay-bounds="true"]') || shell.parentElement || null;
}

function useOverlayBounds(shellRef) {
  const [bounds, setBounds] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const shell = shellRef.current;
    const boundsNode = getOverlayBoundsElement(shell);
    if (!boundsNode) return undefined;

    const updateBounds = () => {
      const rect = boundsNode.getBoundingClientRect();
      // getBoundingClientRect() returns scaled pixel dimensions when the canvas
      // is CSS-transformed (e.g. scale(0.4) to fit desktop canvas into builder pane).
      // Divide by the canvas scale so maxUsableWidth is based on the real layout size.
      const canvasScale = Number(boundsNode.closest('[data-canvas-scale]')?.dataset?.canvasScale || 1) || 1;
      setBounds({ width: (rect.width || 0) / canvasScale, height: (rect.height || 0) / canvasScale });
    };

    updateBounds();

    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateBounds);
      observer.observe(boundsNode);
    }

    window.addEventListener("resize", updateBounds);
    return () => {
      observer?.disconnect?.();
      window.removeEventListener("resize", updateBounds);
    };
  }, [shellRef]);

  return bounds;
}

function DraggableContentOverlay({ props, compact, editor, onChangeBlock, align = "center", vertical = "center", children, overlayEnabled = false, contentShellStyle = null }) {
  const dragRef = React.useRef(null);
  const shellRef = React.useRef(null);
  const latestPropsRef = React.useRef(props || {});
  const draftPatchRef = React.useRef(null);
  const onChangeBlockRef = React.useRef(onChangeBlock);
  onChangeBlockRef.current = onChangeBlock;
  const [guides, setGuides] = React.useState({ showX: false, showY: false, active: false });
  const [draftPatch, setDraftPatch] = React.useState(null);
  const [isActive, setIsActive] = React.useState(false);
  const bounds = useOverlayBounds(shellRef);
  const canManipulate = !!editor && !compact;
  const xPct = Number(props?.contentX ?? 50);
  const yPct = Number(props?.contentY ?? 50);
  const boxWidth = Math.max(240, Number(props?.contentWidth ?? 760));
  const boxHeight = Math.max(100, Number(props?.contentHeight ?? 220));
  const displayX = Number(draftPatch?.contentX ?? xPct);
  const displayY = Number(draftPatch?.contentY ?? yPct);
  const displayBoxWidth = Math.max(240, Number(draftPatch?.contentWidth ?? boxWidth));
  const displayBoxHeight = Math.max(100, Number(draftPatch?.contentHeight ?? boxHeight));
  const maxUsableWidth = bounds.width ? Math.max(180, bounds.width - 24) : boxWidth;
  const maxUsableHeight = bounds.height ? Math.max(80, bounds.height - 24) : boxHeight;
  const effectiveWidth = Math.min(displayBoxWidth, maxUsableWidth);
  const effectiveHeight = Math.min(displayBoxHeight, maxUsableHeight);
  const constrainedWidth = `min(${effectiveWidth}px, calc(100% - 24px))`;
  const constrainedLeft = `clamp(calc(${effectiveWidth}px / 2), ${displayX}%, calc(100% - (${effectiveWidth}px / 2)))`;
  const constrainedTop = `clamp(calc(${effectiveHeight}px / 2), ${displayY}%, calc(100% - (${effectiveHeight}px / 2)))`;

  React.useEffect(() => {
    latestPropsRef.current = props || {};
  }, [props]);

  React.useEffect(() => {
    if (!editor) return undefined;

    const handleOutsidePointer = (event) => {
      const shell = shellRef.current;
      if (!shell || shell.contains(event.target)) return;
      if (event.target?.closest?.('[data-text-toolbar="true"]')) return;
      dragRef.current = null;
      draftPatchRef.current = null;
      setDraftPatch(null);
      setGuides({ showX: false, showY: false, active: false });
      setIsActive(false);
      if (shell.contains(document.activeElement) && typeof document.activeElement?.blur === "function") {
        document.activeElement.blur();
      }
      if (window.getSelection) {
        const selection = window.getSelection();
        if (selection && typeof selection.removeAllRanges === "function") selection.removeAllRanges();
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer, true);
  }, [editor]);

  React.useEffect(() => {
    if (!editor || !canManipulate) return undefined;

    const handleMove = (event) => {
      const current = dragRef.current;
      if (!current) return;
      const dx = (event.clientX - current.startX) / (current.canvasScale || 1);
      const dy = (event.clientY - current.startY) / (current.canvasScale || 1);

      if (current.mode === "resize") {
        let nextWidth = current.baseWidth;
        let nextHeight = current.baseHeight;

        if (["left", "nw", "sw"].includes(current.handle)) nextWidth = current.baseWidth - dx;
        if (["right", "ne", "se"].includes(current.handle)) nextWidth = current.baseWidth + dx;
        if (["top", "nw", "ne"].includes(current.handle)) nextHeight = current.baseHeight - dy;
        if (["bottom", "sw", "se"].includes(current.handle)) nextHeight = current.baseHeight + dy;

        nextWidth = clampValue(nextWidth, 180, current.rect.width);
        nextHeight = clampValue(nextHeight, 80, current.rect.height);

        const halfWidthPct = (nextWidth / current.rect.width) * 50;
        const halfHeightPct = (nextHeight / current.rect.height) * 50;
        const guideState = getOverlayGuideState(
          clampValue(current.baseX, halfWidthPct, 100 - halfWidthPct),
          clampValue(current.baseY, halfHeightPct, 100 - halfHeightPct),
          current.rect,
        );

        const patch = {
          contentWidth: Math.round(nextWidth),
          contentHeight: Math.round(nextHeight),
          contentX: Math.round(guideState.snappedX),
          contentY: Math.round(guideState.snappedY),
        };
        draftPatchRef.current = patch;
        setDraftPatch(patch);
        setGuides({ showX: guideState.showX, showY: guideState.showY, active: true });
        return;
      }

      const halfWidthPct = (current.baseWidth / current.rect.width) * 50;
      const halfHeightPct = (current.baseHeight / current.rect.height) * 50;
      const guideState = getOverlayGuideState(
        clampValue(current.baseX + ((dx / current.rect.width) * 100), halfWidthPct, 100 - halfWidthPct),
        clampValue(current.baseY + ((dy / current.rect.height) * 100), halfHeightPct, 100 - halfHeightPct),
        current.rect,
      );

      const patch = { contentX: Math.round(guideState.snappedX), contentY: Math.round(guideState.snappedY) };
      draftPatchRef.current = patch;
      setDraftPatch(patch);
      setGuides({ showX: guideState.showX, showY: guideState.showY, active: true });
    };

    const handleUp = () => {
      const patch = draftPatchRef.current;
      dragRef.current = null;
      draftPatchRef.current = null;
      setDraftPatch(null);
      setGuides({ showX: false, showY: false, active: false });
      if (patch) onChangeBlockRef.current?.({ ...latestPropsRef.current, ...patch });
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [editor, canManipulate]);

  function startInteraction(event, mode = "move", handle = "se") {
    if (!editor || !canManipulate) return;
    setIsActive(true);
    setGuides((prev) => ({ ...prev, active: true }));
    event.preventDefault();
    event.stopPropagation();
    const rectRaw = getOverlayBoundsElement(shellRef.current)?.getBoundingClientRect();
    if (!rectRaw) return;
    const canvasScale = Number(event.target.closest('[data-canvas-scale]')?.dataset?.canvasScale || 1);
    const rect = { ...rectRaw, width: rectRaw.width / canvasScale, height: rectRaw.height / canvasScale };
    dragRef.current = {
      mode,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      baseX: xPct,
      baseY: yPct,
      baseWidth: effectiveWidth,
      baseHeight: effectiveHeight,
      rect,
      canvasScale,
    };
  }

  function maybeStartMove(event) {
    const target = event.target;
    if (target?.closest?.('[contenteditable="true"], button, a, input, textarea, select, [data-overlay-resize="true"]')) {
      return;
    }
    startInteraction(event, "move");
  }

  if (!overlayEnabled || compact) {
    return (
      <div style={{ position: "relative", zIndex: 3, width: "100%" }}>
        <div style={{ width: "100%", maxWidth: "100%" }}>{children}</div>
      </div>
    );
  }

  return (
    <>
      {editor ? renderOverlayGuides(guides) : null}
      <div
        ref={shellRef}
        onPointerDownCapture={() => setIsActive(true)}
        onFocusCapture={() => setIsActive(true)}
        onPointerDown={maybeStartMove}
        style={{
          position: "absolute",
          left: constrainedLeft,
          top: constrainedTop,
          transform: "translate(-50%, -50%)",
          width: constrainedWidth,
          maxWidth: "100%",
          minHeight: `${effectiveHeight}px`,
          zIndex: isActive ? 4 : 3,
          border: editor ? "1px dashed rgba(125,211,252,0.9)" : "none",
          borderRadius: 14,
          padding: editor ? "30px 0 6px" : 0,
          background: editor && isActive ? "rgba(15,23,42,0.06)" : "transparent",
          boxSizing: "border-box",
          touchAction: "none",
          cursor: editor ? "move" : "default",
          pointerEvents: "auto",
        }}
      >
        {editor ? (
          <div
            data-overlay-drag-handle="true"
            onPointerDown={(event) => startInteraction(event, "move")}
            style={{ position: "absolute", top: 4, left: 8, right: 8, zIndex: 5, cursor: "move", display: "flex", justifyContent: align === "right" ? "flex-end" : align === "left" ? "flex-start" : "center" }}
          >
            <span style={sharedStyles.editorChip}>Drag Text Box</span>
          </div>
        ) : null}
        {editor ? (
          <button
            type="button"
            title="Delete text block"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onChangeBlock?.({ ...latestPropsRef.current, hideTextOverlay: true }); }}
            style={{ position: "absolute", top: 4, right: 6, zIndex: 10, width: 22, height: 22, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff", color: "#fff", fontSize: 16, fontWeight: 600, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(239,68,68,0.5)" }}
          >
            ?
          </button>
        ) : null}
        <div
          style={{
            width: "100%",
            minHeight: Math.max(80, effectiveHeight),
            display: "flex",
            flexDirection: "column",
            justifyContent: vertical === "top" ? "flex-start" : vertical === "bottom" ? "flex-end" : "center",
            alignItems: "stretch",
            textAlign: align,
            overflow: editor ? "hidden" : "visible",
            boxSizing: "border-box",
            background: props?.contentBackground || (editor ? "rgba(15,23,42,0.08)" : "transparent"),
            borderRadius: 16,
            padding: (editor || (props?.contentBackground && props.contentBackground !== "transparent")) ? (compact ? 12 : 18) : 0,
            backdropFilter: props?.contentBackground && props.contentBackground !== "transparent" ? "blur(2px)" : "none",
            ...(contentShellStyle || {}),
          }}
        >
          {children}
        </div>
        {editor && isActive ? [
          { key: "left", left: -7, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize", width: 14, height: 28 },
          { key: "right", right: -7, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize", width: 14, height: 28 },
          { key: "top", top: -7, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize", width: 28, height: 14 },
          { key: "bottom", bottom: -7, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize", width: 28, height: 14 },
          { key: "nw", left: -7, top: -7, cursor: "nwse-resize", width: 14, height: 14 },
          { key: "ne", right: -7, top: -7, cursor: "nesw-resize", width: 14, height: 14 },
          { key: "sw", left: -7, bottom: -7, cursor: "nesw-resize", width: 14, height: 14 },
          { key: "se", right: -7, bottom: -7, cursor: "nwse-resize", width: 14, height: 14 },
        ].map((handle) => (
          <div
            key={handle.key}
            data-overlay-resize="true"
            onPointerDown={(event) => startInteraction(event, "resize", handle.key)}
            onMouseDown={(event) => startInteraction(event, "resize", handle.key)}
            style={{ position: "absolute", borderRadius: 999, background: "#0ea5e9", border: "2px solid #fff", boxShadow: "0 6px 16px rgba(14,165,233,0.35)", ...handle }}
          />
        )) : null}
      </div>
    </>
  );
}

function resolveColumnCardStyle(props, prefix, compact) {
  const bg = props?.[`${prefix}BackgroundColor`] || props?.columnBackgroundColor || props?.cardBackgroundColor || "#f8fafc";
  const borderColor = props?.[`${prefix}BorderColor`] || props?.columnBorderColor || "rgba(148,163,184,0.28)";
  const radius = Number(props?.[`${prefix}Radius`] ?? props?.columnRadius ?? 18);
  const padding = Number(props?.[`${prefix}Padding`] ?? props?.columnPadding ?? (compact ? 14 : 18));
  const marginTop = Number(props?.[`${prefix}MarginTop`] ?? 0);
  const minHeight = Number(props?.[`${prefix}MinHeight`] ?? 0);
  const shadowPreset = String(props?.[`${prefix}Shadow`] || props?.columnShadow || "soft");
  const align = String(props?.[`${prefix}ContentAlign`] || props?.columnContentAlign || "left");
  const overlayColor = String(props?.[`${prefix}OverlayColor`] || props?.columnOverlayColor || "transparent");
  const gradient = String(props?.[`${prefix}Gradient`] || props?.columnGradient || "").trim();
  const shadowMap = {
    none: "none",
    soft: "0 10px 24px rgba(15,23,42,0.08)",
    medium: "0 18px 36px rgba(15,23,42,0.14)",
    strong: "0 26px 48px rgba(15,23,42,0.18)",
  };

  return {
    marginTop,
    align,
    bodyTextColor: props?.[`${prefix}BodyColor`] || props?.columnBodyColor || props?.textColor || "#334155",
    titleTextColor: props?.[`${prefix}TitleColor`] || props?.columnTitleColor || props?.textColor || "#0f172a",
    style: {
      background: gradient || bg,
      border: `1px solid ${borderColor}`,
      borderRadius: Math.max(0, radius),
      padding: Math.max(0, padding),
      boxShadow: shadowMap[shadowPreset] || shadowMap.soft,
      minHeight: minHeight > 0 ? minHeight : undefined,
      position: "relative",
      overflow: "hidden",
    },
    overlay: overlayColor && overlayColor !== "transparent" ? (
      <div style={{ position: "absolute", inset: 0, background: overlayColor, pointerEvents: "none" }} />
    ) : null,
  };
}

function normalizeGridSectionItems(items) {
  if (!Array.isArray(items) || !items.length) {
    return [{ icon: "", iconName: "", iconGlyph: "", iconFontFamily: "", iconImage: "", iconAssetId: "", title: "", content: "", image: "" }];
  }

  return items.map((item) => ({
    icon: String(item?.icon || ""),
    iconName: String(item?.iconName || ""),
    iconGlyph: String(item?.iconGlyph || ""),
    iconFontFamily: String(item?.iconFontFamily || ""),
    iconImage: String(item?.iconImage || ""),
    iconAssetId: String(item?.iconAssetId || ""),
    title: String(item?.title || ""),
    eyebrow: String(item?.eyebrow || ""),
    content: String(item?.content || ""),
    link: String(item?.link || ""),
    image: String(item?.image || ""),
    imageAlt: String(item?.imageAlt || ""),
    imageHeight: item?.imageHeight,
  }));
}

function renderGridSectionIcon(item, color, size) {
  if (item?.iconImage) {
    return <img src={item.iconImage} alt={item?.title || "Grid icon"} style={{ width: size, height: size, objectFit: "contain", display: "block" }} />;
  }
  if (item?.iconGlyph && item?.iconFontFamily) {
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
  const namedIcon = renderGridLibraryIcon(item?.iconName, { size, color });
  if (namedIcon) {
    return namedIcon;
  }
  if (item?.icon) {
    return <span style={{ fontSize: size, lineHeight: 1, color }}>{item.icon}</span>;
  }
  return null;
}

function resolveServicesStylePreset(props = {}) {
  switch (String(props?.servicesStylePreset || "style-01").trim()) {
    case "style-02":
      return {
        cardRadius: 24,
        badgeRadius: 18,
        panelRadius: 20,
        panelInset: { left: 20, right: 20, bottom: 20 },
        panelPadding: "22px 26px",
        panelBackground: "rgba(12,18,34,0.76)",
        panelHoverBackground: "rgba(12,18,34,0.88)",
        cardSurface: "linear-gradient(180deg, rgba(9,16,30,0.98), rgba(18,30,52,0.98))",
        badgePosition: { top: 18, left: 18, right: "auto" },
        contentAlign: "center",
        titleWeight: 700,
        panelShadow: "0 18px 34px rgba(0,0,0,0.2)",
      };
    case "style-03":
      return {
        cardRadius: 18,
        badgeRadius: 16,
        panelRadius: 0,
        panelInset: { left: 24, right: 24, bottom: 28 },
        panelPadding: "0px",
        panelBackground: "transparent",
        panelHoverBackground: "transparent",
        cardSurface: "linear-gradient(180deg, rgba(8,12,24,0.98), rgba(18,27,46,0.98))",
        badgePosition: { top: 18, right: 18 },
        contentAlign: "left",
        titleWeight: 600,
        panelShadow: "none",
      };
    default:
      return {
        cardRadius: 15,
        badgeRadius: 15,
        panelRadius: 15,
        panelInset: { left: 12.5, right: 12.5, bottom: 20 },
        panelPadding: "25px 40px",
        panelBackground: "linear-gradient(290deg, rgba(15,23,42,0.9), rgba(3,34,47,0.92))",
        panelHoverBackground: "linear-gradient(290deg, rgba(17,24,39,0.92), rgba(8,47,73,0.94))",
        cardSurface: "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(30,41,59,0.96))",
        badgePosition: { top: 0, right: 20 },
        contentAlign: "left",
        titleWeight: 400,
        panelShadow: "0 2px 28px rgba(0,0,0,0.09)",
        useImageBackground: false,
      };
  }
}

function resolveServicesColorPreset(props = {}) {
  switch (String(props?.servicesColorPreset || "blue").trim()) {
    case "green":
      return {
        badgeBackground: "linear-gradient(135deg, #163628 0%, #22c55e 52%, #bef264 100%)",
        badgeShadow: "rgba(34,197,94,0.24)",
        badgeGlow: "rgba(190,242,100,0.2)",
        eyebrowGradient: "linear-gradient(90deg, #22c55e 0%, #bef264 100%)",
        titleColor: "#86efac",
        bodyColor: "rgba(248,250,252,0.92)",
        sectionTitleColor: "#dcfce7",
      };
    default:
      return {
        badgeBackground: "linear-gradient(135deg, #0c8ce9 0%, #6c5ce7 50%, #38bdf8 100%)",
        badgeShadow: "rgba(12,140,233,0.28)",
        badgeGlow: "rgba(56,189,248,0.22)",
        eyebrowGradient: "linear-gradient(90deg, #0ea5e9 0%, #8b5cf6 100%)",
        titleColor: "#7dd3fc",
        bodyColor: "rgba(248,250,252,0.92)",
        sectionTitleColor: "#dbeafe",
      };
  }
}

function ServicesGridCard({
  item,
  itemIndex,
  compact,
  editor,
  props,
  baseDelay,
  serviceTileRadius,
  tileHeight,
  topIconNode,
  ghostIconNode,
  imageStyle,
  iconStyle,
  titleStyle,
  bodyStyle,
  eyebrowFontSize,
  serviceIconBadgeWidth,
  serviceIconBadgeHeight,
  serviceIconBadgePadding,
  cardTitleFontSize,
  cardBodyFontSize,
  onUpdate,
}) {
  const [hovered, setHovered] = React.useState(false);
  const stylePreset = resolveServicesStylePreset(props);
  const colorPreset = resolveServicesColorPreset(props);
  const navigateHref = String(item?.link || "").trim();
  const cardLinkEnabled = !!navigateHref && !editor;
  const badgeMotionStyle = editor
    ? {}
    : {
        ...ambientMotionStyle("float", baseDelay * 0.3),
        animationDuration: hovered ? "3.1s" : "7.2s",
      };
  const ghostMotionStyle = editor
    ? {}
    : {
        ...ambientMotionStyle("pulse", baseDelay * 0.25),
        animationDuration: hovered ? "2.2s" : "4.8s",
      };
  const cardSurface = stylePreset.cardSurface;
  const cardBorder = props?.columnBorderColor || "rgba(148,163,184,0.28)";
  const cardInset = hovered
    ? "inset 0 0 0 1px rgba(255,255,255,0.16)"
    : "inset 0 0 0 1px rgba(255,255,255,0.08)";
  const contentPanelBackground = hovered ? stylePreset.panelHoverBackground : stylePreset.panelBackground;
  const showCardImage = props?.cardFlipEffect
    ? !!item.image  // flip-card front face is always image-based when an image is set
    : (stylePreset.useImageBackground !== false && !!item.image);
  const activateCardLink = React.useCallback((event) => {
    if (!navigateHref || typeof window === "undefined") return;
    const interactiveTarget = event?.target?.closest?.("a,button,input,textarea,select,label");
    if (interactiveTarget) return;
    window.location.assign(navigateHref);
  }, [navigateHref]);

  // Flip card variant — front shows image+title, hover reveals grey back with description + "Learn More"
  if (props?.cardFlipEffect) {
    const flipHeight = tileHeight || (compact ? 260 : 360);
    const flipRadius = Number(stylePreset.cardRadius) || 16;
    const backBg = props.cardFlipBackColor || "#374151";
    const btnBg = props.buttonBackgroundColor || colorPreset.badgeBackground || "#0ea5e9";
    const btnLabel = props.cardFlipButtonText || "Learn More";
    const backDescription = item.content || item.eyebrow || "";

    return (
      <article
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        style={{ position: "relative", height: flipHeight, perspective: "1200px", cursor: "default" }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transform: hovered ? "rotateY(180deg)" : "rotateY(0deg)",
            transition: "transform 620ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {/* Front face */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              borderRadius: flipRadius,
              overflow: "hidden",
              background: cardSurface,
              border: `1px solid ${cardBorder}`,
            }}
          >
            {showCardImage ? (
              <img
                src={item.image}
                alt={item.imageAlt || item.title || ""}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : null}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, rgba(2,6,23,0.0) 38%, rgba(2,6,23,0.78) 100%)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 16,
                right: 16,
                bottom: 20,
                zIndex: 2,
              }}
            >
              {item.title ? (
                <div style={{ color: "#fff", fontSize: compact ? 18 : 22, fontWeight: 600, lineHeight: 1.25 }}>
                  {item.title}
                </div>
              ) : null}
            </div>
          </div>

          {/* Back face */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              borderRadius: flipRadius,
              overflow: "hidden",
              background: backBg,
              border: `1px solid ${props.cardFlipBorderColor || "rgba(156,163,175,0.25)"}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: compact ? "20px 16px" : "28px 24px",
              textAlign: "center",
              gap: 14,
            }}
          >
            {topIconNode ? (
              <div
                style={{
                  width: serviceIconBadgeWidth,
                  height: serviceIconBadgeHeight,
                  borderRadius: stylePreset.badgeRadius,
                  background: colorPreset.badgeBackground,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  padding: serviceIconBadgePadding,
                  boxSizing: "border-box",
                  flexShrink: 0,
                }}
              >
                {topIconNode}
              </div>
            ) : null}
            <div style={{ color: props.cardFlipTitleColor || "#f9fafb", fontSize: compact ? 18 : 22, fontWeight: 600, lineHeight: 1.25 }}>
              {item.title}
            </div>
            {backDescription ? (
              <div
                style={{
                  color: props.cardFlipBodyColor || "rgba(249,250,251,0.78)",
                  fontSize: compact ? 13 : 15,
                  lineHeight: 1.65,
                  flexGrow: 1,
                  maxWidth: 260,
                  whiteSpace: "pre-wrap",
                }}
              >
                {backDescription}
              </div>
            ) : null}
            {navigateHref ? (
              <a
                href={navigateHref}
                style={{
                  display: "inline-block",
                  marginTop: 2,
                  padding: compact ? "8px 20px" : "10px 26px",
                  borderRadius: 9999,
                  background: btnBg,
                  color: props.cardFlipButtonTextColor || "#fff",
                  fontSize: compact ? 13 : 14,
                  fontWeight: 600,
                  textDecoration: "none",
                  flexShrink: 0,
                }}
              >
                {btnLabel}
              </a>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={cardLinkEnabled ? activateCardLink : undefined}
      onKeyDown={cardLinkEnabled ? (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activateCardLink(event);
      } : undefined}
      role={cardLinkEnabled ? "link" : undefined}
      tabIndex={cardLinkEnabled ? 0 : undefined}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: stylePreset.cardRadius,
        minHeight: tileHeight || undefined,
        aspectRatio: compact ? undefined : "1 / 1",
        height: compact ? (tileHeight || 260) : "auto",
        background: cardSurface,
        border: `1px solid ${cardBorder}`,
        boxShadow: hovered ? `0 24px 54px rgba(2,6,23,0.34), ${cardInset}` : `0 10px 26px rgba(2,6,23,0.18), ${cardInset}`,
        transform: hovered ? "scale(1.03)" : "scale(1)",
        cursor: cardLinkEnabled ? "pointer" : "default",
        transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 320ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {showCardImage ? (
        <img
          src={item.image}
          alt={item.imageAlt || item.title || "Grid item image"}
          style={{
            position: "absolute",
            inset: -1,
            width: "calc(100% + 2px)",
            height: "calc(100% + 2px)",
            objectFit: "cover",
            borderRadius: stylePreset.cardRadius,
            display: "block",
            transform: hovered ? "scale(1.12)" : "scale(1)",
            filter: hovered ? "grayscale(1)" : "grayscale(0)",
            transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1), filter 360ms ease",
            ...imageStyle,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: stylePreset.cardRadius,
          background: hovered
            ? "linear-gradient(180deg, rgba(2,6,23,0.01) 0%, rgba(2,6,23,0.06) 34%, rgba(2,6,23,0.36) 58%, rgba(3,12,24,0.74) 100%)"
            : "linear-gradient(180deg, rgba(2,6,23,0.02) 0%, rgba(2,6,23,0.08) 38%, rgba(2,6,23,0.42) 62%, rgba(3,12,24,0.66) 100%)",
          zIndex: 1,
          pointerEvents: "none",
          transition: "background 320ms ease",
        }}
      />
      {topIconNode ? (
        <div
          style={{
            position: "absolute",
            top: stylePreset.badgePosition?.top ?? 0,
            right: stylePreset.badgePosition?.right ?? (compact ? 14 : 20),
            left: stylePreset.badgePosition?.left,
            zIndex: 4,
            ...iconStyle,
          }}
        >
          <div
            style={{
              width: serviceIconBadgeWidth,
              height: serviceIconBadgeHeight,
              borderRadius: stylePreset.badgeRadius,
              background: colorPreset.badgeBackground,
              backgroundSize: hovered ? "150% 150%" : "120% 120%",
              backgroundPosition: hovered ? "34% 50%" : "80% 50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              padding: serviceIconBadgePadding,
              boxSizing: "border-box",
              boxShadow: hovered ? `0 16px 26px ${colorPreset.badgeShadow}` : `0 8px 16px ${colorWithAlpha(colorPreset.badgeShadow, 0.55)}`,
              filter: hovered ? `drop-shadow(0 12px 20px ${colorPreset.badgeGlow})` : `drop-shadow(0 6px 12px ${colorWithAlpha(colorPreset.badgeShadow, 0.5)})`,
              transform: hovered ? "translate3d(0, 6px, 0) scale(1.04)" : "translate3d(0, 0, 0) scale(1)",
              transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), background-size 320ms ease, background-position 320ms ease, box-shadow 320ms ease, filter 320ms ease",
              ...badgeMotionStyle,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: hovered ? "wbIconDoubleSpin 0.9s cubic-bezier(0.22, 1, 0.36, 1) 1" : "none",
              }}
            >
              {topIconNode}
            </div>
          </div>
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: compact ? 10 : 12.5,
          right: compact ? 10 : 12.5,
          bottom: compact ? 14 : 20,
          ...(stylePreset.panelInset || {}),
          zIndex: 4,
          padding: compact ? "18px 24px" : stylePreset.panelPadding,
          borderRadius: stylePreset.panelRadius,
          background: contentPanelBackground,
          boxShadow: hovered ? "0 18px 34px rgba(0,0,0,0.18)" : stylePreset.panelShadow,
          overflow: "hidden",
          transform: hovered ? "translateY(-10px)" : "translateY(0)",
          transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), background 320ms ease, box-shadow 320ms ease",
          textAlign: stylePreset.contentAlign,
        }}
      >
        {ghostIconNode ? (
          <div
            style={{
              position: "absolute",
              right: -10,
              bottom: -15,
              zIndex: 0,
              opacity: hovered ? 0.24 : 0.1,
              transform: hovered ? "translate3d(-8px, -4px, 0) rotate(-10deg) scale(0.98)" : "translate3d(0, 0, 0) rotate(0deg) scale(0.8)",
              transformOrigin: "right bottom",
              transition: "opacity 320ms ease, transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
              pointerEvents: "none",
              color: "#8ee5ff",
              ...ghostMotionStyle,
            }}
          >
            {ghostIconNode}
          </div>
        ) : null}
        {item.title ? (
          <div
            key={`service-title-${itemIndex}-${cardTitleFontSize}`}
            data-website-inline-editor="true"
            contentEditable={editor}
            suppressContentEditableWarning
            onBlur={(e) => onUpdate(itemIndex, { title: cleanInlineEditorHtml(e.currentTarget.innerHTML) })}
            style={{
              ...bodyStyle,
              position: "relative",
              zIndex: 1,
              margin: 0,
              color: props.cardTitleColor || colorPreset.titleColor,
              fontSize: cardTitleFontSize,
              lineHeight: 1.3,
              fontWeight: stylePreset.titleWeight,
              letterSpacing: "-0.1px",
              outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
              borderRadius: 8,
              padding: editor ? "2px 4px" : 0,
            }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(item.title || "Card title") }}
          />
        ) : null}
        {item.eyebrow ? (
          <div
            key={`service-subtitle-${itemIndex}-${eyebrowFontSize}`}
            data-website-inline-editor="true"
            contentEditable={editor}
            suppressContentEditableWarning
            onBlur={(e) => onUpdate(itemIndex, { eyebrow: cleanInlineEditorHtml(e.currentTarget.innerHTML) })}
            style={{
              ...titleStyle,
              display: "inline-block",
              width: "fit-content",
              maxWidth: "100%",
              position: "relative",
              zIndex: 1,
              margin: item.title ? "6px 0 0" : 0,
              fontSize: eyebrowFontSize,
              fontWeight: 500,
              lineHeight: 1.3,
              letterSpacing: "-0.3px",
              color: "rgba(248,250,252,0.92)",
              outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
              borderRadius: 8,
              padding: editor ? "2px 4px" : 0,
            }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(item.eyebrow || "") }}
          />
        ) : null}
        {item.content ? (
          <div
            data-website-inline-editor="true"
            contentEditable={editor}
            suppressContentEditableWarning
            onBlur={(e) => onUpdate(itemIndex, { content: cleanInlineEditorHtml(e.currentTarget.innerHTML) })}
            style={{
              ...bodyStyle,
              position: "relative",
              zIndex: 1,
              marginTop: 8,
              color: colorPreset.bodyColor,
              fontSize: cardBodyFontSize,
              lineHeight: 1.6,
              outline: editor ? "1px dashed rgba(14,165,233,0.28)" : "none",
              borderRadius: 8,
              padding: editor ? "2px 4px" : 0,
            }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(item.content || "") }}
          />
        ) : null}
      </div>
    </article>
  );
}

function isServicesGridVariant(props, items) {
  if (String(props?.gridVariant || "").trim() === "services") return true;
  return Array.isArray(items) && items.length >= 4 && items.every((item) => item?.image && item?.link && item?.eyebrow);
}

function resolveGridSectionCardStyle(props, compact) {
  const borderColor = props?.columnBorderColor || "rgba(148,163,184,0.28)";
  const radius = Number(props?.columnRadius ?? 18);
  const padding = Number(props?.columnPadding ?? (compact ? 14 : 18));
  const shadowPreset = String(props?.columnShadow || "soft");
  const overlayColor = String(props?.columnOverlayColor || "transparent");
  const gradient = String(props?.columnGradient || "").trim();
  const shadowMap = {
    none: "none",
    soft: "0 10px 24px rgba(15,23,42,0.08)",
    medium: "0 18px 36px rgba(15,23,42,0.14)",
    strong: "0 26px 48px rgba(15,23,42,0.18)",
  };

  return {
    align: String(props?.columnContentAlign || "left"),
    titleTextColor: props?.columnTitleColor || props?.textColor || "#0f172a",
    bodyTextColor: props?.columnBodyColor || "#334155",
    iconColor: props?.iconColor || props?.textColor || "#0f172a",
    style: {
      background: gradient || props?.columnBackgroundColor || props?.cardBackgroundColor || "#f8fafc",
      border: `1px solid ${borderColor}`,
      borderRadius: Math.max(0, radius),
      padding: Math.max(0, padding),
      boxShadow: shadowMap[shadowPreset] || shadowMap.soft,
      minHeight: Number(props?.gridItemMinHeight ?? 0) > 0 ? Number(props?.gridItemMinHeight) : undefined,
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      gap: compact ? 12 : 14,
      height: "100%",
    },
    overlay: overlayColor && overlayColor !== "transparent" ? (
      <div style={{ position: "absolute", inset: 0, background: overlayColor, pointerEvents: "none" }} />
    ) : null,
  };
}

function ExtraTextOverlay({ item, editor, onUpdate, onDelete }) {
  const dragRef = React.useRef(null);
  const shellRef = React.useRef(null);
  const onUpdateRef = React.useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const draftRef = React.useRef(null); // never in effect deps — avoids listener churn on every pixel
  const [draft, setDraft] = React.useState(null);
  const [isActive, setIsActive] = React.useState(false);

  const x = Number(draft?.x ?? item.x ?? 50);
  const y = Number(draft?.y ?? item.y ?? 30);
  const w = Math.max(80, Number(draft?.width ?? item.width ?? 320));
  const h = Math.max(30, Number(draft?.height ?? item.height ?? 80));

  React.useEffect(() => {
    if (!editor) return undefined;
    const handleMove = (event) => {
      const cur = dragRef.current;
      if (!cur) return;
      const { containerBounds } = cur;
      if (!containerBounds || containerBounds.width === 0) return;
      const dx = (event.clientX - cur.startX) / (cur.canvasScale || 1);
      const dy = (event.clientY - cur.startY) / (cur.canvasScale || 1);
      let next;
      if (cur.mode === "resize") {
        next = { x: cur.baseX, y: cur.baseY, width: Math.round(Math.max(80, cur.baseW + dx)), height: Math.round(Math.max(30, cur.baseH + dy)) };
      } else {
        next = {
          x: Math.round(Math.max(0, Math.min(100, cur.baseX + (dx / containerBounds.width) * 100))),
          y: Math.round(Math.max(0, Math.min(100, cur.baseY + (dy / containerBounds.height) * 100))),
          width: cur.baseW,
          height: cur.baseH,
        };
      }
      draftRef.current = next;
      setDraft({ ...next });
    };
    const handleUp = () => {
      const d = draftRef.current;
      dragRef.current = null;
      draftRef.current = null;
      setDraft(null);
      if (d) onUpdateRef.current(d);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [editor]); // intentionally no draft/state in deps — draftRef keeps it current

  function startDrag(event, mode = "move") {
    if (!editor) return;
    event.preventDefault();
    event.stopPropagation();
    setIsActive(true);
    // Capture bounds once at drag start — not during move
    const container = shellRef.current?.closest?.('[data-overlay-bounds="true"]') || shellRef.current?.parentElement;
    const canvasScale = Number(event.currentTarget.closest('[data-canvas-scale]')?.dataset?.canvasScale || 1);
    const cbRaw = container?.getBoundingClientRect() || null;
    const containerBounds = cbRaw ? { ...cbRaw, width: cbRaw.width / canvasScale, height: cbRaw.height / canvasScale } : null;
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, baseX: x, baseY: y, baseW: w, baseH: h, containerBounds, canvasScale };
  }

  const isDragging = !!dragRef.current;

  return (
    <div
      ref={shellRef}
      onPointerDown={(event) => { if (!event.target?.closest?.('[data-txt-edit="true"],[data-overlay-resize="true"]')) startDrag(event, "move"); }}
      onMouseDown={(event) => { if (!event.target?.closest?.('[data-txt-edit="true"],[data-overlay-resize="true"]')) startDrag(event, "move"); }}
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
        width: `${w}px`,
        minHeight: `${h}px`,
        zIndex: isActive ? 12 : 10,
        border: editor ? `2px dashed ${isActive ? "rgba(34,197,94,1)" : "rgba(34,197,94,0.55)"}` : "none",
        borderRadius: 10,
        background: item.background && item.background !== "transparent" ? item.background : "transparent",
        boxSizing: "border-box",
        touchAction: "none",
        cursor: editor ? "grab" : "default",
        pointerEvents: "auto",
        padding: editor ? "20px 8px 6px" : "4px 8px",
        userSelect: "none",
      }}
    >
      {editor ? (
        <span style={{ position: "absolute", top: 2, left: 6, fontSize: 16, fontWeight: 600, color: "#22c55e", letterSpacing: "0.1em", pointerEvents: "none", userSelect: "none" }}>
          TEXT {isActive ? `· ${x}% ${y}%` : ""}
        </span>
      ) : null}
      {editor ? (
        <button
          type="button"
          data-overlay-resize="true"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onDelete(); }}
          style={{ position: "absolute", top: -9, right: -9, zIndex: 14, width: 20, height: 20, borderRadius: 999, background: "rgba(239,68,68,0.9)", border: "2px solid #fff", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", display: "grid", placeItems: "center", padding: 0, lineHeight: 1 }}
        >×</button>
      ) : null}
      {editor ? (
        <div
          data-overlay-resize="true"
          onPointerDown={(event) => { event.stopPropagation(); startDrag(event, "resize"); }}
          onMouseDown={(event) => { event.stopPropagation(); startDrag(event, "resize"); }}
          style={{ position: "absolute", right: -7, bottom: -7, width: 15, height: 15, borderRadius: 3, background: "#22c55e", border: "2px solid #fff", cursor: "se-resize", zIndex: 14 }}
        />
      ) : null}
      <div
        data-txt-edit="true"
        contentEditable={editor}
        suppressContentEditableWarning
        onMouseDown={(event) => editor && event.stopPropagation()}
        onPointerDown={(event) => editor && event.stopPropagation()}
        onBlur={(event) => {
          if (!editor) return;
          onUpdateRef.current({ text: event.currentTarget.innerHTML });
        }}
        style={{
          outline: "none",
          fontSize: Number(item.fontSize || 18),
          fontWeight: item.fontWeight || "600",
          color: item.color || "#ffffff",
          textAlign: item.textAlign || "center",
          lineHeight: 1.35,
          cursor: "text",
          minHeight: 20,
          wordBreak: "break-word",
          userSelect: editor ? "text" : "none",
        }}
        dangerouslySetInnerHTML={{ __html: item.text || (editor ? "Click to edit" : "") }}
      />
    </div>
  );
}

function ExtraCounterOverlay({ item, editor, onUpdate, onDelete }) {
  const dragRef = React.useRef(null);
  const shellRef = React.useRef(null);
  const onUpdateRef = React.useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const draftRef = React.useRef(null);
  const [draft, setDraft] = React.useState(null);
  const [isActive, setIsActive] = React.useState(false);
  const [showEdit, setShowEdit] = React.useState(false);

  const x = Number(draft?.x ?? item.x ?? 50);
  const y = Number(draft?.y ?? item.y ?? 30);
  const w = Math.max(100, Number(draft?.width ?? item.width ?? 280));
  const h = Math.max(40, Number(draft?.height ?? item.height ?? 80));

  React.useEffect(() => {
    if (!editor) return undefined;
    const handleMove = (event) => {
      const cur = dragRef.current;
      if (!cur) return;
      const { containerBounds } = cur;
      if (!containerBounds || containerBounds.width === 0) return;
      const dx = (event.clientX - cur.startX) / (cur.canvasScale || 1);
      const dy = (event.clientY - cur.startY) / (cur.canvasScale || 1);
      let next;
      if (cur.mode === "resize") {
        next = { x: cur.baseX, y: cur.baseY, width: Math.round(Math.max(100, cur.baseW + dx)), height: Math.round(Math.max(40, cur.baseH + dy)) };
      } else {
        next = {
          x: Math.round(Math.max(0, Math.min(100, cur.baseX + (dx / containerBounds.width) * 100))),
          y: Math.round(Math.max(0, Math.min(100, cur.baseY + (dy / containerBounds.height) * 100))),
          width: cur.baseW,
          height: cur.baseH,
        };
      }
      draftRef.current = next;
      setDraft({ ...next });
    };
    const handleUp = () => {
      const d = draftRef.current;
      dragRef.current = null;
      draftRef.current = null;
      setDraft(null);
      if (d) onUpdateRef.current(d);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [editor]);

  function startDrag(event, mode = "move") {
    if (!editor) return;
    event.preventDefault();
    event.stopPropagation();
    setIsActive(true);
    const container = shellRef.current?.closest?.('[data-overlay-bounds="true"]') || shellRef.current?.parentElement;
    const canvasScale = Number(event.currentTarget.closest('[data-canvas-scale]')?.dataset?.canvasScale || 1);
    const cbRaw = container?.getBoundingClientRect() || null;
    const containerBounds = cbRaw ? { ...cbRaw, width: cbRaw.width / canvasScale, height: cbRaw.height / canvasScale } : null;
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, baseX: x, baseY: y, baseW: w, baseH: h, containerBounds, canvasScale };
  }

  const numSize = item.numberSize || 52;
  const numColor = item.numberColor || "#0c8ce9";
  const labelColor = item.labelColor || "rgba(255,255,255,0.85)";
  const bg = item.background || "rgba(0,0,0,0.45)";
  const suffix = item.suffix || "";
  const label = item.label || "Site Visits";
  const iconType = item.iconType || "diamond";
  const iconColor = item.iconColor || "rgba(255,255,255,0.13)";
  const iconSize = Math.max(h * 0.85, 56);

  // Background watermark icon
  const WatermarkIcon = () => {
    if (iconType === "none") return null;
    const sharedStyle = { position: "absolute", width: iconSize, height: iconSize, left: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", overflow: "visible" };
    if (iconType === "circle") {
      return (
        <svg aria-hidden="true" viewBox="0 0 100 100" fill="none" stroke={iconColor} strokeWidth="2.5" style={sharedStyle}>
          <circle cx="50" cy="50" r="46" />
        </svg>
      );
    }
    if (iconType === "star") {
      return (
        <svg aria-hidden="true" viewBox="0 0 100 100" fill="none" stroke={iconColor} strokeWidth="2.5" style={sharedStyle}>
          <polygon points="50,5 61,35 95,38 70,60 79,93 50,75 21,93 30,60 5,38 39,35" />
        </svg>
      );
    }
    if (iconType === "hexagon") {
      return (
        <svg aria-hidden="true" viewBox="0 0 100 100" fill="none" stroke={iconColor} strokeWidth="2.5" style={sharedStyle}>
          <polygon points="50,5 93,27.5 93,72.5 50,95 7,72.5 7,27.5" />
        </svg>
      );
    }
    // default: diamond
    return (
      <svg aria-hidden="true" viewBox="0 0 100 100" fill="none" stroke={iconColor} strokeWidth="2.5" style={sharedStyle}>
        <polygon points="50,4 96,50 50,96 4,50" />
      </svg>
    );
  };

  // Inline edit panel
  const EditPanel = () => (
    <div
      data-counter-resize="true"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{ position: "absolute", top: "calc(100% + 10px)", left: 0, zIndex: 30, background: "#1e293b", border: "1px solid rgba(14,165,233,0.45)", borderRadius: 12, padding: "12px 14px", boxShadow: "0 8px 28px rgba(0,0,0,0.65)", display: "flex", flexDirection: "column", gap: 10, minWidth: 260, width: Math.max(260, w) }}
    >
      <span style={{ fontSize: 16, fontWeight: 600, color: "#38bdf8", letterSpacing: "0.08em" }}>COUNTER SETTINGS</span>
      <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 16, color: "#94a3b8" }}>
        Label text
        <input
          type="text"
          value={item.label || ""}
          onChange={(e) => onUpdateRef.current({ label: e.target.value })}
          style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", fontSize: 16, outline: "none" }}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 16, color: "#94a3b8" }}>
        Background (CSS color / rgba)
        <input
          type="text"
          value={item.background || "rgba(0,0,0,0.45)"}
          onChange={(e) => onUpdateRef.current({ background: e.target.value })}
          placeholder="rgba(0,0,0,0.45) or #1e293b"
          style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", fontSize: 16, outline: "none" }}
        />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 16, color: "#94a3b8" }}>
          Number color
          <input type="color" value={/^#[0-9a-f]{3,6}$/i.test(item.numberColor || "") ? item.numberColor : "#0c8ce9"} onChange={(e) => onUpdateRef.current({ numberColor: e.target.value })}
            style={{ width: "100%", height: 30, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent" }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 16, color: "#94a3b8" }}>
          Label color
          <input type="color" value={/^#[0-9a-f]{3,6}$/i.test(item.labelColor || "") ? item.labelColor : "#ffffff"} onChange={(e) => onUpdateRef.current({ labelColor: e.target.value })}
            style={{ width: "100%", height: 30, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent" }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 16, color: "#94a3b8" }}>
          Icon color
          <input type="color" value={/^#[0-9a-f]{3,6}$/i.test(item.iconColor || "") ? item.iconColor : "#ffffff"} onChange={(e) => onUpdateRef.current({ iconColor: e.target.value })}
            style={{ width: "100%", height: 30, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent" }} />
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 16, color: "#94a3b8" }}>
          Number size
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button type="button" onClick={() => onUpdateRef.current({ numberSize: Math.max(24, (item.numberSize || 52) - 4) })}
              style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", cursor: "pointer", fontSize: 16, flexShrink: 0 }}>-</button>
            <span style={{ flex: 1, textAlign: "center", color: "#e2e8f0", fontSize: 16 }}>{item.numberSize || 52}</span>
            <button type="button" onClick={() => onUpdateRef.current({ numberSize: Math.min(120, (item.numberSize || 52) + 4) })}
              style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", cursor: "pointer", fontSize: 16, flexShrink: 0 }}>+</button>
          </div>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 16, color: "#94a3b8" }}>
          Background icon
          <select value={item.iconType || "diamond"} onChange={(e) => onUpdateRef.current({ iconType: e.target.value })}
            style={{ padding: "5px 6px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", fontSize: 16 }}>
            <option value="diamond">Diamond</option>
            <option value="circle">Circle</option>
            <option value="star">Star</option>
            <option value="hexagon">Hexagon</option>
            <option value="none">None</option>
          </select>
        </label>
      </div>
      <button type="button" onClick={() => setShowEdit(false)}
        style={{ marginTop: 2, padding: "6px 0", borderRadius: 7, border: "none", background: "#0ea5e9", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Done</button>
    </div>
  );

  return (
    <div
      ref={shellRef}
      onPointerDown={(event) => { if (!event.target?.closest?.('[data-counter-resize="true"]')) startDrag(event, "move"); }}
      onMouseDown={(event) => { if (!event.target?.closest?.('[data-counter-resize="true"]')) startDrag(event, "move"); }}
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
        width: `${w}px`,
        minHeight: `${h}px`,
        zIndex: isActive ? 12 : 10,
        border: editor ? `2px dashed ${isActive ? "rgba(14,165,233,1)" : "rgba(14,165,233,0.6)"}` : "none",
        borderRadius: 14,
        background: bg,
        boxSizing: "border-box",
        touchAction: "none",
        cursor: editor ? "grab" : "default",
        pointerEvents: "auto",
        overflow: "visible",
        padding: editor ? "22px 14px 10px" : "10px 14px",
        backdropFilter: bg !== "transparent" ? "blur(6px)" : undefined,
        userSelect: "none",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      {/* Background watermark icon */}
      <WatermarkIcon />

      {/* Editor label */}
      {editor ? (
        <span style={{ position: "absolute", top: 3, left: 8, fontSize: 16, fontWeight: 600, color: "#38bdf8", letterSpacing: "0.1em", pointerEvents: "none", userSelect: "none" }}>
          COUNTER {isActive ? `· ${x}% ${y}%` : ""}
        </span>
      ) : null}

      {/* Delete button */}
      {editor ? (
        <button
          type="button"
          data-counter-resize="true"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onDelete(); }}
          style={{ position: "absolute", top: -9, right: -9, zIndex: 14, width: 20, height: 20, borderRadius: 999, background: "rgba(239,68,68,0.9)", border: "2px solid #fff", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", display: "grid", placeItems: "center", padding: 0, lineHeight: 1 }}
        >×</button>
      ) : null}

      {/* Edit settings button */}
      {editor ? (
        <button
          type="button"
          data-counter-resize="true"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); setShowEdit((v) => !v); }}
          title="Edit counter settings"
          style={{ position: "absolute", top: -9, right: 16, zIndex: 14, width: 20, height: 20, borderRadius: 999, background: showEdit ? "#0ea5e9" : "rgba(30,41,59,0.9)", border: "2px solid #fff", color: "#fff", fontSize: 16, cursor: "pointer", display: "grid", placeItems: "center", padding: 0, lineHeight: 1 }}
        >×</button>
      ) : null}

      {/* Resize handle */}
      {editor ? (
        <div
          data-counter-resize="true"
          onPointerDown={(event) => { event.stopPropagation(); startDrag(event, "resize"); }}
          onMouseDown={(event) => { event.stopPropagation(); startDrag(event, "resize"); }}
          style={{ position: "absolute", right: -7, bottom: -7, width: 15, height: 15, borderRadius: 3, background: "#0ea5e9", border: "2px solid #fff", cursor: "se-resize", zIndex: 14 }}
        />
      ) : null}

      {/* Counter number + label — offset right to clear the watermark icon */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: iconType !== "none" ? Math.round(iconSize * 0.7) : 0, width: "100%", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
          <IconCounterNumber
            projectId={String(item.projectId || "")}
            targetNumber={item.targetNumber != null ? Number(item.targetNumber) : null}
            startNumber={Number(item.startNumber ?? 0)}
            suffix={suffix}
            color={numColor}
            compact={false}
            editor={editor}
            fontSize={numSize}
          />
        </div>
        {label ? (
          <p style={{ margin: 0, fontSize: Math.max(12, Math.round(numSize * 0.38)), fontWeight: 600, color: labelColor, lineHeight: 1.3, flex: 1 }}>
            {label}
          </p>
        ) : null}
      </div>

      {/* Inline edit panel */}
      {editor && showEdit ? <EditPanel /> : null}
    </div>
  );
}

function DraggableImageOverlay({ props, compact, editor, onChangeBlock, onUploadImage, onSelectAsset, assets, imageSrc, overlayEnabled = false, frameStyle = null, isSelected = false, imageFit = "contain", onDelete = null, imageLabel = null, onMoveLayer = null }) {
  const dragRef = React.useRef(null);
  const shellRef = React.useRef(null);
  const latestPropsRef = React.useRef(props || {});
  const draftPatchRef = React.useRef(null);
  const onChangeBlockRef = React.useRef(onChangeBlock);
  onChangeBlockRef.current = onChangeBlock;
  const [guides, setGuides] = React.useState({ showX: false, showY: false, active: false });
  const [draftPatch, setDraftPatch] = React.useState(null);
  const [isActive, setIsActive] = React.useState(false);
  const bounds = useOverlayBounds(shellRef);
  const canManipulate = !!editor && !compact && !!imageSrc;
  const showEditorControls = !!editor;
  const overlayLibraryImages = Array.isArray(assets?.images) ? assets.images.slice(0, compact ? 2 : 4) : [];
  const xPct = Number(props?.floatingX ?? 76);
  const yPct = Number(props?.floatingY ?? 58);
  const rotationDeg = Number(props?.floatingRotation ?? 0);
  const boxWidth = Math.max(120, Number(props?.floatingWidth ?? 260));
  const boxHeight = Math.max(120, Number(props?.floatingHeight ?? 260));
  const displayX = Number(draftPatch?.floatingX ?? xPct);
  const displayY = Number(draftPatch?.floatingY ?? yPct);
  const displayRotation = draftPatch?.floatingRotation != null ? Number(draftPatch.floatingRotation) : rotationDeg;
  const displayBoxWidth = Math.max(120, Number(draftPatch?.floatingWidth ?? boxWidth));
  const displayBoxHeight = Math.max(120, Number(draftPatch?.floatingHeight ?? boxHeight));
  // No clamping — images can extend beyond the block edges intentionally
  const effectiveWidth = displayBoxWidth;
  const effectiveHeight = displayBoxHeight;
  const constrainedWidth = `${effectiveWidth}px`;
  const constrainedHeight = `${effectiveHeight}px`;
  const constrainedLeft = `${displayX}%`;
  const constrainedTop = `${displayY}%`;

  React.useEffect(() => {
    latestPropsRef.current = props || {};
  }, [props]);

  React.useEffect(() => {
    if (!editor) return undefined;

    const handleOutsidePointer = (event) => {
      const shell = shellRef.current;
      if (!shell || shell.contains(event.target)) return;
      dragRef.current = null;
      draftPatchRef.current = null;
      setDraftPatch(null);
      setGuides({ showX: false, showY: false, active: false });
      setIsActive(false);
    };

    document.addEventListener("pointerdown", handleOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer, true);
  }, [editor]);

  React.useEffect(() => {
    if (!editor || !canManipulate) return undefined;

    const handleMove = (event) => {
      const current = dragRef.current;
      if (!current) return;
      const dx = (event.clientX - current.startX) / (current.canvasScale || 1);
      const dy = (event.clientY - current.startY) / (current.canvasScale || 1);

      if (current.mode === "rotate") {
        const currentAngle = Math.atan2(event.clientY - current.centerY, event.clientX - current.centerX);
        const delta = (currentAngle - current.startAngle) * (180 / Math.PI);
        const patch = { floatingRotation: Math.round(current.baseRotation + delta) };
        draftPatchRef.current = patch;
        setDraftPatch(patch);
        return;
      }

      if (current.mode === "resize") {
        let nextWidth = current.baseWidth;
        let nextHeight = current.baseHeight;

        if (["left", "nw", "sw"].includes(current.handle)) nextWidth = current.baseWidth - dx;
        if (["right", "ne", "se"].includes(current.handle)) nextWidth = current.baseWidth + dx;
        if (["top", "nw", "ne"].includes(current.handle)) nextHeight = current.baseHeight - dy;
        if (["bottom", "sw", "se"].includes(current.handle)) nextHeight = current.baseHeight + dy;

        nextWidth = Math.max(60, nextWidth);
        nextHeight = Math.max(60, nextHeight);

        // When resizing, the center shifts by half the delta so the OPPOSITE edge stays fixed.
        // This applies to all handles: corners shift both axes, edge handles shift one axis.
        const changesW = ["left", "right", "nw", "ne", "sw", "se"].includes(current.handle);
        const changesH = ["top", "bottom", "nw", "ne", "sw", "se"].includes(current.handle);
        const newX = changesW ? current.baseX + (dx / current.rect.width * 50) : current.baseX;
        const newY = changesH ? current.baseY + (dy / current.rect.height * 50) : current.baseY;

        const patch = {
          floatingWidth: Math.round(nextWidth),
          floatingHeight: Math.round(nextHeight),
          floatingX: Math.round(newX),
          floatingY: Math.round(newY),
        };
        draftPatchRef.current = patch;
        setDraftPatch(patch);
        setGuides({ showX: false, showY: false, active: false });
        return;
      }

      // Move — no clamping, free to go off-edge
      const newX = current.baseX + ((dx / current.rect.width) * 100);
      const newY = current.baseY + ((dy / current.rect.height) * 100);
      const guideState = getOverlayGuideState(newX, newY, current.rect);
      const patch = { floatingX: Math.round(guideState.snappedX), floatingY: Math.round(guideState.snappedY) };
      draftPatchRef.current = patch;
      setDraftPatch(patch);
      setGuides({ showX: guideState.showX, showY: guideState.showY, active: true });
    };

    const handleUp = () => {
      const patch = draftPatchRef.current;
      dragRef.current = null;
      draftPatchRef.current = null;
      setDraftPatch(null);
      setGuides({ showX: false, showY: false, active: false });
      if (patch) onChangeBlockRef.current?.({ ...latestPropsRef.current, ...patch });
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [editor, canManipulate]);

  function startInteraction(event, mode = "move", handle = "se") {
    if (!editor || !canManipulate) return;
    setIsActive(true);
    setGuides((prev) => ({ ...prev, active: true }));
    event.preventDefault();
    event.stopPropagation();
    const rectRaw = getOverlayBoundsElement(shellRef.current)?.getBoundingClientRect();
    if (!rectRaw) return;
    const canvasScale = Number(event.target.closest('[data-canvas-scale]')?.dataset?.canvasScale || 1);
    const rect = { ...rectRaw, width: rectRaw.width / canvasScale, height: rectRaw.height / canvasScale };
    if (mode === "rotate") {
      const shellRect = shellRef.current?.getBoundingClientRect();
      if (!shellRect) return;
      const centerX = shellRect.left + shellRect.width / 2;
      const centerY = shellRect.top + shellRect.height / 2;
      dragRef.current = {
        mode: "rotate",
        centerX,
        centerY,
        startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
        baseRotation: rotationDeg,
        rect,
        canvasScale,
      };
      return;
    }
    dragRef.current = {
      mode,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      baseX: xPct,
      baseY: yPct,
      baseWidth: effectiveWidth,
      baseHeight: effectiveHeight,
      rect,
      canvasScale,
    };
  }

  function maybeStartMove(event) {
    const target = event.target;
    if (target?.closest?.('[data-overlay-resize="true"]')) return;
    startInteraction(event, "move");
  }

  function applyOverlayAsset(image) {
    if (typeof onChangeBlock !== "function" || !image?.src) return;
    onChangeBlock({
      ...props,
      floatingImage: image.src || "",
      floatingImageAssetId: image.id || "",
      floatingX: props.floatingX ?? xPct,
      floatingY: props.floatingY ?? yPct,
      floatingWidth: props.floatingWidth ?? effectiveWidth,
      floatingHeight: props.floatingHeight ?? effectiveHeight,
    });
  }

  if (!imageSrc) return null;

  if (!overlayEnabled || compact) {
    return (
      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          marginBottom: compact ? 18 : 24,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: compact ? "100%" : `min(${boxWidth}px, 100%)`,
            maxWidth: "100%",
            height: `${compact ? Math.min(Math.max(180, effectiveHeight), 320) : effectiveHeight}px`,
            overflow: "hidden",
            borderRadius: compact ? 18 : 22,
            boxShadow: compact ? "0 18px 34px rgba(15,23,42,0.16)" : "0 24px 48px rgba(15,23,42,0.28)",
            background: "rgba(255,255,255,0.06)",
            ...(frameStyle || {}),
          }}
        >
          <img src={imageSrc} alt={props?.floatingAlt || "Overlay image"} style={{ width: "100%", height: "100%", objectFit: imageFit, display: "block" }} onError={(e) => { e.target.style.display = "none"; }} />
        </div>
      </div>
    );
  }

  return (
    <>
      {editor ? renderOverlayGuides(guides) : null}
      <div
        ref={shellRef}
        onPointerDownCapture={() => setIsActive(true)}
        onFocusCapture={() => setIsActive(true)}
        onPointerDown={maybeStartMove}
        style={{
          position: "absolute",
          left: constrainedLeft,
          top: constrainedTop,
          transform: `translate(-50%, -50%) rotate(${displayRotation}deg)`,
          width: constrainedWidth,
          height: constrainedHeight,
          zIndex: isActive ? 5 : 2,
          border: editor ? "1px dashed rgba(245,158,11,0.95)" : "none",
          borderRadius: 18,
          background: "transparent",
          boxSizing: "border-box",
          touchAction: "none",
          cursor: editor ? "move" : "default",
          pointerEvents: "auto",
          overflow: "visible",
        }}
      >
        {editor ? (
          <div
            onPointerDown={(event) => startInteraction(event, "move")}
            style={{ position: "absolute", top: -12, left: 10, zIndex: 10, cursor: "move", display: "flex", gap: 4, alignItems: "center" }}
          >
            <span style={{ ...sharedStyles.editorChip, background: "#f59e0b", color: "#111827" }}>{imageLabel || "Drag Image"}</span>
            {onMoveLayer ? (
              <>
                <button
                  type="button"
                  data-overlay-resize="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onMoveLayer(-1); }}
                  style={{ ...sharedStyles.editorChip, background: "#334155", color: "#fff", padding: "2px 6px", fontSize: 16, cursor: "pointer" }}
                  title="Move layer backward"
                >? Back</button>
                <button
                  type="button"
                  data-overlay-resize="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onMoveLayer(1); }}
                  style={{ ...sharedStyles.editorChip, background: "#334155", color: "#fff", padding: "2px 6px", fontSize: 16, cursor: "pointer" }}
                  title="Move layer forward"
                >? Front</button>
              </>
            ) : null}
          </div>
        ) : null}
        <div style={{ width: "100%", height: "100%", overflow: "hidden", background: "transparent", ...(frameStyle ? { borderRadius: frameStyle.borderRadius, boxShadow: frameStyle.boxShadow, border: frameStyle.border } : { borderRadius: 0 }) }}>
          <img src={imageSrc} alt={props?.floatingAlt || "Overlay image"} style={{ width: "100%", height: "100%", objectFit: imageFit, display: "block", pointerEvents: "none", userSelect: "none" }} onError={(e) => { e.target.style.display = "none"; }} />
        </div>
        {editor && isActive ? [
          // Corners — resize both dimensions
          { key: "nw",     left: -7, top: -7,       cursor: "nwse-resize", width: 14, height: 14, dotRadius: 999 },
          { key: "ne",     right: -7, top: -7,      cursor: "nesw-resize", width: 14, height: 14, dotRadius: 999 },
          { key: "sw",     left: -7, bottom: -7,    cursor: "nesw-resize", width: 14, height: 14, dotRadius: 999 },
          { key: "se",     right: -7, bottom: -7,   cursor: "nwse-resize", width: 14, height: 14, dotRadius: 999 },
          // Center edges — larger transparent hit zone wraps a visible inner dot
          { key: "top",    top: -14,    left: "50%", transform: "translateX(-50%)", cursor: "ns-resize",  width: 36, height: 28, dotRadius: 4, dotW: 28, dotH: 14, dotTop: 14, dotLeft: 4 },
          { key: "bottom", bottom: -14, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize",  width: 36, height: 28, dotRadius: 4, dotW: 28, dotH: 14, dotTop: 0,  dotLeft: 4 },
          { key: "left",   left: -14,   top: "50%",  transform: "translateY(-50%)", cursor: "ew-resize",  width: 28, height: 36, dotRadius: 4, dotW: 14, dotH: 28, dotTop: 4,  dotLeft: 14 },
          { key: "right",  right: -14,  top: "50%",  transform: "translateY(-50%)", cursor: "ew-resize",  width: 28, height: 36, dotRadius: 4, dotW: 14, dotH: 28, dotTop: 4,  dotLeft: 0 },
        ].map((handle) => (
          <div
            key={handle.key}
            data-overlay-resize="true"
            onPointerDown={(event) => startInteraction(event, "resize", handle.key)}
            style={{ position: "absolute", background: "transparent", pointerEvents: "auto", zIndex: 10, boxSizing: "border-box", width: handle.width, height: handle.height, left: handle.left, right: handle.right, top: handle.top, bottom: handle.bottom, transform: handle.transform, cursor: handle.cursor }}
          >
            {handle.dotRadius === 999
              ? <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: "#f59e0b", border: "2px solid #fff", boxShadow: "0 6px 16px rgba(245,158,11,0.35)", pointerEvents: "none" }} />
              : <div style={{ position: "absolute", top: handle.dotTop, left: handle.dotLeft, width: handle.dotW, height: handle.dotH, borderRadius: handle.dotRadius, background: "#f59e0b", border: "2px solid #fff", boxShadow: "0 6px 16px rgba(245,158,11,0.35)", pointerEvents: "none" }} />
            }
          </div>
        )).concat([
          // Rotate handle — purple circle with ? icon, positioned above the image center
          <div
            key="rotate-handle"
            data-overlay-resize="true"
            onPointerDown={(event) => startInteraction(event, "rotate")}
            style={{ position: "absolute", bottom: -36, left: "50%", transform: "translateX(-50%)", zIndex: 10, width: 24, height: 24, borderRadius: 999, background: "#a78bfa", border: "2px solid #fff", cursor: "grab", display: "grid", placeItems: "center", fontSize: 14, color: "#fff", pointerEvents: "auto", boxShadow: "0 4px 12px rgba(167,139,250,0.45)", userSelect: "none" }}
            title={`Rotate image — current: ${displayRotation}°`}
          >?</div>,
        ]).concat(onDelete ? [
          <button
            key="delete-overlay"
            type="button"
            data-overlay-resize="true"
            onPointerDown={(event) => { event.stopPropagation(); }}
            onClick={(event) => { event.stopPropagation(); onDelete(); }}
            style={{ position: "absolute", top: -8, right: -8, zIndex: 7, width: 22, height: 22, borderRadius: 999, background: "rgba(239,68,68,0.92)", border: "2px solid #fff", color: "#fff", fontSize: 16, lineHeight: 1, cursor: "pointer", display: "grid", placeItems: "center", boxShadow: "0 4px 12px rgba(239,68,68,0.4)", padding: 0 }}
            title="Remove image"
          >×</button>
        ] : []) : null}
      </div>
    </>
  );
}


// --- Standalone icon-counter block with inline edit panel --------------------
function IconCounterBlock({ props, compact, editor, onChangeBlock, sectionAnimationStyle, siteId = "" }) {
  const [showEdit, setShowEdit] = React.useState(false);
  const panelRef = React.useRef(null);
  const update = (patch) => onChangeBlock?.({ ...props, ...patch });

  // Close panel when clicking outside
  React.useEffect(() => {
    if (!showEdit) return undefined;
    const handleDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setShowEdit(false);
    };
    window.addEventListener("pointerdown", handleDown, true);
    return () => window.removeEventListener("pointerdown", handleDown, true);
  }, [showEdit]);

  const icBg = props.backgroundColor || "#0b0c1a";
  const icNumberColor = props.numberColor || "#0c8ce9";
  const icLabelColor = props.labelColor || "rgba(255,255,255,0.85)";
  const icLabel = props.label || "Site Visits...and counting";
  const icMinHeight = props.minHeight || "180px";
  const icTargetNumber = props.targetNumber != null ? Number(props.targetNumber) : null;
  const icStartNumber = props.startNumber != null ? Number(props.startNumber) : 0;
  const icSuffix = props.suffix || "";
  const icDiamondColor = props.diamondColor || "rgba(255,255,255,0.15)";
  const icNumberFontSize = props.numberFontSize ? Number(props.numberFontSize) : undefined;
  const icNumberFontFamily = props.numberFontFamily && props.numberFontFamily !== "inherit" ? props.numberFontFamily : undefined;
  const icLabelFontSize = compact ? 16 : (props.labelFontSize ? Number(props.labelFontSize) : 22);
  const icLabelFontFamily = props.labelFontFamily && props.labelFontFamily !== "inherit" ? props.labelFontFamily : undefined;
  const icLabelFontWeight = props.labelFontWeight || "600";

  const diamondSize = compact ? 100 : 140;

  const inpStyle = { padding: "5px 8px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", fontSize: 16, outline: "none", width: "100%", boxSizing: "border-box" };
  const stepBtn = { width: 28, height: 28, borderRadius: 5, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", cursor: "pointer", fontSize: 16, flexShrink: 0 };
  const lbl = { display: "flex", flexDirection: "column", gap: 3, fontSize: 16, color: "#94a3b8" };

  return (
    <ScrollReveal
      as="section"
      animationName={props.sectionAnimation}
      delay={props.sectionAnimationDelay || 0}
      speed={props.sectionAnimationSpeed}
      disabled={editor}
      style={{
        position: "relative",
        overflow: "visible",
        backgroundColor: icBg,
        minHeight: icMinHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...sectionAnimationStyle,
      }}
    >
      {/* Diamond watermark */}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        fill="none"
        stroke={icDiamondColor}
        strokeWidth="2.5"
        style={{
          position: "absolute",
          width: diamondSize,
          height: diamondSize,
          left: compact ? 12 : 32,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
        }}
      >
        <polygon points="50,4 96,50 50,96 4,50" />
      </svg>

      {/* Counter + label */}
      <div style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? 20 : 36,
        padding: compact ? "32px 24px 32px 80px" : "48px 48px 48px 120px",
      }}>
        <IconCounterNumber
          projectId={String(props.projectId || siteId || "")}
          targetNumber={icTargetNumber}
          startNumber={icStartNumber}
          suffix={icSuffix}
          color={icNumberColor}
          compact={compact}
          editor={editor}
          fontSize={icNumberFontSize}
          fontFamily={icNumberFontFamily}
        />
        <p
          data-website-inline-editor="true"
          contentEditable={editor}
          suppressContentEditableWarning
          onMouseDown={(e) => { if (editor) e.stopPropagation(); }}
          onPointerDown={(e) => { if (editor) e.stopPropagation(); }}
          onBlur={(e) => {
            if (!editor || typeof onChangeBlock !== "function") return;
            update({ label: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
          }}
          style={{
            margin: 0,
            fontSize: icLabelFontSize,
            fontWeight: icLabelFontWeight,
            fontFamily: icLabelFontFamily,
            color: icLabelColor,
            lineHeight: 1.35,
            maxWidth: compact ? 160 : 220,
            outline: editor ? "1px dashed rgba(125,211,252,0.55)" : "none",
            padding: editor ? "4px 6px" : 0,
            borderRadius: 8,
            cursor: editor ? "text" : "default",
          }}
          dangerouslySetInnerHTML={{ __html: icLabel }}
        />
      </div>

      {/* Editor toolbar chip */}
      {editor ? (
        <div ref={panelRef} style={{ position: "absolute", top: 8, right: 10, zIndex: 20 }}>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setShowEdit((v) => !v); }}
            style={{ ...sharedStyles.editorChip, background: showEdit ? "#0ea5e9" : undefined, color: showEdit ? "#fff" : undefined }}
          >
            {showEdit ? "? Close" : "? Edit Counter"}
          </button>

          {showEdit ? (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                zIndex: 30,
                background: "#1e293b",
                border: "1px solid rgba(14,165,233,0.45)",
                borderRadius: 12,
                padding: "12px 14px",
                boxShadow: "0 8px 28px rgba(0,0,0,0.65)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                minWidth: 280,
                maxHeight: "70vh",
                overflowY: "auto",
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 600, color: "#38bdf8", letterSpacing: "0.08em" }}>COUNTER SETTINGS</span>

              <label style={lbl}>
                Label text
                <input type="text" value={props.label || ""} onChange={(e) => update({ label: e.target.value })} style={inpStyle} />
              </label>

              {/* Numbers */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label style={lbl}>
                  Target number
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button type="button" style={stepBtn} onClick={() => update({ targetNumber: Math.max(0, (Number(props.targetNumber) || 0) - 100) })}>-</button>
                    <input type="number" value={props.targetNumber ?? 0} onChange={(e) => update({ targetNumber: Number(e.target.value) })} style={{ ...inpStyle, textAlign: "center", flex: 1, minWidth: 0 }} />
                    <button type="button" style={stepBtn} onClick={() => update({ targetNumber: (Number(props.targetNumber) || 0) + 100 })}>+</button>
                  </div>
                </label>
                <label style={lbl}>
                  Start number
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button type="button" style={stepBtn} onClick={() => update({ startNumber: Math.max(0, (Number(props.startNumber) || 0) - 100) })}>-</button>
                    <input type="number" value={props.startNumber ?? 0} onChange={(e) => update({ startNumber: Number(e.target.value) })} style={{ ...inpStyle, textAlign: "center", flex: 1, minWidth: 0 }} />
                    <button type="button" style={stepBtn} onClick={() => update({ startNumber: (Number(props.startNumber) || 0) + 100 })}>+</button>
                  </div>
                </label>
              </div>

              <label style={lbl}>
                Suffix (e.g. + or %)
                <input type="text" value={props.suffix || ""} onChange={(e) => update({ suffix: e.target.value })} style={inpStyle} placeholder="+" />
              </label>

              {/* Colors */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <label style={lbl}>
                  Number color
                  <input type="color" value={/^#[0-9a-f]{3,6}$/i.test(props.numberColor || "") ? props.numberColor : "#0c8ce9"} onChange={(e) => update({ numberColor: e.target.value })}
                    style={{ width: "100%", height: 30, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent" }} />
                </label>
                <label style={lbl}>
                  Label color
                  <input type="color" value={/^#[0-9a-f]{3,6}$/i.test(props.labelColor || "") ? props.labelColor : "#ffffff"} onChange={(e) => update({ labelColor: e.target.value })}
                    style={{ width: "100%", height: 30, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent" }} />
                </label>
                <label style={lbl}>
                  Background
                  <input type="color" value={/^#[0-9a-f]{3,6}$/i.test(props.backgroundColor || "") ? props.backgroundColor : "#0b0c1a"} onChange={(e) => update({ backgroundColor: e.target.value })}
                    style={{ width: "100%", height: 30, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent" }} />
                </label>
              </div>

              {/* Font sizes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label style={lbl}>
                  Number size
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button type="button" style={stepBtn} onClick={() => update({ numberFontSize: Math.max(20, (Number(props.numberFontSize) || 78) - 4) })}>-</button>
                    <span style={{ flex: 1, textAlign: "center", color: "#e2e8f0", fontSize: 16 }}>{props.numberFontSize || 78}</span>
                    <button type="button" style={stepBtn} onClick={() => update({ numberFontSize: Math.min(180, (Number(props.numberFontSize) || 78) + 4) })}>+</button>
                  </div>
                </label>
                <label style={lbl}>
                  Label size
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button type="button" style={stepBtn} onClick={() => update({ labelFontSize: Math.max(10, (Number(props.labelFontSize) || 22) - 2) })}>-</button>
                    <span style={{ flex: 1, textAlign: "center", color: "#e2e8f0", fontSize: 16 }}>{props.labelFontSize || 22}</span>
                    <button type="button" style={stepBtn} onClick={() => update({ labelFontSize: Math.min(72, (Number(props.labelFontSize) || 22) + 2) })}>+</button>
                  </div>
                </label>
              </div>

              <button type="button" onClick={() => setShowEdit(false)}
                style={{ marginTop: 2, padding: "6px 0", borderRadius: 7, border: "none", background: "#0ea5e9", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Done</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </ScrollReveal>
  );
}


// --- Framer Portfolio Block (horizontal carousel, click-to-reveal) ------------
function FramerPortfolioBlock({ props, compact, editor, onUploadImage, onChangeBlock }) {
  const sectionRef = React.useRef(null);
  const scrollRef = React.useRef(null);
  const fileInputRefs = React.useRef({});
  const hoveredRef = React.useRef(false);
  const wheelLockRef = React.useRef(0);
  const [cardW, setCardW] = React.useState(0);
  const [hoveredIdx, setHoveredIdx] = React.useState(null);
  const cards = Array.isArray(props.cards) ? props.cards : [];
  const bg = props.backgroundColor || "#000";
  const GAP = 12;
  const CARD_HEIGHT = Math.max(180, Number(props.cardHeight || 600));
  const visibleCount = Math.max(1, Number(compact ? 1 : props.visibleCount || 3));
  const autoScrollEnabled = !!props.autoScroll;
  const scrollMode = String(props.scrollMode || "card");
  const loopScroll = props.loopScroll !== false;
  const pauseOnHover = props.pauseOnHover !== false;
  const cardIntervalMs = Math.max(700, Number(props.cardScrollInterval || 2500));
  const continuousSpeed = Math.max(5, Number(props.continuousScrollSpeed || 45));
  const renderCards = autoScrollEnabled && scrollMode === "continuous" && loopScroll && cards.length > 1
    ? [...cards, ...cards]
    : cards;

  // Measure container so cards are exactly 1/3 in pixels
  React.useEffect(() => {
    if (!sectionRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const measuredWidth = entries[0]?.contentRect?.width || 0;
      const fallbackWidth = scrollRef.current?.clientWidth || 0;
      const w = measuredWidth || fallbackWidth;
      const gaps = Math.max(0, Math.ceil(visibleCount) - 1) * GAP;
      setCardW(compact ? w : Math.floor((w - gaps) / visibleCount));
    });
    ro.observe(sectionRef.current);
    return () => ro.disconnect();
  }, [compact, visibleCount]);

  const getCardStep = React.useCallback((el) => {
    const measuredStep = Number(cardW || 0);
    if (measuredStep > 1) return measuredStep + GAP;
    const fallbackVisible = Math.max(1, Number(compact ? 1 : props.visibleCount || 3));
    const fallbackGaps = Math.max(0, Math.ceil(fallbackVisible) - 1) * GAP;
    const fallbackWidth = Math.floor((Math.max(0, el.clientWidth - fallbackGaps)) / fallbackVisible);
    return Math.max(160, fallbackWidth) + GAP;
  }, [cardW, compact, props.visibleCount]);

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const step = getCardStep(el);
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const nextLeft = el.scrollLeft + dir * step;
    if (loopScroll && nextLeft > maxScroll - 4) {
      el.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    if (loopScroll && nextLeft < 0) {
      el.scrollTo({ left: maxScroll, behavior: "smooth" });
      return;
    }
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const handleWheel = (event) => {
    const el = scrollRef.current;
    if (!el) return;

    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    if (maxScroll <= 1) return;

    const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const deltaModeMultiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientWidth : 1;
    const delta = rawDelta * deltaModeMultiplier;
    if (!delta) return;

    const atStart = el.scrollLeft <= 1;
    const atEnd = el.scrollLeft >= maxScroll - 1;

    event.preventDefault();
    event.stopPropagation();

    if (!loopScroll && ((delta < 0 && atStart) || (delta > 0 && atEnd))) return;

    if (scrollMode === "card") {
      const now = Date.now();
      if (now - wheelLockRef.current < 420) return;
      wheelLockRef.current = now;
      scroll(delta > 0 ? 1 : -1);
      return;
    }

    el.scrollBy({ left: delta, behavior: "auto" });
  };

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [cardW, loopScroll, scrollMode]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el || !autoScrollEnabled || cards.length <= 1) return undefined;

    if (scrollMode === "card") {
      const timer = window.setInterval(() => {
        if (pauseOnHover && hoveredRef.current) return;
        const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
        const step = getCardStep(el);
        const nextLeft = el.scrollLeft + step;
        if (nextLeft > maxScroll - 4) {
          if (loopScroll) el.scrollTo({ left: 0, behavior: "smooth" });
          return;
        }
        el.scrollBy({ left: step, behavior: "smooth" });
      }, cardIntervalMs);
      return () => window.clearInterval(timer);
    }

    let rafId = 0;
    let lastTime = 0;
    const loopPoint = loopScroll ? Math.max(1, el.scrollWidth / 2) : 0;

    function tick(time) {
      rafId = window.requestAnimationFrame(tick);
      if (!lastTime) {
        lastTime = time;
        return;
      }
      const deltaSeconds = Math.min(0.08, (time - lastTime) / 1000);
      lastTime = time;
      if (pauseOnHover && hoveredRef.current) return;

      el.scrollLeft += continuousSpeed * deltaSeconds;
      if (loopScroll && loopPoint > 1 && el.scrollLeft >= loopPoint) {
        el.scrollLeft -= loopPoint;
      } else if (!loopScroll && el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) {
        window.cancelAnimationFrame(rafId);
      }
    }

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [autoScrollEnabled, cards.length, cardIntervalMs, continuousSpeed, getCardStep, loopScroll, pauseOnHover, scrollMode]);

  const handleUpload = async (cardIdx, file) => {
    if (!file) return;
    const asset = await Promise.resolve(onUploadImage?.("__fp_card_image__", file));
    if (!asset?.src) return;
    const updated = cards.map((c, i) => i === cardIdx ? { ...c, image: asset.src, imageAssetId: asset.id || "" } : c);
    onChangeBlock?.({ ...props, cards: updated });
  };

  return (
    <section ref={sectionRef} style={{ background: bg, width: "100%", boxSizing: "border-box", position: "relative", overflow: "hidden" }}>

      {/* Left arrow */}
      <button type="button" onClick={() => scroll(-1)} style={{ position: "absolute", left: 0, top: 0, bottom: 0, zIndex: 20, width: 52, background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 32, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", userSelect: "none" }}>
        ‹
      </button>

      {/* Scroll track */}
      <div ref={scrollRef} className="__fp_track" style={{ display: "flex", gap: GAP, padding: "0 0", overflowX: "auto", overscrollBehavior: "contain", touchAction: "pan-x", scrollSnapType: scrollMode === "card" ? "x mandatory" : "none", scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
        {renderCards.map((card, idx) => {
          const sourceIdx = cards.length ? idx % cards.length : idx;
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={`${card.id || sourceIdx}-${idx}`}
              style={{ flexShrink: 0, width: cardW || `${100 / visibleCount}%`, height: CARD_HEIGHT, scrollSnapAlign: scrollMode === "card" ? "start" : "none", position: "relative", overflow: "hidden", background: "#111", cursor: "pointer" }}
              onMouseEnter={() => { hoveredRef.current = true; setHoveredIdx(idx); }}
              onMouseLeave={() => { hoveredRef.current = false; setHoveredIdx(null); }}
              onDoubleClick={() => { if (editor) fileInputRefs.current[sourceIdx]?.click(); }}
            >
              {/* Full image — contain so nothing is cropped */}
              {card.image
                ? <img src={card.image} alt={card.title || ""} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }} />
                : <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "linear-gradient(135deg,#1e1b4b,#312e81)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.35)", fontSize: 16 }}>No image — double-click to upload</div>
              }

              {/* Hover dark overlay */}
              <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.55)", opacity: isHovered ? 1 : 0, transition: "opacity 0.25s ease", pointerEvents: "none" }} />

              {/* Editor: always-visible upload button */}
              {editor ? (
                <label
                  style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", zIndex: 20, display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "rgba(0,0,0,0.8)", border: "2px solid rgba(255,255,255,0.4)", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  🖼️ {card.image ? "Replace image" : "Upload image"}
                  <input
                    ref={(el) => { fileInputRefs.current[sourceIdx] = el; }}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleUpload(sourceIdx, f); }}
                  />
                </label>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Right arrow */}
      <button type="button" onClick={() => scroll(1)} style={{ position: "absolute", right: 0, top: 0, bottom: 0, zIndex: 20, width: 52, background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 32, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", userSelect: "none" }}>
        ›
      </button>

      <style>{`.__fp_track::-webkit-scrollbar{display:none}`}</style>
    </section>
  );
}

// --- Hover Cards Block --------------------------------------------------------
function HoverCardsBlock({ props, compact, editor, navigationContext }) {
  const [flippedIndex, setFlippedIndex] = React.useState(null);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [hovering, setHovering] = React.useState(false);
  // measured.cardPxWidth = exact px width per card; measured.autoVC = auto-calculated visible cards (fullWidth mode)
  const [measured, setMeasured] = React.useState({ cardPxWidth: 0, autoVC: null });
  const viewportRef = React.useRef(null);

  const cards = Array.isArray(props.cards) ? props.cards : [];
  const fullWidth = !!props.fullWidth;
  const minCardWidth = Number(props.minCardWidth || 280);
  const cardGap = Number(props.cardGap || 16);
  const propVC = Math.max(1, Math.min(cards.length || 1, Number(props.visibleCards || 3)));

  // In fullWidth mode auto-derive visible card count from measured container width
  const visibleCards = compact ? 1 : (fullWidth && measured.autoVC !== null ? measured.autoVC : propVC);

  const cardHeight = Number(props.cardHeight || 320);
  const cardRadius = Number(props.cardRadius || 12);
  const cardPadding = Number(props.cardPadding || 20);
  const backColor = props.overlayColor || "#000000";
  const buttonColor = props.buttonColor || "#ffffff";
  const buttonTextColor = props.buttonTextColor || "#0f172a";
  const buttonText = props.buttonText || "Learn more ?";
  const arrowBg = props.arrowBg || "#ffffff";
  const arrowColor = props.arrowColor || "#0f172a";
  const autoPlayInterval = Number(props.autoPlayInterval || 3500);
  const maxIndex = Math.max(0, cards.length - visibleCards);
  const seamlessLoop = props.continuousLoop !== false && cards.length > visibleCards;
  const loopSpeed = Math.max(8, Number(props.continuousSpeed || 45));
  const showArrows = !seamlessLoop && maxIndex > 0;

  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const vw = el.offsetWidth;
      if (fullWidth && !compact) {
        // Auto-fit as many cards as possible given minimum card width
        const auto = Math.max(1, Math.floor((vw + cardGap) / (minCardWidth + cardGap)));
        const clampedAuto = Math.min(auto, cards.length || 1);
        const w = (vw - (clampedAuto - 1) * cardGap) / clampedAuto;
        setMeasured({ cardPxWidth: w > 0 ? w : 0, autoVC: clampedAuto });
      } else {
        const vc = compact ? 1 : propVC;
        const w = (vw - (vc - 1) * cardGap) / vc;
        setMeasured((prev) => ({ ...prev, cardPxWidth: w > 0 ? w : 0 }));
      }
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [fullWidth, compact, minCardWidth, cardGap, propVC, cards.length]);

  React.useEffect(() => {
    setCurrentIndex((prev) => Math.min(prev, maxIndex));
  }, [maxIndex]);

  // Auto-advance loop — pauses while someone is reading a hovered/flipped card.
  React.useEffect(() => {
    if (seamlessLoop) return undefined;
    if (hovering || flippedIndex !== null) return undefined;
    if (maxIndex <= 0) return undefined;
    const id = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, autoPlayInterval);
    return () => clearInterval(id);
  }, [maxIndex, hovering, flippedIndex, autoPlayInterval, seamlessLoop]);

  const { cardPxWidth } = measured;
  const goTo = (idx) => setCurrentIndex(Math.max(0, Math.min(maxIndex, idx)));
  const offset = currentIndex * (cardPxWidth + cardGap);
  const loopDistance = seamlessLoop && cardPxWidth > 0 ? cards.length * (cardPxWidth + cardGap) : 0;
  const loopDuration = loopDistance > 0 ? Math.max(8, loopDistance / loopSpeed) : 0;
  const loopKeyframeName = `wbHoverCardsLoop_${cards.length}_${Math.round(cardPxWidth)}_${Math.round(cardGap)}`;
  const renderedCards = seamlessLoop ? [...cards, ...cards] : cards;
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < maxIndex;

  const sectionSidePad = compact ? 20 : Number(props.paddingSides ?? 40);
  const outerMaxWidth = fullWidth ? "100%" : Number(props.maxWidth || 1200);

  const arrowBtn = (side, enabled, label, onClick) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      aria-label={label}
      style={{
        position: "absolute",
        [side]: 10,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 10,
        width: 44,
        height: 44,
        borderRadius: "50%",
        border: "2px solid rgba(0,0,0,0.1)",
        background: arrowBg,
        color: arrowColor,
        fontSize: 24,
        lineHeight: "1",
        cursor: enabled ? "pointer" : "default",
        opacity: enabled ? 1 : 0.35,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
        transition: "opacity 0.2s",
        padding: 0,
        flexShrink: 0,
      }}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );

  return (
    <section style={{
      background: props.backgroundColor || "#f8fafc",
      padding: `${Number(props.paddingTop ?? 48)}px ${sectionSidePad}px ${Number(props.paddingBottom ?? 48)}px`,
      boxSizing: "border-box",
      width: "100%",
    }}>
      {props.sectionTitle ? (
        <h2 style={{
          textAlign: "center",
          fontSize: compact ? 22 : Math.max(18, Number(props.sectionTitleSize || 32)),
          fontWeight: 600,
          color: props.sectionTitleColor || "#0f172a",
          margin: "0 auto 32px",
          lineHeight: 1.2,
          maxWidth: 860,
        }}>
          {props.sectionTitle}
        </h2>
      ) : null}

      {/* Max-width centering wrapper */}
      <div style={{ maxWidth: outerMaxWidth, margin: "0 auto" }}>
        {/*
          Viewport: overflow:clip clips the sliding track without creating a stacking context,
          preserving transform-style:preserve-3d for the card flip animation.
          Arrows are positioned INSIDE this element (overlay on cards) — no negative
          positioning, no external clipping risk.
        */}
        <div
          ref={viewportRef}
          style={{ overflow: "clip", position: "relative" }}
          onMouseLeave={() => { setHovering(false); setFlippedIndex(null); }}
        >
          {showArrows ? arrowBtn("left", canPrev, "Previous", () => goTo(currentIndex - 1)) : null}
          {showArrows ? arrowBtn("right", canNext, "Next", () => goTo(currentIndex + 1)) : null}
          {seamlessLoop && loopDistance > 0 ? (
            <style>{`
              @keyframes ${loopKeyframeName} {
                from { transform: translate3d(0,0,0); }
                to { transform: translate3d(-${loopDistance}px,0,0); }
              }
            `}</style>
          ) : null}

          {/* Track — slides via translateX */}
          <div style={{
            display: "flex",
            gap: cardGap,
            transform: seamlessLoop ? "translateX(0)" : (cardPxWidth > 0 ? `translateX(-${offset}px)` : "translateX(0)"),
            transition: seamlessLoop ? "none" : "transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)",
            animation: seamlessLoop && loopDistance > 0 ? `${loopKeyframeName} ${loopDuration}s linear infinite` : "none",
            animationPlayState: seamlessLoop && hovering ? "paused" : "running",
            willChange: "transform",
          }}>
            {renderedCards.map((card, idx) => {
              const sourceIdx = idx % Math.max(cards.length, 1);
              const flipKey = `${Math.floor(idx / Math.max(cards.length, 1))}-${sourceIdx}`;
              const isFlipped = flippedIndex === flipKey;
              const basis = cardPxWidth > 0
                ? `${cardPxWidth}px`
                : `calc(${100 / visibleCards}% - ${(cardGap * (visibleCards - 1)) / visibleCards}px)`;
              return (
                <div
                  key={`${card.id || sourceIdx}-${idx}`}
                  tabIndex={0}
                  style={{ flex: `0 0 ${basis}`, minWidth: basis, height: cardHeight, perspective: "1000px", flexShrink: 0 }}
                  onMouseEnter={() => { setHovering(true); setFlippedIndex(flipKey); }}
                  onMouseLeave={() => { setHovering(false); setFlippedIndex(null); }}
                  onFocus={() => { setHovering(true); setFlippedIndex(flipKey); }}
                  onBlur={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget)) return;
                    setHovering(false);
                    setFlippedIndex(null);
                  }}
                >
                  {/* Flip container */}
                  <div style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    transformStyle: "preserve-3d",
                    transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    transition: "transform 0.65s cubic-bezier(0.4,0.2,0.2,1)",
                  }}>

                    {/* -- FRONT FACE ----------------------------------- */}
                    <div style={{
                      position: "absolute",
                      top: 0, left: 0, right: 0, bottom: 0,
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      borderRadius: cardRadius,
                      overflow: "hidden",
                      background: card.cardColor || props.cardColor || "#dde3ea",
                    }}>
                      {card.image ? (
                        <img src={card.image} alt={card.title || ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 16, fontStyle: "italic" }}>
                          No image
                        </div>
                      )}
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        padding: `${cardPadding * 2.5}px ${cardPadding}px ${cardPadding}px`,
                        background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)",
                      }}>
                        {card.title ? (
                          <div style={{ fontSize: 18, fontWeight: 600, color: "#fff", lineHeight: 1.3, textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
                            {card.title}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* -- BACK FACE ------------------------------------ */}
                    <div style={{
                      position: "absolute",
                      top: 0, left: 0, right: 0, bottom: 0,
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                      borderRadius: cardRadius,
                      overflow: "hidden",
                      background: backColor,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      justifyContent: "flex-end",
                      padding: cardPadding,
                      boxSizing: "border-box",
                    }}>
                      {card.title ? (
                        <div style={{ fontSize: Number(props.backTitleSize || 20), fontWeight: 600, color: "#fff", lineHeight: 1.3, marginBottom: 8 }}>{card.title}</div>
                      ) : null}
                      {card.description ? (
                        <div style={{ fontSize: Number(props.backDescSize || 15), color: "rgba(255,255,255,0.82)", lineHeight: 1.55, marginBottom: 18, whiteSpace: "pre-wrap" }}>{card.description}</div>
                      ) : null}
                      {card.link ? (
                        <a href={editor ? undefined : resolvePublishedNavHref({ href: card.link }, navigationContext)} style={{ display: "inline-flex", alignItems: "center", padding: "10px 22px", borderRadius: 8, background: buttonColor, color: buttonTextColor, fontSize: 16, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
                          {buttonText}
                        </a>
                      ) : (
                        <div style={{ display: "inline-flex", alignItems: "center", padding: "10px 22px", borderRadius: 8, background: buttonColor, color: buttonTextColor, fontSize: 16, fontWeight: 600, flexShrink: 0 }}>
                          {buttonText}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dot indicators */}
        {!seamlessLoop && maxIndex > 0 ? (
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 20 }}>
            {Array.from({ length: maxIndex + 1 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                style={{
                  width: currentIndex === i ? 22 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: currentIndex === i ? (props.dotsActiveColor || "#0f172a") : (props.dotsColor || "#cbd5e1"),
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  padding: 0,
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

// --- Feature Accordion Block -----------------------------------------------
function FeatureAccordionBlock({ props, compact, editor = false, onChangeBlock, onUploadImage }) {
  const items = asArray(props.items).map((item, idx) => ({
    id: item?.id || `fa-item-${idx}`,
    label: htmlToPlainText(item?.label || `Section ${idx + 1}`),
    image: item?.image || "",
    imageAlt: htmlToPlainText(item?.imageAlt || ""),
    accentColor: item?.accentColor || null,   // null ? falls back to global accent
    panelBg: item?.panelBg || null,           // null ? falls back to global bg/accent gradient
    contentBlocks: asArray(item?.contentBlocks).map((cb, cbIdx) => ({
      id: cb?.id || `cb-${idx}-${cbIdx}`,
      type: cb?.type || "text",
      ...cb,
    })),
  }));

  const [activeIdx, setActiveIdx] = React.useState(0);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const sectionRef = React.useRef(null);
  const fileInputRefs = React.useRef({});

  const bg        = props.backgroundColor || "#0f172a";
  const textColor = props.textColor       || "#ffffff";
  const accent    = props.accentColor     || "#0ea5e9";
  const imageRight = (props.imagePosition || "right") !== "left";
  const contentVerticalSetting = String(
    props.contentVerticalAlign || props.contentPosition || props.textPosition || props.textVerticalPosition || "top"
  ).toLowerCase();
  const contentVerticalAlign =
    contentVerticalSetting === "center" || contentVerticalSetting === "centre" || contentVerticalSetting === "middle"
      ? "center"
      : contentVerticalSetting === "bottom" || contentVerticalSetting === "end"
        ? "flex-end"
        : "flex-start";
  const leadOffset = Number(props.stickyTopOffset ?? 0);
  const [navH, setNavH] = React.useState(0);

  React.useEffect(() => {
    if (editor || compact || typeof window === "undefined") return;
    function measureNav() {
      const navShell = document.querySelector("[data-website-nav-shell]");
      if (navShell) {
        const rect = navShell.getBoundingClientRect();
        setNavH(Math.round(rect.height || 0));
      } else {
        setNavH(0);
      }
    }
    measureNav();
    window.addEventListener("resize", measureNav);
    return () => window.removeEventListener("resize", measureNav);
  }, [editor, compact]);

  // auto-detected nav height + manual lead offset
  const stickyTop = navH + leadOffset;

  // -- border props -----------------------------------------------------------
  const bEnabled   = props.itemBorderEnabled !== false;
  const bColor     = props.itemBorderColor   || "rgba(255,255,255,0.10)";
  const bStyle     = props.itemBorderStyle   || "solid";
  const bWidth     = Number(props.itemBorderWidth ?? 2);
  const bActiveColor = props.activeBorderColor || accent;
  const progressColor = props.progressColor  || accent;

  // -- scroll tracking (stacked card deck — published preview only) ----------
  React.useEffect(() => {
    if (editor || compact || typeof window === "undefined") return;
    const n = items.length;
    if (n === 0) return;
    function onScroll() {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const totalRange = el.offsetHeight - window.innerHeight;
      if (totalRange <= 0) { setScrollProgress(0); return; }
      const scrolledIn = -rect.top;
      const raw = Math.max(0, Math.min(n - 0.0001, (scrolledIn / totalRange) * n));
      setScrollProgress(raw);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [editor, compact, items.length]);

  // -- helpers ----------------------------------------------------------------

  function patchItems(newItems) {
    if (!editor || typeof onChangeBlock !== "function") return;
    onChangeBlock({ ...props, items: newItems });
  }

  function patchItemField(itemIdx, field, value) {
    patchItems(items.map((item, i) => i !== itemIdx ? item : { ...item, [field]: value }));
  }

  function patchContentBlock(itemIdx, cbIdx, patch) {
    const newBlocks = items[itemIdx].contentBlocks.map((cb, j) =>
      j !== cbIdx ? cb : { ...cb, ...patch }
    );
    patchItemField(itemIdx, "contentBlocks", newBlocks);
  }

  function addContentBlock(itemIdx, type) {
    const now = Date.now();
    const templates = {
      eyebrow: { id: `cb-${now}`, type: "eyebrow", text: "Category Label" },
      heading: { id: `cb-${now}`, type: "heading", text: "Your headline here" },
      text:    { id: `cb-${now}`, type: "text",    text: "Add your description here." },
      stat:    { id: `cb-${now}`, type: "stat",    number: "0%", label: "metric label" },
      tags:    { id: `cb-${now}`, type: "tags",    tags: ["Tag"] },
      cta:     { id: `cb-${now}`, type: "cta",     text: "Learn More", link: "#" },
    };
    const newBlock = templates[type] || templates.text;
    patchItemField(itemIdx, "contentBlocks", [...items[itemIdx].contentBlocks, newBlock]);
  }

  function removeContentBlock(itemIdx, cbIdx) {
    patchItemField(itemIdx, "contentBlocks", items[itemIdx].contentBlocks.filter((_, j) => j !== cbIdx));
  }

  function moveContentBlock(itemIdx, cbIdx, dir) {
    const blocks = [...items[itemIdx].contentBlocks];
    const target = cbIdx + dir;
    if (target < 0 || target >= blocks.length) return;
    [blocks[cbIdx], blocks[target]] = [blocks[target], blocks[cbIdx]];
    patchItemField(itemIdx, "contentBlocks", blocks);
  }

  function addItem() {
    const now = Date.now();
    patchItems([
      ...items,
      {
        id: `fa-item-${now}`,
        label: "New Section",
        image: "",
        imageAlt: "",
        contentBlocks: [
          { id: `cb-${now}-1`, type: "heading", text: "Your headline here" },
          { id: `cb-${now}-2`, type: "text",    text: "Add your description text here." },
          { id: `cb-${now}-3`, type: "cta",     text: "Learn More", link: "#" },
        ],
      },
    ]);
  }

  function removeItem(itemIdx) {
    patchItems(items.filter((_, i) => i !== itemIdx));
  }

  function jumpToCard(targetIdx) {
    const el = sectionRef.current;
    if (!el) return;
    const n = items.length;
    const totalRange = el.offsetHeight - window.innerHeight;
    const targetScroll = el.offsetTop + (targetIdx / n) * totalRange;
    window.scrollTo({ top: targetScroll, behavior: "smooth" });
  }

  async function handleImageUpload(itemIdx, file) {
    if (!file || typeof onUploadImage !== "function") return;
    const asset = await Promise.resolve(onUploadImage("__fa_item_image__", file));
    if (asset?.src) patchItemField(itemIdx, "image", asset.src);
  }

  // -- content block renderer -------------------------------------------------

  function renderCb(item, itemIdx, block, cbIdx, perCardAccent = accent) {
    const edgeOut    = editor ? "1px dashed rgba(14,165,233,0.35)" : "none";
    const edgePad    = editor ? "4px 6px" : "0";
    const totalBlocks = item.contentBlocks.length;

    const reorderControls = editor ? (
      React.createElement("div", { style: { display: "flex", flexShrink: 0, gap: 3, marginLeft: 8, alignSelf: "flex-start", paddingTop: 2 } },
        React.createElement("button", {
          type: "button",
          onClick: (e) => { e.stopPropagation(); moveContentBlock(itemIdx, cbIdx, -1); },
          disabled: cbIdx === 0,
          title: "Move up",
          style: { background: "rgba(255,255,255,0.08)", border: "none", color: cbIdx === 0 ? "rgba(255,255,255,0.2)" : "#e2e8f0", borderRadius: 4, padding: "3px 7px", fontSize: 16, cursor: cbIdx === 0 ? "default" : "pointer", fontWeight: 600 },
        }, "?"),
        React.createElement("button", {
          type: "button",
          onClick: (e) => { e.stopPropagation(); moveContentBlock(itemIdx, cbIdx, 1); },
          disabled: cbIdx === totalBlocks - 1,
          title: "Move down",
          style: { background: "rgba(255,255,255,0.08)", border: "none", color: cbIdx === totalBlocks - 1 ? "rgba(255,255,255,0.2)" : "#e2e8f0", borderRadius: 4, padding: "3px 7px", fontSize: 16, cursor: cbIdx === totalBlocks - 1 ? "default" : "pointer", fontWeight: 600 },
        }, "?"),
        React.createElement("button", {
          type: "button",
          onClick: (e) => { e.stopPropagation(); removeContentBlock(itemIdx, cbIdx); },
          title: "Remove block",
          style: { background: "rgba(239,68,68,0.18)", border: "none", color: "#f87171", borderRadius: 4, padding: "3px 7px", fontSize: 16, cursor: "pointer" },
        }, "?"),
      )
    ) : null;

    if (block.type === "eyebrow") {
      return (
        <div key={block.id} style={{ display: "flex", alignItems: "center" }}>
          <div
            data-website-inline-editor={editor ? "true" : undefined}
            contentEditable={editor}
            suppressContentEditableWarning
            onMouseDown={(e) => editor && e.stopPropagation()}
            onPointerDown={(e) => editor && e.stopPropagation()}
            onBlur={(e) => {
              if (shouldSkipToolbarBlur(e)) return;
              patchContentBlock(itemIdx, cbIdx, { text: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
            }}
            style={{ flex: 1, fontSize: 16, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: perCardAccent, outline: edgeOut, borderRadius: 4, padding: edgePad }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(block.text || "Category") }}
          />
          {reorderControls}
        </div>
      );
    }

    if (block.type === "heading") {
      return (
        <div key={block.id} style={{ display: "flex", alignItems: "flex-start" }}>
          <div
            data-website-inline-editor={editor ? "true" : undefined}
            contentEditable={editor}
            suppressContentEditableWarning
            onMouseDown={(e) => editor && e.stopPropagation()}
            onPointerDown={(e) => editor && e.stopPropagation()}
            onBlur={(e) => {
              if (shouldSkipToolbarBlur(e)) return;
              patchContentBlock(itemIdx, cbIdx, { text: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
            }}
            style={{ flex: 1, fontSize: compact ? 22 : (Number(props.headingFontSize) || 48), fontWeight: 600, lineHeight: 1.2, color: textColor, outline: edgeOut, borderRadius: 6, padding: edgePad }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(block.text || "Heading") }}
          />
          {reorderControls}
        </div>
      );
    }

    if (block.type === "text") {
      return (
        <div key={block.id} style={{ display: "flex", alignItems: "flex-start" }}>
          <div
            data-website-inline-editor={editor ? "true" : undefined}
            contentEditable={editor}
            suppressContentEditableWarning
            onMouseDown={(e) => editor && e.stopPropagation()}
            onPointerDown={(e) => editor && e.stopPropagation()}
            onBlur={(e) => {
              if (shouldSkipToolbarBlur(e)) return;
              patchContentBlock(itemIdx, cbIdx, { text: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
            }}
            style={{ flex: 1, fontSize: 16, lineHeight: 1.75, color: textColor, outline: edgeOut, borderRadius: 6, padding: edgePad }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(block.text || "Add your text here.") }}
          />
          {reorderControls}
        </div>
      );
    }

    if (block.type === "stat") {
      return (
        <div key={block.id} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
            <div
              data-website-inline-editor={editor ? "true" : undefined}
              contentEditable={editor}
              suppressContentEditableWarning
              onMouseDown={(e) => editor && e.stopPropagation()}
              onPointerDown={(e) => editor && e.stopPropagation()}
              onBlur={(e) => {
                if (shouldSkipToolbarBlur(e)) return;
                patchContentBlock(itemIdx, cbIdx, { number: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
              }}
              style={{ fontSize: 40, fontWeight: 600, color: perCardAccent, lineHeight: 1, outline: edgeOut, borderRadius: 4, padding: editor ? "2px 4px" : "0" }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(block.number || "0%") }}
            />
            <div
              data-website-inline-editor={editor ? "true" : undefined}
              contentEditable={editor}
              suppressContentEditableWarning
              onMouseDown={(e) => editor && e.stopPropagation()}
              onPointerDown={(e) => editor && e.stopPropagation()}
              onBlur={(e) => {
                if (shouldSkipToolbarBlur(e)) return;
                patchContentBlock(itemIdx, cbIdx, { label: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
              }}
              style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.4, outline: editor ? "1px dashed rgba(14,165,233,0.3)" : "none", borderRadius: 4, padding: editor ? "2px 4px" : "0" }}
              dangerouslySetInnerHTML={{ __html: renderStatLabelHtml(block.label || "metric") }}
            />
          </div>
          {reorderControls}
        </div>
      );
    }

    if (block.type === "tags") {
      const tags = asArray(block.tags);
      return (
        <div key={block.id} style={{ display: "flex", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flex: 1 }}>
            {tags.map((tag, tagIdx) => (
              <div key={tagIdx} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onMouseDown={(e) => editor && e.stopPropagation()}
                  onPointerDown={(e) => editor && e.stopPropagation()}
                  onBlur={(e) => {
                    if (shouldSkipToolbarBlur(e)) return;
                    const newTags = tags.map((t, i) => i !== tagIdx ? t : e.currentTarget.textContent || "");
                    patchContentBlock(itemIdx, cbIdx, { tags: newTags });
                  }}
                  style={{ display: "inline-block", background: "rgba(14,165,233,0.14)", color: perCardAccent, border: "1px solid rgba(14,165,233,0.25)", borderRadius: 20, padding: "4px 14px", fontSize: 16, fontWeight: 600, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none" }}
                >{tag}</span>
                {editor ? (
                  <button type="button" onClick={(e) => { e.stopPropagation(); patchContentBlock(itemIdx, cbIdx, { tags: tags.filter((_, i) => i !== tagIdx) }); }} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16, padding: "0 2px", lineHeight: 1 }}>×</button>
                ) : null}
              </div>
            ))}
            {editor ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); patchContentBlock(itemIdx, cbIdx, { tags: [...tags, "New Tag"] }); }} style={{ background: "rgba(14,165,233,0.12)", border: "1px dashed rgba(14,165,233,0.4)", color: perCardAccent, borderRadius: 20, padding: "4px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>+ Tag</button>
            ) : null}
          </div>
          {reorderControls}
        </div>
      );
    }

    if (block.type === "cta") {
      return (
        <div key={block.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <a
            href={editor ? undefined : (block.link || "#")}
            onClick={(e) => editor && e.preventDefault()}
            style={{ display: "inline-block", background: perCardAccent, color: "#ffffff", borderRadius: 8, padding: "13px 30px", fontSize: 16, fontWeight: 600, textDecoration: "none", cursor: editor ? "default" : "pointer" }}
          >
            <div
              data-website-inline-editor={editor ? "true" : undefined}
              contentEditable={editor}
              suppressContentEditableWarning
              onMouseDown={(e) => editor && e.stopPropagation()}
              onPointerDown={(e) => editor && e.stopPropagation()}
              onBlur={(e) => {
                if (shouldSkipToolbarBlur(e)) return;
                patchContentBlock(itemIdx, cbIdx, { text: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
              }}
              style={{ outline: editor ? "1px dashed rgba(255,255,255,0.4)" : "none", borderRadius: 4, padding: editor ? "1px 4px" : "0", display: "inline", color: "#fff" }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(block.text || "Learn More") }}
            />
          </a>
          {editor ? (
            <input
              type="text"
              value={block.link || ""}
              onChange={(e) => patchContentBlock(itemIdx, cbIdx, { link: e.target.value })}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="https://..."
              style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: textColor, borderRadius: 6, padding: "8px 12px", fontSize: 16 }}
            />
          ) : null}
          {reorderControls}
        </div>
      );
    }

    return null;
  }

  // -- image slot -------------------------------------------------------------
  function renderImageSlot(item, idx, forEditor = false) {
    return (
      <>
        {item.image ? (
          <img
            src={item.image}
            alt={item.imageAlt || item.label}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.04)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "rgba(255,255,255,0.35)" }}>
            <span style={{ fontSize: 36 }}>🖼️</span>
            {forEditor ? (
              <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 8, background: "rgba(14,165,233,0.15)", border: "1px dashed rgba(14,165,233,0.5)", color: accent, fontSize: 16, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                🖼️ Upload Image
                <input ref={(el) => { fileInputRefs.current[idx] = el; }} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleImageUpload(idx, f); }} />
              </label>
            ) : (
              <span style={{ fontSize: 16 }}>No image set</span>
            )}
          </div>
        )}
        {forEditor && item.image ? (
          <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.2)", color: "#e2e8f0", borderRadius: 6, padding: "5px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }} onClick={(e) => e.stopPropagation()}>
              ↻ Replace
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleImageUpload(idx, f); }} />
            </label>
            <button type="button" onClick={(e) => { e.stopPropagation(); patchItemField(idx, "image", ""); }} title="Remove image" style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", borderRadius: 6, padding: "5px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>×</button>
          </div>
        ) : null}
      </>
    );
  }

  // -- EDITOR: all items stacked, fully expanded ------------------------------
  if (editor) {
    return (
      <section style={{ width: "100%", background: bg, color: textColor, boxSizing: "border-box" }}>
        {(props.eyebrow || props.title) ? (
          <div style={{ padding: "64px 80px 40px" }}>
            {props.eyebrow ? <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, marginBottom: 12 }}>{htmlToPlainText(props.eyebrow)}</div> : null}
            {props.title ? <h2 style={{ fontSize: 44, fontWeight: 600, lineHeight: 1.1, color: textColor, margin: 0 }}>{htmlToPlainText(props.title)}</h2> : null}
          </div>
        ) : null}
        {items.map((item, idx) => {
          const itemBorder = bEnabled ? `${bWidth}px ${bStyle} ${bActiveColor}` : "none";
          return (
            <div key={item.id} style={{ margin: "0 0 16px", borderTop: itemBorder, borderBottom: itemBorder, background: item.panelBg || bg, overflow: "hidden" }}>
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 40px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <span style={{ width: 4, height: 28, borderRadius: 2, background: item.accentColor || accent, flexShrink: 0 }} />
                <div
                  data-website-inline-editor="true"
                  contentEditable
                  suppressContentEditableWarning
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onBlur={(e) => { if (shouldSkipToolbarBlur(e)) return; patchItemField(idx, "label", htmlToPlainText(cleanInlineEditorHtml(e.currentTarget.innerHTML))); }}
                  style={{ flex: 1, fontSize: 24, fontWeight: 600, lineHeight: 1.2, color: textColor, outline: "1px dashed rgba(14,165,233,0.4)", borderRadius: 6, padding: "3px 8px" }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(htmlToPlainText(item.label)) }}
                />
                <span style={{ color: "rgba(255,255,255,0.20)", fontSize: 16, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{String(idx + 1).padStart(2, "0")}&nbsp;/&nbsp;{String(items.length).padStart(2, "0")}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); removeItem(idx); }} style={{ background: "rgba(239,68,68,0.15)", border: "none", color: "#f87171", borderRadius: 6, padding: "4px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>Remove</button>
              </div>
              {/* 2-col body */}
              <div style={{ display: "flex", flexDirection: imageRight ? "row" : "row-reverse", minHeight: 380 }}>
                <div style={{ flex: "0 0 50%", maxWidth: "50%", display: "flex", flexDirection: "column", justifyContent: contentVerticalAlign, gap: 20, padding: "44px 56px" }}>
                  {item.contentBlocks.map((block, cbIdx) => renderCb(item, idx, block, cbIdx, item.accentColor || accent))}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, paddingTop: 12, borderTop: "1px dashed rgba(14,165,233,0.2)" }}>
                    {["eyebrow", "heading", "text", "stat", "tags", "cta"].map((type) => (
                      <button key={type} type="button" onClick={(e) => { e.stopPropagation(); addContentBlock(idx, type); }} style={{ background: "rgba(14,165,233,0.10)", border: "1px dashed rgba(14,165,233,0.35)", color: accent, borderRadius: 6, padding: "4px 10px", fontSize: 16, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>+ {type}</button>
                    ))}
                  </div>
                </div>
                <div style={{ flex: "0 0 50%", maxWidth: "50%", position: "relative", overflow: "hidden", minHeight: 320 }}>
                  {renderImageSlot(item, idx, true)}
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ padding: "24px 40px", display: "flex", justifyContent: "center" }}>
          <button type="button" onClick={(e) => { e.stopPropagation(); addItem(); }} style={{ background: "rgba(14,165,233,0.10)", border: "2px dashed rgba(14,165,233,0.4)", color: accent, borderRadius: 10, padding: "14px 36px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>+ Add Panel</button>
        </div>
      </section>
    );
  }

  // -- COMPACT / MOBILE: click-to-expand accordion ----------------------------
  if (compact) {
    return (
      <section style={{ width: "100%", background: bg, color: textColor, boxSizing: "border-box" }}>
        {(props.eyebrow || props.title) ? (
          <div style={{ padding: "40px 24px 24px" }}>
            {props.eyebrow ? <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, marginBottom: 10 }}>{htmlToPlainText(props.eyebrow)}</div> : null}
            {props.title ? <h2 style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1, color: textColor, margin: 0 }}>{htmlToPlainText(props.title)}</h2> : null}
          </div>
        ) : null}
        {items.map((item, idx) => {
          const isOpen = activeIdx === idx;
          const borderVal = bEnabled ? `${bWidth}px ${bStyle} ${isOpen ? bActiveColor : bColor}` : "none";
          return (
            <div key={item.id} style={{ borderBottom: borderVal, overflow: "hidden" }}>
              <div onClick={() => setActiveIdx(isOpen ? -1 : idx)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 24px", cursor: "pointer", userSelect: "none" }}>
                <span style={{ width: 3, height: 22, borderRadius: 2, background: isOpen ? (item.accentColor || accent) : "rgba(255,255,255,0.2)", flexShrink: 0, transition: "background 0.3s" }} />
                <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: textColor }}>{item.label}</span>
                <span style={{ color: isOpen ? (item.accentColor || accent) : "rgba(255,255,255,0.35)", fontSize: 18, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s", display: "inline-block" }}>⌄</span>
              </div>
              <div style={{ display: "grid", gridTemplateRows: isOpen ? "1fr" : "0fr", transition: "grid-template-rows 0.4s cubic-bezier(0.4,0,0.2,1)" }}>
                <div style={{ overflow: "hidden", minHeight: 0 }}>
                  {item.image ? <img src={item.image} alt={item.imageAlt || item.label} style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block" }} /> : null}
                  <div style={{ padding: "16px 24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
                    {item.contentBlocks.map((block, cbIdx) => renderCb(item, idx, block, cbIdx, item.accentColor || accent))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    );
  }

  // -- PUBLISHED: stacked card deck ------------------------------------------
  // Peek heights decrease per card: top card shows most, deeper cards show less
  const peeks = items.map((_, i) => Math.max(60, 90 - i * 8));
  const n = items.length;
  // Subtract nav bar height so cards occupy the space below the nav
  const vp = ((typeof window !== "undefined" && window.innerHeight) || 800) - stickyTop;
  // Cumulative settled Y (cards stack from top, each peeking their amount)
  const cardLead = Number(props.cardLead ?? 0);
  const hInset = Number(props.cardInset ?? 0);
  const settledYs = items.map((_, idx) => {
    let y = cardLead;
    for (let i = 0; i < idx; i++) y += peeks[i];
    return y;
  });
  // Future Y (cards peek from bottom, deeper cards further down)
  const futureYs = items.map((_, idx) => {
    let y = vp;
    for (let i = n - 1; i >= idx; i--) y -= peeks[i];
    return y;
  });

  return (
    <section
      ref={sectionRef}
      style={{ width: "100%", position: "relative", height: `${n * 100}vh`, boxSizing: "border-box" }}
    >
      <div style={{ position: "sticky", top: stickyTop, height: `calc(100vh - ${stickyTop}px)`, overflow: "hidden" }}>
        {items.map((item, idx) => {
          const cardBg = item.panelBg || item.accentColor || bg;
          const cardText = textColor;
          const itemAccent = item.accentColor || accent;
          const dist = idx - scrollProgress;
          let y;
          if (dist <= 0) {
            y = settledYs[idx];
          } else if (dist < 1) {
            const t = 1 - dist;
            y = futureYs[idx] + t * (settledYs[idx] - futureYs[idx]);
          } else {
            y = futureYs[idx];
          }
          const isPast = dist < -0.02;
          const isFuture = dist > 0.02;
          const isActive = !isPast && !isFuture;
          const peekH = peeks[idx];

          return (
            <div
              key={item.id}
              style={{
                position: "absolute",
                left: hInset, right: hInset, top: 0,
                height: "100vh",
                transform: `translateY(${y}px)`,
                zIndex: idx + 1,
                background: cardBg,
                color: cardText,
                borderRadius: (idx > 0 || hInset > 0) ? `${Number(props.cardRadius ?? 18)}px ${Number(props.cardRadius ?? 18)}px 0 0` : 0,
                boxShadow: idx > 0 ? "0 -6px 24px rgba(0,0,0,0.22)" : "none",
                border: Number(props.cardBorderWidth ?? 0) > 0 ? `${Number(props.cardBorderWidth)}px solid ${props.cardBorderColor || "#3b82f6"}` : "none",
                overflow: "hidden",
                boxSizing: "border-box",
                willChange: "transform",
              }}
            >
              {/* -- Header strip — always visible, always clickable -- */}
              <div
                onClick={() => jumpToCard(idx)}
                style={{
                  height: peekH,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "0 28px",
                  cursor: "pointer",
                  userSelect: "none",
                  flexShrink: 0,
                  borderBottom: "1px solid rgba(255,255,255,0.12)",
                  background: isPast ? "rgba(0,0,0,0.18)" : isFuture ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.14)",
                }}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: itemAccent,
                  flexShrink: 0,
                  boxShadow: `0 0 6px ${itemAccent}88`,
                }} />
                <span style={{
                  flex: 1,
                  fontSize: 16,
                  fontWeight: 600,
                  color: cardText,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {item.label}
                </span>
                <span style={{
                  fontSize: 26,
                  opacity: isActive ? 0.85 : 0.45,
                  flexShrink: 0,
                  transform: isActive ? "rotate(90deg)" : "none",
                  transition: "transform 0.3s, opacity 0.3s",
                }}>⌄</span>
              </div>

              {/* -- Full content area -- */}
              <div style={{
                height: `calc(100vh - ${peekH}px)`,
                display: "flex",
                flexDirection: imageRight ? "row" : "row-reverse",
                overflow: "hidden",
              }}>
                {/* Content half */}
                <div style={{
                  flex: "0 0 50%",
                  maxWidth: "50%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: contentVerticalAlign,
                  gap: 18,
                  padding: "40px 52px",
                  overflowY: "auto",
                  scrollbarWidth: "none",
                  boxSizing: "border-box",
                }}>
                  {item.contentBlocks.map((block, cbIdx) => renderCb(item, idx, block, cbIdx, itemAccent))}
                </div>
                {/* Image half */}
                <div style={{
                  flex: "0 0 50%",
                  maxWidth: "50%",
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {renderImageSlot(item, idx, false)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}





// --- ScrollStackBlock -------------------------------------------------------
// Full-page stacking panels: image one side, text the other.
// Preview: CSS position:sticky makes each panel "stack" over the previous as user scrolls.
// Editor: panels rendered flat so the canvas stays editable.
// imageStyle "card" = inset rounded card with colored bg
// imageStyle "bleed" = full-bleed image fills the entire half

function ScrollStackBlock({ props, compact, editor = false, onChangeBlock, onUploadImage }) {
  const panels = asArray(props.panels).map((p, idx) => ({
    id: p?.id || `ss-panel-${idx}`,
    eyebrow: p?.eyebrow ?? "",
    eyebrowDot: p?.eyebrowDot !== false,
    heading: p?.heading ?? "",
    body: p?.body ?? "",
    showCta: p?.showCta !== false,
    ctaText: p?.ctaText ?? "",
    ctaUrl: p?.ctaUrl ?? "#",
    ctaStyle: p?.ctaStyle ?? "filled",
    buttonFullWidth: p?.buttonFullWidth === true || p?.ctaFullWidth === true,
    image: p?.image ?? "",
    imageAlt: p?.imageAlt ?? "",
    imageStyle: p?.imageStyle ?? "bleed",
    imageCardBg: p?.imageCardBg ?? (p?.accentColor ?? "#0ea5e9"),
    imagePosition: p?.imagePosition ?? "right",
    backgroundColor: p?.backgroundColor ?? "#0f172a",
    textColor: p?.textColor ?? "#ffffff",
    accentColor: p?.accentColor ?? "#0ea5e9",
  }));

  const fileInputRefs = React.useRef({});

  function patchPanels(newPanels) {
    if (!editor || typeof onChangeBlock !== "function") return;
    onChangeBlock({ ...props, panels: newPanels });
  }

  function patchPanel(idx, patch) {
    patchPanels(panels.map((p, i) => i !== idx ? p : { ...p, ...patch }));
  }

  function addPanel() {
    const now = Date.now();
    const len = panels.length;
    patchPanels([
      ...panels,
      {
        id: `ss-panel-${now}`,
        eyebrow: `Section ${len + 1}`,
        eyebrowDot: true,
        heading: "A bold, compelling headline",
        body: "Explain your value proposition clearly and concisely. What makes this different?",
        showCta: true,
        ctaText: "Get Started",
        ctaUrl: "#",
        ctaStyle: "pill",
        image: "",
        imageAlt: "",
        imageStyle: "card",
        imageCardBg: "#1a73e8",
        imagePosition: len % 2 === 0 ? "right" : "left",
        backgroundColor: "#f1f5f9",
        textColor: "#0f172a",
        accentColor: "#1a73e8",
      },
    ]);
  }

  function removePanel(idx) {
    patchPanels(panels.filter((_, i) => i !== idx));
  }

  async function handleImageUpload(panelIdx, file) {
    if (!file || typeof onUploadImage !== "function") return;
    const asset = await Promise.resolve(onUploadImage("__ss_panel_image__", file));
    if (asset?.src) patchPanel(panelIdx, { image: asset.src });
  }

  // -- Image rendering --------------------------------------------------------
  // "bleed" = raw image fills entire half
  // "card"  = inset rounded card with imageCardBg behind image
  function renderImageHalf(panel, idx, forEditor = false, halfHeight = "100%") {
    const isCard = panel.imageStyle === "card";
    const imageEl = panel.image ? (
      <img
        src={panel.image}
        alt={panel.imageAlt || panel.heading}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: isCard ? 16 : 0 }}
      />
    ) : (
      <div style={{
        width: "100%", height: "100%",
        background: isCard ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
        color: isCard ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)",
        borderRadius: isCard ? 16 : 0,
      }}>
        <span style={{ fontSize: 48 }}>🖼️</span>
        {forEditor ? (
          <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 8, background: isCard ? "rgba(255,255,255,0.2)" : "rgba(14,165,233,0.15)", border: `1px dashed ${isCard ? "rgba(255,255,255,0.5)" : "rgba(14,165,233,0.5)"}`, color: isCard ? "#fff" : panel.accentColor, fontSize: 16, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
            🖼️ Upload Image
            <input ref={(el) => { fileInputRefs.current[idx] = el; }} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleImageUpload(idx, f); }} />
          </label>
        ) : (
          <span style={{ fontSize: 16 }}>No image</span>
        )}
      </div>
    );

    const replaceControls = forEditor && panel.image ? (
      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6, zIndex: 4 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.2)", color: "#e2e8f0", borderRadius: 6, padding: "5px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }} onClick={(e) => e.stopPropagation()}>
          ↻ Replace
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleImageUpload(idx, f); }} />
        </label>
        <button type="button" onClick={(e) => { e.stopPropagation(); patchPanel(idx, { image: "" }); }} title="Remove image" style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", borderRadius: 6, padding: "5px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>×</button>
      </div>
    ) : null;

    if (isCard) {
      // Card-style: colored background with inset padded rounded card
      return (
        <div style={{ width: "100%", height: halfHeight, background: panel.imageCardBg, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
          <div style={{ position: "relative", width: "calc(100% - 48px)", height: "calc(100% - 48px)", borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.2)" }}>
            {imageEl}
            {replaceControls}
          </div>
        </div>
      );
    }

    // Bleed-style: full-bleed image
    return (
      <div style={{ width: "100%", height: halfHeight, position: "relative", overflow: "hidden" }}>
        {imageEl}
        {replaceControls}
      </div>
    );
  }

  // -- Text content -----------------------------------------------------------
  function renderPanelContent(panel, idx) {
    const tc = panel.textColor;
    const ac = panel.accentColor;
    const contentVerticalSetting = String(panel.contentVerticalAlign || props.contentVerticalAlign || props.textVerticalAlign || "center").toLowerCase();
    const contentJustify = contentVerticalSetting === "top" || contentVerticalSetting === "start"
      ? "flex-start"
      : contentVerticalSetting === "bottom" || contentVerticalSetting === "end"
        ? "flex-end"
        : "center";
    const contentPadTop = contentJustify === "flex-start" ? Math.max(24, Number(props.contentTopPadding ?? 72)) : 0;
    const isLight = tc !== "#ffffff"; // light background panels use darker body text
    const edgeOut = editor ? "1px dashed rgba(14,165,233,0.35)" : "none";
    const edgePad = editor ? "4px 8px" : "0";
    const bodyColor = isLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.72)";
    const isPill = panel.ctaStyle === "pill";
    const ctaBg = isLight ? tc : ac;
    const showCta = panel.showCta !== false;
    const buttonFullWidth = panel.buttonFullWidth === true || props.buttonFullWidth === true;

    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: contentJustify, gap: 20, padding: compact ? "40px 24px 48px" : `${contentPadTop}px 64px 0 72px`, height: "100%", width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", overflow: "hidden" }}>

        {/* Eyebrow — colored dot + label */}
        {(panel.eyebrow || editor) ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
            {panel.eyebrowDot ? (
              <span style={{ width: 12, height: 12, borderRadius: 3, background: ac, display: "inline-block", flexShrink: 0 }} />
            ) : null}
            <div
              data-website-inline-editor={editor ? "true" : undefined}
              contentEditable={editor || undefined}
              suppressContentEditableWarning
              onMouseDown={(e) => editor && e.stopPropagation()}
              onPointerDown={(e) => editor && e.stopPropagation()}
              onBlur={(e) => {
                if (!editor) return;
                if (shouldSkipToolbarBlur(e)) return;
                patchPanel(idx, { eyebrow: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
              }}
              style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.06em", color: ac, outline: edgeOut, borderRadius: 4, padding: edgePad }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(panel.eyebrow || (editor ? "Category label" : "")) }}
            />
          </div>
        ) : null}

        {/* Heading */}
        <div
          data-website-inline-editor={editor ? "true" : undefined}
          contentEditable={editor || undefined}
          suppressContentEditableWarning
          onMouseDown={(e) => editor && e.stopPropagation()}
          onPointerDown={(e) => editor && e.stopPropagation()}
          onBlur={(e) => {
            if (!editor) return;
            if (shouldSkipToolbarBlur(e)) return;
            patchPanel(idx, { heading: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
          }}
          style={{ fontSize: compact ? 28 : (panel.headingSize || 46), fontWeight: panel.headingWeight || 800, lineHeight: 1.08, color: tc, outline: edgeOut, borderRadius: 6, padding: edgePad, margin: 0, width: "100%", maxWidth: Number(panel.textMaxWidth || props.textMaxWidth || 760), minWidth: 0, whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "normal", boxSizing: "border-box" }}
          dangerouslySetInnerHTML={{ __html: asRichHtml(panel.heading || "Your headline") }}
        />

        {/* Body */}
        {(panel.body || editor) ? (
          <div
            data-website-inline-editor={editor ? "true" : undefined}
            contentEditable={editor || undefined}
            suppressContentEditableWarning
            onMouseDown={(e) => editor && e.stopPropagation()}
            onPointerDown={(e) => editor && e.stopPropagation()}
            onBlur={(e) => {
              if (!editor) return;
              if (shouldSkipToolbarBlur(e)) return;
              patchPanel(idx, { body: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
            }}
            style={{ fontSize: panel.bodySize || 17, lineHeight: 1.75, color: bodyColor, outline: edgeOut, borderRadius: 6, padding: edgePad, width: "100%", maxWidth: Number(panel.textMaxWidth || props.textMaxWidth || 760), minWidth: 0, whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "normal", boxSizing: "border-box" }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(panel.body || (editor ? "Add your body text here." : "")) }}
          />
        ) : null}

        {/* CTA */}
        {showCta && (panel.ctaText || editor) ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", width: buttonFullWidth ? "100%" : undefined }}>
            {panel.ctaText ? (
              <a
                href={editor ? undefined : (panel.ctaUrl || "#")}
                onClick={(e) => editor && e.preventDefault()}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                  width: buttonFullWidth ? "100%" : undefined,
                  background: ctaBg, color: isLight ? "#ffffff" : "#ffffff",
                  borderRadius: isPill ? 100 : 10,
                  padding: isPill ? "14px 32px" : "13px 28px",
                  fontSize: 16, fontWeight: 600, textDecoration: "none",
                  cursor: editor ? "default" : "pointer",
                  border: isPill ? "none" : "none",
                  transition: "opacity 0.2s",
                }}
              >
                <div
                  data-website-inline-editor={editor ? "true" : undefined}
                  contentEditable={editor || undefined}
                  suppressContentEditableWarning
                  onMouseDown={(e) => editor && e.stopPropagation()}
                  onPointerDown={(e) => editor && e.stopPropagation()}
                  onBlur={(e) => {
                    if (!editor) return;
                    if (shouldSkipToolbarBlur(e)) return;
                    patchPanel(idx, { ctaText: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
                  }}
                  style={{ outline: editor ? "1px dashed rgba(255,255,255,0.4)" : "none", borderRadius: 4, display: "inline", color: "#fff" }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(panel.ctaText) }}
                />
                {!editor ? <span style={{ fontSize: 18 }}>→</span> : null}
              </a>
            ) : null}
            {editor ? (
              <input
                type="text"
                value={panel.ctaUrl || ""}
                onChange={(e) => patchPanel(idx, { ctaUrl: e.target.value })}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="CTA URL (https://...)"
                style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: tc, borderRadius: 6, padding: "8px 12px", fontSize: 16 }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  // -- EDITOR MODE: flat stacked panels, no sticky ----------------------------
  if (editor) {
    return (
      <div style={{ width: "100%" }}>
        {panels.map((panel, idx) => {
          const imageRight = panel.imagePosition !== "left";
          return (
            <div key={panel.id} style={{ position: "relative", width: "100%", background: panel.backgroundColor, color: panel.textColor, minHeight: 520 }}>
              <div style={{ position: "absolute", top: 10, left: 10, zIndex: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "rgba(14,165,233,0.8)", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 16, fontWeight: 600 }}>Panel {idx + 1}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); removePanel(idx); }} style={{ background: "rgba(239,68,68,0.15)", border: "none", color: "#f87171", borderRadius: 6, padding: "4px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>Remove</button>
              </div>
              <div style={{ display: "flex", flexDirection: imageRight ? "row" : "row-reverse", minHeight: 520 }}>
                <div style={{ flex: "0 0 50%", maxWidth: "50%", overflow: "hidden" }}>
                  {renderImageHalf(panel, idx, true, "100%")}
                </div>
                <div style={{ flex: "0 0 50%", maxWidth: "50%", display: "flex", alignItems: "center" }}>
                  {renderPanelContent(panel, idx)}
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ background: panels[panels.length - 1]?.backgroundColor || "#0f172a", padding: "24px 40px", display: "flex", justifyContent: "center" }}>
          <button type="button" onClick={(e) => { e.stopPropagation(); addPanel(); }} style={{ background: "rgba(14,165,233,0.10)", border: "2px dashed rgba(14,165,233,0.4)", color: "#0ea5e9", borderRadius: 10, padding: "14px 36px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>+ Add Panel</button>
        </div>
      </div>
    );
  }

  // -- COMPACT / MOBILE: image on top, text below -----------------------------
  if (compact) {
    return (
      <div style={{ width: "100%" }}>
        {panels.map((panel, idx) => (
          <div key={panel.id} style={{ width: "100%", background: panel.backgroundColor, color: panel.textColor }}>
            {renderImageHalf(panel, idx, false, "280px")}
            {renderPanelContent(panel, idx)}
          </div>
        ))}
      </div>
    );
  }

  // -- PREVIEW MODE: Stacked Card Deck ----------------------------------------
  // Visual: past cards compress to a slim coloured header strip at the top.
  //         Future cards peek from the bottom so the whole deck is visible.
  //         The active card fills the space between those two zones.
  // Scroll: 100vh of dwell per card — each card slides smoothly from the
  //         bottom peek area up to its settled stack position.
  // Click:  any past/future card header ? window.scrollTo() jumps to it.
  //
  // Z-index rule: later cards (higher idx) sit ON TOP of earlier ones.
  //   This means a future card's peek (higher z) overlaps the active card's
  //   bottom edge — exactly the "physical card deck" layering we want.

  const PEEK = Math.max(48, Math.min(140, Number(props.peekHeight ?? props.cardPeekHeight ?? 52))); // px - visible header strip when stacked

  const sectionRef = React.useRef(null);
  const [scrollProgress, setScrollProgress] = React.useState(0); // continuous 0..n
  const [navH, setNavH] = React.useState(0);

  React.useEffect(() => {
    if (editor || compact || typeof window === "undefined") return;
    function measureNav() {
      const navShell = document.querySelector("[data-website-nav-shell]");
      setNavH(navShell ? Math.round(navShell.getBoundingClientRect().height || 0) : 0);
    }
    measureNav();
    window.addEventListener("resize", measureNav);
    return () => window.removeEventListener("resize", measureNav);
  }, [editor, compact]);

  React.useEffect(() => {
    if (editor || compact || typeof window === "undefined") return;
    const n = panels.length;
    if (n === 0) return;

    function onScroll() {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrolledIn = -rect.top;
      const totalRange = el.offsetHeight - window.innerHeight;
      const raw = Math.max(0, Math.min(n - 0.0001, (scrolledIn / Math.max(1, totalRange)) * n));
      setScrollProgress(raw);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [editor, compact, panels.length]);

  function jumpToCard(targetIdx) {
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const totalRange = el.offsetHeight - window.innerHeight;
    const targetScrolledIn = (targetIdx / panels.length) * totalRange;
    window.scrollTo({ top: window.scrollY + (targetScrolledIn - (-rect.top)), behavior: "smooth" });
  }

  const leadOffset = Number(props.stickyTopOffset ?? 0);
  const stickyTop = navH + leadOffset;
  const cardLead = Number(props.cardLead ?? 0);
  const hInset = Number(props.cardInset ?? 0);
  const n = panels.length;
  const vp = ((typeof window !== "undefined" && window.innerHeight) || 800) - stickyTop;
  const vw = (typeof window !== "undefined" && window.innerWidth) || 1280;
  const stackMode = String(props.stackMode || props.orientation || props.scrollStackMode || "").toLowerCase();
  const useSideStack = stackMode === "side" || stackMode === "horizontal" || stackMode === "right";

  if (useSideStack) {
    const SIDE_PEEK = Math.max(58, Math.min(170, Number(props.peekWidth ?? props.cardPeekWidth ?? props.sidePeekWidth ?? PEEK)));
    return (
      <section ref={sectionRef} style={{ height: `${n * 100}vh`, position: "relative", background: props.backgroundColor || panels[0]?.backgroundColor || "#07111f" }}>
        <div style={{ position: "sticky", top: stickyTop, height: `calc(100vh - ${stickyTop}px)`, overflow: "hidden" }}>
          {panels.map((panel, idx) => {
            const dist = idx - scrollProgress;
            let x;
            if (dist <= 0) {
              x = cardLead + idx * SIDE_PEEK;
            } else if (dist < 1) {
              const t = 1 - dist;
              const xFuture = vw - (n - idx) * SIDE_PEEK;
              x = xFuture + t * (cardLead + idx * SIDE_PEEK - xFuture);
            } else {
              x = vw - (n - idx) * SIDE_PEEK;
            }

            const visibleContentWidth = Math.max(320, vw - SIDE_PEEK - Math.max(0, x));
            const isPast = dist < -0.05;
            const isFuture = dist > 0.05;
            const imageRight = panel.imagePosition !== "left";
            const tc = panel.textColor || "#ffffff";
            const ac = panel.accentColor || "#0ea5e9";

            return (
              <div
                key={panel.id}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "100vw",
                  height: "100%",
                  transform: `translateX(${x}px)`,
                  zIndex: idx + 1,
                  background: panel.backgroundColor,
                  color: tc,
                  borderRadius: idx > 0 ? `${Number(props.cardRadius ?? 18)}px 0 0 ${Number(props.cardRadius ?? 18)}px` : 0,
                  overflow: "hidden",
                  boxShadow: idx > 0 ? "-10px 0 34px rgba(0,0,0,0.26)" : "none",
                  border: Number(props.cardBorderWidth ?? 0) > 0 ? `${Number(props.cardBorderWidth)}px solid ${props.cardBorderColor || "#3b82f6"}` : "none",
                }}
              >
                <div
                  onClick={() => (isPast || isFuture) ? jumpToCard(idx) : undefined}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: SIDE_PEEK,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    padding: "22px 0",
                    cursor: (isPast || isFuture) ? "pointer" : "default",
                    background: panel.backgroundColor,
                    borderRight: props.hideHeaderDivider === true ? "none" : `1px solid ${tc}1a`,
                    userSelect: "none",
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", display: "flex", alignItems: "center", gap: 12, maxHeight: "86%" }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: ac, flexShrink: 0 }} />
                    <span style={{ fontSize: 15, fontWeight: 800, color: tc, letterSpacing: "0.05em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {panel.eyebrow || panel.heading || `Panel ${idx + 1}`}
                    </span>
                  </div>
                </div>

                <div style={{ marginLeft: SIDE_PEEK, width: visibleContentWidth, height: "100%", display: "flex", flexDirection: imageRight ? "row" : "row-reverse", overflow: "hidden" }}>
                  <div style={{ flex: "0 0 50%", maxWidth: "50%", overflow: "hidden" }}>
                    {renderImageHalf(panel, idx, false, "100%")}
                  </div>
                  <div style={{ flex: "0 0 50%", maxWidth: "50%", display: "flex", alignItems: "center", overflow: "hidden" }}>
                    {renderPanelContent(panel, idx)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} style={{ height: `${n * 100}vh`, position: "relative" }}>
      <div style={{ position: "sticky", top: stickyTop, height: `calc(100vh - ${stickyTop}px)`, overflow: "hidden" }}>
        {panels.map((panel, idx) => {
          // dist < 0 ? past (settled at top), dist = 0 ? active, dist > 0 ? future
          const dist = idx - scrollProgress;

          // translateY for this card:
          //  Past/active: settled at its stacked-header row  ?  idx × PEEK
          //  Transitioning in (0 < dist < 1): lerp from bottom-peek to settled
          //  Future (dist = 1): peeking from the bottom of the viewport
          let y;
          if (dist <= 0) {
            y = cardLead + idx * PEEK;
          } else if (dist < 1) {
            const t = 1 - dist; // 0 ? 1 as card arrives
            const yFuture = vp - (n - idx) * PEEK;
            y = yFuture + t * (cardLead + idx * PEEK - yFuture);
          } else {
            y = vp - (n - idx) * PEEK;
          }

          const isPast   = dist < -0.05;
          const isFuture = dist >  0.05;
          const imageRight = panel.imagePosition !== "left";
          const tc = panel.textColor || "#ffffff";
          const ac = panel.accentColor || "#0ea5e9";

          return (
            <div
              key={panel.id}
              style={{
                position: "absolute",
                left: hInset, right: hInset, top: 0,
                height: "100vh",
                transform: `translateY(${y}px)`,
                zIndex: idx + 1,             // later cards always on top
                background: panel.backgroundColor,
                color: tc,
                borderRadius: (idx > 0 || hInset > 0) ? `${Number(props.cardRadius ?? 18)}px ${Number(props.cardRadius ?? 18)}px 0 0` : 0,
                overflow: "hidden",
                boxShadow: idx > 0 ? "0 -6px 24px rgba(0,0,0,0.22)" : "none",
                border: Number(props.cardBorderWidth ?? 0) > 0 ? `${Number(props.cardBorderWidth)}px solid ${props.cardBorderColor || "#3b82f6"}` : "none",
              }}
            >
              {/* -- Slim header bar — always the visible strip when stacked -- */}
              <div
                onClick={() => (isPast || isFuture) ? jumpToCard(idx) : undefined}
                style={{
                  height: PEEK,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0 28px",
                  cursor: (isPast || isFuture) ? "pointer" : "default",
                  background: panel.backgroundColor,
                  borderBottom: props.hideHeaderDivider === true ? "none" : `1px solid ${tc}1a`,
                  userSelect: "none",
                }}
              >
                {/* Accent dot = card colour identity */}
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: ac, flexShrink: 0 }} />
                <span style={{ fontSize: 16, fontWeight: 600, color: tc, letterSpacing: "0.04em", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {panel.eyebrow || panel.heading || `Panel ${idx + 1}`}
                </span>
                {isPast ? (
                  <span style={{ fontSize: 16, color: `${tc}50`, fontWeight: 500, whiteSpace: "nowrap" }}>↑ scroll back</span>
                ) : isFuture ? (
                  <span style={{ fontSize: 16, color: `${tc}50`, fontWeight: 500, whiteSpace: "nowrap" }}>↓ coming up</span>
                ) : null}
              </div>

              {/* -- Full card content: image split + text panel -- */}
              <div style={{ height: `calc(100vh - ${PEEK}px)`, display: "flex", flexDirection: imageRight ? "row" : "row-reverse", overflow: "hidden" }}>
                <div style={{ flex: "0 0 50%", maxWidth: "50%", overflow: "hidden" }}>
                  {renderImageHalf(panel, idx, false, "100%")}
                </div>
                <div style={{ flex: "0 0 50%", maxWidth: "50%", display: "flex", alignItems: "center", overflow: "hidden" }}>
                  {renderPanelContent(panel, idx)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// --- AvatarMorphBlock ---------------------------------------------------------
// Three avatar images that crossfade as the section scrolls into view.
// Feature blocks fly outward from the avatar center like they're emerging from behind.
// CSS blur + scale on start creates a "materialising from depth" effect.

const AVATAR_FLY_BLOCK_DEFAULTS = [
  { id: "fb-1", icon: "?", label: "Automation",  value: "Always On",   color: "#f59e0b", endX: -380, endY: -170, delay: 0.00 },
  { id: "fb-2", icon: "⚙️", label: "Precision",   value: "99.9% up",    color: "#3b82f6", endX: -430, endY:   15, delay: 0.10 },
  { id: "fb-3", icon: "📈", label: "Growth",      value: "+240% ROI",   color: "#10b981", endX: -370, endY:  190, delay: 0.20 },
  { id: "fb-4", icon: "★", label: "Quality",     value: "5★ Rated",    color: "#8b5cf6", endX:  -90, endY: -300, delay: 0.05 },
  { id: "fb-5", icon: "🎯", label: "Results",     value: "Day 1 Gains", color: "#ef4444", endX:  -90, endY:  300, delay: 0.15 },
];

function AvatarMorphBlock({ block, editor = false, compact = false, onChangeBlock, onUploadImage }) {
  const props = block?.props || {};

  const backgroundColor = props.backgroundColor || "#080e1b";
  const accentColor     = props.accentColor     || "#6366f1";
  const textColor       = props.textColor       || "#ffffff";
  const avatarSrc1 = props.avatarArmsIn  || "";
  const avatarSrc2 = props.avatarArmsMid || "";
  const avatarSrc3 = props.avatarArmsOut || "";

  const flyBlockData = React.useMemo(() => {
    const saved = Array.isArray(props.flyBlocks) ? props.flyBlocks : [];
    return AVATAR_FLY_BLOCK_DEFAULTS.map((d, i) => ({ ...d, ...(saved[i] || {}) }));
  }, [props.flyBlocks]);

  const sectionRef = React.useRef(null);
  const img1Ref    = React.useRef(null);
  const img2Ref    = React.useRef(null);
  const img3Ref    = React.useRef(null);
  const flyRefs    = React.useRef([]);

  // Scroll-driven rAF animation — direct DOM mutation, zero React re-renders
  React.useEffect(() => {
    if (editor || typeof window === "undefined") return undefined;

    const container = sectionRef.current;
    if (!container) return undefined;

    let rafId;
    let mounted = true;
    let lastP = -1;

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function lerp(a, b, t)    { return a + (b - a) * t; }
    function easeOut(t)        { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }

    function tick() {
      if (!mounted) return;
      rafId = requestAnimationFrame(tick);

      const rect = container.getBoundingClientRect();
      const vh   = window.innerHeight;
      // p = 0 when section bottom hits viewport bottom; 1 when section top hits viewport top
      const raw = clamp((vh - rect.top) / (vh + rect.height * 0.55), 0, 1);
      if (Math.abs(raw - lastP) < 0.0015) return;
      lastP = raw;
      const p = raw;

      // -- Avatar crossfade ------------------------------------------------
      // Three-phase: img1 ? img2 (0–0.45), img2 ? img3 (0.45–0.80), hold img3
      let o1, o2, o3;
      if (p < 0.45) {
        const t = easeOut(p / 0.45);
        o1 = 1 - t; o2 = t;  o3 = 0;
      } else if (p < 0.80) {
        const t = easeOut((p - 0.45) / 0.35);
        o1 = 0;  o2 = 1 - t; o3 = t;
      } else {
        o1 = 0;  o2 = 0;     o3 = 1;
      }

      if (img1Ref.current) {
        img1Ref.current.style.opacity = o1;
        img1Ref.current.style.filter  = o1 < 0.6 ? `blur(${((1 - o1) * 3).toFixed(1)}px)` : "";
      }
      if (img2Ref.current) {
        img2Ref.current.style.opacity = o2;
        img2Ref.current.style.filter  = `blur(${((1 - o2) * 2.5).toFixed(1)}px)`;
      }
      if (img3Ref.current) {
        img3Ref.current.style.opacity = o3;
        img3Ref.current.style.filter  = o3 < 0.6 ? `blur(${((1 - o3) * 4).toFixed(1)}px)` : "";
      }

      // -- Flying blocks --------------------------------------------------
      flyRefs.current.forEach((el, i) => {
        if (!el) return;
        const bd  = flyBlockData[i];
        if (!bd) return;
        const bp  = clamp((p - (bd.delay || 0)) / (0.85 - (bd.delay || 0)), 0, 1);
        const ep  = easeOut(bp);
        const x   = lerp(0, bd.endX, ep);
        const y   = lerp(0, bd.endY, ep);
        const sc  = lerp(0.06, 1, ep);
        const op  = clamp(bp * 5, 0, 1);
        const bl  = lerp(14, 0, Math.min(1, bp * 3.5));
        el.style.transform = `translate(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px)) scale(${sc.toFixed(3)})`;
        el.style.opacity   = op.toFixed(3);
        el.style.filter    = bl > 0.3 ? `blur(${bl.toFixed(1)}px)` : "";
      });
    }

    rafId = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [editor, flyBlockData]);

  // -- Upload helpers ---------------------------------------------------------
  async function handleAvatarUpload(slot, file) {
    if (!file || typeof onUploadImage !== "function") return;
    const asset = await Promise.resolve(onUploadImage(`__avatar_morph_${slot}__`, file));
    if (asset?.src) onChangeBlock?.({ ...props, [slot]: asset.src });
  }

  // -- Shared styles ----------------------------------------------------------
  const avatarImgStyle = {
    position: "absolute", top: 0, left: 0,
    width: "100%", height: "100%",
    objectFit: "contain", objectPosition: "bottom center",
    display: "block", pointerEvents: "none",
  };

  // -- Flying block render ----------------------------------------------------
  function renderFlyBlock(bd, i) {
    const isEditor = editor;
    const editorTransform = `translate(calc(-50% + ${bd.endX}px), calc(-50% + ${bd.endY}px)) scale(1)`;
    return (
      <div
        key={bd.id}
        ref={(el) => { flyRefs.current[i] = el; }}
        style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: isEditor ? editorTransform : "translate(-50%, -50%) scale(0.06)",
          opacity: isEditor ? 1 : 0,
          zIndex: 10,
          pointerEvents: "none",
          width: compact ? 150 : 188,
          height: compact ? 80  : 104,
          borderRadius: 18,
          background: `linear-gradient(135deg, ${bd.color}1c 0%, ${bd.color}0a 100%)`,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: `1px solid ${bd.color}50`,
          boxShadow: `0 8px 32px ${bd.color}28, 0 0 0 1px ${bd.color}18 inset`,
          display: "flex",
          alignItems: "center",
          gap: compact ? 10 : 14,
          padding: compact ? "0 14px" : "0 22px",
          willChange: "transform, opacity",
        }}
      >
        <div style={{
          width: compact ? 38 : 48,
          height: compact ? 38 : 48,
          borderRadius: 13,
          background: `linear-gradient(135deg, ${bd.color}35, ${bd.color}18)`,
          border: `1px solid ${bd.color}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: compact ? 20 : 26,
          flexShrink: 0,
        }}>
          {bd.icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: compact ? 18 : 22, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>{bd.value}</div>
          <div style={{ fontSize: compact ? 12 : 14, color: "rgba(255,255,255,0.55)", fontWeight: 500, marginTop: 2 }}>{bd.label}</div>
        </div>
      </div>
    );
  }

  // -- Editor upload slot -----------------------------------------------------
  function renderEditorSlot(src, slot, label) {
    return (
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {src ? (
          <>
            <img src={src} alt={label} style={{ width: "100%", height: 170, objectFit: "contain", borderRadius: 8, background: "rgba(255,255,255,0.04)", display: "block" }} />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChangeBlock?.({ ...props, [slot]: "" }); }}
              style={{ position: "absolute", top: 4, right: 4, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", borderRadius: 5, padding: "2px 7px", fontSize: 13, cursor: "pointer" }}
            >×</button>
          </>
        ) : (
          <div style={{ height: 170, background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "rgba(255,255,255,0.25)", fontSize: 14, fontWeight: 600 }}>
            <span style={{ fontSize: 36 }}>🧍</span>
            <span>{label}</span>
          </div>
        )}
        <label
          style={{ display: "block", marginTop: 5, textAlign: "center", padding: "5px 0", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 7, color: "#a5b4fc", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          onClick={(e) => e.stopPropagation()}
        >
          🖼️ Upload
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleAvatarUpload(slot, f); }} />
        </label>
      </div>
    );
  }

  // -- EDITOR mode ------------------------------------------------------------
  if (editor) {
    return (
      <div style={{ position: "relative", background: backgroundColor, padding: compact ? "40px 24px" : "72px 56px", borderRadius: 16, overflow: "hidden" }}>
        <div aria-hidden="true" style={{ position: "absolute", top: "25%", right: "30%", width: 380, height: 380, borderRadius: "50%", background: `radial-gradient(circle, ${accentColor}1e 0%, transparent 68%)`, pointerEvents: "none" }} />
        <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: 40, alignItems: "start", position: "relative", zIndex: 2 }}>
          {/* Left: text preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: accentColor, textTransform: "uppercase" }}>{props.eyebrow || "Powered by Intelligent Automation"}</div>
            <div
              contentEditable suppressContentEditableWarning
              data-website-inline-editor="true"
              onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
              onBlur={(e) => { if (shouldSkipToolbarBlur(e)) return; onChangeBlock?.({ ...props, title: cleanInlineEditorHtml(e.currentTarget.innerHTML) }); }}
              style={{ fontSize: compact ? 30 : 50, fontWeight: 900, lineHeight: 1.05, color: textColor, outline: "1px dashed rgba(99,102,241,0.4)", borderRadius: 6, margin: 0 }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || "Watch the system come alive") }}
            />
            <div
              contentEditable suppressContentEditableWarning
              data-website-inline-editor="true"
              onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
              onBlur={(e) => { if (shouldSkipToolbarBlur(e)) return; onChangeBlock?.({ ...props, subtitle: cleanInlineEditorHtml(e.currentTarget.innerHTML) }); }}
              style={{ fontSize: 18, lineHeight: 1.75, color: "rgba(255,255,255,0.62)", outline: "1px dashed rgba(99,102,241,0.3)", borderRadius: 6, margin: 0 }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(props.subtitle || "Three simple actions — one unstoppable flow.") }}
            />
            {/* Color pickers */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", padding: "10px 14px", background: "rgba(99,102,241,0.07)", border: "1px dashed rgba(99,102,241,0.3)", borderRadius: 9 }}>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600 }}>Colors:</span>
              {[["Background","backgroundColor"],["Accent","accentColor"],["Text","textColor"]].map(([lbl, key]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={(e) => e.stopPropagation()}>
                  {lbl}
                  <input type="color" value={props[key] || (key === "backgroundColor" ? "#080e1b" : key === "accentColor" ? "#6366f1" : "#ffffff")} onChange={(e) => onChangeBlock?.({ ...props, [key]: e.target.value })} style={{ width: 24, height: 24, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }} />
                </label>
              ))}
            </div>
          </div>
          {/* Right: avatar slots + blocks preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>AVATAR IMAGES (scroll sequence: arms in → arms mid → arms out)</div>
            <div style={{ display: "flex", gap: 10 }}>
              {renderEditorSlot(avatarSrc1, "avatarArmsIn",  "Arms In")}
              {renderEditorSlot(avatarSrc2, "avatarArmsMid", "Arms Mid")}
              {renderEditorSlot(avatarSrc3, "avatarArmsOut", "Arms Out")}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>FLYING BLOCKS (final positions):</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {flyBlockData.map((bd) => (
                <div key={bd.id} style={{ borderRadius: 12, background: `linear-gradient(135deg, ${bd.color}1c, ${bd.color}0a)`, border: `1px solid ${bd.color}44`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{bd.icon}</span>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{bd.value}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{bd.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -- LIVE / PREVIEW mode ----------------------------------------------------
  const hasAnyAvatar = !!(avatarSrc1 || avatarSrc2 || avatarSrc3);

  return (
    <section
      ref={sectionRef}
      style={{
        position: "relative",
        background: backgroundColor,
        minHeight: compact ? "auto" : "100vh",
        overflow: "visible",
        display: "flex",
        alignItems: "center",
        padding: compact ? "70px 24px" : "110px 60px",
        boxSizing: "border-box",
      }}
    >
      {/* Ambient glow */}
      <div aria-hidden="true" style={{ position: "absolute", top: "15%", right: "22%", width: 560, height: 560, borderRadius: "50%", background: `radial-gradient(circle, ${accentColor}1a 0%, transparent 62%)`, pointerEvents: "none", zIndex: 0 }} />
      <div aria-hidden="true" style={{ position: "absolute", bottom: "10%", right: "12%", width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(circle, ${accentColor}0e 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />

      {/* 2-col grid */}
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: compact ? 48 : 70, alignItems: "center", width: "100%", maxWidth: 1240, margin: "0 auto", position: "relative", zIndex: 2 }}>

        {/* -- Left: text -- */}
        <div style={{ display: "flex", flexDirection: "column", gap: compact ? 18 : 26 }}>
          {props.eyebrow ? <div style={{ fontSize: compact ? 12 : 13, fontWeight: 700, letterSpacing: "0.10em", color: accentColor, textTransform: "uppercase" }}>{props.eyebrow}</div> : null}
          <h2 style={{ margin: 0, fontSize: compact ? 32 : 60, fontWeight: 900, lineHeight: 1.03, color: textColor, letterSpacing: "-0.02em" }}>
            {props.title || "Watch the system come alive"}
          </h2>
          <p style={{ margin: 0, fontSize: compact ? 17 : 20, lineHeight: 1.75, color: "rgba(255,255,255,0.62)" }}>
            {props.subtitle || "Three simple actions — one unstoppable flow. Each step fuels the next."}
          </p>
          {props.ctaText ? (
            <a
              href={props.ctaUrl || "#"}
              style={{ display: "inline-flex", alignItems: "center", gap: 10, background: `linear-gradient(135deg, ${accentColor}, #818cf8)`, color: "#fff", borderRadius: 14, padding: compact ? "13px 26px" : "17px 34px", fontSize: compact ? 16 : 18, fontWeight: 700, textDecoration: "none", alignSelf: "flex-start", boxShadow: `0 10px 28px ${accentColor}40` }}
            >
              {props.ctaText}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
          ) : null}
        </div>

        {/* -- Right: avatar + flying blocks -- */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Avatar image stack */}
          <div style={{ position: "relative", width: compact ? 240 : 400, height: compact ? 340 : 560, flexShrink: 0 }}>
            {/* img3 = arms out — base layer (fades in last) */}
            {avatarSrc3 ? <img ref={img3Ref} src={avatarSrc3} alt="Arms extended" style={{ ...avatarImgStyle, opacity: 0, willChange: "opacity, filter" }} /> : null}
            {/* img2 = arms mid */}
            {avatarSrc2 ? <img ref={img2Ref} src={avatarSrc2} alt="Arms half out" style={{ ...avatarImgStyle, opacity: 0, willChange: "opacity, filter" }} /> : null}
            {/* img1 = arms in — top layer, starts fully visible */}
            {avatarSrc1 ? <img ref={img1Ref} src={avatarSrc1} alt="Arms on chest" style={{ ...avatarImgStyle, opacity: 1, willChange: "opacity, filter" }} /> : null}

            {!hasAnyAvatar ? (
              <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "rgba(255,255,255,0.2)", fontSize: 17, fontWeight: 600 }}>
                <span style={{ fontSize: 64 }}>🧍</span>
                Upload avatar images in editor
              </div>
            ) : null}

            {/* Flying blocks — all anchored to avatar center, fly outward on scroll */}
            {!compact ? flyBlockData.map((bd, i) => renderFlyBlock(bd, i)) : null}
          </div>
        </div>

      </div>
    </section>
  );
}

// --- VideoHeroBlock -----------------------------------------------------------
// Full-bleed video hero with lazy loading via IntersectionObserver.
// The video is hosted on Supabase storage (uploaded via onUploadImage).
// Video src is only set once the element scrolls into view — zero network
// cost until the visitor actually reaches this section.
// Autoplay / muted / loop / playsInline — required for all browsers/mobile.

function VideoHeroBlock({ block, editor = false, compact = false, isSelected = false, onChangeBlock, onUploadImage }) {
  const props = block?.props || {};

  const videoSrc     = String(props.videoSrc     || "");
  const posterSrc    = String(props.posterSrc    || "");
  const overlayOpacity = Number(props.overlayOpacity ?? 0.42);
  const overlayColor = String(props.overlayColor || "#000000");
  const heightMode   = compact ? "fixed" : (props.heightMode || "full");
  const fixedHeight  = Number(props.minHeight) || 620;
  const objectFit      = String(props.objectFit      || "cover");
  const objectPosition = String(props.objectPosition || "top center");
  const showText     = props.showText !== false;
  const textColor    = String(props.textColor    || "#ffffff");
  const eyebrow      = String(props.eyebrow      || "");
  const title        = String(props.title        || "");
  const subtitle     = String(props.subtitle     || "");
  const ctaText      = String(props.ctaText      || "");
  const ctaUrl       = String(props.ctaUrl       || "#");
  const accentColor  = String(props.accentColor  || "#6366f1");

  const paddingTop    = Number(props.paddingTop    ?? 0);
  const paddingBottom = Number(props.paddingBottom ?? 0);
  const marginTop     = Number(props.marginTop     ?? 0);

  const videoRef     = React.useRef(null);
  const sectionRef   = React.useRef(null);
  const loadedRef    = React.useRef(false);
  const [muted, setMuted] = React.useState(true);
  const unmuteOnScroll = props.unmuteOnScroll === true;

  // Lazy-load: only assign video src once element is ≥10% visible.
  // If unmuteOnScroll is enabled, also unmute at that point.
  React.useEffect(() => {
    if (editor || !videoSrc || typeof window === "undefined") return undefined;
    const el = sectionRef.current;
    if (!el) return undefined;

    // Already loaded on this mount
    if (loadedRef.current && videoRef.current?.src) return undefined;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && videoRef.current && !loadedRef.current) {
          loadedRef.current = true;
          videoRef.current.src = videoSrc;
          videoRef.current.load();
          if (unmuteOnScroll) {
            // Unmute — the browser allows this since it's inside a user-scroll event chain
            videoRef.current.muted = false;
            setMuted(false);
          }
          obs.disconnect();
        }
      },
      { threshold: 0.10 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [editor, videoSrc, unmuteOnScroll]);

  // -- Upload helpers --------------------------------------------------------
  async function handleVideoUpload(file) {
    if (!file || typeof onUploadImage !== "function") return;
    // Show local blob URL immediately so the preview updates before the upload finishes.
    const blobUrl = URL.createObjectURL(file);
    onChangeBlock?.({ ...props, videoSrc: blobUrl });
    try {
      const asset = await Promise.resolve(onUploadImage("__video_hero_src__", file));
      if (asset?.src) onChangeBlock?.({ ...props, videoSrc: asset.src });
    } catch {
      // blob URL stays as a local preview if upload fails
    }
  }

  async function handlePosterUpload(file) {
    if (!file || typeof onUploadImage !== "function") return;
    const asset = await Promise.resolve(onUploadImage("__video_hero_poster__", file));
    if (asset?.src) onChangeBlock?.({ ...props, posterSrc: asset.src });
  }

  // -- Shared overlay style --------------------------------------------------
  const overlayStyle = {
    position: "absolute", inset: 0, zIndex: 1,
    background: overlayColor,
    opacity: overlayOpacity,
    pointerEvents: "none",
  };

  // 100svh fills exactly the visible viewport on mobile (no browser-chrome bleed).
  // Falls back to 100vh for older browsers that don't support svh.
  const sectionStyle = {
    position: "relative",
    height: heightMode === "full" ? "100svh" : undefined,
    minHeight: heightMode === "full" ? "100vh" : fixedHeight,
    maxHeight: heightMode === "full" ? "100svh" : undefined,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#000",
    // Padding is applied inside the section so the #000 background covers the full
    // padded area — no transparent strip around the edge.
    paddingTop: paddingTop || undefined,
    paddingBottom: paddingBottom || undefined,
  };

  const applyVideoHeroPatch = (patch, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    onChangeBlock?.({ ...props, ...patch });
  };

  const editorOptionButtonStyle = (active) => ({
    padding: "6px 10px",
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    background: active ? "rgba(99,102,241,0.32)" : "rgba(255,255,255,0.08)",
    border: `1px solid ${active ? "rgba(165,180,252,0.76)" : "rgba(255,255,255,0.18)"}`,
    color: active ? "#c7d2fe" : "rgba(255,255,255,0.78)",
    whiteSpace: "nowrap",
  });

  // -- EDITOR mode — controls are in the PropertiesPanel right sidebar ---------
  if (false && editor) {
    return (
      <div style={{ background: "#0d1117", display: "flex", flexDirection: "column", gap: 20, padding: "24px 24px 28px", alignItems: "stretch" }}>
        {/* Video preview if uploaded */}
        {videoSrc ? (
          <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#000", maxHeight: 220 }}>
            <video
              src={videoSrc}
              poster={posterSrc || undefined}
              muted autoPlay loop={props.loopVideo === true} playsInline
              style={{ width: "100%", maxHeight: 220, objectFit: "cover", objectPosition, display: "block" }}
            />
            <div style={overlayStyle} />
            {showText && (title || subtitle) ? (
              <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 24 }}>
                {eyebrow ? <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: accentColor, textTransform: "uppercase" }}>{eyebrow}</div> : null}
                {title   ? <div style={{ fontSize: 22, fontWeight: 900, color: textColor, textAlign: "center", lineHeight: 1.1 }}>{title}</div> : null}
                {subtitle ? <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", textAlign: "center" }}>{subtitle}</div> : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.12)", minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "rgba(255,255,255,0.3)", fontSize: 14, fontWeight: 600 }}>
            <span style={{ fontSize: 40 }}>🎬</span>
            <span>No video uploaded yet</span>
            <span style={{ fontSize: 12, fontWeight: 400 }}>MP4 / WebM recommended — keep under 10 MB for fast loads</span>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Upload video */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 6, letterSpacing: "0.05em" }}>VIDEO FILE</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 8, color: "#a5b4fc", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={(e) => e.stopPropagation()}>
              📹 {videoSrc ? "Replace Video" : "Upload Video"}
              <input type="file" accept="video/mp4,video/webm,video/ogg,video/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleVideoUpload(f); }} />
            </label>
            {videoSrc ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); onChangeBlock?.({ ...props, videoSrc: "" }); }} style={{ marginTop: 5, background: "none", border: "none", color: "rgba(239,68,68,0.7)", fontSize: 12, cursor: "pointer", padding: 0 }}>? Remove video</button>
            ) : null}
          </div>

          {/* Upload poster frame */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 6, letterSpacing: "0.05em" }}>POSTER / THUMBNAIL</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={(e) => e.stopPropagation()}>
              🖼️ {posterSrc ? "Replace Poster" : "Upload Poster"}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handlePosterUpload(f); }} />
            </label>
            {posterSrc ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); onChangeBlock?.({ ...props, posterSrc: "" }); }} style={{ marginTop: 5, background: "none", border: "none", color: "rgba(239,68,68,0.7)", fontSize: 12, cursor: "pointer", padding: 0 }}>? Remove poster</button>
            ) : null}
          </div>
        </div>

        {/* Text overlay settings */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>EYEBROW TEXT</div>
            <input value={eyebrow} onChange={(e) => onChangeBlock?.({ ...props, eyebrow: e.target.value })} onClick={(e) => e.stopPropagation()} placeholder="Optional eyebrow label" style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 13, padding: "7px 10px" }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>HEADLINE</div>
            <input value={title} onChange={(e) => onChangeBlock?.({ ...props, title: e.target.value })} onClick={(e) => e.stopPropagation()} placeholder="Hero headline" style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 13, padding: "7px 10px" }} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>SUBHEADLINE</div>
            <input value={subtitle} onChange={(e) => onChangeBlock?.({ ...props, subtitle: e.target.value })} onClick={(e) => e.stopPropagation()} placeholder="Supporting sentence" style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 13, padding: "7px 10px" }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>CTA BUTTON TEXT</div>
            <input value={ctaText} onChange={(e) => onChangeBlock?.({ ...props, ctaText: e.target.value })} onClick={(e) => e.stopPropagation()} placeholder="Leave blank to hide" style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 13, padding: "7px 10px" }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>CTA URL</div>
            <input value={ctaUrl} onChange={(e) => onChangeBlock?.({ ...props, ctaUrl: e.target.value })} onClick={(e) => e.stopPropagation()} placeholder="#" style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 13, padding: "7px 10px" }} />
          </div>
        </div>

        {/* Overlay + sizing */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.10)", borderRadius: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={(e) => e.stopPropagation()}>
            Overlay
            <input type="color" value={overlayColor} onChange={(e) => onChangeBlock?.({ ...props, overlayColor: e.target.value })} style={{ width: 24, height: 24, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600 }}>
            Opacity
            <input type="range" min={0} max={0.9} step={0.01} value={overlayOpacity} onChange={(e) => onChangeBlock?.({ ...props, overlayOpacity: parseFloat(e.target.value) })} onClick={(e) => e.stopPropagation()} style={{ width: 90 }} />
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{Math.round(overlayOpacity * 100)}%</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600 }}>
            Accent
            <input type="color" value={accentColor} onChange={(e) => onChangeBlock?.({ ...props, accentColor: e.target.value })} style={{ width: 24, height: 24, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }} />
          </label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600 }}>Height</span>
            {["full", "fixed"].map((m) => (
              <button key={m} type="button" onClick={(e) => { e.stopPropagation(); onChangeBlock?.({ ...props, heightMode: m }); }}
                style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: heightMode === m ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)", border: `1px solid ${heightMode === m ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.12)"}`, color: heightMode === m ? "#a5b4fc" : "rgba(255,255,255,0.45)" }}>
                {m === "full" ? "Full screen" : "Fixed px"}
              </button>
            ))}
            {heightMode === "fixed" ? (
              <input type="number" min={200} max={1200} step={10} value={fixedHeight} onChange={(e) => onChangeBlock?.({ ...props, minHeight: Number(e.target.value) || 620 })} onClick={(e) => e.stopPropagation()} style={{ width: 68, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, color: "#fff", fontSize: 13, padding: "3px 7px" }} />
            ) : null}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <input type="checkbox" checked={showText} onChange={(e) => onChangeBlock?.({ ...props, showText: e.target.checked })} onClick={(e) => e.stopPropagation()} />
            Show text overlay
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: unmuteOnScroll ? "#86efac" : "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <input type="checkbox" checked={unmuteOnScroll} onChange={(e) => onChangeBlock?.({ ...props, unmuteOnScroll: e.target.checked })} onClick={(e) => e.stopPropagation()} />
            🔊 Unmute when scrolled into view
          </label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600 }}>Padding Top</span>
            <input type="number" min={0} max={400} step={8} value={paddingTop} onChange={(e) => onChangeBlock?.({ ...props, paddingTop: Number(e.target.value) || 0 })} onClick={(e) => e.stopPropagation()} style={{ width: 64, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, color: "#fff", fontSize: 13, padding: "3px 7px" }} />
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600 }}>Bottom</span>
            <input type="number" min={0} max={400} step={8} value={paddingBottom} onChange={(e) => onChangeBlock?.({ ...props, paddingBottom: Number(e.target.value) || 0 })} onClick={(e) => e.stopPropagation()} style={{ width: 64, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, color: "#fff", fontSize: 13, padding: "3px 7px" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {["cover", "contain"].map((fit) => (
              <button key={fit} type="button" onClick={(e) => { e.stopPropagation(); onChangeBlock?.({ ...props, objectFit: fit }); }}
                style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: objectFit === fit ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)", border: `1px solid ${objectFit === fit ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.12)"}`, color: objectFit === fit ? "#a5b4fc" : "rgba(255,255,255,0.45)" }}>
                {fit}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600 }}>Position</span>
            {[["top center", "Top"], ["center center", "Mid"], ["bottom center", "Bot"]].map(([val, label]) => (
              <button key={val} type="button" onClick={(e) => { e.stopPropagation(); onChangeBlock?.({ ...props, objectPosition: val }); }}
                style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: objectPosition === val ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)", border: `1px solid ${objectPosition === val ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.12)"}`, color: objectPosition === val ? "#a5b4fc" : "rgba(255,255,255,0.45)" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // -- LIVE / PREVIEW mode ---------------------------------------------------
  return (
    <div style={marginTop ? { marginTop } : undefined}>
    <section ref={sectionRef} style={sectionStyle}>
      {editor && isSelected ? (
        <div
          data-no-canvas-drag="true"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onDragStart={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            right: 16,
            zIndex: 20,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(2,6,23,0.72)",
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: "0 12px 30px rgba(0,0,0,0.22)",
            backdropFilter: "blur(10px)",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", marginRight: 2 }}>Video Hero</span>
          {["full", "fixed"].map((mode) => (
            <button key={mode} type="button" draggable={false} onMouseDown={(event) => applyVideoHeroPatch({ heightMode: mode }, event)} style={editorOptionButtonStyle(heightMode === mode)}>
              {mode === "full" ? "Full screen" : "Fixed px"}
            </button>
          ))}
          <span style={{ width: 1, height: 22, background: "rgba(255,255,255,0.16)" }} />
          {["cover", "contain"].map((fit) => (
            <button key={fit} type="button" draggable={false} onMouseDown={(event) => applyVideoHeroPatch({ objectFit: fit }, event)} style={editorOptionButtonStyle(objectFit === fit)}>
              {fit}
            </button>
          ))}
          <span style={{ width: 1, height: 22, background: "rgba(255,255,255,0.16)" }} />
          {[["top center", "Top"], ["center center", "Middle"], ["bottom center", "Bottom"]].map(([value, label]) => (
            <button key={value} type="button" draggable={false} onMouseDown={(event) => applyVideoHeroPatch({ objectPosition: value }, event)} style={editorOptionButtonStyle(objectPosition === value)}>
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Video element — src set immediately in editor, lazy-loaded via IntersectionObserver in live */}
      <video
        ref={videoRef}
        src={editor ? (videoSrc || undefined) : undefined}
        poster={posterSrc || undefined}
        muted={muted}
        autoPlay
        loop={props.loopVideo === true}
        playsInline
        style={{
          position: "absolute", inset: 0, zIndex: 0,
          width: "100%", height: "100%",
          objectFit,
          objectPosition,
          display: "block",
        }}
      />

      {/* Dark overlay for text legibility */}
      <div style={overlayStyle} />

      {/* Editor empty-state hint — only shown in the builder when no video has been uploaded */}
      {editor && !videoSrc ? (
        <div style={{ position: "absolute", inset: 0, zIndex: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, pointerEvents: "none" }}>
          <span style={{ fontSize: 48 }}>🎬</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>Video Hero</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>Upload a video in the panel on the right →</span>
        </div>
      ) : null}

      {/* Mute/unmute toggle — bottom-right corner */}
      <button
        type="button"
        aria-label={muted ? "Unmute video" : "Mute video"}
        onClick={() => {
          const next = !muted;
          setMuted(next);
          if (videoRef.current) videoRef.current.muted = next;
        }}
        style={{
          position: "absolute", bottom: 18, right: 18, zIndex: 10,
          width: 40, height: 40, borderRadius: "50%",
          background: "rgba(0,0,0,0.52)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.22)",
          color: "#fff", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 0, flexShrink: 0,
          transition: "background 0.15s",
        }}
      >
        {muted ? (
          /* Muted icon — speaker with X */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
        ) : (
          /* Unmuted icon — speaker with waves */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        )}
      </button>

      {/* Text overlay */}
      {showText && (title || subtitle || ctaText) ? (
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: compact ? 14 : 22, padding: compact ? "40px 24px" : "60px 48px", maxWidth: 820, width: "100%" }}>
          {eyebrow ? (
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: accentColor, textTransform: "uppercase" }}>{eyebrow}</div>
          ) : null}
          {title ? (
            <h1 style={{ margin: 0, fontSize: compact ? 34 : 64, fontWeight: 900, lineHeight: 1.03, color: textColor, letterSpacing: "-0.02em" }}>{title}</h1>
          ) : null}
          {subtitle ? (
            <p style={{ margin: 0, fontSize: compact ? 17 : 22, lineHeight: 1.7, color: "rgba(255,255,255,0.72)", maxWidth: 620 }}>{subtitle}</p>
          ) : null}
          {ctaText ? (
            <a
              href={ctaUrl}
              style={{ display: "inline-flex", alignItems: "center", gap: 10, background: `linear-gradient(135deg, ${accentColor}, #818cf8)`, color: "#fff", borderRadius: 14, padding: compact ? "13px 28px" : "17px 36px", fontSize: compact ? 16 : 19, fontWeight: 700, textDecoration: "none", boxShadow: `0 10px 28px ${accentColor}44`, marginTop: 4 }}
            >
              {ctaText}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
    </div>
  );
}

export {
  NavBarBlock,
  clampValue, snapToGrid, shouldSkipToolbarBlur, cleanInlineEditorHtml, htmlToPlainText,
  LayeredImageStackBlock, EditableImageBlock, getListMarker, ColumnEditorCard,
  FAQAccordionItems, FAQAccordionBlock,
  resolveSplitFaqBlockProps, resolveSplitHeadlineBlockProps, resolveSplitBodyBlockProps, SplitFaqBlock,
  renderOverlayGuides, getOverlayGuideState, getPixelGuideState, renderCanvasCenterGuides,
  getOverlayBoundsElement, useOverlayBounds, DraggableContentOverlay,
  resolveColumnCardStyle, normalizeGridSectionItems, renderGridSectionIcon,
  resolveServicesStylePreset, resolveServicesColorPreset, ServicesGridCard,
  isServicesGridVariant, resolveGridSectionCardStyle, ExtraTextOverlay, ExtraCounterOverlay, DraggableImageOverlay,
  IconCounterBlock,
  HoverCardsBlock,
  FramerPortfolioBlock,
  FeatureAccordionBlock,
  ScrollStackBlock,
  AvatarMorphBlock,
  VideoHeroBlock,
};
