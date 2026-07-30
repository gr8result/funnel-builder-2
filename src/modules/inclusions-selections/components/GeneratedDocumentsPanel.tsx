import type { GeneratedDocumentRecord } from "../repositories/documentsExportRepository";

export function GeneratedDocumentsPanel({ documents }: { documents: GeneratedDocumentRecord[] }) {
  return <section className="documentsCard"><h2>Generated Documents</h2><div className="documentsRows">{documents.map((document) => <div key={document.id} className="documentsRow"><strong>{document.fileName}</strong><span>{document.documentType}</span><span>{document.audience}</span><span>v{document.documentVersion}</span><span>{document.status}</span><span>{document.generatedAt}</span><span>{document.storageReference ?? "No file"}</span><span>{document.failureReason ?? ""}</span></div>)}</div></section>;
}
