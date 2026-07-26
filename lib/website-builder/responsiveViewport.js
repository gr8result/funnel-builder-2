import { useEffect, useState } from "react";

// The existing block renderer already has hundreds of `compact ? mobile : desktop` rules
// (WebsiteBlockRenderer.js, wbBlockComponents.js, wbVariantStyles.js). The published site's
// getServerSideProps has no way to know the visitor's real viewport width, so this gives it
// a same-request best guess from the User-Agent (avoids a layout flash for the common case),
// then corrects to the real width once the page hydrates in the browser -- the same pattern
// NavBarBlock already uses internally for its own hamburger-menu breakpoint.
//
// Anything below this width is treated as "compact" (activates the existing mobile/tablet
// branch of the renderer). 1024 matches the top of this project's own tablet-landscape
// breakpoint (1280px+ is desktop).
export const COMPACT_VIEWPORT_BREAKPOINT = 1024;

export function isMobileUserAgent(userAgent = "") {
  return /Mobi|Android|iPhone|iPod|IEMobile|BlackBerry|Opera Mini/i.test(String(userAgent || ""));
}

// Real breakpoints for the 3-way device model (see lib/website-builder/responsiveValue.js).
// Matches the tablet/mobile split used by styles/website-builder-responsive.css.
export const MOBILE_MAX_WIDTH = 767;
export const TABLET_MAX_WIDTH = 1023;

export function deviceFromWidth(width) {
  const w = Number(width) || 0;
  if (w <= MOBILE_MAX_WIDTH) return "mobile";
  if (w <= TABLET_MAX_WIDTH) return "tablet";
  return "desktop";
}

// Real visitors on the published/custom-domain site: which of desktop/tablet/mobile applies is
// derived from the actual window width (not an editor preview toggle), so this is the one place
// a true 3-way device value gets computed from a real viewport.
export function useResponsiveDevice(initialDevice = "desktop") {
  const [device, setDevice] = useState(initialDevice);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const update = () => setDevice(deviceFromWidth(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return device;
}

export function useResponsiveCompact(initialCompact = false, breakpoint = COMPACT_VIEWPORT_BREAKPOINT) {
  const [compact, setCompact] = useState(initialCompact);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const update = () => setCompact(window.innerWidth < breakpoint);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [breakpoint]);

  return compact;
}
