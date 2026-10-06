import React from "react";
import { PREMIUM_BORDER, asArray, DEFAULT_LAYOUT_WIDTH, ScrollReveal, getAnimationStyle } from "./wbAnimations";
import { sharedStyles, asRichHtml, asStyleObject, stripPlaceholder } from "./wbVariantStyles";
import { cleanInlineEditorHtml } from "../../../modules/website-builder/utils/inlineHtml";
import { resolveAssetField } from "../../../lib/website-builder/mediaAssets";
import { FAQAccordionItems } from "../../../modules/website-builder/blocks/accordion/AccordionBlock";


export function getListMarker(style, index) {
  if (style === "number") return `${index + 1}.`;
  if (style === "disc") return "•";
  return "?";
}


export function ColumnEditorCard({
  title,
  content,
  titleProp,
  contentProp,
  image,
  compact,
  editor,
  textColor,
  bodyTextColor,
  cardBackgroundColor,
  cardStyle,
  contentAlign,
  overlay,
  onSwap,
  sectionOrder,
  onReorderSection,
  onTitleChange,
  onContentChange,
  contentType,
  newsletterHeading,
  newsletterSubtitle,
  newsletterButtonText,
  newsletterButtonColor,
  newsletterButtonTextColor,
  onPatchNewsletter,
  imageHeight,
  onImageHeightChange,
  imageWidth,
  onImageWidthChange,
  newsletterImage,
  newsletterImageHeight,
  onNewsletterImageHeightChange,
  newsletterImageWidth,
  onNewsletterImageWidthChange,
  newsletterFields,
  subBlock,
  onRenderSubBlock,
  extraImages,
  onExtraImagesChange,
}) {
  const resolvedAlign = contentAlign || "left";
  const isNewsletter = contentType === "newsletter";
  const isBlock = false;
  const normalizedTitle = String(title || "").trim();
  const normalizedContent = String(content || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
  const [isImageHovered, setIsImageHovered] = React.useState(false);
  const [activeDrag, setActiveDrag] = React.useState(null);
  const imgContainerRef = React.useRef(null);
  const [isImageHoveredNL, setIsImageHoveredNL] = React.useState(false);
  const [activeDragNL, setActiveDragNL] = React.useState(null);
  const nlImgContainerRef = React.useRef(null);
  const normalizedExtraImages = Array.isArray(extraImages)
    ? extraImages
        .map((item) => (typeof item === "string" ? { src: item } : (item || {})))
        .filter((item) => editor || item.src)
    : [];
  const shouldShowEmptyTextPlaceholders = editor && !image && !normalizedExtraImages.length && !normalizedTitle && !normalizedContent;

  const startResizeNL = React.useCallback((e, dir) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startH = newsletterImageHeight || (nlImgContainerRef.current?.querySelector("img")?.offsetHeight || 180);
    const startW = newsletterImageWidth != null ? newsletterImageWidth : 100;
    const colW = nlImgContainerRef.current?.offsetWidth || 300;
    setActiveDragNL(dir);
    const onMove = (e2) => {
      const dx = e2.clientX - startX;
      const dy = e2.clientY - startY;
      if (dir.includes("s")) onNewsletterImageHeightChange?.(Math.max(40, Math.round(startH + dy)));
      if (dir.includes("n")) onNewsletterImageHeightChange?.(Math.max(40, Math.round(startH - dy)));
      if (dir.includes("e")) onNewsletterImageWidthChange?.(Math.round(Math.max(20, Math.min(100, startW + (dx / colW) * 100))));
      if (dir.includes("w")) onNewsletterImageWidthChange?.(Math.round(Math.max(20, Math.min(100, startW - (dx / colW) * 100))));
    };
    const onUp = () => {
      setActiveDragNL(null);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [newsletterImageHeight, newsletterImageWidth, onNewsletterImageHeightChange, onNewsletterImageWidthChange]);

  const startResize = React.useCallback((e, dir) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startH = imageHeight || (imgContainerRef.current?.querySelector("img")?.offsetHeight || 200);
    const startW = imageWidth != null ? imageWidth : 100;
    const colW = imgContainerRef.current?.offsetWidth || 300;
    setActiveDrag(dir);

    const onMove = (e2) => {
      const dx = e2.clientX - startX;
      const dy = e2.clientY - startY;
      if (dir.includes("s")) {
        onImageHeightChange?.(Math.max(40, Math.round(startH + dy)));
      }
      if (dir.includes("n")) {
        onImageHeightChange?.(Math.max(40, Math.round(startH - dy)));
      }
      if (dir.includes("e")) {
        const pct = Math.round(Math.max(20, Math.min(100, startW + (dx / colW) * 100)));
        onImageWidthChange?.(pct);
      }
      if (dir.includes("w")) {
        const pct = Math.round(Math.max(20, Math.min(100, startW - (dx / colW) * 100)));
        onImageWidthChange?.(pct);
      }
    };
    const onUp = () => {
      setActiveDrag(null);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [imageHeight, imageWidth, onImageHeightChange, onImageWidthChange]);

  const HANDLE_SIZE = 10;
  const HANDLE_BASE = {
    position: "absolute", width: HANDLE_SIZE, height: HANDLE_SIZE,
    background: "#fff", border: "2px solid #0ea5e9", borderRadius: 2,
    boxShadow: "0 1px 4px rgba(0,0,0,0.25)", zIndex: 10,
  };
  const handles = [
    { dir: "n",  style: { top: -HANDLE_SIZE/2, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" } },
    { dir: "s",  style: { bottom: -HANDLE_SIZE/2, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" } },
    { dir: "e",  style: { right: -HANDLE_SIZE/2, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } },
    { dir: "w",  style: { left: -HANDLE_SIZE/2, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } },
    { dir: "ne", style: { top: -HANDLE_SIZE/2, right: -HANDLE_SIZE/2, cursor: "nesw-resize" } },
    { dir: "nw", style: { top: -HANDLE_SIZE/2, left: -HANDLE_SIZE/2, cursor: "nwse-resize" } },
    { dir: "se", style: { bottom: -HANDLE_SIZE/2, right: -HANDLE_SIZE/2, cursor: "nwse-resize" } },
    { dir: "sw", style: { bottom: -HANDLE_SIZE/2, left: -HANDLE_SIZE/2, cursor: "nesw-resize" } },
  ];

  const nlBtnBg = newsletterButtonColor || "#2563eb";
  const nlBtnText = newsletterButtonTextColor || "#ffffff";

  const inlineEditStyle = (base) => ({
    ...base,
    outline: editor ? "1px dashed rgba(14,165,233,0.4)" : "none",
    borderRadius: 6,
    padding: editor ? "2px 4px" : 0,
  });

  return (
    <article style={{ borderRadius: 18, border: PREMIUM_BORDER, background: cardBackgroundColor || "#f8fafc", padding: isBlock ? 0 : compact ? 14 : 18, boxShadow: "0 10px 24px rgba(15,23,42,0.08)", textAlign: resolvedAlign, overflow: isBlock ? "hidden" : undefined, position: "relative", ...cardStyle }}>
      {overlay}
      {editor && onSwap ? (
        <button
          type="button"
          title="Swap columns"
          aria-label="Swap columns"
          onClick={(e) => { e.stopPropagation(); onSwap(); }}
          style={{ position: "absolute", top: 8, right: 8, zIndex: 20, background: "rgba(14,165,233,0.92)", border: "none", borderRadius: 8, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", padding: "4px 10px", boxShadow: "0 2px 8px rgba(14,165,233,0.4)", lineHeight: 1 }}
        >×</button>
      ) : null}
      <div style={{ position: "relative", zIndex: 1 }}>
      {isBlock ? (
        subBlock && onRenderSubBlock ? (
          onRenderSubBlock(subBlock)
        ) : (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: 14, border: "2px dashed rgba(148,163,184,0.3)", borderRadius: 12, margin: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
            Drag a block onto this column to embed it here
          </div>
        )
      ) : isNewsletter ? (
        <>
          {(newsletterImage || editor) ? (
            <div
              ref={nlImgContainerRef}
              onMouseEnter={() => editor && setIsImageHoveredNL(true)}
              onMouseLeave={() => { if (!activeDragNL) setIsImageHoveredNL(false); }}
              style={{ position: "relative", marginBottom: 12, display: "inline-block", width: newsletterImageWidth != null ? `${newsletterImageWidth}%` : "100%" }}
            >
              {newsletterImage ? (
                <img
                  src={newsletterImage}
                  alt="Newsletter image"
                  draggable={false}
                  style={{ width: "100%", height: newsletterImageHeight ? `${newsletterImageHeight}px` : undefined, aspectRatio: newsletterImageHeight ? undefined : "16 / 9", objectFit: "cover", borderRadius: 12, display: "block", userSelect: "none", pointerEvents: editor ? "none" : undefined }}
                />
              ) : (
                editor ? <div style={{ ...sharedStyles.galleryPlaceholder, borderRadius: 12, marginBottom: 0, minHeight: 80, fontSize: 16, opacity: 0.6 }}>Upload image above form</div> : null
              )}
              {editor && newsletterImage && (isImageHoveredNL || activeDragNL) && (
                <div style={{ position: "absolute", inset: 0, border: "2px solid #0ea5e9", borderRadius: 12, pointerEvents: "none" }} />
              )}
              {editor && newsletterImage && (isImageHoveredNL || activeDragNL) && handles.map(({ dir, style }) => (
                <div key={dir} onMouseDown={(e) => startResizeNL(e, dir)} style={{ ...HANDLE_BASE, ...style }} />
              ))}
            </div>
          ) : null}
          <h3
            contentEditable={editor} suppressContentEditableWarning
            onBlur={(e) => onPatchNewsletter?.({ newsletterHeading: e.currentTarget.textContent })}
            style={inlineEditStyle({ margin: 0, color: textColor || "#0f172a", fontSize: compact ? 17 : 20, fontWeight: 600 })}
          >{newsletterHeading || (editor ? "Newsletter Heading" : "Stay Updated")}</h3>
          {(newsletterSubtitle || editor) ? (
            <p
              contentEditable={editor} suppressContentEditableWarning
              onBlur={(e) => onPatchNewsletter?.({ newsletterSubtitle: e.currentTarget.textContent })}
              style={inlineEditStyle({ margin: "6px 0 0", color: bodyTextColor || "#475569", fontSize: compact ? 13 : 14, lineHeight: 1.5 })}
            >{newsletterSubtitle || (editor ? "Your subtitle here." : "")}</p>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {(newsletterFields && newsletterFields.length > 0 ? newsletterFields : [{ type: "email", placeholder: "Email address" }]).map((field, fi) => (
              editor ? (
                <div key={fi} style={{ borderRadius: 10, minHeight: 40, border: "1px solid #cbd5e1", background: "#ffffff", display: "flex", alignItems: "center", paddingLeft: 12, color: "#94a3b8", fontSize: 16 }}>
                  {field.placeholder || field.label || field.type}
                </div>
              ) : String(field?.type || "").toLowerCase() === "textarea" ? (
                <textarea
                  key={fi}
                  name={field?.name || `newsletter-field-${fi}`}
                  placeholder={field?.placeholder || field?.label || "Enter details"}
                  required={!!field?.required}
                  rows={4}
                  style={{ borderRadius: 10, minHeight: 108, border: "1px solid #cbd5e1", background: "#ffffff", display: "block", width: "100%", padding: "12px", color: "#0f172a", fontSize: 16, font: "inherit", boxSizing: "border-box", resize: "vertical" }}
                />
              ) : (
                <input
                  key={fi}
                  type={String(field?.type || "text").toLowerCase()}
                  name={field?.name || `newsletter-field-${fi}`}
                  placeholder={field?.placeholder || field?.label || "Enter details"}
                  required={!!field?.required}
                  style={{ borderRadius: 10, minHeight: 40, border: "1px solid #cbd5e1", background: "#ffffff", display: "block", width: "100%", padding: "0 12px", color: "#0f172a", fontSize: 16, font: "inherit", boxSizing: "border-box" }}
                />
              )
            ))}
            {editor ? (
              <div
                style={{ background: nlBtnBg, color: nlBtnText, border: "none", borderRadius: 10, padding: "0 12px", minHeight: 40, fontWeight: 600, fontSize: 16, cursor: "text", whiteSpace: "nowrap", alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <div
                  data-website-inline-editor="true"
                  data-text-prop="newsletterButtonText"
                  contentEditable
                  suppressContentEditableWarning
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === " ") {
                      event.preventDefault();
                      try {
                        document.execCommand("insertText", false, " ");
                      } catch {}
                    }
                  }}
                  onBlur={(e) => onPatchNewsletter?.({ newsletterButtonText: e.currentTarget.textContent })}
                  style={{
                    outline: "1px dashed rgba(255,255,255,0.45)",
                    borderRadius: 6,
                    padding: "2px 4px",
                    minWidth: 36,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {newsletterButtonText || "Subscribe"}
                </div>
              </div>
            ) : (
              <button type="button" style={{ background: nlBtnBg, color: nlBtnText, border: "none", borderRadius: 10, padding: "0 12px", minHeight: 40, fontWeight: 600, fontSize: 16, cursor: "pointer", whiteSpace: "nowrap", alignSelf: "stretch" }}>
                {newsletterButtonText || "Subscribe"}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {(function renderSections() {
            const order = Array.isArray(sectionOrder) ? sectionOrder : ["image", "title", "content"];
            const moveSection = (idx, dir) => {
              if (!onReorderSection) return;
              const next = [...order];
              const target = idx + dir;
              if (target < 0 || target >= next.length) return;
              [next[idx], next[target]] = [next[target], next[idx]];
              onReorderSection(next);
            };
            const sectionNodes = {
              image: ((image || normalizedExtraImages.length) ? (
                <div style={{ display: "grid", gap: 0, justifyItems: resolvedAlign === "center" ? "center" : resolvedAlign === "right" ? "end" : "start" }}>
                  {image ? (
                    <div
                      ref={imgContainerRef}
                      onMouseEnter={() => editor && setIsImageHovered(true)}
                      onMouseLeave={() => { if (!activeDrag) setIsImageHovered(false); }}
                      style={{ position: "relative", display: "inline-block", width: imageWidth != null ? `${imageWidth}%` : "100%" }}
                    >
                      <img
                        src={image}
                        alt={title || "Column image"}
                        draggable={false}
                        style={{ width: "100%", height: imageHeight ? `${imageHeight}px` : undefined, aspectRatio: imageHeight ? undefined : "16 / 10", objectFit: "cover", borderRadius: 14, display: "block", userSelect: "none", pointerEvents: editor ? "none" : undefined }}
                      />
                      {editor && (isImageHovered || activeDrag) && (
                        <div style={{ position: "absolute", inset: 0, border: "2px solid #0ea5e9", borderRadius: 14, pointerEvents: "none" }} />
                      )}
                      {editor && (isImageHovered || activeDrag) && handles.map(({ dir, style }) => (
                        <div key={dir} onMouseDown={(e) => startResize(e, dir)} style={{ ...HANDLE_BASE, ...style }} />
                      ))}
                    </div>
                  ) : null}
                  {normalizedExtraImages.map((extraImage, extraImageIndex) => {
                    const gap = Number.isFinite(Number(extraImage.gap)) ? Number(extraImage.gap) : 8;
                    const height = Number(extraImage.height) || undefined;
                    return extraImage.src ? (
                      <img
                        key={`${extraImage.src}-${extraImageIndex}`}
                        src={extraImage.src}
                        alt={extraImage.alt || title || "Column image"}
                        draggable={false}
                        style={{ width: "100%", height: height ? `${height}px` : undefined, aspectRatio: height ? undefined : "16 / 10", objectFit: "cover", borderRadius: 14, display: "block", marginTop: gap, userSelect: "none", pointerEvents: editor ? "none" : undefined }}
                      />
                    ) : editor ? (
                      <div key={`empty-extra-image-${extraImageIndex}`} style={{ ...sharedStyles.galleryPlaceholder, width: "100%", minHeight: height || 120, borderRadius: 14, marginTop: gap, fontSize: 14 }}>
                        Select image #{extraImageIndex + 2}
                      </div>
                    ) : null;
                  })}
                </div>
              ) : null),
              title: (normalizedTitle || shouldShowEmptyTextPlaceholders ? (
                <h3
                  data-website-inline-editor="true"
                  data-text-prop={titleProp}
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => onTitleChange?.(cleanInlineEditorHtml(event.currentTarget.innerHTML))}
                  style={{ margin: 0, color: textColor || "#0f172a", fontSize: compact ? 18 : 22, fontWeight: 600, textAlign: resolvedAlign, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "4px 6px" : 0, minHeight: editor && !normalizedTitle ? 32 : undefined }}
                  dangerouslySetInnerHTML={{ __html: normalizedTitle ? asRichHtml(title) : "Column title" }}
                />
              ) : null),
              content: (normalizedContent || shouldShowEmptyTextPlaceholders ? (
                <div
                  data-website-inline-editor="true"
                  data-text-prop={contentProp}
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => onContentChange?.(event.currentTarget.innerHTML)}
                  style={{ color: bodyTextColor || textColor || "#334155", fontSize: compact ? 14 : 16, lineHeight: 1.7, textAlign: resolvedAlign, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "6px 8px" : 0, minHeight: editor && !normalizedContent ? 40 : undefined }}
                  dangerouslySetInnerHTML={{ __html: normalizedContent ? asRichHtml(content) : "Column content" }}
                />
              ) : null),
            };
            return order.map((key, idx) => {
              const node = sectionNodes[key];
              if (!node) return null;
              return (
                <div key={key} style={{ position: "relative", marginBottom: 12 }}>
                  {editor && onReorderSection ? (
                    <div style={{ position: "absolute", top: 4, right: 4, zIndex: 20, display: "flex", flexDirection: "column", gap: 2 }}>
                      <button type="button" onClick={(e) => { e.stopPropagation(); moveSection(idx, -1); }} disabled={idx === 0} style={{ background: idx === 0 ? "rgba(148,163,184,0.3)" : "rgba(14,165,233,0.85)", border: "none", borderRadius: 5, color: "#fff", fontSize: 12, fontWeight: 700, cursor: idx === 0 ? "default" : "pointer", padding: "1px 6px", lineHeight: 1.4 }}>×</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); moveSection(idx, 1); }} disabled={idx === order.length - 1} style={{ background: idx === order.length - 1 ? "rgba(148,163,184,0.3)" : "rgba(14,165,233,0.85)", border: "none", borderRadius: 5, color: "#fff", fontSize: 12, fontWeight: 700, cursor: idx === order.length - 1 ? "default" : "pointer", padding: "1px 6px", lineHeight: 1.4 }}>×</button>
                    </div>
                  ) : null}
                  {node}
                </div>
              );
            });
          })()}
        </>
      )}
      </div>
    </article>
  );
}


export function resolveSplitFaqBlockProps(props = {}) {
  return {
    ...(props.faqBlock || {}),
    items: asArray(props.faqBlock?.items || props.items).map((item, idx) => {
      const question = item?.question || item?.heading || item?.q || `Question ${idx + 1}`;
      const answer = item?.answer || item?.content || item?.a || "Answer";
      return {
        ...item,
        id: item?.id || `split-faq-item-${idx}`,
        question,
        answer,
        heading: question,
        content: answer,
      };
    }),
    faqStartCollapsed: props.faqBlock?.faqStartCollapsed ?? props.faqStartCollapsed,
    faqAllowMultipleOpen: props.faqBlock?.faqAllowMultipleOpen ?? props.faqAllowMultipleOpen,
    itemBackgroundColor: props.faqBlock?.itemBackgroundColor ?? props.itemBackgroundColor,
    itemBorderColor: props.faqBlock?.itemBorderColor ?? props.itemBorderColor,
    arrowBackgroundColor: props.faqBlock?.arrowBackgroundColor ?? props.arrowBackgroundColor,
    chevronColor: props.faqBlock?.chevronColor ?? props.chevronColor,
    questionColor: props.faqBlock?.questionColor ?? props.questionColor,
    answerColor: props.faqBlock?.answerColor ?? props.answerColor,
    questionFontWeight: props.faqBlock?.questionFontWeight ?? props.questionFontWeight,
    questionFontSize: props.faqBlock?.questionFontSize ?? props.questionFontSize,
    answerFontSize: props.faqBlock?.answerFontSize ?? props.answerFontSize,
    questionLineHeight: props.faqBlock?.questionLineHeight ?? props.questionLineHeight,
    answerLineHeight: props.faqBlock?.answerLineHeight ?? props.answerLineHeight,
    faqVariant: props.faqBlock?.faqVariant ?? props.faqVariant ?? "source-split",
    faqAnimation: props.faqBlock?.faqAnimation ?? props.faqAnimation ?? "fade-up",
    faqAnimationDelay: props.faqBlock?.faqAnimationDelay ?? props.faqAnimationDelay ?? 0.18,
    faqAnimationSpeed: props.faqBlock?.faqAnimationSpeed ?? props.faqAnimationSpeed ?? 0.9,
    sectionAnimation: props.faqBlock?.sectionAnimation ?? "fade-up",
    sectionAnimationDelay: props.faqBlock?.sectionAnimationDelay ?? 0.12,
    sectionAnimationSpeed: props.faqBlock?.sectionAnimationSpeed ?? 0.9,
    faqPanelBackgroundColor: props.faqBlock?.faqPanelBackgroundColor ?? props.faqPanelBackgroundColor,
    faqPanelBorderColor: props.faqBlock?.faqPanelBorderColor ?? props.faqPanelBorderColor,
    faqMaxWidth: props.faqBlock?.faqMaxWidth ?? props.faqMaxWidth,
  };
}


export function resolveSplitHeadlineBlockProps(props = {}) {
  return {
    ...(props.headlineBlock || {}),
    content: props.headlineBlock?.content ?? props.headline ?? "",
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
}


export function resolveSplitBodyBlockProps(props = {}) {
  return {
    ...(props.bodyBlock || {}),
    content: props.bodyBlock?.content ?? props.subheadline ?? "",
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
}


export function SplitFaqBlock({ props, compact, editor = false, onChangeBlock, sectionAnimationStyle, assets, layoutWidth = null }) {
  const faqBlockProps = resolveSplitFaqBlockProps(props);
  const headlineBlockProps = resolveSplitHeadlineBlockProps(props);
  const bodyBlockProps = resolveSplitBodyBlockProps(props);
  const items = faqBlockProps.items;
  const splitBackgroundImage = resolveAssetField(props, "backgroundImage", assets);
  const [viewportWidth, setViewportWidth] = React.useState(() => (typeof window !== "undefined" ? window.innerWidth : 1440));
  const [openItems, setOpenItems] = React.useState(() => {
    if (faqBlockProps.faqStartCollapsed) return [];
    return items.length ? [0] : [];
  });
  const allowMultipleOpen = !!faqBlockProps.faqAllowMultipleOpen;
  const isTabletLike = !compact && viewportWidth <= 1100;
  const shouldRunAnimations = !editor;
  const splitParallaxEnabled = !!splitBackgroundImage && !!props.enableParallax;
  const splitParallaxActive = splitParallaxEnabled && !compact;
  const splitContentWidth = Math.max(320, Number(props.blockMaxWidth || layoutWidth || props.baseLayoutWidth || DEFAULT_LAYOUT_WIDTH));
  const contentPanelPadX = compact
    ? 20
    : isTabletLike
      ? 40
      : Math.min(120, Math.max(40, Math.round(splitContentWidth * 0.08)));

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(() => {
    if (!items.length) {
      setOpenItems([]);
      return;
    }
    setOpenItems((current) => {
      const next = current.filter((idx) => idx >= 0 && idx < items.length);
      if (next.length) return next;
      return faqBlockProps.faqStartCollapsed ? [] : [0];
    });
  }, [items.length, faqBlockProps.faqStartCollapsed]);

  function toggleItem(itemIndex) {
    setOpenItems((current) => {
      const isOpen = current.includes(itemIndex);
      if (allowMultipleOpen) {
        return isOpen ? current.filter((idx) => idx !== itemIndex) : [...current, itemIndex];
      }
      if (isOpen) return [];
      return [itemIndex];
    });
  }

  function patchItem(itemIndex, patch) {
    if (!editor || typeof onChangeBlock !== "function") return;
    const nextItems = items.map((item, currentIndex) => {
      if (currentIndex !== itemIndex) return item;
      const nextQuestion = patch.question ?? item.question;
      const nextAnswer = patch.answer ?? item.answer;
      return {
        ...item,
        question: nextQuestion,
        heading: nextQuestion,
        answer: nextAnswer,
        content: nextAnswer,
      };
    });
    onChangeBlock({
      ...props,
      faqBlock: {
        ...(props.faqBlock || {}),
        items: nextItems,
      },
    });
  }

  const splitRatioMap = {
    "33-67": "1fr 2fr",
    "40-60": "2fr 3fr",
    "43-57": "434fr 563fr",
    "50-50": "1fr 1fr",
    "45-55": "0.9fr 1.1fr",
    "55-45": "1.1fr 0.9fr",
    "57-43": "1.325fr 1fr",
    "60-40": "3fr 2fr",
    "67-33": "2fr 1fr",
  };
  const splitLeftFractionMap = {
    "33-67": 1 / 3,
    "40-60": 0.4,
    "43-57": 434 / 997,
    "50-50": 0.5,
    "45-55": 0.45,
    "55-45": 0.55,
    "57-43": 0.57,
    "60-40": 0.6,
    "67-33": 2 / 3,
  };
  const splitLeftFraction = splitLeftFractionMap[props.splitLayout] || 0.5;
  const splitFixedBackgroundOffset = Math.round((splitLeftFraction - 1) * splitContentWidth * 0.5);
  const splitFixedBackgroundX = `calc(50% + ${splitFixedBackgroundOffset}px)`;
  const splitBackgroundPositionY = (() => {
    const tokens = String(props.backgroundPosition || "center center").trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return "center";
    if (tokens[0] === "top" || tokens[0] === "bottom") return tokens[0];
    return tokens[1] || "center";
  })();
  const splitIsFullWidth = props.fullWidthBackground !== false;
  const sectionSurface = {
    position: "relative",
    width: "100%",
    ...(splitIsFullWidth
      ? { maxWidth: "100%", marginLeft: 0, marginRight: 0 }
      : { maxWidth: `${splitContentWidth}px`, marginLeft: "auto", marginRight: "auto" }),
    boxSizing: "border-box",
    borderRadius: editor ? (compact ? 12 : 18) : undefined,
    background: props.sectionBackgroundColor || "#000000",
    boxShadow: "none",
    border: "none",
    padding: 0,
    // CSS transforms on ancestors interfere with section-aware parallax measurement — skip when parallax is active.
    ...(splitParallaxActive ? {} : sectionAnimationStyle),
  };
  const hasLeftPanelAnim = !editor && !!props.leftPanelAnimation && props.leftPanelAnimation !== "none";
  const hasRightPanelAnim = !editor && !!props.rightPanelAnimation && props.rightPanelAnimation !== "none";
  const panelShell = {
    display: "grid",
    gridTemplateColumns: compact ? "1fr" : (splitRatioMap[props.splitLayout] || "1fr 1fr"),
    width: "100%",
    maxWidth: `${splitContentWidth}px`,
    marginLeft: "auto",
    marginRight: "auto",
    boxSizing: "border-box",
    minHeight: compact ? undefined : props.minHeight || "760px",
    borderRadius: 0,
    overflow: (hasLeftPanelAnim || hasRightPanelAnim) ? "visible" : "hidden",
    alignItems: "stretch",
    background: props.sectionBackgroundColor || "#000000",
    border: "none",
    boxShadow: "none",
  };
  const textPanelOverlap = !compact ? Number(props.textPanelOverlap || 0) : 0;
  const mediaPanelStyle = splitBackgroundImage
    ? {
        position: "relative",
        minWidth: 0,
        overflow: "hidden",
        zIndex: textPanelOverlap > 0 ? 1 : undefined,
        backgroundImage: `url(${splitBackgroundImage})`,
        backgroundPosition: splitParallaxActive && !editor
          ? `${splitFixedBackgroundX} ${splitBackgroundPositionY}`
          : (props.backgroundPosition || "center center"),
        backgroundSize: props.backgroundSize || "cover",
        backgroundRepeat: props.backgroundRepeat || "no-repeat",
        backgroundAttachment: splitParallaxActive ? "fixed" : "scroll",
        backgroundColor: props.backgroundColor || "#0f172a",
      }
    : {
        position: "relative",
        minWidth: 0,
        overflow: "hidden",
        zIndex: textPanelOverlap > 0 ? 1 : undefined,
        minHeight: compact ? 122 : undefined,
        background: props.backgroundColor || "#0f172a",
      };
  const contentPanelStyle = {
    position: "relative",
    minWidth: 0,
    maxWidth: "100%",
    zIndex: textPanelOverlap > 0 ? 2 : undefined,
    marginLeft: textPanelOverlap > 0 ? `-${textPanelOverlap}%` : undefined,
    background: props.contentPanelBackgroundColor || "transparent",
    padding: compact ? "44px 20px 56px" : `115px ${contentPanelPadX}px`,
    display: "grid",
    alignContent: "start",
    gap: compact ? 16 : 20,
    boxSizing: "border-box",
    overflowWrap: "anywhere",
  };
  const faqWrapStyle = {
    width: "100%",
    maxWidth: `${compact ? 312 : Math.max(280, Number(faqBlockProps.faqMaxWidth || 720))}px`,
  };
  const faqSurfaceStyle = {
    width: "100%",
    borderRadius: compact ? 18 : 24,
    padding: compact ? "14px" : "18px",
    background: faqBlockProps.faqPanelBackgroundColor || "rgba(3, 18, 28, 0.26)",
    border: `1px solid ${faqBlockProps.faqPanelBorderColor || faqBlockProps.itemBorderColor || "rgba(0, 66, 96, 0.39)"}`,
    boxShadow: "0 18px 38px rgba(0,0,0,0.18)",
  };

  return (
    <ScrollReveal
      as="section"
      animationName={splitParallaxActive ? "" : (props.sectionAnimation || "fade-up")}
      delay={props.sectionAnimationDelay || 0.06}
      speed={props.sectionAnimationSpeed}
      disabled={editor || splitParallaxActive}
      style={asStyleObject(sectionSurface)}
    >
      <div style={asStyleObject(panelShell)}>
          <ScrollReveal
            as="div"
            animationName={splitParallaxActive ? "" : (props.leftPanelAnimation || "none")}
            delay={Number(props.leftPanelAnimationDelay ?? 0)}
            speed={props.leftPanelAnimationSpeed}
            disabled={editor || splitParallaxActive}
            style={mediaPanelStyle}
          >
            {!splitBackgroundImage && editor ? (
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 24, color: "rgba(255,255,255,0.9)", textAlign: "center", fontWeight: 600, letterSpacing: "0.02em" }}>
                Upload a background image
              </div>
            ) : null}
            {splitBackgroundImage && Number(props.imageOverlayOpacity || 0) > 0 ? (
              <div style={{ position: "absolute", inset: 0, background: props.imageOverlayColor || "#000000", opacity: Number(props.imageOverlayOpacity) / 100, pointerEvents: "none", zIndex: 2 }} />
            ) : null}
            {!!props.headlineOverImage ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: props.headlineOverImageAlign || "flex-end", justifyContent: "flex-start", padding: compact ? "24px 20px" : "48px 56px", zIndex: 3, pointerEvents: editor ? "auto" : "none" }}>
                <h2
                  data-website-inline-editor="true"
                  data-text-prop="headlineBlock.content"
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    if (!editor || typeof onChangeBlock !== "function") return;
                    const content = cleanInlineEditorHtml(event.currentTarget.innerHTML);
                    onChangeBlock({ ...props, headline: content, headlineBlock: { ...(props.headlineBlock || {}), content } });
                  }}
                  style={{
                    margin: 0,
                    fontSize: compact ? Math.max(28, Math.min(40, Number(headlineBlockProps.fontSize || 48))) : Math.max(32, Number(headlineBlockProps.fontSize || 48)),
                    lineHeight: Number(headlineBlockProps.lineHeight || 1.2),
                    fontWeight: headlineBlockProps.fontWeight || "700",
                    fontFamily: headlineBlockProps.fontFamily || "Poppins, sans-serif",
                    color: headlineBlockProps.color || "#ffffff",
                    textAlign: headlineBlockProps.alignment || "left",
                    letterSpacing: compact ? "-0.3px" : "-0.6px",
                    textShadow: "0 2px 16px rgba(0,0,0,0.55)",
                    outline: editor ? "1px dashed rgba(14,165,233,0.55)" : "none",
                    borderRadius: 8,
                    padding: editor ? "4px 6px" : 0,
                    maxWidth: "90%",
                  }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(headlineBlockProps.content || (editor ? "Headline" : "")) }}
                />
              </div>
            ) : null}
          </ScrollReveal>
          <ScrollReveal
            as="div"
            animationName={props.rightPanelAnimation || "none"}
            delay={Number(props.rightPanelAnimationDelay ?? 0)}
            speed={props.rightPanelAnimationSpeed}
            disabled={editor}
            style={asStyleObject(contentPanelStyle)}
          >
            {(editor || !!stripPlaceholder(props.eyebrow)) ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0,
                  marginBottom: compact ? 8 : 10,
                  minWidth: 0,
                  maxWidth: "100%",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: compact ? 44 : 70,
                    height: 2,
                    background: props.eyebrowColor || "linear-gradient(15deg, rgb(12, 140, 233) 15%, rgb(108, 92, 231) 10%, rgb(18, 213, 187) 45%, rgb(28, 165, 241) 130%)",
                    marginRight: 12,
                    borderRadius: 999,
                    flex: "0 0 auto",
                  }}
                />
                <p
                data-website-inline-editor="true"
                data-text-prop="eyebrow"
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => {
                  if (!editor || typeof onChangeBlock !== "function") return;
                  const cleaned = cleanInlineEditorHtml(event.currentTarget.innerHTML);
                  onChangeBlock({ ...props, eyebrow: (cleaned === "Section label" || cleaned === "Section Label") ? "" : cleaned });
                }}
                style={{
                  margin: 0,
                  fontSize: compact ? 16 : 16,
                  lineHeight: Number(props.eyebrowLineHeight || 1.2),
                  fontWeight: 600,
                  letterSpacing: "0.45px",
                  textTransform: "capitalize",
                  backgroundImage: props.eyebrowColor || "linear-gradient(15deg, rgb(12, 140, 233) 15%, rgb(108, 92, 231) 10%, rgb(18, 213, 187) 45%, rgb(28, 165, 241) 130%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                  textAlign: headlineBlockProps.alignment || "left",
                  minWidth: 0,
                  maxWidth: "100%",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                  borderRadius: 8,
                  padding: editor ? "4px 6px" : 0,
                  ...(shouldRunAnimations ? getAnimationStyle(headlineBlockProps.animation, Math.max(0, Number(headlineBlockProps.animationDelay || 0) - 0.08), headlineBlockProps.animationSpeed) : {}),
                }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(stripPlaceholder(props.eyebrow) || (editor ? "Section label" : "")) }}
                />
              </div>
            ) : null}
            <ScrollReveal
              as="div"
              animationName={headlineBlockProps.animation || "fade-up"}
              delay={headlineBlockProps.animationDelay || 0}
              speed={headlineBlockProps.animationSpeed}
              disabled={editor}
              style={{ width: "100%", maxWidth: "100%", minWidth: 0, display: props.headlineOverImage ? "none" : undefined }}
            >
              <h2
                data-website-inline-editor="true"
                data-text-prop="headlineBlock.content"
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => {
                  if (!editor || typeof onChangeBlock !== "function") return;
                  const content = cleanInlineEditorHtml(event.currentTarget.innerHTML);
                  onChangeBlock({
                    ...props,
                    headline: content,
                    headlineBlock: {
                      ...(props.headlineBlock || {}),
                      content,
                    },
                  });
                }}
                style={{
                  margin: 0,
                  fontSize: compact ? Math.max(30, Math.min(40, Number(headlineBlockProps.fontSize || 48))) : Math.max(32, Number(headlineBlockProps.fontSize || 48)),
                  lineHeight: Number(headlineBlockProps.lineHeight || 1.2),
                  fontWeight: headlineBlockProps.fontWeight || "400",
                  fontFamily: headlineBlockProps.fontFamily || "Poppins, sans-serif",
                  color: headlineBlockProps.color || "#61ce70",
                  textAlign: headlineBlockProps.alignment || "left",
                  letterSpacing: compact ? "-0.3px" : "-0.6px",
                  marginBottom: 10,
                  maxWidth: "100%",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                  borderRadius: 8,
                  padding: editor ? "4px 6px" : 0,
                }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(headlineBlockProps.content || (editor ? "Headline" : "")) }}
              />
            </ScrollReveal>
            {(bodyBlockProps.content || editor) ? (
              <ScrollReveal
                as="div"
                animationName={bodyBlockProps.animation || "fade-in"}
                delay={bodyBlockProps.animationDelay || 0}
                speed={bodyBlockProps.animationSpeed}
                disabled={editor}
                style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
              >
                <p
                  data-website-inline-editor="true"
                  data-text-prop="bodyBlock.content"
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    if (!editor || typeof onChangeBlock !== "function") return;
                    const content = cleanInlineEditorHtml(event.currentTarget.innerHTML);
                    onChangeBlock({
                      ...props,
                      subheadline: content,
                      bodyBlock: {
                        ...(props.bodyBlock || {}),
                        content,
                      },
                    });
                  }}
                  style={{
                    margin: 0,
                    fontSize: compact ? Math.max(16, Math.min(20, Number(bodyBlockProps.fontSize || 18))) : Math.max(14, Number(bodyBlockProps.fontSize || 18)),
                    lineHeight: Number(bodyBlockProps.lineHeight || 1.6),
                    color: bodyBlockProps.color || "#bdbcbf",
                    fontFamily: bodyBlockProps.fontFamily || undefined,
                    fontWeight: bodyBlockProps.fontWeight || undefined,
                    textAlign: bodyBlockProps.alignment || "left",
                    width: "100%",
                    maxWidth: "100%",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    marginBottom: compact ? 20 : 35,
                    outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
                    borderRadius: 8,
                    padding: editor ? "4px 6px" : 0,
                  }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(bodyBlockProps.content || (editor ? "Supporting copy" : "")) }}
                />
              </ScrollReveal>
            ) : null}
            <div style={{ ...asStyleObject(faqWrapStyle), minWidth: 0, maxWidth: "100%" }}>
              <ScrollReveal as="div" animationName={faqBlockProps.sectionAnimation || "fade-up"} delay={faqBlockProps.sectionAnimationDelay || 0.12} speed={faqBlockProps.sectionAnimationSpeed} disabled={editor} style={asStyleObject(faqSurfaceStyle)}>
                <FAQAccordionItems items={items} compact={compact} editor={editor} props={faqBlockProps} openItems={openItems} onToggleItem={toggleItem} onPatchItem={patchItem} propPrefix="faqBlock.items" />
              </ScrollReveal>
            </div>
          </ScrollReveal>
        </div>
        {Number(props.sectionOverlayOpacity || 0) > 0 ? (
          <div style={{ position: "absolute", inset: 0, background: props.sectionOverlayColor || "#000000", opacity: Number(props.sectionOverlayOpacity) / 100, pointerEvents: "none", zIndex: 10 }} />
        ) : null}
    </ScrollReveal>
  );
}


export function resolveColumnCardStyle(props, prefix, compact) {
  const bg = props?.[`${prefix}BackgroundColor`] || props?.columnBackgroundColor || props?.cardBackgroundColor || "#f8fafc";
  const borderColor = props?.[`${prefix}BorderColor`] || props?.columnBorderColor || "rgba(148,163,184,0.28)";
  const radius = Number(props?.[`${prefix}Radius`] ?? props?.columnRadius ?? 18);
  const padding = Number(props?.[`${prefix}Padding`] ?? props?.columnPadding ?? (compact ? 14 : 18));
  const marginTop = Number(props?.[`${prefix}MarginTop`] ?? 0);
  const minHeight = Number(props?.[`${prefix}MinHeight`] ?? 0);
  const shadowPreset = String(props?.[`${prefix}Shadow`] || props?.columnShadow || "soft");
  const align = String(props?.[`${prefix}ContentAlign`] || props?.columnContentAlign || "left");
  const overlayColor = String(props?.[`${prefix}OverlayColor`] || props?.columnOverlayColor || "transparent");
  const gradient = String(props?.[`${prefix}Gradient`] || props?.columnGradient || "").trim();
  const shadowMap = {
    none: "none",
    soft: "0 10px 24px rgba(15,23,42,0.08)",
    medium: "0 18px 36px rgba(15,23,42,0.14)",
    strong: "0 26px 48px rgba(15,23,42,0.18)",
  };

  return {
    marginTop,
    align,
    bodyTextColor: props?.[`${prefix}BodyColor`] || props?.columnBodyColor || props?.textColor || "#334155",
    titleTextColor: props?.[`${prefix}TitleColor`] || props?.columnTitleColor || props?.textColor || "#0f172a",
    style: {
      background: gradient || bg,
      border: `1px solid ${borderColor}`,
      borderRadius: Math.max(0, radius),
      padding: Math.max(0, padding),
      boxShadow: shadowMap[shadowPreset] || shadowMap.soft,
      minHeight: minHeight > 0 ? minHeight : undefined,
      position: "relative",
      overflow: "hidden",
    },
    overlay: overlayColor && overlayColor !== "transparent" ? (
      <div style={{ position: "absolute", inset: 0, background: overlayColor, pointerEvents: "none" }} />
    ) : null,
  };
}
