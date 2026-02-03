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

  // Initialize diagram
  useEffect(() => {
    const container = diagramRef.current;
    if (!container) return;

    const $ = go.GraphObject.make;

    // Create diagram with ForceDirectedLayout
    const myDiagram = $(go.Diagram, container, {
      initialContentAlignment: go.Spot.Center,
      layout: $(go.ForceDirectedLayout, {
        defaultSpringLength: 100,
        defaultElectricalCharge: 150,
        infinityDistance: 50,
      }),
      "commandHandler.copiesTree": true,
      "commandHandler.deletesTree": true,
      "draggingTool.dragsTree": true,
      "undoManager.isEnabled": true,
    });

    // Define the Node template - Botón personalizado en lugar de TreeExpanderButton
    // Define the Node template - Label DEBAJO del nodo (como en D3Simple)
    myDiagram.nodeTemplate = $(go.Node, "Vertical", {
      selectionObjectName: "PANEL",
      isTreeExpanded: false,
      isTreeLeaf: false,
      mouseEnter: (_e: go.InputEvent, node: go.GraphObject) => {
        if (node instanceof go.Node) {
          setHoveredNodeData(node.data);
          const loc = node.location;
          const point = myDiagram.transformDocToView(loc);
          setTooltipPosition({ x: point.x, y: point.y - 40 });
        }
      },
      mouseLeave: () => {
        setHoveredNodeData(null);
      },
    })
      // Top part: Circle with expand button
      .add(
        $(go.Panel, "Spot", { name: "PANEL" }).add(
          // Main circle
          $(go.Shape, "Circle", {
            fill: "whitesmoke",
            stroke: "black",
            strokeWidth: 2,
          })
            .bind("fill", "color")
            .bind("stroke", "borderColor")
            .bind("width", "level", (level) => (level === 0 ? 44 : level === 1 ? 36 : 30))
            .bind("height", "level", (level) => (level === 0 ? 44 : level === 1 ? 36 : 30)),
          // Expand/collapse button at top-right
          $(go.Panel, "Spot", {
            name: "EXPANDBUTTON",
            width: 20,
            height: 20,
            alignment: go.Spot.TopRight,
            alignmentFocus: go.Spot.Center,
            cursor: "pointer",
            visible: false,
            click: (e: go.InputEvent, panel: go.GraphObject) => {
              const node = panel.part as go.Node;
              if (!node) return;
              e.handled = true;

              const nodeId = node.data.key;
              const childIds = childrenMap.get(nodeId);

              if (childIds && childIds.length > 0) {
                toggleNodeCollapse(nodeId);

                if (node.isTreeExpanded) {
                  myDiagram.commandHandler.collapseTree(node);
                } else {
                  myDiagram.commandHandler.expandTree(node);
                }
              }
            },
          })
            .add(
              $(go.Shape, "Circle", {
                fill: "white",
                stroke: "#64748b",
                strokeWidth: 1.5,
                width: 20,
                height: 20,
              }),
            )
            .add(
              $(go.Shape, {
                geometryString: "M -5 0 L 5 0",
                stroke: "#64748b",
                strokeWidth: 1.5,
              }),
            )
            .add(
              $(
                go.Shape,
                {
                  geometryString: "M 0 -5 L 0 5",
                  stroke: "#64748b",
                  strokeWidth: 1.5,
                  visible: false,
                },
                new go.Binding("visible", "isCollapsed"),
              ),
            ),
        ),
      )
      // Bottom part: Label
      .add(
        $(go.TextBlock, {
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
          stroke: "rgba(100, 100, 100, 0.4)",
          strokeWidth: 1.5,
        }),
      )
      .add(
        $(go.Shape, {
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
      if (!parentId) return true;
      return !collapsedNodes.has(parentId);
    };

    // Build visible nodes
    initialNodes.forEach((node) => {
      if (!isNodeVisible(node.id)) return;

      const isMatch = searchResultsMap.get(node.id) ?? false;
      const style = (node.style as Record<string, string>) || {};
      const level = node.data.metadata.level;
      const childIds = childrenMap.get(node.id) || [];
      const hasChildren = childIds.length > 0;
      const isCollapsed = collapsedNodes.has(node.id);

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
      });
    });

    // Build links for visible nodes
    initialEdges.forEach((edge) => {
      if (isNodeVisible(edge.source) && isNodeVisible(edge.target)) {
        linkDataArray.push({
          from: edge.source,
          to: edge.target,
        });
      }
    });

    diagram.model = new go.GraphLinksModel(nodeDataArray, linkDataArray);
  }, [initialNodes, initialEdges, collapsedNodes, parentMap, childrenMap, searchResultsMap]);

  // Handle tooltip expand/collapse
  const handleTooltipCollapse = useCallback(() => {
    const diagram = diagramInstanceRef.current;
    if (hoveredNodeData && diagram) {
      const nodeId = hoveredNodeData.key;
      const node = diagram.findNodeForKey(nodeId);
      if (node) {
        toggleNodeCollapse(nodeId);
        if (node.isTreeExpanded) {
          diagram.commandHandler.collapseTree(node);
        } else {
          diagram.commandHandler.expandTree(node);
        }
      }
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
