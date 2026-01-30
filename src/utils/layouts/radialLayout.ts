import type { Edge, Position } from "@xyflow/react";
import type { CustomNode } from "../../types";

interface RadialLayoutOptions {
  centerX?: number;
  centerY?: number;
  radiusStep?: number;
  startAngle?: number;
  endAngle?: number;
}

export const getRadialLayout = (
  nodes: CustomNode[],
  edges: Edge[],
  options: RadialLayoutOptions = {}
): { nodes: CustomNode[]; edges: Edge[] } => {
  const {
    centerX = 1500,
    centerY = 1000,
    radiusStep = 450,
    startAngle = 0,
    endAngle = 2 * Math.PI,
  } = options;

  // Group nodes by level
  const nodesByLevel = new Map<number, CustomNode[]>();
  nodes.forEach((node) => {
    const level = node.data.metadata.level;
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level)!.push(node);
  });

  const layoutedNodes: CustomNode[] = [];

  // Calculate positions
  nodesByLevel.forEach((levelNodes, level) => {
    const radius = level * radiusStep;
    const angleStep = (endAngle - startAngle) / Math.max(levelNodes.length, 1);

    levelNodes.forEach((node, index) => {
      const angle = startAngle + angleStep * index;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      // Calculate angle to center for source/target positioning
      const angleToCenter = Math.atan2(centerY - y, centerX - x);
      const normalizedAngle = ((angleToCenter * 180) / Math.PI + 360) % 360;

      let sourcePosition: Position;
      let targetPosition: Position;

      if (normalizedAngle >= 45 && normalizedAngle < 135) {
        sourcePosition = "bottom" as Position;
        targetPosition = "top" as Position;
      } else if (normalizedAngle >= 135 && normalizedAngle < 225) {
        sourcePosition = "left" as Position;
        targetPosition = "right" as Position;
      } else if (normalizedAngle >= 225 && normalizedAngle < 315) {
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
