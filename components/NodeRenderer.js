import React from 'react';

const NodeRenderer = ({ data, id }) => {
  const handleClick = () => {
    if (data.onNodeClick) {
      data.onNodeClick(id, data);
    }
  };

  const getNodeColor = (type) => {
    if (type?.includes('trigger')) return '#10b981';
    if (type?.includes('email')) return '#f97316';
    if (type?.includes('delay')) return '#8b5cf6';
    if (type?.includes('condition')) return '#f59e0b';
    return '#6b7280';
  };

  const borderColor = getNodeColor(data.type);

  return (
    <div 
      onClick={handleClick}
      style={{
        background: '#1a1f29',
        border: `2px solid ${borderColor}`,
        borderRadius: 8,
        padding: 8,
        color: '#fff',
        minWidth: 120,
        textAlign: 'center',
        cursor: data.onNodeClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        if (data.onNodeClick) {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.4)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <strong>{data.label}</strong>
      {data.stats && (
        <div style={{ fontSize: 11, marginTop: 4, color: '#9ca3af' }}>
          {data.stats.active > 0 && `${data.stats.active} active`}
        </div>
      )}
    </div>
  );
};

export default NodeRenderer;
