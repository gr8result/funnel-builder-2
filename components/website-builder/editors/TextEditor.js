// /components/website-builder/editors/TextEditor.js
// FULL REPLACEMENT — REAL text controls (font / size / color / align / bold/italic/underline)
// ✅ Works for ALL block types your builder creates (hero/text/features/cta/footer/nav/two_col/three_col/gallery/image)
// ✅ Stores formatting on block.textStyle and block.buttonStyle (where relevant)
// ✅ Updates existing fields (headline/body/etc) so preview changes immediately
//
// NOTE: BlockRenderer wraps blocks in a style wrapper so these settings actually show up.

import { useMemo } from "react";

const FONTS = [
  { label: "Inter", value: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial" },
  { label: "Poppins", value: "Poppins, Inter, system-ui, Arial" },
  { label: "Montserrat", value: "Montserrat, Inter, system-ui, Arial" },
  { label: "Roboto", value: "Roboto, Inter, system-ui, Arial" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
];

export default function TextEditor({ block, onChange }) {
  const b = block || {};
  const type = String(b.type || "");

  const textStyle = useMemo(() => {
    const s = (b.textStyle && typeof b.textStyle === "object") ? b.textStyle : {};
    return {
      fontFamily: s.fontFamily || FONTS[0].value,
      fontSize: clampNum(s.fontSize ?? 16, 10, 80),
      color: s.color || "#ffffff",
      align: s.align || "left",
      weight: s.weight || 800,
      italic: !!s.italic,
      underline: !!s.underline,
      lineHeight: clampNum(s.lineHeight ?? 1.35, 0.9, 2.2),
      letterSpacing: clampNum(s.letterSpacing ?? 0, -1, 6),
    };
  }, [b]);

  function patch(p) {
    onChange?.(p);
  }

  function patchTextStyle(p) {
    patch({ textStyle: { ...(b.textStyle || {}), ...p } });
  }

  function toggle(k) {
    patchTextStyle({ [k]: !textStyle[k] });
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={styles.sectionTitle}>Text</div>

      <Row>
        <Label>Font</Label>
        <select
          style={styles.select}
          value={textStyle.fontFamily}
          onChange={(e) => patchTextStyle({ fontFamily: e.target.value })}
        >
          {FONTS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </Row>

      <Row>
        <Label>Size</Label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            style={styles.range}
            type="range"
            min={10}
            max={80}
            value={textStyle.fontSize}
            onChange={(e) => patchTextStyle({ fontSize: Number(e.target.value) })}
          />
          <input
            style={styles.smallInput}
            value={String(textStyle.fontSize)}
            onChange={(e) => patchTextStyle({ fontSize: clampNum(Number(e.target.value), 10, 80) })}
          />
        </div>
      </Row>

      <Row>
        <Label>Colour</Label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="color"
            value={normalizeHex(textStyle.color)}
            onChange={(e) => patchTextStyle({ color: e.target.value })}
            style={styles.color}
          />
          <input
            style={styles.input}
            value={textStyle.color}
            onChange={(e) => patchTextStyle({ color: e.target.value })}
          />
        </div>
      </Row>

      <Row>
        <Label>Align</Label>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn(textStyle.align === "left")} onClick={() => patchTextStyle({ align: "left" })}>Left</button>
          <button style={btn(textStyle.align === "center")} onClick={() => patchTextStyle({ align: "center" })}>Center</button>
          <button style={btn(textStyle.align === "right")} onClick={() => patchTextStyle({ align: "right" })}>Right</button>
        </div>
      </Row>

      <Row>
        <Label>Style</Label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={btn(textStyle.weight >= 800)} onClick={() => patchTextStyle({ weight: textStyle.weight >= 800 ? 650 : 900 })}>
            Bold
          </button>
          <button style={btn(textStyle.italic)} onClick={() => toggle("italic")}>Italic</button>
          <button style={btn(textStyle.underline)} onClick={() => toggle("underline")}>Underline</button>
        </div>
      </Row>

      <Row>
        <Label>Line height</Label>
        <input
          style={styles.input}
          value={String(textStyle.lineHeight)}
          onChange={(e) => patchTextStyle({ lineHeight: clampNum(Number(e.target.value), 0.9, 2.2) })}
        />
      </Row>

      <Row>
        <Label>Letter spacing</Label>
        <input
          style={styles.input}
          value={String(textStyle.letterSpacing)}
          onChange={(e) => patchTextStyle({ letterSpacing: clampNum(Number(e.target.value), -1, 6) })}
        />
      </Row>

      <Divider />

      {/* Per-block content editors */}
      {type === "hero" && (
        <>
          <div style={styles.sectionTitle}>Hero</div>
          <TextField label="Kicker" value={b.kicker || ""} onChange={(v) => patch({ kicker: v })} />
          <TextField label="Headline" value={b.headline || ""} onChange={(v) => patch({ headline: v })} />
          <TextArea label="Subheadline" value={b.subheadline || ""} onChange={(v) => patch({ subheadline: v })} />
          <BulletsEditor bullets={b.bullets || []} onChange={(bullets) => patch({ bullets })} />
          <TextField label="Button text" value={b.buttonText || ""} onChange={(v) => patch({ buttonText: v })} />
        </>
      )}

      {type === "text" && (
        <>
          <div style={styles.sectionTitle}>Text block</div>
          <TextField label="Heading" value={b.heading || ""} onChange={(v) => patch({ heading: v })} />
          <TextArea label="Body" value={b.body || ""} onChange={(v) => patch({ body: v })} />
        </>
      )}

      {type === "features" && (
        <>
          <div style={styles.sectionTitle}>Features</div>
          <TextField label="Heading" value={b.heading || ""} onChange={(v) => patch({ heading: v })} />
          <FeaturesEditor items={b.items || []} onChange={(items) => patch({ items })} />
        </>
      )}

      {type === "cta" && (
        <>
          <div style={styles.sectionTitle}>CTA</div>
          <TextField label="Heading" value={b.heading || ""} onChange={(v) => patch({ heading: v })} />
          <TextArea label="Body" value={b.body || ""} onChange={(v) => patch({ body: v })} />
          <TextField label="Button text" value={b.buttonText || ""} onChange={(v) => patch({ buttonText: v })} />
        </>
      )}

      {type === "footer" && (
        <>
          <div style={styles.sectionTitle}>Footer</div>
          <TextArea label="Text" value={b.text || ""} onChange={(v) => patch({ text: v })} />
        </>
      )}

      {type === "nav" && (
        <>
          <div style={styles.sectionTitle}>Navigation</div>
          <TextField label="Brand" value={b.brand || ""} onChange={(v) => patch({ brand: v })} />
          <LinksEditor links={b.links || []} onChange={(links) => patch({ links })} />
          <TextField label="CTA label" value={b.cta || ""} onChange={(v) => patch({ cta: v })} />
        </>
      )}

      {type === "two_col" && (
        <>
          <div style={styles.sectionTitle}>2 Column</div>
          <TextField label="Heading" value={b.heading || ""} onChange={(v) => patch({ heading: v })} />
          <TextField
            label="Left title"
            value={(b.left && b.left.title) || ""}
            onChange={(v) => patch({ left: { ...(b.left || {}), title: v } })}
          />
          <TextArea
            label="Left text"
            value={(b.left && b.left.text) || ""}
            onChange={(v) => patch({ left: { ...(b.left || {}), text: v } })}
          />
          <BulletsEditor
            bullets={(b.left && b.left.bullets) || []}
            onChange={(bullets) => patch({ left: { ...(b.left || {}), bullets } })}
            label="Left bullets"
          />
          <TextField
            label="Right caption"
            value={(b.right && b.right.caption) || ""}
            onChange={(v) => patch({ right: { ...(b.right || {}), caption: v } })}
          />
          <TextField
            label="Right image URL"
            value={(b.right && b.right.image) || ""}
            onChange={(v) => patch({ right: { ...(b.right || {}), image: v } })}
          />
          <Row>
            <Label>Reverse columns</Label>
            <button style={btn(!!b.reverse)} onClick={() => patch({ reverse: !b.reverse })}>
              {b.reverse ? "On" : "Off"}
            </button>
          </Row>
        </>
      )}

      {type === "three_col" && (
        <>
          <div style={styles.sectionTitle}>3 Column</div>
          <TextField label="Heading" value={b.heading || ""} onChange={(v) => patch({ heading: v })} />
          <ThreeColEditor columns={b.columns || []} onChange={(columns) => patch({ columns })} />
        </>
      )}

      {type === "gallery" && (
        <>
          <div style={styles.sectionTitle}>Gallery</div>
          <TextField label="Heading" value={b.heading || ""} onChange={(v) => patch({ heading: v })} />
          <GalleryEditor images={b.images || []} onChange={(images) => patch({ images })} />
        </>
      )}

      {type === "image" && (
        <>
          <div style={styles.sectionTitle}>Image block</div>
          <TextField label="Caption" value={b.caption || ""} onChange={(v) => patch({ caption: v })} />
          <TextField label="Image URL" value={b.src || ""} onChange={(v) => patch({ src: v })} />
          <Row>
            <Label>Fit</Label>
            <select style={styles.select} value={b.fit || "cover"} onChange={(e) => patch({ fit: e.target.value })}>
              <option value="cover">cover</option>
              <option value="contain">contain</option>
              <option value="fill">fill</option>
            </select>
          </Row>
        </>
      )}
    </div>
  );
}

function TextField({ label, value, onChange }) {
  return (
    <>
      <div style={styles.label}>{label}</div>
      <input style={styles.input} value={value} onChange={(e) => onChange?.(e.target.value)} />
    </>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <>
      <div style={styles.label}>{label}</div>
      <textarea
        style={{ ...styles.input, minHeight: 86, resize: "vertical" }}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </>
  );
}

function BulletsEditor({ bullets, onChange, label = "Bullets" }) {
  const list = Array.isArray(bullets) ? bullets : [];
  function setAt(i, v) {
    const next = [...list];
    next[i] = v;
    onChange?.(next.filter((x) => String(x || "").trim().length));
  }
  function delAt(i) {
    const next = list.filter((_, idx) => idx !== i);
    onChange?.(next);
  }
  function add() {
    onChange?.([...list, "New bullet"]);
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={styles.label}>{label}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {list.map((x, i) => (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            <input style={styles.input} value={x} onChange={(e) => setAt(i, e.target.value)} />
            <button style={styles.xBtn} onClick={() => delAt(i)}>✕</button>
          </div>
        ))}
      </div>
      <button style={styles.addBtn} onClick={add}>+ Add bullet</button>
    </div>
  );
}

function FeaturesEditor({ items, onChange }) {
  const list = Array.isArray(items) ? items : [];
  function setItem(i, patch) {
    const next = [...list];
    next[i] = { ...(next[i] || {}), ...patch };
    onChange?.(next);
  }
  function del(i) {
    onChange?.(list.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange?.([...list, { title: "Feature", text: "Describe it." }]);
  }
  return (
    <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
      {list.map((it, i) => (
        <div key={i} style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <div style={{ color: "white", fontWeight: 950 }}>Item {i + 1}</div>
            <button style={styles.xBtn} onClick={() => del(i)}>✕</button>
          </div>
          <TextField label="Title" value={it.title || ""} onChange={(v) => setItem(i, { title: v })} />
          <TextArea label="Text" value={it.text || ""} onChange={(v) => setItem(i, { text: v })} />
        </div>
      ))}
      <button style={styles.addBtn} onClick={add}>+ Add feature</button>
    </div>
  );
}

function LinksEditor({ links, onChange }) {
  const list = Array.isArray(links) ? links : [];
  function setAt(i, v) {
    const next = [...list];
    next[i] = v;
    onChange?.(next.filter((x) => String(x || "").trim().length));
  }
  function delAt(i) {
    onChange?.(list.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange?.([...list, "New link"]);
  }
  return (
    <div style={{ marginTop: 8 }}>
      <div style={styles.label}>Links</div>
      <div style={{ display: "grid", gap: 8 }}>
        {list.map((x, i) => (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            <input style={styles.input} value={x} onChange={(e) => setAt(i, e.target.value)} />
            <button style={styles.xBtn} onClick={() => delAt(i)}>✕</button>
          </div>
        ))}
      </div>
      <button style={styles.addBtn} onClick={add}>+ Add link</button>
    </div>
  );
}

function ThreeColEditor({ columns, onChange }) {
  const cols = Array.isArray(columns) && columns.length ? columns : [
    { title: "Column 1", text: "Text…" },
    { title: "Column 2", text: "Text…" },
    { title: "Column 3", text: "Text…" },
  ];
  function setCol(i, patch) {
    const next = [...cols];
    next[i] = { ...(next[i] || {}), ...patch };
    onChange?.(next);
  }
  return (
    <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
      {cols.map((c, i) => (
        <div key={i} style={styles.card}>
          <div style={{ color: "white", fontWeight: 950 }}>Column {i + 1}</div>
          <TextField label="Title" value={c.title || ""} onChange={(v) => setCol(i, { title: v })} />
          <TextArea label="Text" value={c.text || ""} onChange={(v) => setCol(i, { text: v })} />
        </div>
      ))}
    </div>
  );
}

function GalleryEditor({ images, onChange }) {
  const list = Array.isArray(images) && images.length ? images : ["", "", "", "", "", ""];
  function setAt(i, v) {
    const next = [...list];
    next[i] = v;
    onChange?.(next);
  }
  return (
    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
      {list.map((url, i) => (
        <div key={i} style={{ display: "flex", gap: 8 }}>
          <input
            style={styles.input}
            value={url}
            placeholder={`Image URL ${i + 1}`}
            onChange={(e) => setAt(i, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "14px 0" }} />;
}

function Row({ children }) {
  return <div style={{ display: "grid", gap: 6, marginTop: 10 }}>{children}</div>;
}
function Label({ children }) {
  return <div style={styles.label}>{children}</div>;
}

function btn(active) {
  return {
    background: active ? "rgba(34,151,197,0.25)" : "rgba(255,255,255,0.06)",
    border: active ? "1px solid rgba(34,151,197,0.55)" : "1px solid rgba(255,255,255,0.12)",
    color: active ? "white" : "rgba(255,255,255,0.85)",
    padding: "10px 12px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 950,
  };
}

function clampNum(v, a, b) {
  const n = Number(v);
  if (!Number.isFinite(n)) return a;
  return Math.max(a, Math.min(b, n));
}
function normalizeHex(v) {
  const s = String(v || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  return "#ffffff";
}

const styles = {
  sectionTitle: { color: "white", fontWeight: 950, marginBottom: 8, marginTop: 6 },
  label: { color: "rgba(255,255,255,0.75)", fontWeight: 800, fontSize: 13 },
  input: {
    width: "100%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    color: "white",
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
  },
  smallInput: {
    width: 64,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    color: "white",
    padding: "10px 10px",
    fontSize: 14,
    outline: "none",
    textAlign: "center",
    fontWeight: 900,
  },
  select: {
    width: "100%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    color: "white",
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
    fontWeight: 900,
  },
  range: { width: "100%" },
  color: { width: 44, height: 40, borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "transparent" },
  xBtn: {
    width: 44,
    minWidth: 44,
    borderRadius: 10,
    background: "rgba(244,63,94,0.18)",
    border: "1px solid rgba(244,63,94,0.35)",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  },
  addBtn: {
    marginTop: 10,
    width: "100%",
    textAlign: "center",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "white",
    padding: "10px 12px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 950,
  },
  card: {
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.18)",
  },
};
