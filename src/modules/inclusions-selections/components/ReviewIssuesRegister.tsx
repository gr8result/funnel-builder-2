import type { ReviewIssue } from "../repositories/selectionReviewRepository";

export function ReviewIssuesRegister({ issues, severity, onSeverity, onEdit, onAcknowledge }: { issues: ReviewIssue[]; severity: string; onSeverity: (value: string) => void; onEdit: (areaId?: string, requirementId?: string) => void; onAcknowledge: (issueId: string) => void }) {
  const filtered = issues.filter((issue) => severity === "all" || issue.severity === severity);
  return (
    <section className="reviewCard issueRegister">
      <header><h2>Issues Register</h2><select value={severity} onChange={(event) => onSeverity(event.target.value)}><option value="all">All severities</option><option value="blocking">Blocking</option><option value="warning">Warning</option><option value="information">Information</option></select></header>
      <div className="reviewRows">{filtered.map((issue) => <article key={issue.id} className={`issueCard severity-${issue.severity}`}><strong>{issue.title}</strong><span>{issue.description}</span><span>{issue.severity} - {issue.code}</span><div><button type="button" onClick={() => onEdit(issue.areaId, issue.requirementId)}>Edit in Selection Workspace</button><button type="button" disabled={issue.blocking} onClick={() => onAcknowledge(issue.id)}>Acknowledge Warning</button></div></article>)}</div>
    </section>
  );
}
