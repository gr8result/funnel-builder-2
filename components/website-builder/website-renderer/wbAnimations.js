import React from "react";
import { FaArrowDown, FaArrowRight } from "react-icons/fa";
import { getAssetFromLibrary, resolveAssetField } from "../../../lib/website-builder/mediaAssets";
import { renderGridLibraryIcon } from "../gridIconLibrary";

// colorWithAlpha is also defined in wbVariantStyles; duplicated here (no-export) so that
// heroBackground (line ~523 of original) can use it without a circular import.
function colorWithAlpha(color, alpha = 1) {
  const safeAlpha = Math.max(0, Math.min(1, Number(alpha ?? 1)));
  const raw = String(color || "").trim();
  if (!raw) return `rgba(15,23,42,${safeAlpha})`;
  if (raw.startsWith("rgba(")) {
    return raw.replace(/rgba\(([^)]+),\s*[^,()]+\)$/i, `rgba($1, ${safeAlpha})`);
  }
  if (raw.startsWith("rgb(")) {
    const values = raw.slice(4, -1);
    return `rgba(${values}, ${safeAlpha})`;
  }
  let hex = raw.replace("#", "");
  if (hex.length === 3) {
    hex = hex.split("").map((char) => char + char).join("");
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
  }
  return raw;
}

const MIN_TEXT_SIZE = 16;
const MIN_TAP_SIZE = 24;
const PREMIUM_SHADOW = "0 26px 56px rgba(15,23,42,0.16)";
const PREMIUM_BORDER = "1px solid rgba(148,163,184,0.28)";
const DEFAULT_LAYOUT_WIDTH = 1120;
const WEBSITE_BLOCK_ANIMATION_STYLE_ID = "website-block-animation-keyframes";
const WEBSITE_BLOCK_ANIMATION_CSS = `
@keyframes wbFadeUp {
  from { opacity: 0; transform: translate3d(0, 28px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes wbFadeDown {
  from { opacity: 0; transform: translate3d(0, -28px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes wbFadeLeft {
  from { opacity: 0; transform: translate3d(-48px, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes wbFadeRight {
  from { opacity: 0; transform: translate3d(48px, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes wbSlideUp {
  from { opacity: 0; transform: translate3d(0, 36px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes wbSlideLeft {
  from { opacity: 0; transform: translate3d(-48px, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes wbSlideRight {
  from { opacity: 0; transform: translate3d(48px, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes wbSweepLeft {
  from { opacity: 0; transform: translate3d(-18vw, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes wbSweepRight {
  from { opacity: 0; transform: translate3d(18vw, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes wbEdgeLeft {
  from { opacity: 0; transform: translate3d(-32vw, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes wbEdgeRight {
  from { opacity: 0; transform: translate3d(32vw, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes wbEdgeUp {
  from { opacity: 0; transform: translate3d(0, 24vh, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes wbEdgeDown {
  from { opacity: 0; transform: translate3d(0, -24vh, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes wbBlurIn {
  from { opacity: 0; filter: blur(14px); transform: scale(0.98); }
  to { opacity: 1; filter: blur(0); transform: scale(1); }
}

@keyframes wbZoom {
  from { opacity: 0; transform: scale(0.94); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes wbPopIn {
  0% { opacity: 0; transform: scale(0.82); }
  72% { opacity: 1; transform: scale(1.04); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes wbFlipUp {
  from { opacity: 0; transform: perspective(1200px) rotateX(18deg) translate3d(0, 28px, 0); transform-origin: center bottom; }
  to { opacity: 1; transform: perspective(1200px) rotateX(0deg) translate3d(0, 0, 0); transform-origin: center bottom; }
}

@keyframes wbDriftLeft {
  from { opacity: 0; transform: translate3d(-82px, 14px, 0) scale(0.98); }
  to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
}

@keyframes wbDriftRight {
  from { opacity: 0; transform: translate3d(82px, 14px, 0) scale(0.98); }
  to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
}

@keyframes wbDriftEdgeLeft {
  from { opacity: 0; transform: translate3d(-34vw, 3vh, 0) scale(0.96); }
  to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
}

@keyframes wbDriftEdgeRight {
  from { opacity: 0; transform: translate3d(34vw, 3vh, 0) scale(0.96); }
  to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
}

@keyframes wbFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes wbLightSpeedIn {
  from { opacity: 0; transform: translate3d(72px, 0, 0) skewX(-18deg); }
  60% { opacity: 1; transform: translate3d(-8px, 0, 0) skewX(8deg); }
  80% { transform: translate3d(0, 0, 0) skewX(-4deg); }
  to { opacity: 1; transform: translate3d(0, 0, 0) skewX(0deg); }
}

@keyframes wbRotateInDownRight {
  from { opacity: 0; transform: rotate3d(0, 0, 1, 16deg) translate3d(24px, -20px, 0); transform-origin: right bottom; }
  to { opacity: 1; transform: rotate3d(0, 0, 1, 0deg) translate3d(0, 0, 0); transform-origin: right bottom; }
}

@keyframes wbRubberBand {
  from { opacity: 0; transform: scale3d(0.9, 0.9, 1); }
  30% { opacity: 1; transform: scale3d(1.16, 0.84, 1); }
  40% { transform: scale3d(0.88, 1.12, 1); }
  55% { transform: scale3d(1.08, 0.92, 1); }
  70% { transform: scale3d(0.96, 1.04, 1); }
  to { opacity: 1; transform: scale3d(1, 1, 1); }
}

@keyframes wbFloatSoft {
  0% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(0, -12px, 0); }
  100% { transform: translate3d(0, 0, 0); }
}

@keyframes wbPulseSoft {
  0% { transform: scale(1); opacity: 0.82; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1); opacity: 0.82; }
}

@keyframes wbIconDoubleSpin {
  0% { transform: rotate(0deg) scale(1); }
  28% { transform: rotate(220deg) scale(1.08); }
  58% { transform: rotate(470deg) scale(1.14); }
  82% { transform: rotate(720deg) scale(1.02); }
  100% { transform: rotate(720deg) scale(1); }
}

@keyframes wbMarquee {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(-50%, 0, 0); }
}

@keyframes wbOrbitFloat0 {
  0%   { transform: translate3d(0,    0px, 0) rotate(0deg);   }
  30%  { transform: translate3d(-3px,-14px, 0) rotate(-0.6deg); }
  60%  { transform: translate3d(2px,  -8px, 0) rotate(0.4deg);  }
  100% { transform: translate3d(0,    0px, 0) rotate(0deg);   }
}
@keyframes wbOrbitFloat1 {
  0%   { transform: translate3d(0,    0px, 0) rotate(0deg);   }
  35%  { transform: translate3d(4px, -16px, 0) rotate(0.7deg);  }
  65%  { transform: translate3d(-2px, -9px, 0) rotate(-0.3deg); }
  100% { transform: translate3d(0,    0px, 0) rotate(0deg);   }
}
@keyframes wbOrbitFloat2 {
  0%   { transform: translate3d(0,   0px, 0) rotate(0deg);   }
  40%  { transform: translate3d(-4px,-11px, 0) rotate(-0.5deg); }
  70%  { transform: translate3d(3px,  -6px, 0) rotate(0.3deg);  }
  100% { transform: translate3d(0,   0px, 0) rotate(0deg);   }
}
@keyframes wbOrbitFloat3 {
  0%   { transform: translate3d(0,   0px, 0) rotate(0deg);   }
  45%  { transform: translate3d(3px,-13px, 0) rotate(0.6deg);  }
  75%  { transform: translate3d(-2px, -7px, 0) rotate(-0.4deg); }
  100% { transform: translate3d(0,   0px, 0) rotate(0deg);   }
}
@keyframes wbOrbitFloat4 {
  0%   { transform: translate3d(0,   0px, 0) rotate(0deg);   }
  38%  { transform: translate3d(-3px,-10px, 0) rotate(-0.4deg); }
  68%  { transform: translate3d(2px,  -5px, 0) rotate(0.2deg);  }
  100% { transform: translate3d(0,   0px, 0) rotate(0deg);   }
}
@keyframes wbOrbitFloat5 {
  0%   { transform: translate3d(0,   0px, 0) rotate(0deg);   }
  42%  { transform: translate3d(4px,-15px, 0) rotate(0.5deg);  }
  72%  { transform: translate3d(-3px, -8px, 0) rotate(-0.3deg); }
  100% { transform: translate3d(0,   0px, 0) rotate(0deg);   }
}

`;

function websiteBlockKeyframes() {
  return WEBSITE_BLOCK_ANIMATION_CSS;
}

function ensureWebsiteBlockAnimationStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(WEBSITE_BLOCK_ANIMATION_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = WEBSITE_BLOCK_ANIMATION_STYLE_ID;
  style.textContent = WEBSITE_BLOCK_ANIMATION_CSS;
  document.head.appendChild(style);
}

function animationState(name) {
  switch (String(name || "").trim()) {
    case "fade-up":
      return {
        hidden: { opacity: 0, transform: "translate3d(0, 28px, 0)" },
        visible: { opacity: 1, transform: "translate3d(0, 0, 0)" },
      };
    case "fade-down":
      return {
        hidden: { opacity: 0, transform: "translate3d(0, -28px, 0)" },
        visible: { opacity: 1, transform: "translate3d(0, 0, 0)" },
      };
    case "slide-up":
      return {
        hidden: { opacity: 0, transform: "translate3d(0, 36px, 0)" },
        visible: { opacity: 1, transform: "translate3d(0, 0, 0)" },
      };
    case "slide-left":
    case "fade-left":
      return {
        hidden: { opacity: 0, transform: "translate3d(48px, 0, 0)" },
        visible: { opacity: 1, transform: "translate3d(0, 0, 0)" },
      };
    case "slide-right":
    case "fade-right":
      return {
        hidden: { opacity: 0, transform: "translate3d(-48px, 0, 0)" },
        visible: { opacity: 1, transform: "translate3d(0, 0, 0)" },
      };
    case "edge-left":
      return {
        hidden: { opacity: 0, transform: "translate3d(32vw, 0, 0)" },
        visible: { opacity: 1, transform: "translate3d(0, 0, 0)" },
      };
    case "edge-right":
      return {
        hidden: { opacity: 0, transform: "translate3d(-32vw, 0, 0)" },
        visible: { opacity: 1, transform: "translate3d(0, 0, 0)" },
      };
    case "edge-up":
      return {
        hidden: { opacity: 0, transform: "translate3d(0, 24vh, 0)" },
        visible: { opacity: 1, transform: "translate3d(0, 0, 0)" },
      };
    case "edge-down":
      return {
        hidden: { opacity: 0, transform: "translate3d(0, -24vh, 0)" },
        visible: { opacity: 1, transform: "translate3d(0, 0, 0)" },
      };
    case "blur-in":
      return {
        hidden: { opacity: 0, filter: "blur(14px)", transform: "scale(0.98)" },
        visible: { opacity: 1, filter: "blur(0)", transform: "scale(1)" },
      };
    case "pop-in":
      return {
        hidden: { opacity: 0, transform: "scale(0.82)" },
        visible: { opacity: 1, transform: "scale(1)" },
      };
    case "flip-up":
      return {
        hidden: { opacity: 0, transform: "perspective(1200px) rotateX(18deg) translate3d(0, 28px, 0)", transformOrigin: "center bottom" },
        visible: { opacity: 1, transform: "perspective(1200px) rotateX(0deg) translate3d(0, 0, 0)", transformOrigin: "center bottom" },
      };
    case "drift-left":
      return {
        hidden: { opacity: 0, transform: "translate3d(82px, 14px, 0) scale(0.98)" },
        visible: { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
      };
    case "drift-right":
      return {
        hidden: { opacity: 0, transform: "translate3d(-82px, 14px, 0) scale(0.98)" },
        visible: { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
      };
    case "drift-edge-left":
      return {
        hidden: { opacity: 0, transform: "translate3d(34vw, 3vh, 0) scale(0.96)" },
        visible: { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
      };
    case "drift-edge-right":
      return {
        hidden: { opacity: 0, transform: "translate3d(-34vw, 3vh, 0) scale(0.96)" },
        visible: { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
      };
    case "zoom":
      return {
        hidden: { opacity: 0, transform: "scale(0.94)" },
        visible: { opacity: 1, transform: "scale(1)" },
      };
    case "light-speed-in":
      return {
        hidden: { opacity: 0, transform: "translate3d(72px, 0, 0) skewX(-18deg)" },
        visible: { opacity: 1, transform: "translate3d(0, 0, 0) skewX(0deg)" },
      };
    case "rotate-in-down-right":
      return {
        hidden: { opacity: 0, transform: "rotate3d(0, 0, 1, 16deg) translate3d(24px, -20px, 0)", transformOrigin: "right bottom" },
        visible: { opacity: 1, transform: "rotate3d(0, 0, 1, 0deg) translate3d(0, 0, 0)", transformOrigin: "right bottom" },
      };
    case "rubber-band":
      return {
        hidden: { opacity: 0, transform: "scale3d(0.9, 0.9, 1)" },
        visible: { opacity: 1, transform: "scale3d(1, 1, 1)" },
      };
    case "fade-in":
      return {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
      };
    default:
      return { hidden: {}, visible: {} };
  }
}

function ScrollReveal({ as: Tag = "div", animationName, delay = 0, speed = null, disabled = false, style, children }) {
  const nodeRef = React.useRef(null);
  // In editor (disabled=true), always show content — never hide it for animation
  const [visible, setVisible] = React.useState(!animationName || disabled);
  // Once the CSS animation has played to completion, lock the element fully visible.
  // This prevents re-renders from re-applying opacity:0 and restarting the animation.
  const [animDone, setAnimDone] = React.useState(!animationName || disabled);

  React.useEffect(() => {
    // Reset done flag when the animation type changes so the new animation can play
    setAnimDone(false);
    // If disabled (editor mode) or no animation, immediately show — no observer needed
    if (!animationName || disabled) {
      setVisible(true);
      setAnimDone(true);
      return undefined;
    }

    if (typeof window === "undefined" || typeof window.IntersectionObserver !== "function") {
      setVisible(true);
      return undefined;
    }

    const node = nodeRef.current;
    if (!node) return undefined;

    const rect = node.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
    const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
    const isAlreadyVisible = rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight * 0.9 && rect.left < viewportWidth;
    if (isAlreadyVisible) {
      setVisible(true);
      return undefined;
    }

    // Re-hide so the new animation plays from the start (handles animationName changes)
    setVisible(false);

    const observer = new window.IntersectionObserver(
      (entries) => {
        const hit = entries.some((entry) => entry.isIntersecting || entry.intersectionRatio >= 0.18);
        if (!hit) return;
        setVisible(true);
        observer.disconnect();
      },
      {
        threshold: [0.18, 0.34],
        rootMargin: "0px 0px -10% 0px",
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [animationName, disabled]);

  // In editor (disabled=true), don't apply any animation transforms — show everything plainly.
  // Once animDone=true the element is locked fully visible — no inline animation styles so
  // parent re-renders cannot restart the animation and cause a flash.
  const hiddenStyle = (!visible && !disabled && !animDone) ? animationState(animationName).hidden : null;
  const revealStyle = (visible && !disabled && !animDone) ? getAnimationStyle(animationName, delay, speed) : null;

  return (
    <Tag
      ref={nodeRef}
      style={{ ...style, ...(hiddenStyle || {}), ...(revealStyle || {}) }}
      onAnimationEnd={(visible && !animDone && !disabled) ? () => setAnimDone(true) : undefined}
    >
      {children}
    </Tag>
  );
}

function HtmlEmbedBlock({ html, editor }) {
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    if (editor || !containerRef.current || !html?.trim()) return;
    // dangerouslySetInnerHTML doesn't execute <script> tags — re-inject them so they run
    const scripts = containerRef.current.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) => newScript.setAttribute(attr.name, attr.value));
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
  }, [html, editor]);

  if (editor) {
    return (
      <div style={{ padding: "14px 16px", background: "#0f172a", border: "2px dashed rgba(125,211,252,0.4)", borderRadius: 12, minHeight: 56, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "#7dd3fc", fontSize: 18, fontWeight: 600, fontFamily: "monospace" }}>{"</>"}</span>
        <div>
          <div style={{ color: "#e2e8f0", fontSize: 16, fontWeight: 600 }}>Custom HTML / Embed</div>
          {html?.trim() ? (
            <div style={{ color: "#4ade80", fontSize: 16, marginTop: 2 }}>✓ Embed code added — edit in right panel →</div>
          ) : (
            <div style={{ color: "#94a3b8", fontSize: 16, marginTop: 2 }}>Paste your embed code in the right panel →</div>
          )}
        </div>
      </div>
    );
  }

  if (!html?.trim()) return null;
  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />;
}

function ambientMotionStyle(name, delay = 0) {
  switch (String(name || "").trim()) {
    case "float":
      ensureWebsiteBlockAnimationStyles();
      return { animation: `wbFloatSoft 7.2s ease-in-out ${Math.max(0, Number(delay || 0))}s infinite` };
    case "pulse":
      ensureWebsiteBlockAnimationStyles();
      return { animation: `wbPulseSoft 4.8s ease-in-out ${Math.max(0, Number(delay || 0))}s infinite` };
    default:
      return {};
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function slugifyText(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function resolveCurrentPageKey() {
  if (typeof window === "undefined") return "";

  const url = new URL(window.location.href);
  const pageParam = slugifyText(url.searchParams.get("page") || "");
  if (pageParam) return pageParam;

  const hashKey = slugifyText(url.hash.replace(/^#/, ""));
  if (hashKey) return hashKey;

  const pathParts = url.pathname.split("/").filter(Boolean);
  return slugifyText(pathParts[pathParts.length - 1] || "");
}

function isCurrentNavLink(link, currentPageKey) {
  const pageKey = slugifyText(currentPageKey);
  if (!pageKey) return false;

  const href = String(link?.href || "").trim();
  const labelKey = slugifyText(link?.label || "");
  if (labelKey && labelKey === pageKey) return true;

  if (!href) return false;

  const normalizedHref = href.toLowerCase();
  return normalizedHref.includes(`page=${pageKey}`)
    || normalizedHref === `#${pageKey}`
    || normalizedHref.endsWith(`/${pageKey}`);
}

function shouldHighlightNavLink(link, currentPageKey) {
  if (isCurrentNavLink(link, currentPageKey)) return true;
  return !slugifyText(currentPageKey) && !!link?.highlighted;
}

function isSystemAsset(asset) {
  const assetId = String(asset?.id || "").toLowerCase();
  return assetId.startsWith("builtin-deco-") || assetId.startsWith("template-");
}

function pickDefaultAvatarSrc(assets) {
  const imagePool = asArray(assets?.images).filter((asset) => asset?.src && !isSystemAsset(asset));
  if (!imagePool.length) return "";

  const namedAvatar = imagePool.find((asset) => /avatar|headshot|profile|portrait|founder|owner|ceo|team/i.test(`${asset?.name || ""} ${asset?.id || ""}`));
  return namedAvatar?.src || imagePool[0]?.src || "";
}

function resolvePublishedNavHref(link, navigationContext) {
  const href = String(link?.href || "").trim();
  if (!href) return "#";
  if (/^(https?:|mailto:|tel:|#)/i.test(href)) return href;

  const pageMap = navigationContext?.pageMap || {};
  const basePath = String(navigationContext?.basePath || "").replace(/\/$/, "");
  const normalizedHref = href === "/" ? "home" : slugifyText(href.replace(/^\//, ""));
  const publishedHref = pageMap[normalizedHref];

  if (publishedHref) {
    if (/^(https?:|mailto:|tel:|#|\/|\?)/i.test(publishedHref)) return publishedHref;
    return basePath ? `${basePath}/${String(publishedHref).replace(/^\//, "")}` : publishedHref;
  }

  return href;
}

function isGradientValue(value) {
  return /(linear-gradient|radial-gradient|conic-gradient)\(/i.test(String(value || ""));
}

function extractSolidColor(value, fallback = "#0f172a") {
  const match = String(value || "").match(/(#[0-9a-fA-F]{3,8}|rgba?\([^\)]+\)|hsla?\([^\)]+\))/);
  return match?.[1] || fallback;
}

function resolveHeroBaseColor(props) {
  const backgroundValue = String(props?.backgroundColor || "").trim();
  if (!backgroundValue) return "#0f172a";
  return isGradientValue(backgroundValue) ? extractSolidColor(backgroundValue, "#0f172a") : backgroundValue;
}

function resolveHeroGradient(props) {
  const backgroundValue = String(props?.backgroundColor || "").trim();
  if (isGradientValue(backgroundValue)) return backgroundValue;
  const baseColor = backgroundValue || "#0ea5e9";
  return `linear-gradient(135deg, ${baseColor}, #22c55e)`;
}

// When a parallax bg layer extends `overrun`px above the visible section, the raw
// CSS background-position value needs compensating so user-facing "top"/"bottom"
// align to the visible section edge rather than the oversized layer edge.
function compensateParallaxBgPosition(rawPosition, overrun) {
  if (!rawPosition) return "50% 50%";
  const pos = String(rawPosition).trim().toLowerCase();
  if (pos === "top center" || pos === "top") return `50% ${overrun}px`;
  if (pos === "bottom center" || pos === "bottom") return `50% calc(100% - ${overrun}px)`;
  return rawPosition;
}

function resolveParallaxSpeed(...values) {
  const raw = values.find((value) => value !== undefined && value !== null && value !== "");
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return 0.78;
  if (numeric > 1) return Math.max(0.05, Math.min(1.4, numeric / 100 * 1.4));
  return Math.max(0.05, Math.min(1.4, numeric));
}

function heroBackground(props) {
  if (props.backgroundStyle === "image" && props.backgroundImage) {
    const baseColor = resolveHeroBaseColor(props);
    const explicitOverlay = String(props.backgroundOverlay || props.backgroundOverlayColor || "").trim();
    const overlayImage = explicitOverlay && explicitOverlay !== "transparent"
      ? `linear-gradient(135deg, ${explicitOverlay}, ${explicitOverlay}), `
      : "";
    return {
      backgroundColor: baseColor,
      backgroundImage: `${overlayImage}url(${props.backgroundImage})`,
      backgroundSize: props.backgroundSize || "cover",
      backgroundPosition: props.backgroundPosition || "center center",
      backgroundRepeat: props.backgroundRepeat || "no-repeat",
    };
  }

  if (props.backgroundStyle === "solid") {
    return { background: resolveHeroBaseColor(props) };
  }

  return { background: resolveHeroGradient(props) };
}

function IconCounterNumber({ projectId, targetNumber, startNumber, suffix, color, compact, editor, fontSize, fontFamily }) {
  const [target, setTarget] = React.useState(null);
  const startFrom = startNumber != null && !Number.isNaN(Number(startNumber)) ? Number(startNumber) : 0;
  const [display, setDisplay] = React.useState(startFrom);
  const nodeRef = React.useRef(null);
  const animRef = React.useRef(null);
  const hasAnimated = React.useRef(false);

  // In editor mode: show targetNumber directly (no API calls).
  // On a live published page (editor=false, projectId set): POST to record this visit once per
  // browser session, then use the returned count (which already includes this visit).
  // Subsequent renders within the same session do a GET to avoid double-counting.
  React.useEffect(() => {
    const id = String(projectId || "").trim();
    if (!id) {
      // No projectId — use static targetNumber if provided
      if (targetNumber != null && targetNumber !== "") setTarget(Number(targetNumber));
      return;
    }
    if (editor) {
      // Editor: do a read-only GET so the live count is visible while editing
      // (no POST — we never count editor views as visits).
      const base = startFrom > 0 ? startFrom : 0;
      fetch(`/api/website/track-visit?projectId=${encodeURIComponent(id)}&base=${base}`, { method: "GET" })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data?.count != null) setTarget(Number(data.count)); })
        .catch(() => {
          // Fall back to static value if API unreachable
          if (targetNumber != null && targetNumber !== "") setTarget(Number(targetNumber));
        });
      return;
    }
    const base = startFrom > 0 ? startFrom : 0;
    const url = `/api/website/track-visit?projectId=${encodeURIComponent(id)}&base=${base}`;
    fetch(url, { method: "POST" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.count != null) setTarget(Number(data.count));
      })
      .catch(() => {});
  }, [projectId, targetNumber, startFrom, editor]);

  // Count-up animation triggered by IntersectionObserver
  React.useEffect(() => {
    if (target == null || target <= 0) return undefined;
    const el = nodeRef.current;
    if (!el) return undefined;
    const startAnimation = () => {
      hasAnimated.current = true;
      const duration = 2000;
      const start = performance.now();
      const animate = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        setDisplay(Math.round(startFrom + eased * (target - startFrom)));
        if (progress < 1) animRef.current = requestAnimationFrame(animate);
      };
      cancelAnimationFrame(animRef.current);
      animRef.current = requestAnimationFrame(animate);
    };
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !hasAnimated.current) startAnimation(); },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => { observer.disconnect(); cancelAnimationFrame(animRef.current); };
  }, [target, startFrom]);

  const numSize = fontSize || (compact ? 60 : 78);
  const outlineStyle = {
    fontSize: numSize,
    fontWeight: 600,
    lineHeight: 1,
    letterSpacing: "-0.02em",
    fontVariantNumeric: "tabular-nums",
    fontFamily: fontFamily || undefined,
    WebkitTextStroke: `3px ${color}`,
    WebkitTextFillColor: "transparent",
    color,
  };
  return (
    <div ref={nodeRef} style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
      <span style={outlineStyle}>{target != null ? display.toLocaleString() : "—"}</span>
      {suffix ? <span style={{ ...outlineStyle, fontSize: numSize * 0.6 }}>{suffix}</span> : null}
    </div>
  );
}

// Parallax background shell.
// The bg layer extends PARALLAX_OVERRUN px above AND below the visible section.
// A continuous rAF loop reads getBoundingClientRect() every frame — this works in
// both the editor (overflow:auto canvas div) and the preview page (window scroll)
// because getBoundingClientRect() always returns the viewport-relative position
// regardless of which ancestor is scrolling.
const PARALLAX_OVERRUN = 200;
// Overrun for StableParallaxLayer (top/bottom extension). Must stay ≥ MAX (280).
const STABLE_PARALLAX_OVERRUN = 300;

function ParallaxSyncShell({ speed, bgStyle }) {
  const bgRef = React.useRef(null);

  React.useEffect(() => {
    const bg = bgRef.current;
    if (!bg || typeof window === "undefined") return undefined;

    // Walk up to the nearest <section> tag
    let section = bg.parentElement;
    while (section && section.tagName.toUpperCase() !== "SECTION") {
      section = section.parentElement;
    }
    if (!section) return undefined;

    // Cap speed so travel never exceeds the overrun room (±180px)
    const s = Math.min(0.4, resolveParallaxSpeed(speed));
    const MAX = PARALLAX_OVERRUN - 20;

    let rafId = null;
    let lastVal = null;

    function tick() {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const visible = rect.bottom >= -PARALLAX_OVERRUN && rect.top <= vh + PARALLAX_OVERRUN;
      rafId = requestAnimationFrame(tick);
      if (!visible) return;
      // Distance of section centre from viewport centre.
      // Positive = section below centre, negative = section above centre.
      // Multiply by -s so bg moves OPPOSITE to scroll direction (classic parallax).
      const raw = (rect.top + rect.height * 0.5 - vh * 0.5) * -s;
      const clamped = Math.max(-MAX, Math.min(MAX, raw));
      const val = clamped.toFixed(1);
      if (val !== lastVal) {
        bg.style.transform = `translateY(${val}px)`;
        lastVal = val;
      }
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      bg.style.transform = "";
    };
  }, [speed]);

  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }}>
      <div
        ref={bgRef}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: -PARALLAX_OVERRUN,
          bottom: -PARALLAX_OVERRUN,
          willChange: "transform",
          pointerEvents: "none",
          ...bgStyle,
        }}
      />
    </div>
  );
}

function ParallaxImageLayer({ backgroundStyle, speed = 0.34 }) {
  const layerRef = React.useRef(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const layer = layerRef.current;
    const container = layer?.parentElement;
    if (!layer || !container) return undefined;

    const usesContainFit = /contain/i.test(String(backgroundStyle?.backgroundSize || ""));

    let frame = 0;
    let mounted = true;

    const updateOffset = () => {
      if (!mounted) return;
      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 900;
      const viewportCenter = viewportHeight / 2;
      const numericSpeed = Number.isFinite(Number(speed)) ? Number(speed) : 0.34;
      const effectiveSpeed = Math.max(0, Math.min(1.4, numericSpeed));
      const maxTravel = usesContainFit
        ? Math.max(28, Math.min(80, Math.round(viewportHeight * 0.09)))
        : Math.max(160, Math.min(420, Math.round(viewportHeight * 0.54)));
      const offset = Math.max(
        -maxTravel,
        Math.min(maxTravel, (viewportCenter - rect.top - viewportHeight * 0.35) * effectiveSpeed * 0.28),
      );
      layer.style.transform = `translateY(${offset.toFixed(1)}px)`;
      frame = window.requestAnimationFrame(updateOffset);
    };

    frame = window.requestAnimationFrame(updateOffset);

    return () => {
      mounted = false;
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [speed, backgroundStyle?.backgroundImage, backgroundStyle?.backgroundPosition, backgroundStyle?.backgroundSize, backgroundStyle?.backgroundRepeat]);

  return (
    <div
      ref={layerRef}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: -240,
        bottom: -240,
        zIndex: 0,
        pointerEvents: "none",
        willChange: "transform",
        backgroundColor: backgroundStyle?.backgroundColor || "transparent",
        backgroundImage: backgroundStyle?.backgroundImage || "none",
        backgroundSize: backgroundStyle?.backgroundSize || "cover",
        backgroundPosition: backgroundStyle?.backgroundPosition || "center center",
        backgroundRepeat: backgroundStyle?.backgroundRepeat || "no-repeat",
      }}
    />
  );
}

function StableParallaxLayer({ backgroundStyle, speed = 0.34, target = "section" }) {
  const layerRef = React.useRef(null);

  // Use a continuous rAF loop (like ParallaxSyncShell) so the effect works in
  // both the editor (overflow:auto canvas) and the live/preview page (window scroll)
  // because getBoundingClientRect() always returns viewport-relative coordinates
  // regardless of which ancestor element is currently scrolling.
  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const layer = layerRef.current;
    if (!layer) return undefined;

    // Always walk up to the nearest <section> for a reliable measurement target.
    let container = layer.parentElement;
    while (container && container.tagName?.toUpperCase() !== "SECTION") {
      container = container.parentElement;
    }
    if (!container) return undefined;

    const usesContainFit = /contain/i.test(String(backgroundStyle?.backgroundSize || ""));
    const numericSpeed = Number.isFinite(Number(speed)) ? Number(speed) : 0.78;
    const effectiveSpeed = Math.max(0.05, Math.min(1.4, numericSpeed));
    // OVERRUN must exceed MAX to keep the layer within bounds at peak positions.
    const OVERRUN = 300;
    // For 'contain', allow up to 150px shift so the effect is clearly visible across
    // the section scroll range (the natural unclamped range is ~±148px for typical
    // sections, so 150 lets the transition play out without freezing at the cap).
    // For 'cover', use the full OVERRUN buffer minus a safety margin.
    const MAX = usesContainFit ? 150 : OVERRUN - 20; // 150px contain / 280px cover

    let mounted = true;
    let rafId = null;
    let lastTransform = "";

    function tick() {
      if (!mounted) return;
      rafId = requestAnimationFrame(tick);

      const rect = container.getBoundingClientRect();
      const vh = window.innerHeight || 900;
      // Skip work when well outside the viewport to save CPU.
      const visible = rect.bottom >= -OVERRUN && rect.top <= vh + OVERRUN;
      if (!visible) return;

      // Classic parallax: background moves opposite to scroll direction.
      // Coefficient 0.6 gives a noticeable but not overwhelming effect.
      const raw = (vh * 0.5 - (rect.top + rect.height * 0.5)) * effectiveSpeed * 0.6;
      const offset = Math.max(-MAX, Math.min(MAX, raw));
      const nextTransform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      if (nextTransform !== lastTransform) {
        layer.style.transform = nextTransform;
        lastTransform = nextTransform;
      }
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      mounted = false;
      if (rafId) cancelAnimationFrame(rafId);
      layer.style.transform = "";
    };
  }, [speed, target, backgroundStyle?.backgroundImage, backgroundStyle?.backgroundPosition, backgroundStyle?.backgroundSize, backgroundStyle?.backgroundRepeat]);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      data-stable-parallax-layer="true"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: -300,
        bottom: -300,
        zIndex: 0,
        pointerEvents: "none",
        willChange: "transform",
        backgroundColor: backgroundStyle?.backgroundColor || "transparent",
        backgroundImage: backgroundStyle?.backgroundImage || "none",
        backgroundSize: backgroundStyle?.backgroundSize || "cover",
        backgroundPosition: backgroundStyle?.backgroundPosition || "center center",
        backgroundRepeat: backgroundStyle?.backgroundRepeat || "no-repeat",
      }}
    />
  );
}

function getAnimationStyle(name, delay = 0, speed = null) {
  if (name) ensureWebsiteBlockAnimationStyles();

  const safeDelay = Math.max(0, Number(delay || 0));
  const duration = Math.max(0.25, Number(speed || 0.9));

  switch (String(name || "").trim()) {
    case "fade-up":
      return {
        opacity: 0,
        transform: "translate3d(0, 28px, 0)",
        animation: `wbFadeUp ${duration}s ease ${safeDelay}s forwards`,
      };
    case "fade-down":
      return {
        opacity: 0,
        transform: "translate3d(0, -28px, 0)",
        animation: `wbFadeDown ${duration}s ease ${safeDelay}s forwards`,
      };
    case "slide-up":
      return {
        opacity: 0,
        transform: "translate3d(0, 36px, 0)",
        animation: `wbSlideUp ${duration}s cubic-bezier(0.22, 1, 0.36, 1) ${safeDelay}s forwards`,
      };
    case "slide-left":
    case "fade-left":
      return {
        opacity: 0,
        transform: "translate3d(-48px, 0, 0)",
        animation: `${String(name || "").trim() === "fade-left" ? "wbFadeLeft" : "wbSlideLeft"} ${duration}s cubic-bezier(0.22, 1, 0.36, 1) ${safeDelay}s forwards`,
      };
    case "slide-right":
    case "fade-right":
      return {
        opacity: 0,
        transform: "translate3d(48px, 0, 0)",
        animation: `${String(name || "").trim() === "fade-right" ? "wbFadeRight" : "wbSlideRight"} ${duration}s cubic-bezier(0.22, 1, 0.36, 1) ${safeDelay}s forwards`,
      };
    case "sweep-left":
      return {
        opacity: 0,
        transform: "translate3d(-18vw, 0, 0)",
        animation: `wbSweepLeft ${Math.max(duration, 1.15)}s cubic-bezier(0.22, 1, 0.36, 1) ${safeDelay}s forwards`,
      };
    case "sweep-right":
      return {
        opacity: 0,
        transform: "translate3d(18vw, 0, 0)",
        animation: `wbSweepRight ${Math.max(duration, 1.15)}s cubic-bezier(0.22, 1, 0.36, 1) ${safeDelay}s forwards`,
      };
    case "edge-left":
      return {
        opacity: 0,
        transform: "translate3d(-32vw, 0, 0)",
        animation: `wbEdgeLeft ${Math.max(duration, 1.2)}s cubic-bezier(0.22, 1, 0.36, 1) ${safeDelay}s forwards`,
      };
    case "edge-right":
      return {
        opacity: 0,
        transform: "translate3d(32vw, 0, 0)",
        animation: `wbEdgeRight ${Math.max(duration, 1.2)}s cubic-bezier(0.22, 1, 0.36, 1) ${safeDelay}s forwards`,
      };
    case "edge-up":
      return {
        opacity: 0,
        transform: "translate3d(0, 24vh, 0)",
        animation: `wbEdgeUp ${Math.max(duration, 1.1)}s cubic-bezier(0.22, 1, 0.36, 1) ${safeDelay}s forwards`,
      };
    case "edge-down":
      return {
        opacity: 0,
        transform: "translate3d(0, -24vh, 0)",
        animation: `wbEdgeDown ${Math.max(duration, 1.1)}s cubic-bezier(0.22, 1, 0.36, 1) ${safeDelay}s forwards`,
      };
    case "blur-in":
      return {
        opacity: 0,
        filter: "blur(14px)",
        transform: "scale(0.98)",
        animation: `wbBlurIn ${Math.max(duration, 1)}s ease ${safeDelay}s forwards`,
      };
    case "zoom":
      return {
        opacity: 0,
        transform: "scale(0.94)",
        animation: `wbZoom ${duration}s ease ${safeDelay}s forwards`,
      };
    case "pop-in":
      return {
        opacity: 0,
        transform: "scale(0.82)",
        animation: `wbPopIn ${Math.max(duration, 0.65)}s cubic-bezier(0.22, 1, 0.36, 1) ${safeDelay}s forwards`,
      };
    case "fade-in":
      return {
        opacity: 0,
        animation: `wbFadeIn ${duration}s ease ${safeDelay}s forwards`,
      };
    case "flip-up":
      return {
        opacity: 0,
        transform: "perspective(1200px) rotateX(18deg) translate3d(0, 28px, 0)",
        transformOrigin: "center bottom",
        animation: `wbFlipUp ${Math.max(duration, 0.8)}s cubic-bezier(0.22, 1, 0.36, 1) ${safeDelay}s forwards`,
      };
    case "drift-left":
      return {
        opacity: 0,
        transform: "translate3d(-82px, 14px, 0) scale(0.98)",
        animation: `wbDriftLeft ${Math.max(duration, 0.9)}s cubic-bezier(0.22, 1, 0.36, 1) ${safeDelay}s forwards`,
      };
    case "drift-right":
      return {
        opacity: 0,
        transform: "translate3d(82px, 14px, 0) scale(0.98)",
        animation: `wbDriftRight ${Math.max(duration, 0.9)}s cubic-bezier(0.22, 1, 0.36, 1) ${safeDelay}s forwards`,
      };
    case "drift-edge-left":
      return {
        opacity: 0,
        transform: "translate3d(-34vw, 3vh, 0) scale(0.96)",
        animation: `wbDriftEdgeLeft ${Math.max(duration, 1.15)}s cubic-bezier(0.22, 1, 0.36, 1) ${safeDelay}s forwards`,
      };
    case "drift-edge-right":
      return {
        opacity: 0,
        transform: "translate3d(34vw, 3vh, 0) scale(0.96)",
        animation: `wbDriftEdgeRight ${Math.max(duration, 1.15)}s cubic-bezier(0.22, 1, 0.36, 1) ${safeDelay}s forwards`,
      };
    case "light-speed-in":
      return {
        opacity: 0,
        transform: "translate3d(72px, 0, 0) skewX(-18deg)",
        animation: `wbLightSpeedIn ${Math.max(duration, 0.7)}s cubic-bezier(0.22, 1, 0.36, 1) ${safeDelay}s forwards`,
      };
    case "rotate-in-down-right":
      return {
        opacity: 0,
        transform: "rotate3d(0, 0, 1, 16deg) translate3d(24px, -20px, 0)",
        transformOrigin: "right bottom",
        animation: `wbRotateInDownRight ${Math.max(duration, 0.7)}s ease ${safeDelay}s forwards`,
      };
    case "rubber-band":
      return {
        opacity: 0,
        transform: "scale3d(0.9, 0.9, 1)",
        animation: `wbRubberBand ${Math.max(duration, 0.9)}s ease ${safeDelay}s forwards`,
      };
    default:
      return {};
  }
}


// ─── exports ──────────────────────────────────────────────────────────────────
export {
  MIN_TEXT_SIZE, MIN_TAP_SIZE, PREMIUM_SHADOW, PREMIUM_BORDER, DEFAULT_LAYOUT_WIDTH,
  WEBSITE_BLOCK_ANIMATION_STYLE_ID, WEBSITE_BLOCK_ANIMATION_CSS, PARALLAX_OVERRUN,
  websiteBlockKeyframes, ensureWebsiteBlockAnimationStyles, animationState,
  ScrollReveal, HtmlEmbedBlock, ambientMotionStyle, getAnimationStyle,
  asArray, slugifyText, resolveCurrentPageKey, isCurrentNavLink, shouldHighlightNavLink,
  isSystemAsset, pickDefaultAvatarSrc, resolvePublishedNavHref,
  isGradientValue, extractSolidColor, resolveHeroBaseColor, resolveHeroGradient,
  compensateParallaxBgPosition, resolveParallaxSpeed, heroBackground,
  STABLE_PARALLAX_OVERRUN,
  IconCounterNumber, ParallaxSyncShell, ParallaxImageLayer, StableParallaxLayer,
};
