"use client";

import React, { useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Pod, Namespace } from "@/types/kubernetes";
import { staggerContainerVariants } from "@/lib/animations";
import { NamespaceCard } from "./NamespaceCard";
import styles from "./NamespaceCanvas.module.css";

interface NamespaceCanvasProps {
  namespaces: Namespace[];
  pods: Pod[];
  selectedNamespace: string | null;
  onNamespaceSelect: (name: string | null) => void;
  onPodSelect: (pod: Pod) => void;
  formatAge: (createdAt: string | null | undefined) => string;
}

/**
 * Animated grid of namespace cards with pod previews
 */
export function NamespaceCanvas({
  namespaces,
  pods,
  selectedNamespace,
  onNamespaceSelect,
  onPodSelect,
  formatAge,
}: NamespaceCanvasProps) {
  // Group pods by namespace
  const podsByNamespace = useMemo(() => {
    const map = new Map<string, Pod[]>();
    for (const pod of pods) {
      const ns = pod.namespace;
      if (!map.has(ns)) {
        map.set(ns, []);
      }
      map.get(ns)!.push(pod);
    }
    return map;
  }, [pods]);

  // Deduplicate namespaces
  const uniqueNamespaces = useMemo(() => {
    const seen = new Set<string>();
    return namespaces.filter((ns) => {
      const name = typeof ns === "string" ? ns : ns.name || "";
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [namespaces]);

  const handleNamespaceSelect = useCallback(
    (name: string) => {
      onNamespaceSelect(selectedNamespace === name ? null : name);
    },
    [selectedNamespace, onNamespaceSelect]
  );

  const handlePodCopy = useCallback(
    (pod: Pod) => {
      onPodSelect(pod);
    },
    [onPodSelect]
  );

  return (
    <motion.nav
      className={styles.canvas}
      aria-label="Namespace selection"
      variants={staggerContainerVariants}
      initial="initial"
      animate="animate"
    >
      {uniqueNamespaces.map((ns, index) => {
        const name = typeof ns === "string" ? ns : ns.name || "";
        const namespacePods = podsByNamespace.get(name) || [];

        return (
          <NamespaceCard
            key={name}
            name={name}
            pods={namespacePods}
            isSelected={selectedNamespace === name}
            onSelect={handleNamespaceSelect}
            onPodCopy={handlePodCopy}
            formatAge={formatAge}
            index={index}
          />
        );
      })}
    </motion.nav>
  );
}

// Re-export components for convenience
export { NamespaceCard } from "./NamespaceCard";
export { PodSquare } from "./PodSquare";
export { StatusRing } from "./StatusRing";
