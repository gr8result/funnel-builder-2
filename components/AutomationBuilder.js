import { useState, useEffect } from 'react';
import FlowCanvas from './FlowCanvas';
import NodeEditor from './NodeEditor';

const AutomationBuilder = () => {
  const [nodes, setNodes] = useState([]);
  const [nodeStats, setNodeStats] = useState({});

  useEffect(() => {
    const flowId = 'WAS_FLOW_6'; // TODO: dynamically set this
    fetch(`/api/automation/node-stats?flowId=${flowId}`)
      .then(r => r.json())
      .then(res => {
        if (res.ok) {
          const statsMap = {};
          for (const s of res.data) statsMap[s.node_id] = s;
          setNodeStats(statsMap);
        }
      });
  }, []);

  const nodesWithStats = nodes.map(n =>
    ['email', 'trigger', 'condition', 'delay'].includes(n.type)
      ? { ...n, data: { ...n.data, stats: nodeStats[n.id] || {} } }
      : n
  );
  const [edges, setEdges] = useState([]);
  const [selected, setSelected] = useState(null);

  const addNode = (type) => {
    const id = `${Date.now()}`;
    const defaults = {
      trigger: { label: 'Start Trigger', type },
      email: { label: 'Send Email', type, templateId: '' },
      delay: { label: 'Delay', type, delay: 1000 },
      condition: { label: 'Condition', type, condition: 'opened_email' },
      end: { label: 'End', type },
    };

    const data = defaults[type] || { label: 'New Node', type };

    setNodes((nds) => [
      ...nds,
      {
        id,
        type,
        data,
        position: { x: Math.random() * 250, y: Math.random() * 150 },
      },
    ]);
  };

  const updateNode = (updated) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === updated.id ? updated : n))
    );
  };

  return (
    <div style={{ display: 'flex', gap: 12, padding: 20 }}>
      <div style={{ width: 200 }}>
        <h4>Blocks</h4>
        <button onClick={() => addNode('trigger')}>Trigger</button>
        <button onClick={() => addNode('email')}>Email</button>
        <button onClick={() => addNode('delay')}>Delay</button>
        <button onClick={() => addNode('condition')}>Condition</button>
        <button onClick={() => addNode('end')}>End</button>
        <button style={{ marginTop: 16, background: '#6366f1', color: '#fff', fontWeight: 600 }}
          onClick={async () => {
            const flowId = 'WAS_FLOW_6'; // TODO: dynamically set this
            const resp = await fetch('/api/automation/reset-node-stats', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ flowId })
            });
            const result = await resp.json();
            if (result.ok) {
              // Force-refresh node stats
              fetch(`/api/automation/node-stats?flowId=${flowId}`)
                .then(r => r.json())
                .then(res => {
                  if (res.ok) {
                    const statsMap = {};
                    for (const s of res.data) statsMap[s.node_id] = s;
                    setNodeStats(statsMap);
                  }
                });
            } else {
              alert('Failed to reset node stats: ' + (result.error || 'Unknown error'));
            }
          }}>
          Reset Flow
        </button>
      </div>

      <div style={{ flex: 1 }}>
        <FlowCanvas
          nodes={nodesWithStats}
          edges={edges}
          setNodes={setNodes}
          setEdges={setEdges}
          onNodeClick={(n) => setSelected(n)}
        />
      </div>

      <div style={{ width: 250 }}>
        <NodeEditor node={selected} onChange={updateNode} />
      </div>
    </div>
  );
};

export default AutomationBuilder;
