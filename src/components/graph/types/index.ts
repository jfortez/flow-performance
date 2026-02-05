import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";

// Style interfaces for nodes and links
export interface NodeStyles {
  color?: string;
  fill?: string;
  borderColor?: string;
  strokeStyle?: string;
  lineWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  opacity?: number;
}

export interface LinkStyles {
  color?: string;
  strokeStyle?: string;
  lineWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  opacity?: number;
  dashPattern?: number[];
}

export interface D3Node extends SimulationNodeDatum {
  id: string;
  label?: string;
  color?: string;
  borderColor?: string;
  type?: string;
  level?: number;
  isMatch?: boolean;
  parentId?: string;
  childIds?: string[];
  styles?: NodeStyles;
}

export interface D3Link extends SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
  styles?: LinkStyles;
}

export interface ForceNode extends D3Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  initialX: number;
  initialY: number;
  fx?: number | null;
  fy?: number | null;
  styles?: NodeStyles;
}

export interface ForceLink extends SimulationLinkDatum<ForceNode> {
  source: string | ForceNode;
  target: string | ForceNode;
  styles?: LinkStyles;
}

export type LayoutMode = "concentric" | "progressive" | "hierarchical" | "radial-tree" | "cluster";

export type CollisionMode = "full" | "minimal" | "none";

export interface SimulationSettings {
  chargeStrength?: number;
  chargeDistanceMax?: number;
  linkDistance?: number;
  linkStrength?: number;
  collideRadius?: number;
  positionStrength?: number;
  centerStrength?: number;
}

export interface NodePosition {
  x: number;
  y: number;
  level?: number;
}

export interface ViewportTransform {
  x: number;
  y: number;
  k: number;
}

export type TooltipPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "left-top"
  | "left-center"
  | "left-bottom"
  | "right-top"
  | "right-center"
  | "right-bottom"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type OverviewPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface GraphState {
  hoveredNodeId: string | null;
  selectedNodeIds: Set<string>;
  collapsedNodeIds: Set<string>;
  viewportTransform: ViewportTransform;
  nodePositions: Map<string, NodePosition>;
  isDragging: boolean;
  dimensions: { width: number; height: number };
}

export interface GraphActions {
  setHoveredNode: (id: string | null) => void;
  toggleNodeSelection: (id: string) => void;
  clearSelection: () => void;
  toggleNodeCollapse: (id: string) => void;
  expandAll: () => void;
  collapseAll: (nodeIds: string[]) => void;
  setViewportTransform: (transform: ViewportTransform) => void;
  updateNodePositions: (positions: Map<string, NodePosition>) => void;
  setNodePosition: (id: string, position: NodePosition) => void;
  setIsDragging: (isDragging: boolean) => void;
  setDimensions: (dimensions: { width: number; height: number }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomFit: (nodePositions: Map<string, NodePosition>, canvasWidth: number, canvasHeight: number) => void;
}

export interface GraphMeta {
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  transformRef: React.RefObject<ViewportTransform>;
}

export interface GraphContextValue {
  nodes: D3Node[];
  links: D3Link[];
  layoutMode: LayoutMode;
  collisionMode: CollisionMode;
  showLevelLabels: boolean;
  showChildCount: boolean;
  simulationSettings: SimulationSettings;
}

export interface GraphStore extends GraphState, GraphActions {}
