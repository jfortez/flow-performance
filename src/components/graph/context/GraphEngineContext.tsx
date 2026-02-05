import { createContext, useContext, useCallback } from "react";
import type { RefObject } from "react";
import type { ForceNode, ForceLink } from "../types";
import type { Simulation } from "d3-force";

interface GraphEngineContextValue {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  simulationRef: RefObject<Simulation<any, any> | null>;
  forceNodes: ForceNode[];
  forceLinks: ForceLink[];
  nodesById: Map<string, ForceNode>;
  visibleNodeIds: Set<string>;
  containerRef: RefObject<HTMLDivElement | null>;
  transformRef: RefObject<{ x: number; y: number; k: number }>;
  prevNodesStateRef: RefObject<Map<string, { x: number; y: number; vx: number; vy: number }>>;
  getNodeRadius: (level: number) => number;
  showLevelLabels: boolean;
  showChildCount: boolean;
  allowNodeDrag: boolean;
  highlightSelectedDescendants: boolean;
  highlightHoverPaths: boolean;
}

export const GraphEngineContext = createContext<GraphEngineContextValue | null>(null);

export function useGraphEngine() {
  const context = useContext(GraphEngineContext);
  if (!context) {
    throw new Error("useGraphEngine must be used within a GraphEngineContext.Provider");
  }
  return context;
}

export function useGetNodeRadius() {
  return useCallback((level: number): number => {
    if (level === 0) return 22;
    if (level === 1) return 16;
    return 11;
  }, []);
}
