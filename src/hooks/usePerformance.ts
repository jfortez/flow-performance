import { useState, useEffect, useRef, useCallback } from "react";
import type { PerformanceMetrics } from "../types";

export const usePerformance = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    nodeCount: 0,
    edgeCount: 0,
    renderTime: 0,
  });

  const frameCount = useRef(0);
  const lastTime = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    lastTime.current = performance.now();
  }, []);

  const updateMetrics = useCallback((nodeCount: number, edgeCount: number) => {
    if (!lastTime.current) return;

    const now = performance.now();
    const delta = now - lastTime.current;

    if (delta >= 1000) {
      const fps = Math.round((frameCount.current * 1000) / delta);

      setMetrics((prev) => ({
        ...prev,
        fps,
        nodeCount,
        edgeCount,
        renderTime: delta,
      }));

      frameCount.current = 0;
      lastTime.current = now;
    }

    frameCount.current++;
  }, []);

  useEffect(() => {
    const loop = () => {
      updateMetrics(metrics.nodeCount, metrics.edgeCount);
      rafId.current = requestAnimationFrame(loop);
    };

    rafId.current = requestAnimationFrame(loop);

    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [updateMetrics, metrics.nodeCount, metrics.edgeCount]);

  const setElementCounts = useCallback((nodeCount: number, edgeCount: number) => {
    setMetrics((prev) => ({
      ...prev,
      nodeCount,
      edgeCount,
    }));
  }, []);

  return {
    metrics,
    setElementCounts,
  };
};
