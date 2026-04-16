"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResourceType,
  ResourceData,
} from "@/types/kubernetes";
import { useForceLayout } from "./useForceLayout";
import { usePanZoom } from "./usePanZoom";
import styles from "./TopologyView.module.css";

interface TopologySectionProps {
  resourceData: ResourceData;
  selectedNamespace: string | null;
  onResourceClick?: (type: ResourceType, name: string, namespace: string | null) => void;
}

interface TopologyNode {
  id: string;
  type: ResourceType;
  name: string;
  namespace: string | null;
  status: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface TopologyEdge {
  source: string;
  target: string;
  type: "owns" | "selects";
}

// Icons
const ZoomInIcon = () => (
  <svg className={styles.controlIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const ZoomOutIcon = () => (
  <svg className={styles.controlIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const FitIcon = () => (
  <svg className={styles.controlIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </svg>
);

function getStatusClass(status: string): string {
  switch (status) {
    case "Running":
    case "Active":
    case "Ready":
      return styles.nodeStatusRunning;
    case "Pending":
    case "ContainerCreating":
      return styles.nodeStatusPending;
    case "Failed":
    case "Error":
    case "CrashLoopBackOff":
      return styles.nodeStatusFailed;
    case "Succeeded":
    case "Completed":
      return styles.nodeStatusSucceeded;
    default:
      return styles.nodeStatusUnknown;
  }
}

function truncateName(name: string, maxLen: number = 10): string {
  if (name.length <= maxLen) return name;
  return name.substring(0, maxLen - 2) + "..";
}

/**
 * Always-visible topology section showing resource relationships
 */
export function TopologySection({
  resourceData,
  selectedNamespace,
  onResourceClick,
}: TopologySectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Measure container
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width || 800,
          height: rect.height || rect.width || 800, // Use actual height (square from CSS)
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);

    // Also observe container size changes
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateDimensions);
      resizeObserver.disconnect();
    };
  }, []);

  // Build nodes and edges from resource data
  const { nodes: initialNodes, edges } = useMemo(() => {
    const nodes: TopologyNode[] = [];
    const edges: TopologyEdge[] = [];

    // Filter by namespace if selected
    const filterByNs = (items: any[]) =>
      selectedNamespace
        ? items.filter((i) => i.namespace === selectedNamespace)
        : items;

    // Add deployments
    for (const dep of filterByNs(resourceData.deployments || [])) {
      const id = `deployment-${dep.namespace}-${dep.name}`;
      const ready = dep.ready?.split("/") || ["0", "0"];
      const status = parseInt(ready[0]) === parseInt(ready[1]) ? "Ready" : "Pending";
      nodes.push({
        id,
        type: "deployments",
        name: dep.name,
        namespace: dep.namespace,
        status,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
      });
    }

    // Add services
    for (const svc of filterByNs(resourceData.services || [])) {
      const id = `service-${svc.namespace}-${svc.name}`;
      nodes.push({
        id,
        type: "services",
        name: svc.name,
        namespace: svc.namespace,
        status: "Active",
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
      });
    }

    // Add pods and link to deployments
    for (const pod of filterByNs(resourceData.pods || [])) {
      const id = `pod-${pod.namespace}-${pod.name}`;
      nodes.push({
        id,
        type: "pods",
        name: pod.name,
        namespace: pod.namespace,
        status: pod.status || "Unknown",
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
      });

      // Link pod to deployment by name prefix
      for (const dep of filterByNs(resourceData.deployments || [])) {
        if (pod.namespace === dep.namespace && pod.name.startsWith(dep.name + "-")) {
          edges.push({
            source: `deployment-${dep.namespace}-${dep.name}`,
            target: id,
            type: "owns",
          });
          break;
        }
      }

      // Link service to pod
      for (const svc of filterByNs(resourceData.services || [])) {
        if (pod.namespace === svc.namespace) {
          // Simple heuristic: service name is prefix of pod name's deployment part
          const podBaseName = pod.name.split("-").slice(0, -2).join("-");
          if (podBaseName && svc.name === podBaseName) {
            edges.push({
              source: `service-${svc.namespace}-${svc.name}`,
              target: id,
              type: "selects",
            });
          }
        }
      }
    }

    return { nodes, edges };
  }, [resourceData, selectedNamespace]);

  // Force layout
  const {
    nodes,
    isStable,
    setNodePosition,
    releaseNode,
  } = useForceLayout(initialNodes, edges, {
    width: dimensions.width,
    height: dimensions.height,
    linkDistance: 150,      // More spacing between connected nodes
    chargeStrength: -400,   // Stronger repulsion to spread nodes apart
    centerStrength: 0.02,   // Weaker center pull
  });

  // Pan/zoom
  const {
    transform,
    containerRef: svgRef,
    handlers,
    zoomIn,
    zoomOut,
    fitToContent,
  } = usePanZoom();

  // Build node lookup
  const nodeById = useMemo(() => {
    const map = new Map<string, typeof nodes[0]>();
    for (const node of nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [nodes]);

  // Get connected nodes for highlighting
  const connectedNodes = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const connected = new Set<string>([selectedNode]);
    for (const edge of edges) {
      if (edge.source === selectedNode) connected.add(edge.target);
      if (edge.target === selectedNode) connected.add(edge.source);
    }
    return connected;
  }, [selectedNode, edges]);

  // Drag handlers
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      setDraggedNode(nodeId);
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handlers.onMouseMove(e);

      if (!draggedNode || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - transform.x) / transform.scale;
      const y = (e.clientY - rect.top - transform.y) / transform.scale;

      setNodePosition(draggedNode, x, y);
    },
    [draggedNode, transform, setNodePosition, svgRef, handlers]
  );

  const handleMouseUp = useCallback(() => {
    handlers.onMouseUp();
    if (draggedNode) {
      releaseNode(draggedNode);
      setDraggedNode(null);
    }
  }, [draggedNode, releaseNode, handlers]);

  const handleNodeClick = useCallback(
    (e: React.MouseEvent, node: TopologyNode) => {
      e.stopPropagation();
      if (selectedNode === node.id) {
        setSelectedNode(null);
      } else {
        setSelectedNode(node.id);
        onResourceClick?.(node.type, node.name, node.namespace);
      }
    },
    [selectedNode, onResourceClick]
  );

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Fit to content when stable
  useEffect(() => {
    if (isStable && nodes.length > 0) {
      fitToContent(nodes, 60);
    }
  }, [isStable, nodes.length]);

  if (initialNodes.length === 0) {
    return (
      <div className={styles.sectionContainer}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Resource Topology</h3>
        </div>
        <div className={styles.emptyTopology}>
          {selectedNamespace
            ? `No resources in namespace "${selectedNamespace}"`
            : "Select a namespace to view topology"}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sectionContainer}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Resource Topology</h3>
        <span className={styles.sectionSubtitle}>
          {nodes.length} resources
          {selectedNamespace && ` in ${selectedNamespace}`}
        </span>
      </div>

      <div className={styles.topologyWrapper} ref={containerRef}>
        <div className={styles.gridPattern} />

        <svg
          ref={svgRef}
          className={styles.canvas}
          onMouseDown={handlers.onMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handlers.onWheel}
          onClick={handleBackgroundClick}
        >
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
            {/* Edges */}
            {edges.map((edge, i) => {
              const source = nodeById.get(edge.source);
              const target = nodeById.get(edge.target);
              if (!source || !target) return null;

              const isHighlighted =
                selectedNode &&
                (edge.source === selectedNode || edge.target === selectedNode);
              const isDimmed = selectedNode && !isHighlighted;

              return (
                <line
                  key={i}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  className={`${styles.edge} ${
                    isHighlighted ? styles.edgeHighlighted : ""
                  } ${isDimmed ? styles.edgeDimmed : ""}`}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const isHighlighted = !selectedNode || connectedNodes.has(node.id);
              const isDimmed = selectedNode && !isHighlighted;
              const isDragging = draggedNode === node.id;
              const isHovered = hoveredNode === node.id;

              // Smaller node sizes
              const size = node.type === "deployments" ? 32 : node.type === "services" ? 28 : 24;
              const rx = node.type === "services" ? size / 2 : node.type === "deployments" ? 8 : 4;

              return (
                <g
                  key={node.id}
                  className={`${styles.node} ${
                    isHighlighted ? styles.nodeHighlighted : ""
                  } ${isDimmed ? styles.nodeDimmed : ""} ${
                    isDragging ? styles.nodeDragging : ""
                  }`}
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  onClick={(e) => handleNodeClick(e, node as TopologyNode)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Node shape */}
                  <rect
                    className={styles.nodeBody}
                    x={-size / 2}
                    y={-size / 2}
                    width={size}
                    height={size}
                    rx={rx}
                  />

                  {/* Type icon/label - centered inside the node */}
                  <text
                    className={styles.nodeTypeLabel}
                    textAnchor="middle"
                    dominantBaseline="central"
                    x={0}
                    y={0}
                  >
                    {node.type === "pods" ? "P" : node.type === "deployments" ? "D" : "S"}
                  </text>

                  {/* Name label - below the node */}
                  <text
                    className={styles.nodeNameLabel}
                    textAnchor="middle"
                    y={size / 2 + 14}
                  >
                    {truncateName(node.name, 12)}
                  </text>

                  {/* Hover tooltip */}
                  {isHovered && !isDragging && (
                    <g className={styles.nodeTooltipGroup}>
                      <rect
                        className={styles.nodeTooltipBg}
                        x={-60}
                        y={-size / 2 - 32}
                        width={120}
                        height={24}
                        rx={4}
                      />
                      <text
                        className={styles.nodeTooltipText}
                        textAnchor="middle"
                        dominantBaseline="central"
                        y={-size / 2 - 20}
                      >
                        {node.name}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Controls */}
        <div className={styles.controls}>
          <button
            className={styles.controlButton}
            onClick={zoomIn}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomInIcon />
          </button>
          <button
            className={styles.controlButton}
            onClick={zoomOut}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOutIcon />
          </button>
          <button
            className={styles.controlButton}
            onClick={() => fitToContent(nodes, 60)}
            aria-label="Fit to content"
            title="Fit to content"
          >
            <FitIcon />
          </button>
        </div>

        {/* Legend */}
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <div className={`${styles.legendShape} ${styles.legendShapeService}`}>S</div>
            <span className={styles.legendLabel}>Service</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendShape} ${styles.legendShapeDeployment}`}>D</div>
            <span className={styles.legendLabel}>Deployment</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendShape} ${styles.legendShapePod}`}>P</div>
            <span className={styles.legendLabel}>Pod</span>
          </div>
        </div>
      </div>
    </div>
  );
}
