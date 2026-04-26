// components/image-editor/ImageEditorCard.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";

// ─── Style tokens ────────────────────────────────────────────────────────────
const T = {
  card:    { background: "#0c121a", borderRadius: 12, padding: 16, color: "#e2e8f0", fontFamily: "system-ui, sans-serif", minWidth: 0 },
  topBar:  { display: "flex", gap: 6, marginBottom: 12, alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #1e293b", paddingBottom: 10 },
  row:     { display: "flex", gap: 10, alignItems: "flex-start" },
  btn:     { padding: "5px 11px", background: "#0f172a", border: "1px solid #334155", borderRadius: 4, color: "#e2e8f0", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap", lineHeight: "1.4" },
  btnPri:  { padding: "5px 11px", background: "#1d4ed8", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap", lineHeight: "1.4" },
  iconBtn: { padding: "5px 7px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 4, color: "#94a3b8", cursor: "pointer", fontSize: 11, textAlign: "center" },
  toolBtn: { display: "block", width: "100%", padding: "7px 10px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 4, color: "#e2e8f0", cursor: "pointer", fontSize: 12, textAlign: "left", marginBottom: 4 },
  sec:     { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, padding: 10, marginBottom: 8 },
  secTtl:  { fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  lbl:     { display: "block", fontSize: 10, color: "#64748b", marginBottom: 2 },
  inp:     { width: "100%", padding: "4px 6px", background: "#0c121a", border: "1px solid #1e293b", borderRadius: 3, color: "#f1f5f9", fontSize: 12, boxSizing: "border-box" },
  left:    { width: 188, flexShrink: 0 },
  cvWrap:  { flex: 1, background: "#111827", border: "1px solid #1e293b", borderRadius: 8, overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 640, position: "relative" },
  right:   { width: 208, flexShrink: 0 },
  layRow:  { display: "flex", alignItems: "center", gap: 2, padding: "5px 6px", borderRadius: 4, border: "1px solid #1e293b", background: "#0c121a", marginBottom: 3, cursor: "pointer" },
  mini:    { padding: "1px 4px", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 11, lineHeight: 1, flexShrink: 0 },
};

const CANVAS_W = 860;
const CANVAS_H = 600;

function removeBackgroundLocallyFromCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const px = imageData.data;
  const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 60));
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let samples = 0;

  const samplePixel = (x, y) => {
    const idx = ((y * width) + x) * 4;
    if ((px[idx + 3] || 0) < 8) return;
    totalR += px[idx];
    totalG += px[idx + 1];
    totalB += px[idx + 2];
    samples += 1;
  };

  for (let x = 0; x < width; x += sampleStep) {
    samplePixel(x, 0);
    samplePixel(x, height - 1);
  }
  for (let y = 0; y < height; y += sampleStep) {
    samplePixel(0, y);
    samplePixel(width - 1, y);
  }

  const bgR = samples ? totalR / samples : 255;
  const bgG = samples ? totalG / samples : 255;
  const bgB = samples ? totalB / samples : 255;
  const hardThreshold = 54;
  const softThreshold = 96;
  const visited = new Uint8Array(width * height);
  const queue = [];

  const colorDistance = (idx) => {
    const dr = px[idx] - bgR;
    const dg = px[idx + 1] - bgG;
    const db = px[idx + 2] - bgB;
    return Math.sqrt((dr * dr) + (dg * dg) + (db * db));
  };

  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixelIndex = (y * width) + x;
    if (visited[pixelIndex]) return;
    const idx = pixelIndex * 4;
    if ((px[idx + 3] || 0) < 8) {
      visited[pixelIndex] = 1;
      return;
    }
    if (colorDistance(idx) > hardThreshold) return;
    visited[pixelIndex] = 1;
    queue.push(pixelIndex);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queue.length) {
    const pixelIndex = queue.shift();
    const idx = pixelIndex * 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    px[idx + 3] = 0;
    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = (y * width) + x;
      const idx = pixelIndex * 4;
      const alpha = px[idx + 3] || 0;
      if (!alpha) continue;
      const distance = colorDistance(idx);
      if (distance > softThreshold) continue;

      const touchesTransparent =
        (x > 0 && px[idx - 1] === 0) ||
        (x + 1 < width && px[idx + 7] === 0) ||
        (y > 0 && px[idx - (width * 4) + 3] === 0) ||
        (y + 1 < height && px[idx + (width * 4) + 3] === 0);

      if (!touchesTransparent) continue;

      const fade = Math.max(0, Math.min(1, (distance - hardThreshold) / (softThreshold - hardThreshold)));
      px[idx + 3] = Math.max(0, Math.min(alpha, Math.round(alpha * fade)));
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

// ─── Section card helper ─────────────────────────────────────────────────────
function Sec({ title, children }) {
  return (
    <div style={T.sec}>
      <div style={T.secTtl}>{title}</div>
      {children}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
function ImageEditorCard({ initialSrc = null, onSave = null }) {
  const canvasEl   = useRef(null);
  const fab        = useRef(null);   // fabric.Canvas
  const lib        = useRef(null);   // fabric namespace
  const cropRect   = useRef(null);   // crop selection rect
  const fileInput  = useRef(null);
  const undoStack  = useRef([]);
  const redoStack  = useRef([]);

  const [ready,       setReady      ] = useState(false);
  const [activeObj,   setActiveObj  ] = useState(null);
  const [layers,      setLayers     ] = useState([]);
  const [cropMode,    setCropMode   ] = useState(false);
  const [bgWorking,   setBgWorking  ] = useState(false);
  // Active-object property mirrors
  const [angle,  setAngle ] = useState(0);
  const [opac,   setOpac  ] = useState(1);
  const [posX,   setPosX  ] = useState(0);
  const [posY,   setPosY  ] = useState(0);
  const [objW,   setObjW  ] = useState(0);
  const [objH,   setObjH  ] = useState(0);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !canvasEl.current || fab.current) return;

    import("fabric").then((mod) => {
      const fabric = mod.fabric;
      lib.current = fabric;

      const canvas = new fabric.Canvas(canvasEl.current, {
        width: CANVAS_W,
        height: CANVAS_H,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
        selection: true,
      });
      fab.current = canvas;

      canvas.on("selection:created", () => mirrorActive(canvas));
      canvas.on("selection:updated", () => mirrorActive(canvas));
      canvas.on("selection:cleared", () => { setActiveObj(null); });
      canvas.on("object:modified",  () => { syncLayers(canvas); snapshot(canvas); });
      canvas.on("object:added",     () => { syncLayers(canvas); snapshot(canvas); });
      canvas.on("object:removed",   () => { syncLayers(canvas); snapshot(canvas); });

      setReady(true);
      snapshot(canvas);

      // Auto-restore from localStorage if available and no initialSrc
      if (!initialSrc) {
        try {
          const saved = localStorage.getItem("gr8:image-editor:autosave");
          if (saved) {
            canvas.loadFromJSON(saved, () => {
              canvas.renderAll();
              syncLayers(canvas);
            });
          }
        } catch (e) {
          console.warn("Failed to restore autosave: ", e);
        }
      }

      // If a source image URL was passed in (e.g. opened from email builder)
      if (initialSrc) {
        lib.current.Image.fromURL(initialSrc, (img) => {
          const mW = canvas.width * 0.85;
          const mH = canvas.height * 0.85;
          if (img.width > mW || img.height > mH) {
            const s = Math.min(mW / img.width, mH / img.height);
            img.set({ scaleX: s, scaleY: s });
          }
          img.set({ left: 30, top: 30 });
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
        }, { crossOrigin: "anonymous" });
      }
    });

    return () => { if (fab.current) { fab.current.dispose(); fab.current = null; } };
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Z")) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const snapshot = useCallback((canvasArg) => {
    const c = canvasArg || fab.current;
    if (!c) return;
    const json = JSON.stringify(c.toJSON(["__uid", "__name"]));
    undoStack.current = [...undoStack.current.slice(-39), json];
    redoStack.current = [];
    // Auto-save to localStorage
    try {
      localStorage.setItem("gr8:image-editor:autosave", json);
    } catch (e) {
      console.warn("Failed to auto-save: ", e);
    }
  }, []);

  const syncLayers = useCallback((canvasArg) => {
    const c = canvasArg || fab.current;
    if (!c) return;
    const objs = c.getObjects();
    setLayers(
      objs.map((obj, i) => {
        if (!obj.__uid)  obj.__uid  = `u${Date.now()}${i}`;
        if (!obj.__name) obj.__name = typeName(obj, i);
        return { uid: obj.uid, id: obj.__uid, name: obj.__name, type: obj.type, visible: obj.visible !== false, obj };
      }).reverse()
    );
  }, []);

  const mirrorActive = useCallback((canvasArg) => {
    const c = canvasArg || fab.current;
    const obj = c?.getActiveObject();
    if (!obj) return;
    setActiveObj(obj);
    setAngle(Math.round(obj.angle || 0));
    setOpac(typeof obj.opacity === "number" ? obj.opacity : 1);
    setPosX(Math.round(obj.left || 0));
    setPosY(Math.round(obj.top  || 0));
    setObjW(Math.round((obj.width  || 0) * (obj.scaleX || 1)));
    setObjH(Math.round((obj.height || 0) * (obj.scaleY || 1)));
  }, []);

  function typeName(obj, i) {
    if (obj.type === "image")  return `Image ${i + 1}`;
    if (obj.type === "i-text" || obj.type === "text") return `Text`;
    if (obj.type === "rect")   return `Rectangle`;
    if (obj.type === "circle") return `Circle`;
    return `Layer ${i + 1}`;
  }

  // ── File load ─────────────────────────────────────────────────────────────
  const loadFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => addImageSrc(e.target.result);
    reader.readAsDataURL(file);
  };

  const addImageSrc = useCallback((src) => {
    if (!lib.current || !fab.current) return;
    lib.current.Image.fromURL(src, (img) => {
      const mW = fab.current.width  * 0.85;
      const mH = fab.current.height * 0.85;
      if (img.width > mW || img.height > mH) {
        const s = Math.min(mW / img.width, mH / img.height);
        img.set({ scaleX: s, scaleY: s });
      }
      img.set({ left: 30, top: 30 });
      fab.current.add(img);
      fab.current.setActiveObject(img);
      fab.current.renderAll();
    }, { crossOrigin: "anonymous" });
  }, []);

  // ── Undo / Redo ───────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    if (!fab.current || undoStack.current.length < 2) return;
    const cur  = undoStack.current.pop();
    redoStack.current = [...redoStack.current, cur];
    const prev = undoStack.current[undoStack.current.length - 1];
    fab.current.loadFromJSON(prev, () => { fab.current.renderAll(); syncLayers(); });
  }, [syncLayers]);

  const redo = useCallback(() => {
    if (!fab.current || redoStack.current.length === 0) return;
    const next = redoStack.current.pop();
    undoStack.current = [...undoStack.current, next];
    fab.current.loadFromJSON(next, () => { fab.current.renderAll(); syncLayers(); });
  }, [syncLayers]);

  // ── Alignment ─────────────────────────────────────────────────────────────
  const align = useCallback((type) => {
    const c = fab.current;
    const obj = c?.getActiveObject();
    if (!c || !obj) return;
    const bb = obj.getBoundingRect();
    const dx = obj.left - bb.left;
    const dy = obj.top  - bb.top;
    const cW = c.width, cH = c.height;
    switch (type) {
      case "left":   obj.set({ left: dx }); break;
      case "c-h":    obj.set({ left: (cW - bb.width)  / 2 + dx }); break;
      case "right":  obj.set({ left:  cW - bb.width       + dx }); break;
      case "top":    obj.set({ top:  dy }); break;
      case "m-v":    obj.set({ top:  (cH - bb.height) / 2 + dy }); break;
      case "bottom": obj.set({ top:   cH - bb.height      + dy }); break;
    }
    obj.setCoords();
    c.renderAll();
    mirrorActive(c);
    snapshot(c);
  }, [mirrorActive, snapshot]);

  // ── Rotate ────────────────────────────────────────────────────────────────
  const rotateBy = useCallback((deg) => {
    const obj = fab.current?.getActiveObject();
    if (!obj) return;
    const a = ((obj.angle || 0) + deg + 360) % 360;
    obj.set({ angle: a });
    fab.current.renderAll();
    setAngle(Math.round(a));
    snapshot();
  }, [snapshot]);

  const setAngleDirect = useCallback((val) => {
    const obj = fab.current?.getActiveObject();
    if (!obj) return;
    obj.set({ angle: Number(val) });
    fab.current.renderAll();
    setAngle(Number(val));
  }, []);

  // ── Flip ──────────────────────────────────────────────────────────────────
  const flip = useCallback((axis) => {
    const obj = fab.current?.getActiveObject();
    if (!obj) return;
    axis === "h" ? obj.set({ flipX: !obj.flipX }) : obj.set({ flipY: !obj.flipY });
    fab.current.renderAll();
    snapshot();
  }, [snapshot]);

  // ── Opacity ───────────────────────────────────────────────────────────────
  const setObjOpacity = useCallback((val) => {
    const v = parseFloat(val);
    const obj = fab.current?.getActiveObject();
    if (!obj) return;
    obj.set({ opacity: v });
    fab.current.renderAll();
    setOpac(v);
  }, []);

  // ── Position/size inputs ──────────────────────────────────────────────────
  const setPos = useCallback((axis, val) => {
    const obj = fab.current?.getActiveObject();
    if (!obj) return;
    if (axis === "x") { obj.set({ left: Number(val) }); setPosX(Number(val)); }
    else              { obj.set({ top:  Number(val) }); setPosY(Number(val)); }
    fab.current.renderAll();
  }, []);

  const setSize = useCallback((axis, val) => {
    const obj = fab.current?.getActiveObject();
    if (!obj) return;
    const n = Math.max(1, Number(val));
    if (axis === "w") { obj.set({ scaleX: n / (obj.width  || 1) }); setObjW(n); }
    else              { obj.set({ scaleY: n / (obj.height || 1) }); setObjH(n); }
    fab.current.renderAll();
  }, []);

  // ── Layer ops ─────────────────────────────────────────────────────────────
  const bringFwd  = useCallback((obj) => { fab.current?.bringForward(obj, false);   fab.current?.renderAll(); syncLayers(); snapshot(); }, [syncLayers, snapshot]);
  const sendBck   = useCallback((obj) => { fab.current?.sendBackwards(obj, false);  fab.current?.renderAll(); syncLayers(); snapshot(); }, [syncLayers, snapshot]);
  const bringTop  = useCallback((obj) => { fab.current?.bringToFront(obj);          fab.current?.renderAll(); syncLayers(); snapshot(); }, [syncLayers, snapshot]);
  const sendBot   = useCallback((obj) => { fab.current?.sendToBack(obj);            fab.current?.renderAll(); syncLayers(); snapshot(); }, [syncLayers, snapshot]);
  const removeObj = useCallback((obj) => { fab.current?.remove(obj);                fab.current?.renderAll(); syncLayers(); snapshot(); }, [syncLayers, snapshot]);

  const toggleVis = useCallback((obj) => {
    obj.set({ visible: !obj.visible });
    fab.current?.renderAll();
    syncLayers();
  }, [syncLayers]);

  const selectLayer = useCallback((obj) => {
    fab.current?.setActiveObject(obj);
    fab.current?.renderAll();
    mirrorActive();
  }, [mirrorActive]);

  const deleteSelected = useCallback(() => {
    const obj = fab.current?.getActiveObject();
    if (!obj) return;
    fab.current.remove(obj);
    fab.current.renderAll();
    snapshot();
  }, [snapshot]);

  const duplicate = useCallback(() => {
    const obj = fab.current?.getActiveObject();
    if (!obj) return;
    obj.clone((cloned) => {
      cloned.set({ left: obj.left + 20, top: obj.top + 20 });
      fab.current.add(cloned);
      fab.current.setActiveObject(cloned);
      fab.current.renderAll();
      snapshot();
    });
  }, [snapshot]);

  // ── Crop ──────────────────────────────────────────────────────────────────
  const enterCrop = useCallback(() => {
    const c   = fab.current;
    const obj = c?.getActiveObject();
    if (!c || !lib.current) return;
    if (!obj || obj.type !== "image") { alert("Select an image layer first."); return; }
    const bb = obj.getBoundingRect();
    const r  = new lib.current.Rect({
      left:          bb.left + bb.width  * 0.1,
      top:           bb.top  + bb.height * 0.1,
      width:         bb.width  * 0.8,
      height:        bb.height * 0.8,
      fill:          "rgba(59,130,246,0.1)",
      stroke:        "#3b82f6",
      strokeWidth:   2,
      strokeDashArray: [6, 4],
      selectable:    true,
      hasControls:   true,
      __isCropRect:  true,
    });
    c.add(r);
    c.setActiveObject(r);
    c.renderAll();
    cropRect.current = r;
    setCropMode(true);
  }, []);

  const applyCrop = useCallback(() => {
    const c = fab.current;
    const r = cropRect.current;
    if (!c || !lib.current || !r) return;
    const imgs = c.getObjects().filter(o => o.type === "image" && !o.__isCropRect);
    if (!imgs.length) { cancelCrop(); return; }
    const img   = imgs[imgs.length - 1]; // crop the topmost image
    const clip  = new lib.current.Rect({
      left:               r.left,
      top:                r.top,
      width:              r.width  * r.scaleX,
      height:             r.height * r.scaleY,
      absolutePositioned: true,
    });
    img.clipPath = clip;
    c.remove(r);
    cropRect.current = null;
    c.renderAll();
    setCropMode(false);
    snapshot(c);
  }, [snapshot]);

  const cancelCrop = useCallback(() => {
    if (cropRect.current && fab.current) fab.current.remove(cropRect.current);
    cropRect.current = null;
    fab.current?.renderAll();
    setCropMode(false);
  }, []);

  // ── Remove Background ─────────────────────────────────────────────────────
  const removeBg = useCallback(async () => {
    const c   = fab.current;
    const obj = c?.getActiveObject();
    if (!obj || obj.type !== "image") { alert("Select an image layer first."); return; }
    setBgWorking(true);
    try {
      const el = obj._element || obj._originalElement;
      if (!el) throw new Error("Cannot access image element");
      const tmp    = document.createElement("canvas");
      tmp.width    = el.naturalWidth  || el.width;
      tmp.height   = el.naturalHeight || el.height;
      tmp.getContext("2d").drawImage(el, 0, 0);
      const base64 = tmp.toDataURL("image/png");

      const res  = await fetch("/api/tools/remove-background", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ image: base64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        const localBase64 = removeBackgroundLocallyFromCanvas(tmp);
        const savedProps = { left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle };
        c.remove(obj);
        lib.current.Image.fromURL(localBase64, (img) => {
          img.set(savedProps);
          c.add(img);
          c.setActiveObject(img);
          c.renderAll();
          snapshot(c);
        }, { crossOrigin: "anonymous" });
        return;
      }

      const savedProps = { left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle };
      c.remove(obj);
      lib.current.Image.fromURL(data.url || data.base64, (img) => {
        img.set(savedProps);
        c.add(img);
        c.setActiveObject(img);
        c.renderAll();
        snapshot(c);
      }, { crossOrigin: "anonymous" });
    } catch (err) {
      alert(err?.message || "Background removal failed.");
    } finally {
      setBgWorking(false);
    }
  }, [snapshot]);

  // ── Add objects ───────────────────────────────────────────────────────────
  const addText = useCallback(() => {
    if (!lib.current || !fab.current) return;
    const t = new lib.current.IText("Edit me", {
      left: 80, top: 80, fontSize: 28, fontFamily: "Arial", fill: "#1e293b", fontWeight: "bold",
    });
    fab.current.add(t);
    fab.current.setActiveObject(t);
    fab.current.renderAll();
  }, []);

  const addShape = useCallback((type) => {
    if (!lib.current || !fab.current) return;
    let obj;
    if (type === "rect")   obj = new lib.current.Rect  ({ left: 80, top: 80, width: 160, height: 100, fill: "rgba(59,130,246,0.2)", stroke: "#3b82f6", strokeWidth: 2 });
    if (type === "circle") obj = new lib.current.Circle({ left: 80, top: 80, radius: 60,              fill: "rgba(16,185,129,0.2)", stroke: "#10b981", strokeWidth: 2 });
    if (obj) { fab.current.add(obj); fab.current.setActiveObject(obj); fab.current.renderAll(); }
  }, []);

  // ── Canvas ops ────────────────────────────────────────────────────────────
  const setBg = useCallback((color) => {
    if (!fab.current) return;
    fab.current.setBackgroundColor(color, () => fab.current.renderAll());
    snapshot();
  }, [snapshot]);

  const clearAll = useCallback(() => {
    if (!window.confirm("Clear all layers?")) return;
    fab.current?.clear();
    fab.current?.setBackgroundColor("#ffffff", () => fab.current.renderAll());
    syncLayers();
    snapshot();
  }, [syncLayers, snapshot]);

  const safeCanvasDataUrl = useCallback((fmt = "png") => {
    if (!fab.current) throw new Error("Canvas is not ready yet.");
    try {
      return fab.current.toDataURL({ format: fmt, quality: 0.95, multiplier: 2 });
    } catch (err) {
      const msg = String(err?.message || "");
      if (/tainted|cross-origin|insecure/i.test(msg)) {
        throw new Error("This image source blocks browser export (cross-origin). Upload the image from your computer with + Image, then edit and save again.");
      }
      throw new Error(msg || "Failed to export the edited image.");
    }
  }, []);

  const exportImg = useCallback((fmt) => {
    try {
      const url = safeCanvasDataUrl(fmt);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `edited-image.${fmt}`;
      a.click();
    } catch (err) {
      alert(err?.message || "Could not export image.");
    }
  }, [safeCanvasDataUrl]);

  // ─── Alignment buttons config ─────────────────────────────────────────────
  const alignBtns = [
    { label: "◧ Left",   t: "left"   },
    { label: "⊞ C-H",   t: "c-h"    },
    { label: "◨ Right",  t: "right"  },
    { label: "↑ Top",    t: "top"    },
    { label: "⊟ C-V",   t: "m-v"    },
    { label: "↓ Bottom", t: "bottom" },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={T.card}>

      {/* ── Top toolbar ─────────────────────────────────────────────────── */}
      <div style={T.topBar}>
        <strong style={{ fontSize: 14, color: "#f1f5f9", marginRight: 6 }}>🖼 Image Editor</strong>
        <button style={T.btn} onClick={() => fileInput.current?.click()}>+ Image</button>
        <input
          ref={fileInput} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { loadFile(e.target.files[0]); e.target.value = ""; }}
        />
        <button style={T.btn} onClick={addText}>T Text</button>
        <button style={T.btn} onClick={() => addShape("rect")}>▭ Rect</button>
        <button style={T.btn} onClick={() => addShape("circle")}>◯ Circle</button>
        <button style={T.btn} onClick={duplicate} disabled={!activeObj || !ready}>⧉ Dupe</button>
        <div style={{ flex: 1 }} />
        <button style={T.btn}    onClick={undo}          title="Ctrl+Z">↶ Undo</button>
        <button style={T.btn}    onClick={redo}          title="Ctrl+Y">↷ Redo</button>
        <button style={T.btn}    onClick={clearAll}>⊘ Clear</button>
        {onSave && (
          <button
            style={T.btnPri}
            onClick={() => {
              try {
                const url = safeCanvasDataUrl("png");
                onSave(url);
              } catch (err) {
                alert(err?.message || "Could not apply edited image.");
              }
            }}
          >
            ✓ Use This
          </button>
        )}
        <button style={T.btnPri} onClick={() => exportImg("png")}>↓ PNG</button>
        <button style={T.btnPri} onClick={() => exportImg("jpeg")}>↓ JPG</button>
      </div>

      {/* ── Main row ────────────────────────────────────────────────────── */}
      <div style={T.row}>

        {/* ── Left panel ──────────────────────────────────────────────── */}
        <div style={T.left}>

          {/* Position + align */}
          <Sec title="Position">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 3, marginBottom: 8 }}>
              {alignBtns.map(b => (
                <button key={b.t} title={b.label} style={{ ...T.iconBtn, fontSize: 10 }} onClick={() => align(b.t)}>
                  {b.label}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <div><label style={T.lbl}>X px</label>
                <input type="number" style={T.inp} value={posX} disabled={!activeObj}
                  onChange={e => { setPosX(e.target.value); setPos("x", e.target.value); }}
                  onBlur={() => snapshot()} />
              </div>
              <div><label style={T.lbl}>Y px</label>
                <input type="number" style={T.inp} value={posY} disabled={!activeObj}
                  onChange={e => { setPosY(e.target.value); setPos("y", e.target.value); }}
                  onBlur={() => snapshot()} />
              </div>
            </div>
          </Sec>

          {/* Size */}
          <Sec title="Size">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <div><label style={T.lbl}>W px</label>
                <input type="number" style={T.inp} value={objW} disabled={!activeObj}
                  onChange={e => { setObjW(e.target.value); setSize("w", e.target.value); }}
                  onBlur={() => snapshot()} />
              </div>
              <div><label style={T.lbl}>H px</label>
                <input type="number" style={T.inp} value={objH} disabled={!activeObj}
                  onChange={e => { setObjH(e.target.value); setSize("h", e.target.value); }}
                  onBlur={() => snapshot()} />
              </div>
            </div>
          </Sec>

          {/* Rotate & flip */}
          <Sec title="Rotate & Flip">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, marginBottom: 7 }}>
              <button style={T.iconBtn} onClick={() => rotateBy(-90)} title="CCW 90°">↺ 90°</button>
              <button style={T.iconBtn} onClick={() => rotateBy(90)}  title="CW 90°" >↻ 90°</button>
              <button style={T.iconBtn} onClick={() => rotateBy(-15)} title="CCW 15°">↺ 15°</button>
              <button style={T.iconBtn} onClick={() => rotateBy(15)}  title="CW 15°" >↻ 15°</button>
              <button style={T.iconBtn} onClick={() => flip("h")} title="Flip H">⇔ Flip H</button>
              <button style={T.iconBtn} onClick={() => flip("v")} title="Flip V">⇕ Flip V</button>
            </div>
            <label style={T.lbl}>Angle °</label>
            <input type="number" style={T.inp} value={angle} min={-360} max={360}
              disabled={!activeObj}
              onChange={e => setAngleDirect(e.target.value)}
              onBlur={() => snapshot()} />
          </Sec>

          {/* Opacity */}
          <Sec title="Opacity">
            <input type="range" min={0} max={1} step={0.01} value={opac}
              disabled={!activeObj}
              onChange={e => setObjOpacity(e.target.value)}
              onMouseUp={() => snapshot()}
              style={{ width: "100%", marginBottom: 2, accentColor: "#3b82f6" }} />
            <div style={{ textAlign: "right", fontSize: 11, color: "#94a3b8" }}>{Math.round(opac * 100)}%</div>
          </Sec>

          {/* Tools */}
          <Sec title="Tools">
            {!cropMode ? (
              <button style={T.toolBtn} onClick={enterCrop}>✂ Crop Image</button>
            ) : (
              <>
                <button style={{ ...T.toolBtn, background: "#1d4ed8", borderColor: "#1d4ed8", marginBottom: 3 }} onClick={applyCrop}>✓ Apply Crop</button>
                <button style={T.toolBtn} onClick={cancelCrop}>✕ Cancel Crop</button>
              </>
            )}
            <button style={T.toolBtn} onClick={removeBg} disabled={bgWorking}>
              {bgWorking ? "⏳ Removing…" : "✦ Remove BG"}
            </button>
            <button
              style={{ ...T.toolBtn, color: "#f87171", borderColor: "#7f1d1d" }}
              onClick={deleteSelected} disabled={!activeObj}>
              🗑 Delete Layer
            </button>
          </Sec>
        </div>

        {/* ── Canvas ──────────────────────────────────────────────────── */}
        <div style={T.cvWrap}>
          {!ready && <div style={{ position: "absolute", color: "#475569", fontSize: 13 }}>Loading canvas…</div>}
          <canvas ref={canvasEl} />
        </div>

        {/* ── Right panel: Layers ──────────────────────────────────────── */}
        <div style={T.right}>
          <Sec title={`Layers  (${layers.length})`}>
            {layers.length === 0 ? (
              <p style={{ fontSize: 12, color: "#475569", textAlign: "center", padding: "20px 0" }}>
                No layers yet.<br />Upload an image to start.
              </p>
            ) : (
              layers.map((layer) => {
                const isActive = activeObj?.__uid === layer.id;
                return (
                  <div
                    key={layer.id}
                    style={{ ...T.layRow, opacity: layer.visible ? 1 : 0.35, background: isActive ? "#1e3a5f" : "#0c121a", borderColor: isActive ? "#3b82f6" : "#1e293b" }}
                    onClick={() => selectLayer(layer.obj)}
                  >
                    <span style={{ fontSize: 10, flexShrink: 0, marginRight: 2 }}>
                      {layer.type === "image" ? "🖼" : layer.type === "i-text" ? "T" : layer.type === "rect" ? "▭" : "●"}
                    </span>
                    <span style={{ flex: 1, fontSize: 11, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {layer.name}
                    </span>
                    <button style={T.mini} title="Toggle visibility" onClick={e => { e.stopPropagation(); toggleVis(layer.obj);  }}>
                      {layer.visible ? "👁" : "○"}
                    </button>
                    <button style={T.mini} title="Bring to front"    onClick={e => { e.stopPropagation(); bringTop(layer.obj);  }}>⤒</button>
                    <button style={T.mini} title="Bring forward"     onClick={e => { e.stopPropagation(); bringFwd(layer.obj);  }}>↑</button>
                    <button style={T.mini} title="Send backward"     onClick={e => { e.stopPropagation(); sendBck(layer.obj);  }}>↓</button>
                    <button style={T.mini} title="Send to back"      onClick={e => { e.stopPropagation(); sendBot(layer.obj);  }}>⤓</button>
                    <button style={{ ...T.mini, color: "#f87171" }} title="Delete" onClick={e => { e.stopPropagation(); removeObj(layer.obj); }}>✕</button>
                  </div>
                );
              })
            )}
          </Sec>

          {/* Canvas background */}
          <Sec title="Canvas BG">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button style={T.iconBtn} onClick={() => setBg("#ffffff")}>◻ White</button>
              <button style={T.iconBtn} onClick={() => setBg("transparent")}>□ Transparent</button>
              <button style={T.iconBtn} onClick={() => setBg("#000000")}>⬛ Black</button>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <label style={{ ...T.lbl, margin: 0, flexShrink: 0 }}>Custom:</label>
                <input type="color" defaultValue="#ffffff"
                  onChange={e => setBg(e.target.value)}
                  style={{ padding: 0, border: "1px solid #334155", borderRadius: 3, width: 36, height: 24, background: "none", cursor: "pointer" }} />
              </div>
            </div>
          </Sec>
        </div>
      </div>

      {/* ── Status bar ────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 8, fontSize: 11, color: "#475569", display: "flex", gap: 16 }}>
        <span>Canvas: {CANVAS_W} × {CANVAS_H}px</span>
        {activeObj && <span>Selected: {activeObj.__name || activeObj.type} · X:{posX} Y:{posY} · W:{objW} H:{objH} · {angle}° · {Math.round(opac * 100)}% opacity</span>}
        <span style={{ marginLeft: "auto" }}>Ctrl+Z undo · Del delete · Ctrl+Y redo</span>
      </div>
    </div>
  );
}

export default dynamic(() => Promise.resolve(ImageEditorCard), { ssr: false });
