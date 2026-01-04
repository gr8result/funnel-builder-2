import { useEffect, useState } from "react";
import { listUserTemplates, loadTemplate, saveTemplate } from "../lib/supabaseFiles";

export default function FileMenu({ userId, exportHtmlToString, onLoad }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  async function refresh() {
    try {
      const list = await listUserTemplates(userId);
      setFiles(list.map((f) => f.name));
    } catch (e) {
      setStatus("List error: " + e.message);
    }
  }

  const openFile = async (fn) => {
    try {
      const html = await loadTemplate(userId, fn);
      onLoad(html);
      setOpen(false);
    } catch (e) {
      setStatus("Load fail: " + e.message);
    }
  };

  const saveAs = async () => {
    if (!name) return setStatus("Enter a filename");
    try {
      const html = exportHtmlToString();
      await saveTemplate(userId, name, html);
      setStatus("Saved!");
      refresh();
    } catch (e) {
      setStatus("Save fail: " + e.message);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)}>📁 File</button>
      {open && (
        <div className="modal">
          <h2>Open / Save Templates</h2>

          <div>
            <strong>Existing</strong>
            <ul>
              {files.map((fn) => (
                <li key={fn}>
                  <button onClick={() => openFile(fn)}>{fn}</button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <input
              type="text"
              placeholder="filename.html"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button onClick={saveAs}>💾 Save As</button>
          </div>

          {status && <div>{status}</div>}

          <button onClick={() => setOpen(false)}>Close</button>
        </div>
      )}
    </>
  );
}
