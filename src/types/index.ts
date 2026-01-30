import type { Node } from "@xyflow/react";

export type NodeType = "root" | "process" | "task" | "decision" | "action";
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

export type ViewType = "force" | "concentric" | "grid" | "dagre" | "radial" | "grouped" | "d3canvas" | "d3cluster" | "local";

export interface GraphConfig {
  nodeCount: number;
  maxDepth: number;
  childrenPerNode: number[];
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
