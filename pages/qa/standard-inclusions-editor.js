import { useState } from "react";
import DocumentPageBuilder from "../../components/document-engine/editor/DocumentPageBuilder";
import { createPremierInclusionsWorkingCopy } from "../../components/document-engine/templates/premierInclusionsMasterTemplate";

const initialDocument = createPremierInclusionsWorkingCopy({
  builderId: "qa-builder",
  workbookId: "qa-standard-inclusions",
});

export default function StandardInclusionsEditorQaPage() {
  const [document, setDocument] = useState(initialDocument);
  const [status, setStatus] = useState("");

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Page Builder</div>
          <h1 style={styles.title}>Premier Inclusions Schedule</h1>
        </div>
        <strong>{document.pages.length} pages</strong>
        {status ? <span style={styles.status}>{status}</span> : null}
      </section>
      <DocumentPageBuilder
        document={document}
        workbook={{ id: "qa-standard-inclusions" }}
        onChange={setDocument}
        onStatus={setStatus}
      />
    </main>
  );
}

StandardInclusionsEditorQaPage.disableLayout = true;

const styles = {
  page: { minHeight: "100vh", background: "#f6f8fb", color: "#0f172a", padding: 22 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: 16, padding: 16, marginBottom: 14 },
  eyebrow: { color: "#0f766e", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.08 },
  title: { margin: 0, color: "#0f172a", fontSize: 28, lineHeight: 1.12, fontWeight: 950 },
  status: { border: "1px solid #bae6fd", background: "#eff6ff", color: "#075985", borderRadius: 8, padding: "8px 10px", fontWeight: 900 },
};
