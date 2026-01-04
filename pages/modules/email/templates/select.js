// /pages/modules/email/templates/select.js
import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function TemplateSelector() {
  const router = useRouter();
  const [savedEmails, setSavedEmails] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // DELETE MODAL STATE
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [emailToDelete, setEmailToDelete] = useState(null);

  useEffect(() => {
    loadUserEmails();
    loadTemplates();
  }, []);

  // ===== LOAD USER'S SAVED EMAILS (HTML + PNG) =====
  async function loadUserEmails() {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return;

      const { data: files, error } = await supabase.storage
        .from("email-user-assets")
        .list(`${userId}/finished-emails`, { limit: 1000 });

      if (error) {
        console.error(error);
        return;
      }

      const htmlFiles = (files || []).filter((f) => f.name.endsWith(".html"));

      const all = await Promise.all(
        htmlFiles.map(async (file) => {
          const base = file.name.replace(".html", "");
          const path = `${userId}/finished-emails/${file.name}`;

          // get fresh HTML directly from storage (no CDN cache)
          let html = "";
          try {
            const { data: fileData } = await supabase.storage
              .from("email-user-assets")
              .download(path);
            if (fileData) {
              html = await fileData.text();
            }
          } catch (e) {
            console.error("Error downloading html", e);
          }

          // PNG thumbnail (add ?v= to avoid showing old cached image)
          const thumbUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-user-assets/${userId}/finished-emails/${base}.png?v=${Date.now()}`;

          return {
            id: base,
            name: base,
            html,
            thumbUrl,
            type: "user",
          };
        })
      );

      setSavedEmails(all);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEmails(false);
    }
  }

  // ===== LOAD PUBLIC BASE TEMPLATES =====
  async function loadTemplates() {
    try {
      const { data: files, error } = await supabase.storage
        .from("email-assets")
        .list("templates", { limit: 200 });

      if (error) {
        console.error(error);
        return;
      }

      const all = [];
      for (const file of files || []) {
        if (!file.name.endsWith(".html")) continue;

        const base = file.name.replace(".html", "");
        const htmlUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets/templates/${file.name}`;
        const thumbUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets/templates/${base}.png`;

        all.push({ id: base, name: base, htmlUrl, thumbUrl, type: "base" });
      }

      setTemplates(all.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTemplates(false);
    }
  }

  // ===== Convert HTML => blocks (simple + reliable starter)
  // We keep it dead simple: store the whole HTML in a single TEXT block.
  // Later we can parse into multiple blocks, but this makes "templates load" immediately.
  function htmlToBlocks(html) {
    const safe = String(html || "").trim();

    // "blank" should truly be blank
    if (!safe) return [];

    return [
      {
        id: `header_${Date.now().toString(16)}`,
        type: "header",
        style: { background: "brand", padding: 18, radius: 0, align: "center", textColor: "#ffffff" },
        content: { title: "GR8 RESULT", subtitle: "Your next campaigns starts here" },
      },
      {
        id: `text_${(Date.now() + 1).toString(16)}`,
        type: "text",
        style: { background: "none", padding: 18, radius: 0, align: "left", textColor: "#ffffff" },
        content: {
          // Wrap HTML in a container so it renders as-is inside the editor
          html: safe,
        },
      },
      {
        id: `footer_${(Date.now() + 2).toString(16)}`,
        type: "footer",
        style: { background: "none", padding: 18, radius: 0, align: "center", textColor: "#cbd5e1" },
        content: { text: "© GR8 RESULT — All rights reserved." },
      },
    ];
  }

  async function saveBlocksToTemplate(templateId, blocks) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id || "public";

    const r = await fetch("/api/email/editor-save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, userId, blocks }),
    });
    const j = await r.json();
    if (!j?.ok) throw new Error(j?.detail || j?.error || "Save failed");
  }

  // ===== OPEN EDITOR WITH CHOSEN TEMPLATE / SAVED EMAIL =====
  async function useTemplate(tpl) {
    try {
      // TRUE blank means: open editor blank (do NOT import html)
      if (String(tpl.id) === "blank") {
        router.push(`/modules/email/editor?id=blank`);
        return;
      }

      let html = tpl.html || "";

      // For base templates we still need to fetch the HTML
      if (!html && tpl.htmlUrl) {
        const res = await fetch(`${tpl.htmlUrl}?v=${Date.now()}`);
        html = await res.text();
      }

      // Convert HTML => blocks and SAVE it so editor-load finds it
      const blocks = htmlToBlocks(html);

      await saveBlocksToTemplate(String(tpl.id), blocks);

      // Now open builder with that id
      router.push(`/modules/email/editor?id=${encodeURIComponent(tpl.id)}`);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Could not open template");
    }
  }

  // ===== PREVIEW IN NEW WINDOW =====
  async function previewTemplate(tpl) {
    try {
      let html = tpl.html || "";

      if (!html && tpl.htmlUrl) {
        const res = await fetch(`${tpl.htmlUrl}?v=${Date.now()}`);
        html = await res.text();
      }

      const w = window.open("", "_blank", "width=900,height=700");
      w.document.write(html || "<p>No preview available</p>");
      w.document.close();
    } catch (e) {
      console.error(e);
      alert("Could not preview template");
    }
  }

  // ===== OPEN DELETE MODAL =====
  function openDeleteModal(tpl) {
    setEmailToDelete(tpl);
    setShowDeleteModal(true);
  }

  // ===== CONFIRM DELETE (HTML + PNG) =====
  async function handleConfirmDelete() {
    if (!emailToDelete) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return;

      const htmlPath = `${userId}/finished-emails/${emailToDelete.id}.html`;
      const pngPath = `${userId}/finished-emails/${emailToDelete.id}.png`;

      await supabase.storage
        .from("email-user-assets")
        .remove([htmlPath, pngPath]);

      // remove from UI
      setSavedEmails((prev) => prev.filter((e) => e.id !== emailToDelete.id));

      setShowDeleteModal(false);
      setEmailToDelete(null);
    } catch (e) {
      console.error(e);
      alert("Could not delete email");
    }
  }

  // ===== CANCEL DELETE =====
  function handleCancelDelete() {
    setShowDeleteModal(false);
    setEmailToDelete(null);
  }

  return (
    <>
      <Head>
        <title>Select Template - GR8 RESULT</title>
      </Head>

      <main className="wrap">
        <div className="inner">
          <div className="banner">
            <div className="banner-left">
              <span className="banner-icon">📧</span>
              <div className="banner-text">
                <h1 className="banner-title">Select a Template</h1>
                <p className="banner-desc">
                  Start a new email, reopen saved ones, or use a base design.
                </p>
              </div>
            </div>
            <Link href="/modules/email/broadcast" className="btn-back">
              ⬅ Back
            </Link>
          </div>

          {/* BLANK STARTER TEMPLATES */}
          <h2 className="section-title">Start a New Email</h2>

          <section className="grid">
            {[
              {
                id: "blank",
                name: "Blank Template",
                thumb: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets/blank-templates/blank/blank.jpg`,
                htmlUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets/blank-templates/blank/base.html`,
              },
              {
                id: "single",
                name: "Single Column Layout",
                thumb: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets/blank-templates/single-column/single.jpg`,
                htmlUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets/blank-templates/single-column/base.html`,
              },
              {
                id: "two",
                name: "Two Column Layout",
                thumb: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets/blank-templates/two-column/2 col.jpg`,
                htmlUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets/blank-templates/two-column/base.html`,
              },
              {
                id: "three",
                name: "Three Column Layout",
                thumb: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets/blank-templates/three-column/3 col.jpg`,
                htmlUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets/blank-templates/three-column/base.html`,
              },
            ].map((b) => (
              <div key={b.id} className="card">
                <div className="thumb">
                  <div className="preview-wrapper">
                    <img
                      src={b.thumb}
                      alt={b.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        objectPosition: "top center",
                        backgroundColor: "#000",
                      }}
                    />
                  </div>
                  <div className="overlay">
                    <button onClick={() => useTemplate(b)}>Use</button>
                    <button onClick={() => previewTemplate(b)}>Preview</button>
                  </div>
                </div>
                <div className="template-name">{b.name}</div>
              </div>
            ))}
          </section>

          <hr className="divider" />

          {/* MY SAVED EMAILS */}
          <h2 className="section-title">My Saved Emails</h2>

          {loadingEmails ? (
            <p className="status-text">Loading emails...</p>
          ) : savedEmails.length === 0 ? (
            <p className="status-text">No saved emails yet.</p>
          ) : (
            <section className="grid saved-grid">
              {savedEmails.map((tpl) => (
                <div key={tpl.id} className="card saved-card">
                  <div className="thumb saved-thumb">
                    <div className="preview-wrapper">
                      <img
                        src={tpl.thumbUrl}
                        alt={tpl.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          objectPosition: "top center",
                          backgroundColor: "#000",
                        }}
                        onError={(e) => {
                          e.target.src =
                            "https://via.placeholder.com/260x260/0c121a/FFFFFF?text=No+Thumbnail";
                        }}
                      />
                    </div>
                    <div className="overlay">
                      <button onClick={() => useTemplate(tpl)}>Use</button>
                      <button onClick={() => previewTemplate(tpl)}>Preview</button>
                      <button onClick={() => openDeleteModal(tpl)}>Delete 🗑</button>
                    </div>
                  </div>
                  <div className="template-name">{tpl.name}</div>
                </div>
              ))}
            </section>
          )}

          <hr className="divider" />

          {/* BASE TEMPLATES — PNG ONLY */}
          <h2 className="section-title">Base Templates</h2>

          {loadingTemplates ? (
            <p className="status-text">Loading templates...</p>
          ) : (
            <section className="grid">
              {templates.map((tpl) => (
                <div key={tpl.id} className="card">
                  <div className="thumb">
                    <div className="preview-wrapper">
                      <img
                        src={tpl.thumbUrl}
                        alt={tpl.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          objectPosition: "top center",
                          backgroundColor: "#000",
                        }}
                        onError={(e) =>
                          (e.target.src =
                            "https://via.placeholder.com/260x260/0c121a/FFFFFF?text=No+Image")
                        }
                      />
                    </div>
                    <div className="overlay">
                      <button onClick={() => useTemplate(tpl)}>Use</button>
                      <button onClick={() => previewTemplate(tpl)}>Preview</button>
                    </div>
                  </div>
                  <div className="template-name">{tpl.name}</div>
                </div>
              ))}
            </section>
          )}
        </div>

        {/* DELETE MODAL */}
        {showDeleteModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 420,
                background: "#111827",
                borderRadius: 12,
                padding: 24,
                border: "1px solid #4b5563",
                boxShadow: "0 10px 40px rgba(0,0,0,0.7)",
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                  marginBottom: 10,
                  color: "#f97316",
                  fontSize: 20,
                  textAlign: "center",
                }}
              >
                Delete Email
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "#e5e7eb",
                  textAlign: "center",
                  marginBottom: 20,
                }}
              >
                Are you sure you want to permanently delete{" "}
                <strong>{emailToDelete?.name}</strong>?<br />
                This action cannot be undone.
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 12,
                  marginTop: 10,
                }}
              >
                <button
                  onClick={handleCancelDelete}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid #6b7280",
                    background: "#374151",
                    color: "#e5e7eb",
                    fontWeight: 600,
                    cursor: "pointer",
                    minWidth: 110,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: "#ef4444",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                    minWidth: 140,
                  }}
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .wrap {
          background: #0c121a;
          color: #fff;
          min-height: 100vh;
          padding: 24px;
          display: flex;
          justify-content: center;
        }
        .inner {
          width: 100%;
          max-width: 1320px;
        }
        .banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #38bdf8;
          border-radius: 14px;
          padding: 16px 20px;
          margin-bottom: 24px;
        }
        .section-title {
          color: #38bdf8;
          margin-bottom: 12px;
        }
        .divider {
          border-color: #23303a;
          margin: 40px 0;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 26px;
        }
        .card {
          background: #111827;
          border: 2px solid rgba(255, 255, 255, 0.15);
          border-radius: 14px;
          text-align: center;
          padding: 18px;
        }
        .thumb {
          height: 260px;
          overflow: hidden;
          border-radius: 10px;
          background: #000;
          position: relative;
          margin-bottom: 10px;
        }
        .preview-wrapper {
          width: 100%;
          height: 100%;
          overflow: hidden;
          display: flex;
          justify-content: flex-start;
          align-items: flex-start;
          background: #000;
        }
        .overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          opacity: 0;
          transition: 0.2s;
        }
        .card:hover .overlay {
          opacity: 1;
        }
        .overlay button {
          background: #38bdf8;
          border: none;
          border-radius: 8px;
          padding: 8px 14px;
          margin: 5px 0;
          font-weight: bold;
          color: white;
          cursor: pointer;
          width: 85%;
        }
        .template-name {
          font-weight: 700;
          font-size: 15px;
        }
        .banner-left {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 18px;
        }
        .banner-icon {
          font-size: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .banner-text {
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </>
  );
}
