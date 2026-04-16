"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import AuthCheck from "../components/AuthCheck";
import ResourceTable from "../components/ResourceTable";
import ResourceTabs from "../components/ResourceTabs";
import { NamespaceCanvas } from "../components/NamespaceCanvas";
import { ResourceExplorer, TopologySection } from "../components/ResourceExplorer";
import { QuickFilter } from "../components/QuickFilter";
import { ResourceDrawer } from "../components/ResourceDrawer";
import { useKubernetesData } from "../hooks/useKubernetesData";
import { Pod, ResourceType } from "@/types/kubernetes";
import styles from "./page.module.css";

const API_BASE = "";

// Logo icon component - matches login page
const LichtLogoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

export default function Dashboard() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(
    null
  );
  const [resourceType, setResourceType] = useState<ResourceType>("pods");
  const [yamlOpen, setYamlOpen] = useState(false);
  const [drawerTarget, setDrawerTarget] = useState<{
    kind: string;
    namespace: string | null;
    name: string;
  } | null>(null);
  const [highlightPodKey, setHighlightPodKey] = useState<string | null>(null);
  const [quickFilterOpen, setQuickFilterOpen] = useState(false);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Auth check
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/check`, {
          credentials: "include",
        });
        if (cancelled) return;
        if (res.ok) {
          setAuthReady(true);
        } else {
          setAuthReady(false);
          router.push("/login");
        }
      } catch {
        if (!cancelled) {
          setAuthReady(false);
          router.push("/login");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Use custom hook for data fetching
  const {
    resourceData,
    nodes,
    namespaces,
    loading,
    error,
    lastUpdated,
    clusterAddress,
    fetchData,
  } = useKubernetesData(authReady);

  // Handle pod selection from NamespaceCanvas
  const handlePodSelect = useCallback((pod: Pod) => {
    setResourceType("pods");
    setSelectedNamespace(pod.namespace);

    // Trigger highlight
    const key = `${pod.namespace}/${pod.name}`;
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightPodKey(key);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightPodKey(null);
      highlightTimerRef.current = null;
    }, 2000);

    // Scroll to row
    setTimeout(() => {
      const rowEl = document.querySelector(
        `[data-pod-row="${pod.namespace}/${pod.name}"]`
      );
      if (rowEl) {
        rowEl.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
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
      setResourceType(type);
      if (namespace) {
        setSelectedNamespace(namespace);
      }
      // Could also trigger highlight here if needed
    },
    []
  );

  function handleLogout() {
    fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).finally(() => router.push("/login"));
  }

  if (!authReady) {
    return (
      <div className={styles.page}>
        <div className={styles.main}>
          <div className={styles.centerShell}>
            <div className={styles.centerContent}>Authorizing…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <AuthCheck>
        <main className={styles.main}>
          <div className={styles.centerShell}>
            <div className={styles.centerContent}>
              <header className={styles.header}>
                <div className={styles.branding}>
                  <div className={styles.logoIcon}>
                    <LichtLogoIcon />
                  </div>
                  <h1 className={styles.pageTitle}>Licht</h1>
                  <span className={styles.tagline}>Kubernetes Dashboard</span>
                </div>
                <div className={styles.headerActions}>
                  <button
                    className={styles.searchButton}
                    onClick={() => setQuickFilterOpen(true)}
                    aria-label="Search resources"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <span>Search</span>
                    <kbd className={styles.kbd}>K</kbd>
                  </button>
                  <div className={styles.clusterInfo}>
                    <span className={styles.clusterHost}>
                      {clusterAddress || "Cluster unbekannt"}
                    </span>
                    <button
                      className={styles.logoutButton}
                      onClick={handleLogout}
                      aria-label="Logout"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </header>

              <section aria-labelledby="namespaces-heading">
                <h2 id="namespaces-heading" className={styles.sectionTitle}>
                  Namespaces
                </h2>

                <NamespaceCanvas
                  namespaces={namespaces || []}
                  pods={resourceData.pods || []}
                  selectedNamespace={selectedNamespace}
                  onNamespaceSelect={setSelectedNamespace}
                  onPodSelect={handlePodSelect}
                  formatAge={formatAge}
                />
              </section>

              <section aria-labelledby="content-heading">
                <h2 id="content-heading" className={styles.sectionTitle}>
                  Content
                </h2>

                <ResourceTabs
                  activeType={resourceType}
                  onTabChange={setResourceType}
                />

                <ResourceExplorer
                  resourceType={resourceType}
                  resourceData={resourceData}
                  namespace={selectedNamespace}
                  onYamlClick={(kind, namespace, name) => {
                    setDrawerTarget({ kind, namespace, name });
                    setYamlOpen(true);
                  }}
                  formatAge={formatAge}
                  renderTable={() => (
                    <ResourceTable
                      type={resourceType}
                      namespace={selectedNamespace}
                      data={resourceData[resourceType]}
                      highlightPodKey={highlightPodKey}
                      formatAge={formatAge}
                      onYamlClick={(kind, namespace, name) => {
                        setDrawerTarget({ kind, namespace, name });
                        setYamlOpen(true);
                      }}
                    />
                  )}
                />
              </section>

              <TopologySection
                resourceData={resourceData}
                selectedNamespace={selectedNamespace}
                onResourceClick={(type, name, namespace) => {
                  setResourceType(type);
                  if (namespace) {
                    setSelectedNamespace(namespace);
                  }
                  // Optionally open drawer for clicked resource
                  setDrawerTarget({ kind: type, namespace, name });
                  setYamlOpen(true);
                }}
              />
            </div>
          </div>
        </main>

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
      </AuthCheck>
    </div>
  );
}
