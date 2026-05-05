// pages/modules/funnels/edit/[id].js
//
// GrapesJS (MIT, white-label) builder with:
// - Drag & drop blocks
// - Template gallery (no external template API)
// - Supabase Assets picker wired into GrapesJS Asset Manager
// - Save step => inline HTML+CSS to funnel_steps.content
//
// No external env required.

import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import AuthGate from "../../../../components/AuthGate";
import AIWriterAssist from "../../../../components/ui/AIWriterAssist";
import { supabase } from "../../../../lib/supabaseClient";
import { SECTION_BLOCKS, assemblePage } from "../../../../lib/funnelSections";

const STANDARD_TEXT_COLORS = [
  "#111827", "#1f2937", "#374151", "#6b7280", "#9ca3af", "#f3f4f6",
  "#ffffff", "#000000", "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#22c55e", "#10b981", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#ec4899", "#f43f5e",
];
const TEXT_COLOR_STORAGE_KEY = "funnels.textEditor.savedColors";

async function loadScript(src) {
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

function ensureStyle(id, href) {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

async function resolveGrapesjs() {
  if (typeof window === "undefined") return null;
  if (window.grapesjs) return window.grapesjs;

  // Always inject editor CSS so layout/panels render correctly even when JS loads from local bundle.
  ensureStyle("funnels-gjs-css", "https://unpkg.com/grapesjs@0.21.7/dist/css/grapes.min.css");
  // Add a second CDN stylesheet as a hard fallback in case unpkg is blocked.
  ensureStyle("funnels-gjs-css-fallback", "https://cdn.jsdelivr.net/npm/grapesjs@0.21.7/dist/css/grapes.min.css");

  try {
    const mod = await import("grapesjs");
    const gjs = mod?.default || mod;
    if (gjs) {
      window.grapesjs = gjs;
      return gjs;
    }
  } catch {
    // Fall back to CDN when local bundle load is unavailable.
  }

  try {
    await loadScript("https://unpkg.com/grapesjs@0.21.7/dist/grapes.min.js");
  } catch {
    ensureStyle("funnels-gjs-css-jsdelivr", "https://cdn.jsdelivr.net/npm/grapesjs@0.21.7/dist/css/grapes.min.css");
    await loadScript("https://cdn.jsdelivr.net/npm/grapesjs@0.21.7/dist/grapes.min.js");
  }

  if (!window.grapesjs) throw new Error("Could not load page editor engine.");
  return window.grapesjs;
}

function createShapeComponent(style = {}) {
  return {
    type: "default",
    tagName: "div",
    attributes: { "data-shape-block": "true" },
    style: {
      display: "block",
      width: "140px",
      height: "140px",
      "max-width": "100%",
      "box-sizing": "border-box",
      "background-color": "#60a5fa",
      opacity: "0.55",
      "border-radius": "18px",
      position: "absolute",
      left: "24px",
      top: "24px",
      "z-index": "0",
      margin: "0",
      cursor: "move",
      "box-shadow": "0 10px 30px rgba(15,23,42,.18)",
      ...style,
    },
    draggable: true,
    droppable: false,
    selectable: true,
    hoverable: true,
    layerable: true,
    copyable: true,
    removable: true,
    stylable: true,
    resizable: true,
  };
}

const STACK_LAYER_PLACEHOLDER_SRC = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='520' height='360' viewBox='0 0 520 360'%3E%3Crect width='520' height='360' rx='24' fill='%23e2e8f0'/%3E%3Cpath d='M96 250l84-86 64 62 76-92 104 116H96z' fill='%2394a3b8'/%3E%3Ccircle cx='194' cy='126' r='26' fill='%23cbd5e1'/%3E%3Ctext x='260' y='322' text-anchor='middle' font-family='Arial,sans-serif' font-size='28' fill='%23475569'%3EUpload image%3C/text%3E%3C/svg%3E";

function createFunnelStackImageLayer(seed = 0) {
  return {
    type: "image",
    tagName: "img",
    attributes: {
      src: STACK_LAYER_PLACEHOLDER_SRC,
      alt: `Stack image ${seed + 1}`,
      "data-stack-layer": "true",
      "data-stack-layer-kind": "image",
    },
    style: {
      position: "absolute",
      left: `${40 + (seed * 24)}px`,
      top: `${40 + (seed * 24)}px`,
      width: "260px",
      height: "180px",
      display: "block",
      margin: "0",
      "max-width": "none",
      "object-fit": "cover",
      "border-radius": "18px",
      transform: `rotate(${seed % 2 === 0 ? -4 : 4}deg)`,
      "z-index": `${seed + 1}`,
      cursor: "move",
      "box-shadow": "0 16px 40px rgba(15,23,42,0.18)",
      background: "rgba(226,232,240,0.45)",
    },
  };
}

function createFunnelStackTextLayer(seed = 0) {
  return {
    type: "text",
    tagName: "div",
    content: "Type text here",
    attributes: {
      "data-stack-layer": "true",
      "data-stack-layer-kind": "text",
    },
    style: {
      position: "absolute",
      left: `${420 + (seed * 18)}px`,
      top: `${96 + (seed * 18)}px`,
      width: "360px",
      height: "140px",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      padding: "18px",
      margin: "0",
      color: "#0f172a",
      "font-size": "40px",
      "font-weight": "700",
      "line-height": "1.1",
      "text-align": "center",
      "border-radius": "16px",
      background: "transparent",
      "z-index": `${seed + 1}`,
      cursor: "move",
      "box-sizing": "border-box",
    },
  };
}

function detectShapePreset(component) {
  const style = component?.getStyle?.() || {};
  const clipPath = `${style["clip-path"] || ""}`.replace(/\s+/g, "").toLowerCase();
  const borderRadius = `${style["border-radius"] || ""}`.replace(/\s+/g, "").toLowerCase();
  const border = `${style.border || ""}`.toLowerCase();
  const height = parseFloat(`${style.height || "0"}`);

  if (border.includes("solid") && borderRadius.includes("999")) return "ring";
  if (clipPath.includes("50%0%,100%50%,50%100%,050%")) return "diamond";
  if (clipPath.includes("50%0%,0100%,100%100%")) return "triangle";
  if (clipPath.includes("98%35%") && clipPath.includes("5091%")) return "star";
  if (clipPath.includes("25%6.7%") && clipPath.includes("100%50%")) return "hexagon";
  if (clipPath.includes("65%35%") && clipPath.includes("100%50%")) return "arrow";
  if (clipPath.includes("100%78%") && clipPath.includes("44%100%")) return "bubble";
  if (borderRadius.includes("58%42%63%37%")) return "blob";
  if (borderRadius.includes("999") && Number.isFinite(height) && height <= 20) return "line";
  if (borderRadius.includes("999")) return "circle";
  return "rounded-box";
}

function getShapePresetStyle(shapePreset, fillColor) {
  const color = fillColor || "#60a5fa";
  switch (`${shapePreset || "rounded-box"}`) {
    case "circle":
      return { "clip-path": "none", "border-radius": "999px", border: "none", background: color, "background-color": color };
    case "diamond":
      return { "clip-path": "polygon(50% 0%, 100% 50%, 50% 100%, 0 50%)", "border-radius": "0", border: "none", background: color, "background-color": color };
    case "triangle":
      return { "clip-path": "polygon(50% 0%, 0 100%, 100% 100%)", "border-radius": "0", border: "none", background: color, "background-color": color };
    case "star":
      return { "clip-path": "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)", "border-radius": "0", border: "none", background: color, "background-color": color };
    case "hexagon":
      return { "clip-path": "polygon(25% 6.7%, 75% 6.7%, 100% 50%, 75% 93.3%, 25% 93.3%, 0% 50%)", "border-radius": "0", border: "none", background: color, "background-color": color };
    case "arrow":
      return { "clip-path": "polygon(0 35%, 65% 35%, 65% 10%, 100% 50%, 65% 90%, 65% 65%, 0 65%)", "border-radius": "0", border: "none", background: color, "background-color": color };
    case "ring":
      return { "clip-path": "none", "border-radius": "999px", border: `14px solid ${color}`, background: "transparent", "background-color": "transparent" };
    case "line":
      return { "clip-path": "none", "border-radius": "999px", border: "none", background: color, "background-color": color };
    case "bubble":
      return { "clip-path": "polygon(0 0, 100% 0, 100% 78%, 60% 78%, 44% 100%, 40% 78%, 0 78%)", "border-radius": "36px", border: "none", background: color, "background-color": color };
    case "blob":
      return { "clip-path": "none", "border-radius": "58% 42% 63% 37% / 41% 53% 47% 59%", border: "none", background: color, "background-color": color };
    default:
      return { "clip-path": "none", "border-radius": "18px", border: "none", background: color, "background-color": color };
  }
}

function isShapeLikeComponent(component) {
  if (!component) return false;
  const tag = `${component?.get?.("tagName") || ""}`.toLowerCase();
  if (!["div", "span"].includes(tag)) return false;

  const attrs = component?.getAttributes?.() || {};
  if (`${attrs["data-shape-block"] || ""}`.toLowerCase() === "true") return true;

  const style = component?.getStyle?.() || {};
  const position = `${style.position || ""}`.trim().toLowerCase();
  const width = parseFloat(`${style.width || style["min-width"] || "0"}`);
  const height = parseFloat(`${style.height || style["min-height"] || "0"}`);
  const background = `${style["background-color"] || style.background || ""}`.trim();
  const borderRadius = `${style["border-radius"] || ""}`.trim();
  const clipPath = `${style["clip-path"] || ""}`.trim();
  const border = `${style.border || ""}`.trim().toLowerCase();
  const childCount = typeof component?.components === "function"
    ? (component.components()?.length || 0)
    : 0;

  const normalizedBackground = background.toLowerCase().replace(/\s+/g, "");
  const hasVisibleFill = !!background
    && normalizedBackground !== "transparent"
    && normalizedBackground !== "rgba(0,0,0,0)";
  const hasShapeGeometry = !!clipPath || (!!borderRadius && borderRadius !== "0" && borderRadius !== "0px") || border.includes("solid");

  return position === "absolute"
    && childCount === 0
    && Number.isFinite(width) && width > 0
    && Number.isFinite(height) && height > 0
    && (hasVisibleFill || hasShapeGeometry);
}

function ensureShapeEditingCapabilities(component) {
  if (!component) return;
  const resizeOptions = {
    tl: 1, tc: 1, tr: 1,
    cl: 1, cr: 1,
    bl: 1, bc: 1, br: 1,
    keyWidth: "width",
    keyHeight: "height",
  };

  const parent = component.parent?.();
  const siblings = typeof parent?.components === "function" ? parent.components() : [];
  if (siblings?.forEach) {
    const shapeZ = parseInt(`${component.getStyle?.()?.["z-index"] || "0"}`, 10);
    const safeShapeZ = Number.isFinite(shapeZ) ? Math.max(0, shapeZ) : 0;

    siblings.forEach((child) => {
      if (child === component || isShapeLikeComponent(child)) return;
      const childStyle = child.getStyle?.() || {};
      const existingZ = parseInt(`${childStyle["z-index"] || "1"}`, 10);
      child.addStyle?.({
        position: childStyle.position && childStyle.position !== "static" ? childStyle.position : "relative",
        "z-index": `${Math.max(Number.isFinite(existingZ) ? existingZ : 1, safeShapeZ + 1)}`,
      });
    });

    component.addStyle?.({
      "z-index": `${safeShapeZ}`,
    });
  }

  try {
    component.set({
      draggable: true,
      droppable: false,
      selectable: true,
      hoverable: true,
      layerable: true,
      copyable: true,
      removable: true,
      stylable: true,
      resizable: resizeOptions,
    });
  } catch {
    // ignore Grapes model capability errors
  }

  component.addAttributes?.({ "data-shape-block": "true" });
  component.parent?.()?.addStyle?.({ position: "relative" });
  component.addStyle?.({
    position: "absolute",
    display: "block",
    cursor: "move",
    "max-width": "none",
    "box-sizing": "border-box",
  });
}

export default function Page() {
  return (
    <AuthGate>
      <Editor />
    </AuthGate>
  );
}

function Editor() {
  const router = useRouter();
  const { id } = router.query;

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [funnel, setFunnel] = useState(null);
  const [steps, setSteps] = useState([]);
  const [activeStepId, setActiveStepId] = useState(null);

  const [lists, setLists] = useState([]);
  const [defaultListId, setDefaultListId] = useState(null);
  const [notifyEmail, setNotifyEmail] = useState("");

  const [savingBasics, setSavingBasics] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [editorInitKey, setEditorInitKey] = useState(0);
  const [editorReady, setEditorReady] = useState(false);
  const [textPanelOpen, setTextPanelOpen] = useState(false);
  const [formPanelOpen, setFormPanelOpen] = useState(false);
  const [blockPanelOpen, setBlockPanelOpen] = useState(false);
  const [blockKind, setBlockKind] = useState("block");
  const [imageUploadMode, setImageUploadMode] = useState("insert");
  const [aiImagePrompt, setAiImagePrompt] = useState("");
  const [aiImageSize, setAiImageSize] = useState("1024x1024");
  const [aiImageStyle, setAiImageStyle] = useState("clean");
  const [aiImageLoading, setAiImageLoading] = useState(false);
  const [aiImageStatus, setAiImageStatus] = useState("");
  const [textControls, setTextControls] = useState({
    tagName: "",
    content: "",
    href: "",
    fontSize: "18",
    fontWeight: "600",
    fontStyle: "normal",
    textDecoration: "none",
    color: "#111827",
    lineHeight: "1.6",
    letterSpacing: "0",
    textAlign: "left",
    textTransform: "none",
    width: "",
    maxWidth: "",
    outlineEnabled: false,
    outlineColor: "#000000",
    outlineWidth: "1",
    hollowText: false,
  });
  const [imageLink, setImageLink] = useState("");
  const [blockControls, setBlockControls] = useState({
    backgroundColor: "#ffffff",
    backgroundTransparent: false,
    backgroundImage: "",
    backgroundSize: "cover",
    backgroundPosition: "center center",
    backgroundRepeat: "no-repeat",
    minHeight: "0",
    paddingTop: "0",
    paddingBottom: "0",
    backgroundImageOpacity: "100",
    backgroundImageFadeIn: false,
    width: "120",
    height: "120",
    opacity: "100",
    borderRadius: "0",
    shapePreset: "rounded-box",
    positionMode: "relative",
    offsetX: "0",
    offsetY: "0",
    zIndex: "0",
  });
  const [groupSelectionCount, setGroupSelectionCount] = useState(0);
  const [savedTextColors, setSavedTextColors] = useState([]);
  const [formControls, setFormControls] = useState({
    tagName: "",
    content: "",
    placeholder: "",
    value: "",
    name: "",
    type: "text",
    fontSize: "16",
    fontWeight: "600",
    color: "#ffffff",
    backgroundColor: "#1f3f7f",
    borderColor: "#5a88d1",
    borderRadius: "8",
    paddingY: "10",
    paddingX: "14",
  });

  const editorRef = useRef(null);
  const editorDivRef = useRef(null);
  const imageInputRef = useRef(null);
  const editorInitializingRef = useRef(false);
  const stepsRef = useRef([]);
  const activeStepIdRef = useRef(null);
  const selectedTextCompRef = useRef(null);
  const selectedFormCompRef = useRef(null);
  const selectedCompRef = useRef(null);
  // These persist through component:deselected so right-panel buttons still work
  const lastTextCompRef = useRef(null);
  const lastFormCompRef = useRef(null);
  const lastBlockCompRef = useRef(null);
  const lastImageCompRef = useRef(null);
  const lastSelectedTagRef = useRef("");
  const groupSelectionRef = useRef([]);
  const imageNormalizeInFlightRef = useRef(false);
  const imageSelectionRedirectRef = useRef(false);

  useEffect(() => {
    stepsRef.current = steps;
    activeStepIdRef.current = activeStepId;
  }, [steps, activeStepId]);

  useEffect(() => {
    groupSelectionRef.current = [];
    setGroupSelectionCount(0);
  }, [activeStepId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(TEXT_COLOR_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const clean = parsed
        .map((c) => normalizeHexColor(c))
        .filter(Boolean)
        .slice(0, 30);
      setSavedTextColors(clean);
    } catch {
      // ignore bad local storage values
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(TEXT_COLOR_STORAGE_KEY, JSON.stringify(savedTextColors));
    } catch {
      // ignore storage write errors
    }
  }, [savedTextColors]);

  function applyActiveStepToEditor(preferredStepId) {
    const e = editorRef.current;
    if (!e) return;
    const liveSteps = stepsRef.current || [];

    if (!liveSteps.length) {
      if (!loading) {
        e.setStyle("");
        e.setComponents(blankHTML());
        setShowPicker(true);
      }
      return;
    }

    const targetId = preferredStepId || activeStepIdRef.current;
    const step = liveSteps.find((s) => s.id === targetId) || liveSteps[0];
    if (!targetId && liveSteps[0]?.id) {
      setActiveStepId(liveSteps[0].id);
    }
    try {
      loadEditorContent(e, step?.content || blankHTML());
    } catch {
      // Fall back to a minimal safe page if saved content is malformed.
      e.setStyle("");
      e.setComponents(blankHTML());
    }
    if (typeof e.refresh === "function") {
      requestAnimationFrame(() => e.refresh());
    }
  }

  function loadEditorContent(editor, rawContent) {
    const src = `${rawContent || ""}`;

    // Saved steps are stored as: <style>...</style> + HTML.
    // GrapesJS needs CSS via setStyle() to preserve visual formatting.
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let css = "";
    let m;
    while ((m = styleRegex.exec(src)) !== null) {
      css += `${m[1] || ""}\n`;
    }
    const html = src.replace(styleRegex, "").trim();

    try {
      // Reset previous sheet so step-specific styles do not bleed across steps.
      editor.setStyle("");

      // GrapesJS can reset css rules on component load, so set components first.
      // For templates without explicit <style> blocks, Grapes parses inline styles;
      // calling setStyle("") afterwards would wipe those parsed styles.
      editor.setComponents(html || blankHTML());
      normalizeImageBlocksInTree(editor.getWrapper?.());
      if (css.trim()) {
        editor.setStyle(css);
      }
    } catch {
      // If parsing split HTML/CSS fails, try rendering source directly as a last resort.
      editor.setStyle("");
      editor.setComponents(src || blankHTML());
      normalizeImageBlocksInTree(editor.getWrapper?.());
    }
  }

  function stylePxToNumber(v, fallback) {
    if (!v) return fallback;
    const n = parseFloat(`${v}`.replace("px", ""));
    return Number.isFinite(n) ? `${n}` : fallback;
  }

  function clampFontWeight(value, fallback = "600") {
    const parsed = parseInt(`${value || fallback}`, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return `${Math.min(800, Math.max(400, parsed))}`;
  }

  function isTransparentStyleValue(value) {
    const raw = `${value || ""}`.trim().toLowerCase();
    return !raw || raw === "transparent" || raw === "rgba(0, 0, 0, 0)" || raw === "rgba(0,0,0,0)";
  }

  function extractOpacityPercentFromStyle(opacityValue) {
    const parsed = Number(`${opacityValue || ""}`.trim());
    if (!Number.isFinite(parsed)) return "100";
    const pct = parsed <= 1 ? parsed * 100 : parsed;
    return `${Math.round(Math.max(0, Math.min(100, pct)))}`;
  }

  function resolveBlockStyleTarget(component, textTags, formTags) {
    if (!component) return null;

    const tag = `${component?.get?.("tagName") || ""}`.toLowerCase();
    const type = `${component?.get?.("type") || ""}`.toLowerCase();
    const attrs = component?.getAttributes?.() || {};
    const isText = type === "text" || textTags.has(tag);
    const isFormField = formTags.has(tag);
    const isImage = tag === "img";
    const isMarkedShape = `${attrs["data-shape-block"] || ""}`.toLowerCase() === "true";
    const isMarkedGroup = `${attrs["data-group-block"] || ""}`.toLowerCase() === "true";
    const isStackRoot = `${attrs["data-stack-box"] || ""}`.toLowerCase() === "true";

    if (isText || isFormField || isImage || isMarkedShape || isMarkedGroup || isStackRoot) {
      return component;
    }

    const nestedImage = findNestedImageComponent(component);
    if (nestedImage) {
      return nestedImage;
    }

    let semanticCursor = component;
    while (semanticCursor) {
      const semanticTag = `${semanticCursor?.get?.("tagName") || ""}`.toLowerCase();
      if (["section", "header", "footer", "article", "main"].includes(semanticTag)) {
        return semanticCursor;
      }

      const semanticParent = semanticCursor.parent?.();
      if (!semanticParent) break;

      const parentTag = `${semanticParent?.get?.("tagName") || ""}`.toLowerCase();
      if (["section", "header", "footer", "article", "main"].includes(parentTag)) {
        return semanticParent;
      }

      semanticCursor = semanticParent;
    }

    let cursor = component;
    while (cursor) {
      const cursorAttrs = cursor.getAttributes?.() || {};
      if (`${cursorAttrs["data-blank-canvas-stage"] || ""}`.toLowerCase() === "true") {
        return cursor.parent?.() || cursor;
      }

      const parent = cursor.parent?.();
      const parentAttrs = parent?.getAttributes?.() || {};
      if (`${parentAttrs["data-blank-canvas-stage"] || ""}`.toLowerCase() === "true") {
        return parent.parent?.() || parent;
      }

      cursor = parent || null;
    }

    return component;
  }

  function extractTextControlsFromComponent(comp) {
    const style = comp?.getStyle?.() || {};
    const el = comp?.view?.el || null;
    const computed = el && typeof window !== "undefined" ? window.getComputedStyle(el) : null;
    const rawContent = comp?.get?.("content");
    let content = typeof rawContent === "string" ? rawContent : "";
    if (!content) {
      try {
        content = el?.innerText || "";
      } catch {
        content = "";
      }
    }

    const resolvedStyle = (key, fallback) => style[key] || computed?.getPropertyValue(key) || fallback;
    
    // Extract text-stroke for outline
    const strokeValue = resolvedStyle("-webkit-text-stroke", "0px transparent");
    const strokeMatch = strokeValue.match(/(\d+(?:\.\d+)?)\w*\s+(.+)/);
    const outlineWidth = strokeMatch ? `${strokeMatch[1]}` : "1";
    const outlineColor = strokeMatch ? normalizeColorForPicker(strokeMatch[2]) : "#000000";
    const outlineEnabled = strokeMatch && outlineWidth !== "0";

    const resolvedWidth = `${resolvedStyle("width", "auto")}`.trim();
    const resolvedMaxWidth = `${resolvedStyle("max-width", "none")}`.trim();

    return {
      content,
      fontSize: stylePxToNumber(resolvedStyle("font-size", "18px"), "18"),
      fontWeight: clampFontWeight(resolvedStyle("font-weight", "600")),
      fontStyle: `${resolvedStyle("font-style", "normal")}`,
      textDecoration: `${resolvedStyle("text-decoration-line", resolvedStyle("text-decoration", "none"))}`.includes("underline") ? "underline" : "none",
      color: normalizeColorForPicker(`${resolvedStyle("color", "#111827")}`),
      lineHeight: `${resolvedStyle("line-height", "1.6")}`,
      letterSpacing: stylePxToNumber(resolvedStyle("letter-spacing", "0px"), "0"),
      textAlign: `${resolvedStyle("text-align", "left")}`,
      textTransform: `${resolvedStyle("text-transform", "none")}`,
      width: resolvedWidth === "auto" ? "" : stylePxToNumber(resolvedWidth, ""),
      maxWidth: resolvedMaxWidth === "none" ? "" : stylePxToNumber(resolvedMaxWidth, ""),
      outlineEnabled,
      outlineColor,
      outlineWidth,
      hollowText: resolvedStyle("color", "#111827") === "transparent" || resolvedStyle("color", "#111827") === "rgba(0, 0, 0, 0)",
      tagName: `${comp?.get?.("tagName") || ""}`.toLowerCase(),
      href: `${comp?.getAttributes?.()?.href || ""}`,
    };
  }

  function rememberTextColor(color) {
    const normalized = normalizeHexColor(color);
    if (!normalized) return;
    setSavedTextColors((prev) => {
      const deduped = prev.filter((c) => c !== normalized);
      return [normalized, ...deduped].slice(0, 30);
    });
  }

  function setTextColor(color) {
    const normalized = normalizeColorForPicker(color);
    applyTextControlsPatch({ color: normalized });
    rememberTextColor(normalized);
  }

  function extractBackgroundImageUrl(rawValue) {
    const raw = `${rawValue || ""}`.trim();
    const match = raw.match(/url\((['"]?)(.*?)\1\)/i);
    return match?.[2] || "";
  }

  function extractBlockControlsFromComponent(comp) {
    const style = comp?.getStyle?.() || {};
    const el = comp?.view?.el || null;
    const computed = el && typeof window !== "undefined" ? window.getComputedStyle(el) : null;
    const resolvedStyle = (key, fallback) => style[key] || computed?.getPropertyValue(key) || fallback;
    const backgroundColor = `${resolvedStyle("background-color", style.background || "transparent")}`;

    // Extract opacity from filter safely.
    const filterValue = resolvedStyle("filter", "none");
    const backgroundImageOpacity = extractOpacityPercentFromFilter(filterValue);

    // Extract fade-in animation
    const animationName = resolvedStyle("animation-name", "none");
    const backgroundImageFadeIn = animationName && animationName !== "none" && animationName.includes("fade");
    const parsedZIndex = parseInt(`${resolvedStyle("z-index", "0") || "0"}`.trim(), 10);
    const safeZIndex = Number.isFinite(parsedZIndex) ? Math.max(0, parsedZIndex) : 0;

    return {
      backgroundColor: normalizeColorForPicker(backgroundColor || "#ffffff"),
      backgroundTransparent: isTransparentStyleValue(backgroundColor),
      backgroundImage: extractBackgroundImageUrl(resolvedStyle("background-image", "none")),
      backgroundSize: `${resolvedStyle("background-size", "cover")}`,
      backgroundPosition: `${resolvedStyle("background-position", "center center")}`,
      backgroundRepeat: `${resolvedStyle("background-repeat", "no-repeat")}`,
      minHeight: stylePxToNumber(resolvedStyle("min-height", "0px"), "0"),
      paddingTop: stylePxToNumber(resolvedStyle("padding-top", "0px"), "0"),
      paddingBottom: stylePxToNumber(resolvedStyle("padding-bottom", "0px"), "0"),
      backgroundImageOpacity,
      backgroundImageFadeIn,
      width: stylePxToNumber(resolvedStyle("width", "120px"), "120"),
      height: stylePxToNumber(resolvedStyle("height", "120px"), "120"),
      opacity: extractOpacityPercentFromStyle(resolvedStyle("opacity", "1")),
      borderRadius: stylePxToNumber(resolvedStyle("border-radius", "0px"), "0"),
      shapePreset: detectShapePreset(comp),
      positionMode: `${resolvedStyle("position", "relative") || "relative"}`,
      offsetX: stylePxToNumber(resolvedStyle("left", "0px"), "0"),
      offsetY: stylePxToNumber(resolvedStyle("top", "0px"), "0"),
      zIndex: `${safeZIndex}`,
    };
  }

  function ensureForegroundLayer(component) {
    if (!component || isShapeLikeComponent(component)) return;
    const style = component.getStyle?.() || {};
    const parsedZ = parseInt(`${style["z-index"] || "1"}`, 10);
    component.addStyle?.({
      position: style.position && style.position !== "static" ? style.position : "relative",
      "z-index": `${Number.isFinite(parsedZ) ? Math.max(1, parsedZ) : 1}`,
    });
  }

  function isBlankCanvasRoot(component) {
    if (!component) return false;
    const attrs = component.getAttributes?.() || {};
    return `${attrs["data-blank-canvas-root"] || ""}`.toLowerCase() === "true";
  }

  function getBlankCanvasRoot(component) {
    let cursor = component;
    while (cursor) {
      if (isBlankCanvasRoot(cursor)) return cursor;
      cursor = cursor.parent?.() || null;
    }
    return null;
  }

  function isStackBoxRoot(component) {
    if (!component) return false;
    const attrs = component.getAttributes?.() || {};
    return `${attrs["data-stack-box"] || ""}`.toLowerCase() === "true";
  }

  function getStackBoxRoot(component) {
    let cursor = component;
    while (cursor) {
      if (isStackBoxRoot(cursor)) return cursor;
      cursor = cursor.parent?.() || null;
    }
    return null;
  }

  function isStackLayerComponent(component) {
    if (!component) return false;
    const attrs = component.getAttributes?.() || {};
    return `${attrs["data-stack-layer"] || ""}`.toLowerCase() === "true";
  }

  function getStackLayerComponents(root) {
    if (!root || typeof root.components !== "function") return [];
    const layers = [];
    root.components().forEach?.((child) => {
      if (isStackLayerComponent(child)) layers.push(child);
    });
    return layers;
  }

  function normalizeStackLayerOrder(root) {
    const layers = getStackLayerComponents(root);
    layers.forEach((layer, index) => {
      layer.addStyle?.({ "z-index": `${index + 1}` });
    });
  }

  function ensureStackBoxEditingCapabilities(root) {
    if (!root) return;
    try {
      root.set?.({
        draggable: true,
        droppable: true,
        selectable: true,
        hoverable: true,
        layerable: true,
        copyable: true,
        removable: true,
        stylable: true,
        resizable: {
          tl: 0, tc: 0, tr: 0,
          cl: 0, cr: 0,
          bl: 0, bc: 1, br: 0,
          keyHeight: "min-height",
        },
      });
    } catch {
      // ignore Grapes model capability errors
    }

    root.addStyle?.({
      position: "relative",
      overflow: "visible",
    });

    getStackLayerComponents(root).forEach((layer) => {
      if (isStackLayerComponent(layer)) {
        ensureAbsolutePlacement(layer);
      }
    });
    normalizeStackLayerOrder(root);
  }

  function addStackBoxLayer(kind = "image") {
    const root = getStackBoxRoot(editorRef.current?.getSelected?.() || lastBlockCompRef.current || null);
    if (!root) return;

    ensureStackBoxEditingCapabilities(root);
    const layers = getStackLayerComponents(root);
    const nextDefinition = kind === "text"
      ? createFunnelStackTextLayer(layers.length)
      : createFunnelStackImageLayer(layers.length);
    const added = root.components().add(nextDefinition);
    const nextLayer = Array.isArray(added) ? added[0] : added;
    if (!nextLayer) return;

    ensureAbsolutePlacement(nextLayer);
    normalizeStackLayerOrder(root);
    editorRef.current?.select?.(nextLayer);
    selectedCompRef.current = nextLayer;
    lastBlockCompRef.current = nextLayer;
    lastSelectedTagRef.current = kind === "text" ? `${nextLayer.get?.("tagName") || "div"}`.toLowerCase() : "img";
    if (kind !== "text") {
      lastImageCompRef.current = nextLayer;
      setBlockKind("image");
      setBlockPanelOpen(true);
    }
  }

  function findComponentByElement(component, element) {
    if (!component || !element) return null;
    if (component.view?.el === element) return component;

    let found = null;
    const children = typeof component.components === "function" ? component.components() : null;
    children?.forEach?.((child) => {
      if (found) return;
      found = findComponentByElement(child, element);
    });
    return found;
  }

  function findNestedImageComponent(component, depth = 0) {
    if (!component || depth > 4) return null;

    const tag = `${component?.get?.("tagName") || ""}`.toLowerCase();
    const type = `${component?.get?.("type") || ""}`.toLowerCase();
    if (tag === "img" || type === "image" || component.is?.("image")) {
      return component;
    }

    const children = typeof component?.components === "function" ? component.components() : null;
    const meaningfulChildren = [];
    children?.forEach?.((child) => {
      const childTag = `${child?.get?.("tagName") || ""}`.toLowerCase();
      const childType = `${child?.get?.("type") || ""}`.toLowerCase();
      const childContent = `${child?.get?.("content") || ""}`.trim();
      const isEmptyTextNode = !childTag && (childType === "text" || childType === "textnode") && !childContent;
      if (!isEmptyTextNode) meaningfulChildren.push(child);
    });

    if (meaningfulChildren.length !== 1) return null;
    return findNestedImageComponent(meaningfulChildren[0], depth + 1);
  }

  function getMeaningfulChildComponents(component) {
    const children = typeof component?.components === "function" ? component.components() : null;
    const meaningfulChildren = [];
    children?.forEach?.((child) => {
      const childTag = `${child?.get?.("tagName") || ""}`.toLowerCase();
      const childType = `${child?.get?.("type") || ""}`.toLowerCase();
      const childContent = `${child?.get?.("content") || ""}`.trim();
      const isEmptyTextNode = !childTag && (childType === "text" || childType === "textnode") && !childContent;
      if (!isEmptyTextNode) meaningfulChildren.push(child);
    });
    return meaningfulChildren;
  }

  function findImageBlockContainer(component) {
    if (!component || isFreeformArrangeTarget(component)) return null;

    let cursor = component.parent?.() || null;
    let depth = 0;
    while (cursor && depth < 3) {
      const tag = `${cursor?.get?.("tagName") || ""}`.toLowerCase();
      const attrs = cursor.getAttributes?.() || {};
      if (tag === "a") {
        cursor = cursor.parent?.() || null;
        depth += 1;
        continue;
      }
      if (tag === "section" || tag === "main" || tag === "article") return null;
      if (`${attrs["data-blank-canvas-root"] || ""}`.toLowerCase() === "true") return null;
      if (`${attrs["data-blank-canvas-stage"] || ""}`.toLowerCase() === "true") return null;
      if (isFreeformArrangeTarget(cursor)) return null;

      const meaningfulChildren = getMeaningfulChildComponents(cursor);
      if (meaningfulChildren.length === 1) return cursor;
      return null;
    }
    return null;
  }

  function normalizeImageBlockLayout(component) {
    if (!component) return;

    const attrs = component.getAttributes?.() || {};
    if (`${attrs["data-floating-image"] || ""}`.toLowerCase() === "true") return;
    if (isFreeformArrangeTarget(component)) return;

    const liveStyle = component.getStyle?.() || {};
    const currentWidth = `${liveStyle.width || ""}`.trim();
    const nextImageStyle = {
      display: "block",
      position: "relative",
      float: "none",
      left: "auto",
      top: "auto",
      right: "auto",
      bottom: "auto",
      "margin-left": `${liveStyle["margin-left"] || "auto"}`,
      "margin-right": `${liveStyle["margin-right"] || "auto"}`,
      "max-width": "100%",
      height: `${liveStyle.height && liveStyle.height !== "0px" ? liveStyle.height : "auto"}`,
      "box-sizing": "border-box",
      "object-fit": `${liveStyle["object-fit"] || "contain"}`,
    };

    if (!currentWidth || currentWidth === "auto") {
      nextImageStyle.width = "100%";
    }

    component.addStyle?.(nextImageStyle);

    const container = findImageBlockContainer(component);
    if (container) {
      const containerStyle = container.getStyle?.() || {};
      try {
        container.set?.({
          selectable: false,
          hoverable: false,
          layerable: false,
          resizable: false,
        });
      } catch {
        // ignore Grapes model capability errors on legacy wrappers
      }
      container.addStyle?.({
        display: `${containerStyle.display && containerStyle.display !== "inline" ? containerStyle.display : "flex"}`,
        "justify-content": `${containerStyle["justify-content"] || "center"}`,
        "align-items": `${containerStyle["align-items"] || "center"}`,
        "text-align": `${containerStyle["text-align"] || "center"}`,
        width: `${containerStyle.width || "100%"}`,
        "max-width": `${containerStyle["max-width"] || "100%"}`,
        overflow: `${containerStyle.overflow || "visible"}`,
        "margin-left": `${containerStyle["margin-left"] || "auto"}`,
        "margin-right": `${containerStyle["margin-right"] || "auto"}`,
        "box-sizing": "border-box",
      });
    }
  }

  function normalizeImageBlocksInTree(component) {
    if (!component) return;

    const imageComponent = findNestedImageComponent(component);
    if (imageComponent) {
      normalizeImageBlockLayout(imageComponent);
    }

    const children = typeof component?.components === "function" ? component.components() : null;
    children?.forEach?.((child) => normalizeImageBlocksInTree(child));
  }

  function stripEditorOnlyMarkup(html = "") {
    const rawHtml = String(html || "");
    if (typeof DOMParser === "undefined") {
      return rawHtml
        .replace(/<div[^>]*data-editor-only="true"[^>]*>[\s\S]*?<\/div>/gi, "")
        .replace(/(<[^>]*data-blank-canvas-stage="true"[^>]*style=")([^"]*)(")/gi, (_match, before, styleText, after) => {
          const cleanedStyle = styleText
            .replace(/border\s*:\s*[^;]+;?/gi, "")
            .replace(/outline\s*:\s*[^;]+;?/gi, "")
            .replace(/;;+/g, ";")
            .trim();
          return `${before}${cleanedStyle}${after}`;
        });
    }

    const doc = new DOMParser().parseFromString(rawHtml, "text/html");
    doc.querySelectorAll('[data-editor-only="true"]').forEach((node) => node.remove());
    doc.querySelectorAll('[data-blank-canvas-stage="true"]').forEach((node) => {
      node.style.border = "none";
      node.style.outline = "none";
    });
    return doc.body.innerHTML;
  }

  function ensureBlankCanvasEditorStyles(doc) {
    if (!doc || doc.getElementById("blank-canvas-editor-styles")) return;

    const styleEl = doc.createElement("style");
    styleEl.id = "blank-canvas-editor-styles";
    styleEl.textContent = `
      [data-blank-canvas-stage="true"] {
        border: 2px dashed rgba(255,255,255,0.22) !important;
      }
    `;
    doc.head?.appendChild(styleEl);
  }

  function bindBlankCanvasResizeHandles(editor) {
    const doc = editor?.Canvas?.getDocument?.();
    const win = editor?.Canvas?.getWindow?.();
    if (!doc || !win || doc.__blankCanvasHandleBound) return;
    ensureBlankCanvasEditorStyles(doc);
    doc.__blankCanvasHandleBound = true;

    doc.addEventListener("mousedown", (event) => {
      const handle = event.target?.closest?.('[data-blank-canvas-handle="true"]');
      if (!handle) return;

      event.preventDefault();
      event.stopPropagation();

      const rootEl = handle.closest('[data-blank-canvas-root="true"]');
      if (!rootEl) return;

      const wrapper = editor.getWrapper?.();
      const rootComp = findComponentByElement(wrapper, rootEl);
      if (!rootComp) return;

      const stageEl = rootEl.querySelector('[data-blank-canvas-stage="true"]');
      const stageComp = stageEl ? findComponentByElement(wrapper, stageEl) : null;

      editor.select?.(rootComp);

      const rootStyles = win.getComputedStyle(rootEl);
      const padTop = parseFloat(rootStyles.paddingTop || "0") || 0;
      const padBottom = parseFloat(rootStyles.paddingBottom || "0") || 0;
      const startY = event.clientY;
      const startHeight = Math.max(rootEl.getBoundingClientRect().height, parseFloat(rootStyles.minHeight || "0") || 0);

      const onMove = (moveEvent) => {
        const nextHeight = Math.max(220, Math.round(startHeight + (moveEvent.clientY - startY)));
        rootComp.addStyle?.({ "min-height": `${nextHeight}px` });
        if (stageComp) {
          stageComp.addAttributes?.({ "data-blank-canvas-stage": "true" });
          stageComp.addStyle?.({ "min-height": `${Math.max(160, nextHeight - padTop - padBottom)}px` });
        }
        setBlockControls((prev) => ({ ...prev, minHeight: `${nextHeight}` }));
      };

      const onUp = () => {
        doc.removeEventListener("mousemove", onMove);
        doc.removeEventListener("mouseup", onUp);
        editor.refresh?.();
      };

      doc.addEventListener("mousemove", onMove);
      doc.addEventListener("mouseup", onUp);
    });
  }

  function ensureBlankCanvasEditingCapabilities(component) {
    const root = getBlankCanvasRoot(component);
    if (!root) return;
    root.set?.({
      draggable: true,
      droppable: true,
      selectable: true,
      hoverable: true,
      layerable: true,
      copyable: true,
      removable: true,
      stylable: true,
      resizable: {
        tl: 0,
        tc: 0,
        tr: 0,
        cl: 0,
        cr: 0,
        bl: 0,
        bc: 1,
        br: 0,
        keyHeight: "min-height",
      },
    });
  }

  function applyBlockControlsPatch(patch) {
    const comp = selectedCompRef.current || lastBlockCompRef.current;
    if (!comp) return;

    const liveControls = extractBlockControlsFromComponent(comp);
    const next = { ...liveControls, ...patch };
    const requestedZIndex = parseInt(next.zIndex || "0", 10);
    const safeZIndex = Number.isFinite(requestedZIndex) ? Math.max(0, requestedZIndex) : 0;
    next.zIndex = `${safeZIndex}`;
    setBlockControls(next);

    const bgImage = `${next.backgroundImage || ""}`.trim();
    const backgroundOpacity = parseInt(next.backgroundImageOpacity || "100", 10) / 100;
    const filterValue = `opacity(${backgroundOpacity})`;
    const backgroundColor = next.backgroundTransparent ? "transparent" : `${next.backgroundColor || "transparent"}`;
    const isShape = blockKind === "shape" || isShapeLikeComponent(comp);
    const backgroundSize = `${next.backgroundSize || "cover"}`;
    const backgroundPosition = `${next.backgroundPosition || "center center"}`;
    const backgroundRepeat = `${next.backgroundRepeat || "no-repeat"}`;
    const backgroundShorthand = bgImage
      ? `${backgroundColor} url("${bgImage}") ${backgroundPosition} / ${backgroundSize} ${backgroundRepeat}`
      : backgroundColor;

    const stylePatch = {
      background: backgroundShorthand,
      "background-color": backgroundColor,
      "background-image": bgImage ? `url(${bgImage})` : "none",
      "background-size": backgroundSize,
      "background-position": backgroundPosition,
      "background-repeat": backgroundRepeat,
      "min-height": `${Math.max(0, parseInt(next.minHeight || "0", 10) || 0)}px`,
      "padding-top": `${next.paddingTop || 0}px`,
      "padding-bottom": `${next.paddingBottom || 0}px`,
      filter: bgImage ? filterValue : "none",
      animation: next.backgroundImageFadeIn ? "bgImageFadeIn 1.5s ease-in-out" : "none",
    };

    let canvasStage = null;
    if (comp && typeof comp.components === "function") {
      comp.components().forEach?.((child) => {
        if (canvasStage) return;
        const attrs = child.getAttributes?.() || {};
        if (`${attrs["data-blank-canvas-stage"] || ""}`.toLowerCase() === "true") {
          canvasStage = child;
          return;
        }
        const childStyle = child.getStyle?.() || {};
        const position = `${childStyle.position || ""}`.trim().toLowerCase();
        if (position !== "absolute") {
          canvasStage = child;
        }
      });
    }

    if (isShape) {
      ensureShapeEditingCapabilities(comp);
      const shapePresetStyle = getShapePresetStyle(next.shapePreset, backgroundColor);
      Object.assign(stylePatch, shapePresetStyle, {
        background: shapePresetStyle.background ?? backgroundColor,
        "background-color": shapePresetStyle["background-color"] ?? backgroundColor,
        border: shapePresetStyle.border ?? "none",
        width: `${next.width || 120}px`,
        height: `${next.height || 120}px`,
        opacity: `${Math.max(0, Math.min(100, parseInt(next.opacity || "100", 10))) / 100}`,
        position: "absolute",
        "z-index": `${safeZIndex}`,
        display: "block",
        cursor: "move",
        "max-width": "100%",
        "box-sizing": "border-box",
      });
      comp.addAttributes({ "data-shape-block": "true" });
    } else if ((comp.get?.("tagName") || "").toLowerCase() === "section" && canvasStage) {
      const minHeight = Math.max(0, parseInt(next.minHeight || "0", 10) || 0);
      const paddingTop = Math.max(0, parseInt(next.paddingTop || "0", 10) || 0);
      const paddingBottom = Math.max(0, parseInt(next.paddingBottom || "0", 10) || 0);
      const stageMinHeight = Math.max(160, minHeight - paddingTop - paddingBottom);
      canvasStage.addAttributes?.({ "data-blank-canvas-stage": "true" });
      canvasStage.addStyle?.({ "min-height": `${stageMinHeight}px` });
    }

    comp.addStyle(stylePatch);
  }

  function shiftBlockLayer(delta) {
    const comp = selectedCompRef.current || lastBlockCompRef.current;
    if (!comp) return;

    const liveControls = extractBlockControlsFromComponent(comp);
    const currentZ = parseInt(liveControls.zIndex || "0", 10);
    const safeCurrentZ = Number.isFinite(currentZ) ? currentZ : 0;
    const nextZ = Math.max(0, Math.min(50, safeCurrentZ + delta));

    applyBlockControlsPatch({ zIndex: `${nextZ}` });
  }

  function getActiveArrangeComponent() {
    return selectedCompRef.current || lastBlockCompRef.current || null;
  }

  function isFreeformArrangeTarget(component) {
    if (!component) return false;
    const attrs = component.getAttributes?.() || {};
    if (`${attrs["data-group-block"] || ""}`.toLowerCase() === "true") return true;
    if (isShapeLikeComponent(component)) return true;
    const style = component.getStyle?.() || {};
    const position = `${style.position || ""}`.trim().toLowerCase();
    return position === "absolute" || position === "fixed";
  }

  function ensureAbsolutePlacement(component) {
    if (!component) return null;
    const parent = component.parent?.();
    parent?.addStyle?.({ position: "relative" });
    const style = component.getStyle?.() || {};
    const resizeOptions = {
      tl: 1, tc: 1, tr: 1,
      cl: 1, cr: 1,
      bl: 1, bc: 1, br: 1,
      keyWidth: "width",
      keyHeight: "height",
    };

    try {
      component.set({
        draggable: true,
        droppable: false,
        selectable: true,
        hoverable: true,
        layerable: true,
        copyable: true,
        removable: true,
        stylable: true,
        resizable: resizeOptions,
      });
    } catch {
      // ignore Grapes model capability errors
    }

    component.addStyle?.({
      position: "absolute",
      left: `${style.left || "24px"}`,
      top: `${style.top || "24px"}`,
      margin: "0",
      cursor: "move",
      display: `${style.display || "block"}`,
      "max-width": "none",
      "box-sizing": "border-box",
    });
    return component;
  }

  function normalizeAbsoluteComponentForSave(component) {
    if (!component) return;

    const attrs = component.getAttributes?.() || {};
    const isMarkedShape = `${attrs["data-shape-block"] || ""}`.toLowerCase() === "true";
    if (isMarkedShape && !isShapeLikeComponent(component)) {
      const nextAttrs = { ...attrs };
      delete nextAttrs["data-shape-block"];
      component.setAttributes?.(nextAttrs);
    }

    if (isMarkedShape) {
      component.addStyle?.({
        "max-width": "none",
        width: `${component.getStyle?.()?.width || component.view?.el?.offsetWidth || ""}`,
      });
    }

    const style = component.getStyle?.() || {};
    const position = `${style.position || ""}`.trim().toLowerCase();
    const rawTransform = `${style.transform || ""}`.trim();

    if ((position === "absolute" || position === "fixed") && rawTransform) {
      let deltaX = 0;
      let deltaY = 0;

      rawTransform.replace(/translateX\(\s*(-?\d+(?:\.\d+)?)px\s*\)/gi, (_, x) => {
        deltaX += parseFloat(x || "0") || 0;
        return _;
      });
      rawTransform.replace(/translateY\(\s*(-?\d+(?:\.\d+)?)px\s*\)/gi, (_, y) => {
        deltaY += parseFloat(y || "0") || 0;
        return _;
      });
      rawTransform.replace(/translate\(\s*(-?\d+(?:\.\d+)?)px(?:\s*,\s*(-?\d+(?:\.\d+)?)px)?\s*\)/gi, (_, x, y) => {
        deltaX += parseFloat(x || "0") || 0;
        deltaY += parseFloat(y || "0") || 0;
        return _;
      });

      if (deltaX || deltaY) {
        const currentLeft = parseFloat(stylePxToNumber(style.left || "0px", "0")) || 0;
        const currentTop = parseFloat(stylePxToNumber(style.top || "0px", "0")) || 0;
        const cleanedTransform = rawTransform
          .replace(/translateX\(\s*-?\d+(?:\.\d+)?px\s*\)/gi, "")
          .replace(/translateY\(\s*-?\d+(?:\.\d+)?px\s*\)/gi, "")
          .replace(/translate\(\s*-?\d+(?:\.\d+)?px(?:\s*,\s*-?\d+(?:\.\d+)?px)?\s*\)/gi, "")
          .replace(/\s{2,}/g, " ")
          .trim();

        component.addStyle?.({
          left: `${Math.round((currentLeft + deltaX) * 100) / 100}px`,
          top: `${Math.round((currentTop + deltaY) * 100) / 100}px`,
          transform: cleanedTransform || "none",
        });
      }
    } else if (rawTransform && !isFreeformArrangeTarget(component)) {
      component.addStyle?.({ transform: "none" });
    }

    const collection = typeof component.components === "function" ? component.components() : null;
    collection?.forEach?.((child) => normalizeAbsoluteComponentForSave(child));
  }

  function normalizeShapeLayeringForSave(component) {
    if (!component) return;
    const collection = typeof component.components === "function" ? component.components() : null;
    const children = [];
    collection?.forEach?.((child) => children.push(child));
    if (!children.length) return;

    const shapeChildren = children.filter((child) => isShapeLikeComponent(child));
    if (shapeChildren.length) {
      const maxShapeZ = Math.max(...shapeChildren.map((child) => {
        const childStyle = child.getStyle?.() || {};
        const parsed = parseInt(`${childStyle["z-index"] || "0"}`, 10);
        return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      }));

      children.forEach((child) => {
        if (shapeChildren.includes(child)) return;
        const childStyle = child.getStyle?.() || {};
        const parsed = parseInt(`${childStyle["z-index"] || "1"}`, 10);
        child.addStyle?.({
          position: childStyle.position && childStyle.position !== "static" ? childStyle.position : "relative",
          "z-index": `${Math.max(Number.isFinite(parsed) ? parsed : 1, maxShapeZ + 1)}`,
        });
      });
    }

    children.forEach((child) => normalizeShapeLayeringForSave(child));
  }

  function normalizeResponsiveShapeMetricsForSave(component) {
    if (!component) return;

    const collection = typeof component.components === "function" ? component.components() : null;
    const children = [];
    collection?.forEach?.((child) => children.push(child));

    children.forEach((child) => {
      if (!isShapeLikeComponent(child)) {
        normalizeResponsiveShapeMetricsForSave(child);
        return;
      }

      const parent = child.parent?.();
      const parentEl = parent?.view?.el;
      const parentRect = parentEl?.getBoundingClientRect?.();
      const shapeBox = measureComponentBox(child);
      const parentWidth = Math.round((parentRect?.width || parentEl?.clientWidth || 0) * 100) / 100;
      const parentHeight = Math.round((parentRect?.height || parentEl?.clientHeight || 0) * 100) / 100;

      if (!parentWidth || !parentHeight) {
        normalizeResponsiveShapeMetricsForSave(child);
        return;
      }

      child.addAttributes?.({
        "data-shape-responsive": "true",
        "data-shape-base-parent-width": `${parentWidth}`,
        "data-shape-base-parent-height": `${parentHeight}`,
        "data-shape-base-left": `${Math.round(shapeBox.left * 100) / 100}`,
        "data-shape-base-top": `${Math.round(shapeBox.top * 100) / 100}`,
        "data-shape-base-width": `${Math.round(shapeBox.width * 100) / 100}`,
        "data-shape-base-height": `${Math.round(shapeBox.height * 100) / 100}`,
        "data-shape-left-pct": `${Math.round((shapeBox.left / parentWidth) * 10000) / 10000}`,
        "data-shape-top-pct": `${Math.round((shapeBox.top / parentHeight) * 10000) / 10000}`,
        "data-shape-width-pct": `${Math.round((shapeBox.width / parentWidth) * 10000) / 10000}`,
        "data-shape-height-pct": `${Math.round((shapeBox.height / parentHeight) * 10000) / 10000}`,
      });

      normalizeResponsiveShapeMetricsForSave(child);
    });
  }

  function findCenteredContentAnchor(section) {
    if (!section) return null;
    const sectionEl = section.view?.el;
    if (!sectionEl) return null;

    const sectionRect = sectionEl.getBoundingClientRect();
    const collection = typeof section.components === "function" ? section.components() : null;
    const children = [];
    collection?.forEach?.((child) => children.push(child));

    let best = null;
    children.forEach((child) => {
      if (!child || isShapeLikeComponent(child)) return;
      const childEl = child.view?.el;
      if (!childEl) return;

      const childStyle = child.getStyle?.() || {};
      const position = `${childStyle.position || ""}`.trim().toLowerCase();
      if (position === "absolute" || position === "fixed") return;

      const rect = childEl.getBoundingClientRect();
      if (!rect.width || rect.width >= sectionRect.width - 8) return;

      const computed = typeof window !== "undefined" ? window.getComputedStyle(childEl) : null;
      const centeredByMargin = computed?.marginLeft === "auto" && computed?.marginRight === "auto";
      const centeredByPosition = Math.abs((rect.left - sectionRect.left) - ((sectionRect.width - rect.width) / 2)) < 6;
      if (!centeredByMargin && !centeredByPosition) return;

      if (!best || rect.width > best.rect.width) {
        best = { component: child, rect };
      }
    });

    return best;
  }

  function normalizeSectionAnchoredShapesForSave(component) {
    if (!component) return;

    const collection = typeof component.components === "function" ? component.components() : null;
    const children = [];
    collection?.forEach?.((child) => children.push(child));
    if (!children.length) return;

    const tag = `${component?.get?.("tagName") || ""}`.toLowerCase();
    if (tag === "section") {
      const anchor = findCenteredContentAnchor(component);
      if (anchor?.component && anchor?.rect && component.view?.el) {
        const sectionRect = component.view.el.getBoundingClientRect();
        const directShapeChildren = children.filter((child) => isShapeLikeComponent(child) && child.parent?.() === component);

        if (directShapeChildren.length) {
          const anchorComponent = anchor.component;
          const anchorStyle = anchorComponent.getStyle?.() || {};
          anchorComponent.addStyle?.({
            position: anchorStyle.position && anchorStyle.position !== "static" ? anchorStyle.position : "relative",
          });

          directShapeChildren.forEach((shape) => {
            const shapeBox = measureComponentBox(shape);
            const nextLeft = Math.round((shapeBox.left - (anchor.rect.left - sectionRect.left)) * 100) / 100;
            const nextTop = Math.round((shapeBox.top - (anchor.rect.top - sectionRect.top)) * 100) / 100;
            const shapeJson = shape.toJSON ? shape.toJSON() : null;
            const liveShapeStyle = shape.getStyle?.() || {};
            if (!shapeJson) return;

            shape.remove();
            const added = anchorComponent.components().add({
              ...shapeJson,
              style: {
                ...liveShapeStyle,
                ...(shapeJson.style || {}),
                position: "absolute",
                left: `${nextLeft}px`,
                top: `${nextTop}px`,
                margin: "0",
                "max-width": "none",
              },
            }, { at: 0 });

            const nextShape = Array.isArray(added) ? added[0] : added;
            if (nextShape && isShapeLikeComponent(nextShape)) {
              ensureShapeEditingCapabilities(nextShape);
            }
          });
        }
      }
    }

    const nextChildren = typeof component.components === "function" ? component.components() : null;
    nextChildren?.forEach?.((child) => normalizeSectionAnchoredShapesForSave(child));
  }

  function measureComponentBox(component) {
    const style = component?.getStyle?.() || {};
    const el = component?.view?.el || null;
    const left = parseFloat(stylePxToNumber(style.left || "0px", "0"));
    const top = parseFloat(stylePxToNumber(style.top || "0px", "0"));
    const width = parseFloat(stylePxToNumber(style.width || `${el?.offsetWidth || 120}px`, `${el?.offsetWidth || 120}`));
    const height = parseFloat(stylePxToNumber(style.height || `${el?.offsetHeight || 40}px`, `${el?.offsetHeight || 40}`));
    const zIndex = parseInt(`${style["z-index"] || "0"}`, 10);
    return {
      left: Number.isFinite(left) ? left : 0,
      top: Number.isFinite(top) ? top : 0,
      width: Number.isFinite(width) ? width : 120,
      height: Number.isFinite(height) ? height : 40,
      zIndex: Number.isFinite(zIndex) ? zIndex : 0,
    };
  }

  function alignSelectedBlock(mode) {
    const comp = getActiveArrangeComponent();
    if (!comp) return;
    if (!isFreeformArrangeTarget(comp)) {
      alert("Arrange controls work on shapes or grouped floating objects only.");
      return;
    }
    ensureAbsolutePlacement(comp);

    const parent = comp.parent?.();
    const parentEl = parent?.view?.el || null;
    const box = measureComponentBox(comp);
    const parentStyle = parent?.getStyle?.() || {};
    const parentWidth = Math.max(
      parseFloat(stylePxToNumber(parentStyle.width || `${parentEl?.clientWidth || 0}px`, `${parentEl?.clientWidth || 0}`)) || 0,
      parentEl?.clientWidth || 0,
      box.width
    );
    const parentHeight = Math.max(
      parseFloat(stylePxToNumber(parentStyle.height || `${parentEl?.clientHeight || 0}px`, `${parentEl?.clientHeight || 0}`)) || 0,
      parentEl?.clientHeight || 0,
      box.height
    );

    let nextLeft = box.left;
    let nextTop = box.top;

    if (mode === "left") nextLeft = 0;
    if (mode === "center-x" || mode === "center-both") nextLeft = Math.max(0, (parentWidth - box.width) / 2);
    if (mode === "right") nextLeft = Math.max(0, parentWidth - box.width);
    if (mode === "top") nextTop = 0;
    if (mode === "center-y" || mode === "center-both") nextTop = Math.max(0, (parentHeight - box.height) / 2);
    if (mode === "bottom") nextTop = Math.max(0, parentHeight - box.height);

    comp.addStyle?.({
      position: "absolute",
      left: `${Math.round(nextLeft)}px`,
      top: `${Math.round(nextTop)}px`,
      margin: "0",
    });

    if (isShapeLikeComponent(comp)) {
      ensureShapeEditingCapabilities(comp);
    } else {
      ensureForegroundLayer(comp);
    }

    setBlockControls(extractBlockControlsFromComponent(comp));
    editorRef.current?.select?.(comp);
  }

  function addSelectedToGroup() {
    const comp = getActiveArrangeComponent();
    if (!comp) return;
    if (!isFreeformArrangeTarget(comp)) {
      alert("Only shapes or already floating objects can be grouped for freeform movement.");
      return;
    }
    const next = (groupSelectionRef.current || []).filter((item) => item?.cid !== comp.cid);
    groupSelectionRef.current = [...next, comp];
    setGroupSelectionCount(groupSelectionRef.current.length);
  }

  function clearGroupSelection() {
    groupSelectionRef.current = [];
    setGroupSelectionCount(0);
  }

  function groupSelectedBlocks() {
    const current = getActiveArrangeComponent();
    const selected = [];
    [...(groupSelectionRef.current || []), current].forEach((comp) => {
      if (comp && !selected.some((item) => item?.cid === comp.cid) && comp.parent?.()) {
        selected.push(comp);
      }
    });

    if (selected.length < 2) {
      alert("Add at least 2 objects with Add to Group first.");
      return;
    }

    const parent = selected[0].parent?.();
    if (!parent || !selected.every((comp) => comp.parent?.() === parent)) {
      alert("Grouped objects must be inside the same section or container.");
      return;
    }

    parent.addStyle?.({ position: "relative" });
    selected.forEach((comp) => ensureAbsolutePlacement(comp));

    const items = selected.map((comp) => {
      const box = measureComponentBox(comp);
      const json = comp.toJSON ? comp.toJSON() : null;
      return json ? { comp, box, json } : null;
    }).filter(Boolean);

    if (items.length < 2) {
      alert("Could not build the group from those objects.");
      return;
    }

    const minLeft = Math.min(...items.map((item) => item.box.left));
    const minTop = Math.min(...items.map((item) => item.box.top));
    const maxRight = Math.max(...items.map((item) => item.box.left + item.box.width));
    const maxBottom = Math.max(...items.map((item) => item.box.top + item.box.height));
    const maxZ = Math.max(...items.map((item) => item.box.zIndex));
    const insertionIndex = Math.min(...selected.map((comp) => comp.index?.() || 0));

    const wrapperData = {
      type: "default",
      tagName: "div",
      attributes: { "data-group-block": "true" },
      style: {
        position: "absolute",
        left: `${Math.round(minLeft)}px`,
        top: `${Math.round(minTop)}px`,
        width: `${Math.max(40, Math.round(maxRight - minLeft))}px`,
        height: `${Math.max(40, Math.round(maxBottom - minTop))}px`,
        margin: "0",
        padding: "0",
        background: "transparent",
        "box-sizing": "border-box",
        "z-index": `${Math.max(0, maxZ)}`,
      },
      draggable: true,
      droppable: true,
      selectable: true,
      hoverable: true,
      layerable: true,
      copyable: true,
      removable: true,
      stylable: true,
      resizable: true,
      components: items.map((item) => ({
        ...item.json,
        style: {
          ...(item.json.style || {}),
          position: "absolute",
          left: `${Math.round(item.box.left - minLeft)}px`,
          top: `${Math.round(item.box.top - minTop)}px`,
          margin: "0",
        },
      })),
    };

    selected
      .slice()
      .sort((a, b) => (b.index?.() || 0) - (a.index?.() || 0))
      .forEach((comp) => comp.remove());

    const added = parent.components().add(wrapperData, { at: insertionIndex });
    const groupComp = Array.isArray(added) ? added[0] : added;

    clearGroupSelection();
    if (groupComp) {
      selectedCompRef.current = groupComp;
      lastBlockCompRef.current = groupComp;
      setBlockKind("block");
      setBlockPanelOpen(true);
      setBlockControls(extractBlockControlsFromComponent(groupComp));
      editorRef.current?.select?.(groupComp);
    }
  }

  function ungroupSelectedBlock() {
    const comp = getActiveArrangeComponent();
    const attrs = comp?.getAttributes?.() || {};
    if (!comp || `${attrs["data-group-block"] || ""}`.toLowerCase() !== "true") {
      alert("Select a grouped container first.");
      return;
    }

    const parent = comp.parent?.();
    if (!parent) return;

    const groupBox = measureComponentBox(comp);
    const childItems = [];
    const collection = typeof comp.components === "function" ? comp.components() : [];
    if (collection?.forEach) {
      collection.forEach((child) => {
        const childBox = measureComponentBox(child);
        const childJson = child.toJSON ? child.toJSON() : null;
        if (!childJson) return;
        childItems.push({
          ...childJson,
          style: {
            ...(childJson.style || {}),
            position: "absolute",
            left: `${Math.round(groupBox.left + childBox.left)}px`,
            top: `${Math.round(groupBox.top + childBox.top)}px`,
            margin: "0",
          },
        });
      });
    }

    const insertionIndex = comp.index?.() || 0;
    comp.remove();

    let firstUngrouped = null;
    childItems.forEach((item, index) => {
      const added = parent.components().add(item, { at: insertionIndex + index });
      const nextComp = Array.isArray(added) ? added[0] : added;
      if (!firstUngrouped && nextComp) firstUngrouped = nextComp;
    });

    if (firstUngrouped) {
      selectedCompRef.current = firstUngrouped;
      lastBlockCompRef.current = firstUngrouped;
      setBlockControls(extractBlockControlsFromComponent(firstUngrouped));
      editorRef.current?.select?.(firstUngrouped);
    }
  }

  function applyBackgroundImageUrl(urlValue) {
    applyBlockControlsPatch({ backgroundImage: `${urlValue || ""}`.trim() });
  }

  function extractFormControlsFromComponent(comp) {
    const tagName = `${comp?.get?.("tagName") || ""}`.toLowerCase();
    const attrs = comp?.getAttributes?.() || {};
    const style = comp?.getStyle?.() || {};
    const el = comp?.view?.el || null;
    const computed = el && typeof window !== "undefined" ? window.getComputedStyle(el) : null;
    const resolvedStyle = (key, fallback) => style[key] || computed?.getPropertyValue(key) || fallback;
    const rawContent = comp?.get?.("content");
    let content = typeof rawContent === "string" ? rawContent : "";
    if (!content) {
      try {
        content = el?.innerText || "";
      } catch {
        content = "";
      }
    }

    return {
      tagName,
      content,
      placeholder: `${attrs.placeholder || ""}`,
      value: `${attrs.value || ""}`,
      name: `${attrs.name || ""}`,
      type: `${attrs.type || "text"}`,
      fontSize: stylePxToNumber(resolvedStyle("font-size", "16px"), "16"),
      fontWeight: `${resolvedStyle("font-weight", "600")}`,
      color: normalizeColorForPicker(`${resolvedStyle("color", "#ffffff")}`),
      backgroundColor: normalizeColorForPicker(`${resolvedStyle("background-color", "#1f3f7f")}`),
      borderColor: normalizeColorForPicker(`${resolvedStyle("border-color", "#5a88d1")}`),
      borderRadius: stylePxToNumber(resolvedStyle("border-radius", "8px"), "8"),
      paddingY: stylePxToNumber(resolvedStyle("padding-top", "10px"), "10"),
      paddingX: stylePxToNumber(resolvedStyle("padding-left", "14px"), "14"),
    };
  }

  function applyFormControlsPatch(patch) {
    const comp = selectedFormCompRef.current || lastFormCompRef.current;
    if (!comp) return;

    const next = { ...formControls, ...patch };
    setFormControls(next);

    const tagName = `${next.tagName || ""}`.toLowerCase();
    const attrsPatch = {};

    if (["input", "textarea"].includes(tagName)) {
      attrsPatch.placeholder = `${next.placeholder || ""}`;
      attrsPatch.value = `${next.value || ""}`;
    }
    if (tagName === "input") {
      attrsPatch.type = `${next.type || "text"}`;
    }
    if (next.name !== undefined) {
      attrsPatch.name = `${next.name || ""}`;
    }
    comp.addAttributes(attrsPatch);

    if (["button", "label", "option", "textarea"].includes(tagName) && Object.prototype.hasOwnProperty.call(patch, "content")) {
      comp.components((next.content || "").replace(/\n/g, "<br/>"));
    }

    const stylePatch = {
      "font-size": `${next.fontSize || 16}px`,
      "font-weight": `${next.fontWeight || "600"}`,
      color: `${next.color || "#ffffff"}`,
      "background-color": `${next.backgroundColor || "transparent"}`,
      "border-color": `${next.borderColor || "transparent"}`,
      "border-radius": `${next.borderRadius || 0}px`,
      "padding-top": `${next.paddingY || 0}px`,
      "padding-bottom": `${next.paddingY || 0}px`,
      "padding-left": `${next.paddingX || 0}px`,
      "padding-right": `${next.paddingX || 0}px`,
    };
    ensureForegroundLayer(comp);
    comp.addStyle(stylePatch);
  }

  function applyTextControlsPatch(patch) {
    const comp = selectedTextCompRef.current || lastTextCompRef.current;
    if (!comp) return;
    const next = { ...textControls, ...patch };
    setTextControls(next);

    if (Object.prototype.hasOwnProperty.call(patch, "content")) {
      comp.components((next.content || "").replace(/\n/g, "<br/>"));
    }

    if (Object.prototype.hasOwnProperty.call(patch, "href")) {
      comp.addAttributes({ href: next.href || "#" });
      return;
    }

    const textColor = next.hollowText ? "transparent" : (next.color || "#111827");
    const strokeValue = next.outlineEnabled ? `${next.outlineWidth || 1}px ${next.outlineColor || "#000000"}` : "0px transparent";
    
    const stylePatch = {
      "font-size": `${next.fontSize || 18}px`,
      "font-weight": clampFontWeight(next.fontWeight, "600"),
      "font-style": `${next.fontStyle || "normal"}`,
      "text-decoration": `${next.textDecoration || "none"}`,
      color: textColor,
      "line-height": `${next.lineHeight || "1.6"}`,
      "letter-spacing": `${next.letterSpacing || 0}px`,
      "text-align": `${next.textAlign || "left"}`,
      "text-transform": `${next.textTransform || "none"}`,
      "-webkit-text-stroke": strokeValue,
      width: next.width ? `${next.width}px` : "auto",
      "max-width": next.maxWidth ? `${next.maxWidth}px` : "none",
      position: "relative",
      "z-index": "1",
    };
    ensureForegroundLayer(comp);
    comp.addStyle(stylePatch);
  }

  // Auth
  useEffect(() => {
    let sub;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session || null);
      ({ data: { subscription: sub } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null)));
    })();
    return () => sub?.unsubscribe?.();
  }, []);

  // Load basics
  useEffect(() => {
    if (!session || !id) return;
    (async () => {
      setLoading(true);
      try {
        const { data: f, error: funnelErr } = await supabase.from("funnels").select("*").eq("id", id).maybeSingle();
        if (funnelErr) throw funnelErr;
        setFunnel(f || null);
        setNotifyEmail(f?.notify_email || "");
        setDefaultListId(f?.default_list_id || null);

        const { data: s, error: stepsErr } = await supabase
          .from("funnel_steps")
          .select("*")
          .eq("funnel_id", id)
          .order("order_index", { ascending: true });
        if (stepsErr) throw stepsErr;
        setSteps(s || []);
        setActiveStepId((s && s[0]?.id) || null);

        const listsRes = await supabase
          .from("email_lists")
          .select("id,name")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: true });
        if (listsRes.error) throw listsRes.error;
        setLists(listsRes.data || []);
      } catch (err) {
        setFunnel(null);
        setSteps([]);
        setActiveStepId(null);
        setEditorError(err?.message || "Failed to load funnel data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.user?.id, id]);

  // Load GrapesJS
  useEffect(() => {
    if (loading) return;
    if (!id) return;
    if (!editorDivRef.current) return;
    if (editorRef.current || editorInitializingRef.current) return;

    // Inject animation keyframes once.
    const animStyleId = "funnels-bg-image-fadein-style";
    if (!document.getElementById(animStyleId)) {
      const styleEl = document.createElement("style");
      styleEl.id = animStyleId;
      styleEl.textContent = `
        @keyframes bgImageFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        #gjs,
        #gjs .gjs-editor,
        #gjs .gjs-cv-canvas,
        #gjs .gjs-frame-wrapper,
        #gjs iframe {
          min-height: 100% !important;
          height: 100% !important;
        }

        #gjs .gjs-cv-canvas,
        #gjs .gjs-frame-wrapper,
        #gjs .gjs-frame {
          background: #0b1016 !important;
        }

        #gjs .gjs-frame-wrapper {
          padding: 0 !important;
        }

        #gjs .gjs-sm-sector,
        #gjs .gjs-sm-sectors,
        #gjs .gjs-sm-properties,
        #gjs .gjs-trt-traits,
        #gjs .gjs-pn-btn[title*="Style"],
        #gjs .gjs-pn-btn[title*="Trait"] {
          display: none !important;
        }

        /* Left block cards readability */
        #gjs-blocks .gjs-title,
        #gjs-blocks .gjs-cate-title,
        #gjs-blocks .gjs-label,
        #gjs-blocks .gjs-block-label {
          font-size: 18px !important;
          line-height: 1.25 !important;
        }

        #gjs-blocks .gjs-block {
          min-height: 68px;
          padding: 8px;
        }
      `;
      document.head.appendChild(styleEl);
    }

    const init = async () => {
      editorInitializingRef.current = true;
      try {
        setEditorError("");
        setEditorReady(false);
        const grapesjs = await resolveGrapesjs();

        const e = grapesjs.init({
          container: editorDivRef.current,
          fromElement: false,
          height: "100%",
          storageManager: false,
          canvas: { styles: ["html,body{margin:0;padding:0;background:#0b1016;min-height:100%;}body{padding-bottom:320px;box-sizing:border-box;}"] , scripts: [] },
          panels: { defaults: [] },
          blockManager: { appendTo: "#gjs-blocks" },
          styleManager: false,
          assetManager: { assets: [], upload: false, autoAdd: false },
        });

        bindBlankCanvasResizeHandles(e);

        const textTags = new Set(["p", "span", "a", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "small", "label", "button"]);
        const formTags = new Set(["input", "textarea", "select", "option", "button", "label"]);

        e.on("component:add", (component) => {
          const normalizeShape = () => {
            if (!isShapeLikeComponent(component)) return;
            ensureShapeEditingCapabilities(component);
            const style = component.getStyle?.() || {};
            component.addStyle?.({
              left: `${style.left || "24px"}`,
              top: `${style.top || "24px"}`,
              margin: "0",
            });
          };

          const normalizeBlankCanvas = () => {
            ensureBlankCanvasEditingCapabilities(component);
          };

          if (typeof window !== "undefined") {
            requestAnimationFrame(normalizeShape);
            requestAnimationFrame(normalizeBlankCanvas);
          } else {
            normalizeShape();
            normalizeBlankCanvas();
          }
        });

        e.on("component:selected", (component) => {
          try {
            const blockTarget = resolveBlockStyleTarget(component, textTags, formTags);

            if (
              !imageSelectionRedirectRef.current
              && blockTarget
              && blockTarget !== component
              && `${blockTarget?.get?.("tagName") || ""}`.toLowerCase() === "img"
            ) {
              imageSelectionRedirectRef.current = true;
              requestAnimationFrame(() => {
                e.select?.(blockTarget);
                requestAnimationFrame(() => {
                  imageSelectionRedirectRef.current = false;
                });
              });
              return;
            }

            selectedCompRef.current = blockTarget;
            lastBlockCompRef.current = blockTarget;
            setBlockControls(extractBlockControlsFromComponent(blockTarget));
            setBlockPanelOpen(true);

            const tag = `${blockTarget?.get?.("tagName") || component?.get?.("tagName") || ""}`.toLowerCase();
            const type = `${blockTarget?.get?.("type") || component?.get?.("type") || ""}`.toLowerCase();
            lastSelectedTagRef.current = tag;
            const isFormField = formTags.has(tag);
            const isText = type === "text" || textTags.has(tag);
            const isImage = tag === "img";
            const isShape = isShapeLikeComponent(component) || isShapeLikeComponent(blockTarget);
            const isFloatingObject = isFreeformArrangeTarget(component) || isFreeformArrangeTarget(blockTarget);
            setBlockKind(isImage ? "image" : isShape ? "shape" : "block");

            if (typeof e.setDragMode === "function") {
              const useAbsoluteDrag = isShape || isFloatingObject;
              e.setDragMode(useAbsoluteDrag ? "absolute" : "translate");
            }
            if (isShape && blockTarget) {
              ensureShapeEditingCapabilities(blockTarget);
            } else if (getStackBoxRoot(blockTarget)) {
              ensureStackBoxEditingCapabilities(getStackBoxRoot(blockTarget));
            } else if (getBlankCanvasRoot(blockTarget)) {
              ensureBlankCanvasEditingCapabilities(blockTarget);
            } else if (blockTarget) {
              ensureForegroundLayer(blockTarget);
            }

            if (isImage) {
              if (!isFloatingObject) {
                normalizeInlineImagePlacement(blockTarget);
                normalizeImageBlockLayout(blockTarget);
              }
              // For image elements, stay in block panel but track image link
              const imageTarget = blockTarget || component;
              lastImageCompRef.current = imageTarget;
              const existingHref = imageTarget?.parent?.()?.get?.("tagName") === "a"
                ? (imageTarget.parent().getAttributes()?.href || "")
                : "";
              setImageLink(existingHref);
              selectedTextCompRef.current = null;
              selectedFormCompRef.current = null;
              setTextPanelOpen(false);
              setFormPanelOpen(false);
              return;
            }

            if (isFormField) {
              selectedFormCompRef.current = component;
              lastFormCompRef.current = component;
              setFormControls(extractFormControlsFromComponent(component));
              setFormPanelOpen(true);
              selectedTextCompRef.current = null;
              setTextPanelOpen(false);
              return;
            }

            selectedFormCompRef.current = null;
            setFormPanelOpen(false);

            if (!isText) {
              selectedTextCompRef.current = null;
              setTextPanelOpen(false);
              return;
            }

            selectedTextCompRef.current = component;
            lastTextCompRef.current = component;
            setTextControls(extractTextControlsFromComponent(component));
            setTextPanelOpen(true);
          } catch {
            // Keep the editor usable even if a component has unexpected style values.
            selectedTextCompRef.current = null;
            selectedFormCompRef.current = null;
            setTextPanelOpen(false);
            setFormPanelOpen(false);
          }
        });

        e.on("component:update", (component) => {
          if (imageNormalizeInFlightRef.current) return;

          const imageTarget = findNestedImageComponent(component);
          if (!imageTarget || isFreeformArrangeTarget(imageTarget)) return;

          imageNormalizeInFlightRef.current = true;
          const syncImageState = () => {
            try {
              normalizeInlineImagePlacement(imageTarget);
              normalizeImageBlockLayout(imageTarget);

              const selectedImage = getSelectedImageComponent();
              if (selectedImage === imageTarget) {
                const liveControls = extractBlockControlsFromComponent(imageTarget);
                setBlockControls((prev) => ({ ...prev, ...liveControls }));
                selectedCompRef.current = imageTarget;
                lastBlockCompRef.current = imageTarget;
                lastImageCompRef.current = imageTarget;
                lastSelectedTagRef.current = "img";
              }

              if (typeof e.refresh === "function") {
                requestAnimationFrame(() => e.refresh());
              }
            } finally {
              requestAnimationFrame(() => {
                imageNormalizeInFlightRef.current = false;
              });
            }
          };

          if (typeof window !== "undefined") {
            requestAnimationFrame(syncImageState);
          } else {
            syncImageState();
          }
        });

        e.on("component:deselected", () => {
          // Clear current refs but keep last* refs so right-panel controls can
          // still apply changes even after the canvas loses focus on button click.
          selectedCompRef.current = null;
          selectedTextCompRef.current = null;
          selectedFormCompRef.current = null;
          // Don't close panels or clear lastRefs — buttons in the right panel
          // need the last refs to remain valid when clicked.
        });

        // Blocks — load all professional sections from funnelSections.js
        const bm = e.BlockManager;
        for (const s of SECTION_BLOCKS) {
          try {
            const blockHtml = s?.html?.();
            if (!blockHtml || typeof blockHtml !== "string") continue;
            bm.add(s.id, { label: s.label, category: s.category, content: blockHtml });
          } catch {
            // Skip invalid templates so one bad block can't break the editor.
          }
        }
        // Add Text, Image, and Code blocks with large icons above text
        bm.add("raw-text", {
          label: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
            <span style="font-size:2.2em;line-height:1;">📝</span>
            <span style="font-size:1.1em;">Text Block</span>
          </div>`,
          category: "🔧 Layout",
          content: `<div style="font-family:system-ui,sans-serif;padding:0;background:transparent;max-width:900px;margin:0 auto;"><p style="color:#374151;font-size:18px;line-height:1.7;margin:0;">Your text here…</p></div>`,
        });
        bm.add("raw-image", {
          label: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
            <span style="font-size:2.2em;line-height:1;">🖼️</span>
            <span style="font-size:1.1em;">Image</span>
          </div>`,
          category: "🔧 Layout",
          content: `<div style="padding:24px;background:#fff;display:flex;justify-content:center;align-items:center;overflow:visible;"><img src="" alt="" style="display:block;width:100%;max-width:100%;height:auto;margin:0 auto;border-radius:12px;object-fit:contain;"/></div>`,
        });
        bm.add("content-stack-box", {
          label: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
            <span style="font-size:2.2em;line-height:1;">🗂️</span>
            <span style="font-size:1.05em;">Stack Box</span>
          </div>`,
          category: "🔧 Layout",
          content: {
            type: "default",
            tagName: "div",
            attributes: { "data-stack-box": "true" },
            style: {
              position: "relative",
              width: "100%",
              "max-width": "1000px",
              margin: "0 auto",
              "min-height": "560px",
              padding: "24px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              "border-radius": "24px",
              overflow: "visible",
              "box-shadow": "0 18px 40px rgba(15,23,42,0.08)",
            },
            components: [
              createFunnelStackImageLayer(0),
              createFunnelStackTextLayer(0),
              createFunnelStackImageLayer(1),
            ],
          },
        });
        bm.add("raw-code", {
          label: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
            <span style="font-size:2.2em;line-height:1;">💻</span>
            <span style="font-size:1.1em;">Code Block</span>
          </div>`,
          category: "🔧 Layout",
          content: `<pre style="background:#18181b;color:#f4f4f5;padding:18px 20px;border-radius:10px;font-size:15px;overflow:auto;">// Your code here\nconsole.log('Hello, world!');</pre>`,
        });
        bm.add("blank-canvas", {
          label: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
            <span style="font-size:2.2em;line-height:1;">🧱</span>
            <span style="font-size:1.1em;">Blank Canvas</span>
          </div>`,
          category: "🔧 Layout",
          content: `<section data-blank-canvas-root="true" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;position:relative;min-height:560px;padding:72px 24px;background:linear-gradient(135deg,#0f172a,#1e293b);overflow:hidden;">
            <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,23,42,0.18),rgba(15,23,42,0.44));"></div>
            <div data-blank-canvas-stage="true" style="position:relative;z-index:1;max-width:1120px;margin:0 auto;min-height:416px;border:none;border-radius:28px;padding:36px;display:flex;align-items:center;justify-content:center;text-align:center;">
              <div style="max-width:620px;">
                <p style="margin:0 0 12px;color:#f8fafc;font-size:34px;line-height:1.1;font-weight:800;">Blank Canvas Section</p>
                <p style="margin:0;color:rgba(255,255,255,0.78);font-size:18px;line-height:1.7;">Use the block editor to add a background image on this section, drop in shapes for overlays, and place text blocks exactly where you want them.</p>
              </div>
            </div>
            <div data-editor-only="true" data-blank-canvas-handle="true" style="position:absolute;left:50%;bottom:10px;transform:translateX(-50%);z-index:3;background:rgba(15,23,42,0.86);color:#e2e8f0;border:1px solid rgba(148,163,184,0.38);border-radius:999px;padding:8px 14px;cursor:ns-resize;font-size:12px;font-weight:800;letter-spacing:0.04em;user-select:none;box-shadow:0 10px 24px rgba(2,6,23,0.28);">Drag to resize</div>
          </section>`,
        });
        const SHAPE_CATEGORY = "🎨 Shapes";
        bm.add("shape-block", {
          label: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;"><span style="font-size:2.2em;line-height:1;">⬛</span><span style="font-size:1.05em;">Rounded Box</span></div>`,
          category: SHAPE_CATEGORY,
          content: createShapeComponent(),
        });
        bm.add("shape-circle", {
          label: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;"><span style="font-size:2.2em;line-height:1;">⚪</span><span style="font-size:1.05em;">Circle</span></div>`,
          category: SHAPE_CATEGORY,
          content: createShapeComponent({ "border-radius": "999px" }),
        });
        bm.add("shape-pill", {
          label: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;"><span style="font-size:2.2em;line-height:1;">▬</span><span style="font-size:1.05em;">Pill</span></div>`,
          category: SHAPE_CATEGORY,
          content: createShapeComponent({ width: "240px", height: "72px", "border-radius": "999px" }),
        });
        bm.add("shape-diamond", {
          label: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;"><span style="font-size:2.2em;line-height:1;">🔷</span><span style="font-size:1.05em;">Diamond</span></div>`,
          category: SHAPE_CATEGORY,
          content: createShapeComponent({ transform: "rotate(45deg)" }),
        });
        bm.add("shape-triangle", {
          label: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;"><span style="font-size:2.2em;line-height:1;">🔺</span><span style="font-size:1.05em;">Triangle</span></div>`,
          category: SHAPE_CATEGORY,
          content: createShapeComponent({ width: "150px", height: "130px", "clip-path": "polygon(50% 0%, 0% 100%, 100% 100%)" }),
        });
        bm.add("shape-star", {
          label: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;"><span style="font-size:2.2em;line-height:1;">⭐</span><span style="font-size:1.05em;">Star</span></div>`,
          category: SHAPE_CATEGORY,
          content: createShapeComponent({ "clip-path": "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)", "border-radius": "0", border: "none" }),
        });
        bm.add("shape-hexagon", {
          label: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;"><span style="font-size:2.2em;line-height:1;">⬢</span><span style="font-size:1.05em;">Hexagon</span></div>`,
          category: SHAPE_CATEGORY,
          content: createShapeComponent({ "clip-path": "polygon(25% 6.7%, 75% 6.7%, 100% 50%, 75% 93.3%, 25% 93.3%, 0% 50%)" }),
        });
        bm.add("shape-arrow", {
          label: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;"><span style="font-size:2.2em;line-height:1;">➡️</span><span style="font-size:1.05em;">Arrow</span></div>`,
          category: SHAPE_CATEGORY,
          content: createShapeComponent({ width: "220px", height: "90px", "clip-path": "polygon(0 35%, 65% 35%, 65% 10%, 100% 50%, 65% 90%, 65% 65%, 0 65%)", "border-radius": "0", border: "none" }),
        });
        bm.add("shape-ring", {
          label: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;"><span style="font-size:2.2em;line-height:1;">⭕</span><span style="font-size:1.05em;">Ring</span></div>`,
          category: SHAPE_CATEGORY,
          content: createShapeComponent({ "border-radius": "999px", background: "transparent", "background-color": "transparent", border: "14px solid #60a5fa" }),
        });
        bm.add("shape-line", {
          label: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;"><span style="font-size:2.2em;line-height:1;">➖</span><span style="font-size:1.05em;">Line</span></div>`,
          category: SHAPE_CATEGORY,
          content: createShapeComponent({ width: "260px", height: "12px", "border-radius": "999px" }),
        });
        bm.add("shape-bubble", {
          label: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;"><span style="font-size:2.2em;line-height:1;">💬</span><span style="font-size:1.05em;">Bubble</span></div>`,
          category: SHAPE_CATEGORY,
          content: createShapeComponent({ width: "180px", height: "130px", "border-radius": "36px", "clip-path": "polygon(0 0, 100% 0, 100% 78%, 60% 78%, 44% 100%, 40% 78%, 0 78%)", border: "none" }),
        });
        bm.add("shape-blob", {
          label: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;"><span style="font-size:2.2em;line-height:1;">🫧</span><span style="font-size:1.05em;">Blob</span></div>`,
          category: SHAPE_CATEGORY,
          content: createShapeComponent({ "border-radius": "58% 42% 63% 37% / 41% 53% 47% 59%" }),
        });

        // Asset Manager → Supabase /assets/<userId>/*
        e.on("asset:upload:start", () => {}); // not used
        await loadSupabaseAssetsIntoGrapes(e, session?.user?.id);

        editorRef.current = e;
        setEditorReady(true);

        // Ensure panels/canvas layout is measured after mount.
        if (typeof e.refresh === "function") {
          requestAnimationFrame(() => e.refresh());
        }

        // First mount can race with Grapes canvas boot. Re-apply only if user
        // is still on the same step so we don't clobber later navigation.
        const initialStepId = activeStepIdRef.current;
        requestAnimationFrame(() => {
          if (activeStepIdRef.current === initialStepId) {
            applyActiveStepToEditor(initialStepId);
          }
        });
        setTimeout(() => {
          if (activeStepIdRef.current === initialStepId) {
            applyActiveStepToEditor(initialStepId);
          }
        }, 140);
      } catch (err) {
        setEditorReady(false);
        setEditorError(err?.message || "Could not initialize page editor.");
      } finally {
        editorInitializingRef.current = false;
      }
    };

    init();
  }, [loading, id, session?.user?.id, editorInitKey]);

  // Keep editor content in sync with current steps + active step.
  useEffect(() => {
    if (!editorReady) return;
    applyActiveStepToEditor(activeStepId);
  }, [editorReady, activeStepId, steps]);

  function slugify(s) {
    return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function getActiveStepPublicUrl(options = {}) {
    const { device = "desktop", canvasWidthOverride = null } = options;
    const slug = `${funnel?.slug || "preview"}`.trim() || "preview";
    const idx = Math.max(0, steps.findIndex((s) => s.id === activeStepId));
    const params = new URLSearchParams({ step: `${idx + 1}` });
    if (funnel?.id) {
      params.set("preview", "1");
      params.set("funnelId", funnel.id);
      const measuredCanvasWidth = Math.round(
        editorRef.current?.Canvas?.getFrameEl?.()?.parentElement?.clientWidth
        || editorRef.current?.Canvas?.getFrameEl?.()?.clientWidth
        || editorDivRef.current?.clientWidth
        || 0
      );
      const canvasWidth = Number.isFinite(Number(canvasWidthOverride)) && Number(canvasWidthOverride) > 0
        ? Math.round(Number(canvasWidthOverride))
        : measuredCanvasWidth;
      if (canvasWidth > 0) {
        params.set("canvasWidth", `${canvasWidth}`);
      }
      if (device && device !== "desktop") {
        params.set("device", device);
      }
    }
    return `/p/${slug}?${params.toString()}`;
  }

  function getPublishedFunnelPath() {
    const normalizedSlug = slugify((funnel?.slug || "").trim() || funnel?.name || "");
    return normalizedSlug ? `/p/${normalizedSlug}` : "";
  }

  function getPublishedFunnelUrl() {
    const path = getPublishedFunnelPath();
    if (!path) return "";
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }

  async function copyPublishedUrl() {
    const url = getPublishedFunnelUrl();
    if (!url) return alert("Add a funnel name or slug first.");
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        alert("Public URL copied.");
        return;
      }
    } catch {}
    alert(url);
  }

  async function saveBasics() {
    if (!funnel) return;
    setSavingBasics(true);
    const normalizedSlug = slugify((funnel.slug || "").trim());
    const payload = {
      name: funnel.name || "",
      description: funnel.description || "",
      slug: normalizedSlug || null,
      notify_email: notifyEmail || null,
      default_list_id: defaultListId || null,
    };
    const { error } = await supabase.from("funnels").update(payload).eq("id", funnel.id);
    setSavingBasics(false);
    if (error) {
      if (/duplicate key|slug/i.test(error.message)) return alert("Slug already in use. Pick another.");
      return alert(error.message);
    }
    setFunnel((prev) => ({ ...prev, slug: payload.slug || "" }));
    alert("Saved.");
  }

  async function publish() {
    if (!funnel) return;
    const slug = slugify((funnel.slug || "").trim() || funnel.name || "");
    if (!slug) return alert("Add a funnel name or slug first, then publish.");
    setPublishing(true);
    const { error } = await supabase.from("funnels").update({ status: "published", slug }).eq("id", funnel.id);
    setPublishing(false);
    if (error) return alert(error.message);
    setFunnel({ ...funnel, status: "published", slug });
    const publicUrl = typeof window === "undefined" ? `/p/${slug}` : `${window.location.origin}/p/${slug}`;
    alert(`Published.\n${publicUrl}`);
  }

  async function unpublish() {
    if (!confirm("Unpublish this funnel?")) return;
    const { error } = await supabase.from("funnels").update({ status: "draft" }).eq("id", funnel.id);
    if (error) return alert(error.message);
    setFunnel({ ...funnel, status: "draft" });
  }

  async function removeFunnel() {
    if (!confirm("Delete this funnel?")) return;
    const { error } = await supabase.from("funnels").delete().eq("id", funnel.id);
    if (error) return alert(error.message);
    window.location.href = "/modules/funnels";
  }

  function addLocalStep(title = "Step") {
    const tmpId = `tmp_${Date.now()}`;
    const newStep = { id: tmpId, title, content: "", order_index: steps.length, _tmp: true };
    setSteps((prev) => [...prev, newStep]);
    setActiveStepId(tmpId);
    editorRef.current?.setComponents(blankHTML());
    setShowPicker(true);
  }

  async function ensureActiveStepExists() {
    const existing = steps.find((s) => s.id === activeStepId) || steps[0] || null;
    if (existing) {
      if (!activeStepId && existing.id) setActiveStepId(existing.id);
      return existing;
    }

    const firstPage = {
      funnel_id: id,
      title: "Page 1",
      content: blankHTML(),
      order_index: 0,
    };

    const ins = await supabase.from("funnel_steps").insert(firstPage).select("*").single();
    if (ins.error) throw ins.error;

    setSteps([ins.data]);
    setActiveStepId(ins.data.id);
    return ins.data;
  }

  async function deleteStep(stepId) {
    const step = steps.find((s) => s.id === stepId);
    if (!step) return;
    if (!confirm("Delete this step?")) return;

    if (step._tmp) {
      const next = steps.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, order_index: i }));
      setSteps(next);
      setActiveStepId(next[0]?.id || null);
      return;
    }

    const { error } = await supabase.from("funnel_steps").delete().eq("id", stepId);
    if (error) return alert(error.message);
    const next = steps.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, order_index: i }));
    setSteps(next);
    setActiveStepId(next[0]?.id || null);
    await Promise.all(next.map((s, i) => supabase.from("funnel_steps").update({ order_index: i }).eq("id", s.id)));
  }

  async function saveActiveStep(options = {}) {
    const { silent = false } = options;
    const e = editorRef.current;
    if (!e || !funnel?.id) return false;

    let step = steps.find((s) => s.id === activeStepId) || null;

    try {
      if (!step) {
        step = await ensureActiveStepExists();
      }
      if (!step) throw new Error("Could not create the first page.");

      normalizeImageBlocksInTree(e.getWrapper?.());
      normalizeAbsoluteComponentForSave(e.getWrapper?.());
      normalizeSectionAnchoredShapesForSave(e.getWrapper?.());
      normalizeShapeLayeringForSave(e.getWrapper?.());
      normalizeResponsiveShapeMetricsForSave(e.getWrapper?.());
      if (typeof e.refresh === "function") {
        e.refresh();
      }

      const html = stripEditorOnlyMarkup(e.getHtml());
      const css = e.getCss();
      const combined = injectHiddenFields(inlineHTML(html, css), {
        funnel_id: funnel.id,
        step_id: step._tmp ? "" : step.id,
        list_id: defaultListId || "",
        notify_to: notifyEmail || "",
        success_url: `/p/${(funnel.slug || "preview").trim() || "preview"}?ok=1`,
      });

      if (step._tmp) {
        const ins = await supabase
          .from("funnel_steps")
          .insert({
            funnel_id: id,
            title: step.title || "Page",
            content: combined,
            order_index: step.order_index,
          })
          .select("*")
          .single();
        if (ins.error) throw ins.error;

        const finalHtml = combined.replace(/name="step_id" value=""/g, `name="step_id" value="${ins.data.id}"`);
        const stepUpdate = await supabase.from("funnel_steps").update({ content: finalHtml }).eq("id", ins.data.id);
        if (stepUpdate.error) throw stepUpdate.error;

        setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...ins.data, content: finalHtml } : s)));
        setActiveStepId(ins.data.id);
      } else {
        const finalHtml = combined.replace(new RegExp(`name="step_id" value="${step.id}"`, "g"), `name="step_id" value="${step.id}"`);
        const upd = await supabase.from("funnel_steps").update({ content: finalHtml }).eq("id", step.id);
        if (upd.error) throw upd.error;
        setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, content: finalHtml } : s)));
      }

      if (!silent) alert("Page saved.");
      return true;
    } catch (e) {
      if (!silent) alert(e.message || "Save failed");
      return false;
    }
  }

  async function handleViewPage(options = {}) {
    const saved = await saveActiveStep({ silent: true });
    if (!saved) {
      alert("Please save the page first.");
      return;
    }
    window.open(getActiveStepPublicUrl(options), "_blank", "noopener,noreferrer");
  }

  async function uploadImageFile(file, mode = "insert") {
    if (!file) return;
    if (!session?.user?.id) {
      alert("You need to be logged in to upload images.");
      return;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${session.user.id}/funnels/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("assets").upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });
    if (error) {
      alert(error.message || "Image upload failed.");
      return;
    }

    const { data } = supabase.storage.from("assets").getPublicUrl(path);
    const publicUrl = data?.publicUrl;
    if (!publicUrl) {
      alert("Could not resolve uploaded image URL.");
      return;
    }

    const editor = editorRef.current;
    if (editor) {
      await loadSupabaseAssetsIntoGrapes(editor, session?.user?.id);
      insertImageUrlIntoEditor(publicUrl, mode, file.name);
    }
  }

  async function persistExternalImageToAssets(sourceUrl, fileName = "AI-generated image") {
    if (!sourceUrl || !session?.user?.id) return { publicUrl: sourceUrl, persisted: false };

    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error("Could not download generated image");

      const blob = await response.blob();
      const safeBaseName = `${fileName || "AI-generated image"}`
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/(^-|-$)/g, "") || "ai-generated-image";
      const extension = (blob.type || "image/png").split("/")[1] || "png";
      const storagePath = `${session.user.id}/funnels/${Date.now()}-${safeBaseName}.${extension}`;
      const { error } = await supabase.storage.from("assets").upload(storagePath, blob, {
        upsert: true,
        contentType: blob.type || "image/png",
      });
      if (error) throw error;

      const { data } = supabase.storage.from("assets").getPublicUrl(storagePath);
      return { publicUrl: data?.publicUrl || sourceUrl, persisted: true };
    } catch (error) {
      console.warn("Could not persist generated image to assets bucket", error);
      return { publicUrl: sourceUrl, persisted: false };
    }
  }

  function openMediaLibrary() {
    const editor = editorRef.current;
    if (!editor) return;

    const selected = editor.getSelected?.() || selectedCompRef.current || lastBlockCompRef.current || null;
    if (typeof editor.AssetManager?.open === "function") {
      editor.AssetManager.open({ target: selected || undefined });
      return;
    }
    if (typeof editor.runCommand === "function") {
      editor.runCommand("open-assets", { target: selected || undefined });
    }
  }

  function getSelectedImageComponent() {
    const component = editorRef.current?.getSelected?.() || lastImageCompRef.current || lastBlockCompRef.current || null;
    return findNestedImageComponent(component);
  }

  function syncImageComponentSource(component, publicUrl, fileName = "Image") {
    if (!component || !publicUrl) return false;

    try {
      component.set?.("src", publicUrl);
    } catch {
      // ignore model setter differences across GrapesJS image component versions
    }

    component.addAttributes?.({ src: publicUrl, alt: fileName });

    try {
      const attrs = component.getAttributes?.() || {};
      component.setAttributes?.({ ...attrs, src: publicUrl, alt: fileName });
    } catch {
      // ignore if component does not expose setAttributes
    }

    try {
      const el = component.view?.el;
      if (el) {
        el.setAttribute("src", publicUrl);
        el.setAttribute("alt", fileName);
      }
    } catch {
      // ignore DOM sync failures; model attrs above remain authoritative
    }

    return true;
  }

  function replaceSelectedImageSource(publicUrl, fileName = "Image") {
    const editor = editorRef.current;
    const target = getSelectedImageComponent();
    if (!editor || !target || !publicUrl) return false;

    syncImageComponentSource(target, publicUrl, fileName);
    editor.select?.(target);
    selectedCompRef.current = target;
    lastBlockCompRef.current = target;
    lastSelectedTagRef.current = "img";
    setBlockKind("image");
    setBlockPanelOpen(true);
    return true;
  }

  function normalizeInlineImagePlacement(component) {
    if (!component || isFreeformArrangeTarget(component)) return;

    component.addStyle?.({
      display: "block",
      float: "none",
      position: "relative",
      visibility: "visible",
      left: "auto",
      top: "auto",
      right: "auto",
      bottom: "auto",
      "margin-left": "auto",
      "margin-right": "auto",
      "max-width": "100%",
      "box-sizing": "border-box",
    });
  }

  function applyImageControlsPatch(patch = {}) {
    const component = getSelectedImageComponent();
    if (!component) return;

    const liveControls = extractBlockControlsFromComponent(component);
    const next = { ...liveControls, ...patch };
    const safeWidth = parseInt(`${next.width || liveControls.width || "0"}`, 10);
    const safeHeight = parseInt(`${next.height || liveControls.height || "0"}`, 10);
    const safeOpacity = Math.max(0, Math.min(100, parseInt(`${next.opacity || liveControls.opacity || "100"}`, 10) || 100));
    const safeRadius = Math.max(0, parseInt(`${next.borderRadius || liveControls.borderRadius || "0"}`, 10) || 0);
    const safeOffsetX = parseInt(`${next.offsetX || liveControls.offsetX || "0"}`, 10) || 0;
    const safeOffsetY = parseInt(`${next.offsetY || liveControls.offsetY || "0"}`, 10) || 0;
    const safeZIndex = Math.max(0, parseInt(`${next.zIndex || liveControls.zIndex || "0"}`, 10) || 0);
    const isFloatingImage = isFreeformArrangeTarget(component);

    setBlockControls((prev) => ({
      ...prev,
      ...next,
      opacity: `${safeOpacity}`,
      borderRadius: `${safeRadius}`,
      offsetX: `${safeOffsetX}`,
      offsetY: `${safeOffsetY}`,
      zIndex: `${safeZIndex}`,
    }));

    const stylePatch = {
      width: Number.isFinite(safeWidth) && safeWidth > 0 ? `${safeWidth}px` : "auto",
      opacity: `${safeOpacity / 100}`,
      "border-radius": `${safeRadius}px`,
      display: "block",
      "box-sizing": "border-box",
      "max-width": isFloatingImage ? "none" : "100%",
    };

    if (Number.isFinite(safeHeight) && safeHeight > 0) {
      stylePatch.height = `${safeHeight}px`;
    } else if (Object.prototype.hasOwnProperty.call(patch, "height")) {
      stylePatch.height = "auto";
    }

    if (isFloatingImage) {
      stylePatch.position = "absolute";
      stylePatch.left = `${safeOffsetX}px`;
      stylePatch.top = `${safeOffsetY}px`;
      stylePatch["z-index"] = `${safeZIndex}`;
      ensureAbsolutePlacement(component);
    } else {
      stylePatch.float = "none";
      stylePatch.left = "auto";
      stylePatch.top = "auto";
      stylePatch.right = "auto";
      stylePatch.bottom = "auto";
      normalizeInlineImagePlacement(component);
    }

    component.addStyle?.(stylePatch);
    if (typeof editorRef.current?.refresh === "function") {
      requestAnimationFrame(() => editorRef.current.refresh());
    }
  }

  function applyImageAlignment(alignment = "center") {
    const component = getSelectedImageComponent();
    if (!component || isFreeformArrangeTarget(component)) return;

    const stylePatch = {
      display: "block",
      float: "none",
    };

    if (alignment === "left") {
      stylePatch["margin-left"] = "0";
      stylePatch["margin-right"] = "auto";
    } else if (alignment === "right") {
      stylePatch["margin-left"] = "auto";
      stylePatch["margin-right"] = "0";
    } else {
      stylePatch["margin-left"] = "auto";
      stylePatch["margin-right"] = "auto";
    }

    component.addStyle?.(stylePatch);
    if (typeof editorRef.current?.refresh === "function") {
      requestAnimationFrame(() => editorRef.current.refresh());
    }
  }

  function insertFloatingImageComponent(hostComponent, publicUrl, fileName) {
    if (!hostComponent || !publicUrl) return null;

    hostComponent.addStyle?.({ position: "relative" });
    const added = hostComponent.components().add({
      type: "image",
      tagName: "img",
      attributes: {
        src: publicUrl,
        alt: fileName,
        "data-floating-image": "true",
      },
      style: {
        position: "absolute",
        left: "24px",
        top: "24px",
        width: "320px",
        height: "auto",
        display: "block",
        "max-width": "none",
        cursor: "move",
        margin: "0",
        "z-index": "2",
        "border-radius": "12px",
        "box-shadow": "0 10px 30px rgba(15,23,42,0.18)",
      },
    }, { at: 0 });
    const imageComp = Array.isArray(added) ? added[0] : added;
    if (imageComp) {
      ensureAbsolutePlacement(imageComp);
      selectedCompRef.current = imageComp;
      lastBlockCompRef.current = imageComp;
      lastSelectedTagRef.current = "img";
      setBlockKind("image");
      setImageLink("");
      setBlockPanelOpen(true);
    }
    return imageComp;
  }

  function resolveImageInsertTarget() {
    const editor = editorRef.current;
    const wrapper = editor?.getWrapper?.() || null;
    const selected = editor?.getSelected?.() || selectedCompRef.current || lastBlockCompRef.current || wrapper || null;
    if (!selected) return { mode: "floating", component: wrapper };

    if (selected.is?.("image")) {
      return { mode: "replace", component: selected };
    }

    const blankCanvasRoot = getBlankCanvasRoot(selected);
    if (blankCanvasRoot) {
      let stage = null;
      blankCanvasRoot.components?.().forEach?.((child) => {
        if (stage) return;
        const attrs = child.getAttributes?.() || {};
        if (`${attrs["data-blank-canvas-stage"] || ""}`.toLowerCase() === "true") {
          stage = child;
        }
      });
      return { mode: "floating", component: stage || blankCanvasRoot };
    }

    if (isFreeformArrangeTarget(selected)) {
      return { mode: "floating", component: selected.parent?.() || selected };
    }

    let cursor = selected;
    while (cursor) {
      const tag = `${cursor?.get?.("tagName") || ""}`.toLowerCase();
      const type = `${cursor?.get?.("type") || ""}`.toLowerCase();
      const isTextLike = ["p", "span", "a", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "small", "label", "button"].includes(tag) || type === "text";
      const isFormLike = ["input", "textarea", "select", "option"].includes(tag);
      const hasChildren = typeof cursor?.components === "function";
      if (!isTextLike && !isFormLike && hasChildren) {
        return { mode: "floating", component: cursor };
      }
      cursor = cursor.parent?.() || null;
    }

    return { mode: "floating", component: selected.parent?.() || wrapper || selected };
  }

  function insertImageUrlIntoEditor(publicUrl, mode = "insert", fileName = "Generated image") {
    const editor = editorRef.current;
    if (!editor || !publicUrl) return;

    editor.AssetManager.add([{ src: publicUrl, name: fileName }]);

    if (mode === "background" && selectedCompRef.current) {
      applyBackgroundImageUrl(publicUrl);
    } else if (mode === "replace") {
      const replaced = replaceSelectedImageSource(publicUrl, fileName);
      if (!replaced) {
        const insertTarget = resolveImageInsertTarget();
        if (insertTarget?.mode === "replace" && insertTarget.component) {
          syncImageComponentSource(insertTarget.component, publicUrl, fileName);
          editor.select?.(insertTarget.component);
        } else {
          const hostComponent = insertTarget?.component || editor.getWrapper?.() || null;
          const imageComp = insertFloatingImageComponent(hostComponent, publicUrl, fileName);
          if (imageComp) {
            editor.select?.(imageComp);
          }
        }
      }
    } else {
      const insertTarget = resolveImageInsertTarget();
      if (insertTarget?.mode === "replace" && insertTarget.component) {
        syncImageComponentSource(insertTarget.component, publicUrl, fileName);
        editor.select?.(insertTarget.component);
      } else {
        const hostComponent = insertTarget?.component || editor.getWrapper?.() || null;
        const imageComp = insertFloatingImageComponent(hostComponent, publicUrl, fileName);
        if (imageComp) {
          editor.select?.(imageComp);
        }
      }
    }

    if (typeof editor.refresh === "function") {
      requestAnimationFrame(() => editor.refresh());
    }
  }

  async function generateAiImage(mode = "insert") {
    const prompt = `${aiImagePrompt || ""}`.trim();
    if (!prompt) {
      alert("Type an image description in the 'Image prompt' box first, then click Generate. Example: 'glowing pink diamond shape background'.");
      return;
    }

    setAiImageStatus("");
    setAiImageLoading(true);
    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          size: aiImageSize,
          style: aiImageStyle,
          userId: session?.user?.id || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok || !json?.url) {
        throw new Error(json?.error || "AI image generation failed");
      }

      const savedAsset = await persistExternalImageToAssets(json.url, prompt.slice(0, 48) || "AI-generated image");
      const savedUrl = savedAsset?.publicUrl || json.url;
      if (savedAsset?.persisted && editorRef.current) {
        await loadSupabaseAssetsIntoGrapes(editorRef.current, session?.user?.id);
      }

      insertImageUrlIntoEditor(savedUrl, mode, "AI-generated image");
      if (mode === "background") {
        setBlockControls((prev) => ({ ...prev, backgroundImage: savedUrl }));
      }
      setAiImageStatus(
        savedAsset?.persisted
          ? "Saved to Assets and added to your media library. Use Open Media Library to reuse it later."
          : "Inserted on the page. It could not be saved to Assets, so it may not appear in your media library yet."
      );
    } catch (e) {
      setAiImageStatus("");
      alert(e?.message || "Could not generate image.");
    } finally {
      setAiImageLoading(false);
    }
  }

  async function handleImageImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await uploadImageFile(file, imageUploadMode);
    setImageUploadMode("insert");
  }

  function openTemplateGallery() {
    setShowPicker(true);
  }

  // UI
  if (loading) return <Gate>Loading…</Gate>;
  if (!funnel) return <Gate>Not found.</Gate>;

  // Clipboard for block copy-paste

  // --- Improved: Copy/Paste full GrapesJS component JSON ---

  // Helper: Recursively inline all computed styles into the component JSON
  function inlineAllStyles(comp, doc) {
    if (!comp || !doc) return;
    const el = comp.view?.el;
    if (el && el.nodeType === 1) {
      const computed = doc.defaultView.getComputedStyle(el);
      let styleStr = "";
      for (let i = 0; i < computed.length; ++i) {
        const key = computed[i];
        styleStr += `${key}:${computed.getPropertyValue(key)};`;
      }
      comp.addStyle(styleStr);
    }
    // Recursively apply to children
    if (comp.components) {
      comp.components().forEach(child => inlineAllStyles(child, doc));
    }
  }

  async function handleCopyBlock() {
    const e = editorRef.current;
    if (!e) return;
    const selected = e.getSelected();
    if (!selected) return alert("Select a block to copy.");
    // Inline all computed styles into the component tree
    try {
      const doc = window.document;
      inlineAllStyles(selected, doc);
    } catch {}
    // Serialize the selected block/component as JSON
    const json = selected.toJSON ? selected.toJSON() : null;
    if (!json) return alert("Could not copy block data.");
    try {
      await navigator.clipboard.writeText(JSON.stringify({__GJS_BLOCK__: true, data: json}));
      alert("Block copied! You can now paste it into any page.");
    } catch (err) {
      alert("Clipboard error: " + (err?.message || err));
    }
  }

  async function handlePasteBlock() {
    const e = editorRef.current;
    if (!e) return;
    let raw = "";
    try {
      raw = await navigator.clipboard.readText();
    } catch (err) {
      alert("Clipboard error: " + (err?.message || err));
      return;
    }
    let json = null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.__GJS_BLOCK__ && parsed.data) {
        json = parsed.data;
      }
    } catch {}
    if (!json) {
      alert("Clipboard does not contain a valid copied block.");
      return;
    }
    // Insert at selection or end
    const selected = e.getSelected();
    if (selected && selected.append) {
      selected.append(json);
    } else {
      e.addComponents(json);
    }
    alert("Block pasted!");
  }

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://unpkg.com" />
      </Head>

      <main style={wrap}>
        {/* ── BANNER ── */}
        <div style={{
          background: "linear-gradient(135deg, #1a3a6e 0%, #0f2247 100%)",
          borderRadius: 16, padding: "22px 28px",
          marginBottom: 28,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              background: "rgba(45,108,223,0.3)", borderRadius: "50%",
              width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <span style={{ fontSize: 28 }}>🧭</span>
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 48, fontWeight: 600, color: "#e6eef5", lineHeight: 1.1 }}>
                {funnel.name || "Untitled Funnel"}
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 18, color: "#94a3b8" }}>
                {funnel.status === "published" && funnel.slug
                  ? <span>Published at <a href={getPublishedFunnelPath()} target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>{getPublishedFunnelPath()}</a></span>
                  : "Draft — add a slug and publish when ready"}
              </p>
            </div>
          </div>
          <a href="/modules/funnels" style={{
            background: "rgba(255,255,255,0.08)", color: "#e6eef5",
            border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10,
            padding: "10px 22px", fontSize: 18, fontWeight: 600,
            textDecoration: "none", whiteSpace: "nowrap",
          }}>
            ← Back
          </a>
        </div>
        {/* Top / basics */}
        <div style={topRow}>
          <div style={{ flex: 1, display: "grid", gap: 8 }}>
            <input
              style={nameInput}
              placeholder="Funnel name"
              value={funnel.name || ""}
              onChange={(e) => setFunnel({ ...funnel, name: e.target.value })}
              onBlur={() => !funnel.slug && setFunnel((x) => ({ ...x, slug: slugify(x.name) }))}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                style={slugInput}
                placeholder="public-url-slug"
                value={funnel.slug || ""}
                onChange={(e) => setFunnel({ ...funnel, slug: slugify(e.target.value) })}
              />
              <button style={miniBtn} onClick={() => setFunnel((x) => ({ ...x, slug: slugify(x.name) }))}>
                Auto
              </button>
            </div>
            {(funnel.slug || funnel.name) ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ color: "#94a3b8", fontSize: 14 }}>
                  Public URL: <span style={{ color: "#60a5fa" }}>{getPublishedFunnelPath() || "Add a slug to publish"}</span>
                </span>
                {getPublishedFunnelPath() ? (
                  <>
                    <a href={getPublishedFunnelPath()} target="_blank" rel="noreferrer" style={miniLink}>
                      Open
                    </a>
                    <button style={miniBtn} onClick={copyPublishedUrl}>
                      Copy URL
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <label style={label}>Email list</label>
                <select
                  value={defaultListId || ""}
                  onChange={(e) => setDefaultListId(e.target.value || null)}
                  style={select}
                >
                  <option value="">(none)</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={label}>Notify email</label>
                <input
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="alerts@yourdomain.com"
                  style={textInput}
                />
              </div>
            </div>

            <textarea
              style={desc}
              placeholder="Description (optional)"
              value={funnel.description || ""}
              onChange={(e) => setFunnel({ ...funnel, description: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 160 }}>
            <button onClick={saveBasics} disabled={savingBasics} style={btn}>
              {savingBasics ? "Saving…" : "💾 Save"}
            </button>
            {funnel.status === "published" ? (
              <button onClick={unpublish} style={btnWarn}>⏸ Unpublish</button>
            ) : (
              <button onClick={publish} disabled={publishing} style={btnPrimary}>
                {publishing ? "Publishing…" : "🚀 Publish"}
              </button>
            )}
            <button onClick={removeFunnel} style={btnDanger}>🗑 Delete</button>
          </div>
        </div>

        {/* Steps */}
        <section>
          {steps.length === 0 ? (
            <Empty>No pages yet. Use the page toolbar above the canvas to add one.</Empty>
          ) : (
            <div style={stepsWrap}>
              <div style={{
                marginTop: 12,
                border: "1px solid #2b3650",
                borderRadius: 12,
                background: "linear-gradient(135deg, #121e33 0%, #0f1727 100%)",
                padding: 12,
                display: "grid",
                gap: 8,
              }}>
                <div style={{ color: "#93c5fd", fontSize: 13, fontWeight: 700 }}>DALL-E Icon/Image Generator</div>
                <textarea
                  value={aiImagePrompt}
                  onChange={(e) => {
                    setAiImagePrompt(e.target.value);
                    if (aiImageStatus) setAiImageStatus("");
                  }}
                  placeholder="Describe the icon or image you want..."
                  style={{ ...ctlTextarea, minHeight: 70 }}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={ctlLabel}>Style</label>
                    <select value={aiImageStyle} onChange={(e) => setAiImageStyle(e.target.value)} style={ctlInput}>
                      <option value="clean">Clean Graphic</option>
                      <option value="icon">Icon / Flat</option>
                      <option value="photo">Photo Real</option>
                    </select>
                  </div>
                  <div>
                    <label style={ctlLabel}>Size</label>
                    <select value={aiImageSize} onChange={(e) => setAiImageSize(e.target.value)} style={ctlInput}>
                      <option value="1024x1024">Square</option>
                      <option value="1536x1024">Landscape</option>
                      <option value="1024x1536">Portrait</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => generateAiImage("insert")}
                    disabled={aiImageLoading}
                    style={btnPrimary}
                  >
                    {aiImageLoading ? "Generating..." : "Generate + Insert"}
                  </button>
                  <button
                    type="button"
                    onClick={() => generateAiImage("background")}
                    disabled={aiImageLoading}
                    style={btn}
                  >
                    {aiImageLoading ? "Generating..." : "Generate for Background"}
                  </button>
                  <button type="button" onClick={openMediaLibrary} style={btn}>
                    Open Media Library
                  </button>
                </div>
                {aiImageStatus ? <div style={{ color: "#bfdbfe", fontSize: 12, lineHeight: 1.5 }}>{aiImageStatus}</div> : null}
              </div>
            </div>
          )}
        </section>

        {/* Builder */}
        <section style={builderSection}>
          <div style={panel}>
            <div style={panelTitle}>🖊 Page Editor</div>

            <div style={{
              display: "grid",
              gap: 10,
              marginBottom: 12,
              padding: 12,
              borderRadius: 12,
              background: "linear-gradient(135deg, #10192a 0%, #0d1522 100%)",
              border: "1px solid #24354f",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ color: "#93c5fd", fontSize: 13, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Pages
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={btn} onClick={() => addLocalStep("New page")}>+ New Page</button>
                  <button style={{ ...btn, borderColor: "#2d4a7a", background: "#152038", color: "#60a5fa" }} onClick={openTemplateGallery}>🎨 Templates</button>
                  <button onClick={saveActiveStep} style={btnPrimary}>💾 Save Page</button>
                  <button onClick={() => { setImageUploadMode("insert"); imageInputRef.current?.click(); }} style={btn}>🖼 Upload Image</button>
                  <a href="/assets" target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>📁 Media Library</a>
                  {funnel?.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleViewPage({ device: "desktop", canvasWidthOverride: 1500 })}
                        style={{
                          ...btn,
                          display: "inline-flex",
                          alignItems: "center",
                          background: "linear-gradient(135deg, #22c55e, #16a34a)",
                          borderColor: "#16a34a",
                          color: "#ffffff",
                          boxShadow: "0 4px 14px rgba(34,197,94,0.35)",
                        }}
                        title="Save and open a desktop-width preview of the current page"
                      >
                        🖥 Desktop Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewPage({ device: "mobile", canvasWidthOverride: 390 })}
                        style={{
                          ...btn,
                          display: "inline-flex",
                          alignItems: "center",
                          background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                          borderColor: "#1d4ed8",
                          color: "#ffffff",
                          boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
                        }}
                        title="Save and open a mobile-width preview of the current page"
                      >
                        📱 Mobile Preview
                      </button>
                    </>
                  ) : null}
                  <button onClick={() => deleteStep(activeStepId)} style={btnDanger} disabled={!activeStepId}>🗑 Delete Page</button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {steps.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveStepId(s.id);
                      applyActiveStepToEditor(s.id);
                    }}
                    style={{
                      ...pill,
                      background: s.id === activeStepId ? "#2d6cdf" : "#151a21",
                      color: s.id === activeStepId ? "#fff" : "#e6eef5",
                    }}
                  >
                    {i + 1}. {s.title || "Page"}{s._tmp ? " (unsaved)" : ""}
                  </button>
                ))}
              </div>
            </div>

            {editorError ? (
              <div style={{ border: "1px solid #4a1020", background: "#2d0d16", borderRadius: 12, padding: 14 }}>
                <p style={{ margin: 0, color: "#fecaca", fontSize: 15 }}>
                  Editor failed to load: {editorError}
                </p>
                <button
                  onClick={() => {
                    setEditorError("");
                    setEditorInitKey((k) => k + 1);
                  }}
                  style={{ ...btn, marginTop: 10 }}
                >
                  Retry editor load
                </button>
              </div>
            ) : (
              <div style={editorShell}>
                <div>
                  <div id="gjs-blocks" style={blocksPane} />
                </div>
                <div ref={editorDivRef} id="gjs" style={editorCanvas} />
                <div style={rightPaneWrap}>
                  <div style={rightPaneHead}>{formPanelOpen ? "Form Editor" : textPanelOpen ? "Text Editor" : blockPanelOpen ? (blockKind === "shape" ? "Shape Editor" : "Block Editor") : "Editor"}</div>
                  <div style={rightPane}>
                    {/* Block Copy/Paste Controls */}
                    {blockPanelOpen && (
                      <div style={{ display: "grid", gap: 10, marginBottom: 10 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button onClick={handleCopyBlock} style={{ ...btn, background: "#6366f1", color: "#fff" }}>Copy Block</button>
                          <button onClick={handlePasteBlock} style={{ ...btn, background: "#22c55e", color: "#fff" }}>Paste Block</button>
                        </div>

                        <div style={{ border: "1px solid #24354f", borderRadius: 10, padding: 10, display: "grid", gap: 8, background: "rgba(15,23,42,0.35)" }}>
                          <div style={{ color: "#93c5fd", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
                            Arrange & Group
                          </div>
                          {isFreeformArrangeTarget(lastBlockCompRef.current) ? (
                            <>
                              <div style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.5 }}>
                                Align the selected floating object, or add a few floating objects to a group and move them together.
                              </div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button type="button" style={ctlBtnGhost} onClick={addSelectedToGroup}>Add to Group</button>
                                <button type="button" style={ctlBtn} onClick={groupSelectedBlocks}>Group Marked ({groupSelectionCount})</button>
                                <button type="button" style={ctlBtnGhost} onClick={ungroupSelectedBlock}>Ungroup</button>
                                <button type="button" style={ctlBtnGhost} onClick={clearGroupSelection}>Clear</button>
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <button type="button" style={ctlBtnGhost} onClick={() => alignSelectedBlock("left")}>Left</button>
                                <button type="button" style={ctlBtnGhost} onClick={() => alignSelectedBlock("right")}>Right</button>
                                <button type="button" style={ctlBtnGhost} onClick={() => alignSelectedBlock("top")}>Top</button>
                                <button type="button" style={ctlBtnGhost} onClick={() => alignSelectedBlock("bottom")}>Bottom</button>
                                <button type="button" style={ctlBtnGhost} onClick={() => alignSelectedBlock("center-x")}>Center Horizontally</button>
                                <button type="button" style={ctlBtnGhost} onClick={() => alignSelectedBlock("center-y")}>Center Vertically</button>
                              </div>
                              <button type="button" style={ctlBtn} onClick={() => alignSelectedBlock("center-both")}>Center Both</button>
                            </>
                          ) : (
                            <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.5 }}>
                              Freeform arrange is available for shapes and grouped floating objects, not normal layout sections.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {formPanelOpen ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        <div style={rightHint}>Form field controls.</div>
                        {(["button", "label", "option", "textarea"].includes(formControls.tagName)) ? (
                          <div>
                            <label style={ctlLabel}>Text</label>
                            <textarea
                              value={formControls.content}
                              onChange={(e) => applyFormControlsPatch({ content: e.target.value })}
                              style={{ ...ctlTextarea, minHeight: 90 }}
                            />
                          </div>
                        ) : null}

                        {(["input", "textarea"].includes(formControls.tagName)) ? (
                          <div>
                            <label style={ctlLabel}>Placeholder</label>
                            <input
                              value={formControls.placeholder}
                              onChange={(e) => applyFormControlsPatch({ placeholder: e.target.value })}
                              style={ctlInput}
                            />
                          </div>
                        ) : null}

                        {(["input", "textarea"].includes(formControls.tagName)) ? (
                          <div>
                            <label style={ctlLabel}>Default Value</label>
                            <input
                              value={formControls.value}
                              onChange={(e) => applyFormControlsPatch({ value: e.target.value })}
                              style={ctlInput}
                            />
                          </div>
                        ) : null}

                        <div>
                          <label style={ctlLabel}>Field Name</label>
                          <input
                            value={formControls.name}
                            onChange={(e) => applyFormControlsPatch({ name: e.target.value })}
                            style={ctlInput}
                          />
                        </div>

                        {formControls.tagName === "input" ? (
                          <div>
                            <label style={ctlLabel}>Input Type</label>
                            <select
                              value={formControls.type}
                              onChange={(e) => applyFormControlsPatch({ type: e.target.value })}
                              style={ctlInput}
                            >
                              <option value="text">Text</option>
                              <option value="email">Email</option>
                              <option value="tel">Phone</option>
                              <option value="number">Number</option>
                              <option value="url">URL</option>
                              <option value="password">Password</option>
                            </select>
                          </div>
                        ) : null}

                        <div style={{ borderTop: "1px solid #2d4a7a", paddingTop: 10, marginTop: 10 }}>
                          <label style={ctlLabel}>Appearance</label>
                        </div>

                        <div style={ctlRow2}>
                          <div>
                            <label style={ctlLabel}>Text Color</label>
                            <input
                              type="color"
                              value={normalizeColorForPicker(formControls.color)}
                              onChange={(e) => applyFormControlsPatch({ color: e.target.value })}
                              style={ctlColor}
                            />
                          </div>
                          <div>
                            <label style={ctlLabel}>Background</label>
                            <input
                              type="color"
                              value={normalizeColorForPicker(formControls.backgroundColor)}
                              onChange={(e) => applyFormControlsPatch({ backgroundColor: e.target.value })}
                              style={ctlColor}
                            />
                          </div>
                        </div>

                        <div style={ctlRow2}>
                          <div>
                            <label style={ctlLabel}>Border Color</label>
                            <input
                              type="color"
                              value={normalizeColorForPicker(formControls.borderColor)}
                              onChange={(e) => applyFormControlsPatch({ borderColor: e.target.value })}
                              style={ctlColor}
                            />
                          </div>
                          <div>
                            <label style={ctlLabel}>Font Size</label>
                            <input
                              type="number"
                              min="10"
                              max="64"
                              value={formControls.fontSize}
                              onChange={(e) => applyFormControlsPatch({ fontSize: e.target.value })}
                              style={ctlInput}
                            />
                          </div>
                        </div>

                        <div style={ctlRow2}>
                          <div>
                            <label style={ctlLabel}>Weight</label>
                            <select
                              value={formControls.fontWeight}
                              onChange={(e) => applyFormControlsPatch({ fontWeight: e.target.value })}
                              style={ctlInput}
                            >
                              <option value="400">Normal (400)</option>
                              <option value="500">Medium (500)</option>
                              <option value="600">Semibold (600)</option>
                              <option value="700">Bold (700)</option>
                              <option value="800">Extra Bold (800)</option>
                            </select>
                          </div>
                          <div>
                            <label style={ctlLabel}>Border Radius</label>
                            <input
                              type="number"
                              min="0"
                              max="40"
                              value={formControls.borderRadius}
                              onChange={(e) => applyFormControlsPatch({ borderRadius: e.target.value })}
                              style={ctlInput}
                            />
                          </div>
                        </div>

                        <div style={ctlRow2}>
                          <div>
                            <label style={ctlLabel}>Padding Y</label>
                            <input
                              type="number"
                              min="0"
                              max="40"
                              value={formControls.paddingY}
                              onChange={(e) => applyFormControlsPatch({ paddingY: e.target.value })}
                              style={ctlInput}
                            />
                          </div>
                          <div>
                            <label style={ctlLabel}>Padding X</label>
                            <input
                              type="number"
                              min="0"
                              max="60"
                              value={formControls.paddingX}
                              onChange={(e) => applyFormControlsPatch({ paddingX: e.target.value })}
                              style={ctlInput}
                            />
                          </div>
                        </div>
                      </div>
                    ) : textPanelOpen ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        <label style={ctlLabel}>Text</label>
                        <textarea
                          value={textControls.content}
                          onChange={(e) => applyTextControlsPatch({ content: e.target.value })}
                          style={ctlTextarea}
                        />
                        <AIWriterAssist
                          value={textControls.content}
                          contextLabel={`funnel editor text for ${funnel?.name || "current funnel"}`}
                          placeholder="Tell AI what this text should say..."
                          compact
                          onApply={(text) => applyTextControlsPatch({ content: text })}
                        />

                        <div style={ctlRow2}>
                          <div>
                            <label style={ctlLabel}>Size</label>
                            <input
                              type="number"
                              min="10"
                              max="120"
                              value={textControls.fontSize}
                              onChange={(e) => applyTextControlsPatch({ fontSize: e.target.value })}
                              style={ctlInput}
                            />
                          </div>
                          <div>
                            <label style={ctlLabel}>Weight</label>
                            <select value={textControls.fontWeight} onChange={(e) => applyTextControlsPatch({ fontWeight: e.target.value })} style={ctlInput}>
                              <option value="400">Normal (400)</option>
                              <option value="500">Medium (500)</option>
                              <option value="600">Semibold (600)</option>
                              <option value="800">Extra Bold (800)</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label style={ctlLabel}>Format</label>
                          <div style={formatRow}>
                            <button
                              type="button"
                              onClick={() => applyTextControlsPatch({ fontWeight: textControls.fontWeight === "600" ? "400" : "600" })}
                              style={formatBtn(textControls.fontWeight === "600")}
                              title="Bold"
                            >
                              B
                            </button>
                            <button
                              type="button"
                              onClick={() => applyTextControlsPatch({ fontWeight: textControls.fontWeight === "800" ? "400" : "800" })}
                              style={formatBtn(textControls.fontWeight === "800")}
                              title="Extra Bold"
                            >
                              XB
                            </button>
                            <button
                              type="button"
                              onClick={() => applyTextControlsPatch({ fontStyle: textControls.fontStyle === "italic" ? "normal" : "italic" })}
                              style={formatBtn(textControls.fontStyle === "italic")}
                              title="Italic"
                            >
                              I
                            </button>
                            <button
                              type="button"
                              onClick={() => applyTextControlsPatch({ textDecoration: textControls.textDecoration === "underline" ? "none" : "underline" })}
                              style={formatBtn(textControls.textDecoration === "underline")}
                              title="Underline"
                            >
                              U
                            </button>
                          </div>
                        </div>

                        <div>
                          <label style={ctlLabel}>Color</label>
                          <input type="color" value={normalizeColorForPicker(textControls.color)} onChange={(e) => setTextColor(e.target.value)} style={ctlColor} />
                          <div style={swatchGroupTitle}>Standard</div>
                          <div style={swatchGrid}>
                            {STANDARD_TEXT_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setTextColor(color)}
                                style={swatchButton(color, normalizeColorForPicker(textControls.color) === color)}
                                title={color}
                              />
                            ))}
                          </div>
                          <div style={swatchGroupTitle}>Your Colors</div>
                          {savedTextColors.length ? (
                            <div style={swatchGrid}>
                              {savedTextColors.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => setTextColor(color)}
                                  style={swatchButton(color, normalizeColorForPicker(textControls.color) === color)}
                                  title={color}
                                />
                              ))}
                            </div>
                          ) : (
                            <div style={swatchHint}>Pick any custom color once and it will be saved here.</div>
                          )}
                        </div>

                        <div>
                          <label style={ctlLabel}>Align</label>
                          <select value={textControls.textAlign} onChange={(e) => applyTextControlsPatch({ textAlign: e.target.value })} style={ctlInput}>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                            <option value="justify">Justify</option>
                          </select>
                        </div>

                        <div style={ctlRow2}>
                          <div>
                            <label style={ctlLabel}>Text Box Width</label>
                            <input
                              type="number"
                              min="0"
                              max="2000"
                              value={textControls.width}
                              onChange={(e) => applyTextControlsPatch({ width: e.target.value })}
                              placeholder="auto"
                              style={ctlInput}
                            />
                          </div>
                          <div>
                            <label style={ctlLabel}>Max Width</label>
                            <input
                              type="number"
                              min="0"
                              max="2000"
                              value={textControls.maxWidth}
                              onChange={(e) => applyTextControlsPatch({ maxWidth: e.target.value })}
                              placeholder="none"
                              style={ctlInput}
                            />
                          </div>
                        </div>

                        <div style={ctlRow2}>
                          <div>
                            <label style={ctlLabel}>Line Height</label>
                            <input
                              type="number"
                              step="0.1"
                              min="1"
                              max="3"
                              value={textControls.lineHeight}
                              onChange={(e) => applyTextControlsPatch({ lineHeight: e.target.value })}
                              style={ctlInput}
                            />
                          </div>
                          <div>
                            <label style={ctlLabel}>Letter Spacing</label>
                            <input
                              type="number"
                              step="0.1"
                              min="-2"
                              max="12"
                              value={textControls.letterSpacing}
                              onChange={(e) => applyTextControlsPatch({ letterSpacing: e.target.value })}
                              style={ctlInput}
                            />
                          </div>
                        </div>

                        <div>
                          <label style={ctlLabel}>Transform</label>
                          <select value={textControls.textTransform} onChange={(e) => applyTextControlsPatch({ textTransform: e.target.value })} style={ctlInput}>
                            <option value="none">None</option>
                            <option value="uppercase">UPPERCASE</option>
                            <option value="lowercase">lowercase</option>
                            <option value="capitalize">Capitalize</option>
                          </select>
                        </div>

                        <div style={{ borderTop: "1px solid #2d4a7a", paddingTop: 10, marginTop: 10 }}>
                          <label style={ctlLabel}>Text Effects</label>
                        </div>

                        <div>
                          <label style={{ ...ctlLabel, display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={textControls.outlineEnabled}
                              onChange={(e) => applyTextControlsPatch({ outlineEnabled: e.target.checked })}
                              style={{ cursor: "pointer", width: 16, height: 16 }}
                            />
                            Text Outline
                          </label>
                        </div>

                        {textControls.outlineEnabled && (
                          <div style={ctlRow2}>
                            <div>
                              <label style={ctlLabel}>Outline Color</label>
                              <input
                                type="color"
                                value={normalizeColorForPicker(textControls.outlineColor)}
                                onChange={(e) => applyTextControlsPatch({ outlineColor: e.target.value })}
                                style={ctlColor}
                              />
                            </div>
                            <div>
                              <label style={ctlLabel}>Thickness</label>
                              <input
                                type="number"
                                min="0.5"
                                max="5"
                                step="0.5"
                                value={textControls.outlineWidth}
                                onChange={(e) => applyTextControlsPatch({ outlineWidth: e.target.value })}
                                style={ctlInput}
                              />
                            </div>
                          </div>
                        )}

                        <div>
                          <label style={{ ...ctlLabel, display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={textControls.hollowText}
                              onChange={(e) => applyTextControlsPatch({ hollowText: e.target.checked })}
                              style={{ cursor: "pointer", width: 16, height: 16 }}
                            />
                            Hollow Text (Outline Only)
                          </label>
                        </div>

                        {textControls.tagName === "a" ? (
                          <div style={{ borderTop: "1px solid #2d4a7a", paddingTop: 10, marginTop: 10 }}>
                            <label style={ctlLabel}>Link URL</label>
                            <input
                              type="url"
                              value={textControls.href || ""}
                              onChange={(e) => applyTextControlsPatch({ href: e.target.value })}
                              placeholder="https://example.com or #section"
                              style={ctlInput}
                            />
                            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>Enter the URL this link points to.</p>
                          </div>
                        ) : null}
                      </div>
                    ) : blockPanelOpen ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        <div style={rightHint}>Click text to edit text. Click a shape or block to adjust colour, opacity, size, and layering.</div>

                        {getStackBoxRoot(lastBlockCompRef.current) ? (() => {
                          const stackRoot = getStackBoxRoot(lastBlockCompRef.current);
                          const stackLayers = getStackLayerComponents(stackRoot);
                          const selectedLayer = isStackLayerComponent(lastBlockCompRef.current) ? lastBlockCompRef.current : null;
                          const selectedLayerIndex = selectedLayer ? stackLayers.indexOf(selectedLayer) : -1;
                          return (
                            <div style={{ borderTop: "1px solid #2d4a7a", paddingTop: 10, display: "grid", gap: 10 }}>
                              <label style={ctlLabel}>Layer Stack</label>
                              <div style={ctlBtnRow}>
                                <button type="button" style={ctlBtn} onClick={() => addStackBoxLayer("image")}>+ Add Image Layer</button>
                                <button type="button" style={ctlBtnGhost} onClick={() => addStackBoxLayer("text")}>+ Add Text Layer</button>
                              </div>

                              {stackLayers.length ? (
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {stackLayers.map((layer, layerIndex) => {
                                    const attrs = layer.getAttributes?.() || {};
                                    const kind = `${attrs["data-stack-layer-kind"] || layer.get?.("tagName") || "div"}`.toLowerCase() === "text" ? "text" : "image";
                                    const isActive = selectedLayerIndex === layerIndex;
                                    return (
                                      <button
                                        key={`${kind}-stack-layer-${layerIndex}`}
                                        type="button"
                                        style={{
                                          ...ctlBtnGhost,
                                          padding: "7px 10px",
                                          borderColor: isActive ? "#7df9a1" : "#34507a",
                                          color: isActive ? "#7df9a1" : ctlBtnGhost.color,
                                        }}
                                        onClick={() => {
                                          editorRef.current?.select?.(layer);
                                          lastBlockCompRef.current = layer;
                                          if (kind === "image") lastImageCompRef.current = layer;
                                        }}
                                      >
                                        {kind === "text" ? `Text ${layerIndex + 1}` : `Image ${layerIndex + 1}`}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}

                              {selectedLayer ? (
                                <div style={{ fontSize: 12, color: "#93a4bf", lineHeight: 1.5 }}>
                                  {selectedLayer.get?.("tagName") === "img"
                                    ? "Selected image layer. Use the image tools below to upload, replace, resize, and position it."
                                    : "Selected text layer. Edit the text directly on canvas, then use the text controls above for styling."}
                                </div>
                              ) : (
                                <div style={{ fontSize: 12, color: "#93a4bf", lineHeight: 1.5 }}>
                                  Select a layer chip to edit that layer directly inside the stack canvas.
                                </div>
                              )}
                            </div>
                          );
                        })() : null}

                        {lastSelectedTagRef.current === "img" ? (
                          <div style={{ borderTop: "1px solid #2d4a7a", paddingTop: 10 }}>
                            <label style={ctlLabel}>Image Tools</label>
                            <div style={ctlBtnRow}>
                              <button
                                type="button"
                                style={ctlBtn}
                                onClick={() => {
                                  setImageUploadMode("replace");
                                  imageInputRef.current?.click();
                                }}
                              >
                                Upload / Replace
                              </button>
                              <button type="button" style={ctlBtnGhost} onClick={openMediaLibrary}>
                                Open Media Library
                              </button>
                            </div>

                            <div style={ctlRow2}>
                              <div>
                                <label style={ctlLabel}>Width</label>
                                <input
                                  type="number"
                                  min="40"
                                  max="1200"
                                  value={blockControls.width}
                                  onChange={(e) => applyImageControlsPatch({ width: e.target.value })}
                                  style={ctlInput}
                                />
                              </div>
                              <div>
                                <label style={ctlLabel}>Height</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="1200"
                                  value={blockControls.height}
                                  onChange={(e) => applyImageControlsPatch({ height: e.target.value })}
                                  style={ctlInput}
                                />
                              </div>
                            </div>

                            <div style={ctlRow2}>
                              <div>
                                <label style={ctlLabel}>Opacity: {blockControls.opacity}%</label>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="5"
                                  value={blockControls.opacity}
                                  onChange={(e) => applyImageControlsPatch({ opacity: e.target.value })}
                                  style={{ width: "100%", cursor: "pointer" }}
                                />
                              </div>
                              <div>
                                <label style={ctlLabel}>Corner Radius</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="400"
                                  value={blockControls.borderRadius}
                                  onChange={(e) => applyImageControlsPatch({ borderRadius: e.target.value })}
                                  style={ctlInput}
                                />
                              </div>
                            </div>

                            {isFreeformArrangeTarget(lastBlockCompRef.current) ? (
                              <div style={ctlRow2}>
                                <div>
                                  <label style={ctlLabel}>X Position</label>
                                  <input
                                    type="number"
                                    value={blockControls.offsetX}
                                    onChange={(e) => applyImageControlsPatch({ offsetX: e.target.value })}
                                    style={ctlInput}
                                  />
                                </div>
                                <div>
                                  <label style={ctlLabel}>Y Position</label>
                                  <input
                                    type="number"
                                    value={blockControls.offsetY}
                                    onChange={(e) => applyImageControlsPatch({ offsetY: e.target.value })}
                                    style={ctlInput}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div>
                                <label style={ctlLabel}>Image Alignment</label>
                                <div style={ctlBtnRow}>
                                  <button type="button" style={ctlBtnGhost} onClick={() => applyImageAlignment("left")}>
                                    Left
                                  </button>
                                  <button type="button" style={ctlBtnGhost} onClick={() => applyImageAlignment("center")}>
                                    Center
                                  </button>
                                  <button type="button" style={ctlBtnGhost} onClick={() => applyImageAlignment("right")}>
                                    Right
                                  </button>
                                </div>
                              </div>
                            )}

                            <div style={{ borderTop: "1px solid #2d4a7a", paddingTop: 10, marginTop: 10 }}>
                            <label style={ctlLabel}>Image Link URL</label>
                            <input
                              type="url"
                              value={imageLink}
                              onChange={(e) => setImageLink(e.target.value)}
                              placeholder="https://example.com (leave blank for no link)"
                              style={ctlInput}
                            />
                            <div style={ctlBtnRow}>
                              <button
                                type="button"
                                style={ctlBtn}
                                onClick={() => {
                                  const comp = lastBlockCompRef.current;
                                  if (!comp) return;
                                  const url = (imageLink || "").trim();
                                  const imgComp = editorRef.current?.getSelected();
                                  const target = imgComp || comp;
                                  if (!url) {
                                    // Remove link wrapper if parent is <a>
                                    const parent = target.parent?.();
                                    if (parent && `${parent.get?.("tagName")}`.toLowerCase() === "a") {
                                      const grandparent = parent.parent?.();
                                      if (grandparent) {
                                        const idx = parent.index?.() || 0;
                                        grandparent.components().add(target.toJSON(), { at: idx });
                                        parent.remove();
                                      }
                                    }
                                  } else {
                                    // Wrap or update existing <a>
                                    const parent = target.parent?.();
                                    if (parent && `${parent.get?.("tagName")}`.toLowerCase() === "a") {
                                      parent.addAttributes({ href: url, target: "_blank" });
                                    } else {
                                      const imgAttrs = target.getAttributes?.() || {};
                                      const imgStyle = target.getStyle?.() || {};
                                      const imgHtml = Object.entries(imgAttrs).reduce((acc, [k, v]) => `${acc} ${k}="${v}"`, "");
                                      const styleStr = Object.entries(imgStyle).reduce((acc, [k, v]) => `${acc}${k}:${v};`, "");
                                      target.replaceWith(`<a href="${url}" target="_blank" style="display:inline-block;"><img${imgHtml}${styleStr ? ` style="${styleStr}"` : ""} /></a>`);
                                    }
                                  }
                                }}
                              >
                                Apply Link
                              </button>
                              <button
                                type="button"
                                style={ctlBtnGhost}
                                onClick={() => setImageLink("")}
                              >
                                Clear
                              </button>
                              <button
                                type="button"
                                style={ctlBtnGhost}
                                onClick={() => {
                                  const target = editorRef.current?.getSelected?.() || lastBlockCompRef.current;
                                  if (!target) return;
                                  const parent = target.parent?.() || null;
                                  target.remove?.();
                                  selectedCompRef.current = parent;
                                  lastBlockCompRef.current = parent;
                                  lastSelectedTagRef.current = parent ? `${parent.get?.("tagName") || ""}`.toLowerCase() : "";
                                  if (parent) {
                                    editorRef.current?.select?.(parent);
                                  } else {
                                    editorRef.current?.select?.();
                                    setBlockPanelOpen(false);
                                  }
                                }}
                              >
                                Remove Image
                              </button>
                            </div>
                          </div>
                        </div>
                        ) : null}

                        {(blockKind === "shape" || isShapeLikeComponent(lastBlockCompRef.current)) ? (
                          <div style={{ borderTop: "1px solid #2d4a7a", paddingTop: 10, marginTop: 10, display: "grid", gap: 10 }}>
                            <label style={ctlLabel}>Shape Controls</label>
                            <div style={{ color: "#93c5fd", fontSize: 12, lineHeight: 1.5 }}>
                              Drag the selected shape directly on the page to place it anywhere you want.
                            </div>
                            <div>
                              <label style={ctlLabel}>Shape Style</label>
                              <select
                                value={blockControls.shapePreset || "rounded-box"}
                                onChange={(e) => applyBlockControlsPatch({ shapePreset: e.target.value })}
                                style={ctlInput}
                              >
                                <option value="rounded-box">Rounded Box</option>
                                <option value="circle">Circle</option>
                                <option value="diamond">Diamond</option>
                                <option value="triangle">Triangle</option>
                                <option value="star">Star</option>
                                <option value="hexagon">Hexagon</option>
                                <option value="arrow">Arrow</option>
                                <option value="bubble">Bubble</option>
                                <option value="blob">Blob</option>
                                <option value="ring">Ring</option>
                                <option value="line">Line</option>
                              </select>
                            </div>

                            <div style={ctlRow2}>
                              <div>
                                <label style={ctlLabel}>Width</label>
                                <input
                                  type="number"
                                  min="10"
                                  max="800"
                                  value={blockControls.width}
                                  onChange={(e) => applyBlockControlsPatch({ width: e.target.value })}
                                  style={ctlInput}
                                />
                              </div>
                              <div>
                                <label style={ctlLabel}>Height</label>
                                <input
                                  type="number"
                                  min="10"
                                  max="800"
                                  value={blockControls.height}
                                  onChange={(e) => applyBlockControlsPatch({ height: e.target.value })}
                                  style={ctlInput}
                                />
                              </div>
                            </div>

                            <div style={ctlRow2}>
                              <div>
                                <label style={ctlLabel}>Opacity: {blockControls.opacity}%</label>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="5"
                                  value={blockControls.opacity}
                                  onChange={(e) => applyBlockControlsPatch({ opacity: e.target.value })}
                                  style={{ width: "100%", cursor: "pointer" }}
                                />
                              </div>
                              <div>
                                <label style={ctlLabel}>Corner Radius</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="400"
                                  value={blockControls.borderRadius}
                                  onChange={(e) => applyBlockControlsPatch({ borderRadius: e.target.value })}
                                  style={ctlInput}
                                />
                              </div>
                            </div>

                            <div style={ctlRow2}>
                              <div>
                                <label style={ctlLabel}>Layer</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="50"
                                  value={blockControls.zIndex}
                                  onChange={(e) => applyBlockControlsPatch({ zIndex: e.target.value })}
                                  style={ctlInput}
                                />
                              </div>
                              <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
                                <button
                                  type="button"
                                  style={ctlBtnGhost}
                                  onClick={() => shiftBlockLayer(-1)}
                                >
                                  Send Back
                                </button>
                                <button
                                  type="button"
                                  style={ctlBtn}
                                  onClick={() => shiftBlockLayer(1)}
                                >
                                  Bring Forward
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div>
                          <label style={ctlLabel}>Background Color</label>
                          <input
                            type="color"
                            value={normalizeColorForPicker(blockControls.backgroundColor)}
                            onChange={(e) => applyBlockControlsPatch({ backgroundColor: e.target.value, backgroundTransparent: false })}
                            style={ctlColor}
                          />
                          <label style={{ ...ctlLabel, display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                            <input
                              type="checkbox"
                              checked={!!blockControls.backgroundTransparent}
                              onChange={(e) => applyBlockControlsPatch({ backgroundTransparent: e.target.checked })}
                              style={{ cursor: "pointer", width: 16, height: 16 }}
                            />
                            Transparent Background
                          </label>
                        </div>
                        <div>
                          <label style={ctlLabel}>Section Height</label>
                          <input
                            type="number"
                            min="0"
                            max="2000"
                            value={blockControls.minHeight}
                            onChange={(e) => applyBlockControlsPatch({ minHeight: e.target.value })}
                            placeholder="auto"
                            style={ctlInput}
                          />
                        </div>
                        <div style={ctlRow2}>
                          <div>
                            <label style={ctlLabel}>Padding Top</label>
                            <input
                              type="number"
                              min="0"
                              max="200"
                              value={blockControls.paddingTop}
                              onChange={(e) => applyBlockControlsPatch({ paddingTop: e.target.value })}
                              style={ctlInput}
                            />
                          </div>
                          <div>
                            <label style={ctlLabel}>Padding Bottom</label>
                            <input
                              type="number"
                              min="0"
                              max="200"
                              value={blockControls.paddingBottom}
                              onChange={(e) => applyBlockControlsPatch({ paddingBottom: e.target.value })}
                              style={ctlInput}
                            />
                          </div>
                        </div>
                        <div>
                          <label style={ctlLabel}>Background Image URL</label>
                          <input
                            value={blockControls.backgroundImage}
                            onChange={(e) => applyBackgroundImageUrl(e.target.value)}
                            placeholder="https://..."
                            style={ctlInput}
                          />
                          <label style={{ ...ctlLabel, color: "#93c5fd", marginTop: 10 }}>Generate Background</label>
                          <textarea
                            value={aiImagePrompt}
                            onChange={(e) => {
                              setAiImagePrompt(e.target.value);
                              if (aiImageStatus) setAiImageStatus("");
                            }}
                            placeholder="Example: modern home renovation hero photo, natural light, premium editorial look"
                            style={{ ...ctlTextarea, minHeight: 80 }}
                          />
                          <div style={ctlRow2}>
                            <div>
                              <label style={ctlLabel}>Style</label>
                              <select value={aiImageStyle} onChange={(e) => setAiImageStyle(e.target.value)} style={ctlInput}>
                                <option value="clean">Clean Graphic</option>
                                <option value="icon">Icon / Flat</option>
                                <option value="photo">Photo Real</option>
                              </select>
                            </div>
                            <div>
                              <label style={ctlLabel}>Size</label>
                              <select value={aiImageSize} onChange={(e) => setAiImageSize(e.target.value)} style={ctlInput}>
                                <option value="1024x1024">Square</option>
                                <option value="1536x1024">Landscape</option>
                                <option value="1024x1536">Portrait</option>
                              </select>
                            </div>
                          </div>
                          <div style={ctlBtnRow}>
                            <button
                              type="button"
                              style={ctlBtn}
                              onClick={() => {
                                setImageUploadMode("background");
                                imageInputRef.current?.click();
                              }}
                            >
                              Upload Background
                            </button>
                            <button
                              type="button"
                              style={ctlBtnGhost}
                              onClick={() => applyBackgroundImageUrl("")}
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              style={ctlBtnGhost}
                              onClick={() => generateAiImage("background")}
                              disabled={aiImageLoading}
                            >
                              {aiImageLoading ? "Generating..." : "Generate"}
                            </button>
                            <button type="button" style={ctlBtnGhost} onClick={openMediaLibrary}>
                              Media Library
                            </button>
                          </div>
                          {aiImageStatus ? <div style={{ color: "#93c5fd", fontSize: 12, lineHeight: 1.5 }}>{aiImageStatus}</div> : null}
                        </div>
                        <div style={ctlRow2}>
                          <div>
                            <label style={ctlLabel}>Size</label>
                            <select
                              value={blockControls.backgroundSize}
                              onChange={(e) => applyBlockControlsPatch({ backgroundSize: e.target.value })}
                              style={ctlInput}
                            >
                              <option value="cover">Cover</option>
                              <option value="contain">Contain</option>
                              <option value="auto">Auto</option>
                            </select>
                          </div>
                          <div>
                            <label style={ctlLabel}>Repeat</label>
                            <select
                              value={blockControls.backgroundRepeat}
                              onChange={(e) => applyBlockControlsPatch({ backgroundRepeat: e.target.value })}
                              style={ctlInput}
                            >
                              <option value="no-repeat">No Repeat</option>
                              <option value="repeat">Repeat</option>
                              <option value="repeat-x">Repeat X</option>
                              <option value="repeat-y">Repeat Y</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label style={ctlLabel}>Position</label>
                          <select
                            value={blockControls.backgroundPosition}
                            onChange={(e) => applyBlockControlsPatch({ backgroundPosition: e.target.value })}
                            style={ctlInput}
                          >
                            <option value="center center">Center</option>
                            <option value="top center">Top</option>
                            <option value="bottom center">Bottom</option>
                            <option value="center left">Left</option>
                            <option value="center right">Right</option>
                          </select>
                        </div>

                        {blockControls.backgroundImage && (
                          <>
                            <div style={{ borderTop: "1px solid #2d4a7a", paddingTop: 10, marginTop: 10 }}>
                              <label style={ctlLabel}>Image Effects</label>
                            </div>

                            <div>
                              <label style={ctlLabel}>Opacity: {blockControls.backgroundImageOpacity}%</label>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={blockControls.backgroundImageOpacity}
                                onChange={(e) => applyBlockControlsPatch({ backgroundImageOpacity: e.target.value })}
                                style={{ width: "100%", cursor: "pointer" }}
                              />
                            </div>

                            <div>
                              <label style={{ ...ctlLabel, display: "flex", alignItems: "center", gap: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={blockControls.backgroundImageFadeIn}
                                  onChange={(e) => applyBlockControlsPatch({ backgroundImageFadeIn: e.target.checked })}
                                  style={{ cursor: "pointer", width: 16, height: 16 }}
                                />
                                Fade In Animation
                              </label>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div style={rightHint}>Select a block to edit background, or select text to edit typography.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Template Picker */}
        {showPicker ? (
          <TemplatePicker
            onClose={() => setShowPicker(false)}
            onChoose={(html) => {
              const e = editorRef.current;
              if (e) {
                e.setStyle("");
                e.setComponents(html);
              }
              setShowPicker(false);
            }}
          />
        ) : null}

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageImport}
          style={{ display: "none" }}
        />
      </main>
    </>
  );
}

/* ---------- Supabase Assets → GrapesJS ---------- */
async function loadSupabaseAssetsIntoGrapes(editor, userId) {
  try {
    if (!editor || !userId) return;
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || '';
    if (!token) return;

    const response = await fetch('/api/assets/list-library', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    if (!response.ok || !payload?.ok) return;

    const urls = (payload.images || []).map((image) => image.url).filter(Boolean);
    if (!urls.length) return;

    const existingUrls = new Set(
      (editor.AssetManager?.getAll?.()?.map?.((asset) => asset?.get?.("src") || asset?.attributes?.src || asset?.src) || [])
        .filter(Boolean)
    );
    const nextAssets = urls.filter((url) => !existingUrls.has(url)).map((url) => ({ src: url, name: url.split("/").pop() || "Asset" }));
    if (nextAssets.length) {
      editor.AssetManager.add(nextAssets);
    }
  } catch (e) {
    // ignore
  }
}

/* ---------- Template Picker ---------- */
function TemplatePicker({ onClose, onChoose }) {
  const options = [
    { name: "Sales Page", html: assemblePage(['ann-bar', 'hero-dark', 'social-proof', 'benefits', 'story-copy', 'testimonials', 'bonuses', 'pricing', 'guarantee', 'faq', 'cta', 'trust-badges', 'footer']) },
    { name: "VSL Page", html: assemblePage(['ann-bar', 'hero-video', 'social-proof', 'testimonials', 'pricing', 'guarantee', 'faq', 'footer']) },
    { name: "Lead Capture", html: assemblePage(['hero-light', 'benefits', 'testimonials', 'lead-form', 'trust-badges', 'footer']) },
    { name: "Bridge / Pre-Sell", html: assemblePage(['hero-dark', 'story-copy', 'testimonials', 'cta', 'trust-badges', 'footer']) },
    { name: "Thank You", html: assemblePage(['thankyou']) },
    { name: "Blank", html: blankHTML() },
  ];
  return (
    <div style={pickerBack}>
      <div style={picker}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0, color: "#e6eef5" }}>Templates</h3>
          <button onClick={onClose} style={miniBtn}>Close</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
          {options.map((o) => (
            <button key={o.name} style={tplCard} onClick={() => onChoose(o.html)}>
              <div style={tplThumb}>{o.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- HTML helpers ---------- */
function inlineHTML(html, css) {
  if (!css) return html;
  // Add a <style> tag at top
  return `<style>${css}</style>${html}`;
}

function injectHiddenFields(html, hidden) {
  const { funnel_id, step_id, list_id, notify_to, success_url } = hidden;
  const hiddenInputs = `
<input type="hidden" name="funnel_id" value="${esc(funnel_id)}" />
<input type="hidden" name="step_id" value="${esc(step_id)}" />
<input type="hidden" name="list_id" value="${esc(list_id)}" />
<input type="hidden" name="notify_to" value="${esc(notify_to)}" />
<input type="hidden" name="success_url" value="${esc(success_url)}" />
`.trim();
  return html.replace(/<form\b([^>]*)>/i, (m) => `${m}\n${hiddenInputs}\n`);
}
function esc(s) { return `${s ?? ""}`.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function normalizeHexColor(input) {
  if (!input) return "";
  const value = `${input}`.trim().toLowerCase();
  const shortHexMatch = value.match(/^#([0-9a-f]{3})$/i);
  if (shortHexMatch) {
    const d = shortHexMatch[1];
    return `#${d[0]}${d[0]}${d[1]}${d[1]}${d[2]}${d[2]}`;
  }
  const fullHexMatch = value.match(/^#([0-9a-f]{6})$/i);
  if (fullHexMatch) return `#${fullHexMatch[1]}`;
  return "";
}

function normalizeColorForPicker(input) {
  const directHex = normalizeHexColor(input);
  if (directHex) return directHex;

  const rgb = `${input || ""}`.trim().match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgb) {
    const [r, g, b] = rgb.slice(1, 4).map((v) => Math.max(0, Math.min(255, Number(v) || 0)));
    const toHex = (n) => n.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  return "#111827";
}

function extractOpacityPercentFromFilter(filterValue) {
  const match = `${filterValue || ""}`.match(/opacity\(([^)]+)\)/i);
  if (!match?.[1]) return "100";
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return "100";
  const pct = Math.round(Math.max(0, Math.min(1, parsed)) * 100);
  return `${pct}`;
}

/* ---------- Starter sections/pages ---------- */
function heroHTML() {
  return `
<section style="padding:64px 16px;background:#0f1318;">
  <div style="max-width:1000px;margin:0 auto;">
    <h1 style="margin:0 0 8px 0;color:#e6eef5;font-size:48px;">Catchy Headline</h1>
    <p style="margin:0 0 16px 0;color:#a5b5c3;font-size:18px;">A short description that supports the headline.</p>
    <a href="#" style="display:inline-block;background:#2d6cdf;color:#fff;padding:12px 16px;border-radius:12px;text-decoration:none;">Call to action</a>
  </div>
</section>`;
}

function leadFormHTML() {
  return `
<form method="post" action="/api/forms/submit" style="display:grid;gap:10px;max-width:520px;">
  <input name="name" placeholder="Your name" style="padding:10px;border-radius:10px;border:1px solid #2b2f36;background:#0f1318;color:#e6eef5;" />
  <input name="email" type="email" placeholder="you@domain.com" required style="padding:10px;border-radius:10px;border:1px solid #2b2f36;background:#0f1318;color:#e6eef5;" />
  <button type="submit" style="padding:12px 16px;border-radius:12px;background:#2d6cdf;color:#fff;border:none;cursor:pointer;">Send</button>
</form>`;
}

function leadPageHTML() {
  return `
${heroHTML()}
<section style="padding:40px 16px;background:#0f1318;">
  <div style="max-width:1000px;margin:0 auto;color:#cbd5e1;">
    <h2 style="margin:0 0 12px 0;color:#e6eef5;">Get the free guide</h2>
    ${leadFormHTML()}
  </div>
</section>`;
}

function salesHTML() {
  return `
${heroHTML()}
<section style="padding:40px 16px;background:#0f1318;">
  <div style="max-width:1000px;margin:0 auto;color:#cbd5e1;">
    <p>Explain benefits. Add an image below.</p>
    <img src="" alt="" style="max-width:100%;border-radius:12px;margin:12px 0;"/>
    <a href="#" style="display:inline-block;background:#22c55e;color:#0f1318;padding:12px 16px;border-radius:12px;text-decoration:none;">Buy now</a>
  </div>
</section>`;
}

function thankyouHTML() {
  return `
<section style="padding:56px 16px;background:#0f1318;">
  <div style="max-width:900px;margin:0 auto;text-align:center;">
    <h2 style="color:#e6eef5">Thanks!</h2>
    <p style="color:#cbd5e1">We’ve sent you an email with the next steps.</p>
  </div>
</section>`;
}

function blankHTML() {
  return `<section style="padding:56px 16px;background:#0f1318;"><div style="max-width:900px;margin:0 auto;color:#cbd5e1;">Start building…</div></section>`;
}

/* ---------- Styles ---------- */
const wrap = { padding: "24px 22px", width: "min(1880px, calc(100vw - 240px))", maxWidth: "none", margin: "0 auto", background: "#0c121a", minHeight: "100vh" };
const topRow = { display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 20, background: "#111827", border: "1px solid #1e2d45", borderRadius: 14, padding: "20px 22px" };
const nameInput = { padding: "12px 14px", borderRadius: 10, border: "1px solid #2b3650", background: "#0c121a", color: "#e6eef5", fontSize: 20, fontWeight: 700, width: "100%" };
const slugInput = { flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #2b3650", background: "#0c121a", color: "#e6eef5", fontSize: 16 };
const miniBtn = { padding: "10px 14px", borderRadius: 10, border: "1px solid #2b3650", background: "#1e2d45", color: "#94a3b8", cursor: "pointer", fontSize: 16 };
const miniLink = { ...miniBtn, textDecoration: "none", display: "inline-flex", alignItems: "center", color: "#60a5fa" };

const label = { display: "block", color: "#94a3b8", fontSize: 16, marginBottom: 6, fontWeight: 500 };
const textInput = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #2b3650", background: "#0c121a", color: "#e6eef5", fontSize: 16 };
const select = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #2b3650", background: "#0c121a", color: "#e6eef5", fontSize: 16 };
const desc = { width: "100%", minHeight: 80, padding: 12, borderRadius: 10, border: "1px solid #2b3650", background: "#0c121a", color: "#e6eef5", fontSize: 16 };

const stepsBar = { display: "flex", alignItems: "center", justifyContent: "space-between", margin: "20px 0 12px" };
const stepsWrap = { display: "grid", gridTemplateColumns: "1fr", gap: 10 };
const builderSection = { marginTop: 20, minHeight: "calc(100vh - 140px)", overflow: "visible" };
const panel = { background: "#111827", border: "1px solid #1e2d45", borderRadius: 14, padding: 14, minHeight: 120, height: "auto", display: "grid", gridTemplateRows: "auto auto minmax(720px,1fr)", overflow: "visible" };
const panelTitle = { color: "#e6eef5", fontWeight: 700, fontSize: 18, marginBottom: 10 };
const btn = { padding: "10px 16px", borderRadius: 10, border: "1px solid #2b3650", background: "#1e2d45", color: "#e6eef5", cursor: "pointer", fontSize: 16, fontWeight: 600 };
const btnPrimary = { ...btn, border: "none", background: "linear-gradient(135deg,#2d6cdf,#1a4fa8)", color: "#fff", boxShadow: "0 2px 10px rgba(45,108,223,0.4)" };
const btnWarn = { ...btn, border: "1px solid #6a5015", background: "#3b2a0a", color: "#fcd34d" };
const btnDanger = { ...btn, border: "1px solid #4a1020", background: "#2d0d16", color: "#f87171" };
const pill = { padding: "10px 16px", borderRadius: 999, border: "1px solid #2b3650", background: "#1e2d45", color: "#94a3b8", cursor: "pointer", fontSize: 16, fontWeight: 600 };
const editorShell = { display: "grid", gridTemplateColumns: "320px minmax(0,1fr) 280px", gap: 10, alignItems: "stretch", minHeight: 720, height: "100%" };
const blocksPane = { background: "#0a0f17", border: "1px solid #1e2d45", borderRadius: 10, padding: 10, height: "100%", overflow: "auto", minHeight: 0 };
const editorCanvas = { borderRadius: 10, overflow: "auto", background: "#0b1016", height: "100%", minHeight: 0 };
const rightPaneWrap = { background: "#0a0f17", border: "1px solid #1e2d45", borderRadius: 10, height: "100%", minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(0,1fr)", overflow: "hidden" };
const rightPaneHead = { color: "#cbd5e1", fontSize: 13, fontWeight: 700, letterSpacing: 0.4, padding: "10px 12px", borderBottom: "1px solid #1e2d45", background: "#111827" };
const rightPane = { minHeight: 0, height: "100%", overflow: "auto", padding: 8 };
const rightHint = { color: "#94a3b8", fontSize: 14, lineHeight: 1.6, padding: 8 };
const ctlLabel = { color: "#94a3b8", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 };
const ctlInput = { width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #2b3650", background: "#0c121a", color: "#e6eef5", fontSize: 13 };
const ctlTextarea = { width: "100%", minHeight: 120, padding: "10px 12px", borderRadius: 8, border: "1px solid #2b3650", background: "#0c121a", color: "#e6eef5", fontSize: 13, lineHeight: 1.5, resize: "vertical", boxSizing: "border-box" };
const ctlColor = { ...ctlInput, padding: 4, height: 40 };
const ctlRow2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
const swatchGroupTitle = { color: "#7d8da5", fontSize: 11, fontWeight: 700, marginTop: 8, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 };
const swatchGrid = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 };
const swatchHint = { marginTop: 6, color: "#64748b", fontSize: 12, lineHeight: 1.4 };
const formatRow = { display: "flex", gap: 8, alignItems: "center" };
const ctlBtnRow = { marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" };
const ctlBtn = { padding: "8px 10px", borderRadius: 8, border: "1px solid #2d4a7a", background: "#152038", color: "#93c5fd", fontSize: 12, fontWeight: 700, cursor: "pointer" };
const ctlBtnGhost = { padding: "8px 10px", borderRadius: 8, border: "1px solid #2b3650", background: "#111827", color: "#cbd5e1", fontSize: 12, fontWeight: 700, cursor: "pointer" };

function formatBtn(active) {
  return {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: active ? "1px solid #60a5fa" : "1px solid #2b3650",
    background: active ? "#1d4ed8" : "#111827",
    color: "#e6eef5",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function swatchButton(color, active) {
  return {
    width: 26,
    height: 26,
    borderRadius: 7,
    border: active ? "2px solid #e2e8f0" : "1px solid #2b3650",
    background: color,
    cursor: "pointer",
    boxShadow: active ? "0 0 0 1px #1e293b inset" : "none",
  };
}

const pickerBack = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const picker = { width: "min(980px,92vw)", background: "#111827", border: "1px solid #1e2d45", borderRadius: 16, padding: 24 };
const tplCard = { border: "1px solid #1e2d45", borderRadius: 12, background: "#1a2535", padding: 8, cursor: "pointer", textAlign: "center" };
const tplThumb = { height: 120, borderRadius: 10, background: "#0c121a", color: "#e6eef5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16 };

function Gate({ children }) {
  return <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#e6eef5", background: "#0c121a", fontSize: 18 }}>{children}</div>;
}
function Empty({ children }) {
  return <div style={{ padding: 16, border: "2px dashed #2b3650", borderRadius: 12, color: "#64748b", fontSize: 16 }}>{children}</div>;
}
