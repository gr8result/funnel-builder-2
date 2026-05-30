// /components/Layout.js
import { ensureUserFolders } from "../utils/storage-init";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { isDeveloperEmail } from "../lib/adminUsers";
import SideNav from "./SideNav";
import ICONS from "./iconMap";
import { supabase } from "../utils/supabase-client";
import UsageWarning from "./UsageWarning";

const DEFAULT_BRAND_NAME = "Gr8 Result Digital Solutions";
const DEFAULT_BRAND_LOGO = "/logo/gr8result-logo.png";

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

function isInternalGr8ResultAccount(account) {
  const businessName = String(account?.business_name || '').trim().toLowerCase();
  return businessName === 'gr8 result' || businessName === 'gr8 result digital solutions';
}

async function buildBrandingState(account) {
  const businessName = String(account?.business_name || "").trim();
  const resolvedLogo = await resolveBrandingAssetUrl(account?.business_logo || account?.business_logo_url);
  const resolvedAvatar = await resolveBrandingAssetUrl(
    account?.business_avatar || account?.business_avatar_url || account?.business_logo || account?.business_logo_url
  );
  const logo = resolvedLogo || DEFAULT_BRAND_LOGO;
  const avatar = resolvedAvatar || logo;

  return {
    header: {
      nameLine1: businessName || DEFAULT_BRAND_NAME,
      nameLine2: businessName ? "" : "Digital Solutions",
      logo,
    },
    avatar,
  };
}

function extractStoragePath(pathOrUrl, bucketName) {
  if (!pathOrUrl) return null;

  const raw = String(pathOrUrl).trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const signMarker = `/storage/v1/object/sign/${bucketName}/`;
      const publicMarker = `/storage/v1/object/public/${bucketName}/`;

      if (url.pathname.includes(signMarker)) {
        return decodeURIComponent(url.pathname.split(signMarker)[1] || "");
      }
      if (url.pathname.includes(publicMarker)) {
        return decodeURIComponent(url.pathname.split(publicMarker)[1] || "");
      }

      return raw;
    } catch {
      return raw;
    }
  }

  const normalized = raw.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.toLowerCase().startsWith(`${bucketName.toLowerCase()}/`)) {
    return normalized.slice(bucketName.length + 1);
  }

  return normalized;
}

async function resolveBrandingAssetUrl(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return "";

  let current = raw;
  if (current.startsWith("{")) {
    try {
      const parsed = JSON.parse(current);
      if (parsed?.url) current = String(parsed.url).trim();
    } catch {}
  }

  const privatePath = extractStoragePath(current, "Private-assets");
  if (privatePath && !/^https?:\/\//i.test(privatePath)) {
    const { data, error } = await supabase.storage
      .from("Private-assets")
      .createSignedUrl(privatePath, 3600);
    if (!error && data?.signedUrl) return data.signedUrl;
  }

  const publicPath = extractStoragePath(current, "public-assets");
  if (publicPath && !/^https?:\/\//i.test(publicPath)) {
    const { data } = supabase.storage.from("public-assets").getPublicUrl(publicPath);
    if (data?.publicUrl) return data.publicUrl;
  }

  return /^https?:\/\//i.test(current) ? current : "";
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
  const [developerAccess, setDeveloperAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        let localMarketplaceAllowed = false;

        let { data: { session } } = await supabase.auth.getSession();
        // If no session, try an explicit refresh once (handles expired access tokens
        // that weren't auto-refreshed, e.g. after the computer woke from sleep or
        // the dev server restarted during the refresh window).
        if (!session?.user) {
          try {
            const { data: refreshed } = await supabase.auth.refreshSession();
            if (refreshed?.session) session = refreshed.session;
          } catch { /* refresh failed – user is genuinely logged out */ }
        }
        const user = session?.user;
        if (!user) {
          setDeveloperAccess(false);
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
            const currentPath = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";
            router.replace(`/login${currentPath && currentPath !== "/" ? `?redirect=${encodeURIComponent(currentPath)}` : ""}`);
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

        const hasDeveloperAccess = isAdminRoute || isDeveloperEmail(user.email);
        setDeveloperAccess(hasDeveloperAccess);

        // 🧾 Load user data from Supabase
        const { data, error } = await supabase
          .from("accounts")
          .select(
            "business_name, business_logo, business_logo_url, business_avatar, business_avatar_url, approved, is_approved, status, subscription_status"
          )
          .eq("user_id", user.id)
          .single();

        if (error) console.error(error);
        setAccount(data);

        console.log("[Layout.js] Loaded account row:", data);

        if ((hasDeveloperAccess || isInternalGr8ResultAccount(data)) && data) {
          const branding = await buildBrandingState(data);
          setHeader(branding.header);
          setAvatar(branding.avatar);
          setLoading(false);
          return;
        }

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
          const branding = await buildBrandingState(data);
          setHeader({
            ...branding.header,
          });
        } else {
          setHeader({
            nameLine1: DEFAULT_BRAND_NAME,
            nameLine2: "Digital Solutions",
            logo: DEFAULT_BRAND_LOGO,
          });
        }

        // 👤 Avatar logic — prefers avatar, falls back to logo, then default
        const branding = await buildBrandingState(data || {});
        const finalAvatar = branding.avatar;
        setAvatar(verifiedPlatformUser ? finalAvatar : DEFAULT_BRAND_LOGO);

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
  const hasPlatformAccess = developerAccess || isVerifiedPlatformUser;
  const vendorRouteAllowed =
    isVendorOnlyRoute &&
    marketplaceVendorAllowed;

  if (!loading && isProtectedPlatformRoute && !isAdminRoute && !hasPlatformAccess && !vendorRouteAllowed) {
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
  const showNav = showNavDefault && hasPlatformAccess;
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
        {hasPlatformAccess && (
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
            {/* ✅ Getting Started checklist */}
            <GettingStartedMenu />
            {/* ✅ Help & Tutorials */}
            <TutorialsMenu />
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
// Getting Started Checklist
// ===================
const SETUP_STEPS = [
  { id: "profile",  label: "Set up your profile & business details", href: "/account" },
  { id: "logo",    label: "Upload your business logo",              href: "/account" },
  { id: "plan",    label: "Choose your subscription plan",          href: "/billing" },
  { id: "contact", label: "Add your first contact",                 href: "/leads" },
  { id: "email",   label: "Send your first email",                  href: "/modules/email" },
];

function GettingStartedMenu() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("gr8:setup:done") || "{}"); }
    catch { return {}; }
  });

  const doneCount = SETUP_STEPS.filter(s => done[s.id]).length;
  const allDone = doneCount === SETUP_STEPS.length;

  function toggle(id) {
    setDone(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem("gr8:setup:done", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (!e.target.closest("[data-gs-menu]")) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const pillColor = allDone ? "#22c55e" : doneCount > 0 ? "#f59e0b" : "#6366f1";

  return (
    <div data-gs-menu style={{ position: "relative", flexShrink: 0 }}>
      <style>{`
        @keyframes gs-pulse {
          0%   { background-position: 0% 50%; box-shadow: 0 0 0 0 rgba(99,102,241,0.7); }
          50%  { background-position: 100% 50%; box-shadow: 0 0 0 8px rgba(99,102,241,0); }
          100% { background-position: 0% 50%; box-shadow: 0 0 0 0 rgba(99,102,241,0); }
        }
        .gs-btn {
          display: flex; align-items: center; gap: 10px;
          background: linear-gradient(270deg, #6366f1, #ec4899, #f59e0b, #6366f1);
          background-size: 400% 400%;
          animation: gs-pulse 2.4s ease infinite;
          border: none; border-radius: 12px;
          padding: 10px 18px; cursor: pointer; color: #fff;
          font-size: 24px; font-weight: 600; white-space: nowrap;
          letter-spacing: 0.02em;
        }
        .gs-btn.gs-done {
          background: #22c55e; background-size: unset; animation: none;
        }
        .gs-btn:hover { opacity: 0.9; }
      `}</style>
      <button
        className={`gs-btn${allDone ? " gs-done" : ""}`}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ fontSize: 24 }}>🚀</span>
        Getting Started
        <span style={{
          background: "rgba(0,0,0,0.35)", color: "#fff",
          borderRadius: 20, fontSize: 20, fontWeight: 600,
          padding: "3px 12px", minWidth: 44, textAlign: "center",
        }}>
          {doneCount}/{SETUP_STEPS.length}
        </span>
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          width: 420, background: "#0f1726",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 14, boxShadow: "0 14px 32px rgba(0,0,0,.5)",
          padding: "14px 0", zIndex: 200,
        }}>
          <div style={{ padding: "0 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 8 }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: "#fff" }}>Account Setup</div>
            <div style={{ fontSize: 18, color: "#9ca3af", marginTop: 4 }}>
              {allDone ? "All done — you\'re all set! 🎉" : `${SETUP_STEPS.length - doneCount} step${SETUP_STEPS.length - doneCount !== 1 ? "s" : ""} remaining`}
            </div>
            <div style={{ marginTop: 8, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.1)" }}>
              <div style={{ height: "100%", borderRadius: 4, background: pillColor, width: `${(doneCount / SETUP_STEPS.length) * 100}%`, transition: "width 0.3s" }} />
            </div>
          </div>
          {SETUP_STEPS.map(step => (
            <div key={step.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 16px",
              borderRadius: 8,
              margin: "0 6px",
            }}>
              <button
                onClick={() => toggle(step.id)}
                style={{
                  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                  border: done[step.id] ? "none" : "2px solid rgba(255,255,255,0.3)",
                  background: done[step.id] ? "#22c55e" : "transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, color: "#000", padding: 0,
                }}
              >{done[step.id] ? "✓" : ""}</button>
              <a
                href={step.href}
                style={{
                  flex: 1, fontSize: 20, color: done[step.id] ? "#6b7280" : "#e5e7eb",
                  textDecoration: done[step.id] ? "line-through" : "none",
                  textDecorationColor: "#6b7280",
                }}
              >{step.label}</a>
              <a href={step.href} style={{ fontSize: 18, color: "#6366f1", textDecoration: "none", flexShrink: 0 }}>Go →</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================
// Help & Tutorials
// ===================
const TUTORIAL_VIDEOS = [
  { label: "Platform Overview",     duration: "2 min",  url: "https://www.youtube.com/watch?v=PLACEHOLDER" },
  { label: "Email Marketing",       duration: "3 min",  url: "https://www.youtube.com/watch?v=PLACEHOLDER" },
  { label: "CRM & Contacts",        duration: "3 min",  url: "https://www.youtube.com/watch?v=PLACEHOLDER" },
  { label: "Calendar & Bookings",   duration: "3 min",  url: "https://www.youtube.com/watch?v=PLACEHOLDER" },
  { label: "Funnels & Websites",    duration: "4 min",  url: "https://www.youtube.com/watch?v=PLACEHOLDER" },
  { label: "Social Media",          duration: "3 min",  url: "https://www.youtube.com/watch?v=PLACEHOLDER" },
  { label: "Automation",            duration: "4 min",  url: "https://www.youtube.com/watch?v=PLACEHOLDER" },
];

function TutorialsMenu() {
  const [open, setOpen] = useState(false);
  const [playUrl, setPlayUrl] = useState(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (!e.target.closest("[data-tut-menu]")) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Extract YouTube video ID for embed
  function getEmbedUrl(url) {
    const m = url.match(/[?&]v=([^&]+)/);
    return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=1` : null;
  }

  return (
    <>
      <div data-tut-menu style={{ position: "relative", flexShrink: 0 }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10, padding: "10px 18px", cursor: "pointer", color: "#fff",
            fontSize: 24, fontWeight: 600, whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: 24 }}>🎓</span>
          Help &amp; Tutorials
        </button>

        {open && (
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)",
            width: 400, background: "#0f1726",
            border: "1px solid rgba(255,255,255,.12)",
            borderRadius: 14, boxShadow: "0 14px 32px rgba(0,0,0,.5)",
            padding: "14px 0", zIndex: 200,
          }}>
            <div style={{ padding: "0 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: "#fff" }}>Tutorial Videos</div>
              <div style={{ fontSize: 18, color: "#9ca3af", marginTop: 4, lineHeight: 1.5 }}>
                Short videos to help you get the most out of the platform.
              </div>
            </div>
            {TUTORIAL_VIDEOS.map(v => (
              <button
                key={v.label}
                onClick={() => { setPlayUrl(v.url); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "9px 16px", background: "none", border: "none",
                  cursor: "pointer", borderRadius: 8, margin: "0 6px",
                  textAlign: "left",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >
                <span style={{
                  width: 36, height: 36, borderRadius: 8, background: "#6366f1",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, flexShrink: 0,
                }}>▶</span>
                <span style={{ flex: 1, fontSize: 20, color: "#e5e7eb", fontWeight: 500 }}>{v.label}</span>
                <span style={{ fontSize: 18, color: "#9ca3af", flexShrink: 0 }}>{v.duration}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Video player modal */}
      {playUrl && (
        <div
          onClick={() => setPlayUrl(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: "relative", width: "min(860px, 90vw)", aspectRatio: "16/9" }}
          >
            <button
              onClick={() => setPlayUrl(null)}
              style={{
                position: "absolute", top: -36, right: 0,
                background: "none", border: "none", color: "#fff",
                fontSize: 24, cursor: "pointer", fontWeight: 600,
              }}
            >✕ Close</button>
            {getEmbedUrl(playUrl) ? (
              <iframe
                src={getEmbedUrl(playUrl)}
                style={{ width: "100%", height: "100%", border: "none", borderRadius: 12 }}
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            ) : (
              <div style={{
                width: "100%", height: "100%", background: "#111827",
                borderRadius: 12, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                color: "#9ca3af", fontSize: 15, gap: 8,
              }}>
                <span style={{ fontSize: 32 }}>🎬</span>
                <span>This tutorial is being recorded — check back shortly.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
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
  overflowX: "hidden",
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
  flex: 1,
  minWidth: 0,
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
  maxWidth: 720,
  minWidth: 0,
  flex: "1 1 auto",
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
