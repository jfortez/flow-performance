import type { Edge } from "@xyflow/react";
import type { CustomNode, NodeType, NodeStatus } from "../types";

const NODE_TYPES: NodeType[] = ["root", "process", "task", "decision", "action"];
const NODE_STATUSES: NodeStatus[] = ["active", "pending", "completed", "error"];

const getRandomType = (level: number): NodeType => {
  if (level === 0) return "root";
  if (level === 1) return "process";
  if (level === 2) return "decision";
  return NODE_TYPES[Math.floor(Math.random() * (NODE_TYPES.length - 1)) + 1];
};

const getRandomStatus = (): NodeStatus => {
  return NODE_STATUSES[Math.floor(Math.random() * NODE_STATUSES.length)];
};

const getNodeStyle = (type: NodeType, status: NodeStatus, isRoot = false) => {
  // Fondos con color sutil pero visible
  const typeColors: Record<NodeType, { bg: string; border: string }> = {
    root: { bg: "#F3E5F5", border: "#7B1FA2" },      // Morado muy claro
    process: { bg: "#E8EAF6", border: "#3F51B5" },   // Índigo muy claro
    task: { bg: "#E3F2FD", border: "#1976D2" },      // Azul muy claro
    decision: { bg: "#E0F2F1", border: "#00796B" },  // Verde muy claro
    action: { bg: "#FFF3E0", border: "#F57C00" },    // Naranja muy claro
  };

  const colorSet = typeColors[type];
  
  // Grosor del borde según status
  let borderWidth = "3px";
  if (status === "completed") borderWidth = "2px";
  if (status === "pending") borderWidth = "2px";
  if (status === "error") borderWidth = "4px";

  // Color del borde
  let borderColor = colorSet.border;
  if (status === "error") borderColor = "#D32F2F";
  if (status === "completed") borderColor = "#388E3C";

  return {
    background: colorSet.bg,
    border: `${borderWidth} solid ${borderColor}`,
    borderRadius: "6px",
    color: "#212121",
    fontWeight: isRoot ? 700 : 600,
    fontSize: isRoot ? "13px" : "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center" as const,
    padding: "6px 10px",
    boxShadow: "0 3px 6px rgba(0,0,0,0.16)",
    minWidth: "100px",
    maxWidth: "160px",
  };
};

interface TreeConfig {
  maxDepth: number;
  childrenPerNode: number[];
}

export const generateTreeData = (
  config: TreeConfig = { maxDepth: 4, childrenPerNode: [3, 4, 3, 2] }
): { nodes: CustomNode[]; edges: Edge[]; totalNodes: number } => {
  const nodes: CustomNode[] = [];
  const edges: Edge[] = [];
  let nodeCounter = 0;

  const createNode = (
    id: string,
    label: string,
    level: number,
    parentId?: string
  ): CustomNode => {
    const type = getRandomType(level);
    const status = getRandomStatus();

    const node: CustomNode = {
      id,
      position: { x: 0, y: 0 },
      data: {
        label,
        metadata: {
          type,
          status,
          level,
          createdAt: new Date().toISOString(),
          description: `Node ${id} - ${type} at level ${level}`,
        },
        isExpanded: level < 2,
        childCount: 0,
      },
      style: getNodeStyle(type, status),
    };

    if (parentId) {
      edges.push({
        id: `edge-${parentId}-${id}`,
        source: parentId,
        target: id,
        type: "smoothstep",
      });

      const parentNode = nodes.find((n) => n.id === parentId);
      if (parentNode) {
        parentNode.data.childCount = (parentNode.data.childCount || 0) + 1;
      }
    }

    return node;
  };

  const buildTree = (parentId: string | null, level: number): void => {
    if (level >= config.maxDepth) return;

    const numChildren = config.childrenPerNode[level] || 2;

    for (let i = 0; i < numChildren; i++) {
      nodeCounter++;
      const nodeId = parentId ? `${parentId}-${i}` : `root`;
      const label = parentId ? `Node ${nodeId}` : "Root";

      const node = createNode(nodeId, label, level, parentId || undefined);
      nodes.push(node);

      buildTree(nodeId, level + 1);
    }
  };

  buildTree(null, 0);

  return { nodes, edges, totalNodes: nodeCounter + 1 };
};

export const generateLargeFirstLevel = (
  rootChildrenCount: number = 150
): { nodes: CustomNode[]; edges: Edge[]; totalNodes: number } => {
  const nodes: CustomNode[] = [];
  const edges: Edge[] = [];
  let nodeCounter = 0;

  const rootNode: CustomNode = {
    id: "root",
    position: { x: 0, y: 0 },
    data: {
      label: "Root",
      metadata: {
        type: "root",
        status: "active",
        level: 0,
        createdAt: new Date().toISOString(),
        description: "Root node",
      },
      isExpanded: true,
      childCount: rootChildrenCount,
    },
    style: {
      ...getNodeStyle("root", "active", true),
      border: "4px solid #7B1FA2",
      boxShadow: "0 4px 12px rgba(123, 31, 162, 0.4)",
    },
  };

  nodes.push(rootNode);

  for (let i = 0; i < rootChildrenCount; i++) {
    nodeCounter++;
    const nodeId = `node-${i}`;
    const type = getRandomType(1);
    const status = getRandomStatus();

    const node: CustomNode = {
      id: nodeId,
      position: { x: 0, y: 0 },
      data: {
        label: `Node ${i}`,
        metadata: {
          type,
          status,
          level: 1,
          createdAt: new Date().toISOString(),
          description: `Child node ${i}`,
        },
        isExpanded: false,
        childCount: 0,
      },
      style: getNodeStyle(type, status),
    };

    nodes.push(node);

    edges.push({
      id: `edge-root-${nodeId}`,
      source: "root",
      target: nodeId,
      type: "smoothstep",
    });
  }

  return { nodes, edges, totalNodes: nodeCounter + 1 };
};

export const generateHierarchicalData = (
  rootChildrenCount: number = 150,
  maxDepth: number = 2,
  childrenPerNode: number = 3
): { nodes: CustomNode[]; edges: Edge[]; totalNodes: number } => {
  const nodes: CustomNode[] = [];
  const edges: Edge[] = [];
  let nodeCounter = 0;

  const rootNode: CustomNode = {
    id: "root",
    position: { x: 0, y: 0 },
    data: {
      label: "Root",
      metadata: {
        type: "root",
        status: "active",
        level: 0,
        createdAt: new Date().toISOString(),
        description: "Root node",
      },
      isExpanded: true,
      childCount: rootChildrenCount,
    },
    style: {
      ...getNodeStyle("root", "active", true),
      border: "4px solid #7B1FA2",
      boxShadow: "0 4px 12px rgba(123, 31, 162, 0.4)",
    },
  };

  nodes.push(rootNode);

  // Create first level children
  const firstLevelNodes: CustomNode[] = [];
  for (let i = 0; i < rootChildrenCount; i++) {
    nodeCounter++;
    const nodeId = `node-${i}`;
    const type = getRandomType(1);
    const status = getRandomStatus();

    const node: CustomNode = {
      id: nodeId,
      position: { x: 0, y: 0 },
      data: {
        label: `Node ${i}`,
        metadata: {
          type,
          status,
          level: 1,
          createdAt: new Date().toISOString(),
          description: `Child node ${i}`,
        },
        isExpanded: maxDepth > 2,
        childCount: maxDepth > 2 ? childrenPerNode : 0,
      },
      style: getNodeStyle(type, status),
    };

    nodes.push(node);
    firstLevelNodes.push(node);

    edges.push({
      id: `edge-root-${nodeId}`,
      source: "root",
      target: nodeId,
      type: "smoothstep",
    });
  }

  // Create deeper levels if maxDepth > 2
  if (maxDepth > 2) {
    let currentLevelNodes = firstLevelNodes;
    
    for (let level = 2; level < maxDepth; level++) {
      const nextLevelNodes: CustomNode[] = [];
      
      for (const parentNode of currentLevelNodes) {
        for (let j = 0; j < childrenPerNode; j++) {
          nodeCounter++;
          const nodeId = `${parentNode.id}-${j}`;
          const type = getRandomType(level);
          const status = getRandomStatus();

          const node: CustomNode = {
            id: nodeId,
            position: { x: 0, y: 0 },
            data: {
              label: `Node ${nodeId}`,
              metadata: {
                type,
                status,
                level,
                createdAt: new Date().toISOString(),
                description: `Level ${level} node`,
              },
              isExpanded: level < maxDepth - 1,
              childCount: level < maxDepth - 1 ? childrenPerNode : 0,
            },
            style: getNodeStyle(type, status),
          };

          nodes.push(node);
          nextLevelNodes.push(node);

          edges.push({
            id: `edge-${parentNode.id}-${nodeId}`,
            source: parentNode.id,
            target: nodeId,
            type: "smoothstep",
          });
        }
      }
      
      currentLevelNodes = nextLevelNodes;
    }
  }

  return { nodes, edges, totalNodes: nodeCounter + 1 };
};
