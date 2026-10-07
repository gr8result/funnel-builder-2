import { useState } from 'react';
import { quotationNotifications, isNotificationAcknowledged } from '../../lib/construction-estimation/quotationNotifications.js';

export default function QuotationNotifications({ sheet, styles }) {
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const notifications = quotationNotifications(sheet.preview, sheet.workbook);
  const acknowledged = Object.entries(sheet.workbook.quotationNotificationAcknowledgements || {});
  return <div data-testid="quotation-notifications">
    {notifications.filter((notice) => !isNotificationAcknowledged(sheet.workbook, notice)).map((notice) => <div key={notice.key} data-notification-key={notice.key} style={{ ...(notice.ok ? styles.okPill : styles.warningPill), marginBottom: 8 }}>
      <span>{notice.message}</span>{!sheet.previewMode && <button style={{ ...styles.secondaryButton, marginLeft: 12 }} onClick={() => sheet.acknowledgeNotification(notice)}>Acknowledge</button>}
    </div>)}
    {acknowledged.length > 0 && <button style={styles.secondaryButton} onClick={() => setShowAcknowledged(!showAcknowledged)}>{showAcknowledged ? 'Hide' : 'Show'} acknowledged notifications ({acknowledged.length})</button>}
    {showAcknowledged && acknowledged.map(([key, notice]) => <div key={key} style={styles.okPill}>{notice.message} — Acknowledged {new Date(notice.acknowledgedAt).toLocaleString()}</div>)}
  </div>;
}
