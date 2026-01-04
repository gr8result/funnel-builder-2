import { useState } from "react";
import { SECTIONS, STARTER_TEMPLATES } from "./sections";

export default function WebsiteBuilderEditor() {
  const [sections, setSections] = useState([]);
  const [selected, setSelected] = useState(null);

  function addSection(key, index = null) {
    const section = SECTIONS[key].create();
    setSections((prev) => {
      const next = [...prev];
      if (index === null) next.push(section);
      else next.splice(index, 0, section);
      return next;
    });
  }

  function loadTemplate(name) {
    const layout = STARTER_TEMPLATES[name] || [];
    setSections(layout.map((k) => SECTIONS[k].create()));
    setSelected(null);
  }

  function onDrop(e, index) {
    const key = e.dataTransfer.getData("section");
    if (key) addSection(key, index);
  }

  return (
    <div style={{ padding: 20 }}>
      {/* HEADER */}
      <div style={{
        background: "#0ea5e9",
        padding: 16,
        borderRadius: 8,
        color: "#fff",
        fontWeight: 600,
        marginBottom: 16,
      }}>
        Website Builder
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 280px", gap: 16 }}>
        {/* PALETTE */}
        <div>
          <h4>Sections</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {Object.entries(SECTIONS).map(([key, s]) => (
              <div
                key={key}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("section", key)}
                onClick={() => addSection(key)}
                style={{
                  background: s.color,
                  color: "#fff",
                  padding: 16,
                  borderRadius: 8,
                  textAlign: "center",
                  cursor: "grab",
                  fontWeight: 600,
                }}
              >
                {s.label}
              </div>
            ))}
          </div>

          <h4 style={{ marginTop: 20 }}>Templates</h4>
          <button onClick={() => loadTemplate("blank")}>Blank</button>
          <button onClick={() => loadTemplate("optin")}>Opt-in</button>
          <button onClick={() => loadTemplate("sales")}>Sales</button>
        </div>

        {/* CANVAS */}
        <div
          style={{
            background: "#fff",
            borderRadius: 10,
            padding: 20,
            minHeight: 500,
          }}
        >
          {sections.length === 0 && (
            <div style={{ textAlign: "center", opacity: 0.5 }}>
              Drag a section here
            </div>
          )}

          {sections.map((s, i) => (
            <div
              key={i}
              onClick={() => setSelected(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, i)}
              style={{
                border: selected === i ? "2px solid #0ea5e9" : "1px dashed #ddd",
                padding: 20,
                marginBottom: 16,
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              <RenderSection section={s} />
            </div>
          ))}

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, sections.length)}
            style={{ height: 40 }}
          />
        </div>

        {/* INSPECTOR */}
        <div>
          <h4>Inspector</h4>
          {selected === null ? (
            <div>No section selected</div>
          ) : (
            <Inspector
              section={sections[selected]}
              onChange={(next) =>
                setSections((prev) => {
                  const copy = [...prev];
                  copy[selected] = next;
                  return copy;
                })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function RenderSection({ section }) {
  switch (section.type) {
    case "hero":
    case "heroImage":
    case "cta":
      return (
        <>
          <h2>{section.heading}</h2>
          {section.text && <p>{section.text}</p>}
          <button>{section.button}</button>
        </>
      );

    case "features3":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {section.items.map((f, i) => (
            <div key={i}>
              <strong>{f.title}</strong>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      );

    case "optin":
      return (
        <>
          <h3>{section.heading}</h3>
          <p>{section.text}</p>
          <input placeholder="Email" />
          <button>{section.button}</button>
        </>
      );

    case "faq":
      return section.items.map((f, i) => (
        <div key={i}>
          <strong>{f.q}</strong>
          <p>{f.a}</p>
        </div>
      ));

    default:
      return null;
  }
}

function Inspector({ section, onChange }) {
  return (
    <textarea
      value={JSON.stringify(section, null, 2)}
      onChange={(e) => onChange(JSON.parse(e.target.value))}
      style={{ width: "100%", height: 300 }}
    />
  );
}
