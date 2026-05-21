// /lib/assetLibrary.js
// ─────────────────────────────────────────────────────────────────────────────
// Unified re-export hub for all shared icon / emoji / media libraries.
//
// All existing imports across the codebase continue to work unchanged.
// New code should import from here to avoid scattering sources.
//
// Usage examples:
//   import { ICONS, EMOJI_GROUPS, GRID_ICON_LIBRARY, renderGridLibraryIcon } from "@/lib/assetLibrary";
//   import EmojiPicker from "@/components/emoji/EmojiPicker";   // UI component — still a component file
// ─────────────────────────────────────────────────────────────────────────────

// --- Nav / UI icon map (lucide-react + react-icons social) ---
export { default as ICONS } from "../components/iconMap";

// --- Emoji data (groups + flat list) ---
export { EMOJI_GROUPS } from "../components/emoji/emojiLibrary";

// Flat list of all emojis for convenience
import { EMOJI_GROUPS as _GROUPS } from "../components/emoji/emojiLibrary";
export const ALL_EMOJIS = _GROUPS.flatMap((g) => g.emojis);

// --- Website-builder grid icon library (lucide / feather / bootstrap / social SVGs) ---
export {
  GRID_ICON_LIBRARY,
  GRID_ICON_LIBRARY_MAP,
  renderGridLibraryIcon,
} from "../components/website-builder/gridIconLibrary";
