// /components/email/editor/EditorLayout.js
// FULL REPLACEMENT — banner stays 1320 centered, BUT editor grid can extend wider than banner.
// ✅ Canvas can be 1320 and NOT look “half banner” (panels extend past banner when needed)
// ✅ Whole editor remains centered under banner
// ✅ Square block buttons
// ✅ Drag/drop inserts where dropped (not bottom)
// ✅ Works with the new no-“Apply” toolbar (hover-preview + click to commit)

import { useEffect, useMemo, useRef, useState } from "react";
import RichTextToolbar from "./RichTextToolbar";
import { makeBlock, findInsertionPoint, normalizeCanvasHtml, ensureCanvasHasRoot } from "./blocks";

const DEFAULT_WIDTH = 1320;

export default function EditorLayout({ userId, initialHtml }) {
  const editorRef = useRef(null);
  const dropLineRef = useRef(null);
  const lastRangeRef = useRef(null);

  const [canvasWidth, setCanvasWidth] = useState(DEFAULT_WIDTH);
  const [status, setStatus] = useState("Ready");

  // image library
  const [showImg, setShowImg] = useState(false);
  const [imgUrls, setImgUrls] = useState([]);
  const [imgBusy, setImgBusy] = useState(false);

  // reusable blocks
  const [blockName, setBlockName] = useState("Signature");

  // --------- Selection helpers ----------
  function rememberSelection() {
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const r = sel.getRangeAt(0);
      if (editorRef.current && editorRef.current.contains(r.commonAncestorContainer)) {
        lastRangeRef.current = r.cloneRange();
      }
    } catch {}
  }

  function restoreSelection() {
    const r = lastRangeRef.current;
    if (!r) return false;
    try {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      return true;
    } catch {
      return false;
    }
  }

  // --------- Canvas load ----------
  useEffect(() => {
    const canvas = editorRef.current;
    if (!canvas) return;

    canvas.innerHTML = "";
    const normalized = normalizeCanvasHtml(String(initialHtml || ""));
    if (normalized) canvas.innerHTML = normalized;
    else {
      const p = document.createElement("p");
      p.textContent = "";
      canvas.appendChild(p);
    }

    ensureCanvasHasRoot(canvas);
  }, [initialHtml]);

  // --------- Drag/drop ----------
  function onDragStart(e, type) {
    e.dataTransfer.setData("gr8/block", type);
    e.dataTransfer.effectAllowed = "copy";
  }

  function onDragOver(e) {
    e.preventDefault();
    const canvas = editorRef.current;
    const line = dropLineRef.current;
    if (!canvas || !line) return;

    const ins = findInsertionPoint(canvas, e.clientY);
    line.style.display = "block";
    line.style.top = `${ins?.lineY ?? 22}px`;
  }

  function onDrop(e) {
    e.preventDefault();
    const canvas = editorRef.current;
    const line = dropLineRef.current;
    if (line) line.style.display = "none";
    if (!canvas) return;

    const type = e.dataTransfer.getData("gr8/block");
    if (!type) return;

    const ins = findInsertionPoint(canvas, e.clientY);
    const block = makeBlock(type);

    if (!ins || !ins.ref) {
      if (canvas.firstChild) canvas.insertBefore(block, canvas.firstChild);
      else canvas.appendChild(block);
    } else {
      canvas.insertBefore(block, ins.before ? ins.ref : ins.ref.nextSibling);
    }

    ensureCanvasHasRoot(canvas);
    setStatus(`Added ${type}`);
  }

  // --------- Image library ----------
  async function refreshImages() {
    if (!userId) return setImgUrls([]);
    setImgBusy(true);
    try {
      const r = await fetch(`/api/email/editor-images?userId=${encodeURIComponent(userId)}`);
      const j = await r.json().catch(() => null);
      setImgUrls(Array.isArray(j?.urls) ? j.urls : []);
    } finally {
      setImgBusy(false);
    }
  }

  async function uploadImageFile(file) {
    if (!userId || !file) return;
    setImgBusy(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });

      await fetch(`/api/email/editor-images?userId=${encodeURIComponent(userId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, base64: dataUrl }),
      });

      await refreshImages();
      setStatus("Image uploaded");
    } finally {
      setImgBusy(false);
    }
  }

  function insertImageIntoSelectedBlock(url) {
    const canvas = editorRef.current;
    if (!canvas) return;

    // try selected image block
    let target = null;
    try {
      const sel = window.getSelection();
      const node = sel?.anchorNode;
      const el = node?.nodeType === 1 ? node : node?.parentElement;
      target = el?.closest?.('[data-block="image"]') || null;
    } catch {}

    if (!target) target = canvas.querySelector('[data-block="image"]');

    if (!target) {
      const b = makeBlock("image");
      if (canvas.firstChild) canvas.insertBefore(b, canvas.firstChild);
      else canvas.appendChild(b);
      target = b;
    }

    const img = target.querySelector("img");
    if (img) {
      img.src = url;
      img.style.display = "block";
    }
    const hint = target.querySelector(".imgHint");
    if (hint) hint.style.display = "none";

    setStatus("Inserted image");
    setShowImg(false);
  }

  // --------- Reusable blocks (localStorage) ----------
  const LS_BLOCKS_KEY = "gr8:email:reusableBlocks:v1";
  const LS_DEFAULT_BLOCK_KEY = "gr8:email:defaultReusableBlock:v1";

  function loadBlocks() {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(LS_BLOCKS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  const [savedBlocks, setSavedBlocks] = useState(() => loadBlocks());

  function saveSelectionAsBlock() {
    const ok = restoreSelection();
    if (!ok) return setStatus("Select something on the canvas first");

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return setStatus("Select something on the canvas first");
    const r = sel.getRangeAt(0);
    if (r.collapsed) return setStatus("Select something on the canvas first");

    const frag = r.cloneContents();
    const tmp = document.createElement("div");
    tmp.appendChild(frag);

    const html = tmp.innerHTML;
    if (!html.trim()) return setStatus("Select something on the canvas first");

    const name = String(blockName || "Block").trim() || "Block";
    const item = {
      id: `blk_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`,
      name,
      html,
      updatedAt: new Date().toISOString(),
    };

    const next = [item, ...loadBlocks()].slice(0, 50);
    window.localStorage.setItem(LS_BLOCKS_KEY, JSON.stringify(next));
    window.localStorage.setItem(LS_DEFAULT_BLOCK_KEY, item.id);

    setSavedBlocks(next);
    setStatus(`Saved "${name}" (default)`);
  }

  function getDefaultId() {
    if (typeof window === "undefined") return "";
    try {
      return String(window.localStorage.getItem(LS_DEFAULT_BLOCK_KEY) || "");
    } catch {
      return "";
    }
  }

  function setDefaultId(id) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_DEFAULT_BLOCK_KEY, String(id || ""));
    setStatus("Default updated");
  }

  function insertDefaultBlock() {
    const list = loadBlocks();
    const id = getDefaultId();
    const found = list.find((x) => x.id === id) || list[0];
    if (!found) return setStatus("No saved blocks yet");

    const canvas = editorRef.current;
    if (!canvas) return;

    const wrap = document.createElement("div");
    wrap.setAttribute("data-block", "saved");
    wrap.style.margin = "10px 0";
    wrap.style.padding = "10px 12px";
    wrap.style.border = "1px solid rgba(148,163,184,0.25)";
    wrap.style.borderRadius = "14px";
    wrap.innerHTML = found.html;

    const ok = restoreSelection();
    if (ok) {
      const sel = window.getSelection();
      const r = sel.getRangeAt(0);
      const host =
        r.commonAncestorContainer?.nodeType === 1
          ? r.commonAncestorContainer
          : r.commonAncestorContainer?.parentElement;

      if (host && canvas.contains(host)) {
        r.collapse(false);
        r.insertNode(wrap);
      } else {
        canvas.appendChild(wrap);
      }
    } else {
      canvas.appendChild(wrap);
    }

    setStatus(`Inserted "${found.name}"`);
  }

  function clearDefault() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(LS_DEFAULT_BLOCK_KEY);
    setStatus("Default cleared");
  }

  // --------- Layout math (THIS fixes your “banner vs editor width” complaint) ----------
  // Banner stays max 1320 centered.
  // Editor grid is centered independently and can be wider than banner:
  const LEFT_W = 300;
  const RIGHT_W = 380;
  const GAP = 16;

  const editorTotalWidth = LEFT_W + RIGHT_W + canvasWidth + GAP * 2;

  const palette = useMemo(
    () => [
      "#111827",
      "#000000",
      "#ffffff",
      "#ef4444",
      "#f97316",
      "#facc15",
      "#22c55e",
      "#10b981",
      "#14b8a6",
      "#3b82f6",
      "#60a5fa",
      "#a855f7",
      "#ec4899",
      "#9ca3af",
      "#e5e7eb",
    ],
    []
  );

  return (
    <div className="editorWrap">
      <div className="editorCenter">
        <div className="grid" style={{ width: `${editorTotalWidth}px` }}>
          {/* LEFT */}
          <aside className="panel left">
            <div className="pTitle">Blocks</div>
            <div className="pSub">Drag onto canvas</div>

            <div className="blkGrid">
              {[
                ["text", "Text"],
                ["button", "Button"],
                ["divider", "Divider"],
                ["spacer", "Spacer"],
                ["columns2", "2 Cols"],
                ["columns3", "3 Cols"],
                ["image", "Image"],
                ["social", "Social"],
                ["html", "HTML"],
              ].map(([k, label]) => (
                <div key={k} className={`blk blk_${k}`} draggable onDragStart={(e) => onDragStart(e, k)}>
                  {label}
                </div>
              ))}
            </div>

            <div className="status">
              <div className="sL">Status</div>
              <div className="sV">{status}</div>
            </div>
          </aside>

          {/* CENTER */}
          <section className="center">
            <div className="controls">
              <div className="ctl">
                <label>Canvas width</label>
                <input
                  type="range"
                  min="520"
                  max="1320"
                  value={canvasWidth}
                  onChange={(e) => setCanvasWidth(Math.max(520, Math.min(1320, Number(e.target.value) || 1320)))}
                />
                <div className="val">{canvasWidth}px</div>
              </div>
            </div>

            <div className="canvasOuter" onDragOver={onDragOver} onDrop={onDrop}>
              <div ref={dropLineRef} className="dropLine" />
              <div className="canvasFrame" style={{ width: `${canvasWidth}px` }}>
                <div
                  ref={editorRef}
                  className="canvasDoc"
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck
                  onMouseUp={rememberSelection}
                  onKeyUp={rememberSelection}
                  onInput={rememberSelection}
                  onClick={rememberSelection}
                />
              </div>
            </div>
          </section>

          {/* RIGHT */}
          <aside className="panel right">
            <div className="pTitleGreen">Text Tools</div>
            <div className="pSub">Select text → hover to preview → click to commit</div>

            <RichTextToolbar
              editorRef={editorRef}
              restoreSelection={restoreSelection}
              rememberSelection={rememberSelection}
              setStatus={setStatus}
              palette={palette}
            />

            <div className="sec">
              <div className="secT">Images</div>
              <div className="secS">Upload → open library → click image to insert</div>

              <div className="row">
                <button
                  className="btn"
                  onClick={() => {
                    setShowImg((v) => !v);
                    if (!showImg) refreshImages();
                  }}
                >
                  {showImg ? "Close library" : "Open library"}
                </button>

                <label className="btnGhost">
                  Upload
                  <input type="file" accept="image/*" onChange={(e) => uploadImageFile(e.target.files?.[0])} style={{ display: "none" }} />
                </label>
              </div>

              {showImg && (
                <div className="imgBox">
                  <div className="imgTop">
                    <div className="imgNote">{imgBusy ? "Loading…" : `${imgUrls.length} images`}</div>
                    <button className="mini" onClick={refreshImages}>
                      Refresh
                    </button>
                  </div>

                  <div className="imgGrid">
                    {imgUrls.map((u) => (
                      <button key={u} className="imgBtn" onClick={() => insertImageIntoSelectedBlock(u)} title="Insert">
                        <img src={u} alt="" />
                      </button>
                    ))}
                    {!imgUrls.length && !imgBusy && <div className="empty">No images yet.</div>}
                  </div>
                </div>
              )}
            </div>

            <div className="sec">
              <div className="secT">Reusable Blocks</div>
              <div className="secS">Build signature/header/footer on canvas → select → Save</div>

              <div className="row">
                <input className="inp" value={blockName} onChange={(e) => setBlockName(e.target.value)} />
                <button className="btnY" onClick={saveSelectionAsBlock}>
                  Save
                </button>
              </div>

              <div className="row">
                <button className="btnG" onClick={insertDefaultBlock}>
                  Insert Default
                </button>
                <button className="btnGhost" onClick={clearDefault}>
                  Clear Default
                </button>
              </div>

              <div className="list">
                {savedBlocks.slice(0, 10).map((b) => (
                  <div key={b.id} className="item">
                    <div className="nm">{b.name}</div>
                    <div className="acts">
                      <button className="mini" onClick={() => setDefaultId(b.id)}>
                        Default
                      </button>
                    </div>
                  </div>
                ))}
                {!savedBlocks.length && <div className="empty">No saved blocks yet.</div>}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .editorWrap {
          width: 100%;
        }

        /* Center the entire editor UNDER the banner, even when wider than banner */
        .editorCenter {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        /* IMPORTANT: grid width is dynamic (can exceed banner) */
        .grid {
          display: grid;
          grid-template-columns: 300px 1fr 380px;
          gap: 16px;
          align-items: stretch;
          max-width: calc(100vw - 24px);
        }

        .panel {
          background: rgba(2, 6, 23, 0.55);
          border-radius: 16px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          padding: 12px;
          min-height: 760px;
          min-width: 0;
        }

        .pTitle {
          font-size: 18px;
          font-weight: 900;
          color: #60a5fa;
          margin-bottom: 6px;
        }
        .pTitleGreen {
          font-size: 18px;
          font-weight: 900;
          color: #22c55e;
          margin-bottom: 6px;
        }
        .pSub {
          font-size: 13px;
          opacity: 0.9;
          margin-bottom: 12px;
          color: #e5e7eb;
        }

        /* SQUARE buttons */
        .blkGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .blk {
          height: 86px;
          border-radius: 10px; /* square-ish, not pill */
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          text-align: center;
          cursor: grab;
          user-select: none;
          color: #0b1120;
          letter-spacing: 0.2px;
        }
        .blk_text {
          background: #60a5fa;
        }
        .blk_button {
          background: #22c55e;
        }
        .blk_divider {
          background: #facc15;
        }
        .blk_spacer {
          background: #eab308;
        }
        .blk_columns2,
        .blk_columns3 {
          background: #a855f7;
          color: #fff;
        }
        .blk_image {
          background: #0ea5e9;
        }
        .blk_social {
          background: #ec4899;
          color: #fff;
        }
        .blk_html {
          background: #f97316;
        }

        .status {
          margin-top: 14px;
          border-top: 1px solid rgba(148, 163, 184, 0.18);
          padding-top: 12px;
        }
        .sL {
          font-size: 12px;
          opacity: 0.85;
          color: #cbd5e1;
        }
        .sV {
          font-size: 14px;
          font-weight: 900;
          margin-top: 4px;
          color: #fff;
        }

        .center {
          background: rgba(2, 6, 23, 0.55);
          border-radius: 16px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          padding: 12px;
          min-width: 0;
          min-height: 760px;
          display: flex;
          flex-direction: column;
        }

        .controls {
          margin-bottom: 10px;
        }
        .ctl {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .ctl label {
          font-size: 13px;
          opacity: 0.9;
          min-width: 96px;
          color: #e5e7eb;
        }
        .ctl input {
          flex: 1;
        }
        .val {
          font-size: 13px;
          font-weight: 900;
          min-width: 72px;
          text-align: right;
          color: #fff;
        }

        .canvasOuter {
          position: relative;
          flex: 1;
          overflow: auto;
          padding: 16px;
          border-radius: 14px;
          border: 1px dashed rgba(148, 163, 184, 0.35);
          background: rgba(2, 6, 23, 0.35);
          display: flex;
          justify-content: center;
          align-items: flex-start;
        }

        .canvasFrame {
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 16px 60px rgba(0, 0, 0, 0.45);
          overflow: hidden;
          min-height: 980px;
        }

        .canvasDoc {
          min-height: 980px;
          padding: 24px;
          outline: none;
          color: #111827;
          font-size: 16px;
          line-height: 1.6;
          font-family: Arial, sans-serif;
        }

        .dropLine {
          position: absolute;
          left: 16px;
          right: 16px;
          height: 4px;
          border-radius: 999px;
          background: #22c55e;
          display: none;
          pointer-events: none;
          box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.25);
        }

        .sec {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid rgba(148, 163, 184, 0.18);
        }
        .secT {
          font-weight: 900;
          color: #fff;
          margin-bottom: 4px;
        }
        .secS {
          font-size: 12px;
          color: rgba(226, 232, 240, 0.85);
          margin-bottom: 10px;
        }

        .row {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 10px;
        }

        .btn,
        .btnG,
        .btnY,
        .btnGhost,
        .mini {
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
          border-radius: 12px;
          padding: 10px 12px;
          font-weight: 900;
          cursor: pointer;
          text-align: center;
          text-decoration: none;
        }
        .btnG {
          background: rgba(34, 197, 94, 0.22);
          border-color: rgba(34, 197, 94, 0.35);
        }
        .btnY {
          background: rgba(250, 204, 21, 0.22);
          border-color: rgba(250, 204, 21, 0.35);
          color: #fff;
        }
        .btnGhost {
          opacity: 0.95;
        }

        .mini {
          padding: 6px 10px;
          border-radius: 10px;
          font-weight: 900;
          font-size: 12px;
        }

        .inp {
          flex: 1;
          height: 40px;
          border-radius: 12px;
          padding: 0 12px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(2, 6, 23, 0.35);
          color: #fff;
          outline: none;
          font-weight: 800;
        }

        .imgBox {
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(2, 6, 23, 0.35);
          padding: 10px;
        }
        .imgTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .imgNote {
          font-size: 12px;
          color: rgba(226, 232, 240, 0.85);
          font-weight: 900;
        }
        .imgGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .imgBtn {
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 6px;
          cursor: pointer;
          overflow: hidden;
        }
        .imgBtn img {
          width: 100%;
          height: 70px;
          object-fit: cover;
          border-radius: 10px;
          display: block;
        }

        .list {
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(2, 6, 23, 0.35);
          padding: 10px;
        }
        .item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 6px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.14);
        }
        .item:last-child {
          border-bottom: none;
        }
        .nm {
          font-weight: 900;
          color: #fff;
          font-size: 13px;
        }
        .empty {
          padding: 8px 6px;
          font-size: 12px;
          color: rgba(226, 232, 240, 0.8);
          font-weight: 800;
        }
      `}</style>
    </div>
  );
}
