import assert from "node:assert/strict";
import crypto from "node:crypto";
import { File } from "node:buffer";
import { downloadBackupCopy, readJob, saveJobAs } from "../lib/jobFile.ts";

globalThis.File = File;

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalSetTimeout = globalThis.setTimeout;
const originalNavigator = globalThis.navigator;

const blobs = new Map();
const revoked = [];
const timers = [];
const links = [];
let nextUrl = 1;
let failNextClick = false;

URL.createObjectURL = (blob) => {
  const url = `blob:test-backup-${nextUrl++}`;
  blobs.set(url, blob);
  return url;
};
URL.revokeObjectURL = (url) => revoked.push(url);
globalThis.setTimeout = (callback, delay) => {
  const timer = { callback, delay, unrefCalled: false, unref() { this.unrefCalled = true; } };
  timers.push(timer);
  return timer;
};
globalThis.document = {
  body: {
    appendChild(link) {
      link.appended = true;
    },
  },
  createElement(tagName) {
    assert.equal(tagName, "a");
    const link = {
      href: "",
      download: "",
      appended: false,
      removed: false,
      click() {
        if (failNextClick) {
          failNextClick = false;
          throw new Error("simulated browser download failure");
        }
        this.clicked = true;
      },
      remove() {
        this.removed = true;
      },
    };
    links.push(link);
    return link;
  },
};

try {
  const savedAt = "2026-11-01T00:59:59.808Z";
  const image = `data:image/jpeg;base64,${crypto.randomBytes(4 * 1024 * 1024).toString("base64")}`;
  const workbook = {
    jobId: "isolated-backup-test",
    projectId: "isolated-backup-test",
    workspaceId: "isolated-workspace",
    savedAt,
    registeredJob: { jobId: "isolated-backup-test", jobName: "Large Backup Test", jobNumber: "BACKUP-001" },
    projectEstimateBuilder: {
      pages: [{
        id: "page-1",
        baseArtwork: image,
        design: { backgroundImageUrl: image },
        importedDocument: { baseArtwork: image },
      }],
    },
    clientSelectionsBook: {
      clientSelectionCorrections: { confirmedAt: "2026-10-25T23:09:54.634Z" },
      clientSelectionAudit: { removedLines: [{ productName: "Historical selection" }] },
    },
    unrelatedWorkbookSection: { retained: true },
  };
  const job = {
    jobId: workbook.jobId,
    jobName: "Large Backup Test",
    jobNumber: "BACKUP-001",
    clientName: "Isolated Test",
    address: "1 Backup Circuit",
    created: "2026-01-01T00:00:00.000Z",
    lastModified: savedAt,
    masterRevision: 17,
    workbook,
  };
  const original = JSON.stringify(job);

  const first = await downloadBackupCopy(job);
  assert.equal(first.ok, true);
  assert.equal(first.data.lastModified, savedAt, "Backup metadata must retain the saved job timestamp");
  assert.equal(first.data.masterRevision, 17, "Backup must not increment the saved revision");
  assert.equal(JSON.stringify(job), original, "Backup must not mutate the source job");
  assert.equal(links[0].clicked, true);
  assert.equal(links[0].removed, true);
  assert.equal(revoked.length, 0, "Large Blob URL must remain valid after the synthetic click");
  assert.equal(timers[0].delay, 10 * 60_000);
  assert.equal(timers[0].unrefCalled, true);

  const firstBlob = blobs.get(links[0].href);
  assert.ok(firstBlob.size > 5 * 1024 * 1024, "Isolated package must exercise a genuinely large Blob");
  const reopened = await readJob(new File([firstBlob], first.fileName, { type: "application/zip" }));
  assert.equal(reopened.jobId, workbook.jobId);
  assert.equal(reopened.lastModified, savedAt);
  assert.equal(reopened.masterRevision, 17);
  assert.equal(reopened.workbook.unrelatedWorkbookSection.retained, true);
  assert.equal(reopened.workbook.projectEstimateBuilder.pages[0].baseArtwork, image);
  assert.equal(reopened.workbook.projectEstimateBuilder.pages[0].design.backgroundImageUrl, image);
  assert.equal(reopened.workbook.projectEstimateBuilder.pages[0].importedDocument.baseArtwork, image);
  assert.equal(reopened.workbook.clientSelectionsBook.clientSelectionAudit.removedLines.length, 1);

  const second = await downloadBackupCopy(job);
  assert.equal(second.ok, true, "Repeated large backup download must succeed");
  assert.notEqual(links[1].href, links[0].href);
  assert.equal(revoked.length, 0, "Neither active download URL may be revoked early");
  assert.equal(JSON.stringify(job), original, "Repeated backup must leave the source job unchanged");

  timers.forEach((timer) => timer.callback());
  assert.deepEqual(revoked, [links[0].href, links[1].href], "Successful downloads clean up after the grace period");

  failNextClick = true;
  await assert.rejects(() => downloadBackupCopy(job), /simulated browser download failure/);
  assert.equal(links[2].removed, true, "Failed download removes its temporary link");
  assert.equal(revoked.at(-1), links[2].href, "Failed download revokes its Blob URL immediately");

  let pickerCalls = 0;
  let writeCalls = 0;
  let closeCalls = 0;
  let abortCalls = 0;
  let savedBlob = null;
  const backupHandle = {
    name: "Large Backup Test - verified.gr8job",
    async createWritable() {
      return {
        async write(blob) {
          writeCalls += 1;
          savedBlob = blob;
        },
        async close() {
          closeCalls += 1;
        },
        async abort() {
          abortCalls += 1;
        },
      };
    },
    async getFile() {
      return new File([savedBlob], this.name, { type: "application/zip" });
    },
  };
  globalThis.window = {
    showOpenFilePicker: async () => [],
    showSaveFilePicker: async () => {
      pickerCalls += 1;
      assert.equal(writeCalls, 0, "Destination must be acquired before large package generation/write");
      return backupHandle;
    },
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent: "Mozilla/5.0 Electron/43.8.3 Code/1.144.0 Chrome/150.0.7871.250",
    },
  });
  const linksBeforeVerifiedWrite = links.length;
  const verifiedBackup = await downloadBackupCopy(job);
  assert.equal(verifiedBackup.ok, true);
  assert.equal(verifiedBackup.storageLocation, "computer-file");
  assert.match(verifiedBackup.message, /saved and verified/);
  assert.equal(pickerCalls, 1);
  assert.equal(writeCalls, 1);
  assert.equal(closeCalls, 1);
  assert.equal(abortCalls, 0);
  assert.equal(pickerCalls, 1, "VS Code/Electron must use the native picker when it is available");
  assert.equal(links.length, linksBeforeVerifiedWrite, "Verified file writes must bypass the Blob download manager");
  const verifiedReopen = await readJob(await backupHandle.getFile());
  assert.equal(verifiedReopen.jobId, workbook.jobId);
  assert.equal(verifiedReopen.lastModified, savedAt);
  assert.equal(verifiedReopen.masterRevision, 17);

  const linksBeforeInterceptedPicker = links.length;
  globalThis.window.showSaveFilePicker = async () => {
    throw new DOMException(
      "Failed to execute 'showSaveFilePicker' on 'Window': Intercepted by Page.setInterceptFileChooserDialog().",
      "AbortError",
    );
  };
  const fallbackBackup = await downloadBackupCopy(job);
  assert.equal(fallbackBackup.ok, true);
  assert.equal(fallbackBackup.storageLocation, "download");
  assert.match(fallbackBackup.message, /after package validation/);
  assert.equal(links.length, linksBeforeInterceptedPicker + 1, "Intercepted native picker must use the validated download fallback");
  const fallbackBlob = blobs.get(links.at(-1).href);
  const fallbackReopen = await readJob(new File([fallbackBlob], fallbackBackup.fileName, { type: "application/zip" }));
  assert.equal(fallbackReopen.jobId, workbook.jobId);
  assert.equal(fallbackReopen.masterRevision, 17);

  const linksBeforeSaveAsFallback = links.length;
  const saveAsFallback = await saveJobAs(job);
  assert.equal(saveAsFallback.ok, true);
  assert.equal(saveAsFallback.storageLocation, "download");
  assert.match(saveAsFallback.message, /Downloaded and validated/);
  assert.equal(links.length, linksBeforeSaveAsFallback + 1, "Intercepted Save As must use the validated download fallback");
  const saveAsBlob = blobs.get(links.at(-1).href);
  const saveAsReopen = await readJob(new File([saveAsBlob], saveAsFallback.fileName, { type: "application/zip" }));
  assert.equal(saveAsReopen.jobId, workbook.jobId);
  assert.equal(saveAsReopen.masterRevision, 18, "Save As increments the revision exactly once");

  const linksBeforeCancelledPicker = links.length;
  globalThis.window.showSaveFilePicker = async () => {
    throw new DOMException("The user aborted a request.", "AbortError");
  };
  const cancelledBackup = await downloadBackupCopy(job);
  assert.equal(cancelledBackup.ok, true);
  assert.equal(cancelledBackup.cancelled, true);
  assert.equal(links.length, linksBeforeCancelledPicker, "A genuine user cancellation must not start a fallback download");

  console.log(JSON.stringify({
    packageBytes: firstBlob.size,
    repeatedDownloads: 2,
    savedAtPreserved: reopened.lastModified,
    revisionPreserved: reopened.masterRevision,
    readBackVerified: true,
    directFileWriteVerified: true,
    interceptedPickerFallbackVerified: true,
    interceptedSaveAsFallbackVerified: true,
    genuineCancellationPreserved: true,
    delayedCleanupVerified: true,
    failureCleanupVerified: true,
  }, null, 2));
} finally {
  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  globalThis.setTimeout = originalSetTimeout;
  if (originalNavigator === undefined) delete globalThis.navigator;
  else Object.defineProperty(globalThis, "navigator", { configurable: true, value: originalNavigator });
}
