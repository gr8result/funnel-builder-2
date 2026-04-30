import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { flushSync } from "react-dom";
import { applyAssetToProps, createStoredAsset, getAssetFromLibrary, resolveAssetField } from "../../lib/website-builder/mediaAssets";
import { saveWebsiteBuilderAssets } from "../../lib/website-builder/projectStore";
import { BlockTypes, BlockDefinitions } from "../../lib/website-builder/pageBlockComponents";
import { renderWebsiteBlock, websiteBlockKeyframes } from "./WebsiteBlockRenderer";
import RichText from "../RichText";

const ImageEditModal = dynamic(() => import("../email/editor2/ImageEditModal"), { ssr: false });

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
    stickyMode: ["normal", "sticky", "always"],
    mobileMenuStyle: ["hamburger", "drawer", "inline"],
    linkHoverEffect: ["fill", "underline", "glow", "lift"],
  };

  return options[key] || null;
}

function supportsSectionHeight(blockType) {
  return [BlockTypes.HERO, BlockTypes.PARALLAX, BlockTypes.TEXT, BlockTypes.COLUMNS_2, BlockTypes.COLUMNS_3].includes(blockType);
}

function supportsFullWidthBackground(blockType) {
  return [BlockTypes.HERO, BlockTypes.PARALLAX, BlockTypes.TEXT, BlockTypes.IMAGE].includes(blockType);
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
    fontWeight: "700",
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

function BlockPresetPicker({ blockType, onApply }) {
  const presets = BLOCK_STYLE_PRESETS[blockType] || [];
  if (!presets.length) return null;

  return (
    <div style={styles.sectionCard}>
      <label style={styles.propertyLabel}>Designer Presets</label>
      <div style={styles.presetGrid}>
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onApply(blockType === BlockTypes.HERO ? applyHeroPresetLayout(preset.props) : preset.props)}
            style={styles.presetChip}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function NavbarPresetPicker({ value, onApply }) {
  return (
    <div style={styles.presetGrid}>
      {NAVBAR_STYLE_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => onApply(preset.props)}
          style={{
            ...styles.presetChip,
            ...(value === preset.id ? styles.presetChipActive : {}),
          }}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

function NavbarLinksEditor({ links, onChange }) {
  const safeLinks = Array.isArray(links) ? links : [];
  const makeLinkId = () => `nav-link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const makeChildLinkId = () => `nav-child-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  function updateLink(idx, patch) {
    const next = safeLinks.map((item, currentIdx) => (
      currentIdx === idx ? { ...item, ...patch } : item
    ));
    onChange(next);
  }

  function removeLink(idx) {
    onChange(safeLinks.filter((_, currentIdx) => currentIdx !== idx));
  }

  function addLink() {
    onChange([...safeLinks, { id: makeLinkId(), label: "New Link", href: "#" }]);
  }

  function moveLink(idx, direction) {
    const nextIndex = idx + direction;
    if (nextIndex < 0 || nextIndex >= safeLinks.length) return;
    const next = [...safeLinks];
    const [moved] = next.splice(idx, 1);
    next.splice(nextIndex, 0, moved);
    onChange(next);
  }

  function updateChildLink(parentIdx, childIdx, patch) {
    const next = safeLinks.map((item, currentIdx) => {
      if (currentIdx !== parentIdx) return item;
      const children = Array.isArray(item.children) ? item.children : [];
      return {
        ...item,
        children: children.map((child, currentChildIdx) => (
          currentChildIdx === childIdx ? { ...child, ...patch } : child
        )),
      };
    });
    onChange(next);
  }

  function addChildLink(parentIdx) {
    const next = safeLinks.map((item, currentIdx) => {
      if (currentIdx !== parentIdx) return item;
      return {
        ...item,
        children: [...(Array.isArray(item.children) ? item.children : []), { id: makeChildLinkId(), label: "Dropdown Link", href: "#" }],
      };
    });
    onChange(next);
  }

  function removeChildLink(parentIdx, childIdx) {
    const next = safeLinks.map((item, currentIdx) => {
      if (currentIdx !== parentIdx) return item;
      return {
        ...item,
        children: (Array.isArray(item.children) ? item.children : []).filter((_, currentChildIdx) => currentChildIdx !== childIdx),
      };
    });
    onChange(next);
  }

  return (
    <div style={styles.stackSm}>
      {safeLinks.map((item, idx) => (
        <div key={item?.id || `link-${idx}`} style={styles.linkRowCard}>
          <div style={styles.linkRowHeader}>
            <span style={styles.linkRowTitle}>Link {idx + 1}</span>
            <div style={styles.linkActions}>
              <button type="button" style={styles.linkMoveBtn} onClick={() => moveLink(idx, -1)} title="Move up">↑</button>
              <button type="button" style={styles.linkMoveBtn} onClick={() => moveLink(idx, 1)} title="Move down">↓</button>
              <button type="button" style={styles.linkRowDelete} onClick={() => removeLink(idx)}>
                Remove
              </button>
            </div>
          </div>
          <input
            type="text"
            value={item?.label || ""}
            onChange={(e) => updateLink(idx, { label: e.target.value })}
            style={styles.propertyInput}
            placeholder="Label"
          />
          <input
            type="text"
            value={item?.href || ""}
            onChange={(e) => updateLink(idx, { href: e.target.value })}
            style={styles.propertyInput}
            placeholder="#section or /page"
          />
          <label style={styles.inlineToggle}>
            <input
              type="checkbox"
              checked={!!item?.highlighted}
              onChange={(e) => updateLink(idx, { highlighted: e.target.checked })}
            />
            Highlight this link
          </label>
          <div style={styles.subLinkList}>
            {(Array.isArray(item.children) ? item.children : []).map((child, childIdx) => (
              <div key={child?.id || `child-${idx}-${childIdx}`} style={styles.subLinkCard}>
                <div style={styles.linkRowHeader}>
                  <span style={styles.subLinkTitle}>Dropdown {childIdx + 1}</span>
                  <button type="button" style={styles.linkRowDelete} onClick={() => removeChildLink(idx, childIdx)}>
                    Remove
                  </button>
                </div>
                <input
                  type="text"
                  value={child?.label || ""}
                  onChange={(e) => updateChildLink(idx, childIdx, { label: e.target.value })}
                  style={styles.propertyInput}
                  placeholder="Dropdown label"
                />
                <input
                  type="text"
                  value={child?.href || ""}
                  onChange={(e) => updateChildLink(idx, childIdx, { href: e.target.value })}
                  style={styles.propertyInput}
                  placeholder="Dropdown href"
                />
              </div>
            ))}
            <button type="button" style={styles.secondaryBtn} onClick={() => addChildLink(idx)}>
              + Add Dropdown Item
            </button>
          </div>
        </div>
      ))}
      <button type="button" style={styles.secondaryBtn} onClick={addLink}>
        + Add Link
      </button>
    </div>
  );
}

function normalizeFeatureListItem(item, index) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return {
      id: item.id || `feature-item-${index}`,
      title: String(item.title || item.label || item.text || `Feature ${index + 1}`),
      body: String(item.body || item.description || item.copy || ""),
      image: String(item.image || item.src || ""),
      imageX: Number.isFinite(Number(item.imageX)) ? Math.max(0, Math.min(100, Number(item.imageX))) : 50,
      imageY: Number.isFinite(Number(item.imageY)) ? Math.max(0, Math.min(100, Number(item.imageY))) : 50,
    };
  }

  return {
    id: `feature-item-${index}`,
    title: String(item || `Feature ${index + 1}`),
    body: "",
    image: "",
    imageX: 50,
    imageY: 50,
  };
}

function normalizeGalleryItem(item, index) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return {
      id: item.id || `gallery-item-${index}`,
      src: String(item.src || ""),
      alt: String(item.alt || `Image ${index + 1}`),
      caption: String(item.caption || ""),
      imageX: Number.isFinite(Number(item.imageX)) ? Math.max(0, Math.min(100, Number(item.imageX))) : 50,
      imageY: Number.isFinite(Number(item.imageY)) ? Math.max(0, Math.min(100, Number(item.imageY))) : 50,
    };
  }

  return {
    id: `gallery-item-${index}`,
    src: String(item || ""),
    alt: `Image ${index + 1}`,
    caption: "",
    imageX: 50,
    imageY: 50,
  };
}

function createDefaultGalleryItem(index) {
  return {
    id: `gallery-item-${Date.now()}-${index}`,
    src: `https://placehold.co/1200x900/e2e8f0/0f172a?text=${encodeURIComponent(`Gallery ${index + 1}`)}`,
    alt: `Image ${index + 1}`,
    caption: "Add a caption",
    imageX: 50,
    imageY: 50,
  };
}

function normalizeTeamMember(item, index) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return {
      id: item.id || `team-member-${index}`,
      name: String(item.name || `Team Member ${index + 1}`),
      role: String(item.role || "Role"),
      bio: String(item.bio || "Add a short team bio."),
      image: String(item.image || item.src || ""),
      imageAssetId: String(item.imageAssetId || ""),
      hierarchyRow: Number.isFinite(Number(item.hierarchyRow)) ? Math.max(0, Number(item.hierarchyRow)) : 0,
      imageX: Number.isFinite(Number(item.imageX)) ? Math.max(0, Math.min(100, Number(item.imageX))) : 50,
      imageY: Number.isFinite(Number(item.imageY)) ? Math.max(0, Math.min(100, Number(item.imageY))) : 50,
    };
  }

  return {
    id: `team-member-${index}`,
    name: `Team Member ${index + 1}`,
    role: "Role",
    bio: "Add a short team bio.",
    image: "",
    imageAssetId: "",
    hierarchyRow: 0,
    imageX: 50,
    imageY: 50,
  };
}

function normalizeTeamRowSizes(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(",");
  return source
    .map((entry) => parseInt(String(entry || "").trim(), 10))
    .filter((size) => Number.isFinite(size) && size > 0)
    .slice(0, 8);
}

function formatTeamRowSizes(value) {
  return normalizeTeamRowSizes(value).join(", ");
}

function deriveTeamRowSizesFromMembers(members) {
  const safeMembers = Array.isArray(members) ? members.map((item, index) => normalizeTeamMember(item, index)) : [];
  const counts = [];
  safeMembers.forEach((member) => {
    counts[member.hierarchyRow] = (counts[member.hierarchyRow] || 0) + 1;
  });
  return counts.filter((count) => Number.isFinite(count) && count > 0);
}

function rebalanceTeamMembersForRows(members, rowSizes) {
  const safeMembers = Array.isArray(members) ? members.map((item, index) => normalizeTeamMember(item, index)) : [];
  const normalizedRows = normalizeTeamRowSizes(rowSizes);
  if (!normalizedRows.length) {
    return safeMembers.map((member) => ({ ...member, hierarchyRow: 0 }));
  }

  let cursor = 0;
  const nextMembers = safeMembers.map((member) => ({ ...member }));
  normalizedRows.forEach((size, rowIndex) => {
    for (let slot = 0; slot < size && cursor < nextMembers.length; slot += 1) {
      nextMembers[cursor] = { ...nextMembers[cursor], hierarchyRow: rowIndex };
      cursor += 1;
    }
  });

  while (cursor < nextMembers.length) {
    nextMembers[cursor] = { ...nextMembers[cursor], hierarchyRow: normalizedRows.length - 1 };
    cursor += 1;
  }

  return nextMembers;
}

function buildEditableTeamRows(members, rowSizes) {
  const safeMembers = Array.isArray(members) ? members.map((item, index) => normalizeTeamMember(item, index)) : [];
  const normalizedRows = normalizeTeamRowSizes(rowSizes);
  const inferredRowCount = safeMembers.reduce((maxRows, member) => Math.max(maxRows, member.hierarchyRow + 1), 0);
  const rowCount = Math.max(normalizedRows.length, inferredRowCount, 1);

  return Array.from({ length: rowCount }, (_, rowIndex) => ({
    rowIndex,
    members: safeMembers.filter((member) => member.hierarchyRow === rowIndex),
  }));
}

function normalizeStatItem(item, index) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return {
      id: item.id || `stat-item-${index}`,
      number: String(item.number || item.value || `0${index + 1}`),
      label: String(item.label || item.title || `Metric ${index + 1}`),
      detail: String(item.detail || item.description || "Add a short line of context."),
    };
  }

  return {
    id: `stat-item-${index}`,
    number: String(item || `0${index + 1}`),
    label: `Metric ${index + 1}`,
    detail: "Add a short line of context.",
  };
}

function StatsItemsEditor({ stats, onChange }) {
  const safeStats = Array.isArray(stats) ? stats : [];

  function addStat() {
    onChange([
      ...safeStats,
      {
        id: `stat-item-${Date.now()}-${safeStats.length}`,
        number: `${(safeStats.length + 1) * 10}+`,
        label: `Metric ${safeStats.length + 1}`,
        detail: "Add a short line of context.",
      },
    ]);
  }

  function removeStat(index) {
    onChange(safeStats.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div style={styles.stackSm}>
      {safeStats.map((rawStat, index) => {
        const stat = normalizeStatItem(rawStat, index);
        return (
          <div key={`${index}-${stat.id}`} style={styles.linkRowCard}>
            <div style={styles.linkRowHeader}>
              <span style={styles.linkRowTitle}>Card {index + 1}</span>
              <button type="button" style={styles.linkRowDelete} onClick={() => removeStat(index)}>Remove</button>
            </div>
            <p style={{ margin: 0, color: "#475569", fontSize: 13 }}>Card {index + 1}</p>
          </div>
        );
      })}
      <button type="button" style={styles.secondaryBtn} onClick={addStat}>+ Add Stat Card</button>
    </div>
  );
}

function normalizeTestimonialItemForEditor(item, index) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return {
      id: item.id || `testimonial-${index}`,
      text: String(item.text || item.quote || ""),
      author: String(item.author || ""),
      role: String(item.role || ""),
      rating: Number.isFinite(Number(item.rating)) ? Math.max(1, Math.min(5, Number(item.rating))) : 5,
      avatarUrl: String(item.avatarUrl || item.avatar || item.image || ""),
      avatarAssetId: String(item.avatarAssetId || ""),
    };
  }
  return { id: `testimonial-${index}`, text: "", author: "", role: "", rating: 5, avatarUrl: "", avatarAssetId: "" };
}

function normalizeTrustBadgeItem(item, index) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return {
      id: item.id || `trust-badge-${index}`,
      icon: String(item.icon || "✓"),
      label: String(item.label || `Badge ${index + 1}`),
    };
  }

  return {
    id: `trust-badge-${index}`,
    icon: "✓",
    label: String(item || `Badge ${index + 1}`),
  };
}

function TrustBadgesEditor({ badges, onChange }) {
  const safeBadges = (Array.isArray(badges) && badges.length)
    ? badges.map(normalizeTrustBadgeItem)
    : [normalizeTrustBadgeItem({}, 0), normalizeTrustBadgeItem({}, 1), normalizeTrustBadgeItem({}, 2)];

  const updateBadge = (index, patch) => {
    onChange(safeBadges.map((badge, currentIndex) => (
      currentIndex === index ? { ...badge, ...patch } : badge
    )));
  };

  const removeBadge = (index) => {
    const next = safeBadges.filter((_, currentIndex) => currentIndex !== index);
    onChange(next.length ? next : [normalizeTrustBadgeItem({}, 0)]);
  };

  const addBadge = () => {
    onChange([...safeBadges, normalizeTrustBadgeItem({}, safeBadges.length)]);
  };

  return (
    <div style={styles.stackSm}>
      {safeBadges.map((badge, index) => (
        <div key={badge.id || `trust-${index}`} style={styles.linkRowCard}>
          <div style={styles.linkRowHeader}>
            <span style={styles.linkRowTitle}>Badge {index + 1}</span>
            <button type="button" style={styles.linkRowDelete} onClick={() => removeBadge(index)}>Remove</button>
          </div>
          <div style={styles.colorGrid}>
            <div>
              <label style={styles.propertyLabel}>Icon</label>
              <input
                type="text"
                value={badge.icon || ""}
                onChange={(e) => updateBadge(index, { icon: e.target.value })}
                style={styles.propertyInput}
                placeholder="✓"
              />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={styles.propertyLabel}>Label</label>
              <input
                type="text"
                value={badge.label || ""}
                onChange={(e) => updateBadge(index, { label: e.target.value })}
                style={styles.propertyInput}
                placeholder="Trusted by 2,000+ customers"
              />
            </div>
          </div>
        </div>
      ))}
      <button type="button" style={styles.secondaryBtn} onClick={addBadge}>+ Add Badge</button>
    </div>
  );
}

function TrustBadgesPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage, onSelectAsset }) {
  const props = block?.props || {};
  const savedImages = Array.isArray(brandAssets?.images) ? brandAssets.images : [];
  const savedLogo = brandAssets?.logo || null;
  const update = (patch) => onChange(index, { ...props, ...patch });
  const variantLabels = {
    "pill-row": "Pill Row",
    "soft-cards": "Soft Cards",
    "dark-glass": "Dark Glass",
    "logo-strip": "Logo Strip",
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🛡️ Edit: Trust Badges</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Style</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
            {Object.entries(variantLabels).map(([value, label]) => {
              const active = String(props.trustBadgeVariant || "pill-row") === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => update({ trustBadgeVariant: value })}
                  style={{
                    ...styles.secondaryBtn,
                    justifyContent: "center",
                    background: active ? "#2563eb" : undefined,
                    color: active ? "#ffffff" : undefined,
                    border: active ? "1px solid #2563eb" : undefined,
                    fontWeight: active ? 700 : undefined,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Badges</label>
          <TrustBadgesEditor badges={props.badges} onChange={(badges) => update({ badges })} />
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Background</label>
          <ColorSelector label="Section Background" value={props.backgroundColor || "#ffffff"} fallback="#ffffff" allowTransparent onChange={(value) => update({ backgroundColor: value })} />
          <ColorSelector label="Badge Background" value={props.badgeBackgroundColor || "#ffffff"} fallback="#ffffff" allowTransparent onChange={(value) => update({ badgeBackgroundColor: value })} />
          <ColorSelector label="Badge Text" value={props.textColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ textColor: value })} />
          <ColorSelector label="Badge Border" value={props.borderColor || "#cbd5e1"} fallback="#cbd5e1" onChange={(value) => update({ borderColor: value })} />
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Sizing</label>
          <div style={styles.colorGrid}>
            <NumberField label="Icon Size" value={Number(props.badgeIconSize || 18)} min={10} max={48} onChange={(value) => update({ badgeIconSize: value })} />
            <NumberField label="Text Size" value={Number(props.badgeFontSize || 15)} min={10} max={32} onChange={(value) => update({ badgeFontSize: value })} />
            <NumberField label="Pill Padding" value={Number(props.badgePadding || 14)} min={6} max={36} onChange={(value) => update({ badgePadding: value })} />
          </div>
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Background Image</label>
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
                  onUploadImage(index, "backgroundImage", file);
                }}
              />
            </label>
            {savedLogo ? (
              <button type="button" style={styles.assetChip} onClick={() => onSelectAsset(index, "backgroundImage", savedLogo)}>
                Use Logo
              </button>
            ) : null}
            {props.backgroundImage ? (
              <button
                type="button"
                style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }}
                onClick={() => update({ backgroundImage: "" })}
              >
                Remove Image
              </button>
            ) : null}
            {savedImages.slice(0, 6).map((image) => (
              <button
                key={`trust-bg-${image.id}`}
                type="button"
                style={styles.assetThumbBtn}
                onClick={() => onSelectAsset(index, "backgroundImage", image)}
                title={image.name}
              >
                <img src={image.src} alt={image.name} style={styles.assetThumbPreview} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TestimonialItemsEditor({ items, onChange, brandAssets }) {
  const safeItems = (Array.isArray(items) && items.length)
    ? items.map(normalizeTestimonialItemForEditor)
    : [normalizeTestimonialItemForEditor({}, 0)];
  const savedImages = [brandAssets?.logo, ...(Array.isArray(brandAssets?.images) ? brandAssets.images : [])].filter(Boolean).slice(0, 8);

  function updateItem(index, patch) {
    onChange(safeItems.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index) {
    const next = safeItems.filter((_, i) => i !== index);
    onChange(next.length ? next : [normalizeTestimonialItemForEditor({}, 0)]);
  }

  function addItem() {
    onChange([...safeItems, normalizeTestimonialItemForEditor({}, safeItems.length)]);
  }

  return (
    <div style={styles.stackSm}>
      {safeItems.map((item, index) => (
        <div key={item.id || `t-${index}`} style={styles.linkRowCard}>
          <div style={styles.linkRowHeader}>
            <span style={styles.linkRowTitle}>Review {index + 1}</span>
            <button type="button" style={styles.linkRowDelete} onClick={() => removeItem(index)}>Remove</button>
          </div>
          <p style={{ margin: "0 0 8px", color: "#64748b", fontSize: 12 }}>Click quote, name, and role directly on the canvas to edit.</p>
          <label style={{ ...styles.propertyLabel, marginBottom: 4 }}>Star Rating</label>
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => updateItem(index, { rating: n })}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 22,
                  color: n <= (item.rating || 5) ? "#f59e0b" : "#cbd5e1",
                  padding: "2px 1px",
                  lineHeight: 1,
                }}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
              >★</button>
            ))}
          </div>
          <div style={styles.assetPicker}>
            <label style={styles.assetUploadCta}>
              Upload Avatar
              <input
                type="file"
                accept="image/*"
                style={styles.hiddenInput}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  const asset = await createStoredAsset(file);
                  updateItem(index, { avatarUrl: asset.src, avatarAssetId: asset.id || "" });
                }}
              />
            </label>
            {savedImages.map((image) => (
              <button
                key={`tav-${index}-${image.id || image.src}`}
                type="button"
                style={styles.assetThumbBtn}
                onClick={() => updateItem(index, { avatarUrl: image.src, avatarAssetId: image.id || "" })}
                title={image.name}
              >
                <img src={image.src} alt={image.name} style={styles.assetThumbPreview} />
              </button>
            ))}
          </div>
          {item.avatarUrl ? (
            <button type="button" style={{ ...styles.secondaryBtn, marginTop: 6 }} onClick={() => updateItem(index, { avatarUrl: "", avatarAssetId: "" })}>Remove Avatar</button>
          ) : null}
        </div>
      ))}
      <button type="button" style={styles.secondaryBtn} onClick={addItem}>+ Add Review</button>
    </div>
  );
}

function TestimonialPropertiesPanel({ block, index, onChange, brandAssets }) {
  const props = block?.props || {};
  const update = (patch) => onChange(index, { ...props, ...patch });

  const variantLabels = {
    cards: "Cards Grid",
    spotlight: "Spotlight",
    bubble: "Bubble",
    wall: "Colour Wall",
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>⭐ Edit: Testimonials</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Style</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
            {["cards", "spotlight", "bubble", "wall"].map((v) => {
              const active = String(props.testimonialVariant || "cards") === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => update({ testimonialVariant: v })}
                  style={{
                    ...styles.secondaryBtn,
                    justifyContent: "center",
                    background: active ? "#2563eb" : undefined,
                    color: active ? "#ffffff" : undefined,
                    border: active ? "1px solid #2563eb" : undefined,
                    fontWeight: active ? 700 : undefined,
                  }}
                >{variantLabels[v]}</button>
              );
            })}
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Reviews</label>
          <TestimonialItemsEditor
            items={props.items}
            onChange={(items) => update({ items })}
            brandAssets={brandAssets}
          />
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Layout</label>
          <NumberField
            label="Card Width (px)"
            value={Number(props.cardWidth) || 320}
            min={180}
            max={900}
            onChange={(value) => update({ cardWidth: value })}
          />
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Colours</label>
          <div style={styles.colorGrid}>
            <CompactColorField label="Section Background" value={props.backgroundColor || "#f8fafc"} fallback="#f8fafc" onChange={(value) => update({ backgroundColor: value })} />
            <CompactColorField label="Card Background" value={props.cardBackgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ cardBackgroundColor: value })} />
            <CompactColorField label="Text" value={props.textColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ textColor: value })} />
            <CompactColorField label="Border" value={props.borderColor || "rgba(148,163,184,0.28)"} fallback="#e2e8f0" onChange={(value) => update({ borderColor: value })} />
            <CompactColorField label="Accent / Stars" value={props.accentColor || "#f59e0b"} fallback="#f59e0b" onChange={(value) => update({ accentColor: value })} />
          </div>
        </div>
      </div>
    </div>
  );
}

function NewsletterPropertiesPanel({ block, index, onChange }) {
  const props = block?.props || {};
  const update = (patch) => onChange(index, { ...props, ...patch });

  const variantLabels = {
    "centered": "Centered",
    "dark-banner": "Dark Banner",
    "split": "Split",
    "card-highlight": "Card Highlight",
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>📧 Edit: Newsletter Signup</h3>
      <p style={{ margin: "0 0 12px 16px", color: "#64748b", fontSize: 12 }}>Click heading, subtitle, and button text directly on the page to edit.</p>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Style</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
            {["centered", "dark-banner", "split", "card-highlight"].map((v) => {
              const active = String(props.newsletterVariant || "centered") === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => update({ newsletterVariant: v })}
                  style={{
                    ...styles.secondaryBtn,
                    justifyContent: "center",
                    background: active ? "#2563eb" : undefined,
                    color: active ? "#ffffff" : undefined,
                    border: active ? "1px solid #2563eb" : undefined,
                    fontWeight: active ? 700 : undefined,
                  }}
                >{variantLabels[v]}</button>
              );
            })}
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Button Style</label>
          <div style={styles.colorGrid}>
            <CompactColorField label="Button Background" value={props.buttonColor || "#2563eb"} fallback="#2563eb" onChange={(value) => update({ buttonColor: value })} />
            <CompactColorField label="Button Text" value={props.buttonTextColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ buttonTextColor: value })} />
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={styles.propertyLabel}>Button Link / Mailto</label>
            <input
              type="text"
              value={String(props.buttonLink || "")}
              onChange={(e) => update({ buttonLink: e.target.value })}
              style={styles.propertyInput}
              placeholder="mailto:hello@example.com or https://..."
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={styles.propertyLabel}>Button Corner Radius</label>
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={Number.isFinite(Number(props.buttonRadius)) ? Math.max(0, Math.min(Number(props.buttonRadius), 40)) : 40}
              onChange={(e) => {
                const v = Number(e.target.value);
                update({ buttonRadius: v });
              }}
              style={{ width: "100%", marginTop: 4 }}
            />
            <span style={{ color: "#64748b", fontSize: 12 }}>
              {`${Math.max(0, Math.min(Number(props.buttonRadius) || 40, 40))}px`}
            </span>
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Colours</label>
          <div style={styles.colorGrid}>
            <CompactColorField label="Background" value={props.backgroundColor || "#f8fafc"} fallback="#f8fafc" onChange={(value) => update({ backgroundColor: value })} />
            <CompactColorField label="Text" value={props.textColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ textColor: value })} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FooterPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage, onOpenSimpleImageEditor }) {
  const props = block?.props || {};
  const update = (patch) => onChange(index, { ...props, ...patch });

  const updateNavLink = (i, field, value) => {
    const links = [...(Array.isArray(props.navLinks) ? props.navLinks : [])];
    links[i] = { ...links[i], [field]: value };
    update({ navLinks: links });
  };
  const addNavLink = () => update({ navLinks: [...(props.navLinks || []), { label: "New Link", href: "#" }] });
  const removeNavLink = (i) => update({ navLinks: (props.navLinks || []).filter((_, idx) => idx !== i) });

  const updateExtraLink = (i, field, value) => {
    const links = [...(Array.isArray(props.extraLinks) ? props.extraLinks : [])];
    links[i] = { ...links[i], [field]: value };
    update({ extraLinks: links });
  };
  const addExtraLink = () => update({ extraLinks: [...(props.extraLinks || []), { label: "New Link", href: "#" }] });
  const removeExtraLink = (i) => update({ extraLinks: (props.extraLinks || []).filter((_, idx) => idx !== i) });

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🔻 Edit: Footer</h3>
      <div style={styles.propertyGrid}>

        {/* Background colour */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Colours</label>
          <div style={styles.colorGrid}>
            <CompactColorField label="Background" value={props.backgroundColor || "#0f172a"} fallback="#0f172a" onChange={(v) => update({ backgroundColor: v })} />
            <CompactColorField label="Text" value={props.textColor || "#e2e8f0"} fallback="#e2e8f0" onChange={(v) => update({ textColor: v })} />
            <CompactColorField label="Link / Muted" value={props.linkColor || "#94a3b8"} fallback="#94a3b8" onChange={(v) => update({ linkColor: v })} />
            <CompactColorField label="Border" value={props.borderColor || "rgba(148,163,184,0.2)"} fallback="rgba(148,163,184,0.2)" onChange={(v) => update({ borderColor: v })} />
          </div>
        </div>

        {/* Logo */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Logo / Image</label>
          <div style={styles.assetPicker}>
            <label style={styles.assetUploadCta}>
              Upload Logo
              <input
                type="file"
                accept="image/*"
                style={styles.hiddenInput}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  onUploadImage?.(index, "logo", file);
                }}
              />
            </label>
            {brandAssets?.logo ? (
              <button
                type="button"
                style={styles.assetThumbBtn}
                onClick={() => update({ logo: brandAssets.logo.src, logoWidth: props.logoWidth || 48 })}
                title="Use brand logo"
              >
                <img src={brandAssets.logo.src} alt="Brand logo" style={styles.assetThumbPreview} />
              </button>
            ) : null}
          </div>
          {props.logo ? (
            <button
              type="button"
              style={{ ...styles.secondaryBtn, marginTop: 8 }}
              onClick={() => onOpenSimpleImageEditor?.(index, "logo", props.logo)}
            >
              ✂️ Crop / Edit Logo
            </button>
          ) : null}
          <div style={{ marginTop: 8 }}>
            <NumberField label="Logo Width (px)" value={Number(props.logoWidth) || 48} min={20} max={300} onChange={(v) => update({ logoWidth: v })} />
          </div>
        </div>

        {/* Brand & tagline */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Brand Name</label>
          <input type="text" value={String(props.brand || "")} onChange={(e) => update({ brand: e.target.value })} style={styles.propertyInput} placeholder="Your Brand" />
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Tagline</label>
          <input type="text" value={String(props.tagline || "")} onChange={(e) => update({ tagline: e.target.value })} style={styles.propertyInput} placeholder="Your tagline." />
        </div>

        {/* Navigation links */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Navigation Heading</label>
          <input type="text" value={String(props.navHeading || "")} onChange={(e) => update({ navHeading: e.target.value })} style={styles.propertyInput} placeholder="Navigation" />
          <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Nav Links</label>
          {(Array.isArray(props.navLinks) ? props.navLinks : []).map((link, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 4, marginTop: 6 }}>
              <input type="text" value={link.label || ""} onChange={(e) => updateNavLink(i, "label", e.target.value)} style={styles.propertyInput} placeholder="Label" />
              <input type="text" value={link.href || ""} onChange={(e) => updateNavLink(i, "href", e.target.value)} style={styles.propertyInput} placeholder="#url" />
              <button type="button" style={{ ...styles.secondaryBtn, padding: "0 8px", color: "#ef4444" }} onClick={() => removeNavLink(i)}>✕</button>
            </div>
          ))}
          <button type="button" style={{ ...styles.secondaryBtn, marginTop: 8, width: "100%" }} onClick={addNavLink}>+ Add Nav Link</button>
        </div>

        {/* Extra links */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Extra Column Heading</label>
          <input type="text" value={String(props.extraHeading || "")} onChange={(e) => update({ extraHeading: e.target.value })} style={styles.propertyInput} placeholder="Company" />
          <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Extra Links</label>
          {(Array.isArray(props.extraLinks) ? props.extraLinks : []).map((link, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 4, marginTop: 6 }}>
              <input type="text" value={link.label || ""} onChange={(e) => updateExtraLink(i, "label", e.target.value)} style={styles.propertyInput} placeholder="Label" />
              <input type="text" value={link.href || ""} onChange={(e) => updateExtraLink(i, "href", e.target.value)} style={styles.propertyInput} placeholder="#url" />
              <button type="button" style={{ ...styles.secondaryBtn, padding: "0 8px", color: "#ef4444" }} onClick={() => removeExtraLink(i)}>✕</button>
            </div>
          ))}
          <button type="button" style={{ ...styles.secondaryBtn, marginTop: 8, width: "100%" }} onClick={addExtraLink}>+ Add Link</button>
        </div>

        {/* Newsletter */}
        <div style={styles.sectionCard}>
          <label style={styles.inlineToggle}>
            <input type="checkbox" checked={props.showNewsletter !== false} onChange={(e) => update({ showNewsletter: e.target.checked })} />
            Show newsletter signup column
          </label>
          {props.showNewsletter !== false ? (
            <>
              <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Newsletter Heading</label>
              <input type="text" value={String(props.newsletterHeading || "")} onChange={(e) => update({ newsletterHeading: e.target.value })} style={styles.propertyInput} placeholder="Stay Updated" />
              <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Subtitle</label>
              <input type="text" value={String(props.newsletterSubtitle || "")} onChange={(e) => update({ newsletterSubtitle: e.target.value })} style={styles.propertyInput} placeholder="Get the latest news." />
              <div style={{ ...styles.colorGrid, marginTop: 10 }}>
                <CompactColorField label="Button Background" value={props.newsletterButtonColor || "#2563eb"} fallback="#2563eb" onChange={(v) => update({ newsletterButtonColor: v })} />
                <CompactColorField label="Button Text" value={props.newsletterButtonTextColor || "#ffffff"} fallback="#ffffff" onChange={(v) => update({ newsletterButtonTextColor: v })} />
              </div>
            </>
          ) : null}
        </div>

        {/* Copyright */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Copyright Text</label>
          <input type="text" value={String(props.copyrightText || "")} onChange={(e) => update({ copyrightText: e.target.value })} style={styles.propertyInput} placeholder="© 2025 Your Brand." />
        </div>

      </div>
    </div>
  );
}

function TextPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage, onSelectAsset }) {
  const props = block?.props || {};
  const update = (patch) => onChange(index, { ...props, ...patch });
  const savedImages = [brandAssets?.logo, ...(Array.isArray(brandAssets?.images) ? brandAssets.images : [])].filter(Boolean).slice(0, 8);
  const [heightDraft, setHeightDraft] = useState(String(parsePixelValue(props.minHeight, 220)));

  useEffect(() => {
    setHeightDraft(String(parsePixelValue(props.minHeight, 220)));
  }, [block?.id, props.minHeight]);

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>📝 Edit: Text Section</h3>
      <p style={{ margin: "0 0 12px 16px", color: "#64748b", fontSize: 12 }}>Click text directly on the page to edit.</p>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Section Height</label>
          <input
            type="text"
            inputMode="numeric"
            value={heightDraft}
            onChange={(e) => setHeightDraft(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={() => {
              const px = Math.max(120, Number(heightDraft) || 220);
              setHeightDraft(String(px));
              update({ minHeight: `${px}px` });
            }}
            placeholder="220"
            style={styles.propertyInput}
          />
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={!!props.fullWidthBackground}
              onChange={(e) => update({ fullWidthBackground: e.target.checked })}
            />
            Full width background
          </label>
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={props.enableParallax !== false}
              onChange={(e) => update({ enableParallax: e.target.checked })}
            />
            Parallax / free-move text
          </label>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Background Image</label>
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
                  onUploadImage(index, "backgroundImage", file);
                }}
              />
            </label>
            {savedImages.map((image) => (
              <button
                key={`text-bg-${image.id || image.src}`}
                type="button"
                style={styles.assetThumbBtn}
                onClick={() => onSelectAsset(index, "backgroundImage", image)}
                title={image.name}
              >
                <img src={image.src} alt={image.name} style={styles.assetThumbPreview} />
              </button>
            ))}
          </div>
          {props.backgroundImage ? (
            <button type="button" style={{ ...styles.secondaryBtn, marginTop: 6 }} onClick={() => update({ backgroundImage: "" })}>Remove Background</button>
          ) : null}
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Colours</label>
          <div style={styles.colorGrid}>
            <CompactColorField label="Background" value={props.backgroundColor || "#111827"} fallback="#111827" onChange={(value) => update({ backgroundColor: value })} />
            <CompactColorField label="Text" value={props.textColor || "#e6eef5"} fallback="#e6eef5" onChange={(value) => update({ textColor: value })} />
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Font Size</label>
          <NumberField label="Text size (px)" value={Number(props.textFontSize || 18)} min={12} max={72} onChange={(value) => update({ textFontSize: value })} />
        </div>
        <BlockPresetPicker
          blockType={block.type}
          onApply={(patch) => update(patch)}
        />
      </div>
    </div>
  );
}

function StatsPropertiesPanel({ block, index, onChange }) {
  const props = block?.props || {};
  const update = (patch) => onChange(index, { ...props, ...patch });
  const statsStyleLabels = {
    "editorial-band": "Editorial Band",
    "spotlight-orbs": "Spotlight Orbs",
    "split-scoreboard": "Split Scoreboard",
    "minimal-ticker": "Minimal Ticker",
    "data-ribbon": "Data Ribbon",
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>📊 Edit: Stats Cards</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Layout & Formatting</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 8 }}>
            {getSelectOptions("statsVariant").map((option) => {
              const active = String(props.statsVariant || "editorial-band") === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => update({ statsVariant: option })}
                  style={{
                    ...styles.secondaryBtn,
                    justifyContent: "center",
                    background: active ? "#dbeafe" : "#ffffff",
                    borderColor: active ? "#2563eb" : "rgba(148,163,184,0.24)",
                    color: active ? "#0f172a" : "#334155",
                    fontWeight: active ? 800 : 600,
                  }}
                >
                  {statsStyleLabels[option] || option}
                </button>
              );
            })}
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Stat Cards</label>
          <StatsItemsEditor stats={props.stats} onChange={(stats) => update({ stats })} />
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Colours</label>
          <div style={styles.colorGrid}>
            <CompactColorField label="Section Background" value={props.backgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ backgroundColor: value })} />
            <CompactColorField label="Text" value={props.textColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ textColor: value })} />
            <CompactColorField label="Border" value={props.borderColor || "#e2e8f0"} fallback="#e2e8f0" onChange={(value) => update({ borderColor: value })} />
            <CompactColorField label="Card Background" value={props.cardBackgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ cardBackgroundColor: value })} />
            <CompactColorField label="Accent" value={props.accentColor || "#0ea5e9"} fallback="#0ea5e9" onChange={(value) => update({ accentColor: value })} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ContainerImageControls({ src, imageX, imageY, onChange, onEditImage }) {
  const safeX = Number.isFinite(Number(imageX)) ? Math.max(0, Math.min(100, Number(imageX))) : 50;
  const safeY = Number.isFinite(Number(imageY)) ? Math.max(0, Math.min(100, Number(imageY))) : 50;

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={styles.secondaryBtn} disabled={!src} onClick={() => onEditImage?.()}>
          Crop / Remove BG
        </button>
        <button type="button" style={styles.secondaryBtn} onClick={() => onChange?.({ imageX: 50, imageY: 50 })}>
          Reset Focus
        </button>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <label style={styles.propertyLabel}>
          Focus X: {Math.round(safeX)}%
          <input type="range" min={0} max={100} value={safeX} onChange={(event) => onChange?.({ imageX: Number(event.target.value) })} style={{ width: "100%", marginTop: 6 }} />
        </label>
        <label style={styles.propertyLabel}>
          Focus Y: {Math.round(safeY)}%
          <input type="range" min={0} max={100} value={safeY} onChange={(event) => onChange?.({ imageY: Number(event.target.value) })} style={{ width: "100%", marginTop: 6 }} />
        </label>
      </div>
    </div>
  );
}

function TeamMembersEditor({ members, onChange, brandAssets, onOpenImageEditor, onUploadImage, isHierarchyLayout = false }) {
  const safeMembers = Array.isArray(members) ? members : [];
  const savedImages = [brandAssets?.logo, ...(Array.isArray(brandAssets?.images) ? brandAssets.images : [])].filter(Boolean).slice(0, 8);

  function updateMember(index, patch) {
    onChange(safeMembers.map((item, itemIndex) => (
      itemIndex === index ? { ...normalizeTeamMember(item, itemIndex), ...patch } : item
    )));
  }

  function removeMember(index) {
    onChange(safeMembers.filter((_, itemIndex) => itemIndex !== index));
  }

  function addMember() {
    onChange([...safeMembers, {
      id: `team-member-${Date.now()}-${safeMembers.length}`,
      name: `Team Member ${safeMembers.length + 1}`,
      role: "Role",
      bio: "Add a short team bio.",
      image: `https://placehold.co/900x1100/e2e8f0/0f172a?text=${encodeURIComponent(`Member ${safeMembers.length + 1}`)}`,
      imageAssetId: "",
      hierarchyRow: isHierarchyLayout && safeMembers.length ? normalizeTeamMember(safeMembers[safeMembers.length - 1], safeMembers.length - 1).hierarchyRow : 0,
      imageX: 50,
      imageY: 50,
    }]);
  }

  async function uploadMemberImage(memberIndex, file) {
    // Use a __ prefix so handleCanvasImageUpload skips applyAssetToCanvasBlock,
    // which would otherwise mis-apply the asset to the block's top-level image prop.
    const uploadedAsset = await Promise.resolve(onUploadImage?.(memberIndex, "__team_member_image__", file));
    if (uploadedAsset?.id) {
      updateMember(memberIndex, {
        image: uploadedAsset.src || "",
        imageAssetId: uploadedAsset.id,
      });
      return;
    }
    // Fallback when onUploadImage is missing or returns nothing (e.g. canvas route).
    const fallbackAsset = await createStoredAsset(file, { maxWidth: 960, maxHeight: 960, quality: 0.68 });
    const existingImages = Array.isArray(brandAssets?.images) ? brandAssets.images : [];
    const dedupedImages = existingImages.filter((img) => img?.src && img.src !== fallbackAsset.src && img.name !== fallbackAsset.name);
    saveWebsiteBuilderAssets({ ...brandAssets, images: [fallbackAsset, ...dedupedImages].slice(0, 12) });
    updateMember(memberIndex, { image: fallbackAsset.src || "", imageAssetId: fallbackAsset.id || "" });
  }

  return (
    <div style={styles.stackSm}>
      {safeMembers.map((rawMember, index) => {
        const member = normalizeTeamMember(rawMember, index);
        const memberAsset = getAssetFromLibrary(brandAssets, member.imageAssetId) || savedImages.find((image) => image?.id && image.id === member.imageAssetId) || null;
        const memberImageSrc = memberAsset?.src || member.image;
        return (
          <div key={`${index}-${member.id}`} style={styles.linkRowCard}>
            <div style={styles.linkRowHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={styles.linkRowTitle}>Member {index + 1}</span>
                {isHierarchyLayout ? (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#475569", fontSize: 12, fontWeight: 700 }}>
                    Row
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={member.hierarchyRow + 1}
                      onChange={(e) => {
                        const nextRow = Math.max(1, Number.parseInt(e.target.value, 10) || 1) - 1;
                        updateMember(index, { hierarchyRow: nextRow });
                      }}
                      style={{ ...styles.propertyInput, width: 72, minWidth: 72, padding: "6px 10px" }}
                    />
                  </label>
                ) : null}
              </div>
              <button type="button" style={styles.linkRowDelete} onClick={() => removeMember(index)}>Remove</button>
            </div>
            <p style={{ margin: "0 0 8px", color: "#64748b", fontSize: 12 }}>Click name, role, or bio directly on the page to edit.</p>
            <input
              type="text"
              value={memberImageSrc}
              onChange={(e) => updateMember(index, { image: e.target.value, imageAssetId: "" })}
              style={styles.propertyInput}
              placeholder="Image URL"
            />
            <div style={{ ...styles.assetPicker, marginTop: 8 }}>
              <label style={styles.assetUploadCta}>
                Upload Image
                <input
                  type="file"
                  accept="image/*"
                  style={styles.hiddenInput}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    await uploadMemberImage(index, file);
                  }}
                />
              </label>
              {savedImages.map((image) => (
                <button
                  key={`team-member-${index}-${image.id || image.src}`}
                  type="button"
                  style={styles.assetThumbBtn}
                  onClick={() => updateMember(index, {
                    image: String(image.src || "").startsWith("data:") ? "" : (image.src || ""),
                    imageAssetId: image.id || "",
                  })}
                  title={image.name}
                >
                  <img src={image.src} alt={image.name} style={styles.assetThumbPreview} />
                </button>
              ))}
            </div>
            <ContainerImageControls
              src={memberImageSrc}
              imageX={member.imageX}
              imageY={member.imageY}
              onChange={(patch) => updateMember(index, patch)}
              onEditImage={() => onOpenImageEditor?.(index, "image", memberImageSrc)}
            />
          </div>
        );
      })}
      <button type="button" style={styles.secondaryBtn} onClick={addMember}>+ Add Member</button>
    </div>
  );
}

function TeamPropertiesPanel({ block, index, onChange, brandAssets, onOpenImageEditor, onUploadImage }) {
  const props = block?.props || {};
  const update = (patch) => onChange(index, { ...props, ...patch });
  const isHierarchyLayout = String(props.teamVariant || "studio-cards") === "hierarchy-layout";
  const teamStyleLabels = {
    "studio-cards": "Studio Cards",
    "editorial-split": "Editorial Split",
    "spotlight-strip": "Spotlight Strip",
    "minimal-list": "Minimal List",
    "hierarchy-layout": "Hierarchy Layout",
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>👥 Edit: Team Section</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Team Style</label>
          <select value={String(props.teamVariant || "studio-cards")} onChange={(e) => update({ teamVariant: e.target.value })} style={styles.propertyInput}>
            {getSelectOptions("teamVariant").map((option) => (
              <option key={option} value={option}>{teamStyleLabels[option] || option}</option>
            ))}
          </select>
          {isHierarchyLayout ? <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>Set the row number on each team member card.</p> : null}
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Team Members</label>
          <TeamMembersEditor members={props.members} onChange={(members) => update({ members })} brandAssets={brandAssets} onOpenImageEditor={(itemIndex, imageKey, src) => onOpenImageEditor?.(index, "members", itemIndex, imageKey, src)} onUploadImage={(itemIndex, imageKey, file) => onUploadImage?.(index, imageKey, file, itemIndex)} isHierarchyLayout={isHierarchyLayout} />
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Colours</label>
          <div style={styles.colorGrid}>
            <CompactColorField label="Section Background" value={props.backgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ backgroundColor: value })} />
            <CompactColorField label="Text" value={props.textColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ textColor: value })} />
            <CompactColorField label="Border" value={props.borderColor || "#e2e8f0"} fallback="#e2e8f0" onChange={(value) => update({ borderColor: value })} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ensureGalleryImagesCount(images, count) {
  const safeImages = Array.isArray(images) ? images.map((item, index) => normalizeGalleryItem(item, index)) : [];
  const targetCount = Math.max(1, Number(count) || 1);
  if (safeImages.length >= targetCount) return safeImages;

  const nextImages = [...safeImages];
  for (let index = safeImages.length; index < targetCount; index += 1) {
    nextImages.push(createDefaultGalleryItem(index));
  }
  return nextImages;
}

function ListItemsEditor({ items, onChange, brandAssets, onOpenImageEditor }) {
  const safeItems = Array.isArray(items) ? items : [];
  const savedImages = [brandAssets?.logo, ...(Array.isArray(brandAssets?.images) ? brandAssets.images : [])].filter(Boolean).slice(0, 8);

  function updateItem(index, patch) {
    onChange(safeItems.map((item, itemIndex) => (
      itemIndex === index ? { ...normalizeFeatureListItem(item, itemIndex), ...patch } : item
    )));
  }

  function removeItem(index) {
    onChange(safeItems.filter((_, itemIndex) => itemIndex !== index));
  }

  function addItem() {
    onChange([...safeItems, {
      id: `feature-item-${Date.now()}-${safeItems.length}`,
      title: `List item ${safeItems.length + 1}`,
      body: "Add a short supporting sentence.",
      image: `https://placehold.co/960x720/e2e8f0/0f172a?text=${encodeURIComponent(`Item ${safeItems.length + 1}`)}`,
      imageX: 50,
      imageY: 50,
    }]);
  }

  return (
    <div style={styles.stackSm}>
      {safeItems.map((rawItem, index) => {
        const item = normalizeFeatureListItem(rawItem, index);
        return (
        <div key={`${index}-${item.id}`} style={styles.linkRowCard}>
          <div style={styles.linkRowHeader}>
            <span style={styles.linkRowTitle}>Item {index + 1}</span>
            <button type="button" style={styles.linkRowDelete} onClick={() => removeItem(index)}>Remove</button>
          </div>
          <p style={{ margin: 0, color: "#475569", fontSize: 13 }}>
            Edit the item title and copy directly on the page.
          </p>
          <input
            type="text"
            value={item.image}
            onChange={(e) => updateItem(index, { image: e.target.value })}
            style={{ ...styles.propertyInput, marginTop: 10 }}
            placeholder="Image URL"
          />
          <div style={{ ...styles.assetPicker, marginTop: 8 }}>
            <label style={styles.assetUploadCta}>
              Upload Image
              <input
                type="file"
                accept="image/*"
                style={styles.hiddenInput}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  const asset = await createStoredAsset(file);
                  updateItem(index, { image: asset.src });
                }}
              />
            </label>
            {savedImages.map((image) => (
              <button
                key={`feature-item-${index}-${image.id || image.src}`}
                type="button"
                style={styles.assetThumbBtn}
                onClick={() => updateItem(index, { image: image.src || "" })}
                title={image.name}
              >
                <img src={image.src} alt={image.name} style={styles.assetThumbPreview} />
              </button>
            ))}
          </div>
          <ContainerImageControls
            src={item.image}
            imageX={item.imageX}
            imageY={item.imageY}
            onChange={(patch) => updateItem(index, patch)}
            onEditImage={() => onOpenImageEditor?.(index, "image", item.image)}
          />
        </div>
      );})}
      <button type="button" style={styles.secondaryBtn} onClick={addItem}>+ Add Item</button>
    </div>
  );
}

function FeatureListPropertiesPanel({ block, index, onChange, brandAssets, onOpenImageEditor }) {
  const props = block?.props || {};
  const update = (patch) => onChange(index, { ...props, ...patch });
  const [cardWidthDraft, setCardWidthDraft] = useState("");
  const featureStyleLabels = {
    cards: "Showcase Cards",
    "glass-cards": "Glass Gallery",
    "editorial-strip": "Editorial Split",
    "minimal-list": "Minimal Thumb List",
  };

  useEffect(() => {
    setCardWidthDraft(String(Math.max(220, Number(props.featureCardWidth) || 320)));
  }, [props.featureCardWidth]);

  const commitCardWidthDraft = () => {
    const nextWidth = Math.max(220, Math.min(520, Number(cardWidthDraft || 0) || 320));
    const nextValue = String(nextWidth);
    setCardWidthDraft(nextValue);
    update({ featureCardWidth: nextWidth });
  };

  const displayCardWidth = Math.max(220, Math.min(520, Number(cardWidthDraft || 0) || Number(props.featureCardWidth) || 320));

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>☰ Edit: List Block</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>List Items</label>
          <ListItemsEditor items={props.items} onChange={(items) => update({ items })} brandAssets={brandAssets} onOpenImageEditor={(itemIndex, imageKey, src) => onOpenImageEditor?.(index, "items", itemIndex, imageKey, src)} />
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>List Style</label>
          <select value={String(props.featureVariant || "cards")} onChange={(e) => update({ featureVariant: e.target.value })} style={styles.propertyInput}>
            {getSelectOptions("featureVariant").map((option) => (
              <option key={option} value={option}>{featureStyleLabels[option] || option}</option>
            ))}
          </select>
          <label style={{ ...styles.propertyLabel, marginTop: 12, display: "block" }}>
            Card Width: {Math.round(displayCardWidth)}px
          </label>
          <input
            type="text"
            value={cardWidthDraft}
            onChange={(e) => setCardWidthDraft(String(e.target.value || "").replace(/[^\d]/g, ""))}
            onBlur={commitCardWidthDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitCardWidthDraft();
              }
            }}
            inputMode="numeric"
            placeholder="320"
            style={{ ...styles.propertyInput, marginTop: 8 }}
          />
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Colours</label>
          <div style={styles.colorGrid}>
            <div style={styles.colorField}>
              <span style={styles.colorLabel}>Section Background</span>
              <input type="color" value={normalizeColorInput(props.backgroundColor, "#ffffff")} onChange={(e) => update({ backgroundColor: e.target.value })} style={styles.colorInput} />
              <div style={styles.colorSwatchRow}>
                {STANDARD_COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={`feature-section-${swatch}`}
                    type="button"
                    title={swatch}
                    onClick={() => update({ backgroundColor: swatch })}
                    style={{ ...styles.colorSwatch, background: swatch, borderColor: String(props.backgroundColor || "#ffffff").toLowerCase() === swatch.toLowerCase() ? "#7dd3fc" : "rgba(148,163,184,0.28)" }}
                  />
                ))}
              </div>
            </div>
            <div style={styles.colorField}>
              <span style={styles.colorLabel}>Item Background</span>
              <input type="color" value={normalizeColorInput(props.itemBackgroundColor, "#eff6ff")} onChange={(e) => update({ itemBackgroundColor: e.target.value })} style={styles.colorInput} />
              <div style={styles.colorSwatchRow}>
                {STANDARD_COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={`feature-item-${swatch}`}
                    type="button"
                    title={swatch}
                    onClick={() => update({ itemBackgroundColor: swatch })}
                    style={{ ...styles.colorSwatch, background: swatch, borderColor: String(props.itemBackgroundColor || "#eff6ff").toLowerCase() === swatch.toLowerCase() ? "#7dd3fc" : "rgba(148,163,184,0.28)" }}
                  />
                ))}
              </div>
            </div>
            <div style={styles.colorField}>
              <span style={styles.colorLabel}>Text</span>
              <input type="color" value={normalizeColorInput(props.textColor, "#0f172a")} onChange={(e) => update({ textColor: e.target.value })} style={styles.colorInput} />
              <div style={styles.colorSwatchRow}>
                {STANDARD_COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={`feature-text-${swatch}`}
                    type="button"
                    title={swatch}
                    onClick={() => update({ textColor: swatch })}
                    style={{ ...styles.colorSwatch, background: swatch, borderColor: String(props.textColor || "#0f172a").toLowerCase() === swatch.toLowerCase() ? "#7dd3fc" : "rgba(148,163,184,0.28)" }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GalleryImagesEditor({ images, onChange, brandAssets, onOpenImageEditor }) {
  const safeImages = Array.isArray(images) ? images : [];
  const savedImages = [brandAssets?.logo, ...(Array.isArray(brandAssets?.images) ? brandAssets.images : [])].filter(Boolean).slice(0, 8);

  function updateImage(index, patch) {
    onChange(safeImages.map((item, itemIndex) => (
      itemIndex === index ? { ...normalizeGalleryItem(item, itemIndex), ...patch } : item
    )));
  }

  function removeImage(index) {
    onChange(safeImages.filter((_, itemIndex) => itemIndex !== index));
  }

  function addImage() {
    onChange([...safeImages, createDefaultGalleryItem(safeImages.length)]);
  }

  return (
    <div style={styles.stackSm}>
      {safeImages.map((rawItem, index) => {
        const item = normalizeGalleryItem(rawItem, index);
        return (
          <div key={`${index}-${item.id}`} style={styles.linkRowCard}>
            <div style={styles.linkRowHeader}>
              <span style={styles.linkRowTitle}>Image {index + 1}</span>
              <button type="button" style={styles.linkRowDelete} onClick={() => removeImage(index)}>Remove</button>
            </div>
            <input type="text" value={item.src} onChange={(e) => updateImage(index, { src: e.target.value })} style={styles.propertyInput} placeholder="Image URL" />
            <input type="text" value={item.alt} onChange={(e) => updateImage(index, { alt: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="Alt text" />
            <input type="text" value={item.caption} onChange={(e) => updateImage(index, { caption: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="Caption" />
            <div style={{ ...styles.assetPicker, marginTop: 8 }}>
              <label style={styles.assetUploadCta}>
                Upload From Computer
                <input
                  type="file"
                  accept="image/*"
                  style={styles.hiddenInput}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    const asset = await createStoredAsset(file);
                    updateImage(index, { src: asset.src, alt: asset.name || item.alt });
                  }}
                />
              </label>
              {savedImages.map((image) => (
                <button
                  key={`gallery-item-${index}-${image.id || image.src}`}
                  type="button"
                  style={styles.assetThumbBtn}
                  onClick={() => updateImage(index, { src: image.src || "", alt: image.name || item.alt })}
                  title={image.name}
                >
                  <img src={image.src} alt={image.name} style={styles.assetThumbPreview} />
                </button>
              ))}
            </div>
            <ContainerImageControls
              src={item.src}
              imageX={item.imageX}
              imageY={item.imageY}
              onChange={(patch) => updateImage(index, patch)}
              onEditImage={() => onOpenImageEditor?.(index, "src", item.src)}
            />
          </div>
        );
      })}
      <button type="button" style={styles.secondaryBtn} onClick={addImage}>+ Add Image</button>
    </div>
  );
}

function ImageGalleryPropertiesPanel({ block, index, onChange, brandAssets, onOpenImageEditor }) {
  const props = block?.props || {};
  const update = (patch) => onChange(index, { ...props, ...patch });
  const syncColumns = (nextColumns) => {
    const safeColumns = Math.max(1, Math.min(5, Number(nextColumns) || 3));
    onChange(index, {
      ...props,
      columns: safeColumns,
      images: ensureGalleryImagesCount(props.images, safeColumns),
    });
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🖼️ Edit: Image Gallery</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Title</label>
          <input type="text" value={props.title || ""} onChange={(e) => update({ title: e.target.value })} style={styles.propertyInput} />
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Gallery Style</label>
          <select value={String(props.galleryVariant || "balanced-grid")} onChange={(e) => update({ galleryVariant: e.target.value })} style={styles.propertyInput}>
            {getSelectOptions("galleryVariant").map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <div style={{ marginTop: 10 }}>
            <label style={styles.propertyLabel}>Columns</label>
            <input type="number" min={1} max={5} value={Number(props.columns || 3)} onChange={(e) => syncColumns(e.target.value)} style={styles.propertyInput} />
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Images</label>
          <GalleryImagesEditor images={props.images} onChange={(images) => update({ images })} brandAssets={brandAssets} onOpenImageEditor={(itemIndex, imageKey, src) => onOpenImageEditor?.(index, "images", itemIndex, imageKey, src)} />
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Colours</label>
          <div style={styles.colorGrid}>
            <CompactColorField label="Section Background" value={props.backgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ backgroundColor: value })} />
            <CompactColorField label="Text" value={props.textColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ textColor: value })} />
            <CompactColorField label="Border" value={props.borderColor || "#e2e8f0"} fallback="#e2e8f0" onChange={(value) => update({ borderColor: value })} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PricingTablePropertiesPanel({ block, index, onChange }) {
  const props = block?.props || {};
  const plans = normalizePricingPlans(props.plans);
  const replace = (nextProps) => onChange(index, nextProps);
  const update = (patch) => replace({ ...props, ...patch });
  const pricingSectionShells = [
    { background: "linear-gradient(180deg,#10243e,#153255)", borderColor: "#2f6fca" },
    { background: "linear-gradient(180deg,#12372d,#184a3c)", borderColor: "#2da66d" },
    { background: "linear-gradient(180deg,#341f4e,#4b2d73)", borderColor: "#8f63d8" },
    { background: "linear-gradient(180deg,#2f2435,#4b2f52)", borderColor: "#c061a6" },
  ];
  const planEditorShells = [
    { background: "linear-gradient(180deg,#102d4f,#153f6d)", borderColor: "#4ea1ff" },
    { background: "linear-gradient(180deg,#153b2f,#1b5a46)", borderColor: "#4ed39a" },
    { background: "linear-gradient(180deg,#3b2251,#5b2f7d)", borderColor: "#b27cff" },
    { background: "linear-gradient(180deg,#49242e,#6b3242)", borderColor: "#ff7cb0" },
  ];

  const updatePlan = (planIndex, patch) => {
    const normalizedPatch = {
      ...patch,
      ...(Object.prototype.hasOwnProperty.call(patch, "name") ? { name: htmlToPlainText(patch.name) } : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, "price") ? { price: htmlToPlainText(patch.price) } : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, "description") ? { description: htmlToPlainText(patch.description) } : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, "cta") ? { cta: htmlToPlainText(patch.cta) } : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, "includedFeatures") ? { includedFeatures: (Array.isArray(patch.includedFeatures) ? patch.includedFeatures : []).map((item) => htmlToPlainText(item)) } : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, "features") ? { features: (Array.isArray(patch.features) ? patch.features : []).map((item) => htmlToPlainText(item)) } : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, "extras") ? { extras: (Array.isArray(patch.extras) ? patch.extras : []).map((item) => htmlToPlainText(item)) } : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, "cardBackgroundColor") ? { cardBackgroundColor: String(patch.cardBackgroundColor || "") } : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, "textColor") ? { textColor: String(patch.textColor || "") } : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, "subtleTextColor") ? { subtleTextColor: String(patch.subtleTextColor || "") } : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, "ctaTextColor") ? { ctaTextColor: String(patch.ctaTextColor || "") } : {}),
    };
    const nextPlans = plans.map((plan, currentIndex) => (
      currentIndex === planIndex
        ? {
            ...plan,
            ...normalizedPatch,
            features: Object.prototype.hasOwnProperty.call(normalizedPatch, "includedFeatures") ? normalizedPatch.includedFeatures : plan.features,
          }
        : plan
    ));
    update({ plans: nextPlans });
  };

  const updateFeature = (planIndex, featureIndex, nextValue) => {
    const plan = plans[planIndex] || {};
    const includedFeatures = Array.isArray(plan.includedFeatures) ? [...plan.includedFeatures] : [];
    includedFeatures[featureIndex] = htmlToPlainText(nextValue);
    updatePlan(planIndex, { includedFeatures, features: includedFeatures });
  };

  const updateExtra = (planIndex, extraIndex, nextValue) => {
    const plan = plans[planIndex] || {};
    const extras = Array.isArray(plan.extras) ? [...plan.extras] : [];
    extras[extraIndex] = htmlToPlainText(nextValue);
    updatePlan(planIndex, { extras });
  };

  const addPlan = () => {
    update({
      plans: [
        ...plans,
        createPricingPlan(plans.length),
      ],
    });
  };

  const removePlan = (planIndex) => {
    update({ plans: plans.filter((_, currentIndex) => currentIndex !== planIndex) });
  };

  const addFeature = (planIndex) => {
    const plan = plans[planIndex] || {};
    const includedFeatures = Array.isArray(plan.includedFeatures) ? [...plan.includedFeatures, `Included ${((plan.includedFeatures || []).length || 0) + 1}`] : ["Included 1"];
    updatePlan(planIndex, { includedFeatures, features: includedFeatures });
  };

  const removeFeature = (planIndex, featureIndex) => {
    const plan = plans[planIndex] || {};
    const includedFeatures = Array.isArray(plan.includedFeatures) ? plan.includedFeatures.filter((_, currentIndex) => currentIndex !== featureIndex) : [];
    updatePlan(planIndex, { includedFeatures, features: includedFeatures });
  };

  const addExtra = (planIndex) => {
    const plan = plans[planIndex] || {};
    const extras = Array.isArray(plan.extras) ? [...plan.extras, `Extra ${((plan.extras || []).length || 0) + 1}`] : ["Extra 1"];
    updatePlan(planIndex, { extras });
  };

  const removeExtra = (planIndex, extraIndex) => {
    const plan = plans[planIndex] || {};
    const extras = Array.isArray(plan.extras) ? plan.extras.filter((_, currentIndex) => currentIndex !== extraIndex) : [];
    updatePlan(planIndex, { extras });
  };

  const setHighlightedPlan = (planIndex, checked) => {
    update({
      plans: plans.map((plan, currentIndex) => ({
        ...plan,
        highlighted: checked ? currentIndex === planIndex : (currentIndex === planIndex ? false : plan.highlighted),
        badge: "",
      })),
    });
  };

  const resetPricingTable = () => {
    const defaults = BlockDefinitions[BlockTypes.PRICING_TABLE]?.defaultProps || {};
    replace({
      ...defaults,
      plans: normalizePricingPlans(defaults.plans),
    });
  };

  return (
    <div style={styles.properties}>
      <div style={styles.propertiesHeaderRow}>
        <h3 style={styles.propertiesTitle}>💳 Edit: Pricing Table</h3>
        <button type="button" style={styles.ghostBtn} onClick={resetPricingTable}>Reset</button>
      </div>
      <div style={styles.propertyGrid}>
        <div style={{ ...styles.sectionCard, ...pricingSectionShells[0] }}>
          <label style={styles.propertyLabel}>Section Title</label>
          <input type="text" value={htmlToPlainText(props.title || "")} onChange={(e) => update({ title: htmlToPlainText(e.target.value) })} style={styles.propertyInput} />
        </div>
        <div style={{ ...styles.sectionCard, ...pricingSectionShells[1] }}>
          <label style={styles.propertyLabel}>Pricing Variant</label>
          <select value={String(props.pricingVariant || "premium")} onChange={(e) => update({ pricingVariant: e.target.value })} style={styles.propertyInput}>
            {getSelectOptions("pricingVariant").map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <div style={{ marginTop: 8 }}>
            <NumberField label="Card Width" value={Number(props.pricingCardWidth || 260)} min={180} max={520} onChange={(value) => update({ pricingCardWidth: value })} />
          </div>
          <div style={{ marginTop: 8 }}>
            <NumberField label="Card Gap" value={Number(props.pricingCardGap || 24)} min={8} max={64} onChange={(value) => update({ pricingCardGap: value })} />
          </div>
        </div>
        <div style={{ ...styles.sectionCard, ...pricingSectionShells[2] }}>
          <label style={styles.propertyLabel}>Colour Controls</label>
          <div style={styles.pricingColorGrid}>
            <CompactColorField label="Section Background" value={props.backgroundColor || "#f8fbff"} fallback="#f8fbff" onChange={(value) => update({ backgroundColor: value })} />
            <CompactColorField label="Section Border" value={props.borderColor || "#cbd5e1"} fallback="#cbd5e1" onChange={(value) => update({ borderColor: value })} />
            <CompactColorField label="Accent" value={props.accentColor || "#0ea5e9"} fallback="#0ea5e9" onChange={(value) => update({ accentColor: value })} />
            <CompactColorField label="Card Background" value={props.cardBackgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ cardBackgroundColor: value })} />
            <CompactColorField label="Highlight Card" value={props.highlightedCardBackgroundColor || "#eff6ff"} fallback="#eff6ff" onChange={(value) => update({ highlightedCardBackgroundColor: value })} />
            <CompactColorField label="Feature Surface" value={props.featureBackgroundColor || "#f8fafc"} fallback="#f8fafc" onChange={(value) => update({ featureBackgroundColor: value })} />
            <CompactColorField label="Extras Surface" value={props.extrasBackgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ extrasBackgroundColor: value })} />
            <CompactColorField label="CTA Background" value={props.ctaBackgroundColor || "#0ea5e9"} fallback="#0ea5e9" onChange={(value) => update({ ctaBackgroundColor: value })} />
            <CompactColorField label="CTA Text" value={props.ctaTextColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ ctaTextColor: value })} />
            <CompactColorField label="Main Text" value={props.textColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ textColor: value })} />
            <CompactColorField label="Muted Text" value={props.subtleTextColor || "#64748b"} fallback="#64748b" onChange={(value) => update({ subtleTextColor: value })} />
          </div>
        </div>
        <div style={{ ...styles.sectionCard, ...pricingSectionShells[3] }}>
          <label style={styles.propertyLabel}>Plans</label>
          <div style={styles.propertyGrid}>
            {plans.map((plan, planIndex) => (
              <div
                key={`plan-${planIndex}`}
                style={{
                  ...styles.linkRowCard,
                  ...planEditorShells[planIndex % planEditorShells.length],
                  ...(plan.highlighted ? { boxShadow: "0 0 0 1px rgba(125,211,252,0.3), 0 14px 28px rgba(15,23,42,0.24)" } : {}),
                }}
              >
                <div style={styles.linkRowHeader}>
                  <span style={styles.linkRowTitle}>{plan.name || `Plan ${planIndex + 1}`}</span>
                  <div style={styles.linkActions}>
                    <label style={styles.inlineToggle}>
                      <input
                        type="checkbox"
                        checked={!!plan.highlighted}
                        onChange={(e) => setHighlightedPlan(planIndex, e.target.checked)}
                      />
                      Highlighted
                    </label>
                    <button type="button" style={styles.iconDeleteBtn} aria-label="Delete plan" title="Delete plan" onClick={() => removePlan(planIndex)}>×</button>
                  </div>
                </div>
                <input type="text" value={String(plan.name || "")} onChange={(e) => updatePlan(planIndex, { name: e.target.value })} style={styles.propertyInput} placeholder="Plan name" />
                <input type="text" value={String(plan.price || "")} onChange={(e) => updatePlan(planIndex, { price: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="$49" />
                <input type="text" value={String(plan.description || "")} onChange={(e) => updatePlan(planIndex, { description: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="Short description" />
                <input type="text" value={String(plan.cta || "")} onChange={(e) => updatePlan(planIndex, { cta: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="Button text" />
                <div style={{ marginTop: 8 }}>
                  <CompactColorField
                    label="Card Background"
                    value={plan.cardBackgroundColor || (plan.highlighted ? (props.highlightedCardBackgroundColor || "#eff6ff") : (props.cardBackgroundColor || "#ffffff"))}
                    fallback={plan.highlighted ? (props.highlightedCardBackgroundColor || "#eff6ff") : (props.cardBackgroundColor || "#ffffff")}
                    onChange={(value) => updatePlan(planIndex, { cardBackgroundColor: value })}
                  />
                </div>
                <div style={{ marginTop: 8 }}>
                  <CompactColorField
                    label="Main Text"
                    value={plan.textColor || (props.textColor || "#0f172a")}
                    fallback={props.textColor || "#0f172a"}
                    onChange={(value) => updatePlan(planIndex, { textColor: value })}
                  />
                </div>
                <div style={{ marginTop: 8 }}>
                  <CompactColorField
                    label="Muted Text"
                    value={plan.subtleTextColor || (props.subtleTextColor || "#64748b")}
                    fallback={props.subtleTextColor || "#64748b"}
                    onChange={(value) => updatePlan(planIndex, { subtleTextColor: value })}
                  />
                </div>
                <div style={{ marginTop: 8 }}>
                  <CompactColorField
                    label="CTA Text"
                    value={plan.ctaTextColor || (props.ctaTextColor || "#ffffff")}
                    fallback={props.ctaTextColor || "#ffffff"}
                    onChange={(value) => updatePlan(planIndex, { ctaTextColor: value })}
                  />
                </div>
                <div style={{ marginTop: 8 }}>
                  <label style={styles.propertyLabel}>Feature Icon</label>
                  <select value={String(plan.featureIcon || "tick")} onChange={(e) => updatePlan(planIndex, { featureIcon: e.target.value })} style={styles.propertyInput}>
                    {getSelectOptions("featureIcon").map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  <label style={styles.propertyLabel}>Included Features</label>
                  {(Array.isArray(plan.includedFeatures) ? plan.includedFeatures : []).map((feature, featureIndex) => (
                    <div key={`plan-${planIndex}-feature-${featureIndex}`} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, alignItems: "center", minWidth: 0 }}>
                      <input
                        type="text"
                        value={String(feature || "")}
                        onChange={(e) => updateFeature(planIndex, featureIndex, e.target.value)}
                        style={styles.propertyInput}
                        placeholder={`Feature ${featureIndex + 1}`}
                      />
                      <button type="button" style={styles.iconDeleteBtn} aria-label={`Delete feature ${featureIndex + 1}`} title="Delete feature" onClick={() => removeFeature(planIndex, featureIndex)}>×</button>
                    </div>
                  ))}
                </div>
                <button type="button" style={{ ...styles.secondaryBtn, marginTop: 10 }} onClick={() => addFeature(planIndex)}>+ Add Included Feature</button>
                <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                  <label style={styles.propertyLabel}>Extras</label>
                  {(Array.isArray(plan.extras) ? plan.extras : []).map((extra, extraIndex) => (
                    <div key={`plan-${planIndex}-extra-${extraIndex}`} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, alignItems: "center", minWidth: 0 }}>
                      <input
                        type="text"
                        value={String(extra || "")}
                        onChange={(e) => updateExtra(planIndex, extraIndex, e.target.value)}
                        style={styles.propertyInput}
                        placeholder={`Extra ${extraIndex + 1}`}
                      />
                      <button type="button" style={styles.iconDeleteBtn} aria-label={`Delete extra ${extraIndex + 1}`} title="Delete extra" onClick={() => removeExtra(planIndex, extraIndex)}>×</button>
                    </div>
                  ))}
                </div>
                <button type="button" style={{ ...styles.secondaryBtn, marginTop: 10 }} onClick={() => addExtra(planIndex)}>+ Add Extra</button>
              </div>
            ))}
          </div>
          <button type="button" style={{ ...styles.secondaryBtn, marginTop: 10 }} onClick={addPlan}>+ Add Plan</button>
        </div>
      </div>
    </div>
  );
}

function FAQPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage, onSelectAsset }) {
  const props = block?.props || {};
  const savedImages = [brandAssets?.logo, ...(Array.isArray(brandAssets?.images) ? brandAssets.images : [])].filter(Boolean).slice(0, 8);
  const items = normalizeFaqItems(props.items);

  function update(patch) {
    onChange(index, { ...props, ...patch });
  }

  function addItem() {
    update({
      items: [
        ...items,
        createFaqItem(items.length),
      ],
    });
  }

  function updateItem(itemIndex, patch) {
    update({
      items: items.map((item, currentIndex) => {
        if (currentIndex !== itemIndex) return item;
        const nextQuestion = Object.prototype.hasOwnProperty.call(patch, "question")
          ? String(patch.question || "")
          : item.question;
        const nextAnswer = Object.prototype.hasOwnProperty.call(patch, "answer")
          ? String(patch.answer || "")
          : item.answer;
        return {
          ...item,
          ...patch,
          question: nextQuestion,
          heading: nextQuestion,
          answer: nextAnswer,
          content: nextAnswer,
        };
      }),
    });
  }

  function removeItem(itemIndex) {
    update({ items: items.filter((_, currentIndex) => currentIndex !== itemIndex) });
  }

  function moveItem(itemIndex, direction) {
    const nextIndex = itemIndex + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    const nextItems = [...items];
    const [movedItem] = nextItems.splice(itemIndex, 1);
    nextItems.splice(nextIndex, 0, movedItem);
    update({ items: nextItems });
  }

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>❓ Edit: FAQ Section</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Block Surface</label>
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
                  onUploadImage(index, "backgroundImage", file);
                }}
              />
            </label>
            {savedImages.map((image) => (
              <button
                key={`faq-bg-${image.id || image.src}`}
                type="button"
                style={styles.assetThumbBtn}
                onClick={() => onSelectAsset(index, "backgroundImage", image)}
                title={image.name}
              >
                <img src={image.src} alt={image.name} style={styles.assetThumbPreview} />
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button type="button" style={styles.secondaryBtn} onClick={() => update({ backgroundImage: "" })}>Remove Background Image</button>
          </div>
          <ColorSelector label="Block Background" value={props.blockBackgroundColor || "transparent"} fallback="#0f172a" allowTransparent onChange={(value) => update({ blockBackgroundColor: value })} />
          <ColorSelector label="Panel Background" value={props.faqPanelBackgroundColor || props.backgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ faqPanelBackgroundColor: value, backgroundColor: value })} />
          <ColorSelector label="Panel Border" value={props.borderColor || "#cbd5e1"} fallback="#cbd5e1" onChange={(value) => update({ borderColor: value })} />
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Accordion Cards</label>
          <div style={styles.colorGrid}>
            <NumberField label="Block Width" value={Number(props.faqMaxWidth || 980)} min={320} max={1800} onChange={(value) => update({ faqMaxWidth: value })} />
          </div>
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={!!props.faqStartCollapsed}
              onChange={(e) => update({ faqStartCollapsed: e.target.checked })}
            />
            Collapse all items by default
          </label>
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={!!props.faqAllowMultipleOpen}
              onChange={(e) => update({ faqAllowMultipleOpen: e.target.checked })}
            />
            Allow multiple items open
          </label>
          <ColorSelector label="Item Background" value={props.itemBackgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ itemBackgroundColor: value })} />
          <ColorSelector label="Item Border" value={props.itemBorderColor || props.borderColor || "#cbd5e1"} fallback="#cbd5e1" onChange={(value) => update({ itemBorderColor: value })} />
          <ColorSelector label="Chevron Color" value={props.chevronColor || "#2563eb"} fallback="#2563eb" onChange={(value) => update({ chevronColor: value })} />
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>FAQ Items</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={styles.secondaryBtn} onClick={addItem}>+ Add New Question</button>
          </div>
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {items.length ? items.map((item, itemIndex) => (
              <div key={item.id || `faq-item-${itemIndex}`} style={styles.sectionCard}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span style={styles.colorLabel}>Question {itemIndex + 1}</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" style={styles.secondaryBtn} onClick={() => moveItem(itemIndex, -1)} disabled={itemIndex === 0}>↑ Move Up</button>
                    <button type="button" style={styles.secondaryBtn} onClick={() => moveItem(itemIndex, 1)} disabled={itemIndex === items.length - 1}>↓ Move Down</button>
                    <button type="button" style={styles.secondaryBtn} onClick={() => removeItem(itemIndex)}>Remove</button>
                  </div>
                </div>
                <input
                  type="text"
                  value={String(item.question || "")}
                  onChange={(event) => updateItem(itemIndex, { question: event.target.value })}
                  style={styles.propertyInput}
                  placeholder="Question"
                />
                <textarea
                  value={String(item.answer || "")}
                  onChange={(event) => updateItem(itemIndex, { answer: event.target.value })}
                  style={{ ...styles.propertyInput, minHeight: 96 }}
                  placeholder="Answer"
                />
              </div>
            )) : (
              <p style={styles.noSelection}>No FAQ items yet. Add your first question above.</p>
            )}
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Spacing</label>
          <div style={{ marginTop: 10 }}>
            <label style={styles.propertyLabel}>Spacing Scale</label>
            <select value={String(props.spacingScale || "normal")} onChange={(e) => update({ spacingScale: e.target.value })} style={styles.propertyInput}>
              {getSelectOptions("spacingScale").map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, min = 0, max = 200, onChange }) {
  return (
    <div style={styles.numberField}>
      <span style={styles.colorLabel}>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={Number(value || 0)}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        style={styles.propertyInput}
      />
    </div>
  );
}

function ImagePropertiesPanel({ block, index, onChange, brandAssets, onUploadImage, onSelectAsset, onOpenImageEditor }) {
  const props = block?.props || {};
  const savedImages = [brandAssets?.logo, ...(Array.isArray(brandAssets?.images) ? brandAssets.images : [])].filter(Boolean).slice(0, 8);
  const update = (patch) => onChange(index, { ...props, ...patch });

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🖼️ Edit: Image Block</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Image</label>
          <div style={styles.assetPicker}>
            <label style={styles.assetUploadCta}>
              Upload Image
              <input
                type="file"
                accept="image/*"
                style={styles.hiddenInput}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  onUploadImage(index, "src", file);
                }}
              />
            </label>
            {savedImages.map((image) => (
              <button
                key={`image-block-${image.id || image.src}`}
                type="button"
                style={styles.assetThumbBtn}
                onClick={() => onSelectAsset(index, "src", image)}
                title={image.name}
              >
                <img src={image.src} alt={image.name} style={styles.assetThumbPreview} />
              </button>
            ))}
          </div>
          {props.src ? (
            <button
              type="button"
              style={{ ...styles.secondaryBtn, marginTop: 8 }}
              onClick={() => onOpenImageEditor?.(index, "src", props.src)}
            >
              ✂️ Crop / Edit Image
            </button>
          ) : null}
          <div style={styles.colorGrid}>
            <NumberField label="Width" value={parsePixelValue(props.width, 720)} min={160} max={1800} onChange={(value) => update({ width: `${value}px` })} />
            <NumberField label="Height" value={parsePixelValue(props.height, 400)} min={120} max={1400} onChange={(value) => update({ height: `${value}px` })} />
          </div>
          <input type="text" value={String(props.alt || "")} onChange={(e) => update({ alt: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="Alt text" />
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Text Overlay</label>
          <label style={styles.inlineToggle}>
            <input
              type="checkbox"
              checked={!!props.showOverlayText}
              onChange={(e) => update({
                showOverlayText: e.target.checked,
                headline: e.target.checked ? (props.headline || "Add image headline") : props.headline,
                subheadline: e.target.checked ? (props.subheadline || "Add supporting text") : props.subheadline,
              })}
            />
            Show headline over image
          </label>
          <div style={{ marginTop: 8 }}>
            <label style={styles.propertyLabel}>Headline</label>
            <RichText
              value={String(props.headline || "")}
              onChange={(nextHtml) => update({ headline: nextHtml, showOverlayText: true })}
              placeholder="Write headline..."
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={styles.propertyLabel}>Supporting Text</label>
            <RichText
              value={String(props.subheadline || "")}
              onChange={(nextHtml) => update({ subheadline: nextHtml, showOverlayText: true })}
              placeholder="Write supporting text..."
            />
          </div>
          <div style={styles.inlineChipRow}>
            {[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ].map((option) => (
              <button key={option.value} type="button" style={{ ...styles.presetChip, ...(String(props.overlayTextAlign || "center") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ overlayTextAlign: option.value, showOverlayText: true })}>
                {option.label}
              </button>
            ))}
          </div>
          <div style={styles.inlineChipRow}>
            {[
              { value: "top", label: "Top" },
              { value: "center", label: "Middle" },
              { value: "bottom", label: "Bottom" },
            ].map((option) => (
              <button key={option.value} type="button" style={{ ...styles.presetChip, ...(String(props.overlayTextVerticalAlign || "center") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ overlayTextVerticalAlign: option.value, showOverlayText: true })}>
                {option.label}
              </button>
            ))}
          </div>
          <div style={styles.colorGrid}>
            <NumberField label="Headline Size" value={Number(props.headlineFontSize || 46)} min={18} max={120} onChange={(value) => update({ headlineFontSize: value, showOverlayText: true })} />
            <NumberField label="Body Size" value={Number(props.subheadlineFontSize || 20)} min={12} max={72} onChange={(value) => update({ subheadlineFontSize: value, showOverlayText: true })} />
            <NumberField label="Text Width" value={Number(props.overlayTextWidth || 420)} min={180} max={1800} onChange={(value) => update({ overlayTextWidth: value, showOverlayText: true, overlayTextXRatio: null })} />
            <NumberField label="Text X" value={Number(props.overlayTextX || 0)} min={0} max={1800} onChange={(value) => update({ overlayTextX: value, showOverlayText: true, overlayTextXRatio: null })} />
            <NumberField label="Text Y" value={Number(props.overlayTextY || 0)} min={0} max={1400} onChange={(value) => update({ overlayTextY: value, showOverlayText: true, overlayTextYRatio: null })} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button type="button" style={styles.secondaryBtn} onClick={() => update({ overlayTextWidth: 420, overlayTextX: 0, overlayTextY: 0, overlayTextXRatio: null, overlayTextYRatio: null, overlayTextAlign: "center", overlayTextVerticalAlign: "center", showOverlayText: true })}>
              Reset Text Box Position
            </button>
          </div>
          <ColorSelector label="Headline Color" value={props.overlayTextColor || props.headlineColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ overlayTextColor: value, headlineColor: value, showOverlayText: true })} />
          <ColorSelector label="Body Color" value={props.overlaySubheadlineColor || props.textColor || "#f8fafc"} fallback="#f8fafc" onChange={(value) => update({ overlaySubheadlineColor: value, textColor: value, showOverlayText: true })} />
          <ColorSelector label="Overlay Background" value={props.overlayTextBackground || "transparent"} fallback="#000000" allowTransparent onChange={(value) => update({ overlayTextBackground: value, showOverlayText: true })} />
        </div>
      </div>
    </div>
  );
}

function NavbarLogoPicker({ index, props, brandAssets, onUploadImage, onSelectAsset, update }) {
  const savedLogo = brandAssets?.logo || null;
  const savedImages = Array.isArray(brandAssets?.images) ? brandAssets.images : [];

  return (
    <div style={styles.sectionCard}>
      <label style={styles.propertyLabel}>Logo</label>
      <label style={styles.inlineToggle}>
        <input
          type="checkbox"
          checked={!!props.showLogo}
          onChange={(e) => update({ showLogo: e.target.checked })}
        />
        Show logo in navbar
      </label>
      <div style={styles.assetPicker}>
        <label style={styles.assetUploadCta}>
          Upload Logo
          <input
            type="file"
            accept="image/*"
            style={styles.hiddenInput}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              onUploadImage(index, "logo", file);
              update({ showLogo: true });
            }}
          />
        </label>
        {savedLogo ? (
          <button
            type="button"
            style={styles.assetChip}
            onClick={() => {
              onSelectAsset(index, "logo", savedLogo);
              update({ showLogo: true });
            }}
          >
            Use Shared Logo
          </button>
        ) : null}
        {savedImages.slice(0, 6).map((image) => (
          <button
            key={`nav-logo-${image.id}`}
            type="button"
            style={styles.assetThumbBtn}
            onClick={() => {
              onSelectAsset(index, "logo", image);
              update({ showLogo: true });
            }}
            title={image.name}
          >
            <img src={image.src} alt={image.name} style={styles.assetThumbPreview} />
          </button>
        ))}
      </div>
      <NumberField
        label="Logo width"
        value={props.logoWidth || 44}
        min={20}
        max={180}
        onChange={(next) => update({ logoWidth: next })}
      />
    </div>
  );
}

function NavbarPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage, onSelectAsset }) {
  const props = block.props || {};

  function update(patch) {
    onChange(index, { ...props, ...patch });
  }

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🎨 Edit: Navigation Bar</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Navbar Style</label>
          <NavbarPresetPicker value={props.variant || "split-dark"} onApply={update} />
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Layout Variant</label>
          <select
            value={String(props.variant || "split-dark")}
            onChange={(e) => update({ variant: e.target.value })}
            style={styles.propertyInput}
          >
            {getSelectOptions("variant").map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Behaviour</label>
          <label style={styles.propertyLabel}>Sticky Mode</label>
          <select
            value={String(props.stickyMode || "normal")}
            onChange={(e) => update({ stickyMode: e.target.value })}
            style={styles.propertyInput}
          >
            {getSelectOptions("stickyMode").map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Mobile Menu</label>
          <select
            value={String(props.mobileMenuStyle || "hamburger")}
            onChange={(e) => update({ mobileMenuStyle: e.target.value })}
            style={styles.propertyInput}
          >
            {getSelectOptions("mobileMenuStyle").map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Brand Text</label>
          <input
            type="text"
            value={props.brand || ""}
            onChange={(e) => update({ brand: e.target.value })}
            style={styles.propertyInput}
          />
        </div>

        <NavbarLogoPicker
          index={index}
          props={props}
          brandAssets={brandAssets}
          onUploadImage={onUploadImage}
          onSelectAsset={onSelectAsset}
          update={update}
        />

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Navigation Links</label>
          <NavbarLinksEditor
            links={props.links}
            onChange={(links) => update({ links })}
          />
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>CTA Text</label>
          <input
            type="text"
            value={props.ctaText || ""}
            onChange={(e) => update({ ctaText: e.target.value })}
            style={styles.propertyInput}
            placeholder="Get Started"
          />
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>CTA Link</label>
          <input
            type="text"
            value={props.ctaLink || ""}
            onChange={(e) => update({ ctaLink: e.target.value })}
            style={styles.propertyInput}
            placeholder="#contact"
          />
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Typography</label>
          <div style={styles.colorGrid}>
            <NumberField
              label="Brand size"
              value={props.brandFontSize || 16}
              min={16}
              max={48}
              onChange={(next) => update({ brandFontSize: next })}
            />
            <NumberField
              label="Link size"
              value={props.linkFontSize || 16}
              min={16}
              max={32}
              onChange={(next) => update({ linkFontSize: next })}
            />
            <NumberField
              label="Button size"
              value={props.ctaFontSize || 16}
              min={16}
              max={28}
              onChange={(next) => update({ ctaFontSize: next })}
            />
          </div>
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Hover & Highlight</label>
          <select
            value={String(props.linkHoverEffect || "fill")}
            onChange={(e) => update({ linkHoverEffect: e.target.value })}
            style={styles.propertyInput}
          >
            {getSelectOptions("linkHoverEffect").map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <ColorSelector label="Hover Background" value={props.linkHoverBackgroundColor || "#334155"} fallback="#334155" onChange={(value) => update({ linkHoverBackgroundColor: value })} />
        <ColorSelector label="Hover Text" value={props.linkHoverTextColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ linkHoverTextColor: value })} />
        <ColorSelector label="Highlighted Background" value={props.activeLinkBackgroundColor || "#475569"} fallback="#475569" onChange={(value) => update({ activeLinkBackgroundColor: value })} />
        <ColorSelector label="Highlighted Text" value={props.activeLinkTextColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ activeLinkTextColor: value })} />

        <ColorSelector label="Navbar Background" value={props.backgroundColor || "#0b1220"} fallback="#0b1220" allowTransparent onChange={(value) => update({ backgroundColor: value })} />
        <ColorSelector label="Navbar Border" value={props.borderColor || "rgba(148,163,184,0.24)"} fallback="#94a3b8" onChange={(value) => update({ borderColor: value })} />
        <ColorSelector label="Navbar Text" value={props.textColor || "#e2e8f0"} fallback="#e2e8f0" onChange={(value) => update({ textColor: value })} />
        <ColorSelector label="Button Background" value={props.buttonColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ buttonColor: value })} />
        <ColorSelector label="Button Text" value={props.buttonTextColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ buttonTextColor: value })} />
      </div>
    </div>
  );
}

function normalizeColorInput(value, fallback) {
  const text = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text : fallback;
}

const STANDARD_COLOR_SWATCHES = [
  "#000000",
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
            style={{ ...styles.colorSwatch, color: "#e6eef5", fontSize: 11, width: "auto", padding: "0 8px" }}
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

const TEXT_TOOLBAR_FONTS = [
  { value: "Segoe UI", label: "Segoe UI" },
  { value: "Aptos", label: "Aptos" },
  { value: "Arial", label: "Arial" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Poppins", label: "Poppins" },
  { value: "Nunito", label: "Nunito" },
  { value: "Raleway", label: "Raleway" },
  { value: "Oswald", label: "Oswald" },
  { value: "Merriweather", label: "Merriweather" },
  { value: "Playfair Display", label: "Playfair Display" },
  { value: "DM Serif Display", label: "DM Serif Display" },
  { value: "Cormorant Garamond", label: "Cormorant Garamond" },
  { value: "Trebuchet MS", label: "Trebuchet MS" },
  { value: "Verdana", label: "Verdana" },
  { value: "Tahoma", label: "Tahoma" },
  { value: "Gill Sans", label: "Gill Sans" },
  { value: "Century Gothic", label: "Century Gothic" },
  { value: "Lucida Sans Unicode", label: "Lucida Sans Unicode" },
  { value: "Franklin Gothic Medium", label: "Franklin Gothic" },
  { value: "Futura", label: "Futura" },
  { value: "Avenir Next", label: "Avenir Next" },
  { value: "Bebas Neue", label: "Bebas Neue" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Garamond", label: "Garamond" },
  { value: "Palatino Linotype", label: "Palatino Linotype" },
  { value: "Book Antiqua", label: "Book Antiqua" },
  { value: "Cambria", label: "Cambria" },
  { value: "Baskerville", label: "Baskerville" },
  { value: "Courier New", label: "Courier New" },
  { value: "Consolas", label: "Consolas" },
  { value: "Lucida Console", label: "Lucida Console" },
  { value: "Impact", label: "Impact" },
  { value: "Brush Script MT", label: "Brush Script MT" },
  { value: "Copperplate", label: "Copperplate" },
  { value: "Papyrus", label: "Papyrus" },
];

const TEXT_TOOLBAR_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 84, 96];
const ANIMATION_PRESETS = [
  { value: "none", label: "None" },
  { value: "fade-in", label: "Fade In" },
  { value: "fade-up", label: "Fade Up" },
  { value: "fade-down", label: "Fade Down" },
  { value: "slide-left", label: "Slide Left" },
  { value: "slide-right", label: "Slide Right" },
  { value: "slide-up", label: "Slide Up" },
  { value: "slide-down", label: "Slide Down" },
  { value: "zoom", label: "Zoom In" },
  { value: "zoom-out", label: "Zoom Out" },
  { value: "blur-in", label: "Blur In" },
  { value: "rotate-in", label: "Rotate In" },
  { value: "flip-up", label: "Flip Up" },
  { value: "bounce-in", label: "Bounce In" },
];
const ANIMATION_DELAY_OPTIONS = [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1, 1.2];
const ANIMATION_SPEED_OPTIONS = [0.5, 0.7, 0.8, 1, 1.2, 1.5];
const BLOCK_TYPE_STYLE_PRESETS = {
  P: { fontSize: "18px", fontWeight: "400", lineHeight: "1.7" },
  H1: { fontSize: "48px", fontWeight: "800", lineHeight: "1.08" },
  H2: { fontSize: "36px", fontWeight: "800", lineHeight: "1.14" },
  H3: { fontSize: "28px", fontWeight: "700", lineHeight: "1.2" },
};

function getTextAnimationBinding(block, editable) {
  const propName = String(editable?.getAttribute?.("data-text-prop") || "").trim();
  if (!block || !propName) return null;

  if (propName === "headline") {
    return {
      label: "Headline Motion",
      animationKey: "textAnimation",
      speedKey: "textAnimationSpeed",
      delayKey: "textAnimationDelay",
    };
  }

  if (propName === "subheadline") {
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
  const node = activeSelection?.focusNode || activeSelection?.anchorNode || null;
  const element = node?.nodeType === 3 ? node.parentElement : node;
  if (element instanceof Element && editable.contains(element)) {
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

function TextEditingToolbar({ visible, textColor, highlightColor, fontFamily, fontSize, blockType, canStyleBox, boxBackgroundColor, boxBackgroundImage, boxWidth, onClearBoxBackground, onBoxBackgroundColor, onBoxBackgroundImageUpload, onClearBoxBackgroundImage, onBoxWidthChange, onCommand, onTextColor, onHighlightColor, onFontSize, onBlockType, onFontFamily, onOpenAnimations, position, onDragStart, onClose, onPreserveSelection }) {
  if (!visible) return null;

  const backgroundFileInputRef = useRef(null);

  const keepSelection = (event, callback) => {
    event.preventDefault();
    callback?.();
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
    { label: "B", title: "Bold", action: () => onCommand("bold") },
    { label: "I", title: "Italic", action: () => onCommand("italic") },
    { label: "U", title: "Underline", action: () => onCommand("underline") },
  ];

  const alignButtons = [
    { label: "Left", title: "Align left", action: () => onCommand("justifyLeft") },
    { label: "Center", title: "Align center", action: () => onCommand("justifyCenter") },
    { label: "Right", title: "Align right", action: () => onCommand("justifyRight") },
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
          Hide
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
          <select
            value={fontFamily || "Arial"}
            style={{ ...styles.textToolbarSelect, minWidth: 220 }}
            onMouseDownCapture={() => onPreserveSelection?.()}
            onChange={(event) => onFontFamily?.(event.target.value)}
          >
            {TEXT_TOOLBAR_FONTS.map((font) => (
              <option key={font.value} value={font.value}>{font.label}</option>
            ))}
          </select>
          <select
            value={String(fontSize || 18)}
            style={{ ...styles.textToolbarSelect, minWidth: 86 }}
            onMouseDownCapture={() => onPreserveSelection?.()}
            onChange={(event) => onFontSize?.(Number(event.target.value))}
          >
            {TEXT_TOOLBAR_SIZES.map((size) => (
              <option key={size} value={size}>{size}px</option>
            ))}
          </select>
        </div>
        <div style={styles.textToolbarInlineDivider} />
        <div style={{ ...styles.textToolbarInlineGroup, ...styles.textToolbarFormattingGroup }}>
          <div style={styles.textToolbarButtonRow}>
            {textButtons.map((item) => (
              <button key={item.title} type="button" title={item.title} style={styles.textToolbarIconBtn} onMouseDown={(event) => keepSelection(event, item.action)}>
                {item.label}
              </button>
            ))}
          </div>
          <div style={styles.textToolbarButtonRow}>
            {alignButtons.map((item) => (
              <button key={item.title} type="button" title={item.title} style={styles.textToolbarMiniActionChip} onMouseDown={(event) => keepSelection(event, item.action)}>
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
            <input type="color" value={highlightColor} onMouseDownCapture={() => onPreserveSelection?.()} onChange={(e) => onHighlightColor(e.target.value)} style={styles.textToolbarColor} />
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
                  max={1800}
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

function pickGlobalStyleValue(blocks, keys, fallback) {
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const props = block?.props || {};
    for (const key of keys) {
      const value = props?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return value;
      }
    }
  }
  return fallback;
}

function GlobalStylePanel({ blocks, onApplyGlobal }) {
  const [section, setSection] = useState("text");
  const headingFont = pickGlobalStyleValue(blocks, ["headlineFontFamily", "headingFontFamily"], "Arial");
  const bodyFont = pickGlobalStyleValue(blocks, ["fontFamily", "bodyFontFamily"], "Arial");
  const headingSize = Number(pickGlobalStyleValue(blocks, ["headlineFontSize"], 52));
  const bodySize = Number(pickGlobalStyleValue(blocks, ["subheadlineFontSize", "textFontSize", "linkFontSize"], 18));
  const primaryColor = pickGlobalStyleValue(blocks, ["buttonColor", "activeLinkBackgroundColor"], "#f59e0b");
  const headingColor = pickGlobalStyleValue(blocks, ["headlineColor"], "#ffffff");
  const bodyColor = pickGlobalStyleValue(blocks, ["textColor"], "#e2e8f0");
  const sectionBackground = pickGlobalStyleValue(blocks, ["backgroundColor"], "#0f172a");
  const buttonTextColor = pickGlobalStyleValue(blocks, ["buttonTextColor"], "#ffffff");
  const cardBackgroundColor = pickGlobalStyleValue(blocks, ["cardBackgroundColor", "itemBackgroundColor"], "#f8fafc");
  const buttonRadius = Number(pickGlobalStyleValue(blocks, ["buttonRadius"], 999));
  const pageWidth = Number(pickGlobalStyleValue(blocks, ["baseLayoutWidth"], 1100));
  const layoutMode = blocks.some((block) => !!block?.props?.fullWidthBackground) ? "full" : "contained";
  const textAlign = pickGlobalStyleValue(blocks, ["headlineAlignment", "alignment"], "left");
  const sections = [
    { id: "text", label: "Text Styling" },
    { id: "colors", label: "Color Palette" },
    { id: "layout", label: "Website Layout" },
    { id: "page", label: "Page Styling" },
  ];

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🎛️ Global Styling</h3>
      <div style={styles.tabRow}>
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            style={{ ...styles.tabChip, ...(section === item.id ? styles.tabChipActive : {}) }}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div style={styles.propertyGrid}>
        {section === "text" ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Text Styling</label>
            <p style={styles.aiHint}>Update headings, body copy, and alignment across this page.</p>
            <label style={styles.propertyLabel}>Heading Font</label>
            <select value={headingFont} onChange={(e) => onApplyGlobal({ headingFontFamily: e.target.value })} style={styles.propertyInput}>
              {TEXT_TOOLBAR_FONTS.map((font) => (
                <option key={`heading-${font.value}`} value={font.value}>{font.label}</option>
              ))}
            </select>
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Body Font</label>
            <select value={bodyFont} onChange={(e) => onApplyGlobal({ bodyFontFamily: e.target.value })} style={styles.propertyInput}>
              {TEXT_TOOLBAR_FONTS.map((font) => (
                <option key={`body-${font.value}`} value={font.value}>{font.label}</option>
              ))}
            </select>
            <div style={{ ...styles.colorGrid, marginTop: 8 }}>
              <NumberField label="Heading Size" value={headingSize} min={20} max={96} onChange={(value) => onApplyGlobal({ headingSize: value })} />
              <NumberField label="Body Size" value={bodySize} min={12} max={42} onChange={(value) => onApplyGlobal({ bodySize: value })} />
            </div>
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Default Alignment</label>
            <select value={textAlign} onChange={(e) => onApplyGlobal({ textAlign: e.target.value })} style={styles.propertyInput}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        ) : null}

        {section === "colors" ? (
          <>
            <ColorSelector label="Primary Accent" value={primaryColor} fallback="#f59e0b" onChange={(value) => onApplyGlobal({ primaryColor: value })} />
            <ColorSelector label="Heading Colour" value={headingColor} fallback="#ffffff" onChange={(value) => onApplyGlobal({ headingColor: value })} />
            <ColorSelector label="Body Text Colour" value={bodyColor} fallback="#e2e8f0" onChange={(value) => onApplyGlobal({ bodyColor: value })} />
            <ColorSelector label="Section Background" value={sectionBackground} fallback="#0f172a" allowTransparent onChange={(value) => onApplyGlobal({ sectionBackground: value })} />
            <ColorSelector label="Button Text Colour" value={buttonTextColor} fallback="#ffffff" onChange={(value) => onApplyGlobal({ buttonTextColor: value })} />
          </>
        ) : null}

        {section === "layout" ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Website Layout</label>
            <label style={styles.propertyLabel}>Layout Style</label>
            <select value={layoutMode} onChange={(e) => onApplyGlobal({ layoutMode: e.target.value })} style={styles.propertyInput}>
              <option value="full">Full Width</option>
              <option value="contained">Contained</option>
            </select>
            <div style={{ ...styles.colorGrid, marginTop: 8 }}>
              <NumberField label="Page Width" value={pageWidth} min={720} max={1600} onChange={(value) => onApplyGlobal({ pageWidth: value })} />
              <NumberField label="Button Radius" value={buttonRadius >= 999 ? 32 : buttonRadius} min={0} max={40} onChange={(value) => onApplyGlobal({ buttonRadius: value >= 32 ? 999 : value })} />
            </div>
          </div>
        ) : null}

        {section === "page" ? (
          <>
            <ColorSelector label="Card Background" value={cardBackgroundColor} fallback="#f8fafc" onChange={(value) => onApplyGlobal({ cardBackgroundColor: value })} />
            <div style={styles.sectionCard}>
              <label style={styles.propertyLabel}>Quick Theme Presets</label>
              <div style={styles.presetGrid}>
                <button type="button" style={styles.presetChip} onClick={() => onApplyGlobal({ primaryColor: "#f59e0b", headingColor: "#ffffff", bodyColor: "#e2e8f0", sectionBackground: "#354f52", cardBackgroundColor: "#ffffff" })}>Modern Dark</button>
                <button type="button" style={styles.presetChip} onClick={() => onApplyGlobal({ primaryColor: "#2563eb", headingColor: "#0f172a", bodyColor: "#334155", sectionBackground: "#ffffff", cardBackgroundColor: "#eff6ff" })}>Clean Light</button>
                <button type="button" style={styles.presetChip} onClick={() => onApplyGlobal({ primaryColor: "#22c55e", headingColor: "#052e16", bodyColor: "#14532d", sectionBackground: "#f0fdf4", cardBackgroundColor: "#dcfce7" })}>Fresh Green</button>
                <button type="button" style={styles.presetChip} onClick={() => onApplyGlobal({ primaryColor: "#a855f7", headingColor: "#ffffff", bodyColor: "#ede9fe", sectionBackground: "#312e81", cardBackgroundColor: "#4c1d95" })}>Bold Brand</button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

const BlockLibraryPanel = ({ onDragStart }) => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const categories = useMemo(() => {
    const cats = {};
    Object.entries(BlockDefinitions).forEach(([key, def]) => {
      if (def?.hiddenInLibrary) return;
      if (!cats[def.category]) cats[def.category] = [];
      cats[def.category].push({ type: key, ...def });
    });
    return cats;
  }, []);

  const categoryOptions = ["All", ...Object.keys(categories)];
  const filteredCategories = Object.entries(categories).reduce((acc, [category, items]) => {
    if (activeCategory !== "All" && activeCategory !== category) return acc;
    const filtered = items.filter((block) => {
      const query = String(search || "").trim().toLowerCase();
      if (!query) return true;
      return String(block.name || "").toLowerCase().includes(query)
        || String(block.description || "").toLowerCase().includes(query)
        || String(category || "").toLowerCase().includes(query);
    });
    if (filtered.length) acc[category] = filtered;
    return acc;
  }, {});

  return (
    <div style={styles.library}>
      <h3 style={styles.libraryTitle}>🧩 Widgets Panel</h3>
      <p style={styles.librarySubtitle}>Drag widgets onto the page</p>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search widgets..."
        style={{ ...styles.propertyInput, marginBottom: 10 }}
      />
      <div style={styles.widgetFilterRow}>
        {categoryOptions.map((category) => (
          <button
            key={category}
            type="button"
            style={{ ...styles.widgetFilterChip, ...(activeCategory === category ? styles.widgetFilterChipActive : {}) }}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>
      <div style={styles.categoryList}>
        {Object.entries(filteredCategories).map(([category, blocks]) => (
          <div key={category} style={styles.categoryGroup}>
            <h4 style={styles.categoryTitle}>{category}</h4>
            <div style={styles.blocksList}>
              {blocks.map((block) => (
                <div
                  key={block.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, block.type)}
                  style={styles.blockCard}
                  title={block.description}
                >
                  <div style={styles.blockIcon}>{block.icon}</div>
                  <div style={styles.blockName}>{block.name}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function PageSectionsPanel({ blocks, selectedIndex, onSelect, onMove }) {
  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>📑 Page Sections</h3>
      <div style={styles.propertyGrid}>
        {(Array.isArray(blocks) ? blocks : []).map((block, index) => (
          <div key={block.id || `${block.type}-${index}`} style={{ ...styles.linkRowCard, ...(selectedIndex === index ? { borderColor: "#7df9a1", boxShadow: "0 0 0 1px rgba(125,249,161,0.35)" } : {}) }}>
            <div style={styles.linkRowHeader}>
              <span style={styles.linkRowTitle}>{BlockDefinitions[block.type]?.name || block.type}</span>
              <div style={styles.linkActions}>
                <button type="button" style={styles.linkMoveBtn} onClick={() => onMove(index, -1)} title="Move up">↑</button>
                <button type="button" style={styles.linkMoveBtn} onClick={() => onMove(index, 1)} title="Move down">↓</button>
              </div>
            </div>
            <button
              type="button"
              style={{ ...styles.secondaryBtn, width: "100%" }}
              onClick={() => onSelect(index)}
            >
              Edit Section
            </button>
          </div>
        ))}
        {!blocks?.length ? (
          <div style={styles.sectionCard}>
            <p style={styles.aiHint}>Add some widgets first to see your page sections here.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const CanvasBlockPreview = React.memo(function CanvasBlockPreview({ block, index, brandAssets, onChange, onUploadImage, onUploadLayerImage, replayToken, compact }) {
  return renderBlockPreview(block, brandAssets, {
    compact,
    onChangeBlock: (nextProps) => onChange(index, nextProps),
    onUploadImage: (key, file) => onUploadImage?.(index, key, file),
    onUploadLayerImage: (layerIndex, file) => onUploadLayerImage?.(index, layerIndex, file),
  });
}, (prev, next) => (
  prev.block === next.block
  && prev.index === next.index
  && prev.brandAssets === next.brandAssets
  && prev.replayToken === next.replayToken
  && prev.compact === next.compact
));

const CanvasBlock = ({ block, index, onSelect, onHover, selected, hovered, onDelete, onDuplicate, onEdit, onAnimate, onChange, onResizeHeight, onUploadImage, onUploadLayerImage, brandAssets, onBlockDragOver, onBlockDrop, animationReplayToken, onMoveStep, onMoveToTop, onSaveAsGlobal, compactPreview }) => {
  const def = BlockDefinitions[block.type];
  const showOverlay = selected || hovered;
  const resizeStateRef = useRef(null);
  const stickyMode = String(block?.props?.stickyMode || "normal");
  const isStickyNavBlock = block?.type === "nav-bar" && stickyMode !== "normal";

  useEffect(() => {
    const handlePointerMove = (event) => {
      const current = resizeStateRef.current;
      if (!current) return;
      const delta = event.clientY - current.startY;
      const nextHeight = Math.max(160, Math.round(current.startHeight + delta));
      onResizeHeight?.(index, nextHeight);
    };

    const handlePointerUp = () => {
      resizeStateRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("mouseup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [index, onResizeHeight]);

  const startHeightResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      startY: event.clientY,
      startHeight: parsePixelValue(block?.props?.minHeight, block?.type === BlockTypes.HERO ? 420 : 280),
    };
  };

  return (
    <div
      style={{
        ...styles.canvasBlock,
        ...(isStickyNavBlock ? styles.canvasStickyNavBlock : {}),
        ...((block?.type === "columns-2" || block?.type === "columns-3") ? { padding: 0, background: block?.props?.backgroundColor || "transparent", border: "none", borderRadius: 0, boxShadow: "none" } : {}),
        ...(block?.type === "space" ? { padding: 0, background: "repeating-linear-gradient(45deg,rgba(99,102,241,0.08) 0,rgba(99,102,241,0.08) 1px,transparent 0,transparent 50%) 0 0 / 8px 8px", border: "1px dashed rgba(99,102,241,0.35)", borderRadius: 6, minHeight: Number(String(block?.props?.height || "40").replace("px", "")) || 40, boxShadow: "none" } : {}),
        ...(selected && block?.type !== "columns-2" && block?.type !== "columns-3" && block?.type !== "space" ? styles.canvasBlockSelected : {}),
        ...(selected && (block?.type === "columns-2" || block?.type === "columns-3") ? { outline: "2px solid #0ea5e9" } : {}),
      }}
      data-canvas-block-index={index}
      onClick={() => onSelect(index)}
      onMouseEnter={() => onHover?.(index)}
      onMouseLeave={() => onHover?.(null)}
      onDragOver={(e) => onBlockDragOver(e, index)}
      onDrop={(e) => onBlockDrop(e, index)}
    >
      {showOverlay ? (
        <div style={styles.blockActionBar}>
          <div style={styles.blockActionLeft}>
            <span style={styles.blockActionLabel}>{def?.name || block.type}</span>
          </div>
          <div style={styles.blockActionButtons}>
            <button
              type="button"
              style={styles.blockActionBtnIcon}
              onClick={(e) => {
                e.stopPropagation();
                onMoveToTop?.(index);
              }}
              title="Move to top"
              aria-label="Move to top"
            >
              ⇡
            </button>
            <button
              type="button"
              style={styles.blockActionBtnIcon}
              onClick={(e) => {
                e.stopPropagation();
                onMoveStep?.(index, -1);
              }}
              title="Move up"
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              style={styles.blockActionBtnIcon}
              onClick={(e) => {
                e.stopPropagation();
                onMoveStep?.(index, 1);
              }}
              title="Move down"
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              style={styles.blockActionBtn}
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(index, e.currentTarget);
              }}
              title="Open editor"
            >
              Edit
            </button>
            <button
              type="button"
              style={styles.blockActionBtnIcon}
              onClick={(e) => {
                e.stopPropagation();
                onAnimate?.(index, e.currentTarget);
              }}
              title="Animation settings"
              aria-label="Animation settings"
            >
              🕘
            </button>
            <button
              type="button"
              style={styles.blockActionBtnIcon}
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(index);
              }}
              title="Duplicate"
              aria-label="Duplicate"
            >
              ⧉
            </button>
            <button
              type="button"
              style={{ ...styles.blockActionBtnIcon, ...styles.blockActionBtnDanger }}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(index);
              }}
              title="Delete"
              aria-label="Delete"
            >
              🗑
            </button>
            {onSaveAsGlobal ? (
              <>
                <button
                  type="button"
                  style={{ ...styles.blockActionBtn, background: "#1e3a5f", color: "#7dd3fc", border: "1px solid #2563eb", fontSize: 11, padding: "2px 7px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSaveAsGlobal(block, "nav");
                  }}
                  title="Pin as global navigation (shows on every page)"
                >
                  📌 Nav
                </button>
                <button
                  type="button"
                  style={{ ...styles.blockActionBtn, background: "#1e3a5f", color: "#7dd3fc", border: "1px solid #2563eb", fontSize: 11, padding: "2px 7px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSaveAsGlobal(block, "footer");
                  }}
                  title="Pin as global footer (shows on every page)"
                >
                  📌 Footer
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      <div style={styles.blockPreviewShell}>
        <div style={styles.blockInfoPill}>
          <span style={styles.blockIcon}>{def?.icon || "📦"}</span>
        </div>
        <div style={{ ...styles.blockPreview, ...(isStickyNavBlock ? styles.blockPreviewStickyNav : {}) }}>
          <CanvasBlockPreview
            key={`${block.id || index}-${animationReplayToken || 0}`}
            block={block}
            index={index}
            brandAssets={brandAssets}
            compact={compactPreview}
            onChange={onChange}
            onUploadImage={onUploadImage}
            onUploadLayerImage={onUploadLayerImage}
            replayToken={animationReplayToken}
          />
        </div>
        {supportsSectionHeight(block.type) ? (
          <button
            type="button"
            style={styles.sectionResizeHandle}
            onPointerDown={startHeightResize}
            onClick={(event) => event.stopPropagation()}
            title="Drag to resize section height"
            aria-label="Drag to resize section height"
          >
            ↕ Height
          </button>
        ) : null}
      </div>
    </div>
  );
};

function DropInsertZone({ active, onDragOver, onDrop }) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        ...styles.dropZone,
        ...(active ? styles.dropZoneActive : {}),
      }}
    >
      <div style={{ ...styles.dropLine, ...(active ? styles.dropLineActive : {}) }} />
    </div>
  );
}

function GlobalBlockPreview({ label, role, block, brandAssets, compact, selected = false, onSelect, onChange, onSaveAsGlobal }) {
  if (!block) return null;
  const [hovered, setHovered] = useState(false);
  const showOverlay = selected || hovered;

  return (
    <div
      style={{
        ...styles.globalBlockPreviewWrap,
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
        <div style={styles.blockActionBar}>
          <div style={styles.blockActionLeft}>
            <span style={styles.blockActionLabel}>{label}</span>
          </div>
          <div style={styles.blockActionButtons}>
            <button
              type="button"
              style={styles.blockActionBtn}
              onClick={(event) => {
                event.stopPropagation();
                onSelect?.();
              }}
              title="Edit global block"
            >
              Edit
            </button>
            <button
              type="button"
              style={{ ...styles.blockActionBtn, background: "#1e3a5f", color: "#7dd3fc", border: "1px solid #2563eb", fontSize: 11, padding: "2px 7px" }}
              onClick={(event) => {
                event.stopPropagation();
                onSaveAsGlobal?.(block, role);
              }}
              title={`Save as global ${role === "nav" ? "navigation" : "footer"}`}
            >
              📌 {role === "nav" ? "Nav" : "Footer"}
            </button>
            <span style={{ ...styles.blockActionBtn, cursor: "default", background: "rgba(59,130,246,0.18)", color: "#bfdbfe", border: "1px solid rgba(96,165,250,0.35)" }}>
              Global block
            </span>
          </div>
        </div>
      ) : null}
      <div style={styles.globalBlockPreviewSurface}>
        
        {renderWebsiteBlock(block, {
          compact,
          assets: brandAssets,
          editor: true,
          onChangeBlock: (nextProps) => onChange?.({ ...block, props: nextProps }),
        })}
      </div>
    </div>
  );
}

function ImageStackPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage }) {
  const props = block?.props || {};
  const layers = Array.isArray(props.images) ? props.images : [];
  const savedImages = Array.isArray(brandAssets?.images) ? brandAssets.images : [];
  const libraryImages = [brandAssets?.logo, ...savedImages].filter(Boolean).slice(0, 12);
  const selectedLayerIndex = Number.isInteger(props.selectedLayerIndex) && props.selectedLayerIndex >= 0 && props.selectedLayerIndex < layers.length
    ? props.selectedLayerIndex
    : null;
  const activeLayer = selectedLayerIndex !== null ? layers[selectedLayerIndex] : null;

  const update = (patch) => onChange(index, { ...props, ...patch });
  const normalizeLayers = (nextLayers) => nextLayers.map((layer, layerIndex) => ({
    ...layer,
    zIndex: layerIndex + 1,
  }));
  const updateLayer = (layerIndex, patch) => {
    update({
      images: layers.map((layer, currentIndex) => (
        currentIndex === layerIndex ? { ...layer, ...patch } : layer
      )),
    });
  };

  const addImageLayer = () => {
    update({ images: [...layers, createImageStackLayer(layers.length)], selectedLayerIndex: layers.length });
  };

  const addTextLayer = () => {
    update({ images: [...layers, createTextStackLayer(layers.length)], selectedLayerIndex: layers.length });
  };

  const addLogoLayer = () => {
    const logo = brandAssets?.logo;
    if (!logo?.src) return;
    update({
      images: [
        ...layers,
        {
          ...createImageStackLayer(layers.length),
          src: logo.src,
          assetId: logo.id || "",
          width: 180,
          height: 90,
          rotation: 0,
        },
      ],
      selectedLayerIndex: layers.length,
    });
  };

  const moveLayerOrder = (layerIndex, direction) => {
    const nextIndex = layerIndex + direction;
    if (nextIndex < 0 || nextIndex >= layers.length) return;
    const nextLayers = [...layers];
    const [moved] = nextLayers.splice(layerIndex, 1);
    nextLayers.splice(nextIndex, 0, moved);
    update({ images: normalizeLayers(nextLayers), selectedLayerIndex: nextIndex });
  };

  const alignLayerToCanvas = (layerIndex, axis, value) => {
    const layer = layers[layerIndex];
    if (!layer) return;

    if (axis === "x") {
      const canvasWidth = 1100;
      const layerWidth = Number(layer.width || 320);
      let nextX = Number(layer.x || 0);
      if (value === "left") nextX = 24;
      if (value === "center") nextX = Math.max(0, Math.round((canvasWidth - layerWidth) / 2));
      if (value === "right") nextX = Math.max(24, canvasWidth - layerWidth - 24);
      updateLayer(layerIndex, { x: nextX, textAlign: value });
      return;
    }

    const canvasHeight = parsePixelValue(props.minHeight, 560);
    const layerHeight = Number(layer.height || 140);
    let nextY = Number(layer.y || 0);
    if (value === "top") nextY = 24;
    if (value === "center") nextY = Math.max(0, Math.round((canvasHeight - layerHeight) / 2));
    if (value === "bottom") nextY = Math.max(24, canvasHeight - layerHeight - 24);
    updateLayer(layerIndex, { y: nextY, verticalAlign: value });
  };

  const removeLayer = (layerIndex) => {
    const nextLayers = normalizeLayers(layers.filter((_, currentIndex) => currentIndex !== layerIndex));
    update({
      images: nextLayers,
      selectedLayerIndex: nextLayers.length ? Math.min(layerIndex, nextLayers.length - 1) : null,
    });
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🖼️ Edit: Layered Image Stack</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Canvas Title</label>
          <input
            type="text"
            value={props.title || ""}
            onChange={(e) => update({ title: e.target.value })}
            style={styles.propertyInput}
          />
          <label style={styles.inlineToggle}>
            <input
              type="checkbox"
              checked={props.showGrid !== false}
              onChange={(e) => update({ showGrid: e.target.checked })}
            />
            Show design grid and snap layers to it
          </label>
          <div style={styles.colorGrid}>
            <NumberField
              label="Canvas Height"
              value={parsePixelValue(props.minHeight, 560)}
              min={240}
              max={1400}
              onChange={(value) => update({ minHeight: `${Math.max(240, value)}px` })}
            />
            <div style={styles.colorField}>
              <span style={styles.colorLabel}>Background</span>
              <input
                type="color"
                value={normalizeColorInput(props.backgroundColor, "#f8fafc")}
                onChange={(e) => update({ backgroundColor: e.target.value })}
                style={styles.colorInput}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button type="button" style={styles.formatBtn} onClick={() => update({ backgroundColor: "transparent" })}>
              Transparent Canvas
            </button>
          </div>
          <div style={styles.assetPicker}>
            <button type="button" style={styles.secondaryBtn} onClick={addImageLayer}>
              + Add Image Layer
            </button>
            <button type="button" style={styles.secondaryBtn} onClick={addTextLayer}>
              + Add Text Layer
            </button>
            {brandAssets?.logo?.src ? (
              <button type="button" style={styles.secondaryBtn} onClick={addLogoLayer}>
                + Add Logo Layer
              </button>
            ) : null}
          </div>
          {layers.length ? (
            <div style={styles.assetPicker}>
              {layers.map((layer, layerIndex) => (
                <button
                  key={layer.id || `select-layer-${layerIndex}`}
                  type="button"
                  style={{
                    ...styles.assetChip,
                    ...(selectedLayerIndex === layerIndex ? { background: "#7df9a1", borderColor: "#7df9a1", color: "#04202e" } : {}),
                  }}
                  onClick={() => update({ selectedLayerIndex: layerIndex })}
                >
                  {layer.kind === "text" ? `Text ${layerIndex + 1}` : `Image ${layerIndex + 1}`}
                </button>
              ))}
              {selectedLayerIndex !== null ? (
                <button
                  type="button"
                  style={{ ...styles.assetChip, background: "transparent", borderColor: "#475569", color: "#cbd5e1" }}
                  onClick={() => update({ selectedLayerIndex: null })}
                >
                  Clear Selection
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {activeLayer ? (
          <div key={activeLayer.id || `layer-${selectedLayerIndex}`} style={styles.linkRowCard}>
            <div style={styles.linkRowHeader}>
              <span style={styles.linkRowTitle}>{activeLayer.kind === "text" ? `Text Layer ${selectedLayerIndex + 1}` : `Image Layer ${selectedLayerIndex + 1}`}</span>
              <div style={styles.linkActions}>
                <button type="button" style={styles.linkMoveBtn} onClick={() => moveLayerOrder(selectedLayerIndex, -1)} title="Send back">←</button>
                <button type="button" style={styles.linkMoveBtn} onClick={() => moveLayerOrder(selectedLayerIndex, 1)} title="Bring forward">→</button>
                <button type="button" style={styles.linkRowDelete} onClick={() => removeLayer(selectedLayerIndex)}>
                  Remove
                </button>
              </div>
            </div>
            {activeLayer.kind === "text" ? (
              <div style={styles.sectionCard}>
                <p style={{ margin: 0, color: "#9fb0c5", fontSize: 14 }}>
                  Edit, resize, and move this text directly on the canvas. Use the top text bar when the text is selected.
                </p>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={activeLayer.src || ""}
                  onChange={(e) => updateLayer(selectedLayerIndex, { src: e.target.value, assetId: "", kind: "image" })}
                  style={styles.propertyInput}
                  placeholder="Paste image URL or upload one"
                />
                <div style={styles.colorGrid}>
                  <NumberField label="X" value={Number(activeLayer.x || 0)} min={0} max={2000} onChange={(value) => updateLayer(selectedLayerIndex, { x: value })} />
                  <NumberField label="Y" value={Number(activeLayer.y || 0)} min={0} max={2000} onChange={(value) => updateLayer(selectedLayerIndex, { y: value })} />
                  <NumberField label="Width" value={Number(activeLayer.width || 260)} min={80} max={1600} onChange={(value) => updateLayer(selectedLayerIndex, { width: value })} />
                  <NumberField label="Height" value={Number(activeLayer.height || 180)} min={80} max={1600} onChange={(value) => updateLayer(selectedLayerIndex, { height: value })} />
                </div>
                <div style={styles.colorGrid}>
                  <NumberField label="Rotate" value={Number(activeLayer.rotation || 0)} min={-45} max={45} onChange={(value) => updateLayer(selectedLayerIndex, { rotation: value })} />
                  <NumberField label="Radius" value={Number(activeLayer.radius || 18)} min={0} max={100} onChange={(value) => updateLayer(selectedLayerIndex, { radius: value })} />
                </div>
                <div style={styles.assetPicker}>
                  <label style={styles.assetUploadCta}>
                    Upload Image
                    <input
                      type="file"
                      accept="image/*"
                      style={styles.hiddenInput}
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        const asset = await Promise.resolve(onUploadImage?.(index, "__image_stack_layer__", file));
                        if (asset?.src) {
                          updateLayer(selectedLayerIndex, {
                            kind: "image",
                            src: String(asset.src || "").startsWith("data:") ? "" : asset.src,
                            assetId: asset.id || "",
                          });
                        }
                      }}
                    />
                  </label>
                  {libraryImages.map((image, imageIndex) => (
                    <button
                      key={`${image.id || image.name || "asset"}-${imageIndex}`}
                      type="button"
                      style={styles.assetThumbBtn}
                      onClick={() => updateLayer(selectedLayerIndex, { kind: "image", src: image.src || "", assetId: image.id || "" })}
                      title={image.name || `Asset ${imageIndex + 1}`}
                    >
                      <img src={image.src} alt={image.name || `Asset ${imageIndex + 1}`} style={styles.assetThumbPreview} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={styles.sectionCard}>
            <p style={{ margin: 0, color: "#9fb0c5", fontSize: 14 }}>
              Click one image or text layer on the canvas to edit only that layer here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function getColumnEditorConfigs(blockType) {
  if (blockType === BlockTypes.COLUMNS_2) {
    return [
      {
        id: "left-column",
        label: "Left Column",
        titleKey: "leftTitle",
        contentKey: "leftContent",
        imageKey: "leftImage",
        prefix: "leftColumn",
      },
      {
        id: "right-column",
        label: "Right Column",
        titleKey: "rightTitle",
        contentKey: "rightContent",
        imageKey: "rightImage",
        prefix: "rightColumn",
      },
    ];
  }

  if (blockType === BlockTypes.COLUMNS_3) {
    return [
      { id: "column-1", label: "Column 1", titleKey: "column1Title", contentKey: "column1", imageKey: "column1Image", prefix: "column1" },
      { id: "column-2", label: "Column 2", titleKey: "column2Title", contentKey: "column2", imageKey: "column2Image", prefix: "column2" },
      { id: "column-3", label: "Column 3", titleKey: "column3Title", contentKey: "column3", imageKey: "column3Image", prefix: "column3" },
    ];
  }

  return [];
}

function ColumnsPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage, onSelectAsset, onOpenImageEditor }) {
  const props = block?.props || {};
  const columnConfigs = getColumnEditorConfigs(block?.type);
  const savedImages = [brandAssets?.logo, ...(Array.isArray(brandAssets?.images) ? brandAssets.images : [])].filter(Boolean).slice(0, 8);
  const update = (patch) => onChange(index, { ...props, ...patch });

  async function applyUploadedAsset(fieldKey, file) {
    const asset = await Promise.resolve(onUploadImage?.(index, fieldKey, file));
    if (!asset?.src) return;

    const nextProps = applyAssetToProps(props, fieldKey, asset);
    onChange(index, {
      ...nextProps,
      [fieldKey]: String(asset.src || "").startsWith("data:") ? "" : asset.src,
    });
  }

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🧱 Edit: Columns</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Section Background</label>
          <div style={styles.colorGrid}>
            <ColorSelector label="Background Color" value={props.backgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ backgroundColor: value })} />
            <ColorSelector label="Border Color" value={props.borderColor || "rgba(148,163,184,0.28)"} fallback="rgba(148,163,184,0.28)" onChange={(value) => update({ borderColor: value })} />
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Background Gradient</label>
          <input type="text" value={String(props.backgroundColor || "")} onChange={(e) => update({ backgroundColor: e.target.value })} style={styles.propertyInput} placeholder="e.g. linear-gradient(135deg,#0f172a,#1e3a5f)" />
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Section Layout</label>
          <label style={{ ...styles.propertyLabel, marginTop: 0 }}>Section Heading (leave blank to hide)</label>
          <input type="text" value={props.title || ""} onChange={(e) => update({ title: e.target.value })} style={styles.propertyInput} placeholder="Leave blank for no heading" />
          <div style={{ ...styles.colorGrid, marginTop: 8 }}>
            {block.type === BlockTypes.COLUMNS_2 ? (
              <div style={styles.propertyField}>
                <label style={styles.propertyLabel}>Column Ratio</label>
                <select value={String(props.ratio || "50-50")} onChange={(e) => update({ ratio: e.target.value })} style={styles.propertyInput}>
                  <option value="50-50">50 / 50</option>
                  <option value="60-40">60 / 40</option>
                  <option value="40-60">40 / 60</option>
                </select>
              </div>
            ) : null}
            <NumberField label="Section Height" value={parsePixelValue(props.minHeight, 280)} min={160} max={1200} onChange={(value) => update({ minHeight: `${value}px` })} />
            <NumberField label="Block Max Width" value={Number(props.blockMaxWidth) || 1200} min={320} max={1800} onChange={(value) => update({ blockMaxWidth: value })} />
            <NumberField label="Columns Gap" value={Number(props.columnGap ?? 18)} min={0} max={120} onChange={(value) => update({ columnGap: value })} />
            <NumberField label="Top Margin" value={Number(props.columnsTopMargin ?? 16)} min={0} max={240} onChange={(value) => update({ columnsTopMargin: value })} />
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Vertical Alignment</label>
          <div style={styles.inlineChipRow}>
            {[
              { value: "top", label: "Top" },
              { value: "center", label: "Center" },
              { value: "bottom", label: "Bottom" },
            ].map((option) => (
              <button key={option.value} type="button" style={{ ...styles.presetChip, ...(String(props.columnsVerticalAlign || "top") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ columnsVerticalAlign: option.value })}>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Shared Column Design</label>
          <div style={styles.colorGrid}>
            <ColorSelector label="Background" value={props.columnBackgroundColor || props.cardBackgroundColor || "#f8fafc"} fallback="#f8fafc" onChange={(value) => update({ columnBackgroundColor: value })} />
            <ColorSelector label="Border" value={props.columnBorderColor || "#cbd5e1"} fallback="#cbd5e1" onChange={(value) => update({ columnBorderColor: value })} />
            <ColorSelector label="Title Color" value={props.columnTitleColor || props.textColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ columnTitleColor: value })} />
            <ColorSelector label="Body Color" value={props.columnBodyColor || "#334155"} fallback="#334155" onChange={(value) => update({ columnBodyColor: value })} />
          </div>
          <div style={styles.colorGrid}>
            <NumberField label="Padding" value={Number(props.columnPadding ?? 18)} min={0} max={96} onChange={(value) => update({ columnPadding: value })} />
            <NumberField label="Radius" value={Number(props.columnRadius ?? 18)} min={0} max={80} onChange={(value) => update({ columnRadius: value })} />
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Text Alignment</label>
          <div style={styles.inlineChipRow}>
            {[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ].map((option) => (
              <button key={option.value} type="button" style={{ ...styles.presetChip, ...(String(props.columnContentAlign || "left") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ columnContentAlign: option.value })}>
                {option.label}
              </button>
            ))}
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Shadow</label>
          <div style={styles.inlineChipRow}>
            {[
              { value: "none", label: "None" },
              { value: "soft", label: "Soft" },
              { value: "medium", label: "Medium" },
              { value: "strong", label: "Strong" },
            ].map((option) => (
              <button key={option.value} type="button" style={{ ...styles.presetChip, ...(String(props.columnShadow || "soft") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ columnShadow: option.value })}>
                {option.label}
              </button>
            ))}
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Gradient / Overlay</label>
          <input type="text" value={String(props.columnGradient || "")} onChange={(e) => update({ columnGradient: e.target.value })} style={styles.propertyInput} placeholder="linear-gradient(...)" />
          <div style={{ marginTop: 8 }}>
            <ColorSelector label="Overlay Color" value={props.columnOverlayColor || "transparent"} fallback="#000000" allowTransparent onChange={(value) => update({ columnOverlayColor: value })} />
          </div>
        </div>

        {columnConfigs.map((column) => {
          const imageValue = resolveAssetField(props, column.imageKey, brandAssets) || props?.[column.imageKey] || "";
          const colContentType = String(props?.[`${column.prefix}ContentType`] || "text");
          const isNewsletter = colContentType === "newsletter";
          return (
            <div key={column.id} style={styles.sectionCard}>
              <label style={styles.propertyLabel}>{column.label}</label>

              {/* Card width */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <NumberField label="Card Width (fr)" value={Number(props[`${column.prefix}Width`]) || 1} min={1} max={10} onChange={(value) => update({ [`${column.prefix}Width`]: value })} />
              </div>

              {/* Column type selector */}
              <div style={styles.inlineChipRow}>
                {[{ value: "text", label: "📝 Text / Image" }, { value: "newsletter", label: "📬 Newsletter" }].map((opt) => (
                  <button key={opt.value} type="button"
                    style={{ ...styles.presetChip, ...(colContentType === opt.value ? styles.presetChipActive : {}) }}
                    onClick={() => update({ [`${column.prefix}ContentType`]: opt.value })}
                  >{opt.label}</button>
                ))}
              </div>

              {isNewsletter ? (
                /* Newsletter column config */
                <>
                  <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Image Above Form</label>
                  <div style={styles.assetPicker}>
                    <label style={styles.assetUploadCta}>
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        style={styles.hiddenInput}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (!file) return;
                          await applyUploadedAsset(`${column.prefix}NewsletterImage`, file);
                        }}
                      />
                    </label>
                    {savedImages.map((asset) => (
                      <button
                        key={`nl-img-${column.id}-${asset.id || asset.src}`}
                        type="button"
                        style={styles.assetThumbBtn}
                        title={asset.name || "Image"}
                        onClick={() => {
                          const nextProps = applyAssetToProps(props, `${column.prefix}NewsletterImage`, asset);
                          onChange(index, { ...nextProps, [`${column.prefix}NewsletterImage`]: asset.src || "" });
                        }}
                      >
                        <img src={asset.src} alt={asset.name || "Image"} style={styles.assetThumbPreview} />
                      </button>
                    ))}
                    {resolveAssetField(props, `${column.prefix}NewsletterImage`, brandAssets) ? (
                      <button type="button" style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }} onClick={() => update({ [`${column.prefix}NewsletterImage`]: "", [`${column.prefix}NewsletterImageAssetId`]: undefined })}>
                        Remove Image
                      </button>
                    ) : null}
                  </div>
                  <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Heading</label>
                  <input type="text" value={String(props?.[`${column.prefix}NewsletterHeading`] || "")} onChange={(e) => update({ [`${column.prefix}NewsletterHeading`]: e.target.value })} style={styles.propertyInput} placeholder="Stay Updated" />
                  <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Subtitle</label>
                  <input type="text" value={String(props?.[`${column.prefix}NewsletterSubtitle`] || "")} onChange={(e) => update({ [`${column.prefix}NewsletterSubtitle`]: e.target.value })} style={styles.propertyInput} placeholder="Get the latest news." />

                  {/* Form Fields */}
                  <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Form Fields</label>
                  {(() => {
                    const fields = Array.isArray(props?.[`${column.prefix}NewsletterFields`]) ? props[`${column.prefix}NewsletterFields`] : [{ type: "email", placeholder: "Email address" }];
                    const fieldTypes = [
                      { value: "name", label: "Name" },
                      { value: "firstName", label: "First Name" },
                      { value: "lastName", label: "Last Name" },
                      { value: "email", label: "Email" },
                      { value: "phone", label: "Phone" },
                      { value: "company", label: "Company" },
                      { value: "message", label: "Message" },
                    ];
                    const setFields = (next) => update({ [`${column.prefix}NewsletterFields`]: next });
                    return (
                      <>
                        {fields.map((field, fi) => (
                          <div key={fi} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                            <select
                              value={field.type || "email"}
                              onChange={(e) => { const next = [...fields]; next[fi] = { ...next[fi], type: e.target.value, placeholder: fieldTypes.find(f => f.value === e.target.value)?.label || e.target.value }; setFields(next); }}
                              style={{ ...styles.propertyInput, flex: 1, margin: 0 }}
                            >
                              {fieldTypes.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                            </select>
                            <input
                              type="text"
                              value={field.placeholder || ""}
                              placeholder="Placeholder"
                              onChange={(e) => { const next = [...fields]; next[fi] = { ...next[fi], placeholder: e.target.value }; setFields(next); }}
                              style={{ ...styles.propertyInput, flex: 1, margin: 0 }}
                            />
                            <button
                              type="button"
                              style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca", flexShrink: 0, padding: "4px 8px" }}
                              onClick={() => setFields(fields.filter((_, i) => i !== fi))}
                            >✕</button>
                          </div>
                        ))}
                        <button
                          type="button"
                          style={{ ...styles.secondaryBtn, width: "100%", marginTop: 4 }}
                          onClick={() => setFields([...fields, { type: "email", placeholder: "Email address" }])}
                        >+ Add Field</button>
                      </>
                    );
                  })()}

                  <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Button Text</label>
                  <input type="text" value={String(props?.[`${column.prefix}NewsletterButtonText`] || "")} onChange={(e) => update({ [`${column.prefix}NewsletterButtonText`]: e.target.value })} style={styles.propertyInput} placeholder="Subscribe" />
                  <div style={{ ...styles.colorGrid, marginTop: 8 }}>
                    <CompactColorField label="Button Bg" value={props?.[`${column.prefix}NewsletterButtonColor`] || "#2563eb"} fallback="#2563eb" onChange={(v) => update({ [`${column.prefix}NewsletterButtonColor`]: v })} />
                    <CompactColorField label="Button Text" value={props?.[`${column.prefix}NewsletterButtonTextColor`] || "#ffffff"} fallback="#ffffff" onChange={(v) => update({ [`${column.prefix}NewsletterButtonTextColor`]: v })} />
                  </div>
                </>
              ) : (
                /* Text/Image column config */
                <>
                  <input type="text" value={String(props?.[column.titleKey] || "")} onChange={(e) => update({ [column.titleKey]: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="Column title" />
                  <textarea value={String(props?.[column.contentKey] || "")} onChange={(e) => update({ [column.contentKey]: e.target.value })} style={{ ...styles.propertyInput, minHeight: 96 }} placeholder="Column content" />
                  <div style={styles.assetPicker}>
                    <label style={styles.assetUploadCta}>
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        style={styles.hiddenInput}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (!file) return;
                          await applyUploadedAsset(column.imageKey, file);
                        }}
                      />
                    </label>
                    {savedImages.map((asset) => (
                      <button
                        key={`${column.id}-${asset.id || asset.src}`}
                        type="button"
                        style={styles.assetThumbBtn}
                        title={asset.name || column.label}
                        onClick={() => {
                          const nextProps = applyAssetToProps(props, column.imageKey, asset);
                          onChange(index, { ...nextProps, [column.imageKey]: asset.src || "" });
                          onSelectAsset?.(index, column.imageKey, asset);
                        }}
                      >
                        <img src={asset.src} alt={asset.name || column.label} style={styles.assetThumbPreview} />
                      </button>
                    ))}
                    {imageValue ? (
                      <button type="button" style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }} onClick={() => update({ [column.imageKey]: "" })}>
                        Remove Image
                      </button>
                    ) : null}
                  </div>
                  {imageValue ? (
                    <button
                      type="button"
                      style={{ ...styles.secondaryBtn, marginTop: 8 }}
                      onClick={() => onOpenImageEditor?.(index, column.imageKey, imageValue)}
                    >
                      ✂️ Crop / Edit Image
                    </button>
                  ) : null}
                  {imageValue ? (
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <label style={styles.label}>Image Height (px)</label>
                      <input
                        type="number"
                        min={60}
                        max={1200}
                        step={10}
                        value={props?.[`${column.prefix}ImageHeight`] || ""}
                        placeholder="Auto"
                        onChange={(e) => {
                          const val = e.target.value === "" ? undefined : Number(e.target.value);
                          update({ [`${column.prefix}ImageHeight`]: val });
                        }}
                        style={{ ...styles.input, width: 90 }}
                      />
                      {props?.[`${column.prefix}ImageHeight`] ? (
                        <button type="button" style={{ ...styles.assetChip, fontSize: 11, padding: "2px 8px" }} onClick={() => update({ [`${column.prefix}ImageHeight`]: undefined })}>Auto</button>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}

              {/* Per-column style options (shared between both types) */}
              <div style={styles.colorGrid}>
                <NumberField label="Top Margin" value={Number(props?.[`${column.prefix}MarginTop`] ?? 0)} min={0} max={240} onChange={(value) => update({ [`${column.prefix}MarginTop`]: value })} />
                <NumberField label="Padding" value={Number(props?.[`${column.prefix}Padding`] ?? props.columnPadding ?? 18)} min={0} max={96} onChange={(value) => update({ [`${column.prefix}Padding`]: value })} />
                <NumberField label="Radius" value={Number(props?.[`${column.prefix}Radius`] ?? props.columnRadius ?? 18)} min={0} max={80} onChange={(value) => update({ [`${column.prefix}Radius`]: value })} />
                <NumberField label="Min Height" value={Number(props?.[`${column.prefix}MinHeight`] ?? 0)} min={0} max={1200} onChange={(value) => update({ [`${column.prefix}MinHeight`]: value })} />
              </div>
              <div style={styles.inlineChipRow}>
                {[
                  { value: "left", label: "Left" },
                  { value: "center", label: "Center" },
                  { value: "right", label: "Right" },
                ].map((option) => (
                  <button key={`${column.id}-${option.value}`} type="button" style={{ ...styles.presetChip, ...(String(props?.[`${column.prefix}ContentAlign`] || props.columnContentAlign || "left") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ [`${column.prefix}ContentAlign`]: option.value })}>
                    {option.label}
                  </button>
                ))}
              </div>
              <div style={styles.colorGrid}>
                <ColorSelector label="Background" value={props?.[`${column.prefix}BackgroundColor`] || props.columnBackgroundColor || props.cardBackgroundColor || "#f8fafc"} fallback="#f8fafc" onChange={(value) => update({ [`${column.prefix}BackgroundColor`]: value })} />
                <ColorSelector label="Border" value={props?.[`${column.prefix}BorderColor`] || props.columnBorderColor || "#cbd5e1"} fallback="#cbd5e1" onChange={(value) => update({ [`${column.prefix}BorderColor`]: value })} />
                <ColorSelector label="Title" value={props?.[`${column.prefix}TitleColor`] || props.columnTitleColor || props.textColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ [`${column.prefix}TitleColor`]: value })} />
                <ColorSelector label="Body" value={props?.[`${column.prefix}BodyColor`] || props.columnBodyColor || "#334155"} fallback="#334155" onChange={(value) => update({ [`${column.prefix}BodyColor`]: value })} />
              </div>
              <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Shadow</label>
              <div style={styles.inlineChipRow}>
                {[
                  { value: "none", label: "None" },
                  { value: "soft", label: "Soft" },
                  { value: "medium", label: "Medium" },
                  { value: "strong", label: "Strong" },
                ].map((option) => (
                  <button key={`${column.id}-shadow-${option.value}`} type="button" style={{ ...styles.presetChip, ...(String(props?.[`${column.prefix}Shadow`] || props.columnShadow || "soft") === option.value ? styles.presetChipActive : {}) }} onClick={() => update({ [`${column.prefix}Shadow`]: option.value })}>
                    {option.label}
                  </button>
                ))}
              </div>
              <input type="text" value={String(props?.[`${column.prefix}Gradient`] || "")} onChange={(e) => update({ [`${column.prefix}Gradient`]: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="linear-gradient(...)" />
              <div style={{ marginTop: 8 }}>
                <ColorSelector label="Overlay" value={props?.[`${column.prefix}OverlayColor`] || "transparent"} fallback="#000000" allowTransparent onChange={(value) => update({ [`${column.prefix}OverlayColor`]: value })} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContactFormPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage, onSelectAsset }) {
  const props = block?.props || {};
  const fields = normalizeContactFields(props.fields);
  const update = (patch) => onChange(index, { ...props, ...patch });
  const savedImages = [brandAssets?.logo, ...(Array.isArray(brandAssets?.images) ? brandAssets.images : [])].filter(Boolean).slice(0, 8);

  const updateField = (fieldIndex, patch) => {
    const nextFields = fields.map((field, currentIndex) => (
      currentIndex === fieldIndex
        ? {
            ...field,
            ...patch,
            label: Object.prototype.hasOwnProperty.call(patch, "label") ? htmlToPlainText(patch.label) : field.label,
            name: Object.prototype.hasOwnProperty.call(patch, "name") ? String(patch.name || "") : field.name,
            placeholder: Object.prototype.hasOwnProperty.call(patch, "placeholder") ? htmlToPlainText(patch.placeholder) : field.placeholder,
          }
        : field
    ));
    update({ fields: nextFields });
  };

  const removeField = (fieldIndex) => {
    update({ fields: fields.filter((_, currentIndex) => currentIndex !== fieldIndex) });
  };

  const addField = () => {
    update({
      fields: [...fields, createContactField(fields.length, { label: `Field ${fields.length + 1}`, type: "text", required: false, placeholder: "" })],
    });
  };

  const applyTemplate = (template) => {
    onChange(index, {
      ...props,
      title: template.title,
      subtitle: template.subtitle,
      submitText: template.submitText,
      submitAction: template.submitAction || props.submitAction || "none",
      bookingUrl: resolveContactBookingUrl(template.bookingUrl || props.bookingUrl || ""),
      fields: normalizeContactFields(template.fields),
    });
  };

  const applyStyleTemplate = (template) => {
    onChange(index, { ...props, ...template.patch });
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>✉️ Edit: Contact Form</h3>
      <p style={{ margin: "0 0 12px 16px", color: "#64748b", fontSize: 12 }}>Click title, subtitle, field labels and the button directly on the page to edit text.</p>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Style</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
            {CONTACT_FORM_STYLE_TEMPLATES.map((template) => {
              const active = String(props.formVariant || "minimal-soft") === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyStyleTemplate(template)}
                  style={{
                    ...styles.secondaryBtn,
                    justifyContent: "center",
                    background: active ? "#2563eb" : undefined,
                    color: active ? "#ffffff" : undefined,
                    border: active ? "1px solid #2563eb" : undefined,
                    fontWeight: active ? 700 : undefined,
                  }}
                >{template.label}</button>
              );
            })}
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Form Type</label>
          <div style={styles.presetGrid}>
            {CONTACT_FORM_TEMPLATES.map((template) => (
              <button key={template.id} type="button" style={styles.presetChip} onClick={() => applyTemplate(template)}>
                {template.label}
              </button>
            ))}
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Layout</label>
          <NumberField label="Form Width" value={Number(props.formMaxWidth || 760)} min={360} max={1200} onChange={(value) => update({ formMaxWidth: value })} />
          <div style={{ marginTop: 8 }}>
            <label style={styles.propertyLabel}>Submit Action</label>
            <select value={String(props.submitAction || "none")} onChange={(e) => update({ submitAction: e.target.value })} style={styles.propertyInput}>
              <option value="none">Preview Only</option>
              <option value="calendar-booking">Open Calendar Booking</option>
            </select>
          </div>
          {String(props.submitAction || "none") === "calendar-booking" ? (
            <>
              <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Booking URL</label>
              <input type="text" value={resolveContactBookingUrl(props.bookingUrl || "")} onChange={(e) => update({ bookingUrl: e.target.value })} style={styles.propertyInput} placeholder={DEFAULT_ENQUIRY_BOOKING_URL} />
              <p style={styles.aiHint}>Your public calendar booking page, e.g. `/u/your-username`.</p>
            </>
          ) : null}
          <div style={{ marginTop: 8 }}>
            <label style={styles.propertyLabel}>Image Position</label>
            <select value={String(props.mediaPosition || "none")} onChange={(e) => update({ mediaPosition: e.target.value })} style={styles.propertyInput}>
              {[
                { value: "none", label: "No Image" },
                { value: "top", label: "Top" },
                { value: "left", label: "Left Side" },
                { value: "right", label: "Right Side" },
              ].map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
        {String(props.mediaPosition || "none") !== "none" ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Form Image</label>
            <div style={styles.assetPicker}>
              <label style={styles.assetUploadCta}>
                Upload Image
                <input
                  type="file"
                  accept="image/*"
                  style={styles.hiddenInput}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    onUploadImage(index, "mediaImage", file);
                  }}
                />
              </label>
              {props.mediaImage ? (
                <button type="button" style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }} onClick={() => update({ mediaImage: "" })}>
                  Remove
                </button>
              ) : null}
              {savedImages.map((image) => (
                <button
                  key={`contact-media-${image.id}`}
                  type="button"
                  style={styles.assetThumbBtn}
                  onClick={() => {
                    const nextProps = applyAssetToProps(props || {}, "mediaImage", image);
                    onChange(index, { ...nextProps, mediaImage: image.src || "" });
                    onSelectAsset(index, "mediaImage", image);
                  }}
                  title={image.name}
                >
                  <img src={image.src} alt={image.name} style={styles.assetThumbPreview} />
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Colours</label>
          <div style={styles.colorGrid}>
            <CompactColorField label="Section BG" value={props.backgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ backgroundColor: value })} />
            <CompactColorField label="Card BG" value={props.cardBackgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ cardBackgroundColor: value })} />
            <CompactColorField label="Text" value={props.textColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ textColor: value })} />
            <CompactColorField label="Muted Text" value={props.subtleTextColor || "#475569"} fallback="#475569" onChange={(value) => update({ subtleTextColor: value })} />
            <CompactColorField label="Button BG" value={props.buttonBackgroundColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ buttonBackgroundColor: value })} />
            <CompactColorField label="Button Text" value={props.buttonTextColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ buttonTextColor: value })} />
            <CompactColorField label="Input BG" value={props.inputBackgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ inputBackgroundColor: value })} />
            <CompactColorField label="Input Border" value={props.inputBorderColor || "#cbd5e1"} fallback="#cbd5e1" onChange={(value) => update({ inputBorderColor: value })} />
            <CompactColorField label="Input Text" value={props.inputTextColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ inputTextColor: value })} />
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Fields</label>
          <div style={styles.propertyGrid}>
            {fields.map((field, fieldIndex) => (
              <div key={`${field.name}-${fieldIndex}`} style={styles.linkRowCard}>
                <div style={styles.linkRowHeader}>
                  <span style={styles.linkRowTitle}>{field.label || `Field ${fieldIndex + 1}`}</span>
                  <button type="button" style={styles.iconDeleteBtn} aria-label={`Delete field ${fieldIndex + 1}`} title="Delete field" onClick={() => removeField(fieldIndex)}>×</button>
                </div>
                <input type="text" value={String(field.label || "")} onChange={(e) => updateField(fieldIndex, { label: e.target.value })} style={styles.propertyInput} placeholder="Field label" />
                <input type="text" value={String(field.name || "")} onChange={(e) => updateField(fieldIndex, { name: e.target.value.replace(/[^a-zA-Z0-9-_]/g, "-") })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="field-name" />
                <input type="text" value={String(field.placeholder || "")} onChange={(e) => updateField(fieldIndex, { placeholder: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="Placeholder text" />
                <div style={{ marginTop: 8 }}>
                  <label style={styles.propertyLabel}>Field Type</label>
                  <select value={String(field.type || "text")} onChange={(e) => updateField(fieldIndex, { type: e.target.value })} style={styles.propertyInput}>
                    {["text", "email", "tel", "textarea"].map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
                  <input type="checkbox" checked={field.required !== false} onChange={(e) => updateField(fieldIndex, { required: e.target.checked })} />
                  Required field
                </label>
              </div>
            ))}
          </div>
          <button type="button" style={{ ...styles.secondaryBtn, marginTop: 10 }} onClick={addField}>+ Add Field</button>
        </div>
      </div>
    </div>
  );
}

const PropertiesPanel = ({ block, index, onChange, brandAssets, onUploadImage, onSelectAsset, onOpenImageEditor, onOpenSimpleImageEditor, project, activePage, currentObjective }) => {
  const [regenBusy, setRegenBusy] = useState(false);
  const [regenError, setRegenError] = useState("");
  const [regenTone, setRegenTone] = useState("balanced");
  const [sectionHeightDraft, setSectionHeightDraft] = useState("");

  useEffect(() => {
    setRegenBusy(false);
    setRegenError("");
    setSectionHeightDraft(String(parsePixelValue(block?.props?.minHeight, block?.type === BlockTypes.HERO ? 420 : 220)));
  }, [block?.id, block?.props?.minHeight, block?.type]);

  if (!block) {
    return (
      <div style={styles.properties}>
        <p style={styles.noSelection}>Select a block to edit properties</p>
      </div>
    );
  }

  const def = BlockDefinitions[block.type];
  const savedImages = Array.isArray(brandAssets?.images) ? brandAssets.images : [];
  const savedLogo = brandAssets?.logo || null;
  const isHero = [BlockTypes.HERO, BlockTypes.PARALLAX].includes(block.type);
  const fontWeightKey = isHero ? "headlineFontWeight" : "fontWeight";
  const fontFamilyKey = isHero ? "headlineFontFamily" : "fontFamily";
  const colorKey = isHero ? "headlineColor" : "textColor";
  const alignKey = isHero ? "headlineAlignment" : "alignment";
  const supportsParallaxToggle = [BlockTypes.HERO, BlockTypes.PARALLAX, BlockTypes.TEXT].includes(block.type);
  const isPositionableText = block.type === BlockTypes.PARALLAX || (!!block?.props?.enableParallax && [BlockTypes.HERO, BlockTypes.TEXT].includes(block.type));
  const supportsOverlayImage = [BlockTypes.HERO, BlockTypes.PARALLAX].includes(block.type);

  function applyCanvasAlignment(axis, value) {
    const nextProps = { ...(block.props || {}) };

    if (axis === "x") {
      nextProps[alignKey] = value;
    } else {
      nextProps.verticalAlign = value;
    }

    onChange(index, nextProps);
  }

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
    return (
      <NavbarPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onSelectAsset={onSelectAsset}
      />
    );
  }

  if (block.type === BlockTypes.IMAGE_STACK) {
    return (
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
    return (
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
    return (
      <FeatureListPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onOpenImageEditor={onOpenImageEditor}
      />
    );
  }

  if (block.type === BlockTypes.IMAGE_GALLERY) {
    return (
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
    return (
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
    return (
      <TestimonialPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
      />
    );
  }

  if (block.type === BlockTypes.TEXT) {
    return (
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
    return (
      <NewsletterPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
      />
    );
  }

  if (block.type === BlockTypes.TRUST_BADGES) {
    return (
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
    return (
      <StatsPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
      />
    );
  }

  if (block.type === BlockTypes.FOOTER) {
    return (
      <FooterPropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
        brandAssets={brandAssets}
        onUploadImage={onUploadImage}
        onOpenSimpleImageEditor={onOpenSimpleImageEditor || onOpenImageEditor}
      />
    );
  }

  if (block.type === BlockTypes.PRICING_TABLE) {
    return (
      <PricingTablePropertiesPanel
        block={block}
        index={index}
        onChange={onChange}
      />
    );
  }

  if (block.type === BlockTypes.CONTACT_FORM) {
    return (
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
    return (
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

  if (block.type === BlockTypes.SPACE) {
    const spacerPx = parsePixelValue(block.props?.height, 40);
    return (
      <div style={styles.properties}>
        <h3 style={styles.propertiesTitle}>⬆️ Edit: Spacer</h3>
        <div style={styles.propertyGrid}>
          <div style={styles.sectionCard}>
            <NumberField label="Height (px)" value={spacerPx} min={4} max={600} onChange={(value) => onChange(index, { ...block.props, height: `${value}px` })} />
          </div>
        </div>
      </div>
    );
  }

  if ([BlockTypes.COLUMNS_2, BlockTypes.COLUMNS_3].includes(block.type)) {
    return (
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

  const textContentKeys = Object.keys(block.props || {}).filter((k) => isLongTextField(k));

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🎨 Edit: {def?.name}</h3>
      <div style={styles.propertyGrid}>
        {supportsSectionHeight(block.type) ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Section Height</label>
            <input
              type="text"
              inputMode="numeric"
              value={sectionHeightDraft}
              onChange={(e) => setSectionHeightDraft(String(e.target.value || "").replace(/[^\d]/g, ""))}
              onBlur={() => {
                const px = Math.max(120, Number(sectionHeightDraft || 0) || (block.type === BlockTypes.HERO ? 420 : 220));
                const next = String(px);
                setSectionHeightDraft(next);
                onChange(index, { ...block.props, minHeight: `${next}px` });
              }}
              placeholder="420"
              style={styles.propertyInput}
            />
          </div>
        ) : null}
        {supportsFullWidthBackground(block.type) ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Background Width</label>
            <label style={styles.inlineToggle}>
              <input
                type="checkbox"
                checked={!!block?.props?.fullWidthBackground}
                onChange={(e) => onChange(index, { ...block.props, fullWidthBackground: e.target.checked })}
              />
              Full width background
            </label>
          </div>
        ) : null}
        {supportsParallaxToggle ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Parallax Mode</label>
            <label style={styles.inlineToggle}>
              <input
                type="checkbox"
                checked={block?.props?.enableParallax !== false}
                onChange={(e) => {
                  const nextEnabled = e.target.checked;
                  onChange(index, {
                    ...block.props,
                    enableParallax: nextEnabled,
                    ...(nextEnabled ? {
                      backgroundImage: block?.props?.backgroundImage || "https://placehold.co/1600x900/0f172a/e2e8f0?text=Parallax+Section",
                    } : {}),
                  });
                }}
              />
              Enable parallax and free-move text
            </label>
          </div>
        ) : null}
        {supportsCopyRegeneration(block.type) ? (
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
        <BlockPresetPicker
          blockType={block.type}
          onApply={(patch) => onChange(index, { ...block.props, ...patch })}
        />
        {![BlockTypes.HERO, BlockTypes.PARALLAX, BlockTypes.STATS, BlockTypes.CTA_BUTTON].includes(block.type) && textContentKeys.length ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Text Content</label>
            <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
              {textContentKeys.map((key) => (
                <div key={key} style={styles.propertyField}>
                  <label style={styles.propertyLabel}>{formatLabel(key)}</label>
                  <RichText
                    value={String(block.props?.[key] || "")}
                    onChange={(nextHtml) => onChange(index, { ...block.props, [key]: nextHtml })}
                    placeholder={`Write ${formatLabel(key).toLowerCase()}...`}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {supportsOverlayImage ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Overlay Image / Logo</label>
            <p style={styles.aiHint}>Add a logo, badge, or product shot over the background image.</p>
            <div style={styles.assetPicker}>
              <label style={styles.assetUploadCta}>
                Upload Overlay
                <input
                  type="file"
                  accept="image/*"
                  style={styles.hiddenInput}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    onChange(index, withHeroOverlayDefaults(block.props || {}));
                    onUploadImage(index, "floatingImage", file);
                  }}
                />
              </label>
              {savedLogo ? (
                <button
                  type="button"
                  style={styles.assetChip}
                  onClick={() => {
                    const nextProps = applyAssetToProps(block.props || {}, "floatingImage", savedLogo);
                    onChange(index, {
                      ...withHeroOverlayDefaults(nextProps),
                      floatingImage: savedLogo.src || "",
                    });
                    onSelectAsset(index, "floatingImage", savedLogo);
                  }}
                >
                  Use Brand Logo
                </button>
              ) : null}
              {!block?.props?.floatingImage ? (
                <button
                  type="button"
                  style={styles.assetChip}
                  onClick={() => onChange(index, {
                    ...withHeroOverlayDefaults(block.props || {}),
                    floatingImage: "https://placehold.co/640x640/f8fafc/0f172a?text=Overlay+Image",
                  })}
                >
                  Add Placeholder
                </button>
              ) : (
                <button
                  type="button"
                  style={{ ...styles.assetChip, background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.35)", color: "#fecaca" }}
                  onClick={() => onChange(index, { ...block.props, floatingImage: "" })}
                >
                  Remove Overlay
                </button>
              )}
              {savedImages.slice(0, 6).map((image) => (
                <button
                  key={`floating-${image.id}`}
                  type="button"
                  style={styles.assetThumbBtn}
                  onClick={() => {
                    const nextProps = applyAssetToProps(block.props || {}, "floatingImage", image);
                    onChange(index, {
                      ...withHeroOverlayDefaults(nextProps),
                      floatingImage: image.src || "",
                    });
                    onSelectAsset(index, "floatingImage", image);
                  }}
                  title={image.name}
                >
                  <img src={image.src} alt={image.name} style={styles.assetThumbPreview} />
                </button>
              ))}
            </div>
            <div style={styles.colorGrid}>
              <NumberField label="Image X %" value={Number(block?.props?.floatingX ?? 76)} min={0} max={100} onChange={(value) => onChange(index, { ...block.props, enableParallax: true, floatingX: value })} />
              <NumberField label="Image Y %" value={Number(block?.props?.floatingY ?? 58)} min={0} max={100} onChange={(value) => onChange(index, { ...block.props, enableParallax: true, floatingY: value })} />
              <NumberField label="Image W" value={Number(block?.props?.floatingWidth ?? 220)} min={80} max={1000} onChange={(value) => onChange(index, { ...block.props, enableParallax: true, floatingWidth: value })} />
              <NumberField label="Image H" value={Number(block?.props?.floatingHeight ?? 220)} min={80} max={1000} onChange={(value) => onChange(index, { ...block.props, enableParallax: true, floatingHeight: value })} />
            </div>
          </div>
        ) : null}
        {Object.entries(block.props || {}).map(([key, value]) => {
          // Skip internal/layout-only fields and long text fields (shown at top)
          if (["id", "type", "fullWidthBackground", "minHeight", "parallaxStrength", "enableParallax", "contentX", "contentY", "contentWidth", "contentHeight", "verticalAlign", "headlineFontSize", "subheadlineFontSize", "textFontSize", "textSize", "floatingX", "floatingY", "floatingWidth", "floatingHeight", "floatingImage", "floatingAlt", "contentBackground"].includes(key)) return null;
          if (isLongTextField(key)) return null;
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
                  style={styles.propertyInput}
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
              ) : Array.isArray(value) ? (
                <textarea
                  value={JSON.stringify(value, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      onChange(index, { ...block.props, [key]: parsed });
                    } catch {}
                  }}
                  style={{ ...styles.propertyInput, minHeight: "80px" }}
                  placeholder="JSON array"
                />
              ) : typeof value === "object" && value !== null ? (
                <textarea
                  value={JSON.stringify(value, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      onChange(index, { ...block.props, [key]: parsed });
                    } catch {}
                  }}
                  style={{ ...styles.propertyInput, minHeight: "80px" }}
                  placeholder="JSON object"
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
                  {savedImages.map((image) => (
                    <button
                      key={`${key}-${image.id}`}
                      type="button"
                      style={styles.assetThumbBtn}
                      onClick={() => onSelectAsset(index, key, image)}
                      title={image.name}
                    >
                      <img src={image.src} alt={image.name} style={styles.assetThumbPreview} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const renderBlockPreview = (block, assets, options = {}) => renderWebsiteBlock(block, { compact: false, assets, editor: true, ...options });

export default function PageBuilderCanvas({ project, brandAssets, pageBlocks = [], activePage = "", currentObjective = "", onSave, onUploadImage, onSelectAsset, onSaveAsGlobal, onUpdateGlobalBlock, showHeader = true }) {
  const [blocks, setBlocks] = useState(pageBlocks);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [selectedGlobalRole, setSelectedGlobalRole] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [isNarrowLayout, setIsNarrowLayout] = useState(false);
  const [showLibrary, setShowLibrary] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [rightPanelMode, setRightPanelMode] = useState("block");
  const [showCanvasGrid, setShowCanvasGrid] = useState(true);
  const [previewMode, setPreviewMode] = useState("desktop");
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [showTextToolbar, setShowTextToolbar] = useState(false);
  const [textToolbarState, setTextToolbarState] = useState({
    color: "#111827",
    highlight: "#ffffff",
    fontFamily: "Arial",
    fontSize: 18,
    blockType: "P",
    canStyleBox: false,
    boxBackgroundColor: "transparent",
    boxBackgroundImage: "",
    boxWidth: 360,
    textAnimation: "none",
    textAnimationSpeed: 0.8,
    textAnimationDelay: 0,
    motionLabel: "Text Motion",
  });
  const [textToolbarPosition, setTextToolbarPosition] = useState({ x: 160, y: 120, width: 1120 });
  const [animationPopover, setAnimationPopover] = useState({ visible: false, index: null, x: 24, y: 120, width: 980 });
  const [animationReplayState, setAnimationReplayState] = useState({ index: null, tick: 0 });
  const [saveNotice, setSaveNotice] = useState(null);
  const [imageEditState, setImageEditState] = useState(null);
  const activeEditableRef = useRef(null);
  const latestBlocksRef = useRef(Array.isArray(pageBlocks) ? pageBlocks : []);
  const selectionRangeRef = useRef(null);
  const textToolbarDraggedRef = useRef(false);
  const animationPopoverDraggedRef = useRef(false);
  const showTextToolbarRef = useRef(false);
  const saveNoticeTimerRef = useRef(null);

  const selectedBlock = typeof selectedIndex === "number" ? blocks[selectedIndex] || null : null;
  const selectedGlobalBlock = selectedGlobalRole === "nav"
    ? (project?.globalNavBlock || null)
    : selectedGlobalRole === "footer"
      ? (project?.globalFooterBlock || null)
      : null;
  const imageEditorUserId = project?.userId || project?.user_id || project?.ownerId || project?.owner_id || undefined;
  latestBlocksRef.current = blocks;

  useEffect(() => {
    latestBlocksRef.current = Array.isArray(pageBlocks) ? pageBlocks : [];
    setBlocks(Array.isArray(pageBlocks) ? pageBlocks : []);
    setSelectedIndex(null);
    setSelectedGlobalRole(null);
    setDropIndex(null);
  }, [pageBlocks]);

  useEffect(() => {
    if (selectedGlobalRole === "nav" && !project?.globalNavBlock) {
      setSelectedGlobalRole(null);
      return;
    }
    if (selectedGlobalRole === "footer" && !project?.globalFooterBlock) {
      setSelectedGlobalRole(null);
    }
  }, [project?.globalFooterBlock, project?.globalNavBlock, selectedGlobalRole]);

  useEffect(() => {
    showTextToolbarRef.current = showTextToolbar;
  }, [showTextToolbar]);

  const findEditable = (node) => {
    if (!(node instanceof Element)) return null;
    return node.closest?.('[contenteditable="true"], [data-inline-editor="true"], [data-layer-editor="true"], [data-website-inline-editor="true"]') || null;
  };

  const getTextToolbarDockPosition = () => {
    if (typeof window === "undefined") return { x: 24, y: 84, width: 720 };
    const viewportWidth = window.innerWidth || 1440;
    const toolbarWidth = Math.max(280, Math.min(viewportWidth - 24, 760));
    return {
      x: Math.max(12, viewportWidth - toolbarWidth - 12),
      y: 84,
      width: toolbarWidth,
    };
  };

  const syncToolbarForEditable = (editable, selection = typeof window !== "undefined" ? window.getSelection?.() : null, options = {}) => {
    if (!editable || typeof window === "undefined") return;

    activeEditableRef.current = editable;
    if (options?.reveal || showTextToolbarRef.current) {
      setShowTextToolbar(true);
    }

    const blockRoot = editable.closest?.("[data-canvas-block-index]");
    const blockIndex = Number(blockRoot?.getAttribute?.("data-canvas-block-index"));
    if (Number.isInteger(blockIndex)) {
      setSelectedGlobalRole(null);
      setSelectedIndex((prev) => (prev === blockIndex ? prev : blockIndex));
    }

    if (selection?.rangeCount) {
      const range = selection.getRangeAt(0).cloneRange();
      selectionRangeRef.current = range;
      if (!textToolbarDraggedRef.current && options?.reveal) {
        setTextToolbarPosition(getTextToolbarDockPosition());
      }
    }

    const styleSource = getSelectionStyleSource(editable, selection) || editable;
    const computed = window.getComputedStyle(styleSource);
    const backgroundTarget = getEditableBackgroundTarget(editable) || editable;
    const backgroundComputed = window.getComputedStyle(backgroundTarget);
    const tagName = String(editable.tagName || "P").toUpperCase();
    const fontFamilyRaw = String(computed.fontFamily || "Arial")
      .split(",")[0]
      .replace(/["']/g, "")
      .trim() || "Arial";
    const fontSizeValue = Math.max(12, Math.round(parseFloat(computed.fontSize || "18") || 18));
    const currentBlock = Number.isInteger(blockIndex) ? blocks[blockIndex] || null : null;
    const layerIndex = Number.isInteger(currentBlock?.props?.selectedLayerIndex) ? currentBlock.props.selectedLayerIndex : null;
    const activeLayer = layerIndex != null && Array.isArray(currentBlock?.props?.images) ? currentBlock.props.images[layerIndex] : null;
    const motionBinding = getTextAnimationBinding(currentBlock, editable);
    setTextToolbarState({
      color: rgbToHex(computed.color, "#111827"),
      highlight: rgbToHex(computed.backgroundColor, "#ffffff"),
      fontFamily: fontFamilyRaw,
      fontSize: fontSizeValue,
      blockType: ["H1", "H2", "H3", "P"].includes(tagName) ? tagName : "P",
      canStyleBox: editable.hasAttribute?.("data-layer-editor"),
      boxBackgroundColor: normalizeToolbarBackgroundColor(backgroundComputed.backgroundColor),
      boxBackgroundImage: parseBackgroundImageUrl(backgroundComputed.backgroundImage),
      boxWidth: Number(activeLayer?.width || 360),
      textAnimation: motionBinding ? String(currentBlock?.props?.[motionBinding.animationKey] || "none") : "none",
      textAnimationSpeed: motionBinding ? Number(currentBlock?.props?.[motionBinding.speedKey] || 0.8) : 0.8,
      textAnimationDelay: motionBinding ? Number(currentBlock?.props?.[motionBinding.delayKey] || 0) : 0,
      motionLabel: motionBinding?.label || "Text Motion",
    });
  };

  const openTextEditorForBlock = (index, triggerNode) => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    selectCanvasBlock(index);
    setShowProperties(true);
    setRightPanelMode("block");
    setAnimationPopover((prev) => ({ ...prev, visible: false }));

    const blockRoot = triggerNode?.closest?.("[data-canvas-block-index]") || document.querySelector(`[data-canvas-block-index="${index}"]`);
    const editable = blockRoot?.querySelector?.('[data-website-inline-editor="true"], [contenteditable="true"], [data-layer-editor="true"]');
    if (!editable) return;

    editable.focus();
    const selection = window.getSelection?.();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(editable);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      selectionRangeRef.current = range.cloneRange();
    }
    textToolbarDraggedRef.current = false;
    syncToolbarForEditable(editable, window.getSelection?.(), { reveal: true });
  };

  const openAnimationPanelForBlock = (index, triggerNode) => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    const blockRoot = triggerNode?.closest?.("[data-canvas-block-index]") || document.querySelector(`[data-canvas-block-index="${index}"]`);
    const rect = blockRoot?.getBoundingClientRect?.();
    const panelWidth = Math.max(720, Math.min((window.innerWidth || 1440) - 48, 980));
    const nextX = rect
      ? Math.max(12, Math.min(rect.right - panelWidth, (window.innerWidth || 1280) - panelWidth - 12))
      : 24;
    const nextY = rect
      ? Math.max(12, Math.min(rect.top + 46, (window.innerHeight || 900) - 300))
      : 120;

    selectCanvasBlock(index);
    setShowProperties(true);
    setAnimationPopover({ visible: true, index, x: nextX, y: nextY, width: panelWidth });
  };

  useEffect(() => {
    if (!animationPopover.visible) return;
    if (!Number.isInteger(animationPopover.index) || !blocks[animationPopover.index]) {
      setAnimationPopover((prev) => ({ ...prev, visible: false }));
    }
  }, [animationPopover, blocks]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onResize = () => setIsNarrowLayout(window.innerWidth < 1260);
    onResize();
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return undefined;

    const syncTextToolbar = () => {
      if (!showTextToolbarRef.current) return;

      const selection = window.getSelection?.();
      const activeElement = document.activeElement;
      const selectionNode = selection?.anchorNode;
      const selectionElement = selectionNode?.nodeType === 3 ? selectionNode.parentElement : selectionNode;
      const editable = findEditable(activeElement) || findEditable(selectionElement);
      const inToolbar = activeElement?.closest?.('[data-text-toolbar="true"]');

      if (!editable) {
        if (inToolbar && activeEditableRef.current) {
          setShowTextToolbar(true);
        }
        return;
      }

      syncToolbarForEditable(editable, selection, { reveal: false });
    };

    const handleEditableDoubleClick = (event) => {
      const editable = findEditable(event.target);
      if (!editable) return;
      textToolbarDraggedRef.current = false;
      syncToolbarForEditable(editable, window.getSelection?.(), { reveal: true });
    };

    const handleOutside = (event) => {
      const inEditable = findEditable(event.target);
      const inToolbar = event.target?.closest?.('[data-text-toolbar="true"]');
      const inAnimationPopover = event.target?.closest?.('[data-animation-popover="true"]');
      if (inEditable) {
        if (showTextToolbarRef.current) {
          syncToolbarForEditable(inEditable, window.getSelection?.(), { reveal: false });
        }
        return;
      }
      if (!inToolbar && !inAnimationPopover) {
        const pendingEditable = activeEditableRef.current;
        if (pendingEditable && typeof pendingEditable.blur === "function") {
          cleanupEditableMarkup();
          pendingEditable.blur();
        } else {
          syncActiveEditableToBlock(latestBlocksRef.current);
        }

        if (typeof window !== "undefined") {
          window.requestAnimationFrame(() => {
            activeEditableRef.current = null;
            selectionRangeRef.current = null;
            textToolbarDraggedRef.current = false;
            setShowTextToolbar(false);
            setAnimationPopover((prev) => ({ ...prev, visible: false }));
          });
        } else {
          activeEditableRef.current = null;
          selectionRangeRef.current = null;
          textToolbarDraggedRef.current = false;
          setShowTextToolbar(false);
          setAnimationPopover((prev) => ({ ...prev, visible: false }));
        }
      }
    };

    document.addEventListener("selectionchange", syncTextToolbar);
    document.addEventListener("mouseup", syncTextToolbar, true);
    document.addEventListener("keyup", syncTextToolbar, true);
    document.addEventListener("dblclick", handleEditableDoubleClick, true);
    document.addEventListener("pointerdown", handleOutside, true);

    return () => {
      document.removeEventListener("selectionchange", syncTextToolbar);
      document.removeEventListener("mouseup", syncTextToolbar, true);
      document.removeEventListener("keyup", syncTextToolbar, true);
      document.removeEventListener("dblclick", handleEditableDoubleClick, true);
      document.removeEventListener("pointerdown", handleOutside, true);
    };
  }, []);

  const workspaceColumns = useMemo(() => {
    if (isNarrowLayout) return "1fr";
    const columns = [];
    if (showLibrary) columns.push("248px");
    columns.push("minmax(0, 1.85fr)");
    if (showProperties) columns.push("minmax(332px, 360px)");
    return columns.join(" ");
  }, [isNarrowLayout, showLibrary, showProperties]);

  const handleDragStart = (e, blockType) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("newBlockType", blockType);
  };

  const createNewBlock = (blockType) => ({
    id: Date.now() + Math.floor(Math.random() * 1000),
    type: blockType,
    props: { ...BlockDefinitions[blockType].defaultProps },
  });

  const handleInsertAt = (insertIndex, dataTransfer) => {
    const safeIndex = Math.max(0, Math.min(insertIndex, blocks.length));
    const newBlockType = dataTransfer.getData("newBlockType");

    if (newBlockType && BlockDefinitions[newBlockType]) {
      const newBlock = createNewBlock(newBlockType);
      const updated = [...blocks];
      updated.splice(safeIndex, 0, newBlock);
      setBlocks(updated);
      selectCanvasBlock(safeIndex);
      return;
    }
  };

  const handleCanvasDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (dropIndex !== blocks.length) setDropIndex(blocks.length);
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    handleInsertAt(blocks.length, e.dataTransfer);
    setDropIndex(null);
  };

  const getInsertIndexFromPointer = (event, blockIndex) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    return offsetY < rect.height / 2 ? blockIndex : blockIndex + 1;
  };

  const handleBlockDragOver = (event, blockIndex) => {
    event.preventDefault();
    event.stopPropagation();
    const nextDropIndex = getInsertIndexFromPointer(event, blockIndex);
    event.dataTransfer.dropEffect = "copy";
    if (dropIndex !== nextDropIndex) setDropIndex(nextDropIndex);
  };

  const handleBlockDrop = (event, blockIndex) => {
    event.preventDefault();
    event.stopPropagation();
    handleInsertAt(getInsertIndexFromPointer(event, blockIndex), event.dataTransfer);
    setDropIndex(null);
  };

  const handleDelete = (index) => {
    const updated = blocks.filter((_, i) => i !== index);
    setBlocks(updated);
    setSelectedIndex(null);
    setSelectedGlobalRole(null);
  };

  const selectCanvasBlock = (index) => {
    setSelectedGlobalRole(null);
    setSelectedIndex(index);
  };

  const selectGlobalBlock = (role) => {
    setSelectedIndex(null);
    setShowProperties(true);
    setRightPanelMode("block");
    setSelectedGlobalRole(role);
  };

  const handleDuplicate = (index) => {
    const block = blocks[index];
    const copy = {
      ...block,
      id: Date.now(),
    };
    const updated = [...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)];
    setBlocks(updated);
    selectCanvasBlock(index + 1);
  };

  const moveBlockByStep = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;
    const updated = [...blocks];
    const [moved] = updated.splice(index, 1);
    updated.splice(nextIndex, 0, moved);
    setBlocks(updated);
    selectCanvasBlock(nextIndex);
  };

  const moveBlockToTop = (index) => {
    if (index <= 0 || index >= blocks.length) return;
    const updated = [...blocks];
    const [moved] = updated.splice(index, 1);
    updated.unshift(moved);
    setBlocks(updated);
    selectCanvasBlock(0);
  };

  const handleUpdateBlock = (index, newProps) => {
    const updated = [...blocks];
    updated[index] = { ...blocks[index], props: newProps };
    latestBlocksRef.current = updated;
    setBlocks(updated);
  };

  const handleResizeBlockHeight = (index, nextHeight) => {
    const target = blocks[index];
    if (!target) return;
    handleUpdateBlock(index, {
      ...(target.props || {}),
      minHeight: `${Math.max(160, Number(nextHeight) || 160)}px`,
    });
  };

  const applyAssetToCanvasBlock = (index, key, asset) => {
    if (!asset?.src || typeof index !== "number") return null;
    const updated = [...blocks];
    const target = updated[index];
    if (!target) return null;

    const nextProps = applyAssetToProps(target.props || {}, key, asset);
    nextProps[key] = String(asset.src || "").startsWith("data:") ? "" : asset.src;

    updated[index] = {
      ...target,
      props: nextProps,
    };

    setBlocks(updated);
    return updated;
  };

  const handleCanvasAssetSelect = (index, key, asset) => {
    const updated = applyAssetToCanvasBlock(index, key, asset);
    if (!updated) return;
    onSelectAsset?.(index, key, asset, updated);
  };

  const handleGlobalAssetSelect = (role, key, asset) => {
    if (!asset?.src) return;
    const block = role === "nav" ? project?.globalNavBlock : project?.globalFooterBlock;
    if (!block) return;

    const nextProps = applyAssetToProps(block.props || {}, key, asset);
    nextProps[key] = String(asset.src || "").startsWith("data:") ? "" : asset.src;
    onUpdateGlobalBlock?.(role, {
      ...block,
      props: nextProps,
    });
  };

  const handleCanvasImageUpload = async (index, key, file) => {
    const asset = await Promise.resolve(onUploadImage?.(index, key, file));
    if (!asset?.src) return asset;
    if (String(key || "").startsWith("__")) {
      return asset;
    }
    const updated = applyAssetToCanvasBlock(index, key, asset);
    if (updated) {
      onSave?.(updated);
    }
    return asset;
  };

  const handleGlobalImageUpload = async (role, key, file) => {
    const asset = await Promise.resolve(onUploadImage?.(-1, key, file));
    if (!asset?.src) return asset;
    handleGlobalAssetSelect(role, key, asset);
    return asset;
  };

  const openStructuredImageEditor = (blockIndex, collectionKey, itemIndex, imageKey, src) => {
    const cleanSrc = String(src || "").trim();
    if (!cleanSrc) return;
    setImageEditState({ blockIndex, collectionKey, itemIndex, imageKey, src: cleanSrc });
  };

  const openSimpleImageEditor = (blockIndex, propKey, src) => {
    const cleanSrc = String(src || "").trim();
    if (!cleanSrc) return;
    setImageEditState({ blockIndex, propKey, src: cleanSrc });
  };

  const applyEditedStructuredImage = (nextSrc) => {
    const state = imageEditState;
    setImageEditState(null);
    if (!nextSrc || typeof state?.blockIndex !== "number") return;

    // Simple top-level prop (e.g. IMAGE block's src field)
    if (state.propKey && !state.collectionKey) {
      const updated = latestBlocksRef.current.map((block, blockIndex) => {
        if (blockIndex !== state.blockIndex) return block;
        return {
          ...block,
          props: {
            ...(block?.props || {}),
            [state.propKey]: nextSrc,
            [`${state.propKey}AssetId`]: "",
          },
        };
      });
      latestBlocksRef.current = updated;
      setBlocks(updated);
      onSave?.(updated);
      return;
    }

    if (!state?.collectionKey || typeof state.itemIndex !== "number" || !state.imageKey) return;

    const updated = latestBlocksRef.current.map((block, blockIndex) => {
      if (blockIndex !== state.blockIndex) return block;
      const currentCollection = Array.isArray(block?.props?.[state.collectionKey]) ? block.props[state.collectionKey] : [];
      const nextCollection = currentCollection.map((entry, entryIndex) => (
        entryIndex === state.itemIndex
          ? { ...(entry || {}), [state.imageKey]: nextSrc, [`${state.imageKey}AssetId`]: "" }
          : entry
      ));

      return {
        ...block,
        props: {
          ...(block?.props || {}),
          [state.collectionKey]: nextCollection,
        },
      };
    });

    latestBlocksRef.current = updated;
    setBlocks(updated);
    onSave?.(updated);
  };

  const handleLayerImageUpload = async (blockIndex, layerIndex, file) => {
    const asset = await Promise.resolve(onUploadImage?.(blockIndex, "__image_stack_layer__", file));
    if (!asset?.src) return asset;

    const updated = [...blocks];
    const target = updated[blockIndex];
    if (!target) return asset;

    const currentLayers = Array.isArray(target?.props?.images) ? target.props.images : [];
    const nextLayers = currentLayers.map((layer, currentIndex) => (
      currentIndex === layerIndex
        ? {
            ...layer,
            kind: "image",
            src: String(asset.src || "").startsWith("data:") ? "" : (asset.src || layer?.src || ""),
            assetId: asset.id || "",
          }
        : layer
    ));

    updated[blockIndex] = {
      ...target,
      props: {
        ...(target.props || {}),
        images: nextLayers,
      },
    };

    setBlocks(updated);
    onSave?.(updated);
    return asset;
  };

  const toggleSelectedProp = (key) => {
    if (typeof selectedIndex !== "number" || !blocks[selectedIndex]) return;
    const current = !!blocks[selectedIndex]?.props?.[key];
    handleUpdateBlock(selectedIndex, {
      ...(blocks[selectedIndex]?.props || {}),
      [key]: !current,
    });
  };

  const handleToolbarParallax = () => {
    if (selectedBlock && [BlockTypes.HERO, BlockTypes.TEXT, BlockTypes.PARALLAX].includes(selectedBlock.type)) {
      const current = !!selectedBlock?.props?.enableParallax;
      const nextEnabled = !current;
      handleUpdateBlock(selectedIndex, {
        ...(selectedBlock?.props || {}),
        enableParallax: nextEnabled,
        ...(nextEnabled ? {
          backgroundStyle: selectedBlock?.props?.backgroundStyle || "image",
          backgroundImage: selectedBlock?.props?.backgroundImage || "https://placehold.co/1600x900/0f172a/e2e8f0?text=Parallax+Section",
        } : {}),
      });
      return;
    }

    insertPresetBlock(BlockTypes.HERO, {
      headline: "Parallax Section",
      subheadline: "Add a moving background section and customize it from the toolbar.",
      backgroundStyle: "image",
      backgroundImage: "https://placehold.co/1600x900/0f172a/e2e8f0?text=Parallax+Section",
      enableParallax: true,
      minHeight: "480px",
    });
  };

  const insertPresetBlock = (blockType, patch = {}) => {
    if (!BlockDefinitions[blockType]) return;
    const newBlock = createNewBlock(blockType);
    newBlock.props = { ...newBlock.props, ...patch };
    const insertAt = typeof selectedIndex === "number" ? selectedIndex + 1 : blocks.length;
    const updated = [...blocks];
    updated.splice(insertAt, 0, newBlock);
    setBlocks(updated);
    setSelectedIndex(insertAt);
  };

  const previewWidth = previewMode === "mobile" ? 430 : previewMode === "tablet" ? 920 : "100%";
  const canvasBlockEntries = useMemo(() => {
    const hasGlobalNav = !!project?.globalNavBlock;
    const hasGlobalFooter = !!project?.globalFooterBlock;

    return blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => {
        if (hasGlobalNav && block?.type === BlockTypes.NAV_BAR) return false;
        if (hasGlobalFooter && block?.type === BlockTypes.FOOTER) return false;
        return true;
      });
  }, [blocks, project?.globalFooterBlock, project?.globalNavBlock]);

  const applyGlobalStyles = (patch = {}) => {
    setBlocks((prev) => prev.map((block) => {
      const props = { ...(block?.props || {}) };

      if (patch.headingFontFamily) {
        props.headlineFontFamily = patch.headingFontFamily;
        props.headingFontFamily = patch.headingFontFamily;
      }

      if (patch.textAlign) {
        props.alignment = patch.textAlign;
        props.headlineAlignment = patch.textAlign;
      }

      if (patch.bodyFontFamily) {
        props.fontFamily = patch.bodyFontFamily;
        props.bodyFontFamily = patch.bodyFontFamily;
      }

      if (Number.isFinite(Number(patch.headingSize)) && Number(patch.headingSize) > 0) {
        if ([BlockTypes.HERO, BlockTypes.PARALLAX].includes(block.type)) {
          props.headlineFontSize = Number(patch.headingSize);
        }
      }

      if (Number.isFinite(Number(patch.bodySize)) && Number(patch.bodySize) > 0) {
        const nextBodySize = Number(patch.bodySize);
        if ([BlockTypes.HERO, BlockTypes.PARALLAX].includes(block.type)) {
          props.subheadlineFontSize = nextBodySize;
        }
        if (block.type === BlockTypes.TEXT) {
          props.textFontSize = nextBodySize;
        }
        if (block.type === BlockTypes.NAV_BAR) {
          props.brandFontSize = Math.max(16, nextBodySize);
          props.linkFontSize = Math.max(14, nextBodySize);
          props.ctaFontSize = Math.max(14, nextBodySize);
        }
      }

      if (patch.primaryColor) {
        props.buttonColor = patch.primaryColor;
        if (block.type === BlockTypes.NAV_BAR) {
          props.activeLinkBackgroundColor = patch.primaryColor;
        }
      }

      if (patch.cardBackgroundColor) {
        props.cardBackgroundColor = patch.cardBackgroundColor;
        props.itemBackgroundColor = patch.cardBackgroundColor;
      }

      if (patch.headingColor) {
        if ([BlockTypes.HERO, BlockTypes.PARALLAX].includes(block.type)) {
          props.headlineColor = patch.headingColor;
        }
      }

      if (patch.bodyColor) {
        props.textColor = patch.bodyColor;
        if (block.type === BlockTypes.NAV_BAR) {
          props.textColor = patch.bodyColor;
          props.activeLinkTextColor = patch.bodyColor;
        }
      }

      if (patch.sectionBackground && block.type !== BlockTypes.NAV_BAR) {
        props.backgroundColor = patch.sectionBackground;
      }

      if (patch.layoutMode) {
        props.fullWidthBackground = patch.layoutMode === "full";
      }

      if (Number.isFinite(Number(patch.pageWidth)) && Number(patch.pageWidth) > 0) {
        props.baseLayoutWidth = Number(patch.pageWidth);
      }

      if (Number.isFinite(Number(patch.buttonRadius)) && Number(patch.buttonRadius) >= 0) {
        props.buttonRadius = Number(patch.buttonRadius);
      }

      if (patch.buttonTextColor) {
        props.buttonTextColor = patch.buttonTextColor;
      }

      return { ...block, props };
    }));
  };

  const applyInlinePropPatch = (props, propPath, rawHtml) => {
    const path = String(propPath || "").split(".").filter(Boolean);
    if (!path.length) return { ...(props || {}) };

    const nextProps = { ...(props || {}) };
    const nextValue = stripEditorArtifacts(rawHtml);

    const assignPath = (target, segments, value) => {
      const [head, ...rest] = segments;
      if (!head) return target;

      if (!rest.length) {
        if (Array.isArray(target)) {
          const index = Number(head);
          if (!Number.isInteger(index)) return target;
          const next = [...target];
          next[index] = value;
          return next;
        }
        return { ...(target || {}), [head]: value };
      }

      if (Array.isArray(target)) {
        const index = Number(head);
        if (!Number.isInteger(index)) return target;
        const next = [...target];
        const existing = next[index] ?? (Number.isInteger(Number(rest[0])) ? [] : {});
        next[index] = assignPath(existing, rest, value);
        return next;
      }

      const existing = target?.[head] ?? (Number.isInteger(Number(rest[0])) ? [] : {});
      return {
        ...(target || {}),
        [head]: assignPath(existing, rest, value),
      };
    };

    const patched = assignPath(nextProps, path, nextValue);

    if (path[0] === "items" && path[2] === "question") {
      return assignPath(patched, [path[0], path[1], "heading"], nextValue);
    }

    if (path[0] === "items" && path[2] === "answer") {
      return assignPath(patched, [path[0], path[1], "content"], nextValue);
    }

    return patched;
  };

  const serializeCanvasInlineEditors = (sourceBlocks = latestBlocksRef.current) => {
    if (typeof document === "undefined" || !Array.isArray(sourceBlocks)) return sourceBlocks;

    const nodes = Array.from(document.querySelectorAll('[data-builder-canvas="true"] [data-canvas-block-index] [data-website-inline-editor="true"][data-text-prop]'));
    if (!nodes.length) return sourceBlocks;

    const updated = [...sourceBlocks];

    nodes.forEach((node) => {
      const blockRoot = node.closest?.("[data-canvas-block-index]");
      const blockIndex = Number(blockRoot?.getAttribute?.("data-canvas-block-index"));
      const propPath = node.getAttribute?.("data-text-prop");

      if (!Number.isInteger(blockIndex) || !propPath || !updated[blockIndex]) return;

      updated[blockIndex] = {
        ...updated[blockIndex],
        props: applyInlinePropPatch(updated[blockIndex]?.props || {}, propPath, stripEditorArtifacts(node.innerHTML)),
      };
    });

    latestBlocksRef.current = updated;
    setBlocks(updated);
    return updated;
  };

  const syncActiveEditableToBlock = (sourceBlocks = blocks) => {
    const editable = activeEditableRef.current;
    if (!editable || typeof selectedIndex !== "number" || !Array.isArray(sourceBlocks) || !sourceBlocks[selectedIndex]) {
      return sourceBlocks;
    }

    const nextHtml = stripEditorArtifacts(editable.innerHTML);
    const updated = [...sourceBlocks];
    const currentBlock = updated[selectedIndex];
    const computed = typeof window !== "undefined" ? window.getComputedStyle(editable) : null;
    const fontSize = Math.max(12, Math.round(parseFloat(computed?.fontSize || "18") || 18));
    const fontFamily = String(computed?.fontFamily || "Arial").split(",")[0].replace(/["']/g, "").trim() || "Arial";
    const fontWeight = String(computed?.fontWeight || "400");
    const textColor = rgbToHex(computed?.color, "#111827");
    const textAlign = String(computed?.textAlign || "left");
    const backgroundTarget = getEditableBackgroundTarget(editable) || editable;
    const backgroundComputed = typeof window !== "undefined" ? window.getComputedStyle(backgroundTarget) : null;
    const boxBackgroundColor = normalizeToolbarBackgroundColor(backgroundComputed?.backgroundColor);
    const boxBackgroundImage = parseBackgroundImageUrl(backgroundComputed?.backgroundImage);

    if (editable.hasAttribute?.("data-layer-editor") && currentBlock?.type === BlockTypes.IMAGE_STACK) {
      const layerIndex = Number.isInteger(currentBlock?.props?.selectedLayerIndex)
        ? currentBlock.props.selectedLayerIndex
        : null;

      if (layerIndex == null || !Array.isArray(currentBlock?.props?.images)) {
        return sourceBlocks;
      }

      updated[selectedIndex] = {
        ...currentBlock,
        props: {
          ...(currentBlock.props || {}),
          images: currentBlock.props.images.map((layer, idx) => (
            idx === layerIndex
              ? {
                  ...layer,
                  content: nextHtml,
                  fontSize,
                  fontWeight,
                  textColor,
                  textAlign,
                  fontFamily,
                  background: boxBackgroundImage ? `url("${boxBackgroundImage}") center center / cover no-repeat` : boxBackgroundColor,
                  backgroundColor: boxBackgroundColor,
                  backgroundImage: boxBackgroundImage,
                  backgroundSize: boxBackgroundImage ? "cover" : (layer.backgroundSize || "cover"),
                  backgroundPosition: boxBackgroundImage ? "center center" : (layer.backgroundPosition || "center center"),
                  backgroundRepeat: boxBackgroundImage ? "no-repeat" : (layer.backgroundRepeat || "no-repeat"),
                }
              : layer
          )),
        },
      };
      setBlocks(updated);
      return updated;
    }

    const propName = editable.getAttribute?.("data-text-prop");
    if (!propName) return sourceBlocks;

    const nextProps = applyInlinePropPatch(currentBlock?.props || {}, propName, nextHtml);

    if (propName === "headline") {
      nextProps.headlineFontSize = fontSize;
      nextProps.headlineFontFamily = fontFamily;
      nextProps.headlineFontWeight = fontWeight;
      nextProps.headlineColor = textColor;
      nextProps.headlineAlignment = textAlign;
    } else if (propName === "subheadline") {
      nextProps.subheadlineFontSize = fontSize;
      nextProps.fontFamily = fontFamily;
      nextProps.fontWeight = fontWeight;
      nextProps.textColor = textColor;
      nextProps.alignment = textAlign;
    } else if (/^items\.\d+\.question$/.test(propName)) {
      nextProps.questionFontSize = fontSize;
      nextProps.fontFamily = fontFamily;
      nextProps.fontWeight = fontWeight;
      nextProps.questionColor = textColor;
      nextProps.alignment = textAlign;
    } else if (/^items\.\d+\.answer$/.test(propName)) {
      nextProps.answerFontSize = fontSize;
      nextProps.fontFamily = fontFamily;
      nextProps.fontWeight = fontWeight;
      nextProps.answerColor = textColor;
      nextProps.alignment = textAlign;
    } else {
      nextProps.textFontSize = fontSize;
      nextProps.fontFamily = fontFamily;
      nextProps.fontWeight = fontWeight;
      nextProps.textColor = textColor;
      nextProps.alignment = textAlign;
    }

    updated[selectedIndex] = {
      ...currentBlock,
      props: nextProps,
    };
    latestBlocksRef.current = updated;
    setBlocks(updated);
    return updated;
  };

  const commitPendingInlineEdits = async () => {
    if (typeof document === "undefined") return latestBlocksRef.current;
    const focusedEditable = findEditable(document.activeElement) || activeEditableRef.current;

    if (focusedEditable && typeof focusedEditable.blur === "function") {
      cleanupEditableMarkup();
      flushSync(() => {
        focusedEditable.blur();
      });

      if (typeof window !== "undefined") {
        await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
      }
    }

    const syncedActive = syncActiveEditableToBlock(latestBlocksRef.current);
    return serializeCanvasInlineEditors(syncedActive);
  };

  const handlePreviewPage = async () => {
    if (!project?.id) return;
    const committedBlocks = await commitPendingInlineEdits();
    const saved = await Promise.resolve(onSave?.(committedBlocks));
    if (!saved) {
      showSavePopup("Could not save before preview", "error");
      return;
    }
    const pageName = String(activePage || project?.pages?.[0]?.name || "Home");
    const pageSlug = pageName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "home";
    const previewUrl = `/modules/website-builder/project/${project.id}/preview?page=${encodeURIComponent(pageSlug)}`;
    const previewWindow = window.open(previewUrl, "_blank", "noopener,noreferrer");
    if (!previewWindow) {
      window.location.assign(previewUrl);
    }
  };

  const restoreSavedSelection = () => {
    if (typeof window === "undefined") return;
    const editable = activeEditableRef.current;
    const savedRange = selectionRangeRef.current;
    if (!editable || !savedRange) return;
    editable.focus();
    const selection = window.getSelection?.();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(savedRange);
  };

  const getActiveSelectionRange = () => {
    if (typeof window === "undefined") return null;
    restoreSavedSelection();
    const selection = window.getSelection?.();
    if (!selection?.rangeCount) return null;
    const range = selection.getRangeAt(0);
    const editable = activeEditableRef.current;
    if (!editable) return null;
    const commonNode = range.commonAncestorContainer?.nodeType === 3
      ? range.commonAncestorContainer.parentNode
      : range.commonAncestorContainer;
    if (commonNode && editable.contains(commonNode)) {
      return range;
    }
    return null;
  };

  const persistActiveEditableContent = () => {
    syncActiveEditableToBlock(latestBlocksRef.current);
  };

  const cleanupEditableMarkup = () => {
    const editable = activeEditableRef.current;
    if (!editable) return;
    const cleanedHtml = stripEditorArtifacts(editable.innerHTML);
    if (cleanedHtml !== editable.innerHTML) {
      editable.innerHTML = cleanedHtml;
    }
  };

  const applyStyleToActiveEditable = (stylePatch = {}) => {
    const editable = activeEditableRef.current;
    if (!editable) return false;
    const target = getEditableBackgroundTarget(editable) || editable;
    Object.entries(stylePatch).forEach(([key, val]) => {
      if (key === "background" || key === "backgroundColor" || key === "backgroundImage" || key === "backgroundSize" || key === "backgroundPosition" || key === "backgroundRepeat") {
        target.style[key] = val;
      } else {
        editable.style[key] = val;
      }
    });
    return true;
  };

  const applyTextBoxBackground = (patch = {}) => {
    const editable = activeEditableRef.current;
    if (!editable || !editable.hasAttribute?.("data-layer-editor")) return false;

    const target = getEditableBackgroundTarget(editable);
    if (!target) return false;

    const backgroundColor = patch.backgroundColor !== undefined
      ? String(patch.backgroundColor || "transparent")
      : (target.style.backgroundColor || "transparent");
    const backgroundImage = patch.backgroundImage !== undefined
      ? String(patch.backgroundImage || "")
      : parseBackgroundImageUrl(target.style.backgroundImage);

    target.style.backgroundColor = backgroundColor;
    target.style.backgroundImage = backgroundImage ? `url("${backgroundImage}")` : "none";
    target.style.backgroundSize = backgroundImage ? "cover" : "";
    target.style.backgroundPosition = backgroundImage ? "center center" : "";
    target.style.backgroundRepeat = backgroundImage ? "no-repeat" : "";

    syncActiveEditableToBlock(latestBlocksRef.current);
    preserveCurrentSelection();
    refreshToolbarFromEditable();
    return true;
  };

  const updateActiveTextLayer = (patch = {}) => {
    if (typeof selectedIndex !== "number") return false;
    const currentBlock = blocks[selectedIndex];
    if (!currentBlock || currentBlock.type !== BlockTypes.IMAGE_STACK) return false;

    const layerIndex = Number.isInteger(currentBlock?.props?.selectedLayerIndex)
      ? currentBlock.props.selectedLayerIndex
      : null;

    if (layerIndex == null || !Array.isArray(currentBlock?.props?.images)) return false;

    const nextImages = currentBlock.props.images.map((layer, idx) => (
      idx === layerIndex ? { ...layer, ...patch } : layer
    ));

    handleUpdateBlock(selectedIndex, {
      ...(currentBlock.props || {}),
      images: nextImages,
    });

    const editable = activeEditableRef.current;
    const target = getEditableBackgroundTarget(editable);
    if (target && patch.width !== undefined) {
      target.style.width = `${Math.max(120, Math.min(1800, Number(patch.width) || 360))}px`;
    }

    refreshToolbarFromEditable();
    return true;
  };

  const applyInlineStyleToSelection = (stylePatch = {}, options = {}) => {
    if (typeof document === "undefined" || typeof window === "undefined") return false;
    const editable = activeEditableRef.current;
    const range = getActiveSelectionRange();
    if (!editable || !range) return false;

    if (range.collapsed) {
      if (options.fallbackToEditable) {
        return applyStyleToActiveEditable(stylePatch);
      }
      return false;
    }

    const extracted = range.extractContents();
    const wrapper = document.createElement("span");
    Object.entries(stylePatch).forEach(([key, val]) => {
      wrapper.style[key] = val;
    });
    wrapper.appendChild(extracted);
    range.insertNode(wrapper);

    const selection = window.getSelection?.();
    const nextRange = document.createRange();
    nextRange.selectNodeContents(wrapper);
    selection?.removeAllRanges();
    selection?.addRange(nextRange);
    selectionRangeRef.current = nextRange.cloneRange();
    return true;
  };

  const refreshToolbarFromEditable = () => {
    if (typeof window === "undefined") return;
    const editable = activeEditableRef.current;
    if (!editable) return;
    const selection = window.getSelection?.();
    const styleSource = getSelectionStyleSource(editable, selection) || editable;
    const computed = window.getComputedStyle(styleSource);
    const backgroundTarget = getEditableBackgroundTarget(editable) || editable;
    const backgroundComputed = window.getComputedStyle(backgroundTarget);
    const tagName = String(editable.tagName || "P").toUpperCase();
    const fontFamilyRaw = String(computed.fontFamily || "Arial")
      .split(",")[0]
      .replace(/["']/g, "")
      .trim() || "Arial";
    const fontSizeValue = Math.max(12, Math.round(parseFloat(computed.fontSize || "18") || 18));
    const currentBlock = typeof selectedIndex === "number" ? blocks[selectedIndex] || null : null;
    const layerIndex = Number.isInteger(currentBlock?.props?.selectedLayerIndex) ? currentBlock.props.selectedLayerIndex : null;
    const activeLayer = layerIndex != null && Array.isArray(currentBlock?.props?.images) ? currentBlock.props.images[layerIndex] : null;
    const motionBinding = getTextAnimationBinding(currentBlock, editable);
    setTextToolbarState((prev) => ({
      ...prev,
      color: rgbToHex(computed.color, "#111827"),
      highlight: rgbToHex(computed.backgroundColor, "#ffffff"),
      fontFamily: fontFamilyRaw,
      fontSize: fontSizeValue,
      blockType: ["H1", "H2", "H3", "P"].includes(tagName) ? tagName : prev.blockType || "P",
      canStyleBox: editable.hasAttribute?.("data-layer-editor"),
      boxBackgroundColor: normalizeToolbarBackgroundColor(backgroundComputed.backgroundColor),
      boxBackgroundImage: parseBackgroundImageUrl(backgroundComputed.backgroundImage),
      boxWidth: Number(activeLayer?.width || prev.boxWidth || 360),
      textAnimation: motionBinding ? String(currentBlock?.props?.[motionBinding.animationKey] || "none") : prev.textAnimation || "none",
      textAnimationSpeed: motionBinding ? Number(currentBlock?.props?.[motionBinding.speedKey] || 0.8) : (prev.textAnimationSpeed || 0.8),
      textAnimationDelay: motionBinding ? Number(currentBlock?.props?.[motionBinding.delayKey] || 0) : (prev.textAnimationDelay || 0),
      motionLabel: motionBinding?.label || prev.motionLabel || "Text Motion",
    }));
  };

  const applyTextAnimationChange = (patch = {}) => {
    if (typeof selectedIndex !== "number" || !blocks[selectedIndex]) return;
    const editable = activeEditableRef.current;
    const binding = getTextAnimationBinding(blocks[selectedIndex], editable);
    if (!binding) return;

    const nextPatch = {};
    if (patch.animation !== undefined) nextPatch[binding.animationKey] = patch.animation;
    if (patch.speed !== undefined) nextPatch[binding.speedKey] = Number(patch.speed);
    if (patch.delay !== undefined) nextPatch[binding.delayKey] = Number(patch.delay);

    handleUpdateBlock(selectedIndex, {
      ...(blocks[selectedIndex]?.props || {}),
      ...nextPatch,
    });

    setTextToolbarState((prev) => ({
      ...prev,
      textAnimation: patch.animation !== undefined ? String(patch.animation) : prev.textAnimation,
      textAnimationSpeed: patch.speed !== undefined ? Number(patch.speed) : prev.textAnimationSpeed,
      textAnimationDelay: patch.delay !== undefined ? Number(patch.delay) : prev.textAnimationDelay,
      motionLabel: binding.label,
    }));
  };

  const runTextCommand = (command, value = null) => {
    const editable = activeEditableRef.current;
    if (!editable || typeof document === "undefined") return;

    restoreSavedSelection();
    editable.focus();

    try {
      document.execCommand("styleWithCSS", false, true);
    } catch {}

    const activeRange = getActiveSelectionRange();
    const hasTextSelection = !!activeRange && !activeRange.collapsed;
    let nextValue = value;

    const finishTextCommand = () => {
      cleanupEditableMarkup();
      persistActiveEditableContent();
      preserveCurrentSelection();
      refreshToolbarFromEditable();
    };

    if (command === "createLink") {
      nextValue = typeof window !== "undefined" ? window.prompt("Enter link URL", "https://") : "";
      if (!hasTextSelection) return;
      if (!nextValue) {
        try { document.execCommand("unlink", false, null); } catch {}
        finishTextCommand();
        return;
      }
    }

    if (command === "formatBlock") {
      const blockKey = String(nextValue || "P").toUpperCase();
      const stylePreset = BLOCK_TYPE_STYLE_PRESETS[blockKey] || BLOCK_TYPE_STYLE_PRESETS.P;
      applyStyleToActiveEditable(stylePreset);
      setTextToolbarState((prev) => ({
        ...prev,
        blockType: blockKey,
        fontSize: Number.parseInt(stylePreset.fontSize, 10) || prev.fontSize,
      }));
      finishTextCommand();
      return;
    }

    if (command === "fontSize") {
      applyInlineStyleToSelection({ fontSize: `${Number(nextValue || 18)}px` }, { fallbackToEditable: true });
      setTextToolbarState((prev) => ({ ...prev, fontSize: Number(nextValue || 18) }));
      finishTextCommand();
      return;
    }

    if (command === "fontName") {
      if (hasTextSelection) {
        try { document.execCommand("fontName", false, String(nextValue || "Arial")); } catch {}
      } else {
        applyStyleToActiveEditable({ fontFamily: String(nextValue || "Arial") });
      }
      setTextToolbarState((prev) => ({ ...prev, fontFamily: String(nextValue || "Arial") }));
      finishTextCommand();
      return;
    }

    if (command === "foreColor") {
      if (hasTextSelection) {
        try { document.execCommand("foreColor", false, String(nextValue || "#111827")); } catch {}
      } else {
        applyStyleToActiveEditable({ color: String(nextValue || "#111827") });
      }
      setTextToolbarState((prev) => ({ ...prev, color: String(nextValue || prev.color) }));
      finishTextCommand();
      return;
    }

    if (command === "hiliteColor") {
      if (hasTextSelection) {
        try { document.execCommand("hiliteColor", false, String(nextValue || "#ffffff")); } catch {}
      } else {
        applyStyleToActiveEditable({ backgroundColor: String(nextValue || "#ffffff") });
      }
      setTextToolbarState((prev) => ({ ...prev, highlight: String(nextValue || prev.highlight) }));
      finishTextCommand();
      return;
    }

    if (command === "bold") {
      if (hasTextSelection) {
        try { document.execCommand("bold", false, null); } catch {}
      } else {
        applyStyleToActiveEditable({ fontWeight: editable.style.fontWeight === "700" ? "400" : "700" });
      }
      finishTextCommand();
      return;
    }

    if (command === "italic") {
      if (hasTextSelection) {
        try { document.execCommand("italic", false, null); } catch {}
      } else {
        applyStyleToActiveEditable({ fontStyle: editable.style.fontStyle === "italic" ? "normal" : "italic" });
      }
      finishTextCommand();
      return;
    }

    if (command === "underline") {
      if (hasTextSelection) {
        try { document.execCommand("underline", false, null); } catch {}
      } else {
        applyStyleToActiveEditable({ textDecoration: editable.style.textDecoration === "underline" ? "none" : "underline" });
      }
      finishTextCommand();
      return;
    }

    if (command === "justifyLeft" || command === "justifyCenter" || command === "justifyRight") {
      const align = command === "justifyCenter" ? "center" : command === "justifyRight" ? "right" : "left";
      applyStyleToActiveEditable({ textAlign: align, display: "block" });
      finishTextCommand();
      return;
    }

    if (["insertUnorderedList", "insertOrderedList", "unlink", "removeFormat", "createLink"].includes(command)) {
      try {
        document.execCommand(command, false, nextValue);
      } catch {}
      finishTextCommand();
      return;
    }

    try {
      document.execCommand(command, false, nextValue);
    } catch {}

    finishTextCommand();
  };

  const handleTextBoxBackgroundColorChange = (value) => {
    applyTextBoxBackground({ backgroundColor: value, backgroundImage: "" });
  };

  const handleClearTextBoxBackground = () => {
    applyTextBoxBackground({ backgroundColor: "transparent", backgroundImage: "" });
  };

  const handleClearTextBoxBackgroundImage = () => {
    applyTextBoxBackground({ backgroundImage: "" });
  };

  const handleTextBoxWidthChange = (value) => {
    const nextWidth = Math.max(120, Math.min(1800, Number(value) || 360));
    updateActiveTextLayer({ width: nextWidth });
  };

  const handleTextBoxBackgroundImageUpload = async (file) => {
    if (!file || typeof selectedIndex !== "number") return;
    const asset = await Promise.resolve(onUploadImage?.(selectedIndex, "__text_layer_background__", file));
    if (!asset?.src) return;
    applyTextBoxBackground({ backgroundImage: asset.src, backgroundColor: "transparent" });
  };

  const startTextToolbarDrag = (event) => {
    event.preventDefault();
    textToolbarDraggedRef.current = true;
    const originX = textToolbarPosition.x;
    const originY = textToolbarPosition.y;
    const startX = event.clientX;
    const startY = event.clientY;

    const handleMove = (moveEvent) => {
      const viewportWidth = typeof window !== "undefined" ? (window.innerWidth || 1440) : 1440;
      const toolbarWidth = Math.max(280, Math.min(Number(textToolbarPosition.width) || 720, viewportWidth - 24));
      setTextToolbarPosition({
        x: Math.min(Math.max(12, originX + (moveEvent.clientX - startX)), Math.max(12, viewportWidth - toolbarWidth - 12)),
        y: Math.max(16, originY + (moveEvent.clientY - startY)),
        width: toolbarWidth,
      });
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const startAnimationPopoverDrag = (event) => {
    event.preventDefault();
    animationPopoverDraggedRef.current = true;
    const originX = animationPopover.x;
    const originY = animationPopover.y;
    const startX = event.clientX;
    const startY = event.clientY;

    const handleMove = (moveEvent) => {
      setAnimationPopover((prev) => ({
        ...prev,
        x: Math.max(12, Math.min(originX + (moveEvent.clientX - startX), (window.innerWidth || 1280) - (prev.width || 980) - 12)),
        y: Math.max(12, Math.min(originY + (moveEvent.clientY - startY), (window.innerHeight || 900) - 220)),
      }));
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const triggerAnimationReplay = (index) => {
    if (!Number.isInteger(index) || !blocks[index]) return;
    setAnimationReplayState((prev) => ({ index, tick: prev.tick + 1 }));
  };

  const showSavePopup = (message, tone = "success") => {
    if (saveNoticeTimerRef.current) clearTimeout(saveNoticeTimerRef.current);
    setSaveNotice({ message, tone });
    saveNoticeTimerRef.current = setTimeout(() => setSaveNotice(null), 2400);
  };

  const preserveCurrentSelection = () => {
    if (typeof window === "undefined") return;
    const selection = window.getSelection?.();
    const editable = activeEditableRef.current;
    if (!selection?.rangeCount || !editable) return;
    const range = selection.getRangeAt(0);
    const commonNode = range.commonAncestorContainer?.nodeType === 3
      ? range.commonAncestorContainer.parentNode
      : range.commonAncestorContainer;
    if (commonNode && editable.contains(commonNode)) {
      selectionRangeRef.current = range.cloneRange();
    }
  };

  const handleSave = async () => {
    showSavePopup("Saving page...", "info");
    try {
      const committedBlocks = await commitPendingInlineEdits();
      const saved = await Promise.resolve(onSave?.(committedBlocks));
      if (!saved) {
        showSavePopup("Could not save page", "error");
        return;
      }
      showSavePopup("Page saved successfully");
    } catch {
      showSavePopup("Could not save page", "error");
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        ${websiteBlockKeyframes()}
      `}</style>
      {showHeader ? (
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>🛠️ Website Page Builder</h2>
          <div style={styles.headerActions}>
            <button
              type="button"
              style={{ ...styles.panelToggleBtn, ...(showLibrary ? styles.panelToggleBtnActive : {}) }}
              onClick={() => setShowLibrary((v) => !v)}
            >
              {showLibrary ? "Hide Widgets" : "Show Widgets"}
            </button>
            <button
              type="button"
              style={{ ...styles.panelToggleBtn, ...(showProperties ? styles.panelToggleBtnActive : {}) }}
              onClick={() => setShowProperties((v) => !v)}
            >
              {showProperties ? "Hide Sidebar" : "Show Sidebar"}
            </button>
            <button
              type="button"
              style={{ ...styles.panelToggleBtn, ...(rightPanelMode === "global" ? styles.panelToggleBtnActive : {}) }}
              onClick={() => {
                setShowProperties(true);
                setRightPanelMode((value) => value === "global" ? "block" : "global");
              }}
            >
              {rightPanelMode === "global" ? "Block Editor" : "Global Styles"}
            </button>
            <button
              type="button"
              style={{ ...styles.panelToggleBtn, ...(rightPanelMode === "sections" ? styles.panelToggleBtnActive : {}) }}
              onClick={() => {
                setShowProperties(true);
                setRightPanelMode((value) => value === "sections" ? "block" : "sections");
              }}
            >
              {rightPanelMode === "sections" ? "Block Editor" : "Page Sections"}
            </button>
            <button
              type="button"
              style={{ ...styles.panelToggleBtn, ...(showCanvasGrid ? styles.panelToggleBtnActive : {}) }}
              onClick={() => setShowCanvasGrid((value) => !value)}
            >
              {showCanvasGrid ? "Grid On" : "Grid Off"}
            </button>
            <button
              type="button"
              style={styles.panelToggleBtn}
              onClick={() => insertPresetBlock(BlockTypes.IMAGE_STACK, {
                title: "Free Layout Image Canvas",
                minHeight: "72vh",
                backgroundColor: "transparent",
                showGrid: true,
                snapToGrid: true,
                images: [createImageStackLayer(0), createTextStackLayer(0), createImageStackLayer(1)],
              })}
            >
              + Image Stack
            </button>
            {[
              { id: "desktop", label: "Desktop" },
              { id: "tablet", label: "Tablet" },
              { id: "mobile", label: "Mobile" },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                style={{ ...styles.panelToggleBtn, ...(previewMode === mode.id ? styles.panelToggleBtnActive : {}) }}
                onClick={() => setPreviewMode(mode.id)}
              >
                {mode.label}
              </button>
            ))}
            {selectedBlock && [BlockTypes.HERO, BlockTypes.TEXT].includes(selectedBlock.type) ? (
              <button
                type="button"
                style={{ ...styles.panelToggleBtn, ...(selectedBlock?.props?.fullWidthBackground ? styles.panelToggleBtnActive : {}) }}
                onClick={() => toggleSelectedProp("fullWidthBackground")}
              >
                {selectedBlock?.props?.fullWidthBackground ? "Full Width On" : "Full Width Off"}
              </button>
            ) : null}
            <div style={styles.primaryActionGroup}>
              {project?.id ? (
                <button type="button" style={styles.previewBtn} onClick={handlePreviewPage}>
                  👁 Preview Page
                </button>
              ) : null}
              <button style={styles.saveBtn} onClick={handleSave}>
                💾 Save Page
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {saveNotice ? (
        <div style={{
          position: "fixed",
          top: 18,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 120,
          padding: "10px 14px",
          borderRadius: 12,
          background: saveNotice.tone === "error"
            ? "#7f1d1d"
            : saveNotice.tone === "info"
              ? "#0c4a6e"
              : "#052e16",
          color: "#ffffff",
          border: `1px solid ${saveNotice.tone === "error" ? "#ef4444" : saveNotice.tone === "info" ? "#38bdf8" : "#22c55e"}`,
          boxShadow: "0 14px 28px rgba(15,23,42,0.28)",
          fontSize: 13,
          fontWeight: 800,
        }}>
          {saveNotice.message}
        </div>
      ) : null}

      <TextEditingToolbar
        visible={showTextToolbar}
        textColor={textToolbarState.color}
        highlightColor={textToolbarState.highlight}
        fontFamily={textToolbarState.fontFamily}
        fontSize={textToolbarState.fontSize}
        blockType={textToolbarState.blockType}
        canStyleBox={textToolbarState.canStyleBox}
        boxBackgroundColor={textToolbarState.boxBackgroundColor}
        boxBackgroundImage={textToolbarState.boxBackgroundImage}
        boxWidth={textToolbarState.boxWidth}
        onClearBoxBackground={handleClearTextBoxBackground}
        onBoxBackgroundColor={handleTextBoxBackgroundColorChange}
        onBoxBackgroundImageUpload={handleTextBoxBackgroundImageUpload}
        onClearBoxBackgroundImage={handleClearTextBoxBackgroundImage}
        onBoxWidthChange={handleTextBoxWidthChange}
        onCommand={runTextCommand}
        onTextColor={(value) => runTextCommand("foreColor", value)}
        onHighlightColor={(value) => runTextCommand("hiliteColor", value)}
        onFontSize={(value) => runTextCommand("fontSize", value)}
        onBlockType={(value) => runTextCommand("formatBlock", value)}
        onFontFamily={(value) => runTextCommand("fontName", value)}
        onOpenAnimations={(triggerNode) => {
          if (typeof selectedIndex !== "number") return;
          openAnimationPanelForBlock(selectedIndex, triggerNode);
        }}
        position={textToolbarPosition}
        onDragStart={startTextToolbarDrag}
        onPreserveSelection={preserveCurrentSelection}
        onClose={() => {
          textToolbarDraggedRef.current = false;
          setShowTextToolbar(false);
        }}
      />

      <BlockAnimationPopover
        visible={animationPopover.visible}
        block={Number.isInteger(animationPopover.index) ? blocks[animationPopover.index] || null : null}
        position={animationPopover}
        onClose={() => setAnimationPopover((prev) => ({ ...prev, visible: false }))}
        onDragStart={startAnimationPopoverDrag}
        onPreview={() => triggerAnimationReplay(animationPopover.index)}
        onApply={(patch) => {
          if (!Number.isInteger(animationPopover.index) || !blocks[animationPopover.index]) return;
          handleUpdateBlock(animationPopover.index, {
            ...(blocks[animationPopover.index]?.props || {}),
            ...patch,
          });
        }}
      />

      {imageEditState ? (
        <ImageEditModal
          src={imageEditState.src}
          userId={imageEditorUserId}
          onDone={applyEditedStructuredImage}
          onCancel={() => setImageEditState(null)}
        />
      ) : null}

      <div
        style={{
          ...styles.workspace,
          ...(isNarrowLayout ? styles.workspaceNarrow : {}),
          gridTemplateColumns: workspaceColumns,
        }}
      >
        {showLibrary ? <BlockLibraryPanel onDragStart={handleDragStart} /> : null}

        <div
          data-builder-canvas="true"
          style={{
            ...styles.canvas,
            ...(showCanvasGrid ? styles.canvasGridBg : {}),
          }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget)) return;
            setDropIndex(null);
          }}
        >
          <div style={styles.canvasLabel}>Drag widgets here • {previewMode}</div>
          <div style={{ ...styles.blocksList, width: previewWidth, maxWidth: "100%", margin: "0 auto" }}>
            {project?.globalNavBlock ? (
              <GlobalBlockPreview
                label="🌐 Global Navigation"
                role="nav"
                block={project.globalNavBlock}
                brandAssets={brandAssets}
                compact={previewMode === "mobile"}
                selected={selectedGlobalRole === "nav"}
                onSelect={() => selectGlobalBlock("nav")}
                onChange={(nextBlock) => onUpdateGlobalBlock?.("nav", nextBlock)}
                onSaveAsGlobal={onSaveAsGlobal}
              />
            ) : null}
            {canvasBlockEntries.length === 0 ? (
              <div style={styles.emptyState}>
                📭 No widgets yet. Drag one in from the widgets panel to start building!
              </div>
            ) : (
              <>
                {canvasBlockEntries.map(({ block, index: blockIndex }, idx) => (
                  <React.Fragment key={block.id || `${block.type}-${blockIndex}`}>
                    <DropInsertZone
                      active={dropIndex === blockIndex}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                        if (dropIndex !== blockIndex) setDropIndex(blockIndex);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleInsertAt(blockIndex, e.dataTransfer);
                        setDropIndex(null);
                      }}
                    />
                    <CanvasBlock
                      block={block}
                      index={blockIndex}
                      brandAssets={brandAssets}
                      compactPreview={previewMode === "mobile"}
                      animationReplayToken={animationReplayState.index === blockIndex ? animationReplayState.tick : 0}
                      selected={selectedIndex === blockIndex}
                      hovered={hoveredIndex === blockIndex}
                      onSelect={selectCanvasBlock}
                      onHover={(value) => setHoveredIndex(value)}
                      onDelete={handleDelete}
                      onDuplicate={handleDuplicate}
                      onMoveStep={moveBlockByStep}
                      onMoveToTop={moveBlockToTop}
                      onEdit={openTextEditorForBlock}
                      onAnimate={openAnimationPanelForBlock}
                      onChange={handleUpdateBlock}
                      onResizeHeight={handleResizeBlockHeight}
                      onUploadImage={handleCanvasImageUpload}
                      onUploadLayerImage={handleLayerImageUpload}
                      onBlockDragOver={handleBlockDragOver}
                      onBlockDrop={handleBlockDrop}
                      onSaveAsGlobal={onSaveAsGlobal}
                    />
                  </React.Fragment>
                ))}
                <DropInsertZone
                  active={dropIndex === blocks.length}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    if (dropIndex !== blocks.length) setDropIndex(blocks.length);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleInsertAt(blocks.length, e.dataTransfer);
                    setDropIndex(null);
                  }}
                />
                {project?.globalFooterBlock ? (
                  <GlobalBlockPreview
                    label="🌐 Global Footer"
                    role="footer"
                    block={project.globalFooterBlock}
                    brandAssets={brandAssets}
                    compact={previewMode === "mobile"}
                    selected={selectedGlobalRole === "footer"}
                    onSelect={() => selectGlobalBlock("footer")}
                    onChange={(nextBlock) => onUpdateGlobalBlock?.("footer", nextBlock)}
                    onSaveAsGlobal={onSaveAsGlobal}
                  />
                ) : null}
                <div style={styles.canvasEndSpacer} aria-hidden="true" />
              </>
            )}
          </div>
        </div>

        {showProperties ? (
          rightPanelMode === "global" ? (
            <GlobalStylePanel blocks={blocks} onApplyGlobal={applyGlobalStyles} />
          ) : rightPanelMode === "sections" ? (
            <PageSectionsPanel blocks={blocks} selectedIndex={selectedIndex} onSelect={selectCanvasBlock} onMove={moveBlockByStep} />
          ) : (
            <PropertiesPanel
              block={selectedGlobalBlock || blocks[selectedIndex] || null}
              index={selectedGlobalBlock ? -1 : selectedIndex}
              onChange={selectedGlobalBlock
                ? (_index, nextProps) => {
                    if (!selectedGlobalRole || !selectedGlobalBlock) return;
                    onUpdateGlobalBlock?.(selectedGlobalRole, {
                      ...selectedGlobalBlock,
                      props: nextProps,
                    });
                  }
                : handleUpdateBlock}
              brandAssets={brandAssets}
              onUploadImage={selectedGlobalBlock
                ? (_index, key, file) => handleGlobalImageUpload(selectedGlobalRole, key, file)
                : handleCanvasImageUpload}
              onSelectAsset={selectedGlobalBlock
                ? (_index, key, asset) => handleGlobalAssetSelect(selectedGlobalRole, key, asset)
                : handleCanvasAssetSelect}
              onOpenImageEditor={openStructuredImageEditor}
              onOpenSimpleImageEditor={openSimpleImageEditor}
              project={project}
              activePage={activePage}
              currentObjective={currentObjective}
            />
          )
        ) : null}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
    gap: 12,
    minHeight: 0,
    minWidth: 0,
    height: "100%",
    background: "#0c121a",
    color: "#e6eef5",
    fontFamily: "system-ui, -apple-system, sans-serif",
    overflow: "hidden",
  },
  keyframesNote: {},
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    background: "linear-gradient(135deg,#153052,#10243e)",
    borderBottom: "1px solid #2c3f62",
  },
  headerTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 600,
  },
  primaryActionGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginLeft: 6,
  },
  previewBtn: {
    background: "linear-gradient(135deg,#8b5cf6,#3b82f6)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(59,130,246,0.28)",
  },
  saveBtn: {
    background: "#86efac",
    color: "#04202e",
    border: "none",
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  headerActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  textToolbar: {
    position: "fixed",
    zIndex: 80,
    width: "min(calc(100vw - 24px), 1120px)",
    background: "linear-gradient(180deg, #eff7ff 0%, #d9ecff 100%)",
    border: "1px solid rgba(96,165,250,0.4)",
    borderRadius: 16,
    boxShadow: "0 18px 44px rgba(15,23,42,0.18)",
    overflow: "hidden",
  },
  textToolbarHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    background: "rgba(239,247,255,0.96)",
    borderBottom: "1px solid rgba(96,165,250,0.28)",
  },
  textToolbarTitle: {
    color: "#16324f",
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
  },
  textToolbarDoneBtn: {
    background: "#12385d",
    border: "1px solid rgba(17,24,39,0.14)",
    color: "#ffffff",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 10px 24px rgba(18,56,93,0.18)",
  },
  textToolbarSubtitle: {
    color: "#33536f",
    fontSize: 15,
    fontWeight: 500,
    cursor: "move",
    userSelect: "none",
  },
  toolbarDragGlyph: {
    color: "#4d78a5",
    fontSize: 16,
    letterSpacing: "0.08em",
    cursor: "move",
    userSelect: "none",
  },
  textToolbarBody: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    color: "#0f2f4d",
    borderRadius: 8,
    padding: "14px 16px 16px",
    fontSize: 16,
    fontWeight: 500,
  },
  textToolbarBtn: {
    background: "#ffffff",
    border: "1px solid rgba(96,165,250,0.34)",
    color: "#16324f",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    minHeight: 44,
    whiteSpace: "nowrap",
  },
  textToolbarActionChip: {
    background: "#ffffff",
    border: "1px solid rgba(37,99,235,0.44)",
    color: "#0f2f4d",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    minHeight: 42,
    textAlign: "center",
    boxShadow: "0 2px 0 rgba(37,99,235,0.08)",
  },
  textToolbarMiniActionChip: {
    background: "#ffffff",
    border: "1px solid rgba(37,99,235,0.44)",
    color: "#0f2f4d",
    borderRadius: 10,
    padding: "9px 12px",
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    minHeight: 38,
    minWidth: 70,
    textAlign: "center",
    boxShadow: "0 2px 0 rgba(37,99,235,0.08)",
  },
  textToolbarIconBtn: {
    background: "#ffffff",
    border: "1px solid rgba(37,99,235,0.44)",
    color: "#0f2f4d",
    borderRadius: 10,
    width: 44,
    height: 44,
    padding: 0,
    fontSize: 18,
    fontWeight: 500,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    boxShadow: "0 2px 0 rgba(37,99,235,0.08)",
  },
  textToolbarChip: {
    background: "#fffdf5",
    border: "1px solid rgba(185,121,6,0.28)",
    color: "#5b4100",
    borderRadius: 10,
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "center",
  },
  textToolbarSizeChip: {
    background: "#fffdf5",
    border: "1px solid rgba(185,121,6,0.28)",
    color: "#5b4100",
    borderRadius: 10,
    padding: "8px 0",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    minWidth: 0,
  },
  textToolbarChipActive: {
    background: "#f59e0b",
    color: "#111827",
    borderColor: "#b87906",
    boxShadow: "0 8px 16px rgba(245,158,11,0.24)",
  },
  textToolbarSelect: {
    background: "#ffffff",
    border: "1px solid rgba(37,99,235,0.44)",
    color: "#0f2f4d",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 16,
    fontWeight: 500,
    minHeight: 44,
  },
  textToolbarInlineGroup: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  textToolbarFormattingGroup: {
    alignItems: "flex-start",
  },
  textToolbarButtonRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  textToolbarInlineDivider: {
    width: 1,
    alignSelf: "stretch",
    minHeight: 54,
    background: "rgba(71,104,135,0.18)",
    flex: "0 0 auto",
  },
  textToolbarSelectStack: {
    display: "grid",
    gap: 6,
  },
  textToolbarChipGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(48px, 1fr))",
    gap: 6,
  },
  textToolbarActionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(72px, 1fr))",
    gap: 6,
  },
  textToolbarSizeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(48px, 1fr))",
    gap: 6,
  },
  textToolbarDivider: {
    width: 1,
    height: 28,
    background: "rgba(121,85,0,0.22)",
    flex: "0 0 auto",
  },
  textToolbarColorStack: {
    display: "grid",
    gap: 6,
    flex: "0 0 auto",
  },
  textToolbarColorGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  textToolbarSwatchesInline: {
    display: "grid",
    gridTemplateColumns: "repeat(9, 22px)",
    gap: 6,
    alignItems: "center",
  },
  textToolbarLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#173a5d",
    fontSize: 16,
    fontWeight: 500,
    flex: "0 0 auto",
  },
  textToolbarLabelSpaced: {
    marginLeft: 10,
  },
  textToolbarColorGroupWrap: {
    gap: 14,
  },
  textToolbarColor: {
    width: 38,
    height: 38,
    padding: 2,
    borderRadius: 8,
    border: "1px solid rgba(96,165,250,0.34)",
    background: "#ffffff",
    cursor: "pointer",
  },
  textToolbarSwatches: {
    width: 22,
    height: 22,
    gap: 4,
    alignItems: "center",
  },
  textToolbarSwatch: {
    width: 22,
    height: 22,
    borderRadius: 6,
    border: "1px solid rgba(71,104,135,0.28)",
    cursor: "pointer",
    padding: 0,
  },
  tabRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  tabChip: {
    background: "#102036",
    border: "1px solid #2b3650",
    color: "#cde5ff",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  tabChipActive: {
    background: "#7df9a1",
    borderColor: "#7df9a1",
    color: "#04202e",
  },
  panelToggleBtn: {
    background: "#18314f",
    border: "1px solid #40628d",
    color: "#eff6ff",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.2,
    cursor: "pointer",
  },
  panelToggleBtnActive: {
    background: "#27507f",
    borderColor: "#7dd3fc",
    color: "#ffffff",
  },
  workspace: {
    display: "grid",
    gridTemplateColumns: "248px minmax(0, 1.85fr) minmax(332px, 360px)",
    gap: 12,
    padding: 8,
    overflow: "hidden",
    minWidth: 0,
    minHeight: 0,
    height: "100%",
    alignItems: "stretch",
    justifyContent: "stretch",
  },
  workspaceNarrow: {
    gridTemplateColumns: "1fr",
  },
  library: {
    background: "#111827",
    border: "1px solid #1e2d45",
    borderRadius: 12,
    padding: 12,
    overflowY: "auto",
    maxHeight: "none",
    height: "100%",
    minHeight: 0,
    minWidth: 248,
    width: 248,
  },
  libraryTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
    color: "#7dd3fc",
  },
  librarySubtitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: "#bfd4ea",
    marginBottom: 12,
  },
  categoryList: {
    display: "grid",
    gap: 10,
  },
  categoryGroup: {
    display: "grid",
    gap: 6,
  },
  categoryTitle: {
    margin: 0,
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  widgetFilterRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  widgetFilterChip: {
    background: "#1b3354",
    border: "1px solid #4c6f9d",
    color: "#f8fbff",
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.15,
    cursor: "pointer",
  },
  widgetFilterChipActive: {
    background: "#86efac",
    borderColor: "#86efac",
    color: "#04202e",
  },
  blocksList: {
    display: "grid",
    gap: 6,
  },
  blockCard: {
    background: "#1e2d3d",
    border: "1px solid #2b3650",
    borderRadius: 8,
    padding: 10,
    cursor: "grab",
    display: "grid",
    gap: 4,
    gridTemplateColumns: "30px 1fr",
    alignItems: "center",
    fontSize: 16,
    transition: "all 0.2s",
  },
  blockIcon: {
    fontSize: 22,
    textAlign: "center",
  },
  blockName: {
    fontSize: 16,
    fontWeight: 500,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  canvas: {
    background: "#0d1422",
    border: "2px dashed #2c3f62",
    borderRadius: 12,
    padding: "18px 18px 84px",
    overflowX: "hidden",
    overflowY: "auto",
    position: "relative",
    minWidth: 0,
    width: "100%",
    minHeight: 0,
    height: "100%",
  },
  canvasGridBg: {
    backgroundImage: "linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)",
    backgroundSize: "24px 24px",
  },
  canvasLabel: {
    position: "absolute",
    top: 20,
    left: 20,
    fontSize: 11,
    color: "#64748b",
    pointerEvents: "none",
  },
  blocksList: {
    display: "grid",
    gap: 12,
    marginTop: 20,
  },
  emptyState: {
    textAlign: "center",
    padding: 40,
    color: "#64748b",
    fontSize: 14,
  },
  canvasEndSpacer: {
    height: "42vh",
    minHeight: 280,
    pointerEvents: "none",
  },
  globalBlockBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#0c1e38",
    border: "1px solid #2563eb",
    borderRadius: 8,
    color: "#7dd3fc",
    fontSize: 12,
    fontWeight: 600,
    padding: "7px 14px",
    margin: "6px 0",
    userSelect: "none",
    pointerEvents: "none",
  },
  globalBlockPreviewWrap: {
    display: "grid",
    gap: 10,
    margin: "6px 0 10px",
    cursor: "pointer",
  },
  globalBlockPreviewWrapSelected: {
    borderRadius: 20,
    boxShadow: "0 0 0 2px rgba(14,165,233,0.38)",
  },
  globalBlockPreviewSurface: {
    borderRadius: 18,
    overflow: "visible",
    border: "1px solid rgba(148,163,184,0.22)",
    background: "#ffffff",
    boxShadow: "0 16px 34px rgba(15,23,42,0.08)",
  },
  globalBlockBannerHint: {
    marginLeft: "auto",
    fontSize: 11,
    opacity: 0.55,
    fontWeight: 400,
    fontStyle: "normal",
  },
  canvasBlock: {
    background: "linear-gradient(180deg,#f8fbff,#eef4fb)",
    border: "1px solid #c9d7ea",
    borderRadius: 16,
    padding: 12,
    cursor: "default",
    transition: "all 0.2s",
    minWidth: 0,
    position: "relative",
    boxShadow: "0 14px 28px rgba(15,23,42,0.08)",
  },
  canvasStickyNavBlock: {
    position: "sticky",
    top: 0,
    zIndex: 14,
  },
  blockActionBar: {
    position: "absolute",
    left: 14,
    top: 14,
    zIndex: 5,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    width: "calc(100% - 28px)",
    pointerEvents: "auto",
  },
  blockActionLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  blockActionLabel: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 32,
    padding: "6px 12px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.86)",
    border: "1px solid rgba(148,163,184,0.28)",
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    backdropFilter: "blur(10px)",
  },
  blockActionButtons: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  blockActionBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
    padding: "6px 12px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(148,163,184,0.32)",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(15,23,42,0.18)",
  },
  blockActionBtnIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 10,
    background: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(148,163,184,0.32)",
    color: "#0f172a",
    fontSize: 13,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(15,23,42,0.18)",
  },
  blockActionBtnDanger: {
    color: "#991b1b",
  },
  blockPreviewShell: {
    position: "relative",
  },
  blockInfoPill: {
    position: "absolute",
    right: 14,
    bottom: 14,
    zIndex: 4,
    width: 36,
    height: 36,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(15,23,42,0.76)",
    border: "1px solid rgba(148,163,184,0.28)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.18)",
    backdropFilter: "blur(10px)",
    pointerEvents: "none",
  },
  sectionResizeHandle: {
    position: "absolute",
    left: "50%",
    bottom: -18,
    transform: "translateX(-50%)",
    zIndex: 6,
    borderRadius: 999,
    border: "1px solid rgba(37,99,235,0.42)",
    background: "linear-gradient(135deg, #ffffff, #dbeafe)",
    color: "#0f3f73",
    boxShadow: "0 14px 30px rgba(15,23,42,0.24)",
    padding: "10px 18px",
    minWidth: 124,
    minHeight: 40,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    cursor: "ns-resize",
    touchAction: "none",
  },
  dragHandle: {
    background: "#0f172a",
    border: "1px solid #2b3650",
    color: "#9fb0c5",
    borderRadius: 6,
    width: 24,
    height: 24,
    fontSize: 12,
    lineHeight: 1,
    cursor: "grab",
    display: "inline-grid",
    placeItems: "center",
    padding: 0,
    marginRight: 2,
  },
  canvasBlockSelected: {
    border: "2px solid #0ea5e9",
    background: "linear-gradient(180deg,#ffffff,#f0f9ff)",
    boxShadow: "0 0 0 4px rgba(14,165,233,0.12), 0 18px 34px rgba(15,23,42,0.12)",
  },
  blockHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottom: "1px solid #1e2d45",
  },
  blockInfo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 16,
  },
  blockType: {
    fontSize: 16,
    fontWeight: 600,
    color: "#dbeafe",
  },
  blockControls: {
    display: "flex",
    gap: 4,
  },
  miniBtn: {
    background: "none",
    border: "none",
    fontSize: 14,
    cursor: "pointer",
    padding: 4,
    opacity: 0.7,
    transition: "opacity 0.2s",
  },
  blockPreview: {
    fontSize: 16,
    color: "#9fb0c5",
    minHeight: 40,
    minWidth: 0,
    maxWidth: "100%",
    overflowX: "auto",
    paddingTop: 42,
  },
  blockPreviewStickyNav: {
    paddingTop: 0,
    overflowX: "visible",
  },
  animationPopover: {
    position: "fixed",
    zIndex: 82,
    width: 980,
    maxWidth: "calc(100vw - 24px)",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    border: "1px solid rgba(148,163,184,0.32)",
    borderRadius: 16,
    boxShadow: "0 24px 48px rgba(15,23,42,0.22)",
    overflow: "hidden",
  },
  animationPopoverHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 14px",
    borderBottom: "1px solid rgba(148,163,184,0.18)",
    background: "linear-gradient(135deg, #eff6ff, #f8fafc)",
  },
  animationPopoverHeaderMain: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  animationPopoverActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: "0 0 auto",
  },
  animationPopoverTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 600,
  },
  animationPopoverSubtitle: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  animationPreviewBtn: {
    background: "linear-gradient(135deg, #38bdf8, #2563eb)",
    border: "1px solid rgba(59,130,246,0.3)",
    color: "#ffffff",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  animationPopoverBody: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
    padding: 14,
    alignItems: "start",
    overflow: "visible",
  },
  animationFieldset: {
    display: "grid",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid rgba(148,163,184,0.22)",
  },
  animationPresetGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(108px, 1fr))",
    gap: 8,
  },
  animationPresetChip: {
    background: "#183b5b",
    border: "1px solid rgba(15,23,42,0.16)",
    color: "#f8fbff",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
  },
  animationPresetChipActive: {
    background: "linear-gradient(135deg,#f59e0b,#f97316)",
    borderColor: "rgba(251,191,36,0.6)",
    color: "#111827",
    boxShadow: "0 10px 24px rgba(249,115,22,0.28)",
  },
  animationOptionsGrid: {
    display: "grid",
    gap: 10,
  },
  animationOptionGroup: {
    display: "grid",
    gap: 6,
  },
  animationMiniLabel: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#244868",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  animationChipRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(76px, 1fr))",
    gap: 8,
  },
  animationValueChip: {
    background: "#224a6f",
    border: "1px solid rgba(15,23,42,0.16)",
    color: "#f8fbff",
    borderRadius: 10,
    padding: "9px 10px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
  },
  animationValueChipActive: {
    background: "rgba(59,130,246,0.12)",
    borderColor: "rgba(59,130,246,0.42)",
    color: "#0f172a",
  },
  dropZone: {
    height: 14,
    display: "grid",
    alignItems: "center",
  },
  dropZoneActive: {
    height: 20,
  },
  dropLine: {
    height: 2,
    borderRadius: 99,
    background: "rgba(45,108,223,0.25)",
    transition: "all 0.15s ease",
  },
  dropLineActive: {
    height: 4,
    background: "#22c55e",
    boxShadow: "0 0 0 2px rgba(34,197,94,0.2)",
  },
  properties: {
    background: "#111827",
    border: "1px solid #1e2d45",
    borderRadius: 12,
    padding: 16,
    overflowY: "auto",
    overflowX: "hidden",
    maxHeight: "none",
    height: "100%",
    minHeight: 0,
    minWidth: 0,
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
  },
  propertiesTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 12,
    color: "#7dd3fc",
  },
  noSelection: {
    margin: 0,
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    padding: 20,
  },
  propertyGrid: {
    display: "grid",
    gap: 10,
  },
  sectionCard: {
    display: "grid",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    background: "#0d1522",
    border: "1px solid #1e2d45",
  },
  propertyField: {
    display: "grid",
    gap: 4,
  },
  numberField: {
    display: "grid",
    gap: 6,
  },
  stackSm: {
    display: "grid",
    gap: 8,
  },
  inlineToggle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 16,
    color: "#dbeafe",
    minHeight: 24,
  },
  propertyLabel: {
    fontSize: 16,
    fontWeight: 600,
    textTransform: "uppercase",
    color: "#9db3c2",
    letterSpacing: 0.5,
  },
  presetGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  },
  inlineChipRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 6,
  },
  presetChip: {
    background: "#152238",
    border: "1px solid #2b3650",
    color: "#dbeafe",
    borderRadius: 10,
    padding: "9px 10px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    minHeight: 24,
  },
  presetChipActive: {
    background: "#173459",
    borderColor: "#2d6cdf",
    color: "#ffffff",
  },
  propertyInput: {
    background: "#0d1522",
    border: "1px solid #2b3650",
    color: "#e6eef5",
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    minHeight: 24,
    fontFamily: "inherit",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  },
  formatBtn: {
    background: "#1e2d3d",
    border: "1px solid #2b3650",
    color: "#e6eef5",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  linkRowCard: {
    display: "grid",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    border: "1px solid #2b3650",
    background: "#111827",
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
  },
  linkRowHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  linkActions: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    minWidth: 0,
  },
  linkMoveBtn: {
    background: "#173459",
    border: "1px solid #2d6cdf",
    color: "#dbeafe",
    borderRadius: 8,
    minWidth: 28,
    minHeight: 24,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  linkRowTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#dbeafe",
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  subLinkList: {
    display: "grid",
    gap: 8,
  },
  subLinkCard: {
    display: "grid",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    border: "1px solid #24334d",
    background: "#0d1522",
  },
  subLinkTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#93c5fd",
  },
  linkRowDelete: {
    background: "transparent",
    border: "1px solid #7f1d1d",
    color: "#fca5a5",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    minHeight: 24,
    minWidth: 24,
  },
  iconDeleteBtn: {
    background: "transparent",
    border: "1px solid #7f1d1d",
    color: "#fca5a5",
    borderRadius: 999,
    width: 28,
    height: 28,
    padding: 0,
    fontSize: 18,
    lineHeight: 1,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
  },
  secondaryBtn: {
    background: "#173459",
    border: "1px solid #2d6cdf",
    color: "#dbeafe",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    minHeight: 24,
  },
  aiActionBtn: {
    background: "linear-gradient(135deg,#7df9a1,#00d4ff)",
    border: "1px solid rgba(125, 249, 161, 0.45)",
    color: "#04202e",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    minHeight: 24,
  },
  aiHint: {
    margin: 0,
    fontSize: 16,
    color: "#9fb0c5",
    lineHeight: 1.35,
  },
  aiErrorText: {
    margin: 0,
    fontSize: 16,
    color: "#fca5a5",
    lineHeight: 1.35,
  },
  colorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  pricingColorGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 10,
  },
  compactColorField: {
    display: "grid",
    gap: 4,
    minWidth: 0,
    width: "100%",
  },
  compactColorLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#9db3c2",
    letterSpacing: 0.4,
    lineHeight: 1.15,
    overflowWrap: "anywhere",
  },
  compactColorRow: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 6,
    alignItems: "stretch",
    minWidth: 0,
  },
  compactColorInput: {
    width: "100%",
    height: 32,
    padding: 2,
    borderRadius: 8,
    border: "1px solid #2b3650",
    background: "#0d1522",
    boxSizing: "border-box",
  },
  compactColorSwatches: {
    display: "flex",
    gap: 5,
    flexWrap: "wrap",
    alignItems: "center",
  },
  colorField: {
    display: "grid",
    gap: 6,
  },
  colorLabel: {
    fontSize: 16,
    fontWeight: 700,
    color: "#94a3b8",
  },
  colorInput: {
    width: "100%",
    height: 38,
    padding: 4,
    borderRadius: 8,
    border: "1px solid #2b3650",
    background: "#0d1522",
    cursor: "pointer",
  },
  colorSwatchRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    alignItems: "center",
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 999,
    border: "2px solid rgba(148,163,184,0.28)",
    cursor: "pointer",
    background: "#0f172a",
  },
  assetPicker: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 8,
  },
  assetChip: {
    background: "#173459",
    border: "1px solid #2d6cdf",
    color: "#dbeafe",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    minHeight: 24,
    minWidth: 24,
  },
  assetUploadCta: {
    background: "linear-gradient(135deg,#7df9a1,#00d4ff)",
    color: "#04202e",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 24,
    minWidth: 24,
  },
  hiddenInput: {
    display: "none",
  },
  assetThumbBtn: {
    width: 52,
    height: 52,
    padding: 0,
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid #2b3650",
    background: "#0d1522",
    cursor: "pointer",
  },
  assetThumbPreview: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
};
