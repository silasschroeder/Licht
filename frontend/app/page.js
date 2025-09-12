"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import AuthCheck from "../components/AuthCheck";
import { apiGet } from "../lib/api";
import styles from "./page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

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

  // ADD THIS (must be inside the component, before JSX uses tabs)
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

  // Simplified fetchData function
  const fetchData = async () => {
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

  // Fix the useEffect hook
  useEffect(() => {
    // Initial load only
    fetchData();
  }, []); // <-- ensure no interval / no dependencies

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
  const ResourceTable = ({ type, namespace }) => {
    const data = resourceData[type] || [];
    const filtered = namespace
      ? data.filter((r) => r.namespace === namespace)
      : data;
    const columns = getTableConfig(type);
    if (!columns.length) return null;
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
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={row.name + i}>
                    {columns.map(([k]) => {
                      let value = row[k];
                      if (Array.isArray(value)) value = value.join(",");
                      if (value == null) value = "";

                      if (k === "status") {
                        const status = String(value);
                        return (
                          <td key={k} className={styles.statusCell}>
                            <span
                              className={styles.statusDot}
                              data-status={status}
                              title={status}
                            />
                            <span>{status}</span>
                          </td>
                        );
                      }

                      return <td key={k}>{String(value)}</td>;
                    })}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length}
                      style={{ textAlign: "center", opacity: 0.7 }}
                    >
                      No {type} found
                    </td>
                  </tr>
                )}
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
                <strong>Age:</strong> {capturedPod.age}
              </div>
              <div className={styles.podTooltipArrow}></div>
            </div>,
            document.body
          )}
      </div>
    );
  };

  // Add at the beginning of your Dashboard component

  useEffect(() => {
    // Simple API test function
    const testApi = async () => {
      try {
        console.log("Testing API connection...");
        const response = await fetch("http://localhost:8080/api/auth/check", {
          credentials: "include",
          mode: "cors",
        });

        console.log("Auth check response:", response.status);

        if (response.ok) {
          const data = await response.json();
          console.log("Auth data:", data);
        } else {
          console.error("Auth check failed with status:", response.status);
        }
      } catch (err) {
        console.error("API test error:", err);
      }
    };

    testApi();
  }, []);

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/watch/pods`, {
      withCredentials: true,
    });

    es.addEventListener("pod", (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (!msg || !msg.type) return;
        if (msg.type === "ERROR") {
          console.warn("Pod stream error:", msg.err);
          return;
        }
        if (!msg.pod) return;

        const podObj = msg.pod;
        const containers = podObj.spec?.containers || [];
        const containerStatuses = podObj.status?.containerStatuses || [];
        const ready = `${containerStatuses.filter((c) => c.ready).length}/${
          containers.length
        }`;
        const restarts = containerStatuses.reduce(
          (a, c) => a + (c.restartCount || 0),
          0
        );

        const normalized = {
          name: podObj.metadata?.name,
          namespace: podObj.metadata?.namespace,
          status: podObj.status?.phase || "Unknown",
          ready,
          restart: restarts,
          age: "", // can compute periodically if desired
          ip: podObj.status?.podIP || "",
          node: podObj.spec?.nodeName || "",
        };
        const key = normalized.namespace + "/" + normalized.name;

        // Helper to update pods:
        function updatePods(mutator) {
          setResourceData((prev) => {
            const newPods = mutator(prev.pods || []);
            return { ...prev, pods: newPods };
          });
        }

        // SSE listener change:
        updatePods((prev) => {
          const map = new Map(prev.map((p) => [p.namespace + "/" + p.name, p]));
          if (msg.type === "DELETED") map.delete(key);
          else map.set(key, normalized);
          return Array.from(map.values());
        });
      } catch {}
    });

    es.onerror = () => {
      console.warn("Pod EventSource error (will not retry here)");
    };

    return () => es.close();
  }, [API_BASE]);

  return (
    <div className={styles.page}>
      <AuthCheck>
        <div className={styles.main}>
          <div className={styles.centerShell}>
            <div className={styles.centerContent}>
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
                          // Force a baseline 3-row height for 0–12 pods
                          height:
                            podCount <= 12 ? `${BASE_GRID_HEIGHT}px` : "auto",
                        }}
                      >
                        {podCount > 0 ? (
                          namespacePods.map((pod, idx) => (
                            <EnhancedPodSquare
                              key={pod.name + idx}
                              pod={pod}
                              color={
                                statusColors[pod.status] || statusColors.Unknown
                              }
                            />
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
              <div className={styles.updateInfo}>
                Last updated:{" "}
                {lastUpdated ? lastUpdated.toLocaleTimeString() : "Never"}
                <button
                  onClick={fetchData}
                  className={styles.refreshButton}
                  disabled={loading}
                >
                  Refresh
                </button>
                {/* (optional auto refresh toggle here) */}
              </div>

              {/* MOVED: Tabs now below refresh, above table */}
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

              {/* Table */}
              <ResourceTable
                type={resourceType}
                namespace={selectedNamespace}
              />
            </div>
          </div>
        </div>
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
