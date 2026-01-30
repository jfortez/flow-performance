import { useEffect, useState } from "react";
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
import { getConcentricLayout } from "../../utils/layouts/concentricLayout";

interface ConcentricViewProps {
  nodes: CustomNode[];
  edges: Edge[];
  searchResults: Array<{ node: CustomNode; matches: boolean }>;
}

export const ConcentricView = ({ nodes, edges, searchResults }: ConcentricViewProps) => {
  const [isLayouting, setIsLayouting] = useState(true);
  const [reactFlowNodes, setReactFlowNodes, onNodesChange] =
    useNodesState<CustomNode>([]);
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] =
    useEdgesState<Edge>([]);

  useEffect(() => {
    let isCancelled = false;

    const calculateLayout = async () => {
      setIsLayouting(true);

      const { nodes: layoutedNodes, edges: layoutedEdges } =
        getConcentricLayout(nodes, edges, {
          centerX: 1000,
          centerY: 700,
          ringSpacing: 300,
        });

      if (isCancelled) return;

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
            border: isMatch
              ? "3px solid #FFC107"
              : node.style?.border,
            transition: "all 0.3s ease",
          },
        };
      });

      setReactFlowNodes(highlightedNodes);
      setReactFlowEdges(layoutedEdges);
      setIsLayouting(false);
    };

    calculateLayout();

    return () => {
      isCancelled = true;
    };
  }, [nodes, edges, searchResults, setReactFlowNodes, setReactFlowEdges]);

  if (isLayouting) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "16px",
          color: "#666",
          background: "#f0f0f0",
        }}
      >
        Calculating concentric layout...
      </div>
    );
  }

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
