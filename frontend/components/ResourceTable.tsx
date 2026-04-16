"use client";

import styles from "@/app/page.module.css";
import { ResourceType, ResourceItem } from "@/types/kubernetes";

interface Column {
  key: string;
  label: string;
}

interface ResourceTableProps {
  type: ResourceType;
  namespace: string | null;
  data: ResourceItem[];
  highlightPodKey?: string | null;
  formatAge: (createdAt: string | null | undefined) => string;
  onYamlClick: (kind: string, namespace: string | null, name: string) => void;
}

const TABLE_CONFIGS: Record<ResourceType, [string, string][]> = {
  pods: [
    ["name", "Name"],
    ["ready", "Ready"],
    ["status", "Status"],
    ["restart", "Restarts"],
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

const KIND_BY_TYPE: Record<ResourceType, string> = {
  pods: "Pod",
  services: "Service",
  deployments: "Deployment",
  replicaSets: "ReplicaSet",
  statefulSets: "StatefulSet",
  daemonSets: "DaemonSet",
  jobs: "Job",
  cronJobs: "CronJob",
};

export default function ResourceTable({
  type,
  namespace,
  data,
  highlightPodKey,
  formatAge,
  onYamlClick,
}: ResourceTableProps) {
  const filtered = namespace
    ? data.filter((r: any) => r.namespace === namespace)
    : data;

  const columns = TABLE_CONFIGS[type] || [];
  if (!columns.length) return null;

  const rows = filtered.map((orig: any) => {
    const rowData: any = {};
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

  const kind = KIND_BY_TYPE[type];

  return (
    <div className={styles.tableRegion}>
      <div className={styles.tableWrapper}>
        <div className={styles.tableInner}>
          <table className={styles.table} role="table" aria-label={`${type} table`}>
            <thead>
              <tr>
                {columns.map(([k, label]) => (
                  <th key={k} scope="col">
                    {label}
                  </th>
                ))}
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => {
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
                        k === "age"
                          ? formatAge(row.createdAt)
                          : (row[k] ?? "");
                      return <td key={k}>{String(value)}</td>;
                    })}
                    <td>
                      <button
                        className={styles.resourceTab}
                        onClick={() => {
                          if (!kind) return;
                          onYamlClick(kind, row.namespace || null, row.name);
                        }}
                        aria-label={`View YAML for ${row.name}`}
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
}
