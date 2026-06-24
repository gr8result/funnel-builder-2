import React from "react";
import { FaArrowDown, FaArrowRight } from "react-icons/fa";
import { openSharedMediaPicker } from "../../lib/openSharedMediaPicker";
import { getAssetFromLibrary, resolveAssetField } from "../../lib/website-builder/mediaAssets";
import { renderGridLibraryIcon } from "./gridIconLibrary";
import {
  MIN_TEXT_SIZE, MIN_TAP_SIZE, PREMIUM_SHADOW, PREMIUM_BORDER, DEFAULT_LAYOUT_WIDTH,
  websiteBlockKeyframes, getAnimationStyle, ensureWebsiteBlockAnimationStyles, animationState,
  ScrollReveal, HtmlEmbedBlock, ambientMotionStyle,
  asArray, slugifyText, resolveCurrentPageKey, isCurrentNavLink, shouldHighlightNavLink,
  isSystemAsset, pickDefaultAvatarSrc, resolvePublishedNavHref,
  isGradientValue, extractSolidColor, resolveHeroBaseColor, resolveHeroGradient,
  heroBackground,
  IconCounterNumber,
} from "./website-renderer/wbAnimations";
import {
  colorWithAlpha, asStyleObject, asRichHtml, CANVAS_PLACEHOLDER_STRINGS, stripPlaceholder,
  computeHeadlineTextStyleCss, textLayerBackgroundStyle, headingTypography, bodyTypography,
  spacingMultiplier, scaleBoxPadding, parseSizeValue, fullWidthStyle, sectionContentStyle,
  normalizeOverlayLayoutProps, heroLayoutDefaults, heroVariantStyles,
  normalizeFeatureItem, featureVariantStyles,
  testimonialVariantStyles, ctaButtonVariantStyles,
  normalizeGalleryItem, normalizeTeamMember, normalizeTestimonialItem, normalizeTestimonialItems,
  normalizeTeamRowSizes, defaultTeamHierarchyRows, buildTeamHierarchyRows, renderHierarchyConnector,
  teamVariantStyles, normalizeStatItem, statsVariantStyles, imageGalleryVariantStyles,
  pricingVariantStyles, iconGlyph, normalizePricingPlan,
  navVariantTheme, contactFormVariantStyles, DEFAULT_ENQUIRY_BOOKING_URL, resolveContactBookingUrl,
  trustBadgeVariantStyles, resolveNewsletterButtonUrl, resolveFooterEmailHref,
  resolveFooterPhoneHref, buildNewsletterMailtoHref,
  buildNavLinkStyle, applyNavHoverEffect, resetNavHoverEffect,
  findScrollParent, getBrandInitials, BrandMark, sharedStyles,
} from "./website-renderer/wbVariantStyles";
import {
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
} from "./website-renderer/wbBlockComponents";

// Re-export animation utilities consumed by PageBuilderCanvas
export { websiteBlockKeyframes, getAnimationStyle } from "./website-renderer/wbAnimations";

function sanitizeFeatureTextHtml(value, style = {}, fallback = "") {
  let html = asRichHtml(value || fallback || "");
  for (let i = 0; i < 8; i += 1) {
    const next = html
      .replace(/<p\b[^>]*>\s*(?:<strong\b[^>]*>\s*<\/strong>\s*)?(?:<br\s*\/?>)?\s*<\/p>/gi, "")
      .replace(/<span\b[^>]*>\s*<\/span>/gi, "")
      .replace(/^(?:\s|<br\s*\/?>)+|(?:\s|<br\s*\/?>)+$/gi, "");
    if (next === html) break;
    html = next;
  }
  html = html
    .replace(/<p\b([^>]*)>/gi, "<span$1>")
    .replace(/<\/p>/gi, "</span>")
    .replace(/<div\b([^>]*)>/gi, "<span$1>")
    .replace(/<\/div>/gi, "</span>");

  const fontWeight = Number.parseInt(String(style?.fontWeight || ""), 10);
  if (Number.isFinite(fontWeight) && fontWeight < 600) {
    html = html.replace(/<\/?(?:strong|b)\b[^>]*>/gi, "");
  }
  if (String(style?.fontStyle || "") === "normal") {
    html = html.replace(/<\/?(?:em|i)\b[^>]*>/gi, "");
  }
  if (String(style?.textDecoration || "") === "none") {
    html = html.replace(/<\/?u\b[^>]*>/gi, "");
  }
  return html;
}

/**
 * Wraps block text content with a drag-to-resize right-edge handle in editor mode.
 * The `value` prop (textContentWidth) controls max column width (0 = full width).
 */
function TextColumnResizer({ editor, value, align, onResize, children }) {
  const [draft, setDraft] = React.useState(null);
  const containerRef = React.useRef(null);
  const activeWidth = draft !== null ? draft : (value > 0 ? value : null);

  const handlePointerDown = React.useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = containerRef.current?.offsetWidth ?? (value > 0 ? value : 700);
    function onMove(ev) {
      setDraft(Math.max(200, Math.min(1600, Math.round(startWidth + (ev.clientX - startX)))));
    }
    function onUp(ev) {
      const w = Math.max(200, Math.min(1600, Math.round(startWidth + (ev.clientX - startX))));
      setDraft(null);
      onResize(w);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }, [value, onResize]);

  const wrapperStyle = {
    position: "relative",
    width: activeWidth ? `${activeWidth}px` : "100%",
    maxWidth: "100%",
    marginLeft: align === "center" || align === "right" ? "auto" : 0,
    marginRight: align === "center" ? "auto" : 0,
  };

  return (
    <div ref={containerRef} style={wrapperStyle}>
      {children}
      {editor ? (
        <>
          <div
            title="Drag to resize text width"
            onPointerDown={handlePointerDown}
            style={{
              position: "absolute", right: -6, top: 0, bottom: 0, width: 12,
              cursor: "col-resize", borderRadius: 6,
              background: draft !== null ? "rgba(14,165,233,0.75)" : "rgba(14,165,233,0.35)",
              zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
          >
            <div style={{ width: 2, height: 18, background: "rgba(255,255,255,0.9)", borderRadius: 1 }} />
          </div>
          {draft !== null ? (
            <div style={{
              position: "absolute", right: 14, top: -24, fontSize: 16, fontWeight: 600,
              background: "#0ea5e9", color: "#fff", padding: "2px 7px", borderRadius: 5,
              pointerEvents: "none", zIndex: 30, whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(14,165,233,0.5)",
            }}>
              {draft}px
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function cleanTextSectionHtml(value) {
  let html = asRichHtml(value);

  if (typeof document !== "undefined" && html) {
    const template = document.createElement("template");
    template.innerHTML = html;
    const blockSelector = "p,h1,h2,h3,h4,h5,h6,ul,ol,blockquote,div";
    template.content.querySelectorAll("span").forEach((span) => {
      const blockChildren = Array.from(span.children).filter((child) => child.matches?.(blockSelector));
      if (!blockChildren.length) return;

      const spanStyle = span.getAttribute("style") || "";
      blockChildren.forEach((child) => {
        if (spanStyle) {
          const childStyle = child.getAttribute("style") || "";
          child.setAttribute("style", [spanStyle, childStyle].filter(Boolean).join("; "));
        }
      });
      span.replaceWith(...Array.from(span.childNodes));
    });
    html = template.innerHTML;
  }

  return html
    .replace(/<h([1-6])\b([^>]*)>\s*(?:<br\s*\/?\s*>|&nbsp;|\s)*<\/h\1>/gi, "")
    .replace(/<p\b([^>]*)>\s*(?:<span\b[^>]*>\s*)?(?:<br\s*\/?\s*>|&nbsp;|\s)*(?:<\/span>\s*)?<\/p>/gi, "");
}

const textSectionRichTextStyles = `
.wb-text-block :where(h1,h2,h3,h4,h5,h6,p,ul,ol,blockquote){margin-top:0;}
.wb-text-block :where(h1,h2,h3,h4,h5,h6){margin-bottom:0.28em;line-height:var(--wb-text-line-height, 1.35);}
.wb-text-block :where(p,li,blockquote){line-height:var(--wb-text-line-height, 1.35);}
.wb-text-block :where(p){margin-bottom:0.25em;}
.wb-text-block :where(p:last-child,h1:last-child,h2:last-child,h3:last-child,h4:last-child,h5:last-child,h6:last-child,ul:last-child,ol:last-child,blockquote:last-child){margin-bottom:0;}
`;

/**
 * Two-column grid shell with a draggable vertical divider for the data-ribbon stats variant.
 * Drag the handle to change the left-column percentage (clamped 20–80 %).
 */
function StatsSplitResizer({ editor, pct, gap, onResize, children }) {
  const [draft, setDraft] = React.useState(null);
  const containerRef = React.useRef(null);
  const activePct = draft !== null ? draft : (pct ?? 40);

  const handlePointerDown = React.useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    function onMove(ev) {
      const rect = container.getBoundingClientRect();
      setDraft(Math.max(20, Math.min(80, Math.round((ev.clientX - rect.left) / rect.width * 100))));
    }
    function onUp(ev) {
      const rect = container.getBoundingClientRect();
      const newPct = Math.max(20, Math.min(80, Math.round((ev.clientX - rect.left) / rect.width * 100)));
      setDraft(null);
      onResize(newPct);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }, [onResize]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ display: "grid", gridTemplateColumns: `minmax(200px, ${activePct}%) minmax(0, ${100 - activePct}%)`, gap, alignItems: "start" }}>
        {children}
      </div>
      {editor && (
        <div
          title="Drag to resize text column"
          onPointerDown={handlePointerDown}
          style={{ position: "absolute", left: `${activePct}%`, top: 0, bottom: 0, width: 16, transform: "translateX(-50%)", cursor: "col-resize", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", transform: "translateX(-50%)", width: 2, background: draft !== null ? "rgba(14,165,233,0.55)" : "rgba(14,165,233,0.22)", borderRadius: 1 }} />
          <div style={{ width: 16, height: 28, background: draft !== null ? "#0ea5e9" : "rgba(255,255,255,0.95)", border: `2px solid ${draft !== null ? "#0284c7" : "rgba(14,165,233,0.65)"}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, boxShadow: "0 2px 6px rgba(0,0,0,0.15)", zIndex: 1, position: "relative" }}>
            <div style={{ width: 1, height: 12, background: draft !== null ? "#fff" : "rgba(14,165,233,0.85)", borderRadius: 1 }} />
            <div style={{ width: 1, height: 12, background: draft !== null ? "#fff" : "rgba(14,165,233,0.85)", borderRadius: 1 }} />
          </div>
          {draft !== null && (
            <div style={{ position: "absolute", top: -26, left: "50%", transform: "translateX(-50%)", fontSize: 12, fontWeight: 600, background: "#0ea5e9", color: "#fff", padding: "2px 8px", borderRadius: 5, whiteSpace: "nowrap", pointerEvents: "none", zIndex: 30, boxShadow: "0 2px 8px rgba(14,165,233,0.5)" }}>
              {activePct}%
            </div>
          )}
        </div>
      )}
    </div>
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

// Slot positions, scroll parallax rates, and fly-in starting offsets.
// py/px: max travel in px driven by scroll parallax (top cards move most).
// flyDX/flyDY: where each card starts before it flies into view.
const ORBIT_CARD_SLOTS = [
  { pos: { top: "7%",     left:  "1%" }, py: 230, px: -55, flyDX: -180, flyDY: -200 }, // top-left
  { pos: { top: "7%",     right: "1%" }, py: 210, px:  55, flyDX:  180, flyDY: -200 }, // top-right
  { pos: { top: "42%",    left:  "0%" }, py: 115, px: -30, flyDX: -220, flyDY:   20 }, // mid-left
  { pos: { top: "42%",    right: "0%" }, py: 115, px:  30, flyDX:  220, flyDY:   20 }, // mid-right
  { pos: { bottom: "10%", left:  "1%" }, py:  40, px: -15, flyDX: -140, flyDY:  180 }, // bot-left
  { pos: { bottom: "10%", right: "1%" }, py:  40, px:  15, flyDX:  140, flyDY:  180 }, // bot-right
];

// Float durations/delays for the gentle continuous bob on each card
const ORBIT_FLOAT_DURATIONS = [5.8, 6.4, 5.2, 6.9, 5.5, 6.1];
const ORBIT_FLOAT_DELAYS    = [0, -2.1, -1.4, -3.2, -0.7, -2.8];

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInCubic(t) { return t * t * t; }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

/**
 * Sticky scroll-driven hero layer.
 *
 * The section is wrapped in a 360vh tall container and set to position:sticky;
 * top:0; height:100vh. Scroll progress through that 360vh drives 3 phases:
 *
 *   Phase 1 (p 0.00–0.40): Cards fly in from off-screen. Avatar goes from
 *     grayscale → full colour.
 *   Phase 2 (p 0.40–0.62): Cards rest at their positions with an idle bob.
 *   Phase 3 (p 0.62–1.00): Cards converge toward the centre of the section
 *     (behind the avatar), scaling and fading to nothing.
 *
 * Uses [data-orbit-scroll-wrapper] to find the parent scroll container so it
 * works inside both the page builder canvas and the live published page.
 */
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

function normalizeTemplateShowcaseItems(items) {
  const fallback = [
    { title: "Electrician", category: "Trades", palette: "#fbbf24", image: "wires", cta: "Quote-ready" },
    { title: "Fitness Studio", category: "Bookings", palette: "#22c55e", image: "fitness", cta: "Class-ready" },
    { title: "Beauty Clinic", category: "Services", palette: "#ec4899", image: "beauty", cta: "Book online" },
    { title: "Real Estate", category: "Listings", palette: "#38bdf8", image: "property", cta: "Lead capture" },
    { title: "Restaurant", category: "Hospitality", palette: "#f97316", image: "food", cta: "Reserve now" },
    { title: "Accountant", category: "Professional", palette: "#6366f1", image: "finance", cta: "Consultation" },
  ];
  const source = Array.isArray(items) && items.length ? items : fallback;
  return source.map((item, index) => ({
    id: item?.id || `template-card-${index}`,
    title: String(item?.title || `Template ${index + 1}`),
    category: String(item?.category || "Website"),
    palette: String(item?.palette || item?.accent || "#24d3ee"),
    image: String(item?.image || "default"),
    cta: String(item?.cta || "View design"),
  }));
}

function TemplateMiniSiteCard({ item, compact = false, phone = false }) {
  const accent = item.palette || "#24d3ee";
  const bg = item.image === "food"
    ? `linear-gradient(135deg, ${colorWithAlpha(accent, 0.78)}, #1f1308 70%)`
    : item.image === "property"
      ? `linear-gradient(135deg, #e0f2fe, ${colorWithAlpha(accent, 0.72)})`
      : item.image === "beauty"
        ? `linear-gradient(135deg, #fdf2f8, ${colorWithAlpha(accent, 0.66)})`
        : `linear-gradient(135deg, ${colorWithAlpha(accent, 0.82)}, #101827 78%)`;
  const width = phone ? (compact ? 94 : 126) : (compact ? 210 : 286);
  const height = phone ? (compact ? 150 : 196) : (compact ? 132 : 178);
  const radius = phone ? 20 : 14;

  return (
    <div style={{
      flex: `0 0 ${width}px`,
      width,
      height,
      borderRadius: radius,
      overflow: "hidden",
      background: "#ffffff",
      border: "1px solid rgba(226,232,240,0.9)",
      boxShadow: phone ? "0 18px 42px rgba(2,6,23,0.26)" : "0 24px 60px rgba(2,6,23,0.22)",
      position: "relative",
    }}>
      <div style={{ height: phone ? 16 : 22, display: "flex", alignItems: "center", gap: 4, padding: phone ? "0 9px" : "0 12px", background: "#0f172a" }}>
        {[0, 1, 2].map((dot) => <span key={dot} style={{ width: phone ? 3 : 5, height: phone ? 3 : 5, borderRadius: 999, background: dot === 0 ? accent : "rgba(255,255,255,0.38)" }} />)}
      </div>
      <div style={{ height: phone ? 58 : 78, background: bg, position: "relative", padding: phone ? 9 : 14, boxSizing: "border-box" }}>
        <div style={{ width: "54%", height: phone ? 7 : 10, borderRadius: 999, background: "#ffffff", opacity: 0.94, marginBottom: phone ? 6 : 9 }} />
        <div style={{ width: "36%", height: phone ? 5 : 7, borderRadius: 999, background: colorWithAlpha("#ffffff", 0.72), marginBottom: phone ? 8 : 12 }} />
        <div style={{ width: phone ? 38 : 62, height: phone ? 12 : 18, borderRadius: 999, background: "#ffffff", color: "#0f172a", fontSize: phone ? 5 : 8, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{item.cta}</div>
        <div style={{ position: "absolute", right: phone ? 8 : 15, bottom: phone ? -16 : -22, width: phone ? 42 : 74, height: phone ? 42 : 74, borderRadius: phone ? 14 : 18, background: colorWithAlpha("#ffffff", 0.24), border: "1px solid rgba(255,255,255,0.42)" }} />
      </div>
      <div style={{ padding: phone ? "10px 9px" : "14px 16px", display: "grid", gap: phone ? 6 : 9 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <div style={{ color: "#0f172a", fontSize: phone ? 8 : 13, fontWeight: 900, lineHeight: 1.15 }}>{item.title}</div>
          <span style={{ color: accent, fontSize: phone ? 5 : 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.category}</span>
        </div>
        {[92, 76, 58].map((pct, index) => (
          <div key={index} style={{ width: `${pct}%`, height: phone ? 4 : 7, borderRadius: 999, background: index === 0 ? colorWithAlpha(accent, 0.22) : "#e2e8f0" }} />
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: phone ? 4 : 8, marginTop: phone ? 2 : 5 }}>
          {[0, 1, 2].map((box) => <div key={box} style={{ height: phone ? 15 : 26, borderRadius: phone ? 5 : 8, background: box === 1 ? colorWithAlpha(accent, 0.22) : "#f1f5f9" }} />)}
        </div>
      </div>
    </div>
  );
}

function TemplateShowcaseBlock({ props, compact = false, editor = false, navigationContext = null }) {
  const items = normalizeTemplateShowcaseItems(props.templates);
  const loopItems = [...items, ...items, ...items];
  const bg = props.backgroundColor || "#080b14";
  const textColor = props.textColor || "#f8fafc";
  const muted = props.mutedTextColor || "#b8c2d8";
  const accent = props.accentColor || "#24d3ee";
  const accent2 = props.secondaryAccentColor || "#8b5cf6";
  const speed = Math.max(12, Math.min(90, Number(props.speed || 34)));
  const direction = props.reverse ? "reverse" : "normal";
  const stats = Array.isArray(props.stats) && props.stats.length ? props.stats : [
    { value: "80+", label: "industry layouts" },
    { value: "5 min", label: "AI first draft" },
    { value: "100%", label: "editable sections" },
  ];
  const mainItem = items[0] || {};
  const phoneItem = items[2] || mainItem;

  return (
    <section style={{ ...fullWidthStyle({ fullWidthBackground: props.fullWidthBackground !== false }, compact, editor), background: bg, color: textColor, minHeight: compact ? "640px" : (props.minHeight || "720px"), position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes templateShowcaseSlide { from { transform: translateX(0); } to { transform: translateX(-33.333%); } }
        @keyframes templateShowcaseFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
      `}</style>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 18% 18%, ${colorWithAlpha(accent, 0.22)}, transparent 28%), radial-gradient(circle at 82% 12%, ${colorWithAlpha(accent2, 0.2)}, transparent 30%), linear-gradient(180deg, rgba(8,11,20,0) 0%, ${bg} 96%)`, pointerEvents: "none" }} />
      <div aria-hidden="true" style={{ position: "absolute", inset: compact ? "220px -120px auto -120px" : "160px -160px auto -160px", height: compact ? 340 : 430, opacity: 0.54, transform: "rotate(-3deg)", display: "grid", alignContent: "center", gap: compact ? 18 : 26, pointerEvents: "none" }}>
        {[0, 1, 2].map((row) => (
          <div key={row} style={{ display: "flex", gap: compact ? 14 : 22, width: "max-content", animation: `templateShowcaseSlide ${speed + row * 6}s linear infinite`, animationDirection: row % 2 ? (props.reverse ? "normal" : "reverse") : direction }}>
            {loopItems.slice(row, row + items.length * 3).map((item, index) => <TemplateMiniSiteCard key={`${row}-${item.id}-${index}`} item={item} compact={compact} phone={row === 1 && index % 4 === 0} />)}
          </div>
        ))}
      </div>
      <div style={{ position: "relative", zIndex: 2, maxWidth: 1240, margin: "0 auto", padding: compact ? "70px 22px 58px" : "104px 42px 84px", display: "grid", gridTemplateColumns: compact ? "1fr" : "0.92fr 1.08fr", gap: compact ? 34 : 52, alignItems: "center" }}>
        <div style={{ display: "grid", gap: compact ? 18 : 24 }}>
          <span style={{ justifySelf: "start", border: `1px solid ${colorWithAlpha(accent, 0.36)}`, background: colorWithAlpha(accent, 0.12), color: accent, borderRadius: 999, padding: "8px 14px", fontSize: compact ? 12 : 13, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase" }}>{props.eyebrow || "AI Website Builder"}</span>
          <h1 style={{ margin: 0, color: textColor, fontSize: compact ? 42 : 76, lineHeight: 0.96, fontWeight: 900, maxWidth: 760 }}>{props.headline || "Launch a site that already feels custom"}</h1>
          <p style={{ margin: 0, color: muted, fontSize: compact ? 18 : 21, lineHeight: 1.58, maxWidth: 650 }}>{props.subheadline || "Pick a proven layout, let AI shape the copy, then customise every section."}</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            {props.ctaText ? <a href={editor ? undefined : resolvePublishedNavHref({ href: props.ctaLink || "#contact-us" }, navigationContext)} style={{ textDecoration: "none", color: "#04111a", background: `linear-gradient(135deg, ${accent}, #7df9a1)`, minHeight: 50, padding: "0 22px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, boxShadow: `0 18px 44px ${colorWithAlpha(accent, 0.3)}` }}>{props.ctaText}</a> : null}
            {props.secondaryCtaText ? <a href={editor ? undefined : resolvePublishedNavHref({ href: props.secondaryCtaLink || "#templates" }, navigationContext)} style={{ textDecoration: "none", color: textColor, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", minHeight: 50, padding: "0 20px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16 }}>{props.secondaryCtaText}</a> : null}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr 1fr" : "repeat(3, minmax(0, 1fr))", gap: 12, maxWidth: 620 }}>
            {stats.slice(0, 4).map((stat, index) => (
              <div key={index} style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: compact ? "14px 15px" : "17px 18px", backdropFilter: "blur(12px)" }}>
                <div style={{ color: index % 2 ? accent2 : accent, fontSize: compact ? 24 : 31, fontWeight: 900, lineHeight: 1 }}>{stat.value}</div>
                <div style={{ color: muted, fontSize: 13, fontWeight: 700, marginTop: 7, textTransform: "uppercase", letterSpacing: "0.08em" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        {props.showDeviceFocus !== false ? (
          <div style={{ position: "relative", minHeight: compact ? 420 : 560, animation: editor ? "none" : "templateShowcaseFloat 7s ease-in-out infinite" }}>
            <div style={{ position: "absolute", inset: compact ? "36px 2% auto 2%" : "42px 2% auto 0", height: compact ? 286 : 380, borderRadius: compact ? 24 : 34, background: "#111827", padding: compact ? 10 : 14, boxShadow: "0 38px 110px rgba(0,0,0,0.48)", border: "1px solid rgba(255,255,255,0.16)" }}>
              <TemplateMiniSiteCard item={mainItem} compact={false} phone={false} />
              <div style={{ position: "absolute", left: "8%", right: "8%", bottom: -18, height: 18, borderRadius: "0 0 32px 32px", background: "linear-gradient(180deg,#94a3b8,#475569)" }} />
            </div>
            <div style={{ position: "absolute", right: compact ? 12 : 34, top: compact ? 170 : 222, width: compact ? 126 : 154, borderRadius: 30, background: "#020617", padding: 9, boxShadow: "0 24px 70px rgba(0,0,0,0.48)", border: "1px solid rgba(255,255,255,0.18)" }}>
              <TemplateMiniSiteCard item={phoneItem} compact={compact} phone />
            </div>
            <div style={{ position: "absolute", left: compact ? 0 : 14, bottom: compact ? 16 : 28, maxWidth: compact ? 310 : 390, border: `1px solid ${colorWithAlpha(accent, 0.32)}`, background: "rgba(3,7,18,0.82)", borderRadius: 22, padding: compact ? 16 : 20, boxShadow: "0 28px 80px rgba(0,0,0,0.36)", backdropFilter: "blur(16px)" }}>
              <div style={{ color: accent, fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 9 }}>AI build prompt</div>
              <div style={{ color: textColor, fontSize: compact ? 16 : 18, lineHeight: 1.45, fontWeight: 800 }}>Build a conversion-focused website for a local service business with online bookings, CRM capture, SMS follow-up and SEO-ready pages.</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                {["copy", "layout", "images", "forms"].map((chip) => <span key={chip} style={{ color: muted, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 999, padding: "6px 9px", fontSize: 12, fontWeight: 800 }}>{chip}</span>)}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function normalizeSideScrollItems(items) {
  const fallback = [
    {
      eyebrow: "SEO foundations",
      title: "Search-ready pages",
      body: "Build service pages, location copy, FAQs, metadata and internal links around the terms real buyers search for.",
      image: "/assets/website-builder/2208a52a-8175-477e-823c-fc6de7fe4afe/ai-website-builder-no-code.png",
      tags: ["SEO", "service pages", "local search"],
    },
    {
      eyebrow: "No code editing",
      title: "Drag, drop and publish",
      body: "Use visual controls for sections, images, buttons, forms, spacing and mobile layouts without touching code.",
      image: "/assets/website-builder/2208a52a-8175-477e-823c-fc6de7fe4afe/ai-website-builder-builder-preview.png",
      tags: ["drag and drop", "mobile", "publish"],
    },
    {
      eyebrow: "Lead conversion",
      title: "Forms connected to CRM",
      body: "Turn visitors into contacts, quote requests, booking enquiries and follow-up automations inside Gr8 Result.",
      image: "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1200&q=80",
      tags: ["CRM", "bookings", "automation"],
    },
  ];
  const source = Array.isArray(items) && items.length ? items : fallback;
  return source.map((item, index) => ({
    id: item?.id || `side-scroll-${index}`,
    eyebrow: String(item?.eyebrow || item?.kicker || `Step ${index + 1}`),
    title: String(item?.title || item?.heading || `Panel ${index + 1}`),
    body: String(item?.body || item?.content || item?.text || ""),
    image: String(item?.image || item?.src || ""),
    ctaText: String(item?.ctaText || item?.buttonText || ""),
    ctaUrl: String(item?.ctaUrl || item?.buttonUrl || item?.link || ""),
    backgroundColor: String(item?.backgroundColor || ""),
    accentColor: String(item?.accentColor || ""),
    tags: Array.isArray(item?.tags) ? item.tags.map((tag) => String(tag || "")).filter(Boolean) : [],
  }));
}

function SideScrollAccordionBlock({ props, compact = false, editor = false, onChangeBlock, onUploadImage }) {
  const items = normalizeSideScrollItems(props.items);
  const displayMode = String(props.displayMode || props.mode || "side-stack").toLowerCase();
  if (displayMode !== "marquee") {
    const panels = items.map((item, index) => ({
      id: item.id || `side-stack-${index}`,
      eyebrow: item.eyebrow,
      eyebrowDot: true,
      heading: item.title,
      body: item.body,
      showCta: props.showButtons === true || props.showCta === true || !!item.ctaText,
      ctaText: item.ctaText || props.buttonText || "Learn More",
      ctaUrl: item.ctaUrl || props.buttonUrl || "#contact-us",
      ctaStyle: props.buttonStyle || "pill",
      buttonFullWidth: props.buttonFullWidth === true,
      image: item.image,
      imageAlt: item.title,
      imageStyle: props.imageStyle || "bleed",
      imagePosition: index % 2 === 0 ? "right" : "left",
      backgroundColor: item.backgroundColor || props.panelBackgroundColor || "#0f172a",
      textColor: props.textColor || "#ffffff",
      accentColor: item.accentColor || props.accentColor || "#00d5ff",
    }));

    return (
      <ScrollStackBlock
        compact={compact}
        editor={editor}
        onChangeBlock={onChangeBlock}
        onUploadImage={onUploadImage}
        props={{
          ...props,
          panels,
          stackMode: "side",
          peekWidth: props.peekWidth || props.cardPeekWidth || 78,
          cardRadius: props.cardRadius ?? 18,
          backgroundColor: props.backgroundColor || "#07111f",
        }}
      />
    );
  }

  const bg = props.backgroundColor || "#07111f";
  const textColor = props.textColor || "#ffffff";
  const muted = props.mutedTextColor || "#b8c2d8";
  const accent = props.accentColor || "#00d5ff";
  const cardWidth = compact ? Math.min(330, Number(props.cardWidth || 410)) : Math.max(320, Math.min(560, Number(props.cardWidth || 410)));
  const cardHeight = compact ? Math.max(420, Number(props.cardHeight || 520) - 80) : Math.max(420, Math.min(720, Number(props.cardHeight || 520)));
  const speed = Math.max(18, Math.min(120, Number(props.speed || 42)));
  const shouldAutoScroll = props.autoScroll !== false && !editor && items.length > 2;
  const trackItems = shouldAutoScroll ? [...items, ...items] : items;

  return (
    <section style={{ ...fullWidthStyle({ fullWidthBackground: props.fullWidthBackground !== false }, compact, editor), background: bg, color: textColor, overflow: "hidden", position: "relative" }}>
      <style>{`
        @keyframes sideAccordionMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .side-scroll-accordion-track:hover { animation-play-state: paused; }
      `}</style>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 16% 10%, ${colorWithAlpha(accent, 0.18)}, transparent 26%), linear-gradient(180deg, ${colorWithAlpha("#ffffff", 0.03)}, transparent 42%)`, pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1240, margin: "0 auto", padding: compact ? "58px 20px" : "90px 36px 96px" }}>
        <div style={{ maxWidth: 760, marginBottom: compact ? 28 : 42 }}>
          {props.eyebrow ? <div style={{ color: accent, fontSize: 13, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>{props.eyebrow}</div> : null}
          <h2 style={{ margin: 0, fontSize: compact ? 34 : 58, lineHeight: 1, fontWeight: 900, color: textColor }}>{props.title || "What your website needs to do"}</h2>
          {props.subtitle ? <p style={{ margin: "18px 0 0", color: muted, fontSize: compact ? 17 : 20, lineHeight: 1.58 }}>{props.subtitle}</p> : null}
        </div>
        <div style={{ overflowX: shouldAutoScroll ? "hidden" : "auto", paddingBottom: 8 }}>
          <div
            className="side-scroll-accordion-track"
            style={{
              display: "flex",
              gap: compact ? 16 : 22,
              width: shouldAutoScroll ? "max-content" : undefined,
              animation: shouldAutoScroll ? `sideAccordionMarquee ${speed}s linear infinite` : "none",
              paddingRight: compact ? 16 : 22,
            }}
          >
            {trackItems.map((item, index) => (
              <article key={`${item.id}-${index}`} style={{
                flex: `0 0 ${cardWidth}px`,
                width: cardWidth,
                minHeight: cardHeight,
                borderRadius: 18,
                overflow: "hidden",
                background: "#0f172a",
                border: `1px solid ${colorWithAlpha(accent, 0.24)}`,
                boxShadow: "0 28px 72px rgba(0,0,0,0.34)",
                display: "grid",
                gridTemplateRows: "minmax(210px, 46%) 1fr",
              }}>
                <div style={{ position: "relative", minHeight: 210, background: colorWithAlpha(accent, 0.16) }}>
                  {item.image ? <img src={item.image} alt={item.title} style={{ width: "100%", height: "100%", minHeight: 230, objectFit: "cover", display: "block" }} /> : null}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(2,6,23,0.05), rgba(2,6,23,0.72))" }} />
                  <span style={{ position: "absolute", left: 18, bottom: 16, color: "#03111f", background: accent, borderRadius: 999, padding: "7px 11px", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.eyebrow}</span>
                </div>
                <div style={{ padding: compact ? 20 : 24, display: "grid", alignContent: "start", gap: 14 }}>
                  <h3 style={{ margin: 0, color: textColor, fontSize: compact ? 24 : 30, lineHeight: 1.05, fontWeight: 900 }}>{item.title}</h3>
                  <p style={{ margin: 0, color: muted, fontSize: compact ? 16 : 17, lineHeight: 1.58 }}>{item.body}</p>
                  {item.tags.length ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                      {item.tags.slice(0, 5).map((tag) => (
                        <span key={tag} style={{ border: "1px solid rgba(255,255,255,0.14)", color: colorWithAlpha(textColor, 0.88), borderRadius: 999, padding: "6px 9px", fontSize: 12, fontWeight: 800 }}>{tag}</span>
                      ))}
                    </div>
                  ) : null}
                  {props.showButtons === true ? (
                    <a
                      href={props.buttonUrl || "#contact-us"}
                      onClick={(event) => editor && event.preventDefault()}
                      style={{
                        display: "inline-flex",
                        justifyContent: "center",
                        alignItems: "center",
                        width: props.buttonFullWidth === true ? "100%" : "fit-content",
                        marginTop: 6,
                        borderRadius: 999,
                        padding: "12px 18px",
                        background: accent,
                        color: "#03111f",
                        textDecoration: "none",
                        fontSize: 14,
                        fontWeight: 900,
                      }}
                    >
                      {props.buttonText || "Learn More"}
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function renderWebsiteBlock(block, { compact = false, assets, editor = false, animationPreview = false, isSelected = false, onChangeBlock, onUploadImage, onUploadLayerImage, onSelectAsset, navigationContext = null, layoutWidth = null, siteId = "" } = {}) {
  const rawProps = block?.props || {};
  // When a global canvas width (layoutWidth) is provided, enforce it as the content container's
  // max-width so all blocks stay within the canvas bounds. Full-bleed backgrounds use
  // fullWidthStyle() which intentionally ignores baseLayoutWidth, so they remain full-screen.
  const props = (layoutWidth && Number(layoutWidth) > 0)
    ? { ...rawProps, baseLayoutWidth: Math.max(320, Number(layoutWidth)) }
    : rawProps;
  const shouldRunAnimations = !editor || animationPreview;
  const sectionAnimationStyle = !shouldRunAnimations
    ? {}
    : getAnimationStyle(props.sectionAnimation, props.sectionAnimationDelay || 0, props.sectionAnimationSpeed);
  const spacingScale = spacingMultiplier(props);
  const sectionPad = scaleBoxPadding(compact ? "24px 20px" : "72px 32px", spacingScale);
  const cardPad = scaleBoxPadding(compact ? "18px" : "32px 28px", spacingScale);
  const imageSrc = resolveAssetField(props, "src", assets);
  const heroBackgroundImage = resolveAssetField(props, "backgroundImage", assets);
  const avatarSrc = resolveAssetField(props, "avatar", assets);
  const logoSrc = resolveAssetField(props, "logo", assets);
  const defaultAvatarSrc = pickDefaultAvatarSrc(assets);
  const brandLogoSrc = logoSrc || assets?.logo?.src || "";

  switch (block?.type) {
    case "nav-bar":
      return <NavBarBlock blockProps={props} compact={compact} logoSrc={brandLogoSrc} editor={editor} navigationContext={navigationContext} />;

    case "hero":
    case "parallax": {
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
      const sectionBgStyle = isFixedBgParallax
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
      const hasFloatingHeroImage = rawFloatingImages.some((item) => String(item?.src || "").trim());
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
      const rawHeroMarginTop = Math.max(0, Number(props.marginTop || 0));
      const heroMarginTop = editor ? Math.min(rawHeroMarginTop, 24) : rawHeroMarginTop;
      const headingColor = props.headlineColor || "#ffffff";
      const headingFamily = props.headlineFontFamily || "system-ui, -apple-system, sans-serif";
      const headingWeight = props.headlineFontWeight || "700";
      const bodyColor = props.textColor || headingColor;
      const bodyFamily = props.fontFamily || headingFamily;
      const headingAlign = props.headlineAlignment || heroLayout.headlineAlignment || "center";
      const heroHorizontalInset = compact ? 24 : 48;
      const heroContentMaxWidth = Math.max(320, Number(props.baseLayoutWidth || DEFAULT_LAYOUT_WIDTH));
      const heroContentBounds = {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: "50%",
        transform: `translateX(-50%)`,
        width: `min(100%, ${heroContentMaxWidth}px)`,
        height: "100%",
        zIndex: heroParallaxEnabled ? 3 : 2,
      };
      const heroContentBoundsInner = {
        width: `calc(100% - ${heroHorizontalInset * 2}px)`,
        maxWidth: `${heroContentMaxWidth}px`,
        height: "100%",
        margin: "0 auto",
        minWidth: 0,
      };
      const overlayAnimationLayer = (zIndex, animationStyle = {}) => ({
        position: "absolute",
        inset: 0,
        zIndex,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
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
            overflow: editor ? "visible" : "hidden",
            borderRadius: compact ? 12 : (useFullBleedHero ? 0 : 20),
            ...heroFullWidth,
            ...heroVariant.shell,
            marginTop: heroMarginTop ? `${heroMarginTop}px` : undefined,
            minHeight: isOrbitScroll ? undefined : (compact ? 180 : props.minHeight || "400px"),
            ...sectionBgStyle,
            padding: compact ? "40px 24px" : "80px 48px",
          }}
        >
          {isFixedBgParallax ? (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 0,
                backgroundImage: `url(${heroBackgroundImage})`,
                backgroundSize: heroBackgroundSize,
                backgroundPosition: props.backgroundPosition || heroStaticStyle.backgroundPosition || "center center",
                backgroundRepeat: props.backgroundRepeat || heroStaticStyle.backgroundRepeat || "no-repeat",
                backgroundAttachment: "fixed",
                pointerEvents: "none",
              }}
            />
          ) : null}
          {heroContainedBackgroundStyle ? (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: "50%",
                width: `min(100%, ${heroContentMaxWidth}px)`,
                transform: "translateX(-50%)",
                zIndex: 0,
                backgroundImage: `url(${heroBackgroundImage})`,
                backgroundSize: heroBackgroundSize,
                backgroundPosition: props.backgroundPosition || heroStaticStyle.backgroundPosition || "center center",
                backgroundRepeat: props.backgroundRepeat || heroStaticStyle.backgroundRepeat || "no-repeat",
                pointerEvents: "none",
              }}
            />
          ) : null}
          {heroParallaxEnabled && parallaxStaticOverlay ? (
            <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 2, background: parallaxStaticOverlay, pointerEvents: "none" }} />
          ) : null}
          {block?.type === "hero" ? (
            <div style={editor ? undefined : { ...ambientMotionStyle("pulse") }}>
              {heroVariant.decor}
            </div>
          ) : null}

          {isVideoHero ? (
            <>
              <video
                src={props.backgroundVideoUrl}
                autoPlay
                muted
                loop={props.videoLoop === true}
                playsInline
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
          <div data-overlay-bounds="true" style={heroContentBounds}>
            <div style={heroContentBoundsInner}>
              {/* ── Orbit feature cards are rendered AFTER the avatar (z=3 > avatar z=2) ── */}
              {rawFloatingImages.length === 0 ? null : rawFloatingImages.map((imgItem, imgIdx) => {
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
                        imageLabel={rawFloatingImages.length > 1 ? `Image ${imgIdx + 1}` : null}
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
                  {/* eslint-disable-next-line no-unused-vars */}
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
                  onChangeBlock({ ...props, headline: cleaned === "Click to type headline" ? "" : cleaned });
                }}
                style={{
                  position: "relative",
                  zIndex: 1,
                  margin: 0,
                  fontSize: compact ? 22 : (props.headlineFontSize || 52),
                  lineHeight: 1.1,
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
                dangerouslySetInnerHTML={{ __html: asRichHtml(stripPlaceholder(props.headline) || (editor ? "Click to type headline" : "")) }}
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
                    onChangeBlock({ ...props, subheadline: cleaned === "Add supporting text here" ? "" : cleaned });
                  }}
                  style={{
                    position: "relative",
                    zIndex: 1,
                    margin: 0,
                    fontSize: compact ? 15 : (props.subheadlineFontSize || 20),
                    lineHeight: 1.6,
                    fontFamily: bodyFamily,
                    fontWeight: props.fontWeight || "400",
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
                  dangerouslySetInnerHTML={{ __html: asRichHtml(stripPlaceholder(props.subheadline) || (editor ? "Add supporting text here" : "")) }}
                    />
                  ) : null}
                  {props.ctaText ? (
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
                        href={editor ? "#" : (props.ctaLink || "#")}
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
                        {props.ctaText}
                      </a>
                      {props.secondaryCtaText ? (
                        <a
                          href={editor ? "#" : (props.secondaryCtaLink || "#")}
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
                          {props.secondaryCtaText}
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
              {(Array.isArray(props.extraTextOverlays) ? props.extraTextOverlays : []).map((txtItem, txtIdx) => {
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
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 8, pointerEvents: "auto" }}>
                  <HtmlEmbedBlock html={props.heroHtmlEmbed} editor={editor} />
                </div>
              ) : null}
              {/* Extra counter overlays — draggable visit counter widgets */}
              {(Array.isArray(props.extraCounterOverlays) ? props.extraCounterOverlays : []).map((ctrItem, ctrIdx) => {
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
              {props.heroInlineCounter?.enabled ? (
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

    case "split-block":
      return <SplitFaqBlock props={props} compact={compact} editor={editor} onChangeBlock={onChangeBlock} sectionAnimationStyle={sectionAnimationStyle} assets={assets} layoutWidth={layoutWidth} />;

    case "text":
      const textFullWidth = fullWidthStyle(props, compact, editor);
      const textPadTop = props.paddingTop ?? 20;
      const textPadBottom = props.paddingBottom ?? 20;
      const textLineHeight = Math.max(0.8, Math.min(3, Number(props.textLineHeight || props.bodyLineHeight || props.lineHeight || 1.35) || 1.35));
      const textBackground = props.backgroundColor || "#111827";
      const hasBorder = !props.hideBorder && textBackground && textBackground !== "transparent";
      const hasBoxShadow = hasBorder;
      const textOverlayEnabled = !!props.enableParallax && !!heroBackgroundImage;
      const textFixedBgStyle = textOverlayEnabled
        ? {
            backgroundImage: `url(${heroBackgroundImage})`,
            backgroundPosition: props.backgroundPosition || "center center",
            backgroundSize: props.backgroundSize || "cover",
            backgroundRepeat: props.backgroundRepeat || "no-repeat",
            backgroundAttachment: "fixed",
            backgroundColor: textBackground !== "transparent" ? textBackground : "#111827",
          }
        : null;
      
      return (
        <ScrollReveal
          as="section"
          animationName={props.sectionAnimation || "fade-up"}
          delay={props.sectionAnimationDelay || 0.06}
          speed={props.sectionAnimationSpeed}
          disabled={editor}
          style={{
            position: "relative",
            borderRadius: 0,
            ...textFullWidth,
            minHeight: props.minHeight || "160px",
            paddingTop: `${textPadTop}px`,
            paddingBottom: `${textPadBottom}px`,
            paddingLeft: sectionPad.replace(/\s.*/, ""),
            paddingRight: sectionPad.replace(/\s.*/, ""),
            ...(heroBackgroundImage && !textOverlayEnabled
              ? {
                  backgroundImage: `url(${heroBackgroundImage})`,
                  backgroundPosition: props.backgroundPosition || "center center",
                  backgroundSize: props.backgroundSize || "cover",
                  backgroundRepeat: props.backgroundRepeat || "no-repeat",
                }
              : {
                  background: textBackground !== "transparent" ? textBackground : "transparent",
                }),
            backgroundAttachment: "scroll",
            color: props.textColor || "#e6eef5",
            border: hasBorder ? PREMIUM_BORDER : "none",
            boxShadow: hasBoxShadow ? PREMIUM_SHADOW : "none",
            overflow: (textOverlayEnabled || (Array.isArray(props.extraCounterOverlays) && props.extraCounterOverlays.length > 0)) ? "hidden" : undefined,
          }}
        >
          {textOverlayEnabled ? (
            <>
              <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, ...textFixedBgStyle, pointerEvents: "none" }} />
              {props.backgroundOverlayColor ? (
                <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 2, background: props.backgroundOverlayColor, pointerEvents: "none" }} />
              ) : null}
            </>
          ) : null}
          <style>{textSectionRichTextStyles}</style>
          <div style={{ ...sectionContentStyle(props, compact), position: "relative", zIndex: textOverlayEnabled ? 3 : undefined }}>
            {editor ? (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10, gap: 6, flexWrap: "wrap" }}>
                <button type="button" onClick={() => onChangeBlock?.({ ...props, textFontSize: Math.max(14, Number(props.textFontSize || 18) - 2) })} style={sharedStyles.editorChip}>A−</button>
                <button type="button" onClick={() => onChangeBlock?.({ ...props, textFontSize: Math.min(72, Number(props.textFontSize || 18) + 2) })} style={sharedStyles.editorChip}>A+</button>
                <button type="button" onClick={() => onChangeBlock?.({ ...props, hideBorder: !props.hideBorder })} style={{ ...sharedStyles.editorChip, ...(props.hideBorder ? { background: "#64748b", color: "#fff" } : {}) }} title="Toggle section border">{props.hideBorder ? "Border Off" : "Border On"}</button>
              </div>
            ) : null}
            {/* Counter overlays */}
            {(Array.isArray(props.extraCounterOverlays) ? props.extraCounterOverlays : []).map((ctrItem, ctrIdx) => {
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
            <div style={{ position: "relative", zIndex: 3, width: "100%" }}>
              <TextColumnResizer
                editor={editor && !textOverlayEnabled}
                value={Number(props.textContentWidth || 0)}
                align={props.alignment || "left"}
                onResize={(w) => onChangeBlock?.({ ...props, textContentWidth: w })}
              >
                <div
                  className="wb-text-block"
                  data-website-inline-editor="true"
                  data-text-prop="text"
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onMouseDown={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onBlur={(event) => {
                    if (shouldSkipToolbarBlur(event)) return;
                    if (!editor || typeof onChangeBlock !== "function") return;
                    onChangeBlock({ ...props, text: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
                  }}
                  style={{ margin: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box", "--wb-text-line-height": textLineHeight, fontSize: Math.max(12, Number(props.textFontSize || 18)), lineHeight: textLineHeight, textAlign: props.alignment || "left", ...bodyTypography(props), ...getAnimationStyle(props.textAnimation, props.textAnimationDelay || 0, props.textAnimationSpeed), outline: editor ? "1px dashed rgba(14,165,233,0.4)" : "none", padding: editor ? "6px 8px" : 0, borderRadius: 8 }}
                  dangerouslySetInnerHTML={{ __html: cleanTextSectionHtml(props.text) }}
                />
              </TextColumnResizer>
            </div>
          </div>
        </ScrollReveal>
      );

    case "image":
      return <EditableImageBlock props={props} imageSrc={imageSrc} compact={compact} editor={editor} animationPreview={animationPreview} onChangeBlock={onChangeBlock} />;

    case "cta-button": {
      const ctaVariant = ctaButtonVariantStyles(props, compact);
      const ctaWidthProps = { ...props, fullWidthBackground: props.fullWidthBackground === true };
      return (
        <ScrollReveal as="section" animationName={props.sectionAnimation || "fade-up"} delay={props.sectionAnimationDelay || 0.06} speed={props.sectionAnimationSpeed} disabled={editor} style={{ ...ctaVariant.section, ...fullWidthStyle(ctaWidthProps, compact, editor) }}>
          <div style={sectionContentStyle(props, compact)}>
          <div style={ctaVariant.content}>
            {(editor || !!stripPlaceholder(props.eyebrow)) ? (
              <p
                data-website-inline-editor="true"
                data-text-prop="eyebrow"
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => {
                  if (!editor || typeof onChangeBlock !== "function") return;
                  onChangeBlock({ ...props, eyebrow: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
                }}
                style={{
                  ...ctaVariant.eyebrow,
                  outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                  borderRadius: 8,
                  padding: editor ? "4px 6px" : 0,
                }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(stripPlaceholder(props.eyebrow) || (editor ? "Launch label" : "")) }}
              />
            ) : null}
            {(props.title || editor) ? (
              <h2
                data-website-inline-editor="true"
                data-text-prop="title"
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => {
                  if (!editor || typeof onChangeBlock !== "function") return;
                  onChangeBlock({ ...props, title: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
                }}
                style={{
                  ...ctaVariant.title,
                  outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                  borderRadius: 8,
                  padding: editor ? "4px 6px" : 0,
                }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || (editor ? "Guide visitors to one next step" : "")) }}
              />
            ) : null}
            {(props.description || editor) ? (
              <p
                data-website-inline-editor="true"
                data-text-prop="description"
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => {
                  if (!editor || typeof onChangeBlock !== "function") return;
                  onChangeBlock({ ...props, description: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
                }}
                style={{
                  ...ctaVariant.description,
                  outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                  borderRadius: 8,
                  padding: editor ? "4px 6px" : 0,
                }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(props.description || (editor ? "Add a short supporting line for the action." : "")) }}
              />
            ) : null}
          </div>
          <div style={ctaVariant.actionWrap}>
            <a href={editor ? "#" : (props.link || "#")} onClick={(event) => { if (editor) event.preventDefault(); }} style={{ ...ctaVariant.action, ...bodyTypography(props) }}>
              <span
                data-website-inline-editor="true"
                data-text-prop="text"
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => {
                  if (!editor || typeof onChangeBlock !== "function") return;
                  onChangeBlock({ ...props, text: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
                }}
                style={{
                  display: "inline-block",
                  minWidth: editor ? 36 : undefined,
                  outline: editor ? "1px dashed rgba(255,255,255,0.45)" : "none",
                  borderRadius: 6,
                  padding: editor ? "2px 4px" : 0,
                }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(props.text || (editor ? "Get Started" : "")) }}
              />
            </a>
            {(props.note || editor) ? (
              <p
                data-website-inline-editor="true"
                data-text-prop="note"
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => {
                  if (!editor || typeof onChangeBlock !== "function") return;
                  onChangeBlock({ ...props, note: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
                }}
                style={{
                  ...ctaVariant.note,
                  outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                  borderRadius: 8,
                  padding: editor ? "4px 6px" : 0,
                }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(props.note || (editor ? "Optional reassurance line" : "")) }}
              />
            ) : null}
          </div>
          </div>
        </ScrollReveal>
      );
    }

    case "feature-list":
      const featureVariant = featureVariantStyles(props);
      const featureTitleAlign = ["left", "center", "right", "justify"].includes(String(props.headingAlign || props.headlineAlign || props.headlineAlignment || props.textAlign || props.alignment || ""))
        ? String(props.headingAlign || props.headlineAlign || props.headlineAlignment || props.textAlign || props.alignment)
        : "left";
      return (
        <ScrollReveal as="section" animationName={props.sectionAnimation || "fade-up"} delay={props.sectionAnimationDelay || 0.06} speed={props.sectionAnimationSpeed} disabled={editor} style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor) }}>
          <div style={sectionContentStyle(props, compact)}>
          <style>{`.wb-feature-card-body p,.wb-feature-card-body div{margin-top:0!important;margin-bottom:0!important}.wb-feature-card-body{align-content:start!important;justify-content:flex-start!important}`}</style>
          <h2
            data-website-inline-editor="true"
            data-text-prop="title"
            contentEditable={editor}
            suppressContentEditableWarning
            onBlur={(event) => {
              if (!editor || typeof onChangeBlock !== "function") return;
              onChangeBlock({ ...props, title: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
            }}
            style={{
              ...sharedStyles.sectionTitle(compact),
              color: props.textColor || "#0f172a",
              textAlign: featureTitleAlign,
              outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
              borderRadius: 8,
              padding: editor ? "4px 6px" : 0,
            }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || "Key Features") }}
          />
          <div style={{ ...sharedStyles.featureList(props.layout, compact, props.featureCardWidth), ...featureVariant.list }}>
            {asArray(props.items).map((rawItem, idx) => {
              const item = normalizeFeatureItem(rawItem, idx);
              const itemTextBlocks = Array.isArray(item.textBlocks) && item.textBlocks.length
                ? item.textBlocks
                : [
                    { id: `feature-${idx}-headline`, type: "headline", text: item.title },
                    ...(item.body ? [{ id: `feature-${idx}-text`, type: "text", text: item.body }] : []),
                  ];
              const itemImage = item.image || `https://placehold.co/960x720/e2e8f0/0f172a?text=${encodeURIComponent(item.title || `Feature ${idx + 1}`)}`;
              const patchFeatureTextBlock = (textIndex, patch) => {
                if (!editor || typeof onChangeBlock !== "function") return;
                const nextItems = asArray(props.items).map((entry, entryIdx) => {
                  if (entryIdx !== idx) return entry;
                  const normalizedEntry = normalizeFeatureItem(entry, entryIdx);
                  const baseTextBlocks = Array.isArray(normalizedEntry.textBlocks) && normalizedEntry.textBlocks.length
                    ? normalizedEntry.textBlocks
                    : [
                        { id: `feature-${entryIdx}-headline`, type: "headline", text: normalizedEntry.title },
                        ...(normalizedEntry.body ? [{ id: `feature-${entryIdx}-text`, type: "text", text: normalizedEntry.body }] : []),
                      ];
                  const nextTextBlocks = baseTextBlocks.map((textBlock, currentTextIndex) => (
                    currentTextIndex === textIndex ? { ...textBlock, ...patch } : textBlock
                  ));
                  const nextHeadline = nextTextBlocks.find((textBlock) => textBlock.type === "headline")?.text || normalizedEntry.title;
                  const nextBody = nextTextBlocks.filter((textBlock) => textBlock.type === "text").map((textBlock) => textBlock.text || "").join("\n\n");
                  return {
                    ...entry,
                    title: nextHeadline,
                    body: nextBody,
                    textBlocks: nextTextBlocks,
                  };
                });
                onChangeBlock({ ...props, items: nextItems });
              };

              return (
                <ScrollReveal key={item.id || `${item.title}-${idx}`} animationName={props.cardAnimation || "fade-up"} delay={idx * (Number(props.cardStagger ?? 0.08) || 0.08)} disabled={editor} style={{ ...sharedStyles.featureItem(compact), ...featureVariant.item, alignItems: "stretch", background: props.itemBackgroundColor || undefined, border: `1px solid ${props.borderColor || "#dbeafe"}`, color: props.textColor || "#0f172a" }}>
                  <div style={{ position: "relative", overflow: "hidden", background: "rgba(255,255,255,0.14)", minWidth: 0, ...featureVariant.media }}>
                    <img src={itemImage} alt={item.title || `Feature ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${item.imageX}% ${item.imageY}%`, display: "block" }} />
                  </div>
                  <div style={{ ...featureVariant.body, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", alignContent: "start", alignSelf: "stretch" }}>
                    {itemTextBlocks.map((textBlock, textIndex) => {
                      const textBlockStyle = textBlock?.style && typeof textBlock.style === "object" ? textBlock.style : {};
                      if (textBlock?.type === "label") {
                        return (
                          <div
                            key={textBlock.id || `${idx}-label-${textIndex}`}
                            data-website-inline-editor="true"
                            data-text-prop={`items.${idx}.textBlocks.${textIndex}.text`}
                            contentEditable={editor}
                            suppressContentEditableWarning
                            onBlur={(event) => patchFeatureTextBlock(textIndex, { text: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                            style={{
                              margin: 0,
                              outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                              borderRadius: 8,
                              padding: editor ? "4px 6px" : 0,
                              minWidth: 0,
                              wordBreak: "break-word",
                              overflowWrap: "anywhere",
                              boxSizing: "border-box",
                              fontSize: compact ? 11 : 12,
                              fontWeight: 700,
                              letterSpacing: 0,
                              textTransform: "uppercase",
                              color: featureVariant.title?.color || props.textColor || "#0f172a",
                              ...textBlockStyle,
                            }}
                            dangerouslySetInnerHTML={{ __html: sanitizeFeatureTextHtml(textBlock.text || "", textBlockStyle) }}
                          />
                        );
                      }
                      return textBlock?.type === "headline" ? (
                        <h3
                          key={textBlock.id || `${idx}-headline-${textIndex}`}
                          data-website-inline-editor="true"
                          data-text-prop={`items.${idx}.textBlocks.${textIndex}.text`}
                          contentEditable={editor}
                          suppressContentEditableWarning
                          onBlur={(event) => patchFeatureTextBlock(textIndex, { text: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                          style={{
                            margin: 0,
                            outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                            borderRadius: 8,
                            padding: editor ? "4px 6px" : 0,
                            minWidth: 0,
                            wordBreak: "break-word",
                            overflowWrap: "anywhere",
                            boxSizing: "border-box",
                            color: featureVariant.title?.color || props.textColor || "#0f172a",
                            ...featureVariant.title,
                            ...textBlockStyle,
                          }}
                          dangerouslySetInnerHTML={{ __html: sanitizeFeatureTextHtml(textBlock.text, textBlockStyle, item.title || `Feature ${idx + 1}`) }}
                        />
                      ) : (
                        <p
                          key={textBlock.id || `${idx}-text-${textIndex}`}
                          className="wb-feature-card-body"
                          data-website-inline-editor="true"
                          data-text-prop={`items.${idx}.textBlocks.${textIndex}.text`}
                          contentEditable={editor}
                          suppressContentEditableWarning
                          onBlur={(event) => patchFeatureTextBlock(textIndex, { text: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                          style={{
                            margin: 0,
                            outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                            borderRadius: 8,
                            padding: editor ? "4px 6px" : 0,
                            minWidth: 0,
                            wordBreak: "break-word",
                            overflowWrap: "anywhere",
                            boxSizing: "border-box",
                            color: featureVariant.copy?.color || colorWithAlpha(props.textColor || "#0f172a", 0.78),
                            ...featureVariant.copy,
                            ...textBlockStyle,
                          }}
                          dangerouslySetInnerHTML={{ __html: sanitizeFeatureTextHtml(textBlock.text || "", textBlockStyle) }}
                        />
                      );
                    })}
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
          </div>
        </ScrollReveal>
      );

    case "testimonial": {
      const testimonialItems = normalizeTestimonialItems(props);
      const testimonialVariant = props.testimonialVariant || "cards";
      const variantSty = testimonialVariantStyles(testimonialVariant, compact, props);
      const starAccent = variantSty.starColor || "#f59e0b";
      const isSpotlight = testimonialVariant === "spotlight";
      const isWall = testimonialVariant === "wall";
      const testimonialTitleAlign = ["left", "center", "right", "justify"].includes(String(props.headingAlign || props.headlineAlign || props.headlineAlignment || props.textAlign || props.alignment || ""))
        ? String(props.headingAlign || props.headlineAlign || props.headlineAlignment || props.textAlign || props.alignment)
        : (isSpotlight ? "center" : undefined);

      const patchTestimonial = (idx, patch) => {
        if (!editor || typeof onChangeBlock !== "function") return;
        const nextItems = testimonialItems.map((it, i) => (i === idx ? { ...it, ...patch } : it));
        onChangeBlock({ ...props, items: nextItems });
      };

      const renderStarRow = (rating, idx) => {
        const filled = Math.max(1, Math.min(5, Number(rating) || 5));
        return (
          <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                role={editor ? "button" : undefined}
                tabIndex={editor ? 0 : undefined}
                onClick={editor ? () => patchTestimonial(idx, { rating: n }) : undefined}
                onKeyDown={editor ? (e) => { if (e.key === "Enter") patchTestimonial(idx, { rating: n }); } : undefined}
                style={{ fontSize: compact ? 15 : 18, color: n <= filled ? starAccent : "rgba(148,163,184,0.5)", cursor: editor ? "pointer" : "default", lineHeight: 1, userSelect: "none" }}
              >★</span>
            ))}
          </div>
        );
      };

      const renderTestimonialCard = (item, idx) => {
        const cardSty = typeof variantSty.card === "function" ? variantSty.card(idx) : variantSty.card;
        const avatarSrcItem = getAssetFromLibrary(assets, item.avatarAssetId)?.src || item.avatarUrl || avatarSrc || defaultAvatarSrc || "";
        // For wall variant the card's own color determines text, override quote/author/meta per card
        const wallCardColor = isWall && (idx % 3 === 2) ? (props.textColor || "#0f172a") : variantSty.quote.color;
        const wallMetaColor = isWall && (idx % 3 === 2) ? "#64748b" : variantSty.meta.color;
        const wallAuthorColor = isWall && (idx % 3 === 2) ? (props.textColor || "#0f172a") : variantSty.author.color;
        return (
          <ScrollReveal key={item.id || `testimonial-${idx}`} animationName="fade-up" delay={idx * 0.07} disabled={editor} style={{ ...cardSty, ...(variantSty.cardWrap ? { width: "100%", boxSizing: "border-box" } : {}) }}>
            {renderStarRow(item.rating, idx)}
            <p
              data-website-inline-editor="true"
              data-text-prop={`items.${idx}.text`}
              contentEditable={editor}
              suppressContentEditableWarning
              onBlur={(event) => {
                if (!editor) return;
                patchTestimonial(idx, { text: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
              }}
              style={{
                ...sharedStyles.quote(compact),
                ...variantSty.quote,
                color: wallCardColor,
                outline: editor ? "1px dashed rgba(14,165,233,0.45)" : "none",
                borderRadius: 8,
                padding: editor ? "4px 6px" : 0,
                margin: 0,
              }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(item.text || (editor ? "Click to edit quote…" : "")) }}
            />
            <div style={{ ...sharedStyles.authorRow, justifyContent: isSpotlight ? "center" : undefined }}>
              {avatarSrcItem
                ? <img src={avatarSrcItem} alt={item.author || ""} style={{ ...asStyleObject(sharedStyles.avatar), objectFit: "cover", objectPosition: item.avatarObjectPosition || "center center", flexShrink: 0, display: "block" }} />
                : editor
                  ? <div style={{ width: 44, height: 44, borderRadius: 999, background: "rgba(148,163,184,0.28)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#94a3b8", flexShrink: 0, fontWeight: 600 }}>Photo</div>
                  : null}
              <div>
                <p
                  data-website-inline-editor="true"
                  data-text-prop={`items.${idx}.author`}
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    if (!editor) return;
                    patchTestimonial(idx, { author: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
                  }}
                  style={{
                    ...sharedStyles.authorName,
                    ...variantSty.author,
                    color: wallAuthorColor,
                    outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                    borderRadius: 6,
                    padding: editor ? "2px 4px" : 0,
                    margin: 0,
                  }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(item.author || (editor ? "Author Name" : "")) }}
                />
                <p
                  data-website-inline-editor="true"
                  data-text-prop={`items.${idx}.role`}
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    if (!editor) return;
                    patchTestimonial(idx, { role: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
                  }}
                  style={{
                    ...sharedStyles.authorMeta,
                    ...variantSty.meta,
                    color: wallMetaColor,
                    outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                    borderRadius: 6,
                    padding: editor ? "2px 4px" : 0,
                    margin: "4px 0 0",
                  }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(item.role || (editor ? "Title / Company" : "")) }}
                />
              </div>
            </div>
          </ScrollReveal>
        );
      };

      return (
        <ScrollReveal as="section" animationName={props.sectionAnimation || "fade-up"} delay={props.sectionAnimationDelay || 0.06} speed={props.sectionAnimationSpeed} disabled={editor} style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), ...variantSty.shell, overflowX: "hidden", boxSizing: "border-box" }}>
          <div style={{ ...sectionContentStyle(props, compact), minWidth: 0, boxSizing: "border-box" }}>
          {(props.title || editor) ? (
            <h2
              data-website-inline-editor="true"
              data-text-prop="title"
              contentEditable={editor}
              suppressContentEditableWarning
              onBlur={(event) => {
                if (!editor || typeof onChangeBlock !== "function") return;
                onChangeBlock({ ...props, title: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
              }}
              style={{
                ...sharedStyles.sectionTitle(compact),
                color: props.headlineColor || (isSpotlight ? "#f1f5f9" : "#0f172a"),
                textAlign: testimonialTitleAlign,
                outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                borderRadius: 8,
                padding: editor ? "4px 6px" : 0,
                marginBottom: 4,
              }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || (editor ? "What Our Customers Say" : "")) }}
            />
          ) : null}
          <div style={{ ...asStyleObject(variantSty.grid), minWidth: 0 }}>
            {testimonialItems.map((item, idx) => (
              variantSty.cardWrap
                ? <div key={item.id || `tw-${idx}`} style={asStyleObject(variantSty.cardWrap)}>{renderTestimonialCard(item, idx)}</div>
                : renderTestimonialCard(item, idx)
            ))}
          </div>
          </div>
        </ScrollReveal>
      );
    }

    case "pricing-table":
      const pricingVariant = pricingVariantStyles(props);
      const plans = asArray(props.plans).map((plan, idx) => normalizePricingPlan(plan, idx));
      const patchPlan = (planIndex, patch) => {
        if (!editor || typeof onChangeBlock !== "function") return;
        const normalizedPatch = {
          ...patch,
          ...(Object.prototype.hasOwnProperty.call(patch, "name") ? { name: htmlToPlainText(patch.name) } : {}),
          ...(Object.prototype.hasOwnProperty.call(patch, "price") ? { price: htmlToPlainText(patch.price) } : {}),
          ...(Object.prototype.hasOwnProperty.call(patch, "description") ? { description: htmlToPlainText(patch.description) } : {}),
          ...(Object.prototype.hasOwnProperty.call(patch, "cta") ? { cta: htmlToPlainText(patch.cta) } : {}),
          ...(Object.prototype.hasOwnProperty.call(patch, "includedFeatures") ? { includedFeatures: (Array.isArray(patch.includedFeatures) ? patch.includedFeatures : []).map((item) => htmlToPlainText(item)) } : {}),
        };
        const nextPlans = plans.map((plan, currentIndex) => (
          currentIndex === planIndex
            ? {
                ...plan,
                ...normalizedPatch,
                features: Object.prototype.hasOwnProperty.call(normalizedPatch, "includedFeatures") ? normalizedPatch.includedFeatures : plan.features,
              }
            : plan
        ));
        onChangeBlock({ ...props, plans: nextPlans });
      };

      const patchPlanFeature = (planIndex, featureIndex, nextValue) => {
        if (!editor || typeof onChangeBlock !== "function") return;
        const nextPlans = plans.map((plan, currentIndex) => {
          if (currentIndex !== planIndex) return plan;
          const nextFeatures = asArray(plan.includedFeatures).map((feature, currentFeatureIndex) => (
            currentFeatureIndex === featureIndex ? htmlToPlainText(nextValue) : feature
          ));
          return { ...plan, includedFeatures: nextFeatures, features: nextFeatures };
        });
        onChangeBlock({ ...props, plans: nextPlans });
      };

      const patchPlanExtra = (planIndex, extraIndex, nextValue) => {
        if (!editor || typeof onChangeBlock !== "function") return;
        const nextPlans = plans.map((plan, currentIndex) => {
          if (currentIndex !== planIndex) return plan;
          const nextExtras = asArray(plan.extras).map((extra, currentExtraIndex) => (
            currentExtraIndex === extraIndex ? htmlToPlainText(nextValue) : extra
          ));
          return { ...plan, extras: nextExtras };
        });
        onChangeBlock({ ...props, plans: nextPlans });
      };

      return (
        <ScrollReveal as="section" animationName={props.sectionAnimation || "fade-up"} delay={props.sectionAnimationDelay || 0.06} speed={props.sectionAnimationSpeed} disabled={editor} style={{ ...sharedStyles.cardSection(compact, { ...props, backgroundColor: pricingVariant.section?.background || props.backgroundColor, borderColor: pricingVariant.section?.borderColor || props.borderColor }), ...fullWidthStyle(props, compact, editor) }}>
          <div style={sectionContentStyle(props, compact)}>
          <h2
            data-website-inline-editor="true"
            data-text-prop="title"
            contentEditable={editor}
            suppressContentEditableWarning
            onBlur={(event) => {
              if (!editor || typeof onChangeBlock !== "function") return;
              onChangeBlock({ ...props, title: htmlToPlainText(cleanInlineEditorHtml(event.currentTarget.innerHTML)) });
            }}
            style={{ ...sharedStyles.sectionTitle(compact), color: pricingVariant.sectionTitleColor || undefined, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0 }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || (editor ? "Pricing" : "")) }}
          />
          <div
            style={{
              ...sharedStyles.priceGrid(compact, plans.length, props.pricingCardWidth, props.pricingCardGap),
              ...(pricingVariant.grid?.(compact, plans.length) || {}),
              ...(pricingVariant.fullWidthGrid
                ? (compact ? {} : {
                    gridTemplateColumns: `repeat(${Math.max(1, plans.length)}, 1fr)`,
                    gap: Math.max(8, Number(props.pricingCardGap) || 16),
                    justifyContent: "stretch",
                  })
                : (compact
                  ? {}
                  : {
                      gridTemplateColumns: `repeat(${Math.max(1, plans.length)}, minmax(0, ${Math.max(180, Number(props.pricingCardWidth) || 260)}px))`,
                      gap: Math.max(8, Number(props.pricingCardGap) || 24),
                      justifyContent: "center",
                    })),
            }}
          >
            {plans.map((plan, idx) => (
              <ScrollReveal as="article" key={plan.id || `${plan.name}-${idx}`} animationName={(plan.cardAnimation && plan.cardAnimation !== "") ? plan.cardAnimation : (props.cardAnimation || "fade-up")} delay={idx * (Number(props.cardStagger ?? 0.08) || 0.08)} disabled={editor} style={{ ...pricingVariant.card(!!plan.highlighted, compact, idx), background: plan.cardBackgroundColor || (plan.highlighted ? (props.highlightedCardBackgroundColor || pricingVariant.card(!!plan.highlighted, compact, idx).background) : (props.cardBackgroundColor || pricingVariant.card(!!plan.highlighted, compact, idx).background)), border: plan.highlighted && props.accentColor ? `2px solid ${props.accentColor}` : pricingVariant.card(!!plan.highlighted, compact, idx).border, ...sharedStyles.priceCardLayout(compact, !!plan.highlighted) }}>
                {(() => {
                  const defaultTone = pricingVariant.textTone?.(idx, !!plan.highlighted) || {};
                  const accentTone = props.accentColor || defaultTone.accent || "#0ea5e9";
                  const pricingTone = {
                    ...defaultTone,
                    text: plan.textColor || props.textColor || defaultTone.text || "#0f172a",
                    subtle: plan.subtleTextColor || props.subtleTextColor || defaultTone.subtle || "#64748b",
                  };
                  const featureRowStyle = {
                    ...(pricingVariant.featureRow?.(!!plan.highlighted, idx) || {}),
                    ...(props.featureBackgroundColor ? { background: props.featureBackgroundColor } : {}),
                    ...(props.accentColor && plan.highlighted ? { border: `1px solid ${colorWithAlpha(accentTone, 0.22)}` } : {}),
                  };
                  const featureIconStyle = {
                    ...(pricingVariant.featureIcon?.(!!plan.highlighted, idx) || {}),
                    ...(props.accentColor && !pricingVariant.planAccentColor ? { background: `linear-gradient(135deg,${accentTone},${colorWithAlpha(accentTone, 0.72)})`, color: props.ctaTextColor || "#ffffff" } : {}),
                  };
                  const extrasCardStyle = {
                    ...(pricingVariant.extrasCard?.(!!plan.highlighted, idx) || {}),
                    ...(props.extrasBackgroundColor ? { background: props.extrasBackgroundColor } : {}),
                  };
                  const ctaStyle = {
                    ...(pricingVariant.cta?.(!!plan.highlighted, idx) || {}),
                    ...(props.ctaBackgroundColor ? { background: props.ctaBackgroundColor } : {}),
                    ...((plan.ctaTextColor || props.ctaTextColor) ? { color: plan.ctaTextColor || props.ctaTextColor } : {}),
                  };
                  const planSlug = slugifyText(plan.id || plan.name || `plan-${idx + 1}`);
                  const planCtaUrl = plan.ctaUrl || `/create-account?plan=${encodeURIComponent(planSlug)}`;
                  return (
                    <>
                {plan.badge && (
                  <div style={{ display: "inline-block", alignSelf: "flex-start", padding: "3px 10px", borderRadius: 999, fontSize: 16, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", background: pricingVariant.badgeBackground?.(!!plan.highlighted, idx) || accentTone, color: "#ffffff", marginBottom: 8 }}>
                    {plan.badge}
                  </div>
                )}
                <div style={sharedStyles.priceHero}>
                  <h3
                    data-website-inline-editor="true"
                    data-text-prop={`plans.${idx}.name`}
                    contentEditable={editor}
                    suppressContentEditableWarning
                    onBlur={(event) => patchPlan(idx, { name: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                    style={{ ...sharedStyles.planName, ...headingTypography(props), color: pricingVariant.planAccentColor ? pricingVariant.planAccentColor(idx) : (pricingTone?.text || undefined), outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0 }}
                    dangerouslySetInnerHTML={{ __html: asRichHtml(plan.name || (editor ? "Plan" : "")) }}
                  />
                  <p
                    data-website-inline-editor="true"
                    data-text-prop={`plans.${idx}.price`}
                    contentEditable={editor}
                    suppressContentEditableWarning
                    onBlur={(event) => patchPlan(idx, { price: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                    style={{ ...sharedStyles.planPrice, color: pricingVariant.planAccentColor ? pricingVariant.planAccentColor(idx) : (pricingTone?.text || undefined), outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0 }}
                    dangerouslySetInnerHTML={{ __html: asRichHtml(plan.price || (editor ? "$49" : "")) }}
                  />
                  <p
                    data-website-inline-editor="true"
                    data-text-prop={`plans.${idx}.description`}
                    contentEditable={editor}
                    suppressContentEditableWarning
                    onBlur={(event) => patchPlan(idx, { description: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                    style={{ ...sharedStyles.planDesc, color: pricingTone?.subtle || undefined, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0 }}
                    dangerouslySetInnerHTML={{ __html: asRichHtml(plan.description || (editor ? "Short plan description" : "")) }}
                  />
                </div>
                <div style={{ ...sharedStyles.planSectionLabel, color: pricingVariant.planAccentColor ? pricingVariant.planAccentColor(idx) : (pricingTone?.subtle || undefined), ...(pricingVariant.planAccentColor ? { borderLeft: `3px solid ${pricingVariant.planAccentColor(idx)}`, paddingLeft: 8 } : {}) }}>Included</div>
                <div style={sharedStyles.planFeatures}>
                  {asArray(plan.includedFeatures).map((feature, featureIdx) => {
                    if (pricingVariant.featureSplit) {
                      const parts = String(feature).split(" — ");
                      const label = parts[0] || feature;
                      const value = parts.slice(1).join(" — ");
                      return (
                        <div key={`${feature}-${featureIdx}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", ...featureRowStyle }}>
                          <span style={{ color: pricingTone?.text || "#f8fafc", fontSize: 16, lineHeight: 1.5 }}>{label}</span>
                          {value && <span style={{ color: pricingVariant.planAccentColor?.(idx) || accentTone, fontSize: 16, fontWeight: 600, textAlign: "right", marginLeft: 8, flexShrink: 0 }}>{value}</span>}
                        </div>
                      );
                    }
                    return (
                      <div key={`${feature}-${featureIdx}`} style={{ ...sharedStyles.planFeatureRow(!!plan.highlighted), ...featureRowStyle }}>
                        <span style={{ ...sharedStyles.planFeatureIcon(plan.featureIcon, !!plan.highlighted), ...featureIconStyle }}>{iconGlyph(plan.featureIcon)}</span>
                        <p
                          data-website-inline-editor="true"
                          data-text-prop={`plans.${idx}.includedFeatures.${featureIdx}`}
                          contentEditable={editor}
                          suppressContentEditableWarning
                          onBlur={(event) => patchPlanFeature(idx, featureIdx, cleanInlineEditorHtml(event.currentTarget.innerHTML))}
                          style={{ ...sharedStyles.planFeature, color: pricingTone?.text || undefined, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "3px 5px" : 0 }}
                          dangerouslySetInnerHTML={{ __html: asRichHtml(feature || (editor ? "Feature" : "")) }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div style={{ ...sharedStyles.planExtrasCard(!!plan.highlighted), ...extrasCardStyle }}>
                  <div style={{ ...sharedStyles.planSectionLabel, color: pricingVariant.planAccentColor ? pricingVariant.planAccentColor(idx) : (pricingTone?.subtle || undefined), ...(pricingVariant.planAccentColor ? { borderLeft: `3px solid ${pricingVariant.planAccentColor(idx)}`, paddingLeft: 8 } : {}) }}>{pricingVariant.featureSplit ? "Base Quotas Included" : "Extras"}</div>
                  <div style={sharedStyles.planExtrasList}>
                    {asArray(plan.extras).length ? asArray(plan.extras).map((extra, extraIdx) => {
                      if (pricingVariant.featureSplit) {
                        const parts = String(extra).split(" — ");
                        const label = parts[0] || extra;
                        const value = parts.slice(1).join(" — ");
                        return (
                          <div key={`${extra}-${extraIdx}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            <span style={{ color: pricingTone?.text || "#f8fafc", fontSize: 16 }}>{label}</span>
                            {value && <span style={{ color: pricingVariant.planAccentColor?.(idx) || accentTone, fontSize: 16, fontWeight: 600, textAlign: "right", marginLeft: 8, flexShrink: 0 }}>{value}</span>}
                          </div>
                        );
                      }
                      return (
                        <p
                          key={`${extra}-${extraIdx}`}
                          data-website-inline-editor="true"
                          data-text-prop={`plans.${idx}.extras.${extraIdx}`}
                          contentEditable={editor}
                          suppressContentEditableWarning
                          onBlur={(event) => patchPlanExtra(idx, extraIdx, cleanInlineEditorHtml(event.currentTarget.innerHTML))}
                          style={{ ...sharedStyles.planExtra, color: pricingTone?.text || undefined, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "3px 5px" : 0 }}
                          dangerouslySetInnerHTML={{ __html: asRichHtml(extra || (editor ? "Extra" : "")) }}
                        />
                      );
                    }) : <p style={{ ...sharedStyles.planExtraHint, color: pricingTone?.subtle || undefined }}>No extras listed yet.</p>}
                  </div>
                </div>
                {!editor ? (
                  <a
                    href={planCtaUrl}
                    style={{ ...sharedStyles.planCta(!!plan.highlighted), ...ctaStyle, display: "block", textDecoration: "none", textAlign: "center" }}
                    dangerouslySetInnerHTML={{ __html: asRichHtml(plan.cta || "Get Started") }}
                  />
                ) : (
                  <div
                    data-website-inline-editor="true"
                    data-text-prop={`plans.${idx}.cta`}
                    contentEditable={editor}
                    suppressContentEditableWarning
                    onBlur={(event) => patchPlan(idx, { cta: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                    style={{ ...sharedStyles.planCta(!!plan.highlighted), ...ctaStyle, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none" }}
                    dangerouslySetInnerHTML={{ __html: asRichHtml(plan.cta || (editor ? "Get Started" : "")) }}
                  />
                )}
                    </>
                  );
                })()}
              </ScrollReveal>
            ))}
          </div>
          {(() => {
            if (!pricingVariant.planAccentColor) return null;
            const parsePx = (str) => parseFloat(String(str || "").replace(/[^0-9.]/g, "")) || 0;
            const fmtUSD = (v) => {
              if (!Number.isFinite(v) || v <= 0) return "—";
              const fixed = v.toFixed(2);
              const [whole, dec] = fixed.split(".");
              return `A$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}` + (dec ? `.${dec}` : "");
            };
            const hasDisclosure = plans.some((p) => parsePx(p.individualPrice) > 0);
            if (!hasDisclosure) return null;
            const BILLING_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#7c3aed"];
            const planCol = (i) => BILLING_COLORS[i % BILLING_COLORS.length];
            const disclosureRows = [
              {
                label: "Separate Module Cost",
                labelBg: "rgba(255,255,255,0.06)",
                labelColor: "#9ca3af",
                getValue: (plan) => fmtUSD(parsePx(plan.individualPrice)),
                cellBg: (i) => `${planCol(i)}22`,
                textColor: (i) => planCol(i),
                fontWeight: 500,
              },
              {
                label: "Platform Plan Price",
                labelBg: "rgba(234,179,8,0.18)",
                labelColor: "#fde047",
                getValue: (plan) => fmtUSD(parsePx(plan.price)),
                cellBg: (i) => `${planCol(i)}22`,
                textColor: (i) => planCol(i),
                fontWeight: 600,
              },
              {
                label: "Monthly Savings",
                labelBg: "rgba(255,255,255,0.04)",
                labelColor: "#d1d5db",
                getValue: (plan) => fmtUSD(parsePx(plan.individualPrice) - parsePx(plan.price)),
                cellBg: (i) => `${planCol(i)}33`,
                textColor: (i) => planCol(i),
                fontWeight: 600,
              },
              {
                label: "Annual Savings",
                labelBg: "rgba(255,255,255,0.08)",
                labelColor: "#f8fafc",
                getValue: (plan) => fmtUSD((parsePx(plan.individualPrice) - parsePx(plan.price)) * 12),
                cellBg: (i) => `${planCol(i)}44`,
                textColor: (i) => planCol(i),
                fontWeight: 600,
              },
            ];
            const headerCells = [
              <div key="lbl-hdr" style={{ padding: compact ? "8px 12px" : "10px 16px", background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#9ca3af" }}>Plan</span>
              </div>,
              ...plans.map((plan, i) => (
                <div key={`hdr-${i}`} style={{ padding: compact ? "8px 10px" : "10px 14px", background: `${planCol(i)}18`, borderRight: i < plans.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: planCol(i) }}>{plan.name}</span>
                </div>
              )),
            ];
            return (
              <div style={{ marginTop: compact ? 24 : 40, overflowX: compact ? "auto" : "visible" }}>
                <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9ca3af" }}>Savings Disclosure</span>
                  <span style={{ height: 1, flex: 1, background: "rgba(255,255,255,0.08)" }} />
                  <span style={{ fontSize: 16, color: "rgba(255,255,255,0.3)" }}>Monthly comparison against equivalent standalone module prices</span>
                </div>
                <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", minWidth: compact ? 480 : "auto" }}>
                  <div style={{ display: "grid", gridTemplateColumns: `clamp(140px,22%,200px) repeat(${plans.length}, 1fr)`, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    {headerCells}
                  </div>
                  {disclosureRows.map((row, rowIdx) => (
                    <div key={rowIdx} style={{ display: "grid", gridTemplateColumns: `clamp(140px,22%,200px) repeat(${plans.length}, 1fr)`, borderBottom: rowIdx < disclosureRows.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                      <div style={{ padding: compact ? "9px 12px" : "11px 16px", background: row.labelBg, borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center" }}>
                        <span style={{ fontSize: compact ? 11 : 12, fontWeight: 600, color: row.labelColor, lineHeight: 1.3 }}>{row.label}</span>
                      </div>
                      {plans.map((plan, i) => (
                        <div key={i} style={{ padding: compact ? "9px 10px" : "11px 14px", background: row.cellBg(i), borderRight: i < plans.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                          <span style={{ fontSize: compact ? 12 : 14, fontWeight: row.fontWeight, color: row.textColor(i), letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>{row.getValue(plan)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          </div>
        </ScrollReveal>
      );

    case "contact-form":
      const contactVariant = contactFormVariantStyles(props, compact);
      const mediaImageSrc = resolveAssetField(props, "mediaImage", assets);
      const mediaPosition = compact ? (props.mediaPosition === "none" ? "none" : "top") : String(props.mediaPosition || (mediaImageSrc ? "right" : "none"));
      const formMaxWidth = Math.max(360, parseSizeValue(props.formMaxWidth, 760));
      const submitAction = String(props.submitAction || "none");
      const bookingUrl = resolveContactBookingUrl(props.bookingUrl || "");
      const patchContactField = (fieldIndex, patch) => {
        if (!editor || typeof onChangeBlock !== "function") return;
        const nextFields = asArray(props.fields).map((field, currentIndex) => (
          currentIndex === fieldIndex
            ? { ...field, ...patch }
            : field
        ));
        onChangeBlock({ ...props, fields: nextFields });
      };
      const wrapperGrid = mediaPosition === "left"
        ? "minmax(220px, 0.88fr) minmax(0, 1fr)"
        : mediaPosition === "right"
          ? "minmax(0, 1fr) minmax(220px, 0.88fr)"
          : "1fr";
      const formCard = (
        <div style={{
          ...contactVariant.shell,
          background: props.cardBackgroundColor || "#ffffff",
          width: "100%",
          boxSizing: "border-box",
        }}>
          <h2
            data-website-inline-editor="true"
            data-text-prop="title"
            contentEditable={editor}
            suppressContentEditableWarning
            onBlur={(event) => {
              if (!editor || typeof onChangeBlock !== "function") return;
              onChangeBlock({ ...props, title: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
            }}
            style={{ ...sharedStyles.sectionTitle(compact), ...headingTypography(props), color: props.textColor || "#0f172a", outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0 }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || "Get in Touch") }}
          />
          <div
            data-website-inline-editor="true"
            data-text-prop="subtitle"
            contentEditable={editor}
            suppressContentEditableWarning
            onBlur={(event) => {
              if (!editor || typeof onChangeBlock !== "function") return;
              onChangeBlock({ ...props, subtitle: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
            }}
            style={{ ...sharedStyles.sectionSub, ...bodyTypography(props), color: props.subtleTextColor || "#475569", outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0 }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(props.subtitle || "") }}
          />
          {editor ? (
            <div style={sharedStyles.formGrid}>
              {asArray(props.fields).map((field, idx) => (
                <div key={`${field.name}-${idx}`} style={sharedStyles.formField}>
                  <label
                    data-website-inline-editor="true"
                    data-text-prop={`fields.${idx}.label`}
                    contentEditable={editor}
                    suppressContentEditableWarning
                    onBlur={(event) => patchContactField(idx, { label: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                    style={{ ...sharedStyles.formLabel, color: props.textColor || "#0f172a", outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "3px 5px" : 0 }}
                    dangerouslySetInnerHTML={{ __html: asRichHtml(field.label || field.name || "Field") }}
                  />
                  {field.type === "textarea"
                    ? <div
                      data-website-inline-editor="true"
                      data-text-prop={`fields.${idx}.placeholder`}
                      contentEditable={editor}
                      suppressContentEditableWarning
                      onBlur={(event) => patchContactField(idx, { placeholder: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                      style={{ ...sharedStyles.inputShell, minHeight: 120, padding: "12px 14px", color: props.inputTextColor || props.subtleTextColor || "#94a3b8", background: props.inputBackgroundColor || "#ffffff", border: `1px solid ${props.inputBorderColor || "#cbd5e1"}`, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none" }}
                      dangerouslySetInnerHTML={{ __html: asRichHtml(field.placeholder || "Message") }}
                    />
                    : <div
                      data-website-inline-editor="true"
                      data-text-prop={`fields.${idx}.placeholder`}
                      contentEditable={editor}
                      suppressContentEditableWarning
                      onBlur={(event) => patchContactField(idx, { placeholder: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                      style={{ ...sharedStyles.inputShell, padding: "12px 14px", color: props.inputTextColor || props.subtleTextColor || "#94a3b8", background: props.inputBackgroundColor || "#ffffff", border: `1px solid ${props.inputBorderColor || "#cbd5e1"}`, display: "flex", alignItems: "center", outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none" }}
                      dangerouslySetInnerHTML={{ __html: asRichHtml(field.placeholder || field.label || field.name) }}
                    />}
                </div>
              ))}
            </div>
          ) : (
            <form style={sharedStyles.formGrid} onSubmit={(event) => event.preventDefault()}>
              {asArray(props.fields).map((field, idx) => (
                <div key={`${field.name}-${idx}`} style={sharedStyles.formField}>
                  <label style={{ ...sharedStyles.formLabel, color: props.textColor || "#0f172a" }}>
                    {htmlToPlainText(field.label || field.name || "Field")}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      name={field.name || `field-${idx}`}
                      placeholder={htmlToPlainText(field.placeholder || "Message")}
                      required={field.required !== false}
                      style={{ ...sharedStyles.inputShell, minHeight: 120, padding: "12px 14px", color: props.inputTextColor || "#0f172a", background: props.inputBackgroundColor || "#ffffff", border: `1px solid ${props.inputBorderColor || "#cbd5e1"}`, width: "100%", boxSizing: "border-box", resize: "vertical", font: "inherit" }}
                    />
                  ) : (
                    <input
                      type={field.type || "text"}
                      name={field.name || `field-${idx}`}
                      placeholder={htmlToPlainText(field.placeholder || field.label || field.name || "")}
                      required={field.required !== false}
                      style={{ ...sharedStyles.inputShell, padding: "12px 14px", color: props.inputTextColor || "#0f172a", background: props.inputBackgroundColor || "#ffffff", border: `1px solid ${props.inputBorderColor || "#cbd5e1"}`, display: "block", width: "100%", boxSizing: "border-box", font: "inherit" }}
                    />
                  )}
                </div>
              ))}
            </form>
          )}
          {submitAction === "calendar-booking" && bookingUrl ? (
            editor ? (
              <div
                data-website-inline-editor="true"
                data-text-prop="submitText"
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => {
                  if (!editor || typeof onChangeBlock !== "function") return;
                  onChangeBlock({ ...props, submitText: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
                }}
                style={{ ...sharedStyles.formSubmitBtn, ...getAnimationStyle("fade-up", 0.08), background: props.buttonBackgroundColor || "#0f172a", color: props.buttonTextColor || "#ffffff", outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none" }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(props.submitText || "Send Details") }}
              />
            ) : (
              <a href={bookingUrl} style={{ ...sharedStyles.formSubmitBtn, ...getAnimationStyle("fade-up", 0.08), background: props.buttonBackgroundColor || "#0f172a", color: props.buttonTextColor || "#ffffff", textDecoration: "none" }} dangerouslySetInnerHTML={{ __html: asRichHtml(props.submitText || "Send Details") }} />
            )
          ) : (
            <div
              data-website-inline-editor="true"
              data-text-prop="submitText"
              contentEditable={editor}
              suppressContentEditableWarning
              onBlur={(event) => {
                if (!editor || typeof onChangeBlock !== "function") return;
                onChangeBlock({ ...props, submitText: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
              }}
              style={{ ...sharedStyles.formSubmitBtn, ...getAnimationStyle("fade-up", 0.08), background: props.buttonBackgroundColor || "#0f172a", color: props.buttonTextColor || "#ffffff", outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none" }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(props.submitText || "Send Details") }}
            />
          )}
        </div>
      );
      return (
        <ScrollReveal as="section" animationName={props.sectionAnimation || "fade-up"} delay={props.sectionAnimationDelay || 0.06} speed={props.sectionAnimationSpeed} disabled={editor} style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), background: props.sectionGradient || props.backgroundColor || "#ffffff" }}>
          <div style={sectionContentStyle(props, compact)}>
            <div style={{ display: "grid", gridTemplateColumns: wrapperGrid, gap: compact ? 16 : 22, alignItems: "stretch", maxWidth: formMaxWidth, margin: "0 auto" }}>
              {mediaPosition === "top" && mediaImageSrc ? <img src={mediaImageSrc} alt={props.mediaAlt || props.title || "Contact form"} style={{ width: "100%", ...contactVariant.media }} /> : null}
              {mediaPosition === "left" && mediaImageSrc ? <img src={mediaImageSrc} alt={props.mediaAlt || props.title || "Contact form"} style={{ width: "100%", height: "100%", ...contactVariant.media }} /> : null}
              {formCard}
              {mediaPosition === "right" && mediaImageSrc ? <img src={mediaImageSrc} alt={props.mediaAlt || props.title || "Contact form"} style={{ width: "100%", height: "100%", ...contactVariant.media }} /> : null}
            </div>
          </div>
        </ScrollReveal>
      );

    case "image-gallery":
      const galleryVariant = imageGalleryVariantStyles(props, compact);
      return (
        <ScrollReveal as="section" animationName={props.sectionAnimation || "fade-up"} delay={props.sectionAnimationDelay || 0.06} speed={props.sectionAnimationSpeed} disabled={editor} style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor) }}>
          <div style={sectionContentStyle(props, compact)}>
          <h2
            data-website-inline-editor="true"
            data-text-prop="title"
            contentEditable={editor}
            suppressContentEditableWarning
            onBlur={(event) => {
              if (!editor || typeof onChangeBlock !== "function") return;
              onChangeBlock({ ...props, title: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
            }}
            style={{ ...sharedStyles.sectionTitle(compact), ...headingTypography(props), outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0 }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || "Gallery") }}
          />
          <div style={galleryVariant.grid}>
            {asArray(props.images).map((rawImage, idx) => {
              const image = normalizeGalleryItem(rawImage, idx);
              return (
              <ScrollReveal key={`${image.alt || "image"}-${idx}`} animationName="fade-up" delay={idx * 0.06} disabled={editor} style={galleryVariant.card(idx)}>
                {image?.src ? <img src={image.src} alt={image.alt || "Gallery image"} style={{ ...galleryVariant.image, objectPosition: `${image.imageX}% ${image.imageY}%` }} /> : <div style={sharedStyles.galleryPlaceholder}>No image</div>}
                {image.caption ? <div style={galleryVariant.captionWrap}><p style={galleryVariant.caption}>{image.caption}</p></div> : null}
              </ScrollReveal>
            );})}
          </div>
          </div>
        </ScrollReveal>
      );

    case "image-stack":
      return <LayeredImageStackBlock blockProps={props} compact={compact} assets={assets} editor={editor} onChangeBlock={onChangeBlock} onUploadLayerImage={onUploadLayerImage} layoutWidth={layoutWidth} />;

    case "columns-2": {
      const ratioMap = {
        "50-50": "1fr 1fr",
        "60-40": "1.2fr 0.8fr",
        "40-60": "0.8fr 1.2fr",
      };
      const leftImage = resolveAssetField(props, "leftImage", assets);
      const rightImage = resolveAssetField(props, "rightImage", assets);
      const leftCard = resolveColumnCardStyle(props, "leftColumn", compact);
      const rightCard = resolveColumnCardStyle(props, "rightColumn", compact);
      const col2LeftW = Number(props.leftColumnWidth) || 0;
      const col2RightW = Number(props.rightColumnWidth) || 0;
      const col2GridCols = (col2LeftW || col2RightW) ? `${col2LeftW || 1}fr ${col2RightW || 1}fr` : (ratioMap[props.ratio] || "1fr 1fr");
      const swapColumns2 = editor && onChangeBlock ? () => onChangeBlock({
        ...props,
        ratio: props.ratio === "60-40" ? "40-60" : props.ratio === "40-60" ? "60-40" : props.ratio,
        leftTitle: props.rightTitle, leftContent: props.rightContent, leftImage: props.rightImage, leftImageAssetId: props.rightImageAssetId,
        leftImageHeight: props.rightImageHeight, leftImageWidth: props.rightImageWidth, leftColumnContentType: props.rightColumnContentType,
        leftColumnNewsletterHeading: props.rightColumnNewsletterHeading, leftColumnNewsletterSubtitle: props.rightColumnNewsletterSubtitle,
        leftColumnNewsletterFields: props.rightColumnNewsletterFields, leftColumnNewsletterButtonText: props.rightColumnNewsletterButtonText,
        leftColumnNewsletterButtonColor: props.rightColumnNewsletterButtonColor, leftColumnNewsletterButtonTextColor: props.rightColumnNewsletterButtonTextColor,
        leftColumnNewsletterImage: props.rightColumnNewsletterImage, leftColumnNewsletterImageAssetId: props.rightColumnNewsletterImageAssetId,
        leftColumnNewsletterImageHeight: props.rightColumnNewsletterImageHeight, leftColumnNewsletterImageWidth: props.rightColumnNewsletterImageWidth,
        leftColumnWidth: props.rightColumnWidth, leftColumnExtraImages: props.rightColumnExtraImages, leftColumnBlock: props.rightColumnBlock,
        rightTitle: props.leftTitle, rightContent: props.leftContent, rightImage: props.leftImage, rightImageAssetId: props.leftImageAssetId,
        rightImageHeight: props.leftImageHeight, rightImageWidth: props.leftImageWidth, rightColumnContentType: props.leftColumnContentType,
        rightColumnNewsletterHeading: props.leftColumnNewsletterHeading, rightColumnNewsletterSubtitle: props.leftColumnNewsletterSubtitle,
        rightColumnNewsletterFields: props.leftColumnNewsletterFields, rightColumnNewsletterButtonText: props.leftColumnNewsletterButtonText,
        rightColumnNewsletterButtonColor: props.leftColumnNewsletterButtonColor, rightColumnNewsletterButtonTextColor: props.leftColumnNewsletterButtonTextColor,
        rightColumnNewsletterImage: props.leftColumnNewsletterImage, rightColumnNewsletterImageAssetId: props.leftColumnNewsletterImageAssetId,
        rightColumnNewsletterImageHeight: props.leftColumnNewsletterImageHeight, rightColumnNewsletterImageWidth: props.leftColumnNewsletterImageWidth,
        rightColumnWidth: props.leftColumnWidth, rightColumnExtraImages: props.leftColumnExtraImages, rightColumnBlock: props.leftColumnBlock,
      }) : null;
      return (
        <section style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), background: props.backgroundColor || "transparent", boxShadow: "none", borderRadius: 0, border: "none", padding: 0, width: "100%", boxSizing: "border-box", ...sectionAnimationStyle, minHeight: props.minHeight || undefined }}>
          <div style={{ ...sectionContentStyle({ ...props, baseLayoutWidth: props.blockMaxWidth || props.baseLayoutWidth }, compact), padding: compact ? "20px" : "30px 32px" }}>
          {props.title ? <h2 style={{ ...sharedStyles.sectionTitle(compact), color: props.textColor || "#0f172a" }}>{props.title}</h2> : null}
          <div style={{ ...sharedStyles.columns(2), gridTemplateColumns: compact ? "1fr" : col2GridCols, marginTop: Number(props.columnsTopMargin ?? 16), gap: compact ? 16 : Number(props.columnGap ?? 18), alignItems: String(props.columnsVerticalAlign || "stretch") === "center" ? "center" : String(props.columnsVerticalAlign || "stretch") === "bottom" ? "end" : "stretch" }}>
            <ColumnEditorCard
              title={props.leftTitle}
              content={props.leftContent}
              titleProp="leftTitle"
              contentProp="leftContent"
              image={leftImage}
              compact={compact}
              editor={editor}
              textColor={leftCard.titleTextColor}
              bodyTextColor={leftCard.bodyTextColor}
              cardBackgroundColor={props.cardBackgroundColor}
              cardStyle={leftCard.style}
              contentAlign={leftCard.align}
              overlay={leftCard.overlay}
              onSwap={swapColumns2}
              sectionOrder={props.leftColumnOrder || ["image", "title", "content"]}
              onReorderSection={editor && onChangeBlock ? (order) => onChangeBlock?.({ ...props, leftColumnOrder: order }) : null}
              contentType={props.leftColumnContentType || "text"}
              newsletterHeading={props.leftColumnNewsletterHeading}
              newsletterSubtitle={props.leftColumnNewsletterSubtitle}
              newsletterButtonText={props.leftColumnNewsletterButtonText}
              newsletterButtonColor={props.leftColumnNewsletterButtonColor}
              newsletterButtonTextColor={props.leftColumnNewsletterButtonTextColor}
              onPatchNewsletter={(patch) => onChangeBlock?.({ ...props, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [`leftColumn${k.charAt(0).toUpperCase() + k.slice(1)}`, v])) })}
              onTitleChange={(value) => onChangeBlock?.({ ...props, leftTitle: value })}
              onContentChange={(value) => onChangeBlock?.({ ...props, leftContent: value })}
              imageHeight={props.leftImageHeight}
              onImageHeightChange={(h) => onChangeBlock?.({ ...props, leftImageHeight: h })}
              imageWidth={props.leftImageWidth}
              onImageWidthChange={(w) => onChangeBlock?.({ ...props, leftImageWidth: w })}
              newsletterImage={resolveAssetField(props, "leftColumnNewsletterImage", assets)}
              newsletterImageHeight={props.leftColumnNewsletterImageHeight}
              onNewsletterImageHeightChange={(h) => onChangeBlock?.({ ...props, leftColumnNewsletterImageHeight: h })}
              newsletterImageWidth={props.leftColumnNewsletterImageWidth}
              onNewsletterImageWidthChange={(w) => onChangeBlock?.({ ...props, leftColumnNewsletterImageWidth: w })}
              newsletterFields={props.leftColumnNewsletterFields}
              extraImages={Array.isArray(props.leftColumnExtraImages) ? props.leftColumnExtraImages : []}
              onExtraImagesChange={(next) => onChangeBlock?.({ ...props, leftColumnExtraImages: next })}
              subBlock={props.leftColumnBlock || null}
              onRenderSubBlock={(sb) => sb ? renderWebsiteBlock(sb, { compact, assets, editor, onChangeBlock: null }) : null}
            />
            <ColumnEditorCard
              title={props.rightTitle}
              content={props.rightContent}
              titleProp="rightTitle"
              contentProp="rightContent"
              image={rightImage}
              compact={compact}
              editor={editor}
              textColor={rightCard.titleTextColor}
              bodyTextColor={rightCard.bodyTextColor}
              cardBackgroundColor={props.cardBackgroundColor}
              cardStyle={rightCard.style}
              contentAlign={rightCard.align}
              overlay={rightCard.overlay}
              onSwap={swapColumns2}
              sectionOrder={props.rightColumnOrder || ["image", "title", "content"]}
              onReorderSection={editor && onChangeBlock ? (order) => onChangeBlock?.({ ...props, rightColumnOrder: order }) : null}
              contentType={props.rightColumnContentType || "text"}
              newsletterHeading={props.rightColumnNewsletterHeading}
              newsletterSubtitle={props.rightColumnNewsletterSubtitle}
              newsletterButtonText={props.rightColumnNewsletterButtonText}
              newsletterButtonColor={props.rightColumnNewsletterButtonColor}
              newsletterButtonTextColor={props.rightColumnNewsletterButtonTextColor}
              onPatchNewsletter={(patch) => onChangeBlock?.({ ...props, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [`rightColumn${k.charAt(0).toUpperCase() + k.slice(1)}`, v])) })}
              onTitleChange={(value) => onChangeBlock?.({ ...props, rightTitle: value })}
              onContentChange={(value) => onChangeBlock?.({ ...props, rightContent: value })}
              imageHeight={props.rightImageHeight}
              onImageHeightChange={(h) => onChangeBlock?.({ ...props, rightImageHeight: h })}
              imageWidth={props.rightImageWidth}
              onImageWidthChange={(w) => onChangeBlock?.({ ...props, rightImageWidth: w })}
              newsletterImage={resolveAssetField(props, "rightColumnNewsletterImage", assets)}
              newsletterImageHeight={props.rightColumnNewsletterImageHeight}
              onNewsletterImageHeightChange={(h) => onChangeBlock?.({ ...props, rightColumnNewsletterImageHeight: h })}
              newsletterImageWidth={props.rightColumnNewsletterImageWidth}
              onNewsletterImageWidthChange={(w) => onChangeBlock?.({ ...props, rightColumnNewsletterImageWidth: w })}
              newsletterFields={props.rightColumnNewsletterFields}
              extraImages={Array.isArray(props.rightColumnExtraImages) ? props.rightColumnExtraImages : []}
              onExtraImagesChange={(next) => onChangeBlock?.({ ...props, rightColumnExtraImages: next })}
              subBlock={props.rightColumnBlock || null}
              onRenderSubBlock={(sb) => sb ? renderWebsiteBlock(sb, { compact, assets, editor, onChangeBlock: null }) : null}
            />
          </div>
          </div>
        </section>
      );
    }

    case "columns-3": {
      const column1Card = resolveColumnCardStyle(props, "column1", compact);
      const column2Card = resolveColumnCardStyle(props, "column2", compact);
      const column3Card = resolveColumnCardStyle(props, "column3", compact);
      const col3W1 = Number(props.column1Width) || 0;
      const col3W2 = Number(props.column2Width) || 0;
      const col3W3 = Number(props.column3Width) || 0;
      const col3GridCols = (col3W1 || col3W2 || col3W3) ? `${col3W1 || 1}fr ${col3W2 || 1}fr ${col3W3 || 1}fr` : "1fr 1fr 1fr";
      return (
        <section style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), background: props.backgroundColor || "transparent", boxShadow: "none", borderRadius: 0, border: "none", padding: 0, width: "100%", boxSizing: "border-box", ...sectionAnimationStyle, minHeight: props.minHeight || undefined }}>
          <div style={{ ...sectionContentStyle({ ...props, baseLayoutWidth: props.blockMaxWidth || props.baseLayoutWidth }, compact), padding: compact ? "20px" : "30px 32px" }}>
          {props.title ? <h2 style={{ ...sharedStyles.sectionTitle(compact), color: props.textColor || "#0f172a" }}>{props.title}</h2> : null}
          <div style={{ ...sharedStyles.columns(compact ? 1 : 3), gridTemplateColumns: compact ? "1fr" : col3GridCols, marginTop: Number(props.columnsTopMargin ?? 16), gap: compact ? 16 : Number(props.columnGap ?? 18), alignItems: String(props.columnsVerticalAlign || "stretch") === "center" ? "center" : String(props.columnsVerticalAlign || "stretch") === "bottom" ? "end" : "stretch" }}>
            <ColumnEditorCard
              title={props.column1Title}
              content={props.column1}
              titleProp="column1Title"
              contentProp="column1"
              image={resolveAssetField(props, "column1Image", assets)}
              compact={compact}
              editor={editor}
              textColor={column1Card.titleTextColor}
              bodyTextColor={column1Card.bodyTextColor}
              cardBackgroundColor={props.cardBackgroundColor}
              cardStyle={column1Card.style}
              contentAlign={column1Card.align}
              overlay={column1Card.overlay}
              contentType={props.column1ContentType || "text"}
              newsletterHeading={props.column1NewsletterHeading}
              newsletterSubtitle={props.column1NewsletterSubtitle}
              newsletterButtonText={props.column1NewsletterButtonText}
              newsletterButtonColor={props.column1NewsletterButtonColor}
              newsletterButtonTextColor={props.column1NewsletterButtonTextColor}
              onPatchNewsletter={(patch) => onChangeBlock?.({ ...props, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [`column1${k.charAt(0).toUpperCase() + k.slice(1)}`, v])) })}
              onTitleChange={(value) => onChangeBlock?.({ ...props, column1Title: value })}
              onContentChange={(value) => onChangeBlock?.({ ...props, column1: value })}
              imageHeight={props.column1ImageHeight}
              onImageHeightChange={(h) => onChangeBlock?.({ ...props, column1ImageHeight: h })}
              imageWidth={props.column1ImageWidth}
              onImageWidthChange={(w) => onChangeBlock?.({ ...props, column1ImageWidth: w })}
              newsletterImage={resolveAssetField(props, "column1NewsletterImage", assets)}
              newsletterImageHeight={props.column1NewsletterImageHeight}
              onNewsletterImageHeightChange={(h) => onChangeBlock?.({ ...props, column1NewsletterImageHeight: h })}
              newsletterImageWidth={props.column1NewsletterImageWidth}
              onNewsletterImageWidthChange={(w) => onChangeBlock?.({ ...props, column1NewsletterImageWidth: w })}
              newsletterFields={props.column1NewsletterFields}
            />
            <ColumnEditorCard
              title={props.column2Title}
              content={props.column2}
              titleProp="column2Title"
              contentProp="column2"
              image={resolveAssetField(props, "column2Image", assets)}
              compact={compact}
              editor={editor}
              textColor={column2Card.titleTextColor}
              bodyTextColor={column2Card.bodyTextColor}
              cardBackgroundColor={props.cardBackgroundColor}
              cardStyle={column2Card.style}
              contentAlign={column2Card.align}
              overlay={column2Card.overlay}
              contentType={props.column2ContentType || "text"}
              newsletterHeading={props.column2NewsletterHeading}
              newsletterSubtitle={props.column2NewsletterSubtitle}
              newsletterButtonText={props.column2NewsletterButtonText}
              newsletterButtonColor={props.column2NewsletterButtonColor}
              newsletterButtonTextColor={props.column2NewsletterButtonTextColor}
              onPatchNewsletter={(patch) => onChangeBlock?.({ ...props, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [`column2${k.charAt(0).toUpperCase() + k.slice(1)}`, v])) })}
              onTitleChange={(value) => onChangeBlock?.({ ...props, column2Title: value })}
              onContentChange={(value) => onChangeBlock?.({ ...props, column2: value })}
              imageHeight={props.column2ImageHeight}
              onImageHeightChange={(h) => onChangeBlock?.({ ...props, column2ImageHeight: h })}
              imageWidth={props.column2ImageWidth}
              onImageWidthChange={(w) => onChangeBlock?.({ ...props, column2ImageWidth: w })}
              newsletterImage={resolveAssetField(props, "column2NewsletterImage", assets)}
              newsletterImageHeight={props.column2NewsletterImageHeight}
              onNewsletterImageHeightChange={(h) => onChangeBlock?.({ ...props, column2NewsletterImageHeight: h })}
              newsletterImageWidth={props.column2NewsletterImageWidth}
              onNewsletterImageWidthChange={(w) => onChangeBlock?.({ ...props, column2NewsletterImageWidth: w })}
              newsletterFields={props.column2NewsletterFields}
            />
            <ColumnEditorCard
              title={props.column3Title}
              content={props.column3}
              titleProp="column3Title"
              contentProp="column3"
              image={resolveAssetField(props, "column3Image", assets)}
              compact={compact}
              editor={editor}
              textColor={column3Card.titleTextColor}
              bodyTextColor={column3Card.bodyTextColor}
              cardBackgroundColor={props.cardBackgroundColor}
              cardStyle={column3Card.style}
              contentAlign={column3Card.align}
              overlay={column3Card.overlay}
              contentType={props.column3ContentType || "text"}
              newsletterHeading={props.column3NewsletterHeading}
              newsletterSubtitle={props.column3NewsletterSubtitle}
              newsletterButtonText={props.column3NewsletterButtonText}
              newsletterButtonColor={props.column3NewsletterButtonColor}
              newsletterButtonTextColor={props.column3NewsletterButtonTextColor}
              onPatchNewsletter={(patch) => onChangeBlock?.({ ...props, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [`column3${k.charAt(0).toUpperCase() + k.slice(1)}`, v])) })}
              onTitleChange={(value) => onChangeBlock?.({ ...props, column3Title: value })}
              onContentChange={(value) => onChangeBlock?.({ ...props, column3: value })}
              imageHeight={props.column3ImageHeight}
              onImageHeightChange={(h) => onChangeBlock?.({ ...props, column3ImageHeight: h })}
              imageWidth={props.column3ImageWidth}
              onImageWidthChange={(w) => onChangeBlock?.({ ...props, column3ImageWidth: w })}
              newsletterImage={resolveAssetField(props, "column3NewsletterImage", assets)}
              newsletterImageHeight={props.column3NewsletterImageHeight}
              onNewsletterImageHeightChange={(h) => onChangeBlock?.({ ...props, column3NewsletterImageHeight: h })}
              newsletterImageWidth={props.column3NewsletterImageWidth}
              onNewsletterImageWidthChange={(w) => onChangeBlock?.({ ...props, column3NewsletterImageWidth: w })}
              newsletterFields={props.column3NewsletterFields}
            />
          </div>
          </div>
        </section>
      );
    }

    case "grid-section": {
      const items = normalizeGridSectionItems(props.items);
      const cardStyle = resolveGridSectionCardStyle(props, compact);
      const servicesVariant = isServicesGridVariant(props, items);
      const fullBleedServicesLayout = servicesVariant && props.stretchToCanvas !== false;
      const servicesLayoutMode = String(props.servicesLayoutMode || "grid");
      const sliderLayout = servicesVariant && servicesLayoutMode === "slider";
      const rawColumns = Math.max(1, Math.min(6, Number(props.columns) || 3));
      const gridColumns = compact ? 1 : rawColumns;
      const verticalAlign = String(props.columnsVerticalAlign || "stretch");
      const alignItems = verticalAlign === "center" ? "center" : verticalAlign === "bottom" ? "end" : "stretch";
      const cardStagger = Math.max(0, Number(props.cardAnimationStagger ?? props.cardStagger ?? 0.08));
      const surfaceSpeed = Number(props.cardAnimationSpeed ?? props.surfaceAnimationSpeed) || null;
      const sectionBgImage = String(props.sectionBackgroundImage || "").trim();
      const resolvedSectionBackground = servicesVariant
        ? (sectionBgImage
            ? `linear-gradient(180deg, rgba(5,9,20,0.84) 0%, rgba(8,19,31,0.80) 100%), url("${sectionBgImage}")`
            : (props.backgroundColor || "linear-gradient(180deg, #050914 0%, #08131f 100%)"))
        : (props.backgroundColor || "transparent");
      const contentWrapStyle = fullBleedServicesLayout
        ? { ...sectionContentStyle(props, compact), padding: 0 }
        : {
            ...sectionContentStyle({ ...props, baseLayoutWidth: props.blockMaxWidth || props.baseLayoutWidth }, compact),
            padding: compact ? "20px" : "30px 32px",
          };
      const updateGridItem = (itemIndex, patch) => {
        if (typeof onChangeBlock !== "function") return;
        const nextItems = items.map((item, currentIndex) => (
          currentIndex === itemIndex ? { ...item, ...patch } : item
        ));
        onChangeBlock({ ...props, items: nextItems });
      };

      const servicesColorPreset = resolveServicesColorPreset(props);
      const sliderCardWidth = compact
        ? "84vw"
        : rawColumns >= 5
          ? "220px"
          : rawColumns === 4
            ? "260px"
            : rawColumns === 2
              ? "420px"
              : "320px";

      return (
        <ScrollReveal
          as="section"
          animationName={props.sectionAnimation || "none"}
          delay={props.sectionAnimationDelay || 0.04}
          speed={props.sectionAnimationSpeed || surfaceSpeed}
          disabled={editor}
          style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), background: resolvedSectionBackground, ...(sectionBgImage ? { backgroundImage: servicesVariant ? undefined : `url("${sectionBgImage}")`, backgroundSize: "cover", backgroundPosition: "center center" } : {}), boxShadow: "none", borderRadius: 0, border: "none", padding: 0, width: "100%", boxSizing: "border-box", ...sectionAnimationStyle, minHeight: props.minHeight || undefined, height: props.sectionHeight || undefined, overflow: servicesVariant ? "hidden" : undefined }}
        >
          <div style={contentWrapStyle}>
            {props.title ? (
              <div style={fullBleedServicesLayout ? { padding: compact ? "20px 20px 0" : "30px 32px 0" } : undefined}>
                <h2
                  data-website-inline-editor="true"
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(e) => { if (typeof onChangeBlock === "function") onChangeBlock({ ...props, title: cleanInlineEditorHtml(e.currentTarget.innerHTML) }); }}
                  style={{ ...sharedStyles.sectionTitle(compact), color: props.sectionTitleColor || servicesColorPreset.sectionTitleColor || props.textColor || "#0f172a", fontSize: compact ? Math.max(16, Number(props.sectionTitleSize || 28)) : Math.max(18, Number(props.sectionTitleSize || 28)) }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || "") }}
                />
              </div>
            ) : null}
            <div
              style={{
                ...(sliderLayout ? {
                  display: "flex",
                  gap: compact ? 16 : Number(props.columnGap ?? 20),
                  overflowX: "auto",
                  overflowY: "hidden",
                  scrollSnapType: "x mandatory",
                  paddingBottom: 8,
                } : sharedStyles.columns(gridColumns)),
                ...(!sliderLayout ? { gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` } : {}),
                marginTop: props.title ? Number(props.columnsTopMargin ?? 18) : 0,
                columnGap: compact ? 16 : Number(props.columnGap ?? (servicesVariant ? 15 : 20)),
                rowGap: compact ? 16 : Number(props.rowGap ?? (servicesVariant ? 25 : (props.columnGap ?? 20))),
                alignItems,
                padding: fullBleedServicesLayout ? 0 : undefined,
              }}
            >
              {items.map((rawItem, itemIndex) => {
                const resolvedItemImage = rawItem.image || getAssetFromLibrary(assets, rawItem.imageAssetId)?.src || "";
                const item = resolvedItemImage !== rawItem.image ? { ...rawItem, image: resolvedItemImage } : rawItem;
                const baseDelay = itemIndex * cardStagger;
                const resolvedSurfaceSpeed = surfaceSpeed || (servicesVariant ? 0.95 : null);
                const resolvedIconAnimation = props.iconAnimation || (servicesVariant ? "rubber-band" : "none");
                const resolvedImageAnimation = props.imageAnimation || (servicesVariant ? "zoom" : "none");
                const resolvedTitleAnimation = props.titleAnimation || (servicesVariant ? "slide-up" : "none");
                const resolvedBodyAnimation = props.bodyAnimation || (servicesVariant ? "fade-in" : "none");
                const resolvedCardAnimation = props.cardAnimation || "fade-up";
                const serviceIconSize = Math.max(14, Number(props.iconSize ?? (compact ? 28 : 36)));
                const serviceIconBadgeWidth = Math.max(serviceIconSize + 14, Number(props.iconBadgeWidth ?? (compact ? 58 : 65)));
                const serviceIconBadgeHeight = Math.max(serviceIconSize + 20, Number(props.iconBadgeHeight ?? (compact ? 72 : 82)));
                const serviceIconBadgePadding = Math.max(0, Number(props.iconBadgePadding ?? (compact ? 12 : 14)));
                const serviceEyebrowFontSize = Math.max(12, Number(props.eyebrowFontSize ?? 18));
                const serviceCardTitleFontSize = Math.max(16, Number(props.cardTitleSize ?? 28));
                const serviceCardBodyFontSize = Math.max(10, Number(props.cardBodySize ?? 16));
                const iconStyle = editor ? {} : getAnimationStyle(resolvedIconAnimation, baseDelay, resolvedSurfaceSpeed);
                const imageStyle = editor ? {} : getAnimationStyle(resolvedImageAnimation, baseDelay + 0.04, resolvedSurfaceSpeed);
                const titleStyle = editor ? {} : getAnimationStyle(resolvedTitleAnimation, baseDelay + 0.08, resolvedSurfaceSpeed);
                const bodyStyle = editor ? {} : getAnimationStyle(resolvedBodyAnimation, baseDelay + 0.12, resolvedSurfaceSpeed);
                const iconNode = renderGridSectionIcon(item, cardStyle.iconColor, Number(props.iconSize ?? (compact ? 18 : 20)));
                const topIconNode = renderGridSectionIcon(item, "#ffffff", serviceIconSize);
                const ghostIconNode = renderGridSectionIcon(item, colorWithAlpha("#9ae6b4", 0.16), Math.round(serviceIconSize * 2.45));
                const titleNode = (
                  <>
                    {item.eyebrow ? (
                      <div style={{ margin: 0, color: props.eyebrowColor || cardStyle.bodyTextColor, fontSize: serviceEyebrowFontSize, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase" }}>
                        {item.eyebrow}
                      </div>
                    ) : null}
                    <h3
                      data-website-inline-editor="true"
                      contentEditable={editor}
                      suppressContentEditableWarning
                      onBlur={(event) => updateGridItem(itemIndex, { title: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                      style={{ margin: 0, color: cardStyle.titleTextColor, fontSize: serviceCardTitleFontSize, lineHeight: 1.16, fontWeight: 600, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0, ...titleStyle }}
                      dangerouslySetInnerHTML={{ __html: asRichHtml(item.title || "Card title") }}
                    />
                  </>
                );

                if (servicesVariant) {
                  const serviceTileRadius = compact ? 14 : 15;
                  const tileHeight = item.imageHeight ? Number(item.imageHeight) : undefined;
                  const serviceCard = (
                    <ServicesGridCard
                      item={item}
                      itemIndex={itemIndex}
                      compact={compact}
                      editor={editor}
                      props={props}
                      baseDelay={baseDelay}
                      serviceTileRadius={serviceTileRadius}
                      tileHeight={tileHeight}
                      topIconNode={topIconNode}
                      ghostIconNode={ghostIconNode}
                      imageStyle={imageStyle}
                      iconStyle={iconStyle}
                      titleStyle={titleStyle}
                      bodyStyle={bodyStyle}
                      eyebrowFontSize={serviceEyebrowFontSize}
                      serviceIconBadgeWidth={serviceIconBadgeWidth}
                      serviceIconBadgeHeight={serviceIconBadgeHeight}
                      serviceIconBadgePadding={serviceIconBadgePadding}
                      cardTitleFontSize={serviceCardTitleFontSize}
                      cardBodyFontSize={serviceCardBodyFontSize}
                      onUpdate={updateGridItem}
                    />
                  );

                  return (
                    <ScrollReveal
                      as="div"
                      key={`grid-item-${itemIndex}`}
                      animationName={resolvedCardAnimation}
                      delay={baseDelay}
                      speed={resolvedSurfaceSpeed}
                      disabled={editor}
                      style={sliderLayout ? { flex: `0 0 ${sliderCardWidth}`, minWidth: sliderCardWidth, scrollSnapAlign: "start" } : undefined}
                    >
                      {serviceCard}
                    </ScrollReveal>
                  );
                }

                return (
                  <ScrollReveal
                    as="article"
                    key={`grid-item-${itemIndex}`}
                    animationName={props.cardAnimation || "none"}
                    delay={baseDelay}
                    speed={resolvedSurfaceSpeed}
                    disabled={editor}
                    style={{ ...cardStyle.style, textAlign: cardStyle.align }}
                  >
                    {cardStyle.overlay}
                    {iconNode ? (
                      <div style={{ position: "relative", zIndex: 1, display: "inline-flex", alignSelf: cardStyle.align === "center" ? "center" : cardStyle.align === "right" ? "flex-end" : "flex-start", alignItems: "center", justifyContent: "center", minWidth: 44, minHeight: 44, borderRadius: 999, padding: "10px 14px", background: props.iconBackgroundColor || "rgba(14,165,233,0.12)", color: cardStyle.iconColor, fontSize: Number(props.iconSize ?? (compact ? 22 : 26)), lineHeight: 1, ...iconStyle }}>
                        <span
                          data-website-inline-editor="true"
                          contentEditable={editor}
                          suppressContentEditableWarning
                          onBlur={(event) => updateGridItem(itemIndex, { icon: cleanInlineEditorHtml(event.currentTarget.innerHTML).replace(/<[^>]+>/g, "").trim() })}
                        >
                          {iconNode}
                        </span>
                      </div>
                    ) : null}
                    {item.image ? (
                      <img src={item.image} alt={item.imageAlt || item.title || "Grid item image"} style={{ position: "relative", zIndex: 1, width: "100%", height: item.imageHeight ? `${Number(item.imageHeight)}px` : (compact ? 180 : 220), objectFit: "cover", borderRadius: Math.max(12, Number(props.imageRadius ?? 16)), ...imageStyle }} />
                    ) : null}
                    <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 10 }}>
                      {!editor && item.link ? (
                        <a href={item.link} style={{ color: "inherit", textDecoration: "none", display: "grid", gap: 8 }}>
                          {titleNode}
                        </a>
                      ) : titleNode}
                      {item.content ? (
                        <div
                          data-website-inline-editor="true"
                          contentEditable={editor}
                          suppressContentEditableWarning
                          onBlur={(event) => updateGridItem(itemIndex, { content: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                          style={{ color: cardStyle.bodyTextColor, fontSize: compact ? 15 : 16, lineHeight: 1.7, outline: editor ? "1px dashed rgba(14,165,233,0.28)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0, ...bodyStyle }}
                          dangerouslySetInnerHTML={{ __html: asRichHtml(item.content || "") }}
                        />
                      ) : null}
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        </ScrollReveal>
      );
    }

    case "accordion":
    case "faq":
      return <FAQAccordionBlock props={props} compact={compact} editor={editor} onChangeBlock={onChangeBlock} sectionAnimationStyle={sectionAnimationStyle} assets={assets} />;

    case "feature-accordion":
      return <FeatureAccordionBlock props={props} compact={compact} editor={editor} onChangeBlock={onChangeBlock} onUploadImage={onUploadImage} />;
    case "side-scroll-accordion":
      return <SideScrollAccordionBlock props={props} compact={compact} editor={editor} onChangeBlock={onChangeBlock} onUploadImage={onUploadImage} />;
    case "scroll-stack":
      return <ScrollStackBlock props={props} compact={compact} editor={editor} onChangeBlock={onChangeBlock} onUploadImage={onUploadImage} />;

    case "avatar-morph":
      return <AvatarMorphBlock block={block} compact={compact} editor={editor} onChangeBlock={onChangeBlock} onUploadImage={onUploadImage} />;

    case "video-hero":
      return <VideoHeroBlock block={block} compact={compact} editor={editor} isSelected={isSelected} onChangeBlock={onChangeBlock} onUploadImage={onUploadImage} />;

    case "stats":
      const statsItems = asArray(props.stats).map((item, index) => normalizeStatItem(item, index));
      const statsVariant = statsVariantStyles(props, compact);
      const statsContentWidth = props.blockMaxWidth || props.baseLayoutWidth || layoutWidth;
      const statsCardAnimation = props.cardAnimation || "fade-up";
      const statsNumberAnimation = props.numberAnimation || "slide-up";
      const statsLabelAnimation = props.labelAnimation || "fade-up";
      const statsDetailAnimation = props.detailAnimation || "fade-in";
      const statsSurfaceSpeed = Number(props.surfaceAnimationSpeed) || null;
      const statsCardStagger = Math.max(0, Number(props.cardStagger ?? 0.08));
      const patchStat = (index, patch) => {
        if (!editor || typeof onChangeBlock !== "function") return;
        onChangeBlock({
          ...props,
          stats: statsItems.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
        });
      };

      const statsIsDataRibbon = String(props.statsVariant || "editorial-band") === "data-ribbon";
      const statsLeftColPct = Math.min(80, Math.max(20, Number(props.statsLeftColPct ?? 40)));
      // Default header width comes from the variant's maxWidth; user can override via drag.
      const statsHeaderDefaultWidth = Number(statsVariant.header?.maxWidth || 720);
      const statsHeaderWidth = props.statsHeaderWidth > 0 ? props.statsHeaderWidth : statsHeaderDefaultWidth;

      // Inner header content (title + subtitle) — shared between resizer wrappers.
      const _statsHeaderInner = (
        <div style={{ ...asStyleObject(statsVariant.header), maxWidth: "100%", width: "100%" }}>
          <h2
            data-website-inline-editor="true"
            data-text-prop="title"
            contentEditable={editor}
            suppressContentEditableWarning
            onBlur={(event) => {
              if (!editor || typeof onChangeBlock !== "function") return;
              onChangeBlock({ ...props, title: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
            }}
            style={{ ...sharedStyles.sectionTitle(compact), ...headingTypography(props), color: statsVariant.sectionTitleColor || props.textColor || undefined, fontSize: compact ? Math.max(16, Number(props.sectionTitleSize || 28)) : Math.max(18, Number(props.sectionTitleSize || 28)), outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0 }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || "Stats") }}
          />
          {props.subtitle || editor ? (
            <div
              data-website-inline-editor="true"
              data-text-prop="subtitle"
              contentEditable={editor}
              suppressContentEditableWarning
              onBlur={(event) => {
                if (!editor || typeof onChangeBlock !== "function") return;
                onChangeBlock({ ...props, subtitle: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
              }}
              style={{ ...sharedStyles.sectionSub, ...bodyTypography(props), color: statsVariant.sectionSubtitleColor || props.textColor || undefined, fontSize: compact ? Math.max(12, Number(props.sectionSubtitleSize || 16)) : Math.max(12, Number(props.sectionSubtitleSize || 16)), opacity: props.subtitle ? 0.88 : 0.72, marginTop: 12, outline: editor ? "1px dashed rgba(14,165,233,0.3)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0 }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(props.subtitle || "") }}
            />
          ) : null}
        </div>
      );

      // For non-data-ribbon variants, wrap header in TextColumnResizer so the user can
      // drag-resize the text column width. Data-ribbon uses StatsSplitResizer instead.
      const _statsHeaderJsx = statsIsDataRibbon ? (
        _statsHeaderInner
      ) : (
        <TextColumnResizer
          editor={editor}
          value={statsHeaderWidth}
          align="center"
          onResize={(v) => typeof onChangeBlock === "function" && onChangeBlock({ ...props, statsHeaderWidth: v })}
        >
          {_statsHeaderInner}
        </TextColumnResizer>
      );

      const _renderStatItem = (stat, idx) => {
        const baseDelay = idx * statsCardStagger;
        const thisCardAnimation = (stat.cardAnimation && stat.cardAnimation !== "") ? stat.cardAnimation : statsCardAnimation;
        const numberAnimationStyle = editor ? {} : getAnimationStyle(statsNumberAnimation, baseDelay + 0.04, statsSurfaceSpeed);
        const labelAnimationStyle = editor ? {} : getAnimationStyle(statsLabelAnimation, baseDelay + 0.08, statsSurfaceSpeed);
        const detailAnimationStyle = editor ? {} : getAnimationStyle(statsDetailAnimation, baseDelay + 0.12, statsSurfaceSpeed);
        return (
          <ScrollReveal key={`${stat.id}-${idx}`} animationName={thisCardAnimation} delay={baseDelay} speed={statsSurfaceSpeed} disabled={editor} style={{ ...(statsVariant.cardWrap ? statsVariant.cardWrap(idx) : {}), height: props.equalCardHeights === false ? undefined : "100%" }}>
            <div style={asStyleObject({
              ...statsVariant.card(idx),
              minHeight: props.equalCardHeights === false ? statsVariant.card(idx)?.minHeight : (props.statsCardHeight || statsVariant.card(idx)?.minHeight || (compact ? 210 : 240)),
              height: props.equalCardHeights === false ? statsVariant.card(idx)?.height : "100%",
              boxSizing: "border-box",
            })}>
              {statsVariant.accentBar ? <span aria-hidden="true" style={asStyleObject(statsVariant.accentBar)} /> : null}
              <p
                data-website-inline-editor="true"
                data-text-prop={`stats.${idx}.number`}
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => patchStat(idx, { number: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                style={asStyleObject({ ...(typeof statsVariant.number === "function" ? statsVariant.number(idx) : statsVariant.number), ...numberAnimationStyle })}
                dangerouslySetInnerHTML={{ __html: asRichHtml(stat.number || "0") }}
              />
              <p
                data-website-inline-editor="true"
                data-text-prop={`stats.${idx}.label`}
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => patchStat(idx, { label: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                style={asStyleObject({ ...statsVariant.label, ...labelAnimationStyle })}
                dangerouslySetInnerHTML={{ __html: asRichHtml(stat.label || "Metric") }}
              />
              {(stat.detail || editor) ? (
                <p
                  data-website-inline-editor="true"
                  data-text-prop={`stats.${idx}.detail`}
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => patchStat(idx, { detail: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                  style={asStyleObject({ ...statsVariant.detail, ...detailAnimationStyle })}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(stat.detail || "Proof that your website is built to attract attention, capture leads and support real business growth.") }}
                />
              ) : null}
            </div>
          </ScrollReveal>
        );
      };

      const _statsCardsJsx = statsVariant.cardsShell ? (
        <div style={asStyleObject(statsVariant.cardsShell)}>
          <div style={asStyleObject(statsVariant.grid)}>
            {statsItems.map(_renderStatItem)}
          </div>
        </div>
      ) : (
        <div style={asStyleObject(statsVariant.grid)}>
          {statsItems.map(_renderStatItem)}
        </div>
      );

      return (
        <ScrollReveal as="section" animationName={props.sectionAnimation || "fade-up"} delay={props.sectionAnimationDelay || 0.06} speed={props.sectionAnimationSpeed} disabled={editor} style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), ...statsVariant.section }}>
          <div style={sectionContentStyle(props, compact, statsContentWidth)}>
            {statsIsDataRibbon ? (
              <StatsSplitResizer
                editor={editor}
                pct={statsLeftColPct}
                gap={compact ? 18 : 28}
                onResize={(v) => typeof onChangeBlock === "function" && onChangeBlock({ ...props, statsLeftColPct: v })}
              >
                {_statsHeaderJsx}
                {_statsCardsJsx}
              </StatsSplitResizer>
            ) : (
              <div style={asStyleObject(statsVariant.shell)}>
                {_statsHeaderJsx}
                {_statsCardsJsx}
              </div>
            )}
          </div>
        </ScrollReveal>
      );

    case "team":
      const teamVariant = teamVariantStyles(props, compact);
      const normalizedMembers = asArray(props.members).map((rawMember, idx) => normalizeTeamMember(rawMember, idx));
      const isHierarchyLayout = String(props.teamVariant || "studio-cards") === "hierarchy-layout";

      const patchTeamMember = (memberIdx, patch) => {
        if (!editor || typeof onChangeBlock !== "function") return;
        const nextMembers = normalizedMembers.map((m, i) => (i === memberIdx ? { ...m, ...patch } : m));
        onChangeBlock({ ...props, members: nextMembers });
      };

      const renderTeamCard = (member, memberIdx, animIdx) => {
        const memberImageSrc = getAssetFromLibrary(assets, member.imageAssetId)?.src || member.image;
        const editorOutline = editor ? "1px dashed rgba(14,165,233,0.35)" : "none";
        return (
          <ScrollReveal as="article" animationName="fade-up" delay={animIdx * 0.08} disabled={editor} style={{ ...teamVariant.card(animIdx) }}>
            {memberImageSrc ? (
              <img src={memberImageSrc} alt={member.name || "Team member"} style={{ ...teamVariant.image(animIdx), objectPosition: `${member.imageX}% ${member.imageY}%` }} />
            ) : (
              <div style={teamVariant.placeholder(animIdx)}>{editor ? "Upload image in sidebar" : ""}</div>
            )}
            <div>
              <p
                data-website-inline-editor="true"
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => patchTeamMember(memberIdx, { name: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                style={{ ...teamVariant.name, outline: editorOutline, borderRadius: 4, padding: editor ? "2px 4px" : 0 }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(member.name || "Team Member") }}
              />
              <p
                data-website-inline-editor="true"
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => patchTeamMember(memberIdx, { role: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                style={{ ...teamVariant.role, outline: editorOutline, borderRadius: 4, padding: editor ? "2px 4px" : 0 }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(member.role || "") }}
              />
              {(member.bio || editor) ? (
                <p
                  data-website-inline-editor="true"
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => patchTeamMember(memberIdx, { bio: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                  style={{ ...teamVariant.bio, outline: editorOutline, borderRadius: 4, padding: editor ? "2px 4px" : 0 }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(member.bio || "") }}
                />
              ) : null}
            </div>
          </ScrollReveal>
        );
      };

      return (
        <ScrollReveal as="section" animationName={props.sectionAnimation || "fade-up"} delay={props.sectionAnimationDelay || 0.06} speed={props.sectionAnimationSpeed} disabled={editor} style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), ...teamVariant.section }}>
          <div style={sectionContentStyle(props, compact)}>
          <div style={asStyleObject(teamVariant.header)}>
            <h2
              data-website-inline-editor="true"
              data-text-prop="title"
              contentEditable={editor}
              suppressContentEditableWarning
              onBlur={(event) => {
                if (!editor || typeof onChangeBlock !== "function") return;
                onChangeBlock({ ...props, title: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
              }}
              style={{ ...sharedStyles.sectionTitle(compact), ...headingTypography(props), color: props.textColor || undefined, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0 }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || "Team") }}
            />
            {props.subtitle || editor ? (
              <div
                data-website-inline-editor="true"
                data-text-prop="subtitle"
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => {
                  if (!editor || typeof onChangeBlock !== "function") return;
                  onChangeBlock({ ...props, subtitle: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
                }}
                style={{ ...sharedStyles.sectionSub, ...bodyTypography(props), color: props.subtleTextColor || (String(props.teamVariant || "studio-cards") === "spotlight-strip" ? "rgba(226,232,240,0.82)" : "#64748b"), outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0 }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(props.subtitle || "") }}
              />
            ) : null}
          </div>
          {isHierarchyLayout ? (
            <div style={asStyleObject(teamVariant.rowsContainer)}>
              {buildTeamHierarchyRows(normalizedMembers, props.teamRows).map((rowMembers, rowIndex, rows) => (
                <React.Fragment key={`team-row-${rowIndex}`}>
                  <div style={asStyleObject(teamVariant.row(rowMembers.length, rowIndex))}>
                    {rowMembers.map((member, memberIndex) => {
                      const overallIndex = normalizedMembers.findIndex((entry) => entry.id === member.id);
                      return (
                        <div key={`${member.id}-${rowIndex}-${memberIndex}`} style={asStyleObject(teamVariant.cardWrap(overallIndex))}>
                          {renderTeamCard(member, overallIndex, overallIndex)}
                        </div>
                      );
                    })}
                  </div>
                  {rowIndex < rows.length - 1 ? renderHierarchyConnector(rowMembers.length, rows[rowIndex + 1]?.length || 0, teamVariant.connectorColor, compact) : null}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div style={asStyleObject(teamVariant.grid)}>
              {normalizedMembers.map((member, idx) => (
                <div key={`${member.id}-${idx}`} style={asStyleObject(teamVariant.cardWrap(idx))}>
                  {renderTeamCard(member, idx, idx)}
                </div>
              ))}
            </div>
          )}
          </div>
        </ScrollReveal>
      );

    case "newsletter": {
      const nlVariant = props.newsletterVariant || "centered";
      const nlBg = props.backgroundColor;
      const nlTextColor = props.textColor || "#0f172a";
      const nlBtnBg = props.buttonColor || "#2563eb";
      const nlBtnText = props.buttonTextColor || "#ffffff";
      const nlBtnRadius = Number.isFinite(Number(props.buttonRadius)) ? Number(props.buttonRadius) : 999;
      const nlButtonHref = resolveNewsletterButtonUrl(props.buttonLink || "");

      // shared inline-edit style helper
      const inlineStyle = (base) => ({
        ...base,
        outline: editor ? "1px dashed rgba(14,165,233,0.4)" : "none",
        borderRadius: 8,
        padding: editor ? "4px 6px" : 0,
      });

      const patchNl = (patch) => {
        if (!editor || typeof onChangeBlock !== "function") return;
        onChangeBlock({ ...props, ...patch });
      };

      const newsletterButtonShellStyle = {
        background: nlBtnBg,
        color: nlBtnText,
        border: "none",
        borderRadius: nlBtnRadius,
        padding: compact ? "10px 18px" : "13px 24px",
        fontWeight: 600,
        fontSize: compact ? 14 : 16,
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
      };

      const renderEditableNewsletterButtonLabel = () => (
        <div style={{ ...newsletterButtonShellStyle, cursor: "text" }}>
          <div
            data-website-inline-editor="true"
            data-text-prop="buttonText"
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
            onBlur={(e) => patchNl({ buttonText: htmlToPlainText(cleanInlineEditorHtml(e.currentTarget.innerHTML)) })}
            style={{
              outline: "1px dashed rgba(255,255,255,0.45)",
              borderRadius: 6,
              padding: "2px 4px",
              minWidth: 36,
              whiteSpace: "pre-wrap",
            }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(props.buttonText || "Subscribe") }}
          />
        </div>
      );

      const renderStaticNewsletterButton = () => (
        nlButtonHref ? (
          <a href={nlButtonHref} style={asStyleObject(newsletterButtonShellStyle)}>
            {props.buttonText || "Subscribe"}
          </a>
        ) : (
          <button type="button" style={{ ...newsletterButtonShellStyle, cursor: "default" }}>
            {props.buttonText || "Subscribe"}
          </button>
        )
      );

      const renderEmailRow = () => (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16, alignItems: "stretch" }}>
          {editor ? (
            <div style={{ ...sharedStyles.inputShell, flex: 1, minWidth: 180, display: "flex", alignItems: "center", paddingLeft: 14, color: "#94a3b8", fontSize: 16 }}>
              Email address field
            </div>
          ) : (
            <input
            
              type="email"
              name="email"
              placeholder="Email address"
              style={{ ...sharedStyles.inputShell, flex: 1, minWidth: 180, padding: "0 14px", color: "#0f172a", fontSize: 16, font: "inherit" }}
            />
          )}
          {editor ? renderEditableNewsletterButtonLabel() : renderStaticNewsletterButton()}
        </div>
      );

      // VARIANT: centered
      if (nlVariant === "centered") {
        return (
          <ScrollReveal as="section" animationName={props.sectionAnimation || "fade-up"} delay={props.sectionAnimationDelay || 0.06} speed={props.sectionAnimationSpeed} disabled={editor} style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), background: nlBg || "linear-gradient(165deg,#f8fafc,#ffffff)", textAlign: "center" }}>
            <div style={sectionContentStyle(props, compact)}>
            <h2
              contentEditable={editor} suppressContentEditableWarning
              onBlur={(e) => patchNl({ title: cleanInlineEditorHtml(e.currentTarget.innerHTML) })}
              style={inlineStyle({ ...sharedStyles.sectionTitle(compact), ...headingTypography(props), color: nlTextColor })}
              dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || (editor ? "Stay in the loop" : "")) }}
            />
            <p
              contentEditable={editor} suppressContentEditableWarning
              onBlur={(e) => patchNl({ subtitle: cleanInlineEditorHtml(e.currentTarget.innerHTML) })}
              style={inlineStyle({ ...sharedStyles.sectionSub, ...bodyTypography(props), color: nlTextColor, opacity: 0.8 })}
              dangerouslySetInnerHTML={{ __html: asRichHtml(props.subtitle || (editor ? "Get the latest updates delivered to your inbox." : "")) }}
            />
            {renderEmailRow()}
            </div>
          </ScrollReveal>
        );
      }

      // VARIANT: dark-banner
      if (nlVariant === "dark-banner") {
        return (
          <ScrollReveal as="section" animationName={props.sectionAnimation || "fade-up"} delay={props.sectionAnimationDelay || 0.06} speed={props.sectionAnimationSpeed} disabled={editor} style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), background: nlBg || "linear-gradient(135deg,#0f172a,#1e3a5f)" }}>
            <div style={sectionContentStyle(props, compact)}>
            <h2
              contentEditable={editor} suppressContentEditableWarning
              onBlur={(e) => patchNl({ title: cleanInlineEditorHtml(e.currentTarget.innerHTML) })}
              style={inlineStyle({ ...sharedStyles.sectionTitle(compact), ...headingTypography(props), color: props.textColor || "#f8fafc" })}
              dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || (editor ? "Join our newsletter" : "")) }}
            />
            <p
              contentEditable={editor} suppressContentEditableWarning
              onBlur={(e) => patchNl({ subtitle: cleanInlineEditorHtml(e.currentTarget.innerHTML) })}
              style={inlineStyle({ ...sharedStyles.sectionSub, color: "rgba(248,250,252,0.72)", marginTop: 6 })}
              dangerouslySetInnerHTML={{ __html: asRichHtml(props.subtitle || (editor ? "No spam, unsubscribe anytime." : "")) }}
            />
            {renderEmailRow()}
            </div>
          </ScrollReveal>
        );
      }

      // VARIANT: split
      if (nlVariant === "split") {
        return (
          <ScrollReveal as="section" animationName={props.sectionAnimation || "fade-up"} delay={props.sectionAnimationDelay || 0.06} speed={props.sectionAnimationSpeed} disabled={editor} style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), background: nlBg || "#ffffff" }}>
            <div style={sectionContentStyle(props, compact)}>
            <div style={{ display: compact ? "grid" : "flex", gap: 24, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <h2
                  contentEditable={editor} suppressContentEditableWarning
                  onBlur={(e) => patchNl({ title: cleanInlineEditorHtml(e.currentTarget.innerHTML) })}
                  style={inlineStyle({ ...sharedStyles.sectionTitle(compact), ...headingTypography(props), color: nlTextColor })}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || (editor ? "Get updates" : "")) }}
                />
                <p
                  contentEditable={editor} suppressContentEditableWarning
                  onBlur={(e) => patchNl({ subtitle: cleanInlineEditorHtml(e.currentTarget.innerHTML) })}
                  style={inlineStyle({ ...sharedStyles.sectionSub, ...bodyTypography(props), color: nlTextColor, opacity: 0.75 })}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(props.subtitle || (editor ? "Delivered every week." : "")) }}
                />
              </div>
              <div style={{ flex: "1 1 300px", display: "flex", gap: 10, alignItems: "stretch" }}>
                <div style={{ ...sharedStyles.inputShell, flex: 1, display: "flex", alignItems: "center", paddingLeft: 14, color: "#94a3b8", fontSize: 16 }}>
                  {editor ? "Email address field" : ""}
                </div>
                {editor ? renderEditableNewsletterButtonLabel() : renderStaticNewsletterButton()}
              </div>
            </div>
            </div>
          </ScrollReveal>
        );
      }

      // VARIANT: card-highlight
      return (
        <ScrollReveal as="section" animationName={props.sectionAnimation || "fade-up"} delay={props.sectionAnimationDelay || 0.06} speed={props.sectionAnimationSpeed} disabled={editor} style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), background: nlBg || "linear-gradient(135deg,#eff6ff,#dbeafe)" }}>
          <div style={sectionContentStyle(props, compact)}>
          <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
            <div style={{ fontSize: compact ? 28 : 40, marginBottom: 8 }}>{props.icon || "✉️"}</div>
            <h2
              contentEditable={editor} suppressContentEditableWarning
              onBlur={(e) => patchNl({ title: cleanInlineEditorHtml(e.currentTarget.innerHTML) })}
              style={inlineStyle({ ...sharedStyles.sectionTitle(compact), ...headingTypography(props), color: nlTextColor })}
              dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || (editor ? "Never miss an update" : "")) }}
            />
            <p
              contentEditable={editor} suppressContentEditableWarning
              onBlur={(e) => patchNl({ subtitle: cleanInlineEditorHtml(e.currentTarget.innerHTML) })}
              style={inlineStyle({ ...sharedStyles.sectionSub, ...bodyTypography(props), color: nlTextColor, opacity: 0.75, marginBottom: 8 })}
              dangerouslySetInnerHTML={{ __html: asRichHtml(props.subtitle || (editor ? "Join thousands of subscribers." : "")) }}
            />
            {renderEmailRow()}
            {(props.privacyText || editor) ? (
              <p
                contentEditable={editor} suppressContentEditableWarning
                onBlur={(e) => patchNl({ privacyText: cleanInlineEditorHtml(e.currentTarget.innerHTML) })}
                style={inlineStyle({ margin: "10px 0 0", fontSize: 16, color: nlTextColor, opacity: 0.55 })}
                dangerouslySetInnerHTML={{ __html: asRichHtml(props.privacyText || (editor ? "No spam. Unsubscribe anytime." : "")) }}
              />
            ) : null}
          </div>
          </div>
        </ScrollReveal>
      );
    }

    case "trust-badges":
      const trustBadgeBackgroundImage = resolveAssetField(props, "backgroundImage", assets);
      const trustBadgeSty = trustBadgeVariantStyles(props, compact, trustBadgeBackgroundImage);
      return (
        <ScrollReveal as="section" animationName={props.sectionAnimation || "fade-up"} delay={props.sectionAnimationDelay || 0.06} speed={props.sectionAnimationSpeed} disabled={editor} style={{ ...trustBadgeSty.section, ...fullWidthStyle(props, compact, editor) }}>
          <div style={sectionContentStyle(props, compact)}>
          <div style={asStyleObject(trustBadgeSty.row)}>
            {asArray(props.badges).map((badge, idx) => (
              <ScrollReveal key={`${badge.label}-${idx}`} animationName="fade-up" delay={idx * 0.05} disabled={editor} style={asStyleObject(trustBadgeSty.badge)}>
                <span style={asStyleObject(trustBadgeSty.icon)}>{badge.icon || "✓"}</span>
                <span style={{ fontSize: trustBadgeSty.badge?.fontSize ?? "inherit" }}>{badge.label || "Badge"}</span>
              </ScrollReveal>
            ))}
          </div>
          </div>
        </ScrollReveal>
      );

    case "marquee-strip": {
      const items = asArray(props.items).filter(Boolean);
      const repeated = [...items, ...items];
      const speed = Math.max(10, Number(props.speed) || 24);
      const marqueeFontSize = Math.max(10, Number(props.fontSize || 12));
      const marqueeStrokeWidth = Math.max(0, Number(props.textStrokeWidth || 0));
      const dividerSize = Math.max(8, Number(props.dividerSize || (compact ? 12 : 14)));
      const stripPaddingTop = Math.max(0, Number(props.paddingTop ?? (compact ? 12 : 16)));
      const stripPaddingBottom = Math.max(0, Number(props.paddingBottom ?? (compact ? 12 : 16)));
      const itemPaddingX = Math.max(0, Number(props.itemPaddingX ?? (compact ? 10 : 14)));
      const marqueeLineHeight = Math.max(1, Number(props.lineHeight) || 1.08);
      const marqueeMarginTop = Math.max(0, Number(props.marginTop ?? 0));
      const marqueeMarginBottom = Math.max(0, Number(props.marginBottom ?? 0));
      const marqueeAngle = Math.max(-45, Math.min(45, Number(props.angle ?? props.rotation ?? 0) || 0));
      const hasMarqueeAngle = Math.abs(marqueeAngle) > 0.1;
      const angledOuterPad = hasMarqueeAngle ? Math.ceil(Math.abs(marqueeAngle) * (compact ? 2.4 : 3.2)) : 0;
      const bg = props.backgroundColor || "#081120";
      const text = props.textColor || "#f8fafc";
      const fill = props.textFillColor || text;
      const stroke = props.textStrokeColor || "transparent";
      const textTransform = String(props.textTransform || "uppercase");
      const marqueeDirection = String(props.direction || "left");
      const marqueeFontWeight = String(props.fontWeight || "800");
      const marqueeFontStyle = String(props.fontStyle || "normal");
      const marqueeTextDecoration = String(props.textDecoration || "none");
      const dividerText = String(props.dividerText || "✦").trim() || "✦";
      const accent = props.accentColor || "#7dd3fc";

      return (
        <section
          data-marquee-shell="true"
          style={{
            ...fullWidthStyle(props, compact, editor),
            ...sectionAnimationStyle,
            position: "relative",
            display: "block",
            background: hasMarqueeAngle ? "transparent" : bg,
            color: text,
            overflow: hasMarqueeAngle ? "visible" : "hidden",
            fontSize: `${marqueeFontSize}px`,
            borderTop: "none",
            borderBottom: "none",
            borderRadius: 0,
            padding: hasMarqueeAngle ? `${angledOuterPad}px 0` : `${stripPaddingTop}px 0 ${stripPaddingBottom}px`,
            marginTop: marqueeMarginTop,
            marginBottom: marqueeMarginBottom,
            boxShadow: "none",
            isolation: "isolate",
          }}
        >
          {editor ? (
            <div style={{ position: "absolute", top: 8, right: compact ? 10 : 14, zIndex: 2, display: "flex", justifyContent: "flex-end", gap: 6, flexWrap: "wrap" }}>
              <button type="button" onClick={() => onChangeBlock?.({ ...props, fontSize: Math.max(10, Number(props.fontSize || 12) - 1) })} style={sharedStyles.editorChip}>A-</button>
              <button type="button" onClick={() => onChangeBlock?.({ ...props, fontSize: Math.min(40, Number(props.fontSize || 12) + 1) })} style={sharedStyles.editorChip}>A+</button>
            </div>
          ) : null}
          <div
            style={{
              width: hasMarqueeAngle ? "120%" : "100%",
              marginLeft: hasMarqueeAngle ? "-10%" : 0,
              overflow: "hidden",
              background: bg,
              color: text,
              padding: hasMarqueeAngle ? `${stripPaddingTop}px 0 ${stripPaddingBottom}px` : 0,
              transform: hasMarqueeAngle ? `rotate(${marqueeAngle}deg)` : undefined,
              transformOrigin: "center center",
              boxSizing: "border-box",
            }}
          >
            <div
              data-marquee-track="true"
              style={{
                display: "flex",
                alignItems: "center",
                gap: compact ? 18 : 26,
                width: "max-content",
                minWidth: "100%",
                animation: `wbMarquee ${speed}s linear infinite`,
                animationDirection: marqueeDirection === "right" ? "reverse" : "normal",
                willChange: "transform",
                backfaceVisibility: "hidden",
              }}
            >
              {repeated.map((item, idx) => {
                // Normalize: plain string → { text: item }, object stays as-is
                const norm = item && typeof item === "object" ? item : { text: String(item || "") };
                const itemText = norm.text || "";
                const itemIconKey = norm.iconKey || null;
                const iconSize = Math.round(marqueeFontSize * 1.35);
                const isOriginal = idx < items.length;
                const itemKey = `${itemIconKey || ""}:${itemText}-${idx}`;
                const textContent = itemText ? asRichHtml(itemText) : null;
                return (
                <div
                  key={itemKey}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: compact ? 10 : 14,
                    paddingLeft: itemPaddingX,
                    whiteSpace: "nowrap",
                    textTransform,
                    letterSpacing: "0.18em",
                    fontSize: `${compact ? Math.max(10, marqueeFontSize - 1) : marqueeFontSize}px`,
                    lineHeight: marqueeLineHeight,
                    fontWeight: marqueeFontWeight,
                    fontStyle: marqueeFontStyle,
                    textDecoration: marqueeTextDecoration,
                    minHeight: `${Math.ceil((compact ? Math.max(10, marqueeFontSize - 1) : marqueeFontSize) * marqueeLineHeight)}px`,
                    opacity: 0.98,
                  }}
                >
                  <span style={{ color: accent, fontSize: dividerSize, lineHeight: 1, display: "inline-flex", alignItems: "center" }}>{dividerText}</span>
                  {itemIconKey && (
                    <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, color: fill }}>
                      {renderGridLibraryIcon(itemIconKey, { size: iconSize })}
                    </span>
                  )}
                  {textContent && (
                  <span
                    data-website-inline-editor={editor ? "true" : undefined}
                    data-text-prop={editor && isOriginal
                      ? (item && typeof item === "object" ? `items.${idx}.text` : `items.${idx}`)
                      : undefined}
                    contentEditable={editor && isOriginal}
                    suppressContentEditableWarning
                    onFocus={(event) => {
                      const shell = event.currentTarget.closest?.('[data-marquee-shell="true"]');
                      const track = shell?.querySelector?.('[data-marquee-track="true"]');
                      if (track?.style) track.style.animationPlayState = "paused";
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      const shell = event.currentTarget.closest?.('[data-marquee-shell="true"]');
                      const track = shell?.querySelector?.('[data-marquee-track="true"]');
                      if (track?.style) track.style.animationPlayState = "paused";
                    }}
                    onBlur={(event) => {
                      const shell = event.currentTarget.closest?.('[data-marquee-shell="true"]');
                      const track = shell?.querySelector?.('[data-marquee-track="true"]');
                      if (track?.style) track.style.animationPlayState = "running";
                      if (shouldSkipToolbarBlur(event)) return;
                      if (!editor || typeof onChangeBlock !== "function" || !isOriginal) return;
                      const nextItems = items.map((entry, entryIdx) => {
                        if (entryIdx !== idx) return entry;
                        const newText = cleanInlineEditorHtml(event.currentTarget.innerHTML);
                        return entry && typeof entry === "object" ? { ...entry, text: newText } : newText;
                      });
                      onChangeBlock({ ...props, items: nextItems });
                    }}
                    style={{
                      outline: editor && isOriginal ? "1px dashed rgba(125,211,252,0.35)" : "none",
                      borderRadius: 6,
                      padding: editor && isOriginal ? "2px 4px" : 0,
                      color: fill,
                      WebkitTextFillColor: fill,
                      WebkitTextStroke: marqueeStrokeWidth > 0 ? `${marqueeStrokeWidth}px ${stroke}` : undefined,
                      textShadow: marqueeStrokeWidth > 0 && stroke !== "transparent"
                        ? `0 0 1px ${stroke}, 0 0 1px ${stroke}`
                        : undefined,
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: `${compact ? Math.max(10, marqueeFontSize - 1) : marqueeFontSize}px`,
                      lineHeight: marqueeLineHeight,
                      fontWeight: marqueeFontWeight,
                      fontStyle: marqueeFontStyle,
                      textDecoration: marqueeTextDecoration,
                    }}
                    dangerouslySetInnerHTML={{ __html: textContent }}
                  />
                  )}
                </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    case "wave-marquee": {
      const waveNumber = (value, fallback) => {
        const parsed = Number.parseFloat(String(value ?? ""));
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      const waveText = String(props.text || "FULL SERVICE MARKETING AGENCY").trim() || "FULL SERVICE MARKETING AGENCY";
      const separator = String(props.separator ?? " * ");
      const repeatCount = Math.max(2, Math.min(10, waveNumber(props.repeatCount, 4)));
      const speed = Math.max(8, Math.min(120, waveNumber(props.speed, 22)));
      const waveHeight = Math.max(90, Math.min(420, waveNumber(props.height, 190)));
      const amplitude = Math.max(0, Math.min(waveHeight / 2 - 10, waveNumber(props.amplitude, 42)));
      const segmentWidth = Math.max(360, Math.min(1800, waveNumber(props.wavelength, 640)));
      const midY = Math.round(waveHeight / 2);
      const pathSegmentCount = Math.max(4, Math.ceil(2800 / segmentWidth) + 2);
      const pathWidth = segmentWidth * pathSegmentCount;
      const wavePath = Array.from({ length: pathSegmentCount }, (_, segmentIndex) => {
        const x = segmentIndex * segmentWidth;
        const command = segmentIndex === 0 ? `M ${x} ${midY}` : "";
        return `${command} C ${x + segmentWidth * 0.2} ${midY - amplitude}, ${x + segmentWidth * 0.3} ${midY - amplitude}, ${x + segmentWidth * 0.5} ${midY} C ${x + segmentWidth * 0.7} ${midY + amplitude}, ${x + segmentWidth * 0.8} ${midY + amplitude}, ${x + segmentWidth} ${midY}`;
      }).join(" ");
      const phrase = Array.from({ length: repeatCount * pathSegmentCount * 2 }, () => waveText).join(separator);
      const safeIdBase = String(block?.id || props.id || "wave-marquee").replace(/[^a-zA-Z0-9_-]/g, "");
      const pathId = `${safeIdBase || "wave-marquee"}-flow-path`;
      const color = props.textColor || "#00a99d";
      const backgroundColor = props.backgroundColor || "#000000";
      const fontSize = Math.max(10, Math.min(96, waveNumber(props.fontSize, 22)));
      const fontWeight = String(props.fontWeight || "900");
      const letterSpacing = Math.max(0, Math.min(12, waveNumber(props.letterSpacing, 2.6)));
      const direction = String(props.direction || "left");
      const textOffsetFrom = direction === "right" ? -segmentWidth : 0;
      const textOffsetTo = direction === "right" ? 0 : -segmentWidth;
      const angle = Math.max(-20, Math.min(20, waveNumber(props.angle, 0)));
      const textTransform = String(props.textTransform || "uppercase");

      return (
        <section
          style={{
            ...fullWidthStyle(props, compact, editor),
            ...sectionAnimationStyle,
            position: "relative",
            overflow: "hidden",
            height: waveHeight,
            minHeight: waveHeight,
            background: backgroundColor,
            color,
            display: "flex",
            alignItems: "center",
            boxSizing: "border-box",
            isolation: "isolate",
          }}
        >
          {editor ? (
            <div style={{ position: "absolute", top: 8, right: 12, zIndex: 3, display: "flex", gap: 6 }}>
              <button type="button" onClick={() => onChangeBlock?.({ ...props, fontSize: Math.max(10, fontSize - 1) })} style={sharedStyles.editorChip}>A-</button>
              <button type="button" onClick={() => onChangeBlock?.({ ...props, fontSize: Math.min(96, fontSize + 1) })} style={sharedStyles.editorChip}>A+</button>
            </div>
          ) : null}
          <div
            style={{
              width: "115%",
              marginLeft: "-7.5%",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pathWidth}px`,
                height: waveHeight,
                position: "relative",
                left: "50%",
                transform: `translateX(-50%)${angle ? ` rotate(${angle}deg)` : ""}`,
                transformOrigin: "center center",
              }}
            >
              <svg
                width={pathWidth}
                height={waveHeight}
                viewBox={`0 0 ${pathWidth} ${waveHeight}`}
                aria-hidden="true"
                focusable="false"
                style={{ display: "block", width: `${pathWidth}px`, height: `${waveHeight}px`, overflow: "visible" }}
              >
                <defs>
                  <path id={pathId} d={wavePath} />
                </defs>
                <text
                  fill={color}
                  fontSize={compact ? Math.max(10, fontSize - 4) : fontSize}
                  fontWeight={fontWeight}
                  fontFamily={props.fontFamily || "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"}
                  letterSpacing={letterSpacing}
                  textTransform={textTransform}
                  dominantBaseline="middle"
                >
                  <textPath href={`#${pathId}`} startOffset={textOffsetFrom}>
                    <animate
                      attributeName="startOffset"
                      from={textOffsetFrom}
                      to={textOffsetTo}
                      dur={`${speed}s`}
                      repeatCount="indefinite"
                    />
                    {phrase}
                  </textPath>
                </text>
              </svg>
            </div>
          </div>
        </section>
      );
    }

    case "divider": {
      const legacyStyle = String(props.style || "").toLowerCase();
      const dividerType = String(props.dividerType || (legacyStyle === "dots" ? "decorative" : "line")).toLowerCase();
      const lineStyle = String(props.lineStyle || (legacyStyle === "dashes" ? "dashed" : legacyStyle === "dots" ? "dotted" : "solid")).toLowerCase();
      const thickness = Math.max(1, Math.min(24, Number(props.thickness || 1)));
      const widthPct = Math.max(5, Math.min(100, Number(props.width || 100)));
      const alignment = ["left", "center", "right"].includes(String(props.alignment)) ? String(props.alignment) : "center";
      const lineColor = props.color || "#cbd5e1";
      const secondaryColor = props.secondaryColor || lineColor;
      const paddingTop = Math.max(0, Math.min(240, Number(props.paddingTop ?? 24)));
      const paddingBottom = Math.max(0, Math.min(240, Number(props.paddingBottom ?? 24)));
      const justifyContent = alignment === "left" ? "flex-start" : alignment === "right" ? "flex-end" : "center";
      const label = String(props.label || "").trim();
      const showLabel = !!props.showLabel && label;
      const lineBase = {
        display: "block",
        width: `${widthPct}%`,
        maxWidth: "100%",
        minWidth: 24,
        boxSizing: "border-box",
      };
      const lineVisual = dividerType === "gradient"
        ? {
            ...lineBase,
            height: thickness,
            borderRadius: 999,
            background: `linear-gradient(90deg, transparent, ${lineColor}, ${secondaryColor}, transparent)`,
          }
        : dividerType === "decorative"
          ? {
              ...lineBase,
              height: thickness,
              borderRadius: 999,
              backgroundImage: `radial-gradient(circle, ${lineColor} ${Math.max(1, Math.ceil(thickness / 2))}px, transparent ${Math.max(2, Math.ceil(thickness / 2) + 1)}px)`,
              backgroundSize: `${Math.max(10, thickness * 5)}px ${Math.max(4, thickness)}px`,
              backgroundRepeat: "repeat-x",
              backgroundPosition: "center",
            }
          : {
              ...lineBase,
              borderTop: `${thickness}px ${lineStyle === "double" ? "double" : lineStyle === "dotted" ? "dotted" : lineStyle === "dashed" ? "dashed" : "solid"} ${lineColor}`,
            };

      return (
        <section
          style={{
            background: props.backgroundColor || "transparent",
            padding: `${paddingTop}px ${compact ? 0 : 32}px ${paddingBottom}px`,
            boxSizing: "border-box",
            ...fullWidthStyle(props, compact, editor),
          }}
        >
          <div style={{ ...sectionContentStyle(props, compact), display: "flex", justifyContent }}>
            {showLabel ? (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(24px, 1fr) auto minmax(24px, 1fr)", alignItems: "center", gap: 12, width: `${widthPct}%`, maxWidth: "100%" }}>
                <span style={{ ...lineVisual, width: "100%" }} />
                <span style={{ color: props.labelColor || "#64748b", fontSize: compact ? 12 : 14, fontWeight: 700, letterSpacing: 0, whiteSpace: "nowrap" }}>{label}</span>
                <span style={{ ...lineVisual, width: "100%" }} />
              </div>
            ) : (
              <span style={lineVisual} />
            )}
          </div>
        </section>
      );
    }

    case "space": {
      const spBg =
        props.backgroundStyle === "color"    ? (props.backgroundColor  || "transparent") :
        props.backgroundStyle === "gradient" ? (props.backgroundGradient || "transparent") :
        props.backgroundStyle === "image" && props.backgroundImage
          ? undefined
          : "transparent";
      const spBgImage = props.backgroundStyle === "image" && props.backgroundImage
        ? `url(${JSON.stringify(props.backgroundImage)})`
        : undefined;
      return (
        <div
          style={{
            height: props.height || 40,
            width: "100%",
            ...fullWidthStyle(props, compact, editor),
            ...(spBg !== undefined ? { background: spBg } : {}),
            ...(spBgImage ? { backgroundImage: spBgImage, backgroundSize: props.backgroundSize || "cover", backgroundPosition: props.backgroundPosition || "center center", backgroundRepeat: "no-repeat" } : {}),
          }}
        />
      );
    }

    case "video-embed":
      return (
        <section style={{ ...sharedStyles.cardSection(compact, props), ...sectionAnimationStyle }}>
          <h2 style={{ ...sharedStyles.sectionTitle(compact), ...headingTypography(props) }}>{props.title || "Video"}</h2>
          <div style={asStyleObject(sharedStyles.videoShell)}>Video URL: {props.url || "Add video URL"}</div>
        </section>
      );

    case "footer": {
      const ftBg = props.backgroundColor || "#0f172a";
      const ftText = props.textColor || "#e2e8f0";
      const ftLink = props.linkColor || "#94a3b8";
      const ftBorder = props.borderColor || "rgba(148,163,184,0.2)";
      const ftBtnBg = props.newsletterButtonColor || "#2563eb";
      const ftBtnText = props.newsletterButtonTextColor || "#ffffff";
      const footerLogoSrc = brandLogoSrc;
      const footerMarkSize = Number(props.logoWidth) || 48;
      const navLinks = Array.isArray(props.navLinks) ? props.navLinks : [];
      const extraLinks = Array.isArray(props.extraLinks) ? props.extraLinks : [];
      const footerEmailHref = resolveFooterEmailHref(props.contactEmail);
      const footerPhoneHref = resolveFooterPhoneHref(props.contactPhone);
      const newsletterActionHref = resolveNewsletterButtonUrl(props.newsletterActionUrl || "");
      const newsletterFallbackHref = resolveFooterEmailHref(props.newsletterFallbackEmail || props.contactEmail || "");
      const newsletterUsesExternalForm = !!newsletterActionHref && !/^mailto:/i.test(newsletterActionHref);
      const newsletterFormMethod = String(props.newsletterSubmitMethod || "post").toLowerCase() === "get" ? "get" : "post";
      const footerVariant = String(props.footerVariant || "service-grid");
      const contactItems = [props.contactEmail, props.contactPhone, props.contactAddress].filter(Boolean);
      const derivedLinkGroups = [
        { heading: props.navHeading || "Navigate", links: navLinks },
        { heading: props.extraHeading || "Legal", links: extraLinks },
      ].filter((group) => Array.isArray(group.links) && group.links.length);
      const linkGroups = (Array.isArray(props.linkGroups) && props.linkGroups.length ? props.linkGroups : derivedLinkGroups)
        .map((group) => ({ heading: group?.heading || "Links", links: Array.isArray(group?.links) ? group.links : [] }))
        .filter((group) => group.links.length);
      const spotlightItems = Array.isArray(props.spotlightItems) ? props.spotlightItems.filter(Boolean) : [];
      const footerPanelBackground = footerVariant === "editorial"
        ? "rgba(255,255,255,0.04)"
        : footerVariant === "trust-columns"
          ? "rgba(15,23,42,0.24)"
          : "rgba(255,255,255,0.03)";
      const footerPanelBorder = `1px solid ${ftBorder}`;
      const topGridColumns = compact
        ? "1fr"
        : props.showNewsletter !== false
          ? "1.15fr 0.95fr 1fr 1.05fr"
          : "1.2fr 1fr 1fr";
      const panelStyle = {
        borderRadius: compact ? 18 : 24,
        padding: compact ? "18px" : "22px",
        background: footerPanelBackground,
        border: footerPanelBorder,
        backdropFilter: "blur(14px)",
        boxShadow: "0 22px 45px rgba(2,8,23,0.18)",
      };

      const patchFt = (patch) => {
        if (!editor || typeof onChangeBlock !== "function") return;
        onChangeBlock({ ...props, ...patch });
      };

      const inlineStyle = (base) => ({
        ...base,
        outline: editor ? "1px dashed rgba(14,165,233,0.4)" : "none",
        borderRadius: 6,
        padding: editor ? "2px 4px" : 0,
      });

      const handleFooterNewsletterSubmit = (event) => {
        if (editor) {
          event.preventDefault();
          return;
        }
        if (newsletterUsesExternalForm) return;

        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const subscriberEmail = String(formData.get("footer-newsletter-email") || "").trim();
        const mailtoHref = buildNewsletterMailtoHref(newsletterActionHref || newsletterFallbackHref, subscriberEmail, props.brand || "");
        if (mailtoHref && typeof window !== "undefined") {
          window.location.href = mailtoHref;
        }
      };

      return (
        <ScrollReveal as="footer" animationName={props.sectionAnimation || "fade-up"} delay={props.sectionAnimationDelay || 0.06} speed={props.sectionAnimationSpeed} disabled={editor} style={{ background: ftBg, color: ftText, padding: compact ? "32px 20px 16px" : "48px 32px 20px", boxSizing: "border-box", width: "100%", ...fullWidthStyle({ ...props, fullWidthBackground: props.fullWidthBackground !== false }, compact, editor) }}>
          <div style={sectionContentStyle(props, compact)}>
            <div style={{ display: "grid", gap: compact ? 18 : 24, marginBottom: compact ? 24 : 34 }}>
              {(props.brand || props.tagline || props.spotlightHeading || props.spotlightText) ? (
                <div style={{ display: "flex", flexDirection: compact ? "column" : "row", gap: compact ? 10 : 18, alignItems: compact ? "flex-start" : "end", justifyContent: "space-between" }}>
                  <div style={{ display: "grid", gap: 8, maxWidth: 720 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: colorWithAlpha(ftLink, 0.9) }}>{props.footerEyebrow || "Closing note"}</span>
                    <div style={{ display: "grid", gap: 6 }}>
                      <span contentEditable={editor} suppressContentEditableWarning onBlur={(e) => patchFt({ brand: e.currentTarget.textContent })} style={inlineStyle({ fontSize: compact ? 22 : 30, fontWeight: 600, color: ftText, lineHeight: 1.05 })}>{props.brand || (editor ? "Your Brand" : "")}</span>
                      {(props.tagline || editor) ? <span contentEditable={editor} suppressContentEditableWarning onBlur={(e) => patchFt({ tagline: e.currentTarget.textContent })} style={inlineStyle({ fontSize: compact ? 15 : 17, color: ftLink, lineHeight: 1.55, maxWidth: 640 })}>{props.tagline || (editor ? "Your tagline here." : "")}</span> : null}
                    </div>
                  </div>
                  {spotlightItems.length ? (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: compact ? "flex-start" : "flex-end" }}>
                      {spotlightItems.map((item, index) => (
                        <span key={`footer-pill-${index}`} style={{ display: "inline-flex", alignItems: "center", minHeight: 38, padding: "0 14px", borderRadius: 999, border: footerPanelBorder, background: footerVariant === "editorial" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)", color: ftText, fontSize: 16, fontWeight: 600 }}>{String(item)}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div style={{ display: "grid", gridTemplateColumns: topGridColumns, gap: compact ? 18 : 22, marginBottom: compact ? 24 : 36 }}>
                <div style={{ ...panelStyle, display: "flex", flexDirection: "column", gap: 14 }}>
                  <BrandMark brand={props.brand} logoSrc={footerLogoSrc} size={footerMarkSize} background={ftBtnBg} color={ftBtnText} borderColor={ftBorder} borderRadius={10} />
                  {(props.contactHeading || editor) ? <span contentEditable={editor} suppressContentEditableWarning onBlur={(e) => patchFt({ contactHeading: e.currentTarget.textContent })} style={inlineStyle({ fontSize: 16, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: colorWithAlpha(ftLink, 0.92) })}>{props.contactHeading || "Contact"}</span> : null}
                  {contactItems.length > 0 ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {(props.contactEmail || editor) ? <a href={editor ? undefined : (footerEmailHref || undefined)} contentEditable={editor} suppressContentEditableWarning onBlur={(e) => patchFt({ contactEmail: e.currentTarget.textContent })} style={{ ...inlineStyle({ fontSize: 16, color: ftText, lineHeight: 1.6, paddingBottom: 8, borderBottom: `1px solid ${ftBorder}` }), textDecoration: "none" }}>{props.contactEmail || (editor ? "hello@yourbrand.com" : "")}</a> : null}
                      {(props.contactPhone || editor) ? <a href={editor ? undefined : (footerPhoneHref || undefined)} contentEditable={editor} suppressContentEditableWarning onBlur={(e) => patchFt({ contactPhone: e.currentTarget.textContent })} style={{ ...inlineStyle({ fontSize: 16, color: ftText, lineHeight: 1.6, paddingBottom: 8, borderBottom: `1px solid ${ftBorder}` }), textDecoration: "none" }}>{props.contactPhone || (editor ? "(555) 010-2026" : "")}</a> : null}
                      {(props.contactAddress || editor) ? <span contentEditable={editor} suppressContentEditableWarning onBlur={(e) => patchFt({ contactAddress: e.currentTarget.textContent })} style={inlineStyle({ fontSize: 16, color: ftLink, lineHeight: 1.6 })}>{props.contactAddress || (editor ? "Your city, state" : "")}</span> : null}
                    </div>
                  ) : null}
                </div>

                {linkGroups.map((group, groupIndex) => (
                  <div key={`footer-group-${groupIndex}`} style={{ ...panelStyle, display: "flex", flexDirection: "column", gap: 10 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: colorWithAlpha(ftLink, 0.92) }}>{group.heading || "Links"}</span>
                    <div style={{ display: "grid", gap: 8 }}>
                      {group.links.map((link, i) => (
                        <a key={`${groupIndex}-${i}`} href={editor ? undefined : resolvePublishedNavHref(link, navigationContext)} style={{ color: ftText, fontSize: 16, textDecoration: "none", lineHeight: 1.45 }}>{link.label || "Link"}</a>
                      ))}
                    </div>
                    {groupIndex === 0 && (props.spotlightHeading || props.spotlightText || editor) ? (
                      <div style={{ display: "grid", gap: 6, marginTop: 8, paddingTop: 12, borderTop: footerPanelBorder }}>
                        {(props.spotlightHeading || editor) ? <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: colorWithAlpha(ftLink, 0.88) }}>{props.spotlightHeading || "Highlights"}</span> : null}
                        {(props.spotlightText || editor) ? <span style={{ fontSize: 16, lineHeight: 1.55, color: ftLink }}>{props.spotlightText || "Add a stronger closing note here."}</span> : null}
                      </div>
                    ) : null}
                  </div>
                ))}

                {props.showNewsletter !== false ? (
                  <div style={{ ...panelStyle, display: "flex", flexDirection: "column", gap: 10, background: footerVariant === "split-newsletter" ? `linear-gradient(180deg, ${colorWithAlpha(ftBtnBg, 0.22)} 0%, ${footerPanelBackground} 100%)` : panelStyle.background }}>
                    <span contentEditable={editor} suppressContentEditableWarning onBlur={(e) => patchFt({ newsletterHeading: e.currentTarget.textContent })} style={inlineStyle({ fontSize: compact ? 16 : 18, fontWeight: 600, color: ftText })}>{props.newsletterHeading || "Stay Updated"}</span>
                    {(props.newsletterSubtitle || editor) ? <span contentEditable={editor} suppressContentEditableWarning onBlur={(e) => patchFt({ newsletterSubtitle: e.currentTarget.textContent })} style={inlineStyle({ fontSize: 16, color: ftLink, lineHeight: 1.55 })}>{props.newsletterSubtitle || "Get the latest news."}</span> : null}
                    <form style={{ display: "grid", gap: 10, marginTop: 4 }} onSubmit={handleFooterNewsletterSubmit} action={editor || !newsletterUsesExternalForm ? undefined : newsletterActionHref} method={editor || !newsletterUsesExternalForm ? undefined : newsletterFormMethod}>
                      {editor ? <div style={{ flex: 1, minWidth: 140, borderRadius: 12, minHeight: 46, border: footerPanelBorder, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", paddingLeft: 12, color: ftLink, fontSize: 16 }}>Email address</div> : <input type="email" name="footer-newsletter-email" placeholder="Email address" required style={{ width: "100%", borderRadius: 12, minHeight: 46, border: footerPanelBorder, background: "rgba(255,255,255,0.08)", display: "block", padding: "0 12px", color: "#ffffff", fontSize: 16, font: "inherit", boxSizing: "border-box" }} />}
                      <button type={editor ? "button" : "submit"} style={{ background: ftBtnBg, color: ftBtnText, border: "none", borderRadius: 12, padding: "0 16px", minHeight: 46, fontWeight: 600, fontSize: 16, cursor: editor ? "default" : "pointer", whiteSpace: "nowrap", opacity: editor || newsletterUsesExternalForm || newsletterFallbackHref ? 1 : 0.65 }} contentEditable={editor} suppressContentEditableWarning onBlur={(e) => patchFt({ newsletterButtonText: e.currentTarget.textContent })}>{props.newsletterButtonText || "Subscribe"}</button>
                    </form>
                  </div>
                ) : null}
              </div>

              <div style={{ borderTop: `1px solid ${ftBorder}`, paddingTop: compact ? 14 : 18, display: "flex", alignItems: "center", justifyContent: compact ? "flex-start" : "space-between", gap: 14, flexWrap: "wrap" }}>
                <span contentEditable={editor} suppressContentEditableWarning onBlur={(e) => patchFt({ copyrightText: e.currentTarget.textContent })} style={inlineStyle({ fontSize: 16, color: ftLink })}>{props.copyrightText || (editor ? "© 2025 Your Brand. All rights reserved." : "")}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  {Array.isArray(extraLinks) && extraLinks.length ? extraLinks.map((link, index) => (
                    <a key={`footer-legal-${index}`} href={editor ? undefined : resolvePublishedNavHref(link, navigationContext)} style={{ color: ftLink, fontSize: 16, textDecoration: "none", letterSpacing: "0.04em", textTransform: "uppercase" }}>{link.label || "Link"}</a>
                  )) : null}
                  {spotlightItems.length ? <span style={{ fontSize: 16, color: colorWithAlpha(ftLink, 0.9) }}>{spotlightItems.slice(0, 2).join(" • ")}</span> : null}
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      );
    }

    case "icon-counter":
      return (
        <IconCounterBlock
          props={props}
          compact={compact}
          editor={editor}
          onChangeBlock={onChangeBlock}
          sectionAnimationStyle={sectionAnimationStyle}
          siteId={siteId}
        />
      );

    case "hover-cards":
      return <HoverCardsBlock props={props} compact={compact} editor={editor} onUploadImage={onUploadImage} onChangeBlock={onChangeBlock} navigationContext={navigationContext} />;

    case "template-showcase":
      return <TemplateShowcaseBlock props={props} compact={compact} editor={editor} navigationContext={navigationContext} />;

    case "framer-animated-portfolio":
      return <FramerPortfolioBlock props={props} compact={compact} editor={editor} onUploadImage={onUploadImage} onChangeBlock={onChangeBlock} />;

    case "chart": {
      const chartPlans = Array.isArray(props.plans) && props.plans.length > 0
        ? props.plans
        : [
            { id: "starter", name: "Starter", color: "#6366f1", individualPrice: 215, billingPrice: 159 },
            { id: "growth", name: "Growth", color: "#22c55e", individualPrice: 474, billingPrice: 359 },
            { id: "scale", name: "Scale", color: "#f59e0b", individualPrice: 913, billingPrice: 499 },
            { id: "professional", name: "Professional", color: "#7c3aed", individualPrice: 1883, billingPrice: 999 },
          ];
      const chartBg = props.backgroundColor || "#0f172a";
      const chartTextColor = props.textColor || "#f8fafc";
      const chartHeading = props.heading || "Stop Paying Full Price";
      const chartSubheading = props.subheading || "Every plan saves you real money — compared to buying each module separately";
      const chartAreaHeight = compact ? 150 : 300;
      const barW = compact ? 26 : 52;
      const barGapPx = compact ? 6 : 14;
      const maxPlanVal = Math.max(...chartPlans.map((p) => p.individualPrice || 0), 1);
      const dimText = colorWithAlpha(chartTextColor, 0.55);

      return (
        <section style={{ background: chartBg, padding: compact ? "36px 20px 32px" : "88px 40px 72px", overflow: "hidden" }}>
          <ScrollReveal>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>

              {/* Eyebrow + Heading */}
              <div style={{ textAlign: "center", marginBottom: compact ? 28 : 56 }}>
                <div style={{
                  display: "inline-block",
                  background: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(99,102,241,0.4)",
                  color: "#a5b4fc",
                  fontSize: compact ? 11 : 13,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  padding: "6px 18px",
                  borderRadius: 999,
                  textTransform: "uppercase",
                  marginBottom: compact ? 14 : 24,
                }}>
                  The Numbers Speak For Themselves
                </div>
                <h2 style={{
                  color: chartTextColor,
                  fontSize: compact ? 26 : 52,
                  fontWeight: 600,
                  margin: "0 0 16px",
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                }}>
                  {chartHeading}
                </h2>
                <p style={{ color: dimText, fontSize: compact ? 15 : 19, margin: "0 auto", maxWidth: 620, lineHeight: 1.65 }}>
                  {chartSubheading}
                </p>
              </div>

              {/* Annual savings — moved to top so it hits first */}
              {props.showAnnualSavings !== false && (
                <div style={{
                  background: "linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(124,58,237,0.09) 100%)",
                  border: "1px solid rgba(99,102,241,0.28)",
                  borderRadius: compact ? 14 : 24,
                  padding: compact ? "24px 20px" : "44px 48px",
                  textAlign: "center",
                  marginBottom: compact ? 28 : 48,
                }}>
                  <div style={{ color: "#a5b4fc", fontSize: compact ? 12 : 15, fontWeight: 600, marginBottom: compact ? 16 : 28, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Annual Savings By Plan
                  </div>
                  <div style={{ display: "flex", gap: compact ? 10 : 32, justifyContent: "center", flexWrap: "wrap", marginBottom: compact ? 20 : 32 }}>
                    {chartPlans.map((plan, idx) => {
                      const savings = (plan.individualPrice || 0) - (plan.billingPrice || 0);
                      const annual = savings * 12;
                      return (
                        <div key={plan.id || idx} style={{ textAlign: "center" }}>
                          <div style={{ color: plan.color, fontSize: compact ? 26 : 44, fontWeight: 600, lineHeight: 1, textShadow: `0 0 28px ${plan.color}65` }}>
                            ${annual.toLocaleString()}
                          </div>
                          <div style={{ color: dimText, fontSize: compact ? 12 : 16, marginTop: compact ? 4 : 8, fontWeight: 600 }}>{plan.name}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ color: colorWithAlpha(chartTextColor, 0.75), fontSize: compact ? 15 : 22, fontWeight: 600, lineHeight: 1.4 }}>
                    That&apos;s real money back where it belongs — your business.
                  </div>
                </div>
              )}

              {/* Big savings cards — the hero of this section */}
              <div style={{ display: "flex", gap: compact ? 10 : 18, marginBottom: compact ? 36 : 60, flexWrap: "wrap" }}>
                {chartPlans.map((plan, idx) => {
                  const savings = (plan.individualPrice || 0) - (plan.billingPrice || 0);
                  const pct = Math.round((savings / (plan.individualPrice || 1)) * 100);
                  return (
                    <div key={plan.id || idx} style={{
                      flex: "1 1 160px",
                      background: `linear-gradient(145deg, ${plan.color}20 0%, ${plan.color}09 100%)`,
                      border: `1px solid ${plan.color}50`,
                      borderRadius: compact ? 12 : 20,
                      padding: compact ? "18px 14px" : "32px 28px",
                      textAlign: "center",
                      position: "relative",
                      overflow: "hidden",
                    }}>
                      <div style={{
                        position: "absolute", top: -24, right: -24,
                        width: 90, height: 90, borderRadius: "50%",
                        background: plan.color, opacity: 0.15,
                        filter: "blur(28px)", pointerEvents: "none",
                      }} />
                      <div style={{ color: plan.color, fontSize: compact ? 11 : 14, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: compact ? 6 : 12 }}>
                        {plan.name}
                      </div>
                      <div style={{ color: plan.color, fontSize: compact ? 32 : 56, fontWeight: 600, lineHeight: 1, marginBottom: compact ? 4 : 8, textShadow: `0 0 32px ${plan.color}70` }}>
                        ${savings}
                      </div>
                      <div style={{ color: dimText, fontSize: compact ? 13 : 17, fontWeight: 500, marginBottom: compact ? 10 : 16 }}>
                        saved every month
                      </div>
                      <div style={{
                        display: "inline-block",
                        background: `${plan.color}28`,
                        color: plan.color,
                        fontSize: compact ? 12 : 15,
                        fontWeight: 600,
                        padding: compact ? "4px 12px" : "5px 14px",
                        borderRadius: 999,
                        border: `1px solid ${plan.color}40`,
                      }}>
                        {pct}% off
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bar chart — annual savings per plan */}
              <div style={{
                background: "rgba(255,255,255,0.03)",
                borderRadius: compact ? 14 : 24,
                padding: compact ? "20px 16px 0" : "36px 40px 0",
                border: "1px solid rgba(255,255,255,0.07)",
                marginBottom: compact ? 20 : 36,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: compact ? 16 : 28 }}>
                  <div style={{ color: colorWithAlpha(chartTextColor, 0.7), fontSize: compact ? 13 : 17, fontWeight: 600 }}>
                    Annual Savings by Plan
                  </div>
                  <div style={{ display: "flex", gap: compact ? 12 : 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 3, background: "linear-gradient(135deg,#6366f1,#22c55e)" }} />
                      <span style={{ color: dimText, fontSize: compact ? 12 : 15 }}>Annual savings</span>
                    </div>
                  </div>
                </div>
                {(() => {
                  const maxAnnual = Math.max(...chartPlans.map((p) => ((p.individualPrice || 0) - (p.billingPrice || 0)) * 12), 1);
                  return (
                    <div style={{ display: "flex", gap: compact ? 10 : 28, alignItems: "flex-end" }}>
                      {chartPlans.map((plan, idx) => {
                        const savings = (plan.individualPrice || 0) - (plan.billingPrice || 0);
                        const annual = savings * 12;
                        const barH = Math.max(Math.round((annual / maxAnnual) * chartAreaHeight), 6);
                        return (
                          <div key={plan.id || idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: compact ? 4 : 8, justifyContent: "flex-end" }}>
                              <span style={{ color: plan.color, fontSize: compact ? 11 : 15, fontWeight: 600, textShadow: `0 0 12px ${plan.color}55` }}>${annual.toLocaleString()}</span>
                              <div style={{ width: barW * 2 + barGapPx, height: barH, background: `linear-gradient(180deg, ${plan.color}cc 0%, ${plan.color} 100%)`, borderRadius: "6px 6px 0 0", boxShadow: `0 -6px 24px ${plan.color}55` }} />
                            </div>
                            <div style={{ textAlign: "center", marginTop: compact ? 10 : 18, paddingBottom: compact ? 14 : 24 }}>
                              <div style={{ color: colorWithAlpha(chartTextColor, 0.7), fontSize: compact ? 11 : 16, fontWeight: 600 }}>{plan.name}</div>
                              <div style={{ color: dimText, fontSize: compact ? 10 : 13, fontWeight: 500, marginTop: 2 }}>${plan.billingPrice}/mo</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

            </div>
          </ScrollReveal>
        </section>
      );
    }

    case "custom-html": {
      const htmlPadTop = Number(props.paddingTop ?? 0);
      const htmlPadBottom = Number(props.paddingBottom ?? 0);
      const htmlBg = props.backgroundColor || "transparent";
      return (
        <div style={{ background: htmlBg, paddingTop: htmlPadTop || undefined, paddingBottom: htmlPadBottom || undefined }}>
          <HtmlEmbedBlock html={props.html || ""} editor={editor} />
        </div>
      );
    }

    default:
      return (
        <article style={{ ...sharedStyles.cardSection(compact, props), ...sectionAnimationStyle }}>
          <h2 style={sharedStyles.sectionTitle(compact)}>{String(block?.type || "Block")}</h2>
          <p style={sharedStyles.bodyCopy}>This block preview will be expanded further.</p>
        </article>
      );

    case "competitor-comparison": {
      const ccRows = asArray(props.rows);
      const ccTotal = ccRows.reduce((s, r) => s + (r.price || 0), 0);
      const ccPlanPrice = Number(props.planPrice) || 299;
      const ccSavings = ccTotal - ccPlanPrice;
      const bg = props.backgroundColor || "#121c26";
      const grid3 = { display: "grid", gridTemplateColumns: "1fr 220px 160px", alignItems: "center" };

      function CCLogo({ domain, name, src }) {
        const imgSrc = src || (domain ? `https://logo.clearbit.com/${domain}` : null);
        if (!imgSrc) return null;
        return (
          <img
            src={imgSrc}
            alt={name}
            title={name}
            width={36}
            height={36}
            style={{ borderRadius: "50%", background: "#fff", objectFit: "contain", border: "1.5px solid rgba(255,255,255,0.18)", flexShrink: 0, width: 36, height: 36, minWidth: 36, minHeight: 36 }}
            onError={e => {
              if (!src && domain && !e.currentTarget.src.includes("google.com")) {
                e.currentTarget.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
              } else {
                e.currentTarget.style.display = "none";
              }
            }}
          />
        );
      }

      return (
        <div style={{ background: bg, color: "#fff", padding: "80px 32px", ...sectionAnimationStyle }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            {(editor || !!props.eyebrow) && (
              <p
                contentEditable={editor}
                suppressContentEditableWarning
                onMouseDown={editor ? (e) => e.stopPropagation() : undefined}
                onPointerDown={editor ? (e) => e.stopPropagation() : undefined}
                onBlur={(e) => { if (editor && typeof onChangeBlock === "function") onChangeBlock({ ...props, eyebrow: e.currentTarget.innerText.trim() }); }}
                onKeyDown={editor ? (e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } } : undefined}
                style={{ color: "#60a5fa", fontSize: 16, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", textAlign: "center", marginBottom: 12, outline: editor ? "1px dashed rgba(14,165,233,0.4)" : "none", padding: editor ? "2px 6px" : 0, borderRadius: 4, cursor: editor ? "text" : undefined }}
                dangerouslySetInnerHTML={{ __html: props.eyebrow || (editor ? "EYEBROW LABEL" : "") }}
              />
            )}
            <h2
              contentEditable={editor}
              suppressContentEditableWarning
              onMouseDown={editor ? (e) => e.stopPropagation() : undefined}
              onPointerDown={editor ? (e) => e.stopPropagation() : undefined}
              onBlur={(e) => { if (editor && typeof onChangeBlock === "function") onChangeBlock({ ...props, title: e.currentTarget.innerText.trim() }); }}
              onKeyDown={editor ? (e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } } : undefined}
              style={{ fontSize: 52, fontWeight: 600, textAlign: "center", marginBottom: 16, letterSpacing: "-0.02em", lineHeight: 1.15, outline: editor ? "1px dashed rgba(14,165,233,0.4)" : "none", padding: editor ? "2px 6px" : 0, borderRadius: 4, cursor: editor ? "text" : undefined }}
              dangerouslySetInnerHTML={{ __html: props.title || "" }}
            />
            {(editor || !!props.subtitle) && (
              <p
                contentEditable={editor}
                suppressContentEditableWarning
                onMouseDown={editor ? (e) => e.stopPropagation() : undefined}
                onPointerDown={editor ? (e) => e.stopPropagation() : undefined}
                onBlur={(e) => { if (editor && typeof onChangeBlock === "function") onChangeBlock({ ...props, subtitle: e.currentTarget.innerText.trim() }); }}
                onKeyDown={editor ? (e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } } : undefined}
                style={{ color: "#9ca3af", fontSize: 18, textAlign: "center", marginBottom: 48, lineHeight: 1.6, outline: editor ? "1px dashed rgba(14,165,233,0.4)" : "none", padding: editor ? "2px 6px" : 0, borderRadius: 4, cursor: editor ? "text" : undefined }}
                dangerouslySetInnerHTML={{ __html: props.subtitle || (editor ? "Add a subtitle here…" : "") }}
              />
            )}

            <div style={{ borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
              <div style={{ ...grid3, background: "rgba(13,21,38,0.95)", borderBottom: "1px solid rgba(255,255,255,0.1)", padding: "16px 36px", fontSize: 16, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                <span>Feature</span>
                <span style={{ padding: "0 32px", textAlign: "center" }}>Tools you&apos;d need</span>
                <span style={{ textAlign: "right" }}>Cost / mo</span>
              </div>

              {ccRows.map((row, i) => (
                <div key={i} style={{ ...grid3, padding: "20px 36px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                  <span
                    contentEditable={editor}
                    suppressContentEditableWarning
                    onMouseDown={editor ? (e) => e.stopPropagation() : undefined}
                    onPointerDown={editor ? (e) => e.stopPropagation() : undefined}
                    onBlur={(e) => {
                      if (editor && typeof onChangeBlock === "function") {
                        const updated = ccRows.map((r, j) => j === i ? { ...r, category: e.currentTarget.innerText.trim() } : r);
                        onChangeBlock({ ...props, rows: updated });
                      }
                    }}
                    onKeyDown={editor ? (e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } } : undefined}
                    style={{ fontWeight: 600, fontSize: 16, letterSpacing: "0.03em", color: "#e5e7eb", outline: editor ? "1px dashed rgba(14,165,233,0.4)" : "none", padding: editor ? "2px 6px" : 0, borderRadius: 4, cursor: editor ? "text" : undefined }}
                  >{row.category}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 32px", justifyContent: "center" }}>
                    {asArray(row.logos).map((l, li) => <CCLogo key={l.src || l.domain || li} domain={l.domain} name={l.name} src={l.src} />)}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", color: row.price ? "#f1f5f9" : "#60a5fa" }}>
                      {row.price ? `$${row.price}/mo` : (props.uniqueLabel || `Unique to ${props.planName || "us"}`)}
                    </span>
                    <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="13" fill="#2563eb"/><path d="M7 13.5l4 4 8-9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              ))}

              <div style={{ ...grid3, padding: "24px 36px", background: "rgba(13,21,38,0.95)", borderTop: "2px solid rgba(255,255,255,0.12)" }}>
                <span style={{ fontWeight: 600, fontSize: 16, color: "#9ca3af", letterSpacing: "0.04em" }}>Total if purchased separately</span>
                <div style={{ padding: "0 32px" }} />
                <span style={{ color: "#f87171", fontWeight: 600, fontSize: 26, textAlign: "right" }}>${ccTotal.toLocaleString()}/mo</span>
              </div>

              <div style={{ ...grid3, padding: "24px 36px", background: "rgba(10,30,15,0.95)", borderTop: "1px solid rgba(74,222,128,0.15)" }}>
                <div>
                  <span
                    contentEditable={editor}
                    suppressContentEditableWarning
                    onMouseDown={editor ? (e) => e.stopPropagation() : undefined}
                    onPointerDown={editor ? (e) => e.stopPropagation() : undefined}
                    onBlur={(e) => { if (editor && typeof onChangeBlock === "function") onChangeBlock({ ...props, planName: e.currentTarget.innerText.trim() }); }}
                    onKeyDown={editor ? (e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } } : undefined}
                    style={{ fontWeight: 600, fontSize: 17, color: "#86efac", letterSpacing: "0.02em", display: "block", outline: editor ? "1px dashed rgba(14,165,233,0.4)" : "none", padding: editor ? "2px 6px" : 0, borderRadius: 4, cursor: editor ? "text" : undefined }}
                  >{props.planName || "COMPETITOR ANALYSIS"}</span>
                  {(editor || !!props.planTagline) && (
                    <span
                      contentEditable={editor}
                      suppressContentEditableWarning
                      onMouseDown={editor ? (e) => e.stopPropagation() : undefined}
                      onPointerDown={editor ? (e) => e.stopPropagation() : undefined}
                      onBlur={(e) => { if (editor && typeof onChangeBlock === "function") onChangeBlock({ ...props, planTagline: e.currentTarget.innerText.trim() }); }}
                      onKeyDown={editor ? (e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } } : undefined}
                      style={{ color: "#4ade80", fontSize: 16, marginTop: 4, opacity: 0.8, display: "block", outline: editor ? "1px dashed rgba(14,165,233,0.4)" : "none", padding: editor ? "2px 6px" : 0, borderRadius: 4, cursor: editor ? "text" : undefined }}
                    >{props.planTagline || (editor ? "Add plan tagline…" : "")}</span>
                  )}
                </div>
                <div style={{ padding: "0 32px" }} />
                <span style={{ color: "#4ade80", fontWeight: 600, fontSize: 26, textAlign: "right" }}>${ccPlanPrice}/mo</span>
              </div>

              <div style={{ ...grid3, padding: "28px 36px", background: "rgba(20,83,45,0.6)", borderTop: "2px solid rgba(74,222,128,0.25)" }}>
                <span style={{ fontWeight: 600, fontSize: 22, color: "#86efac", letterSpacing: "0.01em" }}>🎉 You save</span>
                <div style={{ padding: "0 32px" }} />
                <span style={{ color: "#86efac", fontWeight: 600, fontSize: 36, textAlign: "right", letterSpacing: "-0.02em" }}>${ccSavings.toLocaleString()}/mo</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
  } // end switch
}
