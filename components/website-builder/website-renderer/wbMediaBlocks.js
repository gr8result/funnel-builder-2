import React from "react";
import { asArray, DEFAULT_LAYOUT_WIDTH, getAnimationStyle } from "./wbAnimations";
import { resolveLayerImageUrl } from "../../../lib/website-builder/blockImageResolver";
import { parseSizeValue, fullWidthStyle, sectionContentStyle, sharedStyles, textLayerBackgroundStyle, asRichHtml } from "./wbVariantStyles";
import { cleanInlineEditorHtml } from "../../../modules/website-builder/utils/inlineHtml";
import { snapToGrid, shouldLogHeroVideoDebug, clampValue, shouldSkipToolbarBlur } from "./wbBlockHelpers.js";
import { getPixelGuideState, renderCanvasCenterGuides, renderOverlayGuides } from "./wbOverlayBlocks.js";


export function computeLayerVisualRect(layer = {}) {
  const x = Number(layer?.x || 0);
  const y = Number(layer?.y || 0);
  const width = Math.max(0, Number(layer?.width || 0));
  const height = Math.max(0, Number(layer?.height || 0));
  const rotationDeg = Number(layer?.rotation || 0);
  if (!width || !height) {
    return { left: x, top: y, right: x, bottom: y };
  }
  const radians = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const boundHalfWidth = Math.abs(halfWidth * cos) + Math.abs(halfHeight * sin);
  const boundHalfHeight = Math.abs(halfWidth * sin) + Math.abs(halfHeight * cos);
  const centerX = x + halfWidth;
  const centerY = y + halfHeight;
  return {
    left: centerX - boundHalfWidth,
    top: centerY - boundHalfHeight,
    right: centerX + boundHalfWidth,
    bottom: centerY + boundHalfHeight,
  };
}


export function computeVisibleLayerBounds(layers = [], fallback = { minX: 0, minY: 0, maxX: 900, maxY: 420 }) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const layer of Array.isArray(layers) ? layers : []) {
    const rect = computeLayerVisualRect(layer);
    minX = Math.min(minX, rect.left);
    minY = Math.min(minY, rect.top);
    maxX = Math.max(maxX, rect.right);
    maxY = Math.max(maxY, rect.bottom);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return fallback;
  }

  return { minX, minY, maxX, maxY };
}


export function LayeredImageStackBlock({ blockProps, compact, assets, editor = false, onChangeBlock, onUploadLayerImage, layoutWidth = null }) {
  const dragRef = React.useRef(null);
  const fileInputRefs = React.useRef({});
  const canvasFrameRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const latestPropsRef = React.useRef(blockProps || {});
  const latestLayersRef = React.useRef([]);
  const draftLayersRef = React.useRef(null);
  const [draftLayers, setDraftLayers] = React.useState(null);
  const [canvasGuides, setCanvasGuides] = React.useState({ showX: false, showY: false, active: false });
  const [canvasWidth, setCanvasWidth] = React.useState(0);
  const [failedLayerSrcs, setFailedLayerSrcs] = React.useState({});
  const gridSize = compact ? 20 : 24;
  const snapEnabled = blockProps?.showGrid !== false && blockProps?.snapToGrid !== false;
  const fullWidthBlock = blockProps?.fullWidth !== undefined
    ? blockProps.fullWidth === true
    : blockProps?.fullWidthBackground === true;
  const selectedLayerIndex = Number.isInteger(blockProps?.selectedLayerIndex) ? blockProps.selectedLayerIndex : null;

  const layers = asArray(blockProps?.images)
    .map((layer, index) => ({
      id: layer?.id || `layer-${index}`,
      kind: layer?.kind || (layer?.content ? "text" : "image"),
      src: resolveLayerImageUrl(layer, assets),
      assetId: layer?.assetId || "",
      content: layer?.content || "Headline Text",
      x: Number(layer?.x ?? 40 + (index * 30)),
      y: Number(layer?.y ?? 40 + (index * 30)),
      width: Number(layer?.width ?? (layer?.kind === "text" ? 320 : 260)),
      height: Number(layer?.height ?? (layer?.kind === "text" ? 140 : 180)),
      rotation: Number(layer?.rotation ?? 0),
      radius: Number(layer?.radius ?? 18),
      zIndex: Number(layer?.zIndex ?? (index + 1)),
      fontSize: Number(layer?.fontSize ?? 40),
      fontWeight: String(layer?.fontWeight || "700"),
      textAlign: String(layer?.textAlign || "center"),
      verticalAlign: String(layer?.verticalAlign || "center"),
      textColor: (!layer?.background || layer?.background === "transparent") && (!layer?.textColor || layer?.textColor === "#ffffff") ? "#0f172a" : (layer?.textColor || "#0f172a"),
      background: typeof layer?.background === "string" && layer.background.trim() ? layer.background : "transparent",
    }))
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  const visibleLayers = draftLayers || layers;
  const renderLayerImageFallback = (layer, idx, style = {}) => (
    <div
      aria-label={layer?.alt || `Layer ${idx + 1}`}
      style={{
        width: "100%",
        height: "100%",
        minHeight: compact ? 96 : undefined,
        display: "grid",
        placeItems: "center",
        padding: 16,
        boxSizing: "border-box",
        color: "#94a3b8",
        fontSize: 12,
        fontWeight: 700,
        textAlign: "center",
        background: layer?.background && layer.background !== "transparent" ? layer.background : "rgba(148,163,184,0.16)",
        pointerEvents: "none",
        ...style,
      }}
    >
      {editor ? "Image unavailable" : ""}
    </div>
  );
  const handleLayerImageError = (event, layer, idx) => {
    const src = String(layer?.src || event?.currentTarget?.currentSrc || event?.currentTarget?.src || "").trim();
    if (shouldLogHeroVideoDebug()) {
      console.warn("[image-stack] image failed to load", {
        blockId: blockProps?.id || "",
        layerId: layer?.id || "",
        layerIndex: idx,
        src,
      });
    }
    setFailedLayerSrcs((current) => ({ ...current, [layer?.id || `${idx}:${src}`]: true }));
  };
  const hasLayerImageFailed = (layer, idx) => !!failedLayerSrcs[layer?.id || `${idx}:${String(layer?.src || "")}`];

  const bounds = computeVisibleLayerBounds(visibleLayers, { minX: 0, minY: 0, maxX: 900, maxY: 420 });
  const contentWidth = Math.max(320, bounds.maxX - bounds.minX);
  const contentHeight = Math.max(240, bounds.maxY - bounds.minY);
  const configuredCanvasWidth = Math.max(720, Number(blockProps?.baseLayoutWidth || layoutWidth || DEFAULT_LAYOUT_WIDTH || 1100));
  const designCanvasWidth = Math.max(
    configuredCanvasWidth,
    Math.round(bounds.maxX + 32),
    Math.round(contentWidth + 32)
  );
  const designCanvasHeight = Math.max(
    240,
    parseSizeValue(blockProps?.minHeight, compact ? 420 : 560),
    Math.round(bounds.maxY + 32),
    Math.round(contentHeight + 32)
  );
  const responsiveScale = canvasWidth > 0 ? Math.min(1, canvasWidth / designCanvasWidth) : 1;
  const renderedCanvasWidth = Math.max(1, Math.round(designCanvasWidth * responsiveScale));
  const renderedCanvasHeight = Math.max(1, Math.round(designCanvasHeight * responsiveScale));
  const contentCenterX = bounds.minX + (contentWidth / 2);
  const canvasCenterX = designCanvasWidth / 2;
  const centeredOffsetX = canvasCenterX - contentCenterX;
  const minOffsetX = -bounds.minX;
  const maxOffsetX = designCanvasWidth - bounds.maxX;
  const previewOffsetX = clampValue(centeredOffsetX, minOffsetX, maxOffsetX);
  const previewOffsetY = 0;
  const stackHeight = renderedCanvasHeight;
  const stackFullWidth = fullWidthStyle({ ...blockProps, fullWidthBackground: fullWidthBlock }, compact, editor);
  const previewCanvasBackground = !editor && (!blockProps?.backgroundColor || blockProps.backgroundColor === "transparent")
    ? "linear-gradient(135deg, #09111f 0%, #0f172a 100%)"
    : (blockProps?.backgroundColor || "transparent");
  const stackContentFrame = sectionContentStyle({ ...blockProps, baseLayoutWidth: designCanvasWidth }, compact, designCanvasWidth);

  React.useEffect(() => {
    latestPropsRef.current = blockProps || {};
    if (!dragRef.current) latestLayersRef.current = layers;
  }, [blockProps, layers]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const node = canvasFrameRef.current;
    if (!node) return undefined;

    const syncWidth = () => setCanvasWidth(node.clientWidth || 0);
    syncWidth();

    if (typeof window.ResizeObserver === "function") {
      const observer = new window.ResizeObserver(() => syncWidth());
      observer.observe(node);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", syncWidth);
    return () => window.removeEventListener("resize", syncWidth);
  }, [compact, editor, blockProps?.fullWidthBackground, blockProps?.fullWidth, designCanvasWidth]);

  function applyLayerUpdate(nextLayers) {
    if (typeof onChangeBlock !== "function") return;
    onChangeBlock({
      ...latestPropsRef.current,
      images: nextLayers.map((layer, index) => ({ ...layer, zIndex: index + 1 })),
    });
  }

  function patchLayer(layerIndex, patch) {
    const next = latestLayersRef.current.map((layer, currentIndex) => (
      currentIndex === layerIndex ? { ...layer, ...patch } : layer
    ));
    applyLayerUpdate(next);
  }

  function moveLayer(layerIndex, direction) {
    const nextIndex = layerIndex + direction;
    if (nextIndex < 0 || nextIndex >= latestLayersRef.current.length) return;
    const next = [...latestLayersRef.current];
    const [moved] = next.splice(layerIndex, 1);
    next.splice(nextIndex, 0, moved);
    applyLayerUpdate(next);
  }

  function addImageLayer() {
    const next = [...latestLayersRef.current, createCanvasImageLayer(latestLayersRef.current.length)];
    applyLayerUpdate(next);
  }

  function addTextLayer(x = null, y = null) {
    const seed = latestLayersRef.current.length;
    const patch = {};
    if (Number.isFinite(x)) patch.x = x;
    if (Number.isFinite(y)) patch.y = y;
    const next = [...latestLayersRef.current, createCanvasTextLayer(seed, patch)];
    applyLayerUpdate(next);
  }

  function addLogoLayer() {
    const logo = assets?.logo;
    if (!logo?.src) return;
    const next = [
      ...latestLayersRef.current,
      createCanvasImageLayer(latestLayersRef.current.length, {
        src: logo.src,
        assetId: logo.id || "",
        width: 180,
        height: 90,
        rotation: 0,
        x: 460,
        y: 24,
      }),
    ];
    applyLayerUpdate(next);
  }

  React.useEffect(() => {
    if (!editor || typeof onChangeBlock !== "function") return undefined;

    const handleMove = (event) => {
      const current = dragRef.current;
      if (!current) return;

      const cs = current.canvasScale || 1;
      const dx = (event.clientX - current.startX) / cs;
      const dy = (event.clientY - current.startY) / cs;
      const currentLayers = current.baseLayers || latestLayersRef.current;

      const nextImages = currentLayers.map((layer, layerIndex) => {
        if (layerIndex !== current.layerIndex) return layer;

        if (current.mode === "resize") {
          let rawX = current.baseX;
          let rawY = current.baseY;
          let rawWidth = current.baseWidth;
          let rawHeight = current.baseHeight;

          if (current.handle === "nw") {
            rawX = current.baseX + dx;
            rawY = current.baseY + dy;
            rawWidth = current.baseWidth - dx;
            rawHeight = current.baseHeight - dy;
          } else if (current.handle === "ne") {
            rawY = current.baseY + dy;
            rawWidth = current.baseWidth + dx;
            rawHeight = current.baseHeight - dy;
          } else if (current.handle === "sw") {
            rawX = current.baseX + dx;
            rawWidth = current.baseWidth - dx;
            rawHeight = current.baseHeight + dy;
          } else {
            rawWidth = current.baseWidth + dx;
            rawHeight = current.baseHeight + dy;
          }

          rawWidth = clampValue(rawWidth, 96, current.rect.width);
          rawHeight = clampValue(rawHeight, 96, current.rect.height);
          rawX = clampValue(rawX, 0, Math.max(0, current.rect.width - rawWidth));
          rawY = clampValue(rawY, 0, Math.max(0, current.rect.height - rawHeight));
          rawWidth = snapEnabled ? snapToGrid(rawWidth, gridSize) : rawWidth;
          rawHeight = snapEnabled ? snapToGrid(rawHeight, gridSize) : rawHeight;
          rawX = snapEnabled ? snapToGrid(rawX, gridSize) : rawX;
          rawY = snapEnabled ? snapToGrid(rawY, gridSize) : rawY;
          const guideState = getPixelGuideState(rawX, rawY, rawWidth, rawHeight, current.rect);
          rawX = guideState.snappedX;
          rawY = guideState.snappedY;

          return {
            ...layer,
            x: rawX,
            y: rawY,
            width: rawWidth,
            height: rawHeight,
          };
        }

        let rawX = clampValue(current.baseX + dx, 0, Math.max(0, current.rect.width - current.baseWidth));
        let rawY = clampValue(current.baseY + dy, 0, Math.max(0, current.rect.height - current.baseHeight));
        rawX = snapEnabled ? snapToGrid(rawX, gridSize) : rawX;
        rawY = snapEnabled ? snapToGrid(rawY, gridSize) : rawY;
        const guideState = getPixelGuideState(rawX, rawY, current.baseWidth, current.baseHeight, current.rect);
        rawX = guideState.snappedX;
        rawY = guideState.snappedY;
        return {
          ...layer,
          x: rawX,
          y: rawY,
        };
      });

      const activeLayer = nextImages[current.layerIndex];
      const guideState = activeLayer
        ? getPixelGuideState(Number(activeLayer.x || 0), Number(activeLayer.y || 0), Number(activeLayer.width || 0), Number(activeLayer.height || 0), current.rect)
        : { showX: false, showY: false };
      latestLayersRef.current = nextImages;
      draftLayersRef.current = nextImages;
      setDraftLayers(nextImages);
      setCanvasGuides({ showX: guideState.showX, showY: guideState.showY, active: true });
    };

    const handleUp = () => {
      const nextLayers = draftLayersRef.current;
      dragRef.current = null;
      draftLayersRef.current = null;
      setDraftLayers(null);
      setCanvasGuides({ showX: false, showY: false, active: false });
      if (nextLayers) applyLayerUpdate(nextLayers);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [editor, onChangeBlock, gridSize, snapEnabled]);

  function startInteraction(event, layerIndex, mode = "move", handle = "se") {
    if (!editor || typeof onChangeBlock !== "function") return;
    if (latestPropsRef.current?.selectedLayerIndex !== layerIndex) {
      onChangeBlock({ ...latestPropsRef.current, selectedLayerIndex: layerIndex });
    }
    if (event.target?.closest?.('[data-layer-editor="true"]')) return;
    event.preventDefault();
    event.stopPropagation();

    const canvas = event.currentTarget.closest("[data-image-stack-canvas]");
    if (!canvas) return;

    const rectRaw = canvas.getBoundingClientRect();
    const canvasScaleVal = Number(event.target.closest('[data-canvas-scale]')?.dataset?.canvasScale || 1);
    const rect = { ...rectRaw, width: rectRaw.width / canvasScaleVal, height: rectRaw.height / canvasScaleVal };
    const layer = latestLayersRef.current[layerIndex];
    if (!layer) return;

    dragRef.current = {
      layerIndex,
      mode,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      rect,
      baseLayers: latestLayersRef.current,
      baseX: Number(layer.x || 0),
      baseY: Number(layer.y || 0),
      baseWidth: Number(layer.width || 200),
      baseHeight: Number(layer.height || 140),
      canvasScale: canvasScaleVal,
    };
  }

  async function handleFileChange(event, layerIndex) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (typeof onUploadLayerImage === "function") {
      await onUploadLayerImage(layerIndex, file);
    }
  }

  function justifyForVertical(align) {
    if (align === "top") return "flex-start";
    if (align === "bottom") return "flex-end";
    return "center";
  }

  function alignLayer(layerIndex, axis, alignment) {
    if (typeof window === "undefined") return;
    const canvas = document.querySelector("[data-image-stack-canvas]");
    const layer = latestLayersRef.current[layerIndex];
    if (!canvas || !layer) return;

    if (axis === "x") {
      const canvasWidth = canvas.clientWidth || 1200;
      let rawX = Number(layer.x || 0);
      if (alignment === "left") rawX = gridSize;
      if (alignment === "center") rawX = Math.max(0, (canvasWidth - Number(layer.width || 0)) / 2);
      if (alignment === "right") rawX = Math.max(0, canvasWidth - Number(layer.width || 0) - gridSize);
      patchLayer(layerIndex, {
        x: snapEnabled ? snapToGrid(rawX, gridSize) : rawX,
        textAlign: alignment,
      });
      return;
    }

    const canvasHeight = canvas.clientHeight || 560;
    let rawY = Number(layer.y || 0);
    if (alignment === "top") rawY = gridSize;
    if (alignment === "center") rawY = Math.max(0, (canvasHeight - Number(layer.height || 0)) / 2);
    if (alignment === "bottom") rawY = Math.max(0, canvasHeight - Number(layer.height || 0) - gridSize);
    patchLayer(layerIndex, {
      y: snapEnabled ? snapToGrid(rawY, gridSize) : rawY,
      verticalAlign: alignment,
    });
  }

  if (compact && blockProps?.mobileLayoutMode === "stacked") {
    return (
      <section
        style={{
          width: "100%",
          maxWidth: "100%",
          padding: "18px 0",
          margin: 0,
          background: previewCanvasBackground,
          border: "none",
          boxShadow: "none",
          ...stackFullWidth,
        }}
      >
        {editor && blockProps?.title ? <h2 style={{ ...sharedStyles.sectionTitle(compact), marginBottom: 12 }}>{blockProps.title}</h2> : null}
        <div
          style={{
            width: "100%",
            ...stackContentFrame,
            padding: "0 14px",
            boxSizing: "border-box",
            display: "grid",
            gap: 14,
          }}
        >
          {visibleLayers.map((layer, idx) => (
            <div
              key={layer.id || `${idx}`}
              data-image-layer={idx}
              data-layer-kind={layer.kind || "image"}
              style={{
                position: "relative",
                width: "100%",
                maxWidth: "100%",
                borderRadius: Math.max(10, Math.min(22, Number(layer.radius || 18))),
                overflow: "hidden",
                ...(layer.kind === "text" ? textLayerBackgroundStyle(layer) : { background: "transparent" }),
                boxShadow: layer.kind === "text" && layer.background && layer.background !== "transparent" ? "0 18px 32px rgba(15,23,42,0.14)" : "none",
              }}
            >
              {layer.kind === "text" ? (
                <div
                  data-layer-editor="true"
                  data-website-inline-editor="true"
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    if (shouldSkipToolbarBlur(event)) return;
                    patchLayer(idx, { content: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
                  }}
                  style={{
                    minHeight: 96,
                    display: "flex",
                    alignItems: justifyForVertical(layer.verticalAlign),
                    justifyContent: layer.textAlign === "right" ? "flex-end" : layer.textAlign === "left" ? "flex-start" : "center",
                    padding: 16,
                    color: layer.textColor || "#0f172a",
                    fontSize: Math.max(18, Math.min(30, Number(layer.fontSize || 28))),
                    fontWeight: layer.fontWeight || "700",
                    lineHeight: 1.12,
                    textAlign: layer.textAlign || "center",
                    overflowWrap: "break-word",
                    outline: editor ? "1px dashed rgba(125,211,252,0.6)" : "none",
                  }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(layer.content || "") }}
                />
              ) : layer.src && !hasLayerImageFailed(layer, idx) ? (
                <img
                  src={layer.src}
                  alt={layer.alt || "Layer image"}
                  onError={(event) => handleLayerImageError(event, layer, idx)}
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 10",
                    objectFit: "contain",
                    display: "block",
                    background: layer.background && layer.background !== "transparent" ? layer.background : "transparent",
                  }}
                />
              ) : layer.src ? renderLayerImageFallback(layer, idx, { aspectRatio: "16 / 10" }) : null}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        width: "100%",
        maxWidth: "100%",
        padding: compact ? "18px 0" : "28px 0",
        margin: 0,
        background: previewCanvasBackground,
        border: "none",
        boxShadow: "none",
        ...stackFullWidth,
      }}
    >
      {editor && blockProps?.title ? <h2 style={{ ...sharedStyles.sectionTitle(compact), marginBottom: 12 }}>{blockProps.title}</h2> : null}
      <div
        style={{
          width: "100%",
          ...stackContentFrame,
          padding: compact ? "0 14px" : "0 24px",
          boxSizing: "border-box",
        }}
      >
        <div
          ref={canvasFrameRef}
          data-image-stack-frame
          style={{
            width: "100%",
            maxWidth: "none",
            height: stackHeight,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            overflow: "hidden",
            overflowX: "clip",
            boxSizing: "border-box",
          }}
        >
          <div
            data-image-stack-canvas-wrapper
            style={{
              position: "relative",
              width: renderedCanvasWidth,
              height: renderedCanvasHeight,
              marginInline: "auto",
              flex: "0 0 auto",
              overflow: "hidden",
            }}
          >
          <div
            ref={canvasRef}
            data-image-stack-canvas
            data-canvas-scale={responsiveScale}
            onPointerDown={(event) => {
              if (!editor || typeof onChangeBlock !== "function") return;
              if (event.target === event.currentTarget && latestPropsRef.current?.selectedLayerIndex != null) {
                onChangeBlock({ ...latestPropsRef.current, selectedLayerIndex: null });
              }
            }}
            onDoubleClick={(event) => {
              if (!editor || event.target?.closest?.("[data-image-layer]")) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const canvasScaleVal = Number(event.currentTarget?.dataset?.canvasScale || responsiveScale || 1) || 1;
              const unscaledWidth = rect.width / canvasScaleVal;
              const unscaledHeight = rect.height / canvasScaleVal;
              const nextX = clampValue(((event.clientX - rect.left) / canvasScaleVal) - 180, 0, Math.max(0, unscaledWidth - 360));
              const nextY = clampValue(((event.clientY - rect.top) / canvasScaleVal) - 70, 0, Math.max(0, unscaledHeight - 140));
              addTextLayer(nextX, nextY);
            }}
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              width: designCanvasWidth,
              minWidth: designCanvasWidth,
              maxWidth: "none",
              height: designCanvasHeight,
              minHeight: designCanvasHeight,
              overflow: "hidden",
              borderRadius: compact ? 16 : 20,
              border: editor ? "1px dashed rgba(125,211,252,0.42)" : "none",
              background: previewCanvasBackground,
              backgroundImage: blockProps?.showGrid !== false ? "linear-gradient(rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px)" : "none",
              backgroundSize: `${gridSize}px ${gridSize}px`,
              transform: `translateX(-50%) scale(${responsiveScale})`,
              transformOrigin: "top center",
              willChange: responsiveScale < 1 ? "transform" : undefined,
            }}
          >
            {editor ? renderCanvasCenterGuides(canvasGuides) : null}
            <div
              data-image-stack-layer-group
              data-visual-offset-x={Number(previewOffsetX.toFixed(3))}
              style={{
                position: "absolute",
                inset: 0,
                transform: `translateX(${previewOffsetX}px)`,
                transformOrigin: "top left",
              }}
            >
            {visibleLayers.map((layer, idx) => (
              <div
                key={layer.id || `${idx}`}
                data-image-layer={idx}
                data-layer-kind={layer.kind || "image"}
                onPointerDown={(event) => startInteraction(event, idx, "move")}
                onMouseDown={(event) => startInteraction(event, idx, "move")}
                onDoubleClick={() => {
                  if (editor && layer.kind === "image") fileInputRefs.current[idx]?.click();
                }}
                style={{
                  position: "absolute",
                  left: Math.round(layer.x),
                  top: Math.round(layer.y + previewOffsetY),
                  width: Math.max(48, Math.round(layer.width)),
                  height: Math.max(48, Math.round(layer.height)),
                  zIndex: layer.zIndex,
                  borderRadius: Math.max(8, Math.round(layer.radius)),
                  overflow: "hidden",
                  cursor: editor ? "move" : "default",
                  border: editor && selectedLayerIndex === idx ? (layer.kind === "text" ? "1px dashed rgba(125,211,252,0.9)" : "2px solid rgba(245,158,11,0.9)") : "none",
                  boxShadow: (editor && selectedLayerIndex === idx) ? "0 0 0 2px rgba(255,255,255,0.18), 0 18px 32px rgba(15,23,42,0.18)" : (layer.kind === "text" && layer.background && layer.background !== "transparent" ? "0 18px 32px rgba(15,23,42,0.14)" : "none"),
                  transform: `rotate(${layer.rotation}deg)`,
                  ...(layer.kind === "text" ? textLayerBackgroundStyle(layer) : { background: "transparent" }),
                  touchAction: "none",
                  userSelect: "none",
                }}
              >
              {layer.kind === "text" ? (
                <>
                  {editor && selectedLayerIndex === idx ? (
                    <div
                      data-layer-drag-handle="true"
                      onPointerDown={(event) => startInteraction(event, idx, "move")}
                      onMouseDown={(event) => startInteraction(event, idx, "move")}
                      style={{ position: "absolute", top: 6, left: 6, zIndex: 4, cursor: "move" }}
                    >
                      <span style={sharedStyles.editorChip}>Drag Text</span>
                    </div>
                  ) : null}
                  <div
                    data-layer-editor="true"
                    data-website-inline-editor="true"
                    contentEditable={editor}
                    suppressContentEditableWarning
                    onPointerDown={(event) => {
                      if (editor && typeof onChangeBlock === "function" && latestPropsRef.current?.selectedLayerIndex !== idx) {
                        onChangeBlock({ ...latestPropsRef.current, selectedLayerIndex: idx });
                      }
                      event.stopPropagation();
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onBlur={(event) => {
                      if (shouldSkipToolbarBlur(event)) return;
                      patchLayer(idx, { content: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
                    }}
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: justifyForVertical(layer.verticalAlign),
                      alignItems: "stretch",
                      textAlign: layer.textAlign,
                      padding: editor ? "34px 12px 12px" : 12,
                      color: layer.textColor,
                      fontSize: compact ? Math.max(16, layer.fontSize - 6) : Math.max(16, Math.round(layer.fontSize)),
                      fontWeight: layer.fontWeight,
                      lineHeight: 1.2,
                      outline: "none",
                      cursor: "text",
                    }}
                    dangerouslySetInnerHTML={{ __html: asRichHtml(layer.content || "Type text here") }}
                  />
                </>
              ) : layer.src && !hasLayerImageFailed(layer, idx) ? (
                <img
                  src={layer.src}
                  alt={`Layer ${idx + 1}`}
                  onError={(event) => handleLayerImageError(event, layer, idx)}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }}
                />
              ) : layer.src ? (
                renderLayerImageFallback(layer, idx)
              ) : (
                <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#475569", fontWeight: 600, background: "linear-gradient(135deg,#e2e8f0,#f8fafc)", pointerEvents: "none" }}>
                  Double-click to upload
                </div>
              )}


              {layer.kind === "image" ? (
                <input
                  ref={(el) => {
                    fileInputRefs.current[idx] = el;
                  }}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(event) => handleFileChange(event, idx)}
                />
              ) : null}

              {editor && selectedLayerIndex === idx ? [
                { key: "nw", left: 6, top: 6, cursor: "nwse-resize" },
                { key: "ne", right: 6, top: 6, cursor: "nesw-resize" },
                { key: "sw", left: 6, bottom: 6, cursor: "nesw-resize" },
                { key: "se", right: 6, bottom: 6, cursor: "nwse-resize" },
              ].map((handle) => (
                <div
                  key={handle.key}
                  data-resize-handle={handle.key}
                  onPointerDown={(event) => startInteraction(event, idx, "resize", handle.key)}
                  onMouseDown={(event) => startInteraction(event, idx, "resize", handle.key)}
                  style={{
                    position: "absolute",
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: layer.kind === "image" ? "#f59e0b" : "#0ea5e9",
                    border: "2px solid #fff",
                    boxShadow: "0 6px 16px rgba(15,23,42,0.24)",
                    touchAction: "none",
                    ...handle,
                  }}
                />
              )) : null}

              </div>
            ))}
            </div>
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}


export function EditableImageBlock({ props, imageSrc, compact, editor = false, animationPreview = false, onChangeBlock }) {
  const resizeRef = React.useRef(null);
  const figureRef = React.useRef(null);
  const latestPropsRef = React.useRef(props || {});
  const [figureSize, setFigureSize] = React.useState({ width: 0, height: 0 });
  const [guides, setGuides] = React.useState({ showX: false, showY: false, active: false });
  const fullWidthProps = { ...props, fullWidthBackground: props?.fullWidthBackground !== false };
  const rawWidth = String(props?.width || "100%").trim().toLowerCase();
  const useFullWidth = fullWidthProps.fullWidthBackground || rawWidth === "100%" || rawWidth === "full" || rawWidth.includes("vw");
  const fullBleedImage = useFullWidth || String(props?.imageStyle || props?.fitMode || "").toLowerCase() === "bleed";
  const seamlessEdges = fullBleedImage && props?.seamlessEdges !== false;
  const seamlessBackground = props?.backgroundColor || props?.seamlessBackgroundColor || "transparent";
  const naturalFullWidthHeight = fullBleedImage && props?.autoHeight !== false;
  const widthPx = parseSizeValue(props?.width, compact ? 280 : 720);
  const heightPx = parseSizeValue(props?.height, compact ? 220 : 400);
  const effectiveWidth = Math.max(1, Math.round(figureSize.width || widthPx));
  const effectiveHeight = Math.max(1, Math.round(figureSize.height || heightPx));
  const showOverlayText = !!props?.showOverlayText || !!props?.headline || !!props?.subheadline;
  const overlayAlign = String(props?.overlayTextAlign || "center");
  const overlayJustify = overlayAlign === "left" ? "flex-start" : overlayAlign === "right" ? "flex-end" : "center";
  const overlayVertical = String(props?.overlayTextVerticalAlign || "center");
  const overlayTextColor = props?.overlayTextColor || props?.headlineColor || "#ffffff";
  const overlayBodyColor = props?.overlaySubheadlineColor || props?.textColor || "rgba(255,255,255,0.92)";
  const overlayBackground = props?.overlayTextBackground || "linear-gradient(180deg, rgba(15,23,42,0.18), rgba(15,23,42,0.42))";
  const overlayPad = compact ? 18 : 28;
  const overlayDefaultWidth = Math.min(Math.max(Math.round(effectiveWidth * (compact ? 0.52 : 0.36)), 240), compact ? 360 : 420);
  const overlayBoxWidth = Math.max(180, Math.min(effectiveWidth, Number(props?.overlayTextWidth || Math.min(effectiveWidth - (overlayPad * 2), overlayDefaultWidth)) || Math.min(effectiveWidth - (overlayPad * 2), overlayDefaultWidth)));
  const overlayEstimateHeight = props?.subheadline || editor ? (compact ? 120 : 170) : (compact ? 84 : 118);
  const overlayAvailableWidth = Math.max(0, effectiveWidth - overlayBoxWidth);
  const overlayAvailableHeight = Math.max(0, effectiveHeight - overlayEstimateHeight);
  const overlayStoredXRatio = Number(props?.overlayTextXRatio);
  const overlayStoredYRatio = Number(props?.overlayTextYRatio);
  const overlayDefaultX = overlayAlign === "left"
    ? overlayPad
    : overlayAlign === "right"
      ? Math.max(overlayPad, effectiveWidth - overlayPad - overlayBoxWidth)
      : Math.max(overlayPad, Math.round((effectiveWidth - overlayBoxWidth) / 2));
  const overlayDefaultY = overlayVertical === "top"
    ? overlayPad
    : overlayVertical === "bottom"
      ? Math.max(overlayPad, effectiveHeight - overlayPad - overlayEstimateHeight)
      : Math.max(overlayPad, Math.round((effectiveHeight - overlayEstimateHeight) / 2));
  const overlayX = Math.max(
    0,
    Math.min(
      Number.isFinite(overlayStoredXRatio)
        ? overlayStoredXRatio * overlayAvailableWidth
        : Number.isFinite(Number(props?.overlayTextX))
          ? Number(props.overlayTextX)
          : overlayDefaultX,
      overlayAvailableWidth,
    ),
  );
  const overlayY = Math.max(
    0,
    Math.min(
      Number.isFinite(overlayStoredYRatio)
        ? overlayStoredYRatio * overlayAvailableHeight
        : Number.isFinite(Number(props?.overlayTextY))
          ? Number(props.overlayTextY)
          : overlayDefaultY,
      overlayAvailableHeight,
    ),
  );

  React.useEffect(() => {
    latestPropsRef.current = props || {};
  }, [props]);

  React.useEffect(() => {
    const node = figureRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;

    const updateSize = () => {
      const rect = node.getBoundingClientRect?.();
      if (!rect) return;
      setFigureSize({ width: rect.width || 0, height: rect.height || 0 });
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(node);
    return () => observer.disconnect();
  }, [useFullWidth, widthPx, heightPx, imageSrc]);

  React.useEffect(() => {
    if (!editor || typeof onChangeBlock !== "function") return undefined;

    const handleMove = (event) => {
      const current = resizeRef.current;
      if (!current) return;
      const cs = current.canvasScale || 1;
      const dx = (event.clientX - current.startX) / cs;
      const dy = (event.clientY - current.startY) / cs;

      if (current.mode === "overlay-move") {
        const nextWidth = current.baseWidth > Math.round(effectiveWidth * 0.56)
          ? Math.max(220, Math.min(Math.round(effectiveWidth * 0.36), effectiveWidth - (overlayPad * 2)))
          : current.baseWidth;
        const nextAvailableWidth = Math.max(0, effectiveWidth - nextWidth);
        const nextAvailableHeight = Math.max(0, effectiveHeight - current.boxHeight);
        let nextX = Math.max(0, Math.min(current.baseX + dx, nextAvailableWidth));
        let nextY = Math.max(0, Math.min(current.baseY + dy, nextAvailableHeight));
        const centerThreshold = 12;
        const centerX = nextX + (nextWidth / 2);
        const centerY = nextY + (current.boxHeight / 2);
        const shouldSnapX = Math.abs(centerX - (effectiveWidth / 2)) <= centerThreshold;
        const shouldSnapY = Math.abs(centerY - (effectiveHeight / 2)) <= centerThreshold;

        if (shouldSnapX) {
          nextX = Math.max(0, Math.min((effectiveWidth - nextWidth) / 2, nextAvailableWidth));
        }

        if (shouldSnapY) {
          nextY = Math.max(0, Math.min((effectiveHeight - current.boxHeight) / 2, nextAvailableHeight));
        }

        setGuides({ showX: shouldSnapX, showY: shouldSnapY, active: true });
        onChangeBlock({
          ...latestPropsRef.current,
          showOverlayText: true,
          overlayTextWidth: nextWidth,
          overlayTextX: Math.round(nextX),
          overlayTextY: Math.round(nextY),
          overlayTextXRatio: nextAvailableWidth > 0 ? Number((nextX / nextAvailableWidth).toFixed(6)) : 0,
          overlayTextYRatio: nextAvailableHeight > 0 ? Number((nextY / nextAvailableHeight).toFixed(6)) : 0,
        });
        return;
      }

      if (current.mode === "overlay-resize") {
        const nextWidth = Math.max(180, Math.min(effectiveWidth - current.baseX, current.baseWidth + dx));
        const nextAvailableWidth = Math.max(0, effectiveWidth - nextWidth);
        const nextX = Math.max(0, Math.min(current.baseX, nextAvailableWidth));
        setGuides((prev) => ({ ...prev, active: true }));
        onChangeBlock({
          ...latestPropsRef.current,
          showOverlayText: true,
          overlayTextWidth: nextWidth,
          overlayTextX: Math.round(nextX),
          overlayTextXRatio: nextAvailableWidth > 0 ? Number((nextX / nextAvailableWidth).toFixed(6)) : 0,
        });
        return;
      }

      onChangeBlock({
        ...latestPropsRef.current,
        autoHeight: false,
        width: `${Math.max(160, current.baseWidth + dx)}px`,
        height: `${Math.max(120, current.baseHeight + dy)}px`,
      });
    };

    const handleUp = () => {
      resizeRef.current = null;
      setGuides({ showX: false, showY: false, active: false });
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [editor, onChangeBlock]);

  function startResize(event) {
    if (!editor || typeof onChangeBlock !== "function") return;
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = {
      mode: "image-resize",
      startX: event.clientX,
      startY: event.clientY,
      baseWidth: widthPx,
      baseHeight: heightPx,
      canvasScale: Number(event.target.closest('[data-canvas-scale]')?.dataset?.canvasScale || 1),
    };
  }

  function startOverlayMove(event) {
    if (!editor || typeof onChangeBlock !== "function") return;
    event.preventDefault();
    event.stopPropagation();
    setGuides((prev) => ({ ...prev, active: true }));
    resizeRef.current = {
      mode: "overlay-move",
      startX: event.clientX,
      startY: event.clientY,
      baseX: overlayX,
      baseY: overlayY,
      baseWidth: overlayBoxWidth,
      boxHeight: overlayEstimateHeight,
      canvasScale: Number(event.target.closest('[data-canvas-scale]')?.dataset?.canvasScale || 1),
    };
  }

  function startOverlayResize(event) {
    if (!editor || typeof onChangeBlock !== "function") return;
    event.preventDefault();
    event.stopPropagation();
    setGuides((prev) => ({ ...prev, active: true }));
    resizeRef.current = {
      mode: "overlay-resize",
      startX: event.clientX,
      startY: event.clientY,
      baseX: overlayX,
      baseY: overlayY,
      baseWidth: overlayBoxWidth,
      boxHeight: overlayEstimateHeight,
      canvasScale: Number(event.target.closest('[data-canvas-scale]')?.dataset?.canvasScale || 1),
    };
  }

  return (
    <section
      style={{
        ...fullWidthStyle(fullWidthProps, compact, editor),
        ...((!editor || animationPreview) ? getAnimationStyle(props?.sectionAnimation, props?.sectionAnimationDelay || 0, props?.sectionAnimationSpeed) : {}),
        padding: 0,
        marginTop: seamlessEdges ? -1 : 0,
        marginBottom: seamlessEdges ? -1 : 0,
        background: seamlessBackground,
        border: "none",
        boxShadow: "none",
        lineHeight: 0,
        fontSize: 0,
        overflow: "hidden",
        position: "relative",
        zIndex: seamlessEdges ? 1 : undefined,
      }}
    >
      <figure
        ref={figureRef}
        style={{
          ...sharedStyles.figure,
          position: "relative",
          width: useFullWidth ? "100%" : `${widthPx}px`,
          maxWidth: "100%",
          margin: 0,
          padding: 0,
          background: seamlessBackground,
          border: "none",
          boxShadow: "none",
          borderRadius: fullBleedImage ? 0 : sharedStyles.figure?.borderRadius,
          overflow: "hidden",
          lineHeight: 0,
          fontSize: 0,
        }}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={props.alt || "Image"}
            style={{
              ...sharedStyles.figureImage,
              width: "100%",
              height: naturalFullWidthHeight ? "auto" : `${heightPx}px`,
              maxHeight: "none",
              objectFit: naturalFullWidthHeight ? "contain" : (props?.objectFit || "cover"),
              objectPosition: props?.objectPosition || "center center",
              borderRadius: fullBleedImage ? 0 : sharedStyles.figureImage?.borderRadius,
              display: "block",
              verticalAlign: "top",
              margin: 0,
              padding: 0,
              border: 0,
              outline: "none",
            }}
          />
        ) : (
          <div style={{ ...sharedStyles.galleryPlaceholder, width: "100%", height: `${heightPx}px`, borderRadius: fullBleedImage ? 0 : 22, lineHeight: 1.2 }}>
            Upload or choose an image
          </div>
        )}
        {showOverlayText ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: fullBleedImage ? 0 : 22,
              pointerEvents: "none",
            }}
          >
            {editor ? renderOverlayGuides(guides) : null}
            <div
              style={{
                position: "absolute",
                left: overlayX,
                top: overlayY,
                width: overlayBoxWidth,
                maxWidth: `calc(100% - ${overlayPad * 2}px)`,
                textAlign: overlayAlign,
                padding: compact ? 14 : 18,
                borderRadius: 20,
                background: overlayBackground,
                boxShadow: editor ? "0 12px 28px rgba(15,23,42,0.22)" : "none",
                outline: editor ? "1px dashed rgba(255,255,255,0.38)" : "none",
                pointerEvents: "auto",
              }}
              onPointerDown={(event) => {
                if (!editor) return;
                if (event.target !== event.currentTarget) return;
                startOverlayMove(event);
              }}
              onMouseDown={(event) => {
                if (!editor) return;
                if (event.target !== event.currentTarget) return;
                startOverlayMove(event);
              }}
            >
              {editor ? (
                <div
                  onPointerDown={startOverlayMove}
                  onMouseDown={startOverlayMove}
                  style={{
                    position: "absolute",
                    left: 10,
                    right: 22,
                    top: -18,
                    height: 26,
                    borderRadius: 999,
                    border: "1px solid rgba(14,165,233,0.36)",
                    background: "rgba(255,255,255,0.97)",
                    color: "#0f3f73",
                    boxShadow: "0 10px 20px rgba(15,23,42,0.18)",
                    padding: "0 10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 16,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    cursor: "grab",
                    touchAction: "none",
                  }}
                >
                  <span>Move Text</span>
                  <span style={{ opacity: 0.72 }}>Drag Anywhere</span>
                </div>
              ) : null}
              <h2
                data-website-inline-editor="true"
                data-text-prop="headline"
                contentEditable={editor}
                suppressContentEditableWarning
                onBlur={(event) => {
                  if (!editor || typeof onChangeBlock !== "function") return;
                  onChangeBlock({ ...latestPropsRef.current, headline: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
                }}
                style={{
                  margin: 0,
                  color: overlayTextColor,
                  fontSize: compact ? 28 : (props?.headlineFontSize || 46),
                  lineHeight: 1.08,
                  fontWeight: Math.min(800, Number(props?.headlineFontWeight || 700) || 700),
                  fontFamily: props?.headlineFontFamily || "inherit",
                  ...((!editor || animationPreview) ? getAnimationStyle(props?.textAnimation, props?.textAnimationDelay || 0, props?.textAnimationSpeed) : {}),
                  outline: editor ? "1px dashed rgba(255,255,255,0.45)" : "none",
                  borderRadius: 10,
                  padding: editor ? "6px 8px" : 0,
                }}
                dangerouslySetInnerHTML={{ __html: asRichHtml(props?.headline || "Add image headline") }}
              />
              {props?.subheadline || editor ? (
                <div
                  data-website-inline-editor="true"
                  data-text-prop="subheadline"
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onBlur={(event) => {
                    if (!editor || typeof onChangeBlock !== "function") return;
                    onChangeBlock({ ...latestPropsRef.current, subheadline: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
                  }}
                  style={{
                    marginTop: 10,
                    color: overlayBodyColor,
                    fontSize: compact ? 15 : (props?.subheadlineFontSize || 20),
                    lineHeight: 1.5,
                    fontWeight: Math.min(700, Number(props?.fontWeight || 400) || 400),
                    fontFamily: props?.fontFamily || props?.headlineFontFamily || "inherit",
                    ...((!editor || animationPreview) ? getAnimationStyle(props?.subheadlineAnimation, props?.subheadlineAnimationDelay || 0, props?.subheadlineAnimationSpeed) : {}),
                    outline: editor ? "1px dashed rgba(255,255,255,0.35)" : "none",
                    borderRadius: 10,
                    padding: editor ? "6px 8px" : 0,
                  }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(props?.subheadline || "Add supporting text") }}
                />
              ) : null}
              {editor ? (
                <>
                  <div
                    title="Resize text width"
                    aria-label="Resize text width"
                    onPointerDown={startOverlayResize}
                    onMouseDown={startOverlayResize}
                    style={{
                      position: "absolute",
                      top: 12,
                      right: -10,
                      bottom: 12,
                      width: 16,
                      borderRadius: 999,
                      background: "linear-gradient(180deg, #7dd3fc, #0ea5e9)",
                      border: "2px solid #ffffff",
                      boxShadow: "0 8px 18px rgba(14,165,233,0.3)",
                      cursor: "ew-resize",
                      touchAction: "none",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      right: 14,
                      bottom: -22,
                      borderRadius: 999,
                      border: "1px solid rgba(14,165,233,0.36)",
                      background: "rgba(255,255,255,0.97)",
                      color: "#0f3f73",
                      boxShadow: "0 10px 20px rgba(15,23,42,0.18)",
                      padding: "4px 10px",
                      fontSize: 16,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      pointerEvents: "none",
                    }}
                  >
                    Drag Right Edge
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
        {editor ? (
          <div style={{ position: "absolute", top: 10, left: 10, borderRadius: 999, background: "rgba(15,23,42,0.72)", color: "#fff", padding: "5px 9px", fontSize: 16, fontWeight: 600 }}>
            Resize handle enabled
          </div>
        ) : null}
        {editor ? (
          <div
            title="Drag to resize image"
            aria-label="Drag to resize image"
            data-resize-handle="image"
            onPointerDown={startResize}
            onMouseDown={startResize}
            style={{ position: "absolute", right: 10, bottom: props.caption ? 34 : 10, width: 18, height: 18, borderRadius: 999, background: "#0ea5e9", border: "2px solid #fff", cursor: "nwse-resize", boxShadow: "0 6px 16px rgba(14,165,233,0.35)" }}
          />
        ) : null}
        {props.caption ? (
          <figcaption
            data-website-inline-editor="true"
            contentEditable={editor}
            suppressContentEditableWarning
            onBlur={(event) => {
              if (!editor || typeof onChangeBlock !== "function") return;
              onChangeBlock({ ...latestPropsRef.current, caption: cleanInlineEditorHtml(event.currentTarget.innerHTML) });
            }}
            style={{ ...sharedStyles.figureCaption, outline: editor ? "1px dashed rgba(14,165,233,0.45)" : "none", padding: editor ? "4px 6px" : 0, borderRadius: 8 }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(props.caption) }}
          />
        ) : null}
      </figure>
    </section>
  );
}
