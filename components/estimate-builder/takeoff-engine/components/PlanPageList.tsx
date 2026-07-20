import React from "react";
import type { TakeoffPage } from "../state/takeoffTypes";

export default function PlanPageList({
  pages,
  activePageId,
  onSelectPage,
}: {
  pages: TakeoffPage[];
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
}) {
  return (
    <aside style={styles.sidebar}>
      <div style={styles.title}>Plans</div>
      {pages.length ? pages.map((page) => (
        <button
          key={page.id}
          type="button"
          style={page.id === activePageId ? styles.activeCard : styles.card}
          onClick={() => onSelectPage(page.id)}
        >
          {page.thumbnailDataUrl ? <img src={page.thumbnailDataUrl} alt="" style={styles.thumbnail} draggable={false} /> : <span style={styles.blankThumb} />}
          <strong style={styles.name}>{page.sourceFileName || `Page ${page.pageNumber}`}</strong>
          <span style={styles.meta}>Page {page.pageNumber} | {Math.round(page.renderedWidth)} x {Math.round(page.renderedHeight)}</span>
          <span style={styles.meta}>Rotation {page.finalRotation} | {page.orientationMode}</span>
        </button>
      )) : <div style={styles.empty}>No PDF loaded</div>}
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    minWidth: 250,
    width: 250,
    borderRight: "1px solid #d7dee8",
    background: "#ffffff",
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    overflow: "auto",
  },
  title: {
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  card: {
    display: "grid",
    gap: 5,
    border: "1px solid #dbe4ef",
    borderRadius: 6,
    background: "#ffffff",
    padding: 8,
    textAlign: "left",
    cursor: "pointer",
  },
  activeCard: {
    display: "grid",
    gap: 5,
    border: "1px solid #0f766e",
    borderRadius: 6,
    background: "#ecfdf5",
    padding: 8,
    textAlign: "left",
    cursor: "pointer",
  },
  thumbnail: {
    width: "100%",
    aspectRatio: "4 / 3",
    objectFit: "contain",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 4,
  },
  blankThumb: {
    width: "100%",
    aspectRatio: "4 / 3",
    background: "#f1f5f9",
    border: "1px dashed #cbd5e1",
    borderRadius: 4,
  },
  name: {
    color: "#0f172a",
    fontSize: 12,
  },
  meta: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
  },
  empty: {
    border: "1px dashed #cbd5e1",
    borderRadius: 6,
    padding: 12,
    color: "#64748b",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 800,
  },
};
