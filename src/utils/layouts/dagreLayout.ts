import dagre from "@dagrejs/dagre";
import type { Edge, Position } from "@xyflow/react";
import type { CustomNode } from "../../types";

const NODE_WIDTH = 172;
const NODE_HEIGHT = 36;

const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

export const getDagreLayout = (
  nodes: CustomNode[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB"
): { nodes: CustomNode[]; edges: Edge[] } => {
  const isHorizontal = direction === "LR";

  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: 150,
    nodesep: 80,
    marginx: 100,
    marginy: 100,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: (isHorizontal ? "left" : "top") as Position,
      sourcePosition: (isHorizontal ? "right" : "bottom") as Position,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};
