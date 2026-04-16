"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";

interface BaseNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
}

interface Edge {
  source: string;
  target: string;
}

interface ForceLayoutOptions {
  width: number;
  height: number;
  linkDistance?: number;
  chargeStrength?: number;
  centerStrength?: number;
}

/**
 * Stable force-directed layout hook
 * Uses proper cooling and collision detection
 */
export function useForceLayout<T extends BaseNode>(
  initialNodes: T[],
  edges: Edge[],
  options: ForceLayoutOptions
) {
  const {
    width,
    height,
    linkDistance = 100,
    chargeStrength = -200,
    centerStrength = 0.05,
  } = options;

  // Initialize nodes with better spread based on their type
  const initializeNodes = useCallback((nodes: T[]): T[] => {
    const nodesByType = new Map<string, T[]>();

    // Group nodes by type (from id prefix)
    nodes.forEach(n => {
      const type = n.id.split('-')[0];
      if (!nodesByType.has(type)) nodesByType.set(type, []);
      nodesByType.get(type)!.push(n);
    });

    const result: T[] = [];
    const types = Array.from(nodesByType.keys());
    const typeCount = types.length;

    types.forEach((type, typeIndex) => {
      const typeNodes = nodesByType.get(type)!;
      const count = typeNodes.length;

      // Arrange in a circle sector for each type
      const sectorAngle = (2 * Math.PI) / Math.max(typeCount, 1);
      const baseAngle = typeIndex * sectorAngle;
      const radius = Math.min(width, height) * 0.3;

      typeNodes.forEach((n, i) => {
        const angle = baseAngle + (i / Math.max(count, 1)) * sectorAngle * 0.8;
        const r = radius * (0.5 + 0.5 * (i % 3) / 3);

        result.push({
          ...n,
          x: width / 2 + Math.cos(angle) * r,
          y: height / 2 + Math.sin(angle) * r,
          vx: 0,
          vy: 0,
        });
      });
    });

    return result;
  }, [width, height]);

  const [nodes, setNodes] = useState<T[]>(() => initializeNodes(initialNodes));
  const [isStable, setIsStable] = useState(false);

  const alphaRef = useRef(1);
  const animationRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);

  // Build edge map for O(1) lookup
  const edgeMap = useMemo(() => {
    const map = new Map<string, { source: string; target: string }[]>();
    edges.forEach(edge => {
      if (!map.has(edge.source)) map.set(edge.source, []);
      if (!map.has(edge.target)) map.set(edge.target, []);
      map.get(edge.source)!.push(edge);
      map.get(edge.target)!.push(edge);
    });
    return map;
  }, [edges]);

  // Build node map for O(1) lookup
  const nodeMapRef = useRef(new Map<string, number>());

  const tick = useCallback(() => {
    setNodes((prevNodes) => {
      // Build fresh node map
      const nodeMap = new Map<string, number>();
      prevNodes.forEach((n, i) => nodeMap.set(n.id, i));
      nodeMapRef.current = nodeMap;

      const newNodes = prevNodes.map((node) => ({ ...node }));
      const alpha = alphaRef.current;

      // Decay alpha
      alphaRef.current *= 0.99;

      // Stop if converged
      if (alpha < 0.001) {
        setIsStable(true);
        return prevNodes;
      }

      const minDistance = 100; // Minimum distance between nodes - larger for better spacing

      // Apply forces
      for (let i = 0; i < newNodes.length; i++) {
        const node = newNodes[i];

        // Skip if fixed position
        if (node.fx != null && node.fy != null) {
          node.x = node.fx;
          node.y = node.fy;
          node.vx = 0;
          node.vy = 0;
          continue;
        }

        // Center force (weak)
        const centerDx = width / 2 - node.x;
        const centerDy = height / 2 - node.y;
        node.vx += centerDx * centerStrength * alpha;
        node.vy += centerDy * centerStrength * alpha;

        // Repulsion from other nodes
        for (let j = 0; j < newNodes.length; j++) {
          if (i === j) continue;
          const other = newNodes[j];
          let dx = node.x - other.x;
          let dy = node.y - other.y;
          let dist = Math.sqrt(dx * dx + dy * dy);

          // Avoid division by zero and add minimum separation
          if (dist < 1) {
            dx = (Math.random() - 0.5) * 2;
            dy = (Math.random() - 0.5) * 2;
            dist = 1;
          }

          // Stronger repulsion when too close
          const strength = chargeStrength * alpha;
          const force = strength / (dist * dist);

          node.vx += (dx / dist) * force;
          node.vy += (dy / dist) * force;

          // Collision force - push apart if too close
          if (dist < minDistance) {
            const overlap = (minDistance - dist) / 2;
            node.vx += (dx / dist) * overlap * 0.5;
            node.vy += (dy / dist) * overlap * 0.5;
          }
        }
      }

      // Link force - pull connected nodes together
      for (const edge of edges) {
        const sourceIdx = nodeMap.get(edge.source);
        const targetIdx = nodeMap.get(edge.target);
        if (sourceIdx === undefined || targetIdx === undefined) continue;

        const sourceNode = newNodes[sourceIdx];
        const targetNode = newNodes[targetIdx];

        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // Spring force
        const displacement = dist - linkDistance;
        const force = displacement * alpha * 0.1;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (sourceNode.fx == null) {
          sourceNode.vx += fx;
        }
        if (sourceNode.fy == null) {
          sourceNode.vy += fy;
        }
        if (targetNode.fx == null) {
          targetNode.vx -= fx;
        }
        if (targetNode.fy == null) {
          targetNode.vy -= fy;
        }
      }

      // Update positions with velocity and damping
      const damping = 0.4; // Higher = more friction
      const padding = 80;

      for (const node of newNodes) {
        if (node.fx != null) {
          node.x = node.fx;
          node.vx = 0;
        } else {
          node.vx *= (1 - damping);
          node.x += node.vx;
          node.x = Math.max(padding, Math.min(width - padding, node.x));
        }

        if (node.fy != null) {
          node.y = node.fy;
          node.vy = 0;
        } else {
          node.vy *= (1 - damping);
          node.y += node.vy;
          node.y = Math.max(padding, Math.min(height - padding, node.y));
        }
      }

      return newNodes;
    });
  }, [width, height, edges, linkDistance, chargeStrength, centerStrength]);

  // Run simulation
  useEffect(() => {
    const simulate = () => {
      if (alphaRef.current > 0.001 && isRunningRef.current) {
        tick();
        animationRef.current = requestAnimationFrame(simulate);
      } else {
        isRunningRef.current = false;
      }
    };

    // Reset and start
    alphaRef.current = 1;
    setIsStable(false);
    isRunningRef.current = true;
    simulate();

    return () => {
      isRunningRef.current = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [tick]);

  // Reset when nodes change (compare by ids)
  const nodeIds = useMemo(() =>
    initialNodes.map(n => n.id).sort().join(','),
    [initialNodes]
  );

  useEffect(() => {
    setNodes(initializeNodes(initialNodes));
    alphaRef.current = 1;
    setIsStable(false);
    isRunningRef.current = true;
  }, [nodeIds, initializeNodes]);

  const setNodePosition = useCallback((id: string, x: number, y: number) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === id ? { ...node, x, y, fx: x, fy: y, vx: 0, vy: 0 } : node
      )
    );
  }, []);

  const releaseNode = useCallback((id: string) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === id ? { ...node, fx: null, fy: null } : node
      )
    );
    // Restart simulation briefly
    alphaRef.current = 0.3;
    isRunningRef.current = true;
  }, []);

  return {
    nodes,
    isStable,
    setNodePosition,
    releaseNode,
  };
}
