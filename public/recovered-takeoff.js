const status = document.querySelector('#status');
const endpoint = new URL(location.href).searchParams.get('bridge');
if (endpoint) {
  try {
    status.textContent = 'Exporting job:03-09/123 directly from IndexedDB. Please keep this tab open.';
    await new Promise((resolve, reject) => {
      const worker = new Worker('/takeoff-recovery-worker.js');
      worker.onmessage = ({data}) => {
        if(data.type === 'done' || data.type === 'error') {worker.terminate(); data.type === 'done' ? resolve(data) : reject(new Error(data.message));}
      };
      worker.onerror = e => {worker.terminate(); reject(new Error(e.message));};
      worker.postMessage({action:'export',key:'job:03-09/123',endpoint:endpoint+'/export'});
    });
    status.textContent = 'Export complete. Parsing the saved record offline…';
    await fetch(endpoint+'/complete',{method:'POST'});
  } catch(e) { status.textContent = e.message; }
}
