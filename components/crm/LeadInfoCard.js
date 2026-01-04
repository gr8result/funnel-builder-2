// /components/crm/LeadInfoCard.js
// Lead summary card (left panel of Lead Details modal)
// Editable contact fields, same layout.

import React, { useState, useEffect } from "react";
import { supabase } from "../../utils/supabase-client";

export default function LeadInfoCard({
  lead,
  stageColor = "#3b82f6",
  fontScale = 1,
  onLeadUpdated, // optional callback(newLead)
}) {
  if (!lead) return null;

  const scaled = (v) => Math.round(v * fontScale);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    source: "",
  });

  useEffect(() => {
    if (!lead) return;
    setForm({
      name: lead.name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      source: lead.source || "",
    });
  }, [lead]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCancel = () => {
    setForm({
      name: lead.name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      source: lead.source || "",
    });
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!lead?.id) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        source: form.source.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("leads")
        .update(payload)
        .eq("id", lead.id)
        .select()
        .single();

      if (error) {
        console.error("Update lead error:", error);
        alert("There was an error saving the contact.");
      } else {
        // let parent update its own state if it wants
        if (onLeadUpdated) {
          onLeadUpdated(data);
        } else {
          // fallback: hard refresh so the board reloads the latest data
          setTimeout(() => {
            window.location.reload();
          }, 300);
        }

        setIsEditing(false);
        alert("Contact saved.");
      }
    } catch (err) {
      console.error("Update lead exception:", err);
      alert("There was an error saving the contact.");
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = {
    fontSize: scaled(16),
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    opacity: 0.7,
    marginBottom: 2,
  };

  const valueStyle = {
    fontSize: scaled(16),
    fontWeight: 600,
    wordBreak: "break-word",
  };

  const inputStyle = {
    width: "100%",
    borderRadius: 8,
    border: "1px solid #4b5563",
    background: "#020617",
    color: "#e5e7eb",
    fontSize: scaled(16),
    padding: "6px 8px",
  };

  const readOnlyBoxStyle = {
    padding: "6px 0",
  };

  const headerBg = `linear-gradient(120deg, ${stageColor}, #0f172a)`;

  const signedUpRaw = lead.signed_up_at || lead.created_at;
  const signedUpLabel =
    signedUpRaw &&
    new Date(signedUpRaw).toLocaleString("en-AU", {
      timeZone: "Australia/Brisbane",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        color: "#e5e7eb",
        fontFamily:
          'Arial, "Helvetica Neue", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          background: headerBg,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "999px",
              background: "rgba(15,23,42,0.9)",
              border: "2px solid rgba(248,250,252,0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: scaled(16),
              textTransform: "uppercase",
            }}
          >
            {(lead.name || "?").slice(0, 2)}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: scaled(16),
                fontWeight: 700,
              }}
            >
              {form.name || "Unnamed contact"}
            </span>
            {form.email && (
              <span
                style={{
                  fontSize: scaled(16),
                  opacity: 0.85,
                }}
              >
                {form.email}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(148,163,184,0.6)",
                  background: "transparent",
                  color: "#e5e7eb",
                  fontSize: scaled(16),
                  cursor: "pointer",
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                style={{
                  padding: "4px 12px",
                  borderRadius: 999,
                  border: "none",
                  background: "#22c55e",
                  color: "#020617",
                  fontWeight: 700,
                  fontSize: scaled(16),
                  cursor: "pointer",
                }}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: "1px solid rgba(248,250,252,0.8)",
                background: "rgba(15,23,42,0.35)",
                color: "#f9fafb",
                fontSize: scaled(16),
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Edit contact
            </button>
          )}
        </div>
      </div>

      {/* BODY – SAME LAYOUT, FIELDS SWITCH INPUT/READ-ONLY */}
      <div
        style={{
          padding: "10px 12px 12px",
          gap: 10,
          display: "grid",
        }}
      >
        {/* Name */}
        <div>
          <div style={labelStyle}>Name</div>
          {isEditing ? (
            <input
              style={inputStyle}
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
            />
          ) : (
            <div style={readOnlyBoxStyle}>
              <div style={valueStyle}>{form.name || "—"}</div>
            </div>
          )}
        </div>

        {/* Email */}
        <div>
          <div style={labelStyle}>Email</div>
          {isEditing ? (
            <input
              style={inputStyle}
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
          ) : (
            <div style={readOnlyBoxStyle}>
              <div style={valueStyle}>{form.email || "—"}</div>
            </div>
          )}
        </div>

        {/* Phone */}
        <div>
          <div style={labelStyle}>Phone</div>
          {isEditing ? (
            <input
              style={inputStyle}
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
            />
          ) : (
            <div style={readOnlyBoxStyle}>
              <div style={valueStyle}>{form.phone || "—"}</div>
            </div>
          )}
        </div>

        {/* Source */}
        <div>
          <div style={labelStyle}>Source</div>
          {isEditing ? (
            <input
              style={inputStyle}
              value={form.source}
              onChange={(e) => handleChange("source", e.target.value)}
            />
          ) : (
            <div style={readOnlyBoxStyle}>
              <div style={valueStyle}>{form.source || "—"}</div>
            </div>
          )}
        </div>

        {/* Signed up – read only */}
        <div>
          <div style={labelStyle}>Signed up</div>
          <div style={readOnlyBoxStyle}>
            <div style={valueStyle}>{signedUpLabel || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
