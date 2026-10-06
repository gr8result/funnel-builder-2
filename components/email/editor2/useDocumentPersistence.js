import { useCallback } from "react";
import { emailEditorFetch } from "./emailEditorApi";
import { normalizeEmailSettings, packBlocksForSave } from "./blockModel.js";
import { exportFullHtml } from "./htmlExport.js";
import { activeRichTextApi } from "./richTextCanvas.jsx";
import { uid } from "./editorUtils.js";

// EmailEditor owns the stable ref, state setters, and memoized notification
// callbacks. Their existing dependency behavior is preserved by this extraction.
export function useDocumentPersistence({ canvasRef, userId, blocks, docSettings, docId, docName, templateScope, templatePath, setIsSaving, setTemplatePath, setTemplateScope, setDocId, setDocName, showToast, showSaveDialog, onSaved }) {
  const captureThumbnail = useCallback(async (targetDocId) => {
    if (!canvasRef.current || !userId) return null;
    try {
      const h2c = (await import("html2canvas")).default;
      const cvs = await h2c(canvasRef.current, { useCORS: true, scale: 0.5, backgroundColor: "#ffffff", logging: false });
      return new Promise((resolve) => {
        cvs.toBlob(async (blob) => {
          if (!blob) return resolve(null);
          const reader = new FileReader();
          reader.onload = async (e) => {
            const base64 = e.target.result;
            try {
              const resp = await emailEditorFetch(`/api/email/editor-images?userId=${encodeURIComponent(userId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, filename: `thumb-${targetDocId}.png`, base64, folder: "builder-docs" }),
              }, {
                authErrorMessage: "Sign in required to save thumbnails.",
              });
              const data = await resp.json().catch(() => ({}));
              resolve(data?.url || null);
            } catch { resolve(null); }
          };
          reader.readAsDataURL(blob);
        }, "image/png");
      });
    } catch (e) {
      console.warn("Thumbnail capture failed:", e);
      return null;
    }
  }, [userId]);

  const buildSavePayload = useCallback((targetDocId, name, thumbUrl = "") => {
    const emailSettings = normalizeEmailSettings(docSettings);
    const savedBlocks = packBlocksForSave(blocks, emailSettings);
    const html = exportFullHtml(savedBlocks, name, emailSettings);

    return {
      userId,
      docId: targetDocId,
      id: targetDocId,
      name,
      subject: name,
      templateName: name,
      previewText: emailSettings.preheaderText || "",
      preheaderText: emailSettings.preheaderText || "",
      emailSettings,
      templateScope: templateScope || "",
      templatePath: templatePath || "",
      blocks: savedBlocks,
      html,
      thumbUrl,
    };
  }, [userId, blocks, docSettings, templateScope, templatePath]);

  // ── Save ───────────────────────────────────────────────────────
  const saveDoc = useCallback(async () => {
    if (!userId) {
      const message = "Sign in required to save.";
      showToast(message, "err");
      showSaveDialog(message, "err");
      return;
    }
    setIsSaving(true);
    try {
      activeRichTextApi?.commit?.();
      // If this editor was opened from an existing template path, save back in place.
      if (templatePath) {
        const savePayload = buildSavePayload(docId, docName);
        const resp = await emailEditorFetch("/api/email/save-base-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            name: docName,
            subject: savePayload.subject,
            templateName: savePayload.templateName,
            previewText: savePayload.previewText,
            preheaderText: savePayload.preheaderText,
            emailSettings: savePayload.emailSettings,
            blocks: savePayload.blocks,
            html: savePayload.html,
            path: templatePath,
            scope: templateScope || "public",
          }),
        }, {
          authErrorMessage: "Sign in required to save.",
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data?.ok) throw new Error(data?.error || "Save failed");
        if (data?.path) setTemplatePath(data.path);
        if (data?.scope) setTemplateScope(data.scope);
        showToast("Template saved in place!", "ok");
        showSaveDialog("Your email template was saved successfully.", "ok");
        return;
      }

      const thumbUrl = await captureThumbnail(docId);
      const savePayload = buildSavePayload(docId, docName, thumbUrl);
      const resp = await emailEditorFetch("/api/email/builder-doc-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savePayload),
      }, {
        authErrorMessage: "Sign in required to save.",
      });
      const data = await resp.json().catch(() => ({}));
      if (!data.ok) throw new Error(data.error || "Save failed");
      showToast("Saved!", "ok");
      showSaveDialog(`Saved successfully as "${docName}".`, "ok");
      onSaved?.(docId, docName);
    } catch (err) {
      const message = err?.message || "Save failed.";
      showToast(message, "err");
      showSaveDialog(message, "err");
    } finally {
      setIsSaving(false);
    }
  }, [userId, docId, docName, showToast, onSaved, captureThumbnail, templatePath, templateScope, buildSavePayload]);

  // ── Save As ────────────────────────────────────────────────────
  const saveAs = useCallback(async () => {
    if (!userId) {
      const message = "Sign in required to save a copy.";
      showToast(message, "err");
      showSaveDialog(message, "err");
      return;
    }
    const newName = window.prompt("Save a copy as:", (docName || "Email") + " Copy");
    if (!newName) return;
    const newId = uid();
    setIsSaving(true);
    try {
      activeRichTextApi?.commit?.();
      const thumbUrl = await captureThumbnail(newId);
      const savePayload = {
        ...buildSavePayload(newId, newName, thumbUrl),
        templateScope: "",
        templatePath: "",
      };
      const resp = await emailEditorFetch("/api/email/builder-doc-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savePayload),
      }, {
        authErrorMessage: "Sign in required to save a copy.",
      });
      const data = await resp.json().catch(() => ({}));
      if (!data.ok) throw new Error(data.error || "Save failed");
      setDocId(newId);
      setDocName(newName);
      setTemplatePath("");
      setTemplateScope("");
      // Update URL without reload so the user edits the new copy
      const url = new URL(window.location.href);
      url.searchParams.set("id", newId);
      url.searchParams.delete("templatePath");
      url.searchParams.delete("templateScope");
      url.searchParams.delete("templateName");
      url.searchParams.delete("templateUrl");
      url.searchParams.delete("starter");
      url.searchParams.delete("preset");
      window.history.replaceState({}, "", url.toString());
      showToast(`Saved as "${newName}"!`, "ok");
      showSaveDialog(`Your file was saved properly as "${newName}".`, "ok");
      onSaved?.(newId, newName);
    } catch (err) {
      const message = err?.message || "Save As failed.";
      showToast(message, "err");
      showSaveDialog(message, "err");
    } finally {
      setIsSaving(false);
    }
  }, [userId, docName, showToast, onSaved, captureThumbnail, buildSavePayload]);

  return { saveDoc, saveAs };
}
