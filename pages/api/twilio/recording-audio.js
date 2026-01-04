// /pages/modules/crm/calls.js
// Simple Call Log page – lists crm_calls and plays recordings in a modal

import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { supabase } from "../../../utils/supabase-client";

export default function CallLogPage() {
  const router = useRouter();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedCall, setSelectedCall] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  function showMsg(t) {
    setMessage(t);
    setTimeout(() => setMessage(""), 8000);
  }

  useEffect(() => {
    loadCalls();
  }, []);

  async function loadCalls() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("crm_calls")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("loadCalls error:", error);
        showMsg(`❌ ${error.message}`);
        setCalls([]);
      } else {
        setCalls(data || []);
      }
    } catch (err) {
      console.error("loadCalls fatal:", err);
      showMsg("❌ Failed to load calls.");
    } finally {
      setLoading(false);
    }
  }

  function openCallModal(call) {
    if (!call?.recording_url) {
      showMsg("⚠️ No recording URL for this call.");
      return;
    }
    setSelectedCall(call);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedCall(null);
  }

  function formatDate(d) {
    if (!d) return "-";
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleString();
  }

  function formatDuration(sec) {
    if (!sec && sec !== 0) return "-";
    const s = Number(sec) || 0;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${rem}s`;
  }

  return (
    <>
      <Head>
        <title>Call Log</title>
      </Head>

      <main className="wrap">
        <div className="inner">
          <div className="banner">
            <div className="banner-left">
              <span className="banner-icon">☎️</span>
              <div>
                <h1 className="banner-title">Call Log</h1>
                <p className="banner-sub">
                  Voicemail recordings and inbound calls.
                </p>
              </div>
            </div>
            <div className="banner-right">
              <button
                className="btn back"
                onClick={() => router.push("/dashboard")}
              >
                🔙 Back
              </button>
              <button className="btn reload" onClick={loadCalls}>
                🔄 Refresh
              </button>
            </div>
          </div>

          {message && <div className="alert">{message}</div>}

          <div className="card">
            {loading ? (
              <p>Loading calls...</p>
            ) : !calls.length ? (
              <p>No calls found.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Direction</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Recording</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id}>
                      <td>{formatDate(call.created_at || call.inserted_at)}</td>
                      <td>{call.direction || "-"}</td>
                      <td>{call.from_number || "-"}</td>
                      <td>{call.to_number || "-"}</td>
                      <td>{call.status || "-"}</td>
                      <td>{formatDuration(call.recording_duration)}</td>
                      <td>
                        {call.recording_url ? (
                          <button
                            className="play-btn"
                            onClick={() => openCallModal(call)}
                          >
                            ▶️ Play
                          </button>
                        ) : (
                          <span className="no-recording">No recording</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {modalOpen && selectedCall && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Call from {selectedCall.from_number || "Unknown"}</h3>
              <p className="modal-meta">
                To: {selectedCall.to_number || "-"} ·{" "}
                {formatDate(selectedCall.created_at || selectedCall.inserted_at)}{" "}
                · Duration: {formatDuration(selectedCall.recording_duration)}
              </p>

              <div className="audio-wrap">
                <audio
                  controls
                  src={`/api/twilio/recording-audio?url=${encodeURIComponent(
                    selectedCall.recording_url
                  )}`}
                >
                  Your browser does not support the audio element.
                </audio>
              </div>

              <div className="modal-actions">
                <button className="btn close" onClick={closeModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .wrap {
          background: #0c121a;
          min-height: 100vh;
          padding: 40px 0;
          color: #fff;
        }
        .inner {
          width: 1320px;
          margin: 0 auto;
        }
        .banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #dc2626;
          padding: 16px 22px;
          border-radius: 12px;
          margin-bottom: 16px;
        }
        .banner-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .banner-icon {
          font-size: 28px;
          margin-right: 8px;
        }
        .banner-right {
          display: flex;
          gap: 12px;
        }
        .banner-title {
          margin: 0;
          font-size: 22px;
        }
        .banner-sub {
          margin: 0;
          font-size: 14px;
          opacity: 0.9;
        }
        .btn {
          border: none;
          border-radius: 6px;
          font-weight: 700;
          color: #fff;
          cursor: pointer;
          height: 40px;
          padding: 0 16px;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .btn.back {
          background: #374151;
        }
        .btn.reload {
          background: #2563eb;
        }
        .btn:hover {
          filter: brightness(1.12);
        }
        .alert {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid #ef4444;
          color: #fecaca;
          padding: 8px 12px;
          border-radius: 6px;
          margin-bottom: 10px;
          text-align: center;
          font-size: 14px;
        }
        .card {
          background: #111827;
          border-radius: 12px;
          border: 2px solid rgba(255, 255, 255, 0.08);
          padding: 16px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        th,
        td {
          padding: 8px 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 14px;
        }
        th {
          text-align: left;
          font-weight: 600;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          opacity: 0.9;
        }
        tr:hover td {
          background: rgba(148, 163, 184, 0.1);
        }
        .play-btn {
          border: none;
          border-radius: 999px;
          padding: 4px 12px;
          font-size: 13px;
          cursor: pointer;
          background: #16a34a;
          color: #fff;
          font-weight: 700;
        }
        .play-btn:hover {
          filter: brightness(1.15);
        }
        .no-recording {
          font-size: 12px;
          opacity: 0.7;
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
        }
        .modal {
          background: #111827;
          border-radius: 12px;
          padding: 20px 22px 18px;
          width: 520px;
          max-width: calc(100% - 40px);
          border: 1px solid rgba(148, 163, 184, 0.4);
        }
        .modal h3 {
          margin: 0 0 6px;
          font-size: 18px;
        }
        .modal-meta {
          margin: 0 0 12px;
          font-size: 13px;
          opacity: 0.85;
        }
        .audio-wrap {
          margin: 10px 0 18px;
          background: #020617;
          border-radius: 10px;
          padding: 10px;
          border: 1px solid rgba(148, 163, 184, 0.4);
        }
        audio {
          width: 100%;
        }
        .modal-actions {
          display: flex;
          justify-content: flex-end;
        }
        .btn.close {
          background: #4b5563;
        }
      `}</style>
    </>
  );
}
