import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { money } from "../../lib/product-library/helpers";

// Right-pane running summary — collapsible, per the brief. Client-visible:
// no builder cost/margin figures, only allowance/upgrade/credit and the net
// client variation.
export default function RunningSelectionsSummary({
  completedCount,
  totalCount,
  requiredMissingCount,
  totalUpgrades,
  totalCredits,
  netVariation,
  collapsed,
  onToggleCollapsed,
  onSaveProgress,
  onFinalise,
  onGenerateSchedule,
  onPrepareQuoteUpdate,
  saving,
  finalised,
}) {
  const progressPercent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  if (collapsed) {
    return (
      <button type="button" className="collapsedTab" onClick={onToggleCollapsed} aria-label="Expand selections summary">
        <PanelRightOpen size={16} />
        <span>{progressPercent}%</span>
        <style jsx>{`
          .collapsedTab { display: grid; justify-items: center; gap: 6px; background: #0b1626; border: 1px solid rgba(148,163,184,0.25); border-radius: 10px; color: #e5eefb; padding: 10px 6px; cursor: pointer; height: 100%; }
        `}</style>
      </button>
    );
  }

  return (
    <aside className="summary">
      <div className="header">
        <h3>Project Selections</h3>
        <button type="button" className="collapseButton" onClick={onToggleCollapsed} aria-label="Collapse summary"><PanelRightClose size={16} /></button>
      </div>

      <div className="progress">
        <div className="bar"><div className="fill" style={{ width: `${progressPercent}%` }} /></div>
        <span>{completedCount} / {totalCount} selections complete ({progressPercent}%)</span>
        {requiredMissingCount > 0 && <span className="warn">{requiredMissingCount} required selection{requiredMissingCount === 1 ? "" : "s"} still missing</span>}
      </div>

      <dl className="totals">
        <dt>Total upgrades</dt><dd className="upgrade">{money(totalUpgrades)}</dd>
        <dt>Total credits</dt><dd className="credit">{money(-Math.abs(totalCredits))}</dd>
        <dt>Net variation</dt><dd className="net">{money(netVariation)}</dd>
      </dl>

      <div className="actions">
        <button type="button" onClick={onSaveProgress} disabled={saving}>{saving ? "Saving..." : "Save Progress"}</button>
        <button type="button" className="ghost" onClick={onGenerateSchedule}>Generate Inclusions Schedule</button>
        <button type="button" className="ghost" onClick={onPrepareQuoteUpdate}>Prepare Quote Update</button>
        <button type="button" className="primary" onClick={onFinalise} disabled={finalised}>
          {finalised ? "Selections Finalised" : "Finalise Client Selections"}
        </button>
      </div>

      <style jsx>{`
        .summary { display: grid; gap: 16px; align-content: start; height: 100%; overflow-y: auto; color: #e5eefb; }
        .header { display: flex; justify-content: space-between; align-items: center; }
        .header h3 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; color: #93a4bd; }
        .collapseButton, .collapsedTab { background: transparent; border: 1px solid rgba(148,163,184,0.3); border-radius: 6px; color: #cbd5e1; width: 28px; height: 28px; display: grid; place-items: center; cursor: pointer; }
        .progress { display: grid; gap: 6px; font-size: 12px; color: #93a4bd; }
        .bar { height: 8px; border-radius: 999px; background: rgba(148,163,184,0.2); overflow: hidden; }
        .fill { height: 100%; background: #22c55e; transition: width 0.2s ease; }
        .warn { color: #f59e0b; font-weight: 700; }
        .totals { display: grid; gap: 6px; margin: 0; padding: 12px; border-radius: 10px; background: rgba(15,23,42,0.6); border: 1px solid rgba(148,163,184,0.2); }
        .totals dt { font-size: 11px; color: #93a4bd; }
        .totals dd { margin: 0 0 6px; font-size: 16px; font-weight: 800; }
        .totals dd.upgrade { color: #f59e0b; }
        .totals dd.credit { color: #4ade80; }
        .totals dd.net { color: #7dd3fc; font-size: 20px; }
        .actions { display: grid; gap: 8px; }
        .actions button { border: 0; border-radius: 8px; padding: 10px; font-weight: 800; cursor: pointer; background: #2563eb; color: #fff; }
        .actions button.ghost { background: transparent; border: 1px solid rgba(148,163,184,0.35); color: #e5eefb; }
        .actions button.primary { background: #16a34a; }
        .actions button:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </aside>
  );
}
