import { useState, useMemo, useCallback } from "react";
import type { Edge } from "@xyflow/react";
import type { CustomNode } from "../../types";
import styles from "./TreeView.module.css";

interface TreeNodeData {
  id: string;
  label: string;
  type: string;
  status: string;
  level: number;
  isMatch: boolean;
  isRoot: boolean;
  children: TreeNodeData[];
  hasChildren: boolean;
  color: string;
  borderColor: string;
}

interface TreeViewProps {
  nodes: CustomNode[];
  edges: Edge[];
  searchResults: Array<{ node: CustomNode; matches: boolean }>;
  maxVisibleNodes?: number;
}

interface TreeNodeItemProps {
  node: TreeNodeData;
  level: number;
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
}

const TreeNodeItem = ({ node, level, expandedNodes, onToggle }: TreeNodeItemProps) => {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.hasChildren;

  const getNodeIcon = () => {
    if (node.isRoot) return "🌟";
    if (hasChildren) return isExpanded ? "📂" : "📁";
    return "📄";
  };

  const getStatusIcon = () => {
    switch (node.status) {
      case "active": return "🟢";
      case "pending": return "🟡";
      case "completed": return "✅";
      case "error": return "❌";
      default: return "⚪";
    }
  };

  return (
    <div className={styles.treeNodeWrapper}>
      <div
        className={`${styles.treeNode} ${node.isMatch ? styles.matched : ""} ${node.isRoot ? styles.root : ""}`}
        style={{ 
          paddingLeft: `${level * 20 + 8}px`,
          borderLeftColor: node.borderColor,
        }}
      >
        {hasChildren && (
          <button
            className={`${styles.toggleButton} ${isExpanded ? styles.expanded : ""}`}
            onClick={() => onToggle(node.id)}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d={isExpanded ? "M2 4L6 8L10 4" : "M4 2L8 6L4 10"}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        {!hasChildren && <span className={styles.togglePlaceholder} />}
        
        <span className={styles.nodeIcon}>{getNodeIcon()}</span>
        <span className={styles.statusIcon}>{getStatusIcon()}</span>
        <span className={styles.nodeLabel} title={node.label}>
          {node.label}
        </span>
        <span className={styles.nodeType}>{node.type}</span>
        <span className={styles.levelBadge} style={{ backgroundColor: node.borderColor }}>
          L{node.level}
        </span>
      </div>
      
      {isExpanded && hasChildren && (
        <div className={styles.childrenContainer}>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const TreeView = ({ nodes, edges, searchResults, maxVisibleNodes = 500 }: TreeViewProps) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Build tree structure
  const treeData = useMemo(() => {
    const visibleCount = Math.min(nodes.length, maxVisibleNodes);
    const visibleNodes = nodes.slice(0, visibleCount);
    
    if (visibleNodes.length === 0) {
      return [];
    }

    // Build node map
    const nodeMap = new Map<string, CustomNode>();
    visibleNodes.forEach(node => nodeMap.set(node.id, node));

    // Build parent-child relationships
    const childrenMap = new Map<string, string[]>();
    
    visibleNodes.forEach(node => {
      childrenMap.set(node.id, []);
    });

    edges.forEach(edge => {
      if (childrenMap.has(edge.source) && nodeMap.has(edge.target)) {
        childrenMap.get(edge.source)!.push(edge.target);
      }
    });

    // Find root
    const rootNode = visibleNodes.find(n => n.data.metadata.level === 0);
    if (!rootNode) {
      return [];
    }

    // Build tree recursively
    const buildTree = (nodeId: string): TreeNodeData | null => {
      const node = nodeMap.get(nodeId);
      if (!node) return null;

      const searchResult = searchResults.find(r => r.node.id === node.id);
      const isMatch = searchResult?.matches || false;
      const style = node.style as Record<string, string> || {};
      const children = childrenMap.get(nodeId) || [];

      return {
        id: node.id,
        label: node.data.label,
        type: node.data.metadata.type,
        status: node.data.metadata.status,
        level: node.data.metadata.level,
        color: style.background || "#E8EAF6",
        borderColor: isMatch ? "#FFC107" : style.border?.split(" ")[2] || "#3F51B5",
        isMatch,
        isRoot: node.data.metadata.level === 0,
        hasChildren: children.length > 0,
        children: children.map(buildTree).filter((child): child is TreeNodeData => child !== null),
      };
    };

    const root = buildTree(rootNode.id);
    return root ? [root] : [];
  }, [nodes, edges, searchResults, maxVisibleNodes]);

  // Auto-expand root and matched nodes on first load
  useMemo(() => {
    if (expandedNodes.size === 0 && treeData.length > 0) {
      const newExpanded = new Set<string>();
      
      const addExpanded = (node: TreeNodeData) => {
        // Expand root
        if (node.isRoot) {
          newExpanded.add(node.id);
        }
        // Expand matched nodes
        if (node.isMatch) {
          newExpanded.add(node.id);
        }
        node.children.forEach(addExpanded);
      };
      
      treeData.forEach(addExpanded);
      setExpandedNodes(newExpanded);
    }
  }, [treeData]);

  const handleToggle = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    const allIds = new Set<string>();
    const collectIds = (node: TreeNodeData) => {
      allIds.add(node.id);
      node.children.forEach(collectIds);
    };
    treeData.forEach(collectIds);
    setExpandedNodes(allIds);
  }, [treeData]);

  const handleCollapseAll = useCallback(() => {
    // Keep only root expanded
    const rootIds = new Set<string>();
    treeData.forEach(node => {
      if (node.isRoot) {
        rootIds.add(node.id);
      }
    });
    setExpandedNodes(rootIds);
  }, [treeData]);

  if (treeData.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No data available</p>
      </div>
    );
  }

  return (
    <div className={styles.treeViewContainer}>
      <div className={styles.treeHeader}>
        <h3 className={styles.treeTitle}>Tree Explorer</h3>
        <div className={styles.treeActions}>
          <button className={styles.actionButton} onClick={handleExpandAll}>
            Expand All
          </button>
          <button className={styles.actionButton} onClick={handleCollapseAll}>
            Collapse All
          </button>
        </div>
      </div>
      <div className={styles.treeContent}>
        {treeData.map(node => (
          <TreeNodeItem
            key={node.id}
            node={node}
            level={0}
            expandedNodes={expandedNodes}
            onToggle={handleToggle}
          />
        ))}
      </div>
      <div className={styles.treeFooter}>
        <span>{nodes.length} nodes</span>
        <span>•</span>
        <span>{expandedNodes.size} expanded</span>
      </div>
    </div>
  );
};
