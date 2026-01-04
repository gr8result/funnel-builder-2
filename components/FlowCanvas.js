import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

const FlowCanvas = ({
  nodes,
  edges,
  setNodes,
  setEdges,
  onNodeClick,
}) => {
  const [rfNodes, updateNodes, onNodesChange] = useNodesState(nodes);
  const [rfEdges, updateEdges, onEdgesChange] = useEdgesState(edges);

  const onConnect = (params) => {
    updateEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#f97316' } }, eds));
  };

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={(_, node) => onNodeClick(node)}
      fitView
      style={{ background: '#0c121a', borderRadius: 12 }}
    >
      <MiniMap
        nodeStrokeColor="#f97316"
        nodeColor="#1a1f29"
        maskColor="rgba(255,255,255,0.1)"
      />
      <Controls />
      <Background color="#333" gap={18} />
    </ReactFlow>
  );
};

export default FlowCanvas;
