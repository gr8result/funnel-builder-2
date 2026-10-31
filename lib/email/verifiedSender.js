const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

export function resolveVerifiedSender(account = {}, fallbackEmail = "") {
  const domain = String(account.dkim_domain || "").trim().toLowerCase().replace(/\.$/, "");
  const email = String(account.sendgrid_from_email || fallbackEmail || "").trim().toLowerCase();
  const senderDomain = email.split("@").pop() || "";

  if (account.dkim_verified !== true || !domain) {
    return { ok: false, error: "Verify this builder's sending domain before sending email." };
  }
  if (!isEmail(email) || !(senderDomain === domain || senderDomain.endsWith(`.${domain}`))) {
    return { ok: false, error: "Configure a valid sender address on the verified sending domain." };
  }
  return { ok: true, email, domain };
}