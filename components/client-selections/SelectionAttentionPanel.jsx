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
        <h3>SELECTIONS REQUIRING YOUR ATTENTION</h3>
        <div className="sap-indicators">
          <span className={completion.complete ? "ok" : "todo"} data-testid="attention-completion">{completion.complete ? "All client decisions made" : `${completion.outstandingDecisions} client decision${completion.outstandingDecisions === 1 ? "" : "s"} outstanding`}</span>
          <span className={readiness.ready ? "ok" : "todo"} data-testid="attention-readiness">{readiness.ready ? "Ready to issue" : `${readiness.blockingItems} item${readiness.blockingItems === 1 ? "" : "s"} block final approval`}</span>
        </div>
      </header>
      {total === 0 ? <p className="sap-clear">Nothing needs your attention.</p> : groups.map((group) => {
        const open = openGroups[group.key] ?? true;
        return (
          <div key={group.key} className="sap-group" data-testid="attention-group" data-group={group.key}>
            <button type="button" className="sap-groupHead" aria-expanded={open} onClick={() => setOpenGroups({ ...openGroups, [group.key]: !open })}>
              <span>{open ? "▼" : "▶"} {group.title}</span><b>{group.items.length}</b>
            </button>
            {open ? (
              <ul>
                {group.items.map((item) => (
                  <li key={item.id} data-testid="attention-item" data-blocking={item.blocking ? "true" : "false"}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                      <em className={item.blocking ? "blocks" : "advice"}>{item.blocking ? "Blocks final approval" : "Does not block final approval"}</em>
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
.sap-panel h3 { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: .02em; }
.sap-indicators { display: flex; gap: 10px; flex-wrap: wrap; }
.sap-indicators span { font-size: 16px; font-weight: 800; padding: 6px 12px; border-radius: 999px; }
.sap-indicators .ok { background: #dcfce7; color: #14532d; } .sap-indicators .todo { background: #fef3c7; color: #78350f; }
.sap-clear { margin: 0; color: #14532d; font-weight: 700; }
.sap-group { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
.sap-groupHead { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 14px; background: #f1f5f9; border: 0; font-size: 17px; font-weight: 900; color: #0f172a; cursor: pointer; text-align: left; }
.sap-groupHead b { font-size: 16px; background: #0f172a; color: #fff; border-radius: 999px; padding: 2px 10px; }
.sap-group ul { list-style: none; margin: 0; padding: 0; }
.sap-group li { display: flex; justify-content: space-between; gap: 14px; align-items: center; padding: 12px 14px; border-top: 1px solid #e2e8f0; flex-wrap: wrap; }
.sap-group li > div { display: grid; gap: 3px; flex: 1 1 420px; min-width: 0; }
.sap-group li strong { font-size: 17px; font-weight: 900; } .sap-group li span { font-size: 16px; color: #334155; }
.sap-group li em { font-size: 16px; font-style: normal; font-weight: 800; } .sap-group li em.blocks { color: #b91c1c; } .sap-group li em.advice { color: #475569; }
.sap-action { min-height: 44px; padding: 8px 18px; border-radius: 10px; border: 0; background: #0f766e; color: #fff; font-size: 16px; font-weight: 900; letter-spacing: .03em; cursor: pointer; white-space: nowrap; }
`;
