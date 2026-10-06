import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getAutomaticResponsiveDefaults, getResponsiveLayoutKeysForBlock, resolveResponsiveProp, getResponsiveOverride, hasResponsiveOverride, setResponsiveValue, clearResponsiveOverride, responsiveSourceLabel } from "../../../../lib/website-builder/responsiveValue";
import { styles } from "../pbStyles";
import { formatLabel, parsePixelValue } from "../pbTextFormatUtils";


// Generic per-device inspector field: resolves `props[baseKey]` (or its Tablet/Mobile sibling)
// through the shared inheritance rule, shows the user whether what they're looking at is the
// device's own override or something inherited, and gives them Create/Reset/Copy actions to
// manage that override -- without ever touching the other devices' values. `render(value, setValue)`
// draws the actual control (number input, select, etc); this wrapper only handles the
// resolve/override/badge/actions mechanics so it can be reused for any property type.
//
// `device === "desktop"` has no override concept (desktop IS the base value), so the badge/action
// row only appears in Tablet/Mobile mode.
function ResponsiveField({ label, props, baseKey, device, onChange, render, fitContentFallback = false, fitContentValue = "auto", mirrorKeys = [] }) {
  const resolved = resolveResponsiveProp(props, baseKey, device, { fitContentFallback, fitContentValue });
  const overrideExists = hasResponsiveOverride(props, baseKey, device);
  const badgeLabel = device === "desktop" ? null : responsiveSourceLabel(resolved.source, device);

  const applyValue = (value) => {
    let next = setResponsiveValue(props, baseKey, device, value);
    mirrorKeys.forEach((key) => { next = setResponsiveValue(next, key, device, value); });
    onChange(next);
  };

  const resetToInherited = () => {
    let next = clearResponsiveOverride(props, baseKey, device);
    mirrorKeys.forEach((key) => { next = clearResponsiveOverride(next, key, device); });
    onChange(next);
  };

  const copyFrom = (sourceDevice) => {
    const sourceValue = sourceDevice === "desktop" ? props?.[baseKey] : getResponsiveOverride(props, baseKey, sourceDevice);
    if (sourceValue === undefined || sourceValue === null || sourceValue === "") return;
    applyValue(sourceValue);
  };

  return (
    <div style={styles.sectionCard}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <label style={styles.propertyLabel}>{label}</label>
        {badgeLabel ? (
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.02em",
            padding: "2px 8px",
            borderRadius: 999,
            color: overrideExists ? "#166534" : "#475569",
            background: overrideExists ? "#dcfce7" : "#e2e8f0",
            border: `1px solid ${overrideExists ? "#86efac" : "#cbd5e1"}`,
          }}>
            {badgeLabel}
          </span>
        ) : null}
      </div>
      {render(resolved.value, applyValue)}
      {device !== "desktop" ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {overrideExists ? (
            <>
              <button type="button" style={{ ...styles.secondaryBtn, fontSize: 12, padding: "4px 8px" }} onClick={resetToInherited}>Reset to automatic</button>
              <button type="button" style={{ ...styles.secondaryBtn, fontSize: 12, padding: "4px 8px" }} onClick={resetToInherited}>Reset to inherited</button>
            </>
          ) : (
            <button type="button" style={{ ...styles.secondaryBtn, fontSize: 12, padding: "4px 8px" }} onClick={() => applyValue(resolved.value === "auto" ? 0 : resolved.value)}>
              Create override
            </button>
          )}
          <button type="button" style={{ ...styles.secondaryBtn, fontSize: 12, padding: "4px 8px" }} onClick={() => copyFrom("desktop")}>Copy Desktop Value</button>
          {device === "mobile" ? (
            <button type="button" style={{ ...styles.secondaryBtn, fontSize: 12, padding: "4px 8px" }} onClick={() => copyFrom("tablet")}>Copy Tablet Value</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// Numeric px-value convenience wrapper around ResponsiveField -- matches NumberField's look.
// `unit: "px"` stores values as "123px" strings (for CSS dimension props like heights); `unit:
// "number"` stores a plain number (for things like logoWidth that other code reads with Number()).
function ResponsiveNumberField({ label, props, baseKey, device, onChange, min = 0, max = 2000, step = 1, unit = "number", fitContentFallback = false, fitContentValue = "auto", mirrorKeys = [], placeholder }) {
  return (
    <ResponsiveField
      label={label}
      props={props}
      baseKey={baseKey}
      device={device}
      onChange={onChange}
      fitContentFallback={fitContentFallback}
      fitContentValue={fitContentValue}
      mirrorKeys={mirrorKeys}
      render={(value, setValue) => {
        const isAuto = value === "auto";
        const numericValue = isAuto ? "" : (unit === "px" ? parsePixelValue(value, "") : value);
        return (
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={numericValue === "" ? "" : Number(numericValue)}
            placeholder={isAuto ? "auto (fit content)" : placeholder}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") return;
              const num = Number(raw);
              setValue(unit === "px" ? `${num}px` : num);
            }}
            style={styles.propertyInput}
          />
        );
      }}
    />
  );
}

const IMAGE_FIT_OPTIONS = [
  ["contain", "Contain"],
  ["cover", "Cover"],
  ["fill", "Fill"],
  ["none", "None"],
  ["scale-down", "Scale Down"],
];

const IMAGE_POSITION_PRESETS = [
  ["left top", "Top Left", 0, 0],
  ["center top", "Top Centre", 50, 0],
  ["right top", "Top Right", 100, 0],
  ["left center", "Centre Left", 0, 50],
  ["center center", "Centre", 50, 50],
  ["right center", "Centre Right", 100, 50],
  ["left bottom", "Bottom Left", 0, 100],
  ["center bottom", "Bottom Centre", 50, 100],
  ["right bottom", "Bottom Right", 100, 100],
];

function ResponsiveImageFitPositionControls({ props, onChange, device = "desktop", includePanelHeight = false }) {
  const setDeviceValue = (baseKey, value, currentProps = props) => setResponsiveValue(currentProps, baseKey, device, value);
  const applyPositionPreset = (position, x, y) => {
    let next = setDeviceValue("imageObjectPosition", position);
    next = setDeviceValue("imagePositionX", x, next);
    next = setDeviceValue("imagePositionY", y, next);
    onChange(next);
  };
  const positionValue = String(resolveResponsiveProp(props, "imageObjectPosition", device).value || "center center");

  return (
    <div style={styles.sectionCard}>
      <label style={styles.propertyLabel}>Image Fit & Position</label>
      <div style={styles.colorGrid}>
        <ResponsiveField
          label="Image Fit"
          props={props}
          baseKey="imageFit"
          device={device}
          onChange={onChange}
          render={(value, setValue) => (
            <select value={String(value || "contain")} onChange={(event) => setValue(event.target.value)} style={styles.propertyInput}>
              {IMAGE_FIT_OPTIONS.map(([valueOption, label]) => <option key={valueOption} value={valueOption}>{label}</option>)}
            </select>
          )}
        />
        <ResponsiveField
          label="Image Height Mode"
          props={props}
          baseKey="imageHeightMode"
          device={device}
          onChange={onChange}
          render={(value, setValue) => (
            <select value={String(value || "fixed")} onChange={(event) => setValue(event.target.value)} style={styles.propertyInput}>
              <option value="auto">Auto</option>
              <option value="fixed">Fixed</option>
            </select>
          )}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6, marginTop: 10 }}>
        {IMAGE_POSITION_PRESETS.map(([position, label, x, y]) => (
          <button
            key={position}
            type="button"
            onClick={() => applyPositionPreset(position, x, y)}
            style={{
              ...styles.secondaryBtn,
              padding: "7px 6px",
              fontSize: 12,
              background: positionValue === position ? "rgba(14,165,233,0.28)" : styles.secondaryBtn.background,
              borderColor: positionValue === position ? "rgba(14,165,233,0.72)" : styles.secondaryBtn.borderColor,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <ResponsiveNumberField label="Horizontal Position (%)" props={props} baseKey="imagePositionX" device={device} min={0} max={100} onChange={onChange} fitContentFallback fitContentValue={50} />
        <ResponsiveNumberField label="Vertical Position (%)" props={props} baseKey="imagePositionY" device={device} min={0} max={100} onChange={onChange} fitContentFallback fitContentValue={50} />
        <ResponsiveNumberField label="Image Width (px)" props={props} baseKey="imageWidth" device={device} min={0} max={1800} onChange={onChange} />
        <ResponsiveNumberField label="Image Max Width (px)" props={props} baseKey="imageMaxWidth" device={device} min={0} max={1800} onChange={onChange} />
        <ResponsiveNumberField label="Image Height (px)" props={props} baseKey="imageHeight" device={device} min={0} max={1200} onChange={onChange} />
        <ResponsiveNumberField label="Image Max Height (px)" props={props} baseKey="imageMaxHeight" device={device} min={0} max={1200} onChange={onChange} />
        <ResponsiveNumberField label="Container Height (px)" props={props} baseKey="containerHeight" device={device} min={0} max={1400} onChange={onChange} />
        {includePanelHeight ? (
          <ResponsiveNumberField label="Fixed Panel Image Height (px)" props={props} baseKey="panelImageFixedHeight" device={device} min={0} max={1200} onChange={onChange} mirrorKeys={["imageHeight"]} />
        ) : null}
      </div>
    </div>
  );
}

const RESPONSIVE_NUMERIC_FIELDS = {
  width: ["Width", 0, 5600, "px"],
  maxWidth: ["Max Width", 0, 5600, "px"],
  minWidth: ["Min Width", 0, 5600, "px"],
  height: ["Height", 0, 2400, "px"],
  minHeight: ["Min Height", 0, 2400, "px"],
  paddingTop: ["Padding Top", 0, 400, "number"],
  paddingRight: ["Padding Right", 0, 400, "number"],
  paddingBottom: ["Padding Bottom", 0, 400, "number"],
  paddingLeft: ["Padding Left", 0, 400, "number"],
  marginTop: ["Margin Top", 0, 400, "number"],
  marginRight: ["Margin Right", 0, 400, "number"],
  marginBottom: ["Margin Bottom", 0, 400, "number"],
  marginLeft: ["Margin Left", 0, 400, "number"],
  gap: ["Gap", 0, 160, "number"],
  rowGap: ["Row Gap", 0, 160, "number"],
  columnGap: ["Column Gap", 0, 160, "number"],
  fontSize: ["Font Size", 8, 120, "number"],
  textFontSize: ["Text Size", 8, 120, "number"],
  headlineFontSize: ["Heading Size", 12, 140, "number"],
  subheadlineFontSize: ["Subheading Size", 10, 80, "number"],
  sectionTitleSize: ["Section Title Size", 10, 120, "number"],
  sectionSubtitleSize: ["Section Subtitle Size", 10, 80, "number"],
  letterSpacing: ["Letter Spacing", 0, 24, "number"],
  gridColumns: ["Grid Columns", 1, 6, "number"],
  columns: ["Columns", 1, 6, "number"],
  cardsPerRowDesktop: ["Cards Per Row", 1, 6, "number"],
  cardsPerRow: ["Cards Per Row", 1, 6, "number"],
  testimonialColumns: ["Testimonial Columns", 1, 6, "number"],
  imageWidth: ["Image Width", 0, 5600, "px"],
  imageMaxWidth: ["Image Max Width", 0, 5600, "px"],
  imageHeight: ["Image Height", 0, 2400, "px"],
};

const RESPONSIVE_SELECT_FIELDS = {
  alignItems: ["Align Items", [["stretch", "Stretch"], ["flex-start", "Top / Left"], ["center", "Center"], ["flex-end", "Bottom / Right"]]],
  justifyContent: ["Justify Content", [["flex-start", "Start"], ["center", "Center"], ["flex-end", "End"], ["space-between", "Space Between"]]],
  textAlign: ["Text Align", [["left", "Left"], ["center", "Center"], ["right", "Right"], ["justify", "Justify"]]],
  alignment: ["Alignment", [["left", "Left"], ["center", "Center"], ["right", "Right"]]],
  flexDirection: ["Direction", [["row", "Row"], ["column", "Column"], ["row-reverse", "Row Reverse"], ["column-reverse", "Column Reverse"]]],
  flexWrap: ["Wrap", [["nowrap", "No Wrap"], ["wrap", "Wrap"]]],
  imageObjectFit: ["Image Fit", [["contain", "Contain"], ["cover", "Cover"], ["fill", "Fill"], ["none", "Natural"]]],
  objectFit: ["Object Fit", [["contain", "Contain"], ["cover", "Cover"], ["fill", "Fill"], ["none", "Natural"]]],
  buttonWidth: ["Button Width", [["auto", "Auto"], ["100%", "Full Width"], ["fit-content", "Fit Content"]]],
  buttonAlignment: ["Button Alignment", [["left", "Left"], ["center", "Center"], ["right", "Right"], ["stretch", "Stretch"]]],
  contentOrder: ["Content Order", [["text-first", "Text First"], ["media-first", "Media First"], ["default", "Default"]]],
};

function ResponsiveLayoutPanel({ block, index, onChange, device = "desktop" }) {
  const props = block?.props || {};
  const keys = getResponsiveLayoutKeysForBlock(block?.type);
  if (!keys.length) return null;
  const automatic = getAutomaticResponsiveDefaults(block?.type, device, props);
  const updateProps = (nextProps) => onChange(index, nextProps);
  const visibleKeys = keys.filter((key) => RESPONSIVE_NUMERIC_FIELDS[key] || RESPONSIVE_SELECT_FIELDS[key] || ["lineHeight", "textLineHeight", "bodyLineHeight", "headlineLineHeight", "subheadlineLineHeight"].includes(key));
  if (!visibleKeys.length) return null;

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>Responsive Layout</h3>
      <div style={styles.propertyGrid}>
        {visibleKeys.map((key) => {
          const lineHeightField = ["lineHeight", "textLineHeight", "bodyLineHeight", "headlineLineHeight", "subheadlineLineHeight"].includes(key);
          if (lineHeightField) {
            return (
              <ResponsiveNumberField
                key={key}
                label={formatLabel(key)}
                props={props}
                baseKey={key}
                device={device}
                min={0.8}
                max={3}
                step={0.05}
                onChange={updateProps}
                fitContentFallback={automatic[key] !== undefined}
                fitContentValue={automatic[key]}
              />
            );
          }
          const numeric = RESPONSIVE_NUMERIC_FIELDS[key];
          if (numeric) {
            return (
              <ResponsiveNumberField
                key={key}
                label={numeric[0]}
                props={props}
                baseKey={key}
                device={device}
                min={numeric[1]}
                max={numeric[2]}
                unit={numeric[3]}
                onChange={updateProps}
                fitContentFallback={automatic[key] !== undefined}
                fitContentValue={automatic[key]}
              />
            );
          }
          const select = RESPONSIVE_SELECT_FIELDS[key];
          if (!select) return null;
          return (
            <ResponsiveField
              key={key}
              label={select[0]}
              props={props}
              baseKey={key}
              device={device}
              onChange={updateProps}
              fitContentFallback={automatic[key] !== undefined}
              fitContentValue={automatic[key]}
              render={(value, setValue) => (
                <select value={String(value ?? "")} onChange={(event) => setValue(event.target.value)} style={styles.propertyInput}>
                  {select[1].map(([valueOption, label]) => (
                    <option key={`${key}-${valueOption}`} value={valueOption}>{label}</option>
                  ))}
                </select>
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

function NumberField({ label, value, min = 0, max = 200, step = 1, onChange }) {
  return (
    <div style={styles.numberField}>
      <span style={styles.colorLabel}>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number(value || 0)}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        style={styles.propertyInput}
      />
    </div>
  );
}

function SliderField({ label, value, min = 0, max = 80, step = 1, onChange }) {
  const numericValue = Math.max(min, Math.min(max, Number(value || 0)));
  return (
    <div style={{ ...styles.numberField, gap: 8 }}>
      <span style={styles.colorLabel}>{label}: {numericValue}px</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={numericValue}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        style={{ width: "100%" }}
      />
    </div>
  );
}

function normalizeColorInput(value, fallback) {
  const text = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text : fallback;
}

const STANDARD_COLOR_SWATCHES = [
  "#000000",
  "#081120",
  "#444444",
  "#666666",
  "#999999",
  "#cccccc",
  "#ffffff",
  "#c00000",
  "#ff0000",
  "#ffc000",
  "#ffff00",
  "#92d050",
  "#00b050",
  "#00b0f0",
  "#0070c0",
  "#002060",
  "#7030a0",
  "#ec4899",
  "#0f172a",
];

const PRICING_COLOR_SWATCHES = [
  "#2563eb",
  "#0ea5e9",
  "#06b6d4",
  "#10b981",
  "#22c55e",
  "#84cc16",
  "#f59e0b",
  "#f97316",
  "#ec4899",
  "#8b5cf6",
  "#ffffff",
  "#0f172a",
];

function ColorSelector({ label, value, fallback = "#0f172a", allowTransparent = false, onChange }) {
  const rawValue = String(value || "").trim() || (allowTransparent ? "transparent" : fallback);
  const pickerValue = normalizeColorInput(rawValue, fallback);

  return (
    <div style={styles.sectionCard}>
      <label style={styles.propertyLabel}>{label}</label>
      <div style={styles.colorGrid}>
        <div style={styles.colorField}>
          <span style={styles.colorLabel}>Picker</span>
          <input
            type="color"
            value={pickerValue}
            onChange={(e) => onChange(e.target.value)}
            style={styles.colorInput}
          />
        </div>
        <div style={{ ...styles.colorField, gridColumn: "span 2" }}>
          <span style={styles.colorLabel}>Value</span>
          <input
            type="text"
            value={rawValue}
            onChange={(e) => onChange(e.target.value)}
            style={styles.propertyInput}
            placeholder={allowTransparent ? "transparent or #ffffff" : "#0f172a"}
          />
        </div>
      </div>
      <div style={styles.colorSwatchRow}>
        {allowTransparent ? (
          <button
            type="button"
            style={{ ...styles.colorSwatch, color: "#e6eef5", fontSize: 16, width: "auto", padding: "0 8px" }}
            onClick={() => onChange("transparent")}
          >
            Transparent
          </button>
        ) : null}
        {STANDARD_COLOR_SWATCHES.map((swatch) => (
          <button
            key={`${label}-${swatch}`}
            type="button"
            onClick={() => onChange(swatch)}
            title={swatch}
            style={{ ...styles.colorSwatch, background: swatch, borderColor: rawValue === swatch ? "#7dd3fc" : "rgba(148,163,184,0.28)" }}
          />
        ))}
      </div>
    </div>
  );
}

function CompactColorField({ label, value, fallback = "#0f172a", onChange, swatches = PRICING_COLOR_SWATCHES }) {
  const rawValue = String(value || "").trim() || fallback;
  const pickerValue = normalizeColorInput(rawValue, fallback);

  return (
    <div style={styles.compactColorField}>
      <label style={styles.compactColorLabel}>{label}</label>
      <div style={styles.compactColorRow}>
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          style={styles.compactColorInput}
        />
        <div style={styles.compactColorSwatches}>
          {swatches.map((swatch) => (
            <button
              key={`${label}-${swatch}`}
              type="button"
              onClick={() => onChange(swatch)}
              style={{
                ...styles.colorSwatch,
                width: 20,
                height: 20,
                minWidth: 20,
                minHeight: 20,
                background: swatch,
                borderColor: rawValue.toLowerCase() === swatch.toLowerCase() ? "#7dd3fc" : "rgba(148,163,184,0.28)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function rgbToHex(value, fallback = "#ffffff") {
  const text = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text;
  const match = text.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return fallback;
  const toHex = (part) => Number(part).toString(16).padStart(2, "0");
  return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
}

function stripEditorArtifacts(html) {
  return String(html || "")
    .replace(/\u200b/g, "")
    .replace(/<span\b([^>]*)>\s*<\/span>/gi, "")
    .replace(/\sdata-temp-selection="[^"]*"/gi, "");
}

// Each font entry: value = CSS font-family string, label = display name, google = true if loaded from Google Fonts
const TEXT_TOOLBAR_FONTS = [
  // ── Modern sans-serif ──────────────────────────────────────────────────────
  { value: "Inter", label: "Inter", google: true },
  { value: "DM Sans", label: "DM Sans", google: true },
  { value: "Plus Jakarta Sans", label: "Plus Jakarta Sans", google: true },
  { value: "Manrope", label: "Manrope", google: true },
  { value: "Figtree", label: "Figtree", google: true },
  { value: "Outfit", label: "Outfit", google: true },
  { value: "Urbanist", label: "Urbanist", google: true },
  { value: "Space Grotesk", label: "Space Grotesk", google: true },
  { value: "Syne", label: "Syne", google: true },
  { value: "Jost", label: "Jost", google: true },
  { value: "Work Sans", label: "Work Sans", google: true },
  { value: "Rubik", label: "Rubik", google: true },
  { value: "Mulish", label: "Mulish", google: true },
  { value: "Quicksand", label: "Quicksand", google: true },
  { value: "Barlow", label: "Barlow", google: true },
  { value: "Exo 2", label: "Exo 2", google: true },
  { value: "Source Sans 3", label: "Source Sans 3", google: true },
  // ── Classic web-safe sans ──────────────────────────────────────────────────
  { value: "Roboto", label: "Roboto", google: true },
  { value: "Open Sans", label: "Open Sans", google: true },
  { value: "Lato", label: "Lato", google: true },
  { value: "Montserrat", label: "Montserrat", google: true },
  { value: "Poppins", label: "Poppins", google: true },
  { value: "Nunito", label: "Nunito", google: true },
  { value: "Raleway", label: "Raleway", google: true },
  { value: "Oswald", label: "Oswald", google: true },
  { value: "Josefin Sans", label: "Josefin Sans", google: true },
  { value: "Arial", label: "Arial" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Segoe UI", label: "Segoe UI" },
  { value: "Verdana", label: "Verdana" },
  { value: "Trebuchet MS", label: "Trebuchet MS" },
  { value: "Tahoma", label: "Tahoma" },
  // ── Tech / futuristic ─────────────────────────────────────────────────────
  { value: "Orbitron", label: "Orbitron", google: true },
  { value: "Oxanium", label: "Oxanium", google: true },
  { value: "Exo", label: "Exo", google: true },
  { value: "Rajdhani", label: "Rajdhani", google: true },
  { value: "Bebas Neue", label: "Bebas Neue", google: true },
  { value: "Impact", label: "Impact" },
  // ── Serif ─────────────────────────────────────────────────────────────────
  { value: "Playfair Display", label: "Playfair Display", google: true },
  { value: "DM Serif Display", label: "DM Serif Display", google: true },
  { value: "Cormorant Garamond", label: "Cormorant Garamond", google: true },
  { value: "Lora", label: "Lora", google: true },
  { value: "Merriweather", label: "Merriweather", google: true },
  { value: "EB Garamond", label: "EB Garamond", google: true },
  { value: "Libre Baskerville", label: "Libre Baskerville", google: true },
  { value: "Spectral", label: "Spectral", google: true },
  { value: "Crimson Text", label: "Crimson Text", google: true },
  { value: "Source Serif 4", label: "Source Serif 4", google: true },
  { value: "Cinzel", label: "Cinzel", google: true },
  { value: "PT Serif", label: "PT Serif", google: true },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Garamond", label: "Garamond" },
  { value: "Palatino Linotype", label: "Palatino Linotype" },
  { value: "Cambria", label: "Cambria" },
  // ── Handwriting / script ──────────────────────────────────────────────────
  { value: "Pacifico", label: "Pacifico", google: true },
  { value: "Dancing Script", label: "Dancing Script", google: true },
  { value: "Sacramento", label: "Sacramento", google: true },
  { value: "Great Vibes", label: "Great Vibes", google: true },
  { value: "Caveat", label: "Caveat", google: true },
  { value: "Kalam", label: "Kalam", google: true },
  { value: "Brush Script MT", label: "Brush Script MT" },
  // ── Monospace ─────────────────────────────────────────────────────────────
  { value: "Courier New", label: "Courier New" },
  { value: "Consolas", label: "Consolas" },
  { value: "Lucida Console", label: "Lucida Console" },
];

const TEXT_TOOLBAR_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 46, 48, 52, 56, 64, 72, 84, 96];
const TEXT_TOOLBAR_LINE_HEIGHTS = [0.9, 1, 1.1, 1.2, 1.25, 1.3, 1.35, 1.4, 1.5, 1.6, 1.7, 1.8, 2, 2.2, 2.5, 3];
const ANIMATION_PRESETS = [
  { value: "none", label: "None" },
  { value: "fade-in", label: "Fade In" },
  { value: "fade-up", label: "Fade Up" },
  { value: "fade-down", label: "Fade Down" },
  { value: "fade-left", label: "Fade Left" },
  { value: "fade-right", label: "Fade Right" },
  { value: "slide-left", label: "Slide Left" },
  { value: "slide-right", label: "Slide Right" },
  { value: "slide-up", label: "Slide Up" },
  { value: "sweep-left", label: "Sweep Left" },
  { value: "sweep-right", label: "Sweep Right" },
  { value: "edge-left", label: "From Left Edge" },
  { value: "edge-right", label: "From Right Edge" },
  { value: "edge-up", label: "From Bottom Edge" },
  { value: "edge-down", label: "From Top Edge" },
  { value: "zoom", label: "Zoom In" },
  { value: "pop-in", label: "Pop In" },
  { value: "blur-in", label: "Blur In" },
  { value: "flip-up", label: "Flip Up" },
  { value: "drift-left", label: "Drift Left" },
  { value: "drift-right", label: "Drift Right" },
  { value: "drift-edge-left", label: "Drift From Left Edge" },
  { value: "drift-edge-right", label: "Drift From Right Edge" },
  { value: "light-speed-in", label: "Light Speed In" },
  { value: "rotate-in-down-right", label: "Rotate In Down Right" },
  { value: "rubber-band", label: "Rubber Band" },
];
const ANIMATION_DELAY_OPTIONS = [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1, 1.2];
const ANIMATION_SPEED_OPTIONS = [0.5, 0.7, 0.8, 1, 1.2, 1.5, 1.8, 2.2];
const BLOCK_TYPE_STYLE_PRESETS = {
  P: { fontSize: "18px", fontWeight: "400", lineHeight: "1.7" },
  H1: { fontSize: "48px", fontWeight: "600", lineHeight: "1.08" },
  H2: { fontSize: "36px", fontWeight: "600", lineHeight: "1.14" },
  H3: { fontSize: "28px", fontWeight: "600", lineHeight: "1.2" },
};

function getTextAnimationBinding(block, editable) {
  const propName = String(editable?.getAttribute?.("data-text-prop") || "").trim();
  if (!block || !propName) return null;

  if (propName === "headline" || propName === "headlineBlock.content") {
    return {
      label: "Headline Motion",
      animationKey: "textAnimation",
      speedKey: "textAnimationSpeed",
      delayKey: "textAnimationDelay",
    };
  }

  if (propName === "subheadline" || propName === "bodyBlock.content") {
    return {
      label: "Body Motion",
      animationKey: "subheadlineAnimation",
      speedKey: "subheadlineAnimationSpeed",
      delayKey: "subheadlineAnimationDelay",
    };
  }

  if (propName === "text") {
    return {
      label: "Text Motion",
      animationKey: "textAnimation",
      speedKey: "textAnimationSpeed",
      delayKey: "textAnimationDelay",
    };
  }

  return null;
}

function getSelectionStyleSource(editable, selection) {
  if (!editable) return null;
  const activeSelection = selection || (typeof window !== "undefined" ? window.getSelection?.() : null);
  if (activeSelection?.rangeCount) {
    const range = activeSelection.getRangeAt(0);
    if (!range.collapsed) {
      const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
          try {
            return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          } catch {
            return NodeFilter.FILTER_REJECT;
          }
        },
      });
      const selectedTextNode = walker.nextNode();
      if (selectedTextNode?.parentElement && editable.contains(selectedTextNode.parentElement)) {
        return selectedTextNode.parentElement;
      }

      const elementWalker = document.createTreeWalker(editable, NodeFilter.SHOW_ELEMENT, {
        acceptNode(node) {
          if (!(node instanceof Element) || node === editable) return NodeFilter.FILTER_REJECT;
          try {
            return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          } catch {
            return NodeFilter.FILTER_REJECT;
          }
        },
      });
      const selectedElement = elementWalker.nextNode();
      if (selectedElement instanceof Element) return selectedElement;
    }
  }
  const node = activeSelection?.focusNode || activeSelection?.anchorNode || null;
  const element = node?.nodeType === 3 ? node.parentElement : node;
  if (element instanceof Element && element !== editable && editable.contains(element)) {
    return element;
  }
  return editable;
}

function getEditableBackgroundTarget(editable) {
  if (!(editable instanceof Element)) return null;
  if (editable.hasAttribute?.("data-layer-editor")) {
    return editable.parentElement instanceof Element ? editable.parentElement : editable;
  }
  return editable;
}

function parseBackgroundImageUrl(value) {
  const text = String(value || "").trim();
  if (!text || text === "none") return "";
  const match = text.match(/url\((['"]?)(.*?)\1\)/i);
  return match?.[2] || "";
}

function normalizeToolbarBackgroundColor(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text || text === "transparent") return "transparent";
  const rgbaMatch = text.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*(\d*\.?\d+)\)$/i);
  if (rgbaMatch && Number(rgbaMatch[4]) === 0) return "transparent";
  return text;
}

function normalizeComputedLineHeight(lineHeightValue, fontSizeValue, fallback = 1.5) {
  const parsedFontSize = Number.parseFloat(fontSizeValue || 0);
  const raw = String(lineHeightValue || "").trim().toLowerCase();
  if (!raw || raw === "normal") return fallback;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  if (raw.endsWith("px") && parsedFontSize > 0) {
    return Math.max(0.8, Math.min(3, Number((parsed / parsedFontSize).toFixed(2))));
  }
  return Math.max(0.8, Math.min(3, Number(parsed.toFixed(2))));
}

function normalizeLineHeightValue(value, fallback = 1.5) {
  const parsed = Number(value);
  const fallbackValue = Number.isFinite(Number(fallback)) ? Number(fallback) : 1.5;
  if (!Number.isFinite(parsed) || parsed <= 0) return Math.max(0.8, Math.min(3, Number(fallbackValue.toFixed(2))));
  return Math.max(0.8, Math.min(3, Number(parsed.toFixed(2))));
}

function parseToolbarFontSize(value, fallback = 18) {
  const parsed = Number.parseFloat(String(value ?? "").replace("px", ""));
  const fallbackParsed = Number.parseFloat(String(fallback ?? "").replace("px", ""));
  const next = Number.isFinite(parsed) && parsed > 0
    ? parsed
    : Number.isFinite(fallbackParsed) && fallbackParsed > 0
      ? fallbackParsed
      : 18;
  return Math.max(8, Math.min(240, Math.round(next)));
}

function stripInlineCssPropertyFromHtml(value, propertyName) {
  const html = String(value || "");
  const property = String(propertyName || "").trim().toLowerCase();
  if (!html || !property) return html;

  return html.replace(/\sstyle=(['"])(.*?)\1/gi, (_match, quote, styleValue) => {
    const nextStyles = String(styleValue || "")
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .filter((entry) => String(entry.split(":")[0] || "").trim().toLowerCase() !== property);

    return nextStyles.length ? ` style=${quote}${nextStyles.join("; ")}${quote}` : "";
  });
}

function FontPickerDropdown({ value, onChange, onPreserveSelection }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 280, openDown: true });

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (!triggerRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const openPicker = (e) => {
    e.preventDefault();
    onPreserveSelection?.();
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        const dropHeight = 380;
        const spaceBelow = (window.innerHeight || 800) - rect.bottom - 8;
        const openDown = spaceBelow >= dropHeight || spaceBelow >= rect.top - 8;
        setDropPos({
          top: openDown ? rect.bottom + 4 : rect.top,
          left: Math.max(4, Math.min(rect.left, (window.innerWidth || 1200) - Math.max(rect.width, 290) - 4)),
          width: Math.max(rect.width, 290),
          openDown,
        });
      }
    }
    setOpen((v) => !v);
  };

  const selectFont = (e, fontValue) => {
    e.preventDefault();
    onPreserveSelection?.();
    onChange?.(fontValue);
    setOpen(false);
  };

  const current = TEXT_TOOLBAR_FONTS.find((f) => f.value === value) || { value: value || "Arial", label: value || "Arial" };

  return (
    <div ref={triggerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onMouseDown={openPicker}
        data-text-toolbar="true"
        title="Font family"
        style={{
          ...styles.textToolbarSelect,
          minWidth: 220,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          userSelect: "none",
        }}
      >
        <span style={{ fontFamily: current.value, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
          {current.label}
        </span>
        <span style={{ fontSize: 10, color: "#4d78a5", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          data-text-toolbar="true"
          style={{
            position: "fixed",
            top: dropPos.top,
            left: dropPos.left,
            transform: dropPos.openDown ? "none" : "translateY(-100%) translateY(-8px)",
            width: dropPos.width,
            maxHeight: 380,
            overflowY: "auto",
            background: "#ffffff",
            border: "1px solid rgba(37,99,235,0.4)",
            borderRadius: 10,
            boxShadow: "0 16px 40px rgba(15,23,42,0.2)",
            zIndex: 99999,
            padding: "4px 0",
          }}
        >
          {TEXT_TOOLBAR_FONTS.map((font) => (
            <div
              key={font.value}
              onMouseDown={(e) => selectFont(e, font.value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "7px 14px",
                cursor: "pointer",
                background: font.value === value ? "rgba(37,99,235,0.08)" : "transparent",
                borderLeft: font.value === value ? "3px solid #2563eb" : "3px solid transparent",
              }}
            >
              <span style={{ fontFamily: font.value, fontSize: 22, color: "#0f2f4d", flexShrink: 0, width: 36, textAlign: "center" }}>Aa</span>
              <span style={{ fontFamily: font.value, fontSize: 15, color: "#16324f" }}>{font.label}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

function TextEditingToolbar({ visible, textColor, highlightColor, fontFamily, fontSize, lineHeight, fontWeight, fontStyle, textDecoration, textAlign, blockType, hasCopiedFormat, canStyleBox, boxBackgroundColor, boxBackgroundImage, boxWidth, onClearBoxBackground, onBoxBackgroundColor, onBoxBackgroundImageUpload, onClearBoxBackgroundImage, onBoxWidthChange, onCommand, onTextColor, onHighlightColor, onFontSize, onLineHeight, onBlockType, onFontFamily, onCopyFormat, onClearCopiedFormat, onOpenAnimations, position, onDragStart, onClose, onPreserveSelection }) {
  const backgroundFileInputRef = useRef(null);
  const currentLineHeight = normalizeLineHeightValue(lineHeight || 1.5);
  const currentFontSize = parseToolbarFontSize(fontSize, 18);
  const fontSizeOptions = TEXT_TOOLBAR_SIZES.includes(currentFontSize)
    ? TEXT_TOOLBAR_SIZES
    : [...TEXT_TOOLBAR_SIZES, currentFontSize].sort((a, b) => a - b);
  const lineHeightOptions = TEXT_TOOLBAR_LINE_HEIGHTS.includes(currentLineHeight)
    ? TEXT_TOOLBAR_LINE_HEIGHTS
    : [...TEXT_TOOLBAR_LINE_HEIGHTS, currentLineHeight].sort((a, b) => a - b);
  const defaultToolbarLineHeight = blockType === "P" ? 1.7 : blockType === "H1" ? 1.08 : blockType === "H2" ? 1.14 : blockType === "H3" ? 1.2 : 1.5;

  const keepSelection = (event, callback) => {
    event.preventDefault();
    onPreserveSelection?.();
    callback?.();
  };

  const handleFontSizeChange = (value) => {
    onPreserveSelection?.();
    const nextSize = parseToolbarFontSize(value, currentFontSize);
    onFontSize?.(nextSize);
  };

  const startHeaderDrag = (event) => {
    if (event.target?.closest?.("button, select, input, label")) return;
    onDragStart?.(event);
  };

  const blockButtons = [
    { value: "P", label: "P", title: "Paragraph" },
    { value: "H1", label: "H1", title: "Heading 1" },
    { value: "H2", label: "H2", title: "Heading 2" },
    { value: "H3", label: "H3", title: "Heading 3" },
  ];

  const textButtons = [
    { label: "B", title: "Bold", active: Number.parseInt(fontWeight || "400", 10) >= 600, action: () => onCommand("bold") },
    { label: "I", title: "Italic", active: fontStyle === "italic", action: () => onCommand("italic") },
    { label: "U", title: "Underline", active: String(textDecoration || "").includes("underline"), action: () => onCommand("underline") },
  ];

  const currentTextAlign = ["left", "center", "right", "justify"].includes(String(textAlign || "")) ? String(textAlign) : "left";
  const alignButtons = [
    { label: "Left", title: "Align left", value: "left", action: () => onCommand("justifyLeft") },
    { label: "Center", title: "Align center", value: "center", action: () => onCommand("justifyCenter") },
    { label: "Right", title: "Align right", value: "right", action: () => onCommand("justifyRight") },
    { label: "Justify", title: "Justify", value: "justify", action: () => onCommand("justifyFull") },
  ];

  const utilityButtons = [
    { label: "•", title: "Bullet list", action: () => onCommand("insertUnorderedList") },
    { label: "1.", title: "Numbered list", action: () => onCommand("insertOrderedList") },
    { label: "Link", title: "Add link", action: () => onCommand("createLink") },
    { label: "Clear", title: "Clear formatting", action: () => onCommand("removeFormat") },
  ];

  return (
    <div
      style={{
        ...styles.textToolbar,
        left: position?.x ?? 240,
        top: position?.y ?? 120,
        width: position?.width ?? 1120,
        display: visible ? undefined : "none",
      }}
      data-text-toolbar="true"
      onMouseDownCapture={() => onPreserveSelection?.()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div style={styles.textToolbarHeader} onMouseDown={startHeaderDrag}>
        <span style={styles.toolbarDragGlyph}>⋮⋮</span>
        <span style={styles.textToolbarTitle}>Text Controls</span>
        <span style={styles.textToolbarSubtitle}>Quick inline editor</span>
        <button type="button" style={styles.textToolbarDoneBtn} onMouseDown={(event) => keepSelection(event, onClose)}>
          Done
        </button>
      </div>
      <div style={styles.textToolbarBody}>
        <div style={styles.textToolbarInlineGroup}>
          <label style={styles.textToolbarLabel}>
            Hierarchy
            <select
              value={blockType || "P"}
              style={{ ...styles.textToolbarSelect, minWidth: 110, marginTop: 6 }}
              onMouseDownCapture={() => onPreserveSelection?.()}
              onChange={(event) => onBlockType?.(event.target.value)}
            >
              {blockButtons.map((item) => (
                <option key={item.value} value={item.value}>{item.title}</option>
              ))}
            </select>
          </label>
          <FontPickerDropdown
            value={fontFamily || "Arial"}
            onChange={onFontFamily}
            onPreserveSelection={onPreserveSelection}
          />
          <label style={styles.textToolbarLabel}>
            Size
            <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 6 }}>
              <button
                type="button"
                title="Decrease font size"
                style={{ ...styles.textToolbarIconBtn, fontWeight: 700, fontSize: 15, minWidth: 26, padding: "0 5px" }}
                onMouseDown={(event) => keepSelection(event, () => {
                  const nextSize = Math.max(8, currentFontSize - 1);
                  onFontSize?.(nextSize);
                })}
              >−</button>
              <select
                value={currentFontSize}
                aria-label="Font size in pixels"
                style={{ ...styles.textToolbarSelect, width: 86, minWidth: 86, marginTop: 0, padding: "4px 6px" }}
                onMouseDownCapture={() => onPreserveSelection?.()}
                onFocus={() => onPreserveSelection?.()}
                onChange={(event) => handleFontSizeChange(event.target.value)}
              >
                {fontSizeOptions.map((value) => (
                  <option key={`font-size-${value}`} value={value}>{value}px</option>
                ))}
              </select>
              <button
                type="button"
                title="Increase font size"
                style={{ ...styles.textToolbarIconBtn, fontWeight: 700, fontSize: 15, minWidth: 26, padding: "0 5px" }}
                onMouseDown={(event) => keepSelection(event, () => {
                  const nextSize = Math.min(240, currentFontSize + 1);
                  onFontSize?.(nextSize);
                })}
              >+</button>
            </div>
          </label>
          <label style={styles.textToolbarLabel}>
            Line spacing
            <div style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "nowrap", marginTop: 6 }}>
            <button
              type="button"
              title="Decrease line spacing"
              style={{ ...styles.textToolbarIconBtn, fontWeight: 700, fontSize: 15, minWidth: 26, padding: "0 5px" }}
              onMouseDown={(event) => keepSelection(event, () => onLineHeight?.(normalizeLineHeightValue(currentLineHeight - 0.05)))}
            >−</button>
            <button
              type="button"
              title="Increase line spacing"
              style={{ ...styles.textToolbarIconBtn, fontWeight: 700, fontSize: 15, minWidth: 26, padding: "0 5px" }}
              onMouseDown={(event) => keepSelection(event, () => onLineHeight?.(normalizeLineHeightValue(currentLineHeight + 0.05)))}
            >+</button>
            <select
              value={String(currentLineHeight)}
              style={{ ...styles.textToolbarSelect, width: 78, minWidth: 78, marginTop: 0 }}
              onMouseDownCapture={() => onPreserveSelection?.()}
              onChange={(event) => onLineHeight?.(Number(event.target.value))}
            >
              {lineHeightOptions.map((value) => (
                <option key={`line-height-${value}`} value={value}>{value}</option>
              ))}
            </select>
            <button
              type="button"
              title="Reset line spacing"
              style={{ ...styles.textToolbarActionChip, padding: "4px 8px", minHeight: 30 }}
              onMouseDown={(event) => keepSelection(event, () => onLineHeight?.(normalizeLineHeightValue(defaultToolbarLineHeight)))}
            >Reset</button>
            </div>
          </label>
        </div>
        <div style={styles.textToolbarInlineDivider} />
        <div style={{ ...styles.textToolbarInlineGroup, ...styles.textToolbarFormattingGroup }}>
          <div style={styles.textToolbarButtonRow}>
            {textButtons.map((item) => (
              <button key={item.title} type="button" title={item.title} style={{ ...styles.textToolbarIconBtn, ...(item.active ? { background: "#0ea5e9", color: "#ffffff", borderColor: "#0284c7" } : {}) }} onMouseDown={(event) => keepSelection(event, item.action)}>
                {item.label}
              </button>
            ))}
          </div>
          <div style={styles.textToolbarButtonRow}>
            {alignButtons.map((item) => (
              <button
                key={item.title}
                type="button"
                title={item.title}
                style={{
                  ...styles.textToolbarMiniActionChip,
                  ...(currentTextAlign === item.value ? { background: "#0ea5e9", color: "#ffffff", borderColor: "#0284c7" } : {}),
                }}
                onMouseDown={(event) => keepSelection(event, item.action)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div style={styles.textToolbarInlineDivider} />
        <div style={styles.textToolbarInlineGroup}>
          {utilityButtons.map((item) => (
            <button key={item.title} type="button" title={item.title} style={item.label.length <= 2 ? styles.textToolbarIconBtn : styles.textToolbarActionChip} onMouseDown={(event) => keepSelection(event, item.action)}>
              {item.label}
            </button>
          ))}
          <button
            type="button"
            title="Copy format, then click another text box to apply it"
            style={{
              ...styles.textToolbarActionChip,
              ...(hasCopiedFormat ? { background: "#22c55e", color: "#052e16", borderColor: "#16a34a" } : {}),
            }}
            onMouseDown={(event) => keepSelection(event, () => onCopyFormat?.())}
          >
            Copy Format
          </button>
          {hasCopiedFormat ? (
            <button
              type="button"
              title="Cancel copied format"
              style={styles.textToolbarActionChip}
              onMouseDown={(event) => keepSelection(event, () => onClearCopiedFormat?.())}
            >
              Cancel Format
            </button>
          ) : null}
          <button
            type="button"
            style={styles.textToolbarActionChip}
            onMouseDown={(event) => keepSelection(event, () => onOpenAnimations?.(event.currentTarget))}
          >
            Animations
          </button>
        </div>
        <div style={styles.textToolbarInlineDivider} />
        <div style={{ ...styles.textToolbarInlineGroup, ...styles.textToolbarColorGroupWrap }}>
          <label style={styles.textToolbarLabel}>
            Text
            <input type="color" value={textColor} onMouseDownCapture={() => onPreserveSelection?.()} onChange={(e) => onTextColor(e.target.value)} style={styles.textToolbarColor} />
          </label>
          <label style={{ ...styles.textToolbarLabel, ...styles.textToolbarLabelSpaced }}>
            Highlight
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
              <input type="color" value={highlightColor} onMouseDownCapture={() => onPreserveSelection?.()} onChange={(e) => onHighlightColor(e.target.value)} style={{ ...styles.textToolbarColor, marginTop: 0 }} />
              <button
                type="button"
                title="Remove highlight"
                style={{ ...styles.textToolbarActionChip, padding: "2px 6px", fontSize: 16, lineHeight: 1 }}
                onMouseDown={(event) => keepSelection(event, () => onHighlightColor("transparent"))}
              >None</button>
            </div>
          </label>
          <div style={styles.textToolbarSwatchesInline}>
            {STANDARD_COLOR_SWATCHES.map((swatch) => (
              <button
                key={`toolbar-${swatch}`}
                type="button"
                title={swatch}
                onMouseDown={(event) => keepSelection(event, () => onTextColor?.(swatch))}
                style={{
                  ...styles.textToolbarSwatch,
                  background: swatch,
                  borderColor: String(textColor || "").toLowerCase() === swatch.toLowerCase() ? "#0f172a" : "rgba(121,85,0,0.28)",
                }}
              />
            ))}
          </div>
        </div>
        {canStyleBox ? (
          <>
            <div style={styles.textToolbarInlineDivider} />
            <div style={{ ...styles.textToolbarInlineGroup, ...styles.textToolbarColorGroupWrap }}>
              <label style={styles.textToolbarLabel}>
                Text Box
              </label>
              <div style={styles.textToolbarButtonRow}>
                <button
                  type="button"
                  style={styles.textToolbarActionChip}
                  onMouseDown={(event) => keepSelection(event, () => onClearBoxBackground?.())}
                >
                  Remove Background
                </button>
                <button
                  type="button"
                  style={styles.textToolbarActionChip}
                  onMouseDown={(event) => keepSelection(event, () => backgroundFileInputRef.current?.click())}
                >
                  Background Image
                </button>
                {boxBackgroundImage ? (
                  <button
                    type="button"
                    style={styles.textToolbarActionChip}
                    onMouseDown={(event) => keepSelection(event, () => onClearBoxBackgroundImage?.())}
                  >
                    Remove Image
                  </button>
                ) : null}
              </div>
              <label style={styles.textToolbarLabel}>
                Block Width
                <input
                  type="number"
                  min={120}
                  max={5600}
                  value={Number(boxWidth || 360)}
                  style={{ ...styles.textToolbarSelect, minWidth: 112, marginTop: 6 }}
                  onMouseDownCapture={() => onPreserveSelection?.()}
                  onChange={(event) => onBoxWidthChange?.(Number(event.target.value))}
                />
              </label>
              <input
                ref={backgroundFileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onMouseDownCapture={() => onPreserveSelection?.()}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  onBoxBackgroundImageUpload?.(file);
                }}
              />
              <div style={styles.textToolbarSwatchesInline}>
                {STANDARD_COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={`toolbar-box-${swatch}`}
                    type="button"
                    title={swatch}
                    onMouseDown={(event) => keepSelection(event, () => onBoxBackgroundColor?.(swatch))}
                    style={{
                      ...styles.textToolbarSwatch,
                      background: swatch,
                      borderColor: String(boxBackgroundColor || "").toLowerCase() === swatch.toLowerCase() ? "#0f172a" : "rgba(121,85,0,0.28)",
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function BlockAnimationPopover({ visible, block, position, onClose, onApply, onDragStart, onPreview }) {
  if (!visible || !block) return null;

  const props = block?.props || {};
  const hasHeadline = Object.prototype.hasOwnProperty.call(props, "headline");
  const hasBody = Object.prototype.hasOwnProperty.call(props, "subheadline") || Object.prototype.hasOwnProperty.call(props, "text");

  const startHeaderDrag = (event) => {
    if (event.target?.closest?.("button, select, input, label")) return;
    onDragStart?.(event);
  };

  const renderAnimationControls = (label, animationKey, delayKey, speedKey) => (
    <div style={styles.animationFieldset}>
      <label style={styles.propertyLabel}>{label}</label>
      <div style={styles.animationPresetGrid}>
        {ANIMATION_PRESETS.map((option) => (
          <button
            key={`${animationKey}-${option.value}`}
            type="button"
            style={{
              ...styles.animationPresetChip,
              ...(String(props?.[animationKey] || "none") === option.value ? styles.animationPresetChipActive : {}),
            }}
            onClick={() => onApply({ [animationKey]: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div style={styles.animationOptionsGrid}>
        <div style={styles.animationOptionGroup}>
          <div style={styles.animationMiniLabel}>Speed</div>
          <div style={styles.animationChipRow}>
            {ANIMATION_SPEED_OPTIONS.map((option) => (
              <button
                key={`${speedKey}-${option}`}
                type="button"
                style={{
                  ...styles.animationValueChip,
                  ...(Number(props?.[speedKey] || 0.8) === option ? styles.animationValueChipActive : {}),
                }}
                onClick={() => onApply({ [speedKey]: Number(option) })}
              >
                {option.toFixed(1)}s
              </button>
            ))}
          </div>
        </div>
        <div style={styles.animationOptionGroup}>
          <div style={styles.animationMiniLabel}>Delay</div>
          <div style={styles.animationChipRow}>
            {ANIMATION_DELAY_OPTIONS.map((option) => (
              <button
                key={`${delayKey}-${option}`}
                type="button"
                style={{
                  ...styles.animationValueChip,
                  ...(Number(props?.[delayKey] || 0) === option ? styles.animationValueChipActive : {}),
                }}
                onClick={() => onApply({ [delayKey]: Number(option) })}
              >
                {option === 0 ? "0s" : `${option.toFixed(option < 1 ? 2 : 1)}s`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        ...styles.animationPopover,
        left: position?.x ?? 24,
        top: position?.y ?? 120,
        width: position?.width ?? 980,
      }}
      data-animation-popover="true"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div style={styles.animationPopoverHeader} onMouseDown={startHeaderDrag}>
        <div style={styles.animationPopoverHeaderMain}>
          <span style={styles.toolbarDragGlyph}>⋮⋮</span>
          <div>
          <div style={styles.animationPopoverTitle}>Animation Settings</div>
          <div style={styles.animationPopoverSubtitle}>{block?.type || "block"}</div>
        </div>
        </div>
        <div style={styles.animationPopoverActions}>
          <button type="button" style={styles.animationPreviewBtn} onClick={onPreview}>▶ Trigger</button>
          <button type="button" style={styles.textToolbarDoneBtn} onClick={onClose}>Hide</button>
        </div>
      </div>
      <div style={styles.animationPopoverBody}>
        {renderAnimationControls("Section Entrance", "sectionAnimation", "sectionAnimationDelay", "sectionAnimationSpeed")}
        {hasHeadline ? renderAnimationControls("Headline", "textAnimation", "textAnimationDelay", "textAnimationSpeed") : null}
        {hasBody ? renderAnimationControls(hasHeadline ? "Body Copy" : "Text", hasHeadline ? "subheadlineAnimation" : "textAnimation", hasHeadline ? "subheadlineAnimationDelay" : "textAnimationDelay", hasHeadline ? "subheadlineAnimationSpeed" : "textAnimationSpeed") : null}
      </div>
    </div>
  );
}

export {
  ResponsiveField,
  ResponsiveNumberField,
  IMAGE_FIT_OPTIONS,
  IMAGE_POSITION_PRESETS,
  ResponsiveImageFitPositionControls,
  RESPONSIVE_NUMERIC_FIELDS,
  RESPONSIVE_SELECT_FIELDS,
  ResponsiveLayoutPanel,
  NumberField,
  SliderField,
  normalizeColorInput,
  STANDARD_COLOR_SWATCHES,
  PRICING_COLOR_SWATCHES,
  ColorSelector,
  CompactColorField,
  rgbToHex,
  stripEditorArtifacts,
  TEXT_TOOLBAR_FONTS,
  TEXT_TOOLBAR_SIZES,
  TEXT_TOOLBAR_LINE_HEIGHTS,
  ANIMATION_PRESETS,
  ANIMATION_DELAY_OPTIONS,
  ANIMATION_SPEED_OPTIONS,
  BLOCK_TYPE_STYLE_PRESETS,
  getTextAnimationBinding,
  getSelectionStyleSource,
  getEditableBackgroundTarget,
  parseBackgroundImageUrl,
  normalizeToolbarBackgroundColor,
  normalizeComputedLineHeight,
  normalizeLineHeightValue,
  parseToolbarFontSize,
  stripInlineCssPropertyFromHtml,
  FontPickerDropdown,
  TextEditingToolbar,
  BlockAnimationPopover,
};
