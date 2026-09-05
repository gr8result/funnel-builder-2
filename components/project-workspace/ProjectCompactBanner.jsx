export default function ProjectCompactBanner({
  moduleTitle = "",
  moduleIcon = null,
  jobName = "",
  jobAddress = "",
  hasActiveJob,
  projectName = "",
  projectAddress = "",
  accent = "linear-gradient(135deg, #f97316 0%, #f59e0b 100%)",
  icon = null,
  actions = null,
  emptyMessage = "No job open",
  style = {},
  nameStyle = {},
  titleStyle = {},
  secondaryStyle = {},
  className = "",
}) {
  const title = String(moduleTitle || "").trim();
  const legacyName = String(projectName || "").trim();
  const displayTitle = title || legacyName || emptyMessage;
  const identityName = String(jobName || (title ? projectName : "") || "").trim();
  const identityAddress = String(jobAddress || (title ? projectAddress : "") || "").trim();
  const active = typeof hasActiveJob === "boolean" ? hasActiveJob : Boolean(identityName || identityAddress);
  const secondary = active
    ? [identityName, identityAddress].filter(Boolean).join(" · ")
    : emptyMessage;
  const displayIcon = moduleIcon || icon;

  return (
    <section className={className} style={{ ...S.banner, background: accent, ...style }} data-testid="builder-module-banner">
      <div style={{ ...S.strip, gridTemplateColumns: displayIcon ? "minmax(220px, 1fr) auto" : "minmax(220px, 1fr) auto" }}>
        <div style={S.identity}>
          <div style={S.titleRow}>
            {displayIcon ? <span style={S.icon} data-testid="builder-module-banner-icon">{displayIcon}</span> : null}
            <strong style={{ ...S.name, ...nameStyle, ...titleStyle }} data-testid="builder-module-banner-title">{displayTitle}</strong>
          </div>
          <span style={{ ...S.address, ...secondaryStyle }} data-testid="builder-module-banner-job">{secondary}</span>
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
    padding: "18px 22px",
    marginBottom: 16,
    display: "block",
    boxShadow: "0 16px 38px rgba(15, 23, 42, 0.16)",
    color: "#ffffff",
  },
  strip: { minWidth: 0, display: "grid", alignItems: "center", gap: "12px 18px" },
  titleRow: { minWidth: 0, display: "flex", alignItems: "center", gap: 12 },
  icon: { width: 54, height: 54, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#ffffff", flex: "0 0 auto" },
  identity: { minWidth: 0, display: "grid", gap: 7 },
  name: { color: "#ffffff", fontSize: "clamp(36px, 3.1vw, 48px)", lineHeight: 1.06, fontWeight: 600, overflowWrap: "anywhere" },
  address: { color: "rgba(255,255,255,0.9)", fontSize: 15, lineHeight: 1.35, fontWeight: 750, overflowWrap: "anywhere" },
  actions: { minWidth: 0, display: "flex", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: 8 },
};
