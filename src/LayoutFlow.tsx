import { useMemo, useState, useCallback } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { generateLargeFirstLevel, generateHierarchicalData } from "./utils/dataGenerators";
import { useViewState } from "./hooks/useViewState";
import { useSearch } from "./hooks/useSearch";

import { ForceView } from "./components/views/ForceView";
import { ConcentricView } from "./components/views/ConcentricView";
import { GridView } from "./components/views/GridView";
import { DagreView } from "./components/views/DagreView";
import { RadialView } from "./components/views/RadialView";
import { D3CanvasView } from "./components/views/D3CanvasView";
import { D3ClusterView } from "./components/views/D3ClusterView";
import { D3SimpleView, type LayoutMode, type CollisionMode } from "./components/views/D3SimpleView";
import { TreeView } from "./components/views/TreeView";
import { GoJSView } from "./components/views/GoJSView";
import { ViewSwitcher } from "./components/controls/ViewSwitcher";
import { UnifiedControls, BottomSearchBar } from "./components/controls/UnifiedControls";
import { D3SimpleControls } from "./components/controls/D3SimpleControls";

import { LocalViewControls } from "./components/controls/LocalViewControls";
import { LocalView } from "./components/views/LocalView";
import { Metrics } from "./components/Metrics";
import type { GraphConfig } from "./types";
import styles from "./LayoutFlow.module.css";

function LayoutFlowContent() {
  const [config, setConfig] = useState<GraphConfig>({
    nodeCount: 150,
    maxDepth: 2,
    childrenPerNode: [],
    minChildrenPerNode: 3,
    maxChildrenPerNode: 5,
    targetFirstLevel: 25,
  });

  const [neighborLevels, setNeighborLevels] = useState(2);
  const [overviewLayout, setOverviewLayout] = useState<"cluster" | "tree">("cluster");

  // D3SimpleView specific controls
  const [d3LayoutMode, setD3LayoutMode] = useState<LayoutMode>("concentric");
  const [d3CollisionMode, setD3CollisionMode] = useState<CollisionMode>("full");
  const [d3ShowLevelLabels, setD3ShowLevelLabels] = useState(false);
  const [d3ShowChildCount, setD3ShowChildCount] = useState(false);
  const [d3ShowTooltipOnHover, setD3ShowTooltipOnHover] = useState(false);

  const { currentView, setCurrentView } = useViewState("d3simple");

  const { nodes, edges } = useMemo(() => {
    if (
      currentView === "d3canvas" ||
      currentView === "d3cluster" ||
      currentView === "d3simple" ||
      currentView === "local" ||
      currentView === "tree" ||
      currentView === "gojs"
    ) {
      return generateHierarchicalData(
        config.nodeCount,
        config.maxDepth,
        config.minChildrenPerNode,
        config.maxChildrenPerNode,
        config.targetFirstLevel,
      );
    }
    return generateLargeFirstLevel(config.nodeCount);
  }, [config, currentView]);

  const { searchTerm, setSearchTerm, searchResults, matchedNodes, hasMatches } = useSearch(nodes);

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
      case "d3canvas":
        return <D3CanvasView {...commonProps} maxVisibleNodes={config.nodeCount} />;
      case "d3cluster":
        return <D3ClusterView {...commonProps} maxVisibleNodes={config.nodeCount} />;
      case "d3simple":
        return (
          <D3SimpleView
            {...commonProps}
            layoutMode={d3LayoutMode}
            collisionMode={d3CollisionMode}
            showLevelLabels={d3ShowLevelLabels}
            showChildCount={d3ShowChildCount}
            showTooltipOnHover={d3ShowTooltipOnHover}
          />
        );
      case "local":
        return (
          <LocalView
            {...commonProps}
            neighborLevels={neighborLevels}
            overviewLayout={overviewLayout}
          />
        );
      case "tree":
        return <TreeView {...commonProps} maxVisibleNodes={config.nodeCount} />;
      case "gojs":
        return <GoJSView {...commonProps} />;
      default:
        return <ForceView {...commonProps} />;
    }
  }, [
    currentView,
    nodes,
    edges,
    searchResults,
    config.nodeCount,
    neighborLevels,
    overviewLayout,
    d3LayoutMode,
    d3CollisionMode,
    d3ShowLevelLabels,
    d3ShowChildCount,
    d3ShowTooltipOnHover,
  ]);

  return (
    <div className={styles.layoutContainer}>
      {/* Navegación superior centrada */}
      <div className={styles.navContainer}>
        <ViewSwitcher currentView={currentView} onChangeView={setCurrentView} />
      </div>

      {/* Panel izquierdo - Configuración */}
      <div className={styles.leftPanel}>
        <UnifiedControls
          config={config}
          onConfigChange={handleConfigChange}
          renderViewControls={() => (
            <>
              {currentView === "local" && (
                <div className={styles.viewControls}>
                  <LocalViewControls
                    neighborLevels={neighborLevels}
                    onChangeNeighborLevels={setNeighborLevels}
                    overviewLayout={overviewLayout}
                    onChangeOverviewLayout={setOverviewLayout}
                  />
                </div>
              )}
              {currentView === "d3simple" && (
                <div className={styles.viewControls}>
                  <D3SimpleControls
                    layoutMode={d3LayoutMode}
                    onLayoutModeChange={setD3LayoutMode}
                    collisionMode={d3CollisionMode}
                    onCollisionModeChange={setD3CollisionMode}
                    showLevelLabels={d3ShowLevelLabels}
                    onShowLevelLabelsChange={setD3ShowLevelLabels}
                    showChildCount={d3ShowChildCount}
                    onShowChildCountChange={setD3ShowChildCount}
                    showTooltipOnHover={d3ShowTooltipOnHover}
                    onShowTooltipOnHoverChange={setD3ShowTooltipOnHover}
                  />
                </div>
              )}
            </>
          )}
        />
      </div>

      {/* Panel derecho - Métricas */}
      <Metrics nodesLength={nodes.length} edgesLength={edges.length} />

      {/* Barra de búsqueda inferior centrada */}
      <BottomSearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        resultCount={hasMatches ? matchedNodes.length : undefined}
      />

      {/* Área principal del grafo */}
      <div className={styles.graphArea}>{renderView}</div>
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
