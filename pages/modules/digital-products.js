// /pages/modules/digital-products.js
// Digital Products — banner + coming soon

import Head from "next/head";
import { useRouter } from "next/router";
import ICONS from "../../components/iconMap";

export default function DigitalProducts() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Digital Products | GR8 RESULT</title>
      </Head>

      <div
        style={{
          minHeight: "100vh",
          background: "#020617",
          color: "#fff",
          padding: "28px 22px",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ width: "100%", maxWidth: 1320, margin: "0 auto" }}>
          {/* Banner */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#6b7280", // Digital products grey from sidenav button
              padding: "16px 20px",
              borderRadius: 14,
              marginBottom: 26,
              fontWeight: 700,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: "rgba(0,0,0,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {ICONS.digitalproducts
                  ? ICONS.digitalproducts({ size: 30 })
                  : ICONS.assets({ size: 30 })}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>
                  Digital products
                </div>
                <div
                  style={{
                    fontSize: 15,
                    opacity: 0.9,
                    fontWeight: 400,
                  }}
                >
                  File uploads, secure delivery & automated fulfilment.
                </div>
              </div>
            </div>

            {/* BACK BUTTON */}
            <button
              onClick={() => router.back()}
              style={{
                background: "#020617",
                color: "#fff",
                border: "2px solid rgba(255,255,255,0.25)",
                borderRadius: 8,
                padding: "8px 16px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all .2s ease",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background = "#0b1120")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.background = "#020617")
              }
            >
              ← Back
            </button>
          </div>

          {/* Coming Soon Section */}
          <div
            style={{
              background: "#111827",
              border: "1px dashed #6b7280",
              borderRadius: 12,
              padding: 24,
              fontSize: 18,
              lineHeight: 1.6,
              width: "100%",
              maxWidth: 700,
              margin: "12px auto",
            }}
          >
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Create products — name, description, price.</li>
              <li>Upload downloadable files from <code>/assets</code>.</li>
              <li>Automatic file delivery after checkout.</li>
              <li>Issue & revoke downloads per customer.</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

