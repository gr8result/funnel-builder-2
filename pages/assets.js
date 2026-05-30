// pages/assets.js
// File uploader + file list under /assets bucket at /<userId>/.
// Content-only: Layout (with SideNav + TopNav) is applied globally in _app.js.

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import ImageEditorCard from "../components/image-editor/ImageEditorCard";
import { GRID_ICON_LIBRARY } from "../components/website-builder/gridIconLibrary";

const INITIAL_VISIBLE_COUNT = 48;
const GLOBAL_TEMPLATE_IMPORT_BATCH_SIZE = 25;

// Serialise a rendered <svg> element to a data: URI so component icons can be
// used anywhere an image URL is expected (e.g. counter block background).
function svgElToDataUri(svgEl, color = "#ffffff") {
  if (!svgEl) return "";
  try {
    const clone = svgEl.cloneNode(true);

    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", "0 0 24 24");
    clone.setAttribute("width", "64");
    clone.setAttribute("height", "64");
    // tint stroke/fill to the requested colour
    clone.querySelectorAll("[stroke]").forEach((el) => {
      if (el.getAttribute("stroke") !== "none") el.setAttribute("stroke", color);
    });
    clone.querySelectorAll("[fill]").forEach((el) => {
      if (el.getAttribute("fill") !== "none") el.setAttribute("fill", color);
    });
    if (!clone.getAttribute("fill")) clone.setAttribute("fill", color);
    const svgStr = clone.outerHTML;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgStr)))}`;
  } catch { return ""; }
}
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

  // Client-side developer check — used as fallback if the API permissions response is missing.
  // Mirrors the server-side isDeveloperEmail logic in lib/adminUsers.js.
  const DEV_EMAILS = ['admin@gr8result.com', 'developer@gr8result.com', 'grant@gr8result.com', 'support@gr8result.com'];
  const userEmail = String(session?.user?.email || '').toLowerCase().trim();
  const isDev = permissions.canManageTemplateImages
    || DEV_EMAILS.includes(userEmail)
    || userEmail.endsWith('@gr8result.com')
    || userEmail.endsWith('@gr8result.com.au');
  const [selectedImageIds, setSelectedImageIds] = useState([]);
  const [movingSelected, setMovingSelected] = useState(false);
  const [copyingSelected, setCopyingSelected] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [uploadingIcons, setUploadingIcons] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    const nextView = String(router.query?.view || "").toLowerCase();
    if (nextView === "generic" || nextView === "user" || nextView === "icons") {
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
    // When showLoader is false and includeEmailTemplateRefs wasn't explicitly provided,
    // this is almost always a post-mutation refresh — bypass the server cache.
    const {
      showLoader = true,
      includeEmailTemplateRefs = true,
      noCache = (!showLoader && !('includeEmailTemplateRefs' in options)),
    } = options;
    if (showLoader) setLoading(true);
    if (!session?.access_token) {
      setFiles([]);
      if (showLoader) setLoading(false);
      return [];
    }
    const params = new URLSearchParams({ includeEmailTemplateRefs: includeEmailTemplateRefs ? "1" : "0" });
    if (noCache) params.set("noCache", "1");
    const response = await fetch(`/api/assets/list-library?${params}`, {
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

  async function onUploadIcons(e) {
    const selected = Array.from(e.target.files || []);
    e.target.value = "";
    if (!selected.length || !session) return;
    setUploadingIcons(true);
    try {
      for (const file of selected) {
        await uploadSingle(file, "icon");
      }
      await listFiles({ showLoader: false });
      setLibraryView("icons");
    } catch (error) {
      alert(error.message || "Icon upload failed");
    } finally {
      setUploadingIcons(false);
    }
  }

  function canPromoteToGlobalTemplate(file) {
    if (!file || file?.owner_scope === "generic") return false;
    if (!isMovableLibraryEntry(file)) return false;
    // Show the button to everyone; the API enforces developer-only access.
    // This ensures the developer always sees it regardless of permissions response.
    return true;
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

  function selectAllManageableImages(items) {
    setSelectedImageIds(items.filter(canManageOriginalFile).map((item) => getFileSelectionKey(item)).filter(Boolean));
  }

  async function deleteSelectedImages() {
    if (!session?.access_token || !selectedImageIds.length) return;
    const selectedFiles = files.filter((file) =>
      selectedImageIds.includes(getFileSelectionKey(file)) && canManageOriginalFile(file)
    );
    if (!selectedFiles.length) return;
    const ok = confirm(`Delete ${selectedFiles.length} selected image${selectedFiles.length === 1 ? "" : "s"}? This cannot be undone.`);
    if (!ok) return;
    setBulkDeleting(true);
    setStatusMessage("");
    let deletedCount = 0;
    let failedCount = 0;
    const deletedKeys = [];
    for (const file of selectedFiles) {
      try {
        const deleteParams = new URLSearchParams({ id: file?.id || '' });
        if (String(file?.id || '').startsWith('generic:') && file?.url) {
          deleteParams.set('url', file.url);
        }
        const response = await fetch(`/api/social/delete-image?${deleteParams.toString()}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const payload = await response.json();
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Delete failed');
        deletedKeys.push(getFileSelectionKey(file));
        deletedCount++;
      } catch (err) {
        console.error('Delete failed for', file?.id, err?.message);
        failedCount++;
      }
    }
    if (deletedKeys.length) {
      setFiles((prev) => prev.filter((f) => !deletedKeys.includes(getFileSelectionKey(f))));
    }
    clearSelectedImages();
    await listFiles({ showLoader: false });
    setStatusMessage(failedCount
      ? `Deleted ${deletedCount} image${deletedCount === 1 ? "" : "s"}. ${failedCount} failed — check console for details.`
      : `Deleted ${deletedCount} image${deletedCount === 1 ? "" : "s"}.`);
    setBulkDeleting(false);
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
      const deleteParams = new URLSearchParams({ id: file?.id || '' });
      if (String(file?.id || '').startsWith('generic:') && file?.url) {
        deleteParams.set('url', file.url);
      }
      const response = await fetch(`/api/social/delete-image?${deleteParams.toString()}`, {
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
    if (!session?.access_token || !isDev) return;
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

  const COPY_TO_PRIVATE_BATCH_SIZE = 25;

  async function copySelectedToPrivate() {
    if (!session?.access_token) return;
    const selectedFiles = genericFiles.filter((file) => selectedImageIds.includes(getFileSelectionKey(file)) && file?.url);
    if (!selectedFiles.length) {
      setStatusMessage("No generic images are selected.");
      return;
    }

    const ok = confirm(`Copy ${selectedFiles.length} selected image${selectedFiles.length === 1 ? "" : "s"} to your private images?`);
    if (!ok) return;

    setCopyingSelected(true);
    setStatusMessage("");
    try {
      let copiedCount = 0;
      let failedCount = 0;

      for (let index = 0; index < selectedFiles.length; index += COPY_TO_PRIVATE_BATCH_SIZE) {
        const chunk = selectedFiles.slice(index, index + COPY_TO_PRIVATE_BATCH_SIZE);
        const response = await fetch("/api/assets/copy-to-private", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            assets: chunk.map((file) => ({
              imageUrl: file.url,
              name: file.name || file.description || "Image",
            })),
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || "Could not copy images to private library.");
        }
        const results = Array.isArray(payload.results) ? payload.results : [];
        copiedCount += results.filter((r) => r.ok).length;
        failedCount += results.filter((r) => !r.ok).length;
      }

      clearSelectedImages();
      await listFiles({ showLoader: false });
      setStatusMessage(
        failedCount === 0
          ? `Copied ${copiedCount} image${copiedCount === 1 ? "" : "s"} to your private images.`
          : `Copied ${copiedCount} image${copiedCount === 1 ? "" : "s"}. ${failedCount} failed.`
      );
      setLibraryView("user");
    } catch (error) {
      setStatusMessage(error.message || "Could not copy selected images to private library.");
    } finally {
      setCopyingSelected(false);
    }
  }

  async function cleanupLibrary() {
    if (!session?.access_token) return;
    if (!isDev) {
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
    // Non-generic (private) images: always manageable by their owner.
    if (file?.owner_scope !== "generic") return true;
    // Generic library images require developer access.
    return isDev;
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

  const iconFiles = files.filter((file) => {
    const sp = String(file?.storage_path || "");
    const filename = sp.split("/").pop() || "";
    return filename.startsWith("icon-") && file?.owner_scope !== "generic";
  });
  const userOwnedFiles = files.filter((file) => {
    const sp = String(file?.storage_path || "");
    const filename = sp.split("/").pop() || "";
    // Exclude generic, icon files, auto-materialized email template images,
    // and raw email-template: reference entries (undeletable ghosts that re-appear every load).
    if (file?.owner_scope === "generic") return false;
    if (filename.startsWith("icon-")) return false;
    if (isAutoMaterializedEmailTemplateImage(file)) return false;
    if (sp.startsWith("email-template:")) return false;
    return true;
  });
  const genericFiles = [...files.filter((file) => file?.owner_scope === "generic")].sort((a, b) => {
    const aStored = String(a?.storage_path || "").startsWith("assets:generic/") ? 0 : 1;
    const bStored = String(b?.storage_path || "").startsWith("assets:generic/") ? 0 : 1;
    return aStored - bStored;
  });
  const selectedUserImageCount = userOwnedFiles.filter((file) => selectedImageIds.includes(getFileSelectionKey(file))).length;
  const selectedPromotableImageCount = userOwnedFiles.filter((file) => selectedImageIds.includes(getFileSelectionKey(file)) && canPromoteToGlobalTemplate(file)).length;
  const activeLibraryItems = libraryView === "generic" ? genericFiles : libraryView === "icons" ? iconFiles : userOwnedFiles;
  const selectedInCurrentSectionCount = activeLibraryItems.filter((f) => selectedImageIds.includes(getFileSelectionKey(f)) && canManageOriginalFile(f)).length;
  const activeLibraryTitle = libraryView === "generic" ? "Generic Site Images" : libraryView === "icons" ? "Icon Library" : "Your Images";
  const activeLibraryDescription = libraryView === "generic"
    ? "These are global starter images for sites and funnels."
    : libraryView === "icons"
    ? "Upload custom icons and graphics for use as background decorations in counter blocks and other elements."
    : "These are your private uploads and saved edits. Only you can manage them.";
  const activeEmptyText = libraryView === "generic"
    ? "No generic site images are available right now."
    : libraryView === "icons"
    ? "No icons uploaded yet. Upload SVG, PNG, or WebP icon files above."
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
          const showSelectionControl = (!pickerMode || isDev) && canManageOriginal;
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
                    color: isSelected ? "#ccfbf1" : "#94a3b8",
                    fontSize: 16,
                    fontWeight: 600,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: isSelected ? "rgba(13,148,136,0.14)" : "rgba(30,41,59,0.50)",
                    border: isSelected ? "1px solid rgba(45,212,191,0.45)" : "1px solid rgba(100,116,139,0.28)",
                    cursor: "pointer",
                    width: "100%",
                    textAlign: "left",
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleImageSelection(selectionKey);
                  }}
                >
                  <span>{isSelected ? "Selected" : "Select"}</span>
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
                      fontSize: 16,
                      fontWeight: 600,
                      lineHeight: 1,
                      border: "2px solid #14b8a6",
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
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const placeholder = e.currentTarget.parentElement;
                    if (placeholder && !placeholder.dataset.errored) {
                      placeholder.dataset.errored = "1";
                      placeholder.style.flexDirection = "column";
                      placeholder.style.gap = "8px";
                      const icon = document.createElement("span");
                      icon.textContent = "🖼️";
                      icon.style.cssText = "font-size:32px;opacity:0.3";
                      const label = document.createElement("span");
                      label.textContent = "No preview";
                      label.style.cssText = "font-size:11px;color:#475569;text-align:center";
                      placeholder.appendChild(icon);
                      placeholder.appendChild(label);
                    }
                  }}
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
                {(!pickerMode || isDev) && canPromoteToGlobalTemplate(f) ? (
                  <button
                    onClick={() => saveAsGlobalTemplate(f)}
                    style={{ ...miniBtn, background: "#0f766e", border: "none", color: "#fff" }}
                    title="Save this image into the global template library and remove it from your private images"
                    disabled={deletingName === f.id}
                  >
                    {deletingName === f.id ? "Saving..." : "Save as Global Template"}
                  </button>
                ) : null}
                {(!pickerMode || isDev) && canManageOriginal ? (
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
          <div style={{ marginBottom: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(37,99,235,0.16)", border: "1px solid rgba(59,130,246,0.35)", color: "#dbeafe", fontSize: 16, fontWeight: 600 }}>
            Double-click any image to insert it back into the editor.
          </div>
        ) : null}
        <p style={{ color: "#94a3b8", marginTop: 0 }}>
          Uploads go to <code>/{prefix}filename.ext</code>. Public read is enabled.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          {syncing ? <span style={{ color: "#cbd5e1", fontSize: 16 }}>Loading email-template images in the background...</span> : null}
          <button onClick={() => listFiles()} style={miniBtn}>Refresh</button>
          {isDev ? (
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

          <label style={uploadCard}>
            <div style={uploadTitle}>Upload Icons</div>
            <div style={uploadHint}>SVG or PNG icons for counter blocks &amp; decorations</div>
            <input type="file" accept="image/svg+xml,image/png,image/webp,image/*" multiple onChange={onUploadIcons} disabled={uploadingIcons} />
            <div style={uploadState}>{uploadingIcons ? "Uploading icons..." : "SVG, PNG, WEBP"}</div>
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
                <span style={{ color: "#e2e8f0", fontSize: 16, fontWeight: 600 }}>Library View</span>
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
                  <option value="icons">Icon Library</option>
                </select>
              </label>
            </div>
            <div style={{ display: "grid", gap: 4, marginBottom: 12 }}>
              <h2 style={{ margin: 0, color: "#fff", fontSize: 24, fontWeight: 600 }}>{activeLibraryTitle}</h2>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: 16 }}>{activeLibraryDescription}</p>
            </div>
            {(!pickerMode || isDev) && selectedInCurrentSectionCount > 0 ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(45,212,191,0.28)" }}>
                <span style={{ color: "#99f6e4", fontSize: 16, fontWeight: 600 }}>{selectedInCurrentSectionCount} image{selectedInCurrentSectionCount !== 1 ? "s" : ""} selected</span>
                <button
                  type="button"
                  style={{ ...miniBtn, background: "#3a0f12", border: "1px solid #5b1a1f", color: "#ffd7db" }}
                  onClick={deleteSelectedImages}
                  disabled={bulkDeleting}
                >
                  {bulkDeleting ? "Deleting..." : `Delete Selected (${selectedInCurrentSectionCount})`}
                </button>
                <button type="button" style={miniBtn} onClick={clearSelectedImages} disabled={bulkDeleting}>
                  Clear Selection
                </button>
              </div>
            ) : null}
            {(!pickerMode || isDev) && activeLibraryItems.some(canManageOriginalFile) ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                <button type="button" style={miniBtn} onClick={() => selectAllManageableImages(activeLibraryItems)} disabled={bulkDeleting}>
                  Select All
                </button>
                {selectedInCurrentSectionCount > 0 ? (
                  <button type="button" style={miniBtn} onClick={clearSelectedImages} disabled={bulkDeleting}>Clear</button>
                ) : null}
              </div>
            ) : null}
            {libraryView === "user" && isDev ? (
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
                <span style={{ color: "#99f6e4", fontSize: 16 }}>Developer-only bulk move. Non-movable items stay disabled.</span>
              </div>
            ) : null}
            {libraryView === "generic" ? (() => {
              const selectedGenericCount = genericFiles.filter((f) => selectedImageIds.includes(getFileSelectionKey(f)) && f?.url).length;
              return (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                  <button type="button" style={miniBtn} onClick={() => setSelectedImageIds(genericFiles.filter((f) => f?.url).map(getFileSelectionKey))} disabled={copyingSelected || !genericFiles.some((f) => f?.url)}>
                    Select All
                  </button>
                  <button type="button" style={miniBtn} onClick={clearSelectedImages} disabled={copyingSelected || !selectedImageIds.length}>
                    Clear Selection
                  </button>
                  <button
                    type="button"
                    style={{ ...miniBtn, background: "#1e40af", border: "1px solid #3b82f6", color: "#eff6ff" }}
                    onClick={copySelectedToPrivate}
                    disabled={copyingSelected || !selectedGenericCount}
                  >
                    {copyingSelected ? "Copying..." : `Copy to My Images${selectedGenericCount ? ` (${selectedGenericCount})` : ""}`}
                  </button>
                  <span style={{ color: "#93c5fd", fontSize: 16 }}>Copies selected generic images into your private library.</span>
                </div>
              );
            })() : null}
            {libraryView === "icons" ? (
              <div style={{ marginBottom: 28 }}>
                {/* Group icons by their group property */}
                {(() => {
                  const groups = [];
                  const seen = new Set();
                  GRID_ICON_LIBRARY.forEach((entry) => {
                    if (!seen.has(entry.group)) { seen.add(entry.group); groups.push(entry.group); }
                  });
                  return groups.map((group) => {
                    const entries = GRID_ICON_LIBRARY.filter((e) => e.group === group);
                    return (
                      <div key={group} style={{ marginBottom: 22 }}>
                        <h3 style={{ color: "#64748b", fontSize: 16, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px" }}>{group}</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))", gap: 8 }}>
                          {entries.map((entry) => {
                            const IconComp = entry.Icon || null;
                            return (
                              <button
                                key={entry.key}
                                type="button"
                                title={entry.label}
                                onClick={(e) => {
                                  if (!pickerMode || !pickerChannel || typeof window === "undefined") return;
                                  let url = entry.src || "";
                                  if (!url && IconComp) {
                                    const svgEl = e.currentTarget.querySelector("svg");
                                    url = svgElToDataUri(svgEl);
                                  }
                                  if (!url) return;
                                  const payload = {
                                    type: "gr8:media-picker-select",
                                    channel: pickerChannel,
                                    asset: { id: entry.key, src: url, url, name: entry.label, description: entry.label, storage_path: "", owner_scope: "builtin" },
                                  };
                                  try {
                                    if (window.opener && !window.opener.closed) { window.opener.postMessage(payload, window.location.origin); window.close(); }
                                  } catch {}
                                }}
                                style={{
                                  background: "#0f172a",
                                  border: "1px solid #1e293b",
                                  borderRadius: 10,
                                  padding: "10px 6px 8px",
                                  cursor: pickerMode ? "copy" : "default",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  gap: 6,
                                  transition: "border-color .15s",
                                }}
                                onMouseEnter={(e) => { if (pickerMode) e.currentTarget.style.borderColor = "#38bdf8"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1e293b"; }}
                              >
                                {entry.src
                                  ? <img src={entry.src} alt={entry.label} style={{ width: 36, height: 36, objectFit: "contain" }} />
                                  : IconComp ? <IconComp size={32} color="#e2e8f0" />
                                  : null
                                }
                                <span style={{ color: "#64748b", fontSize: 16, textAlign: "center", lineHeight: 1.2, maxWidth: 74, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
                {iconFiles.length > 0 ? (
                  <>
                    <h3 style={{ color: "#64748b", fontSize: 16, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", margin: "24px 0 10px" }}>Your Uploaded Icons</h3>
                  </>
                ) : null}
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

