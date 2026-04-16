"use client";

import { useState, useEffect, useRef } from "react";
import { ResourceData, Pod, Node, Namespace } from "@/types/kubernetes";

const API_BASE = "";

interface UseKubernetesDataReturn {
  resourceData: ResourceData;
  nodes: Node[];
  namespaces: Namespace[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  clusterAddress: string;
  fetchData: () => Promise<void>;
}

export function useKubernetesData(
  authReady: boolean
): UseKubernetesDataReturn {
  const [resourceData, setResourceData] = useState<ResourceData>({
    pods: [],
    services: [],
    deployments: [],
    replicaSets: [],
    statefulSets: [],
    daemonSets: [],
    jobs: [],
    cronJobs: [],
  });
  const [nodes, setNodes] = useState<Node[]>([]);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [clusterAddress, setClusterAddress] = useState("");

  const ssePodsActiveRef = useRef(false);

  // Helper functions for SSE updates
  const upsert = <T,>(arr: T[], isSame: (item: T) => boolean, item: T): T[] => {
    const i = arr.findIndex(isSame);
    if (i === -1) arr.push(item);
    else arr[i] = item;
    return arr;
  };

  const rm = <T,>(arr: T[], isSame: (item: T) => boolean): T[] => {
    const i = arr.findIndex(isSame);
    if (i !== -1) arr.splice(i, 1);
    return arr;
  };

  // Fetch initial data
  const fetchData = async () => {
    if (!authReady) return;
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
      const dataMap: any = {};
      results.forEach(([k, v]) => (dataMap[k] = v));

      setNodes(dataMap.nodes || []);
      setNamespaces(dataMap.namespaces || []);

      const withCreatedAt = (arr: any[]) =>
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

      setLastUpdated(new Date());
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Load failed");
    } finally {
      setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    if (!authReady) return;
    fetchData();
  }, [authReady]);

  // SSE connection for live updates
  useEffect(() => {
    if (!authReady) return;

    const sseBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
    const es = new EventSource(`${sseBase}/api/watch/stream`, {
      withCredentials: true,
    });

    const handle = (ev: MessageEvent) => {
      let msg: any;
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
        ssePodsActiveRef.current = true;
        const total =
          (o.spec?.containers?.length || 0) +
          (o.spec?.initContainers?.length || 0);
        const ready =
          (o.status?.containerStatuses || []).reduce(
            (n: number, cs: any) => n + (cs.ready ? 1 : 0),
            0
          ) +
          (o.status?.initContainerStatuses || []).reduce(
            (n: number, cs: any) => n + (cs.ready ? 1 : 0),
            0
          );
        const item: Pod = {
          name: o.metadata?.name || "",
          namespace: o.metadata?.namespace || "",
          ready: `${ready}/${total}`,
          status: o.status?.phase || "Unknown",
          restart: (o.status?.containerStatuses || []).reduce(
            (n: number, cs: any) => n + (cs.restartCount || 0),
            0
          ),
          age: "",
          ip: o.status?.podIP || "",
          node: o.spec?.nodeName || "",
          createdAt,
        };
        setResourceData((prev) => {
          const pods = [...(prev.pods || [])];
          const same = (x: Pod) =>
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
            (p: any) =>
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
          const same = (x: any) =>
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
          const same = (x: any) =>
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
          const same = (x: any) =>
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
          const same = (x: any) =>
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
          const same = (x: any) =>
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
        const duration = "";
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
          const same = (x: any) =>
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
          const same = (x: any) =>
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
          status: "",
          roles: "",
          version: "",
        };
        setNodes((prev) => {
          const list = [...prev];
          const same = (x: Node) => x.name === item.name;
          if (t === "DELETED") return rm(list, same);
          return upsert(list, same, item);
        });
        return;
      }

      if (kind === "Namespace") {
        const item = {
          name: o.metadata?.name || "",
          status: "",
          age: "",
        };
        setNamespaces((prev) => {
          const list = [...prev];
          const same = (x: Namespace) => x.name === item.name;
          if (t === "DELETED") return rm(list, same);
          return upsert(list, same, item);
        });
        return;
      }
    };

    es.addEventListener("multi", handle);

    return () => {
      es.removeEventListener("multi", handle);
      es.close();
    };
  }, [authReady]);

  // Fetch cluster address
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

  // Fallback: read from localStorage
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

  return {
    resourceData,
    nodes,
    namespaces,
    loading,
    error,
    lastUpdated,
    clusterAddress,
    fetchData,
  };
}
