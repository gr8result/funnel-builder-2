import type { DomainIssue } from "../validation/errors";

export function ApprovalValidationSummary({ issues }: { issues: DomainIssue[] }) {
  if (!issues.length) return <section className="validNotice">Approval validation is clear.</section>;
  return <section className="issuePanel"><strong>Approval validation</strong><ul>{issues.map((issue) => <li key={`${issue.code}:${issue.path}`}>{issue.message}</li>)}</ul></section>;
}
