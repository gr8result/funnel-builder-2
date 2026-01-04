// /components/RichText.js
// Tiny contenteditable with basic formatting (no external libs)

import { useEffect, useRef } from 'react';

export default function RichText({ value = '', onChange, placeholder = 'Type…' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  function exec(cmd, arg) {
    document.execCommand(cmd, false, arg);
    ref.current && onChange && onChange(ref.current.innerHTML);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <button type="button" onClick={() => exec('bold')} style={tb}>B</button>
        <button type="button" onClick={() => exec('italic')} style={tb}><i>I</i></button>
        <button type="button" onClick={() => exec('underline')} style={tb}><u>U</u></button>
        <button type="button" onClick={() => exec('justifyLeft')} style={tb}>⟸</button>
        <button type="button" onClick={() => exec('justifyCenter')} style={tb}>⇔</button>
        <button type="button" onClick={() => exec('justifyRight')} style={tb}>⟹</button>
        <select onChange={(e) => exec('fontSize', e.target.value)} defaultValue="3" style={sel}>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="4">Large</option>
          <option value="5">XL</option>
        </select>
        <input type="color" onChange={(e) => exec('foreColor', e.target.value)} title="Text colour" />
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange && onChange(e.currentTarget.innerHTML)}
        style={rt}
        data-placeholder={placeholder}
      />
    </div>
  );
}

const tb = {
  background: '#1f2937',
  color: '#eaeaea',
  border: '1px solid #2a3242',
  borderRadius: 6,
  padding: '4px 8px',
  cursor: 'pointer',
};
const sel = { background: '#141821', color: '#eaeaea', border: '1px solid #2a3242', borderRadius: 6 };
const rt = {
  minHeight: 90,
  padding: 10,
  border: '1px solid #2a3242',
  borderRadius: 6,
  background: '#141821',
  color: '#eaeaea',
  outline: 'none',
};
