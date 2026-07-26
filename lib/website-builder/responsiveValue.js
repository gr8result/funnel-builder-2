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
