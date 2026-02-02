import styles from "./Metrics.module.css";

interface MetricsProps {
  nodesLength: number;
  edgesLength: number;
  fps: number;
}

export const Metrics = ({ nodesLength, edgesLength, fps }: MetricsProps) => {
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
