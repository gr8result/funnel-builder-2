import ProjectCompactBanner from "../../../components/project-workspace/ProjectCompactBanner.jsx";

export default function JobDetailsBanner({ projectName, projectAddress }) {
  return (
    <ProjectCompactBanner
      projectName={projectName}
      projectAddress={projectAddress}
      accent="linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)"
      style={{ marginBottom: 0 }}
    />
  );
}
