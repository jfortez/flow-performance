import styles from "./Metrics.module.css";

interface MetricsProps {
  nodesLength: number;
  edgesLength: number;
}

export const Metrics = ({ nodesLength, edgesLength }: MetricsProps) => {
  return (
    <div className={styles.container}>
      <div className={styles.panel}>
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
