// The job store: the shared coordination point of a multi-user installation. Node only - it runs
// inside the job server on the builder's own machine (office server / NAS, or the builder's cloud
// host). It is the ONLY writer of a shared installation's storage.
//
//   WHAT is stored    job documents (core records, assets) go through a storage provider, in
//                     the builder's storage, under companies/<companyId>/...
//   WHAT is decided   who the users are, what they may touch, which revision is a job's head and
//                     who saved first: a transactional database (SQLite, sqliteDriver.js) beside the storage.
//                     Shared files alone are never trusted to order two writers.
//
// Every revision is kept: a save never destroys what it replaces, any revision can be read or
// restored, and a save based on an older revision than the head is refused (JobStoreConflict) -
// one user's work is never silently overwritten by another's.

import { openDatabase } from "./sqliteDriver.js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { assetHashesOf, sha256Hex } from "./jobPackage.js";
import { bytesToText, toBytes } from "./storageProviders.js";

export const ROLES = Object.freeze({ admin: ["read", "write", "manage"], member: ["read", "write"], viewer: ["read"] });
const text = (value) => String(value ?? "").trim();
const safeId = (id) => text(id).replace(/[^A-Za-z0-9.-]/g, (char) => `_${char.charCodeAt(0).toString(16)}`);
const tokenHash = (token) => createHash("sha256").update(String(token)).digest("hex");

export class JobStoreError extends Error {
  constructor(message, { status = 400, code = "BAD_REQUEST", detail = null } = {}) { super(message); this.name = "JobStoreError"; this.status = status; this.code = code; this.detail = detail; }
}
export class JobStoreConflict extends JobStoreError {
  constructor(head) {
    super(`This job was saved by ${head.updatedByName || "another user"} at ${head.updatedAt} (revision ${head.revision}). Nothing was overwritten.`, { status: 409, code: "JOB_CONFLICT", detail: head });
    this.name = "JobStoreConflict"; this.head = head;
  }
}

export class JobStore {
  constructor({ provider, databasePath = ":memory:", now = () => new Date().toISOString() } = {}) {
    if (!provider) throw new Error("A storage provider is required.");
    this.provider = provider; this.now = now;
    this.db = openDatabase(databasePath);
    this.db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 10000;
      CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), name TEXT NOT NULL, role TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, disabled INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (company_id TEXT NOT NULL, job_id TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', head_revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, PRIMARY KEY (company_id, job_id));
      CREATE TABLE IF NOT EXISTS revisions (company_id TEXT NOT NULL, job_id TEXT NOT NULL, revision INTEGER NOT NULL, base_revision INTEGER NOT NULL, core_key TEXT NOT NULL, core_sha TEXT NOT NULL, core_bytes INTEGER NOT NULL, asset_hashes TEXT NOT NULL, created_at TEXT NOT NULL, created_by TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', PRIMARY KEY (company_id, job_id, revision));
      CREATE TABLE IF NOT EXISTS assets (company_id TEXT NOT NULL, hash TEXT NOT NULL, bytes INTEGER NOT NULL, created_at TEXT NOT NULL, created_by TEXT NOT NULL, PRIMARY KEY (company_id, hash));
      CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, company_id TEXT, user_id TEXT, action TEXT NOT NULL, job_id TEXT, detail TEXT);`);
  }
  close() { this.db.close(); }
  audit(companyId, userId, action, jobId = "", detail = "") { this.db.prepare("INSERT INTO audit (at, company_id, user_id, action, job_id, detail) VALUES (?, ?, ?, ?, ?, ?)").run(this.now(), companyId || "", userId || "", action, jobId || "", typeof detail === "string" ? detail : JSON.stringify(detail)); }

  // ---- companies and users -----------------------------------------------------------------------
  createCompany({ id = "", name = "" } = {}) {
    const companyId = text(id) || `company-${randomUUID()}`;
    if (!text(name)) throw new JobStoreError("A company name is required.");
    this.db.prepare("INSERT INTO companies (id, name, created_at) VALUES (?, ?, ?)").run(companyId, text(name), this.now());
    this.audit(companyId, "", "company.create");
    return { id: companyId, name: text(name) };
  }
  // Returns the user's access token ONCE; only its hash is stored.
  createUser({ companyId, name, role = "member" } = {}) {
    if (!ROLES[role]) throw new JobStoreError(`Unknown role "${role}".`);
    if (!this.db.prepare("SELECT 1 FROM companies WHERE id = ?").get(text(companyId))) throw new JobStoreError("Unknown company.", { status: 404, code: "NOT_FOUND" });
    const user = { id: `user-${randomUUID()}`, companyId: text(companyId), name: text(name) || "User", role };
    const token = `gr8_${randomBytes(32).toString("hex")}`;
    this.db.prepare("INSERT INTO users (id, company_id, name, role, token_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(user.id, user.companyId, user.name, role, tokenHash(token), this.now());
    this.audit(user.companyId, user.id, "user.create", "", role);
    return { user, token };
  }
  disableUser(userId) { this.db.prepare("UPDATE users SET disabled = 1 WHERE id = ?").run(userId); }

  // ---- authentication and authorisation: every shared-data request passes both ------------------
  authenticate(token) {
    const row = token ? this.db.prepare("SELECT id, company_id, name, role, disabled FROM users WHERE token_hash = ?").get(tokenHash(token)) : null;
    if (!row || row.disabled) throw new JobStoreError("Sign-in required.", { status: 401, code: "UNAUTHENTICATED" });
    return { id: row.id, companyId: row.company_id, name: row.name, role: row.role };
  }
  authorise(user, companyId, action) {
    if (!user || user.companyId !== text(companyId)) { this.audit(companyId, user?.id, "denied.company", "", action); throw new JobStoreError("You do not have access to this company's jobs.", { status: 403, code: "FORBIDDEN" }); }
    if (!ROLES[user.role]?.includes(action)) { this.audit(companyId, user.id, "denied.role", "", action); throw new JobStoreError(`Your role (${user.role}) cannot ${action} jobs.`, { status: 403, code: "FORBIDDEN" }); }
    return user;
  }

  // ---- assets: immutable, named by their SHA-256, per company ------------------------------------
  assetKey(companyId, hash) { return `companies/${safeId(companyId)}/assets/${hash.slice(0, 2)}/${hash}`; }
  missingAssets(companyId, hashes = []) {
    const has = this.db.prepare("SELECT 1 FROM assets WHERE company_id = ? AND hash = ?");
    return [...new Set(hashes)].filter((hash) => !has.get(companyId, hash));
  }
  async putAsset(companyId, hash, content, user) {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new JobStoreError("An asset is named by its SHA-256 hash.");
    const bytes = toBytes(content);
    if (await sha256Hex(bytes) !== hash) throw new JobStoreError("The asset does not match its hash; it was not stored.", { code: "ASSET_HASH_MISMATCH" });
    if (!this.missingAssets(companyId, [hash]).length) return { hash, stored: false };
    await this.provider.putObject(this.assetKey(companyId, hash), bytes);
    this.db.prepare("INSERT OR IGNORE INTO assets (company_id, hash, bytes, created_at, created_by) VALUES (?, ?, ?, ?, ?)").run(companyId, hash, bytes.length, this.now(), user?.id || "");
    return { hash, stored: true };
  }
  async getAsset(companyId, hash) {
    if (this.missingAssets(companyId, [hash]).length) return null;
    return this.provider.getObject(this.assetKey(companyId, hash));
  }

  // ---- jobs and revisions ------------------------------------------------------------------------
  headOf(companyId, jobId) {
    const row = this.db.prepare("SELECT j.name, j.head_revision, j.updated_at, j.updated_by, u.name AS user_name FROM jobs j LEFT JOIN users u ON u.id = j.updated_by WHERE j.company_id = ? AND j.job_id = ?").get(companyId, jobId);
    return row ? { jobId, name: row.name, revision: row.head_revision, updatedAt: row.updated_at, updatedBy: row.updated_by, updatedByName: row.user_name || "" } : null;
  }
  listJobs(companyId) {
    return this.db.prepare("SELECT j.job_id, j.name, j.head_revision, j.updated_at, u.name AS user_name FROM jobs j LEFT JOIN users u ON u.id = j.updated_by WHERE j.company_id = ? ORDER BY j.updated_at DESC").all(companyId)
      .map((row) => ({ jobId: row.job_id, name: row.name, revision: row.head_revision, updatedAt: row.updated_at, updatedByName: row.user_name || "" }));
  }
  listRevisions(companyId, jobId) {
    return this.db.prepare("SELECT r.revision, r.base_revision, r.core_bytes, r.created_at, r.note, u.name AS user_name FROM revisions r LEFT JOIN users u ON u.id = r.created_by WHERE r.company_id = ? AND r.job_id = ? ORDER BY r.revision DESC").all(companyId, jobId)
      .map((row) => ({ revision: row.revision, baseRevision: row.base_revision, coreBytes: row.core_bytes, createdAt: row.created_at, createdByName: row.user_name || "", note: row.note }));
  }

  // The one way a job changes. baseRevision is the revision the writer loaded (0 for a new job).
  // The decision "is this still the head?" and the move of the head happen in one database
  // transaction, so of two simultaneous saves exactly one wins and the other is refused.
  async commitRevision({ companyId, jobId, baseRevision, core, user, name = "", note = "" } = {}) {
    if (!text(jobId)) throw new JobStoreError("A jobId is required: no job data is written without one.");
    if (!Number.isInteger(baseRevision) || baseRevision < 0) throw new JobStoreError("A save must say which revision it is based on (baseRevision).");
    if (!core || typeof core !== "object") throw new JobStoreError("A job record is required.");
    const assetHashes = assetHashesOf(core);
    const missing = this.missingAssets(companyId, assetHashes);
    if (missing.length) throw new JobStoreError(`The job refers to ${missing.length} document(s) that have not been uploaded.`, { status: 422, code: "ASSETS_MISSING", detail: { missing } });
    // Cheap early answer; the authoritative check is inside the transaction below.
    const before = this.headOf(companyId, jobId);
    if ((before?.revision || 0) !== baseRevision) throw new JobStoreConflict(before || { jobId, revision: 0, updatedAt: "", updatedBy: "" });
    const json = JSON.stringify(core);
    const bytes = toBytes(json);
    const coreSha = await sha256Hex(bytes);
    const coreKey = `companies/${safeId(companyId)}/jobs/${safeId(jobId)}/core/${randomUUID()}.json`;
    await this.provider.putObject(coreKey, bytes);
    const at = this.now();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const head = this.headOf(companyId, jobId);
      if ((head?.revision || 0) !== baseRevision) throw new JobStoreConflict(head);
      const revision = baseRevision + 1;
      this.db.prepare("INSERT INTO revisions (company_id, job_id, revision, base_revision, core_key, core_sha, core_bytes, asset_hashes, created_at, created_by, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(companyId, jobId, revision, baseRevision, coreKey, coreSha, bytes.length, JSON.stringify(assetHashes), at, user?.id || "", text(note));
      this.db.prepare("INSERT INTO jobs (company_id, job_id, name, head_revision, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (company_id, job_id) DO UPDATE SET head_revision = excluded.head_revision, updated_at = excluded.updated_at, updated_by = excluded.updated_by, name = CASE WHEN excluded.name = '' THEN jobs.name ELSE excluded.name END")
        .run(companyId, jobId, text(name), revision, at, user?.id || "");
      this.db.exec("COMMIT");
      this.audit(companyId, user?.id, "job.commit", jobId, { revision, baseRevision });
      return { jobId, revision, updatedAt: at, updatedBy: user?.id || "", coreBytes: bytes.length };
    } catch (error) {
      this.db.exec("ROLLBACK");
      await this.provider.deleteObject(coreKey).catch(() => {});
      if (error instanceof JobStoreConflict) this.audit(companyId, user?.id, "job.conflict", jobId, { baseRevision, head: error.head?.revision });
      throw error;
    }
  }
  // { revision, core, ... } for the head, or for `revision`. The stored record is checked against its hash.
  async readRevision(companyId, jobId, revision = null) {
    const row = revision == null
      ? this.db.prepare("SELECT r.* FROM revisions r JOIN jobs j ON j.company_id = r.company_id AND j.job_id = r.job_id AND j.head_revision = r.revision WHERE r.company_id = ? AND r.job_id = ?").get(companyId, jobId)
      : this.db.prepare("SELECT * FROM revisions WHERE company_id = ? AND job_id = ? AND revision = ?").get(companyId, jobId, revision);
    if (!row) return null;
    const bytes = await this.provider.getObject(row.core_key);
    if (!bytes || await sha256Hex(bytes) !== row.core_sha) throw new JobStoreError(`Revision ${row.revision} of this job is damaged in storage. Earlier revisions are unaffected.`, { status: 500, code: "REVISION_DAMAGED" });
    return { jobId, revision: row.revision, baseRevision: row.base_revision, createdAt: row.created_at, createdBy: row.created_by, note: row.note, assetHashes: JSON.parse(row.asset_hashes), core: JSON.parse(bytesToText(bytes)) };
  }
  // Recovery: an earlier revision becomes a NEW head revision. History is never rewritten.
  async restoreRevision({ companyId, jobId, revision, user }) {
    const old = await this.readRevision(companyId, jobId, revision);
    if (!old) throw new JobStoreError("That revision does not exist.", { status: 404, code: "NOT_FOUND" });
    const head = this.headOf(companyId, jobId);
    return this.commitRevision({ companyId, jobId, baseRevision: head.revision, core: old.core, user, note: `Restored from revision ${revision}` });
  }
  // A backup manifest of every job of a company as it stands now: enough, with the immutable
  // core records and assets it names, to rebuild every revision. Written beside the data.
  async backupCompany(companyId, user = null) {
    const jobs = this.listJobs(companyId).map((job) => ({ ...job, revisions: this.db.prepare("SELECT revision, base_revision, core_key, core_sha, asset_hashes, created_at, created_by, note FROM revisions WHERE company_id = ? AND job_id = ? ORDER BY revision").all(companyId, job.jobId) }));
    const key = `companies/${safeId(companyId)}/backups/${this.now().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.json`;
    await this.provider.putObject(key, JSON.stringify({ format: "gr8-job-store-backup", version: 1, companyId, createdAt: this.now(), jobs }));
    this.audit(companyId, user?.id, "company.backup", "", key);
    return { key, jobs: jobs.length, revisions: jobs.reduce((total, job) => total + job.revisions.length, 0) };
  }
}
