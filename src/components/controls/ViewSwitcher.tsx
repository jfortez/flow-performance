import { useState } from "react";
import type { ViewType } from "../../types";
import styles from "./ViewSwitcher.module.css";

interface ViewSwitcherProps {
  currentView: ViewType;
  onChangeView: (view: ViewType) => void;
}

const views: { id: ViewType; label: string; description: string; category: "d3" | "reactflow" | "explorer" }[] = [
  { id: "d3simple", label: "D3 Simple", description: "Simple d3-force layout", category: "d3" },
  { id: "d3canvas", label: "D3 Canvas", description: "Canvas rendering with limits", category: "d3" },
  { id: "d3cluster", label: "D3 Cluster", description: "D3 hierarchy cluster", category: "d3" },
  { id: "local", label: "Local", description: "Focus+context view", category: "d3" },
  { id: "force", label: "Force", description: "Force-directed layout", category: "reactflow" },
  { id: "dagre", label: "Dagre", description: "Hierarchical layout", category: "reactflow" },
  { id: "radial", label: "Radial", description: "Radial layout", category: "reactflow" },
  { id: "concentric", label: "Concentric", description: "Circular rings", category: "reactflow" },
  { id: "grid", label: "Grid", description: "Grid layout", category: "reactflow" },
  { id: "tree", label: "Hierarchy", description: "Hierarchical tree explorer", category: "explorer" },
];

export const ViewSwitcher = ({ currentView, onChangeView }: ViewSwitcherProps) => {
  const [activeCategory, setActiveCategory] = useState<"d3" | "reactflow" | "explorer">("d3");

  const filteredViews = views.filter((view) => view.category === activeCategory);

  return (
    <div className={styles.viewSwitcher}>
      <div className={styles.categoryTabs}>
        <button
          className={`${styles.categoryTab} ${activeCategory === "d3" ? styles.active : ""}`}
          onClick={() => setActiveCategory("d3")}
        >
          D3 Views
        </button>
        <button
          className={`${styles.categoryTab} ${activeCategory === "reactflow" ? styles.active : ""}`}
          onClick={() => setActiveCategory("reactflow")}
        >
          ReactFlow
        </button>
        <button
          className={`${styles.categoryTab} ${activeCategory === "explorer" ? styles.active : ""}`}
          onClick={() => setActiveCategory("explorer")}
        >
          Explorer
        </button>
      </div>

      <div className={styles.viewButtons}>
        {filteredViews.map((view) => (
          <button
            key={view.id}
            className={`${styles.viewButton} ${currentView === view.id ? styles.active : ""}`}
            onClick={() => onChangeView(view.id)}
            title={view.description}
          >
            {view.label}
          </button>
        ))}
      </div>
    </div>
  );
};
