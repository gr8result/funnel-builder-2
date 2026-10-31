// Storage Settings: where this builder's jobs are stored.
//   Local Only      single-user storage on this computer
//   Shared Storage  the builder's own office server / NAS or cloud host (multi-user)
// with a connection test, a clear connection status and the company's shared job list.
// The rules are in lib/job-storage (storageSettings.js, sharedSync.js); this screen only collects
// the settings. Changing the mode never moves, converts or overwrites a job by itself.
import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { STORAGE_MODES, loadStorageSettings, saveStorageSettings, serverAddressCheck, sharedSettingsProblem, testStorageConnection } from "../../../lib/job-storage/storageSettings.js";
import { listSharedJobs, openSharedJob, sharedJobState } from "../../../lib/job-storage/sharedSync.js";
import { browserWorkspaceId } from "../../../lib/builders/browserTenantStorage.js";

export default function StorageSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(null);
  const [test, setTest] = useState({ state: "idle" });
  const [jobs, setJobs] = useState({ state: "idle", list: [] });
  const [message, setMessage] = useState({ kind: "", text: "" });
  const [opening, setOpening] = useState("");
  // Settings belong to a company workspace. Until this browser knows which workspace is signed in
  // they cannot be read or saved under the right one, so the screen waits for it.
  const [workspace, setWorkspace] = useState("");
  useEffect(() => {
    const read = () => { const id = browserWorkspaceId(); if (!id) return false; setWorkspace(id); const current = loadStorageSettings(); setSettings(current); setSaved(current); return true; };
    if (read()) return undefined;
    const timer = window.setInterval(() => { if (read()) window.clearInterval(timer); }, 500);
    return () => window.clearInterval(timer);
  }, []);
  if (!settings) return (
    <main className="ss-page" data-testid="storage-settings-waiting"><style>{STORAGE_CSS}</style>
      <header className="ss-header"><div><h1>Storage Settings</h1><p>Open the <Link href="/modules/estimate-builder" className="ss-link">Project Workspace</Link> and sign in first, so this browser knows which company workspace these settings belong to.</p></div></header>
    </main>
  );

  const shared = settings.mode === "shared";
  const address = shared && settings.serverUrl ? serverAddressCheck(settings.serverUrl) : null;
  const dirty = JSON.stringify({ ...settings, lastTest: null }) !== JSON.stringify({ ...saved, lastTest: null });
  const change = (patch) => { setSettings({ ...settings, ...patch }); setTest({ state: "idle" }); setMessage({ kind: "", text: "" }); };

  async function runTest() {
    setTest({ state: "testing" });
    const result = await testStorageConnection(settings);
    setTest({ state: result.ok ? "ok" : "failed", ...result });
    return result;
  }
  async function save() {
    try {
      let lastTest = null;
      if (shared) {
        // Shared storage is only switched on once the connection has actually been proven.
        const result = test.state === "ok" ? test : await runTest();
        if (!result.ok) { setMessage({ kind: "error", text: "Shared Storage was not switched on: the connection test did not pass." }); return; }
        lastTest = { ok: true, userName: result.user.name, role: result.user.role, testedAt: result.testedAt || new Date().toISOString() };
      }
      const next = saveStorageSettings({ ...settings, userName: lastTest?.userName || settings.userName, lastTest });
      setSettings(next); setSaved(next);
      setMessage({ kind: "ok", text: next.mode === "shared" ? "Shared Storage is on. Each job is shared the next time it is saved; jobs already on this computer are unchanged until then." : "Local Only is on. Jobs are stored on this computer only. Nothing was removed from shared storage." });
    } catch (error) { setMessage({ kind: "error", text: error.message }); }
  }
  async function refreshJobs() {
    setJobs({ state: "loading", list: [] });
    try { setJobs({ state: "ready", list: await listSharedJobs(saved) }); } catch (error) { setJobs({ state: "failed", list: [], reason: error.code === "OFFLINE" ? "The shared server cannot be reached." : error.message }); }
  }
  async function open(job) {
    setOpening(job.jobId);
    try {
      const state = sharedJobState(`job:${job.jobId}`, saved);
      if (state.pending && !window.confirm(`This computer has changes to "${job.name || job.jobId}" that were never shared. Opening the latest shared version replaces them on this computer. Continue?`)) return;
      const found = await openSharedJob(job.jobId, saved);
      if (!found) { setMessage({ kind: "error", text: "That job is no longer in shared storage." }); return; }
      const { storeSharedJobLocally } = await import("../../../hooks/estimate-builder/useEstimateBuilderWorkbook.js");
      await storeSharedJobLocally(found.workbook);
      window.location.assign(`/modules/estimate-builder?jobId=${encodeURIComponent(job.jobId)}&page=projectDashboard`);
    } catch (error) { setMessage({ kind: "error", text: `The job could not be opened: ${error.message}` }); } finally { setOpening(""); }
  }

  const savedShared = saved.mode === "shared";
  return (
    <main className="ss-page" data-testid="storage-settings" data-mode={saved.mode} data-workspace={workspace}>
      <Head><title>Storage Settings</title></Head>
      <style>{STORAGE_CSS}</style>
      <header className="ss-header">
        <div><Link href="/modules/estimate-builder" className="ss-link">← Project Workspace</Link><h1>Storage Settings</h1><p>Where this company&apos;s jobs are stored. GR8 Result does not hold your job documents.</p></div>
        <span className={`ss-status ${savedShared ? "shared" : "local"}`} data-testid="storage-current-mode">{savedShared ? `Shared Storage - multi-user${saved.lastTest?.userName ? ` · signed in as ${saved.lastTest.userName}` : ""}` : "Local Only - single user, this computer"}</span>
      </header>

      <section className="ss-card">
        <h2>Storage mode</h2>
        <div className="ss-modes" role="radiogroup" aria-label="Storage mode">
          {Object.values(STORAGE_MODES).map((mode) => (
            <label key={mode.key} className={`ss-mode ${settings.mode === mode.key ? "selected" : ""}`} data-testid={`storage-mode-${mode.key}`}>
              <input type="radio" name="storage-mode" checked={settings.mode === mode.key} onChange={() => change({ mode: mode.key })} />
              <span><strong>{mode.label}</strong><em>{mode.description}</em></span>
            </label>
          ))}
        </div>
      </section>

      {shared ? (
        <section className="ss-card" data-testid="storage-shared-form">
          <h2>Shared server</h2>
          <p>Your own job server, run on your office server / NAS or your cloud host. Your administrator provides these three details.</p>
          <div className="ss-fields">
            <label><span>Server address</span><input value={settings.serverUrl} onChange={(event) => change({ serverUrl: event.target.value })} placeholder="https://jobs.yourcompany.com.au" data-testid="storage-server-url" autoComplete="off" /></label>
            <label><span>Company ID</span><input value={settings.companyId} onChange={(event) => change({ companyId: event.target.value })} data-testid="storage-company-id" autoComplete="off" /></label>
            <label><span>Your access token</span><input type="password" value={settings.token} onChange={(event) => change({ token: event.target.value })} data-testid="storage-token" autoComplete="off" /></label>
          </div>
          {address ? <p className={`ss-note ${address.ok ? (address.secure ? "ok" : "warn") : "error"}`} data-testid="storage-address-check">{address.ok ? (address.secure ? "Secure connection (HTTPS)." : `${address.scope}. ${address.warning}`) : address.reason}</p> : null}
          <div className="ss-actions">
            <button type="button" className="ss-secondary" onClick={runTest} disabled={test.state === "testing" || Boolean(sharedSettingsProblem(settings))} data-testid="storage-test">{test.state === "testing" ? "Testing…" : "Test connection"}</button>
            {test.state === "ok" ? <span className="ss-result ok" data-testid="storage-test-result">✓ Connected as {test.user.name} ({test.user.role}) · documents are stored at: {test.storage?.label || "the builder's storage"}</span> : null}
            {test.state === "failed" ? <span className="ss-result error" data-testid="storage-test-result">✕ {test.reason}</span> : null}
          </div>
        </section>
      ) : null}

      <div className="ss-actions end">
        {message.text ? <span className={`ss-result ${message.kind}`} role="status" data-testid="storage-message">{message.text}</span> : null}
        <button type="button" className="ss-primary" onClick={save} disabled={!dirty && !(shared && !saved.lastTest)} data-testid="storage-save">Save storage settings</button>
      </div>

      {savedShared ? (
        <section className="ss-card" data-testid="storage-shared-jobs">
          <div className="ss-cardHead"><div><h2>Jobs in shared storage</h2><p>Open a job to work on its latest shared version on this computer.</p></div><button type="button" className="ss-secondary" onClick={refreshJobs} data-testid="storage-refresh-jobs">{jobs.state === "loading" ? "Loading…" : "Show shared jobs"}</button></div>
          {jobs.state === "failed" ? <p className="ss-note error">{jobs.reason}</p> : null}
          {jobs.state === "ready" && !jobs.list.length ? <p className="ss-note">No job has been shared yet. A job is shared the next time it is saved on a computer set to Shared Storage.</p> : null}
          {jobs.list.length ? (
            <ul className="ss-jobs">
              {jobs.list.map((job) => {
                const state = sharedJobState(`job:${job.jobId}`, saved);
                return (
                  <li key={job.jobId} data-testid="storage-shared-job" data-job-id={job.jobId}>
                    <div><strong>{job.name || job.jobId}</strong><span>Revision {job.revision} · saved {new Date(job.updatedAt).toLocaleString()}{job.updatedByName ? ` by ${job.updatedByName}` : ""}</span>
                      {state.conflict ? <span className="ss-warn">Your last save was not shared: {state.conflict.updatedByName || "another user"} saved first.</span> : state.pending ? <span className="ss-warn">This computer has changes not yet shared.</span> : state.revision && state.revision < job.revision ? <span className="ss-warn">A newer version than the one on this computer.</span> : null}</div>
                    <button type="button" className="ss-primary" onClick={() => open(job)} disabled={opening === job.jobId} data-testid="storage-open-job">{opening === job.jobId ? "Opening…" : "Open latest"}</button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

const STORAGE_CSS = `
.ss-page { max-width: 1040px; margin: 0 auto; padding: 28px 20px 60px; display: grid; gap: 18px; font-size: 16px; color: #0f172a; }
.ss-page h1, .ss-page h2, .ss-page p { margin: 0; }
.ss-page button, .ss-page input { font-size: 16px; font-family: inherit; }
.ss-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.ss-header h1 { font-size: 30px; font-weight: 900; margin: 6px 0 4px; } .ss-header p { color: #334155; }
.ss-link { color: #1d4ed8; font-weight: 800; }
.ss-status { padding: 10px 18px; border-radius: 999px; font-weight: 800; } .ss-status.local { background: #e2e8f0; color: #0f172a; } .ss-status.shared { background: #dcfce7; color: #14532d; }
.ss-card { background: #fff; border: 1px solid #d7deea; border-radius: 12px; padding: 20px 22px; display: grid; gap: 14px; }
.ss-card h2 { font-size: 22px; font-weight: 900; } .ss-card p { color: #334155; }
.ss-cardHead { display: flex; justify-content: space-between; gap: 16px; align-items: center; flex-wrap: wrap; }
.ss-modes { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
.ss-mode { display: flex; gap: 12px; align-items: flex-start; border: 1px solid #94a3b8; border-radius: 12px; padding: 16px 18px; cursor: pointer; }
.ss-mode.selected { border-color: #0f766e; box-shadow: 0 0 0 2px #0f766e; }
.ss-mode input { width: 22px !important; height: 22px; margin: 2px 0 0 !important; flex: 0 0 auto; }
.ss-mode span { display: grid; gap: 4px; } .ss-mode strong { font-size: 20px; } .ss-mode em { font-style: normal; color: #334155; }
.ss-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
.ss-fields label { display: grid; gap: 6px; font-weight: 700; } .ss-fields input { min-height: 46px; }
.ss-note { padding: 10px 14px; border-radius: 10px; background: #f1f5f9; }
.ss-note.ok { background: #dcfce7; color: #14532d; } .ss-note.warn { background: #fffbeb; color: #78350f; } .ss-note.error { background: #fee2e2; color: #991b1b; font-weight: 700; }
.ss-actions { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; } .ss-actions.end { justify-content: flex-end; }
.ss-result { font-weight: 700; } .ss-result.ok { color: #166534; } .ss-result.error { color: #b91c1c; }
.ss-primary, .ss-secondary { min-height: 46px; padding: 10px 22px; border-radius: 10px; font-weight: 800; cursor: pointer; }
.ss-primary { background: #0f766e; color: #fff; border: 0; } .ss-primary:disabled, .ss-secondary:disabled { opacity: .5; cursor: default; }
.ss-secondary { background: #fff; color: #0f172a; border: 1px solid #94a3b8; }
.ss-jobs { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.ss-jobs li { display: flex; justify-content: space-between; align-items: center; gap: 14px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; flex-wrap: wrap; }
.ss-jobs li div { display: grid; gap: 2px; } .ss-jobs strong { font-size: 18px; } .ss-jobs span { color: #475569; } .ss-jobs .ss-warn { color: #b45309; font-weight: 700; }
`;
