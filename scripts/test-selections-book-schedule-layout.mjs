import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("pages/modules/builders/selections-book.js", "utf8");

assert.ok(!source.includes('<aside className="sidebar">'), "duplicate left-hand schedule menu must not render");
assert.ok(!source.includes('<aside className="roomSidePanel">'), "right-hand room sidebar must not render by default");
assert.ok(!source.includes('<aside className="documentSpine">'), "internal schedule spine navigation must not render");
assert.ok(!source.includes("<SelectionsBookDebugPanel"), "debug panel must not render in normal UX");
assert.ok(!source.includes("console.info(\"[Client Selections Cover fields]"), "cover diagnostics must not log from normal UX");
assert.ok(!source.includes("Missing field:"), "client-facing missing-field text must never render");

assert.ok(source.includes('className="scheduleControls"'), "compact section navigator must render above the schedule");
assert.ok(source.includes("Current Section:"), "banner must show current section context");
assert.ok(source.includes("Save Progress"), "banner must keep Save Progress");
assert.ok(source.includes("Import to Project"), "banner must keep Import to Project");
assert.ok(source.includes("const documentPages = ["), "viewer must restore an ordered multi-page page model");
assert.ok(source.includes('{ value: "cover", label: "Cover", type: "cover", pageNumber: 1 }'), "page model must keep the cover page");
assert.ok(source.includes('{ value: "project", label: "Project Info", type: "project", pageNumber: 2 }'), "page model must keep the project info page");
assert.ok(source.includes("...book.rooms.map((room, index) =>"), "page model must preserve all room pages");
assert.ok(source.includes("const totalPageCount = documentPages.length"), "page count must be derived from the page model");
assert.ok(source.includes("Page {activePageIndex + 1} of {totalPageCount}"), "page count must render in the toolbar");
assert.ok(source.includes("function movePage(direction)"), "Previous/Next page navigation must be implemented");
assert.ok(source.includes("movePage(-1)") && source.includes("movePage(1)"), "Previous and Next controls must call page navigation");
assert.ok(source.includes('className="pageSelect"'), "direct page selector must render");
assert.ok(source.includes("documentPages.map((page) => <option"), "direct page selector must list every page");
assert.ok(source.includes('value={activeSectionValue} onChange={(event) => openSection(event.target.value)}'), "section/page selection must jump to actual page values");
assert.ok(source.includes('const [viewMode, setViewMode] = useState("single")'), "viewer must default to Single Page mode");
assert.ok(source.includes('const [zoomMode, setZoomMode] = useState("fit-width")'), "viewer must default to Fit Width zoom");
assert.ok(source.includes('data-view-mode={viewMode}') && source.includes('data-zoom-mode={zoomMode}') && source.includes('data-page-count={totalPageCount}'), "viewer state must be visible for regression checks");
assert.ok(source.includes('viewMode === "continuous"'), "continuous mode must render all pages");
assert.ok(source.includes("? documentPages.map((page) =>"), "continuous mode must map all pages");
assert.ok(source.includes("renderDocumentPage(activeDocumentPage)"), "single-page mode must render only the active page");
assert.ok(source.includes("<option value=\"fit-width\">Fit Width</option>"), "Fit Width zoom option must render");
assert.ok(source.includes("<option value=\"fit-page\">Fit Page</option>"), "Fit Page zoom option must render");
assert.ok(source.includes("<option value=\"zoom-150\">150%</option>"), "fixed zoom options must render");

assert.ok(source.includes(".documentViewer { --viewer-page-width: min(100%, 1320px); width: 100%;"), "viewer must default to fit-width and use the available workspace");
assert.ok(source.includes(".documentPageFrame { width: var(--viewer-page-width); max-width: 100%;"), "page frame must scale from the viewer, not mutate document content");
assert.ok(source.includes(".documentPages { width: 100%; display: grid; justify-items: center; gap: 32px; }"), "continuous pages must be centered with clear gaps");
assert.ok(source.includes(".documentViewer.fit-page { --viewer-page-width: min(100%, 940px); }"), "Fit Page zoom must be available");
assert.ok(source.includes(".documentViewer.zoom-75") && source.includes(".documentViewer.zoom-150"), "fixed zoom CSS must be available");
assert.ok(source.includes(".page { width: 100%;"), "schedule page must not be capped to the old narrow width");
assert.ok(source.includes(".contractPage { display: grid; grid-template-columns: minmax(0, 1fr);"), "room schedule must use a single wide column");
assert.ok(source.includes(".selectionTable { width: 100%; min-width: 1460px; table-layout: fixed;"), "selection table must be wide with fixed column layout");
assert.ok(source.includes(".colProduct { width: 22%; }"), "Product / Model column must receive the widest schedule allocation");
assert.ok(source.includes(".colDescription { width: 18%; }"), "Description column must be readable");
assert.ok(source.includes(".thumbButton { width: 84px; height: 70px;"), "product thumbnails must use consistent sizing");
assert.ok(source.includes(".thumbButton img { width: 100%; height: 100%; object-fit: contain; }"), "product images must not be cropped");
assert.ok(source.includes("@media (max-width: 1380px)") && source.includes("@media (max-width: 980px)"), "desktop/tablet/mobile layout rules must exist");
assert.ok(source.includes(".documentViewer, .documentPages, .documentPageFrame { display: block; width: auto; max-width: none; padding: 0; border: 0; background: white; }"), "print/export dimensions must be reset from viewer scaling");

const defaultRoomsBlock = source.match(/const DEFAULT_ROOMS = \[([\s\S]*?)\];/)?.[1] || "";
assert.ok(!defaultRoomsBlock.includes('"Site Works"'), "Site Works must not be reintroduced in selections default rooms");
assert.ok(!defaultRoomsBlock.includes('"Concrete"'), "Concrete must not be reintroduced in selections default rooms");

const roomTemplatesBlock = source.match(/const ROOM_TEMPLATES = \{([\s\S]*?)\};/)?.[1] || "";
assert.ok(!roomTemplatesBlock.includes('"Site Works":'), "Site Works template must not be used for selections schedule");
assert.ok(!roomTemplatesBlock.includes("Concrete:"), "Concrete template must not be used for selections schedule");

[
  "coverDebugFields.clientName",
  "coverDebugFields.siteAddress",
  "coverDebugFields.jobNumber",
  "coverDebugFields.builderName",
  "getSelectionsBookProjectDetails(selectedProject, selectedSnapshot)",
].forEach((snippet) => {
  assert.ok(source.includes(snippet), `project fields must resolve from project/job context: ${snippet}`);
});

console.log("Selections Book schedule layout tests passed.");
