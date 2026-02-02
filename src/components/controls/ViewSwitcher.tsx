import { useState } from "react";
import type { ViewType } from "../../types";

interface ViewSwitcherProps {
  currentView: ViewType;
  onChangeView: (view: ViewType) => void;
}

const views: { id: ViewType; label: string; description: string; category: "d3" | "reactflow" }[] = [
  { id: "d3simple", label: "D3 Simple", description: "Simple d3-force layout", category: "d3" },
  { id: "d3canvas", label: "D3 Canvas", description: "Canvas rendering with limits", category: "d3" },
  { id: "d3cluster", label: "D3 Cluster", description: "D3 hierarchy cluster", category: "d3" },
  { id: "local", label: "Local", description: "Focus+context view", category: "d3" },
  { id: "force", label: "Force", description: "Force-directed layout", category: "reactflow" },
  { id: "dagre", label: "Dagre", description: "Hierarchical layout", category: "reactflow" },
  { id: "radial", label: "Radial", description: "Radial layout", category: "reactflow" },
  { id: "concentric", label: "Concentric", description: "Circular rings", category: "reactflow" },
  { id: "grid", label: "Grid", description: "Grid layout", category: "reactflow" },
];

export const ViewSwitcher = ({ currentView, onChangeView }: ViewSwitcherProps) => {
  const [activeCategory, setActiveCategory] = useState<"d3" | "reactflow">("d3");

  const filteredViews = views.filter((view) => view.category === activeCategory);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "6px",
        background: "rgba(255, 255, 255, 0.95)",
        borderRadius: "10px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
      }}
    >
      {/* Category Tabs */}
      <div
        style={{
          display: "flex",
          gap: "2px",
          padding: "2px",
          background: "#F3F4F6",
          borderRadius: "6px",
        }}
      >
        <button
          onClick={() => setActiveCategory("d3")}
          style={{
            flex: 1,
            padding: "4px 12px",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "11px",
            fontWeight: 600,
            background: activeCategory === "d3" ? "white" : "transparent",
            color: activeCategory === "d3" ? "#3B82F6" : "#6B7280",
            boxShadow: activeCategory === "d3" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.2s ease",
          }}
        >
          D3 Views
        </button>
        <button
          onClick={() => setActiveCategory("reactflow")}
          style={{
            flex: 1,
            padding: "4px 12px",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "11px",
            fontWeight: 600,
            background: activeCategory === "reactflow" ? "white" : "transparent",
            color: activeCategory === "reactflow" ? "#3B82F6" : "#6B7280",
            boxShadow: activeCategory === "reactflow" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.2s ease",
          }}
        >
          ReactFlow
        </button>
      </div>

      {/* View Buttons */}
      <div
        style={{
          display: "flex",
          gap: "3px",
          padding: "2px",
        }}
      >
        {filteredViews.map((view) => (
          <button
            key={view.id}
            onClick={() => onChangeView(view.id)}
            title={view.description}
            style={{
              padding: "6px 14px",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: currentView === view.id ? "600" : "400",
              background: currentView === view.id ? "#3B82F6" : "transparent",
              color: currentView === view.id ? "white" : "#374151",
              transition: "all 0.2s ease",
              whiteSpace: "nowrap",
            }}
          >
            {view.label}
          </button>
        ))}
      </div>
    </div>
  );
};
