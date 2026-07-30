import type { DocumentsExportStage } from "../services/documentsExportService";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function SnapshotVersionSelector({ stage, onSelect }: { stage: DocumentsExportStage; onSelect: (version: number) => void }) {
  return <section className="documentsCard"><h2>Snapshot Version Selector</h2><div className="documentsRows">{stage.snapshots.map((snapshot) => {
    const exported = stage.exportBatches.some((batch) => batch.snapshotId === snapshot.id && batch.status === "completed");
    const generated = stage.generatedDocuments.some((document) => document.snapshotId === snapshot.id && document.status === "generated");
    const superseding = stage.snapshots.find((item) => item.supersedesSnapshotId === snapshot.id);
    return <button type="button" className={`documentsRow ${stage.selectedSnapshot?.id === snapshot.id ? "selected" : ""}`} key={snapshot.id} onClick={() => onSelect(snapshot.version)}><strong>Version {snapshot.version}</strong><span>{snapshot.lockedAt}</span><span>{snapshot.status}</span><span>{superseding ? `Superseded by v${superseding.version}` : "Current or historical"}</span><span>{snapshot.lockedAt}</span><span>{exported ? "Exported" : "Not exported"}</span><span>{generated ? "Generated" : "Not generated"}</span><span>{currency.format(snapshot.netVariationIncludingGst.amount)}</span></button>;
  })}</div></section>;
}
