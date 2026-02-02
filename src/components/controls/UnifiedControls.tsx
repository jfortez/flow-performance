import { useState, useEffect, useCallback } from "react";
import type { GraphConfig } from "../../types";
import styles from "./UnifiedControls.module.css";

interface UnifiedControlsProps {
  config: GraphConfig;
  onConfigChange: (config: GraphConfig) => void;
  renderViewControls?: () => React.ReactNode;
}

export const UnifiedControls = ({
  config,
  onConfigChange,
  renderViewControls,
}: UnifiedControlsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Handle Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const searchInput = document.getElementById("unified-search-input");
        searchInput?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleNodeCountChange = useCallback(
    (value: number) => {
      onConfigChange({ ...config, nodeCount: value });
    },
    [config, onConfigChange]
  );

  const handleMaxDepthChange = useCallback(
    (value: number) => {
      onConfigChange({ ...config, maxDepth: value });
    },
    [config, onConfigChange]
  );

  return (
    <div className={styles.container}>
      <button
        className={styles.configButton}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 6.34L2.1 2.1m17.8 17.8l-4.24-4.24M6.34 17.66l-4.24 4.24M23 12h-6m-6 0H1m20.24-4.24l-4.24 4.24M6.34 6.34l-4.24-4.24" />
        </svg>
        Config ({config.nodeCount} nodes, {config.maxDepth} levels)
        <svg className={`${styles.arrow} ${isExpanded ? styles.arrowExpanded : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isExpanded && (
        <div className={styles.panel}>
          <div className={styles.sliderControl}>
            <div className={styles.sliderHeader}>
              <span className={styles.sliderLabel}>Total Nodes</span>
              <span className={styles.sliderValue}>{config.nodeCount}</span>
            </div>
            <input
              type="range"
              min="10"
              max="500"
              step="10"
              value={config.nodeCount}
              onChange={(e) => handleNodeCountChange(Number(e.target.value))}
              className={styles.sliderInput}
            />
            <div className={styles.sliderRange}>
              <span>10</span>
              <span>500</span>
            </div>
          </div>

          <div className={styles.sliderControl}>
            <div className={styles.sliderHeader}>
              <span className={styles.sliderLabel}>Depth Levels</span>
              <span className={styles.sliderValue}>{config.maxDepth}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={config.maxDepth}
              onChange={(e) => handleMaxDepthChange(Number(e.target.value))}
              className={styles.sliderInput}
            />
            <div className={styles.sliderRange}>
              <span>1</span>
              <span>10</span>
            </div>
          </div>

          <div className={styles.presetsSection}>
            <span className={styles.presetsLabel}>Quick Presets</span>
            <div className={styles.presetsGrid}>
              {[
                { nodes: 50, depth: 3, label: "Small" },
                { nodes: 150, depth: 4, label: "Medium" },
                { nodes: 300, depth: 5, label: "Large" },
              ].map((preset) => (
                <button
                  key={preset.label}
                  className={`${styles.presetButton} ${
                    config.nodeCount === preset.nodes && config.maxDepth === preset.depth
                      ? styles.presetButtonActive
                      : ""
                  }`}
                  onClick={() =>
                    onConfigChange({
                      ...config,
                      nodeCount: preset.nodes,
                      maxDepth: preset.depth,
                    })
                  }
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {!isExpanded && renderViewControls && (
        <div className={styles.viewControlsContainer}>
          {renderViewControls()}
        </div>
      )}
    </div>
  );
};

// Bottom Search Bar Component
interface BottomSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount?: number;
}

export const BottomSearchBar = ({
  value,
  onChange,
  resultCount,
}: BottomSearchBarProps) => {
  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchWrapper}>
        <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          id="unified-search-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search nodes... (Ctrl+K)"
          className={styles.searchInput}
        />
        {value && (
          <button className={styles.searchClear} onClick={() => onChange("")}>
            &#10005;
          </button>
        )}
        <div className={styles.searchShortcut}>
          <span>Ctrl</span>
          <span>+</span>
          <span>K</span>
        </div>
        {resultCount !== undefined && value && (
          <span
            className={`${styles.searchResults} ${
              resultCount > 0 ? styles.searchResultsFound : styles.searchResultsNotFound
            }`}
          >
            {resultCount} found
          </span>
        )}
      </div>
    </div>
  );
};
