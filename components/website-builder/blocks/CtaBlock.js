import { sectionStyle, editableStyle } from "./_blockStyles";

export default function CtaBlock({ block, theme, onUpdateProps }) {
  const p = block.props || {};
  return (
    <section
      style={{
        ...sectionStyle(block, theme),
        background: "rgba(34,151,197,0.10)",
        border: "1px solid rgba(34,151,197,0.18)",
      }}
    >
      <h2
        contentEditable
        suppressContentEditableWarning
        style={{ ...editableStyle(theme), fontSize: 26, fontWeight: 950, margin: 0 }}
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

      <div style={{ height: 14 }} />

      <a
        href={p.primaryHref || "#"}
        onClick={(e) => e.preventDefault()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "12px 14px",
          borderRadius: 12,
          fontWeight: 950,
          textDecoration: "none",
          background: theme?.accent || "#2297c5",
          color: "#06121d",
          border: "1px solid rgba(255,255,255,0.14)",
        }}
      >
        <span
          contentEditable
          suppressContentEditableWarning
          style={{ outline: "none" }}
          onBlur={(e) => onUpdateProps({ primaryText: e.currentTarget.textContent || "" })}
        >
          {p.primaryText || "Button"}
        </span>
      </a>
    </section>
  );
}
