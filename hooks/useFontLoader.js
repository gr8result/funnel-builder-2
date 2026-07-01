// useFontLoader — dynamically injects Google Fonts <link> tags whenever a font
// that requires remote loading is selected.
//
// Usage:
//   useFontLoader(fontFamily)           // single font
//   useFontLoader(["Poppins", "Lora"])  // multiple fonts
//
// The hook is idempotent — it tracks already-injected fonts and never adds
// duplicate <link> tags.

import { useEffect, useRef } from "react";
import { getFontEntry, buildGoogleFontsUrl } from "../lib/text-editor/fontRegistry";

// Module-level set so injections persist across component re-renders/re-mounts
const injected = new Set();

function ensureFontLoaded(family) {
  if (!family || typeof document === "undefined") return;

  const entry = getFontEntry(family);
  if (!entry || !entry.google) return; // system font — nothing to inject
  if (injected.has(entry.google)) return;

  injected.add(entry.google);

  const url = buildGoogleFontsUrl([family]);
  if (!url) return;

  const link = document.createElement("link");
  link.rel  = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

export default function useFontLoader(fontFamilies) {
  const prev = useRef(null);

  useEffect(() => {
    const families = Array.isArray(fontFamilies)
      ? fontFamilies
      : fontFamilies
        ? [fontFamilies]
        : [];

    // Only act when families actually changed
    const key = families.join(",");
    if (key === prev.current) return;
    prev.current = key;

    families.forEach(ensureFontLoaded);
  }, [fontFamilies]);
}

// Standalone function for one-off font loading without a hook
export function loadFont(family) {
  ensureFontLoaded(family);
}

// Preload a batch of fonts upfront (e.g., when the editor first opens)
export function preloadFonts(families = []) {
  families.forEach(ensureFontLoaded);
}
