// /components/crm/CallsWidget.js
// Dashboard card: unread voicemails, today's calls, missed calls (inbound with no recording)

import { useEffect, useState } from "react";

export default function CallsWidget() {
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [missed, setMissed] = useState(0);
  const [error, setError] = useState("");

  async function loadStats() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/crm/calls?limit=500");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load calls.");
      }

      const calls = data.calls || [];
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      let unreadCount = 0;
      let todayCount = 0;
      let missedCount = 0;

      calls.forEach((c) => {
        if (c.unread) unreadCount += 1;

        if (c.created_at && c.created_at.startsWith(todayStr)) {
          todayCount += 1;
        }

        if (
          c.direction === "inbound" &&
          !c.recording_url &&
          c.created_at &&
          c.created_at.startsWith(todayStr)
        ) {
          missedCount += 1;
        }
      });

      setUnread(unreadCount);
      setTodayTotal(todayCount);
      setMissed(missedCount);
    } catch (err) {
      console.error("[CallsWidget] loadStats error", err);
      setError(err.message || "Failed to load call stats.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <>
      <div className="card">
        <div className="card-header">
          <span className="title">Calls & Voicemails</span>
          <button className="refresh" onClick={loadStats}>
            ⟳
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="metrics">
          <div className="metric">
            <div className="label">Unread voicemails</div>
            <div className="value">{loading ? "…" : unread}</div>
          </div>
          <div className="metric">
            <div className="label">Today&apos;s calls</div>
            <div className="value">{loading ? "…" : todayTotal}</div>
          </div>
          <div className="metric">
            <div className="label">Today&apos;s missed</div>
            <div className="value">{loading ? "…" : missed}</div>
          </div>
        </div>

        <div className="footer">
          <a href="/modules/email/crm/calls" className="link">
            View full call log →
          </a>
        </div>
      </div>

      <style jsx>{`
        .card {
          background: #020617;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.5);
          padding: 14px 16px;
          color: #e5e7eb;
          font-size: 16px;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .title {
          font-weight: 700;
        }
        .refresh {
          border: none;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
          font-size: 18px;
        }
        .metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }
        .metric {
          background: #0f172a;
          border-radius: 8px;
          padding: 8px;
        }
        .label {
          font-size: 14px;
          color: #9ca3af;
          margin-bottom: 4px;
        }
        .value {
          font-size: 20px;
          font-weight: 700;
        }
        .footer {
          text-align: right;
        }
        .link {
          color: #38bdf8;
          text-decoration: none;
          font-size: 14px;
        }
        .link:hover {
          text-decoration: underline;
        }
        .error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid #f97373;
          color: #fecaca;
          padding: 6px 8px;
          border-radius: 6px;
          font-size: 14px;
          margin-bottom: 8px;
        }
      `}</style>
    </>
  );
}
