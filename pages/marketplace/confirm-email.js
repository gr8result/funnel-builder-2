// pages/marketplace/confirm-email.js
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function ConfirmEmail() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const token = router.query.token;

  useEffect(() => {
    if (!token) return;
    async function confirm() {
      setStatus('Confirming...');
      const res = await fetch('/api/affiliate/confirm-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.ok) {
        // Automatically approve affiliate application
        await fetch('/api/affiliate/auto-approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        setStatus('✅ Email confirmed! You may now apply for affiliate offers.');
      } else if (data.alreadyConfirmed) {
        setStatus('✅ Email already confirmed.');
      } else {
        setStatus('❌ Failed to confirm email.');
      }
    }
    confirm();
  }, [token]);

  function handleGoMarketplace() {
    router.push('/marketplace');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0b0b0b', color: '#e6edf3' }}>
      <div style={{ width: 420, padding: 32, border: '1px solid #1f2937', borderRadius: 12, background: '#0f1115', textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 18px', fontSize: 24, fontWeight: 800 }}>Confirm Email</h1>
        <div style={{ fontSize: 18, marginBottom: 24 }}>{status}</div>
        <button onClick={handleGoMarketplace} style={{ padding: '12px 24px', borderRadius: 10, background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: 18, border: 'none', cursor: 'pointer' }}>
          Go to Marketplace
        </button>
      </div>
    </div>
  );
}
