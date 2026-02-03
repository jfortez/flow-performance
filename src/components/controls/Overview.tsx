import { useEffect, useRef, useCallback } from "react";
import styles from "./Overview.module.css";

interface OverviewProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Array<{ id: string; x: number; y: number; level: number }>;
  viewportTransform: { x: number; y: number; k: number };
  canvasWidth: number;
  canvasHeight: number;
  onViewportChange?: (transform: { x: number; y: number; k: number }) => void;
}

export const Overview = ({
  isOpen,
  onClose,
  nodes,
  viewportTransform,
  canvasWidth,
  canvasHeight,
  onViewportChange,
}: OverviewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const transformRef = useRef(viewportTransform);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const transformStartRef = useRef({ x: 0, y: 0, k: 1 });

  // Keep transform reference updated
  useEffect(() => {
    transformRef.current = viewportTransform;
  }, [viewportTransform]);

  // Calculate scale and offset for coordinate conversion
  const getScaleAndOffset = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { scale: 1, offsetX: 0, offsetY: 0, minX: 0, minY: 0 };

    const width = canvas.width;
    const height = canvas.height;
    const padding = 20;
    const availableWidth = width - padding * 2;
    const availableHeight = height - padding * 2;

    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const graphWidth = maxX - minX || 1;
    const graphHeight = maxY - minY || 1;

    const scaleX = availableWidth / graphWidth;
    const scaleY = availableHeight / graphHeight;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (width - graphWidth * scale) / 2 - minX * scale;
    const offsetY = (height - graphHeight * scale) / 2 - minY * scale;

    return { scale, offsetX, offsetY, minX, minY };
  }, [nodes]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isOpen) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const { scale, offsetX, offsetY } = getScaleAndOffset();

    // Draw nodes
    nodes.forEach((node) => {
      const x = node.x * scale + offsetX;
      const y = node.y * scale + offsetY;
      const radius = node.level === 0 ? 3 : 2;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = node.level === 0 ? "#7B1FA2" : "#3B82F6";
      ctx.fill();
    });

    // Draw viewport rectangle using the latest transform
    const currentTransform = transformRef.current;
    const viewportX = (-currentTransform.x / currentTransform.k) * scale + offsetX;
    const viewportY = (-currentTransform.y / currentTransform.k) * scale + offsetY;
    const viewportW = (canvasWidth / currentTransform.k) * scale;
    const viewportH = (canvasHeight / currentTransform.k) * scale;

    ctx.strokeStyle = "#EF4444";
    ctx.lineWidth = 2;
    ctx.strokeRect(viewportX, viewportY, viewportW, viewportH);
  }, [nodes, canvasWidth, canvasHeight, isOpen, getScaleAndOffset]);

  // Animation loop for smooth updates
  useEffect(() => {
    if (!isOpen) return;

    const animate = () => {
      draw();
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [draw, isOpen]);

  // Handle mouse down - start dragging
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onViewportChange) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      isDraggingRef.current = true;
      dragStartRef.current = { x, y };
      transformStartRef.current = { ...transformRef.current };
    },
    [onViewportChange],
  );

  // Handle mouse move - pan
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current || !onViewportChange) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const dx = x - dragStartRef.current.x;
      const dy = y - dragStartRef.current.y;

      const { scale } = getScaleAndOffset();
      const worldDx = (dx / scale) * transformStartRef.current.k;
      const worldDy = (dy / scale) * transformStartRef.current.k;

      onViewportChange({
        x: transformStartRef.current.x - worldDx,
        y: transformStartRef.current.y - worldDy,
        k: transformStartRef.current.k,
      });
    },
    [onViewportChange, getScaleAndOffset],
  );

  // Handle mouse up - stop dragging
  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Attach wheel event listener with passive: false
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isOpen) return;

    const wheelHandler = (event: WheelEvent) => {
      // Prevent default scrolling behavior
      event.preventDefault();
      event.stopPropagation();

      if (!onViewportChange) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Calculate zoom factor
      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newK = Math.max(0.3, Math.min(4, transformRef.current.k * zoomFactor));

      // Get world coordinates of mouse position before zoom
      const { scale, offsetX, offsetY } = getScaleAndOffset();
      const worldX = (mouseX - offsetX) / scale;
      const worldY = (mouseY - offsetY) / scale;

      // Calculate new transform to zoom towards mouse position
      const newX = -worldX * newK + canvasWidth / 2;
      const newY = -worldY * newK + canvasHeight / 2;

      onViewportChange({
        x: newX,
        y: newY,
        k: newK,
      });
    };

    // Use capture phase and explicit non-passive option
    const options: AddEventListenerOptions = {
      passive: false,
      capture: false,
    };

    canvas.addEventListener("wheel", wheelHandler, options);
    return () => {
      canvas.removeEventListener("wheel", wheelHandler, options);
    };
  }, [isOpen, onViewportChange, getScaleAndOffset, canvasWidth, canvasHeight]);

  if (!isOpen) return null;

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Overview</span>
        <button className={styles.closeButton} onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={200}
        height={150}
        className={styles.canvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          // eslint-disable-next-line react-hooks/refs
          cursor: onViewportChange ? (isDraggingRef.current ? "grabbing" : "grab") : "default",
        }}
      />
    </div>
  );
};
