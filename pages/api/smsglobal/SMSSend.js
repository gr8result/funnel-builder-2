// /pages/api/smsglobal/SMSSend.js
// Legacy endpoint kept for backward compatibility.
// Routes requests through the guarded single-send handler.

import handler from "./send-single";

export default function SMSSendLegacyAlias(req, res) {
  return handler(req, res);
}
