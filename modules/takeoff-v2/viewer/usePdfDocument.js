import { useEffect, useState } from "react";
import { loadPdfDocument } from "./PdfViewport.js";
import { getDocumentFileBlob } from "../persistence/planStore.js";

const cache = new Map(); // documentId -> Promise<pdfjs document proxy>

/** Loads (and caches, per document id) the parsed pdfjs document for a PlanDocument. */
export function usePdfDocument(planDocument) {
  const [pdfDocument, setPdfDocument] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!planDocument) {
      setPdfDocument(null);
      return undefined;
    }

    let cancelled = false;
    setError("");

    if (!cache.has(planDocument.id)) {
      cache.set(planDocument.id, (async () => {
        const blob = await getDocumentFileBlob(planDocument.id);
        const source = blob || planDocument.originalFileUrl;
        return loadPdfDocument(source);
      })());
    }

    cache.get(planDocument.id)
      .then((doc) => { if (!cancelled) setPdfDocument(doc); })
      .catch((err) => {
        cache.delete(planDocument.id);
        if (!cancelled) setError(err.message || "Failed to load PDF.");
      });

    return () => { cancelled = true; };
    // Deliberately depend on primitive fields, not `planDocument` itself, so a new
    // object reference with the same id/url (common from array re-mapping) doesn't
    // trigger a reload loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planDocument?.id, planDocument?.storage, planDocument?.updatedAt]);

  return { pdfDocument, error };
}

export function forgetCachedDocument(documentId) {
  cache.delete(documentId);
}
