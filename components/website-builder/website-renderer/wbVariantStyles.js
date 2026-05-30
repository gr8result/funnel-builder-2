import React from "react";
import { FaArrowDown, FaArrowRight } from "react-icons/fa";
import { getAssetFromLibrary, resolveAssetField } from "../../../lib/website-builder/mediaAssets";
import { renderGridLibraryIcon } from "../gridIconLibrary";
import {
  MIN_TEXT_SIZE, MIN_TAP_SIZE, PREMIUM_SHADOW, PREMIUM_BORDER, DEFAULT_LAYOUT_WIDTH, asArray,
} from "./wbAnimations";

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function asStyleObject(style) {
  return style && typeof style === "object" ? style : {};
}

function asRichHtml(value) {
  const raw = String(value ?? "");
  if (!raw) return "";
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{2,}/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}

// Strip values that are known canvas placeholder strings so they never show in preview
const CANVAS_PLACEHOLDER_STRINGS = new Set([
  "Section label",
  "Section Label",
  "Launch label",
  "Click to type headline",
  "Add supporting text here",
]);
function stripPlaceholder(value) {
  if (!value) return "";
  return CANVAS_PLACEHOLDER_STRINGS.has(String(value).trim()) ? "" : value;
}

// Returns additional CSS for headline text style effects (outline, gradient, glow, shadow)
function computeHeadlineTextStyleCss(props) {
  const style = props?.headlineTextStyle || "fill";
  if (style === "outline") {
    const color = props?.headlineOutlineColor || "#ffffff";
    const width = Math.max(1, Number(props?.headlineOutlineWidth || 2));
    return {
      WebkitTextStroke: `${width}px ${color}`,
      WebkitTextFillColor: "transparent",
      color: "transparent",
    };
  }
  if (style === "gradient") {
    const gradient = props?.headlineGradient || "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)";
    return {
      background: gradient,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      WebkitTextFillColor: "transparent",
      color: "transparent",
    };
  }
  if (style === "glow") {
    const color = props?.headlineGlowColor || "#7c3aed";
    const blur = Math.max(4, Number(props?.headlineGlowBlur || 20));
    return {
      textShadow: `0 0 ${blur}px ${color}, 0 0 ${blur * 2}px ${color}`,
    };
  }
  if (style === "shadow") {
    const color = props?.headlineShadowColor || "rgba(0,0,0,0.6)";
    const blur = Math.max(0, Number(props?.headlineShadowBlur || 12));
    const offsetX = Number(props?.headlineShadowOffsetX ?? 2);
    const offsetY = Number(props?.headlineShadowOffsetY ?? 4);
    return {
      textShadow: `${offsetX}px ${offsetY}px ${blur}px ${color}`,
    };
  }
  return {};
}

function textLayerBackgroundStyle(layer) {
  const background = typeof layer?.background === "string" && layer.background.trim()
    ? layer.background
    : "transparent";

  return {
    background,
    display: "flex",
    alignItems: String(layer?.verticalAlign || "center") === "top"
      ? "flex-start"
      : String(layer?.verticalAlign || "center") === "bottom"
        ? "flex-end"
        : "center",
    justifyContent: String(layer?.textAlign || "center") === "left"
      ? "flex-start"
      : String(layer?.textAlign || "center") === "right"
        ? "flex-end"
        : "center",
    padding: 18,
    boxSizing: "border-box",
  };
}

function headingTypography(props) {
  return {
    fontFamily: props?.headlineFontFamily || props?.headingFontFamily || "inherit",
    fontWeight: props?.headlineFontWeight || "600",
    textAlign: props?.headlineAlignment || "center",
    color: props?.headlineColor || "inherit",
    ...(props?.headlineLineHeight ? { lineHeight: props.headlineLineHeight } : {}),
  };
}

function bodyTypography(props) {
  return {
    fontFamily: props?.fontFamily || props?.bodyFontFamily || "inherit",
    fontWeight: props?.fontWeight || "400",
    ...(props?.textLineHeight || props?.bodyLineHeight || props?.lineHeight ? { lineHeight: props?.textLineHeight || props?.bodyLineHeight || props?.lineHeight } : {}),
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

function parseSizeValue(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return fallback;

  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  const match = raw.match(/-?\d+(\.\d+)?/);
  if (!match) return fallback;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function fullWidthStyle(props, compact, editor) {
  const maxWidth = Math.max(320, Number(props?.baseLayoutWidth || DEFAULT_LAYOUT_WIDTH));
  if (props?.fullWidthBackground === false) {
    return {
      width: "100%",
      maxWidth: `${maxWidth}px`,
      marginLeft: "auto",
      marginRight: "auto",
    };
  }

  // Full-width background: outer container stretches edge-to-edge, no maxWidth cap
  return {
    width: "100%",
    maxWidth: "none",
    marginLeft: 0,
    marginRight: 0,
  };
}

function sectionContentStyle(props, compact, explicitMaxWidth = null) {
  const maxWidth = Math.max(320, Number(explicitMaxWidth || props?.baseLayoutWidth || DEFAULT_LAYOUT_WIDTH));
  return {
    width: "100%",
    maxWidth: `${maxWidth}px`,
    marginLeft: "auto",
    marginRight: "auto",
    boxSizing: "border-box",
    paddingLeft: compact ? 0 : 0,
    paddingRight: compact ? 0 : 0,
  };
}

function normalizeOverlayLayoutProps(props, layout, hasFloatingImage = false) {
  const contentX = clampValue(Number.isFinite(Number(props?.contentX)) ? Number(props.contentX) : layout.contentX, 0, 100);
  const contentYDefault = hasFloatingImage ? (layout.contentY ?? 50) : layout.contentY;
  const contentY = clampValue(Number.isFinite(Number(props?.contentY)) ? Number(props.contentY) : contentYDefault, 0, 100);
  const contentWidth = Math.max(240, Number.isFinite(Number(props?.contentWidth)) ? Number(props.contentWidth) : layout.contentWidth);
  const contentHeightFloor = (props?.headline || props?.subheadline || props?.ctaText) ? 420 : 100;
  const contentHeight = Math.max(contentHeightFloor, Number.isFinite(Number(props?.contentHeight)) ? Number(props.contentHeight) : layout.contentHeight);
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

  if (variant === "orbit") {
    return {
      headlineAlignment: "center",
      verticalAlign: "bottom",
      contentX: 50,
      contentY: compact ? 78 : 86,
      contentWidth: compact ? 320 : 700,
      contentHeight: compact ? 160 : 180,
      floatingX: 50,
      floatingY: compact ? 30 : 42,
      floatingWidth: compact ? 180 : 360,
      floatingHeight: compact ? 200 : 500,
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
  const explicitBg = String(props.contentBackground || "").trim();
  const bgIsNone = explicitBg === "transparent" || explicitBg === "none";
  const resolvedContentBg = (bg) => bgIsNone ? "transparent" : (explicitBg || bg);
  const contentShellBorderless = bgIsNone ? { border: "none", boxShadow: "none", backdropFilter: "none" } : {};

  if (variant === "split") {
    return {
      shell: {
        border: "none",
        boxShadow: "0 24px 60px rgba(2,6,23,0.22)",
        backgroundBlendMode: "screen, normal",
      },
      content: {
        maxWidth: compact ? "100%" : 520,
        alignItems: "flex-start",
      },
      contentShell: {
        background: resolvedContentBg("linear-gradient(160deg, rgba(8,17,32,0.58), rgba(15,23,42,0.28))"),
        border: "1px solid rgba(148,163,184,0.16)",
        borderRadius: compact ? 20 : 28,
        boxShadow: "0 20px 44px rgba(2,6,23,0.18)",
        backdropFilter: "blur(10px)",
        ...contentShellBorderless,
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
        border: "none",
        boxShadow: "0 28px 72px rgba(120,98,67,0.18)",
        backgroundBlendMode: "multiply, normal",
      },
      content: {
        maxWidth: compact ? "100%" : 560,
        alignItems: "flex-start",
      },
      contentShell: {
        background: resolvedContentBg("linear-gradient(180deg, rgba(255,250,243,0.92), rgba(247,241,232,0.84))"),
        border: "1px solid rgba(120,98,67,0.14)",
        borderRadius: compact ? 22 : 30,
        boxShadow: "0 24px 54px rgba(120,98,67,0.16)",
        backdropFilter: "blur(8px)",
        ...contentShellBorderless,
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
        border: "none",
        boxShadow: "0 22px 48px rgba(15,23,42,0.08)",
      },
      content: {
        maxWidth: compact ? "100%" : 500,
        alignItems: "flex-start",
      },
      contentShell: {
        background: resolvedContentBg("rgba(255,255,255,0.96)"),
        border: "1px solid rgba(226,232,240,0.92)",
        borderRadius: compact ? 22 : 28,
        boxShadow: "0 18px 42px rgba(15,23,42,0.08)",
        ...contentShellBorderless,
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

  if (variant === "orbit") {
    return {
      shell: {
        border: "none",
        boxShadow: "0 32px 80px rgba(2,6,23,0.5)",
      },
      content: {
        maxWidth: compact ? "100%" : 700,
        alignItems: "center",
      },
      contentShell: {
        background: resolvedContentBg("transparent"),
        border: "none",
        boxShadow: "none",
        backdropFilter: "none",
        ...contentShellBorderless,
      },
      imageFrame: {
        borderRadius: 0,
        border: "none",
        boxShadow: "none",
      },
      decor: null,
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
      border: "none",
      boxShadow: "0 30px 80px rgba(14,165,233,0.16)",
    },
    content: {
      maxWidth: compact ? "100%" : 760,
      alignItems: "center",
    },
    contentShell: {
      background: resolvedContentBg("linear-gradient(180deg, rgba(15,23,42,0.42), rgba(15,23,42,0.2))"),
      border: "1px solid rgba(125,211,252,0.18)",
      borderRadius: compact ? 22 : 30,
      boxShadow: "0 22px 52px rgba(8,47,73,0.24)",
      backdropFilter: "blur(10px)",
      ...contentShellBorderless,
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
  const imageHeight = Number(props?.featureImageHeight) || Number(props?.featureCardHeight) || 0;

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
        ...(imageHeight > 0 ? { height: imageHeight } : { aspectRatio: "4 / 5" }),
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
      ...(imageHeight > 0 ? { height: imageHeight } : { aspectRatio: "4 / 3" }),
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

  const fullWidth = props.fullWidthBackground !== false;
  const shellRadius = fullWidth ? 0 : (compact ? 16 : 28);
  const matchHeight = !compact && !!props.equalCardHeight;

  if (variant === "spotlight") {
    return {
      shell: { background: bg || "linear-gradient(165deg,#0f172a,#1e3a5f)", borderRadius: shellRadius },
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
      shell: { background: bg || "#f0f9ff", borderRadius: shellRadius },
      grid: {
        display: "flex",
        flexWrap: compact ? "nowrap" : "wrap",
        flexDirection: compact ? "column" : "row",
        justifyContent: "center",
        gap: 20,
        marginTop: 24,
        alignItems: matchHeight ? "stretch" : "start",
      },
      cardWrap: compact ? undefined : { width: cardWidth, maxWidth: "100%", flexShrink: 0, flexGrow: 0, boxSizing: "border-box", ...(matchHeight ? { display: "flex" } : {}) },
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
        ...(matchHeight ? { height: "100%", boxSizing: "border-box" } : {}),
      }),
      quote: { color: textCol || "#0f172a" },
      author: { color: textCol || "#0f172a" },
      meta: { color: "#64748b" },
      starColor: accent,
    };
  }

  if (variant === "wall") {
    return {
      shell: { background: bg || "#ffffff", borderRadius: shellRadius },
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
    shell: { background: bg || "linear-gradient(165deg,#f8fafc,#ffffff)", borderRadius: shellRadius },
    grid: {
      display: "flex",
      flexWrap: compact ? "nowrap" : "wrap",
      flexDirection: compact ? "column" : "row",
      justifyContent: "center",
      gap: 20,
      marginTop: 24,
      alignItems: matchHeight ? "stretch" : "start",
    },
    cardWrap: compact ? undefined : { width: cardWidth, maxWidth: "100%", flexShrink: 0, flexGrow: 0, boxSizing: "border-box", ...(matchHeight ? { display: "flex" } : {}) },
    card: () => ({
      background: cardBg || "#ffffff",
      border: `1px solid ${border || "rgba(148,163,184,0.28)"}`,
      borderRadius: compact ? 14 : 20,
      padding: compact ? "18px" : "26px 28px",
      boxShadow: PREMIUM_SHADOW,
      display: "grid",
      gap: 12,
      ...(matchHeight ? { height: "100%", boxSizing: "border-box" } : {}),
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
  const buttonFontSize = size === "small" ? 16 : size === "medium" ? 16 : 17;
  const titleFs = props.titleFontSize ? Number(props.titleFontSize) : null;
  const descFs = props.descFontSize ? Number(props.descFontSize) : null;
  const contentMW = props.contentMaxWidth ? Number(props.contentMaxWidth) : null;

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
      content: { display: "grid", gap: 8, textAlign: compact ? "center" : "left", maxWidth: contentMW || undefined },
      eyebrow: { fontSize: 16, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, color: colorWithAlpha(props.textColor || "#f8fafc", 0.7) },
      title: { margin: 0, fontSize: compact ? 24 : (titleFs || 34), lineHeight: 1.08, fontWeight: 600, color: props.textColor || "#f8fafc" },
      description: { margin: 0, fontSize: compact ? 16 : (descFs || 18), lineHeight: 1.65, color: colorWithAlpha(props.textColor || "#f8fafc", 0.82), maxWidth: 620 },
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
      content: { display: "grid", gap: 10, textAlign: props.alignment || "left", maxWidth: contentMW || undefined },
      eyebrow: { fontSize: 16, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600, color: colorWithAlpha(props.textColor || "#2f241b", 0.62) },
      title: { margin: 0, fontSize: compact ? 24 : (titleFs || 36), lineHeight: 1.08, fontWeight: 600, color: props.textColor || "#2f241b", maxWidth: 760 },
      description: { margin: 0, fontSize: compact ? 16 : (descFs || 18), lineHeight: 1.75, color: colorWithAlpha(props.textColor || "#2f241b", 0.8), maxWidth: 720 },
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
      content: { display: "grid", gap: 10, justifyItems: "center", textAlign: "center", maxWidth: contentMW || 780, marginLeft: "auto", marginRight: "auto" },
      eyebrow: { fontSize: 16, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600, color: colorWithAlpha(props.textColor || "#ffffff", 0.72), textAlign: "center" },
      title: { margin: 0, fontSize: compact ? 26 : (titleFs || 40), lineHeight: 1.04, fontWeight: 600, color: props.textColor || "#ffffff", textAlign: "center" },
      description: { margin: 0, fontSize: compact ? 16 : (descFs || 18), lineHeight: 1.7, color: colorWithAlpha(props.textColor || "#ffffff", 0.86), maxWidth: 700, textAlign: "center" },
      note: { margin: 0, fontSize: 16, lineHeight: 1.55, color: colorWithAlpha(props.textColor || "#ffffff", 0.72), textAlign: "center" },
      actionWrap: { display: "grid", gap: 10, justifyItems: "center", textAlign: "center" },
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
    content: { display: "grid", gap: 8, justifyItems: props.alignment === "left" ? "start" : props.alignment === "right" ? "end" : "center", maxWidth: contentMW || 720 },
    eyebrow: { fontSize: 16, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600, color: colorWithAlpha(props.textColor || "#0f172a", 0.6) },
    title: { margin: 0, fontSize: compact ? 24 : (titleFs || 34), lineHeight: 1.08, fontWeight: 600, color: props.textColor || "#0f172a" },
    description: { margin: 0, fontSize: compact ? 16 : (descFs || 18), lineHeight: 1.7, color: colorWithAlpha(props.textColor || "#0f172a", 0.76), maxWidth: 620 },
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
      role: { margin: "6px 0 0", fontSize: compact ? 16 : 18, textTransform: "uppercase", letterSpacing: "0.14em", color: "#2563eb" },
      bio: { margin: "12px 0 0", fontSize: compact ? 16 : 18, lineHeight: 1.7, color: text },
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
      role: { margin: "6px 0 0", fontSize: compact ? 16 : 18, textTransform: "uppercase", letterSpacing: "0.12em", color: subtle },
      bio: { margin: "14px 0 0", fontSize: compact ? 16 : 18, lineHeight: 1.7, color: text },
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
      role: { margin: "6px 0 0", fontSize: compact ? 16 : 18, textTransform: "uppercase", letterSpacing: "0.14em", color: "#67e8f9" },
      bio: { margin: "12px 0 0", fontSize: compact ? 16 : 18, lineHeight: 1.7, color: "rgba(226,232,240,0.88)" },
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
      role: { margin: "4px 0 0", fontSize: compact ? 16 : 18, color: subtle },
      bio: { margin: "10px 0 0", fontSize: compact ? 16 : 18, lineHeight: 1.7, color: text },
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
    role: { margin: "6px 16px 0", fontSize: compact ? 16 : 18, textTransform: "uppercase", letterSpacing: "0.12em", color: subtle },
    bio: { margin: "12px 16px 0", fontSize: compact ? 16 : 18, lineHeight: 1.7, color: text },
  };
}

function normalizeStatItem(item, index) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return {
      id: item.id || `stat-item-${index}`,
      number: String(item.number || item.value || `0${index + 1}`),
      label: String(item.label || item.title || `Metric ${index + 1}`),
      detail: String(item.detail || item.description || ""),
      cardAnimation: item.cardAnimation != null ? String(item.cardAnimation) : "",
    };
  }

  return {
    id: `stat-item-${index}`,
    number: String(item || `0${index + 1}`),
    label: `Metric ${index + 1}`,
    detail: "",
    cardAnimation: "",
  };
}

function statsVariantStyles(props, compact) {
  const variant = String(props?.statsVariant || "editorial-band");
  const text = props?.textColor || "#0f172a";
  const border = props?.borderColor || "rgba(226,232,240,0.92)";
  const cardBackground = props?.cardBackgroundColor || "rgba(255,255,255,0.92)";
  const accent = props?.accentColor || "#0ea5e9";
  const statsGap = compact ? Math.max(10, Number(props?.statsCardGap ?? 14)) : Math.max(12, Number(props?.statsCardGap ?? 18));
  const statsCardMinWidth = Math.max(140, Number(props?.statsCardMinWidth ?? 220));
  const sectionTitleColor = props?.sectionTitleColor || text;
  const sectionSubtitleColor = props?.sectionSubtitleColor || (variant === "spotlight-orbs" || variant === "split-scoreboard" ? "rgba(226,232,240,0.8)" : "#64748b");
  const numberColor = props?.numberColor || (variant === "spotlight-orbs" || variant === "split-scoreboard" ? "#ffffff" : text);
  const labelColor = props?.labelColor || accent;
  const subtle = variant === "spotlight-orbs" || variant === "split-scoreboard"
    ? "rgba(226,232,240,0.8)"
    : "#64748b";
  const detailColor = props?.detailColor || subtle;

  if (variant === "spotlight-orbs") {
    return {
      section: { background: props?.backgroundColor || "radial-gradient(circle at top,#1d4ed8 0%,#0f172a 58%,#020617 100%)", borderColor: border, sectionTitleColor, sectionSubtitleColor },
      header: { maxWidth: 760, margin: "0 auto", textAlign: "center" },
      grid: { display: "grid", gridTemplateColumns: compact ? "1fr" : `repeat(auto-fit, minmax(${statsCardMinWidth}px, 1fr))`, gap: statsGap, marginTop: 20 },
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
      number: { margin: 0, fontSize: compact ? Math.max(18, Number(props?.numberSize || 34)) : Math.max(20, Number(props?.numberSize || 46)), lineHeight: 1, fontWeight: 600, letterSpacing: "-0.04em", color: numberColor },
      label: { margin: "12px 0 0", fontSize: compact ? Math.max(10, Number(props?.labelSize || 16)) : Math.max(10, Number(props?.labelSize || 14)), lineHeight: 1.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: labelColor },
      detail: { margin: "12px 0 0", fontSize: compact ? Math.max(10, Number(props?.detailSize || 16)) : Math.max(10, Number(props?.detailSize || 14)), lineHeight: 1.7, color: detailColor },
    };
  }

  if (variant === "split-scoreboard") {
    return {
      section: { background: props?.backgroundColor || "linear-gradient(135deg,#081120,#17304d)", borderColor: border, sectionTitleColor, sectionSubtitleColor },
      header: { maxWidth: compact ? "100%" : 760, margin: "0 auto", textAlign: compact ? "center" : "center" },
      grid: { display: "grid", gridTemplateColumns: compact ? "1fr" : `repeat(auto-fit, minmax(${statsCardMinWidth}px, 1fr))`, gap: statsGap, marginTop: 20, alignItems: "stretch" },
      cardWrap: (index) => index === 0 && !compact ? { gridColumn: "span 2" } : {},
      card: (index) => ({
        padding: compact ? "18px 18px" : (index === 0 ? "26px 24px" : "20px 20px"),
        minHeight: compact ? "auto" : (index === 0 ? 260 : 0),
        borderRadius: compact ? 24 : 28,
        border: `1px solid ${index === 0 ? colorWithAlpha(accent, 0.42) : "rgba(255,255,255,0.14)"}`,
        background: index === 0 ? `linear-gradient(180deg, ${colorWithAlpha(accent, 0.34)}, ${cardBackground})` : cardBackground,
        boxShadow: index === 0 ? "0 26px 58px rgba(2,6,23,0.34)" : "0 18px 36px rgba(2,6,23,0.22)",
      }),
      number: (index) => ({ margin: 0, fontSize: compact ? Math.max(18, Number(props?.numberSize || (index === 0 ? 40 : 28))) : Math.max(20, Number(props?.numberSize || (index === 0 ? 68 : 34))), lineHeight: 0.96, fontWeight: 600, letterSpacing: "-0.05em", color: numberColor }),
      label: { margin: "10px 0 0", fontSize: compact ? Math.max(10, Number(props?.labelSize || 16)) : Math.max(10, Number(props?.labelSize || 14)), lineHeight: 1.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: labelColor },
      detail: { margin: "12px 0 0", fontSize: compact ? Math.max(10, Number(props?.detailSize || 16)) : Math.max(10, Number(props?.detailSize || 14)), lineHeight: 1.7, color: detailColor },
    };
  }

  if (variant === "minimal-ticker") {
    return {
      section: { background: props?.backgroundColor || "linear-gradient(180deg,#ffffff,#f8fafc)", borderColor: border, sectionTitleColor, sectionSubtitleColor },
      header: { maxWidth: 680, margin: "0 auto", textAlign: "center" },
      grid: { display: "grid", gridTemplateColumns: compact ? "1fr" : `repeat(auto-fit, minmax(${Math.max(160, Number(props?.statsCardMinWidth ?? 200))}px, 1fr))`, gap: statsGap, marginTop: 18 },
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
      number: { margin: 0, fontSize: compact ? Math.max(16, Number(props?.numberSize || 26)) : Math.max(18, Number(props?.numberSize || 30)), lineHeight: 1, fontWeight: 600, letterSpacing: "-0.04em", color: numberColor },
      label: { margin: 0, fontSize: compact ? Math.max(10, Number(props?.labelSize || 16)) : Math.max(10, Number(props?.labelSize || 14)), lineHeight: 1.5, fontWeight: 600, color: labelColor },
      detail: { margin: 0, fontSize: compact ? Math.max(10, Number(props?.detailSize || 16)) : Math.max(10, Number(props?.detailSize || 13)), lineHeight: 1.6, color: detailColor },
    };
  }

  if (variant === "data-ribbon") {
    const leftPct = Math.min(80, Math.max(20, Number(props?.statsLeftColPct ?? 40)));
    return {
      section: { background: props?.backgroundColor || "linear-gradient(135deg,#f8fbff,#eef7ff)", borderColor: border, sectionTitleColor, sectionSubtitleColor },
      header: { maxWidth: compact ? "100%" : "100%", textAlign: compact ? "center" : "left" },
      shell: { display: "grid", gridTemplateColumns: compact ? "1fr" : `minmax(200px, ${leftPct}%) minmax(0, ${100 - leftPct}%)`, gap: compact ? 18 : 28, alignItems: "start" },
      grid: { display: "grid", gridTemplateColumns: compact ? "1fr" : `repeat(auto-fit, minmax(${Math.max(160, Number(props?.statsCardMinWidth ?? 180))}px, 1fr))`, gap: statsGap },
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
      number: { margin: "10px 0 0", fontSize: compact ? Math.max(16, Number(props?.numberSize || 28)) : Math.max(18, Number(props?.numberSize || 34)), lineHeight: 0.98, fontWeight: 600, letterSpacing: "-0.04em", color: numberColor },
      label: { margin: "10px 0 0", fontSize: compact ? Math.max(10, Number(props?.labelSize || 16)) : Math.max(10, Number(props?.labelSize || 13)), lineHeight: 1.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: labelColor },
      detail: { margin: "10px 0 0", fontSize: compact ? Math.max(10, Number(props?.detailSize || 16)) : Math.max(10, Number(props?.detailSize || 13)), lineHeight: 1.65, color: detailColor },
    };
  }

  return {
    section: { background: props?.backgroundColor || "linear-gradient(180deg,#fffaf2,#f6ead8)", borderColor: border, sectionTitleColor, sectionSubtitleColor },
    header: { maxWidth: 720, margin: "0 auto", textAlign: "center" },
    grid: { display: "grid", gridTemplateColumns: compact ? "1fr" : `repeat(auto-fit, minmax(${statsCardMinWidth}px, 1fr))`, gap: statsGap, marginTop: 18 },
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
    number: { margin: 0, fontSize: compact ? Math.max(18, Number(props?.numberSize || 36)) : Math.max(20, Number(props?.numberSize || 48)), lineHeight: 0.98, fontWeight: 600, letterSpacing: "-0.05em", color: numberColor },
    label: { margin: "12px 0 0", fontSize: compact ? Math.max(10, Number(props?.labelSize || 16)) : Math.max(10, Number(props?.labelSize || 14)), lineHeight: 1.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: labelColor },
    detail: { margin: "12px 0 0", fontSize: compact ? Math.max(10, Number(props?.detailSize || 16)) : Math.max(10, Number(props?.detailSize || 14)), lineHeight: 1.7, color: detailColor },
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
  if (variant === "billing") return pricingBillingVariant(props);
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

function pricingBillingVariant(props) {
  const BILLING_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#7c3aed"];
  const planColor = (index) => BILLING_COLORS[index % BILLING_COLORS.length];
  return {
    section: {
      background: props.backgroundColor || "#0f172a",
      borderColor: "transparent",
    },
    sectionTitleColor: props.textColor || "#f8fafc",
    fullWidthGrid: true,
    featureSplit: true,
    grid: (compact, count = 4) => ({
      gap: compact ? 16 : 16,
      gridTemplateColumns: compact ? "1fr" : `repeat(${Math.max(1, count)}, 1fr)`,
      justifyContent: "stretch",
    }),
    card: (highlighted, compact, index = 0) => {
      const c = planColor(index);
      return {
        borderRadius: compact ? 12 : 14,
        padding: compact ? 16 : 24,
        border: `2px solid ${c}`,
        background: "#111827",
        boxShadow: "none",
        transform: "none",
        position: "relative",
        overflow: "hidden",
      };
    },
    badgeBackground: (_highlighted, index = 0) => planColor(index),
    planAccentColor: (index) => planColor(index),
    featureRow: (_highlighted, index = 0) => ({
      background: "transparent",
      border: "none",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 0,
      padding: "8px 0",
      marginBottom: 0,
    }),
    featureIcon: (_highlighted, index = 0) => ({
      background: "transparent",
      color: planColor(index),
      fontSize: 16,
      width: 18,
      height: 18,
      minWidth: 18,
      boxShadow: "none",
    }),
    extrasCard: (_highlighted, index = 0) => ({
      background: "transparent",
      border: `1px solid ${planColor(index)}`,
      borderRadius: 10,
      padding: "14px 16px",
    }),
    cta: (_highlighted, index = 0) => ({
      color: planColor(index),
      background: "transparent",
      border: `2px solid ${planColor(index)}`,
      boxShadow: "none",
    }),
    textTone: (index = 0) => ({
      text: "#f8fafc",
      subtle: "#9ca3af",
      accent: planColor(index),
    }),
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
    badge: htmlToPlainText(plan.badge || ""),
    cta: htmlToPlainText(plan.cta || "Get Started"),
    highlighted: !!plan.highlighted,
    individualPrice: htmlToPlainText(plan.individualPrice || ""),
    cardAnimation: plan.cardAnimation != null ? String(plan.cardAnimation) : "",
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
      fontSize: Math.max(MIN_TEXT_SIZE, compact ? Math.max(12, Number(props.brandFontSize) - 2 || 16) : Number(props.brandFontSize) || 16),
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
      fontSize: Math.max(MIN_TEXT_SIZE, compact ? Math.max(11, Number(props.linkFontSize) - 2 || 16) : Number(props.linkFontSize) || 16),
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
      fontSize: Math.max(MIN_TEXT_SIZE, compact ? Math.max(11, Number(props.ctaFontSize) - 1 || 16) : Number(props.ctaFontSize) || 16),
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
        fontSize: Math.max(MIN_TEXT_SIZE, compact ? 16 : 18),
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
  const fontSize = Math.max(10, Number(props?.badgeFontSize) || 16);
  const badgePadding = Math.max(6, Number(props?.badgePadding) || 16);

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
    const verticalRange = Math.max(0, current.scrollHeight - current.clientHeight);
    const horizontalRange = Math.max(0, current.scrollWidth - current.clientWidth);
    const canScroll = verticalRange > 40 || horizontalRange > 40;
    if (/(auto|scroll|overlay)/i.test(overflowY) && canScroll) {
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
        fontSize: Math.max(16, Math.round(size * 0.34)),
        fontWeight: 600,
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


// ─── sharedStyles (shared between wbBlockComponents and wbVariantStyles) ──────
const sharedStyles = {
  editorChip: {
    appearance: "none",
    border: "1px solid rgba(125,211,252,0.36)",
    background: "rgba(15,23,42,0.76)",
    color: "#e0f2fe",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 16,
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
    const basePad = scaleBoxPadding(compact ? "20px" : "30px", scale);
    return {
      borderWidth: 0,
      borderStyle: "solid",
      borderColor: "transparent",
      background: props.backgroundColor || "linear-gradient(165deg,#ffffff 0%,#f8fafc 100%)",
      color: props.textColor || "#0f172a",
      borderRadius: (props.fullWidthBackground !== false) ? 0 : (compact ? 16 : 22),
      paddingTop: (props.paddingTop != null) ? `${props.paddingTop}px` : basePad,
      paddingBottom: (props.paddingBottom != null) ? `${props.paddingBottom}px` : basePad,
      paddingLeft: basePad,
      paddingRight: basePad,
      boxShadow: (props.fullWidthBackground !== false) ? "none" : PREMIUM_SHADOW,
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
  planSectionLabel: { fontSize: 16, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#64748b" },
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


// ─── exports ──────────────────────────────────────────────────────────────────
export {
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
};
