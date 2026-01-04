// components/Banner.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabase-client";

export default function Banner() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session || null);

      if (session) {
        const { data } = await supabase
          .from("profiles")
          .select("company_name, logo_url")
          .eq("user_id", session.user.id)
          .single();
        setProfile(data || null);
      }
    })();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const logoUrl = profile?.logo_url || "/logo-default.png"; // 👈 replace with your corporate logo
  const companyName = profile?.company_name || "";

  return (
    <header className="banner">
      {/* Left side: Logo + Name */}
      <div className="brand">
        <img src={logoUrl} alt="Logo" className="logo" />
        {companyName && <span className="company">{companyName}</span>}
      </div>

      {/* Right side: Profile dropdown */}
      <div className="profile">
        <div
          className="avatar"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <img src={logoUrl} alt="Avatar" />
        </div>
        {dropdownOpen && (
          <div className="dropdown">
            <button onClick={() => router.push("/account")}>Account</button>
            <button onClick={() => router.push("/billing")}>Billing & Modules</button>
            <button onClick={handleLogout}>Logout</button>
          </div>
        )}
      </div>

      <style jsx>{`
        .banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #0f1726;
          color: #fff;
          padding: 10px 16px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .logo {
          width: 36px;
          height: 36px;
          border-radius: 6px;
          object-fit: cover;
        }
        .company {
          font-weight: 700;
          font-size: 16px;
        }
        .profile {
          position: relative;
        }
        .avatar img {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          cursor: pointer;
        }
        .dropdown {
          position: absolute;
          right: 0;
          top: 44px;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          min-width: 160px;
          z-index: 50;
        }
        .dropdown button {
          padding: 10px 12px;
          text-align: left;
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
        }
        .dropdown button:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </header>
  );
}




