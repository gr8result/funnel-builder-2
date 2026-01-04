// ============================================
// /lib/smsglobal/macAuth.js
// FULL REPLACEMENT — fixes the Authorization header helper name
// ============================================

import crypto from "crypto";

function s(v) {
  return String(v ?? "").trim();
}

// Basic MAC auth builder for SMSGlobal v2.
// Uses env SMSGLOBAL_API_KEY + SMSGLOBAL_API_SECRET
export function macAuthHeaderWarningFree({ method, url }) {
  const key = s(process.env.SMSGLOBAL_API_KEY);
  const secret = s(process.env.SMSGLOBAL_API_SECRET);

  if (!key || !secret) {
    // Return something that will fail clearly (your API will surface raw error)
    return `MAC id="missing", ts="${Date.now()}", nonce="missing", mac="missing"`;
  }

  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(8).toString("hex");

  // MAC base string format (common pattern)
  // ts \n nonce \n method \n request-uri \n host \n port \n \n
  const u = new URL(url);
  const host = u.hostname;
  const port = u.port || (u.protocol === "https:" ? "443" : "80");
  const requestUri = u.pathname + (u.search || "");

  const base = `${ts}\n${nonce}\n${s(method).toUpperCase()}\n${requestUri}\n${host}\n${port}\n\n`;

  const mac = crypto.createHmac("sha256", secret).update(base).digest("base64");

  return `MAC id="${key}", ts="${ts}", nonce="${nonce}", mac="${mac}"`;
}
