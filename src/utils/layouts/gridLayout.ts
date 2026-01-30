import type { Edge } from "@xyflow/react";
import type { CustomNode } from "../../types";

interface GridLayoutOptions {
  columns?: number;
  cellWidth?: number;
  cellHeight?: number;
  gapX?: number;
  gapY?: number;
  startX?: number;
  startY?: number;
}

export const getGridLayout = (
  nodes: CustomNode[],
  edges: Edge[],
  options: GridLayoutOptions = {}
): { nodes: CustomNode[]; edges: Edge[] } => {
  const {
    columns = 8,
    cellWidth = 180,
    cellHeight = 100,
    gapX = 100,
    gapY = 120,
    startX = 150,
    startY = 150,
  } = options;

  const layoutedNodes: CustomNode[] = [];

  nodes.forEach((node, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;

    const x = startX + col * (cellWidth + gapX);
    const y = startY + row * (cellHeight + gapY);

    layoutedNodes.push({
      ...node,
      position: { x, y },
    });
  });

  return { nodes: layoutedNodes, edges };
};
