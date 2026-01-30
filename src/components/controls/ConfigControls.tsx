import { useState, useCallback } from "react";
import type { GraphConfig } from "../../types";

interface ConfigControlsProps {
  config: GraphConfig;
  onChange: (config: GraphConfig) => void;
}

export const ConfigControls = ({ config, onChange }: ConfigControlsProps) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [isOpen, setIsOpen] = useState(false);

  const handleApply = useCallback(() => {
    onChange(localConfig);
    setIsOpen(false);
  }, [localConfig, onChange]);

  const handleNodeCountChange = useCallback((value: number) => {
    setLocalConfig((prev) => ({ ...prev, nodeCount: value }));
  }, []);

  const handleMaxDepthChange = useCallback((value: number) => {
    setLocalConfig((prev) => ({ ...prev, maxDepth: value }));
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          padding: "8px 16px",
          background: "#3B82F6",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: 500,
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        \u2699\ufe0f Config ({config.nodeCount} nodes, {config.maxDepth} levels)
      </button>
    );
  }

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.98)",
        borderRadius: "12px",
        padding: "20px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
        minWidth: "280px",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "15px" }}>Graph Configuration</span>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: "none",
            border: "none",
            fontSize: "20px",
            cursor: "pointer",
            color: "#666",
          }}
        >
          \u00d7
        </button>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label
          style={{
            display: "block",
            fontSize: "13px",
            fontWeight: 500,
            marginBottom: "6px",
            color: "#374151",
          }}
        >
          Number of Nodes: {localConfig.nodeCount}
        </label>
        <input
          type="range"
          min="10"
          max="500"
          step="10"
          value={localConfig.nodeCount}
          onChange={(e) => handleNodeCountChange(Number(e.target.value))}
          style={{ width: "100%" }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "#6B7280",
            marginTop: "4px",
          }}
        >
          <span>10</span>
          <span>500</span>
        </div>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label
          style={{
            display: "block",
            fontSize: "13px",
            fontWeight: 500,
            marginBottom: "6px",
            color: "#374151",
          }}
        >
          Max Depth (Levels): {localConfig.maxDepth}
        </label>
        <input
          type="range"
          min="2"
          max="6"
          step="1"
          value={localConfig.maxDepth}
          onChange={(e) => handleMaxDepthChange(Number(e.target.value))}
          style={{ width: "100%" }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "#6B7280",
            marginTop: "4px",
          }}
        >
          <span>2</span>
          <span>6</span>
        </div>
      </div>

      <button
        onClick={handleApply}
        style={{
          width: "100%",
          padding: "10px",
          background: "#10B981",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: 600,
        }}
      >
        Apply Changes
      </button>
    </div>
  );
};
