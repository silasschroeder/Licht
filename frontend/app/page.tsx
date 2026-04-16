"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import AuthCheck from "../components/AuthCheck";
import ResourceTable from "../components/ResourceTable";
import ResourceTabs from "../components/ResourceTabs";
import YamlViewer from "../components/YamlViewer";
import { useKubernetesData } from "../hooks/useKubernetesData";
import { Pod, ResourceType } from "@/types/kubernetes";
import styles from "./page.module.css";

const API_BASE = "";

const statusColors = {
  Running: "#4caf50",
  Pending: "#ff9800",
  Succeeded: "#2196f3",
  Failed: "#f44336",
  Unknown: "#9e9e9e",
};

// Namespace grid layout constants
const POD_SIZE = 40;
const POD_GAP = 5;
const H_PADDING = 28;
const BASE_COLUMNS = 4;
const BASE_ROWS = 3;
const BASE_GRID_HEIGHT = BASE_ROWS * POD_SIZE + (BASE_ROWS - 1) * POD_GAP;

function calcWidthForColumns(cols: number): number {
  return cols * POD_SIZE + (cols - 1) * POD_GAP + H_PADDING;
}

function computeVisibleColumns(podCount: number): number {
  if (podCount <= 0) return 1;
  if (podCount <= BASE_COLUMNS) return podCount;
  if (podCount <= 12) return BASE_COLUMNS;
  return Math.ceil(podCount / 3);
}

interface EnhancedPodSquareProps {
  pod: Pod;
  color: string;
  formatAge: (createdAt: string | null | undefined) => string;
}

function EnhancedPodSquare({ pod, color, formatAge }: EnhancedPodSquareProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [capturedPod, setCapturedPod] = useState<Pod | null>(null);
  const podRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (podRef.current) {
      const rect = podRef.current.getBoundingClientRect();
      const tooltipWidth = 250;

      setCapturedPod({ ...pod });

      let left: number, arrowLeft: number;
      const screenWidth = window.innerWidth;
      const podCenter = rect.left + rect.width / 2;

      if (podCenter - tooltipWidth / 2 < 10) {
        left = 10;
        arrowLeft = podCenter - left;
      } else if (podCenter + tooltipWidth / 2 > screenWidth - 10) {
        left = screenWidth - tooltipWidth - 10;
        arrowLeft = podCenter - left;
      } else {
        left = podCenter - tooltipWidth / 2;
        arrowLeft = tooltipWidth / 2;
      }

      setTooltipStyle({
        top: rect.top - 10 + "px",
        left: left + "px",
        width: tooltipWidth + "px",
        transform: "translateY(-100%)",
        ["--arrow-left" as any]: arrowLeft + "px",
      });

      setShowTooltip(true);
    }
  };

  return (
    <div
      ref={podRef}
      className={styles.miniPod}
      style={{ backgroundColor: color }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {showTooltip &&
        capturedPod &&
        createPortal(
          <div className={styles.podTooltip} style={tooltipStyle}>
            <div className={styles.podTooltipLine}>
              <strong>Name:</strong> {capturedPod.name}
            </div>
            <div className={styles.podTooltipLine}>
              <strong>Status:</strong> {capturedPod.status}
            </div>
            <div className={styles.podTooltipLine}>
              <strong>Ready:</strong> {capturedPod.ready}
            </div>
            {capturedPod.ip && (
              <div className={styles.podTooltipLine}>
                <strong>IP:</strong> {capturedPod.ip}
              </div>
            )}
            {capturedPod.node && (
              <div className={styles.podTooltipLine}>
                <strong>Node:</strong> {capturedPod.node}
              </div>
            )}
            {capturedPod.restart > 0 && (
              <div className={styles.podTooltipLine}>
                <strong>Restarts:</strong> {capturedPod.restart}
              </div>
            )}
            <div className={styles.podTooltipLine}>
              <strong>Age:</strong> {formatAge(capturedPod.createdAt)}
            </div>
            <div className={styles.podTooltipArrow}></div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(
    null
  );
  const [resourceType, setResourceType] = useState<ResourceType>("pods");
  const [yamlOpen, setYamlOpen] = useState(false);
  const [yamlTarget, setYamlTarget] = useState<{
    kind: string;
    namespace: string | null;
    name: string;
  } | null>(null);
  const [highlightPodKey, setHighlightPodKey] = useState<string | null>(null);
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

  function getPodsForNamespace(namespace: string): Pod[] {
    return (resourceData.pods || []).filter(
      (pod) => pod.namespace === namespace
    );
  }

  function triggerPodHighlight(ns: string, name: string) {
    const key = `${ns}/${name}`;
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightPodKey(key);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightPodKey(null);
      highlightTimerRef.current = null;
    }, 2000);
  }

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
              <header>
                <h1 className={styles.pageTitle}>Licht</h1>
                <div className={styles.clusterLine}>
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
              </header>

              <section aria-labelledby="namespaces-heading">
                <h2 id="namespaces-heading" className={styles.sectionTitle}>
                  Namespaces
                </h2>

                <nav
                  className={styles.namespaceGrid}
                  aria-label="Namespace selection"
                >
                  {[
                    ...new Map(
                      (namespaces || []).map((ns) => {
                        const name =
                          typeof ns === "string" ? ns : ns.name || ns.Name;
                        return [name, ns];
                      })
                    ).values(),
                  ].map((ns) => {
                    const nsName =
                      typeof ns === "string" ? ns : (ns.name || ns.Name || "");
                    const namespacePods = getPodsForNamespace(nsName);
                    const podCount = namespacePods.length;

                    const visibleColumns = computeVisibleColumns(podCount);
                    const widthColumns =
                      podCount <= 12 ? BASE_COLUMNS : visibleColumns;
                    const cardWidth = calcWidthForColumns(widthColumns);

                    return (
                      <div
                        key={nsName}
                        className={`${styles.namespaceSquare} ${
                          nsName === selectedNamespace
                            ? styles.selectedSquare
                            : ""
                        }`}
                        style={{ width: `${cardWidth}px` }}
                        onClick={() =>
                          setSelectedNamespace(
                            selectedNamespace === nsName ? null : nsName
                          )
                        }
                        role="button"
                        tabIndex={0}
                        aria-pressed={nsName === selectedNamespace}
                        aria-label={`Namespace ${nsName} with ${podCount} pods`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedNamespace(
                              selectedNamespace === nsName ? null : nsName
                            );
                          }
                        }}
                      >
                        <div
                          className={styles.miniPodPreview}
                          style={{
                            gridTemplateColumns: `repeat(${visibleColumns}, ${POD_SIZE}px)`,
                            gridAutoRows: `${POD_SIZE}px`,
                            gap: `${POD_GAP}px`,
                            height:
                              podCount <= 12
                                ? `${BASE_GRID_HEIGHT}px`
                                : "auto",
                          }}
                        >
                          {podCount > 0 ? (
                            namespacePods.map((pod, idx) => (
                              <div
                                key={pod.uid || pod.name + idx}
                                className={styles.miniPodClickWrap}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const el = e.currentTarget;
                                  const text = pod.name;
                                  if (navigator.clipboard?.writeText) {
                                    navigator.clipboard
                                      .writeText(text)
                                      .catch(() => {});
                                  } else {
                                    const ta = document.createElement("textarea");
                                    ta.value = text;
                                    ta.style.position = "fixed";
                                    ta.style.opacity = "0";
                                    document.body.appendChild(ta);
                                    ta.select();
                                    try {
                                      document.execCommand("copy");
                                    } catch {}
                                    document.body.removeChild(ta);
                                  }
                                  setResourceType("pods");
                                  setSelectedNamespace(pod.namespace);
                                  triggerPodHighlight(pod.namespace, pod.name);

                                  if (el) {
                                    el.classList.add(styles.copiedFlash);
                                    setTimeout(() => {
                                      if (el)
                                        el.classList.remove(styles.copiedFlash);
                                    }, 350);
                                  }

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
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label={`Pod ${pod.name}, status ${pod.status}`}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    e.currentTarget.click();
                                  }
                                }}
                              >
                                <EnhancedPodSquare
                                  pod={pod}
                                  color={
                                    statusColors[
                                      pod.status as keyof typeof statusColors
                                    ] || statusColors.Unknown
                                  }
                                  formatAge={formatAge}
                                />
                              </div>
                            ))
                          ) : (
                            <div className={styles.emptyNamespaceIndicator}>
                              No Pods
                            </div>
                          )}
                        </div>
                        <div className={styles.namespaceName}>{nsName}</div>
                        <div className={styles.podCount}>{podCount} pods</div>
                      </div>
                    );
                  })}
                </nav>
              </section>

              <section aria-labelledby="content-heading">
                <h2 id="content-heading" className={styles.sectionTitle}>
                  Content
                </h2>

                <ResourceTabs
                  activeType={resourceType}
                  onTabChange={setResourceType}
                />
                <ResourceTable
                  type={resourceType}
                  namespace={selectedNamespace}
                  data={resourceData[resourceType]}
                  highlightPodKey={highlightPodKey}
                  formatAge={formatAge}
                  onYamlClick={(kind, namespace, name) => {
                    setYamlTarget({ kind, namespace, name });
                    setYamlOpen(true);
                  }}
                />
              </section>
            </div>
          </div>
        </main>

        {yamlTarget && (
          <YamlViewer
            kind={yamlTarget.kind}
            namespace={yamlTarget.namespace}
            name={yamlTarget.name}
            open={yamlOpen}
            onClose={() => setYamlOpen(false)}
          />
        )}
      </AuthCheck>
    </div>
  );
}
