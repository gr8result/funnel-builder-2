// /components/NavItem.js
// Minimal, safe Nav item used by SideNav. No styling changes elsewhere.

import Link from "next/link";

export default function NavItem({ href = "#", icon = null, label = "" }) {
  const Icon = icon; // accept either a React node or a function
  return (
    <Link href={href} legacyBehavior>
      <a className="nav-item">
        <span className="icon">
          {typeof Icon === "function" ? <Icon /> : Icon}
        </span>
        <span className="label">{label}</span>

        <style jsx>{`
          .nav-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            border-radius: 10px;
            color: #eaf0ff;
            text-decoration: none;
          }
          .nav-item:hover { background: #0b111a; }
          .icon { line-height: 0; display: inline-flex; }
          .label { font-weight: 600; }
        `}</style>
      </a>
    </Link>
  );
}




