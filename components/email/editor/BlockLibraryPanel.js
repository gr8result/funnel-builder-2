// /components/email/editor/BlockLibraryPanel.js
// FULL REPLACEMENT — (unchanged from last) BUT signature saving will now include images
// because images are real <img> elements inside the selection

import { useEffect, useMemo, useState } from "react";
import {
  loadBlocks,
  saveBlocks,
  getDefaultSignatureId,
  setDefaultSignatureId,
  clearDefaultSignature,
  uid,
} from "./storage";
import { normalizeSavedHtml } from "./blocks";

function safeText(v) {
  return String(v || "").trim();
}

function getSelectionHtmlWithin(canvasEl) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";
  const range = sel.getRangeAt(0);
  if (!range || range.collapsed) return "";
  if (!canvasEl || !canvasEl.contains(range.commonAncestorContainer)) return "";

  const frag = range.cloneContents();
  const div = document.createElement("div");
  div.appendChild(frag);
  return div.innerHTML || "";
}

function insertHtmlAtSelection(canvasEl, restoreSelection, html) {
  if (!canvasEl) return false;

  const didRestore = restoreSelection?.() || false;
  const sel = window.getSelection();

  if (!didRestore || !sel || sel.rangeCount === 0) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = normalizeSavedHtml(html);
    const node = wrapper.firstElementChild;
    if (!node) return false;

    if (canvasEl.firstChild) canvasEl.insertBefore(node, canvasEl.firstChild);
    else canvasEl.appendChild(node);
    return true;
  }

  const range = sel.getRangeAt(0);
  if (!canvasEl.contains(range.commonAncestorContainer)) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = normalizeSavedHtml(html);
    const node = wrapper.firstElementChild;
    if (!node) return false;

    if (canvasEl.firstChild) canvasEl.insertBefore(node, canvasEl.firstChild);
    else canvasEl.appendChild(node);
    return true;
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = normalizeSavedHtml(html);
  const node = wrapper.firstElementChild;
  if (!node) return false;

  range.collapse(false);
  range.insertNode(node);

  sel.removeAllRanges();
  const r2 = document.createRange();
  r2.setStartAfter(node);
  r2.collapse(true);
  sel.addRange(r2);

  return true;
}

export default function BlockLibraryPanel({ editorRef, restoreSelection, rememberSelection, setStatus }) {
  const [blocks, setBlocks] = useState([]);
  const [name, setName] = useState("Signature");
  const [defaultSigId, setDefaultSigIdState] = useState("");

  useEffect(() => {
    const b = loadBlocks();
    setBlocks(b);
    setDefaultSigIdState(getDefaultSignatureId());
  }, []);

  const ordered = useMemo(() => {
    const arr = Array.isArray(blocks) ? [...blocks] : [];
    arr.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return arr;
  }, [blocks]);

  function persist(next) {
    setBlocks(next);
    saveBlocks(next);
  }

  function saveSelectionAsBlock() {
    const canvas = editorRef?.current;
    if (!canvas) return;

    const html = getSelectionHtmlWithin(canvas);
    if (!safeText(html)) {
      setStatus?.("Select your signature area on the canvas first");
      return;
    }

    const id = uid("blk");
    const item = {
      id,
      name: safeText(name) || "Reusable Block",
      html,
      kind: "block",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const next = [item, ...(blocks || [])];
    persist(next);
    setStatus?.(`Saved: ${item.name}`);
  }

  function insertBlock(item) {
    const canvas = editorRef?.current;
    if (!canvas || !item?.html) return;

    const ok = insertHtmlAtSelection(canvas, restoreSelection, item.html);
    rememberSelection?.();
    setStatus?.(ok ? `Inserted: ${item.name}` : "Insert failed");
  }

  function setAsDefault(item) {
    if (!item?.id) return;
    setDefaultSignatureId(item.id);
    setDefaultSigIdState(item.id);
    setStatus?.(`Default signature set: ${item.name}`);
  }

  function clearDefault() {
    clearDefaultSignature();
    setDefaultSigIdState("");
    setStatus?.("Default signature cleared");
  }

  function deleteBlock(id) {
    const next = (blocks || []).filter((b) => b.id !== id);
    persist(next);
    if (defaultSigId === id) clearDefault();
    setStatus?.("Deleted");
  }

  function applyDefaultSignatureNow() {
    const id = getDefaultSignatureId();
    if (!id) {
      setStatus?.("No default signature set");
      return;
    }
    const found = (blocks || []).find((b) => b.id === id);
    if (!found) {
      setStatus?.("Default signature missing");
      return;
    }
    insertBlock(found);
  }

  return (
    <div className="card">
      <div className="h">Reusable Blocks</div>
      <div className="sub">Build your signature on canvas (image + text) → select it → Save Selection.</div>

      <div className="row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Block name (eg. Signature)" />
        <button className="btn" onMouseDown={(e) => e.preventDefault()} onClick={saveSelectionAsBlock}>
          Save Selection
        </button>
      </div>

      <div className="row2">
        <button className="btn2" onMouseDown={(e) => e.preventDefault()} onClick={applyDefaultSignatureNow}>
          Insert Default
        </button>
        <button className="btn3" onMouseDown={(e) => e.preventDefault()} onClick={clearDefault}>
          Clear Default
        </button>
      </div>

      <div className="list">
        {ordered.length ? (
          ordered.map((b) => (
            <div key={b.id} className={`item ${defaultSigId === b.id ? "active" : ""}`}>
              <div className="meta">
                <div className="nm">{b.name}</div>
                <div className="sm">{defaultSigId === b.id ? "Default signature" : "Reusable block"}</div>
              </div>
              <div className="acts">
                <button className="a" onMouseDown={(e) => e.preventDefault()} onClick={() => insertBlock(b)}>
                  Insert
                </button>
                <button className="a2" onMouseDown={(e) => e.preventDefault()} onClick={() => setAsDefault(b)}>
                  Default
                </button>
                <button className="a3" onMouseDown={(e) => e.preventDefault()} onClick={() => deleteBlock(b.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty">No saved blocks yet.</div>
        )}
      </div>

      <style jsx>{`
        .card {
          margin-top: 12px;
          background: #111827;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 16px;
          padding: 12px;
        }
        .h {
          font-size: 16px;
          font-weight: 900;
          color: #facc15;
          margin-bottom: 6px;
        }
        .sub {
          font-size: 13px;
          opacity: 0.92;
          margin-bottom: 10px;
          line-height: 1.35;
        }
        .row {
          display: grid;
          grid-template-columns: 1fr 140px;
          gap: 10px;
          margin-bottom: 10px;
        }
        input {
          padding: 10px 10px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.25);
          background: #0b1120;
          color: #fff;
          outline: none;
          font-size: 14px;
        }
        .btn {
          border: none;
          border-radius: 12px;
          font-weight: 900;
          cursor: pointer;
          background: #facc15;
          color: #0b1120;
        }
        .row2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 10px;
        }
        .btn2,
        .btn3 {
          border: none;
          border-radius: 12px;
          padding: 10px;
          font-weight: 900;
          cursor: pointer;
        }
        .btn2 {
          background: #22c55e;
          color: #0b1120;
        }
        .btn3 {
          background: #334155;
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.15);
        }
        .list {
          max-height: 280px;
          overflow: auto;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: #0b1120;
          padding: 8px;
        }
        .item {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 10px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          margin-bottom: 8px;
        }
        .item.active {
          border-color: rgba(34, 197, 94, 0.55);
          box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.18) inset;
        }
        .meta {
          min-width: 0;
        }
        .nm {
          font-weight: 900;
          font-size: 14px;
        }
        .sm {
          font-size: 12px;
          opacity: 0.88;
          margin-top: 2px;
        }
        .acts {
          display: grid;
          grid-template-columns: 72px 76px 72px;
          gap: 8px;
          align-items: center;
        }
        .a,
        .a2,
        .a3 {
          border: none;
          border-radius: 10px;
          padding: 8px 8px;
          font-weight: 900;
          cursor: pointer;
          font-size: 12px;
        }
        .a {
          background: #3b82f6;
          color: #fff;
        }
        .a2 {
          background: #22c55e;
          color: #0b1120;
        }
        .a3 {
          background: #ef4444;
          color: #0b1120;
        }
        .empty {
          font-size: 13px;
          opacity: 0.9;
          padding: 12px;
          line-height: 1.35;
        }
      `}</style>
    </div>
  );
}
