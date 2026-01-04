import { sectionStyle, editableStyle } from "./_blockStyles";

export default function HeroBlock({ block, theme, onUpdateProps }) {
  const p = block.props || {};
  const align = p.align || "left";

  return (
    <section style={sectionStyle(block, theme)}>
      <div style={{ maxWidth: 820, margin: align === "center" ? "0 auto" : 0, textAlign: align }}>
        <div
          contentEditable
          suppressContentEditableWarning
          style={{
            ...editableStyle(theme),
            display: "inline-block",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 1,
            color: theme?.accent || "#2297c5",
            background: "rgba(34,151,197,0.12)",
            border: "1px solid rgba(34,151,197,0.22)",
          }}
          onBlur={(e) => onUpdateProps({ eyebrow: e.currentTarget.textContent || "" })}
        >
          {p.eyebrow || ""}
        </div>

        <h1
          contentEditable
          suppressContentEditableWarning
          style={{
            ...editableStyle(theme),
            marginTop: 12,
            fontSize: 40,
            lineHeight: 1.1,
            fontWeight: 950,
          }}
          onBlur={(e) => onUpdateProps({ heading: e.currentTarget.textContent || "" })}
        >
          {p.heading || ""}
        </h1>

        <p
          contentEditable
          suppressContentEditableWarning
          style={{
            ...editableStyle(theme),
            marginTop: 10,
            fontSize: 16,
            lineHeight: 1.6,
            color: theme?.mutedText || "rgba(255,255,255,0.75)",
          }}
          onBlur={(e) => onUpdateProps({ subheading: e.currentTarget.textContent || "" })}
        >
          {p.subheading || ""}
        </p>

        <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: align === "center" ? "center" : "flex-start" }}>
          <a
            href={p.primaryHref || "#"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 14px",
              borderRadius: 12,
              fontWeight: 900,
              textDecoration: "none",
              background: theme?.accent || "#2297c5",
              color: "#06121d",
              border: "1px solid rgba(255,255,255,0.14)",
            }}
            onClick={(e) => e.preventDefault()}
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
        </div>
      </div>
    </section>
  );
}
