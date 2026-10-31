const affirmativeValues = new Set(["1", "true", "yes", "y", "subscribed", "opted in", "confirmed"]);

export function parseMarketingConsent(value) {
  if (value === true) return true;
  if (value === false || value == null) return false;
  return affirmativeValues.has(String(value).trim().toLowerCase().replace(/[_-]+/g, " "));
}

export function hasEmailMarketingConsent(contact = {}) {
  return contact.email_marketing_consent === true && contact.email_marketing_opt_out !== true;
}

export function hasSmsMarketingConsent(contact = {}) {
  return contact.sms_marketing_consent === true
    && contact.sms_marketing_opt_out !== true
    && contact.sms_opt_out !== true
    && contact.opted_out !== true;
}