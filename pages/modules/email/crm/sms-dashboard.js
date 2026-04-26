// pages/modules/email/crm/sms-dashboard.js 

import React, { useEffect, useMemo, useState } from "react";
import ICONS from "../../../../components/iconMap";
import { supabase } from "../../../../lib/supabaseClient";
import { useRouter } from "next/router";

export default function SMSDashboard() {
  const router = useRouter();

  const today = new Date();
  const last30 = new Date();
  last30.setDate(today.getDate() - 30);

  const [startDate, setStartDate] = useState(last30.toISOString().slice(0,10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0,10));

  const [messages, setMessages] = useState([]);
  const [monthlyLimit, setMonthlyLimit] = useState(500);
  const [loading, setLoading] = useState(true);

  const [sort, setSort] = useState({
    column: "created_at",
    direction: "desc",
  });

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      // 🔥 FIX: proper UTC boundaries to avoid missing rows
      const startISO = new Date(startDate + "T00:00:00Z").toISOString();
      const endISO = new Date(endDate + "T23:59:59Z").toISOString();

      const { data: smsData, error } = await supabase
        .from("sms_sent_history")
        .select("*")
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
      }

      const { data: billing } = await supabase
        .from("billing_subscriptions")
        .select("plan_sms_limit")
        .limit(1)
        .single();

      setMessages(smsData || []);
      setMonthlyLimit(billing?.plan_sms_limit || 500);
      setLoading(false);
    }

    loadData();
  }, [startDate, endDate]);

  const toggleSort = (column) => {
    setSort(prev => ({
      column,
      direction:
        prev.column === column && prev.direction === "asc"
          ? "desc"
          : "asc",
    }));
  };

  const sortedMessages = useMemo(() => {
    const sorted = [...messages];

    sorted.sort((a, b) => {
      const aVal = a[sort.column];
      const bVal = b[sort.column];

      if (!aVal) return 1;
      if (!bVal) return -1;

      return sort.direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    return sorted;
  }, [messages, sort]);

  const stats = useMemo(() => {
    const sent = messages.length;
    const delivered = messages.filter(m => m.status !== "failed").length;
    const failed = messages.filter(m => m.status === "failed").length;

    return {
      sent,
      delivered,
      failed,
      deliveryRate: sent ? ((delivered / sent) * 100).toFixed(1) : 0,
    };
  }, [messages]);

  const usagePercent = monthlyLimit
    ? ((stats.sent / monthlyLimit) * 100).toFixed(1)
    : 0;

  const setRange = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    setStartDate(start.toISOString().slice(0,10));
    setEndDate(end.toISOString().slice(0,10));
  };


        {/* Cards Grid under banner */}
        <div style={{ display: 'flex', gap: 18, marginBottom: 24 }}>
          <div style={{ flex: 1, border: '2px solid #ec4899', color: '#fff', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'transparent', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{ICONS.calendar({ size: 36 })}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#ec4899' }}>Telephone</div>
            <div style={{ fontSize: 15, margin: '10px 0 18px 0', opacity: 0.85, color: '#fff' }}>Review inbound calls, listen to voicemails, and tidy your call log.</div>
            <button style={{ background: '#ec4899', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }} onClick={() => router.push('/modules/email/crm/calls')}>Go to Calls</button>
          </div>
          <div style={{ flex: 1, border: '2px solid #14b8a6', color: '#fff', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'transparent', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{ICONS.sms({ size: 36 })}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#14b8a6' }}>SMS Marketing</div>
            <div style={{ fontSize: 15, margin: '10px 0 18px 0', opacity: 0.85, color: '#fff' }}>Send SMS broadcasts, use templates, and track delivery.</div>
            <button style={{ background: '#14b8a6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }} onClick={() => router.push('/modules/email/crm/sms-marketing')}>Go to SMS</button>
          </div>
        </div>


  const styles = {
    wrap: {
      minHeight: "100vh",
      background: "#0c121a",
      color: "#fff",
      padding: "28px 22px",
      display: "flex",
      justifyContent: "center",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      fontSize: 16,
      fontWeight: 600,
    },

    inner: { width: "100%", maxWidth: 1320 },

    // ⚠️ BANNER LEFT EXACTLY AS-IS (NO COLOUR SET HERE)
    banner: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderRadius: 14,
      padding: "18px 22px",
      marginBottom: 18,
      gap: 14,
    },

    bannerLeft: {
      display: "flex",
      alignItems: "center",
      gap: 14,
    },

    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 12,
      background: "rgba(0,0,0,0.25)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },

    bannerTitle: {
      fontSize: 48,
      fontWeight: 600,
      margin: 0,
      lineHeight: 1.1,
    },

    controls: {
      display: "flex",
      gap: 10,
      marginBottom: 16,
      alignItems: "center",
      flexWrap: "wrap",
    },

    input: {
      background: "#111827",
      color: "#fff",
      border: "1px solid #1f2937",
      padding: "6px 10px",
      borderRadius: 6,
    },

    quickBtn: {
      background: "#1f2937",
      border: "none",
      color: "#fff",
      padding: "6px 10px",
      borderRadius: 6,
      cursor: "pointer",
    },

    statsRow: {
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: 14,
      marginBottom: 18,
    },

    statCard: {
      background: "#111827",
      border: "1px solid #1f2937",
      borderRadius: 12,
      padding: 14,
    },

    statLabel: { fontSize: 13, opacity: 0.7 },
    statValue: { fontSize: 20 },

    usageBar: {
      marginTop: 8,
      height: 6,
      background: "#1f2937",
      borderRadius: 4,
    },

    usageFill: {
      height: "100%",
      background: "#22c55e",
      width: `${usagePercent}%`,
    },

    table: {
      width: "100%",
      background: "#111827",
      borderRadius: 12,
      borderCollapse: "collapse",
      border: "1px solid #1f2937",
    },

    th: {
      padding: "10px",
      borderBottom: "1px solid #1f2937",
      cursor: "pointer",
      fontSize: 13,
    },

    td: {
      padding: "10px",
      borderBottom: "1px solid #1f2937",
      fontSize: 13,
    },
  };

  return (

    <div style={styles.wrap}>
      <div style={styles.inner}>
        {/* Banner */}
        <div style={{ ...styles.banner, background: '#14b8a6' }}>
          <div style={styles.bannerLeft}>
            <div style={styles.iconWrap}>{ICONS.sms({ size: 40 })}</div>
            <div>
              <div style={styles.bannerTitle}>SMS & Telephony Dashboard</div>
              <div style={{ fontSize: 18, marginTop: 6 }}>Track your SMS and call activity, limits, and performance.</div>
            </div>
          </div>
          <button style={{ background: '#0c121a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>← Back</button>
        </div>

        {/* Cards Grid */}
        <div style={{ display: 'flex', gap: 18, marginBottom: 24 }}>
          <div style={{ flex: 1, border: '2px solid #ec4899', color: '#ec4899', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'transparent', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{ICONS.calendar({ size: 36 })}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#ec4899' }}>Desktop Telephone</div>
            <div style={{ fontSize: 15, margin: '10px 0 18px 0', opacity: 0.85, color: '#fff' }}>Review inbound calls, listen to voicemails, and tidy your call log.</div>
            <button style={{ background: 'transparent', color: '#ec4899', border: '2px solid #ec4899', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }} onClick={() => router.push('/modules/email/crm/calls')}>Go to Calls</button>
          </div>
          <div style={{ flex: 1, border: '2px solid #14b8a6', color: '#14b8a6', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'transparent', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{ICONS.sms({ size: 36 })}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#14b8a6' }}>SMS Marketing</div>
            <div style={{ fontSize: 15, margin: '10px 0 18px 0', opacity: 0.85, color: '#fff' }}>Send SMS broadcasts, use templates, and track delivery.</div>
            <button style={{ background: 'transparent', color: '#14b8a6', border: '2px solid #14b8a6', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }} onClick={() => router.push('/modules/email/crm/sms-marketing')}>Go to SMS</button>
          </div>
        </div>

        {/* Controls and stats */}
        <div style={styles.controls}>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={styles.input}
          />
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            style={styles.input}
          />

          <button style={styles.quickBtn} onClick={() => setRange(7)}>7d</button>
          <button style={styles.quickBtn} onClick={() => setRange(30)}>30d</button>
          <button style={styles.quickBtn} onClick={() => setRange(90)}>90d</button>
        </div>

        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Sent</div>
            <div style={styles.statValue}>{stats.sent}</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Delivered</div>
            <div style={styles.statValue}>{stats.delivered}</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Failed</div>
            <div style={styles.statValue}>{stats.failed}</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Delivery Rate</div>
            <div style={styles.statValue}>{stats.deliveryRate}%</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Usage</div>
            <div style={styles.statValue}>
              {stats.sent} / {monthlyLimit}
            </div>
            <div style={styles.usageBar}>
              <div style={styles.usageFill}></div>
            </div>
          </div>
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th} onClick={() => toggleSort("created_at")}>Time</th>
              <th style={styles.th}>Phone</th>
              <th style={styles.th}>Message</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3}>Loading...</td>
              </tr>
            ) : (
              sortedMessages.map(msg => (
                <tr key={msg.id}>
                  <td style={styles.td}>
                    {new Date(msg.created_at).toLocaleString()}
                  </td>
                  <td style={styles.td}>{msg.to_phone}</td>
                  <td style={styles.td}>{msg.body}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

      </div>
    </div>
  );
}