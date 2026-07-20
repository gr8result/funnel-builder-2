import { useEffect, useMemo, useRef, useState } from "react";
import {
  createBlankStandardInclusionsV2Document,
  createStandardInclusionsV2Page,
  normaliseStandardInclusionsV2Document,
} from "../../lib/standard-inclusions-v2/schema";
import { createStandardInclusionsV2Store } from "../../lib/standard-inclusions-v2/storage";

const OWNER_USER_ID = "local-user";

export default function StandardInclusionsV2({ sheet }) {
  const store = useMemo(() => createStandardInclusionsV2Store(), []);
  const tenantId = String(sheet?.workbook?.builderId || sheet?.workbook?.id || "local-tenant");
  const ownerUserId = String(sheet?.workbook?.ownerUserId || sheet?.workbook?.userId || OWNER_USER_ID);
  const [document, setDocument] = useState(null);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [dragPageId, setDragPageId] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    store.loadActiveDocument({ tenantId, ownerUserId })
      .then(async (activeDocument) => {
        if (cancelled) return;
        const navigation = await store.loadNavigation({ tenantId, ownerUserId });
        setDocument(activeDocument);
        setSelectedPageId(navigation.selectedPageId || activeDocument?.pages?.[0]?.id || "");
        setZoom(Number(navigation.zoom || 1));
      })
      .catch((error) => setStatus(error?.message || "Could not load Standard Inclusions V2."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [store, tenantId, ownerUserId]);

  const pages = Array.isArray(document?.pages) ? [...document.pages].sort((a, b) => Number(a.order || 0) - Number(b.order || 0)) : [];
  const selectedPage = pages.find((page) => page.id === selectedPageId) || pages[0] || null;

  async function createBlankSchedule() {
    const blank = createBlankStandardInclusionsV2Document({ tenantId, ownerUserId });
    const firstPage = createStandardInclusionsV2Page({ name: "Page 1", order: 0 });
    const nextDocument = { ...blank, pages: [firstPage] };
    const saved = await store.saveDocument(nextDocument, { tenantId, ownerUserId, trigger: "create-blank", createRevision: false });
    await store.saveNavigation({ tenantId, ownerUserId, documentId: saved.id, selectedPageId: firstPage.id, zoom });
    setDocument(saved);
    setSelectedPageId(firstPage.id);
    setStatus("Blank schedule created.");
  }

  async function saveCurrent(nextDocument = document, nextSelectedPageId = selectedPageId, message = "Saved.") {
    if (!nextDocument) return null;
    const normalized = normaliseStandardInclusionsV2Document(nextDocument);
    const saved = await store.saveDocument(normalized, {
      tenantId,
      ownerUserId,
      baseUpdatedAt: document?.updatedAt || "",
      baseRevisionId: document?.activeRevisionId || "",
      trigger: "manual-save",
    });
    await store.saveNavigation({ tenantId, ownerUserId, documentId: saved.id, selectedPageId: nextSelectedPageId, zoom });
    setDocument(saved);
    setSelectedPageId(nextSelectedPageId || saved.pages[0]?.id || "");
    setStatus(message);
    return saved;
  }

  async function updateDocument(nextDocument, nextSelectedPageId = selectedPageId, message = "") {
    setDocument(normaliseStandardInclusionsV2Document(nextDocument));
    if (nextSelectedPageId) setSelectedPageId(nextSelectedPageId);
    if (message) setStatus(message);
  }

  async function addPage() {
    if (!document) return;
    const page = createStandardInclusionsV2Page({ name: `Page ${pages.length + 1}`, order: pages.length });
    await updateDocument({ ...document, pages: [...pages, page] }, page.id, "Page added.");
  }

  async function duplicatePage() {
    if (!document || !selectedPage) return;
    const page = {
      ...selectedPage,
      id: createStandardInclusionsV2Page().id,
      name: `${selectedPage.name} Copy`,
      order: pages.findIndex((item) => item.id === selectedPage.id) + 1,
      elements: selectedPage.elements.map((element) => ({ ...element, id: `${element.id}-copy-${Date.now()}` })),
    };
    const selectedIndex = pages.findIndex((item) => item.id === selectedPage.id);
    const nextPages = [...pages];
    nextPages.splice(selectedIndex + 1, 0, page);
    await updateDocument({ ...document, pages: reorderPages(nextPages) }, page.id, "Page duplicated.");
  }

  async function deletePage() {
    if (!document || !selectedPage) return;
    const nextPages = reorderPages(pages.filter((page) => page.id !== selectedPage.id));
    const nextSelected = nextPages[0]?.id || "";
    await updateDocument({ ...document, pages: nextPages }, nextSelected, "Page deleted.");
  }

  async function renamePage(pageId, name) {
    if (!document) return;
    await updateDocument({
      ...document,
      pages: pages.map((page) => page.id === pageId ? { ...page, name: name || page.name } : page),
    }, pageId, "Page renamed.");
  }

  async function movePage(pageId, direction) {
    const index = pages.findIndex((page) => page.id === pageId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= pages.length) return;
    const nextPages = [...pages];
    const [page] = nextPages.splice(index, 1);
    nextPages.splice(target, 0, page);
    await updateDocument({ ...document, pages: reorderPages(nextPages) }, pageId, "Pages reordered.");
  }

  async function dropPage(targetPageId) {
    if (!dragPageId || dragPageId === targetPageId) return;
    const nextPages = [...pages];
    const from = nextPages.findIndex((page) => page.id === dragPageId);
    const to = nextPages.findIndex((page) => page.id === targetPageId);
    if (from < 0 || to < 0) return;
    const [page] = nextPages.splice(from, 1);
    nextPages.splice(to, 0, page);
    setDragPageId("");
    await updateDocument({ ...document, pages: reorderPages(nextPages) }, dragPageId, "Pages reordered.");
  }

  async function deleteSchedule() {
    if (!document) return;
    await store.deleteDocument({ tenantId, ownerUserId, documentId: document.id });
    setDocument(null);
    setSelectedPageId("");
    setStatus("Schedule deleted.");
  }

  async function setZoomAndPersist(nextZoom) {
    const safeZoom = Math.min(1.6, Math.max(0.45, Number(nextZoom) || 1));
    setZoom(safeZoom);
    await store.saveNavigation({ tenantId, ownerUserId, documentId: document?.id || "", selectedPageId, zoom: safeZoom });
  }

  if (loading) {
    return <section style={styles.panel}>Loading Standard Inclusions V2...</section>;
  }

  return (
    <div style={styles.shell} data-standard-inclusions-v2="true">
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Standard Inclusions V2</div>
          <h2 style={styles.title}>Document Page Builder</h2>
        </div>
        {status ? <div style={styles.status}>{status}</div> : null}
      </div>

      {!document ? (
        <StandardInclusionsV2EmptyState onCreateBlank={createBlankSchedule} />
      ) : (
        <div style={styles.editor}>
          <div style={styles.toolbar}>
            <input
              aria-label="Document name"
              style={styles.nameInput}
              value={document.name}
              onChange={(event) => setDocument({ ...document, name: event.target.value })}
            />
            <button type="button" style={styles.iconButton} disabled>Undo</button>
            <button type="button" style={styles.iconButton} disabled>Redo</button>
            <button type="button" style={styles.primaryButton} onClick={() => saveCurrent(document, selectedPageId, "Saved.")}>Save</button>
            <button type="button" style={styles.secondaryButton} disabled>Preview</button>
            <button type="button" style={styles.secondaryButton} disabled>Export PDF</button>
            <button type="button" style={styles.secondaryButton} disabled>Replace Schedule</button>
            <button type="button" style={styles.dangerButton} onClick={deleteSchedule}>Delete Schedule</button>
            <button type="button" style={styles.secondaryButton}>Close</button>
          </div>

          <aside style={styles.leftPanel}>
            <div style={styles.pageActions}>
              <button type="button" style={styles.secondaryButton} onClick={addPage}>Add Page</button>
              <button type="button" style={styles.secondaryButton} disabled={!selectedPage} onClick={duplicatePage}>Duplicate</button>
              <button type="button" style={styles.dangerButton} disabled={!selectedPage} onClick={deletePage}>Delete</button>
            </div>
            <div style={styles.pageList}>
              {pages.map((page, index) => (
                <button
                  key={page.id}
                  type="button"
                  draggable
                  onDragStart={() => setDragPageId(page.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropPage(page.id)}
                  onClick={() => {
                    setSelectedPageId(page.id);
                    store.saveNavigation({ tenantId, ownerUserId, documentId: document.id, selectedPageId: page.id, zoom });
                  }}
                  style={{ ...styles.pageThumbButton, ...(page.id === selectedPage?.id ? styles.pageThumbButtonActive : {}) }}
                >
                  <span style={styles.thumbnail}>
                    <span style={styles.thumbnailPageNumber}>{index + 1}</span>
                  </span>
                  <input
                    aria-label={`Rename ${page.name}`}
                    style={styles.pageNameInput}
                    value={page.name}
                    onChange={(event) => renamePage(page.id, event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                  />
                  <span style={styles.pageMoveRow}>
                    <span onClick={(event) => { event.stopPropagation(); movePage(page.id, -1); }}>Move Up</span>
                    <span onClick={(event) => { event.stopPropagation(); movePage(page.id, 1); }}>Move Down</span>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <main style={styles.canvasWrap}>
            <div style={styles.canvasToolbar}>
              <span>{selectedPage?.name || "No page selected"}</span>
              <label style={styles.zoomLabel}>Zoom
                <input type="range" min="0.45" max="1.6" step="0.05" value={zoom} onChange={(event) => setZoomAndPersist(event.target.value)} />
              </label>
            </div>
            {selectedPage ? (
              <div style={styles.rulerFrame}>
                <div style={{ ...styles.canvas, width: selectedPage.width * zoom, height: selectedPage.height * zoom }}>
                  <div style={{ ...styles.pageSurface, width: selectedPage.width, height: selectedPage.height, transform: `scale(${zoom})` }}>
                    <div style={styles.emptyPageHint}>{selectedPage.name}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={styles.noPage}>Add a page to begin.</div>
            )}
          </main>

          <aside style={styles.rightPanel}>
            <h3 style={styles.panelTitle}>Page</h3>
            <label style={styles.fieldLabel}>Name
              <input style={styles.fieldInput} value={selectedPage?.name || ""} onChange={(event) => selectedPage && renamePage(selectedPage.id, event.target.value)} />
            </label>
            <p style={styles.helpText}>Element tools begin in Phase 2. Phase 1 locks the document model, storage, navigation, and page operations first.</p>
          </aside>
        </div>
      )}
    </div>
  );
}

function StandardInclusionsV2EmptyState({ onCreateBlank }) {
  return (
    <section style={styles.emptyState}>
      <h3 style={styles.emptyTitle}>No Standard Inclusions Schedule is currently loaded.</h3>
      <div style={styles.emptyActions}>
        <button type="button" style={styles.primaryButton} disabled>Use Base Template</button>
        <button type="button" style={styles.secondaryButton} disabled>Upload PowerPoint</button>
        <button type="button" style={styles.secondaryButton} disabled>Upload PDF</button>
        <button type="button" style={styles.primaryButton} onClick={onCreateBlank}>Create Blank Schedule</button>
        <button type="button" style={styles.secondaryButton} disabled>Restore Previous Version</button>
      </div>
    </section>
  );
}

function reorderPages(pages) {
  return (Array.isArray(pages) ? pages : []).map((page, index) => ({ ...page, order: index }));
}

const styles = {
  shell: { display: "grid", gap: 14, color: "#0f172a" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: 12, padding: 14 },
  eyebrow: { color: "#15803d", fontSize: 12, fontWeight: 900, textTransform: "uppercase" },
  title: { margin: 0, fontSize: 24, fontWeight: 950 },
  status: { border: "1px solid #86efac", background: "#ffffff", borderRadius: 8, padding: "8px 10px", fontWeight: 850 },
  panel: { border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 12, padding: 18 },
  emptyState: { border: "1px dashed #94a3b8", background: "#ffffff", borderRadius: 12, padding: 24, display: "grid", gap: 16 },
  emptyTitle: { margin: 0, fontSize: 20, fontWeight: 950 },
  emptyActions: { display: "flex", flexWrap: "wrap", gap: 10 },
  primaryButton: { border: "1px solid #15803d", background: "#15803d", color: "#ffffff", borderRadius: 8, padding: "9px 12px", fontWeight: 900, cursor: "pointer" },
  secondaryButton: { border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 8, padding: "9px 12px", fontWeight: 850, cursor: "pointer" },
  dangerButton: { border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", borderRadius: 8, padding: "9px 12px", fontWeight: 900, cursor: "pointer" },
  iconButton: { border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", borderRadius: 8, padding: "9px 12px", fontWeight: 850 },
  editor: { display: "grid", gridTemplateColumns: "250px minmax(620px, 1fr) 270px", gridTemplateRows: "auto 1fr", gap: 12, alignItems: "start" },
  toolbar: { gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", border: "1px solid #d8dee8", background: "#ffffff", borderRadius: 12, padding: 10 },
  nameInput: { minWidth: 260, border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 10px", fontWeight: 900, fontSize: 16 },
  leftPanel: { border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 12, padding: 10, display: "grid", gap: 10, maxHeight: "calc(100vh - 190px)", overflow: "auto" },
  pageActions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },
  pageList: { display: "grid", gap: 8 },
  pageThumbButton: { border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 8, padding: 8, display: "grid", gap: 6, textAlign: "left", cursor: "pointer" },
  pageThumbButtonActive: { borderColor: "#15803d", background: "#f0fdf4" },
  thumbnail: { width: "100%", aspectRatio: "1 / 1.414", border: "1px solid #cbd5e1", borderRadius: 5, background: "#ffffff", display: "grid", placeItems: "center" },
  thumbnailPageNumber: { fontSize: 28, fontWeight: 950, color: "#94a3b8" },
  pageNameInput: { border: "1px solid #cbd5e1", borderRadius: 6, padding: "7px 8px", fontWeight: 850 },
  pageMoveRow: { display: "flex", justifyContent: "space-between", gap: 8, color: "#15803d", fontSize: 12, fontWeight: 900 },
  canvasWrap: { minHeight: 720, border: "1px solid #94a3b8", borderRadius: 12, background: "#dbe4ee", padding: 12, display: "grid", gap: 10 },
  canvasToolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontWeight: 900 },
  zoomLabel: { display: "flex", alignItems: "center", gap: 8 },
  rulerFrame: { overflow: "auto", display: "grid", placeItems: "start center", minHeight: 650 },
  canvas: { position: "relative", flex: "0 0 auto" },
  pageSurface: { transformOrigin: "top left", background: "#ffffff", boxShadow: "0 20px 48px rgba(15,23,42,0.24)", position: "relative", overflow: "hidden" },
  emptyPageHint: { position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#94a3b8", fontSize: 42, fontWeight: 950 },
  noPage: { border: "1px dashed #94a3b8", borderRadius: 10, background: "#ffffff", padding: 24, fontWeight: 900 },
  rightPanel: { border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 12, padding: 12, display: "grid", gap: 10 },
  panelTitle: { margin: 0, fontSize: 18, fontWeight: 950 },
  fieldLabel: { display: "grid", gap: 5, fontSize: 12, fontWeight: 900, color: "#475569" },
  fieldInput: { border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 10px", color: "#0f172a", fontWeight: 800 },
  helpText: { margin: 0, color: "#64748b", lineHeight: 1.45, fontSize: 13, fontWeight: 700 },
};
