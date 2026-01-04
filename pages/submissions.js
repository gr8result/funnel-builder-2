// pages/submissions.js
// FULL REPLACEMENT
// Fixes bad import path to lib/modules-catalog (was too many ../)
// Keeps page build-safe. If you later want catalog usage, it's now correct.

import Head from "next/head";
import Link from "next/link";
import { MODULES, AUD } from "../lib/modules-catalog";

export default function SubmissionsPage() {
  return (
    <>
      <Head>
        <title>Submissions</title>
      </Head>

      <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Submissions</h1>
        <p style={{ opacity: 0.75, marginTop: 8 }}>
          Build-safe placeholder page. (Catalog import fixed.)
        </p>

        <div style={{ marginTop: 16 }}>
          <Link href="/" style={{ textDecoration: "underline" }}>
            Back home
          </Link>
        </div>

        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Modules catalog (sanity check)</h2>
          <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
            {MODULES.slice(0, 6).map((m) => (
              <div
                key={m.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  {m.icon} {m.name}
                </div>
                <div style={{ opacity: 0.75 }}>{AUD(m.price_cents)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
