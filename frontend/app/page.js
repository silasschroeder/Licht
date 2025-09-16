"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import AuthCheck from "../components/AuthCheck";
import { apiGet } from "../lib/api";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import YamlViewer from "../components/YamlViewer";

// Ensure API_BASE stays same-origin (empty string) to leverage Next.js rewrites
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

  // Age timer (ensures re-render periodically)
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000); // every 30s
    return () => clearInterval(id);
  }, []);

  // Format "age" from ISO time using current "now"
  function formatAge(iso) {
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

  // Track if SSE already delivered pod data
  const ssePodsActiveRef = useRef(false);

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

      // helper: add createdAt if missing (for raw K8s objects)
      const withCreatedAt = (arr) =>
        Array.isArray(arr)
          ? arr.map((o) => ({
              ...o,
              createdAt:
                o.createdAt ??
                o?.metadata?.creationTimestamp ??
                o?.status?.startTime ??
                null,
            }))
          : [];

      setResourceData((prev) => ({
        ...prev,
        // IMPORTANT: keep SSE-updated pods; only set from fetch if SSE not active yet
        pods: ssePodsActiveRef.current
          ? prev.pods
          : withCreatedAt(dataMap.pods || []),
        services: withCreatedAt(dataMap.services || []),
        deployments: withCreatedAt(dataMap.deployments || []),
        replicaSets: withCreatedAt(dataMap.replicaSets || []),
        statefulSets: withCreatedAt(dataMap.statefulSets || []),
        daemonSets: withCreatedAt(dataMap.daemonSets || []),
        jobs: withCreatedAt(dataMap.jobs || []),
        cronJobs: withCreatedAt(dataMap.cronJobs || []),
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
      // Fallbacks for raw K8s objects
      rowData.name = orig.name ?? orig.metadata?.name ?? orig.Name ?? "";
      rowData.namespace =
        orig.namespace ?? orig.metadata?.namespace ?? orig.Namespace ?? "";
      rowData.createdAt =
        orig.createdAt ??
        orig.metadata?.creationTimestamp ??
        orig.creationTimestamp ??
        orig.status?.startTime ??
        null;
      return rowData;
    });

    // Render helper: compute Age from createdAt
    const renderCell = (row, col) => {
      if (col.key === "age") return formatAge(row.createdAt);
      return row[col.key] ?? "";
    };

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
                        const value =
                          k === "age" ? formatAge(row.createdAt) : row[k] ?? "";
                        return <td key={k}>{String(value)}</td>;
                      })}
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

  // array helpers used by SSE handler
  const upsert = (arr, isSame, item) => {
    const i = arr.findIndex(isSame);
    if (i === -1) arr.push(item);
    else arr[i] = item;
    return arr;
  };
  const rm = (arr, isSame) => {
    const i = arr.findIndex(isSame);
    if (i !== -1) arr.splice(i, 1);
    return arr;
  };

  // Live-Updates über Multi-Stream (Pods, Services, Deployments, …)
  useEffect(() => {
    if (!authReady) return;

    const sseBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
    const es = new EventSource(`${sseBase}/api/watch/stream`, {
      withCredentials: true,
    });

    const onOpen = () => {};
    const onError = () => {};
    const handle = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      const kind = msg.kind;
      const t = msg.type;
      const o = msg.object || {};
      const createdAt =
        o?.metadata?.creationTimestamp || o?.metadata?.creation_time || null;

      if (kind === "Pod") {
        // Mark that SSE is driving pods now
        ssePodsActiveRef.current = true;
        const total =
          (o.spec?.containers?.length || 0) +
          (o.spec?.initContainers?.length || 0);
        const ready =
          (o.status?.containerStatuses || []).reduce(
            (n, cs) => n + (cs.ready ? 1 : 0),
            0
          ) +
          (o.status?.initContainerStatuses || []).reduce(
            (n, cs) => n + (cs.ready ? 1 : 0),
            0
          );
        const item = {
          name: o.metadata?.name || "",
          namespace: o.metadata?.namespace || "",
          ready: `${ready}/${total}`,
          status: o.status?.phase || "Unknown",
          restart: (o.status?.containerStatuses || []).reduce(
            (n, cs) => n + (cs.restartCount || 0),
            0
          ),
          age: "",
          ip: o.status?.podIP || "",
          node: o.spec?.nodeName || "",
          createdAt,
        };
        setResourceData((prev) => {
          const pods = [...(prev.pods || [])];
          const same = (x) =>
            x.namespace === item.namespace && x.name === item.name;
          if (t === "DELETED") rm(pods, same);
          else upsert(pods, same, item);
          return { ...prev, pods };
        });
        return;
      }

      if (kind === "Service") {
        const ports = (o.spec?.ports || [])
          .map(
            (p) =>
              `${p.port}${p.nodePort ? `:${p.nodePort}` : ""}/${
                p.protocol || "TCP"
              }`
          )
          .join(", ");
        const item = {
          name: o.metadata?.name || "",
          namespace: o.metadata?.namespace || "",
          type: o.spec?.type || "",
          clusterIP: o.spec?.clusterIP || "",
          externalIPs: (o.spec?.externalIPs || []).join(", "),
          ports,
          age: "",
          createdAt,
        };
        setResourceData((prev) => {
          const services = [...(prev.services || [])];
          const same = (x) =>
            x.namespace === item.namespace && x.name === item.name;
          if (t === "DELETED") rm(services, same);
          else upsert(services, same, item);
          return { ...prev, services };
        });
        return;
      }

      if (kind === "Deployment") {
        const specRep = o.spec?.replicas ?? 0;
        const ready = o.status?.readyReplicas ?? 0;
        const updated = o.status?.updatedReplicas ?? 0;
        const available = o.status?.availableReplicas ?? 0;
        const item = {
          name: o.metadata?.name || "",
          namespace: o.metadata?.namespace || "",
          ready: `${ready}/${specRep}`,
          upToDate: `${updated}`,
          available: `${available}`,
          age: "",
          createdAt,
        };
        setResourceData((prev) => {
          const deployments = [...(prev.deployments || [])];
          const same = (x) =>
            x.namespace === item.namespace && x.name === item.name;
          if (t === "DELETED") rm(deployments, same);
          else upsert(deployments, same, item);
          return { ...prev, deployments };
        });
        return;
      }

      if (kind === "ReplicaSet") {
        const desired = o.spec?.replicas ?? 0;
        const current = o.status?.replicas ?? 0;
        const ready = o.status?.readyReplicas ?? 0;
        const item = {
          name: o.metadata?.name || "",
          namespace: o.metadata?.namespace || "",
          desired: `${desired}`,
          current: `${current}`,
          ready: `${ready}`,
          age: "",
          createdAt,
        };
        setResourceData((prev) => {
          const replicaSets = [...(prev.replicaSets || [])];
          const same = (x) =>
            x.namespace === item.namespace && x.name === item.name;
          if (t === "DELETED") rm(replicaSets, same);
          else upsert(replicaSets, same, item);
          return { ...prev, replicaSets };
        });
        return;
      }

      if (kind === "StatefulSet") {
        const specRep = o.spec?.replicas ?? 0;
        const ready = o.status?.readyReplicas ?? 0;
        const item = {
          name: o.metadata?.name || "",
          namespace: o.metadata?.namespace || "",
          ready: `${ready}/${specRep}`,
          age: "",
          createdAt,
        };
        setResourceData((prev) => {
          const statefulSets = [...(prev.statefulSets || [])];
          const same = (x) =>
            x.namespace === item.namespace && x.name === item.name;
          if (t === "DELETED") rm(statefulSets, same);
          else upsert(statefulSets, same, item);
          return { ...prev, statefulSets };
        });
        return;
      }

      if (kind === "DaemonSet") {
        const desired = o.status?.desiredNumberScheduled ?? 0;
        const current = o.status?.currentNumberScheduled ?? 0;
        const ready = o.status?.numberReady ?? 0;
        const item = {
          name: o.metadata?.name || "",
          namespace: o.metadata?.namespace || "",
          desired: `${desired}`,
          current: `${current}`,
          ready: `${ready}`,
          age: "",
          createdAt,
        };
        setResourceData((prev) => {
          const daemonSets = [...(prev.daemonSets || [])];
          const same = (x) =>
            x.namespace === item.namespace && x.name === item.name;
          if (t === "DELETED") rm(daemonSets, same);
          else upsert(daemonSets, same, item);
          return { ...prev, daemonSets };
        });
        return;
      }

      if (kind === "Job") {
        const completions =
          (o.status?.succeeded ?? 0) + (o.status?.failed ?? 0);
        const duration = ""; // optional: compute from start/completion
        const item = {
          name: o.metadata?.name || "",
          namespace: o.metadata?.namespace || "",
          completions: `${completions}`,
          duration,
          age: "",
          createdAt,
        };
        setResourceData((prev) => {
          const jobs = [...(prev.jobs || [])];
          const same = (x) =>
            x.namespace === item.namespace && x.name === item.name;
          if (t === "DELETED") rm(jobs, same);
          else upsert(jobs, same, item);
          return { ...prev, jobs };
        });
        return;
      }

      if (kind === "CronJob") {
        const item = {
          name: o.metadata?.name || "",
          namespace: o.metadata?.namespace || "",
          schedule: o.spec?.schedule || "",
          suspend: !!o.spec?.suspend,
          active: (o.status?.active || []).length || 0,
          lastSchedule: o.status?.lastScheduleTime || "",
          age: "",
          createdAt,
        };
        setResourceData((prev) => {
          const cronJobs = [...(prev.cronJobs || [])];
          const same = (x) =>
            x.namespace === item.namespace && x.name === item.name;
          if (t === "DELETED") rm(cronJobs, same);
          else upsert(cronJobs, same, item);
          return { ...prev, cronJobs };
        });
        return;
      }

      if (kind === "Node") {
        const item = {
          name: o.metadata?.name || "",
          age: "",
          createdAt,
        };
        setNodes((prev) => {
          const list = [...prev];
          const same = (x) => x.name === item.name;
          if (t === "DELETED") return rm(list, same);
          return upsert(list, same, item);
        });
        return;
      }

      if (kind === "Namespace") {
        const item = {
          name: o.metadata?.name || "",
        };
        setNamespaces((prev) => {
          const list = [...prev];
          const same = (x) => x.name === item.name;
          if (t === "DELETED") return rm(list, same);
          return upsert(list, same, item);
        });
        return;
      }
    };

    es.addEventListener("open", onOpen);
    es.addEventListener("multi", handle);
    es.onerror = onError;

    return () => {
      es.removeEventListener("open", onOpen);
      es.removeEventListener("multi", handle);
      es.close();
    };
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
