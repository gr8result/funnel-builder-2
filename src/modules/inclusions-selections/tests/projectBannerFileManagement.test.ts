import fs from "node:fs";
import path from "node:path";
import { loadProjectAreaRegister, saveProjectAreaRegister, setAreaQuantity } from "../services/projectAreaRegisterService";
import {
  exportSelectionsProjectFile,
  preparePortableSelectionsFileForLocalSave,
  previewSelectionsProjectImport,
  projectDashboardHref,
  registerProjectOpen,
  routeForProject,
  saveSelectionsProject,
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
  ["Back to Project Dashboard", "New", "Open File", "Save", "Save As", "File", "Export Backup", "Close File", "Unsaved File", "Saved to file.", "Updated Copy Downloaded", "Unsaved Changes", "Locked Version"].forEach((label) => {
    assert(banner.includes(label), `Banner should include ${label}.`);
  });
  assert(!banner.includes("Open Existing Job"), "Normal selections users should not see the database project picker action.");
  assert(!banner.includes("Import Project File"), "Open File should replace the old import-first action.");
  assert(banner.includes("showOpenFilePicker") && banner.includes("showSaveFilePicker"), "Open File and Save As should prefer the File System Access API.");
  assert(banner.includes('type="file"') && banner.includes(".gr8selections.json,.json,application/json"), "Open File should have a real file input fallback with supported extensions.");
  assert(banner.includes("Open Project") && banner.includes("File Version") && banner.includes("Warnings"), "Open File should preview validated local file metadata before replacing the working project.");
  assert(banner.includes("Project Name") && banner.includes("Job Number") && banner.includes("Client") && banner.includes("Site Address") && banner.includes("Builder") && banner.includes("Estimator"), "New should require the visible project details.");
  assert(banner.includes("The original file was not overwritten."), "Download fallback should not claim the original local file was overwritten.");
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

  const saved = await saveSelectionsProject(context, "areas");
  assert(saved.status === "saved" && saved.savedAt, "Save should persist through the area repository.");

  const exported = await exportSelectionsProjectFile(context);
  assert(exported.fileName.endsWith(".gr8selections.json"), "Export should create a versioned .gr8selections.json file name.");
  const exportedText = JSON.stringify(exported.file);
  assert(exported.file.schemaVersion === 1 && exported.file.applicationVersion && exported.file.fileId && exported.file.createdAt && exported.file.updatedAt && exported.file.checksums.project, "Exported file should include local file metadata, schema version and checksum.");
  assert(exported.file.projectDetails.projectName === context.projectName && exported.file.areasAndLevels && exported.file.templatesAndTiers && exported.file.workspace && exported.file.review && exported.file.approvals, "Exported file should contain the complete editable selections project.");
  assert(Array.isArray(exported.file.attachmentsMetadata) && Array.isArray(exported.file.variations) && Array.isArray(exported.file.lockedSnapshotData), "Exported file should include attachments, variations and locked snapshot containers.");
  const savedCopy = preparePortableSelectionsFileForLocalSave(exported.file, "save");
  assert(savedCopy.fileId === exported.file.fileId && previewSelectionsProjectImport(savedCopy, context.organisationId).ok, "Save should preserve file identity while refreshing valid metadata and checksum.");
  const savedAsCopy = preparePortableSelectionsFileForLocalSave(exported.file, "save_as");
  assert(savedAsCopy.fileId !== exported.file.fileId && savedAsCopy.sourceFileId === exported.file.fileId && savedAsCopy.copiedFrom === exported.file.fileId, "Save As should create a new file identity and preserve copied-from metadata.");
  assert(!/password|access_token|secret|connection string/i.test(exportedText), "Exported selections file should not contain credentials.");
  assert(previewSelectionsProjectImport(exported.file, context.organisationId).ok, "Import preview should accept a valid exported file.");
  assert(!previewSelectionsProjectImport({ schema: "bad" }, context.organisationId).ok, "Import preview should reject invalid files.");
  assert(!previewSelectionsProjectImport({ ...exported.file, schemaVersion: 99 }, context.organisationId).ok, "Import preview should reject unsupported future schemas.");
  assert(!previewSelectionsProjectImport({ ...exported.file, projectSummary: { ...exported.file.projectSummary, projectName: "", jobNumber: "" }, checksums: exported.file.checksums }, context.organisationId).ok, "Import preview should reject missing project fields.");
  assert(!previewSelectionsProjectImport({ ...exported.file, projectSummary: { ...exported.file.projectSummary, projectName: "<script>alert(1)</script>" } }, context.organisationId).ok, "Import preview should reject executable/script-like content.");
}

runProjectBannerFileManagementTests();
