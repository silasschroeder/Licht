"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import AuthCheck from "../components/AuthCheck";
import styles from "./page.module.css";

export default function Dashboard() {
  const [pods, setPods] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [namespaces, setNamespaces] = useState([]);
  const [selectedNamespace, setSelectedNamespace] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Status colors for visualization
  const statusColors = {
    Running: "#4caf50",
    Pending: "#ff9800",
    Failed: "#f44336",
    Succeeded: "#2196f3",
    Unknown: "#9e9e9e",
    Ready: "#4caf50",
    NotReady: "#f44336",
  };

  // Simplified fetchData function with no sorting logic
  const fetchData = async () => {
    try {
      // Fetch all data
      const [podsResponse, namespacesResponse, nodesResponse] =
        await Promise.all([
          fetch("http://localhost:8080/api/pods", { credentials: "include" }),
          fetch("http://localhost:8080/api/namespaces", {
            credentials: "include",
          }),
          fetch("http://localhost:8080/api/nodes", { credentials: "include" }),
        ]);

      // Check for errors
      if (!podsResponse.ok || !namespacesResponse.ok || !nodesResponse.ok) {
        throw new Error("Failed to fetch data");
      }

      // Parse all data
      const podsData = await podsResponse.json();
      const namespacesData = await namespacesResponse.json();
      const nodesData = await nodesResponse.json();

      // Store data in state without any sorting
      setPods(podsData);
      setNodes(nodesData);

      // Just use the namespaces as they come from the API
      const namespaceNames = namespacesData.map((ns) => ns.name);
      setNamespaces(namespaceNames);

      // Select the first namespace if none is selected yet
      if (!selectedNamespace && namespaceNames.length > 0) {
        setSelectedNamespace(namespaceNames[0]);
      }

      // Update last updated timestamp
      setLastUpdated(new Date());
      setLoading(false);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Initial data loading
  useEffect(() => {
    fetchData();
  }, []);

  // Set up polling for live updates
  useEffect(() => {
    const pollInterval = 5000; // Poll every 5 seconds
    const intervalId = setInterval(() => {
      fetchData();
    }, pollInterval);

    // Clean up on component unmount
    return () => clearInterval(intervalId);
  }, [selectedNamespace]); // Re-establish polling when namespace changes

  // Filter pods by selected namespace
  const filteredPods = selectedNamespace
    ? pods.filter((pod) => pod.namespace === selectedNamespace)
    : [];

  // Get pods for a specific namespace
  const getPodsForNamespace = (namespace, allPods) => {
    const podsToFilter = allPods || pods;
    return podsToFilter.filter((pod) => pod.namespace === namespace);
  };

  // Format the last updated time
  const formatLastUpdated = () => {
    if (!lastUpdated) return "";
    return lastUpdated.toLocaleTimeString();
  };

  // Add this function to determine grid density class
  const getPodGridClass = (podCount) => {
    if (podCount > 35) return styles.miniPodPreviewVeryDense;
    if (podCount > 20) return styles.miniPodPreviewDense;
    if (podCount > 12) return styles.miniPodPreviewMedium;
    return "";
  };

  // Simplified pod display limit function
  const getPodDisplayLimit = (podCount) => {
    return Math.min(12, podCount); // Never show more than 12 pods
  };

  // Add this new component for the enhanced pod with tooltip
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
              {capturedPod.restarts > 0 && (
                <div className={styles.podTooltipLine}>
                  <strong>Restarts:</strong> {capturedPod.restarts}
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

  // Update the width calculation function for fixed-size pods
  const calculateNamespaceWidth = (podCount) => {
    // At least 4 columns regardless of pod count
    const columnsNeeded = Math.max(4, Math.ceil(podCount / 3));

    // Each pod is 40px wide with 5px gap = 45px per column
    // Add 30px padding for container sides
    return Math.max(200, columnsNeeded * 45 + 30);
  };

  return (
    <AuthCheck>
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.header}>
            <h1>Kubernetes Pod List</h1>
            <button
              className={styles.logoutButton}
              onClick={async () => {
                await fetch("http://localhost:8080/api/auth/logout", {
                  method: "POST",
                  credentials: "include",
                });
                window.location.href = "/login";
              }}
            >
              Logout
            </button>
          </div>

          {lastUpdated && (
            <div className={styles.updateInfo}>
              Last updated: {formatLastUpdated()}
              <button
                className={styles.refreshButton}
                onClick={fetchData}
                disabled={loading}
              >
                Refresh Now
              </button>
            </div>
          )}

          {/* Rest of your dashboard code (namespaces grid, pod details, etc.) */}
          {/* This is the same as your current implementation */}
          {namespaces.length > 0 && (
            <>
              <div className={styles.namespaceGrid}>
                {namespaces.map((namespace) => {
                  const namespacePods = getPodsForNamespace(namespace);
                  const isEmpty = namespacePods.length === 0;
                  const hasManyPods = namespacePods.length > 12;

                  // Calculate columns needed - at least 4, or enough for all pods in 3 rows
                  const columnsToUse = Math.max(
                    4,
                    Math.ceil(namespacePods.length / 3)
                  );

                  // Dynamic width calculation
                  const squareWidth = calculateNamespaceWidth(
                    namespacePods.length
                  );

                  return (
                    <div
                      key={namespace}
                      className={`${styles.namespaceSquare} ${
                        namespace === selectedNamespace
                          ? styles.selectedSquare
                          : ""
                      } ${hasManyPods ? styles.expandedNamespace : ""}`}
                      onClick={() => setSelectedNamespace(namespace)}
                      style={{ width: `${squareWidth}px` }}
                    >
                      <div
                        className={`${styles.miniPodPreview} ${
                          isEmpty ? styles.emptyNamespace : ""
                        }`}
                        style={{
                          gridTemplateColumns: `repeat(${columnsToUse}, 40px)`,
                        }}
                      >
                        {!isEmpty ? (
                          // Show ALL pods in the namespace
                          namespacePods.map((pod, idx) => (
                            <EnhancedPodSquare
                              key={idx}
                              pod={pod}
                              color={
                                statusColors[pod.status] || statusColors.Unknown
                              }
                            />
                          ))
                        ) : (
                          // Show empty state for namespaces with no pods
                          <div className={styles.emptyNamespaceIndicator}>
                            No Pods
                          </div>
                        )}
                      </div>
                      <div className={styles.namespaceName}>{namespace}</div>
                      <div className={styles.podCount}>
                        {namespacePods.length} pods
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={styles.workspaceContainer}>
                {selectedNamespace && (
                  <div className={styles.detailView}>
                    <h2>{selectedNamespace} Namespace</h2>
                    {loading && pods.length > 0 && (
                      <div className={styles.refreshIndicator}>Updating...</div>
                    )}
                    {filteredPods.length > 0 ? (
                      <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Ready</th>
                              <th>Status</th>
                              <th>Restarts</th>
                              <th>Age</th>
                              <th>IP</th>
                              <th>Node</th>
                              <th>Nominated Node</th>
                              <th>Readiness Gates</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPods.map((pod, index) => (
                              <tr key={index} className={styles.podRow}>
                                <td>{pod.name}</td>
                                <td>{pod.ready}</td>
                                <td>
                                  <span
                                    className={styles.statusIndicator}
                                    style={{
                                      backgroundColor:
                                        statusColors[pod.status] ||
                                        statusColors.Unknown,
                                    }}
                                  />
                                  {pod.status}
                                </td>
                                <td>{pod.restarts}</td>
                                <td>{pod.age}</td>
                                <td>{pod.ip}</td>
                                <td>
                                  <span className={styles.nodeLabel}>
                                    {pod.node}
                                  </span>
                                </td>
                                <td>{pod.nominatedNode || "-"}</td>
                                <td>{pod.readinessGates}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p>No pods found in this namespace</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </AuthCheck>
  );
}
