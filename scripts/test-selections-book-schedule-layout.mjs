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

assert.ok(source.includes(".documentWrap { display: grid; justify-content: stretch; justify-items: stretch; gap: 16px; width: 100%; }"), "schedule wrapper must stretch full width");
assert.ok(source.includes(".page { width: 100%;"), "schedule page must not be capped to the old narrow width");
assert.ok(source.includes(".contractPage { display: grid; grid-template-columns: minmax(0, 1fr);"), "room schedule must use a single wide column");
assert.ok(source.includes(".selectionTable { width: 100%; min-width: 1460px; table-layout: fixed;"), "selection table must be wide with fixed column layout");
assert.ok(source.includes(".colProduct { width: 22%; }"), "Product / Model column must receive the widest schedule allocation");
assert.ok(source.includes(".colDescription { width: 18%; }"), "Description column must be readable");
assert.ok(source.includes(".thumbButton { width: 84px; height: 70px;"), "product thumbnails must use consistent sizing");
assert.ok(source.includes(".thumbButton img { width: 100%; height: 100%; object-fit: contain; }"), "product images must not be cropped");
assert.ok(source.includes("@media (max-width: 1380px)") && source.includes("@media (max-width: 980px)"), "desktop/tablet/mobile layout rules must exist");

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
