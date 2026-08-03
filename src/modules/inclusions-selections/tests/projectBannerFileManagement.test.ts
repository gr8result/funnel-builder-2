import fs from "node:fs";
import path from "node:path";
import { loadProjectAreaRegister, saveProjectAreaRegister, setAreaQuantity } from "../services/projectAreaRegisterService";
import {
  exportSelectionsProjectFile,
  closeSelectionsProject,
  preparePortableSelectionsFileForLocalSave,
  previewSelectionsProjectImport,
  projectDashboardHref,
  registerProjectOpen,
  routeForProject,
  saveSelectionsProject,
  SELECTIONS_FILE_EXTENSION,
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
  ["Back to Project Dashboard", "New", "Open File", "Save", "Save As", "File", "New File", "Recent Files", "Export Backup", "Close File", "No File Open", "Unsaved File", "Saved to File", "Updated Copy Downloaded", "Unsaved Changes", "Locked Version"].forEach((label) => {
    assert(banner.includes(label), `Banner should include ${label}.`);
  });
  assert(banner.includes("export function InclusionsSelectionsPageBanner"), "Banner should expose the reusable standard page banner component.");
  assert(banner.includes("moduleIcon") && banner.includes("width: 48px") && banner.includes("height: 48px"), "Banner should include the 48px module icon.");
  assert(banner.includes("Inclusions & Selections"), "Banner should include the standard module heading.");
  assert(banner.includes("font-size: 48px") && banner.includes("font-weight: 600"), "Desktop banner heading should use the 48px/600 standard.");
  assert(banner.includes("Set up project areas, choose products and finishes, review selections and prepare approvals."), "Banner should include the approved subtitle.");
  assert(banner.includes("font-size: 18px"), "Banner subtitle should use the readable 18px style.");
  assert(!banner.includes("Open Existing Job"), "Normal selections users should not see the database project picker action.");
  assert(!banner.includes("Import Project File"), "Open File should replace the old import-first action.");
  assert(banner.includes("showOpenFilePicker") && banner.includes("showSaveFilePicker"), "Open File and Save As should prefer the File System Access API.");
  assert(banner.includes('type="file"') && banner.includes(".gr8select,.json,application/json"), "Open File should have a real file input fallback with supported extensions.");
  const openPickerBlock = banner.slice(banner.indexOf("function openPickerOptions"), banner.indexOf("function savePickerOptions"));
  const savePickerBlock = banner.slice(banner.indexOf("function savePickerOptions"), banner.indexOf("function readRecentFiles"));
  assert(openPickerBlock.includes('".json"') && openPickerBlock.includes("SELECTIONS_FILE_EXTENSION"), "Open File should pass .gr8select and .json to the native picker.");
  assert(!openPickerBlock.includes(".gr8selections.json") && !savePickerBlock.includes(".gr8selections.json"), "Native file pickers must not receive the retired long extension.");
  assert(banner.includes("The file picker could not be opened.") && banner.includes("Diagnostics"), "Picker failures should show friendly copy with technical details hidden in diagnostics.");
  assert(banner.includes("Open This File") && banner.includes("Schema Version") && banner.includes("Project Areas") && banner.includes("Selections") && banner.includes("Warnings"), "Open File should preview validated local file metadata before replacing the working project.");
  assert(banner.includes("Project Name") && banner.includes("Job Number") && banner.includes("Client") && banner.includes("Site Address") && banner.includes("Builder") && banner.includes("Estimator"), "New should require the visible project details.");
  assert(banner.includes("newFieldRefs") && banner.includes("focusFirstInvalid"), "New File validation should focus the first invalid field.");
  assert(banner.includes("Complete the required project details before creating the file.") && banner.includes("fieldError"), "New File validation should show visible field-level errors.");
  assert(banner.includes("Save File Now") && banner.includes("Continue Without Saving"), "Create File should offer an immediate local save path.");
  assert(banner.includes("handleCreateSaveNow") && banner.includes("showSaveFilePicker(savePickerOptions(suggestedName))"), "Save File Now should call the native save picker from a user action where available.");
  assert(banner.includes("Save Dialog Opened") && banner.includes("File Created") && banner.includes("File Creation Failed"), "Create File should expose visible click feedback states.");
  assert(banner.includes("The original file was not overwritten."), "Download fallback should not claim the original local file was overwritten.");
  assert(banner.includes("window.addEventListener(\"keydown\"") && banner.includes("event.preventDefault()"), "Ctrl+S should trigger module save and prevent browser Save Page.");
  assert(banner.includes("@media (max-width: 640px)") && banner.includes(".saveButton"), "Mobile banner should keep Save visible.");
  assert(banner.includes("indexedDB.open") && banner.includes("requestPermission") && banner.includes("Choose this file again from your computer."), "Recent files should use browser handles honestly and fall back to the picker.");
  const noFileState = source("src", "modules", "inclusions-selections", "components", "InclusionsSelectionsNoFileState.tsx");
  assert(noFileState.includes("No selections file open") && noFileState.includes("Create a new selections file or open an existing file from your computer."), "No-file state should use the approved focused copy.");

  const context: ProjectSelectionContext = {
    organisationId: "org_banner_test",
    projectId: "project_banner_original",
    projectName: "Banner Test Residence",
    clientName: "Banner Client",
    siteAddress: "1 Banner Street",
    jobNumber: "BANNER-001",
    builder: "Banner Builder",
    estimator: "Banner Estimator",
  };
  let register = await loadProjectAreaRegister(context);
  const changed = setAreaQuantity(register, "area_type_kitchen", 1);
  assert(changed.ok && changed.value, "Test project should allow kitchen area creation.");
  register = changed.value;
  assert((await saveProjectAreaRegister(register)).ok, "Area register should save.");
  registerProjectOpen(context, "areas");

  assert(projectDashboardHref(context).includes("/modules/estimate-builder") && projectDashboardHref(context).includes("projectId=project_banner_original"), "Back route should preserve project context.");
  assert(routeForProject(context, "workspace").includes("/inclusions-selections/workspace") && routeForProject(context, "workspace").includes("jobNumber=BANNER-001"), "Stage route should preserve project context.");
  assert(closeSelectionsProject(context) === "/inclusions-selections/areas", "Close File should return to the no-file selections page.");

  const saved = await saveSelectionsProject(context, "areas");
  assert(saved.status === "saved" && saved.savedAt, "Save should persist through the area repository.");

  const exported = await exportSelectionsProjectFile(context);
  assert(SELECTIONS_FILE_EXTENSION === ".gr8select", "Preferred selections file extension should be the short File System Access API-safe extension.");
  assert(exported.fileName.endsWith(".gr8select"), "Export should create a versioned .gr8select file name.");
  const exportedText = JSON.stringify(exported.file);
  assert(exported.file.schemaVersion === 1 && exported.file.applicationVersion && exported.file.fileId && exported.file.createdAt && exported.file.updatedAt && exported.file.contentFingerprint && exported.file.checksums.project, "Exported file should include local file metadata, schema version and content fingerprint.");
  assert(exported.file.projectDetails.projectName === context.projectName && exported.file.projectDetails.client === context.clientName && exported.file.projectDetails.builder === context.builder && exported.file.projectDetails.estimator === context.estimator && exported.file.areasAndLevels && exported.file.templatesAndTiers && exported.file.workspace && exported.file.review && exported.file.approvals, "Exported file should contain the complete editable selections project.");
  assert(exported.file.templates && Array.isArray(exported.file.selectionItems) && Array.isArray(exported.file.selections), "Exported file should include readable templates, selectionItems and selections aliases.");
  assert(Array.isArray(exported.file.attachmentsMetadata) && Array.isArray(exported.file.variations) && Array.isArray(exported.file.lockedSnapshotData), "Exported file should include attachments, variations and locked snapshot containers.");
  const savedCopy = preparePortableSelectionsFileForLocalSave(exported.file, "save");
  assert(savedCopy.fileId === exported.file.fileId && previewSelectionsProjectImport(savedCopy, context.organisationId).ok, "Save should preserve file identity while refreshing valid metadata and checksum.");
  const savedAsCopy = preparePortableSelectionsFileForLocalSave(exported.file, "save_as");
  assert(savedAsCopy.fileId !== exported.file.fileId && savedAsCopy.sourceFileId === exported.file.fileId && savedAsCopy.copiedFrom === exported.file.fileId && savedAsCopy.copiedFromFileId === exported.file.fileId, "Save As should create a new file identity and preserve copied-from metadata.");
  assert(!/password|access_token|secret|connection string/i.test(exportedText), "Exported selections file should not contain credentials.");
  assert(previewSelectionsProjectImport(exported.file, context.organisationId).ok, "Import preview should accept a valid exported file.");
  const opened = previewSelectionsProjectImport(JSON.parse(JSON.stringify(savedCopy)), context.organisationId);
  assert(opened.ok && opened.file.projectDetails.projectName === context.projectName && opened.file.projectDetails.client === context.clientName, "Saved file should round-trip through Open File preview with project details intact.");
  assert(!previewSelectionsProjectImport({ schema: "bad" }, context.organisationId).ok, "Import preview should reject invalid files.");
  assert(!previewSelectionsProjectImport({ ...exported.file, schemaVersion: 99 }, context.organisationId).ok, "Import preview should reject unsupported future schemas.");
  assert(!previewSelectionsProjectImport({ ...exported.file, projectSummary: { ...exported.file.projectSummary, projectName: "", jobNumber: "" }, checksums: exported.file.checksums }, context.organisationId).ok, "Import preview should reject missing project fields.");
  assert(!previewSelectionsProjectImport({ ...exported.file, projectSummary: { ...exported.file.projectSummary, projectName: "<script>alert(1)</script>" } }, context.organisationId).ok, "Import preview should reject executable/script-like content.");
}

runProjectBannerFileManagementTests();
