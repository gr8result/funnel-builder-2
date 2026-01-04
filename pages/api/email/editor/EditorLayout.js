// /components/email/editor/EditorLayout.js
// FULL REPLACEMENT — centered canvas + correct drag insertion

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import RichTextToolbar from "./RichTextToolbar";
import { makeBlock, findInsertionPoint } from "./blocks";
import { loadDraft, saveDraft, blankEmailHtml } from "./storage";

export default function EditorLayout() {
  const router = useRouter();
  const editorRef = useRef(null);
  const dropLineRef = useRef(null);

  const [canvasWidth, setCanvasWidth] = useState(1320);
  const [status, setStatus] = useState("Ready");

  /* ---------- init ---------- */
  useEffect(() => {
    const html = loadDraft() || blankEmailHtml();
    editorRef.current.innerHTML = html;
  }, []);

  function markDirty(msg = "") {
    saveDraft(editorRef.current.innerHTML);
    if (msg) setStatus(msg);
  }

  /* ---------- drag ---------- */
  function onDragStart(e, type) {
    e.dataTransfer.setData("gr8/block", type);
    e.dataTransfer.effectAllowed = "copy";
  }

  function onDragOver(e) {
    e.preventDefault();

    const canvas = editorRef.current;
    const line = dropLineRef.current;
    const insertion = findInsertionPoint(canvas, e.clientY);

    if (!insertion) return;

    line.style.display = "block";
    line.style.top = insertion.lineY + "px";
  }

  function onDrop(e) {
    e.preventDefault();
    dropLineRef.current.style.display = "none";

    const type = e.dataTransfer.getData("gr8/block");
    if (!type) return;

    const canvas = editorRef.current;
    const insertion = findInsertionPoint(canvas, e.clientY);
    const block = makeBlock(type);

    if (!insertion || !insertion.ref) {
      canvas.appendChild(block);
    } else {
      insertion.ref.parentNode.insertBefore(block, insertion.before ? insertion.ref : insertion.ref.nextSibling);
    }

    markDirty(`Added ${type}`);
  }

  return (
    <main className="page">
      <div className="banner">Email Editor</div>

      <div className="layout">
        {/* LEFT */}
        <aside className="left">
          {["text","button","divider","spacer","columns","social","form","html"].map(k => (
            <div key={k} className="blk" draggable onDragStart={e => onDragStart(e,k)}>
              {k}
            </div>
          ))}
          <div className="status">{status}</div>
        </aside>

        {/* CENTER */}
        <section className="center">
          <div className="controls">
            <label>Canvas width</label>
            <input
              type="range"
              min="320"
              max="1320"
              value={canvasWidth}
              onChange={e => setCanvasWidth(Number(e.target.value))}
            />
            <span>{canvasWidth}px</span>
          </div>

          <div className="canvasWrap">
            <div ref={dropLineRef} className="dropLine" />
            <div
              className="canvas"
              style={{ width: canvasWidth }}
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={() => markDirty()}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          </div>
        </section>

        {/* RIGHT */}
        <aside className="right">
          <RichTextToolbar editorRef={editorRef} />
        </aside>
      </div>

      <style jsx>{`
        .page { background:#0c121a; min-height:100vh; padding:24px; }
        .banner { max-width:1320px; margin:0 auto 16px; background:#3b82f6; color:#fff; padding:18px; border-radius:14px; font-size:32px; }

        .layout {
          max-width:1320px;
          margin:0 auto;
          display:grid;
          grid-template-columns:260px 1fr 360px;
          gap:14px;
        }

        .left,.right {
          background:#0b1120;
          border-radius:16px;
          padding:12px;
        }

        .blk {
          background:#60a5fa;
          color:#0b1120;
          border-radius:12px;
          padding:14px;
          margin-bottom:10px;
          font-weight:900;
          text-align:center;
          cursor:grab;
        }

        .center {
          background:#0b1120;
          border-radius:16px;
          padding:12px;
          display:flex;
          flex-direction:column;
        }

        .controls {
          display:flex;
          gap:10px;
          align-items:center;
          margin-bottom:10px;
        }

        .canvasWrap {
          position:relative;
          flex:1;
          display:flex;
          justify-content:center;
          align-items:flex-start;
          overflow:auto;
          padding:20px;
        }

        .canvas {
          background:#fff;
          min-height:900px;
          border-radius:14px;
          outline:none;
        }

        .dropLine {
          position:absolute;
          left:20px;
          right:20px;
          height:3px;
          background:#22c55e;
          display:none;
          pointer-events:none;
        }
      `}</style>
    </main>
  );
}
