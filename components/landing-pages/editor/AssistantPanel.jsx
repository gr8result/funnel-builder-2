// One prompt creates one complete working draft. The saved page is untouched until the user keeps the batch.

import { useState } from 'react';
import s from './editor.module.css';

const EXAMPLES = [
  'Make this page more professional, improve the wording, remove incomplete content and make the mobile layout work well.',
  'Replace repeated photographs, make the services section four cards wide and add a section explaining our process.',
];

export default function AssistantPanel({ ask, proposal, onKeep, onUndoAll, busy, selectedLabel }) {
  const [text, setText] = useState('');
  async function send(instruction) {
    const value = (instruction || text).trim();
    if (!value) return;
    await ask(value);
  }
  return (
    <div className={s.section}>
      <p className={s.h}>AI page editor</p>
      <p className={s.hint} style={{ marginTop: -6, marginBottom: 12 }}>
        Describe every change you want in one message. The AI updates one working draft for you to inspect.
        {selectedLabel ? <> Your selected section is <b style={{ color: '#fff' }}>{selectedLabel}</b>.</> : null}
      </p>
      {proposal ? (
        <div className={s.msgAi} data-testid="ai-proposal">
          <b>{proposal.summary}</b>
          {proposal.outcomes?.length ? (
            <ul className={s.changes}>
              {proposal.outcomes.map((item, index) => <li key={index}>{item.complete ? 'Completed: ' : 'Not completed: '}{item.label}</li>)}
            </ul>
          ) : <ul className={s.changes}>{proposal.changes.map((change, index) => <li key={index}>{change.label}</li>)}</ul>}
          {proposal.issues?.length ? (
            <div role="alert" style={{ marginTop: 10 }}>
              <b style={{ color: '#fde68a' }}>Needs attention</b>
              <ul className={s.changes} style={{ color: '#fde68a' }}>{proposal.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>
            </div>
          ) : null}
          {proposal.warnings?.length ? <ul className={s.changes} style={{ color: '#cbd5e1' }}>{proposal.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul> : null}
          <p className={s.hint}>The canvas is showing the complete working draft. The saved page has not changed.</p>
          <div className={s.inline} style={{ marginTop: 12 }}>
            <button type="button" className={`${s.btn} ${s.primary}`} onClick={onKeep} data-testid="ai-accept">Keep Changes</button>
            <button type="button" className={s.btn} onClick={onUndoAll}>Undo All Changes</button>
          </div>
        </div>
      ) : (
        <>
          <textarea className={s.textarea} style={{ marginTop: 12, minHeight: 180, resize: 'vertical' }} value={text} onChange={(event) => setText(event.target.value)} placeholder="Describe all the text, image, layout, section, form and mobile changes you want…" data-testid="ai-input" aria-label="Changes for the AI page editor" />
          {busy ? <div className={s.msgAi} role="status" aria-live="polite" style={{ marginTop: 10 }}>Updating all requested parts of your landing page…</div> : null}
          <button type="button" className={`${s.btn} ${s.primary}`} style={{ width: '100%', marginTop: 8 }} disabled={busy || !text.trim()} onClick={() => send()}>{busy ? 'Applying Changes…' : 'Apply Changes'}</button>
          <div className={s.chips} style={{ marginTop: 12 }}>{EXAMPLES.map((e) => <button type="button" key={e} className={s.chip} disabled={busy} onClick={() => send(e)}>{e}</button>)}</div>
        </>
      )}
    </div>
  );
}
