import { useEffect } from "react";

import { usePerformance } from "../hooks/usePerformance";

import { FloatingStats } from "./controls/FloatingStats";

type MetricProps = {
  nodesLength: number;
  edgesLength: number;
};

const Metrics = ({ nodesLength, edgesLength }: MetricProps) => {
  const { metrics, setElementCounts } = usePerformance();

  useEffect(() => {
    setElementCounts(nodesLength, edgesLength);
  }, [edgesLength, nodesLength, setElementCounts]);
  return (
    <FloatingStats
      metrics={metrics}
      position="top-right"
      showFps={true}
      showNodeCount={true}
      showEdgeCount={true}
      showRenderTime={false}
    />
  );
};

export default Metrics;
