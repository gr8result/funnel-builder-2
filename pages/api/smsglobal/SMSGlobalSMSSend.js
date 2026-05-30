// /pages/api/smsglobal/SMSGlobalSMSSend.js
// FULL REPLACEMENT
// âœ… Alias route to keep older frontend calls working.
// âœ… Forwards to /api/smsglobal/SMSSend

import handler from "./SMSSend";
import { withAuth } from "../../../lib/withWorkspace";

export default function SMSGlobalSMSSendAlias(req, res) {
  return handler(req, res);
}

