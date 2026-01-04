// pages/modules/phone/calls.js
// Calls & Voicemails – lists inbound calls stored in crm_calls

import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "../../../utils/supabase-client";

export default function PhoneCallsPage() {
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState([]);
  const [error, setError] = useState("");
  const [selectedCallId, setSelectedCallId] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("auth error:", error);
        setError("Unable to load user.");
        setLoading(false);
        return;
      }
      if (!data?.user) {
        setError("No user logged in.");
        setLoading(false);
        return;
      }

      const uid = data.user.id;
      setUserId(uid);

      const { data: callRows, error: callsErr } = await supabase
        .from("crm_calls")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (callsErr) {
        console.error("crm_calls error:", callsErr);
        setError("There was an error loading calls.");
        setCalls([]);
      } else {
        setCalls(callRows || []);
      }

      setLoading(false);
    };

    load();
  }, []);

  const hasCalls = calls && calls.length > 0;

  function formatDateTime(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("en-AU", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDuration(seconds) {
    if (seconds == null || Number.isNaN(seconds)) return "-";
    const s = Number(seconds);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}h ${remM}m`;
    }
    return `${m}m ${rem}s`;
  }

  return (
    <>
      <Head>
        <title>Calls & Voicemails</title>
      </Head>

      <main style={styles.main}>
        {/* MAIN 1320 BANNER */}
        <div style={styles.banner}>
          <div style={styles.bannerLeft}>
            <div style={styles.iconCircle}>📞</div>

            <div>
              <div style={styles.bannerTitle}>Calls &amp; Voicemails</div>
              <div style={styles.bannerSubtitle}>
                Recorded inbound calls from your Twilio phone number.
              </div>
            </div>
          </div>

          <Link href="/store/dashboard" style={styles.backBtn}>
            ← Back
          </Link>
        </div>

        {/* SUB-BANNER STRIP */}
        <div style={styles.subBanner}>
          {!hasCalls && !loading && !error && (
            <span>
              No calls recorded yet. Once someone calls your Twilio number, new
              voicemails will appear here.
            </span>
          )}
          {loading && <span>Loading calls…</span>}
          {error && <span style={{ color: "#fee2e2" }}>{error}</span>}
          {hasCalls && !loading && !error && (
            <span>
              Showing {calls.length} call
              {calls.length === 1 ? "" : "s"} recorded on your Twilio number.
            </span>
          )}
        </div>

        {/* CALL LIST */}
        <div style={styles.listWrap}>
          {hasCalls ? (
            calls.map((call) => {
              const isSelected = call.id === selectedCallId;
              return (
                <div
                  key={call.id}
                  style={{
                    ...styles.callRow,
                    borderColor: isSelected
                      ? "#22c55e"
                      : "rgba(148,163,184,0.35)",
                    boxShadow: isSelected
                      ? "0 0 0 1px #22c55e, 0 12px 30px rgba(0,0,0,0.8)"
                      : "0 10px 24px rgba(0,0,0,0.7)",
                  }}
                  onClick={() =>
                    setSelectedCallId((prev) =>
                      prev === call.id ? null : call.id
                    )
                  }
                >
                  <div style={styles.callRowMain}>
                    <div style={styles.callRowIcon}>
                      {call.status === "completed" ? "✅" : "📞"}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.callTitle}>
                        From:{" "}
                        {call.from_number || call.from || "Unknown caller"}
                      </div>
                      <div style={styles.callSub}>
                        To: {call.to_number || call.to || "Your number"} •{" "}
                        {formatDateTime(call.created_at || call.call_time)}
                      </div>
                    </div>

                    <div style={styles.callMeta}>
                      <span style={styles.metaChip}>
                        {formatDuration(call.duration_seconds)}
                      </span>
                      <span style={styles.metaChip}>
                        {call.status || "voicemail"}
                      </span>
                    </div>
                  </div>

                  {/* DETAILS + PLAYER */}
                  {isSelected && (
                    <div style={styles.callDetails}>
                      {call.recording_url ? (
                        <>
                          <div style={styles.detailLabel}>Voicemail audio</div>
                          <audio
                            controls
                            style={{ width: "100%", marginBottom: 8 }}
                            src={
                              call.recording_url.endsWith(".mp3") ||
                              call.recording_url.endsWith(".wav")
                                ? call.recording_url
                                : `${call.recording_url}.mp3`
                            }
                          />
                        </>
                      ) : (
                        <div style={styles.detailLabel}>
                          No recording URL stored for this call.
                        </div>
                      )}

                      {call.transcription && (
                        <div style={{ marginTop: 4 }}>
                          <div style={styles.detailLabel}>Transcript</div>
                          <p style={styles.transcriptText}>
                            {call.transcription}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            !loading &&
            !error && (
              <div style={styles.emptyStateCard}>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                  Waiting for your first call…
                </div>
                <p style={{ margin: 0, opacity: 0.9 }}>
                  Point your Twilio number at{" "}
                  <code style={styles.code}>
                    https://gr8result.io/api/twilio/voice-inbound
                  </code>{" "}
                  and any new voicemails will show up here automatically.
                </p>
              </div>
            )
          )}
        </div>
      </main>
    </>
  );
}

const styles = {
  main: {
    background: "#020617",
    color: "#e5e7eb",
    minHeight: "100vh",
    paddingTop: 24,
    paddingBottom: 40,
    fontFamily:
      'Arial, "Helvetica Neue", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  // 1320 banner
  banner: {
    width: "1320px",
    margin: "0 auto 22px",
    padding: "26px 32px",
    borderRadius: "18px",
    background: "#22c55e",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 14px 36px rgba(0,0,0,0.7)",
  },

  bannerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 18,
  },

  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 14,
    background: "rgba(0,0,0,0.22)",
    display: "grid",
    placeItems: "center",
    fontSize: 32,
  },

  bannerTitle: {
    fontSize: 48,
    lineHeight: "48px",
    fontWeight: 900,
    marginBottom: 6,
    color: "#0b1120",
  },

  bannerSubtitle: {
    fontSize: 16,
    opacity: 0.95,
    color: "#022c22",
  },

  backBtn: {
    background: "rgba(0,0,0,0.20)",
    padding: "10px 20px",
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 700,
    color: "#ffffff",
    textDecoration: "none",
    border: "1px solid rgba(255,255,255,0.25)",
  },

  // sub-banner / info strip
  subBanner: {
    width: "1320px",
    margin: "0 auto 18px",
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid rgba(34,197,94,0.6)",
    background:
      "linear-gradient(135deg, rgba(22,163,74,0.22), rgba(15,23,42,0.95))",
    fontSize: 14,
  },

  listWrap: {
    width: "1320px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  callRow: {
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.35)",
    padding: "12px 16px",
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(15,23,42,0.9))",
    cursor: "pointer",
    transition: "transform 0.1s ease, box-shadow 0.1s ease, border-color 0.1s",
  },

  callRowMain: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  callRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    background: "rgba(34,197,94,0.16)",
    display: "grid",
    placeItems: "center",
    fontSize: 18,
  },

  callTitle: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  callSub: {
    fontSize: 13,
    opacity: 0.8,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  callMeta: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
    marginLeft: 12,
  },

  metaChip: {
    fontSize: 12,
    padding: "3px 8px",
    borderRadius: 999,
    background: "rgba(148,163,184,0.2)",
  },

  callDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTop: "1px dashed rgba(148,163,184,0.35)",
    fontSize: 13,
  },

  detailLabel: {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 4,
    opacity: 0.9,
  },

  transcriptText: {
    margin: 0,
    lineHeight: 1.5,
    opacity: 0.92,
    whiteSpace: "pre-wrap",
  },

  emptyStateCard: {
    borderRadius: 16,
    padding: "18px 20px",
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.96), rgba(15,23,42,0.9))",
    border: "1px dashed rgba(148,163,184,0.4)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.7)",
  },

  code: {
    fontFamily: "monospace",
    padding: "2px 4px",
    borderRadius: 4,
    background: "rgba(15,23,42,0.9)",
    border: "1px solid rgba(148,163,184,0.4)",
  },
};
