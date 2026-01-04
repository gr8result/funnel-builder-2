// /pages/modules/affiliates/affiliate-marketplace/index.js
// Affiliate Marketplace — unique, relevant icons on all cards

export default function AffiliatesMarketplace() {
  const page = {
    wrap: {
      minHeight: "100vh",
      background: "#0c121a",
      color: "#fff",
      padding: "28px 22px",
      fontFamily:
        "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      display: "flex",
      justifyContent: "center",
    },
    inner: { width: "100%", maxWidth: 1320 },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 18,
    },
    sectionHeader: {
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 800,
      opacity: 0.95,
      margin: "0 0 4px",
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    sectionDesc: {
      fontSize: 18,
      opacity: 0.8,
      margin: 0,
    },
    divider: {
      height: 8,
      border: 0,
      background:"#f59e0b",
      borderRadius: 999,
      opacity: 0.75,
      margin: "18px 0",
    },
    banner: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      background: "#06b6d4",
      padding: "16px 20px",
      borderRadius: 14,
      marginBottom: 26,
    },
    bannerIcon: {
      width: 52,
      height: 52,
      display: "grid",
      placeItems: "center",
      background: "rgba(0,0,0,.25)",
      borderRadius: 12,
      flexShrink: 0,
      fontSize: 26,
      color: "#fff",
    },
    bannerTitle: { fontWeight: 900, fontSize: 28, margin: 0 },
    bannerDesc: { margin: 0, fontSize: 18, opacity: 0.95 },
    subtext: { fontSize: 18, opacity: 0.85, marginTop: 8 },
  };

  const colors = {
    c1: "#22c55e",
    c4: "#ec4899",
    c5: "#0ea5e9",
    c7: "#ef4444",
    c8: "#14b8a6",
    c10: "#f97316",
    c11: "#8b5cf6",
  };

  return (
    <main style={page.wrap}>
      <div style={page.inner}>
        {/* Banner */}
<div style={page.banner}>
  <div style={page.bannerIcon}>
    <Icon name="cart" />
  </div>

  <div style={{ flex: 1 }}>
    <h1 style={page.bannerTitle}>Affiliate Marketplace</h1>
    <p style={page.bannerDesc}>
      Browse offers, track programs, manage payouts and assets.
    </p>
    <p style={page.subtext}>
      Promote products from other creators as an affiliate — or list your
      own for others to promote and earn commissions.
    </p>
  </div>

  {/* BACK BUTTON */}
  <a
    href="/dashboard"
    style={{
      padding: "10px 18px",
      background: "rgba(0,0,0,.22)",
      border: "2px solid rgba(255,255,255,.35)",
      borderRadius: 12,
      color: "#fff",
      fontWeight: 700,
      fontSize: 15,
      textDecoration: "none",
      display: "flex",
      alignItems: "center",
      gap: 8,
      height: "fit-content",
    }}
    onMouseOver={(e) => {
      e.currentTarget.style.background = "rgba(255,255,255,.25)";
    }}
    onMouseOut={(e) => {
      e.currentTarget.style.background = "rgba(0,0,0,.22)";
    }}
  >
    <Icon name="arrowLeft" size={18} /> Back
  </a>
</div>


        {/* Affiliate Section */}
        <section>
          <div style={page.sectionHeader}>
            <h2 style={page.sectionTitle}>
              <Icon name="users" size={48} /> Affiliate
            </h2>
            <p style={page.sectionDesc}>
              Promote and sell other people’s products as an affiliate for them and earn commissions on your sales.
            </p>
          </div>
          <div style={page.grid}>
            <Card
              color={colors.c1}
              icon="search"
              href="/modules/affiliates/affiliate-marketplace/offers"
              title="Browse offers"
              desc="Find programs by category, EPC and commission rate."
            />
            <Card
              color={colors.c5}
              icon="clipboard"
              href="/modules/affiliates/affiliate-marketplace/applications/affiliate-applications"
              title="Applications & Offers"
              desc="Track applications and access approved offers in one place."
            />
            <Card
              color={colors.c4}
              icon="barChart"
              href="/modules/affiliates/affiliate-marketplace/analytics"
              title="Sales & Payouts"
              desc="View revenue, conversions and payout statements."
            />
          </div>
        </section>

        <hr style={page.divider} />

        {/* Vendor Section */}
        <section>
          <div style={page.sectionHeader}>
            <h2 style={page.sectionTitle}>
              <Icon name="briefcase" size={48} /> Vendor
            </h2>
            <p style={page.sectionDesc}>
              Offer your own products for sale and have them promoted and sold by your affiliates.
            </p>
          </div>
          <div style={page.grid}>
            <Card
              color={colors.c7}
              icon="plusSquare"
              href="/modules/affiliates/vendor/manage-products/submit"
              title="Submit a product"
              desc="Create a listing, set commission and assets."
            />
            <Card
              color={colors.c8}
              icon="folder"
              href="/modules/affiliates/affiliate-marketplace/manage-products"
              title="Manage products"
              desc="Approvals, assets, links and deactivation."
            />
            <Card
              color={colors.c10}
              icon="stack"
              href="/modules/affiliates/vendor/manage-products/performance-reports"
              title="Affiliates Performance & Payouts"
              desc="Track vendor sales, commissions, and payouts in real time."
            />
            <Card
              color={colors.c11}
              icon="image"
              href="/modules/affiliates/vendor/manage-products/upload-assets"
              title="Creative assets"
              desc="Banners, emails & swipe assets."
            />
          </div>
        </section>
      </div>
    </main>
  );
}

/* ---------- Card ---------- */
function Card({ href = "#", title, desc, color, icon }) {
  const base = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    textDecoration: "none",
    color: "#fff",
    background: "#0c121a",
    border: `2px solid ${color}`,
    borderRadius: 14,
    padding: "14px 18px",
    minHeight: 100,
    boxShadow: "0 8px 18px rgba(0,0,0,.3)",
    transition: "all .25s ease",
  };

  const iconWrap = {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: color,
    flexShrink: 0,
    fontSize: 20,
  };

  const textWrap = { display: "flex", flexDirection: "column" };

  return (
    <a
      href={href}
      style={base}
      onMouseOver={(e) => {
        e.currentTarget.style.background = color;
        e.currentTarget.style.borderColor = color;
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = "#0c121a";
        e.currentTarget.style.borderColor = color;
      }}
    >
      <div style={iconWrap}>
        <Icon name={icon} bg={color} />
      </div>
      <div style={textWrap}>
        <h3 style={{ fontWeight: 900, fontSize: 18, margin: "0 0 2px" }}>
          {title}
        </h3>
        <p style={{ opacity: 0.9, margin: 0, fontSize: 14 }}>{desc}</p>
      </div>
    </a>
  );
}

/* ---------- Icons + Contrast helper ---------- */
function Icon({ name, size = 24, bg = "#000" }) {
  const stroke = getContrastColor(bg);
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  switch (name) {
    case "cart":
      return (
        <svg {...common}>
          <circle cx="9" cy="21" r="1.5" />
          <circle cx="19" cy="21" r="1.5" />
          <path d="M2 3h3l3 12h11l3-8H6" />
        </svg>
      );
      case "arrowLeft":
      return (
        <svg {...common}>
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      );
      case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="7" r="4" />
          <path d="M17 11a4 4 0 1 0-2 7h5a2 2 0 0 0 2-2v-1a6 6 0 0 0-5-4z" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...common}>
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case "clipboard":
      return (
        <svg {...common}>
          <rect x="8" y="2" width="8" height="4" rx="1" />
          <path d="M4 6h16v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
        </svg>
      );
    case "barChart":
      return (
        <svg {...common}>
          <line x1="4" y1="19" x2="20" y2="19" />
          <rect x="6" y="13" width="2" height="6" />
          <rect x="10" y="9" width="2" height="10" />
          <rect x="14" y="5" width="2" height="14" />
        </svg>
      );
    case "plusSquare":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      );
    case "folder":
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      );
    case "image":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    case "stack":
      return (
        <svg {...common}>
          <polygon points="4 9 12 5 20 9 12 13 4 9" />
          <polygon points="4 13 12 17 20 13" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

function getContrastColor(hex) {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? "#000" : "#fff";
}
