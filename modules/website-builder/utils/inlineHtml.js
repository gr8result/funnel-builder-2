export function cleanInlineEditorHtml(value) {
  let result = String(value || "")
    .replace(/\u200b/g, "")
    .replace(/<span\b([^>]*)>\s*<\/span>/gi, "");
  // NOTE: Do NOT unwrap outer <span style="..."> wrappers here. Those wrappers
  // are intentionally created by the text toolbar when a user formats all text.
  result = result.replace(/ data-[a-z][a-z0-9-]*="[^"]*"/gi, "");
  result = result.replace(/ data-[a-z][a-z0-9-]*='[^']*'/gi, "");
  return result
    .replace(/<h([1-6])\b([^>]*)>\s*(?:<br\s*\/?\s*>|&nbsp;|\s)*<\/h\1>/gi, "")
    .replace(/<p\b([^>]*)>\s*(?:<span\b[^>]*>\s*)?(?:<br\s*\/?\s*>|&nbsp;|\s)*(?:<\/span>\s*)?<\/p>/gi, "");
}
