import { htmlToPlainText, ANIMATION_PRESETS } from "./pbEditorUtils";
import { renderSocialPlatformIcon, renderGridLibraryIcon, GRID_ICON_LIBRARY, isUnsafePublishedIconUrl } from "../gridIconLibrary";
import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { styles } from "./pbStyles";
import { openSharedMediaPicker } from "../../../lib/openSharedMediaPicker";
import { NumberField, ResponsiveNumberField, ColorSelector } from "./pbPropertiesPanels";
import { getAssetFromLibrary } from "../../../lib/website-builder/mediaAssets";

export function normalizeGridSectionItems(items) {
  if (!Array.isArray(items) || !items.length) {
    return [{ icon: "", iconName: "", iconGlyph: "", iconFontFamily: "", iconImage: "", iconAssetId: "", title: "", content: "", image: "", imageAlt: "" }];
  }

  return items.map((item) => ({
    icon: String(item?.icon || ""),
    iconName: String(item?.iconName || ""),
    iconGlyph: String(item?.iconGlyph || ""),
    iconFontFamily: String(item?.iconFontFamily || ""),
    iconImage: String(item?.iconImage || ""),
    iconAssetId: String(item?.iconAssetId || ""),
    title: htmlToPlainText(item?.title || ""),
    eyebrow: htmlToPlainText(item?.eyebrow || ""),
    content: htmlToPlainText(item?.content || ""),
    link: String(item?.link || ""),
    image: String(item?.image || ""),
    imageAlt: htmlToPlainText(item?.imageAlt || ""),
    imageHeight: item?.imageHeight,
    imageAssetId: item?.imageAssetId,
  }));
}

export function renderGridFontIcon(item, color, size) {
  if (!item?.iconGlyph || !item?.iconFontFamily) return null;
  return (
    <span
      aria-hidden="true"
      style={{
        fontFamily: item.iconFontFamily,
        fontSize: size,
        lineHeight: 1,
        color,
        display: "block",
        fontStyle: "normal",
        fontWeight: 400,
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      {item.iconGlyph}
    </span>
  );
}

export function resolveGridIconLibraryName(entry) {
  if (entry?.library) return String(entry.library);
  const key = String(entry?.key || "");
  const src = String(entry?.src || "");
  if (src) return "Social Files";
  if (key.startsWith("fi-")) return "Feather";
  if (key.startsWith("bs-")) return "Bootstrap";
  return "Font Awesome";
}

export function renderGridEditorIcon(item, color, size) {
  const socialIcon = renderSocialPlatformIcon(item, { size, color });
  if (socialIcon) {
    return socialIcon;
  }
  const fontIcon = renderGridFontIcon(item, color, size);
  if (fontIcon) {
    return fontIcon;
  }
  const namedIcon = renderGridLibraryIcon(item?.iconName, { size, color });
  if (namedIcon) {
    return namedIcon;
  }
  if (item?.icon) {
    return <span style={{ fontSize: size, lineHeight: 1, color }}>{item.icon}</span>;
  }
  return <span style={{ fontSize: Math.max(16, Math.round(size * 0.72)), fontWeight: 600, color }}>Icon</span>;
}

export function GridIconLibraryModal({ open, searchValue, onSearchChange, onClose, onSelect, entries = [] }) {
  const [activeLibrary, setActiveLibrary] = useState("all");
  const libraryOptions = useMemo(() => {
    const labels = [];
    const seen = new Set();
    entries.forEach((entry) => {
      const library = resolveGridIconLibraryName(entry);
      if (!seen.has(library)) {
        seen.add(library);
        labels.push(library);
      }
    });
    return [{ value: "all", label: "All" }, ...labels.map((label) => ({ value: label, label }))];
  }, [entries]);

  useEffect(() => {
    if (open) setActiveLibrary("all");
  }, [open]);

  const filteredIcons = useMemo(() => {
    const query = String(searchValue || "").trim().toLowerCase();
    return entries.filter((entry) => {
      const library = resolveGridIconLibraryName(entry);
      const matchesLibrary = activeLibrary === "all" || library === activeLibrary;
      const matchesQuery = !query || `${entry.label} ${entry.group} ${entry.key} ${library}`.toLowerCase().includes(query);
      return matchesLibrary && matchesQuery;
    });
  }, [activeLibrary, entries, searchValue]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.42)", display: "grid", placeItems: "center", zIndex: 10000, padding: 16 }} onClick={onClose}>
      <div style={{ width: "min(1160px, calc(100vw - 24px))", maxHeight: "min(860px, calc(100vh - 24px))", overflow: "hidden", borderRadius: 24, border: "1px solid rgba(148,163,184,0.24)", background: "#ffffff", boxShadow: "0 32px 80px rgba(2,6,23,0.28)", display: "grid", gridTemplateRows: "auto auto auto minmax(0, 1fr)" }} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "22px 24px 16px", borderBottom: "1px solid rgba(148,163,184,0.22)" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ color: "#0f172a", fontSize: 22, fontWeight: 600 }}>Icon Library</div>
            <div style={{ color: "#475569", fontSize: 16, fontWeight: 500 }}>Choose an icon. This is separate from the image library.</div>
          </div>
          <button type="button" style={{ ...styles.secondaryBtn, minWidth: 0 }} onClick={onClose}>Close</button>
        </div>

        <div style={{ padding: "18px 24px 0" }}>
          <input type="text" value={searchValue} onChange={(event) => onSearchChange(event.target.value)} style={{ ...styles.propertyInput, minHeight: 52, fontSize: 16, background: "#ffffff", color: "#0f172a", border: "1px solid rgba(148,163,184,0.35)" }} placeholder="Filter icons by name" autoFocus />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "14px 24px 0" }}>
          {libraryOptions.map((option) => {
            const isActive = activeLibrary === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setActiveLibrary(option.value)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 999,
                  border: isActive ? "1px solid #1d4ed8" : "1px solid rgba(148,163,184,0.35)",
                  background: isActive ? "#dbeafe" : "#ffffff",
                  color: isActive ? "#1e3a8a" : "#334155",
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 24, overflow: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(164px, 1fr))", gap: 16 }}>
            {filteredIcons.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => onSelect(entry)}
                style={{ display: "grid", gap: 12, justifyItems: "center", alignContent: "start", minHeight: 148, padding: 18, borderRadius: 18, border: "1px solid rgba(148,163,184,0.22)", background: "#162235", color: "#e2e8f0", cursor: "pointer", textAlign: "center" }}
              >
                <div style={{ width: 72, height: 72, borderRadius: 16, background: "#0b1220", border: "1px solid rgba(148,163,184,0.2)", display: "grid", placeItems: "center" }}>
                  {entry.src ? <img src={entry.src} alt={entry.label || "Icon"} style={{ width: 32, height: 32, objectFit: "contain", display: "block" }} /> : entry.fontFamily && entry.glyph ? renderGridFontIcon({ iconGlyph: entry.glyph, iconFontFamily: entry.fontFamily }, "#e2e8f0", 32) : renderGridLibraryIcon(entry.key, { size: 32, color: "#e2e8f0" })}
                </div>
                <div style={{ display: "grid", gap: 2 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25 }}>{entry.label}</div>
                  <div style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.25 }}>{resolveGridIconLibraryName(entry)}</div>
                </div>
              </button>
            ))}
          </div>
          {!filteredIcons.length ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "#64748b", fontSize: 17 }}>No icons match that search.</div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function isBuiltinGridDecorationAsset(asset) {
  return String(asset?.id || "").startsWith("builtin-deco-");
}

export const LIVE_SERVICES_GRID_PRESET = {
  title: "Our Services",
  columns: 4,
  gridVariant: "services",
  columnBackgroundColor: "#ffffff",
  columnBorderColor: "rgba(148,163,184,0.18)",
  columnTitleColor: "#0f172a",
  columnBodyColor: "#475569",
  columnPadding: 18,
  columnRadius: 22,
  columnShadow: "soft",
  columnGap: 24,
  iconBackgroundColor: "#ffffff",
  iconColor: "#0f172a",
  iconSize: 20,
  imageRadius: 18,
  items: [
    { title: "Social Media", eyebrow: "Content Creation", iconName: "social", content: "", link: "https://gr8result.com/social-media/", image: "/imported/gr8-services/social-media.jpg", imageAlt: "Gr8 Result Digital Solutions.", imageHeight: 150 },
    { title: "Software", eyebrow: "Business Software", iconName: "software", content: "", link: "https://gr8result.com/software/", image: "/imported/gr8-services/software.png", imageAlt: "Gr8 Result Digital Solutions.", imageHeight: 150 },
    { title: "Graphic Arts", eyebrow: "Graphic Design", iconName: "design", content: "", link: "https://gr8result.com/graphic-design/", image: "/imported/gr8-services/graphic-arts.png", imageAlt: "Gr8 Result Digital Solutions.", imageHeight: 150 },
    { title: "Websites", eyebrow: "Design and SEO", iconName: "web", content: "", link: "https://gr8result.com/website-development/", image: "/imported/gr8-services/websites.jpg", imageAlt: "Gr8 Result Digital Solutions.", imageHeight: 150 },
    { title: "Videos", eyebrow: "AI Avatars", iconName: "video", content: "", link: "https://gr8result.com/videos/", image: "/imported/gr8-services/videos.jpg", imageAlt: "Gr8 Result Digital Solutions.", imageHeight: 150 },
    { title: "SEO", eyebrow: "Organic Growth", iconName: "seo", content: "", link: "https://gr8result.com/seo/", image: "/imported/gr8-services/seo.jpg", imageAlt: "Gr8 Result Digital Solutions.", imageHeight: 150 },
    { title: "Email", eyebrow: "Email marketing", iconName: "email", content: "", link: "https://gr8result.com/email-marketing/", image: "/imported/gr8-services/email.jpg", imageAlt: "Gr8 Result Digital Solutions.", imageHeight: 150 },
    { title: "Digital Marketing", eyebrow: "Google & Meta Ads", iconName: "marketing", content: "", link: "https://gr8result.com/branding-design/", image: "/imported/gr8-services/digital-marketing.jpg", imageAlt: "Gr8 Result Digital Solutions.", imageHeight: 150 },
  ],
};

export const SERVICES_STYLE_OPTIONS = [
  { value: "style-01", label: "Style 01" },
  { value: "style-02", label: "Style 02" },
  { value: "style-03", label: "Style 03" },
];

export const SERVICES_COLOR_OPTIONS = [
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
];

export const SERVICES_LAYOUT_OPTIONS = [
  { value: "grid", label: "Grid" },
  { value: "slider", label: "Slider" },
];

export function GridSectionPropertiesPanel({ block, index, onChange, brandAssets, onRefreshAssetLibrary, device = "desktop" }) {
  const props = block?.props || {};
  const [activeTab, setActiveTab] = useState("content");
  const [expandedCardIndex, setExpandedCardIndex] = useState(0);
  const [iconLibraryState, setIconLibraryState] = useState({ itemIndex: null, search: "" });
  const [discoveredIconEntries, setDiscoveredIconEntries] = useState([]);
  const safeItems = normalizeGridSectionItems(props.items);
  const update = (patch) => onChange(index, { ...props, ...patch });
  const updateItem = (itemIndex, patch) => {
    const nextItems = safeItems.map((item, currentIndex) => (
      currentIndex === itemIndex ? { ...item, ...patch } : item
    ));
    update({ items: nextItems });
  };
  const addItem = () => {
    update({
      items: [...safeItems, { icon: "", iconName: "", iconGlyph: "", iconFontFamily: "", iconImage: "", iconAssetId: "", title: `Grid card ${safeItems.length + 1}`, eyebrow: "", content: "Add your supporting detail here.", link: "", image: "", imageAlt: "", imageAssetId: "" }],
    });
    setExpandedCardIndex(safeItems.length);
  };
  const removeItem = (itemIndex) => {
    const nextItems = safeItems.filter((_, currentIndex) => currentIndex !== itemIndex);
    update({ items: nextItems.length ? nextItems : [{ icon: "", iconName: "", iconGlyph: "", iconFontFamily: "", iconImage: "", iconAssetId: "", title: "", eyebrow: "", content: "", link: "", image: "", imageAlt: "", imageAssetId: "" }] });
    setExpandedCardIndex((prev) => (prev === itemIndex ? Math.max(0, itemIndex - 1) : prev));
  };
  const moveItem = (itemIndex, direction) => {
    const targetIndex = itemIndex + direction;
    if (targetIndex < 0 || targetIndex >= safeItems.length) return;
    const nextItems = [...safeItems];
    const [moved] = nextItems.splice(itemIndex, 1);
    nextItems.splice(targetIndex, 0, moved);
    update({ items: nextItems });
    setExpandedCardIndex(targetIndex);
  };
  const updateItemText = (itemIndex, key, value) => {
    updateItem(itemIndex, { [key]: htmlToPlainText(value) });
  };
  const safeItemsRef = useRef(safeItems);
  safeItemsRef.current = safeItems;
  const updateItemRef = useRef(updateItem);
  updateItemRef.current = updateItem;
  const openLibraryFallback = () => {
    if (typeof window === "undefined") return;
    window.open("/assets?view=generic", "_blank", "noopener,noreferrer");
  };
  const openGridImagePicker = (itemIndex) => {
    openSharedMediaPicker({
      view: "generic",
      onPick: (asset) => {
        if (!asset?.src) return;
        updateItemRef.current(itemIndex, {
          image: asset.src || "",
          imageAssetId: asset.id || "",
          imageAlt: htmlToPlainText(asset.name || safeItemsRef.current[itemIndex]?.imageAlt || ""),
        });
      },
      onBlocked: openLibraryFallback,
    });
  };
  const openGridIconLibrary = (itemIndex) => {
    setIconLibraryState({ itemIndex, search: "" });
  };
  const closeGridIconLibrary = () => {
    setIconLibraryState({ itemIndex: null, search: "" });
  };
  const applyGridIcon = (entry) => {
    if (!Number.isInteger(iconLibraryState.itemIndex)) return;
    if (entry?.src) {
      updateItem(iconLibraryState.itemIndex, {
        iconName: "",
        icon: "",
        iconGlyph: "",
        iconFontFamily: "",
        iconImage: String(entry.src || ""),
        iconAssetId: String(entry.assetId || ""),
      });
    } else if (entry?.fontFamily && entry?.glyph) {
      updateItem(iconLibraryState.itemIndex, {
        iconName: "",
        icon: "",
        iconGlyph: String(entry.glyph || ""),
        iconFontFamily: String(entry.fontFamily || ""),
        iconImage: "",
        iconAssetId: "",
      });
    } else {
      updateItem(iconLibraryState.itemIndex, {
        iconName: String(entry?.key || ""),
        icon: "",
        iconGlyph: "",
        iconFontFamily: "",
        iconImage: "",
        iconAssetId: "",
      });
    }
    closeGridIconLibrary();
  };
  const serviceStyleValue = String(props.servicesStylePreset || "style-01");
  const serviceColorValue = String(props.servicesColorPreset || "blue");
  const serviceLayoutValue = String(props.servicesLayoutMode || "grid");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/website-builder/icon-library")
      .then(async (response) => {
        if (!response.ok) return { entries: [] };
        const text = await response.text();
        try {
          return text ? JSON.parse(text) : { entries: [] };
        } catch {
          return { entries: [] };
        }
      })
      .then((payload) => {
        if (cancelled) return;
        setDiscoveredIconEntries(Array.isArray(payload?.entries) ? payload.entries : []);
      })
      .catch(() => {
        if (!cancelled) setDiscoveredIconEntries([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const iconLibraryEntries = useMemo(() => {
    const seen = new Set();
    return [...GRID_ICON_LIBRARY, ...discoveredIconEntries].filter((entry) => {
      const dedupeKey = String(entry?.src || entry?.key || `${entry?.fontFamily || ""}-${entry?.glyph || ""}`);
      if (!dedupeKey || seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    });
  }, [discoveredIconEntries]);

  return (
    <div style={styles.properties}>
      <GridIconLibraryModal
        open={Number.isInteger(iconLibraryState.itemIndex)}
        searchValue={iconLibraryState.search}
        onSearchChange={(value) => setIconLibraryState((current) => ({ ...current, search: value }))}
        onClose={closeGridIconLibrary}
        onSelect={applyGridIcon}
        entries={iconLibraryEntries}
      />
      <h3 style={styles.propertiesTitle}>▦ Edit: Grid Section</h3>
      <div style={styles.tabRow}>
        {[
          { id: "content", label: `Content (${safeItems.length})` },
          { id: "layout", label: "Layout" },
          { id: "colors", label: "Appearance" },
          { id: "animations", label: "Animations" },
        ].map((tab) => (
          <button
            key={`grid-tab-${tab.id}`}
            type="button"
            style={{ ...styles.tabChip, ...(activeTab === tab.id ? styles.tabChipActive : {}) }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={styles.propertyGrid}>
        {activeTab === "layout" ? (
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Section Layout</label>
          <input type="text" value={props.title || ""} onChange={(event) => update({ title: event.target.value })} style={styles.propertyInput} placeholder="Section heading" />
          <button type="button" style={{ ...styles.secondaryBtn, width: "100%", marginTop: 8 }} onClick={() => update({ ...LIVE_SERVICES_GRID_PRESET, backgroundColor: props.backgroundColor || "transparent", textColor: props.textColor || "#0f172a", stretchToCanvas: true })}>Apply Live Services Preset</button>
          <div style={{ ...styles.colorGrid, marginTop: 8 }}>
            <NumberField label="Columns" value={Math.max(1, Math.min(6, Number(props.columns) || 3))} min={1} max={6} onChange={(value) => update({ columns: value })} />
            <NumberField label="Grid Gap" value={Number(props.columnGap ?? 20)} min={0} max={120} onChange={(value) => update({ columnGap: value })} />
            <NumberField label="Top Margin" value={Number(props.columnsTopMargin ?? 18)} min={0} max={240} onChange={(value) => update({ columnsTopMargin: value })} />
            <NumberField label="Block Max Width" value={Number(props.blockMaxWidth) || 1200} min={320} max={1800} onChange={(value) => update({ blockMaxWidth: value })} />
            <ResponsiveNumberField
              label={`Section Height${device !== "desktop" ? ` (${device === "mobile" ? "Mobile" : "Tablet"})` : ""}`}
              props={props}
              baseKey="sectionHeight"
              mirrorKeys={["minHeight"]}
              device={device}
              unit="px"
              min={160}
              max={1400}
              fitContentFallback
              onChange={(nextProps) => onChange(index, nextProps)}
            />
            <NumberField label="Item Min Height" value={Number(props.gridItemMinHeight ?? 0)} min={0} max={1200} onChange={(value) => update({ gridItemMinHeight: value })} />
            <NumberField label="Main Title Size" value={Number(props.cardTitleSize ?? 28)} min={16} max={72} onChange={(value) => update({ cardTitleSize: value })} />
            <NumberField label="Subtitle Size" value={Number(props.eyebrowFontSize ?? 18)} min={12} max={48} onChange={(value) => update({ eyebrowFontSize: value })} />
            <NumberField label="Icon Size" value={Number(props.iconSize ?? 36)} min={14} max={96} onChange={(value) => update({ iconSize: value })} />
          </div>
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input type="checkbox" checked={props.stretchToCanvas !== false} onChange={(event) => update({ stretchToCanvas: event.target.checked })} style={styles.checkboxInput} />
            Stretch services grid edge-to-edge on the canvas
          </label>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Vertical Alignment</label>
          <div style={styles.inlineChipRow}>
            {[
              { value: "top", label: "Top" },
              { value: "center", label: "Center" },
              { value: "bottom", label: "Bottom" },
            ].map((option) => (
              <button key={`grid-align-${option.value}`} type="button" style={{ ...styles.presetChip, ...(String(props.columnsVerticalAlign || "top") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ columnsVerticalAlign: option.value })}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
        ) : null}

        {activeTab === "content" ? (
          <>
        <div style={styles.sectionCard}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={styles.propertyLabel}>Services Styles</label>
              <select
                value={serviceStyleValue}
                onChange={(event) => update({ gridVariant: "services", servicesStylePreset: event.target.value })}
                style={styles.propertyInput}
              >
                {SERVICES_STYLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={styles.propertyLabel}>Color Styles</label>
              <select
                value={serviceColorValue}
                onChange={(event) => update({
                  gridVariant: "services",
                  servicesColorPreset: event.target.value,
                  backgroundColor: "",
                  cardBackgroundColor: "",
                  columnBackgroundColor: "",
                  columnTitleColor: "",
                  columnBodyColor: "",
                  eyebrowColor: "",
                  textColor: "",
                  sectionTitleColor: "",
                  iconBackgroundColor: "",
                  iconColor: "",
                })}
                style={styles.propertyInput}
              >
                {SERVICES_COLOR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div style={styles.colorGrid}>
              <div style={styles.propertyField}>
                <label style={styles.propertyLabel}>Layout</label>
                <select
                  value={serviceLayoutValue}
                  onChange={(event) => update({ gridVariant: "services", servicesLayoutMode: event.target.value })}
                  style={styles.propertyInput}
                >
                  {SERVICES_LAYOUT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div style={styles.propertyField}>
                <label style={styles.propertyLabel}>Grid Column</label>
                <select
                  value={String(Math.max(2, Math.min(5, Number(props.columns) || 4)))}
                  onChange={(event) => update({ columns: Number(event.target.value) || 4 })}
                  style={styles.propertyInput}
                  disabled={serviceLayoutValue === "slider"}
                >
                  {[2, 3, 4, 5].map((count) => <option key={`services-columns-${count}`} value={String(count)}>{`${count} column`}{count > 1 ? "s" : ""}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.sectionCard}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <label style={styles.propertyLabel}>Cards</label>
            <button type="button" style={styles.secondaryBtn} onClick={addItem}>Add New</button>
          </div>
        </div>

        {safeItems.map((item, itemIndex) => {
          const resolvedImage = String(item.image || getAssetFromLibrary(brandAssets, item.imageAssetId)?.src || "");
          const socialIconPreview = renderSocialPlatformIcon(item, { size: 36, color: "#cbd5e1" });
          const socialIconLargePreview = renderSocialPlatformIcon(item, { size: 64, color: "#cbd5e1" });
          const rawResolvedIconImage = String(item.iconImage || getAssetFromLibrary(brandAssets, item.iconAssetId)?.src || "");
          const resolvedIconImage = isUnsafePublishedIconUrl(rawResolvedIconImage) ? "" : rawResolvedIconImage;
          const isOpen = expandedCardIndex === itemIndex;
          return (
            <div key={`grid-item-panel-${itemIndex}`} style={styles.sectionCard}>
              <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => setExpandedCardIndex((prev) => (prev === itemIndex ? -1 : itemIndex))}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "56px 56px minmax(0, 1fr)",
                    gap: 10,
                    alignItems: "center",
                    width: "100%",
                    background: isOpen ? "#223653" : "#1a2940",
                    border: isOpen ? "1px solid #5f84b0" : "1px solid #41577a",
                    borderRadius: 14,
                    padding: 12,
                    cursor: "pointer",
                    textAlign: "left",
                    minWidth: 0,
                    boxShadow: isOpen ? "0 0 0 1px rgba(125,211,252,0.18)" : "none",
                  }}
                >
                  <div style={{ width: 56, height: 56, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(148,163,184,0.28)", background: "#0d1522", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    {resolvedImage ? <img src={resolvedImage} alt={item.imageAlt || item.title || `Card ${itemIndex + 1} image`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 16, fontWeight: 600, color: "#cbd5e1" }}>Image</span>}
                  </div>
                  <div style={{ width: 56, height: 56, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(148,163,184,0.28)", background: "#0d1522", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    {socialIconPreview || (resolvedIconImage ? <img src={resolvedIconImage} alt={item.title || `Card ${itemIndex + 1} icon`} style={{ width: 36, height: 36, objectFit: "contain" }} /> : renderGridEditorIcon(item, "#cbd5e1", 22))}
                  </div>
                  <div style={{ minWidth: 0, display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#f8fafc", lineHeight: 1.3, wordBreak: "break-word", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{htmlToPlainText(item.title || item.eyebrow || `Card ${itemIndex + 1}`)}</div>
                    <div style={{ fontSize: 16, fontWeight: 500, color: "#cbd5e1", lineHeight: 1.35, wordBreak: "break-word", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{htmlToPlainText(item.eyebrow || item.link || "Click to edit this card")}</div>
                  </div>
                </button>
              </div>

              {isOpen ? (
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={{ display: "grid", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => openGridImagePicker(itemIndex)}
                      style={{ display: "grid", gap: 10, padding: 12, borderRadius: 14, background: "#1a2940", border: "1px solid #41577a", textAlign: "left", cursor: "pointer" }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>Image</div>
                      <div style={{ width: "100%", minHeight: 132, borderRadius: 14, border: "1px solid rgba(148,163,184,0.28)", background: "#0d1522", display: "grid", placeItems: "center", overflow: "hidden" }}>
                        {resolvedImage ? <img src={resolvedImage} alt={item.imageAlt || item.title || `Card ${itemIndex + 1} image`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 16, fontWeight: 600, color: "#cbd5e1" }}>Choose image</span>}
                      </div>
                    </button>
                    {resolvedImage ? (
                      <button type="button" style={{ ...styles.secondaryBtn, justifySelf: "start" }} onClick={() => updateItem(itemIndex, { image: "", imageAlt: "", imageAssetId: "" })}>Remove Image</button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => openGridIconLibrary(itemIndex)}
                      style={{ display: "grid", gap: 10, padding: 12, borderRadius: 14, background: "#1a2940", border: "1px solid #41577a", textAlign: "left", cursor: "pointer" }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>Icon</div>
                      <div style={{ width: "100%", minHeight: 132, borderRadius: 14, border: "1px solid rgba(148,163,184,0.28)", background: "#0d1522", display: "grid", placeItems: "center", overflow: "hidden" }}>
                        {socialIconLargePreview || (resolvedIconImage ? <img src={resolvedIconImage} alt={item.title || `Card ${itemIndex + 1} icon`} style={{ width: 64, height: 64, objectFit: "contain" }} /> : renderGridEditorIcon(item, "#cbd5e1", 28))}
                      </div>
                    </button>
                    {resolvedIconImage ? (
                      <button type="button" style={{ ...styles.secondaryBtn, justifySelf: "start" }} onClick={() => updateItem(itemIndex, { iconImage: "", iconAssetId: "", iconName: "", icon: "" })}>Remove Icon</button>
                    ) : null}
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <label style={styles.propertyLabel}>Main Title</label>
                    <input type="text" value={htmlToPlainText(item.title || "")} onChange={(event) => updateItemText(itemIndex, "title", event.target.value)} style={styles.propertyInput} placeholder="Main card title" />
                    <label style={styles.propertyLabel}>Subtitle</label>
                    <input type="text" value={htmlToPlainText(item.eyebrow || "")} onChange={(event) => updateItemText(itemIndex, "eyebrow", event.target.value)} style={styles.propertyInput} placeholder="Subtitle under the title" />
                    <input type="text" value={item.link || ""} onChange={(event) => updateItem(itemIndex, { link: event.target.value })} style={styles.propertyInput} placeholder="https://..." />
                    <input type="text" value={htmlToPlainText(item.imageAlt || "")} onChange={(event) => updateItemText(itemIndex, "imageAlt", event.target.value)} style={styles.propertyInput} placeholder="Image alt text" />
                    <NumberField label="Image Height" value={Number(item.imageHeight ?? 0)} min={0} max={1200} onChange={(value) => updateItem(itemIndex, { imageHeight: value || undefined })} />
                    <textarea value={htmlToPlainText(item.content || "")} onChange={(event) => updateItemText(itemIndex, "content", event.target.value)} style={{ ...styles.propertyInput, minHeight: 112 }} placeholder="Card content" />
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-start" }}>
                    <button type="button" style={styles.secondaryBtn} onClick={() => moveItem(itemIndex, -1)} disabled={itemIndex === 0}>Up</button>
                    <button type="button" style={styles.secondaryBtn} onClick={() => moveItem(itemIndex, 1)} disabled={itemIndex === safeItems.length - 1}>Down</button>
                    <button type="button" style={{ ...styles.secondaryBtn, color: "#ef4444", borderColor: "rgba(239,68,68,0.35)" }} onClick={() => removeItem(itemIndex)}>Remove</button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
          </>
        ) : null}
        {activeTab === "colors" ? (
        <>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Section Background</label>
            <ColorSelector label="Section Background" value={props.backgroundColor || "transparent"} fallback="#0f172a" allowTransparent onChange={(value) => update({ backgroundColor: value })} />
            <ColorSelector label="Section Title Color" value={props.sectionTitleColor || "#f8fafc"} fallback="#f8fafc" onChange={(value) => update({ sectionTitleColor: value })} />
            {props.sectionBackgroundImage ? (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <img src={props.sectionBackgroundImage} alt="Section background" style={{ width: 64, height: 40, objectFit: "cover", borderRadius: 6, border: "1px solid rgba(148,163,184,0.28)", flexShrink: 0 }} />
                <button type="button" style={{ ...styles.secondaryBtn, color: "#ef4444", borderColor: "rgba(239,68,68,0.35)" }} onClick={() => update({ sectionBackgroundImage: "" })}>Clear Background Image</button>
              </div>
            ) : null}
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Card Colors</label>
            <ColorSelector label="Card Background" value={props.cardBackgroundColor || props.columnBackgroundColor || "transparent"} fallback="#1e293b" allowTransparent onChange={(value) => update({ cardBackgroundColor: value, columnBackgroundColor: value })} />
            <ColorSelector label="Card Title Color" value={props.columnTitleColor || "#f8fafc"} fallback="#f8fafc" onChange={(value) => update({ columnTitleColor: value })} />
            <ColorSelector label="Eyebrow / Subtitle Color" value={props.eyebrowColor || "#94a3b8"} fallback="#94a3b8" onChange={(value) => update({ eyebrowColor: value })} />
            <ColorSelector label="Body Text Color" value={props.columnBodyColor || "#cbd5e1"} fallback="#cbd5e1" onChange={(value) => update({ columnBodyColor: value })} />
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Icon Colors</label>
            <ColorSelector label="Icon Background" value={props.iconBackgroundColor || "transparent"} fallback="#0ea5e9" allowTransparent onChange={(value) => update({ iconBackgroundColor: value })} />
            <ColorSelector label="Icon Color" value={props.iconColor || "#38bdf8"} fallback="#38bdf8" onChange={(value) => update({ iconColor: value })} />
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Reset Colors</label>
            <button
              type="button"
              style={{ ...styles.secondaryBtn, width: "100%" }}
              onClick={() => update({
                backgroundColor: "", sectionTitleColor: "", cardBackgroundColor: "",
                columnBackgroundColor: "", columnTitleColor: "", columnBodyColor: "",
                eyebrowColor: "", iconBackgroundColor: "", iconColor: "",
                servicesColorPreset: "blue",
              })}
            >
              Reset to Color Preset Defaults
            </button>
          </div>
        </>
        ) : null}
        {activeTab === "animations" ? (
        <>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Section Entrance</label>
            <select value={String(props.sectionAnimation || "none")} onChange={(event) => update({ sectionAnimation: event.target.value })} style={styles.propertyInput}>
              {ANIMATION_PRESETS.map((preset) => <option key={`grid-section-anim-${preset.value}`} value={preset.value}>{preset.label}</option>)}
            </select>
            <div style={styles.colorGrid}>
              <NumberField label="Delay (s)" value={Number(props.sectionAnimationDelay ?? 0)} min={0} max={4} onChange={(value) => update({ sectionAnimationDelay: Number(value) })} />
              <NumberField label="Speed (s)" value={Number(props.sectionAnimationSpeed ?? 0.8)} min={0.2} max={4} onChange={(value) => update({ sectionAnimationSpeed: Number(value) })} />
            </div>
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Card Item Animation (Stagger)</label>
            <select value={String(props.cardAnimation || props.itemAnimation || "none")} onChange={(event) => update({ cardAnimation: event.target.value, itemAnimation: event.target.value })} style={styles.propertyInput}>
              {ANIMATION_PRESETS.map((preset) => <option key={`grid-card-anim-${preset.value}`} value={preset.value}>{preset.label}</option>)}
            </select>
            <div style={styles.colorGrid}>
              <NumberField label="Stagger Delay (s)" value={Number(props.cardAnimationStagger ?? props.itemAnimationStagger ?? 0.1)} min={0} max={1} onChange={(value) => update({ cardAnimationStagger: Number(value), itemAnimationStagger: Number(value) })} />
              <NumberField label="Speed (s)" value={Number(props.cardAnimationSpeed ?? props.itemAnimationSpeed ?? 0.7)} min={0.2} max={4} onChange={(value) => update({ cardAnimationSpeed: Number(value), itemAnimationSpeed: Number(value) })} />
            </div>
          </div>
        </>
        ) : null}
      </div>
    </div>
  );
}
