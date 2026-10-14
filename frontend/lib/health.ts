import { ResourceData, Node } from "@/types/kubernetes";
import { RailView } from "@/components/AppShell";

export interface Problem {
  sev: "critical" | "warn";
  kind: string;
  name: string;
  namespace: string | null;
  reason: string;
  detail?: string;
  view: RailView;
}

// Parse a Kubernetes "ready" string like "2/3" into [ready, total].
// Returns null if the shape is not a/b with numbers.
function parseRatio(s: string | undefined): [number, number] | null {
  if (!s) return null;
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(s.trim());
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10)];
}

const CRITICAL_POD_STATUSES = new Set([
  "CrashLoopBackOff",
  "Failed",
  "Error",
  "ImagePullBackOff",
  "ErrImagePull",
  "Evicted",
]);

// deriveProblems scans live resource data for conditions worth an operator's
// attention. It only flags what the data can actually prove (see the Jobs and
// blank-node guards) so the panel never invents failures.
export function deriveProblems(data: ResourceData, nodes: Node[]): Problem[] {
  const problems: Problem[] = [];

  for (const p of data.pods || []) {
    const ratio = parseRatio(p.ready);
    const notReady = ratio ? ratio[0] < ratio[1] : false;
    if (CRITICAL_POD_STATUSES.has(p.status)) {
      problems.push({
        sev: "critical",
        kind: "Pod",
        name: p.name,
        namespace: p.namespace,
        reason: p.status,
        view: "pods",
      });
    } else if (p.status === "Running" && notReady && p.restart > 0) {
      problems.push({
        sev: "critical",
        kind: "Pod",
        name: p.name,
        namespace: p.namespace,
        reason: "Not ready",
        detail: `${p.ready} ·x${p.restart}`,
        view: "pods",
      });
    } else if (p.status === "Pending") {
      problems.push({
        sev: "warn",
        kind: "Pod",
        name: p.name,
        namespace: p.namespace,
        reason: "Pending",
        view: "pods",
      });
    } else if (p.status === "Running" && notReady) {
      problems.push({
        sev: "warn",
        kind: "Pod",
        name: p.name,
        namespace: p.namespace,
        reason: "Not ready",
        detail: p.ready,
        view: "pods",
      });
    } else if (p.status === "Running" && p.restart > 5) {
      problems.push({
        sev: "warn",
        kind: "Pod",
        name: p.name,
        namespace: p.namespace,
        reason: `${p.restart} restarts`,
        view: "pods",
      });
    }
  }

  const readyWorkload = (
    kind: string,
    view: RailView,
    name: string,
    namespace: string,
    ready: string | undefined
  ) => {
    const r = parseRatio(ready);
    if (!r || r[0] >= r[1]) return;
    const [have, want] = r;
    problems.push({
      sev: have === 0 && want > 0 ? "critical" : "warn",
      kind,
      name,
      namespace,
      reason: have === 0 ? "No replicas available" : "Degraded",
      detail: ready,
      view,
    });
  };

  for (const d of data.deployments || [])
    readyWorkload("Deployment", "deployments", d.name, d.namespace, d.ready);
  for (const s of data.statefulSets || [])
    readyWorkload("StatefulSet", "statefulSets", s.name, s.namespace, s.ready);

  const desiredWorkload = (
    kind: string,
    view: RailView,
    name: string,
    namespace: string,
    desired: string | undefined,
    ready: string | undefined
  ) => {
    const want = parseInt(desired || "", 10);
    const have = parseInt(ready || "", 10);
    if (!Number.isFinite(want) || !Number.isFinite(have)) return;
    if (have >= want) return;
    problems.push({
      sev: have === 0 && want > 0 ? "critical" : "warn",
      kind,
      name,
      namespace,
      reason: "Pods not ready",
      detail: `${have}/${want}`,
      view,
    });
  };

  for (const ds of data.daemonSets || [])
    desiredWorkload("DaemonSet", "daemonSets", ds.name, ds.namespace, ds.desired, ds.ready);
  for (const rs of data.replicaSets || [])
    desiredWorkload("ReplicaSet", "replicaSets", rs.name, rs.namespace, rs.desired, rs.ready);

  for (const n of nodes || []) {
    // SSE-updated nodes carry status "" (unknown); only the initial REST load
    // has real status. Treat empty as not-a-problem to avoid false positives.
    if (!n.status) continue;
    if (n.status === "Ready") continue;
    problems.push({
      sev: n.status === "SchedulingDisabled" ? "warn" : "critical",
      kind: "Node",
      name: n.name,
      namespace: null,
      reason: n.status,
      view: "nodes",
    });
  }

  // Jobs are intentionally skipped: the data carries only combined
  // completions (succeeded + failed), so a failure cannot be proven.
  // shortcut: no job-failure rule until the Job row carries a separate failed count.

  const sevRank = (s: Problem["sev"]) => (s === "critical" ? 0 : 1);
  problems.sort((a, b) => {
    if (sevRank(a.sev) !== sevRank(b.sev)) return sevRank(a.sev) - sevRank(b.sev);
    const nsA = a.namespace || "";
    const nsB = b.namespace || "";
    if (nsA !== nsB) return nsA.localeCompare(nsB);
    return a.name.localeCompare(b.name);
  });

  return problems;
}
