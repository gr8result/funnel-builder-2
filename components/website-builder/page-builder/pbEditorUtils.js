import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal, flushSync } from "react-dom";
import { applyAssetToProps, createStoredAsset, getAssetFromLibrary, normalizeSelectedAsset, resolveAssetField } from "../../../lib/website-builder/mediaAssets";
import { saveWebsiteBuilderAssets } from "../../../lib/website-builder/projectStore";
import { BlockTypes, BlockDefinitions, COMPETITOR_COMPARISON_TEMPLATE_PROPS } from "../../../lib/website-builder/pageBlockComponents";
import { openSharedMediaPicker } from "../../../lib/openSharedMediaPicker";
import { renderWebsiteBlock, websiteBlockKeyframes } from "../WebsiteBlockRenderer";
import { GRID_ICON_LIBRARY, renderGridLibraryIcon } from "../gridIconLibrary";
import RichText from "../../RichText";


// ANIMATION_PRESETS — needed by getSelectOptions below
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

const ImageEditModal = dynamic(() => import("../../email/editor2/ImageEditModal"), { ssr: false });
const CUSTOM_STATS_PRESET_STORAGE_KEY = "gr8:stats-custom-preset:v1";
const CUSTOM_STATS_PRESET_FIELDS = [
  "statsVariant",
  "backgroundColor",
  "textColor",
  "borderColor",
  "cardBackgroundColor",
  "accentColor",
];

function normalizeCustomStatsPreset(value) {
  if (!value || typeof value !== "object") return null;

  const preset = CUSTOM_STATS_PRESET_FIELDS.reduce((acc, key) => {
    const nextValue = value?.[key];
    if (typeof nextValue === "string" && nextValue.trim()) {
      acc[key] = nextValue.trim();
    }
    return acc;
  }, {});

  return Object.keys(preset).length ? preset : null;
}

function readCustomStatsPreset() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CUSTOM_STATS_PRESET_STORAGE_KEY);
    if (!raw) return null;
    return normalizeCustomStatsPreset(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeCustomStatsPreset(value) {
  if (typeof window === "undefined") return null;

  const preset = normalizeCustomStatsPreset(value);
  if (!preset) return null;

  try {
    window.localStorage.setItem(CUSTOM_STATS_PRESET_STORAGE_KEY, JSON.stringify(preset));
  } catch {
    return null;
  }

  return preset;
}

function matchesCustomStatsPreset(props, preset) {
  const left = normalizeCustomStatsPreset(props);
  const right = normalizeCustomStatsPreset(preset);
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatLabel(key) {
  const text = String(key || "")
    .replace(/([A-Z])/g, " $1")
    .trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function isImageField(key) {
  const field = String(key || "").toLowerCase();
  return ["src", "image", "avatar", "backgroundimage", "logo"].includes(field) || field.includes("image");
}

function isColorField(key) {
  const field = String(key || "").toLowerCase();
  return field.includes("color");
}

function isLongTextField(key) {
  const field = String(key || "").toLowerCase();
  return [
    "title",
    "headline",
    "subheadline",
    "description",
    "content",
    "text",
    "body",
    "copy",
    "message",
    "summary",
    "caption",
    "answer",
    "question",
    "intro",
    "outro",
    "cta",
  ].some((token) => field.includes(token));
}

function getSelectOptions(key) {
  const options = {
    backgroundStyle: ["gradient", "solid", "image"],
    sectionAnimation: ANIMATION_PRESETS.map((item) => item.value),
    textAnimation: ANIMATION_PRESETS.map((item) => item.value),
    subheadlineAnimation: ANIMATION_PRESETS.map((item) => item.value),
    ctaAnimation: ANIMATION_PRESETS.map((item) => item.value),
    contentOverlayAnimation: ANIMATION_PRESETS.map((item) => item.value),
    imageOverlayAnimation: ANIMATION_PRESETS.map((item) => item.value),
    alignment: ["left", "center", "right"],
    headlineAlignment: ["left", "center", "right"],
    textSize: ["small", "medium", "large"],
    size: ["small", "medium", "large"],
    fontFamily: ["system-ui", "Georgia", "Garamond", "Times New Roman", "Arial", "Verdana", "Trebuchet MS"],
    spacingScale: ["tight", "normal", "luxury"],
    bulletStyle: ["check", "arrow", "dot", "diamond"],
    featureVariant: ["cards", "glass-cards", "editorial-strip", "minimal-list"],
    pricingVariant: ["premium", "clean", "contrast", "spotlight", "matrix"],
    featureIcon: ["tick", "arrow", "spark", "diamond"],
    galleryVariant: ["balanced-grid", "editorial-mosaic", "polaroid-wall", "spotlight-strip"],
    statsVariant: ["editorial-band", "spotlight-orbs", "split-scoreboard", "minimal-ticker", "data-ribbon"],
    teamVariant: ["studio-cards", "editorial-split", "spotlight-strip", "minimal-list", "hierarchy-layout"],
    style: ["spotlight-pill", "split-banner", "editorial-outline", "stacked-card"],
    variant: ["split-dark", "centered-light", "minimal-line", "boxed-brand"],
    stickyMode: ["normal", "sticky", "sticky-solid", "sticky-transparent", "always"],
    mobileMenuStyle: ["hamburger", "drawer", "inline"],
    linkHoverEffect: ["fill", "underline", "glow", "lift"],
  };

  return options[key] || null;
}

function supportsSectionHeight(blockType) {
  return [BlockTypes.HERO, BlockTypes.PARALLAX, BlockTypes.TEXT, BlockTypes.COLUMNS_2, BlockTypes.COLUMNS_3, BlockTypes.GRID_SECTION].includes(blockType);
}

function supportsFullWidthBackground(blockType) {
  return [BlockTypes.NAV_BAR, BlockTypes.HERO, BlockTypes.PARALLAX, BlockTypes.TEXT, BlockTypes.IMAGE, BlockTypes.IMAGE_STACK, BlockTypes.CTA_BUTTON, BlockTypes.DIVIDER, BlockTypes.SPACE, "video-hero", "avatar-morph"].includes(blockType);
}

function isFullWidthBackgroundEnabled(block) {
  if (!supportsFullWidthBackground(block?.type)) {
    return !!block?.props?.fullWidthBackground;
  }
  if (block?.type === BlockTypes.CTA_BUTTON || block?.type === BlockTypes.SPACE) {
    return block?.props?.fullWidthBackground === true;
  }
  return block?.props?.fullWidthBackground !== false;
}

function supportsCopyRegeneration(blockType) {
  return [
    BlockTypes.HERO,
    BlockTypes.PARALLAX,
    BlockTypes.TEXT,
    BlockTypes.FEATURE_LIST,
    BlockTypes.FAQ,
    BlockTypes.ACCORDION,
    BlockTypes.PRICING_TABLE,
    BlockTypes.COLUMNS_2,
    BlockTypes.COLUMNS_3,
  ].includes(blockType);
}

function parsePixelValue(value, fallback) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d+)(px)?$/i);
  if (match) return Number(match[1]);
  return fallback;
}

function createImageStackLayer(seed = 0) {
  return {
    id: `layer-${Date.now()}-${seed}`,
    kind: "image",
    src: "",
    assetId: "",
    x: 40 + (seed * 24),
    y: 40 + (seed * 24),
    width: 260,
    height: 180,
    rotation: seed % 2 === 0 ? -4 : 4,
    radius: 18,
    zIndex: seed + 1,
  };
}

function createTextStackLayer(seed = 0) {
  return {
    id: `text-layer-${Date.now()}-${seed}`,
    kind: "text",
    content: "Type text here",
    x: 420 + (seed * 18),
    y: 96 + (seed * 18),
    width: 360,
    height: 140,
    rotation: 0,
    radius: 16,
    zIndex: seed + 1,
    fontSize: 40,
    fontWeight: "600",
    textAlign: "center",
    verticalAlign: "center",
    textColor: "#0f172a",
    background: "transparent",
    backgroundColor: "transparent",
    backgroundImage: "",
    backgroundSize: "cover",
    backgroundPosition: "center center",
    backgroundRepeat: "no-repeat",
  };
}

function createFaqItem(seed = 0, overrides = {}) {
  const fallbackQuestion = `New question ${seed + 1}?`;
  const fallbackAnswer = "Add the answer here.";
  const question = String(
    overrides.question || overrides.heading || overrides.q || fallbackQuestion
  );
  const answer = String(
    overrides.answer || overrides.content || overrides.a || fallbackAnswer
  );

  return {
    id: overrides.id || `faq-item-${Date.now()}-${seed}`,
    question,
    answer,
    heading: question,
    content: answer,
  };
}

function normalizeFaqItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item, index) =>
    createFaqItem(index, item || {})
  );
}

function createContactField(seed = 0, overrides = {}) {
  const label = htmlToPlainText(overrides.label || overrides.name || `Field ${seed + 1}`);
  const name = String(overrides.name || label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `field-${seed + 1}`);
  return {
    name,
    label,
    type: String(overrides.type || "text"),
    required: overrides.required !== false,
    placeholder: htmlToPlainText(overrides.placeholder || ""),
  };
}

function normalizeContactFields(fields = []) {
  return (Array.isArray(fields) ? fields : []).map((field, index) => createContactField(index, field || {}));
}

function isCssGradient(value) {
  return /(linear-gradient|radial-gradient|conic-gradient)\(/i.test(String(value || ""));
}

function extractSolidColor(value, fallback = "#0f172a") {
  const match = String(value || "").match(/(#[0-9a-fA-F]{3,8}|rgba?\([^\)]+\)|hsla?\([^\)]+\))/);
  return match?.[1] || fallback;
}

function normalizeHeroBackgroundModeProps(props, nextMode) {
  const currentProps = { ...(props || {}) };
  const currentBackground = String(currentProps.backgroundColor || "").trim();

  if (nextMode === "solid") {
    return {
      ...currentProps,
      backgroundStyle: "solid",
      backgroundColor: isCssGradient(currentBackground)
        ? extractSolidColor(currentBackground, "#0f172a")
        : (currentBackground || "#0f172a"),
    };
  }

  if (nextMode === "gradient") {
    const baseColor = isCssGradient(currentBackground)
      ? extractSolidColor(currentBackground, "#0ea5e9")
      : (currentBackground || "#0ea5e9");
    return {
      ...currentProps,
      backgroundStyle: "gradient",
      backgroundColor: `linear-gradient(135deg, ${baseColor}, #22c55e)`,
    };
  }

  return {
    ...currentProps,
    backgroundStyle: nextMode,
  };
}

function AssetLibraryModal({ visible, title = "Media Library", assets = [], selectedSrc = "", uploadAccept = "image/*,video/*", onClose, onSelect, onUpload }) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!visible) {
      setQuery("");
    }
  }, [visible]);

  if (!visible) return null;

  const isVideoAsset = (asset) => String(asset?.type || "").startsWith("video/")
    || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(String(asset?.name || asset?.src || ""));

  const filteredAssets = (Array.isArray(assets) ? assets : []).filter((asset) => {
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return true;
    const haystack = `${String(asset?.name || "")} ${String(asset?.src || "")}`.toLowerCase();
    return haystack.includes(needle);
  });
  const filteredImages = filteredAssets.filter((asset) => !isVideoAsset(asset));
  const filteredVideos = filteredAssets.filter((asset) => isVideoAsset(asset));
  const renderAssetCard = (asset) => {
    const src = String(asset?.src || "").trim();
    const selected = !!selectedSrc && src === selectedSrc;
    const video = isVideoAsset(asset);
    return (
      <button
        key={asset?.id || src}
        type="button"
        style={{
          ...styles.modalAssetCard,
          ...(selected ? styles.modalAssetCardSelected : {}),
        }}
        onClick={() => {
          onSelect?.(asset);
          onClose?.();
        }}
        title={asset?.name || (video ? "Library video" : "Library image")}
      >
        {video ? (
          <video src={src} muted playsInline preload="metadata" style={styles.modalAssetPreview} />
        ) : (
          <img src={src} alt={asset?.name || "Library image"} style={styles.modalAssetPreview} />
        )}
        <span style={styles.modalAssetName}>{asset?.name || (video ? "Video" : "Image")}</span>
      </button>
    );
  };

  return (
    <div style={styles.modalOverlay} onClick={() => onClose?.()}>
      <div style={styles.modalCard} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={{ display: "grid", gap: 4 }}>
            <strong style={styles.modalTitle}>{title}</strong>
            <span style={styles.modalSubtitle}>Search, preview, and apply media from the shared library.</span>
          </div>
          <button type="button" style={styles.modalCloseBtn} onClick={() => onClose?.()}>
            Close
          </button>
        </div>
        <div style={styles.modalToolbar}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search library"
            style={styles.modalSearchInput}
          />
          <button
            type="button"
            style={styles.modalUploadBtn}
            onClick={() => {
              openSharedMediaPicker({
                onPick: (asset) => {
                  const normalizedAsset = normalizeSelectedAsset(asset);
                  if (!normalizedAsset?.src) return;
                  onSelect?.(normalizedAsset);
                  onClose?.();
                },
              });
            }}
          >
            Open Shared Library
          </button>
          <label style={styles.modalUploadBtn}>
            Upload Here
            <input
              type="file"
              accept={uploadAccept}
              style={styles.hiddenInput}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const asset = await Promise.resolve(onUpload?.(file));
                if (asset?.src) onClose?.();
              }}
            />
          </label>
        </div>
        <div style={styles.modalAssetGrid}>
          {filteredImages.length ? <div style={styles.modalSectionTitle}>Images</div> : null}
          {filteredImages.map(renderAssetCard)}
          {filteredVideos.length ? <div style={styles.modalSectionTitle}>Videos</div> : null}
          {filteredVideos.map(renderAssetCard)}
          {!filteredAssets.length ? <div style={styles.modalEmptyState}>No library media match that search.</div> : null}
        </div>
      </div>
    </div>
  );
}

function openSharedLibraryAssetPicker(onPick) {
  return openSharedMediaPicker({
    onPick: (asset) => {
      const normalizedAsset = normalizeSelectedAsset(asset);
      if (!normalizedAsset?.src) return;
      onPick?.(normalizedAsset);
    },
  });
}

const CONTACT_FORM_TEMPLATES = [
  {
    id: "general-contact",
    label: "General Contact",
    title: "Get in Touch",
    subtitle: "Tell us what you need and we will get back to you shortly.",
    submitText: "Send Details",
    fields: [
      { name: "name", label: "Full Name", type: "text", required: true, placeholder: "Jane Smith" },
      { name: "email", label: "Email Address", type: "email", required: true, placeholder: "jane@example.com" },
      { name: "phone", label: "Phone Number", type: "tel", required: false, placeholder: "+1 555 123 4567" },
      { name: "message", label: "How Can We Help?", type: "textarea", required: true, placeholder: "Tell us about your project" },
    ],
  },
  {
    id: "quote-request",
    label: "Quote Request",
    title: "Request a Quote",
    subtitle: "Share a few details about your project and we will prepare an estimate.",
    submitText: "Send Details",
    fields: [
      { name: "name", label: "Contact Name", type: "text", required: true, placeholder: "Your name" },
      { name: "company", label: "Company", type: "text", required: false, placeholder: "Business name" },
      { name: "email", label: "Email", type: "email", required: true, placeholder: "name@company.com" },
      { name: "budget", label: "Budget Range", type: "text", required: false, placeholder: "$2,000 - $5,000" },
      { name: "project-details", label: "Project Details", type: "textarea", required: true, placeholder: "What do you need built?" },
    ],
  },
  {
    id: "callback-request",
    label: "Callback Request",
    title: "Request a Callback",
    subtitle: "Pick the best contact details and we will call you back.",
    submitText: "Send Details",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, placeholder: "Your name" },
      { name: "phone", label: "Best Phone Number", type: "tel", required: true, placeholder: "+1 555 123 4567" },
      { name: "best-time", label: "Best Time to Call", type: "text", required: false, placeholder: "Tomorrow afternoon" },
      { name: "topic", label: "What Would You Like to Discuss?", type: "textarea", required: false, placeholder: "A short summary" },
    ],
  },
  {
    id: "booking-enquiry",
    label: "Booking Enquiry",
    title: "Book an Appointment",
    subtitle: "Send your preferred date and a few details to request a booking.",
    submitText: "Send Details",
    submitAction: "calendar-booking",
    bookingUrl: "https://nonfat-ungored-buford.ngrok-free.dev/u/gr8result?service=f775fc69-f59e-4fd8-ae4a-1e9bb7ecfe4f",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, placeholder: "Your name" },
      { name: "email", label: "Email", type: "email", required: true, placeholder: "you@example.com" },
      { name: "preferred-date", label: "Preferred Date", type: "text", required: true, placeholder: "May 12" },
      { name: "service", label: "Service", type: "text", required: false, placeholder: "Consultation" },
      { name: "notes", label: "Notes", type: "textarea", required: false, placeholder: "Anything else we should know?" },
    ],
  },
];

const CONTACT_FORM_STYLE_TEMPLATES = [
  {
    id: "editorial-split",
    label: "Editorial Split",
    patch: {
      formVariant: "editorial-split",
      formMaxWidth: 920,
      backgroundColor: "#f7f3ec",
      sectionGradient: "linear-gradient(135deg,#f7f3ec,#efe4d3)",
      cardBackgroundColor: "#fffdf8",
      textColor: "#1f2937",
      subtleTextColor: "#6b7280",
      buttonBackgroundColor: "#1f2937",
      buttonTextColor: "#fffdf8",
      inputBackgroundColor: "#ffffff",
      inputBorderColor: "#d6c7b2",
      inputTextColor: "#1f2937",
      mediaPosition: "right",
      mediaImage: "https://placehold.co/900x1100/e8dcc8/1f2937?text=Editorial+Image",
    },
  },
  {
    id: "stacked-glow",
    label: "Stacked Glow",
    patch: {
      formVariant: "stacked-glow",
      formMaxWidth: 760,
      backgroundColor: "#ecfeff",
      sectionGradient: "radial-gradient(circle at top,#cffafe,#ecfeff 58%,#e0f2fe)",
      cardBackgroundColor: "rgba(255,255,255,0.92)",
      textColor: "#083344",
      subtleTextColor: "#155e75",
      buttonBackgroundColor: "linear-gradient(135deg,#06b6d4,#0891b2)",
      buttonTextColor: "#ffffff",
      inputBackgroundColor: "#ffffff",
      inputBorderColor: "#67e8f9",
      inputTextColor: "#083344",
      mediaPosition: "top",
      mediaImage: "https://placehold.co/1400x720/cffafe/083344?text=Top+Showcase",
    },
  },
  {
    id: "dark-glass",
    label: "Dark Glass",
    patch: {
      formVariant: "dark-glass",
      formMaxWidth: 940,
      backgroundColor: "#020617",
      sectionGradient: "linear-gradient(145deg,#020617,#0f172a 48%,#111827)",
      cardBackgroundColor: "rgba(15,23,42,0.74)",
      textColor: "#f8fafc",
      subtleTextColor: "#cbd5e1",
      buttonBackgroundColor: "linear-gradient(135deg,#22d3ee,#2563eb)",
      buttonTextColor: "#eff6ff",
      inputBackgroundColor: "rgba(15,23,42,0.58)",
      inputBorderColor: "rgba(125,211,252,0.28)",
      inputTextColor: "#e0f2fe",
      mediaPosition: "left",
      mediaImage: "https://placehold.co/900x1100/0f172a/e0f2fe?text=Glass+Visual",
    },
  },
  {
    id: "minimal-soft",
    label: "Minimal Soft",
    patch: {
      formVariant: "minimal-soft",
      formMaxWidth: 680,
      backgroundColor: "#ffffff",
      sectionGradient: "linear-gradient(180deg,#ffffff,#f8fafc)",
      cardBackgroundColor: "#ffffff",
      textColor: "#0f172a",
      subtleTextColor: "#475569",
      buttonBackgroundColor: "#0f172a",
      buttonTextColor: "#ffffff",
      inputBackgroundColor: "#f8fafc",
      inputBorderColor: "#cbd5e1",
      inputTextColor: "#0f172a",
      mediaPosition: "none",
      mediaImage: "",
    },
  },
];

const DEFAULT_ENQUIRY_BOOKING_URL = "https://nonfat-ungored-buford.ngrok-free.dev/u/gr8result?service=f775fc69-f59e-4fd8-ae4a-1e9bb7ecfe4f";

function resolveContactBookingUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "/u/your-username") return DEFAULT_ENQUIRY_BOOKING_URL;
  return raw;
}

function htmlToPlainText(value) {
  const raw = String(value || "").replace(/\u200b/g, "");
  if (!/[<&]/.test(raw)) return raw;

  if (typeof document !== "undefined") {
    const container = document.createElement("div");
    container.innerHTML = raw;
    return (container.textContent || container.innerText || "").replace(/\u00a0/g, " ");
  }

  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function createPricingPlan(seed = 0, overrides = {}) {
  const fallbackFeatures = ["Feature 1", "Feature 2", "Feature 3"];
  const includedFeatures = (Array.isArray(overrides.includedFeatures) && overrides.includedFeatures.length
    ? overrides.includedFeatures
    : Array.isArray(overrides.features) && overrides.features.length
      ? overrides.features
      : fallbackFeatures)
    .map((item) => htmlToPlainText(item));
  const extras = (Array.isArray(overrides.extras) ? overrides.extras : []).map((item) => htmlToPlainText(item));

  return {
    id: overrides.id || `pricing-plan-${Date.now()}-${seed}`,
    name: htmlToPlainText(overrides.name || `Plan ${seed + 1}`),
    price: htmlToPlainText(overrides.price || "$49"),
    description: htmlToPlainText(overrides.description || "Plan summary"),
    includedFeatures,
    features: includedFeatures,
    extras,
    featureIcon: String(overrides.featureIcon || "tick"),
    cardBackgroundColor: String(overrides.cardBackgroundColor || ""),
    textColor: String(overrides.textColor || ""),
    subtleTextColor: String(overrides.subtleTextColor || ""),
    ctaTextColor: String(overrides.ctaTextColor || ""),
    badge: "",
    cta: htmlToPlainText(overrides.cta || "Get Started"),
    highlighted: !!overrides.highlighted,
    cardAnimation: String(overrides.cardAnimation || ""),
  };
}

function normalizePricingPlans(plans = []) {
  return (Array.isArray(plans) ? plans : []).map((plan, index) =>
    createPricingPlan(index, plan || {})
  );
}

const NAVBAR_STYLE_PRESETS = [
  {
    id: "split-dark",
    label: "Split Dark",
    props: {
      variant: "split-dark",
      backgroundColor: "#0b1220",
      borderColor: "rgba(148,163,184,0.24)",
      textColor: "#e2e8f0",
      buttonColor: "#ffffff",
      buttonTextColor: "#0f172a",
    },
  },
  {
    id: "centered-light",
    label: "Centered Light",
    props: {
      variant: "centered-light",
      backgroundColor: "#f8fafc",
      borderColor: "rgba(148,163,184,0.45)",
      textColor: "#0f172a",
      buttonColor: "#0f172a",
      buttonTextColor: "#ffffff",
    },
  },
  {
    id: "minimal-line",
    label: "Minimal Line",
    props: {
      variant: "minimal-line",
      backgroundColor: "transparent",
      borderColor: "rgba(148,163,184,0.45)",
      textColor: "#e2e8f0",
      buttonColor: "#1d4ed8",
      buttonTextColor: "#ffffff",
    },
  },
  {
    id: "boxed-brand",
    label: "Boxed Brand",
    props: {
      variant: "boxed-brand",
      backgroundColor: "#111827",
      borderColor: "rgba(125,211,252,0.24)",
      textColor: "#f8fafc",
      buttonColor: "#22c55e",
      buttonTextColor: "#052e16",
    },
  },
];

const BLOCK_STYLE_PRESETS = {
  [BlockTypes.HERO]: [
    { id: "hero-executive", label: "Executive Split", props: { heroVariant: "split", spacingScale: "luxury", textAnimation: "fade-up", subheadlineAnimation: "fade-in", backgroundColor: "linear-gradient(135deg,#081120,#10213a 58%,#17304d)", headlineColor: "#f8fafc", textColor: "#cbd5e1", buttonColor: "#ffffff", buttonTextColor: "#0f172a", contentBackground: "rgba(15,23,42,0.18)", minHeight: "560px" } },
    { id: "hero-editorial", label: "Editorial Loft", props: { heroVariant: "editorial", spacingScale: "luxury", textAnimation: "fade-up", subheadlineAnimation: "slide-left", backgroundColor: "linear-gradient(180deg,#f7f1e8,#efe5d8)", headlineColor: "#1f2937", textColor: "#4b5563", buttonColor: "#1f2937", buttonTextColor: "#fffaf3", contentBackground: "rgba(255,250,243,0.72)", minHeight: "620px" } },
    { id: "hero-spotlight", label: "Spotlight Glow", props: { heroVariant: "spotlight", spacingScale: "normal", textAnimation: "fade-up", subheadlineAnimation: "fade-in", backgroundColor: "radial-gradient(circle at top,#1d4ed8 0%,#0f172a 58%,#020617 100%)", headlineColor: "#ffffff", textColor: "#dbeafe", buttonColor: "#22d3ee", buttonTextColor: "#082f49", contentBackground: "rgba(15,23,42,0.22)", minHeight: "500px" } },
    { id: "hero-framed", label: "Minimal Frame", props: { heroVariant: "framed", spacingScale: "normal", textAnimation: "fade-up", subheadlineAnimation: "fade-in", backgroundColor: "linear-gradient(180deg,#ffffff,#f8fafc)", headlineColor: "#0f172a", textColor: "#475569", buttonColor: "#0f172a", buttonTextColor: "#ffffff", contentBackground: "rgba(255,255,255,0.92)", borderColor: "rgba(203,213,225,0.88)", minHeight: "520px" } },
    { id: "hero-orbit", label: "Orbit Avatar", props: { heroVariant: "orbit", spacingScale: "normal", textAnimation: "fade-up", subheadlineAnimation: "fade-in", backgroundColor: "linear-gradient(180deg,#020617,#0f172a 55%,#081728)", headlineColor: "#ffffff", textColor: "#94a3b8", buttonColor: "#22d3ee", buttonTextColor: "#082f49", contentBackground: "transparent", minHeight: "680px" } },
  ],
  [BlockTypes.FEATURE_LIST]: [
    { id: "feature-cards", label: "Showcase Cards", props: { featureVariant: "cards", layout: "columns", spacingScale: "normal", backgroundColor: "linear-gradient(180deg,#ffffff,#f8fbff)", itemBackgroundColor: "linear-gradient(165deg,#eff6ff,#ffffff)", textColor: "#0f172a", borderColor: "#dbeafe" } },
    { id: "feature-glass", label: "Glass Gallery", props: { featureVariant: "glass-cards", layout: "columns", spacingScale: "luxury", backgroundColor: "linear-gradient(180deg,#020617,#0f172a)", itemBackgroundColor: "linear-gradient(170deg, rgba(15,23,42,0.78), rgba(30,41,59,0.62))", textColor: "#e2e8f0", borderColor: "rgba(103,232,249,0.18)" } },
    { id: "feature-editorial", label: "Editorial Split", props: { featureVariant: "editorial-strip", layout: "vertical", spacingScale: "luxury", backgroundColor: "linear-gradient(180deg,#fffaf2,#f6ead8)", itemBackgroundColor: "linear-gradient(135deg,#fffaf2,#f6ead8)", textColor: "#2f241b", borderColor: "rgba(120,98,67,0.16)" } },
    { id: "feature-minimal", label: "Minimal Thumb List", props: { featureVariant: "minimal-list", layout: "vertical", spacingScale: "tight", backgroundColor: "linear-gradient(180deg,#ffffff,#f8fafc)", itemBackgroundColor: "linear-gradient(180deg,#ffffff,#f8fafc)", textColor: "#0f172a", borderColor: "rgba(226,232,240,0.95)" } },
  ],
  [BlockTypes.CTA_BUTTON]: [
    { id: "cta-spotlight", label: "Spotlight Pill", props: { style: "spotlight-pill", alignment: "center", size: "large", eyebrow: "Launch Faster", title: "Guide visitors to a single clear action", description: "Keep the section focused on one next step with a high-contrast button and short supporting line.", text: "Book a Strategy Call", note: "Takes less than 2 minutes", backgroundColor: "linear-gradient(135deg,#eff6ff,#ffffff)", textColor: "#0f172a", buttonColor: "linear-gradient(135deg,#0ea5e9,#2563eb)", buttonTextColor: "#ffffff", borderColor: "rgba(191,219,254,0.9)" } },
    { id: "cta-split", label: "Split Banner", props: { style: "split-banner", alignment: "left", size: "large", eyebrow: "Limited Openings", title: "Claim your slot before this week fills up", description: "A wide banner layout with copy on the left and a large CTA stacked to the right.", text: "Reserve My Spot", note: "New clients onboarded weekly", backgroundColor: "linear-gradient(135deg,#081120,#17304d)", textColor: "#f8fafc", buttonColor: "#ffffff", buttonTextColor: "#0f172a", borderColor: "rgba(148,163,184,0.22)" } },
    { id: "cta-editorial", label: "Editorial Outline", props: { style: "editorial-outline", alignment: "left", size: "medium", eyebrow: "For Service Brands", title: "Present your next step with more polish", description: "An editorial card with softer tones, restrained border treatment, and a quieter premium feel.", text: "See Packages", note: "Built for offers that need a little context", backgroundColor: "linear-gradient(180deg,#fffaf2,#f6ead8)", textColor: "#2f241b", buttonColor: "rgba(255,250,243,0.72)", buttonTextColor: "#2f241b", borderColor: "rgba(120,98,67,0.18)" } },
    { id: "cta-stacked", label: "Stacked Card", props: { style: "stacked-card", alignment: "center", size: "large", eyebrow: "Make It Easy", title: "Put the button inside a full conversion card", description: "Best for stronger CTA sections where the whole block feels like a high-priority conversion point.", text: "Start Free Trial", note: "No card required", backgroundColor: "linear-gradient(135deg,#111827,#1d4ed8 62%,#22d3ee)", textColor: "#ffffff", buttonColor: "linear-gradient(135deg,#facc15,#f59e0b)", buttonTextColor: "#1f2937", borderColor: "rgba(255,255,255,0.18)" } },
  ],
  [BlockTypes.DIVIDER]: [
    { id: "divider-hairline", label: "Hairline", props: { dividerType: "line", lineStyle: "solid", thickness: 1, width: 100, color: "#cbd5e1", backgroundColor: "transparent" } },
    { id: "divider-dashed", label: "Dashed", props: { dividerType: "line", lineStyle: "dashed", thickness: 2, width: 86, color: "#94a3b8", backgroundColor: "transparent" } },
    { id: "divider-dotted", label: "Dotted", props: { dividerType: "line", lineStyle: "dotted", thickness: 3, width: 72, color: "#38bdf8", backgroundColor: "transparent" } },
    { id: "divider-gradient", label: "Gradient", props: { dividerType: "gradient", thickness: 4, width: 100, color: "#0ea5e9", secondaryColor: "#f59e0b", backgroundColor: "transparent" } },
    { id: "divider-label", label: "Labelled", props: { dividerType: "line", lineStyle: "solid", thickness: 1, width: 82, color: "#cbd5e1", showLabel: true, label: "Section", labelColor: "#64748b", backgroundColor: "transparent" } },
  ],
  [BlockTypes.IMAGE_GALLERY]: [
    { id: "gallery-balanced", label: "Balanced Grid", props: { galleryVariant: "balanced-grid", columns: 3, backgroundColor: "linear-gradient(180deg,#ffffff,#f8fafc)", textColor: "#0f172a", borderColor: "rgba(226,232,240,0.9)" } },
    { id: "gallery-editorial", label: "Editorial Mosaic", props: { galleryVariant: "editorial-mosaic", columns: 3, backgroundColor: "linear-gradient(180deg,#fffaf2,#f6ead8)", textColor: "#2f241b", borderColor: "rgba(120,98,67,0.16)" } },
    { id: "gallery-polaroid", label: "Polaroid Wall", props: { galleryVariant: "polaroid-wall", columns: 3, backgroundColor: "linear-gradient(135deg,#eff6ff,#ffffff)", textColor: "#0f172a", borderColor: "rgba(191,219,254,0.9)" } },
    { id: "gallery-spotlight", label: "Spotlight Strip", props: { galleryVariant: "spotlight-strip", columns: 3, backgroundColor: "linear-gradient(135deg,#020617,#0f172a)", textColor: "#f8fafc", borderColor: "rgba(103,232,249,0.18)" } },
  ],
  [BlockTypes.STATS]: [
    { id: "stats-editorial", label: "Editorial Band", props: { statsVariant: "editorial-band", backgroundColor: "linear-gradient(180deg,#fffaf2,#f6ead8)", textColor: "#2f241b", borderColor: "rgba(120,98,67,0.16)", cardBackgroundColor: "rgba(255,250,243,0.78)", accentColor: "#c2410c" } },
    { id: "stats-spotlight", label: "Spotlight Orbs", props: { statsVariant: "spotlight-orbs", backgroundColor: "radial-gradient(circle at top,#1d4ed8 0%,#0f172a 58%,#020617 100%)", textColor: "#f8fafc", borderColor: "rgba(125,211,252,0.22)", cardBackgroundColor: "rgba(15,23,42,0.56)", accentColor: "#22d3ee" } },
    { id: "stats-scoreboard", label: "Split Scoreboard", props: { statsVariant: "split-scoreboard", backgroundColor: "linear-gradient(135deg,#081120,#17304d)", textColor: "#f8fafc", borderColor: "rgba(148,163,184,0.2)", cardBackgroundColor: "rgba(255,255,255,0.08)", accentColor: "#facc15" } },
    { id: "stats-minimal", label: "Minimal Ticker", props: { statsVariant: "minimal-ticker", backgroundColor: "linear-gradient(180deg,#ffffff,#f8fafc)", textColor: "#0f172a", borderColor: "rgba(203,213,225,0.88)", cardBackgroundColor: "rgba(255,255,255,0.94)", accentColor: "#0f172a" } },
    { id: "stats-ribbon", label: "Data Ribbon", props: { statsVariant: "data-ribbon", backgroundColor: "linear-gradient(135deg,#f8fbff,#eef7ff)", textColor: "#0f172a", borderColor: "rgba(96,165,250,0.24)", cardBackgroundColor: "rgba(255,255,255,0.96)", accentColor: "#2563eb" } },
  ],
  [BlockTypes.TEAM]: [
    { id: "team-studio", label: "Studio Cards", props: { teamVariant: "studio-cards", backgroundColor: "linear-gradient(180deg,#ffffff,#f8fafc)", textColor: "#0f172a", borderColor: "rgba(226,232,240,0.9)" } },
    { id: "team-editorial", label: "Editorial Split", props: { teamVariant: "editorial-split", backgroundColor: "linear-gradient(180deg,#fffaf2,#f6ead8)", textColor: "#2f241b", borderColor: "rgba(120,98,67,0.16)" } },
    { id: "team-spotlight", label: "Spotlight Strip", props: { teamVariant: "spotlight-strip", backgroundColor: "linear-gradient(135deg,#020617,#0f172a)", textColor: "#f8fafc", borderColor: "rgba(103,232,249,0.18)" } },
    { id: "team-minimal", label: "Minimal List", props: { teamVariant: "minimal-list", backgroundColor: "linear-gradient(180deg,#ffffff,#f8fafc)", textColor: "#0f172a", borderColor: "rgba(203,213,225,0.85)" } },
    { id: "team-hierarchy", label: "Hierarchy Layout", props: { teamVariant: "hierarchy-layout", teamRows: [2, 3, 4], backgroundColor: "linear-gradient(180deg,#f8fbff,#eef4ff)", textColor: "#0f172a", borderColor: "rgba(96,165,250,0.22)" } },
  ],
  [BlockTypes.TESTIMONIAL]: [
    { id: "test-cards", label: "Cards Grid", props: { testimonialVariant: "cards", spacingScale: "normal", backgroundColor: "linear-gradient(165deg,#f8fafc,#ffffff)", accentColor: "#f59e0b" } },
    { id: "test-spotlight", label: "Spotlight", props: { testimonialVariant: "spotlight", spacingScale: "luxury", backgroundColor: "linear-gradient(165deg,#0f172a,#1e3a5f)", accentColor: "#f59e0b" } },
    { id: "test-bubble", label: "Bubble", props: { testimonialVariant: "bubble", spacingScale: "normal", backgroundColor: "#f0f9ff", accentColor: "#3b82f6" } },
    { id: "test-wall", label: "Colour Wall", props: { testimonialVariant: "wall", spacingScale: "normal", backgroundColor: "#ffffff", accentColor: "#0ea5e9" } },
  ],
  [BlockTypes.NEWSLETTER]: [
    { id: "nl-centered", label: "Centered", props: { newsletterVariant: "centered", backgroundColor: "linear-gradient(165deg,#f8fafc,#ffffff)", textColor: "#0f172a", buttonColor: "#2563eb", buttonTextColor: "#ffffff" } },
    { id: "nl-dark", label: "Dark Banner", props: { newsletterVariant: "dark-banner", backgroundColor: "linear-gradient(135deg,#0f172a,#1e3a5f)", textColor: "#f8fafc", buttonColor: "#f59e0b", buttonTextColor: "#0f172a" } },
    { id: "nl-split", label: "Split", props: { newsletterVariant: "split", backgroundColor: "#ffffff", textColor: "#0f172a", buttonColor: "#0f172a", buttonTextColor: "#ffffff" } },
    { id: "nl-card", label: "Card Highlight", props: { newsletterVariant: "card-highlight", backgroundColor: "linear-gradient(135deg,#eff6ff,#dbeafe)", textColor: "#0f172a", buttonColor: "#2563eb", buttonTextColor: "#ffffff" } },
  ],
  [BlockTypes.TRUST_BADGES]: [
    { id: "trust-pill", label: "Pill Row", props: { trustBadgeVariant: "pill-row", backgroundColor: "linear-gradient(180deg,#ffffff,#f8fafc)", badgeBackgroundColor: "linear-gradient(165deg,#ffffff,#f1f5f9)", textColor: "#0f172a", borderColor: "#cbd5e1" } },
    { id: "trust-soft", label: "Soft Cards", props: { trustBadgeVariant: "soft-cards", backgroundColor: "linear-gradient(180deg,#f8fbff,#eef6ff)", badgeBackgroundColor: "rgba(255,255,255,0.94)", textColor: "#0f172a", borderColor: "rgba(96,165,250,0.22)" } },
    { id: "trust-dark", label: "Dark Glass", props: { trustBadgeVariant: "dark-glass", backgroundColor: "linear-gradient(135deg,#020617,#0f172a)", badgeBackgroundColor: "rgba(15,23,42,0.72)", textColor: "#f8fafc", borderColor: "rgba(125,211,252,0.24)" } },
    { id: "trust-logo", label: "Logo Strip", props: { trustBadgeVariant: "logo-strip", backgroundColor: "linear-gradient(180deg,#fffaf2,#f6ead8)", badgeBackgroundColor: "rgba(255,250,243,0.72)", textColor: "#2f241b", borderColor: "rgba(120,98,67,0.18)" } },
  ],
  [BlockTypes.PRICING_TABLE]: [
    { id: "price-premium", label: "Premium Pricing", props: { pricingVariant: "premium", spacingScale: "luxury", backgroundColor: "linear-gradient(180deg,#f8fbff,#eef6ff)", borderColor: "rgba(125,211,252,0.35)" } },
    { id: "price-clean", label: "Clean Pricing", props: { pricingVariant: "clean", spacingScale: "normal", backgroundColor: "linear-gradient(180deg,#ffffff,#f8fafc)", borderColor: "rgba(148,163,184,0.28)" } },
    { id: "price-contrast", label: "Contrast Cards", props: { pricingVariant: "contrast", spacingScale: "luxury", backgroundColor: "linear-gradient(180deg,#ffffff,#f3f4f6)", borderColor: "rgba(148,163,184,0.18)" } },
    { id: "price-spotlight", label: "Spotlight Glow", props: { pricingVariant: "spotlight", spacingScale: "luxury", backgroundColor: "linear-gradient(180deg,#fdfbff,#f4f3ff)", borderColor: "rgba(168,85,247,0.18)" } },
    { id: "price-matrix", label: "Comparison Matrix", props: { pricingVariant: "matrix", spacingScale: "normal", backgroundColor: "linear-gradient(180deg,#f8fbff,#eef7f4)", borderColor: "rgba(110,231,183,0.24)" } },
  ],
  [BlockTypes.COMPETITOR_COMPARISON]: [
    { id: "cc-dark", label: "Homepage Analysis", props: COMPETITOR_COMPARISON_TEMPLATE_PROPS },
    { id: "cc-slate", label: "Slate", props: { backgroundColor: "#0f172a" } },
    { id: "cc-midnight", label: "Midnight", props: { backgroundColor: "#020617" } },
  ],
};

const COPY_TONE_OPTIONS = [
  { value: "balanced", label: "Balanced" },
  { value: "luxury", label: "Luxury" },
  { value: "bold", label: "Bold" },
  { value: "clinical", label: "Clinical" },
  { value: "friendly", label: "Friendly" },
];

function getHeroLayoutDefaults(variant) {
  if (variant === "split") {
    return {
      headlineAlignment: "left",
      verticalAlign: "center",
      contentX: 31,
      contentY: 52,
      contentWidth: 540,
      contentHeight: 300,
      floatingX: 78,
      floatingY: 52,
      floatingWidth: 360,
      floatingHeight: 420,
    };
  }

  if (variant === "editorial") {
    return {
      headlineAlignment: "left",
      verticalAlign: "bottom",
      contentX: 38,
      contentY: 68,
      contentWidth: 560,
      contentHeight: 250,
      floatingX: 78,
      floatingY: 34,
      floatingWidth: 250,
      floatingHeight: 320,
    };
  }

  if (variant === "framed") {
    return {
      headlineAlignment: "left",
      verticalAlign: "center",
      contentX: 33,
      contentY: 52,
      contentWidth: 520,
      contentHeight: 250,
      floatingX: 77,
      floatingY: 56,
      floatingWidth: 320,
      floatingHeight: 230,
    };
  }

  return {
    headlineAlignment: "center",
    verticalAlign: "center",
    contentX: 50,
    contentY: 68,
    contentWidth: 760,
    contentHeight: 220,
    floatingX: 50,
    floatingY: 24,
    floatingWidth: 176,
    floatingHeight: 176,
  };
}

function applyHeroPresetLayout(presetProps = {}) {
  const layout = getHeroLayoutDefaults(presetProps.heroVariant || "spotlight");
  return {
    ...presetProps,
    headlineAlignment: presetProps.headlineAlignment ?? layout.headlineAlignment,
    verticalAlign: presetProps.verticalAlign ?? layout.verticalAlign,
    contentX: layout.contentX,
    contentY: layout.contentY,
    contentWidth: layout.contentWidth,
    contentHeight: layout.contentHeight,
    floatingX: layout.floatingX,
    floatingY: layout.floatingY,
    floatingWidth: layout.floatingWidth,
    floatingHeight: layout.floatingHeight,
    enableParallax: true,
  };
}

function withHeroOverlayDefaults(props = {}) {
  const layout = getHeroLayoutDefaults(props.heroVariant || "spotlight");
  return {
    ...props,
    enableParallax: true,
    floatingX: props?.floatingX ?? layout.floatingX,
    floatingY: props?.floatingY ?? layout.floatingY,
    floatingWidth: props?.floatingWidth ?? layout.floatingWidth,
    floatingHeight: props?.floatingHeight ?? layout.floatingHeight,
  };
}

const TEXT_SIZE_OPTIONS = [14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72];


// ─── exports ──────────────────────────────────────────────────────────────────
export {
  ImageEditModal,
  CUSTOM_STATS_PRESET_STORAGE_KEY, CUSTOM_STATS_PRESET_FIELDS,
  normalizeCustomStatsPreset, readCustomStatsPreset, writeCustomStatsPreset, matchesCustomStatsPreset,
  formatLabel, isImageField, isColorField, isLongTextField, getSelectOptions,
  supportsSectionHeight, supportsFullWidthBackground, isFullWidthBackgroundEnabled,
  supportsCopyRegeneration,
  parsePixelValue,
  createImageStackLayer, createTextStackLayer,
  createFaqItem, normalizeFaqItems,
  createContactField, normalizeContactFields,
  isCssGradient, extractSolidColor, normalizeHeroBackgroundModeProps,
  AssetLibraryModal, openSharedLibraryAssetPicker,
  CONTACT_FORM_TEMPLATES, CONTACT_FORM_STYLE_TEMPLATES,
  DEFAULT_ENQUIRY_BOOKING_URL, resolveContactBookingUrl, htmlToPlainText,
  createPricingPlan, normalizePricingPlans,
  NAVBAR_STYLE_PRESETS, BLOCK_STYLE_PRESETS, COPY_TONE_OPTIONS,
  getHeroLayoutDefaults, applyHeroPresetLayout, withHeroOverlayDefaults,
  TEXT_SIZE_OPTIONS,
  ANIMATION_PRESETS,
};
