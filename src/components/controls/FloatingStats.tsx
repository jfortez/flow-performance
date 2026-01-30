import type { PerformanceMetrics } from "../../types";

interface FloatingStatsProps {
  metrics: PerformanceMetrics;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  showFps?: boolean;
  showNodeCount?: boolean;
  showEdgeCount?: boolean;
  showRenderTime?: boolean;
  extraContent?: React.ReactNode;
}

export const FloatingStats = ({
  metrics,
  position = "top-right",
  showFps = true,
  showNodeCount = true,
  showEdgeCount = true,
  showRenderTime = false,
  extraContent,
}: FloatingStatsProps) => {
  const getPositionStyles = () => {
    const base = { position: "absolute" as const, zIndex: 10 };
    switch (position) {
      case "top-right":
        return { ...base, top: 16, right: 16 };
      case "top-left":
        return { ...base, top: 16, left: 16 };
      case "bottom-right":
        return { ...base, bottom: 16, right: 16 };
      case "bottom-left":
        return { ...base, bottom: 16, left: 16 };
      default:
        return { ...base, top: 16, right: 16 };
    }
  };

  const getFpsColor = (fps: number) => {
    if (fps >= 55) return "#10B981";
    if (fps >= 30) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <div
      style={{
        ...getPositionStyles(),
        padding: "12px 16px",
        background: "rgba(255, 255, 255, 0.95)",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        fontSize: "13px",
        fontFamily: "monospace",
        minWidth: "140px",
      }}
    >
      {showFps && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <span style={{ color: "#6B7280" }}>FPS:</span>
          <span style={{ fontWeight: 600, color: getFpsColor(metrics.fps) }}>
            {metrics.fps || "--"}
          </span>
        </div>
      )}
      
      {showNodeCount && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <span style={{ color: "#6B7280" }}>Nodes:</span>
          <span style={{ fontWeight: 600, color: "#374151" }}>{metrics.nodeCount}</span>
        </div>
      )}
      
      {showEdgeCount && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <span style={{ color: "#6B7280" }}>Edges:</span>
          <span style={{ fontWeight: 600, color: "#374151" }}>{metrics.edgeCount}</span>
        </div>
      )}
      
      {showRenderTime && metrics.renderTime > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "#6B7280" }}>Render:</span>
          <span style={{ fontWeight: 600, color: "#374151" }}>
            {Math.round(metrics.renderTime)}ms
          </span>
        </div>
      )}
      
      {extraContent}
    </div>
  );
};
