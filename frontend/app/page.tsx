"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ResourceTable from "../components/ResourceTable";
import { NamespaceCanvas } from "../components/NamespaceCanvas";
import { ResourceExplorer } from "../components/ResourceExplorer";
import { QuickFilter } from "../components/QuickFilter";
import { ResourceDrawer } from "../components/ResourceDrawer";
import { AppShell, RailView } from "../components/AppShell";
import { Home } from "../components/Home";
import { HealthView } from "../components/HealthView";
import { useKubernetesData } from "../hooks/useKubernetesData";
import { useTheme } from "../hooks/useTheme";
import { Pod, ResourceType } from "@/types/kubernetes";
import styles from "./page.module.css";

const RESOURCE_KINDS: ResourceType[] = [
  "pods",
  "services",
  "deployments",
  "replicaSets",
  "statefulSets",
  "daemonSets",
  "jobs",
  "cronJobs",
];

const VIEW_TITLES: Record<RailView, string> = {
  home: "Home",
  health: "Health",
  namespaces: "Namespaces",
  nodes: "Nodes",
  pods: "Pods",
  deployments: "Deployments",
  services: "Services",
  replicaSets: "ReplicaSets",
  statefulSets: "StatefulSets",
  daemonSets: "DaemonSets",
  jobs: "Jobs",
  cronJobs: "CronJobs",
};

export default function Dashboard() {
  const [activeView, setActiveView] = useState<RailView>("home");
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(
    null
  );
  const [yamlOpen, setYamlOpen] = useState(false);
  const [drawerTarget, setDrawerTarget] = useState<{
    kind: string;
    namespace: string | null;
    name: string;
  } | null>(null);
  const [highlightPodKey, setHighlightPodKey] = useState<string | null>(null);
  const [quickFilterOpen, setQuickFilterOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { theme, toggle: toggleTheme } = useTheme();

  // Age timer
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Format age from ISO time
  function formatAge(iso: string | null | undefined): string {
    if (!iso) return "-";
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return "-";
    let s = Math.max(0, Math.floor((now - ts) / 1000));
    const d = Math.floor(s / 86400);
    s -= d * 86400;
    const h = Math.floor(s / 3600);
    s -= h * 3600;
    const m = Math.floor(s / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  const {
    resourceData,
    nodes,
    namespaces,
    lastUpdated,
    connectionState,
    counts,
    recent,
  } = useKubernetesData();

  const openDrawer = useCallback(
    (kind: string, namespace: string | null, name: string) => {
      setDrawerTarget({ kind, namespace, name });
      setYamlOpen(true);
    },
    []
  );

  // Handle pod selection from NamespaceCanvas
  const handlePodSelect = useCallback((pod: Pod) => {
    setActiveView("pods");
    setSelectedNamespace(pod.namespace);

    const key = `${pod.namespace}/${pod.name}`;
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightPodKey(key);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightPodKey(null);
      highlightTimerRef.current = null;
    }, 2000);

    setTimeout(() => {
      const rowEl = document.querySelector(
        `[data-pod-row="${pod.namespace}/${pod.name}"]`
      );
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 140);
  }, []);

  // Keyboard shortcut for quick filter (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setQuickFilterOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle resource selection from QuickFilter
  const handleQuickFilterSelect = useCallback(
    (type: ResourceType, name: string, namespace: string | null) => {
      setActiveView(type);
      if (namespace) setSelectedNamespace(namespace);
    },
    []
  );

  const isResourceKind = RESOURCE_KINDS.includes(activeView as ResourceType);

  return (
    <AppShell
      activeView={activeView}
      counts={counts}
      onViewSelect={setActiveView}
      railCollapsed={railCollapsed}
      onToggleRail={() => setRailCollapsed((c) => !c)}
      namespaces={(namespaces || []).map((n) => n.name)}
      selectedNamespace={selectedNamespace}
      onNamespaceChange={setSelectedNamespace}
      connectionState={connectionState}
      lastUpdated={lastUpdated}
      onSearchClick={() => setQuickFilterOpen(true)}
      theme={theme}
      onToggleTheme={toggleTheme}
    >
      {activeView !== "home" && activeView !== "health" && (
        <div className={styles.viewHeader}>
          <h1 className={styles.viewTitle}>{VIEW_TITLES[activeView]}</h1>
        </div>
      )}

      {activeView === "home" && (
        <Home
          resourceData={resourceData}
          nodes={nodes || []}
          namespaces={namespaces || []}
          counts={counts}
          connectionState={connectionState}
          lastUpdated={lastUpdated}
          recent={recent}
          now={now}
          onViewSelect={setActiveView}
          onNamespaceSelect={setSelectedNamespace}
          onPodSelect={handlePodSelect}
          formatAge={formatAge}
        />
      )}

      {activeView === "health" && <HealthView />}

      {activeView === "namespaces" && (
        <NamespaceCanvas
          namespaces={namespaces || []}
          pods={resourceData.pods || []}
          selectedNamespace={selectedNamespace}
          onNamespaceSelect={setSelectedNamespace}
          onPodSelect={handlePodSelect}
          formatAge={formatAge}
        />
      )}

      {activeView === "nodes" && (
        <ul className={styles.nodeList}>
          {(nodes || []).map((node) => (
            <li key={node.name} className={styles.nodeRow}>
              <button
                className={styles.nodeName}
                onClick={() => openDrawer("Node", null, node.name)}
              >
                {node.name}
              </button>
              <span className={styles.nodeMeta}>{node.status || "-"}</span>
              <span className={styles.nodeMeta}>{node.roles || "-"}</span>
              <span className={styles.nodeMeta}>{node.version || "-"}</span>
              <span className={styles.nodeMeta}>{node.age || "-"}</span>
            </li>
          ))}
          {(nodes || []).length === 0 && (
            <li className={styles.emptyView}>no nodes visible</li>
          )}
        </ul>
      )}

      {isResourceKind && (
        <ResourceExplorer
          resourceType={activeView as ResourceType}
          resourceData={resourceData}
          namespace={selectedNamespace}
          onYamlClick={openDrawer}
          formatAge={formatAge}
          renderTable={() => (
            <ResourceTable
              type={activeView as ResourceType}
              namespace={selectedNamespace}
              data={resourceData[activeView as ResourceType]}
              highlightPodKey={highlightPodKey}
              formatAge={formatAge}
              onYamlClick={openDrawer}
            />
          )}
        />
      )}
      {/* Topology view disabled for now (not shown on any view). */}

      <ResourceDrawer
        isOpen={yamlOpen}
        onClose={() => setYamlOpen(false)}
        kind={drawerTarget?.kind || ""}
        name={drawerTarget?.name || ""}
        namespace={drawerTarget?.namespace || null}
        resourceData={resourceData}
        formatAge={formatAge}
      />

      <QuickFilter
        isOpen={quickFilterOpen}
        onClose={() => setQuickFilterOpen(false)}
        resourceData={resourceData}
        onSelectResource={handleQuickFilterSelect}
        onFilterChange={() => {}}
      />
    </AppShell>
  );
}
