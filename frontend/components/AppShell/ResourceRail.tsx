"use client";

import { useState } from "react";
import styles from "./ResourceRail.module.css";

// All views the rail can navigate. Home is standalone; the rest live under a
// group. Short mono marks instead of icons, matching the monospace identity.
export type RailView =
  | "home"
  | "health"
  | "namespaces"
  | "nodes"
  | "pods"
  | "deployments"
  | "services"
  | "replicaSets"
  | "statefulSets"
  | "daemonSets"
  | "jobs"
  | "cronJobs";

type GroupId = "troubleshooting" | "resources";

interface RailItem {
  key: RailView;
  label: string;
  mark: string;
  group?: GroupId; // absent = standalone top-level entry
}

// Order in this array IS render order. Add a future child by inserting a row
// with the right group; no other change needed.
const ITEMS: RailItem[] = [
  { key: "home", label: "Home", mark: "ho" },
  { key: "health", label: "Health", mark: "he", group: "troubleshooting" },
  { key: "namespaces", label: "Namespaces", mark: "ns", group: "resources" },
  { key: "nodes", label: "Nodes", mark: "no", group: "resources" },
  { key: "pods", label: "Pods", mark: "po", group: "resources" },
  { key: "deployments", label: "Deployments", mark: "de", group: "resources" },
  { key: "services", label: "Services", mark: "sv", group: "resources" },
  { key: "replicaSets", label: "ReplicaSets", mark: "rs", group: "resources" },
  { key: "statefulSets", label: "StatefulSets", mark: "ss", group: "resources" },
  { key: "daemonSets", label: "DaemonSets", mark: "ds", group: "resources" },
  { key: "jobs", label: "Jobs", mark: "jo", group: "resources" },
  { key: "cronJobs", label: "CronJobs", mark: "cj", group: "resources" },
];

const GROUP_LABELS: Record<GroupId, string> = {
  troubleshooting: "Troubleshooting",
  resources: "Resources",
};

interface ResourceRailProps {
  active: RailView;
  counts: Record<string, number>;
  onSelect: (view: RailView) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function ResourceRail({
  active,
  counts,
  onSelect,
  collapsed,
  onToggleCollapsed,
}: ResourceRailProps) {
  const [open, setOpen] = useState<Record<GroupId, boolean>>({
    troubleshooting: true,
    resources: true,
  });

  // The group holding the active view is always treated as open, so a folded
  // group can never hide the current view (e.g. after a Cmd+K jump).
  const activeGroup = ITEMS.find((i) => i.key === active)?.group;

  const renderItem = (item: RailItem) => {
    const isActive = item.key === active;
    const count = counts[item.key] ?? 0;
    const isChild = !!item.group;
    return (
      <li key={item.key}>
        <button
          className={`${styles.item} ${isChild ? styles.child : ""} ${
            isActive ? styles.active : ""
          }`}
          onClick={() => onSelect(item.key)}
          aria-current={isActive ? "page" : undefined}
          title={item.label}
        >
          <span className={styles.mark}>{item.mark}</span>
          <span className={styles.label}>{item.label}</span>
          {count > 0 && <span className={styles.count}>{count}</span>}
        </button>
      </li>
    );
  };

  const rows: React.ReactNode[] = [];
  let prevGroup: GroupId | undefined;
  for (const item of ITEMS) {
    // Emit a group header when entering a new group (expanded mode only).
    if (item.group && item.group !== prevGroup && !collapsed) {
      const g = item.group;
      rows.push(
        <li key={`group-${g}`}>
          <button
            className={styles.groupHeader}
            onClick={() => setOpen((o) => ({ ...o, [g]: !o[g] }))}
            aria-expanded={open[g] || activeGroup === g}
          >
            <span className={styles.chevron} aria-hidden>
              {open[g] || activeGroup === g ? "▾" : "▸"}
            </span>
            <span className={styles.groupLabel}>{GROUP_LABELS[g]}</span>
          </button>
        </li>
      );
    }
    prevGroup = item.group;

    // In expanded mode, hide children of a folded group (unless it is active).
    if (item.group && !collapsed) {
      const groupOpen = open[item.group] || activeGroup === item.group;
      if (!groupOpen) continue;
    }
    rows.push(renderItem(item));
  }

  return (
    <nav
      className={`${styles.rail} ${collapsed ? styles.collapsed : ""}`}
      aria-label="Navigation"
    >
      <div className={styles.logo}>
        <button
          className={styles.logoMark}
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          L
        </button>
        <span className={styles.logoWord}>Licht</span>
        <button
          className={styles.collapseButton}
          onClick={onToggleCollapsed}
          aria-label="Collapse sidebar"
        >
          «
        </button>
      </div>
      <ul className={styles.list}>{rows}</ul>
    </nav>
  );
}
