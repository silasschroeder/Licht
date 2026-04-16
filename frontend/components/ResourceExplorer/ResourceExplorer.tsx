"use client";

import React, { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ResourceItem,
  ResourceType,
  ResourceData,
} from "@/types/kubernetes";
import { viewSwitchVariants } from "@/lib/animations";
import { ViewToggle, ViewMode } from "./ViewToggle";
import { ResourceGrid } from "./GridView/ResourceGrid";
import styles from "./ResourceExplorer.module.css";

interface ResourceExplorerProps {
  resourceType: ResourceType;
  resourceData: ResourceData;
  namespace: string | null;
  onYamlClick: (kind: string, namespace: string | null, name: string) => void;
  formatAge: (createdAt: string | null | undefined) => string;
  /** Optional: Render custom table view component */
  renderTable?: () => React.ReactNode;
}

/**
 * Resource explorer with Grid and Table views
 * (Topology is displayed separately below as an always-visible section)
 */
export function ResourceExplorer({
  resourceType,
  resourceData,
  namespace,
  onYamlClick,
  formatAge,
  renderTable,
}: ResourceExplorerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Get filtered resources for the current type and namespace
  const getFilteredResources = useCallback((): ResourceItem[] => {
    const data = resourceData[resourceType] || [];
    if (!namespace) return data;
    return data.filter((item) => {
      if ("namespace" in item) {
        return item.namespace === namespace;
      }
      return true;
    });
  }, [resourceData, resourceType, namespace]);

  const filteredResources = getFilteredResources();

  return (
    <div className={styles.container}>
      <ViewToggle activeView={viewMode} onViewChange={setViewMode} />

      <div className={styles.explorerContent}>
        <AnimatePresence mode="wait">
          {viewMode === "grid" && (
            <motion.div
              key="grid"
              variants={viewSwitchVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {filteredResources.length > 0 ? (
                <ResourceGrid
                  resources={filteredResources}
                  resourceType={resourceType}
                  onYamlClick={onYamlClick}
                  formatAge={formatAge}
                />
              ) : (
                <div className={styles.emptyState}>
                  <svg
                    className={styles.emptyStateIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <div className={styles.emptyStateText}>No resources found</div>
                  <div className={styles.emptyStateSubtext}>
                    {namespace
                      ? `No ${resourceType} in namespace "${namespace}"`
                      : `No ${resourceType} available`}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {viewMode === "table" && (
            <motion.div
              key="table"
              variants={viewSwitchVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {renderTable ? (
                renderTable()
              ) : (
                <div className={styles.emptyState}>
                  <div className={styles.emptyStateText}>
                    Table view uses existing ResourceTable component
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Re-export components
export { ViewToggle } from "./ViewToggle";
export { ResourceGrid, ResourceCard } from "./GridView/ResourceGrid";
export { TopologySection } from "./TopologyView/TopologySection";
export type { ViewMode } from "./ViewToggle";
