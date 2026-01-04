import { sectionStyle, editableStyle } from "./_blockStyles";

export default function TextBlock({ block, theme, onUpdateProps }) {
  const p = block.props || {};
  return (
    <section style={sectionStyle(block, theme)}>
      <h2
        contentEditable
        suppressContentEditableWarning
        style={{
          ...editableStyle(theme),
          fontSize: 26,
          fontWeight: 950,
          margin: 0,
        }}
        onBlur={(e) => onUpdateProps({ heading: e.currentTarget.textContent || "" })}
      >
        {p.heading || ""}
      </h2>

      <div style={{ height: 10 }} />

      <p
        contentEditable
        suppressContentEditableWarning
        style={{
          ...editableStyle(theme),
          margin: 0,
          fontSize: 15,
          lineHeight: 1.7,
          color: theme?.mutedText || "rgba(255,255,255,0.75)",
        }}
        onBlur={(e) => onUpdateProps({ body: e.currentTarget.textContent || "" })}
      >
        {p.body || ""}
      </p>
    </section>
  );
}
