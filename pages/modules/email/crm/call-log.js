// /pages/modules/email/crm/call-log.js
// Calls & Voicemails register for the CRM

import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { supabase } from "../../../../utils/supabase-client";

function normalisePhoneVariants(raw) {
  if (!raw) return [];
  let s = raw.replace(/[^\d+]/g, "");
  if (!s) return [];
  const variants = new Set();

  if (s.startsWith("+")) {
    variants.add(s);
    variants.add(s.replace("+", ""));
  } else {
    variants.add(s);
    if (s.startsWith("0")) {
      variants.add("+61" + s.slice(1));
    } else {
      variants.add("+61" + s);
    }
  }

  return Array.from(variants);
}

export default function CallLogPage() {
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [calls, setCalls] = useState([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [showVoicemailOnly, setShowVoicemailOnly] = useState(false);

  const filterPhone =
    typeof router.query.phone === "string" ? router.query.phone.trim() : "";

  useEffect(() => {
    (async () => {
      setLoadingUser(true);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) {
        console.error("auth error:", authError);
      }
      if (user) {
        setUserId(user.id);
      }
      setLoadingUser(false);
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadCalls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, filterPhone]);

  async function loadCalls() {
    if (!userId) return;
    setLoadingCalls(true);
    setError("");

    try {
      let query = supabase
        .from("crm_calls")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (filterPhone) {
        const variants = normalisePhoneVariants(filterPhone);
        if (variants.length > 0) {
          const orParts = [];
          variants.forEach((p) => {
            orParts.push(`from_number.eq.${p}`);
            orParts.push(`to_number.eq.${p}`);
          });
          query = query.or(orParts.join(","));
        }
      }

      const { data, error: qError } = await query;
      if (qError) {
        console.error("loadCalls error:", qError);
        setError("Unable to load call log.");
        setCalls([]);
      } else {
        setCalls(data || []);
      }
    } catch (e) {
      console.error("loadCalls fatal error:", e);
      setError("Unable to load call log.");
      setCalls([]);
    }

    setLoadingCalls(false);
  }

  function formatTime(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDuration(value) {
    if (value == null || Number.isNaN(value)) return "-";
    const s = Number(value);
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

  const filteredCalls = calls.filter((call) => {
    if (showVoicemailOnly && !call.recording_url) return false;

    const q = search.trim().toLowerCase();
    if (!q) return true;

    const haystack = [
      call.from_number || "",
      call.to_number || "",
      call.status || "",
      call.direction || "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });

  return (
    <>
      <Head>
        <title>Calls &amp; Voicemails</title>
      </Head>

      <main className="wrap">
        <div className="inner">
          {/* Banner */}
          <div className="banner">
            <div className="banner-left">
              <span className="banner-icon">📞</span>
              <div>
                <h1 className="banner-title">Calls &amp; Voicemails</h1>
                <p className="banner-sub">
                  By default this phone system is{" "}
                  <strong>outgoing only</strong>. Inbound calls and stored
                  voicemails are available when you purchase a{" "}
                  <strong>dedicated number subscription</strong>.
                </p>
              </div>
            </div>

            <div className="banner-right">
              <button
                className="btn back"
                onClick={() => router.push("/modules/email/crm/pipelines")}
              >
                🔙 Back
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="filters-row">
            <input
              type="text"
              className="search-input"
              placeholder="Search by number or status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showVoicemailOnly}
                onChange={(e) => setShowVoicemailOnly(e.target.checked)}
              />
              <span>Show only voicemails</span>
            </label>
            {filterPhone && (
              <div className="filter-pill">
                Filtered by contact: <strong>{filterPhone}</strong>
                <button
                  type="button"
                  onClick={() =>
                    router.push("/modules/email/crm/call-log", undefined, {
                      shallow: true,
                    })
                  }
                >
                  ✕ Clear
                </button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="table-wrap">
            {loadingUser || loadingCalls ? (
              <p className="status-text">Loading calls…</p>
            ) : error ? (
              <p className="status-text error-text">{error}</p>
            ) : filteredCalls.length === 0 ? (
              <p className="status-text">No calls found.</p>
            ) : (
              <table className="calls-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Direction</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Voicemail</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCalls.map((call) => (
                    <tr key={call.id}>
                      <td>{formatTime(call.created_at)}</td>
                      <td className="direction-cell">
                        {call.direction || "call"}
                      </td>
                      <td>{call.from_number || "-"}</td>
                      <td>{call.to_number || "-"}</td>
                      <td>{call.status || "-"}</td>
                      <td>
                        {formatDuration(
                          call.recording_duration || call.duration_seconds
                        )}
                      </td>
                      <td>
                        {call.recording_url ? (
                          <audio
                            controls
                            src={
                              call.recording_url.endsWith(".mp3") ||
                              call.recording_url.endsWith(".wav")
                                ? call.recording_url
                                : `${call.recording_url}.mp3`
                            }
                          />
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      <style jsx>{`
        .wrap {
          background: #020617;
          color: #e5e7eb;
          min-height: 100vh;
          padding: 36px 0;
        }
        .inner {
          width: 1320px;
          margin: 0 auto;
        }
        .banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #0369a1;
          padding: 16px 22px;
          border-radius: 12px;
          margin-bottom: 18px;
        }
        .banner-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .banner-icon {
          font-size: 48px;
          margin-right: 4px;
        }
        .banner-title {
          font-size: 48px;
          font-weight: 600;
          margin: 0 0 4px;
        }
        .banner-sub {
          font-size: 16px;
          margin: 0;
          max-width: 700px;
        }
        .banner-right {
          display: flex;
          gap: 10px;
        }
        .btn {
          border: none;
          border-radius: 6px;
          font-weight: 700;
          color: #fff;
          cursor: pointer;
          width: 130px;
          height: 40px;
          transition: all 0.2s;
          text-align: center;
          font-size: 16px;
        }
        .btn.back {
          background: #111827;
        }
        .btn:hover {
          filter: brightness(1.1);
        }

        .filters-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .search-input {
          flex: 1;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #4b5563;
          background: #020617;
          color: #e5e7eb;
          font-size: 16px;
        }
        .search-input::placeholder {
          color: #6b7280;
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 16px;
        }
        .checkbox-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
        }
        .filter-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #111827;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 15px;
          border: 1px solid #1f2937;
        }
        .filter-pill button {
          border: none;
          background: transparent;
          color: #f87171;
          cursor: pointer;
          font-size: 15px;
        }

        .table-wrap {
          background: #020617;
          border-radius: 12px;
          border: 2px solid rgba(148, 163, 184, 0.2);
          padding: 16px;
        }
        .status-text {
          font-size: 16px;
          text-align: center;
          padding: 20px 0;
        }
        .error-text {
          color: #fecaca;
        }

        .calls-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .calls-table th,
        .calls-table td {
          border-bottom: 1px solid rgba(31, 41, 55, 0.8);
          padding: 10px 8px;
          font-size: 16px;
        }
        .calls-table th {
          text-align: left;
          background: #020617;
        }
        .calls-table tbody tr:hover {
          background: rgba(15, 23, 42, 0.9);
        }
        .direction-cell {
          text-transform: capitalize;
        }
        audio {
          width: 100%;
        }
      `}</style>
    </>
  );
}
