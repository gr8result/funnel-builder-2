// /components/BrandHeader.js
// Fix: header no longer blocks clicks. It’s sticky, sized to its own height,
// and has no invisible overlay. Uses light z-index and isolation.

import React, { useEffect, useState } from "react";

function abbr(s = "") {
  const p = s.trim().split(/\s+/);
  const a = (p[0] || "").slice(0, 1);
  const b = (p[1] || "").slice(0, 1);
  return (a + b || "CR").toUpperCase();
}

export default function BrandHeader() {
  const [org, setOrg] = useState({ name: "Your Company", logo: "" });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let applied = false;
    async function load() {
      const endpoints = ["/api/account/brand", "/api/account/profile", "/api/account"];
      for (const url of endpoints) {
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          const j = await r.json();
          const name =
            j?.name ||
            j?.orgName ||
            j?.organisation?.name ||
            j?.account?.name ||
            localStorage.getItem("orgName") ||
            "Your Company";
          const logo =
            j?.logo ||
            j?.logoUrl ||
            j?.organisation?.logo ||
            j?.brand?.logo ||
            localStorage.getItem("orgLogo") ||
            "";
          setOrg({ name, logo });
          applied = true;
          break;
        } catch {}
      }
      if (!applied) {
        setOrg({
          name: localStorage.getItem("orgName") || "Your Company",
          logo: localStorage.getItem("orgLogo") || "",
        });
      }
    }
    load();
  }, []);

  return (
    <header className="brandCard" role="banner">
      {/* Left: logo + name */}
      <div className="left">
        <div className="logoWrap" aria-hidden>
          {org.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo} alt="" />
          ) : (
            <div className="placeholder">{abbr(org.name)}</div>
          )}
        </div>
        <div className="org">
          <div className="orgName" title={org.name}>{org.name}</div>
          <div className="orgHint">Active account</div>
        </div>
      </div>

      {/* Middle (future: breaking news / offers) */}
      <div className="centre" id="brand-news-slot" />

      {/* Right: big round avatar (2×) + menu */}
      <div className="right">
        <button
          className="avatarBtn"
          onClick={() => setOpen(v => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Account menu"
        >
          {org.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo} alt={org.name} />
          ) : (
            <span className="initials">{abbr(org.name)}</span>
          )}
        </button>
        {open && (
          <nav className="menu" role="menu">
            <a href="/account" role="menuitem">Account</a>
            <a href="/settings" role="menuitem">Settings</a>
            <a href="/api/auth/logout" role="menuitem">Log out</a>
          </nav>
        )}
      </div>

      <style jsx>{`
        .brandCard{
          position: sticky; top: 0;
          /* KEY FIXES */
          z-index: 10;           /* small, just above content */
          isolation: isolate;    /* prevent stacking context leaks */
          pointer-events: auto;  /* this element handles its own clicks only */
          /* Box */
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 12px 16px; background: #0e141d; border-bottom: 1px solid #1e2a3a;
        }
        .left{display:flex; align-items:center; gap:12px}
        .logoWrap{width:48px;height:48px;border-radius:50%;overflow:hidden;border:1px solid #223448;background:#0f1722;display:flex;align-items:center;justify-content:center}
        .logoWrap img{width:100%;height:100%;object-fit:cover}
        .placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:900;color:#eaf0ff}
        .orgName{font-weight:900;color:#eaf0ff;max-width:42vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .orgHint{font-size:12px;opacity:.7;margin-top:-2px}
        .centre{flex:1;text-align:center;font-size:13px;color:#ffd36b;min-height:18px}
        .right{position:relative}
        .avatarBtn{width:72px;height:72px;border-radius:50%;border:1px solid #223448;background:#0f1722;color:#eaf0ff;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .avatarBtn img{width:100%;height:100%;object-fit:cover;border-radius:50%}
        .initials{font-weight:900;font-size:22px}
        .menu{position:absolute;right:0;top:80px;background:#0f1722;border:1px solid #223448;border-radius:12px;padding:6px;min-width:200px;box-shadow:0 18px 40px rgba(0,0,0,.45)}
        .menu a{display:block;padding:10px 12px;border-radius:10px;color:#eaf0ff;text-decoration:none}
        .menu a:hover{background:#0b111a}
      `}</style>
    </header>
  );
}




