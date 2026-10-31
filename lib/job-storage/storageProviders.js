// Storage providers: WHERE a builder's job documents physically live. GR8 Result never has to host
// them. One interface, so the rest of the system does not care which is in use:
//
//   local           a folder on this computer            single user
//   office-server   a folder on the office server / NAS  shared office (through the job server)
//   builder-cloud   the builder's own cloud storage      remote collaboration (through the job server)
//
// A provider only stores and returns named objects. It is NOT a database and makes no promise
// about two writers: an ordinary shared folder is not concurrency-safe. Everything that needs an
// order - which revision is the head, who saved first - is decided by the job store's database
// (jobStore.js), and in a multi-user installation only the job server writes through a provider.
//
//   putObject(key, text|Uint8Array)   getObject(key) -> Uint8Array | null   hasObject(key)
//   deleteObject(key)                 listObjects(prefix) -> [key]          describe()

export const STORAGE_KINDS = Object.freeze({
  local: { key: "local", label: "This computer", shared: false, description: "Local only - single user. Not visible to anyone else." },
  "office-server": { key: "office-server", label: "Office server / NAS", shared: true, description: "Shared - multi-user, on the builder's own office server." },
  "builder-cloud": { key: "builder-cloud", label: "Builder cloud storage", shared: true, description: "Shared - multi-user, in the builder's own cloud storage." },
});

const encoder = new TextEncoder();
export const toBytes = (value) => (typeof value === "string" ? encoder.encode(value) : value instanceof Uint8Array ? value : new Uint8Array(value));
export const bytesToText = (bytes) => new TextDecoder().decode(bytes);

// Object keys are forward-slash paths of safe segments. Nothing a caller supplies can leave the root.
export function assertStorageKey(key) {
  const text = String(key || "");
  if (!text || text.length > 512 || !/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/.test(text) || text.split("/").some((part) => part === "." || part === "..")) throw new Error(`Invalid storage key: ${JSON.stringify(text)}`);
  return text;
}

export class MemoryStorageProvider {
  constructor({ kind = "local" } = {}) { this.kind = kind; this.objects = new Map(); }
  describe() { return { ...STORAGE_KINDS[this.kind], location: "memory" }; }
  async putObject(key, value) { this.objects.set(assertStorageKey(key), toBytes(value).slice()); }
  async getObject(key) { const found = this.objects.get(assertStorageKey(key)); return found ? found.slice() : null; }
  async hasObject(key) { return this.objects.has(assertStorageKey(key)); }
  async deleteObject(key) { this.objects.delete(assertStorageKey(key)); }
  async listObjects(prefix = "") { return [...this.objects.keys()].filter((key) => key.startsWith(prefix)).sort(); }
}
