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
import { D3SimpleView } from "./components/views/D3SimpleView";
import { ViewSwitcher } from "./components/controls/ViewSwitcher";
import { UnifiedControls, BottomSearchBar } from "./components/controls/UnifiedControls";
import { NodeExplorerControl } from "./components/controls/NodeExplorerControl";
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
  });

  const [maxVisibleNodes, setMaxVisibleNodes] = useState(150);
  const [neighborLevels, setNeighborLevels] = useState(2);
  const [overviewLayout, setOverviewLayout] = useState<"cluster" | "tree">("cluster");

  const { currentView, setCurrentView } = useViewState("d3simple");

  const { nodes, edges } = useMemo(() => {
    if (
      currentView === "d3canvas" ||
      currentView === "d3cluster" ||
      currentView === "d3simple" ||
      currentView === "local"
    ) {
      return generateHierarchicalData(config.nodeCount, config.maxDepth, 3);
    }
    return generateLargeFirstLevel(config.nodeCount);
  }, [config.nodeCount, config.maxDepth, currentView]);

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
        return <D3CanvasView {...commonProps} maxVisibleNodes={maxVisibleNodes} />;
      case "d3cluster":
        return <D3ClusterView {...commonProps} maxVisibleNodes={maxVisibleNodes} />;
      case "d3simple":
        return <D3SimpleView {...commonProps} />;
      case "local":
        return (
          <LocalView
            {...commonProps}
            neighborLevels={neighborLevels}
            overviewLayout={overviewLayout}
          />
        );
      default:
        return <ForceView {...commonProps} />;
    }
  }, [currentView, nodes, edges, searchResults, maxVisibleNodes, neighborLevels, overviewLayout]);

  return (
    <div className={styles.layoutContainer}>
      {/* Navegación superior centrada */}
      <div className={styles.navContainer}>
        <ViewSwitcher currentView={currentView} onChangeView={setCurrentView} />
      </div>

      {/* Panel izquierdo - Configuración */}
      <div className={styles.leftPanel}>
        <UnifiedControls config={config} onConfigChange={handleConfigChange} />
        
        {/* Controles específicos de vista */}
        {(currentView === "d3canvas" || currentView === "d3cluster") && (
          <div className={styles.viewControls}>
            <NodeExplorerControl
              value={maxVisibleNodes}
              maxValue={config.nodeCount}
              onChange={setMaxVisibleNodes}
            />
          </div>
        )}
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
