export default function DataDeletionInstructions() {
  return (
    <div style={{ maxWidth: 800, margin: '60px auto', padding: '0 24px', fontFamily: 'system-ui, sans-serif', color: '#1e293b', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Data Deletion Instructions</h1>
      <p style={{ color: '#64748b', marginBottom: 32 }}>Last updated: April 9, 2026</p>

      <p>If you have connected your Facebook or Instagram account to our platform and would like to delete your data, follow these steps:</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>Option 1 — Remove via Facebook</h2>
      <ol style={{ paddingLeft: 20 }}>
        <li>Go to your <a href="https://www.facebook.com/settings?tab=applications" style={{ color: '#2563eb' }}>Facebook App Settings</a></li>
        <li>Find our application in the list</li>
        <li>Click <strong>Remove</strong></li>
      </ol>
      <p>This immediately revokes our access to your Facebook and Instagram data.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>Option 2 — Contact Us Directly</h2>
      <p>Email us at <a href="mailto:support@gr8result.com" style={{ color: '#2563eb' }}>support@gr8result.com</a> with the subject line <strong>"Data Deletion Request"</strong> and we will delete all your data within 30 days and send you a confirmation.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>What Gets Deleted</h2>
      <ul style={{ paddingLeft: 20 }}>
        <li>Your Facebook and Instagram access tokens</li>
        <li>Connected page and account data</li>
        <li>Any automation rules or conversation logs associated with your account</li>
      </ul>
    </div>
  );
}
