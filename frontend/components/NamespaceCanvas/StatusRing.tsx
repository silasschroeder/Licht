"use client";

import React from "react";
import styles from "./NamespaceCanvas.module.css";

interface StatusRingProps {
  running: number;
  pending: number;
  failed: number;
  succeeded: number;
  total: number;
}

/**
 * SVG circular status indicator showing pod health ratio
 */
export function StatusRing({
  running,
  pending,
  failed,
  succeeded,
  total,
}: StatusRingProps) {
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const center = 16;

  if (total === 0) {
    return (
      <svg className={styles.statusRing} viewBox="0 0 32 32">
        <circle
          className={styles.statusRingBg}
          cx={center}
          cy={center}
          r={radius}
        />
      </svg>
    );
  }

  // Calculate segment lengths
  const segments = [
    { count: running, color: "var(--status-running)" },
    { count: pending, color: "var(--status-pending)" },
    { count: failed, color: "var(--status-failed)" },
    { count: succeeded, color: "var(--status-succeeded)" },
  ].filter((s) => s.count > 0);

  let offset = 0;

  return (
    <svg className={styles.statusRing} viewBox="0 0 32 32">
      <circle
        className={styles.statusRingBg}
        cx={center}
        cy={center}
        r={radius}
      />
      {segments.map((segment, i) => {
        const length = (segment.count / total) * circumference;
        const dashArray = `${length} ${circumference - length}`;
        const rotation = (offset / circumference) * 360 - 90;
        offset += length;

        return (
          <circle
            key={i}
            className={styles.statusRingSegment}
            cx={center}
            cy={center}
            r={radius}
            stroke={segment.color}
            strokeDasharray={dashArray}
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        );
      })}
    </svg>
  );
}
