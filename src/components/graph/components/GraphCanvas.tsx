import { useEffect, useRef, useCallback, useState } from "react";
import { zoom, zoomIdentity } from "d3-zoom";
import { select } from "d3-selection";
import { useGraphStore } from "../store/graphStore";
import { useGraphEngine } from "../context/GraphEngineContext";
import styles from "./GraphCanvas.module.css";

export function GraphCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef(zoomIdentity);
  
  const hoveredNodeIdRef = useRef<string | null>(null);
  const isHoveringRef = useRef(false);
  const draggedNodeRef = useRef<import("../types").ForceNode | null>(null);
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
      ctx.strokeStyle = `rgba(200, 200, 200, ${0.3 - level * 0.04})`;
      ctx.lineWidth = 1 / transform.k;
      ctx.setLineDash([5 / transform.k, 5 / transform.k]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (transform.k > 0.5) {
        ctx.fillStyle = `rgba(150, 150, 150, ${0.7 - level * 0.1})`;
        ctx.font = `${Math.max(10, 11 / transform.k)}px system-ui, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`Level ${level}`, centerX + radius + 8 / transform.k, centerY);
      }
    }

    const hoveredNodeId = hoveredNodeIdRef.current;
    const isHovered = isHoveringRef.current;
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

      const isConnected =
        isHovered && connectedNodeIds.has(source.id) && connectedNodeIds.has(target.id);

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
    }

    for (const node of forceNodes) {
      const isNodeHovered = hoveredNode?.id === node.id;
      const isConnected = isHovered && connectedNodeIds.has(node.id);
      const isSelected = selectedNodeIds.has(node.id);
      const radius = getNodeRadius(node.level ?? 0);

      if (isHovered && !isConnected) ctx.globalAlpha = 0.25;

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#A5D6A7" : (node.color ?? "#E3F2FD");
      ctx.fill();

      ctx.lineWidth = (isNodeHovered ? 4 : isConnected ? 3 : 2) / transform.k;
      ctx.strokeStyle = isConnected
        ? "#9370DB"
        : node.isMatch
        ? "#FFC107"
        : (node.borderColor ?? "#1976D2");
      ctx.stroke();

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 8 / transform.k, 0, Math.PI * 2);
        ctx.strokeStyle = "#22C55E";
        ctx.lineWidth = 3 / transform.k;
        ctx.stroke();
      }

      if (isNodeHovered || isConnected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 5 / transform.k, 0, Math.PI * 2);
        ctx.strokeStyle = isNodeHovered ? "rgba(255, 193, 7, 0.6)" : "rgba(147, 112, 219, 0.5)";
        ctx.lineWidth = 3 / transform.k;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      if (showLevelLabels) {
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
      }

      if (showChildCount && node.childIds && node.childIds.length > 0 && transform.k > 0.6) {
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

      if (node.childIds && node.childIds.length > 0 && transform.k > 0.6) {
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
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.fill();
        ctx.lineWidth = 1.5 / transform.k;
        ctx.strokeStyle = "#64748b";
        ctx.stroke();
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 1.5 / transform.k;
        ctx.beginPath();
        ctx.moveTo(btnX - btnRadius * 0.4, btnY);
        ctx.lineTo(btnX + btnRadius * 0.4, btnY);
        if (isCollapsed) {
          ctx.moveTo(btnX, btnY - btnRadius * 0.4);
          ctx.lineTo(btnX, btnY + btnRadius * 0.4);
        }
        ctx.stroke();
      }

      if (isNodeHovered || isConnected || isSelected || transform.k > 0.7) {
        const labelY = node.y + radius + 14 / transform.k;
        const fontSize = Math.max(10, 11 / transform.k);
        ctx.font = `${isNodeHovered || isConnected || isSelected ? "bold " : ""}${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const metrics = ctx.measureText(node.label ?? "");
        const padding = 3 / transform.k;
        ctx.fillStyle = isSelected
          ? "rgba(34, 197, 94, 0.2)"
          : isNodeHovered || isConnected
          ? "rgba(255, 255, 255, 1)"
          : "rgba(255, 255, 255, 0.95)";
        ctx.beginPath();
        ctx.roundRect(
          node.x - metrics.width / 2 - padding,
          labelY - padding,
          metrics.width + padding * 2,
          fontSize + padding * 2,
          3 / transform.k,
        );
        ctx.fill();
        ctx.fillStyle = isSelected ? "#16A34A" : isConnected ? "#9370DB" : "#1F2937";
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
  }, [setViewportTransform]);

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
        const positions = new Map<string, import("../types").NodePosition>();
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
    (clientX: number, clientY: number): import("../types").ForceNode | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const y = (clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      let closest: import("../types").ForceNode | null = null;
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

  const isClickOnExpandButton = useCallback(
    (node: import("../types").ForceNode, clientX: number, clientY: number): boolean => {
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
      if (!clickedNode) return;

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
    [getNodeAtPosition, isClickOnExpandButton, setIsDragging, simulationRef],
  );

  const [isHoveringState, setIsHoveringState] = useState(false);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (draggedNodeRef.current) {
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

      let closestNode: import("../types").ForceNode | undefined;
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
          setIsHoveringState(true);
          setHoveredNode(nodeId);
        }
      } else if (!tooltipTimeoutRef.current) {
        tooltipTimeoutRef.current = setTimeout(() => {
          if (hoveredNodeIdRef.current !== null) {
            hoveredNodeIdRef.current = null;
            isHoveringRef.current = false;
            setIsHoveringState(false);
            setHoveredNode(null);
          }
          tooltipTimeoutRef.current = null;
        }, 150);
      }
    },
    [forceNodes, isDragging, setHoveredNode, setIsDragging, getNodeRadius, simulationRef],
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
