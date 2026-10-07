import { ensureReadableColor, resolvePreferredColor } from "./colors.js";
import { ResizeHandle, ImgBtn, CanvasControlButton, CanvasControlBadge, OverlayLayerBox, CanvasLinkShell } from "./canvasControls.jsx";
import { InlineEditableText, RichTextCanvas } from "./richTextCanvas.jsx";
import { clamp, clampOverlayCenterPct, chunkItems } from "./editorUtils.js";
import { updateAlignmentGuides, clearAlignmentGuides } from "./alignmentGuides.js";
import { resolveBlockRadius } from "./blockModel.js";
import { getSocialIconUrl, SOCIAL_ICON_SIZE } from "./socialAssets.js";
import { applyDefaultAnchorStyles } from "./richTextCommands.js";

export const CANVAS = {
  header({ props, onImg, onPatch, isSelected }) {
    const titleColor = ensureReadableColor(props.titleColor || props.textColor, props.bgColor || "#1d4ed8", "#ffffff", "#0f172a");
    const subtitleColor = ensureReadableColor(props.subtitleColor || props.textColor, props.bgColor || "#1d4ed8", "#dbeafe", "#334155");
    return (
      <div style={{ background: props.bgColor, backgroundImage: props.bgImageSrc ? `linear-gradient(rgba(15,23,42,0.28), rgba(15,23,42,0.28)), url(${props.bgImageSrc})` : undefined, backgroundSize: props.bgRepeat === "no-repeat" ? "cover" : "auto", backgroundPosition: "center", backgroundRepeat: props.bgRepeat || "no-repeat", borderRadius: 8, padding: "24px 20px", textAlign: "center" }}>
        {props.logoSrc
          ? <div style={{ position: "relative", width: `${props.logoWidthPct || 28}%`, minWidth: 84, maxWidth: 220, margin: "0 auto 12px" }}>
              <img src={props.logoSrc} alt="Logo" title="Double-click to replace logo" onDoubleClick={(event) => { event.stopPropagation(); onImg("logoSrc"); }} style={{ width: "100%", height: `${props.logoHeightPx || 84}px`, objectFit: "contain", display: "block", cursor: "default", userSelect: "none" }} />
              {isSelected && (
                <>
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); onImg("logoSrc"); }}
                    style={{ position: "absolute", top: 8, left: 8, border: "none", borderRadius: 999, background: "rgba(15,23,42,0.82)", color: "#fff", fontSize: 16, fontWeight: 600, padding: "6px 10px", cursor: "pointer", zIndex: 3 }}
                  >
                    Replace Logo
                  </button>
                  <ResizeHandle widthPct={props.logoWidthPct || 28} heightPx={props.logoHeightPx || 84} onChange={onPatch} visible={isSelected} widthKey="logoWidthPct" heightKey="logoHeightPx" label="logo" />
                </>
              )}
            </div>
          : <ImgBtn onClick={() => onImg("logoSrc")} label="Click to add logo" style={{ maxWidth: 200, margin: "0 auto 12px" }} />
        }
        <InlineEditableText
          as="h1"
          value={props.title || "Email Title"}
          onChange={(v) => onPatch?.({ title: v })}
          style={{ margin: "12px 0 6px", color: titleColor, fontSize: props.titleSize || 28, fontWeight: 600, lineHeight: 1.15, textShadow: "0 2px 8px rgba(15,23,42,0.22)" }}
        />
        <InlineEditableText
          as="p"
          value={props.subtitle || "Subtitle or tagline here"}
          onChange={(v) => onPatch?.({ subtitle: v })}
          style={{ margin: 0, color: subtitleColor, opacity: 0.96, fontSize: props.subtitleSize || 16, lineHeight: 1.55, fontWeight: 600 }}
        />
      </div>
    );
  },
  text({ props, onPatch, isSelected }) {
    return <RichTextCanvas props={props} onPatch={onPatch} isSelected={isSelected} />;
  },
  image({ props, onImg, onPatch, isSelected }) {
    const startImageDrag = (event) => {
      if (!props.src || !isSelected) return;
      event.preventDefault();
      event.stopPropagation();
      const root = event.currentTarget.closest("[data-main-image-root]");
      if (!root) return;
      const rect = root.getBoundingClientRect();

      const updatePosition = (clientX, clientY) => {
        const nextX = clamp(Math.round(((clientX - rect.left) / rect.width) * 100), 0, 100);
        const nextY = clamp(Math.round(((clientY - rect.top) / rect.height) * 100), 0, 100);
        onPatch?.({ imageX: nextX, imageY: nextY });
      };

      updatePosition(event.clientX, event.clientY);
      const handleMove = (moveEvent) => updatePosition(moveEvent.clientX, moveEvent.clientY);
      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    };

    const startOverlayDrag = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const root = event.currentTarget.closest("[data-image-overlay-root]");
      if (!root) return;
      const rect = root.getBoundingClientRect();

      const updatePosition = (clientX, clientY) => {
        const nextX = clamp(Math.round(((clientX - rect.left) / rect.width) * 100), 5, 95);
        const nextY = clamp(Math.round(((clientY - rect.top) / rect.height) * 100), 8, 92);
        updateAlignmentGuides(root, nextX, nextY);
        onPatch?.({ overlayEnabled: true, overlayX: nextX, overlayY: nextY });
      };

      updatePosition(event.clientX, event.clientY);

      const handleMove = (moveEvent) => updatePosition(moveEvent.clientX, moveEvent.clientY);
      const handleUp = () => {
        clearAlignmentGuides(root);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    };

    const startLayerDrag = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const root = event.currentTarget.closest("[data-image-overlay-root]");
      if (!root) return;
      const rect = root.getBoundingClientRect();

      const updatePosition = (clientX, clientY) => {
        const nextX = clamp(Math.round(((clientX - rect.left) / rect.width) * 100), 5, 95);
        const nextY = clamp(Math.round(((clientY - rect.top) / rect.height) * 100), 5, 95);
        onPatch?.({ overlayImageX: nextX, overlayImageY: nextY });
      };

      updatePosition(event.clientX, event.clientY);
      const handleMove = (moveEvent) => updatePosition(moveEvent.clientX, moveEvent.clientY);
      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    };

    const overlayTitle = String(props.overlayTitle || "").trim() || "Click to edit headline";
    const overlayText = String(props.overlayText || "").trim() || "Click to edit supporting text";
    const overlayTitleColor = ensureReadableColor(props.overlayTitleColor || props.textColor, props.overlayBgColor || "rgba(15,23,42,0.38)", "#ffffff", "#0f172a");
    const overlayTextColor = ensureReadableColor(props.overlayTextColor || props.textColor, props.overlayBgColor || "rgba(15,23,42,0.38)", "#f8fafc", "#334155");
    const showOverlay = !!props.src && (props.overlayEnabled || isSelected);
    const enableOverlay = () => onPatch?.({
      overlayEnabled: true,
      overlayTitle,
      overlayText,
      overlayBgColor: props.overlayBgColor || "rgba(15,23,42,0.38)",
      overlayX: props.overlayX ?? 50,
      overlayY: props.overlayY ?? 50,
    });

    const imageControls = props.src && isSelected ? (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
        <CanvasControlButton
          emphasis
          onClick={(e) => {
            e.stopPropagation();
            if (props.overlayEnabled) onPatch?.({ overlayEnabled: false });
            else enableOverlay();
          }}
        >
          {props.overlayEnabled ? "Hide Text" : "Add Text Overlay"}
        </CanvasControlButton>
        <CanvasControlButton onClick={(e) => { e.stopPropagation(); onImg("src"); }}>
          Replace Image
        </CanvasControlButton>
        <CanvasControlButton onClick={(e) => { e.stopPropagation(); onImg("overlayImageSrc"); }}>
          {props.overlayImageSrc ? "Change Top Image" : "Add Top Image"}
        </CanvasControlButton>
        <CanvasControlBadge onMouseDown={startImageDrag} compact>
          ✥ Drag image
        </CanvasControlBadge>
      </div>
    ) : null;

    const content = (
      <div data-main-image-root style={{ display: "inline-block", position: "relative", width: `${props.widthPct || 100}%`, minWidth: 80 }}>
        <ImgBtn
          src={props.src}
          onClick={() => onImg("src")}
          onImageMouseDown={startImageDrag}
          style={{ borderRadius: props.borderRadius || 0, height: props.src ? `${props.heightPx || 220}px` : undefined, objectFit: props.src ? (props.fitMode || "cover") : undefined, objectPosition: props.src ? `${props.imageX ?? 50}% ${props.imageY ?? 50}%` : undefined, cursor: props.src ? (isSelected ? "move" : "default") : "pointer" }}
        />
        {showOverlay && (
          <div data-image-overlay-root style={{ position: "absolute", inset: 0, borderRadius: props.borderRadius || 0, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: props.overlayEnabled ? (props.overlayBgColor || "rgba(15,23,42,0.38)") : "rgba(15,23,42,0.12)" }} />
            <OverlayLayerBox
              rootSelector="[data-image-overlay-root]"
              src={props.overlayImageSrc}
              x={props.overlayImageX ?? 50}
              y={props.overlayImageY ?? 22}
              widthPct={props.overlayImageWidthPct ?? 24}
              heightPx={props.overlayImageHeightPx ?? 72}
              radius={props.overlayImageRadius ?? 8}
              isSelected={isSelected}
              onPatch={onPatch}
              onPick={() => { if (isSelected) onImg("overlayImageSrc"); }}
            />
            <div
              style={{ position: "absolute", left: `${props.overlayX ?? 50}%`, top: `${props.overlayY ?? 50}%`, transform: "translate(-50%, -50%)", width: "min(84%, 420px)", color: props.textColor || "#ffffff", textAlign: "center", zIndex: 4 }}
            >
              {isSelected && (
                <CanvasControlBadge onMouseDown={startOverlayDrag} compact style={{ marginBottom: 8 }}>
                  ✥ Drag text
                </CanvasControlBadge>
              )}
              <div style={{ padding: "10px 12px", borderRadius: 14, background: isSelected ? "rgba(15,23,42,0.28)" : "rgba(15,23,42,0.16)", outline: isSelected ? "1px dashed rgba(255,255,255,0.45)" : "none", boxShadow: "0 10px 24px rgba(15,23,42,0.18)" }}>
                <InlineEditableText as="div" value={overlayTitle} onChange={(v) => onPatch?.({ overlayEnabled: true, overlayTitle: v })} style={{ fontSize: props.overlayTitleSize || 24, fontWeight: 600, lineHeight: 1.15, marginBottom: overlayText ? 8 : 0, color: overlayTitleColor, textShadow: "0 2px 8px rgba(15,23,42,0.4)" }} />
                <InlineEditableText as="div" value={overlayText} onChange={(v) => onPatch?.({ overlayEnabled: true, overlayText: v })} style={{ fontSize: props.overlayTextSize || 14, fontWeight: 600, lineHeight: 1.5, color: overlayTextColor, textShadow: "0 2px 8px rgba(15,23,42,0.35)" }} />
              </div>
            </div>
          </div>
        )}
        {props.src && (
          <ResizeHandle widthPct={props.widthPct || 100} heightPx={props.heightPx || 220} onChange={onPatch} visible={isSelected} />
        )}
      </div>
    );

    return (
      <div style={{ padding: "12px 16px", textAlign: props.align || "center", background: props.bgColor || "transparent" }}>
        {imageControls}
        {content}
      </div>
    );
  },
  button({ props, onPatch }) {
    const py = props.paddingY ?? 12;
    const btnWidth = props.widthMode === "full" ? "100%" : props.widthMode === "px" ? `${props.widthPx || 200}px` : "auto";
    const readableButtonTextColor = resolvePreferredColor(props.textColor || "#ffffff", props.bgColor || "#2563eb", "#ffffff", "#0f172a");
    return (
      <div style={{ padding: "16px 24px", textAlign: props.align || "center", background: props.blockBgColor || "transparent" }}>
        <CanvasLinkShell href={props.href}>
          <InlineEditableText
            as="span"
            value={props.text || "Button"}
            onChange={(v) => onPatch?.({ text: v })}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              verticalAlign: "middle",
              padding: `${py}px 28px`,
              background: props.bgColor || "#2563eb", color: readableButtonTextColor,
              borderRadius: props.borderRadius || 8, fontSize: 16, fontWeight: 600,
              width: btnWidth,
              minHeight: `calc(${py}px * 2 + 1em)`,
              boxSizing: "border-box",
              textAlign: "center",
              lineHeight: 1.2,
              border: "1px solid rgba(15,23,42,0.10)",
              boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
            }}
          />
        </CanvasLinkShell>
      </div>
    );
  },
  divider({ props }) {
    const side = `${Math.round((100 - (props.widthPct || 100)) / 2)}%`;
    return (
      <div style={{ padding: "12px 20px", background: "#fff" }}>
        <hr style={{ border: "none", borderTop: `${props.thickness || 1}px ${props.style || "solid"} ${props.color || "#e2e8f0"}`, margin: `0 ${side}` }} />
      </div>
    );
  },
  spacer({ props }) {
    return (
      <div style={{ background: props.bgColor || "transparent", padding: "0 16px" }}>
        <div
          style={{
            height: Number(props.height || 36),
            borderRadius: 8,
            border: "1px dashed #cbd5e1",
            background: "rgba(148,163,184,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#64748b",
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Spacer • {Number(props.height || 36)} px
        </div>
      </div>
    );
  },
  hero({ props, onImg, onPatch, isSelected }) {
    const py = props.paddingY ?? 32;
    const headlineColor = ensureReadableColor(props.headlineColor || props.textColor, props.bgColor || "#0f172a", "#ffffff", "#0f172a");
    const subtextColor = ensureReadableColor(props.subtextColor || props.textColor, props.bgColor || "#0f172a", "#e5e7eb", "#334155");
    const ctaTextColor = resolvePreferredColor(props.ctaTextColor || "#ffffff", props.ctaBgColor || "#2563eb", "#ffffff", "#0f172a");

    const startHeroImageDrag = (event) => {
      if (!props.imageSrc || !isSelected) return;
      event.preventDefault();
      event.stopPropagation();
      const root = event.currentTarget.closest("[data-hero-image-root]");
      if (!root) return;
      const rect = root.getBoundingClientRect();

      const updatePosition = (clientX, clientY) => {
        const nextX = clamp(Math.round(((clientX - rect.left) / rect.width) * 100), 0, 100);
        const nextY = clamp(Math.round(((clientY - rect.top) / rect.height) * 100), 0, 100);
        onPatch?.({ imageX: nextX, imageY: nextY });
      };

      updatePosition(event.clientX, event.clientY);
      const handleMove = (moveEvent) => updatePosition(moveEvent.clientX, moveEvent.clientY);
      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    };

    const heroImageControls = props.imageSrc && isSelected ? (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
        <CanvasControlButton onClick={(e) => { e.stopPropagation(); onImg("imageSrc"); }}>
          Replace Image
        </CanvasControlButton>
        <CanvasControlBadge onMouseDown={startHeroImageDrag} compact>
          ✥ Drag image
        </CanvasControlBadge>
      </div>
    ) : null;

    return (
      <div style={{ background: props.bgColor, backgroundImage: props.bgImageSrc ? `linear-gradient(rgba(15,23,42,0.35), rgba(15,23,42,0.35)), url(${props.bgImageSrc})` : undefined, backgroundSize: props.bgRepeat === "no-repeat" ? "cover" : "auto", backgroundPosition: "center", backgroundRepeat: props.bgRepeat || "no-repeat", borderRadius: 12, padding: `${py}px 28px`, textAlign: "center" }}>
        {heroImageControls}
        <div data-hero-image-root style={{ position: "relative", width: `${props.imageWidthPct || 100}%`, minWidth: 80, margin: "0 auto 16px" }}>
          <ImgBtn
            src={props.imageSrc}
            onClick={() => onImg("imageSrc")}
            onImageMouseDown={startHeroImageDrag}
            label="Click to add hero image"
            style={{ borderRadius: 8, height: props.imageSrc ? `${props.imageHeightPx || 220}px` : undefined, objectFit: props.imageSrc ? "cover" : undefined, objectPosition: props.imageSrc ? `${props.imageX ?? 50}% ${props.imageY ?? 50}%` : undefined, cursor: props.imageSrc ? (isSelected ? "move" : "default") : "pointer" }}
          />
          {props.imageSrc && isSelected && <ResizeHandle widthPct={props.imageWidthPct || 100} heightPx={props.imageHeightPx || 220} onChange={onPatch} visible={isSelected} widthKey="imageWidthPct" heightKey="imageHeightPx" />}
        </div>
        <InlineEditableText
          as="h2"
          value={props.headline || "Your Big Headline"}
          onChange={(v) => onPatch?.({ headline: v })}
          style={{ margin: "16px 0 10px", color: headlineColor, fontSize: props.headlineSize || 30, fontWeight: 600, lineHeight: 1.15, textShadow: "0 2px 8px rgba(15,23,42,0.28)" }}
        />
        <InlineEditableText
          as="p"
          value={props.subtext || "Supporting text that explains the value proposition."}
          onChange={(v) => onPatch?.({ subtext: v })}
          style={{ margin: "0 0 20px", color: subtextColor, opacity: 0.96, fontSize: props.subtextSize || 16, fontWeight: 600, lineHeight: 1.55 }}
        />
        <CanvasLinkShell href={props.ctaHref}>
          <InlineEditableText
            as="span"
            value={props.ctaText || "Get Started"}
            onChange={(v) => onPatch?.({ ctaText: v })}
            style={{ display: "inline-block", padding: "11px 26px", background: props.ctaBgColor, color: ctaTextColor, borderRadius: 999, fontSize: 16, fontWeight: 600 }}
          />
        </CanvasLinkShell>
      </div>
    );
  },
  imageText({ props, onImg, onPatch, isSelected }) {
    const headlineColor = ensureReadableColor(props.headlineColor || props.textColor, props.overlayShade || "rgba(15,23,42,0.45)", "#ffffff", "#0f172a");
    const subtextColor = ensureReadableColor(props.subtextColor || props.textColor, props.overlayShade || "rgba(15,23,42,0.45)", "#e5e7eb", "#334155");
    const buttonTextColor = resolvePreferredColor(props.buttonTextColor || "#ffffff", props.buttonBgColor || "#2563eb", "#ffffff", "#0f172a");
    const startElementDrag = (xKey, yKey) => (event) => {
      if (!isSelected) return;
      if (event.target?.closest?.('[contenteditable="true"], [data-inline-editor="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      const stage = event.currentTarget.closest("[data-image-text-stage]");
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const updatePosition = (clientX, clientY) => {
        const nextX = clamp(Math.round(((clientX - rect.left) / rect.width) * 100), 5, 95);
        const nextY = clamp(Math.round(((clientY - rect.top) / rect.height) * 100), 8, 92);
        updateAlignmentGuides(stage, nextX, nextY);
        onPatch?.({ [xKey]: nextX, [yKey]: nextY });
      };
      updatePosition(event.clientX, event.clientY);
      const handleMove = (moveEvent) => updatePosition(moveEvent.clientX, moveEvent.clientY);
      const handleUp = () => {
        clearAlignmentGuides(stage);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    };
    const startLayerDrag = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const root = event.currentTarget.closest("[data-image-text-root]");
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const updatePosition = (clientX, clientY) => {
        const nextX = clamp(Math.round(((clientX - rect.left) / rect.width) * 100), 5, 95);
        const nextY = clamp(Math.round(((clientY - rect.top) / rect.height) * 100), 5, 95);
        updateAlignmentGuides(root, nextX, nextY);
        onPatch?.({ overlayImageX: nextX, overlayImageY: nextY });
      };
      updatePosition(event.clientX, event.clientY);
      const handleMove = (moveEvent) => updatePosition(moveEvent.clientX, moveEvent.clientY);
      const handleUp = () => {
        clearAlignmentGuides(root);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    };
    const renderElementBox = ({
      label,
      xKey,
      yKey,
      widthKey,
      heightKey,
      defaultX,
      defaultY,
      defaultWidth,
      defaultHeight,
      minWidth = 22,
      minHeight = 56,
      edgePadding = 28,
      children,
    }) => {
      const stageVisualHeight = Math.max(220, Number(props.height || 320)) + 56;
      const boxX = clamp(Number(props[xKey] ?? defaultX), 5, 95);
      const boxWidth = clamp(Number(props[widthKey] ?? defaultWidth), minWidth, 100);
      const boxHeight = clamp(Number(props[heightKey] ?? defaultHeight), minHeight, 420);
      const boxY = clampOverlayCenterPct(Number(props[yKey] ?? defaultY), boxHeight, stageVisualHeight, edgePadding);

      return (
        <div
          onMouseDown={startElementDrag(xKey, yKey)}
          style={{
            position: "absolute",
            left: `${boxX}%`,
            top: `${boxY}%`,
            transform: "translate(-50%, -50%)",
            width: `${boxWidth}%`,
            minWidth: 120,
            maxWidth: "calc(100% - 12px)",
            height: boxHeight,
            color: props.textColor || "#ffffff",
            textAlign: props.align || "center",
            cursor: isSelected ? "move" : "default",
            zIndex: 3,
          }}
        >
          <div
            data-image-text-box
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              padding: "12px 14px",
              borderRadius: 16,
              outline: isSelected ? "1.5px dashed rgba(147,197,253,0.95)" : "none",
              background: isSelected ? "rgba(15,23,42,0.18)" : "transparent",
              boxShadow: isSelected ? "0 12px 30px rgba(15,23,42,0.18)" : "none",
              overflow: "visible",
            }}
          >
            {isSelected && (
              <CanvasControlBadge
                onMouseDown={startElementDrag(xKey, yKey)}
                compact
                style={{
                  position: "absolute",
                  top: -30,
                  left: props.align === "left" ? 0 : props.align === "right" ? "auto" : "50%",
                  right: props.align === "right" ? 0 : "auto",
                  transform: props.align === "center" ? "translateX(-50%)" : "none",
                }}
              >
                ✥ Drag {label}
              </CanvasControlBadge>
            )}
            {children}
            {isSelected && (
              <ResizeHandle
                widthPct={boxWidth}
                heightPx={boxHeight}
                onChange={onPatch}
                visible={isSelected}
                widthKey={widthKey}
                heightKey={heightKey}
                label={label}
              />
            )}
          </div>
        </div>
      );
    };

    return (
      <div data-image-text-root style={{ position: "relative", minHeight: Number(props.height || 320), borderRadius: 12, overflow: "hidden", background: "#334155", backgroundImage: props.imageSrc ? `linear-gradient(${props.overlayShade || "rgba(15,23,42,0.45)"}, ${props.overlayShade || "rgba(15,23,42,0.45)"}), url(${props.imageSrc})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
        {!props.imageSrc && <div style={{ padding: 18 }}><ImgBtn src={props.imageSrc} onClick={() => onImg("imageSrc")} label="Add background image" /></div>}
        {isSelected && (
          <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", justifyContent: "flex-end", zIndex: 4 }}>
            <CanvasControlButton onClick={(e) => { e.stopPropagation(); onImg("overlayImageSrc"); }}>
            {props.overlayImageSrc ? "Change Top Image" : "Add Top Image"}
            </CanvasControlButton>
          </div>
        )}
        <OverlayLayerBox
          rootSelector="[data-image-text-root]"
          src={props.overlayImageSrc}
          x={props.overlayImageX ?? 50}
          y={props.overlayImageY ?? 18}
          widthPct={props.overlayImageWidthPct ?? 24}
          heightPx={props.overlayImageHeightPx ?? 72}
          radius={props.overlayImageRadius ?? 8}
          isSelected={isSelected}
          onPatch={onPatch}
          onPick={() => { if (isSelected) onImg("overlayImageSrc"); }}
        />
        <div data-image-text-stage style={{ position: "relative", zIndex: 2, minHeight: Number(props.height || 320), padding: "28px" }}>
          {renderElementBox({
            label: "title",
            xKey: "headlineX",
            yKey: "headlineY",
            widthKey: "headlineBoxWidthPct",
            heightKey: "headlineBoxHeightPx",
            defaultX: 50,
            defaultY: 28,
            defaultWidth: 78,
            defaultHeight: 84,
            minWidth: 26,
            minHeight: 60,
            edgePadding: 22,
            children: (
              <InlineEditableText
                as="div"
                value={props.headline || "Text over your image"}
                onChange={(v) => onPatch?.({ headline: v })}
                style={{
                  fontSize: props.headlineSize || 30,
                  fontWeight: 600,
                  lineHeight: 1.15,
                  color: headlineColor,
                  textShadow: "0 2px 8px rgba(15,23,42,0.35)",
                  textAlign: props.align || "center",
                }}
              />
            ),
          })}
          {renderElementBox({
            label: "subtitle",
            xKey: "subtextX",
            yKey: "subtextY",
            widthKey: "subtextBoxWidthPct",
            heightKey: "subtextBoxHeightPx",
            defaultX: 50,
            defaultY: 56,
            defaultWidth: 84,
            defaultHeight: 92,
            minWidth: 28,
            minHeight: 64,
            edgePadding: 24,
            children: (
              <InlineEditableText
                as="div"
                value={props.subtext || "Add a headline and supporting copy directly on top of the image."}
                onChange={(v) => onPatch?.({ subtext: v })}
                style={{
                  fontSize: props.subtextSize || 15,
                  fontWeight: 600,
                  lineHeight: 1.6,
                  color: subtextColor,
                  textAlign: props.align || "center",
                }}
              />
            ),
          })}
          {renderElementBox({
            label: "button",
            xKey: "buttonX",
            yKey: "buttonY",
            widthKey: "buttonBoxWidthPct",
            heightKey: "buttonBoxHeightPx",
            defaultX: 50,
            defaultY: 78,
            defaultWidth: 36,
            defaultHeight: 84,
            minWidth: 18,
            minHeight: 56,
            edgePadding: 42,
            children: (
              <div style={{ display: "flex", alignItems: "center", justifyContent: props.align === "left" ? "flex-start" : props.align === "right" ? "flex-end" : "center", width: "100%", height: "100%" }}>
                <CanvasLinkShell href={props.href}>
                  <InlineEditableText as="span" value={props.buttonText || "Learn More"} onChange={(v) => onPatch?.({ buttonText: v })} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "42px", padding: "10px 22px", background: props.buttonBgColor || "#2563eb", color: buttonTextColor, borderRadius: 999, fontSize: 16, fontWeight: 600, lineHeight: 1.2, textAlign: "center", boxSizing: "border-box" }} />
                </CanvasLinkShell>
              </div>
            ),
          })}
        </div>
      </div>
    );
  },
  quote({ props, onImg, onPatch }) {
    const quoteTextColor = ensureReadableColor(props.textColor || "#0f172a", props.bgColor || "#eff6ff", "#ffffff", "#0f172a");
    return (
      <div style={{ background: props.bgColor || "#eff6ff", borderRadius: 12, padding: 20, textAlign: "center" }}>
        <div style={{ width: 72, margin: "0 auto 12px" }}>
          <ImgBtn src={props.avatarSrc} onClick={() => onImg("avatarSrc")} label="Avatar" style={{ borderRadius: 999 }} />
        </div>
        <InlineEditableText as="div" value={props.quote} onChange={(v) => onPatch?.({ quote: v })} style={{ fontSize: 20, fontWeight: 600, fontStyle: "italic", lineHeight: 1.6, color: quoteTextColor, marginBottom: 10 }} />
        <InlineEditableText as="div" value={props.author} onChange={(v) => onPatch?.({ author: v })} style={{ fontSize: 16, fontWeight: 600, color: quoteTextColor }} />
        <InlineEditableText as="div" value={props.role} onChange={(v) => onPatch?.({ role: v })} style={{ fontSize: 16, fontWeight: 600, color: quoteTextColor, opacity: 0.75 }} />
      </div>
    );
  },
  promo({ props, onPatch }) {
    const promoTextColor = ensureReadableColor(props.textColor || "#ffffff", props.bgColor || "#111827", "#ffffff", "#0f172a");
    const promoAccentTextColor = ensureReadableColor("#111827", props.accentColor || "#f59e0b", "#ffffff", "#111827");
    return (
      <div style={{ background: props.bgColor || "#111827", color: promoTextColor, borderRadius: 14, padding: 24, textAlign: "center" }}>
        <div style={{ display: "inline-block", background: props.accentColor || "#f59e0b", color: promoAccentTextColor, padding: "6px 10px", borderRadius: 999, fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{props.badge}</div>
        <InlineEditableText as="div" value={props.headline} onChange={(v) => onPatch?.({ headline: v })} style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.2, marginBottom: 8, color: promoTextColor }} />
        <InlineEditableText as="div" value={props.details} onChange={(v) => onPatch?.({ details: v })} style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.6, opacity: 0.9, marginBottom: 14, color: promoTextColor }} />
        <InlineEditableText as="div" value={props.code} onChange={(v) => onPatch?.({ code: v })} style={{ display: "inline-block", border: `2px dashed ${props.accentColor || "#f59e0b"}`, borderRadius: 10, padding: "8px 14px", fontSize: 22, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 14, color: promoTextColor }} />
        <div>
          <CanvasLinkShell href={props.href}>
            <InlineEditableText as="span" value={props.buttonText} onChange={(v) => onPatch?.({ buttonText: v })} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "42px", padding: "11px 24px", background: props.accentColor || "#f59e0b", color: promoAccentTextColor, borderRadius: 999, fontSize: 16, fontWeight: 600, lineHeight: 1.2, textAlign: "center", boxSizing: "border-box" }} />
          </CanvasLinkShell>
        </div>
      </div>
    );
  },
  video({ props, onImg, onPatch }) {
    const videoTextColor = ensureReadableColor(props.textColor || "#ffffff", props.bgColor || "#0f172a", "#ffffff", "#0f172a");
    return (
      <div style={{ background: props.bgColor || "#0f172a", color: videoTextColor, borderRadius: 12, padding: 18, textAlign: "center" }}>
        <ImgBtn src={props.thumbnailSrc} onClick={() => onImg("thumbnailSrc")} label="Add video thumbnail" style={{ marginBottom: 14, borderRadius: 12 }} />
        <InlineEditableText as="div" value={props.title} onChange={(v) => onPatch?.({ title: v })} style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: videoTextColor }} />
        <InlineEditableText as="div" value={props.caption} onChange={(v) => onPatch?.({ caption: v })} style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.6, opacity: 0.9, marginBottom: 12, color: videoTextColor }} />
        <CanvasLinkShell href={props.href}>
          <InlineEditableText as="span" value={props.buttonText} onChange={(v) => onPatch?.({ buttonText: v })} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "42px", padding: "10px 22px", background: "#ef4444", color: "#fff", borderRadius: 999, fontSize: 16, fontWeight: 600, lineHeight: 1.2, textAlign: "center", boxSizing: "border-box" }} />
        </CanvasLinkShell>
      </div>
    );
  },
  contact({ props, onPatch }) {
    const contactTextColor = ensureReadableColor(props.textColor || "#0f172a", props.bgColor || "#f8fafc", "#ffffff", "#0f172a");
    return (
      <div style={{ background: props.bgColor || "#f8fafc", color: contactTextColor, borderRadius: 12, padding: 20 }}>
        <InlineEditableText as="div" value={props.heading} onChange={(v) => onPatch?.({ heading: v })} style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: contactTextColor }} />
        <InlineEditableText as="div" value={props.name} onChange={(v) => onPatch?.({ name: v })} style={{ fontSize: 17, fontWeight: 600, color: contactTextColor }} />
        <InlineEditableText as="div" value={props.role} onChange={(v) => onPatch?.({ role: v })} style={{ fontSize: 16, fontWeight: 600, opacity: 0.75, marginBottom: 10, color: contactTextColor }} />
        <InlineEditableText as="div" value={props.email} onChange={(v) => onPatch?.({ email: v })} style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: contactTextColor }} />
        <InlineEditableText as="div" value={props.phone} onChange={(v) => onPatch?.({ phone: v })} style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: contactTextColor }} />
        <InlineEditableText as="div" value={props.address} onChange={(v) => onPatch?.({ address: v })} style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.6, marginBottom: 12, color: contactTextColor }} />
        <CanvasLinkShell href={props.href}>
          <InlineEditableText as="span" value={props.buttonText} onChange={(v) => onPatch?.({ buttonText: v })} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "40px", padding: "10px 20px", background: "#2563eb", color: "#fff", borderRadius: 999, fontSize: 16, fontWeight: 600, lineHeight: 1.2, textAlign: "center", boxSizing: "border-box" }} />
        </CanvasLinkShell>
      </div>
    );
  },
  grid({ props, onImg, onPatch }) {
    const perRow = Math.max(1, Math.min(4, Number(props.columnsPerRow || 2)));
    const rows = chunkItems(props.columns || [], perRow);
    return (
      <div style={{ display: "grid", gap: 12, padding: 8, background: props.bgColor || "transparent" }}>
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} style={{ display: "flex", gap: 12 }}>
            {row.map((col, i) => {
              const absoluteIndex = rowIdx * perRow + i;
              return (
                <div key={absoluteIndex} style={{ flex: 1, minWidth: 0, background: col.bgColor || "transparent", borderRadius: 12, padding: 10, boxShadow: col.bgColor === "transparent" ? "none" : "0 1px 3px rgba(15,23,42,0.08)" }}>
                  <ImgBtn src={col.imageSrc} onClick={() => onImg("imageSrc_col", absoluteIndex)} label="Add image" style={{ marginBottom: 10, borderRadius: 8 }} />
                  <InlineEditableText
                    as="div"
                    value={col.title}
                    onChange={(v) => {
                      const next = (props.columns || []).map((entry, idx) => idx === absoluteIndex ? { ...entry, title: v } : entry);
                      onPatch?.({ columns: next });
                    }}
                    style={{ fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 4 }}
                  />
                  <InlineEditableText
                    as="div"
                    value={col.text}
                    onChange={(v) => {
                      const next = (props.columns || []).map((entry, idx) => idx === absoluteIndex ? { ...entry, text: v } : entry);
                      onPatch?.({ columns: next });
                    }}
                    style={{ fontSize: 16, fontWeight: 600, color: "#475569", lineHeight: 1.5 }}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  },
  list({ props, onImg, onPatch }) {
    const perRow = Math.max(1, Math.min(4, Number(props.itemsPerRow || 1)));
    const rows = chunkItems(props.items || [], perRow);
    return (
      <div style={{ display: "grid", gap: 12, background: props.bgColor || "transparent", padding: "8px" }}>
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} style={{ display: "flex", gap: 12 }}>
            {row.map((item, i) => {
              const absoluteIndex = rowIdx * perRow + i;
              return (
                <div key={absoluteIndex} style={{ flex: 1, minWidth: 0, display: "flex", gap: 12, padding: 12, background: item.bgColor || "transparent", borderRadius: 12, boxShadow: item.bgColor === "transparent" ? "none" : "0 1px 3px rgba(15,23,42,0.08)", alignItems: "flex-start" }}>
                  <div style={{ flexShrink: 0, width: perRow > 1 ? 90 : 110 }}>
                    <ImgBtn src={item.imageSrc} onClick={() => onImg("imageSrc_item", absoluteIndex)} label="Image" style={{ width: "100%", borderRadius: 8 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <InlineEditableText
                      as="div"
                      value={item.title}
                      onChange={(v) => {
                        const next = (props.items || []).map((entry, idx) => idx === absoluteIndex ? { ...entry, title: v } : entry);
                        onPatch?.({ items: next });
                      }}
                      style={{ fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 5 }}
                    />
                    <InlineEditableText
                      as="div"
                      value={item.text}
                      onChange={(v) => {
                        const next = (props.items || []).map((entry, idx) => idx === absoluteIndex ? { ...entry, text: v } : entry);
                        onPatch?.({ items: next });
                      }}
                      style={{ fontSize: 16, fontWeight: 600, color: "#475569", lineHeight: 1.5 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  },
  gridCard({ props, onImg, onPatch, isSelected }) {
    const bodyTitleColor = ensureReadableColor("", props.bgColor || "#ffffff", "#ffffff", "#1e293b");
    const bodyTextColor = ensureReadableColor("", props.bgColor || "#ffffff", "#e5e7eb", "#475569");

    return (
      <div style={{ background: props.bgColor || "transparent", borderRadius: 12, padding: 10, boxShadow: props.bgColor === "transparent" ? "none" : undefined }}>
        <div style={{ position: "relative", width: `${props.imageWidthPct || 100}%`, marginBottom: 10 }}>
          <ImgBtn src={props.imageSrc} onClick={() => onImg("imageSrc")} label="Add image" style={{ borderRadius: 8, height: props.imageSrc ? `${props.imageHeightPx || 160}px` : undefined, objectFit: props.imageSrc ? "cover" : undefined }} />
          <ResizeHandle widthPct={props.imageWidthPct || 100} heightPx={props.imageHeightPx || 160} onChange={onPatch} visible={isSelected} widthKey="imageWidthPct" heightKey="imageHeightPx" />
        </div>
        <InlineEditableText
          as="div"
          value={props.title}
          onChange={(v) => onPatch?.({ title: v, overlayEnabled: false })}
          placeholder="Card headline"
          style={{ fontWeight: 600, fontSize: 16, color: bodyTitleColor, marginBottom: 4 }}
        />
        <InlineEditableText
          as="div"
          value={props.text}
          onChange={(v) => onPatch?.({ text: v, overlayEnabled: false })}
          placeholder="Card description"
          style={{ fontSize: 16, fontWeight: 600, color: bodyTextColor, lineHeight: 1.5 }}
        />
      </div>
    );
  },
  listCard({ props, onImg, onPatch, isSelected }) {
    const stacked = Number(props.perRow || 1) <= 1;
    const bodyTitleColor = ensureReadableColor("", props.bgColor || "#ffffff", "#ffffff", "#1e293b");
    const bodyTextColor = ensureReadableColor("", props.bgColor || "#ffffff", "#e5e7eb", "#475569");

    return (
      <div style={{ display: stacked ? "flex" : "block", gap: 12, padding: 12, background: props.bgColor || "transparent", borderRadius: 12, alignItems: "flex-start", boxShadow: props.bgColor === "transparent" ? "none" : undefined }}>
        <div style={{ width: stacked ? `${Math.min(220, props.imageHeightPx || 110)}px` : `${props.imageWidthPct || 100}%`, flexShrink: 0, marginBottom: stacked ? 0 : 10, position: "relative" }}>
          <ImgBtn src={props.imageSrc} onClick={() => onImg("imageSrc")} label="Image" style={{ width: "100%", borderRadius: 8, height: props.imageSrc ? `${props.imageHeightPx || 110}px` : undefined, objectFit: props.imageSrc ? "cover" : undefined }} />
          <ResizeHandle widthPct={props.imageWidthPct || 100} heightPx={props.imageHeightPx || 110} onChange={onPatch} visible={isSelected} widthKey="imageWidthPct" heightKey="imageHeightPx" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <InlineEditableText
            as="div"
            value={props.title}
            onChange={(v) => onPatch?.({ title: v, overlayEnabled: false })}
            placeholder="List headline"
            style={{ fontWeight: 600, fontSize: 16, color: bodyTitleColor, marginBottom: 5 }}
          />
          <InlineEditableText
            as="div"
            value={props.text}
            onChange={(v) => onPatch?.({ text: v, overlayEnabled: false })}
            placeholder="List description"
            style={{ fontSize: 16, fontWeight: 600, color: bodyTextColor, lineHeight: 1.5 }}
          />
        </div>
      </div>
    );
  },
  social({ props }) {
    const radius = resolveBlockRadius(props, 10);
    return (
      <div style={{ background: props.bgColor, borderRadius: radius, padding: "20px 16px", textAlign: "center", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
          {(props.platforms || []).map(pl => (
            <CanvasLinkShell key={pl.name} href={pl.href} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }} title={pl.href || pl.name}>
              <img src={getSocialIconUrl(pl.name)} alt={pl.name} style={{ width: SOCIAL_ICON_SIZE, height: SOCIAL_ICON_SIZE }} />
            </CanvasLinkShell>
          ))}
        </div>
      </div>
    );
  },
  footer({ props, onPatch }) {
    const footerTextColor = ensureReadableColor(props.textColor || "#64748b", props.bgColor || "#f1f5f9", "#ffffff", "#0f172a");
    const normalizeFooterLinks = (root) => applyDefaultAnchorStyles(root, { color: footerTextColor, textDecoration: "underline" });
    const radius = resolveBlockRadius(props, 8);
    return (
      <div style={{ background: props.bgColor, borderRadius: radius, padding: "20px 16px", textAlign: "center", overflow: "hidden" }}>
        <div style={{ color: footerTextColor, fontSize: 16, fontWeight: 600, lineHeight: 1.8, direction: "ltr", unicodeBidi: "plaintext" }}>
          <div>
            <span>{`© ${new Date().getFullYear()} `}</span>
            <InlineEditableText
              as="span"
              value={props.company}
              onChange={(v) => onPatch?.({ company: v })}
              placeholder="Your Company"
              normalize={normalizeFooterLinks}
              style={{ display: "inline" }}
            />
          </div>
          <InlineEditableText
            as="div"
            value={props.address}
            onChange={(v) => onPatch?.({ address: v })}
            placeholder="123 Street, City, Country"
            normalize={normalizeFooterLinks}
          />
          <InlineEditableText
            as="div"
            value={props.unsubscribeText || "Unsubscribe"}
            onChange={(v) => onPatch?.({ unsubscribeText: v })}
            placeholder="Unsubscribe"
            normalize={normalizeFooterLinks}
            style={{ marginTop: 6 }}
          />
        </div>
      </div>
    );
  },
};
