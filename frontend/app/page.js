"use client";

import { useState, useEffect } from "react";
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

  // Fetch data function that can be reused
  const fetchData = async () => {
    try {
      // Fetch pods data
      const podsResponse = await fetch("http://localhost:8080/api/pods", {
        credentials: "include", // Important for cookies
      });

      if (!podsResponse.ok) {
        throw new Error(`HTTP error ${podsResponse.status}`);
      }

      const podsData = await podsResponse.json();
      setPods(podsData);

      // Fetch nodes data
      const nodesResponse = await fetch("http://localhost:8080/api/nodes", {
        credentials: "include", // Important for cookies
      });

      if (!nodesResponse.ok) {
        throw new Error(`HTTP error ${nodesResponse.status}`);
      }

      const nodesData = await nodesResponse.json();
      setNodes(nodesData);

      // Extract unique namespaces and sort them
      const uniqueNamespaces = [
        ...new Set(podsData.map((pod) => pod.namespace)),
      ];
      const sortedNamespaces = uniqueNamespaces.sort((a, b) => {
        if (a === "default") return -1;
        if (b === "default") return 1;
        return a.localeCompare(b);
      });

      setNamespaces(sortedNamespaces);

      // Select the first namespace if none is selected yet
      if (!selectedNamespace && sortedNamespaces.length > 0) {
        setSelectedNamespace(sortedNamespaces[0]);
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
  const getPodsForNamespace = (namespace) => {
    return pods.filter((pod) => pod.namespace === namespace);
  };

  // Format the last updated time
  const formatLastUpdated = () => {
    if (!lastUpdated) return "";
    return lastUpdated.toLocaleTimeString();
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
                  return (
                    <div
                      key={namespace}
                      className={`${styles.namespaceSquare} ${
                        namespace === selectedNamespace
                          ? styles.selectedSquare
                          : ""
                      }`}
                      onClick={() => setSelectedNamespace(namespace)}
                    >
                      <div className={styles.miniPodPreview}>
                        {namespacePods.slice(0, 16).map((pod, idx) => (
                          <div
                            key={idx}
                            className={styles.miniPod}
                            style={{
                              backgroundColor:
                                statusColors[pod.status] ||
                                statusColors.Unknown,
                            }}
                            title={`${pod.name}: ${pod.status}`}
                          />
                        ))}
                        {namespacePods.length > 16 && (
                          <div className={styles.morePods}>
                            +{namespacePods.length - 16}
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
