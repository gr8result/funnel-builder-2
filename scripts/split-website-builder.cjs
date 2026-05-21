/**
 * Script to split PageBuilderCanvas.js and WebsiteBlockRenderer.js into smaller sub-modules.
 * Run: node scripts/split-website-builder.cjs
 */
"use strict";
const fs = require("fs");
const path = require("path");

const BASE = path.join(__dirname, "..", "components", "website-builder");

// ─── helpers ──────────────────────────────────────────────────────────────────
function readLines(filePath) {
  return fs.readFileSync(filePath, "utf8").split("\n");
}
function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`  ✓ ${path.relative(path.join(__dirname, ".."), filePath)}  (${Math.round(Buffer.byteLength(content, "utf8") / 1024)}KB)`);
}
// lines is 0-indexed; start/end are 1-based inclusive line numbers
function extractLines(lines, start, end) {
  return lines.slice(start - 1, end).join("\n");
}

// ══════════════════════════════════════════════════════════════════════════════
//  SPLIT:  WebsiteBlockRenderer.js
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n── WebsiteBlockRenderer.js ─────────────────────────────────────");

const wbrLines = readLines(path.join(BASE, "WebsiteBlockRenderer.js"));

// ── 1. wbAnimations.js  (lines 6-999) ────────────────────────────────────────
const wbAnimationsHeader = `import React from "react";
import { FaArrowDown, FaArrowRight } from "react-icons/fa";
import { getAssetFromLibrary, resolveAssetField } from "../../../lib/website-builder/mediaAssets";
import { renderGridLibraryIcon } from "../gridIconLibrary";

// colorWithAlpha is also defined in wbVariantStyles; duplicated here (no-export) so that
// heroBackground (line ~523 of original) can use it without a circular import.
function colorWithAlpha(color, alpha = 1) {
  const safeAlpha = Math.max(0, Math.min(1, Number(alpha ?? 1)));
  const raw = String(color || "").trim();
  if (!raw) return \`rgba(15,23,42,\${safeAlpha})\`;
  if (raw.startsWith("rgba(")) {
    return raw.replace(/rgba\\(([^)]+),\\s*[^,()]+\\)$/i, \`rgba($1, \${safeAlpha})\`);
  }
  if (raw.startsWith("rgb(")) {
    const values = raw.slice(4, -1);
    return \`rgba(\${values}, \${safeAlpha})\`;
  }
  let hex = raw.replace("#", "");
  if (hex.length === 3) {
    hex = hex.split("").map((char) => char + char).join("");
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);
    return \`rgba(\${red}, \${green}, \${blue}, \${safeAlpha})\`;
  }
  return raw;
}

`;

// Lines 1-5 are the original import block — skipped since header provides adjusted-path imports
const wbAnimationsBody = extractLines(wbrLines, 6, 999)
  // Strip `export` from inline declarations — these are exported via the export{} block at the bottom
  .replace(/^export function websiteBlockKeyframes\b/m, "function websiteBlockKeyframes")
  .replace(/^export function getAnimationStyle\b/m, "function getAnimationStyle");

const wbAnimationsExports = `

// ─── exports ──────────────────────────────────────────────────────────────────
export {
  MIN_TEXT_SIZE, MIN_TAP_SIZE, PREMIUM_SHADOW, PREMIUM_BORDER, DEFAULT_LAYOUT_WIDTH,
  WEBSITE_BLOCK_ANIMATION_STYLE_ID, WEBSITE_BLOCK_ANIMATION_CSS, PARALLAX_OVERRUN,
  websiteBlockKeyframes, ensureWebsiteBlockAnimationStyles, animationState,
  ScrollReveal, HtmlEmbedBlock, ambientMotionStyle, getAnimationStyle,
  asArray, slugifyText, resolveCurrentPageKey, isCurrentNavLink, shouldHighlightNavLink,
  isSystemAsset, pickDefaultAvatarSrc, resolvePublishedNavHref,
  isGradientValue, extractSolidColor, resolveHeroBaseColor, resolveHeroGradient,
  compensateParallaxBgPosition, resolveParallaxSpeed, heroBackground,
  IconCounterNumber, ParallaxSyncShell, ParallaxImageLayer, StableParallaxLayer,
};
`;

writeFile(
  path.join(BASE, "website-renderer", "wbAnimations.js"),
  wbAnimationsHeader + wbAnimationsBody + wbAnimationsExports,
);

// ── 2. wbVariantStyles.js  (lines 1000-3136) ─────────────────────────────────
const wbVariantStylesHeader = `import React from "react";
import { FaArrowDown, FaArrowRight } from "react-icons/fa";
import { getAssetFromLibrary, resolveAssetField } from "../../../lib/website-builder/mediaAssets";
import { renderGridLibraryIcon } from "../gridIconLibrary";
import {
  MIN_TEXT_SIZE, MIN_TAP_SIZE, PREMIUM_SHADOW, PREMIUM_BORDER, DEFAULT_LAYOUT_WIDTH,
} from "./wbAnimations";

`;

const wbVariantStylesBody = extractLines(wbrLines, 1000, 3136);

const wbVariantStylesExports = `

// ─── exports ──────────────────────────────────────────────────────────────────
export {
  colorWithAlpha, asStyleObject, asRichHtml, CANVAS_PLACEHOLDER_STRINGS, stripPlaceholder,
  computeHeadlineTextStyleCss, textLayerBackgroundStyle, headingTypography, bodyTypography,
  spacingMultiplier, scaleBoxPadding, parseSizeValue, fullWidthStyle, sectionContentStyle,
  normalizeOverlayLayoutProps, heroLayoutDefaults, heroVariantStyles,
  normalizeFeatureItem, featureVariantStyles,
  testimonialVariantStyles, ctaButtonVariantStyles,
  normalizeGalleryItem, normalizeTeamMember, normalizeTestimonialItem, normalizeTestimonialItems,
  normalizeTeamRowSizes, defaultTeamHierarchyRows, buildTeamHierarchyRows, renderHierarchyConnector,
  teamVariantStyles, normalizeStatItem, statsVariantStyles, imageGalleryVariantStyles,
  pricingVariantStyles, iconGlyph, normalizePricingPlan,
  navVariantTheme, contactFormVariantStyles, DEFAULT_ENQUIRY_BOOKING_URL, resolveContactBookingUrl,
  trustBadgeVariantStyles, resolveNewsletterButtonUrl, resolveFooterEmailHref,
  resolveFooterPhoneHref, buildNewsletterMailtoHref,
  buildNavLinkStyle, applyNavHoverEffect, resetNavHoverEffect,
  findScrollParent, getBrandInitials, BrandMark,
};
`;

writeFile(
  path.join(BASE, "website-renderer", "wbVariantStyles.js"),
  wbVariantStylesHeader + wbVariantStylesBody + wbVariantStylesExports,
);

// ── 3. wbBlockComponents.js  (lines 3137-6772) ───────────────────────────────
const wbBlockComponentsHeader = `import React from "react";
import { FaArrowDown, FaArrowRight } from "react-icons/fa";
import { getAssetFromLibrary, resolveAssetField } from "../../../lib/website-builder/mediaAssets";
import { renderGridLibraryIcon } from "../gridIconLibrary";
import {
  MIN_TEXT_SIZE, MIN_TAP_SIZE, PREMIUM_SHADOW, PREMIUM_BORDER, DEFAULT_LAYOUT_WIDTH,
  ScrollReveal, getAnimationStyle, ambientMotionStyle, ensureWebsiteBlockAnimationStyles,
  isCurrentNavLink, shouldHighlightNavLink, isSystemAsset, resolvePublishedNavHref,
} from "./wbAnimations";
import {
  colorWithAlpha, asStyleObject, asRichHtml, CANVAS_PLACEHOLDER_STRINGS, stripPlaceholder,
  computeHeadlineTextStyleCss, textLayerBackgroundStyle, headingTypography, bodyTypography,
  spacingMultiplier, scaleBoxPadding, parseSizeValue, fullWidthStyle, sectionContentStyle,
  normalizeOverlayLayoutProps, heroLayoutDefaults, heroVariantStyles, normalizeFeatureItem,
  featureVariantStyles, testimonialVariantStyles, ctaButtonVariantStyles,
  normalizeGalleryItem, normalizeTeamMember, normalizeTestimonialItem, normalizeTestimonialItems,
  normalizeTeamRowSizes, defaultTeamHierarchyRows, buildTeamHierarchyRows, renderHierarchyConnector,
  teamVariantStyles, normalizeStatItem, statsVariantStyles, imageGalleryVariantStyles,
  pricingVariantStyles, iconGlyph, normalizePricingPlan,
  navVariantTheme, contactFormVariantStyles, DEFAULT_ENQUIRY_BOOKING_URL, resolveContactBookingUrl,
  trustBadgeVariantStyles, resolveNewsletterButtonUrl, resolveFooterEmailHref,
  resolveFooterPhoneHref, buildNewsletterMailtoHref,
  buildNavLinkStyle, applyNavHoverEffect, resetNavHoverEffect,
  findScrollParent, BrandMark,
} from "./wbVariantStyles";

`;

const wbBlockComponentsBody = extractLines(wbrLines, 3137, 6772);

const wbBlockComponentsExports = `

// ─── exports ──────────────────────────────────────────────────────────────────
export {
  NavBarBlock,
  clampValue, snapToGrid, shouldSkipToolbarBlur, cleanInlineEditorHtml, htmlToPlainText,
  LayeredImageStackBlock, EditableImageBlock, getListMarker, ColumnEditorCard,
  FAQAccordionItems, FAQAccordionBlock,
  resolveSplitFaqBlockProps, resolveSplitHeadlineBlockProps, resolveSplitBodyBlockProps, SplitFaqBlock,
  renderOverlayGuides, getOverlayGuideState, getPixelGuideState, renderCanvasCenterGuides,
  getOverlayBoundsElement, useOverlayBounds, DraggableContentOverlay,
  resolveColumnCardStyle, normalizeGridSectionItems, renderGridSectionIcon,
  resolveServicesStylePreset, resolveServicesColorPreset, ServicesGridCard,
  isServicesGridVariant, resolveGridSectionCardStyle, ExtraTextOverlay, DraggableImageOverlay,
};
`;

writeFile(
  path.join(BASE, "website-renderer", "wbBlockComponents.js"),
  wbBlockComponentsHeader + wbBlockComponentsBody + wbBlockComponentsExports,
);

// ── 4. WebsiteBlockRenderer.js  (new — imports + lines 6773-end) ─────────────
const wbrNewHeader = `import React from "react";
import { FaArrowDown, FaArrowRight } from "react-icons/fa";
import { getAssetFromLibrary, resolveAssetField } from "../../lib/website-builder/mediaAssets";
import { renderGridLibraryIcon } from "./gridIconLibrary";
import {
  MIN_TEXT_SIZE, MIN_TAP_SIZE, PREMIUM_SHADOW, PREMIUM_BORDER, DEFAULT_LAYOUT_WIDTH,
  PARALLAX_OVERRUN,
  websiteBlockKeyframes, getAnimationStyle, ensureWebsiteBlockAnimationStyles, animationState,
  ScrollReveal, HtmlEmbedBlock, ambientMotionStyle,
  asArray, slugifyText, resolveCurrentPageKey, isCurrentNavLink, shouldHighlightNavLink,
  isSystemAsset, pickDefaultAvatarSrc, resolvePublishedNavHref,
  isGradientValue, extractSolidColor, resolveHeroBaseColor, resolveHeroGradient,
  compensateParallaxBgPosition, resolveParallaxSpeed, heroBackground,
  IconCounterNumber, ParallaxSyncShell, ParallaxImageLayer, StableParallaxLayer,
} from "./website-renderer/wbAnimations";
import {
  colorWithAlpha, asStyleObject, asRichHtml, CANVAS_PLACEHOLDER_STRINGS, stripPlaceholder,
  computeHeadlineTextStyleCss, textLayerBackgroundStyle, headingTypography, bodyTypography,
  spacingMultiplier, scaleBoxPadding, parseSizeValue, fullWidthStyle, sectionContentStyle,
  normalizeOverlayLayoutProps, heroLayoutDefaults, heroVariantStyles,
  normalizeFeatureItem, featureVariantStyles,
  testimonialVariantStyles, ctaButtonVariantStyles,
  normalizeGalleryItem, normalizeTeamMember, normalizeTestimonialItem, normalizeTestimonialItems,
  normalizeTeamRowSizes, defaultTeamHierarchyRows, buildTeamHierarchyRows, renderHierarchyConnector,
  teamVariantStyles, normalizeStatItem, statsVariantStyles, imageGalleryVariantStyles,
  pricingVariantStyles, iconGlyph, normalizePricingPlan,
  navVariantTheme, contactFormVariantStyles, DEFAULT_ENQUIRY_BOOKING_URL, resolveContactBookingUrl,
  trustBadgeVariantStyles, resolveNewsletterButtonUrl, resolveFooterEmailHref,
  resolveFooterPhoneHref, buildNewsletterMailtoHref,
  buildNavLinkStyle, applyNavHoverEffect, resetNavHoverEffect,
  findScrollParent, getBrandInitials, BrandMark,
} from "./website-renderer/wbVariantStyles";
import {
  NavBarBlock,
  clampValue, snapToGrid, shouldSkipToolbarBlur, cleanInlineEditorHtml, htmlToPlainText,
  LayeredImageStackBlock, EditableImageBlock, getListMarker, ColumnEditorCard,
  FAQAccordionItems, FAQAccordionBlock,
  resolveSplitFaqBlockProps, resolveSplitHeadlineBlockProps, resolveSplitBodyBlockProps, SplitFaqBlock,
  renderOverlayGuides, getOverlayGuideState, getPixelGuideState, renderCanvasCenterGuides,
  getOverlayBoundsElement, useOverlayBounds, DraggableContentOverlay,
  resolveColumnCardStyle, normalizeGridSectionItems, renderGridSectionIcon,
  resolveServicesStylePreset, resolveServicesColorPreset, ServicesGridCard,
  isServicesGridVariant, resolveGridSectionCardStyle, ExtraTextOverlay, DraggableImageOverlay,
} from "./website-renderer/wbBlockComponents";

// Re-export animation utilities consumed by PageBuilderCanvas
export { websiteBlockKeyframes, getAnimationStyle } from "./website-renderer/wbAnimations";

`;

const wbrRemaining = extractLines(wbrLines, 6773, wbrLines.length);
// Remove the original "export function websiteBlockKeyframes" and "export function getAnimationStyle"
// since they're now re-exported from the animation sub-module.
// They stay in wbAnimations as named exports; we just need to not duplicate them.

writeFile(
  path.join(BASE, "WebsiteBlockRenderer.js"),
  wbrNewHeader + wbrRemaining,
);

// ══════════════════════════════════════════════════════════════════════════════
//  SPLIT:  PageBuilderCanvas.js
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n── PageBuilderCanvas.js ────────────────────────────────────────");

const pbcLines = readLines(path.join(BASE, "PageBuilderCanvas.js"));

// ANIMATION_PRESETS constant that needs to be available in pbEditorUtils for getSelectOptions
const ANIMATION_PRESETS_DEF = `
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

`;

// ── 1. pbEditorUtils.js  (lines 1-816) ────────────────────────────────────────
const pbEditorUtilsHeader = `import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal, flushSync } from "react-dom";
import { applyAssetToProps, createStoredAsset, getAssetFromLibrary, normalizeSelectedAsset, resolveAssetField } from "../../../lib/website-builder/mediaAssets";
import { saveWebsiteBuilderAssets } from "../../../lib/website-builder/projectStore";
import { BlockTypes, BlockDefinitions } from "../../../lib/website-builder/pageBlockComponents";
import { openSharedMediaPicker } from "../../../lib/openSharedMediaPicker";
import { renderWebsiteBlock, websiteBlockKeyframes } from "../WebsiteBlockRenderer";
import { GRID_ICON_LIBRARY, renderGridLibraryIcon } from "../gridIconLibrary";
import RichText from "../../RichText";

`;

// Lines 1-11 are the original import block — skipped since header provides adjusted-path imports.
// Line 12 is the ImageEditModal dynamic import — included as start of the body.
const pbEditorUtilsBody = extractLines(pbcLines, 12, 816)
  // Fix dynamic import path — now one level deeper (page-builder/ vs website-builder/)
  .replace('import("../email/editor2/ImageEditModal")', 'import("../../email/editor2/ImageEditModal")');

const pbEditorUtilsExports = `

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
`;

writeFile(
  path.join(BASE, "page-builder", "pbEditorUtils.js"),
  // The file already starts with the dynamic ImageEditModal import (line 12 of original),
  // but we need ANIMATION_PRESETS available BEFORE getSelectOptions (line 109).
  // Insert the ANIMATION_PRESETS definition right after the import block (before line 13).
  pbEditorUtilsHeader + ANIMATION_PRESETS_DEF + pbEditorUtilsBody + pbEditorUtilsExports,
);

// ── 2. pbPropertiesPanels.js  (lines 817-5152) ────────────────────────────────
const pbPropertiesPanelsHeader = `import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal, flushSync } from "react-dom";
import { applyAssetToProps, createStoredAsset, getAssetFromLibrary, normalizeSelectedAsset, resolveAssetField } from "../../../lib/website-builder/mediaAssets";
import { saveWebsiteBuilderAssets } from "../../../lib/website-builder/projectStore";
import { BlockTypes, BlockDefinitions } from "../../../lib/website-builder/pageBlockComponents";
import { openSharedMediaPicker } from "../../../lib/openSharedMediaPicker";
import { renderWebsiteBlock, websiteBlockKeyframes } from "../WebsiteBlockRenderer";
import { GRID_ICON_LIBRARY, renderGridLibraryIcon } from "../gridIconLibrary";
import RichText from "../../RichText";
import {
  ImageEditModal,
  ANIMATION_PRESETS as ANIMATION_PRESETS_UTIL,
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
} from "./pbEditorUtils";

`;

const pbPropertiesPanelsBody = extractLines(pbcLines, 817, 5152);

const pbPropertiesPanelsExports = `

// ─── exports ──────────────────────────────────────────────────────────────────
export {
  BlockPresetPicker, NavbarPresetPicker, NavbarLinksEditor,
  normalizeFeatureListItem, normalizeGalleryItem, createDefaultGalleryItem,
  normalizeTeamMember, normalizeTeamRowSizes, formatTeamRowSizes, deriveTeamRowSizesFromMembers,
  rebalanceTeamMembersForRows, buildEditableTeamRows,
  normalizeStatItem, StatsItemsEditor,
  normalizeTestimonialItemForEditor, normalizeTrustBadgeItem, TrustBadgesEditor,
  CustomHtmlPropertiesPanel, TrustBadgesPropertiesPanel,
  TestimonialItemsEditor, TestimonialPropertiesPanel,
  NewsletterPropertiesPanel, FooterPropertiesPanel,
  TextPropertiesPanel, StatsPropertiesPanel,
  ContainerImageControls,
  TeamMembersEditor, TeamPropertiesPanel,
  ensureGalleryImagesCount, ListItemsEditor, FeatureListPropertiesPanel,
  GalleryImagesEditor, ImageGalleryPropertiesPanel,
  PricingTablePropertiesPanel,
  FAQPropertiesPanel, SplitBlockPropertiesPanel,
  NumberField, ImagePropertiesPanel,
  NavbarLogoPicker, NavbarPropertiesPanel,
  normalizeColorInput, STANDARD_COLOR_SWATCHES, PRICING_COLOR_SWATCHES,
  ColorSelector, CompactColorField,
  rgbToHex, stripEditorArtifacts,
  TEXT_TOOLBAR_FONTS, TEXT_TOOLBAR_SIZES, TEXT_TOOLBAR_LINE_HEIGHTS,
  ANIMATION_PRESETS, ANIMATION_DELAY_OPTIONS, ANIMATION_SPEED_OPTIONS, BLOCK_TYPE_STYLE_PRESETS,
  getTextAnimationBinding, getSelectionStyleSource, getEditableBackgroundTarget,
  parseBackgroundImageUrl, normalizeToolbarBackgroundColor, normalizeComputedLineHeight,
  TextEditingToolbar, BlockAnimationPopover,
  formatSavedAgo, pickGlobalStyleValue, GlobalStylePanel,
  BlockLibraryPanel, PageSectionsPanel,
};
`;

writeFile(
  path.join(BASE, "page-builder", "pbPropertiesPanels.js"),
  pbPropertiesPanelsHeader + pbPropertiesPanelsBody + pbPropertiesPanelsExports,
);

// ── 3. pbCanvasComponents.js  (lines 5153-8424) ────────────────────────────────
const pbCanvasComponentsHeader = `import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal, flushSync } from "react-dom";
import { applyAssetToProps, createStoredAsset, getAssetFromLibrary, normalizeSelectedAsset, resolveAssetField } from "../../../lib/website-builder/mediaAssets";
import { saveWebsiteBuilderAssets } from "../../../lib/website-builder/projectStore";
import { BlockTypes, BlockDefinitions } from "../../../lib/website-builder/pageBlockComponents";
import { openSharedMediaPicker } from "../../../lib/openSharedMediaPicker";
import { renderWebsiteBlock, websiteBlockKeyframes } from "../WebsiteBlockRenderer";
import { GRID_ICON_LIBRARY, renderGridLibraryIcon } from "../gridIconLibrary";
import RichText from "../../RichText";
import {
  formatLabel, isImageField, isColorField, isLongTextField, getSelectOptions,
  supportsSectionHeight, supportsFullWidthBackground, isFullWidthBackgroundEnabled,
  supportsCopyRegeneration, parsePixelValue,
  createImageStackLayer, createTextStackLayer,
  createFaqItem, normalizeFaqItems, createContactField, normalizeContactFields,
  isCssGradient, extractSolidColor, normalizeHeroBackgroundModeProps,
  AssetLibraryModal, openSharedLibraryAssetPicker,
  CONTACT_FORM_TEMPLATES, CONTACT_FORM_STYLE_TEMPLATES,
  DEFAULT_ENQUIRY_BOOKING_URL, resolveContactBookingUrl, htmlToPlainText,
  createPricingPlan, normalizePricingPlans,
  NAVBAR_STYLE_PRESETS, BLOCK_STYLE_PRESETS, COPY_TONE_OPTIONS,
  getHeroLayoutDefaults, applyHeroPresetLayout, withHeroOverlayDefaults,
  TEXT_SIZE_OPTIONS, ANIMATION_PRESETS,
} from "./pbEditorUtils";
import {
  BlockPresetPicker, NavbarPresetPicker, NavbarLinksEditor,
  normalizeFeatureListItem, normalizeGalleryItem, createDefaultGalleryItem,
  normalizeTeamMember, normalizeTeamRowSizes, formatTeamRowSizes, deriveTeamRowSizesFromMembers,
  rebalanceTeamMembersForRows, buildEditableTeamRows,
  normalizeStatItem, StatsItemsEditor,
  normalizeTestimonialItemForEditor, normalizeTrustBadgeItem, TrustBadgesEditor,
  CustomHtmlPropertiesPanel, TrustBadgesPropertiesPanel,
  TestimonialItemsEditor, TestimonialPropertiesPanel,
  NewsletterPropertiesPanel, FooterPropertiesPanel,
  TextPropertiesPanel, StatsPropertiesPanel,
  ContainerImageControls, TeamMembersEditor, TeamPropertiesPanel,
  ensureGalleryImagesCount, ListItemsEditor, FeatureListPropertiesPanel,
  GalleryImagesEditor, ImageGalleryPropertiesPanel,
  PricingTablePropertiesPanel, FAQPropertiesPanel, SplitBlockPropertiesPanel,
  NumberField, ImagePropertiesPanel, NavbarLogoPicker, NavbarPropertiesPanel,
  normalizeColorInput, STANDARD_COLOR_SWATCHES, PRICING_COLOR_SWATCHES,
  ColorSelector, CompactColorField, rgbToHex, stripEditorArtifacts,
  TEXT_TOOLBAR_FONTS, TEXT_TOOLBAR_SIZES, TEXT_TOOLBAR_LINE_HEIGHTS,
  ANIMATION_PRESETS as ANIMATION_PRESETS_PANELS,
  ANIMATION_DELAY_OPTIONS, ANIMATION_SPEED_OPTIONS, BLOCK_TYPE_STYLE_PRESETS,
  getTextAnimationBinding, getSelectionStyleSource, getEditableBackgroundTarget,
  parseBackgroundImageUrl, normalizeToolbarBackgroundColor, normalizeComputedLineHeight,
  TextEditingToolbar, BlockAnimationPopover,
  formatSavedAgo, pickGlobalStyleValue, GlobalStylePanel,
  BlockLibraryPanel, PageSectionsPanel,
} from "./pbPropertiesPanels";

`;

const pbCanvasComponentsBody = extractLines(pbcLines, 5153, 8424);

const pbCanvasComponentsExports = `

// ─── exports ──────────────────────────────────────────────────────────────────
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
  PropertiesPanel,
  renderBlockPreview,
};
`;

writeFile(
  path.join(BASE, "page-builder", "pbCanvasComponents.js"),
  pbCanvasComponentsHeader + pbCanvasComponentsBody + pbCanvasComponentsExports,
);

// ── 4. PageBuilderCanvas.js  (new — imports + lines 8425-end) ─────────────────
const pbcNewHeader = `import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal, flushSync } from "react-dom";
import { applyAssetToProps, createStoredAsset, getAssetFromLibrary, normalizeSelectedAsset, resolveAssetField } from "../../lib/website-builder/mediaAssets";
import { saveWebsiteBuilderAssets } from "../../lib/website-builder/projectStore";
import { BlockTypes, BlockDefinitions } from "../../lib/website-builder/pageBlockComponents";
import { openSharedMediaPicker } from "../../lib/openSharedMediaPicker";
import { renderWebsiteBlock, websiteBlockKeyframes } from "./WebsiteBlockRenderer";
import { GRID_ICON_LIBRARY, renderGridLibraryIcon } from "./gridIconLibrary";
import RichText from "../RichText";
import {
  ImageEditModal,
  formatLabel, isImageField, isColorField, isLongTextField, getSelectOptions,
  supportsSectionHeight, supportsFullWidthBackground, isFullWidthBackgroundEnabled,
  supportsCopyRegeneration, parsePixelValue,
  createImageStackLayer, createTextStackLayer,
  createFaqItem, normalizeFaqItems, createContactField, normalizeContactFields,
  isCssGradient, extractSolidColor, normalizeHeroBackgroundModeProps,
  AssetLibraryModal, openSharedLibraryAssetPicker,
  CONTACT_FORM_TEMPLATES, CONTACT_FORM_STYLE_TEMPLATES,
  DEFAULT_ENQUIRY_BOOKING_URL, resolveContactBookingUrl, htmlToPlainText,
  createPricingPlan, normalizePricingPlans,
  NAVBAR_STYLE_PRESETS, BLOCK_STYLE_PRESETS, COPY_TONE_OPTIONS,
  getHeroLayoutDefaults, applyHeroPresetLayout, withHeroOverlayDefaults,
  TEXT_SIZE_OPTIONS, ANIMATION_PRESETS,
  normalizeCustomStatsPreset, readCustomStatsPreset, writeCustomStatsPreset, matchesCustomStatsPreset,
  CUSTOM_STATS_PRESET_STORAGE_KEY, CUSTOM_STATS_PRESET_FIELDS,
} from "./page-builder/pbEditorUtils";
import {
  BlockPresetPicker, NavbarPresetPicker, NavbarLinksEditor,
  normalizeFeatureListItem, normalizeGalleryItem, createDefaultGalleryItem,
  normalizeTeamMember, normalizeTeamRowSizes, formatTeamRowSizes, deriveTeamRowSizesFromMembers,
  rebalanceTeamMembersForRows, buildEditableTeamRows,
  normalizeStatItem, StatsItemsEditor,
  normalizeTestimonialItemForEditor, normalizeTrustBadgeItem, TrustBadgesEditor,
  CustomHtmlPropertiesPanel, TrustBadgesPropertiesPanel,
  TestimonialItemsEditor, TestimonialPropertiesPanel,
  NewsletterPropertiesPanel, FooterPropertiesPanel,
  TextPropertiesPanel, StatsPropertiesPanel,
  ContainerImageControls, TeamMembersEditor, TeamPropertiesPanel,
  ensureGalleryImagesCount, ListItemsEditor, FeatureListPropertiesPanel,
  GalleryImagesEditor, ImageGalleryPropertiesPanel,
  PricingTablePropertiesPanel, FAQPropertiesPanel, SplitBlockPropertiesPanel,
  NumberField, ImagePropertiesPanel, NavbarLogoPicker, NavbarPropertiesPanel,
  normalizeColorInput, STANDARD_COLOR_SWATCHES, PRICING_COLOR_SWATCHES,
  ColorSelector, CompactColorField, rgbToHex, stripEditorArtifacts,
  TEXT_TOOLBAR_FONTS, TEXT_TOOLBAR_SIZES, TEXT_TOOLBAR_LINE_HEIGHTS,
  ANIMATION_PRESETS as ANIMATION_PRESETS_PANELS,
  ANIMATION_DELAY_OPTIONS, ANIMATION_SPEED_OPTIONS, BLOCK_TYPE_STYLE_PRESETS,
  getTextAnimationBinding, getSelectionStyleSource, getEditableBackgroundTarget,
  parseBackgroundImageUrl, normalizeToolbarBackgroundColor, normalizeComputedLineHeight,
  TextEditingToolbar, BlockAnimationPopover,
  formatSavedAgo, pickGlobalStyleValue, GlobalStylePanel,
  BlockLibraryPanel, PageSectionsPanel,
} from "./page-builder/pbPropertiesPanels";
import {
  CanvasBlockPreview, CanvasBlock, DropInsertZone, GlobalBlockPreview,
  ImageStackPropertiesPanel,
  getColumnEditorConfigs, ColumnsPropertiesPanel,
  normalizeGridSectionItems, renderGridFontIcon, resolveGridIconLibraryName, renderGridEditorIcon,
  GridIconLibraryModal,
  isBuiltinGridDecorationAsset, LIVE_SERVICES_GRID_PRESET,
  SERVICES_STYLE_OPTIONS, SERVICES_COLOR_OPTIONS, SERVICES_LAYOUT_OPTIONS,
  GridSectionPropertiesPanel, ContactFormPropertiesPanel, PropertiesPanel,
  renderBlockPreview,
} from "./page-builder/pbCanvasComponents";

`;

const pbcRemaining = extractLines(pbcLines, 8425, pbcLines.length);

writeFile(
  path.join(BASE, "PageBuilderCanvas.js"),
  pbcNewHeader + pbcRemaining,
);

console.log("\n✅ Done. All files written.\n");
