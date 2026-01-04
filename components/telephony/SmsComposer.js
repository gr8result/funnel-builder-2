// /components/telephony/SmsComposer.js
// ✅ CREATE THIS FILE EXACTLY at: /components/telephony/SmsComposer.js
// (case-sensitive on some systems)

import React, { useEffect, useMemo, useRef, useState } from "react";

const s = (v) => String(v ?? "").trim();
const keyFor = (userId) => `gr8:sms-templates:v1:${s(userId) || "anon"}`;

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export default function SmsComposer({
  userId,
  leadId = null,
  toNumber = "",
  defaultTo = "",
  defaultMessage = "",
  onSent,
  compact = false,
}) {
  const [to, setTo] = useState(s(toNumber || defaultTo));
  const [message, setMessage] = useState(s(defaultMessage));
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [err, setErr] = useState("");

  // voice-to-text
  const [isRecording, setIsRecording] = useState(false);
  const smsRecognitionRef = useRef(null);
  const smsRecordingRef = useRef(false);
  const smsSilenceTimeoutRef = useRef(null);

  useEffect(() => {
    setTo(s(toNumber || defaultTo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toNumber, defaultTo]);

  useEffect(() => {
    const raw = localStorage.getItem(keyFor(userId));
    const list = safeJsonParse(raw, []);
    setTemplates(Array.isArray(list) ? list : []);
  }, [userId]);

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => String(t.id) === String(selectedId)) || null;
  }, [templates, selectedId]);

  function persist(next) {
    setTemplates(next);
    try {
      localStorage.setItem(keyFor(userId), JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function applySelected() {
    if (!selectedTemplate) return;
    setMessage(selectedTemplate.body || "");
    setStatusMsg(`Loaded: ${selectedTemplate.title || "Template"}`);
    setErr("");
  }

  function handleSaveTemplate() {
    const body = s(message);
    if (!body) {
      setErr("Type a message first, then save.");
      return;
    }

    const title = prompt(
      "Template name (e.g. Missed call follow-up):",
      "New template"
    );
    if (!title) return;

    const now = new Date().toISOString();
    const next = [
      {
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        title: s(title).slice(0, 80),
        body,
        created_at: now,
        updated_at: now,
      },
      ...templates,
    ];
    persist(next);
    setSelectedId(next[0].id);
    setStatusMsg("Template saved.");
    setErr("");
  }

  function handleUpdateTemplate() {
    if (!selectedTemplate) {
      setErr("Select a template to update.");
      return;
    }
    const body = s(message);
    if (!body) {
      setErr("Message is empty.");
      return;
    }
    const next = templates.map((t) =>
      String(t.id) === String(selectedTemplate.id)
        ? { ...t, body, updated_at: new Date().toISOString() }
        : t
    );
    persist(next);
    setStatusMsg("Template updated.");
    setErr("");
  }

  function handleDeleteTemplate() {
    if (!selectedTemplate) return;
    if (!confirm(`Delete template "${selectedTemplate.title}"?`)) return;
    const next = templates.filter(
      (t) => String(t.id) !== String(selectedTemplate.id)
    );
    persist(next);
    setSelectedId("");
    setStatusMsg("Template deleted.");
    setErr("");
  }

  async function send() {
    setErr("");
    setStatusMsg("");

    const toVal = s(to);
    const msgVal = s(message);

    if (!toVal) return setErr("Missing phone number.");
    if (!toVal.startsWith("+"))
      return setErr("Phone must be in +61... format.");
    if (!msgVal) return setErr("Message is empty.");

    setBusy(true);
    try {
      const r = await fetch("/api/telephony/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toVal,
          message: msgVal,
          lead_id: leadId,
          user_id: userId,
        }),
      });

      const j = await r.json();
      if (!j?.ok) {
        setErr(j?.error || "SMS failed");
        setBusy(false);
        return;
      }

      setStatusMsg("SMS sent.");
      if (onSent) onSent(j);
    } catch (e) {
      setErr(e?.message || "SMS failed");
    } finally {
      setBusy(false);
    }
  }

  // ---------- Voice to Text (SMS box) ----------
  function clearSmsSilenceTimer() {
    if (smsSilenceTimeoutRef.current) {
      clearTimeout(smsSilenceTimeoutRef.current);
      smsSilenceTimeoutRef.current = null;
    }
  }

  function resetSmsSilenceTimer() {
    clearSmsSilenceTimer();
    if (smsRecordingRef.current) {
      smsSilenceTimeoutRef.current = setTimeout(() => {
        stopSmsRecording();
      }, 15000);
    }
  }

  function initSmsRecognition() {
    if (typeof window === "undefined") return null;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErr("Voice-to-text is not supported in this browser.");
      return null;
    }

    if (!smsRecognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-AU";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) finalText += res[0].transcript + " ";
        }
        finalText = s(finalText);
        if (!finalText) return;

        resetSmsSilenceTimer();

        let text = finalText.replace(/\r?\n/g, " ");
        text = text.replace(/new paragraph/gi, "\n\n");
        text = text.replace(/new line/gi, "\n");
        text = text.replace(/full stop/gi, ".");
        text = text.replace(/\bcomma\b/gi, ",");
        text = text.replace(/\bquestion mark\b/gi, "?");
        text = text.replace(/\bexclamation mark\b/gi, "!");
        text = text.replace(/\bcolon\b/gi, ":");

        setMessage((prevRaw) => {
          const prev = prevRaw || "";
          if (!prev) return text;
          const lastChar = prev.slice(-1);
          const needsSpace = lastChar && ![" ", "\n"].includes(lastChar);
          return prev + (needsSpace ? " " : "") + text;
        });
      };

      recognition.onend = () => {
        clearSmsSilenceTimer();
        if (smsRecordingRef.current) {
          try {
            recognition.start();
            resetSmsSilenceTimer();
          } catch {
            smsRecordingRef.current = false;
            setIsRecording(false);
          }
        } else {
          setIsRecording(false);
        }
      };

      smsRecognitionRef.current = recognition;
    }

    return smsRecognitionRef.current;
  }

  function startSmsRecording() {
    setErr("");
    const recognition = initSmsRecognition();
    if (!recognition) return;

    if (smsRecordingRef.current) return;
    smsRecordingRef.current = true;
    setIsRecording(true);

    try {
      recognition.start();
      resetSmsSilenceTimer();
    } catch {
      smsRecordingRef.current = false;
      setIsRecording(false);
    }
  }

  function stopSmsRecording() {
    const recognition = smsRecognitionRef.current;
    smsRecordingRef.current = false;
    setIsRecording(false);
    clearSmsSilenceTimer();

    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // ignore
    }
  }

  const styles = {
    wrap: {
      marginTop: compact ? 8 : 10,
      borderTop: compact ? "none" : "1px solid rgba(148,163,184,0.25)",
      paddingTop: compact ? 0 : 10,
    },
    row: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
    label: { fontSize: 12, opacity: 0.85, marginBottom: 4 },
    input: {
      width: "100%",
      borderRadius: 10,
      border: "1px solid #334155",
      padding: "8px 10px",
      background: "#020617",
      color: "#fff",
      fontSize: 13,
    },
    textarea: {
      width: "100%",
      borderRadius: 10,
      border: "1px solid #334155",
      padding: "10px 10px",
      background: "#020617",
      color: "#fff",
      fontSize: 13,
      minHeight: 90,
      resize: "vertical",
      lineHeight: 1.4,
    },
    btn: (bg) => ({
      background: bg,
      border: "none",
      borderRadius: 999,
      padding: "7px 12px",
      color: "#fff",
      fontWeight: 700,
      cursor: "pointer",
      fontSize: 12,
      opacity: busy ? 0.65 : 1,
    }),
    smallBtn: (bg) => ({
      background: bg,
      border: "none",
      borderRadius: 10,
      padding: "6px 10px",
      color: "#fff",
      fontWeight: 700,
      cursor: "pointer",
      fontSize: 12,
      opacity: busy ? 0.65 : 1,
    }),
    select: {
      borderRadius: 10,
      border: "1px solid #334155",
      padding: "6px 10px",
      background: "#020617",
      color: "#fff",
      fontSize: 12,
      minWidth: 220,
    },
    hint: { fontSize: 12, opacity: 0.8, marginTop: 6 },
    err: { fontSize: 12, color: "#fecaca", marginTop: 6 },
    ok: { fontSize: 12, color: "#bbf7d0", marginTop: 6 },
  };

  return (
    <div style={styles.wrap}>
      {!compact && (
        <div style={{ ...styles.label, fontWeight: 700 }}>📩 SMS</div>
      )}

      <div style={{ marginBottom: 8 }}>
        <div style={styles.label}>To</div>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="+614..."
          style={styles.input}
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={styles.row}>
          <div style={{ ...styles.label, marginBottom: 0, fontWeight: 700 }}>
            Saved messages
          </div>

          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={styles.select}
          >
            <option value="">— Select a template —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={applySelected}
            style={styles.smallBtn("#0ea5e9")}
            disabled={!selectedTemplate}
          >
            Load
          </button>

          <button
            type="button"
            onClick={handleSaveTemplate}
            style={styles.smallBtn("#22c55e")}
          >
            Save new
          </button>

          <button
            type="button"
            onClick={handleUpdateTemplate}
            style={styles.smallBtn("#f59e0b")}
            disabled={!selectedTemplate}
          >
            Update
          </button>

          <button
            type="button"
            onClick={handleDeleteTemplate}
            style={styles.smallBtn("#ef4444")}
            disabled={!selectedTemplate}
          >
            Delete
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={styles.row}>
          <div style={{ ...styles.label, marginBottom: 0 }}>SMS message</div>

          <button
            type="button"
            onClick={isRecording ? stopSmsRecording : startSmsRecording}
            style={styles.btn(isRecording ? "#b91c1c" : "#3b82f6")}
          >
            {isRecording ? "⏹ Stop voice" : "🎙 Voice to text"}
          </button>

          <button
            type="button"
            onClick={send}
            style={styles.btn("#22c55e")}
            disabled={busy}
          >
            {busy ? "Sending…" : "Send SMS"}
          </button>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your SMS…"
          style={styles.textarea}
        />
      </div>

      {err && <div style={styles.err}>{err}</div>}
      {statusMsg && !err && <div style={styles.ok}>{statusMsg}</div>}

      <div style={styles.hint}>
        Tip: say “full stop”, “comma”, “question mark”.
      </div>
    </div>
  );
}
