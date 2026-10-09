// How the application reads and writes a job in builder-owned storage. Two clients, one shape:
//
//   LocalJobClient    a storage provider on this computer. Single user: clearly LOCAL ONLY.
//   RemoteJobClient   the builder's job server (office server / NAS / builder cloud). Multi-user.
//
//   open(jobId)                         -> { workbook, revision, updatedAt, updatedByName } | null
//   save(jobId, workbook, { baseRevision, name, note })  -> { revision, uploadedAssets, coreBytes }
//   history(jobId) / list() / restore(jobId, revision) / describe()
//
// Every call names its company and its job. A save states the revision it was based on; if the
// job has moved on, save() throws JobConflictError and writes nothing. Working offline, a save
// that cannot reach the server is kept locally (saveOrQueue) and offered again on reconnect
// (syncPending): it goes through only if the job has not changed meanwhile - otherwise it is
// returned as a conflict with both versions intact, never forced over another user's work.

import { JOB_PACKAGE_VERSION, assetHashesOf, joinJob, sha256Hex, splitJob } from "./jobPackage.js";
import { STORAGE_KINDS, bytesToText } from "./storageProviders.js";

export class JobConflictError extends Error {
  constructor(head = {}) { super(`This job was saved by ${head.updatedByName || "another user"}${head.updatedAt ? ` at ${head.updatedAt}` : ""} (revision ${head.revision}). Nothing was overwritten.`); this.name = "JobConflictError"; this.code = "JOB_CONFLICT"; this.head = head; }
}
export class JobStorageOfflineError extends Error {
  constructor(cause) { super("The shared job storage cannot be reached."); this.name = "JobStorageOfflineError"; this.code = "OFFLINE"; this.cause = cause; }
}
const safe = (id) => String(id).replace(/[^A-Za-z0-9.-]/g, (char) => `_${char.charCodeAt(0).toString(16)}`);

export class RemoteJobClient {
  constructor({ baseUrl, token, companyId, fetch: fetchImpl = globalThis.fetch, pendingStore = null } = {}) {
    if (!baseUrl || !token || !companyId) throw new Error("A job server address, a user token and a company are required.");
    Object.assign(this, { baseUrl: baseUrl.replace(/\/+$/, ""), token, companyId, fetchImpl, pendingStore });
  }
  describe() { return { shared: true, label: "Shared storage (multi-user)", server: this.baseUrl, companyId: this.companyId }; }
  async request(method, path, { json, body, raw = false } = {}) {
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/v1${path}`, { method, headers: { authorization: `Bearer ${this.token}`, ...(json !== undefined ? { "content-type": "application/json" } : body !== undefined ? { "content-type": "application/octet-stream" } : {}) }, body: json !== undefined ? JSON.stringify(json) : body });
    } catch (error) { throw new JobStorageOfflineError(error); }
    if (response.status === 404 && method === "GET") return null;
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      if (response.status === 409) throw new JobConflictError(problem.detail || {});
      const error = new Error(problem.error || `Job storage request failed (${response.status}).`);
      error.status = response.status; error.code = problem.code || "";
      throw error;
    }
    return raw ? new Uint8Array(await response.arrayBuffer()) : response.json();
  }
  company(path = "") { return `/companies/${encodeURIComponent(this.companyId)}${path}`; }
  job(jobId, path = "") { if (!jobId) throw new Error("A jobId is required."); return this.company(`/jobs/${encodeURIComponent(jobId)}${path}`); }

  async list() { return (await this.request("GET", this.company("/jobs")))?.jobs || []; }
  async history(jobId) { return (await this.request("GET", this.job(jobId, "/revisions")))?.revisions || []; }
  async open(jobId, { revision = null, verify = true } = {}) {
    const found = await this.request("GET", revision == null ? this.job(jobId) : this.job(jobId, `/revisions/${revision}`));
    if (!found) return null;
    const workbook = await joinJob(found.core, async (hash) => { const bytes = await this.request("GET", this.company(`/assets/${hash}`), { raw: true }); return bytes ? bytesToText(bytes) : null; }, { verify });
    return { workbook, revision: found.revision, updatedAt: found.head?.updatedAt || found.createdAt, updatedByName: found.head?.updatedByName || "" };
  }
  async save(jobId, workbook, { baseRevision, name = "", note = "" } = {}) {
    if (!Number.isInteger(baseRevision)) throw new Error("A save must say which revision it is based on (0 for a new job).");
    const { core, assets } = await splitJob(workbook);
    const { missing } = await this.request("POST", this.company("/assets/missing"), { json: { hashes: [...assets.keys()] } });
    // Only documents the storage does not already hold are sent: unchanged plans cost nothing.
    for (const hash of missing) await this.request("PUT", this.company(`/assets/${hash}`), { body: assets.get(hash) });
    const saved = await this.request("POST", this.job(jobId, "/revisions"), { json: { baseRevision, core, name, note } });
    return { ...saved, uploadedAssets: missing.length };
  }
  async restore(jobId, revision) { return this.request("POST", this.job(jobId, "/restore"), { json: { revision } }); }

  // ---- offline -------------------------------------------------------------------------------------
  pendingKey(jobId) { return `pending/${safe(this.companyId)}/${safe(jobId)}.json`; }
  // Saves; if the server cannot be reached the work is kept on this computer and reported as queued.
  async saveOrQueue(jobId, workbook, options = {}) {
    try { return { ...(await this.save(jobId, workbook, options)), queued: false }; } catch (error) {
      if (!(error instanceof JobStorageOfflineError) || !this.pendingStore) throw error;
      await this.pendingStore.putObject(this.pendingKey(jobId), JSON.stringify({ jobId, baseRevision: options.baseRevision, name: options.name || "", queuedAt: new Date().toISOString(), workbook }));
      return { queued: true, baseRevision: options.baseRevision };
    }
  }
  async pending(jobId) { const bytes = await this.pendingStore?.getObject(this.pendingKey(jobId)); return bytes ? JSON.parse(bytesToText(bytes)) : null; }
  // On reconnect. { synced, revision } when the queued work went in; { conflict, head, pending }
  // when the job changed while this computer was offline - the queued work stays queued, untouched.
  async syncPending(jobId) {
    const queued = await this.pending(jobId);
    if (!queued) return { synced: false, nothingPending: true };
    try {
      const saved = await this.save(jobId, queued.workbook, { baseRevision: queued.baseRevision, name: queued.name, note: "Saved while offline" });
      await this.pendingStore.deleteObject(this.pendingKey(jobId));
      return { synced: true, revision: saved.revision };
    } catch (error) {
      if (error instanceof JobConflictError) return { synced: false, conflict: true, head: error.head, pending: queued };
      throw error;
    }
  }
}

// Single-user storage on this computer, in the same stored form (core record + assets + every
// revision kept), so a job moves between local and shared storage without conversion.
export class LocalJobClient {
  constructor({ provider, companyId = "local", userName = "This computer" } = {}) {
    if (!provider) throw new Error("A storage provider is required.");
    Object.assign(this, { provider, companyId, userName });
  }
  describe() { return { ...STORAGE_KINDS.local, shared: false, label: "Local only (single user)", location: this.provider.describe().location }; }
  base(jobId) { if (!jobId) throw new Error("A jobId is required."); return `companies/${safe(this.companyId)}/jobs/${safe(jobId)}`; }
  assetKey(hash) { return `companies/${safe(this.companyId)}/assets/${hash.slice(0, 2)}/${hash}`; }
  async manifest(jobId) { const bytes = await this.provider.getObject(`${this.base(jobId)}/manifest.json`); return bytes ? JSON.parse(bytesToText(bytes)) : { jobId, name: "", head: 0, revisions: [] }; }
  async list() {
    const keys = await this.provider.listObjects(`companies/${safe(this.companyId)}/jobs/`);
    const jobs = [];
    for (const key of keys.filter((item) => item.endsWith("/manifest.json"))) { const manifest = JSON.parse(bytesToText(await this.provider.getObject(key))); jobs.push({ jobId: manifest.jobId, name: manifest.name, revision: manifest.head, updatedAt: manifest.revisions.at(-1)?.createdAt || "" }); }
    return jobs;
  }
  async history(jobId) { return (await this.manifest(jobId)).revisions.slice().reverse(); }
  async open(jobId, { revision = null, verify = true } = {}) {
    const manifest = await this.manifest(jobId);
    const entry = manifest.revisions.find((item) => item.revision === (revision ?? manifest.head));
    if (!entry) return null;
    const core = JSON.parse(bytesToText(await this.provider.getObject(`${this.base(jobId)}/core/${entry.revision}.json`)));
    const workbook = await joinJob(core, async (hash) => { const bytes = await this.provider.getObject(this.assetKey(hash)); return bytes ? bytesToText(bytes) : null; }, { verify });
    return { workbook, revision: entry.revision, updatedAt: entry.createdAt, updatedByName: this.userName };
  }
  async save(jobId, workbook, { baseRevision, name = "", note = "" } = {}) {
    if (!Number.isInteger(baseRevision)) throw new Error("A save must say which revision it is based on (0 for a new job).");
    const manifest = await this.manifest(jobId);
    if (manifest.head !== baseRevision) throw new JobConflictError({ revision: manifest.head, updatedAt: manifest.revisions.at(-1)?.createdAt || "", updatedByName: "another window on this computer" });
    const { core, assets } = await splitJob(workbook);
    let uploadedAssets = 0;
    for (const [hash, content] of assets) if (!await this.provider.hasObject(this.assetKey(hash))) { await this.provider.putObject(this.assetKey(hash), content); uploadedAssets += 1; }
    const json = JSON.stringify(core);
    const revision = manifest.head + 1;
    await this.provider.putObject(`${this.base(jobId)}/core/${revision}.json`, json);
    const entry = { revision, baseRevision, createdAt: new Date().toISOString(), coreSha: await sha256Hex(json), coreBytes: json.length, assetHashes: assetHashesOf(core), note, packageVersion: JOB_PACKAGE_VERSION };
    // The manifest is written last: a save interrupted before this line leaves the previous head intact.
    await this.provider.putObject(`${this.base(jobId)}/manifest.json`, JSON.stringify({ jobId, name: name || manifest.name, head: revision, revisions: [...manifest.revisions, entry] }));
    return { jobId, revision, updatedAt: entry.createdAt, coreBytes: json.length, uploadedAssets };
  }
  async restore(jobId, revision) {
    const old = await this.open(jobId, { revision });
    if (!old) throw new Error("That revision does not exist.");
    return this.save(jobId, old.workbook, { baseRevision: (await this.manifest(jobId)).head, note: `Restored from revision ${revision}` });
  }
}
