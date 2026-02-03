import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
import type { Edge } from "@xyflow/react";
import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";
import type { CustomNode } from "../../types";
import { Toolbar } from "../controls/Toolbar";
import { Overview } from "../controls/Overview";
import styles from "./D3SimpleView.module.css";

const ALLOW_SELECTION = true;
const ALLOW_EXPAND_COLLAPSE = true;
const ALLOW_ADD_DELETE = true;

interface ForceNode extends SimulationNodeDatum {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  borderColor: string;
  type: string;
  level: number;
  isMatch: boolean;
  parentId?: string;
  childIds: string[];
  initialX: number;
  initialY: number;
  fx?: number | null;
  fy?: number | null;
}

interface ForceLink extends SimulationLinkDatum<ForceNode> {
  source: string | ForceNode;
  target: string | ForceNode;
}

interface D3SimpleViewProps {
  nodes: CustomNode[];
  edges: Edge[];
  searchResults: Array<{ node: CustomNode; matches: boolean }>;
  layoutMode?: LayoutMode;
  collisionMode?: CollisionMode;
  showLevelLabels?: boolean;
  showChildCount?: boolean;
}

export type LayoutMode = "concentric" | "progressive" | "hierarchical" | "radial-tree" | "cluster";
export type CollisionMode = "full" | "minimal" | "none";

export const D3SimpleView = ({
  nodes: initialNodes,
  edges: initialEdges,
  searchResults,
  layoutMode = "concentric",
  collisionMode = "full",
  showLevelLabels = false,
  showChildCount: showChildCountProp = false,
}: D3SimpleViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation> | null>(null);
  const transformRef = useRef(zoomIdentity);
  const rafRef = useRef<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredNode, setHoveredNode] = useState<ForceNode | null>(null);
  const [isOverviewOpen, setIsOverviewOpen] = useState(true);
  const [viewportTransform, setViewportTransform] = useState({ x: 0, y: 0, k: 1 });
  const [allowNodeDrag, setAllowNodeDrag] = useState(true);

  // Local state for nodes and edges (initialized from props)
  const [nodesState, setNodesState] = useState<CustomNode[]>(initialNodes);
  const [edgesState, setEdgesState] = useState<Edge[]>(initialEdges);

  // Selection state
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());

  // Expand/collapse state - initially collapse all nodes including root
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => {
    const allNodeIds = new Set<string>();
    initialNodes.forEach((node) => {
      allNodeIds.add(node.id);
    });
    return allNodeIds;
  });
  const [isDragging, setIsDragging] = useState(false);

  // Drag state
  const draggedNodeRef = useRef<ForceNode>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const clickedOnExpandButtonRef = useRef(false);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update local state when props change
  useEffect(() => {
    setNodesState(initialNodes);
  }, [initialNodes]);

  useEffect(() => {
    setEdgesState(initialEdges);
  }, [initialEdges]);

  const getAllDescendants = useCallback(
    (nodeId: string, nodesById: Map<string, ForceNode>): Set<string> => {
      const descendants = new Set<string>();
      const node = nodesById.get(nodeId);
      if (!node) return descendants;

      const addDescendants = (currentId: string) => {
        const currentNode = nodesById.get(currentId);
        if (!currentNode) return;
        currentNode.childIds.forEach((childId) => {
          descendants.add(childId);
          addDescendants(childId);
        });
      };

      addDescendants(nodeId);
      return descendants;
    },
    [],
  );

  // Memoize search results as Map for O(1) lookup instead of O(n) find
  const searchResultsMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const result of searchResults) {
      map.set(result.node.id, result.matches);
    }
    return map;
  }, [searchResults]);

  // Build hierarchical structure with parent-child relationships
  const { forceNodes, forceLinks, nodesById, visibleNodeIds } = useMemo(() => {
    const visibleCount = Math.min(nodesState.length, 200);
    const visibleNodes = nodesState.slice(0, visibleCount);

    // Build relationships
    const nodeMap = new Map<string, CustomNode>();
    const parentMap = new Map<string, string>();
    const childrenMap = new Map<string, string[]>();

    visibleNodes.forEach((node) => {
      nodeMap.set(node.id, node);
      childrenMap.set(node.id, []);
    });

    edgesState.forEach((edge) => {
      if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
        childrenMap.get(edge.source)?.push(edge.target);
        parentMap.set(edge.target, edge.source);
      }
    });

    // Calculate visible nodes - only show direct children of expanded nodes
    const isNodeVisible = (nodeId: string): boolean => {
      const parentId = parentMap.get(nodeId);
      if (!parentId) return true; // Root node is always visible
      // Node is visible only if its direct parent is expanded (not collapsed)
      return !collapsedNodes.has(parentId);
    };

    const visibleNodeIdsSet = new Set<string>();
    visibleNodes.forEach((node) => {
      if (isNodeVisible(node.id)) {
        visibleNodeIdsSet.add(node.id);
      }
    });

    // Calculate initial positions based on layout mode
    const centerX = dimensions.width / 2 || 400;
    const centerY = dimensions.height / 2 || 300;

    // Group by level
    const nodesByLevel = new Map<number, CustomNode[]>();
    visibleNodes.forEach((node) => {
      if (!visibleNodeIdsSet.has(node.id)) return;
      const level = node.data.metadata.level;
      if (!nodesByLevel.has(level)) nodesByLevel.set(level, []);
      nodesByLevel.get(level)!.push(node);
    });

    // Create force nodes with initial positions
    const forceNodesList: ForceNode[] = [];
    const nodesByIdMap = new Map<string, ForceNode>();

    // Calculate positions based on layout mode
    const getInitialPosition = (
      level: number,
      index: number,
      levelNodes: CustomNode[],
    ): { x: number; y: number } => {
      switch (layoutMode) {
        case "radial-tree": {
          if (level === 0) {
            return { x: centerX, y: centerY };
          }

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
          if (level === 0) {
            return { x: centerX, y: centerY };
          }

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
        const isMatch = searchResultsMap.get(node.id) ?? false;
        const style = (node.style as Record<string, string>) || {};

        const { x: initialX, y: initialY } = getInitialPosition(level, index, levelNodes);

        const forceNode: ForceNode = {
          id: node.id,
          label: node.data.label,
          x: initialX,
          y: initialY,
          vx: 0,
          vy: 0,
          color: style.background || "#E3F2FD",
          borderColor: isMatch ? "#FFC107" : style.border?.split(" ")[2] || "#1976D2",
          type: node.data.metadata.type,
          level,
          isMatch,
          parentId: parentMap.get(node.id),
          childIds: childrenMap.get(node.id) || [],
          initialX,
          initialY,
        };

        forceNodesList.push(forceNode);
        nodesByIdMap.set(node.id, forceNode);
      });
    });

    // Create links (only for visible nodes)
    const linksList: ForceLink[] = [];
    edgesState.forEach((edge) => {
      if (visibleNodeIdsSet.has(edge.source) && visibleNodeIdsSet.has(edge.target)) {
        linksList.push({
          source: edge.source,
          target: edge.target,
        });
      }
    });

    return {
      forceNodes: forceNodesList,
      forceLinks: linksList,
      nodesById: nodesByIdMap,
      visibleNodeIds: visibleNodeIdsSet,
    };
  }, [
    nodesState,
    edgesState,
    dimensions.width,
    dimensions.height,
    layoutMode,
    searchResultsMap,
    collapsedNodes,
  ]);

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

    // Draw level circles (rings)
    const maxLevel = Math.max(...forceNodes.map((n) => n.level), 0);
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

    // Determine connected nodes when hovering
    const connectedNodeIds = new Set<string>();
    if (hoveredNode) {
      connectedNodeIds.add(hoveredNode.id);

      if (hoveredNode.level === 0) {
        hoveredNode.childIds.forEach((childId) => {
          if (visibleNodeIds.has(childId)) {
            connectedNodeIds.add(childId);
          }
        });
      } else {
        let currentId: string | undefined = hoveredNode.parentId;
        while (currentId) {
          connectedNodeIds.add(currentId);
          const parentNode = nodesById.get(currentId);
          currentId = parentNode?.parentId;
        }

        const addDescendants = (nodeId: string) => {
          const node = nodesById.get(nodeId);
          if (node) {
            node.childIds.forEach((childId) => {
              if (visibleNodeIds.has(childId)) {
                connectedNodeIds.add(childId);
                addDescendants(childId);
              }
            });
          }
        };
        addDescendants(hoveredNode.id);
      }
    }

    // Draw links
    const isHovered = !!hoveredNode;

    forceLinks.forEach((link) => {
      const source = typeof link.source === "string" ? nodesById.get(link.source) : link.source;
      const target = typeof link.target === "string" ? nodesById.get(link.target) : link.target;

      if (!source || !target) return;

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
    });

    // Draw nodes
    forceNodes.forEach((node) => {
      const isNodeHovered = hoveredNode?.id === node.id;
      const isConnected = isHovered && connectedNodeIds.has(node.id);
      const isSelected = selectedNodes.has(node.id);
      const radius = node.level === 0 ? 22 : node.level === 1 ? 16 : 11;

      // Dim non-connected nodes
      if (isHovered && !isConnected) {
        ctx.globalAlpha = 0.25;
      }

      // Node circle - use lighter color when selected
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#A5D6A7" : node.color;
      ctx.fill();

      // Border
      ctx.lineWidth = (isNodeHovered ? 4 : isConnected ? 3 : 2) / transform.k;
      ctx.strokeStyle = isConnected ? "#9370DB" : node.isMatch ? "#FFC107" : node.borderColor;
      ctx.stroke();

      // Selection ring (green)
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 8 / transform.k, 0, Math.PI * 2);
        ctx.strokeStyle = "#22C55E";
        ctx.lineWidth = 3 / transform.k;
        ctx.stroke();
      }

      // Highlight ring
      if (isNodeHovered || isConnected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 5 / transform.k, 0, Math.PI * 2);
        ctx.strokeStyle = isNodeHovered ? "rgba(255, 193, 7, 0.6)" : "rgba(147, 112, 219, 0.5)";
        ctx.lineWidth = 3 / transform.k;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      // Level badge (only if showLevelLabels is true)
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

      // Child count badge (if has children)
      if (showChildCountProp && node.childIds.length > 0 && transform.k > 0.6) {
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

      // Expand/Collapse button - positioned at the edge towards children
      if (ALLOW_EXPAND_COLLAPSE && node.childIds.length > 0 && transform.k > 0.6) {
        const isCollapsed = collapsedNodes.has(node.id);
        const btnRadius = Math.max(7, 9 / transform.k);

        // Calculate position at the edge away from parent (towards children)
        let btnX: number;
        let btnY: number;

        if (node.parentId && nodesById.has(node.parentId)) {
          const parentNode = nodesById.get(node.parentId)!;
          // Calculate angle from parent to node (opposite direction)
          const angle = Math.atan2(node.y - parentNode.y, node.x - parentNode.x);
          // Position button at the edge of the node away from parent (towards children)
          btnX = node.x + Math.cos(angle) * radius;
          btnY = node.y + Math.sin(angle) * radius;
        } else {
          // Root node - position at bottom (towards children)
          btnX = node.x;
          btnY = node.y + radius;
        }

        // Button - outline style only, slate/gray color
        ctx.beginPath();
        ctx.arc(btnX, btnY, btnRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.fill();
        ctx.lineWidth = 1.5 / transform.k;
        ctx.strokeStyle = "#64748b"; // slate-500
        ctx.stroke();

        // Plus/Minus sign - slate color
        ctx.strokeStyle = "#64748b"; // slate-500
        ctx.lineWidth = 1.5 / transform.k;
        ctx.beginPath();
        // Horizontal line
        ctx.moveTo(btnX - btnRadius * 0.4, btnY);
        ctx.lineTo(btnX + btnRadius * 0.4, btnY);

        // Vertical line (only for plus/collapsed)
        if (isCollapsed) {
          ctx.moveTo(btnX, btnY - btnRadius * 0.4);
          ctx.lineTo(btnX, btnY + btnRadius * 0.4);
        }
        ctx.stroke();
      }

      // Label
      if (isNodeHovered || isConnected || transform.k > 0.7) {
        const labelY = node.y + radius + 14 / transform.k;
        const fontSize = Math.max(10, 11 / transform.k);

        ctx.font = `${isNodeHovered || isConnected ? "bold " : ""}${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        const metrics = ctx.measureText(node.label);
        const padding = 3 / transform.k;
        ctx.fillStyle =
          isNodeHovered || isConnected ? "rgba(255, 255, 255, 1)" : "rgba(255, 255, 255, 0.95)";
        ctx.beginPath();
        ctx.roundRect(
          node.x - metrics.width / 2 - padding,
          labelY - padding,
          metrics.width + padding * 2,
          fontSize + padding * 2,
          3 / transform.k,
        );
        ctx.fill();

        ctx.fillStyle = isConnected ? "#9370DB" : "#1F2937";
        ctx.fillText(node.label, node.x, labelY);
      }
    });

    ctx.restore();
  }, [
    forceNodes,
    forceLinks,
    nodesById,
    hoveredNode,
    selectedNodes,
    collapsedNodes,
    dimensions,
    showLevelLabels,
    showChildCountProp,
    visibleNodeIds,
  ]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      render();
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [render]);

  // Force simulation with layout mode-specific forces
  useEffect(() => {
    if (forceNodes.length === 0 || dimensions.width === 0) {
      return undefined;
    }

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    let chargeStrength = -800;
    let chargeDistanceMax = 1000;
    let linkDistance = 150;
    let linkStrength = 0.5;
    let collideRadius = 45;
    const collideStrength = 1.0;
    let positionStrength = 0.02;
    let centerStrength = 0.02;

    switch (layoutMode) {
      case "progressive":
        chargeStrength = -1200;
        chargeDistanceMax = 1500;
        linkDistance = 200;
        linkStrength = 0.3;
        collideRadius = 55;
        positionStrength = 0.015;
        centerStrength = 0.01;
        break;

      case "hierarchical":
        chargeStrength = -500;
        chargeDistanceMax = 800;
        linkDistance = 180;
        linkStrength = 0.7;
        collideRadius = 40;
        positionStrength = 0.04;
        centerStrength = 0.03;
        break;

      case "concentric":
      default:
        break;
    }

    const simulation = forceSimulation(forceNodes as SimulationNodeDatum[])
      .force("charge", forceManyBody().strength(chargeStrength).distanceMax(chargeDistanceMax))
      .force(
        "center",
        forceCenter(dimensions.width / 2, dimensions.height / 2).strength(centerStrength),
      )
      .force(
        "link",
        forceLink(forceLinks as SimulationLinkDatum<SimulationNodeDatum>[])
          .id((d: SimulationNodeDatum) => (d as ForceNode).id)
          .distance(linkDistance)
          .strength(linkStrength),
      );

    if (collisionMode === "full") {
      simulation.force("collide", forceCollide().radius(collideRadius).strength(collideStrength));
    } else if (collisionMode === "minimal") {
      simulation.force("collide", forceCollide().radius(25).strength(0.5));
    }

    simulation
      .force(
        "x",
        forceX((d: SimulationNodeDatum) => (d as ForceNode).initialX).strength(positionStrength),
      )
      .force(
        "y",
        forceY((d: SimulationNodeDatum) => (d as ForceNode).initialY).strength(positionStrength),
      )
      .alphaDecay(0.015)
      .velocityDecay(0.5);

    simulationRef.current = simulation;
    simulation.tick(80);

    return () => {
      simulation.stop();
    };
  }, [forceNodes, forceLinks, dimensions, layoutMode, collisionMode]);

  // Zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.3, 4])
      .filter((event) => {
        // Allow zoom on wheel events always
        if (event.type === "wheel") return true;
        // Disable zoom on double click to allow our custom double click handler
        if (event.type === "dblclick") return false;
        // Disable zoom when dragging a node or when hovering a node (to allow click/drag)
        if (draggedNodeRef.current || hoveredNode) return false;
        // Allow zoom on background drag (pan)
        return true;
      })
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        setViewportTransform({ x: event.transform.x, y: event.transform.y, k: event.transform.k });
      });

    select(canvas).call(zoomBehavior);
  }, [hoveredNode]);

  // Resize
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

  // Get node at position (for click handling)
  const getNodeAtPosition = useCallback(
    (clientX: number, clientY: number): ForceNode | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const y = (clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      let closest: ForceNode | null = null;
      let minDist = Infinity;

      forceNodes.forEach((node) => {
        const radius = node.level === 0 ? 22 : node.level === 1 ? 16 : 11;
        const dx = x - node.x;
        const dy = y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < radius + 8 && dist < minDist) {
          minDist = dist;
          closest = node;
        }
      });

      return closest;
    },
    [forceNodes],
  );

  // Check if clicking on expand/collapse button
  const isClickOnExpandButton = useCallback(
    (node: ForceNode, clientX: number, clientY: number): boolean => {
      if (!ALLOW_EXPAND_COLLAPSE || node.childIds.length === 0) return false;

      const canvas = canvasRef.current;
      if (!canvas) return false;

      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const y = (clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      const radius = node.level === 0 ? 22 : node.level === 1 ? 16 : 11;
      const btnRadius = Math.max(7, 9 / transformRef.current.k);

      // Calculate button position at edge towards children (away from parent)
      let btnX: number;
      let btnY: number;

      if (node.parentId && nodesById.has(node.parentId)) {
        const parentNode = nodesById.get(node.parentId)!;
        // Angle from parent to node (towards children)
        const angle = Math.atan2(node.y - parentNode.y, node.x - parentNode.x);
        btnX = node.x + Math.cos(angle) * radius;
        btnY = node.y + Math.sin(angle) * radius;
      } else {
        // Root node - button at bottom
        btnX = node.x;
        btnY = node.y + radius;
      }

      const dx = x - btnX;
      const dy = y - btnY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      return dist <= btnRadius + 2 / transformRef.current.k;
    },
    [nodesById],
  );

  // Ref to track if a double click occurred
  const doubleClickRef = useRef(false);

  // Handle node click for selection
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!ALLOW_SELECTION) return;

      // Don't process click if we were dragging
      if (isDragging) {
        setIsDragging(false);
        clickedOnExpandButtonRef.current = false;
        return;
      }

      // Skip click handling if this was a double click
      if (doubleClickRef.current) {
        doubleClickRef.current = false;
        return;
      }

      const clickedNode = getNodeAtPosition(event.clientX, event.clientY);

      // Check if clicking on expand/collapse button (either from ref or direct check)
      const wasExpandButtonClick =
        clickedOnExpandButtonRef.current ||
        (clickedNode ? isClickOnExpandButton(clickedNode, event.clientX, event.clientY) : false);

      // Reset the ref
      clickedOnExpandButtonRef.current = false;

      if (clickedNode && wasExpandButtonClick) {
        // Toggle expand/collapse
        setCollapsedNodes((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(clickedNode.id)) {
            newSet.delete(clickedNode.id);
          } else {
            newSet.add(clickedNode.id);
          }
          return newSet;
        });
        // Deselect node when clicking expand/collapse button
        setSelectedNodes(new Set());
        return;
      }

      if (clickedNode) {
        // Close tooltip when selecting a node
        if (tooltipTimeoutRef.current) {
          clearTimeout(tooltipTimeoutRef.current);
          tooltipTimeoutRef.current = null;
        }
        setHoveredNode(null);

        // Handle selection
        if (event.ctrlKey || event.metaKey) {
          setSelectedNodes((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(clickedNode.id)) {
              newSet.delete(clickedNode.id);
            } else {
              newSet.add(clickedNode.id);
            }
            return newSet;
          });
        } else {
          // Select the node
          setSelectedNodes(new Set([clickedNode.id]));
        }
      } else {
        // Click outside any node - deselect
        setSelectedNodes(new Set());
      }
    },
    [getNodeAtPosition, isClickOnExpandButton, isDragging],
  );

  // Handle double-click to expand node (only expand, not collapse)
  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!ALLOW_EXPAND_COLLAPSE) return;

      // Mark that a double click occurred
      doubleClickRef.current = true;

      const clickedNode = getNodeAtPosition(event.clientX, event.clientY);

      if (clickedNode && clickedNode.childIds.length > 0) {
        // Only expand if currently collapsed
        setCollapsedNodes((prev) => {
          if (prev.has(clickedNode.id)) {
            const newSet = new Set(prev);
            newSet.delete(clickedNode.id);
            return newSet;
          }
          return prev; // If already expanded, do nothing
        });
      }
    },
    [getNodeAtPosition],
  );

  // Handle mouse down for dragging
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const clickedNode = getNodeAtPosition(event.clientX, event.clientY);

      // Check if clicking on expand/collapse button
      if (clickedNode && isClickOnExpandButton(clickedNode, event.clientX, event.clientY)) {
        clickedOnExpandButtonRef.current = true;
        return;
      }

      clickedOnExpandButtonRef.current = false;

      if (!allowNodeDrag || !clickedNode) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const y = (event.clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      dragOffsetRef.current = {
        x: x - clickedNode.x,
        y: y - clickedNode.y,
      };

      dragStartPosRef.current = { x: event.clientX, y: event.clientY };
      // isDraggingRef.current = false;
      setIsDragging(false);
      draggedNodeRef.current = clickedNode;
      // setDraggedNode(clickedNode);

      // Fix node position during drag
      clickedNode.fx = clickedNode.x;
      clickedNode.fy = clickedNode.y;

      simulationRef.current?.alpha(0.3).restart();
    },
    [allowNodeDrag, getNodeAtPosition, isClickOnExpandButton],
  );

  // Handle mouse move (for hover and dragging)
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Handle dragging
      if (draggedNodeRef.current && allowNodeDrag) {
        // Check if we've moved enough to consider it a drag
        const dx = event.clientX - dragStartPosRef.current.x;
        const dy = event.clientY - dragStartPosRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 3) {
          setIsDragging(true);
          // Close tooltip when starting drag
          if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
            tooltipTimeoutRef.current = null;
          }
          setHoveredNode(null);
        }

        if (isDragging) {
          const rect = canvas.getBoundingClientRect();
          const x = (event.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
          const y = (event.clientY - rect.top - transformRef.current.y) / transformRef.current.k;

          const fx = x - dragOffsetRef.current.x;
          const fy = y - dragOffsetRef.current.y;

          draggedNodeRef.current.fx = fx;
          draggedNodeRef.current.fy = fy;

          simulationRef.current?.alpha(0.3).restart();
          return;
        }
      }

      // Handle hover
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const y = (event.clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      let closest: ForceNode | null = null;
      let minDist = Infinity;

      forceNodes.forEach((node) => {
        const radius = node.level === 0 ? 22 : node.level === 1 ? 16 : 11;
        const dx = x - node.x;
        const dy = y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < radius + 8 && dist < minDist) {
          minDist = dist;
          closest = node;
        }
      });

      if (closest) {
        // Cancel any pending tooltip close
        if (tooltipTimeoutRef.current) {
          clearTimeout(tooltipTimeoutRef.current);
          tooltipTimeoutRef.current = null;
        }
        setHoveredNode(closest);
      } else {
        // Only clear if we're not over the tooltip (it will handle its own close)
        // Delay slightly to allow mouse to travel to tooltip
        if (!tooltipTimeoutRef.current) {
          tooltipTimeoutRef.current = setTimeout(() => {
            setHoveredNode(null);
            tooltipTimeoutRef.current = null;
          }, 150);
        }
      }
    },
    [allowNodeDrag, forceNodes, isDragging],
  );

  const handleMouseUp = useCallback(() => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current = null;
      simulationRef.current?.alpha(0.3).restart();
    }
  }, []);

  const handleAddNode = useCallback(() => {
    if (!ALLOW_ADD_DELETE || selectedNodes.size === 0) return;

    // Use the first selected node as parent
    const parentId = Array.from(selectedNodes)[0];
    const parentNode = nodesById.get(parentId);
    if (!parentNode) return;

    const newNodeId = `node-${Date.now()}`;
    const newNodeLevel = parentNode.level + 1;

    const newNode: CustomNode = {
      id: newNodeId,
      type: "custom",
      position: { x: parentNode.x + 50, y: parentNode.y + 50 },
      data: {
        label: `New Node ${newNodeId.slice(-4)}`,
        metadata: {
          type: "categoryA",
          status: "active",
          level: newNodeLevel,
        },
      },
      style: {
        background: "#E3F2FD",
        border: "2px solid #1976D2",
      },
    };

    const newEdge: Edge = {
      id: `edge-${Date.now()}`,
      source: parentId,
      target: newNodeId,
    };

    setNodesState((prev) => [...prev, newNode]);
    setEdgesState((prev) => [...prev, newEdge]);
  }, [selectedNodes, nodesById]);

  // Handle delete node
  const handleDeleteNode = useCallback(() => {
    if (!ALLOW_ADD_DELETE || selectedNodes.size === 0) return;

    // Get all selected nodes and their descendants to delete
    const nodesToDelete = new Set<string>();
    selectedNodes.forEach((nodeId) => {
      nodesToDelete.add(nodeId);
      const descendants = getAllDescendants(nodeId, nodesById);
      descendants.forEach((id) => nodesToDelete.add(id));
    });

    // Update nodes state - remove the node and all descendants
    setNodesState((prev) => prev.filter((node) => !nodesToDelete.has(node.id)));

    // Update edges state - remove edges connected to deleted nodes
    setEdgesState((prev) =>
      prev.filter((edge) => !nodesToDelete.has(edge.source) && !nodesToDelete.has(edge.target)),
    );

    // Clear selection
    setSelectedNodes(new Set());
  }, [selectedNodes, nodesById, getAllDescendants]);

  const onZoomFit = useCallback(() => {
    if (forceNodes.length === 0) return;

    const xs = forceNodes.map((n) => n.x);
    const ys = forceNodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const graphWidth = maxX - minX || 1;
    const graphHeight = maxY - minY || 1;
    const padding = 50;

    const scale = Math.min(
      (dimensions.width - padding * 2) / graphWidth,
      (dimensions.height - padding * 2) / graphHeight,
    );

    const newTransform = zoomIdentity
      .translate(
        (dimensions.width - graphWidth * scale) / 2 - minX * scale,
        (dimensions.height - graphHeight * scale) / 2 - minY * scale,
      )
      .scale(scale);

    transformRef.current = newTransform;
    setViewportTransform({ x: newTransform.x, y: newTransform.y, k: newTransform.k });
  }, [dimensions.height, dimensions.width, forceNodes]);

  const onZoomIn = useCallback(() => {
    const newTransform = transformRef.current.scale(1.3);
    transformRef.current = newTransform;
    setViewportTransform({ x: newTransform.x, y: newTransform.y, k: newTransform.k });
  }, [transformRef]);

  const onZoomOut = useCallback(() => {
    const newTransform = transformRef.current.scale(0.7);
    transformRef.current = newTransform;
    setViewportTransform({ x: newTransform.x, y: newTransform.y, k: newTransform.k });
  }, [transformRef]);

  const onExpandAll = useCallback(() => {
    setCollapsedNodes(new Set());
  }, []);

  const onCollapseAll = useCallback(() => {
    const allNodeIds = new Set<string>();
    nodesState.forEach((node) => {
      allNodeIds.add(node.id);
    });
    setCollapsedNodes(allNodeIds);
  }, [nodesState]);

  return (
    <div ref={containerRef} className={styles.d3SimpleView}>
      <canvas
        ref={canvasRef}
        className={`${styles.canvas} ${
          isDragging
            ? styles["canvas--grabbing"]
            : hoveredNode
              ? styles["canvas--pointer"]
              : styles["canvas--grab"]
        }`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          // Don't immediately clear - let the tooltip timeout handle it
          handleMouseUp();
        }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleCanvasClick}
        onDoubleClick={handleDoubleClick}
      />

      {hoveredNode && (
        <div
          className={styles.tooltip}
          style={{
            left: hoveredNode.x * viewportTransform.k + viewportTransform.x,
            top:
              hoveredNode.y * viewportTransform.k +
              viewportTransform.y -
              (hoveredNode.level === 0 ? 22 : hoveredNode.level === 1 ? 16 : 11) -
              8,
          }}
          onMouseEnter={() => {
            // Cancel the timeout when entering tooltip
            if (tooltipTimeoutRef.current) {
              clearTimeout(tooltipTimeoutRef.current);
              tooltipTimeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            // Close tooltip when leaving it
            setHoveredNode(null);
          }}
        >
          <div className={styles.tooltipArrow} />
          <div className={styles.tooltipHeader}>
            <span
              className={`${styles.levelBadge} ${
                hoveredNode.level === 0 ? styles["levelBadge--root"] : styles["levelBadge--child"]
              }`}
            >
              {hoveredNode.level}
            </span>
            <span className={styles.tooltipLabel}>{hoveredNode.label}</span>
          </div>
          <div className={styles.tooltipInfo}>
            <div>
              <strong>Type:</strong> {hoveredNode.type}
            </div>
            <div>
              <strong>ID:</strong> {hoveredNode.id}
            </div>
            {hoveredNode.parentId && (
              <div className={styles.tooltipInfoSecondary}>👆 Parent: {hoveredNode.parentId}</div>
            )}
            {hoveredNode.childIds.length > 0 && (
              <div className={styles.tooltipInfoSuccess}>
                👶 {hoveredNode.childIds.length} child{hoveredNode.childIds.length > 1 ? "ren" : ""}
                {collapsedNodes.has(hoveredNode.id) && " (collapsed)"}
              </div>
            )}
            {hoveredNode.level === 0 && (
              <div className={styles.tooltipInfoWarning}>🌟 Core Node</div>
            )}
          </div>
          <div className={styles.tooltipActions}>
            <button
              onClick={() => {
                // Center view on this node
                const nodeScreenX = hoveredNode.x * viewportTransform.k + viewportTransform.x;
                const nodeScreenY = hoveredNode.y * viewportTransform.k + viewportTransform.y;
                const centerX = dimensions.width / 2;
                const centerY = dimensions.height / 2;
                const newTransform = transformRef.current.translate(
                  centerX - nodeScreenX,
                  centerY - nodeScreenY,
                );
                transformRef.current = newTransform;
                setViewportTransform({ x: newTransform.x, y: newTransform.y, k: newTransform.k });
              }}
              className={`${styles.tooltipButton} ${styles["tooltipButton--primary"]}`}
            >
              Center View
            </button>
            {hoveredNode.childIds.length > 0 && (
              <button
                onClick={() => {
                  setCollapsedNodes((prev) => {
                    const newSet = new Set(prev);
                    if (newSet.has(hoveredNode.id)) {
                      newSet.delete(hoveredNode.id);
                    } else {
                      newSet.add(hoveredNode.id);
                    }
                    return newSet;
                  });
                }}
                className={`${styles.tooltipButton} ${
                  collapsedNodes.has(hoveredNode.id)
                    ? styles["tooltipButton--success"]
                    : styles["tooltipButton--danger"]
                }`}
              >
                {collapsedNodes.has(hoveredNode.id) ? "Expand" : "Collapse"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Node Action Toolbar - positioned at selected node */}
      {ALLOW_ADD_DELETE && selectedNodes.size === 1 && (() => {
        const selectedId = Array.from(selectedNodes)[0];
        const selectedNode = nodesById.get(selectedId);
        if (!selectedNode) return null;
        
        const radius = selectedNode.level === 0 ? 22 : selectedNode.level === 1 ? 16 : 11;
        const toolbarX = selectedNode.x * viewportTransform.k + viewportTransform.x + radius + 8;
        const toolbarY = selectedNode.y * viewportTransform.k + viewportTransform.y;
        
        return (
          <div 
            className={styles.nodeActionToolbar}
            style={{
              left: toolbarX,
              top: toolbarY,
              transform: 'translateY(-50%)'
            }}
          >
            <button
              onClick={handleAddNode}
              className={styles.nodeActionButton}
              title="Add Child"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </button>
            
            <button
              className={styles.nodeActionButton}
              title="Edit"
              disabled
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            
            {selectedNode.level > 0 && (
              <button
                onClick={handleDeleteNode}
                className={`${styles.nodeActionButton} ${styles["nodeActionButton--danger"]}`}
                title="Delete"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </button>
            )}
          </div>
        );
      })()}

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

      {/* Overview */}
      <Overview
        isOpen={isOverviewOpen}
        onClose={() => setIsOverviewOpen(false)}
        nodes={forceNodes.map((n) => ({ id: n.id, x: n.x, y: n.y, level: n.level }))}
        viewportTransform={viewportTransform}
        canvasWidth={dimensions.width}
        canvasHeight={dimensions.height}
        onViewportChange={(transform) => {
          const newTransform = zoomIdentity.translate(transform.x, transform.y).scale(transform.k);
          transformRef.current = newTransform;
          setViewportTransform({ x: transform.x, y: transform.y, k: transform.k });
        }}
      />
    </div>
  );
};
