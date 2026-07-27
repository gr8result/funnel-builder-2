// Product/manufacturer link validation. Only real, well-formed, public HTTP(S)
// links are ever allowed to be saved — never a guessed or fabricated URL. The
// caller is responsible for leaving the field empty when no real link exists;
// this module only validates what's actually typed in.

export function isValidProductUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return { ok: true, empty: true, url: "" };
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, empty: false, error: "Enter a complete web address, e.g. https://www.example.com/product/model" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { ok: false, empty: false, error: "Only http:// or https:// links are allowed." };
  }
  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    return { ok: false, empty: false, error: "That doesn't look like a valid web address." };
  }
  const warning = parsed.protocol === "http:" ? "This link is not secure (http). Use the supplier's https:// link if one is available." : "";
  return { ok: true, empty: false, url: parsed.toString(), warning };
}
