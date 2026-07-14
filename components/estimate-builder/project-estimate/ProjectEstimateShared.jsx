import { projectEstimateStyles as styles } from "./luxuryProjectEstimateStyles";

export function luxuryBackground(imageUrl, opacity = 0.6) {
  const fallback = "linear-gradient(135deg, #07111f 0%, #12243a 55%, #3f321c 100%)";
  if (!imageUrl) return fallback;
  return `linear-gradient(rgba(7,17,31,${opacity}), rgba(7,17,31,${opacity})), url(${imageUrl})`;
}

export function LuxuryLogo({ logo, builderName, light = false }) {
  return (
    <div style={styles.luxuryLogoLockup}>
      {logo ? <img src={logo} alt={builderName} style={styles.luxuryLogoImage} /> : <div style={styles.luxuryLogoMark}>GR8</div>}
      <strong style={{ color: light ? "#fff" : "#0f172a" }}>{builderName}</strong>
    </div>
  );
}

export function LuxuryMasterPageHeader({ logo, builderName, title, accent, light = false }) {
  return (
    <header style={styles.luxuryPageHeader}>
      <LuxuryLogo logo={logo} builderName={builderName} light={light} />
      <div style={{ ...styles.luxuryHeaderTitle, color: light ? "#fff" : "#0f172a" }}>
        <span style={{ color: accent }}>{title}</span>
      </div>
    </header>
  );
}

export function LuxuryInfoCard({ item, accent, compact = false }) {
  return (
    <div style={{ ...styles.luxuryInfoCard, ...(compact ? styles.luxuryEstimateSummaryInfoCard : {}) }}>
      <span style={{ ...styles.luxuryInfoIcon, color: accent }}>{item.icon}</span>
      <small>{item.label}</small>
      <strong>{item.value}</strong>
      {item.detail ? <span style={styles.luxuryInfoDetail}>{item.detail}</span> : null}
    </div>
  );
}

export function LuxuryImageFrame({ src, label, wide = false, tall = false, deep = false }) {
  return src ? (
    <img src={src} alt={label} style={{ ...styles.luxuryImageFrame, ...(wide ? styles.luxuryImageFrameWide : {}), ...(tall ? styles.luxuryImageFrameTall : {}), ...(deep ? styles.luxuryImageFrameDeep : {}) }} />
  ) : (
    <div style={{ ...styles.luxuryImagePlaceholder, ...(wide ? styles.luxuryImageFrameWide : {}), ...(tall ? styles.luxuryImageFrameTall : {}), ...(deep ? styles.luxuryImageFrameDeep : {}) }}>{label}</div>
  );
}

export { styles };
