import { resolvePreferredCtaHref, inferCtaLinkType, resolveRenderedCtaHref } from "../../../lib/website-builder/buttonLinks";
import { isResponsiveDevice, resolveResponsiveProp, resolveResponsiveMediaSize } from "../../../lib/website-builder/responsiveValue";
import React from "react";
import { navVariantTheme, fullWidthStyle, findScrollParent, asStyleObject, BrandMark, buildNavLinkStyle, applyNavHoverEffect, resetNavHoverEffect } from "./wbVariantStyles";
import { resolveCurrentPageKey, slugifyText, asArray, MIN_TAP_SIZE, isCurrentNavLink, shouldHighlightNavLink, resolvePublishedNavHref, MIN_TEXT_SIZE } from "./wbAnimations";


function resolvePageAwareCta(props = {}, navigationContext = null) {
  const cta = props.cta && typeof props.cta === "object" ? props.cta : {};
  const text = String(cta.text || props.ctaText || props.buttonText || "").trim();
  const rawHref = resolvePreferredCtaHref(
    cta.href || "",
    props.ctaLink || props.buttonLink || props.link || props.href || "",
    cta.linkType || "",
  );
  const linkType = inferCtaLinkType(rawHref, cta.linkType || "");
  if (!text) return { text: "", href: "" };
  if (linkType === "none") return { text, href: "" };
  const href = resolveRenderedCtaHref({
    linkType,
    href: rawHref,
    pageId: cta.pageId || "",
  }, navigationContext);
  return { text, href: href || "#" };
}


function NavBarBlock({ blockProps, compact, device, logoSrc, editor = false, navigationContext = null }) {
  if (!isResponsiveDevice(device)) device = compact ? "mobile" : "desktop";
  const wrapperRef = React.useRef(null);
  const shellRef = React.useRef(null);
  const dropdownCloseTimerRef = React.useRef(null);
  const navTheme = navVariantTheme(blockProps, compact);
  const navProps = { ...blockProps, fullWidthBackground: blockProps?.fullWidthBackground !== false };
  const stickyMode = blockProps.stickyMode || "normal";
  const isAlwaysMode = stickyMode === "always";
  const isStickyMode = stickyMode === "sticky" || stickyMode === "sticky-transparent" || stickyMode === "sticky-solid";
  const isGlobalSiteHeader = blockProps.role === "primary-navigation" || !!blockProps.sharedComponentId || blockProps.useGlobalHeader === true;
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
  const shouldUseEditorFixedNav = editor && isGlobalSiteHeader && isStickyMode && stickyPinned;
  const shouldUseFixedNav = shouldUseEditorFixedNav || (!editor && (isAlwaysMode || (isGlobalSiteHeader && isStickyMode)));
  const shouldUseTrueSticky = !shouldUseFixedNav && isStickyMode;

  const cancelDropdownClose = React.useCallback(() => {
    if (dropdownCloseTimerRef.current) {
      window.clearTimeout(dropdownCloseTimerRef.current);
      dropdownCloseTimerRef.current = null;
    }
  }, []);

  const openDropdownMenu = React.useCallback((idx) => {
    cancelDropdownClose();
    setOpenDropdown(idx);
  }, [cancelDropdownClose]);

  const closeDropdownMenu = React.useCallback((delay = 0) => {
    cancelDropdownClose();
    if (delay > 0 && typeof window !== "undefined") {
      dropdownCloseTimerRef.current = window.setTimeout(() => {
        setOpenDropdown(null);
        dropdownCloseTimerRef.current = null;
      }, delay);
      return;
    }
    setOpenDropdown(null);
  }, [cancelDropdownClose]);

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

    const measureTarget = shouldUseFixedNav ? shellRef.current : (wrapperRef.current || shellRef.current);
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
  }, [compact, blockProps, mobileOpen, shouldUseFixedNav]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const wrapperNode = wrapperRef.current;
    const scrollTarget = findScrollParent(wrapperNode || shellRef.current);
    // `.gr8wb-viewport` (the editor/preview/published shared responsive shell -- see
    // styles/website-builder-responsive.css) uses `container-type: inline-size` so tablet/mobile
    // preview can use real container queries. That containment also makes it the CSS containing
    // block for `position: fixed` descendants, same as `transform` would. `getBoundingClientRect`
    // always returns true-viewport-relative coordinates regardless of that, so once this nav is
    // fixed we have to re-express those coordinates relative to the containing block ourselves --
    // otherwise "always"/"sticky" nav mode renders offset by however far the shell sits from the
    // real viewport origin (e.g. a centered, narrower tablet/mobile preview shell).
    const createsFixedContainingBlock = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      return (
        (style.transform && style.transform !== "none")
        || (style.perspective && style.perspective !== "none")
        || (style.filter && style.filter !== "none")
        || (style.backdropFilter && style.backdropFilter !== "none")
        || (style.contain && /(layout|paint|strict|content)/.test(style.contain))
      );
    };
    let containingBlockNode = wrapperNode?.parentElement || null;
    while (containingBlockNode && containingBlockNode !== document.documentElement && !createsFixedContainingBlock(containingBlockNode)) {
      containingBlockNode = containingBlockNode.parentElement;
    }
    if (containingBlockNode === document.documentElement) containingBlockNode = null;
    const readScrollTop = () => {
      const usesWindowScroll = !scrollTarget || scrollTarget === window;
      const scrollAmount = usesWindowScroll ? (window.scrollY || 0) : (scrollTarget?.scrollTop || 0);
      const wrapperRect = wrapperNode?.getBoundingClientRect?.();
      const containerTop = usesWindowScroll ? 0 : (scrollTarget?.getBoundingClientRect?.().top || 0);
      const containingBlockRect = containingBlockNode?.getBoundingClientRect?.() || null;
      const cbLeft = containingBlockRect?.left || 0;
      const cbTop = containingBlockRect?.top || 0;

      setScrolled(scrollAmount > 18);

      if (isStickyMode) {
        setStickyPinned((wrapperRect?.top || 0) <= containerTop && scrollAmount > 0);
      }

      if ((isAlwaysMode || isStickyMode) && wrapperRect) {
        setFixedFrame((current) => {
          const next = {
            top: -cbTop,
            left: wrapperRect.left - cbLeft,
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

  React.useEffect(() => () => {
    if (dropdownCloseTimerRef.current) {
      window.clearTimeout(dropdownCloseTimerRef.current);
      dropdownCloseTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function closeMenus(event) {
      if (!openDropdown && !mobileOpen) return;
      const root = wrapperRef.current || shellRef.current;
      if (root?.contains?.(event.target)) return;
      closeDropdownMenu();
      setMobileOpen(false);
    }

    function closeOnEscape(event) {
      if (event.key !== "Escape") return;
      closeDropdownMenu();
      setMobileOpen(false);
    }

    document.addEventListener("pointerdown", closeMenus);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeMenus);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen, openDropdown, closeDropdownMenu]);

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
  const resolvedLinks = asArray(blockProps.links).length
    ? asArray(blockProps.links)
    : asArray(blockProps.navigationLinks).length
      ? asArray(blockProps.navigationLinks)
      : asArray(blockProps.navLinks);
  const visibleLinks = shouldUseMobileMenu && !mobileOpen ? [] : resolvedLinks;
  const fixedTop = fixedFrame.top || 0;
  const fixedLeft = editor ? fixedFrame.left : (isFullWidthNav ? 0 : fixedFrame.left);
  const fixedWidth = editor ? (fixedFrame.width || undefined) : (isFullWidthNav ? "100vw" : (fixedFrame.width || "100%"));
  // Logo width is per-device: an explicit logoWidthTablet/logoWidthMobile override wins, and
  // absent that, tablet/mobile shrink to a sensible default (180px / 140px) instead of silently
  // rendering the desktop logo's own width -- a wide desktop wordmark left at full size is what
  // overflows/overlaps a narrow nav on tablet/mobile.
  const resolvedLogoWidth = resolveResponsiveProp(blockProps, "logoWidth", device, {
    fitContentFallback: true,
    fitContentValue: { tablet: 180, mobile: 140 },
  });
  const desktopLogoWidth = Number(blockProps.logoWidth) || 44;
  const brandMarkSize = Number(resolvedLogoWidth.value) || (device === "desktop" ? desktopLogoWidth : (device === "tablet" ? 180 : 140));
  const navLogoMedia = resolveResponsiveMediaSize({
    desktopWidth: brandMarkSize,
    desktopHeight: brandMarkSize,
    mediaType: "logo",
    blockType: "navigation-bar",
    device,
    containerWidth: device === "desktop" ? brandMarkSize : (device === "tablet" ? 360 : 220),
    viewportWidth: device === "tablet" ? 1024 : device === "mobile" ? 430 : undefined,
  });
  const resolvedLogoMaxWidth = resolveResponsiveProp(blockProps, "logoMaxWidth", device, {
    fitContentFallback: true,
    fitContentValue: { tablet: 180, mobile: 140 },
  });
  const brandMarkMaxWidth = resolvedLogoMaxWidth.value ? Number(resolvedLogoMaxWidth.value) : undefined;
  const shouldShowBrandMark = blockProps.showLogo || !!logoSrc;

  const shellStyle = {
    ...navTheme.shell,
    ...navFullWidth,
    width: shouldUseFixedNav ? fixedWidth : (navFullWidth.width || "100%"),
    maxWidth: shouldUseFixedNav ? fixedWidth : navFullWidth.maxWidth,
    boxSizing: "border-box",
    position: shouldUseFixedNav ? "fixed" : shouldUseTrueSticky ? "sticky" : navTheme.shell.position,
    top: shouldUseFixedNav ? fixedTop : shouldUseTrueSticky ? 0 : navTheme.shell.top,
    left: shouldUseFixedNav ? fixedLeft : navTheme.shell.left,
    right: shouldUseFixedNav ? (editor || !isFullWidthNav ? "auto" : 0) : navTheme.shell.right,
    zIndex: Math.max(Number(navTheme.shell.zIndex) || 0, isAlwaysMode ? (editor ? 28 : 120) : isStickyMode ? (editor ? 24 : 80) : 80, editor ? 80 : 10000),
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
    <section
      ref={shellRef}
      data-website-nav-shell="true"
      data-global-site-header={isGlobalSiteHeader ? "true" : undefined}
      className={isGlobalSiteHeader ? "global-site-header" : undefined}
      style={asStyleObject(shellStyle)}
    >
      <div style={asStyleObject(navTheme.brandRow)}>
        {/* Logo/brand returns to the Home page of the current site or template preview.
            display: contents keeps the existing layout untouched. */}
        <a
          href={editor ? undefined : resolvePublishedNavHref({ href: "/" }, navigationContext)}
          onClick={(event) => { if (editor) event.preventDefault(); }}
          aria-label={`${blockProps.brand || "Home"} home`}
          style={{ display: "contents", color: "inherit", textDecoration: "none" }}
        >
        {shouldShowBrandMark ? (
          <BrandMark
            brand={blockProps.brand}
            logoSrc={logoSrc}
            size={device === "desktop" ? brandMarkSize : Math.max(32, Math.min(brandMarkSize, Number(navLogoMedia.width) || brandMarkSize))}
            maxWidth={brandMarkMaxWidth}
            background={blockProps.buttonColor || blockProps.backgroundColor || "#0f172a"}
            color={blockProps.buttonTextColor || "#ffffff"}
            borderColor={blockProps.borderColor || "rgba(148,163,184,0.24)"}
            borderRadius={Math.max(8, Math.round(brandMarkSize * 0.24))}
          />
        ) : null}
        <p style={asStyleObject(navTheme.brand)}>{blockProps.brand || "Your Brand"}</p>
        </a>
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
          const itemHref = editor ? (item?.href || "#") : resolvePublishedNavHref(item, navigationContext);
          const itemDisabled = !editor && itemHref === "#__missing-page";

          return (
            <div
              key={`${item?.label || "link"}-${idx}`}
              style={{ position: "relative", display: shouldUseMobileMenu ? "grid" : "block" }}
              onMouseEnter={() => {
                if (!shouldUseMobileMenu && hasChildren) openDropdownMenu(idx);
              }}
              onMouseLeave={() => {
                if (!shouldUseMobileMenu && hasChildren) closeDropdownMenu(240);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {hasChildren ? (
                  <a
                    href={itemDisabled ? undefined : itemHref}
                    aria-disabled={itemDisabled}
                    style={{
                      ...asStyleObject(buildNavLinkStyle(blockProps, navTheme, isHighlighted)),
                      color: itemDisabled ? "rgba(226,232,240,0.45)" : asStyleObject(buildNavLinkStyle(blockProps, navTheme, isHighlighted)).color,
                      cursor: itemDisabled ? "not-allowed" : undefined,
                      textDecoration: "none",
                    }}
                    onMouseEnter={(event) => applyNavHoverEffect(event, blockProps, isHighlighted)}
                    onMouseLeave={(event) => resetNavHoverEffect(event, blockProps, linkState)}
                    onClick={(event) => {
                      if (itemDisabled) {
                        event.preventDefault();
                        return;
                      }
                      if (editor || shouldUseMobileMenu) {
                        event.preventDefault();
                        setOpenDropdown((value) => (value === idx ? null : idx));
                        return;
                      }
                      closeDropdownMenu();
                    }}
                  >
                    {item?.label || "Menu"}
                  </a>
                ) : (
                  <a
                    href={editor ? (item?.href || "#") : resolvePublishedNavHref(item, navigationContext)}
                    style={asStyleObject(buildNavLinkStyle(blockProps, navTheme, isHighlighted))}
                    onMouseEnter={(event) => applyNavHoverEffect(event, blockProps, isHighlighted)}
                    onMouseLeave={(event) => resetNavHoverEffect(event, blockProps, linkState)}
                  >
                    {item?.label || "Link"}
                  </a>
                )}
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
                      position: "relative",
                      zIndex: 2,
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      cancelDropdownClose();
                      setOpenDropdown((value) => (value === idx ? null : idx));
                    }}
                  >
                    ▾
                  </button>
                ) : null}
              </div>

              {hasChildren && isOpen ? (
                <div
                  style={{
                    position: isMobile ? "relative" : "absolute",
                    top: isMobile ? "auto" : "100%",
                    left: 0,
                    minWidth: isMobile ? "100%" : 220,
                    display: "grid",
                    gap: 6,
                    padding: 10,
                    borderRadius: 14,
                    background: blockProps.backgroundColor || "#0b1220",
                    border: `1px solid ${blockProps.borderColor || "rgba(148,163,184,0.24)"}`,
                    boxShadow: "0 20px 38px rgba(15,23,42,0.18)",
                    overflow: "visible",
                    pointerEvents: "auto",
                    zIndex: 10050,
                  }}
                >
                  {asArray(item.children).map((child, childIdx) => {
                    const childHref = editor ? (child?.href || "#") : resolvePublishedNavHref(child, navigationContext);
                    const disabled = !childHref || childHref === "#__missing-page";
                    return (
                      <a
                        key={`${child?.label || "child"}-${childIdx}`}
                        href={disabled ? undefined : childHref}
                        aria-disabled={disabled}
                        onClick={(event) => {
                          if (disabled) {
                            event.preventDefault();
                            return;
                          }
                          closeDropdownMenu();
                          if (shouldUseMobileMenu) setMobileOpen(false);
                        }}
                        style={{
                          color: disabled ? "rgba(226,232,240,0.45)" : blockProps.textColor || "#e2e8f0",
                          cursor: disabled ? "not-allowed" : "pointer",
                          textDecoration: "none",
                          fontSize: MIN_TEXT_SIZE,
                          fontWeight: 600,
                          padding: "8px 10px",
                          borderRadius: 10,
                          minHeight: MIN_TAP_SIZE,
                          minWidth: MIN_TAP_SIZE,
                          display: "inline-flex",
                          alignItems: "center",
                          background: disabled ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.04)",
                        }}
                        title={disabled ? "This published page is not available." : undefined}
                      >
                        {child?.label || "Sub link"}
                      </a>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {(() => {
        const navCta = resolvePageAwareCta(blockProps, navigationContext);
        return navCta.text ? (
        <a href={editor ? (navCta.href || "#") : resolvePublishedNavHref({ pageId: blockProps.cta?.pageId, href: navCta.href || "#" }, navigationContext)} style={asStyleObject(navTheme.cta)}>
          {navCta.text}
        </a>
        ) : null;
      })()}
    </section>
  );

  if (isAlwaysMode || isStickyMode) {
    return (
        <div
          ref={wrapperRef}
          data-global-site-header-wrapper={isGlobalSiteHeader ? "true" : undefined}
          style={{
            position: "relative",
            width: "100%",
            minHeight: shouldUseFixedNav ? (navHeight || undefined) : undefined,
          }}
        >
        {renderNavSection()}
      </div>
    );
  }

  return renderNavSection();
}

// Public renderer API; navigation remains owned by this module.
export { NavBarBlock };
export { clampValue, snapToGrid, shouldSkipToolbarBlur, htmlToPlainText } from "./wbBlockHelpers.js";
export { cleanInlineEditorHtml } from "../../../modules/website-builder/utils/inlineHtml";
export { LayeredImageStackBlock, EditableImageBlock } from "./wbMediaBlocks.js";
export { getListMarker, ColumnEditorCard, resolveSplitFaqBlockProps, resolveSplitHeadlineBlockProps, resolveSplitBodyBlockProps, SplitFaqBlock, resolveColumnCardStyle } from "./wbColumnBlocks.js";
export { FAQAccordionItems, FAQAccordionBlock } from "../../../modules/website-builder/blocks/accordion/AccordionBlock";
export { renderOverlayGuides, getOverlayGuideState, getPixelGuideState, renderCanvasCenterGuides, getOverlayBoundsElement, useOverlayBounds, DraggableContentOverlay, ExtraTextOverlay, ExtraCounterOverlay, DraggableImageOverlay } from "./wbOverlayBlocks.js";
export { normalizeGridSectionItems, renderGridSectionIcon, resolveServicesStylePreset, resolveServicesColorPreset, ServicesGridCard, isServicesGridVariant, resolveGridSectionCardStyle, IconCounterBlock } from "./wbServiceBlocks.js";
export { HoverCardsBlock, FramerPortfolioBlock, AvatarMorphBlock } from "./wbShowcaseBlocks.js";
export { FeatureAccordionBlock, ScrollStackBlock } from "./wbAccordionBlocks.js";
export { VideoHeroBlock } from "./wbVideoBlocks.js";
