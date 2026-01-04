// /pages/modules/email/previews.js
// ✅ GR8 RESULT – Corrected path + placeholder grid + working previews (folder structure: user_id/finished-emails)

import { useEffect, useState } from "react";
import Head from "next/head";
import { supabase } from "../../../utils/supabase-client";

export default function EmailPreviews() {
  const [user, setUser] = useState(null);
  const [emails, setEmails] = useState([]);
  const [previewHTML, setPreviewHTML] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) console.error("Auth error:", error);
    if (data?.user) {
      setUser(data.user);
      loadEmails(data.user.id);
    }
  }

  async function loadEmails(userId) {
    try {
      const { data, error } = await supabase.storage
        .from("email-user-assets")
        .list(`${userId}/finished-emails`, { limit: 20 });

      if (error) {
        console.error("Error loading emails:", error);
        return;
      }

      const htmlFiles = data?.filter((f) => f.name.endsWith(".html")) || [];
      setEmails(htmlFiles);
    } catch (err) {
      console.error("Unexpected error:", err);
    }
  }

  async function handlePreview(emailName) {
    if (!user) return;
    try {
      const { data, error } = await supabase.storage
        .from("email-user-assets")
        .download(`${user.id}/finished-emails/${emailName}`);

      if (error) {
        console.error("Download error:", error);
        return;
      }

      const htmlText = await data.text();
      setPreviewHTML(htmlText);
      setModalOpen(true);
    } catch (err) {
      console.error("Preview error:", err);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setPreviewHTML("");
  }

  const placeholders = new Array(4).fill(null);

  return (
    <>
      <Head>
        <title>Email Previews • GR8 RESULT</title>
      </Head>
      <main style={styles.main}>
        <h1 style={styles.title}>My Saved Emails</h1>

        {!user ? (
          <p style={styles.text}>Loading user...</p>
        ) : emails.length === 0 ? (
          <div style={styles.grid}>
            {placeholders.map((_, i) => (
              <div key={i} style={styles.cardEmpty}>
                <p style={styles.cardTitle}>Placeholder {i + 1}</p>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.grid}>
            {emails.map((email, i) => (
              <div key={i} style={styles.card}>
                <div style={styles.cardInner}>
                  <div style={styles.cardBody}>
                    <p style={styles.cardTitle}>{email.name}</p>
                  </div>
                  <div
                    style={styles.overlay}
                    onClick={() => handlePreview(email.name)}
                  >
                    <button style={styles.previewBtn}>Preview</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {modalOpen && (
          <div style={styles.modalOverlay} onClick={closeModal}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <button style={styles.closeBtn} onClick={closeModal}>
                ✖
              </button>
              <iframe
                srcDoc={previewHTML}
                style={styles.iframe}
                title="Email Preview"
              />
            </div>
          </div>
        )}
      </main>
    </>
  );
}

const styles = {
  main: {
    background: "#0c121a",
    color: "#fff",
    minHeight: "100vh",
    padding: "40px 0",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  title: { fontSize: "28px", fontWeight: 900, marginBottom: "24px" },
  text: { opacity: 0.8, fontSize: "16px" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: "20px",
    maxWidth: "1320px",
    width: "100%",
    padding: "0 20px",
  },
  card: {
    position: "relative",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    overflow: "hidden",
    cursor: "pointer",
    height: "220px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardEmpty: {
    position: "relative",
    background: "rgba(255,255,255,0.05)",
    border: "1px dashed rgba(255,255,255,0.2)",
    borderRadius: "12px",
    height: "220px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardInner: {
    position: "relative",
    width: "100%",
    height: "100%",
    textAlign: "center",
  },
  cardBody: {
    padding: "20px",
  },
  cardTitle: {
    fontWeight: "bold",
    color: "#22c55e",
    fontSize: "16px",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0,
    transition: "opacity 0.3s ease",
  },
  previewBtn: {
    background: "#22c55e",
    border: "none",
    borderRadius: "10px",
    padding: "10px 20px",
    fontWeight: "bold",
    color: "#fff",
    cursor: "pointer",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "rgba(0,0,0,0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modalContent: {
    position: "relative",
    width: "80%",
    maxWidth: "900px",
    background: "#fff",
    borderRadius: "10px",
    overflow: "hidden",
  },
  closeBtn: {
    position: "absolute",
    top: "10px",
    right: "10px",
    background: "#22c55e",
    border: "none",
    color: "#fff",
    fontWeight: "bold",
    borderRadius: "50%",
    width: "30px",
    height: "30px",
    cursor: "pointer",
  },
  iframe: {
    width: "100%",
    height: "80vh",
    border: "none",
  },
};
