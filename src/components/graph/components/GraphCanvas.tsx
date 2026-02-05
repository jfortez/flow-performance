import { useEffect, useRef, useCallback, useState } from "react";
import { zoom, zoomIdentity } from "d3-zoom";
import { select } from "d3-selection";
import { useGraphStore } from "../store/graphStore";
import { useGraphEngine } from "../context/GraphEngineContext";
import styles from "./GraphCanvas.module.css";
import type { ForceLink, ForceNode, NodePosition } from "../types";
import {
  NODE_FILL_DEFAULT,
  NODE_FILL_SELECTED,
  NODE_BORDER_DEFAULT,
  NODE_BORDER_MATCH,
  NODE_BORDER_HOVERED,
  NODE_BORDER_CONNECTED,
  NODE_BORDER_LINK_CONNECTED,
  LINK_STROKE_DEFAULT,
  LINK_STROKE_DIMMED,
  LINK_STROKE_CONNECTED,
  LINK_STROKE_HOVERED,
  LINK_SHADOW_CONNECTED,
  LINK_SHADOW_HOVERED,
  NODE_SHADOW_CONNECTED,
  NODE_SHADOW_LINK_CONNECTED,
  SHADOW_TRANSPARENT,
  SELECTION_RING_STROKE,
  SELECTION_RING_FILL,
  LABEL_TEXT_DEFAULT,
  LABEL_TEXT_SELECTED,
  LABEL_TEXT_CONNECTED,
  LABEL_BACKGROUND_HOVERED,
  LABEL_BACKGROUND_DEFAULT,
  LEVEL_RING_STROKE,
  LEVEL_LABEL_FILL,
  BADGE_FILL_ROOT,
  BADGE_FILL_CHILD,
  BADGE_FILL_CONNECTED,
  BADGE_STROKE,
  BADGE_TEXT,
  CHILD_COUNT_FILL,
  CHILD_COUNT_TEXT,
  EXPAND_BUTTON_FILL,
  EXPAND_BUTTON_STROKE,
  OPACITY_DIMMED,
  OPACITY_FULL,
  LINE_WIDTH_THIN,
  LINE_WIDTH_DEFAULT,
  LINE_WIDTH_MEDIUM,
  LINE_WIDTH_THICK,
  LINE_WIDTH_BOLD,
  LINE_WIDTH_EXTRA_BOLD,
  LINE_WIDTH_HEAVY,
  LINE_WIDTH_SELECTION,
  LINE_WIDTH_HOVER,
  SHADOW_BLUR_DEFAULT,
  SHADOW_BLUR_LARGE,
  FONT_SIZE_SMALL,
  FONT_SIZE_DEFAULT,
  FONT_SIZE_MEDIUM,
  FONT_SIZE_LARGE,
  HOVER_THRESHOLD,
  ZOOM_THRESHOLD_LABELS,
  ZOOM_THRESHOLD_CHILD_COUNT,
  ZOOM_THRESHOLD_EXPAND_BUTTON,
  ZOOM_THRESHOLD_NODE_LABELS,
  DASH_PATTERN_LEVEL_RING,
} from "../constants/colors";

export function GraphCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef(zoomIdentity);

  const hoveredNodeIdRef = useRef<string | null>(null);
  const hoveredLinkRef = useRef<ForceLink | null>(null);
  const isHoveringRef = useRef(false);
  const isHoveringLinkRef = useRef(false);
  const draggedNodeRef = useRef<ForceNode | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const clickedOnExpandButtonRef = useRef(false);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doubleClickRef = useRef(false);

  const {
    simulationRef,
    forceNodes,
    forceLinks,
    nodesById,
    visibleNodeIds,
    containerRef,
    getNodeRadius,
    showLevelLabels,
    showChildCount,
    allowNodeDrag,
  } = useGraphEngine();

  const setHoveredNode = useGraphStore((state) => state.setHoveredNode);
  const setIsDragging = useGraphStore((state) => state.setIsDragging);
  const toggleNodeSelection = useGraphStore((state) => state.toggleNodeSelection);
  const clearSelection = useGraphStore((state) => state.clearSelection);
  const toggleNodeCollapse = useGraphStore((state) => state.toggleNodeCollapse);
  const setViewportTransform = useGraphStore((state) => state.setViewportTransform);
  const updateNodePositions = useGraphStore((state) => state.updateNodePositions);
  const collapsedNodeIds = useGraphStore((state) => state.collapsedNodeIds);
  const isDragging = useGraphStore((state) => state.isDragging);

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

    const centerX = width / 2 || 400;
    const centerY = height / 2 || 300;

    let maxLevel = 0;
    for (const node of forceNodes) {
      const level = node.level ?? 0;
      if (level > maxLevel) maxLevel = level;
    }

    for (let level = 1; level <= maxLevel; level++) {
      const radius = level * 120;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = LEVEL_RING_STROKE(level);
      ctx.lineWidth = LINE_WIDTH_DEFAULT / transform.k;
      ctx.setLineDash(DASH_PATTERN_LEVEL_RING.map((v) => v / transform.k));
      ctx.stroke();
      ctx.setLineDash([]);

      if (transform.k > ZOOM_THRESHOLD_LABELS) {
        ctx.fillStyle = LEVEL_LABEL_FILL(level);
        ctx.font = `${Math.max(FONT_SIZE_MEDIUM, FONT_SIZE_LARGE / transform.k)}px system-ui, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`Level ${level}`, centerX + radius + 8 / transform.k, centerY);
      }
    }

    const hoveredNodeId = hoveredNodeIdRef.current;
    const hoveredLink = hoveredLinkRef.current;
    const isHovered = isHoveringRef.current;
    const isLinkHovered = isHoveringLinkRef.current;
    const hoveredNode = hoveredNodeId ? nodesById.get(hoveredNodeId) : null;

    const connectedNodeIds = new Set<string>();
    if (hoveredNode && isHovered) {
      connectedNodeIds.add(hoveredNode.id);

      if (hoveredNode.level === 0) {
        const childIds = hoveredNode.childIds;
        if (childIds) {
          for (const childId of childIds) {
            if (visibleNodeIds.has(childId)) connectedNodeIds.add(childId);
          }
        }
      } else {
        let currentId: string | undefined = hoveredNode.parentId;
        while (currentId) {
          connectedNodeIds.add(currentId);
          const parentNode = nodesById.get(currentId);
          currentId = parentNode?.parentId;
        }

        const addDescendants = (nodeId: string) => {
          const node = nodesById.get(nodeId);
          if (node?.childIds) {
            for (const childId of node.childIds) {
              if (visibleNodeIds.has(childId)) {
                connectedNodeIds.add(childId);
                addDescendants(childId);
              }
            }
          }
        };
        addDescendants(hoveredNode.id);
      }
    }

    const selectedNodeIds = useGraphStore.getState().selectedNodeIds;

    for (const link of forceLinks) {
      const source = typeof link.source === "string" ? nodesById.get(link.source) : link.source;
      const target = typeof link.target === "string" ? nodesById.get(link.target) : link.target;

      if (!source || !target) continue;

      const isLinkMatch = isLinkHovered && hoveredLink === link;
      const isConnected =
        isHovered && connectedNodeIds.has(source.id) && connectedNodeIds.has(target.id);

      if (isLinkMatch) {
        ctx.strokeStyle = LINK_STROKE_HOVERED;
        ctx.lineWidth = LINE_WIDTH_HEAVY / transform.k;
        ctx.shadowColor = LINK_SHADOW_HOVERED;
        ctx.shadowBlur = SHADOW_BLUR_LARGE / transform.k;
      } else if (isHovered && !isConnected) {
        ctx.strokeStyle = LINK_STROKE_DIMMED;
        ctx.lineWidth = LINE_WIDTH_THIN / transform.k;
      } else if (isConnected) {
        ctx.strokeStyle = LINK_STROKE_CONNECTED;
        ctx.lineWidth = LINE_WIDTH_EXTRA_BOLD / transform.k;
        ctx.shadowColor = LINK_SHADOW_CONNECTED;
        ctx.shadowBlur = SHADOW_BLUR_DEFAULT / transform.k;
      } else {
        ctx.strokeStyle = LINK_STROKE_DEFAULT;
        ctx.lineWidth = LINE_WIDTH_MEDIUM / transform.k;
      }

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();

      if (isLinkMatch || isConnected) {
        ctx.shadowColor = SHADOW_TRANSPARENT;
        ctx.shadowBlur = 0;
      }
    }

    // Get link-connected node IDs for link hover highlighting
    const linkConnectedNodeIds = new Set<string>();
    if (isLinkHovered && hoveredLink) {
      const sourceId =
        typeof hoveredLink.source === "string" ? hoveredLink.source : hoveredLink.source.id;
      const targetId =
        typeof hoveredLink.target === "string" ? hoveredLink.target : hoveredLink.target.id;
      linkConnectedNodeIds.add(sourceId);
      linkConnectedNodeIds.add(targetId);
    }

    for (const node of forceNodes) {
      const isNodeHovered = hoveredNode?.id === node.id;
      const isConnected = isHovered && connectedNodeIds.has(node.id);
      const isLinkConnected = isLinkHovered && linkConnectedNodeIds.has(node.id);
      const isSelected = selectedNodeIds.has(node.id);
      const radius = getNodeRadius(node.level ?? 0);

      if ((isHovered || isLinkHovered) && !isConnected && !isLinkConnected) ctx.globalAlpha = OPACITY_DIMMED;

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? NODE_FILL_SELECTED : (node.color ?? NODE_FILL_DEFAULT);
      ctx.fill();

      ctx.lineWidth = (isNodeHovered ? LINE_WIDTH_HOVER : isConnected || isLinkConnected ? LINE_WIDTH_EXTRA_BOLD : LINE_WIDTH_BOLD) / transform.k;
      ctx.strokeStyle = isLinkConnected
        ? NODE_BORDER_LINK_CONNECTED
        : isConnected
          ? NODE_BORDER_CONNECTED
          : node.isMatch
            ? NODE_BORDER_MATCH
            : (node.borderColor ?? NODE_BORDER_DEFAULT);
      ctx.stroke();

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 8 / transform.k, 0, Math.PI * 2);
        ctx.strokeStyle = SELECTION_RING_STROKE;
        ctx.lineWidth = LINE_WIDTH_SELECTION / transform.k;
        ctx.stroke();
      }

      if (isNodeHovered || isConnected || isLinkConnected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 5 / transform.k, 0, Math.PI * 2);
        ctx.strokeStyle = isNodeHovered
          ? NODE_BORDER_HOVERED
          : isLinkConnected
            ? NODE_SHADOW_LINK_CONNECTED
            : NODE_SHADOW_CONNECTED;
        ctx.lineWidth = LINE_WIDTH_SELECTION / transform.k;
        ctx.stroke();
      }

      ctx.globalAlpha = OPACITY_FULL;

      if (showLevelLabels) {
        const badgeRadius = Math.max(7, 9 / transform.k);
        const badgeY = node.y - radius - badgeRadius / 2;
        ctx.beginPath();
        ctx.arc(node.x, badgeY, badgeRadius, 0, Math.PI * 2);
        ctx.fillStyle = isConnected ? BADGE_FILL_CONNECTED : node.level === 0 ? BADGE_FILL_ROOT : BADGE_FILL_CHILD;
        ctx.fill();
        ctx.lineWidth = LINE_WIDTH_DEFAULT / transform.k;
        ctx.strokeStyle = BADGE_STROKE;
        ctx.stroke();
        ctx.fillStyle = BADGE_TEXT;
        ctx.font = `bold ${Math.max(FONT_SIZE_SMALL, FONT_SIZE_DEFAULT / transform.k)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(node.level), node.x, badgeY);
      }

      if (showChildCount && node.childIds && node.childIds.length > 0 && transform.k > ZOOM_THRESHOLD_CHILD_COUNT) {
        const countRadius = Math.max(8, 10 / transform.k);
        const countX = node.x + radius * 0.7;
        const countY = node.y - radius * 0.7;
        ctx.beginPath();
        ctx.arc(countX, countY, countRadius, 0, Math.PI * 2);
        ctx.fillStyle = CHILD_COUNT_FILL;
        ctx.fill();
        ctx.fillStyle = CHILD_COUNT_TEXT;
        ctx.font = `bold ${Math.max(FONT_SIZE_SMALL, FONT_SIZE_DEFAULT / transform.k)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(node.childIds.length), countX, countY);
      }

      if (node.childIds && node.childIds.length > 0 && transform.k > ZOOM_THRESHOLD_EXPAND_BUTTON) {
        const isCollapsed = collapsedNodeIds.has(node.id);
        const btnRadius = Math.max(7, 9 / transform.k);
        let btnX: number;
        let btnY: number;

        if (node.parentId && nodesById.has(node.parentId)) {
          const parentNode = nodesById.get(node.parentId)!;
          const angle = Math.atan2(node.y - parentNode.y, node.x - parentNode.x);
          btnX = node.x + Math.cos(angle) * radius;
          btnY = node.y + Math.sin(angle) * radius;
        } else {
          btnX = node.x;
          btnY = node.y + radius;
        }

        ctx.beginPath();
        ctx.arc(btnX, btnY, btnRadius, 0, Math.PI * 2);
        ctx.fillStyle = EXPAND_BUTTON_FILL;
        ctx.fill();
        ctx.lineWidth = LINE_WIDTH_THICK / transform.k;
        ctx.strokeStyle = EXPAND_BUTTON_STROKE;
        ctx.stroke();
        ctx.strokeStyle = EXPAND_BUTTON_STROKE;
        ctx.lineWidth = LINE_WIDTH_THICK / transform.k;
        ctx.beginPath();
        ctx.moveTo(btnX - btnRadius * 0.4, btnY);
        ctx.lineTo(btnX + btnRadius * 0.4, btnY);
        if (isCollapsed) {
          ctx.moveTo(btnX, btnY - btnRadius * 0.4);
          ctx.lineTo(btnX, btnY + btnRadius * 0.4);
        }
        ctx.stroke();
      }

      if (isNodeHovered || isConnected || isSelected || transform.k > ZOOM_THRESHOLD_NODE_LABELS) {
        const labelY = node.y + radius + 14 / transform.k;
        const fontSize = Math.max(FONT_SIZE_MEDIUM, FONT_SIZE_LARGE / transform.k);
        ctx.font = `${isNodeHovered || isConnected || isSelected ? "bold " : ""}${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const metrics = ctx.measureText(node.label ?? "");
        const padding = 3 / transform.k;
        ctx.fillStyle = isSelected
          ? SELECTION_RING_FILL
          : isNodeHovered || isConnected
            ? LABEL_BACKGROUND_HOVERED
            : LABEL_BACKGROUND_DEFAULT;
        ctx.beginPath();
        ctx.roundRect(
          node.x - metrics.width / 2 - padding,
          labelY - padding,
          metrics.width + padding * 2,
          fontSize + padding * 2,
          3 / transform.k,
        );
        ctx.fill();
        ctx.fillStyle = isSelected ? LABEL_TEXT_SELECTED : isConnected ? LABEL_TEXT_CONNECTED : LABEL_TEXT_DEFAULT;
        ctx.fillText(node.label ?? "", node.x, labelY);
      }
    }

    ctx.restore();
  }, [
    forceNodes,
    forceLinks,
    nodesById,
    collapsedNodeIds,
    showLevelLabels,
    showChildCount,
    visibleNodeIds,
    getNodeRadius,
  ]);

  useEffect(() => {
    let rafId: number;
    let lastRenderTime = 0;
    const targetFPS = 60;
    const frameInterval = 1000 / targetFPS;

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastRenderTime;

      if (deltaTime >= frameInterval) {
        render();
        lastRenderTime = currentTime - (deltaTime % frameInterval);
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [render]);

  const viewportTransform = useGraphStore((state) => state.viewportTransform);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.3, 4])
      .filter((event) => {
        if (event.type === "wheel") return true;
        if (event.type === "dblclick") return false;
        if (draggedNodeRef.current || isHoveringRef.current) return false;
        return true;
      })
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        setViewportTransform({ x: event.transform.x, y: event.transform.y, k: event.transform.k });
      });

    select(canvas).call(zoomBehavior);

    // Sync external transform changes to D3 zoom
    const currentTransform = transformRef.current;
    if (
      currentTransform.x !== viewportTransform.x ||
      currentTransform.y !== viewportTransform.y ||
      currentTransform.k !== viewportTransform.k
    ) {
      const newTransform = zoomIdentity
        .translate(viewportTransform.x, viewportTransform.y)
        .scale(viewportTransform.k);
      select(canvas).call(zoomBehavior.transform, newTransform);
      transformRef.current = newTransform;
    }
  }, [setViewportTransform, viewportTransform]);

  useEffect(() => {
    const update = () => {
      if (containerRef.current && canvasRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = width;
        canvasRef.current.height = height;
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [containerRef]);

  useEffect(() => {
    let rafId: number;
    let lastUpdateTime = 0;
    const updateInterval = 1000 / 30;

    const updatePositions = (currentTime: number) => {
      const deltaTime = currentTime - lastUpdateTime;

      if (deltaTime >= updateInterval) {
        const positions = new Map<string, NodePosition>();
        forceNodes.forEach((node) => {
          positions.set(node.id, {
            x: node.x,
            y: node.y,
            level: node.level,
          });
        });
        updateNodePositions(positions);
        lastUpdateTime = currentTime - (deltaTime % updateInterval);
      }

      rafId = requestAnimationFrame(updatePositions);
    };

    rafId = requestAnimationFrame(updatePositions);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [forceNodes, updateNodePositions]);

  const getNodeAtPosition = useCallback(
    (clientX: number, clientY: number): ForceNode | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const y = (clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      let closest: ForceNode | null = null;
      let minDist = Infinity;

      for (const node of forceNodes) {
        const radius = getNodeRadius(node.level ?? 0);
        const dx = x - node.x;
        const dy = y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius + 8 && dist < minDist) {
          minDist = dist;
          closest = node;
        }
      }

      return closest;
    },
    [forceNodes, getNodeRadius],
  );

  const pointToLineDistance = useCallback(
    (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
      const A = px - x1;
      const B = py - y1;
      const C = x2 - x1;
      const D = y2 - y1;

      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = -1;

      if (lenSq !== 0) {
        param = dot / lenSq;
      }

      let xx: number;
      let yy: number;

      if (param < 0) {
        xx = x1;
        yy = y1;
      } else if (param > 1) {
        xx = x2;
        yy = y2;
      } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
      }

      const dx = px - xx;
      const dy = py - yy;

      return Math.sqrt(dx * dx + dy * dy);
    },
    [],
  );

  const getLinkAtPosition = useCallback(
    (clientX: number, clientY: number): ForceLink | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const y = (clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      let closestLink: ForceLink | null = null;
      let minDist = Infinity;

      for (const link of forceLinks) {
        const source = typeof link.source === "string" ? nodesById.get(link.source) : link.source;
        const target = typeof link.target === "string" ? nodesById.get(link.target) : link.target;

        if (!source || !target) continue;

        const dist = pointToLineDistance(x, y, source.x, source.y, target.x, target.y);
        if (dist < HOVER_THRESHOLD && dist < minDist) {
          minDist = dist;
          closestLink = link;
        }
      }

      return closestLink;
    },
    [forceLinks, nodesById, pointToLineDistance],
  );

  const isClickOnExpandButton = useCallback(
    (node: ForceNode, clientX: number, clientY: number): boolean => {
      if (!node.childIds || node.childIds.length === 0) return false;

      const canvas = canvasRef.current;
      if (!canvas) return false;

      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const y = (clientY - rect.top - transformRef.current.y) / transformRef.current.k;
      const radius = getNodeRadius(node.level ?? 0);
      const btnRadius = Math.max(7, 9 / transformRef.current.k);

      let btnX: number;
      let btnY: number;

      if (node.parentId && nodesById.has(node.parentId)) {
        const parentNode = nodesById.get(node.parentId)!;
        const angle = Math.atan2(node.y - parentNode.y, node.x - parentNode.x);
        btnX = node.x + Math.cos(angle) * radius;
        btnY = node.y + Math.sin(angle) * radius;
      } else {
        btnX = node.x;
        btnY = node.y + radius;
      }

      const dx = x - btnX;
      const dy = y - btnY;
      return Math.sqrt(dx * dx + dy * dy) <= btnRadius + 2 / transformRef.current.k;
    },
    [nodesById, getNodeRadius],
  );

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (isDragging) {
        setIsDragging(false);
        clickedOnExpandButtonRef.current = false;
        clearSelection();
        return;
      }

      if (doubleClickRef.current) {
        doubleClickRef.current = false;
        return;
      }

      const clickedNode = getNodeAtPosition(event.clientX, event.clientY);
      const wasExpandButtonClick =
        clickedOnExpandButtonRef.current ||
        (clickedNode ? isClickOnExpandButton(clickedNode, event.clientX, event.clientY) : false);

      clickedOnExpandButtonRef.current = false;

      if (clickedNode && wasExpandButtonClick) {
        toggleNodeCollapse(clickedNode.id);
        clearSelection();
        return;
      }

      if (clickedNode) {
        if (tooltipTimeoutRef.current) {
          clearTimeout(tooltipTimeoutRef.current);
          tooltipTimeoutRef.current = null;
        }
        hoveredNodeIdRef.current = null;
        isHoveringRef.current = false;
        setHoveredNode(null);

        const multi = event.ctrlKey || event.metaKey;
        toggleNodeSelection(clickedNode.id, multi);
      } else {
        clearSelection();
      }
    },
    [
      getNodeAtPosition,
      isClickOnExpandButton,
      isDragging,
      toggleNodeCollapse,
      clearSelection,
      setHoveredNode,
      toggleNodeSelection,
      setIsDragging,
    ],
  );

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      doubleClickRef.current = true;
      const clickedNode = getNodeAtPosition(event.clientX, event.clientY);
      if (clickedNode?.childIds && clickedNode.childIds.length > 0) {
        toggleNodeCollapse(clickedNode.id);
      }
    },
    [getNodeAtPosition, toggleNodeCollapse],
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const clickedNode = getNodeAtPosition(event.clientX, event.clientY);
      if (clickedNode && isClickOnExpandButton(clickedNode, event.clientX, event.clientY)) {
        clickedOnExpandButtonRef.current = true;
        return;
      }

      clickedOnExpandButtonRef.current = false;
      if (!clickedNode || !allowNodeDrag) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const y = (event.clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      dragOffsetRef.current = { x: x - clickedNode.x, y: y - clickedNode.y };
      dragStartPosRef.current = { x: event.clientX, y: event.clientY };
      setIsDragging(false);
      draggedNodeRef.current = clickedNode;
      clickedNode.fx = clickedNode.x;
      clickedNode.fy = clickedNode.y;
      simulationRef.current?.alpha(0.3).restart();
    },
    [getNodeAtPosition, isClickOnExpandButton, setIsDragging, simulationRef, allowNodeDrag],
  );

  const [isHoveringState, setIsHoveringState] = useState(false);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (draggedNodeRef.current && allowNodeDrag) {
        const dx = event.clientX - dragStartPosRef.current.x;
        const dy = event.clientY - dragStartPosRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 3) {
          setIsDragging(true);
          if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
            tooltipTimeoutRef.current = null;
          }
          hoveredNodeIdRef.current = null;
          isHoveringRef.current = false;
          hoveredLinkRef.current = null;
          isHoveringLinkRef.current = false;
          setIsHoveringState(false);
          setHoveredNode(null);
        }

        if (isDragging) {
          const rect = canvas.getBoundingClientRect();
          const x = (event.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
          const y = (event.clientY - rect.top - transformRef.current.y) / transformRef.current.k;
          draggedNodeRef.current.fx = x - dragOffsetRef.current.x;
          draggedNodeRef.current.fy = y - dragOffsetRef.current.y;
          simulationRef.current?.alpha(0.3).restart();
          return;
        }
      }

      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const y = (event.clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      // Check for node hover first
      let closestNode: ForceNode | undefined;
      let minDist = Infinity;

      for (const node of forceNodes) {
        const radius = getNodeRadius(node.level ?? 0);
        const dx = x - node.x;
        const dy = y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius + 8 && dist < minDist) {
          minDist = dist;
          closestNode = node;
        }
      }

      if (closestNode) {
        if (tooltipTimeoutRef.current) {
          clearTimeout(tooltipTimeoutRef.current);
          tooltipTimeoutRef.current = null;
        }
        const nodeId = closestNode.id;
        if (hoveredNodeIdRef.current !== nodeId) {
          hoveredNodeIdRef.current = nodeId;
          isHoveringRef.current = true;
          hoveredLinkRef.current = null;
          isHoveringLinkRef.current = false;
          setIsHoveringState(true);
          setHoveredNode(nodeId);
        }
        return;
      }

      // Check for link hover when no node is hovered
      const closestLink = getLinkAtPosition(event.clientX, event.clientY);
      if (closestLink) {
        if (tooltipTimeoutRef.current) {
          clearTimeout(tooltipTimeoutRef.current);
          tooltipTimeoutRef.current = null;
        }
        if (hoveredLinkRef.current !== closestLink) {
          hoveredNodeIdRef.current = null;
          isHoveringRef.current = false;
          hoveredLinkRef.current = closestLink;
          isHoveringLinkRef.current = true;
          setIsHoveringState(true);
          setHoveredNode(null);
        }
        return;
      }

      // Clear hover state if neither node nor link is hovered
      if (!tooltipTimeoutRef.current) {
        tooltipTimeoutRef.current = setTimeout(() => {
          if (hoveredNodeIdRef.current !== null || hoveredLinkRef.current !== null) {
            hoveredNodeIdRef.current = null;
            isHoveringRef.current = false;
            hoveredLinkRef.current = null;
            isHoveringLinkRef.current = false;
            setIsHoveringState(false);
            setHoveredNode(null);
          }
          tooltipTimeoutRef.current = null;
        }, 150);
      }
    },
    [
      forceNodes,
      isDragging,
      setHoveredNode,
      setIsDragging,
      getNodeRadius,
      simulationRef,
      allowNodeDrag,
      getLinkAtPosition,
    ],
  );

  const handleMouseUp = useCallback(() => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current = null;
      simulationRef.current?.alpha(0.3).restart();
    }
  }, [simulationRef]);

  return (
    <canvas
      ref={canvasRef}
      className={`${styles.canvas} ${isDragging ? styles.canvasGrabbing : isHoveringState ? styles.canvasPointer : styles.canvasGrab}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseUp}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleCanvasClick}
      onDoubleClick={handleDoubleClick}
    />
  );
}
