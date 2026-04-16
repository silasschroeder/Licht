"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResourceData,
  ResourceType,
  Pod,
  Deployment,
  Service,
} from "@/types/kubernetes";
import { quickFilterVariants, backdropVariants } from "@/lib/animations";
import { FilterChip, FilterChipSelect, Filter, FilterType } from "./FilterChip";
import styles from "./QuickFilter.module.css";

interface QuickFilterProps {
  isOpen: boolean;
  onClose: () => void;
  resourceData: ResourceData;
  onSelectResource: (type: ResourceType, name: string, namespace: string | null) => void;
  onFilterChange: (filters: Filter[]) => void;
}

interface SearchResult {
  type: ResourceType;
  name: string;
  namespace: string | null;
  status?: string;
}

// Icons
const SearchIcon = () => (
  <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const PodIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
    <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" />
    <circle cx="12" cy="15.5" r="1.5" fill="currentColor" />
  </svg>
);

const DeploymentIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="7" width="20" height="10" rx="2" />
    <line x1="6" y1="12" x2="10" y2="12" />
    <line x1="14" y1="12" x2="18" y2="12" />
  </svg>
);

const ServiceIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

/**
 * Simple fuzzy search - matches if query chars appear in order
 */
function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

/**
 * Quick filter overlay with fuzzy search
 */
export function QuickFilter({
  isOpen,
  onClose,
  resourceData,
  onSelectResource,
  onFilterChange,
}: QuickFilterProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeFilters, setActiveFilters] = useState<Filter[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Search all resources
  const results = useMemo((): SearchResult[] => {
    if (!query.trim()) return [];

    const matches: SearchResult[] = [];

    // Search pods
    for (const pod of resourceData.pods || []) {
      if (fuzzyMatch(query, pod.name) || fuzzyMatch(query, pod.namespace)) {
        matches.push({
          type: "pods",
          name: pod.name,
          namespace: pod.namespace,
          status: pod.status,
        });
      }
    }

    // Search deployments
    for (const dep of resourceData.deployments || []) {
      if (fuzzyMatch(query, dep.name) || fuzzyMatch(query, dep.namespace)) {
        const ready = dep.ready?.split("/") || ["0", "0"];
        matches.push({
          type: "deployments",
          name: dep.name,
          namespace: dep.namespace,
          status: parseInt(ready[0]) === parseInt(ready[1]) ? "Ready" : "Pending",
        });
      }
    }

    // Search services
    for (const svc of resourceData.services || []) {
      if (fuzzyMatch(query, svc.name) || fuzzyMatch(query, svc.namespace)) {
        matches.push({
          type: "services",
          name: svc.name,
          namespace: svc.namespace,
          status: "Active",
        });
      }
    }

    return matches.slice(0, 20); // Limit results
  }, [query, resourceData]);

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: Record<ResourceType, SearchResult[]> = {
      pods: [],
      deployments: [],
      services: [],
      replicaSets: [],
      statefulSets: [],
      daemonSets: [],
      jobs: [],
      cronJobs: [],
    };

    for (const result of results) {
      groups[result.type].push(result);
    }

    return groups;
  }, [results]);

  // Flatten for keyboard navigation
  const flatResults = useMemo(() => results, [results]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (flatResults[selectedIndex]) {
            const result = flatResults[selectedIndex];
            onSelectResource(result.type, result.name, result.namespace);
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatResults, selectedIndex, onSelectResource, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selected = resultsRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const handleRemoveFilter = useCallback(
    (index: number) => {
      const newFilters = activeFilters.filter((_, i) => i !== index);
      setActiveFilters(newFilters);
      onFilterChange(newFilters);
    },
    [activeFilters, onFilterChange]
  );

  const handleToggleStatusFilter = useCallback(
    (status: string) => {
      const existing = activeFilters.findIndex(
        (f) => f.type === "status" && f.value === status
      );
      let newFilters: Filter[];
      if (existing >= 0) {
        newFilters = activeFilters.filter((_, i) => i !== existing);
      } else {
        newFilters = [
          ...activeFilters,
          { type: "status", value: status, label: status },
        ];
      }
      setActiveFilters(newFilters);
      onFilterChange(newFilters);
    },
    [activeFilters, onFilterChange]
  );

  const getStatusClass = (status?: string) => {
    switch (status) {
      case "Running":
      case "Ready":
      case "Active":
        return styles.resultStatusRunning;
      case "Pending":
        return styles.resultStatusPending;
      case "Failed":
      case "Error":
        return styles.resultStatusFailed;
      default:
        return "";
    }
  };

  const getIcon = (type: ResourceType) => {
    switch (type) {
      case "pods":
        return <PodIcon />;
      case "deployments":
        return <DeploymentIcon />;
      case "services":
        return <ServiceIcon />;
      default:
        return <PodIcon />;
    }
  };

  const getIconClass = (type: ResourceType) => {
    switch (type) {
      case "pods":
        return styles.resultIconPod;
      case "deployments":
        return styles.resultIconDeployment;
      case "services":
        return styles.resultIconService;
      default:
        return "";
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          variants={backdropVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className={styles.container}
            variants={quickFilterVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className={styles.searchWrapper}>
              <SearchIcon />
              <input
                ref={inputRef}
                type="text"
                className={styles.searchInput}
                placeholder="Search resources..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                aria-label="Search resources"
              />
              <div className={styles.shortcutHint}>
                <kbd className={styles.kbd}>esc</kbd>
                <span style={{ color: "var(--text-tertiary)", fontSize: "11px" }}>
                  to close
                </span>
              </div>
            </div>

            {/* Filter chips */}
            <div className={styles.filtersWrapper}>
              <FilterChipSelect
                label="Running"
                isActive={activeFilters.some(
                  (f) => f.type === "status" && f.value === "Running"
                )}
                onClick={() => handleToggleStatusFilter("Running")}
              />
              <FilterChipSelect
                label="Pending"
                isActive={activeFilters.some(
                  (f) => f.type === "status" && f.value === "Pending"
                )}
                onClick={() => handleToggleStatusFilter("Pending")}
              />
              <FilterChipSelect
                label="Failed"
                isActive={activeFilters.some(
                  (f) => f.type === "status" && f.value === "Failed"
                )}
                onClick={() => handleToggleStatusFilter("Failed")}
              />
              <AnimatePresence>
                {activeFilters.map((filter, i) => (
                  <FilterChip
                    key={`${filter.type}-${filter.value}`}
                    filter={filter}
                    onRemove={() => handleRemoveFilter(i)}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Results */}
            <div className={styles.results} ref={resultsRef}>
              {query.trim() === "" ? (
                <div className={styles.emptyState}>
                  <SearchIcon />
                  <div className={styles.emptyStateText}>
                    Start typing to search resources
                  </div>
                </div>
              ) : flatResults.length === 0 ? (
                <div className={styles.emptyState}>
                  <svg
                    className={styles.emptyStateIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div className={styles.emptyStateText}>
                    No resources found for "{query}"
                  </div>
                </div>
              ) : (
                <>
                  {(["pods", "deployments", "services"] as ResourceType[]).map(
                    (type) =>
                      groupedResults[type].length > 0 && (
                        <div key={type} className={styles.resultGroup}>
                          <div className={styles.resultGroupLabel}>
                            {type}
                          </div>
                          {groupedResults[type].map((result, idx) => {
                            const globalIndex = flatResults.indexOf(result);
                            return (
                              <div
                                key={`${result.type}-${result.namespace}-${result.name}`}
                                data-index={globalIndex}
                                className={`${styles.resultItem} ${
                                  globalIndex === selectedIndex
                                    ? styles.resultItemSelected
                                    : ""
                                }`}
                                onClick={() => {
                                  onSelectResource(
                                    result.type,
                                    result.name,
                                    result.namespace
                                  );
                                  onClose();
                                }}
                                onMouseEnter={() => setSelectedIndex(globalIndex)}
                              >
                                <div
                                  className={`${styles.resultIcon} ${getIconClass(
                                    result.type
                                  )}`}
                                >
                                  {getIcon(result.type)}
                                </div>
                                <div className={styles.resultContent}>
                                  <div className={styles.resultName}>
                                    {result.name}
                                  </div>
                                  <div className={styles.resultMeta}>
                                    {result.namespace}
                                  </div>
                                </div>
                                {result.status && (
                                  <div
                                    className={`${styles.resultStatus} ${getStatusClass(
                                      result.status
                                    )}`}
                                    title={result.status}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              <div className={styles.footerHints}>
                <div className={styles.footerHint}>
                  <kbd className={styles.kbd}>↑</kbd>
                  <kbd className={styles.kbd}>↓</kbd>
                  <span>navigate</span>
                </div>
                <div className={styles.footerHint}>
                  <kbd className={styles.kbd}>↵</kbd>
                  <span>select</span>
                </div>
              </div>
              <div>
                {flatResults.length > 0 && `${flatResults.length} results`}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export { FilterChip, FilterChipSelect } from "./FilterChip";
export type { Filter, FilterType } from "./FilterChip";
