import { useState } from "react";

const SECTORS = [
  {
    key: "courses",
    label: "Online Courses",
    color: "#0ea5e9",
    revenue: 1200,
    sales: 12,
    affiliates: 4,
    salesList: [
      { id: "C1", date: "2026-03-18", amount: 100, affiliate: "A1" },
      { id: "C2", date: "2026-03-17", amount: 150, affiliate: "A2" },
    ],
  },
  {
    key: "physical",
    label: "Physical Products",
    color: "#10b981",
    revenue: 2500,
    sales: 25,
    affiliates: 7,
    salesList: [
      { id: "P1", date: "2026-03-16", amount: 200, affiliate: "A3" },
      { id: "P2", date: "2026-03-15", amount: 120, affiliate: "A4" },
    ],
  },
  {
    key: "digital",
    label: "Digital Products",
    color: "#6366f1",
    revenue: 900,
    sales: 9,
    affiliates: 2,
    salesList: [
      { id: "D1", date: "2026-03-14", amount: 80, affiliate: "A5" },
      { id: "D2", date: "2026-03-13", amount: 60, affiliate: "A6" },
    ],
  },
  {
    key: "affiliate",
    label: "Affiliate Sales (All)",
    color: "#f59e0b",
    revenue: 3100,
    sales: 28,
    affiliates: 10,
    salesList: [
      { id: "A1", date: "2026-03-12", amount: 110, affiliate: "A7" },
      { id: "A2", date: "2026-03-11", amount: 130, affiliate: "A8" },
    ],
  },
  {
    key: "combined",
    label: "Combined Total",
    color: "#f97316",
    revenue: 4600,
    sales: 46,
    affiliates: 10,
    salesList: [],
  },
];

export default function TabbedSectors() {
  const [active, setActive] = useState(SECTORS[0].key);
  const sector = SECTORS.find((s) => s.key === active);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {SECTORS.map((s) => (
          <button
            key={s.key}
            style={{
              background: s.color,
              color: "#fff",
              fontWeight: 700,
              border: "none",
              borderRadius: 8,
              padding: "12px 24px",
              fontSize: 16,
              cursor: "pointer",
              opacity: active === s.key ? 1 : 0.7,
              boxShadow: active === s.key ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
            }}
            onClick={() => setActive(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {/* Sector Card */}
      <div style={{ background: sector.color, borderRadius: 12, padding: 24, color: "#fff", marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800 }}>{sector.label}</h2>
        <p style={{ fontSize: 18, fontWeight: 700 }}>Revenue: ${sector.revenue.toFixed(2)}</p>
        <p style={{ fontSize: 16 }}>Sales: {sector.sales}</p>
        <p style={{ fontSize: 16 }}>Affiliates: {sector.affiliates}</p>
      </div>
      {/* Drill-down sales table */}
      {sector.salesList && sector.salesList.length > 0 && (
        <div style={{ background: "#181f2e", borderRadius: 12, padding: 18, color: "#fff" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Individual Sales</h3>
          <table style={{ width: "100%", color: "#fff", fontSize: 15, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#232e47" }}>
                <th style={{ padding: "10px 8px" }}>Sale ID</th>
                <th style={{ padding: "10px 8px" }}>Date</th>
                <th style={{ padding: "10px 8px" }}>Amount</th>
                <th style={{ padding: "10px 8px" }}>Affiliate</th>
              </tr>
            </thead>
            <tbody>
              {sector.salesList.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid #232e47" }}>
                  <td style={{ padding: "8px 8px" }}>{row.id}</td>
                  <td style={{ padding: "8px 8px" }}>{row.date}</td>
                  <td style={{ padding: "8px 8px" }}>${row.amount.toFixed(2)}</td>
                  <td style={{ padding: "8px 8px" }}>{row.affiliate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
