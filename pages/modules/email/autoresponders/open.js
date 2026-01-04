// /pages/modules/email/autoresponders/open.js
// Autoresponder List – view all existing autoresponders for the current user

import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { supabase } from "../../../../utils/supabase-client";

export default function AutoresponderOpen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [autoresponders, setAutoresponders] = useState([]);
  const [lists, setLists] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMessage("You must be logged in.");
        setLoading(false);
        return;
      }

      const { data: listData, error: listError } = await supabase
        .from("lead_lists")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (listError) throw listError;

      const { data: autoresponderData, error: autoError } = await supabase
        .from("email_automations")
        .select(
          "id, name, trigger_type, send_day, send_time, list_id, subject, active_days, created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (autoError) throw autoError;

      setLists(listData || []);
      setAutoresponders(autoresponderData || []);
    } catch (err) {
      console.error("Error loading autoresponders:", err);
      setMessage("Error loading autoresponders: " + (err.message || "Unknown"));
    } finally {
      setLoading(false);
    }
  }

  function getListName(listId) {
    if (!listId) return "All subscribers";
    const match = lists.find((l) => l.id === listId);
    return match ? match.name : "List not found";
  }

  function formatDays(days) {
    if (!Array.isArray(days) || !days.length) return "—";
    if (days.length === 7) return "Every day";
    if (days.length === 5 && !days.includes("Sat") && !days.includes("Sun"))
      return "Weekdays";
    return days.join(", ");
  }

  async function handleDelete(id) {
    if (!confirm("Delete this autoresponder? This cannot be undone.")) return;
    try {
      setMessage("");
      const { error } = await supabase
        .from("email_automations")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setAutoresponders((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Error deleting autoresponder:", err);
      setMessage("Error deleting autoresponder: " + (err.message || "Unknown"));
    }
  }

  return (
    <>
      <Head>
        <title>Autoresponders - GR8 RESULT Digital Solutions</title>
      </Head>

      {/* Banner */}
      <div className="banner-wrapper">
        <div className="banner">
          <div className="banner-left">
            <span className="icon">📨</span>
            <div>
              <h1 className="title">Autoresponders</h1>
              <p className="subtitle">
                View and manage your timed email sequences.
              </p>
            </div>
          </div>
          <div className="banner-actions">
            <button
              className="back"
              onClick={() => router.push("/modules/email")}
            >
              ⟵ Back
            </button>
            <button
              className="create"
              onClick={() => router.push("/modules/email/autoresponders")}
            >
              + New Autoresponder
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="list-wrapper">
        <div className="list-inner">
          {loading ? (
            <p className="info">Loading autoresponders…</p>
          ) : autoresponders.length === 0 ? (
            <div className="empty">
              <p>You don&apos;t have any autoresponders yet.</p>
              <button
                className="create"
                onClick={() => router.push("/modules/email/autoresponders")}
              >
                Create your first autoresponder
              </button>
            </div>
          ) : (
            <>
              <div className="table-header">
                <span>Name</span>
                <span>Subject</span>
                <span>Trigger &amp; Timing</span>
                <span>List</span>
                <span>Days</span>
                <span>Actions</span>
              </div>
              {autoresponders.map((a) => (
                <div key={a.id} className="row">
                  <div className="cell name">
                    <strong>{a.name || "Untitled"}</strong>
                    <span className="created">
                      {a.created_at
                        ? new Date(a.created_at).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                  <div className="cell">{a.subject || "—"}</div>
                  <div className="cell">
                    {a.trigger_type || "—"}
                    <br />
                    <span className="muted">
                      {a.send_day || ""} · {a.send_time || ""}
                    </span>
                  </div>
                  <div className="cell">{getListName(a.list_id)}</div>
                  <div className="cell">{formatDays(a.active_days)}</div>
                  <div className="cell actions">
                    <button
                      className="btn small"
                      onClick={() =>
                        router.push(
                          `/modules/email/editor?autoresponder_id=${a.id}`
                        )
                      }
                    >
                      Edit emails
                    </button>
                    <button
                      className="btn small ghost"
                      onClick={() =>
                        router.push(
                          `/modules/email/autoresponders?autoresponder_id=${a.id}`
                        )
                      }
                    >
                      Edit details
                    </button>
                    <button
                      className="btn small danger"
                      onClick={() => handleDelete(a.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {message && <p className="msg">{message}</p>}
        </div>
      </div>

      <style jsx>{`
        .banner-wrapper {
          display: flex;
          justify-content: center;
          width: 100%;
        }
        .banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: #a855f7;
          width: 1320px;
          border-radius: 12px;
          padding: 20px 28px;
          color: #fff;
          margin-top: 20px;
        }
        .banner-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .banner-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .icon {
          font-size: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }
        .title {
          margin: 0;
          font-size: 36px;
        }
        .subtitle {
          margin: 2px 0 0;
          opacity: 0.9;
          font-size: 20px;
        }
        .create {
          background: #10b981;
          color: #fff;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 16px;
        }
        .back {
          background: #111821;
          color: #e5e7eb;
          border: 1px solid #4b5563;
          padding: 10px 18px;
          border-radius: 999px;
          cursor: pointer;
          font-weight: 500;
          font-size: 16px;
        }

        .list-wrapper {
          display: flex;
          justify-content: center;
          width: 100%;
        }
        .list-inner {
          width: 1320px;
          margin-top: 20px;
          background: #111821;
          border-radius: 12px;
          border: 1px solid #333;
          padding: 24px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        }
        .info {
          color: #e5e7eb;
          font-size: 16px;
        }
        .empty {
          text-align: center;
          color: #e5e7eb;
          display: flex;
          flex-direction: column;
          gap: 12px;
          font-size: 16px;
        }

        .table-header {
          display: grid;
          grid-template-columns: 1.3fr 1.3fr 1.3fr 1fr 0.9fr 1.4fr;
          gap: 16px;
          padding-bottom: 10px;
          margin-bottom: 10px;
          border-bottom: 1px solid #333;
          font-weight: 600;
          color: #f9fafb;
          font-size: 16px;
        }
        .row {
          display: grid;
          grid-template-columns: 1.3fr 1.3fr 1.3fr 1fr 0.9fr 1.4fr;
          gap: 16px;
          padding: 12px 0;
          border-bottom: 1px solid #1f2933;
          align-items: center;
          font-size: 15px;
          color: #e5e7eb;
        }
        .row:last-child {
          border-bottom: none;
        }
        .cell {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .cell.name {
          gap: 4px;
        }
        .created {
          font-size: 16px;
          color: #9ca3af;
        }
        .muted {
          font-size: 16px;
          color: #9ca3af;
        }
        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .btn {
          border: none;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 16px;
          cursor: pointer;
          font-weight: 600;
          background: #2563eb;
          color: #fff;
        }
        .btn.small {
          padding: 8px 12px;
        }
        .btn.ghost {
          background: transparent;
          border: 1px solid #4b5563;
          color: #e5e7eb;
        }
        .btn.danger {
          background: #dc2626;
        }
        .msg {
          margin-top: 14px;
          color: #f97316;
          font-size: 16px;
        }
      `}</style>
    </>
  );
}
