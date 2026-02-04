import { createContext, useContext } from "react";
import type { GraphContextValue } from "../types";

export const GraphContext = createContext<GraphContextValue | null>(null);

export function useGraphContext() {
  const context = useContext(GraphContext);
  if (!context) {
    throw new Error("useGraphContext must be used within a Graph.Root");
  }
  return context;
}
