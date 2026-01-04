// /pages/api/telephony/_twilio.js
// Minimal helpers for Twilio webhook parsing.
// (We keep this tiny so builds don't require twilio SDK.)

export function s(v) {
  const x = String(v ?? "").trim();
  return x.length ? x : "";
}
