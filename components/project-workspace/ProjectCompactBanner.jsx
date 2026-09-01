export default function ProjectCompactBanner({
  projectName = "",
  projectAddress = "",
  accent = "linear-gradient(135deg, #f97316 0%, #f59e0b 100%)",
  actions = null,
  emptyMessage = "No job is currently open.",
  style = {},
  className = "",
}) {
  const name = String(projectName || "").trim() || "No job open";
  const address = String(projectAddress || "").trim();
  const hasJob = Boolean(String(projectName || "").trim() || address);
  return (
    <section className={className} style={{ ...S.banner, background: accent, ...style }} data-testid="project-compact-banner">
      <div style={S.strip}>
        <div style={S.identity}>
          <strong style={S.name}>{hasJob ? name : emptyMessage}</strong>
          {hasJob && address ? <span style={S.address}>{address}</span> : null}
        </div>
        {actions ? <div style={S.actions}>{actions}</div> : null}
      </div>
    </section>
  );
}

const S = {
  banner: {
    position: "relative",
    zIndex: 1,
    border: "1px solid rgba(255,255,255,0.38)",
    borderRadius: 14,
    padding: "13px 18px",
    marginBottom: 16,
    display: "block",
    boxShadow: "0 16px 38px rgba(15, 23, 42, 0.16)",
    color: "#ffffff",
  },
  strip: { minWidth: 0, display: "grid", gridTemplateColumns: "minmax(220px, 1fr) auto", alignItems: "center", gap: "10px 18px" },
  identity: { minWidth: 0, display: "grid", gap: 4 },
  name: { color: "#ffffff", fontSize: 24, lineHeight: 1.16, fontWeight: 950, overflowWrap: "anywhere" },
  address: { color: "rgba(255,255,255,0.9)", fontSize: 15, lineHeight: 1.35, fontWeight: 750, overflowWrap: "anywhere" },
  actions: { minWidth: 0, display: "flex", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: 8 },
};
