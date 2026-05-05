// pages/assets.js
// File uploader + file list under /assets bucket at /<userId>/.
// Content-only: Layout (with SideNav + TopNav) is applied globally in _app.js.

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { getFunnelTemplateLibraryAssets } from "../lib/funnelSections";
import { getWebsiteTemplateLibraryAssets } from "../lib/website-builder/templateLibraryAssets";
import ImageEditorCard from "../components/image-editor/ImageEditorCard";

const SHARED_LIBRARY_SYNC_VERSION = "generic-library-v6";

export default function Assets() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [prefix, setPrefix] = useState("");
  const [files, setFiles] = useState([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [deletingName, setDeletingName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [editingFile, setEditingFile] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [permissions, setPermissions] = useState({ canManageTemplateImages: false });

  useEffect(() => {
    let subscription;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session || null);
      ({
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null)));
    })();
    return () => subscription?.unsubscribe();
  }, []);

  
  useEffect(() => {
    if (!session) return;
    const p = `${session.user.id}/`;
    setPrefix(p);
    listFiles();

    let cancelled = false;
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        if (cancelled) return;
        seedGenericLibrary().then((didSeed) => {
          if (didSeed && !cancelled) {
            listFiles({ showLoader: false });
          }
        });
      }, 0);
    }

    return () => {
      cancelled = true;
    };
  }, [session]);

  async function seedGenericLibrary() {
    if (!session?.user?.id || !session?.access_token) return false;
    try {
      const syncKey = `gr8:shared-media-sync:${session.user.id}:${SHARED_LIBRARY_SYNC_VERSION}`;
      if (typeof window !== "undefined" && window.localStorage.getItem(syncKey)) return false;
      setSyncing(true);

      const genericAssets = [...getFunnelTemplateLibraryAssets(), ...getWebsiteTemplateLibraryAssets()];
      const dedupedAssets = Array.from(new Map(genericAssets.map((asset) => [String(asset?.src || '').trim(), asset])).values());

      for (let index = 0; index < dedupedAssets.length; index += 20) {
        const chunk = dedupedAssets.slice(index, index + 20).map((asset) => ({
          assetKey: asset.id,
          name: asset.name,
          imageUrl: asset.src,
        }));

        const response = await fetch("/api/assets/import-library", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ assets: chunk }),
        });

        const payload = await response.json();
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || "Could not seed the shared media library");
        }
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(syncKey, `${Date.now()}`);
      }
      return true;
    } catch (error) {
      console.warn("Could not seed generic media library assets", error);
      setStatusMessage(error.message || "Could not sync the shared media library.");
      return false;
    } finally {
      setSyncing(false);
    }
  }

  async function listFiles(options = {}) {
    const { showLoader = true } = options;
    if (showLoader) setLoading(true);
    if (!session?.access_token) {
      setFiles([]);
      if (showLoader) setLoading(false);
      return [];
    }
    const response = await fetch("/api/assets/list-library", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const payload = await response.json();
    if (!response.ok || !payload?.ok) {
      setStatusMessage(payload?.error || "Could not load assets.");
      if (showLoader) setLoading(false);
      return [];
    }
    setFiles(payload.images || []);
    setPermissions(payload.permissions || { canManageTemplateImages: false });
    if (showLoader) setLoading(false);
    return payload.images || [];
  }

  function safeName(name = "") {
    return name.replace(/[^a-zA-Z0-9._-]/g, "-");
  }

  async function uploadSingle(file, tag) {
    if (!file || !session) return;
    const path = `${session.user.id}/${tag}-${Date.now()}-${safeName(file.name)}`;
    const { error } = await supabase.storage.from("assets").upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });
    if (error) throw error;
  }

  async function onUploadLogo(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !session) return;
    setUploadingLogo(true);
    try {
      await uploadSingle(file, "logo");
      await listFiles({ showLoader: false });
    } catch (error) {
      alert(error.message || "Logo upload failed");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function onUploadWebsiteImages(e) {
    const selected = Array.from(e.target.files || []);
    e.target.value = "";
    if (!selected.length || !session) return;
    setUploadingImages(true);
    try {
      for (const file of selected) {
        await uploadSingle(file, "web");
      }
      await listFiles({ showLoader: false });
    } catch (error) {
      alert(error.message || "Image upload failed");
    } finally {
      setUploadingImages(false);
    }
  }

  async function useAsLogo(url) {
    if (!session) return;
    const { error } = await supabase.from("profiles").upsert({
      user_id: session.user.id,
      logo_url: url,
      updated_at: new Date().toISOString(),
    });
    if (error) return alert(error.message);
    if (typeof window !== "undefined") window.dispatchEvent(new Event("profile-updated"));
    alert("Set as logo.");
  }

  async function deleteFile(file) {
    if (!session) return;
    const name = file?.name || file?.description || 'this image';
    const ok = confirm(`Delete "${name}"? This cannot be undone.`);
    if (!ok) return;
    setDeletingName(file?.id || name);
    setStatusMessage("");
    try {
      const response = await fetch(`/api/social/delete-image?id=${encodeURIComponent(file?.id || '')}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || `Could not delete "${name}".`);

      const refreshed = await listFiles();
      const stillExists = (refreshed || []).some((entry) => entry.id === file?.id);
      if (stillExists) throw new Error(`"${name}" still exists after delete.`);

      setStatusMessage(`Deleted "${name}".`);
    } catch (error) {
      setStatusMessage(error.message || `Could not delete "${name}".`);
    } finally {
      setDeletingName("");
    }
  }

  async function cleanupLibrary() {
    if (!session?.access_token) return;
    if (!permissions.canManageTemplateImages) {
      setStatusMessage("Only developer accounts can remove shared library duplicates.");
      return;
    }
    const ok = confirm("Remove duplicate saved images from the shared media library? This keeps one copy of each image and deletes the extras.");
    if (!ok) return;
    setCleaning(true);
    setStatusMessage("");
    try {
      const response = await fetch("/api/social/cleanup-image-library", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Could not clean duplicate shared images");
      }
      setStatusMessage(`Cleanup finished. Removed ${payload.removedLegacyGenericFiles || 0} legacy generic files, ${payload.removedInvalidFiles || 0} invalid files, ${payload.removedStorageDuplicates || 0} duplicate files, and ${payload.removedIndexDuplicates || 0} duplicate library entries.`);
      await listFiles({ showLoader: false });
    } catch (error) {
      setStatusMessage(error.message || "Could not clean duplicate shared images.");
    } finally {
      setCleaning(false);
    }
  }

  async function saveEditedImage(imageUrl) {
    if (!session?.access_token || !editingFile) return;
    setSavingEdit(true);
    setStatusMessage("");
    try {
      const saveResponse = await fetch("/api/social/save-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          imageUrl,
          description: editingFile.description || editingFile.name || "Edited image",
        }),
      });
      const savePayload = await saveResponse.json();
      if (!saveResponse.ok || !savePayload?.ok) {
        throw new Error(savePayload?.error || "Could not save edited image.");
      }

      if (editingFile?.canManageOriginal && editingFile.id) {
        const deleteResponse = await fetch(`/api/social/delete-image?id=${encodeURIComponent(editingFile.id)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const deletePayload = await deleteResponse.json();
        if (!deleteResponse.ok || !deletePayload?.ok) {
          throw new Error(deletePayload?.error || "Could not replace the original image.");
        }
        setStatusMessage("Image updated.");
      } else {
        setStatusMessage("Edited image saved as a new copy.");
      }

      setEditingFile(null);
      await listFiles({ showLoader: false });
    } catch (error) {
      setStatusMessage(error.message || "Could not save edited image.");
    } finally {
      setSavingEdit(false);
    }
  }

  function canManageOriginalFile(file) {
    if (!file) return false;
    return !file.is_template || permissions.canManageTemplateImages;
  }

  if (!session) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0b0b0b",
          color: "#eaeaea",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p>Please log in.</p>
      </div>
    );
  }

  return (
    <main style={{ padding: "20px 16px", maxWidth: 1302, width: "100%", margin: "0 auto" }}>
      <div
        style={{
          background: "#2563eb",
          borderRadius: 16,
          padding: "22px 28px",
          margin: "16px auto 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              background: "rgba(255,255,255,0.18)",
              borderRadius: "50%",
              width: 72,
              height: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 34,
            }}
          >
            🖼️
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 48, fontWeight: 600, color: "#fff", lineHeight: 1.1 }}>
              Media Library
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 18, color: "rgba(255,255,255,0.9)" }}>
              Shared logos and images across Funnels, Website Builder, Social Media, Email, and other modules.
            </p>
          </div>
        </div>

        <button
          onClick={() => router.back()}
          style={{
            background: "rgba(0,0,0,0.3)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.35)",
            borderRadius: 10,
            padding: "10px 22px",
            fontSize: 18,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          ← Back
        </button>
      </div>

      <p style={{ color: "#94a3b8", marginTop: 0 }}>
        Uploads go to <code>/{prefix}filename.ext</code>. Public read is enabled.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {syncing ? <span style={{ color: "#cbd5e1", fontSize: 13 }}>Syncing shared library in the background…</span> : null}
        <button onClick={() => listFiles()} style={miniBtn}>Refresh</button>
        {permissions.canManageTemplateImages ? (
          <button
            onClick={cleanupLibrary}
            disabled={cleaning}
            style={{ ...miniBtn, background: "#3a0f12", border: "1px solid #5b1a1f", color: "#ffd7db" }}
          >
            {cleaning ? "Cleaning..." : "Clean Duplicates"}
          </button>
        ) : null}
      </div>

      {statusMessage ? (
        <p style={{ color: statusMessage.startsWith("Deleted") || statusMessage.startsWith("Removed") ? "#86efac" : "#fca5a5", marginTop: 0 }}>
          {statusMessage}
        </p>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 12 }}>
        <label style={uploadCard}>
          <div style={uploadTitle}>Upload Logo</div>
          <div style={uploadHint}>Best for brand header/logo files</div>
          <input type="file" accept="image/*" onChange={onUploadLogo} disabled={uploadingLogo} />
          <div style={uploadState}>{uploadingLogo ? "Uploading logo..." : "PNG, JPG, SVG, WEBP"}</div>
        </label>

        <label style={uploadCard}>
          <div style={uploadTitle}>Upload Website Images</div>
          <div style={uploadHint}>Hero images, section photos, product shots</div>
          <input type="file" accept="image/*" multiple onChange={onUploadWebsiteImages} disabled={uploadingImages} />
          <div style={uploadState}>{uploadingImages ? "Uploading images..." : "Select one or more images"}</div>
        </label>
      </div>

      <div style={{ height: 12 }} />

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {files.map((f) => {
            const url = f.url;
            const canManageOriginal = canManageOriginalFile(f);
            return (
              <div
                key={f.id}
                style={{
                  background: "#151515",
                  border: "1px solid #222",
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    height: 160,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#0f0f0f",
                    borderRadius: 8,
                    overflow: "hidden",
                    cursor: "pointer",
                  }}
                    onClick={() => setEditingFile({ ...f, canManageOriginal })}
                >
                  <img src={url} alt={f.name} style={{ maxWidth: "100%", maxHeight: "100%" }} />
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: "#aaa",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {f.name}
                </div>
                <input
                  readOnly
                  value={url}
                  style={{
                    marginTop: 6,
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #333",
                    background: "#0f0f0f",
                    color: "#eaeaea",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                  <button
                    onClick={() => navigator.clipboard?.writeText(url)}
                    style={miniBtn}
                    title="Copy public URL"
                  >
                    Copy URL
                  </button>
                  <button
                    onClick={() => useAsLogo(url)}
                    style={{ ...miniBtn, background: "#2d6cdf", border: "none", color: "#fff" }}
                    title="Set this image as your logo"
                  >
                    Set as logo
                  </button>
                  {canManageOriginal ? (
                    <button
                      onClick={() => deleteFile(f)}
                      style={{
                        ...miniBtn,
                        background: "#3a0f12",
                        border: "1px solid #5b1a1f",
                        color: "#ffd7db",
                      }}
                      title="Delete this image"
                      disabled={deletingName === f.id}
                    >
                      {deletingName === f.id ? "Deleting..." : "Delete"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
          {files.length === 0 ? <p>No assets yet.</p> : null}
        </div>
      )}

      {editingFile ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(2,6,23,0.9)", padding: 20, overflowY: "auto" }}>
          <div style={{ maxWidth: 1380, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 600, color: "#f8fafc" }}>Edit Image</div>
                <div style={{ fontSize: 13, color: "#cbd5e1" }}>{editingFile.canManageOriginal ? "Saving replaces the current image." : "Template images stay locked for other users. Saving creates an edited copy instead."}</div>
              </div>
              <button onClick={() => !savingEdit && setEditingFile(null)} style={miniBtn}>Close</button>
            </div>
            {savingEdit ? <div style={{ marginBottom: 12, color: "#cbd5e1" }}>Saving edited image...</div> : null}
            <ImageEditorCard initialSrc={editingFile.url} onSave={saveEditedImage} />
          </div>
        </div>
      ) : null}
    </main>
  );
}

const miniBtn = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#222",
  color: "#eaeaea",
  cursor: "pointer",
  fontSize: 12,
};

const uploadCard = {
  background: "#151515",
  border: "1px solid #252525",
  borderRadius: 12,
  padding: 12,
  display: "grid",
  gap: 8,
};

const uploadTitle = {
  color: "#eaeaea",
  fontSize: 16,
  fontWeight: 700,
};

const uploadHint = {
  color: "#9ca3af",
  fontSize: 13,
};

const uploadState = {
  color: "#94a3b8",
  fontSize: 12,
};

