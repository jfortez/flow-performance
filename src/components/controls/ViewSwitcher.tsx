import type { ViewType } from "../../types";

interface ViewSwitcherProps {
  currentView: ViewType;
  onChangeView: (view: ViewType) => void;
}

const views: { id: ViewType; label: string; description: string }[] = [
  { id: "d3canvas", label: "D3 Canvas", description: "Canvas rendering with node limiting (PERFORMANCE)" },
  { id: "d3cluster", label: "D3 Cluster", description: "D3 hierarchy cluster layout" },
  { id: "local", label: "Local View", description: "Focus+context with overview and detail panels" },
  { id: "force", label: "Force", description: "Force-directed layout" },
  { id: "grouped", label: "Grouped", description: "Agrupación progresiva" },
  { id: "dagre", label: "Dagre", description: "Hierarchical layout" },
  { id: "radial", label: "Radial", description: "Radial layout" },
  { id: "concentric", label: "Concentric", description: "Circular rings" },
  { id: "grid", label: "Grid", description: "Grid layout" },
];

export const ViewSwitcher = ({ currentView, onChangeView }: ViewSwitcherProps) => {
  return (
    <div
      style={{
        display: "flex",
        gap: "4px",
        padding: "4px",
        background: "rgba(255, 255, 255, 0.95)",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        flexWrap: "wrap",
        maxWidth: "600px",
        justifyContent: "center",
      }}
    >
      {views.map((view) => (
        <button
          key={view.id}
          onClick={() => onChangeView(view.id)}
          title={view.description}
          style={{
            padding: "6px 12px",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: currentView === view.id ? "600" : "400",
            background: currentView === view.id ? "#3B82F6" : "transparent",
            color: currentView === view.id ? "white" : "#374151",
            transition: "all 0.2s ease",
          }}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
};
