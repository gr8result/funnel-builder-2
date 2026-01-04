import { useState } from "react";
import Head from "next/head";

const SECTION_DEFS = {
  header: {
    label: "Header / Nav",
    color: "#2563eb",
    create: () => ({
      type: "header",
      logo: "Your Logo",
      links: ["Home", "About", "Contact"],
    }),
  },
  hero: {
    label: "Hero",
    color: "#7c3aed",
    create: () => ({
      type: "hero",
      heading: "Grow your business",
      sub: "Everything you need to convert visitors into leads",
      cta: "Get Started",
    }),
  },
  features: {
    label: "3 Features",
    color: "#059669",
    create: () => ({
      type: "features",
      items: [
        { title: "Fast", text: "Launch quickly" },
        { title: "Simple", text: "No code needed" },
        { title: "Powerful", text: "Built for growth" },
      ],
    }),
  },
  form: {
    label: "Form",
    color: "#f59e0b",
    create: () => ({
      type: "form",
      heading: "Get in touch",
      fields: ["Name", "Email", "Message"],
      button: "Submit",
    }),
  },
  faq: {
    label: "FAQ",
    color: "#dc2626",
    create: () => ({
      type: "faq",
      items: [
        { q: "How does it work?", a: "Drag and drop sections." },
        { q: "Do I need code?", a: "No." },
      ],
    }),
  },
};

export default function WebsiteBuilderEditor() {
  const [sections, setSections] = useState([]);

  function addSection(type) {
    setSections((s) => [...s, SECTION_DEFS[type].create()]);
  }

  function onDrop(e) {
    const type = e.dataTransfer.getData("section");
    if (type) addSection(type);
  }

  return (
    <>
      <Head>
        <title>Website Builder</title>
      </Head>

      <div style={{ display: "flex", height: "100vh", background: "#020617" }}>
        {/* LEFT PANEL */}
        <div style={{ width: 220, padding: 12 }}>
          <h3 style={{ color: "#fff" }}>Sections</h3>
          {Object.entries(SECTION_DEFS).map(([key, def]) => (
            <div
              key={key}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("section", key)}
              onClick={() => addSection(key)}
              style={{
                background: def.color,
                color: "#fff",
                padding: 14,
                borderRadius: 6,
                marginBottom: 10,
                cursor: "grab",
                textAlign: "center",
                fontWeight: 700,
              }}
            >
              {def.label}
            </div>
          ))}
        </div>

        {/* CANVAS */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          style={{
            flex: 1,
            background: "#fff",
            margin: 20,
            borderRadius: 8,
            padding: 30,
            overflowY: "auto",
          }}
        >
          {sections.length === 0 && (
            <div style={{ textAlign: "center", color: "#999" }}>
              Drag a section here
            </div>
          )}

          {sections.map((s, i) => (
            <Section key={i} data={s} />
          ))}
        </div>
      </div>
    </>
  );
}

function Section({ data }) {
  if (data.type === "header") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 40 }}>
        <strong>{data.logo}</strong>
        <div>{data.links.join(" | ")}</div>
      </div>
    );
  }

  if (data.type === "hero") {
    return (
      <div style={{ marginBottom: 60 }}>
        <h1>{data.heading}</h1>
        <p>{data.sub}</p>
        <button>{data.cta}</button>
      </div>
    );
  }

  if (data.type === "features") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginBottom: 60 }}>
        {data.items.map((f, i) => (
          <div key={i}>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        ))}
      </div>
    );
  }

  if (data.type === "form") {
    return (
      <form style={{ marginBottom: 60 }}>
        <h3>{data.heading}</h3>
        {data.fields.map((f, i) => (
          <input key={i} placeholder={f} style={{ display: "block", marginBottom: 10 }} />
        ))}
        <button>{data.button}</button>
      </form>
    );
  }

  if (data.type === "faq") {
    return (
      <div>
        {data.items.map((q, i) => (
          <div key={i}>
            <strong>{q.q}</strong>
            <p>{q.a}</p>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
