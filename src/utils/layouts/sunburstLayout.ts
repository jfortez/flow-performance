import type { Edge, Position } from "@xyflow/react";
import type { CustomNode } from "../../types";

interface SunburstLayoutOptions {
  centerX?: number;
  centerY?: number;
  innerRadius?: number;
  ringWidth?: number;
  paddingAngle?: number;
}

export const getSunburstLayout = (
  nodes: CustomNode[],
  edges: Edge[],
  options: SunburstLayoutOptions = {}
): { nodes: CustomNode[]; edges: Edge[] } => {
  const {
    centerX = 1500,
    centerY = 1000,
    innerRadius = 200,
    ringWidth = 400,
    paddingAngle = 0.02,
  } = options;

  // Build tree structure
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const childrenMap = new Map<string, string[]>();
  
  edges.forEach(edge => {
    if (!childrenMap.has(edge.source)) {
      childrenMap.set(edge.source, []);
    }
    childrenMap.get(edge.source)!.push(edge.target);
  });

  // Calculate angles using partition layout logic
  const layoutedNodes: CustomNode[] = [];
  
  const layoutNode = (
    nodeId: string,
    startAngle: number,
    endAngle: number,
    level: number
  ) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    const children = childrenMap.get(nodeId) || [];
    const angleRange = endAngle - startAngle;
    const availableAngle = angleRange - (children.length * paddingAngle);
    const anglePerChild = children.length > 0 ? availableAngle / children.length : 0;

    // Position current node
    const midAngle = startAngle + angleRange / 2;
    const radius = innerRadius + level * ringWidth;
    const x = centerX + radius * Math.cos(midAngle);
    const y = centerY + radius * Math.sin(midAngle);

    // Determine handle positions based on angle
    const degrees = (midAngle * 180 / Math.PI + 360) % 360;
    let sourcePosition: Position = "bottom" as Position;
    let targetPosition: Position = "top" as Position;

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

    // Layout children
    let currentAngle = startAngle;
    children.forEach((childId) => {
      const childEndAngle = currentAngle + anglePerChild + paddingAngle;
      layoutNode(childId, currentAngle, childEndAngle, level + 1);
      currentAngle = childEndAngle;
    });
  };

  // Start from root
  const rootNode = nodes.find(n => n.data.metadata.level === 0);
  if (rootNode) {
    layoutNode(rootNode.id, 0, 2 * Math.PI, 0);
  }

  return { nodes: layoutedNodes, edges };
};
