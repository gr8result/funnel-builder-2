// /lib/smsglobal/macAuth.js
// Builds SMSGlobal "MAC" Authorization header (equivalent to Postman prescript)

import crypto from "crypto";

export function buildSmsGlobalMacHeader({ apiKey, secretKey, method, url }) {
  if (!apiKey) throw new Error("Missing SMSGLOBAL_API_KEY");
  if (!secretKey) throw new Error("Missing SMSGLOBAL_API_SECRET");

  const ts = Math.floor(Date.now() / 1000);
  const nonce = Math.floor(Math.random() * 10000000);

  const u = new URL(url);

  // Important: path + query exactly
  const pathWithQuery = `${u.pathname}${u.search || ""}`;
  const host = u.hostname;
  const port = u.port ? Number(u.port) : u.protocol === "http:" ? 80 : 443;

  // Matches SMSGlobal prescript layout:
  // ts \n nonce \n method \n path+query \n host \n port \n \n
  const authString = `${ts}\n${nonce}\n${String(method || "POST").toUpperCase()}\n${pathWithQuery}\n${host}\n${port}\n\n`;

  const mac = crypto.createHmac("sha256", secretKey).update(authString).digest("base64");

  const header = `MAC id="${apiKey}", ts="${ts}", nonce="${nonce}", mac="${mac}"`;

  return { header, ts, nonce, mac, authString, host, port, pathWithQuery };
}
