"use client";

import React from "react";
import { motion } from "framer-motion";
import styles from "./ResourceExplorer.module.css";

export type ViewMode = "grid" | "table";

interface ViewToggleProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

const GridIcon = () => (
  <svg
    className={styles.viewToggleIcon}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const TableIcon = () => (
  <svg
    className={styles.viewToggleIcon}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

/**
 * Toggle between Grid and Table views
 */
export function ViewToggle({ activeView, onViewChange }: ViewToggleProps) {
  const views: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: "grid", label: "Grid", icon: <GridIcon /> },
    { id: "table", label: "Table", icon: <TableIcon /> },
  ];

  return (
    <div className={styles.viewToggle} role="tablist" aria-label="View mode">
      {views.map((view) => (
        <motion.button
          key={view.id}
          className={`${styles.viewToggleButton} ${
            activeView === view.id ? styles.viewToggleButtonActive : ""
          }`}
          onClick={() => onViewChange(view.id)}
          role="tab"
          aria-selected={activeView === view.id}
          aria-controls={`${view.id}-view`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {view.icon}
          {view.label}
        </motion.button>
      ))}
    </div>
  );
}
