import { useState, useEffect, useCallback } from "react";
import type { GraphConfig } from "../../types";

interface UnifiedControlsProps {
  config: GraphConfig;
  onConfigChange: (config: GraphConfig) => void;
}

export const UnifiedControls = ({
  config,
  onConfigChange,
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
    <div
      style={{
        position: "absolute",
        top: 80,
        left: 16,
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        pointerEvents: "auto",
      }}
    >
      {/* Main Controls Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 14px",
          background: "rgba(255, 255, 255, 0.95)",
          border: "none",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: 500,
          color: "#374151",
          transition: "all 0.2s ease",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 6.34L2.1 2.1m17.8 17.8l-4.24-4.24M6.34 17.66l-4.24 4.24M23 12h-6m-6 0H1m20.24-4.24l-4.24 4.24M6.34 6.34l-4.24-4.24" />
        </svg>
        Config ({config.nodeCount} nodes, {config.maxDepth} levels)
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded Controls Panel */}
      {isExpanded && (
        <div
          style={{
            padding: "16px",
            background: "rgba(255, 255, 255, 0.98)",
            borderRadius: "12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            minWidth: "260px",
            maxWidth: "300px",
          }}
        >
          {/* Node Count */}
          <div>
            <label
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "6px",
              }}
            >
              <span>Total Nodes</span>
              <span style={{ color: "#3B82F6" }}>{config.nodeCount}</span>
            </label>
            <input
              type="range"
              min="10"
              max="500"
              step="10"
              value={config.nodeCount}
              onChange={(e) => handleNodeCountChange(Number(e.target.value))}
              style={{
                width: "100%",
                height: "6px",
                borderRadius: "3px",
                background: "#E5E7EB",
                outline: "none",
                cursor: "pointer",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "10px",
                color: "#9CA3AF",
                marginTop: "4px",
              }}
            >
              <span>10</span>
              <span>500</span>
            </div>
          </div>

          {/* Max Depth */}
          <div>
            <label
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "6px",
              }}
            >
              <span>Depth Levels</span>
              <span style={{ color: "#3B82F6" }}>{config.maxDepth}</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={config.maxDepth}
              onChange={(e) => handleMaxDepthChange(Number(e.target.value))}
              style={{
                width: "100%",
                height: "6px",
                borderRadius: "3px",
                background: "#E5E7EB",
                outline: "none",
                cursor: "pointer",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "10px",
                color: "#9CA3AF",
                marginTop: "4px",
              }}
            >
              <span>1</span>
              <span>10</span>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <label
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#6B7280",
                marginBottom: "8px",
                display: "block",
              }}
            >
              Quick Presets
            </label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {[
                { nodes: 50, depth: 3, label: "Small" },
                { nodes: 150, depth: 4, label: "Medium" },
                { nodes: 300, depth: 5, label: "Large" },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() =>
                    onConfigChange({
                      ...config,
                      nodeCount: preset.nodes,
                      maxDepth: preset.depth,
                    })
                  }
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    border: "1px solid #E5E7EB",
                    borderRadius: "4px",
                    background:
                      config.nodeCount === preset.nodes &&
                      config.maxDepth === preset.depth
                        ? "#3B82F6"
                        : "white",
                    color:
                      config.nodeCount === preset.nodes &&
                      config.maxDepth === preset.depth
                        ? "white"
                        : "#374151",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
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
    <div
      style={{
        position: "absolute",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10,
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 16px",
          background: "rgba(255, 255, 255, 0.98)",
          borderRadius: "12px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          minWidth: "400px",
          maxWidth: "600px",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ color: "#6B7280", flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          id="unified-search-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search nodes... (Ctrl+K)"
          style={{
            border: "none",
            background: "transparent",
            outline: "none",
            fontSize: "15px",
            color: "#374151",
            width: "100%",
          }}
        />
        {value && (
          <button
            onClick={() => onChange("")}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: "4px",
              color: "#6B7280",
              fontSize: "14px",
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            &#10005;
          </button>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "4px 8px",
            background: "#F3F4F6",
            borderRadius: "6px",
            fontSize: "12px",
            color: "#6B7280",
            fontWeight: 500,
          }}
        >
          <span>Ctrl</span>
          <span style={{ fontSize: "10px" }}>+</span>
          <span>K</span>
        </div>
        {resultCount !== undefined && value && (
          <span
            style={{
              fontSize: "13px",
              color: resultCount > 0 ? "#10B981" : "#EF4444",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {resultCount} found
          </span>
        )}
      </div>
    </div>
  );
};
