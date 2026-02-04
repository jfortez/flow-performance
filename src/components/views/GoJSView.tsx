import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as go from "gojs";
import type { Edge } from "@xyflow/react";
import type { CustomNode } from "../../types";
import { Toolbar } from "../controls/Toolbar";
import styles from "./GoJSView.module.css";

interface GoJSViewProps {
  nodes: CustomNode[];
  edges: Edge[];
  searchResults: Array<{ node: CustomNode; matches: boolean }>;
}

export const GoJSView = ({
  nodes: initialNodes,
  edges: initialEdges,
  searchResults,
}: GoJSViewProps) => {
  const diagramRef = useRef<HTMLDivElement>(null);
  const diagramInstanceRef = useRef<go.Diagram | null>(null);
  const [isOverviewOpen, setIsOverviewOpen] = useState(true);
  const [allowNodeDrag, setAllowNodeDrag] = useState(true);
  const [hoveredNodeData, setHoveredNodeData] = useState<go.ObjectData | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Build node relationships
  const { parentMap, childrenMap } = useMemo(() => {
    const nodeMap = new Map<string, CustomNode>();
    const parentMap = new Map<string, string>();
    const childrenMap = new Map<string, string[]>();

    initialNodes.forEach((node) => {
      nodeMap.set(node.id, node);
      childrenMap.set(node.id, []);
    });

    initialEdges.forEach((edge) => {
      if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
        childrenMap.get(edge.source)?.push(edge.target);
        parentMap.set(edge.target, edge.source);
      }
    });

    return { parentMap, childrenMap };
  }, [initialNodes, initialEdges]);

  // Search results map
  const searchResultsMap = useMemo(() => {
    const map = new Map<string, boolean>();
    searchResults.forEach((result) => {
      map.set(result.node.id, result.matches);
    });
    return map;
  }, [searchResults]);

  // Initialize collapsed state - all nodes with children collapsed by default
  useEffect(() => {
    const allNodeIds = new Set<string>();
    initialNodes.forEach((node) => {
      if (childrenMap.get(node.id)?.length) {
        allNodeIds.add(node.id);
      }
    });
    setCollapsedNodes(allNodeIds);
  }, [initialNodes, childrenMap]);

  // Zoom functions
  const onZoomIn = useCallback(() => {
    diagramInstanceRef.current?.commandHandler.increaseZoom();
  }, []);

  const onZoomOut = useCallback(() => {
    diagramInstanceRef.current?.commandHandler.decreaseZoom();
  }, []);

  const onZoomFit = useCallback(() => {
    diagramInstanceRef.current?.commandHandler.zoomToFit();
  }, []);

  // Expand/Collapse all
  const onExpandAll = useCallback(() => {
    setCollapsedNodes(new Set());
  }, []);

  const onCollapseAll = useCallback(() => {
    const allNodeIds = new Set<string>();
    initialNodes.forEach((node) => {
      if (childrenMap.get(node.id)?.length) {
        allNodeIds.add(node.id);
      }
    });
    setCollapsedNodes(allNodeIds);
  }, [initialNodes, childrenMap]);

  // Toggle node collapse
  const toggleNodeCollapse = useCallback((nodeId: string) => {
    setCollapsedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  // Initialize diagram - EXACT implementation from incrementalTree
  useEffect(() => {
    const container = diagramRef.current;
    if (!container) return;

    const $ = go.GraphObject.make;

    // Custom ForceDirectedLayout with radial positioning
    class RadialForceDirectedLayout extends go.ForceDirectedLayout {
      doLayout(coll: go.Diagram | go.Group | go.Iterable<go.Part>): void {
        super.doLayout(coll);
        
        // After force layout, apply radial adjustment based on levels
        const diagram = this.diagram;
        if (!diagram) return;
        
        const nodesByLevel = new Map<number, go.Node[]>();
        
        // Group nodes by level
        diagram.nodes.each((node) => {
          if (!node.visible) return;
          const level = node.data?.level ?? 0;
          if (!nodesByLevel.has(level)) {
            nodesByLevel.set(level, []);
          }
          nodesByLevel.get(level)!.push(node);
        });
        
        // Calculate radius for each level
        const levelRadii = new Map<number, number>();
        let currentRadius = 0;
        const radiusStep = 180; // Distance between levels
        
        const sortedLevels = Array.from(nodesByLevel.keys()).sort((a, b) => a - b);
        sortedLevels.forEach((level) => {
          if (level === 0) {
            levelRadii.set(level, 0);
          } else {
            currentRadius += radiusStep;
            levelRadii.set(level, currentRadius);
          }
        });
        
        // Position nodes in circular rings by level
        sortedLevels.forEach((level) => {
          const nodes = nodesByLevel.get(level)!;
          const radius = levelRadii.get(level)!;
          const count = nodes.length;
          
          if (level === 0) {
            // Center root node
            nodes[0].move(new go.Point(0, 0));
          } else {
            // Distribute nodes in a circle
            const angleStep = (2 * Math.PI) / count;
            nodes.forEach((node, index) => {
              const angle = index * angleStep;
              const x = radius * Math.cos(angle);
              const y = radius * Math.sin(angle);
              // Blend between force position and radial position
              const forceX = node.location.x;
              const forceY = node.location.y;
              const blendFactor = 0.4; // 40% radial, 60% force
              const finalX = forceX * (1 - blendFactor) + x * blendFactor;
              const finalY = forceY * (1 - blendFactor) + y * blendFactor;
              node.move(new go.Point(finalX, finalY));
            });
          }
        });
      }
    }

    // Create diagram with custom radial force layout
    const myDiagram = $(go.Diagram, container, {
      initialContentAlignment: go.Spot.Center,
      layout: $(RadialForceDirectedLayout, {
        defaultSpringLength: 120,
        defaultElectricalCharge: 800,
        defaultGravitationalMass: 0,
        infinityDistance: 300,
        maxIterations: 800,
        epsilonDistance: 0.1,
      }),
      "commandHandler.copiesTree": true,
      "commandHandler.deletesTree": true,
      "draggingTool.dragsTree": true,
      "undoManager.isEnabled": true,
      initialAutoScale: go.AutoScale.Uniform,
      padding: 80,
    });

    // Helper function to get connected nodes and links for highlighting
    const getConnectedParts = (node: go.Node): { nodes: Set<go.Node>; links: Set<go.Link> } => {
      const nodes = new Set<go.Node>();
      const links = new Set<go.Link>();

      if (!node) return { nodes, links };

      const nodeData = node.data;
      const nodeLevel = nodeData?.level ?? 0;

      // Always include the hovered node
      nodes.add(node);

      if (nodeLevel === 0) {
        // Root node: highlight root + direct children + their edges
        node.findNodesOutOf().each((child) => {
          nodes.add(child);
          const link = node.findLinksBetween(child).first();
          if (link) links.add(link);
        });
      } else {
        // Non-root node: highlight path from root to this node + descendants

        // Find path to root
        let current: go.Node | null = node;
        while (current) {
          nodes.add(current);
          // Find parent
          const parentLink = current.findLinksInto().first();
          if (parentLink) {
            links.add(parentLink);
            current = parentLink.fromNode;
          } else {
            current = null;
          }
        }

        // Find all descendants
        const collectDescendants = (n: go.Node) => {
          n.findNodesOutOf().each((child) => {
            nodes.add(child);
            const link = n.findLinksBetween(child).first();
            if (link) links.add(link);
            collectDescendants(child);
          });
        };

        collectDescendants(node);
      }

      return { nodes, links };
    };

    // Helper function to apply highlighting
    const applyHighlight = (node: go.Node) => {
      const { nodes, links } = getConnectedParts(node);
      
      // Apply highlighting
      myDiagram.nodes.each((n) => {
        const shape = n.findObject("SHAPE") as go.Shape;
        const textBlock = n.findObject("TEXTBLOCK") as go.TextBlock;
        
        if (nodes.has(n)) {
          // Highlighted node
          n.opacity = 1;
          if (shape) {
            shape.stroke = "#8B5CF6"; // Purple border
            // Keep strokeWidth at 2 to avoid layout shift
          }
          if (textBlock) {
            textBlock.stroke = "#8B5CF6"; // Purple text
            // Keep original font, only change color
          }
        } else {
          // Dimmed node
          n.opacity = 0.15;
        }
      });
      
      myDiagram.links.each((l) => {
        const shape = l.findObject("LINKSHAPE") as go.Shape;
        const arrow = l.findObject("ARROW") as go.Shape;
        
        if (links.has(l)) {
          // Highlighted link
          l.opacity = 1;
          if (shape) {
            shape.stroke = "#8B5CF6";
            // Keep strokeWidth at 1.5 to avoid layout shift
          }
          if (arrow) {
            arrow.stroke = "#8B5CF6";
            arrow.fill = "#8B5CF6";
          }
        } else {
          // Dimmed link
          l.opacity = 0.05;
        }
      });
    };

    // Helper function to reset highlighting
    const resetHighlight = () => {
      // Reset all nodes and links
      myDiagram.nodes.each((n) => {
        n.opacity = 1;
        const shape = n.findObject("SHAPE") as go.Shape;
        const textBlock = n.findObject("TEXTBLOCK") as go.TextBlock;
        
        if (shape) {
          shape.stroke = n.data?.borderColor || "#3b82f6";
          // strokeWidth stays at 2, no need to reset
        }
        if (textBlock) {
          textBlock.stroke = "#1F2937";
          // Keep original font, only reset color
        }
      });
      
      myDiagram.links.each((l) => {
        l.opacity = 1;
        const shape = l.findObject("LINKSHAPE") as go.Shape;
        const arrow = l.findObject("ARROW") as go.Shape;
        
        if (shape) {
          shape.stroke = "rgba(100, 100, 100, 0.4)";
          // strokeWidth stays at 1.5, no need to reset
        }
        if (arrow) {
          arrow.stroke = "rgba(100, 100, 100, 0.4)";
          arrow.fill = "rgba(100, 100, 100, 0.4)";
        }
      });
    };

    // Define the Node template - EXACT from incrementalTree but with label below
    myDiagram.nodeTemplate = $(go.Node, "Vertical", {
      selectionObjectName: "PANEL",
    })
      .bind("visible", "visible")
      // Top part: Circle with expand button (Spot panel)
      .add(
        $(go.Panel, "Spot", { name: "PANEL" })
          .add(
            // Main circle
            $(go.Shape, "Circle", {
              name: "SHAPE",
              fill: "whitesmoke",
              stroke: "black",
              strokeWidth: 2,
              mouseEnter: (_e: go.InputEvent, shape: go.GraphObject) => {
                const node = shape.part as go.Node;
                if (node) {
                  setHoveredNodeData(node.data);
                  const loc = node.location;
                  const point = myDiagram.transformDocToView(loc);
                  setTooltipPosition({ x: point.x, y: point.y - 40 });
                  applyHighlight(node);
                }
              },
              mouseLeave: () => {
                setHoveredNodeData(null);
                resetHighlight();
              },
            })
              .bind("fill", "color")
              .bind("stroke", "borderColor")
              .bind("width", "level", (level) => (level === 0 ? 44 : level === 1 ? 36 : 30))
              .bind("height", "level", (level) => (level === 0 ? 44 : level === 1 ? 36 : 30)),
          )
          // Custom expand/collapse button
          .add(
            $("Button", {
              name: "EXPANDBUTTON",
              width: 20,
              height: 20,
              alignment: go.Spot.TopRight,
              alignmentFocus: go.Spot.Center,
              click: (e: go.InputEvent, obj: go.GraphObject) => {
                const node = obj.part as go.Node;
                if (node === null) return;
                e.handled = true;

                const nodeId = node.data.key;
                const childIds = childrenMap.get(nodeId);

                if (childIds && childIds.length > 0) {
                  toggleNodeCollapse(nodeId);
                }
              },
            })
              .bind("visible", "hasChildren")
              // Button appearance
              .add(
                $(go.Shape, "Rectangle", {
                  fill: "white",
                  stroke: "#666",
                  strokeWidth: 1,
                  width: 16,
                  height: 16,
                }),
              )
              // Horizontal line (always visible)
              .add(
                $(go.Shape, "LineH", {
                  stroke: "#333",
                  strokeWidth: 2,
                  width: 8,
                  height: 2,
                }),
              )
              // Vertical line (only when collapsed - shows as +)
              .add(
                $(go.Shape, "LineV", {
                  stroke: "#333",
                  strokeWidth: 2,
                  width: 2,
                  height: 8,
                }).bind("visible", "isCollapsed"),
              ),
          ),
      )
      // Bottom part: Label (below the circle)
      .add(
        $(go.TextBlock, {
          name: "TEXTBLOCK",
          font: "12px system-ui, sans-serif",
          margin: new go.Margin(8, 0, 0, 0),
          stroke: "#1F2937",
          textAlign: "center",
          maxSize: new go.Size(120, NaN),
          wrap: go.TextBlock.WrapFit,
        })
          .bind("text", "label")
          .bind("font", "level", (level) =>
            level === 0 ? "bold 13px system-ui, sans-serif" : "12px system-ui, sans-serif",
          ),
      );

    // Add selection adornment (green ring)
    myDiagram.nodeTemplate.selectionAdornmentTemplate = $(
      go.Adornment,
      "Spot",
      $(go.Placeholder, { margin: 8 }),
      $(go.Shape, "Circle", {
        fill: null,
        stroke: "#22C55E",
        strokeWidth: 3,
      }),
    );

    // Define the Link template
    myDiagram.linkTemplate = $(go.Link, {
      routing: go.Link.Normal,
      curve: go.Link.Bezier,
      toShortLength: 4,
    })
      .add(
        $(go.Shape, {
          name: "LINKSHAPE",
          stroke: "rgba(100, 100, 100, 0.4)",
          strokeWidth: 1.5,
        }),
      )
      .add(
        $(go.Shape, {
          name: "ARROW",
          toArrow: "Standard",
          stroke: "rgba(100, 100, 100, 0.4)",
          fill: "rgba(100, 100, 100, 0.4)",
          scale: 0.8,
        }),
      );

    diagramInstanceRef.current = myDiagram;

    return () => {
      if (diagramInstanceRef.current) {
        diagramInstanceRef.current.div = null;
        diagramInstanceRef.current = null;
      }
    };
  }, [childrenMap, toggleNodeCollapse]);

  // Update diagram data when dependencies change
  useEffect(() => {
    const diagram = diagramInstanceRef.current;
    if (!diagram) return;

    const nodeDataArray: go.ObjectData[] = [];
    const linkDataArray: go.ObjectData[] = [];

    // Helper to check if node should be visible
    const isNodeVisible = (nodeId: string): boolean => {
      const parentId = parentMap.get(nodeId);
      if (!parentId) return true; // Root is always visible
      return !collapsedNodes.has(parentId); // Visible if parent is NOT collapsed
    };

    // Build all nodes with visibility flag
    initialNodes.forEach((node) => {
      const isMatch = searchResultsMap.get(node.id) ?? false;
      const style = (node.style as Record<string, string>) || {};
      const level = node.data.metadata.level;
      const childIds = childrenMap.get(node.id) || [];
      const hasChildren = childIds.length > 0;
      const isCollapsed = collapsedNodes.has(node.id);
      const visible = isNodeVisible(node.id);

      nodeDataArray.push({
        key: node.id,
        label: node.data.label,
        color: isMatch ? "#fef3c7" : style.background || "#dbeafe",
        borderColor: isMatch ? "#f59e0b" : style.border?.split(" ")[2] || "#3b82f6",
        level: level,
        isMatch: isMatch,
        type: node.data.metadata.type,
        hasChildren: hasChildren,
        isCollapsed: isCollapsed,
        parentId: parentMap.get(node.id),
        childIds: childIds,
        visible: visible,
      });
    });

    // Build all links - visibility handled by node binding
    initialEdges.forEach((edge) => {
      linkDataArray.push({
        from: edge.source,
        to: edge.target,
      });
    });

    diagram.model = new go.GraphLinksModel(nodeDataArray, linkDataArray);
  }, [initialNodes, initialEdges, collapsedNodes, parentMap, childrenMap, searchResultsMap]);

  // Handle tooltip expand/collapse
  const handleTooltipCollapse = useCallback(() => {
    const diagram = diagramInstanceRef.current;
    if (hoveredNodeData && diagram) {
      const nodeId = hoveredNodeData.key;
      toggleNodeCollapse(nodeId);
    }
  }, [hoveredNodeData, toggleNodeCollapse]);

  // Center view on node
  const centerViewOnNode = useCallback((nodeId: string) => {
    const diagram = diagramInstanceRef.current;
    if (diagram) {
      const node = diagram.findNodeForKey(nodeId);
      if (node) {
        diagram.commandHandler.scrollToPart(node);
      }
    }
  }, []);

  return (
    <div className={styles.gojsView}>
      <div ref={diagramRef} className={styles.diagram} />

      {/* Tooltip */}
      {hoveredNodeData && (
        <div
          className={styles.tooltip}
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
          }}
        >
          <div className={styles.tooltipArrow} />
          <div className={styles.tooltipHeader}>
            <span
              className={`${styles.levelBadge} ${
                hoveredNodeData.level === 0
                  ? styles["levelBadge--root"]
                  : styles["levelBadge--child"]
              }`}
            >
              {hoveredNodeData.level}
            </span>
            <span className={styles.tooltipLabel}>{hoveredNodeData.label}</span>
          </div>
          <div className={styles.tooltipInfo}>
            <div>
              <strong>Type:</strong> {hoveredNodeData.type}
            </div>
            <div>
              <strong>ID:</strong> {hoveredNodeData.key}
            </div>
            {hoveredNodeData.parentId && (
              <div className={styles.tooltipInfoSecondary}>Parent: {hoveredNodeData.parentId}</div>
            )}
            {hoveredNodeData.hasChildren && (
              <div className={styles.tooltipInfoSuccess}>
                {hoveredNodeData.childIds?.length} children
                {hoveredNodeData.isCollapsed && " (collapsed)"}
              </div>
            )}
            {hoveredNodeData.level === 0 && (
              <div className={styles.tooltipInfoWarning}>Core Node</div>
            )}
          </div>
          <div className={styles.tooltipActions}>
            <button
              onClick={() => centerViewOnNode(hoveredNodeData.key)}
              className={`${styles.tooltipButton} ${styles["tooltipButton--primary"]}`}
            >
              Center View
            </button>
            {hoveredNodeData.hasChildren && (
              <button
                onClick={handleTooltipCollapse}
                className={`${styles.tooltipButton} ${
                  hoveredNodeData.isCollapsed
                    ? styles["tooltipButton--success"]
                    : styles["tooltipButton--danger"]
                }`}
              >
                {hoveredNodeData.isCollapsed ? "Expand" : "Collapse"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toolbar */}
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
    </div>
  );
};
