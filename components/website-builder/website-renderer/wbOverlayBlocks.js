import React from "react";
import { sharedStyles } from "./wbVariantStyles";
import { IconCounterNumber } from "./wbAnimations";
import { clampValue } from "./wbBlockHelpers.js";


export function renderOverlayGuides(guides) {
  if (!guides?.active && !guides?.showX && !guides?.showY) return null;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          width: guides.showX ? 2 : 1,
          background: guides.showX ? "rgba(14,165,233,0.96)" : "rgba(14,165,233,0.28)",
          boxShadow: guides.showX ? "0 0 0 1px rgba(255,255,255,0.24), 0 0 18px rgba(14,165,233,0.24)" : "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: guides.showY ? 2 : 1,
          background: guides.showY ? "rgba(14,165,233,0.96)" : "rgba(14,165,233,0.28)",
          boxShadow: guides.showY ? "0 0 0 1px rgba(255,255,255,0.24), 0 0 18px rgba(14,165,233,0.24)" : "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: guides.showX || guides.showY ? 12 : 8,
          height: guides.showX || guides.showY ? 12 : 8,
          borderRadius: 999,
          background: guides.showX || guides.showY ? "#38bdf8" : "rgba(148,163,184,0.5)",
          border: "2px solid rgba(255,255,255,0.85)",
          boxShadow: guides.showX || guides.showY ? "0 0 18px rgba(56,189,248,0.28)" : "none",
        }}
      />
    </div>
  );
}


export function getOverlayGuideState(x, y, rect) {
  const safeWidth = Math.max(rect?.width || 1, 1);
  const safeHeight = Math.max(rect?.height || 1, 1);
  const xThreshold = Math.max(1, (12 / safeWidth) * 100);
  const yThreshold = Math.max(1, (12 / safeHeight) * 100);
  const snappedX = Math.abs(x - 50) <= xThreshold ? 50 : x;
  const snappedY = Math.abs(y - 50) <= yThreshold ? 50 : y;

  return {
    snappedX,
    snappedY,
    showX: snappedX === 50,
    showY: snappedY === 50,
  };
}


export function getPixelGuideState(x, y, width, height, rect, threshold = 10) {
  const safeWidth = Math.max(rect?.width || 1, 1);
  const safeHeight = Math.max(rect?.height || 1, 1);
  const centerX = x + (width / 2);
  const centerY = y + (height / 2);
  const targetX = safeWidth / 2;
  const targetY = safeHeight / 2;
  const showX = Math.abs(centerX - targetX) <= threshold;
  const showY = Math.abs(centerY - targetY) <= threshold;

  return {
    snappedX: showX ? targetX - (width / 2) : x,
    snappedY: showY ? targetY - (height / 2) : y,
    showX,
    showY,
  };
}


export function renderCanvasCenterGuides(guides) {
  if (!guides?.active && !guides?.showX && !guides?.showY) return null;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 999 }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          width: guides.showX ? 2 : 1,
          background: guides.showX ? "rgba(56,189,248,0.98)" : "rgba(56,189,248,0.28)",
          boxShadow: guides.showX ? "0 0 0 1px rgba(255,255,255,0.28), 0 0 20px rgba(56,189,248,0.32)" : "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: guides.showY ? 2 : 1,
          background: guides.showY ? "rgba(56,189,248,0.98)" : "rgba(56,189,248,0.28)",
          boxShadow: guides.showY ? "0 0 0 1px rgba(255,255,255,0.28), 0 0 20px rgba(56,189,248,0.32)" : "none",
        }}
      />
    </div>
  );
}


export function getOverlayBoundsElement(shell) {
  if (!shell) return null;
  return shell.closest?.('[data-overlay-bounds="true"]') || shell.parentElement || null;
}


export function useOverlayBounds(shellRef) {
  const [bounds, setBounds] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const shell = shellRef.current;
    const boundsNode = getOverlayBoundsElement(shell);
    if (!boundsNode) return undefined;

    const updateBounds = () => {
      const rect = boundsNode.getBoundingClientRect();
      // getBoundingClientRect() returns scaled pixel dimensions when the canvas
      // is CSS-transformed (e.g. scale(0.4) to fit desktop canvas into builder pane).
      // Divide by the canvas scale so maxUsableWidth is based on the real layout size.
      const canvasScale = Number(boundsNode.closest('[data-canvas-scale]')?.dataset?.canvasScale || 1) || 1;
      setBounds({ width: (rect.width || 0) / canvasScale, height: (rect.height || 0) / canvasScale });
    };

    updateBounds();

    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateBounds);
      observer.observe(boundsNode);
    }

    window.addEventListener("resize", updateBounds);
    return () => {
      observer?.disconnect?.();
      window.removeEventListener("resize", updateBounds);
    };
  }, [shellRef]);

  return bounds;
}


export function DraggableContentOverlay({ props, compact, editor, onChangeBlock, align = "center", vertical = "center", children, overlayEnabled = false, contentShellStyle = null }) {
  const dragRef = React.useRef(null);
  const shellRef = React.useRef(null);
  const latestPropsRef = React.useRef(props || {});
  const draftPatchRef = React.useRef(null);
  const onChangeBlockRef = React.useRef(onChangeBlock);
  onChangeBlockRef.current = onChangeBlock;
  const [guides, setGuides] = React.useState({ showX: false, showY: false, active: false });
  const [draftPatch, setDraftPatch] = React.useState(null);
  const [isActive, setIsActive] = React.useState(false);
  const bounds = useOverlayBounds(shellRef);
  const canManipulate = !!editor && !compact;
  const xPct = Number(props?.contentX ?? 50);
  const yPct = Number(props?.contentY ?? 50);
  const boxWidth = Math.max(240, Number(props?.contentWidth ?? 760));
  const boxHeight = Math.max(100, Number(props?.contentHeight ?? 220));
  const displayX = Number(draftPatch?.contentX ?? xPct);
  const displayY = Number(draftPatch?.contentY ?? yPct);
  const displayBoxWidth = Math.max(240, Number(draftPatch?.contentWidth ?? boxWidth));
  const displayBoxHeight = Math.max(100, Number(draftPatch?.contentHeight ?? boxHeight));
  const maxUsableWidth = bounds.width ? Math.max(180, bounds.width - 24) : boxWidth;
  const maxUsableHeight = bounds.height ? Math.max(80, bounds.height - 24) : boxHeight;
  const effectiveWidth = Math.min(displayBoxWidth, maxUsableWidth);
  const effectiveHeight = Math.min(displayBoxHeight, maxUsableHeight);
  const constrainedWidth = `min(${effectiveWidth}px, calc(100% - 24px))`;
  const constrainedLeft = `clamp(calc(${effectiveWidth}px / 2), ${displayX}%, calc(100% - (${effectiveWidth}px / 2)))`;
  const constrainedTop = `clamp(calc(${effectiveHeight}px / 2), ${displayY}%, calc(100% - (${effectiveHeight}px / 2)))`;

  React.useEffect(() => {
    latestPropsRef.current = props || {};
  }, [props]);

  React.useEffect(() => {
    if (!editor) return undefined;

    const handleOutsidePointer = (event) => {
      const shell = shellRef.current;
      if (!shell || shell.contains(event.target)) return;
      if (event.target?.closest?.('[data-text-toolbar="true"]')) return;
      dragRef.current = null;
      draftPatchRef.current = null;
      setDraftPatch(null);
      setGuides({ showX: false, showY: false, active: false });
      setIsActive(false);
      if (shell.contains(document.activeElement) && typeof document.activeElement?.blur === "function") {
        document.activeElement.blur();
      }
      if (window.getSelection) {
        const selection = window.getSelection();
        if (selection && typeof selection.removeAllRanges === "function") selection.removeAllRanges();
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer, true);
  }, [editor]);

  React.useEffect(() => {
    if (!editor || !canManipulate) return undefined;

    const handleMove = (event) => {
      const current = dragRef.current;
      if (!current) return;
      const dx = (event.clientX - current.startX) / (current.canvasScale || 1);
      const dy = (event.clientY - current.startY) / (current.canvasScale || 1);

      if (current.mode === "resize") {
        let nextWidth = current.baseWidth;
        let nextHeight = current.baseHeight;

        if (["left", "nw", "sw"].includes(current.handle)) nextWidth = current.baseWidth - dx;
        if (["right", "ne", "se"].includes(current.handle)) nextWidth = current.baseWidth + dx;
        if (["top", "nw", "ne"].includes(current.handle)) nextHeight = current.baseHeight - dy;
        if (["bottom", "sw", "se"].includes(current.handle)) nextHeight = current.baseHeight + dy;

        nextWidth = clampValue(nextWidth, 180, current.rect.width);
        nextHeight = clampValue(nextHeight, 80, current.rect.height);

        const halfWidthPct = (nextWidth / current.rect.width) * 50;
        const halfHeightPct = (nextHeight / current.rect.height) * 50;
        const guideState = getOverlayGuideState(
          clampValue(current.baseX, halfWidthPct, 100 - halfWidthPct),
          clampValue(current.baseY, halfHeightPct, 100 - halfHeightPct),
          current.rect,
        );

        const patch = {
          contentWidth: Math.round(nextWidth),
          contentHeight: Math.round(nextHeight),
          contentX: Math.round(guideState.snappedX),
          contentY: Math.round(guideState.snappedY),
        };
        draftPatchRef.current = patch;
        setDraftPatch(patch);
        setGuides({ showX: guideState.showX, showY: guideState.showY, active: true });
        return;
      }

      const halfWidthPct = (current.baseWidth / current.rect.width) * 50;
      const halfHeightPct = (current.baseHeight / current.rect.height) * 50;
      const guideState = getOverlayGuideState(
        clampValue(current.baseX + ((dx / current.rect.width) * 100), halfWidthPct, 100 - halfWidthPct),
        clampValue(current.baseY + ((dy / current.rect.height) * 100), halfHeightPct, 100 - halfHeightPct),
        current.rect,
      );

      const patch = { contentX: Math.round(guideState.snappedX), contentY: Math.round(guideState.snappedY) };
      draftPatchRef.current = patch;
      setDraftPatch(patch);
      setGuides({ showX: guideState.showX, showY: guideState.showY, active: true });
    };

    const handleUp = () => {
      const patch = draftPatchRef.current;
      dragRef.current = null;
      draftPatchRef.current = null;
      setDraftPatch(null);
      setGuides({ showX: false, showY: false, active: false });
      if (patch) onChangeBlockRef.current?.({ ...latestPropsRef.current, ...patch });
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [editor, canManipulate]);

  function startInteraction(event, mode = "move", handle = "se") {
    if (!editor || !canManipulate) return;
    setIsActive(true);
    setGuides((prev) => ({ ...prev, active: true }));
    event.preventDefault();
    event.stopPropagation();
    const rectRaw = getOverlayBoundsElement(shellRef.current)?.getBoundingClientRect();
    if (!rectRaw) return;
    const canvasScale = Number(event.target.closest('[data-canvas-scale]')?.dataset?.canvasScale || 1);
    const rect = { ...rectRaw, width: rectRaw.width / canvasScale, height: rectRaw.height / canvasScale };
    dragRef.current = {
      mode,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      baseX: xPct,
      baseY: yPct,
      baseWidth: effectiveWidth,
      baseHeight: effectiveHeight,
      rect,
      canvasScale,
    };
  }

  function maybeStartMove(event) {
    const target = event.target;
    if (target?.closest?.('[contenteditable="true"], button, a, input, textarea, select, [data-overlay-resize="true"]')) {
      return;
    }
    startInteraction(event, "move");
  }

  if (!overlayEnabled || compact) {
    // A block that opts into a padded content panel (contentPadding) keeps that panel when
    // stacked on tablet/mobile, so text stays legible over bright background images.
    const keepCompactPanel = compact && !!props?.contentPadding && !!props?.contentBackground && props.contentBackground !== "transparent";
    return (
      <div style={{ position: "relative", zIndex: 3, width: "100%" }}>
        <div style={{ width: "100%", maxWidth: "100%", ...(keepCompactPanel ? { background: props.contentBackground, padding: "24px 22px", borderRadius: 18, boxSizing: "border-box" } : {}) }}>{children}</div>
      </div>
    );
  }

  return (
    <>
      {editor ? renderOverlayGuides(guides) : null}
      <div
        ref={shellRef}
        onPointerDownCapture={() => setIsActive(true)}
        onFocusCapture={() => setIsActive(true)}
        onPointerDown={maybeStartMove}
        style={{
          position: "absolute",
          left: constrainedLeft,
          top: constrainedTop,
          transform: "translate(-50%, -50%)",
          width: constrainedWidth,
          maxWidth: "100%",
          minHeight: `${effectiveHeight}px`,
          zIndex: isActive ? 4 : 3,
          border: editor ? "1px dashed rgba(125,211,252,0.9)" : "none",
          borderRadius: 14,
          padding: editor ? "30px 0 6px" : 0,
          background: editor && isActive ? "rgba(15,23,42,0.06)" : "transparent",
          boxSizing: "border-box",
          touchAction: "none",
          cursor: editor ? "move" : "default",
          pointerEvents: "auto",
        }}
      >
        {editor ? (
          <div
            data-overlay-drag-handle="true"
            onPointerDown={(event) => startInteraction(event, "move")}
            style={{ position: "absolute", top: 4, left: 8, right: 8, zIndex: 5, cursor: "move", display: "flex", justifyContent: align === "right" ? "flex-end" : align === "left" ? "flex-start" : "center" }}
          >
            <span style={sharedStyles.editorChip}>Drag Text Box</span>
          </div>
        ) : null}
        {editor ? (
          <button
            type="button"
            title="Delete text block"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onChangeBlock?.({ ...latestPropsRef.current, hideTextOverlay: true }); }}
            style={{ position: "absolute", top: 4, right: 6, zIndex: 10, width: 22, height: 22, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff", color: "#fff", fontSize: 16, fontWeight: 600, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(239,68,68,0.5)" }}
          >
            ?
          </button>
        ) : null}
        <div
          style={{
            width: "100%",
            minHeight: Math.max(80, effectiveHeight),
            display: "flex",
            flexDirection: "column",
            justifyContent: vertical === "top" ? "flex-start" : vertical === "bottom" ? "flex-end" : "center",
            alignItems: "stretch",
            textAlign: align,
            overflow: editor ? "hidden" : "visible",
            boxSizing: "border-box",
            background: props?.contentBackground || (editor ? "rgba(15,23,42,0.08)" : "transparent"),
            borderRadius: 16,
            padding: props?.contentPadding
              ? props.contentPadding
              : (editor || (props?.contentBackground && props.contentBackground !== "transparent")) ? (compact ? 12 : 18) : 0,
            backdropFilter: props?.contentBackground && props.contentBackground !== "transparent" ? "blur(2px)" : "none",
            ...(contentShellStyle || {}),
          }}
        >
          {children}
        </div>
        {editor && isActive ? [
          { key: "left", left: -7, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize", width: 14, height: 28 },
          { key: "right", right: -7, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize", width: 14, height: 28 },
          { key: "top", top: -7, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize", width: 28, height: 14 },
          { key: "bottom", bottom: -7, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize", width: 28, height: 14 },
          { key: "nw", left: -7, top: -7, cursor: "nwse-resize", width: 14, height: 14 },
          { key: "ne", right: -7, top: -7, cursor: "nesw-resize", width: 14, height: 14 },
          { key: "sw", left: -7, bottom: -7, cursor: "nesw-resize", width: 14, height: 14 },
          { key: "se", right: -7, bottom: -7, cursor: "nwse-resize", width: 14, height: 14 },
        ].map((handle) => (
          <div
            key={handle.key}
            data-overlay-resize="true"
            onPointerDown={(event) => startInteraction(event, "resize", handle.key)}
            onMouseDown={(event) => startInteraction(event, "resize", handle.key)}
            style={{ position: "absolute", borderRadius: 999, background: "#0ea5e9", border: "2px solid #fff", boxShadow: "0 6px 16px rgba(14,165,233,0.35)", ...handle }}
          />
        )) : null}
      </div>
    </>
  );
}


export function ExtraTextOverlay({ item, editor, onUpdate, onDelete }) {
  const dragRef = React.useRef(null);
  const shellRef = React.useRef(null);
  const onUpdateRef = React.useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const draftRef = React.useRef(null); // never in effect deps — avoids listener churn on every pixel
  const [draft, setDraft] = React.useState(null);
  const [isActive, setIsActive] = React.useState(false);

  const x = Number(draft?.x ?? item.x ?? 50);
  const y = Number(draft?.y ?? item.y ?? 30);
  const w = Math.max(80, Number(draft?.width ?? item.width ?? 320));
  const h = Math.max(30, Number(draft?.height ?? item.height ?? 80));

  React.useEffect(() => {
    if (!editor) return undefined;
    const handleMove = (event) => {
      const cur = dragRef.current;
      if (!cur) return;
      const { containerBounds } = cur;
      if (!containerBounds || containerBounds.width === 0) return;
      const dx = (event.clientX - cur.startX) / (cur.canvasScale || 1);
      const dy = (event.clientY - cur.startY) / (cur.canvasScale || 1);
      let next;
      if (cur.mode === "resize") {
        next = { x: cur.baseX, y: cur.baseY, width: Math.round(Math.max(80, cur.baseW + dx)), height: Math.round(Math.max(30, cur.baseH + dy)) };
      } else {
        next = {
          x: Math.round(Math.max(0, Math.min(100, cur.baseX + (dx / containerBounds.width) * 100))),
          y: Math.round(Math.max(0, Math.min(100, cur.baseY + (dy / containerBounds.height) * 100))),
          width: cur.baseW,
          height: cur.baseH,
        };
      }
      draftRef.current = next;
      setDraft({ ...next });
    };
    const handleUp = () => {
      const d = draftRef.current;
      dragRef.current = null;
      draftRef.current = null;
      setDraft(null);
      if (d) onUpdateRef.current(d);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [editor]); // intentionally no draft/state in deps — draftRef keeps it current

  function startDrag(event, mode = "move") {
    if (!editor) return;
    event.preventDefault();
    event.stopPropagation();
    setIsActive(true);
    // Capture bounds once at drag start — not during move
    const container = shellRef.current?.closest?.('[data-overlay-bounds="true"]') || shellRef.current?.parentElement;
    const canvasScale = Number(event.currentTarget.closest('[data-canvas-scale]')?.dataset?.canvasScale || 1);
    const cbRaw = container?.getBoundingClientRect() || null;
    const containerBounds = cbRaw ? { ...cbRaw, width: cbRaw.width / canvasScale, height: cbRaw.height / canvasScale } : null;
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, baseX: x, baseY: y, baseW: w, baseH: h, containerBounds, canvasScale };
  }

  const isDragging = !!dragRef.current;

  return (
    <div
      ref={shellRef}
      onPointerDown={(event) => { if (!event.target?.closest?.('[data-txt-edit="true"],[data-overlay-resize="true"]')) startDrag(event, "move"); }}
      onMouseDown={(event) => { if (!event.target?.closest?.('[data-txt-edit="true"],[data-overlay-resize="true"]')) startDrag(event, "move"); }}
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
        width: `min(${w}px, calc(100% - 16px))`,
        minHeight: `${h}px`,
        zIndex: isActive ? 12 : 10,
        border: editor ? `2px dashed ${isActive ? "rgba(34,197,94,1)" : "rgba(34,197,94,0.55)"}` : "none",
        borderRadius: 10,
        background: item.background && item.background !== "transparent" ? item.background : "transparent",
        boxSizing: "border-box",
        touchAction: "none",
        cursor: editor ? "grab" : "default",
        pointerEvents: "auto",
        padding: editor ? "20px 8px 6px" : "4px 8px",
        userSelect: "none",
      }}
    >
      {editor ? (
        <span style={{ position: "absolute", top: 2, left: 6, fontSize: 16, fontWeight: 600, color: "#22c55e", letterSpacing: "0.1em", pointerEvents: "none", userSelect: "none" }}>
          TEXT {isActive ? `· ${x}% ${y}%` : ""}
        </span>
      ) : null}
      {editor ? (
        <button
          type="button"
          data-overlay-resize="true"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onDelete(); }}
          style={{ position: "absolute", top: -9, right: -9, zIndex: 14, width: 20, height: 20, borderRadius: 999, background: "rgba(239,68,68,0.9)", border: "2px solid #fff", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", display: "grid", placeItems: "center", padding: 0, lineHeight: 1 }}
        >×</button>
      ) : null}
      {editor ? (
        <div
          data-overlay-resize="true"
          onPointerDown={(event) => { event.stopPropagation(); startDrag(event, "resize"); }}
          onMouseDown={(event) => { event.stopPropagation(); startDrag(event, "resize"); }}
          style={{ position: "absolute", right: -7, bottom: -7, width: 15, height: 15, borderRadius: 3, background: "#22c55e", border: "2px solid #fff", cursor: "se-resize", zIndex: 14 }}
        />
      ) : null}
      <div
        data-txt-edit="true"
        contentEditable={editor}
        suppressContentEditableWarning
        onMouseDown={(event) => editor && event.stopPropagation()}
        onPointerDown={(event) => editor && event.stopPropagation()}
        onBlur={(event) => {
          if (!editor) return;
          onUpdateRef.current({ text: event.currentTarget.innerHTML });
        }}
        style={{
          outline: "none",
          fontSize: Number(item.fontSize || 18),
          fontWeight: item.fontWeight || "600",
          color: item.color || "#ffffff",
          textAlign: item.textAlign || "center",
          lineHeight: 1.35,
          cursor: "text",
          minHeight: 20,
          wordBreak: "break-word",
          userSelect: editor ? "text" : "none",
        }}
        dangerouslySetInnerHTML={{ __html: item.text || (editor ? "Click to edit" : "") }}
      />
    </div>
  );
}


export function ExtraCounterOverlay({ item, editor, onUpdate, onDelete }) {
  const dragRef = React.useRef(null);
  const shellRef = React.useRef(null);
  const onUpdateRef = React.useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const draftRef = React.useRef(null);
  const [draft, setDraft] = React.useState(null);
  const [isActive, setIsActive] = React.useState(false);
  const [showEdit, setShowEdit] = React.useState(false);

  const x = Number(draft?.x ?? item.x ?? 50);
  const y = Number(draft?.y ?? item.y ?? 30);
  const w = Math.max(100, Number(draft?.width ?? item.width ?? 280));
  const h = Math.max(40, Number(draft?.height ?? item.height ?? 80));

  React.useEffect(() => {
    if (!editor) return undefined;
    const handleMove = (event) => {
      const cur = dragRef.current;
      if (!cur) return;
      const { containerBounds } = cur;
      if (!containerBounds || containerBounds.width === 0) return;
      const dx = (event.clientX - cur.startX) / (cur.canvasScale || 1);
      const dy = (event.clientY - cur.startY) / (cur.canvasScale || 1);
      let next;
      if (cur.mode === "resize") {
        next = { x: cur.baseX, y: cur.baseY, width: Math.round(Math.max(100, cur.baseW + dx)), height: Math.round(Math.max(40, cur.baseH + dy)) };
      } else {
        next = {
          x: Math.round(Math.max(0, Math.min(100, cur.baseX + (dx / containerBounds.width) * 100))),
          y: Math.round(Math.max(0, Math.min(100, cur.baseY + (dy / containerBounds.height) * 100))),
          width: cur.baseW,
          height: cur.baseH,
        };
      }
      draftRef.current = next;
      setDraft({ ...next });
    };
    const handleUp = () => {
      const d = draftRef.current;
      dragRef.current = null;
      draftRef.current = null;
      setDraft(null);
      if (d) onUpdateRef.current(d);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [editor]);

  function startDrag(event, mode = "move") {
    if (!editor) return;
    event.preventDefault();
    event.stopPropagation();
    setIsActive(true);
    const container = shellRef.current?.closest?.('[data-overlay-bounds="true"]') || shellRef.current?.parentElement;
    const canvasScale = Number(event.currentTarget.closest('[data-canvas-scale]')?.dataset?.canvasScale || 1);
    const cbRaw = container?.getBoundingClientRect() || null;
    const containerBounds = cbRaw ? { ...cbRaw, width: cbRaw.width / canvasScale, height: cbRaw.height / canvasScale } : null;
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, baseX: x, baseY: y, baseW: w, baseH: h, containerBounds, canvasScale };
  }

  const numSize = item.numberSize || 52;
  const numColor = item.numberColor || "#0c8ce9";
  const labelColor = item.labelColor || "rgba(255,255,255,0.85)";
  const bg = item.background || "rgba(0,0,0,0.45)";
  const suffix = item.suffix || "";
  const label = item.label || "Site Visits";
  const iconType = item.iconType || "diamond";
  const iconColor = item.iconColor || "rgba(255,255,255,0.13)";
  const iconSize = Math.max(h * 0.85, 56);

  // Background watermark icon
  const WatermarkIcon = () => {
    if (iconType === "none") return null;
    const sharedStyle = { position: "absolute", width: iconSize, height: iconSize, left: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", overflow: "visible" };
    if (iconType === "circle") {
      return (
        <svg aria-hidden="true" viewBox="0 0 100 100" fill="none" stroke={iconColor} strokeWidth="2.5" style={sharedStyle}>
          <circle cx="50" cy="50" r="46" />
        </svg>
      );
    }
    if (iconType === "star") {
      return (
        <svg aria-hidden="true" viewBox="0 0 100 100" fill="none" stroke={iconColor} strokeWidth="2.5" style={sharedStyle}>
          <polygon points="50,5 61,35 95,38 70,60 79,93 50,75 21,93 30,60 5,38 39,35" />
        </svg>
      );
    }
    if (iconType === "hexagon") {
      return (
        <svg aria-hidden="true" viewBox="0 0 100 100" fill="none" stroke={iconColor} strokeWidth="2.5" style={sharedStyle}>
          <polygon points="50,5 93,27.5 93,72.5 50,95 7,72.5 7,27.5" />
        </svg>
      );
    }
    // default: diamond
    return (
      <svg aria-hidden="true" viewBox="0 0 100 100" fill="none" stroke={iconColor} strokeWidth="2.5" style={sharedStyle}>
        <polygon points="50,4 96,50 50,96 4,50" />
      </svg>
    );
  };

  // Inline edit panel
  const EditPanel = () => (
    <div
      data-counter-resize="true"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{ position: "absolute", top: "calc(100% + 10px)", left: 0, zIndex: 30, background: "#1e293b", border: "1px solid rgba(14,165,233,0.45)", borderRadius: 12, padding: "12px 14px", boxShadow: "0 8px 28px rgba(0,0,0,0.65)", display: "flex", flexDirection: "column", gap: 10, minWidth: 260, width: Math.max(260, w) }}
    >
      <span style={{ fontSize: 16, fontWeight: 600, color: "#38bdf8", letterSpacing: "0.08em" }}>COUNTER SETTINGS</span>
      <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 16, color: "#94a3b8" }}>
        Label text
        <input
          type="text"
          value={item.label || ""}
          onChange={(e) => onUpdateRef.current({ label: e.target.value })}
          style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", fontSize: 16, outline: "none" }}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 16, color: "#94a3b8" }}>
        Background (CSS color / rgba)
        <input
          type="text"
          value={item.background || "rgba(0,0,0,0.45)"}
          onChange={(e) => onUpdateRef.current({ background: e.target.value })}
          placeholder="rgba(0,0,0,0.45) or #1e293b"
          style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", fontSize: 16, outline: "none" }}
        />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 16, color: "#94a3b8" }}>
          Number color
          <input type="color" value={/^#[0-9a-f]{3,6}$/i.test(item.numberColor || "") ? item.numberColor : "#0c8ce9"} onChange={(e) => onUpdateRef.current({ numberColor: e.target.value })}
            style={{ width: "100%", height: 30, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent" }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 16, color: "#94a3b8" }}>
          Label color
          <input type="color" value={/^#[0-9a-f]{3,6}$/i.test(item.labelColor || "") ? item.labelColor : "#ffffff"} onChange={(e) => onUpdateRef.current({ labelColor: e.target.value })}
            style={{ width: "100%", height: 30, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent" }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 16, color: "#94a3b8" }}>
          Icon color
          <input type="color" value={/^#[0-9a-f]{3,6}$/i.test(item.iconColor || "") ? item.iconColor : "#ffffff"} onChange={(e) => onUpdateRef.current({ iconColor: e.target.value })}
            style={{ width: "100%", height: 30, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent" }} />
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 16, color: "#94a3b8" }}>
          Number size
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button type="button" onClick={() => onUpdateRef.current({ numberSize: Math.max(24, (item.numberSize || 52) - 4) })}
              style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", cursor: "pointer", fontSize: 16, flexShrink: 0 }}>-</button>
            <span style={{ flex: 1, textAlign: "center", color: "#e2e8f0", fontSize: 16 }}>{item.numberSize || 52}</span>
            <button type="button" onClick={() => onUpdateRef.current({ numberSize: Math.min(120, (item.numberSize || 52) + 4) })}
              style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", cursor: "pointer", fontSize: 16, flexShrink: 0 }}>+</button>
          </div>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 16, color: "#94a3b8" }}>
          Background icon
          <select value={item.iconType || "diamond"} onChange={(e) => onUpdateRef.current({ iconType: e.target.value })}
            style={{ padding: "5px 6px", borderRadius: 6, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", fontSize: 16 }}>
            <option value="diamond">Diamond</option>
            <option value="circle">Circle</option>
            <option value="star">Star</option>
            <option value="hexagon">Hexagon</option>
            <option value="none">None</option>
          </select>
        </label>
      </div>
      <button type="button" onClick={() => setShowEdit(false)}
        style={{ marginTop: 2, padding: "6px 0", borderRadius: 7, border: "none", background: "#0ea5e9", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Done</button>
    </div>
  );

  return (
    <div
      ref={shellRef}
      onPointerDown={(event) => { if (!event.target?.closest?.('[data-counter-resize="true"]')) startDrag(event, "move"); }}
      onMouseDown={(event) => { if (!event.target?.closest?.('[data-counter-resize="true"]')) startDrag(event, "move"); }}
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
        width: `min(${w}px, calc(100% - 16px))`,
        minHeight: `${h}px`,
        zIndex: isActive ? 12 : 10,
        border: editor ? `2px dashed ${isActive ? "rgba(14,165,233,1)" : "rgba(14,165,233,0.6)"}` : "none",
        borderRadius: 14,
        background: bg,
        boxSizing: "border-box",
        touchAction: "none",
        cursor: editor ? "grab" : "default",
        pointerEvents: "auto",
        overflow: "visible",
        padding: editor ? "22px 14px 10px" : "10px 14px",
        backdropFilter: bg !== "transparent" ? "blur(6px)" : undefined,
        userSelect: "none",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      {/* Background watermark icon */}
      <WatermarkIcon />

      {/* Editor label */}
      {editor ? (
        <span style={{ position: "absolute", top: 3, left: 8, fontSize: 16, fontWeight: 600, color: "#38bdf8", letterSpacing: "0.1em", pointerEvents: "none", userSelect: "none" }}>
          COUNTER {isActive ? `· ${x}% ${y}%` : ""}
        </span>
      ) : null}

      {/* Delete button */}
      {editor ? (
        <button
          type="button"
          data-counter-resize="true"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onDelete(); }}
          style={{ position: "absolute", top: -9, right: -9, zIndex: 14, width: 20, height: 20, borderRadius: 999, background: "rgba(239,68,68,0.9)", border: "2px solid #fff", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer", display: "grid", placeItems: "center", padding: 0, lineHeight: 1 }}
        >×</button>
      ) : null}

      {/* Edit settings button */}
      {editor ? (
        <button
          type="button"
          data-counter-resize="true"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); setShowEdit((v) => !v); }}
          title="Edit counter settings"
          style={{ position: "absolute", top: -9, right: 16, zIndex: 14, width: 20, height: 20, borderRadius: 999, background: showEdit ? "#0ea5e9" : "rgba(30,41,59,0.9)", border: "2px solid #fff", color: "#fff", fontSize: 16, cursor: "pointer", display: "grid", placeItems: "center", padding: 0, lineHeight: 1 }}
        >×</button>
      ) : null}

      {/* Resize handle */}
      {editor ? (
        <div
          data-counter-resize="true"
          onPointerDown={(event) => { event.stopPropagation(); startDrag(event, "resize"); }}
          onMouseDown={(event) => { event.stopPropagation(); startDrag(event, "resize"); }}
          style={{ position: "absolute", right: -7, bottom: -7, width: 15, height: 15, borderRadius: 3, background: "#0ea5e9", border: "2px solid #fff", cursor: "se-resize", zIndex: 14 }}
        />
      ) : null}

      {/* Counter number + label — offset right to clear the watermark icon */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: iconType !== "none" ? Math.round(iconSize * 0.7) : 0, width: "100%", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
          <IconCounterNumber
            projectId={String(item.projectId || "")}
            targetNumber={item.targetNumber != null ? Number(item.targetNumber) : null}
            startNumber={Number(item.startNumber ?? 0)}
            suffix={suffix}
            color={numColor}
            compact={false}
            editor={editor}
            fontSize={numSize}
          />
        </div>
        {label ? (
          <p style={{ margin: 0, fontSize: Math.max(12, Math.round(numSize * 0.38)), fontWeight: 600, color: labelColor, lineHeight: 1.3, flex: 1 }}>
            {label}
          </p>
        ) : null}
      </div>

      {/* Inline edit panel */}
      {editor && showEdit ? <EditPanel /> : null}
    </div>
  );
}


export function DraggableImageOverlay({ props, compact, editor, onChangeBlock, onUploadImage, onSelectAsset, assets, imageSrc, overlayEnabled = false, frameStyle = null, isSelected = false, imageFit = "contain", onDelete = null, imageLabel = null, onMoveLayer = null }) {
  const dragRef = React.useRef(null);
  const shellRef = React.useRef(null);
  const latestPropsRef = React.useRef(props || {});
  const draftPatchRef = React.useRef(null);
  const onChangeBlockRef = React.useRef(onChangeBlock);
  onChangeBlockRef.current = onChangeBlock;
  const [guides, setGuides] = React.useState({ showX: false, showY: false, active: false });
  const [draftPatch, setDraftPatch] = React.useState(null);
  const [isActive, setIsActive] = React.useState(false);
  const bounds = useOverlayBounds(shellRef);
  const canManipulate = !!editor && !compact && !!imageSrc;
  const showEditorControls = !!editor;
  const overlayLibraryImages = Array.isArray(assets?.images) ? assets.images.slice(0, compact ? 2 : 4) : [];
  const xPct = Number(props?.floatingX ?? 76);
  const yPct = Number(props?.floatingY ?? 58);
  const rotationDeg = Number(props?.floatingRotation ?? 0);
  const boxWidth = Math.max(120, Number(props?.floatingWidth ?? 260));
  const boxHeight = Math.max(120, Number(props?.floatingHeight ?? 260));
  const displayX = Number(draftPatch?.floatingX ?? xPct);
  const displayY = Number(draftPatch?.floatingY ?? yPct);
  const displayRotation = draftPatch?.floatingRotation != null ? Number(draftPatch.floatingRotation) : rotationDeg;
  const displayBoxWidth = Math.max(120, Number(draftPatch?.floatingWidth ?? boxWidth));
  const displayBoxHeight = Math.max(120, Number(draftPatch?.floatingHeight ?? boxHeight));
  // No clamping on desktop — images can extend beyond the block edges intentionally (bleed
  // effect). On tablet/mobile a desktop-sized custom width/height is still stored verbatim in
  // px, so without a cap here it can bleed most of the way across a 375-430px viewport; allow
  // some bleed (matches the desktop design intent) but bound it relative to the block itself.
  const effectiveWidth = displayBoxWidth;
  const effectiveHeight = displayBoxHeight;
  const constrainedWidth = compact ? `min(${effectiveWidth}px, calc(100% * 1.3))` : `${effectiveWidth}px`;
  const constrainedHeight = compact ? `min(${effectiveHeight}px, calc(100% * 1.3))` : `${effectiveHeight}px`;
  const constrainedLeft = `${displayX}%`;
  const constrainedTop = `${displayY}%`;

  React.useEffect(() => {
    latestPropsRef.current = props || {};
  }, [props]);

  React.useEffect(() => {
    if (!editor) return undefined;

    const handleOutsidePointer = (event) => {
      const shell = shellRef.current;
      if (!shell || shell.contains(event.target)) return;
      dragRef.current = null;
      draftPatchRef.current = null;
      setDraftPatch(null);
      setGuides({ showX: false, showY: false, active: false });
      setIsActive(false);
    };

    document.addEventListener("pointerdown", handleOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer, true);
  }, [editor]);

  React.useEffect(() => {
    if (!editor || !canManipulate) return undefined;

    const handleMove = (event) => {
      const current = dragRef.current;
      if (!current) return;
      const dx = (event.clientX - current.startX) / (current.canvasScale || 1);
      const dy = (event.clientY - current.startY) / (current.canvasScale || 1);

      if (current.mode === "rotate") {
        const currentAngle = Math.atan2(event.clientY - current.centerY, event.clientX - current.centerX);
        const delta = (currentAngle - current.startAngle) * (180 / Math.PI);
        const patch = { floatingRotation: Math.round(current.baseRotation + delta) };
        draftPatchRef.current = patch;
        setDraftPatch(patch);
        return;
      }

      if (current.mode === "resize") {
        let nextWidth = current.baseWidth;
        let nextHeight = current.baseHeight;

        if (["left", "nw", "sw"].includes(current.handle)) nextWidth = current.baseWidth - dx;
        if (["right", "ne", "se"].includes(current.handle)) nextWidth = current.baseWidth + dx;
        if (["top", "nw", "ne"].includes(current.handle)) nextHeight = current.baseHeight - dy;
        if (["bottom", "sw", "se"].includes(current.handle)) nextHeight = current.baseHeight + dy;

        nextWidth = Math.max(60, nextWidth);
        nextHeight = Math.max(60, nextHeight);

        // When resizing, the center shifts by half the delta so the OPPOSITE edge stays fixed.
        // This applies to all handles: corners shift both axes, edge handles shift one axis.
        const changesW = ["left", "right", "nw", "ne", "sw", "se"].includes(current.handle);
        const changesH = ["top", "bottom", "nw", "ne", "sw", "se"].includes(current.handle);
        const newX = changesW ? current.baseX + (dx / current.rect.width * 50) : current.baseX;
        const newY = changesH ? current.baseY + (dy / current.rect.height * 50) : current.baseY;

        const patch = {
          floatingWidth: Math.round(nextWidth),
          floatingHeight: Math.round(nextHeight),
          floatingX: Math.round(newX),
          floatingY: Math.round(newY),
        };
        draftPatchRef.current = patch;
        setDraftPatch(patch);
        setGuides({ showX: false, showY: false, active: false });
        return;
      }

      // Move — no clamping, free to go off-edge
      const newX = current.baseX + ((dx / current.rect.width) * 100);
      const newY = current.baseY + ((dy / current.rect.height) * 100);
      const guideState = getOverlayGuideState(newX, newY, current.rect);
      const patch = { floatingX: Math.round(guideState.snappedX), floatingY: Math.round(guideState.snappedY) };
      draftPatchRef.current = patch;
      setDraftPatch(patch);
      setGuides({ showX: guideState.showX, showY: guideState.showY, active: true });
    };

    const handleUp = () => {
      const patch = draftPatchRef.current;
      dragRef.current = null;
      draftPatchRef.current = null;
      setDraftPatch(null);
      setGuides({ showX: false, showY: false, active: false });
      if (patch) onChangeBlockRef.current?.({ ...latestPropsRef.current, ...patch });
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [editor, canManipulate]);

  function startInteraction(event, mode = "move", handle = "se") {
    if (!editor || !canManipulate) return;
    setIsActive(true);
    setGuides((prev) => ({ ...prev, active: true }));
    event.preventDefault();
    event.stopPropagation();
    const rectRaw = getOverlayBoundsElement(shellRef.current)?.getBoundingClientRect();
    if (!rectRaw) return;
    const canvasScale = Number(event.target.closest('[data-canvas-scale]')?.dataset?.canvasScale || 1);
    const rect = { ...rectRaw, width: rectRaw.width / canvasScale, height: rectRaw.height / canvasScale };
    if (mode === "rotate") {
      const shellRect = shellRef.current?.getBoundingClientRect();
      if (!shellRect) return;
      const centerX = shellRect.left + shellRect.width / 2;
      const centerY = shellRect.top + shellRect.height / 2;
      dragRef.current = {
        mode: "rotate",
        centerX,
        centerY,
        startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
        baseRotation: rotationDeg,
        rect,
        canvasScale,
      };
      return;
    }
    dragRef.current = {
      mode,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      baseX: xPct,
      baseY: yPct,
      baseWidth: effectiveWidth,
      baseHeight: effectiveHeight,
      rect,
      canvasScale,
    };
  }

  function maybeStartMove(event) {
    const target = event.target;
    if (target?.closest?.('[data-overlay-resize="true"]')) return;
    startInteraction(event, "move");
  }

  function applyOverlayAsset(image) {
    if (typeof onChangeBlock !== "function" || !image?.src) return;
    onChangeBlock({
      ...props,
      floatingImage: image.src || "",
      floatingImageAssetId: image.id || "",
      floatingX: props.floatingX ?? xPct,
      floatingY: props.floatingY ?? yPct,
      floatingWidth: props.floatingWidth ?? effectiveWidth,
      floatingHeight: props.floatingHeight ?? effectiveHeight,
    });
  }

  if (!imageSrc) return null;

  if (!overlayEnabled || compact) {
    return (
      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          marginBottom: compact ? 18 : 24,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: compact ? "100%" : `min(${boxWidth}px, 100%)`,
            maxWidth: "100%",
            height: compact ? "auto" : `${effectiveHeight}px`,
            overflow: compact ? "visible" : "hidden",
            borderRadius: compact ? 18 : 22,
            boxShadow: compact ? "0 18px 34px rgba(15,23,42,0.16)" : "0 24px 48px rgba(15,23,42,0.28)",
            background: "rgba(255,255,255,0.06)",
            ...(frameStyle || {}),
          }}
        >
          <img src={imageSrc} alt={props?.floatingAlt || "Overlay image"} style={{ width: "100%", height: compact ? "auto" : "100%", maxWidth: "100%", objectFit: compact ? "contain" : imageFit, display: "block" }} onError={(e) => { e.target.style.display = "none"; }} />
        </div>
      </div>
    );
  }

  return (
    <>
      {editor ? renderOverlayGuides(guides) : null}
      <div
        ref={shellRef}
        onPointerDownCapture={() => setIsActive(true)}
        onFocusCapture={() => setIsActive(true)}
        onPointerDown={maybeStartMove}
        style={{
          position: "absolute",
          left: constrainedLeft,
          top: constrainedTop,
          transform: `translate(-50%, -50%) rotate(${displayRotation}deg)`,
          width: constrainedWidth,
          height: constrainedHeight,
          zIndex: isActive ? 5 : 2,
          border: editor ? "1px dashed rgba(245,158,11,0.95)" : "none",
          borderRadius: 18,
          background: "transparent",
          boxSizing: "border-box",
          touchAction: "none",
          cursor: editor ? "move" : "default",
          pointerEvents: "auto",
          overflow: "visible",
        }}
      >
        {editor ? (
          <div
            onPointerDown={(event) => startInteraction(event, "move")}
            style={{ position: "absolute", top: -12, left: 10, zIndex: 10, cursor: "move", display: "flex", gap: 4, alignItems: "center" }}
          >
            <span style={{ ...sharedStyles.editorChip, background: "#f59e0b", color: "#111827" }}>{imageLabel || "Drag Image"}</span>
            {onMoveLayer ? (
              <>
                <button
                  type="button"
                  data-overlay-resize="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onMoveLayer(-1); }}
                  style={{ ...sharedStyles.editorChip, background: "#334155", color: "#fff", padding: "2px 6px", fontSize: 16, cursor: "pointer" }}
                  title="Move layer backward"
                >? Back</button>
                <button
                  type="button"
                  data-overlay-resize="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onMoveLayer(1); }}
                  style={{ ...sharedStyles.editorChip, background: "#334155", color: "#fff", padding: "2px 6px", fontSize: 16, cursor: "pointer" }}
                  title="Move layer forward"
                >? Front</button>
              </>
            ) : null}
          </div>
        ) : null}
        <div style={{ width: "100%", height: "100%", overflow: "hidden", background: "transparent", ...(frameStyle ? { borderRadius: frameStyle.borderRadius, boxShadow: frameStyle.boxShadow, border: frameStyle.border } : { borderRadius: 0 }) }}>
          <img src={imageSrc} alt={props?.floatingAlt || "Overlay image"} style={{ width: "100%", height: "100%", objectFit: imageFit, display: "block", pointerEvents: "none", userSelect: "none" }} onError={(e) => { e.target.style.display = "none"; }} />
        </div>
        {editor && isActive ? [
          // Corners — resize both dimensions
          { key: "nw",     left: -7, top: -7,       cursor: "nwse-resize", width: 14, height: 14, dotRadius: 999 },
          { key: "ne",     right: -7, top: -7,      cursor: "nesw-resize", width: 14, height: 14, dotRadius: 999 },
          { key: "sw",     left: -7, bottom: -7,    cursor: "nesw-resize", width: 14, height: 14, dotRadius: 999 },
          { key: "se",     right: -7, bottom: -7,   cursor: "nwse-resize", width: 14, height: 14, dotRadius: 999 },
          // Center edges — larger transparent hit zone wraps a visible inner dot
          { key: "top",    top: -14,    left: "50%", transform: "translateX(-50%)", cursor: "ns-resize",  width: 36, height: 28, dotRadius: 4, dotW: 28, dotH: 14, dotTop: 14, dotLeft: 4 },
          { key: "bottom", bottom: -14, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize",  width: 36, height: 28, dotRadius: 4, dotW: 28, dotH: 14, dotTop: 0,  dotLeft: 4 },
          { key: "left",   left: -14,   top: "50%",  transform: "translateY(-50%)", cursor: "ew-resize",  width: 28, height: 36, dotRadius: 4, dotW: 14, dotH: 28, dotTop: 4,  dotLeft: 14 },
          { key: "right",  right: -14,  top: "50%",  transform: "translateY(-50%)", cursor: "ew-resize",  width: 28, height: 36, dotRadius: 4, dotW: 14, dotH: 28, dotTop: 4,  dotLeft: 0 },
        ].map((handle) => (
          <div
            key={handle.key}
            data-overlay-resize="true"
            onPointerDown={(event) => startInteraction(event, "resize", handle.key)}
            style={{ position: "absolute", background: "transparent", pointerEvents: "auto", zIndex: 10, boxSizing: "border-box", width: handle.width, height: handle.height, left: handle.left, right: handle.right, top: handle.top, bottom: handle.bottom, transform: handle.transform, cursor: handle.cursor }}
          >
            {handle.dotRadius === 999
              ? <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: "#f59e0b", border: "2px solid #fff", boxShadow: "0 6px 16px rgba(245,158,11,0.35)", pointerEvents: "none" }} />
              : <div style={{ position: "absolute", top: handle.dotTop, left: handle.dotLeft, width: handle.dotW, height: handle.dotH, borderRadius: handle.dotRadius, background: "#f59e0b", border: "2px solid #fff", boxShadow: "0 6px 16px rgba(245,158,11,0.35)", pointerEvents: "none" }} />
            }
          </div>
        )).concat([
          // Rotate handle — purple circle with ? icon, positioned above the image center
          <div
            key="rotate-handle"
            data-overlay-resize="true"
            onPointerDown={(event) => startInteraction(event, "rotate")}
            style={{ position: "absolute", bottom: -36, left: "50%", transform: "translateX(-50%)", zIndex: 10, width: 24, height: 24, borderRadius: 999, background: "#a78bfa", border: "2px solid #fff", cursor: "grab", display: "grid", placeItems: "center", fontSize: 14, color: "#fff", pointerEvents: "auto", boxShadow: "0 4px 12px rgba(167,139,250,0.45)", userSelect: "none" }}
            title={`Rotate image — current: ${displayRotation}°`}
          >?</div>,
        ]).concat(onDelete ? [
          <button
            key="delete-overlay"
            type="button"
            data-overlay-resize="true"
            onPointerDown={(event) => { event.stopPropagation(); }}
            onClick={(event) => { event.stopPropagation(); onDelete(); }}
            style={{ position: "absolute", top: -8, right: -8, zIndex: 7, width: 22, height: 22, borderRadius: 999, background: "rgba(239,68,68,0.92)", border: "2px solid #fff", color: "#fff", fontSize: 16, lineHeight: 1, cursor: "pointer", display: "grid", placeItems: "center", boxShadow: "0 4px 12px rgba(239,68,68,0.4)", padding: 0 }}
            title="Remove image"
          >×</button>
        ] : []) : null}
      </div>
    </>
  );
}
