import type { DomainIssue } from "../validation/errors";

export function AreaRegisterValidationSummary({ issues }: { issues: DomainIssue[] }) {
  if (issues.length === 0) return <p className="validNotice">Area register is ready for templates.</p>;
  return (
    <section className="issuePanel" aria-live="polite">
      {issues.map((item, index) => (
        <p key={`${item.code}-${index}`}>{item.message}</p>
      ))}
    </section>
  );
}
