// PlanCanvas.jsx — Phase 2 Manual Takeoff canvas.
//
// Drawing interaction (all through onMouseDown, never onClick):
//   e.detail === 1  → single click
//   e.detail >= 2   → double-click → finish polyline/polygon
//
// Tools that accumulate points (single click):
//   externalWall, internalWall, polyline, measure → double-click finishes
//   room → double-click OR click near first point finishes
//
// Two-point tools (two single clicks):
//   rectangle → click corner A, click corner B → done
//   circle    → click center,   click radius pt → done
//
// Marker tools (one click):
//   door, window, column
//
// Pointer tool:
//   click an overlay → select it
//   drag a handle    → move that point
//   click empty      → deselect
//
// Calibration (always highest priority when active):
//   all left-clicks → calibration point handler

import { useState, useRef, useEffect, useCallback } from "react";
import {
  TOOLS, OT, STYLE,
  POLYLINE_TOOLS, SEGMENT_TOOLS, POLYGON_TOOLS, MARKER_TOOLS, TWO_POINT_TOOLS,
  createOverlay,
} from "./takeoffTypes";
import {
  dist, polyLen, polyArea, polyPerim, centroid,
  circleArea, circlePerim, rectCorners,
  pxToM, pxToM2, findSnapPoint, hitOverlay,
  fmtM, fmtM2, fmtMM,
} from "./takeoffUtils";

const CLOSE_RADIUS_PX = 14; // screen px — click this close to start point to close polygon
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;

export default function PlanCanvas({
  page,
  tool,
  overlays,
  selectedId,
  calibrating,
  snapEnabled,
  onAddOverlay,
  onUpdateOverlay,
  onDeleteOverlay,
  onSelectOverlay,
  onCalibrationPoint,
  zoom,        setZoom,
  pan,         setPan,
  rotation,    setRotation,
}) {
  const rootRef     = useRef(null);
  const svgRef      = useRef(null);
  const gRef        = useRef(null);
  const spaceRef    = useRef(false);
  const altRef      = useRef(false);
  const shiftRef    = useRef(false);
  const panRef      = useRef(null);      // { mx, my, px, py } — drag-pan start
  // Mirror of zoom/pan state kept in refs so the wheel handler always reads
  // the latest value without needing to be re-registered on every render.
  const viewZoomRef = useRef(zoom);
  const viewPanRef  = useRef(pan);
  // Offscreen canvas for pixel-level wall edge detection
  const pixelCanvasRef = useRef(null);

  // Drawing state: ref for handlers + state for rendering
  const drawRef              = useRef(null);
  const [drawState,  _setDraw]    = useState(null);
  const [cursorPt,   setCursor]   = useState(null);
  const [snapResult, setSnapResult] = useState(null);
  const [noSnapMsg,  setNoSnapMsg]  = useState(false); // true when click blocked by snap gate
  const noSnapTimerRef = useRef(null);

  const setDraw = useCallback((v) => {
    const n = typeof v === "function" ? v(drawRef.current) : v;
    drawRef.current = n;
    _setDraw(n);
  }, []);

  // Keep refs in sync with state so wheel / key handlers always read current values
  useEffect(() => { viewZoomRef.current = zoom; }, [zoom]);
  useEffect(() => { viewPanRef.current  = pan;  }, [pan]);

  const W   = page?.naturalWidth  || 1200;
  const H   = page?.naturalHeight || 900;
  const ppm = page?.scale?.pixelsPerMetre || 0;

  // ── Load plan image to offscreen canvas for pixel-level edge detection ───────
  useEffect(() => {
    if (!page?.imageDataUrl) { pixelCanvasRef.current = null; return; }
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width  = page.naturalWidth;
      c.height = page.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      pixelCanvasRef.current = c;
    };
    img.src = page.imageDataUrl;
  }, [page?.id, page?.imageDataUrl]); // eslint-disable-line

  // ── Fit / reset ───────────────────────────────────────────────────────────

  const fit = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !page?.naturalWidth) return;
    const r = svg.getBoundingClientRect();
    const z = Math.min(r.width/W, r.height/H) * 0.92;
    setZoom(z);
    setPan({ x:(r.width -W*z)/2, y:(r.height-H*z)/2 });
    setRotation(0);
  }, [page, W, H, setZoom, setPan, setRotation]);

  useEffect(() => { fit(); }, [page?.id]); // eslint-disable-line

  // ── Modifier keys: Space (pan), Alt (disable snap), Shift (angle lock) ──────

  useEffect(() => {
    const dn = (e) => {
      if (e.code==="Space"&&!["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)) { e.preventDefault(); spaceRef.current=true; }
      if (e.code==="AltLeft"||e.code==="AltRight")     { e.preventDefault(); altRef.current=true; }
      if (e.code==="ShiftLeft"||e.code==="ShiftRight")  shiftRef.current=true;
    };
    const up = (e) => {
      if (e.code==="Space")                             spaceRef.current=false;
      if (e.code==="AltLeft"||e.code==="AltRight")     altRef.current=false;
      if (e.code==="ShiftLeft"||e.code==="ShiftRight")  shiftRef.current=false;
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup",   up);
    return () => { window.removeEventListener("keydown",dn); window.removeEventListener("keyup",up); };
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  const cancelDraw = useCallback(() => { setDraw(null); setCursor(null); setSnapResult(null); }, [setDraw]);

  const finishDraw = useCallback(() => {
    const curr = drawRef.current;
    if (!curr) return;
    const { type, points } = curr;
    if (POLYLINE_TOOLS.has(type) && points.length >= 2) onAddOverlay?.(createOverlay({ type, points }));
    else if (POLYGON_TOOLS.has(type) && points.length >= 3) onAddOverlay?.(createOverlay({ type, points }));
    setDraw(null); setCursor(null); setSnapResult(null);
  }, [onAddOverlay, setDraw]);

  useEffect(() => {
    const h = (e) => {
      if (["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)) return;

      // ── Arrow key pan ────────────────────────────────────────────────────
      const ARROW_STEP = e.shiftKey ? 200 : 60; // screen pixels
      if (e.key === "ArrowUp")    { e.preventDefault(); setPan(p=>({ ...p, y: p.y + ARROW_STEP })); return; }
      if (e.key === "ArrowDown")  { e.preventDefault(); setPan(p=>({ ...p, y: p.y - ARROW_STEP })); return; }
      if (e.key === "ArrowLeft")  { e.preventDefault(); setPan(p=>({ ...p, x: p.x + ARROW_STEP })); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); setPan(p=>({ ...p, x: p.x - ARROW_STEP })); return; }

      // ── Drawing shortcuts ────────────────────────────────────────────────
      if (e.key==="Escape") cancelDraw();
      if (e.key==="Enter")  finishDraw();

      // ── Zoom buttons (zoom to viewport centre) ───────────────────────────
      if (e.key==="+"||e.key==="=") {
        const svg = svgRef.current;
        if (!svg) return;
        const r = svg.getBoundingClientRect();
        const mx = r.width/2, my = r.height/2;
        const z  = viewZoomRef.current, p = viewPanRef.current;
        const nz = Math.min(MAX_ZOOM, z*1.15);
        setZoom(nz);
        setPan({ x: mx-(mx-p.x)*(nz/z), y: my-(my-p.y)*(nz/z) });
        return;
      }
      if (e.key==="-") {
        const svg = svgRef.current;
        if (!svg) return;
        const r = svg.getBoundingClientRect();
        const mx = r.width/2, my = r.height/2;
        const z  = viewZoomRef.current, p = viewPanRef.current;
        const nz = Math.max(MIN_ZOOM, z/1.15);
        setZoom(nz);
        setPan({ x: mx-(mx-p.x)*(nz/z), y: my-(my-p.y)*(nz/z) });
        return;
      }

      if (e.key==="f"||e.key==="F") fit();
      if (e.key==="r"||e.key==="R") setRotation(r=>(r+90)%360);
      if ((e.key==="Delete"||e.key==="Backspace")&&selectedId&&!drawRef.current) {
        onDeleteOverlay?.(selectedId);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [cancelDraw, finishDraw, fit, selectedId, setZoom, setPan, setRotation, onDeleteOverlay]);

  // ── Wheel zoom ────────────────────────────────────────────────────────────

  const zoomAtClientPoint = useCallback((clientX, clientY, deltaY) => {
    const root = rootRef.current || svgRef.current;
    if (!root) return;
    const r  = root.getBoundingClientRect();
    const mx = clientX - r.left;
    const my = clientY - r.top;
    const f  = deltaY < 0 ? 1.12 : 1 / 1.12;

    // Read current values from refs — avoids the stale-closure problem that
    // caused the canvas to jump when calling setPan inside setZoom's updater.
    const z  = viewZoomRef.current;
    const p  = viewPanRef.current;
    const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * f));

    // Both state updates computed from the SAME snapshot of z and p.
    // React 18 batches them into one render, so zoom and pan change together.
    setZoom(nz);
    setPan({
      x: mx - (mx - p.x) * (nz / z),
      y: my - (my - p.y) * (nz / z),
    });
  }, [setZoom, setPan]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    zoomAtClientPoint(e.clientX, e.clientY, e.deltaY);
  }, [zoomAtClientPoint]);

  // ── Coordinate conversion ─────────────────────────────────────────────────

  const toCanvas = useCallback((e) => {
    const g = gRef.current;
    if (!g) return null;
    try {
      const ctm = g.getScreenCTM();
      if (!ctm) return null;
      const pt = g.ownerSVGElement.createSVGPoint();
      pt.x=e.clientX; pt.y=e.clientY;
      const l = pt.matrixTransform(ctm.inverse());
      return { x:l.x, y:l.y };
    } catch { return null; }
  }, []);

  // Used in mousemove — always returns a point (never null) so the preview line follows cursor
  // ── Pixel-level wall edge detection ──────────────────────────────────────
  // Scans the rendered plan image for dark pixels (wall lines) within a radius.
  // canvasX/Y are in plan image coordinates (same as toCanvas() output).
  // radiusPx is in IMAGE pixels (= screen radius / zoom).
  const findPixelEdge = useCallback((canvasX, canvasY, radiusPx) => {
    const oc = pixelCanvasRef.current;
    if (!oc) return null;
    const ctx = oc.getContext("2d");
    const r   = Math.ceil(radiusPx);
    const sx  = Math.max(0, Math.round(canvasX - r));
    const sy  = Math.max(0, Math.round(canvasY - r));
    const sw  = Math.min(r * 2 + 1, oc.width  - sx);
    const sh  = Math.min(r * 2 + 1, oc.height - sy);
    if (sw <= 0 || sh <= 0) return null;

    const data = ctx.getImageData(sx, sy, sw, sh).data;
    const DARK = 80;   // RGB average below this = dark wall pixel

    let nearest = null, nd = radiusPx;
    for (let py = 0; py < sh; py++) {
      for (let px = 0; px < sw; px++) {
        const i  = (py * sw + px) * 4;
        const br = (data[i] + data[i+1] + data[i+2]) / 3;
        if (br > DARK) continue;           // not a dark pixel
        const ix = sx + px, iy = sy + py;
        const d  = Math.sqrt((ix - canvasX)**2 + (iy - canvasY)**2);
        if (d < nd) { nearest = { x: ix, y: iy }; nd = d; }
      }
    }
    return nearest ? { ...nearest, type: "edge", label: "Wall edge" } : null;
  }, []);

  // ── Snap helpers ──────────────────────────────────────────────────────────

  const snapForPreview = useCallback((rawPt) => {
    if (!rawPt) return null;
    const curr    = drawRef.current;
    const lastPt  = curr?.points?.[curr.points.length - 1] || null;
    const freeSnap = !snapEnabled || altRef.current;

    // Try overlay geometry first
    const result = findSnapPoint({
      rawPt, overlays, zoom, ppm,
      altHeld:  freeSnap,
      shiftHeld: shiftRef.current,
      lastPt,
      blockIfNoSnap: false,
    });

    // If no overlay snap found, scan plan image for dark wall lines (30 screen px radius)
    if (!freeSnap && (!result?.type || result.type === "free" || result.type === null)) {
      const edge = findPixelEdge(rawPt.x, rawPt.y, 30 / Math.max(zoom, 0.1));
      if (edge) return edge;
    }

    return result;
  }, [snapEnabled, overlays, zoom, ppm, findPixelEdge]);

  const snapForClick = useCallback((rawPt) => {
    if (!rawPt) return null;
    const curr    = drawRef.current;
    const lastPt  = curr?.points?.[curr.points.length - 1] || null;
    const freeSnap = !snapEnabled || altRef.current;

    // Try overlay geometry first
    const result = findSnapPoint({
      rawPt, overlays, zoom, ppm,
      altHeld:  freeSnap,
      shiftHeld: shiftRef.current,
      lastPt,
      blockIfNoSnap: false,   // we handle blocking below
    });

    if (freeSnap) return result; // snap off or alt held = always allow

    // Valid overlay snap
    if (result?.type && result.type !== null && result.type !== "free") return result;

    // Try pixel edge snap (30 screen px radius)
    const edge = findPixelEdge(rawPt.x, rawPt.y, 30 / Math.max(zoom, 0.1));
    if (edge) return edge;

    // Nothing found — block the click
    return null;
  }, [snapEnabled, overlays, zoom, ppm, findPixelEdge]);

  // Helper to show the "no snap" message briefly
  const showNoSnap = useCallback(() => {
    setNoSnapMsg(true);
    clearTimeout(noSnapTimerRef.current);
    noSnapTimerRef.current = setTimeout(() => setNoSnapMsg(false), 2200);
  }, []);

  // ── Is this event a pan trigger? ──────────────────────────────────────────

  const isPan = (e) =>
    tool===TOOLS.PAN || e.button===1 || e.button===2 || (e.button===0&&spaceRef.current);

  // ── Mouse down ────────────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e) => {
    // Calibration — always highest priority
    if (calibrating && e.button===0) {
      e.preventDefault();
      const pt = toCanvas(e);
      if (pt) onCalibrationPoint?.(pt);
      return;
    }

    if (isPan(e)) {
      e.preventDefault();
      panRef.current = { mx:e.clientX, my:e.clientY, px:pan.x, py:pan.y };
      return;
    }

    if (e.button!==0) return;
    e.preventDefault();

    const rawPt = toCanvas(e);
    if (!rawPt) return;

    // ── Snap gate: use strict snap for clicks ──────────────────────────────
    // Returns null if snap is ON, no target found, and Alt is not held.
    // Pointer and Delete tools always use free placement (they don't draw geometry).
    const needsSnap = tool !== TOOLS.POINTER && tool !== TOOLS.DELETE && !MARKER_TOOLS.has(tool);
    const pt = needsSnap ? snapForClick(rawPt) : rawPt;

    if (pt === null) {
      // Snap required but no target found
      showNoSnap();
      return;
    }
    // A valid point was resolved — clear any lingering no-snap message
    setNoSnapMsg(false);

    // ── Double click ──────────────────────────────────────────────────────
    if (e.detail >= 2) {
      // Segment tools (internal wall): double-click cancels the started point
      // (user may have accidentally double-clicked instead of two separate clicks)
      if (SEGMENT_TOOLS.has(drawRef.current?.type)) {
        setDraw(null); setCursor(null); setSnapResult(null);
        return;
      }
      // All other drawing tools: double-click finishes the shape
      finishDraw();
      return;
    }

    // ── Single click ──────────────────────────────────────────────────────
    const curr = drawRef.current;

    // Pointer: select / deselect
    if (tool === TOOLS.POINTER) {
      const thresh = 10/zoom;
      for (let i=overlays.length-1; i>=0; i--) {
        if (hitOverlay(pt, overlays[i], thresh)) {
          onSelectOverlay?.(overlays[i].id===selectedId ? null : overlays[i].id);
          return;
        }
      }
      onSelectOverlay?.(null);
      return;
    }

    // Delete: hit-test and remove
    if (tool === TOOLS.DELETE) {
      const thresh = 10/zoom;
      for (let i=overlays.length-1; i>=0; i--) {
        if (hitOverlay(pt, overlays[i], thresh)) { onDeleteOverlay?.(overlays[i].id); return; }
      }
      return;
    }

    // Marker tools: one click places
    if (MARKER_TOOLS.has(tool)) {
      onAddOverlay?.(createOverlay({ type: tool, points:[pt] }));
      return;
    }

    // ── Segment tools (Internal Wall) ─────────────────────────────────────
    // Click A = anchor.  Click B = commit segment, immediately reset for next.
    // The tool stays active so the user can keep drawing independent segments.
    if (SEGMENT_TOOLS.has(tool)) {
      if (!curr) {
        // First click: set the start point
        setDraw({ type: tool, points: [pt] });
      } else {
        // Second click: commit this segment and reset (NOT deactivate the tool)
        const [a] = curr.points;
        onAddOverlay?.(createOverlay({ type: tool, points: [{ ...a }, { ...pt }] }));
        setDraw(null);
        setCursor(null);
        setSnapResult(null);
        // Tool remains active — next click starts a new segment automatically
      }
      return;
    }

    // Two-point tools (rectangle, circle)
    if (TWO_POINT_TOOLS.has(tool)) {
      if (!curr) {
        setDraw({ type:tool, points:[pt] });
      } else {
        const [a] = curr.points;
        const pts = tool===TOOLS.RECTANGLE ? rectCorners(a,pt) : [a,pt];
        onAddOverlay?.(createOverlay({ type:tool, points:pts }));
        setDraw(null); setCursor(null);
      }
      return;
    }

    // Polygon (room): close if near start
    if (POLYGON_TOOLS.has(tool)) {
      if (curr && curr.points.length >= 3) {
        const screenDist = dist(pt, curr.points[0]) * zoom;
        if (screenDist < CLOSE_RADIUS_PX) {
          onAddOverlay?.(createOverlay({ type:tool, points:curr.points }));
          setDraw(null); setCursor(null);
          return;
        }
      }
      setDraw(prev => prev
        ? { ...prev, points:[...prev.points,pt] }
        : { type:tool, points:[pt] }
      );
      return;
    }

    // Polyline tools (walls, measure, polyline)
    if (POLYLINE_TOOLS.has(tool)) {
      setDraw(prev => prev
        ? { ...prev, points:[...prev.points,pt] }
        : { type:tool, points:[pt] }
      );
    }
  }, [calibrating, tool, pan, zoom, overlays, selectedId,
      toCanvas, snapForClick, finishDraw, setDraw, showNoSnap,
      onAddOverlay, onDeleteOverlay, onSelectOverlay, onCalibrationPoint]); // eslint-disable-line

  // ── Mouse move ────────────────────────────────────────────────────────────

  const handleMouseMove = useCallback((e) => {
    if (panRef.current) {
      setPan({ x:panRef.current.px+(e.clientX-panRef.current.mx), y:panRef.current.py+(e.clientY-panRef.current.my) });
      return;
    }
    const rawPt = toCanvas(e);
    if (!rawPt) return;
    // Preview always returns a position (never null) so the line follows the cursor.
    // The snap marker is only shown when a real snap target is found (type not null/free).
    const snapped = snapForPreview(rawPt);
    setCursor(snapped || rawPt);
    const isRealSnap = snapped?.type && snapped.type !== "free" && snapped.type !== null && !snapped.type.includes("null");
    setSnapResult(isRealSnap ? snapped : null);
  }, [toCanvas, snapForPreview, setPan]);

  const handleMouseUp = useCallback(() => { panRef.current=null; }, []);

  // ── Point drag handle ─────────────────────────────────────────────────────

  const startDrag = useCallback((ovId, ptIdx) => (e) => {
    e.stopPropagation(); e.preventDefault();
    const move = (me) => {
      const pt = toCanvas(me);
      if (!pt) return;
      const ov = overlays.find(o=>o.id===ovId);
      if (!ov) return;
      const pts = ov.points.map((p,i) => i===ptIdx ? pt : p);
      onUpdateOverlay?.(ovId, { points:pts });
    };
    const up = () => { window.removeEventListener("mousemove",move); window.removeEventListener("mouseup",up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup",   up);
  }, [toCanvas, overlays, onUpdateOverlay]);

  // ── SVG transform ─────────────────────────────────────────────────────────

  const cx=W/2, cy=H/2;
  const transform = rotation
    ? `translate(${pan.x},${pan.y}) scale(${zoom}) rotate(${rotation},${cx},${cy})`
    : `translate(${pan.x},${pan.y}) scale(${zoom})`;

  // ── Cursor ────────────────────────────────────────────────────────────────

  const svgCursor =
    calibrating         ? "crosshair"    :
    panRef.current      ? "grabbing"     :
    tool===TOOLS.PAN    ? "grab"         :
    spaceRef.current    ? "grab"         :
    tool===TOOLS.POINTER? "default"      :
    tool===TOOLS.DELETE ? "not-allowed"  :
    "crosshair";

  // ── Running measure while drawing ─────────────────────────────────────────

  const runLabel = (() => {
    if (!drawState || !cursorPt) return null;
    const pts  = [...drawState.points, cursorPt];
    const type = drawState.type;
    // Segment tools: show live length from anchor to cursor
    if (SEGMENT_TOOLS.has(type) && drawState.points.length === 1) {
      const m = pxToM(dist(drawState.points[0], cursorPt), ppm);
      return m != null ? `${fmtM(m)}  (${fmtMM(m)})` : "Click end point to place segment";
    }
    if (POLYLINE_TOOLS.has(type)) {
      const m = pxToM(polyLen(pts), ppm);
      return m!=null ? `${fmtM(m)}  (${fmtMM(m)})` : `${pts.length} pts — set scale for length`;
    }
    if ((type===TOOLS.ROOM||type===TOOLS.AREA)&&pts.length>=3) {
      const m2 = pxToM2(polyArea(pts), ppm);
      return m2!=null ? `Area: ${fmtM2(m2)}` : `${pts.length} pts — set scale for area`;
    }
    if (type===TOOLS.RECTANGLE&&drawState.points.length===1) {
      const rc = rectCorners(drawState.points[0], cursorPt);
      const m2 = pxToM2(polyArea(rc), ppm);
      return m2!=null ? `Area: ${fmtM2(m2)}` : "Rectangle";
    }
    if (type===TOOLS.CIRCLE&&drawState.points.length===1) {
      const r = dist(drawState.points[0], cursorPt);
      const m2 = pxToM2(Math.PI*r*r, ppm);
      return m2!=null ? `Area: ${fmtM2(m2)}` : "Circle";
    }
    return null;
  })();

  // ── Empty state ───────────────────────────────────────────────────────────

  if (!page?.imageDataUrl) {
    return (
      <div style={S.empty}>
        <div style={{fontSize:48,marginBottom:12}}>📄</div>
        <div style={{fontSize:16,fontWeight:700,color:"#334155"}}>Upload a PDF floor plan</div>
        <div style={{fontSize:13,color:"#64748b",marginTop:6,lineHeight:1.6,maxWidth:260,textAlign:"center"}}>
          Use the left panel to upload a PDF, then set the scale and start drawing.
        </div>
      </div>
    );
  }

  // ── Scale gate ────────────────────────────────────────────────────────────

  const needsScale = (POLYLINE_TOOLS.has(tool)||SEGMENT_TOOLS.has(tool)||POLYGON_TOOLS.has(tool)||TWO_POINT_TOOLS.has(tool)) && !ppm;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={rootRef} style={S.root} tabIndex={0} onWheel={handleWheel}>
      <svg
        ref={svgRef}
        style={{...S.svg, cursor:svgCursor}}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={e=>e.preventDefault()}
      >
        <g ref={gRef} transform={transform}>

          {/* Plan image */}
          <image href={page.imageDataUrl} x={0} y={0} width={W} height={H} style={{pointerEvents:"none"}} />

          {/* ── Completed overlays ── */}
          {overlays.map(ov => (
            <OverlayShape key={ov.id} ov={ov} selected={ov.id===selectedId}
              zoom={zoom} tool={tool}
              onMouseDown={e => {
                if (tool===TOOLS.POINTER) { e.stopPropagation(); onSelectOverlay?.(ov.id===selectedId?null:ov.id); }
                if (tool===TOOLS.DELETE)  { e.stopPropagation(); onDeleteOverlay?.(ov.id); }
              }}
              onDragStart={startDrag}
            />
          ))}

          {/* ── In-progress drawing preview ── */}
          {drawState && cursorPt && (
            <DrawPreview draw={drawState} cursor={cursorPt} zoom={zoom} ppm={ppm} />
          )}

          {/* ── Snap indicator (type-specific visuals) ── */}
          {snapResult && cursorPt && <SnapMarker snap={snapResult} zoom={zoom} />}

          {/* ── Angle-lock preview line ── */}
          {snapResult?.lockFrom && cursorPt && (
            <line
              x1={snapResult.lockFrom.x} y1={snapResult.lockFrom.y}
              x2={cursorPt.x} y2={cursorPt.y}
              stroke="#a855f7" strokeWidth={1/zoom} strokeDasharray={`${4/zoom} ${2/zoom}`}
              style={{pointerEvents:"none"}} opacity={0.6}
            />
          )}

          {/* ── Calibration overlay ── */}
          {calibrating && (calibrating.points||[]).map((pt,i)=>(
            <g key={i} style={{pointerEvents:"none"}}>
              <circle cx={pt.x} cy={pt.y} r={7/zoom} fill="rgba(99,102,241,0.2)" stroke="#6366f1" strokeWidth={2/zoom}/>
              <circle cx={pt.x} cy={pt.y} r={3/zoom} fill="#6366f1"/>
              <text x={pt.x+10/zoom} y={pt.y-5/zoom} fontSize={11/zoom} fill="#6366f1" fontWeight="700">Point {i+1}</text>
            </g>
          ))}
          {calibrating?.points?.length===2&&(
            <line x1={calibrating.points[0].x} y1={calibrating.points[0].y}
                  x2={calibrating.points[1].x} y2={calibrating.points[1].y}
                  stroke="#6366f1" strokeWidth={2/zoom} strokeDasharray={`${6/zoom} ${3/zoom}`}
                  style={{pointerEvents:"none"}}/>
          )}

        </g>
      </svg>

      {/* Calibration banner */}
      {calibrating && (
        <div style={{...S.banner, background:"rgba(99,102,241,0.92)"}}>
          {!calibrating.points?.length    &&"Click Point 1 on the plan"}
          {calibrating.points?.length===1 &&"Click Point 2 on the plan"}
          {calibrating.points?.length>=2  &&"✓ Two points set — enter the distance in the Scale panel"}
        </div>
      )}

      {/* No-snap gate message */}
      {noSnapMsg && !calibrating && (
        <div style={S.noSnapMsg}>
          <span style={{fontSize:16,marginRight:8}}>⚠</span>
          No snap point found — zoom in, move closer to a corner, or hold <kbd style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:3,padding:"0 5px",fontSize:12}}>Alt</kbd> to place a free point.
        </div>
      )}

      {/* Scale gate */}
      {needsScale && !calibrating && (
        <div style={S.gate}>
          <div style={S.gateCard}>
            <div style={{fontSize:28,marginBottom:8}}>📐</div>
            <strong style={{display:"block",fontSize:14,marginBottom:6}}>Set drawing scale first</strong>
            <p style={{margin:0,fontSize:13,color:"#475569",lineHeight:1.6}}>
              Use the <strong>Scale</strong> panel on the left (1:100 etc.) before drawing walls or rooms.<br/>
              Doors, windows and columns can be placed without scale.
            </p>
          </div>
        </div>
      )}

      {/* Running measurement label / hint */}
      {runLabel && !calibrating && (
        <div style={S.banner}>
          📏 {runLabel}
          {drawState && SEGMENT_TOOLS.has(drawState.type)
            ? <span style={{fontSize:11,marginLeft:8,opacity:.7}}>· click to place end point · Esc cancel</span>
            : <span style={{fontSize:11,marginLeft:8,opacity:.7}}>· double-click or Enter to finish · Esc cancel</span>
          }
        </div>
      )}
      {/* Prompt when segment tool is active but no point placed yet */}
      {!drawState && !calibrating && SEGMENT_TOOLS.has(tool) && (
        <div style={{...S.banner, background:"rgba(234,88,12,0.85)"}}>
          {tool===TOOLS.MEASURE ? "Measure - click start point" : "Internal Wall - click start point"}
        </div>
      )}

      {/* View controls */}
      <div style={S.controls}>
        <VBtn onClick={()=>setZoom(z=>Math.min(MAX_ZOOM,z*1.2))} title="Zoom in (+)">＋</VBtn>
        <VBtn onClick={()=>setZoom(z=>Math.max(MIN_ZOOM,z/1.2))} title="Zoom out (−)">－</VBtn>
        <div style={S.ctrlSep}/>
        <VBtn onClick={()=>setRotation(r=>((r-90)+360)%360)} title="Rotate 90° left">↺</VBtn>
        <VBtn onClick={()=>setRotation(r=>(r+90)%360)} title="Rotate 90° right (R)">↻</VBtn>
        <div style={S.ctrlSep}/>
        <VBtn onClick={fit} title="Fit (F)">⊡</VBtn>
        <VBtn onClick={()=>{setZoom(1);setPan({x:0,y:0});setRotation(0);}} title="Reset view">↩</VBtn>
      </div>

      {/* Zoom + modifier badge */}
      <div style={S.badge}>
        {Math.round(zoom*100)}%{rotation?` · ${rotation}°`:""}
        {snapEnabled ? " · snap" : " · snap off"}
        {snapResult?.type ? ` · ${snapResult.label}` : ""}
      </div>
      {/* Key hint overlay */}
      <div style={S.keyHint}>
        <span>Alt: free point</span>
        <span style={{margin:"0 8px"}}>·</span>
        <span>Shift: lock 45°</span>
      </div>
    </div>
  );
}

// ── Snap marker (type-specific SVG symbol) ────────────────────────────────────

function SnapMarker({ snap, zoom }) {
  const x = snap.x, y = snap.y, z = zoom;
  const r = 7 / z;

  if (!snap.type) return null;

  const baseType = snap.type.replace("+angle", "");

  switch (baseType) {
    case "endpoint":
      // Amber square
      return (
        <g style={{pointerEvents:"none"}}>
          <rect x={x-r} y={y-r} width={r*2} height={r*2} fill="rgba(245,158,11,0.15)" stroke="#f59e0b" strokeWidth={2/z}/>
          <circle cx={x} cy={y} r={2.5/z} fill="#f59e0b"/>
        </g>
      );
    case "midpoint":
      // Green triangle
      return (
        <g style={{pointerEvents:"none"}}>
          <polygon points={`${x},${y-r} ${x+r*0.87},${y+r*0.5} ${x-r*0.87},${y+r*0.5}`}
            fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth={2/z}/>
        </g>
      );
    case "intersection":
      // Blue X
      return (
        <g style={{pointerEvents:"none"}}>
          <line x1={x-r} y1={y-r} x2={x+r} y2={y+r} stroke="#3b82f6" strokeWidth={2/z}/>
          <line x1={x+r} y1={y-r} x2={x-r} y2={y+r} stroke="#3b82f6" strokeWidth={2/z}/>
          <circle cx={x} cy={y} r={r} fill="none" stroke="#3b82f6" strokeWidth={1/z} opacity={0.4}/>
        </g>
      );
    case "online":
      // Cyan perpendicular marker
      return (
        <g style={{pointerEvents:"none"}}>
          <circle cx={x} cy={y} r={r} fill="none" stroke="#06b6d4" strokeWidth={2/z}/>
          <circle cx={x} cy={y} r={2/z} fill="#06b6d4"/>
        </g>
      );
    case "grid":
      // Grey cross
      return (
        <g style={{pointerEvents:"none"}}>
          <line x1={x-r} y1={y} x2={x+r} y2={y} stroke="#94a3b8" strokeWidth={1.5/z}/>
          <line x1={x} y1={y-r} x2={x} y2={y+r} stroke="#94a3b8" strokeWidth={1.5/z}/>
        </g>
      );
    case "angle":
      // Purple diamond
      return (
        <g style={{pointerEvents:"none"}}>
          <polygon points={`${x},${y-r} ${x+r},${y} ${x},${y+r} ${x-r},${y}`}
            fill="rgba(168,85,247,0.15)" stroke="#a855f7" strokeWidth={2/z}/>
          {snap.angleDeg != null && (
            <text x={x+r+3/z} y={y+3/z} fontSize={10/z} fill="#a855f7" fontWeight="700" style={{pointerEvents:"none"}}>
              {snap.angleDeg}°
            </text>
          )}
        </g>
      );
    case "edge":
      // Red-orange target reticle — pixel wall edge
      return (
        <g style={{pointerEvents:"none"}}>
          <circle cx={x} cy={y} r={r*1.2} fill="none" stroke="#f97316" strokeWidth={2/z}/>
          <line x1={x-r*0.6} y1={y} x2={x+r*0.6} y2={y} stroke="#f97316" strokeWidth={1.5/z}/>
          <line x1={x} y1={y-r*0.6} x2={x} y2={y+r*0.6} stroke="#f97316" strokeWidth={1.5/z}/>
          <circle cx={x} cy={y} r={2/z} fill="#f97316"/>
          <text x={x+r*1.4} y={y-r*0.4} fontSize={9/z} fill="#f97316" fontWeight="700" style={{pointerEvents:"none"}}>Edge</text>
        </g>
      );
    default:
      return null;
  }
}

// ── Overlay shape ─────────────────────────────────────────────────────────────

// Visual properties per overlay status + confidence
function getOverlayVisual(ov) {
  if (ov.status !== "suggested") return { dash: "none", opacity: 1 };
  const c = ov.confidence || "medium";
  return {
    dash:    c==="high" ? "10 4" : c==="medium" ? "6 4" : "4 6",
    opacity: c==="high" ? 0.75   : c==="medium" ? 0.55   : 0.38,
  };
}

function OverlayShape({ ov, selected, zoom, tool, onMouseDown, onDragStart }) {
  const st  = STYLE[ov.type] || { stroke:"#888", sw:1, fill:"none" };
  const SEL = "#f59e0b";
  const hw  = 6/zoom;
  const pts = ov.points || [];
  const { dash, opacity } = getOverlayVisual(ov);

  const isEditing = selected && (tool===TOOLS.POINTER);

  if (ov.type===OT.DOOR || ov.type===OT.WINDOW || ov.type===OT.COLUMN) {
    const p=pts[0]; if(!p) return null;
    const r=10/zoom;
    const shapes = {
      [OT.DOOR]:   <circle cx={p.x} cy={p.y} r={r} fill="#16a34a" stroke="#fff" strokeWidth={1.5/zoom}/>,
      [OT.WINDOW]: <polygon points={`${p.x},${p.y-r} ${p.x+r},${p.y} ${p.x},${p.y+r} ${p.x-r},${p.y}`} fill="#7c3aed" stroke="#fff" strokeWidth={1.5/zoom}/>,
      [OT.COLUMN]: <rect x={p.x-r*0.7} y={p.y-r*0.7} width={r*1.4} height={r*1.4} fill="#92400e" stroke="#fff" strokeWidth={1.5/zoom}/>,
    };
    const labels = { [OT.DOOR]:"D", [OT.WINDOW]:"W", [OT.COLUMN]:"C" };
    return (
      <g onMouseDown={onMouseDown} style={{cursor:"pointer"}}>
        {selected&&<circle cx={p.x} cy={p.y} r={r+5/zoom} fill={SEL} opacity={0.2}/>}
        {shapes[ov.type]}
        <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={7/zoom} fontWeight="bold" fill="#fff" style={{pointerEvents:"none"}}>{labels[ov.type]}</text>
      </g>
    );
  }

  if (ov.type===OT.CIRCLE) {
    if (pts.length<2) return null;
    const [cen,radPt]=pts, r=dist(cen,radPt), c=cen;
    return (
      <g onMouseDown={onMouseDown} style={{cursor:"pointer"}}>
        {selected&&<circle cx={c.x} cy={c.y} r={r} stroke={SEL} strokeWidth={(st.sw+4)/zoom} fill="none"/>}
        <circle cx={c.x} cy={c.y} r={r} stroke={st.stroke} strokeWidth={st.sw/zoom} fill={st.fill||"none"}/>
        <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="middle" fontSize={11/zoom} fontWeight="700" fill={st.stroke} style={{pointerEvents:"none"}}>{ov.roomName||ov.label}</text>
        {isEditing&&pts.map((p,i)=>(
          <circle key={i} cx={p.x} cy={p.y} r={hw} fill="#fff" stroke={SEL} strokeWidth={2/zoom} style={{cursor:"grab"}} onMouseDown={onDragStart(ov.id,i)}/>
        ))}
      </g>
    );
  }

  // Room / rectangle / polylines
  const isPolygon = ov.type===OT.ROOM||ov.type===OT.AREA||ov.type===OT.RECTANGLE;
  if (isPolygon) {
    if (pts.length<3) return null;
    const ptStr=pts.map(p=>`${p.x},${p.y}`).join(" ");
    const c=centroid(pts);
    return (
      <g onMouseDown={onMouseDown} style={{cursor:"pointer"}} opacity={opacity}>
        {selected&&<polygon points={ptStr} stroke={SEL} strokeWidth={(st.sw+3)/zoom} fill="none"/>}
        <polygon points={ptStr} stroke={st.stroke} strokeWidth={st.sw/zoom} fill={st.fill||"none"} strokeDasharray={dash} strokeLinejoin="round"/>
        <text x={c.x} y={c.y-6/zoom} textAnchor="middle" fontSize={12/zoom} fontWeight="700" fill={st.stroke} style={{pointerEvents:"none"}}>{ov.roomName||ov.label}</text>
        {ov.status==="suggested"&&<text x={c.x} y={c.y+8/zoom} textAnchor="middle" fontSize={8/zoom} fill={st.stroke} opacity={0.7} style={{pointerEvents:"none"}}>AI suggestion</text>}
        {ov.floorFinish&&ov.status!=="suggested"&&<text x={c.x} y={c.y+8/zoom} textAnchor="middle" fontSize={9/zoom} fill={st.stroke} opacity={0.8} style={{pointerEvents:"none"}}>{ov.floorFinish}</text>}
        {isEditing&&pts.map((p,i)=>(
          <circle key={i} cx={p.x} cy={p.y} r={hw} fill="#fff" stroke={SEL} strokeWidth={2/zoom} style={{cursor:"grab"}} onMouseDown={onDragStart(ov.id,i)}/>
        ))}
      </g>
    );
  }

  // Polylines (walls, measure, polyline)
  if (pts.length<2) return null;
  const ptStr=pts.map(p=>`${p.x},${p.y}`).join(" ");
  const mid=centroid(pts);
  const isWall=ov.type===OT.EXTERNAL_WALL||ov.type===OT.INTERNAL_WALL;
  return (
    <g onMouseDown={onMouseDown} style={{cursor:"pointer"}} opacity={opacity}>
      <polyline points={ptStr} stroke="transparent" strokeWidth={16/zoom} fill="none"/>
      {selected&&<polyline points={ptStr} stroke={SEL} strokeWidth={(st.sw+5)/zoom} fill="none" strokeLinecap="round"/>}
      <polyline points={ptStr} stroke={st.stroke} strokeWidth={st.sw/zoom} fill="none" strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round"/>
      {isWall&&<text x={mid.x} y={mid.y-7/zoom} textAnchor="middle" fontSize={10/zoom} fontWeight="700" fill={st.stroke} style={{pointerEvents:"none"}}>{ov.label}</text>}
      {ov.type===OT.MEASURE&&pts.length===2&&<MeasureLabel pts={pts} zoom={zoom}/>}
      {isEditing&&pts.map((p,i)=>(
        <circle key={i} cx={p.x} cy={p.y} r={hw} fill="#fff" stroke={SEL} strokeWidth={2/zoom} style={{cursor:"grab"}} onMouseDown={onDragStart(ov.id,i)}/>
      ))}
    </g>
  );
}

function MeasureLabel({ pts, zoom }) {
  const mx=(pts[0].x+pts[1].x)/2, my=(pts[0].y+pts[1].y)/2;
  return (
    <>
      <rect x={mx-26/zoom} y={my-8/zoom} width={52/zoom} height={14/zoom} rx={3/zoom} fill="rgba(255,255,255,0.9)" stroke="#ef4444" strokeWidth={0.5/zoom}/>
      <text x={mx} y={my+3/zoom} textAnchor="middle" fontSize={9/zoom} fill="#dc2626" fontWeight="700" style={{pointerEvents:"none"}}>
        {/* label is set on overlay, shown via parent */}
      </text>
    </>
  );
}

// ── Drawing preview ───────────────────────────────────────────────────────────

function DrawPreview({ draw, cursor, zoom }) {
  const { type, points } = draw;
  const st = STYLE[type] || { stroke:"#3b82f6", sw:2, fill:"none" };
  const c  = st.stroke;
  const sw = st.sw/zoom;

  // Show dots at committed points
  const dots = points.map((p,i)=>(
    <circle key={i} cx={p.x} cy={p.y} r={4/zoom} fill={c} opacity={0.9} style={{pointerEvents:"none"}}/>
  ));

  // Cursor ghost
  const ghost = <circle cx={cursor.x} cy={cursor.y} r={3/zoom} fill={c} opacity={0.4} style={{pointerEvents:"none"}}/>;

  if (TWO_POINT_TOOLS.has(type)) {
    if (points.length===0) return <>{ghost}</>;
    const [a]=points;
    if (type===TOOLS.CIRCLE) {
      const r=dist(a,cursor);
      return (
        <g style={{pointerEvents:"none"}}>
          {dots}
          <circle cx={a.x} cy={a.y} r={r} stroke={c} strokeWidth={sw} fill={st.fill||"none"} strokeDasharray={`${5/zoom} ${3/zoom}`} opacity={0.7}/>
          {ghost}
        </g>
      );
    }
    // Rectangle
    const rc=rectCorners(a,cursor);
    const ptStr=rc.map(p=>`${p.x},${p.y}`).join(" ");
    return (
      <g style={{pointerEvents:"none"}}>
        {dots}
        <polygon points={ptStr} stroke={c} strokeWidth={sw} fill={st.fill||"none"} strokeDasharray={`${5/zoom} ${3/zoom}`} opacity={0.7}/>
        {ghost}
      </g>
    );
  }

  const all=[...points,cursor];
  const ptStr=all.map(p=>`${p.x},${p.y}`).join(" ");

  if (POLYGON_TOOLS.has(type)) {
    return (
      <g style={{pointerEvents:"none"}}>
        {all.length>=3&&<polygon points={ptStr} fill={st.fill||"rgba(100,100,255,0.06)"} stroke="none"/>}
        <polyline points={ptStr} stroke={c} strokeWidth={sw} fill="none" strokeDasharray={`${5/zoom} ${3/zoom}`} strokeLinecap="round" opacity={0.8}/>
        {dots}
        {/* Close-ring hint */}
        {points.length>=3&&<circle cx={points[0].x} cy={points[0].y} r={CLOSE_RADIUS_PX/zoom} stroke={c} strokeWidth={1/zoom} fill="none" opacity={0.35}/>}
        {ghost}
      </g>
    );
  }

  return (
    <g style={{pointerEvents:"none"}}>
      {all.length>=2&&<polyline points={ptStr} stroke={c} strokeWidth={sw} fill="none" strokeDasharray={`${5/zoom} ${3/zoom}`} strokeLinecap="round" opacity={0.75}/>}
      {dots}
      {ghost}
    </g>
  );
}

// ── View button ───────────────────────────────────────────────────────────────

function VBtn({onClick,title,children}) {
  const [h,sh]=useState(false);
  return (
    <button type="button" title={title}
      onMouseDown={e=>e.stopPropagation()}
      onClick={e=>{e.stopPropagation();onClick();}}
      onMouseEnter={()=>sh(true)} onMouseLeave={()=>sh(false)}
      style={{...S.ctrlBtn,...(h?{background:"rgba(255,255,255,0.14)"}:{})}}>
      {children}
    </button>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  root:     {position:"relative",width:"100%",height:"100%",overflow:"hidden",outline:"none",background:"#fff",userSelect:"none",pointerEvents:"auto",overscrollBehavior:"contain",touchAction:"none"},
  svg:      {display:"block",width:"100%",height:"100%",background:"#fff",pointerEvents:"auto"},
  empty:    {width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#f8fafc"},
  gate:     {position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(248,250,252,0.88)",backdropFilter:"blur(2px)",zIndex:40},
  gateCard: {background:"#fff",border:"1.5px solid #bfdbfe",borderRadius:14,padding:"24px 28px",maxWidth:320,textAlign:"center",boxShadow:"0 8px 24px rgba(0,0,0,0.08)"},
  banner:   {position:"absolute",bottom:68,left:"50%",transform:"translateX(-50%)",background:"rgba(15,23,42,0.9)",color:"#f1f5f9",padding:"7px 18px",borderRadius:99,fontSize:13,fontWeight:700,zIndex:60,pointerEvents:"none",whiteSpace:"nowrap"},
  controls: {position:"absolute",bottom:16,right:16,zIndex:50,display:"flex",flexDirection:"column",gap:3,background:"rgba(15,23,42,0.88)",borderRadius:12,padding:"8px 6px",border:"1px solid rgba(255,255,255,0.12)",boxShadow:"0 4px 16px rgba(0,0,0,0.3)"},
  ctrlBtn:  {width:40,height:40,border:"none",borderRadius:8,background:"transparent",color:"#e2e8f0",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1},
  ctrlSep:  {height:1,background:"rgba(255,255,255,0.12)",margin:"1px 0"},
  badge:     {position:"absolute",bottom:16,left:16,background:"rgba(15,23,42,0.78)",color:"#94a3b8",fontSize:12,fontWeight:700,padding:"4px 10px",borderRadius:8,pointerEvents:"none",zIndex:50},
  keyHint:   {position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",background:"rgba(15,23,42,0.55)",color:"#64748b",fontSize:11,padding:"3px 12px",borderRadius:99,pointerEvents:"none",zIndex:50,whiteSpace:"nowrap"},
  noSnapMsg: {position:"absolute",top:12,left:"50%",transform:"translateX(-50%)",background:"rgba(220,38,38,0.92)",color:"#fff",padding:"9px 20px",borderRadius:99,fontSize:13,fontWeight:600,zIndex:70,pointerEvents:"none",whiteSpace:"nowrap",boxShadow:"0 4px 16px rgba(0,0,0,0.3)"},
};

