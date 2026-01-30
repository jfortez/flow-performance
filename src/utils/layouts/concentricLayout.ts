import type { Edge, Position } from "@xyflow/react";
import type { CustomNode } from "../../types";

interface ConcentricLayoutOptions {
  centerX?: number;
  centerY?: number;
  ringSpacing?: number;
  startAngle?: number;
}

export const getConcentricLayout = (
  nodes: CustomNode[],
  edges: Edge[],
  options: ConcentricLayoutOptions = {}
): { nodes: CustomNode[]; edges: Edge[] } => {
  const {
    centerX = 1500,
    centerY = 1000,
    ringSpacing = 500,
    startAngle = -Math.PI / 2, // Start from top
  } = options;

  // Group by level
  const nodesByLevel = new Map<number, CustomNode[]>();
  nodes.forEach((node) => {
    const level = node.data.metadata.level;
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level)!.push(node);
  });

  const layoutedNodes: CustomNode[] = [];

  nodesByLevel.forEach((levelNodes, level) => {
    const radius = level * ringSpacing;
    const angleStep = (2 * Math.PI) / Math.max(levelNodes.length, 1);

    levelNodes.forEach((node, index) => {
      const angle = startAngle + angleStep * index;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      // Calculate position handles based on angle
      const degrees = ((angle * 180) / Math.PI + 360) % 360;
      let sourcePosition: Position;
      let targetPosition: Position;

      if (degrees >= 45 && degrees < 135) {
        sourcePosition = "bottom" as Position;
        targetPosition = "top" as Position;
      } else if (degrees >= 135 && degrees < 225) {
        sourcePosition = "left" as Position;
        targetPosition = "right" as Position;
      } else if (degrees >= 225 && degrees < 315) {
        sourcePosition = "top" as Position;
        targetPosition = "bottom" as Position;
      } else {
        sourcePosition = "right" as Position;
        targetPosition = "left" as Position;
      }

      layoutedNodes.push({
        ...node,
        position: { x, y },
        sourcePosition,
        targetPosition,
      });
    });
  });

  return { nodes: layoutedNodes, edges };
};
