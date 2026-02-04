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
  const nodePositions = useGraphStore((state) => state.nodePositions);
  const viewportTransform = useGraphStore((state) => state.viewportTransform);
  const dimensions = useGraphStore((state) => state.dimensions);
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
      <canvas ref={canvasRef} width={width} height={height} className={styles.canvas} />
    </div>
  );
}
