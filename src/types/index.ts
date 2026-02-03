import type { Node } from "@xyflow/react";

export type NodeType = 
  | "core"      // Nodo central/principal (antes root)
  | "categoryA" // Categoría A - Procesos principales
  | "categoryB" // Categoría B - Sub-procesos
  | "categoryC" // Categoría C - Tareas específicas
  | "categoryD" // Categoría D - Acciones atómicas
  | "endpoint"; // Puntos finales/resultados
export type NodeStatus = "active" | "pending" | "completed" | "error";

export interface NodeMetadata {
  type: NodeType;
  status: NodeStatus;
  level: number;
  createdAt?: string;
  description?: string;
}

export interface CustomNodeData extends Record<string, unknown> {
  label: string;
  metadata: NodeMetadata;
  isExpanded?: boolean;
  childCount?: number;
}

export interface CustomNode extends Node {
  data: CustomNodeData;
}

export type ViewType = "force" | "concentric" | "grid" | "dagre" | "radial" | "d3canvas" | "d3cluster" | "d3simple" | "local" | "tree" | "gojs";

export interface GraphConfig {
  nodeCount: number;
  maxDepth: number;
  childrenPerNode: number[];
  minChildrenPerNode: number;
  maxChildrenPerNode: number | null;
  targetFirstLevel: number;
}

export interface ViewState {
  currentView: ViewType;
  expandedClusters: Set<string>;
}

export interface SearchResult {
  node: CustomNode;
  matches: boolean;
}

export interface PerformanceMetrics {
  fps: number;
  nodeCount: number;
  edgeCount: number;
  renderTime: number;
}

export interface ClusterGroup {
  id: string;
  level: number;
  label: string;
  nodes: CustomNode[];
  isExpanded: boolean;
}
