"use client";

import { ResourceData, Node, Namespace, Pod } from "@/types/kubernetes";
import { RailView } from "@/components/AppShell";
import { ActivityEntry } from "@/hooks/useKubernetesData";
import { deriveProblems } from "@/lib/health";
import { NamespaceCanvas } from "@/components/NamespaceCanvas";
import styles from "./Home.module.css";

interface HomeProps {
  resourceData: ResourceData;
  nodes: Node[];
  namespaces: Namespace[];
  counts: Record<string, number>;
  connectionState: "connecting" | "live" | "reconnecting";
  lastUpdated: Date | null;
  recent: ActivityEntry[];
  now: number;
  onViewSelect: (view: RailView) => void;
  onNamespaceSelect: (ns: string | null) => void;
  onPodSelect: (pod: Pod) => void;
  formatAge: (iso: string | null | undefined) => string;
}

const PROBLEMS_SHOWN = 8;

const TILES: { key: string; label: string }[] = [
  { key: "pods", label: "Pods" },
  { key: "deployments", label: "Deployments" },
  { key: "services", label: "Services" },
  { key: "nodes", label: "Nodes" },
  { key: "namespaces", label: "Namespaces" },
  { key: "jobs", label: "Jobs" },
];

function relAge(now: number, ts: number): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export function Home({
  resourceData,
  nodes,
  namespaces,
  counts,
  connectionState,
  lastUpdated,
  recent,
  now,
  onViewSelect,
  onNamespaceSelect,
  onPodSelect,
  formatAge,
}: HomeProps) {
  const problems = deriveProblems(resourceData, nodes);
  const shown = problems.slice(0, PROBLEMS_SHOWN);
  const moreCount = problems.length - shown.length;

  return (
    <div className={styles.home}>
      {/* What's broken — the anchor panel */}
      <section className={`${styles.panel} ${styles.broken}`}>
        <header className={styles.panelHead}>
          <h2 className={styles.panelTitle}>What&apos;s broken</h2>
          {problems.length > 0 && (
            <button
              className={styles.headLink}
              onClick={() => onViewSelect("health")}
            >
              {problems.length} issues →
            </button>
          )}
        </header>

        {problems.length === 0 ? (
          <div className={styles.allClear}>
            <span className={styles.clearDot} aria-hidden />
            All clear — no problems detected
          </div>
        ) : (
          <ul className={styles.problemList}>
            {shown.map((p, i) => (
              <li key={`${p.kind}/${p.namespace}/${p.name}/${i}`}>
                <button
                  className={styles.problemRow}
                  onClick={() => {
                    onViewSelect(p.view);
                    onNamespaceSelect(p.namespace);
                  }}
                >
                  <span
                    className={`${styles.sevDot} ${
                      p.sev === "critical" ? styles.critical : styles.warn
                    }`}
                    aria-hidden
                  />
                  <span className={styles.problemName}>
                    {p.namespace ? `${p.namespace}/${p.name}` : p.name}
                  </span>
                  <span className={styles.problemReason}>{p.reason}</span>
                  {p.detail && (
                    <span className={styles.problemDetail}>{p.detail}</span>
                  )}
                  <span className={styles.problemArrow} aria-hidden>
                    →
                  </span>
                </button>
              </li>
            ))}
            {moreCount > 0 && (
              <li>
                <button
                  className={styles.moreRow}
                  onClick={() => onViewSelect("health")}
                >
                  +{moreCount} more → Health
                </button>
              </li>
            )}
          </ul>
        )}
      </section>

      {/* Stat tiles */}
      <section className={`${styles.panel} ${styles.tiles}`}>
        <div className={styles.tileGrid}>
          {TILES.map((t) => (
            <button
              key={t.key}
              className={styles.tile}
              onClick={() => onViewSelect(t.key as RailView)}
            >
              <span className={styles.tileValue}>{counts[t.key] ?? 0}</span>
              <span className={styles.tileLabel}>{t.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Cluster info */}
      <section className={`${styles.panel} ${styles.info}`}>
        <h2 className={styles.panelTitle}>Cluster</h2>
        <dl className={styles.infoList}>
          <div className={styles.infoRow}>
            <dt>Connection</dt>
            <dd>
              <span
                className={`${styles.connDot} ${styles[connectionState]}`}
                aria-hidden
              />
              {connectionState}
            </dd>
          </div>
          <div className={styles.infoRow}>
            <dt>Updated</dt>
            <dd>{lastUpdated ? lastUpdated.toLocaleTimeString() : "-"}</dd>
          </div>
          <div className={styles.infoRow}>
            <dt>Nodes</dt>
            <dd>{counts.nodes ?? 0}</dd>
          </div>
          <div className={styles.infoRow}>
            <dt>Version</dt>
            <dd>{nodes[0]?.version || "-"}</dd>
          </div>
        </dl>
      </section>

      {/* Recent activity */}
      <section className={`${styles.panel} ${styles.activity}`}>
        <h2 className={styles.panelTitle}>Recent activity</h2>
        {recent.length === 0 ? (
          <div className={styles.empty}>waiting for live events…</div>
        ) : (
          <ul className={styles.activityList}>
            {recent.slice(0, 12).map((e, i) => (
              <li key={i} className={styles.activityRow}>
                <span className={styles.activityAge}>{relAge(now, e.ts)}</span>
                <span
                  className={`${styles.activityType} ${
                    e.type === "DELETED" ? styles.deleted : ""
                  }`}
                >
                  {e.type.toLowerCase()}
                </span>
                <span className={styles.activityKind}>{e.kind}</span>
                <span className={styles.activityName}>
                  {e.namespace ? `${e.namespace}/${e.name}` : e.name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Namespace overview — reuse the existing canvas */}
      <section className={`${styles.panel} ${styles.namespaces}`}>
        <h2 className={styles.panelTitle}>Namespaces</h2>
        <NamespaceCanvas
          namespaces={namespaces || []}
          pods={resourceData.pods || []}
          selectedNamespace={null}
          onNamespaceSelect={(ns) => {
            onNamespaceSelect(ns);
            onViewSelect("namespaces");
          }}
          onPodSelect={onPodSelect}
          formatAge={formatAge}
        />
      </section>
    </div>
  );
}
