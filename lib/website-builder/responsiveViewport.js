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
