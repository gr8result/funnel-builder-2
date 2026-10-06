import { iconGlyph, asRichHtml, colorWithAlpha, sharedStyles } from "./wbVariantStyles";
import { renderSocialPlatformIcon, isUnsafePublishedIconUrl, renderGridLibraryIcon } from "../gridIconLibrary";
import React from "react";
import { ambientMotionStyle, ScrollReveal, IconCounterNumber, resolvePublishedNavHref } from "./wbAnimations";
import { resolveGridSectionItemImageUrl } from "../../../lib/website-builder/gridSectionImages";
import { resolveResponsiveMediaSize } from "../../../lib/website-builder/responsiveValue";
import { cleanInlineEditorHtml } from "../../../modules/website-builder/utils/inlineHtml";


export function normalizeGridSectionItems(items) {
  if (!Array.isArray(items) || !items.length) {
    return [{ icon: "", iconName: "", iconGlyph: "", iconFontFamily: "", iconImage: "", iconAssetId: "", title: "", content: "", image: "" }];
  }

  return items.map((item) => ({
    icon: String(item?.icon || ""),
    iconName: String(item?.iconName || ""),
    iconGlyph: String(item?.iconGlyph || ""),
    iconFontFamily: String(item?.iconFontFamily || ""),
    iconImage: String(item?.iconImage || ""),
    iconAssetId: String(item?.iconAssetId || ""),
    title: String(item?.title || ""),
    eyebrow: String(item?.eyebrow || ""),
    content: String(item?.content || ""),
    link: String(item?.link || ""),
    image: String(item?.image || item?.imageUrl || item?.backgroundImage || item?.src || item?.mediaUrl || item?.cardImage || ""),
    imageUrl: String(item?.imageUrl || ""),
    backgroundImage: String(item?.backgroundImage || ""),
    src: String(item?.src || ""),
    mediaUrl: String(item?.mediaUrl || ""),
    cardImage: String(item?.cardImage || ""),
    imageAssetId: String(item?.imageAssetId || item?.assetId || item?.mediaAssetId || item?.cardImageAssetId || ""),
    imageAlt: String(item?.imageAlt || ""),
    imageHeight: item?.imageHeight,
  }));
}


export function renderGridSectionIcon(item, color, size) {
  const socialIcon = renderSocialPlatformIcon(item, { size, color });
  if (socialIcon) {
    return socialIcon;
  }
  if (item?.iconImage && !isUnsafePublishedIconUrl(item.iconImage)) {
    return <img data-wb-media-fixed="icon" src={item.iconImage} alt={item?.title || "Grid icon"} style={{ "--wb-media-width": `${size}px`, "--wb-media-height": `${size}px`, width: size, height: size, objectFit: "contain", display: "block" }} />;
  }
  if (item?.iconGlyph && item?.iconFontFamily) {
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
  const namedIcon = renderGridLibraryIcon(item?.iconName, { size, color });
  if (namedIcon) {
    return namedIcon;
  }
  if (item?.icon) {
    return <span style={{ fontSize: size, lineHeight: 1, color }}>{item.icon}</span>;
  }
  return renderSocialPlatformIcon({ title: "social" }, { size, color });
}


export function resolveServicesStylePreset(props = {}) {
  switch (String(props?.servicesStylePreset || "style-01").trim()) {
    case "style-02":
      return {
        cardRadius: 24,
        badgeRadius: 18,
        panelRadius: 20,
        panelInset: { left: 20, right: 20, bottom: 20 },
        panelPadding: "22px 26px",
        panelBackground: "rgba(12,18,34,0.76)",
        panelHoverBackground: "rgba(12,18,34,0.88)",
        cardSurface: "linear-gradient(180deg, rgba(9,16,30,0.98), rgba(18,30,52,0.98))",
        badgePosition: { top: 18, left: 18, right: "auto" },
        contentAlign: "center",
        titleWeight: 700,
        panelShadow: "0 18px 34px rgba(0,0,0,0.2)",
      };
    case "style-03":
      return {
        cardRadius: 18,
        badgeRadius: 16,
        panelRadius: 0,
        panelInset: { left: 24, right: 24, bottom: 28 },
        panelPadding: "0px",
        panelBackground: "transparent",
        panelHoverBackground: "transparent",
        cardSurface: "linear-gradient(180deg, rgba(8,12,24,0.98), rgba(18,27,46,0.98))",
        badgePosition: { top: 18, right: 18 },
        contentAlign: "left",
        titleWeight: 600,
        panelShadow: "none",
      };
    default:
      return {
        cardRadius: 15,
        badgeRadius: 15,
        panelRadius: 15,
        panelInset: { left: 12.5, right: 12.5, bottom: 20 },
        panelPadding: "25px 40px",
        panelBackground: "linear-gradient(290deg, rgba(15,23,42,0.9), rgba(3,34,47,0.92))",
        panelHoverBackground: "linear-gradient(290deg, rgba(17,24,39,0.92), rgba(8,47,73,0.94))",
        cardSurface: "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(30,41,59,0.96))",
        badgePosition: { top: 0, right: 20 },
        contentAlign: "left",
        titleWeight: 400,
        panelShadow: "0 2px 28px rgba(0,0,0,0.09)",
        useImageBackground: false,
      };
  }
}


export function resolveServicesColorPreset(props = {}) {
  switch (String(props?.servicesColorPreset || "blue").trim()) {
    case "green":
      return {
        badgeBackground: "linear-gradient(135deg, #163628 0%, #22c55e 52%, #bef264 100%)",
        badgeShadow: "rgba(34,197,94,0.24)",
        badgeGlow: "rgba(190,242,100,0.2)",
        eyebrowGradient: "linear-gradient(90deg, #22c55e 0%, #bef264 100%)",
        titleColor: "#86efac",
        bodyColor: "rgba(248,250,252,0.92)",
        sectionTitleColor: "#dcfce7",
      };
    default:
      return {
        badgeBackground: "linear-gradient(135deg, #0c8ce9 0%, #6c5ce7 50%, #38bdf8 100%)",
        badgeShadow: "rgba(12,140,233,0.28)",
        badgeGlow: "rgba(56,189,248,0.22)",
        eyebrowGradient: "linear-gradient(90deg, #0ea5e9 0%, #8b5cf6 100%)",
        titleColor: "#7dd3fc",
        bodyColor: "rgba(248,250,252,0.92)",
        sectionTitleColor: "#dbeafe",
      };
  }
}


export function ServicesGridCard({
  item,
  itemIndex,
  compact,
  editor,
  props,
  baseDelay,
  serviceTileRadius,
  tileHeight,
  topIconNode,
  ghostIconNode,
  imageStyle,
  iconStyle,
  titleStyle,
  bodyStyle,
  eyebrowFontSize,
  serviceIconBadgeWidth,
  serviceIconBadgeHeight,
  serviceIconBadgePadding,
  cardTitleFontSize,
  cardBodyFontSize,
  onUpdate,
  navigationContext = null,
}) {
  const [hovered, setHovered] = React.useState(false);
  const stylePreset = resolveServicesStylePreset(props);
  const colorPreset = resolveServicesColorPreset(props);
  const rawItemHref = String(item?.link || "").trim();
  const navigateHref = rawItemHref ? resolvePublishedNavHref({ href: rawItemHref }, navigationContext) : "";
  const cardLinkEnabled = !!navigateHref && !editor;
  const badgeMotionStyle = editor
    ? {}
    : {
        ...ambientMotionStyle("float", baseDelay * 0.3),
        animationDuration: hovered ? "3.1s" : "7.2s",
      };
  const ghostMotionStyle = editor
    ? {}
    : {
        ...ambientMotionStyle("pulse", baseDelay * 0.25),
        animationDuration: hovered ? "2.2s" : "4.8s",
      };
  const cardSurface = stylePreset.cardSurface;
  const cardBorder = props?.columnBorderColor || "rgba(148,163,184,0.28)";
  const cardInset = hovered
    ? "inset 0 0 0 1px rgba(255,255,255,0.16)"
    : "inset 0 0 0 1px rgba(255,255,255,0.08)";
  const contentPanelBackground = hovered ? stylePreset.panelHoverBackground : stylePreset.panelBackground;
  const cardImage = resolveGridSectionItemImageUrl(item);
  const showCardImage = props?.cardFlipEffect
    ? !!cardImage  // flip-card front face is always image-based when an image is set
    : (stylePreset.useImageBackground !== false && !!cardImage);
  const activateCardLink = React.useCallback((event) => {
    if (!navigateHref || typeof window === "undefined") return;
    const interactiveTarget = event?.target?.closest?.("a,button,input,textarea,select,label");
    if (interactiveTarget) return;
    window.location.assign(navigateHref);
  }, [navigateHref]);

  // Flip card variant — front shows image+title, hover reveals grey back with description + "Learn More"
  if (props?.cardFlipEffect) {
    const flipHeight = tileHeight || (compact ? 260 : 360);
    const flipRadius = Number(stylePreset.cardRadius) || 16;
    const backBg = props.cardFlipBackColor || "#374151";
    const btnBg = props.buttonBackgroundColor || colorPreset.badgeBackground || "#0ea5e9";
    const btnLabel = props.cardFlipButtonText || "Learn More";
    const backDescription = item.content || item.eyebrow || "";

    return (
      <article
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        style={{ position: "relative", height: flipHeight, perspective: "1200px", cursor: "default" }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transform: hovered ? "rotateY(180deg)" : "rotateY(0deg)",
            transition: "transform 620ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {/* Front face */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              borderRadius: flipRadius,
              overflow: "hidden",
              background: cardSurface,
              border: `1px solid ${cardBorder}`,
            }}
          >
            {showCardImage ? (
              <img
                src={cardImage}
                alt={item.imageAlt || item.title || ""}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : null}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, rgba(2,6,23,0.0) 38%, rgba(2,6,23,0.78) 100%)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 16,
                right: 16,
                bottom: 20,
                zIndex: 2,
              }}
            >
              {item.title ? (
                <div style={{ color: "#fff", fontSize: compact ? 18 : 22, fontWeight: 600, lineHeight: 1.25 }}>
                  {item.title}
                </div>
              ) : null}
            </div>
          </div>

          {/* Back face */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              borderRadius: flipRadius,
              overflow: "hidden",
              background: backBg,
              border: `1px solid ${props.cardFlipBorderColor || "rgba(156,163,175,0.25)"}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: compact ? "20px 16px" : "28px 24px",
              textAlign: "center",
              gap: 14,
            }}
          >
            {topIconNode ? (
              <div
                style={{
                  width: serviceIconBadgeWidth,
                  height: serviceIconBadgeHeight,
                  borderRadius: stylePreset.badgeRadius,
                  background: colorPreset.badgeBackground,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  padding: serviceIconBadgePadding,
                  boxSizing: "border-box",
                  flexShrink: 0,
                }}
              >
                {topIconNode}
              </div>
            ) : null}
            <div style={{ color: props.cardFlipTitleColor || "#f9fafb", fontSize: compact ? 18 : 22, fontWeight: 600, lineHeight: 1.25 }}>
              {item.title}
            </div>
            {backDescription ? (
              <div
                style={{
                  color: props.cardFlipBodyColor || "rgba(249,250,251,0.78)",
                  fontSize: compact ? 13 : 15,
                  lineHeight: 1.65,
                  flexGrow: 1,
                  maxWidth: 260,
                  whiteSpace: "pre-wrap",
                }}
              >
                {backDescription}
              </div>
            ) : null}
            {navigateHref ? (
              <a
                href={navigateHref}
                style={{
                  display: "inline-block",
                  marginTop: 2,
                  padding: compact ? "8px 20px" : "10px 26px",
                  borderRadius: 9999,
                  background: btnBg,
                  color: props.cardFlipButtonTextColor || "#fff",
                  fontSize: compact ? 13 : 14,
                  fontWeight: 600,
                  textDecoration: "none",
                  flexShrink: 0,
                }}
              >
                {btnLabel}
              </a>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  if (compact) {
    const compactDevice = Number(props?.baseLayoutWidth || 0) > 640 ? "tablet" : "mobile";
    const compactMedia = resolveResponsiveMediaSize({
      desktopWidth: props?.baseLayoutWidth || 360,
      desktopHeight: item?.imageHeight || props?.imageHeight || 220,
      mediaType: "feature-illustration",
      blockType: "grid-section",
      device: compactDevice,
      containerWidth: props?.baseLayoutWidth || (compactDevice === "tablet" ? 768 : 390),
      containerHeight: tileHeight || 260,
      viewportWidth: props?.baseLayoutWidth || (compactDevice === "tablet" ? 768 : 390),
    });
    const compactImageHeight = Math.max(72, Math.min(compactDevice === "tablet" ? 120 : 96, Number(compactMedia.height) || 96));

    return (
      <article
        onClick={cardLinkEnabled ? activateCardLink : undefined}
        onKeyDown={cardLinkEnabled ? (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          activateCardLink(event);
        } : undefined}
        role={cardLinkEnabled ? "link" : undefined}
        tabIndex={cardLinkEnabled ? 0 : undefined}
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: stylePreset.cardRadius,
          minHeight: 0,
          height: "auto",
          background: cardSurface,
          border: `1px solid ${cardBorder}`,
          boxShadow: `0 10px 26px rgba(2,6,23,0.18), ${cardInset}`,
          cursor: cardLinkEnabled ? "pointer" : "default",
          display: "grid",
          gap: 12,
          padding: 16,
        }}
      >
        {showCardImage ? (
          <img
            src={cardImage}
            alt={item.imageAlt || item.title || "Grid item image"}
            style={{
              width: "100%",
              height: compactImageHeight,
              maxHeight: compactImageHeight,
              objectFit: compactMedia.objectFit || "contain",
              borderRadius: Math.max(10, Number(stylePreset.cardRadius || 16) - 4),
              display: "block",
              background: "rgba(255,255,255,0.04)",
              ...imageStyle,
            }}
          />
        ) : topIconNode ? (
          <div
            style={{
              width: serviceIconBadgeWidth,
              height: serviceIconBadgeHeight,
              borderRadius: stylePreset.badgeRadius,
              background: colorPreset.badgeBackground,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              padding: serviceIconBadgePadding,
              boxSizing: "border-box",
              ...iconStyle,
            }}
          >
            {topIconNode}
          </div>
        ) : null}
        <div style={{ position: "relative", zIndex: 1, display: "grid", gap: item.title && item.eyebrow ? 7 : 9, padding: 0, textAlign: stylePreset.contentAlign }}>
          {item.title ? (
            <div data-website-inline-editor="true" contentEditable={editor} suppressContentEditableWarning onBlur={(e) => onUpdate(itemIndex, { title: cleanInlineEditorHtml(e.currentTarget.innerHTML) })} style={{ ...bodyStyle, margin: 0, color: props.cardTitleColor || colorPreset.titleColor, fontSize: cardTitleFontSize, lineHeight: 1.25, fontWeight: stylePreset.titleWeight, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "2px 4px" : 0 }} dangerouslySetInnerHTML={{ __html: asRichHtml(item.title || "Card title") }} />
          ) : null}
          {item.eyebrow ? (
            <div data-website-inline-editor="true" contentEditable={editor} suppressContentEditableWarning onBlur={(e) => onUpdate(itemIndex, { eyebrow: cleanInlineEditorHtml(e.currentTarget.innerHTML) })} style={{ ...titleStyle, margin: 0, fontSize: eyebrowFontSize, fontWeight: 600, lineHeight: 1.3, letterSpacing: 0, color: "rgba(248,250,252,0.9)", outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none", borderRadius: 8, padding: editor ? "2px 4px" : 0 }} dangerouslySetInnerHTML={{ __html: asRichHtml(item.eyebrow || "") }} />
          ) : null}
          {item.content ? (
            <div data-website-inline-editor="true" contentEditable={editor} suppressContentEditableWarning onBlur={(e) => onUpdate(itemIndex, { content: cleanInlineEditorHtml(e.currentTarget.innerHTML) })} style={{ ...bodyStyle, margin: 0, color: colorPreset.bodyColor, fontSize: cardBodyFontSize, lineHeight: 1.55, outline: editor ? "1px dashed rgba(14,165,233,0.28)" : "none", borderRadius: 8, padding: editor ? "2px 4px" : 0 }} dangerouslySetInnerHTML={{ __html: asRichHtml(item.content || "") }} />
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={cardLinkEnabled ? activateCardLink : undefined}
      onKeyDown={cardLinkEnabled ? (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activateCardLink(event);
      } : undefined}
      role={cardLinkEnabled ? "link" : undefined}
      tabIndex={cardLinkEnabled ? 0 : undefined}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: stylePreset.cardRadius,
        minHeight: tileHeight || undefined,
        aspectRatio: compact ? undefined : "1 / 1",
        height: compact ? (tileHeight || 260) : "auto",
        background: cardSurface,
        border: `1px solid ${cardBorder}`,
        boxShadow: hovered ? `0 24px 54px rgba(2,6,23,0.34), ${cardInset}` : `0 10px 26px rgba(2,6,23,0.18), ${cardInset}`,
        transform: hovered ? "scale(1.03)" : "scale(1)",
        cursor: cardLinkEnabled ? "pointer" : "default",
        transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 320ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {showCardImage ? (
        <img
          src={cardImage}
          alt={item.imageAlt || item.title || "Grid item image"}
          style={{
            position: "absolute",
            inset: -1,
            width: "calc(100% + 2px)",
            height: "calc(100% + 2px)",
            objectFit: "cover",
            borderRadius: stylePreset.cardRadius,
            display: "block",
            transform: hovered ? "scale(1.12)" : "scale(1)",
            filter: hovered ? "grayscale(1)" : "grayscale(0)",
            transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1), filter 360ms ease",
            ...imageStyle,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: stylePreset.cardRadius,
          background: hovered
            ? "linear-gradient(180deg, rgba(2,6,23,0.01) 0%, rgba(2,6,23,0.06) 34%, rgba(2,6,23,0.36) 58%, rgba(3,12,24,0.74) 100%)"
            : "linear-gradient(180deg, rgba(2,6,23,0.02) 0%, rgba(2,6,23,0.08) 38%, rgba(2,6,23,0.42) 62%, rgba(3,12,24,0.66) 100%)",
          zIndex: 1,
          pointerEvents: "none",
          transition: "background 320ms ease",
        }}
      />
      {topIconNode ? (
        <div
          style={{
            position: "absolute",
            top: stylePreset.badgePosition?.top ?? 0,
            right: stylePreset.badgePosition?.right ?? (compact ? 14 : 20),
            left: stylePreset.badgePosition?.left,
            zIndex: 4,
            ...iconStyle,
          }}
        >
          <div
            style={{
              width: serviceIconBadgeWidth,
              height: serviceIconBadgeHeight,
              borderRadius: stylePreset.badgeRadius,
              background: colorPreset.badgeBackground,
              backgroundSize: hovered ? "150% 150%" : "120% 120%",
              backgroundPosition: hovered ? "34% 50%" : "80% 50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              padding: serviceIconBadgePadding,
              boxSizing: "border-box",
              boxShadow: hovered ? `0 16px 26px ${colorPreset.badgeShadow}` : `0 8px 16px ${colorWithAlpha(colorPreset.badgeShadow, 0.55)}`,
              filter: hovered ? `drop-shadow(0 12px 20px ${colorPreset.badgeGlow})` : `drop-shadow(0 6px 12px ${colorWithAlpha(colorPreset.badgeShadow, 0.5)})`,
              transform: hovered ? "translate3d(0, 6px, 0) scale(1.04)" : "translate3d(0, 0, 0) scale(1)",
              transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), background-size 320ms ease, background-position 320ms ease, box-shadow 320ms ease, filter 320ms ease",
              ...badgeMotionStyle,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: hovered ? "wbIconDoubleSpin 0.9s cubic-bezier(0.22, 1, 0.36, 1) 1" : "none",
              }}
            >
              {topIconNode}
            </div>
          </div>
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: compact ? 10 : 12.5,
          right: compact ? 10 : 12.5,
          bottom: compact ? 14 : 20,
          ...(stylePreset.panelInset || {}),
          zIndex: 4,
          padding: compact ? "18px 24px" : stylePreset.panelPadding,
          borderRadius: stylePreset.panelRadius,
          background: contentPanelBackground,
          boxShadow: hovered ? "0 18px 34px rgba(0,0,0,0.18)" : stylePreset.panelShadow,
          overflow: "hidden",
          transform: hovered ? "translateY(-10px)" : "translateY(0)",
          transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), background 320ms ease, box-shadow 320ms ease",
          textAlign: stylePreset.contentAlign,
        }}
      >
        {ghostIconNode ? (
          <div
            style={{
              position: "absolute",
              right: -10,
              bottom: -15,
              zIndex: 0,
              opacity: hovered ? 0.24 : 0.1,
              transform: hovered ? "translate3d(-8px, -4px, 0) rotate(-10deg) scale(0.98)" : "translate3d(0, 0, 0) rotate(0deg) scale(0.8)",
              transformOrigin: "right bottom",
              transition: "opacity 320ms ease, transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
              pointerEvents: "none",
              color: "#8ee5ff",
              ...ghostMotionStyle,
            }}
          >
            {ghostIconNode}
          </div>
        ) : null}
        {item.title ? (
          <div
            key={`service-title-${itemIndex}-${cardTitleFontSize}`}
            data-website-inline-editor="true"
            contentEditable={editor}
            suppressContentEditableWarning
            onBlur={(e) => onUpdate(itemIndex, { title: cleanInlineEditorHtml(e.currentTarget.innerHTML) })}
            style={{
              ...bodyStyle,
              position: "relative",
              zIndex: 1,
              margin: 0,
              color: props.cardTitleColor || colorPreset.titleColor,
              fontSize: cardTitleFontSize,
              lineHeight: 1.3,
              fontWeight: stylePreset.titleWeight,
              letterSpacing: "-0.1px",
              outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
              borderRadius: 8,
              padding: editor ? "2px 4px" : 0,
            }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(item.title || "Card title") }}
          />
        ) : null}
        {item.eyebrow ? (
          <div
            key={`service-subtitle-${itemIndex}-${eyebrowFontSize}`}
            data-website-inline-editor="true"
            contentEditable={editor}
            suppressContentEditableWarning
            onBlur={(e) => onUpdate(itemIndex, { eyebrow: cleanInlineEditorHtml(e.currentTarget.innerHTML) })}
            style={{
              ...titleStyle,
              display: "inline-block",
              width: "fit-content",
              maxWidth: "100%",
              position: "relative",
              zIndex: 1,
              margin: item.title ? "6px 0 0" : 0,
              fontSize: eyebrowFontSize,
              fontWeight: 500,
              lineHeight: 1.3,
              letterSpacing: "-0.3px",
              color: "rgba(248,250,252,0.92)",
              outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none",
              borderRadius: 8,
              padding: editor ? "2px 4px" : 0,
            }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(item.eyebrow || "") }}
          />
        ) : null}
        {item.content ? (
          <div
            data-website-inline-editor="true"
            contentEditable={editor}
            suppressContentEditableWarning
            onBlur={(e) => onUpdate(itemIndex, { content: cleanInlineEditorHtml(e.currentTarget.innerHTML) })}
            style={{
              ...bodyStyle,
              position: "relative",
              zIndex: 1,
              marginTop: 8,
              color: colorPreset.bodyColor,
              fontSize: cardBodyFontSize,
              lineHeight: 1.6,
              outline: editor ? "1px dashed rgba(14,165,233,0.28)" : "none",
              borderRadius: 8,
              padding: editor ? "2px 4px" : 0,
            }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(item.content || "") }}
          />
        ) : null}
      </div>
    </article>
  );
}


export function isServicesGridVariant(props, items) {
  if (String(props?.gridVariant || "").trim() === "services") return true;
  return Array.isArray(items) && items.length >= 4 && items.every((item) => item?.image && item?.link && item?.eyebrow);
}


export function resolveGridSectionCardStyle(props, compact) {
  const borderColor = props?.columnBorderColor || "rgba(148,163,184,0.28)";
  const radius = Number(props?.columnRadius ?? 18);
  const padding = Number(props?.columnPadding ?? (compact ? 14 : 18));
  const shadowPreset = String(props?.columnShadow || "soft");
  const overlayColor = String(props?.columnOverlayColor || "transparent");
  const gradient = String(props?.columnGradient || "").trim();
  const shadowMap = {
    none: "none",
    soft: "0 10px 24px rgba(15,23,42,0.08)",
    medium: "0 18px 36px rgba(15,23,42,0.14)",
    strong: "0 26px 48px rgba(15,23,42,0.18)",
  };

  return {
    align: String(props?.columnContentAlign || "left"),
    titleTextColor: props?.columnTitleColor || props?.textColor || "#0f172a",
    bodyTextColor: props?.columnBodyColor || "#334155",
    iconColor: props?.iconColor || props?.textColor || "#0f172a",
    style: {
      background: gradient || props?.columnBackgroundColor || props?.cardBackgroundColor || "#f8fafc",
      border: `1px solid ${borderColor}`,
      borderRadius: Math.max(0, radius),
      padding: Math.max(0, padding),
      boxShadow: shadowMap[shadowPreset] || shadowMap.soft,
      minHeight: Number(props?.gridItemMinHeight ?? 0) > 0 ? Number(props?.gridItemMinHeight) : undefined,
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      gap: compact ? 12 : 14,
      height: "100%",
    },
    overlay: overlayColor && overlayColor !== "transparent" ? (
      <div style={{ position: "absolute", inset: 0, background: overlayColor, pointerEvents: "none" }} />
    ) : null,
  };
}



// --- Standalone icon-counter block with inline edit panel --------------------
export function IconCounterBlock({ props, compact, editor, onChangeBlock, sectionAnimationStyle, siteId = "" }) {
  const [showEdit, setShowEdit] = React.useState(false);
  const panelRef = React.useRef(null);
  const update = (patch) => onChangeBlock?.({ ...props, ...patch });

  // Close panel when clicking outside
  React.useEffect(() => {
    if (!showEdit) return undefined;
    const handleDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setShowEdit(false);
    };
    window.addEventListener("pointerdown", handleDown, true);
    return () => window.removeEventListener("pointerdown", handleDown, true);
  }, [showEdit]);

  const icBg = props.backgroundColor || "#0b0c1a";
  const icNumberColor = props.numberColor || "#0c8ce9";
  const icLabelColor = props.labelColor || "rgba(255,255,255,0.85)";
  const icLabel = props.label || "Site Visits...and counting";
  const icMinHeight = props.minHeight || "180px";
  const icTargetNumber = props.targetNumber != null ? Number(props.targetNumber) : null;
  const icStartNumber = props.startNumber != null ? Number(props.startNumber) : 0;
  const icSuffix = props.suffix || "";
  const icDiamondColor = props.diamondColor || "rgba(255,255,255,0.15)";
  const icNumberFontSize = props.numberFontSize ? Number(props.numberFontSize) : undefined;
  const icNumberFontFamily = props.numberFontFamily && props.numberFontFamily !== "inherit" ? props.numberFontFamily : undefined;
  const icLabelFontSize = compact ? 16 : (props.labelFontSize ? Number(props.labelFontSize) : 22);
  const icLabelFontFamily = props.labelFontFamily && props.labelFontFamily !== "inherit" ? props.labelFontFamily : undefined;
  const icLabelFontWeight = props.labelFontWeight || "600";

  const diamondSize = compact ? 100 : 140;

  const inpStyle = { padding: "5px 8px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", fontSize: 16, outline: "none", width: "100%", boxSizing: "border-box" };
  const stepBtn = { width: 28, height: 28, borderRadius: 5, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", cursor: "pointer", fontSize: 16, flexShrink: 0 };
  const lbl = { display: "flex", flexDirection: "column", gap: 3, fontSize: 16, color: "#94a3b8" };

  return (
    <ScrollReveal
      as="section"
      animationName={props.sectionAnimation}
      delay={props.sectionAnimationDelay || 0}
      speed={props.sectionAnimationSpeed}
      disabled={editor}
      style={{
        position: "relative",
        overflow: "visible",
        backgroundColor: icBg,
        minHeight: icMinHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...sectionAnimationStyle,
      }}
    >
      {/* Diamond watermark */}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        fill="none"
        stroke={icDiamondColor}
        strokeWidth="2.5"
        style={{
          position: "absolute",
          width: diamondSize,
          height: diamondSize,
          left: compact ? 12 : 32,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
        }}
      >
        <polygon points="50,4 96,50 50,96 4,50" />
      </svg>

      {/* Counter + label */}
      <div style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? 20 : 36,
        padding: compact ? "32px 24px 32px 80px" : "48px 48px 48px 120px",
      }}>
        <IconCounterNumber
          projectId={String(props.projectId || siteId || "")}
          targetNumber={icTargetNumber}
          startNumber={icStartNumber}
          suffix={icSuffix}
          color={icNumberColor}
          compact={compact}
          editor={editor}
          fontSize={icNumberFontSize}
          fontFamily={icNumberFontFamily}
        />
        <p
          data-website-inline-editor="true"
          contentEditable={editor}
          suppressContentEditableWarning
          onMouseDown={(e) => { if (editor) e.stopPropagation(); }}
          onPointerDown={(e) => { if (editor) e.stopPropagation(); }}
          onBlur={(e) => {
            if (!editor || typeof onChangeBlock !== "function") return;
            update({ label: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
          }}
          style={{
            margin: 0,
            fontSize: icLabelFontSize,
            fontWeight: icLabelFontWeight,
            fontFamily: icLabelFontFamily,
            color: icLabelColor,
            lineHeight: 1.35,
            maxWidth: compact ? 160 : 220,
            outline: editor ? "1px dashed rgba(125,211,252,0.55)" : "none",
            padding: editor ? "4px 6px" : 0,
            borderRadius: 8,
            cursor: editor ? "text" : "default",
          }}
          dangerouslySetInnerHTML={{ __html: icLabel }}
        />
      </div>

      {/* Editor toolbar chip */}
      {editor ? (
        <div ref={panelRef} style={{ position: "absolute", top: 8, right: 10, zIndex: 20 }}>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setShowEdit((v) => !v); }}
            style={{ ...sharedStyles.editorChip, background: showEdit ? "#0ea5e9" : undefined, color: showEdit ? "#fff" : undefined }}
          >
            {showEdit ? "? Close" : "? Edit Counter"}
          </button>

          {showEdit ? (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                zIndex: 30,
                background: "#1e293b",
                border: "1px solid rgba(14,165,233,0.45)",
                borderRadius: 12,
                padding: "12px 14px",
                boxShadow: "0 8px 28px rgba(0,0,0,0.65)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                minWidth: 280,
                maxHeight: "70vh",
                overflowY: "auto",
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 600, color: "#38bdf8", letterSpacing: "0.08em" }}>COUNTER SETTINGS</span>

              <label style={lbl}>
                Label text
                <input type="text" value={props.label || ""} onChange={(e) => update({ label: e.target.value })} style={inpStyle} />
              </label>

              {/* Numbers */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label style={lbl}>
                  Target number
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button type="button" style={stepBtn} onClick={() => update({ targetNumber: Math.max(0, (Number(props.targetNumber) || 0) - 100) })}>-</button>
                    <input type="number" value={props.targetNumber ?? 0} onChange={(e) => update({ targetNumber: Number(e.target.value) })} style={{ ...inpStyle, textAlign: "center", flex: 1, minWidth: 0 }} />
                    <button type="button" style={stepBtn} onClick={() => update({ targetNumber: (Number(props.targetNumber) || 0) + 100 })}>+</button>
                  </div>
                </label>
                <label style={lbl}>
                  Start number
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button type="button" style={stepBtn} onClick={() => update({ startNumber: Math.max(0, (Number(props.startNumber) || 0) - 100) })}>-</button>
                    <input type="number" value={props.startNumber ?? 0} onChange={(e) => update({ startNumber: Number(e.target.value) })} style={{ ...inpStyle, textAlign: "center", flex: 1, minWidth: 0 }} />
                    <button type="button" style={stepBtn} onClick={() => update({ startNumber: (Number(props.startNumber) || 0) + 100 })}>+</button>
                  </div>
                </label>
              </div>

              <label style={lbl}>
                Suffix (e.g. + or %)
                <input type="text" value={props.suffix || ""} onChange={(e) => update({ suffix: e.target.value })} style={inpStyle} placeholder="+" />
              </label>

              {/* Colors */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <label style={lbl}>
                  Number color
                  <input type="color" value={/^#[0-9a-f]{3,6}$/i.test(props.numberColor || "") ? props.numberColor : "#0c8ce9"} onChange={(e) => update({ numberColor: e.target.value })}
                    style={{ width: "100%", height: 30, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent" }} />
                </label>
                <label style={lbl}>
                  Label color
                  <input type="color" value={/^#[0-9a-f]{3,6}$/i.test(props.labelColor || "") ? props.labelColor : "#ffffff"} onChange={(e) => update({ labelColor: e.target.value })}
                    style={{ width: "100%", height: 30, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent" }} />
                </label>
                <label style={lbl}>
                  Background
                  <input type="color" value={/^#[0-9a-f]{3,6}$/i.test(props.backgroundColor || "") ? props.backgroundColor : "#0b0c1a"} onChange={(e) => update({ backgroundColor: e.target.value })}
                    style={{ width: "100%", height: 30, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent" }} />
                </label>
              </div>

              {/* Font sizes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label style={lbl}>
                  Number size
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button type="button" style={stepBtn} onClick={() => update({ numberFontSize: Math.max(20, (Number(props.numberFontSize) || 78) - 4) })}>-</button>
                    <span style={{ flex: 1, textAlign: "center", color: "#e2e8f0", fontSize: 16 }}>{props.numberFontSize || 78}</span>
                    <button type="button" style={stepBtn} onClick={() => update({ numberFontSize: Math.min(180, (Number(props.numberFontSize) || 78) + 4) })}>+</button>
                  </div>
                </label>
                <label style={lbl}>
                  Label size
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button type="button" style={stepBtn} onClick={() => update({ labelFontSize: Math.max(10, (Number(props.labelFontSize) || 22) - 2) })}>-</button>
                    <span style={{ flex: 1, textAlign: "center", color: "#e2e8f0", fontSize: 16 }}>{props.labelFontSize || 22}</span>
                    <button type="button" style={stepBtn} onClick={() => update({ labelFontSize: Math.min(72, (Number(props.labelFontSize) || 22) + 2) })}>+</button>
                  </div>
                </label>
              </div>

              <button type="button" onClick={() => setShowEdit(false)}
                style={{ marginTop: 2, padding: "6px 0", borderRadius: 7, border: "none", background: "#0ea5e9", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Done</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </ScrollReveal>
  );
}
