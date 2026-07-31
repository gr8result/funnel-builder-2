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

export async function runProjectBannerFileManagementTests(): Promise<void> {
  const pages = ["areas", "templates", "workspace", "review", "approvals", "documents-export"];
  for (const page of pages) {
    const file = source("pages", "inclusions-selections", `${page}.tsx`);
    assert(file.includes("InclusionsSelectionsProjectBanner"), `${page} should render the shared project banner.`);
    assert(file.indexOf("InclusionsSelectionsProjectBanner") < file.indexOf("InclusionsSelectionsStageNav"), `${page} should render the banner above stage navigation.`);
  }

  const banner = source("src", "modules", "inclusions-selections", "components", "InclusionsSelectionsProjectBanner.tsx");
  ["Back to Project Dashboard", "Open Existing Job", "Import Selections File", "Export Selections File", "Save as Builder Template", "Close Project", "Unsaved Changes", "Locked Version"].forEach((label) => {
    assert(banner.includes(label), `Banner should include ${label}.`);
  });
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
}

runProjectBannerFileManagementTests();
