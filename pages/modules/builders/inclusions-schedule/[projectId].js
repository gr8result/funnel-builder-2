import Head from "next/head";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useWorkspace } from "../../../../hooks/useWorkspace";
import { supabase } from "../../../../utils/supabase-client";
import { money } from "../../../../lib/product-library/helpers";

async function authHeaders(workspaceId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token || "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
  };
}

export default function InclusionsSchedulePage() {
  const router = useRouter();
  const { projectId } = router.query;
  const { workspaceId } = useWorkspace();
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadVersions() {
    if (!workspaceId || !projectId) return;
    setLoading(true);
    setError("");
    const response = await fetch(`/api/builders/inclusions-schedule?projectId=${projectId}`, {
      headers: await authHeaders(workspaceId),
    });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok || !payload?.ok) {
      setError(payload?.error || "Could not load the inclusions schedule.");
      return;
    }
    setVersions(payload.versions || []);
    setSelectedVersion(payload.versions?.[0] || null);
  }

  useEffect(() => {
    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, projectId]);

  async function generateSchedule() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/builders/inclusions-schedule", {
      method: "POST",
      headers: await authHeaders(workspaceId),
      body: JSON.stringify({ projectId }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok || !payload?.ok) {
      setError(payload?.error || "Could not generate the schedule.");
      return;
    }
    await loadVersions();
  }

  async function signSchedule(role) {
    const signedName = window.prompt(`Enter the ${role === "builder" ? "builder / consultant" : "client"}'s full name to sign this schedule:`);
    if (!signedName || !signedName.trim()) return;
    setBusy(true);
    const response = await fetch("/api/builders/inclusions-schedule", {
      method: "PATCH",
      headers: await authHeaders(workspaceId),
      body: JSON.stringify({ id: selectedVersion.id, role, signedName }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok || !payload?.ok) {
      setError(payload?.error || "Could not sign the schedule.");
      return;
    }
    await loadVersions();
  }

  const snapshot = selectedVersion?.snapshot;

  return (
    <>
      <Head>
        <title>Client Selections Schedule | Gr8 Result</title>
      </Head>
      <main className="page">
        <div className="toolbar no-print">
          <h1>Final Inclusions Schedule</h1>
          <div className="actions">
            {versions.length > 1 && (
              <select value={selectedVersion?.id || ""} onChange={(event) => setSelectedVersion(versions.find((v) => v.id === event.target.value) || null)}>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>Version {version.version} ({version.status})</option>
                ))}
              </select>
            )}
            <button type="button" disabled={busy} onClick={generateSchedule}>{busy ? "Working..." : "Regenerate from current selections"}</button>
            {selectedVersion && (
              <>
                <button type="button" onClick={() => window.print()}>Print</button>
                {selectedVersion.pdf_url && (
                  <a className="button-link" href={selectedVersion.pdf_url} target="_blank" rel="noreferrer">Download PDF</a>
                )}
                {selectedVersion.status !== "signed" && (
                  <>
                    <button type="button" disabled={busy} onClick={() => signSchedule("client")}>Client Sign</button>
                    <button type="button" disabled={busy} onClick={() => signSchedule("builder")}>Builder Sign</button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {error && <div className="alert no-print">{error}</div>}
        {loading && <p className="no-print">Loading...</p>}

        {snapshot && (
          <article className="schedule">
            <h1>{snapshot.projectName || "Client Selections Schedule"}</h1>
            <p className="meta">
              {snapshot.clientName}{snapshot.siteAddress ? ` · ${snapshot.siteAddress}` : ""}<br />
              Generated {new Date(snapshot.generatedAt).toLocaleDateString("en-AU")} · Version {snapshot.version} · {selectedVersion.status}
            </p>

            {snapshot.groups.map((group) => (
              <section key={group.groupName}>
                <h2>{group.groupName}</h2>
                {group.items.map((item, index) => (
                  <div key={index} className="item">
                    {item.imageUrl && <img src={item.imageUrl} alt="" />}
                    <div className="item-body">
                      <strong>{item.productName}</strong>
                      <small>{[item.brand, item.model].filter(Boolean).join(" · ")}</small>
                      <small>{[item.colour, item.finish, item.supplier].filter(Boolean).join(" · ")}</small>
                      {item.clientNotes && <small className="notes">{item.clientNotes}</small>}
                    </div>
                    <div className={`item-amount ${item.variationAmount > 0 ? "upgrade" : item.variationAmount < 0 ? "credit" : ""}`}>
                      {item.variationAmount === 0 ? "Included" : money(item.variationAmount)}
                    </div>
                  </div>
                ))}
              </section>
            ))}

            <div className="totals">
              <div>Total upgrades: {money(snapshot.totals.totalUpgrades)}</div>
              <div>Total credits: {money(snapshot.totals.totalCredits)}</div>
              <div className="net">Net variation: {money(snapshot.totals.netVariation)}</div>
            </div>

            <div className="signatures">
              <div className="sig-line">
                {selectedVersion.client_signed_name ? `Signed: ${selectedVersion.client_signed_name}` : "Client signature / date"}
              </div>
              <div className="sig-line">
                {selectedVersion.builder_signed_name ? `Signed: ${selectedVersion.builder_signed_name}` : "Builder / consultant signature / date"}
              </div>
            </div>
          </article>
        )}

        {!loading && !snapshot && (
          <p className="no-print">No schedule has been generated for this project yet. Click "Regenerate from current selections" to create version 1.</p>
        )}
      </main>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #07111f;
          color: #e5eefb;
          padding: 24px;
        }
        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
        }
        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        button, .button-link, select {
          border: 0;
          border-radius: 8px;
          background: #2563eb;
          color: white;
          cursor: pointer;
          font-weight: 700;
          padding: 8px 12px;
          font-size: 12.5px;
          text-decoration: none;
        }
        .alert {
          border: 1px solid rgba(248, 113, 113, 0.45);
          color: #fecaca;
          background: rgba(127, 29, 29, 0.25);
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 16px;
        }
        .schedule {
          background: white;
          color: #0f172a;
          border-radius: 12px;
          padding: 40px;
          max-width: 860px;
          margin: 0 auto;
        }
        .schedule h1 {
          margin: 0 0 4px;
          font-size: 26px;
        }
        .meta {
          color: #475569;
          margin-bottom: 20px;
        }
        .schedule h2 {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #0369a1;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 4px;
          margin-top: 24px;
        }
        .item {
          display: grid;
          grid-template-columns: 56px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px dashed #e2e8f0;
        }
        .item img {
          width: 56px;
          height: 56px;
          object-fit: cover;
          border-radius: 6px;
        }
        .item-body {
          display: grid;
          gap: 2px;
        }
        .item-body small {
          color: #475569;
        }
        .item-body .notes {
          font-style: italic;
        }
        .item-amount {
          font-weight: 800;
        }
        .item-amount.upgrade {
          color: #b45309;
        }
        .item-amount.credit {
          color: #15803d;
        }
        .totals {
          margin-top: 30px;
          border-top: 2px solid #0f172a;
          padding-top: 14px;
          font-weight: 700;
          display: grid;
          gap: 4px;
        }
        .totals .net {
          font-size: 18px;
        }
        .signatures {
          margin-top: 60px;
          display: flex;
          justify-content: space-between;
          gap: 40px;
        }
        .sig-line {
          flex: 1;
          border-top: 1px solid #0f172a;
          padding-top: 6px;
          font-size: 13px;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          .page {
            background: white;
            padding: 0;
          }
          .schedule {
            box-shadow: none;
            max-width: none;
          }
        }
      `}</style>
    </>
  );
}
