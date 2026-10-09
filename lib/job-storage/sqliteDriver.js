// The coordination database driver. better-sqlite3 is the supported driver: a stable, widely
// deployed SQLite binding with prebuilt binaries, so a small builder installs nothing separately.
// Node's own built-in SQLite (still experimental in Node 22) is used only where that package is
// not installed. Both expose the same exec / prepare().run|get|all calls the job store uses.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

export function openDatabase(file = ":memory:") {
  try {
    const Database = require("better-sqlite3");
    const database = new Database(file);
    return Object.assign(database, { driver: "better-sqlite3" });
  } catch (error) {
    if (error?.code !== "MODULE_NOT_FOUND") throw error;
    const { DatabaseSync } = require("node:sqlite");
    return Object.assign(new DatabaseSync(file), { driver: "node:sqlite" });
  }
}
