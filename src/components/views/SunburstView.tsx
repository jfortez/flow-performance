import { useEffect, useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Edge,
} from "@xyflow/react";
import type { CustomNode } from "../../types";
import { getSunburstLayout } from "../../utils/layouts/sunburstLayout";

interface SunburstViewProps {
  nodes: CustomNode[];
  edges: Edge[];
  searchResults: Array<{ node: CustomNode; matches: boolean }>;
}

export const SunburstView = ({ nodes, edges, searchResults }: SunburstViewProps) => {
  const [reactFlowNodes, setReactFlowNodes, onNodesChange] =
    useNodesState<CustomNode>([]);
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] =
    useEdgesState<Edge>([]);

  const layoutedData = useMemo(() => {
    return getSunburstLayout(nodes, edges, {
      centerX: 800,
      centerY: 600,
      innerRadius: 150,
      ringWidth: 200,
    });
  }, [nodes, edges]);

  useEffect(() => {
    const highlightedNodes = layoutedData.nodes.map((node) => {
      const searchResult = searchResults.find((r) => r.node.id === node.id);
      const isMatch = searchResult?.matches || false;

      return {
        ...node,
        style: {
          ...node.style,
          
          boxShadow: isMatch
            ? "0 0 15px 3px rgba(255, 193, 7, 0.8)"
            : (node.style?.boxShadow || "0 3px 6px rgba(0,0,0,0.16)"),
          border: isMatch
            ? "3px solid #FFC107"
            : node.style?.border,
          transition: "all 0.3s ease",
        },
      };
    });

    setReactFlowNodes(highlightedNodes);
    setReactFlowEdges(layoutedData.edges);
  }, [layoutedData, searchResults, setReactFlowNodes, setReactFlowEdges]);

  return (
    <ReactFlow
      nodes={reactFlowNodes}
      edges={reactFlowEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      attributionPosition="bottom-right"
      minZoom={0.05}
      maxZoom={2}
      style={{
        background: "#f0f0f0",
      }}
    >
      <MiniMap
        style={{
          backgroundColor: "#f5f5f5",
          border: "1px solid #ddd",
          borderRadius: "8px",
        }}
      />
      <Controls />
      <Background gap={20} size={1} color="#ddd" />
    </ReactFlow>
  );
};
