import type { DomainIssue } from "../validation/errors";

export function ReviewValidationSummary({ issues }: { issues: DomainIssue[] }) {
  if (!issues.length) return <section className="validNotice">Review validation is clear.</section>;
  return <section className="issuePanel"><strong>Review validation</strong><ul>{issues.map((issue) => <li key={`${issue.code}:${issue.path}`}>{issue.message}</li>)}</ul></section>;
}
