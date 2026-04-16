"use client";

import React from "react";
import { motion } from "framer-motion";
import { chipVariants } from "@/lib/animations";
import styles from "./QuickFilter.module.css";

export type FilterType = "status" | "type" | "namespace";

export interface Filter {
  type: FilterType;
  value: string;
  label: string;
}

interface FilterChipProps {
  filter: Filter;
  onRemove: () => void;
}

/**
 * Removable filter chip
 */
export function FilterChip({ filter, onRemove }: FilterChipProps) {
  return (
    <motion.span
      className={`${styles.chip} ${styles.chipActive}`}
      variants={chipVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      layout
    >
      <span>{filter.label}</span>
      <button
        className={styles.chipRemove}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove ${filter.label} filter`}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </motion.span>
  );
}

interface FilterChipSelectProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

/**
 * Toggleable filter chip
 */
export function FilterChipSelect({ label, isActive, onClick }: FilterChipSelectProps) {
  return (
    <motion.button
      className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {label}
    </motion.button>
  );
}
