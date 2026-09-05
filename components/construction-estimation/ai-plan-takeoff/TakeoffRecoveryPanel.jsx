import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';

export default function TakeoffRecoveryPanel() {
  const worker = useRef(null);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('Reading record keys and metadata catalog…');
  const [busy, setBusy] = useState(true);
  function createWorker() {
    const w = new Worker('/takeoff-recovery-worker.js');
    worker.current = w;
    w.onmessage = ({ data }) => {
      if (data.type === 'metadata') setRows(old => old.some(row => row.id === data.row.id) ? old.map(row => row.id === data.row.id ? data.row : row) : [...old, data.row]);
      if (data.type === 'done' || data.type === 'error') {
        setBusy(false);
        setStatus(data.message);
        w.terminate();
        if (worker.current === w) worker.current = null;
      }
    };
    w.onerror = e => { setStatus(e.message); setBusy(false); w.terminate(); worker.current = null; };
    return w;
  }
  useEffect(() => {
    const w = createWorker();
    w.postMessage({ action: 'list', prefix: 'job:03-09/123' });
    return () => { worker.current?.terminate(); worker.current = null; };
  }, []);
  function inspectRecord(row) {
    setBusy(true);
    setStatus(`Inspecting only ${row.id} in an isolated worker…`);
    createWorker().postMessage({ action: 'inspect', key: row.id });
  }
  async function exportRecord(row) {
    try {
      if (!window.showSaveFilePicker) throw new Error('Use Chrome with Save File access for streaming export.');
      const handle = await window.showSaveFilePicker({ suggestedName: `${row.id.replace(/[^a-z0-9.-]/gi, '_')}.raw.json` });
      setBusy(true);
      setStatus(`Exporting ${row.id} directly to disk…`);
      createWorker().postMessage({ action: 'export', key: row.id, handle });
    } catch (error) { setStatus(error.message); }
  }
  return <main data-takeoff-safe-mode style={{ padding: 24, fontFamily: 'sans-serif' }}>
    <Head><title>Takeoff Recovery Safe Mode</title></Head>
    <h1>Takeoff recovery safe mode</h1>
    <p><a href="/modules/estimate-builder?page=aiPlanTakeoff">Back to Plan Takeoff</a></p>
    <p>Automatic recovery is disabled. Original records are preserved. Exports must be independently verified before storage migration.</p>
    <p role="status">{status}</p>
    <p>Target: New Job 03/09 · job:03-09/123. Opening this panel reads only keys and a separate metadata catalog. Unknown legacy fields require individual inspection. Catalog values reflect the last inspection. Bytes measure the raw JSON export, not IndexedDB compression.</p>
    <table cellPadding="8"><thead><tr>{['Record ID', 'Project ID', 'Name', 'Saved time', 'Revision', 'Pages', 'Bytes', 'Backup'].map(x => <th key={x}>{x}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}>
        <td>{row.id}</td><td>{row.projectId}</td><td>{row.name || 'Unknown'}</td><td>{row.savedAt || 'Unknown'}</td><td>{row.revision ?? 'Unknown'}</td><td>{row.pageCount ?? 'Unknown'}</td><td>{row.byteSize ?? 'Unknown'}</td>
        <td><button disabled={busy} onClick={() => inspectRecord(row)}>Inspect Metadata</button> <button disabled={busy} onClick={() => exportRecord(row)}>Export Raw Record</button></td>
      </tr>)}</tbody>
    </table>
  </main>;
}
