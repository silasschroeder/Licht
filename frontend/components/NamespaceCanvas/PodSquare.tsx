"use client";

import React, { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Pod } from "@/types/kubernetes";
import { tooltipVariants, transitions } from "@/lib/animations";
import styles from "./NamespaceCanvas.module.css";

interface PodSquareProps {
  pod: Pod;
  formatAge: (createdAt: string | null | undefined) => string;
  onCopy?: (pod: Pod) => void;
}

const statusClassMap: Record<string, string> = {
  Running: styles.podRunning,
  Pending: styles.podPending,
  Failed: styles.podFailed,
  Succeeded: styles.podSucceeded,
};

/**
 * Interactive pod square with tooltip and copy functionality
 */
export function PodSquare({ pod, formatAge, onCopy }: PodSquareProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [showCopyFlash, setShowCopyFlash] = useState(false);
  const podRef = useRef<HTMLDivElement>(null);
  const capturedPodRef = useRef<Pod | null>(null);

  const handleMouseEnter = useCallback(() => {
    // Use setTimeout to ensure DOM has settled after any transforms
    requestAnimationFrame(() => {
      if (!podRef.current) return;

      const rect = podRef.current.getBoundingClientRect();
      const tooltipWidth = 220;
      const screenWidth = window.innerWidth;
      const podCenterX = rect.left + rect.width / 2;

      // Capture pod state for tooltip
      capturedPodRef.current = { ...pod };

      // Calculate horizontal position - center above pod
      let left: number;
      let arrowLeft: number;

      if (podCenterX - tooltipWidth / 2 < 10) {
        left = 10;
        arrowLeft = podCenterX - left;
      } else if (podCenterX + tooltipWidth / 2 > screenWidth - 10) {
        left = screenWidth - tooltipWidth - 10;
        arrowLeft = podCenterX - left;
      } else {
        left = podCenterX - tooltipWidth / 2;
        arrowLeft = tooltipWidth / 2;
      }

      // Position tooltip so its BOTTOM is above the pod's TOP
      // rect.top is the top of the pod element
      const tooltipBottom = rect.top - 10; // 10px gap above pod

      setTooltipStyle({
        position: "fixed" as const,
        bottom: window.innerHeight - tooltipBottom,
        left,
        width: tooltipWidth,
        "--arrow-left": `${arrowLeft}px`,
      } as React.CSSProperties);

      setShowTooltip(true);
    });
  }, [pod]);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // CRITICAL: Stop propagation to prevent card click
      e.stopPropagation();
      e.preventDefault();

      // Copy pod name to clipboard
      const text = pod.name;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch {
          // Ignore copy failures
        }
        document.body.removeChild(ta);
      }

      // Show flash animation
      setShowCopyFlash(true);
      setTimeout(() => setShowCopyFlash(false), 300);

      // Callback for parent - this triggers namespace selection + highlight
      onCopy?.(pod);
    },
    [pod, onCopy]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        handleClick(e as unknown as React.MouseEvent);
      }
    },
    [handleClick]
  );

  const statusClass = statusClassMap[pod.status] || styles.podUnknown;
  const isRunning = pod.status === "Running";
  const capturedPod = capturedPodRef.current;

  return (
    <div
      className={styles.podClickWrapper}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Pod ${pod.name}, status ${pod.status}. Click to copy and select.`}
    >
      <motion.div
        ref={podRef}
        className={`${styles.podSquare} ${statusClass}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        transition={transitions.fast}
      >
        {isRunning && (
          <span className={`${styles.statusDot} ${styles.statusDotPulse}`} />
        )}

        <AnimatePresence>
          {showCopyFlash && (
            <motion.span
              className={styles.copyFlash}
              initial={{ opacity: 0.8, scale: 0.8 }}
              animate={{ opacity: 0, scale: 1.2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </AnimatePresence>
      </motion.div>

      {showTooltip &&
        capturedPod &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            <motion.div
              className={styles.tooltip}
              style={tooltipStyle}
              variants={tooltipVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipLabel}>Name</span>
                <span className={styles.tooltipValue}>{capturedPod.name}</span>
              </div>
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipLabel}>Status</span>
                <span className={styles.tooltipValue}>{capturedPod.status}</span>
              </div>
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipLabel}>Ready</span>
                <span className={styles.tooltipValue}>{capturedPod.ready}</span>
              </div>
              {capturedPod.ip && (
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>IP</span>
                  <span className={styles.tooltipValue}>{capturedPod.ip}</span>
                </div>
              )}
              {capturedPod.node && (
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>Node</span>
                  <span className={styles.tooltipValue}>{capturedPod.node}</span>
                </div>
              )}
              {capturedPod.restart > 0 && (
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>Restarts</span>
                  <span className={styles.tooltipValue}>
                    {capturedPod.restart}
                  </span>
                </div>
              )}
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipLabel}>Age</span>
                <span className={styles.tooltipValue}>
                  {formatAge(capturedPod.createdAt)}
                </span>
              </div>
              <div className={styles.tooltipArrow} />
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
