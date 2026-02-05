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

  toggleNodeSelection: (id: string, multi?: boolean, childIds?: string[]) => {
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
          // Add direct children if provided
          if (childIds) {
            for (const childId of childIds) {
              newSelection.add(childId);
            }
          }
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

  zoomIn: () => {
    set((state) => ({
      viewportTransform: {
        ...state.viewportTransform,
        k: Math.min(state.viewportTransform.k * 1.2, 4),
      },
    }));
  },

  zoomOut: () => {
    set((state) => ({
      viewportTransform: {
        ...state.viewportTransform,
        k: Math.max(state.viewportTransform.k / 1.2, 0.3),
      },
    }));
  },

  zoomFit: (nodePositions: Map<string, NodePosition>, canvasWidth: number, canvasHeight: number) => {
    if (nodePositions.size === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const pos of nodePositions.values()) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x);
      maxY = Math.max(maxY, pos.y);
    }

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;

    if (graphWidth === 0 || graphHeight === 0) return;

    const padding = 50;
    const scaleX = (canvasWidth - padding * 2) / graphWidth;
    const scaleY = (canvasHeight - padding * 2) / graphHeight;
    const k = Math.min(scaleX, scaleY, 4);

    const x = canvasWidth / 2 - ((minX + maxX) / 2) * k;
    const y = canvasHeight / 2 - ((minY + maxY) / 2) * k;

    set({
      viewportTransform: { x, y, k: Math.max(k, 0.3) },
    });
  },
}));
