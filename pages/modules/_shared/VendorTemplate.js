import Link from "next/link";

export default function VendorTemplate({
  title,
  subtitle,
  bannerColor,
  icon,
  backHref,
  dashboardHref,
  items,
  children,
}) {
  return (
    <div style={{ padding: "40px 20px", maxWidth: 1320, margin: "0 auto" }}>
      <div
        style={{
          background: bannerColor,
          padding: 24,
          borderRadius: 12,
          marginBottom: 30,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {icon}
          <div>
            <h1 style={{ margin: 0 }}>{title}</h1>
            <p style={{ marginTop: 6 }}>{subtitle}</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 20 }}>
          {backHref && (
            <Link href={backHref} style={{ color: "#fff" }}>
              ← Marketplace
            </Link>
          )}
          {dashboardHref && (
            <Link href={dashboardHref} style={{ color: "#fff" }}>
              → Dashboard
            </Link>
          )}
        </div>
      </div>

      {/* THIS IS WHAT WAS MISSING */}
      {children}
    </div>
  );
}
