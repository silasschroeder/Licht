"use client";

import styles from "./TopBar.module.css";

interface TopBarProps {
  namespaces: string[];
  selectedNamespace: string | null;
  onNamespaceChange: (ns: string | null) => void;
  connectionState: "connecting" | "live" | "reconnecting";
  lastUpdated: Date | null;
  onSearchClick: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

const CONNECTION_LABEL = {
  connecting: "connecting",
  live: "live",
  reconnecting: "reconnecting",
} as const;

export default function TopBar({
  namespaces,
  selectedNamespace,
  onNamespaceChange,
  connectionState,
  lastUpdated,
  onSearchClick,
  theme,
  onToggleTheme,
}: TopBarProps) {
  return (
    <header className={styles.bar}>
      <span className={styles.host}>kubernetes.default.svc</span>

      <label className={styles.scope}>
        <span className={styles.scopeLabel}>ns</span>
        <select
          className={styles.scopeSelect}
          value={selectedNamespace ?? ""}
          onChange={(e) => onNamespaceChange(e.target.value || null)}
          aria-label="Namespace scope"
        >
          <option value="">all namespaces</option>
          {namespaces.map((ns) => (
            <option key={ns} value={ns}>
              {ns}
            </option>
          ))}
        </select>
      </label>

      <button
        className={styles.search}
        onClick={onSearchClick}
        aria-label="Search resources"
      >
        <span>Search</span>
        <kbd className={styles.kbd}>⌘K</kbd>
      </button>

      <div className={styles.right}>
        <span
          className={`${styles.conn} ${styles[connectionState]}`}
          title={lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : ""}
        >
          <span className={styles.dot} aria-hidden />
          {CONNECTION_LABEL[connectionState]}
        </span>
        <button
          className={styles.themeToggle}
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
        >
          {theme === "light" ? "dark" : "light"}
        </button>
      </div>
    </header>
  );
}
