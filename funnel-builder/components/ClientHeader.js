// components/ClientHeader.js
import React, { useMemo, useState } from "react";
import Link from "next/link";

export default function ClientHeader({ orgName, userName, logoSrc }) {
  const [open, setOpen] = useState(false);

  const initials = useMemo(() => {
    const parts = String(userName || "").trim().split(/\s+/);
    const a = (parts[0] || "").slice(0, 1);
    const b = (parts[1] || "").slice(0, 1);
    return (a + b).toUpperCase() || "U";
  }, [userName]);

  return (
    <>
      <header className="topbar" role="banner" aria-label="Client header">
        <div className="brand">
          <div className="logo">
            <img
              src={logoSrc}
              alt={`${orgName} logo`}
              width="34"
              height="34"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const next = e.currentTarget.nextElementSibling;
                if (next) next.style.display = "grid";
              }}
            />
            <div className="logo-fallback" style={{ display: "none" }}>LOGO</div>
          </div>
          <span className="org">{orgName}</span>
        </div>

        <div className="right">
          <button
            className="profile"
            aria-haspopup="menu"
            aria-expanded={open ? "true" : "false"}
            onClick={() => setOpen(v => !v)}
            title="Account menu"
          >
            <span aria-hidden className="initials">{initials}</span>
          </button>

          {open && (
            <nav className="menu" role="menu">
              <Link href="/account" role="menuitem" onClick={() => setOpen(false)}>
                Account
              </Link>
              <Link href="/api/auth/logout" role="menuitem" onClick={() => setOpen(false)}>
                Log out
              </Link>
            </nav>
          )}
        </div>
      </header>

      <style jsx>{`
        .topbar {
          position: relative;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }
        .brand { display: inline-flex; align-items: center; gap: 10px; }
        .logo {
          width: 34px; height: 34px; display: grid; place-items: center;
          border-radius: 8px; overflow: hidden;
          background: #121a25; border: 1px solid rgba(255,255,255,.15);
        }
        .logo-fallback { font-weight: 900; font-size: 12px; color: #9fb3ff; }
        .org { font-weight: 900; color: #e5e7eb; white-space: nowrap; }

        .right { position: relative; }
        .profile {
          width: 36px; height: 36px; border-radius: 50%;
          display: grid; place-items: center; cursor: pointer;
          color: #e5e7eb; background: #121a25;
          border: 1px solid rgba(255,255,255,.18);
        }
        .initials { font-weight: 800; font-size: 13px; }

        .menu {
          position: absolute; top: 46px; right: 0;
          min-width: 160px; padding: 6px; display: grid; gap: 4px;
          background: #0b1018; border: 1px solid rgba(255,255,255,.12);
          border-radius: 10px; box-shadow: 0 10px 24px rgba(0,0,0,.35);
          z-index: 1001;
        }
        .menu :global(a) {
          padding: 10px 12px; border-radius: 8px; text-decoration: none;
          color: #e5e7eb; font-weight: 600;
        }
        .menu :global(a:hover) { background: rgba(255,255,255,.06); }
      `}</style>
    </>
  );
}




