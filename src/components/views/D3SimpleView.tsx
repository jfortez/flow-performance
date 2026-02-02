import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { forceSimulation, forceManyBody, forceCenter, forceLink, forceCollide, forceX, forceY } from "d3-force";
import { zoom, zoomIdentity } from "d3-zoom";
import { select } from "d3-selection";
import type { Edge } from "@xyflow/react";
import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";
import type { CustomNode } from "../../types";

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
}

interface ForceLink extends SimulationLinkDatum<ForceNode> {
  source: string | ForceNode;
  target: string | ForceNode;
}

interface D3SimpleViewProps {
  nodes: CustomNode[];
  edges: Edge[];
  searchResults: Array<{ node: CustomNode; matches: boolean }>;
}

export const D3SimpleView = ({ nodes, edges, searchResults }: D3SimpleViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation> | null>(null);
  const transformRef = useRef(zoomIdentity);
  const rafRef = useRef<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredNode, setHoveredNode] = useState<ForceNode | null>(null);

  // Build hierarchical structure with parent-child relationships
  const { forceNodes, forceLinks, nodesById } = useMemo(() => {
    const visibleCount = Math.min(nodes.length, 200);
    const visibleNodes = nodes.slice(0, visibleCount);
    
    // Build relationships
    const nodeMap = new Map<string, CustomNode>();
    const parentMap = new Map<string, string>();
    const childrenMap = new Map<string, string[]>();
    
    visibleNodes.forEach(node => {
      nodeMap.set(node.id, node);
      childrenMap.set(node.id, []);
    });

    edges.forEach(edge => {
      if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
        childrenMap.get(edge.source)?.push(edge.target);
        parentMap.set(edge.target, edge.source);
      }
    });

    // Calculate initial positions in concentric circles by level
    const centerX = dimensions.width / 2 || 400;
    const centerY = dimensions.height / 2 || 300;
    const radiusStep = 200; // Aumentado de 120 a 200 para más espacio

    // Group by level
    const nodesByLevel = new Map<number, CustomNode[]>();
    visibleNodes.forEach(node => {
      const level = node.data.metadata.level;
      if (!nodesByLevel.has(level)) nodesByLevel.set(level, []);
      nodesByLevel.get(level)!.push(node);
    });

    // Create force nodes with initial positions
    const forceNodesList: ForceNode[] = [];
    const nodesByIdMap = new Map<string, ForceNode>();

    nodesByLevel.forEach((levelNodes, level) => {
      const radius = level * radiusStep;
      const angleStep = (2 * Math.PI) / levelNodes.length;

      levelNodes.forEach((node, index) => {
        const searchResult = searchResults.find(r => r.node.id === node.id);
        const isMatch = searchResult?.matches || false;
        const style = node.style as Record<string, string> || {};
        
        const angle = angleStep * index;
        const initialX = centerX + Math.cos(angle) * radius;
        const initialY = centerY + Math.sin(angle) * radius;

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

    // Create links
    const linksList: ForceLink[] = [];
    edges.forEach(edge => {
      if (nodesByIdMap.has(edge.source) && nodesByIdMap.has(edge.target)) {
        linksList.push({
          source: edge.source,
          target: edge.target,
        });
      }
    });

    return { 
      forceNodes: forceNodesList, 
      forceLinks: linksList,
      nodesById: nodesByIdMap 
    };
  }, [nodes, edges, searchResults, dimensions]);

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

    const centerX = dimensions.width / 2 || 400;
    const centerY = dimensions.height / 2 || 300;

    // Draw level circles (rings)
    const maxLevel = Math.max(...forceNodes.map(n => n.level), 0);
    for (let level = 1; level <= maxLevel; level++) {
      const radius = level * 120;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200, 200, 200, ${0.3 - level * 0.04})`;
      ctx.lineWidth = 1 / transform.k;
      ctx.setLineDash([5 / transform.k, 5 / transform.k]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Level label
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
      // Add parent
      if (hoveredNode.parentId) connectedNodeIds.add(hoveredNode.parentId);
      // Add children
      hoveredNode.childIds.forEach(id => connectedNodeIds.add(id));
      // Add self
      connectedNodeIds.add(hoveredNode.id);
    }

    // Draw links
    const isHovered = !!hoveredNode;
    
    forceLinks.forEach(link => {
      const source = typeof link.source === "string" 
        ? nodesById.get(link.source) 
        : link.source;
      const target = typeof link.target === "string" 
        ? nodesById.get(link.target) 
        : link.target;

      if (!source || !target) return;

      const isConnected = isHovered && 
        (connectedNodeIds.has(source.id) && connectedNodeIds.has(target.id));

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
    forceNodes.forEach(node => {
      const isNodeHovered = hoveredNode?.id === node.id;
      const isConnected = isHovered && connectedNodeIds.has(node.id);
      const radius = node.level === 0 ? 22 : node.level === 1 ? 16 : 11;

      // Dim non-connected nodes
      if (isHovered && !isConnected) {
        ctx.globalAlpha = 0.25;
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Border
      ctx.lineWidth = (isNodeHovered ? 4 : isConnected ? 3 : 2) / transform.k;
      ctx.strokeStyle = isConnected ? "#9370DB" : node.isMatch ? "#FFC107" : node.borderColor;
      ctx.stroke();

      // Highlight
      if (isNodeHovered || isConnected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 5 / transform.k, 0, Math.PI * 2);
        ctx.strokeStyle = isNodeHovered ? "rgba(255, 193, 7, 0.6)" : "rgba(147, 112, 219, 0.5)";
        ctx.lineWidth = 3 / transform.k;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      // Level badge (always visible on top)
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

      // Child count badge (if has children)
      if (node.childIds.length > 0 && transform.k > 0.6) {
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

      // Label
      if (isNodeHovered || isConnected || transform.k > 0.7) {
        const labelY = node.y + radius + 14 / transform.k;
        const fontSize = Math.max(10, 11 / transform.k);
        
        ctx.font = `${isNodeHovered || isConnected ? "bold " : ""}${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        
        const metrics = ctx.measureText(node.label);
        const padding = 3 / transform.k;
        ctx.fillStyle = isNodeHovered || isConnected ? "rgba(255, 255, 255, 1)" : "rgba(255, 255, 255, 0.95)";
        ctx.beginPath();
        ctx.roundRect(
          node.x - metrics.width / 2 - padding,
          labelY - padding,
          metrics.width + padding * 2,
          fontSize + padding * 2,
          3 / transform.k
        );
        ctx.fill();
        
        ctx.fillStyle = isConnected ? "#9370DB" : "#1F2937";
        ctx.fillText(node.label, node.x, labelY);
      }
    });

    ctx.restore();
  }, [forceNodes, forceLinks, nodesById, hoveredNode, dimensions]);

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
    if (forceNodes.length === 0 || dimensions.width === 0) {
      return undefined;
    }

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const simulation = forceSimulation(forceNodes as SimulationNodeDatum[])
      // Stronger repulsion to spread nodes apart
      .force("charge", forceManyBody().strength(-800).distanceMax(1000))
      // Weaker center gravity to allow more spread
      .force("center", forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.02))
      // Longer links for more space between connected nodes
      .force("link", 
        forceLink(forceLinks as SimulationLinkDatum<SimulationNodeDatum>[])
          .id((d: SimulationNodeDatum) => (d as ForceNode).id)
          .distance(150)
          .strength(0.5)
      )
      // Larger collision radius to prevent overlap
      .force("collide", forceCollide().radius(45).strength(1.0))
      // Keep nodes near their initial level-based position but weaker
      .force("x", forceX((d: SimulationNodeDatum) => (d as ForceNode).initialX).strength(0.02))
      .force("y", forceY((d: SimulationNodeDatum) => (d as ForceNode).initialY).strength(0.02))
      .alphaDecay(0.015)
      .velocityDecay(0.5);

    simulationRef.current = simulation;
    simulation.tick(80);

    return () => {
      simulation.stop();
    };
  }, [forceNodes, forceLinks, dimensions]);

  // Zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
      });

    select(canvas).call(zoomBehavior);
  }, []);

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

  // Mouse handlers
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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

    setHoveredNode(closest);
  }, [forceNodes]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", cursor: hoveredNode ? "pointer" : "grab" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredNode(null)}
      />

      {hoveredNode && (
        <div
          style={{
            position: "absolute",
            left: 16,
            bottom: 16,
            padding: "14px 18px",
            background: "rgba(0, 0, 0, 0.92)",
            borderRadius: "10px",
            color: "white",
            fontSize: "13px",
            zIndex: 20,
            maxWidth: "300px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "26px",
                height: "26px",
                background: hoveredNode.level === 0 ? "#7B1FA2" : "#3B82F6",
                borderRadius: "50%",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              {hoveredNode.level}
            </span>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>{hoveredNode.label}</span>
          </div>
          <div style={{ color: "#D1D5DB", fontSize: "12px", lineHeight: 1.6 }}>
            <div><strong>Type:</strong> {hoveredNode.type}</div>
            <div><strong>ID:</strong> {hoveredNode.id}</div>
            {hoveredNode.parentId && (
              <div style={{ color: "#9CA3AF" }}>👆 Parent: {hoveredNode.parentId}</div>
            )}
            {hoveredNode.childIds.length > 0 && (
              <div style={{ color: "#10B981", marginTop: "4px" }}>
                👶 {hoveredNode.childIds.length} child{hoveredNode.childIds.length > 1 ? 'ren' : ''}
              </div>
            )}
            {hoveredNode.level === 0 && (
              <div style={{ color: "#F59E0B", marginTop: "4px" }}>🌟 Core Node</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
