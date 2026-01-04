// /pages/admin/user-approvals.js
// Clean layout + guaranteed correct JSON body sending

import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";

export default function UserApprovals() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/get-pending-users");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load users");
        setUsers(data.users || []);
      } catch (err) {
        alert("Error loading users: " + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleAction(user, type) {
    try {
      const idToSend = user.user_id || user.id;
      console.log("🟢 Sending user_id to API:", idToSend);

      const res = await fetch(`/api/admin/${type}-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: idToSend }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${type} failed`);
      alert(
        type === "approve"
          ? "✅ User approved successfully!"
          : "❌ User rejected successfully!"
      );
      location.reload();
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  return (
    <>
      <Head>
        <title>User Approvals | Gr8 Result Digital Solutions</title>
      </Head>
      <div className="wrap">
        <div className="header">
          <h1>User Approvals</h1>
          <Link href="/admin/dashboard" className="btn back">
            ← Back to Developer Dashboard
          </Link>
        </div>

        {loading ? (
          <p>Loading pending users...</p>
        ) : users.length === 0 ? (
          <p>No pending user applications found.</p>
        ) : (
          <div className="section">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name || "—"}</td>
                    <td>{u.email}</td>
                    <td>{u.company || "—"}</td>
                    <td>
                      {new Date(u.created_at).toLocaleDateString("en-AU")}
                    </td>
                    <td className="actions">
                      <Link href={`/admin/user/${u.id}`} legacyBehavior>
                        <a className="btn blue">View Details</a>
                      </Link>
                      <button
                        onClick={() => handleAction(u, "approve")}
                        className="btn green"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(u, "reject")}
                        className="btn red"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .wrap {
          padding: 30px;
          background: #0c121a;
          color: #fff;
          min-height: 100vh;
        }
        .header {
          background: #f97316;
          padding: 14px 20px;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .btn {
          text-decoration: none;
          border: none;
          border-radius: 6px;
          font-weight: 700;
          padding: 8px 14px;
          cursor: pointer;
          color: #fff;
          transition: 0.2s;
          font-size: 14px;
          margin-right: 8px;
          display: inline-block;
          white-space: nowrap;
        }
        .btn.back {
          background: #111827;
          border: 1px solid #fff;
        }
        .btn.back:hover {
          background: #1e293b;
        }
        .btn.blue {
          background: #2563eb;
        }
        .btn.blue:hover {
          background: #1d4ed8;
        }
        .btn.green {
          background: #16a34a;
        }
        .btn.green:hover {
          background: #15803d;
        }
        .btn.red {
          background: #dc2626;
        }
        .btn.red:hover {
          background: #b91c1c;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th,
        td {
          padding: 12px 10px;
          border-bottom: 1px solid #1f2937;
          text-align: left;
        }
        th {
          background: #111827;
          font-weight: 700;
        }
        td {
          background: #0f172a;
        }
        td.actions {
          white-space: nowrap;
        }
      `}</style>
    </>
  );
}
