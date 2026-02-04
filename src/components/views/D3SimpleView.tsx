import { useState, useCallback, useMemo, type ReactNode } from "react";
import type { Edge } from "@xyflow/react";
import type { CustomNode } from "../../types";
import { D3Force, type D3Node, type D3Link } from "../D3Force";
import { Toolbar } from "../controls/Toolbar";
import { Overview } from "../controls/Overview";
import styles from "./D3SimpleView.module.css";

// Re-exportar tipos para compatibilidad
export type { D3Node, D3Link };

export type LayoutMode = "concentric" | "progressive" | "hierarchical" | "radial-tree" | "cluster";
export type CollisionMode = "full" | "minimal" | "none";

// Flags de funcionalidad
const ALLOW_ADD_DELETE = true;

interface D3SimpleViewProps {
  nodes: CustomNode[];
  edges: Edge[];
  searchResults: Array<{ node: CustomNode; matches: boolean }>;
  layoutMode?: LayoutMode;
  collisionMode?: CollisionMode;
  showLevelLabels?: boolean;
  showChildCount?: boolean;
  showTooltipOnHover?: boolean;
}

export const D3SimpleView = ({
  nodes: initialNodes,
  edges: initialEdges,
  searchResults,
  layoutMode = "concentric",
  collisionMode = "full",
  showLevelLabels = false,
  showChildCount: showChildCountProp = false,
  showTooltipOnHover = false,
}: D3SimpleViewProps) => {
  // Estado interno
  const [nodesState, setNodesState] = useState<CustomNode[]>(initialNodes);
  const [edgesState, setEdgesState] = useState<Edge[]>(initialEdges);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isOverviewOpen, setIsOverviewOpen] = useState(true);
  const [allowNodeDrag, setAllowNodeDrag] = useState(true);
  const [viewportTransform, setViewportTransform] = useState({ x: 0, y: 0, k: 1 });

  // Store actual node positions from simulation
  const [nodePositions, setNodePositions] = useState<
    Map<string, { x: number; y: number; level?: number }>
  >(new Map());

  // Estado de selección y colapso
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => {
    const allNodeIds = new Set<string>();
    initialNodes.forEach((node) => {
      allNodeIds.add(node.id);
    });
    return allNodeIds;
  });

  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());

  // Memoizar search results como Map
  const searchResultsMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const result of searchResults) {
      map.set(result.node.id, result.matches);
    }
    return map;
  }, [searchResults]);

  // Transformar CustomNode a D3Node
  const d3Nodes: D3Node[] = useMemo(() => {
    return nodesState.map((node) => {
      const style = node.style as Record<string, string> | undefined;
      const isMatch = searchResultsMap.get(node.id) ?? false;

      return {
        id: node.id,
        label: node.data.label,
        color: style?.background || "#E3F2FD",
        borderColor: isMatch ? "#FFC107" : style?.border?.split(" ")[2] || "#1976D2",
        type: node.data.metadata.type,
        level: node.data.metadata.level,
        isMatch,
      };
    });
  }, [nodesState, searchResultsMap]);

  // Transformar Edge a D3Link
  const d3Links: D3Link[] = useMemo(() => {
    return edgesState.map((edge) => ({
      source: edge.source,
      target: edge.target,
    }));
  }, [edgesState]);

  // Actualizar estado cuando cambian las props
  const nodes = initialNodes;
  const edges = initialEdges;

  // Callbacks
  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId);
  }, []);

  const handleNodeToggle = useCallback((nodeId: string) => {
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

  const handleSelectionChange = useCallback((selectedIds: Set<string>) => {
    setSelectedNodes(selectedIds);
  }, []);

  const handleViewportChange = useCallback((transform: { x: number; y: number; k: number }) => {
    setViewportTransform(transform);
  }, []);

  const handleNodesPositionUpdate = useCallback(
    (positions: Array<{ id: string; x: number; y: number; level?: number }>) => {
      const positionsMap = new Map<string, { x: number; y: number; level?: number }>();
      for (const pos of positions) {
        positionsMap.set(pos.id, pos);
      }
      setNodePositions(positionsMap);
    },
    [],
  );

  // Acciones de toolbar
  const handleAddNode = useCallback(() => {
    if (!ALLOW_ADD_DELETE || selectedNodes.size === 0) return;

    const parentId = Array.from(selectedNodes)[0];
    const parentNode = nodes.find((n) => n.id === parentId);
    if (!parentNode) return;

    const newNodeId = `node-${Date.now()}`;
    const newNodeLevel = parentNode.data.metadata.level + 1;

    const newNode: CustomNode = {
      id: newNodeId,
      type: "custom",
      position: { x: 0, y: 0 },
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
  }, [selectedNodes, nodes]);

  const handleDeleteNode = useCallback(() => {
    if (!ALLOW_ADD_DELETE || selectedNodes.size === 0) return;

    const nodeIdToDelete = Array.from(selectedNodes)[0];

    // Eliminar nodo y sus descendientes
    const nodesToDelete = new Set<string>();
    const addDescendants = (id: string) => {
      nodesToDelete.add(id);
      const node = nodes.find((n) => n.id === id);
      if (node) {
        const children = edges.filter((e) => e.source === id).map((e) => e.target);
        children.forEach(addDescendants);
      }
    };
    addDescendants(nodeIdToDelete);

    setNodesState((prev) => prev.filter((node) => !nodesToDelete.has(node.id)));
    setEdgesState((prev) =>
      prev.filter((edge) => !nodesToDelete.has(edge.source) && !nodesToDelete.has(edge.target)),
    );
    setSelectedNodes(new Set());
  }, [selectedNodes, nodes, edges]);

  const onZoomFit = useCallback(() => {
    // TODO: Implement zoom fit via props or different mechanism
    console.log("Zoom fit not yet implemented");
  }, []);

  const onZoomIn = useCallback(() => {
    // TODO: Implement zoom in via props or different mechanism
    console.log("Zoom in not yet implemented");
  }, []);

  const onZoomOut = useCallback(() => {
    // TODO: Implement zoom out via props or different mechanism
    console.log("Zoom out not yet implemented");
  }, []);

  const onExpandAll = useCallback(() => {
    setCollapsedNodes(new Set());
  }, []);

  const onCollapseAll = useCallback(() => {
    const allNodeIds = new Set<string>();
    nodes.forEach((node) => {
      allNodeIds.add(node.id);
    });
    setCollapsedNodes(allNodeIds);
  }, [nodes]);

  // Obtener el nodo hovered actual con posiciones actualizadas
  const hoveredNode = useMemo(() => {
    if (!hoveredNodeId) return null;
    const node = d3Nodes.find((n) => n.id === hoveredNodeId);
    const position = nodePositions.get(hoveredNodeId);
    if (!node) return null;
    return {
      ...node,
      x: position?.x ?? node.x ?? 0,
      y: position?.y ?? node.y ?? 0,
    };
  }, [hoveredNodeId, d3Nodes, nodePositions]);

  // Obtener el nodo seleccionado actual con posiciones actualizadas
  const selectedNodeId = selectedNodes.size === 1 ? Array.from(selectedNodes)[0] : null;
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = d3Nodes.find((n) => n.id === selectedNodeId);
    const position = nodePositions.get(selectedNodeId);
    if (!node) return null;
    return {
      ...node,
      x: position?.x ?? node.x ?? 0,
      y: position?.y ?? node.y ?? 0,
    };
  }, [selectedNodeId, d3Nodes, nodePositions]);

  // Renderizar tooltip
  const renderTooltip = useCallback(
    (node: D3Node): ReactNode => {
      // Calculate childIds from edges
      const childIds = edgesState.filter((e) => e.source === node.id).map((e) => e.target);

      // Find parentId from edges
      const parentId = edgesState.find((e) => e.target === node.id)?.source;

      return (
        <>
          <div className={styles.tooltipArrow} />
          <div className={styles.tooltipHeader}>
            <span
              className={`${styles.levelBadge} ${
                node.level === 0 ? styles["levelBadge--root"] : styles["levelBadge--child"]
              }`}
            >
              {node.level}
            </span>
            <span className={styles.tooltipLabel}>{node.label}</span>
          </div>
          <div className={styles.tooltipInfo}>
            <div>
              <strong>Type:</strong> {node.type}
            </div>
            <div>
              <strong>ID:</strong> {node.id}
            </div>
            {parentId && <div className={styles.tooltipInfoSecondary}>Parent: {parentId}</div>}
            {childIds.length > 0 && (
              <div className={styles.tooltipInfoSuccess}>
                {childIds.length} child
                {childIds.length > 1 ? "ren" : ""}
                {collapsedNodes.has(node.id) && " (collapsed)"}
              </div>
            )}
            {node.level === 0 && <div className={styles.tooltipInfoWarning}>Core Node</div>}
          </div>
          <div className={styles.tooltipActions}>
            <button className={`${styles.tooltipButton} ${styles["tooltipButton--primary"]}`}>
              Center View
            </button>
            {childIds.length > 0 && (
              <button
                onClick={() => handleNodeToggle(node.id)}
                className={`${styles.tooltipButton} ${
                  collapsedNodes.has(node.id)
                    ? styles["tooltipButton--success"]
                    : styles["tooltipButton--danger"]
                }`}
              >
                {collapsedNodes.has(node.id) ? "Expand" : "Collapse"}
              </button>
            )}
          </div>
        </>
      );
    },
    [collapsedNodes, handleNodeToggle, edgesState],
  );

  return (
    <D3Force
      nodes={d3Nodes}
      links={d3Links}
      layoutMode={layoutMode}
      collisionMode={collisionMode}
      showLevelLabels={showLevelLabels}
      showChildCount={showChildCountProp}
      collapsedNodes={collapsedNodes}
      selectedNodes={selectedNodes}
      onNodeHover={handleNodeHover}
      onNodeToggle={handleNodeToggle}
      onSelectionChange={handleSelectionChange}
      onViewportChange={handleViewportChange}
      onNodesPositionUpdate={handleNodesPositionUpdate}
    >
      {/* Tooltip - ahora correctamente posicionado */}
      {showTooltipOnHover && hoveredNode && (
        <div
          className={styles.tooltip}
          style={{
            left: (hoveredNode.x || 0) * viewportTransform.k + viewportTransform.x,
            top:
              (hoveredNode.y || 0) * viewportTransform.k +
              viewportTransform.y -
              (hoveredNode.level === 0 ? 22 : hoveredNode.level === 1 ? 16 : 11) -
              8,
          }}
          onMouseEnter={() => {
            // Cancelar timeout de cierre
          }}
          onMouseLeave={() => {
            setHoveredNodeId(null);
          }}
        >
          {renderTooltip(hoveredNode)}
        </div>
      )}

      {/* Toolbar de acciones de nodo - muestra en el nodo SELECCIONADO, no en el hovered */}
      {ALLOW_ADD_DELETE && selectedNode && (
        <div
          className={styles.nodeActionToolbar}
          style={{
            left:
              (selectedNode.x || 0) * viewportTransform.k +
              viewportTransform.x +
              (selectedNode.level === 0 ? 22 : selectedNode.level === 1 ? 16 : 11) +
              16,
            top: (selectedNode.y || 0) * viewportTransform.k + viewportTransform.y,
            transform: "translateY(-50%)",
          }}
        >
          <button onClick={handleAddNode} className={styles.nodeActionButton} title="Add Child">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </button>

          <button className={styles.nodeActionButton} title="Edit" disabled>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>

          {selectedNode.level !== undefined && selectedNode.level > 0 && (
            <button
              onClick={handleDeleteNode}
              className={`${styles.nodeActionButton} ${styles["nodeActionButton--danger"]}`}
              title="Delete"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Toolbar principal */}
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
        nodes={d3Nodes.map((n) => ({
          id: n.id,
          x: n.x || 0,
          y: n.y || 0,
          level: n.level || 0,
        }))}
        viewportTransform={viewportTransform}
        canvasWidth={800}
        canvasHeight={600}
        onViewportChange={(transform) => {
          setViewportTransform(transform);
        }}
      />
    </D3Force>
  );
};
