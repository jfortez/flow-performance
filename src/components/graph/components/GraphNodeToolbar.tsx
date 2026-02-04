import { useMemo } from "react";
import { useSelectedNode, useGraphViewport } from "../hooks/useGraph";
import type { D3Node, NodePosition, TooltipPosition } from "../types";
import styles from "./GraphNodeToolbar.module.css";

interface GraphNodeToolbarProps {
  position: TooltipPosition;
  children: (node: D3Node & NodePosition) => React.ReactNode;
  offset?: number;
}

function getToolbarPosition(
  nodeX: number,
  nodeY: number,
  nodeLevel: number,
  position: TooltipPosition,
  offset: number,
  transform: { x: number; y: number; k: number }
): { left: number; top: number } {
  const radius = nodeLevel === 0 ? 22 : nodeLevel === 1 ? 16 : 11;
  const screenX = nodeX * transform.k + transform.x;
  const screenY = nodeY * transform.k + transform.y;

  switch (position) {
    case "top-left":
      return { left: screenX - offset, top: screenY - radius - offset };
    case "top-center":
      return { left: screenX, top: screenY - radius - offset };
    case "top-right":
      return { left: screenX + offset, top: screenY - radius - offset };
    case "left-top":
      return { left: screenX - radius - offset, top: screenY - offset };
    case "left-center":
      return { left: screenX - radius - offset, top: screenY };
    case "left-bottom":
      return { left: screenX - radius - offset, top: screenY + offset };
    case "right-top":
      return { left: screenX + radius + offset, top: screenY - offset };
    case "right-center":
      return { left: screenX + radius + offset, top: screenY };
    case "right-bottom":
      return { left: screenX + radius + offset, top: screenY + offset };
    case "bottom-left":
      return { left: screenX - offset, top: screenY + radius + offset };
    case "bottom-center":
      return { left: screenX, top: screenY + radius + offset };
    case "bottom-right":
      return { left: screenX + offset, top: screenY + radius + offset };
    default:
      return { left: screenX + radius + offset, top: screenY };
  }
}

export function GraphNodeToolbar({
  position,
  children,
  offset = 16,
}: GraphNodeToolbarProps) {
  const selectedNode = useSelectedNode();
  const viewport = useGraphViewport();

  const style = useMemo(() => {
    if (!selectedNode) return { display: "none" };
    const { left, top } = getToolbarPosition(
      selectedNode.x,
      selectedNode.y,
      selectedNode.level ?? 0,
      position,
      offset,
      viewport
    );
    return {
      left,
      top,
      display: "flex",
    };
  }, [selectedNode, position, offset, viewport]);

  if (!selectedNode) return null;

  return (
    <div className={styles.toolbar} style={style}>
      {children(selectedNode)}
    </div>
  );
}
