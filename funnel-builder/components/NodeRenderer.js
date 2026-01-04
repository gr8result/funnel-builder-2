import React from 'react';

const NodeRenderer = ({ data }) => {
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
    </div>
  );
};

export default NodeRenderer;
