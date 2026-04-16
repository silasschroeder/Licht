"use client";

import React, { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Pod } from "@/types/kubernetes";
import { cardVariants, transitions } from "@/lib/animations";
import { StatusRing } from "./StatusRing";
import { PodSquare } from "./PodSquare";
import styles from "./NamespaceCanvas.module.css";

interface NamespaceCardProps {
  name: string;
  pods: Pod[];
  isSelected: boolean;
  onSelect: (name: string) => void;
  onPodCopy: (pod: Pod) => void;
  formatAge: (createdAt: string | null | undefined) => string;
  index: number;
}

// Layout constants
const POD_SIZE = 32;
const POD_GAP = 4;
const MAX_VISIBLE_PODS = 24;
const BASE_COLUMNS = 6;

function computeGridColumns(podCount: number): number {
  if (podCount <= 0) return 1;
  if (podCount <= 6) return podCount;
  if (podCount <= 12) return 6;
  if (podCount <= 18) return 6;
  return 6;
}

function computeCardWidth(columns: number): number {
  return columns * POD_SIZE + (columns - 1) * POD_GAP + 32; // 32 for padding
}

/**
 * Animated namespace card with status ring and pod grid
 */
export function NamespaceCard({
  name,
  pods,
  isSelected,
  onSelect,
  onPodCopy,
  formatAge,
  index,
}: NamespaceCardProps) {
  const [ripple, setRipple] = useState<{ x: number; y: number } | null>(null);

  // Calculate status counts
  const statusCounts = useMemo(() => {
    return pods.reduce(
      (acc, pod) => {
        const status = pod.status || "Unknown";
        if (status === "Running") acc.running++;
        else if (status === "Pending") acc.pending++;
        else if (status === "Failed") acc.failed++;
        else if (status === "Succeeded") acc.succeeded++;
        return acc;
      },
      { running: 0, pending: 0, failed: 0, succeeded: 0 }
    );
  }, [pods]);

  // Limit visible pods for performance
  const visiblePods = useMemo(() => {
    return pods.slice(0, MAX_VISIBLE_PODS);
  }, [pods]);

  const columns = computeGridColumns(visiblePods.length);
  const cardWidth = computeCardWidth(Math.max(columns, 4));

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Create ripple effect
      const rect = e.currentTarget.getBoundingClientRect();
      setRipple({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setTimeout(() => setRipple(null), 500);

      onSelect(name);
    },
    [name, onSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(name);
      }
    },
    [name, onSelect]
  );

  return (
    <motion.div
      className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}
      style={{ width: cardWidth }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`Namespace ${name} with ${pods.length} pods`}
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
      whileTap="tap"
      transition={{
        ...transitions.spring,
        delay: index * 0.03,
      }}
    >
      {/* Ripple effect */}
      {ripple && (
        <motion.span
          className={styles.ripple}
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 10,
            height: 10,
            marginLeft: -5,
            marginTop: -5,
          }}
          initial={{ scale: 0, opacity: 0.4 }}
          animate={{ scale: 20, opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      )}

      {/* Header with status ring */}
      <div className={styles.cardHeader}>
        <StatusRing
          running={statusCounts.running}
          pending={statusCounts.pending}
          failed={statusCounts.failed}
          succeeded={statusCounts.succeeded}
          total={pods.length}
        />
        <div className={styles.namespaceName} title={name}>
          {name}
        </div>
        <div className={styles.podCount}>
          {pods.length} {pods.length === 1 ? "pod" : "pods"}
        </div>
      </div>

      {/* Pod grid */}
      {visiblePods.length > 0 ? (
        <div
          className={styles.podGrid}
          style={{
            gridTemplateColumns: `repeat(${columns}, ${POD_SIZE}px)`,
          }}
        >
          {visiblePods.map((pod, idx) => (
            <PodSquare
              key={pod.uid || `${pod.name}-${idx}`}
              pod={pod}
              formatAge={formatAge}
              onCopy={onPodCopy}
            />
          ))}
          {pods.length > MAX_VISIBLE_PODS && (
            <div
              className={styles.podSquare}
              style={{
                background: "var(--surface-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                color: "var(--text-secondary)",
                fontWeight: 600,
              }}
            >
              +{pods.length - MAX_VISIBLE_PODS}
            </div>
          )}
        </div>
      ) : (
        <div className={styles.emptyState}>No pods</div>
      )}
    </motion.div>
  );
}
