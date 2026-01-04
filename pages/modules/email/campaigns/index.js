// /pages/modules/email/campaigns/index.js
// FULL REPLACEMENT — adds "Process Queue" button (sends queued jobs via /api/email/process-campaign-queue)
// ✅ Keeps your banner/layout/styles
// ✅ Open works (id + campaign_id)
// ✅ Send Now queues only
// ✅ Process Queue pushes due queued emails to SendGrid (uses env.local like broadcasts)

import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { supabase } from "../../../../utils/supabase-client";

export default function CampaignsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);

  const [dkimVerified, setDkimVerified] = useState(null);
  const [dkimDomain, setDkimDomain] = useState("");

  const [sendingId, setSendingId] = useState(null);
  const [processingQueue, setProcessingQueue] = useState(false);

  const [listNameMap, setListNameMap] = useState({});
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        setUserId(user.id);

        const { data: account } = await supabase
          .from("accounts")
          .select("dkim_verified, dkim_domain")
          .eq("user_id", user.id)
          .maybeSingle();

        if (account) {
          setDkimVerified(!!account.dkim_verified);
          setDkimDomain(account.dkim_domain || "");
        } else {
          setDkimVerified(false);
          setDkimDomain("");
        }

        const { data: rows, error: campError } = await supabase
          .from("email_campaigns")
          .select(
            `
              id,
              user_id,
              name,
              status,
              created_at,
              from_name,
              from_email,
              subscriber_list_id,
              subscriber_list_name,
              send_to_all,
              extra_recipients,
              email1_subject,
              email2_subject,
              email3_subject
            `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (campError) {
          console.error("Error loading campaigns:", campError);
          setCampaigns([]);
          return;
        }

        const listIds = Array.from(
          new Set((rows || []).map((r) => r.subscriber_list_id).filter(Boolean))
        );

        let map = {};
        if (listIds.length) {
          const { data: lists, error: listsErr } = await supabase
            .from("lead_lists")
            .select("id,name")
            .in("id", listIds);

          if (!listsErr && lists) {
            for (const l of lists) map[l.id] = l.name || "";
          } else if (listsErr) {
            console.warn("Could not load lead_lists names:", listsErr);
          }
        }

        setListNameMap(map);
        setCampaigns(rows || []);
      } catch (err) {
        console.error("Campaigns page load error:", err);
        setCampaigns([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const formatDate = (iso) => {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return "-";
    }
  };

  const audienceLabel = useMemo(() => {
    return (c) => {
      if (c.send_to_all) return "All contacts";
      if (c.subscriber_list_id && listNameMap[c.subscriber_list_id]) {
        return listNameMap[c.subscriber_list_id];
      }
      if (c.subscriber_list_name) return c.subscriber_list_name;
      if (c.subscriber_list_id) return `List ${c.subscriber_list_id}`;
      if (c.extra_recipients) return "Custom emails";
      return "-";
    };
  }, [listNameMap]);

  const getApiBase = () => {
    if (typeof window === "undefined") return "";
    return window.location.origin || "";
  };

  const handleSendNow = async (id) => {
    if (!id) return alert("Missing campaign ID.");
    if (sendingId) return;

    if (
      !window.confirm(
        "Start this campaign now?\n\nEmail 1 queues immediately.\nEmail 2/3 follow your delays."
      )
    ) {
      return;
    }

    setSendingId(id);

    try {
      const apiUrl = `${getApiBase()}/api/email/run-campaigns`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ campaign_id: id }),
      });

      const raw = await res.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(
          (data && (data.error || data.message)) ||
            raw ||
            `HTTP ${res.status} ${res.statusText}`
        );
      }

      alert(
        `Queued.\n\nRecipients: ${data?.recipients ?? "?"}\nJobs queued: ${
          data?.queued_jobs ?? "?"
        }\nInvalid emails: ${data?.invalid_recipients ?? 0}`
      );

      router.reload();
    } catch (err) {
      console.error("Send Now error:", err);
      alert("SEND FAILED:\n\n" + String(err?.message || "Unknown error"));
    } finally {
      setSendingId(null);
    }
  };

  const handleProcessQueue = async () => {
    if (processingQueue) return;

    setProcessingQueue(true);
    try {
      const apiUrl = `${getApiBase()}/api/email/process-campaign-queue`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ limit: 25 }),
      });

      const raw = await res.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(
          (data && (data.error || data.message)) ||
            raw ||
            `HTTP ${res.status} ${res.statusText}`
        );
      }

      alert(
        `Queue processed.\n\nProcessed: ${data?.processed ?? 0}\nSent: ${
          data?.sent ?? 0
        }\nFailed: ${data?.failed ?? 0}`
      );

      router.reload();
    } catch (e) {
      console.error("Process queue error:", e);
      alert("QUEUE PROCESS FAILED:\n\n" + String(e?.message || "Unknown error"));
    } finally {
      setProcessingQueue(false);
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;
    if (!window.confirm("Delete this campaign? This cannot be undone.")) return;

    try {
      let q = supabase.from("email_campaigns").delete().eq("id", id);
      if (userId) q = q.eq("user_id", userId);

      const { error } = await q;

      if (error) {
        console.error("Delete error:", error);
        return alert("Could not delete campaign.");
      }

      setCampaigns((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Delete error:", err);
      alert("Could not delete campaign.");
    }
  };

  const openCampaign = (id) => {
    if (!id) return router.push("/modules/email/campaigns/new");
    const qs = `id=${encodeURIComponent(String(id))}&campaign_id=${encodeURIComponent(
      String(id)
    )}`;
    router.push(`/modules/email/campaigns/new?${qs}`);
  };

  return (
    <>
      <Head>
        <title>Email Campaigns — GR8 RESULT</title>
      </Head>

      <main style={page.wrap}>
        <div style={page.center}>
          {dkimVerified === false && (
            <div style={page.dkimBarWarning}>
              <span>
                ⚠ DKIM not verified. Your campaigns may not be delivered. Please
                verify your sending domain.
              </span>
              <button
                style={page.dkimBtn}
                onClick={() => router.push("/account")}
              >
                Fix Now
              </button>
            </div>
          )}

          {dkimVerified === true && (
            <div style={page.dkimBarOk}>
              ✅ Your domain{" "}
              <span style={{ fontWeight: 800 }}>
                {dkimDomain || "your domain"}
              </span>{" "}
              has now been fully verified and campaigns can send authenticated
              emails.
            </div>
          )}

          <div style={page.banner}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 32 }}>📣</span>
              <div>
                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>
                  Campaigns
                </h1>
                <p style={{ margin: 0, fontSize: 18 }}>
                  View and manage your email series.
                </p>
              </div>
            </div>

            <div style={page.bannerActions}>
              <button
                style={page.processBtn}
                onClick={handleProcessQueue}
                type="button"
                disabled={processingQueue}
              >
                {processingQueue ? "Processing…" : "Process Queue"}
              </button>

              <button
                style={page.newBtn}
                onClick={() => openCampaign(null)}
                type="button"
              >
                + New Campaign
              </button>
            </div>
          </div>

          <div style={page.card}>
            {loading ? (
              <p style={{ fontSize: 18 }}>Loading campaigns…</p>
            ) : campaigns.length === 0 ? (
              <p style={{ fontSize: 18 }}>
                No campaigns yet. Click <strong>New Campaign</strong> to create
                your first sequence.
              </p>
            ) : (
              <table style={page.table}>
                <thead>
                  <tr>
                    <th style={page.th}>Name</th>
                    <th style={page.th}>From</th>
                    <th style={page.th}>Audience</th>
                    <th style={page.th}>Emails</th>
                    <th style={page.th}>Status</th>
                    <th style={page.th}>Created</th>
                    <th style={page.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id}>
                      <td style={page.td}>{c.name || "Untitled campaign"}</td>
                      <td style={page.td}>
                        {c.from_name || c.from_email ? (
                          <span>
                            {c.from_name || ""}
                            {c.from_name && c.from_email ? " " : ""}
                            {c.from_email ? `<${c.from_email}>` : ""}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td style={page.td}>{audienceLabel(c)}</td>
                      <td style={page.td}>
                        {[c.email1_subject, c.email2_subject, c.email3_subject]
                          .filter(Boolean)
                          .length || 0}
                      </td>
                      <td style={page.td}>{c.status || "draft"}</td>
                      <td style={page.td}>{formatDate(c.created_at)}</td>
                      <td style={page.td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            style={page.sendBtn}
                            onClick={() => handleSendNow(c.id)}
                            disabled={sendingId === c.id}
                          >
                            {sendingId === c.id ? "Queuing…" : "Send Now"}
                          </button>
                          <button
                            type="button"
                            style={page.openBtn}
                            onClick={() => openCampaign(c.id)}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            style={page.deleteBtn}
                            onClick={() => handleDelete(c.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

const page = {
  wrap: {
    minHeight: "100vh",
    background: "#020617",
    padding: "24px 16px 40px",
    color: "#fff",
    fontSize: 18,
  },
  center: { maxWidth: 1320, margin: "0 auto" },
  dkimBarWarning: {
    maxWidth: 1320,
    margin: "0 auto 12px",
    background: "#78350f",
    color: "#fff7ed",
    borderRadius: 8,
    padding: "8px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 18,
  },
  dkimBarOk: {
    maxWidth: 1320,
    margin: "0 auto 12px",
    background: "#064e3b",
    color: "#a7f3d0",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 18,
    fontWeight: 700,
    textAlign: "center",
    border: "1px solid #10b981",
  },
  dkimBtn: {
    background: "#f97316",
    border: "none",
    color: "#fff",
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 18,
    cursor: "pointer",
    fontWeight: 600,
  },
  banner: {
    maxWidth: 1320,
    margin: "0 auto 20px",
    background: "#0ea5e9",
    borderRadius: 14,
    padding: "18px 22px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#fff",
  },
  bannerActions: { display: "flex", gap: 8, alignItems: "center" },
  newBtn: {
    background: "#16a34a",
    border: "none",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 18,
    cursor: "pointer",
    fontWeight: 700,
    color: "#fff",
  },
  processBtn: {
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 18,
    cursor: "pointer",
    fontWeight: 700,
    color: "#e5e7eb",
  },
  card: {
    maxWidth: 1320,
    margin: "0 auto",
    background: "#020617",
    borderRadius: 14,
    padding: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
    border: "1px solid #0f172a",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 18 },
  th: {
    textAlign: "left",
    padding: "10px 8px",
    borderBottom: "1px solid #1f2937",
    fontWeight: 700,
    fontSize: 18,
  },
  td: {
    padding: "8px 8px",
    borderBottom: "1px solid #111827",
    fontSize: 18,
  },
  sendBtn: {
    background: "#16a34a",
    border: "none",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 16,
    cursor: "pointer",
    color: "#fff",
    fontWeight: 600,
  },
  openBtn: {
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 16,
    cursor: "pointer",
    color: "#e5e7eb",
    fontWeight: 600,
  },
  deleteBtn: {
    background: "#b91c1c",
    border: "none",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 16,
    cursor: "pointer",
    color: "#fff",
    fontWeight: 600,
  },
};
