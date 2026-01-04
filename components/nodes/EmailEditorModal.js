// /components/nodes/EmailEditorModal.js
import { useState } from "react";

export default function EmailEditorModal({ node, onSave, onClose }) {
  const initialBlocks = node?.data?.emailBlocks || [
    { id: 1, type: "text", content: "Write your email content here..." },
  ];
  const [blocks, setBlocks] = useState(initialBlocks);

  const addBlock = (type) => {
    const id = Date.now();
    const newBlock =
      type === "text"
        ? { id, type, content: "New text block" }
        : type === "image"
        ? { id, type, src: "", alt: "New image" }
        : { id, type, text: "Button Text", url: "#" };
    setBlocks([...blocks, newBlock]);
  };

  const updateBlock = (id, key, value) => {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, [key]: value } : b)));
  };

  const removeBlock = (id) => setBlocks(blocks.filter((b) => b.id !== id));

  const handleSave = () => {
    onSave({ ...node.data, emailBlocks: blocks });
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        color: "#fff",
      }}
    >
      <div
        style={{
          width: "90%",
          maxWidth: 900,
          background: "#111827",
          borderRadius: 10,
          padding: 20,
          display: "flex",
          gap: 20,
          position: "relative",
        }}
      >
        {/* Sidebar */}
        <div style={{ width: 200, display: "flex", flexDirection: "column", gap: 10 }}>
          <h3>Blocks</h3>
          <button onClick={() => addBlock("text")} style={btn("#22c55e")}>
            ➕ Text
          </button>
          <button onClick={() => addBlock("image")} style={btn("#3b82f6")}>
            🖼 Image
          </button>
          <button onClick={() => addBlock("button")} style={btn("#f97316")}>
            🔘 Button
          </button>
        </div>

        {/* Canvas */}
        <div
          style={{
            flex: 1,
            background: "#0c121a",
            padding: 20,
            borderRadius: 8,
            overflowY: "auto",
            maxHeight: "80vh",
          }}
        >
          <h3>{node?.data?.label || "Email Content"}</h3>
          {blocks.map((b) => (
            <div
              key={b.id}
              style={{
                background: "#1e293b",
                marginBottom: 10,
                padding: 10,
                borderRadius: 6,
              }}
            >
              {b.type === "text" && (
                <>
                  <textarea
                    value={b.content}
                    onChange={(e) => updateBlock(b.id, "content", e.target.value)}
                    style={{
                      width: "100%",
                      height: 80,
                      background: "#0c121a",
                      color: "#fff",
                      border: "1px solid #333",
                      borderRadius: 6,
                      padding: 6,
                    }}
                  />
                </>
              )}
              {b.type === "image" && (
                <>
                  <input
                    type="text"
                    placeholder="Image URL"
                    value={b.src}
                    onChange={(e) => updateBlock(b.id, "src", e.target.value)}
                    style={input}
                  />
                  <input
                    type="text"
                    placeholder="Alt text"
                    value={b.alt}
                    onChange={(e) => updateBlock(b.id, "alt", e.target.value)}
                    style={input}
                  />
                  {b.src && (
                    <img
                      src={b.src}
                      alt={b.alt}
                      style={{ width: "100%", marginTop: 6, borderRadius: 6 }}
                    />
                  )}
                </>
              )}
              {b.type === "button" && (
                <>
                  <input
                    type="text"
                    placeholder="Button text"
                    value={b.text}
                    onChange={(e) => updateBlock(b.id, "text", e.target.value)}
                    style={input}
                  />
                  <input
                    type="text"
                    placeholder="Button link URL"
                    value={b.url}
                    onChange={(e) => updateBlock(b.id, "url", e.target.value)}
                    style={input}
                  />
                  <div style={{ marginTop: 6 }}>
                    <a
                      href={b.url}
                      style={{
                        background: "#f97316",
                        color: "#fff",
                        padding: "6px 12px",
                        borderRadius: 6,
                        textDecoration: "none",
                      }}
                    >
                      {b.text}
                    </a>
                  </div>
                </>
              )}
              <button
                onClick={() => removeBlock(b.id)}
                style={{ ...btn("#ef4444"), marginTop: 6 }}
              >
                🗑 Remove
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            display: "flex",
            gap: 10,
          }}
        >
          <button onClick={handleSave} style={btn("#22c55e")}>
            💾 Save
          </button>
          <button onClick={onClose} style={btn("#ef4444")}>
            ✖ Close
          </button>
        </div>
      </div>
    </div>
  );
}

const btn = (c) => ({
  background: c,
  border: "none",
  borderRadius: 6,
  padding: "8px 12px",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: `0 0 8px ${c}88`,
});

const input = {
  width: "100%",
  marginTop: 4,
  background: "#0c121a",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: 6,
  padding: 6,
};
