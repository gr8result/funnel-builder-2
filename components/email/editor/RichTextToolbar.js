// /components/email/editor/RichTextToolbar.js
// FULL REPLACEMENT — NO “Apply” buttons.
// ✅ Font dropdown with hover-preview, click commits
// ✅ Size dropdown with hover-preview, click commits
// ✅ Colour dropdown with hover-preview, click commits (+ custom hex)
// ✅ Clean toolbar (no random “List” text)
// NOTE: preview is safe: it snapshots canvas HTML + restores on hover-out (only while dropdown is open)

import { useEffect, useMemo, useRef, useState } from "react";

const SAFE_FONTS = [
  "Arial",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Nunito",
  "Raleway",
  "Merriweather",
  "Playfair Display",
  "DM Sans",
  "Work Sans",
  "Rubik",
];

const SIZE_OPTIONS = [12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72];

export default function RichTextToolbar({ editorRef, restoreSelection, rememberSelection, setStatus, palette }) {
  const [fontOpen, setFontOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);

  const [customHex, setCustomHex] = useState("#111827");

  // snapshot for hover-preview
  const snapRef = useRef(null);

  const colors = useMemo(() => {
    const base = Array.isArray(palette) && palette.length ? palette : ["#111827", "#000000", "#ffffff", "#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#9ca3af"];
    // ensure unique
    return Array.from(new Set(base.map((c) => String(c))));
  }, [palette]);

  function focusCanvas() {
    const el = editorRef?.current;
    if (el) el.focus();
  }

  function cmd(name, value = null) {
    focusCanvas();
    restoreSelection();
    try {
      document.execCommand(name, false, value);
      rememberSelection();
    } catch {}
  }

  // ---- Style wrapper (px size, font, color) ----
  function wrapSelectionStyle(styleObj) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const r = sel.getRangeAt(0);
    if (r.collapsed) return false;

    const span = document.createElement("span");
    Object.assign(span.style, styleObj);

    const frag = r.extractContents();
    span.appendChild(frag);
    r.insertNode(span);

    sel.removeAllRanges();
    const nr = document.createRange();
    nr.selectNodeContents(span);
    sel.addRange(nr);

    return true;
  }

  // ---- Preview snapshot handling ----
  function beginPreview() {
    const canvas = editorRef?.current;
    if (!canvas) return;
    if (snapRef.current) return;

    // only snapshot if selection exists (otherwise preview does nothing)
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    snapRef.current = {
      html: canvas.innerHTML,
    };
  }

  function endPreviewRestore() {
    const canvas = editorRef?.current;
    if (!canvas) return;
    const snap = snapRef.current;
    if (!snap) return;

    canvas.innerHTML = snap.html;
    snapRef.current = null;

    // selection will be lost after innerHTML restore; just re-remember after next click
    setStatus?.("Preview ended");
  }

  function commitPreview() {
    // keep current DOM changes, just clear snapshot
    snapRef.current = null;
  }

  // close dropdowns on outside click
  useEffect(() => {
    function onDoc() {
      if (fontOpen || sizeOpen || colorOpen) {
        // if user clicks outside while previewing, restore
        if (snapRef.current) endPreviewRestore();
        setFontOpen(false);
        setSizeOpen(false);
        setColorOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [fontOpen, sizeOpen, colorOpen]);

  // ---------- Actions ----------
  function applyFontPreview(f) {
    beginPreview();
    restoreSelection();
    const ok = wrapSelectionStyle({ fontFamily: f });
    if (ok) setStatus?.(`Preview font: ${f}`);
  }

  function applyFontCommit(f) {
    // commit current preview state (or apply if none)
    if (!snapRef.current) {
      restoreSelection();
      const ok = wrapSelectionStyle({ fontFamily: f });
      if (ok) setStatus?.(`Font set: ${f}`);
      else setStatus?.("Select text first");
    } else {
      commitPreview();
      setStatus?.(`Font set: ${f}`);
    }
    setFontOpen(false);
  }

  function applySizePreview(px) {
    beginPreview();
    restoreSelection();
    const ok = wrapSelectionStyle({ fontSize: `${px}px` });
    if (ok) setStatus?.(`Preview size: ${px}px`);
  }

  function applySizeCommit(px) {
    if (!snapRef.current) {
      restoreSelection();
      const ok = wrapSelectionStyle({ fontSize: `${px}px` });
      if (ok) setStatus?.(`Size set: ${px}px`);
      else setStatus?.("Select text first");
    } else {
      commitPreview();
      setStatus?.(`Size set: ${px}px`);
    }
    setSizeOpen(false);
  }

  function applyColorPreview(c) {
    beginPreview();
    restoreSelection();
    const ok = wrapSelectionStyle({ color: c });
    if (ok) setStatus?.(`Preview colour`);
  }

  function applyColorCommit(c) {
    if (!snapRef.current) {
      restoreSelection();
      const ok = wrapSelectionStyle({ color: c });
      if (ok) setStatus?.(`Colour set`);
      else setStatus?.("Select text first");
    } else {
      commitPreview();
      setStatus?.(`Colour set`);
    }
    setColorOpen(false);
  }

  function clearFormatting() {
    focusCanvas();
    restoreSelection();
    try {
      document.execCommand("removeFormat", false, null);
      document.execCommand("unlink", false, null);
    } catch {}
    setStatus?.("Formatting cleared");
  }

  return (
    <div className="rt" onMouseDown={(e) => e.stopPropagation()}>
      <div className="row">
        <button className="ic" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("bold")}>
          B
        </button>
        <button className="ic" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("italic")}>
          I
        </button>
        <button className="ic" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("underline")}>
          U
        </button>
        <button className="ic" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("strikeThrough")}>
          S
        </button>
      </div>

      <div className="row">
        <button className="pill" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("justifyLeft")}>
          Left
        </button>
        <button className="pill" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("justifyCenter")}>
          Center
        </button>
        <button className="pill" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("justifyRight")}>
          Right
        </button>
      </div>

      <div className="row">
        <button className="pill" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertUnorderedList")}>
          • List
        </button>
        <button className="pill" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertOrderedList")}>
          1. List
        </button>
        <button className="pill" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("outdent")}>
          Out
        </button>
        <button className="pill" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("indent")}>
          In
        </button>
      </div>

      {/* FONT DROPDOWN (hover preview, click commit) */}
      <div className="dd">
        <div className="lab">Font</div>
        <button
          className="ddBtn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            // closing restores preview if active
            if (fontOpen && snapRef.current) endPreviewRestore();
            setFontOpen((v) => !v);
            setSizeOpen(false);
            setColorOpen(false);
          }}
        >
          Choose font ▾
        </button>

        {fontOpen && (
          <div className="menu" onMouseDown={(e) => e.stopPropagation()}>
            <div className="hint">Hover = preview • Click = set</div>
            {SAFE_FONTS.map((f) => (
              <div
                key={f}
                className="opt"
                style={{ fontFamily: f }}
                onMouseEnter={() => applyFontPreview(f)}
                onMouseLeave={() => endPreviewRestore()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyFontCommit(f)}
              >
                {f}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SIZE DROPDOWN */}
      <div className="dd">
        <div className="lab">Size</div>
        <button
          className="ddBtn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            if (sizeOpen && snapRef.current) endPreviewRestore();
            setSizeOpen((v) => !v);
            setFontOpen(false);
            setColorOpen(false);
          }}
        >
          Choose size ▾
        </button>

        {sizeOpen && (
          <div className="menu" onMouseDown={(e) => e.stopPropagation()}>
            <div className="hint">Hover = preview • Click = set</div>
            <div className="grid">
              {SIZE_OPTIONS.map((px) => (
                <div
                  key={px}
                  className="opt2"
                  onMouseEnter={() => applySizePreview(px)}
                  onMouseLeave={() => endPreviewRestore()}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySizeCommit(px)}
                >
                  {px}px
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* COLOUR DROPDOWN */}
      <div className="dd">
        <div className="lab">Colour</div>
        <button
          className="ddBtn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            if (colorOpen && snapRef.current) endPreviewRestore();
            setColorOpen((v) => !v);
            setFontOpen(false);
            setSizeOpen(false);
          }}
        >
          Choose colour ▾
        </button>

        {colorOpen && (
          <div className="menu" onMouseDown={(e) => e.stopPropagation()}>
            <div className="hint">Hover = preview • Click = set</div>
            <div className="swGrid">
              {colors.map((c) => (
                <button
                  key={c}
                  className="sw"
                  style={{ background: c }}
                  title={c}
                  onMouseEnter={() => applyColorPreview(c)}
                  onMouseLeave={() => endPreviewRestore()}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyColorCommit(c)}
                />
              ))}
            </div>

            <div className="custom">
              <input className="hex" value={customHex} onChange={(e) => setCustomHex(e.target.value)} />
              <button
                className="set"
                onMouseEnter={() => applyColorPreview(customHex)}
                onMouseLeave={() => endPreviewRestore()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyColorCommit(customHex)}
              >
                Set
              </button>
            </div>
          </div>
        )}
      </div>

      <button className="clear" onMouseDown={(e) => e.preventDefault()} onClick={clearFormatting}>
        Clear Formatting
      </button>

      <style jsx>{`
        .rt {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .row {
          display: flex;
          gap: 8px;
        }

        .ic {
          width: 44px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
          font-weight: 900;
          cursor: pointer;
        }

        .pill {
          flex: 1;
          height: 36px;
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
          font-weight: 900;
          cursor: pointer;
        }

        .dd {
          position: relative;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(2, 6, 23, 0.35);
          border-radius: 14px;
          padding: 10px;
        }

        .lab {
          font-size: 12px;
          color: rgba(226, 232, 240, 0.85);
          font-weight: 900;
          margin-bottom: 8px;
        }

        .ddBtn {
          width: 100%;
          height: 40px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
          font-weight: 900;
          cursor: pointer;
          text-align: left;
          padding: 0 12px;
        }

        .menu {
          position: absolute;
          left: 10px;
          right: 10px;
          top: 78px;
          z-index: 30;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(2, 6, 23, 0.98);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
          padding: 10px;
          max-height: 320px;
          overflow: auto;
        }

        .hint {
          font-size: 11px;
          font-weight: 900;
          color: rgba(226, 232, 240, 0.8);
          margin-bottom: 8px;
        }

        .opt {
          padding: 10px 10px;
          border-radius: 10px;
          cursor: pointer;
          color: #fff;
          font-weight: 900;
          border: 1px solid transparent;
        }
        .opt:hover {
          border-color: rgba(34, 197, 94, 0.5);
          background: rgba(34, 197, 94, 0.12);
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .opt2 {
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          cursor: pointer;
          color: #fff;
          font-weight: 900;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(255, 255, 255, 0.06);
        }
        .opt2:hover {
          border-color: rgba(34, 197, 94, 0.5);
          background: rgba(34, 197, 94, 0.12);
        }

        .swGrid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
        }
        .sw {
          height: 26px;
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          cursor: pointer;
        }

        .custom {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
        .hex {
          flex: 1;
          height: 38px;
          border-radius: 12px;
          padding: 0 12px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
          outline: none;
          font-weight: 900;
        }
        .set {
          width: 74px;
          height: 38px;
          border-radius: 12px;
          border: 1px solid rgba(34, 197, 94, 0.35);
          background: rgba(34, 197, 94, 0.22);
          color: #fff;
          font-weight: 900;
          cursor: pointer;
        }

        .clear {
          height: 44px;
          border-radius: 12px;
          border: 1px solid rgba(239, 68, 68, 0.35);
          background: rgba(239, 68, 68, 0.22);
          color: #fff;
          font-weight: 900;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
