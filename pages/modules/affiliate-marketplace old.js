// /pages/modules/affiliates/affiliate-marketplace.js
// Affiliates Marketplace Dashboard with banner + left icons on all cards

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
    sectionTitle: {
      fontSize: 16,
      fontWeight: 800,
      opacity: 0.92,
      margin: "0 0 12px",
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    divider: {
      height: 8,
      border: 0,
      background: "#2a394c",
      borderRadius: 999,
      opacity: 0.75,
      margin: "18px 0",
    },
    banner: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      background: "#06b6d4", // SideNav cyan
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
    bannerTitle: {
      fontWeight: 900,
      fontSize: 28,
      margin: 0,
    },
    bannerDesc: {
      margin: 0,
      fontSize: 15,
      opacity: 0.95,
    },
  };

  const colors = {
    c1: "#22c55e", // green
    c2: "#3b82f6", // blue
    c3: "#f59e0b", // orange
    c4: "#a855f7", // purple
    c5: "#ec4899", // pink
    c6: "#06b6d4", // cyan
    c7: "#ef4444", // red
    c8: "#14b8a6", // teal
    c9: "#eab308", // yellow
    c10: "#6366f1", // indigo
    c11: "#8b5cf6", // violet
    c12: "#f43f5e", // rose
  };

  return (
    <main style={page.wrap}>
      <div style={page.inner}>
        {/* Banner */}
        <div style={page.banner}>
          <div style={page.bannerIcon}>
            <Icon name="cart" />
          </div>
          <div>
            <h1 style={page.bannerTitle}>Affiliate Marketplace</h1>
            <p style={page.bannerDesc}>
              Browse offers, track programs, manage payouts and assets.
            </p>
          </div>
        </div>

        {/* Affiliate Section */}
        <section>
          <h2 style={page.sectionTitle}>
            <Icon name="users" size={18} /> Affiliate
          </h2>
          <div style={page.grid}>
            <Card color={colors.c1} icon="list" href="/affiliates/affiliate-marketplace/index" title="Browse offers" desc="Find programs by category, EPC and commission rate." />
            <Card color={colors.c2} icon="badge" href="/affiliates/applications" title="My applications" desc="Track pending and declined applications." />
            <Card color={colors.c3} icon="check" href="/affiliates/approved" title="Approved offers" desc="Get your unique links and assets." />
            <Card color={colors.c4} icon="wallet" href="/affiliates/payouts" title="Payouts" desc="Add payout details, view statements." />
            <Card color={colors.c5} icon="chart" href="/affiliates/reports" title="Reports" desc="Clicks, conversions, EPC and revenue." />
            <Card color={colors.c6} icon="sliders" href="/affiliates/settings" title="Settings" desc="Profile, tracking and notifications." />
          </div>
        </section>

        <hr style={page.divider} />

        {/* Merchant Section */}
        <section>
          <h2 style={page.sectionTitle}>
            <Icon name="briefcase" size={18} /> Merchant
          </h2>
          <div style={page.grid}>
            <Card color={colors.c7} icon="plusSquare" href="/merchant/submit" title="Submit a product" desc="Create a listing, set commission and assets." />
            <Card color={colors.c8} icon="grid" href="/merchant/manage" title="Manage products" desc="Approvals, assets, links and deactivation." />
            <Card color={colors.c9} icon="barsUp" href="/merchant/analytics" title="Sales & analytics" desc="Revenue, conversion and top affiliates." />
            <Card color={colors.c10} icon="coins" href="/merchant/commissions" title="Commissions & payouts" desc="Holdback, schedules and statements." />
            <Card color={colors.c11} icon="image" href="/merchant/assets" title="Creative assets" desc="Banners, copy, email swipes and links." />
            <Card color={colors.c12} icon="tune" href="/merchant/program" title="Program settings" desc="Terms, geos, tracking and approvals." />
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
  const titleStyle = { fontWeight: 900, fontSize: 18, margin: "0 0 2px" };
  const descStyle = { opacity: 0.9, margin: 0, fontSize: 14 };

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
        <h3 style={titleStyle}>{title}</h3>
        <p style={descStyle}>{desc}</p>
      </div>
    </a>
  );
}

/* ---------- Inline Icon Set (auto contrast) ---------- */
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
    case "affiliates":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h8M12 8v8" />
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
    case "list":
      return (
        <svg {...common}>
          <path d="M8 6h12M8 12h12M8 18h12" />
          <circle cx="4" cy="6" r="1.5" />
          <circle cx="4" cy="12" r="1.5" />
          <circle cx="4" cy="18" r="1.5" />
        </svg>
      );
    case "badge":
      return (
        <svg {...common}>
          <path d="M12 3l2.1 2.1L17 5.3l-.3 2.9 1.6 2.3-2.5 1.6-.8 2.8-2.8-.8L9.7 15l-2.5-1.6L8.8 11 8.5 8.1 10.9 7 12 3z" />
          <path d="M9.5 12l1.8 1.8L15 10" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12.5l2.5 2.5L16 10" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="12" rx="2" />
          <path d="M16 11h3v4h-3a2 2 0 0 1 0-4z" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M4 20V10" />
          <path d="M10 20V4" />
          <path d="M16 20v-7" />
          <path d="M3 20h18" />
        </svg>
      );
    case "sliders":
      return (
        <svg {...common}>
          <path d="M4 21v-7" />
          <path d="M4 10V3" />
          <path d="M12 21v-9" />
          <path d="M12 8V3" />
          <path d="M20 21v-5" />
          <path d="M20 12V3" />
          <circle cx="4" cy="12" r="2" />
          <circle cx="12" cy="5" r="2" />
          <circle cx="20" cy="14" r="2" />
        </svg>
      );
    case "plusSquare":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    case "grid":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "barsUp":
      return (
        <svg {...common}>
          <path d="M3 20h18" />
          <path d="M7 16v-4" />
          <path d="M12 16V8" />
          <path d="M17 16v-6" />
          <path d="M9 7l2-2 2 2" />
        </svg>
      );
    case "coins":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="6" rx="6" ry="3" />
          <path d="M6 6v6c0 1.7 2.7 3 6 3s6-1.3 6-3V6" />
          <path d="M6 12c0 1.7 2.7 3 6 3s6-1.3 6-3" />
        </svg>
      );
    case "image":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="M21 16l-5-5-4 4-2-2-4 4" />
        </svg>
      );
    case "tune":
      return (
        <svg {...common}>
          <path d="M4 6h16" />
          <path d="M10 6v12" />
          <path d="M4 12h16" />
          <path d="M14 12v6" />
          <path d="M4 18h16" />
          <path d="M8 18v-6" />
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

/* ---------- Contrast helper ---------- */
function getContrastColor(hex) {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? "#000" : "#fff";
}
