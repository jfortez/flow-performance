import { useState, useCallback } from "react";
import type { ViewType } from "../types";

export const useViewState = (defaultView: ViewType = "force") => {
  const [currentView, setCurrentView] = useState<ViewType>(defaultView);
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set(["root"]));

  const toggleCluster = useCallback((clusterId: string) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  }, []);

  const expandCluster = useCallback((clusterId: string) => {
    setExpandedClusters((prev) => new Set([...prev, clusterId]));
  }, []);

  const collapseCluster = useCallback((clusterId: string) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      next.delete(clusterId);
      return next;
    });
  }, []);

  const isExpanded = useCallback(
    (clusterId: string) => expandedClusters.has(clusterId),
    [expandedClusters]
  );

  return {
    currentView,
    setCurrentView,
    expandedClusters,
    toggleCluster,
    expandCluster,
    collapseCluster,
    isExpanded,
  };
};
