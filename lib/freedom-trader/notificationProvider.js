export class NotificationProvider {
  supports() {
    return false;
  }

  async send() {
    return { ok: false, skipped: true, reason: "Notification provider is not implemented." };
  }
}

export const FUTURE_NOTIFICATION_PROVIDERS = ["desktop", "email", "sms", "whatsapp", "push", "discord"];
