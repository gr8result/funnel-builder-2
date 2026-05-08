// pages/assets.js
// File uploader + file list under /assets bucket at /<userId>/.
// Content-only: Layout (with SideNav + TopNav) is applied globally in _app.js.

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import ImageEditorCard from "../components/image-editor/ImageEditorCard";

const INITIAL_VISIBLE_COUNT = 48;
const GLOBAL_TEMPLATE_IMPORT_BATCH_SIZE = 25;
const MOVABLE_STORAGE_PREFIXES = ["assets:", "social-images:"];

function isPlatformHostedUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return false;
  return /\/storage\/v1\/object\/(?:public|sign)\/(?:assets|social-images|email-assets|email-user-assets|public-assets|private-assets)\//i.test(raw);
}

function isMovableLibraryEntry(file) {
  const storagePath = String(file?.storage_path || "");
  if (storagePath.startsWith("email-template:")) return false;
  if (MOVABLE_STORAGE_PREFIXES.some((prefix) => storagePath.startsWith(prefix))) return true;
  return isPlatformHostedUrl(file?.url);
}

function canRemoveOriginalAfterPromotion(file) {
  const storagePath = String(file?.storage_path || "");
  return MOVABLE_STORAGE_PREFIXES.some((prefix) => storagePath.startsWith(prefix));
}

function getFileSelectionKey(file) {
  return String(file?.id || file?.storage_path || file?.url || file?.name || "");
}

function isAutoMaterializedEmailTemplateImage(file) {
  const storagePath = String(file?.storage_path || "");
  const tags = Array.isArray(file?.tags) ? file.tags.map((tag) => String(tag || "").toLowerCase()) : [];
  return storagePath.startsWith("assets:") && /\/shared-[a-f0-9]{32,}\./i.test(storagePath) && tags.includes("email-template");
}

export default function Assets() {
  const router = useRouter();
  const pickerMode = String(router.query?.picker || "") === "1";
  const pickerChannel = String(router.query?.channel || "");
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
  const [libraryView, setLibraryView] = useState("user");
  const [selectedImageIds, setSelectedImageIds] = useState([]);
  const [movingSelected, setMovingSelected] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    const nextView = String(router.query?.view || "").toLowerCase();
    if (nextView === "generic" || nextView === "user") {
      setLibraryView(nextView);
    }
  }, [router.isReady, router.query?.view]);

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
    let cancelled = false;
    const p = `${session.user.id}/`;
    setPrefix(p);

    (async () => {
      await listFiles({ includeEmailTemplateRefs: false });
      if (cancelled) return;

      setSyncing(true);
      try {
        await listFiles({
          showLoader: false,
          includeEmailTemplateRefs: true,
          resetVisibleCounts: false,
        });
      } catch (error) {
        console.warn("Could not enrich assets library with email template images", error);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  async function listFiles(options = {}) {
    const { showLoader = true, includeEmailTemplateRefs = true } = options;
    if (showLoader) setLoading(true);
    if (!session?.access_token) {
      setFiles([]);
      if (showLoader) setLoading(false);
      return [];
    }
    const response = await fetch(`/api/assets/list-library?includeEmailTemplateRefs=${includeEmailTemplateRefs ? "1" : "0"}`, {
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
    setSelectedImageIds((prev) => prev.filter((id) => (payload.images || []).some((entry) => getFileSelectionKey(entry) === id)));
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

  function canPromoteToGlobalTemplate(file) {
    if (!permissions.canManageTemplateImages) return false;
    if (!file || file?.owner_scope === "generic") return false;
    return isMovableLibraryEntry(file);
  }

  function toggleImageSelection(fileId) {
    const normalizedId = String(fileId || "");
    if (!normalizedId) return;
    setSelectedImageIds((prev) => prev.includes(normalizedId)
      ? prev.filter((id) => id !== normalizedId)
      : [...prev, normalizedId]);
  }

  function clearSelectedImages() {
    setSelectedImageIds([]);
  }

  function selectAllPromotableImages(items) {
    setSelectedImageIds(items.filter(canPromoteToGlobalTemplate).map((item) => getFileSelectionKey(item)).filter(Boolean));
  }

  async function deleteFile(file, options = {}) {
    const { skipConfirm = false, refreshAfterDelete = true, successMessage = "" } = options;
    if (!session) return;
    const name = file?.name || file?.description || 'this image';
    const selectionKey = getFileSelectionKey(file);
    const ok = skipConfirm ? true : confirm(`Delete "${name}"? This cannot be undone.`);
    if (!ok) return;
    setDeletingName(file?.id || name);
    if (!skipConfirm) setStatusMessage("");
    try {
      const response = await fetch(`/api/social/delete-image?id=${encodeURIComponent(file?.id || '')}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || `Could not delete "${name}".`);

      setFiles((prev) => prev.filter((entry) => getFileSelectionKey(entry) !== selectionKey));
      setSelectedImageIds((prev) => prev.filter((id) => id !== selectionKey));

      if (refreshAfterDelete) {
        await listFiles({ showLoader: false });
      }

      if (successMessage) setStatusMessage(successMessage);
    } catch (error) {
      setStatusMessage(error.message || `Could not delete "${name}".`);
      throw error;
    } finally {
      setDeletingName("");
    }
  }

  async function saveAsGlobalTemplate(file) {
    if (!session?.access_token || !canPromoteToGlobalTemplate(file)) return;

    const name = file?.name || file?.description || "this image";
    const ok = confirm(`Save "${name}" into the global template library and remove it from your private images?`);
    if (!ok) return;

    setDeletingName(file?.id || name);
    setStatusMessage("");
    try {
      const response = await fetch("/api/assets/import-library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          assets: [{
            assetKey: file?.id || file?.storage_path || file?.url || file?.name,
            name,
            imageUrl: file?.url,
          }],
        }),
      });
      const payload = await response.json();
      const result = Array.isArray(payload?.results) ? payload.results[0] : null;
      if (!response.ok || !payload?.ok || !result?.ok) {
        throw new Error(result?.error || payload?.error || `Could not save "${name}" as a global template image.`);
      }

      const removedOriginal = canRemoveOriginalAfterPromotion(file);
      if (removedOriginal) {
        await deleteFile(file, { skipConfirm: true, refreshAfterDelete: false });
      }
      await listFiles({ showLoader: false });
      setStatusMessage(removedOriginal
        ? `Moved "${name}" to the global template library.`
        : `Copied "${name}" to the global template library.`);
    } catch (error) {
      setStatusMessage(error.message || `Could not save "${name}" to the global template library.`);
    } finally {
      setDeletingName("");
    }
  }

  async function importImagesToGlobalTemplate(filesToPromote) {
    const importedFiles = [];

    for (let index = 0; index < filesToPromote.length; index += GLOBAL_TEMPLATE_IMPORT_BATCH_SIZE) {
      const chunk = filesToPromote.slice(index, index + GLOBAL_TEMPLATE_IMPORT_BATCH_SIZE);
      const response = await fetch("/api/assets/import-library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          assets: chunk.map((file) => ({
            assetKey: file?.id || file?.storage_path || file?.url || file?.name,
            name: file?.name || file?.description || "Image",
            imageUrl: file?.url,
          })),
        }),
      });
      const payload = await response.json();
      const results = Array.isArray(payload?.results) ? payload.results : [];
      const failed = results.find((result) => !result?.ok);
      if (!response.ok || !payload?.ok || failed) {
        throw new Error(failed?.error || payload?.error || "Could not move images to the generic library.");
      }
      importedFiles.push(...chunk);
    }

    return importedFiles;
  }

  async function moveSelectedToGeneric() {
    if (!session?.access_token || !permissions.canManageTemplateImages) return;
    const selectedFiles = userOwnedFiles.filter((file) => selectedImageIds.includes(getFileSelectionKey(file)) && canPromoteToGlobalTemplate(file));
    if (!selectedFiles.length) {
      setStatusMessage("No private images are selected.");
      return;
    }

    const ok = confirm(`Move ${selectedFiles.length} selected image${selectedFiles.length === 1 ? "" : "s"} into the generic images section and remove them from private images?`);
    if (!ok) return;

    setMovingSelected(true);
    setStatusMessage("");
    try {
      const importedFiles = await importImagesToGlobalTemplate(selectedFiles);
      let removedOriginalCount = 0;
      for (const file of importedFiles) {
        if (!canRemoveOriginalAfterPromotion(file)) continue;
        await deleteFile(file, { skipConfirm: true, refreshAfterDelete: false });
        removedOriginalCount += 1;
      }
      clearSelectedImages();
      await listFiles({ showLoader: false });
      setStatusMessage(removedOriginalCount === importedFiles.length
        ? `Moved ${importedFiles.length} image${importedFiles.length === 1 ? "" : "s"} to generic images.`
        : `Copied ${importedFiles.length} image${importedFiles.length === 1 ? "" : "s"} to generic images. Removed ${removedOriginalCount} original${removedOriginalCount === 1 ? "" : "s"}.`);
    } catch (error) {
      setStatusMessage(error.message || "Could not move selected images to generic images.");
    } finally {
      setMovingSelected(false);
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

  function handlePickerSelect(file) {
    if (!pickerMode || !pickerChannel || typeof window === "undefined") return;
    const payload = {
      type: "gr8:media-picker-select",
      channel: pickerChannel,
      asset: {
        id: file?.id || "",
        src: file?.url || "",
        url: file?.url || "",
        name: file?.name || file?.description || "Image",
        description: file?.description || "",
        storage_path: file?.storage_path || "",
        owner_scope: file?.owner_scope || "user",
      },
    };

    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, window.location.origin);
        window.close();
      }
    } catch (error) {
      setStatusMessage(error?.message || "Could not send the selected image back to the editor.");
    }
  }

  const userOwnedFiles = files.filter((file) => file?.owner_scope !== "generic" && !isAutoMaterializedEmailTemplateImage(file));
  const genericFiles = files.filter((file) => file?.owner_scope === "generic");
  const selectedUserImageCount = userOwnedFiles.filter((file) => selectedImageIds.includes(getFileSelectionKey(file))).length;
  const selectedPromotableImageCount = userOwnedFiles.filter((file) => selectedImageIds.includes(getFileSelectionKey(file)) && canPromoteToGlobalTemplate(file)).length;
  const activeLibraryItems = libraryView === "generic" ? genericFiles : userOwnedFiles;
  const activeLibraryTitle = libraryView === "generic" ? "Generic Site Images" : "Your Images";
  const activeLibraryDescription = libraryView === "generic"
    ? "These are global starter images for sites and funnels."
    : "These are your private uploads and saved edits. Only you can manage them.";
  const activeEmptyText = libraryView === "generic"
    ? "No generic site images are available right now."
    : "No user-owned images yet.";

  function renderFileGrid(items, emptyText, sectionKey) {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            gap: 12,
          }}
        >
        {items.map((f) => {
          const url = f.url;
          const selectionKey = getFileSelectionKey(f);
          const canManageOriginal = canManageOriginalFile(f);
          const showSelectionControl = !pickerMode && sectionKey === "user" && permissions.canManageTemplateImages;
          const canSelectForPromotion = sectionKey === "user" && canPromoteToGlobalTemplate(f);
          const isSelected = selectedImageIds.includes(selectionKey);
          return (
            <div
              key={f.id}
              style={{
                background: "#151515",
                border: isSelected ? "1px solid #2dd4bf" : "1px solid #222",
                borderRadius: 12,
                padding: 12,
                contentVisibility: "auto",
                containIntrinsicSize: "320px",
              }}
            >
              {showSelectionControl ? (
                <button
                  type="button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 10,
                    color: canSelectForPromotion ? "#ccfbf1" : "#94a3b8",
                    fontSize: 14,
                    fontWeight: 600,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: canSelectForPromotion ? "rgba(13,148,136,0.14)" : "rgba(51,65,85,0.28)",
                    border: canSelectForPromotion ? "1px solid rgba(45,212,191,0.3)" : "1px solid rgba(100,116,139,0.28)",
                    cursor: canSelectForPromotion ? "pointer" : "not-allowed",
                    width: "100%",
                    textAlign: "left",
                  }}
                  disabled={!canSelectForPromotion}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!canSelectForPromotion) return;
                    toggleImageSelection(selectionKey);
                  }}
                >
                  <span>{canSelectForPromotion ? "Select" : "Not movable"}</span>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 900,
                      lineHeight: 1,
                      border: canSelectForPromotion ? "2px solid #14b8a6" : "2px solid #64748b",
                      background: isSelected ? "#14b8a6" : "transparent",
                      color: isSelected ? "#042f2e" : "transparent",
                      boxShadow: isSelected ? "0 0 0 1px rgba(20,184,166,0.25)" : "none",
                    }}
                  >
                    ✓
                  </span>
                </button>
              ) : null}
              <div
                style={{
                  height: 160,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#0f0f0f",
                  borderRadius: 8,
                  overflow: "hidden",
                  cursor: pickerMode ? "copy" : "pointer",
                }}
                onClick={() => {
                  if (pickerMode) return;
                  setEditingFile({ ...f, canManageOriginal });
                }}
                onDoubleClick={() => handlePickerSelect(f)}
                title={pickerMode ? "Double-click to insert this image" : f.name}
              >
                <img
                  src={url}
                  alt={f.name}
                  loading="lazy"
                  decoding="async"
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                />
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 18,
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
              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                {pickerMode ? (
                  <button
                    onClick={() => handlePickerSelect(f)}
                    style={{ ...miniBtn, background: "#2563eb", border: "1px solid #3b82f6", color: "#fff" }}
                    title="Insert this image into the editor"
                  >
                    Insert
                  </button>
                ) : null}
                {!pickerMode && canPromoteToGlobalTemplate(f) ? (
                  <button
                    onClick={() => saveAsGlobalTemplate(f)}
                    style={{ ...miniBtn, background: "#0f766e", border: "none", color: "#fff" }}
                    title="Save this image into the global template library and remove it from your private images"
                    disabled={deletingName === f.id}
                  >
                    {deletingName === f.id ? "Saving..." : "Save as Global Template"}
                  </button>
                ) : null}
                {!pickerMode && canManageOriginal ? (
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
        </div>
        {items.length === 0 ? <p>{emptyText}</p> : null}
      </div>
    );
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
    <main style={{ padding: "20px 16px 32px", maxWidth: 2200, width: "100%", margin: "0 auto" }}>
      <div style={{ maxWidth: 1302, margin: "0 auto" }}>
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
      </div>

      <div style={{ maxWidth: 1302, margin: "0 auto" }}>
        {pickerMode ? (
          <div style={{ marginBottom: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(37,99,235,0.16)", border: "1px solid rgba(59,130,246,0.35)", color: "#dbeafe", fontSize: 15, fontWeight: 600 }}>
            Double-click any image to insert it back into the editor.
          </div>
        ) : null}
        <p style={{ color: "#94a3b8", marginTop: 0 }}>
          Uploads go to <code>/{prefix}filename.ext</code>. Public read is enabled.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          {syncing ? <span style={{ color: "#cbd5e1", fontSize: 13 }}>Loading email-template images in the background...</span> : null}
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
      </div>

      <div style={{ height: 12 }} />

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div style={{ display: "grid", gap: 28 }}>
          <section>
            <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginBottom: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>Library View</span>
                <select
                  value={libraryView}
                  onChange={(event) => setLibraryView(event.target.value)}
                  style={{
                    ...miniBtn,
                    minWidth: 220,
                    background: "#111827",
                    border: "1px solid #334155",
                  }}
                >
                  <option value="user">Private Images</option>
                  <option value="generic">Generic Images</option>
                </select>
              </label>
            </div>
            <div style={{ display: "grid", gap: 4, marginBottom: 12 }}>
              <h2 style={{ margin: 0, color: "#fff", fontSize: 24, fontWeight: 600 }}>{activeLibraryTitle}</h2>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: 16 }}>{activeLibraryDescription}</p>
            </div>
            {libraryView === "user" && permissions.canManageTemplateImages ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                <button type="button" style={miniBtn} onClick={() => selectAllPromotableImages(userOwnedFiles)} disabled={movingSelected || !userOwnedFiles.some(canPromoteToGlobalTemplate)}>
                  Select All Movable Images
                </button>
                <button type="button" style={miniBtn} onClick={clearSelectedImages} disabled={movingSelected || !selectedImageIds.length}>
                  Clear Selection
                </button>
                <button
                  type="button"
                  style={{ ...miniBtn, background: "#0f766e", border: "1px solid #14b8a6", color: "#f0fdfa" }}
                  onClick={moveSelectedToGeneric}
                  disabled={movingSelected || !selectedPromotableImageCount}
                >
                  {movingSelected ? "Moving..." : `Move Selected to Generic Images${selectedPromotableImageCount ? ` (${selectedPromotableImageCount})` : ""}`}
                </button>
                <span style={{ color: "#99f6e4", fontSize: 14 }}>Developer-only bulk move. Non-movable items stay disabled.</span>
              </div>
            ) : null}
            {renderFileGrid(activeLibraryItems, activeEmptyText, libraryView)}
          </section>
        </div>
      )}

      {editingFile ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(2,6,23,0.9)", padding: 20, overflowY: "auto" }}>
          <div style={{ maxWidth: 1380, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 600, color: "#f8fafc" }}>Edit Image</div>
                <div style={{ fontSize: 16, color: "#cbd5e1", lineHeight: 1.5 }}>{editingFile.canManageOriginal ? "Click Save Image to replace the current image in your library." : "Click Save Image to create a new edited copy. Template images stay locked for other users."}</div>
              </div>
              <button onClick={() => !savingEdit && setEditingFile(null)} style={miniBtn}>Close</button>
            </div>
            {savingEdit ? <div style={{ marginBottom: 12, color: "#cbd5e1" }}>Saving edited image...</div> : null}
            <ImageEditorCard initialSrc={editingFile.url} onSave={saveEditedImage} saveLabel="Save Image" />
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
  fontSize: 16
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
  fontWeight: 600,
};

const uploadHint = {
  color: "#9ca3af",
  fontSize: 16,
};

const uploadState = {
  color: "#94a3b8",
  fontSize: 16,
};

