// ============================================
// /components/email/Inspector.js
// GR8 RESULT — Email Builder (single source of truth + image fit/focal + selected label)
// FULL REPLACEMENT
// ============================================

import { backgroundToColor } from "../../lib/email/blockSchema";

export default function Inspector({ selectedBlock, onUpdateStyle, onUpdateContent }) {
  const sectionTitle = (t) => (
    <div style={{ fontWeight: 900, marginTop: 14, marginBottom: 8, color: "#7dd3fc" }}>{t}</div>
  );

  const label = (t) => <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6, color: "#cbd5e1" }}>{t}</div>;

  const inputStyle = {
    width: "100%",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(0,0,0,.25)",
    color: "#e5e7eb",
    padding: "10px 10px",
    outline: "none",
    fontWeight: 700,
  };

  const selectStyle = { ...inputStyle, cursor: "pointer" };
  const tinyRow = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };

  if (!selectedBlock) {
    return (
      <div style={{ color: "#cbd5e1", fontSize: 13, opacity: 0.9 }}>
        <div style={{ fontWeight: 900, color: "#22c55e", marginBottom: 8 }}>Inspector</div>
        Select a block to edit its settings.
      </div>
    );
  }

  const b = selectedBlock;
  const s = b.style || {};
  const c = b.content || {};

  const isImageLike = b.type === "image" || b.type === "hero";

  return (
    <div>
      <div style={{ fontWeight: 900, color: "#22c55e", marginBottom: 6 }}>Inspector</div>

      <div
        style={{
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,.10)",
          background: "rgba(0,0,0,.22)",
          padding: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.9, color: "#cbd5e1" }}>Selected block</div>
        <div style={{ fontSize: 13, fontWeight: 900, marginTop: 4, color: "#e5e7eb" }}>{String(b.type).toUpperCase()}</div>
      </div>

      {sectionTitle("Block box")}

      {label("Background")}
      <select value={s.background || "none"} onChange={(e) => onUpdateStyle({ background: e.target.value })} style={selectStyle}>
        <option value="none">None</option>
        <option value="brand">Brand</option>
        <option value="dark">Dark</option>
        <option value="light">Light</option>
      </select>

      <div style={{ ...tinyRow, marginTop: 10 }}>
        <div>
          {label("Padding")}
          <input
            type="number"
            value={Number.isFinite(+s.padding) ? +s.padding : 18}
            onChange={(e) => onUpdateStyle({ padding: +e.target.value })}
            style={inputStyle}
          />
        </div>
        <div>
          {label("Corner radius")}
          <input
            type="number"
            value={Number.isFinite(+s.radius) ? +s.radius : 0}
            onChange={(e) => onUpdateStyle({ radius: +e.target.value })}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ ...tinyRow, marginTop: 10 }}>
        <div>
          {label("Align")}
          <select value={s.align || "center"} onChange={(e) => onUpdateStyle({ align: e.target.value })} style={selectStyle}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
        <div>
          {label("Text colour")}
          <select value={s.textColor || "#ffffff"} onChange={(e) => onUpdateStyle({ textColor: e.target.value })} style={selectStyle}>
            <option value="#ffffff">White (#fff)</option>
            <option value="#e5e7eb">Grey (light)</option>
            <option value="#0b1220">Dark</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 10, borderRadius: 12, padding: 10, background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.12)" }}>
        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6, color: "#cbd5e1" }}>Preview</div>
        <div
          style={{
            height: 26,
            borderRadius: 10,
            background: backgroundToColor(s.background || "none"),
            border: "1px solid rgba(255,255,255,.12)",
          }}
        />
      </div>

      {/* Block-specific */}
      {b.type === "header" && (
        <>
          {sectionTitle("Header")}
          {label("Title")}
          <input value={c.title || ""} onChange={(e) => onUpdateContent({ title: e.target.value })} style={inputStyle} />
          <div style={{ height: 10 }} />
          {label("Subtitle")}
          <input value={c.subtitle || ""} onChange={(e) => onUpdateContent({ subtitle: e.target.value })} style={inputStyle} />
        </>
      )}

      {b.type === "hero" && (
        <>
          {sectionTitle("Hero")}
          {label("Title")}
          <input value={c.title || ""} onChange={(e) => onUpdateContent({ title: e.target.value })} style={inputStyle} />
          <div style={{ height: 10 }} />
          {label("Subtitle")}
          <input value={c.subtitle || ""} onChange={(e) => onUpdateContent({ subtitle: e.target.value })} style={inputStyle} />
        </>
      )}

      {b.type === "button" && (
        <>
          {sectionTitle("Button")}
          {label("Label")}
          <input value={c.label || ""} onChange={(e) => onUpdateContent({ label: e.target.value })} style={inputStyle} />
          <div style={{ height: 10 }} />
          {label("URL")}
          <input value={c.url || ""} onChange={(e) => onUpdateContent({ url: e.target.value })} style={inputStyle} />
        </>
      )}

      {b.type === "image" && (
        <>
          {sectionTitle("Image")}
          {label("Alt text")}
          <input value={c.alt || ""} onChange={(e) => onUpdateContent({ alt: e.target.value })} style={inputStyle} />
        </>
      )}

      {(b.type === "spacer") && (
        <>
          {sectionTitle("Spacer")}
          {label("Height")}
          <input
            type="number"
            value={Number.isFinite(+c.height) ? +c.height : 24}
            onChange={(e) => onUpdateContent({ height: +e.target.value })}
            style={inputStyle}
          />
        </>
      )}

      {(b.type === "divider") && (
        <>
          {sectionTitle("Divider")}
          {label("Thickness")}
          <input
            type="number"
            value={Number.isFinite(+c.thickness) ? +c.thickness : 1}
            onChange={(e) => onUpdateContent({ thickness: +e.target.value })}
            style={inputStyle}
          />
        </>
      )}

      {(b.type === "footer") && (
        <>
          {sectionTitle("Footer")}
          {label("Text")}
          <input value={c.text || ""} onChange={(e) => onUpdateContent({ text: e.target.value })} style={inputStyle} />
        </>
      )}

      {/* Image fit + focal point (hero + image) */}
      {isImageLike && (
        <>
          {sectionTitle("Image display")}
          {label("Fit")}
          <select value={c.fit || "cover"} onChange={(e) => onUpdateContent({ fit: e.target.value })} style={selectStyle}>
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </select>

          <div style={{ ...tinyRow, marginTop: 10 }}>
            <div>
              {label("Focal X (%)")}
              <input
                type="number"
                value={Number.isFinite(+c.focalX) ? +c.focalX : 50}
                onChange={(e) => onUpdateContent({ focalX: +e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              {label("Focal Y (%)")}
              <input
                type="number"
                value={Number.isFinite(+c.focalY) ? +c.focalY : 50}
                onChange={(e) => onUpdateContent({ focalY: +e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {label("Quick sliders")}
            <input type="range" min="0" max="100" value={Number.isFinite(+c.focalX) ? +c.focalX : 50} onChange={(e) => onUpdateContent({ focalX: +e.target.value })} />
            <input type="range" min="0" max="100" value={Number.isFinite(+c.focalY) ? +c.focalY : 50} onChange={(e) => onUpdateContent({ focalY: +e.target.value })} />
          </div>
        </>
      )}

      {b.type === "text" && (
        <>
          {sectionTitle("Text")}
          <div style={{ fontSize: 12, opacity: 0.9, color: "#cbd5e1" }}>
            Edit text directly in the block. Toolbar appears above the text block when selected.
          </div>
        </>
      )}
    </div>
  );
}
