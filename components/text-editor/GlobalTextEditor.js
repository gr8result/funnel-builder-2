// GlobalTextEditor — single reusable text editing component for the entire platform.
//
// This is the top-level orchestrator.  It wires together:
//   - TextStyle state (with undo/redo) via useTextStyle
//   - Font loading via useFontLoader
//   - Saved style library via useSavedTextStyles
//   - Output via the appropriate render adapter (web / email / canvas / svg)
//   - UI via TextStylePanel (full) or TextStyleToolbar (compact)
//
// ── Quick usage ───────────────────────────────────────────────────────────────
//
//   // Full panel mode (website builder sidebar)
//   <GlobalTextEditor
//     mode="web"
//     value={textStyle}
//     onChange={nextStyle => saveToBlock(nextStyle)}
//   />
//
//   // Compact toolbar mode (floating above selected text)
//   <GlobalTextEditor
//     mode="web"
//     surface="toolbar"
//     value={textStyle}
//     onChange={nextStyle => saveToBlock(nextStyle)}
//     onOpenPanel={() => setShowPanel(true)}
//   />
//
//   // Email mode — warnings are exposed automatically
//   <GlobalTextEditor mode="email" value={textStyle} onChange={setStyle} />
//
//   // Canvas mode (image editor)
//   <GlobalTextEditor mode="canvas" value={textStyle} onChange={setStyle} />
//
// ── Props ─────────────────────────────────────────────────────────────────────
//
//   mode          "web" | "email" | "canvas" | "svg"
//   surface       "panel" | "toolbar"   (default: "panel")
//   value         TextStyle             (controlled)
//   onChange      (TextStyle) => void   (controlled)
//   onOpenPanel   () => void            (only needed when surface="toolbar")
//   sampleText    string
//   showPreview   boolean               (default: true for panel, false for toolbar)
//   viewport      "desktop"|"tablet"|"mobile"  (web mode only)

import { useMemo, useCallback } from "react";
import useTextStyle          from "../../hooks/useTextStyle";
import useFontLoader         from "../../hooks/useFontLoader";
import useSavedTextStyles    from "../../hooks/useSavedTextStyles";
import { mergeTextStyle }    from "../../lib/text-editor/TextStyleSchema";

import { webHtmlAdapter }            from "../../lib/text-editor/adapters/webHtmlAdapter";
import { emailInlineStyleAdapter }   from "../../lib/text-editor/adapters/emailInlineStyleAdapter";
import { canvasTextAdapter }         from "../../lib/text-editor/adapters/canvasTextAdapter";
import { svgTextAdapter }            from "../../lib/text-editor/adapters/svgTextAdapter";

import TextStylePanel   from "./TextStylePanel";
import TextStyleToolbar from "./TextStyleToolbar";

// ── Adapter map ────────────────────────────────────────────────────────────────

const ADAPTERS = {
  web:    webHtmlAdapter,
  email:  emailInlineStyleAdapter,
  canvas: canvasTextAdapter,
  svg:    svgTextAdapter,
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function GlobalTextEditor({
  mode          = "web",
  surface       = "panel",
  value,
  onChange,
  onOpenPanel,
  sampleText,
  showPreview,
  viewport      = "desktop",
}) {
  // Internal state (mirrors controlled value when provided)
  const internal = useTextStyle(value || {});

  // Use controlled value if provided, else internal
  const isControlled = value !== undefined && onChange !== undefined;
  const currentStyle = isControlled ? (value || {}) : internal.style;

  const handleChange = useCallback((patch) => {
    const next = mergeTextStyle(currentStyle, patch);
    if (isControlled) {
      onChange(next);
    } else {
      internal.patch(patch);
    }
  }, [currentStyle, isControlled, onChange, internal]);

  const handleSet = useCallback((nextStyle) => {
    if (isControlled) {
      onChange(nextStyle);
    } else {
      internal.set(nextStyle);
    }
  }, [isControlled, onChange, internal]);

  // Font loading — ensure the current font is loaded
  useFontLoader(currentStyle.fontFamily);

  // Saved styles
  const {
    styles: savedStyles,
    save:   saveStyle,
    applyById,
  } = useSavedTextStyles();

  // Compute adapter output (memoised)
  const adapterOutput = useMemo(() => {
    const adapter = ADAPTERS[mode] || ADAPTERS.web;
    return adapter(currentStyle);
  }, [mode, currentStyle]);

  // Email warnings
  const emailWarnings = mode === "email"
    ? (adapterOutput.warnings || [])
    : [];

  // ── Keyboard shortcut handler (undo/redo) ───────────────────────────────────
  // Attach to a wrapper div so shortcuts work when focus is inside the panel.
  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
      e.preventDefault();
      if (!isControlled) internal.undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === "z" || e.key === "y")) {
      e.preventDefault();
      if (!isControlled) internal.redo();
    }
  }, [isControlled, internal]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (surface === "toolbar") {
    return (
      <div onKeyDown={handleKeyDown}>
        <TextStyleToolbar
          style={currentStyle}
          onChange={handleChange}
          onOpenPanel={onOpenPanel}
          mode={mode}
        />
      </div>
    );
  }

  return (
    <div
      onKeyDown={handleKeyDown}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Undo/redo bar (only in uncontrolled mode) */}
      {!isControlled && (
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "6px 14px", borderBottom: "1px solid rgba(148,163,184,0.1)",
          background: "#111827",
        }}>
          <button type="button"
            disabled={!internal.canUndo}
            onClick={() => internal.undo()}
            style={undoBtnStyle(!internal.canUndo)}
            title="Undo (Ctrl+Z)">
            ↩ Undo
          </button>
          <button type="button"
            disabled={!internal.canRedo}
            onClick={() => internal.redo()}
            style={undoBtnStyle(!internal.canRedo)}
            title="Redo (Ctrl+Shift+Z)">
            ↪ Redo
          </button>
          <button type="button" onClick={() => internal.reset()}
            style={{ ...undoBtnStyle(false), marginLeft: "auto", color: "#64748b" }}
            title="Reset to defaults">
            Reset
          </button>
        </div>
      )}

      <TextStylePanel
        style={currentStyle}
        onChange={handleChange}
        mode={mode}
        savedStyles={savedStyles}
        onSaveStyle={(name) => saveStyle(currentStyle, name)}
        onApplyStyle={(savedStyle) => handleSet(savedStyle)}
        emailWarnings={emailWarnings}
        showPreview={showPreview !== undefined ? showPreview : true}
        sampleText={sampleText}
      />
    </div>
  );
}

// ── Adapter output accessor ───────────────────────────────────────────────────
// For components that need the rendered output directly (e.g., canvas editor).

export function useAdaptedTextStyle(textStyle, mode = "web") {
  return useMemo(() => {
    const adapter = ADAPTERS[mode] || ADAPTERS.web;
    return adapter(textStyle || {});
  }, [textStyle, mode]);
}

// ── Named re-exports — consumers import everything from one place ─────────────

export { webHtmlAdapter }            from "../../lib/text-editor/adapters/webHtmlAdapter";
export { emailInlineStyleAdapter }   from "../../lib/text-editor/adapters/emailInlineStyleAdapter";
export { canvasTextAdapter }         from "../../lib/text-editor/adapters/canvasTextAdapter";
export { svgTextAdapter }            from "../../lib/text-editor/adapters/svgTextAdapter";
export { createTextStyle, mergeTextStyle, migrateToTextStyle, BUILT_IN_STYLES } from "../../lib/text-editor/TextStyleSchema";
export { FONT_REGISTRY, getFontStack, getFontEntry, buildGoogleFontsUrl }        from "../../lib/text-editor/fontRegistry";
export { default as useTextStyle }        from "../../hooks/useTextStyle";
export { default as useSavedTextStyles }  from "../../hooks/useSavedTextStyles";
export { default as useFontLoader }       from "../../hooks/useFontLoader";

// ── Styles ────────────────────────────────────────────────────────────────────

const undoBtnStyle = (disabled) => ({
  padding: "3px 8px", border: "none", borderRadius: 6,
  background: "rgba(255,255,255,0.05)", cursor: disabled ? "default" : "pointer",
  color: disabled ? "#334155" : "#94a3b8", fontSize: 11,
  opacity: disabled ? 0.4 : 1,
});
