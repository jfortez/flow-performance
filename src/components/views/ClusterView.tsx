import { useEffect, useCallback, useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Edge,
} from "@xyflow/react";
import type { CustomNode, ClusterGroup } from "../../types";

interface ClusterViewProps {
  nodes: CustomNode[];
  edges: Edge[];
  searchResults: Array<{ node: CustomNode; matches: boolean }>;
  expandedClusters: Set<string>;
  onToggleCluster: (clusterId: string) => void;
}

export const ClusterView = ({
  nodes,
  edges,
  searchResults,
  expandedClusters,
  onToggleCluster,
}: ClusterViewProps) => {
  const [reactFlowNodes, setReactFlowNodes, onNodesChange] =
    useNodesState<CustomNode>([]);
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] =
    useEdgesState<Edge>([]);

  const clusters = useMemo(() => {
    const groups = new Map<number, CustomNode[]>();

    nodes.forEach((node) => {
      const level = node.data.metadata.level;
      if (!groups.has(level)) {
        groups.set(level, []);
      }
      groups.get(level)!.push(node);
    });

    const clusterArray: ClusterGroup[] = [];
    groups.forEach((levelNodes, level) => {
      const isExpanded = expandedClusters.has(`level-${level}`);

      if (isExpanded || level === 0) {
        levelNodes.forEach((node) => {
          clusterArray.push({
            id: node.id,
            level,
            label: node.data.label,
            nodes: [node],
            isExpanded: true,
          });
        });
      } else {
        clusterArray.push({
          id: `level-${level}`,
          level,
          label: `Level ${level} (${levelNodes.length} nodes)`,
          nodes: levelNodes,
          isExpanded: false,
        });
      }
    });

    return clusterArray;
  }, [nodes, expandedClusters]);

  const applyLayout = useCallback(() => {
    const visibleNodes: CustomNode[] = [];
    const visibleEdges: Edge[] = [];

    clusters.forEach((cluster, index) => {
      const y = cluster.level * 250;
      const x = cluster.isExpanded
        ? index * 240
        : (index % 5) * 350 + Math.floor(index / 5) * 60;

      if (cluster.isExpanded) {
        cluster.nodes.forEach((node) => {
          const searchResult = searchResults.find((r) => r.node.id === node.id);
          const isMatch = searchResult?.matches || false;

          visibleNodes.push({
            ...node,
            position: { x, y },
            style: {
              ...node.style,
              
              boxShadow: isMatch
                ? "0 0 15px 3px rgba(255, 193, 7, 0.8)"
                : (node.style?.boxShadow || "0 3px 6px rgba(0,0,0,0.16)"),
              border: isMatch ? "3px solid #FFC107" : node.style?.border,
              transition: "all 0.3s ease",
            },
          });
        });
      } else {
        const clusterNode: CustomNode = {
          id: cluster.id,
          position: { x, y },
          data: {
            label: cluster.label,
            metadata: {
              type: "categoryA",
              status: "active",
              level: cluster.level,
            },
            childCount: cluster.nodes.length,
          },
          style: {
            background: "#E0E0E0",
            border: "3px solid #757575",
            width: 220,
            height: 90,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
            color: "#424242",
            cursor: "pointer",
            fontSize: "13px",
            boxShadow: "0 3px 6px rgba(0,0,0,0.16)",
            borderRadius: "6px",
          },
        };
        visibleNodes.push(clusterNode);
      }
    });

    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    edges.forEach((edge) => {
      if (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) {
        visibleEdges.push(edge);
      }
    });

    setReactFlowNodes(visibleNodes);
    setReactFlowEdges(visibleEdges);
  }, [clusters, edges, searchResults, setReactFlowNodes, setReactFlowEdges]);

  useEffect(() => {
    applyLayout();
  }, [applyLayout]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: CustomNode) => {
      if (node.id.startsWith("level-")) {
        onToggleCluster(node.id);
      }
    },
    [onToggleCluster]
  );

  return (
    <ReactFlow
      nodes={reactFlowNodes}
      edges={reactFlowEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
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
