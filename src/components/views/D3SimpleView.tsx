import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { hierarchy, tree } from "d3-hierarchy";
import { zoom, zoomIdentity } from "d3-zoom";
import { select } from "d3-selection";
import type { Edge } from "@xyflow/react";
import type { CustomNode } from "../../types";

interface TreeNode {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  borderColor: string;
  type: string;
  level: number;
  isMatch: boolean;
  children?: TreeNode[];
  parent?: TreeNode;
  data: CustomNode;
}

interface TreeLink {
  source: TreeNode;
  target: TreeNode;
}

interface D3SimpleViewProps {
  nodes: CustomNode[];
  edges: Edge[];
  searchResults: Array<{ node: CustomNode; matches: boolean }>;
}

export const D3SimpleView = ({ nodes, edges, searchResults }: D3SimpleViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef(zoomIdentity);
  const rafRef = useRef<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredNode, setHoveredNode] = useState<TreeNode | null>(null);

  // Build hierarchical tree structure
  const treeData = useMemo(() => {
    const visibleCount = Math.min(nodes.length, 200);
    const visibleNodes = nodes.slice(0, visibleCount);
    
    if (visibleNodes.length === 0) return null;

    // Build parent-child relationships
    const nodeMap = new Map<string, CustomNode>();
    const childrenMap = new Map<string, string[]>();
    
    visibleNodes.forEach(node => {
      nodeMap.set(node.id, node);
      childrenMap.set(node.id, []);
    });

    edges.forEach(edge => {
      if (childrenMap.has(edge.source) && nodeMap.has(edge.target)) {
        childrenMap.get(edge.source)!.push(edge.target);
      }
    });

    // Find root node
    const rootNode = visibleNodes.find(n => n.data.metadata.level === 0);
    if (!rootNode) return null;

    // Build tree recursively
    const buildTree = (nodeId: string): TreeNode | null => {
      const node = nodeMap.get(nodeId);
      if (!node) return null;

      const searchResult = searchResults.find(r => r.node.id === node.id);
      const isMatch = searchResult?.matches || false;
      const style = node.style as Record<string, string> || {};

      const children = childrenMap.get(nodeId) || [];
      const childNodes = children
        .map(childId => buildTree(childId))
        .filter((child): child is TreeNode => child !== null);

      return {
        id: node.id,
        label: node.data.label,
        x: 0,
        y: 0,
        color: style.background || "#E3F2FD",
        borderColor: isMatch ? "#FFC107" : style.border?.split(" ")[2] || "#1976D2",
        type: node.data.metadata.type,
        level: node.data.metadata.level,
        isMatch,
        children: childNodes.length > 0 ? childNodes : undefined,
        data: node,
      };
    };

    return buildTree(rootNode.id);
  }, [nodes, edges, searchResults]);

  // Apply tree layout
  const { treeNodes, treeLinks } = useMemo(() => {
    if (!treeData || dimensions.width === 0) {
      return { treeNodes: [], treeLinks: [] };
    }

    // Create d3 hierarchy
    const root = hierarchy<TreeNode>(treeData, d => d.children);

    // Apply tree layout
    const treeLayout = tree<TreeNode>()
      .size([dimensions.height - 100, dimensions.width - 200])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2));

    treeLayout(root);

    // Extract nodes and links
    const nodes: TreeNode[] = [];
    const links: TreeLink[] = [];

    root.descendants().forEach(d => {
      const node = d.data;
      node.x = (d.y ?? 0) + 100;
      node.y = (d.x ?? 0) + 50;
      nodes.push(node);

      if (d.parent) {
        links.push({
          source: d.parent.data,
          target: node,
        });
      }
    });

    return { treeNodes: nodes, treeLinks: links };
  }, [treeData, dimensions]);

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

    // Determine connected nodes when hovering
    const connectedNodeIds = new Set<string>();
    const connectedLinks: TreeLink[] = [];
    const disconnectedLinks: TreeLink[] = [];

    if (hoveredNode) {
      treeLinks.forEach(link => {
        if (link.source.id === hoveredNode.id || link.target.id === hoveredNode.id) {
          connectedLinks.push(link);
          connectedNodeIds.add(link.source.id);
          connectedNodeIds.add(link.target.id);
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

    const linksToDraw = hoveredNode ? disconnectedLinks : treeLinks;
    linksToDraw.forEach(link => {
      ctx.beginPath();
      ctx.moveTo(link.source.x, link.source.y);
      
      // Curved connection for tree
      const midX = (link.source.x + link.target.x) / 2;
      ctx.bezierCurveTo(
        midX, link.source.y,
        midX, link.target.y,
        link.target.x, link.target.y
      );
      ctx.stroke();
    });

    // Draw connected links (highlighted)
    if (hoveredNode && connectedLinks.length > 0) {
      ctx.strokeStyle = "rgba(147, 112, 219, 0.8)";
      ctx.lineWidth = 2.5 / transform.k;
      ctx.shadowColor = "rgba(147, 112, 219, 0.5)";
      ctx.shadowBlur = 8 / transform.k;

      connectedLinks.forEach(link => {
        ctx.beginPath();
        ctx.moveTo(link.source.x, link.source.y);
        const midX = (link.source.x + link.target.x) / 2;
        ctx.bezierCurveTo(
          midX, link.source.y,
          midX, link.target.y,
          link.target.x, link.target.y
        );
        ctx.stroke();
      });

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }

    // Draw nodes
    treeNodes.forEach(node => {
      const isHovered = hoveredNode?.id === node.id;
      const isConnected = hoveredNode && connectedNodeIds.has(node.id);
      const radius = node.level === 0 ? 22 : node.level === 1 ? 16 : 11;

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

      // Highlight
      if (isHovered || isConnected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 5 / transform.k, 0, Math.PI * 2);
        ctx.strokeStyle = isHovered ? "rgba(255, 193, 7, 0.6)" : "rgba(147, 112, 219, 0.4)";
        ctx.lineWidth = 3 / transform.k;
        ctx.stroke();
      }

      // Reset alpha
      ctx.globalAlpha = 1;

      // Level badge (always visible)
      const badgeRadius = Math.max(7, 9 / transform.k);
      const badgeY = node.y - radius - badgeRadius / 2;
      
      // Badge background
      ctx.beginPath();
      ctx.arc(node.x, badgeY, badgeRadius, 0, Math.PI * 2);
      ctx.fillStyle = isConnected ? "#9370DB" : node.level === 0 ? "#7B1FA2" : "#3B82F6";
      ctx.fill();
      
      // Badge border
      ctx.lineWidth = 1 / transform.k;
      ctx.strokeStyle = "white";
      ctx.stroke();
      
      // Level number
      ctx.fillStyle = "white";
      ctx.font = `bold ${Math.max(8, 9 / transform.k)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(node.level), node.x, badgeY);

      // Label
      if (isHovered || isConnected || transform.k > 0.6) {
        const labelY = node.y + radius + 14 / transform.k;
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

      // Child count indicator
      if (node.children && node.children.length > 0 && transform.k > 0.7) {
        const countRadius = Math.max(8, 10 / transform.k);
        const countX = node.x + radius + countRadius / 2;
        const countY = node.y - radius / 2;
        
        ctx.beginPath();
        ctx.arc(countX, countY, countRadius, 0, Math.PI * 2);
        ctx.fillStyle = "#10B981";
        ctx.fill();
        
        ctx.fillStyle = "white";
        ctx.font = `bold ${Math.max(8, 9 / transform.k)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(node.children.length), countX, countY);
      }
    });

    ctx.restore();
  }, [treeNodes, treeLinks, hoveredNode]);

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

  // Initialize zoom with fit
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || treeNodes.length === 0) return;

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
      });

    const selection = select(canvas);
    selection.call(zoomBehavior);

    // Auto-fit to show all nodes
    const minX = Math.min(...treeNodes.map(n => n.x));
    const maxX = Math.max(...treeNodes.map(n => n.x));
    const minY = Math.min(...treeNodes.map(n => n.y));
    const maxY = Math.max(...treeNodes.map(n => n.y));
    
    const width = maxX - minX;
    const height = maxY - minY;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    const scale = Math.min(
      (canvasWidth - 100) / width,
      (canvasHeight - 100) / height,
      1.2
    );
    
    const translateX = (canvasWidth - width * scale) / 2 - minX * scale;
    const translateY = (canvasHeight - height * scale) / 2 - minY * scale;
    
    selection.call(
      zoomBehavior.transform,
      zoomIdentity.translate(translateX, translateY).scale(scale)
    );
  }, [treeNodes]);

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

    let closest: TreeNode | null = null;
    let minDist = Infinity;

    treeNodes.forEach((node) => {
      const radius = node.level === 0 ? 22 : node.level === 1 ? 16 : 11;
      const dx = x - node.x;
      const dy = y - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius + 5 && dist < minDist) {
        minDist = dist;
        closest = node;
      }
    });

    setHoveredNode(closest);
  }, [treeNodes]);

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
            background: "rgba(0, 0, 0, 0.9)",
            borderRadius: "10px",
            color: "white",
            fontSize: "13px",
            zIndex: 20,
            maxWidth: "280px",
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
            {hoveredNode.children && (
              <div style={{ color: "#10B981", marginTop: "6px" }}>
                👶 {hoveredNode.children.length} child{hoveredNode.children.length > 1 ? 'ren' : ''}
              </div>
            )}
            {hoveredNode.level === 0 && (
              <div style={{ color: "#F59E0B", marginTop: "4px" }}>🌟 Root Node</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
