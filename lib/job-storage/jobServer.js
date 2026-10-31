// The job server: the shared access point of a multi-user installation. A builder runs it on
// their own office server / NAS or their own cloud host (scripts/job-storage-server.mjs), in front
// of their own storage. GR8 Result does not host the job documents.
//
// EVERY request is authenticated (a per-user bearer token) and authorised against the company in
// its path before anything is read or written. Every job route names its company and its job:
//
//   GET    /v1/whoami
//   GET    /v1/companies/:companyId/jobs
//   GET    /v1/companies/:companyId/jobs/:jobId                      head: { revision, core, ... }
//   GET    /v1/companies/:companyId/jobs/:jobId/revisions            history
//   GET    /v1/companies/:companyId/jobs/:jobId/revisions/:n         one revision
//   POST   /v1/companies/:companyId/jobs/:jobId/revisions            { baseRevision, core, name?, note? } -> 201 | 409
//   POST   /v1/companies/:companyId/jobs/:jobId/restore              { revision }
//   POST   /v1/companies/:companyId/assets/missing                   { hashes } -> { missing }
//   PUT    /v1/companies/:companyId/assets/:sha256                   body = the asset
//   GET    /v1/companies/:companyId/assets/:sha256
//   POST   /v1/companies/:companyId/backups                          (admin)
import http from "node:http";
import https from "node:https";
import { JobStoreError } from "./jobStore.js";

const MAX_BODY_BYTES = 512 * 1024 * 1024;

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new JobStoreError("Request is too large.", { status: 413, code: "TOO_LARGE" });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createJobServer({ store, allowOrigin = "", tls = null } = {}) {
  const send = (response, status, body, headers = {}) => {
    const payload = Buffer.isBuffer(body) || body instanceof Uint8Array ? Buffer.from(body) : Buffer.from(JSON.stringify(body));
    response.writeHead(status, { "content-type": Buffer.isBuffer(body) || body instanceof Uint8Array ? "application/octet-stream" : "application/json", "content-length": payload.length, "cache-control": "no-store",
      ...(allowOrigin ? { "access-control-allow-origin": allowOrigin, "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, POST, PUT, OPTIONS", vary: "origin" } : {}), ...headers });
    response.end(payload);
  };
  return (tls ? https.createServer.bind(https, tls) : http.createServer.bind(http))(async (request, response) => {
    try {
      if (request.method === "OPTIONS") { send(response, 204, Buffer.alloc(0)); return; }
      const url = new URL(request.url, "http://job-server");
      const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      if (parts[0] !== "v1") throw new JobStoreError("Not found.", { status: 404, code: "NOT_FOUND" });
      // Authentication first: nothing below runs for an unknown or disabled user.
      const user = store.authenticate((request.headers.authorization || "").replace(/^Bearer\s+/i, ""));
      if (parts[1] === "whoami" && request.method === "GET") { send(response, 200, { user, storage: store.provider.describe() }); return; }
      if (parts[1] !== "companies" || !parts[2]) throw new JobStoreError("Not found.", { status: 404, code: "NOT_FOUND" });
      const companyId = parts[2];
      const can = (action) => store.authorise(user, companyId, action);
      const json = async () => { const body = await readBody(request); try { return body.length ? JSON.parse(body.toString("utf8")) : {}; } catch { throw new JobStoreError("The request body is not valid JSON."); } };
      const [, , , area, id, sub, subId] = parts;

      if (area === "jobs" && !id && request.method === "GET") { can("read"); send(response, 200, { jobs: store.listJobs(companyId) }); return; }
      if (area === "jobs" && id) {
        if (!sub && request.method === "GET") {
          can("read");
          const head = await store.readRevision(companyId, id);
          if (!head) throw new JobStoreError("This job is not in this company's storage.", { status: 404, code: "NOT_FOUND" });
          send(response, 200, { ...head, head: store.headOf(companyId, id) }); return;
        }
        if (sub === "revisions" && !subId && request.method === "GET") { can("read"); send(response, 200, { revisions: store.listRevisions(companyId, id) }); return; }
        if (sub === "revisions" && subId && request.method === "GET") {
          can("read");
          const found = await store.readRevision(companyId, id, Number(subId));
          if (!found) throw new JobStoreError("That revision does not exist.", { status: 404, code: "NOT_FOUND" });
          send(response, 200, found); return;
        }
        if (sub === "revisions" && !subId && request.method === "POST") {
          can("write");
          const body = await json();
          send(response, 201, await store.commitRevision({ companyId, jobId: id, baseRevision: body.baseRevision, core: body.core, name: body.name, note: body.note, user })); return;
        }
        if (sub === "restore" && request.method === "POST") { can("write"); const body = await json(); send(response, 201, await store.restoreRevision({ companyId, jobId: id, revision: Number(body.revision), user })); return; }
      }
      if (area === "assets" && id === "missing" && request.method === "POST") { can("read"); const body = await json(); send(response, 200, { missing: store.missingAssets(companyId, Array.isArray(body.hashes) ? body.hashes : []) }); return; }
      if (area === "assets" && id && request.method === "PUT") { can("write"); send(response, 201, await store.putAsset(companyId, id, await readBody(request), user)); return; }
      if (area === "assets" && id && request.method === "GET") {
        can("read");
        const bytes = await store.getAsset(companyId, id);
        if (!bytes) throw new JobStoreError("That document is not in this company's storage.", { status: 404, code: "NOT_FOUND" });
        send(response, 200, bytes); return;
      }
      if (area === "backups" && request.method === "POST") { can("manage"); send(response, 201, await store.backupCompany(companyId, user)); return; }
      throw new JobStoreError("Not found.", { status: 404, code: "NOT_FOUND" });
    } catch (error) {
      const known = error instanceof JobStoreError;
      if (!known) console.error("[job-server]", error);
      send(response, known ? error.status : 500, { error: known ? error.message : "The job server could not complete the request.", code: known ? error.code : "SERVER_ERROR", detail: known ? error.detail : null });
    }
  });
}
