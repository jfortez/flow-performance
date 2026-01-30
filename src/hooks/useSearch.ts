import { useState, useEffect, useCallback, useMemo } from "react";
import type { CustomNode } from "../types";

interface UseSearchOptions {
  debounceMs?: number;
}

export const useSearch = (nodes: CustomNode[], options: UseSearchOptions = {}) => {
  const { debounceMs = 300 } = options;
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.toLowerCase());
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs]);

  const searchResults = useMemo(() => {
    if (!debouncedSearch) {
      return nodes.map((node) => ({ node, matches: false }));
    }

    return nodes.map((node) => {
      const labelMatch = node.data.label.toLowerCase().includes(debouncedSearch);
      const typeMatch = node.data.metadata.type.toLowerCase().includes(debouncedSearch);
      const statusMatch = node.data.metadata.status.toLowerCase().includes(debouncedSearch);
      const descMatch = node.data.metadata.description?.toLowerCase().includes(debouncedSearch) || false;

      return {
        node,
        matches: labelMatch || typeMatch || statusMatch || descMatch,
      };
    });
  }, [nodes, debouncedSearch]);

  const matchedNodes = useMemo(
    () => searchResults.filter((r) => r.matches).map((r) => r.node),
    [searchResults]
  );

  const clearSearch = useCallback(() => {
    setSearchTerm("");
    setDebouncedSearch("");
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    debouncedSearch,
    searchResults,
    matchedNodes,
    hasMatches: matchedNodes.length > 0,
    clearSearch,
  };
};
