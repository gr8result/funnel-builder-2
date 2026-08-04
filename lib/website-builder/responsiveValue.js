// Shared per-device ("responsive override") value model for website-builder block props.
//
// Backward-compatible by construction: a property `foo` keeps meaning "the desktop value"
// exactly as it always has (every existing block/page keeps rendering unchanged). A device
// override is a sibling key with a suffix -- `fooTablet` / `fooMobile` -- so old saved pages
// that only ever had `foo` simply have no overrides and resolve straight through to desktop.
//
// This is the ONE place the desktop -> tablet -> mobile inheritance rule is implemented. The
// visual builder canvas, the standalone preview page, and the published/custom-domain site all
// call into this module (instead of re-deriving the rule) so the three stay identical.

export const RESPONSIVE_DEVICES = ["desktop", "tablet", "mobile"];
export const RESPONSIVE_PREVIEW_WIDTHS = {
  mobile: 430,
  tablet: 1024,
  desktop: 1440,
};

export function isResponsiveDevice(value) {
  return RESPONSIVE_DEVICES.includes(value);
}

export function resolveResponsiveLayoutWidth(layoutWidth, device = "desktop", fallback = RESPONSIVE_PREVIEW_WIDTHS.desktop) {
  const base = Math.max(320, Number(layoutWidth || fallback) || fallback);
  if (device === "mobile") return Math.min(base, RESPONSIVE_PREVIEW_WIDTHS.mobile);
  if (device === "tablet") return Math.min(base, RESPONSIVE_PREVIEW_WIDTHS.tablet);
  return base;
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

const RESPONSIVE_LAYOUT_KEYS = [
  "width", "maxWidth", "minWidth", "height", "minHeight",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "marginTop", "marginRight", "marginBottom", "marginLeft",
  "gap", "rowGap", "columnGap",
  "alignItems", "justifyContent", "textAlign", "alignment",
  "fontSize", "textFontSize", "headlineFontSize", "subheadlineFontSize", "sectionTitleSize", "sectionSubtitleSize",
  "lineHeight", "textLineHeight", "bodyLineHeight", "headlineLineHeight", "subheadlineLineHeight",
  "letterSpacing",
  "gridColumns", "columns", "cardsPerRowDesktop", "cardsPerRow", "testimonialColumns",
  "flexDirection", "flexWrap",
  "imageWidth", "imageMaxWidth", "imageHeight", "imageMaxHeight", "containerHeight",
  "imageHeightMode", "imageFit", "imageObjectFit", "objectFit", "imageObjectPosition",
  "imagePositionX", "imagePositionY", "panelImageHeightMode", "panelImageFixedHeight",
  "buttonWidth", "buttonAlignment", "contentOrder",
  "sectionHeight",
];

const GRID_BLOCK_TYPES = new Set([
  "feature-list", "testimonial", "pricing-table", "platform-pricing-plans",
  "image-gallery", "grid-section", "stats", "team", "trust-badges",
]);

const STACK_BLOCK_TYPES = new Set([
  "hero", "parallax", "video-hero", "split-block", "columns-2", "columns-3",
  "contact-form", "newsletter", "footer", "feature-accordion", "side-scroll-accordion",
  "scroll-stack", "hover-cards", "template-showcase", "framer-animated-portfolio",
  "competitor-comparison",
]);

function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value ?? "").match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function scaledValue(value, factor, max = Infinity, min = 0) {
  const numeric = asNumber(value);
  if (numeric === null) return undefined;
  const next = Math.max(min, Math.min(max, Math.round(numeric * factor)));
  return typeof value === "string" && /px/i.test(value) ? `${next}px` : next;
}

function clampNumber(value, fallback, min, max) {
  const numeric = asNumber(value);
  const base = numeric === null ? fallback : numeric;
  return Math.max(min, Math.min(max, Math.round(base)));
}

const MEDIA_SIZE_RULES = {
  icon: {
    factor: { tablet: 0.68, mobile: 0.5 },
    maxViewport: { tablet: 0.12, mobile: 0.14 },
    maxContainer: { tablet: 0.22, mobile: 0.18 },
    min: { tablet: 24, mobile: 20 },
    fallback: 44,
    square: true,
  },
  avatar: {
    factor: { tablet: 0.74, mobile: 0.58 },
    max: { tablet: 72, mobile: 56 },
    min: { tablet: 56, mobile: 40 },
    fallback: 64,
    square: true,
  },
  logo: {
    factor: { tablet: 0.68, mobile: 0.52 },
    maxViewport: { tablet: 0.22, mobile: 0.28 },
    maxContainer: { tablet: 0.38, mobile: 0.34 },
    min: { tablet: 28, mobile: 24 },
    fallback: 96,
    square: false,
  },
  "feature-illustration": {
    factor: { tablet: 0.82, mobile: 0.64 },
    maxViewport: { tablet: 0.72, mobile: 0.82 },
    maxContainer: { tablet: 0.72, mobile: 0.72 },
    maxHeightViewport: { tablet: 0.38, mobile: 0.28 },
    min: { tablet: 140, mobile: 96 },
    fallback: 360,
    fit: "contain",
  },
  "product-image": {
    factor: { tablet: 0.78, mobile: 0.6 },
    maxViewport: { tablet: 0.76, mobile: 0.86 },
    maxContainer: { tablet: 0.76, mobile: 0.72 },
    maxHeightViewport: { tablet: 0.34, mobile: 0.3 },
    min: { tablet: 140, mobile: 96 },
    fallback: 320,
    fit: "contain",
  },
};

const BLOCK_MEDIA_RULES = {
  "feature-list": {
    "feature-illustration": { maxHeightRatio: { tablet: 0.35, mobile: 0.3 } },
    icon: { maxContainer: { tablet: 0.2, mobile: 0.16 } },
  },
  "grid-section": {
    "feature-illustration": { maxHeightRatio: { tablet: 0.34, mobile: 0.28 } },
    icon: { maxContainer: { tablet: 0.18, mobile: 0.16 } },
  },
  testimonial: {
    avatar: { max: { tablet: 68, mobile: 52 } },
  },
  team: {
    avatar: { max: { tablet: 72, mobile: 56 } },
    "product-image": { maxHeightViewport: { tablet: 0.28, mobile: 0.24 } },
  },
  "competitor-comparison": {
    icon: { factor: { tablet: 0.58, mobile: 0.44 }, maxContainer: { tablet: 0.14, mobile: 0.12 }, max: { tablet: 30, mobile: 24 } },
    logo: { factor: { tablet: 0.58, mobile: 0.44 }, maxContainer: { tablet: 0.14, mobile: 0.12 }, max: { tablet: 30, mobile: 24 } },
  },
  "pricing-table": {
    "product-image": { maxHeightViewport: { tablet: 0.3, mobile: 0.24 } },
  },
  "feature-accordion": {
    "feature-illustration": { maxHeightViewport: { tablet: 0.34, mobile: 0.26 } },
  },
};

export const RESPONSIVE_MEDIA_CATEGORIES = Object.freeze(Object.keys(MEDIA_SIZE_RULES));

function mergeMediaRule(base = {}, override = {}) {
  const next = { ...base, ...override };
  ["factor", "max", "min", "maxViewport", "maxContainer", "maxHeightViewport", "maxHeightRatio"].forEach((key) => {
    if (base[key] || override[key]) next[key] = { ...(base[key] || {}), ...(override[key] || {}) };
  });
  return next;
}

function pickDeviceRule(rule, key, device) {
  const value = rule?.[key];
  if (value && typeof value === "object") return value[device];
  return value;
}

export function resolveResponsiveMediaSize({
  desktopWidth,
  desktopHeight,
  mediaType = "product-image",
  blockType = "",
  device = "desktop",
  containerWidth,
  containerHeight,
  viewportWidth,
  viewportHeight,
} = {}) {
  const type = MEDIA_SIZE_RULES[mediaType] ? mediaType : "product-image";
  const baseRule = MEDIA_SIZE_RULES[type];
  const blockRule = BLOCK_MEDIA_RULES[String(blockType || "")]?.[type] || {};
  const rule = mergeMediaRule(baseRule, blockRule);
  const width = asNumber(desktopWidth);
  const height = asNumber(desktopHeight);

  if (!isResponsiveDevice(device) || device === "desktop") {
    return {
      width: width ?? desktopWidth,
      height: height ?? desktopHeight,
      maxWidth: width ?? desktopWidth,
      maxHeight: height ?? desktopHeight,
      objectFit: rule.fit || "contain",
      aspectRatio: width && height ? `${width} / ${height}` : undefined,
    };
  }

  const viewportW = clampNumber(viewportWidth, RESPONSIVE_PREVIEW_WIDTHS[device] || RESPONSIVE_PREVIEW_WIDTHS.mobile, 320, 4096);
  const viewportH = clampNumber(viewportHeight, Math.round(viewportW * 1.6), 320, 4096);
  const containerW = clampNumber(containerWidth, viewportW, 160, viewportW);
  const containerH = clampNumber(containerHeight, 0, 0, viewportH * 2);
  const fallbackWidth = pickDeviceRule(rule, "fallback", device) || rule.fallback || 96;
  const baseWidth = width || fallbackWidth;
  const baseHeight = height || (rule.square ? baseWidth : null);
  const factor = pickDeviceRule(rule, "factor", device) || 1;
  const minWidth = pickDeviceRule(rule, "min", device) || 0;
  const explicitMax = pickDeviceRule(rule, "max", device) || Infinity;
  const viewportMax = pickDeviceRule(rule, "maxViewport", device);
  const containerMax = pickDeviceRule(rule, "maxContainer", device);
  const maxCandidates = [
    baseWidth,
    baseWidth * factor,
    explicitMax,
    viewportMax ? viewportW * viewportMax : Infinity,
    containerMax ? containerW * containerMax : Infinity,
  ].filter((value) => Number.isFinite(value) && value > 0);
  const targetWidth = Math.max(minWidth, Math.min(...maxCandidates));

  const ratio = baseWidth && baseHeight ? baseHeight / baseWidth : null;
  const maxHeightViewport = pickDeviceRule(rule, "maxHeightViewport", device);
  const maxHeightRatio = pickDeviceRule(rule, "maxHeightRatio", device);
  const maxHeightCandidates = [
    ratio ? targetWidth * ratio : Infinity,
    maxHeightViewport ? viewportH * maxHeightViewport : Infinity,
    maxHeightRatio && containerH ? containerH * maxHeightRatio : Infinity,
  ].filter((value) => Number.isFinite(value) && value > 0);
  const targetHeight = rule.square
    ? targetWidth
    : (maxHeightCandidates.length ? Math.min(...maxHeightCandidates) : undefined);

  return {
    width: Math.round(targetWidth),
    height: targetHeight ? Math.round(targetHeight) : undefined,
    maxWidth: Math.round(Math.min(targetWidth, containerW)),
    maxHeight: targetHeight ? Math.round(targetHeight) : undefined,
    objectFit: rule.fit || "contain",
    aspectRatio: baseWidth && baseHeight ? `${baseWidth} / ${baseHeight}` : undefined,
  };
}

function responsiveColumns(blockType, device, props = {}) {
  const desktopColumns = asNumber(props.gridColumns ?? props.columns ?? props.cardsPerRowDesktop ?? props.cardsPerRow ?? props.testimonialColumns) || 3;
  if (device === "mobile") return 1;
  if (device === "tablet") {
    if (blockType === "columns-3" || blockType === "footer") return 2;
    return Math.max(1, Math.min(2, desktopColumns));
  }
  return undefined;
}

function hasAnyOverride(props, baseKey, device) {
  if (device === "mobile") {
    return hasValue(props?.[responsiveKey(baseKey, "mobile")]) || hasValue(props?.[responsiveKey(baseKey, "tablet")]);
  }
  if (device === "tablet") return hasValue(props?.[responsiveKey(baseKey, "tablet")]);
  return true;
}

// The prop-object key that holds the override for `baseKey` at `device` ("desktop" has no
// override key -- it IS the base key).
export function responsiveKey(baseKey, device) {
  if (device === "tablet") return `${baseKey}Tablet`;
  if (device === "mobile") return `${baseKey}Mobile`;
  return baseKey;
}

// The core inheritance rule: mobile -> tablet -> desktop; tablet -> desktop. Desktop is always
// the base value. `source` tells the inspector which tier actually supplied the value.
export function resolveResponsiveValue({ desktop, tablet, mobile, device }) {
  if (device === "mobile") {
    if (hasValue(mobile)) return { value: mobile, source: "mobile" };
    if (hasValue(tablet)) return { value: tablet, source: "tablet" };
    return { value: desktop, source: "desktop" };
  }
  if (device === "tablet") {
    if (hasValue(tablet)) return { value: tablet, source: "tablet" };
    return { value: desktop, source: "desktop" };
  }
  return { value: desktop, source: "desktop" };
}

// Convenience wrapper for reading a responsive property straight off a block's `props` object.
//
// `fitContentFallback` is a deliberate deviation from strict inheritance for properties where a
// desktop-sized value should NOT silently apply to tablet/mobile just because no override exists
// yet -- e.g. a 1200px section height staying active on mobile, or a 260px desktop logo staying
// full-size on a 375px phone. When nothing has been overridden for the device being resolved,
// this returns `fitContentValue` instead of the inherited desktop value. `fitContentValue` can be
// a single value (used for both tablet and mobile) or `{ tablet, mobile }` for device-specific
// defaults (e.g. the logo's 180px tablet / 140px mobile auto-shrink).
export function resolveResponsiveProp(props, baseKey, device, options = {}) {
  const { fitContentFallback = false, fitContentValue = "auto" } = options;
  const desktop = props?.[baseKey];
  const tablet = props?.[responsiveKey(baseKey, "tablet")];
  const mobile = props?.[responsiveKey(baseKey, "mobile")];
  const resolved = resolveResponsiveValue({ desktop, tablet, mobile, device });

  if (fitContentFallback && device !== "desktop" && resolved.source === "desktop" && hasValue(desktop)) {
    const perDevice = fitContentValue && typeof fitContentValue === "object";
    const value = perDevice ? fitContentValue[device] : fitContentValue;
    return { value, source: "auto" };
  }

  return resolved;
}

export function getResponsiveLayoutKeysForBlock(blockType) {
  const type = String(blockType || "");
  const keys = new Set(["width", "maxWidth", "minWidth", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginBottom"]);

  if (type === "text") {
    ["textFontSize", "textLineHeight", "textAlign", "alignment", "contentMaxWidth", "marginLeft", "marginRight"].forEach((key) => keys.add(key));
  }
  if (["hero", "parallax", "video-hero", "cta-button", "newsletter"].includes(type)) {
    ["headlineFontSize", "subheadlineFontSize", "textAlign", "headlineAlignment", "gap", "buttonWidth", "buttonAlignment", "flexDirection", "contentOrder", "minHeight"].forEach((key) => keys.add(key));
  }
  if (["image", "image-gallery", "grid-section", "pricing-table", "team"].includes(type)) {
    ["imageWidth", "imageMaxWidth", "imageHeight", "imageMaxHeight", "containerHeight", "imageHeightMode", "imageFit", "imageObjectFit", "objectFit", "imageObjectPosition", "imagePositionX", "imagePositionY", "columns", "gridColumns", "rowGap", "columnGap"].forEach((key) => keys.add(key));
  }
  if (GRID_BLOCK_TYPES.has(type) || ["columns-2", "columns-3", "footer"].includes(type)) {
    ["gridColumns", "columns", "cardsPerRowDesktop", "cardsPerRow", "testimonialColumns", "gap", "rowGap", "columnGap", "alignItems", "justifyContent"].forEach((key) => keys.add(key));
  }
  if (STACK_BLOCK_TYPES.has(type)) {
    ["flexDirection", "flexWrap", "gap", "alignItems", "justifyContent", "contentOrder", "minHeight", "height", "imageWidth", "imageMaxWidth", "imageHeight", "imageMaxHeight", "containerHeight", "imageHeightMode", "imageFit", "imageObjectFit", "objectFit", "imageObjectPosition", "imagePositionX", "imagePositionY", "panelImageHeightMode", "panelImageFixedHeight"].forEach((key) => keys.add(key));
  }
  if (["contact-form", "custom-html", "video-embed"].includes(type)) {
    ["maxWidth", "height", "minHeight"].forEach((key) => keys.add(key));
  }

  return [...keys];
}

export function getAutomaticResponsiveDefaults(blockType, device, props = {}) {
  if (device === "desktop") return {};
  const type = String(blockType || "");
  const scale = device === "mobile" ? 0.62 : 0.82;
  const maxPadding = device === "mobile" ? 24 : 40;
  const defaults = {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  };

  ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "gap", "rowGap", "columnGap"].forEach((key) => {
    const scaled = scaledValue(props?.[key], scale, maxPadding);
    if (scaled !== undefined) defaults[key] = scaled;
  });
  ["marginLeft", "marginRight"].forEach((key) => {
    if (hasValue(props?.[key])) defaults[key] = 0;
  });

  const columns = responsiveColumns(type, device, props);
  if (columns !== undefined) {
    defaults.gridColumns = columns;
    defaults.columns = columns;
    defaults.cardsPerRow = columns;
    defaults.testimonialColumns = columns;
  }

  if (GRID_BLOCK_TYPES.has(type) || ["columns-2", "columns-3", "footer"].includes(type)) {
    defaults.gap = defaults.gap ?? (device === "mobile" ? 16 : 20);
    defaults.rowGap = defaults.rowGap ?? (device === "mobile" ? 16 : 20);
    defaults.columnGap = defaults.columnGap ?? (device === "mobile" ? 16 : 20);
  }

  if (STACK_BLOCK_TYPES.has(type)) {
    defaults.flexDirection = "column";
    defaults.flexWrap = "wrap";
    defaults.height = "auto";
    defaults.minHeight = "auto";
    defaults.alignItems = type === "footer" ? "stretch" : (props.alignItems || "stretch");
  }

  if (["hero", "parallax", "video-hero"].includes(type)) {
    defaults.headlineFontSize = scaledValue(props.headlineFontSize, device === "mobile" ? 0.52 : 0.74, device === "mobile" ? 36 : 52, 22);
    defaults.subheadlineFontSize = scaledValue(props.subheadlineFontSize, device === "mobile" ? 0.78 : 0.9, device === "mobile" ? 18 : 22, 14);
    defaults.buttonWidth = device === "mobile" ? "100%" : "auto";
    defaults.buttonAlignment = props.buttonAlignment || props.headlineAlignment || props.textAlign || "center";
    defaults.contentOrder = props.contentOrder || "text-first";
  }

  if (type === "text") {
    defaults.textFontSize = scaledValue(props.textFontSize, device === "mobile" ? 0.84 : 0.92, device === "mobile" ? 18 : 22, 14);
    defaults.textLineHeight = Math.max(1.25, Math.min(1.75, Number(props.textLineHeight || props.lineHeight || 1.45)));
    defaults.contentMaxWidth = "100%";
  }

  if (["image", "image-gallery", "grid-section", "pricing-table", "team"].includes(type)) {
    defaults.imageWidth = "100%";
    defaults.imageMaxWidth = "100%";
    defaults.imageHeight = "auto";
    defaults.imageObjectFit = "contain";
    defaults.objectFit = type === "image" ? "contain" : (props.objectFit || undefined);
  }

  if (["video-embed", "custom-html"].includes(type)) {
    defaults.width = "100%";
    defaults.maxWidth = "100%";
    defaults.height = "auto";
  }

  if (type === "pricing-table") {
    defaults.buttonWidth = device === "mobile" ? "100%" : "auto";
  }

  if (type === "marquee-strip" || type === "wave-marquee") {
    defaults.gap = device === "mobile" ? 14 : 20;
    defaults.fontSize = scaledValue(props.fontSize, device === "mobile" ? 0.86 : 0.94, device === "mobile" ? 18 : 28, 10);
  }

  return Object.fromEntries(Object.entries(defaults).filter(([, value]) => value !== undefined));
}

export function resolveResponsiveBlockProps(blockType, props = {}, device = "desktop") {
  if (!isResponsiveDevice(device) || device === "desktop") return props || {};
  const automaticDefaults = getAutomaticResponsiveDefaults(blockType, device, props);
  const keys = new Set([...RESPONSIVE_LAYOUT_KEYS, ...Object.keys(automaticDefaults), ...getResponsiveLayoutKeysForBlock(blockType)]);
  const next = { ...(props || {}) };

  keys.forEach((key) => {
    if (!key) return;
    const resolved = resolveResponsiveProp(props, key, device);
    if (hasAnyOverride(props, key, device)) {
      if (hasValue(resolved.value)) next[key] = resolved.value;
      return;
    }
    if (hasValue(automaticDefaults[key])) {
      next[key] = automaticDefaults[key];
    } else if (hasValue(resolved.value)) {
      next[key] = resolved.value;
    }
  });

  return next;
}

// Inspector helpers -- get/set/clear the override for one device, without touching the other
// devices' values. All return a *new* props object (props are always replaced wholesale via
// onChange, never mutated).
export function getResponsiveOverride(props, baseKey, device) {
  if (device === "desktop") return props?.[baseKey];
  return props?.[responsiveKey(baseKey, device)];
}

export function hasResponsiveOverride(props, baseKey, device) {
  if (device === "desktop") return false;
  return hasValue(props?.[responsiveKey(baseKey, device)]);
}

export function setResponsiveValue(props, baseKey, device, value) {
  const key = responsiveKey(baseKey, device);
  return { ...props, [key]: value };
}

export function clearResponsiveOverride(props, baseKey, device) {
  if (device === "desktop") return props;
  const key = responsiveKey(baseKey, device);
  if (!(key in (props || {}))) return props;
  const next = { ...props };
  delete next[key];
  return next;
}

// Per-device block visibility ("hide a block on mobile"). Desktop can never be hidden this way
// -- hiding the block entirely is a content decision the user makes by removing it.
export function isBlockVisibleOnDevice(props, device) {
  if (device === "tablet") return !props?.hiddenOnTablet;
  if (device === "mobile") return !props?.hiddenOnMobile;
  return true;
}

// `source` is which tier actually supplied the value (from resolveResponsiveValue); `device` is
// which tier is currently being edited in the inspector. They only match when the value being
// shown is an explicit override for the device you're looking at -- otherwise it's inherited.
export function responsiveSourceLabel(source, device) {
  if (source === "auto") return "Fit content (auto)";
  if (source === device) return source === "desktop" ? "Desktop value" : `${source[0].toUpperCase()}${source.slice(1)} override`;
  return `Inherited from ${source[0].toUpperCase()}${source.slice(1)}`;
}
