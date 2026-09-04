import { withFreedomApi } from "../../../platform-core/api-guards/freedomApiGuard.js";

import {
  loadLocalFreedomNotifications,
  updateLocalFreedomNotificationSettings,
} from "../../../lib/freedom-trader/localPaperStore.js";
import { maskMobile, sendFreedomNotification, sendFreedomTestSMS } from "../../../lib/freedom-trader/notifications.js";

async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const snapshot = await loadLocalFreedomNotifications();
      return res.status(200).json({
        ok: true,
        notifications: snapshot.notifications,
        settings: { ...snapshot.settings, mobileMasked: maskMobile(snapshot.settings?.mobile), mobile: snapshot.settings?.mobile ? maskMobile(snapshot.settings.mobile) : "" },
        smsProvider: "SMSGlobal",
        smsConfigured: Boolean(snapshot.settings?.smsEnabled && snapshot.settings?.mobile && process.env.FREEDOM_SMS_BEARER_TOKEN),
        error: null,
      });
    }
    if (req.method === "PATCH") {
      const settings = await updateLocalFreedomNotificationSettings(req.body || {});
      return res.status(200).json({ ok: true, settings: { ...settings, mobileMasked: maskMobile(settings.mobile), mobile: maskMobile(settings.mobile) }, error: null });
    }
    if (req.method === "POST") {
      const action = req.body?.action || "notify";
      const result = action === "test_sms" ? await sendFreedomTestSMS() : await sendFreedomNotification(req.body || {});
      return res.status(result.ok || result.sms?.blocked ? 200 : 502).json({ ...result, error: result.ok ? null : result.sms?.error || "Notification failed." });
    }
    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  } catch (error) {
    console.error("Freedom notification API failed:", error);
    return res.status(500).json({ ok: false, error: error?.message || "Notification failed." });
  }
}

// M2.1: authentication + freedom entitlement enforced before this handler.
export default withFreedomApi(handler);
