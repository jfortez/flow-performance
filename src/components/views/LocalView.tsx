import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { hierarchy, cluster, tree } from "d3-hierarchy";
import { forceSimulation, forceManyBody, forceCenter, forceLink, forceCollide } from "d3-force";
import { zoom, zoomIdentity } from "d3-zoom";
import { select } from "d3-selection";
import type { Edge } from "@xyflow/react";
import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";
import type { CustomNode } from "../../types";

interface LocalViewNode extends SimulationNodeDatum {
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
  isSelected: boolean;
  parentId?: string;
  childrenIds: string[];
}

interface LocalViewLink extends SimulationLinkDatum<LocalViewNode> {
  source: string | LocalViewNode;
  target: string | LocalViewNode;
}

interface LocalViewProps {
  nodes: CustomNode[];
  edges: Edge[];
  searchResults: Array<{ node: CustomNode; matches: boolean }>;
  neighborLevels?: number;
  overviewLayout?: "cluster" | "tree";
}

export const LocalView = ({ 
  nodes, 
  edges, 
  searchResults, 
  neighborLevels = 2,
  overviewLayout = "cluster"
}: LocalViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const overviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const detailCanvasRef = useRef<HTMLCanvasElement>(null);
  const overviewTransformRef = useRef(zoomIdentity);
  const detailTransformRef = useRef(zoomIdentity);
  const simulationRef = useRef<ReturnType<typeof forceSimulation> | null>(null);
  const rafRef = useRef<number | null>(null);
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<{ node: LocalViewNode; canvas: "overview" | "detail" } | null>(null);
  const [detailNodes, setDetailNodes] = useState<LocalViewNode[]>([]);
  const [detailLinks, setDetailLinks] = useState<LocalViewLink[]>([]);

  // Build hierarchical data structure for overview
  const hierarchyData = useMemo(() => {
    const nodeMap = new Map<string, CustomNode>();
    const childrenMap = new Map<string, string[]>();
    
    nodes.forEach(node => {
      nodeMap.set(node.id, node);
      childrenMap.set(node.id, []);
    });
    
    edges.forEach(edge => {
      if (childrenMap.has(edge.source) && nodeMap.has(edge.target)) {
        childrenMap.get(edge.source)!.push(edge.target);
      }
    });
    
    // Find root
    const rootNode = nodes.find(n => n.data.metadata.level === 0) || nodes[0];
    if (!rootNode) return null;

    const buildHierarchy = (nodeId: string): any => {
      const node = nodeMap.get(nodeId);
      if (!node) return null;
      
      const children = childrenMap.get(nodeId) || [];
      return {
        id: nodeId,
        data: node,
        children: children.map(buildHierarchy).filter(Boolean)
      };
    };

    return buildHierarchy(rootNode.id);
  }, [nodes, edges]);

  // Calculate overview layout using d3-hierarchy
  const overviewNodes = useMemo((): LocalViewNode[] => {
    if (!hierarchyData || dimensions.width === 0) return [];

    const root = hierarchy(hierarchyData);
    const layout = overviewLayout === "cluster" ? cluster() : tree();
    
    // Size based on available space
    const overviewHeight = dimensions.height * 0.35;
    const overviewWidth = dimensions.width;
    
    layout.size([overviewWidth - 80, overviewHeight - 60]);
    layout(root);

    const positionedNodes: LocalViewNode[] = [];
    
    root.descendants().forEach((d: any) => {
      const node = d.data.data as CustomNode;
      const searchResult = searchResults.find((r) => r.node.id === node.id);
      const isMatch = searchResult?.matches || false;
      const isSelected = selectedNodeId === node.id;
      const style = node.style as Record<string, string> || {};
      
      positionedNodes.push({
        id: node.id,
        label: node.data.label,
        x: d.x + 40,
        y: d.y + 30,
        vx: 0,
        vy: 0,
        color: style.background || (d.depth === 0 ? "#F3E5F5" : "#E8EAF6"),
        borderColor: isSelected ? "#F59E0B" : isMatch ? "#FFC107" : style.border?.split(" ")[2] || "#3F51B5",
        type: node.data.metadata.type,
        status: node.data.metadata.status,
        level: node.data.metadata.level,
        isMatch,
        isRoot: d.depth === 0,
        isSelected,
        parentId: d.parent?.data.id,
        childrenIds: d.children?.map((c: any) => c.data.id) || []
      });
    });

    return positionedNodes;
  }, [hierarchyData, searchResults, selectedNodeId, dimensions, overviewLayout]);

  const overviewLinks = useMemo((): LocalViewLink[] => {
    if (!hierarchyData) return [];
    
    const links: LocalViewLink[] = [];
    const root = hierarchy(hierarchyData);
    
    root.links().forEach((link: any) => {
      links.push({
        source: link.source.data.id,
        target: link.target.data.id
      });
    });
    
    return links;
  }, [hierarchyData]);

  // Calculate detail view nodes (selected node + neighbors)
  useEffect(() => {
    if (!selectedNodeId || nodes.length === 0) {
      // Default to root if no selection
      const rootNode = nodes.find(n => n.data.metadata.level === 0);
      if (rootNode && !selectedNodeId) {
        setSelectedNodeId(rootNode.id);
      }
      return;
    }

    // Build adjacency lists
    const childrenMap = new Map<string, string[]>();
    const parentMap = new Map<string, string>();
    const nodeMap = new Map<string, CustomNode>();
    
    nodes.forEach(node => {
      nodeMap.set(node.id, node);
      childrenMap.set(node.id, []);
    });
    
    edges.forEach(edge => {
      if (childrenMap.has(edge.source) && nodeMap.has(edge.target)) {
        childrenMap.get(edge.source)!.push(edge.target);
        parentMap.set(edge.target, edge.source);
      }
    });

    // BFS to find neighbors up to specified levels
    const visited = new Set<string>();
    const queue: Array<{ id: string; level: number }> = [{ id: selectedNodeId, level: 0 }];
    const neighborIds: string[] = [];
    
    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      
      if (visited.has(id) || level > neighborLevels) continue;
      visited.add(id);
      neighborIds.push(id);
      
      if (level < neighborLevels) {
        // Add children
        const children = childrenMap.get(id) || [];
        children.forEach(childId => {
          if (!visited.has(childId)) {
            queue.push({ id: childId, level: level + 1 });
          }
        });
        
        // Add parent
        const parentId = parentMap.get(id);
        if (parentId && !visited.has(parentId)) {
          queue.push({ id: parentId, level: level + 1 });
        }
      }
    }

    // Create detail nodes
    const detailWidth = dimensions.width;
    const detailHeight = dimensions.height * 0.6;
    const centerX = detailWidth / 2;
    const centerY = detailHeight / 2;
    
    const newDetailNodes: LocalViewNode[] = neighborIds.map((nodeId, index) => {
      const node = nodeMap.get(nodeId)!;
      const searchResult = searchResults.find((r) => r.node.id === node.id);
      const isMatch = searchResult?.matches || false;
      const isSelected = nodeId === selectedNodeId;
      const style = node.style as Record<string, string> || {};
      
      // Position in circle around center, selected node in middle
      let x = centerX;
      let y = centerY;
      
      if (!isSelected) {
        const angle = (index / Math.max(1, neighborIds.length - 1)) * 2 * Math.PI;
        const radius = 150 + (node.data.metadata.level * 30);
        x = centerX + Math.cos(angle) * radius;
        y = centerY + Math.sin(angle) * radius;
      }
      
      return {
        id: node.id,
        label: node.data.label,
        x,
        y,
        vx: 0,
        vy: 0,
        color: style.background || (isSelected ? "#FEF3C7" : "#E8EAF6"),
        borderColor: isSelected ? "#F59E0B" : isMatch ? "#FFC107" : style.border?.split(" ")[2] || "#3F51B5",
        type: node.data.metadata.type,
        status: node.data.metadata.status,
        level: node.data.metadata.level,
        isMatch,
        isRoot: node.data.metadata.level === 0,
        isSelected,
        parentId: parentMap.get(nodeId),
        childrenIds: childrenMap.get(nodeId) || []
      };
    });

    // Create detail links
    const newDetailLinks: LocalViewLink[] = [];
    neighborIds.forEach(nodeId => {
      const node = newDetailNodes.find(n => n.id === nodeId)!;
      
      // Link to parent if in set
      if (node.parentId && visited.has(node.parentId)) {
        newDetailLinks.push({
          source: node.parentId,
          target: nodeId
        });
      }
      
      // Links to children if in set
      node.childrenIds.forEach(childId => {
        if (visited.has(childId)) {
          newDetailLinks.push({
            source: nodeId,
            target: childId
          });
        }
      });
    });

    setDetailNodes(newDetailNodes);
    setDetailLinks(newDetailLinks);
  }, [selectedNodeId, nodes, edges, searchResults, neighborLevels, dimensions]);

  // Get node radius
  const getNodeRadius = useCallback((node: LocalViewNode) => {
    if (node.isSelected) return 28;
    if (node.isRoot) return 22;
    if (node.type === "process") return 16;
    return 12;
  }, []);

  // Render overview canvas
  const renderOverview = useCallback(() => {
    const canvas = overviewCanvasRef.current;
    if (!canvas || overviewNodes.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const transform = overviewTransformRef.current;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // Draw links
    ctx.strokeStyle = "rgba(150, 150, 150, 0.3)";
    ctx.lineWidth = 1 / transform.k;

    overviewLinks.forEach((link) => {
      const sourceNode = overviewNodes.find(n => n.id === link.source);
      const targetNode = overviewNodes.find(n => n.id === link.target);
      if (!sourceNode || !targetNode) return;

      ctx.beginPath();
      ctx.moveTo(sourceNode.x, sourceNode.y);
      ctx.lineTo(targetNode.x, targetNode.y);
      ctx.stroke();
    });

    // Draw nodes
    overviewNodes.forEach((node) => {
      const radius = getNodeRadius(node);
      const isHovered = hoveredNode?.node.id === node.id && hoveredNode?.canvas === "overview";

      // Selection indicator
      if (node.isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 8 / transform.k, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
        ctx.lineWidth = 3 / transform.k;
        ctx.stroke();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Border
      ctx.lineWidth = (isHovered ? 3 : node.isSelected ? 3 : 2) / transform.k;
      ctx.strokeStyle = node.borderColor;
      ctx.stroke();

      // Highlight for matches
      if (node.isMatch || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 4 / transform.k, 0, Math.PI * 2);
        ctx.strokeStyle = node.isMatch ? "rgba(255, 193, 7, 0.5)" : "rgba(59, 130, 246, 0.5)";
        ctx.lineWidth = 2 / transform.k;
        ctx.stroke();
      }

      // Label for selected or on hover
      if (node.isSelected || (isHovered && transform.k > 0.5)) {
        ctx.fillStyle = "#1F2937";
        ctx.font = `${node.isSelected ? "bold " : ""}${Math.max(9, 10 / transform.k)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(node.label, node.x, node.y + radius + 4 / transform.k);
      }
    });

    ctx.restore();
  }, [overviewNodes, overviewLinks, hoveredNode, getNodeRadius]);

  // Render detail canvas
  const renderDetail = useCallback(() => {
    const canvas = detailCanvasRef.current;
    if (!canvas || detailNodes.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const transform = detailTransformRef.current;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // Draw links
    ctx.strokeStyle = "rgba(100, 100, 100, 0.4)";
    ctx.lineWidth = 2 / transform.k;

    detailLinks.forEach((link) => {
      const sourceNode = typeof link.source === "string" 
        ? detailNodes.find(n => n.id === link.source)
        : link.source;
      const targetNode = typeof link.target === "string"
        ? detailNodes.find(n => n.id === link.target)
        : link.target;

      if (!sourceNode || !targetNode) return;

      ctx.beginPath();
      ctx.moveTo(sourceNode.x, sourceNode.y);
      ctx.lineTo(targetNode.x, targetNode.y);
      ctx.stroke();
    });

    // Draw nodes
    detailNodes.forEach((node) => {
      const radius = getNodeRadius(node);
      const isHovered = hoveredNode?.node.id === node.id && hoveredNode?.canvas === "detail";

      // Glow for selected node
      if (node.isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 12 / transform.k, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Border
      ctx.lineWidth = (isHovered ? 4 : node.isSelected ? 4 : 2) / transform.k;
      ctx.strokeStyle = node.borderColor;
      ctx.stroke();

      // Highlight
      if (node.isMatch || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 6 / transform.k, 0, Math.PI * 2);
        ctx.strokeStyle = node.isMatch ? "rgba(255, 193, 7, 0.5)" : "rgba(59, 130, 246, 0.5)";
        ctx.lineWidth = 3 / transform.k;
        ctx.stroke();
      }

      // Level badge
      if (!node.isRoot && transform.k > 0.4) {
        const badgeRadius = Math.max(7, 9 / transform.k);
        const badgeY = node.y - radius - badgeRadius / 2;
        
        ctx.beginPath();
        ctx.arc(node.x, badgeY, badgeRadius, 0, Math.PI * 2);
        ctx.fillStyle = node.isSelected ? "#F59E0B" : "#6B7280";
        ctx.fill();
        
        ctx.fillStyle = "white";
        ctx.font = `bold ${Math.max(8, 9 / transform.k)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(node.level), node.x, badgeY);
      }

      // Label
      if (transform.k > 0.5 || node.isSelected) {
        const labelY = node.y + radius + 15 / transform.k;
        const fontSize = Math.max(11, 12 / transform.k);
        
        ctx.font = `${node.isSelected ? "bold " : ""}${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        
        // Background
        const textMetrics = ctx.measureText(node.label);
        const padding = 3 / transform.k;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
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
        ctx.fillStyle = node.isSelected ? "#B45309" : "#1F2937";
        ctx.fillText(node.label, node.x, labelY);
      }
    });

    ctx.restore();
  }, [detailNodes, detailLinks, hoveredNode, getNodeRadius]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      renderOverview();
      renderDetail();
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [renderOverview, renderDetail]);

  // Force simulation for detail view
  useEffect(() => {
    if (detailNodes.length === 0 || dimensions.width === 0) return;

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const detailWidth = dimensions.width;
    const detailHeight = dimensions.height * 0.6;

    const simulation = forceSimulation(detailNodes as SimulationNodeDatum[])
      .force("charge", forceManyBody().strength(-200).distanceMax(200))
      .force("link", forceLink(detailLinks as SimulationLinkDatum<SimulationNodeDatum>[])
        .id((d: SimulationNodeDatum) => (d as LocalViewNode).id)
        .distance(80)
        .strength(0.5)
      )
      .force("collide", forceCollide().radius((d) => getNodeRadius(d as LocalViewNode) + 15).strength(0.8))
      .force("center", forceCenter(detailWidth / 2, detailHeight / 2).strength(0.1))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    simulationRef.current = simulation;
    simulation.tick(50);

    return () => {
      simulation.stop();
    };
  }, [detailNodes, detailLinks, dimensions, getNodeRadius]);

  // Initialize zoom for overview
  useEffect(() => {
    const canvas = overviewCanvasRef.current;
    if (!canvas) return;

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.3, 2])
      .on("zoom", (event) => {
        overviewTransformRef.current = event.transform;
      });

    const selection = select(canvas);
    selection.call(zoomBehavior);

    return () => {
      selection.on(".zoom", null);
    };
  }, []);

  // Initialize zoom for detail
  useEffect(() => {
    const canvas = detailCanvasRef.current;
    if (!canvas) return;

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        detailTransformRef.current = event.transform;
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
      if (containerRef.current && overviewCanvasRef.current && detailCanvasRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        
        overviewCanvasRef.current.width = width;
        overviewCanvasRef.current.height = height * 0.35;
        
        detailCanvasRef.current.width = width;
        detailCanvasRef.current.height = height * 0.6;
        
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
  const handleOverviewMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overviewCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - overviewTransformRef.current.x) / overviewTransformRef.current.k;
    const y = (event.clientY - rect.top - overviewTransformRef.current.y) / overviewTransformRef.current.k;

    let closestNode: LocalViewNode | null = null;
    let minDistance = Infinity;

    overviewNodes.forEach((node) => {
      const radius = getNodeRadius(node);
      const dx = x - node.x;
      const dy = y - node.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < radius + 3 && distance < minDistance) {
        minDistance = distance;
        closestNode = node;
      }
    });

    setHoveredNode(closestNode ? { node: closestNode, canvas: "overview" } : null);
  }, [overviewNodes, getNodeRadius]);

  const handleOverviewClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overviewCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - overviewTransformRef.current.x) / overviewTransformRef.current.k;
    const y = (event.clientY - rect.top - overviewTransformRef.current.y) / overviewTransformRef.current.k;

    overviewNodes.forEach((node) => {
      const radius = getNodeRadius(node);
      const dx = x - node.x;
      const dy = y - node.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < radius + 3) {
        setSelectedNodeId(node.id);
      }
    });
  }, [overviewNodes, getNodeRadius]);

  const handleDetailMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = detailCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - detailTransformRef.current.x) / detailTransformRef.current.k;
    const y = (event.clientY - rect.top - detailTransformRef.current.y) / detailTransformRef.current.k;

    let closestNode: LocalViewNode | null = null;
    let minDistance = Infinity;

    detailNodes.forEach((node) => {
      const radius = getNodeRadius(node);
      const dx = x - node.x;
      const dy = y - node.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < radius + 3 && distance < minDistance) {
        minDistance = distance;
        closestNode = node;
      }
    });

    setHoveredNode(closestNode ? { node: closestNode, canvas: "detail" } : null);
  }, [detailNodes, getNodeRadius]);

  const handleDetailClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = detailCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - detailTransformRef.current.x) / detailTransformRef.current.k;
    const y = (event.clientY - rect.top - detailTransformRef.current.y) / detailTransformRef.current.k;

    detailNodes.forEach((node) => {
      const radius = getNodeRadius(node);
      const dx = x - node.x;
      const dy = y - node.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < radius + 3) {
        setSelectedNodeId(node.id);
      }
    });
  }, [detailNodes, getNodeRadius]);

  const selectedNode = overviewNodes.find(n => n.id === selectedNodeId) || detailNodes.find(n => n.id === selectedNodeId);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Overview Panel */}
      <div style={{ flex: "0 0 35%", position: "relative", border: "1px solid #E5E7EB", borderRadius: "8px", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 8, left: 8, zIndex: 10, background: "rgba(255,255,255,0.95)", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600, color: "#6B7280" }}>
          Overview
        </div>
        <canvas
          ref={overviewCanvasRef}
          style={{ width: "100%", height: "100%", cursor: hoveredNode?.canvas === "overview" ? "pointer" : "grab" }}
          onMouseMove={handleOverviewMouseMove}
          onClick={handleOverviewClick}
          onMouseLeave={() => setHoveredNode(null)}
        />
      </div>

      {/* Detail Panel */}
      <div style={{ flex: "1", position: "relative", border: "1px solid #E5E7EB", borderRadius: "8px", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 8, left: 8, zIndex: 10, background: "rgba(255,255,255,0.95)", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600, color: "#6B7280" }}>
          Local View {selectedNode && `- ${selectedNode.label}`}
        </div>
        <canvas
          ref={detailCanvasRef}
          style={{ width: "100%", height: "100%", cursor: hoveredNode?.canvas === "detail" ? "pointer" : "grab" }}
          onMouseMove={handleDetailMouseMove}
          onClick={handleDetailClick}
          onMouseLeave={() => setHoveredNode(null)}
        />
      </div>

      {/* Info Panel */}
      {hoveredNode && (
        <div style={{ position: "absolute", bottom: 16, left: 16, padding: "10px 14px", background: "rgba(0, 0, 0, 0.9)", borderRadius: "8px", color: "white", fontSize: "12px", zIndex: 20, maxWidth: "240px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", background: hoveredNode.node.isSelected ? "#F59E0B" : "#3B82F6", borderRadius: "50%", fontSize: "10px", fontWeight: 700 }}>
              {hoveredNode.node.level}
            </span>
            <span style={{ fontWeight: 600 }}>{hoveredNode.node.label}</span>
          </div>
          <div style={{ color: "#D1D5DB", fontSize: "11px", lineHeight: 1.5 }}>
            <div><strong>Type:</strong> {hoveredNode.node.type}</div>
            <div><strong>Status:</strong> {hoveredNode.node.status}</div>
            {hoveredNode.node.isSelected && <div style={{ color: "#10B981", marginTop: "4px" }}>⭐ Selected</div>}
          </div>
        </div>
      )}
    </div>
  );
};
