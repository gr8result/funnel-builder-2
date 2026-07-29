import type { DomainIssue } from "../validation/errors";

export function WorkspaceValidationSummary({ issues }: { issues: DomainIssue[] }) {
  if (issues.length === 0) return <section className="validNotice">Workspace draft is valid for the next stage.</section>;
  return <section className="issuePanel">{issues.map((item, index) => <p key={`${item.code}-${index}`}>{item.message}</p>)}</section>;
}
