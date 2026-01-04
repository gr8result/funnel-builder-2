// /pages/modules/email/campaigns/new.js
// FULL REPLACEMENT — Fix mojibake icons (Back arrow / DKIM / Test) by using safe UTF-8 characters
// ✅ Replaces all broken “â€” â† âœ… âš  ðŸ§ª …” with real symbols
// ✅ No Waite & Sea hardcoding
// ✅ Keeps your layout/styles/logic intact

import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { supabase } from "../../../../utils/supabase-client";

// Convert DB minutes -> { amount, unit } for UI
function fromMinutes(value, required = false) {
  if (value === null || value === undefined) {
    return required ? { amount: 0, unit: "minutes" } : { amount: "", unit: "minutes" };
  }

  const m = Number(value);
  if (isNaN(m) || m < 0) {
    return required ? { amount: 0, unit: "minutes" } : { amount: "", unit: "minutes" };
  }

  if (!required && m === 0) return { amount: "", unit: "minutes" };

  const WEEK = 7 * 24 * 60;
  const DAY = 24 * 60;
  const HOUR = 60;

  if (m % WEEK === 0 && m !== 0) return { amount: m / WEEK, unit: "weeks" };
  if (m % DAY === 0 && m !== 0) return { amount: m / DAY, unit: "days" };
  if (m % HOUR === 0 && m !== 0) return { amount: m / HOUR, unit: "hours" };

  return { amount: m, unit: "minutes" };
}

// Convert UI (amount + unit) -> integer minutes for DB
function toMinutes(amount, unit, required = false) {
  if (amount === "" || amount === null || amount === undefined) return required ? 0 : null;

  const n = Number(amount);
  if (isNaN(n) || n < 0) return required ? 0 : null;

  let minutes;
  switch (unit) {
    case "weeks":
      minutes = n * 7 * 24 * 60;
      break;
    case "days":
      minutes = n * 24 * 60;
      break;
    case "hours":
      minutes = n * 60;
      break;
    default:
      minutes = n;
  }

  return Math.round(minutes);
}

export default function Newcampaigns() {
  const router = useRouter();
  const { id: campaignsId } = router.query;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // DKIM
  const [dkimVerified, setDkimVerified] = useState(null);
  const [dkimDomain, setDkimDomain] = useState("");

  // user
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState("");

  // UI-only fields (but we DO save most of them now)
  const [name, setName] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyEmail, setReplyEmail] = useState("");

  // lists + saved emails
  const [lists, setLists] = useState([]);
  const [listId, setListId] = useState("");
  const [sendToAll, setSendToAll] = useState(false);
  const [savedEmails, setSavedEmails] = useState([]);

  // extra emails (stored on campaigns as extra_recipients)
  const [extraEmails, setExtraEmails] = useState("");
  const [csvEmails, setCsvEmails] = useState([]);
  const [csvSummary, setCsvSummary] = useState("");

  // email 1
  const [email1Subject, setEmail1Subject] = useState("");
  const [email1Preheader, setEmail1Preheader] = useState("");
  const [email1TemplateId, setEmail1TemplateId] = useState("");
  const [email1DelayAmount, setEmail1DelayAmount] = useState(0);
  const [email1DelayUnit, setEmail1DelayUnit] = useState("hours");

  // email 2
  const [email2Subject, setEmail2Subject] = useState("");
  const [email2Preheader, setEmail2Preheader] = useState("");
  const [email2TemplateId, setEmail2TemplateId] = useState("");
  const [email2DelayAmount, setEmail2DelayAmount] = useState("");
  const [email2DelayUnit, setEmail2DelayUnit] = useState("hours");

  // email 3
  const [email3Subject, setEmail3Subject] = useState("");
  const [email3Preheader, setEmail3Preheader] = useState("");
  const [email3TemplateId, setEmail3TemplateId] = useState("");
  const [email3DelayAmount, setEmail3DelayAmount] = useState("");
  const [email3DelayUnit, setEmail3DelayUnit] = useState("hours");

  // test send state
  const [showTestModal, setShowTestModal] = useState(false);
  const [testChoice, setTestChoice] = useState("email1");
  const [testRecipients, setTestRecipients] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState("");

  // DKIM banner
  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setDkimVerified(null);
          return;
        }

        const { data, error } = await supabase
          .from("accounts")
          .select("dkim_verified, dkim_domain")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error || !data) {
          setDkimVerified(false);
          setDkimDomain("");
        } else {
          setDkimVerified(!!data.dkim_verified);
          setDkimDomain(data.dkim_domain || "");
        }
      } catch (err) {
        console.error("DKIM status check failed on new campaigns page:", err);
        setDkimVerified(false);
      }
    })();
  }, []);

  // init
  useEffect(() => {
    const init = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) {
          alert("Please log in");
          router.push("/login");
          return;
        }

        setUserId(user.id);
        setUserEmail(user.email || "");
        setTestRecipients(user.email || "");

        // lists
        const { data: listRows } = await supabase
          .from("lead_lists")
          .select("id, name")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        setLists(listRows || []);

        // saved emails
        const { data: files, error: filesError } = await supabase.storage
          .from("email-user-assets")
          .list(`${user.id}/finished-emails`, { limit: 500 });

        if (!filesError && Array.isArray(files)) {
          const htmlFiles = files.filter((f) => f.name.endsWith(".html"));
          const mapped = htmlFiles.map((f) => {
            const base = f.name.replace(".html", "");
            return { id: base, name: base };
          });
          setSavedEmails(mapped);
        }

        // existing campaigns
        if (campaignsId) {
          const { data: row, error } = await supabase
            .from("email_campaigns")
            .select("*")
            .eq("id", campaignsId)
            .single();

          if (error) {
            console.error(error);
          } else if (row) {
            setName(row.name || "");
            setListId(row.subscriber_list_id || "");
            setSendToAll(!!row.send_to_all);

            setFromName(row.from_name || "");
            setFromEmail(row.from_email || "");
            setReplyEmail(row.reply_to_email || "");
            if (row.extra_recipients) setExtraEmails(row.extra_recipients);

            setEmail1Subject(row.email1_subject || "");
            setEmail1Preheader(row.email1_preheader || "");
            setEmail1TemplateId(row.email1_template_id || "");
            const d1 = fromMinutes(row.email1_delay_minutes ?? 0, true);
            setEmail1DelayAmount(d1.amount);
            setEmail1DelayUnit(d1.unit);

            setEmail2Subject(row.email2_subject || "");
            setEmail2Preheader(row.email2_preheader || "");
            setEmail2TemplateId(row.email2_template_id || "");
            const d2 = fromMinutes(row.email2_delay_minutes, false);
            setEmail2DelayAmount(d2.amount);
            setEmail2DelayUnit(d2.unit);

            setEmail3Subject(row.email3_subject || "");
            setEmail3Preheader(row.email3_preheader || "");
            setEmail3TemplateId(row.email3_template_id || "");
            const d3 = fromMinutes(row.email3_delay_minutes, false);
            setEmail3DelayAmount(d3.amount);
            setEmail3DelayUnit(d3.unit);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    if (!router.isReady) return;
    init();
  }, [router.isReady, campaignsId, router]);

  // fetch template HTML
  const fetchTemplateHtml = async (templateId) => {
    if (!userId || !templateId) return null;
    const path = `${userId}/finished-emails/${templateId}.html`;
    const { data } = supabase.storage.from("email-user-assets").getPublicUrl(path);
    const url = data?.publicUrl;
    if (!url) throw new Error("No public URL for template");
    const res = await fetch(url);
    if (!res.ok) throw new Error("Could not load template HTML");
    return await res.text();
  };

  // preview in modal
  useEffect(() => {
    const loadPreview = async () => {
      if (!showTestModal) return;
      setPreviewError("");
      setPreviewHtml("");

      let choice = testChoice;
      if (choice === "all") {
        if (email1TemplateId) choice = "email1";
        else if (email2TemplateId) choice = "email2";
        else if (email3TemplateId) choice = "email3";
        else {
          setPreviewError("No templates selected to preview.");
          return;
        }
      }

      let templateId = null;
      if (choice === "email1") templateId = email1TemplateId;
      if (choice === "email2") templateId = email2TemplateId;
      if (choice === "email3") templateId = email3TemplateId;

      if (!templateId) {
        setPreviewError("No template selected for this email.");
        return;
      }

      try {
        const html = await fetchTemplateHtml(templateId);
        setPreviewHtml(html || "");
      } catch (err) {
        setPreviewError(err?.message || "Could not load preview for this template.");
      }
    };

    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTestModal, testChoice, email1TemplateId, email2TemplateId, email3TemplateId, userId]);

  // CSV upload
  const handleCsvUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rawTokens = text
        .split(/[\n,;]+/g)
        .map((t) => t.trim())
        .filter(Boolean);

      const extracted = rawTokens.filter((t) => /\S+@\S+\.\S+/.test(t));
      const uniqueEmails = Array.from(new Set(extracted));

      setCsvEmails(uniqueEmails);
      setCsvSummary(
        uniqueEmails.length
          ? `${uniqueEmails.length} email(s) detected from CSV`
          : "No valid email addresses found in CSV"
      );
    } catch (err) {
      console.error(err);
      alert("Could not read CSV file.");
    }
  };

  // SAVE campaigns
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData?.user;
      if (!user) {
        alert("Please log in");
        return;
      }

      const email1Minutes = toMinutes(email1DelayAmount, email1DelayUnit, true);
      const email2Minutes = toMinutes(email2DelayAmount, email2DelayUnit, false);
      const email3Minutes = toMinutes(email3DelayAmount, email3DelayUnit, false);

      // combine manual extra emails + CSV ones into a single unique list
      const manualExtra = extraEmails
        .split(/[\n,;]+/g)
        .map((t) => t.trim())
        .filter(Boolean);

      const allExtra = [...manualExtra, ...csvEmails];
      const uniqueExtra = Array.from(new Set(allExtra));
      const extraRecipients = uniqueExtra.length > 0 ? uniqueExtra.join(",") : null;

      const payload = {
        user_id: user.id,
        name: name || null,
        subscriber_list_id: sendToAll ? null : listId || null,
        send_to_all: sendToAll,

        from_name: fromName || null,
        from_email: fromEmail || null,
        reply_to_email: replyEmail || null,
        extra_recipients: extraRecipients,

        email1_subject: email1Subject || null,
        email1_preheader: email1Preheader || null,
        email1_template_id: email1TemplateId || null,
        email1_delay_minutes: email1Minutes,

        email2_subject: email2Subject || null,
        email2_preheader: email2Preheader || null,
        email2_template_id: email2TemplateId || null,
        email2_delay_minutes: email2Minutes,

        email3_subject: email3Subject || null,
        email3_preheader: email3Preheader || null,
        email3_template_id: email3TemplateId || null,
        email3_delay_minutes: email3Minutes,
      };

      let error;

      if (campaignsId) {
        const { error: updErr } = await supabase
          .from("email_campaigns")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", campaignsId);
        error = updErr;
      } else {
        const { error: insErr } = await supabase
          .from("email_campaigns")
          .insert({ ...payload, status: "draft" });
        error = insErr;
      }

      if (error) {
        console.error("Save error:", error);
        alert("There was a problem saving this campaigns:\n" + (error.message || JSON.stringify(error)));
      } else {
        alert("campaigns saved.");
        router.push("/modules/email/campaigns");
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("There was a problem saving this campaigns:\n" + (err.message || JSON.stringify(err)));
    } finally {
      setSaving(false);
    }
  };

  const listLabel = (l) => l.name || "Untitled list";

  // TEST send
  const handleSendTest = async () => {
    try {
      if (!fromEmail || !fromName) {
        alert("Please fill in From Name and From Email before sending a test.");
        return;
      }

      if (!testRecipients.trim()) {
        alert("Please enter at least one recipient email for the test.");
        return;
      }

      const recipients = Array.from(
        new Set(
          testRecipients
            .split(/[\n,; ]+/g)
            .map((t) => t.trim())
            .filter(Boolean)
        )
      );

      if (recipients.length === 0) {
        alert("No valid test recipient emails found.");
        return;
      }

      setTestLoading(true);

      const sendOne = async (html, subjectLabel) => {
        if (!html) return;
        const res = await fetch("/api/email/test-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromEmail,
            fromName,
            recipients,
            subject: `[TEST] ${subjectLabel}`,
            html,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Test send failed");
      };

      if (testChoice === "all") {
        const queue = [];
        if (email1TemplateId) queue.push({ id: email1TemplateId, subject: email1Subject || "Email 1" });
        if (email2TemplateId) queue.push({ id: email2TemplateId, subject: email2Subject || "Email 2" });
        if (email3TemplateId) queue.push({ id: email3TemplateId, subject: email3Subject || "Email 3" });

        if (queue.length === 0) {
          alert("No templates selected to send as test.");
          setTestLoading(false);
          return;
        }

        for (let i = 0; i < queue.length; i++) {
          const item = queue[i];
          const html = await fetchTemplateHtml(item.id);
          await sendOne(html, item.subject);
          if (i < queue.length - 1) await new Promise((resolve) => setTimeout(resolve, 15000));
        }
      } else {
        let templateId = null;
        let subjectLabel = "campaigns Test";

        if (testChoice === "email1") {
          templateId = email1TemplateId;
          subjectLabel = email1Subject || "Email 1";
        } else if (testChoice === "email2") {
          templateId = email2TemplateId;
          subjectLabel = email2Subject || "Email 2";
        } else if (testChoice === "email3") {
          templateId = email3TemplateId;
          subjectLabel = email3Subject || "Email 3";
        }

        if (!templateId) {
          alert("No template selected for that email.");
          setTestLoading(false);
          return;
        }

        const html = await fetchTemplateHtml(templateId);
        await sendOne(html, subjectLabel);
      }

      alert("Test email(s) sent.");
    } catch (err) {
      console.error("Test send error:", err);
      alert("Test send failed: " + (err?.message || "Unknown error"));
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{campaignsId ? "Edit campaigns" : "Create New campaigns"} — GR8 RESULT</title>
      </Head>

      <main style={page.wrap}>
        <div style={page.center}>
          {/* DKIM bars */}
          {dkimVerified === false && (
            <div style={page.dkimBarWarning}>
              <span>⚠️ DKIM not verified. Emails may not be delivered.</span>
              <button style={page.dkimBtn} onClick={() => router.push("/account")}>
                Fix Now
              </button>
            </div>
          )}
          {dkimVerified === true && (
            <div style={page.dkimBarOk}>
              ✅ Your domain{" "}
              <span style={{ fontWeight: 800 }}>{dkimDomain || "your domain"}</span>{" "}
              has now been fully verified and can be used to send emails.
            </div>
          )}

          {/* banner */}
          <div style={page.banner}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 32 }}>📣</span>
              <div>
                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>
                  {campaignsId ? "Edit campaigns" : "Create New campaigns"}
                </h1>
                <p style={{ margin: 0, fontSize: 18 }}>
                  Set sender details, audience, subject & preheader.
                </p>
              </div>
            </div>

            <div style={page.bannerActions}>
              <button type="button" style={page.testBtn} onClick={() => setShowTestModal(true)}>
                🧪 Test Send
              </button>
              <button style={page.backBtn} onClick={() => router.push("/modules/email/campaigns")}>
                ← Back
              </button>
            </div>
          </div>

          {/* main card */}
          <div style={page.card}>
            {loading ? (
              <p style={{ color: "#fff", fontSize: 18 }}>Loading…</p>
            ) : (
              <form onSubmit={handleSubmit}>
                {/* Name */}
                <div style={page.field}>
                  <label style={page.label}>campaigns Name</label>
                  <input
                    style={page.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Offer Sequence"
                  />
                </div>

                {/* from / reply */}
                <div style={page.row}>
                  <div style={page.col}>
                    <label style={page.label}>From Name</label>
                    <input
                      style={page.input}
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      placeholder="Your name or brand"
                    />
                  </div>
                  <div style={page.col}>
                    <label style={page.label}>From Email</label>
                    <input
                      style={page.input}
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      placeholder="you@yourdomain.com"
                    />
                  </div>
                </div>

                <div style={page.field}>
                  <label style={page.label}>Reply-To Email</label>
                  <input
                    style={page.input}
                    value={replyEmail}
                    onChange={(e) => setReplyEmail(e.target.value)}
                    placeholder="replies@yourdomain.com"
                  />
                </div>

                {/* audience */}
                <div style={page.field}>
                  <label style={page.label}>Subscriber List</label>
                  <select
                    style={page.input}
                    value={sendToAll ? "ALL" : listId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "ALL") {
                        setSendToAll(true);
                        setListId("");
                      } else {
                        setSendToAll(false);
                        setListId(val);
                      }
                    }}
                  >
                    <option value="">-- Select from your subscriber lists --</option>
                    <option value="ALL">Send to ALL lists</option>
                    {lists.length === 0 && (
                      <option value="" disabled>
                        (No lists created yet)
                      </option>
                    )}
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {listLabel(l)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* extra recipients */}
                <h3 style={page.subHeading}>Extra Recipients (optional)</h3>
                <div style={page.field}>
                  <label style={page.label}>
                    Type or paste email addresses (comma, semicolon or new line separated)
                  </label>
                  <textarea
                    style={{ ...page.input, minHeight: 80, resize: "vertical" }}
                    value={extraEmails}
                    onChange={(e) => setExtraEmails(e.target.value)}
                    placeholder="example1@site.com, example2@site.com"
                  />
                </div>

                <div style={page.field}>
                  <label style={page.label}>Or upload a CSV just for this campaigns</label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    style={{ marginBottom: 6, fontSize: 18 }}
                  />
                  {csvSummary && <div style={{ fontSize: 18, opacity: 0.9 }}>{csvSummary}</div>}
                </div>

                {/* EMAIL 1 */}
                <div style={page.emailCard}>
                  <h3 style={page.emailTitle}>Email 1 (required)</h3>
                  <div style={page.field}>
                    <label style={page.label}>Subject Line</label>
                    <input
                      style={page.input}
                      value={email1Subject}
                      onChange={(e) => setEmail1Subject(e.target.value)}
                      placeholder="Welcome to the offer…"
                    />
                  </div>
                  <div style={page.field}>
                    <label style={page.label}>Preheader</label>
                    <input
                      style={page.input}
                      value={email1Preheader}
                      onChange={(e) => setEmail1Preheader(e.target.value)}
                      placeholder="Short teaser text"
                    />
                  </div>

                  <div style={page.row}>
                    <div style={page.col}>
                      <label style={page.label}>Choose Saved Email</label>
                      <select
                        style={page.input}
                        value={email1TemplateId}
                        onChange={(e) => setEmail1TemplateId(e.target.value)}
                      >
                        <option value="">-- Select from My Saved Emails --</option>
                        {savedEmails.length === 0 && (
                          <option value="" disabled>
                            (No saved emails yet)
                          </option>
                        )}
                        {savedEmails.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={page.col}>
                      <label style={page.label}>Delay (from start)</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="number"
                          min="0"
                          style={{ ...page.input, flex: 1 }}
                          value={email1DelayAmount}
                          onChange={(e) => setEmail1DelayAmount(e.target.value)}
                        />
                        <select
                          style={{ ...page.input, width: 170 }}
                          value={email1DelayUnit}
                          onChange={(e) => setEmail1DelayUnit(e.target.value)}
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* EMAIL 2 */}
                <div style={page.emailCard}>
                  <h3 style={page.emailTitle}>Email 2 (optional)</h3>
                  <div style={page.field}>
                    <label style={page.label}>Subject Line</label>
                    <input
                      style={page.input}
                      value={email2Subject}
                      onChange={(e) => setEmail2Subject(e.target.value)}
                      placeholder="Follow-up subject"
                    />
                  </div>
                  <div style={page.field}>
                    <label style={page.label}>Preheader</label>
                    <input
                      style={page.input}
                      value={email2Preheader}
                      onChange={(e) => setEmail2Preheader(e.target.value)}
                      placeholder="Follow-up teaser"
                    />
                  </div>

                  <div style={page.row}>
                    <div style={page.col}>
                      <label style={page.label}>Choose Saved Email</label>
                      <select
                        style={page.input}
                        value={email2TemplateId}
                        onChange={(e) => setEmail2TemplateId(e.target.value)}
                      >
                        <option value="">-- Select from My Saved Emails --</option>
                        {savedEmails.length === 0 && (
                          <option value="" disabled>
                            (No saved emails yet)
                          </option>
                        )}
                        {savedEmails.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={page.col}>
                      <label style={page.label}>Delay after Email 1</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="number"
                          min="0"
                          style={{ ...page.input, flex: 1 }}
                          value={email2DelayAmount}
                          onChange={(e) => setEmail2DelayAmount(e.target.value)}
                        />
                        <select
                          style={{ ...page.input, width: 170 }}
                          value={email2DelayUnit}
                          onChange={(e) => setEmail2DelayUnit(e.target.value)}
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* EMAIL 3 */}
                <div style={page.emailCard}>
                  <h3 style={page.emailTitle}>Email 3 (optional)</h3>
                  <div style={page.field}>
                    <label style={page.label}>Subject Line</label>
                    <input
                      style={page.input}
                      value={email3Subject}
                      onChange={(e) => setEmail3Subject(e.target.value)}
                      placeholder="Last chance subject"
                    />
                  </div>
                  <div style={page.field}>
                    <label style={page.label}>Preheader</label>
                    <input
                      style={page.input}
                      value={email3Preheader}
                      onChange={(e) => setEmail3Preheader(e.target.value)}
                      placeholder="Last chance teaser"
                    />
                  </div>

                  <div style={page.row}>
                    <div style={page.col}>
                      <label style={page.label}>Choose Saved Email</label>
                      <select
                        style={page.input}
                        value={email3TemplateId}
                        onChange={(e) => setEmail3TemplateId(e.target.value)}
                      >
                        <option value="">-- Select from My Saved Emails --</option>
                        {savedEmails.length === 0 && (
                          <option value="" disabled>
                            (No saved emails yet)
                          </option>
                        )}
                        {savedEmails.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={page.col}>
                      <label style={page.label}>Delay after Email 2</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="number"
                          min="0"
                          style={{ ...page.input, flex: 1 }}
                          value={email3DelayAmount}
                          onChange={(e) => setEmail3DelayAmount(e.target.value)}
                        />
                        <select
                          style={{ ...page.input, width: 170 }}
                          value={email3DelayUnit}
                          onChange={(e) => setEmail3DelayUnit(e.target.value)}
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* inline test */}
                <div style={page.testInlineWrap}>
                  <label style={page.label}>Send test email to</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      style={{ ...page.input, flex: 1 }}
                      value={testRecipients}
                      onChange={(e) => setTestRecipients(e.target.value)}
                      placeholder={userEmail || "you@example.com"}
                    />
                    <button
                      type="button"
                      style={page.inlineTestBtn}
                      onClick={handleSendTest}
                      disabled={testLoading}
                    >
                      {testLoading ? "Sending…" : "Send Test"}
                    </button>
                  </div>
                  <div style={{ fontSize: 18, opacity: 0.8, marginTop: 4 }}>
                    Uses Email 1 by default and ignores campaigns delays. Sends only to this address, not your list.
                  </div>
                </div>

                <button type="submit" style={page.saveBtn} disabled={saving}>
                  {saving ? "Saving..." : campaignsId ? "Save campaigns" : "Create campaigns"}
                </button>
              </form>
            )}
          </div>

          {/* test modal */}
          {showTestModal && (
            <div style={page.modalOverlay} onClick={() => !testLoading && setShowTestModal(false)}>
              <div style={page.modal} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginTop: 0, marginBottom: 10, fontSize: 24 }}>🧪 Send Test Email</h3>

                <div style={page.field}>
                  <label style={page.label}>What do you want to test?</label>
                  <select style={page.input} value={testChoice} onChange={(e) => setTestChoice(e.target.value)}>
                    <option value="email1">Email 1</option>
                    <option value="email2">Email 2</option>
                    <option value="email3">Email 3</option>
                    <option value="all">Send ALL (15 sec apart)</option>
                  </select>
                </div>

                <div style={page.field}>
                  <label style={page.label}>
                    Recipient email(s) for test{" "}
                    <span style={{ opacity: 0.7, marginLeft: 4, fontSize: 18 }}>(comma / space / new lines allowed)</span>
                  </label>
                  <textarea
                    style={{ ...page.input, minHeight: 70, resize: "vertical" }}
                    value={testRecipients}
                    onChange={(e) => setTestRecipients(e.target.value)}
                    placeholder={userEmail || "you@example.com"}
                  />
                </div>

                <div style={{ fontSize: 18, opacity: 0.8, marginBottom: 10 }}>
                  Test mode ignores campaigns delays.{" "}
                  {testChoice === "all"
                    ? "Emails 1–3 will be sent with 15 seconds between each."
                    : "Selected email will be sent immediately."}
                </div>

                <div style={page.previewBox}>
                  <div style={page.previewHeader}>Live Preview</div>
                  <div style={page.previewInner}>
                    {previewError ? (
                      <div style={{ color: "#fca5a5", fontSize: 18 }}>{previewError}</div>
                    ) : previewHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    ) : (
                      <div style={{ fontSize: 18, opacity: 0.7 }}>Select an email above to load a preview.</div>
                    )}
                  </div>
                </div>

                <div style={page.modalActions}>
                  <button type="button" onClick={handleSendTest} disabled={testLoading} style={page.primaryModalBtn}>
                    {testLoading ? "Sending tests..." : "Send Test"}
                  </button>
                  <button
                    type="button"
                    onClick={() => !testLoading && setShowTestModal(false)}
                    disabled={testLoading}
                    style={page.secondaryModalBtn}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

const page = {
  wrap: {
    minHeight: "100vh",
    background: "#0c121a",
    padding: "24px 16px 40px",
    fontSize: 18,
    color: "#fff",
  },
  center: {
    maxWidth: 1320,
    margin: "0 auto",
  },
  dkimBarWarning: {
    maxWidth: 1320,
    margin: "0 auto 12px",
    background: "#78350f",
    color: "#fff7ed",
    borderRadius: 8,
    padding: "8px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 18,
  },
  dkimBarOk: {
    maxWidth: 1320,
    margin: "0 auto 12px",
    background: "#064e3b",
    color: "#a7f3d0",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 18,
    fontWeight: 700,
    textAlign: "center",
    border: "1px solid #10b981",
  },
  dkimBtn: {
    background: "#f97316",
    border: "none",
    color: "#fff",
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 18,
    cursor: "pointer",
    fontWeight: 600,
  },
  banner: {
    maxWidth: 1320,
    margin: "0 auto 20px",
    background: "#14b8a6",
    borderRadius: 14,
    padding: "18px 22px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#fff",
  },
  bannerActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  backBtn: {
    background: "#111827",
    color: "#fff",
    border: "1px solid #0f172a",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 18,
    cursor: "pointer",
  },
  testBtn: {
    background: "#0f172a",
    color: "#e5e7eb",
    border: "1px solid #1f2937",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 18,
    cursor: "pointer",
    fontWeight: 700,
  },
  card: {
    maxWidth: 1320,
    margin: "0 auto",
    background: "#14b8a6",
    borderRadius: 14,
    padding: 26,
    boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
    color: "#fff",
  },
  field: {
    marginBottom: 18,
    display: "flex",
    flexDirection: "column",
  },
  row: {
    display: "flex",
    gap: 10,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  col: {
    flex: 1,
    minWidth: 260,
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontSize: 18,
    marginBottom: 4,
    fontWeight: 600,
  },
  input: {
    borderRadius: 6,
    border: "1px solid #111827",
    padding: "9px 11px",
    fontSize: 18,
    outline: "none",
  },
  subHeading: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 20,
    fontWeight: 800,
  },
  emailCard: {
    background: "#0f766e",
    borderRadius: 10,
    padding: 20,
    marginBottom: 22,
    border: "1px solid #0d9488",
  },
  emailTitle: {
    fontSize: 22,
    fontWeight: 800,
    marginBottom: 12,
  },
  saveBtn: {
    marginTop: 22,
    background: "#16a34a",
    border: "none",
    borderRadius: 8,
    padding: "10px 22px",
    fontWeight: 700,
    fontSize: 18,
    cursor: "pointer",
    color: "#fff",
  },
  testInlineWrap: {
    marginTop: 14,
    marginBottom: 10,
    paddingTop: 12,
    paddingBottom: 12,
    borderTop: "1px dashed rgba(15,23,42,0.7)",
    borderBottom: "1px dashed rgba(15,23,42,0.7)",
  },
  inlineTestBtn: {
    background: "#111827",
    color: "#e5e7eb",
    border: "1px solid #1f2937",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 18,
    cursor: "pointer",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  modal: {
    background: "#020617",
    borderRadius: 12,
    padding: 20,
    width: "90%",
    maxWidth: 720,
    border: "1px solid #1f2937",
    color: "#e5e7eb",
    maxHeight: "90vh",
    overflow: "auto",
    fontSize: 18,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  primaryModalBtn: {
    background: "#16a34a",
    border: "none",
    borderRadius: 8,
    padding: "10px 20px",
    fontWeight: 700,
    fontSize: 18,
    cursor: "pointer",
    color: "#fff",
  },
  secondaryModalBtn: {
    background: "#111827",
    border: "1px solid #374151",
    borderRadius: 8,
    padding: "10px 18px",
    fontWeight: 600,
    fontSize: 18,
    cursor: "pointer",
    color: "#e5e7eb",
  },
  previewBox: {
    borderRadius: 10,
    border: "1px solid #111827",
    background: "#020617",
    marginTop: 12,
    overflow: "hidden",
  },
  previewHeader: {
    padding: "8px 12px",
    fontSize: 18,
    fontWeight: 700,
    background: "#0f172a",
    borderBottom: "1px solid #111827",
  },
  previewInner: {
    padding: 12,
    background: "#020617",
    maxHeight: "50vh",
    overflowY: "auto",
    fontSize: 18,
  },
};
