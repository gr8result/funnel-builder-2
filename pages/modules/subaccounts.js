// /pages/modules/subaccounts.js   (or /pages/modules/subaccounts/index.js)
// Subaccounts – standard module banner + guard

import Head from "next/head";
import { useRouter } from "next/router";
import ICONS from "../../components/iconMap"; // adjust to ../../../ if this file is in /modules/subaccounts/index.js
import { useModuleGuard, Locked } from "./_guard";

export default function Subaccounts() {
  const router = useRouter();
  const enabled = useModuleGuard("subaccounts");

  return (
    <>
      <Head>
        <title>Subaccounts | GR8 RESULT</title>
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
          {/* TOP BANNER – same layout as other modules, colour matches sidenav */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#22c55e", // Subaccounts green (matches sidenav chip)
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
                {/* same icon as Subaccounts in the sidenav */}
                {ICONS.subaccounts
                  ? ICONS.subaccounts({ size: 30 })
                  : ICONS.modules
                  ? ICONS.modules({ size: 30 })
                  : null}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>
                  Subaccounts
                </div>
                <div
                  style={{
                    fontSize: 15,
                    opacity: 0.9,
                    fontWeight: 400,
                  }}
                >
                  Create and manage agency workspaces and client subaccounts.
                </div>
              </div>
            </div>

            {/* BACK BUTTON – same as other module pages */}
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

          {/* CONTENT AREA */}
          {enabled === null && (
            <div
              style={{
                background: "#0b1120",
                borderRadius: 12,
                padding: 24,
                fontSize: 18,
                textAlign: "center",
                opacity: 0.85,
              }}
            >
              Loading…
            </div>
          )}

          {enabled === true && (
            <div
              style={{
                background: "#0b1120",
                border: "1px dashed #22c55e",
                borderRadius: 12,
                padding: 24,
                fontSize: 18,
                textAlign: "center",
                opacity: 0.9,
              }}
            >
              🚧 <strong>Coming Soon</strong> — multi-account management,
              agency workspaces, and client subaccounts.
            </div>
          )}

          {enabled === false && (
            <Locked moduleName="Subaccounts" />
          )}
        </div>
      </div>
    </>
  );
}
