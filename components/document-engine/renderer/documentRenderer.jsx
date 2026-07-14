import React from "react";
import { getActivePage } from "../core/documentState.js";
import { PageRenderer } from "./pageRenderer.jsx";

export function DocumentRenderer({ document, workbook = null, selection = null, onSelectObject }) {
  const page = getActivePage(document);
  if (!page) return null;
  return (
    <div data-document-engine-renderer style={{ display: "grid", placeItems: "center", minHeight: "100%" }}>
      <PageRenderer page={page} workbook={workbook} selection={selection || document.selection} onSelectObject={onSelectObject} />
    </div>
  );
}
