import type { Edge } from "@xyflow/react";
import type { CustomNode } from "../../types";

export interface NodeGroup {
  id: string;
  label: string;
  startIndex: number;
  endIndex: number;
  nodes: CustomNode[];
}

interface GroupedLayoutOptions {
  centerX?: number;
  centerY?: number;
  groupSize?: number;
  groupSpacing?: number;
  expandedGroup?: string | null;
}

export const getGroupedLayout = (
  nodes: CustomNode[],
  edges: Edge[],
  options: GroupedLayoutOptions = {}
): { 
  nodes: CustomNode[]; 
  edges: Edge[];
  groups: NodeGroup[];
} => {
  const {
    centerX = 0,
    centerY = 0,
    groupSize = 12,
    expandedGroup = null,
  } = options;

  // Separate root from children
  const rootNodes: CustomNode[] = [];
  const childNodes: CustomNode[] = [];

  nodes.forEach((node) => {
    if (node.data.metadata.level === 0) {
      rootNodes.push(node);
    } else {
      childNodes.push(node);
    }
  });

  // Create groups
  const groups: NodeGroup[] = [];
  const totalGroups = Math.ceil(childNodes.length / groupSize);

  for (let i = 0; i < totalGroups; i++) {
    const startIndex = i * groupSize;
    const endIndex = Math.min((i + 1) * groupSize, childNodes.length);
    const groupNodes = childNodes.slice(startIndex, endIndex);

    groups.push({
      id: `group-${i}`,
      label: `Grupo ${i + 1} (${groupNodes.length} nodos)`,
      startIndex,
      endIndex: endIndex - 1,
      nodes: groupNodes,
    });
  }

  const layoutedNodes: CustomNode[] = [];

  // Position root at center
  rootNodes.forEach((root) => {
    layoutedNodes.push({
      ...root,
      position: { x: centerX, y: centerY },
    });
  });

  // If a group is expanded, show its nodes individually
  if (expandedGroup) {
    const expandedGroupData = groups.find((g) => g.id === expandedGroup);
    if (expandedGroupData) {
      // Position expanded group nodes in a grid
      const cols = 4;
      const nodeSpacing = 120;
      const startX = centerX - ((cols - 1) * nodeSpacing) / 2;
      const startY = centerY + 150;

      expandedGroupData.nodes.forEach((node, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        layoutedNodes.push({
          ...node,
          position: {
            x: startX + col * nodeSpacing,
            y: startY + row * nodeSpacing,
          },
        });
      });

      // Show other groups as collapsed bubbles
      groups
        .filter((g) => g.id !== expandedGroup)
        .forEach((group, index) => {
          const angle = (index / (groups.length - 1)) * Math.PI * 2 - Math.PI / 2;
          const radius = 600;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);

          layoutedNodes.push({
            id: group.id,
            position: { x, y },
            data: {
              label: group.label,
              metadata: {
                type: "categoryA" as const,
                status: "active" as const,
                level: 1,
              },
              childCount: group.nodes.length,
              isGroup: true,
              groupId: group.id,
            },
            style: {
              background: "#E3F2FD",
              border: "3px solid #1976D2",
              borderRadius: "50%",
              width: 100,
              height: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center" as const,
              fontSize: "11px",
              fontWeight: 600,
              color: "#1565C0",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(25, 118, 210, 0.3)",
            },
          });
        });
    }
  } else {
    // Show all groups as bubbles in a circle
    groups.forEach((group, index) => {
      const angle = (index / groups.length) * Math.PI * 2 - Math.PI / 2;
      const radius = 500;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      layoutedNodes.push({
        id: group.id,
        position: { x, y },
        data: {
          label: group.label,
          metadata: {
            type: "categoryA" as const,
            status: "active" as const,
            level: 1,
          },
          childCount: group.nodes.length,
          isGroup: true,
          groupId: group.id,
        },
        style: {
          background: "#E3F2FD",
          border: "3px solid #1976D2",
          borderRadius: "50%",
          width: 100,
          height: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center" as const,
          fontSize: "11px",
          fontWeight: 600,
          color: "#1565C0",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(25, 118, 210, 0.3)",
        },
      });
    });
  }

  return { nodes: layoutedNodes, edges, groups };
};
