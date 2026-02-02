import type { Edge } from "@xyflow/react";
import type { CustomNode, NodeType, NodeStatus } from "../types";

// Tipos organizados por nivel jerárquico
const TYPE_BY_LEVEL: Record<number, NodeType[]> = {
  0: ["core"],                                    // Solo el nodo raíz
  1: ["categoryA"],                               // Nivel 1: Categorías principales
  2: ["categoryB"],                               // Nivel 2: Sub-categorías
  3: ["categoryC", "categoryD"],                  // Nivel 3: Tareas y acciones
  4: ["categoryD", "endpoint"],                   // Nivel 4+: Acciones y endpoints
};

const NODE_STATUSES: NodeStatus[] = ["active", "pending", "completed", "error"];

const getRandomType = (level: number): NodeType => {
  const types = TYPE_BY_LEVEL[level] || TYPE_BY_LEVEL[4];
  return types[Math.floor(Math.random() * types.length)];
};

const getRandomStatus = (): NodeStatus => {
  return NODE_STATUSES[Math.floor(Math.random() * NODE_STATUSES.length)];
};

const getNodeStyle = (type: NodeType, status: NodeStatus, isCore = false) => {
  // Colores distintivos por tipo de categoría
  const typeColors: Record<NodeType, { bg: string; border: string }> = {
    core: { bg: "#E1BEE7", border: "#7B1FA2" },         // Morado - Núcleo
    categoryA: { bg: "#C5CAE9", border: "#3F51B5" },    // Índigo - Categoría A
    categoryB: { bg: "#BBDEFB", border: "#1976D2" },    // Azul - Categoría B
    categoryC: { bg: "#B2DFDB", border: "#00796B" },    // Verde - Categoría C
    categoryD: { bg: "#FFE0B2", border: "#F57C00" },    // Naranja - Categoría D
    endpoint: { bg: "#C8E6C9", border: "#388E3C" },     // Verde claro - Endpoint
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
    fontWeight: isCore ? 700 : 600,
    fontSize: isCore ? "13px" : "12px",
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

  const coreNode: CustomNode = {
    id: "core",
    position: { x: 0, y: 0 },
    data: {
      label: "Hub Central",
      metadata: {
        type: "core",
        status: "active",
        level: 0,
        createdAt: new Date().toISOString(),
        description: "Núcleo principal del sistema",
      },
      isExpanded: true,
      childCount: rootChildrenCount,
    },
    style: {
      ...getNodeStyle("core", "active", true),
      border: "4px solid #7B1FA2",
      boxShadow: "0 4px 12px rgba(123, 31, 162, 0.4)",
    },
  };

  nodes.push(coreNode);

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
      source: "core",
      target: nodeId,
      type: "smoothstep",
    });
  }

  return { nodes, edges, totalNodes: nodeCounter + 1 };
};

export const generateHierarchicalData = (
  totalNodes: number = 150,
  maxDepth: number = 2,
  childrenPerNode: number = 3
): { nodes: CustomNode[]; edges: Edge[]; totalNodes: number } => {
  const nodes: CustomNode[] = [];
  const edges: Edge[] = [];
  let nodeCounter = 0;

  const coreNode: CustomNode = {
    id: "core",
    position: { x: 0, y: 0 },
    data: {
      label: "Hub Central",
      metadata: {
        type: "core",
        status: "active",
        level: 0,
        createdAt: new Date().toISOString(),
        description: "Núcleo principal del sistema",
      },
      isExpanded: true,
      childCount: childrenPerNode,
    },
    style: {
      ...getNodeStyle("core", "active", true),
      border: "4px solid #7B1FA2",
      boxShadow: "0 4px 12px rgba(123, 31, 162, 0.4)",
    },
  };

  nodes.push(coreNode);
  nodeCounter++;

  // Calculate how many nodes we can have per level to ensure all levels are created
  // We need at least 1 node per level (except level 0 which has the core)
  const minNodesPerLevel = 1;
  const minNodesNeeded = 1 + (maxDepth * minNodesPerLevel); // core + at least 1 per level
  
  if (totalNodes < minNodesNeeded) {
    console.warn(`Not enough nodes (${totalNodes}) to create ${maxDepth} levels. Need at least ${minNodesNeeded}.`);
  }

  // Calculate target nodes per level to distribute evenly
  const remainingNodes = totalNodes - 1; // Exclude core
  const nodesPerLevel: number[] = [];
  
  // First, ensure we have at least 1 node per level
  for (let level = 1; level <= maxDepth; level++) {
    nodesPerLevel[level] = 0;
  }
  
  // Distribute remaining nodes level by level, breadth-first
  let nodesToDistribute = remainingNodes;
  let currentLevel = 1;
  
  while (nodesToDistribute > 0 && currentLevel <= maxDepth) {
    // Calculate how many nodes this level can have based on parent capacity
    let parentCount = currentLevel === 1 ? 1 : nodesPerLevel[currentLevel - 1];
    let maxNodesForThisLevel = parentCount * childrenPerNode;
    
    // Take the minimum of: what we can fit, what we need, and what's left
    let nodesForThisLevel = Math.min(
      maxNodesForThisLevel,
      Math.ceil(nodesToDistribute / (maxDepth - currentLevel + 1)), // Distribute evenly
      nodesToDistribute
    );
    
    // Ensure at least 1 node per level if possible
    if (nodesToDistribute >= (maxDepth - currentLevel + 1)) {
      nodesForThisLevel = Math.max(nodesForThisLevel, 1);
    }
    
    nodesPerLevel[currentLevel] = nodesForThisLevel;
    nodesToDistribute -= nodesForThisLevel;
    currentLevel++;
  }

  // Create first level children
  const firstLevelNodes: CustomNode[] = [];
  const firstLevelCount = nodesPerLevel[1] || 0;
  
  for (let i = 0; i < firstLevelCount && nodeCounter < totalNodes; i++) {
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
        isExpanded: maxDepth > 1,
        childCount: 0,
      },
      style: getNodeStyle(type, status),
    };

    nodes.push(node);
    firstLevelNodes.push(node);

    edges.push({
      id: `edge-root-${nodeId}`,
      source: "core",
      target: nodeId,
      type: "smoothstep",
    });
  }

  // Create deeper levels
  if (maxDepth > 1) {
    let currentLevelNodes = firstLevelNodes;

    for (let level = 2; level <= maxDepth && currentLevelNodes.length > 0; level++) {
      const nextLevelNodes: CustomNode[] = [];
      const targetNodesForThisLevel = nodesPerLevel[level] || 0;
      
      if (targetNodesForThisLevel === 0) continue;

      // Distribute children among parents
      let nodesCreated = 0;
      let parentIndex = 0;
      
      while (nodesCreated < targetNodesForThisLevel && nodeCounter < totalNodes && parentIndex < currentLevelNodes.length) {
        const parentNode = currentLevelNodes[parentIndex];
        const childrenForThisParent = Math.min(
          childrenPerNode,
          targetNodesForThisLevel - nodesCreated,
          totalNodes - nodeCounter
        );
        
        for (let j = 0; j < childrenForThisParent; j++) {
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
              isExpanded: level < maxDepth,
              childCount: 0,
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
          
          // Update parent child count
          parentNode.data.childCount = (parentNode.data.childCount || 0) + 1;
        }
        
        nodesCreated += childrenForThisParent;
        parentIndex++;
      }

      currentLevelNodes = nextLevelNodes;
    }
  }

  return { nodes, edges, totalNodes: nodeCounter };
};
