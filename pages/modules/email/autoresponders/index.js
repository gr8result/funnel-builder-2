// /pages/modules/email/autoresponders/index.js
// Autoresponder Setup – create OR edit
// - If ?autoresponder_id= is present, loads and updates that record
// - Otherwise inserts new and goes to editor

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { supabase } from "../../../../utils/supabase-client";

export default function AutoresponderSetup() {
  const router = useRouter();
  const [autoresponderId, setAutoresponderId] = useState(null);

  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("After Signup");
  const [sendDay, setSendDay] = useState("Same day as trigger");
  const [sendTime, setSendTime] = useState("Same as signup time");
  const [activeDays, setActiveDays] = useState([
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
  ]);
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");
  const [subjectLine, setSubjectLine] = useState("");
  const [subscriberList, setSubscriberList] = useState("");
  const [emailTemplate, setEmailTemplate] = useState("");
  const [lists, setLists] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const isEditing = !!autoresponderId;

  useEffect(() => {
    loadUserAccount();
    loadSubscriberLists();
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const { autoresponder_id } = router.query || {};
    if (autoresponder_id) {
      fetchAutoresponder(autoresponder_id);
    }
  }, [router.isReady, router.query]);

  async function loadUserAccount() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("accounts")
        .select("business_name, email")
        .eq("user_id", user.id)
        .single();
      if (!error && data) {
        setFromName(data.business_name || "");
        setFromEmail(data.email || "");
        setReplyToEmail(data.email || "");
      }
    } catch (err) {
      console.error("Error loading account:", err);
    }
  }

  async function loadSubscriberLists() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("lead_lists")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setLists(data || []);
    } catch (err) {
      console.error("Error loading lists:", err);
    }
  }

  async function fetchAutoresponder(id) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("email_automations")
        .select(
          "id, name, trigger_type, send_day, send_time, active_days, from_name, from_email, reply_to, subject, list_id, template_id"
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      if (data) {
        setAutoresponderId(data.id);
        setName(data.name || "");
        setTriggerType(data.trigger_type || "After Signup");
        setSendDay(data.send_day || "Same day as trigger");
        setSendTime(data.send_time || "Same as signup time");
        setActiveDays(data.active_days || ["Mon", "Tue", "Wed", "Thu", "Fri"]);
        setFromName(data.from_name || "");
        setFromEmail(data.from_email || "");
        setReplyToEmail(data.reply_to || "");
        setSubjectLine(data.subject || "");
        setSubscriberList(data.list_id || "");
        setEmailTemplate(data.template_id || "");
      }
    } catch (err) {
      console.error("Error loading autoresponder:", err);
      setMessage("Error loading autoresponder: " + (err.message || "Unknown"));
    } finally {
      setLoading(false);
    }
  }

  async function saveAutoresponder() {
    try {
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMessage("You must be logged in.");
        return;
      }

      if (!name.trim()) {
        setMessage("Please enter an autoresponder name.");
        return;
      }
      if (!subjectLine.trim()) {
        setMessage("Please enter a subject line.");
        return;
      }

      setLoading(true);

      if (isEditing) {
        const { error } = await supabase
          .from("email_automations")
          .update({
            name,
            trigger_type: triggerType,
            send_day: sendDay,
            send_time: sendTime,
            active_days: activeDays,
            from_name: fromName,
            from_email: fromEmail,
            reply_to: replyToEmail,
            subject: subjectLine,
            list_id: subscriberList || null,
            template_id: emailTemplate || null,
          })
          .eq("id", autoresponderId);

        if (error) throw error;

        setMessage("Autoresponder updated successfully!");
        router.push("/modules/email/autoresponders/open");
      } else {
        const { data, error } = await supabase
          .from("email_automations")
          .insert([
            {
              user_id: user.id,
              name,
              trigger_type: triggerType,
              send_day: sendDay,
              send_time: sendTime,
              active_days: activeDays,
              from_name: fromName,
              from_email: fromEmail,
              reply_to: replyToEmail,
              subject: subjectLine,
              list_id: subscriberList || null,
              template_id: emailTemplate || null,
            },
          ])
          .select()
          .single();

        if (error) throw error;

        setMessage("Autoresponder created successfully!");
        router.push(`/modules/email/editor?autoresponder_id=${data.id}`);
      }
    } catch (err) {
      console.error(err);
      setMessage("Error saving autoresponder: " + (err.message || "Unknown"));
    } finally {
      setLoading(false);
    }
  }

  function toggleDay(day) {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function selectAllDays() {
    setActiveDays(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  }

  return (
    <>
      <Head>
        <title>Autoresponder Setup - GR8 RESULT Digital Solutions</title>
      </Head>

      {/* Banner */}
      <div className="banner-wrapper">
        <div className="banner">
          <div className="banner-left">
            <span className="icon">⏱️</span>
            <div>
              <h1 className="title">
                {isEditing ? "Edit Autoresponder" : "Autoresponders"}
              </h1>
              <p className="subtitle">
                {isEditing
                  ? "Update timing, list and settings."
                  : "Timed sequences and follow-ups."}
              </p>
            </div>
          </div>
          <button
            className="back"
            onClick={() => router.push("/modules/email/autoresponders/open")}
          >
            ⟵ Back to list
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="form-wrapper">
        <div className="form-inner">
          <label>Autoresponder Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Welcome sequence, Abandoned cart, etc."
          />

          <div className="row">
            <div>
              <label>Trigger Type</label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value)}
              >
                <option>After Signup</option>
                <option>After Purchase</option>
                <option>After Link Click</option>
              </select>
            </div>
            <div>
              <label>Send On Day</label>
              <select
                value={sendDay}
                onChange={(e) => setSendDay(e.target.value)}
              >
                <option>Same day as trigger</option>
                <option>Next day</option>
                <option>2 days after trigger</option>
              </select>
            </div>
          </div>

          <div className="row">
            <div>
              <label>Send Time</label>
              <select
                value={sendTime}
                onChange={(e) => setSendTime(e.target.value)}
              >
                <option>Same as signup time</option>
                <option>9 AM</option>
                <option>12 PM</option>
                <option>6 PM</option>
              </select>
            </div>
            <div>
              <label>Active Days</label>
              <div className="days">
                <button
                  type="button"
                  onClick={selectAllDays}
                  className="select-all"
                >
                  Select All
                </button>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={activeDays.includes(day) ? "active" : ""}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="row">
            <div>
              <label>From Name</label>
              <input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>
            <div>
              <label>From Email</label>
              <input
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="row">
            <div>
              <label>Reply-To Email</label>
              <input
                value={replyToEmail}
                onChange={(e) => setReplyToEmail(e.target.value)}
              />
            </div>
            <div>
              <label>Subscriber List</label>
              <select
                value={subscriberList}
                onChange={(e) => setSubscriberList(e.target.value)}
              >
                <option value="">Select a list...</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label>Subject Line</label>
          <input
            value={subjectLine}
            onChange={(e) => setSubjectLine(e.target.value)}
            placeholder="Welcome to Waite and Sea, here’s what to expect..."
          />

          {/* Design section */}
          <div className="template-section">
            <h3>Design &amp; Content</h3>
            <p className="hint">Choose how you want to design your email.</p>

            <div className="template-card">
              <img
                src="/email-template-envelope.png"
                alt="Email Template"
                className="template-image"
              />
              <div className="overlay">
                <button
                  className="btn green"
                  type="button"
                  onClick={() =>
                    router.push("/modules/email/editor?mode=blank")
                  }
                >
                  Use Blank Template
                </button>
                <button
                  className="btn purple"
                  type="button"
                  onClick={() =>
                    router.push("/modules/email/templates/select?mode=pre")
                  }
                >
                  Browse Pre-designed
                </button>
              </div>
            </div>
          </div>

          <button
            className="create"
            onClick={saveAutoresponder}
            disabled={loading}
          >
            {loading
              ? isEditing
                ? "Updating..."
                : "Creating..."
              : isEditing
              ? "Update Autoresponder"
              : "Create Autoresponder"}
          </button>

          {message && <p className="msg">{message}</p>}
        </div>
      </div>

      <style jsx>{`
        .banner-wrapper {
          display: flex;
          justify-content: center;
          width: 100%;
        }
        .banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: #a855f7;
          width: 1320px;
          border-radius: 12px;
          padding: 20px 28px;
          color: #fff;
          margin-top: 20px;
        }
        .banner-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .icon {
          font-size: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }
        .title {
          margin: 0;
          font-size: 36px;
        }
        .subtitle {
          margin: 2px 0 0;
          opacity: 0.9;
          font-size: 22px;
        }
        .back {
          background: #111821;
          color: #e5e7eb;
          border: 1px solid #4b5563;
          padding: 10px 18px;
          border-radius: 999px;
          cursor: pointer;
          font-weight: 500;
          font-size: 20px;
        }

        .form-wrapper {
          display: flex;
          justify-content: center;
          width: 100%;
        }
        .form-inner {
          width: 1100px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          margin-top: 30px;
          margin-bottom: 150px; /* extra space at very bottom */
        }
        .row {
          display: flex;
          gap: 16px;
        }
        .row > div {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        label {
          font-weight: 600;
          color: #fff;
          font-size: 18px;
        }
        input,
        select {
          background: #0c121a;
          color: #eee;
          border: 1px solid #333;
          border-radius: 6px;
          padding: 12px;
          font-size: 18px;
        }
        input::placeholder {
          color: #666;
          font-size: 16px;
        }
        .days {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .days button {
          background: #222;
          border: 1px solid #444;
          padding: 8px 14px;
          border-radius: 6px;
          color: #eee;
          cursor: pointer;
          font-size: 18px;
        }
        .days button.active {
          background: #a855f7;
          border-color: #a855f7;
        }
        .select-all {
          background: #10b981;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 14px;
          font-weight: 600;
          font-size: 18px;
        }

        .template-section {
          text-align: center;
          margin-top: 30px;
          background: #111821;
          padding: 30px;
          border-radius: 12px;
          border: 1px solid #333;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        }
        .template-section h3 {
          color: #fff;
          margin-bottom: 6px;
          font-size: 20px;
        }
        .hint {
          color: #aaa;
          margin-bottom: 20px;
          font-size: 16px;
        }
        .template-card {
          position: relative;
          display: inline-block;
          cursor: pointer;
          overflow: hidden;
          border-radius: 12px;
          border: 1px solid #333;
          width: 35%;
          max-width: 400px;
          transition: all 0.3s ease;
        }
        .template-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 0 15px rgba(168, 85, 247, 0.5);
        }
        .template-image {
          width: 100%; /* smaller image size */
          display: block;
          margin: 0 auto; /* centred */
          border-radius: 12px;
        }
        .overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          opacity: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: opacity 0.3s ease;
        }
        .template-card:hover .overlay {
          opacity: 1;
        }
        .btn {
          border: none;
          border-radius: 6px;
          padding: 10px 18px;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
          font-size: 18px;
        }
        .btn.green {
          background: #10b981;
        }
        .btn.purple {
          background: #a855f7;
        }

        .create {
          background: #10b981;
          color: #fff;
          border: none;
          padding: 12px;
          border-radius: 6px;
          margin-top: 10px;
          cursor: pointer;
          font-weight: 600;
          font-size: 18px;
        }
        .create[disabled] {
          opacity: 0.6;
          cursor: default;
        }
        .msg {
          color: #10b981;
          margin-top: 10px;
          font-size: 16px;
        }
      `}</style>
    </>
  );
}
