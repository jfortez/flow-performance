import { useRef, useEffect, useCallback } from "react";
import { useGraphStore } from "../store/graphStore";
import { useGraphContext } from "../context/GraphContext";
import type { OverviewPosition } from "../types";
import styles from "./GraphOverview.module.css";

interface GraphOverviewProps {
  position: OverviewPosition;
  width?: number;
  height?: number;
}

export function GraphOverview({
  position,
  width = 200,
  height = 150,
}: GraphOverviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const nodePositions = useGraphStore((state) => state.nodePositions);
  const viewportTransform = useGraphStore((state) => state.viewportTransform);
  const dimensions = useGraphStore((state) => state.dimensions);
  const setViewportTransform = useGraphStore((state) => state.setViewportTransform);
  const { nodes } = useGraphContext();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (dimensions.width === 0 || dimensions.height === 0) return;

    const scaleX = width / dimensions.width;
    const scaleY = height / dimensions.height;
    const scale = Math.min(scaleX, scaleY) * 0.9;

    const offsetX = (width - dimensions.width * scale) / 2;
    const offsetY = (height - dimensions.height * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    for (const node of nodes) {
      const pos = nodePositions.get(node.id);
      if (!pos) continue;

      const radius = node.level === 0 ? 22 : node.level === 1 ? 16 : 11;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color ?? "#E3F2FD";
      ctx.fill();
      ctx.strokeStyle = node.borderColor ?? "#1976D2";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
    ctx.lineWidth = 2 / scale;
    ctx.strokeRect(
      -viewportTransform.x / viewportTransform.k,
      -viewportTransform.y / viewportTransform.k,
      dimensions.width / viewportTransform.k,
      dimensions.height / viewportTransform.k
    );

    ctx.restore();
  }, [nodePositions, viewportTransform, dimensions, nodes, width, height]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Helper to convert canvas coordinates to main view coordinates
  const canvasToMainCoords = useCallback((canvasX: number, canvasY: number) => {
    if (dimensions.width === 0 || dimensions.height === 0) return { x: 0, y: 0 };

    const scaleX = width / dimensions.width;
    const scaleY = height / dimensions.height;
    const scale = Math.min(scaleX, scaleY) * 0.9;

    const offsetX = (width - dimensions.width * scale) / 2;
    const offsetY = (height - dimensions.height * scale) / 2;

    // Convert canvas coordinates to main view coordinates
    const mainX = (canvasX - offsetX) / scale;
    const mainY = (canvasY - offsetY) / scale;

    return { x: mainX, y: mainY };
  }, [dimensions, width, height]);

  // Helper to get viewport rectangle in canvas coordinates
  const getViewportRect = useCallback(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return null;

    const scaleX = width / dimensions.width;
    const scaleY = height / dimensions.height;
    const scale = Math.min(scaleX, scaleY) * 0.9;

    const offsetX = (width - dimensions.width * scale) / 2;
    const offsetY = (height - dimensions.height * scale) / 2;

    const viewX = -viewportTransform.x / viewportTransform.k;
    const viewY = -viewportTransform.y / viewportTransform.k;
    const viewW = dimensions.width / viewportTransform.k;
    const viewH = dimensions.height / viewportTransform.k;

    return {
      x: offsetX + viewX * scale,
      y: offsetY + viewY * scale,
      width: viewW * scale,
      height: viewH * scale,
    };
  }, [dimensions, viewportTransform, width, height]);

  // Check if point is inside viewport rectangle
  const isPointInViewport = useCallback((x: number, y: number) => {
    const rect = getViewportRect();
    if (!rect) return false;
    return x >= rect.x && x <= rect.x + rect.width &&
           y >= rect.y && y <= rect.y + rect.height;
  }, [getViewportRect]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking inside viewport rectangle
    if (isPointInViewport(x, y)) {
      isDraggingRef.current = true;
      dragStartRef.current = { x, y };
    }
  }, [isPointInViewport]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - dragStartRef.current.x;
    const dy = y - dragStartRef.current.y;

    if (dimensions.width === 0 || dimensions.height === 0) return;

    const scaleX = width / dimensions.width;
    const scaleY = height / dimensions.height;
    const scale = Math.min(scaleX, scaleY) * 0.9;

    // Convert delta to main view coordinates and update transform
    const newX = viewportTransform.x - dx / scale * viewportTransform.k;
    const newY = viewportTransform.y - dy / scale * viewportTransform.k;

    setViewportTransform({
      x: newX,
      y: newY,
      k: viewportTransform.k,
    });

    dragStartRef.current = { x, y };
  }, [dimensions, viewportTransform, width, height, setViewportTransform]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Get the point in main view coordinates before zoom
    const mainCoords = canvasToMainCoords(x, y);

    // Calculate new zoom level
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newK = Math.max(0.3, Math.min(4, viewportTransform.k * zoomFactor));

    // Calculate new position to zoom towards mouse
    const newX = mainCoords.x * newK - (mainCoords.x - viewportTransform.x / viewportTransform.k) * viewportTransform.k;
    const newY = mainCoords.y * newK - (mainCoords.y - viewportTransform.y / viewportTransform.k) * viewportTransform.k;

    setViewportTransform({
      x: -newX + x * (viewportTransform.k / newK),
      y: -newY + y * (viewportTransform.k / newK),
      k: newK,
    });
  }, [canvasToMainCoords, viewportTransform, setViewportTransform]);

  const positionStyle = {
    "top-left": { top: 10, left: 10 },
    "top-right": { top: 10, right: 10 },
    "bottom-left": { bottom: 10, left: 10 },
    "bottom-right": { bottom: 10, right: 10 },
  };

  return (
    <div
      className={styles.overview}
      style={{
        ...positionStyle[position],
        width,
        height,
      }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={styles.canvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDraggingRef.current ? 'grabbing' : 'grab' }}
      />
    </div>
  );
}
