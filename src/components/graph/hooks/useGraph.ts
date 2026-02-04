import { useMemo } from "react";
import { useGraphStore } from "../store/graphStore";
import { useGraphContext } from "../context/GraphContext";
import type { D3Node, NodePosition } from "../types";

export function useGraph() {
  const store = useGraphStore();
  const context = useGraphContext();

  return useMemo(
    () => ({
      state: {
        hoveredNodeId: store.hoveredNodeId,
        selectedNodeIds: store.selectedNodeIds,
        collapsedNodeIds: store.collapsedNodeIds,
        viewportTransform: store.viewportTransform,
        nodePositions: store.nodePositions,
        isDragging: store.isDragging,
        dimensions: store.dimensions,
      },
      actions: {
        setHoveredNode: store.setHoveredNode,
        toggleNodeSelection: store.toggleNodeSelection,
        clearSelection: store.clearSelection,
        toggleNodeCollapse: store.toggleNodeCollapse,
        expandAll: store.expandAll,
        collapseAll: store.collapseAll,
        setViewportTransform: store.setViewportTransform,
        updateNodePositions: store.updateNodePositions,
        setNodePosition: store.setNodePosition,
        setIsDragging: store.setIsDragging,
        setDimensions: store.setDimensions,
      },
      meta: {
        nodes: context.nodes,
        links: context.links,
        layoutMode: context.layoutMode,
        collisionMode: context.collisionMode,
        showLevelLabels: context.showLevelLabels,
        showChildCount: context.showChildCount,
        simulationSettings: context.simulationSettings,
      },
    }),
    [store, context]
  );
}

export function useHoveredNode(): (D3Node & NodePosition) | null {
  const hoveredNodeId = useGraphStore((state) => state.hoveredNodeId);
  const nodePositions = useGraphStore((state) => state.nodePositions);
  const { nodes } = useGraphContext();

  return useMemo(() => {
    if (!hoveredNodeId) return null;
    const node = nodes.find((n) => n.id === hoveredNodeId);
    const position = nodePositions.get(hoveredNodeId);
    if (!node || !position) return null;
    return { ...node, ...position };
  }, [hoveredNodeId, nodePositions, nodes]);
}

export function useSelectedNode(): (D3Node & NodePosition) | null {
  const selectedNodeIds = useGraphStore((state) => state.selectedNodeIds);
  const nodePositions = useGraphStore((state) => state.nodePositions);
  const { nodes } = useGraphContext();

  return useMemo(() => {
    if (selectedNodeIds.size !== 1) return null;
    const id = Array.from(selectedNodeIds)[0];
    const node = nodes.find((n) => n.id === id);
    const position = nodePositions.get(id);
    if (!node || !position) return null;
    return { ...node, ...position };
  }, [selectedNodeIds, nodePositions, nodes]);
}

export function useGraphViewport() {
  return useGraphStore((state) => state.viewportTransform);
}

export function useGraphDimensions() {
  return useGraphStore((state) => state.dimensions);
}

export function useIsDragging() {
  return useGraphStore((state) => state.isDragging);
}

export function useCollapsedNodes() {
  return useGraphStore((state) => state.collapsedNodeIds);
}
