import { useState, useCallback, useMemo } from "react";
import type { Edge } from "@xyflow/react";
import type { CustomNode } from "../../types";
import { Graph } from "../graph";
import type { D3Node, D3Link } from "../graph";
import { useGraphStore } from "../graph/store/graphStore";
import { Toolbar } from "../controls/Toolbar";
import styles from "./D3SimpleView.module.css";

export type LayoutMode = "concentric" | "progressive" | "hierarchical" | "radial-tree" | "cluster";
export type CollisionMode = "full" | "minimal" | "none";

interface D3SimpleViewProps {
  nodes: CustomNode[];
  edges: Edge[];
  searchResults: Array<{ node: CustomNode; matches: boolean }>;
  layoutMode?: LayoutMode;
  collisionMode?: CollisionMode;
  showLevelLabels?: boolean;
  showChildCount?: boolean;
  showTooltipOnHover?: boolean;
}

export const D3SimpleView = ({
  nodes: initialNodes,
  edges: initialEdges,
  searchResults,
  layoutMode = "concentric",
  collisionMode = "full",
  showLevelLabels = false,
  showChildCount: showChildCountProp = false,
  showTooltipOnHover = false,
}: D3SimpleViewProps) => {
  const [nodesState, setNodesState] = useState<CustomNode[]>(initialNodes);
  const [edgesState, setEdgesState] = useState<Edge[]>(initialEdges);
  const [isOverviewOpen, setIsOverviewOpen] = useState(true);
  const [allowNodeDrag, setAllowNodeDrag] = useState(true);
  const selectedNodeIds = useGraphStore((state) => state.selectedNodeIds);
  const clearSelection = useGraphStore((state) => state.clearSelection);

  const searchResultsMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const result of searchResults) {
      map.set(result.node.id, result.matches);
    }
    return map;
  }, [searchResults]);

  const d3Nodes: D3Node[] = useMemo(() => {
    return nodesState.map((node) => {
      const style = node.style as Record<string, string> | undefined;
      const isMatch = searchResultsMap.get(node.id) ?? false;

      return {
        id: node.id,
        label: node.data.label,
        color: style?.background || "#bc1234",
        borderColor: isMatch ? "#0b09ae" : style?.border?.split(" ")[2] || "#1976D2",
        type: node.data.metadata.type,
        level: node.data.metadata.level,
        isMatch,
      };
    });
  }, [nodesState, searchResultsMap]);

  const d3Links: D3Link[] = useMemo(() => {
    return edgesState.map((edge) => ({
      source: edge.source,
      target: edge.target,
    }));
  }, [edgesState]);

  const zoomIn = useGraphStore((state) => state.zoomIn);
  const zoomOut = useGraphStore((state) => state.zoomOut);
  const zoomFit = useGraphStore((state) => state.zoomFit);
  const expandAll = useGraphStore((state) => state.expandAll);
  const collapseAll = useGraphStore((state) => state.collapseAll);
  const nodePositions = useGraphStore((state) => state.nodePositions);
  const dimensions = useGraphStore((state) => state.dimensions);

  const handleAddNode = useCallback(() => {
    // Get the first selected node to add a child to
    const selectedId = Array.from(selectedNodeIds)[0];
    if (!selectedId) {
      alert("Please select a node first");
      return;
    }

    const parentNode = nodesState.find((n) => n.id === selectedId);
    if (!parentNode) return;

    const newId = `node-${Date.now()}`;
    const newLevel = (parentNode.data.metadata.level ?? 0) + 1;

    const newNode: CustomNode = {
      id: newId,
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        label: `New Node ${newId.slice(-4)}`,
        metadata: {
          type: "endpoint",
          level: newLevel,
          status: "active",
        },
      },
      style: {
        background: "#E3F2FD",
        border: "2px solid #1976D2",
      },
    };

    const newEdge: Edge = {
      id: `edge-${Date.now()}`,
      source: selectedId,
      target: newId,
    };

    setNodesState((prev) => [...prev, newNode]);
    setEdgesState((prev) => [...prev, newEdge]);
  }, [selectedNodeIds, nodesState]);

  const handleDeleteNode = useCallback(() => {
    const selectedId = Array.from(selectedNodeIds)[0];
    if (!selectedId) {
      alert("Please select a node first");
      return;
    }

    const nodeToDelete = nodesState.find((n) => n.id === selectedId);
    if (nodeToDelete?.data.metadata.level === 0) {
      alert("Cannot delete the root node");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${nodeToDelete?.data.label}"?`)) {
      return;
    }

    // Remove the node and any edges connected to it
    setNodesState((prev) => prev.filter((n) => n.id !== selectedId));
    setEdgesState((prev) => prev.filter((e) => e.source !== selectedId && e.target !== selectedId));
    clearSelection();
  }, [selectedNodeIds, nodesState, clearSelection]);

  const handleEditNode = useCallback(() => {
    const selectedId = Array.from(selectedNodeIds)[0];
    if (!selectedId) {
      alert("Please select a node first");
      return;
    }

    const nodeToEdit = nodesState.find((n) => n.id === selectedId);
    if (!nodeToEdit) return;

    const newLabel = prompt("Enter new label:", nodeToEdit.data.label);
    if (newLabel === null || newLabel === nodeToEdit.data.label) return;

    setNodesState((prev) =>
      prev.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, label: newLabel } } : n)),
    );
  }, [selectedNodeIds, nodesState]);

  const onZoomFit = useCallback(() => {
    zoomFit(nodePositions, dimensions.width, dimensions.height);
  }, [zoomFit, nodePositions, dimensions]);

  const onZoomIn = useCallback(() => {
    zoomIn();
  }, [zoomIn]);

  const onZoomOut = useCallback(() => {
    zoomOut();
  }, [zoomOut]);

  const onExpandAll = useCallback(() => {
    expandAll();
  }, [expandAll]);

  const onCollapseAll = useCallback(() => {
    // Collapse all nodes except root (level 0)
    const nonRootNodeIds = nodesState
      .filter((node) => node.data.metadata.level !== 0)
      .map((node) => node.id);
    collapseAll(nonRootNodeIds);
  }, [collapseAll, nodesState]);

  return (
    <div className={styles.d3SimpleView}>
      <Graph.Root
        nodes={d3Nodes}
        links={d3Links}
        layoutMode={layoutMode}
        collisionMode={collisionMode}
        showLevelLabels={showLevelLabels}
        showChildCount={showChildCountProp}
        allowNodeDrag={allowNodeDrag}
        highlightSelectedDescendants={true}
        highlightHoverPaths={true}
      >
        {showTooltipOnHover && (
          <Graph.NodeTooltip position="top-center">
            {(node) => (
              <div className={styles.tooltip}>
                <div className={styles.tooltipHeader}>
                  <span
                    className={`${styles.levelBadge} ${
                      node.level === 0 ? styles.levelBadgeRoot : styles.levelBadgeChild
                    }`}
                  >
                    {node.level}
                  </span>
                  <span className={styles.tooltipLabel}>{node.label}</span>
                </div>
                <div className={styles.tooltipInfo}>
                  <div>
                    <strong>Type:</strong> {node.type}
                  </div>
                  <div>
                    <strong>ID:</strong> {node.id}
                  </div>
                </div>
              </div>
            )}
          </Graph.NodeTooltip>
        )}

        <Graph.NodeToolbar position="right-top">
          {(node) => (
            <div className={styles.nodeActionToolbar}>
              <button onClick={handleAddNode} className={styles.nodeActionButton} title="Add Child">
                +
              </button>
              <button onClick={handleEditNode} className={styles.nodeActionButton} title="Edit">
                ✎
              </button>
              {node.level !== undefined && node.level > 0 && (
                <button
                  onClick={handleDeleteNode}
                  className={`${styles.nodeActionButton} ${styles.nodeActionButtonDanger}`}
                  title="Delete"
                >
                  🗑
                </button>
              )}
            </div>
          )}
        </Graph.NodeToolbar>

        <div className={styles.toolbarContainer}>
          <Toolbar
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onZoomFit={onZoomFit}
            onToggleOverview={() => setIsOverviewOpen(!isOverviewOpen)}
            isOverviewOpen={isOverviewOpen}
            allowNodeDrag={allowNodeDrag}
            onToggleNodeDrag={() => setAllowNodeDrag(!allowNodeDrag)}
            onExpandAll={onExpandAll}
            onCollapseAll={onCollapseAll}
          />
        </div>

        {isOverviewOpen && <Graph.Overview position="bottom-right" width={200} height={150} />}
      </Graph.Root>
    </div>
  );
};
