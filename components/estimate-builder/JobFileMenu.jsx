// Shared "File" dropdown for opening/saving a .gr8job estimate/job file — used
// by both the Estimate Builder workbook and Takeoff Engine V2's job-details
// banner, so there is exactly one File/Open Job workflow, not a V2-only copy.
// Purely controlled/presentational: all job-file I/O lives in hooks/useJobFile.js
// + lib/jobFile.ts, which this only calls through the props passed in.
function formatRecentJobDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

export default function JobFileMenu({ open, items, recentJobs = [], onOpenRecentJob, onToggle, onClose, busy = false }) {
  return (
    <div style={S.wrap}>
      <button style={S.button} onClick={onToggle} disabled={busy} aria-haspopup="menu" aria-expanded={open} data-testid="job-file-menu-button">
        {busy ? "Saving..." : "File"}
      </button>
      {open && (
        <div style={S.menu} role="menu" data-testid="job-file-menu">
          {items.map((item) => (
            <button
              key={item.label}
              style={{ ...S.item, ...(item.primary ? S.itemPrimary : {}), ...(busy ? S.itemDisabled : {}) }}
              disabled={busy}
              onClick={async () => {
                await Promise.resolve(item.action());
                onClose();
              }}
              role="menuitem"
            >
              {busy && item.primary ? "Saving..." : item.label}
            </button>
          ))}
          <div style={S.divider} />
          <div style={S.sectionTitle}>Recent Jobs</div>
          {recentJobs.length ? recentJobs.slice(0, 4).map((job) => (
            <button
              key={job.id}
              style={{ ...S.item, ...S.recentItem, ...(busy ? S.itemDisabled : {}) }}
              disabled={busy}
              onClick={async () => {
                await Promise.resolve(onOpenRecentJob?.(job.id));
                onClose();
              }}
              role="menuitem"
            >
              <span>{job.jobName || "Saved estimate job"}</span>
              <small>{formatRecentJobDate(job.lastModified)}</small>
            </button>
          )) : (
            <div style={S.empty}>No recent jobs</div>
          )}
        </div>
      )}
    </div>
  );
}

const S = {
  wrap: { position: "relative", display: "inline-flex" },
  button: { background: "#0f766e", color: "#ffffff", border: "1px solid #0f766e", borderRadius: 12, padding: "9px 14px", fontWeight: 900, cursor: "pointer", minWidth: 76, boxShadow: "0 8px 18px rgba(15, 118, 110, 0.18)" },
  menu: { position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20, minWidth: 190, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8, boxShadow: "0 16px 35px rgba(15, 23, 42, 0.16)", padding: 6 },
  item: { width: "100%", background: "#ffffff", color: "#0f172a", border: 0, borderRadius: 6, padding: "9px 10px", textAlign: "left", fontWeight: 600, cursor: "pointer" },
  itemPrimary: { background: "#ecfdf5", color: "#0f766e" },
  itemDisabled: { opacity: 0.55, cursor: "wait" },
  divider: { height: 1, background: "#dbe4ef", margin: "6px 0" },
  sectionTitle: { padding: "6px 10px 4px", color: "#64748b", fontSize: 11, fontWeight: 900, letterSpacing: "0.05em", textTransform: "uppercase" },
  recentItem: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, lineHeight: 1.25 },
  empty: { padding: "8px 10px", color: "#64748b", fontSize: 12, fontWeight: 700 },
};
