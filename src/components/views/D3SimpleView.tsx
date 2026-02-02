import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { forceSimulation, forceManyBody, forceCenter, forceLink, forceCollide } from "d3-force";
import { zoom, zoomIdentity } from "d3-zoom";
import { select } from "d3-selection";
import type { Edge } from "@xyflow/react";
import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";
import type { CustomNode } from "../../types";

interface SimpleNode extends SimulationNodeDatum {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  borderColor: string;
  type: string;
  level: number;
  isMatch: boolean;
}

interface SimpleLink extends SimulationLinkDatum<SimpleNode> {
  source: string | SimpleNode;
  target: string | SimpleNode;
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
  const [hoveredNode, setHoveredNode] = useState<SimpleNode | null>(null);

  // Support up to 150 nodes with hierarchical levels
  const simpleNodes = useMemo((): SimpleNode[] => {
    const limitedNodes = nodes.slice(0, 150);
    
    // Group by level for concentric positioning
    const nodesByLevel = new Map<number, CustomNode[]>();
    limitedNodes.forEach((node) => {
      const level = node.data.metadata.level;
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level)!.push(node);
    });
    
    // Position nodes in concentric circles by level
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radiusStep = 150; // Distance between levels
    
    const positionedNodes: SimpleNode[] = [];
    
    nodesByLevel.forEach((levelNodes, level) => {
      const radius = level * radiusStep;
      const angleStep = (2 * Math.PI) / levelNodes.length;
      
      levelNodes.forEach((node, index) => {
        const searchResult = searchResults.find((r) => r.node.id === node.id);
        const isMatch = searchResult?.matches || false;
        const style = node.style as Record<string, string> || {};
        
        // Position in concentric circle with some randomness
        const angle = angleStep * index + (Math.random() - 0.5) * 0.2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        positionedNodes.push({
          id: node.id,
          label: node.data.label,
          x,
          y,
          color: style.background || "#E3F2FD",
          borderColor: isMatch ? "#FFC107" : style.border?.split(" ")[2] || "#1976D2",
          type: node.data.metadata.type,
          level,
          isMatch,
        });
      });
    });
    
    return positionedNodes;
  }, [nodes, searchResults, dimensions]);

  const simpleLinks = useMemo((): SimpleLink[] => {
    const nodeIds = new Set(simpleNodes.map((n) => n.id));
    return edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
      }));
  }, [edges, simpleNodes]);

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

    // Draw concentric level rings
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radiusStep = 150;
    const maxLevel = Math.max(...simpleNodes.map(n => n.level), 0);
    
    for (let level = 1; level <= maxLevel; level++) {
      const radius = level * radiusStep;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200, 200, 200, ${0.4 - level * 0.05})`;
      ctx.lineWidth = 1 / transform.k;
      ctx.setLineDash([5 / transform.k, 5 / transform.k]);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw level label
      if (transform.k > 0.5) {
        ctx.fillStyle = `rgba(150, 150, 150, ${0.8 - level * 0.1})`;
        ctx.font = `${Math.max(10, 11 / transform.k)}px system-ui, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`L${level}`, centerX + radius + 5 / transform.k, centerY);
      }
    }

    // Determine connected nodes when hovering
    const connectedNodeIds = new Set<string>();
    const connectedLinks: SimpleLink[] = [];
    const disconnectedLinks: SimpleLink[] = [];

    if (hoveredNode) {
      simpleLinks.forEach((link) => {
        const sourceId = typeof link.source === "string" ? link.source : link.source.id;
        const targetId = typeof link.target === "string" ? link.target : link.target.id;
        
        if (sourceId === hoveredNode.id || targetId === hoveredNode.id) {
          connectedLinks.push(link);
          connectedNodeIds.add(sourceId);
          connectedNodeIds.add(targetId);
        } else {
          disconnectedLinks.push(link);
        }
      });
    }

    // Draw disconnected links (dimmed)
    if (hoveredNode) {
      ctx.strokeStyle = "rgba(100, 100, 100, 0.08)";
      ctx.lineWidth = 0.5 / transform.k;
    } else {
      ctx.strokeStyle = "rgba(100, 100, 100, 0.3)";
      ctx.lineWidth = 1 / transform.k;
    }

    const linksToDraw = hoveredNode ? disconnectedLinks : simpleLinks;
    linksToDraw.forEach((link) => {
      const source = typeof link.source === "string"
        ? simpleNodes.find((n) => n.id === link.source)
        : link.source;
      const target = typeof link.target === "string"
        ? simpleNodes.find((n) => n.id === link.target)
        : link.target;

      if (!source || !target) return;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    });

    // Draw connected links (highlighted)
    if (hoveredNode && connectedLinks.length > 0) {
      ctx.strokeStyle = "rgba(147, 112, 219, 0.8)"; // Purple like Obsidian
      ctx.lineWidth = 2.5 / transform.k;
      ctx.shadowColor = "rgba(147, 112, 219, 0.5)";
      ctx.shadowBlur = 8 / transform.k;

      connectedLinks.forEach((link) => {
        const source = typeof link.source === "string"
          ? simpleNodes.find((n) => n.id === link.source)
          : link.source;
        const target = typeof link.target === "string"
          ? simpleNodes.find((n) => n.id === link.target)
          : link.target;

        if (!source || !target) return;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      });

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }

    // Draw nodes
    simpleNodes.forEach((node) => {
      const isHovered = hoveredNode?.id === node.id;
      const isConnected = hoveredNode && connectedNodeIds.has(node.id);
      const radius = node.level === 0 ? 25 : node.level === 1 ? 18 : 12;

      // Dim non-connected nodes when hovering
      if (hoveredNode && !isHovered && !isConnected) {
        ctx.globalAlpha = 0.3;
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Border
      ctx.lineWidth = (isHovered ? 4 : isConnected ? 3 : 2) / transform.k;
      ctx.strokeStyle = isConnected ? "#9370DB" : node.isMatch ? "#FFC107" : node.borderColor;
      ctx.stroke();

      // Highlight for hovered or connected
      if (isHovered || isConnected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 5 / transform.k, 0, Math.PI * 2);
        ctx.strokeStyle = isHovered ? "rgba(255, 193, 7, 0.6)" : "rgba(147, 112, 219, 0.4)";
        ctx.lineWidth = 3 / transform.k;
        ctx.stroke();
      }

      // Reset alpha
      ctx.globalAlpha = 1;

      // Draw level badge on top of node (not for core)
      if (node.level > 0 && transform.k > 0.6) {
        const badgeRadius = Math.max(7, 9 / transform.k);
        const badgeY = node.y - radius - badgeRadius / 2;
        
        // Badge background
        ctx.beginPath();
        ctx.arc(node.x, badgeY, badgeRadius, 0, Math.PI * 2);
        ctx.fillStyle = isConnected ? "#9370DB" : "#6B7280";
        ctx.fill();
        
        // Badge border
        ctx.lineWidth = 0.8 / transform.k;
        ctx.strokeStyle = "white";
        ctx.stroke();
        
        // Level number
        ctx.fillStyle = "white";
        ctx.font = `bold ${Math.max(8, 9 / transform.k)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(node.level), node.x, badgeY);
      }

      // Label - show for hovered, connected, or if zoomed enough
      if (isHovered || isConnected || transform.k > 0.7) {
        const labelY = node.y + radius + 12 / transform.k;
        const fontSize = Math.max(10, 11 / transform.k);
        
        ctx.font = `${isHovered || isConnected ? "bold " : ""}${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        
        // Background
        const metrics = ctx.measureText(node.label);
        const padding = 3 / transform.k;
        ctx.fillStyle = isHovered || isConnected ? "rgba(255, 255, 255, 1)" : "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.roundRect(
          node.x - metrics.width / 2 - padding,
          labelY - padding,
          metrics.width + padding * 2,
          fontSize + padding * 2,
          3 / transform.k
        );
        ctx.fill();
        
        // Text
        ctx.fillStyle = isConnected ? "#9370DB" : "#1F2937";
        ctx.fillText(node.label, node.x, labelY);
      }
    });

    ctx.restore();
  }, [simpleNodes, simpleLinks, hoveredNode]);

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

  // Simulation
  useEffect(() => {
    if (simpleNodes.length === 0 || dimensions.width === 0) {
      return undefined;
    }

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const simulation = forceSimulation(simpleNodes as SimulationNodeDatum[])
      // Strong repulsion for Obsidian-like spread
      .force("charge", forceManyBody().strength(-600).distanceMax(800))
      // Weaker center force to allow natural clustering
      .force("center", forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.03))
      // Longer links for more space between connected nodes
      .force(
        "link",
        forceLink(simpleLinks as SimulationLinkDatum<SimulationNodeDatum>[])
          .id((d: SimulationNodeDatum) => (d as SimpleNode).id)
          .distance(120)
          .strength(0.5)
      )
      // Larger collision radius to prevent overlap
      .force("collide", forceCollide().radius(35).strength(0.8))
      // Slower cooling for better convergence
      .alphaDecay(0.01)
      .velocityDecay(0.4);

    simulationRef.current = simulation;
    // More ticks for better initial layout
    simulation.tick(100);

    return () => {
      simulation.stop();
    };
  }, [simpleNodes, simpleLinks, dimensions]);

  // Zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.3, 3])
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

    let closest: SimpleNode | null = null;
    let minDist = Infinity;

    simpleNodes.forEach((node) => {
      const radius = node.level === 0 ? 25 : node.level === 1 ? 18 : 12;
      const dx = x - node.x;
      const dy = y - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius + 5 && dist < minDist) {
        minDist = dist;
        closest = node;
      }
    });

    setHoveredNode(closest);
  }, [simpleNodes]);

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
            padding: "12px 16px",
            background: "rgba(0, 0, 0, 0.9)",
            borderRadius: "8px",
            color: "white",
            fontSize: "13px",
            zIndex: 20,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "22px",
                height: "22px",
                background: hoveredNode.level === 0 ? "#7B1FA2" : "#3B82F6",
                borderRadius: "50%",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              {hoveredNode.level}
            </span>
            <span style={{ fontWeight: 600 }}>{hoveredNode.label}</span>
          </div>
          <div style={{ color: "#D1D5DB", fontSize: "12px", lineHeight: 1.5 }}>
            <div>Type: {hoveredNode.type}</div>
            {hoveredNode.level === 0 && <div style={{ color: "#10B981", marginTop: "4px" }}>🌟 Core Node</div>}
          </div>
        </div>
      )}
    </div>
  );
};
