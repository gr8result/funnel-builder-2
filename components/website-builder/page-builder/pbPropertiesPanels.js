import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal, flushSync } from "react-dom";
import { applyAssetToProps, createStoredAsset, getAssetFromLibrary, normalizeSelectedAsset, resolveAssetField } from "../../../lib/website-builder/mediaAssets";
import { saveWebsiteBuilderAssets } from "../../../lib/website-builder/projectStore";
import { BlockTypes, BlockDefinitions } from "../../../lib/website-builder/pageBlockComponents";
import { openSharedMediaPicker } from "../../../lib/openSharedMediaPicker";
import { renderWebsiteBlock, websiteBlockKeyframes } from "../WebsiteBlockRenderer";
import { GRID_ICON_LIBRARY, renderGridLibraryIcon } from "../gridIconLibrary";
import RichText from "../../RichText";
import { styles } from "./pbStyles";
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
  readCustomStatsPreset, writeCustomStatsPreset, matchesCustomStatsPreset,
} from "./pbEditorUtils";

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

const CANONICAL_MENU_URLS = {
  home: "/",
  "about-us": "/about",
  about: "/about",
  modules: "/modules",
  "contact-us": "/contact",
  contact: "/contact",
  email: "/email",
  pricing: "/pricing",
  crm: "/crm",
  sms: "/sms",
  funnels: "/funnels",
};

function slugifyNavValue(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeNavHref(href, label = "", pageSlug = "") {
  const raw = String(href || "").trim();
  if (/^localhost/i.test(raw) || /^https?:\/\/localhost/i.test(raw)) {
    const path = raw.replace(/^https?:\/\/localhost(?::\d+)?/i, "");
    return normalizeNavHref(path || "/", label, pageSlug);
  }
  if (/^(mailto:|tel:)/i.test(raw)) return raw;
  if (raw.startsWith("#")) {
    const anchorSlug = slugifyNavValue(raw.slice(1));
    return CANONICAL_MENU_URLS[anchorSlug] || raw;
  }
  if (/^https?:\/\//i.test(raw)) return raw;

  const slug = slugifyNavValue(pageSlug || label || raw.replace(/^\//, ""));
  if (CANONICAL_MENU_URLS[slug]) return CANONICAL_MENU_URLS[slug];
  if (!raw) return slug ? `/${slug}` : "";
  if (raw === "/") return "/";
  return raw.startsWith("/") ? raw : `/${slugifyNavValue(raw) || raw}`;
}

function normalizeNavMenuItems(links, { removeDuplicates = false } = {}) {
  const seenIds = new Set();
  const seenKeys = new Set();
  const duplicates = [];

  const normalizeItem = (item, index, childIndex = null) => {
    const label = String(item?.label || "").trim();
    const pageId = String(item?.pageId || item?.page_id || "").trim();
    const pageSlug = slugifyNavValue(item?.slug || item?.pageSlug || label || item?.href || "");
    const href = normalizeNavHref(item?.href, label, pageSlug);
    if (!label && !href) return null;

    const baseId = String(item?.id || "").trim();
    const id = baseId && !seenIds.has(baseId)
      ? baseId
      : `nav-${childIndex === null ? "item" : "child"}-${Date.now()}-${index}-${childIndex ?? 0}`;
    seenIds.add(id);

    const duplicateKey = [pageId || "", pageSlug || slugifyNavValue(href), slugifyNavValue(label)].join("|");
    const isDuplicate = seenKeys.has(duplicateKey);
    if (isDuplicate) duplicates.push({ label: label || href, href });
    if (removeDuplicates && isDuplicate) return null;
    seenKeys.add(duplicateKey);

    const children = (Array.isArray(item?.children) ? item.children : [])
      .map((child, idx) => normalizeItem(child, idx, idx))
      .filter(Boolean)
      .map((child) => ({ ...child, href: child.href || "/" }));

    return {
      ...item,
      id,
      label: label || "Link",
      href: href || "/",
      ...(pageId ? { pageId } : {}),
      ...(pageSlug ? { slug: pageSlug } : {}),
      ...(children.length ? { children } : { children: [] }),
    };
  };

  const normalized = (Array.isArray(links) ? links : []).map((item, index) => normalizeItem(item, index)).filter(Boolean);
  return { links: normalized, duplicates };
}

function buildNavLinkFromPage(page) {
  const label = String(page?.name || page?.title || "").trim() || "Page";
  const slug = slugifyNavValue(page?.slug || label);
  return {
    id: `nav-page-${slug || Date.now()}`,
    pageId: String(page?.id || slug || ""),
    slug,
    label,
    href: normalizeNavHref("", label, slug),
    children: [],
  };
}

function NavbarLinksEditor({ links, onChange, pages = [] }) {
  const { links: safeLinks, duplicates } = normalizeNavMenuItems(links);
  const duplicatePageSlugs = useMemo(() => {
    const counts = new Map();
    (Array.isArray(pages) ? pages : []).forEach((page) => {
      const slug = slugifyNavValue(page?.slug || page?.name || "");
      if (!slug) return;
      counts.set(slug, (counts.get(slug) || 0) + 1);
    });
    return Array.from(counts.entries()).filter(([, count]) => count > 1).map(([slug]) => slug);
  }, [pages]);
  const makeLinkId = () => `nav-link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const makeChildLinkId = () => `nav-child-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emitChange = (nextLinks, options = {}) => {
    onChange(normalizeNavMenuItems(nextLinks, options).links);
  };

  function updateLink(idx, patch) {
    const next = safeLinks.map((item, currentIdx) => (
      currentIdx === idx ? { ...item, ...patch } : item
    ));
    emitChange(next);
  }

  function removeLink(idx) {
    emitChange(safeLinks.filter((_, currentIdx) => currentIdx !== idx));
  }

  function addLink() {
    emitChange([...safeLinks, { id: makeLinkId(), label: "New Link", href: "/" }]);
  }

  function addPageLink(page) {
    emitChange([...safeLinks, buildNavLinkFromPage(page)]);
  }

  function removeDuplicateLinks() {
    emitChange(safeLinks, { removeDuplicates: true });
  }

  function moveLink(idx, direction) {
    const nextIndex = idx + direction;
    if (nextIndex < 0 || nextIndex >= safeLinks.length) return;
    const next = [...safeLinks];
    const [moved] = next.splice(idx, 1);
    next.splice(nextIndex, 0, moved);
    emitChange(next);
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
    emitChange(next);
  }

  function removeChildLink(parentIdx, childIdx) {
    const next = safeLinks.map((item, currentIdx) => {
      if (currentIdx !== parentIdx) return item;
      return {
        ...item,
        children: (Array.isArray(item.children) ? item.children : []).filter((_, currentChildIdx) => currentChildIdx !== childIdx),
      };
    });
    emitChange(next);
  }

  function nestUnder(fromIdx, parentIdx) {
    if (fromIdx === parentIdx) return;
    const link = safeLinks[fromIdx];
    if (!link) return;
    const asChild = { id: link.id || makeChildLinkId(), label: link.label || "Link", href: link.href || "#" };
    const next = safeLinks
      .filter((_, i) => i !== fromIdx)
      .map((item, currentIdx) => {
        // parentIdx shifts down by 1 if fromIdx < parentIdx
        const adjustedParentIdx = fromIdx < parentIdx ? parentIdx - 1 : parentIdx;
        if (currentIdx !== adjustedParentIdx) return item;
        return { ...item, children: [...(Array.isArray(item.children) ? item.children : []), asChild] };
      });
    emitChange(next);
  }

  return (
    <div style={styles.stackSm}>
      {duplicatePageSlugs.length ? (
        <div style={{ color: "#fbbf24", fontSize: 14, lineHeight: 1.45 }}>
          Warning: duplicate page slugs found: {duplicatePageSlugs.join(", ")}
        </div>
      ) : null}
      {duplicates.length ? (
        <button type="button" style={{ ...styles.secondaryBtn, borderColor: "#f59e0b", color: "#fbbf24" }} onClick={removeDuplicateLinks}>
          Remove Duplicate Menu Items
        </button>
      ) : null}
      {Array.isArray(pages) && pages.length ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {pages.map((page) => (
            <button key={page?.id || page?.slug || page?.name} type="button" style={styles.assetChip} onClick={() => addPageLink(page)}>
              + {page?.name || page?.slug || "Page"}
            </button>
          ))}
        </div>
      ) : null}
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
            onChange={(e) => updateLink(idx, { href: normalizeNavHref(e.target.value, item?.label, item?.slug) })}
            style={styles.propertyInput}
            placeholder="#section or /page"
          />
          <label style={styles.inlineToggle}>
            <input
              type="checkbox"
              checked={!!item?.highlighted}
              onChange={(e) => updateLink(idx, { highlighted: e.target.checked })}
              style={styles.checkboxInput}
            />
            Highlight this link
          </label>
          {safeLinks.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16, color: "#94a3b8", whiteSpace: "nowrap" }}>Nest under →</span>
              <select
                style={{ ...styles.propertyInput, flex: 1, padding: "4px 8px", fontSize: 16 }}
                value=""
                onChange={(e) => { if (e.target.value !== "") nestUnder(idx, Number(e.target.value)); }}
              >
                <option value="">Move under a parent…</option>
                {safeLinks.map((other, otherIdx) => otherIdx !== idx ? (
                  <option key={otherIdx} value={otherIdx}>{other?.label || `Link ${otherIdx + 1}`}</option>
                ) : null)}
              </select>
            </div>
          )}
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
                  onChange={(e) => updateChildLink(idx, childIdx, { href: normalizeNavHref(e.target.value, child?.label, child?.slug) })}
                  style={styles.propertyInput}
                  placeholder="Dropdown href"
                />
              </div>
            ))}

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
    const rawTextBlocks = Array.isArray(item.textBlocks) && item.textBlocks.length
      ? item.textBlocks
      : [
          { id: `feature-${index}-headline`, type: "headline", text: item.title || item.label || item.text || `Feature ${index + 1}` },
          ...(item.body || item.description || item.copy ? [{ id: `feature-${index}-text`, type: "text", text: item.body || item.description || item.copy }] : []),
        ];
    const textBlocks = rawTextBlocks.map((block, blockIndex) => ({
      id: block?.id || `feature-${index}-text-${blockIndex}`,
      type: block?.type === "headline" ? "headline" : block?.type === "label" ? "label" : "text",
      text: String(block?.text || ""),
      style: block?.style && typeof block.style === "object" ? { ...block.style } : {},
    })).filter((block) => block.text.trim() || block.type === "headline" || block.type === "label");
    const headline = textBlocks.find((block) => block.type === "headline")?.text || item.title || item.label || item.text || `Feature ${index + 1}`;
    const body = textBlocks.filter((block) => block.type === "text").map((block) => block.text).join("\n\n") || item.body || item.description || item.copy || "";
    return {
      id: item.id || `feature-item-${index}`,
      title: String(headline),
      body: String(body),
      textBlocks,
      image: String(item.image || item.src || ""),
      imageX: Number.isFinite(Number(item.imageX)) ? Math.max(0, Math.min(100, Number(item.imageX))) : 50,
      imageY: Number.isFinite(Number(item.imageY)) ? Math.max(0, Math.min(100, Number(item.imageY))) : 50,
    };
  }

  return {
    id: `feature-item-${index}`,
    title: String(item || `Feature ${index + 1}`),
    body: "",
    textBlocks: [{ id: `feature-${index}-headline`, type: "headline", text: String(item || `Feature ${index + 1}`) }],
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
  const defaultDetail = "Shows visitors a clear proof point tied to faster launches, stronger lead capture and better follow-up.";
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return {
      id: item.id || `stat-item-${index}`,
      number: String(item.number || item.value || `0${index + 1}`),
      label: String(item.label || item.title || `Metric ${index + 1}`),
      detail: String(item.detail || item.description || defaultDetail),
      cardAnimation: item.cardAnimation != null ? String(item.cardAnimation) : "",
    };
  }

  return {
    id: `stat-item-${index}`,
    number: String(item || `0${index + 1}`),
    label: `Metric ${index + 1}`,
    detail: defaultDetail,
    cardAnimation: "",
  };
}

function StatsItemsEditor({ stats, onChange }) {
  const safeStats = Array.isArray(stats) ? stats : [];

  function updateStat(index, patch) {
    onChange(safeStats.map((item, itemIndex) => (
      itemIndex === index ? { ...normalizeStatItem(item, itemIndex), ...patch } : item
    )));
  }

  function moveStat(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= safeStats.length) return;
    const nextStats = [...safeStats];
    const [moved] = nextStats.splice(index, 1);
    nextStats.splice(targetIndex, 0, moved);
    onChange(nextStats);
  }

  function addStat() {
    onChange([
      ...safeStats,
      {
        id: `stat-item-${Date.now()}-${safeStats.length}`,
        number: `${(safeStats.length + 1) * 10}+`,
        label: `Metric ${safeStats.length + 1}`,
        detail: "Use this space to explain the business result behind the number, such as time saved, leads captured or pages launched.",
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
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" style={styles.secondaryBtn} onClick={() => moveStat(index, -1)} disabled={index === 0}>Up</button>
                <button type="button" style={styles.secondaryBtn} onClick={() => moveStat(index, 1)} disabled={index === safeStats.length - 1}>Down</button>
                <button type="button" style={styles.linkRowDelete} onClick={() => removeStat(index)}>Remove</button>
              </div>
            </div>
            <div style={styles.colorGrid}>
              <div>
                <label style={styles.propertyLabel}>Number</label>
                <input
                  type="text"
                  value={stat.number || ""}
                  onChange={(event) => updateStat(index, { number: event.target.value })}
                  style={styles.propertyInput}
                  placeholder="5+"
                />
              </div>
              <div>
                <label style={styles.propertyLabel}>Label</label>
                <input
                  type="text"
                  value={stat.label || ""}
                  onChange={(event) => updateStat(index, { label: event.target.value })}
                  style={styles.propertyInput}
                  placeholder="Tools replaced"
                />
              </div>
            </div>
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Detail</label>
            <textarea
              value={stat.detail || ""}
              onChange={(event) => updateStat(index, { detail: event.target.value })}
              style={{ ...styles.propertyInput, minHeight: 88 }}
              placeholder="Explain the business result behind this number."
            />
            <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Card Animation</label>
            <select
              value={stat.cardAnimation || ""}
              onChange={(event) => updateStat(index, { cardAnimation: event.target.value })}
              style={styles.propertyInput}
            >
              <option value="">Default (use global setting)</option>
              {ANIMATION_PRESETS.map((preset) => (
                <option key={`stat-anim-${index}-${preset.value}`} value={preset.value}>{preset.label}</option>
              ))}
            </select>
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
      icon: item.icon != null ? String(item.icon) : "✓",
      label: item.label != null ? String(item.label) : `Badge ${index + 1}`,
    };
  }

  return {
    id: `trust-badge-${index}`,
    icon: "✓",
    label: String(item || `Badge ${index + 1}`),
  };
}

const TRUST_BADGE_ICONS = [
  // trust / verification
  "✓", "✔", "✅", "☑", "🛡", "🔒", "🔐", "🏅", "🥇", "🏆",
  // stars / rating
  "⭐", "🌟", "💫", "✨",
  // people / community
  "👥", "🤝", "👍", "🙌", "💪",
  // business / quality
  "💎", "👑", "🎖", "📜", "🏷",
  // speed / performance
  "⚡", "🚀", "⏱", "🕐",
  // love / satisfaction
  "❤️", "💯", "😊", "🎉",
  // money / value
  "💰", "💵", "🤑", "📈",
  // communication
  "📞", "💬", "📧", "🌐",
  // misc helpful
  "🔖", "📌", "🎯", "🧩",
];

function TrustBadgesEditor({ badges, onChange }) {
  const [openPicker, setOpenPicker] = React.useState(null); // index of badge whose picker is open

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
    if (openPicker === index) setOpenPicker(null);
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
            {/* Icon field + picker */}
            <div>
              <label style={styles.propertyLabel}>Icon</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="text"
                  value={badge.icon || ""}
                  onChange={(e) => updateBadge(index, { icon: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  style={{ ...styles.propertyInput, flex: 1, minWidth: 0 }}
                  placeholder="✓"
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setOpenPicker(openPicker === index ? null : index); }}
                  style={{
                    flexShrink: 0, width: 34, height: 34, fontSize: 18, lineHeight: 1,
                    background: openPicker === index ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.07)",
                    border: `1px solid ${openPicker === index ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.15)"}`,
                    borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    color: openPicker === index ? "#a5b4fc" : "#94a3b8",
                  }}
                  title="Pick icon"
                >
                  {badge.icon || "☺"}
                </button>
              </div>
              {openPicker === index && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    marginTop: 8, padding: 8,
                    background: "#0d1522", border: "1px solid rgba(99,102,241,0.35)",
                    borderRadius: 8, display: "flex", flexWrap: "wrap", gap: 4,
                  }}
                >
                  {TRUST_BADGE_ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); updateBadge(index, { icon }); setOpenPicker(null); }}
                      style={{
                        width: 32, height: 32, fontSize: 18, lineHeight: 1,
                        background: badge.icon === icon ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${badge.icon === icon ? "rgba(99,102,241,0.7)" : "rgba(255,255,255,0.08)"}`,
                        borderRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      title={icon}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={styles.propertyLabel}>Label</label>
              <input
                type="text"
                value={badge.label || ""}
                onChange={(e) => updateBadge(index, { label: e.target.value })}
                onClick={(e) => e.stopPropagation()}
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

function CustomHtmlPropertiesPanel({ block, index, onChange }) {
  const props = block?.props || {};
  const update = (patch) => onChange(index, { ...props, ...patch });
  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>{"</>"} Custom HTML / Embed</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Embed Code / HTML</label>
          <p style={{ margin: "0 0 8px", color: "#64748b", fontSize: 16, lineHeight: 1.5 }}>
            Paste any HTML, iframe, or third-party widget script here. Scripts will execute on the live published page.
          </p>
          <textarea
            value={props.html || ""}
            onChange={(e) => update({ html: e.target.value })}
            placeholder={"<div>Your embed code here...</div>\n<script>/* scripts run on live page */</script>"}
            style={{ ...styles.propertyInput, minHeight: 220, fontFamily: "monospace", fontSize: 16, resize: "vertical" }}
            spellCheck={false}
          />
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Background Color</label>
          <input type="color" value={props.backgroundColor && props.backgroundColor !== "transparent" ? props.backgroundColor : "#ffffff"} onChange={(e) => update({ backgroundColor: e.target.value })} style={styles.colorInput} />
          <button type="button" style={{ ...styles.secondaryBtn, marginTop: 6 }} onClick={() => update({ backgroundColor: "transparent" })}>Clear (transparent)</button>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Padding</label>
          <div style={styles.colorGrid}>
            <NumberField label="Top (px)" value={Number(props.paddingTop ?? 0)} min={0} max={200} onChange={(v) => update({ paddingTop: v })} />
            <NumberField label="Bottom (px)" value={Number(props.paddingBottom ?? 0)} min={0} max={200} onChange={(v) => update({ paddingBottom: v })} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DividerPropertiesPanel({ block, index, onChange }) {
  const props = block.props || {};
  const update = (patch) => onChange(index, { ...props, ...patch });
  const legacyStyle = String(props.style || "").toLowerCase();
  const dividerType = String(props.dividerType || (legacyStyle === "dots" ? "decorative" : "line")).toLowerCase();
  const lineStyle = String(props.lineStyle || (legacyStyle === "dashes" ? "dashed" : legacyStyle === "dots" ? "dotted" : "solid")).toLowerCase();

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>─ Edit: Divider</h3>
      <div style={styles.propertyGrid}>
        <BlockPresetPicker blockType={BlockTypes.DIVIDER} onApply={(presetProps) => update(presetProps)} />

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Divider Type</label>
          <select value={dividerType} onChange={(e) => update({ dividerType: e.target.value })} style={styles.propertyInput}>
            <option value="line">Line</option>
            <option value="gradient">Gradient Line</option>
            <option value="decorative">Dot Pattern</option>
          </select>
        </div>

        {dividerType === "line" ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Line Style</label>
            <select value={lineStyle} onChange={(e) => update({ lineStyle: e.target.value })} style={styles.propertyInput}>
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
              <option value="double">Double</option>
            </select>
          </div>
        ) : null}

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Layout</label>
          <select value={String(props.alignment || "center")} onChange={(e) => update({ alignment: e.target.value })} style={styles.propertyInput}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
          <label style={{ ...styles.inlineToggle, marginTop: 10 }}>
            <input
              type="checkbox"
              checked={props.fullWidthBackground === true}
              onChange={(e) => update({ fullWidthBackground: e.target.checked })}
              style={styles.checkboxInput}
            />
            Page full width
          </label>
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Sizing</label>
          <div style={styles.colorGrid}>
            <NumberField label="Thickness" value={Number(props.thickness || 1)} min={1} max={24} onChange={(value) => update({ thickness: value })} />
            <NumberField label="Width %" value={Number(props.width || 100)} min={5} max={100} onChange={(value) => update({ width: value })} />
          </div>
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Spacing</label>
          <div style={styles.colorGrid}>
            <NumberField label="Top" value={Number(props.paddingTop ?? 24)} min={0} max={240} onChange={(value) => update({ paddingTop: value })} />
            <NumberField label="Bottom" value={Number(props.paddingBottom ?? 24)} min={0} max={240} onChange={(value) => update({ paddingBottom: value })} />
          </div>
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Colours</label>
          <ColorSelector label="Line" value={props.color || "#cbd5e1"} fallback="#cbd5e1" onChange={(value) => update({ color: value })} />
          {dividerType === "gradient" ? (
            <ColorSelector label="Gradient End" value={props.secondaryColor || "#38bdf8"} fallback="#38bdf8" onChange={(value) => update({ secondaryColor: value })} />
          ) : null}
          <ColorSelector label="Background" value={props.backgroundColor || "transparent"} fallback="transparent" allowTransparent onChange={(value) => update({ backgroundColor: value })} />
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.inlineToggle}>
            <input
              type="checkbox"
              checked={!!props.showLabel}
              onChange={(e) => update({ showLabel: e.target.checked })}
              style={styles.checkboxInput}
            />
            Add centre label
          </label>
          {props.showLabel ? (
            <>
              <input
                type="text"
                value={String(props.label || "")}
                onChange={(e) => update({ label: e.target.value })}
                style={{ ...styles.propertyInput, marginTop: 10 }}
                placeholder="Optional label"
              />
              <ColorSelector label="Label Colour" value={props.labelColor || "#64748b"} fallback="#64748b" onChange={(value) => update({ labelColor: value })} />
            </>
          ) : null}
        </div>
      </div>
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
                    fontWeight: active ? 600 : undefined,
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
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => openSharedLibraryAssetPicker((asset) => onSelectAsset(index, "backgroundImage", asset))}
            >
              Choose From Library
            </button>
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
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Motion</label>
          <div style={styles.colorGrid}>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Section</label>
              <select value={String(props.sectionAnimation || "fade-up")} onChange={(e) => update({ sectionAnimation: e.target.value })} style={styles.propertyInput}>
                {ANIMATION_PRESETS.map((preset) => <option key={`trust-section-${preset.value}`} value={preset.value}>{preset.label}</option>)}
              </select>
            </div>
            <NumberField label="Speed" value={Math.round((Number(props.sectionAnimationSpeed ?? 0.8) || 0.8) * 100)} min={25} max={300} onChange={(value) => update({ sectionAnimationSpeed: Number((value / 100).toFixed(2)) })} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TestimonialItemsEditor({ items, onChange, brandAssets, onUploadImage, blockIndex }) {
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
          <p style={{ margin: "0 0 8px", color: "#64748b", fontSize: 16 }}>Click quote, name, and role directly on the canvas to edit.</p>
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
                  const asset = typeof onUploadImage === "function"
                    ? await onUploadImage(blockIndex, `__testimonial_avatar_${index}__`, file)
                    : await createStoredAsset(file);
                  if (asset?.src) {
                    updateItem(index, {
                      avatarUrl: asset.src,
                      avatar: asset.src,
                      avatarAssetId: asset.id || "",
                    });
                  }
                }}
              />
            </label>
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => openSharedLibraryAssetPicker((asset) => updateItem(index, { avatarUrl: asset.src || "", avatar: asset.src || "", avatarAssetId: asset.id || "" }))}
            >
              Choose From Library
            </button>
            {savedImages.map((image) => (
              <button
                key={`tav-${index}-${image.id || image.src}`}
                type="button"
                style={styles.assetThumbBtn}
                onClick={() => updateItem(index, { avatarUrl: image.src, avatar: image.src, avatarAssetId: image.id || "" })}
                title={image.name}
              >
                <img src={image.src} alt={image.name} style={styles.assetThumbPreview} />
              </button>
            ))}
          </div>
          {item.avatarUrl ? (
            <button type="button" style={{ ...styles.secondaryBtn, marginTop: 6 }} onClick={() => updateItem(index, { avatarUrl: "", avatar: "", avatarAssetId: "" })}>Remove Avatar</button>
          ) : null}
        </div>
      ))}
      <button type="button" style={styles.secondaryBtn} onClick={addItem}>+ Add Review</button>
    </div>
  );
}

function TestimonialPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage }) {
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
                    fontWeight: active ? 600 : undefined,
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
            onUploadImage={onUploadImage}
            blockIndex={index}
          />
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Layout</label>
          <div style={styles.propertyField}>
            <label style={styles.propertyLabel}>Grid Width</label>
            <select
              value={String(Math.max(3, Math.min(6, Number(props.testimonialColumns || props.columns) || 3)))}
              onChange={(e) => update({ testimonialColumns: Number(e.target.value) })}
              style={styles.propertyInput}
            >
              {[3, 4, 5, 6].map((count) => <option key={`testimonial-grid-${count}`} value={count}>{count} wide</option>)}
            </select>
          </div>
          {["spotlight", "bubble"].includes(String(props.testimonialVariant || "cards")) ? (
            <NumberField
              label="Card Width (px)"
              value={Number(props.cardWidth) || 320}
              min={180}
              max={900}
              onChange={(value) => update({ cardWidth: value })}
            />
          ) : null}
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
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Motion</label>
          <div style={styles.colorGrid}>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Section</label>
              <select value={String(props.sectionAnimation || "fade-up")} onChange={(e) => update({ sectionAnimation: e.target.value })} style={styles.propertyInput}>
                {ANIMATION_PRESETS.map((preset) => <option key={`testimonial-section-${preset.value}`} value={preset.value}>{preset.label}</option>)}
              </select>
            </div>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Items</label>
              <select value={String(props.itemAnimation || "fade-up")} onChange={(e) => update({ itemAnimation: e.target.value })} style={styles.propertyInput}>
                {ANIMATION_PRESETS.map((preset) => <option key={`testimonial-item-${preset.value}`} value={preset.value}>{preset.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ ...styles.colorGrid, marginTop: 8 }}>
            <NumberField label="Speed" value={Math.round((Number(props.sectionAnimationSpeed ?? 0.8) || 0.8) * 100)} min={25} max={300} onChange={(value) => update({ sectionAnimationSpeed: Number((value / 100).toFixed(2)) })} />
            <NumberField label="Stagger" value={Math.round((Number(props.itemStagger ?? 0.08) || 0.08) * 100)} min={0} max={200} onChange={(value) => update({ itemStagger: Number((value / 100).toFixed(2)) })} />
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
      <p style={{ margin: "0 0 12px 16px", color: "#64748b", fontSize: 16 }}>Click heading, subtitle, and button text directly on the page to edit.</p>
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
                    fontWeight: active ? 600 : undefined,
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
            <span style={{ color: "#64748b", fontSize: 16 }}>
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
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Motion</label>
          <div style={styles.colorGrid}>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Section</label>
              <select value={String(props.sectionAnimation || "fade-up")} onChange={(e) => update({ sectionAnimation: e.target.value })} style={styles.propertyInput}>
                {ANIMATION_PRESETS.map((preset) => <option key={`newsletter-section-${preset.value}`} value={preset.value}>{preset.label}</option>)}
              </select>
            </div>
            <NumberField label="Speed" value={Math.round((Number(props.sectionAnimationSpeed ?? 0.8) || 0.8) * 100)} min={25} max={300} onChange={(value) => update({ sectionAnimationSpeed: Number((value / 100).toFixed(2)) })} />
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
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => openSharedLibraryAssetPicker((asset) => update({ logo: asset.src || "", logoAssetId: asset.id || "", logoWidth: props.logoWidth || 48 }))}
            >
              Choose From Library
            </button>
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
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Contact Heading</label>
          <input type="text" value={String(props.contactHeading || "")} onChange={(e) => update({ contactHeading: e.target.value })} style={styles.propertyInput} placeholder="Contact" />
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Contact Email</label>
          <input type="text" value={String(props.contactEmail || "")} onChange={(e) => update({ contactEmail: e.target.value })} style={styles.propertyInput} placeholder="hello@yourbrand.com" />
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Contact Phone</label>
          <input type="text" value={String(props.contactPhone || "")} onChange={(e) => update({ contactPhone: e.target.value })} style={styles.propertyInput} placeholder="(555) 010-2026" />
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Contact Address</label>
          <input type="text" value={String(props.contactAddress || "")} onChange={(e) => update({ contactAddress: e.target.value })} style={styles.propertyInput} placeholder="Your city, state" />
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
            <input type="checkbox" checked={props.showNewsletter !== false} onChange={(e) => update({ showNewsletter: e.target.checked })} style={styles.checkboxInput} />
            Show newsletter signup column
          </label>
          {props.showNewsletter !== false ? (
            <>
              <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Newsletter Heading</label>
              <input type="text" value={String(props.newsletterHeading || "")} onChange={(e) => update({ newsletterHeading: e.target.value })} style={styles.propertyInput} placeholder="Stay Updated" />
              <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Subtitle</label>
              <input type="text" value={String(props.newsletterSubtitle || "")} onChange={(e) => update({ newsletterSubtitle: e.target.value })} style={styles.propertyInput} placeholder="Get the latest news." />
              <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Signup Destination</label>
              <input
                type="text"
                value={String(props.newsletterActionUrl || "")}
                onChange={(e) => update({ newsletterActionUrl: e.target.value })}
                style={styles.propertyInput}
                placeholder="https://..., /api/subscribe, or hello@example.com"
              />
              <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Submit Method</label>
              <select
                value={String(props.newsletterSubmitMethod || "post")}
                onChange={(e) => update({ newsletterSubmitMethod: e.target.value })}
                style={styles.propertyInput}
              >
                <option value="post">POST</option>
                <option value="get">GET</option>
              </select>
              <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Fallback Email</label>
              <input
                type="text"
                value={String(props.newsletterFallbackEmail || "")}
                onChange={(e) => update({ newsletterFallbackEmail: e.target.value })}
                style={styles.propertyInput}
                placeholder="Defaults to Contact Email if blank"
              />
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
  const defaultLineHeight = 1.35;
  const updateLineHeight = (value) => {
    const nextLineHeight = normalizeLineHeightValue(value, Number(props.textLineHeight || props.lineHeight || defaultLineHeight));
    update({
      textLineHeight: nextLineHeight,
      bodyLineHeight: nextLineHeight,
      lineHeight: nextLineHeight,
      text: stripInlineCssPropertyFromHtml(props.text, "line-height"),
    });
  };
  const resetLineHeight = () => {
    update({
      textLineHeight: defaultLineHeight,
      bodyLineHeight: defaultLineHeight,
      lineHeight: defaultLineHeight,
      text: stripInlineCssPropertyFromHtml(props.text, "line-height"),
    });
  };
  const stripInlineTextBackgrounds = (html) => (
    stripInlineCssPropertyFromHtml(
      stripInlineCssPropertyFromHtml(
        stripInlineCssPropertyFromHtml(html, "background-color"),
        "background"
      ),
      "background-image"
    )
  );
  const savedImages = [brandAssets?.logo, ...(Array.isArray(brandAssets?.images) ? brandAssets.images : [])].filter(Boolean).slice(0, 8);
  const [heightDraft, setHeightDraft] = useState(String(parsePixelValue(props.minHeight, 160)));

  useEffect(() => {
    setHeightDraft(String(parsePixelValue(props.minHeight, 160)));
  }, [block?.id, props.minHeight]);

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>📝 Edit: Text Section</h3>
      <p style={{ margin: "0 0 12px 16px", color: "#64748b", fontSize: 16 }}>Click text directly on the page to edit.</p>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Section Height</label>
          <input
            type="text"
            inputMode="numeric"
            value={heightDraft}
            onChange={(e) => setHeightDraft(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={() => {
              const px = Math.max(80, Number(heightDraft) || 160);
              setHeightDraft(String(px));
              update({ minHeight: `${px}px` });
            }}
            placeholder="160"
            style={styles.propertyInput}
          />
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={props.fullWidthBackground !== false}
              onChange={(e) => update({ fullWidthBackground: e.target.checked })}
              style={styles.checkboxInput}
            />
            Full width background
          </label>
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={!!props.enableParallax}
              onChange={(e) => update({ enableParallax: e.target.checked })}
              style={styles.checkboxInput}
            />
            Enable parallax background
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
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => openSharedLibraryAssetPicker((asset) => onSelectAsset(index, "backgroundImage", asset))}
            >
              Choose From Library
            </button>
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
          <label style={{ ...styles.inlineToggle, marginTop: 10 }}>
            <input
              type="checkbox"
              checked={props.stripInlineTextBackgrounds !== false}
              onChange={(e) => update({ stripInlineTextBackgrounds: e.target.checked })}
              style={styles.checkboxInput}
            />
            Remove inline text backgrounds
          </label>
          <button
            type="button"
            style={{ ...styles.secondaryBtn, marginTop: 8 }}
            onClick={() => update({ text: stripInlineTextBackgrounds(props.text), stripInlineTextBackgrounds: true })}
          >
            Clear Text Highlights
          </button>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Typography</label>
          {/* Block-level font family */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ ...styles.propertyLabel, fontSize: 13, marginBottom: 4, display: "block" }}>Block font family</label>
            <select
              value={props.fontFamily || ""}
              onChange={(e) => update({ fontFamily: e.target.value || undefined })}
              style={{ ...styles.propertyInput, width: "100%" }}
            >
              <option value="">— inherit from theme —</option>
              {["Manrope","Inter","Poppins","Montserrat","Raleway","Lato","Open Sans","Roboto","Outfit","DM Sans","Work Sans","Nunito","Playfair Display","Merriweather","Lora","Oswald","Bebas Neue","Dancing Script","Pacifico"].map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          {/* Block-level font size + line height */}
          <div style={styles.colorGrid}>
            <NumberField label="Base size (px)" value={Number(props.textFontSize || 18)} min={12} max={120} onChange={(value) => update({ textFontSize: value })} />
            <NumberField label="Line height" value={Number(props.textLineHeight || props.lineHeight || defaultLineHeight)} min={0.8} max={3} step={0.05} onChange={updateLineHeight} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {[1.1, 1.25, 1.35, 1.5, 1.7, 2].map((value) => (
              <button
                key={`text-line-preset-${value}`}
                type="button"
                style={{ ...styles.secondaryBtn, padding: "6px 9px", minHeight: 0 }}
                onClick={() => updateLineHeight(value)}
              >
                {value}
              </button>
            ))}
            <button
              type="button"
              style={{ ...styles.secondaryBtn, padding: "6px 9px", minHeight: 0, background: "rgba(14,165,233,0.12)", borderColor: "rgba(14,165,233,0.35)" }}
              onClick={resetLineHeight}
            >
              Reset
            </button>
          </div>
          {/* Block-level default alignment */}
          <div style={{ marginTop: 12 }}>
            <label style={{ ...styles.propertyLabel, fontSize: 13, marginBottom: 6, display: "block" }}>Default alignment</label>
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { value: "left",    icon: "⬅", label: "Left"    },
                { value: "center",  icon: "↔", label: "Centre"  },
                { value: "right",   icon: "➡", label: "Right"   },
                { value: "justify", icon: "☰", label: "Justify" },
              ].map(({ value, icon, label }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  onClick={() => update({ alignment: value })}
                  style={{
                    ...styles.secondaryBtn,
                    flex: 1,
                    padding: "5px 0",
                    minHeight: 0,
                    background: (props.alignment || "left") === value
                      ? "rgba(14,165,233,0.22)" : undefined,
                    borderColor: (props.alignment || "left") === value
                      ? "rgba(14,165,233,0.6)" : undefined,
                    color: (props.alignment || "left") === value ? "#38bdf8" : undefined,
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
              The inline toolbar can override alignment per-paragraph.
            </p>
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Spacing</label>
          <div style={styles.colorGrid}>
            <NumberField label="Top padding" value={Number(props.paddingTop ?? 20)} min={0} max={200} onChange={(value) => update({ paddingTop: value })} />
            <NumberField label="Bottom padding" value={Number(props.paddingBottom ?? 20)} min={0} max={200} onChange={(value) => update({ paddingBottom: value })} />
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Content Width</label>
          <NumberField label="Section max width (px)" value={Number(props.baseLayoutWidth || 1080)} min={320} max={1800} onChange={(value) => update({ baseLayoutWidth: value })} />
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Text Column Width</label>
          <NumberField label="Text width (px, 0 = full)" value={Number(props.textContentWidth || 0)} min={0} max={1600} onChange={(value) => update({ textContentWidth: value > 0 ? value : 0 })} />
          <p style={{ margin: "6px 0 0", fontSize: 16, color: "#64748b" }}>0 = full section width. Drag the blue handle on the right edge of the text to resize.</p>
        </div>
        <BlockPresetPicker
          blockType={block.type}
          onApply={(patch) => update(patch)}
        />
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Motion</label>
          <div style={styles.colorGrid}>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Section</label>
              <select value={String(props.sectionAnimation || "fade-up")} onChange={(e) => update({ sectionAnimation: e.target.value })} style={styles.propertyInput}>
                {ANIMATION_PRESETS.map((preset) => <option key={`text-section-${preset.value}`} value={preset.value}>{preset.label}</option>)}
              </select>
            </div>
            <NumberField label="Speed" value={Math.round((Number(props.sectionAnimationSpeed ?? 0.8) || 0.8) * 100)} min={25} max={300} onChange={(value) => update({ sectionAnimationSpeed: Number((value / 100).toFixed(2)) })} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsPropertiesPanel({ block, index, onChange }) {
  const props = block?.props || {};
  const update = (patch) => onChange(index, { ...props, ...patch });
  const [customPreset, setCustomPreset] = useState(() => readCustomStatsPreset());
  const statsStyleLabels = {
    "editorial-band": "Editorial Band",
    "spotlight-orbs": "Spotlight Orbs",
    "split-scoreboard": "Split Scoreboard",
    "minimal-ticker": "Minimal Ticker",
    "data-ribbon": "Data Ribbon",
  };
  const hasCustomPreset = !!customPreset;
  const customPresetActive = hasCustomPreset && matchesCustomStatsPreset(props, customPreset);

  useEffect(() => {
    setCustomPreset(readCustomStatsPreset());
  }, []);

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
                    fontWeight: active ? 600 : 600,
                  }}
                >
                  {statsStyleLabels[option] || option}
                </button>
              );
            })}
            {hasCustomPreset ? (
              <button
                type="button"
                onClick={() => update(customPreset)}
                style={{
                  ...styles.secondaryBtn,
                  justifyContent: "center",
                  background: customPresetActive ? "#dbeafe" : "#ffffff",
                  borderColor: customPresetActive ? "#2563eb" : "rgba(148,163,184,0.24)",
                  color: customPresetActive ? "#0f172a" : "#334155",
                  fontWeight: 600,
                  gridColumn: "1 / -1",
                }}
              >
                Saved Custom Style
              </button>
            ) : null}
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => setCustomPreset(writeCustomStatsPreset(props))}
              style={{ ...styles.secondaryBtn, justifyContent: "center" }}
            >
              Save Current Style as Option
            </button>
            <span style={{ fontSize: 16, lineHeight: 1.5, color: "#64748b" }}>
              Saves this stats card's layout variant and colour treatment into a reusable option here.
            </span>
          </div>
          <div style={{ ...styles.colorGrid, marginTop: 12 }}>
            <NumberField label="Block Max Width" value={Number(props.blockMaxWidth) || 1200} min={320} max={1800} onChange={(value) => update({ blockMaxWidth: value })} />
            <NumberField label="Card Gap" value={Number(props.statsCardGap ?? 18)} min={0} max={80} onChange={(value) => update({ statsCardGap: value })} />
            <NumberField label="Card Min Width" value={Number(props.statsCardMinWidth ?? 220)} min={140} max={520} onChange={(value) => update({ statsCardMinWidth: value })} />
            {String(props.statsVariant || "editorial-band") === "data-ribbon" ? (
              <NumberField label="Left Col %" value={Math.min(80, Math.max(20, Number(props.statsLeftColPct ?? 40)))} min={20} max={70} onChange={(value) => update({ statsLeftColPct: value })} />
            ) : null}
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Stat Cards</label>
          <StatsItemsEditor stats={props.stats} onChange={(stats) => update({ stats })} />
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Typography</label>
          <div style={styles.colorGrid}>
            <NumberField label="Section Title" value={Number(props.sectionTitleSize || 28)} min={14} max={96} onChange={(value) => update({ sectionTitleSize: value })} />
            <NumberField label="Section Subtitle" value={Number(props.sectionSubtitleSize || 16)} min={12} max={72} onChange={(value) => update({ sectionSubtitleSize: value })} />
            <NumberField label="Number" value={Number(props.numberSize || 48)} min={14} max={120} onChange={(value) => update({ numberSize: value })} />
            <NumberField label="Card Title" value={Number(props.labelSize || 14)} min={10} max={56} onChange={(value) => update({ labelSize: value })} />
            <NumberField label="Card Subtitle" value={Number(props.detailSize || 14)} min={10} max={56} onChange={(value) => update({ detailSize: value })} />
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Colours</label>
          <div style={styles.colorGrid}>
            <CompactColorField label="Section Background" value={props.backgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ backgroundColor: value })} />
            <CompactColorField label="Text" value={props.textColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ textColor: value })} />
            <CompactColorField label="Border" value={props.borderColor || "#e2e8f0"} fallback="#e2e8f0" onChange={(value) => update({ borderColor: value })} />
            <CompactColorField label="Card Background" value={props.cardBackgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ cardBackgroundColor: value })} />
            <CompactColorField label="Accent" value={props.accentColor || "#0ea5e9"} fallback="#0ea5e9" onChange={(value) => update({ accentColor: value })} />
            <CompactColorField label="Section Title" value={props.sectionTitleColor || props.textColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ sectionTitleColor: value })} />
            <CompactColorField label="Section Subtitle" value={props.sectionSubtitleColor || props.textColor || "#475569"} fallback="#475569" onChange={(value) => update({ sectionSubtitleColor: value })} />
            <CompactColorField label="Number" value={props.numberColor || props.textColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ numberColor: value })} />
            <CompactColorField label="Card Title" value={props.labelColor || props.accentColor || "#0ea5e9"} fallback="#0ea5e9" onChange={(value) => update({ labelColor: value })} />
            <CompactColorField label="Card Subtitle" value={props.detailColor || "#64748b"} fallback="#64748b" onChange={(value) => update({ detailColor: value })} />
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Motion</label>
          <div style={styles.colorGrid}>
            {[
              { key: "sectionAnimation", label: "Section" },
              { key: "cardAnimation", label: "Cards" },
              { key: "numberAnimation", label: "Number" },
              { key: "labelAnimation", label: "Card Title" },
              { key: "detailAnimation", label: "Card Subtitle" },
            ].map((field) => (
              <div key={field.key} style={styles.propertyField}>
                <label style={styles.propertyLabel}>{field.label}</label>
                <select value={String(props[field.key] || (field.key === "cardAnimation" ? "fade-up" : field.key === "sectionAnimation" ? "fade-up" : "fade-in"))} onChange={(event) => update({ [field.key]: event.target.value })} style={styles.propertyInput}>
                  {ANIMATION_PRESETS.map((preset) => <option key={`${field.key}-${preset.value}`} value={preset.value}>{preset.label}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div style={styles.colorGrid}>
            <NumberField label="Surface Speed" value={Math.round((Number(props.surfaceAnimationSpeed ?? 0.9) || 0.9) * 100)} min={25} max={300} onChange={(value) => update({ surfaceAnimationSpeed: Number((value / 100).toFixed(2)) })} />
            <NumberField label="Card Stagger" value={Math.round((Number(props.cardStagger ?? 0.08) || 0.08) * 100)} min={0} max={200} onChange={(value) => update({ cardStagger: Number((value / 100).toFixed(2)) })} />
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
    saveWebsiteBuilderAssets({ ...brandAssets, images: [fallbackAsset, ...dedupedImages] });
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
                  <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#475569", fontSize: 16, fontWeight: 600 }}>
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
            <p style={{ margin: "0 0 8px", color: "#64748b", fontSize: 16 }}>Click name, role, or bio directly on the page to edit.</p>
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
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => openSharedLibraryAssetPicker((asset) => updateMember(index, {
                  image: String(asset.src || "").startsWith("data:") ? "" : (asset.src || ""),
                  imageAssetId: asset.id || "",
                }))}
              >
                Choose From Library
              </button>
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
          {isHierarchyLayout ? <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 16, lineHeight: 1.5 }}>Set the row number on each team member card.</p> : null}
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
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Motion</label>
          <div style={styles.colorGrid}>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Section</label>
              <select value={String(props.sectionAnimation || "fade-up")} onChange={(e) => update({ sectionAnimation: e.target.value })} style={styles.propertyInput}>
                {ANIMATION_PRESETS.map((preset) => <option key={`team-section-${preset.value}`} value={preset.value}>{preset.label}</option>)}
              </select>
            </div>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Members</label>
              <select value={String(props.itemAnimation || "fade-up")} onChange={(e) => update({ itemAnimation: e.target.value })} style={styles.propertyInput}>
                {ANIMATION_PRESETS.map((preset) => <option key={`team-item-${preset.value}`} value={preset.value}>{preset.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ ...styles.colorGrid, marginTop: 8 }}>
            <NumberField label="Speed" value={Math.round((Number(props.sectionAnimationSpeed ?? 0.8) || 0.8) * 100)} min={25} max={300} onChange={(value) => update({ sectionAnimationSpeed: Number((value / 100).toFixed(2)) })} />
            <NumberField label="Stagger" value={Math.round((Number(props.itemStagger ?? 0.08) || 0.08) * 100)} min={0} max={200} onChange={(value) => update({ itemStagger: Number((value / 100).toFixed(2)) })} />
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

function ListItemsEditor({ items, onChange, brandAssets, onOpenImageEditor, onUploadImage, blockIndex }) {
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
      title: `Card ${safeItems.length + 1}`,
      body: "Add supporting text.",
      textBlocks: [
        { id: `headline-${Date.now()}`, type: "headline", text: `Card ${safeItems.length + 1}` },
        { id: `text-${Date.now()}`, type: "text", text: "Add supporting text." },
      ],
      image: `https://placehold.co/960x720/e2e8f0/0f172a?text=${encodeURIComponent(`Item ${safeItems.length + 1}`)}`,
      imageX: 50,
      imageY: 50,
    }]);
  }

  function syncLegacyTextFields(textBlocks) {
    const headline = textBlocks.find((block) => block.type === "headline")?.text || "";
    const body = textBlocks.filter((block) => block.type === "text").map((block) => block.text).join("\n\n");
    return { title: headline, body };
  }

  function updateTextBlock(itemIndex, blockIndex, patch) {
    const item = normalizeFeatureListItem(safeItems[itemIndex], itemIndex);
    const textBlocks = item.textBlocks.map((block, currentIndex) => (
      currentIndex === blockIndex ? { ...block, ...patch } : block
    ));
    updateItem(itemIndex, { textBlocks, ...syncLegacyTextFields(textBlocks) });
  }

  function removeTextBlock(itemIndex, blockIndex) {
    const item = normalizeFeatureListItem(safeItems[itemIndex], itemIndex);
    const textBlocks = item.textBlocks.filter((_, currentIndex) => currentIndex !== blockIndex);
    updateItem(itemIndex, { textBlocks, ...syncLegacyTextFields(textBlocks) });
  }

  function addTextBlock(itemIndex, type) {
    const item = normalizeFeatureListItem(safeItems[itemIndex], itemIndex);
    const text = type === "headline" ? "New headline" : type === "label" ? "New label" : "New text block";
    const textBlocks = [
      ...item.textBlocks,
      {
        id: `feature-text-${Date.now()}-${item.textBlocks.length}`,
        type,
        text,
        style: {},
      },
    ];
    updateItem(itemIndex, { textBlocks, ...syncLegacyTextFields(textBlocks) });
  }

  return (
    <div style={styles.stackSm}>
      {safeItems.map((rawItem, index) => {
        const item = normalizeFeatureListItem(rawItem, index);
        return (
        <div key={`${index}-${item.id}`} style={styles.linkRowCard}>
          <div style={styles.linkRowHeader}>
            <span style={styles.linkRowTitle}>Card {index + 1}</span>
            <button type="button" style={styles.linkRowDelete} onClick={() => removeItem(index)}>Remove</button>
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8, display: "block" }}>Card Image</label>
          <input
            type="text"
            value={item.image}
            onChange={(e) => updateItem(index, { image: e.target.value })}
            style={{ ...styles.propertyInput, marginTop: 10 }}
            placeholder="Icon or image URL"
          />
          <div style={{ ...styles.assetPicker, marginTop: 8 }}>
            <label style={styles.assetUploadCta}>
              Upload Icon / Image
              <input
                type="file"
                accept="image/*"
                style={styles.hiddenInput}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  const asset = typeof onUploadImage === "function"
                    ? await onUploadImage(blockIndex, `items.${index}.image`, file)
                    : await createStoredAsset(file);
                  updateItem(index, {
                    image: asset?.src || "",
                    imageAssetId: asset?.id || "",
                    imageAlt: htmlToPlainText(asset?.name || item.imageAlt || ""),
                  });
                }}
              />
            </label>
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => openSharedLibraryAssetPicker((asset) => updateItem(index, {
                image: asset.src || "",
                imageAssetId: asset.id || "",
                imageAlt: htmlToPlainText(asset.name || item.imageAlt || ""),
              }))}
            >
              Choose From Library
            </button>
            {savedImages.map((image) => (
              <button
                key={`feature-item-${index}-${image.id || image.src}`}
                type="button"
                style={styles.assetThumbBtn}
                onClick={() => updateItem(index, {
                  image: image.src || "",
                  imageAssetId: image.id || "",
                  imageAlt: htmlToPlainText(image.name || item.imageAlt || ""),
                })}
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
          <div style={{ ...styles.stackSm, marginTop: 12 }}>
            <div style={styles.linkRowHeader}>
              <span style={styles.linkRowTitle}>Card Text Blocks</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" style={styles.secondaryBtn} onClick={() => addTextBlock(index, "label")}>+ Label</button>
                <button type="button" style={styles.secondaryBtn} onClick={() => addTextBlock(index, "headline")}>+ Headline</button>
                <button type="button" style={styles.secondaryBtn} onClick={() => addTextBlock(index, "text")}>+ Text Block</button>
              </div>
            </div>
            {item.textBlocks.map((textBlock, blockIndex) => (
              <div key={textBlock.id || `${index}-text-${blockIndex}`} style={{ ...styles.sectionCard, padding: 10 }}>
                <div style={styles.linkRowHeader}>
                  <select
                    value={textBlock.type}
                    onChange={(event) => {
                      const nextType = event.target.value === "headline" ? "headline" : event.target.value === "label" ? "label" : "text";
                      updateTextBlock(index, blockIndex, { type: nextType });
                    }}
                    style={{ ...styles.propertyInput, maxWidth: 150 }}
                  >
                    <option value="label">Label</option>
                    <option value="headline">Headline</option>
                    <option value="text">Text block</option>
                  </select>
                  <button type="button" style={styles.linkRowDelete} onClick={() => removeTextBlock(index, blockIndex)}>Remove</button>
                </div>
                {textBlock.type === "headline" || textBlock.type === "label" ? (
                  <input
                    type="text"
                    value={textBlock.text}
                    onChange={(event) => updateTextBlock(index, blockIndex, { text: event.target.value })}
                    style={{ ...styles.propertyInput, marginTop: 8, fontWeight: textBlock.type === "headline" ? 700 : 600 }}
                    placeholder={textBlock.type === "label" ? "Label text" : "Headline text"}
                  />
                ) : (
                  <textarea
                    value={textBlock.text}
                    onChange={(event) => updateTextBlock(index, blockIndex, { text: event.target.value })}
                    style={{ ...styles.propertyInput, minHeight: 88, marginTop: 8, resize: "vertical" }}
                    placeholder="Text block"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      );})}
      <button type="button" style={styles.secondaryBtn} onClick={addItem}>+ Add Card</button>
    </div>
  );
}

function FeatureListPropertiesPanel({ block, index, onChange, brandAssets, onOpenImageEditor, onUploadImage }) {
  const props = block?.props || {};
  const update = (patch) => onChange(index, { ...props, ...patch });
  const [activeTab, setActiveTab] = useState("content");
  const [cardWidthDraft, setCardWidthDraft] = useState("");
  const [cardHeightDraft, setCardHeightDraft] = useState("");
  const featureStyleLabels = {
    cards: "Showcase Cards",
    "glass-cards": "Glass Gallery",
    "editorial-strip": "Editorial Split",
    "minimal-list": "Minimal Thumb List",
  };

  useEffect(() => {
    setCardWidthDraft(String(Math.max(220, Number(props.featureCardWidth) || 320)));
  }, [props.featureCardWidth]);

  useEffect(() => {
    setCardHeightDraft(String(Number(props.featureCardHeight) || ""));
  }, [props.featureCardHeight]);

  const commitCardWidthDraft = () => {
    const nextWidth = Math.max(220, Math.min(520, Number(cardWidthDraft || 0) || 320));
    const nextValue = String(nextWidth);
    setCardWidthDraft(nextValue);
    update({ featureCardWidth: nextWidth });
  };

  const commitCardHeightDraft = () => {
    const raw = Number(cardHeightDraft || 0);
    const next = raw > 0 ? Math.max(100, Math.min(1200, raw)) : 0;
    setCardHeightDraft(next > 0 ? String(next) : "");
    update({ featureCardHeight: next > 0 ? next : null });
  };

  const displayCardWidth = Math.max(220, Math.min(520, Number(cardWidthDraft || 0) || Number(props.featureCardWidth) || 320));

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>☰ Edit: List Block</h3>
      <div style={styles.tabRow}>
        {[
          { id: "content", label: "Content" },
          { id: "style", label: "Style" },
          { id: "colours", label: "Colours" },
          { id: "motion", label: "Motion" },
        ].map((tab) => (
          <button
            key={`feat-tab-${tab.id}`}
            type="button"
            style={{ ...styles.tabChip, ...(activeTab === tab.id ? styles.tabChipActive : {}) }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={styles.propertyGrid}>
        {activeTab === "content" ? (
          <>
            <div style={styles.sectionCard}>
              <label style={styles.propertyLabel}>Section Headline</label>
              <input
                type="text"
                value={htmlToPlainText(props.title || "")}
                onChange={(event) => update({ title: event.target.value })}
                style={styles.propertyInput}
                placeholder="Section headline"
              />
            </div>
            <div style={styles.sectionCard}>
              <label style={styles.propertyLabel}>Cards</label>
              <ListItemsEditor
                items={props.items}
                onChange={(items) => update({ items })}
                brandAssets={brandAssets}
                blockIndex={index}
                onUploadImage={onUploadImage}
                onOpenImageEditor={(itemIndex, imageKey, src) => onOpenImageEditor?.(index, "items", itemIndex, imageKey, src)}
              />
            </div>
          </>
        ) : null}
        {activeTab === "style" ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>List Style</label>
            <select value={String(props.featureVariant || "cards")} onChange={(e) => update({ featureVariant: e.target.value })} style={styles.propertyInput}>
              {getSelectOptions("featureVariant").map((option) => (
                <option key={option} value={option}>{featureStyleLabels[option] || option}</option>
              ))}
            </select>
            <label style={{ ...styles.propertyLabel, marginTop: 12, display: "block" }}>Background Width</label>
            <label style={styles.inlineToggle}>
              <input
                type="checkbox"
                checked={props.fullWidthBackground === true}
                onChange={(e) => update({ fullWidthBackground: e.target.checked })}
                style={styles.checkboxInput}
              />
              Full width background
            </label>
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
            <label style={{ ...styles.propertyLabel, marginTop: 12, display: "block" }}>
              Card Height (min): {cardHeightDraft ? `${cardHeightDraft}px` : "Auto"}
            </label>
            <input
              type="text"
              value={cardHeightDraft}
              onChange={(e) => setCardHeightDraft(String(e.target.value || "").replace(/[^\d]/g, ""))}
              onBlur={commitCardHeightDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitCardHeightDraft();
                }
              }}
              inputMode="numeric"
              placeholder="Auto"
              style={{ ...styles.propertyInput, marginTop: 8 }}
            />
          </div>
        ) : null}
        {activeTab === "colours" ? (
          <>
            <ColorSelector label="Section Background" value={props.backgroundColor || "#ffffff"} fallback="#ffffff" allowTransparent onChange={(v) => update({ backgroundColor: v })} />
            <input
              type="text"
              value={String(props.backgroundColor || "")}
              onChange={(e) => update({ backgroundColor: e.target.value })}
              style={styles.propertyInput}
              placeholder="Section background or CSS gradient"
            />
            <ColorSelector label="Item Background" value={props.itemBackgroundColor || "#eff6ff"} fallback="#eff6ff" allowTransparent onChange={(v) => update({ itemBackgroundColor: v })} />
            <ColorSelector label="Text" value={props.textColor || "#0f172a"} fallback="#0f172a" onChange={(v) => update({ textColor: v })} />
            <ColorSelector label="Accent / Icon" value={props.accentColor || "#2563eb"} fallback="#2563eb" onChange={(v) => update({ accentColor: v })} />
          </>
        ) : null}
        {activeTab === "motion" ? (
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Motion</label>
            <div style={styles.colorGrid}>
              <div style={styles.propertyField}>
                <label style={styles.propertyLabel}>Section</label>
                <select value={String(props.sectionAnimation || "fade-up")} onChange={(e) => update({ sectionAnimation: e.target.value })} style={styles.propertyInput}>
                  {ANIMATION_PRESETS.map((preset) => <option key={`list-section-${preset.value}`} value={preset.value}>{preset.label}</option>)}
                </select>
              </div>
              <div style={styles.propertyField}>
                <label style={styles.propertyLabel}>Cards</label>
                <select value={String(props.cardAnimation || "fade-up")} onChange={(e) => update({ cardAnimation: e.target.value })} style={styles.propertyInput}>
                  {ANIMATION_PRESETS.map((preset) => <option key={`list-card-${preset.value}`} value={preset.value}>{preset.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ ...styles.colorGrid, marginTop: 8 }}>
              <NumberField label="Section Speed" value={Math.round((Number(props.sectionAnimationSpeed ?? 0.8) || 0.8) * 100)} min={25} max={300} onChange={(value) => update({ sectionAnimationSpeed: Number((value / 100).toFixed(2)) })} />
              <NumberField label="Card Stagger" value={Math.round((Number(props.cardStagger ?? 0.08) || 0.08) * 100)} min={0} max={200} onChange={(value) => update({ cardStagger: Number((value / 100).toFixed(2)) })} />
            </div>
          </div>
        ) : null}
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
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => openSharedLibraryAssetPicker((asset) => updateImage(index, { src: asset.src || "", alt: asset.name || item.alt }))}
              >
                Choose From Library
              </button>
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
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Motion</label>
          <div style={styles.colorGrid}>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Section</label>
              <select value={String(props.sectionAnimation || "fade-up")} onChange={(e) => update({ sectionAnimation: e.target.value })} style={styles.propertyInput}>
                {ANIMATION_PRESETS.map((preset) => <option key={`gallery-section-${preset.value}`} value={preset.value}>{preset.label}</option>)}
              </select>
            </div>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Items</label>
              <select value={String(props.itemAnimation || "fade-up")} onChange={(e) => update({ itemAnimation: e.target.value })} style={styles.propertyInput}>
                {ANIMATION_PRESETS.map((preset) => <option key={`gallery-item-${preset.value}`} value={preset.value}>{preset.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ ...styles.colorGrid, marginTop: 8 }}>
            <NumberField label="Speed" value={Math.round((Number(props.sectionAnimationSpeed ?? 0.8) || 0.8) * 100)} min={25} max={300} onChange={(value) => update({ sectionAnimationSpeed: Number((value / 100).toFixed(2)) })} />
            <NumberField label="Stagger" value={Math.round((Number(props.itemStagger ?? 0.08) || 0.08) * 100)} min={0} max={200} onChange={(value) => update({ itemStagger: Number((value / 100).toFixed(2)) })} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PricingTablePropertiesPanel({ block, index, onChange, onUploadImage }) {
  const props = block?.props || {};
  const plans = normalizePricingPlans(props.plans);
  const replace = (nextProps) => onChange(index, nextProps);
  const update = (patch) => replace({ ...props, ...patch });
  const [activeTab, setActiveTab] = useState("content");
  const hotspots = Array.isArray(props.pricingImageHotspots) ? props.pricingImageHotspots : [];
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
  const updateHotspot = (hotspotIndex, patch) => {
    update({
      pricingImageHotspots: hotspots.map((spot, currentIndex) => (
        currentIndex === hotspotIndex ? { ...spot, ...patch } : spot
      )),
    });
  };
  const addHotspot = () => {
    update({
      pricingImageHotspots: [
        ...hotspots,
        {
          id: `pricing-hotspot-${Date.now()}`,
          label: `Button ${hotspots.length + 1}`,
          href: "",
          x: 8,
          y: 72,
          width: 20,
          height: 10,
          newTab: false,
        },
      ],
    });
  };
  const removeHotspot = (hotspotIndex) => {
    update({ pricingImageHotspots: hotspots.filter((_, currentIndex) => currentIndex !== hotspotIndex) });
  };

  return (
    <div style={styles.properties}>
      <div style={styles.propertiesHeaderRow}>
        <h3 style={styles.propertiesTitle}>💳 Edit: Pricing Table</h3>
        <button type="button" style={styles.ghostBtn} onClick={resetPricingTable}>Reset</button>
      </div>
      <div style={styles.tabRow}>
        {[
          { id: "content", label: "Content" },
          { id: "image", label: "Image & Links" },
          { id: "style", label: "Style" },
          { id: "colours", label: "Colours" },
          { id: "motion", label: "Motion" },
        ].map((tab) => (
          <button
            key={`pricing-tab-${tab.id}`}
            type="button"
            style={{ ...styles.tabChip, ...(activeTab === tab.id ? styles.tabChipActive : {}) }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={styles.propertyGrid}>
        {activeTab === "content" ? (
          <>
            <div style={{ ...styles.sectionCard, ...pricingSectionShells[0] }}>
              <label style={styles.propertyLabel}>Section Title</label>
              <input type="text" value={htmlToPlainText(props.title || "")} onChange={(e) => update({ title: htmlToPlainText(e.target.value) })} style={styles.propertyInput} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                <div>
                  <label style={styles.propertyLabel}>Currency Symbol</label>
                  <input type="text" value={String(props.currency || "$")} onChange={(e) => update({ currency: e.target.value })} style={styles.propertyInput} placeholder="$" />
                </div>
                <div>
                  <label style={styles.propertyLabel}>Default Period</label>
                  <input type="text" value={String(props.defaultPeriod || "month")} onChange={(e) => update({ defaultPeriod: e.target.value })} style={styles.propertyInput} placeholder="month / night / year…" />
                </div>
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
                            style={styles.checkboxInput}
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
                    <input type="text" value={String(plan.ctaUrl || "")} onChange={(e) => updatePlan(planIndex, { ctaUrl: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="Button URL (e.g. /signup?plan=starter)" />
                    <input type="text" value={String(plan.period || "")} onChange={(e) => updatePlan(planIndex, { period: e.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder={`Period override (default: ${props.defaultPeriod || "month"})`} />
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
          </>
        ) : null}
        {activeTab === "image" ? (
          <>
            <div style={{ ...styles.sectionCard, ...pricingSectionShells[1] }}>
              <label style={styles.propertyLabel}>Pricing Image</label>
              <label style={styles.assetUploadCta}>
                Upload Pricing Image
                <input
                  type="file"
                  accept="image/*"
                  style={styles.hiddenInput}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    const asset = await Promise.resolve(onUploadImage?.(index, "pricingImageUrl", file));
                    if (asset?.src) update({ pricingImageUrl: asset.src, pricingImageAlt: asset.name || props.pricingImageAlt || "Pricing options" });
                  }}
                />
              </label>
              <input
                type="text"
                value={String(props.pricingImageUrl || "")}
                onChange={(event) => update({ pricingImageUrl: event.target.value })}
                style={{ ...styles.propertyInput, marginTop: 10 }}
                placeholder="Or paste image URL"
              />
              <input
                type="text"
                value={String(props.pricingImageAlt || "")}
                onChange={(event) => update({ pricingImageAlt: event.target.value })}
                style={{ ...styles.propertyInput, marginTop: 8 }}
                placeholder="Image alt text"
              />
              <div style={{ marginTop: 10 }}>
                <NumberField label="Image Max Width" value={Number(props.pricingImageMaxWidth || 980)} min={240} max={1320} onChange={(value) => update({ pricingImageMaxWidth: value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                <div>
                  <label style={styles.propertyLabel}>Image Fit</label>
                  <select value={String(props.pricingImageFit || "contain")} onChange={(event) => update({ pricingImageFit: event.target.value })} style={styles.propertyInput}>
                    <option value="contain">Contain</option>
                    <option value="cover">Cover</option>
                  </select>
                </div>
                <div>
                  <label style={styles.propertyLabel}>Corner Radius</label>
                  <input
                    type="number"
                    value={Number(props.pricingImageRadius || 12)}
                    onChange={(event) => update({ pricingImageRadius: Number(event.target.value) || 0 })}
                    style={styles.propertyInput}
                    min={0}
                    max={48}
                  />
                </div>
              </div>
              {props.pricingImageUrl ? (
                <div style={{ marginTop: 12, border: "1px solid rgba(148,163,184,0.35)", borderRadius: 10, overflow: "hidden", background: "#020617" }}>
                  <img src={props.pricingImageUrl} alt="" style={{ display: "block", width: "100%", maxHeight: 240, objectFit: "contain" }} />
                </div>
              ) : null}
              {props.pricingImageUrl ? (
                <button type="button" style={{ ...styles.secondaryBtn, marginTop: 10, color: "#fca5a5" }} onClick={() => update({ pricingImageUrl: "" })}>Remove Pricing Image</button>
              ) : null}
            </div>
            <div style={{ ...styles.sectionCard, ...pricingSectionShells[3] }}>
              <div style={styles.linkRowHeader}>
                <label style={styles.propertyLabel}>Clickable Link Areas</label>
                <button type="button" style={styles.secondaryBtn} onClick={addHotspot}>+ Add Link Area</button>
              </div>
              <p style={{ margin: "0 0 10px", color: "#cbd5e1", fontSize: 14, lineHeight: 1.45 }}>
                Positions are percentages of the image: X/Y place the top-left corner, W/H control the clickable area size.
              </p>
              <div style={styles.propertyGrid}>
                {hotspots.map((spot, hotspotIndex) => (
                  <div key={spot.id || `pricing-hotspot-edit-${hotspotIndex}`} style={{ ...styles.linkRowCard, ...planEditorShells[hotspotIndex % planEditorShells.length] }}>
                    <div style={styles.linkRowHeader}>
                      <span style={styles.linkRowTitle}>{spot.label || `Link Area ${hotspotIndex + 1}`}</span>
                      <button type="button" style={styles.iconDeleteBtn} onClick={() => removeHotspot(hotspotIndex)} title="Delete link area">×</button>
                    </div>
                    <input type="text" value={String(spot.label || "")} onChange={(event) => updateHotspot(hotspotIndex, { label: event.target.value })} style={styles.propertyInput} placeholder="Label, e.g. Growth plan button" />
                    <input type="text" value={String(spot.href || "")} onChange={(event) => updateHotspot(hotspotIndex, { href: event.target.value })} style={{ ...styles.propertyInput, marginTop: 8 }} placeholder="/checkout?plan=growth or https://..." />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 8 }}>
                      {[
                        ["x", "X"],
                        ["y", "Y"],
                        ["width", "W"],
                        ["height", "H"],
                      ].map(([key, label]) => (
                        <label key={`hotspot-${hotspotIndex}-${key}`} style={{ display: "grid", gap: 4, color: "#cbd5e1", fontSize: 12, fontWeight: 800 }}>
                          {label} %
                          <input
                            type="number"
                            value={Number(spot[key] ?? (key === "width" ? 20 : key === "height" ? 8 : 0))}
                            onChange={(event) => updateHotspot(hotspotIndex, { [key]: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })}
                            style={styles.propertyInput}
                            min={0}
                            max={100}
                          />
                        </label>
                      ))}
                    </div>
                    <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
                      <input type="checkbox" checked={!!spot.newTab} onChange={(event) => updateHotspot(hotspotIndex, { newTab: event.target.checked })} style={styles.checkboxInput} />
                      Open in new tab
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
        {activeTab === "style" ? (
          <>
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
            <div style={{ ...styles.sectionCard, ...pricingSectionShells[3] }}>
              <label style={styles.propertyLabel}>Per-Plan Style</label>
              <div style={styles.propertyGrid}>
                {plans.map((plan, planIndex) => (
                  <div key={`plan-style-${planIndex}`} style={{ ...styles.linkRowCard, ...planEditorShells[planIndex % planEditorShells.length] }}>
                    <span style={{ ...styles.linkRowTitle, display: "block", marginBottom: 8 }}>{plan.name || `Plan ${planIndex + 1}`}</span>
                    <div style={{ marginBottom: 8 }}>
                      <label style={styles.propertyLabel}>Feature Icon</label>
                      <select value={String(plan.featureIcon || "tick")} onChange={(e) => updatePlan(planIndex, { featureIcon: e.target.value })} style={styles.propertyInput}>
                        {getSelectOptions("featureIcon").map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <CompactColorField label="Card Background" value={plan.cardBackgroundColor || (plan.highlighted ? (props.highlightedCardBackgroundColor || "#eff6ff") : (props.cardBackgroundColor || "#ffffff"))} fallback={plan.highlighted ? (props.highlightedCardBackgroundColor || "#eff6ff") : (props.cardBackgroundColor || "#ffffff")} onChange={(value) => updatePlan(planIndex, { cardBackgroundColor: value })} />
                    <div style={{ marginTop: 8 }}>
                      <CompactColorField label="Main Text" value={plan.textColor || (props.textColor || "#0f172a")} fallback={props.textColor || "#0f172a"} onChange={(value) => updatePlan(planIndex, { textColor: value })} />
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <CompactColorField label="Muted Text" value={plan.subtleTextColor || (props.subtleTextColor || "#64748b")} fallback={props.subtleTextColor || "#64748b"} onChange={(value) => updatePlan(planIndex, { subtleTextColor: value })} />
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <CompactColorField label="CTA Text" value={plan.ctaTextColor || (props.ctaTextColor || "#ffffff")} fallback={props.ctaTextColor || "#ffffff"} onChange={(value) => updatePlan(planIndex, { ctaTextColor: value })} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
        {activeTab === "colours" ? (
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
        ) : null}
        {activeTab === "motion" ? (
          <div style={{ ...styles.sectionCard, background: "linear-gradient(180deg,#102038,#14304f)", borderColor: "#2a5a8a" }}>
            <label style={styles.propertyLabel}>Motion</label>
            <div style={styles.colorGrid}>
              <div style={styles.propertyField}>
                <label style={styles.propertyLabel}>Section</label>
                <select value={String(props.sectionAnimation || "fade-up")} onChange={(e) => update({ sectionAnimation: e.target.value })} style={styles.propertyInput}>
                  {ANIMATION_PRESETS.map((preset) => <option key={`pricing-section-${preset.value}`} value={preset.value}>{preset.label}</option>)}
                </select>
              </div>
              <div style={styles.propertyField}>
                <label style={styles.propertyLabel}>Columns (default)</label>
                <select value={String(props.cardAnimation || "fade-up")} onChange={(e) => update({ cardAnimation: e.target.value })} style={styles.propertyInput}>
                  {ANIMATION_PRESETS.map((preset) => <option key={`pricing-card-${preset.value}`} value={preset.value}>{preset.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ ...styles.colorGrid, marginTop: 8 }}>
              <NumberField label="Section Speed" value={Math.round((Number(props.sectionAnimationSpeed ?? 0.8) || 0.8) * 100)} min={25} max={300} onChange={(value) => update({ sectionAnimationSpeed: Number((value / 100).toFixed(2)) })} />
              <NumberField label="Column Stagger" value={Math.round((Number(props.cardStagger ?? 0.08) || 0.08) * 100)} min={0} max={200} onChange={(value) => update({ cardStagger: Number((value / 100).toFixed(2)) })} />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={styles.propertyLabel}>Per-Plan Animation</label>
              <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                {plans.map((plan, planIndex) => (
                  <div key={`plan-motion-${planIndex}`} style={styles.propertyField}>
                    <label style={styles.propertyLabel}>{plan.name || `Plan ${planIndex + 1}`}</label>
                    <select
                      value={plan.cardAnimation || ""}
                      onChange={(e) => updatePlan(planIndex, { cardAnimation: e.target.value })}
                      style={styles.propertyInput}
                    >
                      <option value="">Default (use global)</option>
                      {ANIMATION_PRESETS.map((preset) => (
                        <option key={`plan-anim-${planIndex}-${preset.value}`} value={preset.value}>{preset.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
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

  function applySplitColorPreset(value) {
    if (String(value) === "blue") {
      update({
        splitColorPreset: "blue",
        headlineColor: "#7dd3fc",
        eyebrowColor: "linear-gradient(90deg, #0ea5e9 0%, #8b5cf6 100%)",
        chevronColor: "#ffffff",
        arrowBackgroundColor: "linear-gradient(135deg, #0c8ce9 0%, #6c5ce7 50%, #38bdf8 100%)",
      });
      return;
    }

    update({
      splitColorPreset: "green",
      headlineColor: "#61ce70",
      eyebrowColor: "linear-gradient(90deg, #22c55e 0%, #bef264 100%)",
      chevronColor: "#ffffff",
      arrowBackgroundColor: "linear-gradient(135deg, #163628 0%, #22c55e 52%, #bef264 100%)",
    });
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
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => openSharedLibraryAssetPicker((asset) => onSelectAsset(index, "backgroundImage", asset))}
            >
              Choose From Library
            </button>
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
          {props.backgroundImage ? (
            <>
              <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Background Position</label>
              <select value={String(props.backgroundPosition || "center center")} onChange={(e) => update({ backgroundPosition: e.target.value })} style={styles.propertyInput}>
                <option value="top center">Top</option>
                <option value="center center">Center</option>
                <option value="bottom center">Bottom</option>
                <option value="center left">Left</option>
                <option value="center right">Right</option>
                <option value="top left">Top Left</option>
                <option value="top right">Top Right</option>
                <option value="bottom left">Bottom Left</option>
                <option value="bottom right">Bottom Right</option>
              </select>
              <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Image Fit</label>
              <select value={String(props.backgroundSize || "cover")} onChange={(e) => update({ backgroundSize: e.target.value })} style={styles.propertyInput}>
                <option value="cover">Cover (fill &amp; crop)</option>
                <option value="contain">Contain (show full image)</option>
                <option value="100% auto">Full Width</option>
                <option value="auto">Auto</option>
              </select>
              <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
                <input type="checkbox" checked={String(props.backgroundRepeat || "no-repeat") !== "no-repeat"} onChange={(e) => update({ backgroundRepeat: e.target.checked ? "repeat" : "no-repeat" })} style={styles.checkboxInput} />
                Repeat image
              </label>
              <NumberField label="Overlay Opacity %" value={Number(props.backgroundOverlayOpacity ?? 55)} min={0} max={100} onChange={(value) => update({ backgroundOverlayOpacity: Number(value) })} />
            </>
          ) : null}
          <ColorSelector label="Block Background" value={props.blockBackgroundColor || "transparent"} fallback="#0f172a" allowTransparent onChange={(value) => update({ blockBackgroundColor: value })} />
          <ColorSelector label="Panel Background" value={props.faqPanelBackgroundColor || props.backgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ faqPanelBackgroundColor: value, backgroundColor: value })} />
          <ColorSelector label="Panel Border" value={props.borderColor || "#cbd5e1"} fallback="#cbd5e1" onChange={(value) => update({ borderColor: value })} />
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Accordion Cards</label>
          <div style={styles.colorGrid}>
            <NumberField label="Block Width" value={Number(props.faqMaxWidth || 980)} min={320} max={1800} onChange={(value) => update({ faqMaxWidth: value })} />
            <NumberField label="Question Size (px)" value={Number(props.questionFontSize || 18)} min={12} max={48} onChange={(value) => update({ questionFontSize: value })} />
            <NumberField label="Answer Size (px)" value={Number(props.answerFontSize || 15)} min={10} max={36} onChange={(value) => update({ answerFontSize: value })} />
          </div>
          <ColorSelector label="Question Color" value={props.questionColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ questionColor: value })} />
          <ColorSelector label="Answer Color" value={props.answerColor || props.textColor || "#475569"} fallback="#475569" onChange={(value) => update({ answerColor: value })} />
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={!!props.faqStartCollapsed}
              onChange={(e) => update({ faqStartCollapsed: e.target.checked })}
              style={styles.checkboxInput}
            />
            Collapse all items by default
          </label>
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={!!props.faqAllowMultipleOpen}
              onChange={(e) => update({ faqAllowMultipleOpen: e.target.checked })}
              style={styles.checkboxInput}
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
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Motion</label>
          <div style={styles.colorGrid}>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Section</label>
              <select value={String(props.sectionAnimation || "fade-up")} onChange={(e) => update({ sectionAnimation: e.target.value })} style={styles.propertyInput}>
                {ANIMATION_PRESETS.map((preset) => <option key={`faq-section-${preset.value}`} value={preset.value}>{preset.label}</option>)}
              </select>
            </div>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Items</label>
              <select value={String(props.itemAnimation || "fade-up")} onChange={(e) => update({ itemAnimation: e.target.value })} style={styles.propertyInput}>
                {ANIMATION_PRESETS.map((preset) => <option key={`faq-item-${preset.value}`} value={preset.value}>{preset.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ ...styles.colorGrid, marginTop: 8 }}>
            <NumberField label="Speed" value={Math.round((Number(props.sectionAnimationSpeed ?? 0.8) || 0.8) * 100)} min={25} max={300} onChange={(value) => update({ sectionAnimationSpeed: Number((value / 100).toFixed(2)) })} />
            <NumberField label="Stagger" value={Math.round((Number(props.itemStagger ?? 0.08) || 0.08) * 100)} min={0} max={200} onChange={(value) => update({ itemStagger: Number((value / 100).toFixed(2)) })} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SplitBlockPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage, onSelectAsset }) {
  const props = block?.props || {};
  const [activeTab, setActiveTab] = useState("content");
  const savedImages = [brandAssets?.logo, ...(Array.isArray(brandAssets?.images) ? brandAssets.images : [])].filter(Boolean).slice(0, 8);
  const headlineBlock = {
    ...(props.headlineBlock || {}),
    content: props.headlineBlock?.content ?? props.headline,
    animation: props.headlineBlock?.animation ?? props.textAnimation ?? "fade-up",
    animationDelay: props.headlineBlock?.animationDelay ?? props.textAnimationDelay ?? 0,
    animationSpeed: props.headlineBlock?.animationSpeed ?? props.textAnimationSpeed ?? 0.8,
    fontSize: props.headlineBlock?.fontSize ?? props.headlineFontSize ?? 48,
    lineHeight: props.headlineBlock?.lineHeight ?? props.headlineLineHeight ?? 1.2,
    fontFamily: props.headlineBlock?.fontFamily ?? props.headlineFontFamily ?? "Poppins, sans-serif",
    fontWeight: props.headlineBlock?.fontWeight ?? props.headlineFontWeight ?? "400",
    color: props.headlineBlock?.color ?? props.headlineColor ?? "#61ce70",
    alignment: props.headlineBlock?.alignment ?? props.headlineAlignment ?? "left",
  };
  const bodyBlock = {
    ...(props.bodyBlock || {}),
    content: props.bodyBlock?.content ?? props.subheadline,
    animation: props.bodyBlock?.animation ?? props.subheadlineAnimation ?? "fade-in",
    animationDelay: props.bodyBlock?.animationDelay ?? props.subheadlineAnimationDelay ?? 0.12,
    animationSpeed: props.bodyBlock?.animationSpeed ?? props.subheadlineAnimationSpeed ?? 0.9,
    fontSize: props.bodyBlock?.fontSize ?? props.subheadlineFontSize ?? props.textFontSize ?? 18,
    lineHeight: props.bodyBlock?.lineHeight ?? props.subheadlineLineHeight ?? props.textLineHeight ?? 1.6,
    fontFamily: props.bodyBlock?.fontFamily ?? props.fontFamily ?? "Arial",
    fontWeight: props.bodyBlock?.fontWeight ?? props.fontWeight ?? "400",
    color: props.bodyBlock?.color ?? props.textColor ?? "#bdbcbf",
    alignment: props.bodyBlock?.alignment ?? props.alignment ?? "left",
  };
  const faqBlock = {
    ...(props.faqBlock || {}),
    items: normalizeFaqItems(props.faqBlock?.items || props.items),
    faqStartCollapsed: props.faqBlock?.faqStartCollapsed ?? props.faqStartCollapsed,
    faqAllowMultipleOpen: props.faqBlock?.faqAllowMultipleOpen ?? props.faqAllowMultipleOpen,
    itemBackgroundColor: props.faqBlock?.itemBackgroundColor ?? props.itemBackgroundColor,
    itemBorderColor: props.faqBlock?.itemBorderColor ?? props.itemBorderColor,
    arrowBackgroundColor: props.faqBlock?.arrowBackgroundColor ?? props.arrowBackgroundColor,
    chevronColor: props.faqBlock?.chevronColor ?? props.chevronColor,
    questionFontSize: props.faqBlock?.questionFontSize ?? props.questionFontSize,
    answerFontSize: props.faqBlock?.answerFontSize ?? props.answerFontSize,
    questionLineHeight: props.faqBlock?.questionLineHeight ?? props.questionLineHeight,
    answerLineHeight: props.faqBlock?.answerLineHeight ?? props.answerLineHeight,
    faqPanelBackgroundColor: props.faqBlock?.faqPanelBackgroundColor ?? props.faqPanelBackgroundColor,
    faqMaxWidth: props.faqBlock?.faqMaxWidth ?? props.faqMaxWidth,
    sectionAnimation: props.faqBlock?.sectionAnimation ?? "fade-up",
    sectionAnimationDelay: props.faqBlock?.sectionAnimationDelay ?? 0.12,
    sectionAnimationSpeed: props.faqBlock?.sectionAnimationSpeed ?? 0.9,
    faqAnimation: props.faqBlock?.faqAnimation ?? props.faqAnimation ?? "fade-up",
    faqAnimationDelay: props.faqBlock?.faqAnimationDelay ?? props.faqAnimationDelay ?? 0.18,
    faqAnimationSpeed: props.faqBlock?.faqAnimationSpeed ?? props.faqAnimationSpeed ?? 0.9,
  };
  const items = faqBlock.items;
  const currentBackgroundPreview = resolveAssetField(props, "backgroundImage", brandAssets);

  function update(patch) {
    onChange(index, { ...props, ...patch });
  }

  function updateFaqBlock(patch) {
    onChange(index, {
      ...props,
      faqBlock: {
        ...(props.faqBlock || {}),
        ...patch,
      },
    });
  }

  function updateHeadlineBlock(patch) {
    const nextHeadlineBlock = {
      ...(props.headlineBlock || {}),
      ...patch,
    };
    const next = {
      ...props,
      headlineBlock: nextHeadlineBlock,
    };
    if (Object.prototype.hasOwnProperty.call(patch, "content")) next.headline = nextHeadlineBlock.content;
    if (Object.prototype.hasOwnProperty.call(patch, "animation")) next.textAnimation = nextHeadlineBlock.animation;
    if (Object.prototype.hasOwnProperty.call(patch, "animationDelay")) next.textAnimationDelay = nextHeadlineBlock.animationDelay;
    if (Object.prototype.hasOwnProperty.call(patch, "animationSpeed")) next.textAnimationSpeed = nextHeadlineBlock.animationSpeed;
    if (Object.prototype.hasOwnProperty.call(patch, "fontSize")) next.headlineFontSize = nextHeadlineBlock.fontSize;
    if (Object.prototype.hasOwnProperty.call(patch, "lineHeight")) next.headlineLineHeight = nextHeadlineBlock.lineHeight;
    if (Object.prototype.hasOwnProperty.call(patch, "fontFamily")) next.headlineFontFamily = nextHeadlineBlock.fontFamily;
    if (Object.prototype.hasOwnProperty.call(patch, "fontWeight")) next.headlineFontWeight = nextHeadlineBlock.fontWeight;
    if (Object.prototype.hasOwnProperty.call(patch, "color")) next.headlineColor = nextHeadlineBlock.color;
    if (Object.prototype.hasOwnProperty.call(patch, "alignment")) next.headlineAlignment = nextHeadlineBlock.alignment;
    onChange(index, next);
  }

  function updateBodyBlock(patch) {
    const nextBodyBlock = {
      ...(props.bodyBlock || {}),
      ...patch,
    };
    const next = {
      ...props,
      bodyBlock: nextBodyBlock,
    };
    if (Object.prototype.hasOwnProperty.call(patch, "content")) next.subheadline = nextBodyBlock.content;
    if (Object.prototype.hasOwnProperty.call(patch, "animation")) next.subheadlineAnimation = nextBodyBlock.animation;
    if (Object.prototype.hasOwnProperty.call(patch, "animationDelay")) next.subheadlineAnimationDelay = nextBodyBlock.animationDelay;
    if (Object.prototype.hasOwnProperty.call(patch, "animationSpeed")) next.subheadlineAnimationSpeed = nextBodyBlock.animationSpeed;
    if (Object.prototype.hasOwnProperty.call(patch, "fontSize")) {
      next.subheadlineFontSize = nextBodyBlock.fontSize;
      next.textFontSize = nextBodyBlock.fontSize;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "lineHeight")) {
      next.subheadlineLineHeight = nextBodyBlock.lineHeight;
      next.textLineHeight = nextBodyBlock.lineHeight;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "fontFamily")) next.fontFamily = nextBodyBlock.fontFamily;
    if (Object.prototype.hasOwnProperty.call(patch, "fontWeight")) next.fontWeight = nextBodyBlock.fontWeight;
    if (Object.prototype.hasOwnProperty.call(patch, "color")) next.textColor = nextBodyBlock.color;
    if (Object.prototype.hasOwnProperty.call(patch, "alignment")) next.alignment = nextBodyBlock.alignment;
    onChange(index, next);
  }

  function addItem() {
    updateFaqBlock({
      items: [
        ...items,
        createFaqItem(items.length),
      ],
    });
  }

  function updateItem(itemIndex, patch) {
    updateFaqBlock({
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
    updateFaqBlock({ items: items.filter((_, currentIndex) => currentIndex !== itemIndex) });
  }

  function moveItem(itemIndex, direction) {
    const nextIndex = itemIndex + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    const nextItems = [...items];
    const [movedItem] = nextItems.splice(itemIndex, 1);
    nextItems.splice(nextIndex, 0, movedItem);
    updateFaqBlock({ items: nextItems });
  }

  function applySplitColorPreset(value) {
    if (String(value) === "blue") {
      update({
        splitColorPreset: "blue",
        headlineColor: "#7dd3fc",
        eyebrowColor: "linear-gradient(90deg, #0ea5e9 0%, #8b5cf6 100%)",
        chevronColor: "#ffffff",
        arrowBackgroundColor: "linear-gradient(135deg, #0c8ce9 0%, #6c5ce7 50%, #38bdf8 100%)",
      });
      return;
    }

    update({
      splitColorPreset: "green",
      headlineColor: "#61ce70",
      eyebrowColor: "linear-gradient(90deg, #22c55e 0%, #bef264 100%)",
      chevronColor: "#ffffff",
      arrowBackgroundColor: "linear-gradient(135deg, #163628 0%, #22c55e 52%, #bef264 100%)",
    });
  }

  function renderAnimationControlCard(label, animationKey, delayKey, speedKey, defaults = {}) {
    return (
      <div style={styles.sectionCard}>
        <label style={styles.propertyLabel}>{label}</label>
        <select
          value={String(props?.[animationKey] || defaults.animation || "none")}
          onChange={(event) => update({ [animationKey]: event.target.value })}
          style={styles.propertyInput}
        >
          {ANIMATION_PRESETS.map((preset) => (
            <option key={`${animationKey}-${preset.value}`} value={preset.value}>{preset.label}</option>
          ))}
        </select>
        <div style={styles.colorGrid}>
          <NumberField
            label="Delay (s)"
            value={Number(props?.[delayKey] ?? defaults.delay ?? 0)}
            min={0}
            max={4}
            onChange={(value) => update({ [delayKey]: Number(value) })}
          />
          <NumberField
            label="Speed (s)"
            value={Number(props?.[speedKey] ?? defaults.speed ?? 0.9)}
            min={0.2}
            max={4}
            onChange={(value) => update({ [speedKey]: Number(value) })}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>↔️ Edit: Split Block</h3>
      <div style={styles.tabRow}>
        {[
          { id: "content", label: "Content" },
          { id: "layout", label: "Layout" },
          { id: "style", label: "Style" },
          { id: "faq", label: `FAQ (${items.length})` },
          { id: "animations", label: "Animations" },
        ].map((tab) => (
          <button
            key={`split-tab-${tab.id}`}
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
          <label style={styles.propertyLabel}>Parallax Side</label>
          {currentBackgroundPreview ? (
            <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
              <div style={{ width: "100%", minHeight: 148, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(148,163,184,0.24)", background: "#0f172a" }}>
                <img src={currentBackgroundPreview} alt="Split block background" style={{ width: "100%", height: 148, objectFit: props.backgroundSize === "contain" ? "contain" : "cover", display: "block" }} />
              </div>
              <div style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.5 }}>Current image used for the parallax half.</div>
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
                  update({ backgroundStyle: "image" });
                  onUploadImage(index, "backgroundImage", file);
                }}
              />
            </label>
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => openSharedLibraryAssetPicker((asset) => onSelectAsset(index, "backgroundImage", asset))}
            >
              Choose From Library
            </button>
            {savedImages.map((image) => (
              <button
                key={`split-bg-${image.id || image.src}`}
                type="button"
                style={styles.assetThumbBtn}
                onClick={() => onSelectAsset(index, "backgroundImage", image)}
                title={image.name}
              >
                <img src={image.src} alt={image.name} style={styles.assetThumbPreview} />
              </button>
            ))}
          </div>
          {(currentBackgroundPreview || props.backgroundImage || props.backgroundImageAssetId) ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <button type="button" style={styles.secondaryBtn} onClick={() => onChange(index, { ...props, backgroundImage: "", backgroundImageAssetId: undefined, enableParallax: false })}>Remove Background</button>
            </div>
          ) : null}
          <div style={styles.colorGrid}>
            <NumberField label="Section Height" value={parsePixelValue(props.minHeight, 760)} min={320} max={1600} onChange={(value) => update({ minHeight: `${value}px` })} />
            <select value={String(props.splitLayout || "43-57")} onChange={(event) => update({ splitLayout: event.target.value })} style={styles.propertyInput}>
              <option value="43-57">43 / 57</option>
              <option value="50-50">50 / 50</option>
              <option value="45-55">45 / 55</option>
              <option value="55-45">55 / 45</option>
            </select>
          </div>
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={props.fullWidthBackground !== false}
              onChange={(e) => update({ fullWidthBackground: e.target.checked })}
              style={styles.checkboxInput}
            />
            Full width section
          </label>
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={!!props.enableParallax}
              onChange={(e) => update({ enableParallax: e.target.checked })}
              style={styles.checkboxInput}
            />
            Enable parallax image half
          </label>
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={!!props.headlineOverImage}
              onChange={(e) => update({ headlineOverImage: e.target.checked })}
              style={styles.checkboxInput}
            />
            Headline over image
          </label>
          {!!props.headlineOverImage && (
            <div style={styles.colorGrid}>
              <label style={styles.propertyLabel}>Headline vertical position</label>
              <select value={props.headlineOverImageAlign || "flex-end"} onChange={(e) => update({ headlineOverImageAlign: e.target.value })} style={styles.propertyInput}>
                <option value="flex-start">Top</option>
                <option value="center">Middle</option>
                <option value="flex-end">Bottom</option>
              </select>
            </div>
          )}
          <div style={styles.colorGrid}>
            <ColorSelector label="Image Overlay Colour" value={props.imageOverlayColor || "#000000"} fallback="#000000" onChange={(value) => update({ imageOverlayColor: value })} />
            <NumberField label="Image Overlay %" value={Number(props.imageOverlayOpacity || 0)} min={0} max={100} onChange={(value) => update({ imageOverlayOpacity: Number(value) })} />
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Background Position</label>
          <select value={String(props.backgroundPosition || "center center")} onChange={(event) => update({ backgroundPosition: event.target.value, backgroundStyle: "image" })} style={styles.propertyInput}>
            <option value="top center">Top</option>
            <option value="center center">Middle</option>
            <option value="bottom center">Bottom</option>
            <option value="center left">Left</option>
            <option value="center right">Right</option>
          </select>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Image Fit</label>
          <select value={String(props.backgroundSize || "cover")} onChange={(event) => update({ backgroundSize: event.target.value, backgroundStyle: "image" })} style={styles.propertyInput}>
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </select>
          <div style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.5, marginTop: 8 }}>
            Use Cover to fill the whole half and crop the edges. Use Contain to keep the full image visible.
          </div>
        </div>
        ) : null}

        {activeTab === "content" ? (
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Content Side</label>
          <input
            type="text"
            value={String(props.eyebrow || "")}
            onChange={(event) => update({ eyebrow: event.target.value })}
            style={styles.propertyInput}
            placeholder="Small label"
          />
          <textarea
            value={htmlToPlainText(headlineBlock.content || "")}
            onChange={(event) => updateHeadlineBlock({ content: event.target.value })}
            style={{ ...styles.propertyInput, minHeight: 88, resize: "vertical", marginTop: 8 }}
            placeholder="Headline"
          />
          <textarea
            value={htmlToPlainText(bodyBlock.content || "")}
            onChange={(event) => updateBodyBlock({ content: event.target.value })}
            style={{ ...styles.propertyInput, minHeight: 110, resize: "vertical", marginTop: 8 }}
            placeholder="Supporting copy"
          />
        </div>
        ) : null}

        {activeTab === "style" ? (
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Content Styling</label>
          <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
            <label style={styles.propertyLabel}>Color Styles</label>
            <select
              value={String(props.splitColorPreset || "green")}
              onChange={(event) => applySplitColorPreset(event.target.value)}
              style={styles.propertyInput}
            >
              <option value="green">Green</option>
              <option value="blue">Blue</option>
            </select>
          </div>
          <ColorSelector label="Section Background" value={props.sectionBackgroundColor || "#f8fafc"} fallback="#f8fafc" onChange={(value) => update({ sectionBackgroundColor: value })} />
          <div style={styles.colorGrid}>
            <ColorSelector label="Section Overlay Colour" value={props.sectionOverlayColor || "#000000"} fallback="#000000" onChange={(value) => update({ sectionOverlayColor: value })} />
            <NumberField label="Section Overlay %" value={Number(props.sectionOverlayOpacity || 0)} min={0} max={100} onChange={(value) => update({ sectionOverlayOpacity: Number(value) })} />
          </div>
          <ColorSelector label="Content Panel" value={props.contentPanelBackgroundColor || ""} fallback="#ffffff" allowTransparent={true} onChange={(value) => update({ contentPanelBackgroundColor: value })} />
          <NumberField label="Text Overlap %" value={Number(props.textPanelOverlap || 0)} min={0} max={40} onChange={(value) => update({ textPanelOverlap: Number(value) })} />
          <ColorSelector label="FAQ Block Background" value={props.faqPanelBackgroundColor || "rgba(3, 18, 28, 0.26)"} fallback="#0f172a" onChange={(value) => update({ faqPanelBackgroundColor: value })} />
          <ColorSelector label="Eyebrow Gradient / Rule" value={props.eyebrowColor || "linear-gradient(15deg, rgb(12, 140, 233) 15%, rgb(108, 92, 231) 10%, rgb(18, 213, 187) 45%, rgb(28, 165, 241) 130%)"} fallback="#0ea5e9" onChange={(value) => update({ eyebrowColor: value })} />
          <ColorSelector label="Headline Color" value={headlineBlock.color || "#0f172a"} fallback="#0f172a" onChange={(value) => updateHeadlineBlock({ color: value })} />
          <ColorSelector label="Body Color" value={bodyBlock.color || "#475569"} fallback="#475569" onChange={(value) => updateBodyBlock({ color: value })} />
          <div style={styles.colorGrid}>
            <NumberField label="Headline Size" value={Number(headlineBlock.fontSize || 48)} min={20} max={120} onChange={(value) => updateHeadlineBlock({ fontSize: value })} />
            <NumberField label="Headline Line Height" value={Number(headlineBlock.lineHeight || 1.2)} min={0.8} max={3} onChange={(value) => updateHeadlineBlock({ lineHeight: Number(value) })} />
          </div>
          <div style={styles.colorGrid}>
            <NumberField label="Body Size" value={Number(bodyBlock.fontSize || 18)} min={12} max={42} onChange={(value) => updateBodyBlock({ fontSize: Number(value) })} />
            <NumberField label="Body Line Height" value={Number(bodyBlock.lineHeight || 1.6)} min={1} max={3} onChange={(value) => updateBodyBlock({ lineHeight: Number(value) })} />
          </div>
          <div style={styles.colorGrid}>
            <NumberField label="FAQ Width" value={Number(faqBlock.faqMaxWidth || props.faqMaxWidth || 720)} min={280} max={1200} onChange={(value) => updateFaqBlock({ faqMaxWidth: value })} />
            <div />
          </div>
        </div>
        ) : null}

        {activeTab === "faq" ? (
        <>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Nested FAQ Block</label>
          <div style={styles.colorGrid}>
            <NumberField label="Question Size" value={Number(faqBlock.questionFontSize || 24)} min={16} max={44} onChange={(value) => updateFaqBlock({ questionFontSize: value })} />
            <NumberField label="Answer Size" value={Number(faqBlock.answerFontSize || 18)} min={12} max={32} onChange={(value) => updateFaqBlock({ answerFontSize: value })} />
          </div>
          <div style={styles.colorGrid}>
            <NumberField label="Question Line Height" value={Number(faqBlock.questionLineHeight || 1.4)} min={1} max={3} onChange={(value) => updateFaqBlock({ questionLineHeight: Number(value) })} />
            <NumberField label="Answer Line Height" value={Number(faqBlock.answerLineHeight || 1.6)} min={1} max={3} onChange={(value) => updateFaqBlock({ answerLineHeight: Number(value) })} />
          </div>
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={!!faqBlock.faqStartCollapsed}
              onChange={(e) => updateFaqBlock({ faqStartCollapsed: e.target.checked })}
              style={styles.checkboxInput}
            />
            Collapse all items by default
          </label>
          <label style={{ ...styles.inlineToggle, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={!!faqBlock.faqAllowMultipleOpen}
              onChange={(e) => updateFaqBlock({ faqAllowMultipleOpen: e.target.checked })}
              style={styles.checkboxInput}
            />
            Allow multiple items open
          </label>
          <ColorSelector label="FAQ Block Background" value={faqBlock.faqPanelBackgroundColor || "rgba(3, 18, 28, 0.26)"} fallback="#0f172a" onChange={(value) => updateFaqBlock({ faqPanelBackgroundColor: value })} />
          <ColorSelector label="Item Background" value={faqBlock.itemBackgroundColor || "#ffffff"} fallback="#ffffff" onChange={(value) => updateFaqBlock({ itemBackgroundColor: value })} />
          <ColorSelector label="Item Border" value={faqBlock.itemBorderColor || "#cbd5e1"} fallback="#cbd5e1" onChange={(value) => updateFaqBlock({ itemBorderColor: value })} />
          <ColorSelector label="Arrow Background" value={faqBlock.arrowBackgroundColor || "linear-gradient(135deg, #163628 0%, #22c55e 52%, #bef264 100%)"} fallback="#22c55e" onChange={(value) => updateFaqBlock({ arrowBackgroundColor: value })} />
          <ColorSelector label="Chevron Color" value={faqBlock.chevronColor || "#2563eb"} fallback="#2563eb" onChange={(value) => updateFaqBlock({ chevronColor: value })} />
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>FAQ Items</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={styles.secondaryBtn} onClick={addItem}>+ Add New Question</button>
          </div>
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {items.length ? items.map((item, itemIndex) => (
              <div key={item.id || `split-item-${itemIndex}`} style={styles.sectionCard}>
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
        </>
        ) : null}

        {activeTab === "animations" ? (
        <>
          {renderAnimationControlCard("Section Entrance", "sectionAnimation", "sectionAnimationDelay", "sectionAnimationSpeed", { animation: "fade-up", delay: 0.06, speed: 0.9 })}
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Left Panel (Image Column)</label>
            <select value={String(props.leftPanelAnimation || "none")} onChange={(event) => update({ leftPanelAnimation: event.target.value })} style={styles.propertyInput}>
              {ANIMATION_PRESETS.map((preset) => <option key={`split-left-${preset.value}`} value={preset.value}>{preset.label}</option>)}
            </select>
            <div style={styles.colorGrid}>
              <NumberField label="Delay (s)" value={Number(props.leftPanelAnimationDelay ?? 0)} min={0} max={4} onChange={(value) => update({ leftPanelAnimationDelay: Number(value) })} />
              <NumberField label="Speed (s)" value={Number(props.leftPanelAnimationSpeed ?? 0.9)} min={0.2} max={4} onChange={(value) => update({ leftPanelAnimationSpeed: Number(value) })} />
            </div>
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Right Panel (Content Column)</label>
            <select value={String(props.rightPanelAnimation || "none")} onChange={(event) => update({ rightPanelAnimation: event.target.value })} style={styles.propertyInput}>
              {ANIMATION_PRESETS.map((preset) => <option key={`split-right-${preset.value}`} value={preset.value}>{preset.label}</option>)}
            </select>
            <div style={styles.colorGrid}>
              <NumberField label="Delay (s)" value={Number(props.rightPanelAnimationDelay ?? 0)} min={0} max={4} onChange={(value) => update({ rightPanelAnimationDelay: Number(value) })} />
              <NumberField label="Speed (s)" value={Number(props.rightPanelAnimationSpeed ?? 0.9)} min={0.2} max={4} onChange={(value) => update({ rightPanelAnimationSpeed: Number(value) })} />
            </div>
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Headline Block</label>
            <select value={String(headlineBlock.animation || "fade-up")} onChange={(event) => updateHeadlineBlock({ animation: event.target.value })} style={styles.propertyInput}>
              {ANIMATION_PRESETS.map((preset) => <option key={`split-headline-${preset.value}`} value={preset.value}>{preset.label}</option>)}
            </select>
            <div style={styles.colorGrid}>
              <NumberField label="Delay (s)" value={Number(headlineBlock.animationDelay ?? 0)} min={0} max={4} onChange={(value) => updateHeadlineBlock({ animationDelay: Number(value) })} />
              <NumberField label="Speed (s)" value={Number(headlineBlock.animationSpeed ?? 0.8)} min={0.2} max={4} onChange={(value) => updateHeadlineBlock({ animationSpeed: Number(value) })} />
            </div>
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Body Block</label>
            <select value={String(bodyBlock.animation || "fade-in")} onChange={(event) => updateBodyBlock({ animation: event.target.value })} style={styles.propertyInput}>
              {ANIMATION_PRESETS.map((preset) => <option key={`split-body-${preset.value}`} value={preset.value}>{preset.label}</option>)}
            </select>
            <div style={styles.colorGrid}>
              <NumberField label="Delay (s)" value={Number(bodyBlock.animationDelay ?? 0.12)} min={0} max={4} onChange={(value) => updateBodyBlock({ animationDelay: Number(value) })} />
              <NumberField label="Speed (s)" value={Number(bodyBlock.animationSpeed ?? 0.9)} min={0.2} max={4} onChange={(value) => updateBodyBlock({ animationSpeed: Number(value) })} />
            </div>
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Nested FAQ Block</label>
            <select value={String(faqBlock.sectionAnimation || "fade-up")} onChange={(event) => updateFaqBlock({ sectionAnimation: event.target.value })} style={styles.propertyInput}>
              {ANIMATION_PRESETS.map((preset) => <option key={`split-faq-block-${preset.value}`} value={preset.value}>{preset.label}</option>)}
            </select>
            <div style={styles.colorGrid}>
              <NumberField label="Delay (s)" value={Number(faqBlock.sectionAnimationDelay ?? 0.12)} min={0} max={4} onChange={(value) => updateFaqBlock({ sectionAnimationDelay: Number(value) })} />
              <NumberField label="Speed (s)" value={Number(faqBlock.sectionAnimationSpeed ?? 0.9)} min={0.2} max={4} onChange={(value) => updateFaqBlock({ sectionAnimationSpeed: Number(value) })} />
            </div>
          </div>
          <div style={styles.sectionCard}>
            <label style={styles.propertyLabel}>Nested Accordion Items</label>
            <select value={String(faqBlock.faqAnimation || "fade-up")} onChange={(event) => updateFaqBlock({ faqAnimation: event.target.value })} style={styles.propertyInput}>
              {ANIMATION_PRESETS.map((preset) => <option key={`split-faq-items-${preset.value}`} value={preset.value}>{preset.label}</option>)}
            </select>
            <div style={styles.colorGrid}>
              <NumberField label="Delay (s)" value={Number(faqBlock.faqAnimationDelay ?? 0.18)} min={0} max={4} onChange={(value) => updateFaqBlock({ faqAnimationDelay: Number(value) })} />
              <NumberField label="Speed (s)" value={Number(faqBlock.faqAnimationSpeed ?? 0.9)} min={0.2} max={4} onChange={(value) => updateFaqBlock({ faqAnimationSpeed: Number(value) })} />
            </div>
          </div>
        </>
        ) : null}
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
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => openSharedLibraryAssetPicker((asset) => onSelectAsset(index, "src", asset))}
            >
              Choose From Library
            </button>
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
                headline: props.headline,
                subheadline: props.subheadline,
              })}
              style={styles.checkboxInput}
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
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Motion</label>
          <div style={styles.colorGrid}>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Section</label>
              <select value={String(props.sectionAnimation || "fade-up")} onChange={(e) => update({ sectionAnimation: e.target.value })} style={styles.propertyInput}>
                {ANIMATION_PRESETS.map((preset) => <option key={`image-section-${preset.value}`} value={preset.value}>{preset.label}</option>)}
              </select>
            </div>
            <NumberField label="Speed" value={Math.round((Number(props.sectionAnimationSpeed ?? 0.8) || 0.8) * 100)} min={25} max={300} onChange={(value) => update({ sectionAnimationSpeed: Number((value / 100).toFixed(2)) })} />
          </div>
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
          style={styles.checkboxInput}
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
        <button
          type="button"
          style={styles.secondaryBtn}
          onClick={() => openSharedLibraryAssetPicker((asset) => {
            onSelectAsset(index, "logo", asset);
            update({ showLogo: true });
          })}
        >
          Choose From Library
        </button>
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

function NavbarPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage, onSelectAsset, pages = [] }) {
  const props = block.props || {};
  const [section, setSection] = useState("setup");
  const navbarSectionShells = [
    { background: "linear-gradient(180deg, #1f3048 0%, #18283d 100%)", borderColor: "rgba(125,211,252,0.28)" },
    { background: "linear-gradient(180deg, #243148 0%, #1a2436 100%)", borderColor: "rgba(167,139,250,0.24)" },
    { background: "linear-gradient(180deg, #223741 0%, #17262f 100%)", borderColor: "rgba(74,222,128,0.22)" },
    { background: "linear-gradient(180deg, #3a2b45 0%, #241b30 100%)", borderColor: "rgba(244,114,182,0.18)" },
  ];
  const sections = [
    { id: "setup", label: "Setup" },
    { id: "brand", label: "Brand" },
    { id: "menu", label: "Menu" },
    { id: "style", label: "Style" },
  ];

  function update(patch) {
    onChange(index, { ...props, ...patch });
  }

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🎨 Edit: Navigation Bar</h3>
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
        {section === "setup" ? (
          <>
            <div style={{ ...styles.sectionCard, ...navbarSectionShells[0] }}>
              <label style={styles.propertyLabel}>Navbar Style</label>
              <NavbarPresetPicker value={props.variant || "split-dark"} onApply={update} />
            </div>

            <div style={{ ...styles.sectionCard, ...navbarSectionShells[1] }}>
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

            <div style={{ ...styles.sectionCard, ...navbarSectionShells[2] }}>
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
          </>
        ) : null}

        {section === "brand" ? (
          <>
            <div style={{ ...styles.sectionCard, ...navbarSectionShells[3] }}>
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

            <div style={{ ...styles.sectionCard, ...navbarSectionShells[2] }}>
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
          </>
        ) : null}

        {section === "menu" ? (
          <>
            <div style={{ ...styles.sectionCard, ...navbarSectionShells[0] }}>
              <label style={styles.propertyLabel}>Navigation Links</label>
              <NavbarLinksEditor
                links={props.links}
                pages={pages}
                onChange={(links) => update({ links })}
              />
            </div>

            <div style={{ ...styles.sectionCard, ...navbarSectionShells[1] }}>
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
          </>
        ) : null}

        {section === "style" ? (
          <>
            <div style={{ ...styles.sectionCard, ...navbarSectionShells[3] }}>
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
              <div style={{ ...styles.colorGrid, marginTop: 10 }}>
                <CompactColorField label="Hover Background" value={props.linkHoverBackgroundColor || "#334155"} fallback="#334155" onChange={(value) => update({ linkHoverBackgroundColor: value })} />
                <CompactColorField label="Hover Text" value={props.linkHoverTextColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ linkHoverTextColor: value })} />
                <CompactColorField label="Highlighted Background" value={props.activeLinkBackgroundColor || "#475569"} fallback="#475569" onChange={(value) => update({ activeLinkBackgroundColor: value })} />
                <CompactColorField label="Highlighted Text" value={props.activeLinkTextColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ activeLinkTextColor: value })} />
              </div>
            </div>

            <div style={{ ...styles.sectionCard, ...navbarSectionShells[0] }}>
              <label style={styles.propertyLabel}>Navbar Colours</label>
              <div style={styles.colorGrid}>
                <CompactColorField label="Navbar Background" value={props.backgroundColor || "#0b1220"} fallback="#0b1220" onChange={(value) => update({ backgroundColor: value })} />
                <CompactColorField label="Navbar Text" value={props.textColor || "#e2e8f0"} fallback="#e2e8f0" onChange={(value) => update({ textColor: value })} />
                <CompactColorField label="Navbar Border" value={rgbToHex(props.borderColor || "rgba(148,163,184,0.24)", "#94a3b8")} fallback="#94a3b8" onChange={(value) => update({ borderColor: value })} />
                <CompactColorField label="Button Background" value={props.buttonColor || "#ffffff"} fallback="#ffffff" onChange={(value) => update({ buttonColor: value })} />
                <CompactColorField label="Button Text" value={props.buttonTextColor || "#0f172a"} fallback="#0f172a" onChange={(value) => update({ buttonTextColor: value })} />
              </div>
            </div>
          </>
        ) : null}
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

function formatSavedAgo(ts) {
  if (!ts) return "";
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
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
  const pageBackground = pickGlobalStyleValue(blocks, ["pageBackground"], "#ffffff");
  const sectionBackground = pickGlobalStyleValue(blocks, ["backgroundColor"], "#0f172a");
  const buttonTextColor = pickGlobalStyleValue(blocks, ["buttonTextColor"], "#ffffff");
  const cardBackgroundColor = pickGlobalStyleValue(blocks, ["cardBackgroundColor", "itemBackgroundColor"], "#f8fafc");
  const buttonRadius = Number(pickGlobalStyleValue(blocks, ["buttonRadius"], 999));
  const pageWidth = Number(pickGlobalStyleValue(blocks, ["baseLayoutWidth"], 1500));
  const layoutMode = blocks.some((block) => isFullWidthBackgroundEnabled(block)) ? "full" : "contained";
  const textAlign = pickGlobalStyleValue(blocks, ["headlineAlignment", "alignment"], "left");
  const colorSchemes = [
    { id: "coastal", label: "Coastal Blue", patch: { primaryColor: "#0ea5e9", headingColor: "#082f49", bodyColor: "#164e63", pageBackground: "linear-gradient(180deg,#f0f9ff 0%,#dbeafe 48%,#eff6ff 100%)", cardBackgroundColor: "rgba(255,255,255,0.82)", buttonTextColor: "#ffffff" } },
    { id: "graphite", label: "Graphite Gold", patch: { primaryColor: "#d4a017", headingColor: "#f8fafc", bodyColor: "#cbd5e1", pageBackground: "linear-gradient(180deg,#020617 0%,#111827 52%,#1f2937 100%)", cardBackgroundColor: "rgba(15,23,42,0.76)", buttonTextColor: "#111827" } },
    { id: "forest", label: "Forest Sage", patch: { primaryColor: "#2f855a", headingColor: "#16311f", bodyColor: "#355244", pageBackground: "linear-gradient(180deg,#f0fdf4 0%,#dcfce7 46%,#bbf7d0 100%)", cardBackgroundColor: "rgba(255,255,255,0.72)", buttonTextColor: "#ffffff" } },
    { id: "terracotta", label: "Terracotta Sand", patch: { primaryColor: "#c2410c", headingColor: "#431407", bodyColor: "#7c5a4a", pageBackground: "linear-gradient(180deg,#fff7ed 0%,#fed7aa 55%,#fdba74 100%)", cardBackgroundColor: "rgba(255,247,237,0.78)", buttonTextColor: "#fff7ed" } },
    { id: "ink", label: "Ink Cyan", patch: { primaryColor: "#06b6d4", headingColor: "#ecfeff", bodyColor: "#bae6fd", pageBackground: "radial-gradient(circle at top,#164e63 0%,#082f49 42%,#020617 100%)", cardBackgroundColor: "rgba(8,47,73,0.72)", buttonTextColor: "#083344" } },
    { id: "rose", label: "Rose Linen", patch: { primaryColor: "#e11d48", headingColor: "#4c0519", bodyColor: "#881337", pageBackground: "linear-gradient(180deg,#fff1f2 0%,#ffe4e6 52%,#fecdd3 100%)", cardBackgroundColor: "rgba(255,255,255,0.68)", buttonTextColor: "#fff1f2" } },
  ];
  const quickThemePresets = [
    { id: "midnight-editorial", label: "Midnight Editorial", patch: { primaryColor: "#f59e0b", headingColor: "#f8fafc", bodyColor: "#cbd5e1", pageBackground: "linear-gradient(135deg,#09111f,#14253d 58%,#1d4ed8)", cardBackgroundColor: "rgba(15,23,42,0.86)", buttonTextColor: "#0f172a" } },
    { id: "linen-studio", label: "Linen Studio", patch: { primaryColor: "#9a3412", headingColor: "#2f241b", bodyColor: "#6b5a4c", pageBackground: "linear-gradient(180deg,#fff8ef,#f3e4cf)", cardBackgroundColor: "#fffaf2", buttonTextColor: "#fffaf2" } },
    { id: "electric-cyan", label: "Electric Cyan", patch: { primaryColor: "#22d3ee", headingColor: "#ecfeff", bodyColor: "#bae6fd", pageBackground: "radial-gradient(circle at top,#164e63 0%,#082f49 45%,#020617 100%)", cardBackgroundColor: "rgba(8,47,73,0.84)", buttonTextColor: "#083344" } },
    { id: "terracotta-sun", label: "Terracotta Sun", patch: { primaryColor: "#ea580c", headingColor: "#431407", bodyColor: "#7c2d12", pageBackground: "linear-gradient(180deg,#fff7ed,#fed7aa)", cardBackgroundColor: "#ffedd5", buttonTextColor: "#fff7ed" } },
    { id: "emerald-brand", label: "Emerald Brand", patch: { primaryColor: "#15803d", headingColor: "#052e16", bodyColor: "#14532d", pageBackground: "linear-gradient(180deg,#ecfdf5,#bbf7d0)", cardBackgroundColor: "#dcfce7", buttonTextColor: "#f0fdf4" } },
    { id: "mono-minimal", label: "Mono Minimal", patch: { primaryColor: "#111827", headingColor: "#0f172a", bodyColor: "#334155", pageBackground: "#e5e7eb", cardBackgroundColor: "#ffffff", buttonTextColor: "#ffffff" } },
  ];
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
            <ColorSelector label="Whole Site Background" value={pageBackground} fallback="#ffffff" allowTransparent onChange={(value) => onApplyGlobal({ pageBackground: value })} />
            <ColorSelector label="Button Text Colour" value={buttonTextColor} fallback="#ffffff" onChange={(value) => onApplyGlobal({ buttonTextColor: value })} />
            <div style={styles.sectionCard}>
              <label style={styles.propertyLabel}>Standard Colour Schemes</label>
              <div style={styles.presetGrid}>
                {colorSchemes.map((scheme) => (
                  <button key={scheme.id} type="button" style={styles.presetChip} onClick={() => onApplyGlobal(scheme.patch)}>
                    {scheme.label}
                  </button>
                ))}
              </div>
            </div>
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
              <NumberField label="Page Width" value={pageWidth} min={720} max={5600} onChange={(value) => onApplyGlobal({ pageWidth: value })} />
              <NumberField label="Button Radius" value={buttonRadius >= 999 ? 32 : buttonRadius} min={0} max={40} onChange={(value) => onApplyGlobal({ buttonRadius: value >= 32 ? 999 : value })} />
            </div>
          </div>
        ) : null}

        {section === "page" ? (
          <>
            <ColorSelector label="Whole Page Background" value={pageBackground} fallback="#ffffff" allowTransparent onChange={(value) => onApplyGlobal({ pageBackground: value })} />
            <ColorSelector label="Site Surface" value={cardBackgroundColor} fallback="#f8fafc" onChange={(value) => onApplyGlobal({ cardBackgroundColor: value })} />
            <div style={styles.sectionCard}>
              <label style={styles.propertyLabel}>Quick Theme Presets</label>
              <div style={styles.presetGrid}>
                {quickThemePresets.map((preset) => (
                  <button key={preset.id} type="button" style={styles.presetChip} onClick={() => onApplyGlobal(preset.patch)}>{preset.label}</button>
                ))}
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


// ─── Icon Counter Properties Panel ───────────────────────────────────────────
const IC_FONT_OPTIONS = [
  { value: "inherit", label: "Default (site font)" },
  { value: "Poppins", label: "Poppins" },
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Oswald", label: "Oswald" },
  { value: "Bebas Neue", label: "Bebas Neue" },
  { value: "Arial", label: "Arial" },
  { value: "Georgia", label: "Georgia" },
  { value: "Tahoma", label: "Tahoma" },
  { value: "Trebuchet MS", label: "Trebuchet MS" },
  { value: "Lato", label: "Lato" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Nunito", label: "Nunito" },
  { value: "Playfair Display", label: "Playfair Display" },
];

function IconCounterPropertiesPanel({ block, index, onChange }) {
  const props = block?.props || {};
  const update = (patch) => onChange(index, { ...props, ...patch });

  const selectStyle = {
    width: "100%",
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(30,41,59,0.8)",
    color: "#e2e8f0",
    fontSize: 16,
    marginTop: 4,
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🔢 Edit: Site Visit Counter</h3>
      <div style={styles.propertyGrid}>

        {/* Content */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Content</label>
          <div style={styles.propertyRow}>
            <label style={styles.propertyLabel}>Label text</label>
            <input
              type="text"
              value={props.label ?? "Site Visits...and counting"}
              style={styles.propertyInput}
              placeholder="e.g. Site Visits...and counting"
              onChange={(e) => update({ label: e.target.value })}
            />
          </div>
          <div style={{ ...styles.colorGrid, marginTop: 8 }}>
            <NumberField label="Target number" value={Number(props.targetNumber ?? 0)} min={0} max={9999999} onChange={(v) => update({ targetNumber: v })} />
            <NumberField label="Start number" value={Number(props.startNumber ?? 0)} min={0} max={9999999} onChange={(v) => update({ startNumber: v })} />
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={styles.propertyLabel}>Suffix (e.g. +, %)</label>
            <input
              type="text"
              value={props.suffix ?? ""}
              style={styles.propertyInput}
              placeholder="e.g. + or %"
              onChange={(e) => update({ suffix: e.target.value })}
            />
          </div>
        </div>

        {/* Number styling */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Number styling</label>
          <div style={styles.colorGrid}>
            <NumberField label="Font size (px)" value={Number(props.numberFontSize ?? 78)} min={20} max={180} onChange={(v) => update({ numberFontSize: v })} />
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Font family</label>
          <select
            value={props.numberFontFamily ?? "inherit"}
            style={selectStyle}
            onChange={(e) => update({ numberFontFamily: e.target.value })}
          >
            {IC_FONT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div style={{ marginTop: 8 }}>
            <ColorSelector label="Number color" value={props.numberColor || "#ffffff"} fallback="#ffffff" onChange={(v) => update({ numberColor: v })} />
          </div>
        </div>

        {/* Label styling */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Label styling</label>
          <div style={styles.colorGrid}>
            <NumberField label="Font size (px)" value={Number(props.labelFontSize ?? 22)} min={10} max={72} onChange={(v) => update({ labelFontSize: v })} />
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Font family</label>
          <select
            value={props.labelFontFamily ?? "inherit"}
            style={selectStyle}
            onChange={(e) => update({ labelFontFamily: e.target.value })}
          >
            {IC_FONT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <label style={{ ...styles.propertyLabel, marginTop: 8 }}>Font weight</label>
          <select
            value={props.labelFontWeight ?? "600"}
            style={selectStyle}
            onChange={(e) => update({ labelFontWeight: e.target.value })}
          >
            <option value="400">Regular (400)</option>
            <option value="500">Medium (500)</option>
            <option value="600">Semi-bold (600)</option>
            <option value="700">Bold (700)</option>
            <option value="800">Extra-bold (800)</option>
          </select>
          <div style={{ marginTop: 8 }}>
            <ColorSelector label="Label color" value={props.labelColor || "#ffffff"} fallback="#ffffff" onChange={(v) => update({ labelColor: v })} />
          </div>
        </div>

        {/* Background */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Background</label>
          <ColorSelector label="Section background" value={props.backgroundColor || "#1e293b"} fallback="#1e293b" allowTransparent onChange={(v) => update({ backgroundColor: v })} />
          <ColorSelector label="Diamond color" value={props.diamondColor || "#2563eb"} fallback="#2563eb" allowTransparent onChange={(v) => update({ diamondColor: v })} />
          <div style={{ marginTop: 8 }}>
            <NumberField label="Min height (px)" value={Number(props.minHeight ?? 280)} min={80} max={800} onChange={(v) => update({ minHeight: v })} />
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Motion</label>
          <div style={styles.colorGrid}>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Section</label>
              <select value={String(props.sectionAnimation || "fade-up")} onChange={(e) => update({ sectionAnimation: e.target.value })} style={styles.propertyInput}>
                {ANIMATION_PRESETS.map((preset) => <option key={`counter-section-${preset.value}`} value={preset.value}>{preset.label}</option>)}
              </select>
            </div>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Items</label>
              <select value={String(props.itemAnimation || "fade-up")} onChange={(e) => update({ itemAnimation: e.target.value })} style={styles.propertyInput}>
                {ANIMATION_PRESETS.map((preset) => <option key={`counter-item-${preset.value}`} value={preset.value}>{preset.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ ...styles.colorGrid, marginTop: 8 }}>
            <NumberField label="Speed" value={Math.round((Number(props.sectionAnimationSpeed ?? 0.8) || 0.8) * 100)} min={25} max={300} onChange={(value) => update({ sectionAnimationSpeed: Number((value / 100).toFixed(2)) })} />
            <NumberField label="Stagger" value={Math.round((Number(props.itemStagger ?? 0.08) || 0.08) * 100)} min={0} max={200} onChange={(value) => update({ itemStagger: Number((value / 100).toFixed(2)) })} />
          </div>
        </div>

      </div>
    </div>
  );
}

function CompetitorComparisonPropertiesPanel({ block, index, onChange }) {
  const props = block?.props || {};
  const update = (patch) => onChange(index, { ...props, ...patch });
  const rows = Array.isArray(props.rows) ? props.rows : [];

  const updateRow = (rowIndex, patch) =>
    update({ rows: rows.map((r, i) => (i === rowIndex ? { ...r, ...patch } : r)) });

  const deleteRow = (rowIndex) =>
    update({ rows: rows.filter((_, i) => i !== rowIndex) });

  const addRow = () =>
    update({
      rows: [...rows, { category: "NEW FEATURE", logos: [{ domain: "", name: "" }], price: 49 }],
    });

  const updateLogo = (rowIndex, logoIndex, field, value) => {
    const logos = Array.isArray(rows[rowIndex]?.logos) ? rows[rowIndex].logos : [];
    updateRow(rowIndex, { logos: logos.map((l, i) => (i === logoIndex ? { ...l, [field]: value } : l)) });
  };

  const deleteLogo = (rowIndex, logoIndex) => {
    const logos = Array.isArray(rows[rowIndex]?.logos) ? rows[rowIndex].logos : [];
    updateRow(rowIndex, { logos: logos.filter((_, i) => i !== logoIndex) });
  };

  const addLogo = (rowIndex) => {
    const logos = Array.isArray(rows[rowIndex]?.logos) ? rows[rowIndex].logos : [];
    updateRow(rowIndex, { logos: [...logos, { domain: "", name: "" }] });
  };

  const rowShell = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: 10,
    padding: 12,
    display: "grid",
    gap: 8,
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>💸 Edit: Competitor Comparison</h3>
      <div style={styles.propertyGrid}>

        {/* ── Headings ── */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Heading Text</label>
          <label style={{ ...styles.propertyLabel, marginTop: 0 }}>Eyebrow</label>
          <input type="text" value={props.eyebrow || ""} onChange={(e) => update({ eyebrow: e.target.value })} style={styles.propertyInput} placeholder="our All-in-One Platform" />
          <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Title</label>
          <input type="text" value={props.title || ""} onChange={(e) => update({ title: e.target.value })} style={styles.propertyInput} placeholder="Optional heading" />
          <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Subtitle</label>
          <input type="text" value={props.subtitle || ""} onChange={(e) => update({ subtitle: e.target.value })} style={styles.propertyInput} placeholder="We replace every tool below…" />
        </div>

        {/* ── Your plan ── */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Your Plan</label>
          <label style={{ ...styles.propertyLabel, marginTop: 0 }}>Plan Name</label>
          <input type="text" value={props.planName || ""} onChange={(e) => update({ planName: e.target.value })} style={styles.propertyInput} placeholder="COMPETITOR ANALYSIS" />
          <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Monthly Price ($)</label>
          <input type="number" value={Number(props.planPrice || 299)} min={0} onChange={(e) => update({ planPrice: Number(e.target.value) })} style={styles.propertyInput} />
          <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Plan Tagline</label>
          <input type="text" value={props.planTagline || ""} onChange={(e) => update({ planTagline: e.target.value })} style={styles.propertyInput} placeholder="Everything above, included" />
          <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Label for free/unique rows</label>
          <input type="text" value={props.uniqueLabel || ""} onChange={(e) => update({ uniqueLabel: e.target.value })} style={styles.propertyInput} placeholder="Unique to us" />
        </div>

        {/* ── Background ── */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Background Color</label>
          <CompactColorField label="Background" value={props.backgroundColor || "#121c26"} fallback="#121c26" onChange={(v) => update({ backgroundColor: v })} />
        </div>

        {/* ── Rows ── */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Feature Rows</label>
          <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 16, lineHeight: 1.5 }}>
            Each row is one feature. Logos use Clearbit (enter the company domain, e.g. <em>hubspot.com</em>). Set price to 0 for "unique to you" rows.
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} style={rowShell}>
                {/* Category name + delete row */}
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="text"
                    value={row.category || ""}
                    onChange={(e) => updateRow(rowIndex, { category: e.target.value })}
                    style={{ ...styles.propertyInput, flex: 1, fontSize: 16, textTransform: "uppercase" }}
                    placeholder="FEATURE NAME"
                  />
                  <button
                    type="button"
                    onClick={() => deleteRow(rowIndex)}
                    title="Delete row"
                    style={{ ...styles.secondaryBtn, padding: "4px 8px", color: "#ef4444", fontWeight: 600 }}
                  >✕</button>
                </div>
                {/* Price */}
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 16, color: "#94a3b8", minWidth: 50 }}>$/mo</span>
                  <input
                    type="number"
                    value={row.price || 0}
                    min={0}
                    onChange={(e) => updateRow(rowIndex, { price: Number(e.target.value) })}
                    style={{ ...styles.propertyInput, width: 80 }}
                  />
                  <span style={{ fontSize: 16, color: "#64748b" }}>(0 = unique)</span>
                </div>
                {/* Logos */}
                <div>
                  <p style={{ margin: "0 0 6px", fontSize: 16, color: "#94a3b8" }}>Competitor logos (enter domain)</p>
                  <div style={{ display: "grid", gap: 5 }}>
                    {(Array.isArray(row.logos) ? row.logos : []).map((logo, logoIndex) => (
                      <div key={logoIndex} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        {logo.domain ? (
                          <img
                            src={`https://logo.clearbit.com/${logo.domain}`}
                            alt={logo.name || logo.domain}
                            width={22} height={22}
                            style={{ borderRadius: "50%", background: "#fff", objectFit: "contain", border: "1px solid rgba(148,163,184,0.3)", flexShrink: 0 }}
                            onError={(e) => { e.currentTarget.src = `https://www.google.com/s2/favicons?domain=${logo.domain}&sz=64`; }}
                          />
                        ) : (
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(148,163,184,0.2)", flexShrink: 0 }} />
                        )}
                        <input
                          type="text"
                          value={logo.domain || ""}
                          onChange={(e) => updateLogo(rowIndex, logoIndex, "domain", e.target.value)}
                          style={{ ...styles.propertyInput, flex: 1.2, fontSize: 16 }}
                          placeholder="hubspot.com"
                        />
                        <input
                          type="text"
                          value={logo.name || ""}
                          onChange={(e) => updateLogo(rowIndex, logoIndex, "name", e.target.value)}
                          style={{ ...styles.propertyInput, flex: 1, fontSize: 16 }}
                          placeholder="Tool Name"
                        />
                        <button
                          type="button"
                          onClick={() => deleteLogo(rowIndex, logoIndex)}
                          title="Remove logo"
                          style={{ ...styles.secondaryBtn, padding: "2px 6px", color: "#ef4444", fontWeight: 600, flexShrink: 0 }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => addLogo(rowIndex)} style={{ ...styles.secondaryBtn, marginTop: 6, fontSize: 16 }}>
                    + Add Logo
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addRow} style={{ ...styles.secondaryBtn, marginTop: 12 }}>
            + Add Row
          </button>
        </div>

        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Motion</label>
          <div style={styles.colorGrid}>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Section</label>
              <select value={String(props.sectionAnimation || "fade-up")} onChange={(e) => update({ sectionAnimation: e.target.value })} style={styles.propertyInput}>
                {ANIMATION_PRESETS.map((preset) => <option key={`cc-section-${preset.value}`} value={preset.value}>{preset.label}</option>)}
              </select>
            </div>
            <NumberField label="Speed" value={Math.round((Number(props.sectionAnimationSpeed ?? 0.8) || 0.8) * 100)} min={25} max={300} onChange={(value) => update({ sectionAnimationSpeed: Number((value / 100).toFixed(2)) })} />
          </div>
        </div>

      </div>
    </div>
  );
}

function FeatureAccordionPropertiesPanel({ block, index, onChange, brandAssets }) {
  const props = block?.props || {};
  const update = (patch) => onChange(index, { ...props, ...patch });
  const items = Array.isArray(props.items) ? props.items : [];
  const updateItem = (itemIndex, patch) =>
    update({ items: items.map((item, i) => (i === itemIndex ? { ...item, ...patch } : item)) });
  const savedImages = [brandAssets?.logo, ...(Array.isArray(brandAssets?.images) ? brandAssets.images : [])].filter(Boolean).slice(0, 8);
  const chooseLibraryImage = (itemIndex) => {
    openSharedLibraryAssetPicker((asset) => {
      updateItem(itemIndex, {
        image: asset.src || "",
        imageAssetId: asset.id || "",
        imageAlt: htmlToPlainText(asset.name || items[itemIndex]?.imageAlt || ""),
      });
    });
  };

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🗂️ Edit: Feature Accordion</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Section Text</label>
          <div style={styles.stackSm}>
            <input type="text" value={htmlToPlainText(props.eyebrow || "")} onChange={(e) => update({ eyebrow: e.target.value })} style={styles.propertyInput} placeholder="Eyebrow" />
            <input type="text" value={htmlToPlainText(props.title || "")} onChange={(e) => update({ title: e.target.value })} style={styles.propertyInput} placeholder="Section title" />
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Items</label>
          <div style={styles.stackSm}>
            {items.map((item, itemIndex) => (
              <div key={item.id || `fa-${itemIndex}`} style={styles.linkRowCard}>
                <div style={styles.linkRowHeader}>
                  <span style={styles.linkRowTitle}>Item {itemIndex + 1}</span>
                </div>
                <input type="text" value={htmlToPlainText(item.label || "")} onChange={(e) => updateItem(itemIndex, { label: e.target.value })} style={styles.propertyInput} placeholder="Card tagline / tab label" />
                <input type="text" value={String(item.image || "")} onChange={(e) => updateItem(itemIndex, { image: e.target.value, imageAssetId: "" })} style={{ ...styles.propertyInput, marginTop: 6 }} placeholder="Image URL" />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  <button type="button" style={styles.assetLibraryBtn} onClick={() => chooseLibraryImage(itemIndex)}>
                    🖼️ Replace from Library
                  </button>
                  {item.image ? (
                    <button type="button" style={styles.assetChip} onClick={() => updateItem(itemIndex, { image: "", imageAssetId: "" })}>
                      Clear Image
                    </button>
                  ) : null}
                </div>
                {savedImages.length ? (
                  <div style={styles.assetThumbGrid}>
                    {savedImages.map((image, imageIndex) => (
                      <button
                        key={image.id || image.src || `fa-img-${itemIndex}-${imageIndex}`}
                        type="button"
                        style={styles.assetThumbBtn}
                        title={image.name || "Use library image"}
                        onClick={() => updateItem(itemIndex, { image: image.src || "", imageAssetId: image.id || "", imageAlt: htmlToPlainText(image.name || item.imageAlt || "") })}
                      >
                        <img src={image.src} alt={image.name || "Library image"} style={styles.assetThumbPreview} />
                      </button>
                    ))}
                  </div>
                ) : null}
                <input type="text" value={htmlToPlainText(item.imageAlt || "")} onChange={(e) => updateItem(itemIndex, { imageAlt: e.target.value })} style={{ ...styles.propertyInput, marginTop: 6 }} placeholder="Image Alt" />
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  <ColorSelector
                    label="Tab Accent Colour"
                    value={item.accentColor || ""}
                    fallback={props.accentColor || "#0ea5e9"}
                    onChange={(v) => updateItem(itemIndex, { accentColor: v || undefined })}
                  />
                  <ColorSelector
                    label="Panel Background"
                    value={item.panelBg || ""}
                    fallback={props.backgroundColor || "#0f172a"}
                    onChange={(v) => updateItem(itemIndex, { panelBg: v || undefined })}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Style</label>
          <div style={styles.colorGrid}>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Image Position</label>
              <select value={String(props.imagePosition || "right")} onChange={(e) => update({ imagePosition: e.target.value })} style={styles.propertyInput}>
                <option value="right">Right</option>
                <option value="left">Left</option>
              </select>
            </div>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Text Vertical Position</label>
              <select value={String(props.contentVerticalAlign || "top")} onChange={(e) => update({ contentVerticalAlign: e.target.value })} style={styles.propertyInput}>
                <option value="top">Top of card</option>
                <option value="center">Centre of card</option>
              </select>
            </div>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Image Fit</label>
              <select value="contain" onChange={() => update({ imageFit: "contain" })} style={styles.propertyInput}>
                <option value="contain">Contain</option>
              </select>
            </div>
            <NumberField label="Sticky Top Offset (px)" value={Number(props.accordionStickyTopOffset ?? props.stickyTopOffset ?? 110)} min={0} max={260} onChange={(v) => update({ accordionStickyTopOffset: v, stickyTopOffset: v })} />
            <NumberField label="Card Header Visible Height (px)" value={Number(props.accordionHeaderHeight ?? 58)} min={40} max={96} onChange={(v) => update({ accordionHeaderHeight: v })} />
            <NumberField label="Card Stack Gap (px)" value={Number(props.accordionStackGap ?? 8)} min={0} max={32} onChange={(v) => update({ accordionStackGap: v })} />
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Expanded Card Height</label>
              <select value={String(props.expandedCardHeightMode || "viewport")} onChange={(e) => update({ expandedCardHeightMode: e.target.value })} style={styles.propertyInput}>
                <option value="viewport">Viewport minus sticky offset</option>
                <option value="auto">Auto</option>
                <option value="custom">Custom px</option>
              </select>
            </div>
            {String(props.expandedCardHeightMode || "viewport") === "custom" ? (
              <NumberField label="Custom Expanded Height (px)" value={Number(props.expandedCardHeightPx || 720)} min={360} max={1200} onChange={(v) => update({ expandedCardHeightPx: v })} />
            ) : null}
            <label style={{ ...styles.inlineToggle, alignSelf: "end" }}>
              <input
                type="checkbox"
                checked={props.lastCardRelease !== false}
                onChange={(e) => update({ lastCardRelease: e.target.checked })}
                style={styles.checkboxInput}
              />
              Last card releases naturally
            </label>
            <NumberField label="Title Size (px)" value={Number(props.itemLabelFontSize || 24)} min={12} max={72} onChange={(v) => update({ itemLabelFontSize: v })} />
            <NumberField label="Title Line Height" value={Number(props.itemLabelLineHeight || 1.2)} min={0.8} max={2.4} step={0.05} onChange={(v) => update({ itemLabelLineHeight: v })} />
            <NumberField label="Title Top Padding (px)" value={Number(props.itemLabelPaddingTop ?? 20)} min={0} max={120} onChange={(v) => update({ itemLabelPaddingTop: v })} />
            <NumberField label="Title Left Padding (px)" value={Number(props.itemLabelPaddingLeft ?? 32)} min={0} max={160} onChange={(v) => update({ itemLabelPaddingLeft: v })} />
            <NumberField label="Image Max Width (px)" value={Number(props.imageMaxWidth || 0)} min={0} max={1600} onChange={(v) => update({ imageMaxWidth: v })} />
            <NumberField label="Image Max Height (px)" value={Number(props.imageMaxHeight || 0)} min={0} max={1200} onChange={(v) => update({ imageMaxHeight: v })} />
            <NumberField label="Card Max Width (px)" value={Number(props.cardWidth || 1180)} min={640} max={1800} onChange={(v) => update({ cardWidth: v })} />
            <NumberField label="Card Min Height (px)" value={Number(props.cardMinHeight || props.cardHeight || 650)} min={600} max={800} onChange={(v) => update({ cardMinHeight: v, cardHeight: v })} />
            <NumberField label="Card Padding (px)" value={Number(props.cardPadding ?? 56)} min={24} max={120} onChange={(v) => update({ cardPadding: v })} />
            <NumberField label="Column Gap (px)" value={Number(props.cardGap || 32)} min={0} max={120} onChange={(v) => update({ cardGap: v })} />
            <NumberField label="Card Scroll Gap (px)" value={Number(props.cardScrollGap ?? 240)} min={0} max={360} onChange={(v) => update({ cardScrollGap: v })} />
            <NumberField label="Card Inset (px)" value={Number(props.cardInset || 24)} min={0} max={80} onChange={(v) => update({ cardInset: v })} />
            <NumberField label="Heading Size (px)" value={Number(props.headingFontSize ?? 48)} min={16} max={96} onChange={(v) => update({ headingFontSize: v })} />
            <NumberField label="Cards Top Lead (px)" value={Number(props.cardLead ?? 0)} min={0} max={200} onChange={(v) => update({ cardLead: v })} />
            <NumberField label="Scroll VH Per Card" value={Number(props.scrollVhPerCard || 120)} min={80} max={300} onChange={(v) => update({ scrollVhPerCard: v })} />
            <NumberField label="Overlap Delay VH" value={Number(props.overlapDelayVh ?? 60)} min={0} max={200} onChange={(v) => update({ overlapDelayVh: v })} />
            <NumberField label="Corner Radius (px)" value={Number(props.cardRadius ?? 28)} min={0} max={80} onChange={(v) => update({ cardRadius: v })} />
            <NumberField label="Border Width (px)" value={Number(props.cardBorderWidth ?? 0)} min={0} max={12} onChange={(v) => update({ cardBorderWidth: v })} />
          </div>
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Colours</label>
          <ColorSelector label="Section Background" value={props.backgroundColor || "#0f172a"} fallback="#0f172a" onChange={(v) => update({ backgroundColor: v })} />
          <ColorSelector label="Text" value={props.textColor || "#ffffff"} fallback="#ffffff" onChange={(v) => update({ textColor: v })} />
          <ColorSelector label="Accent" value={props.accentColor || "#0ea5e9"} fallback="#0ea5e9" onChange={(v) => update({ accentColor: v })} />
          <ColorSelector label="Card Border Colour" value={props.cardBorderColor || "#3b82f6"} fallback="#3b82f6" onChange={(v) => update({ cardBorderColor: v })} />
        </div>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Motion</label>
          <div style={styles.colorGrid}>
            <div style={styles.propertyField}>
              <label style={styles.propertyLabel}>Section</label>
              <select value={String(props.sectionAnimation || "fade-up")} onChange={(e) => update({ sectionAnimation: e.target.value })} style={styles.propertyInput}>
                {ANIMATION_PRESETS.map((preset) => <option key={`fa-section-${preset.value}`} value={preset.value}>{preset.label}</option>)}
              </select>
            </div>
            <NumberField label="Speed" value={Math.round((Number(props.sectionAnimationSpeed ?? 0.8) || 0.8) * 100)} min={25} max={300} onChange={(value) => update({ sectionAnimationSpeed: Number((value / 100).toFixed(2)) })} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ScrollStackPropertiesPanel({ block, index, onChange, onUploadImage }) {
  const props = block?.props || {};
  const update = (patch) => onChange(index, { ...props, ...patch });
  const panels = Array.isArray(props.panels) ? props.panels : [];
  const [expandedIdx, setExpandedIdx] = useState(0);

  const updatePanel = (panelIdx, patch) =>
    update({ panels: panels.map((p, i) => (i === panelIdx ? { ...p, ...patch } : p)) });

  async function handleUpload(panelIdx, file) {
    if (!file || typeof onUploadImage !== "function") return;
    const asset = await Promise.resolve(onUploadImage("__ss_panel_image__", file));
    if (asset?.src) updatePanel(panelIdx, { image: asset.src });
  }

  return (
    <div style={styles.properties}>
      <h3 style={styles.propertiesTitle}>🃏 Edit: Scroll Stack</h3>
      <div style={styles.propertyGrid}>
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Layout</label>
          <div style={styles.colorGrid}>
            <NumberField label="Lead Offset (px)" value={Number(props.stickyTopOffset ?? 0)} min={0} max={200} onChange={(v) => update({ stickyTopOffset: v })} />
            <NumberField label="Cards Top Lead (px)" value={Number(props.cardLead ?? 0)} min={0} max={200} onChange={(v) => update({ cardLead: v })} />
            <NumberField label="Visible Header (px)" value={Number(props.peekHeight ?? props.cardPeekHeight ?? 52)} min={48} max={140} onChange={(v) => update({ peekHeight: v })} />
            <NumberField label="Text Top Padding (px)" value={Number(props.contentTopPadding ?? 72)} min={24} max={180} onChange={(v) => update({ contentTopPadding: v })} />
            <NumberField label="Card Side Padding (px)" value={Number(props.cardInset ?? 0)} min={0} max={80} onChange={(v) => update({ cardInset: v })} />
            <NumberField label="Corner Radius (px)" value={Number(props.cardRadius ?? 18)} min={0} max={60} onChange={(v) => update({ cardRadius: v })} />
            <NumberField label="Border Width (px)" value={Number(props.cardBorderWidth ?? 0)} min={0} max={12} onChange={(v) => update({ cardBorderWidth: v })} />
          </div>
          <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Text Vertical Alignment</label>
          <select value={String(props.contentVerticalAlign || "center")} onChange={(e) => update({ contentVerticalAlign: e.target.value })} style={styles.propertyInput}>
            <option value="top">Top</option>
            <option value="center">Center</option>
            <option value="bottom">Bottom</option>
          </select>
          <label style={{ ...styles.inlineToggle, marginTop: 10 }}>
            <input
              type="checkbox"
              checked={props.hideHeaderDivider === true}
              onChange={(e) => update({ hideHeaderDivider: e.target.checked })}
              style={styles.checkboxInput}
            />
            Hide header divider line
          </label>
          <ColorSelector label="Card Border Colour" value={props.cardBorderColor || "#3b82f6"} fallback="#3b82f6" onChange={(v) => update({ cardBorderColor: v })} />
        </div>
        {panels.map((panel, panelIdx) => {
          const expanded = expandedIdx === panelIdx;
          const showPanelCta = panel.showCta !== false;
          return (
            <div key={panel.id || `ss-${panelIdx}`} style={styles.linkRowCard}>
              <div style={styles.linkRowHeader}>
                <button
                  type="button"
                  style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, color: "#e2e8f0", fontSize: 16, fontWeight: 600, flex: 1 }}
                  onClick={() => setExpandedIdx(expanded ? -1 : panelIdx)}
                >
                  {expanded ? "▾" : "▸"} Panel {panelIdx + 1}
                </button>
                <div style={styles.linkActions}>
                  <button type="button" style={styles.linkMoveBtn} onClick={() => {
                    if (panelIdx === 0) return;
                    const next = [...panels]; [next[panelIdx - 1], next[panelIdx]] = [next[panelIdx], next[panelIdx - 1]]; update({ panels: next });
                  }}>↑</button>
                  <button type="button" style={styles.linkMoveBtn} onClick={() => {
                    if (panelIdx >= panels.length - 1) return;
                    const next = [...panels]; [next[panelIdx], next[panelIdx + 1]] = [next[panelIdx + 1], next[panelIdx]]; update({ panels: next });
                  }}>↓</button>
                  <button type="button" style={{ ...styles.linkMoveBtn, color: "#f87171" }} onClick={() => update({ panels: panels.filter((_, i) => i !== panelIdx) })}>✕</button>
                </div>
              </div>
              {expanded ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  <div style={styles.propertyField}>
                    <label style={styles.propertyLabel}>Eyebrow</label>
                    <input type="text" value={String(panel.eyebrow || "")} onChange={(e) => updatePanel(panelIdx, { eyebrow: e.target.value })} style={styles.propertyInput} placeholder="Category Label" />
                  </div>
                  <div style={styles.propertyField}>
                    <label style={styles.propertyLabel}>Heading</label>
                    <input type="text" value={String(panel.heading || "")} onChange={(e) => updatePanel(panelIdx, { heading: e.target.value })} style={styles.propertyInput} placeholder="Headline" />
                  </div>
                  <div style={styles.propertyField}>
                    <label style={styles.propertyLabel}>Body</label>
                    <textarea value={String(panel.body || "")} onChange={(e) => updatePanel(panelIdx, { body: e.target.value })} style={{ ...styles.propertyInput, minHeight: 80, resize: "vertical" }} placeholder="Body text" />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" id={`ss-cta-${panelIdx}`} checked={showPanelCta} onChange={(e) => updatePanel(panelIdx, { showCta: e.target.checked })} style={{ width: 14, height: 14, cursor: "pointer" }} />
                    <label htmlFor={`ss-cta-${panelIdx}`} style={{ ...styles.propertyLabel, margin: 0, cursor: "pointer" }}>Show CTA button</label>
                  </div>
                  {showPanelCta ? (
                    <>
                      <div style={styles.propertyField}>
                        <label style={styles.propertyLabel}>CTA Text</label>
                        <input type="text" value={String(panel.ctaText || "")} onChange={(e) => updatePanel(panelIdx, { ctaText: e.target.value })} style={styles.propertyInput} placeholder="Learn More" />
                      </div>
                      <div style={styles.propertyField}>
                        <label style={styles.propertyLabel}>CTA URL</label>
                        <input type="text" value={String(panel.ctaUrl || "")} onChange={(e) => updatePanel(panelIdx, { ctaUrl: e.target.value })} style={styles.propertyInput} placeholder="https://..." />
                      </div>
                    </>
                  ) : null}
                  <div style={styles.propertyField}>
                    <label style={styles.propertyLabel}>Image URL</label>
                    <input type="text" value={String(panel.image || "")} onChange={(e) => updatePanel(panelIdx, { image: e.target.value })} style={styles.propertyInput} placeholder="https://..." />
                  </div>
                  {typeof onUploadImage === "function" ? (
                    <label style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(14,165,233,0.12)", border: "1px dashed rgba(14,165,233,0.4)", color: "#38bdf8", borderRadius: 6, padding: "7px 12px", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>
                      📷 Upload Image
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleUpload(panelIdx, f); }} />
                    </label>
                  ) : null}
                  <div style={styles.propertyField}>
                    <label style={styles.propertyLabel}>Image Position</label>
                    <select value={String(panel.imagePosition || "right")} onChange={(e) => updatePanel(panelIdx, { imagePosition: e.target.value })} style={styles.propertyInput}>
                      <option value="right">Image Right</option>
                      <option value="left">Image Left</option>
                    </select>
                  </div>
                  <div style={styles.propertyField}>
                    <label style={styles.propertyLabel}>Image Style</label>
                    <select value={String(panel.imageStyle || "bleed")} onChange={(e) => updatePanel(panelIdx, { imageStyle: e.target.value })} style={styles.propertyInput}>
                      <option value="bleed">Full Bleed</option>
                      <option value="card">Inset Card</option>
                    </select>
                  </div>
                  {(panel.imageStyle || "bleed") === "card" ? (
                    <ColorSelector label="Card Background" value={panel.imageCardBg || panel.accentColor || "#0ea5e9"} fallback="#0ea5e9" onChange={(v) => updatePanel(panelIdx, { imageCardBg: v })} />
                  ) : null}
                  {showPanelCta ? (
                    <div style={styles.propertyField}>
                      <label style={styles.propertyLabel}>CTA Style</label>
                      <select value={String(panel.ctaStyle || "filled")} onChange={(e) => updatePanel(panelIdx, { ctaStyle: e.target.value })} style={styles.propertyInput}>
                        <option value="filled">Filled</option>
                        <option value="pill">Pill (rounded)</option>
                      </select>
                    </div>
                  ) : null}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" id={`ss-dot-${panelIdx}`} checked={panel.eyebrowDot !== false} onChange={(e) => updatePanel(panelIdx, { eyebrowDot: e.target.checked })} style={{ width: 14, height: 14, cursor: "pointer" }} />
                    <label htmlFor={`ss-dot-${panelIdx}`} style={{ ...styles.propertyLabel, margin: 0, cursor: "pointer" }}>Show eyebrow colour dot</label>
                  </div>
                  <ColorSelector label="Background" value={panel.backgroundColor || "#0f172a"} fallback="#0f172a" onChange={(v) => updatePanel(panelIdx, { backgroundColor: v })} />
                  <ColorSelector label="Text" value={panel.textColor || "#ffffff"} fallback="#ffffff" onChange={(v) => updatePanel(panelIdx, { textColor: v })} />
                  <ColorSelector label="Accent" value={panel.accentColor || "#0ea5e9"} fallback="#0ea5e9" onChange={(v) => updatePanel(panelIdx, { accentColor: v })} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <NumberField label="Heading Size (px)" value={Number(panel.headingSize || 46)} min={18} max={96} onChange={(v) => updatePanel(panelIdx, { headingSize: v })} />
                    <NumberField label="Body Size (px)" value={Number(panel.bodySize || 17)} min={12} max={32} onChange={(v) => updatePanel(panelIdx, { bodySize: v })} />
                  </div>
                  <div style={styles.propertyField}>
                    <label style={styles.propertyLabel}>Heading Weight</label>
                    <select value={String(panel.headingWeight || 800)} onChange={(e) => updatePanel(panelIdx, { headingWeight: Number(e.target.value) })} style={styles.propertyInput}>
                      <option value="400">Regular (400)</option>
                      <option value="500">Medium (500)</option>
                      <option value="600">SemiBold (600)</option>
                      <option value="700">Bold (700)</option>
                      <option value="800">ExtraBold (800)</option>
                      <option value="900">Black (900)</option>
                    </select>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        <button
          type="button"
          style={{ ...styles.primaryBtn, width: "100%", marginTop: 4 }}
          onClick={() => {
            const now = Date.now(); const len = panels.length;
            update({ panels: [...panels, { id: `ss-panel-${now}`, eyebrow: `Section ${len + 1}`, heading: "A bold, compelling headline", body: "Explain your value proposition clearly and concisely.", showCta: true, ctaText: "Learn More", ctaUrl: "#", image: "", imageAlt: "", imagePosition: len % 2 === 0 ? "right" : "left", backgroundColor: "#0f172a", textColor: "#ffffff", accentColor: "#0ea5e9" }] });
            setExpandedIdx(len);
          }}
        >+ Add Panel</button>
      </div>
    </div>
  );
}

// --- exports ---
export {
  BlockPresetPicker, NavbarPresetPicker, NavbarLinksEditor,
  normalizeFeatureListItem, normalizeGalleryItem, createDefaultGalleryItem,
  normalizeTeamMember, normalizeTeamRowSizes, formatTeamRowSizes, deriveTeamRowSizesFromMembers,
  rebalanceTeamMembersForRows, buildEditableTeamRows,
  normalizeStatItem, StatsItemsEditor,
  normalizeTestimonialItemForEditor, normalizeTrustBadgeItem, TrustBadgesEditor,
  CustomHtmlPropertiesPanel, TrustBadgesPropertiesPanel, IconCounterPropertiesPanel,
  DividerPropertiesPanel,
  TestimonialItemsEditor, TestimonialPropertiesPanel,
  NewsletterPropertiesPanel, FooterPropertiesPanel,
  TextPropertiesPanel, StatsPropertiesPanel,
  ContainerImageControls,
  TeamMembersEditor, TeamPropertiesPanel,
  ensureGalleryImagesCount, ListItemsEditor, FeatureListPropertiesPanel,
  GalleryImagesEditor, ImageGalleryPropertiesPanel,
  PricingTablePropertiesPanel,
  FAQPropertiesPanel, FeatureAccordionPropertiesPanel, SplitBlockPropertiesPanel,
  ScrollStackPropertiesPanel,
  CompetitorComparisonPropertiesPanel,
  NumberField, ImagePropertiesPanel,
  NavbarLogoPicker, NavbarPropertiesPanel,
  normalizeColorInput, STANDARD_COLOR_SWATCHES, PRICING_COLOR_SWATCHES,
  ColorSelector, CompactColorField,
  rgbToHex, stripEditorArtifacts,
  TEXT_TOOLBAR_FONTS, TEXT_TOOLBAR_SIZES, TEXT_TOOLBAR_LINE_HEIGHTS,
  ANIMATION_PRESETS, ANIMATION_DELAY_OPTIONS, ANIMATION_SPEED_OPTIONS, BLOCK_TYPE_STYLE_PRESETS,
  getTextAnimationBinding, getSelectionStyleSource, getEditableBackgroundTarget,
  parseBackgroundImageUrl, normalizeToolbarBackgroundColor, normalizeComputedLineHeight, normalizeLineHeightValue, stripInlineCssPropertyFromHtml,
  TextEditingToolbar, BlockAnimationPopover,
  formatSavedAgo, pickGlobalStyleValue, GlobalStylePanel,
  BlockLibraryPanel, PageSectionsPanel,
};
