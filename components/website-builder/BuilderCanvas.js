export default function BuilderCanvas({
  blocks,
  onUpdateBlock,
  onMoveBlock,
}) {
  return (
    <div
      style={{
        padding: 32,
        overflow: "auto",
      }}
    >
      {/* PAGE CANVAS */}
      <div
        style={{
          maxWidth: 1420,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {blocks.map((block, index) => (
          <div
            key={block.id}
            style={{
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 12,
              padding: 24,
              background: "rgba(0,0,0,0.25)",
            }}
          >
            {/* BLOCK CONTENT */}
            <input
              value={block.text}
              onChange={(e) =>
                onUpdateBlock(block.id, { text: e.target.value })
              }
              style={{
                width: "100%",
                fontSize: 28,
                fontWeight: 700,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "white",
              }}
            />

            {/* BLOCK TOOLS */}
            <div
              style={{
                marginTop: 16,
                display: "flex",
                gap: 8,
              }}
            >
              <button onClick={() => onMoveBlock(block.id, -1)}>↑ Move up</button>
              <button onClick={() => onMoveBlock(block.id, 1)}>↓ Move down</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
