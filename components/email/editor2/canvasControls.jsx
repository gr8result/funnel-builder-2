import { toAbsoluteUrl, clamp } from "./editorUtils.js";
import { updateAlignmentGuides, clearAlignmentGuides } from "./alignmentGuides.js";

export function ImgBtn({ src, onClick, onImageMouseDown, label = "Click to add image", style = {} }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        title="Double-click to replace image"
        onMouseDown={(event) => {
          onImageMouseDown?.(event);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onClick?.();
        }}
        style={{ width: "100%", height: "auto", display: "block", borderRadius: 4, cursor: "default", userSelect: "none", ...style }}
      />
    );
  }
  return (
    <div
      data-direct-action="true"
      onClick={onClick}
      style={{
        background: "#e2e8f0", borderRadius: 6, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 6,
        padding: "28px 12px", color: "#94a3b8", fontSize: 16, fontWeight: 600,
        width: "100%", boxSizing: "border-box", ...style,
      }}
    >
      <span style={{ fontSize: 24 }}>🖼️</span>
      {label}
    </div>
  );
}

function openCanvasHref(href) {
  const url = toAbsoluteUrl(href || "");
  if (!url || url === "#" || typeof window === "undefined") return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

export function CanvasLinkShell({ href, children, style = {}, title }) {
  const resolvedHref = toAbsoluteUrl(href || "");
  const canOpen = !!resolvedHref && resolvedHref !== "#";

  return (
    <a
      data-direct-action="true"
      href={canOpen ? resolvedHref : undefined}
      target={canOpen ? "_blank" : undefined}
      rel={canOpen ? "noopener noreferrer" : undefined}
      tabIndex={canOpen ? 0 : undefined}
      title={title || (canOpen ? resolvedHref : undefined)}
      onClick={(event) => {
        event.stopPropagation();
        if (!canOpen) {
          event.preventDefault();
        }
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      style={{ display: "inline-block", cursor: canOpen ? "pointer" : "default", textDecoration: "none", ...style }}
    >
      {children}
    </a>
  );
}

function canvasControlChipStyle({ emphasis = false, compact = false } = {}) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: compact ? 28 : 30,
    padding: compact ? "5px 10px" : "6px 11px",
    borderRadius: 999,
    border: emphasis ? "1px solid rgba(37,99,235,0.28)" : "1px solid rgba(15,23,42,0.12)",
    background: emphasis ? "rgba(239,246,255,0.96)" : "rgba(255,255,255,0.96)",
    color: "#0f172a",
    fontSize: compact ? 11 : 12,
    lineHeight: 1.2,
    fontWeight: 600,
    boxShadow: "0 6px 16px rgba(15,23,42,0.16)",
    maxWidth: "100%",
    textAlign: "center",
    whiteSpace: "normal",
    wordBreak: "break-word",
    backdropFilter: "blur(6px)",
  };
}

export function CanvasControlButton({ children, onClick, emphasis = false, compact = false, style = {} }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...canvasControlChipStyle({ emphasis, compact }),
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function CanvasControlBadge({ children, onMouseDown, emphasis = false, compact = false, style = {} }) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        ...canvasControlChipStyle({ emphasis, compact }),
        cursor: "move",
        userSelect: "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function ResizeHandle({ widthPct = 100, heightPx = 160, onChange, visible = true, widthKey = "widthPct", heightKey = "heightPx", label = "image" }) {
  if (!visible) return null;

  const startDrag = (dir) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    const sx = event.clientX;
    const sy = event.clientY;
    const startWidth = Number(widthPct || 100);
    const startHeight = Number(heightPx || 160);

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - sx;
      const dy = moveEvent.clientY - sy;
      const next = {};

      if (/[ew]/.test(dir)) {
        const widthDelta = dir.includes("e") ? dx / 2 : -dx / 2;
        next[widthKey] = clamp(Math.round(startWidth + widthDelta), 20, 100);
      }
      if (/[ns]/.test(dir)) {
        const heightDelta = dir.includes("s") ? dy : -dy;
        next[heightKey] = clamp(Math.round(startHeight + heightDelta), 60, 420);
      }
      onChange?.(next);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handles = [
    { dir: "nw", style: { left: -7, top: -7, cursor: "nwse-resize" } },
    { dir: "n", style: { left: "50%", top: -7, transform: "translateX(-50%)", cursor: "ns-resize" } },
    { dir: "ne", style: { right: -7, top: -7, cursor: "nesw-resize" } },
    { dir: "e", style: { right: -7, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } },
    { dir: "se", style: { right: -7, bottom: -7, cursor: "nwse-resize" } },
    { dir: "s", style: { left: "50%", bottom: -7, transform: "translateX(-50%)", cursor: "ns-resize" } },
    { dir: "sw", style: { left: -7, bottom: -7, cursor: "nesw-resize" } },
    { dir: "w", style: { left: -7, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } },
  ];

  return (
    <>
      <div style={{ position: "absolute", inset: -2, border: "1.5px dashed #93c5fd", borderRadius: 10, pointerEvents: "none" }} />
      {handles.map((handle) => (
        <button
          key={handle.dir}
          type="button"
          data-direct-action="true"
          onMouseDown={startDrag(handle.dir)}
          title={`Drag to resize ${label} (${handle.dir})`}
          style={{
            position: "absolute",
            width: 14,
            height: 14,
            borderRadius: 999,
            border: "1px solid #93c5fd",
            background: "rgba(255,255,255,0.98)",
            boxShadow: "0 2px 8px rgba(15,23,42,0.15)",
            ...handle.style,
          }}
        />
      ))}
    </>
  );
}

export function OverlayLayerBox({ rootSelector, src, x = 50, y = 22, widthPct = 24, heightPx = 72, radius = 8, isSelected = false, onPatch, onPick }) {
  if (!src) return null;

  const startMove = (event) => {
    if (!isSelected) return;
    event.preventDefault();
    event.stopPropagation();
    const root = event.currentTarget.closest(rootSelector);
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

  const startResize = (dir) => (event) => {
    if (!isSelected) return;
    event.preventDefault();
    event.stopPropagation();
    const root = event.currentTarget.closest(rootSelector);
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const sx = event.clientX;
    const sy = event.clientY;
    const startWidth = Number(widthPct || 24);
    const startHeight = Number(heightPx || 72);
    const startX = Number(x || 50);
    const startY = Number(y || 22);

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - sx;
      const dy = moveEvent.clientY - sy;
      const next = {};

      if (/[ew]/.test(dir)) {
        const widthDelta = dir.includes("e") ? (dx / rect.width) * 100 : (-dx / rect.width) * 100;
        next.overlayImageWidthPct = clamp(Math.round(startWidth + widthDelta), 8, 60);
        next.overlayImageX = clamp(Math.round(startX + (dx / rect.width) * 50), 5, 95);
      }
      if (/[ns]/.test(dir)) {
        const heightDelta = dir.includes("s") ? dy : -dy;
        next.overlayImageHeightPx = clamp(Math.round(startHeight + heightDelta), 24, 260);
        next.overlayImageY = clamp(Math.round(startY + (dy / rect.height) * 50), 5, 95);
      }
      onPatch?.(next);
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", handleUp);
  };

  const handles = [
    { dir: "nw", style: { left: -7, top: -7, cursor: "nwse-resize" } },
    { dir: "n", style: { left: "50%", top: -7, transform: "translateX(-50%)", cursor: "ns-resize" } },
    { dir: "ne", style: { right: -7, top: -7, cursor: "nesw-resize" } },
    { dir: "e", style: { right: -7, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } },
    { dir: "se", style: { right: -7, bottom: -7, cursor: "nwse-resize" } },
    { dir: "s", style: { left: "50%", bottom: -7, transform: "translateX(-50%)", cursor: "ns-resize" } },
    { dir: "sw", style: { left: -7, bottom: -7, cursor: "nesw-resize" } },
    { dir: "w", style: { left: -7, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } },
  ];

  return (
    <div
      data-direct-action="true"
      onMouseDown={startMove}
      style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)", zIndex: 3, textAlign: "center", width: `clamp(56px, ${widthPct}%, 180px)`, cursor: isSelected ? "move" : "default" }}
    >
      {isSelected && <div style={{ position: "absolute", inset: -2, border: "1.5px dashed #c084fc", borderRadius: (radius || 8) + 2, pointerEvents: "none" }} />}
      <img src={src} alt="" onClick={(e) => { e.stopPropagation(); if (!isSelected) onPick?.(); }} style={{ width: "100%", height: `${heightPx}px`, objectFit: "contain", display: "block", borderRadius: radius || 8, cursor: isSelected ? "move" : "pointer" }} />
      {isSelected && handles.map((handle) => (
        <button
          key={handle.dir}
          type="button"
          data-direct-action="true"
          onMouseDown={startResize(handle.dir)}
          style={{ position: "absolute", width: 14, height: 14, borderRadius: 999, border: "1px solid #c084fc", background: "rgba(255,255,255,0.98)", boxShadow: "0 2px 8px rgba(15,23,42,0.15)", ...handle.style }}
        />
      ))}
    </div>
  );
}
