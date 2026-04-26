// /components/UsageWarning.js
// Displays usage stats and warnings for Email/SMS limits

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function UsageWarning() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsageStats();
  }, []);

  async function fetchUsageStats() {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        setLoading(false);
        return;
      }

      const res = await fetch("/api/usage/check-limits", {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (!res.ok) {
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error("Error fetching usage stats:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !stats) return null;

  function chipColor(pct) {
    if (pct >= 100) return { bg: '#450a0a', border: '#ef4444', text: '#fca5a5' };
    if (pct >= 80)  return { bg: '#451a03', border: '#f59e0b', text: '#fcd34d' };
    if (pct >= 50)  return { bg: '#1c1917', border: '#facc15', text: '#fef08a' };
    return           { bg: '#052e16', border: '#22c55e', text: '#86efac' };
  }

  function Chip({ icon, label, pct, limit }) {
    const c = chipColor(pct);
    const display = limit === 'Unlimited' ? '∞' : `${pct}%`;
    return (
      <div title={`${label}: ${pct}% of ${limit}`} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: 8, padding: '5px 10px', whiteSpace: 'nowrap',
      }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>{label}</span>
          <span style={{ fontSize: 14, color: c.text, fontWeight: 700 }}>{display}</span>
        </div>
        {limit !== 'Unlimited' && (
          <div style={{ width: 36, height: 6, background: '#374151', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: c.border, borderRadius: 3 }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Chip icon="📧" label="Email"       pct={stats.email.percentage}       limit={stats.email.limit} />
      <Chip icon="💬" label="SMS"         pct={stats.sms.percentage}         limit={stats.sms.limit} />
      <Chip icon="👥" label="Subscribers" pct={stats.subscribers.percentage} limit={stats.subscribers.limit} />
    </div>
  );
}
