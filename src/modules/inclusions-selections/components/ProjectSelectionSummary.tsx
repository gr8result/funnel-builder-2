import type { ProjectAreaRegister } from "../repositories/projectAreaRegisterRepository";

export function ProjectSelectionSummary({ register }: { register: ProjectAreaRegister }) {
  const items = [
    ["Project", register.projectName || register.projectId],
    ["Client", register.clientName || "Not recorded"],
    ["Site", register.siteAddress || "Not recorded"],
    ["Job", register.jobNumber || "Not recorded"],
  ];
  return (
    <section className="summaryBar" aria-label="Project summary">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </section>
  );
}
