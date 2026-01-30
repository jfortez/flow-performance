import type { Edge } from "@xyflow/react";
import type { CustomNode } from "../../types";

interface CircularClusterOptions {
  centerX?: number;
  centerY?: number;
  clusterRadius?: number;
  nodeSpacing?: number;
}

export const getCircularClusterLayout = (
  nodes: CustomNode[],
  edges: Edge[],
  options: CircularClusterOptions = {}
): { nodes: CustomNode[]; edges: Edge[] } => {
  const {
    centerX = 0,
    centerY = 0,
    clusterRadius = 300,
    nodeSpacing = 40,
  } = options;

  // Group nodes by their parent (cluster)
  const clusters = new Map<string, CustomNode[]>();
  const rootNodes: CustomNode[] = [];

  nodes.forEach((node) => {
    if (node.data.metadata.level === 0) {
      rootNodes.push(node);
    } else {
      // Find parent cluster
      const parentEdge = edges.find((e) => e.target === node.id);
      if (parentEdge) {
        if (!clusters.has(parentEdge.source)) {
          clusters.set(parentEdge.source, []);
        }
        clusters.get(parentEdge.source)!.push(node);
      }
    }
  });

  const layoutedNodes: CustomNode[] = [];

  // Position root node at center
  rootNodes.forEach((root) => {
    layoutedNodes.push({
      ...root,
      position: { x: centerX, y: centerY },
    });
  });

  // Arrange clusters in a circle around the center
  const clusterArray = Array.from(clusters.entries());
  const angleStep = (2 * Math.PI) / Math.max(clusterArray.length, 1);

  clusterArray.forEach(([, clusterNodes], clusterIndex) => {
    const clusterAngle = clusterIndex * angleStep - Math.PI / 2; // Start from top
    const clusterCenterX = centerX + clusterRadius * Math.cos(clusterAngle);
    const clusterCenterY = centerY + clusterRadius * Math.sin(clusterAngle);

    // Position nodes in a small circle within each cluster
    const nodesPerCluster = clusterNodes.length;
    const clusterNodeAngleStep = (2 * Math.PI) / Math.max(nodesPerCluster, 1);
    const innerRadius = nodeSpacing;

    clusterNodes.forEach((node, nodeIndex) => {
      // Position in a small circle around cluster center
      const nodeAngle = nodeIndex * clusterNodeAngleStep;
      const ring = Math.floor(nodeIndex / 10);
      const radius = innerRadius + (ring * nodeSpacing * 0.6);
      
      const x = clusterCenterX + radius * Math.cos(nodeAngle);
      const y = clusterCenterY + radius * Math.sin(nodeAngle);

      layoutedNodes.push({
        ...node,
        position: { x, y },
      });
    });
  });

  return { nodes: layoutedNodes, edges };
};
