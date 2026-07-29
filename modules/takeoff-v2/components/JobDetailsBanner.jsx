import { Ruler } from "lucide-react";
import JobFileMenu from "../../../components/estimate-builder/JobFileMenu.jsx";

// Read-only except for the File/Open Job control (fileMenu prop) — no plan/
// document/page/rotation/zoom/viewer state or handlers pass through here.
// Same appearance and wording as the approved Estimate Builder "Takeoff
// Engine" banner (components/estimate-builder/EstimateBuilderWorkbook.js
// styles.topbar and friends) so it reads as the same product, not a copy that
// can drift. The File control is the exact same JobFileMenu component/workflow
// Estimate Builder uses, not a V2-only picker.
export default function JobDetailsBanner({ projectName, jobNumber, projectAddress, fileName, fileMenu }) {
  return (
    <section style={S.topbar}>
      <div style={S.titleGroup}>
        <span style={S.icon}><Ruler size={34} strokeWidth={2.3} /></span>
        <span>
          <span style={S.eyebrow}>Estimate Builder</span>
          <h1 style={S.title}>Takeoff Engine</h1>
          <p style={S.subtitle}>Upload plans, measure areas, scale drawings and create takeoff quantities.</p>
        </span>
      </div>
      <div style={S.fileBanner}>
        <div style={S.fileBannerHeader}>
          <span style={S.fileLabel}>Current saved file</span>
          {fileMenu && <JobFileMenu {...fileMenu} />}
        </div>
        <span style={S.fileName}>{fileName}</span>
      </div>
      <div style={S.jobBanner}>
        <Field label="Open Job" value={projectName} />
        <Field label="Job #" value={jobNumber} />
        <Field label="Address" value={projectAddress} wide />
      </div>
    </section>
  );
}

function Field({ label, value, wide = false }) {
  return (
    <span style={{ ...S.field, ...(wide ? S.fieldWide : {}) }}>
      <span style={S.fieldLabel}>{label}</span>
      <strong style={S.fieldValue}>{value}</strong>
    </span>
  );
}

const S = {
  topbar: { position: "relative", zIndex: 1, border: "1px solid rgba(255,255,255,0.45)", borderRadius: 24, padding: "22px 24px", marginBottom: 0, display: "grid", gridTemplateColumns: "minmax(420px, 1fr) minmax(210px, 300px) minmax(360px, 0.95fr)", gap: 18, alignItems: "center", boxShadow: "0 28px 70px rgba(15, 23, 42, 0.18)", color: "#ffffff", background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)" },
  titleGroup: { display: "grid", gridTemplateColumns: "72px minmax(0, 1fr)", gap: 18, alignItems: "center", minWidth: 0 },
  icon: { width: 72, height: 72, borderRadius: 20, background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.24)", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22)" },
  eyebrow: { color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" },
  title: { margin: "1px 0 0", color: "#ffffff", fontSize: 48, lineHeight: 1.05, fontWeight: 600 },
  subtitle: { margin: "5px 0 0", color: "rgba(255,255,255,0.88)", fontSize: 18, lineHeight: 1.35, fontWeight: 650 },
  fileBanner: { justifySelf: "stretch", minWidth: 0, textAlign: "left", border: "1px solid rgba(255,255,255,0.28)", background: "rgba(255,255,255,0.18)", borderRadius: 18, padding: "13px 14px", backdropFilter: "blur(14px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)" },
  fileBannerHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 2 },
  fileLabel: { display: "block", color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" },
  fileName: { display: "block", color: "#ffffff", fontSize: 18, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  jobBanner: { minWidth: 0, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 },
  field: { minWidth: 0, border: "1px solid rgba(255,255,255,0.28)", background: "rgba(255,255,255,0.16)", borderRadius: 14, padding: "10px 12px", display: "grid", gap: 3, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)" },
  fieldWide: { gridColumn: "1 / -1" },
  fieldLabel: { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: 950, letterSpacing: "0.08em", textTransform: "uppercase" },
  fieldValue: { color: "#ffffff", fontSize: 16, lineHeight: 1.25, fontWeight: 900, overflowWrap: "anywhere" },
};
