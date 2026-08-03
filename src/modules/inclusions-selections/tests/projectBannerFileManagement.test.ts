import fs from "node:fs";
import path from "node:path";
import { loadProjectAreaRegister, saveProjectAreaRegister, setAreaQuantity } from "../services/projectAreaRegisterService";
import {
  exportSelectionsProjectFile,
  loadProjectFileMenu,
  previewSelectionsProjectImport,
  projectDashboardHref,
  registerProjectOpen,
  routeForProject,
  saveSelectionsProject,
  saveSelectionsProjectAs,
  saveSelectionsBuilderTemplate,
} from "../services/projectFileManagementService";
import type { ProjectSelectionContext } from "../repositories/projectAreaRegisterRepository";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(...parts: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  } as Storage;
  Object.defineProperty(globalThis, "window", { value: { localStorage }, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: localStorage, configurable: true });
}

export async function runProjectBannerFileManagementTests(): Promise<void> {
  installLocalStorageMock();
  const pages = ["areas", "templates", "workspace", "review", "approvals", "documents-export"];
  for (const page of pages) {
    const file = source("pages", "inclusions-selections", `${page}.tsx`);
    assert(file.includes("InclusionsSelectionsProjectBanner"), `${page} should render the shared project banner.`);
    assert(file.indexOf("InclusionsSelectionsProjectBanner") < file.indexOf("InclusionsSelectionsStageNav"), `${page} should render the banner above stage navigation.`);
  }

  const banner = source("src", "modules", "inclusions-selections", "components", "InclusionsSelectionsProjectBanner.tsx");
  ["Back to Project Dashboard", "Open Existing Job", "Import Project File", "Export Project File", "Save as Builder Template", "Close Project", "Unsaved Changes", "Locked Version"].forEach((label) => {
    assert(banner.includes(label), `Banner should include ${label}.`);
  });
  assert(banner.includes('type="file"') && banner.includes(".gr8selections.json,.json,application/json"), "Import Project File should use a real file input with supported extensions.");
  assert(banner.includes("No saved projects were found for this organisation.") && banner.includes("No projects match your search."), "Open Existing Job should distinguish empty organisation and search-empty states.");
  assert(banner.includes("Active") && banner.includes("Archived") && banner.includes("Recently Opened"), "Open Existing Job should expose status filters.");
  assert(banner.includes("Most Recently Modified") && banner.includes("Project Name") && banner.includes("Job Number"), "Open Existing Job should expose supported sort options.");
  assert(banner.includes("Project Name") && banner.includes("Site Address") && banner.includes("Current Selections Stage") && banner.includes("Last Modified"), "Open Existing Job should show project metadata columns.");
  assert(banner.includes("This file could not be imported.") && banner.includes("A project with this job number already exists."), "Import Project File should show user-facing invalid and duplicate messages.");
  assert(banner.includes("window.addEventListener(\"keydown\"") && banner.includes("event.preventDefault()"), "Ctrl+S should trigger module save and prevent browser Save Page.");
  assert(banner.includes("@media (max-width: 560px)") && banner.includes(".saveButton"), "Mobile banner should keep Save visible.");

  const context: ProjectSelectionContext = {
    organisationId: "org_banner_test",
    projectId: "project_banner_original",
    projectName: "Banner Test Residence",
    clientName: "Banner Client",
    siteAddress: "1 Banner Street",
    jobNumber: "BANNER-001",
  };
  let register = await loadProjectAreaRegister(context);
  const changed = setAreaQuantity(register, "area_type_kitchen", 1);
  assert(changed.ok && changed.value, "Test project should allow kitchen area creation.");
  register = changed.value;
  assert((await saveProjectAreaRegister(register)).ok, "Area register should save.");
  registerProjectOpen(context, "areas");

  assert(projectDashboardHref(context).includes("/modules/estimate-builder") && projectDashboardHref(context).includes("projectId=project_banner_original"), "Back route should preserve project context.");
  assert(routeForProject(context, "workspace").includes("/inclusions-selections/workspace") && routeForProject(context, "workspace").includes("jobNumber=BANNER-001"), "Stage route should preserve project context.");
  assert(loadProjectFileMenu(context.organisationId).some((project) => project.projectId === context.projectId), "Open Existing Job menu should list recently opened projects.");
  window.localStorage.setItem("estimate-builder-registered-jobs", JSON.stringify([
    { workspaceId: context.organisationId, jobId: "sample_job_001", jobName: "Sample Project", clientName: "Sample Client", jobNumber: "SAMPLE-001", siteAddress: "10 Sample Street", registeredAt: "2026-01-01T00:00:00.000Z", status: "registered" },
    { workspaceId: "other_org", jobId: "other_job", jobName: "Other Organisation Project", jobNumber: "OTHER-001" },
  ]));
  const appProjects = loadProjectFileMenu(context.organisationId);
  assert(appProjects.some((project) => project.projectId === "sample_job_001" && project.projectName === "Sample Project"), "Open Existing Job should list registered Estimate Builder sample projects immediately.");
  assert(!appProjects.some((project) => project.projectId === "other_job"), "Open Existing Job should not mix projects from another organisation.");
  assert(appProjects.some((project) => [project.projectName, project.jobNumber, project.clientName, project.siteAddress].join(" ").includes("Sample")), "Project search fields should include name, job number, client and site address.");

  const saved = await saveSelectionsProject(context, "areas");
  assert(saved.status === "saved" && saved.savedAt, "Save should persist through the area repository.");

  const copyContext: ProjectSelectionContext = { ...context, projectId: "project_banner_copy", projectName: "Banner Test Copy", jobNumber: "BANNER-002" };
  await saveSelectionsProjectAs(context, copyContext, { projectAreas: true, templatesAndTiers: true, productSelections: true, pricingAndAllowances: true, notesAndAttachments: true, reviewState: true });
  const original = await loadProjectAreaRegister(context);
  const copy = await loadProjectAreaRegister(copyContext);
  assert(original.projectId !== copy.projectId && copy.projectName === "Banner Test Copy", "Save As should create a separate project and leave the original unchanged.");

  const templateId = await saveSelectionsBuilderTemplate(context, "Banner Test Template");
  assert(Boolean(templateId), "Save as Builder Template should return a saved template id.");

  const exported = await exportSelectionsProjectFile(context);
  assert(exported.fileName.endsWith(".gr8selections.json"), "Export should create a versioned .gr8selections.json file name.");
  const exportedText = JSON.stringify(exported.file);
  assert(exported.file.schemaVersion === 1 && exported.file.checksums.project, "Exported file should include schema version and checksum.");
  assert(!/password|access_token|secret|connection string/i.test(exportedText), "Exported selections file should not contain credentials.");
  assert(previewSelectionsProjectImport(exported.file, context.organisationId).ok, "Import preview should accept a valid exported file.");
  assert(!previewSelectionsProjectImport({ schema: "bad" }, context.organisationId).ok, "Import preview should reject invalid files.");
  assert(!previewSelectionsProjectImport({ ...exported.file, schemaVersion: 99 }, context.organisationId).ok, "Import preview should reject unsupported future schemas.");
  assert(!previewSelectionsProjectImport({ ...exported.file, projectSummary: { ...exported.file.projectSummary, projectName: "", jobNumber: "" }, checksums: exported.file.checksums }, context.organisationId).ok, "Import preview should reject missing project fields.");
  assert(!previewSelectionsProjectImport({ ...exported.file, projectSummary: { ...exported.file.projectSummary, projectName: "<script>alert(1)</script>" } }, context.organisationId).ok, "Import preview should reject executable/script-like content.");
}

runProjectBannerFileManagementTests();
