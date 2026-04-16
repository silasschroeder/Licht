"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResourceItem,
  ResourceType,
  Pod,
  Service,
  Deployment,
} from "@/types/kubernetes";
import { cardVariants, staggerContainerVariants, transitions } from "@/lib/animations";
import styles from "./GridView.module.css";

interface ResourceCardProps {
  resource: ResourceItem;
  resourceType: ResourceType;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onYamlClick: (kind: string, namespace: string | null, name: string) => void;
  formatAge: (createdAt: string | null | undefined) => string;
}

// Icons
const YamlIcon = () => (
  <svg
    className={styles.cardActionIcon}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </svg>
);

const CopyIcon = () => (
  <svg
    className={styles.cardActionIcon}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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
      return styles.statusUnknown;
  }
}

function getResourceStatus(resource: ResourceItem, type: ResourceType): string {
  if (type === "pods") {
    return (resource as Pod).status || "Unknown";
  }
  if (type === "deployments") {
    const dep = resource as Deployment;
    const ready = dep.ready?.split("/") || ["0", "0"];
    return parseInt(ready[0]) === parseInt(ready[1]) ? "Ready" : "Pending";
  }
  return "Active";
}

function getResourceKind(type: ResourceType): string {
  const kindMap: Record<ResourceType, string> = {
    pods: "Pod",
    services: "Service",
    deployments: "Deployment",
    replicaSets: "ReplicaSet",
    statefulSets: "StatefulSet",
    daemonSets: "DaemonSet",
    jobs: "Job",
    cronJobs: "CronJob",
  };
  return kindMap[type] || "Resource";
}

/**
 * Individual resource card with expandable details
 */
export function ResourceCard({
  resource,
  resourceType,
  isExpanded,
  onToggleExpand,
  onYamlClick,
  formatAge,
}: ResourceCardProps) {
  const [showCopied, setShowCopied] = useState(false);
  const status = getResourceStatus(resource, resourceType);
  const statusClass = getStatusClass(status);
  const kind = getResourceKind(resourceType);
  const namespace = "namespace" in resource ? resource.namespace : null;

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard?.writeText(resource.name);

      // Show copied feedback
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 1500);
    },
    [resource.name]
  );

  const handleYaml = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onYamlClick(kind, namespace, resource.name);
    },
    [kind, namespace, resource.name, onYamlClick]
  );

  // Get type-specific meta info
  const getMeta = () => {
    const meta: { label: string; value: string }[] = [];

    if (resourceType === "pods") {
      const pod = resource as Pod;
      meta.push({ label: "Ready", value: pod.ready || "-" });
      if (pod.restart > 0) {
        meta.push({ label: "Restarts", value: String(pod.restart) });
      }
      if (pod.node) {
        meta.push({ label: "Node", value: pod.node.split(".")[0] });
      }
    } else if (resourceType === "deployments") {
      const dep = resource as Deployment;
      meta.push({ label: "Ready", value: dep.ready || "-" });
      meta.push({ label: "Up-to-date", value: dep.upToDate || "-" });
    } else if (resourceType === "services") {
      const svc = resource as Service;
      meta.push({ label: "Type", value: svc.type || "-" });
      if (svc.clusterIP) {
        meta.push({ label: "IP", value: svc.clusterIP });
      }
    }

    meta.push({
      label: "Age",
      value: formatAge(resource.createdAt) || resource.age || "-",
    });

    return meta;
  };

  return (
    <motion.div
      className={`${styles.card} ${isExpanded ? styles.cardExpanded : ""}`}
      onClick={onToggleExpand}
      variants={cardVariants}
      whileHover="hover"
      whileTap="tap"
      layout
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggleExpand();
        }
      }}
    >
      <div className={`${styles.statusAccent} ${statusClass}`} />

      <div className={styles.cardContent}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>{resource.name}</span>
          <span className={styles.cardType}>{kind}</span>
        </div>

        <div className={styles.cardMeta}>
          {getMeta().map((item, idx) => (
            <div key={idx} className={styles.cardMetaItem}>
              <span className={styles.cardMetaLabel}>{item.label}:</span>
              <span className={styles.cardMetaValue}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.cardActions}>
        <button
          className={styles.cardActionButton}
          onClick={handleCopy}
          aria-label="Copy name"
          title="Copy name"
        >
          <CopyIcon />
        </button>
        <button
          className={styles.cardActionButton}
          onClick={handleYaml}
          aria-label="Interact"
          title="Interact"
        >
          <YamlIcon />
        </button>
      </div>

      {/* Copied toast */}
      <AnimatePresence>
        {showCopied && (
          <motion.div
            className={styles.copiedToast}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            Copied!
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className={styles.expandedContent}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transitions.normal}
          >
            {namespace && (
              <div className={styles.expandedSection}>
                <div className={styles.expandedLabel}>Namespace</div>
                <div className={styles.expandedValue}>{namespace}</div>
              </div>
            )}

            <div className={styles.expandedSection}>
              <div className={styles.expandedLabel}>Status</div>
              <div className={styles.expandedValue}>{status}</div>
            </div>

            {resourceType === "pods" && (
              <>
                {(resource as Pod).ip && (
                  <div className={styles.expandedSection}>
                    <div className={styles.expandedLabel}>Pod IP</div>
                    <div className={styles.expandedValue}>
                      {(resource as Pod).ip}
                    </div>
                  </div>
                )}
              </>
            )}

            {resourceType === "services" && (
              <>
                {(resource as Service).ports && (
                  <div className={styles.expandedSection}>
                    <div className={styles.expandedLabel}>Ports</div>
                    <div className={styles.expandedValue}>
                      {(resource as Service).ports}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className={styles.expandedActions}>
              <button
                className={`${styles.expandedButton} ${styles.expandedButtonPrimary}`}
                onClick={handleYaml}
              >
                <YamlIcon />
                Interact
              </button>
              <button className={styles.expandedButton} onClick={handleCopy}>
                <CopyIcon />
                Copy Name
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface ResourceGridProps {
  resources: ResourceItem[];
  resourceType: ResourceType;
  onYamlClick: (kind: string, namespace: string | null, name: string) => void;
  formatAge: (createdAt: string | null | undefined) => string;
}

/**
 * Grid layout for resource cards
 */
export function ResourceGrid({
  resources,
  resourceType,
  onYamlClick,
  formatAge,
}: ResourceGridProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggleExpand = useCallback((name: string) => {
    setExpandedId((prev) => (prev === name ? null : name));
  }, []);

  return (
    <motion.div
      className={styles.grid}
      variants={staggerContainerVariants}
      initial="initial"
      animate="animate"
    >
      <AnimatePresence mode="popLayout">
        {resources.map((resource) => (
          <ResourceCard
            key={resource.name}
            resource={resource}
            resourceType={resourceType}
            isExpanded={expandedId === resource.name}
            onToggleExpand={() => handleToggleExpand(resource.name)}
            onYamlClick={onYamlClick}
            formatAge={formatAge}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
