// pages/marketplace/affiliate-login.js
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function AffiliateLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('Logging in...');
    // Simple email-based login for affiliate users
    const res = await fetch('/api/affiliate/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (data.ok) {
      router.push('/marketplace');
    } else {
      setStatus(data.error || 'Login failed');
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0b0b0b', color: '#e6edf3' }}>
      <form onSubmit={handleSubmit} style={{ width: 360, padding: 24, border: '1px solid #1f2937', borderRadius: 12, background: '#0f1115' }}>
        <h1 style={{ margin: '0 0 14px', fontSize: 20, fontWeight: 800 }}>Affiliate Login</h1>
        <p style={{ margin: '0 0 10px', opacity: 0.8, fontSize: 13 }}>Enter your affiliate email address.</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #2b2f36', background: '#0b0e12', color: '#e6edf3' }}
        />
        <button
          type="submit"
          style={{ marginTop: 12, width: '100%', padding: 10, borderRadius: 10, border: '1px solid #1e293b', background: '#2563eb', color: 'white', fontWeight: 700 }}
        >
          Log In
        </button>
        <div style={{ marginTop: 8, minHeight: 18, fontSize: 12, color: '#9aa7b2' }}>{status}</div>
      </form>
    </div>
  );
}
