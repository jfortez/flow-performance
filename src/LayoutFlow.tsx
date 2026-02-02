import { useMemo, useEffect, useState, useCallback } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { generateLargeFirstLevel, generateHierarchicalData } from "./utils/dataGenerators";
import { useViewState } from "./hooks/useViewState";
import { useSearch } from "./hooks/useSearch";
import { usePerformance } from "./hooks/usePerformance";

import { ForceView } from "./components/views/ForceView";
import { ConcentricView } from "./components/views/ConcentricView";
import { GridView } from "./components/views/GridView";
import { DagreView } from "./components/views/DagreView";
import { RadialView } from "./components/views/RadialView";
import { GroupedView } from "./components/views/GroupedView";
import { D3CanvasView } from "./components/views/D3CanvasView";
import { D3ClusterView } from "./components/views/D3ClusterView";
import { D3SimpleView } from "./components/views/D3SimpleView";
import { ViewSwitcher } from "./components/controls/ViewSwitcher";
import { SearchBar } from "./components/controls/SearchBar";
import { FloatingStats } from "./components/controls/FloatingStats";
import { ConfigControls } from "./components/controls/ConfigControls";
import { NodeExplorerControl } from "./components/controls/NodeExplorerControl";
import { LocalViewControls } from "./components/controls/LocalViewControls";
import { LocalView } from "./components/views/LocalView";
import type { GraphConfig } from "./types";

function LayoutFlowContent() {
  const [config, setConfig] = useState<GraphConfig>({
    nodeCount: 150,
    maxDepth: 2,
    childrenPerNode: [],
  });

  const [maxVisibleNodes, setMaxVisibleNodes] = useState(150);
  const [neighborLevels, setNeighborLevels] = useState(2);
  const [overviewLayout, setOverviewLayout] = useState<"cluster" | "tree">("cluster");

  const { currentView, setCurrentView } = useViewState("force");

  const { nodes, edges } = useMemo(() => {
    // Use hierarchical data generator for D3 views to support multiple depth levels with children
    if (currentView === "d3canvas" || currentView === "d3cluster" || currentView === "d3simple" || currentView === "local") {
      return generateHierarchicalData(config.nodeCount, config.maxDepth, 3);
    }
    return generateLargeFirstLevel(config.nodeCount);
  }, [config.nodeCount, config.maxDepth, currentView]);

  const { searchTerm, setSearchTerm, searchResults, matchedNodes, hasMatches } = useSearch(nodes);

  const { metrics, setElementCounts } = usePerformance();

  useEffect(() => {
    setElementCounts(nodes.length, edges.length);
  }, [nodes.length, edges.length, setElementCounts]);

  const handleConfigChange = useCallback((newConfig: GraphConfig) => {
    setConfig(newConfig);
  }, []);

  const renderView = useMemo(() => {
    const commonProps = {
      nodes,
      edges,
      searchResults,
    };

    switch (currentView) {
      case "force":
        return <ForceView {...commonProps} />;
      case "concentric":
        return <ConcentricView {...commonProps} />;
      case "grid":
        return <GridView {...commonProps} />;
      case "dagre":
        return <DagreView {...commonProps} />;
      case "radial":
        return <RadialView {...commonProps} />;
      case "grouped":
        return <GroupedView {...commonProps} />;
      case "d3canvas":
        return <D3CanvasView {...commonProps} maxVisibleNodes={maxVisibleNodes} />;
      case "d3cluster":
        return <D3ClusterView {...commonProps} maxVisibleNodes={maxVisibleNodes} />;
      case "d3simple":
        return <D3SimpleView {...commonProps} />;
      case "local":
        return <LocalView {...commonProps} neighborLevels={neighborLevels} overviewLayout={overviewLayout} />;
      default:
        return <ForceView {...commonProps} />;
    }
  }, [currentView, nodes, edges, searchResults, maxVisibleNodes, neighborLevels, overviewLayout]);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {/* Top Controls */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 16,
          zIndex: 10,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        {/* Center: View Switcher */}
        <div style={{ pointerEvents: "auto" }}>
          <ViewSwitcher currentView={currentView} onChangeView={setCurrentView} />
        </div>
      </div>

      {/* Left Sidebar: Controls */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          pointerEvents: "auto",
          maxWidth: "280px",
        }}
      >
        <ConfigControls config={config} onChange={handleConfigChange} />
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          resultCount={hasMatches ? matchedNodes.length : undefined}
        />
        {(currentView === "d3canvas" || currentView === "d3cluster") && (
          <NodeExplorerControl
            value={maxVisibleNodes}
            maxValue={config.nodeCount}
            onChange={setMaxVisibleNodes}
          />
        )}
        {currentView === "local" && (
          <LocalViewControls
            neighborLevels={neighborLevels}
            onChangeNeighborLevels={setNeighborLevels}
            overviewLayout={overviewLayout}
            onChangeOverviewLayout={setOverviewLayout}
          />
        )}
      </div>

      {/* Right: FPS Stats */}
      <FloatingStats
        metrics={metrics}
        position="top-right"
        showFps={true}
        showNodeCount={true}
        showEdgeCount={true}
        showRenderTime={false}
      />

      {/* Main View Area */}
      <div style={{ width: "100%", height: "100%" }}>{renderView}</div>
    </div>
  );
}

export default function LayoutFlow() {
  return (
    <ReactFlowProvider>
      <LayoutFlowContent />
    </ReactFlowProvider>
  );
}
