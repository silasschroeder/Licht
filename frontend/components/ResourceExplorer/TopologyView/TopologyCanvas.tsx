"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { motion } from "framer-motion";
import {
  ResourceItem,
  ResourceType,
  ResourceData,
  Pod,
  Deployment,
  Service,
} from "@/types/kubernetes";
import { useForceLayout } from "./useForceLayout";
import { usePanZoom } from "./usePanZoom";
import styles from "./TopologyView.module.css";

interface TopologyCanvasProps {
  resourceData: ResourceData;
  selectedNamespace: string | null;
  onNodeClick: (type: ResourceType, name: string, namespace: string | null) => void;
  onYamlClick: (kind: string, namespace: string | null, name: string) => void;
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

// Icons for zoom controls
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

function getNodeTypeClass(type: ResourceType): string {
  switch (type) {
    case "pods":
      return styles.nodePod;
    case "deployments":
      return styles.nodeDeployment;
    case "services":
      return styles.nodeService;
    default:
      return "";
  }
}

/**
 * Topology view showing resource relationships as a force-directed graph
 */
export function TopologyCanvas({
  resourceData,
  selectedNamespace,
  onNodeClick,
  onYamlClick,
}: TopologyCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);

  // Measure container
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Build nodes and edges from resource data
  const { nodes: initialNodes, edges } = useMemo(() => {
    const nodes: TopologyNode[] = [];
    const edges: TopologyEdge[] = [];
    const nodeMap = new Map<string, TopologyNode>();

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
      const node: TopologyNode = {
        id,
        type: "deployments",
        name: dep.name,
        namespace: dep.namespace,
        status,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
      };
      nodes.push(node);
      nodeMap.set(id, node);
    }

    // Add pods and link to deployments
    for (const pod of filterByNs(resourceData.pods || [])) {
      const id = `pod-${pod.namespace}-${pod.name}`;
      const node: TopologyNode = {
        id,
        type: "pods",
        name: pod.name,
        namespace: pod.namespace,
        status: pod.status || "Unknown",
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
      };
      nodes.push(node);
      nodeMap.set(id, node);

      // Try to match pod to deployment by name prefix
      const deployments = filterByNs(resourceData.deployments || []);
      for (const dep of deployments) {
        // Deployment creates ReplicaSet with name pattern: {deployment}-{hash}
        // ReplicaSet creates pods with name pattern: {replicaset}-{hash}
        // So pod names often start with deployment name
        if (
          pod.namespace === dep.namespace &&
          pod.name.startsWith(dep.name + "-")
        ) {
          edges.push({
            source: `deployment-${dep.namespace}-${dep.name}`,
            target: id,
            type: "owns",
          });
          break;
        }
      }
    }

    // Add services and link to pods by selector (simplified: match by name prefix)
    for (const svc of filterByNs(resourceData.services || [])) {
      const id = `service-${svc.namespace}-${svc.name}`;
      const node: TopologyNode = {
        id,
        type: "services",
        name: svc.name,
        namespace: svc.namespace,
        status: "Active",
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
      };
      nodes.push(node);
      nodeMap.set(id, node);

      // Simplified: link service to pods with matching name prefix
      const pods = filterByNs(resourceData.pods || []);
      for (const pod of pods) {
        if (
          pod.namespace === svc.namespace &&
          (pod.name.startsWith(svc.name + "-") || svc.name.startsWith(pod.name.split("-")[0]))
        ) {
          edges.push({
            source: id,
            target: `pod-${pod.namespace}-${pod.name}`,
            type: "selects",
          });
        }
      }
    }

    return { nodes, edges };
  }, [resourceData, selectedNamespace]);

  // Force layout
  const {
    nodes,
    setNodePosition,
    releaseNode,
  } = useForceLayout(initialNodes, edges, {
    width: dimensions.width,
    height: dimensions.height,
    linkDistance: 100,
    chargeStrength: -400,
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

  const handleNodeMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggedNode || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - transform.x) / transform.scale;
      const y = (e.clientY - rect.top - transform.y) / transform.scale;

      setNodePosition(draggedNode, x, y);
    },
    [draggedNode, transform, setNodePosition, svgRef]
  );

  const handleNodeMouseUp = useCallback(() => {
    if (draggedNode) {
      releaseNode(draggedNode);
      setDraggedNode(null);
    }
  }, [draggedNode, releaseNode]);

  const handleNodeClick = useCallback(
    (e: React.MouseEvent, node: TopologyNode) => {
      e.stopPropagation();
      if (selectedNode === node.id) {
        setSelectedNode(null);
      } else {
        setSelectedNode(node.id);
        onNodeClick(node.type, node.name, node.namespace);
      }
    },
    [selectedNode, onNodeClick]
  );

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Fit to content on initial render
  useEffect(() => {
    if (nodes.length > 0) {
      setTimeout(() => fitToContent(nodes, 80), 500);
    }
  }, [nodes.length]);

  if (initialNodes.length === 0) {
    return (
      <div className={styles.container} ref={containerRef}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "var(--text-tertiary)",
          }}
        >
          No resources to display
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.gridPattern} />

      <svg
        ref={svgRef}
        className={styles.canvas}
        {...handlers}
        onMouseMove={(e) => {
          handlers.onMouseMove(e);
          handleNodeMouseMove(e);
        }}
        onMouseUp={() => {
          handlers.onMouseUp();
          handleNodeMouseUp();
        }}
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
                } ${isDimmed ? styles.edgeDimmed : ""} ${
                  isHighlighted ? styles.edgeFlow : ""
                }`}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isHighlighted =
              !selectedNode || connectedNodes.has(node.id);
            const isDimmed = selectedNode && !isHighlighted;
            const isDragging = draggedNode === node.id;

            const typeClass = getNodeTypeClass(node.type);
            const statusClass = getStatusClass(node.status);

            // Different sizes for different resource types
            const size =
              node.type === "deployments"
                ? 50
                : node.type === "services"
                ? 45
                : 40;

            return (
              <g
                key={node.id}
                className={`${styles.node} ${typeClass} ${
                  isHighlighted ? styles.nodeHighlighted : ""
                } ${isDimmed ? styles.nodeDimmed : ""} ${
                  isDragging ? styles.nodeDragging : ""
                }`}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onClick={(e) => handleNodeClick(e, node as TopologyNode)}
              >
                {/* Node shape */}
                <rect
                  className={styles.nodeBody}
                  x={-size / 2}
                  y={-size / 2}
                  width={size}
                  height={size}
                  rx={node.type === "services" ? size / 2 : node.type === "deployments" ? 12 : 6}
                />

                {/* Status indicator */}
                <circle
                  className={`${styles.nodeStatus} ${statusClass}`}
                  cx={size / 2 - 8}
                  cy={-size / 2 + 8}
                  r={5}
                />

                {/* Type label */}
                <text className={styles.nodeType} y={-size / 2 + 20}>
                  {node.type === "pods"
                    ? "POD"
                    : node.type === "deployments"
                    ? "DEP"
                    : "SVC"}
                </text>

                {/* Name label */}
                <text className={styles.nodeLabel} y={6}>
                  {node.name.length > 12
                    ? node.name.substring(0, 10) + "..."
                    : node.name}
                </text>
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
          onClick={() => fitToContent(nodes, 80)}
          aria-label="Fit to content"
          title="Fit to content"
        >
          <FitIcon />
        </button>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={`${styles.legendShape} ${styles.legendShapePod}`} />
          <span className={styles.legendLabel}>Pod</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendShape} ${styles.legendShapeDeployment}`} />
          <span className={styles.legendLabel}>Deployment</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendShape} ${styles.legendShapeService}`} />
          <span className={styles.legendLabel}>Service</span>
        </div>
      </div>

      {/* Selected node info */}
      {selectedNode && nodeById.get(selectedNode) && (
        <motion.div
          className={styles.selectedInfo}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className={styles.selectedInfoTitle}>
            {nodeById.get(selectedNode)!.name}
          </div>
          <div className={styles.selectedInfoMeta}>
            {nodeById.get(selectedNode)!.type} &middot;{" "}
            {nodeById.get(selectedNode)!.namespace || "cluster"} &middot;{" "}
            {nodeById.get(selectedNode)!.status}
          </div>
        </motion.div>
      )}
    </div>
  );
}
