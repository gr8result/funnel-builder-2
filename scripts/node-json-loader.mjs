// Node ESM loader: allow `import x from "./file.json"` without an explicit
// import attribute, matching how Next/webpack resolves JSON in app code.
// Used only by Node test harnesses; production bundling is unaffected.
export async function resolve(specifier, context, defaultResolve) {
  const result = await defaultResolve(specifier, context, defaultResolve);
  if (result?.url?.endsWith(".json")) {
    return { ...result, importAttributes: { type: "json" }, format: "json" };
  }
  return result;
}
