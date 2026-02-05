/* eslint-disable react-hooks/refs */
import { useEffect, useRef, useMemo } from "react";
import type { ReactNode } from "react";
import {
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceLink,
  forceCollide,
  forceX,
  forceY,
} from "d3-force";
import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";
import { GraphContext } from "../context/GraphContext";
import { GraphEngineContext, useGetNodeRadius } from "../context/GraphEngineContext";
import { useGraphStore } from "../store/graphStore";
import { GraphCanvas } from "./GraphCanvas";
import type {
  D3Node,
  D3Link,
  ForceNode,
  ForceLink,
  LayoutMode,
  CollisionMode,
  SimulationSettings,
} from "../types";
import styles from "./GraphRoot.module.css";

const defaultSettings: Required<SimulationSettings> = {
  chargeStrength: -800,
  chargeDistanceMax: 1000,
  linkDistance: 150,
  linkStrength: 0.5,
  collideRadius: 45,
  positionStrength: 0.02,
  centerStrength: 0.02,
};

const layoutPresets: Record<LayoutMode, Partial<SimulationSettings>> = {
  concentric: {},
  progressive: {
    chargeStrength: -1200,
    chargeDistanceMax: 1500,
    linkDistance: 200,
    linkStrength: 0.3,
    collideRadius: 55,
    positionStrength: 0.015,
    centerStrength: 0.01,
  },
  hierarchical: {
    chargeStrength: -500,
    chargeDistanceMax: 800,
    linkDistance: 180,
    linkStrength: 0.7,
    collideRadius: 40,
    positionStrength: 0.04,
    centerStrength: 0.03,
  },
  "radial-tree": {},
  cluster: {},
};

interface GraphRootProps {
  nodes: D3Node[];
  links: D3Link[];
  layoutMode?: LayoutMode;
  collisionMode?: CollisionMode;
  showLevelLabels?: boolean;
  showChildCount?: boolean;
  simulationSettings?: SimulationSettings;
  defaultCollapsed?: boolean;
  allowNodeDrag?: boolean;
  highlightSelectedDescendants?: boolean;
  highlightHoverPaths?: boolean;
  children: ReactNode;
}

export function GraphRoot({
  nodes: initialNodes,
  links: initialLinks,
  layoutMode = "concentric",
  collisionMode = "full",
  showLevelLabels = false,
  showChildCount = false,
  simulationSettings = {},
  defaultCollapsed = true,
  allowNodeDrag = true,
  highlightSelectedDescendants = true,
  highlightHoverPaths = true,
  children,
}: GraphRootProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation> | null>(null);
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const prevNodesStateRef = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(
    new Map(),
  );
  const prevNodeIdsRef = useRef<Set<string>>(new Set());
  const prevLinkIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedCollapse = useRef(false);

  const setDimensions = useGraphStore((state) => state.setDimensions);
  const collapsedNodeIds = useGraphStore((state) => state.collapsedNodeIds);
  const collapseAll = useGraphStore((state) => state.collapseAll);

  useEffect(() => {
    // Only collapse on initial mount, not when nodes change
    if (hasInitializedCollapse.current) return;
    
    const nodeIdsToCollapse = initialNodes
      .filter((node) => {
        if (defaultCollapsed) {
          return node.level !== undefined;
        }
        return node.level !== undefined && node.level > 0;
      })
      .map((node) => node.id);

    collapseAll(nodeIdsToCollapse);
    hasInitializedCollapse.current = true;
  }, []); // Empty deps - only run on mount

  const settings = useMemo(() => {
    const preset = layoutPresets[layoutMode];
    return {
      ...defaultSettings,
      ...preset,
      ...simulationSettings,
    };
  }, [layoutMode, simulationSettings]);

  const { forceNodes, forceLinks, nodesById, visibleNodeIds } = useMemo(() => {
    const nodeMap = new Map<string, D3Node>();
    const parentMap = new Map<string, string>();
    const childrenMap = new Map<string, string[]>();

    initialNodes.forEach((node) => {
      nodeMap.set(node.id, node);
      childrenMap.set(node.id, []);
    });

    initialLinks.forEach((link) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;

      if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
        childrenMap.get(sourceId)?.push(targetId);
        parentMap.set(targetId, sourceId);
      }
    });

    const isNodeVisible = (nodeId: string): boolean => {
      let currentId: string | undefined = nodeId;
      while (currentId) {
        const parentId = parentMap.get(currentId);
        if (!parentId) return true;
        if (collapsedNodeIds.has(parentId)) return false;
        currentId = parentId;
      }
      return true;
    };

    const visibleNodeIdsSet = new Set<string>();
    initialNodes.forEach((node) => {
      if (isNodeVisible(node.id)) {
        visibleNodeIdsSet.add(node.id);
      }
    });

    const containerWidth = containerRef.current?.getBoundingClientRect().width ?? 800;
    const containerHeight = containerRef.current?.getBoundingClientRect().height ?? 600;
    const centerX = containerWidth / 2 || 400;
    const centerY = containerHeight / 2 || 300;

    const nodesByLevel = new Map<number, D3Node[]>();
    initialNodes.forEach((node) => {
      if (!visibleNodeIdsSet.has(node.id)) return;
      const level = node.level ?? 0;
      if (!nodesByLevel.has(level)) nodesByLevel.set(level, []);
      nodesByLevel.get(level)!.push(node);
    });

    const forceNodesList: ForceNode[] = [];
    const nodesByIdMap = new Map<string, ForceNode>();

    const getInitialPosition = (
      level: number,
      index: number,
      levelNodes: D3Node[],
    ): { x: number; y: number } => {
      switch (layoutMode) {
        case "radial-tree": {
          if (level === 0) return { x: centerX, y: centerY };
          const anglePerNode = (2 * Math.PI) / levelNodes.length;
          const startAngle = anglePerNode * index;
          const radius = 120 + (level - 1) * 100;
          return {
            x: centerX + Math.cos(startAngle) * radius,
            y: centerY + Math.sin(startAngle) * radius,
          };
        }

        case "progressive": {
          const progressiveRadius = level === 0 ? 0 : 150 * Math.pow(1.8, level - 1);
          const progressiveAngleStep = (2 * Math.PI) / levelNodes.length;
          const progressiveAngle = progressiveAngleStep * index;
          return {
            x: centerX + Math.cos(progressiveAngle) * progressiveRadius,
            y: centerY + Math.sin(progressiveAngle) * progressiveRadius,
          };
        }

        case "hierarchical": {
          if (level === 0) return { x: centerX, y: centerY };
          const hierParentId = parentMap.get(levelNodes[index].id);
          if (hierParentId) {
            const hierParentNode = nodesByIdMap.get(hierParentId);
            if (hierParentNode) {
              const hierSiblings = childrenMap.get(hierParentId) || [];
              const hierSiblingIndex = hierSiblings.indexOf(levelNodes[index].id);
              const hierTotalSiblings = hierSiblings.length;
              const hierParentAngle = Math.atan2(
                hierParentNode.y - centerY,
                hierParentNode.x - centerX,
              );
              const hierAngleSpread = Math.PI / 3;
              const hierAngleOffset =
                (hierSiblingIndex - (hierTotalSiblings - 1) / 2) *
                (hierAngleSpread / Math.max(hierTotalSiblings - 1, 1));
              const hierAngle = hierParentAngle + hierAngleOffset;
              const hierRadius = 180 + (level - 1) * 120;
              return {
                x: centerX + Math.cos(hierAngle) * hierRadius,
                y: centerY + Math.sin(hierAngle) * hierRadius,
              };
            }
          }
          const hierFallbackRadius = 150 + (level - 1) * 100;
          const hierFallbackAngleStep = (2 * Math.PI) / levelNodes.length;
          const hierFallbackAngle = hierFallbackAngleStep * index;
          return {
            x: centerX + Math.cos(hierFallbackAngle) * hierFallbackRadius,
            y: centerY + Math.sin(hierFallbackAngle) * hierFallbackRadius,
          };
        }

        case "concentric":
        default: {
          const concentricRadiusStep = 200;
          const concentricRadius = level * concentricRadiusStep;
          const concentricAngleStep = (2 * Math.PI) / levelNodes.length;
          const concentricAngle = concentricAngleStep * index;
          return {
            x: centerX + Math.cos(concentricAngle) * concentricRadius,
            y: centerY + Math.sin(concentricAngle) * concentricRadius,
          };
        }
      }
    };

    nodesByLevel.forEach((levelNodes, level) => {
      levelNodes.forEach((node, index) => {
        const { x: initialX, y: initialY } = getInitialPosition(level, index, levelNodes);
        const prevState = prevNodesStateRef.current.get(node.id);

        const forceNode: ForceNode = {
          ...node,
          label: node.label ?? "",
          color: node.color ?? "#E3F2FD",
          borderColor: node.borderColor ?? "#1976D2",
          type: node.type ?? "default",
          level: node.level ?? 0,
          isMatch: node.isMatch ?? false,
          parentId: parentMap.get(node.id),
          childIds: childrenMap.get(node.id) || [],
          x: prevState?.x ?? initialX,
          y: prevState?.y ?? initialY,
          vx: prevState?.vx ?? 0,
          vy: prevState?.vy ?? 0,
          initialX,
          initialY,
        };

        forceNodesList.push(forceNode);
        nodesByIdMap.set(node.id, forceNode);
      });
    });

    const linksList: ForceLink[] = [];
    initialLinks.forEach((link) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;

      if (visibleNodeIdsSet.has(sourceId) && visibleNodeIdsSet.has(targetId)) {
        linksList.push({ source: sourceId, target: targetId });
      }
    });

    return {
      forceNodes: forceNodesList,
      forceLinks: linksList,
      nodesById: nodesByIdMap,
      visibleNodeIds: visibleNodeIdsSet,
    };
  }, [initialNodes, initialLinks, layoutMode, collapsedNodeIds]);

  useEffect(() => {
    return () => {
      const stateMap = new Map<string, { x: number; y: number; vx: number; vy: number }>();
      forceNodes.forEach((node) => {
        stateMap.set(node.id, { x: node.x, y: node.y, vx: node.vx, vy: node.vy });
      });
      prevNodesStateRef.current = stateMap;
    };
  }, [forceNodes]);

  useEffect(() => {
    if (forceNodes.length === 0) return;

    // Check if nodes or links have actually changed (not just their positions)
    const currentNodeIds = new Set(forceNodes.map((n) => n.id));
    const currentLinkIds = new Set(
      forceLinks.map(
        (l) =>
          `${typeof l.source === "string" ? l.source : l.source.id}-${typeof l.target === "string" ? l.target : l.target.id}`,
      ),
    );

    const nodesChanged =
      currentNodeIds.size !== prevNodeIdsRef.current.size ||
      [...currentNodeIds].some((id) => !prevNodeIdsRef.current.has(id));
    const linksChanged =
      currentLinkIds.size !== prevLinkIdsRef.current.size ||
      [...currentLinkIds].some((id) => !prevLinkIdsRef.current.has(id));

    prevNodeIdsRef.current = currentNodeIds;
    prevLinkIdsRef.current = currentLinkIds;

    if (simulationRef.current) {
      const sim = simulationRef.current;

      // Only update nodes/links if they've actually changed
      if (nodesChanged) {
        sim.nodes(forceNodes as SimulationNodeDatum[]);
      }

      if (linksChanged || nodesChanged) {
        const linkForce = forceLink(forceLinks as SimulationLinkDatum<SimulationNodeDatum>[])
          .id((d: SimulationNodeDatum) => (d as ForceNode).id)
          .distance(settings.linkDistance)
          .strength(settings.linkStrength);
        sim.force("link", linkForce);
      }

      const containerWidth = containerRef.current?.getBoundingClientRect().width ?? 800;
      const containerHeight = containerRef.current?.getBoundingClientRect().height ?? 600;

      sim.force(
        "center",
        forceCenter(containerWidth / 2, containerHeight / 2).strength(settings.centerStrength),
      );

      sim.force(
        "x",
        forceX((d: SimulationNodeDatum) => (d as ForceNode).initialX).strength(
          settings.positionStrength,
        ),
      );
      sim.force(
        "y",
        forceY((d: SimulationNodeDatum) => (d as ForceNode).initialY).strength(
          settings.positionStrength,
        ),
      );

      if (collisionMode === "full") {
        sim.force("collide", forceCollide().radius(settings.collideRadius).strength(1));
      } else if (collisionMode === "minimal") {
        sim.force("collide", forceCollide().radius(25).strength(0.5));
      } else {
        sim.force("collide", null);
      }

      // Only gently re-heat the simulation if nodes/links changed, don't fully restart
      // This prevents the bounce/re-animation effect
      if (nodesChanged || linksChanged) {
        sim.alpha(Math.max(0.02, sim.alpha())).restart();
      }

      return;
    }

    const containerWidth = containerRef.current?.getBoundingClientRect().width ?? 800;
    const containerHeight = containerRef.current?.getBoundingClientRect().height ?? 600;

    const simulation = forceSimulation(forceNodes as SimulationNodeDatum[])
      .force(
        "charge",
        forceManyBody().strength(settings.chargeStrength).distanceMax(settings.chargeDistanceMax),
      )
      .force(
        "center",
        forceCenter(containerWidth / 2, containerHeight / 2).strength(settings.centerStrength),
      )
      .force(
        "link",
        forceLink(forceLinks as SimulationLinkDatum<SimulationNodeDatum>[])
          .id((d: SimulationNodeDatum) => (d as ForceNode).id)
          .distance(settings.linkDistance)
          .strength(settings.linkStrength),
      );

    if (collisionMode === "full") {
      simulation.force("collide", forceCollide().radius(settings.collideRadius).strength(1));
    } else if (collisionMode === "minimal") {
      simulation.force("collide", forceCollide().radius(25).strength(0.5));
    }

    simulation
      .force(
        "x",
        forceX((d: SimulationNodeDatum) => (d as ForceNode).initialX).strength(
          settings.positionStrength,
        ),
      )
      .force(
        "y",
        forceY((d: SimulationNodeDatum) => (d as ForceNode).initialY).strength(
          settings.positionStrength,
        ),
      )
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    simulationRef.current = simulation;

    simulation.tick(100);
    simulation.alpha(0.1).restart();

    return () => {
      simulation.stop();
    };
  }, [forceNodes, forceLinks, settings, collisionMode]);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [setDimensions]);

  const getNodeRadius = useGetNodeRadius();

  const engineContextValue = useMemo(
    () => ({
      simulationRef,
      forceNodes,
      forceLinks,
      nodesById,
      visibleNodeIds,
      containerRef,
      transformRef,
      prevNodesStateRef,
      getNodeRadius,
      showLevelLabels,
      showChildCount,
      allowNodeDrag,
      highlightSelectedDescendants,
      highlightHoverPaths,
    }),
    [
      simulationRef,
      forceNodes,
      forceLinks,
      nodesById,
      visibleNodeIds,
      containerRef,
      transformRef,
      prevNodesStateRef,
      getNodeRadius,
      showLevelLabels,
      showChildCount,
      allowNodeDrag,
      highlightSelectedDescendants,
      highlightHoverPaths,
    ],
  );

  const contextValue = useMemo(
    () => ({
      nodes: initialNodes,
      links: initialLinks,
      layoutMode,
      collisionMode,
      showLevelLabels,
      showChildCount,
      simulationSettings,
    }),
    [
      initialNodes,
      initialLinks,
      layoutMode,
      collisionMode,
      showLevelLabels,
      showChildCount,
      simulationSettings,
    ],
  );

  return (
    <GraphContext.Provider value={contextValue}>
      <GraphEngineContext.Provider value={engineContextValue}>
        <div ref={containerRef} className={styles.graphRoot}>
          <GraphCanvas />
          {children}
        </div>
      </GraphEngineContext.Provider>
    </GraphContext.Provider>
  );
}
