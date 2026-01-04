// ============================================
// /components/email/GrapesEmailEditor.js
// FULL REPLACEMENT — GrapesJS email editor with Blocks + Image Library
//
// Requires deps:
//   npm i grapesjs grapesjs-preset-newsletter
// ============================================

import { useEffect, useRef } from "react";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import presetNewsletter from "grapesjs-preset-newsletter";
import { registerGr8Blocks } from "./grapes/gr8Blocks";

const BUCKET_USER = "email-user-assets";

export default function GrapesEmailEditor({ initialHtml, userId, onDirty, onReady }) {
  const editorRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (editorRef.current) return;

    const editor = grapesjs.init({
      container: containerRef.current,
      height: "78vh",
      fromElement: false,
      storageManager: false,
      selectorManager: { componentFirst: true },
      styleManager: { clearProperties: true },
      deviceManager: {
        devices: [
          { name: "Desktop", width: "" },
          { name: "Mobile", width: "375px", widthMedia: "480px" },
        ],
      },
      canvas: {
        styles: [
          "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap",
        ],
      },
      plugins: [presetNewsletter],
      pluginsOpts: {
        [presetNewsletter]: {
          modalTitleImport: "Import Email HTML",
          modalTitleExport: "Export Email HTML",
          codeViewerTheme: "hopscotch",
          // keep it simple + stable
          importPlaceholder: "",
        },
      },
    });

    editorRef.current = editor;

    // Apply dark-ish editor UI tweaks
    const p = editor.Panels;
    p.addPanel({ id: "gr8-top", el: ".gjs-pn-panel.gjs-pn-commands" });

    // Register your blocks (Header, Hero, Text, Image, Button, Divider, Spacer, Footer)
    registerGr8Blocks(editor);

    // Load template
    const html = String(initialHtml || "");
    if (html && html.length > 20) {
      editor.setComponents(html);
    }

    // Dirty tracking
    const markDirty = () => onDirty && onDirty();
    editor.on("component:update", markDirty);
    editor.on("change:changesCount", markDirty);

    // Image asset manager (from your Supabase public bucket path)
    editor.on("run:open-assets", async () => {
      if (!userId) return;

      // Try list from your existing storage folder: {userId}/email-images
      const listUrl = `/api/email/list-builder-images?userId=${encodeURIComponent(userId)}`;

      let urls = [];
      try {
        const r = await fetch(listUrl);
        const j = await r.json();
        if (j?.ok && Array.isArray(j.urls)) urls = j.urls;
      } catch {}

      // Fallback direct public listing isn't possible client-only without Supabase keys,
      // so this expects your endpoint OR you can rely on uploads below.
      const am = editor.AssetManager;
      am.add(
        urls.map((u) => ({
          src: u,
          type: "image",
        }))
      );
    });

    // Provide API to parent
    onReady &&
      onReady({
        getHtmlFull: () => editor.getHtml() + `<style>${editor.getCss()}</style>`,
        getHtmlOnly: () => editor.getHtml(),
        getCss: () => editor.getCss(),
        editor,
      });

    return () => {
      try {
        editor.destroy();
      } catch {}
      editorRef.current = null;
    };
  }, [initialHtml, userId, onDirty, onReady]);

  return (
    <div
      style={{
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(0,0,0,.25)",
      }}
    >
      <div ref={containerRef} />
      <style jsx global>{`
        /* Make Grapes UI sit nicely in your dark shell */
        .gjs-one-bg {
          background-color: #0b1220 !important;
        }
        .gjs-two-color {
          color: #e5e7eb !important;
        }
        .gjs-three-bg {
          background-color: #111827 !important;
        }
        .gjs-four-color,
        .gjs-four-color-h:hover {
          color: #38bdf8 !important;
        }
        .gjs-pn-btn {
          border-radius: 10px !important;
        }
        .gjs-block {
          border-radius: 12px !important;
        }
      `}</style>
    </div>
  );
}
