import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { STORAGE_KINDS, assertStorageKey, toBytes } from "./storageProviders.js";

// A folder: this computer, or a path on the office server / NAS. Node only - kept out of
// storageProviders.js so that file stays importable in the browser. Writes are atomic (temp file, then rename): a reader
// never sees half an object, and a crash mid-write leaves the previous object intact.
export class FileSystemStorageProvider {
  constructor({ root, kind = "local" } = {}) {
    if (!root) throw new Error("A storage folder is required.");
    this.root = root; this.kind = kind;
  }
  async node() { return { fs, path, crypto }; }
  describe() { return { ...STORAGE_KINDS[this.kind], location: this.root }; }
  async file(key) { const { path } = await this.node(); return path.join(this.root, ...assertStorageKey(key).split("/")); }
  async putObject(key, value) {
    const { fs, path, crypto } = await this.node();
    const target = await this.file(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temporary, toBytes(value));
    await fs.rename(temporary, target);
  }
  async getObject(key) {
    const { fs } = await this.node();
    try { return new Uint8Array(await fs.readFile(await this.file(key))); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
  }
  async hasObject(key) { const { fs } = await this.node(); try { await fs.access(await this.file(key)); return true; } catch { return false; } }
  async deleteObject(key) { const { fs } = await this.node(); await fs.rm(await this.file(key), { force: true }); }
  async listObjects(prefix = "") {
    const { fs, path } = await this.node();
    const out = [];
    const walk = async (directory, base) => {
      let entries = [];
      try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch (error) { if (error.code === "ENOENT") return; throw error; }
      for (const entry of entries) {
        const key = base ? `${base}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(path.join(directory, entry.name), key);
        else if (!entry.name.endsWith(".tmp") && key.startsWith(prefix)) out.push(key);
      }
    };
    await walk(this.root, "");
    return out.sort();
  }
}
