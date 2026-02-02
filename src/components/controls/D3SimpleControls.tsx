import "react";
import styles from "./D3SimpleControls.module.css";

export type LayoutMode = "concentric" | "progressive" | "hierarchical";
export type CollisionMode = "full" | "minimal" | "none";

interface D3SimpleControlsProps {
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
  collisionMode: CollisionMode;
  onCollisionModeChange: (mode: CollisionMode) => void;
}

export const D3SimpleControls = ({
  layoutMode,
  onLayoutModeChange,
  collisionMode,
  onCollisionModeChange,
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
