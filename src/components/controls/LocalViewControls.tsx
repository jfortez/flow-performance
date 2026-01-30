interface LocalViewControlsProps {
  neighborLevels: number;
  onChangeNeighborLevels: (levels: number) => void;
  overviewLayout: "cluster" | "tree";
  onChangeOverviewLayout: (layout: "cluster" | "tree") => void;
}

export const LocalViewControls = ({ 
  neighborLevels, 
  onChangeNeighborLevels,
  overviewLayout,
  onChangeOverviewLayout
}: LocalViewControlsProps) => {
  return (
    <div style={{ 
      background: "rgba(255, 255, 255, 0.95)", 
      padding: "12px", 
      borderRadius: "8px", 
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      fontSize: "13px"
    }}>
      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: "6px", color: "#374151" }}>
          Neighbor Levels
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="range"
            min={1}
            max={5}
            value={neighborLevels}
            onChange={(e) => onChangeNeighborLevels(parseInt(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ minWidth: "20px", fontWeight: 600, color: "#3B82F6" }}>
            {neighborLevels}
          </span>
        </div>
        <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "4px" }}>
          How many levels of neighbors to show in detail view
        </div>
      </div>

      <div>
        <label style={{ display: "block", fontWeight: 600, marginBottom: "6px", color: "#374151" }}>
          Overview Layout
        </label>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            onClick={() => onChangeOverviewLayout("cluster")}
            style={{
              flex: 1,
              padding: "6px 10px",
              border: "1px solid #E5E7EB",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px",
              background: overviewLayout === "cluster" ? "#3B82F6" : "white",
              color: overviewLayout === "cluster" ? "white" : "#374151",
              fontWeight: overviewLayout === "cluster" ? 600 : 400
            }}
          >
            Cluster
          </button>
          <button
            onClick={() => onChangeOverviewLayout("tree")}
            style={{
              flex: 1,
              padding: "6px 10px",
              border: "1px solid #E5E7EB",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px",
              background: overviewLayout === "tree" ? "#3B82F6" : "white",
              color: overviewLayout === "tree" ? "white" : "#374151",
              fontWeight: overviewLayout === "tree" ? 600 : 400
            }}
          >
            Tree
          </button>
        </div>
        <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "4px" }}>
          {overviewLayout === "cluster" 
            ? "Leaves at same depth (better for comparison)" 
            : "Compact tree layout (better for space)"}
        </div>
      </div>
    </div>
  );
};
