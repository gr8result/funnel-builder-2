// /components/Layout.js
import { ensureUserFolders } from "../utils/storage-init";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import SideNav from "./SideNav";
import ICONS from "./iconMap";
import { supabase } from "../utils/supabase-client";
import UsageWarning from "./UsageWarning";

const NAV_WIDTH = 300;
const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/modules",
  "/assets",
  "/leads",
  "/store",
  "/funnels",
];

// Routes that approved vendors / affiliates (without a full platform subscription) are allowed to access
const VENDOR_ONLY_ROUTE_PREFIXES = ["/modules/vendor", "/modules/affiliates"];

function getMarketplaceAccessEndpoint(pathname) {
  if (pathname.startsWith("/modules/affiliates")) return "/api/marketplace/affiliate-access";
  if (pathname.startsWith("/modules/vendor")) return "/api/marketplace/vendor-access";
  return null;
}

function isMainPlatformVerified(account) {
  if (!account) return false;
  const approved = account.is_approved === true || account.approved === true;
  const statusOk =
    account.status === "approved" ||
    account.status === "active" ||
    account.status == null;
  // Approved users are verified regardless of subscription_status
  return approved && statusOk;
}

function isApprovedVendor(account) {
  if (!account) return false;
  return account.is_approved === true || account.approved === true;
}

export default function Layout({ children }) {
  const router = useRouter();
  const path = router.pathname;

  const isAdminRoute = path.startsWith("/admin") || path.startsWith("/dev");
  const isProtectedPlatformRoute = PROTECTED_ROUTE_PREFIXES.some((prefix) =>
    path.startsWith(prefix)
  );
  const isVendorOnlyRoute = VENDOR_ONLY_ROUTE_PREFIXES.some((prefix) =>
    path.startsWith(prefix)
  );
  const marketplaceAccessEndpoint = getMarketplaceAccessEndpoint(path);
  const noNavRoutes = ["/login", "/signup", "/pending-approval"];
  const showNavDefault = !noNavRoutes.includes(path);

  const [account, setAccount] = useState(null);
  const [header, setHeader] = useState({
    nameLine1: "",
    nameLine2: "",
    logo: ""
  });
  const [avatar, setAvatar] = useState("");
  const [marketplaceVendorAllowed, setMarketplaceVendorAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        let localMarketplaceAllowed = false;

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) {
          if (isVendorOnlyRoute && !isAdminRoute) {
            try {
              const code =
                typeof window !== "undefined"
                  ? localStorage.getItem("xchange_user_code")
                  : null;

              if (code) {
                const resp = await fetch(
                  `${marketplaceAccessEndpoint}?code=${encodeURIComponent(code)}`
                );
                const payload = await resp.json();

                if (resp.ok && payload?.allowed) {
                  setMarketplaceVendorAllowed(true);
                  setHeader({
                    nameLine1: "GR8 RESULT",
                    nameLine2: "Digital Solutions",
                    logo: "",
                  });
                  setAvatar("");
                  setLoading(false);
                  return;
                }
              }
            } catch (vendorCheckError) {
              console.error("Vendor access fallback failed:", vendorCheckError);
            }

            router.replace("/marketplace");
            setLoading(false);
            return;
          }

          if (isProtectedPlatformRoute && !isAdminRoute) {
            router.replace("/login");
          }

          setHeader({
            nameLine1: "GR8 RESULT",
            nameLine2: "Digital Solutions",
            logo: "",
          });
          setAvatar("");
          setLoading(false);
          return;
        }

        console.log("[Layout.js] Logged in user:", user);

        await ensureUserFolders();

        const adminEmails = [
          "admin@gr8result.com",
          "developer@gr8result.com",
          "grant@gr8result.com",
        ];

        // 🧱 Admin branding
        if (isAdminRoute || adminEmails.includes(user.email)) {
          setHeader({
            nameLine1: "GR8 RESULT",
            nameLine2: "Digital Solutions",
            logo: "",
          });
          setAvatar("");
          setLoading(false);
          return;
        }

        // 🧾 Load user data from Supabase
        const { data, error } = await supabase
          .from("accounts")
          .select(
            "business_name, business_logo, business_avatar, approved, is_approved, status, subscription_status"
          )
          .eq("user_id", user.id)
          .single();

        if (error) console.error(error);
        setAccount(data);

        console.log("[Layout.js] Loaded account row:", data);

        const verifiedPlatformUser = isMainPlatformVerified(data);
        setMarketplaceVendorAllowed(false);

        if (!verifiedPlatformUser && isVendorOnlyRoute && !isAdminRoute) {
          try {
            const code =
              typeof window !== "undefined"
                ? localStorage.getItem("xchange_user_code")
                : null;

            if (code && marketplaceAccessEndpoint) {
              const resp = await fetch(
                `${marketplaceAccessEndpoint}?code=${encodeURIComponent(code)}`
              );
              const payload = await resp.json();

              if (resp.ok && payload?.allowed) {
                setMarketplaceVendorAllowed(true);
                localMarketplaceAllowed = true;
              }
            }
          } catch (marketplaceAccessError) {
            console.error("Marketplace access fallback failed:", marketplaceAccessError);
          }
        }

        // 🏢 Update user-specific logo + name only for verified platform users
        if (data?.business_name && verifiedPlatformUser) {
          // Robust logo logic: parse JSON, clean path, always get public URL
          let logoUrl = "";
          if (data.business_logo && data.business_logo.trim() !== "") {
            let logoPath = data.business_logo.trim();
            // If stored as JSON string { url: "..." }
            if (logoPath.startsWith("{")) {
              try {
                const parsed = JSON.parse(logoPath);
                if (parsed?.url) logoPath = parsed.url;
              } catch {}
            }
            // If it's a full URL, use as is
            if (/^https?:\/\//i.test(logoPath)) {
              logoUrl = logoPath;
            } else {
              // Clean path: remove bucket and domain if present
              const cleanPath = String(logoPath)
                .replace(/^https:\/\/[^/]+\/storage\/v1\/object\/public\//, "")
                .replace(/^public-assets\//i, "")
                .replace(/^\/+/, "");
              const { data: pub } = supabase.storage.from("public-assets").getPublicUrl(cleanPath);
              logoUrl = pub?.publicUrl || "";
            }
          }
          setHeader({
            nameLine1: data.business_name,
            nameLine2: "",
            logo: logoUrl,
          });
        } else {
          setHeader({
            nameLine1: "GR8 RESULT",
            nameLine2: "Digital Solutions",
            logo: "",
          });
        }

        // 👤 Avatar logic — prefers avatar, falls back to logo, then default
        let finalAvatar = data?.business_avatar && data.business_avatar.trim() !== ""
          ? (() => {
              let avatarPath = data.business_avatar.trim();
              // If stored as JSON string { url: "..." }
              if (avatarPath.startsWith("{")) {
                try {
                  const parsed = JSON.parse(avatarPath);
                  if (parsed?.url) avatarPath = parsed.url;
                } catch {}
              }
              if (/^https?:\/\//i.test(avatarPath)) {
                return avatarPath;
              } else {
                // Clean path: remove bucket and domain if present
                const cleanPath = String(avatarPath)
                  .replace(/^https:\/\/[^/]+\/storage\/v1\/object\/public\//, "")
                  .replace(/^public-assets\//i, "")
                  .replace(/^\/+/, "");
                const { data: pub } = supabase.storage.from("public-assets").getPublicUrl(cleanPath);
                return pub?.publicUrl || "";
              }
            })()
          : "";
        setAvatar(verifiedPlatformUser ? finalAvatar : "");

        const vendorAllowed = isVendorOnlyRoute && localMarketplaceAllowed;
        if (!verifiedPlatformUser && !vendorAllowed && isProtectedPlatformRoute && !isAdminRoute) {
          // User is logged in but not fully set up — route them appropriately, never to marketplace
          const approved = data?.is_approved === true || data?.approved === true;
          if (!approved || data?.status === "pending") {
            router.replace("/account");
          } else {
            router.replace("/billing");
          }
        }
      } catch (err) {
        console.error("❌ Layout load error:", err);
      } finally {
        setLoading(false);
      }
    })();
}, [isAdminRoute, isProtectedPlatformRoute, isVendorOnlyRoute, marketplaceAccessEndpoint, path, router]);

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#0b1220",
          color: "#e5e7eb",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div>Loading...</div>
      </main>
    );
  }
  const isVerifiedPlatformUser = isMainPlatformVerified(account);
  const vendorRouteAllowed =
    isVendorOnlyRoute &&
    marketplaceVendorAllowed;

  if (!loading && isProtectedPlatformRoute && !isAdminRoute && !isVerifiedPlatformUser && !vendorRouteAllowed) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#0b1220",
          color: "#e5e7eb",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div>Redirecting...</div>
      </main>
    );
  }

  // Hide nav and business branding if user is not verified for the main platform
  const showNav = showNavDefault && isVerifiedPlatformUser;
  // Use single-column layout if nav is hidden
  const layoutStyle = showNav
    ? wrap
    : { ...wrap, gridTemplateColumns: "1fr" };
  const sectionStyle = showNav
    ? rightCol
    : { ...rightCol, gridTemplateRows: "1fr", minWidth: 0 };

  return (
    <div style={layoutStyle}>
      {showNav && (
        <aside style={leftCol}>
          <SideNav />
        </aside>
      )}

      <section style={sectionStyle}>
        {/* Only show branding header and avatar for verified platform users */}
        {isVerifiedPlatformUser && (
          <header style={topbar}>
            <div style={brandBox}>
              <div style={logoWrap}>
                {header.logo ? (
                  <img
                    src={header.logo}
                    alt="Business Logo"
                    style={brandLogo}
                  />
                ) : (
                  <div style={{width:180,height:76,display:'flex',alignItems:'center',justifyContent:'center',color:'#888',fontWeight:600,fontSize:22}}>No Logo</div>
                )}
              </div>
              <span style={brandName}>
                {header.nameLine1}
                {header.nameLine2 && (
                  <>
                    <br />
                    {header.nameLine2}
                  </>
                )}
              </span>
            </div>
            {/* ✅ Usage stats */}
            <UsageWarning />
            {/* ✅ Avatar Circle */}
            <ProfileMenu avatar={avatar} />
          </header>
        )}
        <main style={main}>{children}</main>
      </section>
    </div>
  );
}

// ===================
// Profile Menu
// ===================
function ProfileMenu({ avatar }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const avatarSrc =
    avatar && typeof avatar === "string" && avatar.trim() !== ""
      ? avatar
      : undefined;

  return (
    <div style={pmWrap}>
      <button type="button" style={pmButton} onClick={() => setOpen(!open)}>
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt="Profile Avatar"
            style={pmAvatarImg}
          />
        ) : (
          <div style={{width:90,height:90,display:'flex',alignItems:'center',justifyContent:'center',color:'#888',fontWeight:600,fontSize:22,borderRadius:'50%',background:'#222'}}>No Avatar</div>
        )}
      </button>

      {open && (
        <div style={pmMenu}>
          <a href="/account" style={pmItem}>
            <span style={pmIcon}>{ICONS.account}</span> Account
          </a>
          <a href="/billing" style={pmItem}>
            <span style={pmIcon}>{ICONS.billing}</span> Billing
          </a>
          <button
            onClick={handleLogout}
            style={{ ...pmItem, color: "#ffb3b3" }}
          >
            <span style={pmIcon}>{ICONS.signout}</span> Log out
          </button>
        </div>
      )}
    </div>
  );
}

/* --- Styles --- */
const wrap = {
  display: "grid",
  gridTemplateColumns: `${NAV_WIDTH}px 1fr`,
  minHeight: "100vh",
  background: "#0b1220",
  color: "#e5e7eb",
};

const leftCol = {
  position: "sticky",
  top: 0,
  alignSelf: "start",
  height: "100vh",
  borderRight: "1px solid rgba(255,255,255,.12)",
  background: "#0f1726",
  overflowY: "auto",
};

const rightCol = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  minHeight: "100vh",
};

const topbar = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 30px",
  borderBottom: "1px solid rgba(255,255,255,.1)",
  background: "linear-gradient(180deg, #0f1726, #0d1422)",
  height: 100,
};

const brandBox = {
  display: "flex",
  alignItems: "center",
  gap: 18,
  color: "#fff",
  fontWeight: 600,
  fontSize: 38,
};

const logoWrap = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#0f1726",
  borderRadius: 12,
  overflow: "hidden",
  width: 180,
  height: 76,
  border: "2px solid rgba(255,255,255,.2)",
};

const brandLogo = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  background: "#0f1726",
};

const brandName = {
  maxWidth: 400,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 2.0 + 'rem', // Make brand name text bigger
  fontWeight: 600,
};

const pmWrap = { position: "relative" };
const pmButton = {
  width: 90,
  height: 90,
  borderRadius: "50%",
  overflow: "hidden",
  background: "#0e1a2b",
  border: "3px solid rgba(255,255,255,.3)",
  cursor: "pointer",
};
const pmAvatarImg = { width: "100%", height: "100%", objectFit: "cover" };

const pmMenu = {
  position: "absolute",
  right: 0,
  top: 100,
  width: 220,
  background: "#0f1726",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 12,
  boxShadow: "0 12px 28px rgba(0,0,0,.45)",
  padding: 8,
  zIndex: 100,
};
const pmItem = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px",
  borderRadius: 8,
  color: "#fff",
  fontSize: 34,
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
  background: "none",
  border: "none",
  width: "100%",
  textAlign: "left",
};
const pmIcon = { width: 20, display: "inline-block", textAlign: "center" };
const main = {
  padding: 20,
  minWidth: 0,
  flex: 1,
};
