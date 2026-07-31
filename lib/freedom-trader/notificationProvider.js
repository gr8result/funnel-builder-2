export class NotificationProvider {
  supports() {
    return false;
  }

  async send() {
    return { ok: false, skipped: true, reason: "Notification provider is not implemented." };
  }
}

export class DesktopNotificationProvider extends NotificationProvider {
  supports() {
    return typeof window !== "undefined" && "Notification" in window;
  }

  permission() {
    if (!this.supports()) return "unsupported";
    return window.Notification.permission;
  }

  async requestPermission() {
    if (!this.supports()) return "unsupported";
    if (window.Notification.permission !== "default") return window.Notification.permission;
    return window.Notification.requestPermission();
  }

  async send(alert) {
    if (!this.supports()) return { ok: false, skipped: true, reason: "Desktop notifications are not supported." };
    const permission = await this.requestPermission();
    if (permission !== "granted") return { ok: false, skipped: true, reason: "Desktop notifications disabled." };
    const notification = new window.Notification(alert.notificationTitle || "ACTION REQUIRED", {
      body: alert.notificationBody || alert.message || "Review Freedom Trader.",
      tag: alert.id,
      requireInteraction: true,
    });
    notification.onclick = () => {
      window.focus();
      if (alert.companyUrl) window.location.href = alert.companyUrl;
    };
    return { ok: true };
  }
}

export const FUTURE_NOTIFICATION_PROVIDERS = ["desktop", "email", "sms", "whatsapp", "push", "discord"];
