import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import {
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceLink,
  forceCollide,
  forceX,
  forceY,
} from "d3-force";
import { zoom, zoomIdentity } from "d3-zoom";
import { select } from "d3-selection";
import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";
import styles from "./views/D3SimpleView.module.css";

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
}

export interface D3Link extends SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
}

interface ForceNode extends D3Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  initialX: number;
  initialY: number;
  fx?: number | null;
  fy?: number | null;
}

interface ForceLink extends SimulationLinkDatum<ForceNode> {
  source: string | ForceNode;
  target: string | ForceNode;
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

export interface D3ForceProps {
  nodes: D3Node[];
  links: D3Link[];
  layoutMode?: LayoutMode;
  collisionMode?: CollisionMode;
  showLevelLabels?: boolean;
  showChildCount?: boolean;
  collapsedNodes?: Set<string>;
  selectedNodes?: Set<string>;
  simulationSettings?: SimulationSettings;
  className?: string;
  canvasClassName?: string;
  children?: ReactNode;
  onNodeHover?: (nodeId: string | null) => void;
  onNodeClick?: (nodeId: string, event: React.MouseEvent) => void;
  onNodeDoubleClick?: (nodeId: string, event: React.MouseEvent) => void;
  onNodeToggle?: (nodeId: string) => void;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  onViewportChange?: (transform: { x: number; y: number; k: number }) => void;
  onNodesPositionUpdate?: (
    nodes: Array<{ id: string; x: number; y: number; level?: number }>,
  ) => void;
}

const getNodeRadius = (level: number): number => {
  if (level === 0) return 22;
  if (level === 1) return 16;
  return 11;
};

const defaultSettings: Required<SimulationSettings> = {
  chargeStrength: -800,
  chargeDistanceMax: 1000,
  linkDistance: 150,
  linkStrength: 0.5,
  collideRadius: 45,
  positionStrength: 0.02,
  centerStrength: 0.02,
};

const layoutPresets: Record<LayoutMode, Partial<SimulationSettings>> = {
  concentric: {},
  progressive: {
    chargeStrength: -1200,
    chargeDistanceMax: 1500,
    linkDistance: 200,
    linkStrength: 0.3,
    collideRadius: 55,
    positionStrength: 0.015,
    centerStrength: 0.01,
  },
  hierarchical: {
    chargeStrength: -500,
    chargeDistanceMax: 800,
    linkDistance: 180,
    linkStrength: 0.7,
    collideRadius: 40,
    positionStrength: 0.04,
    centerStrength: 0.03,
  },
  "radial-tree": {},
  cluster: {},
};

export function D3Force({
  nodes: initialNodes,
  links: initialLinks,
  layoutMode = "concentric",
  collisionMode = "full",
  showLevelLabels = false,
  showChildCount = false,
  collapsedNodes = new Set(),
  selectedNodes = new Set(),
  simulationSettings = {},
  className,
  canvasClassName,
  children,
  onNodeHover,
  onNodeClick,
  onNodeDoubleClick,
  onNodeToggle,
  onSelectionChange,
  onViewportChange,
  onNodesPositionUpdate,
}: D3ForceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation> | null>(null);
  const transformRef = useRef(zoomIdentity);

  // Store previous node state to preserve positions/velocities
  const prevNodesStateRef = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(
    new Map(),
  );

  // Refs for transient values that change frequently (hover state)
  // Following Vercel best practice: rerender-use-ref-transient-values
  const hoveredNodeIdRef = useRef<string | null>(null);
  const isHoveringRef = useRef(false);

  // Ref for selected nodes to avoid re-render triggers
  const selectedNodesRef = useRef(selectedNodes);
  selectedNodesRef.current = selectedNodes;

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [, setViewportTransform] = useState({ x: 0, y: 0, k: 1 });

  const draggedNodeRef = useRef<ForceNode | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const clickedOnExpandButtonRef = useRef(false);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doubleClickRef = useRef(false);

  const settings = useMemo(() => {
    const preset = layoutPresets[layoutMode];
    return {
      ...defaultSettings,
      ...preset,
      ...simulationSettings,
    };
  }, [layoutMode, simulationSettings]);

  // Memoize node/link data - only recalculate when structural data changes
  // Following Vercel best practice: rerender-memo
  const { forceNodes, forceLinks, nodesById, visibleNodeIds } = useMemo(() => {
    const nodeMap = new Map<string, D3Node>();
    const parentMap = new Map<string, string>();
    const childrenMap = new Map<string, string[]>();

    initialNodes.forEach((node) => {
      nodeMap.set(node.id, node);
      childrenMap.set(node.id, []);
    });

    initialLinks.forEach((link) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;

      if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
        childrenMap.get(sourceId)?.push(targetId);
        parentMap.set(targetId, sourceId);
      }
    });

    const isNodeVisible = (nodeId: string): boolean => {
      let currentId: string | undefined = nodeId;
      while (currentId) {
        const parentId = parentMap.get(currentId);
        if (!parentId) return true;
        if (collapsedNodes.has(parentId)) return false;
        currentId = parentId;
      }
      return true;
    };

    const visibleNodeIdsSet = new Set<string>();
    initialNodes.forEach((node) => {
      if (isNodeVisible(node.id)) {
        visibleNodeIdsSet.add(node.id);
      }
    });

    const centerX = dimensions.width / 2 || 400;
    const centerY = dimensions.height / 2 || 300;

    const nodesByLevel = new Map<number, D3Node[]>();
    initialNodes.forEach((node) => {
      if (!visibleNodeIdsSet.has(node.id)) return;
      const level = node.level ?? 0;
      if (!nodesByLevel.has(level)) nodesByLevel.set(level, []);
      nodesByLevel.get(level)!.push(node);
    });

    const forceNodesList: ForceNode[] = [];
    const nodesByIdMap = new Map<string, ForceNode>();

    const getInitialPosition = (
      level: number,
      index: number,
      levelNodes: D3Node[],
    ): { x: number; y: number } => {
      switch (layoutMode) {
        case "radial-tree": {
          if (level === 0) return { x: centerX, y: centerY };
          const anglePerNode = (2 * Math.PI) / levelNodes.length;
          const startAngle = anglePerNode * index;
          const radius = 120 + (level - 1) * 100;
          return {
            x: centerX + Math.cos(startAngle) * radius,
            y: centerY + Math.sin(startAngle) * radius,
          };
        }

        case "progressive": {
          const progressiveRadius = level === 0 ? 0 : 150 * Math.pow(1.8, level - 1);
          const progressiveAngleStep = (2 * Math.PI) / levelNodes.length;
          const progressiveAngle = progressiveAngleStep * index;
          return {
            x: centerX + Math.cos(progressiveAngle) * progressiveRadius,
            y: centerY + Math.sin(progressiveAngle) * progressiveRadius,
          };
        }

        case "hierarchical": {
          if (level === 0) return { x: centerX, y: centerY };
          const hierParentId = parentMap.get(levelNodes[index].id);
          if (hierParentId) {
            const hierParentNode = nodesByIdMap.get(hierParentId);
            if (hierParentNode) {
              const hierSiblings = childrenMap.get(hierParentId) || [];
              const hierSiblingIndex = hierSiblings.indexOf(levelNodes[index].id);
              const hierTotalSiblings = hierSiblings.length;
              const hierParentAngle = Math.atan2(
                hierParentNode.y - centerY,
                hierParentNode.x - centerX,
              );
              const hierAngleSpread = Math.PI / 3;
              const hierAngleOffset =
                (hierSiblingIndex - (hierTotalSiblings - 1) / 2) *
                (hierAngleSpread / Math.max(hierTotalSiblings - 1, 1));
              const hierAngle = hierParentAngle + hierAngleOffset;
              const hierRadius = 180 + (level - 1) * 120;
              return {
                x: centerX + Math.cos(hierAngle) * hierRadius,
                y: centerY + Math.sin(hierAngle) * hierRadius,
              };
            }
          }
          const hierFallbackRadius = 150 + (level - 1) * 100;
          const hierFallbackAngleStep = (2 * Math.PI) / levelNodes.length;
          const hierFallbackAngle = hierFallbackAngleStep * index;
          return {
            x: centerX + Math.cos(hierFallbackAngle) * hierFallbackRadius,
            y: centerY + Math.sin(hierFallbackAngle) * hierFallbackRadius,
          };
        }

        case "concentric":
        default: {
          const concentricRadiusStep = 200;
          const concentricRadius = level * concentricRadiusStep;
          const concentricAngleStep = (2 * Math.PI) / levelNodes.length;
          const concentricAngle = concentricAngleStep * index;
          return {
            x: centerX + Math.cos(concentricAngle) * concentricRadius,
            y: centerY + Math.sin(concentricAngle) * concentricRadius,
          };
        }
      }
    };

    nodesByLevel.forEach((levelNodes, level) => {
      levelNodes.forEach((node, index) => {
        const { x: initialX, y: initialY } = getInitialPosition(level, index, levelNodes);

        // Preserve previous state if available (position and velocity)
        // This prevents the "bounce" effect when nodes are recreated
        const prevState = prevNodesStateRef.current.get(node.id);

        const forceNode: ForceNode = {
          ...node,
          label: node.label ?? "",
          color: node.color ?? "#E3F2FD",
          borderColor: node.borderColor ?? "#1976D2",
          type: node.type ?? "default",
          level: node.level ?? 0,
          isMatch: node.isMatch ?? false,
          parentId: parentMap.get(node.id),
          childIds: childrenMap.get(node.id) || [],
          // Use previous position/velocity if available, otherwise use initial
          x: prevState?.x ?? initialX,
          y: prevState?.y ?? initialY,
          vx: prevState?.vx ?? 0,
          vy: prevState?.vy ?? 0,
          initialX,
          initialY,
        };

        forceNodesList.push(forceNode);
        nodesByIdMap.set(node.id, forceNode);
      });
    });

    const linksList: ForceLink[] = [];
    initialLinks.forEach((link) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;

      if (visibleNodeIdsSet.has(sourceId) && visibleNodeIdsSet.has(targetId)) {
        linksList.push({ source: sourceId, target: targetId });
      }
    });

    return {
      forceNodes: forceNodesList,
      forceLinks: linksList,
      nodesById: nodesByIdMap,
      visibleNodeIds: visibleNodeIdsSet,
    };
  }, [initialNodes, initialLinks, dimensions.width, dimensions.height, layoutMode, collapsedNodes]);

  // Save node state before unmount or when nodes change
  useEffect(() => {
    return () => {
      // Save current node positions and velocities
      const stateMap = new Map<string, { x: number; y: number; vx: number; vy: number }>();
      forceNodes.forEach((node) => {
        stateMap.set(node.id, { x: node.x, y: node.y, vx: node.vx, vy: node.vy });
      });
      prevNodesStateRef.current = stateMap;
    };
  }, [forceNodes]);

  // Render function - reads from refs for hover state and selectedNodes
  // Following Vercel best practice: rerender-use-ref-transient-values
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const transform = transformRef.current;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    const centerX = dimensions.width / 2 || 400;
    const centerY = dimensions.height / 2 || 300;

    // Cache maxLevel calculation
    let maxLevel = 0;
    for (const node of forceNodes) {
      const level = node.level ?? 0;
      if (level > maxLevel) maxLevel = level;
    }

    for (let level = 1; level <= maxLevel; level++) {
      const radius = level * 120;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200, 200, 200, ${0.3 - level * 0.04})`;
      ctx.lineWidth = 1 / transform.k;
      ctx.setLineDash([5 / transform.k, 5 / transform.k]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (transform.k > 0.5) {
        ctx.fillStyle = `rgba(150, 150, 150, ${0.7 - level * 0.1})`;
        ctx.font = `${Math.max(10, 11 / transform.k)}px system-ui, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`Level ${level}`, centerX + radius + 8 / transform.k, centerY);
      }
    }

    // Read hover state from refs (transient values)
    const hoveredNodeId = hoveredNodeIdRef.current;
    const isHovered = isHoveringRef.current;
    const hoveredNode = hoveredNodeId ? nodesById.get(hoveredNodeId) : null;

    // Calculate connected nodes only if hovering
    const connectedNodeIds = new Set<string>();
    if (hoveredNode && isHovered) {
      connectedNodeIds.add(hoveredNode.id);

      if (hoveredNode.level === 0) {
        const childIds = hoveredNode.childIds;
        if (childIds) {
          for (const childId of childIds) {
            if (visibleNodeIds.has(childId)) connectedNodeIds.add(childId);
          }
        }
      } else {
        let currentId: string | undefined = hoveredNode.parentId;
        while (currentId) {
          connectedNodeIds.add(currentId);
          const parentNode = nodesById.get(currentId);
          currentId = parentNode?.parentId;
        }

        const addDescendants = (nodeId: string) => {
          const node = nodesById.get(nodeId);
          if (node?.childIds) {
            for (const childId of node.childIds) {
              if (visibleNodeIds.has(childId)) {
                connectedNodeIds.add(childId);
                addDescendants(childId);
              }
            }
          }
        };
        addDescendants(hoveredNode.id);
      }
    }

    // Read selected nodes from ref
    const currentSelectedNodes = selectedNodesRef.current;

    // Render links
    for (const link of forceLinks) {
      const source = typeof link.source === "string" ? nodesById.get(link.source) : link.source;
      const target = typeof link.target === "string" ? nodesById.get(link.target) : link.target;

      if (!source || !target) continue;

      const isConnected =
        isHovered && connectedNodeIds.has(source.id) && connectedNodeIds.has(target.id);

      if (isHovered && !isConnected) {
        ctx.strokeStyle = "rgba(150, 150, 150, 0.1)";
        ctx.lineWidth = 0.5 / transform.k;
      } else if (isConnected) {
        ctx.strokeStyle = "rgba(147, 112, 219, 0.9)";
        ctx.lineWidth = 2.5 / transform.k;
        ctx.shadowColor = "rgba(147, 112, 219, 0.6)";
        ctx.shadowBlur = 10 / transform.k;
      } else {
        ctx.strokeStyle = "rgba(100, 100, 100, 0.4)";
        ctx.lineWidth = 1.2 / transform.k;
      }

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();

      if (isConnected) {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }
    }

    // Render nodes
    for (const node of forceNodes) {
      const isNodeHovered = hoveredNode?.id === node.id;
      const isConnected = isHovered && connectedNodeIds.has(node.id);
      const isSelected = currentSelectedNodes.has(node.id);
      const radius = getNodeRadius(node.level ?? 0);

      if (isHovered && !isConnected) ctx.globalAlpha = 0.25;

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#A5D6A7" : (node.color ?? "#E3F2FD");
      ctx.fill();

      ctx.lineWidth = (isNodeHovered ? 4 : isConnected ? 3 : 2) / transform.k;
      ctx.strokeStyle = isConnected
        ? "#9370DB"
        : node.isMatch
          ? "#FFC107"
          : (node.borderColor ?? "#1976D2");
      ctx.stroke();

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 8 / transform.k, 0, Math.PI * 2);
        ctx.strokeStyle = "#22C55E";
        ctx.lineWidth = 3 / transform.k;
        ctx.stroke();
      }

      if (isNodeHovered || isConnected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 5 / transform.k, 0, Math.PI * 2);
        ctx.strokeStyle = isNodeHovered ? "rgba(255, 193, 7, 0.6)" : "rgba(147, 112, 219, 0.5)";
        ctx.lineWidth = 3 / transform.k;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      if (showLevelLabels) {
        const badgeRadius = Math.max(7, 9 / transform.k);
        const badgeY = node.y - radius - badgeRadius / 2;
        ctx.beginPath();
        ctx.arc(node.x, badgeY, badgeRadius, 0, Math.PI * 2);
        ctx.fillStyle = isConnected ? "#9370DB" : node.level === 0 ? "#7B1FA2" : "#3B82F6";
        ctx.fill();
        ctx.lineWidth = 1 / transform.k;
        ctx.strokeStyle = "white";
        ctx.stroke();
        ctx.fillStyle = "white";
        ctx.font = `bold ${Math.max(8, 9 / transform.k)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(node.level), node.x, badgeY);
      }

      if (showChildCount && node.childIds && node.childIds.length > 0 && transform.k > 0.6) {
        const countRadius = Math.max(8, 10 / transform.k);
        const countX = node.x + radius * 0.7;
        const countY = node.y - radius * 0.7;
        ctx.beginPath();
        ctx.arc(countX, countY, countRadius, 0, Math.PI * 2);
        ctx.fillStyle = "#10B981";
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.font = `bold ${Math.max(8, 9 / transform.k)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(node.childIds.length), countX, countY);
      }

      if (node.childIds && node.childIds.length > 0 && transform.k > 0.6) {
        const isCollapsed = collapsedNodes.has(node.id);
        const btnRadius = Math.max(7, 9 / transform.k);
        let btnX: number;
        let btnY: number;

        if (node.parentId && nodesById.has(node.parentId)) {
          const parentNode = nodesById.get(node.parentId)!;
          const angle = Math.atan2(node.y - parentNode.y, node.x - parentNode.x);
          btnX = node.x + Math.cos(angle) * radius;
          btnY = node.y + Math.sin(angle) * radius;
        } else {
          btnX = node.x;
          btnY = node.y + radius;
        }

        ctx.beginPath();
        ctx.arc(btnX, btnY, btnRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.fill();
        ctx.lineWidth = 1.5 / transform.k;
        ctx.strokeStyle = "#64748b";
        ctx.stroke();
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 1.5 / transform.k;
        ctx.beginPath();
        ctx.moveTo(btnX - btnRadius * 0.4, btnY);
        ctx.lineTo(btnX + btnRadius * 0.4, btnY);
        if (isCollapsed) {
          ctx.moveTo(btnX, btnY - btnRadius * 0.4);
          ctx.lineTo(btnX, btnY + btnRadius * 0.4);
        }
        ctx.stroke();
      }

      if (isNodeHovered || isConnected || isSelected || transform.k > 0.7) {
        const labelY = node.y + radius + 14 / transform.k;
        const fontSize = Math.max(10, 11 / transform.k);
        ctx.font = `${isNodeHovered || isConnected || isSelected ? "bold " : ""}${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const metrics = ctx.measureText(node.label ?? "");
        const padding = 3 / transform.k;
        ctx.fillStyle = isSelected
          ? "rgba(34, 197, 94, 0.2)"
          : isNodeHovered || isConnected
            ? "rgba(255, 255, 255, 1)"
            : "rgba(255, 255, 255, 0.95)";
        ctx.beginPath();
        ctx.roundRect(
          node.x - metrics.width / 2 - padding,
          labelY - padding,
          metrics.width + padding * 2,
          fontSize + padding * 2,
          3 / transform.k,
        );
        ctx.fill();
        ctx.fillStyle = isSelected ? "#16A34A" : isConnected ? "#9370DB" : "#1F2937";
        ctx.fillText(node.label ?? "", node.x, labelY);
      }
    }

    ctx.restore();
  }, [
    forceNodes,
    forceLinks,
    nodesById,
    collapsedNodes,
    dimensions,
    showLevelLabels,
    showChildCount,
    visibleNodeIds,
    // Note: selectedNodes is NOT in dependencies - we read from ref
  ]);

  // Report node positions to parent (throttled to 30fps)
  useEffect(() => {
    if (!onNodesPositionUpdate) return;

    let rafId: number;
    let lastUpdateTime = 0;
    const updateInterval = 1000 / 30; // 30fps for position updates

    const updatePositions = (currentTime: number) => {
      const deltaTime = currentTime - lastUpdateTime;

      if (deltaTime >= updateInterval) {
        // Report current positions
        const positions = forceNodes.map((node) => ({
          id: node.id,
          x: node.x,
          y: node.y,
          level: node.level,
        }));
        onNodesPositionUpdate(positions);
        lastUpdateTime = currentTime - (deltaTime % updateInterval);
      }

      rafId = requestAnimationFrame(updatePositions);
    };

    rafId = requestAnimationFrame(updatePositions);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [forceNodes, onNodesPositionUpdate]);

  // Animation loop - runs continuously but only renders when needed
  useEffect(() => {
    let rafId: number;
    let lastRenderTime = 0;
    const targetFPS = 60;
    const frameInterval = 1000 / targetFPS;

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastRenderTime;

      // Only render if enough time has passed (throttle to 60fps)
      // AND if simulation is running or we have pending updates
      if (deltaTime >= frameInterval) {
        render();
        lastRenderTime = currentTime - (deltaTime % frameInterval);
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [render]);

  // Initialize or update simulation
  // Key insight: Don't recreate simulation, just update it
  useEffect(() => {
    if (forceNodes.length === 0 || dimensions.width === 0) return;

    // If simulation already exists, just update forces and nodes
    if (simulationRef.current) {
      const sim = simulationRef.current;

      // Update nodes in simulation without recreating
      sim.nodes(forceNodes as SimulationNodeDatum[]);

      // Update link force
      const linkForce = forceLink(forceLinks as SimulationLinkDatum<SimulationNodeDatum>[])
        .id((d: SimulationNodeDatum) => (d as ForceNode).id)
        .distance(settings.linkDistance)
        .strength(settings.linkStrength);
      sim.force("link", linkForce);

      // Update center force with new dimensions
      sim.force(
        "center",
        forceCenter(dimensions.width / 2, dimensions.height / 2).strength(settings.centerStrength),
      );

      // Update position forces
      sim.force(
        "x",
        forceX((d: SimulationNodeDatum) => (d as ForceNode).initialX).strength(
          settings.positionStrength,
        ),
      );
      sim.force(
        "y",
        forceY((d: SimulationNodeDatum) => (d as ForceNode).initialY).strength(
          settings.positionStrength,
        ),
      );

      // Update collision force
      if (collisionMode === "full") {
        sim.force("collide", forceCollide().radius(settings.collideRadius).strength(1));
      } else if (collisionMode === "minimal") {
        sim.force("collide", forceCollide().radius(25).strength(0.5));
      } else {
        sim.force("collide", null);
      }

      // Gentle re-heat, not full restart
      // Using low alpha to prevent "bounce" effect
      sim.alpha(0.05).restart();

      return;
    }

    // Only create new simulation if one doesn't exist
    const simulation = forceSimulation(forceNodes as SimulationNodeDatum[])
      .force(
        "charge",
        forceManyBody().strength(settings.chargeStrength).distanceMax(settings.chargeDistanceMax),
      )
      .force(
        "center",
        forceCenter(dimensions.width / 2, dimensions.height / 2).strength(settings.centerStrength),
      )
      .force(
        "link",
        forceLink(forceLinks as SimulationLinkDatum<SimulationNodeDatum>[])
          .id((d: SimulationNodeDatum) => (d as ForceNode).id)
          .distance(settings.linkDistance)
          .strength(settings.linkStrength),
      );

    if (collisionMode === "full") {
      simulation.force("collide", forceCollide().radius(settings.collideRadius).strength(1));
    } else if (collisionMode === "minimal") {
      simulation.force("collide", forceCollide().radius(25).strength(0.5));
    }

    simulation
      .force(
        "x",
        forceX((d: SimulationNodeDatum) => (d as ForceNode).initialX).strength(
          settings.positionStrength,
        ),
      )
      .force(
        "y",
        forceY((d: SimulationNodeDatum) => (d as ForceNode).initialY).strength(
          settings.positionStrength,
        ),
      )
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    simulationRef.current = simulation;

    // Initial warm-up
    simulation.tick(100);
    simulation.alpha(0.1).restart();

    return () => {
      simulation.stop();
    };
  }, [forceNodes, forceLinks, dimensions, settings, collisionMode]);

  // Zoom behavior
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.3, 4])
      .filter((event) => {
        if (event.type === "wheel") return true;
        if (event.type === "dblclick") return false;
        if (draggedNodeRef.current || isHoveringRef.current) return false;
        return true;
      })
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        setViewportTransform({ x: event.transform.x, y: event.transform.y, k: event.transform.k });
        onViewportChange?.({ x: event.transform.x, y: event.transform.y, k: event.transform.k });
      });

    select(canvas).call(zoomBehavior);
  }, [onViewportChange]);

  // Resize handler
  useEffect(() => {
    const update = () => {
      if (containerRef.current && canvasRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        setDimensions({ width, height });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const getNodeAtPosition = useCallback(
    (clientX: number, clientY: number): ForceNode | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const y = (clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      let closest: ForceNode | null = null;
      let minDist = Infinity;

      for (const node of forceNodes) {
        const radius = getNodeRadius(node.level ?? 0);
        const dx = x - node.x;
        const dy = y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius + 8 && dist < minDist) {
          minDist = dist;
          closest = node;
        }
      }

      return closest;
    },
    [forceNodes],
  );

  const isClickOnExpandButton = useCallback(
    (node: ForceNode, clientX: number, clientY: number): boolean => {
      if (!node.childIds || node.childIds.length === 0) return false;

      const canvas = canvasRef.current;
      if (!canvas) return false;

      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const y = (clientY - rect.top - transformRef.current.y) / transformRef.current.k;
      const radius = getNodeRadius(node.level ?? 0);
      const btnRadius = Math.max(7, 9 / transformRef.current.k);

      let btnX: number;
      let btnY: number;

      if (node.parentId && nodesById.has(node.parentId)) {
        const parentNode = nodesById.get(node.parentId)!;
        const angle = Math.atan2(node.y - parentNode.y, node.x - parentNode.x);
        btnX = node.x + Math.cos(angle) * radius;
        btnY = node.y + Math.sin(angle) * radius;
      } else {
        btnX = node.x;
        btnY = node.y + radius;
      }

      const dx = x - btnX;
      const dy = y - btnY;
      return Math.sqrt(dx * dx + dy * dy) <= btnRadius + 2 / transformRef.current.k;
    },
    [nodesById],
  );

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (isDragging) {
        setIsDragging(false);
        clickedOnExpandButtonRef.current = false;
        onSelectionChange?.(new Set());
        return;
      }

      if (doubleClickRef.current) {
        doubleClickRef.current = false;
        return;
      }

      const clickedNode = getNodeAtPosition(event.clientX, event.clientY);
      const wasExpandButtonClick =
        clickedOnExpandButtonRef.current ||
        (clickedNode ? isClickOnExpandButton(clickedNode, event.clientX, event.clientY) : false);

      clickedOnExpandButtonRef.current = false;

      if (clickedNode && wasExpandButtonClick) {
        onNodeToggle?.(clickedNode.id);
        onSelectionChange?.(new Set());
        return;
      }

      if (clickedNode) {
        if (tooltipTimeoutRef.current) {
          clearTimeout(tooltipTimeoutRef.current);
          tooltipTimeoutRef.current = null;
        }
        onNodeHover?.(null);

        if (event.ctrlKey || event.metaKey) {
          const newSelection = new Set(selectedNodesRef.current);
          if (newSelection.has(clickedNode.id)) {
            newSelection.delete(clickedNode.id);
          } else {
            newSelection.add(clickedNode.id);
          }
          onSelectionChange?.(newSelection);
        } else {
          onSelectionChange?.(new Set([clickedNode.id]));
        }

        onNodeClick?.(clickedNode.id, event);
      } else {
        onSelectionChange?.(new Set());
      }
    },
    [
      getNodeAtPosition,
      isClickOnExpandButton,
      isDragging,
      onNodeToggle,
      onSelectionChange,
      onNodeHover,
      onNodeClick,
    ],
  );

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      doubleClickRef.current = true;
      const clickedNode = getNodeAtPosition(event.clientX, event.clientY);
      if (clickedNode?.childIds && clickedNode.childIds.length > 0) {
        onNodeToggle?.(clickedNode.id);
        onNodeDoubleClick?.(clickedNode.id, event);
      }
    },
    [getNodeAtPosition, onNodeToggle, onNodeDoubleClick],
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const clickedNode = getNodeAtPosition(event.clientX, event.clientY);
      if (clickedNode && isClickOnExpandButton(clickedNode, event.clientX, event.clientY)) {
        clickedOnExpandButtonRef.current = true;
        return;
      }

      clickedOnExpandButtonRef.current = false;
      if (!clickedNode) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const y = (event.clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      dragOffsetRef.current = { x: x - clickedNode.x, y: y - clickedNode.y };
      dragStartPosRef.current = { x: event.clientX, y: event.clientY };
      setIsDragging(false);
      draggedNodeRef.current = clickedNode;
      clickedNode.fx = clickedNode.x;
      clickedNode.fy = clickedNode.y;
      simulationRef.current?.alpha(0.3).restart();
    },
    [getNodeAtPosition, isClickOnExpandButton],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (draggedNodeRef.current) {
        const dx = event.clientX - dragStartPosRef.current.x;
        const dy = event.clientY - dragStartPosRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 3) {
          setIsDragging(true);
          if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
            tooltipTimeoutRef.current = null;
          }
          hoveredNodeIdRef.current = null;
          isHoveringRef.current = false;
          onSelectionChange?.(new Set());
        }

        if (isDragging) {
          const rect = canvas.getBoundingClientRect();
          const x = (event.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
          const y = (event.clientY - rect.top - transformRef.current.y) / transformRef.current.k;
          draggedNodeRef.current.fx = x - dragOffsetRef.current.x;
          draggedNodeRef.current.fy = y - dragOffsetRef.current.y;
          simulationRef.current?.alpha(0.3).restart();
          return;
        }
      }

      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const y = (event.clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      let closestNode: ForceNode | undefined;
      let minDist = Infinity;

      for (const node of forceNodes) {
        const radius = getNodeRadius(node.level ?? 0);
        const dx = x - node.x;
        const dy = y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius + 8 && dist < minDist) {
          minDist = dist;
          closestNode = node;
        }
      }

      if (closestNode) {
        if (tooltipTimeoutRef.current) {
          clearTimeout(tooltipTimeoutRef.current);
          tooltipTimeoutRef.current = null;
        }
        const nodeId = closestNode.id;
        if (hoveredNodeIdRef.current !== nodeId) {
          hoveredNodeIdRef.current = nodeId;
          isHoveringRef.current = true;
          onNodeHover?.(nodeId);
        }
      } else if (!tooltipTimeoutRef.current) {
        tooltipTimeoutRef.current = setTimeout(() => {
          if (hoveredNodeIdRef.current !== null) {
            hoveredNodeIdRef.current = null;
            isHoveringRef.current = false;
            onNodeHover?.(null);
          }
          tooltipTimeoutRef.current = null;
        }, 150);
      }
    },
    [forceNodes, isDragging, onNodeHover, onSelectionChange],
  );

  const handleMouseUp = useCallback(() => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current = null;
      simulationRef.current?.alpha(0.3).restart();
    }
  }, []);

  return (
    <div ref={containerRef} className={`${styles.d3SimpleView} ${className || ""}`}>
      <canvas
        ref={canvasRef}
        className={`${styles.canvas} ${canvasClassName || ""} ${
          isDragging
            ? styles["canvas--grabbing"]
            : isHoveringRef.current
              ? styles["canvas--pointer"]
              : styles["canvas--grab"]
        }`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseUp}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleCanvasClick}
        onDoubleClick={handleDoubleClick}
      />
      {children}
    </div>
  );
}
