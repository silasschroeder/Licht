"use client";

import { ReactNode } from "react";
import styles from "./AppShell.module.css";
import ResourceRail, { RailView } from "./ResourceRail";
import TopBar from "./TopBar";

interface AppShellProps {
  activeView: RailView;
  counts: Record<string, number>;
  onViewSelect: (view: RailView) => void;
  railCollapsed: boolean;
  onToggleRail: () => void;
  namespaces: string[];
  selectedNamespace: string | null;
  onNamespaceChange: (ns: string | null) => void;
  connectionState: "connecting" | "live" | "reconnecting";
  lastUpdated: Date | null;
  onSearchClick: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  children: ReactNode;
}

export default function AppShell({
  activeView,
  counts,
  onViewSelect,
  railCollapsed,
  onToggleRail,
  namespaces,
  selectedNamespace,
  onNamespaceChange,
  connectionState,
  lastUpdated,
  onSearchClick,
  theme,
  onToggleTheme,
  children,
}: AppShellProps) {
  return (
    <div className={styles.shell}>
      <ResourceRail
        active={activeView}
        counts={counts}
        onSelect={onViewSelect}
        collapsed={railCollapsed}
        onToggleCollapsed={onToggleRail}
      />
      <TopBar
        namespaces={namespaces}
        selectedNamespace={selectedNamespace}
        onNamespaceChange={onNamespaceChange}
        connectionState={connectionState}
        lastUpdated={lastUpdated}
        onSearchClick={onSearchClick}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
      <main className={styles.center}>{children}</main>
    </div>
  );
}
