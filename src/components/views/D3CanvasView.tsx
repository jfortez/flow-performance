import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { forceSimulation, forceManyBody, forceCenter, forceLink, forceCollide, forceX, forceY } from "d3-force";
import { zoom, zoomIdentity } from "d3-zoom";
import { select } from "d3-selection";
import type { Edge } from "@xyflow/react";
import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";
import type { CustomNode } from "../../types";

interface D3CanvasNode extends SimulationNodeDatum {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  borderColor: string;
  type: string;
  status: string;
  level: number;
  isMatch: boolean;
  isRoot: boolean;
}

interface D3CanvasLink extends SimulationLinkDatum<D3CanvasNode> {
  source: string | D3CanvasNode;
  target: string | D3CanvasNode;
}

interface D3CanvasViewProps {
  nodes: CustomNode[];
  edges: Edge[];
  searchResults: Array<{ node: CustomNode; matches: boolean }>;
  maxVisibleNodes?: number;
}

export const D3CanvasView = ({ nodes, edges, searchResults, maxVisibleNodes = 150 }: D3CanvasViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation> | null>(null);
  const transformRef = useRef(zoomIdentity);
  const rafRef = useRef<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredNode, setHoveredNode] = useState<D3CanvasNode | null>(null);

  // Convert nodes to D3 format with hierarchical radial layout
  const d3Nodes = useMemo((): D3CanvasNode[] => {
    const visibleCount = Math.min(nodes.length, maxVisibleNodes);
    const visibleNodes = nodes.slice(0, visibleCount);
    
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radiusStep = 200; // Distance between levels
    
    // Build parent-child relationships
    const nodeMap = new Map<string, CustomNode>();
    const childrenMap = new Map<string, string[]>();
    const parentMap = new Map<string, string>();
    
    visibleNodes.forEach(node => {
      nodeMap.set(node.id, node);
      childrenMap.set(node.id, []);
    });
    
    // Find parent-child relationships from edges
    edges.forEach(edge => {
      if (childrenMap.has(edge.source) && nodeMap.has(edge.target)) {
        childrenMap.get(edge.source)!.push(edge.target);
        parentMap.set(edge.target, edge.source);
      }
    });
    
    // Calculate subtree sizes (number of descendants)
    const subtreeSizes = new Map<string, number>();
    const calculateSubtreeSize = (nodeId: string): number => {
      if (subtreeSizes.has(nodeId)) return subtreeSizes.get(nodeId)!;
      
      const children = childrenMap.get(nodeId) || [];
      let size = 1; // Count self
      children.forEach(childId => {
        size += calculateSubtreeSize(childId);
      });
      
      subtreeSizes.set(nodeId, size);
      return size;
    };
    
    visibleNodes.forEach(node => calculateSubtreeSize(node.id));
    
    // Assign angular positions using a radial tree layout
    const nodeAngles = new Map<string, number>();
    
    const assignAngles = (nodeId: string, startAngle: number, endAngle: number) => {
      const children = childrenMap.get(nodeId) || [];
      
      if (children.length === 0) {
        nodeAngles.set(nodeId, (startAngle + endAngle) / 2);
        return;
      }
      
      const totalSize = children.reduce((sum, childId) => sum + subtreeSizes.get(childId)!, 0);
      let currentAngle = startAngle;
      
      children.forEach(childId => {
        const childSize = subtreeSizes.get(childId)!;
        const angleRange = (endAngle - startAngle) * (childSize / totalSize);
        
        assignAngles(childId, currentAngle, currentAngle + angleRange);
        currentAngle += angleRange;
      });
      
      // Parent is at center of children's arc
      nodeAngles.set(nodeId, (startAngle + endAngle) / 2);
    };
    
    // Start from root
    const rootNode = visibleNodes.find(n => n.data.metadata.level === 0);
    if (rootNode) {
      assignAngles(rootNode.id, 0, 2 * Math.PI);
    }
    
    // Create positioned nodes
    const positionedNodes: D3CanvasNode[] = [];
    
    visibleNodes.forEach(node => {
      const searchResult = searchResults.find((r) => r.node.id === node.id);
      const isMatch = searchResult?.matches || false;
      const style = node.style as Record<string, string> || {};
      
      const level = node.data.metadata.level;
      const angle = nodeAngles.get(node.id) || 0;
      const radius = level * radiusStep;
      
      // Add some randomness to prevent perfect alignment
      const jitter = level > 0 ? (Math.random() - 0.5) * 0.15 : 0;
      const finalAngle = angle + jitter;
      
      const x = centerX + Math.cos(finalAngle) * radius;
      const y = centerY + Math.sin(finalAngle) * radius;
      
      positionedNodes.push({
        id: node.id,
        label: node.data.label,
        x,
        y,
        vx: 0,
        vy: 0,
        color: style.background || (level === 0 ? "#F3E5F5" : "#E8EAF6"),
        borderColor: isMatch ? "#FFC107" : style.border?.split(" ")[2] || "#3F51B5",
        type: node.data.metadata.type,
        status: node.data.metadata.status,
        level,
        isMatch,
        isRoot: level === 0,
      });
    });
    
    return positionedNodes;
  }, [nodes, edges, searchResults, maxVisibleNodes, dimensions]);

  // Convert edges to D3 format, only including edges for visible nodes
  const d3Links = useMemo((): D3CanvasLink[] => {
    const visibleNodeIds = new Set(d3Nodes.map((n) => n.id));
    return edges
      .filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
      }));
  }, [edges, d3Nodes]);

  // Calculate node radius based on type
  const getNodeRadius = useCallback((node: D3CanvasNode) => {
    if (node.isRoot) return 25;
    if (node.type === "process") return 18;
    return 14;
  }, []);

  // Get label visibility based on zoom scale
  const shouldShowLabel = useCallback((scale: number) => {
    return scale > 0.8;
  }, []);

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const transform = transformRef.current;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Save context for zoom transform
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // Calculate visible bounds with padding for culling
    const padding = 50;
    const visibleLeft = (-transform.x / transform.k) - padding;
    const visibleTop = (-transform.y / transform.k) - padding;
    const visibleRight = visibleLeft + (width / transform.k) + padding * 2;
    const visibleBottom = visibleTop + (height / transform.k) + padding * 2;

    // Draw concentric level rings (visual guide)
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radiusStep = 180;
    const maxLevel = Math.max(...d3Nodes.map(n => n.level));
    
    for (let level = 1; level <= maxLevel; level++) {
      const radius = level * radiusStep;
      
      // Check if circle is visible
      if (centerX + radius < visibleLeft || centerX - radius > visibleRight ||
          centerY + radius < visibleTop || centerY - radius > visibleBottom) {
        continue;
      }
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200, 200, 200, ${0.3 - level * 0.05})`;
      ctx.lineWidth = 1 / transform.k;
      ctx.setLineDash([5 / transform.k, 5 / transform.k]);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw level label on the ring
      if (transform.k > 0.4) {
        ctx.fillStyle = `rgba(150, 150, 150, ${0.6 - level * 0.1})`;
        ctx.font = `${Math.max(10, 12 / transform.k)}px system-ui, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`L${level}`, centerX + radius + 5 / transform.k, centerY);
      }
    }

    // Draw edges first (behind nodes)
    ctx.strokeStyle = "rgba(150, 150, 150, 0.4)";
    ctx.lineWidth = 1.5 / transform.k;

    d3Links.forEach((link) => {
      const sourceNode = typeof link.source === "string" 
        ? d3Nodes.find((n) => n.id === link.source)
        : link.source;
      const targetNode = typeof link.target === "string"
        ? d3Nodes.find((n) => n.id === link.target)
        : link.target;

      if (!sourceNode || !targetNode) return;

      // Culling: skip if both nodes are far outside viewport
      if ((sourceNode.x < visibleLeft && targetNode.x < visibleLeft) ||
          (sourceNode.x > visibleRight && targetNode.x > visibleRight) ||
          (sourceNode.y < visibleTop && targetNode.y < visibleTop) ||
          (sourceNode.y > visibleBottom && targetNode.y > visibleBottom)) {
        return;
      }

      ctx.beginPath();
      ctx.moveTo(sourceNode.x, sourceNode.y);
      ctx.lineTo(targetNode.x, targetNode.y);
      ctx.stroke();
    });

    // Draw nodes
    d3Nodes.forEach((node) => {
      // Culling: skip if outside viewport
      const radius = getNodeRadius(node);
      if (node.x + radius < visibleLeft || 
          node.x - radius > visibleRight ||
          node.y + radius < visibleTop || 
          node.y - radius > visibleBottom) {
        return;
      }

      const isHovered = hoveredNode?.id === node.id;

      // Draw node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Draw border
      ctx.lineWidth = (isHovered ? 4 : node.isMatch ? 3 : 2) / transform.k;
      ctx.strokeStyle = node.isMatch ? "#FFC107" : node.borderColor;
      ctx.stroke();

      // Highlight effect for matches
      if (node.isMatch || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 6 / transform.k, 0, Math.PI * 2);
        ctx.strokeStyle = node.isMatch ? "rgba(255, 193, 7, 0.4)" : "rgba(59, 130, 246, 0.4)";
        ctx.lineWidth = 3 / transform.k;
        ctx.stroke();
      }

      // Draw level badge on top of node (not for root)
      if (!node.isRoot && transform.k > 0.5) {
        const badgeRadius = Math.max(8, 10 / transform.k);
        const badgeY = node.y - radius - badgeRadius / 2;
        
        // Badge background
        ctx.beginPath();
        ctx.arc(node.x, badgeY, badgeRadius, 0, Math.PI * 2);
        ctx.fillStyle = node.isMatch ? "#F59E0B" : "#374151";
        ctx.fill();
        
        // Badge border
        ctx.lineWidth = 1 / transform.k;
        ctx.strokeStyle = "white";
        ctx.stroke();
        
        // Level number
        ctx.fillStyle = "white";
        ctx.font = `bold ${Math.max(9, 10 / transform.k)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(node.level), node.x, badgeY);
      }

      // Draw labels with LOD - only when zoomed in enough
      if (shouldShowLabel(transform.k) || node.isRoot) {
        const labelY = node.y + radius + 18 / transform.k;
        const fontSize = Math.max(11, 13 / transform.k);
        
        ctx.font = `${node.isRoot ? "bold " : ""}${fontSize}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        
        // Measure text for background
        const textMetrics = ctx.measureText(node.label);
        const textWidth = textMetrics.width;
        const textHeight = fontSize;
        const padding = 4 / transform.k;
        
        // Draw label background for better readability
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.roundRect(
          node.x - textWidth / 2 - padding,
          labelY - padding,
          textWidth + padding * 2,
          textHeight + padding * 2,
          4 / transform.k
        );
        ctx.fill();
        
        // Draw label text with shadow for better contrast
        ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
        ctx.shadowBlur = 2 / transform.k;
        ctx.fillStyle = node.isMatch ? "#B45309" : "#1F2937";
        ctx.fillText(node.label, node.x, labelY);
        
        // Reset shadow
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }
    });

    ctx.restore();
  }, [d3Nodes, d3Links, hoveredNode, getNodeRadius, shouldShowLabel]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      render();
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [render]);

  // Initialize and update simulation
  useEffect(() => {
    if (d3Nodes.length === 0 || dimensions.width === 0) return;

    // Stop previous simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    // Create a map of initial positions
    const initialPositions = new Map<string, { x: number; y: number }>();
    d3Nodes.forEach(node => {
      initialPositions.set(node.id, { x: node.x, y: node.y });
    });

    // Create new simulation with forces that preserve hierarchical radial layout
    const simulation = forceSimulation(d3Nodes as SimulationNodeDatum[])
      // Very weak repulsion - let the structure dominate
      .force("charge", forceManyBody().strength(-50).distanceMax(150))
      // Strong links to maintain parent-child connections
      .force(
        "link",
        forceLink(d3Links as SimulationLinkDatum<SimulationNodeDatum>[])
          .id((d: SimulationNodeDatum) => (d as D3CanvasNode).id)
          .distance(60)
          .strength(0.6)
      )
      // Strong collision to prevent overlap
      .force("collide", forceCollide().radius((d) => getNodeRadius(d as D3CanvasNode) + 10).strength(1))
      // Weak centering
      .force("center", forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.01))
      // Force to keep nodes near their initial positions (angular preservation)
      .force("x", forceX((d: SimulationNodeDatum) => initialPositions.get((d as D3CanvasNode).id)?.x || dimensions.width / 2).strength(0.08))
      .force("y", forceY((d: SimulationNodeDatum) => initialPositions.get((d as D3CanvasNode).id)?.y || dimensions.height / 2).strength(0.08))
      .alphaDecay(0.02)
      .velocityDecay(0.6);

    simulationRef.current = simulation;

    // More warmup ticks for convergence
    simulation.tick(80);

    return () => {
      simulation.stop();
    };
  }, [d3Nodes, d3Links, dimensions, getNodeRadius]);

  // Initialize zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
      });

    const selection = select(canvas);
    selection.call(zoomBehavior);

    return () => {
      selection.on(".zoom", null);
    };
  }, []);

  // Handle resize
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

    return () => {
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  // Handle mouse interactions for hover
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
    const y = (event.clientY - rect.top - transformRef.current.y) / transformRef.current.k;

    // Find hovered node with distance check
    let closestNode: D3CanvasNode | null = null;
    let minDistance = Infinity;

    d3Nodes.forEach((node) => {
      const radius = getNodeRadius(node);
      const dx = x - node.x;
      const dy = y - node.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < radius + 5 && distance < minDistance) {
        minDistance = distance;
        closestNode = node;
      }
    });

    setHoveredNode(closestNode);
  }, [d3Nodes, getNodeRadius]);

  const handleMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          cursor: hoveredNode ? "pointer" : "grab",
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {/* Tooltip for hovered node */}
      {hoveredNode && (
        <div
          style={{
            position: "absolute",
            left: 16,
            bottom: 16,
            padding: "12px 16px",
            background: "rgba(0, 0, 0, 0.9)",
            borderRadius: "8px",
            color: "white",
            fontSize: "13px",
            zIndex: 20,
            maxWidth: "280px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "22px",
                height: "22px",
                background: hoveredNode.isMatch ? "#F59E0B" : "#3B82F6",
                borderRadius: "50%",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              {hoveredNode.level}
            </span>
            <span style={{ fontWeight: 600 }}>{hoveredNode.label}</span>
          </div>
          <div style={{ color: "#D1D5DB", fontSize: "12px", lineHeight: 1.6 }}>
            <div><strong>Type:</strong> {hoveredNode.type}</div>
            <div><strong>Status:</strong> {hoveredNode.status}</div>
            {hoveredNode.isRoot && <div style={{ color: "#10B981", marginTop: "4px" }}>🌟 Root Node</div>}
          </div>
        </div>
      )}
    </div>
  );
};
