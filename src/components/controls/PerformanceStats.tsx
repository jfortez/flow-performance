import type { PerformanceMetrics } from "../../types";

interface PerformanceStatsProps {
  metrics: PerformanceMetrics;
}

export const PerformanceStats = ({ metrics }: PerformanceStatsProps) => {
  const getFpsColor = (fps: number) => {
    if (fps >= 55) return "#10B981";
    if (fps >= 30) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "16px",
        padding: "10px 16px",
        background: "rgba(255, 255, 255, 0.95)",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        fontSize: "13px",
        fontFamily: "monospace",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ color: "#6B7280" }}>FPS:</span>
        <span
          style={{
            fontWeight: 600,
            color: getFpsColor(metrics.fps),
          }}
        >
          {metrics.fps || "--"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ color: "#6B7280" }}>Nodes:</span>
        <span style={{ fontWeight: 600, color: "#374151" }}>
          {metrics.nodeCount}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ color: "#6B7280" }}>Edges:</span>
        <span style={{ fontWeight: 600, color: "#374151" }}>
          {metrics.edgeCount}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ color: "#6B7280" }}>Render:</span>
        <span style={{ fontWeight: 600, color: "#374151" }}>
          {metrics.renderTime > 0 ? `${Math.round(metrics.renderTime)}ms` : "--"}
        </span>
      </div>
    </div>
  );
};
