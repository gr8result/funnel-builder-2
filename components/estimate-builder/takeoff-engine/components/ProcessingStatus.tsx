import React from "react";

export default function ProcessingStatus({ status, detail, percent = 0 }: { status: string; detail?: string; percent?: number }) {
  if (!status || status === "ready") return null;
  return (
    <div style={styles.panel} role="status" aria-live="polite">
      <strong>{statusLabel(status)}</strong>
      {detail ? <span>{detail}</span> : null}
      <div style={styles.track}>
        <div style={{ ...styles.fill, width: `${Math.max(8, Math.min(100, percent))}%` }} />
      </div>
    </div>
  );
}

function statusLabel(status: string) {
  if (status === "reading") return "Reading PDF";
  if (status === "orienting") return "Analysing orientation";
  if (status === "extracting") return "Extracting page data";
  if (status === "failed") return "Processing failed";
  return "Processing";
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: "min(420px, calc(100% - 32px))",
    display: "grid",
    gap: 8,
    padding: 14,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#ffffff",
    color: "#0f172a",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)",
    zIndex: 40,
    fontSize: 13,
  },
  track: {
    height: 8,
    background: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    background: "#0f766e",
    transition: "width 160ms ease",
  },
};
