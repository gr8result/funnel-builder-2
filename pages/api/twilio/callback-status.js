// /pages/api/twilio/callback-status.js
// FULL REPLACEMENT
//
// ✅ Compatibility wrapper: forwards to /api/twilio/status-callback
// ✅ Keeps old URL working without duplicate/conflicting logic

import handler from "./status-callback";

export default handler;
