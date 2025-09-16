"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import AuthCheck from "../components/AuthCheck";
import { apiGet } from "../lib/api";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import YamlViewer from "../components/YamlViewer";

const API_BASE = ""; // same-origin via Next rewrite

// Status colors for pod states
const statusColors = {
  Running: "#4caf50",
  Pending: "#ff9800",
  Succeeded: "#2196f3",
  Failed: "#f44336",
  Unknown: "#9e9e9e",
};

export default function Dashboard() {
  // Basic state variables
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [namespaces, setNamespaces] = useState([]);
  const [selectedNamespace, setSelectedNamespace] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [resourceType, setResourceType] = useState("pods");
  const [resourceData, setResourceData] = useState({
    pods: [],
    services: [],
    deployments: [],
    replicaSets: [],
    statefulSets: [],
    daemonSets: [],
    jobs: [],
    cronJobs: [],
  });
  const [clusterAddress, setClusterAddress] = useState("");
  // ADD: YAML viewer state
  const [yamlOpen, setYamlOpen] = useState(false);
  const [yamlTarget, setYamlTarget] = useState(null);

  const router = useRouter();

  // ADD: auth gate
  const [authReady, setAuthReady] = useState(false);

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

  // Age timer (moved OUT of SSE effect)
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  function formatAge(iso) {
    if (!iso) return "";
    const started = Date.parse(iso);
    if (isNaN(started)) return "";
    let diff = Math.floor((now - started) / 1000);
    if (diff < 0) diff = 0;
    if (diff < 90) return `${diff}s`;
    const minutes = Math.floor(diff / 60);
    if (minutes < 90) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) {
      const remM = minutes % 60;
      return remM ? `${hours}h${remM}m` : `${hours}h`;
    }
    const days = Math.floor(hours / 24);
    if (days < 14) {
      const remH = hours % 24;
      return remH ? `${days}d${remH}h` : `${days}d`;
    }
    const weeks = Math.floor(days / 7);
    if (weeks < 8) {
      const remD = days % 7;
      return remD ? `${weeks}w${remD}d` : `${weeks}w`;
    }
    return `${days}d`;
  }

  // Simplified fetchData function
  const fetchData = async () => {
    if (!authReady) return; // guard: only load when authenticated
    try {
      setLoading(true);
      setError(null);

      const endpoints = {
        pods: "/api/pods",
        services: "/api/services",
        deployments: "/api/deployments",
        replicaSets: "/api/replicasets",
        statefulSets: "/api/statefulsets",
        daemonSets: "/api/daemonsets",
        jobs: "/api/jobs",
        cronJobs: "/api/cronjobs",
        nodes: "/api/nodes",
        namespaces: "/api/namespaces",
      };

      const promises = Object.entries(endpoints).map(async ([key, path]) => {
        const res = await fetch(`${API_BASE}${path}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Failed ${key} (${res.status})`);
        return [key, await res.json()];
      });

      const results = await Promise.all(promises);
      const dataMap = {};
      results.forEach(([k, v]) => (dataMap[k] = v));

      setNodes(dataMap.nodes || []);
      setNamespaces(dataMap.namespaces || []);

      setResourceData((prev) => ({
        ...prev,
        pods: dataMap.pods || [],
        services: dataMap.services || [],
        deployments: dataMap.deployments || [],
        replicaSets: dataMap.replicaSets || [],
        statefulSets: dataMap.statefulSets || [],
        daemonSets: dataMap.daemonSets || [],
        jobs: dataMap.jobs || [],
        cronJobs: dataMap.cronJobs || [],
      }));

      console.log("Successfully loaded", (dataMap.pods || []).length, "pods");
      console.log("Successfully loaded", (dataMap.nodes || []).length, "nodes");
      console.log(
        "Successfully loaded",
        (dataMap.namespaces || []).length,
        "namespaces"
      );
      console.log("Loaded deployments:", (dataMap.deployments || []).length);
      console.log("Loaded services:", (dataMap.services || []).length);
      console.log("Loaded replicaSets:", (dataMap.replicaSets || []).length);
      console.log("Loaded statefulSets:", (dataMap.statefulSets || []).length);
      console.log("Loaded daemonSets:", (dataMap.daemonSets || []).length);
      console.log("Loaded jobs:", (dataMap.jobs || []).length);
      console.log("Loaded cronJobs:", (dataMap.cronJobs || []).length);

      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
      setError(e.message || "Load failed");
    } finally {
      setLoading(false);
    }
  };

  // Load data only after authentication is confirmed
  useEffect(() => {
    if (!authReady) return;
    fetchData();
  }, [authReady]);

  // Helper function to get pods for a specific namespace
  const getPodsForNamespace = (namespace) => {
    return (resourceData.pods || []).filter(
      (pod) => pod.namespace === namespace
    );
  };

  // Update ResourceTable and table configs

  const getTableConfig = (type) => {
    const cfg = {
      pods: [
        ["name", "Name"],
        ["ready", "Ready"],
        ["status", "Status"],
        ["restart", "Restarts"], // fixed: backend sends "restart"
        ["age", "Age"],
        ["ip", "IP"],
        ["node", "Node"],
      ],
      services: [
        ["name", "Name"],
        ["type", "Type"],
        ["clusterIP", "Cluster IP"],
        ["externalIPs", "External IPs"],
        ["ports", "Ports"],
        ["age", "Age"],
      ],
      deployments: [
        ["name", "Name"],
        ["ready", "Ready"],
        ["upToDate", "Up-To-Date"],
        ["available", "Available"],
        ["age", "Age"],
      ],
      replicaSets: [
        ["name", "Name"],
        ["desired", "Desired"],
        ["current", "Current"],
        ["ready", "Ready"],
        ["age", "Age"],
      ],
      statefulSets: [
        ["name", "Name"],
        ["ready", "Ready"],
        ["age", "Age"],
      ],
      daemonSets: [
        ["name", "Name"],
        ["desired", "Desired"],
        ["current", "Current"],
        ["ready", "Ready"],
        ["age", "Age"],
      ],
      jobs: [
        ["name", "Name"],
        ["completions", "Completions"],
        ["duration", "Duration"],
        ["age", "Age"],
      ],
      cronJobs: [
        ["name", "Name"],
        ["schedule", "Schedule"],
        ["suspend", "Suspend"],
        ["active", "Active"],
        ["lastSchedule", "Last Schedule"],
        ["age", "Age"],
      ],
    };
    return cfg[type] || [];
  };

  // Simple ResourceTable component
  const ResourceTable = ({ type, namespace, highlightPodKey }) => {
    const data = resourceData[type] || [];
    const filtered = namespace
      ? data.filter((r) => r.namespace === namespace)
      : data;
    const columns = getTableConfig(type);
    if (!columns.length) return null;

    const rows = filtered.map((orig) => {
      const rowData = {};
      columns.forEach(([key]) => {
        rowData[key] = orig[key];
      });
      rowData.name = orig.name;
      rowData.namespace = orig.namespace;
      rowData.createdAt =
        orig.createdAt || orig.creationTimestamp || orig.startTime || null;
      return rowData;
    });

    return (
      <div className={styles.tableRegion}>
        <div className={styles.tableWrapper}>
          <div className={styles.tableInner}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {columns.map(([k, label]) => (
                    <th key={k}>{label}</th>
                  ))}
                  {/* ADD: Actions column */}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const rowKey =
                    type === "pods"
                      ? `${row.namespace || ""}/${row.name}`
                      : row.name;
                  const highlight =
                    type === "pods" && rowKey === highlightPodKey;
                  return (
                    <tr
                      key={rowKey}
                      data-pod-row={type === "pods" ? rowKey : undefined}
                      className={highlight ? styles.highlightRow : undefined}
                    >
                      {columns.map(([k]) => {
                        let value = row[k];
                        if (k === "age") value = formatAge(row.createdAt);
                        if (Array.isArray(value)) value = value.join(",");
                        if (value == null) value = "";
                        return <td key={k}>{String(value)}</td>;
                      })}
                      {/* ADD: YAML action */}
                      <td>
                        <button
                          className={styles.resourceTab}
                          onClick={() => {
                            const kind = getKindForType(type);
                            if (!kind) return;
                            setYamlTarget({
                              kind,
                              namespace: row.namespace || null,
                              name: row.name,
                            });
                            setYamlOpen(true);
                          }}
                        >
                          YAML
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // First, restore the ResourceTabs component

  const ResourceTabs = () => {
    const tabs = [
      ["pods", "Pods"],
      ["deployments", "Deployments"],
      ["services", "Services"],
      ["replicaSets", "ReplicaSets"],
      ["statefulSets", "StatefulSets"],
      ["daemonSets", "DaemonSets"],
      ["jobs", "Jobs"],
      ["cronJobs", "CronJobs"],
    ];
    return (
      <div className={styles.resourceTabs}>
        {tabs.map(([val, label]) => (
          <button
            key={val}
            className={`${styles.resourceTab} ${
              resourceType === val ? styles.activeTab : ""
            }`}
            onClick={() => setResourceType(val)}
          >
            {label}
          </button>
        ))}
      </div>
    );
  };

  // Add this component back to your Dashboard function

  const EnhancedPodSquare = ({ pod, color }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipStyle, setTooltipStyle] = useState({});
    const [capturedPod, setCapturedPod] = useState(null);
    const podRef = useRef(null);

    // Handle mouse enter with improved positioning
    const handleMouseEnter = () => {
      if (podRef.current) {
        const rect = podRef.current.getBoundingClientRect();
        const tooltipWidth = 250; // Estimated tooltip width

        // Capture pod data
        setCapturedPod({ ...pod });

        // Calculate horizontal position
        let left, arrowLeft;
        const screenWidth = window.innerWidth;
        const podCenter = rect.left + rect.width / 2;

        if (podCenter - tooltipWidth / 2 < 10) {
          // Too close to left edge - align tooltip left edge with screen edge + padding
          left = 10;
          // Arrow points to pod center relative to tooltip left edge
          arrowLeft = podCenter - left;
        } else if (podCenter + tooltipWidth / 2 > screenWidth - 10) {
          // Too close to right edge - align tooltip right edge with screen edge - padding
          left = screenWidth - tooltipWidth - 10;
          // Arrow points to pod center relative to tooltip left edge
          arrowLeft = podCenter - left;
        } else {
          // Enough space on both sides - center tooltip on pod
          left = podCenter - tooltipWidth / 2;
          // Arrow at center of tooltip
          arrowLeft = tooltipWidth / 2;
        }

        // Set complete tooltip style
        setTooltipStyle({
          top: rect.top - 10 + "px",
          left: left + "px",
          width: tooltipWidth + "px",
          transform: "translateY(-100%)",
          "--arrow-left": arrowLeft + "px",
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
              {capturedPod &&
                capturedPod.restart > 0 && ( // fixed: restart
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
  };

  useEffect(() => {
    if (!authReady) return;
    // Open multi-resource SSE
    const es = new EventSource(`${API_BASE}/api/watch/stream`, {
      withCredentials: true,
    });

    // Age formatter (shows seconds < 90s, then m, h, d)
    function normalize(kind, obj) {
      const createdAt = obj.metadata?.creationTimestamp;
      switch (kind) {
        case "Pod": {
          const containers = obj.spec?.containers || [];
          const statuses = obj.status?.containerStatuses || [];
          const ready = `${statuses.filter((c) => c.ready).length}/${
            containers.length
          }`;
          const restarts = statuses.reduce(
            (a, c) => a + (c.restartCount || 0),
            0
          );
          return {
            name: obj.metadata?.name,
            namespace: obj.metadata?.namespace,
            status: obj.status?.phase || "Unknown",
            ready,
            restart: restarts,
            ip: obj.status?.podIP || "",
            node: obj.spec?.nodeName || "",
            createdAt,
          };
        }
        case "Service": {
          const ports = (obj.spec?.ports || [])
            .map((p) => {
              const proto = (p.protocol || "").toLowerCase();
              return p.nodePort
                ? `${p.port}:${p.nodePort}/${proto}`
                : `${p.port}/${proto}`;
            })
            .join(",");
          return {
            name: obj.metadata?.name,
            namespace: obj.metadata?.namespace,
            type: obj.spec?.type,
            clusterIP: obj.spec?.clusterIP,
            externalIPs: (obj.status?.loadBalancer?.ingress || [])
              .map((i) => i.ip || i.hostname)
              .filter(Boolean)
              .concat(obj.spec?.externalIPs || []),
            ports,
            createdAt,
          };
        }
        case "Deployment": {
          const desired = obj.spec?.replicas ?? 0;
          return {
            name: obj.metadata?.name,
            namespace: obj.metadata?.namespace,
            ready: `${obj.status?.readyReplicas || 0}/${desired}`,
            upToDate: obj.status?.updatedReplicas || 0,
            available: obj.status?.availableReplicas || 0,
            createdAt,
          };
        }
        case "ReplicaSet": {
          const desired = obj.spec?.replicas ?? 0;
          return {
            name: obj.metadata?.name,
            namespace: obj.metadata?.namespace,
            desired,
            current: obj.status?.replicas || 0,
            ready: obj.status?.readyReplicas || 0,
            createdAt,
          };
        }
        case "StatefulSet": {
          const specRep = obj.spec?.replicas ?? 0;
          return {
            name: obj.metadata?.name,
            namespace: obj.metadata?.namespace,
            ready: `${obj.status?.readyReplicas || 0}/${specRep}`,
            createdAt,
          };
        }
        case "DaemonSet": {
          return {
            name: obj.metadata?.name,
            namespace: obj.metadata?.namespace,
            desired: obj.status?.desiredNumberScheduled || 0,
            current: obj.status?.currentNumberScheduled || 0,
            ready: obj.status?.numberReady || 0,
            createdAt,
          };
        }
        case "Job": {
          const completions = obj.spec?.completions ?? 0;
          return {
            name: obj.metadata?.name,
            namespace: obj.metadata?.namespace,
            completions: `${obj.status?.succeeded || 0}/${completions}`,
            duration: "-",
            createdAt,
          };
        }
        case "CronJob": {
          return {
            name: obj.metadata?.name,
            namespace: obj.metadata?.namespace,
            schedule: obj.spec?.schedule,
            suspend: !!obj.spec?.suspend,
            active: (obj.status?.active || []).length,
            lastSchedule: obj.status?.lastScheduleTime ? "" : "<none>",
            createdAt,
          };
        }
        case "Node": {
          let status = "Unknown";
          (obj.status?.conditions || []).forEach((c) => {
            if (c.type === "Ready")
              status = c.status === "True" ? "Ready" : "NotReady";
          });
          return { name: obj.metadata?.name, status, createdAt };
        }
        case "Namespace": {
          return { name: obj.metadata?.name, createdAt };
        }
      }
      return null;
    }

    const kindMap = {
      Pod: "pods",
      Service: "services",
      Deployment: "deployments",
      ReplicaSet: "replicaSets",
      StatefulSet: "statefulSets",
      DaemonSet: "daemonSets",
      Job: "jobs",
      CronJob: "cronJobs",
      Node: "nodes",
      Namespace: "namespaces",
    };

    function upsert(kind, type, object) {
      const keyName = kindMap[kind];
      if (!keyName) return;
      setResourceData((prev) => {
        const list = prev[keyName] || [];
        // Key strategy
        const makeKey = (o) => {
          if (kind === "Node" || kind === "Namespace") return o.name;
          return (o.namespace ? o.namespace + "/" : "") + o.name;
        };
        const norm = object ? normalize(kind, object) : null;
        if (!norm) return prev;
        const map = new Map(list.map((o) => [makeKey(o), o]));
        const k = makeKey(norm);
        if (type === "DELETED") {
          map.delete(k);
        } else {
          map.set(k, norm);
        }
        return { ...prev, [keyName]: Array.from(map.values()) };
      });
    }

    es.addEventListener("multi", (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (!msg.kind || !msg.type) return;
        if (msg.type === "ERROR" || msg.type === "STREAM_END") return;
        if (["SYNC", "ADDED", "MODIFIED", "DELETED"].includes(msg.type)) {
          upsert(msg.kind, msg.type, msg.object);
        }
      } catch {}
    });

    es.onerror = () => {
      console.warn("Multi-resource stream error");
    };

    return () => es.close();
  }, [authReady]);

  // fetch cluster address only when authed
  useEffect(() => {
    if (!authReady) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/check`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          const raw = data.server_url || "";
          if (raw) {
            try {
              const u = new URL(raw);
              setClusterAddress(u.host);
            } catch {
              setClusterAddress(raw);
            }
          }
        }
      } catch {}
    })();
  }, [authReady]);

  // Fallback: read what we saved at login if /api/auth/check doesn't include server_url
  useEffect(() => {
    if (clusterAddress) return;
    try {
      const saved = localStorage.getItem("licht-server-url");
      if (saved) {
        try {
          const u = new URL(saved);
          setClusterAddress(u.host);
        } catch {
          setClusterAddress(saved);
        }
      }
    } catch {}
  }, [clusterAddress]);

  // logout handler
  function handleLogout() {
    fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).finally(() => router.push("/login"));
  }

  // Highlight pod key for UI feedback
  const [highlightPodKey, setHighlightPodKey] = useState(null);
  const highlightTimerRef = useRef(null);

  function triggerPodHighlight(ns, name) {
    const key = `${ns}/${name}`;
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightPodKey(key);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightPodKey(null);
      highlightTimerRef.current = null;
    }, 2000);
  }

  // Optional: render guard to avoid flashing unauth state
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
        <div className={styles.main}>
          <div className={styles.centerShell}>
            <div className={styles.centerContent}>
              <h1 className={styles.pageTitle}>Licht</h1>
              <div className={styles.clusterLine}>
                <span className={styles.clusterHost}>
                  {clusterAddress || "Cluster unbekannt"}
                </span>
                <button className={styles.logoutButton} onClick={handleLogout}>
                  Logout
                </button>
              </div>

              {/* Namespace heading */}
              <h2 className={styles.sectionTitle}>Namespaces</h2>

              {/* Namespace grid */}
              <div className={styles.namespaceGrid}>
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
                    typeof ns === "string" ? ns : ns.name || ns.Name;
                  const namespacePods = getPodsForNamespace(nsName);
                  const podCount = namespacePods.length;

                  const visibleColumns = computeVisibleColumns(podCount);

                  // Width logic:
                  // <=12 pods -> fixed width for BASE_COLUMNS
                  // >12 pods -> width for visibleColumns
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
                    >
                      <div
                        className={styles.miniPodPreview}
                        style={{
                          gridTemplateColumns: `repeat(${visibleColumns}, ${POD_SIZE}px)`,
                          gridAutoRows: `${POD_SIZE}px`,
                          gap: `${POD_GAP}px`,
                          height:
                            podCount <= 12 ? `${BASE_GRID_HEIGHT}px` : "auto",
                        }}
                      >
                        {podCount > 0 ? (
                          namespacePods.map((pod, idx) => (
                            <div
                              key={pod.name + idx}
                              className={styles.miniPodClickWrap}
                              onClick={(e) => {
                                e.stopPropagation();
                                const el = e.currentTarget;
                                // Copy pod name
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
                                // Switch UI context
                                setResourceType("pods");
                                setSelectedNamespace(pod.namespace);
                                triggerPodHighlight(pod.namespace, pod.name);

                                // Flash animation
                                if (el) {
                                  el.classList.add(styles.copiedFlash);
                                  setTimeout(() => {
                                    if (el)
                                      el.classList.remove(styles.copiedFlash);
                                  }, 350);
                                }

                                // Scroll target row after table re-renders
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
                                  statusColors[pod.status] ||
                                  statusColors.Unknown
                                }
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
              </div>

              {/* Update / controls */}
              <h2 className={styles.sectionTitle}>Content</h2>

              {/* MOVED: Tabs now below refresh, above table */}
              <ResourceTabs />
              <ResourceTable
                type={resourceType}
                namespace={selectedNamespace}
                highlightPodKey={highlightPodKey}
              />
            </div>
          </div>
        </div>
        {/* ADD: YAML modal */}
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

// Replace / add the computeColumns with dynamic width aware logic
const POD_SIZE = 40;
const POD_GAP = 5;
const H_PADDING = 28;
const BASE_COLUMNS = 4;
const BASE_ROWS = 3;
const BASE_GRID_HEIGHT = BASE_ROWS * POD_SIZE + (BASE_ROWS - 1) * POD_GAP;

function calcWidthForColumns(cols) {
  return cols * POD_SIZE + (cols - 1) * POD_GAP + H_PADDING;
}
function computeVisibleColumns(podCount) {
  if (podCount <= 0) return 1;
  if (podCount <= BASE_COLUMNS) return podCount;
  if (podCount <= 12) return BASE_COLUMNS;
  return Math.ceil(podCount / 3);
}

// Map table type -> Kubernetes Kind for the YAML endpoint
const kindByType = {
  pods: "Pod",
  services: "Service",
  deployments: "Deployment",
  replicaSets: "ReplicaSet",
  statefulSets: "StatefulSet",
  daemonSets: "DaemonSet",
  jobs: "Job",
  cronJobs: "CronJob",
  nodes: "Node",
  namespaces: "Namespace",
};
function getKindForType(type) {
  return kindByType[type] || null;
}
