// /components/crm/CallsNotificationBell.js
// Global bell showing unread voicemails across all leads.

import { useEffect, useState } from "react";

export default function CallsNotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCalls, setUnreadCalls] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadUnread() {
    try {
      setLoading(true);
      const res = await fetch("/api/crm/calls?unreadOnly=1&limit=50");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load voicemails.");
      }
      setUnreadCalls(data.calls || []);
    } catch (err) {
      console.error("[CallsNotificationBell] loadUnread error", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUnread();
    const id = setInterval(loadUnread, 30000); // refresh every 30s
    return () => clearInterval(id);
  }, []);

  const count = unreadCalls.length;

  return (
    <>
      <div className="bell-wrapper">
        <button
          className="bell-btn"
          onClick={() => setOpen((o) => !o)}
          title="Unread voicemails"
        >
          <span className="bell-icon">🔔</span>
          {count > 0 && <span className="badge">{count}</span>}
        </button>

        {open && (
          <div className="dropdown">
            <div className="dropdown-header">
              <span>Voicemails</span>
              <button
                className="small-link"
                onClick={() =>
                  (window.location.href = "/modules/email/crm/calls")
                }
              >
                View all
              </button>
            </div>

            {loading && <div className="item">Loading…</div>}

            {!loading && count === 0 && (
              <div className="item">No unread voicemails.</div>
            )}

            {!loading &&
              unreadCalls.map((c) => {
                const created = c.created_at
                  ? new Date(c.created_at).toLocaleString()
                  : "";
                return (
                  <div key={c.id} className="item">
                    <div className="line-bold">
                      {c.from_number || "Unknown number"}
                    </div>
                    <div className="line-sub">{created}</div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <style jsx>{`
        .bell-wrapper {
          position: relative;
          font-size: 16px;
        }
        .bell-btn {
          position: relative;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          color: #e5e7eb;
        }
        .bell-icon {
          pointer-events: none;
        }
        .badge {
          position: absolute;
          top: -2px;
          right: -2px;
          background: #ef4444;
          color: #fee2e2;
          font-size: 11px;
          padding: 1px 5px;
          border-radius: 999px;
          font-weight: 700;
        }
        .dropdown {
          position: absolute;
          right: 0;
          margin-top: 8px;
          width: 260px;
          background: #020617;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.7);
          box-shadow: 0 18px 35px rgba(0, 0, 0, 0.6);
          z-index: 9999;
        }
        .dropdown-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 10px;
          border-bottom: 1px solid rgba(51, 65, 85, 0.9);
          font-weight: 700;
          font-size: 16px;
        }
        .small-link {
          border: none;
          background: transparent;
          color: #38bdf8;
          cursor: pointer;
          font-size: 13px;
        }
        .item {
          padding: 8px 10px;
          border-bottom: 1px solid rgba(31, 41, 55, 0.7);
          font-size: 14px;
        }
        .item:last-child {
          border-bottom: none;
        }
        .line-bold {
          font-weight: 600;
        }
        .line-sub {
          color: #9ca3af;
        }
      `}</style>
    </>
  );
}
