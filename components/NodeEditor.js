import React from 'react';

const NodeEditor = ({ node, onChange }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange({ ...node, data: { ...node.data, [name]: value } });
  };

  if (!node) return <div style={{ padding: 10 }}>Select a node to edit</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3>{node?.data?.label || 'Edit Node'}</h3>

      <label>Label</label>
      <input
        name="label"
        value={node.data.label || ''}
        onChange={handleChange}
      />

      {node.type === 'email' && (
        <>
          <label>Template ID</label>
          <input
            name="templateId"
            value={node.data.templateId || ''}
            onChange={handleChange}
          />
        </>
      )}

      {node.type === 'delay' && (
        <>
          <label>Delay (ms)</label>
          <input
            type="number"
            name="delay"
            value={node.data.delay || 0}
            onChange={handleChange}
          />
        </>
      )}

      {node.type === 'condition' && (
        <>
          <label>Condition</label>
          <select
            name="condition"
            value={node.data.condition || ''}
            onChange={handleChange}
          >
            <option value="opened_email">Opened Email</option>
            <option value="clicked_link">Clicked Link</option>
            <option value="purchased">Made Purchase</option>
          </select>
        </>
      )}
    </div>
  );
};

export default NodeEditor;
