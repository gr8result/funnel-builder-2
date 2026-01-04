// /pages/modules/website-builder/editor-test.js
// Craft.js MVP — stable resolver-safe version
// ✅ Tools outside canvas (drawers)
// ✅ Full-width canvas
// ✅ Drag/drop blocks works (no unknown node types)
// ✅ Click-to-edit text + buttons
// ✅ Save/Load localStorage (fresh key)

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useMemo, useRef, useState } from "react";
import {
  Editor,
  Frame,
  Element,
  Canvas,
  useEditor,
  useNode,
} from "@craftjs/core";
import ICONS from "../../../components/iconMap";

const MAX_W = 1680;
const LS_KEY = "gr8_site_builder__craft_clean_v1"; // ✅ NEW KEY (avoids old junk)

/* -----------------------------
   Drawer (overlay)
------------------------------ */
function Drawer({ open, side = "left", title, onClose, children, width = 380 }) {
  if (!open) return null;
  const isLeft = side === "left";
  return (
    <>
      <div
        onMouseDown={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 9998,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          width,
          [isLeft ? "left" : "right"]: 0,
          zIndex: 9999,
          background: "linear-gradient(135deg,#020617,rgba(15,23,42,0.98))",
          borderRight: isLeft ? "1px solid rgba(148,163,184,0.18)" : "none",
          borderLeft: !isLeft ? "1px solid rgba(148,163,184,0.18)" : "none",
          boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "14px 14px",
            borderBottom: "1px solid rgba(148,163,184,0.14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 13, color: "#e5e7eb" }}>
            {title}
          </div>
          <button
            onClick={onClose}
            style={{
              borderRadius: 10,
              padding: "6px 10px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(148,163,184,0.18)",
              color: "#e5e7eb",
              cursor: "pointer",
              fontWeight: 900,
              fontSize: 12,
            }}
          >
            Close
          </button>
        </div>
        <div style={{ padding: 14, overflow: "auto", height: "100%" }}>
          {children}
        </div>
      </div>
    </>
  );
}

/* -----------------------------
   Settings helpers
------------------------------ */
function Field({ label, children }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: "#e5e7eb" }}>
        {label}
      </div>
      {children}
    </div>
  );
}
function inputStyle() {
  return {
    width: "100%",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    padding: "10px 10px",
    fontSize: 13,
    outline: "none",
  };
}

/* -----------------------------
   Craft nodes
------------------------------ */
function PageRoot({ children }) {
  const {
    connectors: { connect },
    selected,
    id,
  } = useNode((n) => ({ selected: n.events.selected, id: n.id }));

  return (
    <div
      ref={(ref) => connect(ref)}
      style={{
        minHeight: 200,
        outline: selected ? "2px solid rgba(59,130,246,0.55)" : "none",
        outlineOffset: -2,
      }}
    >
      <Canvas id={`root-${id}`}>{children}</Canvas>
    </div>
  );
}
PageRoot.craft = { rules: { canDrag: () => false } };

function Section({ bg = "dark", paddingY = 56, children }) {
  const {
    connectors: { connect, drag },
    selected,
    id,
  } = useNode((n) => ({ selected: n.events.selected, id: n.id }));

  const styleBg =
    bg === "blue" ? "#0b2a55" : bg === "light" ? "#0f172a" : "#020617";

  return (
    <div
      ref={(ref) => connect(drag(ref))}
      style={{
        background: styleBg,
        padding: `${paddingY}px 24px`,
        outline: selected ? "2px solid rgba(59,130,246,0.75)" : "none",
        outlineOffset: -2,
        cursor: "grab",
      }}
      title="Drag section. Drop blocks inside."
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Canvas id={`section-${id}`}>{children}</Canvas>
      </div>
    </div>
  );
}
Section.craft = {
  props: { bg: "dark", paddingY: 56 },
  related: { settings: SectionSettings },
};

function SectionSettings() {
  const { actions, bg, paddingY } = useNode((n) => ({
    bg: n.data.props.bg,
    paddingY: n.data.props.paddingY,
  }));

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Field label="Background">
        <select
          value={bg}
          onChange={(e) => actions.setProp((p) => (p.bg = e.target.value))}
          style={inputStyle()}
        >
          <option value="dark">Dark</option>
          <option value="blue">Blue</option>
          <option value="light">Light</option>
        </select>
      </Field>

      <Field label="Vertical padding">
        <input
          type="range"
          min="24"
          max="120"
          value={paddingY}
          onChange={(e) =>
            actions.setProp((p) => (p.paddingY = Number(e.target.value)))
          }
          style={{ width: "100%" }}
        />
        <div style={{ color: "#9ca3af", fontSize: 12, fontWeight: 800 }}>
          {paddingY}px
        </div>
      </Field>
    </div>
  );
}

function Spacer({ h = 16 }) {
  const {
    connectors: { connect, drag },
    selected,
  } = useNode((n) => ({ selected: n.events.selected }));

  return (
    <div
      ref={(ref) => connect(drag(ref))}
      style={{
        height: h,
        outline: selected ? "2px dashed rgba(148,163,184,0.25)" : "none",
        outlineOffset: 2,
      }}
      title="Spacer"
    />
  );
}
Spacer.craft = {
  props: { h: 16 },
  related: { settings: SpacerSettings },
};

function SpacerSettings() {
  const { actions, h } = useNode((n) => ({ h: n.data.props.h }));
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Field label="Height">
        <input
          type="range"
          min="0"
          max="120"
          value={h}
          onChange={(e) => actions.setProp((p) => (p.h = Number(e.target.value)))}
          style={{ width: "100%" }}
        />
        <div style={{ color: "#9ca3af", fontSize: 12, fontWeight: 800 }}>
          {h}px
        </div>
      </Field>
    </div>
  );
}

function Text({
  text = "Click to edit text",
  as = "div",
  size = 16,
  weight = 600,
  color = "#e5e7eb",
}) {
  const {
    connectors: { connect, drag },
    actions,
    selected,
  } = useNode((n) => ({ selected: n.events.selected }));

  const Tag = as;

  return (
    <Tag
      ref={(ref) => connect(drag(ref))}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={(e) => actions.setProp((p) => (p.text = e.currentTarget.innerText))}
      style={{
        fontSize: size,
        fontWeight: weight,
        color,
        lineHeight: 1.55,
        outline: selected ? "2px solid rgba(34,197,94,0.6)" : "none",
        outlineOffset: 2,
        borderRadius: 8,
        padding: selected ? "2px 6px" : 0,
        cursor: "text",
      }}
      title="Click to edit"
    >
      {text}
    </Tag>
  );
}
Text.craft = {
  props: { text: "Click to edit text", as: "div", size: 16, weight: 600, color: "#e5e7eb" },
  related: { settings: TextSettings },
};

function TextSettings() {
  const { actions, text, as, size, weight, color } = useNode((n) => ({
    text: n.data.props.text,
    as: n.data.props.as,
    size: n.data.props.size,
    weight: n.data.props.weight,
    color: n.data.props.color,
  }));

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Field label="Tag">
        <select
          value={as}
          onChange={(e) => actions.setProp((p) => (p.as = e.target.value))}
          style={inputStyle()}
        >
          <option value="div">div</option>
          <option value="h1">h1</option>
          <option value="h2">h2</option>
          <option value="h3">h3</option>
          <option value="p">p</option>
        </select>
      </Field>

      <Field label="Text">
        <textarea
          value={text}
          onChange={(e) => actions.setProp((p) => (p.text = e.target.value))}
          rows={4}
          style={{ ...inputStyle(), resize: "vertical" }}
        />
      </Field>

      <Field label="Size">
        <input
          type="range"
          min="12"
          max="64"
          value={size}
          onChange={(e) => actions.setProp((p) => (p.size = Number(e.target.value)))}
          style={{ width: "100%" }}
        />
      </Field>

      <Field label="Weight">
        <select
          value={weight}
          onChange={(e) => actions.setProp((p) => (p.weight = Number(e.target.value)))}
          style={inputStyle()}
        >
          {[400, 500, 600, 700, 800, 900].map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Color">
        <input
          value={color}
          onChange={(e) => actions.setProp((p) => (p.color = e.target.value))}
          style={inputStyle()}
        />
      </Field>
    </div>
  );
}

function Button({ label = "Get started", href = "#", variant = "green" }) {
  const {
    connectors: { connect, drag },
    actions,
    selected,
  } = useNode((n) => ({ selected: n.events.selected }));

  const bg = variant === "blue" ? "#3b82f6" : "#22c55e";
  const fg = variant === "blue" ? "#e5f0ff" : "#022c22";

  return (
    <a
      ref={(ref) => connect(drag(ref))}
      href={href}
      onClick={(e) => e.preventDefault()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 16px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontWeight: 900,
        textDecoration: "none",
        fontSize: 14,
        cursor: "pointer",
        outline: selected ? "2px solid rgba(59,130,246,0.65)" : "none",
        outlineOffset: 2,
      }}
    >
      <span
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onBlur={(e) => actions.setProp((p) => (p.label = e.currentTarget.innerText))}
        style={{ outline: "none", cursor: "text" }}
      >
        {label}
      </span>
    </a>
  );
}
Button.craft = {
  props: { label: "Get started", href: "#", variant: "green" },
  related: { settings: ButtonSettings },
};

function ButtonSettings() {
  const { actions, href, variant } = useNode((n) => ({
    href: n.data.props.href,
    variant: n.data.props.variant,
  }));
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Field label="Link (href)">
        <input
          value={href}
          onChange={(e) => actions.setProp((p) => (p.href = e.target.value))}
          style={inputStyle()}
        />
      </Field>
      <Field label="Variant">
        <select
          value={variant}
          onChange={(e) => actions.setProp((p) => (p.variant = e.target.value))}
          style={inputStyle()}
        >
          <option value="green">Green</option>
          <option value="blue">Blue</option>
        </select>
      </Field>
    </div>
  );
}

function Image({ src = "", alt = "Image", radius = 16 }) {
  const {
    connectors: { connect, drag },
    selected,
  } = useNode((n) => ({ selected: n.events.selected }));

  return (
    <div
      ref={(ref) => connect(drag(ref))}
      style={{
        borderRadius: radius,
        overflow: "hidden",
        border: "1px solid rgba(148,163,184,0.25)",
        background: "rgba(2,6,23,0.65)",
        minHeight: 240,
        outline: selected ? "2px solid rgba(249,115,22,0.55)" : "none",
        outlineOffset: 2,
      }}
      title="Select image and edit URL in settings"
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div style={{ padding: 14, color: "#9ca3af", fontSize: 13, fontWeight: 900 }}>
          No image URL yet. Select this block and paste a URL in settings.
        </div>
      )}
    </div>
  );
}
Image.craft = {
  props: { src: "", alt: "Image", radius: 16 },
  related: { settings: ImageSettings },
};

function ImageSettings() {
  const { actions, src, alt, radius } = useNode((n) => ({
    src: n.data.props.src,
    alt: n.data.props.alt,
    radius: n.data.props.radius,
  }));

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Field label="Image URL">
        <input
          value={src}
          onChange={(e) => actions.setProp((p) => (p.src = e.target.value))}
          style={inputStyle()}
        />
      </Field>
      <Field label="Alt text">
        <input
          value={alt}
          onChange={(e) => actions.setProp((p) => (p.alt = e.target.value))}
          style={inputStyle()}
        />
      </Field>
      <Field label="Corner radius">
        <input
          type="range"
          min="0"
          max="28"
          value={radius}
          onChange={(e) => actions.setProp((p) => (p.radius = Number(e.target.value)))}
          style={{ width: "100%" }}
        />
      </Field>
    </div>
  );
}

/* -----------------------------
   Toolbox / Settings panel
------------------------------ */
function Toolbox() {
  const { connectors } = useEditor();

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ color: "#9ca3af", fontSize: 12, fontWeight: 900 }}>
        Drag items into a section.
      </div>

      <ToolButton
        title="Section"
        desc="A new droppable section"
        refFn={(ref) =>
          connectors.create(
            ref,
            <Element is={Section} canvas bg="dark" paddingY={56}>
              <Element is={Text} as="h2" size={28} weight={900} text="New section" />
              <Element is={Spacer} h={12} />
              <Element is={Text} as="p" size={15} weight={700} color="#9ca3af" text="Drop blocks here." />
            </Element>
          )
        }
      />

      <ToolButton
        title="Text"
        desc="Editable text"
        refFn={(ref) => connectors.create(ref, <Element is={Text} text="Click to edit text" />)}
      />

      <ToolButton
        title="Button"
        desc="Editable label"
        refFn={(ref) => connectors.create(ref, <Element is={Button} label="Button" variant="blue" />)}
      />

      <ToolButton
        title="Image"
        desc="Image (URL in settings)"
        refFn={(ref) =>
          connectors.create(
            ref,
            <Element
              is={Image}
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=80"
              alt="Image"
              radius={16}
            />
          )
        }
      />

      <ToolButton
        title="Spacer"
        desc="Vertical gap"
        refFn={(ref) => connectors.create(ref, <Element is={Spacer} h={18} />)}
      />
    </div>
  );
}

function ToolButton({ title, desc, refFn }) {
  return (
    <div
      ref={refFn}
      style={{
        borderRadius: 14,
        border: "1px solid rgba(148,163,184,0.18)",
        background: "rgba(255,255,255,0.04)",
        padding: 12,
        cursor: "grab",
        userSelect: "none",
      }}
      title="Drag into the canvas"
    >
      <div style={{ fontWeight: 900, fontSize: 13, color: "#e5e7eb" }}>{title}</div>
      <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 12, fontWeight: 700 }}>{desc}</div>
      <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 11, fontWeight: 900 }}>
        Drag into canvas →
      </div>
    </div>
  );
}

function SettingsPanel() {
  const { selected, name, settings } = useEditor((state) => {
    const set = state.events.selected;
    const id = set && set.size ? Array.from(set)[0] : null;
    if (!id) return { selected: null, name: "", settings: null };
    const node = state.nodes[id];
    return {
      selected: id,
      name: node?.data?.displayName || node?.data?.name || "Selected",
      settings: node?.related?.settings || null,
    };
  });

  if (!selected) {
    return <div style={{ color: "#9ca3af", fontSize: 13, fontWeight: 800 }}>Select a block to edit.</div>;
  }

  const Settings = settings;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          borderRadius: 12,
          padding: "10px 12px",
          background: "rgba(59,130,246,0.12)",
          border: "1px solid rgba(59,130,246,0.22)",
          color: "#e5f0ff",
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        Selected: {name}
      </div>
      {Settings ? (
        <div
          style={{
            borderRadius: 14,
            border: "1px solid rgba(148,163,184,0.18)",
            background: "rgba(255,255,255,0.03)",
            padding: 12,
          }}
        >
          <Settings />
        </div>
      ) : (
        <div style={{ color: "#9ca3af", fontSize: 13, fontWeight: 800 }}>No settings for this block.</div>
      )}
    </div>
  );
}

/* -----------------------------
   Top bar (Save/Load/Reset)
------------------------------ */
function TopBar({ onOpenSections, onOpenSettings, onToast }) {
  const { query, actions } = useEditor();

  const doSave = () => {
    try {
      localStorage.setItem(LS_KEY, query.serialize());
      onToast("Saved (local) ✅");
    } catch {
      onToast("Save failed ❌");
    }
  };

  const doLoad = () => {
    try {
      const json = localStorage.getItem(LS_KEY);
      if (!json) return onToast("No saved page yet.");
      actions.deserialize(json);
      onToast("Loaded ✅");
    } catch {
      onToast("Load failed ❌ (old/bad data)");
    }
  };

  const doClear = () => {
    localStorage.removeItem(LS_KEY);
    onToast("Cleared saved layout ✅ (refresh)");
  };

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
      <button onClick={onOpenSections} style={pillBtn()}>Sections</button>
      <button onClick={onOpenSettings} style={pillBtn()}>Settings</button>

      <button
        onClick={doSave}
        style={{ ...pillBtn(), background: "#22c55e", border: "none", color: "#022c22" }}
      >
        Save
      </button>

      <button onClick={doLoad} style={pillBtn()}>Load</button>
      <button onClick={doClear} style={pillBtn()}>Clear</button>

      <Link href="/modules/website-builder">
        <button style={{ ...pillBtn(), background: "#1e293b", border: "1px solid #334155" }}>
          ← Back
        </button>
      </Link>
    </div>
  );
}

function pillBtn() {
  return {
    background: "rgba(30,41,59,0.85)",
    color: "#fff",
    border: "1px solid rgba(51,65,85,0.9)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 900,
    whiteSpace: "nowrap",
  };
}

/* -----------------------------
   Template (resolver-safe)
------------------------------ */
function buildTemplate(type, template) {
  const headline =
    type === "landing" ? "Landing Page (MVP Builder)" : "Website (MVP Builder)";

  return (
    <Element is={PageRoot} canvas>
      <Element is={Section} canvas bg="dark" paddingY={64}>
        <Element is={Text} as="h1" size={46} weight={900} text={headline} />
        <Element is={Spacer} h={10} />
        <Element
          is={Text}
          as="p"
          size={16}
          weight={700}
          color="#9ca3af"
          text={`Template: ${template}. Drag blocks in from the left drawer.`}
        />
        <Element is={Spacer} h={18} />
        <Element
          is={Image}
          src="https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=1400&q=80"
          alt="Hero"
          radius={18}
        />
        <Element is={Spacer} h={16} />
        <Element is={Button} label="Get started" href="#" variant="green" />
      </Element>

      <Element is={Section} canvas bg="light" paddingY={54}>
        <Element is={Text} as="h2" size={28} weight={900} text="Benefits" />
        <Element is={Spacer} h={10} />
        <Element
          is={Text}
          as="p"
          size={15}
          weight={700}
          color="#9ca3af"
          text="Now it’s stable. Next we add grids/columns once drag/drop is confirmed."
        />
      </Element>
    </Element>
  );
}

/* -----------------------------
   Page
------------------------------ */
export default function WebsiteBuilderEditorTest() {
  const router = useRouter();
  const [openLeft, setOpenLeft] = useState(false);
  const [openRight, setOpenRight] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  const type = (router.query.type || "website").toString();
  const template = (router.query.template || "business-site").toString();

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  };

  const frameContent = useMemo(() => buildTemplate(type, template), [type, template]);

  return (
    <>
      <Head>
        <title>Website Builder Test | GR8 RESULT</title>
      </Head>

      <Editor
        enabled={true}
        resolver={{ PageRoot, Section, Spacer, Text, Button, Image }}
      >
        <div
          style={{
            minHeight: "100vh",
            background: "#0c121a",
            color: "#fff",
            padding: "28px 22px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Banner */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 18,
              background: "#3b82f6",
              padding: "16px 20px",
              borderRadius: 12,
              marginBottom: 14,
              width: "100%",
              maxWidth: MAX_W,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: "50%",
                  padding: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {ICONS.websiteBuilder({ size: 48 })}
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 40, fontWeight: 600 }}>
                  Website Builder (Test)
                </h1>
                <p style={{ margin: 0, fontSize: 16, opacity: 0.95 }}>
                  Type: <strong>{type}</strong> / Template: <strong>{template}</strong>
                </p>
              </div>
            </div>

            <TopBar
              onOpenSections={() => setOpenLeft(true)}
              onOpenSettings={() => setOpenRight(true)}
              onToast={showToast}
            />
          </div>

          {toast && (
            <div
              style={{
                width: "100%",
                maxWidth: MAX_W,
                marginBottom: 10,
                borderRadius: 10,
                padding: "10px 12px",
                background: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.35)",
                color: "#86efac",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              {toast}
            </div>
          )}

          {/* Canvas */}
          <div
            style={{
              width: "100%",
              maxWidth: MAX_W,
              borderRadius: 12,
              border: "1px solid #111827",
              background: "#020617",
              boxShadow: "0 18px 50px rgba(15,23,42,0.9)",
              overflow: "hidden",
              height: "calc(100vh - 200px)",
            }}
          >
            <div style={{ height: "100%", overflow: "auto" }}>
              <Frame>{frameContent}</Frame>
            </div>
          </div>

          {/* Drawers */}
          <Drawer
            open={openLeft}
            side="left"
            title="Sections & Blocks"
            onClose={() => setOpenLeft(false)}
            width={420}
          >
            <Toolbox />
          </Drawer>

          <Drawer
            open={openRight}
            side="right"
            title="Settings"
            onClose={() => setOpenRight(false)}
            width={460}
          >
            <SettingsPanel />
          </Drawer>
        </div>
      </Editor>
    </>
  );
}
