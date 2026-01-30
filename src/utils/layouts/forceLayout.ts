import {
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceLink,
  forceCollide,
  forceX,
  forceY,
} from "d3-force";
import type { Edge, Position } from "@xyflow/react";
import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";
import type { CustomNode } from "../../types";

interface ForceLayoutOptions {
  width?: number;
  height?: number;
  iterations?: number;
  nodeStrength?: number;
  linkDistance?: number;
  collideRadius?: number;
}

export const getForceLayout = (
  nodes: CustomNode[],
  edges: Edge[],
  options: ForceLayoutOptions = {}
): Promise<{ nodes: CustomNode[]; edges: Edge[] }> => {
  const {
    width = 4000,
    height = 3000,
    iterations = 600,
    nodeStrength = -2000,
    linkDistance = 400,
    collideRadius = 200,
  } = options;

  return new Promise((resolve) => {
    const simulationNodes = nodes.map((node) => ({
      ...node,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
      vx: 0,
      vy: 0,
    }));

    const simulationLinks = edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
    }));

    const simulation = forceSimulation(simulationNodes as SimulationNodeDatum[])
      .force("charge", forceManyBody().strength(nodeStrength).distanceMax(800))
      .force("center", forceCenter(width / 2, height / 2))
      .force(
        "link",
        forceLink(simulationLinks as SimulationLinkDatum<SimulationNodeDatum>[])
          .id((d: SimulationNodeDatum) => (d as unknown as { id: string }).id)
          .distance(linkDistance)
          .strength(0.3)
      )
      .force("collide", forceCollide().radius(collideRadius).strength(0.9))
      .force("x", forceX(width / 2).strength(0.08))
      .force("y", forceY(height / 2).strength(0.08))
      .stop();

    simulation.tick(iterations);

    const layoutedNodes: CustomNode[] = simulationNodes.map((node) => ({
      ...node,
      targetPosition: "top" as Position,
      sourcePosition: "bottom" as Position,
      position: {
        x: node.x,
        y: node.y,
      },
    }));

    resolve({ nodes: layoutedNodes, edges });
  });
};
