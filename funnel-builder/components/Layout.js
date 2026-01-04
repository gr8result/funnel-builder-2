// /components/Layout.js
import { ensureUserFolders } from "../utils/storage-init";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import SideNav from "./SideNav";
import ICONS from "./iconMap";
import { supabase } from "../utils/supabase-client";

const NAV_WIDTH = 300;

export default function Layout({ children }) {
  const router = useRouter();
  const path = router.pathname;

  const isAdminRoute = path.startsWith("/admin") || path.startsWith("/dev");
  const noNavRoutes = ["/login", "/signup", "/pending-approval"];
  const showNavDefault = !noNavRoutes.includes(path);

  const [account, setAccount] = useState(null);
  const [header, setHeader] = useState({
    nameLine1: "GR8 RESULT",
    nameLine2: "Digital Solutions",
    logo: "/logo.png",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return setLoading(false);

        // ✅ Client-side fallback: create user storage folders if missing
        await ensureUserFolders();

        const adminEmails = [
          "admin@gr8result.com",
          "developer@gr8result.com",
          "grant@gr8result.com",
        ];

        if (isAdminRoute || adminEmails.includes(user.email)) {
          setHeader({
            nameLine1: "GR8 RESULT",
            nameLine2: "Digital Solutions",
            logo: "/logo.png",
          });
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("accounts")
          .select(
            "business_name, business_logo, business_avatar, approved, subscription_status"
          )
          .eq("user_id", user.id)
          .single();

        if (error) console.error(error);
        setAccount(data);

        if (data?.business_name) {
          setHeader({
            nameLine1: data.business_name,
            nameLine2: "",
            logo:
              data.business_logo && data.business_logo.trim() !== ""
                ? data.business_logo
                : "/logo.png",
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [path]);

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

  const showNav = showNavDefault;

  const avatar =
    account?.business_avatar && account.business_avatar.trim() !== ""
      ? account.business_avatar
      : header.logo;

  return (
    <div style={wrap}>
      <aside style={leftCol}>
        <SideNav />
      </aside>

      <section style={rightCol}>
        <header style={topbar}>
          <div style={brandBox}>
            <div style={logoWrap}>
              <img src={header.logo} alt="Logo" style={brandLogo} />
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
          <ProfileMenu avatar={avatar} />
        </header>

        <main style={main}>{children}</main>
      </section>
    </div>
  );
}

function ProfileMenu({ avatar }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div style={pmWrap}>
      <button type="button" style={pmButton} onClick={() => setOpen(!open)}>
        <img src={avatar} alt="avatar" style={pmAvatarImg} />
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
  display: "grid",
  gridTemplateRows: "100px 1fr",
  minWidth: 0,
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
  fontWeight: 800,
  fontSize: 20,
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
  fontSize: 14,
  fontWeight: 500,
  textDecoration: "none",
  cursor: "pointer",
  background: "none",
  border: "none",
  width: "100%",
  textAlign: "left",
};
const pmIcon = { width: 20, display: "inline-block", textAlign: "center" };
const main = { padding: 20, minWidth: 0 };
