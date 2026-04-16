"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Prism from "prismjs";
import "prismjs/components/prism-yaml";
import {
  ResourceType,
  Pod,
  Deployment,
  Service,
  ResourceData,
} from "@/types/kubernetes";
import { slideRightVariants, backdropVariants, transitions } from "@/lib/animations";
import styles from "./ResourceDrawer.module.css";

type DrawerTab = "overview" | "yaml";

interface ResourceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  kind: string;
  name: string;
  namespace: string | null;
  resourceData?: ResourceData;
  formatAge?: (createdAt: string | null | undefined) => string;
}

// Icons
const CloseIcon = () => (
  <svg className={styles.closeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CopyIcon = () => (
  <svg className={styles.yamlActionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

const DownloadIcon = () => (
  <svg className={styles.yamlActionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const EditIcon = () => (
  <svg className={styles.yamlActionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

function getStatusClass(status: string): string {
  switch (status) {
    case "Running":
    case "Active":
    case "Ready":
      return styles.statusRunning;
    case "Pending":
    case "ContainerCreating":
      return styles.statusPending;
    case "Failed":
    case "Error":
    case "CrashLoopBackOff":
      return styles.statusFailed;
    case "Succeeded":
    case "Completed":
      return styles.statusSucceeded;
    default:
      return "";
  }
}

/**
 * Slide-in drawer for viewing resource details and YAML
 */
export function ResourceDrawer({
  isOpen,
  onClose,
  kind,
  name,
  namespace,
  resourceData,
  formatAge,
}: ResourceDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>("overview");
  const [yamlSource, setYamlSource] = useState<"live" | "last-applied">("live");
  const [yaml, setYaml] = useState<string>("");
  const [yamlLoading, setYamlLoading] = useState(false);
  const [yamlError, setYamlError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedYaml, setEditedYaml] = useState("");
  const codeRef = useRef<HTMLElement>(null);

  // Get resource from resourceData
  const resource = React.useMemo(() => {
    if (!resourceData) return null;

    const typeMap: Record<string, keyof ResourceData> = {
      Pod: "pods",
      Deployment: "deployments",
      Service: "services",
      ReplicaSet: "replicaSets",
      StatefulSet: "statefulSets",
      DaemonSet: "daemonSets",
      Job: "jobs",
      CronJob: "cronJobs",
    };

    const dataKey = typeMap[kind];
    if (!dataKey) return null;

    const items = resourceData[dataKey] || [];
    return items.find(
      (item) =>
        item.name === name &&
        ("namespace" in item ? item.namespace === namespace : true)
    );
  }, [resourceData, kind, name, namespace]);

  // Fetch YAML
  useEffect(() => {
    if (!isOpen || activeTab !== "yaml") return;

    const fetchYaml = async () => {
      setYamlLoading(true);
      setYamlError(null);

      try {
        const params = new URLSearchParams({
          kind,
          name,
          source: yamlSource,
        });
        if (namespace) params.set("namespace", namespace);

        const res = await fetch(`/api/yaml?${params}`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch YAML: ${res.status}`);
        }

        const text = await res.text();
        setYaml(text);
        setEditedYaml(text);
      } catch (err) {
        setYamlError(err instanceof Error ? err.message : "Failed to fetch YAML");
      } finally {
        setYamlLoading(false);
      }
    };

    fetchYaml();
  }, [isOpen, activeTab, kind, name, namespace, yamlSource]);

  // Syntax highlight
  useEffect(() => {
    if (codeRef.current && yaml && !isEditing) {
      Prism.highlightElement(codeRef.current);
    }
  }, [yaml, isEditing]);

  // Keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopy = useCallback(() => {
    const content = isEditing ? editedYaml : yaml;
    navigator.clipboard?.writeText(content);
  }, [yaml, editedYaml, isEditing]);

  const handleDownload = useCallback(() => {
    const content = isEditing ? editedYaml : yaml;
    const blob = new Blob([content], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${namespace || "cluster"}-${kind.toLowerCase()}-${name}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [yaml, editedYaml, isEditing, kind, name, namespace]);

  const getResourceStatus = (): string => {
    if (!resource) return "Unknown";

    if (kind === "Pod") {
      return (resource as Pod).status || "Unknown";
    }
    if (kind === "Deployment") {
      const dep = resource as Deployment;
      const ready = dep.ready?.split("/") || ["0", "0"];
      return parseInt(ready[0]) === parseInt(ready[1]) ? "Ready" : "Pending";
    }
    if (kind === "Service") {
      return "Active";
    }
    return "Active";
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className={styles.overlay}
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={onClose}
          />

          <motion.div
            className={styles.drawer}
            variants={slideRightVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerInfo}>
                <div className={styles.headerKind}>{kind}</div>
                <div className={styles.headerName}>{name}</div>
                {namespace && (
                  <div className={styles.headerNamespace}>
                    Namespace: {namespace}
                  </div>
                )}
              </div>
              <button
                className={styles.closeButton}
                onClick={onClose}
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${
                  activeTab === "overview" ? styles.tabActive : ""
                }`}
                onClick={() => setActiveTab("overview")}
              >
                Overview
              </button>
              <button
                className={`${styles.tab} ${
                  activeTab === "yaml" ? styles.tabActive : ""
                }`}
                onClick={() => setActiveTab("yaml")}
              >
                YAML
              </button>
            </div>

            {/* Content */}
            <div className={styles.content}>
              {activeTab === "overview" && (
                <>
                  {/* Status */}
                  <div className={styles.overviewSection}>
                    <div className={styles.overviewLabel}>Status</div>
                    <span
                      className={`${styles.statusBadge} ${getStatusClass(
                        getResourceStatus()
                      )}`}
                    >
                      <span className={styles.statusDot} />
                      {getResourceStatus()}
                    </span>
                  </div>

                  {/* Resource-specific details */}
                  {kind === "Pod" && resource && (
                    <>
                      <div className={styles.overviewGrid}>
                        <div className={styles.overviewSection}>
                          <div className={styles.overviewLabel}>Ready</div>
                          <div className={styles.overviewValue}>
                            {(resource as Pod).ready || "-"}
                          </div>
                        </div>
                        <div className={styles.overviewSection}>
                          <div className={styles.overviewLabel}>Restarts</div>
                          <div className={styles.overviewValue}>
                            {(resource as Pod).restart || 0}
                          </div>
                        </div>
                        <div className={styles.overviewSection}>
                          <div className={styles.overviewLabel}>Node</div>
                          <div className={styles.overviewValue}>
                            {(resource as Pod).node || "-"}
                          </div>
                        </div>
                        <div className={styles.overviewSection}>
                          <div className={styles.overviewLabel}>IP</div>
                          <div
                            className={`${styles.overviewValue} ${styles.overviewValueMono}`}
                          >
                            {(resource as Pod).ip || "-"}
                          </div>
                        </div>
                      </div>
                      <div className={styles.overviewSection}>
                        <div className={styles.overviewLabel}>Age</div>
                        <div className={styles.overviewValue}>
                          {formatAge?.((resource as Pod).createdAt) ||
                            (resource as Pod).age ||
                            "-"}
                        </div>
                      </div>
                    </>
                  )}

                  {kind === "Deployment" && resource && (
                    <>
                      <div className={styles.overviewGrid}>
                        <div className={styles.overviewSection}>
                          <div className={styles.overviewLabel}>Ready</div>
                          <div className={styles.overviewValue}>
                            {(resource as Deployment).ready || "-"}
                          </div>
                        </div>
                        <div className={styles.overviewSection}>
                          <div className={styles.overviewLabel}>Up-to-date</div>
                          <div className={styles.overviewValue}>
                            {(resource as Deployment).upToDate || "-"}
                          </div>
                        </div>
                        <div className={styles.overviewSection}>
                          <div className={styles.overviewLabel}>Available</div>
                          <div className={styles.overviewValue}>
                            {(resource as Deployment).available || "-"}
                          </div>
                        </div>
                        <div className={styles.overviewSection}>
                          <div className={styles.overviewLabel}>Age</div>
                          <div className={styles.overviewValue}>
                            {formatAge?.((resource as Deployment).createdAt) ||
                              (resource as Deployment).age ||
                              "-"}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {kind === "Service" && resource && (
                    <>
                      <div className={styles.overviewGrid}>
                        <div className={styles.overviewSection}>
                          <div className={styles.overviewLabel}>Type</div>
                          <div className={styles.overviewValue}>
                            {(resource as Service).type || "-"}
                          </div>
                        </div>
                        <div className={styles.overviewSection}>
                          <div className={styles.overviewLabel}>Cluster IP</div>
                          <div
                            className={`${styles.overviewValue} ${styles.overviewValueMono}`}
                          >
                            {(resource as Service).clusterIP || "-"}
                          </div>
                        </div>
                      </div>
                      {(resource as Service).ports && (
                        <div className={styles.overviewSection}>
                          <div className={styles.overviewLabel}>Ports</div>
                          <div
                            className={`${styles.overviewValue} ${styles.overviewValueMono}`}
                          >
                            {(resource as Service).ports}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {activeTab === "yaml" && (
                <div className={styles.yamlWrapper}>
                  <div className={styles.yamlToolbar}>
                    <div className={styles.yamlSourceToggle}>
                      <button
                        className={`${styles.yamlSourceButton} ${
                          yamlSource === "live"
                            ? styles.yamlSourceButtonActive
                            : ""
                        }`}
                        onClick={() => setYamlSource("live")}
                      >
                        Live
                      </button>
                      <button
                        className={`${styles.yamlSourceButton} ${
                          yamlSource === "last-applied"
                            ? styles.yamlSourceButtonActive
                            : ""
                        }`}
                        onClick={() => setYamlSource("last-applied")}
                      >
                        Last Applied
                      </button>
                    </div>
                    <div className={styles.yamlActions}>
                      <button
                        className={styles.yamlActionButton}
                        onClick={() => setIsEditing(!isEditing)}
                        title={isEditing ? "Cancel edit" : "Edit"}
                      >
                        <EditIcon />
                      </button>
                      <button
                        className={styles.yamlActionButton}
                        onClick={handleCopy}
                        title="Copy"
                      >
                        <CopyIcon />
                      </button>
                      <button
                        className={styles.yamlActionButton}
                        onClick={handleDownload}
                        title="Download"
                      >
                        <DownloadIcon />
                      </button>
                    </div>
                  </div>

                  <div className={styles.yamlContent}>
                    {yamlLoading ? (
                      <div className={styles.yamlLoading}>Loading...</div>
                    ) : yamlError ? (
                      <div className={styles.yamlError}>{yamlError}</div>
                    ) : isEditing ? (
                      <textarea
                        className={styles.yamlTextarea}
                        value={editedYaml}
                        onChange={(e) => setEditedYaml(e.target.value)}
                        spellCheck={false}
                      />
                    ) : (
                      <pre className={styles.yamlPre}>
                        <code ref={codeRef} className="language-yaml">
                          {yaml}
                        </code>
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
