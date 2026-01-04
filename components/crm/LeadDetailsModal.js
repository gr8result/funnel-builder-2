// /components/crm/LeadDetailsModal.js
// Reusable Lead Details modal with notes, voice-to-text, tasks + call history + browser dialer
// (SMS composer removed - replaced with single "Send SMS" button to /modules/email/crm/sms-marketing)

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../utils/supabase-client";
import LeadInfoCard from "./LeadInfoCard";
import BrowserDialer from "../telephony/BrowserDialer";
import SendToAutomationPanel from "./SendToAutomationPanel";

export default function LeadDetailsModal({
  isOpen,
  lead,
  stages = [],
  userId,
  fontScale = 1.35,
  onClose,
  onNotesUpdated,
}) {
  const router = useRouter();

  // ---------- EARLY EXIT ----------
  if (!isOpen || !lead) return null;

  // ---------- BASIC HELPERS ----------
  const scaled = (v) => Math.round(v * fontScale);
  const stageColor = stages.find((s) => s.id === lead.stage)?.color || "#3b82f6";

  const panelTint = {
    background: `linear-gradient(135deg, rgba(15,23,42,0.98), ${stageColor}33)`,
  };

  // ---------- STATE ----------
  const [leadNotes, setLeadNotes] = useState(lead.notes || "");
  const [leadTasks, setLeadTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const [newTaskType, setNewTaskType] = useState("phone_call");
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");

  // voice
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const recordingRef = useRef(false);
  const silenceTimeoutRef = useRef(null);

  // calls
  const [callHistory, setCallHistory] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [callsError, setCallsError] = useState("");

  // show/hide dialer
  const [showDialer, setShowDialer] = useState(true);

  // calendar
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  // automation panel toggle (keeps UI clean)
  const [showAutomation, setShowAutomation] = useState(false);

  // draggable + resizable
  const [modalOffset, setModalOffset] = useState({ x: 0, y: 0 });

  const DEFAULT_WIDTH = 1450;
  const DEFAULT_HEIGHT = 820;

  const [modalSize, setModalSize] = useState({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });
  const [isModalDragging, setIsModalDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const modalDragRef = useRef({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const modalResizeRef = useRef({
    startX: 0,
    startY: 0,
    startWidth: DEFAULT_WIDTH,
    startHeight: DEFAULT_HEIGHT,
  });

  // ---------- EFFECTS ----------
  useEffect(() => {
    if (!isOpen || !lead || !userId) return;

    setLeadNotes(lead.notes || "");
    setLeadTasks([]);
    setNewTaskText("");
    setNewTaskDate("");
    setNewTaskTime("");
    setIsCalendarOpen(false);
    setShowDialer(true);
    setShowAutomation(false);

    setCallHistory([]);
    setCallsError("");

    setModalOffset({ x: 0, y: 0 });
    setModalSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });

    loadTasksForLead(lead.id);

    const phone = (lead.phone || "").trim();
    if (phone) loadCallsForLeadPhone(phone);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, lead?.id, lead?.phone, userId]);

  useEffect(() => {
    function handleMouseMove(e) {
      if (isModalDragging) {
        const { startX, startY, originX, originY } = modalDragRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        setModalOffset({ x: originX + dx, y: originY + dy });
      }

      if (isResizing) {
        const { startX, startY, startWidth, startHeight } = modalResizeRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        const newWidth = Math.max(700, startWidth + dx);
        const newHeight = Math.max(420, startHeight + dy);

        setModalSize({ width: newWidth, height: newHeight });
      }
    }

    function handleMouseUp() {
      if (isModalDragging) setIsModalDragging(false);
      if (isResizing) setIsResizing(false);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isModalDragging, isResizing]);

  // Close automation popover if clicking outside it
  useEffect(() => {
    function onDocClick(e) {
      if (!showAutomation) return;
      const el = e.target;
      if (!el) return;
      // close only if clicking outside the automation box + toggle button
      const box = document.getElementById("gr8-automation-popover");
      const btn = document.getElementById("gr8-automation-toggle");
      if (box && box.contains(el)) return;
      if (btn && btn.contains(el)) return;
      setShowAutomation(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showAutomation]);

  // ---------- DB HELPERS ----------
  async function loadTasksForLead(leadId) {
    if (!userId || !leadId) return;
    setTasksLoading(true);

    const { data, error } = await supabase
      .from("crm_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("contact_id", leadId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("loadTasksForLead error:", error);
      setLeadTasks([]);
    } else {
      setLeadTasks(data || []);
    }
    setTasksLoading(false);
  }

  async function loadCallsForLeadPhone(phone) {
    if (!userId || !phone) return;

    const phoneClean = phone.trim();
    setCallsLoading(true);
    setCallsError("");

    const { data, error } = await supabase
      .from("crm_calls")
      .select("*")
      .eq("user_id", userId)
      .or(`from_number.eq.${phoneClean},to_number.eq.${phoneClean}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("loadCallsForLeadPhone error:", error);
      setCallsError("Unable to load call history.");
      setCallHistory([]);
    } else {
      setCallHistory(data || []);
    }

    setCallsLoading(false);
  }

  async function handleSaveLeadNotes() {
    if (!lead) return;
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          notes: leadNotes,
          updated_at: new Date(),
        })
        .eq("id", lead.id);

      if (error) {
        console.error("Save notes error:", error);
        alert("There was an error saving notes.");
        return;
      }

      if (onNotesUpdated) onNotesUpdated(lead.id, leadNotes);

      alert("Notes saved.");
      handleCloseInternal();
    } catch (err) {
      console.error("Save notes error:", err);
      alert("There was an error saving notes.");
    }
  }

  // ---------- VOICE + TIMESTAMP HELPERS ----------
  function addTimestampHeader() {
    const now = new Date();
    const stamp = now.toLocaleString("en-AU", {
      timeZone: "Australia/Brisbane",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    setLeadNotes((prev) => {
      const header = `[${stamp}]`;
      if (!prev || !prev.trim()) return `${header}\n`;
      return `${prev.trim()}\n\n${header}\n`;
    });
  }

  function resetSilenceTimer() {
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (recordingRef.current) {
      silenceTimeoutRef.current = setTimeout(() => stopRecording(), 20000);
    }
  }

  function clearSilenceTimer() {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }

  function initRecognition() {
    if (typeof window === "undefined") return null;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice-to-text is not supported in this browser.");
      return null;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) finalText += res[0].transcript + " ";
        }
        finalText = finalText.trim();
        if (!finalText) return;

        resetSilenceTimer();

        let text = finalText.replace(/\r?\n/g, " ");
        text = text.replace(/new paragraph/gi, "\n\n");
        text = text.replace(/new line/gi, "\n");
        text = text.replace(/full stop/gi, ".");
        text = text.replace(/\bcomma\b/gi, ",");
        text = text.replace(/\bquestion mark\b/gi, "?");
        text = text.replace(/\bexclamation mark\b/gi, "!");
        text = text.replace(/\bcolon\b/gi, ":");
        text = text.replace(/\bnumber\s+(\d+)\b/gi, "#$1");

        setLeadNotes((prevRaw) => {
          const prev = prevRaw || "";
          if (!prev) return text;

          const lastChar = prev.slice(-1);
          const firstChar = text[0];

          const needsSpace =
            ![" ", "\n"].includes(lastChar) && !["\n", ".", ",", "!", "?", ":"].includes(firstChar);

          return prev + (needsSpace ? " " : "") + text;
        });
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event);
      };

      recognition.onend = () => {
        clearSilenceTimer();
        if (recordingRef.current) {
          try {
            recognition.start();
            resetSilenceTimer();
          } catch (e) {
            console.error("Speech restart error:", e);
            recordingRef.current = false;
            setIsRecording(false);
          }
        } else {
          setIsRecording(false);
        }
      };

      recognitionRef.current = recognition;
    }

    return recognitionRef.current;
  }

  function startRecording() {
    const recognition = initRecognition();
    if (!recognition) return;

    if (recordingRef.current) return;
    recordingRef.current = true;
    setIsRecording(true);

    addTimestampHeader();

    try {
      recognition.start();
      resetSilenceTimer();
    } catch (e) {
      console.error("Speech start error:", e);
      recordingRef.current = false;
      setIsRecording(false);
    }
  }

  function stopRecording() {
    const recognition = recognitionRef.current;
    recordingRef.current = false;
    setIsRecording(false);
    clearSilenceTimer();

    if (!recognition) return;
    try {
      recognition.stop();
    } catch (e) {
      console.error("Speech stop error:", e);
    }
  }

  // ---------- TASK HELPERS ----------
  function getTaskTypeLabel(type) {
    switch (type) {
      case "phone_call":
        return "Phone call";
      case "text_message":
        return "Text message";
      case "zoom_call":
        return "Zoom call";
      case "whatsapp":
        return "WhatsApp";
      case "in_person":
        return "Meeting in person";
      case "other":
      default:
        return "Other";
    }
  }

  async function handleAddUpcomingTask() {
    if (!userId || !lead) {
      alert("No lead or user loaded.");
      return;
    }

    const text = newTaskText.trim();
    if (!text) {
      alert("Please add what the task is about.");
      return;
    }

    if (!newTaskDate) {
      alert("Please choose a date from the calendar.");
      return;
    }

    const timeString = newTaskTime || "09:00";
    const whenText = new Date(`${newTaskDate}T${timeString}:00`).toLocaleString("en-AU", {
      timeZone: "Australia/Brisbane",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const name = lead.name || "This contact";
    const typeLabel = getTaskTypeLabel(newTaskType);
    const title = `${name} – ${typeLabel} about: ${text} – ${whenText}`;

    const payload = {
      user_id: userId,
      contact_id: lead.id,
      title,
      notes: null,
      completed: false,
      due_date: newTaskDate,
    };

    const { data, error } = await supabase.from("crm_tasks").insert(payload).select().single();

    if (error) {
      console.error("Add upcoming task error:", error);
      alert("There was an error saving the task / reminder.");
      return;
    }

    setLeadTasks((prev) => [data, ...prev]);
    setNewTaskText("");
    setNewTaskDate("");
    setNewTaskTime("");
    setIsCalendarOpen(false);

    alert("Upcoming task added.");
  }

  // ---------- SIMPLE HELPERS FOR CALL DISPLAY ----------
  function formatCallTime(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("en-AU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatCallDirection(call, phone) {
    const p = (phone || "").trim();
    if (!p) return call.direction || "call";
    if (call.from_number === p) return "Inbound";
    if (call.to_number === p) return "Outbound";
    return call.direction || "call";
  }

  function formatDurationSeconds(value) {
    if (value == null || Number.isNaN(value)) return "-";
    const s = Number(value);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}h ${remM}m`;
    }
    return `${m}m ${rem}s`;
  }

  // ---------- CALENDAR HELPERS ----------
  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();
  const firstOfMonth = new Date(calendarYear, calendarMonthIndex, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();

  const calendarCells = [];
  for (let i = 0; i < startWeekday; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  function toISODate(day) {
    const dt = new Date(calendarYear, calendarMonthIndex, day);
    return dt.toISOString().slice(0, 10);
  }

  function goMonth(offset) {
    setCalendarMonth((prev) => {
      const y = prev.getFullYear();
      const m = prev.getMonth();
      return new Date(y, m + offset, 1);
    });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const calendarLabel = calendarMonth.toLocaleString("en-AU", {
    month: "long",
    year: "numeric",
  });

  // ---------- DRAG / RESIZE HANDLERS ----------
  function handleModalHeaderMouseDown(e) {
    e.preventDefault();
    modalDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: modalOffset.x,
      originY: modalOffset.y,
    };
    setIsModalDragging(true);
  }

  function handleResizeMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    modalResizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: modalSize.width,
      startHeight: modalSize.height,
    };
    setIsResizing(true);
  }

  // ---------- ACTIONS ----------
  function handleCloseInternal() {
    stopRecording();
    setIsCalendarOpen(false);
    setLeadTasks([]);
    setShowAutomation(false);
    if (onClose) onClose();
  }

  function goToSmsPage() {
    const base = "/modules/email/crm/sms-marketing";
    const qs = lead?.id ? `?lead_id=${encodeURIComponent(lead.id)}` : "";
    router.push(base + qs);
  }

  const leadPhone = (lead.phone || "").trim();
  const leadEmail = (lead.email || "").trim();

  // ---------- RENDER ----------
  return (
    <div style={modalStyles.modalOverlay}>
      <div
        style={{
          ...modalStyles.leadModal,
          border: `1px solid ${stageColor}`,
          marginTop: modalOffset.y,
          marginLeft: modalOffset.x,
          width: modalSize.width,
          height: modalSize.height,
          maxWidth: "95vw",
          maxHeight: "90vh",
          fontSize: scaled(16),
        }}
      >
        {/* draggable header */}
        <div
          style={{
            ...modalStyles.leadModalHeader,
            background: stageColor,
          }}
          onMouseDown={handleModalHeaderMouseDown}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h2 style={{ margin: 0, fontSize: scaled(18) }}>
              Lead Details – {lead.name || "Unnamed"}
            </h2>
            <div style={{ fontSize: scaled(12), opacity: 0.92 }}>
              {leadEmail ? `✉ ${leadEmail}` : ""}{" "}
              {leadEmail && leadPhone ? "  •  " : ""}
              {leadPhone ? `📞 ${leadPhone}` : ""}
            </div>
          </div>

          <span style={{ fontSize: scaled(11), opacity: 0.9 }}>drag this bar to move</span>
        </div>

        <div style={modalStyles.leadModalColumns}>
          {/* LEFT – info card + calls + tasks list */}
          <div style={modalStyles.leadModalLeft}>
            <div style={{ ...modalStyles.detailsBox, ...panelTint }}>
              <LeadInfoCard lead={lead} stageColor={stageColor} fontScale={fontScale * 0.8} />
            </div>

            {/* Calls + dialer (keep clean, no SMS composer here) */}
            <div style={{ ...modalStyles.callsSection, ...panelTint }}>
              <div style={modalStyles.callsHeaderRow}>
                <span style={modalStyles.callsTitle}>📞 Calls &amp; Voicemails</span>
                {callsLoading && <span style={modalStyles.callsLoading}>Loading…</span>}
              </div>

              <div style={modalStyles.callsPhoneRow}>
                <span style={modalStyles.callsPhoneText}>{leadPhone || "No phone on file"}</span>
                {!!leadPhone && (
                  <button
                    type="button"
                    onClick={() => setShowDialer((p) => !p)}
                    style={modalStyles.smallToggleBtn}
                    title="Show/Hide dialer"
                  >
                    {showDialer ? "Hide dialer" : "Show dialer"}
                  </button>
                )}
              </div>

              {showDialer && leadPhone && (
                <BrowserDialer toNumber={leadPhone} displayName={lead.name || ""} userId={userId} />
              )}

              {/* simple SMS navigation button (requested) */}
              <div style={modalStyles.smsNavRow}>
                <button type="button" onClick={goToSmsPage} style={modalStyles.smsNavBtn}>
                  Send SMS →
                </button>
                <span style={modalStyles.smsNavHelp}>
                  Opens SMS Marketing page (no clutter here)
                </span>
              </div>

              {callsError && <div style={modalStyles.callsErrorText}>{callsError}</div>}

              {!callsLoading && !callsError && (!callHistory || callHistory.length === 0) && (
                <div style={modalStyles.callsEmptyText}>No calls recorded for this contact yet.</div>
              )}

              {callHistory && callHistory.length > 0 && (
                <div style={modalStyles.callList}>
                  {callHistory.slice(0, 5).map((call) => (
                    <div key={call.id} style={modalStyles.callItem}>
                      <div style={modalStyles.callTopRow}>
                        <span style={modalStyles.callDirection}>
                          {formatCallDirection(call, leadPhone)} • {call.status || "completed"}
                        </span>
                        <span style={modalStyles.callTime}>{formatCallTime(call.created_at)}</span>
                      </div>

                      <div style={modalStyles.callMetaRow}>
                        <span style={modalStyles.callMetaBadge}>
                          Duration:{" "}
                          {formatDurationSeconds(call.recording_duration || call.duration_seconds)}
                        </span>
                        {call.from_number && (
                          <span style={modalStyles.callMetaBadge}>From: {call.from_number}</span>
                        )}
                      </div>

                      {call.recording_url && (
                        <audio
                          controls
                          style={modalStyles.callAudio}
                          src={
                            call.recording_url.endsWith(".mp3") || call.recording_url.endsWith(".wav")
                              ? call.recording_url
                              : `${call.recording_url}.mp3`
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* task list */}
            <div style={{ ...modalStyles.tasksSection, ...panelTint }}>
              <div style={modalStyles.tasksHeaderRow}>
                <span style={{ ...modalStyles.tasksTitle, fontSize: scaled(14) }}>
                  📌 Tasks &amp; reminders
                </span>
                {tasksLoading && (
                  <span style={{ ...modalStyles.tasksLoading, fontSize: scaled(11) }}>Loading…</span>
                )}
              </div>

              <div style={modalStyles.taskList}>
                {leadTasks.length === 0 && !tasksLoading && (
                  <p style={{ ...modalStyles.taskEmptyText, fontSize: scaled(12) }}>No tasks yet.</p>
                )}

                {leadTasks.map((task) => (
                  <div key={task.id} style={modalStyles.taskItem}>
                    <div style={modalStyles.taskItemMain}>
                      <span
                        style={{
                          ...modalStyles.taskStatusDot,
                          backgroundColor: task.completed ? "#22c55e" : "#f97316",
                        }}
                      />
                      <span style={{ ...modalStyles.taskItemTitle, fontSize: scaled(13) }}>
                        {task.title}
                      </span>
                    </div>
                    <div style={modalStyles.taskItemMeta}>
                      {task.due_date && (
                        <span style={{ ...modalStyles.taskMetaChip, fontSize: scaled(11) }}>
                          Due: {new Date(task.due_date).toLocaleDateString("en-AU")}
                        </span>
                      )}
                      {task.completed && (
                        <span style={{ ...modalStyles.taskMetaChip, fontSize: scaled(11) }}>
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT – notes + upcoming task (kept) */}
          <div style={modalStyles.leadModalRight}>
            <div style={{ ...modalStyles.notesBox, ...panelTint }}>
              <label
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: scaled(15) }}>Notes</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={addTimestampHeader}
                    style={{
                      ...modalStyles.recordBtn,
                      background: "#0f172a",
                      fontSize: scaled(12),
                      border: "1px solid rgba(255,255,255,0.35)",
                    }}
                  >
                    + New note
                  </button>

                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    style={{
                      ...modalStyles.recordBtn,
                      background: isRecording ? "#b91c1c" : stageColor,
                      fontSize: scaled(12),
                    }}
                  >
                    {isRecording ? "⏹ Stop Recording" : "🎙 Voice to Text"}
                  </button>
                </div>
              </label>

              <textarea
                rows={10}
                style={{ ...modalStyles.notesTextarea, fontSize: scaled(16) }}
                value={leadNotes}
                onChange={(e) => setLeadNotes(e.target.value)}
                placeholder="Type or use voice-to-text to record call notes..."
              />
            </div>

            <div style={{ ...modalStyles.addTaskSection, ...panelTint }}>
              <h3 style={{ margin: "0 0 8px", fontSize: scaled(15) }}>📌 Add upcoming task</h3>

              <div style={modalStyles.addTaskRowTop}>
                <select
                  value={newTaskType}
                  onChange={(e) => setNewTaskType(e.target.value)}
                  style={{ ...modalStyles.taskTypeSelect, fontSize: scaled(12) }}
                >
                  <option value="phone_call">Phone call</option>
                  <option value="text_message">Text message</option>
                  <option value="zoom_call">Zoom call</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="in_person">Meeting in person</option>
                  <option value="other">Other</option>
                </select>

                <input
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  style={{ ...modalStyles.addTaskTextInput, fontSize: scaled(12) }}
                  placeholder="e.g. Call Grant about new car"
                />
              </div>

              <div style={modalStyles.addTaskRowBottom}>
                <div style={modalStyles.calendarPicker}>
                  <button
                    type="button"
                    onClick={() => setIsCalendarOpen((prev) => !prev)}
                    style={{ ...modalStyles.calendarTrigger, fontSize: scaled(12) }}
                  >
                    {newTaskDate ? new Date(newTaskDate).toLocaleDateString("en-AU") : "Select date"}
                  </button>

                  {isCalendarOpen && (
                    <div style={modalStyles.calendarPopover}>
                      <div style={modalStyles.calendarHeader}>
                        <button
                          type="button"
                          onClick={() => goMonth(-1)}
                          style={modalStyles.calendarNavBtn}
                        >
                          ◀
                        </button>
                        <span style={modalStyles.calendarHeaderLabel}>{calendarLabel}</span>
                        <button
                          type="button"
                          onClick={() => goMonth(1)}
                          style={modalStyles.calendarNavBtn}
                        >
                          ▶
                        </button>
                      </div>

                      <div style={modalStyles.calendarWeekdays}>
                        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                          <span key={d} style={modalStyles.calendarWeekday}>
                            {d}
                          </span>
                        ))}
                      </div>

                      <div style={modalStyles.calendarGrid}>
                        {calendarCells.map((day, idx) => {
                          if (!day) return <span key={idx} style={modalStyles.calendarEmptyCell} />;

                          const iso = toISODate(day);
                          const isToday = iso === todayStr;
                          const isSelected = iso === newTaskDate;

                          return (
                            <button
                              type="button"
                              key={idx}
                              onClick={() => {
                                setNewTaskDate(iso);
                                setIsCalendarOpen(false);
                              }}
                              style={{
                                ...modalStyles.calendarDayBtn,
                                ...(isSelected ? modalStyles.calendarDaySelected : {}),
                                ...(isToday ? modalStyles.calendarDayToday : {}),
                              }}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <input
                  type="time"
                  value={newTaskTime}
                  onChange={(e) => setNewTaskTime(e.target.value)}
                  style={{ ...modalStyles.addTaskTimeInput, fontSize: scaled(12) }}
                />

                <button
                  type="button"
                  onClick={handleAddUpcomingTask}
                  style={{ ...modalStyles.addTaskBtn, fontSize: scaled(12) }}
                >
                  + Save task
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* footer buttons fixed at bottom (clean + roomy) */}
        <div style={modalStyles.footerBar}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              onClick={goToSmsPage}
              style={{ ...modalStyles.footerBtn, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.45)" }}
              disabled={!lead?.id}
              title="Go to SMS Marketing page"
            >
              Send SMS →
            </button>

            <button
              id="gr8-automation-toggle"
              type="button"
              onClick={() => setShowAutomation((p) => !p)}
              style={{ ...modalStyles.footerBtn, background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.45)" }}
              disabled={!lead?.id}
              title="Send this lead into an Automation Flow"
            >
              Send to Automation
            </button>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleCloseInternal}
              style={{ ...modalStyles.backBtn2, fontSize: scaled(12) }}
              disabled={isRecording}
            >
              Close
            </button>
            <button
              onClick={handleSaveLeadNotes}
              style={{ ...modalStyles.saveBtn, fontSize: scaled(12) }}
            >
              Save Notes
            </button>
          </div>
        </div>

        {/* compact automation popover (only when needed) */}
        {showAutomation && (
          <div id="gr8-automation-popover" style={modalStyles.automationPopover}>
            <div style={modalStyles.automationPopoverHeader}>
              <div style={{ fontWeight: 800, fontSize: 12, color: "#e5e7eb" }}>
                Send to Automation
              </div>
              <button
                type="button"
                onClick={() => setShowAutomation(false)}
                style={modalStyles.automationPopoverX}
                title="Close"
              >
                ×
              </button>
            </div>
            <div style={modalStyles.automationPopoverBody}>
              <SendToAutomationPanel
                leadId={lead?.id}
                onSent={() => {
                  setShowAutomation(false);
                }}
              />
            </div>
          </div>
        )}

        {/* resize handle */}
        <div style={modalStyles.resizeHandle} onMouseDown={handleResizeMouseDown} title="Drag to resize" />
      </div>
    </div>
  );
}

// ---------- LOCAL STYLES FOR MODAL ONLY ----------
const modalStyles = {
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },

  leadModal: {
    background: "#020617",
    borderRadius: "14px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.7)",
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
  },

  leadModalHeader: {
    padding: "10px 16px",
    borderTopLeftRadius: "14px",
    borderTopRightRadius: "14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "grab",
  },

  leadModalColumns: {
    display: "grid",
    gridTemplateColumns: "1fr 2fr",
    gap: "22px",
    padding: "18px 20px 12px",
    flex: 1,
    minHeight: 0,
  },

  leadModalLeft: {
    borderRight: "1px solid #1f2937",
    paddingRight: "12px",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    gap: 10,
  },

  leadModalRight: {
    paddingLeft: "4px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    height: "100%",
    minHeight: 0,
  },

  detailsBox: {
    padding: 0,
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.4)",
    marginBottom: 0,
    background: "rgba(15,23,42,0.95)",
  },

  callsSection: {
    padding: "10px 10px 10px",
    borderRadius: 12,
    background: "rgba(15,23,42,0.95)",
    border: "1px dashed #1f2937",
  },

  callsHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  callsTitle: { fontSize: 16, fontWeight: 600, opacity: 0.9 },
  callsLoading: { fontSize: 14, opacity: 0.7 },

  callsPhoneRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  callsPhoneText: { fontSize: 14, opacity: 0.85 },

  smallToggleBtn: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(2,6,23,0.6)",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
    whiteSpace: "nowrap",
  },

  smsNavRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1px solid rgba(148,163,184,0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  smsNavBtn: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(34,197,94,0.45)",
    background: "rgba(34,197,94,0.14)",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    whiteSpace: "nowrap",
  },

  smsNavHelp: { fontSize: 12, color: "#94a3b8" },

  callsErrorText: { fontSize: 14, color: "#fee2e2", marginTop: 4, marginBottom: 4 },
  callsEmptyText: { fontSize: 14, opacity: 0.75, marginTop: 6 },

  callList: {
    marginTop: 10,
    maxHeight: 170,
    overflowY: "auto",
    paddingRight: 4,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  callItem: {
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid #1f2937",
    background: "#020617",
  },

  callTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },

  callDirection: { fontSize: 14, fontWeight: 500 },
  callTime: { fontSize: 13, opacity: 0.8 },

  callMetaRow: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  callMetaBadge: {
    fontSize: 13,
    padding: "2px 6px",
    borderRadius: 999,
    background: "rgba(148,163,184,0.2)",
  },

  callAudio: { width: "100%", marginTop: 2 },

  notesBox: {
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(15,23,42,0.95)",
    border: "1px solid rgba(148,163,184,0.4)",
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
  },

  notesTextarea: {
    width: "100%",
    borderRadius: "10px",
    border: "1px solid #4b5563",
    padding: "10px 12px",
    background: "#020617",
    color: "#fff",
    lineHeight: 1.5,
    flex: 1,
    minHeight: 0,
    height: "100%",
    resize: "none",
    fontFamily:
      'Arial, "Helvetica Neue", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  recordBtn: {
    border: "none",
    borderRadius: 999,
    padding: "6px 14px",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },

  addTaskSection: {
    marginTop: "auto",
    padding: "10px 12px 12px",
    borderRadius: 12,
    background: "rgba(15,23,42,0.95)",
    border: "1px solid rgba(148,163,184,0.4)",
  },

  addTaskRowTop: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.7fr) minmax(0, 1.3fr)",
    gap: 8,
    marginBottom: 8,
  },

  addTaskRowBottom: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr) auto",
    gap: 8,
    marginBottom: 4,
  },

  taskTypeSelect: {
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid #4b5563",
    background: "#020617",
    color: "#fff",
  },

  addTaskTextInput: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #4b5563",
    background: "#020617",
    color: "#fff",
  },

  addTaskTimeInput: {
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid #4b5563",
    background: "#020617",
    color: "#fff",
  },

  addTaskBtn: {
    borderRadius: 8,
    border: "none",
    padding: "6px 10px",
    background: "#22c55e",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  calendarPicker: { position: "relative" },

  calendarTrigger: {
    width: "100%",
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid #4b5563",
    background: "#020617",
    color: "#fff",
    textAlign: "left",
    cursor: "pointer",
  },

  calendarPopover: {
    position: "absolute",
    bottom: "110%",
    left: 0,
    zIndex: 9999,
    background: "#020617",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.6)",
    boxShadow: "0 14px 30px rgba(0,0,0,0.7)",
    padding: 8,
    width: 230,
  },

  calendarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  calendarHeaderLabel: { fontSize: 12, fontWeight: 700 },

  calendarNavBtn: {
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.6)",
    padding: "2px 6px",
    background: "transparent",
    color: "#e5e7eb",
    cursor: "pointer",
    fontSize: 11,
  },

  calendarWeekdays: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 2,
    marginBottom: 2,
  },

  calendarWeekday: { fontSize: 10, textAlign: "center", opacity: 0.7 },

  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 2,
  },

  calendarEmptyCell: { height: 26 },

  calendarDayBtn: {
    height: 26,
    borderRadius: 6,
    border: "1px solid transparent",
    background: "rgba(15,23,42,0.95)",
    color: "#e5e7eb",
    fontSize: 11,
    cursor: "pointer",
  },

  calendarDaySelected: {
    background: "#22c55e",
    borderColor: "#22c55e",
    color: "#fff",
    fontWeight: 900,
  },

  calendarDayToday: {
    boxShadow: "0 0 0 1px #0ea5e9 inset",
  },

  tasksSection: {
    marginTop: 0,
    padding: "10px 10px 8px",
    borderRadius: 12,
    background: "rgba(15,23,42,0.95)",
    border: "1px dashed #1f2937",
  },

  tasksHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },

  tasksTitle: { fontSize: 14, fontWeight: 700, opacity: 0.9 },
  tasksLoading: { fontSize: 12, opacity: 0.7 },

  taskList: {
    marginTop: 4,
    maxHeight: 240,
    overflowY: "auto",
    paddingRight: 4,
  },

  taskEmptyText: { fontSize: 12, opacity: 0.7, margin: 0 },

  taskItem: {
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid #1f2937",
    background: "#020617",
    marginBottom: 6,
  },

  taskItemMain: { display: "flex", alignItems: "center", gap: 6, marginBottom: 4 },
  taskStatusDot: { width: 8, height: 8, borderRadius: "999px" },
  taskItemTitle: { fontSize: 13 },
  taskItemMeta: { display: "flex", flexWrap: "wrap", gap: 6 },

  taskMetaChip: {
    fontSize: 11,
    padding: "2px 6px",
    borderRadius: 999,
    background: "rgba(148,163,184,0.2)",
  },

  footerBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: "10px 16px 12px",
    borderTop: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(2,6,23,0.85)",
  },

  footerBtn: {
    padding: "8px 12px",
    borderRadius: 10,
    background: "transparent",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    whiteSpace: "nowrap",
  },

  backBtn2: {
    background: "rgba(255,255,255,0.18)",
    borderRadius: "10px",
    padding: "8px 14px",
    color: "#fff",
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.16)",
    fontSize: 13,
    fontWeight: 800,
  },

  saveBtn: {
    background: "#3b82f6",
    border: "none",
    borderRadius: "10px",
    padding: "8px 14px",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 13,
  },

  automationPopover: {
    position: "absolute",
    left: 16,
    bottom: 64,
    width: 420,
    maxWidth: "calc(100% - 32px)",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.25)",
    background: "rgba(2,6,23,0.96)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.7)",
    zIndex: 9999,
    overflow: "hidden",
  },

  automationPopoverHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderBottom: "1px solid rgba(148,163,184,0.18)",
  },

  automationPopoverX: {
    background: "transparent",
    border: "none",
    color: "#cbd5e1",
    fontSize: 22,
    cursor: "pointer",
    lineHeight: 1,
  },

  automationPopoverBody: {
    padding: 10,
  },

  resizeHandle: {
    position: "absolute",
    width: "16px",
    height: "16px",
    right: "8px",
    bottom: "8px",
    borderRadius: "4px",
    border: "1px solid #4b5563",
    background: "rgba(15,23,42,0.9)",
    cursor: "se-resize",
  },
};
