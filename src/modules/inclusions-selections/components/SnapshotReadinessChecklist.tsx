import type { SnapshotReadiness } from "../services/approvalStageService";

export function SnapshotReadinessChecklist({ readiness }: { readiness: SnapshotReadiness }) {
  return <section className="approvalCard"><h2>{readiness.ready ? "Ready to Lock" : "Not Ready to Lock"}</h2><ul>{readiness.checklist.map((item) => <li key={item.label} className={item.ok ? "ok" : "blocked"}><strong>{item.ok ? "OK" : "Blocked"}</strong> {item.label}{item.ok ? "" : ` - ${item.reason}`}</li>)}</ul></section>;
}
