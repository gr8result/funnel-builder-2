// pages/modules/physical-products.js
import Link from "next/link";
import ICONS from "../../components/iconMap";

export default function PhysicalProductsHome() {
  return (
    <div style={page.wrap}>
      <div style={page.inner}>
        {/* Banner */}
        <div style={page.banner}>
          <div style={page.bannerLeft}>
            <div style={page.bannerIconBox}>
              <ICONS.products size={28} />
            </div>
            <div>
              <h1 style={page.bannerTitle}>Physical products</h1>
              <p style={page.bannerDesc}>
                Products, inventory, orders &amp; shipping — your physical store
                hub.
              </p>
            </div>
          </div>

          <Link href="/dashboard">
            <button style={page.backBtn}>← Back</button>
          </Link>
        </div>

        {/* Coming soon card */}
        <div style={page.card}>
          <h2 style={page.cardTitle}>Coming soon</h2>
          <p style={page.cardText}>
            This module will connect your products, stock levels, orders and
            shipping into a single dashboard, so you can manage everything
            without leaving GR8 RESULT.
          </p>

          <ul style={page.list}>
            <li>Product catalogue with variants and images.</li>
            <li>Inventory tracking and low-stock alerts.</li>
            <li>Orders, fulfilment status and shipping details.</li>
            <li>Direct hooks into funnels, email campaigns and automations.</li>
          </ul>

          <p style={page.cardText}>
            For now, you can keep using your existing store setup. When this
            area goes live we’ll migrate products across for you.
          </p>
        </div>
      </div>
    </div>
  );
}

const page = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    color: "#fff",
    padding: "28px 22px",
    display: "flex",
    justifyContent: "center",
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
  inner: {
    width: "100%",
    maxWidth: 1320,
  },
  banner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#0ea5e9", // matches Physical products colour
    padding: "14px 18px",
    borderRadius: 12,
    marginBottom: 24,
    fontWeight: 700,
  },
  bannerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  bannerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: "rgba(0,0,0,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bannerTitle: {
    margin: 0,
    fontSize: 22,
  },
  bannerDesc: {
    margin: 0,
    marginTop: 2,
    fontSize: 14,
    fontWeight: 400,
    opacity: 0.95,
  },
  backBtn: {
    background: "#0c121a",
    color: "#fff",
    border: "2px solid rgba(255,255,255,0.25)",
    borderRadius: 8,
    padding: "8px 16px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  card: {
    background: "#111827",
    borderRadius: 12,
    border: "1px solid #0ea5e9",
    padding: 20,
    lineHeight: 1.7,
  },
  cardTitle: {
    margin: "0 0 10px",
    fontSize: 18,
  },
  cardText: {
    margin: "0 0 10px",
    fontSize: 14,
    opacity: 0.95,
  },
  list: {
    margin: "0 0 12px 18px",
    padding: 0,
    fontSize: 14,
  },
};
