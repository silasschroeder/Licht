"use client";

import styles from "./ResourceRail.module.css";

// The views the rail navigates. The 8 ResourceType kinds plus the two
// cluster-scoped views (namespaces, nodes). Short mono marks instead of icons,
// in keeping with the monospace identity.
export type RailView =
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

const VIEWS: { key: RailView; label: string; mark: string }[] = [
  { key: "namespaces", label: "Namespaces", mark: "ns" },
  { key: "nodes", label: "Nodes", mark: "no" },
  { key: "pods", label: "Pods", mark: "po" },
  { key: "deployments", label: "Deployments", mark: "de" },
  { key: "services", label: "Services", mark: "sv" },
  { key: "replicaSets", label: "ReplicaSets", mark: "rs" },
  { key: "statefulSets", label: "StatefulSets", mark: "ss" },
  { key: "daemonSets", label: "DaemonSets", mark: "ds" },
  { key: "jobs", label: "Jobs", mark: "jo" },
  { key: "cronJobs", label: "CronJobs", mark: "cj" },
];

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
  return (
    <nav
      className={`${styles.rail} ${collapsed ? styles.collapsed : ""}`}
      aria-label="Resource types"
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
      <ul className={styles.list}>
        {VIEWS.map((v) => {
          const isActive = v.key === active;
          const count = counts[v.key] ?? 0;
          return (
            <li key={v.key}>
              <button
                className={`${styles.item} ${isActive ? styles.active : ""}`}
                onClick={() => onSelect(v.key)}
                aria-current={isActive ? "page" : undefined}
                title={v.label}
              >
                <span className={styles.mark}>{v.mark}</span>
                <span className={styles.label}>{v.label}</span>
                {count > 0 && <span className={styles.count}>{count}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
