import { sectionStyle } from "./_blockStyles";

export default function FooterBlock({ block, theme, onUpdateProps }) {
  const p = block.props || {};
  return (
    <footer style={sectionStyle(block, theme)}>
      <div
        contentEditable
        suppressContentEditableWarning
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: 12,
          fontWeight: 800,
          outline: "none",
          borderRadius: 10,
          padding: "6px 8px",
          border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.03)",
          display: "inline-block",
        }}
        onBlur={(e) => onUpdateProps({ smallText: e.currentTarget.textContent || "" })}
      >
        {p.smallText || ""}
      </div>
    </footer>
  );
}
