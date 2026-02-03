import "react";
import styles from "./D3SimpleControls.module.css";

export type LayoutMode = "concentric" | "progressive" | "hierarchical" | "radial-tree" | "cluster";
export type CollisionMode = "full" | "minimal" | "none";

interface D3SimpleControlsProps {
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
  collisionMode: CollisionMode;
  onCollisionModeChange: (mode: CollisionMode) => void;
  showLevelLabels?: boolean;
  onShowLevelLabelsChange?: (show: boolean) => void;
  showChildCount?: boolean;
  onShowChildCountChange?: (show: boolean) => void;
}

export const D3SimpleControls = ({
  layoutMode,
  onLayoutModeChange,
  collisionMode,
  onCollisionModeChange,
  showLevelLabels = false,
  onShowLevelLabelsChange,
  showChildCount = false,
  onShowChildCountChange,
}: D3SimpleControlsProps) => {
  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Layout Mode</span>
          <div className={styles.buttonGroup}>
            {[
              { id: "concentric", label: "Concentric" },
              { id: "progressive", label: "Progressive" },
              { id: "hierarchical", label: "Tree" },
              { id: "radial-tree", label: "Radial" },
              { id: "cluster", label: "Cluster" },
            ].map((mode) => (
              <button
                key={mode.id}
                className={`${styles.button} ${
                  layoutMode === mode.id ? styles.active : ""
                }`}
                onClick={() => onLayoutModeChange(mode.id as LayoutMode)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.section}>
          <span className={styles.sectionLabel}>Display</span>
          <div className={styles.checkboxGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showLevelLabels}
                onChange={(e) => onShowLevelLabelsChange?.(e.target.checked)}
                className={styles.checkbox}
              />
              <span>Show Level Labels</span>
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showChildCount}
                onChange={(e) => onShowChildCountChange?.(e.target.checked)}
                className={styles.checkbox}
              />
              <span>Show Child Count</span>
            </label>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.section}>
          <span className={styles.sectionLabel}>Collision</span>
          <div className={styles.buttonGroup}>
            {[
              { id: "full", label: "Full" },
              { id: "minimal", label: "Minimal" },
              { id: "none", label: "None" },
            ].map((mode) => (
              <button
                key={mode.id}
                className={`${styles.button} ${
                  collisionMode === mode.id ? styles.active : ""
                }`}
                onClick={() => onCollisionModeChange(mode.id as CollisionMode)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
