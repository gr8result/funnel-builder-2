import type { DomainIssue } from "../validation/errors";

export function TemplateStageValidationSummary({ issues }: { issues: DomainIssue[] }) {
  if (issues.length === 0) return <section className="validNotice">Room templates and tiers are ready for the selection workspace.</section>;
  return (
    <section className="issuePanel">
      {issues.map((item, index) => <p key={`${item.code}-${index}`}>{item.message}</p>)}
    </section>
  );
}
