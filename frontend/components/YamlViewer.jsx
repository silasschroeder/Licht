"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/app/page.module.css";
import Prism from "prismjs";
import "prismjs/components/prism-yaml";

// Optional: if you want to support copy of highlighted selection nicely
// import "prismjs/plugins/toolbar/prism-toolbar.css";
// import "prismjs/plugins/copy-to-clipboard/prism-copy-to-clipboard";

export default function YamlViewer({ kind, namespace, name, open, onClose }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState("live"); // or "last-applied"
  const nsParam = namespace
    ? `&namespace=${encodeURIComponent(namespace)}`
    : "";

  useEffect(() => {
    if (!open) return;
    let aborted = false;
    (async () => {
      setLoading(true);
      try {
        const url = `/api/yaml?kind=${encodeURIComponent(
          kind
        )}&name=${encodeURIComponent(
          name
        )}${nsParam}&source=${source}&clean=1&mask=1`;
        const res = await fetch(url, { credentials: "include" });
        const t = await res.text();
        if (!res.ok) throw new Error(t || `HTTP ${res.status}`);
        if (!aborted) setText(t);
      } catch (e) {
        if (!aborted) setText(`# Error: ${e.message}`);
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, namespace, name, source]);

  // Compute highlighted HTML once per text change
  const highlighted = useMemo(() => {
    try {
      return Prism.highlight(text, Prism.languages.yaml, "yaml");
    } catch {
      return text;
    }
  }, [text]);

  if (!open) return null;

  const download = () => {
    const blob = new Blob([text], { type: "application/x-yaml" });
    const a = document.createElement("a");
    const nsPrefix = namespace ? `${namespace}-` : "";
    a.download = `${nsPrefix}${kind.toLowerCase()}-${name}.yaml`;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalWindow} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            {kind}/{namespace ? namespace + "/" : ""}
            {name}
          </div>
          <div className={styles.modalActions}>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className={styles.resourceTab}
            >
              <option value="live">Live</option>
              <option value="last-applied">Last-applied</option>
            </select>
            <button onClick={copy} className={styles.resourceTab}>
              Copy
            </button>
            <button onClick={download} className={styles.resourceTab}>
              Download
            </button>
            <button onClick={onClose} className={styles.resourceTab}>
              Close
            </button>
          </div>
        </div>

        {loading ? (
          <pre className={styles.modalPre}>Loading…</pre>
        ) : (
          <pre className={styles.modalPre}>
            <code
              className="language-yaml"
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
          </pre>
        )}
      </div>
    </div>
  );
}
