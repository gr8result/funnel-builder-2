import { resolveAccordionPanelImageUrl, isUnsafeAccordionPanelImageUrl } from "../../../lib/website-builder/accordionPanels";
import { openSharedMediaPicker } from "../../../lib/openSharedMediaPicker";
import { asArray, resolvePublishedNavHref } from "./wbAnimations";
import React from "react";
import { cleanInlineEditorHtml } from "../../../modules/website-builder/utils/inlineHtml";
import { asRichHtml } from "./wbVariantStyles";
import { resolveResponsiveMediaSize } from "../../../lib/website-builder/responsiveValue";
import { normalizeAccordionHeading } from "../../../lib/website-builder/accordionHeadingText";
import { shouldLogHeroVideoDebug, htmlToPlainText, shouldSkipToolbarBlur, renderStatLabelHtml } from "./wbBlockHelpers.js";


export const resolveAccordionPanelImage = resolveAccordionPanelImageUrl;

export const isUnsafeAccordionImageUrl = isUnsafeAccordionPanelImageUrl;


export function normaliseAccordionImageFit(value = "contain") {
  const fit = String(value || "contain").toLowerCase().trim();
  if (fit === "contain" || fit === "cover" || fit === "fill" || fit === "none" || fit === "scale-down") return fit;
  return "contain";
}


export function clampImagePositionPercent(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}


export function resolveAccordionImageObjectPosition(source = {}) {
  const x = source.imagePositionX ?? source.objectPositionX;
  const y = source.imagePositionY ?? source.objectPositionY;
  if (x !== undefined && x !== null && x !== "" && y !== undefined && y !== null && y !== "") {
    return `${clampImagePositionPercent(x, 50)}% ${clampImagePositionPercent(y, 50)}%`;
  }
  return normaliseAccordionImageObjectPosition(source.imageObjectPosition || source.objectPosition || "center center");
}


export function normaliseAccordionImageObjectPosition(value = "center center") {
  const position = String(value || "center center").toLowerCase().replace(/\s+/g, " ").trim();
  const map = {
    centre: "center center",
    center: "center center",
    "centre centre": "center center",
    "center center": "center center",
    top: "center top",
    "top centre": "center top",
    "top center": "center top",
    bottom: "center bottom",
    "bottom centre": "center bottom",
    "bottom center": "center bottom",
    left: "left center",
    right: "right center",
    "top left": "left top",
    "left top": "left top",
    "top right": "right top",
    "right top": "right top",
    "centre left": "left center",
    "center left": "left center",
    "centre right": "right center",
    "center right": "right center",
    "bottom left": "left bottom",
    "left bottom": "left bottom",
    "bottom right": "right bottom",
    "right bottom": "right bottom",
  };
  return map[position] || "center center";
}


export function renderAccordionImageFallback(label = "Image") {
  return (
    <div style={{ width: "100%", height: "100%", minHeight: 260, display: "grid", placeItems: "center", background: "linear-gradient(135deg, rgba(14,165,233,0.18), rgba(15,23,42,0.42))", color: "rgba(226,232,240,0.82)", textAlign: "center", padding: 24, boxSizing: "border-box" }}>
      <div style={{ display: "grid", gap: 8, justifyItems: "center", maxWidth: 280 }}>
        <span style={{ fontSize: 15, lineHeight: 1.45, fontWeight: 700 }}>{label || "Image not available"}</span>
        <span style={{ fontSize: 13, lineHeight: 1.4, opacity: 0.78 }}>Image not available</span>
      </div>
    </div>
  );
}


export function openAccordionImageLibrary(onPick) {
  return openSharedMediaPicker({
    onPick: (asset) => {
      const src = String(asset?.src || asset?.url || asset?.imageUrl || "").trim();
      if (!src || isUnsafeAccordionImageUrl(src)) return;
      onPick?.(src, asset);
    },
  });
}


export function logAccordionRenderDebug({ blockId, blockType, panels, renderer }) {
  if (!shouldLogHeroVideoDebug()) return;
  console.info("[AccordionRenderDebug]", {
    blockId,
    blockType,
    panelCount: Array.isArray(panels) ? panels.length : 0,
    selectedRendererComponent: renderer,
    panels: (Array.isArray(panels) ? panels : []).map((panel, panelIndex) => ({
      panelIndex,
      panelTitle: panel?.heading || panel?.title || panel?.label || "",
      resolvedImageField: panel?.imageUrl ? "imageUrl" : panel?.image ? "image" : panel?.imageSrc ? "imageSrc" : panel?.mediaUrl ? "mediaUrl" : panel?.src ? "src" : "",
      resolvedImageUrl: resolveAccordionPanelImageUrl(panel),
    })),
  });
}


// --- Feature Accordion Block -----------------------------------------------
export function FeatureAccordionBlock({ props, compact, editor = false, onChangeBlock, onUploadImage }) {
  const items = asArray(props.items).map((item, idx) => ({
    id: item?.id || `fa-item-${idx}`,
    label: htmlToPlainText(item?.label || `Section ${idx + 1}`),
    image: resolveAccordionPanelImage(item),
    imageUrl: resolveAccordionPanelImage(item),
    imageAlt: htmlToPlainText(item?.imageAlt || ""),
    imageFit: item?.imageFit || props.imageFit || "contain",
    imageObjectPosition: item?.imageObjectPosition || props.imageObjectPosition || props.imagePositionValue || "center center",
    imagePositionX: item?.imagePositionX ?? props.imagePositionX ?? "",
    imagePositionY: item?.imagePositionY ?? props.imagePositionY ?? "",
    imageScale: item?.imageScale || props.imageScale || 100,
    accentColor: item?.accentColor || null,   // null ? falls back to global accent
    panelBg: item?.panelBg || null,           // null ? falls back to global bg/accent gradient
    contentBlocks: asArray(item?.contentBlocks).map((cb, cbIdx) => ({
      id: cb?.id || `cb-${idx}-${cbIdx}`,
      type: cb?.type || "text",
      ...cb,
    })),
  }));

  React.useEffect(() => {
    logAccordionRenderDebug({ blockId: props.__blockId || props.id || props.blockId || "", blockType: props.__blockType || "feature-accordion", panels: items, renderer: "FeatureAccordionBlock" });
  }, [props.__blockId, props.__blockType, props.id, props.blockId, items.length]);

  const [activeIdx, setActiveIdx] = React.useState(0);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [failedImages, setFailedImages] = React.useState({});
  const sectionRef = React.useRef(null);
  const fileInputRefs = React.useRef({});

  const bg        = props.backgroundColor || "#0f172a";
  const textColor = props.textColor       || "#ffffff";
  const accent    = props.accentColor     || "#0ea5e9";
  const resolvedDevice = compact
    ? (Number(props.baseLayoutWidth || 0) > 640 ? "tablet" : "mobile")
    : "desktop";
  const imageRight = (props.imagePosition || "right") !== "left";
  const contentVerticalSetting = String(
    props.contentVerticalAlign || props.contentPosition || props.textPosition || props.textVerticalPosition || "top"
  ).toLowerCase();
  const contentVerticalAlign =
    contentVerticalSetting === "center" || contentVerticalSetting === "centre" || contentVerticalSetting === "middle"
      ? "center"
      : contentVerticalSetting === "bottom" || contentVerticalSetting === "end"
        ? "flex-end"
        : "flex-start";
  const leadOffset = Number(props.stickyTopOffset ?? 0);
  const [navH, setNavH] = React.useState(0);

  React.useEffect(() => {
    if (editor || compact || typeof window === "undefined") return;
    function measureNav() {
      const navShell = document.querySelector("[data-website-nav-shell]");
      if (navShell) {
        const rect = navShell.getBoundingClientRect();
        setNavH(Math.round(rect.height || 0));
      } else {
        setNavH(0);
      }
    }
    measureNav();
    window.addEventListener("resize", measureNav);
    return () => window.removeEventListener("resize", measureNav);
  }, [editor, compact]);

  // auto-detected nav height + manual lead offset
  const stickyTop = navH + leadOffset;

  // -- border props -----------------------------------------------------------
  const bEnabled   = props.itemBorderEnabled !== false;
  const bColor     = props.itemBorderColor   || "rgba(255,255,255,0.10)";
  const bStyle     = props.itemBorderStyle   || "solid";
  const bWidth     = Number(props.itemBorderWidth ?? 2);
  const bActiveColor = props.activeBorderColor || accent;
  const progressColor = props.progressColor  || accent;

  // -- scroll tracking (stacked card deck — published preview only) ----------
  React.useEffect(() => {
    if (editor || compact || typeof window === "undefined") return;
    const n = items.length;
    if (n === 0) return;
    function onScroll() {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const totalRange = el.offsetHeight - window.innerHeight;
      if (totalRange <= 0) { setScrollProgress(0); return; }
      const scrolledIn = -rect.top;
      const raw = Math.max(0, Math.min(n - 0.0001, (scrolledIn / totalRange) * n));
      setScrollProgress(raw);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [editor, compact, items.length]);

  // -- helpers ----------------------------------------------------------------

  function patchItems(newItems) {
    if (!editor || typeof onChangeBlock !== "function") return;
    onChangeBlock({ ...props, items: newItems });
  }

  function patchItemField(itemIdx, field, value) {
    patchItems(items.map((item, i) => i !== itemIdx ? item : { ...item, [field]: value }));
  }

  function patchItemImage(itemIdx, value, asset = null) {
    const nextImage = String(value || "").trim();
    const failedKey = items[itemIdx]?.id || itemIdx;
    setFailedImages((prev) => {
      const next = { ...prev };
      delete next[failedKey];
      return next;
    });
    patchItems(items.map((item, i) => i !== itemIdx ? item : {
      ...item,
      imageUrl: nextImage,
      image: nextImage,
      imageAssetId: asset?.id || item.imageAssetId || "",
    }));
  }

  function patchContentBlock(itemIdx, cbIdx, patch) {
    const newBlocks = items[itemIdx].contentBlocks.map((cb, j) =>
      j !== cbIdx ? cb : { ...cb, ...patch }
    );
    patchItemField(itemIdx, "contentBlocks", newBlocks);
  }

  function addContentBlock(itemIdx, type) {
    const now = Date.now();
    const templates = {
      eyebrow: { id: `cb-${now}`, type: "eyebrow", text: "Category Label" },
      heading: { id: `cb-${now}`, type: "heading", text: "Your headline here" },
      text:    { id: `cb-${now}`, type: "text",    text: "Add your description here." },
      stat:    { id: `cb-${now}`, type: "stat",    number: "0%", label: "metric label" },
      tags:    { id: `cb-${now}`, type: "tags",    tags: ["Tag"] },
      cta:     { id: `cb-${now}`, type: "cta",     text: "Learn More", link: "#" },
    };
    const newBlock = templates[type] || templates.text;
    patchItemField(itemIdx, "contentBlocks", [...items[itemIdx].contentBlocks, newBlock]);
  }

  function removeContentBlock(itemIdx, cbIdx) {
    patchItemField(itemIdx, "contentBlocks", items[itemIdx].contentBlocks.filter((_, j) => j !== cbIdx));
  }

  function moveContentBlock(itemIdx, cbIdx, dir) {
    const blocks = [...items[itemIdx].contentBlocks];
    const target = cbIdx + dir;
    if (target < 0 || target >= blocks.length) return;
    [blocks[cbIdx], blocks[target]] = [blocks[target], blocks[cbIdx]];
    patchItemField(itemIdx, "contentBlocks", blocks);
  }

  function addItem() {
    const now = Date.now();
    patchItems([
      ...items,
      {
        id: `fa-item-${now}`,
        label: "New Section",
        image: "",
        imageAlt: "",
        contentBlocks: [
          { id: `cb-${now}-1`, type: "heading", text: "Your headline here" },
          { id: `cb-${now}-2`, type: "text",    text: "Add your description text here." },
          { id: `cb-${now}-3`, type: "cta",     text: "Learn More", link: "#" },
        ],
      },
    ]);
  }

  function removeItem(itemIdx) {
    patchItems(items.filter((_, i) => i !== itemIdx));
  }

  function jumpToCard(targetIdx) {
    const el = sectionRef.current;
    if (!el) return;
    const n = items.length;
    const totalRange = el.offsetHeight - window.innerHeight;
    const targetScroll = el.offsetTop + (targetIdx / n) * totalRange;
    window.scrollTo({ top: targetScroll, behavior: "smooth" });
  }

  async function handleImageUpload(itemIdx, file) {
    if (!file || typeof onUploadImage !== "function") return;
    const asset = await Promise.resolve(onUploadImage("__fa_item_image__", file));
    if (asset?.src) patchItemImage(itemIdx, asset.src, asset);
  }

  // -- content block renderer -------------------------------------------------

  function renderCb(item, itemIdx, block, cbIdx, perCardAccent = accent) {
    const edgeOut    = editor ? "1px dashed rgba(14,165,233,0.35)" : "none";
    const edgePad    = editor ? "4px 6px" : "0";
    const totalBlocks = item.contentBlocks.length;

    const reorderControls = editor ? (
      React.createElement("div", { style: { display: "flex", flexShrink: 0, gap: 3, marginLeft: 8, alignSelf: "flex-start", paddingTop: 2 } },
        React.createElement("button", {
          type: "button",
          onClick: (e) => { e.stopPropagation(); moveContentBlock(itemIdx, cbIdx, -1); },
          disabled: cbIdx === 0,
          title: "Move up",
          style: { background: "rgba(255,255,255,0.08)", border: "none", color: cbIdx === 0 ? "rgba(255,255,255,0.2)" : "#e2e8f0", borderRadius: 4, padding: "3px 7px", fontSize: 16, cursor: cbIdx === 0 ? "default" : "pointer", fontWeight: 600 },
        }, "?"),
        React.createElement("button", {
          type: "button",
          onClick: (e) => { e.stopPropagation(); moveContentBlock(itemIdx, cbIdx, 1); },
          disabled: cbIdx === totalBlocks - 1,
          title: "Move down",
          style: { background: "rgba(255,255,255,0.08)", border: "none", color: cbIdx === totalBlocks - 1 ? "rgba(255,255,255,0.2)" : "#e2e8f0", borderRadius: 4, padding: "3px 7px", fontSize: 16, cursor: cbIdx === totalBlocks - 1 ? "default" : "pointer", fontWeight: 600 },
        }, "?"),
        React.createElement("button", {
          type: "button",
          onClick: (e) => { e.stopPropagation(); removeContentBlock(itemIdx, cbIdx); },
          title: "Remove block",
          style: { background: "rgba(239,68,68,0.18)", border: "none", color: "#f87171", borderRadius: 4, padding: "3px 7px", fontSize: 16, cursor: "pointer" },
        }, "?"),
      )
    ) : null;

    if (block.type === "eyebrow") {
      return (
        <div key={block.id} style={{ display: "flex", alignItems: "center" }}>
          <div
            data-website-inline-editor={editor ? "true" : undefined}
            contentEditable={editor}
            suppressContentEditableWarning
            onMouseDown={(e) => editor && e.stopPropagation()}
            onPointerDown={(e) => editor && e.stopPropagation()}
            onBlur={(e) => {
              if (shouldSkipToolbarBlur(e)) return;
              patchContentBlock(itemIdx, cbIdx, { text: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
            }}
            style={{ flex: 1, fontSize: 16, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: perCardAccent, outline: edgeOut, borderRadius: 4, padding: edgePad }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(block.text || "Category") }}
          />
          {reorderControls}
        </div>
      );
    }

    if (block.type === "heading") {
      return (
        <div key={block.id} style={{ display: "flex", alignItems: "flex-start" }}>
          <div
            data-website-inline-editor={editor ? "true" : undefined}
            contentEditable={editor}
            suppressContentEditableWarning
            onMouseDown={(e) => editor && e.stopPropagation()}
            onPointerDown={(e) => editor && e.stopPropagation()}
            onBlur={(e) => {
              if (shouldSkipToolbarBlur(e)) return;
              patchContentBlock(itemIdx, cbIdx, { text: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
            }}
            style={{ flex: 1, fontSize: compact ? 22 : (Number(props.headingFontSize) || 48), fontWeight: 600, lineHeight: 1.2, color: textColor, outline: edgeOut, borderRadius: 6, padding: edgePad }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(block.text || "Heading") }}
          />
          {reorderControls}
        </div>
      );
    }

    if (block.type === "text") {
      return (
        <div key={block.id} style={{ display: "flex", alignItems: "flex-start" }}>
          <div
            data-website-inline-editor={editor ? "true" : undefined}
            contentEditable={editor}
            suppressContentEditableWarning
            onMouseDown={(e) => editor && e.stopPropagation()}
            onPointerDown={(e) => editor && e.stopPropagation()}
            onBlur={(e) => {
              if (shouldSkipToolbarBlur(e)) return;
              patchContentBlock(itemIdx, cbIdx, { text: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
            }}
            style={{ flex: 1, fontSize: 16, lineHeight: 1.75, color: textColor, outline: edgeOut, borderRadius: 6, padding: edgePad }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(block.text || "Add your text here.") }}
          />
          {reorderControls}
        </div>
      );
    }

    if (block.type === "stat") {
      return (
        <div key={block.id} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
            <div
              data-website-inline-editor={editor ? "true" : undefined}
              contentEditable={editor}
              suppressContentEditableWarning
              onMouseDown={(e) => editor && e.stopPropagation()}
              onPointerDown={(e) => editor && e.stopPropagation()}
              onBlur={(e) => {
                if (shouldSkipToolbarBlur(e)) return;
                patchContentBlock(itemIdx, cbIdx, { number: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
              }}
              style={{ fontSize: 40, fontWeight: 600, color: perCardAccent, lineHeight: 1, outline: edgeOut, borderRadius: 4, padding: editor ? "2px 4px" : "0" }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(block.number || "0%") }}
            />
            <div
              data-website-inline-editor={editor ? "true" : undefined}
              contentEditable={editor}
              suppressContentEditableWarning
              onMouseDown={(e) => editor && e.stopPropagation()}
              onPointerDown={(e) => editor && e.stopPropagation()}
              onBlur={(e) => {
                if (shouldSkipToolbarBlur(e)) return;
                patchContentBlock(itemIdx, cbIdx, { label: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
              }}
              style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.4, outline: editor ? "1px dashed rgba(14,165,233,0.3)" : "none", borderRadius: 4, padding: editor ? "2px 4px" : "0" }}
              dangerouslySetInnerHTML={{ __html: renderStatLabelHtml(block.label || "metric") }}
            />
          </div>
          {reorderControls}
        </div>
      );
    }

    if (block.type === "tags") {
      const tags = asArray(block.tags);
      return (
        <div key={block.id} style={{ display: "flex", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flex: 1 }}>
            {tags.map((tag, tagIdx) => (
              <div key={tagIdx} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onMouseDown={(e) => editor && e.stopPropagation()}
                  onPointerDown={(e) => editor && e.stopPropagation()}
                  onBlur={(e) => {
                    if (shouldSkipToolbarBlur(e)) return;
                    const newTags = tags.map((t, i) => i !== tagIdx ? t : e.currentTarget.textContent || "");
                    patchContentBlock(itemIdx, cbIdx, { tags: newTags });
                  }}
                  style={{ display: "inline-block", background: "rgba(14,165,233,0.14)", color: perCardAccent, border: "1px solid rgba(14,165,233,0.25)", borderRadius: 20, padding: "4px 14px", fontSize: 16, fontWeight: 600, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none" }}
                >{tag}</span>
                {editor ? (
                  <button type="button" onClick={(e) => { e.stopPropagation(); patchContentBlock(itemIdx, cbIdx, { tags: tags.filter((_, i) => i !== tagIdx) }); }} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16, padding: "0 2px", lineHeight: 1 }}>×</button>
                ) : null}
              </div>
            ))}
            {editor ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); patchContentBlock(itemIdx, cbIdx, { tags: [...tags, "New Tag"] }); }} style={{ background: "rgba(14,165,233,0.12)", border: "1px dashed rgba(14,165,233,0.4)", color: perCardAccent, borderRadius: 20, padding: "4px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>+ Tag</button>
            ) : null}
          </div>
          {reorderControls}
        </div>
      );
    }

    if (block.type === "cta") {
      return (
        <div key={block.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <a
            href={editor ? undefined : (block.link || "#")}
            onClick={(e) => editor && e.preventDefault()}
            style={{ display: "inline-block", background: perCardAccent, color: "#ffffff", borderRadius: 8, padding: "13px 30px", fontSize: 16, fontWeight: 600, textDecoration: "none", cursor: editor ? "default" : "pointer" }}
          >
            <div
              data-website-inline-editor={editor ? "true" : undefined}
              contentEditable={editor}
              suppressContentEditableWarning
              onMouseDown={(e) => editor && e.stopPropagation()}
              onPointerDown={(e) => editor && e.stopPropagation()}
              onBlur={(e) => {
                if (shouldSkipToolbarBlur(e)) return;
                patchContentBlock(itemIdx, cbIdx, { text: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
              }}
              style={{ outline: editor ? "1px dashed rgba(255,255,255,0.4)" : "none", borderRadius: 4, padding: editor ? "1px 4px" : "0", display: "inline", color: "#fff" }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(block.text || "Learn More") }}
            />
          </a>
          {editor ? (
            <input
              type="text"
              value={block.link || ""}
              onChange={(e) => patchContentBlock(itemIdx, cbIdx, { link: e.target.value })}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="https://..."
              style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: textColor, borderRadius: 6, padding: "8px 12px", fontSize: 16 }}
            />
          ) : null}
          {reorderControls}
        </div>
      );
    }

    return null;
  }

  // -- image slot -------------------------------------------------------------
  function renderImageSlot(item, idx, forEditor = false) {
    const imageSrc = resolveAccordionPanelImage(item);
    const fit = normaliseAccordionImageFit(item.imageFit || props.imageFit || props.imageObjectFit || props.objectFit || "contain");
    const pos = resolveAccordionImageObjectPosition(item);
    const scale = Math.max(50, Math.min(150, Number(item.imageScale || 100) || 100)) / 100;
    const failedKey = item.id || idx;
    const imageFailed = !!failedImages[failedKey] || isUnsafeAccordionImageUrl(imageSrc);
    const showImage = !!imageSrc && !imageFailed;
    if (imageSrc && imageFailed && shouldLogHeroVideoDebug()) {
      console.warn("[accordion image] invalid image URL", { panelId: item.id, index: idx, imageSrc });
    }
    return (
      <>
        {showImage ? (
          <img
            data-wb-controlled-image="accordion"
            src={imageSrc}
            alt={item.imageAlt || item.label}
            style={{ width: "100%", height: "100%", maxWidth: "100%", minWidth: 0, objectFit: fit, objectPosition: pos, transform: `scale(${scale})`, transformOrigin: pos, display: "block" }}
            onLoad={(event) => {
              if (shouldLogHeroVideoDebug()) console.info("[accordion image] loaded", {
                panelId: item.id,
                index: idx,
                imageSrc,
                naturalWidth: event.currentTarget.naturalWidth,
                naturalHeight: event.currentTarget.naturalHeight,
                renderedWidth: event.currentTarget.getBoundingClientRect?.().width || 0,
                renderedHeight: event.currentTarget.getBoundingClientRect?.().height || 0,
              });
            }}
            onError={() => {
              if (shouldLogHeroVideoDebug()) console.warn("[accordion image] failed to load", { panelId: item.id, index: idx, imageSrc });
              setFailedImages((prev) => ({ ...prev, [failedKey]: true }));
            }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.04)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "rgba(255,255,255,0.35)" }}>
            <span style={{ fontSize: 36 }}>🖼️</span>
            {forEditor ? (
              <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 8, background: "rgba(14,165,233,0.15)", border: "1px dashed rgba(14,165,233,0.5)", color: accent, fontSize: 16, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                🖼️ Upload Image
                <input ref={(el) => { fileInputRefs.current[idx] = el; }} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleImageUpload(idx, f); }} />
              </label>
            ) : (
              <span style={{ fontSize: 16 }}>Image not available</span>
            )}
          </div>
        )}
        {forEditor && imageSrc ? (
          <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.2)", color: "#e2e8f0", borderRadius: 6, padding: "5px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }} onClick={(e) => e.stopPropagation()}>
              ↻ Replace
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleImageUpload(idx, f); }} />
            </label>
            <button type="button" onClick={(e) => { e.stopPropagation(); patchItemImage(idx, ""); }} title="Remove image" style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", borderRadius: 6, padding: "5px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>×</button>
          </div>
        ) : null}
        {forEditor ? (
          <div style={{ position: "absolute", left: 10, bottom: 10, display: "flex", gap: 6, flexWrap: "wrap", zIndex: 5 }}>
            <button type="button" onClick={(e) => { e.stopPropagation(); openAccordionImageLibrary((src, asset) => patchItemImage(idx, src, asset)); }} style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(125,211,252,0.35)", color: "#bae6fd", borderRadius: 6, padding: "5px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>Media Library</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); openAccordionImageLibrary((src, asset) => patchItemImage(idx, src, asset)); }} style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(125,211,252,0.35)", color: "#bae6fd", borderRadius: 6, padding: "5px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>Recent Images</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); const src = window.prompt("Paste image URL", imageSrc || ""); if (src && !isUnsafeAccordionImageUrl(src)) patchItemImage(idx, src); }} style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.2)", color: "#e2e8f0", borderRadius: 6, padding: "5px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>Paste URL</button>
            {imageSrc ? <button type="button" onClick={(e) => { e.stopPropagation(); patchItemImage(idx, ""); }} style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", borderRadius: 6, padding: "5px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>Remove Image</button> : null}
          </div>
        ) : null}
      </>
    );
  }

  // -- EDITOR: all items stacked, fully expanded ------------------------------
  if (editor) {
    return (
      <section style={{ width: "100%", background: bg, color: textColor, boxSizing: "border-box" }}>
        {(props.eyebrow || props.title) ? (
          <div style={{ padding: "64px 80px 40px" }}>
            {props.eyebrow ? <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, marginBottom: 12 }}>{htmlToPlainText(props.eyebrow)}</div> : null}
            {props.title ? <h2 style={{ fontSize: 44, fontWeight: 600, lineHeight: 1.1, color: textColor, margin: 0 }}>{htmlToPlainText(props.title)}</h2> : null}
          </div>
        ) : null}
        {items.map((item, idx) => {
          const itemBorder = bEnabled ? `${bWidth}px ${bStyle} ${bActiveColor}` : "none";
          return (
            <div key={item.id} style={{ margin: "0 0 16px", borderTop: itemBorder, borderBottom: itemBorder, background: item.panelBg || bg, overflow: "hidden" }}>
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 40px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <span style={{ width: 4, height: 28, borderRadius: 2, background: item.accentColor || accent, flexShrink: 0 }} />
                <div
                  data-website-inline-editor="true"
                  contentEditable
                  suppressContentEditableWarning
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onBlur={(e) => { if (shouldSkipToolbarBlur(e)) return; patchItemField(idx, "label", htmlToPlainText(cleanInlineEditorHtml(e.currentTarget.innerHTML))); }}
                  style={{ flex: 1, fontSize: 24, fontWeight: 600, lineHeight: 1.2, color: textColor, outline: "1px dashed rgba(14,165,233,0.4)", borderRadius: 6, padding: "3px 8px" }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(htmlToPlainText(item.label)) }}
                />
                <span style={{ color: "rgba(255,255,255,0.20)", fontSize: 16, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{String(idx + 1).padStart(2, "0")}&nbsp;/&nbsp;{String(items.length).padStart(2, "0")}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); removeItem(idx); }} style={{ background: "rgba(239,68,68,0.15)", border: "none", color: "#f87171", borderRadius: 6, padding: "4px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>Remove</button>
              </div>
              {/* 2-col body */}
              <div style={{ display: "flex", flexDirection: imageRight ? "row" : "row-reverse", minHeight: 380 }}>
                <div style={{ flex: "0 0 50%", maxWidth: "50%", display: "flex", flexDirection: "column", justifyContent: contentVerticalAlign, gap: 20, padding: "44px 56px" }}>
                  {item.contentBlocks.map((block, cbIdx) => renderCb(item, idx, block, cbIdx, item.accentColor || accent))}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, paddingTop: 12, borderTop: "1px dashed rgba(14,165,233,0.2)" }}>
                    {["eyebrow", "heading", "text", "stat", "tags", "cta"].map((type) => (
                      <button key={type} type="button" onClick={(e) => { e.stopPropagation(); addContentBlock(idx, type); }} style={{ background: "rgba(14,165,233,0.10)", border: "1px dashed rgba(14,165,233,0.35)", color: accent, borderRadius: 6, padding: "4px 10px", fontSize: 16, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>+ {type}</button>
                    ))}
                  </div>
                </div>
                <div style={{ flex: "0 0 50%", maxWidth: "50%", minWidth: 0, position: "relative", overflow: "hidden", minHeight: 320 }}>
                  {renderImageSlot(item, idx, true)}
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ padding: "24px 40px", display: "flex", justifyContent: "center" }}>
          <button type="button" onClick={(e) => { e.stopPropagation(); addItem(); }} style={{ background: "rgba(14,165,233,0.10)", border: "2px dashed rgba(14,165,233,0.4)", color: accent, borderRadius: 10, padding: "14px 36px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>+ Add Panel</button>
        </div>
      </section>
    );
  }

  // -- COMPACT / MOBILE: click-to-expand accordion ----------------------------
  if (compact) {
    return (
      <section style={{ width: "100%", background: bg, color: textColor, boxSizing: "border-box" }}>
        {(props.eyebrow || props.title) ? (
          <div style={{ padding: "40px 24px 24px" }}>
            {props.eyebrow ? <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, marginBottom: 10 }}>{htmlToPlainText(props.eyebrow)}</div> : null}
            {props.title ? <h2 style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1, color: textColor, margin: 0 }}>{htmlToPlainText(props.title)}</h2> : null}
          </div>
        ) : null}
        {items.map((item, idx) => {
          const isOpen = activeIdx === idx;
          const borderVal = bEnabled ? `${bWidth}px ${bStyle} ${isOpen ? bActiveColor : bColor}` : "none";
          return (
            <div key={item.id} style={{ borderBottom: borderVal, overflow: "hidden" }}>
              <div onClick={() => setActiveIdx(isOpen ? -1 : idx)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 24px", cursor: "pointer", userSelect: "none" }}>
                <span style={{ width: 3, height: 22, borderRadius: 2, background: isOpen ? (item.accentColor || accent) : "rgba(255,255,255,0.2)", flexShrink: 0, transition: "background 0.3s" }} />
                <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: textColor }}>{item.label}</span>
                <span style={{ color: isOpen ? (item.accentColor || accent) : "rgba(255,255,255,0.35)", fontSize: 18, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s", display: "inline-block" }}>⌄</span>
              </div>
              <div style={{ display: "grid", gridTemplateRows: isOpen ? "1fr" : "0fr", transition: "grid-template-rows 0.4s cubic-bezier(0.4,0,0.2,1)" }}>
                <div style={{ overflow: "hidden", minHeight: 0 }}>
                  {item.image ? (() => {
                    const compactImageSize = resolveResponsiveMediaSize({
                      desktopWidth: props.imageWidth || props.baseLayoutWidth || 720,
                      desktopHeight: props.imageHeight || 320,
                      mediaType: "feature-illustration",
                      blockType: "feature-accordion",
                      device: resolvedDevice,
                      containerWidth: props.baseLayoutWidth || (resolvedDevice === "tablet" ? 768 : 390),
                      viewportWidth: props.baseLayoutWidth || (resolvedDevice === "tablet" ? 768 : 390),
                    });
                    const fit = normaliseAccordionImageFit(item.imageFit || props.imageFit || props.imageObjectFit || props.objectFit || "contain");
                    const position = resolveAccordionImageObjectPosition(item);
                    const imageHeightMode = String(props.imageHeightMode || "auto").toLowerCase();
                    const containerHeight = Number(props.containerHeight || props.imageHeight || 0);
                    const img = (
                      <img
                        data-wb-controlled-image="accordion"
                        src={item.image}
                        alt={item.imageAlt || item.label}
                        style={{
                          width: "100%",
                          maxWidth: "100%",
                          minWidth: 0,
                          height: imageHeightMode === "fixed" || containerHeight > 0 ? "100%" : "auto",
                          maxHeight: compactImageSize.maxHeight || props.imageMaxHeight || 260,
                          objectFit: fit,
                          objectPosition: position,
                          display: "block",
                        }}
                      />
                    );
                    if (imageHeightMode === "fixed" || containerHeight > 0) {
                      return (
                        <div style={{ width: "100%", height: Math.max(120, containerHeight || 260), overflow: "hidden" }}>
                          {img}
                        </div>
                      );
                    }
                    return (
                      img
                    );
                  })() : null}
                  <div style={{ padding: "16px 24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
                    {item.contentBlocks.map((block, cbIdx) => renderCb(item, idx, block, cbIdx, item.accentColor || accent))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    );
  }

  // -- PUBLISHED: stacked card deck ------------------------------------------
  // Peek heights decrease per card: top card shows most, deeper cards show less
  const peeks = items.map((_, i) => Math.max(60, 90 - i * 8));
  const n = items.length;
  // Subtract nav bar height so cards occupy the space below the nav
  const vp = ((typeof window !== "undefined" && window.innerHeight) || 800) - stickyTop;
  // Cumulative settled Y (cards stack from top, each peeking their amount)
  const cardLead = Number(props.cardLead ?? 0);
  const hInset = Number(props.cardInset ?? 0);
  const settledYs = items.map((_, idx) => {
    let y = cardLead;
    for (let i = 0; i < idx; i++) y += peeks[i];
    return y;
  });
  // Future Y (cards peek from bottom, deeper cards further down)
  const futureYs = items.map((_, idx) => {
    let y = vp;
    for (let i = n - 1; i >= idx; i--) y -= peeks[i];
    return y;
  });

  return (
    <section
      ref={sectionRef}
      style={{ width: "100%", position: "relative", height: `${n * 100}vh`, boxSizing: "border-box" }}
    >
      <div style={{ position: "sticky", top: stickyTop, height: `calc(100vh - ${stickyTop}px)`, overflow: "hidden" }}>
        {items.map((item, idx) => {
          const cardBg = item.panelBg || item.accentColor || bg;
          const cardText = textColor;
          const itemAccent = item.accentColor || accent;
          const dist = idx - scrollProgress;
          let y;
          if (dist <= 0) {
            y = settledYs[idx];
          } else if (dist < 1) {
            const t = 1 - dist;
            y = futureYs[idx] + t * (settledYs[idx] - futureYs[idx]);
          } else {
            y = futureYs[idx];
          }
          const isPast = dist < -0.02;
          const isFuture = dist > 0.02;
          const isActive = !isPast && !isFuture;
          const peekH = peeks[idx];

          return (
            <div
              key={item.id}
              style={{
                position: "absolute",
                left: hInset, right: hInset, top: 0,
                height: "100vh",
                transform: `translateY(${y}px)`,
                zIndex: idx + 1,
                background: cardBg,
                color: cardText,
                borderRadius: (idx > 0 || hInset > 0) ? `${Number(props.cardRadius ?? 18)}px ${Number(props.cardRadius ?? 18)}px 0 0` : 0,
                boxShadow: idx > 0 ? "0 -6px 24px rgba(0,0,0,0.22)" : "none",
                border: Number(props.cardBorderWidth ?? 0) > 0 ? `${Number(props.cardBorderWidth)}px solid ${props.cardBorderColor || "#3b82f6"}` : "none",
                overflow: "hidden",
                boxSizing: "border-box",
                willChange: "transform",
              }}
            >
              {/* -- Header strip — always visible, always clickable -- */}
              <div
                onClick={() => jumpToCard(idx)}
                style={{
                  height: peekH,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "0 28px",
                  cursor: "pointer",
                  userSelect: "none",
                  flexShrink: 0,
                  borderBottom: "1px solid rgba(255,255,255,0.12)",
                  background: isPast ? "rgba(0,0,0,0.18)" : isFuture ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.14)",
                }}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: itemAccent,
                  flexShrink: 0,
                  boxShadow: `0 0 6px ${itemAccent}88`,
                }} />
                <span style={{
                  flex: 1,
                  fontSize: 16,
                  fontWeight: 600,
                  color: cardText,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {item.label}
                </span>
                <span style={{
                  fontSize: 26,
                  opacity: isActive ? 0.85 : 0.45,
                  flexShrink: 0,
                  transform: isActive ? "rotate(90deg)" : "none",
                  transition: "transform 0.3s, opacity 0.3s",
                }}>⌄</span>
              </div>

              {/* -- Full content area -- */}
              <div style={{
                height: `calc(100vh - ${peekH}px)`,
                display: "flex",
                flexDirection: imageRight ? "row" : "row-reverse",
                overflow: "hidden",
              }}>
                {/* Content half */}
                <div style={{
                  flex: "0 0 50%",
                  maxWidth: "50%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: contentVerticalAlign,
                  gap: 18,
                  padding: "40px 52px",
                  overflowY: "auto",
                  scrollbarWidth: "none",
                  boxSizing: "border-box",
                }}>
                  {item.contentBlocks.map((block, cbIdx) => renderCb(item, idx, block, cbIdx, itemAccent))}
                </div>
                {/* Image half */}
                <div style={{
                  flex: "0 0 50%",
                  maxWidth: "50%",
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {renderImageSlot(item, idx, false)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}






// --- ScrollStackBlock -------------------------------------------------------
// Full-page stacking panels: image one side, text the other.
// Preview: CSS position:sticky makes each panel "stack" over the previous as user scrolls.
// Editor: panels rendered flat so the canvas stays editable.
// imageStyle "card" = inset rounded card with colored bg
// imageStyle "bleed" = full-bleed image fills the entire half

export function ScrollStackBlock({ props, compact, editor = false, onChangeBlock, onUploadImage, navigationContext = null }) {
  const panelSourceKey = Array.isArray(props.panels) ? "panels" : "items";
  const panels = asArray(Array.isArray(props.panels) ? props.panels : props.items).map((p, idx) => ({
    id: p?.id || `ss-panel-${idx}`,
    eyebrow: p?.eyebrow ?? "",
    eyebrowDot: p?.eyebrowDot !== false,
    heading: p?.heading ?? "",
    body: p?.body ?? "",
    showCta: p?.showCta !== false,
    ctaText: p?.ctaText ?? "",
    ctaUrl: p?.ctaUrl ?? "#",
    ctaStyle: p?.ctaStyle ?? "filled",
    buttonFullWidth: p?.buttonFullWidth === true || p?.ctaFullWidth === true,
    image: resolveAccordionPanelImage(p),
    imageUrl: resolveAccordionPanelImage(p),
    imageAlt: p?.imageAlt ?? "",
    imageStyle: p?.imageStyle ?? "bleed",
    imageCardBg: p?.imageCardBg ?? (p?.accentColor ?? "#0ea5e9"),
    imagePosition: p?.imagePosition ?? "right",
    useBlockImageSettings: p?.useBlockImageSettings !== false,
    imageFit: p?.imageFit ?? "",
    imageObjectPosition: p?.imageObjectPosition ?? "",
    imagePositionX: p?.imagePositionX ?? "",
    imagePositionY: p?.imagePositionY ?? "",
    imageScale: p?.imageScale ?? "",
    imageMaxHeightMode: p?.imageMaxHeightMode ?? "",
    imageMaxHeightCustom: p?.imageMaxHeightCustom ?? "",
    imagePadding: p?.imagePadding ?? "",
    panelImageHeightMode: p?.panelImageHeightMode ?? "",
    panelImageFixedHeight: p?.panelImageFixedHeight ?? "",
    backgroundColor: p?.backgroundColor ?? "#0f172a",
    textColor: p?.textColor ?? "#ffffff",
    accentColor: p?.accentColor ?? "#0ea5e9",
  }));

  // Panel image uploads are async (a real network round trip). If a second panel's
  // upload is started before the first one resolves, both closures over `panels`/`props`
  // are captured from the same pre-upload render. Reading through refs instead of the
  // closed-over variables at patch time ensures each save builds on the latest state
  // rather than silently reverting whichever upload resolved first.
  const latestPropsRef = React.useRef(props);
  latestPropsRef.current = props;
  const latestPanelsRef = React.useRef(panels);
  latestPanelsRef.current = panels;

  React.useEffect(() => {
    logAccordionRenderDebug({ blockId: props.__blockId || props.id || props.blockId || "", blockType: props.__blockType || (props.stackMode === "side" ? "side-scroll-accordion" : "scroll-stack"), panels, renderer: "ScrollStackBlock" });
  }, [props.__blockId, props.__blockType, props.id, props.blockId, props.stackMode, panels.length]);

  const fileInputRefs = React.useRef({});
  const [failedImages, setFailedImages] = React.useState({});
  const sectionRef = React.useRef(null);
  const stickyRef = React.useRef(null);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [activePanelIndex, setActivePanelIndex] = React.useState(0);
  const [navH, setNavH] = React.useState(0);
  const leadOffset = Number(props.stickyTopOffset ?? 0);
  const stickyTop = navH + leadOffset;
  const [containerMetrics, setContainerMetrics] = React.useState({ width: 1280, height: 800 });

  React.useEffect(() => {
    if (activePanelIndex > panels.length - 1) {
      setActivePanelIndex(Math.max(0, panels.length - 1));
    }
  }, [activePanelIndex, panels.length]);

  React.useEffect(() => {
    if (editor || compact || typeof window === "undefined") return;
    function measureNav() {
      const navShell = document.querySelector("[data-website-nav-shell]");
      setNavH(navShell ? Math.round(navShell.getBoundingClientRect().height || 0) : 0);
    }
    measureNav();
    window.addEventListener("resize", measureNav);
    return () => window.removeEventListener("resize", measureNav);
  }, [editor, compact]);

  React.useEffect(() => {
    if (editor || compact || typeof window === "undefined") return undefined;
    let rafId = 0;
    const measure = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const stickyEl = stickyRef.current;
        const sectionEl = sectionRef.current;
        const rect = (stickyEl || sectionEl)?.getBoundingClientRect?.();
        setContainerMetrics({
          width: Math.max(320, Math.round(rect?.width || sectionEl?.clientWidth || window.innerWidth || 1280)),
          height: Math.max(360, Math.round(rect?.height || window.innerHeight - stickyTop || 800)),
        });
      });
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (observer && sectionRef.current) observer.observe(sectionRef.current);
    if (observer && stickyRef.current) observer.observe(stickyRef.current);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    document.fonts?.ready?.then(measure).catch(() => {});
    return () => {
      window.cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [editor, compact, stickyTop, panels.length]);

  function patchPanels(newPanels) {
    if (!editor || typeof onChangeBlock !== "function") return;
    onChangeBlock({ ...latestPropsRef.current, [panelSourceKey]: newPanels });
  }

  function patchPanel(idx, patch) {
    patchPanels(latestPanelsRef.current.map((p, i) => i !== idx ? p : { ...p, ...patch }));
  }

  function patchPanelImage(idx, value, asset = null) {
    const nextImage = String(value || "").trim();
    const failedKey = latestPanelsRef.current[idx]?.id || idx;
    setFailedImages((prev) => {
      const next = { ...prev };
      delete next[failedKey];
      return next;
    });
    patchPanel(idx, {
      imageUrl: nextImage,
      image: nextImage,
      imageAssetId: asset?.id || latestPanelsRef.current[idx]?.imageAssetId || "",
    });
  }

  function addPanel() {
    const now = Date.now();
    const len = latestPanelsRef.current.length;
    patchPanels([
      ...latestPanelsRef.current,
      {
        id: `ss-panel-${now}`,
        eyebrow: `Section ${len + 1}`,
        eyebrowDot: true,
        heading: "A bold, compelling headline",
        body: "Explain your value proposition clearly and concisely. What makes this different?",
        showCta: true,
        ctaText: "Get Started",
        ctaUrl: "#",
        ctaStyle: "pill",
        image: "",
        imageAlt: "",
        imageStyle: "card",
        imageCardBg: "#1a73e8",
        imagePosition: len % 2 === 0 ? "right" : "left",
        backgroundColor: "#f1f5f9",
        textColor: "#0f172a",
        accentColor: "#1a73e8",
      },
    ]);
  }

  function removePanel(idx) {
    patchPanels(latestPanelsRef.current.filter((_, i) => i !== idx));
  }

  async function handleImageUpload(panelIdx, file) {
    if (!file || typeof onUploadImage !== "function") return;
    const asset = await Promise.resolve(onUploadImage("__ss_panel_image__", file));
    if (asset?.src) patchPanelImage(panelIdx, asset.src, asset);
  }

  // -- Image rendering --------------------------------------------------------
  // "bleed" = raw image fills entire half
  // "card"  = inset rounded card with imageCardBg behind image
  function imageSetting(panel, key, fallback) {
    return panel.useBlockImageSettings === false && panel[key] !== "" && panel[key] != null
      ? panel[key]
      : props[key] ?? fallback;
  }

  function normaliseImageFit(value) {
    const fit = String(value || "contain").toLowerCase();
    if (fit === "scale-down") return "scale-down";
    if (fit === "cover" || fit === "fill" || fit === "natural" || fit === "none") return fit === "natural" ? "none" : fit;
    return "contain";
  }

  function normaliseImagePosition(value, panel = null) {
    const x = panel ? imageSetting(panel, "imagePositionX", "") : "";
    const y = panel ? imageSetting(panel, "imagePositionY", "") : "";
    if (x !== "" && x != null && y !== "" && y != null) {
      return `${clampImagePositionPercent(x, 50)}% ${clampImagePositionPercent(y, 50)}%`;
    }
    const position = String(value || "center center").toLowerCase().replace(/\s+/g, " ").trim();
    const map = {
      centre: "center center",
      center: "center center",
      "centre centre": "center center",
      "center center": "center center",
      top: "center top",
      "top centre": "center top",
      "top center": "center top",
      bottom: "center bottom",
      "bottom centre": "center bottom",
      "bottom center": "center bottom",
      left: "left center",
      right: "right center",
      "top left": "left top",
      "left top": "left top",
      "top right": "right top",
      "right top": "right top",
      "centre left": "left center",
      "center left": "left center",
      "centre right": "right center",
      "center right": "right center",
      "bottom left": "left bottom",
      "left bottom": "left bottom",
      "bottom right": "right bottom",
      "right bottom": "right bottom",
    };
    return map[position] || "center center";
  }

  function objectPositionFlexAlign(objectPosition = "center center") {
    const [, y = "center"] = String(objectPosition || "center center").toLowerCase().split(/\s+/);
    if (y === "top" || y === "0%" || y === "0") return "flex-start";
    if (y === "bottom" || y === "100%" || y === "100") return "flex-end";
    return "center";
  }

  function normaliseImageScale(value) {
    const scale = Number(value || 100);
    return Math.max(50, Math.min(150, Number.isFinite(scale) ? scale : 100));
  }

  function imageMaxHeightValue(panel) {
    const legacyMaxHeight = Number(imageSetting(panel, "imageMaxHeight", 0));
    const defaultMaxHeight = Number(props.imageMaxHeight || 0) > 0 ? Number(props.imageMaxHeight) : 420;
    const mode = String(imageSetting(panel, "imageMaxHeightMode", legacyMaxHeight > 0 ? "custom" : "custom")).toLowerCase();
    if (mode === "auto") return "";
    const preset = Number(mode);
    if ([300, 400, 500, 600, 700].includes(preset)) return `${preset}px`;
    const custom = Number(imageSetting(panel, "imageMaxHeightCustom", legacyMaxHeight || defaultMaxHeight));
    return `${Math.max(220, Math.min(900, Number.isFinite(custom) ? custom : defaultMaxHeight))}px`;
  }

  function panelImageHeightValue(panel, fallbackHeight) {
    if (fallbackHeight === "auto") return "auto";
    const mode = String(imageSetting(panel, "panelImageHeightMode", props.panelImageHeightMode || "fixed")).toLowerCase();
    if (mode === "fixed") {
      const fixed = Number(imageSetting(panel, "panelImageFixedHeight", props.panelImageFixedHeight || props.imageHeight || 420));
      return `${Math.max(220, Math.min(900, Number.isFinite(fixed) ? fixed : 420))}px`;
    }
    if (mode === "auto") return "auto";
    return fallbackHeight;
  }

  const twoColumnGrid = (imageRight) => ({
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 1fr)",
    gridTemplateAreas: imageRight ? '"text image"' : '"image text"',
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
    boxSizing: "border-box",
  });

  const imageColumnStyle = {
    gridArea: "image",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
    position: "relative",
    boxSizing: "border-box",
  };

  const textColumnStyle = {
    gridArea: "text",
    minWidth: 0,
    maxWidth: "100%",
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
    boxSizing: "border-box",
  };

  function renderImageHalf(panel, idx, forEditor = false, halfHeight = "100%") {
    const isCard = panel.imageStyle === "card";
    const imageSrc = resolveAccordionPanelImage(panel);
    const objectFit = normaliseImageFit(imageSetting(panel, "imageFit", "contain"));
    const objectPosition = normaliseImagePosition(imageSetting(panel, "imageObjectPosition", "center center"), panel);
    const imageFlexAlign = objectPositionFlexAlign(objectPosition);
    const imageScale = normaliseImageScale(imageSetting(panel, "imageScale", 100)) / 100;
    const imagePadding = Math.max(0, Math.min(80, Number(imageSetting(panel, "imagePadding", 0)) || 0));
    const resolvedMaxHeight = imageMaxHeightValue(panel);
    const resolvedHalfHeight = panelImageHeightValue(panel, halfHeight);
    const imageMaxWidth = Number(imageSetting(panel, "imageMaxWidth", props.imageMaxWidth || 620)) || 620;
    const failedKey = panel.id || idx;
    const imageFailed = !!failedImages[failedKey] || isUnsafeAccordionImageUrl(imageSrc);
    const showImage = !!imageSrc && !imageFailed;
    if (imageSrc && imageFailed && shouldLogHeroVideoDebug()) {
      console.warn("[accordion image] invalid image URL", { panelId: panel.id, index: idx, imageSrc });
    }
    const imageEl = showImage ? (
      <img
        data-wb-controlled-image="scroll-stack"
        src={imageSrc}
        alt={panel.imageAlt || panel.heading}
        style={{
          width: "100%",
          height: resolvedHalfHeight === "auto" && objectFit === "contain" ? "auto" : "100%",
          maxWidth: objectFit === "contain" ? imageMaxWidth : "100%",
          maxHeight: objectFit === "contain" ? (resolvedMaxHeight || "420px") : "100%",
          minWidth: 0,
          objectFit,
          objectPosition,
          display: "block",
          borderRadius: isCard ? 16 : 0,
          transform: `scale(${imageScale})`,
          transformOrigin: objectPosition,
          backgroundPosition: objectFit === "contain" ? "center center" : undefined,
          backgroundRepeat: objectFit === "contain" ? "no-repeat" : undefined,
        }}
        onLoad={() => {
          if (typeof window !== "undefined") window.dispatchEvent(new Event("resize"));
        }}
        onError={() => {
          if (shouldLogHeroVideoDebug()) console.warn("[accordion image] failed to load", { panelId: panel.id, index: idx, imageSrc });
          setFailedImages((prev) => ({ ...prev, [failedKey]: true }));
        }}
      />
    ) : (
      <div style={{
        width: "100%", height: "100%",
        maxWidth: "100%",
        minWidth: 0,
        background: isCard ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
        color: isCard ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)",
        borderRadius: isCard ? 16 : 0,
      }}>
        <span style={{ fontSize: 48 }}>🖼️</span>
        {forEditor ? (
          <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 8, background: isCard ? "rgba(255,255,255,0.2)" : "rgba(14,165,233,0.15)", border: `1px dashed ${isCard ? "rgba(255,255,255,0.5)" : "rgba(14,165,233,0.5)"}`, color: isCard ? "#fff" : panel.accentColor, fontSize: 16, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
            🖼️ Upload Image
            <input ref={(el) => { fileInputRefs.current[idx] = el; }} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleImageUpload(idx, f); }} />
          </label>
        ) : (
          <span style={{ fontSize: 16 }}>Image not available</span>
        )}
      </div>
    );

    const replaceControls = forEditor ? (
      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6, zIndex: 4 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.2)", color: "#e2e8f0", borderRadius: 6, padding: "5px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }} onClick={(e) => e.stopPropagation()}>
          ↻ Replace
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleImageUpload(idx, f); }} />
        </label>
        <button type="button" onClick={(e) => { e.stopPropagation(); patchPanelImage(idx, ""); }} title="Remove image" style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", borderRadius: 6, padding: "5px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>×</button>
      </div>
    ) : null;
    const libraryControls = forEditor ? (
      <div style={{ position: "absolute", left: 10, bottom: 10, display: "flex", gap: 6, flexWrap: "wrap", zIndex: 4 }}>
        <button type="button" onClick={(e) => { e.stopPropagation(); openAccordionImageLibrary((src, asset) => patchPanelImage(idx, src, asset)); }} style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(125,211,252,0.35)", color: "#bae6fd", borderRadius: 6, padding: "5px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>Media Library</button>
        <button type="button" onClick={(e) => { e.stopPropagation(); openAccordionImageLibrary((src, asset) => patchPanelImage(idx, src, asset)); }} style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(125,211,252,0.35)", color: "#bae6fd", borderRadius: 6, padding: "5px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>Recent Images</button>
        <button type="button" onClick={(e) => { e.stopPropagation(); const src = window.prompt("Paste image URL", imageSrc || ""); if (src && !isUnsafeAccordionImageUrl(src)) patchPanelImage(idx, src); }} style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.2)", color: "#e2e8f0", borderRadius: 6, padding: "5px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>Paste URL</button>
        {imageSrc ? <button type="button" onClick={(e) => { e.stopPropagation(); patchPanelImage(idx, ""); }} style={{ background: "rgba(15,23,42,0.85)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", borderRadius: 6, padding: "5px 10px", fontSize: 16, cursor: "pointer", fontWeight: 600 }}>Remove Image</button> : null}
      </div>
    ) : null;

    if (isCard) {
      // Card-style: colored background with inset padded rounded card
      return (
        <div style={{ width: "100%", height: resolvedHalfHeight, maxHeight: resolvedMaxHeight || undefined, maxWidth: "100%", minWidth: 0, background: panel.imageCardBg, display: "flex", alignItems: imageFlexAlign, justifyContent: "center", overflow: "hidden", position: "relative", boxSizing: "border-box", padding: imagePadding }}>
          <div style={{ position: "relative", width: "100%", height: "100%", maxWidth: objectFit === "contain" ? imageMaxWidth : "100%", minWidth: 0, borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.2)", display: "flex", alignItems: imageFlexAlign, justifyContent: "center" }}>
            {imageEl}
            {replaceControls}
            {libraryControls}
          </div>
        </div>
      );
    }

    // Bleed-style: full-bleed image
    return (
      <div style={{ width: "100%", height: resolvedHalfHeight, maxHeight: resolvedMaxHeight || undefined, maxWidth: "100%", minWidth: 0, position: "relative", overflow: "hidden", boxSizing: "border-box", padding: imagePadding }}>
        <div style={{ width: "100%", height: "100%", maxWidth: objectFit === "contain" ? imageMaxWidth : "100%", minWidth: 0, overflow: "hidden", display: "flex", alignItems: imageFlexAlign, justifyContent: "center", margin: "0 auto" }}>
          {imageEl}
        </div>
        {replaceControls}
        {libraryControls}
      </div>
    );
  }

  // -- Text content -----------------------------------------------------------
  function renderPanelContent(panel, idx, options = {}) {
    const tc = panel.textColor;
    const ac = panel.accentColor;
    const contentVerticalSetting = String(panel.contentVerticalAlign || props.contentVerticalAlign || props.textVerticalAlign || "center").toLowerCase();
    const contentJustify = contentVerticalSetting === "top" || contentVerticalSetting === "start"
      ? "flex-start"
      : contentVerticalSetting === "bottom" || contentVerticalSetting === "end"
        ? "flex-end"
        : "center";
    const contentPadTop = contentJustify === "flex-start" ? Math.max(24, Number(props.contentTopPadding ?? 72)) : 0;
    const isLight = tc !== "#ffffff"; // light background panels use darker body text
    const edgeOut = editor ? "1px dashed rgba(14,165,233,0.35)" : "none";
    const edgePad = editor ? "4px 8px" : "0";
    const bodyColor = isLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.72)";
    const isPill = panel.ctaStyle === "pill";
    const ctaBg = isLight ? tc : ac;
    const showCta = panel.showCta !== false;
    const buttonFullWidth = panel.buttonFullWidth === true || props.buttonFullWidth === true;
    const eyebrowHeading = normalizeAccordionHeading(panel.eyebrow || (editor ? "Category label" : ""), {
      color: ac,
      fontSize: "16px",
      fontWeight: 600,
    });
    const panelHeading = normalizeAccordionHeading(panel.heading || "Your headline", {
      color: tc,
      fontSize: `${compact ? 28 : (panel.headingSize || 46)}px`,
      fontWeight: panel.headingWeight || 800,
    });

    const contentPadding = options.padding ?? (compact ? "40px 24px 48px" : `${contentPadTop}px 64px 0 72px`);

    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: contentJustify, gap: 20, padding: contentPadding, height: "100%", width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", overflow: "hidden" }}>

        {/* Eyebrow — colored dot + label */}
        {(panel.eyebrow || editor) ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
            {panel.eyebrowDot ? (
              <span style={{ width: 12, height: 12, borderRadius: 3, background: ac, display: "inline-block", flexShrink: 0 }} />
            ) : null}
            {editor ? (
              <div
                data-website-inline-editor="true"
                contentEditable
                suppressContentEditableWarning
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  if (shouldSkipToolbarBlur(e)) return;
                  patchPanel(idx, { eyebrow: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
                }}
                style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.06em", color: ac, outline: edgeOut, borderRadius: 4, padding: edgePad }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(panel.eyebrow || "Category label") }}
              />
            ) : (
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.06em", color: ac, outline: edgeOut, borderRadius: 4, padding: edgePad, ...eyebrowHeading.style }}>
                {eyebrowHeading.text}
              </div>
            )}
          </div>
        ) : null}

        {/* Heading */}
        {editor ? (
          <div
            data-website-inline-editor="true"
            contentEditable
            suppressContentEditableWarning
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => {
              if (shouldSkipToolbarBlur(e)) return;
              patchPanel(idx, { heading: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
            }}
            style={{ fontSize: compact ? 28 : (panel.headingSize || props.headingFontSize || 46), fontWeight: panel.headingWeight || 800, lineHeight: 1.08, color: tc, outline: edgeOut, borderRadius: 6, padding: edgePad, margin: 0, width: "100%", maxWidth: Number(panel.headingMaxWidth || props.headingMaxWidth || panel.textMaxWidth || props.textMaxWidth || 560), minWidth: 0, whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "normal", boxSizing: "border-box" }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(panel.heading || "Your headline") }}
          />
        ) : (
          <div
            style={{ fontSize: compact ? 28 : (panel.headingSize || props.headingFontSize || 46), fontWeight: panel.headingWeight || 800, lineHeight: 1.08, color: tc, outline: edgeOut, borderRadius: 6, padding: edgePad, margin: 0, width: "100%", maxWidth: Number(panel.headingMaxWidth || props.headingMaxWidth || panel.textMaxWidth || props.textMaxWidth || 560), minWidth: 0, whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "normal", boxSizing: "border-box", ...panelHeading.style }}
          >
            {panelHeading.text}
          </div>
        )}

        {/* Body */}
        {(panel.body || editor) ? (
          <div
            data-website-inline-editor={editor ? "true" : undefined}
            contentEditable={editor || undefined}
            suppressContentEditableWarning
            onMouseDown={(e) => editor && e.stopPropagation()}
            onPointerDown={(e) => editor && e.stopPropagation()}
            onBlur={(e) => {
              if (!editor) return;
              if (shouldSkipToolbarBlur(e)) return;
              patchPanel(idx, { body: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
            }}
            style={{ fontSize: panel.bodySize || 17, lineHeight: 1.75, color: bodyColor, outline: edgeOut, borderRadius: 6, padding: edgePad, width: "100%", maxWidth: Number(panel.bodyMaxWidth || props.bodyMaxWidth || panel.textMaxWidth || props.textMaxWidth || 620), minWidth: 0, whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "normal", boxSizing: "border-box" }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(panel.body || (editor ? "Add your body text here." : "")) }}
          />
        ) : null}

        {/* CTA */}
        {showCta && (panel.ctaText || editor) ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", width: buttonFullWidth ? "100%" : undefined }}>
            {panel.ctaText ? (
              <a
                href={editor ? undefined : resolvePublishedNavHref({ href: panel.ctaUrl || "#" }, navigationContext)}
                onClick={(e) => editor && e.preventDefault()}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                  width: buttonFullWidth ? "100%" : undefined,
                  background: ctaBg, color: isLight ? "#ffffff" : "#ffffff",
                  borderRadius: isPill ? 100 : 10,
                  padding: isPill ? "14px 32px" : "13px 28px",
                  fontSize: 16, fontWeight: 600, textDecoration: "none",
                  cursor: editor ? "default" : "pointer",
                  border: isPill ? "none" : "none",
                  transition: "opacity 0.2s",
                }}
              >
                <div
                  data-website-inline-editor={editor ? "true" : undefined}
                  contentEditable={editor || undefined}
                  suppressContentEditableWarning
                  onMouseDown={(e) => editor && e.stopPropagation()}
                  onPointerDown={(e) => editor && e.stopPropagation()}
                  onBlur={(e) => {
                    if (!editor) return;
                    if (shouldSkipToolbarBlur(e)) return;
                    patchPanel(idx, { ctaText: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
                  }}
                  style={{ outline: editor ? "1px dashed rgba(255,255,255,0.4)" : "none", borderRadius: 4, display: "inline", color: "#fff" }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(panel.ctaText) }}
                />
                {!editor ? <span style={{ fontSize: 18 }}>→</span> : null}
              </a>
            ) : null}
            {editor ? (
              <input
                type="text"
                value={panel.ctaUrl || ""}
                onChange={(e) => patchPanel(idx, { ctaUrl: e.target.value })}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="CTA URL (https://...)"
                style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: tc, borderRadius: 6, padding: "8px 12px", fontSize: 16 }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  const stackMode = String(props.stackMode || props.orientation || props.scrollStackMode || "").toLowerCase();
  const useSideStack = stackMode === "side" || stackMode === "horizontal" || stackMode === "right";
  const desktopRenderMode = String(props.displayMode || props.renderMode || props.mode || "").toLowerCase();
  const forceDesktopAccordion = desktopRenderMode === "accordion" || desktopRenderMode === "stacked-accordion";

  function renderStackedAccordion(forEditor = false, isCompact = false) {
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : (isCompact ? 390 : 1440);
    const isMobile = isCompact && viewportWidth <= 560;
    const isTablet = isCompact && !isMobile;
    const closedHeight = isMobile ? 56 : isTablet ? 60 : Number(props.closedRowHeight || props.accordionHeaderHeight || 64);
    const headerPadding = isMobile ? "16px" : isTablet ? "18px 24px" : (props.headerPadding || "20px 32px");
    const contentPadding = isMobile ? "24px 16px" : isTablet ? "32px" : (props.contentPadding || `${Number(props.cardPadding ?? 48)}px`);
    const openMinHeight = isMobile ? 0 : isTablet ? Number(props.tabletOpenCardMinHeight || 700) : Number(props.openCardMinHeight || props.cardMinHeight || props.cardHeight || 560);
    const cardGap = isMobile ? 24 : isTablet ? 28 : Number(props.cardGap || 40);
    const cardRadius = Number(props.cardRadius ?? 20);
    const sectionPadding = isMobile ? "32px 0" : isTablet ? "48px 24px" : `${Number(props.paddingTop ?? 60)}px ${Number(props.paddingRight ?? 48)}px ${Number(props.paddingBottom ?? 60)}px ${Number(props.paddingLeft ?? 48)}px`;
    const sectionMaxWidth = Number(props.contentMaxWidth || props.baseLayoutWidth || 1440);
    const activeHeight = isMobile || isTablet ? "auto" : Number(props.activeCardHeight || props.cardHeight || 560);
    const activeMaxHeight = isMobile || isTablet ? undefined : (props.activeCardMaxHeight || "70vh");
    const openGridColumns = isCompact ? "minmax(0, 1fr)" : "minmax(0, 45%) minmax(0, 55%)";
    const imageHeight = isMobile || isTablet ? "auto" : `${Number(props.imageHeight || props.panelImageFixedHeight || 420)}px`;
    const imageHalfHeight = isMobile || isTablet ? "auto" : `${Number(props.imageHeight || props.panelImageFixedHeight || 420)}px`;

    return (
      <section
        ref={sectionRef}
        style={{
          width: "100%",
          minHeight: isMobile ? "auto" : Number(props.minSectionHeight || props.sectionMinHeight || 620),
          height: "auto",
          background: props.backgroundColor || panels[0]?.backgroundColor || "#07111f",
          padding: sectionPadding,
          boxSizing: "border-box",
        }}
      >
        <div style={{ width: "100%", maxWidth: sectionMaxWidth, margin: "0 auto" }}>
          {panels.map((panel, idx) => {
            const isOpen = idx === activePanelIndex;
            const isFirst = idx === 0;
            const isLast = idx === panels.length - 1;
            const imageRight = panel.imagePosition !== "left";
            const tc = panel.textColor || "#ffffff";
            const ac = panel.accentColor || "#0ea5e9";
            const stripHeading = normalizeAccordionHeading(panel.eyebrow || panel.heading || `Panel ${idx + 1}`, {
              color: tc,
              fontSize: isMobile ? "15px" : "16px",
              fontWeight: 700,
            });
            const contentAreas = isCompact
              ? '"text" "image"'
              : (imageRight ? '"text image"' : '"image text"');
            const contentVerticalSetting = String(panel.contentVerticalAlign || props.contentVerticalAlign || props.textVerticalAlign || "top").toLowerCase();
            const openAlignItems = contentVerticalSetting === "bottom" || contentVerticalSetting === "end"
              ? "end"
              : contentVerticalSetting === "center" || contentVerticalSetting === "centre"
                ? "center"
                : "start";
            const openFlexAlign = openAlignItems === "end" ? "flex-end" : openAlignItems === "center" ? "center" : "flex-start";

            return (
              <article
                key={panel.id}
                style={{
                  width: "100%",
                  background: panel.backgroundColor,
                  color: tc,
                  borderRadius: isOpen
                    ? cardRadius
                    : `${isFirst ? 18 : 0}px ${isFirst ? 18 : 0}px ${isLast ? 18 : 0}px ${isLast ? 18 : 0}px`,
                  overflow: "hidden",
                  border: Number(props.cardBorderWidth ?? 0) > 0 ? `${Number(props.cardBorderWidth)}px solid ${props.cardBorderColor || "#3b82f6"}` : "1px solid rgba(255,255,255,0.10)",
                  boxShadow: isOpen ? "0 18px 46px rgba(0,0,0,0.22)" : "none",
                  marginTop: idx === 0 ? 0 : Number(props.rowGap ?? 0),
                }}
              >
                <button
                  type="button"
                  onClick={() => setActivePanelIndex(idx)}
                  style={{
                    width: "100%",
                    minHeight: closedHeight,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: headerPadding,
                    background: panel.backgroundColor,
                    color: tc,
                    border: 0,
                    borderBottom: isOpen && props.hideHeaderDivider !== true ? `1px solid ${tc}1a` : "none",
                    cursor: "pointer",
                    textAlign: "left",
                    boxSizing: "border-box",
                  }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: ac, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...stripHeading.style }}>
                    {stripHeading.text}
                  </span>
                  {forEditor ? (
                    <span style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
                      <span onClick={(event) => { event.stopPropagation(); removePanel(idx); }} style={{ color: "#fca5a5", fontWeight: 800 }}>Remove</span>
                    </span>
                  ) : null}
                </button>

                {isOpen ? (
                  <div
                    style={{
                      minHeight: openMinHeight || undefined,
                      height: activeHeight,
                      maxHeight: activeMaxHeight,
                      display: "grid",
                      gridTemplateColumns: openGridColumns,
                      gridTemplateAreas: contentAreas,
                      alignItems: openAlignItems,
                      alignContent: openAlignItems,
                      gap: cardGap,
                      padding: contentPadding,
                      boxSizing: "border-box",
                      overflow: "visible",
                    }}
                  >
                    <div style={{ ...textColumnStyle, overflow: "visible", alignItems: openFlexAlign, alignSelf: openAlignItems }}>
                      {renderPanelContent(panel, idx, { padding: 0 })}
                    </div>
                    <div style={{ ...imageColumnStyle, overflow: "visible", display: "flex", alignItems: openFlexAlign, alignSelf: openAlignItems, justifyContent: "center", height: imageHeight }}>
                      {renderImageHalf(panel, idx, forEditor, imageHalfHeight)}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
          {forEditor ? (
            <div style={{ padding: "18px 0 0", display: "flex", justifyContent: "center" }}>
              <button type="button" onClick={(e) => { e.stopPropagation(); addPanel(); }} style={{ background: "rgba(14,165,233,0.10)", border: "2px dashed rgba(14,165,233,0.4)", color: "#0ea5e9", borderRadius: 10, padding: "12px 28px", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>+ Add Panel</button>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  // This effect must run unconditionally on every render (Rules of Hooks) even though its
  // scroll-tracking behaviour only matters for the desktop sticky-stack branch further down.
  // It used to live after the editor/compact early returns below, so whenever `compact`
  // changed value on an already-mounted instance (e.g. corrected from an SSR guess to the
  // real viewport width after hydration) React would see a different hook count between
  // renders and crash with "Rendered fewer hooks than expected."
  React.useEffect(() => {
    if (editor || compact || typeof window === "undefined") return;
    const n = panels.length;
    if (n === 0) return;

    function onScroll() {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrolledIn = -rect.top;
      const totalRange = el.offsetHeight - window.innerHeight;
      const raw = Math.max(0, Math.min(n - 0.0001, (scrolledIn / Math.max(1, totalRange)) * n));
      setScrollProgress(raw);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [editor, compact, panels.length]);

  // -- EDITOR MODE: flat stacked panels, no sticky ----------------------------
  if (editor) {
    return renderStackedAccordion(true, false);
  }

  // -- COMPACT / MOBILE: image on top, text below -----------------------------
  if (compact) {
    return renderStackedAccordion(false, true);
  }

  if (forceDesktopAccordion) {
    return renderStackedAccordion(false, false);
  }

  // -- PREVIEW MODE: Stacked Card Deck ----------------------------------------
  // Visual: past cards compress to a slim coloured header strip at the top.
  //         Future cards peek from the bottom so the whole deck is visible.
  //         The active card fills the space between those two zones.
  // Scroll: 100vh of dwell per card — each card slides smoothly from the
  //         bottom peek area up to its settled stack position.
  // Click:  any past/future card header ? window.scrollTo() jumps to it.
  //
  // Z-index rule: later cards (higher idx) sit ON TOP of earlier ones.
  //   This means a future card's peek (higher z) overlaps the active card's
  //   bottom edge — exactly the "physical card deck" layering we want.

  const PEEK = Math.max(48, Math.min(140, Number(props.peekHeight ?? props.cardPeekHeight ?? 52))); // px - visible header strip when stacked

  function jumpToCard(targetIdx) {
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const totalRange = el.offsetHeight - window.innerHeight;
    const targetScrolledIn = (targetIdx / panels.length) * totalRange;
    window.scrollTo({ top: window.scrollY + (targetScrolledIn - (-rect.top)), behavior: "smooth" });
  }

  const cardLead = Number(props.cardLead ?? 0);
  const hInset = Number(props.cardInset ?? 0);
  const n = panels.length;
  const vp = Math.max(360, containerMetrics.height);
  const vw = Math.max(320, containerMetrics.width);
  if (useSideStack) {
    const SIDE_PEEK = Math.max(58, Math.min(170, Number(props.peekWidth ?? props.cardPeekWidth ?? props.sidePeekWidth ?? PEEK)));
    const stackSide = String(props.stackSide || props.sideStackSide || props.stackEdge || "left").toLowerCase() === "right" ? "right" : "left";
    const openPanelWidth = Math.min(vw, Math.max(Math.min(720, vw), vw - Math.max(0, n - 1) * SIDE_PEEK));
    const activeContentWidth = Math.max(0, openPanelWidth - SIDE_PEEK);
    const sideStackNarrow = activeContentWidth < 760;
    const contentColumns = sideStackNarrow
      ? "minmax(0, 1fr)"
      : "minmax(0, 1fr) minmax(0, 1fr)";
    return (
      <section ref={sectionRef} style={{ height: `${n * 100}vh`, position: "relative", background: props.backgroundColor || panels[0]?.backgroundColor || "#07111f" }}>
        <div ref={stickyRef} style={{ position: "sticky", top: stickyTop, height: `calc(100vh - ${stickyTop}px)`, overflow: "hidden" }}>
          {panels.map((panel, idx) => {
            const dist = idx - scrollProgress;
            let settledX;
            let futureX;
            if (stackSide === "right") {
              settledX = vw - openPanelWidth - idx * SIDE_PEEK;
              futureX = (idx - n + 1) * SIDE_PEEK;
            } else {
              settledX = idx * SIDE_PEEK;
              futureX = vw - (n - idx) * SIDE_PEEK;
            }
            let x;
            if (dist <= 0) {
              x = cardLead + settledX;
            } else if (dist < 1) {
              const t = 1 - dist;
              x = futureX + t * (cardLead + settledX - futureX);
            } else {
              x = futureX;
            }

            const panelWidth = openPanelWidth;
            const isPast = dist < -0.05;
            const isFuture = dist > 0.05;
            const imageRight = panel.imagePosition !== "left";
            const tc = panel.textColor || "#ffffff";
            const ac = panel.accentColor || "#0ea5e9";
            const contentGridColumns = contentColumns;
            const stripHeading = normalizeAccordionHeading(panel.eyebrow || panel.heading || `Panel ${idx + 1}`, {
              color: tc,
              fontSize: "15px",
              fontWeight: 800,
            });

            return (
              <div
                key={panel.id}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: panelWidth,
                  height: "100%",
                  transform: `translateX(${x}px)`,
                  zIndex: idx + 1,
                  background: panel.backgroundColor,
                  color: tc,
                  borderRadius: idx > 0 ? (stackSide === "right" ? `0 ${Number(props.cardRadius ?? 18)}px ${Number(props.cardRadius ?? 18)}px 0` : `${Number(props.cardRadius ?? 18)}px 0 0 ${Number(props.cardRadius ?? 18)}px`) : 0,
                  overflow: "hidden",
                  boxShadow: idx > 0 ? (stackSide === "right" ? "10px 0 34px rgba(0,0,0,0.26)" : "-10px 0 34px rgba(0,0,0,0.26)") : "none",
                  border: Number(props.cardBorderWidth ?? 0) > 0 ? `${Number(props.cardBorderWidth)}px solid ${props.cardBorderColor || "#3b82f6"}` : "none",
                }}
              >
                <div
                  onClick={() => (isPast || isFuture) ? jumpToCard(idx) : undefined}
                  style={{
                    position: "absolute",
                    left: stackSide === "left" ? 0 : "auto",
                    right: stackSide === "right" ? 0 : "auto",
                    top: 0,
                    bottom: 0,
                    width: SIDE_PEEK,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    padding: "22px 0",
                    cursor: (isPast || isFuture) ? "pointer" : "default",
                    background: panel.backgroundColor,
                    borderRight: stackSide === "left" && props.hideHeaderDivider !== true ? `1px solid ${tc}1a` : "none",
                    borderLeft: stackSide === "right" && props.hideHeaderDivider !== true ? `1px solid ${tc}1a` : "none",
                    userSelect: "none",
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", display: "flex", alignItems: "center", gap: 12, maxHeight: "86%" }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: ac, flexShrink: 0 }} />
                    <span style={{ fontSize: 15, fontWeight: 800, color: tc, letterSpacing: "0.05em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...stripHeading.style }}>
                      {stripHeading.text}
                    </span>
                  </div>
                </div>

                <div style={{ marginLeft: stackSide === "left" ? SIDE_PEEK : 0, marginRight: stackSide === "right" ? SIDE_PEEK : 0, width: `calc(100% - ${SIDE_PEEK}px)`, maxWidth: `calc(100% - ${SIDE_PEEK}px)`, minWidth: 0, height: "100%", display: "grid", gridTemplateColumns: contentGridColumns, gridTemplateRows: sideStackNarrow ? "minmax(0, 45%) minmax(0, 55%)" : undefined, gridTemplateAreas: sideStackNarrow ? '"image" "text"' : (imageRight ? '"text image"' : '"image text"'), overflow: "hidden", boxSizing: "border-box" }}>
                  <div style={{ ...imageColumnStyle, minWidth: 0 }}>
                    {renderImageHalf(panel, idx, false, "100%")}
                  </div>
                  <div style={{ ...textColumnStyle, minWidth: 0 }}>
                    {renderPanelContent(panel, idx)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} style={{ width: "100%", maxWidth: "none", margin: 0, height: `${n * 100}vh`, position: "relative", background: props.backgroundColor || panels[0]?.backgroundColor || "#07111f", overflow: "visible" }}>
      <div ref={stickyRef} style={{ position: "sticky", top: stickyTop, height: `calc(100vh - ${stickyTop}px)`, overflow: "hidden" }}>
        {panels.map((panel, idx) => {
          // dist < 0 ? past (settled at top), dist = 0 ? active, dist > 0 ? future
          const dist = idx - scrollProgress;

          // translateY for this card:
          //  Past/active: settled at its stacked-header row  ?  idx × PEEK
          //  Transitioning in (0 < dist < 1): lerp from bottom-peek to settled
          //  Future (dist = 1): peeking from the bottom of the viewport
          let y;
          if (dist <= 0) {
            y = cardLead + idx * PEEK;
          } else if (dist < 1) {
            const t = 1 - dist; // 0 ? 1 as card arrives
            const yFuture = vp - (n - idx) * PEEK;
            y = yFuture + t * (cardLead + idx * PEEK - yFuture);
          } else {
            y = vp - (n - idx) * PEEK;
          }

          const isPast   = dist < -0.05;
          const isFuture = dist >  0.05;
          const imageRight = panel.imagePosition !== "left";
          const tc = panel.textColor || "#ffffff";
          const ac = panel.accentColor || "#0ea5e9";
          const stripHeading = normalizeAccordionHeading(panel.eyebrow || panel.heading || `Panel ${idx + 1}`, {
            color: tc,
            fontSize: "16px",
            fontWeight: 600,
          });

          return (
            <div
              key={panel.id}
              style={{
                position: "absolute",
                left: hInset, right: hInset, top: 0,
                height: "100vh",
                transform: `translateY(${y}px)`,
                zIndex: idx + 1,             // later cards always on top
                background: panel.backgroundColor,
                color: tc,
                borderRadius: (idx > 0 || hInset > 0) ? `${Number(props.cardRadius ?? 18)}px ${Number(props.cardRadius ?? 18)}px 0 0` : 0,
                overflow: "hidden",
                boxShadow: idx > 0 ? "0 -6px 24px rgba(0,0,0,0.22)" : "none",
                border: Number(props.cardBorderWidth ?? 0) > 0 ? `${Number(props.cardBorderWidth)}px solid ${props.cardBorderColor || "#3b82f6"}` : "none",
              }}
            >
              {/* -- Slim header bar — always the visible strip when stacked -- */}
              <div
                onClick={() => (isPast || isFuture) ? jumpToCard(idx) : undefined}
                style={{
                  height: PEEK,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0 28px",
                  cursor: (isPast || isFuture) ? "pointer" : "default",
                  background: panel.backgroundColor,
                  borderBottom: props.hideHeaderDivider === true ? "none" : `1px solid ${tc}1a`,
                  userSelect: "none",
                }}
              >
                {/* Accent dot = card colour identity */}
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: ac, flexShrink: 0 }} />
                <span style={{ fontSize: 16, fontWeight: 600, color: tc, letterSpacing: "0.04em", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...stripHeading.style }}>
                  {stripHeading.text}
                </span>
                {isPast ? (
                  <span style={{ fontSize: 16, color: `${tc}50`, fontWeight: 500, whiteSpace: "nowrap" }}>↑ scroll back</span>
                ) : isFuture ? (
                  <span style={{ fontSize: 16, color: `${tc}50`, fontWeight: 500, whiteSpace: "nowrap" }}>↓ coming up</span>
                ) : null}
              </div>

              {/* -- Full card content: image split + text panel -- */}
              <div style={{ ...twoColumnGrid(imageRight), height: `calc(100vh - ${PEEK}px)` }}>
                <div style={imageColumnStyle}>
                  {renderImageHalf(panel, idx, false, "100%")}
                </div>
                <div style={textColumnStyle}>
                  {renderPanelContent(panel, idx)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
