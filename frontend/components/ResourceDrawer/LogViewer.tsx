"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import styles from "./LogViewer.module.css";

interface LogViewerProps {
  namespace: string | null;
  name: string;
}

const API_BASE = "";

export function LogViewer({ namespace, name }: LogViewerProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [containers, setContainers] = useState<string[]>([]);
  const [container, setContainer] = useState<string>("");
  const [follow, setFollow] = useState(true);
  const [wrap, setWrap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(follow);
  followRef.current = follow;

  // Fetch the pod's containers for the selector.
  useEffect(() => {
    if (!namespace || !name) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/pods/containers?namespace=${encodeURIComponent(
            namespace
          )}&name=${encodeURIComponent(name)}`
        );
        if (!res.ok || cancelled) return;
        const names: string[] = await res.json();
        if (cancelled) return;
        setContainers(names);
        setContainer((c) => c || names[0] || "");
      } catch {
        /* selector stays empty; stream still works with default container */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [namespace, name]);

  // Open the log stream for the selected pod + container.
  useEffect(() => {
    if (!namespace || !name) return;
    setLines([]);
    setError(null);

    const params = new URLSearchParams({ namespace, name });
    if (container) params.set("container", container);
    const es = new EventSource(`${API_BASE}/api/pods/logs?${params}`);

    es.addEventListener("log", (ev) => {
      try {
        const line = JSON.parse((ev as MessageEvent).data);
        setLines((prev) => {
          // Cap retained lines so a long-running follow does not grow unbounded.
          const next = prev.length > 5000 ? prev.slice(-4000) : prev;
          return [...next, line];
        });
      } catch {
        /* ignore malformed line */
      }
    });
    es.addEventListener("error", (ev) => {
      const data = (ev as MessageEvent).data;
      if (data) {
        try {
          setError(JSON.parse(data));
        } catch {
          setError("Log stream error");
        }
      }
    });

    return () => es.close();
  }, [namespace, name, container]);

  // Auto-scroll to bottom while following.
  useEffect(() => {
    if (followRef.current && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  // Scrolling up pauses follow; scrolling back to the bottom resumes it.
  const onScroll = useCallback(() => {
    const el = outputRef.current;
    if (!el) return;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setFollow(atBottom);
  }, []);

  const jumpToBottom = () => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setFollow(true);
  };

  return (
    <div className={styles.logsPane}>
      <div className={styles.toolbar}>
        {containers.length > 1 && (
          <select
            className={styles.select}
            value={container}
            onChange={(e) => setContainer(e.target.value)}
            aria-label="Container"
          >
            {containers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <button
          className={`${styles.toggle} ${wrap ? styles.toggleOn : ""}`}
          onClick={() => setWrap((w) => !w)}
        >
          wrap
        </button>
        <button
          className={`${styles.toggle} ${follow ? styles.toggleOn : ""}`}
          onClick={() => (follow ? setFollow(false) : jumpToBottom())}
        >
          {follow ? "following" : "follow"}
        </button>
      </div>

      <div
        ref={outputRef}
        className={`${styles.output} ${wrap ? styles.wrap : ""}`}
        onScroll={onScroll}
      >
        {error ? (
          <span className={styles.error}>{error}</span>
        ) : lines.length === 0 ? (
          <span className={styles.placeholder}>Waiting for log output...</span>
        ) : (
          lines.map((line, i) => (
            <div key={i} className={styles.line}>
              {line}
            </div>
          ))
        )}
      </div>

      {!follow && !error && (
        <button className={styles.jump} onClick={jumpToBottom}>
          jump to live
        </button>
      )}
    </div>
  );
}
