// /lib/crm/writebacks.demo.js
// Optional quick-test helpers (run from DevTools console).
import { onEmailSent, onEmailOpen, onEmailClick } from "./writebacks";

// Replace with a real contactId from localStorage > crm_contacts_v1
export function demo(contactId) {
  if (!contactId) return console.warn("Pass a contactId to demo(contactId)");

  console.log("→ Logging SENT");
  onEmailSent(contactId, { campaignName: "Welcome Series", templateName: "Day 1" });

  console.log("→ Logging OPEN");
  onEmailOpen(contactId, { ip: "203.0.113.42", ua: "Chrome" });

  console.log("→ Logging CLICK");
  onEmailClick(contactId, { url: "https://example.com/offer" });

  console.log("✓ Check the contact timeline in /modules/crm");
}





