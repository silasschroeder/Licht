"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface Transform {
  x: number;
  y: number;
  scale: number;
}

interface PanZoomOptions {
  minScale?: number;
  maxScale?: number;
  initialTransform?: Transform;
}

/**
 * Pan and zoom interaction hook for SVG canvas
 */
export function usePanZoom(options: PanZoomOptions = {}) {
  const { minScale = 0.25, maxScale = 2, initialTransform } = options;

  const [transform, setTransform] = useState<Transform>(
    initialTransform || { x: 0, y: 0, scale: 1 }
  );

  const isDraggingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<SVGSVGElement | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start pan on middle click or when not clicking a node
    if (e.button === 1 || (e.target as Element).tagName === "svg") {
      isDraggingRef.current = true;
      lastPointRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;

    const dx = e.clientX - lastPointRef.current.x;
    const dy = e.clientY - lastPointRef.current.y;

    setTransform((prev) => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));

    lastPointRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Mouse position relative to SVG
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate new scale
      const delta = -e.deltaY * 0.001;
      const newScale = Math.max(
        minScale,
        Math.min(maxScale, transform.scale * (1 + delta))
      );

      // Adjust translation to zoom towards mouse position
      const scaleFactor = newScale / transform.scale;
      const newX = mouseX - (mouseX - transform.x) * scaleFactor;
      const newY = mouseY - (mouseY - transform.y) * scaleFactor;

      setTransform({
        x: newX,
        y: newY,
        scale: newScale,
      });
    },
    [transform, minScale, maxScale]
  );

  const zoomIn = useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      scale: Math.min(maxScale, prev.scale * 1.25),
    }));
  }, [maxScale]);

  const zoomOut = useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(minScale, prev.scale / 1.25),
    }));
  }, [minScale]);

  const resetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  const fitToContent = useCallback(
    (nodes: { x: number; y: number }[], padding = 50) => {
      if (nodes.length === 0 || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const minX = Math.min(...nodes.map((n) => n.x));
      const maxX = Math.max(...nodes.map((n) => n.x));
      const minY = Math.min(...nodes.map((n) => n.y));
      const maxY = Math.max(...nodes.map((n) => n.y));

      const contentWidth = maxX - minX + padding * 2;
      const contentHeight = maxY - minY + padding * 2;

      const scaleX = rect.width / contentWidth;
      const scaleY = rect.height / contentHeight;
      const scale = Math.min(scaleX, scaleY, maxScale);

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      setTransform({
        x: rect.width / 2 - centerX * scale,
        y: rect.height / 2 - centerY * scale,
        scale,
      });
    },
    [maxScale]
  );

  // Global mouse up handler
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  return {
    transform,
    containerRef,
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onWheel: handleWheel,
    },
    zoomIn,
    zoomOut,
    resetView,
    fitToContent,
  };
}
