import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node,
} from "@xyflow/react";
import type { CustomNode } from "../../types";
import { getGroupedLayout } from "../../utils/layouts/groupedLayout";

interface GroupedViewProps {
  nodes: CustomNode[];
  edges: Edge[];
  searchResults: Array<{ node: CustomNode; matches: boolean }>;
}

export const GroupedView = ({ nodes, edges, searchResults }: GroupedViewProps) => {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  
  // Initialize state hooks with empty arrays first
  const [reactFlowNodes, setReactFlowNodes, onNodesChange] =
    useNodesState<CustomNode>([]);
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] =
    useEdgesState<Edge>([]);
  
  // Calculate layout and update nodes
  useEffect(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getGroupedLayout(nodes, edges, { expandedGroup });
    
    // Apply highlighting to layouted nodes
    const highlightedNodes = layoutedNodes.map((node) => {
      const searchResult = searchResults.find((r) => r.node.id === node.id);
      const isMatch = searchResult?.matches || false;
      const isGroupNode = node.data?.isGroup === true;

      return {
        ...node,
        style: {
          ...node.style,
          boxShadow: isMatch
            ? "0 0 20px 4px rgba(255, 193, 7, 1)"
            : isGroupNode
            ? "0 4px 12px rgba(25, 118, 210, 0.3)"
            : (node.style?.boxShadow || "0 2px 4px rgba(0,0,0,0.15)"),
          border: isMatch ? "3px solid #FFC107" : node.style?.border,
          transform: isMatch ? "scale(1.2)" : "scale(1)",
          transition: "all 0.3 ease",
          zIndex: isMatch ? 100 : isGroupNode ? 50 : 1,
        },
      };
    });
    
    setReactFlowNodes(highlightedNodes);
    setReactFlowEdges(layoutedEdges);
  }, [nodes, edges, expandedGroup, searchResults, setReactFlowNodes, setReactFlowEdges]);
  
  // Get groups for breadcrumb
  const groups = useMemo(() => {
    const { groups } = getGroupedLayout(nodes, edges, { expandedGroup });
    return groups;
  }, [nodes, edges, expandedGroup]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const customNode = node as CustomNode;
      if (customNode.data?.isGroup) {
        const groupId = customNode.data.groupId as string;
        if (expandedGroup === groupId) {
          setExpandedGroup(null); // Collapse if already expanded
        } else {
          setExpandedGroup(groupId); // Expand this group
        }
      }
    },
    [expandedGroup]
  );

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Breadcrumb */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 16,
          zIndex: 10,
          padding: "8px 16px",
          background: "rgba(255, 255, 255, 0.95)",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          fontSize: "14px",
          fontWeight: 500,
        }}
      >
        {expandedGroup ? (
          <span>
            <span
              style={{ cursor: "pointer", color: "#1976D2" }}
              onClick={() => setExpandedGroup(null)}
            >
              Root
            </span>
            <span style={{ margin: "0 4px", color: "#999" }}>&gt;</span>
            {groups.find((g) => g.id === expandedGroup)?.label}
          </span>
        ) : (
          <span>Root</span>
        )}
      </div>

      {/* Info Panel */}
      <div
        style={{
          position: "absolute",
          top: 80,
          right: 16,
          zIndex: 10,
          padding: "12px 16px",
          background: "rgba(255, 255, 255, 0.95)",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          fontSize: "13px",
          maxWidth: "250px",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: "8px" }}>
          {expandedGroup
            ? "Nodos Individuales"
            : `${groups.length} Grupos de Nodos`}
        </div>
        <div style={{ color: "#666", fontSize: "12px" }}>
          {expandedGroup
            ? "Click en un nodo para ver detalles"
            : "Click en un grupo para expandir y ver sus nodos"}
        </div>
      </div>

      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.05, duration: 800 }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
        attributionPosition="bottom-right"
        minZoom={0.05}
        maxZoom={2}
        style={{
          background: "#f5f5f5",
        }}
      >
        <MiniMap
          style={{
            backgroundColor: "#fff",
            border: "1px solid #ddd",
            borderRadius: "8px",
          }}
        />
        <Controls />
        <Background gap={20} size={1} color="#e0e0e0" />
      </ReactFlow>
    </div>
  );
};
