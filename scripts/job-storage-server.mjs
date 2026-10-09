// The builder's job server: run it on the office server / NAS (or the builder's own cloud host).
// Job documents are stored in the folder given by --data, which the builder owns and backs up.
//
//   node scripts/job-storage-server.mjs init  --data <folder> --company "Company name" --admin "Admin name"
//   node scripts/job-storage-server.mjs user  --data <folder> --company-id <id> --name "Name" [--role member|viewer|admin]
//   node scripts/job-storage-server.mjs serve --data <folder> [--port 4780] [--host 0.0.0.0] [--kind office-server|builder-cloud] [--allow-origin https://app]
//        [--tls-cert cert.pem --tls-key key.pem]   HTTPS (required for access from outside the office)
//        [--private-network]                        plain HTTP, office network / VPN only
//
// Tokens are shown once, when a user is created. Put the server behind HTTPS (or a VPN) for
// access from outside the office.
import fs from "node:fs";
import path from "node:path";
import { JobStore } from "../lib/job-storage/jobStore.js";
import { createJobServer } from "../lib/job-storage/jobServer.js";
import { FileSystemStorageProvider } from "../lib/job-storage/fileSystemProvider.js";

const [command, ...rest] = process.argv.slice(2);
const option = (name, fallback = "") => { const index = rest.indexOf(`--${name}`); return index >= 0 ? rest[index + 1] : fallback; };
const data = option("data");
if (!command || !data) { console.error("Usage: job-storage-server.mjs <init|user|serve> --data <folder> ..."); process.exit(2); }
fs.mkdirSync(path.resolve(data), { recursive: true });
const store = new JobStore({ provider: new FileSystemStorageProvider({ root: path.join(path.resolve(data), "objects"), kind: option("kind", "office-server") }), databasePath: path.join(path.resolve(data), "job-store.sqlite") });

if (command === "init") {
  const company = store.createCompany({ name: option("company", "Builder") });
  const { user, token } = store.createUser({ companyId: company.id, name: option("admin", "Administrator"), role: "admin" });
  console.log(JSON.stringify({ company, user, token }, null, 2));
} else if (command === "user") {
  console.log(JSON.stringify(store.createUser({ companyId: option("company-id"), name: option("name", "User"), role: option("role", "member") }), null, 2));
} else if (command === "serve") {
  const port = Number(option("port", "4780"));
  const host = option("host", "127.0.0.1");
  const tls = option("tls-cert") && option("tls-key") ? { cert: fs.readFileSync(option("tls-cert")), key: fs.readFileSync(option("tls-key")) } : null;
  // Beyond this computer the server speaks HTTPS, or the operator states that it is only reachable
  // on the private office network / VPN (or sits behind an HTTPS proxy). It will not start as plain
  // HTTP on a public interface by accident.
  if (!tls && !["127.0.0.1", "localhost", "::1"].includes(host) && !rest.includes("--private-network")) {
    console.error("Refusing to serve plain HTTP on a network address. Use --tls-cert / --tls-key for HTTPS, or add --private-network if this server is only reachable on the office network / VPN or sits behind an HTTPS proxy.");
    process.exit(2);
  }
  const server = createJobServer({ store, allowOrigin: option("allow-origin"), tls });
  server.listen(port, host, () => { console.log(JSON.stringify({ listening: server.address().port, storage: store.provider.describe() })); process.send?.({ listening: server.address().port }); });
  const stop = () => server.close(() => { store.close(); process.exit(0); });
  process.on("SIGTERM", stop); process.on("SIGINT", stop); process.on("message", (message) => { if (message === "stop") stop(); });
} else { console.error(`Unknown command "${command}".`); process.exit(2); }
