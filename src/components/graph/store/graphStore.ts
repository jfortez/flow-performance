import { create } from "zustand";
import type {
  GraphStore,
  NodePosition,
  ViewportTransform,
} from "../types";

export const useGraphStore = create<GraphStore>((set) => ({
  hoveredNodeId: null,
  selectedNodeIds: new Set<string>(),
  collapsedNodeIds: new Set<string>(),
  viewportTransform: { x: 0, y: 0, k: 1 },
  nodePositions: new Map<string, NodePosition>(),
  isDragging: false,
  dimensions: { width: 0, height: 0 },

  setHoveredNode: (id: string | null) => {
    set({ hoveredNodeId: id });
  },

  toggleNodeSelection: (id: string, multi?: boolean) => {
    set((state) => {
      const newSelection = new Set(state.selectedNodeIds);
      if (multi) {
        if (newSelection.has(id)) {
          newSelection.delete(id);
        } else {
          newSelection.add(id);
        }
      } else {
        if (newSelection.has(id) && newSelection.size === 1) {
          newSelection.clear();
        } else {
          newSelection.clear();
          newSelection.add(id);
        }
      }
      return { selectedNodeIds: newSelection };
    });
  },

  clearSelection: () => {
    set({ selectedNodeIds: new Set<string>() });
  },

  toggleNodeCollapse: (id: string) => {
    set((state) => {
      const newCollapsed = new Set(state.collapsedNodeIds);
      if (newCollapsed.has(id)) {
        newCollapsed.delete(id);
      } else {
        newCollapsed.add(id);
      }
      return { collapsedNodeIds: newCollapsed };
    });
  },

  expandAll: () => {
    set({ collapsedNodeIds: new Set<string>() });
  },

  collapseAll: (nodeIds: string[]) => {
    set({ collapsedNodeIds: new Set(nodeIds) });
  },

  setViewportTransform: (transform: ViewportTransform) => {
    set({ viewportTransform: transform });
  },

  updateNodePositions: (positions: Map<string, NodePosition>) => {
    set({ nodePositions: positions });
  },

  setNodePosition: (id: string, position: NodePosition) => {
    set((state) => {
      const newPositions = new Map(state.nodePositions);
      newPositions.set(id, position);
      return { nodePositions: newPositions };
    });
  },

  setIsDragging: (isDragging: boolean) => {
    set({ isDragging });
  },

  setDimensions: (dimensions: { width: number; height: number }) => {
    set({ dimensions });
  },
}));
