import type { ProjectRequirement } from "../requirements/requirementTypes";
import { requirementCategorySummary } from "../services/templateStageService";

export function RequirementCategorySummary({ requirements }: { requirements: ProjectRequirement[] }) {
  const summary = requirementCategorySummary(requirements);
  return (
    <section className="panel categorySummary">
      <h2>Category Summary</h2>
      {summary.length === 0 ? <p>Generate requirements to see category totals.</p> : summary.map((item) => (
        <div key={item.category}><span>{item.category.replace(/_/g, " ")}</span><strong>{item.count}</strong></div>
      ))}
    </section>
  );
}
