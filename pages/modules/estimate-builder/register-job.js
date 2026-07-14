import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { isDeveloperAccount } from "../../../lib/estimate-builder/developerBypass";

const EMPTY_FORM = {
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  clientCompany: "",
  jobNumber: "",
  jobName: "",
  jobDescription: "",
  siteAddress: "",
  suburb: "",
  state: "",
  postcode: "",
  lotNumber: "",
  planNumber: "",
  rpNumber: "",
  council: "",
};

export default function RegisterEstimateJobPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [credits, setCredits] = useState(0);
  const developerBypass = isDeveloperAccount(user?.email);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("estimate-builder-pending-job");
      if (raw) setForm((current) => ({ ...current, ...JSON.parse(raw) }));
      setCredits(Number(window.localStorage.getItem("estimate-builder-credits") || 0));
    } catch {}
  }, []);

  const requiredComplete = [
    form.clientName,
    form.clientEmail,
    form.jobName,
    form.jobDescription,
    form.siteAddress,
    form.suburb,
    form.state,
    form.postcode,
    form.rpNumber,
  ].every((value) => String(value || "").trim());

  function updateField(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (typeof window !== "undefined") {
        window.localStorage.setItem("estimate-builder-pending-job", JSON.stringify(next));
      }
      return next;
    });
  }

  function confirmJob(event) {
    event.preventDefault();
    if (!requiredComplete || loading) return;
    const jobId = form.jobId || `builder-job-${Date.now()}`;
    const payload = { ...form, jobId, registeredAt: new Date().toISOString() };
    if (typeof window !== "undefined") {
      window.localStorage.setItem("estimate-builder-pending-job", JSON.stringify(payload));
      if (developerBypass || credits > 0) {
        const nextCredits = developerBypass ? credits : credits - 1;
        const jobs = JSON.parse(window.localStorage.getItem("estimate-builder-registered-jobs") || "[]");
        // DEV ONLY / OWNER TESTING BYPASS: support@gr8result.com can register
        // unlimited estimate jobs without consuming credits or requiring Stripe.
        const registeredJob = { ...payload, creditCharged: developerBypass ? 0 : 1, developerBypass, status: "registered" };
        if (!developerBypass) window.localStorage.setItem("estimate-builder-credits", String(nextCredits));
        window.localStorage.setItem("estimate-builder-registered-jobs", JSON.stringify([...jobs, registeredJob]));
        window.localStorage.setItem("estimate-builder-active-registered-job", JSON.stringify(registeredJob));
        window.localStorage.setItem("estimate-builder-active-draft", JSON.stringify({
          storageMode: "registered-job",
          savedAt: registeredJob.registeredAt,
          registeredJobId: registeredJob.jobId,
          projectName: registeredJob.jobName,
          templateKey: "template:master-estimate-template",
          templateName: "Master Estimate Template",
        }));
        window.localStorage.removeItem("estimate-builder-pending-job");
        setCredits(nextCredits);
        router.push("/modules/estimate-builder");
        return;
      }
    }
    router.push(`/modules/estimate-builder/payment?jobId=${encodeURIComponent(jobId)}`);
  }

  function exitToHub() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("estimate-builder-pending-job");
    }
    router.push("/modules/construction");
  }

  return (
    <>
      <Head><title>Register Estimate Job</title></Head>
      <main style={styles.page}>
        <header style={styles.header}>
          <div style={styles.bannerLeft}>
            <span style={styles.bannerIcon}>+</span>
            <div>
              <h1 style={styles.title}>Register New Job</h1>
              <p style={styles.subtitle}>
                Capture the client, job and land details before payment and estimate access.
              </p>
            </div>
          </div>
          <button type="button" style={styles.backButton} onClick={exitToHub}>Back to Projects Hub</button>
        </header>

        <form style={styles.formShell} onSubmit={confirmJob}>
          <Section title="Client Information">
            <Field label="Client name" value={form.clientName} onChange={(value) => updateField("clientName", value)} required />
            <Field label="Client email" type="email" value={form.clientEmail} onChange={(value) => updateField("clientEmail", value)} required />
            <Field label="Client phone" value={form.clientPhone} onChange={(value) => updateField("clientPhone", value)} />
            <Field label="Company / trading name" value={form.clientCompany} onChange={(value) => updateField("clientCompany", value)} />
          </Section>

          <Section title="Job Details">
            <Field label="Job #" value={form.jobNumber} onChange={(value) => updateField("jobNumber", value)} />
            <Field label="Job name" value={form.jobName} onChange={(value) => updateField("jobName", value)} required />
            <Field label="Job description" value={form.jobDescription} onChange={(value) => updateField("jobDescription", value)} required multiline />
          </Section>

          <Section title="Site Address">
            <Field label="Street address" value={form.siteAddress} onChange={(value) => updateField("siteAddress", value)} required wide />
            <Field label="Suburb" value={form.suburb} onChange={(value) => updateField("suburb", value)} required />
            <Field label="State" value={form.state} onChange={(value) => updateField("state", value)} required />
            <Field label="Postcode" value={form.postcode} onChange={(value) => updateField("postcode", value)} required />
          </Section>

          <Section title="Land Details">
            <Field label="Lot number" value={form.lotNumber} onChange={(value) => updateField("lotNumber", value)} />
            <Field label="Plan number" value={form.planNumber} onChange={(value) => updateField("planNumber", value)} />
            <Field label="RP / SP reference" placeholder="e.g. RP123456" value={form.rpNumber} onChange={(value) => updateField("rpNumber", value)} required />
            <Field label="Council / authority" value={form.council} onChange={(value) => updateField("council", value)} />
          </Section>

          <div style={styles.actionBar}>
            <div style={styles.actionNote}>
              {developerBypass
                ? "Developer testing account: Unlimited jobs available. No payment or credits required."
                : credits > 0
                ? `${credits} ${credits === 1 ? "credit" : "credits"} available. Confirming this job will use 1 credit.`
                : "No credits available. Complete the required fields to proceed to payment."}
            </div>
            <button type="submit" disabled={!requiredComplete || loading} style={requiredComplete && !loading ? styles.primaryButton : styles.primaryButtonDisabled}>
              {loading ? "Checking Account..." : developerBypass || credits > 0 ? "Confirm Job and Open Estimate" : "Proceed to Payment"}
            </button>
          </div>
        </form>
      </main>
    </>
  );
}

function Section({ title, children }) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.grid}>{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text", required = false, multiline = false, wide = false, placeholder = "" }) {
  const inputStyle = wide || multiline ? { ...styles.fieldWrap, gridColumn: "1 / -1" } : styles.fieldWrap;
  return (
    <label style={inputStyle}>
      <span style={styles.label}>{label}{required ? " *" : ""}</span>
      {multiline ? (
        <textarea
          style={{ ...styles.input, minHeight: 112, resize: "vertical" }}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          required={required}
        />
      ) : (
        <input
          style={styles.input}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          required={required}
        />
      )}
    </label>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    color: "#0f172a",
    padding: 18,
  },
  header: {
    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 16,
    padding: "24px 28px",
    margin: "0 auto 16px",
    width: "100%",
    maxWidth: 1320,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  bannerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 18,
  },
  bannerIcon: {
    width: 72,
    height: 72,
    borderRadius: 999,
    background: "rgba(255,255,255,0.16)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 1,
    flexShrink: 0,
  },
  title: { margin: 0, fontSize: 48, lineHeight: 1.1, fontWeight: 600, color: "#ffffff" },
  subtitle: { margin: "4px 0 0", color: "#ffffff", opacity: 0.92, fontSize: 18, maxWidth: 780, fontWeight: 500 },
  backButton: {
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 10,
    padding: "9px 18px",
    fontSize: 18,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  formShell: { display: "grid", gap: 16, maxWidth: 1120, margin: "0 auto" },
  section: {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: 18,
  },
  sectionTitle: { margin: "0 0 14px", fontSize: 20, color: "#0f172a" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 },
  fieldWrap: { display: "grid", gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "11px 12px",
    fontSize: 15,
    color: "#0f172a",
    background: "#ffffff",
    boxSizing: "border-box",
  },
  actionBar: {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: 16,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  actionNote: { color: "#475569", fontSize: 14 },
  primaryButton: {
    background: "#0f766e",
    color: "#ffffff",
    border: "1px solid #0f766e",
    borderRadius: 8,
    padding: "12px 16px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  primaryButtonDisabled: {
    background: "#94a3b8",
    color: "#ffffff",
    border: "1px solid #94a3b8",
    borderRadius: 8,
    padding: "12px 16px",
    fontWeight: 600,
    cursor: "not-allowed",
    whiteSpace: "nowrap",
  },
};
