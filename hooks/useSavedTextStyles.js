// useSavedTextStyles — manages the saved text style library.
//
// Built-in presets (H1, H2, … Caption) are always present.
// User-created styles are persisted to localStorage under GTE_STORAGE_KEY.
//
// Usage:
//   const { styles, save, update, remove, applyById } = useSavedTextStyles();
//
//   save(textStyle, "My Brand Heading")   — returns the new saved style
//   update(id, patch)                     — merge changes into a saved style
//   remove(id)                            — delete a user style (built-ins protected)
//   applyById(id)                         — returns the TextStyle for the given id

import { useState, useEffect, useCallback } from "react";
import { BUILT_IN_STYLES, createTextStyle } from "../lib/text-editor/TextStyleSchema";

const GTE_STORAGE_KEY = "GTE:saved-styles:v1";

// ── Helpers ───────────────────────────────────────────────────────────────────

function readFromStorage() {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(GTE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeToStorage(userStyles) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(GTE_STORAGE_KEY, JSON.stringify(userStyles));
  } catch {
    // Quota exceeded — silently ignore
  }
}

function generateId() {
  return `gte-style-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export default function useSavedTextStyles() {
  const [userStyles, setUserStyles] = useState(readFromStorage);

  // Persist whenever userStyles changes
  useEffect(() => {
    writeToStorage(userStyles);
  }, [userStyles]);

  // All styles = built-ins first, then user styles
  const allStyles = [
    ...BUILT_IN_STYLES.map(s => createTextStyle(s)),
    ...userStyles,
  ];

  // Save a new style from any TextStyle object
  const save = useCallback((textStyle, name = "Custom Style") => {
    const newStyle = createTextStyle({
      ...textStyle,
      _id:      generateId(),
      _name:    String(name).trim() || "Custom Style",
      _builtIn: false,
    });
    setUserStyles(prev => [...prev, newStyle]);
    return newStyle;
  }, []);

  // Update a user-created style
  const update = useCallback((id, patch) => {
    setUserStyles(prev =>
      prev.map(s => s._id === id
        ? { ...s, ...patch, _id: id, _builtIn: false }
        : s
      )
    );
  }, []);

  // Remove a user-created style (cannot remove built-ins)
  const remove = useCallback((id) => {
    const builtIn = BUILT_IN_STYLES.some(s => s._id === id);
    if (builtIn) return; // protect built-ins
    setUserStyles(prev => prev.filter(s => s._id !== id));
  }, []);

  // Return the full TextStyle for a given saved style id
  const applyById = useCallback((id) => {
    return allStyles.find(s => s._id === id) || null;
  }, [allStyles]);

  // Rename a user style
  const rename = useCallback((id, newName) => {
    update(id, { _name: String(newName).trim() });
  }, [update]);

  return {
    styles:     allStyles,
    userStyles,
    builtInStyles: BUILT_IN_STYLES.map(s => createTextStyle(s)),
    save,
    update,
    remove,
    rename,
    applyById,
  };
}

// ── Recently-used tracking ────────────────────────────────────────────────────
// Separate from saved styles; tracks the last N colours / fonts used.

const RC_COLORS_KEY = "GTE:recent-colors:v1";
const RC_FONTS_KEY  = "GTE:recent-fonts:v1";
const MAX_RECENT    = 12;

function readRecentList(key) {
  try {
    const raw = localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function pushRecent(key, value) {
  const list = [value, ...readRecentList(key).filter(v => v !== value)].slice(0, MAX_RECENT);
  try { localStorage?.setItem(key, JSON.stringify(list)); } catch {}
  return list;
}

export function getRecentColors() { return readRecentList(RC_COLORS_KEY); }
export function addRecentColor(color) { return pushRecent(RC_COLORS_KEY, color); }
export function getRecentFonts()  { return readRecentList(RC_FONTS_KEY); }
export function addRecentFont(family) { return pushRecent(RC_FONTS_KEY, family); }
