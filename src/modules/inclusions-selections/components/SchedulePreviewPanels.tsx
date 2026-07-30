import type { DocumentProjection } from "../repositories/documentsExportRepository";
import { DocumentPreviewPanel } from "./DocumentPreviewPanel";

export function ClientSelectionSchedulePreview({ projection }: { projection: DocumentProjection }) {
  return <DocumentPreviewPanel projection={projection} />;
}

export function BuilderSchedulePreview({ projection }: { projection: DocumentProjection }) {
  return <DocumentPreviewPanel projection={projection} />;
}

export function SiteSchedulePreview({ projection }: { projection: DocumentProjection }) {
  return <DocumentPreviewPanel projection={projection} />;
}

export function TradeSchedulePreview({ projection }: { projection: DocumentProjection }) {
  return <DocumentPreviewPanel projection={projection} />;
}

export function SupplierSchedulePreview({ projection }: { projection: DocumentProjection }) {
  return <DocumentPreviewPanel projection={projection} />;
}

export function VariationSummaryPreview({ projection }: { projection: DocumentProjection }) {
  return <DocumentPreviewPanel projection={projection} />;
}
