// /components/lists/EditListModal.js
// GR8 RESULT — EMAIL LIST BUILDER (SAFE SAVE VERSION)

import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase-client";

export default function EditListModal({ userId, list, onClose, onSaved }) {
  const isEdit = Boolean(list && list.id);

  // Core fields
  const [name, setName] = useState(list?.name || "");
  const [sourceType, setSourceType] = useState(list?.source_type || "");
  const [tags, setTags] = useState(list?.tags || "");

  // Manual routing options instead of "auto" toggle
  const [routeToCRM, setRouteToCRM] = useState(() => {
    if (list?.action === "CRM" || list?.action === "Both") return true;
    return !!list?.auto_add_crm; // fallback for old data
  });
  const [routeToAutomation, setRouteToAutomation] = useState(() => {
    if (list?.action === "Automation" || list?.action === "Both") return true;
    if (Array.isArray(list?.flows) && list.flows.length > 0) return true;
    return false;
  });

  // Integration / extra fields – UI only
  const [apiKey, setApiKey] = useState(list?.api_key || "");
  const [formUrl, setFormUrl] = useState(list?.form_url || "");

  const [facebookPixel, setFacebookPixel] = useState(
    list?.facebook_pixel || ""
  );
  const [facebookFormId, setFacebookFormId] = useState(
    list?.facebook_form_id || ""
  );
  const [facebookToken, setFacebookToken] = useState(
    list?.facebook_token || ""
  );

  const [instagramToken, setInstagramToken] = useState(
    list?.instagram_token || ""
  );

  const [tiktokPixel, setTiktokPixel] = useState(list?.tiktok_pixel || "");
  const [tiktokToken, setTiktokToken] = useState(list?.tiktok_token || "");

  const [linkedinFormId, setLinkedinFormId] = useState(
    list?.linkedin_form_id || ""
  );
  const [linkedinToken, setLinkedinToken] = useState(
    list?.linkedin_token || ""
  );

  const [youtubeKey, setYoutubeKey] = useState(list?.youtube_key || "");
  const [pinterestTag, setPinterestTag] = useState(list?.pinterest_tag || "");
  const [customCode, setCustomCode] = useState(list?.custom_code || "");

  // Pipelines & Flows (still in state so existing values are preserved,
  // but we no longer show them in this modal)
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipelines, setSelectedPipelines] = useState(
    Array.isArray(list?.pipelines) ? list.pipelines : []
  );

  const [flows, setFlows] = useState([]);
  const [selectedFlows, setSelectedFlows] = useState(
    Array.isArray(list?.flows) ? list.flows : []
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function loadData() {
    if (!userId) return;
    setLoading(true);

    // Pipelines (not shown in UI anymore, but harmless to keep)
    const { data: p, error: pErr } = await supabase
      .from("crm_pipelines")
      .select("*")
      .eq("user_id", userId)
      .order("created_at");

    if (pErr) console.error("Load pipelines error:", pErr);
    setPipelines(p || []);

    // Flows (also hidden from UI)
    const { data: f, error: fErr } = await supabase
      .from("automation_flows")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (fErr) console.error("Load flows error:", fErr);
    setFlows(f || []);

    setLoading(false);
  }

  // -----------------------------------------------------
  // SAVE LIST – **only core fields are written**
  // -----------------------------------------------------
  async function saveList() {
    if (!name.trim()) {
      alert("Please enter a list name.");
      return;
    }
    if (!userId) {
      alert("Missing userId – please log in again.");
      return;
    }

    setSaving(true);

    // Map manual choices to the DB "action" column
    let action = "None";
    if (routeToCRM && routeToAutomation) action = "Both";
    else if (routeToCRM) action = "CRM";
    else if (routeToAutomation) action = "Automation";

    // Only send safe, known columns so Supabase never complains
    const corePayload = {
      user_id: userId,
      name: name.trim(),
      source_type: sourceType || null,
      tags: tags || null,
      pipelines: selectedPipelines || [],
      flows: selectedFlows || [],
      action, // one of: None | CRM | Automation | Both
      auto_add_crm: routeToCRM, // legacy flag
      // updated_at intentionally omitted – column doesn't exist
    };

    let error;

    if (isEdit) {
      const { error: updErr } = await supabase
        .from("lead_lists")
        .update(corePayload)
        .eq("id", list.id);
      error = updErr;
    } else {
      const insertRow = {
        ...corePayload,
        created_at: new Date().toISOString(),
      };
      const { error: insErr } = await supabase
        .from("lead_lists")
        .insert([insertRow]);
      error = insErr;
    }

    setSaving(false);

    if (error) {
      console.error("Save list error:", error);
      alert(`Failed to save list: ${error.message}`);
      return;
    }

    if (onSaved) onSaved();
    if (onClose) onClose();
  }

  // -----------------------------------------------------
  // RENDER
  // -----------------------------------------------------
  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        {/* HEADER STRIP */}
        <div style={s.headerStrip}>
          <div style={s.headerLeft}>
            <span style={s.badge}>
              {isEdit ? "EDIT EMAIL LIST" : "CREATE NEW LIST"}
            </span>
            <h2 style={s.title}>
              {isEdit ? list?.name || "Edit List" : "New Email List"}
            </h2>
          </div>
          <button style={s.close} onClick={onClose}>
            ×
          </button>
        </div>

        {/* INNER BODY CARD */}
        <div style={s.innerCard}>
          {/* NAME */}
          <label style={s.label}>List Name</label>
          <input
            style={s.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Facebook Ads – Ebook"
          />

          {/* SOURCE TYPE */}
          <label style={s.label}>Lead Source Type</label>
          <select
            style={s.input}
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
          >
            <option value="">Select Source</option>
            <option value="facebook">Facebook Form</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="linkedin">LinkedIn</option>
            <option value="youtube">YouTube</option>
            <option value="pinterest">Pinterest</option>
            <option value="website_form">Website Form</option>
            <option value="api">API Integration</option>
            <option value="custom">Custom Source</option>
          </select>

          {/* WEBSITE FORM URL (UI ONLY FOR NOW) */}
          {sourceType === "website_form" && (
            <>
              <label style={s.label}>Website Form URL</label>
              <input
                style={s.input}
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://your-site.com/form-submit"
              />
            </>
          )}

          {/* API KEY (UI ONLY) */}
          {sourceType === "api" && (
            <>
              <label style={s.label}>API Key</label>
              <input
                style={s.input}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste or auto-generate"
              />
            </>
          )}

          {/* FACEBOOK INPUTS (UI ONLY) */}
          {sourceType === "facebook" && (
            <>
              <label style={s.label}>Facebook Pixel ID</label>
              <input
                style={s.input}
                value={facebookPixel}
                onChange={(e) => setFacebookPixel(e.target.value)}
                placeholder="123456789"
              />

              <label style={s.label}>Facebook Lead Form ID</label>
              <input
                style={s.input}
                value={facebookFormId}
                onChange={(e) => setFacebookFormId(e.target.value)}
                placeholder="Lead form id"
              />

              <label style={s.label}>Facebook Access Token</label>
              <input
                style={s.input}
                value={facebookToken}
                onChange={(e) => setFacebookToken(e.target.value)}
                placeholder="Access token here"
              />
            </>
          )}

          {/* INSTAGRAM (UI ONLY) */}
          {sourceType === "instagram" && (
            <>
              <label style={s.label}>Instagram Access Token</label>
              <input
                style={s.input}
                value={instagramToken}
                onChange={(e) => setInstagramToken(e.target.value)}
                placeholder="Paste your Instagram token"
              />
            </>
          )}

          {/* TIKTOK (UI ONLY) */}
          {sourceType === "tiktok" && (
            <>
              <label style={s.label}>TikTok Pixel ID</label>
              <input
                style={s.input}
                value={tiktokPixel}
                onChange={(e) => setTiktokPixel(e.target.value)}
                placeholder="TT-123456789"
              />

              <label style={s.label}>TikTok Access Token</label>
              <input
                style={s.input}
                value={tiktokToken}
                onChange={(e) => setTiktokToken(e.target.value)}
                placeholder="Access token"
              />
            </>
          )}

          {/* LINKEDIN (UI ONLY) */}
          {sourceType === "linkedin" && (
            <>
              <label style={s.label}>LinkedIn Lead Gen Form ID</label>
              <input
                style={s.input}
                value={linkedinFormId}
                onChange={(e) => setLinkedinFormId(e.target.value)}
                placeholder="Form ID"
              />

              <label style={s.label}>LinkedIn API Token</label>
              <input
                style={s.input}
                value={linkedinToken}
                onChange={(e) => setLinkedinToken(e.target.value)}
                placeholder="API token"
              />
            </>
          )}

          {/* YOUTUBE (UI ONLY) */}
          {sourceType === "youtube" && (
            <>
              <label style={s.label}>YouTube API Key</label>
              <input
                style={s.input}
                value={youtubeKey}
                onChange={(e) => setYoutubeKey(e.target.value)}
                placeholder="Google API key"
              />
            </>
          )}

          {/* PINTEREST (UI ONLY) */}
          {sourceType === "pinterest" && (
            <>
              <label style={s.label}>Pinterest Tag ID</label>
              <input
                style={s.input}
                value={pinterestTag}
                onChange={(e) => setPinterestTag(e.target.value)}
                placeholder="123456789"
              />
            </>
          )}

          {/* CUSTOM SOURCE (UI ONLY) */}
          {sourceType === "custom" && (
            <>
              <label style={s.label}>Custom Embed / Code Snippet</label>
              <textarea
                style={s.textarea}
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                placeholder="<script>...</script>"
              />
            </>
          )}

          {/* TAGS */}
          <label style={s.label}>Auto-Assign Tags</label>
          <input
            style={s.input}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="ebook,buyer,vip"
          />

          {/* ROUTING OPTIONS ONLY */}
          <div style={s.box}>
            <div style={s.boxHead}>Routing Options</div>

            <label style={s.checkboxRow}>
              <span>Send new leads into CRM Pipelines</span>
              <input
                type="checkbox"
                checked={routeToCRM}
                onChange={(e) => setRouteToCRM(e.target.checked)}
                style={s.bigCheckbox}
              />
            </label>

            <label style={s.checkboxRow}>
              <span>Send new leads into Automation Flows</span>
              <input
                type="checkbox"
                checked={routeToAutomation}
                onChange={(e) => setRouteToAutomation(e.target.checked)}
                style={s.bigCheckbox}
              />
            </label>
          </div>
        </div>

        {/* FOOTER BUTTONS */}
        <div style={s.footer}>
          <button style={s.cancel} onClick={onClose}>
            Cancel
          </button>
          <button style={s.save} onClick={saveList} disabled={saving}>
            {saving ? "Saving…" : "💾 Save List"}
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------
// STYLES
// -------------------------------------------------
const s = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    zIndex: 5000,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    width: 640,
    maxWidth: "95vw",
    background: "#020617",
    color: "#fff",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.5)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.65)",
    overflow: "hidden",
  },
  headerStrip: {
    padding: "14px 20px",
    background: "linear-gradient(90deg,#6366f1,#ec4899,#f97316)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  badge: {
    display: "inline-block",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "3px 8px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.7)",
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
  },
  close: {
    background: "rgba(15,23,42,0.75)",
    color: "#e5e7eb",
    border: "none",
    width: 30,
    height: 30,
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 20,
    fontWeight: 700,
  },
  innerCard: {
    padding: 18,
    background:
      "radial-gradient(circle at top,#0f172a 0,#020617 55%,#000 100%)",
  },
  label: {
    marginTop: 10,
    marginBottom: 4,
    fontWeight: 600,
    fontSize: 14,
  },
  input: {
    width: "100%",
    height: 46,
    background: "#020617",
    border: "1px solid #1e293b",
    borderRadius: 8,
    padding: "10px 12px",
    color: "#fff",
    marginBottom: 4,
    fontSize: 14,
  },
  textarea: {
    width: "100%",
    minHeight: 120,
    background: "#020617",
    border: "1px solid #1e293b",
    borderRadius: 8,
    padding: "10px 12px",
    color: "#fff",
    marginBottom: 4,
    fontSize: 14,
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "4px 0",
    fontSize: 14,
    cursor: "pointer",
    gap: 12,
  },
  bigCheckbox: {
    width: 22,
    height: 22,
    cursor: "pointer",
  },
  box: {
    marginTop: 14,
    background: "rgba(15,23,42,0.95)",
    border: "1px solid rgba(148,163,184,0.35)",
    borderRadius: 10,
    padding: 12,
  },
  boxHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: 600,
    marginBottom: 6,
    fontSize: 14,
  },
  footer: {
    padding: "12px 18px 14px",
    background: "#020617",
    borderTop: "1px solid rgba(15,23,42,0.9)",
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
  save: {
    background: "#22c55e",
    color: "#0b1120",
    border: "none",
    padding: "8px 18px",
    borderRadius: 999,
    fontWeight: 700,
    cursor: "pointer",
  },
  cancel: {
    background: "#4b5563",
    color: "#f9fafb",
    border: "none",
    padding: "8px 18px",
    borderRadius: 999,
    fontWeight: 600,
    cursor: "pointer",
  },
};
