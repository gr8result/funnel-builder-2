import React from "react";
import { getAssetFromLibrary, resolveAssetField } from "../../lib/website-builder/mediaAssets";

const MIN_TEXT_SIZE = 16;
const MIN_TAP_SIZE = 24;
const PREMIUM_SHADOW = "0 26px 56px rgba(15,23,42,0.16)";
const PREMIUM_BORDER = "1px solid rgba(148,163,184,0.28)";

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

function resolvePublishedNavHref(link, navigationContext) {
  const rawHref = String(link?.href || "").trim();
  const pageMap = navigationContext?.pageMap || {};
  const basePath = String(navigationContext?.basePath || "").replace(/\/$/, "");
  const labelKey = slugifyText(link?.label || "");
  const hrefPath = rawHref.split("?")[0].split("#")[0];
  const hrefKey = slugifyText(hrefPath === "/" ? "home" : (hrefPath.split("/").filter(Boolean).pop() || ""));

  if (rawHref.startsWith("?")) {
    try {
      const params = new URLSearchParams(rawHref.replace(/^\?/, ""));
      const pageParam = slugifyText(params.get("page") || "");
      if (pageParam && pageMap[pageParam]) {
        return pageMap[pageParam];
      }
    } catch {
      // Ignore malformed query-style hrefs and continue with the fallback path resolution.
    }
  }

  if (labelKey && pageMap[labelKey]) {
    return pageMap[labelKey];
  }

  if (hrefKey && pageMap[hrefKey]) {
    return pageMap[hrefKey];
  }

  if (rawHref && rawHref !== "#") {
    if (/^(https?:|mailto:|tel:)/i.test(rawHref)) return rawHref;
    if (rawHref.startsWith("#")) return rawHref;
    if (rawHref.startsWith("/")) return rawHref;
  }

  return basePath || "/";
}

function asRichHtml(value) {
  const text = String(value || "");
  if (!text.trim()) return "";
  if (/<\/?[a-z][\s\S]*>/i.test(text)) return text;
  return text.replace(/\n/g, "<br />");
}

function textLayerBackgroundStyle(layer) {
  const backgroundImage = String(layer?.backgroundImage || "").trim();
  if (backgroundImage) {
    return {
      backgroundColor: String(layer?.backgroundColor || "transparent") || "transparent",
      backgroundImage: `url("${backgroundImage}")`,
      backgroundSize: layer?.backgroundSize || "cover",
      backgroundPosition: layer?.backgroundPosition || "center center",
      backgroundRepeat: layer?.backgroundRepeat || "no-repeat",
    };
  }

  if (typeof layer?.background === "string" && layer.background.trim()) {
    return { background: layer.background };
  }

  return { background: String(layer?.backgroundColor || "transparent") || "transparent" };
}

function textSizePx(textSize, compact, explicitSize) {
  const numeric = Number(explicitSize);
  if (Number.isFinite(numeric) && numeric > 0) {
    if (compact) {
      const scaled = Math.round(numeric * 0.72);
      return Math.max(MIN_TEXT_SIZE, Math.min(26, Math.max(14, scaled)));
    }
    return Math.max(MIN_TEXT_SIZE, numeric);
  }

  const map = {
    small: compact ? 14 : 16,
    medium: compact ? 16 : 18,
    large: compact ? 18 : 22,
  };
  return Math.max(MIN_TEXT_SIZE, map[String(textSize || "medium")] || map.medium);
}

function parseSizeValue(value, fallback) {
  if (typeof value === "number") return value;
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return fallback;
  if (raw.includes("%") || raw.includes("vw")) return fallback;
  const parsed = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createCanvasImageLayer(seed = 0, patch = {}) {
  return {
    id: `layer-${Date.now()}-${seed}`,
    kind: "image",
    src: "",
    assetId: "",
    x: 40 + (seed * 24),
    y: 40 + (seed * 24),
    width: 260,
    height: 180,
    rotation: seed % 2 === 0 ? -4 : 4,
    radius: 18,
    zIndex: seed + 1,
    ...patch,
  };
}

function createCanvasTextLayer(seed = 0, patch = {}) {
  return {
    id: `text-layer-${Date.now()}-${seed}`,
    kind: "text",
    content: "Type text here",
    x: 420 + (seed * 18),
    y: 96 + (seed * 18),
    width: 360,
    height: 140,
    rotation: 0,
    radius: 16,
    zIndex: seed + 1,
    fontSize: 40,
    fontWeight: "700",
    textAlign: "center",
    verticalAlign: "center",
    textColor: "#0f172a",
    background: "transparent",
    ...patch,
  };
}

export function getAnimationStyle(name, delay = 0, speed = null) {
  const resolveDuration = (fallback) => {
    const numeric = Number(speed);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
  };

  const map = {
    none: {},
    "fade-in": { animation: `wbFadeIn ${resolveDuration(0.7)}s ease ${delay}s both` },
    "fade-up": { animation: `wbFadeUp ${resolveDuration(0.8)}s ease ${delay}s both` },
    "fade-down": { animation: `wbFadeDown ${resolveDuration(0.8)}s ease ${delay}s both` },
    "slide-left": { animation: `wbSlideLeft ${resolveDuration(0.8)}s ease ${delay}s both` },
    "slide-right": { animation: `wbSlideRight ${resolveDuration(0.8)}s ease ${delay}s both` },
    "slide-up": { animation: `wbSlideUp ${resolveDuration(0.8)}s ease ${delay}s both` },
    "slide-down": { animation: `wbSlideDown ${resolveDuration(0.8)}s ease ${delay}s both` },
    zoom: { animation: `wbZoomIn ${resolveDuration(0.8)}s ease ${delay}s both` },
    "zoom-out": { animation: `wbZoomOut ${resolveDuration(0.8)}s ease ${delay}s both` },
    "blur-in": { animation: `wbBlurIn ${resolveDuration(0.8)}s ease ${delay}s both` },
    "rotate-in": { animation: `wbRotateIn ${resolveDuration(0.85)}s cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}s both` },
    "flip-up": { animation: `wbFlipUp ${resolveDuration(0.9)}s cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}s both` },
    "bounce-in": { animation: `wbBounceIn ${resolveDuration(0.9)}s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s both` },
  };

  return map[String(name || "none")] || map.none;
}

export function websiteBlockKeyframes() {
  return `
    @keyframes wbFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes wbFadeUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes wbFadeDown { from { opacity: 0; transform: translateY(-22px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes wbSlideLeft { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes wbSlideRight { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes wbSlideUp { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes wbSlideDown { from { opacity: 0; transform: translateY(-26px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes wbZoomIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
    @keyframes wbZoomOut { from { opacity: 0; transform: scale(1.08); } to { opacity: 1; transform: scale(1); } }
    @keyframes wbBlurIn { from { opacity: 0; filter: blur(12px); transform: scale(0.98); } to { opacity: 1; filter: blur(0); transform: scale(1); } }
    @keyframes wbRotateIn { from { opacity: 0; transform: rotate(-8deg) scale(0.96); transform-origin: center; } to { opacity: 1; transform: rotate(0deg) scale(1); transform-origin: center; } }
    @keyframes wbFlipUp { from { opacity: 0; transform: perspective(1200px) rotateX(24deg) translateY(18px); transform-origin: center bottom; } to { opacity: 1; transform: perspective(1200px) rotateX(0deg) translateY(0); transform-origin: center bottom; } }
    @keyframes wbBounceIn { 0% { opacity: 0; transform: scale(0.86); } 60% { opacity: 1; transform: scale(1.04); } 100% { opacity: 1; transform: scale(1); } }
  `;
}

function fullWidthStyle(props, compact, editor) {
  if (!props?.fullWidthBackground || compact) return {};
  if (editor) {
    return {
      width: "100vw",
      maxWidth: "100vw",
      marginLeft: "calc(50% - 50vw)",
      marginRight: "calc(50% - 50vw)",
      borderRadius: 0,
    };
  }

  return {
    width: "100vw",
    maxWidth: "100vw",
    marginLeft: "calc(50% - 50vw)",
    marginRight: "calc(50% - 50vw)",
    borderRadius: 0,
  };
}

function sectionContentStyle(props, compact, fallback = 1500) {
  if (compact) {
    return {
      width: "100%",
      margin: "0 auto",
      boxSizing: "border-box",
    };
  }

  const baseLayoutWidth = Math.max(320, Number(props?.baseLayoutWidth || fallback));
  return {
    width: "100%",
    maxWidth: `${baseLayoutWidth}px`,
    margin: "0 auto",
    boxSizing: "border-box",
  };
}

function colorWithAlpha(color, alpha = 0.5) {
  const text = String(color || "").trim();
  if (/^#([0-9a-fA-F]{6})$/.test(text)) {
    const hex = text.slice(1);
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (/^rgb\(/i.test(text)) {
    const parts = text.replace(/^rgb\((.*)\)$/i, "$1");
    return `rgba(${parts}, ${alpha})`;
  }
  if (/^rgba\(/i.test(text)) return text;
  return `rgba(15,23,42,${alpha})`;
}

function asStyleObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function heroBackground(props) {
  if (props.backgroundStyle === "image" && props.backgroundImage) {
    const overlay = colorWithAlpha(props.backgroundColor || "#0f172a", 0.52);
    return `linear-gradient(${overlay}, ${overlay}), url(${props.backgroundImage}) ${props.backgroundPosition || "center center"} / ${props.backgroundSize || "cover"} ${props.backgroundRepeat || "no-repeat"}`;
  }

  if (props.backgroundStyle === "solid") {
    return props.backgroundColor || "#0f172a";
  }

  return `linear-gradient(135deg, ${props.backgroundColor || "#0ea5e9"}, #22c55e)`;
}

function headingTypography(props) {
  return {
    fontFamily: props?.headlineFontFamily || props?.headingFontFamily || "inherit",
    fontWeight: props?.headlineFontWeight || "600",
    textAlign: props?.headlineAlignment || "center",
    color: props?.headlineColor || "inherit",
  };
}

function bodyTypography(props) {
  return {
    fontFamily: props?.fontFamily || props?.bodyFontFamily || "inherit",
    fontWeight: props?.fontWeight || "400",
  };
}

function spacingMultiplier(props) {
  const key = String(props?.spacingScale || "normal").toLowerCase();
  if (key === "tight") return 0.84;
  if (key === "luxury") return 1.2;
  return 1;
}

function scaleBoxPadding(value, scale) {
  const parts = String(value || "").split(" ").map((part) => {
    if (part.endsWith("px")) {
      const numeric = Number(part.replace("px", ""));
      if (Number.isFinite(numeric)) return `${Math.max(4, Math.round(numeric * scale))}px`;
    }
    return part;
  });
  return parts.join(" ");
}

function normalizeOverlayLayoutProps(props, layout, hasFloatingImage = false) {
  const contentX = clampValue(Number.isFinite(Number(props?.contentX)) ? Number(props.contentX) : layout.contentX, 0, 100);
  const contentYDefault = hasFloatingImage ? (layout.contentY ?? 50) : layout.contentY;
  const contentY = clampValue(Number.isFinite(Number(props?.contentY)) ? Number(props.contentY) : contentYDefault, 0, 100);
  const contentWidth = Math.max(240, Number.isFinite(Number(props?.contentWidth)) ? Number(props.contentWidth) : layout.contentWidth);
  const contentHeight = Math.max(100, Number.isFinite(Number(props?.contentHeight)) ? Number(props.contentHeight) : layout.contentHeight);
  const floatingX = clampValue(Number.isFinite(Number(props?.floatingX)) ? Number(props.floatingX) : layout.floatingX, 0, 100);
  const floatingY = clampValue(Number.isFinite(Number(props?.floatingY)) ? Number(props.floatingY) : layout.floatingY, 0, 100);
  const floatingWidth = Math.max(120, Number.isFinite(Number(props?.floatingWidth)) ? Number(props.floatingWidth) : layout.floatingWidth);
  const floatingHeight = Math.max(120, Number.isFinite(Number(props?.floatingHeight)) ? Number(props.floatingHeight) : layout.floatingHeight);

  return {
    ...props,
    contentX,
    contentY,
    contentWidth,
    contentHeight,
    floatingX,
    floatingY,
    floatingWidth,
    floatingHeight,
  };
}

function heroLayoutDefaults(variant, compact) {
  if (variant === "split") {
    return {
      headlineAlignment: "left",
      verticalAlign: "center",
      contentX: compact ? 50 : 31,
      contentY: compact ? 66 : 52,
      contentWidth: compact ? 320 : 540,
      contentHeight: compact ? 220 : 300,
      floatingX: compact ? 50 : 78,
      floatingY: compact ? 22 : 52,
      floatingWidth: compact ? 170 : 360,
      floatingHeight: compact ? 170 : 420,
    };
  }

  if (variant === "editorial") {
    return {
      headlineAlignment: "left",
      verticalAlign: "bottom",
      contentX: compact ? 50 : 38,
      contentY: compact ? 72 : 68,
      contentWidth: compact ? 320 : 560,
      contentHeight: compact ? 220 : 250,
      floatingX: compact ? 50 : 78,
      floatingY: compact ? 22 : 34,
      floatingWidth: compact ? 180 : 250,
      floatingHeight: compact ? 180 : 320,
    };
  }

  if (variant === "framed") {
    return {
      headlineAlignment: "left",
      verticalAlign: "center",
      contentX: compact ? 50 : 33,
      contentY: compact ? 70 : 52,
      contentWidth: compact ? 320 : 520,
      contentHeight: compact ? 220 : 250,
      floatingX: compact ? 50 : 77,
      floatingY: compact ? 22 : 56,
      floatingWidth: compact ? 180 : 320,
      floatingHeight: compact ? 180 : 230,
    };
  }

  return {
    headlineAlignment: "center",
    verticalAlign: "center",
    contentX: 50,
    contentY: compact ? 72 : 68,
    contentWidth: compact ? 320 : 760,
    contentHeight: compact ? 220 : 220,
    floatingX: 50,
    floatingY: compact ? 20 : 24,
    floatingWidth: compact ? 170 : 176,
    floatingHeight: compact ? 170 : 176,
  };
}

function heroVariantStyles(props, compact) {
  const variant = props.heroVariant || "spotlight";
  const layout = heroLayoutDefaults(variant, compact);

  if (variant === "split") {
    return {
      shell: {
        border: "1px solid rgba(148,163,184,0.22)",
        boxShadow: "0 24px 60px rgba(2,6,23,0.22)",
        backgroundBlendMode: "screen, normal",
      },
      content: {
        maxWidth: compact ? "100%" : 520,
        alignItems: "flex-start",
      },
      contentShell: {
        background: props.contentBackground || "linear-gradient(160deg, rgba(8,17,32,0.58), rgba(15,23,42,0.28))",
        border: "1px solid rgba(148,163,184,0.16)",
        borderRadius: compact ? 20 : 28,
        boxShadow: "0 20px 44px rgba(2,6,23,0.18)",
        backdropFilter: "blur(10px)",
      },
      imageFrame: {
        borderRadius: compact ? 24 : 34,
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 28px 64px rgba(15,23,42,0.34)",
      },
      decor: (
        <>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 82% 32%, rgba(56,189,248,0.2), transparent 30%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: compact ? 18 : 30, left: compact ? 18 : 34, width: compact ? 80 : 120, height: 2, background: "rgba(255,255,255,0.45)", pointerEvents: "none" }} />
        </>
      ),
      imageDefaults: {
        x: layout.floatingX,
        y: layout.floatingY,
        width: layout.floatingWidth,
        height: layout.floatingHeight,
        contentY: layout.contentY,
      },
    };
  }

  if (variant === "editorial") {
    return {
      shell: {
        border: "1px solid rgba(255,255,255,0.42)",
        boxShadow: "0 28px 72px rgba(120,98,67,0.18)",
        backgroundBlendMode: "multiply, normal",
      },
      content: {
        maxWidth: compact ? "100%" : 560,
        alignItems: "flex-start",
      },
      contentShell: {
        background: props.contentBackground || "linear-gradient(180deg, rgba(255,250,243,0.92), rgba(247,241,232,0.84))",
        border: "1px solid rgba(120,98,67,0.14)",
        borderRadius: compact ? 22 : 30,
        boxShadow: "0 24px 54px rgba(120,98,67,0.16)",
        backdropFilter: "blur(8px)",
      },
      imageFrame: {
        borderRadius: compact ? 28 : 36,
        border: "10px solid rgba(255,250,243,0.78)",
        boxShadow: "0 24px 46px rgba(120,98,67,0.2)",
      },
      decor: (
        <>
          <div style={{ position: "absolute", top: compact ? 18 : 28, left: compact ? 18 : 28, right: compact ? 18 : 28, height: 1, background: "rgba(120,98,67,0.24)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: compact ? 18 : 28, left: compact ? 18 : 28, right: compact ? 18 : 28, height: 1, background: "rgba(120,98,67,0.18)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", right: compact ? 18 : 42, top: compact ? 28 : 54, width: compact ? 56 : 84, height: compact ? 56 : 84, borderRadius: 999, border: "1px solid rgba(120,98,67,0.22)", pointerEvents: "none" }} />
        </>
      ),
      imageDefaults: {
        x: layout.floatingX,
        y: layout.floatingY,
        width: layout.floatingWidth,
        height: layout.floatingHeight,
        contentY: layout.contentY,
      },
    };
  }

  if (variant === "framed") {
    return {
      shell: {
        border: "1px solid rgba(203,213,225,0.9)",
        boxShadow: "0 22px 48px rgba(15,23,42,0.08)",
      },
      content: {
        maxWidth: compact ? "100%" : 500,
        alignItems: "flex-start",
      },
      contentShell: {
        background: props.contentBackground || "rgba(255,255,255,0.96)",
        border: "1px solid rgba(226,232,240,0.92)",
        borderRadius: compact ? 22 : 28,
        boxShadow: "0 18px 42px rgba(15,23,42,0.08)",
      },
      imageFrame: {
        borderRadius: compact ? 20 : 26,
        border: "1px solid rgba(203,213,225,0.8)",
        boxShadow: "0 22px 44px rgba(15,23,42,0.12)",
      },
      decor: (
        <>
          <div style={{ position: "absolute", inset: compact ? 12 : 18, border: "1px solid rgba(226,232,240,0.8)", borderRadius: compact ? 16 : 24, pointerEvents: "none" }} />
          <div style={{ position: "absolute", right: compact ? 24 : 38, top: compact ? 24 : 34, width: compact ? 56 : 74, height: compact ? 56 : 74, backgroundImage: "radial-gradient(#cbd5e1 1.2px, transparent 1.2px)", backgroundSize: "12px 12px", opacity: 0.8, pointerEvents: "none" }} />
        </>
      ),
      imageDefaults: {
        x: layout.floatingX,
        y: layout.floatingY,
        width: layout.floatingWidth,
        height: layout.floatingHeight,
        contentY: layout.contentY,
      },
    };
  }

  return {
    shell: {
      border: "1px solid rgba(125,211,252,0.24)",
      boxShadow: "0 30px 80px rgba(14,165,233,0.16)",
    },
    content: {
      maxWidth: compact ? "100%" : 760,
      alignItems: "center",
    },
    contentShell: {
      background: props.contentBackground || "linear-gradient(180deg, rgba(15,23,42,0.42), rgba(15,23,42,0.2))",
      border: "1px solid rgba(125,211,252,0.18)",
      borderRadius: compact ? 22 : 30,
      boxShadow: "0 22px 52px rgba(8,47,73,0.24)",
      backdropFilter: "blur(10px)",
    },
    imageFrame: {
      borderRadius: 999,
      border: "4px solid rgba(255,255,255,0.78)",
      boxShadow: "0 28px 60px rgba(14,165,233,0.22)",
    },
    decor: (
      <>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 18% 18%, rgba(34,211,238,0.22), transparent 24%), radial-gradient(circle at 82% 18%, rgba(59,130,246,0.18), transparent 22%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: compact ? -40 : -66, left: "50%", transform: "translateX(-50%)", width: compact ? 220 : 360, height: compact ? 220 : 360, borderRadius: 999, background: "radial-gradient(circle, rgba(34,211,238,0.18), rgba(34,211,238,0))", pointerEvents: "none" }} />
      </>
    ),
    imageDefaults: {
      x: layout.floatingX,
      y: layout.floatingY,
      width: layout.floatingWidth,
      height: layout.floatingHeight,
      contentY: layout.contentY,
    },
  };
}

function normalizeFeatureItem(item, index) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return {
      id: item.id || `feature-item-${index}`,
      title: String(item.title || item.label || item.text || `Feature ${index + 1}`),
      body: String(item.body || item.description || item.copy || ""),
      image: String(item.image || item.src || ""),
      imageX: Number.isFinite(Number(item.imageX)) ? Math.max(0, Math.min(100, Number(item.imageX))) : 50,
      imageY: Number.isFinite(Number(item.imageY)) ? Math.max(0, Math.min(100, Number(item.imageY))) : 50,
    };
  }

  return {
    id: `feature-item-${index}`,
    title: String(item || `Feature ${index + 1}`),
    body: "",
    image: "",
    imageX: 50,
    imageY: 50,
  };
}

function featureVariantStyles(props) {
  const variant = props.featureVariant || "cards";
  const cardWidth = Math.max(220, Number(props?.featureCardWidth) || 320);
  const compactCardWidth = Math.max(220, Math.min(cardWidth, 420));

  if (variant === "minimal-list") {
    return {
      list: {
        display: "grid",
        gap: 10,
        justifyItems: "center",
      },
      item: {
        display: "grid",
        gridTemplateColumns: "112px minmax(0, 1fr)",
        gap: 16,
        alignItems: "center",
        padding: 14,
        border: "1px solid rgba(226,232,240,0.95)",
        borderRadius: 18,
        background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.92))",
        boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
        width: "100%",
        maxWidth: `${compactCardWidth}px`,
      },
      media: {
        aspectRatio: "1 / 1",
        borderRadius: 18,
      },
      body: {
        display: "grid",
        gap: 6,
      },
      title: {
        fontSize: 18,
        lineHeight: 1.25,
      },
      copy: {
        fontSize: 16,
        lineHeight: 1.55,
      },
    };
  }

  if (variant === "editorial-strip") {
    return {
      list: {
        display: "grid",
        gap: 18,
        justifyItems: "center",
      },
      item: {
        display: "grid",
        gridTemplateColumns: `minmax(${Math.max(180, Math.round(cardWidth * 0.42))}px, 0.95fr) minmax(0, 1.05fr)`,
        gap: 0,
        alignItems: "stretch",
        padding: 0,
        borderRadius: 28,
        overflow: "hidden",
        background: "linear-gradient(135deg, #fffaf2, #f6ead8)",
        border: "1px solid rgba(120,98,67,0.16)",
        boxShadow: "0 24px 52px rgba(120,98,67,0.12)",
        width: "100%",
        maxWidth: `${Math.max(280, cardWidth + 180)}px`,
      },
      media: {
        height: "100%",
        minHeight: 220,
        borderRadius: 0,
      },
      body: {
        display: "grid",
        alignContent: "center",
        gap: 10,
        padding: 28,
      },
      title: {
        fontSize: 28,
        lineHeight: 1.08,
        letterSpacing: "-0.03em",
      },
      copy: {
        fontSize: 16,
        lineHeight: 1.7,
      },
      marker: {
        alignSelf: "flex-start",
      },
    };
  }

  if (variant === "glass-cards") {
    return {
      list: {
        display: "grid",
        gap: 16,
        gridTemplateColumns: `repeat(auto-fit, minmax(${Math.max(220, Math.round(cardWidth * 0.78))}px, ${cardWidth}px))`,
        justifyContent: "center",
      },
      item: {
        display: "grid",
        gap: 16,
        alignContent: "start",
        padding: 18,
        borderRadius: 24,
        border: "1px solid rgba(148,163,184,0.24)",
        background: "linear-gradient(170deg, rgba(15,23,42,0.78), rgba(30,41,59,0.62))",
        boxShadow: "0 22px 42px rgba(15,23,42,0.18)",
        backdropFilter: "blur(14px)",
        width: "100%",
        maxWidth: `${cardWidth}px`,
      },
      media: {
        aspectRatio: "4 / 5",
        borderRadius: 20,
      },
      body: {
        display: "grid",
        gap: 8,
      },
      title: {
        fontSize: 20,
        lineHeight: 1.2,
        color: "#f8fafc",
      },
      copy: {
        fontSize: 16,
        lineHeight: 1.65,
        color: "#cbd5e1",
      },
      marker: {
        color: "#67e8f9",
      },
    };
  }

  return {
    list: {
      display: "grid",
      gap: 14,
      gridTemplateColumns: `repeat(auto-fit, minmax(${Math.max(220, Math.round(cardWidth * 0.78))}px, ${cardWidth}px))`,
      justifyContent: "center",
    },
    item: {
      display: "grid",
      gap: 14,
      alignContent: "start",
      padding: 16,
      borderRadius: 16,
      border: "1px solid #dbeafe",
      background: "linear-gradient(165deg,#eff6ff,#ffffff)",
      boxShadow: "0 12px 24px rgba(37,99,235,0.1)",
      width: "100%",
      maxWidth: `${cardWidth}px`,
    },
    media: {
      aspectRatio: "4 / 3",
      borderRadius: 18,
    },
    body: {
      display: "grid",
      gap: 8,
    },
    title: {
      fontSize: 19,
      lineHeight: 1.2,
    },
    copy: {
      fontSize: 16,
      lineHeight: 1.6,
    },
  };
}

function testimonialVariantStyles(variant, compact, props) {
  const bg = props.backgroundColor;
  const accent = props.accentColor || "#f59e0b";
  const cardBg = props.cardBackgroundColor;
  const border = props.borderColor;
  const textCol = props.textColor;
  const cardWidth = Math.max(180, Number(props.cardWidth) || 320);

  if (variant === "spotlight") {
    return {
      shell: { background: bg || "linear-gradient(165deg,#0f172a,#1e3a5f)", borderRadius: compact ? 16 : 28 },
      grid: { display: "grid", gap: 28, maxWidth: compact ? "100%" : `${Math.max(400, cardWidth)}px`, marginLeft: "auto", marginRight: "auto", marginTop: 24 },
      card: () => ({
        background: cardBg || "rgba(255,255,255,0.07)",
        border: `1px solid ${border || "rgba(255,255,255,0.14)"}`,
        borderRadius: compact ? 14 : 22,
        padding: compact ? "26px 22px" : "38px 42px",
        display: "grid",
        gap: 14,
        textAlign: "center",
        boxShadow: "0 24px 54px rgba(0,0,0,0.3)",
      }),
      quote: { color: textCol || "#f1f5f9", fontStyle: "italic" },
      author: { color: textCol || "#f8fafc" },
      meta: { color: "rgba(248,250,252,0.6)" },
      starColor: accent,
    };
  }

  if (variant === "bubble") {
    return {
      shell: { background: bg || "#f0f9ff", borderRadius: compact ? 16 : 28 },
      grid: {
        display: "flex",
        flexWrap: compact ? "nowrap" : "wrap",
        flexDirection: compact ? "column" : "row",
        justifyContent: "center",
        gap: 20,
        marginTop: 24,
        alignItems: "start",
      },
      cardWrap: compact ? undefined : { width: cardWidth, maxWidth: "100%", flexShrink: 0, flexGrow: 0, boxSizing: "border-box" },
      card: () => ({
        background: cardBg || "#ffffff",
        borderLeft: `4px solid ${accent}`,
        border: `1px solid ${border || "#bfdbfe"}`,
        borderLeftWidth: 4,
        borderLeftColor: accent,
        borderRadius: compact ? 12 : 18,
        padding: compact ? "18px" : "22px 24px",
        boxShadow: "0 8px 28px rgba(37,99,235,0.08)",
        display: "grid",
        gap: 10,
      }),
      quote: { color: textCol || "#0f172a" },
      author: { color: textCol || "#0f172a" },
      meta: { color: "#64748b" },
      starColor: accent,
    };
  }

  if (variant === "wall") {
    return {
      shell: { background: bg || "#ffffff", borderRadius: compact ? 16 : 28 },
      grid: {
        display: "grid",
        gridTemplateColumns: compact ? "1fr" : "repeat(3, minmax(0, 1fr))",
        gap: 14,
        marginTop: 24,
        alignItems: "start",
      },
      card: (idx) => {
        const fills = [accent || "#0ea5e9", "#0f172a", cardBg || "#ffffff"];
        const textFills = ["#ffffff", "#ffffff", textCol || "#0f172a"];
        const col = idx % 3;
        return {
          background: fills[col],
          color: textFills[col],
          borderRadius: compact ? 12 : 18,
          padding: compact ? "16px" : "22px 24px",
          display: "grid",
          gap: 8,
          border: `1px solid ${border || "rgba(148,163,184,0.18)"}`,
        };
      },
      quote: { color: textCol || "#ffffff" },
      author: { color: textCol || "#ffffff" },
      meta: { color: "rgba(248,250,252,0.65)" },
      starColor: "#fde68a",
    };
  }

  // default: "cards"
  return {
    shell: { background: bg || "linear-gradient(165deg,#f8fafc,#ffffff)", borderRadius: compact ? 16 : 28 },
    grid: {
      display: "flex",
      flexWrap: compact ? "nowrap" : "wrap",
      flexDirection: compact ? "column" : "row",
      justifyContent: "center",
      gap: 20,
      marginTop: 24,
      alignItems: "start",
    },
    cardWrap: compact ? undefined : { width: cardWidth, maxWidth: "100%", flexShrink: 0, flexGrow: 0, boxSizing: "border-box" },
    card: () => ({
      background: cardBg || "#ffffff",
      border: `1px solid ${border || "rgba(148,163,184,0.28)"}`,
      borderRadius: compact ? 14 : 20,
      padding: compact ? "18px" : "26px 28px",
      boxShadow: PREMIUM_SHADOW,
      display: "grid",
      gap: 12,
    }),
    quote: { color: textCol || "#0f172a", fontStyle: "italic" },
    author: { color: textCol || "#0f172a" },
    meta: { color: "#64748b" },
    starColor: accent,
  };
}

function ctaButtonVariantStyles(props, compact) {
  const variant = String(props.style || "spotlight-pill");
  const size = String(props.size || "large");
  const buttonPad = size === "small" ? (compact ? "9px 14px" : "10px 16px") : size === "medium" ? (compact ? "10px 18px" : "12px 22px") : (compact ? "12px 20px" : "15px 28px");
  const buttonFontSize = size === "small" ? 14 : size === "medium" ? 15 : 17;

  if (variant === "split-banner") {
    return {
      section: {
        display: "grid",
        gridTemplateColumns: compact ? "1fr" : "minmax(0, 1.3fr) auto",
        gap: compact ? 18 : 26,
        alignItems: "center",
        borderRadius: compact ? 22 : 30,
        padding: compact ? "22px 20px" : "28px 32px",
        background: props.backgroundColor || "linear-gradient(135deg,#081120,#17304d)",
        border: `1px solid ${props.borderColor || "rgba(148,163,184,0.22)"}`,
        boxShadow: "0 24px 54px rgba(2,6,23,0.24)",
      },
      content: { display: "grid", gap: 8, textAlign: compact ? "center" : "left" },
      eyebrow: { fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, color: colorWithAlpha(props.textColor || "#f8fafc", 0.7) },
      title: { margin: 0, fontSize: compact ? 24 : 34, lineHeight: 1.08, fontWeight: 600, color: props.textColor || "#f8fafc" },
      description: { margin: 0, fontSize: compact ? 14 : 16, lineHeight: 1.65, color: colorWithAlpha(props.textColor || "#f8fafc", 0.82), maxWidth: 620 },
      note: { margin: 0, fontSize: 16, lineHeight: 1.5, color: colorWithAlpha(props.textColor || "#f8fafc", 0.68) },
      actionWrap: { display: "grid", gap: 10, justifyItems: compact ? "center" : "end", minWidth: compact ? undefined : 220 },
      action: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
        borderRadius: 999,
        padding: buttonPad,
        fontSize: buttonFontSize,
        fontWeight: 600,
        background: props.buttonColor || "#ffffff",
        color: props.buttonTextColor || "#0f172a",
        boxShadow: "0 18px 34px rgba(15,23,42,0.18)",
        minWidth: compact ? undefined : 220,
      },
    };
  }

  if (variant === "editorial-outline") {
    return {
      section: {
        display: "grid",
        gap: 16,
        borderRadius: compact ? 22 : 30,
        padding: compact ? "22px 20px" : "30px 34px",
        background: props.backgroundColor || "linear-gradient(180deg,#fffaf2,#f6ead8)",
        border: `1px solid ${props.borderColor || "rgba(120,98,67,0.18)"}`,
        boxShadow: "0 22px 48px rgba(120,98,67,0.12)",
      },
      content: { display: "grid", gap: 10, textAlign: props.alignment || "left" },
      eyebrow: { fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600, color: colorWithAlpha(props.textColor || "#2f241b", 0.62) },
      title: { margin: 0, fontSize: compact ? 24 : 36, lineHeight: 1.08, fontWeight: 600, color: props.textColor || "#2f241b", maxWidth: 760 },
      description: { margin: 0, fontSize: compact ? 15 : 17, lineHeight: 1.75, color: colorWithAlpha(props.textColor || "#2f241b", 0.8), maxWidth: 720 },
      note: { margin: 0, fontSize: 16, lineHeight: 1.6, color: colorWithAlpha(props.textColor || "#2f241b", 0.62) },
      actionWrap: { display: "flex", justifyContent: props.alignment === "center" ? "center" : props.alignment === "right" ? "flex-end" : "flex-start" },
      action: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
        borderRadius: 999,
        padding: buttonPad,
        fontSize: buttonFontSize,
        fontWeight: 600,
        background: props.buttonColor || "rgba(255,250,243,0.72)",
        color: props.buttonTextColor || props.textColor || "#2f241b",
        border: `1px solid ${props.borderColor || "rgba(120,98,67,0.18)"}`,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)",
      },
    };
  }

  if (variant === "stacked-card") {
    return {
      section: {
        display: "grid",
        gap: 16,
        justifyItems: "center",
        textAlign: "center",
        borderRadius: compact ? 24 : 32,
        padding: compact ? "24px 20px" : "34px 36px",
        background: props.backgroundColor || "linear-gradient(135deg,#111827,#1d4ed8 62%,#22d3ee)",
        border: `1px solid ${props.borderColor || "rgba(255,255,255,0.18)"}`,
        boxShadow: "0 28px 60px rgba(15,23,42,0.26)",
      },
      content: { display: "grid", gap: 10, justifyItems: "center", maxWidth: 780 },
      eyebrow: { fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600, color: colorWithAlpha(props.textColor || "#ffffff", 0.72) },
      title: { margin: 0, fontSize: compact ? 26 : 40, lineHeight: 1.04, fontWeight: 600, color: props.textColor || "#ffffff" },
      description: { margin: 0, fontSize: compact ? 15 : 18, lineHeight: 1.7, color: colorWithAlpha(props.textColor || "#ffffff", 0.86), maxWidth: 700 },
      note: { margin: 0, fontSize: 16, lineHeight: 1.55, color: colorWithAlpha(props.textColor || "#ffffff", 0.72) },
      actionWrap: { display: "grid", gap: 10, justifyItems: "center" },
      action: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
        borderRadius: 18,
        padding: buttonPad,
        fontSize: buttonFontSize,
        fontWeight: 600,
        background: props.buttonColor || "linear-gradient(135deg,#facc15,#f59e0b)",
        color: props.buttonTextColor || "#1f2937",
        boxShadow: "0 22px 36px rgba(15,23,42,0.24)",
        minWidth: compact ? undefined : 240,
      },
    };
  }

  return {
    section: {
      display: "grid",
      gap: 14,
      justifyItems: props.alignment === "left" ? "start" : props.alignment === "right" ? "end" : "center",
      textAlign: props.alignment || "center",
      borderRadius: compact ? 22 : 28,
      padding: compact ? "22px 20px" : "28px 32px",
      background: props.backgroundColor || "linear-gradient(135deg,#eff6ff,#ffffff)",
      border: `1px solid ${props.borderColor || "rgba(191,219,254,0.9)"}`,
      boxShadow: "0 18px 42px rgba(37,99,235,0.12)",
    },
    content: { display: "grid", gap: 8, justifyItems: props.alignment === "left" ? "start" : props.alignment === "right" ? "end" : "center", maxWidth: 720 },
    eyebrow: { fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600, color: colorWithAlpha(props.textColor || "#0f172a", 0.6) },
    title: { margin: 0, fontSize: compact ? 24 : 34, lineHeight: 1.08, fontWeight: 600, color: props.textColor || "#0f172a" },
    description: { margin: 0, fontSize: compact ? 15 : 16, lineHeight: 1.7, color: colorWithAlpha(props.textColor || "#0f172a", 0.76), maxWidth: 620 },
    note: { margin: 0, fontSize: 16, lineHeight: 1.5, color: colorWithAlpha(props.textColor || "#0f172a", 0.62) },
    actionWrap: { display: "flex", justifyContent: props.alignment === "left" ? "flex-start" : props.alignment === "right" ? "flex-end" : "center" },
    action: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      textDecoration: "none",
      borderRadius: 999,
      padding: buttonPad,
      fontSize: buttonFontSize,
      fontWeight: 600,
      background: props.buttonColor || "linear-gradient(135deg,#0ea5e9,#2563eb)",
      color: props.buttonTextColor || "#ffffff",
      boxShadow: "0 14px 30px rgba(37,99,235,0.28)",
      border: "1px solid rgba(255,255,255,0.24)",
    },
  };
}

function normalizeGalleryItem(item, index) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return {
      id: item.id || `gallery-item-${index}`,
      src: String(item.src || ""),
      alt: String(item.alt || `Gallery image ${index + 1}`),
      caption: String(item.caption || ""),
      imageX: Number.isFinite(Number(item.imageX)) ? Math.max(0, Math.min(100, Number(item.imageX))) : 50,
      imageY: Number.isFinite(Number(item.imageY)) ? Math.max(0, Math.min(100, Number(item.imageY))) : 50,
    };
  }

  return {
    id: `gallery-item-${index}`,
    src: String(item || ""),
    alt: `Gallery image ${index + 1}`,
    caption: "",
    imageX: 50,
    imageY: 50,
  };
}

function normalizeTeamMember(item, index) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return {
      id: item.id || `team-member-${index}`,
      name: String(item.name || `Team Member ${index + 1}`),
      role: String(item.role || "Role"),
      bio: String(item.bio || ""),
      image: String(item.image || item.src || ""),
      imageAssetId: String(item.imageAssetId || ""),
      hierarchyRow: Number.isFinite(Number(item.hierarchyRow)) ? Math.max(0, Number(item.hierarchyRow)) : 0,
      imageX: Number.isFinite(Number(item.imageX)) ? Math.max(0, Math.min(100, Number(item.imageX))) : 50,
      imageY: Number.isFinite(Number(item.imageY)) ? Math.max(0, Math.min(100, Number(item.imageY))) : 50,
    };
  }

  return {
    id: `team-member-${index}`,
    name: `Team Member ${index + 1}`,
    role: "Role",
    bio: "",
    image: "",
    imageAssetId: "",
    hierarchyRow: 0,
    imageX: 50,
    imageY: 50,
  };
}

function normalizeTestimonialItem(item, index) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return {
      id: item.id || `testimonial-${index}`,
      text: String(item.text || item.quote || ""),
      author: String(item.author || item.name || ""),
      role: String(item.role || item.title || item.company || ""),
      rating: Number.isFinite(Number(item.rating)) ? Math.max(1, Math.min(5, Number(item.rating))) : 5,
      avatarUrl: String(item.avatarUrl || item.avatar || item.image || ""),
      avatarAssetId: String(item.avatarAssetId || ""),
    };
  }
  return {
    id: `testimonial-${index}`,
    text: "",
    author: "",
    role: "",
    rating: 5,
    avatarUrl: "",
    avatarAssetId: "",
  };
}

function normalizeTestimonialItems(props) {
  if (Array.isArray(props.items) && props.items.length) {
    return props.items.map(normalizeTestimonialItem);
  }
  // Migrate from legacy single-item format
  const legacy = normalizeTestimonialItem({
    text: props.text,
    author: props.author,
    role: props.role,
    avatarUrl: props.avatar,
  }, 0);
  if (legacy.text || legacy.author) return [legacy];
  return [
    { id: "testimonial-0", text: "", author: "", role: "", rating: 5, avatarUrl: "", avatarAssetId: "" },
  ];
}

function normalizeTeamRowSizes(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(",");
  return source
    .map((entry) => parseInt(String(entry || "").trim(), 10))
    .filter((size) => Number.isFinite(size) && size > 0)
    .slice(0, 8);
}

function defaultTeamHierarchyRows(memberCount) {
  const defaults = [2, 3, 4];
  const rows = [];
  let remaining = Math.max(0, memberCount || 0);
  let rowIndex = 0;

  while (remaining > 0) {
    const target = defaults[Math.min(rowIndex, defaults.length - 1)] || 4;
    const size = Math.min(target, remaining);
    rows.push(size);
    remaining -= size;
    rowIndex += 1;
  }

  return rows;
}

function buildTeamHierarchyRows(members, rowSizes) {
  const safeMembers = asArray(members);
  const assignedRows = [];
  safeMembers.forEach((member) => {
    const rowIndex = Number.isFinite(Number(member?.hierarchyRow)) ? Math.max(0, Number(member.hierarchyRow)) : 0;
    if (!assignedRows[rowIndex]) assignedRows[rowIndex] = [];
    assignedRows[rowIndex].push(member);
  });
  const compactAssignedRows = assignedRows.filter((row) => Array.isArray(row) && row.length);
  if (compactAssignedRows.length) {
    return compactAssignedRows;
  }

  const normalizedRows = normalizeTeamRowSizes(rowSizes);
  const effectiveRows = normalizedRows.length ? normalizedRows : defaultTeamHierarchyRows(safeMembers.length);
  const rows = [];
  let cursor = 0;

  effectiveRows.forEach((size) => {
    if (cursor >= safeMembers.length) return;
    const rowCount = Math.min(size, safeMembers.length - cursor);
    rows.push(safeMembers.slice(cursor, cursor + rowCount));
    cursor += rowCount;
  });

  while (cursor < safeMembers.length) {
    const fallbackSize = Math.max(1, effectiveRows[effectiveRows.length - 1] || 4);
    const rowCount = Math.min(fallbackSize, safeMembers.length - cursor);
    rows.push(safeMembers.slice(cursor, cursor + rowCount));
    cursor += rowCount;
  }

  return rows;
}

function renderHierarchyConnector(currentCount, nextCount, borderColor, compact) {
  if (!nextCount) return null;
  const safeNextCount = Math.max(1, nextCount);
  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        height: compact ? 34 : 42,
        width: "100%",
        maxWidth: compact ? "100%" : `${Math.max(1, safeNextCount) * 280 + Math.max(0, safeNextCount - 1) * 18}px`,
        margin: "0 auto",
      }}
    >
      <div style={{ position: "absolute", left: "50%", top: 0, width: 2, height: safeNextCount > 1 ? "55%" : "100%", background: borderColor, transform: "translateX(-50%)" }} />
      {safeNextCount > 1 ? (
        <>
          <div style={{ position: "absolute", left: `${100 / (safeNextCount * 2)}%`, right: `${100 / (safeNextCount * 2)}%`, top: "55%", height: 2, background: borderColor }} />
          {Array.from({ length: safeNextCount }).map((_, branchIndex) => {
            const left = `${((branchIndex * 2) + 1) * 100 / (safeNextCount * 2)}%`;
            return <div key={`hierarchy-branch-${branchIndex}`} style={{ position: "absolute", left, top: "55%", width: 2, height: "45%", background: borderColor, transform: "translateX(-50%)" }} />;
          })}
        </>
      ) : null}
    </div>
  );
}

function teamVariantStyles(props, compact) {
  const variant = String(props?.teamVariant || "studio-cards");
  const border = props?.borderColor || "rgba(226,232,240,0.9)";
  const text = props?.textColor || "#0f172a";
  const subtle = props?.subtleTextColor || (variant === "spotlight-strip" ? "rgba(226,232,240,0.78)" : "#64748b");

  if (variant === "hierarchy-layout") {
    return {
      section: { background: props?.backgroundColor || "linear-gradient(180deg,#f8fbff,#eef4ff)", borderColor: props?.borderColor || "rgba(96,165,250,0.22)" },
      header: { maxWidth: 760, margin: "0 auto", textAlign: "center" },
      rowsContainer: { display: "grid", gap: compact ? 14 : 18, marginTop: 18 },
      row: (count) => ({
        display: "grid",
        gridTemplateColumns: compact ? "1fr" : `repeat(${Math.max(1, count)}, minmax(0, 1fr))`,
        gap: compact ? 14 : 18,
        width: "100%",
        maxWidth: compact ? "100%" : `${Math.max(1, count) * 280 + Math.max(0, count - 1) * 18}px`,
        margin: "0 auto",
        alignItems: "stretch",
      }),
      connectorColor: props?.borderColor || "rgba(96,165,250,0.34)",
      card: () => ({
        display: "grid",
        gridTemplateColumns: compact ? "1fr" : "1fr",
        gap: compact ? 14 : 18,
        alignItems: "start",
        padding: compact ? 16 : 18,
        borderRadius: compact ? 20 : 22,
        border: `1px solid ${border}`,
        background: "rgba(255,255,255,0.96)",
        boxShadow: "0 16px 30px rgba(15,23,42,0.08)",
        position: "relative",
      }),
      cardWrap: () => ({}),
      image: () => ({ width: "100%", aspectRatio: "4 / 3.8", minHeight: compact ? 220 : 240, objectFit: "cover", borderRadius: compact ? 16 : 18, display: "block" }),
      placeholder: () => ({ width: "100%", aspectRatio: "4 / 3.8", minHeight: compact ? 220 : 240, borderRadius: compact ? 16 : 18, display: "grid", placeItems: "center", background: "rgba(191,219,254,0.42)", color: subtle }),
      name: { margin: 0, fontSize: compact ? 20 : 26, fontWeight: 600, color: text },
      role: { margin: "6px 0 0", fontSize: compact ? 12 : 13, textTransform: "uppercase", letterSpacing: "0.14em", color: "#2563eb" },
      bio: { margin: "12px 0 0", fontSize: compact ? 14 : 15, lineHeight: 1.7, color: text },
    };
  }

  if (variant === "editorial-split") {
    return {
      section: { background: props?.backgroundColor || "linear-gradient(180deg,#fffaf2,#f6ead8)", borderColor: props?.borderColor || "rgba(120,98,67,0.16)" },
      header: { maxWidth: 720, margin: "0 auto", textAlign: "center" },
      grid: { display: "grid", gridTemplateColumns: compact ? "1fr" : "minmax(0, 1.2fr) minmax(280px, 0.8fr)", gap: compact ? 16 : 20, marginTop: 18 },
      card: (index) => ({
        display: "grid",
        gridTemplateColumns: compact || index > 0 ? "1fr" : "minmax(260px, 0.95fr) minmax(0, 1fr)",
        gap: compact ? 14 : 18,
        padding: compact ? 16 : 22,
        borderRadius: compact ? 20 : 28,
        border: `1px solid ${border}`,
        background: index === 0 ? "linear-gradient(180deg,rgba(255,250,242,0.98),rgba(246,234,216,0.95))" : "rgba(255,255,255,0.72)",
        boxShadow: "0 18px 36px rgba(120,98,67,0.12)",
      }),
      cardWrap: (index) => index === 0 ? { gridRow: compact ? "auto" : "span 2" } : {},
      image: (index) => ({ width: "100%", height: compact ? 260 : (index === 0 ? "100%" : 220), minHeight: compact ? 260 : (index === 0 ? 420 : 220), objectFit: "cover", borderRadius: compact ? 18 : 24, display: "block" }),
      placeholder: (index) => ({ width: "100%", height: compact ? 260 : (index === 0 ? 420 : 220), minHeight: compact ? 260 : (index === 0 ? 420 : 220), borderRadius: compact ? 18 : 24, display: "grid", placeItems: "center", background: "rgba(120,98,67,0.08)", color: subtle }),
      name: { margin: 0, fontSize: compact ? 22 : 28, fontWeight: 600, color: text },
      role: { margin: "6px 0 0", fontSize: compact ? 13 : 14, textTransform: "uppercase", letterSpacing: "0.12em", color: subtle },
      bio: { margin: "14px 0 0", fontSize: compact ? 14 : 16, lineHeight: 1.7, color: text },
    };
  }

  if (variant === "spotlight-strip") {
    return {
      section: { background: props?.backgroundColor || "linear-gradient(135deg,#020617,#0f172a)", borderColor: props?.borderColor || "rgba(103,232,249,0.18)" },
      header: { maxWidth: 760, margin: "0 auto", textAlign: "center" },
      grid: { display: "grid", gridTemplateColumns: compact ? "1fr" : `repeat(${Math.max(1, Math.min(4, asArray(props?.members).length || 3))}, minmax(0, 1fr))`, gap: compact ? 14 : 18, marginTop: 18 },
      card: (index) => ({
        padding: compact ? 16 : 18,
        borderRadius: compact ? 20 : 24,
        border: `1px solid ${index % 2 === 0 ? "rgba(34,211,238,0.28)" : "rgba(59,130,246,0.24)"}`,
        background: index % 2 === 0 ? "linear-gradient(180deg,rgba(15,23,42,0.88),rgba(8,47,73,0.9))" : "linear-gradient(180deg,rgba(17,24,39,0.92),rgba(30,41,59,0.92))",
        boxShadow: "0 22px 44px rgba(2,6,23,0.32)",
        backdropFilter: "blur(12px)",
      }),
      cardWrap: () => ({}),
      image: () => ({ width: "100%", aspectRatio: "4 / 4.5", objectFit: "cover", borderRadius: compact ? 16 : 20, display: "block" }),
      placeholder: () => ({ width: "100%", aspectRatio: "4 / 4.5", borderRadius: compact ? 16 : 20, display: "grid", placeItems: "center", background: "rgba(148,163,184,0.14)", color: "#cbd5e1" }),
      name: { margin: "14px 0 0", fontSize: compact ? 18 : 20, fontWeight: 600, color: "#f8fafc" },
      role: { margin: "6px 0 0", fontSize: compact ? 12 : 13, textTransform: "uppercase", letterSpacing: "0.14em", color: "#67e8f9" },
      bio: { margin: "12px 0 0", fontSize: compact ? 13 : 14, lineHeight: 1.7, color: "rgba(226,232,240,0.88)" },
    };
  }

  if (variant === "minimal-list") {
    return {
      section: { background: props?.backgroundColor || "linear-gradient(180deg,#ffffff,#f8fafc)", borderColor: props?.borderColor || "rgba(203,213,225,0.85)" },
      header: { maxWidth: 680, margin: "0 auto", textAlign: "center" },
      grid: { display: "grid", gridTemplateColumns: "1fr", gap: compact ? 12 : 14, marginTop: 18 },
      card: () => ({
        display: "grid",
        gridTemplateColumns: compact ? "1fr" : "140px minmax(0, 1fr)",
        gap: compact ? 12 : 18,
        alignItems: "center",
        padding: compact ? 14 : 18,
        borderRadius: compact ? 18 : 22,
        border: `1px solid ${border}`,
        background: "rgba(255,255,255,0.92)",
      }),
      cardWrap: () => ({}),
      image: () => ({ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: compact ? 16 : 18, display: "block" }),
      placeholder: () => ({ width: "100%", aspectRatio: "1 / 1", borderRadius: compact ? 16 : 18, display: "grid", placeItems: "center", background: "#e2e8f0", color: subtle }),
      name: { margin: 0, fontSize: compact ? 20 : 24, fontWeight: 600, color: text },
      role: { margin: "4px 0 0", fontSize: compact ? 13 : 14, color: subtle },
      bio: { margin: "10px 0 0", fontSize: compact ? 14 : 15, lineHeight: 1.7, color: text },
    };
  }

  return {
    section: { background: props?.backgroundColor || "linear-gradient(180deg,#ffffff,#f8fafc)", borderColor: props?.borderColor || "rgba(226,232,240,0.9)" },
    header: { maxWidth: 700, margin: "0 auto", textAlign: "center" },
    grid: { display: "grid", gridTemplateColumns: compact ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: compact ? 14 : 18, marginTop: 18 },
    card: (index) => ({
      borderRadius: compact ? 20 : 24,
      border: `1px solid ${border}`,
      background: index % 2 === 0 ? "linear-gradient(165deg,#ffffff,#f8fafc)" : "linear-gradient(165deg,#eff6ff,#ffffff)",
      overflow: "hidden",
      paddingBottom: compact ? 14 : 18,
      boxShadow: "0 18px 34px rgba(15,23,42,0.12)",
    }),
    cardWrap: () => ({}),
    image: () => ({ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block", marginBottom: 12 }),
    placeholder: () => ({ width: "100%", aspectRatio: "4 / 3", display: "grid", placeItems: "center", background: "#e2e8f0", color: subtle, marginBottom: 12 }),
    name: { margin: "0 16px", fontSize: compact ? 18 : 20, fontWeight: 600, color: text },
    role: { margin: "6px 16px 0", fontSize: compact ? 12 : 13, textTransform: "uppercase", letterSpacing: "0.12em", color: subtle },
    bio: { margin: "12px 16px 0", fontSize: compact ? 14 : 15, lineHeight: 1.7, color: text },
  };
}

function normalizeStatItem(item, index) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return {
      id: item.id || `stat-item-${index}`,
      number: String(item.number || item.value || `0${index + 1}`),
      label: String(item.label || item.title || `Metric ${index + 1}`),
      detail: String(item.detail || item.description || ""),
    };
  }

  return {
    id: `stat-item-${index}`,
    number: String(item || `0${index + 1}`),
    label: `Metric ${index + 1}`,
    detail: "",
  };
}

function statsVariantStyles(props, compact) {
  const variant = String(props?.statsVariant || "editorial-band");
  const text = props?.textColor || "#0f172a";
  const border = props?.borderColor || "rgba(226,232,240,0.92)";
  const cardBackground = props?.cardBackgroundColor || "rgba(255,255,255,0.92)";
  const accent = props?.accentColor || "#0ea5e9";
  const subtle = variant === "spotlight-orbs" || variant === "split-scoreboard"
    ? "rgba(226,232,240,0.8)"
    : "#64748b";

  if (variant === "spotlight-orbs") {
    return {
      section: { background: props?.backgroundColor || "radial-gradient(circle at top,#1d4ed8 0%,#0f172a 58%,#020617 100%)", borderColor: border },
      header: { maxWidth: 760, margin: "0 auto", textAlign: "center" },
      grid: { display: "grid", gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))", gap: compact ? 14 : 18, marginTop: 20 },
      cardWrap: () => ({}),
      card: (index) => ({
        position: "relative",
        minHeight: compact ? 220 : 260,
        borderRadius: "999px",
        padding: compact ? "26px 22px" : "34px 26px",
        border: `1px solid ${index % 2 === 0 ? colorWithAlpha(accent, 0.34) : "rgba(255,255,255,0.16)"}`,
        background: index % 2 === 0 ? `radial-gradient(circle at top, ${colorWithAlpha(accent, 0.34)}, ${cardBackground})` : cardBackground,
        boxShadow: "0 28px 54px rgba(2,6,23,0.3)",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
      }),
      number: { margin: 0, fontSize: compact ? 34 : 46, lineHeight: 1, fontWeight: 600, letterSpacing: "-0.04em", color: "#ffffff" },
      label: { margin: "12px 0 0", fontSize: compact ? 13 : 14, lineHeight: 1.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: accent },
      detail: { margin: "12px 0 0", fontSize: compact ? 13 : 14, lineHeight: 1.7, color: subtle },
    };
  }

  if (variant === "split-scoreboard") {
    return {
      section: { background: props?.backgroundColor || "linear-gradient(135deg,#081120,#17304d)", borderColor: border },
      header: { maxWidth: compact ? "100%" : 420, textAlign: compact ? "center" : "left" },
      grid: { display: "grid", gridTemplateColumns: compact ? "1fr" : "minmax(280px, 1.15fr) minmax(0, 0.85fr)", gap: compact ? 14 : 18, marginTop: compact ? 20 : 0, alignItems: "start" },
      shell: { display: "grid", gridTemplateColumns: compact ? "1fr" : "minmax(0, 0.95fr) minmax(0, 1.05fr)", gap: compact ? 20 : 28, alignItems: "start" },
      cardsShell: { display: "grid", gap: compact ? 12 : 14 },
      cardWrap: (index) => index === 0 ? { gridRow: compact ? "auto" : "span 2" } : {},
      card: (index) => ({
        padding: compact ? "18px 18px" : (index === 0 ? "26px 24px" : "20px 20px"),
        minHeight: compact ? "auto" : (index === 0 ? 260 : 0),
        borderRadius: compact ? 24 : 28,
        border: `1px solid ${index === 0 ? colorWithAlpha(accent, 0.42) : "rgba(255,255,255,0.14)"}`,
        background: index === 0 ? `linear-gradient(180deg, ${colorWithAlpha(accent, 0.34)}, ${cardBackground})` : cardBackground,
        boxShadow: index === 0 ? "0 26px 58px rgba(2,6,23,0.34)" : "0 18px 36px rgba(2,6,23,0.22)",
      }),
      number: (index) => ({ margin: 0, fontSize: compact ? (index === 0 ? 40 : 28) : (index === 0 ? 68 : 34), lineHeight: 0.96, fontWeight: 600, letterSpacing: "-0.05em", color: "#ffffff" }),
      label: { margin: "10px 0 0", fontSize: compact ? 13 : 14, lineHeight: 1.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: accent },
      detail: { margin: "12px 0 0", fontSize: compact ? 13 : 14, lineHeight: 1.7, color: subtle },
    };
  }

  if (variant === "minimal-ticker") {
    return {
      section: { background: props?.backgroundColor || "linear-gradient(180deg,#ffffff,#f8fafc)", borderColor: border },
      header: { maxWidth: 680, margin: "0 auto", textAlign: "center" },
      grid: { display: "grid", gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))", gap: compact ? 10 : 12, marginTop: 18 },
      cardWrap: () => ({}),
      card: () => ({
        padding: compact ? "14px 16px" : "16px 18px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: cardBackground,
        display: "grid",
        gap: 4,
        alignItems: "center",
        boxShadow: "0 12px 24px rgba(15,23,42,0.08)",
      }),
      number: { margin: 0, fontSize: compact ? 26 : 30, lineHeight: 1, fontWeight: 600, letterSpacing: "-0.04em", color: text },
      label: { margin: 0, fontSize: compact ? 13 : 14, lineHeight: 1.5, fontWeight: 600, color: text },
      detail: { margin: 0, fontSize: compact ? 12 : 13, lineHeight: 1.6, color: subtle },
    };
  }

  if (variant === "data-ribbon") {
    return {
      section: { background: props?.backgroundColor || "linear-gradient(135deg,#f8fbff,#eef7ff)", borderColor: border },
      header: { maxWidth: compact ? "100%" : 360, textAlign: compact ? "center" : "left" },
      shell: { display: "grid", gridTemplateColumns: compact ? "1fr" : "minmax(260px, 0.8fr) minmax(0, 1.2fr)", gap: compact ? 18 : 28, alignItems: "start" },
      grid: { display: "grid", gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))", gap: compact ? 10 : 12 },
      cardWrap: () => ({}),
      card: (index) => ({
        padding: compact ? "18px 16px" : "22px 18px",
        borderRadius: 18,
        border: `1px solid ${index % 2 === 0 ? colorWithAlpha(accent, 0.22) : border}`,
        background: cardBackground,
        boxShadow: "0 14px 30px rgba(37,99,235,0.08)",
        position: "relative",
        overflow: "hidden",
      }),
      accentBar: { position: "absolute", left: 14, right: 14, top: 0, height: 4, borderRadius: 999, background: `linear-gradient(90deg, ${accent}, ${colorWithAlpha(accent, 0.32)})` },
      number: { margin: "10px 0 0", fontSize: compact ? 28 : 34, lineHeight: 0.98, fontWeight: 600, letterSpacing: "-0.04em", color: text },
      label: { margin: "10px 0 0", fontSize: compact ? 12 : 13, lineHeight: 1.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: accent },
      detail: { margin: "10px 0 0", fontSize: compact ? 12 : 13, lineHeight: 1.65, color: subtle },
    };
  }

  return {
    section: { background: props?.backgroundColor || "linear-gradient(180deg,#fffaf2,#f6ead8)", borderColor: border },
    header: { maxWidth: 720, margin: "0 auto", textAlign: "center" },
    grid: { display: "grid", gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))", gap: compact ? 14 : 18, marginTop: 18 },
    cardWrap: () => ({}),
    card: (index) => ({
      padding: compact ? "18px 18px" : "22px 22px",
      borderRadius: compact ? 22 : 28,
      border: `1px solid ${border}`,
      background: index % 2 === 0 ? `linear-gradient(180deg, ${cardBackground}, rgba(255,255,255,0.98))` : "rgba(255,255,255,0.74)",
      boxShadow: "0 18px 38px rgba(120,98,67,0.12)",
      position: "relative",
      overflow: "hidden",
    }),
    number: { margin: 0, fontSize: compact ? 36 : 48, lineHeight: 0.98, fontWeight: 600, letterSpacing: "-0.05em", color: text },
    label: { margin: "12px 0 0", fontSize: compact ? 13 : 14, lineHeight: 1.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: accent },
    detail: { margin: "12px 0 0", fontSize: compact ? 13 : 14, lineHeight: 1.7, color: subtle },
    accentBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: `linear-gradient(180deg, ${accent}, ${colorWithAlpha(accent, 0.3)})` },
  };
}

function imageGalleryVariantStyles(props, compact) {
  const variant = String(props.galleryVariant || "balanced-grid");

  if (variant === "editorial-mosaic") {
    return {
      grid: {
        display: "grid",
        gap: compact ? 12 : 18,
        gridTemplateColumns: compact ? "1fr" : "1.15fr 0.85fr 0.85fr",
        gridAutoRows: compact ? "220px" : "200px",
      },
      card: (idx) => ({
        borderRadius: 24,
        overflow: "hidden",
        border: `1px solid ${props.borderColor || "rgba(120,98,67,0.16)"}`,
        boxShadow: "0 24px 52px rgba(120,98,67,0.12)",
        background: "#f8fafc",
        ...(compact ? {} : (idx === 0 ? { gridRow: "span 2" } : idx === 1 ? { gridColumn: "span 2" } : {})),
      }),
      image: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
      captionWrap: { position: "absolute", left: 16, right: 16, bottom: 16, display: "grid", gap: 4 },
      caption: { margin: 0, color: "#fffaf2", fontSize: 16, lineHeight: 1.45, fontWeight: 600, textShadow: "0 6px 18px rgba(15,23,42,0.55)" },
    };
  }

  if (variant === "polaroid-wall") {
    return {
      grid: {
        display: "grid",
        gap: compact ? 14 : 18,
        gridTemplateColumns: `repeat(${Math.max(1, Number(props.columns) || 3)}, minmax(0, 1fr))`,
      },
      card: (idx) => ({
        borderRadius: 8,
        overflow: "visible",
        border: `1px solid ${props.borderColor || "rgba(191,219,254,0.9)"}`,
        background: "#ffffff",
        boxShadow: "0 18px 34px rgba(15,23,42,0.12)",
        padding: 10,
        transform: compact ? "none" : `rotate(${idx % 2 === 0 ? -2.2 : 2.1}deg)`,
      }),
      image: { width: "100%", height: compact ? 180 : 210, objectFit: "cover", display: "block" },
      captionWrap: { padding: "10px 6px 4px" },
      caption: { margin: 0, color: props.textColor || "#0f172a", fontSize: 16, lineHeight: 1.45, fontWeight: 600, textAlign: "center" },
    };
  }

  if (variant === "spotlight-strip") {
    return {
      grid: {
        display: "grid",
        gap: compact ? 12 : 16,
        gridTemplateColumns: compact ? "1fr" : `minmax(0, 1.4fr) repeat(${Math.max(1, Math.min(3, (Number(props.columns) || 3) - 1 || 2))}, minmax(0, 0.8fr))`,
      },
      card: (idx) => ({
        position: "relative",
        borderRadius: 24,
        overflow: "hidden",
        border: `1px solid ${props.borderColor || "rgba(103,232,249,0.18)"}`,
        boxShadow: idx === 0 ? "0 28px 58px rgba(8,47,73,0.32)" : "0 18px 34px rgba(15,23,42,0.2)",
        background: "#0f172a",
        minHeight: idx === 0 ? (compact ? 220 : 320) : (compact ? 220 : 320),
      }),
      image: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
      captionWrap: { position: "absolute", inset: "auto 0 0 0", padding: "46px 18px 18px", background: "linear-gradient(180deg, rgba(2,6,23,0), rgba(2,6,23,0.82))" },
      caption: { margin: 0, color: "#f8fafc", fontSize: 16, lineHeight: 1.45, fontWeight: 600 },
    };
  }

  return {
    grid: {
      display: "grid",
      gap: 12,
      gridTemplateColumns: `repeat(${Math.max(1, Number(props.columns) || 3)}, minmax(0, 1fr))`,
    },
    card: () => ({
      borderRadius: 18,
      overflow: "hidden",
      background: "#e2e8f0",
      minHeight: 160,
      border: `1px solid ${props.borderColor || "rgba(226,232,240,0.9)"}`,
      boxShadow: "0 18px 30px rgba(15,23,42,0.12)",
    }),
    image: { width: "100%", height: "100%", minHeight: 160, objectFit: "cover", display: "block" },
    captionWrap: { padding: "12px 14px" },
    caption: { margin: 0, color: props.textColor || "#0f172a", fontSize: 16, lineHeight: 1.45, fontWeight: 600 },
  };
}

function pricingVariantStyles(props) {
  const variant = props.pricingVariant || "premium";
  if (variant === "clean") {
    return {
      section: {
        background: props.backgroundColor || "#ffffff",
        borderColor: props.borderColor || "rgba(203,213,225,0.8)",
      },
      sectionTitleColor: props.textColor || "#0f172a",
      grid: () => ({ gap: 18 }),
      card: (highlighted, compact) => ({
        borderRadius: compact ? 16 : 18,
        padding: compact ? 18 : 24,
        border: highlighted ? "2px solid #2563eb" : "1px solid #dbe3ef",
        background: "#ffffff",
        boxShadow: "none",
        transform: "none",
        position: "relative",
      }),
      badgeBackground: () => "#2563eb",
      featureRow: () => ({ background: "#ffffff", border: "1px solid rgba(226,232,240,0.95)" }),
      featureIcon: () => ({ background: "#eff6ff", color: "#2563eb" }),
      extrasCard: () => ({ background: "#f8fafc", border: "1px solid rgba(226,232,240,0.95)" }),
      cta: (highlighted) => ({ color: highlighted ? "#ffffff" : "#2563eb", background: highlighted ? "#2563eb" : "#ffffff", boxShadow: "none", border: highlighted ? "1px solid #2563eb" : "1px solid #bfdbfe" }),
      textTone: () => ({ text: props.textColor || "#0f172a", subtle: props.subtleTextColor || "#64748b" }),
      badge: null,
    };
  }

  if (variant === "contrast") {
    const palette = [
      { card: "linear-gradient(180deg,#ffffff,#f8fafc)", text: "#0f172a", subtle: "#64748b", accent: "#2563eb", featureBg: "rgba(37,99,235,0.06)" },
      { card: "linear-gradient(180deg,#3730a3,#312e81)", text: "#ffffff", subtle: "#c7d2fe", accent: "#f472b6", featureBg: "rgba(255,255,255,0.12)" },
      { card: "linear-gradient(180deg,#020617,#111827)", text: "#ffffff", subtle: "#cbd5e1", accent: "#22d3ee", featureBg: "rgba(255,255,255,0.08)" },
    ];
    return {
      section: {
        background: props.backgroundColor || "linear-gradient(180deg,#ffffff,#f3f4f6)",
        borderColor: props.borderColor || "rgba(148,163,184,0.18)",
      },
      card: (highlighted, compact, index = 0) => {
        const tone = palette[index % palette.length];
        return {
          borderRadius: compact ? 20 : 28,
          padding: compact ? 18 : 24,
          border: highlighted ? `2px solid ${tone.accent}` : "1px solid rgba(148,163,184,0.16)",
          background: tone.card,
          color: tone.text,
          boxShadow: highlighted ? `0 28px 56px ${colorWithAlpha(tone.accent, 0.26)}` : "0 14px 28px rgba(15,23,42,0.12)",
          transform: highlighted && !compact ? "scale(1.05) translateY(-8px)" : "none",
          position: "relative",
          overflow: "hidden",
        };
      },
      badgeBackground: (_highlighted, index = 0) => `linear-gradient(135deg,${palette[index % palette.length].accent},#ffffff22)`,
      featureRow: (highlighted, index = 0) => ({ background: palette[index % palette.length].featureBg, border: highlighted ? `1px solid ${colorWithAlpha(palette[index % palette.length].accent, 0.26)}` : "1px solid rgba(255,255,255,0.08)" }),
      featureIcon: (highlighted, index = 0) => ({ background: `linear-gradient(135deg,${palette[index % palette.length].accent},${colorWithAlpha(palette[index % palette.length].accent, 0.7)})`, color: "#ffffff" }),
      extrasCard: (_highlighted, index = 0) => ({ background: colorWithAlpha(palette[index % palette.length].accent, 0.12), border: `1px solid ${colorWithAlpha(palette[index % palette.length].accent, 0.2)}` }),
      cta: (_highlighted, index = 0) => ({ color: "#ffffff", background: `linear-gradient(135deg,${palette[index % palette.length].accent},${colorWithAlpha(palette[index % palette.length].accent, 0.72)})`, boxShadow: `0 18px 28px ${colorWithAlpha(palette[index % palette.length].accent, 0.28)}` }),
      textTone: (index = 0) => palette[index % palette.length],
      badge: "Featured",
    };
  }

  if (variant === "spotlight") {
    return {
      section: {
        background: props.backgroundColor || "linear-gradient(180deg,#fdfbff,#f4f3ff)",
        borderColor: props.borderColor || "rgba(168,85,247,0.18)",
      },
      card: (highlighted, compact, index = 0) => ({
        borderRadius: compact ? 22 : 30,
        padding: compact ? 18 : 24,
        border: highlighted ? "2px solid rgba(244,114,182,0.5)" : "1px solid rgba(196,181,253,0.45)",
        background: highlighted
          ? "linear-gradient(180deg,#ffffff,#fff7fb 42%,#f5f3ff)"
          : (index % 2 === 0 ? "linear-gradient(180deg,#ffffff,#faf5ff)" : "linear-gradient(180deg,#ffffff,#eff6ff)"),
        boxShadow: highlighted ? "0 30px 60px rgba(236,72,153,0.18), 0 0 0 1px rgba(168,85,247,0.12) inset" : "0 16px 30px rgba(168,85,247,0.08)",
        transform: highlighted && !compact ? "scale(1.06) translateY(-10px)" : "none",
        position: "relative",
        overflow: "hidden",
      }),
      badgeBackground: () => "linear-gradient(135deg,#fb7185,#8b5cf6)",
      featureRow: (highlighted, index = 0) => ({ background: highlighted ? "rgba(251,113,133,0.08)" : (index % 2 === 0 ? "rgba(139,92,246,0.06)" : "rgba(59,130,246,0.06)"), border: "1px solid rgba(196,181,253,0.34)" }),
      featureIcon: (highlighted) => ({ background: highlighted ? "linear-gradient(135deg,#fb7185,#8b5cf6)" : "linear-gradient(135deg,#c4b5fd,#93c5fd)", color: "#ffffff" }),
      extrasCard: () => ({ background: "linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,243,255,0.9))", border: "1px solid rgba(196,181,253,0.4)" }),
      cta: (highlighted) => ({ color: "#ffffff", background: highlighted ? "linear-gradient(135deg,#fb7185,#8b5cf6)" : "linear-gradient(135deg,#8b5cf6,#3b82f6)", boxShadow: highlighted ? "0 18px 32px rgba(139,92,246,0.28)" : "0 14px 24px rgba(59,130,246,0.18)" }),
      badge: "Popular",
    };
  }

  if (variant === "matrix") {
    return {
      section: {
        background: props.backgroundColor || "linear-gradient(180deg,#f8fafc,#eef2f7)",
        borderColor: props.borderColor || "rgba(148,163,184,0.24)",
      },
      sectionTitleColor: props.textColor || "#0f172a",
      grid: (compact, count = 3) => compact ? {} : ({ gap: 0, gridTemplateColumns: count === 3 ? "repeat(3, minmax(0, 1fr))" : `repeat(${Math.max(1, count)}, minmax(0, 1fr))` }),
      card: (highlighted, compact, index = 0) => ({
        borderRadius: compact ? 16 : (index === 0 ? "18px 0 0 18px" : index === 2 ? "0 18px 18px 0" : 0),
        padding: compact ? 16 : 20,
        border: highlighted ? "2px solid #10b981" : "1px solid rgba(203,213,225,0.9)",
        background: highlighted ? "linear-gradient(180deg,#ecfdf5,#ffffff)" : "#ffffff",
        boxShadow: "none",
        transform: "none",
        position: "relative",
        overflow: "hidden",
        marginLeft: compact || index === 0 ? 0 : -1,
      }),
      badgeBackground: () => "linear-gradient(135deg,#10b981,#059669)",
      featureRow: (highlighted) => ({ background: highlighted ? "#f0fdf4" : "#f8fafc", border: "1px solid rgba(226,232,240,0.95)" }),
      featureIcon: (highlighted) => ({ background: highlighted ? "#10b981" : "#e2e8f0", color: highlighted ? "#ffffff" : "#334155" }),
      extrasCard: () => ({ background: "#f8fafc", border: "1px solid rgba(226,232,240,0.95)" }),
      cta: (highlighted) => ({ color: highlighted ? "#ffffff" : "#0f172a", background: highlighted ? "#10b981" : "#f8fafc", boxShadow: "none", border: highlighted ? "1px solid #10b981" : "1px solid rgba(203,213,225,0.9)" }),
      textTone: () => ({ text: props.textColor || "#0f172a", subtle: props.subtleTextColor || "#64748b" }),
      badge: "Best Value",
    };
  }

  return {
    section: {
      background: props.backgroundColor || "linear-gradient(135deg,#081120,#10213a 55%,#132c47)",
      borderColor: props.borderColor || "rgba(56,189,248,0.18)",
    },
    sectionTitleColor: props.textColor || "#f8fafc",
    grid: () => ({ gap: 24 }),
    card: (highlighted, compact) => ({
      borderRadius: compact ? 22 : 30,
      padding: compact ? 18 : 26,
      border: highlighted ? "2px solid rgba(250,204,21,0.7)" : "1px solid rgba(148,163,184,0.18)",
      background: highlighted ? "linear-gradient(180deg,#fff7d6,#ffffff 48%,#fef3c7)" : "linear-gradient(180deg,rgba(15,23,42,0.82),rgba(17,24,39,0.94))",
      boxShadow: highlighted ? "0 34px 70px rgba(250,204,21,0.18)" : "0 24px 44px rgba(2,6,23,0.42)",
      transform: highlighted && !compact ? "scale(1.06) translateY(-10px)" : "translateY(0)",
      position: "relative",
      overflow: "hidden",
    }),
    badgeBackground: (highlighted) => highlighted ? "linear-gradient(135deg,#f59e0b,#facc15)" : "linear-gradient(135deg,#0ea5e9,#2563eb)",
    featureRow: (highlighted) => ({ background: highlighted ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.06)", border: highlighted ? "1px solid rgba(245,158,11,0.2)" : "1px solid rgba(255,255,255,0.08)" }),
    featureIcon: (highlighted) => ({ background: highlighted ? "linear-gradient(135deg,#f59e0b,#facc15)" : "linear-gradient(135deg,#0ea5e9,#38bdf8)", color: "#ffffff" }),
    extrasCard: (highlighted) => ({ background: highlighted ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.04)", border: highlighted ? "1px solid rgba(245,158,11,0.22)" : "1px solid rgba(255,255,255,0.08)" }),
    cta: (highlighted) => ({ color: highlighted ? "#1f2937" : "#ffffff", background: highlighted ? "linear-gradient(135deg,#f59e0b,#facc15)" : "linear-gradient(135deg,#0ea5e9,#2563eb)", boxShadow: highlighted ? "0 18px 30px rgba(245,158,11,0.28)" : "0 16px 28px rgba(14,165,233,0.28)" }),
    textTone: (_index, highlighted = false) => ({ text: highlighted ? "#111827" : "#f8fafc", subtle: highlighted ? "#6b7280" : "#cbd5e1" }),
    badge: "Most Popular",
  };
}

function iconGlyph(icon) {
  const map = {
    tick: "✓",
    arrow: "➜",
    spark: "✦",
    diamond: "◆",
  };
  return map[String(icon || "tick")] || map.tick;
}

function normalizePricingPlan(plan = {}, index = 0) {
  const includedFeatures = (Array.isArray(plan.includedFeatures) && plan.includedFeatures.length
    ? plan.includedFeatures
    : Array.isArray(plan.features) && plan.features.length
      ? plan.features
      : ["Feature 1", "Feature 2", "Feature 3"])
    .map((item) => htmlToPlainText(item));

  return {
    id: plan.id || `pricing-plan-${index}`,
    name: htmlToPlainText(plan.name || `Plan ${index + 1}`),
    price: htmlToPlainText(plan.price || "$49"),
    description: htmlToPlainText(plan.description || "Plan summary"),
    includedFeatures,
    features: includedFeatures,
    extras: (Array.isArray(plan.extras) ? plan.extras : []).map((item) => htmlToPlainText(item)),
    featureIcon: String(plan.featureIcon || "tick"),
    cardBackgroundColor: String(plan.cardBackgroundColor || ""),
    textColor: String(plan.textColor || ""),
    subtleTextColor: String(plan.subtleTextColor || ""),
    ctaTextColor: String(plan.ctaTextColor || ""),
    badge: "",
    cta: htmlToPlainText(plan.cta || "Get Started"),
    highlighted: !!plan.highlighted,
  };
}

function navVariantTheme(props, compact) {
  const variant = props.variant || "split-dark";
  const bg = props.backgroundColor || "#0b1220";
  const fg = props.textColor || "#e2e8f0";
  const border = props.borderColor || "rgba(148,163,184,0.24)";
  const buttonBg = props.buttonColor || "#ffffff";
  const buttonFg = props.buttonTextColor || "#0f172a";
  const buttonRadius = Number.isFinite(Number(props.buttonRadius)) ? Number(props.buttonRadius) : 999;

  const base = {
    shell: {
      borderRadius: compact ? 14 : 18,
      border: compact ? `1px solid ${border}` : `1px solid ${border}`,
      background: bg,
      color: fg,
      padding: compact ? "12px 14px" : "14px 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    },
    brand: {
      margin: 0,
      fontSize: Math.max(MIN_TEXT_SIZE, compact ? Math.max(12, Number(props.brandFontSize) - 2 || 14) : Number(props.brandFontSize) || 16),
      fontWeight: 600,
      letterSpacing: "-0.02em",
    },
    brandRow: {
      display: "flex",
      alignItems: "center",
      gap: compact ? 10 : 12,
      minWidth: 0,
    },
    logo: {
      width: compact ? Math.max(24, Number(props.logoWidth) - 8 || 32) : Number(props.logoWidth) || 44,
      height: "auto",
      objectFit: "contain",
      display: "block",
      flexShrink: 0,
    },
    links: {
      display: "flex",
      gap: compact ? 8 : 16,
      flexWrap: "wrap",
      alignItems: "center",
    },
    link: {
      color: fg,
      textDecoration: "none",
      fontSize: Math.max(MIN_TEXT_SIZE, compact ? Math.max(11, Number(props.linkFontSize) - 2 || 12) : Number(props.linkFontSize) || 14),
      fontWeight: 600,
      opacity: 0.9,
      padding: compact ? "6px 8px" : "8px 10px",
      borderRadius: 999,
      minHeight: MIN_TAP_SIZE,
      minWidth: MIN_TAP_SIZE,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background 0.18s ease, color 0.18s ease, transform 0.18s ease, opacity 0.18s ease",
    },
    cta: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: MIN_TAP_SIZE,
      minWidth: MIN_TAP_SIZE,
      textDecoration: "none",
      background: buttonBg,
      color: buttonFg,
      borderRadius: buttonRadius,
      padding: compact ? "8px 12px" : "10px 14px",
      fontSize: Math.max(MIN_TEXT_SIZE, compact ? Math.max(11, Number(props.ctaFontSize) - 1 || 12) : Number(props.ctaFontSize) || 13),
      fontWeight: 600,
    },
  };

  if (variant === "centered-light") {
    return {
      ...base,
      shell: {
        ...base.shell,
        background: bg,
        justifyContent: "center",
        padding: compact ? "14px" : "18px 20px",
      },
      brand: {
        ...base.brand,
        width: "100%",
        textAlign: "center",
        fontSize: Math.max(MIN_TEXT_SIZE, compact ? 15 : 18),
      },
      links: {
        ...base.links,
        justifyContent: "center",
      },
      link: {
        ...base.link,
        opacity: 1,
      },
      cta: {
        ...base.cta,
        boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
      },
    };
  }

  if (variant === "minimal-line") {
    return {
      ...base,
      shell: {
        ...base.shell,
        borderRadius: compact ? 10 : 12,
        border: "none",
        borderBottom: `1px solid ${border}`,
        padding: compact ? "10px 0 12px" : "14px 0 16px",
        background: "transparent",
      },
      cta: {
        ...base.cta,
        borderRadius: 12,
      },
    };
  }

  if (variant === "boxed-brand") {
    return {
      ...base,
      brand: {
        ...base.brand,
        padding: compact ? "8px 12px" : "10px 14px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.16)",
      },
      link: {
        ...base.link,
        opacity: 1,
      },
      cta: {
        ...base.cta,
        borderRadius: 12,
      },
    };
  }

  return base;
}

function contactFormVariantStyles(props, compact) {
  const variant = String(props?.formVariant || "minimal-soft");

  if (variant === "editorial-split") {
    return {
      shell: {
        borderRadius: compact ? 24 : 30,
        padding: compact ? 18 : 24,
        boxShadow: "0 22px 48px rgba(120,98,67,0.16)",
        border: "1px solid rgba(120,98,67,0.12)",
      },
      media: {
        borderRadius: compact ? 20 : 28,
        minHeight: compact ? 220 : 520,
        objectFit: "cover",
      },
    };
  }

  if (variant === "stacked-glow") {
    return {
      shell: {
        borderRadius: compact ? 22 : 28,
        padding: compact ? 18 : 24,
        boxShadow: "0 24px 60px rgba(8,145,178,0.18)",
        border: "1px solid rgba(103,232,249,0.5)",
        backdropFilter: "blur(10px)",
      },
      media: {
        borderRadius: compact ? 20 : 26,
        minHeight: compact ? 180 : 260,
        objectFit: "cover",
      },
    };
  }

  if (variant === "dark-glass") {
    return {
      shell: {
        borderRadius: compact ? 24 : 30,
        padding: compact ? 18 : 24,
        boxShadow: "0 28px 70px rgba(2,6,23,0.42)",
        border: "1px solid rgba(148,163,184,0.2)",
        backdropFilter: "blur(14px)",
      },
      media: {
        borderRadius: compact ? 20 : 28,
        minHeight: compact ? 220 : 540,
        objectFit: "cover",
      },
    };
  }

  return {
    shell: {
      borderRadius: compact ? 22 : 26,
      padding: compact ? 18 : 24,
      boxShadow: "0 18px 36px rgba(15,23,42,0.08)",
      border: "1px solid rgba(203,213,225,0.8)",
    },
    media: {
      borderRadius: compact ? 18 : 24,
      minHeight: compact ? 180 : 240,
      objectFit: "cover",
    },
  };
}

const DEFAULT_ENQUIRY_BOOKING_URL = "https://nonfat-ungored-buford.ngrok-free.dev/u/gr8result?service=f775fc69-f59e-4fd8-ae4a-1e9bb7ecfe4f";

function resolveContactBookingUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "/u/your-username") return DEFAULT_ENQUIRY_BOOKING_URL;
  return raw;
}

function trustBadgeVariantStyles(props, compact, backgroundImage) {
  const variant = String(props?.trustBadgeVariant || "pill-row");
  const textColor = props?.textColor || "#0f172a";
  const borderColor = props?.borderColor || "#cbd5e1";
  const badgeBackground = props?.badgeBackgroundColor || "linear-gradient(165deg,#ffffff,#f1f5f9)";
  const iconSize = Math.max(10, Number(props?.badgeIconSize) || 18);
  const fontSize = Math.max(10, Number(props?.badgeFontSize) || 15);
  const badgePadding = Math.max(6, Number(props?.badgePadding) || 14);

  const rowJustify = variant === "logo-strip" ? "center" : variant === "soft-cards" ? "flex-start" : "center";
  const rowDisplay = variant === "soft-cards" ? "grid" : "flex";
  const rowColumns = variant === "soft-cards"
    ? `repeat(auto-fit, minmax(${compact ? 160 : 210}px, max-content))`
    : undefined;

  const base = {
    section: {
      ...sharedStyles.cardSection(compact, props),
      background: backgroundImage
        ? `linear-gradient(rgba(15,23,42,0.18), rgba(15,23,42,0.18)), url(${backgroundImage}) center / cover no-repeat`
        : (props?.backgroundColor || undefined),
    },
    row: {
      display: rowDisplay,
      gap: compact ? 10 : 12,
      flexWrap: "wrap",
      justifyContent: rowJustify,
      gridTemplateColumns: rowColumns,
      alignItems: "stretch",
    },
    badge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      borderRadius: variant === "soft-cards" ? 22 : variant === "logo-strip" ? 14 : 999,
      padding: compact ? `${Math.max(6, badgePadding - 2)}px ${Math.max(8, badgePadding)}px` : `${Math.max(8, badgePadding)}px ${Math.max(10, badgePadding + 4)}px`,
      background: badgeBackground,
      border: `1px solid ${borderColor}`,
      color: textColor,
      fontWeight: 600,
      fontSize,
      boxShadow:
        variant === "dark-glass"
          ? "0 18px 30px rgba(15,23,42,0.34)"
          : variant === "soft-cards"
            ? "0 16px 26px rgba(15,23,42,0.14)"
            : variant === "logo-strip"
              ? "none"
              : "0 10px 20px rgba(15,23,42,0.1)",
      backdropFilter: variant === "dark-glass" ? "blur(10px)" : "none",
      minWidth: variant === "logo-strip" ? (compact ? 140 : 180) : variant === "soft-cards" ? (compact ? 150 : 200) : undefined,
      justifyContent: variant === "logo-strip" ? "center" : variant === "soft-cards" ? "flex-start" : undefined,
      flexDirection: variant === "soft-cards" ? "column" : "row",
      textAlign: variant === "soft-cards" ? "center" : "left",
      backgroundClip: "padding-box",
      opacity: variant === "logo-strip" ? 0.96 : 1,
    },
    icon: {
      fontSize: variant === "logo-strip" ? Math.max(iconSize, compact ? 18 : 22) : iconSize,
      opacity: variant === "dark-glass" ? 0.96 : 1,
    },
  };

  if (variant === "pill-row") {
    return {
      ...base,
      badge: {
        ...base.badge,
        background: badgeBackground,
        borderRadius: 999,
      },
    };
  }

  if (variant === "soft-cards") {
    return {
      ...base,
      badge: {
        ...base.badge,
        alignItems: "center",
        justifyContent: "center",
        padding: compact ? `${Math.max(10, badgePadding)}px` : `${Math.max(14, badgePadding + 4)}px`,
      },
    };
  }

  if (variant === "dark-glass") {
    return {
      ...base,
      section: {
        ...base.section,
        background: backgroundImage
          ? `linear-gradient(rgba(2,6,23,0.52), rgba(2,6,23,0.58)), url(${backgroundImage}) center / cover no-repeat`
          : (props?.backgroundColor || "linear-gradient(135deg,#020617,#0f172a)"),
      },
      badge: {
        ...base.badge,
        background: props?.badgeBackgroundColor || "rgba(15,23,42,0.68)",
      },
    };
  }

  if (variant === "logo-strip") {
    return {
      ...base,
      badge: {
        ...base.badge,
        background: props?.badgeBackgroundColor || "rgba(255,255,255,0.72)",
        borderRadius: 14,
        boxShadow: "none",
      },
    };
  }

  return base;
}

function resolveNewsletterButtonUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(mailto:|https?:|tel:|#|\/)/i.test(raw)) return raw;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return `mailto:${raw}`;
  return raw;
}

function resolveFooterEmailHref(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^mailto:/i.test(raw)) return raw;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return `mailto:${raw}`;
  return raw;
}

function resolveFooterPhoneHref(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^tel:/i.test(raw)) return raw;
  const digits = raw.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

function buildNewsletterMailtoHref(destination, subscriberEmail, brandName) {
  const emailHref = resolveFooterEmailHref(destination);
  if (!emailHref) return "";
  const recipient = emailHref.replace(/^mailto:/i, "").split("?")[0];
  if (!recipient) return "";
  const subject = encodeURIComponent(`Newsletter signup${brandName ? ` - ${brandName}` : ""}`);
  const body = encodeURIComponent(`Please add this subscriber to the newsletter list:\n\nEmail: ${subscriberEmail || "Not provided"}`);
  return `mailto:${recipient}?subject=${subject}&body=${body}`;
}

function buildNavLinkStyle(props, theme, highlighted = false) {
  if (!highlighted) return { ...theme.link };

  return {
    ...theme.link,
    background: props.activeLinkBackgroundColor || "rgba(255,255,255,0.18)",
    color: props.activeLinkTextColor || props.textColor || "#ffffff",
    opacity: 1,
  };
}

function applyNavHoverEffect(event, props, active) {
  if (active) return;
  const effect = props.linkHoverEffect || "fill";
  const hoverBg = props.linkHoverBackgroundColor || "rgba(255,255,255,0.14)";
  const hoverText = props.linkHoverTextColor || props.textColor || "#ffffff";
  const node = event.currentTarget;

  if (effect === "underline") {
    node.style.textDecoration = "underline";
    node.style.textUnderlineOffset = "4px";
    node.style.opacity = "1";
    return;
  }

  if (effect === "lift") {
    node.style.background = hoverBg;
    node.style.color = hoverText;
    node.style.transform = "translateY(-2px)";
    node.style.opacity = "1";
    return;
  }

  if (effect === "fill") {
    node.style.background = hoverBg;
    node.style.color = hoverText;
    node.style.opacity = "1";
  }
}

function resetNavHoverEffect(event, props, link) {
  if (link?.highlighted || link?.__isCurrentPage) return;
  const node = event.currentTarget;
  node.style.background = "transparent";
  node.style.color = props.textColor || "#e2e8f0";
  node.style.transform = "translateY(0)";
  node.style.opacity = "0.9";
  node.style.textDecoration = "none";
  node.style.textUnderlineOffset = "0px";
}

function findScrollParent(node) {
  if (typeof window === "undefined") return null;
  let current = node?.parentElement || null;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = `${style.overflowY || ""} ${style.overflow || ""}`;
    if (/(auto|scroll|overlay)/i.test(overflowY)) {
      return current;
    }
    current = current.parentElement;
  }
  return window;
}

function getBrandInitials(brand = "") {
  const words = String(brand || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "GB";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

function BrandMark({ brand, logoSrc, size = 44, background = "#0f172a", color = "#ffffff", borderColor = "rgba(148,163,184,0.28)", borderRadius = 10 }) {
  if (logoSrc) {
    return <img src={logoSrc} alt={brand || "Brand logo"} style={{ width: size, height: "auto", objectFit: "contain", display: "block", borderRadius: 6 }} />;
  }

  return (
    <div
      aria-label={brand || "Brand mark"}
      title={brand || "Brand mark"}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius,
        display: "grid",
        placeItems: "center",
        fontSize: Math.max(14, Math.round(size * 0.34)),
        fontWeight: 800,
        letterSpacing: "0.08em",
        background,
        color,
        border: `1px solid ${borderColor}`,
        boxSizing: "border-box",
      }}
    >
      {getBrandInitials(brand)}
    </div>
  );
}

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
    const node = shellRef.current;
    if (!node) return undefined;

    const updateHeight = () => {
      setNavHeight(Math.ceil(node.getBoundingClientRect().height || 0));
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);

    let resizeObserver;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(node);
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
    <section ref={shellRef} style={asStyleObject(shellStyle)}>
      <div style={asStyleObject(navTheme.brandRow)}>
        {blockProps.showLogo ? (
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
        <a href={blockProps.ctaLink || "#contact"} style={asStyleObject(navTheme.cta)}>
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
            minHeight: navHeight || undefined,
            paddingTop: shouldUseFixedNav || shouldUseStickyEditor ? (navHeight || 0) : 0,
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

function cleanInlineEditorHtml(value) {
  return String(value || "")
    .replace(/\u200b/g, "")
    .replace(/<span\b([^>]*)>\s*<\/span>/gi, "");
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

function LayeredImageStackBlock({ blockProps, compact, assets, editor = false, onChangeBlock, onUploadLayerImage }) {
  const dragRef = React.useRef(null);
  const fileInputRefs = React.useRef({});
  const canvasRef = React.useRef(null);
  const latestPropsRef = React.useRef(blockProps || {});
  const latestLayersRef = React.useRef([]);
  const [canvasWidth, setCanvasWidth] = React.useState(0);
  const gridSize = compact ? 20 : 24;
  const snapEnabled = blockProps?.showGrid !== false && blockProps?.snapToGrid !== false;
  const fullWidthBlock = blockProps?.fullWidthBackground !== false;
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

  const bounds = layers.reduce((acc, layer) => {
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
  const baseLayoutWidth = Number(blockProps?.baseLayoutWidth || 1100);
  const responsiveScale = !editor && !compact && canvasWidth > 0
    ? Math.min(1, Math.max(0.6, canvasWidth / baseLayoutWidth))
    : 1;
  const previewOffsetX = !editor && !compact && canvasWidth > 0
    ? Math.max(0, Math.round((canvasWidth - (baseLayoutWidth * responsiveScale)) / 2))
    : 0;
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
    latestLayersRef.current = layers;
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

  React.useEffect(() => {
    if (!editor || typeof onChangeBlock !== "function") return;
    const node = canvasRef.current;
    const measuredWidth = Math.round(node?.clientWidth || 0);
    const savedWidth = Math.round(Number(latestPropsRef.current?.baseLayoutWidth || 0));
    if (measuredWidth > 0 && Math.abs(measuredWidth - savedWidth) > 1) {
      onChangeBlock({ ...latestPropsRef.current, baseLayoutWidth: measuredWidth });
    }
  }, [editor, onChangeBlock, canvasWidth]);

  function applyLayerUpdate(nextLayers) {
    if (typeof onChangeBlock !== "function") return;
    onChangeBlock({
      ...latestPropsRef.current,
      baseLayoutWidth: Math.round(canvasRef.current?.clientWidth || latestPropsRef.current?.baseLayoutWidth || baseLayoutWidth),
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

      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      const currentLayers = latestLayersRef.current;

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

          return {
            ...layer,
            x: snapEnabled ? snapToGrid(rawX, gridSize) : rawX,
            y: snapEnabled ? snapToGrid(rawY, gridSize) : rawY,
            width: snapEnabled ? snapToGrid(rawWidth, gridSize) : rawWidth,
            height: snapEnabled ? snapToGrid(rawHeight, gridSize) : rawHeight,
          };
        }

        const rawX = clampValue(current.baseX + dx, 0, Math.max(0, current.rect.width - current.baseWidth));
        const rawY = clampValue(current.baseY + dy, 0, Math.max(0, current.rect.height - current.baseHeight));
        return {
          ...layer,
          x: snapEnabled ? snapToGrid(rawX, gridSize) : rawX,
          y: snapEnabled ? snapToGrid(rawY, gridSize) : rawY,
        };
      });

      applyLayerUpdate(nextImages);
    };

    const handleUp = () => {
      dragRef.current = null;
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

    const rect = canvas.getBoundingClientRect();
    const layer = latestLayersRef.current[layerIndex];
    if (!layer) return;

    dragRef.current = {
      layerIndex,
      mode,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      rect,
      baseX: Number(layer.x || 0),
      baseY: Number(layer.y || 0),
      baseWidth: Number(layer.width || 200),
      baseHeight: Number(layer.height || 140),
    };
  }

  async function handleFileChange(event, layerIndex) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (typeof onUploadLayerImage === "function") {
      const asset = await onUploadLayerImage(layerIndex, file);
      if (asset?.src) {
        patchLayer(layerIndex, {
          kind: "image",
          src: String(asset.src || "").startsWith("data:") ? "" : (asset.src || ""),
          assetId: asset.id || "",
        });
      }
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
            maxWidth: `${baseLayoutWidth}px`,
            minHeight: stackHeight,
            marginTop: 0,
            marginLeft: "auto",
            marginRight: "auto",
            overflow: "hidden",
            borderRadius: compact ? 16 : 20,
            border: editor ? "1px dashed rgba(125,211,252,0.42)" : "none",
            background: editor ? previewCanvasBackground : "transparent",
            backgroundImage: editor && blockProps?.showGrid !== false ? "linear-gradient(rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px)" : "none",
            backgroundSize: `${gridSize}px ${gridSize}px`,
          }}
        >
          {layers.map((layer, idx) => (
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

function EditableImageBlock({ props, imageSrc, compact, editor = false, onChangeBlock }) {
  const resizeRef = React.useRef(null);
  const figureRef = React.useRef(null);
  const latestPropsRef = React.useRef(props || {});
  const [figureSize, setFigureSize] = React.useState({ width: 0, height: 0 });
  const [guides, setGuides] = React.useState({ showX: false, showY: false, active: false });
  const fullWidthProps = { ...props, fullWidthBackground: props?.fullWidthBackground !== false };
  const rawWidth = String(props?.width || "100%").trim().toLowerCase();
  const useFullWidth = fullWidthProps.fullWidthBackground || rawWidth === "100%" || rawWidth === "full" || rawWidth.includes("vw");
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
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;

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
    };
  }

  return (
    <section
      style={{
        ...fullWidthStyle(fullWidthProps, compact, editor),
        ...getAnimationStyle(props?.sectionAnimation, props?.sectionAnimationDelay || 0, props?.sectionAnimationSpeed),
        padding: 0,
        marginTop: 0,
        marginBottom: 0,
        background: "transparent",
        border: "none",
        boxShadow: "none",
      }}
    >
      <figure ref={figureRef} style={{ ...sharedStyles.figure, position: "relative", width: useFullWidth ? "100%" : `${widthPx}px`, maxWidth: "100%" }}>
        {imageSrc ? (
          <img src={imageSrc} alt={props.alt || "Image"} style={{ ...sharedStyles.figureImage, width: "100%", height: `${heightPx}px`, maxHeight: "none" }} />
        ) : (
          <div style={{ ...sharedStyles.galleryPlaceholder, width: "100%", height: `${heightPx}px`, borderRadius: 22 }}>
            Upload or choose an image
          </div>
        )}
        {showOverlayText ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 22,
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
                    fontSize: 11,
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
                  ...getAnimationStyle(props?.textAnimation, props?.textAnimationDelay || 0, props?.textAnimationSpeed),
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
                    ...getAnimationStyle(props?.subheadlineAnimation, props?.subheadlineAnimationDelay || 0, props?.subheadlineAnimationSpeed),
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
                      fontSize: 11,
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
          <div style={{ position: "absolute", top: 10, left: 10, borderRadius: 999, background: "rgba(15,23,42,0.72)", color: "#fff", padding: "5px 9px", fontSize: 12, fontWeight: 600 }}>
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
  return "✓";
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
}) {
  const resolvedAlign = contentAlign || "left";
  const isNewsletter = contentType === "newsletter";
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
    <article style={{ borderRadius: 18, border: PREMIUM_BORDER, background: cardBackgroundColor || "#f8fafc", padding: compact ? 14 : 18, boxShadow: "0 10px 24px rgba(15,23,42,0.08)", textAlign: resolvedAlign, ...cardStyle }}>
      {overlay}
      <div style={{ position: "relative", zIndex: 1 }}>
      {isNewsletter ? (
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
                editor ? <div style={{ ...sharedStyles.galleryPlaceholder, borderRadius: 12, marginBottom: 0, minHeight: 80, fontSize: 12, opacity: 0.6 }}>Upload image above form</div> : null
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
          {image ? (
            <div
              ref={imgContainerRef}
              onMouseEnter={() => editor && setIsImageHovered(true)}
              onMouseLeave={() => { if (!activeDrag) setIsImageHovered(false); }}
              style={{ position: "relative", marginBottom: (normalizedTitle || normalizedContent) ? 12 : 0, display: "inline-block", width: imageWidth != null ? `${imageWidth}%` : "100%" }}
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
                <div
                  key={dir}
                  onMouseDown={(e) => startResize(e, dir)}
                  style={{ ...HANDLE_BASE, ...style }}
                />
              ))}
            </div>
          ) : null}
          {normalizedTitle ? (
            <h3
              data-website-inline-editor="true"
              data-text-prop={titleProp}
              contentEditable={editor}
              suppressContentEditableWarning
              onBlur={(event) => onTitleChange?.(event.currentTarget.innerText)}
              style={{ margin: 0, color: textColor || "#0f172a", fontSize: compact ? 18 : 22, fontWeight: 600, textAlign: resolvedAlign, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0 }}
            >
              {title}
            </h3>
          ) : null}
          {normalizedContent ? (
            <div
              data-website-inline-editor="true"
              data-text-prop={contentProp}
              contentEditable={editor}
              suppressContentEditableWarning
              onBlur={(event) => onContentChange?.(event.currentTarget.innerHTML)}
              style={{ marginTop: normalizedTitle ? 8 : 0, color: bodyTextColor || textColor || "#334155", fontSize: compact ? 14 : 16, lineHeight: 1.7, textAlign: resolvedAlign, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "6px 8px" : 0 }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(content) }}
            />
          ) : null}
        </>
      )}
      </div>
    </article>
  );
}

function FAQAccordionBlock({ props, compact, editor = false, onChangeBlock, sectionAnimationStyle, assets }) {
  const sourceItems = asArray(props.items).map((item, idx) => {
    const question = item?.question || item?.heading || item?.q || `Question ${idx + 1}`;
    const answer = item?.answer || item?.content || item?.a || "Answer";
    return {
      ...item,
      id: item?.id || `faq-item-${idx}`,
      question,
      answer,
      heading: question,
      content: answer,
    };
  });
  const items = sourceItems;
  const faqBackgroundImage = resolveAssetField(props, "backgroundImage", assets);
  const [openItems, setOpenItems] = React.useState(() => {
    if (props.faqStartCollapsed) return [];
    return items.length ? [0] : [];
  });
  const allowMultipleOpen = !!props.faqAllowMultipleOpen;

  React.useEffect(() => {
    if (!items.length) {
      setOpenItems([]);
      return;
    }
    setOpenItems((current) => {
      const next = current.filter((idx) => idx >= 0 && idx < items.length);
      if (next.length) return next;
      return props.faqStartCollapsed ? [] : [0];
    });
  }, [items.length, props.faqStartCollapsed]);

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
    const nextItems = sourceItems.map((item, currentIndex) => {
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
    onChangeBlock({ ...props, items: nextItems });
  }

  const faqOuterStyle = {
    ...sectionAnimationStyle,
    width: "100%",
    borderRadius: compact ? 16 : 22,
    padding: compact ? "20px" : scaleBoxPadding("30px", spacingMultiplier(props)),
    background: props.blockBackgroundColor && props.blockBackgroundColor !== "transparent" ? props.blockBackgroundColor : "transparent",
    ...(faqBackgroundImage ? {
      backgroundImage: `linear-gradient(180deg, ${colorWithAlpha(props.blockBackgroundColor || "#0f172a", props.blockBackgroundColor && props.blockBackgroundColor !== "transparent" ? 0.72 : 0.28)}, ${colorWithAlpha(props.blockBackgroundColor || "#0f172a", props.blockBackgroundColor && props.blockBackgroundColor !== "transparent" ? 0.72 : 0.28)}), url(${faqBackgroundImage})`,
      backgroundSize: "cover",
      backgroundPosition: props.backgroundPosition || "center center",
      backgroundRepeat: "no-repeat",
    } : {}),
  };

  const faqPanelStyle = {
    ...sharedStyles.cardSection(compact, { ...props, backgroundColor: props.faqPanelBackgroundColor || props.backgroundColor || "#ffffff" }),
    width: "100%",
    maxWidth: `${Math.max(320, Number(props.faqMaxWidth || 980))}px`,
    marginLeft: "auto",
    marginRight: "auto",
  };

  return (
    <section style={asStyleObject(faqOuterStyle)}>
      <div style={asStyleObject(faqPanelStyle)}>
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
          ...headingTypography(props),
          fontSize: compact ? Math.max(18, Number(props.headlineFontSize || 28) - 4) : Number(props.headlineFontSize || 28),
          color: props.headlineColor || headingTypography(props).color,
          outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
          borderRadius: 8,
          padding: editor ? "4px 6px" : 0,
        }}
        dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || "Questions") }}
      />
      <div style={sharedStyles.stack}>
        {items.map((item, idx) => {
          const isOpen = editor || openItems.includes(idx);
          return (
            <div
              key={item.id || `${item.question}-${idx}`}
              style={{
                ...sharedStyles.faqItem,
                ...getAnimationStyle("fade-up", idx * 0.06),
                background: props.itemBackgroundColor || sharedStyles.faqItem.background,
                border: `1px solid ${props.itemBorderColor || props.borderColor || "#cbd5e1"}`,
              }}
            >
              <div style={sharedStyles.faqTrigger}>
                <div
                  data-website-inline-editor="true"
                  data-text-prop={`items.${idx}.question`}
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => patchItem(idx, { question: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                  style={{
                    ...sharedStyles.faqQ,
                    color: props.questionColor || "#0f172a",
                    fontSize: compact ? Math.max(14, Number(props.questionFontSize || 16) - 1) : Number(props.questionFontSize || 16),
                    fontWeight: props.questionFontWeight || "inherit",
                    outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                    borderRadius: 8,
                    padding: editor ? "4px 6px" : 0,
                    flex: 1,
                    minWidth: 0,
                    cursor: editor ? "text" : "default",
                  }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(item.question) }}
                />
                <button
                  type="button"
                  onClick={() => toggleItem(idx)}
                  style={{
                    ...sharedStyles.faqChevronButton,
                    color: props.chevronColor || "#2563eb",
                  }}
                  aria-expanded={isOpen}
                  aria-label={isOpen ? "Collapse FAQ item" : "Expand FAQ item"}
                >
                  <span style={{ ...sharedStyles.faqChevron, color: props.chevronColor || "#2563eb", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                </button>
              </div>
              {isOpen ? (
                <div
                  data-website-inline-editor="true"
                  data-text-prop={`items.${idx}.answer`}
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => patchItem(idx, { answer: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                  style={{
                    ...sharedStyles.faqA,
                    color: props.answerColor || props.textColor || "#475569",
                    fontSize: compact ? Math.max(12, Number(props.answerFontSize || MIN_TEXT_SIZE) - 1) : Number(props.answerFontSize || MIN_TEXT_SIZE),
                    outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                    borderRadius: 8,
                    padding: editor ? "6px 8px" : 0,
                  }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(item.answer) }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      </div>
    </section>
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

function useOverlayBounds(shellRef) {
  const [bounds, setBounds] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const shell = shellRef.current;
    const parent = shell?.parentElement;
    if (!parent) return undefined;

    const updateBounds = () => {
      const rect = parent.getBoundingClientRect();
      setBounds({ width: rect.width || 0, height: rect.height || 0 });
    };

    updateBounds();

    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateBounds);
      observer.observe(parent);
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
  const [guides, setGuides] = React.useState({ showX: false, showY: false, active: false });
  const [isActive, setIsActive] = React.useState(false);
  const bounds = useOverlayBounds(shellRef);
  const canManipulate = !!editor && !compact;
  const xPct = Number(props?.contentX ?? 50);
  const yPct = Number(props?.contentY ?? 50);
  const boxWidth = Math.max(240, Number(props?.contentWidth ?? 760));
  const boxHeight = Math.max(100, Number(props?.contentHeight ?? 220));
  const maxUsableWidth = bounds.width ? Math.max(180, bounds.width - 24) : boxWidth;
  const maxUsableHeight = bounds.height ? Math.max(80, bounds.height - 24) : boxHeight;
  const effectiveWidth = Math.min(boxWidth, maxUsableWidth);
  const effectiveHeight = Math.min(boxHeight, maxUsableHeight);
  const constrainedWidth = `min(${effectiveWidth}px, calc(100% - 24px))`;
  const constrainedLeft = `clamp(calc(${effectiveWidth}px / 2), ${xPct}%, calc(100% - (${effectiveWidth}px / 2)))`;
  const constrainedTop = `clamp(calc(${effectiveHeight}px / 2), ${yPct}%, calc(100% - (${effectiveHeight}px / 2)))`;

  React.useEffect(() => {
    if (!editor) return undefined;

    const handleOutsidePointer = (event) => {
      const shell = shellRef.current;
      if (!shell || shell.contains(event.target)) return;
      dragRef.current = null;
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
    if (!editor || !canManipulate || typeof onChangeBlock !== "function") return undefined;

    const handleMove = (event) => {
      const current = dragRef.current;
      if (!current) return;
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;

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

        setGuides({ showX: guideState.showX, showY: guideState.showY, active: true });
        onChangeBlock({
          ...props,
          contentWidth: Math.round(nextWidth),
          contentHeight: Math.round(nextHeight),
          contentX: Math.round(guideState.snappedX),
          contentY: Math.round(guideState.snappedY),
        });
        return;
      }

      const halfWidthPct = (current.baseWidth / current.rect.width) * 50;
      const halfHeightPct = (current.baseHeight / current.rect.height) * 50;
      const guideState = getOverlayGuideState(
        clampValue(current.baseX + ((dx / current.rect.width) * 100), halfWidthPct, 100 - halfWidthPct),
        clampValue(current.baseY + ((dy / current.rect.height) * 100), halfHeightPct, 100 - halfHeightPct),
        current.rect,
      );

      setGuides({ showX: guideState.showX, showY: guideState.showY, active: true });
      onChangeBlock({ ...props, contentX: Math.round(guideState.snappedX), contentY: Math.round(guideState.snappedY) });
    };

    const handleUp = () => {
      dragRef.current = null;
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
  }, [editor, canManipulate, onChangeBlock, props]);

  function startInteraction(event, mode = "move", handle = "se") {
    if (!editor || !canManipulate || typeof onChangeBlock !== "function") return;
    setIsActive(true);
    setGuides((prev) => ({ ...prev, active: true }));
    event.preventDefault();
    event.stopPropagation();
    const rect = shellRef.current?.parentElement?.getBoundingClientRect();
    if (!rect) return;
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
    };
  }

  function maybeStartMove(event) {
    const target = event.target;
    if (target?.closest?.('[contenteditable="true"], button, a, input, textarea, select, [data-overlay-resize="true"]')) {
      return;
    }
    startInteraction(event, "move");
  }

  if (!canManipulate && (!overlayEnabled || compact)) {
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
        onMouseDownCapture={() => setIsActive(true)}
        onFocusCapture={() => setIsActive(true)}
        onPointerDown={maybeStartMove}
        onMouseDown={maybeStartMove}
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
        }}
      >
        {editor ? (
          <div
            data-overlay-drag-handle="true"
            onPointerDown={(event) => startInteraction(event, "move")}
            onMouseDown={(event) => startInteraction(event, "move")}
            style={{ position: "absolute", top: 4, left: 8, right: 8, zIndex: 5, cursor: "move", display: "flex", justifyContent: align === "right" ? "flex-end" : align === "left" ? "flex-start" : "center" }}
          >
            <span style={sharedStyles.editorChip}>Drag Text Box</span>
          </div>
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
            overflow: "hidden",
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

function DraggableImageOverlay({ props, compact, editor, onChangeBlock, onUploadImage, onSelectAsset, assets, imageSrc, overlayEnabled = false, frameStyle = null, isSelected = false }) {
  const dragRef = React.useRef(null);
  const shellRef = React.useRef(null);
  const [guides, setGuides] = React.useState({ showX: false, showY: false, active: false });
  const [isActive, setIsActive] = React.useState(false);
  const bounds = useOverlayBounds(shellRef);
  const canManipulate = !!editor && !compact && !!imageSrc;
  const showEditorControls = !!editor && (isSelected || isActive);
  const overlayLibraryImages = Array.isArray(assets?.images) ? assets.images.slice(0, compact ? 2 : 4) : [];
  const xPct = Number(props?.floatingX ?? 76);
  const yPct = Number(props?.floatingY ?? 58);
  const boxWidth = Math.max(120, Number(props?.floatingWidth ?? 260));
  const boxHeight = Math.max(120, Number(props?.floatingHeight ?? 260));
  const maxUsableWidth = bounds.width ? Math.max(100, bounds.width - 24) : boxWidth;
  const maxUsableHeight = bounds.height ? Math.max(100, bounds.height - 24) : boxHeight;
  const effectiveWidth = Math.min(boxWidth, maxUsableWidth);
  const effectiveHeight = Math.min(boxHeight, maxUsableHeight);
  const constrainedWidth = `min(${effectiveWidth}px, calc(100% - 24px))`;
  const constrainedHeight = `min(${effectiveHeight}px, calc(100% - 24px))`;
  const constrainedLeft = `clamp(calc(${effectiveWidth}px / 2), ${xPct}%, calc(100% - (${effectiveWidth}px / 2)))`;
  const constrainedTop = `clamp(calc(${effectiveHeight}px / 2), ${yPct}%, calc(100% - (${effectiveHeight}px / 2)))`;

  React.useEffect(() => {
    if (!editor) return undefined;

    const handleOutsidePointer = (event) => {
      const shell = shellRef.current;
      if (!shell || shell.contains(event.target)) return;
      dragRef.current = null;
      setGuides({ showX: false, showY: false, active: false });
      setIsActive(false);
    };

    document.addEventListener("pointerdown", handleOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer, true);
  }, [editor]);

  React.useEffect(() => {
    if (!editor || !canManipulate || typeof onChangeBlock !== "function") return undefined;

    const handleMove = (event) => {
      const current = dragRef.current;
      if (!current) return;
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;

      if (current.mode === "resize") {
        let nextWidth = current.baseWidth;
        let nextHeight = current.baseHeight;

        if (["left", "nw", "sw"].includes(current.handle)) nextWidth = current.baseWidth - dx;
        if (["right", "ne", "se"].includes(current.handle)) nextWidth = current.baseWidth + dx;
        if (["top", "nw", "ne"].includes(current.handle)) nextHeight = current.baseHeight - dy;
        if (["bottom", "sw", "se"].includes(current.handle)) nextHeight = current.baseHeight + dy;

        nextWidth = clampValue(nextWidth, 100, current.rect.width);
        nextHeight = clampValue(nextHeight, 100, current.rect.height);

        const halfWidthPct = (nextWidth / current.rect.width) * 50;
        const halfHeightPct = (nextHeight / current.rect.height) * 50;
        const guideState = getOverlayGuideState(
          clampValue(current.baseX, halfWidthPct, 100 - halfWidthPct),
          clampValue(current.baseY, halfHeightPct, 100 - halfHeightPct),
          current.rect,
        );

        setGuides({ showX: guideState.showX, showY: guideState.showY, active: true });
        onChangeBlock({
          ...props,
          floatingWidth: Math.round(nextWidth),
          floatingHeight: Math.round(nextHeight),
          floatingX: Math.round(guideState.snappedX),
          floatingY: Math.round(guideState.snappedY),
        });
        return;
      }

      const halfWidthPct = (current.baseWidth / current.rect.width) * 50;
      const halfHeightPct = (current.baseHeight / current.rect.height) * 50;
      const guideState = getOverlayGuideState(
        clampValue(current.baseX + ((dx / current.rect.width) * 100), halfWidthPct, 100 - halfWidthPct),
        clampValue(current.baseY + ((dy / current.rect.height) * 100), halfHeightPct, 100 - halfHeightPct),
        current.rect,
      );

      setGuides({ showX: guideState.showX, showY: guideState.showY, active: true });
      onChangeBlock({ ...props, floatingX: Math.round(guideState.snappedX), floatingY: Math.round(guideState.snappedY) });
    };

    const handleUp = () => {
      dragRef.current = null;
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
  }, [editor, canManipulate, onChangeBlock, props]);

  function startInteraction(event, mode = "move", handle = "se") {
    if (!editor || !canManipulate || typeof onChangeBlock !== "function") return;
    setIsActive(true);
    setGuides((prev) => ({ ...prev, active: true }));
    event.preventDefault();
    event.stopPropagation();
    const rect = shellRef.current?.parentElement?.getBoundingClientRect();
    if (!rect) return;
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
      enableParallax: true,
    });
  }

  if (!imageSrc) return null;

  if (!canManipulate && (!overlayEnabled || compact)) {
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
          <img src={imageSrc} alt={props?.floatingAlt || "Overlay image"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
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
        onMouseDownCapture={() => setIsActive(true)}
        onFocusCapture={() => setIsActive(true)}
        onPointerDown={maybeStartMove}
        onMouseDown={maybeStartMove}
        style={{
          position: "absolute",
          left: constrainedLeft,
          top: constrainedTop,
          transform: "translate(-50%, -50%)",
          width: constrainedWidth,
          height: constrainedHeight,
          maxWidth: "100%",
          maxHeight: "100%",
          zIndex: isActive ? 5 : 2,
          border: editor ? "1px dashed rgba(245,158,11,0.95)" : "none",
          borderRadius: 18,
          background: "transparent",
          boxSizing: "border-box",
          touchAction: "none",
          cursor: editor ? "move" : "default",
        }}
      >
        {editor ? (
          <div
            onPointerDown={(event) => startInteraction(event, "move")}
            onMouseDown={(event) => startInteraction(event, "move")}
            style={{ position: "absolute", top: -12, left: 10, zIndex: 5, cursor: "move" }}
          >
            <span style={{ ...sharedStyles.editorChip, background: "#f59e0b", color: "#111827" }}>Drag Image</span>
          </div>
        ) : null}
        <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: 18, boxShadow: "0 24px 48px rgba(15,23,42,0.28)", background: "rgba(255,255,255,0.06)", ...(frameStyle || {}) }}>
          <img src={imageSrc} alt={props?.floatingAlt || "Overlay image"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none", userSelect: "none" }} />
        </div>
        {showEditorControls ? (
          <div
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            style={{ position: "absolute", left: 12, right: 12, bottom: 12, zIndex: 6, display: "grid", gap: 8, padding: "10px 12px", borderRadius: 14, background: "rgba(15,23,42,0.62)", border: "1px solid rgba(245,158,11,0.34)", boxShadow: "0 14px 28px rgba(15,23,42,0.18)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: "#f8fafc", fontSize: 12, fontWeight: 700 }}>Overlay image: drag anywhere to move</span>
              <label style={{ ...sharedStyles.editorChip, background: "#f59e0b", color: "#111827", cursor: "pointer" }}>
                Replace
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    onChangeBlock?.({
                      ...props,
                      floatingX: props.floatingX ?? xPct,
                      floatingY: props.floatingY ?? yPct,
                      floatingWidth: props.floatingWidth ?? boxWidth,
                      floatingHeight: props.floatingHeight ?? boxHeight,
                      enableParallax: true,
                    });
                    onUploadImage?.("floatingImage", file);
                  }}
                />
              </label>
            </div>
            {overlayLibraryImages.length ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {overlayLibraryImages.map((image) => (
                  <button
                    key={`overlay-library-${image.id || image.src}`}
                    type="button"
                    onClick={() => onSelectAsset ? onSelectAsset("floatingImage", image) : applyOverlayAsset(image)}
                    style={{ width: 40, height: 40, padding: 0, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.2)", background: "#0f172a", cursor: "pointer" }}
                    title={image.name || "Use library image"}
                  >
                    <img src={image.src} alt={image.name || "Library image"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {editor && isActive ? [
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
            style={{ position: "absolute", borderRadius: 999, background: "#f59e0b", border: "2px solid #fff", boxShadow: "0 6px 16px rgba(245,158,11,0.35)", ...handle }}
          />
        )) : null}
      </div>
    </>
  );
}

export function renderWebsiteBlock(block, { compact = false, assets, editor = false, isSelected = false, onChangeBlock, onUploadImage, onUploadLayerImage, onSelectAsset, navigationContext = null } = {}) {
  const props = block?.props || {};
  const sectionAnimationStyle = getAnimationStyle(props.sectionAnimation, props.sectionAnimationDelay || 0, props.sectionAnimationSpeed);
  const spacingScale = spacingMultiplier(props);
  const sectionPad = scaleBoxPadding(compact ? "24px 20px" : "72px 32px", spacingScale);
  const cardPad = scaleBoxPadding(compact ? "18px" : "32px 28px", spacingScale);
  const imageSrc = resolveAssetField(props, "src", assets);
  const heroBackgroundImage = resolveAssetField(props, "backgroundImage", assets);
  const avatarSrc = resolveAssetField(props, "avatar", assets);
  const logoSrc = resolveAssetField(props, "logo", assets);
  const brandLogoSrc = assets?.logo?.src || logoSrc;
  const floatingImageSrc = resolveAssetField(props, "floatingImage", assets);

  switch (block?.type) {
    case "nav-bar":
      return <NavBarBlock blockProps={props} compact={compact} logoSrc={brandLogoSrc} editor={editor} navigationContext={navigationContext} />;

    case "hero":
    case "parallax": {
      const shouldStretchHero = block?.type === "parallax"
        || props.backgroundStyle === "image"
        || props.backgroundStyle === "video"
        || !!String(heroBackgroundImage || "").trim();
      const heroFullWidth = fullWidthStyle({
        ...props,
        fullWidthBackground: shouldStretchHero ? true : props.fullWidthBackground,
      }, compact, editor);
      const heroVariant = heroVariantStyles(props, compact);
      const heroLayout = heroLayoutDefaults(props.heroVariant || "spotlight", compact);
      const heroLibraryImages = Array.isArray(assets?.images) ? assets.images.slice(0, compact ? 2 : 4) : [];
      const overlayEditingEnabled = props.enableParallax ?? (block?.type === "parallax");
      const showHeroMediaControls = editor && isSelected;
      const isVideoHero = props.backgroundStyle === "video" && !!props.backgroundVideoUrl;
      const heroBg = isVideoHero
        ? (props.backgroundColor || "#0f172a")
        : heroBackground({ ...props, backgroundImage: heroBackgroundImage });
      const headingColor = props.headlineColor || "#ffffff";
      const headingFamily = props.headlineFontFamily || "system-ui, -apple-system, sans-serif";
      const headingWeight = props.headlineFontWeight || "700";
      const bodyColor = props.textColor || headingColor;
      const bodyFamily = props.fontFamily || headingFamily;
      const headingAlign = props.headlineAlignment || heroLayout.headlineAlignment || "center";
      const heroHorizontalInset = compact ? 24 : 48;
      const heroContentMaxWidth = Math.max(320, Number(props.baseLayoutWidth || 1500));
      const heroContentBounds = {
        position: "absolute",
        inset: 0,
        width: "100%",
        zIndex: 2,
      };
      const heroContentBoundsInner = {
        position: "relative",
        width: `calc(100% - ${heroHorizontalInset * 2}px)`,
        maxWidth: `${heroContentMaxWidth}px`,
        height: "100%",
        margin: "0 auto",
        minWidth: 0,
      };
      const normalizedOverlayLayout = normalizeOverlayLayoutProps(
        props,
        {
          ...heroLayout,
          contentY: floatingImageSrc ? (heroVariant.imageDefaults?.contentY ?? heroLayout.contentY) : heroLayout.contentY,
          floatingX: heroVariant.imageDefaults?.x ?? heroLayout.floatingX,
          floatingY: heroVariant.imageDefaults?.y ?? heroLayout.floatingY,
          floatingWidth: heroVariant.imageDefaults?.width ?? heroLayout.floatingWidth,
          floatingHeight: heroVariant.imageDefaults?.height ?? heroLayout.floatingHeight,
        },
        !!floatingImageSrc,
      );
      const heroOverlayProps = normalizedOverlayLayout;
      const heroContentProps = normalizedOverlayLayout;

      return (
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: compact ? 12 : 20,
            ...heroFullWidth,
            ...heroVariant.shell,
            ...sectionAnimationStyle,
            minHeight: compact ? 180 : props.minHeight || "400px",
            background: heroBg,
            backgroundAttachment: overlayEditingEnabled && heroBackgroundImage && !compact ? "fixed" : "scroll",
            padding: compact ? "40px 24px" : "80px 48px",
          }}
        >
          {block?.type === "hero" ? heroVariant.decor : null}
          {isVideoHero ? (
            <video
              src={props.backgroundVideoUrl}
              autoPlay
              muted
              loop
              playsInline
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
            />
          ) : null}
          {showHeroMediaControls ? (
            <div style={{ position: "absolute", left: 12, bottom: 12, zIndex: 6, display: "grid", gap: 8, maxWidth: compact ? "calc(100% - 24px)" : 420 }}>
              {!heroBackgroundImage ? (
                <div style={{ borderRadius: 18, border: "2px dashed rgba(125,211,252,0.7)", background: "rgba(15,23,42,0.42)", padding: compact ? 14 : 18, display: "grid", gap: 10, color: "#e2e8f0", boxShadow: "0 16px 34px rgba(15,23,42,0.2)" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong style={{ fontSize: compact ? 14 : 16 }}>{block?.type === "parallax" ? "Section background image" : "Hero background image"}</strong>
                    <span style={{ fontSize: compact ? 12 : 13, opacity: 0.82 }}>Click here to upload a new image or pick one from the library.</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <label style={{ ...sharedStyles.editorChip, background: "#7dd3fc", color: "#082f49", cursor: "pointer" }}>
                      Upload Background
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
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: compact ? "10px 12px" : "12px 14px", borderRadius: 16, background: "rgba(15,23,42,0.52)", border: "1px solid rgba(125,211,252,0.22)", boxShadow: "0 16px 34px rgba(15,23,42,0.18)" }}>
                  <span style={{ color: "#e2e8f0", fontSize: compact ? 12 : 13, fontWeight: 600 }}>{block?.type === "parallax" ? "Section background" : "Hero background"}</span>
                  <label style={{ ...sharedStyles.editorChip, background: "#7dd3fc", color: "#082f49", cursor: "pointer" }}>
                    Replace
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
                  headline: props.headline || "Click to type headline",
                  subheadline: props.subheadline || "Add supporting text here",
                  contentX: props.contentX ?? heroLayout.contentX,
                  contentY: props.contentY ?? (floatingImageSrc ? (heroVariant.imageDefaults?.contentY ?? heroLayout.contentY) : heroLayout.contentY),
                  contentWidth: props.contentWidth ?? heroLayout.contentWidth,
                  contentHeight: props.contentHeight ?? heroLayout.contentHeight,
                  enableParallax: true,
                })}
                style={{ ...sharedStyles.editorChip, background: "#22c55e" }}
              >
                Add Text
              </button>
              {brandLogoSrc ? (
                <button
                  type="button"
                  onClick={() => onChangeBlock?.({
                    ...props,
                    floatingImage: brandLogoSrc,
                    floatingX: props.floatingX ?? heroOverlayProps.floatingX,
                    floatingY: props.floatingY ?? heroOverlayProps.floatingY,
                    floatingWidth: props.floatingWidth ?? heroOverlayProps.floatingWidth,
                    floatingHeight: props.floatingHeight ?? heroOverlayProps.floatingHeight,
                    enableParallax: true,
                  })}
                  style={{ ...sharedStyles.editorChip, background: "#ffffff", color: "#111827" }}
                >
                  Use Logo
                </button>
              ) : null}
              <label style={{ ...sharedStyles.editorChip, background: "#f59e0b", color: "#111827", cursor: "pointer" }}>
                {floatingImageSrc ? "Replace Image" : "Upload Image"}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    onChangeBlock?.({
                      ...props,
                      floatingX: props.floatingX ?? heroOverlayProps.floatingX,
                      floatingY: props.floatingY ?? heroOverlayProps.floatingY,
                      floatingWidth: props.floatingWidth ?? heroOverlayProps.floatingWidth,
                      floatingHeight: props.floatingHeight ?? heroOverlayProps.floatingHeight,
                      enableParallax: true,
                    });
                    onUploadImage?.("floatingImage", file);
                  }}
                />
              </label>
              {floatingImageSrc ? (
                <button
                  type="button"
                  onClick={() => onChangeBlock?.({ ...props, floatingImage: "" })}
                  style={{ ...sharedStyles.editorChip, background: "rgba(239,68,68,0.92)" }}
                >
                  Remove Image
                </button>
              ) : null}
            </div>
          ) : null}
          <div style={heroContentBounds}>
            <div style={heroContentBoundsInner}>
              {!floatingImageSrc && showHeroMediaControls && !compact ? (
                <div
                  style={{
                    position: "absolute",
                    left: `${Number(heroOverlayProps.floatingX)}%`,
                    top: `${Number(heroOverlayProps.floatingY)}%`,
                    transform: "translate(-50%, -50%)",
                    width: `${Math.max(120, Number(heroOverlayProps.floatingWidth))}px`,
                    height: `${Math.max(120, Number(heroOverlayProps.floatingHeight))}px`,
                    zIndex: 2,
                    borderRadius: 18,
                    border: "2px dashed rgba(251,191,36,0.95)",
                    background: "rgba(15,23,42,0.30)",
                    display: "grid",
                    placeItems: "center",
                    padding: 14,
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ textAlign: "center", color: "#fff", display: "grid", gap: 8 }}>
                    <strong>Foreground overlay image</strong>
                    <label style={{ ...sharedStyles.editorChip, display: "inline-flex", justifyContent: "center", background: "#f59e0b", color: "#111827", cursor: "pointer" }}>
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (!file) return;
                          onChangeBlock?.({
                            ...props,
                            floatingX: props.floatingX ?? heroOverlayProps.floatingX,
                            floatingY: props.floatingY ?? heroOverlayProps.floatingY,
                            floatingWidth: props.floatingWidth ?? heroOverlayProps.floatingWidth,
                            floatingHeight: props.floatingHeight ?? heroOverlayProps.floatingHeight,
                            enableParallax: true,
                          });
                          onUploadImage?.("floatingImage", file);
                        }}
                      />
                    </label>
                    {heroLibraryImages.length ? (
                      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                        {heroLibraryImages.map((image) => (
                          <button
                            key={`overlay-empty-library-${image.id || image.src}`}
                            type="button"
                            onClick={() => onSelectAsset ? onSelectAsset("floatingImage", image) : onChangeBlock?.({
                              ...props,
                              floatingImage: image.src || "",
                              floatingImageAssetId: image.id || "",
                              floatingX: props.floatingX ?? heroOverlayProps.floatingX,
                              floatingY: props.floatingY ?? heroOverlayProps.floatingY,
                              floatingWidth: props.floatingWidth ?? heroOverlayProps.floatingWidth,
                              floatingHeight: props.floatingHeight ?? heroOverlayProps.floatingHeight,
                              enableParallax: true,
                            })}
                            style={{ width: 46, height: 46, padding: 0, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.24)", background: "#0f172a", cursor: "pointer" }}
                            title={image.name || "Use library image"}
                          >
                            <img src={image.src} alt={image.name || "Library image"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <DraggableImageOverlay props={heroOverlayProps} compact={compact} editor={editor} isSelected={isSelected} onChangeBlock={onChangeBlock} onUploadImage={onUploadImage} onSelectAsset={onSelectAsset} assets={assets} imageSrc={floatingImageSrc} overlayEnabled={overlayEditingEnabled} frameStyle={block?.type === "hero" ? heroVariant.imageFrame : null} />
              <DraggableContentOverlay props={heroContentProps} compact={compact} editor={editor} onChangeBlock={onChangeBlock} align={headingAlign} vertical={props.verticalAlign || heroLayout.verticalAlign || "center"} overlayEnabled={overlayEditingEnabled} contentShellStyle={block?.type === "hero" ? heroVariant.contentShell : null}>
                <div style={{ display: "flex", flexDirection: "column", gap: compact ? 12 : 20, width: "100%", textAlign: headingAlign, ...heroVariant.content }}>
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
                  onChangeBlock({ ...props, headline: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
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
                  ...getAnimationStyle(props.textAnimation, props.textAnimationDelay || 0, props.textAnimationSpeed),
                  width: "100%",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                  outline: editor ? "1px dashed rgba(125,211,252,0.5)" : "none",
                  padding: editor ? "4px 6px" : 0,
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  borderRadius: 8,
                }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(props.headline || (editor ? "Click to type headline" : "")) }}
              />
                  {props.subheadline || editor ? (
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
                    onChangeBlock({ ...props, subheadline: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
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
                    ...getAnimationStyle(props.subheadlineAnimation, props.subheadlineAnimationDelay || 0, props.subheadlineAnimationSpeed),
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    opacity: 0.92,
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    outline: editor ? "1px dashed rgba(125,211,252,0.5)" : "none",
                    padding: editor ? "4px 6px" : 0,
                    borderRadius: 8,
                  }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(props.subheadline || (editor ? "Add supporting text here" : "")) }}
                    />
                  ) : null}
                  {props.ctaText ? (
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
                  ) : null}
                </div>
              </DraggableContentOverlay>
            </div>
          </div>
        </section>
      );
    }

    case "text":
      const textFullWidth = fullWidthStyle(props, compact, editor);
      const textPadTop = props.paddingTop ?? 48;
      const textPadBottom = props.paddingBottom ?? 48;
      const textBackground = props.backgroundColor || "#111827";
      const hasBorder = textBackground && textBackground !== "transparent";
      const hasBoxShadow = hasBorder;
      const textOverlayEnabled = !!props.enableParallax && !compact;
      
      return (
        <section
          style={{
            position: "relative",
            borderRadius: compact ? 16 : 22,
            ...textFullWidth,
            minHeight: props.minHeight || "220px",
            paddingTop: `${textPadTop}px`,
            paddingBottom: `${textPadBottom}px`,
            paddingLeft: sectionPad.replace(/\s.*/, ""),
            paddingRight: sectionPad.replace(/\s.*/, ""),
            background:
              heroBackgroundImage
                ? `linear-gradient(rgba(7,17,29,0.35), rgba(7,17,29,0.35)), url(${heroBackgroundImage}) center / cover no-repeat`
                : (textBackground !== "transparent" ? textBackground : "transparent"),
            backgroundAttachment: props.enableParallax && heroBackgroundImage && !compact ? "fixed" : "scroll",
            color: props.textColor || "#e6eef5",
            border: hasBorder ? PREMIUM_BORDER : "none",
            boxShadow: hasBoxShadow ? PREMIUM_SHADOW : "none",
            overflow: textOverlayEnabled ? "hidden" : undefined,
            ...sectionAnimationStyle,
          }}
        >
          <div style={sectionContentStyle(props, compact)}>
            {editor ? (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10, gap: 6, flexWrap: "wrap" }}>
                <button type="button" onClick={() => onChangeBlock?.({ ...props, textFontSize: Math.max(14, Number(props.textFontSize || 18) - 2) })} style={sharedStyles.editorChip}>A−</button>
                <button type="button" onClick={() => onChangeBlock?.({ ...props, textFontSize: Math.min(72, Number(props.textFontSize || 18) + 2) })} style={sharedStyles.editorChip}>A+</button>
              </div>
            ) : null}
            <DraggableContentOverlay props={props} compact={compact} editor={editor} onChangeBlock={onChangeBlock} align={props.alignment || "left"} vertical={props.verticalAlign || "center"} overlayEnabled={textOverlayEnabled}>
              <p
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
                style={{ margin: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box", fontSize: textSizePx(props.textSize, compact, props.textFontSize), lineHeight: 1.8, textAlign: props.alignment || "left", ...bodyTypography(props), ...getAnimationStyle(props.textAnimation, props.textAnimationDelay || 0, props.textAnimationSpeed), outline: editor ? "1px dashed rgba(14,165,233,0.4)" : "none", padding: editor ? "6px 8px" : 0, borderRadius: 8 }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(props.text) }}
              />
            </DraggableContentOverlay>
          </div>
        </section>
      );

    case "image":
      return <EditableImageBlock props={props} imageSrc={imageSrc} compact={compact} editor={editor} onChangeBlock={onChangeBlock} />;

    case "cta-button": {
      const ctaVariant = ctaButtonVariantStyles(props, compact);
      return (
        <section style={{ ...ctaVariant.section, ...fullWidthStyle(props, compact, editor), ...getAnimationStyle("fade-up", 0.06) }}>
          <div style={sectionContentStyle(props, compact)}>
          <div style={ctaVariant.content}>
            {(props.eyebrow || editor) ? (
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
                dangerouslySetInnerHTML={{ __html: asRichHtml(props.eyebrow || (editor ? "Launch label" : "")) }}
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
        </section>
      );
    }

    case "feature-list":
      const featureVariant = featureVariantStyles(props);
      return (
        <section style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), ...sectionAnimationStyle }}>
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
            style={{
              ...sharedStyles.sectionTitle(compact),
              color: props.textColor || "#0f172a",
              outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
              borderRadius: 8,
              padding: editor ? "4px 6px" : 0,
            }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || "Key Features") }}
          />
          <div style={{ ...sharedStyles.featureList(props.layout, compact, props.featureCardWidth), ...featureVariant.list }}>
            {asArray(props.items).map((rawItem, idx) => {
              const item = normalizeFeatureItem(rawItem, idx);
              const itemImage = item.image || `https://placehold.co/960x720/e2e8f0/0f172a?text=${encodeURIComponent(item.title || `Feature ${idx + 1}`)}`;
              const patchFeatureItem = (patch) => {
                if (!editor || typeof onChangeBlock !== "function") return;
                const nextItems = asArray(props.items).map((entry, entryIdx) => (
                  entryIdx === idx ? { ...normalizeFeatureItem(entry, entryIdx), ...patch } : entry
                ));
                onChangeBlock({ ...props, items: nextItems });
              };

              return (
                <div key={item.id || `${item.title}-${idx}`} style={{ ...sharedStyles.featureItem(compact), ...featureVariant.item, ...getAnimationStyle("fade-up", idx * 0.08), background: props.itemBackgroundColor || undefined, border: `1px solid ${props.borderColor || "#dbeafe"}`, color: props.textColor || "#0f172a" }}>
                  <div style={{ position: "relative", overflow: "hidden", background: "rgba(255,255,255,0.14)", minWidth: 0, ...featureVariant.media }}>
                    <img src={itemImage} alt={item.title || `Feature ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${item.imageX}% ${item.imageY}%`, display: "block" }} />
                  </div>
                  <div style={{ minWidth: 0, ...featureVariant.body }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ ...sharedStyles.featureCheck, ...(featureVariant.marker || {}) }}>{getListMarker(props.bulletStyle, idx)}</span>
                      <h3
                        data-website-inline-editor="true"
                        contentEditable={editor}
                        suppressContentEditableWarning
                        onBlur={(event) => patchFeatureItem({ title: event.currentTarget.innerText })}
                        style={{
                          margin: 0,
                          outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                          borderRadius: 8,
                          padding: editor ? "4px 6px" : 0,
                          flex: "1 1 0%",
                          minWidth: 0,
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                          boxSizing: "border-box",
                          color: featureVariant.title?.color || props.textColor || "#0f172a",
                          ...featureVariant.title,
                        }}
                      >
                        {item.title}
                      </h3>
                    </div>
                    <p
                      data-website-inline-editor="true"
                      contentEditable={editor}
                      suppressContentEditableWarning
                      onBlur={(event) => patchFeatureItem({ body: event.currentTarget.innerText })}
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
                      }}
                    >
                      {item.body || (editor ? "Add a short supporting sentence" : "")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </section>
      );

    case "testimonial": {
      const testimonialItems = normalizeTestimonialItems(props);
      const testimonialVariant = props.testimonialVariant || "cards";
      const variantSty = testimonialVariantStyles(testimonialVariant, compact, props);
      const starAccent = variantSty.starColor || "#f59e0b";
      const isSpotlight = testimonialVariant === "spotlight";
      const isWall = testimonialVariant === "wall";

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
        const avatarSrcItem = getAssetFromLibrary(assets, item.avatarAssetId)?.src || item.avatarUrl || "";
        // For wall variant the card's own color determines text, override quote/author/meta per card
        const wallCardColor = isWall && (idx % 3 === 2) ? (props.textColor || "#0f172a") : variantSty.quote.color;
        const wallMetaColor = isWall && (idx % 3 === 2) ? "#64748b" : variantSty.meta.color;
        const wallAuthorColor = isWall && (idx % 3 === 2) ? (props.textColor || "#0f172a") : variantSty.author.color;
        return (
          <div key={item.id || `testimonial-${idx}`} style={{ ...cardSty, ...(variantSty.cardWrap ? { width: "100%", boxSizing: "border-box" } : {}), ...getAnimationStyle("fade-up", idx * 0.07) }}>
            {renderStarRow(item.rating, idx)}
            <p
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
                ? <img src={avatarSrcItem} alt={item.author || ""} style={asStyleObject(sharedStyles.avatar)} />
                : editor
                  ? <div style={{ width: 44, height: 44, borderRadius: 999, background: "rgba(148,163,184,0.28)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#94a3b8", flexShrink: 0, fontWeight: 600 }}>Photo</div>
                  : null}
              <div>
                <p
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    if (!editor) return;
                    patchTestimonial(idx, { author: htmlToPlainText(cleanInlineEditorHtml(event.currentTarget.innerHTML)) });
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
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    if (!editor) return;
                    patchTestimonial(idx, { role: htmlToPlainText(cleanInlineEditorHtml(event.currentTarget.innerHTML)) });
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
          </div>
        );
      };

      return (
        <section style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), ...variantSty.shell, ...sectionAnimationStyle }}>
          <div style={sectionContentStyle(props, compact)}>
          {(props.title || editor) ? (
            <h2
              contentEditable={editor}
              suppressContentEditableWarning
              onBlur={(event) => {
                if (!editor || typeof onChangeBlock !== "function") return;
                onChangeBlock({ ...props, title: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
              }}
              style={{
                ...sharedStyles.sectionTitle(compact),
                color: props.headlineColor || (isSpotlight ? "#f1f5f9" : "#0f172a"),
                textAlign: isSpotlight ? "center" : undefined,
                outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                borderRadius: 8,
                padding: editor ? "4px 6px" : 0,
                marginBottom: 4,
              }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(props.title || (editor ? "What Our Customers Say" : "")) }}
            />
          ) : null}
          <div style={asStyleObject(variantSty.grid)}>
            {testimonialItems.map((item, idx) => (
              variantSty.cardWrap
                ? <div key={item.id || `tw-${idx}`} style={asStyleObject(variantSty.cardWrap)}>{renderTestimonialCard(item, idx)}</div>
                : renderTestimonialCard(item, idx)
            ))}
          </div>
          </div>
        </section>
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
        <section style={{ ...sharedStyles.cardSection(compact, { ...props, backgroundColor: pricingVariant.section?.background || props.backgroundColor, borderColor: pricingVariant.section?.borderColor || props.borderColor }), ...fullWidthStyle(props, compact, editor), ...sectionAnimationStyle }}>
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
              ...(compact
                ? {}
                : {
                    gridTemplateColumns: `repeat(${Math.max(1, plans.length)}, minmax(0, ${Math.max(180, Number(props.pricingCardWidth) || 260)}px))`,
                    gap: Math.max(8, Number(props.pricingCardGap) || 24),
                    justifyContent: "center",
                  }),
            }}
          >
            {plans.map((plan, idx) => (
              <article key={plan.id || `${plan.name}-${idx}`} style={{ ...pricingVariant.card(!!plan.highlighted, compact, idx), background: plan.cardBackgroundColor || (plan.highlighted ? (props.highlightedCardBackgroundColor || pricingVariant.card(!!plan.highlighted, compact, idx).background) : (props.cardBackgroundColor || pricingVariant.card(!!plan.highlighted, compact, idx).background)), border: plan.highlighted && props.accentColor ? `2px solid ${props.accentColor}` : pricingVariant.card(!!plan.highlighted, compact, idx).border, ...sharedStyles.priceCardLayout(compact, !!plan.highlighted), ...getAnimationStyle("fade-up", idx * 0.08) }}>
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
                    ...(props.accentColor ? { background: `linear-gradient(135deg,${accentTone},${colorWithAlpha(accentTone, 0.72)})`, color: props.ctaTextColor || "#ffffff" } : {}),
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
                  return (
                    <>
                <div style={sharedStyles.priceHero}>
                  <h3
                    data-website-inline-editor="true"
                    data-text-prop={`plans.${idx}.name`}
                    contentEditable={editor}
                    suppressContentEditableWarning
                    onBlur={(event) => patchPlan(idx, { name: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                    style={{ ...sharedStyles.planName, ...headingTypography(props), color: pricingTone?.text || undefined, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0 }}
                    dangerouslySetInnerHTML={{ __html: asRichHtml(plan.name || (editor ? "Plan" : "")) }}
                  />
                  <p
                    data-website-inline-editor="true"
                    data-text-prop={`plans.${idx}.price`}
                    contentEditable={editor}
                    suppressContentEditableWarning
                    onBlur={(event) => patchPlan(idx, { price: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                    style={{ ...sharedStyles.planPrice, color: pricingTone?.text || undefined, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0 }}
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
                <div style={{ ...sharedStyles.planSectionLabel, color: pricingTone?.subtle || undefined }}>Included</div>
                <div style={sharedStyles.planFeatures}>
                  {asArray(plan.includedFeatures).map((feature, featureIdx) => (
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
                  ))}
                </div>
                <div style={{ ...sharedStyles.planExtrasCard(!!plan.highlighted), ...extrasCardStyle }}>
                  <div style={{ ...sharedStyles.planSectionLabel, color: pricingTone?.subtle || undefined }}>Extras</div>
                  <div style={sharedStyles.planExtrasList}>
                    {asArray(plan.extras).length ? asArray(plan.extras).map((extra, extraIdx) => (
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
                    )) : <p style={{ ...sharedStyles.planExtraHint, color: pricingTone?.subtle || undefined }}>No extras listed yet.</p>}
                  </div>
                </div>
                <div
                  data-website-inline-editor="true"
                  data-text-prop={`plans.${idx}.cta`}
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => patchPlan(idx, { cta: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                  style={{ ...sharedStyles.planCta(!!plan.highlighted), ...ctaStyle, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none" }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(plan.cta || (editor ? "Get Started" : "")) }}
                />
                    </>
                  );
                })()}
              </article>
            ))}
          </div>
          </div>
        </section>
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
        <section style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), ...sectionAnimationStyle, background: props.sectionGradient || props.backgroundColor || "#ffffff" }}>
          <div style={sectionContentStyle(props, compact)}>
            <div style={{ display: "grid", gridTemplateColumns: wrapperGrid, gap: compact ? 16 : 22, alignItems: "stretch", maxWidth: formMaxWidth, margin: "0 auto" }}>
              {mediaPosition === "top" && mediaImageSrc ? <img src={mediaImageSrc} alt={props.mediaAlt || props.title || "Contact form"} style={{ width: "100%", ...contactVariant.media }} /> : null}
              {mediaPosition === "left" && mediaImageSrc ? <img src={mediaImageSrc} alt={props.mediaAlt || props.title || "Contact form"} style={{ width: "100%", height: "100%", ...contactVariant.media }} /> : null}
              {formCard}
              {mediaPosition === "right" && mediaImageSrc ? <img src={mediaImageSrc} alt={props.mediaAlt || props.title || "Contact form"} style={{ width: "100%", height: "100%", ...contactVariant.media }} /> : null}
            </div>
          </div>
        </section>
      );

    case "image-gallery":
      const galleryVariant = imageGalleryVariantStyles(props, compact);
      return (
        <section style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), ...sectionAnimationStyle }}>
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
              <div key={`${image.alt || "image"}-${idx}`} style={galleryVariant.card(idx)}>
                {image?.src ? <img src={image.src} alt={image.alt || "Gallery image"} style={{ ...galleryVariant.image, objectPosition: `${image.imageX}% ${image.imageY}%` }} /> : <div style={sharedStyles.galleryPlaceholder}>No image</div>}
                {image.caption ? <div style={galleryVariant.captionWrap}><p style={galleryVariant.caption}>{image.caption}</p></div> : null}
              </div>
            );})}
          </div>
          </div>
        </section>
      );

    case "image-stack":
      return <LayeredImageStackBlock blockProps={props} compact={compact} assets={assets} editor={editor} onChangeBlock={onChangeBlock} onUploadLayerImage={onUploadLayerImage} />;

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

    case "accordion":
    case "faq":
      return <FAQAccordionBlock props={props} compact={compact} editor={editor} onChangeBlock={onChangeBlock} sectionAnimationStyle={sectionAnimationStyle} assets={assets} />;

    case "stats":
      const statsItems = asArray(props.stats).map((item, index) => normalizeStatItem(item, index));
      const statsVariant = statsVariantStyles(props, compact);
      const patchStat = (index, patch) => {
        if (!editor || typeof onChangeBlock !== "function") return;
        onChangeBlock({
          ...props,
          stats: statsItems.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
        });
      };

      return (
        <section style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), ...statsVariant.section, ...sectionAnimationStyle }}>
          <div style={sectionContentStyle(props, compact)}>
          <div style={asStyleObject(statsVariant.shell)}>
            <div style={asStyleObject(statsVariant.header)}>
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
                  style={{ ...sharedStyles.sectionSub, ...bodyTypography(props), color: props.textColor || undefined, opacity: props.subtitle ? 0.88 : 0.72, marginTop: 12, outline: editor ? "1px dashed rgba(14,165,233,0.3)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0 }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(props.subtitle || "Add a short supporting line for the stats section.") }}
                />
              ) : null}
            </div>
            <div style={asStyleObject(statsVariant.cardsShell || statsVariant.grid)}>
              <div style={statsVariant.cardsShell ? asStyleObject(statsVariant.grid) : {}}>
                {statsItems.map((stat, idx) => (
                  <div key={`${stat.id}-${idx}`} style={{ ...(statsVariant.cardWrap ? statsVariant.cardWrap(idx) : {}), ...getAnimationStyle("fade-up", idx * 0.06) }}>
                    <div style={statsVariant.card(idx)}>
                      {statsVariant.accentBar ? <span aria-hidden="true" style={asStyleObject(statsVariant.accentBar)} /> : null}
                      <p
                        data-website-inline-editor="true"
                        data-text-prop={`stats.${idx}.number`}
                        contentEditable={editor}
                        suppressContentEditableWarning
                        onBlur={(event) => patchStat(idx, { number: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                        style={asStyleObject(typeof statsVariant.number === "function" ? statsVariant.number(idx) : statsVariant.number)}
                        dangerouslySetInnerHTML={{ __html: asRichHtml(stat.number || "0") }}
                      />
                      <p
                        data-website-inline-editor="true"
                        data-text-prop={`stats.${idx}.label`}
                        contentEditable={editor}
                        suppressContentEditableWarning
                        onBlur={(event) => patchStat(idx, { label: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                        style={asStyleObject(statsVariant.label)}
                        dangerouslySetInnerHTML={{ __html: asRichHtml(stat.label || "Metric") }}
                      />
                      {(stat.detail || editor) ? (
                        <p
                          data-website-inline-editor="true"
                          data-text-prop={`stats.${idx}.detail`}
                          contentEditable={editor}
                          suppressContentEditableWarning
                          onBlur={(event) => patchStat(idx, { detail: cleanInlineEditorHtml(event.currentTarget.innerHTML) })}
                          style={asStyleObject(statsVariant.detail)}
                          dangerouslySetInnerHTML={{ __html: asRichHtml(stat.detail || "Add a short line of context.") }}
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
        </section>
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
          <article style={{ ...teamVariant.card(animIdx), ...getAnimationStyle("fade-up", animIdx * 0.08) }}>
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
          </article>
        );
      };

      return (
        <section style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), ...teamVariant.section, ...sectionAnimationStyle }}>
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
        </section>
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
          <section style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), background: nlBg || "linear-gradient(165deg,#f8fafc,#ffffff)", textAlign: "center", ...sectionAnimationStyle }}>
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
          </section>
        );
      }

      // VARIANT: dark-banner
      if (nlVariant === "dark-banner") {
        return (
          <section style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), background: nlBg || "linear-gradient(135deg,#0f172a,#1e3a5f)", ...sectionAnimationStyle }}>
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
          </section>
        );
      }

      // VARIANT: split
      if (nlVariant === "split") {
        return (
          <section style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), background: nlBg || "#ffffff", ...sectionAnimationStyle }}>
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
          </section>
        );
      }

      // VARIANT: card-highlight
      return (
        <section style={{ ...sharedStyles.cardSection(compact, props), ...fullWidthStyle(props, compact, editor), background: nlBg || "linear-gradient(135deg,#eff6ff,#dbeafe)", ...sectionAnimationStyle }}>
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
                style={inlineStyle({ margin: "10px 0 0", fontSize: 12, color: nlTextColor, opacity: 0.55 })}
                dangerouslySetInnerHTML={{ __html: asRichHtml(props.privacyText || (editor ? "No spam. Unsubscribe anytime." : "")) }}
              />
            ) : null}
          </div>
          </div>
        </section>
      );
    }

    case "trust-badges":
      const trustBadgeBackgroundImage = resolveAssetField(props, "backgroundImage", assets);
      const trustBadgeSty = trustBadgeVariantStyles(props, compact, trustBadgeBackgroundImage);
      return (
        <section style={{ ...trustBadgeSty.section, ...fullWidthStyle(props, compact, editor), ...sectionAnimationStyle }}>
          <div style={sectionContentStyle(props, compact)}>
          <div style={asStyleObject(trustBadgeSty.row)}>
            {asArray(props.badges).map((badge, idx) => (
              <div key={`${badge.label}-${idx}`} style={asStyleObject(trustBadgeSty.badge)}>
                <span style={asStyleObject(trustBadgeSty.icon)}>{badge.icon || "✓"}</span>
                <span>{badge.label || "Badge"}</span>
              </div>
            ))}
          </div>
          </div>
        </section>
      );

    case "divider":
      return <div style={sharedStyles.divider(props.color)} />;

    case "space":
      return <div style={{ height: props.height || 40, background: "transparent", width: "100%" }} />;

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
      const contactItems = [
        props.contactEmail,
        props.contactPhone,
        props.contactAddress,
      ].filter(Boolean);

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
        <footer style={{ background: ftBg, color: ftText, padding: compact ? "32px 20px 16px" : "48px 32px 20px", boxSizing: "border-box", width: "100%", ...fullWidthStyle({ ...props, fullWidthBackground: props.fullWidthBackground !== false }, compact, editor), ...sectionAnimationStyle }}>
          <div style={sectionContentStyle(props, compact)}>
          {/* Top grid */}
          <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : `1fr 1fr${props.showNewsletter !== false ? " 1fr" : ""}`, gap: compact ? 28 : 40, marginBottom: compact ? 24 : 36 }}>

            {/* Col 1: Brand */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <BrandMark
                brand={props.brand}
                logoSrc={footerLogoSrc}
                size={footerMarkSize}
                background={ftBtnBg}
                color={ftBtnText}
                borderColor={ftBorder}
                borderRadius={10}
              />
              <span
                contentEditable={editor} suppressContentEditableWarning
                onBlur={(e) => patchFt({ brand: e.currentTarget.textContent })}
                style={inlineStyle({ fontSize: compact ? 18 : 22, fontWeight: 600, color: ftText })}
              >{props.brand || (editor ? "Your Brand" : "")}</span>
              {(props.tagline || editor) ? (
                <span
                  contentEditable={editor} suppressContentEditableWarning
                  onBlur={(e) => patchFt({ tagline: e.currentTarget.textContent })}
                  style={inlineStyle({ fontSize: 16, color: ftLink, lineHeight: 1.5 })}
                >{props.tagline || (editor ? "Your tagline here." : "")}</span>
              ) : null}
              {contactItems.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                  {(props.contactHeading || editor) ? (
                    <span
                      contentEditable={editor} suppressContentEditableWarning
                      onBlur={(e) => patchFt({ contactHeading: e.currentTarget.textContent })}
                      style={inlineStyle({ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: ftText, marginBottom: 2 })}
                    >{props.contactHeading || "Contact"}</span>
                  ) : null}
                  {(props.contactEmail || editor) ? (
                    <a
                      href={editor ? undefined : (footerEmailHref || undefined)}
                      contentEditable={editor} suppressContentEditableWarning
                      onBlur={(e) => patchFt({ contactEmail: e.currentTarget.textContent })}
                      style={{ ...inlineStyle({ fontSize: 15, color: ftLink, lineHeight: 1.5 }), textDecoration: "none" }}
                    >{props.contactEmail || (editor ? "hello@yourbrand.com" : "")}</a>
                  ) : null}
                  {(props.contactPhone || editor) ? (
                    <a
                      href={editor ? undefined : (footerPhoneHref || undefined)}
                      contentEditable={editor} suppressContentEditableWarning
                      onBlur={(e) => patchFt({ contactPhone: e.currentTarget.textContent })}
                      style={{ ...inlineStyle({ fontSize: 15, color: ftLink, lineHeight: 1.5 }), textDecoration: "none" }}
                    >{props.contactPhone || (editor ? "(555) 010-2026" : "")}</a>
                  ) : null}
                  {(props.contactAddress || editor) ? (
                    <span
                      contentEditable={editor} suppressContentEditableWarning
                      onBlur={(e) => patchFt({ contactAddress: e.currentTarget.textContent })}
                      style={inlineStyle({ fontSize: 15, color: ftLink, lineHeight: 1.5 })}
                    >{props.contactAddress || (editor ? "Your city, state" : "")}</span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Col 2: Nav links */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(props.navHeading || editor) ? (
                <span
                  contentEditable={editor} suppressContentEditableWarning
                  onBlur={(e) => patchFt({ navHeading: e.currentTarget.textContent })}
                  style={inlineStyle({ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: ftText, marginBottom: 4 })}
                >{props.navHeading || "Navigation"}</span>
              ) : null}
              {navLinks.map((link, i) => (
                <a
                  key={i}
                  href={editor ? undefined : resolvePublishedNavHref(link, navigationContext)}
                  style={{ color: ftLink, fontSize: 16, textDecoration: "none", lineHeight: 1.6 }}
                >{link.label || "Link"}</a>
              ))}
              {extraLinks.length > 0 ? (
                <>
                  {(props.extraHeading || editor) ? (
                    <span
                      contentEditable={editor} suppressContentEditableWarning
                      onBlur={(e) => patchFt({ extraHeading: e.currentTarget.textContent })}
                      style={inlineStyle({ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: ftText, marginTop: 12, marginBottom: 4 })}
                    >{props.extraHeading || "Company"}</span>
                  ) : null}
                  {extraLinks.map((link, i) => (
                    <a
                      key={i}
                      href={editor ? undefined : resolvePublishedNavHref(link, navigationContext)}
                      style={{ color: ftLink, fontSize: 16, textDecoration: "none", lineHeight: 1.6 }}
                    >{link.label || "Link"}</a>
                  ))}
                </>
              ) : null}
            </div>

            {/* Col 3: Newsletter */}
            {props.showNewsletter !== false ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span
                  contentEditable={editor} suppressContentEditableWarning
                  onBlur={(e) => patchFt({ newsletterHeading: e.currentTarget.textContent })}
                  style={inlineStyle({ fontSize: compact ? 15 : 17, fontWeight: 600, color: ftText })}
                >{props.newsletterHeading || "Stay Updated"}</span>
                {(props.newsletterSubtitle || editor) ? (
                  <span
                    contentEditable={editor} suppressContentEditableWarning
                    onBlur={(e) => patchFt({ newsletterSubtitle: e.currentTarget.textContent })}
                    style={inlineStyle({ fontSize: 16, color: ftLink, lineHeight: 1.5 })}
                  >{props.newsletterSubtitle || "Get the latest news."}</span>
                ) : null}
                <form
                  style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}
                  onSubmit={handleFooterNewsletterSubmit}
                  action={editor || !newsletterUsesExternalForm ? undefined : newsletterActionHref}
                  method={editor || !newsletterUsesExternalForm ? undefined : newsletterFormMethod}
                >
                  {editor ? (
                    <div style={{ flex: 1, minWidth: 140, borderRadius: 10, minHeight: 40, border: `1px solid ${ftBorder}`, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", paddingLeft: 12, color: ftLink, fontSize: 16 }}>
                      Email address
                    </div>
                  ) : (
                    <input
                      type="email"
                      name="footer-newsletter-email"
                      placeholder="Email address"
                      required
                      style={{ flex: 1, minWidth: 140, borderRadius: 10, minHeight: 40, border: `1px solid ${ftBorder}`, background: "rgba(255,255,255,0.08)", display: "block", padding: "0 12px", color: "#ffffff", fontSize: 16, font: "inherit", boxSizing: "border-box" }}
                    />
                  )}
                  <button type={editor ? "button" : "submit"} style={{ background: ftBtnBg, color: ftBtnText, border: "none", borderRadius: 10, padding: "0 16px", minHeight: 40, fontWeight: 600, fontSize: 16, cursor: editor ? "default" : "pointer", whiteSpace: "nowrap", opacity: editor || newsletterUsesExternalForm || newsletterFallbackHref ? 1 : 0.65 }}
                    contentEditable={editor} suppressContentEditableWarning
                    onBlur={(e) => patchFt({ newsletterButtonText: e.currentTarget.textContent })}
                  >{props.newsletterButtonText || "Subscribe"}</button>
                </form>
              </div>
            ) : null}
          </div>

          {/* Bottom row: divider + copyright */}
          <div style={{ borderTop: `1px solid ${ftBorder}`, paddingTop: compact ? 14 : 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span
              contentEditable={editor} suppressContentEditableWarning
              onBlur={(e) => patchFt({ copyrightText: e.currentTarget.textContent })}
              style={inlineStyle({ fontSize: 12, color: ftLink })}
            >{props.copyrightText || (editor ? "© 2025 Your Brand. All rights reserved." : "")}</span>
          </div>
          </div>
        </footer>
      );
    }

    default:
      return (
        <article style={{ ...sharedStyles.cardSection(compact, props), ...sectionAnimationStyle }}>
          <h2 style={sharedStyles.sectionTitle(compact)}>{String(block?.type || "Block")}</h2>
          <p style={sharedStyles.bodyCopy}>This block preview will be expanded further.</p>
        </article>
      );
  }
}

const sharedStyles = {
  cta: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: MIN_TAP_SIZE,
    minWidth: MIN_TAP_SIZE,
    width: "fit-content",
    textDecoration: "none",
    background: "linear-gradient(135deg,#0ea5e9,#2563eb)",
    color: "#ffffff",
    padding: "14px 18px",
    borderRadius: 999,
    fontWeight: 600,
    fontSize: MIN_TEXT_SIZE,
    border: "1px solid rgba(255,255,255,0.34)",
    boxShadow: "0 18px 36px rgba(37,99,235,0.34)",
  },
  editorChip: {
    appearance: "none",
    border: "1px solid rgba(125,211,252,0.36)",
    background: "rgba(15,23,42,0.76)",
    color: "#e0f2fe",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  ctaCompact: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: MIN_TAP_SIZE,
    minWidth: MIN_TAP_SIZE,
    width: "fit-content",
    textDecoration: "none",
    background: "linear-gradient(135deg,#0ea5e9,#2563eb)",
    color: "#ffffff",
    padding: "10px 14px",
    borderRadius: 999,
    fontWeight: 600,
    fontSize: MIN_TEXT_SIZE,
    border: "1px solid rgba(255,255,255,0.3)",
    boxShadow: "0 14px 30px rgba(37,99,235,0.28)",
  },
  cardSection: (compact, props = {}) => {
    const scale = spacingMultiplier(props);
    return {
    border: `1px solid ${props.borderColor || "rgba(148,163,184,0.28)"}`,
    background: props.backgroundColor || "linear-gradient(165deg,#ffffff 0%,#f8fafc 100%)",
    color: props.textColor || "#0f172a",
    borderRadius: compact ? 16 : 22,
    padding: scaleBoxPadding(compact ? "20px" : "30px", scale),
    boxShadow: PREMIUM_SHADOW,
    };
  },
  sectionTitle: (compact) => ({
    margin: 0,
    fontSize: compact ? 20 : 28,
    lineHeight: 1.15,
    fontWeight: 600,
    color: "#0f172a",
  }),
  sectionSub: {
    margin: "8px 0 0",
    color: "#475569",
    fontSize: MIN_TEXT_SIZE,
    lineHeight: 1.6,
  },
  bodyCopy: {
    margin: "8px 0 0",
    color: "#334155",
    fontSize: MIN_TEXT_SIZE,
    lineHeight: 1.7,
  },
  figure: { margin: 0, display: "grid", gap: 8 },
  figureImage: { width: "100%", borderRadius: 22, objectFit: "cover", border: PREMIUM_BORDER, boxShadow: PREMIUM_SHADOW },
  figureCaption: { margin: 0, color: "#475569", fontSize: MIN_TEXT_SIZE, lineHeight: 1.5 },
  featureList: (layout, compact, cardWidth = 320) => ({ display: "grid", gap: 12, marginTop: 16, gridTemplateColumns: layout === "columns" ? (compact ? "1fr" : `repeat(auto-fit, minmax(${Math.max(220, Math.round((Number(cardWidth) || 320) * 0.78))}px, ${Math.max(220, Number(cardWidth) || 320)}px))`) : "1fr", justifyContent: layout === "columns" && !compact ? "center" : undefined }),
  featureItem: (compact) => ({ display: "flex", gap: 10, alignItems: "flex-start", color: "#0f172a", fontSize: Math.max(MIN_TEXT_SIZE, compact ? 14 : 16), lineHeight: 1.6, width: "100%", minWidth: 0, boxSizing: "border-box" }),
  featureCheck: { color: "#16a34a", fontWeight: 600, flex: "0 0 auto" },
  quote: (compact) => ({ margin: 0, fontSize: compact ? 18 : 24, lineHeight: 1.6, fontWeight: 600, color: "#0f172a", fontStyle: "italic" }),
  authorRow: { display: "flex", gap: 12, alignItems: "center", marginTop: 16 },
  avatar: { width: 54, height: 54, borderRadius: 999, objectFit: "cover" },
  authorName: { margin: 0, fontSize: 16, lineHeight: 1.2, fontWeight: 600, color: "#0f172a" },
  authorMeta: { margin: "4px 0 0", color: "#64748b", fontSize: MIN_TEXT_SIZE, lineHeight: 1.4 },
  priceGrid: (compact, count = 3, cardWidth = 260, cardGap = 24) => ({ display: "grid", gridTemplateColumns: compact ? "1fr" : `repeat(${Math.max(1, count)}, minmax(0, ${Math.max(180, Number(cardWidth) || 260)}px))`, gap: compact ? 16 : Math.max(8, Number(cardGap) || 24), marginTop: 20, alignItems: compact ? "stretch" : "center", justifyContent: compact ? "stretch" : "center" }),
  priceCardLayout: (compact, highlighted) => ({ display: "grid", gap: compact ? 14 : 18, minHeight: compact ? "auto" : highlighted ? 620 : 580 }),
  priceHero: { display: "grid", gap: 6, paddingRight: 88 },
  planName: { margin: 0, fontSize: 24, fontWeight: 600, color: "#0f172a", lineHeight: 1.2 },
  planPrice: { margin: "4px 0 0", fontSize: 38, fontWeight: 600, color: "#0f172a", letterSpacing: "-0.03em" },
  planDesc: { margin: "2px 0 0", color: "#64748b", fontSize: MIN_TEXT_SIZE, lineHeight: 1.6 },
  planSectionLabel: { fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#64748b" },
  planFeatures: { display: "grid", gap: 10 },
  planFeatureRow: (highlighted) => ({ display: "grid", gridTemplateColumns: "34px minmax(0,1fr)", gap: 10, alignItems: "start", padding: highlighted ? "10px 12px" : "9px 10px", borderRadius: 16, background: highlighted ? "rgba(255,255,255,0.72)" : "rgba(248,250,252,0.9)", border: highlighted ? "1px solid rgba(14,165,233,0.16)" : "1px solid rgba(226,232,240,0.95)" }),
  planFeatureIcon: (iconType, highlighted) => ({ display: "inline-grid", placeItems: "center", width: 30, height: 30, borderRadius: 999, background: highlighted ? "linear-gradient(135deg,#0ea5e9,#2563eb)" : "linear-gradient(135deg,#dbeafe,#eff6ff)", color: highlighted ? "#ffffff" : (iconType === "spark" ? "#0284c7" : "#0f172a"), fontSize: iconType === "diamond" ? 14 : 16, fontWeight: 600, boxShadow: highlighted ? "0 10px 18px rgba(37,99,235,0.28)" : "none" }),
  planFeature: { margin: 0, color: "#334155", fontSize: MIN_TEXT_SIZE, lineHeight: 1.55, minWidth: 0 },
  planExtrasCard: (highlighted) => ({ display: "grid", gap: 10, padding: highlighted ? "16px 18px" : "14px 16px", borderRadius: 20, background: highlighted ? "linear-gradient(180deg,rgba(255,255,255,0.86),rgba(239,246,255,0.92))" : "linear-gradient(180deg,#ffffff,#f8fafc)" , border: highlighted ? "1px solid rgba(14,165,233,0.22)" : "1px dashed rgba(148,163,184,0.5)" }),
  planExtrasList: { display: "grid", gap: 8 },
  planExtra: { margin: 0, color: "#0f172a", fontSize: 16, lineHeight: 1.55 },
  planExtraHint: { margin: 0, color: "#94a3b8", fontSize: 16, lineHeight: 1.5, fontStyle: "italic" },
  planCta: (highlighted) => ({ marginTop: "auto", alignSelf: "stretch", display: "block", borderRadius: 18, padding: "14px 18px", textAlign: "center", fontWeight: 600, color: highlighted ? "#ffffff" : "#0f172a", background: highlighted ? "linear-gradient(135deg,#0ea5e9,#2563eb)" : "linear-gradient(135deg,#f8fafc,#e2e8f0)", boxShadow: highlighted ? "0 16px 28px rgba(37,99,235,0.28)" : "inset 0 0 0 1px rgba(148,163,184,0.32)" }),
  formGrid: { display: "grid", gap: 12, marginTop: 16 },
  formField: { display: "grid", gap: 6 },
  formLabel: { color: "#0f172a", fontSize: MIN_TEXT_SIZE, fontWeight: 600 },
  inputShell: { borderRadius: 14, minHeight: 46, border: "1px solid #cbd5e1", background: "#ffffff", boxShadow: "inset 0 0 0 1px rgba(248,250,252,0.8)" },
  formSubmitBtn: { marginTop: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 48, padding: "12px 18px", borderRadius: 12, background: "#0f172a", color: "#ffffff", fontSize: MIN_TEXT_SIZE, fontWeight: 600, boxShadow: "0 14px 28px rgba(15,23,42,0.18)" },
  galleryGrid: { display: "grid", gap: 12, marginTop: 16 },
  galleryCard: { borderRadius: 18, overflow: "hidden", background: "#e2e8f0", minHeight: 160, border: PREMIUM_BORDER, boxShadow: "0 18px 30px rgba(15,23,42,0.12)" },
  galleryImage: { width: "100%", height: "100%", minHeight: 160, objectFit: "cover", display: "block" },
  galleryPlaceholder: { minHeight: 160, display: "grid", placeItems: "center", color: "#64748b", fontSize: MIN_TEXT_SIZE },
  columns: (count) => ({ display: "grid", gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`, gap: 16, color: "#334155", lineHeight: 1.7 }),
  stack: { display: "grid", gap: 12, marginTop: 16 },
  faqItem: { borderRadius: 16, border: "1px solid #cbd5e1", padding: 16, background: "linear-gradient(160deg,#f8fafc,#ffffff)", boxShadow: "0 8px 18px rgba(15,23,42,0.08)", display: "grid", gap: 10 },
  faqTrigger: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "transparent", border: "none", padding: 0, margin: 0, textAlign: "left", cursor: "pointer" },
  faqChevronButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", padding: 0, margin: 0, cursor: "pointer", flex: "0 0 auto" },
  faqQ: { margin: 0, color: "#0f172a", fontSize: 16, lineHeight: 1.4, wordBreak: "break-word", overflowWrap: "anywhere" },
  faqChevron: { color: "#2563eb", fontSize: 22, fontWeight: 600, flex: "0 0 auto", transition: "transform 0.18s ease" },
  faqA: { margin: 0, color: "#475569", fontSize: MIN_TEXT_SIZE, lineHeight: 1.6, wordBreak: "break-word", overflowWrap: "anywhere" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 16 },
  statCard: { borderRadius: 18, padding: 20, background: "linear-gradient(160deg,#eff6ff,#ffffff)", border: "1px solid #dbeafe", boxShadow: "0 14px 28px rgba(37,99,235,0.14)" },
  statNumber: { margin: 0, color: "#0f172a", fontSize: 28, fontWeight: 600 },
  statLabel: { margin: "6px 0 0", color: "#64748b", fontSize: MIN_TEXT_SIZE },
  teamGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginTop: 16 },
  teamCard: { borderRadius: 20, border: PREMIUM_BORDER, background: "linear-gradient(165deg,#ffffff,#f8fafc)", overflow: "hidden", paddingBottom: 16, boxShadow: "0 18px 34px rgba(15,23,42,0.12)" },
  teamImage: { width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block", marginBottom: 12 },
  teamPlaceholder: { width: "100%", aspectRatio: "4 / 3", display: "grid", placeItems: "center", background: "#e2e8f0", color: "#64748b", marginBottom: 12 },
  newsletterRow: { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 },
  badgesRow: { display: "flex", gap: 12, flexWrap: "wrap" },
  badge: { display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, padding: "10px 14px", background: "linear-gradient(165deg,#ffffff,#f1f5f9)", border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: 600, boxShadow: "0 10px 20px rgba(15,23,42,0.1)" },
  divider: (color) => ({ height: 1, background: color || "#cbd5e1", width: "100%" }),
  videoShell: { marginTop: 16, minHeight: 220, borderRadius: 20, background: "linear-gradient(165deg,#0f172a,#1e293b)", color: "#fff", display: "grid", placeItems: "center", padding: 20, border: "1px solid rgba(148,163,184,0.3)", boxShadow: "0 24px 44px rgba(15,23,42,0.3)" },
};
