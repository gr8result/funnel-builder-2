// SELECTIONS REQUIRING YOUR ATTENTION: every outstanding action, grouped, each with what is wrong,
// what it affects, what to do and a button that goes there (lib/builders/selectionAttention.js).
// Readable text is never below 16px.
import { useState } from "react";

export default function SelectionAttentionPanel({ attention, onAction }) {
  const [openGroups, setOpenGroups] = useState({});
  if (!attention) return null;
  const { groups, total, blocking, completion, readiness } = attention;
  return (
    <section className="sap-panel" aria-label="Selections requiring your attention" data-testid="selection-attention" data-attention-total={total} data-attention-blocking={blocking}>
      <style>{ATTENTION_CSS}</style>
      <header>
        <div className="sap-heading">
          <h3>REVIEW &amp; PREVIEW READINESS</h3>
          <p>Client choices, template pricing and final contract approval are tracked separately.</p>
        </div>
        <div className="sap-indicators">
          <span className={completion.complete ? "ok" : "todo"} data-testid="attention-completion">{completion.complete ? "All client decisions made" : `${completion.outstandingDecisions} client decision${completion.outstandingDecisions === 1 ? "" : "s"} outstanding`}</span>
          <span className="ok" data-testid="attention-draft">Draft schedule available</span>
          <span className={readiness.ready ? "ok" : "todo"} data-testid="attention-readiness">{readiness.ready ? "Ready for final contract issue" : `${readiness.blockingItems} requirement${readiness.blockingItems === 1 ? "" : "s"} remain before final contract issue`}</span>
        </div>
      </header>
      {total === 0 ? <p className="sap-clear">Nothing needs your attention.</p> : groups.map((group) => {
        const open = openGroups[group.key] ?? ["decisions", "contract"].includes(group.key);
        return (
          <div key={group.key} className="sap-group" data-testid="attention-group" data-group={group.key}>
            <button type="button" className="sap-groupHead" aria-expanded={open} onClick={() => setOpenGroups({ ...openGroups, [group.key]: !open })}>
              <span>{open ? "▼" : "▶"} {group.title}</span>
              <span className="sap-groupMeta">{group.key === "pricing" ? `${attention.pricing.template} template estimates · ${attention.pricing.builder} builder overrides · ${attention.pricing.missing} price required` : null}<b>{group.items.length}</b></span>
            </button>
            {open ? (
              <ul>
                {group.items.map((item) => (
                  <li key={item.id} data-testid="attention-item" data-blocking={item.blocking ? "true" : "false"}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                      {item.status ? <em className={`sap-status ${item.statusTone || ""}`}>{item.status}</em> : null}
                      {group.key === "contract" && item.status ? null : <em className={item.blocking ? "blocks" : "advice"}>{item.blocking ? "Required before final contract issue" : group.key === "pricing" && item.statusTone === "missing" ? "Price required before final contract issue — draft schedule allowed" : group.key === "pricing" ? "Indicative only — draft schedule allowed" : "Does not block draft schedule"}</em>}
                    </div>
                    <button type="button" className="sap-action" onClick={() => onAction?.(item.action, item)} data-testid="attention-action" data-action-kind={item.action.kind}>{item.action.label}</button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

const ATTENTION_CSS = `
.sap-panel { grid-column: 1 / -1; border: 1px solid #d7deea; border-radius: 10px; background: #fff; padding: 16px; display: grid; gap: 12px; font-size: 16px; color: #0f172a; }
.sap-panel header { display: flex; justify-content: space-between; gap: 14px; align-items: center; flex-wrap: wrap; }
.sap-heading { display: grid; gap: 4px; }
.sap-panel h3 { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: .02em; }
.sap-heading p { margin: 0; color: #475569; font-weight: 650; }
.sap-indicators { display: flex; gap: 10px; flex-wrap: wrap; }
.sap-indicators span { font-size: 16px; font-weight: 800; padding: 6px 12px; border-radius: 999px; }
.sap-indicators .ok { background: #dcfce7; color: #14532d; } .sap-indicators .todo { background: #fef3c7; color: #78350f; }
.sap-clear { margin: 0; color: #14532d; font-weight: 700; }
.sap-group { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
.sap-groupHead { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 10px 14px; background: #f1f5f9; border: 0; font-size: 17px; line-height: 1.3; font-weight: 900; color: #0f172a; cursor: pointer; text-align: left; }
.sap-groupHead > span:first-child { min-width: 0; overflow-wrap: anywhere; }
.sap-groupMeta { width: 100%; min-width: 0; display: flex; align-items: center; gap: 8px 10px; flex-wrap: wrap; color: #475569; font-size: 16px; line-height: 1.35; overflow-wrap: anywhere; }
.sap-groupHead b { flex: 0 0 auto; margin-left: auto; font-size: 16px; background: #0f172a; color: #fff; border-radius: 999px; padding: 2px 10px; }
.sap-group ul { list-style: none; margin: 0; padding: 0; }
.sap-group li { display: flex; justify-content: space-between; gap: 14px; align-items: center; padding: 12px 14px; border-top: 1px solid #e2e8f0; flex-wrap: wrap; }
.sap-group li > div { display: grid; gap: 3px; flex: 1 1 420px; min-width: 0; }
.sap-group li strong { font-size: 17px; font-weight: 900; } .sap-group li span { font-size: 16px; color: #334155; }
.sap-group li em { font-size: 16px; font-style: normal; font-weight: 800; } .sap-group li em.blocks { color: #b91c1c; } .sap-group li em.advice { color: #475569; }
.sap-status { width: fit-content; padding: 4px 9px; border-radius: 999px; background: #e0f2fe; color: #075985; }
.sap-status.template { background: #ecfeff; color: #155e75; }
.sap-status.builder { background: #ede9fe; color: #5b21b6; }
.sap-status.missing { background: #fee2e2; color: #991b1b; }
.sap-status.contract { background: #fef3c7; color: #92400e; }
.sap-action { min-height: 44px; padding: 8px 18px; border-radius: 10px; border: 0; background: #0f766e; color: #fff; font-size: 16px; font-weight: 900; letter-spacing: .03em; cursor: pointer; white-space: nowrap; }
`;
