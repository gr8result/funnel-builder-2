export function validateAustralianBrandedSenderId(value) {
  const senderId = String(value || "");
  if (senderId.length < 2 || senderId.length > 11) return { ok: false, error: "Branded sender IDs must be 2 to 11 characters." };
  if (!/^[\x20-\x7E]+$/.test(senderId)) return { ok: false, error: "Branded sender IDs may contain printable ASCII characters only." };
  if (/^[\s_]|[\s_]$/.test(senderId)) return { ok: false, error: "Branded sender IDs cannot start or end with a space or underscore." };
  if (/^\d+$/.test(senderId)) return { ok: false, error: "Branded sender IDs cannot contain only numbers." };
  if (/unverified/i.test(senderId)) return { ok: false, error: "Branded sender IDs cannot contain 'Unverified'." };
  return { ok: true, senderId };
}