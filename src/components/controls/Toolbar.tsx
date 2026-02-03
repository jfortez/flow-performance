import "react";
import styles from "./Toolbar.module.css";

interface ToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onToggleOverview: () => void;
  isOverviewOpen: boolean;
  allowNodeDrag?: boolean;
  onToggleNodeDrag?: () => void;
}

export const Toolbar = ({
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onToggleOverview,
  isOverviewOpen,
  allowNodeDrag = true,
  onToggleNodeDrag,
}: ToolbarProps) => {
  return (
    <div className={styles.toolbar}>
      <button
        className={styles.button}
        onClick={onZoomIn}
        title="Zoom In"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>
      
      <button
        className={styles.button}
        onClick={onZoomOut}
        title="Zoom Out"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>
      
      <button
        className={styles.button}
        onClick={onZoomFit}
        title="Fit to Screen"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
      </button>
      
      <div className={styles.divider} />

      <button
        className={`${styles.button} ${allowNodeDrag ? styles.active : ""}`}
        onClick={onToggleNodeDrag}
        title="Allow Node Drag"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" strokeLinecap="round" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      </button>

      <div className={styles.divider} />

      <button
        className={`${styles.button} ${isOverviewOpen ? styles.active : ""}`}
        onClick={onToggleOverview}
        title="Toggle Overview"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <rect x="7" y="7" width="3" height="3" />
          <rect x="14" y="7" width="3" height="3" />
          <rect x="7" y="14" width="3" height="3" />
          <rect x="14" y="14" width="3" height="3" />
        </svg>
      </button>
    </div>
  );
};
