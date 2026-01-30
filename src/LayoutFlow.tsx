import { useMemo, useState } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";

const NODE_WIDTH = 172;
const NODE_HEIGHT = 36;

const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

// Generate nodes: 1 root + 150 child nodes
const generateNodes = (): Node[] => {
  const nodes: Node[] = [
    {
      id: "root",
      position: { x: 0, y: 0 },
      data: { label: "Root Node" },
      style: { background: "#f0f0f0", border: "2px solid #333" },
    },
  ];

  // Generate 150 child nodes
  for (let i = 1; i <= 150; i++) {
    nodes.push({
      id: `node-${i}`,
      position: { x: 0, y: 0 },
      data: { label: `Node ${i}` },
    });
  }

  return nodes;
};

// Generate edges: connect root to all 150 nodes
const generateEdges = (): Edge[] => {
  const edges: Edge[] = [];

  for (let i = 1; i <= 150; i++) {
    edges.push({
      id: `edge-root-node-${i}`,
      source: "root",
      target: `node-${i}`,
      type: "smoothstep",
    });
  }

  return edges;
};

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "TB") => {
  const isHorizontal = direction === "LR";

  dagreGraph.setGraph({ rankdir: direction, ranksep: 50, nodesep: 20 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

function LayoutFlow() {
  const initialData = useMemo(() => {
    const initialNodes = generateNodes();
    const initialEdges = generateEdges();
    return getLayoutedElements(initialNodes, initialEdges);
  }, []);

  const [nodes, , onNodesChange] = useNodesState<Node>(initialData.nodes);
  const [edges, , onEdgesChange] = useEdgesState<Edge>(initialData.edges);
  const [showInfo, setShowInfo] = useState(true);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      {showInfo && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            zIndex: 10,
            background: "white",
            padding: "10px",
            borderRadius: "5px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ margin: "0 0 10px 0" }}>Dagre Layout Example</h3>
          <p style={{ margin: 0 }}>Root node with 150 children</p>
          <p style={{ margin: "5px 0 0 0", fontSize: "12px", color: "#666" }}>
            Total nodes: {nodes.length} | Total edges: {edges.length}
          </p>
          <button
            onClick={() => setShowInfo(false)}
            style={{
              marginTop: "10px",
              padding: "5px 10px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Hide Info
          </button>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        attributionPosition="bottom-right"
      >
        <MiniMap />
        <Controls />
        <Background gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}

export default LayoutFlow;
