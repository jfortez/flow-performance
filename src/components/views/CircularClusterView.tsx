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
import { getCircularClusterLayout } from "../../utils/layouts/circularClusterLayout";

interface CircularClusterViewProps {
  nodes: CustomNode[];
  edges: Edge[];
  searchResults: Array<{ node: CustomNode; matches: boolean }>;
}

export const CircularClusterView = ({ nodes, edges, searchResults }: CircularClusterViewProps) => {
  const [isLayouting, setIsLayouting] = useState(true);
  const [reactFlowNodes, setReactFlowNodes, onNodesChange] =
    useNodesState<CustomNode>([]);
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] =
    useEdgesState<Edge>([]);

  useEffect(() => {
    let isCancelled = false;

    const calculateLayout = async () => {
      setIsLayouting(true);

      // Resize nodes to be smaller for cleaner look
      const resizedNodes = nodes.map((node) => ({
        ...node,
        style: {
          ...node.style,
          width: node.data.metadata.level === 0 ? 100 : 70,
          height: node.data.metadata.level === 0 ? 40 : 30,
          fontSize: node.data.metadata.level === 0 ? "12px" : "10px",
          padding: "4px 6px",
        },
      }));

      const { nodes: layoutedNodes, edges: layoutedEdges } =
        getCircularClusterLayout(resizedNodes, edges, {
          centerX: 0,
          centerY: 0,
          clusterRadius: 400,
          nodeSpacing: 50,
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
              ? "0 0 20px 4px rgba(255, 193, 7, 1)"
              : (node.style?.boxShadow || "0 2px 4px rgba(0,0,0,0.15)"),
            border: isMatch
              ? "4px solid #FFC107"
              : node.style?.border,
            transform: isMatch ? "scale(1.3)" : "scale(1)",
            transition: "all 0.3s ease",
            zIndex: isMatch ? 100 : 1,
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
          background: "#f8f9fa",
        }}
      >
        Calculating circular cluster layout...
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
      fitViewOptions={{ padding: 0.2, duration: 800 }}
      attributionPosition="bottom-right"
      minZoom={0.05}
      maxZoom={3}
      defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      style={{
        background: "#f8f9fa",
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
      <Background gap={20} size={1} color="#e0e0e0" />
    </ReactFlow>
  );
};
