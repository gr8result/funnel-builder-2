// Dependency-free helpers shared by the editor controls. Kept separate from pbEditorUtils so
// modules that only need these (e.g. the text editing toolbar used by Estimate Builder) do not
// pull in the website renderer, project store and icon libraries that pbEditorUtils imports.

function formatLabel(key) {
  const text = String(key || "")
    .replace(/([A-Z])/g, " $1")
    .trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function parsePixelValue(value, fallback) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d+)(px)?$/i);
  if (match) return Number(match[1]);
  return fallback;
}

export { formatLabel, parsePixelValue };
