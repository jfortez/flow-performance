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
import styles from "./D3ForceTreeView.module.css";

interface ForceTreeNode extends SimulationNodeDatum {
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
  radius: number;
  collapsed?: boolean;
}

interface ForceTreeLink extends SimulationLinkDatum<ForceTreeNode> {
  source: string | ForceTreeNode;
  target: string | ForceTreeNode;
}

interface D3ForceTreeViewProps {
  nodes: CustomNode[];
  edges: Edge[];
  searchResults: Array<{ node: CustomNode; matches: boolean }>;
  maxVisibleNodes?: number;
}

export const D3ForceTreeView = ({
  nodes: initialNodes,
  edges: initialEdges,
  searchResults,
  maxVisibleNodes = 500,
}: D3ForceTreeViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation> | null>(null);
  const transformRef = useRef(zoomIdentity);
  const rafRef = useRef<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredNode, setHoveredNode] = useState<ForceTreeNode | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const initialZoomAppliedRef = useRef(false);

  // Build hierarchical structure
  const { treeNodes, treeLinks, nodesById } = useMemo(() => {
    const visibleCount = Math.min(initialNodes.length, maxVisibleNodes);
    const visibleNodes = initialNodes.slice(0, visibleCount);

    // Build parent-child relationships
    const nodeMap = new Map<string, CustomNode>();
    const parentMap = new Map<string, string>();
    const childrenMap = new Map<string, string[]>();

    visibleNodes.forEach((node) => {
      nodeMap.set(node.id, node);
      childrenMap.set(node.id, []);
    });

    initialEdges.forEach((edge) => {
      if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
        childrenMap.get(edge.source)?.push(edge.target);
        parentMap.set(edge.target, edge.source);
      }
    });

    // Calculate visible nodes based on collapsed state
    const isNodeVisible = (nodeId: string): boolean => {
      const parentId = parentMap.get(nodeId);
      if (!parentId) return true;
      return !collapsedNodes.has(parentId);
    };

    const visibleNodeIds = new Set<string>();
    visibleNodes.forEach((node) => {
      if (isNodeVisible(node.id)) {
        visibleNodeIds.add(node.id);
      }
    });

    // Build search results map for quick lookup
    const searchResultsMap = new Map<string, boolean>();
    searchResults.forEach((result) => {
      searchResultsMap.set(result.node.id, result.matches);
    });

    // Create force nodes
    const nodesList: ForceTreeNode[] = [];
    const nodesByIdMap = new Map<string, ForceTreeNode>();

    const centerX = dimensions.width / 2 || 400;
    const centerY = dimensions.height / 2 || 300;

    visibleNodes.forEach((node) => {
      if (!visibleNodeIds.has(node.id)) return;

      const isMatch = searchResultsMap.get(node.id) ?? false;
      const style = (node.style as Record<string, string>) || {};
      const level = node.data.metadata.level;

      // Radius based on level (root is larger)
      const radius = level === 0 ? 25 : level === 1 ? 18 : level === 2 ? 14 : 10;

      // Initial radial position based on level
      const levelNodes = visibleNodes.filter(
        (n) => n.data.metadata.level === level && visibleNodeIds.has(n.id)
      );
      const index = levelNodes.findIndex((n) => n.id === node.id);
      const angleStep = (2 * Math.PI) / Math.max(levelNodes.length, 1);
      const radiusStep = 120 + level * 80;
      const angle = angleStep * index;

      const forceNode: ForceTreeNode = {
        id: node.id,
        label: node.data.label,
        x: centerX + Math.cos(angle) * radiusStep,
        y: centerY + Math.sin(angle) * radiusStep,
        vx: 0,
        vy: 0,
        color: style.background || "#E8EAF6",
        borderColor: isMatch ? "#FFC107" : style.border?.split(" ")[2] || "#3F51B5",
        type: node.data.metadata.type,
        level,
        isMatch,
        parentId: parentMap.get(node.id),
        childIds: childrenMap.get(node.id) || [],
        radius,
        collapsed: collapsedNodes.has(node.id),
      };

      nodesList.push(forceNode);
      nodesByIdMap.set(node.id, forceNode);
    });

    // Create links only for visible nodes
    const linksList: ForceTreeLink[] = [];
    initialEdges.forEach((edge) => {
      if (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) {
        linksList.push({
          source: edge.source,
          target: edge.target,
        });
      }
    });

    return {
      treeNodes: nodesList,
      treeLinks: linksList,
      nodesById: nodesByIdMap,
    };
  }, [initialNodes, initialEdges, searchResults, maxVisibleNodes, dimensions, collapsedNodes]);

  // Render function
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

    // Calculate visible bounds for culling
    const padding = 50;
    const visibleLeft = -transform.x / transform.k - padding;
    const visibleTop = -transform.y / transform.k - padding;
    const visibleRight = visibleLeft + width / transform.k + padding * 2;
    const visibleBottom = visibleTop + height / transform.k + padding * 2;

    // Calculate connected nodes for hover effect
    const connectedNodeIds = new Set<string>();
    if (hoveredNode) {
      connectedNodeIds.add(hoveredNode.id);
      
      // Add parent and ancestors
      let currentId: string | undefined = hoveredNode.parentId;
      while (currentId) {
        connectedNodeIds.add(currentId);
        const parentNode = nodesById.get(currentId);
        currentId = parentNode?.parentId;
      }

      // Add children
      const addChildren = (nodeId: string) => {
        const node = nodesById.get(nodeId);
        if (node) {
          node.childIds.forEach((childId) => {
            if (nodesById.has(childId)) {
              connectedNodeIds.add(childId);
              addChildren(childId);
            }
          });
        }
      };
      addChildren(hoveredNode.id);
    }

    const isHovering = !!hoveredNode;

    // Draw links
    treeLinks.forEach((link) => {
      const source = typeof link.source === "string" ? nodesById.get(link.source) : link.source;
      const target = typeof link.target === "string" ? nodesById.get(link.target) : link.target;

      if (!source || !target) return;

      // Culling
      if (
        (source.x < visibleLeft && target.x < visibleLeft) ||
        (source.x > visibleRight && target.x > visibleRight) ||
        (source.y < visibleTop && target.y < visibleTop) ||
        (source.y > visibleBottom && target.y > visibleBottom)
      ) {
        return;
      }

      const isConnected = isHovering && connectedNodeIds.has(source.id) && connectedNodeIds.has(target.id);

      if (isHovering && !isConnected) {
        ctx.strokeStyle = "rgba(150, 150, 150, 0.15)";
        ctx.lineWidth = 0.8 / transform.k;
      } else if (isConnected) {
        ctx.strokeStyle = "rgba(63, 81, 181, 0.8)";
        ctx.lineWidth = 2.5 / transform.k;
      } else {
        ctx.strokeStyle = "rgba(150, 150, 150, 0.4)";
        ctx.lineWidth = 1.5 / transform.k;
      }

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    });

    // Draw nodes
    treeNodes.forEach((node) => {
      // Culling
      if (
        node.x + node.radius < visibleLeft ||
        node.x - node.radius > visibleRight ||
        node.y + node.radius < visibleTop ||
        node.y - node.radius > visibleBottom
      ) {
        return;
      }

      const isHovered = hoveredNode?.id === node.id;
      const isConnected = isHovering && connectedNodeIds.has(node.id);

      // Dim non-connected nodes when hovering
      if (isHovering && !isConnected && !isHovered) {
        ctx.globalAlpha = 0.3;
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Border
      ctx.lineWidth = (isHovered ? 3.5 : isConnected ? 3 : 2) / transform.k;
      ctx.strokeStyle = isHovered ? "#3F51B5" : node.isMatch ? "#FFC107" : node.borderColor;
      ctx.stroke();

      // Glow effect for hovered/connected nodes
      if (isHovered || isConnected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 6 / transform.k, 0, Math.PI * 2);
        ctx.strokeStyle = isHovered ? "rgba(63, 81, 181, 0.5)" : "rgba(63, 81, 181, 0.3)";
        ctx.lineWidth = 3 / transform.k;
        ctx.stroke();
      }

      // Highlight ring for matches
      if (node.isMatch) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 4 / transform.k, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 193, 7, 0.4)";
        ctx.lineWidth = 2 / transform.k;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      // Expand/collapse indicator for nodes with children
      if (node.childIds.length > 0 && transform.k > 0.5) {
        const indicatorRadius = Math.max(6, 7 / transform.k);
        const isCollapsed = collapsedNodes.has(node.id);
        
        // Position at bottom of node
        const indicatorX = node.x;
        const indicatorY = node.y + node.radius;

        ctx.beginPath();
        ctx.arc(indicatorX, indicatorY, indicatorRadius, 0, Math.PI * 2);
        ctx.fillStyle = isCollapsed ? "#4CAF50" : "#F44336";
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1.5 / transform.k;
        ctx.stroke();

        // Plus or minus sign
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1.5 / transform.k;
        ctx.beginPath();
        ctx.moveTo(indicatorX - indicatorRadius * 0.4, indicatorY);
        ctx.lineTo(indicatorX + indicatorRadius * 0.4, indicatorY);
        if (isCollapsed) {
          ctx.moveTo(indicatorX, indicatorY - indicatorRadius * 0.4);
          ctx.lineTo(indicatorX, indicatorY + indicatorRadius * 0.4);
        }
        ctx.stroke();
      }

      // Label
      if (isHovered || isConnected || transform.k > 0.6 || node.level === 0) {
        const labelY = node.y + node.radius + 12 / transform.k;
        const fontSize = Math.max(10, 11 / transform.k);

        ctx.font = `${node.level === 0 ? "bold " : ""}${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        const textMetrics = ctx.measureText(node.label);
        const padding = 3 / transform.k;

        // Text background
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.beginPath();
        ctx.roundRect(
          node.x - textMetrics.width / 2 - padding,
          labelY - padding,
          textMetrics.width + padding * 2,
          fontSize + padding * 2,
          3 / transform.k
        );
        ctx.fill();

        // Text
        ctx.fillStyle = isHovered || isConnected ? "#3F51B5" : "#1F2937";
        ctx.fillText(node.label, node.x, labelY);
      }
    });

    ctx.restore();
  }, [treeNodes, treeLinks, nodesById, hoveredNode, collapsedNodes]);

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

  // Force simulation
  useEffect(() => {
    if (treeNodes.length === 0 || dimensions.width === 0) {
      return undefined;
    }

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    const simulation = forceSimulation(treeNodes as SimulationNodeDatum[])
      .force(
        "charge",
        forceManyBody().strength((d: SimulationNodeDatum) => {
          const node = d as ForceTreeNode;
          return -300 - node.radius * 10;
        })
      )
      .force("center", forceCenter(centerX, centerY).strength(0.05))
      .force(
        "link",
        forceLink(treeLinks as SimulationLinkDatum<SimulationNodeDatum>[])
          .id((d: SimulationNodeDatum) => (d as ForceTreeNode).id)
          .distance((d: SimulationLinkDatum<SimulationNodeDatum>) => {
            const link = d as ForceTreeLink;
            const source = typeof link.source === "string" ? nodesById.get(link.source) : link.source;
            const target = typeof link.target === "string" ? nodesById.get(link.target) : link.target;
            if (!source || !target) return 100;
            return 60 + (source.level + target.level) * 30;
          })
          .strength(0.7)
      )
      .force(
        "collide",
        forceCollide()
          .radius((d: SimulationNodeDatum) => (d as ForceTreeNode).radius + 15)
          .strength(0.8)
      )
      .force("x", forceX(centerX).strength(0.02))
      .force("y", forceY(centerY).strength(0.02))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    simulationRef.current = simulation;

    // Run initial ticks for stability
    simulation.tick(50);

    return () => {
      simulation.stop();
    };
  }, [treeNodes, treeLinks, dimensions, nodesById]);

  // Zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
      });

    const selection = select(canvas);
    selection.call(zoomBehavior);

    // Initial fit to view - only apply once when nodes are first loaded
    if (treeNodes.length > 0 && !initialZoomAppliedRef.current) {
      initialZoomAppliedRef.current = true;
      
      const xs = treeNodes.map((n) => n.x);
      const ys = treeNodes.map((n) => n.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const graphWidth = maxX - minX || 1;
      const graphHeight = maxY - minY || 1;
      const padding = 80;

      const scale = Math.min(
        (dimensions.width - padding * 2) / graphWidth,
        (dimensions.height - padding * 2) / graphHeight,
        1.2
      );

      const translateX = (dimensions.width - graphWidth * scale) / 2 - minX * scale;
      const translateY = (dimensions.height - graphHeight * scale) / 2 - minY * scale;

      const initialTransform = zoomIdentity.translate(translateX, translateY).scale(scale);
      transformRef.current = initialTransform;
      
      // Apply the transform using d3 zoom behavior
      selection.call(zoomBehavior.transform, initialTransform);
    }

    return () => {
      selection.on(".zoom", null);
    };
  }, [treeNodes, dimensions]);

  // Resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current && canvasRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Get node at position
  const getNodeAtPosition = useCallback(
    (clientX: number, clientY: number): ForceTreeNode | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const y = (clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      let closest: ForceTreeNode | null = null;
      let minDist = Infinity;

      treeNodes.forEach((node) => {
        const dx = x - node.x;
        const dy = y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < node.radius + 10 && dist < minDist) {
          minDist = dist;
          closest = node;
        }
      });

      return closest;
    },
    [treeNodes]
  );

  // Handle mouse move (hover)
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const node = getNodeAtPosition(event.clientX, event.clientY);
      setHoveredNode(node);
    },
    [getNodeAtPosition]
  );

  // Handle click (expand/collapse)
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const node = getNodeAtPosition(event.clientX, event.clientY);
      if (node && node.childIds.length > 0) {
        setCollapsedNodes((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(node.id)) {
            newSet.delete(node.id);
          } else {
            newSet.add(node.id);
          }
          return newSet;
        });
      }
    },
    [getNodeAtPosition]
  );

  // Handle double-click (focus)
  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const node = getNodeAtPosition(event.clientX, event.clientY);
      if (node) {
        // Center view on this node
        const canvas = canvasRef.current;
        if (!canvas) return;

        const { width, height } = canvas;
        const scale = Math.max(1, transformRef.current.k);
        const translateX = width / 2 - node.x * scale;
        const translateY = height / 2 - node.y * scale;

        const newTransform = zoomIdentity.translate(translateX, translateY).scale(scale);
        transformRef.current = newTransform;
        
        // Apply the transform to the zoom behavior
        const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
          .scaleExtent([0.1, 4])
          .on("zoom", (e) => {
            transformRef.current = e.transform;
          });
        select(canvas).call(zoomBehavior.transform, newTransform);
      }
    },
    [getNodeAtPosition]
  );

  return (
    <div ref={containerRef} className={styles.container}>
      <canvas
        ref={canvasRef}
        className={`${styles.canvas} ${hoveredNode ? styles.canvasPointer : styles.canvasGrab}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredNode(null)}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      />

      {/* Tooltip */}
      {hoveredNode && (
        <div
          className={styles.tooltip}
          style={{
            left: 16,
            bottom: 16,
          }}
        >
          <div className={styles.tooltipHeader}>
            <span
              className={`${styles.levelBadge} ${
                hoveredNode.level === 0 ? styles.levelBadgeRoot : ""
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
            {hoveredNode.parentId && (
              <div className={styles.tooltipSecondary}>
                Parent: {hoveredNode.parentId}
              </div>
            )}
            {hoveredNode.childIds.length > 0 && (
              <div className={styles.tooltipSuccess}>
                {hoveredNode.childIds.length} children
                {collapsedNodes.has(hoveredNode.id) && " (collapsed)"}
              </div>
            )}
            {hoveredNode.level === 0 && (
              <div className={styles.tooltipRoot}>Root Node</div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#E8EAF6" }} />
          <span>Node</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#4CAF50" }} />
          <span>Collapsed</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#F44336" }} />
          <span>Expanded</span>
        </div>
      </div>
    </div>
  );
};
