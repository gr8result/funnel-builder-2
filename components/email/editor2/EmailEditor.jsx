import { useEditorMedia } from "./useEditorMedia.js";
import { useSavedBlocks } from "./useSavedBlocks.js";
import { useDocumentPersistence } from "./useDocumentPersistence.js";
import { useEditorStyles, EmailEditorStyles } from "./editorStyles.jsx";
import { EditorInspector } from "./EditorInspector.jsx";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useState, useEffect, useCallback, useRef } from "react";
import { normalizeBlocksForEditor, stripEmailMetaBlocks, extractEmailSettings, normalizeEmailSettings, DEFAULTS, makeGroupedCardBlocks, makeBlock, withNormalizedBlockProps, resolveBlockRadius, defaultBlockRadius, isCardBlockType } from "./blockModel.js";
import { deepClone, uid, clamp } from "./editorUtils.js";
import { CATALOG } from "./editorOptions.js";
import { emailEditorFetch } from "./emailEditorApi";
import { exportFullHtml } from "./htmlExport.js";
import { InlineEditableText } from "./richTextCanvas.jsx";
import { TopBtn, FileMenuItem, CatalogBtn, SavedBtn, DropZone } from "./editorControls.jsx";
import { FloatingTextToolbar, TextRibbon } from "./textToolbar.jsx";
import { BlockWrapper } from "./BlockWrapper.jsx";
import { ensureReadableColor } from "./colors.js";

const ImageEditModal = dynamic(() => import("./ImageEditModal"), { ssr: false });

const ImageLibraryModal = dynamic(() => import("./ImageLibraryModal"), { ssr: false });

const AiGenerateModal = dynamic(() => import("./AiGenerateModal"), { ssr: false });

const AiImageModal = dynamic(() => import("./AiImageModal"), { ssr: false });

export default function EmailEditor({
  userId = "",
  initialBlocks = [],
  initialDocId = null,
  initialDocName = "Untitled Email",
  initialTemplateScope = "",
  initialTemplatePath = "",
  onExportHtml = null,
  onSaved = null,
  previewMode = false,
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(() =>
    normalizeBlocksForEditor(stripEmailMetaBlocks(initialBlocks.length ? deepClone(initialBlocks) : []))
  );
  const [docSettings, setDocSettings] = useState(() =>
    extractEmailSettings(initialBlocks.length ? deepClone(initialBlocks) : [])
  );
  const [selectedId, setSelectedId] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);

  useEditorStyles();

  // ── AI modals ─────────────────────────────────────────────────
  const { showAiGenerate, setShowAiGenerate, aiImageState, setAiImageState, openAiImage, applyAiImage, libraryState, setLibraryState, openLibrary, applyLibraryImage, imageEditState, setImageEditState, openImageEdit, applyEditedImage } = useEditorMedia({ setBlocks, setDocSettings });

  // ── Saved blocks (localStorage) ────────────────────────────────
  const { savedBlocks, saveBlock, deleteSavedBlock, insertSavedBlockAt, insertSavedBlock } = useSavedBlocks({ blocks, selectedId, setBlocks, setSelectedId });
  const [docName, setDocName] = useState(initialDocName);
  const [docId, setDocId] = useState(() => initialDocId || uid());
  const [isSaving, setIsSaving] = useState(false);
  const [templateScope, setTemplateScope] = useState(initialTemplateScope || "");
  const [templatePath, setTemplatePath] = useState(initialTemplatePath || "");
  const [toast, setToast] = useState(null);
  const [saveDialog, setSaveDialog] = useState(null);
  const [panelMode, setPanelMode] = useState("block");
  const [selectedSection, setSelectedSection] = useState(null);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [recentDocs, setRecentDocs] = useState([]);
  const [loadingRecentDocs, setLoadingRecentDocs] = useState(false);
  const [floatingTextBar, setFloatingTextBar] = useState({ visible: false, x: 360, y: 160 });
  const toastRef = useRef(null);
  const canvasRef = useRef(null);
  const fileMenuRef = useRef(null);

  useEffect(() => {
    const source = Array.isArray(initialBlocks) ? deepClone(initialBlocks) : [];
    const nextBlocks = normalizeBlocksForEditor(stripEmailMetaBlocks(source));
    setDocSettings(extractEmailSettings(source));
    setBlocks(nextBlocks);
    setSelectedId(nextBlocks[0]?.id || null);
    setSelectedSection(null);
    setDragState(null);
    setDropIndex(null);
  }, [initialBlocks]);

  useEffect(() => {
    setDocName(initialDocName || "Untitled Email");
  }, [initialDocName]);

  useEffect(() => {
    setDocId(initialDocId || uid());
  }, [initialDocId]);

  useEffect(() => {
    setTemplateScope(initialTemplateScope || "");
  }, [initialTemplateScope]);

  useEffect(() => {
    setTemplatePath(initialTemplatePath || "");
  }, [initialTemplatePath]);

  useEffect(() => {
    if (selectedId) {
      setPanelMode("block");
      setSelectedSection(null);
    }
  }, [selectedId]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const getToolbarPosition = () => {
      const canvasRect = canvasRef.current?.getBoundingClientRect?.();
      const viewportWidth = window.innerWidth || 1280;
      const viewportHeight = window.innerHeight || 900;
      const estimatedToolbarWidth = Math.min(viewportWidth - 24, 920);
      const estimatedToolbarHeight = 116;
      const safeTopMargin = 24;
      const gapAboveCanvas = 24;
      const canvasCenterX = canvasRect ? (canvasRect.left + (canvasRect.width / 2)) : (viewportWidth / 2);
      const preferredX = canvasCenterX - (estimatedToolbarWidth / 2);
      const preferredY = canvasRect
        ? Math.max(safeTopMargin, canvasRect.top - estimatedToolbarHeight - gapAboveCanvas)
        : 40;

      return {
        x: clamp(preferredX, 12, Math.max(12, viewportWidth - estimatedToolbarWidth - 12)),
        y: clamp(preferredY, safeTopMargin, Math.max(safeTopMargin, viewportHeight - estimatedToolbarHeight - 12)),
      };
    };

    const syncFloatingTextBar = () => {
      const selection = window.getSelection?.();
      const activeElement = document.activeElement;
      const anchorNode = selection?.anchorNode;
      const selectionElement = anchorNode?.nodeType === window.Node.ELEMENT_NODE ? anchorNode : anchorNode?.parentElement;
      const editable = activeElement?.closest?.('[contenteditable="true"], [data-inline-editor="true"]')
        || selectionElement?.closest?.('[contenteditable="true"], [data-inline-editor="true"]')
        || null;

      if (!editable) return;

      const toolbarPosition = getToolbarPosition();
      const blockRoot = editable.closest?.("[data-block-id]");
      const blockId = blockRoot?.getAttribute?.("data-block-id");

      if (blockId) {
        setSelectedId((prev) => (prev === blockId ? prev : blockId));
      }

      setSelectedSection(null);
      setPanelMode("block");
      setFloatingTextBar((prev) => ({ ...prev, visible: true, x: toolbarPosition.x, y: toolbarPosition.y }));
    };

    const handlePointerDown = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const inEditable = target?.closest?.('[contenteditable="true"], [data-inline-editor="true"]');
      const inToolbar = target?.closest?.('[data-email-text-toolbar="true"]');
      if (!inEditable && !inToolbar) {
        setFloatingTextBar((prev) => ({ ...prev, visible: false }));
      }
    };

    document.addEventListener("selectionchange", syncFloatingTextBar);
    document.addEventListener("focusin", syncFloatingTextBar);
    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      document.removeEventListener("selectionchange", syncFloatingTextBar);
      document.removeEventListener("focusin", syncFloatingTextBar);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, []);

  useEffect(() => {
    if (!fileMenuOpen) return;

    let live = true;
    const handleClickOutside = (event) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target)) {
        setFileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    (async () => {
      if (!userId) {
        if (live) setRecentDocs([]);
        return;
      }

      if (live) setLoadingRecentDocs(true);
      try {
        const resp = await emailEditorFetch(`/api/email/builder-doc-list?userId=${encodeURIComponent(userId)}`, {}, {
          authErrorMessage: "Sign in required to load recent emails.",
        });
        const data = await resp.json().catch(() => ({}));
        if (!live) return;
        setRecentDocs(Array.isArray(data?.docs) ? data.docs.slice(0, 4) : []);
      } catch {
        if (live) setRecentDocs([]);
      } finally {
        if (live) setLoadingRecentDocs(false);
      }
    })();

    return () => {
      live = false;
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [fileMenuOpen, userId]);

  const showToast = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const showSaveDialog = useCallback((msg, type = "ok") => {
    setSaveDialog({ msg, type });
  }, []);

  const handleAiInsert = useCallback((newBlocks, mode) => {
    const withIds = newBlocks.map(b => ({ ...b, id: uid(), props: { ...DEFAULTS[b.type], ...b.props } }));
    if (mode === "append") {
      setBlocks(prev => [...prev, ...withIds]);
    } else {
      setBlocks(withIds);
      setSelectedId(null);
    }
    showToast(`✨ ${withIds.length} blocks generated!`, "ok");
  }, [showToast]);

  // ── Block mutations ────────────────────────────────────────────
  const insertBlockAt = useCallback((type, index = null) => {
    if (type === "gridCard" || type === "listCard") {
      const groupBlocks = makeGroupedCardBlocks(type);
      setBlocks(prev => {
        const arr = [...prev];
        const safeIndex = Math.max(0, Math.min(index == null ? arr.length : index, arr.length));
        arr.splice(safeIndex, 0, ...groupBlocks);
        return arr;
      });
      setSelectedId(groupBlocks[0]?.id || null);
      return;
    }

    const b = makeBlock(type);
    setBlocks(prev => {
      const arr = [...prev];
      const safeIndex = Math.max(0, Math.min(index == null ? arr.length : index, arr.length));
      arr.splice(safeIndex, 0, b);
      return arr;
    });
    setSelectedId(b.id);
  }, []);

  const addBlock = useCallback((type) => {
    const selectedIndex = blocks.findIndex(b => b.id === selectedId);
    insertBlockAt(type, selectedIndex >= 0 ? selectedIndex + 1 : null);
  }, [blocks, selectedId, insertBlockAt]);

  const patchBlock = useCallback((id, partial) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, props: { ...b.props, ...partial } } : b));
  }, []);

  const moveBlock = useCallback((id, dir) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      const next = dir === "up" ? idx - 1 : idx + 1;
      if (idx < 0 || next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }, []);

  const moveBlockToIndex = useCallback((id, targetIndex) => {
    setBlocks(prev => {
      const fromIndex = prev.findIndex(b => b.id === id);
      if (fromIndex < 0) return prev;

      const arr = [...prev];
      const [moved] = arr.splice(fromIndex, 1);
      let safeIndex = Math.max(0, Math.min(Number(targetIndex), arr.length));
      if (fromIndex < safeIndex) safeIndex -= 1;
      arr.splice(safeIndex, 0, moved);
      return arr;
    });
    setSelectedId(id);
  }, []);

  const handleDropAtIndex = useCallback((index) => {
    if (!dragState) return;

    if (dragState.kind === "catalog" && dragState.type) {
      insertBlockAt(dragState.type, index);
    } else if (dragState.kind === "saved" && dragState.entry) {
      insertSavedBlockAt(dragState.entry, index);
    } else if (dragState.kind === "canvas" && dragState.blockId) {
      moveBlockToIndex(dragState.blockId, index);
    }

    setDropIndex(null);
    setDragState(null);
  }, [dragState, insertBlockAt, insertSavedBlockAt, moveBlockToIndex]);

  const deleteBlock = useCallback((id) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    setSelectedId(s => s === id ? null : s);
  }, []);

  const patchCommonCardProps = useCallback((groupId, type, partial) => {
    if (!groupId || !type) return;
    setBlocks(prev => prev.map((b) => (
      b.type === type && b.props?.groupId === groupId
        ? { ...b, props: { ...b.props, ...partial } }
        : b
    )));
  }, []);

  const addSiblingCardBlock = useCallback((type, currentId) => {
    let nextId = null;
    setBlocks(prev => {
      const idx = prev.findIndex((b) => b.id === currentId);
      if (idx < 0) return prev;
      const current = prev[idx];
      const groupId = current?.props?.groupId;
      let insertIndex = idx;

      while (
        insertIndex + 1 < prev.length &&
        prev[insertIndex + 1]?.type === type &&
        prev[insertIndex + 1]?.props?.groupId === groupId
      ) {
        insertIndex += 1;
      }

      const clone = {
        id: uid(),
        type,
        props: {
          ...withNormalizedBlockProps(type),
          groupId,
          sectionBgColor: current?.props?.sectionBgColor || "#ffffff",
          sectionHeadline: current?.props?.sectionHeadline || "",
          sectionSubtext: current?.props?.sectionSubtext || "",
          perRow: current?.props?.perRow || (type === "gridCard" ? 2 : 1),
          blockRadius: resolveBlockRadius(current?.props || {}, defaultBlockRadius(type)),
          bgColor: current?.props?.bgColor || "#ffffff",
          imageWidthPct: current?.props?.imageWidthPct || 100,
          imageHeightPx: current?.props?.imageHeightPx || (type === "gridCard" ? 160 : 110),
          overlayEnabled: false,
          overlayBgColor: current?.props?.overlayBgColor || "rgba(15,23,42,0.38)",
          overlayX: current?.props?.overlayX || 50,
          overlayY: current?.props?.overlayY || 50,
          imageSrc: "",
          linkHref: "",
          title: type === "gridCard" ? "New Card" : "New Item",
          text: type === "gridCard" ? "Description text goes here." : "Description here.",
        },
      };

      nextId = clone.id;
      const arr = [...prev];
      arr.splice(insertIndex + 1, 0, clone);
      return arr;
    });
    if (nextId) {
      setSelectedId(nextId);
      setSelectedSection(null);
      setPanelMode("block");
    }
  }, []);

  const duplicateBlock = useCallback((id) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx < 0) return prev;
      const clone = { ...prev[idx], id: uid(), props: deepClone(prev[idx].props) };
      const arr = [...prev];
      arr.splice(idx + 1, 0, clone);
      return arr;
    });
  }, []);

  // ── Image upload ───────────────────────────────────────────────
  const uploadImage = useCallback(async (file, blockId, field, idx = null) => {
    const safeUid = String(userId || "").trim();
    if (!safeUid) { showToast("Sign in required to upload images.", "err"); return; }
    showToast("Uploading…", "ok");
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const resp = await emailEditorFetch("/api/social/save-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl: base64, description: file.name || "upload.png" }),
      }, {
        authErrorMessage: "Sign in required to upload images.",
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok || !payload?.image?.url) throw new Error(payload?.error || "Upload failed");
      const url = payload.image.url;

      if (blockId === "__emailSettings") {
        setDocSettings(prev => normalizeEmailSettings({ ...prev, [field]: url }));
        showToast("Image uploaded!", "ok");
        return;
      }

      setBlocks(prev => prev.map(b => {
        if (b.id !== blockId) return b;
        const p = { ...b.props };

        if (field === "imageSrc_col" && idx !== null) {
          const columns = p.columns.map((c, i) => i === idx ? { ...c, imageSrc: url } : c);
          return { ...b, props: { ...p, columns } };
        }
        if (field === "imageSrc_item" && idx !== null) {
          const items = p.items.map((it, i) => i === idx ? { ...it, imageSrc: url } : it);
          return { ...b, props: { ...p, items } };
        }
        return { ...b, props: { ...p, [field]: url } };
      }));

      showToast("Image uploaded!", "ok");
    } catch (err) {
      showToast(err?.message || "Upload failed.", "err");
    }
  }, [userId, showToast]);

  // ── Thumbnail capture ──────────────────────────────────────────
  const { saveDoc, saveAs } = useDocumentPersistence({ canvasRef, userId, blocks, docSettings, docId, docName, templateScope, templatePath, setIsSaving, setTemplatePath, setTemplateScope, setDocId, setDocName, showToast, showSaveDialog, onSaved });

  // ── Export ─────────────────────────────────────────────────────
  const openRecentDoc = useCallback((nextDocId) => {
    if (!nextDocId) return;
    setFileMenuOpen(false);
    router.push(`/modules/email/editor?id=${encodeURIComponent(nextDocId)}`);
  }, [router]);

  const doExport = useCallback(() => {
    const html = exportFullHtml(blocks, docName, docSettings);
    if (onExportHtml) { onExportHtml(html); return; }
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(docName || "email").replace(/[^a-z0-9]/gi, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("HTML downloaded!", "ok");
  }, [blocks, docName, docSettings, onExportHtml, showToast]);

  // ── Copy HTML ──────────────────────────────────────────────────
  const copyHtml = useCallback(() => {
    const html = exportFullHtml(blocks, docName, docSettings);
    navigator.clipboard?.writeText(html).then(() => showToast("HTML copied!", "ok")).catch(() => showToast("Copy failed — use Export instead.", "err"));
  }, [blocks, docName, docSettings, showToast]);

  const openPreviewPage = useCallback(() => {
    try {
      const html = exportFullHtml(blocks, docName, docSettings);
      const blob = new Blob([html], { type: "text/html" });
      const previewUrl = URL.createObjectURL(blob);
      const previewWindow = window.open(previewUrl, "_blank");
      if (!previewWindow) {
        URL.revokeObjectURL(previewUrl);
        showToast("Allow popups to open the preview.", "err");
        return;
      }
      setTimeout(() => URL.revokeObjectURL(previewUrl), 60000);
    } catch {
      showToast("Preview could not be opened.", "err");
    }
  }, [blocks, docName, docSettings, showToast]);

  const startTextToolbarDrag = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const originX = floatingTextBar.x;
    const originY = floatingTextBar.y;

    const handleMove = (moveEvent) => {
      const nextX = clamp(originX + (moveEvent.clientX - startX), 12, (window.innerWidth || 1280) - 120);
      const nextY = clamp(originY + (moveEvent.clientY - startY), 12, (window.innerHeight || 900) - 56);
      setFloatingTextBar((prev) => ({ ...prev, visible: true, x: nextX, y: nextY }));
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [floatingTextBar.x, floatingTextBar.y]);


  // Preview mode: render only exported HTML, no overlays/toolbars
  if (previewMode) {
    const html = exportFullHtml(blocks, docName, docSettings);
    return (
      <div style={{ width: "100vw", minHeight: "100vh", background: "#e0f0fa" }}>
        <iframe
          title="Email Preview"
          srcDoc={html}
          style={{ width: "100%", minHeight: "100vh", border: "none", background: "#e0f0fa" }}
          sandbox="allow-same-origin"
        />
      </div>
    );
  }

  const selectedBlock = blocks.find(b => b.id === selectedId) ?? null;
  const selectedSectionBlock = selectedSection
    ? blocks.find(b => isCardBlockType(b.type) && b.props?.groupId === selectedSection.groupId) ?? null
    : null;
  const isLegacyHtmlMode = blocks.length === 1 && blocks[0]?.type === "text" && blocks[0]?.props?.rawHtml;
  const renderGroups = [];

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (isCardBlockType(block?.type) && block?.props?.groupId) {
      const grouped = [block];
      const startIndex = i;
      while (
        i + 1 < blocks.length &&
        blocks[i + 1]?.type === block.type &&
        blocks[i + 1]?.props?.groupId === block.props.groupId
      ) {
        grouped.push(blocks[i + 1]);
        i += 1;
      }
      renderGroups.push({ kind: "group", blocks: grouped, startIndex });
    } else {
      renderGroups.push({ kind: "single", block, startIndex: i });
    }
  }

  return (
    <div className="email-editor-shell" style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "Inter,system-ui,Arial,sans-serif", background: "#e0f0fa", overflowY: "auto", overflowX: "hidden" }}>
      <EmailEditorStyles />
      {imageEditState && (
        <ImageEditModal
          src={imageEditState.src}
          userId={userId}
          onDone={applyEditedImage}
          onCancel={() => setImageEditState(null)}
        />
      )}
      {showAiGenerate && (
        <AiGenerateModal
          userId={userId}
          onClose={() => setShowAiGenerate(false)}
          onInsert={handleAiInsert}
        />
      )}
      {aiImageState && (
        <AiImageModal
          userId={userId}
          onClose={() => setAiImageState(null)}
          onSelect={applyAiImage}
        />
      )}
      {libraryState && (
        <ImageLibraryModal
          userId={userId}
          onPick={applyLibraryImage}
          onClose={() => setLibraryState(null)}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, background: toast.type === "err" ? "#ef4444" : "#16a34a",
          color: "#fff", padding: "10px 22px", borderRadius: 8,
          fontWeight: 600, fontSize: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.22)",
          pointerEvents: "none",
        }}>
          {toast.msg}
        </div>
      )}
      {saveDialog && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "min(100%, 420px)", background: "#fff", borderRadius: 14, boxShadow: "0 20px 60px rgba(15,23,42,0.24)", overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", background: saveDialog.type === "err" ? "#fff1f2" : "#ecfdf5", color: saveDialog.type === "err" ? "#b91c1c" : "#166534", fontSize: 16, fontWeight: 600 }}>
              {saveDialog.type === "err" ? "Save Problem" : "Save Complete"}
            </div>
            <div style={{ padding: 16, color: "#0f172a", fontSize: 16, fontWeight: 600, lineHeight: 1.6 }}>
              {saveDialog.msg}
            </div>
            <div style={{ padding: "0 16px 16px", display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setSaveDialog(null)} style={{ height: 38, padding: "0 16px", border: "none", borderRadius: 8, background: "#2563eb", color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAGE BANNER ── */}
      <div style={{ padding: "24px 32px 0", flexShrink: 0 }}>
      <div style={{ background: "linear-gradient(135deg, #0a5c38 0%, #052b1b 100%)", borderRadius: 18, padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1320, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <b style={{ fontSize: 48, fontWeight: "normal" }}>💌</b>
          <div>
            <h1 style={{ color: "#fff", fontSize: 48, fontWeight: 600, margin: 0, lineHeight: 1.05 }}>Email Editor</h1>
            <h2 style={{ color: "rgba(255,255,255,0.85)", fontSize: 18, fontWeight: 600, margin: "4px 0 0" }}>Design and send beautiful email campaigns</h2>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div ref={fileMenuRef} style={{ position: "relative", flexShrink: 0 }}>
            <TopBtn onClick={() => setFileMenuOpen(v => !v)} color="#0f172a">📁 File ▾</TopBtn>
            {fileMenuOpen && (
              <div style={{ position: "absolute", top: 44, right: 0, width: 290, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12, boxShadow: "0 18px 36px rgba(15,23,42,0.18)", overflow: "hidden", zIndex: 60 }}>
                <div style={{ padding: "10px 12px", fontSize: 16, fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>File</div>
                <FileMenuItem onClick={() => { setFileMenuOpen(false); setShowAiGenerate(true); }}>✨ AI Generate</FileMenuItem>
                <FileMenuItem onClick={() => { setFileMenuOpen(false); saveDoc(); }} disabled={isSaving}>{isSaving ? "Saving…" : "💾 Save"}</FileMenuItem>
                <FileMenuItem onClick={() => { setFileMenuOpen(false); saveAs(); }} disabled={isSaving}>📄 Save As</FileMenuItem>
                <FileMenuItem onClick={() => { setFileMenuOpen(false); doExport(); }}>⬇ Export HTML</FileMenuItem>
                <FileMenuItem onClick={() => { setFileMenuOpen(false); copyHtml(); }}>📋 Copy HTML</FileMenuItem>

                <div style={{ padding: "10px 12px", fontSize: 16, fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", background: "#f8fafc", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>Recent Files</div>
                {loadingRecentDocs ? (
                  <div style={{ padding: "12px", fontSize: 16, color: "#64748b" }}>Loading recent files…</div>
                ) : recentDocs.length ? (
                  recentDocs.map((doc) => (
                    <button
                      key={doc.docId}
                      type="button"
                      onClick={() => openRecentDoc(doc.docId)}
                      style={{ width: "100%", border: "none", background: "#fff", padding: "10px 12px", textAlign: "left", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}
                      title={doc.name || "Untitled Email"}
                    >
                      <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.name || "Untitled Email"}</div>
                      <div style={{ fontSize: 16, color: "#64748b", marginTop: 2 }}>{doc.updatedAt ? new Date(doc.updatedAt).toLocaleString() : "Saved file"}</div>
                    </button>
                  ))
                ) : (
                  <div style={{ padding: "12px", fontSize: 16, color: "#64748b" }}>No recent saved files yet.</div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => router.push('/modules/email/templates/select')}
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "2px solid rgba(255,255,255,0.4)", borderRadius: 10, padding: "10px 20px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
          >← Back</button>
        </div>
      </div>
      </div>

      {/* ── PANELS ── */}
      <div style={{ flex: 1, display: "flex", maxWidth: isLegacyHtmlMode ? 1500 : 1320, width: "100%", margin: "16px auto 0", overflow: "hidden", borderRadius: "16px 16px 0 0", boxShadow: "0 -2px 20px rgba(0,0,0,0.08)" }}>
      {/* ── LEFT: block catalog ── */}
      <div style={{ width: 196, flexShrink: 0, background: "#0f172a", display: "flex", flexDirection: "column", borderRight: "1px solid #1e293b", overflow: "hidden", borderRadius: "16px 0 0 0" }}>
        <div style={{ padding: "14px 16px 8px", fontSize: 16, fontWeight: 600, color: "#05f5f9", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          + Add Or Drag Blocks
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {CATALOG.map(c => (
            <CatalogBtn
              key={c.type}
              icon={c.icon}
              label={c.label}
              onClick={() => addBlock(c.type)}
              onDragStart={() => setDragState({ kind: "catalog", type: c.type })}
              onDragEnd={() => { setDragState(null); setDropIndex(null); }}
            />
          ))}

          {/* Saved blocks section */}
          {savedBlocks.length > 0 && (
            <>
              <div style={{ padding: "12px 14px 6px", fontSize: 20, fontWeight: 600, color: "#f9ae00", letterSpacing: "0.12em", textTransform: "uppercase", borderTop: "1px solid #1e293b", marginTop: 8 }}>
                Saved
              </div>
              {savedBlocks.map((entry, i) => (
                <SavedBtn
                  key={i}
                  label={entry.label}
                  onInsert={() => insertSavedBlock(entry)}
                  onDelete={() => deleteSavedBlock(i)}
                  onDragStart={() => setDragState({ kind: "saved", entry })}
                  onDragEnd={() => { setDragState(null); setDropIndex(null); }}
                />
              ))}
            </>
          )}
          {savedBlocks.length === 0 && (
            <div style={{ padding: "14px", fontSize: 18, color: "#0068f9", borderTop: "1px solid #1e293b", marginTop: 8 }}>
              Click or drag blocks into the canvas, then save favorites for reuse
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: canvas ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 16px",
          background: "#fff", borderBottom: "1px solid #e2e8f0", flexShrink: 0,
        }}>
          <input
            value={docName}
            onChange={e => setDocName(e.target.value)}
            style={{ flex: 1, height: 40, border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, padding: "0 12px", fontSize: 16, fontWeight: 600, color: "#ffffff", background: "#0f172a", WebkitTextFillColor: "#ffffff", colorScheme: "dark", minWidth: 0 }}
            placeholder="Email name…"
          />
          <TopBtn onClick={() => { setSelectedId(null); setSelectedSection(null); setPanelMode("canvas"); openPreviewPage(); }} color="#7c3aed">Preview Email</TopBtn>
          <TopBtn onClick={() => { setSelectedId(null); setSelectedSection(null); setPanelMode("canvas"); }} color="#0f766e">🎨 Email Style</TopBtn>
        </div>
        <FloatingTextToolbar
          visible={!!selectedBlock && !!floatingTextBar.visible}
          position={floatingTextBar}
          onDragStart={startTextToolbarDrag}
          onClose={() => setFloatingTextBar((prev) => ({ ...prev, visible: false }))}
        >
          {selectedBlock ? (
            <TextRibbon
              block={selectedBlock}
              patch={partial => patchBlock(selectedBlock.id, partial)}
              patchCommon={partial => patchCommonCardProps(selectedBlock.props?.groupId, selectedBlock.type, partial)}
              compact
            />
          ) : null}
        </FloatingTextToolbar>

        {/* Scrollable canvas */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isLegacyHtmlMode ? "16px" : "28px 0",
            background: docSettings.outerBgColor || "transparent",
            backgroundImage: docSettings.outerBgImageSrc ? `linear-gradient(rgba(255,255,255,0.2), rgba(255,255,255,0.2)), url(${docSettings.outerBgImageSrc})` : undefined,
            backgroundSize: docSettings.outerBgRepeat === "no-repeat" ? "cover" : "auto",
            backgroundPosition: "center",
            backgroundRepeat: docSettings.outerBgRepeat || "no-repeat",
          }}
          onClick={e => { if (e.target === e.currentTarget) { setSelectedId(null); setPanelMode("canvas"); } }}
        >
          <div ref={canvasRef} style={{ width: isLegacyHtmlMode ? "min(100%, 1100px)" : docSettings.canvasWidth, margin: "0 auto", paddingBottom: 60, background: docSettings.canvasBgColor || "transparent", borderRadius: docSettings.canvasRadius, boxShadow: isLegacyHtmlMode || docSettings.canvasBgColor === "transparent" ? "none" : "0 12px 30px rgba(15,23,42,0.12)", overflow: "hidden" }}>
            {blocks.length === 0 && (
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setDropIndex(0);
                }}
                onDrop={e => {
                  e.preventDefault();
                  handleDropAtIndex(0);
                }}
                style={{
                  textAlign: "center",
                  color: "#1d6ad6",
                  padding: "80px 20px",
                  border: dropIndex === 0 ? "2px dashed #2563eb" : "2px dashed #cbd5e1",
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 600,
                  background: dropIndex === 0 ? "rgba(37,99,235,0.08)" : "transparent",
                }}
              >
                Drag blocks here or click from the left panel
              </div>
            )}
            {renderGroups.map((entry, groupIdx) => {
              const groupSelected = entry.kind === "group" && (
                entry.blocks.some((block) => block.id === selectedId) ||
                (panelMode === "section" && selectedSection?.groupId === entry.blocks[0]?.props?.groupId)
              );
              const groupPerRow = entry.kind === "group"
                ? Math.max(1, Math.min(4, Number(entry.blocks[0]?.props?.perRow || (entry.blocks[0]?.type === "gridCard" ? 2 : 1))))
                : 1;
              return (
              <div key={entry.kind === "group" ? `${entry.blocks[0]?.props?.groupId}-${groupIdx}` : entry.block.id}>
                <DropZone
                  active={dropIndex === entry.startIndex}
                  onDragOver={() => setDropIndex(entry.startIndex)}
                  onDrop={() => handleDropAtIndex(entry.startIndex)}
                />
                {entry.kind === "single" ? (
                  <BlockWrapper
                    block={entry.block}
                    isSelected={entry.block.id === selectedId}
                    isFirst={entry.startIndex === 0}
                    isLast={entry.startIndex === blocks.length - 1}
                    onClick={() => setSelectedId(entry.block.id)}
                    onTextFocus={() => { setSelectedId(entry.block.id); setPanelMode("block"); setSelectedSection(null); }}
                    onUp={() => moveBlock(entry.block.id, "up")}
                    onDown={() => moveBlock(entry.block.id, "down")}
                    onDelete={() => deleteBlock(entry.block.id)}
                    onDuplicate={() => duplicateBlock(entry.block.id)}
                    onSave={() => saveBlock(entry.block)}
                    onDragStart={() => setDragState({ kind: "canvas", blockId: entry.block.id })}
                    onDragEnd={() => { setDragState(null); setDropIndex(null); }}
                    onPatch={(partial) => patchBlock(entry.block.id, partial)}
                    uploadForBlock={(file, field, i) => uploadImage(file, entry.block.id, field, i)}
                  />
                ) : (
                  <div
                    onClick={(e) => {
                      if (e.target === e.currentTarget) {
                        setSelectedId(null);
                        setSelectedSection({ groupId: entry.blocks[0]?.props?.groupId, type: entry.blocks[0]?.type });
                        setPanelMode("section");
                      }
                    }}
                    title="Click this section background to edit grid/list colours"
                    style={{
                      position: "relative",
                      background: entry.blocks[0]?.props?.sectionBgColor || "#ffffff",
                      borderRadius: 14,
                      padding: "42px 10px 10px",
                      outline: groupSelected ? "2px solid #2563eb" : "1px dashed rgba(148,163,184,0.45)",
                      outlineOffset: 2,
                      cursor: "pointer",
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(null);
                        setSelectedSection({ groupId: entry.blocks[0]?.props?.groupId, type: entry.blocks[0]?.type });
                        setPanelMode("section");
                      }}
                      style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        border: "1px solid #93c5fd",
                        borderRadius: 999,
                        background: groupSelected ? "#dbeafe" : "rgba(255,255,255,0.96)",
                        color: "#1d4ed8",
                        fontSize: 16,
                        fontWeight: 600,
                        padding: "6px 10px",
                        cursor: "pointer",
                        zIndex: 2,
                      }}
                    >
                      🎨 Edit Section Background
                    </button>
                    {((groupSelected || entry.blocks[0]?.props?.sectionHeadline || entry.blocks[0]?.props?.sectionSubtext) ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(entry.blocks[0]?.id || null);
                          setSelectedSection(null);
                          setPanelMode("block");
                        }}
                        style={{ width: "100%", padding: "0 8px 10px", textAlign: "center" }}
                      >
                        <InlineEditableText
                          as="div"
                          value={entry.blocks[0]?.props?.sectionHeadline}
                          onChange={(v) => patchCommonCardProps(entry.blocks[0]?.props?.groupId, entry.blocks[0]?.type, { sectionHeadline: v })}
                          placeholder="Click to add section headline"
                          style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2, color: ensureReadableColor("", entry.blocks[0]?.props?.sectionBgColor || "#ffffff", "#ffffff", "#0f172a"), marginBottom: entry.blocks[0]?.props?.sectionSubtext ? 6 : 0 }}
                        />
                        {(groupSelected || entry.blocks[0]?.props?.sectionSubtext) && (
                          <InlineEditableText
                            value={entry.blocks[0]?.props?.sectionSubtext}
                            onChange={(v) => patchCommonCardProps(entry.blocks[0]?.props?.groupId, entry.blocks[0]?.type, { sectionSubtext: v })}
                            placeholder="Optional intro text"
                            style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5, color: ensureReadableColor("", entry.blocks[0]?.props?.sectionBgColor || "#ffffff", "#e5e7eb", "#475569") }}
                          />
                        )}
                      </div>
                    ) : null)}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${groupPerRow}, minmax(0, 1fr))`,
                        gap: 12,
                        width: "100%",
                        alignItems: "start",
                      }}
                    >
                    {entry.blocks.map((block) => {
                      return (
                        <div key={block.id} style={{ minWidth: 0 }}>
                          <BlockWrapper
                            block={block}
                            isSelected={block.id === selectedId}
                            isFirst={false}
                            isLast={false}
                            onClick={() => setSelectedId(block.id)}
                            onTextFocus={() => { setSelectedId(block.id); setPanelMode("block"); setSelectedSection(null); }}
                            onUp={() => moveBlock(block.id, "up")}
                            onDown={() => moveBlock(block.id, "down")}
                            onDelete={() => deleteBlock(block.id)}
                            onDuplicate={() => duplicateBlock(block.id)}
                            onSave={() => saveBlock(block)}
                            onDragStart={() => setDragState({ kind: "canvas", blockId: block.id })}
                            onDragEnd={() => { setDragState(null); setDropIndex(null); }}
                            onPatch={(partial) => patchBlock(block.id, partial)}
                            uploadForBlock={(file, field, i) => uploadImage(file, block.id, field, i)}
                          />
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>
              );
            })}
            {blocks.length > 0 && (
              <DropZone
                active={dropIndex === blocks.length}
                onDragOver={() => setDropIndex(blocks.length)}
                onDrop={() => handleDropAtIndex(blocks.length)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT: inspector ── */}
      <EditorInspector
        selectedSectionBlock={selectedSectionBlock}
        panelMode={panelMode}
        selectedBlock={selectedBlock}
        blocks={blocks}
        patchCommonCardProps={patchCommonCardProps}
        addSiblingCardBlock={addSiblingCardBlock}
        patchBlock={patchBlock}
        duplicateBlock={duplicateBlock}
        deleteBlock={deleteBlock}
        uploadImage={uploadImage}
        openImageEdit={openImageEdit}
        openLibrary={openLibrary}
        openAiImage={openAiImage}
        docSettings={docSettings}
        setDocSettings={setDocSettings}
      />
      </div>
    </div>
  );
}
