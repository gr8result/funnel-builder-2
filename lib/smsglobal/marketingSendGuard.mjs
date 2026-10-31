// Last check before any marketing SMS leaves the platform (used by pages/api/smsglobal/flush-queue.js).
// Fails closed: a recorded or unresolved STOP, a lookup failure, or no working opt-out number all block the send.

export function formatAustralianNumber(e164Digits) {
  const digits = String(e164Digits || "").replace(/\D/g, "");
  if (/^61[45]\d{8}$/.test(digits)) {
    const local = `0${digits.slice(2)}`;
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  return digits ? `+${digits}` : "";
}

// Branded (alphanumeric) sender IDs cannot receive replies, so every marketing SMS names the builder's
// STOP reply number explicitly (Spam Act 2003: each commercial message needs a functional unsubscribe facility).
export function withSmsOptOutFooter(body, optOutNumber) {
  const text = String(body || "").trimEnd();
  const number = formatAustralianNumber(optOutNumber);
  if (!number) throw new Error("A STOP reply number is required for marketing SMS.");
  const footer = `Opt out: reply STOP to ${number}`;
  return text.includes(footer) ? text : `${text}\n${footer}`;
}

export async function assertSmsMarketingAllowed(db, { workspaceId, phone }) {
  if (!workspaceId || !phone) throw new Error("Marketing SMS needs a builder workspace and a recipient phone; SMS was not sent.");
  const { data: blocked, error } = await db.rpc("is_sms_marketing_blocked", { p_workspace_id: workspaceId, p_phone: phone });
  if (error) throw new Error("Opt-out status could not be checked; SMS was not sent.");
  if (blocked !== false) throw new Error("Recipient has a recorded or pending STOP; SMS was not sent.");

  const { data: numbers, error: numberError } = await db
    .from("sms_inbound_numbers")
    .select("phone_e164")
    .eq("workspace_id", workspaceId)
    .eq("provider", "smsglobal")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1);
  if (numberError) throw new Error("Opt-out number could not be loaded; SMS was not sent.");
  if (!numbers?.length) throw new Error("No STOP reply number is configured for this builder, so the SMS would have no working opt-out; SMS was not sent.");
  return { optOutNumber: numbers[0].phone_e164 };
}
