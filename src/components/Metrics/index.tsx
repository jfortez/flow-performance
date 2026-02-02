import { useEffect, useState } from "react";
import styles from "./Metrics.module.css";

interface MetricsProps {
  nodesLength: number;
  edgesLength: number;
}

export const Metrics = ({ nodesLength, edgesLength }: MetricsProps) => {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId: number;

    const loop = () => {
      const now = performance.now();
      const delta = now - lastTime;

      if (delta >= 1000) {
        setFps(Math.round((frameCount * 1000) / delta));
        frameCount = 0;
        lastTime = now;
      }

      frameCount++;
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const getFpsClass = () => {
    if (fps >= 50) return styles.good;
    if (fps >= 30) return styles.warning;
    return styles.danger;
  };

  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        <div className={styles.metric}>
          <span className={styles.label}>FPS</span>
          <span className={`${styles.value} ${getFpsClass()}`}>{fps}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.metric}>
          <span className={styles.label}>Nodes</span>
          <span className={styles.value}>{nodesLength.toLocaleString()}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.metric}>
          <span className={styles.label}>Edges</span>
          <span className={styles.value}>{edgesLength.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default Metrics;
