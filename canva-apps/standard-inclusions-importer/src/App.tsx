import React, { useState } from "react";
import { completeImport, uploadManifest, uploadRenderedPageAsset } from "./gr8ImportClient";
import { applyRenderedPageAssets, exportCanvaPageReferences, readCurrentCanvaDesign } from "./canvaDesignReader";
import type { CanvaImportManifest } from "./types";

const DEFAULT_GR8_URL = "http://127.0.0.1:3000";

export function App() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_GR8_URL);
  const [importToken, setImportToken] = useState("");
  const [manifest, setManifest] = useState<CanvaImportManifest | null>(null);
  const [status, setStatus] = useState("Ready.");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function runAnalyse() {
    setBusy(true);
    setResult(null);
    try {
      const nextManifest = await readCurrentCanvaDesign(setStatus);
      setManifest(nextManifest);
      setStatus(`Design analysed. ${nextManifest.pages.length} page${nextManifest.pages.length === 1 ? "" : "s"} detected.`);
    } catch (error: any) {
      setStatus(error?.message || "Could not analyse Canva design.");
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!manifest) {
      setStatus("Analyse the design before importing.");
      return;
    }
    if (!importToken.trim()) {
      setStatus("Paste a Gr8 Result import session token before importing.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      setStatus("Exporting visual references...");
      const exportResult = await exportCanvaPageReferences(setStatus).catch((error) => {
        console.warn("Visual reference export failed", error);
        return null;
      });
      const importManifest = exportResult ? applyRenderedPageAssets(manifest, exportResult) : manifest;
      setStatus("Uploading editable manifest...");
      await uploadManifest({ baseUrl, importToken }, importManifest);
      const renderedPages = importManifest.pages.map((page) => ({ page, asset: page.renderedPageAsset })).filter((item) => item.asset);
      for (const { page, asset } of renderedPages) {
        setStatus(`Uploading rendered page ${page.pageIndex} of ${importManifest.pages.length}...`);
        await uploadRenderedPageAsset({ baseUrl, importToken }, {
          sourceElementId: asset!.sourceElementId,
          sourcePageId: page.sourcePageId,
          pageIndex: page.pageIndex,
          fileName: asset!.fileName,
          mimeType: asset!.mimeType || "image/png",
          publicUrl: asset!.publicUrl,
          base64: asset!.base64,
        });
      }
      setStatus("Creating editable template...");
      const completed = await completeImport({ baseUrl, importToken });
      setResult(completed);
      setStatus(`Import completed. ${importManifest.pages.length} pages imported into Gr8 Result.`);
    } catch (error: any) {
      setStatus(error?.message || "Import failed. No partial active template was created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <h1>Send to Gr8 Result</h1>
      <section className="panel">
        <label>
          Gr8 Result URL
          <input value={baseUrl} onChange={(event) => setBaseUrl(event.currentTarget.value)} />
        </label>
        <label>
          Import session token
          <textarea value={importToken} onChange={(event) => setImportToken(event.currentTarget.value)} placeholder="Create this in Gr8 Result, then paste it here." />
        </label>
      </section>
      <section className="panel">
        <div><strong>Design:</strong> {manifest?.designName || "Not analysed"}</div>
        <div><strong>Pages detected:</strong> {manifest?.pages.length || 0}</div>
        <button disabled={busy} onClick={runAnalyse}>Analyse Design</button>
        <button disabled={busy || !manifest} onClick={runImport}>Import this design into Gr8 Result</button>
      </section>
      <section className="panel">
        <strong>Status</strong>
        <p>{status}</p>
        {result ? <a href={`${baseUrl.replace(/\/$/, "")}/modules/estimate-builder`} target="_blank" rel="noreferrer">Open in Gr8 Result</a> : null}
      </section>
    </main>
  );
}
