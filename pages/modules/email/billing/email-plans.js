// /pages/modules/email/billing/email-plans.js
// FULL REPLACEMENT — removes dead PRICING import + uses lib/modules-catalog

import Link from "next/link";
import { MODULES, AUD } from "../../../../lib/modules-catalog";

export default function EmailPlans() {
  return (
    <div style={{ background: "#0c121a", minHeight: "100vh", color: "#fff" }}>
      <div
        style={{
          width: "1320px",
          maxWidth: "100%",
          margin: "24px auto 18px",
          background: "#f59e0b",
          color: "#111",
          padding: "18px 22px",
          borderRadius: "16px",
          fontWeight: 800,
          fontSize: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 48 }}>💳</span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span>Email Plans</span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                opacity: 0.9,
                marginTop: 2,
              }}
            >
              Module pricing (from your modules catalog)
            </span>
          </div>
        </div>

        <Link
          href="/modules/email"
          style={{
            background: "#111",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            borderRadius: 8,
            padding: "6px 14px",
            textDecoration: "none",
            border: "1px solid #000",
          }}
        >
          ← Back
        </Link>
      </div>

      <div style={{ width: "1320px", maxWidth: "100%", margin: "0 auto" }}>
        <div
          style={{
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 18,
            boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ fontSize: 16, opacity: 0.9, marginBottom: 12 }}>
            Prices are pulled from <code>lib/modules-catalog.js</code>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {MODULES.map((m) => (
              <div
                key={m.id}
                style={{
                  background: "#0b1220",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ fontSize: 28 }}>{m.icon || "🧩"}</div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>
                      {m.name}
                    </div>
                    <div style={{ opacity: 0.8, fontSize: 13 }}>{m.id}</div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    fontWeight: 900,
                    fontSize: 18,
                    color: "#fbbf24",
                  }}
                >
                  {AUD(m.price_cents || 0)} / month
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, opacity: 0.8, fontSize: 13 }}>
            If you want discounts later, we’ll implement them correctly inside
            <code> lib/modules-catalog.js</code> (but right now we keep it
            build-safe).
          </div>
        </div>
      </div>
    </div>
  );
}
