import Link from "next/link";

export const CRM_TABS = [
  { key: "pipeline", label: "Pipeline", href: "/modules/email/crm/pipelines" },
  { key: "activities", label: "Activities & Follow-ups", href: "/modules/email/crm/tasks" },
  { key: "reports", label: "Reports", href: "/modules/email/crm/reports" },
  { key: "messaging", label: "Messaging Analytics", href: "/modules/email/crm/workspace" },
];

export default function CrmTabs({ active }) {
  return (
    <nav aria-label="CRM sections" style={wrap}>
      {CRM_TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            style={{ ...base, ...(isActive ? activeStyle : null) }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

const wrap = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  width: "100%",
  maxWidth: 1320,
  margin: "16px auto 0",
  padding: "0 20px",
  boxSizing: "border-box",
};

const base = {
  padding: "8px 16px",
  borderRadius: 999,
  border: "1px solid #263346",
  background: "#0f1622",
  color: "#cbd5e1",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 15,
};

const activeStyle = {
  background: "#ec4899",
  borderColor: "#ec4899",
  color: "#fff",
};
