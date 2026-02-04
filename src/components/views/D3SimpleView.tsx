import { useState, useCallback, useMemo } from "react";
import type { Edge } from "@xyflow/react";
import type { CustomNode } from "../../types";
import { Graph } from "../graph";
import type { D3Node, D3Link } from "../graph";
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
  const [nodesState] = useState<CustomNode[]>(initialNodes);
  const [edgesState] = useState<Edge[]>(initialEdges);
  const [isOverviewOpen, setIsOverviewOpen] = useState(true);
  const [allowNodeDrag, setAllowNodeDrag] = useState(true);

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
        color: style?.background || "#E3F2FD",
        borderColor: isMatch ? "#FFC107" : style?.border?.split(" ")[2] || "#1976D2",
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

  const handleAddNode = useCallback(() => {
    // Implementation would use graph store
    console.log("Add node");
  }, []);

  const handleDeleteNode = useCallback(() => {
    // Implementation would use graph store
    console.log("Delete node");
  }, []);

  const onZoomFit = useCallback(() => {
    console.log("Zoom fit not yet implemented");
  }, []);

  const onZoomIn = useCallback(() => {
    console.log("Zoom in not yet implemented");
  }, []);

  const onZoomOut = useCallback(() => {
    console.log("Zoom out not yet implemented");
  }, []);

  const onExpandAll = useCallback(() => {
    console.log("Expand all not yet implemented");
  }, []);

  const onCollapseAll = useCallback(() => {
    console.log("Collapse all not yet implemented");
  }, []);

  return (
    <div className={styles.d3SimpleView}>
      <Graph.Root
        nodes={d3Nodes}
        links={d3Links}
        layoutMode={layoutMode}
        collisionMode={collisionMode}
        showLevelLabels={showLevelLabels}
        showChildCount={showChildCountProp}
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
              <button className={styles.nodeActionButton} title="Edit">
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
