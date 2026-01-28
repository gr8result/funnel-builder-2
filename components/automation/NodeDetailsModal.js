// Component to show detailed node information including email queue status
import { useState, useEffect } from 'react';
import styles from './NodeDetailsModal.module.css';

export default function NodeDetailsModal({ flowId, nodeId, nodeName, onClose }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    if (flowId && nodeId) {
      fetchDetails();
    }
  }, [flowId, nodeId]);

  async function fetchDetails() {
    try {
      const res = await fetch(
        `/api/automation/nodes/${nodeId}/details?flow_id=${flowId}`
      );
      const data = await res.json();
      setDetails(data);
    } catch (err) {
      console.error('Failed to load node details:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveLead(leadId, leadEmail) {
    if (!confirm(`Remove ${leadEmail} from this automation?`)) return;
    
    setRemoving(leadId);
    try {
      const res = await fetch(`/api/automation/nodes/${nodeId}/remove-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow_id: flowId,
          lead_id: leadId,
          reason: 'Manually removed via node details',
        }),
      });

      if (res.ok) {
        await fetchDetails(); // Refresh
      } else {
        alert('Failed to remove lead');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setRemoving(null);
    }
  }

  if (loading) return <div className={styles.modal}>Loading...</div>;
  if (!details) return null;

  const { stats, current_leads, queued_emails, sent_emails } = details;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{nodeName || 'Node Details'}</h2>
          <button onClick={onClose} className={styles.closeBtn}>×</button>
        </div>

        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.current_leads}</div>
            <div className={styles.statLabel}>Current Leads</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.queued}</div>
            <div className={styles.statLabel}>Queued Emails</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.sent}</div>
            <div className={styles.statLabel}>Sent</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.failed}</div>
            <div className={styles.statLabel}>Failed</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.unsubscribed}</div>
            <div className={styles.statLabel}>Unsubscribed</div>
          </div>
        </div>

        <div className={styles.section}>
          <h3>Current Leads at This Node</h3>
          {current_leads.length === 0 ? (
            <p className={styles.empty}>No leads currently at this node</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Available At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {current_leads.map((run) => (
                  <tr key={run.id} className={run.leads?.unsubscribed ? styles.unsubscribed : ''}>
                    <td>{run.leads?.name || 'Unknown'}</td>
                    <td>{run.leads?.email || 'N/A'}</td>
                    <td>
                      {run.leads?.unsubscribed ? (
                        <span className={styles.badge} style={{ background: '#ef4444' }}>
                          Unsubscribed
                        </span>
                      ) : (
                        <span className={styles.badge} style={{ background: '#10b981' }}>
                          {run.status}
                        </span>
                      )}
                    </td>
                    <td>{new Date(run.available_at).toLocaleString()}</td>
                    <td>
                      <button
                        onClick={() => handleRemoveLead(run.lead_id, run.leads?.email)}
                        disabled={removing === run.lead_id}
                        className={styles.removeBtn}
                      >
                        {removing === run.lead_id ? 'Removing...' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={styles.section}>
          <h3>Email Queue Status</h3>
          {queued_emails.length === 0 ? (
            <p className={styles.empty}>No emails in queue for this node</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>To</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Sent</th>
                  <th>Opens</th>
                  <th>Clicks</th>
                </tr>
              </thead>
              <tbody>
                {queued_emails.map((email) => (
                  <tr key={email.id}>
                    <td>{email.to_email}</td>
                    <td>{email.subject}</td>
                    <td>
                      <span
                        className={styles.badge}
                        style={{
                          background:
                            email.status === 'sent'
                              ? '#10b981'
                              : email.status === 'pending'
                              ? '#f59e0b'
                              : '#ef4444',
                        }}
                      >
                        {email.status}
                      </span>
                    </td>
                    <td>{new Date(email.created_at).toLocaleString()}</td>
                    <td>{email.sent_at ? new Date(email.sent_at).toLocaleString() : '-'}</td>
                    <td>{email.open_count || 0}</td>
                    <td>{email.click_count || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {stats.failed > 0 && (
          <div className={styles.section}>
            <h3 style={{ color: '#ef4444' }}>Failed Emails</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>To</th>
                  <th>Error</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {queued_emails
                  .filter((e) => e.status === 'failed')
                  .map((email) => (
                    <tr key={email.id}>
                      <td>{email.to_email}</td>
                      <td>{email.last_error || 'Unknown error'}</td>
                      <td>{new Date(email.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
