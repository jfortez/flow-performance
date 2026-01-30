import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { hierarchy, cluster } from "d3-hierarchy";
import { zoom, zoomIdentity } from "d3-zoom";
import { select } from "d3-selection";
import type { Edge } from "@xyflow/react";
import type { CustomNode } from "../../types";

interface ClusterNode {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  borderColor: string;
  type: string;
  status: string;
  level: number;
  isMatch: boolean;
  isRoot: boolean;
  children?: ClusterNode[];
}

interface ClusterLink {
  source: ClusterNode;
  target: ClusterNode;
}

interface D3ClusterViewProps {
  nodes: CustomNode[];
  edges: Edge[];
  searchResults: Array<{ node: CustomNode; matches: boolean }>;
  maxVisibleNodes?: number;
}

export const D3ClusterView = ({ nodes, edges, searchResults, maxVisibleNodes = 500 }: D3ClusterViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef(zoomIdentity);
  const rafRef = useRef<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredNode, setHoveredNode] = useState<ClusterNode | null>(null);

  // Build hierarchical data structure and apply cluster layout
  const { clusterNodes, clusterLinks } = useMemo(() => {
    const visibleCount = Math.min(nodes.length, maxVisibleNodes);
    const visibleNodes = nodes.slice(0, visibleCount);
    
    if (visibleNodes.length === 0) {
      return { clusterNodes: [], clusterLinks: [] };
    }

    // Build node map
    const nodeMap = new Map<string, CustomNode>();
    visibleNodes.forEach(node => nodeMap.set(node.id, node));

    // Build parent-child relationships
    const childrenMap = new Map<string, string[]>();
    const parentMap = new Map<string, string>();
    
    visibleNodes.forEach(node => {
      childrenMap.set(node.id, []);
    });

    edges.forEach(edge => {
      if (childrenMap.has(edge.source) && nodeMap.has(edge.target)) {
        childrenMap.get(edge.source)!.push(edge.target);
        parentMap.set(edge.target, edge.source);
      }
    });

    // Find root
    const rootNode = visibleNodes.find(n => n.data.metadata.level === 0);
    if (!rootNode) {
      return { clusterNodes: [], clusterLinks: [] };
    }

    // Build hierarchy data structure for d3
    const buildHierarchy = (nodeId: string): any => {
      const node = nodeMap.get(nodeId);
      if (!node) return null;

      const searchResult = searchResults.find(r => r.node.id === node.id);
      const isMatch = searchResult?.matches || false;
      const style = node.style as Record<string, string> || {};

      const children = childrenMap.get(nodeId) || [];
      
      return {
        id: node.id,
        label: node.data.label,
        type: node.data.metadata.type,
        status: node.data.metadata.status,
        level: node.data.metadata.level,
        color: style.background || "#E8EAF6",
        borderColor: isMatch ? "#FFC107" : style.border?.split(" ")[2] || "#3F51B5",
        isMatch,
        isRoot: node.data.metadata.level === 0,
        children: children.map(buildHierarchy).filter(Boolean),
      };
    };

    const hierarchyData = buildHierarchy(rootNode.id);
    if (!hierarchyData) {
      return { clusterNodes: [], clusterLinks: [] };
    }

    // Create d3 hierarchy
    const root = hierarchy(hierarchyData);

    // Apply cluster layout
    const clusterLayout = cluster()
      .size([dimensions.height - 100, dimensions.width - 200])
      .separation((a: any, b: any) => (a.parent === b.parent ? 1 : 2) / a.depth);

    clusterLayout(root);

    // Extract nodes and links
    const nodesList: ClusterNode[] = [];
    const linksList: ClusterLink[] = [];

    root.descendants().forEach((d: any) => {
      nodesList.push({
        id: d.data.id,
        label: d.data.label,
        x: d.y + 100, // Add margin
        y: d.x + 50,
        color: d.data.color,
        borderColor: d.data.borderColor,
        type: d.data.type,
        status: d.data.status,
        level: d.data.level,
        isMatch: d.data.isMatch,
        isRoot: d.data.isRoot,
      });

      if (d.parent) {
        linksList.push({
          source: nodesList[nodesList.length - 1],
          target: nodesList.find(n => n.id === d.parent.data.id)!,
        });
      }
    });

    return { clusterNodes: nodesList, clusterLinks: linksList };
  }, [nodes, edges, searchResults, maxVisibleNodes, dimensions]);

  // Calculate node radius based on type
  const getNodeRadius = useCallback((node: ClusterNode) => {
    if (node.isRoot) return 20;
    if (node.type === "process") return 15;
    return 12;
  }, []);

  // Get label visibility based on zoom scale
  const shouldShowLabel = useCallback((scale: number) => {
    return scale > 0.6;
  }, []);

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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

    // Draw links (edges)
    ctx.strokeStyle = "rgba(150, 150, 150, 0.5)";
    ctx.lineWidth = 1.5 / transform.k;

    clusterLinks.forEach((link) => {
      const source = link.source;
      const target = link.target;

      // Culling
      if ((source.x < visibleLeft && target.x < visibleLeft) ||
          (source.x > visibleRight && target.x > visibleRight) ||
          (source.y < visibleTop && target.y < visibleTop) ||
          (source.y > visibleBottom && target.y > visibleBottom)) {
        return;
      }

      // Draw curved connection
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      
      // Bezier curve for tree-like connections
      const midX = (source.x + target.x) / 2;
      ctx.bezierCurveTo(
        midX, source.y,
        midX, target.y,
        target.x, target.y
      );
      ctx.stroke();
    });

    // Draw nodes
    clusterNodes.forEach((node) => {
      const radius = getNodeRadius(node);
      
      // Culling
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
      ctx.lineWidth = (isHovered ? 3 : node.isMatch ? 2.5 : 2) / transform.k;
      ctx.strokeStyle = node.isMatch ? "#FFC107" : node.borderColor;
      ctx.stroke();

      // Highlight effect
      if (node.isMatch || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 5 / transform.k, 0, Math.PI * 2);
        ctx.strokeStyle = node.isMatch ? "rgba(255, 193, 7, 0.4)" : "rgba(59, 130, 246, 0.4)";
        ctx.lineWidth = 2.5 / transform.k;
        ctx.stroke();
      }

      // Draw level badge (not for root)
      if (!node.isRoot && transform.k > 0.5) {
        const badgeRadius = Math.max(6, 8 / transform.k);
        const badgeY = node.y - radius - badgeRadius / 2;
        
        ctx.beginPath();
        ctx.arc(node.x, badgeY, badgeRadius, 0, Math.PI * 2);
        ctx.fillStyle = node.isMatch ? "#F59E0B" : "#6B7280";
        ctx.fill();
        
        ctx.lineWidth = 0.8 / transform.k;
        ctx.strokeStyle = "white";
        ctx.stroke();
        
        ctx.fillStyle = "white";
        ctx.font = `bold ${Math.max(7, 8 / transform.k)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(node.level), node.x, badgeY);
      }

      // Draw labels
      if (shouldShowLabel(transform.k) || node.isRoot) {
        const labelY = node.y + radius + 15 / transform.k;
        const fontSize = Math.max(10, 11 / transform.k);
        
        ctx.font = `${node.isRoot ? "bold " : ""}${fontSize}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        
        // Text background
        const textMetrics = ctx.measureText(node.label);
        const textWidth = textMetrics.width;
        const textHeight = fontSize;
        const padding = 3 / transform.k;
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
        ctx.beginPath();
        ctx.roundRect(
          node.x - textWidth / 2 - padding,
          labelY - padding,
          textWidth + padding * 2,
          textHeight + padding * 2,
          3 / transform.k
        );
        ctx.fill();
        
        // Text
        ctx.fillStyle = node.isMatch ? "#B45309" : "#1F2937";
        ctx.fillText(node.label, node.x, labelY);
      }
    });

    ctx.restore();
  }, [clusterNodes, clusterLinks, hoveredNode, getNodeRadius, shouldShowLabel]);

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

  // Initialize zoom
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

    // Initial fit
    if (clusterNodes.length > 0) {
      const minX = Math.min(...clusterNodes.map(n => n.x));
      const maxX = Math.max(...clusterNodes.map(n => n.x));
      const minY = Math.min(...clusterNodes.map(n => n.y));
      const maxY = Math.max(...clusterNodes.map(n => n.y));
      
      const width = maxX - minX;
      const height = maxY - minY;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      const scale = Math.min(
        (canvasWidth - 100) / width,
        (canvasHeight - 100) / height,
        1
      );
      
      const translateX = (canvasWidth - width * scale) / 2 - minX * scale;
      const translateY = (canvasHeight - height * scale) / 2 - minY * scale;
      
      selection.call(
        zoomBehavior.transform,
        zoomIdentity.translate(translateX, translateY).scale(scale)
      );
    }

    return () => {
      selection.on(".zoom", null);
    };
  }, [clusterNodes]);

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

  // Handle mouse interactions
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
    const y = (event.clientY - rect.top - transformRef.current.y) / transformRef.current.k;

    let closestNode: ClusterNode | null = null;
    let minDistance = Infinity;

    clusterNodes.forEach((node) => {
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
  }, [clusterNodes, getNodeRadius]);

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

      {/* Tooltip */}
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
