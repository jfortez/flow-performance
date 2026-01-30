import { useEffect, useCallback } from "react";
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
import { getDagreLayout } from "../../utils/layouts/dagreLayout";

interface DagreViewProps {
  nodes: CustomNode[];
  edges: Edge[];
  searchResults: Array<{ node: CustomNode; matches: boolean }>;
}

export const DagreView = ({ nodes, edges, searchResults }: DagreViewProps) => {
  const [reactFlowNodes, setReactFlowNodes, onNodesChange] =
    useNodesState<CustomNode>(nodes);
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] =
    useEdgesState<Edge>(edges);

  const applyLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getDagreLayout(
      nodes,
      edges,
      "TB"
    );

    const highlightedNodes = layoutedNodes.map((node) => {
      const searchResult = searchResults.find((r) => r.node.id === node.id);
      const isMatch = searchResult?.matches || false;

      return {
        ...node,
        style: {
          ...node.style,
          
          boxShadow: isMatch
            ? "0 0 15px 3px rgba(255, 193, 7, 0.8)"
            : (node.style?.boxShadow || "0 3px 6px rgba(0,0,0,0.16)"),
          border: isMatch ? "3px solid #FFC107" : node.style?.border,
          transition: "all 0.3s ease",
        },
      };
    });

    setReactFlowNodes(highlightedNodes);
    setReactFlowEdges(layoutedEdges);
  }, [nodes, edges, searchResults, setReactFlowNodes, setReactFlowEdges]);

  useEffect(() => {
    applyLayout();
  }, [applyLayout]);

  return (
    <ReactFlow
      nodes={reactFlowNodes}
      edges={reactFlowEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      attributionPosition="bottom-right"
      minZoom={0.1}
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
