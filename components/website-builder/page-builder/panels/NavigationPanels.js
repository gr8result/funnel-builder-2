import React, { useEffect, useMemo, useState } from "react";
import { styles } from "../pbStyles";
import { getSelectOptions, openSharedLibraryAssetPicker, NAVBAR_STYLE_PRESETS } from "../pbEditorUtils";
import { buildFooterLinksFromMainNavigation, buildFooterLinksFromPages, buildFooterNavigationContext, normalizeFooterNavItems } from "../../../../lib/website-builder/footerNavigation";
import { ResponsiveNumberField, NumberField, CompactColorField, rgbToHex } from "./EditorControls";


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
  "about-us": "/about-us",
  about: "/about-us",
  modules: "/modules",
  "contact-us": "/contact-us",
  contact: "/contact-us",
  email: "/email",
  pricing: "/pricing",
  crm: "/crm",
  sms: "/sms",
  funnels: "/funnels",
  "website-builder": "/website-builder",
  "social-media": "/social-media",
  "project-hub": "/project-hub",
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

const DEFAULT_MAIN_NAV_LINKS = Object.freeze([
  { label: "Home", href: "/", placement: "top" },
  { label: "Modules", href: "/modules", placement: "top" },
  { label: "Email", href: "/email", placement: "modules" },
  { label: "SMS", href: "/sms", placement: "modules" },
  { label: "CRM", href: "/crm", placement: "modules" },
  { label: "Funnels", href: "/funnels", placement: "modules" },
  { label: "Website Builder", href: "/website-builder", placement: "modules" },
  { label: "Social Media", href: "/social-media", placement: "modules" },
  { label: "Project Hub", href: "/project-hub", placement: "modules" },
  { label: "About Us", href: "/about-us", placement: "top" },
  { label: "Pricing", href: "/pricing", placement: "top" },
  { label: "Contact Us", href: "/contact-us", placement: "top" },
]);

function getMainNavKey(item = {}) {
  const hrefSlug = slugifyNavValue(String(item.href || item.url || item.path || "").replace(/^\/+/, "").split(/[?#]/)[0]);
  return slugifyNavValue(item.pageId || item.page_id || item.slug || item.pageSlug || hrefSlug || item.label || item.name || item.title || "");
}

function flattenMainNavLinks(links = []) {
  const rows = [];
  (Array.isArray(links) ? links : []).forEach((item) => {
    const label = String(item?.label || item?.name || item?.title || "Link").trim();
    rows.push({
      ...item,
      label,
      href: normalizeNavHref(item?.href || item?.url || item?.path || "", label),
      placement: "top",
      children: [],
    });
    (Array.isArray(item?.children) ? item.children : []).forEach((child) => {
      const childLabel = String(child?.label || child?.name || child?.title || "Link").trim();
      rows.push({
        ...child,
        label: childLabel,
        href: normalizeNavHref(child?.href || child?.url || child?.path || "", childLabel),
        placement: getMainNavKey(item) === "modules" ? "modules" : "top",
        children: [],
      });
    });
  });
  return rows;
}

function normalizeSimpleMainNavRows(links = []) {
  const existingRows = flattenMainNavLinks(links);
  const byKey = new Map();
  existingRows.forEach((row) => {
    const key = getMainNavKey(row);
    if (!key || byKey.has(key)) return;
    byKey.set(key, row);
  });

  if (existingRows.length > 0) {
    return [...byKey.values()].map((row) => ({
      ...row,
      id: row.id || `nav-${getMainNavKey(row) || "link"}`,
      label: row.label || "Link",
      href: normalizeNavHref(row.href, row.label),
      placement: row.placement === "modules" ? "modules" : "top",
      children: [],
    }));
  }

  return DEFAULT_MAIN_NAV_LINKS.map((fallback) => {
    const key = slugifyNavValue(fallback.label);
    const existing = byKey.get(key) || {};
    return {
      ...existing,
      id: existing.id || `nav-${key}`,
      label: fallback.label,
      href: normalizeNavHref(existing.href || fallback.href, fallback.label),
      placement: existing.placement === "modules" || fallback.placement === "modules" ? "modules" : "top",
      children: [],
    };
  });
}

function buildMainNavTree(rows = []) {
  const normalizedRows = rows.map((row) => ({
    ...row,
    label: String(row?.label || "Link").trim() || "Link",
    href: normalizeNavHref(row?.href || "", row?.label || ""),
    placement: row?.placement === "modules" ? "modules" : "top",
    children: [],
  }));
  const moduleChildren = normalizedRows
    .filter((row) => row.placement === "modules" && getMainNavKey(row) !== "modules")
    .map(({ placement, children, ...row }) => ({ ...row, children: [] }));
  const topLevel = normalizedRows
    .filter((row) => row.placement === "top" || getMainNavKey(row) === "modules")
    .map(({ placement, children, ...row }) => (
      getMainNavKey(row) === "modules" ? { ...row, children: moduleChildren } : { ...row, children: [] }
    ));

  if (!topLevel.some((row) => getMainNavKey(row) === "modules")) {
    topLevel.splice(1, 0, { id: "nav-modules", label: "Modules", href: "/modules", children: moduleChildren });
  }

  return topLevel;
}

function NavbarLinksEditor({ links, onChange }) {
  const safeRows = useMemo(() => normalizeSimpleMainNavRows(links), [links]);

  useEffect(() => {
    const nextTree = buildMainNavTree(safeRows);
    if (JSON.stringify(Array.isArray(links) ? links : []) !== JSON.stringify(nextTree)) {
      onChange(nextTree);
    }
  }, [links, onChange, safeRows]);

  function emitRows(nextRows) {
    onChange(buildMainNavTree(nextRows));
  }

  function updateLink(idx, patch) {
    emitRows(safeRows.map((item, currentIdx) => (
      currentIdx === idx ? { ...item, ...patch } : item
    )));
  }

  function removeLink(idx) {
    emitRows(safeRows.filter((_, currentIdx) => currentIdx !== idx));
  }

  function moveLink(idx, direction) {
    const nextIndex = idx + direction;
    if (nextIndex < 0 || nextIndex >= safeRows.length) return;
    const next = [...safeRows];
    const [moved] = next.splice(idx, 1);
    next.splice(nextIndex, 0, moved);
    emitRows(next);
  }

  return (
    <div style={navEditorStyles.wrap}>
      {safeRows.map((item, idx) => (
        <div key={item?.id || `link-${idx}`} style={navEditorStyles.row}>
          <label style={navEditorStyles.field}>
            <span style={navEditorStyles.label}>Page name</span>
            <input
              type="text"
              value={item?.label || ""}
              onChange={(e) => updateLink(idx, { label: e.target.value })}
              style={navEditorStyles.input}
              placeholder="Page name"
            />
          </label>
          <label style={navEditorStyles.field}>
            <span style={navEditorStyles.label}>Link</span>
            <input
              type="text"
              value={item?.href || ""}
              onChange={(e) => updateLink(idx, { href: normalizeNavHref(e.target.value, item?.label) })}
              style={navEditorStyles.input}
              placeholder="/page"
            />
          </label>
          <label style={navEditorStyles.field}>
            <span style={navEditorStyles.label}>Dropdown</span>
            <select
              value={item?.placement === "modules" ? "modules" : "top"}
              onChange={(e) => updateLink(idx, { placement: e.target.value })}
              style={navEditorStyles.input}
              disabled={getMainNavKey(item) === "modules"}
            >
              <option value="top">Top level</option>
              <option value="modules">Under Modules</option>
            </select>
          </label>
          <div style={navEditorStyles.actions}>
            <button type="button" style={navEditorStyles.moveButton} onClick={() => moveLink(idx, -1)}>Up</button>
            <button type="button" style={navEditorStyles.moveButton} onClick={() => moveLink(idx, 1)}>Down</button>
            <button type="button" style={navEditorStyles.removeButton} onClick={() => removeLink(idx)}>Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}

const navEditorStyles = {
  wrap: {
    display: "grid",
    gap: 14,
    width: "100%",
    minWidth: 0,
    overflowY: "auto",
    paddingRight: 2,
  },
  row: {
    display: "grid",
    gap: 10,
    width: "100%",
    minWidth: 0,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #2b3650",
    background: "#111827",
    boxSizing: "border-box",
  },
  field: {
    display: "grid",
    gap: 5,
    minWidth: 0,
  },
  label: {
    color: "#9db3c2",
    fontSize: 14,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    minWidth: 0,
    minHeight: 38,
    boxSizing: "border-box",
    border: "1px solid #2b3650",
    borderRadius: 6,
    background: "#0d1522",
    color: "#e6eef5",
    padding: "8px 10px",
    fontSize: 14,
    fontFamily: "inherit",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  moveButton: {
    minHeight: 36,
    border: "1px solid #2d6cdf",
    borderRadius: 8,
    background: "#173459",
    color: "#dbeafe",
    padding: "7px 12px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  removeButton: {
    minHeight: 36,
    border: "1px solid #7f1d1d",
    borderRadius: 8,
    background: "transparent",
    color: "#fca5a5",
    padding: "7px 12px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
};

function FooterPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage, onOpenSimpleImageEditor, project, device = "desktop" }) {
  const props = block?.props || {};
  const update = (patch) => {
    const currentNavigationLinks = props.navigationLinks || props.navLinks;
    if (Array.isArray(currentNavigationLinks) && currentNavigationLinks.length > 3 && Array.isArray(patch?.navigationLinks) && patch.navigationLinks.length <= 1) {
      if (typeof window !== "undefined") {
        window.alert("Footer navigation update blocked because it would remove almost all existing links.");
      }
      return;
    }
    onChange(index, { ...props, ...patch });
  };
  const footerContext = buildFooterNavigationContext({ pages: project?.pages, logInvalid: true });
  const navLinks = normalizeFooterNavItems(props.navigationLinks || props.navLinks, footerContext, { source: "footer.editor.navigationLinks" });
  const extraLinks = normalizeFooterNavItems(props.companyLinks || props.extraLinks, footerContext, { source: "footer.editor.companyLinks" });

  const moveFooterLink = (collection, i, direction) => {
    const links = collection === "extraLinks" ? [...extraLinks] : [...navLinks];
    const nextIndex = i + direction;
    if (nextIndex < 0 || nextIndex >= links.length) return;
    const temp = links[i];
    links[i] = links[nextIndex];
    links[nextIndex] = temp;
    update(collection === "extraLinks"
      ? { companyLinks: links, extraLinks: links, footerNavManual: true }
      : { navigationLinks: links, footerNavManual: true });
  };

  const matchMainNavigationOrder = () => {
    const mainLinks = Array.isArray(project?.globalNavBlock?.props?.links) && project.globalNavBlock.props.links.length
      ? project.globalNavBlock.props.links
      : buildFooterLinksFromPages(project?.pages || []);
    const orderedLinks = buildFooterLinksFromMainNavigation(mainLinks, project?.pages || [], footerContext);
    if (navLinks.length > 3 && orderedLinks.length <= 1) {
      if (typeof window !== "undefined") {
        window.alert("Match Main Navigation Order was blocked because it would reduce the footer to one link.");
      }
      return;
    }
    const preview = orderedLinks.map((link) => `${link.label}  ${link.href}`).filter(Boolean).join("\n");
    if (typeof window !== "undefined" && !window.confirm(`Apply this footer order?\n\n${preview}`)) return;
    update({
      navigationLinks: orderedLinks,
      footerNavManual: true,
    });
  };

  const updateNavLink = (i, field, value) => {
    const links = [...navLinks];
    links[i] = { ...links[i], [field]: value };
    update({ navigationLinks: links, footerNavManual: true });
  };
  const addNavLink = () => {
    update({
      navigationLinks: [...navLinks, { id: `footer-link-${Date.now()}`, label: "New Link", href: "/" }],
      footerNavManual: true,
    });
  };
  const removeNavLink = (i) => update({ navigationLinks: navLinks.filter((_, idx) => idx !== i), footerNavManual: true });

  const updateExtraLink = (i, field, value) => {
    const links = [...extraLinks];
    links[i] = { ...links[i], [field]: value };
    update({ companyLinks: links, extraLinks: links, footerNavManual: true });
  };
  const addExtraLink = () => {
    const links = [...extraLinks, { id: `footer-extra-${Date.now()}`, linkType: "external", label: "New Link", href: "https://" }];
    update({ companyLinks: links, extraLinks: links, footerNavManual: true });
  };
  const removeExtraLink = (i) => {
    const links = extraLinks.filter((_, idx) => idx !== i);
    update({ companyLinks: links, extraLinks: links, footerNavManual: true });
  };

  const footerEditorRow = {
    display: "grid",
    gap: 8,
    marginTop: 10,
    padding: 10,
    border: "1px solid rgba(148,163,184,0.24)",
    borderRadius: 10,
    background: "rgba(15,23,42,0.36)",
  };
  const footerEditorActions = {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  };
  const footerInputStyle = {
    ...styles.propertyInput,
    minHeight: 36,
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
  };

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
            <ResponsiveNumberField
              label={`Logo Width (px)${device !== "desktop" ? ` — ${device === "mobile" ? "Mobile" : "Tablet"}` : ""}`}
              props={props}
              baseKey="logoWidth"
              device={device}
              unit="number"
              min={20}
              max={300}
              fitContentFallback
              fitContentValue={{ tablet: 44, mobile: 36 }}
              onChange={(nextProps) => onChange(index, nextProps)}
            />
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
          <button type="button" style={{ ...styles.secondaryBtn, marginTop: 6, width: "100%" }} onClick={matchMainNavigationOrder}>Match Main Navigation Order</button>
          {navLinks.map((link, i) => (
            <div key={link.id || i} style={footerEditorRow}>
              <label style={styles.propertyLabel}>Name</label>
              <input data-footer-link-input={`navLinks-${i}`} type="text" value={link.label || ""} onChange={(e) => updateNavLink(i, "label", e.target.value)} style={footerInputStyle} placeholder="Social Media" />
              <label style={styles.propertyLabel}>URL</label>
              <input type="text" value={link.href || ""} onChange={(e) => updateNavLink(i, "href", e.target.value)} style={footerInputStyle} placeholder="/social-media" />
              <div style={footerEditorActions}>
                <button type="button" disabled={i === 0} style={{ ...styles.secondaryBtn, minHeight: 34, opacity: i === 0 ? 0.45 : 1 }} onClick={() => moveFooterLink("navLinks", i, -1)}>Up</button>
                <button type="button" disabled={i === navLinks.length - 1} style={{ ...styles.secondaryBtn, minHeight: 34, opacity: i === navLinks.length - 1 ? 0.45 : 1 }} onClick={() => moveFooterLink("navLinks", i, 1)}>Down</button>
                <button type="button" style={{ ...styles.secondaryBtn, minHeight: 34, color: "#ef4444" }} onClick={() => removeNavLink(i)}>Delete</button>
              </div>
            </div>
          ))}
          <button type="button" style={{ ...styles.secondaryBtn, marginTop: 8, width: "100%" }} onClick={addNavLink}>+ Add Navigation Link</button>
        </div>

        {/* Extra links */}
        <div style={styles.sectionCard}>
          <label style={styles.propertyLabel}>Extra Column Heading</label>
          <input type="text" value={String(props.extraHeading || "")} onChange={(e) => update({ extraHeading: e.target.value })} style={styles.propertyInput} placeholder="Company" />
          <label style={{ ...styles.propertyLabel, marginTop: 10 }}>Extra Links</label>
          {extraLinks.map((link, i) => (
            <div key={link.id || i} style={footerEditorRow}>
              <label style={styles.propertyLabel}>Name</label>
              <input data-footer-link-input={`extraLinks-${i}`} type="text" value={link.label || ""} onChange={(e) => updateExtraLink(i, "label", e.target.value)} style={footerInputStyle} placeholder="Privacy Policy" />
              <label style={styles.propertyLabel}>URL</label>
              <input type="text" value={link.href || ""} onChange={(e) => updateExtraLink(i, "href", e.target.value)} style={footerInputStyle} placeholder="/privacy-policy" />
              <div style={footerEditorActions}>
                <button type="button" disabled={i === 0} style={{ ...styles.secondaryBtn, minHeight: 34, opacity: i === 0 ? 0.45 : 1 }} onClick={() => moveFooterLink("extraLinks", i, -1)}>Up</button>
                <button type="button" disabled={i === extraLinks.length - 1} style={{ ...styles.secondaryBtn, minHeight: 34, opacity: i === extraLinks.length - 1 ? 0.45 : 1 }} onClick={() => moveFooterLink("extraLinks", i, 1)}>Down</button>
                <button type="button" style={{ ...styles.secondaryBtn, minHeight: 34, color: "#ef4444" }} onClick={() => removeExtraLink(i)}>Delete</button>
              </div>
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

function NavbarLogoPicker({ index, props, brandAssets, onUploadImage, onSelectAsset, update, device = "desktop" }) {
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
      <ResponsiveNumberField
        label={`Logo Width${device !== "desktop" ? ` — ${device === "mobile" ? "Mobile" : "Tablet"}` : ""}`}
        props={props}
        baseKey="logoWidth"
        device={device}
        unit="number"
        min={20}
        max={300}
        fitContentFallback
        fitContentValue={{ tablet: 180, mobile: 140 }}
        onChange={(nextProps) => update(nextProps)}
      />
      <ResponsiveNumberField
        label={`Logo Max Width${device !== "desktop" ? ` — ${device === "mobile" ? "Mobile" : "Tablet"}` : ""}`}
        props={props}
        baseKey="logoMaxWidth"
        device={device}
        unit="number"
        min={20}
        max={300}
        fitContentFallback
        fitContentValue={{ tablet: 180, mobile: 140 }}
        onChange={(nextProps) => update(nextProps)}
      />
    </div>
  );
}

function NavbarPropertiesPanel({ block, index, onChange, brandAssets, onUploadImage, onSelectAsset, pages = [], device = "desktop" }) {
  const props = block.props || {};
  const [section, setSection] = useState("menu");
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
              device={device}
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

            <div style={{ ...styles.sectionCard, ...navbarSectionShells[2] }}>
              <label style={styles.propertyLabel}>Alignment</label>
              <select
                value={String(props.alignment || "space-between")}
                onChange={(e) => update({ alignment: e.target.value })}
                style={styles.propertyInput}
              >
                <option value="left">Left</option>
                <option value="center">Centre</option>
                <option value="right">Right</option>
                <option value="space-between">Space between</option>
              </select>
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

export {
  NavbarPresetPicker,
  CANONICAL_MENU_URLS,
  slugifyNavValue,
  normalizeNavHref,
  DEFAULT_MAIN_NAV_LINKS,
  getMainNavKey,
  flattenMainNavLinks,
  normalizeSimpleMainNavRows,
  buildMainNavTree,
  NavbarLinksEditor,
  navEditorStyles,
  FooterPropertiesPanel,
  NavbarLogoPicker,
  NavbarPropertiesPanel,
};
