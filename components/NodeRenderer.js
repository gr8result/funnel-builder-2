import React from 'react';

const NodeRenderer = ({ data }) => {
  const isTrigger = (data.type || '').toLowerCase().includes('trigger');
  return (
    <div style={{
      background: '#1a1f29',
      border: '2px solid #f97316',
      borderRadius: 8,
      padding: 8,
      color: '#fff',
      minWidth: 120,
      textAlign: 'center'
    }}>
      <strong>{data.label}</strong>
      {/* Only show passed for non-trigger nodes (case-insensitive, substring match) */}
      {!isTrigger && data.stats && (
        <div>Passed: {data.stats.passed}</div>
      )}
      {/* For trigger nodes, only show Active elsewhere, not here */}
    </div>
  );
};

export default NodeRenderer;
