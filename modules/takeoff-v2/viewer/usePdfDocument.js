import { useEffect, useState } from "react";
import { getPdfFileBlob } from "../persistence/pdfFileStore.js";
import { loadPdfDocument } from "./PdfViewport.js";

const cache = new Map(); // documentId -> { promise, revoke }

function loadDocumentFromStoredFile(planDocument) {
  let objectUrl = "";
  const promise = (async () => {
    const blob = await getPdfFileBlob(planDocument);
    if (!blob) {
      throw new Error("Uploaded PDF file is missing from local file storage.");
    }
    objectUrl = URL.createObjectURL(blob);
    return loadPdfDocument(objectUrl);
  })().catch((err) => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = "";
    throw err;
  });
  return {
    promise,
    revoke: () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = "";
    },
  };
}

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
      cache.set(planDocument.id, loadDocumentFromStoredFile(planDocument));
    }

    cache.get(planDocument.id).promise
      .then((doc) => { if (!cancelled) setPdfDocument(doc); })
      .catch((err) => {
        forgetCachedDocument(planDocument.id);
        if (!cancelled) setError(err.message || "Failed to load PDF.");
      });

    return () => { cancelled = true; };
    // Deliberately depend on primitive fields, not `planDocument` itself, so a new
    // object reference with the same id/url (common from array re-mapping) doesn't
    // trigger a reload loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planDocument?.id, planDocument?.fileStorageKey]);

  return { pdfDocument, error };
}

export function forgetCachedDocument(documentId) {
  const cached = cache.get(documentId);
  cached?.revoke?.();
  cache.delete(documentId);
}
