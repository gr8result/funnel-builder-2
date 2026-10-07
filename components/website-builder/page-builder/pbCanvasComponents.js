import { buildCtaPageRefs, resolveCtaPageRef, resolvePreferredCtaHref, inferCtaLinkType, normalizePageHref, normalizeHrefByType } from "../../../lib/website-builder/buttonLinks";
import { resolveCtaOpenInNewTab, getSharedTemplateId, getSharedBlockTemplate, getSharedBlockTemplateUsage } from "../../../lib/website-builder/sharedBlockTemplates";
import { useState, useMemo, useRef, useEffect } from "react";
import { GRID_ICON_LIBRARY, renderGridLibraryIcon } from "../gridIconLibrary";
import { styles } from "./pbStyles";
import { stickyNavigationFrameStyle } from "../../../lib/website-builder/stickyNavigationFrame";
import { BlockPreviewBoundary, CanvasBlockPreview, CanvasBlock, DropInsertZone, renderBlockPreview } from "./pbCanvasBlockFrames";
import { renderWebsiteBlock } from "../WebsiteBlockRenderer";
import { BlockDefinitions, BlockTypes } from "../../../lib/website-builder/pageBlockComponents";
import { resolveAssetField } from "../../../lib/website-builder/mediaAssets";
import { isLongTextField, isColorField, ANIMATION_PRESETS, parsePixelValue, openSharedLibraryAssetPicker, AssetLibraryModal, supportsSectionHeight, supportsFullWidthBackground, isFullWidthBackgroundEnabled, normalizeHeroBackgroundModeProps, supportsCopyRegeneration, COPY_TONE_OPTIONS, formatLabel, getSelectOptions, isImageField } from "./pbEditorUtils";
import { NumberField, ResponsiveLayoutPanel, NavbarPropertiesPanel, ImagePropertiesPanel, FeatureListPropertiesPanel, ImageGalleryPropertiesPanel, TeamPropertiesPanel, TestimonialPropertiesPanel, TextPropertiesPanel, NewsletterPropertiesPanel, TrustBadgesPropertiesPanel, StatsPropertiesPanel, FooterPropertiesPanel, PricingTablePropertiesPanel, FAQPropertiesPanel, SplitBlockPropertiesPanel, FeatureAccordionPropertiesPanel, ScrollStackPropertiesPanel, CustomHtmlPropertiesPanel, CompetitorComparisonPropertiesPanel, DividerPropertiesPanel, ColorSelector, ResponsiveNumberField, BlockPresetPicker } from "./pbPropertiesPanels";
import { openSharedMediaPicker } from "../../../lib/openSharedMediaPicker";
import { ImageStackPropertiesPanel } from "./pbImageStackPanel";
import { ContactFormPropertiesPanel } from "./pbContactFormPanel";
import { SideScrollAccordionPropertiesPanel, TemplateShowcasePropertiesPanel, HoverCardsPropertiesPanel, FramerPortfolioPropertiesPanel } from "./pbShowcasePanels";
import { ColumnsPropertiesPanel, getColumnEditorConfigs } from "./pbColumnPanels";
import { GridSectionPropertiesPanel, normalizeGridSectionItems, renderGridFontIcon, resolveGridIconLibraryName, renderGridEditorIcon, GridIconLibraryModal, isBuiltinGridDecorationAsset, LIVE_SERVICES_GRID_PRESET, SERVICES_STYLE_OPTIONS, SERVICES_COLOR_OPTIONS, SERVICES_LAYOUT_OPTIONS } from "./pbGridSectionPanel";
import { resolveVideoHeroUrl, mergeVideoHeroProps } from "../../../lib/website-builder/videoHero";
import { isBlockVisibleOnDevice } from "../../../lib/website-builder/responsiveValue";
import RichText from "../../RichText";

function buildBuilderPageRefs(pages = []) {
  return buildCtaPageRefs(pages);
}

function resolveBuilderPageRefForCta(cta, pages = []) {
  return resolveCtaPageRef(cta, pages);
}

function normalizeBuilderCta(props = {}, pages = []) {
  const legacyHref = props.ctaLink || props.buttonLink || props.link || props.href || "";
  const source = props.cta && typeof props.cta === "object" ? props.cta : {};
  const href = resolvePreferredCtaHref(source.href || "", legacyHref || "", source.linkType || "");
  const pageRef = resolveBuilderPageRefForCta({ ...source, href }, pages);
  const linkType = inferCtaLinkType(href, String(source.linkType || "").trim());
  const selectedPage = linkType === "page" ? pageRef : null;
  const resolvedHref = linkType === "page"
    ? normalizePageHref(href || selectedPage?.href || "")
    : normalizeHrefByType(linkType, href);
  return {
    text: String(source.text || props.buttonText || props.ctaText || "").trim(),
    linkType,
    pageId: selectedPage?.id || (String(source.pageId || "").trim() || null),
    href: resolvedHref,
    newTab: resolveCtaOpenInNewTab(source),
  };
}

function normalizeBuilderButtonLink(props = {}, pages = [], prefix = "primary") {
  const isSecondary = prefix === "secondary";
  const source = isSecondary && props.secondaryCta && typeof props.secondaryCta === "object"
    ? props.secondaryCta
    : !isSecondary && props.cta && typeof props.cta === "object"
      ? props.cta
      : {};
  const text = String(source.text || (isSecondary ? props.secondaryCtaText : props.ctaText || props.buttonText) || "").trim();
  const legacyHref = isSecondary
    ? props.secondaryCtaLink || props.secondaryButtonLink || ""
    : props.ctaLink || props.buttonLink || props.link || props.href || "";
  const href = resolvePreferredCtaHref(source.href || "", legacyHref || "", source.linkType || "");
  const isolatedLegacyProps = {
    ctaLink: legacyHref,
    buttonLink: legacyHref,
  };
  return {
    ...normalizeBuilderCta({ ...isolatedLegacyProps, cta: { ...source, href, text } }, pages),
    text,
  };
}

function MarqueeItemEditor({ item, index, onChange, onRemove, stylesRef }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");

  // Normalize: plain string → { text: item }, object stays as-is
  const norm = item && typeof item === "object" ? item : { text: String(item || "") };
  const currentText = norm.text || "";
  const currentIconKey = norm.iconKey || null;

  const filteredIcons = useMemo(() => {
    const q = iconSearch.toLowerCase();
    if (!q) return GRID_ICON_LIBRARY;
    return GRID_ICON_LIBRARY.filter(
      (e) => e.key.toLowerCase().includes(q) || e.label.toLowerCase().includes(q) || e.group.toLowerCase().includes(q)
    );
  }, [iconSearch]);

  const panelStyle = stylesRef || styles;

  function update(patch) {
    const next = { ...norm, ...patch };
    // Simplify back to string if no icon and it's just text
    if (!next.iconKey && next.text !== undefined && Object.keys(next).filter(k => k !== "text").length === 0) {
      onChange(next.text);
    } else {
      onChange(next);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px", background: "#1e293b", borderRadius: 8, border: "1px solid #334155" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "#94a3b8", fontSize: 16, fontWeight: 600, minWidth: 22 }}>#{index + 1}</span>
        {/* Icon preview / pick button */}
        <button
          type="button"
          title={currentIconKey ? `Icon: ${currentIconKey} — click to change` : "Click to add an icon"}
          onClick={() => { setPickerOpen((v) => !v); setIconSearch(""); }}
          style={{
            width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 6, border: currentIconKey ? "1px solid #6366f1" : "1px dashed #475569",
            background: currentIconKey ? "#1e1b4b" : "#0f172a", cursor: "pointer", color: "#e2e8f0", flexShrink: 0,
          }}
        >
          {currentIconKey
            ? renderGridLibraryIcon(currentIconKey, { size: 16 })
            : <span style={{ fontSize: 16, color: "#475569" }}>+</span>}
        </button>
        {/* Text input */}
        <input
          type="text"
          value={currentText}
          onChange={(e) => update({ text: e.target.value })}
          style={{ ...panelStyle.propertyInput, margin: 0, flex: 1 }}
          placeholder="Item text (optional)"
        />
        {/* Remove icon button */}
        {currentIconKey && (
          <button
            type="button"
            title="Remove icon"
            onClick={() => { update({ iconKey: undefined }); setPickerOpen(false); }}
            style={{ padding: "2px 6px", borderRadius: 4, border: "none", fontSize: 16, cursor: "pointer", background: "#334155", color: "#94a3b8", flexShrink: 0 }}
          >no icon</button>
        )}
        {/* Delete item button */}
        <button
          type="button"
          onClick={onRemove}
          style={{ padding: "2px 6px", borderRadius: 4, border: "none", fontSize: 16, cursor: "pointer", background: "#334155", color: "#f87171", flexShrink: 0 }}
          title="Remove item"
        >✕</button>
      </div>

      {pickerOpen && (
        <div style={{ background: "#0f172a", borderRadius: 8, border: "1px solid #334155", padding: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 16, color: "#94a3b8" }}>Pick an icon</span>
            <button type="button" onClick={() => setPickerOpen(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          <input
            type="search"
            placeholder="Search icons…"
            value={iconSearch}
            onChange={(e) => setIconSearch(e.target.value)}
            style={{ ...panelStyle.propertyInput, margin: "0 0 8px", width: "100%", boxSizing: "border-box" }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 4, maxHeight: 220, overflowY: "auto" }}>
            {filteredIcons.map((entry) => (
              <button
                key={entry.key}
                type="button"
                title={`${entry.label} · ${entry.key}`}
                onClick={() => { update({ iconKey: entry.key }); setPickerOpen(false); setIconSearch(""); }}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 2, padding: 4, borderRadius: 6,
                  border: entry.key === currentIconKey ? "1px solid #6366f1" : "1px solid transparent",
                  background: entry.key === currentIconKey ? "#1e1b4b" : "transparent",
                  cursor: "pointer", color: "#e2e8f0",
                }}
              >
                <span style={{ fontSize: 18, display: "flex", alignItems: "center" }}>
                  {renderGridLibraryIcon(entry.key, { size: 18 })}
                </span>
                <span style={{ fontSize: 16, color: "#64748b", lineHeight: 1.2, textAlign: "center", wordBreak: "break-all" }}>
                  {entry.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GlobalBlockPreview({ label, role, block, brandAssets, compact, device, layoutWidth = null, selected = false, onSelect, onChange, onSaveAsGlobal, onDelete }) {
  if (!block) return null;
  const [hovered, setHovered] = useState(false);
  const showOverlay = selected || hovered;
  const globalLabel = role === "nav" ? "Global Header" : "Global Footer";
  const globalHelp = role === "nav" ? "Changes apply to every page" : "Changes apply to every page";
  const actionBarRef = useRef(null);
  const [actionBarHeight, setActionBarHeight] = useState(42);

  useEffect(() => {
    if (!showOverlay) return undefined;
    const node = actionBarRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => setActionBarHeight(Math.ceil(node.getBoundingClientRect().height || 0));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [showOverlay, compact]);

  return (
    <div
      data-global-block-preview="true"
      data-global-role={role}
      style={{
        ...styles.globalBlockPreviewWrap,
        ...(role === "nav" ? stickyNavigationFrameStyle(block, { editor: true }) : {}),
        ...(selected ? styles.globalBlockPreviewWrapSelected : {}),
      }}
      onPointerDownCapture={() => {
        onSelect?.();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onSelect?.();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {showOverlay ? (
        <div ref={actionBarRef} style={{ ...styles.blockActionBar, ...(compact ? styles.blockActionBarCompact : {}) }} data-builder-block-controls="true">
          <div style={styles.blockActionLeft}>
            <span style={{ ...styles.blockActionLabel, ...(compact ? styles.blockActionLabelCompact : {}) }}>{label}</span>
            {!compact ? (
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0, color: "#bae6fd", opacity: 0.92 }}>
                {globalLabel} · {globalHelp}
              </span>
            ) : null}
          </div>
          <div style={styles.blockActionButtons}>
            <button
              type="button"
              style={{ ...styles.blockActionBtn, ...(compact ? styles.blockActionBtnCompact : {}) }}
              onClick={(event) => {
                event.stopPropagation();
                onSelect?.();
              }}
              title="Edit global block"
            >
              Edit
            </button>
            {!compact ? (
              <button
                type="button"
                style={{ ...styles.blockActionBtn, background: "#1e3a5f", color: "#7dd3fc", border: "1px solid #2563eb", fontSize: 16, padding: "2px 7px" }}
                onClick={(event) => {
                  event.stopPropagation();
                  onSaveAsGlobal?.(block, role);
                }}
                title={`Save as global ${role === "nav" ? "navigation" : "footer"}`}
              >
                📌 {role === "nav" ? "Nav" : "Footer"}
              </button>
            ) : null}
            {!compact ? (
              <span style={{ ...styles.blockActionBtn, cursor: "default", background: "rgba(59,130,246,0.18)", color: "#bfdbfe", border: "1px solid rgba(96,165,250,0.35)" }}>
                {globalLabel}
              </span>
            ) : null}
            <button
              type="button"
              style={{ ...styles.blockActionBtn, ...(compact ? styles.blockActionBtnCompact : {}), background: "#3b0a0a", color: "#fca5a5", border: "1px solid #dc2626" }}
              onClick={(event) => {
                event.stopPropagation();
                if (window.confirm(`Remove the global ${role === "nav" ? "navigation" : "footer"} block?`)) {
                  onDelete?.();
                }
              }}
              title={`Delete global ${role === "nav" ? "navigation" : "footer"}`}
            >
              🗑 Delete
            </button>
          </div>
        </div>
      ) : null}
      <div style={{ ...styles.globalBlockPreviewSurface, ...(showOverlay ? { paddingTop: actionBarHeight + 8 } : {}) }}>
        <BlockPreviewBoundary block={block} label="Global block preview failed">
          {renderWebsiteBlock(block, {
            compact,
            device,
            assets: brandAssets,
            editor: true,
            layoutWidth,
            onChangeBlock: (nextProps) => onChange?.({ ...block, props: nextProps }),
          })}
        </BlockPreviewBoundary>
      </div>
    </div>
  );
}

const PropertiesPanel = ({ block, index, onChange, brandAssets, onUploadImage, onSelectAsset, onOpenImageEditor, onOpenSimpleImageEditor, onRefreshAssetLibrary, project, activePage, currentObjective, onDetachSharedTemplate, device = "desktop" }) => {
  const [regenBusy, setRegenBusy] = useState(false);
  const [regenError, setRegenError] = useState("");
  const [regenTone, setRegenTone] = useState("balanced");
  const [assetBrowser, setAssetBrowser] = useState({ visible: false, fieldKey: "", title: "" });
  const [heroEditorSection, setHeroEditorSection] = useState("layout");
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState("");

  useEffect(() => {
    setRegenBusy(false);
    setRegenError("");
    setAssetBrowser({ visible: false, fieldKey: "", title: "" });
    setHeroEditorSection("layout");
  }, [block?.id, block?.type]);

  if (!block) {
    return (
      <div style={styles.properties}>
        <p style={styles.noSelection}>Select a block to edit properties</p>
      </div>
    );
  }

  const def = BlockDefinitions[block.type];
  const savedImages = Array.isArray(brandAssets?.images) ? brandAssets.images : [];
  const savedVideos = Array.isArray(brandAssets?.videos) ? brandAssets.videos : [];
  const savedLogo = brandAssets?.logo || null;
  const currentBackgroundPreview = resolveAssetField(block?.props || {}, "backgroundImage", brandAssets);
  const isHero = [BlockTypes.HERO, BlockTypes.PARALLAX].includes(block.type);
  const supportsParallaxToggle = [BlockTypes.PARALLAX, BlockTypes.TEXT, BlockTypes.HERO].includes(block.type);
  const heroSections = [
    { id: "layout", label: "Layout" },
    { id: "media", label: "Media" },
    { id: "animations", label: "Animations" },
  ];
  const heroTabBtnStyle = (active) => ({
    ...styles.tabChip,
    ...(active ? styles.tabChipActive : {}),
    fontSize: 16,
    padding: "5px 0",
    textAlign: "center",
    flex: "1 1 0",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
  });
  const heroTabRowBase = { display: "flex", gap: 4, marginBottom: 4 };
  const heroLayoutKeys = new Set(["heroVariant", "spacingScale", "marginTop"]);
  const heroContentKeys = new Set(["headline", "subheadline", "ctaText", "ctaLink", "ctaSubtext", "eyebrow", "tagline", "brand"]);
  const heroAnimationKeys = new Set([
    "sectionAnimation",
    "sectionAnimationDelay",
    "sectionAnimationSpeed",
  ]);
  const sharedTemplateId = getSharedTemplateId(block);
  const sharedTemplate = sharedTemplateId ? getSharedBlockTemplate(project, sharedTemplateId) : null;
  const sharedTemplateUsage = sharedTemplateId ? getSharedBlockTemplateUsage(project, sharedTemplateId) : [];

  function shouldShowHeroPanelSection(sectionId) {
    if (isHero && !heroSections.some((section) => section.id === sectionId)) return false;
    return !isHero || heroEditorSection === sectionId;
  }

  function shouldRenderHeroGenericField(key, value) {
    if (!isHero) return true;
    if (!heroSections.some((section) => section.id === heroEditorSection)) return false;

    if (heroAnimationKeys.has(key) || /animation/i.test(key)) {
      return heroEditorSection === "animations";
    }

    if (heroContentKeys.has(key) || isLongTextField(key) || /^cta/i.test(key)) {
      return heroEditorSection === "layout";
    }

    if (heroLayoutKeys.has(key) || /align/i.test(key) || /layout/i.test(key) || /variant/i.test(key)) {
      return heroEditorSection === "layout";
    }

    if (isColorField(key) || /(font|weight|animation|shadow|border|radius|opacity|background)/i.test(key)) {
      return heroEditorSection === "style";
    }

    if (typeof value === "boolean" || typeof value === "number") {
      return heroEditorSection === "layout";
    }

    return heroEditorSection === "layout";
  }

  function renderAnimationControlCard(label, animationKey, delayKey, speedKey, defaults = {}) {
    return (
      <div style={styles.sectionCard}>
        <label style={styles.propertyLabel}>{label}</label>
        <select
          value={String(block?.props?.[animationKey] || defaults.animation || "none")}
          onChange={(event) => onChange(index, { ...block.props, [animationKey]: event.target.value })}
          style={styles.propertyInput}
        >
          {ANIMATION_PRESETS.map((preset) => (
            <option key={`${animationKey}-${preset.value}`} value={preset.value}>{preset.label}</option>
          ))}
        </select>
        <div style={styles.colorGrid}>
          <NumberField
            label="Delay (s)"
            value={Number(block?.props?.[delayKey] ?? defaults.delay ?? 0)}
            min={0}
            max={4}
            onChange={(value) => onChange(index, { ...block.props, [delayKey]: Number(value) })}
          />
          <NumberField
            label="Speed (s)"
            value={Number(block?.props?.[speedKey] ?? defaults.speed ?? 0.9)}
            min={0.2}
            max={4}
            onChange={(value) => onChange(index, { ...block.props, [speedKey]: Number(value) })}
          />
        </div>
      </div>
    );
  }

  function openAssetBrowser(fieldKey, title) {
    if (["backgroundVideoUrl", "__video_hero_src__", "videoUrl", "videoSrc"].includes(String(fieldKey || ""))) {
      setAssetBrowser({ visible: true, fieldKey, title });
      return;
    }

    const opened = openSharedMediaPicker({
      onPick: (asset) => {
        if (!assetBrowser.fieldKey && !fieldKey) return;
        onSelectAsset(index, fieldKey, asset);
      },
      onBlocked: () => setAssetBrowser({ visible: true, fieldKey, title }),
    });
    if (opened) return;
    setAssetBrowser({ visible: true, fieldKey, title });
  }

  const selectedBrowserImage = assetBrowser.fieldKey ? String(block?.props?.[assetBrowser.fieldKey] || "") : "";
  const isVideoAssetBrowser = ["backgroundVideoUrl", "__video_hero_src__", "videoUrl", "videoSrc"].includes(String(assetBrowser.fieldKey || ""));
  const browserAssets = isVideoAssetBrowser
    ? savedVideos
    : [savedLogo, ...savedImages].filter(Boolean);
  const withResponsiveLayout = (panel) => (
    <>
      <ResponsiveLayoutPanel block={block} index={index} onChange={onChange} device={device} />
      {panel}
    </>
  );

  async function regenerateBlockCopy() {
    if (!block || typeof index !== "number") return;
    setRegenBusy(true);
    setRegenError("");
    try {
      const res = await fetch("/api/website/regenerate-section-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockType: block.type,
          blockProps: block.props || {},
          brief: project?.brief || {},
          projectName: project?.name || "",
          pageName: activePage || "",
          pageObjective: currentObjective || "",
          tone: regenTone,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setRegenError(json?.error || "Could not regenerate copy");
        return;
      }

      if (!json?.patch || typeof json.patch !== "object" || !Object.keys(json.patch).length) {
        setRegenError("No copy changes returned. Try again.");
        return;
      }

      onChange(index, { ...block.props, ...json.patch });
    } catch (e) {
      setRegenError(e?.message || "Could not regenerate copy");
    } finally {
      setRegenBusy(false);
    }
  }

  if (block.type === BlockTypes.NAV_BAR) {
    return withResponsiveLayout(
      <NavbarPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onSelectAsset={onSelectAsset}
        pages={project?.pages || []}
        device={device}
      />
    );
  }

  if (block.type === BlockTypes.IMAGE_STACK) {
    return withResponsiveLayout(
      <ImageStackPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
      />
    );
  }

  if (block.type === BlockTypes.IMAGE) {
    return withResponsiveLayout(
      <ImagePropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onSelectAsset={onSelectAsset}
        onOpenImageEditor={onOpenSimpleImageEditor || onOpenImageEditor}
      />
    );
  }

  if (block.type === BlockTypes.FEATURE_LIST) {
    return withResponsiveLayout(
      <FeatureListPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onOpenImageEditor={onOpenImageEditor}
      />
    );
  }

  if (block.type === BlockTypes.IMAGE_GALLERY) {
    return withResponsiveLayout(
      <ImageGalleryPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onOpenImageEditor={onOpenImageEditor}
      />
    );
  }

  if (block.type === BlockTypes.TEAM) {
    return withResponsiveLayout(
      <TeamPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onOpenImageEditor={onOpenImageEditor}
        onUploadImage={onUploadImage}
      />
    );
  }

  if (block.type === BlockTypes.TESTIMONIAL) {
    return withResponsiveLayout(
      <TestimonialPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
      />
    );
  }

  if (block.type === BlockTypes.TEXT) {
    return withResponsiveLayout(
      <TextPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onSelectAsset={onSelectAsset}
      />
    );
  }

  if (block.type === BlockTypes.NEWSLETTER) {
    return withResponsiveLayout(
      <NewsletterPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
      />
    );
  }

  if (block.type === BlockTypes.TRUST_BADGES) {
    return withResponsiveLayout(
      <TrustBadgesPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onSelectAsset={onSelectAsset}
      />
    );
  }

  if (block.type === BlockTypes.STATS) {
    return withResponsiveLayout(
      <StatsPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
      />
    );
  }

  if (block.type === BlockTypes.FOOTER) {
    return withResponsiveLayout(
      <FooterPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onOpenSimpleImageEditor={onOpenSimpleImageEditor || onOpenImageEditor}
        project={project}
        device={device}
      />
    );
  }

  const pageRefsForLinks = buildBuilderPageRefs(project?.pages || []);
  const canonicalCta = normalizeBuilderCta(block?.props || {}, project?.pages || []);
  const primaryHeroCta = normalizeBuilderButtonLink(block?.props || {}, project?.pages || [], "primary");
  const secondaryHeroCta = normalizeBuilderButtonLink(block?.props || {}, project?.pages || [], "secondary");
  function updateCanonicalCta(patch) {
    const nextCta = { ...canonicalCta, ...patch };
    if (nextCta.linkType === "page") {
      const page = pageRefsForLinks.find((entry) => entry.id === nextCta.pageId) || null;
      nextCta.pageId = page?.id || (String(nextCta.pageId || "").trim() || null);
      nextCta.href = normalizeHrefByType("page", nextCta.href || page?.href || "");
    } else if (nextCta.linkType === "none") {
      nextCta.pageId = null;
      nextCta.href = "";
    } else {
      nextCta.pageId = null;
      nextCta.href = normalizeHrefByType(nextCta.linkType, nextCta.href || "");
    }
    onChange(index, {
      ...block.props,
      cta: nextCta,
      ctaText: nextCta.text,
      buttonText: nextCta.text,
      ctaLink: nextCta.href,
      buttonLink: nextCta.href,
    });
  }

  function normalizeCtaPatch(nextCta) {
    const normalized = { ...nextCta };
    if (normalized.linkType === "page") {
      const page = pageRefsForLinks.find((entry) => entry.id === normalized.pageId) || null;
      normalized.pageId = page?.id || (String(normalized.pageId || "").trim() || null);
      normalized.href = normalizeHrefByType("page", normalized.href || page?.href || "");
    } else if (normalized.linkType === "none") {
      normalized.pageId = null;
      normalized.href = "";
    } else {
      normalized.pageId = null;
      normalized.href = normalizeHrefByType(normalized.linkType, normalized.href || "");
    }
    return normalized;
  }

  function updateHeroButtonCta(slot, patch) {
    const isSecondary = slot === "secondary";
    const current = isSecondary ? secondaryHeroCta : primaryHeroCta;
    const nextCta = normalizeCtaPatch({ ...current, ...patch });
    if (isSecondary) {
      onChange(index, {
        ...block.props,
        secondaryCta: nextCta,
        secondaryCtaText: nextCta.text,
        secondaryCtaLink: nextCta.href,
        secondaryCtaNewTab: nextCta.newTab,
      });
      return;
    }
    onChange(index, {
      ...block.props,
      cta: nextCta,
      ctaText: nextCta.text,
      buttonText: nextCta.text,
      ctaLink: nextCta.href,
      buttonLink: nextCta.href,
      ctaNewTab: nextCta.newTab,
    });
  }

  function renderHeroButtonLinkControls(label, ctaValue, slot) {
    const hrefInputValue = ctaValue.linkType === "email"
      ? String(ctaValue.href || "").replace(/^mailto:/i, "")
      : ctaValue.linkType === "tel"
        ? String(ctaValue.href || "").replace(/^tel:/i, "")
        : ctaValue.href;
    return (
      <div style={styles.linkRowCard}>
        <label style={styles.propertyLabel}>{label}</label>
        <input
          type="text"
          value={ctaValue.text}
          onChange={(e) => updateHeroButtonCta(slot, { text: e.target.value })}
          style={styles.propertyInput}
          placeholder="Button text"
        />
        <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Link Type</label>
        <select
          value={ctaValue.linkType}
          onChange={(e) => updateHeroButtonCta(slot, { linkType: e.target.value })}
          style={styles.propertyInput}
        >
          <option value="page">Page / URL</option>
          <option value="external">External URL</option>
          <option value="anchor">Anchor / Section</option>
          <option value="email">Email</option>
          <option value="tel">Phone</option>
          <option value="none">No Link</option>
        </select>
        {ctaValue.linkType === "page" ? (
          <>
            <input
              type="text"
              value={ctaValue.href}
              onChange={(e) => {
                const rawHref = e.target.value;
                const normalizedHref = normalizeHrefByType("page", rawHref);
                const matchedPage = pageRefsForLinks.find((page) => page.href === normalizedHref) || null;
                updateHeroButtonCta(slot, {
                  linkType: "page",
                  href: rawHref,
                  pageId: matchedPage?.id || null,
                });
              }}
              style={{ ...styles.propertyInput, marginTop: 8 }}
              placeholder="/contact"
            />
            <select
              value={ctaValue.pageId || ""}
              onChange={(e) => {
                const selected = pageRefsForLinks.find((page) => page.id === e.target.value) || null;
                updateHeroButtonCta(slot, {
                  linkType: "page",
                  pageId: selected?.id || null,
                  href: selected?.href || ctaValue.href,
                });
              }}
              style={{ ...styles.propertyInput, marginTop: 8 }}
            >
              <option value="">Custom URL</option>
              {pageRefsForLinks.map((page) => (
                <option key={`${slot}-hero-page-${page.id}`} value={page.id}>{`${page.label} (${page.href})`}</option>
              ))}
            </select>
          </>
        ) : ctaValue.linkType !== "none" ? (
          <input
            type={ctaValue.linkType === "email" ? "email" : ctaValue.linkType === "external" ? "url" : "text"}
            value={hrefInputValue}
            onChange={(e) => updateHeroButtonCta(slot, { href: e.target.value })}
            style={{ ...styles.propertyInput, marginTop: 8 }}
            placeholder={ctaValue.linkType === "anchor" ? "#contact" : ctaValue.linkType === "email" ? "hello@example.com" : ctaValue.linkType === "tel" ? "+61400000000" : "https://example.com"}
          />
        ) : null}
        <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
          <input
            type="checkbox"
            checked={!!ctaValue.newTab}
            onChange={(e) => updateHeroButtonCta(slot, { newTab: e.target.checked })}
            style={styles.checkboxInput}
            disabled={ctaValue.linkType === "none"}
          />
          Open in new tab
        </label>
      </div>
    );
  }

  if (block.type === BlockTypes.PLATFORM_PRICING_PLANS) {
    const platformProps = block.props || {};
    const updatePlatformPricing = (patch) => onChange(index, { ...platformProps, ...patch });
    return withResponsiveLayout(
      <div style={styles.properties}>
        <h3 style={styles.propertiesTitle}>💳 Platform Pricing Plans</h3>
        <div style={styles.propertyGrid}>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Locked Billing Source</label>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 14, lineHeight: 1.55 }}>
              This block renders the same platform plan cards as /billing. Plan names, prices, badges, quotas, add-ons, and annual billing math update from the shared billing pricing source.
            </p>
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Section Title</label>
            <input
              type="text"
              value={String(platformProps.title || "")}
              onChange={(event) => updatePlatformPricing({ title: event.target.value })}
              style={styles.propertyInput}
            />
            <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Subtitle</label>
            <textarea
              value={String(platformProps.subtitle || "")}
              onChange={(event) => updatePlatformPricing({ subtitle: event.target.value })}
              style={{ ...styles.propertyInput, minHeight: 74, resize: "vertical" }}
            />
            <label style={{ ...styles.propertyLabel, marginTop: 10 }}>CTA label</label>
            <input
              type="text"
              value={String(platformProps.ctaLabel || "Start Free Trial")}
              onChange={(event) => updatePlatformPricing({ ctaLabel: event.target.value })}
              style={styles.propertyInput}
            />
            <label style={{ ...styles.inlineToggle, marginTop: 10 }}>
              <input
                type="checkbox"
                checked={platformProps.showAddOns !== false}
                onChange={(event) => updatePlatformPricing({ showAddOns: event.target.checked })}
                style={styles.checkboxInput}
              />
              Show optional add-ons
            </label>
          </div>
        </div>
      </div>
    );
  }

  if (block.type === BlockTypes.PRICING_TABLE) {
    return withResponsiveLayout(
      <PricingTablePropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        onUploadImage={onUploadImage}
      />
    );
  }

  if (block.type === BlockTypes.CONTACT_FORM) {
    return withResponsiveLayout(
      <ContactFormPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onSelectAsset={onSelectAsset}
      />
    );
  }

  if ([BlockTypes.FAQ, BlockTypes.ACCORDION].includes(block.type)) {
    return withResponsiveLayout(
      <FAQPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onSelectAsset={onSelectAsset}
      />
    );
  }

  if (block.type === BlockTypes.SPLIT_BLOCK) {
    return withResponsiveLayout(
      <SplitBlockPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onSelectAsset={onSelectAsset}
      />
    );
  }

  if (block.type === BlockTypes.FEATURE_ACCORDION) {
    return withResponsiveLayout(
      <FeatureAccordionPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        device={device}
      />
    );
  }

  if (block.type === BlockTypes.SIDE_SCROLL_ACCORDION) {
    return withResponsiveLayout(<SideScrollAccordionPropertiesPanel block={block} index={index} onChange={onChange} />);
  }

  if (block.type === BlockTypes.SCROLL_STACK) {
    return withResponsiveLayout(
      <ScrollStackPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        onUploadImage={onUploadImage}
        device={device}
      />
    );
  }

  if (block.type === BlockTypes.CUSTOM_HTML) {
    return withResponsiveLayout(<CustomHtmlPropertiesPanel block={block} index={index} onChange={onChange} />);
  }

  if (block.type === BlockTypes.COMPETITOR_COMPARISON) {
    return withResponsiveLayout(<CompetitorComparisonPropertiesPanel block={block} index={index} onChange={onChange} />);
  }

  if (block.type === BlockTypes.DIVIDER) {
    return withResponsiveLayout(<DividerPropertiesPanel block={block} index={index} onChange={onChange} />);
  }

  if (block.type === BlockTypes.SPACE) {
    const spacerPx   = parsePixelValue(block.props?.height, 40);
    const p          = block.props || {};
    const bgStyle    = p.backgroundStyle || "none";
    const updateSpacer = (patch) => onChange(index, { ...p, ...patch });
    return withResponsiveLayout(
      <div style={styles.properties}>
        <h3 style={styles.propertiesTitle}>⬆️ Edit: Spacer</h3>
        <div style={styles.propertyGrid}>

          {/* ── Size ── */}
          <div style={styles.sectionCard}>
            <NumberField label="Height (px)" value={spacerPx} min={4} max={600} onChange={(value) => updateSpacer({ height: `${value}px` })} />
            <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
              <input
                type="checkbox"
                checked={p.fullWidthBackground === true}
                onChange={(e) => updateSpacer({ fullWidthBackground: e.target.checked })}
                style={styles.checkboxInput}
              />
              Full width
            </label>
          </div>

          {/* ── Background type selector ── */}
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Background</label>
            <select
              value={bgStyle}
              onChange={(e) => updateSpacer({ backgroundStyle: e.target.value })}
              style={styles.propertyInput}
            >
              <option value="none">None (transparent)</option>
              <option value="color">Solid colour</option>
              <option value="gradient">Gradient</option>
              <option value="image">Image</option>
            </select>
          </div>

          {/* ── Solid colour ── */}
          {bgStyle === "color" && (
            <div style={styles.sectionCard}>
              <ColorSelector
                label="Background Colour"
                value={p.backgroundColor || "#ffffff"}
                fallback="#ffffff"
                allowTransparent
                onChange={(v) => updateSpacer({ backgroundColor: v })}
              />
            </div>
          )}

          {/* ── Gradient ── */}
          {bgStyle === "gradient" && (
            <div style={styles.sectionCard}>
              <label style={styles.propertyLabel}>CSS Gradient</label>
              <input
                type="text"
                value={p.backgroundGradient || ""}
                onChange={(e) => updateSpacer({ backgroundGradient: e.target.value })}
                style={styles.propertyInput}
                placeholder="e.g. linear-gradient(135deg,#0f172a,#1e3a5f)"
              />
              <p style={styles.aiHint}>Paste any CSS gradient — linear, radial, or conic.</p>
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {[
                  "linear-gradient(135deg,#0f172a,#1e3a5f)",
                  "linear-gradient(90deg,#7c3aed,#3b82f6)",
                  "linear-gradient(180deg,#f59e0b,#ef4444)",
                  "radial-gradient(circle,#1e293b,#0f172a)",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    style={{ ...styles.secondaryBtn, background: preset, color: "#fff", fontSize: 13, textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                    onClick={() => updateSpacer({ backgroundGradient: preset })}
                  >
                    {preset.split("(")[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Image ── */}
          {bgStyle === "image" && (
            <div style={styles.sectionCard}>
              <label style={styles.propertyLabel}>Background Image</label>
              {p.backgroundImage && (
                <div style={{ marginBottom: 8 }}>
                  <img src={p.backgroundImage} alt="Spacer background" style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid rgba(148,163,184,0.24)" }} />
                </div>
              )}
              <div style={styles.assetPicker}>
                <label style={styles.assetUploadCta}>
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    style={styles.hiddenInput}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      onUploadImage(index, "backgroundImage", file);
                    }}
                  />
                </label>
                <button
                  type="button"
                  style={styles.secondaryBtn}
                  onClick={() => openSharedLibraryAssetPicker((asset) => onSelectAsset(index, "backgroundImage", asset))}
                >
                  Library
                </button>
                {p.backgroundImage && (
                  <button
                    type="button"
                    style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }}
                    onClick={() => updateSpacer({ backgroundImage: "", backgroundImageAssetId: undefined })}
                  >
                    Remove
                  </button>
                )}
              </div>
              <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Image Size</label>
              <select
                value={p.backgroundSize || "cover"}
                onChange={(e) => updateSpacer({ backgroundSize: e.target.value })}
                style={styles.propertyInput}
              >
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="auto">Auto</option>
              </select>
              <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Image Position</label>
              <select
                value={p.backgroundPosition || "center center"}
                onChange={(e) => updateSpacer({ backgroundPosition: e.target.value })}
                style={styles.propertyInput}
              >
                <option value="center center">Centre</option>
                <option value="top center">Top</option>
                <option value="bottom center">Bottom</option>
                <option value="left center">Left</option>
                <option value="right center">Right</option>
              </select>
            </div>
          )}

        </div>
      </div>
    );
  }

  if ([BlockTypes.COLUMNS_2, BlockTypes.COLUMNS_3].includes(block.type)) {
    return withResponsiveLayout(
      <ColumnsPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onSelectAsset={onSelectAsset}
        onOpenImageEditor={onOpenSimpleImageEditor || onOpenImageEditor}
      />
    );
  }

  if (block.type === BlockTypes.GRID_SECTION) {
    return withResponsiveLayout(
      <GridSectionPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onRefreshAssetLibrary={onRefreshAssetLibrary}
        device={device}
      />
    );
  }

  if (block.type === BlockTypes.TEMPLATE_SHOWCASE) {
    return withResponsiveLayout(<TemplateShowcasePropertiesPanel block={block} index={index} onChange={onChange} />);
  }

  if (block.type === BlockTypes.HOVER_CARDS) {
    return withResponsiveLayout(<HoverCardsPropertiesPanel block={block} index={index} onChange={onChange} onUploadImage={onUploadImage} />);
  }

  if (block.type === BlockTypes.FRAMER_PORTFOLIO) {
    return withResponsiveLayout(<FramerPortfolioPropertiesPanel block={block} index={index} onChange={onChange} onUploadImage={onUploadImage} />);
  }

  if (block.type === BlockTypes.VIDEO_HERO) {
    const vp = block.props || {};
    const canonicalVideoUrl = String(resolveVideoHeroUrl(vp) || "");
    const canonicalPosterUrl = String(vp.posterUrl || vp.posterSrc || vp.posterURL || "");
    const updateVH = (patch, options = {}) => onChange(index, mergeVideoHeroProps(vp, patch, options));
    const applyVHOption = (patch) => (event) => {
      event.preventDefault();
      event.stopPropagation();
      updateVH(patch);
    };
    const vhHeight = String(vp.heightMode || "full");
    const vhFixed  = Number(vp.minHeight) || 620;
    const vhAutoplay = vp.autoplay !== false;
    const vhMuted = vp.muted !== false;
    const vhLoop = vp.loop !== false;
    const vhShowControls = vp.showControls === true || vp.controls === true;
    const vhStartWithAudio = vp.startWithAudio === true || vp.playAudioOnInteraction === true || vp.unmuteOnScroll === true;
    const vhOverlayOpacity = Number(vp.overlayOpacity ?? 0.42);
    const vhObjectFit  = String(vp.objectFit || "cover");
    const vhObjectPos  = String(vp.objectPosition || "top center");
    const vhPadTop     = Number(vp.paddingTop ?? 0);
    const vhPadBottom  = Number(vp.paddingBottom ?? 0);

    const handleVideoUpload = async (file) => {
      if (!file) return;
      setVideoUploading(true);
      setVideoUploadError("");
      try {
        const asset = await Promise.resolve(onUploadImage?.(index, "__video_hero_src__", file));
        if (asset?.src) {
          updateVH({
            videoUrl: asset.src,
            videoStoragePath: asset.storagePath || vp.videoStoragePath || "",
            videoMimeType: asset.type || file.type || "",
            videoFileName: asset.name || file.name || "",
            videoUpdatedAt: new Date().toISOString(),
          });
        } else {
          setVideoUploadError("Upload failed — server returned no URL. Check file format and size.");
        }
      } catch (err) {
        setVideoUploadError(err?.message || "Upload failed. Please try again.");
      } finally {
        setVideoUploading(false);
      }
    };
    const handlePosterUpload = async (file) => {
      if (!file) return;
      const asset = await Promise.resolve(onUploadImage?.(index, "__video_hero_poster__", file));
      if (asset?.src) updateVH({ posterUrl: asset.src });
    };

    return withResponsiveLayout(
      <div style={styles.properties}>
        <h3 style={styles.propertiesTitle}>🎬 Edit: Video Hero</h3>
        <div style={styles.propertyGrid}>

          {/* ── Media ── */}
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Video File</label>
            {videoUploadError ? (
              <div style={{ color: "#f87171", fontSize: 12, padding: "6px 0", wordBreak: "break-word" }}>⚠ {videoUploadError}</div>
            ) : null}
            {videoUploading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", color: "#7dd3fc", fontSize: 13 }}>
                <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #7dd3fc", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                Uploading video to CDN…
              </div>
            ) : canonicalVideoUrl ? (
              <video
                src={canonicalVideoUrl}
                poster={canonicalPosterUrl || undefined}
                muted={vhMuted}
                autoPlay={vhAutoplay}
                loop={vhLoop}
                controls={vhShowControls}
                playsInline
                preload={vhAutoplay ? "auto" : "metadata"}
                style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 6, display: "block", marginBottom: 8, background: "#000" }} />
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ ...styles.assetUploadCta, cursor: videoUploading ? "not-allowed" : "pointer", opacity: videoUploading ? 0.5 : 1 }}>
                📹 {videoUploading ? "Uploading…" : canonicalVideoUrl ? "Replace Video" : "Upload Video"}
                <input type="file" accept="video/mp4,video/webm,video/ogg,video/*" style={styles.hiddenInput} disabled={videoUploading}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleVideoUpload(f); }} />
              </label>
              {canonicalVideoUrl && !videoUploading ? (
                <button type="button" style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }}
                  onClick={() => updateVH({ videoUrl: "" }, { removeVideo: true })}>Remove</button>
              ) : null}
            </div>
          </div>

          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Poster / Thumbnail</label>
            {canonicalPosterUrl ? (
              <img src={canonicalPosterUrl} alt="poster" style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 6, display: "block", marginBottom: 8 }} />
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ ...styles.assetUploadCta, cursor: "pointer" }}>
                🖼️ {canonicalPosterUrl ? "Replace Poster" : "Upload Poster"}
                <input type="file" accept="image/*" style={styles.hiddenInput}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handlePosterUpload(f); }} />
              </label>
              {canonicalPosterUrl ? (
                <button type="button" style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }}
                  onClick={() => updateVH({ posterUrl: "" })}>Remove</button>
              ) : null}
            </div>
          </div>

          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Playback</label>
            <div style={{ display: "grid", gap: 10 }}>
              <label style={styles.inlineToggle}>
                <input type="checkbox" checked={vhAutoplay} onChange={(e) => updateVH({ autoplay: e.target.checked })} style={styles.checkboxInput} />
                Autoplay
              </label>
              <label style={styles.inlineToggle}>
                <input type="checkbox" checked={vhMuted} onChange={(e) => updateVH({ muted: e.target.checked })} style={styles.checkboxInput} />
                Muted
              </label>
              <label style={styles.inlineToggle}>
                <input type="checkbox" checked={vhLoop} onChange={(e) => updateVH({ loop: e.target.checked })} style={styles.checkboxInput} />
                Loop
              </label>
              <label style={styles.inlineToggle}>
                <input type="checkbox" checked={vhShowControls} onChange={(e) => updateVH({ showControls: e.target.checked, controls: e.target.checked })} style={styles.checkboxInput} />
                Show controls
              </label>
              <label style={styles.inlineToggle}>
                <input
                  type="checkbox"
                  checked={vhStartWithAudio}
                  onChange={(e) => updateVH({ startWithAudio: e.target.checked, playAudioOnInteraction: e.target.checked, unmuteOnScroll: e.target.checked })}
                  style={styles.checkboxInput}
                />
                Start with audio when allowed
              </label>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.45, color: "#64748b" }}>
              Browsers usually block autoplay with sound until the visitor interacts with the page. Use muted autoplay for the most reliable loading, or enable audio after interaction when the browser allows it.
            </p>
          </div>

          {/* ── Text overlay ── */}
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Text Overlay</label>
            <label style={{ ...styles.propertyLabel, fontWeight: 400 }}>Eyebrow</label>
            <input value={String(vp.eyebrow || "")} onChange={(e) => updateVH({ eyebrow: e.target.value })} placeholder="Optional eyebrow label" style={styles.propertyInput} />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Headline</label>
            <input value={String(vp.title || "")} onChange={(e) => updateVH({ title: e.target.value })} placeholder="Hero headline" style={styles.propertyInput} />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Subheadline</label>
            <input value={String(vp.subtitle || "")} onChange={(e) => updateVH({ subtitle: e.target.value })} placeholder="Supporting sentence" style={styles.propertyInput} />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>CTA Button Text</label>
            <input value={String(vp.ctaText || "")} onChange={(e) => updateVH({ ctaText: e.target.value })} placeholder="Leave blank to hide" style={styles.propertyInput} />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>CTA URL</label>
            <input value={String(vp.ctaUrl || "")} onChange={(e) => updateVH({ ctaUrl: e.target.value })} placeholder="#" style={styles.propertyInput} />
            <div style={{ marginTop: 10, display: "flex", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#94a3b8", cursor: "pointer" }}>
                <input type="checkbox" checked={vp.showText !== false} onChange={(e) => updateVH({ showText: e.target.checked })} />
                Show text overlay
              </label>
            </div>
          </div>

          {/* ── Overlay / Colours ── */}
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Overlay &amp; Colours</label>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#94a3b8" }}>
                Overlay colour
                <input type="color" value={String(vp.overlayColor || "#000000")} onChange={(e) => updateVH({ overlayColor: e.target.value })}
                  style={{ width: 28, height: 28, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#94a3b8" }}>
                Accent
                <input type="color" value={String(vp.accentColor || "#6366f1")} onChange={(e) => updateVH({ accentColor: e.target.value })}
                  style={{ width: 28, height: 28, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#94a3b8" }}>
                Text colour
                <input type="color" value={String(vp.textColor || "#ffffff")} onChange={(e) => updateVH({ textColor: e.target.value })}
                  style={{ width: 28, height: 28, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }} />
              </label>
            </div>
            <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Overlay Opacity</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="range" min={0} max={0.9} step={0.01} value={vhOverlayOpacity}
                onChange={(e) => updateVH({ overlayOpacity: parseFloat(e.target.value) })} style={{ flex: 1 }} />
              <span style={{ fontSize: 13, color: "#64748b", minWidth: 36 }}>{Math.round(vhOverlayOpacity * 100)}%</span>
            </div>
          </div>

          {/* ── Height & sizing ── */}
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Height</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[["full", "Full screen"], ["fixed", "Fixed px"]].map(([m, label]) => (
                <button key={m} type="button"
                  style={{ ...styles.secondaryBtn, ...(vhHeight === m ? { background: "rgba(99,102,241,0.15)", borderColor: "rgba(99,102,241,0.5)", color: "#818cf8" } : {}) }}
                  onMouseDown={applyVHOption({ heightMode: m })}>{label}</button>
              ))}
            </div>
            <select value={vhHeight} onChange={(event) => updateVH({ heightMode: event.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }}>
              <option value="full">Full screen</option>
              <option value="fixed">Fixed px</option>
            </select>
            {vhHeight === "fixed" ? (
              <div style={{ marginTop: 8 }}>
                <NumberField label="Height (px)" value={vhFixed} min={200} max={1200} onChange={(v) => updateVH({ minHeight: v })} />
              </div>
            ) : null}

            <label style={{ ...styles.propertyLabel, marginTop: 12 }}>Object Fit</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["cover", "contain"].map((fit) => (
                <button key={fit} type="button"
                  style={{ ...styles.secondaryBtn, ...(vhObjectFit === fit ? { background: "rgba(99,102,241,0.15)", borderColor: "rgba(99,102,241,0.5)", color: "#818cf8" } : {}) }}
                  onMouseDown={applyVHOption({ objectFit: fit })}>{fit}</button>
              ))}
            </div>
            <select value={vhObjectFit} onChange={(event) => updateVH({ objectFit: event.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }}>
              <option value="cover">cover</option>
              <option value="contain">contain</option>
            </select>

            <label style={{ ...styles.propertyLabel, marginTop: 12 }}>Video Position</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[["top center", "Top"], ["center center", "Mid"], ["bottom center", "Bottom"]].map(([val, label]) => (
                <button key={val} type="button"
                  style={{ ...styles.secondaryBtn, ...(vhObjectPos === val ? { background: "rgba(99,102,241,0.15)", borderColor: "rgba(99,102,241,0.5)", color: "#818cf8" } : {}) }}
                  onMouseDown={applyVHOption({ objectPosition: val })}>{label}</button>
              ))}
            </div>
            <select value={vhObjectPos} onChange={(event) => updateVH({ objectPosition: event.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }}>
              <option value="top center">Top</option>
              <option value="center center">Middle</option>
              <option value="bottom center">Bottom</option>
            </select>
          </div>

          {/* ── Spacing ── */}
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Spacing</label>
            <div style={styles.colorGrid}>
              <NumberField label="Margin Top (px)" value={Number(vp.marginTop ?? 0)} min={0} max={400} onChange={(v) => updateVH({ marginTop: v })} />
              <NumberField label="Padding Top (px)" value={vhPadTop} min={0} max={400} onChange={(v) => updateVH({ paddingTop: v })} />
              <NumberField label="Padding Bottom (px)" value={vhPadBottom} min={0} max={400} onChange={(v) => updateVH({ paddingBottom: v })} />
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#64748b" }}>
              Use <strong style={{ color: "#94a3b8" }}>Margin Top</strong> to push the block below a fixed nav bar. Use <strong style={{ color: "#94a3b8" }}>Padding Top</strong> to shift text content down within the video.
            </p>
          </div>

        </div>
      </div>
    );
  }

  if (block.type === BlockTypes.MARQUEE_STRIP) {
    const safeItems = Array.isArray(block.props?.items) ? block.props.items : [];
    const marqueeProps = block.props || {};
    const updateMarquee = (patch) => onChange(index, { ...marqueeProps, ...patch });
    return withResponsiveLayout(
      <div style={styles.properties}>
        <h3 style={styles.propertiesTitle}>🎞 Edit: {def?.name}</h3>
        <div style={styles.propertyGrid}>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Marquee Items</label>
            <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 16 }}>Each item can be text or an icon. Text items can also be edited inline on the canvas.</p>
            <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              {safeItems.map((item, itemIndex) => (
                <MarqueeItemEditor
                  key={`marquee-item-${itemIndex}`}
                  item={item}
                  index={itemIndex}
                  onChange={(newItem) => {
                    const nextItems = safeItems.map((e, i) => i === itemIndex ? newItem : e);
                    updateMarquee({ items: nextItems });
                  }}
                  onRemove={() => updateMarquee({ items: safeItems.filter((_, i) => i !== itemIndex) })}
                  stylesRef={styles}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => updateMarquee({ items: [...safeItems, `New message ${safeItems.length + 1}`] })}
              >
                + Add Item
              </button>
            </div>
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Marquee Style</label>
            <div style={styles.colorGrid}>
              <NumberField label="Speed (s)" value={Number(marqueeProps.speed || 24)} min={10} max={80} onChange={(value) => updateMarquee({ speed: value })} />
              <NumberField label="Text Size" value={Number(marqueeProps.fontSize || 16)} min={10} max={48} onChange={(value) => updateMarquee({ fontSize: value })} />
              <NumberField label="Outline Width" value={Number(marqueeProps.textStrokeWidth || 0)} min={0} max={8} onChange={(value) => updateMarquee({ textStrokeWidth: value })} />
              <NumberField label="Divider Size" value={Number(marqueeProps.dividerSize || 14)} min={8} max={48} onChange={(value) => updateMarquee({ dividerSize: value })} />
              <NumberField label="Angle" value={Number(marqueeProps.angle ?? 0)} min={-45} max={45} onChange={(value) => updateMarquee({ angle: value })} />
              <NumberField label="Animation Duration" value={Number(marqueeProps.speed || 24)} min={10} max={80} onChange={(value) => updateMarquee({ speed: value })} />
              <NumberField label="Top Padding" value={Number(marqueeProps.paddingTop ?? 16)} min={0} max={64} onChange={(value) => updateMarquee({ paddingTop: value })} />
              <NumberField label="Bottom Padding" value={Number(marqueeProps.paddingBottom ?? 16)} min={0} max={64} onChange={(value) => updateMarquee({ paddingBottom: value })} />
              <NumberField label="Side Padding" value={Number(marqueeProps.itemPaddingX ?? 14)} min={0} max={64} onChange={(value) => updateMarquee({ itemPaddingX: value })} />
              <NumberField label="Line Height" value={Number(marqueeProps.lineHeight || 1.08)} min={1} max={3} onChange={(value) => updateMarquee({ lineHeight: value })} />
              <NumberField label="Top Margin" value={Number(marqueeProps.marginTop ?? 0)} min={0} max={96} onChange={(value) => updateMarquee({ marginTop: value })} />
              <NumberField label="Bottom Margin" value={Number(marqueeProps.marginBottom ?? 0)} min={0} max={96} onChange={(value) => updateMarquee({ marginBottom: value })} />
            </div>
            <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Direction</label>
            <select
              value={String(marqueeProps.direction || "left")}
              onChange={(event) => updateMarquee({ direction: event.target.value })}
              style={styles.propertyInput}
            >
              <option value="left">Move Left</option>
              <option value="right">Move Right</option>
            </select>
            <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Letter Case</label>
            <select
              value={String(marqueeProps.textTransform || "uppercase")}
              onChange={(event) => updateMarquee({ textTransform: event.target.value })}
              style={styles.propertyInput}
            >
              <option value="uppercase">UPPERCASE</option>
              <option value="none">Normal Case</option>
              <option value="lowercase">lowercase</option>
              <option value="capitalize">Capitalize</option>
            </select>
            <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Font Weight</label>
            <select
              value={String(marqueeProps.fontWeight || "800")}
              onChange={(event) => updateMarquee({ fontWeight: event.target.value })}
              style={styles.propertyInput}
            >
              <option value="400">Regular 400</option>
              <option value="500">Medium 500</option>
              <option value="600">Semi Bold 600</option>
              <option value="700">Bold 700</option>
              <option value="800">Extra Bold 800</option>
              <option value="900">Black 900</option>
            </select>
            <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Text Decoration</label>
            <select
              value={String(marqueeProps.textDecoration || "none")}
              onChange={(event) => updateMarquee({ textDecoration: event.target.value })}
              style={styles.propertyInput}
            >
              <option value="none">None</option>
              <option value="underline">Underline</option>
              <option value="overline">Overline</option>
              <option value="line-through">Strike Through</option>
            </select>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1", fontSize: 16, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={String(marqueeProps.fontStyle || "normal") === "italic"}
                  onChange={(event) => updateMarquee({ fontStyle: event.target.checked ? "italic" : "normal" })}
                />
                Italic
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1", fontSize: 16, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={String(marqueeProps.textDecoration || "none").includes("underline")}
                  onChange={(event) => updateMarquee({ textDecoration: event.target.checked ? "underline" : "none" })}
                />
                Underline quick toggle
              </label>
            </div>
            <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Divider Text</label>
            <input
              type="text"
              value={String(marqueeProps.dividerText || "✦")}
              onChange={(event) => updateMarquee({ dividerText: event.target.value })}
              style={styles.propertyInput}
              placeholder="Divider symbol or word"
            />
            <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 16, lineHeight: 1.5 }}>
              WordPress parity: direction, fill, stroke, stroke width, duration, padding, and margin are all editable here now.
            </p>
          </div>
          <ColorSelector
            label="Background Color"
            value={String(marqueeProps.backgroundColor || "#081120")}
            fallback="#081120"
            allowTransparent
            onChange={(nextValue) => updateMarquee({ backgroundColor: nextValue })}
          />
          <ColorSelector
            label="Text Color"
            value={String(marqueeProps.textColor || "#f8fafc")}
            fallback="#f8fafc"
            onChange={(nextValue) => updateMarquee({ textColor: nextValue })}
          />
          <ColorSelector
            label="Fill Color"
            value={String(marqueeProps.textFillColor || marqueeProps.textColor || "#f8fafc")}
            fallback="#f8fafc"
            onChange={(nextValue) => updateMarquee({ textFillColor: nextValue })}
          />
          <ColorSelector
            label="Outline Color"
            value={String(marqueeProps.textStrokeColor || "#0f172a")}
            fallback="#0f172a"
            allowTransparent
            onChange={(nextValue) => updateMarquee({ textStrokeColor: nextValue })}
          />
          <ColorSelector
            label="Accent Color"
            value={String(marqueeProps.accentColor || "#7dd3fc")}
            fallback="#7dd3fc"
            onChange={(nextValue) => updateMarquee({ accentColor: nextValue })}
          />
        </div>
      </div>
    );
  }

  if (block.type === BlockTypes.WAVE_MARQUEE) {
    const waveProps = block.props || {};
    const updateWave = (patch) => onChange(index, { ...waveProps, ...patch });
    return withResponsiveLayout(
      <div style={styles.properties}>
        <h3 style={styles.propertiesTitle}>~ Edit: Wave Marquee</h3>
        <div style={styles.propertyGrid}>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Text</label>
            <input
              type="text"
              value={String(waveProps.text || "")}
              onChange={(event) => updateWave({ text: event.target.value })}
              style={styles.propertyInput}
              placeholder="FULL SERVICE MARKETING AGENCY"
            />
            <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Separator</label>
            <input
              type="text"
              value={String(waveProps.separator ?? " * ")}
              onChange={(event) => updateWave({ separator: event.target.value })}
              style={styles.propertyInput}
              placeholder=" * "
            />
            <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Direction</label>
            <select
              value={String(waveProps.direction || "left")}
              onChange={(event) => updateWave({ direction: event.target.value })}
              style={styles.propertyInput}
            >
              <option value="left">Move Left</option>
              <option value="right">Move Right</option>
            </select>
            <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Letter Case</label>
            <select
              value={String(waveProps.textTransform || "uppercase")}
              onChange={(event) => updateWave({ textTransform: event.target.value })}
              style={styles.propertyInput}
            >
              <option value="uppercase">UPPERCASE</option>
              <option value="none">Normal Case</option>
              <option value="lowercase">lowercase</option>
              <option value="capitalize">Capitalize</option>
            </select>
          </div>

          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Wave Motion</label>
            <div style={styles.colorGrid}>
              <NumberField label="Speed (s)" value={parsePixelValue(waveProps.speed, 22)} min={8} max={120} onChange={(value) => updateWave({ speed: value })} />
              <NumberField label="Height" value={parsePixelValue(waveProps.height, 190)} min={90} max={420} onChange={(value) => updateWave({ height: value })} />
              <NumberField label="Wave Height" value={parsePixelValue(waveProps.amplitude, 42)} min={0} max={180} onChange={(value) => updateWave({ amplitude: value })} />
              <NumberField label="Wave Width" value={parsePixelValue(waveProps.wavelength, 640)} min={360} max={1800} onChange={(value) => updateWave({ wavelength: value })} />
              <NumberField label="Angle" value={parsePixelValue(waveProps.angle, 0)} min={-20} max={20} onChange={(value) => updateWave({ angle: value })} />
              <NumberField label="Repeats" value={parsePixelValue(waveProps.repeatCount, 4)} min={2} max={10} onChange={(value) => updateWave({ repeatCount: value })} />
            </div>
          </div>

          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Typography</label>
            <div style={styles.colorGrid}>
              <NumberField label="Text Size" value={parsePixelValue(waveProps.fontSize, 22)} min={10} max={96} onChange={(value) => updateWave({ fontSize: value })} />
              <NumberField label="Letter Spacing" value={parsePixelValue(waveProps.letterSpacing, 2.6)} min={0} max={12} onChange={(value) => updateWave({ letterSpacing: value })} />
            </div>
            <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Font Weight</label>
            <select
              value={String(waveProps.fontWeight || "900")}
              onChange={(event) => updateWave({ fontWeight: event.target.value })}
              style={styles.propertyInput}
            >
              <option value="500">Medium 500</option>
              <option value="600">Semi Bold 600</option>
              <option value="700">Bold 700</option>
              <option value="800">Extra Bold 800</option>
              <option value="900">Black 900</option>
            </select>
          </div>

          <ColorSelector
            label="Background Color"
            value={String(waveProps.backgroundColor || "#000000")}
            fallback="#000000"
            allowTransparent
            onChange={(nextValue) => updateWave({ backgroundColor: nextValue })}
          />
          <ColorSelector
            label="Text Color"
            value={String(waveProps.textColor || "#00a99d")}
            fallback="#00a99d"
            onChange={(nextValue) => updateWave({ textColor: nextValue })}
          />
        </div>
      </div>
    );
  }

  if (block.type === BlockTypes.COMPETITOR_COMPARISON) {
    const ccProps = block.props || {};
    const updateCC = (patch) => onChange(index, { ...ccProps, ...patch });
    const safeRows = Array.isArray(ccProps.rows) ? ccProps.rows : [];
    return withResponsiveLayout(
      <div style={styles.properties}>
        <h3 style={styles.propertiesTitle}>💸 Edit: Competitor Comparison</h3>
        <div style={styles.propertyGrid}>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Header Text</label>
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Eyebrow</label>
            <input type="text" value={String(ccProps.eyebrow || "")} onChange={(e) => updateCC({ eyebrow: e.target.value })} style={styles.propertyInput} placeholder="our All-in-One Platform" />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Title</label>
            <input type="text" value={String(ccProps.title || "")} onChange={(e) => updateCC({ title: e.target.value })} style={styles.propertyInput} placeholder="Optional heading" />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Subtitle</label>
            <input type="text" value={String(ccProps.subtitle || "")} onChange={(e) => updateCC({ subtitle: e.target.value })} style={styles.propertyInput} placeholder="e.g. We replace every tool below..." />
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Your Plan Row (bottom)</label>
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Plan Name</label>
            <input type="text" value={String(ccProps.planName || "")} onChange={(e) => updateCC({ planName: e.target.value })} style={styles.propertyInput} />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Plan Price ($/mo)</label>
            <input type="number" value={Number(ccProps.planPrice ?? 299)} min={0} onChange={(e) => updateCC({ planPrice: Number(e.target.value) })} style={styles.propertyInput} />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Plan Tagline</label>
            <input type="text" value={String(ccProps.planTagline || "")} onChange={(e) => updateCC({ planTagline: e.target.value })} style={styles.propertyInput} placeholder="e.g. Everything above, included" />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Unique Feature Label</label>
            <input type="text" value={String(ccProps.uniqueLabel || "")} onChange={(e) => updateCC({ uniqueLabel: e.target.value })} style={styles.propertyInput} placeholder={`Unique to ${ccProps.planName || "us"}`} />
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Comparison Rows</label>
            <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
              {safeRows.map((row, rowIdx) => (
                <div key={rowIdx} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 12, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ color: "#94a3b8", fontSize: 16, fontWeight: 600 }}>Row {rowIdx + 1}</span>
                    <button
                      type="button"
                      style={{ background: "rgba(239,68,68,0.13)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5", borderRadius: 8, padding: "4px 12px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
                      onClick={() => updateCC({ rows: safeRows.filter((_, i) => i !== rowIdx) })}
                    >
                      Remove
                    </button>
                  </div>
                  <label style={styles.propertyLabel}>Category / Feature Name</label>
                  <input
                    type="text"
                    value={String(row.category || "")}
                    onChange={(e) => {
                      const next = safeRows.map((r, i) => i === rowIdx ? { ...r, category: e.target.value } : r);
                      updateCC({ rows: next });
                    }}
                    style={{ ...styles.propertyInput, marginBottom: 8 }}
                  />
                  <label style={styles.propertyLabel}>Competitor Logos</label>
                  <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
                    {(Array.isArray(row.logos) ? row.logos : []).map((logo, logoIdx) => (
                      <div key={logoIdx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, alignItems: "center" }}>
                        <input
                          type="text"
                          value={String(logo.domain || "")}
                          onChange={(e) => {
                            const nextLogos = row.logos.map((l, li) => li === logoIdx ? { ...l, domain: e.target.value } : l);
                            const next = safeRows.map((r, i) => i === rowIdx ? { ...r, logos: nextLogos } : r);
                            updateCC({ rows: next });
                          }}
                          style={styles.propertyInput}
                          placeholder="domain.com"
                        />
                        <input
                          type="text"
                          value={String(logo.name || "")}
                          onChange={(e) => {
                            const nextLogos = row.logos.map((l, li) => li === logoIdx ? { ...l, name: e.target.value } : l);
                            const next = safeRows.map((r, i) => i === rowIdx ? { ...r, logos: nextLogos } : r);
                            updateCC({ rows: next });
                          }}
                          style={styles.propertyInput}
                          placeholder="Tool name"
                        />
                        <button
                          type="button"
                          style={{ background: "rgba(239,68,68,0.13)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5", borderRadius: 8, padding: "4px 8px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
                          onClick={() => {
                            const nextLogos = row.logos.filter((_, li) => li !== logoIdx);
                            const next = safeRows.map((r, i) => i === rowIdx ? { ...r, logos: nextLogos } : r);
                            updateCC({ rows: next });
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    style={{ ...styles.secondaryBtn, marginBottom: 10 }}
                    onClick={() => {
                      const nextLogos = [...(Array.isArray(row.logos) ? row.logos : []), { domain: "", name: "" }];
                      const next = safeRows.map((r, i) => i === rowIdx ? { ...r, logos: nextLogos } : r);
                      updateCC({ rows: next });
                    }}
                  >
                    + Add Logo
                  </button>
                  <label style={styles.propertyLabel}>Cost ($/mo) — set 0 for &ldquo;Unique to us&rdquo;</label>
                  <input
                    type="number"
                    value={Number(row.price ?? 0)}
                    min={0}
                    onChange={(e) => {
                      const next = safeRows.map((r, i) => i === rowIdx ? { ...r, price: Number(e.target.value) } : r);
                      updateCC({ rows: next });
                    }}
                    style={styles.propertyInput}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => updateCC({ rows: [...safeRows, { category: "NEW FEATURE", logos: [{ domain: "", name: "" }], price: 0 }] })}
            >
              + Add Row
            </button>
          </div>
          <ColorSelector
            label="Background Color"
            value={String(ccProps.backgroundColor || "#121c26")}
            fallback="#121c26"
            onChange={(v) => updateCC({ backgroundColor: v })}
          />
        </div>
      </div>
    );
  }

  const textContentKeys = Object.keys(block.props || {}).filter((k) => isLongTextField(k));
  const deviceLabel = device === "mobile" ? "Mobile" : device === "tablet" ? "Tablet" : "Desktop";

  return withResponsiveLayout(
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🎨 Edit: {def?.name}</h3>
      <div style={{ margin: "0 0 10px", display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 10px", borderRadius: 999, background: "#e0f2fe", color: "#075985", border: "1px solid #7dd3fc", fontSize: 12, fontWeight: 800 }}>
        Editing: {deviceLabel}
      </div>
      {sharedTemplateId ? (
        <div style={{ ...styles.sectionCard, borderColor: "#7c3aed", background: "#f5f3ff" }}>
          <label style={{ ...styles.propertyLabel, color: "#4c1d95" }}>Shared Template: {sharedTemplate?.templateName || block?.props?.sharedTemplateName || sharedTemplateId}</label>
          <p style={{ margin: "6px 0 10px", color: "#5b21b6", fontSize: 13, lineHeight: 1.45, fontWeight: 700 }}>
            This CTA is shared across {sharedTemplateUsage.length || 1} page{(sharedTemplateUsage.length || 1) === 1 ? "" : "s"}. Changes will update all linked instances.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={styles.secondaryBtn} title="The fields below edit this shared CTA template.">
              Edit Shared CTA
            </button>
            <button type="button" style={styles.secondaryBtn} onClick={() => onDetachSharedTemplate?.(index)}>
              Detach from shared template
            </button>
          </div>
        </div>
      ) : null}
      {isHero ? (
        <div style={{ marginBottom: 10 }}>
          <div style={heroTabRowBase}>
            {heroSections.slice(0, 3).map((item) => (
              <button key={item.id} type="button" style={heroTabBtnStyle(heroEditorSection === item.id)} onClick={() => setHeroEditorSection(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <div style={heroTabRowBase}>
            {heroSections.slice(3).map((item) => (
              <button key={item.id} type="button" style={heroTabBtnStyle(heroEditorSection === item.id)} onClick={() => setHeroEditorSection(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <AssetLibraryModal
        visible={assetBrowser.visible}
        title={assetBrowser.title || "Media Library"}
        assets={browserAssets}
        selectedSrc={selectedBrowserImage}
        uploadAccept={isVideoAssetBrowser ? "video/*" : "image/*"}
        onClose={() => setAssetBrowser({ visible: false, fieldKey: "", title: "" })}
        onSelect={(asset) => {
          if (!assetBrowser.fieldKey) return;
          onSelectAsset(index, assetBrowser.fieldKey, asset);
        }}
        onUpload={(file) => {
          if (!assetBrowser.fieldKey) return null;
          return onUploadImage(index, assetBrowser.fieldKey, file);
        }}
      />
      <div style={styles.propertyGrid}>
        {supportsSectionHeight(block.type) && shouldShowHeroPanelSection("layout") ? (
          <ResponsiveNumberField
            label={`Section Height${device !== "desktop" ? ` (${device === "mobile" ? "Mobile" : "Tablet"})` : ""}`}
            props={block.props}
            baseKey="minHeight"
            device={device}
            unit="px"
            min={120}
            max={2000}
            fitContentFallback
            placeholder={String(block.type === BlockTypes.HERO ? 420 : 220)}
            onChange={(nextProps) => onChange(index, nextProps)}
          />
        ) : null}
        {device !== "desktop" && shouldShowHeroPanelSection("layout") ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Visibility</label>
            <label style={styles.inlineToggle}>
              <input
                type="checkbox"
                checked={!isBlockVisibleOnDevice(block.props, device)}
                onChange={(e) => onChange(index, { ...block.props, [device === "mobile" ? "hiddenOnMobile" : "hiddenOnTablet"]: e.target.checked })}
                style={styles.checkboxInput}
              />
              Hide this block on {device === "mobile" ? "Mobile" : "Tablet"}
            </label>
          </div>
        ) : null}
        {supportsFullWidthBackground(block.type) && shouldShowHeroPanelSection("layout") ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Background Width</label>
            <label style={styles.inlineToggle}>
              <input
                type="checkbox"
                checked={isFullWidthBackgroundEnabled(block)}
                onChange={(e) => onChange(index, { ...block.props, fullWidthBackground: e.target.checked })}
                style={styles.checkboxInput}
              />
              Full width background
            </label>
          </div>
        ) : null}
        {isHero && block.type === BlockTypes.HERO && shouldShowHeroPanelSection("layout") ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Hero Buttons</label>
            <div style={{ display: "grid", gap: 10 }}>
              {renderHeroButtonLinkControls("Primary Button", primaryHeroCta, "primary")}
              {renderHeroButtonLinkControls("Secondary Button", secondaryHeroCta, "secondary")}
            </div>
          </div>
        ) : null}
        {isHero && shouldShowHeroPanelSection("layout") ? (
          <div style={styles.sectionCard}>
            <NumberField
              label="Top Margin (px)"
              value={Number(block?.props?.marginTop || 0)}
              min={0}
              max={400}
              onChange={(value) => onChange(index, { ...block.props, marginTop: value })}
            />
          </div>
        ) : null}
        {supportsParallaxToggle && shouldShowHeroPanelSection("layout") ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Parallax Mode</label>
            <label style={styles.inlineToggle}>
              <input
                type="checkbox"
                checked={!!block?.props?.enableParallax}
                onChange={(e) => {
                  const nextEnabled = e.target.checked;
                  onChange(index, {
                    ...block.props,
                    enableParallax: nextEnabled,
                    ...(nextEnabled ? { backgroundStyle: "image" } : {}),
                  });
                }}
                style={styles.checkboxInput}
              />
              Enable parallax background
            </label>
          </div>
        ) : null}
        {block.type === BlockTypes.PARALLAX && shouldShowHeroPanelSection("layout") ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>CTA Button Text</label>
            <input
              type="text"
              value={canonicalCta.text}
              onChange={(e) => updateCanonicalCta({ text: e.target.value })}
              style={styles.propertyInput}
              placeholder="Book a Free Demo"
            />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>CTA Link Type</label>
            <select
              value={canonicalCta.linkType}
              onChange={(e) => updateCanonicalCta({ linkType: e.target.value })}
              style={styles.propertyInput}
            >
              <option value="page">Page / URL</option>
              <option value="external">External URL</option>
              <option value="anchor">Anchor / Section</option>
              <option value="none">No Link</option>
            </select>
            {canonicalCta.linkType === "page" ? (
              <>
                <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Page / URL</label>
                <input
                  type="text"
                  value={canonicalCta.href}
                  onChange={(e) => {
                    const rawHref = e.target.value;
                    const normalizedHref = normalizeHrefByType("page", rawHref);
                    const matchedPage = pageRefsForLinks.find((page) => page.href === normalizedHref) || null;
                    updateCanonicalCta({
                      linkType: "page",
                      href: rawHref,
                      pageId: matchedPage?.id || null,
                    });
                  }}
                  style={styles.propertyInput}
                  placeholder="/contact"
                />
                <select
                  value={canonicalCta.pageId || ""}
                  onChange={(e) => {
                    const selected = pageRefsForLinks.find((page) => page.id === e.target.value) || null;
                    updateCanonicalCta({
                      linkType: "page",
                      pageId: selected?.id || null,
                      href: selected?.href || canonicalCta.href,
                    });
                  }}
                  style={styles.propertyInput}
                >
                  <option value="">Custom URL</option>
                  {pageRefsForLinks.map((page) => (
                    <option key={page.id} value={page.id}>{`${page.label} (${page.href})`}</option>
                  ))}
                </select>
              </>
            ) : canonicalCta.linkType === "external" ? (
              <>
                <label style={{ ...styles.propertyLabel, marginTop: 8 }}>External URL</label>
                <input
                  type="url"
                  value={canonicalCta.href}
                  onChange={(e) => updateCanonicalCta({ href: e.target.value })}
                  style={styles.propertyInput}
                  placeholder="https://example.com"
                />
              </>
            ) : canonicalCta.linkType === "anchor" ? (
              <>
                <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Anchor / Section</label>
                <input
                  type="text"
                  value={canonicalCta.href}
                  onChange={(e) => updateCanonicalCta({ href: e.target.value })}
                  style={styles.propertyInput}
                  placeholder="#contact"
                />
              </>
            ) : null}
          </div>
        ) : null}
        {isHero && shouldShowHeroPanelSection("media") ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>{block.type === BlockTypes.PARALLAX ? "Section Background Image" : "Hero Background Image"}</label>
            <p style={styles.aiHint}>Use an actual hero image, not just the draggable overlay.</p>
            {currentBackgroundPreview ? (
              <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                <div style={{ width: "100%", minHeight: 132, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(148,163,184,0.24)", background: "#0f172a" }}>
                  <img src={currentBackgroundPreview} alt="Current hero background" style={{ width: "100%", height: 132, objectFit: "cover", display: "block" }} />
                </div>
                <div style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.5 }}>Current background used on the hero.</div>
              </div>
            ) : null}
            <div style={styles.assetPicker}>
              <label style={styles.assetUploadCta}>
                Upload Background
                <input
                  type="file"
                  accept="image/*"
                  style={styles.hiddenInput}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    onChange(index, { ...block.props, backgroundStyle: "image" });
                    onUploadImage(index, "backgroundImage", file);
                  }}
                />
              </label>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => openAssetBrowser("backgroundImage", block.type === BlockTypes.PARALLAX ? "Section Background Library" : "Hero Background Library")}
              >
                Choose From Library
              </button>
              {block?.props?.backgroundImage ? (
                <button
                  type="button"
                  style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }}
                  onClick={() => onChange(index, { ...block.props, backgroundImage: "", backgroundImageAssetId: undefined, backgroundStyle: "gradient" })}
                >
                  Remove Background
                </button>
              ) : null}
            </div>
            <div style={styles.assetLibraryActionRow}>
              <button type="button" style={styles.assetLibraryBtn} onClick={() => openAssetBrowser("backgroundImage", block.type === BlockTypes.PARALLAX ? "Section Background Library" : "Hero Background Library")}>
                Open Media Library
              </button>
              <button type="button" style={styles.assetLibraryBtnSecondary} onClick={() => onRefreshAssetLibrary?.()}>
                Refresh Library
              </button>
            </div>
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Background Mode</label>
            <select
              value={String(block?.props?.backgroundStyle || "gradient")}
              onChange={(e) => onChange(index, normalizeHeroBackgroundModeProps(block.props, e.target.value))}
              style={styles.propertyInput}
            >
              <option value="gradient">Gradient</option>
              <option value="solid">Solid</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
            {((block?.props?.backgroundStyle || "gradient") === "image" || block.type === BlockTypes.PARALLAX) ? (
              <>
                <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Background Position</label>
                <select
                  value={String(block?.props?.backgroundPosition || "center center")}
                  onChange={(e) => onChange(index, { ...block.props, backgroundPosition: e.target.value, backgroundStyle: "image" })}
                  style={styles.propertyInput}
                >
                  <option value="top center">Top (show image top)</option>
                  <option value="center center">Middle (default)</option>
                  <option value="bottom center">Bottom (show image bottom)</option>
                  <option value="center left">Left</option>
                  <option value="center right">Right</option>
                </select>
                <input
                  type="text"
                  value={String(block?.props?.backgroundPosition || "center center")}
                  onChange={(e) => onChange(index, { ...block.props, backgroundPosition: e.target.value, backgroundStyle: "image" })}
                  placeholder="e.g. 50% 30% or center 120px"
                  style={{ ...styles.propertyInput, marginTop: 4 }}
                  title="Custom background-position CSS value"
                />
                <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Background Size</label>
                <select
                  value={String(block?.props?.backgroundSize || "cover")}
                  onChange={(e) => onChange(index, { ...block.props, backgroundSize: e.target.value, backgroundStyle: "image" })}
                  style={styles.propertyInput}
                >
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="auto">Auto</option>
                </select>
                <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={String(block?.props?.backgroundRepeat || "no-repeat") === "no-repeat"}
                    onChange={(e) => onChange(index, {
                      ...block.props,
                      backgroundRepeat: e.target.checked ? "no-repeat" : "repeat",
                      backgroundStyle: "image",
                    })}
                    style={styles.checkboxInput}
                  />
                  No repeat background image
                </label>
                <div style={{ ...styles.linkRowCard, marginTop: 10 }}>
                  <label style={styles.inlineToggle}>
                    <input
                      type="checkbox"
                      checked={block.props?.overlayEnabled !== false && (block.props?.overlayEnabled === true || block.props?.backgroundOverlayOpacity != null || block.props?.overlayOpacity != null || block.props?.overlayGradientEnabled === true)}
                      onChange={(e) => onChange(index, {
                        ...block.props,
                        overlayEnabled: e.target.checked,
                        backgroundOverlayEnabled: e.target.checked,
                        backgroundOverlayOpacity: e.target.checked ? Number(block.props?.backgroundOverlayOpacity ?? block.props?.overlayOpacity ?? 0.35) : 0,
                        overlayOpacity: e.target.checked ? Number(block.props?.overlayOpacity ?? block.props?.backgroundOverlayOpacity ?? 0.35) : 0,
                      })}
                      style={styles.checkboxInput}
                    />
                    Enable image overlay
                  </label>
                  <div style={styles.colorGrid}>
                    <ColorSelector
                      label="Overlay Color"
                      value={block.props?.overlayColor || block.props?.backgroundOverlayColor || "#020617"}
                      fallback="#020617"
                      onChange={(value) => onChange(index, { ...block.props, overlayColor: value, backgroundOverlayColor: value })}
                    />
                    <NumberField
                      label="Overlay Opacity %"
                      value={Math.round(Math.max(0, Math.min(1, Number(block.props?.overlayOpacity ?? block.props?.backgroundOverlayOpacity ?? 0))) * 100)}
                      min={0}
                      max={95}
                      onChange={(value) => onChange(index, {
                        ...block.props,
                        overlayEnabled: Number(value) > 0,
                        backgroundOverlayEnabled: Number(value) > 0,
                        overlayOpacity: Number((Number(value) / 100).toFixed(3)),
                        backgroundOverlayOpacity: Number((Number(value) / 100).toFixed(3)),
                      })}
                    />
                  </div>
                  <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
                    <input
                      type="checkbox"
                      checked={!!block.props?.overlayGradientEnabled}
                      onChange={(e) => onChange(index, { ...block.props, overlayGradientEnabled: e.target.checked, overlayEnabled: e.target.checked || block.props?.overlayEnabled !== false })}
                      style={styles.checkboxInput}
                    />
                    Use gradient overlay
                  </label>
                  {block.props?.overlayGradientEnabled ? (
                    <div style={styles.colorGrid}>
                      <ColorSelector label="Gradient Start" value={block.props?.overlayGradientStart || "rgba(2,6,23,0.65)"} fallback="#020617" onChange={(value) => onChange(index, { ...block.props, overlayGradientStart: value })} />
                      <ColorSelector label="Gradient End" value={block.props?.overlayGradientEnd || "rgba(2,6,23,0)"} fallback="#020617" onChange={(value) => onChange(index, { ...block.props, overlayGradientEnd: value })} />
                      <select
                        value={String(block.props?.overlayGradientDirection || "135deg")}
                        onChange={(e) => onChange(index, { ...block.props, overlayGradientDirection: e.target.value })}
                        style={styles.propertyInput}
                      >
                        <option value="90deg">Left to Right</option>
                        <option value="180deg">Top to Bottom</option>
                        <option value="135deg">Diagonal</option>
                        <option value="to bottom">Vertical</option>
                      </select>
                    </div>
                  ) : null}
                  <NumberField
                    label="Image Brightness %"
                    value={Math.round(Math.max(0.25, Math.min(2, Number(block.props?.imageBrightness ?? 1))) * 100)}
                    min={25}
                    max={200}
                    onChange={(value) => onChange(index, { ...block.props, imageBrightness: Number((Number(value) / 100).toFixed(2)) })}
                  />
                </div>
              </>
            ) : null}
            {(block?.props?.backgroundStyle || "gradient") === "video" ? (
              <>
                <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Video Background (MP4)</label>
                <label style={{ ...styles.secondaryBtn, display: "block", textAlign: "center", cursor: "pointer", marginBottom: 6 }}>
                  Upload MP4 Video
                  <input
                    type="file"
                    accept="video/mp4,video/*"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      const localUrl = URL.createObjectURL(file);
                      onChange(index, { ...block.props, backgroundStyle: "video", backgroundVideoUrl: localUrl });
                      const asset = await Promise.resolve(onUploadImage?.(index, "backgroundVideoUrl", file));
                      if (asset?.src) {
                        onChange(index, { ...block.props, backgroundStyle: "video", backgroundVideoUrl: asset.src, backgroundVideoUrlAssetId: asset.id || "" });
                      }
                    }}
                  />
                </label>
                <input
                  type="text"
                  value={String(block?.props?.backgroundVideoUrl || "")}
                  onChange={(e) => onChange(index, { ...block.props, backgroundStyle: "video", backgroundVideoUrl: e.target.value })}
                  style={styles.propertyInput}
                  placeholder="Or paste MP4 URL here"
                />
                {block?.props?.backgroundVideoUrl ? (
                  <button
                    type="button"
                    style={{ ...styles.secondaryBtn, marginTop: 4, color: "#ef4444" }}
                    onClick={() => onChange(index, { ...block.props, backgroundVideoUrl: "" })}
                  >Remove Video</button>
                ) : null}
                <button
                  type="button"
                  style={{ ...styles.assetLibraryBtn, marginTop: 8 }}
                  onClick={() => openAssetBrowser("backgroundVideoUrl", "Video Library")}
                >
                  Open Video Library
                </button>
                <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Video Overlay (darken/tint)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="color"
                    value={(() => { const c = block.props?.videoOverlayColor || "rgba(0,0,0,0)"; const m = c.match(/rgba?\((\d+),(\d+),(\d+)/); if (!m) return "#000000"; return "#" + [m[1],m[2],m[3]].map((n) => parseInt(n).toString(16).padStart(2,"0")).join(""); })()}
                    onChange={(e) => {
                      const hex = e.target.value;
                      const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
                      const existing = block.props?.videoOverlayColor || "rgba(0,0,0,0.45)";
                      const alphaMatch = existing.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)/);
                      const alpha = alphaMatch ? parseFloat(alphaMatch[1]) : 0.45;
                      onChange(index, { ...block.props, videoOverlayColor: `rgba(${r},${g},${b},${alpha})` });
                    }}
                    style={{ ...styles.colorSwatch, width: 36, height: 32 }}
                  />
                  <input
                    type="range"
                    min={0} max={0.95} step={0.05}
                    value={(() => { const m = (block.props?.videoOverlayColor || "").match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)/); return m ? parseFloat(m[1]) : 0; })()}
                    onChange={(e) => {
                      const alpha = parseFloat(e.target.value);
                      const existing = block.props?.videoOverlayColor || "rgba(0,0,0,0)";
                      const m = existing.match(/rgba?\((\d+),(\d+),(\d+)/);
                      const [r,g,b] = m ? [m[1],m[2],m[3]] : ["0","0","0"];
                      onChange(index, { ...block.props, videoOverlayColor: `rgba(${r},${g},${b},${alpha})` });
                    }}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 13, color: "#64748b", minWidth: 36 }}>{Math.round(((() => { const m = (block.props?.videoOverlayColor || "").match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)/); return m ? parseFloat(m[1]) : 0; })()) * 100)}%</span>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        {isHero && shouldShowHeroPanelSection("layout") ? (
          <div style={styles.sectionCard}>
            <label style={styles.inlineToggle}>
              <input
                type="checkbox"
                checked={!!(block.props?.heroHtmlEmbed)}
                onChange={(e) => onChange(index, { ...block.props, heroHtmlEmbed: e.target.checked ? "<!-- paste embed code here -->" : "" })}
                style={styles.checkboxInput}
              />
              {"</>"} HTML Embed inside Hero
            </label>
            {block.props?.heroHtmlEmbed ? (
              <>
                <p style={{ margin: "8px 0 6px", color: "#64748b", fontSize: 16, lineHeight: 1.5 }}>Paste any iframe, widget, or embed code. It renders at the bottom of the hero section.</p>
                <textarea
                  value={block.props?.heroHtmlEmbed || ""}
                  onChange={(e) => onChange(index, { ...block.props, heroHtmlEmbed: e.target.value })}
                  placeholder={"<iframe src=\"...\"></iframe>\n<!-- or any embed code -->"}
                  style={{ ...styles.propertyInput, minHeight: 120, fontFamily: "monospace", fontSize: 16, resize: "vertical" }}
                  spellCheck={false}
                />
              </>
            ) : null}
          </div>
        ) : null}
        {!isHero && supportsCopyRegeneration(block.type) && shouldShowHeroPanelSection("layout") ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>AI Copy</label>
            <label style={styles.propertyLabel}>Tone</label>
            <select
              value={regenTone}
              onChange={(e) => setRegenTone(e.target.value)}
              style={styles.propertyInput}
            >
              {COPY_TONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              type="button"
              style={styles.aiActionBtn}
              onClick={regenerateBlockCopy}
              disabled={regenBusy}
            >
              {regenBusy ? "Regenerating..." : "Regenerate Section Copy"}
            </button>
            <p style={styles.aiHint}>Keeps current layout/style settings and refreshes text only.</p>
            {regenError ? <p style={styles.aiErrorText}>{regenError}</p> : null}
          </div>
        ) : null}
        {shouldShowHeroPanelSection("layout") ? (
          <BlockPresetPicker
            blockType={block.type}
            onApply={(patch) => onChange(index, { ...block.props, ...patch })}
          />
        ) : null}
        {isHero && shouldShowHeroPanelSection("animations") ? (
          <>
            {renderAnimationControlCard("Section Entrance", "sectionAnimation", "sectionAnimationDelay", "sectionAnimationSpeed", { animation: "fade-up", delay: 0.06, speed: 0.9 })}
          </>
        ) : null}

        {![BlockTypes.HERO, BlockTypes.PARALLAX, BlockTypes.STATS, BlockTypes.CTA_BUTTON].includes(block.type) && textContentKeys.length ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Text Editing</label>
            <p style={{ margin: 0, color: "#64748b", fontSize: 16, lineHeight: 1.5 }}>Edit text directly on the canvas. Use the floating text toolbar or the on-block size controls when available.</p>
          </div>
        ) : null}

        {Object.entries(block.props || {}).map(([key, value]) => {
          // Skip internal/layout-only fields and long text fields (shown at top)
          if (["id", "type", "sharedTemplateId", "sharedTemplateName", "sharedTemplateType", "fullWidthBackground", "minHeight", "marginTop", "parallaxStrength", "enableParallax", "contentX", "contentY", "contentWidth", "contentHeight", "verticalAlign", "headlineFontSize", "subheadlineFontSize", "textFontSize", "textSize", "floatingX", "floatingY", "floatingWidth", "floatingHeight", "floatingImage", "floatingAlt", "floatingImageAssetId", "backgroundImage", "backgroundImageAssetId", "backgroundStyle", "backgroundVideoUrl", "videoOverlayColor", "backgroundPosition", "backgroundRepeat", "backgroundSize", "contentBackground", "headlineTextStyle", "headlineOutlineColor", "headlineOutlineWidth", "headlineGradient", "headlineGlowColor", "headlineGlowBlur", "headlineShadowColor", "headlineShadowBlur", "headlineShadowOffsetX", "headlineShadowOffsetY", "sectionAnimation", "sectionAnimationDelay", "sectionAnimationSpeed", "textAnimation", "textAnimationDelay", "textAnimationSpeed", "subheadlineAnimation", "subheadlineAnimationDelay", "subheadlineAnimationSpeed", "contentOverlayAnimation", "contentOverlayAnimationDelay", "contentOverlayAnimationSpeed", "imageOverlayAnimation", "imageOverlayAnimationDelay", "imageOverlayAnimationSpeed", "ctaAnimation", "ctaAnimationDelay", "ctaAnimationSpeed", "extraCounterOverlays", "extraTextOverlays", "floatingImages", "heroStatItems", "heroHtmlEmbed", "heroCounter", "heroInlineCounter", "orbitCards", "baseLayoutWidth", "projectId", "spacingScale", "headlineAlignment", "heroVariant", "headlineFontFamily", "headlineFontWeight", "headlineLineHeight", "fontFamily", "fontWeight", "splitColorPreset", "headlineBlock", "bodyBlock", "faqBlock", "items", "logo", "assetId", "overlayImageAssetId", "overlayImage"].includes(key)) return null;
          if (block.type === BlockTypes.CTA_BUTTON && ["newTab", "targetBlank"].includes(key)) return null;
          if (block.type === BlockTypes.PARALLAX && ["cta", "ctaText", "ctaLink", "buttonText", "buttonLink", "link", "href"].includes(key)) return null;
          if (isLongTextField(key)) return null;
          // Never render raw arrays or objects — they're managed by their dedicated panel sections
          if (Array.isArray(value) || (typeof value === "object" && value !== null)) return null;
          if (!shouldRenderHeroGenericField(key, value)) return null;
          if (block.type === BlockTypes.CTA_BUTTON && key === "link") {
            return (
              <div key={key} style={styles.propertyField}>
                <label style={styles.propertyLabel}>{formatLabel(key)}</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) =>
                    onChange(index, { ...block.props, [key]: e.target.value })
                  }
                  style={styles.propertyInput}
                />
              </div>
            );
          }
          if (isColorField(key)) {
            return (
              <ColorSelector
                key={key}
                label={formatLabel(key)}
                value={String(value || "")}
                fallback="#0f172a"
                allowTransparent={key.toLowerCase().includes("background")}
                onChange={(nextValue) => onChange(index, { ...block.props, [key]: nextValue })}
              />
            );
          }

          return (
            <div key={key} style={styles.propertyField}>
              <label style={styles.propertyLabel}>{formatLabel(key)}</label>
              {getSelectOptions(key) ? (
                <select
                  value={String(value || "")}
                  onChange={(e) => onChange(index, { ...block.props, [key]: e.target.value })}
                  style={styles.propertyInput}
                >
                  {getSelectOptions(key).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : typeof value === "boolean" ? (
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) =>
                    onChange(index, { ...block.props, [key]: e.target.checked })
                  }
                  style={styles.checkboxInput}
                />
              ) : typeof value === "number" ? (
                <input
                  type="number"
                  value={value}
                  onChange={(e) =>
                    onChange(index, {
                      ...block.props,
                      [key]: Number(e.target.value),
                    })
                  }
                  style={styles.propertyInput}
                />
              ) : (
                isLongTextField(key) ? (
                  <RichText
                    value={String(value || "")}
                    onChange={(nextHtml) =>
                      onChange(index, { ...block.props, [key]: nextHtml })
                    }
                    placeholder={`Write ${formatLabel(key).toLowerCase()}...`}
                  />
                ) : (
                  <input
                    type="text"
                    value={value}
                    onChange={(e) =>
                      onChange(index, { ...block.props, [key]: e.target.value })
                    }
                    style={styles.propertyInput}
                  />
                )
              )}
              {isImageField(key) ? (
                <div style={styles.assetPicker}>
                  <label style={styles.assetUploadCta}>
                    Upload From Computer
                    <input
                      type="file"
                      accept="image/*"
                      style={styles.hiddenInput}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        onUploadImage(index, key, file);
                      }}
                    />
                  </label>
                  {savedLogo ? (
                    <button
                      type="button"
                      style={styles.assetChip}
                      onClick={() => onSelectAsset(index, key, savedLogo)}
                    >
                      Use Logo
                    </button>
                  ) : null}
                  <button
                    type="button"
                    style={styles.assetLibraryBtn}
                    onClick={() => openAssetBrowser(key, `${formatLabel(key)} Library`)}
                  >
                    Open Media Library
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export {
  CanvasBlockPreview, CanvasBlock, DropInsertZone, GlobalBlockPreview,
  ImageStackPropertiesPanel,
  getColumnEditorConfigs, ColumnsPropertiesPanel,
  normalizeGridSectionItems, renderGridFontIcon, resolveGridIconLibraryName, renderGridEditorIcon,
  GridIconLibraryModal,
  isBuiltinGridDecorationAsset, LIVE_SERVICES_GRID_PRESET,
  SERVICES_STYLE_OPTIONS, SERVICES_COLOR_OPTIONS, SERVICES_LAYOUT_OPTIONS,
  GridSectionPropertiesPanel,
  ContactFormPropertiesPanel,
  HoverCardsPropertiesPanel,
  FramerPortfolioPropertiesPanel,
  PropertiesPanel,
  renderBlockPreview,
};
