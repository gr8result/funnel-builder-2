/**
 * Splices the new sticky-stacking FeatureAccordionBlock into wbBlockComponents.js.
 * Replaces everything from "// ─── Feature Accordion Block" up to (but not including)
 * the "// ── exports" comment at the bottom.
 */
const fs = require("fs");
const path = require("path");

const target = path.resolve(
  __dirname,
  "../components/website-builder/website-renderer/wbBlockComponents.js"
);

const src = fs.readFileSync(target, "utf8");

const startMarker = "// ─── Feature Accordion Block ─";
const endMarker = "\nexport {";

const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker);

if (startIdx === -1) { console.error("START MARKER NOT FOUND"); process.exit(1); }
if (endIdx === -1)   { console.error("END MARKER NOT FOUND");   process.exit(1); }

const newBlock = `// ─── Feature Accordion Block ───────────────────────────────────────────────
function FeatureAccordionBlock({ props, compact, editor = false, onChangeBlock }) {
  const PEEK_HEIGHT   = Number(props.peekHeight   || 64);  // px — height of each stacked peek header
  const STICKY_TOP_BASE = Number(props.stickyTopBase || 80); // px — offset from viewport top (clear nav)

  const items = asArray(props.items).map((item, idx) => ({
    id: item?.id || \`fa-item-\${idx}\`,
    label: item?.label || \`Section \${idx + 1}\`,
    image: item?.image || "",
    imageAlt: item?.imageAlt || "",
    contentBlocks: asArray(item?.contentBlocks).map((cb, cbIdx) => ({
      id: cb?.id || \`cb-\${idx}-\${cbIdx}\`,
      type: cb?.type || "text",
      ...cb,
    })),
  }));

  const [hoveredImg, setHoveredImg] = React.useState(-1);

  const bg        = props.backgroundColor || "#0f172a";
  const textColor = props.textColor       || "#ffffff";
  const accent    = props.accentColor     || "#0ea5e9";
  const imageRight = (props.imagePosition || "right") !== "left";

  // ── helpers ────────────────────────────────────────────────────────────────

  function patchItems(newItems) {
    if (!editor || typeof onChangeBlock !== "function") return;
    onChangeBlock({ ...props, items: newItems });
  }

  function patchItemField(itemIdx, field, value) {
    patchItems(items.map((item, i) => i !== itemIdx ? item : { ...item, [field]: value }));
  }

  function patchContentBlock(itemIdx, cbIdx, patch) {
    const newBlocks = items[itemIdx].contentBlocks.map((cb, j) =>
      j !== cbIdx ? cb : { ...cb, ...patch }
    );
    patchItemField(itemIdx, "contentBlocks", newBlocks);
  }

  function addContentBlock(itemIdx, type) {
    const now = Date.now();
    const templates = {
      eyebrow: { id: \`cb-\${now}\`, type: "eyebrow", text: "Category Label" },
      heading: { id: \`cb-\${now}\`, type: "heading", text: "Your headline here" },
      text:    { id: \`cb-\${now}\`, type: "text",    text: "Add your description here." },
      stat:    { id: \`cb-\${now}\`, type: "stat",    number: "0%", label: "metric label" },
      tags:    { id: \`cb-\${now}\`, type: "tags",    tags: ["Tag"] },
      cta:     { id: \`cb-\${now}\`, type: "cta",     text: "Learn More", link: "#" },
    };
    const newBlock = templates[type] || templates.text;
    patchItemField(itemIdx, "contentBlocks", [...items[itemIdx].contentBlocks, newBlock]);
  }

  function removeContentBlock(itemIdx, cbIdx) {
    patchItemField(itemIdx, "contentBlocks", items[itemIdx].contentBlocks.filter((_, j) => j !== cbIdx));
  }

  function moveContentBlock(itemIdx, cbIdx, dir) {
    const blocks = [...items[itemIdx].contentBlocks];
    const target = cbIdx + dir;
    if (target < 0 || target >= blocks.length) return;
    [blocks[cbIdx], blocks[target]] = [blocks[target], blocks[cbIdx]];
    patchItemField(itemIdx, "contentBlocks", blocks);
  }

  function addItem() {
    const now = Date.now();
    patchItems([
      ...items,
      {
        id: \`fa-item-\${now}\`,
        label: "New Section",
        image: "",
        imageAlt: "",
        contentBlocks: [
          { id: \`cb-\${now}-1\`, type: "heading", text: "Your headline here" },
          { id: \`cb-\${now}-2\`, type: "text",    text: "Add your description text here." },
          { id: \`cb-\${now}-3\`, type: "cta",     text: "Learn More", link: "#" },
        ],
      },
    ]);
  }

  function removeItem(itemIdx) {
    patchItems(items.filter((_, i) => i !== itemIdx));
  }

  // ── content block renderer ─────────────────────────────────────────────────

  function renderCb(item, itemIdx, block, cbIdx) {
    const edgeOut    = editor ? "1px dashed rgba(14,165,233,0.35)" : "none";
    const edgePad    = editor ? "4px 6px" : "0";
    const totalBlocks = item.contentBlocks.length;

    const reorderControls = editor ? (
      React.createElement("div", { style: { display: "flex", flexShrink: 0, gap: 3, marginLeft: 8, alignSelf: "flex-start", paddingTop: 2 } },
        React.createElement("button", {
          type: "button",
          onClick: (e) => { e.stopPropagation(); moveContentBlock(itemIdx, cbIdx, -1); },
          disabled: cbIdx === 0,
          title: "Move up",
          style: { background: "rgba(255,255,255,0.08)", border: "none", color: cbIdx === 0 ? "rgba(255,255,255,0.2)" : "#e2e8f0", borderRadius: 4, padding: "3px 7px", fontSize: 11, cursor: cbIdx === 0 ? "default" : "pointer", fontWeight: 700 },
        }, "↑"),
        React.createElement("button", {
          type: "button",
          onClick: (e) => { e.stopPropagation(); moveContentBlock(itemIdx, cbIdx, 1); },
          disabled: cbIdx === totalBlocks - 1,
          title: "Move down",
          style: { background: "rgba(255,255,255,0.08)", border: "none", color: cbIdx === totalBlocks - 1 ? "rgba(255,255,255,0.2)" : "#e2e8f0", borderRadius: 4, padding: "3px 7px", fontSize: 11, cursor: cbIdx === totalBlocks - 1 ? "default" : "pointer", fontWeight: 700 },
        }, "↓"),
        React.createElement("button", {
          type: "button",
          onClick: (e) => { e.stopPropagation(); removeContentBlock(itemIdx, cbIdx); },
          title: "Remove block",
          style: { background: "rgba(239,68,68,0.18)", border: "none", color: "#f87171", borderRadius: 4, padding: "3px 7px", fontSize: 11, cursor: "pointer" },
        }, "✕"),
      )
    ) : null;

    if (block.type === "eyebrow") {
      return (
        <div key={block.id} style={{ display: "flex", alignItems: "center" }}>
          <div
            data-website-inline-editor={editor ? "true" : undefined}
            contentEditable={editor}
            suppressContentEditableWarning
            onMouseDown={(e) => editor && e.stopPropagation()}
            onPointerDown={(e) => editor && e.stopPropagation()}
            onBlur={(e) => {
              if (shouldSkipToolbarBlur(e)) return;
              patchContentBlock(itemIdx, cbIdx, { text: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
            }}
            style={{ flex: 1, fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: accent, outline: edgeOut, borderRadius: 4, padding: edgePad }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(block.text || "Category") }}
          />
          {reorderControls}
        </div>
      );
    }

    if (block.type === "heading") {
      return (
        <div key={block.id} style={{ display: "flex", alignItems: "flex-start" }}>
          <div
            data-website-inline-editor={editor ? "true" : undefined}
            contentEditable={editor}
            suppressContentEditableWarning
            onMouseDown={(e) => editor && e.stopPropagation()}
            onPointerDown={(e) => editor && e.stopPropagation()}
            onBlur={(e) => {
              if (shouldSkipToolbarBlur(e)) return;
              patchContentBlock(itemIdx, cbIdx, { text: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
            }}
            style={{ flex: 1, fontSize: compact ? 22 : 32, fontWeight: 700, lineHeight: 1.2, color: textColor, outline: edgeOut, borderRadius: 6, padding: edgePad }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(block.text || "Heading") }}
          />
          {reorderControls}
        </div>
      );
    }

    if (block.type === "text") {
      return (
        <div key={block.id} style={{ display: "flex", alignItems: "flex-start" }}>
          <div
            data-website-inline-editor={editor ? "true" : undefined}
            contentEditable={editor}
            suppressContentEditableWarning
            onMouseDown={(e) => editor && e.stopPropagation()}
            onPointerDown={(e) => editor && e.stopPropagation()}
            onBlur={(e) => {
              if (shouldSkipToolbarBlur(e)) return;
              patchContentBlock(itemIdx, cbIdx, { text: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
            }}
            style={{ flex: 1, fontSize: 16, lineHeight: 1.75, color: "rgba(255,255,255,0.72)", outline: edgeOut, borderRadius: 6, padding: edgePad }}
            dangerouslySetInnerHTML={{ __html: asRichHtml(block.text || "Add your text here.") }}
          />
          {reorderControls}
        </div>
      );
    }

    if (block.type === "stat") {
      return (
        <div key={block.id} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
            <div
              data-website-inline-editor={editor ? "true" : undefined}
              contentEditable={editor}
              suppressContentEditableWarning
              onMouseDown={(e) => editor && e.stopPropagation()}
              onPointerDown={(e) => editor && e.stopPropagation()}
              onBlur={(e) => {
                if (shouldSkipToolbarBlur(e)) return;
                patchContentBlock(itemIdx, cbIdx, { number: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
              }}
              style={{ fontSize: 40, fontWeight: 800, color: accent, lineHeight: 1, outline: edgeOut, borderRadius: 4, padding: editor ? "2px 4px" : "0" }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(block.number || "0%") }}
            />
            <div
              data-website-inline-editor={editor ? "true" : undefined}
              contentEditable={editor}
              suppressContentEditableWarning
              onMouseDown={(e) => editor && e.stopPropagation()}
              onPointerDown={(e) => editor && e.stopPropagation()}
              onBlur={(e) => {
                if (shouldSkipToolbarBlur(e)) return;
                patchContentBlock(itemIdx, cbIdx, { label: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
              }}
              style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.4, outline: editor ? "1px dashed rgba(14,165,233,0.3)" : "none", borderRadius: 4, padding: editor ? "2px 4px" : "0" }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(block.label || "metric") }}
            />
          </div>
          {reorderControls}
        </div>
      );
    }

    if (block.type === "tags") {
      const tags = asArray(block.tags);
      return (
        <div key={block.id} style={{ display: "flex", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flex: 1 }}>
            {tags.map((tag, tagIdx) => (
              <div key={tagIdx} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onMouseDown={(e) => editor && e.stopPropagation()}
                  onPointerDown={(e) => editor && e.stopPropagation()}
                  onBlur={(e) => {
                    if (shouldSkipToolbarBlur(e)) return;
                    const newTags = tags.map((t, i) => i !== tagIdx ? t : e.currentTarget.textContent || "");
                    patchContentBlock(itemIdx, cbIdx, { tags: newTags });
                  }}
                  style={{ display: "inline-block", background: "rgba(14,165,233,0.14)", color: accent, border: "1px solid rgba(14,165,233,0.25)", borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 600, outline: editor ? "1px dashed rgba(14,165,233,0.35)" : "none" }}
                >{tag}</span>
                {editor ? (
                  <button type="button" onClick={(e) => { e.stopPropagation(); patchContentBlock(itemIdx, cbIdx, { tags: tags.filter((_, i) => i !== tagIdx) }); }} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 12, padding: "0 2px", lineHeight: 1 }}>✕</button>
                ) : null}
              </div>
            ))}
            {editor ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); patchContentBlock(itemIdx, cbIdx, { tags: [...tags, "New Tag"] }); }} style={{ background: "rgba(14,165,233,0.12)", border: "1px dashed rgba(14,165,233,0.4)", color: accent, borderRadius: 20, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>+ Tag</button>
            ) : null}
          </div>
          {reorderControls}
        </div>
      );
    }

    if (block.type === "cta") {
      return (
        <div key={block.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <a
            href={editor ? undefined : (block.link || "#")}
            onClick={(e) => editor && e.preventDefault()}
            style={{ display: "inline-block", background: accent, color: "#ffffff", borderRadius: 8, padding: "13px 30px", fontSize: 15, fontWeight: 700, textDecoration: "none", cursor: editor ? "default" : "pointer" }}
          >
            <div
              data-website-inline-editor={editor ? "true" : undefined}
              contentEditable={editor}
              suppressContentEditableWarning
              onMouseDown={(e) => editor && e.stopPropagation()}
              onPointerDown={(e) => editor && e.stopPropagation()}
              onBlur={(e) => {
                if (shouldSkipToolbarBlur(e)) return;
                patchContentBlock(itemIdx, cbIdx, { text: cleanInlineEditorHtml(e.currentTarget.innerHTML) });
              }}
              style={{ outline: editor ? "1px dashed rgba(255,255,255,0.4)" : "none", borderRadius: 4, padding: editor ? "1px 4px" : "0", display: "inline", color: "#fff" }}
              dangerouslySetInnerHTML={{ __html: asRichHtml(block.text || "Learn More") }}
            />
          </a>
          {editor ? (
            <input
              type="text"
              value={block.link || ""}
              onChange={(e) => patchContentBlock(itemIdx, cbIdx, { link: e.target.value })}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="https://..."
              style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: textColor, borderRadius: 6, padding: "8px 12px", fontSize: 13 }}
            />
          ) : null}
          {reorderControls}
        </div>
      );
    }

    return null;
  }

  // ── main render ────────────────────────────────────────────────────────────

  return (
    <section
      style={{
        width: "100%",
        background: bg,
        color: textColor,
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* Optional section header */}
      {(props.eyebrow || props.title) ? (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: compact ? "40px 16px 32px" : "80px 48px 48px", textAlign: "center" }}>
          {props.eyebrow ? (
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: accent, marginBottom: 14 }}>{props.eyebrow}</div>
          ) : null}
          {props.title ? (
            <h2 style={{ fontSize: compact ? 28 : 52, fontWeight: 800, lineHeight: 1.1, color: textColor, margin: 0 }}>{props.title}</h2>
          ) : null}
        </div>
      ) : null}

      {/* ── Stacking panels ──────────────────────────────────────────────── */}
      {/*  Live mode: position:sticky with increasing top values so each     */}
      {/*  panel physically stacks over the previous one as you scroll.      */}
      {/*  The page "pauses" here while all panels are cycled through.       */}
      {/*  Editor mode: position:relative — all panels visible for editing.  */}
      <div style={{ position: "relative", width: "100%" }}>
        {items.map((item, idx) => {
          const stickyTop = STICKY_TOP_BASE + idx * PEEK_HEIGHT;
          return (
            <div
              key={item.id}
              style={{
                position: editor ? "relative" : "sticky",
                top: editor ? undefined : stickyTop,
                zIndex: idx + 1,
                /* minHeight fills the remaining viewport below this panel's top,
                   so when active it covers the full screen */
                minHeight: editor ? undefined : \`calc(100vh - \${stickyTop}px)\`,
                background: bg,
                borderRadius: "20px 20px 0 0",
                border: "1px solid rgba(255,255,255,0.09)",
                borderBottom: "none",
                overflow: "hidden",
                marginBottom: editor ? 8 : 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* ── Peek header — always visible, even when stacked behind ── */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  height: PEEK_HEIGHT,
                  minHeight: PEEK_HEIGHT,
                  flexShrink: 0,
                  padding: "0 36px",
                  background: "rgba(0,0,0,0.30)",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <span style={{ width: 4, height: 28, borderRadius: 2, background: accent, flexShrink: 0 }} />
                <div
                  data-website-inline-editor={editor ? "true" : undefined}
                  contentEditable={editor}
                  suppressContentEditableWarning
                  onMouseDown={(e) => editor && e.stopPropagation()}
                  onPointerDown={(e) => editor && e.stopPropagation()}
                  onBlur={(e) => {
                    if (shouldSkipToolbarBlur(e)) return;
                    patchItemField(idx, "label", cleanInlineEditorHtml(e.currentTarget.innerHTML));
                  }}
                  style={{
                    flex: 1,
                    fontSize: compact ? 18 : 26,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: textColor,
                    outline: editor ? "1px dashed rgba(14,165,233,0.4)" : "none",
                    borderRadius: 6,
                    padding: editor ? "3px 8px" : "0",
                  }}
                  dangerouslySetInnerHTML={{ __html: asRichHtml(item.label) }}
                />
                <span style={{ color: "rgba(255,255,255,0.20)", fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                  {String(idx + 1).padStart(2, "0")}&nbsp;/&nbsp;{String(items.length).padStart(2, "0")}
                </span>
                {editor ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeItem(idx); }}
                    title="Remove panel"
                    style={{ background: "rgba(239,68,68,0.15)", border: "none", color: "#f87171", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 700, flexShrink: 0, marginLeft: 6 }}
                  >Remove</button>
                ) : null}
              </div>

              {/* ── 2-col content area ──────────────────────────────────── */}
              <div
                style={{
                  display: "flex",
                  flexDirection: compact ? "column" : (imageRight ? "row" : "row-reverse"),
                  flex: 1,
                  overflow: "hidden",
                  minHeight: 0,
                }}
              >
                {/* Text column */}
                <div
                  style={{
                    flex: "0 0 50%",
                    maxWidth: compact ? "100%" : "50%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: 22,
                    padding: compact ? "32px 24px" : "52px 64px",
                    overflowY: "auto",
                  }}
                >
                  {item.contentBlocks.map((block, cbIdx) => renderCb(item, idx, block, cbIdx))}
                  {editor ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, paddingTop: 12, borderTop: "1px dashed rgba(14,165,233,0.2)" }}>
                      {["eyebrow", "heading", "text", "stat", "tags", "cta"].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); addContentBlock(idx, type); }}
                          style={{ background: "rgba(14,165,233,0.10)", border: "1px dashed rgba(14,165,233,0.35)", color: accent, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}
                        >+ {type}</button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Image column */}
                <div
                  style={{
                    flex: "0 0 50%",
                    maxWidth: compact ? "100%" : "50%",
                    position: "relative",
                    overflow: "hidden",
                    minHeight: compact ? 260 : 0,
                  }}
                >
                  <div
                    onMouseEnter={() => !editor && setHoveredImg(idx)}
                    onMouseLeave={() => setHoveredImg(-1)}
                    style={{ position: "absolute", inset: 0, overflow: "hidden" }}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.imageAlt || item.label}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                          transform: hoveredImg === idx ? "scale(1.07)" : "scale(1)",
                          transition: "transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                          willChange: "transform",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          background: "rgba(255,255,255,0.04)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                          color: "rgba(255,255,255,0.35)",
                        }}
                      >
                        <span style={{ fontSize: 40 }}>🖼️</span>
                        <span style={{ fontSize: 13 }}>Use Properties Panel to add image</span>
                      </div>
                    )}
                    {editor && item.image ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); patchItemField(idx, "image", ""); }}
                        title="Remove image"
                        style={{ position: "absolute", top: 10, right: 10, background: "rgba(15,23,42,0.85)", border: "none", color: "#f87171", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                      >✕</button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add section — editor only */}
      {editor ? (
        <div style={{ padding: "24px", display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); addItem(); }}
            style={{ background: "rgba(14,165,233,0.10)", border: "2px dashed rgba(14,165,233,0.4)", color: accent, borderRadius: 10, padding: "14px 36px", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em" }}
          >+ Add Panel</button>
        </div>
      ) : null}
    </section>
  );
}

`;

const before = src.slice(0, startIdx);
const after  = src.slice(endIdx); // keeps "\nexport {" and everything after
const result = before + newBlock + after;

fs.writeFileSync(target, result, "utf8");
console.log("Done. Lines:", result.split("\n").length);
