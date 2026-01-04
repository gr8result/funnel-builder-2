// /pages/modules/email/lists/[id].js
// ✅ Enhanced CRM-enabled List Details Page

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "../../../../utils/supabase-client";

export default function ListDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [list, setList] = useState(null);
  const [subscribers, setSubscribers] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);
  const [notes, setNotes] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchListAndSubs();
  }, [id]);

  const fetchListAndSubs = async () => {
    setLoading(true);
    const { data: listData, error: listError } = await supabase
      .from("email_lists")
      .select("*")
      .eq("id", id)
      .single();
    if (listError) return console.error(listError);
    setList(listData);

    const { data: subsData, error: subsError } = await supabase
      .from("email_list_members")
      .select("id, name, email, company, phone, created_at")
      .eq("list_id", id)
      .order("created_at", { ascending: false });
    if (subsError) return console.error(subsError);

    setSubscribers(subsData || []);
    setLoading(false);
  };

  const fetchNotes = async (subId) => {
    const { data, error } = await supabase
      .from("lead_notes")
      .select("*")
      .eq("lead_id", subId)
      .order("created_at", { ascending: false });
    if (!error) setNotes(data || []);
  };

  const fetchFollowups = async (subId) => {
    const { data, error } = await supabase
      .from("lead_followups")
      .select("*")
      .eq("lead_id", subId)
      .order("created_at", { ascending: false });
    if (!error) setFollowups(data || []);
  };

  const selectSubscriber = async (s) => {
    setSelectedSub(s);
    await fetchNotes(s.id);
    await fetchFollowups(s.id);
  };

  const addNote = async () => {
    if (!newNote.trim() || !selectedSub) return;
    const user = await supabase.auth.getUser();
    const { error } = await supabase.from("lead_notes").insert([
      {
        user_id: user.data.user.id,
        lead_id: selectedSub.id,
        note: newNote.trim(),
      },
    ]);
    if (!error) {
      setNewNote("");
      fetchNotes(selectedSub.id);
    }
  };

  const addFollowup = async () => {
    if (!nextDate || !selectedSub) return;
    const user = await supabase.auth.getUser();
    const { error } = await supabase.from("lead_followups").insert([
      {
        user_id: user.data.user.id,
        lead_id: selectedSub.id,
        next_contact_date: nextDate,
      },
    ]);
    if (!error) {
      setNextDate("");
      fetchFollowups(selectedSub.id);
    }
  };

  const handleDelete = async (subscriberId) => {
    if (!confirm("Delete this subscriber permanently?")) return;
    const { error } = await supabase
      .from("email_list_members")
      .delete()
      .eq("id", subscriberId);
    if (!error)
      setSubscribers((prev) => prev.filter((s) => s.id !== subscriberId));
  };

  return (
    <>
      <Head>
        <title>Email • List Detail</title>
      </Head>

      <main className="wrap">
        <div className="inner">
          {/* Banner */}
          <div className="banner cyan">
            <span className="banner-icon">📋</span>
            <h1 className="banner-title">{list ? list.name : "Loading..."}</h1>
            <Link href="/modules/email/lists" className="btn back">
              ← Back to Lists
            </Link>
          </div>

          {/* Table */}
          {loading ? (
            <p>Loading subscribers...</p>
          ) : subscribers.length === 0 ? (
            <p>No subscribers yet.</p>
          ) : (
            <table className="subs-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Business</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => (
                  <tr
                    key={s.id}
                    className={selectedSub?.id === s.id ? "active" : ""}
                  >
                    <td>{s.name || "-"}</td>
                    <td>{s.company || "-"}</td>
                    <td>{s.email}</td>
                    <td>{s.phone || "-"}</td>
                    <td>
                      {new Date(s.created_at).toLocaleDateString()}{" "}
                      {new Date(s.created_at).toLocaleTimeString()}
                    </td>
                    <td className="actions-cell">
                      <button
                        onClick={() => selectSubscriber(s)}
                        className="btn small edit"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="btn small danger"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Details Drawer */}
          {selectedSub && (
            <div className="drawer">
              <div className="drawer-header">
                <h2>{selectedSub.name || selectedSub.email}</h2>
                <button className="close-btn" onClick={() => setSelectedSub(null)}>
                  ✖
                </button>
              </div>

              <div className="drawer-section">
                <h3>Notes</h3>
                <textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
                <button className="btn green" onClick={addNote}>
                  + Add Note
                </button>
                <div className="note-list">
                  {notes.length === 0 && <p>No notes yet.</p>}
                  {notes.map((n) => (
                    <div key={n.id} className="note">
                      <p>{n.note}</p>
                      <small>
                        {new Date(n.created_at).toLocaleString()}
                      </small>
                    </div>
                  ))}
                </div>
              </div>

              <div className="drawer-section">
                <h3>Follow-Ups</h3>
                <input
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                />
                <button className="btn blue" onClick={addFollowup}>
                  + Schedule Follow-Up
                </button>
                <div className="followup-list">
                  {followups.length === 0 && <p>No follow-ups yet.</p>}
                  {followups.map((f) => (
                    <div key={f.id} className="followup">
                      <p>Next Contact: {f.next_contact_date}</p>
                      <small>
                        Added: {new Date(f.created_at).toLocaleString()}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          background: #0c121a;
          color: #fff;
          padding: 24px 0 36px;
        }
        .inner {
          width: 90%;
          max-width: 1320px;
          margin: 0 auto;
        }
        .banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px;
          border-radius: 12px;
          margin-bottom: 24px;
        }
        .banner.cyan {
          background: #06b6d4;
          border: 2px solid #0891b2;
        }
        .btn.back {
          background: #374151;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          text-decoration: none;
        }
        .subs-table {
          width: 100%;
          border-collapse: collapse;
        }
        .subs-table th,
        .subs-table td {
          text-align: left;
          padding: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }
        .actions-cell {
          display: flex;
          gap: 8px;
        }
        .btn.small {
          padding: 6px 12px;
          font-size: 13px;
          border-radius: 6px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          color: #fff;
        }
        .btn.edit {
          background: #2563eb;
        }
        .btn.danger {
          background: #dc2626;
        }
        .drawer {
          margin-top: 24px;
          background: #111827;
          border: 1px solid #1f2937;
          border-radius: 12px;
          padding: 20px;
        }
        .drawer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .drawer-section {
          margin-top: 20px;
        }
        textarea {
          width: 100%;
          background: #0f172a;
          color: #fff;
          padding: 10px;
          border: 1px solid #1f2937;
          border-radius: 8px;
          margin-bottom: 8px;
        }
        input[type="date"] {
          width: 100%;
          background: #0f172a;
          color: #fff;
          padding: 10px;
          border: 1px solid #1f2937;
          border-radius: 8px;
          margin-bottom: 8px;
        }
        .btn.green {
          background: #22c55e;
          color: #fff;
          margin-bottom: 10px;
        }
        .btn.blue {
          background: #3b82f6;
          color: #fff;
          margin-bottom: 10px;
        }
        .note,
        .followup {
          background: #1f2937;
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 6px;
        }
      `}</style>
    </>
  );
}
