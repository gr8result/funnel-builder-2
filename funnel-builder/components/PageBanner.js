// components/PageBanner.js
// Full file - shows a coloured banner at top of each page

export default function PageBanner({ title, color }) {
  return (
    <div style={{ ...banner, background: color }}>
      <h1 style={bannerTitle}>{title}</h1>
    </div>
  );
}

const banner = {
  height: "120px", // ~30mm on most displays
  display: "flex",
  alignItems: "center",
  paddingLeft: "24px",
  borderBottom: "2px solid rgba(0,0,0,.2)",
};

const bannerTitle = {
  fontSize: "28px",
  fontWeight: "900",
  letterSpacing: ".2px",
  color: "#fff",
  margin: 0,
};




