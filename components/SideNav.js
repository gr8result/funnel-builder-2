import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { LineChart } from "lucide-react";
import ICONS from "./iconMap";
import { useWorkspace } from "../hooks/useWorkspace";

// Helper — if item has no `roles`, it's visible to everyone.
// If role is null/unknown (loading or no workspace), show everything —
// the API endpoints enforce real security; nav hiding is just UX.
function canSee(item, role) {
  if (!item.roles) return true;
  if (!role) return true;  // unknown role → show all, API will block unauthorised actions
  return item.roles.includes(role);
}

// Same network / circle style icon for Communities (Option 3)
const CommunitiesIcon = ({ size = 24, color = "#fff" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="7" cy="7" r="3.2" />
    <circle cx="17" cy="7" r="3.2" />
    <circle cx="12" cy="17" r="3.2" />
    <line x1="9" y1="8.6" x2="10.6" y2="14.4" />
    <line x1="15" y1="8.6" x2="13.4" y2="14.4" />
  </svg>
);

// Role constants for readability
const ALL       = undefined;           // visible to every role
const OWNERS    = ["owner"];
const MGMT      = ["owner", "admin"];
const SALES_UP  = ["owner", "admin", "sales"];
const MKT_UP    = ["owner", "admin", "marketing"];
const CRM_ROLES = ["owner", "admin", "sales", "support", "marketing"];

const NAV_ITEMS = [
  { href: "/dashboard",       label: "Navigation Dashboard",     icon: ICONS.dashboard,  color: "u01", emoji: "🧩" },
  { href: "/store/dashboard", label: "Command Centre",            icon: ICONS.dashboard,  color: "u01", roles: MGMT, emoji: "📌" },
  {
    href: "/marketplace",
    label: "The Xchange Marketplace",
    icon: ICONS.marketplace,
    color: "u23",
    target: "_blank",
    rel: "noopener noreferrer",
    emoji: "🛍️",
  },
  { href: "/modules/vendor",     label: "Vendor's Dashboard",    icon: ICONS.marketplace, color: "u01", roles: MGMT, emoji: "🏪" },
  { href: "/modules/affiliates", label: "Affiliates Dashboard",  icon: ICONS.affiliates,  color: "u18", roles: MGMT, emoji: "🤝" },
  { href: "/assets",             label: "Media Library",         icon: ICONS.assets,      color: "u03", emoji: "🖼️" },
  { href: "/leads",              label: "Leads",                 icon: ICONS.leads,       color: "u04", roles: CRM_ROLES, emoji: "📥" },
  { href: "/account",            label: "Account",               icon: ICONS.account,     color: "u05", roles: OWNERS, emoji: "⚙️" },
  { href: "/modules/email/crm/teams", label: "Team Members",      icon: ICONS.account,     color: "u27", roles: MGMT, emoji: "👥" },
  { href: "/billing",            label: "Pricing & Billing",     icon: ICONS.billing,     color: "u06", roles: OWNERS, emoji: "🧾" },
  { href: "/modules/communities",label: "Communities",           icon: CommunitiesIcon,   color: "u17", emoji: "👥" },
  { href: "/modules/accounting", label: "Accounting",            icon: ICONS.billing,     color: "u21", roles: MGMT, emoji: "📊" },
];

// ⭐ MODULE ITEMS — Email first, CRM second, then everything else
const MODULE_ITEMS = [
  { href: "/modules/email",                    label: "Email Marketing",       icon: ICONS.email,          color: "u10", roles: MKT_UP,   emoji: "📧" },
  { href: "/modules/email/crm",                label: "CRM",                   icon: ICONS.account,        color: "u22", roles: CRM_ROLES, emoji: "🗂️" },
  { href: "/modules/construction",               label: "Projects Hub",          icon: ICONS.funnels,        color: "u09", roles: MGMT,     emoji: "🗂️" },
  { href: "/modules/email/crm/sms-dashboard",  label: "SMS Marketing",         icon: ICONS.sms,            color: "u33", roles: MKT_UP,   emoji: "💬" },
  { href: "/modules/social_media/dashboard",   label: "Social Media",          icon: ICONS.social,         color: "u25", roles: MKT_UP,   emoji: "📱" },
  { href: "/modules/calendar/dashboard",       label: "Booking Calendar",      icon: ICONS.calendar,       color: "u15", roles: SALES_UP, emoji: "📅" },
  { href: "/modules/website-builder",          label: "Website Builder",       icon: ICONS.websiteBuilder, color: "u07", roles: MKT_UP,   emoji: "🌐" },
  { href: "/funnels",                          label: "Sales Funnels",         icon: ICONS.funnels,        color: "u08", roles: MKT_UP },

  { href: "/modules/business-automation",      label: "Business Automation",   icon: ICONS.automation,     color: "u09", roles: MGMT,    emoji: "⚙️" },
  { href: "/modules/webinars",                 label: "Evergreen Webinars",    icon: ICONS.webinars,       color: "u14", roles: MKT_UP,  comingSoon: true, emoji: "🎥" },
  { href: "/modules/pipelines",               label: "Subscription Pipelines",icon: ICONS.subscription,   color: "u16", roles: MGMT,    comingSoon: true, emoji: "🌿" },
  { href: "/modules/hr",                       label: "Human Resources",       icon: ICONS.hr,             color: "u28", roles: MGMT,    comingSoon: true, emoji: "👨‍💼" },
  { href: "/modules/agency",                   label: "Agency Dashboard",      icon: ICONS.agency,         color: "u19", roles: MGMT,    comingSoon: true, emoji: "🏢" },
];

export default function SideNav() {
  const router = useRouter();
  const [activePath, setActivePath] = useState(router.pathname);
  const { role, loading: wsLoading } = useWorkspace();

  useEffect(() => {
    if (router.isReady) setActivePath(router.pathname);
  }, [router.pathname, router.isReady]);

  const isActive = (href) => {
    if (!router.isReady) return false;
    return activePath === href || activePath.startsWith(href + "/");
  };

  // While workspaces are still loading show everything — avoids a flash of
  // restricted nav before the role is known.
  const effectiveRole = wsLoading ? null : role;
  const visibleCore    = NAV_ITEMS.filter((item) => canSee(item, effectiveRole));
  const visibleModules = MODULE_ITEMS.filter((item) => canSee(item, effectiveRole));

  return (
    <aside className="sidenav">
      <div className="branding">
        <img src="/logo.png" alt="Company Logo" className="logo" />
        <div className="brand-text">
          <div>GR8 RESULT</div>
          <div>Digital Solutions</div>
        </div>
      </div>

      <div className="sections">
        <div className="section">
          <h4>Core</h4>
          {visibleCore.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={`nav-item ${item.color} ${
                  isActive(item.href) ? "active" : ""
                }`}
                {...(item.target ? { target: item.target } : {})}
                {...(item.rel ? { rel: item.rel } : {})}
              >
                <span className="icon">
                  {item.emoji
                    ? <span style={{ fontSize: 17, lineHeight: 1 }}>{item.emoji}</span>
                    : item.icon && <item.icon color="#fff" size={18} />}
                </span>
                <span className="label">{item.label}</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="section">
          <h4>Modules</h4>
          {visibleModules.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={`nav-item ${item.color} ${
                  isActive(item.href) ? "active" : ""
                }${item.comingSoon ? " coming-soon" : ""}`}
              >
                <span className="icon">
                  {item.emoji
                    ? <span style={{ fontSize: 17, lineHeight: 1 }}>{item.emoji}</span>
                    : item.icon && <item.icon color="#fff" size={18} />}
                </span>
                <span className="label">{item.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>



      <style jsx>{`
        .sidenav {
          position: fixed;
          top: 0;
          left: 0;
          width: 300px;
          height: 100vh;
          background: #111827;
          color: #fff;
          display: flex;
          flex-direction: column;
          padding: 18px 18px 80px;
          box-sizing: border-box;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: #374151 #111827;
          z-index: 100;
        }

        .branding {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
          border-bottom: 1px solid #1f2937;
          padding-bottom: 14px;
        }

        .logo {
          width: 44px;
          height: 44px;
          object-fit: contain;
          border-radius: 0;
        }

        .brand-text {
          display: flex;
          flex-direction: column;
          font-size: 14px;
          color: #fff;
          line-height: 1.2;
        }

        .sidenav::-webkit-scrollbar {
          width: 8px;
        }
        .sidenav::-webkit-scrollbar-thumb {
          background: #374151;
          border-radius: 4px;
        }

        .sections {
          flex: 1;
        }

        .section {
          margin-bottom: 22px;
        }

        h4 {
          font-size: 14px;
          margin: 12px 0;
          color: #9ca3af;
        }

        .nav-item {
          display: flex;
          align-items: center;
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
          margin-bottom: 8px;
          transition: background 0.2s ease, border 0.2s ease, color 0.2s ease;
          color: #fff;
          border: 2px solid transparent;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .nav-item .icon {
          flex-shrink: 0;
          font-size: 20px;
          margin-right: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Outline colours */
        .u01 { border-color: #22c55e; }
        .u02 { border-color: #06b6d4; }
        .u03 { border-color: #6366f1; }
        .u04 { border-color: #f43f5e; }
        .u05 { border-color: #8b5cf6; }
        .u06 { border-color: #f59e0b; } /* Billing */
        .u07 { border-color: #2d94c3; }
        .u08 { border-color: #ef465d; }
        .u09 { border-color: #fb923c; }
        .u10 { border-color: #facc15; }
        .u11 { border-color: #38bdf8; } /* Gantt Charts — sky blue */
        .u12 { border-color: #ec4899; }
        .u13 { border-color: #0ea5e9; }
        .u14 { border-color: #ef4444; }
        .u15 { border-color: #bae974; }
        .u16 { border-color: #7c3aed; }
        .u17 { border-color: #14b8a6; } /* Communities teal */
        .u18 { border-color: #06a9db; }
        .u19 { border-color: #10b981; }
        .u20 { border-color: #475569; }
        .u21 { border-color: #0ea5e9; } /* Accounting blue */
        .u22 { border-color: #ec4899; } /* CRM */
        .u23 { border-color: #0d87f1; } /* Marketplace */
        .u26 { border-color: #34d399; } /* Pricing */
        .u27 { border-color: #f97316; } /* Team Members orange */
        .u28 { border-color: #3b82f6; } /* Human Resources blue */
        .u24 { border-color: #0df118; } /* Vendor's Dashboard */
        .u25 { border-color: #8126e9; }
        .u33 { border-color: #06b6d4; } /* SMS Marketing */

        /* Active + hover fill colours (dashboard-style full colour) */
        .nav-item.u01:hover,
        .active.u01 { background: #22c55e; border-color: #22c55e; color: #000; }
        .nav-item.u02:hover,
        .active.u02 { background: #06b6d4; border-color: #06b6d4; color: #000; }
        .nav-item.u03:hover,
        .active.u03 { background: #6366f1; border-color: #6366f1; color: #000; }
        .nav-item.u04:hover,
        .active.u04 { background: #f43f5e; border-color: #f43f5e; color: #000; }
        .nav-item.u05:hover,
        .active.u05 { background: #8b5cf6; border-color: #8b5cf6; color: #000; }
        .nav-item.u06:hover,
        .active.u06 { background: #f59e0b; border-color: #f59e0b; color: #000; }
        .nav-item.u07:hover,
        .active.u07 { background: #2d94c3; border-color: #2d94c3; color: #000; }
        .nav-item.u08:hover,
        .active.u08 { background: #ef465d; border-color: #ef465d; color: #000; }
        .nav-item.u09:hover,
        .active.u09 { background: #fb923c; border-color: #fb923c; color: #000; }
        .nav-item.u10:hover,
        .active.u10 { background: #facc15; border-color: #facc15; color: #000; }
        .nav-item.u11:hover,
        .active.u11 { background: #38bdf8; border-color: #38bdf8; color: #000; }
        .nav-item.u12:hover,
        .active.u12 { background: #ec4899; border-color: #ec4899; color: #000; }
        .nav-item.u13:hover,
        .active.u13 { background: #0ea5e9; border-color: #0ea5e9; color: #000; }
        .nav-item.u14:hover,
        .active.u14 { background: #ef4444; border-color: #ef4444; color: #000; }
        .nav-item.u15:hover,
        .active.u15 { background: #84cc16; border-color: #84cc16; color: #000; }
        .nav-item.u16:hover,
        .active.u16 { background: #7c3aed; border-color: #7c3aed; color: #000; }
        .nav-item.u17:hover,
        .active.u17 { background: #14b8a6; border-color: #14b8a6; color: #000; }
        .nav-item.u18:hover,
        .active.u18 { background: #06a9db; border-color: #06a9db; color: #000; }
        .nav-item.u19:hover,
        .active.u19 { background: #10b981; border-color: #10b981; color: #000; }
        .nav-item.u20:hover,
        .active.u20 { background: #475569; border-color: #475569; color: #000; }
        .nav-item.u21:hover,
        .active.u21 { background: #0ea5e9; border-color: #0ea5e9; color: #000; }
        .nav-item.u22:hover,
        .active.u22 { background: #ec4899; border-color: #ec4899; color: #000; }
        .nav-item.u23:hover,
        .active.u23 { background: #0d87f1; border-color: #0d87f1; color: #000; }
        .nav-item.u24:hover,
        .active.u24 { background: #0df118; border-color: #0df118; color: #000; }
        .nav-item.u25:hover,
        .active.u25 { background: #8126e9; border-color: #8126e9; color: #000; }
        .nav-item.u27:hover,
        .active.u27 { background: #f97316; border-color: #f97316; color: #000; }
        .nav-item.u28:hover,
        .active.u28 { background: #3b82f6; border-color: #3b82f6; color: #000; }
        .nav-item.coming-soon { opacity: 0.45; }
        .nav-item.coming-soon:hover { opacity: 0.75; }
        .nav-item.u33:hover,
        .active.u33 { background: #06b6d4; border-color: #06b6d4; color: #000; }

        .bottom-actions {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
          border-top: 1px solid #374151;
          padding-top: 10px;
        }

        .funnel-btn {
          width: 100%;
          padding: 14px 0;
          border: none;
          border-radius: 8px;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, box-shadow 0.2s;
          text-align: center;
          box-shadow: 0 2px 8px rgba(34,197,94,0.12);
        }

        .funnel-btn.import {
          background: linear-gradient(135deg,#22c55e,#3b82f6);
          color: #fff;
        }
        .funnel-btn.import:hover { background: linear-gradient(135deg,#16a34a,#2563eb); }

        .funnel-btn.export {
          background: linear-gradient(135deg,#ef4444,#ef465d);
          color: #fff;
        }
        .funnel-btn.export:hover { background: linear-gradient(135deg,#b91c1c,#ef465d); }
      `}</style>
    </aside>
  );
}