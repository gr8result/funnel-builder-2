import { useState } from "react";
import BuilderCanvas from "./BuilderCanvas";

export default function WebsiteBuilderApp() {
  const [blocks, setBlocks] = useState([
    {
      id: "blk-1",
      text: "This is your hero headline — click to edit",
    },
  ]);

  function updateBlock(id, patch) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b))
    );
  }

  function moveBlock(id, dir) {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;

      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  return (
    <BuilderCanvas
      blocks={blocks}
      onUpdateBlock={updateBlock}
      onMoveBlock={moveBlock}
    />
  );
}
