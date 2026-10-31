// Lets plain Node load modules that import JSON without `with { type: "json" }` (Next bundles allow it).
// Usage: node --import ./scripts/register-json-import.mjs <script>
import { register } from "node:module";

register("data:text/javascript," + encodeURIComponent(`
export async function load(url, context, next) {
  if (url.endsWith(".json")) return next(url, { ...context, importAttributes: { ...context.importAttributes, type: "json" } });
  return next(url, context);
}`));
