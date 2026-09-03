import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import { addPage, createElement, createPage, duplicatePage, estimateSummary, formatCurrency, insertShape, movePage, SHAPE_TYPES } from "../../lib/page-builder/model";

const STORAGE_KEY = "gr8-page-builder-document";
const starterRows = estimateSummary({}).stages;

function starterPage() {
  return createPage("Estimated Construction Cost", [
    createElement("text", { x: 8, y: 7, width: 84, height: 7, text: "ESTIMATED PRICE / INVESTMENT SUMMARY", color: "#d4af55", mode: "text" }),
    createElement("text", { x: 8, y: 14, width: 84, height: 9, text: "$0.00 inc GST", color: "#ffffff", mode: "text" }),
    createElement("text", { x: 8, y: 25, width: 84, height: 6, text: "The estimated price breakdown below summarises the major stages and allowances included in this Project Estimate.", color: "#f8fafc", mode: "text" }),
    createElement("text", { x: 8, y: 37, width: 84, height: 7, text: "Estimated Construction Cost", color: "#ffffff", mode: "text" }),
    createElement("text", { x: 8, y: 45, width: 84, height: 5, text: "STAGE                                      %              AMOUNT", color: "#f6d27a", mode: "text" }),
    ...starterRows.map((row, index) => createElement("text", { x: 8, y: 53 + index * 6, width: 84, height: 4, text: `${row.stage}                                  ${row.percentage}%          $0.00`, color: "#dbe4ef", mode: "text" })),
  ]);
}

export default function PageBuilder() {
  const [pages, setPages] = useState(() => [starterPage()]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [quotation, setQuotation] = useState({});
  const [dragging, setDragging] = useState(null);
  const [showShapes, setShowShapes] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState("");
  const fileRef = useRef(null);
  const page = pages[activeIndex] || pages[0];
  const selected = page?.elements.find((element) => element.id === selectedId);
  const summary = useMemo(() => estimateSummary(quotation), [quotation]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(saved?.pages) && saved.pages.length) {
        setPages(saved.pages);
        setActiveIndex(Math.min(saved.activeIndex || 0, saved.pages.length - 1));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const sources = ["quotation-builder-data", "quotation", "estimate-builder-active-draft"];
      const source = sources.map((key) => JSON.parse(window.localStorage.getItem(key) || "null")).find(Boolean);
      if (source) setQuotation(source.summary || source.quotation || source);
    } catch {}
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ pages, activeIndex })); } catch {}
  }, [pages, activeIndex]);

  const updatePage = (patch) => setPages((current) => current.map((entry, index) => index === activeIndex ? { ...entry, ...patch } : entry));
  const updateElement = (patch) => setPages((current) => current.map((entry, index) => index === activeIndex ? { ...entry, elements: entry.elements.map((element) => element.id === selectedId ? { ...element, ...patch } : element) } : entry));
  const addElement = (type, overrides = {}) => {
    const element = createElement(type, overrides);
    updatePage({ elements: [...page.elements, element] });
    setSelectedId(element.id);
  };
  const addNewPage = () => {
    const next = addPage(pages, `Page ${pages.length + 1}`);
    setPages(next);
    setActiveIndex(next.length - 1);
  };
  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updatePage({ backgroundImage: String(reader.result || "") });
    reader.readAsDataURL(file);
  };
  const handleElementPointerDown = (event, element) => {
    if (element.locked) return;
    event.stopPropagation();
    setSelectedId(element.id);
    setDragging({ id: element.id, x: event.clientX, y: event.clientY, left: element.x, top: element.y });
  };
  useEffect(() => {
    if (!dragging) return undefined;
    const move = (event) => {
      const dx = ((event.clientX - dragging.x) / 850) * 100;
      const dy = ((event.clientY - dragging.y) / 1200) * 100;
      updateElement({ x: Math.max(0, Math.min(90, dragging.left + dx)), y: Math.max(0, Math.min(95, dragging.top + dy)) });
    };
    const stop = () => setDragging(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    return () => window.removeEventListener("pointermove", move);
  }, [dragging]);

  return (
    <>
      <Head><title>Page Builder | GR8 Result</title></Head>
      <main style={styles.shell}>
        <header style={styles.header}><div><strong style={styles.brand}>Page Builder</strong><span style={styles.sub}>Canva-style estimate document editor</span></div><button style={styles.primary} onClick={() => addElement("text")}>+ Text</button></header>
        <div style={styles.workspace}>
          <aside style={styles.sidebar}>
            <strong>Pages</strong>
            {pages.map((entry, index) => <button key={entry.id} style={{ ...styles.pageButton, ...(index === activeIndex ? styles.activePage : {}) }} onClick={() => setActiveIndex(index)}>{index + 1}. {entry.name}</button>)}
            <button style={styles.tool} onClick={addNewPage}>＋ Add New Page</button>
            <button style={styles.tool} disabled={!page} onClick={() => { const next = duplicatePage(pages, activeIndex); setPages(next); setActiveIndex(activeIndex + 1); }}>▣ Duplicate</button>
            <div style={styles.row}><button style={styles.tool} onClick={() => { const next = movePage(pages, activeIndex, -1); setPages(next); setActiveIndex(Math.max(0, activeIndex - 1)); }}>↑ Up</button><button style={styles.tool} onClick={() => { const next = movePage(pages, activeIndex, 1); setPages(next); setActiveIndex(Math.min(next.length - 1, activeIndex + 1)); }}>↓ Down</button><button style={styles.tool} disabled={pages.length < 2} onClick={() => { const next = pages.filter((_, index) => index !== activeIndex); setPages(next); setActiveIndex(Math.max(0, activeIndex - 1)); }}>Delete</button></div>
            <hr style={styles.rule} />
            <strong>Elements</strong>
            <button style={styles.tool} onClick={() => addElement("text")}>T Text placeholder</button>
            <button style={styles.tool} onClick={() => addElement("image", { mode: "image" })}>▧ Image placeholder</button>
            <button style={styles.tool} onClick={() => setShowShapes((value) => !value)}>◇ Shapes</button>
            {showShapes && <div style={styles.shapePanel}>{SHAPE_TYPES.map((shape) => <button key={shape} style={styles.shapeButton} onClick={() => { addElement(shape); setShowShapes(false); }}>{shape}</button>)}</div>}
          </aside>
          <section style={styles.center}>
            <div style={styles.toolbar}><label>Background <input type="color" value={page?.backgroundColor || "#07111f"} onChange={(event) => updatePage({ backgroundColor: event.target.value })} /></label><button style={styles.tool} onClick={() => fileRef.current?.click()}>Upload image</button><input ref={fileRef} hidden type="file" accept="image/*" onChange={handleUpload} /><input style={styles.urlInput} placeholder="Background image URL" value={backgroundImage || page?.backgroundImage || ""} onChange={(event) => { setBackgroundImage(event.target.value); updatePage({ backgroundImage: event.target.value }); }} /></div>
            <div style={{ ...styles.canvas, backgroundColor: page?.backgroundColor, backgroundImage: page?.backgroundImage ? `url(${page.backgroundImage})` : undefined }} onClick={() => setSelectedId(null)}>
              {page?.elements.map((element, elementIndex) => <div key={element.id} onPointerDown={(event) => handleElementPointerDown(event, element)} style={{ ...styles.element, left: `${element.x}%`, top: `${element.y}%`, width: `${element.width}%`, height: `${element.height}%`, transform: `rotate(${element.rotation}deg)`, color: element.color, border: selectedId === element.id ? "2px solid #38bdf8" : "1px solid transparent", opacity: element.locked ? 0.72 : 1, cursor: element.locked ? "not-allowed" : "move", resize: selectedId === element.id && !element.locked ? "both" : "none" }}>
                {element.type === "text" ? (element.dataField ? String(quotation[element.dataField] ?? element.text) : elementIndex === 1 ? `${formatCurrency(summary.total)} inc GST` : elementIndex >= 5 ? `${summary.stages[elementIndex - 5]?.stage || element.text}                                  ${summary.stages[elementIndex - 5]?.percentage || 0}%          ${formatCurrency(summary.stages[elementIndex - 5]?.amount || 0)}` : element.text) : element.type === "image" ? (element.imageUrl ? <img src={element.imageUrl} alt="" style={styles.image} /> : "IMAGE") : <span style={{ ...styles.shape, background: element.type === "line" ? element.color : element.mode === "image" && element.imageUrl ? `url(${element.imageUrl}) center/cover` : element.color, borderRadius: element.type === "circle" ? "50%" : 0, clipPath: element.type === "triangle" ? "polygon(50% 0, 100% 100%, 0 100%)" : undefined }} />}
              </div>)}
            </div>
          </section>
          <aside style={styles.properties}><strong>Properties</strong>{selected ? <><label>Text / placeholder<input style={styles.input} value={selected.text || ""} onChange={(event) => updateElement({ text: event.target.value, mode: "text" })} /></label><label>Data field (optional)<input style={styles.input} placeholder="projectName or clientName" value={selected.dataField || ""} onChange={(event) => updateElement({ dataField: event.target.value, mode: "text" })} /></label><label>Color<input type="color" value={selected.color || "#d4af55"} onChange={(event) => updateElement({ color: event.target.value, mode: "color" })} /></label><label>Image URL<input style={styles.input} value={selected.imageUrl || ""} onChange={(event) => updateElement({ imageUrl: event.target.value, mode: "image" })} /></label><div style={styles.row}><button style={styles.tool} onClick={() => updateElement({ rotation: (selected.rotation + 15) % 360 })}>Rotate</button><button style={styles.tool} onClick={() => updateElement({ locked: !selected.locked })}>{selected.locked ? "Unlock" : "Lock"}</button></div><div style={styles.row}><button style={styles.tool} onClick={() => updateElement({ x: Math.max(0, selected.x - 1) })}>← Align</button><button style={styles.tool} onClick={() => updateElement({ x: Math.min(90, selected.x + 1) })}>Align →</button></div></> : <p style={styles.muted}>Select an element to edit, move, rotate, lock, or bind a placeholder.</p>}<div style={styles.binding}><strong>Quotation preview</strong><div>Total inc GST: {formatCurrency(summary.total)}</div><div>Fallback stage rows: {summary.stages.length}</div></div></aside>
        </div>
      </main>
    </>
  );
}

const styles = {
  shell: { minHeight: "100vh", background: "#0b1220", color: "#e5e7eb", fontFamily: "Inter, system-ui, sans-serif" },
  header: { height: 72, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #263449" },
  brand: { fontSize: 24, color: "#fff" }, sub: { marginLeft: 14, color: "#94a3b8" }, primary: { background: "#2563eb", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 700 },
  workspace: { display: "grid", gridTemplateColumns: "220px minmax(0, 1fr) 240px", minHeight: "calc(100vh - 72px)" }, sidebar: { padding: 18, borderRight: "1px solid #263449", display: "flex", flexDirection: "column", gap: 8 }, center: { padding: 18, overflow: "auto" }, properties: { padding: 18, borderLeft: "1px solid #263449", display: "flex", flexDirection: "column", gap: 12 },
  pageButton: { background: "transparent", color: "#cbd5e1", border: "1px solid transparent", textAlign: "left", padding: 10, borderRadius: 6 }, activePage: { background: "#1e3a5f", borderColor: "#38bdf8", color: "#fff" }, tool: { background: "#172235", color: "#dbeafe", border: "1px solid #334155", borderRadius: 6, padding: "8px 10px", cursor: "pointer", textAlign: "left" }, row: { display: "flex", gap: 6 }, rule: { width: "100%", borderColor: "#263449" }, shapePanel: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }, shapeButton: { background: "#24334a", color: "#fff", border: 0, padding: 8, borderRadius: 5 },
  toolbar: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }, urlInput: { minWidth: 220, background: "#111c2d", color: "#fff", border: "1px solid #334155", padding: 8, borderRadius: 6 }, canvas: { position: "relative", margin: "0 auto", width: "min(850px, 100%)", aspectRatio: "0.707", overflow: "hidden", backgroundSize: "cover", backgroundPosition: "center", boxShadow: "0 24px 60px #0008" }, element: { position: "absolute", padding: "4px 8px", fontSize: "clamp(10px, 1.3vw, 18px)", whiteSpace: "pre-wrap", overflow: "hidden", userSelect: "none" }, shape: { display: "block", width: "100%", height: "100%" }, image: { width: "100%", height: "100%", objectFit: "cover" }, input: { display: "block", width: "100%", marginTop: 5, background: "#111c2d", color: "#fff", border: "1px solid #334155", padding: 8, borderRadius: 6 }, muted: { color: "#94a3b8", lineHeight: 1.5 }, binding: { marginTop: "auto", border: "1px solid #334155", borderRadius: 8, padding: 12, color: "#cbd5e1", fontSize: 13, lineHeight: 1.7 },
};
