"use client";

import { KeyboardEvent } from "react";
import styles from "@/app/page.module.css";
import { ResourceType } from "@/types/kubernetes";

interface Tab {
  value: ResourceType;
  label: string;
}

interface ResourceTabsProps {
  activeType: ResourceType;
  onTabChange: (type: ResourceType) => void;
  counts?: Partial<Record<ResourceType, number>>;
}

const TABS: Tab[] = [
  { value: "pods", label: "Pods" },
  { value: "deployments", label: "Deployments" },
  { value: "services", label: "Services" },
  { value: "replicaSets", label: "ReplicaSets" },
  { value: "statefulSets", label: "StatefulSets" },
  { value: "daemonSets", label: "DaemonSets" },
  { value: "jobs", label: "Jobs" },
  { value: "cronJobs", label: "CronJobs" },
];

export default function ResourceTabs({
  activeType,
  onTabChange,
  counts,
}: ResourceTabsProps) {
  const handleKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = (index + 1) % TABS.length;
      const nextButton = document.querySelector(
        `[data-tab-index="${nextIndex}"]`
      ) as HTMLButtonElement;
      nextButton?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = (index - 1 + TABS.length) % TABS.length;
      const prevButton = document.querySelector(
        `[data-tab-index="${prevIndex}"]`
      ) as HTMLButtonElement;
      prevButton?.focus();
    }
  };

  return (
    <div className={styles.resourceTabs} role="tablist" aria-label="Resource types">
      {TABS.map((tab, index) => {
        const isActive = activeType === tab.value;
        const count = counts?.[tab.value];
        return (
          <button
            key={tab.value}
            data-tab-index={index}
            className={`${styles.resourceTab} ${
              isActive ? styles.activeTab : ""
            }`}
            onClick={() => onTabChange(tab.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            role="tab"
            aria-selected={isActive}
            aria-controls={`${tab.value}-panel`}
            tabIndex={isActive ? 0 : -1}
          >
            {tab.label}
            {count !== undefined && ` (${count})`}
          </button>
        );
      })}
    </div>
  );
}
