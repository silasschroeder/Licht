"use client";

import { useEffect, useMemo, useState, useRef, KeyboardEvent } from "react";
import styles from "@/app/page.module.css";
import Prism from "prismjs";
import "prismjs/components/prism-yaml";

interface YamlViewerProps {
  kind: string;
  namespace: string | null;
  name: string;
  open: boolean;
  onClose: () => void;
}

export default function YamlViewer({
  kind,
  namespace,
  name,
  open,
  onClose,
}: YamlViewerProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState("live");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const nsParam = namespace
    ? `&namespace=${encodeURIComponent(namespace)}`
    : "";

  // Fetch current YAML
  useEffect(() => {
    if (!open) return;
    let aborted = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/yaml?kind=${encodeURIComponent(
          kind
        )}&name=${encodeURIComponent(
          name
        )}${nsParam}&source=${source}&clean=1&mask=0`;
        const res = await fetch(url, { credentials: "include" });
        const t = await res.text();
        if (!res.ok) throw new Error(t || `HTTP ${res.status}`);
        if (!aborted) {
          setText(t);
          if (!isEditing) setEditText(t);
        }
      } catch (e: any) {
        if (!aborted) setText(`# Error: ${e.message}`);
        if (!aborted) setError(e.message);
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [open, kind, namespace, name, source]);

  // Keyboard escape handler
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !saving) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, saving, onClose]);

  // Focus trap
  useEffect(() => {
    if (!open || !modalRef.current) return;
    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement;

    const handleTab = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener("keydown", handleTab as any);
    firstElement?.focus();

    return () => {
      modal.removeEventListener("keydown", handleTab as any);
    };
  }, [open]);

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
      await navigator.clipboard.writeText(isEditing ? editText : text);
    } catch {}
  };

  const startEdit = () => {
    setEditText(text);
    setIsEditing(true);
    setError(null);
  };
  const cancelEdit = () => {
    setIsEditing(false);
    setEditText(text);
    setError(null);
  };
  const saveEdit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/yaml?kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(
          name
        )}${nsParam}`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/yaml",
            Accept: "application/x-yaml",
          },
          body: editText,
        }
      );
      const t = await res.text();
      if (!res.ok) throw new Error(t || `HTTP ${res.status}`);
      setText(t);
      setIsEditing(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={styles.modalBackdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="yaml-viewer-title"
    >
      <div
        ref={modalRef}
        className={styles.modalWindow}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div id="yaml-viewer-title" className={styles.modalTitle}>
            {kind}/{namespace ? namespace + "/" : ""}
            {name}
          </div>
          <div className={styles.modalActions}>
            {!isEditing && (
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className={styles.resourceTab}
                aria-label="YAML source"
              >
                <option value="live">Live</option>
                <option value="last-applied">Last-applied</option>
              </select>
            )}

            <button
              onClick={copy}
              className={`${styles.resourceTab} ${styles.iconButton}`}
              title="Copy YAML"
              aria-label="Copy YAML"
              disabled={saving}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="9" y="2" width="6" height="4" rx="1"></rect>
                <path d="M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"></path>
              </svg>
            </button>

            {!isEditing ? (
              <button
                onClick={startEdit}
                className={`${styles.resourceTab} ${styles.iconButton}`}
                title="Edit YAML"
                aria-label="Edit YAML"
                disabled={loading || !!error}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
              </button>
            ) : (
              <>
                <button
                  onClick={saveEdit}
                  className={styles.resourceTab}
                  disabled={saving}
                  title="Save"
                  aria-label="Save"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={cancelEdit}
                  className={styles.resourceTab}
                  disabled={saving}
                  title="Cancel"
                  aria-label="Cancel"
                >
                  Cancel
                </button>
              </>
            )}

            <button
              onClick={download}
              className={`${styles.resourceTab} ${styles.iconButton}`}
              title="Download YAML"
              aria-label="Download YAML"
              disabled={saving}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <path d="M7 10l5 5 5-5"></path>
                <path d="M12 15V3"></path>
              </svg>
            </button>

            <button
              onClick={onClose}
              className={`${styles.resourceTab} ${styles.iconButton} ${styles.iconClose}`}
              title="Close"
              aria-label="Close"
              disabled={saving}
            >
              ×
            </button>
          </div>
        </div>

        {error && (
          <div className={styles.error} style={{ margin: "10px 12px" }}>
            {String(error)}
          </div>
        )}

        {loading ? (
          <pre className={styles.modalPre}>Loading…</pre>
        ) : isEditing ? (
          <textarea
            className={styles.modalEditor}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            spellCheck={false}
            aria-label="YAML editor"
          />
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
