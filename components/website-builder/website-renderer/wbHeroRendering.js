import React from "react";
import { openSharedMediaPicker } from "../../../lib/openSharedMediaPicker";
import { DEFAULT_LAYOUT_WIDTH, getAnimationStyle, ensureWebsiteBlockAnimationStyles, ScrollReveal, HtmlEmbedBlock, ambientMotionStyle, resolveHeroBaseColor, heroBackground, IconCounterNumber } from "./wbAnimations";
import { colorWithAlpha, asStyleObject, asRichHtml, stripPlaceholder, computeHeadlineTextStyleCss, fullWidthStyle, normalizeOverlayLayoutProps, heroLayoutDefaults, heroVariantStyles, findScrollParent, sharedStyles } from "./wbVariantStyles";
import { shouldSkipToolbarBlur, cleanInlineEditorHtml, DraggableContentOverlay, ExtraTextOverlay, ExtraCounterOverlay, DraggableImageOverlay } from "./wbBlockComponents";

export const shouldLogHeroVideoDebug = () => typeof window !== "undefined" && process.env.NODE_ENV !== "production";

function getHeroVideoDebugState(video) {
  if (!video) return {};
  return {
    currentTime: Number.isFinite(video.currentTime) ? Number(video.currentTime.toFixed(3)) : null,
    duration: Number.isFinite(video.duration) ? Number(video.duration.toFixed(3)) : null,
    paused: video.paused,
    ended: video.ended,
    muted: video.muted,
    loop: video.loop,
    autoplay: video.autoplay,
    playsInline: video.playsInline,
    preload: video.preload,
    readyState: video.readyState,
    networkState: video.networkState,
    currentSrc: video.currentSrc || "",
    error: video.error ? { code: video.error.code, message: video.error.message } : null,
  };
}

function logHeroVideoDebug(label, eventName, video, extra = {}) {
  if (!shouldLogHeroVideoDebug()) return;
  console.info(`[HeroVideoDebug] ${label}: ${eventName}`, {
    ...getHeroVideoDebugState(video),
    ...extra,
  });
}

function HeroBackgroundVideo({ src, style, blockId }) {
  const videoRef = React.useRef(null);
  const debugLabel = `hero-background ${blockId || "unknown"}`;

  React.useEffect(() => {
    const video = videoRef.current;
    logHeroVideoDebug(debugLabel, "Hero component mounted", video, { src });
    return () => logHeroVideoDebug(debugLabel, "Hero component unmounted", video, { src });
  }, [debugLabel, src]);

  React.useEffect(() => {
    logHeroVideoDebug(debugLabel, "Video source changed", videoRef.current, { src });
  }, [debugLabel, src]);

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      muted
      playsInline
      preload="auto"
      onPlay={(event) => logHeroVideoDebug(debugLabel, "Video started", event.currentTarget)}
      onPause={(event) => logHeroVideoDebug(debugLabel, "Video paused", event.currentTarget)}
      onEnded={(event) => logHeroVideoDebug(debugLabel, "Video ended", event.currentTarget)}
      onStalled={(event) => logHeroVideoDebug(debugLabel, "Video stalled", event.currentTarget)}
      onWaiting={(event) => logHeroVideoDebug(debugLabel, "Video waiting", event.currentTarget)}
      onError={(event) => logHeroVideoDebug(debugLabel, "Video error", event.currentTarget)}
      style={style}
    />
  );
}

const ORBIT_CARD_DEFAULTS = [
  { id: "oc1", title: "Integrations", icon: "🔗", accent: "#6366f1", lines: ["Slack, Gmail +26 more", "All connected"] },
  { id: "oc2", title: "Dashboards",   icon: "📊", accent: "#10b981", lines: ["$120,760 revenue", "↑ 14% this month"] },
  { id: "oc3", title: "Conversations",icon: "💬", accent: "#3b82f6", lines: ["3 unread threads", "Team standup done"] },
  { id: "oc4", title: "Data records", icon: "🗂️", accent: "#f59e0b", lines: ["lead_scoring_model", "sales_targets_rev2"] },
  { id: "oc5", title: "Files",        icon: "📁", accent: "#8b5cf6", lines: ["proposal_v2.pdf", "client_brief.docx"] },
  { id: "oc6", title: "Updates",      icon: "🔔", accent: "#ec4899", lines: ["Ben shared a draft", "2 mentions today"] },
];

const ORBIT_CARD_SLOTS = [
  { pos: { top: "7%",     left:  "1%" }, py: 230, px: -55, flyDX: -180, flyDY: -200 }, // top-left
  { pos: { top: "7%",     right: "1%" }, py: 210, px:  55, flyDX:  180, flyDY: -200 }, // top-right
  { pos: { top: "42%",    left:  "0%" }, py: 115, px: -30, flyDX: -220, flyDY:   20 }, // mid-left
  { pos: { top: "42%",    right: "0%" }, py: 115, px:  30, flyDX:  220, flyDY:   20 }, // mid-right
  { pos: { bottom: "10%", left:  "1%" }, py:  40, px: -15, flyDX: -140, flyDY:  180 }, // bot-left
  { pos: { bottom: "10%", right: "1%" }, py:  40, px:  15, flyDX:  140, flyDY:  180 }, // bot-right
];

const ORBIT_FLOAT_DURATIONS = [5.8, 6.4, 5.2, 6.9, 5.5, 6.1];

const ORBIT_FLOAT_DELAYS    = [0, -2.1, -1.4, -3.2, -0.7, -2.8];

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function easeInCubic(t) { return t * t * t; }

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function OrbitCardsLayer({ orbitCards }) {
  const wrapRef      = React.useRef(null);
  const parallaxRefs = React.useRef([]);

  React.useEffect(() => {
    ensureWebsiteBlockAnimationStyles();

    const wrap = wrapRef.current;
    if (!wrap) return;
    const section = wrap.closest("section");
    if (!section) return;

    const scrollWrapper = section.closest("[data-orbit-scroll-wrapper]");
    if (!scrollWrapper) return;

    function findScrollParent(node) {
      if (!node || node === document.body || node === document.documentElement) return window;
      try {
        const { overflow, overflowY } = window.getComputedStyle(node);
        if (/auto|scroll/.test(overflow + overflowY) && node.scrollHeight > node.clientHeight + 4) return node;
      } catch (_) { /* ignore */ }
      return findScrollParent(node.parentElement);
    }
    const scrollParent = findScrollParent(scrollWrapper.parentElement);
    const isWindow = scrollParent === window;

    const avatarEl = section.querySelector("[data-orbit-avatar]");

    let rafId = null;
    let convergeTargets = null;

    const getProgress = () => {
      const rect  = scrollWrapper.getBoundingClientRect();
      const viewH = isWindow ? window.innerHeight : scrollParent.getBoundingClientRect().height;
      const total = scrollWrapper.offsetHeight - viewH;
      if (total <= 0) return 0;
      return clamp01(-rect.top / total);
    };

    // Compute how far each card needs to travel to reach the avatar centre.
    // Called once after the first layout paint so positions are accurate.
    const computeConvergeTargets = () => {
      const sR = section.getBoundingClientRect();
      const cx = sR.width  / 2;
      const cy = sR.height / 2 - 40; // slightly above centre where avatar sits
      return parallaxRefs.current.map((el) => {
        if (!el) return { dx: 0, dy: 0 };
        const r    = el.getBoundingClientRect();
        const cardCX = (r.left - sR.left) + 88; // 88 = half of 176px card width
        const cardCY = (r.top  - sR.top)  + r.height / 2;
        return { dx: cx - cardCX, dy: cy - cardCY };
      });
    };

    const tick = () => {
      const p = getProgress();

      // ── Colour reveal on avatar ─────────────────────────────────────────
      if (avatarEl) {
        const cp    = easeOutCubic(clamp01(p / 0.38));
        avatarEl.style.filter     = `grayscale(${((1 - cp) * 100).toFixed(0)}%) brightness(${(0.48 + cp * 0.52).toFixed(2)})`;
        avatarEl.style.willChange = "filter";
        avatarEl.style.transition = "none";
      }

      parallaxRefs.current.forEach((el, i) => {
        if (!el) return;
        const slot = ORBIT_CARD_SLOTS[i];

        if (p < 0.40) {
          // Phase 1 — fly in
          const fp  = easeOutCubic(clamp01(p / 0.40));
          el.style.transform = `translate(${(slot.flyDX * (1 - fp)).toFixed(1)}px, ${(slot.flyDY * (1 - fp)).toFixed(1)}px) scale(${(0.62 + fp * 0.38).toFixed(3)})`;
          el.style.opacity   = Math.min(1, fp * 1.4).toFixed(3);
        } else if (p < 0.62) {
          // Phase 2 — rest (identity transform)
          el.style.transform = "translate(0px,0px) scale(1)";
          el.style.opacity   = "1";
        } else {
          // Phase 3 — converge behind avatar
          const cp  = easeInCubic(clamp01((p - 0.62) / 0.38));
          const t   = convergeTargets?.[i] || { dx: 0, dy: 0 };
          el.style.transform = `translate(${(t.dx * cp).toFixed(1)}px, ${(t.dy * cp).toFixed(1)}px) scale(${(1 - cp * 0.9).toFixed(3)})`;
          el.style.opacity   = (1 - cp).toFixed(3);
        }
      });
      // Compute converge targets the FIRST time all cards are at identity
      // (phase 2 has just applied transform=identity above), so getBoundingClientRect
      // reflects true resting positions rather than fly-in offsets.
      if (!convergeTargets && p >= 0.40 && parallaxRefs.current[0]) {
        convergeTargets = computeConvergeTargets();
      }
    };

    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    };

    const scrollTarget = isWindow ? window : scrollParent;
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    // Run first tick after a frame so DOM is laid out.
    // convergeTargets will be computed lazily once p >= 0.40 (phase 2)
    // so it uses resting-position transforms, not fly-in transforms.
    requestAnimationFrame(() => { tick(); });

    return () => {
      scrollTarget.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
      if (avatarEl) { avatarEl.style.filter = ""; avatarEl.style.willChange = ""; }
    };
  }, []);

  const cards = Array.isArray(orbitCards) && orbitCards.length > 0 ? orbitCards : ORBIT_CARD_DEFAULTS;

  return (
    <div
      ref={wrapRef}
      style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}
    >
      {cards.slice(0, 6).map((card, i) => {
        const slot   = ORBIT_CARD_SLOTS[i];
        if (!slot) return null;
        const accent = card.accent || "#6366f1";
        return (
          <div
            key={card.id || String(i)}
            ref={(el) => { parallaxRefs.current[i] = el; }}
            style={{
              position: "absolute",
              ...slot.pos,
              width: 176,
              willChange: "transform, opacity",
              opacity: 0,
              transform: `translate(${slot.flyDX}px, ${slot.flyDY}px) scale(0.62)`,
            }}
          >
            <div
              style={{
                animation: `wbOrbitFloat${i} ${ORBIT_FLOAT_DURATIONS[i]}s ${ORBIT_FLOAT_DELAYS[i]}s ease-in-out infinite`,
                willChange: "transform",
                background: "rgba(10,18,36,0.88)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                border: "1px solid rgba(148,163,184,0.13)",
                borderRadius: 16,
                boxShadow: "0 12px 36px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.08)",
                overflow: "hidden",
              }}
            >
              <div style={{ height: 3, background: `linear-gradient(90deg, ${accent}, ${accent}66)` }} />
              <div style={{ padding: "10px 14px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: `${accent}20`, border: `1px solid ${accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, lineHeight: 1 }}>{card.icon || "✦"}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", letterSpacing: "0.01em", lineHeight: 1.3 }}>{card.title}</span>
                </div>
                {(Array.isArray(card.lines) ? card.lines : []).slice(0, 2).map((line, li) => (
                  <div key={li} style={{ fontSize: 11, color: li === 0 ? "#94a3b8" : "#475569", lineHeight: 1.55, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line}</div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function renderHeroBlock({ block, compact, device, assets, editor, isSelected, onChangeBlock, onUploadImage, onSelectAsset, navigationContext, siteId, props, shouldRunAnimations, imageSrc, heroBackgroundImage, brandLogoSrc, resolvePageAwareCta, resolveSecondaryHeroCta, resolveSectionMinHeight }) {
      const useFullBleedHero = true;
      const heroFullWidth = fullWidthStyle({
        ...props,
        fullWidthBackground: useFullBleedHero,
      }, compact, editor);
      const heroVariant = heroVariantStyles(props, compact);
      const heroLayout = heroLayoutDefaults(props.heroVariant || "spotlight", compact);
      const heroLibraryImages = Array.isArray(assets?.images) ? assets.images.slice(0, compact ? 2 : 4) : [];
      const heroOverlayLibraryImages = Array.isArray(assets?.images) ? assets.images.slice(0, 12) : [];
      const openHeroMediaLibrary = (fieldKey) => openSharedMediaPicker({
        onPick: (asset) => {
          if (!asset?.src) return;
          onSelectAsset?.(fieldKey, asset);
        },
      });
      const showHeroMediaControls = !!editor;
      const isVideoHero = props.backgroundStyle === "video" && !!props.backgroundVideoUrl;
      const heroBg = isVideoHero
        ? (props.backgroundColor || "#0f172a")
        : heroBackground({ ...props, backgroundImage: heroBackgroundImage });
      const heroStaticStyle = asStyleObject(heroBg);
      const heroParallaxEnabled = ["hero", "parallax"].includes(block?.type) && !!props.enableParallax && !!heroBackgroundImage && !isVideoHero;
      const heroRequestedBackgroundSize = props.backgroundSize || props.imageFit || props.objectFit || heroStaticStyle.backgroundSize || "cover";
      const heroBackgroundSize = String(heroRequestedBackgroundSize || "cover");
      const heroBackgroundPosition = props.imagePosition || props.backgroundPosition || heroStaticStyle.backgroundPosition || "center center";
      const heroImageBrightness = Math.max(0.25, Math.min(2, Number(props.imageBrightness ?? 1) || 1));
      const heroUsesFixedSafeBackground = /^cover$/i.test(heroBackgroundSize.trim());
      // Use CSS background-attachment:fixed so the background image stays completely still
      // while the section content and floating overlays scroll past it.
      // CSS fixed backgrounds size against the browser viewport, not the section.
      // For contain/custom fits, render as a normal section background so builder and preview match.
      const isFixedBgParallax = heroParallaxEnabled && heroUsesFixedSafeBackground;
      const heroParallaxBaseColor = heroParallaxEnabled ? resolveHeroBaseColor(props) : null;
      const heroContainedBackgroundStyle = !heroUsesFixedSafeBackground && heroBackgroundImage
        ? {
            backgroundColor: heroStaticStyle.backgroundColor || heroParallaxBaseColor || "#0f172a",
          }
        : null;
      const renderHeroImageLayer = !!heroBackgroundImage && !isVideoHero;
      const sectionBgStyle = renderHeroImageLayer
        ? { backgroundColor: heroStaticStyle.backgroundColor || heroParallaxBaseColor || props.backgroundColor || "#0f172a" }
        : isFixedBgParallax
        ? { backgroundColor: heroStaticStyle.backgroundColor || heroParallaxBaseColor || "#0f172a" }
        : (heroContainedBackgroundStyle || heroStaticStyle);
      const explicitHeroOverlay = String(props.backgroundOverlay || props.backgroundOverlayColor || "").trim();
      const parallaxStaticOverlay = isFixedBgParallax && explicitHeroOverlay && explicitHeroOverlay !== "transparent"
        ? `linear-gradient(135deg, ${explicitHeroOverlay}, ${explicitHeroOverlay})`
        : null;
      const heroOverlayEnabled = !compact;
      // Only render explicitly added overlay images. Legacy/default floatingImage
      // props should not create a foreground overlay block automatically.
      const rawFloatingImages = Array.isArray(props.floatingImages) ? props.floatingImages : [];
      const renderFloatingImages = compact && rawFloatingImages.length > 2 ? [] : rawFloatingImages;
      const hasFloatingHeroImage = renderFloatingImages.some((item) => String(item?.src || "").trim());
      const heroOverlayImageFit = "contain";
      const heroImageOverlayAnimation = String(props.imageOverlayAnimation || "sweep-left");
      const heroImageOverlayDelay = Number(props.imageOverlayAnimationDelay ?? 0.08) || 0.08;
      const heroImageOverlaySpeed = Number(props.imageOverlayAnimationSpeed ?? 1.45) || 1.45;
      const heroContentOverlayAnimation = String(props.contentOverlayAnimation || "sweep-right");
      const heroContentOverlayDelay = Number(props.contentOverlayAnimationDelay ?? 0.22) || 0.22;
      const heroContentOverlaySpeed = Number(props.contentOverlayAnimationSpeed ?? 1.05) || 1.05;
      const heroCtaAnimation = String(props.ctaAnimation || "fade-up");
      const heroCtaDelay = Number(props.ctaAnimationDelay ?? 0.18) || 0.18;
      const heroCtaSpeed = Number(props.ctaAnimationSpeed ?? 0.9) || 0.9;
      const primaryCta = resolvePageAwareCta(props, navigationContext);
      const secondaryCta = resolveSecondaryHeroCta(props, navigationContext);
      const rawHeroMarginTop = Math.max(0, Number(props.marginTop || 0));
      const heroMarginTop = editor ? Math.min(rawHeroMarginTop, 24) : rawHeroMarginTop;
      const headlineBlock = props.headlineBlock && typeof props.headlineBlock === "object" ? props.headlineBlock : {};
      const bodyBlock = props.bodyBlock && typeof props.bodyBlock === "object" ? props.bodyBlock : {};
      const headingColor = headlineBlock.color || props.headlineColor || "#ffffff";
      const headingFamily = headlineBlock.fontFamily || props.headlineFontFamily || "system-ui, -apple-system, sans-serif";
      const headingWeight = headlineBlock.fontWeight || props.headlineFontWeight || "700";
      const headingLineHeight = headlineBlock.lineHeight || props.headlineLineHeight || 1.1;
      const headingFontSize = headlineBlock.fontSize || props.headlineFontSize || 52;
      const bodyColor = bodyBlock.color || props.textColor || headingColor;
      const bodyFamily = bodyBlock.fontFamily || props.fontFamily || headingFamily;
      const bodyWeight = bodyBlock.fontWeight || props.fontWeight || "400";
      const bodyLineHeight = bodyBlock.lineHeight || props.subheadlineLineHeight || props.textLineHeight || 1.6;
      const bodyFontSize = bodyBlock.fontSize || props.subheadlineFontSize || 20;
      const headingAlign = headlineBlock.alignment || props.headlineAlignment || props.headlineAlign || props.headingAlign || heroLayout.headlineAlignment || "center";
      const heroHorizontalInset = compact ? 24 : 48;
      const heroContentMaxWidth = Math.max(320, Number(props.baseLayoutWidth || DEFAULT_LAYOUT_WIDTH));
      const heroContentBounds = compact ? {
        position: "relative",
        width: "100%",
        maxWidth: "100%",
        zIndex: heroParallaxEnabled ? 3 : 2,
      } : {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: "50%",
        transform: `translateX(-50%)`,
        width: `min(100%, ${heroContentMaxWidth}px)`,
        height: "100%",
        zIndex: heroParallaxEnabled ? 3 : 2,
      };
      const heroContentBoundsInner = compact ? {
        width: "100%",
        maxWidth: "100%",
        height: "auto",
        margin: "0 auto",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      } : {
        width: `calc(100% - ${heroHorizontalInset * 2}px)`,
        maxWidth: `${heroContentMaxWidth}px`,
        height: "100%",
        margin: "0 auto",
        minWidth: 0,
      };
      const overlayAnimationLayer = (zIndex, animationStyle = {}) => ({
        position: compact ? "relative" : "absolute",
        inset: compact ? undefined : 0,
        zIndex,
        width: "100%",
        height: compact ? "auto" : "100%",
        pointerEvents: compact ? "auto" : "none",
        ...animationStyle,
      });
      const normalizedOverlayLayout = normalizeOverlayLayoutProps(
        props,
        {
          ...heroLayout,
          contentY: hasFloatingHeroImage ? (heroVariant.imageDefaults?.contentY ?? heroLayout.contentY) : heroLayout.contentY,
          floatingX: heroVariant.imageDefaults?.x ?? heroLayout.floatingX,
          floatingY: heroVariant.imageDefaults?.y ?? heroLayout.floatingY,
          floatingWidth: heroVariant.imageDefaults?.width ?? heroLayout.floatingWidth,
          floatingHeight: heroVariant.imageDefaults?.height ?? heroLayout.floatingHeight,
        },
        hasFloatingHeroImage,
      );
      const heroOverlayProps = normalizedOverlayLayout;
      const heroContentProps = normalizedOverlayLayout;
      // Orbit variant uses a sticky scroll container so the section pins while
      // scroll progress drives the fly-in → rest → converge animation.
      const isOrbitScroll = props.heroVariant === "orbit" && !compact;

      const heroSection = (
        <ScrollReveal
          as="section"
          animationName={(heroParallaxEnabled || isOrbitScroll) ? "" : props.sectionAnimation}
          delay={props.sectionAnimationDelay || 0}
          speed={props.sectionAnimationSpeed}
          disabled={editor || heroParallaxEnabled || isOrbitScroll}
          style={{
            position: isOrbitScroll ? "sticky" : "relative",
            top: isOrbitScroll ? 0 : undefined,
            height: isOrbitScroll ? "100vh" : undefined,
            // In the editor, use overflow:visible so floating images positioned near the
            // edges of the content bounds can extend beyond the section without being clipped.
            // In live/preview, keep overflow:hidden to clip background parallax layers.
            overflow: (compact || editor) ? "visible" : "hidden",
            borderRadius: compact ? 12 : (useFullBleedHero ? 0 : 20),
            ...heroFullWidth,
            ...heroVariant.shell,
            marginTop: heroMarginTop ? `${heroMarginTop}px` : undefined,
            minHeight: isOrbitScroll ? undefined : resolveSectionMinHeight(props, device, compact, 180, props.minHeight || "400px"),
            ...sectionBgStyle,
            padding: compact ? "40px 24px" : "80px 48px",
          }}
        >
          {renderHeroImageLayer ? (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 0,
                backgroundImage: heroStaticStyle.backgroundImage || `url(${heroBackgroundImage})`,
                backgroundSize: heroBackgroundSize,
                backgroundPosition: heroBackgroundPosition,
                backgroundRepeat: props.backgroundRepeat || heroStaticStyle.backgroundRepeat || "no-repeat",
                backgroundAttachment: isFixedBgParallax ? "fixed" : undefined,
                filter: heroImageBrightness !== 1 ? `brightness(${heroImageBrightness})` : undefined,
                pointerEvents: "none",
              }}
            />
          ) : null}
          {heroParallaxEnabled && parallaxStaticOverlay && props.overlayEnabled !== false && props.backgroundOverlayEnabled !== false ? (
            <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 2, background: parallaxStaticOverlay, pointerEvents: "none" }} />
          ) : null}
          {block?.type === "hero" ? (
            <div style={editor ? undefined : { ...ambientMotionStyle("pulse") }}>
              {heroVariant.decor}
            </div>
          ) : null}

          {isVideoHero ? (
            <>
              <HeroBackgroundVideo
                src={props.backgroundVideoUrl}
                blockId={block?.id}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
              />
              {props.videoOverlayColor && props.videoOverlayColor !== "transparent" ? (
                <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 1, background: props.videoOverlayColor, pointerEvents: "none" }} />
              ) : null}
            </>
          ) : null}
          {showHeroMediaControls ? (
            <div style={{ position: "absolute", left: 12, bottom: 12, zIndex: 6, display: "grid", gap: 8, maxWidth: compact ? "calc(100% - 24px)" : 460 }}>
              {isVideoHero ? (
                /* ── Video mode: show video controls ── */
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: compact ? "10px 12px" : "12px 14px", borderRadius: 16, background: "rgba(15,23,42,0.72)", border: "1px solid rgba(168,85,247,0.5)", boxShadow: "0 16px 34px rgba(15,23,42,0.18)" }}>
                  <span style={{ color: "#e2e8f0", fontSize: compact ? 12 : 13, fontWeight: 600 }}>🎬 Video background</span>
                  <label style={{ ...sharedStyles.editorChip, background: "#a855f7", color: "#fff", cursor: "pointer" }}>
                    Replace Video
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/*"
                      style={{ display: "none" }}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        const localUrl = URL.createObjectURL(file);
                        onChangeBlock?.({ ...props, backgroundStyle: "video", backgroundVideoUrl: localUrl });
                        onUploadImage?.("backgroundVideoUrl", file);
                      }}
                    />
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }} title="Overlay colour — darken/tint the video">
                    <span style={{ color: "#94a3b8", fontSize: 12, whiteSpace: "nowrap" }}>Overlay</span>
                    <input
                      type="color"
                      value={(() => { const c = props.videoOverlayColor || "rgba(0,0,0,0)"; const m = c.match(/rgba?\((\d+),(\d+),(\d+)/); if (!m) return "#000000"; return "#" + [m[1],m[2],m[3]].map((n) => parseInt(n).toString(16).padStart(2,"0")).join(""); })()}
                      onChange={(e) => {
                        const hex = e.target.value;
                        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
                        const existing = props.videoOverlayColor || "rgba(0,0,0,0.45)";
                        const alphaMatch = existing.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)/);
                        const alpha = alphaMatch ? parseFloat(alphaMatch[1]) : 0.45;
                        onChangeBlock?.({ ...props, videoOverlayColor: `rgba(${r},${g},${b},${alpha})` });
                      }}
                      style={{ width: 28, height: 24, padding: 1, border: "1px solid rgba(255,255,255,0.2)", borderRadius: 5, cursor: "pointer", background: "transparent" }}
                    />
                    <input
                      type="range"
                      min={0} max={0.95} step={0.05}
                      value={(() => { const m = (props.videoOverlayColor || "").match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)/); return m ? parseFloat(m[1]) : 0; })()}
                      onChange={(e) => {
                        const alpha = parseFloat(e.target.value);
                        const existing = props.videoOverlayColor || "rgba(0,0,0,0)";
                        const m = existing.match(/rgba?\((\d+),(\d+),(\d+)/);
                        const [r,g,b] = m ? [m[1],m[2],m[3]] : ["0","0","0"];
                        onChangeBlock?.({ ...props, videoOverlayColor: `rgba(${r},${g},${b},${alpha})` });
                      }}
                      style={{ width: 80 }}
                    />
                    <span style={{ color: "#94a3b8", fontSize: 11, minWidth: 28 }}>{Math.round(((() => { const m = (props.videoOverlayColor || "").match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)/); return m ? parseFloat(m[1]) : 0; })()) * 100)}%</span>
                  </div>
                  <button
                    type="button"
                    style={{ ...sharedStyles.editorChip, background: "rgba(148,163,184,0.25)", color: "#e2e8f0" }}
                    onClick={() => onChangeBlock?.({ ...props, backgroundStyle: "image", backgroundVideoUrl: "" })}
                  >Switch to Image</button>
                </div>
              ) : !heroBackgroundImage ? (
                /* ── Empty state: offer image OR video upload ── */
                <div style={{ borderRadius: 18, border: "2px dashed rgba(125,211,252,0.7)", background: "rgba(15,23,42,0.42)", padding: compact ? 14 : 18, display: "grid", gap: 10, color: "#e2e8f0", boxShadow: "0 16px 34px rgba(15,23,42,0.2)" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong style={{ fontSize: compact ? 14 : 16 }}>{block?.type === "parallax" ? "Section background" : "Hero background"}</strong>
                    <span style={{ fontSize: compact ? 12 : 13, opacity: 0.82 }}>Upload an image or video, or pick from the library.</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <label style={{ ...sharedStyles.editorChip, background: "#7dd3fc", color: "#082f49", cursor: "pointer" }}>
                      📷 Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (!file) return;
                          onChangeBlock?.({ ...props, backgroundStyle: "image" });
                          onUploadImage?.("backgroundImage", file);
                        }}
                      />
                    </label>
                    <label style={{ ...sharedStyles.editorChip, background: "#a855f7", color: "#fff", cursor: "pointer" }}>
                      🎬 Upload Video
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/*"
                        style={{ display: "none" }}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (!file) return;
                          const localUrl = URL.createObjectURL(file);
                          onChangeBlock?.({ ...props, backgroundStyle: "video", backgroundVideoUrl: localUrl });
                          onUploadImage?.("backgroundVideoUrl", file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      style={{ ...sharedStyles.editorChip, background: "#7dd3fc", color: "#082f49" }}
                      onClick={() => openHeroMediaLibrary("backgroundImage")}
                    >
                      Open Media Library
                    </button>
                    {heroLibraryImages.map((image) => (
                      <button
                        key={`hero-library-${image.id || image.src}`}
                        type="button"
                        onClick={() => onSelectAsset ? onSelectAsset("backgroundImage", image) : onChangeBlock?.({ ...props, backgroundStyle: "image", backgroundImage: image.src || "", backgroundImageAssetId: image.id || "" })}
                        style={{ width: compact ? 56 : 64, height: compact ? 56 : 64, padding: 0, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(226,232,240,0.28)", cursor: "pointer", background: "#0f172a" }}
                        title={image.name || "Use library image"}
                      >
                        <img src={image.src} alt={image.name || "Library image"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* ── Has image: Replace image + option to switch to video ── */
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: compact ? "10px 12px" : "12px 14px", borderRadius: 16, background: "rgba(15,23,42,0.52)", border: "1px solid rgba(125,211,252,0.22)", boxShadow: "0 16px 34px rgba(15,23,42,0.18)" }}>
                  <span style={{ color: "#e2e8f0", fontSize: compact ? 12 : 13, fontWeight: 600 }}>{block?.type === "parallax" ? "Section background" : "Hero background"}</span>
                  <label style={{ ...sharedStyles.editorChip, background: "#7dd3fc", color: "#082f49", cursor: "pointer" }}>
                    Replace Image
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        onChangeBlock?.({ ...props, backgroundStyle: "image" });
                        onUploadImage?.("backgroundImage", file);
                      }}
                    />
                  </label>
                  <label style={{ ...sharedStyles.editorChip, background: "#a855f7", color: "#fff", cursor: "pointer" }} title="Use a video as background instead">
                    Use Video Instead
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/*"
                      style={{ display: "none" }}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        const localUrl = URL.createObjectURL(file);
                        onChangeBlock?.({ ...props, backgroundStyle: "video", backgroundVideoUrl: localUrl });
                        onUploadImage?.("backgroundVideoUrl", file);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    style={{ ...sharedStyles.editorChip, background: "#7dd3fc", color: "#082f49" }}
                    onClick={() => openHeroMediaLibrary("backgroundImage")}
                  >
                    Open Media Library
                  </button>
                  {heroLibraryImages.map((image) => (
                    <button
                      key={`hero-library-inline-${image.id || image.src}`}
                      type="button"
                      onClick={() => onSelectAsset ? onSelectAsset("backgroundImage", image) : onChangeBlock?.({ ...props, backgroundStyle: "image", backgroundImage: image.src || "", backgroundImageAssetId: image.id || "" })}
                      style={{ width: 42, height: 42, padding: 0, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(226,232,240,0.24)", cursor: "pointer", background: "#0f172a" }}
                      title={image.name || "Use library image"}
                    >
                      <img src={image.src} alt={image.name || "Library image"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          {showHeroMediaControls ? (
            <div style={{ position: "absolute", top: 12, right: 12, zIndex: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" onClick={() => onChangeBlock?.({ ...props, headlineFontSize: Math.max(14, Number(props.headlineFontSize || 52) - 2) })} style={sharedStyles.editorChip}>A−</button>
              <button type="button" onClick={() => onChangeBlock?.({ ...props, headlineFontSize: Math.min(72, Number(props.headlineFontSize || 52) + 2) })} style={sharedStyles.editorChip}>A+</button>
              <button
                type="button"
                onClick={() => onChangeBlock?.({
                  ...props,
                  hideTextOverlay: false,
                  headline: props.headline || "Click to type headline",
                  subheadline: props.subheadline || "Add supporting text here",
                  contentX: props.contentX ?? heroLayout.contentX,
                  contentY: props.contentY ?? (hasFloatingHeroImage ? (heroVariant.imageDefaults?.contentY ?? heroLayout.contentY) : heroLayout.contentY),
                  contentWidth: props.contentWidth ?? heroLayout.contentWidth,
                  contentHeight: props.contentHeight ?? heroLayout.contentHeight,
                })}
                style={{ ...sharedStyles.editorChip, ...(props.hideTextOverlay ? { background: "#ef4444", color: "#fff", fontWeight: 600 } : {}) }}
                title={props.hideTextOverlay ? "Text is hidden in preview — click to restore" : "Restore main headline/CTA text block"}
              >
                {props.hideTextOverlay ? "⚠ Text Hidden" : "Main Text"}
              </button>
              {brandLogoSrc ? (
                <button
                  type="button"
                  onClick={() => {
                    const logoItem = { src: brandLogoSrc, assetId: "", x: heroOverlayProps.floatingX, y: heroOverlayProps.floatingY, width: heroOverlayProps.floatingWidth, height: heroOverlayProps.floatingHeight, animation: "fade-in", animationDelay: 0.1, animationSpeed: 1.0 };
                    const nextImages = rawFloatingImages.length > 0 ? [...rawFloatingImages, logoItem] : [logoItem];
                    onChangeBlock?.({ ...props, floatingImages: nextImages });
                  }}
                  style={{ ...sharedStyles.editorChip, background: "#ffffff", color: "#111827" }}
                >
                  + Logo
                </button>
              ) : null}
              <label style={{ ...sharedStyles.editorChip, background: "#f59e0b", color: "#111827", cursor: "pointer" }} title="Add image or GIF overlay — freely draggable">
                Upload Image / GIF
                <input
                  type="file"
                  accept="image/*,image/gif,image/webp,image/apng"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    Promise.resolve(onUploadImage?.("__addFloatingImage", file)).then((asset) => {
                      if (!asset?.src) return;
                      const nextImages = [...rawFloatingImages, {
                        src: asset.src,
                        assetId: asset.id || "",
                        x: 76, y: 52, width: 280, height: 320,
                        animation: "sweep-left",
                        animationDelay: 0.08,
                        animationSpeed: 1.45,
                      }];
                      onChangeBlock?.({ ...props, floatingImages: nextImages });
                    });
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => openHeroMediaLibrary("__addFloatingImage")}
                style={{ ...sharedStyles.editorChip, background: "#f59e0b", color: "#111827" }}
                title="Open the full media library"
              >
                Open Media Library
              </button>
              <details style={{ position: "relative" }}>
                <summary
                  style={{ ...sharedStyles.editorChip, background: "#f59e0b", color: "#111827", cursor: "pointer", listStyle: "none" }}
                  title="Quick picks from recent media"
                >
                  Recent Images
                </summary>
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    zIndex: 30,
                    width: compact ? 236 : 292,
                    maxHeight: 280,
                    overflow: "auto",
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(148,163,184,0.35)",
                    background: "rgba(15,23,42,0.96)",
                    boxShadow: "0 18px 42px rgba(15,23,42,0.45)",
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 8,
                  }}
                >
                  {heroOverlayLibraryImages.length ? heroOverlayLibraryImages.map((image) => (
                    <button
                      key={`hero-overlay-library-${image.id || image.src}`}
                      type="button"
                      onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                        onSelectAsset?.("__addFloatingImage", image);
                      }}
                      style={{ aspectRatio: "1 / 1", padding: 0, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(226,232,240,0.24)", cursor: "pointer", background: "#0f172a" }}
                      title={image.name || "Add library image overlay"}
                    >
                      <img src={image.src} alt={image.name || "Library image"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </button>
                  )) : (
                    <div style={{ gridColumn: "1 / -1", color: "#cbd5e1", fontSize: 12, lineHeight: 1.4, padding: 4 }}>
                      No library images yet.
                    </div>
                  )}
                </div>
              </details>
              <button
                type="button"
                onClick={() => {
                  const extraTextOverlays = Array.isArray(props.extraTextOverlays) ? props.extraTextOverlays : [];
                  // Spread new blocks so they don't all stack at the same spot
                  const baseX = 20 + (extraTextOverlays.length * 8) % 60;
                  const baseY = 15 + (extraTextOverlays.length * 12) % 55;
                  onChangeBlock?.({ ...props, extraTextOverlays: [...extraTextOverlays, { id: `txt-${Date.now()}`, text: "New text block", x: baseX, y: baseY, width: 280, height: 60, fontSize: 18, color: "#ffffff", fontWeight: "600", textAlign: "left", background: "transparent", animation: "fade-in", animationDelay: 0 }] });
                }}
                style={{ ...sharedStyles.editorChip, background: "#22c55e", color: "#fff" }}
                title="Add a free-floating text block — drag anywhere"
              >
                + Text Block
              </button>
              <button
                type="button"
                onClick={() => onChangeBlock?.({ ...props, heroHtmlEmbed: props.heroHtmlEmbed ? "" : "<!-- paste embed code here -->" })}
                style={{ ...sharedStyles.editorChip, ...(props.heroHtmlEmbed ? { background: "#0ea5e9", color: "#fff" } : {}) }}
                title="Embed custom HTML/widget code inside this hero section"
              >
                {"</>"} HTML
              </button>
            </div>
          ) : null}
          {compact ? (
            <style>{`
              .wb-compact-hero-richtext,
              .wb-compact-hero-richtext * {
                max-width: 100% !important;
                width: auto !important;
                min-width: 0 !important;
                height: auto !important;
                white-space: normal !important;
                overflow-wrap: break-word !important;
                word-break: normal !important;
                font-size: inherit !important;
                line-height: inherit !important;
                text-align: inherit !important;
                letter-spacing: 0 !important;
              }
              .wb-compact-hero-richtext h1,
              .wb-compact-hero-richtext h2,
              .wb-compact-hero-richtext h3,
              .wb-compact-hero-richtext p,
              .wb-compact-hero-richtext div {
                margin: 0 !important;
                padding: 0 !important;
              }
            `}</style>
          ) : null}
          <div data-overlay-bounds="true" style={heroContentBounds}>
            <div style={heroContentBoundsInner}>
              {/* ── Orbit feature cards are rendered AFTER the avatar (z=3 > avatar z=2) ── */}
              {renderFloatingImages.length === 0 ? null : renderFloatingImages.map((imgItem, imgIdx) => {
                const imgSrc = imgItem.src || "";
                if (!imgSrc) return null;
                const imgAnimation = String(imgItem.animation || heroImageOverlayAnimation);
                const imgDelay = Number(imgItem.animationDelay ?? heroImageOverlayDelay);
                const imgSpeed = Number(imgItem.animationSpeed ?? heroImageOverlaySpeed);
                const imgOverlayProps = {
                  ...heroOverlayProps,
                  floatingX: Number.isFinite(Number(imgItem.x)) ? Number(imgItem.x) : heroOverlayProps.floatingX,
                  floatingY: Number.isFinite(Number(imgItem.y)) ? Number(imgItem.y) : heroOverlayProps.floatingY,
                  floatingWidth: Number.isFinite(Number(imgItem.width)) ? Number(imgItem.width) : heroOverlayProps.floatingWidth,
                  floatingHeight: Number.isFinite(Number(imgItem.height)) ? Number(imgItem.height) : heroOverlayProps.floatingHeight,
                  floatingRotation: Number.isFinite(Number(imgItem.rotation)) ? Number(imgItem.rotation) : 0,
                };
                const handleImgChange = (nextProps) => {
                  const nextImages = rawFloatingImages.map((img, i) => i !== imgIdx ? img : {
                    ...img,
                    x: nextProps.floatingX,
                    y: nextProps.floatingY,
                    width: nextProps.floatingWidth,
                    height: nextProps.floatingHeight,
                    ...(nextProps.floatingRotation != null ? { rotation: nextProps.floatingRotation } : {}),
                  });
                  onChangeBlock?.({ ...props, floatingImages: nextImages });
                };
                const handleImgDelete = () => {
                  const nextImages = rawFloatingImages.filter((_, i) => i !== imgIdx);
                  onChangeBlock?.({ ...props, floatingImages: nextImages });
                };
                const handleImgMoveLayer = (direction) => {
                  const arr = [...rawFloatingImages];
                  const swapIdx = imgIdx + direction;
                  if (swapIdx < 0 || swapIdx >= arr.length) return;
                  [arr[imgIdx], arr[swapIdx]] = [arr[swapIdx], arr[imgIdx]];
                  onChangeBlock?.({ ...props, floatingImages: arr });
                };
                // Tag the first image in orbit variant so OrbitCardsLayer can
                // find and animate its colour-reveal (grayscale → full colour).
                const orbitAvatarAttr = (props.heroVariant === "orbit" && imgIdx === 0)
                  ? { "data-orbit-avatar": "true" }
                  : {};
                return (
                  <div key={`fi-${imgIdx}-${imgSrc.slice(-12)}`} {...orbitAvatarAttr} style={overlayAnimationLayer(2 + imgIdx, shouldRunAnimations ? getAnimationStyle(imgAnimation, imgDelay, imgSpeed) : {})}>
                    <div style={overlayAnimationLayer(1, shouldRunAnimations ? ambientMotionStyle("float", 0.12 + imgIdx * 0.06) : {})}>
                      <DraggableImageOverlay
                        props={imgOverlayProps}
                        compact={compact}
                        editor={editor}
                        isSelected={isSelected}
                        onChangeBlock={handleImgChange}
                        onUploadImage={onUploadImage}
                        onSelectAsset={onSelectAsset}
                        assets={assets}
                        imageSrc={imgSrc}
                        overlayEnabled={heroOverlayEnabled}
                        frameStyle={null}
                        imageFit="contain"
                        imageLabel={renderFloatingImages.length > 1 ? `Image ${imgIdx + 1}` : null}
                        onDelete={editor ? handleImgDelete : null}
                        onMoveLayer={editor && rawFloatingImages.length > 1 ? handleImgMoveLayer : null}
                      />
                    </div>
                  </div>
                );
              })}
              {/* ── Orbit feature cards — rendered AFTER avatar so z=3 puts them in front ── */}
              {props.heroVariant === "orbit" && !compact ? (
                <OrbitCardsLayer orbitCards={props.orbitCards} />
              ) : null}
              <div style={overlayAnimationLayer(3, shouldRunAnimations ? getAnimationStyle(heroContentOverlayAnimation, heroContentOverlayDelay, heroContentOverlaySpeed) : {})}>
                {props.hideTextOverlay && editor ? (
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 4, background: "rgba(239,68,68,0.88)", color: "#fff", borderRadius: 10, padding: "8px 14px", fontSize: 16, fontWeight: 600, pointerEvents: "none", whiteSpace: "nowrap" }}>
                    ⚠ Text hidden in preview — click &ldquo;⚠ Text Hidden&rdquo; button to restore
                  </div>
                ) : null}
                {props.hideTextOverlay ? null : (
                <DraggableContentOverlay props={heroContentProps} compact={compact} editor={editor} onChangeBlock={onChangeBlock} align={headingAlign} vertical={props.verticalAlign || heroLayout.verticalAlign || "center"} overlayEnabled={heroOverlayEnabled} contentShellStyle={block?.type === "hero" ? heroVariant.contentShell : null}>
                  {/* Strip maxWidth from heroVariant.content — the DraggableContentOverlay shell already controls the width via contentWidth prop */}
                  <div style={(() => { const { maxWidth: _mw, ...variantContent } = heroVariant.content || {}; return { display: "flex", flexDirection: "column", gap: compact ? 12 : 20, width: "100%", textAlign: headingAlign, ...variantContent }; })()}>
                  {!!stripPlaceholder(props.eyebrow) ? (
                    <p
                      data-website-inline-editor="true"
                      data-text-prop="eyebrow"
                      contentEditable={editor}
                      suppressContentEditableWarning
                      onMouseDown={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onBlur={(event) => {
                        if (shouldSkipToolbarBlur(event)) return;
                        if (!editor || typeof onChangeBlock !== "function") return;
                        const cleaned = cleanInlineEditorHtml(event.currentTarget.innerHTML);
                        onChangeBlock({ ...props, eyebrow: (cleaned === "Section label" || cleaned === "Section Label") ? "" : cleaned });
                      }}
                      style={{
                        position: "relative",
                        zIndex: 1,
                        margin: 0,
                        fontSize: compact ? 11 : 13,
                        lineHeight: 1.4,
                        fontWeight: 600,
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        color: colorWithAlpha(headingColor, 0.72),
                        ...(shouldRunAnimations ? getAnimationStyle(props.subheadlineAnimation || "fade-up", Math.max(0, Number(props.subheadlineAnimationDelay || 0) - 0.06), props.subheadlineAnimationSpeed) : {}),
                        outline: editor ? "1px dashed rgba(125,211,252,0.5)" : "none",
                        padding: editor ? "4px 6px" : 0,
                        borderRadius: 8,
                      }}
                      dangerouslySetInnerHTML={{ __html: asRichHtml(stripPlaceholder(props.eyebrow) || "") }}
                    />
                  ) : null}
                  <h1
                data-website-inline-editor="true"
                data-text-prop="headline"
                contentEditable={editor}
                suppressContentEditableWarning
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onBlur={(event) => {
                  if (shouldSkipToolbarBlur(event)) return;
                  if (!editor || typeof onChangeBlock !== "function") return;
                  const cleaned = cleanInlineEditorHtml(event.currentTarget.innerHTML);
                  const nextContent = cleaned === "Click to type headline" ? "" : cleaned;
                  onChangeBlock({
                    ...props,
                    headline: nextContent,
                    headlineBlock: { ...(props.headlineBlock || {}), content: nextContent },
                  });
                }}
                style={{
                  position: "relative",
                  zIndex: 1,
                  margin: 0,
                  fontSize: compact ? 22 : headingFontSize,
                  lineHeight: headingLineHeight,
                  fontWeight: headingWeight,
                  fontFamily: headingFamily,
                  color: headingColor,
                  ...computeHeadlineTextStyleCss(props),
                  ...(shouldRunAnimations ? getAnimationStyle(props.textAnimation, props.textAnimationDelay || 0, props.textAnimationSpeed) : {}),
                  width: "100%",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                  outline: editor ? "1px dashed rgba(125,211,252,0.5)" : "none",
                  padding: editor ? "4px 6px" : 0,
                  wordBreak: "normal",
                  overflowWrap: "break-word",
                  borderRadius: 8,
                }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(stripPlaceholder(headlineBlock.content ?? props.headline) || (editor ? "Click to type headline" : "")) }}
              />
                  {(editor || !!stripPlaceholder(props.subheadline)) ? (
                    <p
                  data-website-inline-editor="true"
                  data-text-prop="subheadline"
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onMouseDown={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onBlur={(event) => {
                    if (shouldSkipToolbarBlur(event)) return;
                    if (!editor || typeof onChangeBlock !== "function") return;
                    const cleaned = cleanInlineEditorHtml(event.currentTarget.innerHTML);
                    const nextContent = cleaned === "Add supporting text here" ? "" : cleaned;
                    onChangeBlock({
                      ...props,
                      subheadline: nextContent,
                      bodyBlock: { ...(props.bodyBlock || {}), content: nextContent },
                    });
                  }}
                  style={{
                    position: "relative",
                    zIndex: 1,
                    margin: 0,
                    fontSize: compact ? 15 : bodyFontSize,
                    lineHeight: bodyLineHeight,
                    fontFamily: bodyFamily,
                    fontWeight: bodyWeight,
                    color: bodyColor,
                    ...(shouldRunAnimations ? getAnimationStyle(props.subheadlineAnimation, props.subheadlineAnimationDelay || 0, props.subheadlineAnimationSpeed) : {}),
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    opacity: 0.92,
                    wordBreak: "normal",
                    overflowWrap: "break-word",
                    outline: editor ? "1px dashed rgba(125,211,252,0.5)" : "none",
                    padding: editor ? "4px 6px" : 0,
                    borderRadius: 8,
                  }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(stripPlaceholder(bodyBlock.content ?? props.subheadline) || (editor ? "Add supporting text here" : "")) }}
                    />
                  ) : null}
                  {primaryCta.text ? (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: compact ? 10 : 14,
                        alignItems: "center",
                        justifyContent: headingAlign === "center" ? "center" : headingAlign === "right" ? "flex-end" : "flex-start",
                        ...(shouldRunAnimations ? getAnimationStyle(heroCtaAnimation, heroCtaDelay, heroCtaSpeed) : {}),
                      }}
                    >
                      <a
                        href={editor ? "#" : (primaryCta.href || "#")}
                        target={!editor && primaryCta.newTab ? "_blank" : undefined}
                        rel={!editor && primaryCta.newTab ? "noopener noreferrer" : undefined}
                        onClick={(event) => {
                          if (editor) event.preventDefault();
                        }}
                        style={{
                          position: "relative",
                          zIndex: 1,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          textDecoration: "none",
                          background: props.buttonColor || "#2563eb",
                          color: props.buttonTextColor || "#ffffff",
                          padding: compact ? "10px 20px" : "14px 28px",
                          borderRadius: Number.isFinite(Number(props.buttonRadius)) ? Number(props.buttonRadius) : 999,
                          fontWeight: 600,
                          fontSize: compact ? 14 : 17,
                          fontFamily: bodyFamily,
                          border: "none",
                          alignSelf: headingAlign === "center" ? "center" : headingAlign === "right" ? "flex-end" : "flex-start",
                        }}
                      >
                        {primaryCta.text}
                      </a>
                      {secondaryCta.text ? (
                        <a
                          href={editor ? "#" : (secondaryCta.href || "#")}
                          target={!editor && secondaryCta.newTab ? "_blank" : undefined}
                          rel={!editor && secondaryCta.newTab ? "noopener noreferrer" : undefined}
                          onClick={(event) => {
                            if (editor) event.preventDefault();
                          }}
                          style={{
                            position: "relative",
                            zIndex: 1,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            textDecoration: "none",
                            background: colorWithAlpha("#081120", 0.18),
                            color: headingColor,
                            padding: compact ? "10px 18px" : "14px 24px",
                            borderRadius: Number.isFinite(Number(props.buttonRadius)) ? Number(props.buttonRadius) : 999,
                            fontWeight: 600,
                            fontSize: compact ? 14 : 17,
                            fontFamily: bodyFamily,
                            border: `1px solid ${colorWithAlpha(headingColor, 0.3)}`,
                            backdropFilter: "blur(10px)",
                          }}
                        >
                          {secondaryCta.text}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  {/* Hero stat items — inline mini-metrics below the CTA */}
                  {Array.isArray(props.heroStatItems) && props.heroStatItems.length > 0 ? (
                    <div style={{ display: "flex", gap: compact ? 16 : 28, flexWrap: "wrap", marginTop: compact ? 8 : 12, alignItems: "center" }}>
                      {props.heroStatItems.map((stat, sIdx) => (
                        <div key={stat.id || sIdx} style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 60 }}>
                          <span style={{ fontSize: compact ? 18 : 26, fontWeight: 600, color: headingColor, lineHeight: 1.1 }}>{stat.number || stat.value || ""}</span>
                          <span style={{ fontSize: compact ? 11 : 13, fontWeight: 500, color: colorWithAlpha(headingColor, 0.7), lineHeight: 1.3, letterSpacing: "0.04em" }}>{stat.label || ""}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  </div>
                </DraggableContentOverlay>
                )}
              </div>
              {/* Extra free text overlays */}
              {compact ? (Array.isArray(props.extraTextOverlays) ? props.extraTextOverlays : []).map((txtItem, txtIdx) => {
                const text = String(txtItem?.text || "").trim();
                if (!text) return null;
                const lowerText = text.toLowerCase();
                const isHeadlineLike = txtIdx < 2 || lowerText.includes("<h1") || /font-size:\s*(?:6[8-9]|[7-9]\d|1\d\d)px/i.test(text);
                const compactTextSize = isHeadlineLike ? (txtIdx === 0 ? 28 : 24) : 16;
                return (
                  <div
                    key={txtItem.id || txtIdx}
                    className="wb-compact-hero-richtext"
                    style={{
                      position: "relative",
                      zIndex: 4,
                      width: "100%",
                      maxWidth: "100%",
                      padding: txtItem.background && txtItem.background !== "transparent" ? "10px 12px" : 0,
                      borderRadius: 12,
                      background: txtItem.background && txtItem.background !== "transparent" ? txtItem.background : "transparent",
                      color: txtItem.color || headingColor,
                      fontSize: compactTextSize,
                      fontWeight: txtItem.fontWeight || 600,
                      lineHeight: isHeadlineLike ? 1.15 : 1.55,
                      textAlign: txtItem.textAlign || headingAlign,
                      overflowWrap: "break-word",
                    }}
                    dangerouslySetInnerHTML={{ __html: asRichHtml(text) }}
                  />
                );
              }) : (Array.isArray(props.extraTextOverlays) ? props.extraTextOverlays : []).map((txtItem, txtIdx) => {
                const txtX = Number(txtItem.x ?? 50);
                const txtY = Number(txtItem.y ?? 30);
                const txtW = Math.max(80, Number(txtItem.width ?? 320));
                const txtH = Math.max(30, Number(txtItem.height ?? 80));
                const txtLeft = `clamp(calc(${txtW}px / 2), ${txtX}%, calc(100% - ${txtW}px / 2))`;
                const txtTop = `clamp(calc(${txtH}px / 2), ${txtY}%, calc(100% - ${txtH}px / 2))`;
                const updateTxt = (patch) => {
                  const next = (Array.isArray(props.extraTextOverlays) ? props.extraTextOverlays : []).map((t, i) => i !== txtIdx ? t : { ...t, ...patch });
                  onChangeBlock?.({ ...props, extraTextOverlays: next });
                };
                const deleteTxt = () => {
                  const next = (Array.isArray(props.extraTextOverlays) ? props.extraTextOverlays : []).filter((_, i) => i !== txtIdx);
                  onChangeBlock?.({ ...props, extraTextOverlays: next });
                };
                return (
                  <div key={txtItem.id || txtIdx} style={overlayAnimationLayer(10 + txtIdx, shouldRunAnimations ? getAnimationStyle(txtItem.animation || "fade-in", Number(txtItem.animationDelay ?? 0), 0.8) : {})}>
                    <ExtraTextOverlay
                      item={txtItem}
                      editor={editor}
                      onUpdate={updateTxt}
                      onDelete={deleteTxt}
                    />
                  </div>
                );
              })}
              {props.heroHtmlEmbed ? (
                <div style={compact ? { position: "relative", zIndex: 8, width: "100%", pointerEvents: "auto" } : { position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 8, pointerEvents: "auto" }}>
                  <HtmlEmbedBlock html={props.heroHtmlEmbed} editor={editor} />
                </div>
              ) : null}
              {/* Extra counter overlays — draggable visit counter widgets */}
              {compact ? (Array.isArray(props.extraCounterOverlays) ? props.extraCounterOverlays : []).map((ctrItem, ctrIdx) => {
                const label = ctrItem.label || "Site Visits";
                return (
                  <div
                    key={ctrItem.id || ctrIdx}
                    style={{
                      position: "relative",
                      zIndex: 5,
                      width: "100%",
                      maxWidth: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      padding: "12px 14px",
                      borderRadius: 14,
                      background: ctrItem.background || "rgba(0,0,0,0.45)",
                      color: ctrItem.labelColor || "rgba(255,255,255,0.85)",
                      boxSizing: "border-box",
                    }}
                  >
                    <IconCounterNumber
                      projectId={ctrItem.projectId || siteId}
                      targetNumber={ctrItem.targetNumber != null ? Number(ctrItem.targetNumber) : null}
                      startNumber={Number(ctrItem.startNumber ?? 0)}
                      suffix={ctrItem.suffix || ""}
                      color={ctrItem.numberColor || "#0c8ce9"}
                      compact
                      editor={editor}
                      fontSize={Math.max(26, Math.min(46, Number(ctrItem.numberSize || 52)))}
                    />
                    <span style={{ minWidth: 0, flex: 1, fontSize: 14, fontWeight: 600, lineHeight: 1.3, overflowWrap: "break-word" }}>
                      {label}
                    </span>
                  </div>
                );
              }) : (Array.isArray(props.extraCounterOverlays) ? props.extraCounterOverlays : []).map((ctrItem, ctrIdx) => {
                const updateCtr = (patch) => {
                  const next = (Array.isArray(props.extraCounterOverlays) ? props.extraCounterOverlays : []).map((t, i) => i !== ctrIdx ? t : { ...t, ...patch });
                  onChangeBlock?.({ ...props, extraCounterOverlays: next });
                };
                const deleteCtr = () => {
                  const next = (Array.isArray(props.extraCounterOverlays) ? props.extraCounterOverlays : []).filter((_, i) => i !== ctrIdx);
                  onChangeBlock?.({ ...props, extraCounterOverlays: next });
                };
                return (
                  <div key={ctrItem.id || ctrIdx} style={{ position: "absolute", inset: 0, zIndex: 10 + ctrIdx, pointerEvents: "none" }}>
                    <ExtraCounterOverlay item={{ ...ctrItem, projectId: ctrItem.projectId || siteId }} editor={editor} onUpdate={updateCtr} onDelete={deleteCtr} />
                  </div>
                );
              })}
              {/* Hero inline counter — managed from the Counter tab in the right sidebar */}
              {props.heroInlineCounter?.enabled ? compact ? (
                <div
                  style={{
                    position: "relative",
                    zIndex: 6,
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: props.heroInlineCounter.backgroundColor || "rgba(0,0,0,0.55)",
                    color: props.heroInlineCounter.labelColor || "rgba(255,255,255,0.85)",
                  }}
                >
                  <IconCounterNumber
                    projectId={props.projectId || siteId || ""}
                    targetNumber={props.heroInlineCounter.targetNumber != null ? Number(props.heroInlineCounter.targetNumber) : null}
                    startNumber={props.heroInlineCounter.startNumber ?? 0}
                    suffix={props.heroInlineCounter.suffix || ""}
                    color={props.heroInlineCounter.numberColor || "#0c8ce9"}
                    compact
                    editor={editor}
                    fontSize={Math.max(28, Math.min(48, Number(props.heroInlineCounter.numberFontSize || 64)))}
                  />
                  <span style={{ minWidth: 0, flex: 1, fontSize: 14, fontWeight: 600, lineHeight: 1.3, overflowWrap: "break-word" }}>
                    {props.heroInlineCounter.label || "Happy Customers"}
                  </span>
                </div>
              ) : (
                <div style={{ position: "absolute", inset: 0, zIndex: 20, pointerEvents: "none" }}>
                  <ExtraCounterOverlay
                    item={{
                      id: "hero-inline-counter",
                      projectId: props.projectId || siteId || "",
                      label: props.heroInlineCounter.label || "Happy Customers",
                      targetNumber: props.heroInlineCounter.targetNumber != null ? Number(props.heroInlineCounter.targetNumber) : null,
                      startNumber: props.heroInlineCounter.startNumber ?? 0,
                      suffix: props.heroInlineCounter.suffix || "",
                      numberSize: props.heroInlineCounter.numberFontSize ?? 64,
                      numberColor: props.heroInlineCounter.numberColor || "#0c8ce9",
                      labelColor: props.heroInlineCounter.labelColor || "rgba(255,255,255,0.85)",
                      background: props.heroInlineCounter.backgroundColor || "rgba(0,0,0,0.55)",
                      iconType: props.heroInlineCounter.iconType || "diamond",
                      iconColor: props.heroInlineCounter.iconColor || "rgba(255,255,255,0.15)",
                      x: props.heroInlineCounter.x ?? 72,
                      y: props.heroInlineCounter.y ?? 85,
                      width: props.heroInlineCounter.width ?? 300,
                      height: props.heroInlineCounter.height ?? 90,
                    }}
                    editor={editor}
                    onUpdate={(patch) => onChangeBlock?.({ ...props, heroInlineCounter: { ...props.heroInlineCounter, ...patch } })}
                    onDelete={() => onChangeBlock?.({ ...props, heroInlineCounter: { ...props.heroInlineCounter, enabled: false } })}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </ScrollReveal>
      );
      if (isOrbitScroll) {
        return (
          <div
            data-orbit-scroll-wrapper="true"
            style={{ position: "relative", height: "360vh", overflow: "clip" }}
          >
            {heroSection}
          </div>
        );
      }
      return heroSection;
    }
