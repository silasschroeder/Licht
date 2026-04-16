/**
 * Licht Animation System
 * Reusable Framer Motion variants for consistent animations
 */

import { Variants, Transition } from "framer-motion";

// Transition presets
export const transitions = {
  fast: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } as Transition,
  normal: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } as Transition,
  slow: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } as Transition,
  spring: { type: "spring", stiffness: 400, damping: 30 } as Transition,
  springBouncy: { type: "spring", stiffness: 300, damping: 20 } as Transition,
} as const;

// Card animations
export const cardVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: transitions.fast,
  },
  hover: {
    y: -4,
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
    transition: transitions.fast,
  },
  tap: {
    scale: 0.98,
    transition: transitions.fast,
  },
  selected: {
    boxShadow: "0 0 0 2px #1669e8, 0 8px 24px rgba(22, 105, 232, 0.2)",
  },
};

// Staggered container for lists/grids
export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

// Item variants for staggered animations
export const staggerItemVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: transitions.fast,
  },
};

// Fade variants
export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: transitions.normal },
  exit: { opacity: 0, transition: transitions.fast },
};

// Scale fade variants (for modals, overlays)
export const scaleFadeVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.9,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: transitions.fast,
  },
};

// Slide variants (for drawers, panels)
export const slideRightVariants: Variants = {
  initial: {
    x: "100%",
    opacity: 0,
  },
  animate: {
    x: 0,
    opacity: 1,
    transition: transitions.spring,
  },
  exit: {
    x: "100%",
    opacity: 0,
    transition: transitions.normal,
  },
};

export const slideUpVariants: Variants = {
  initial: {
    y: 20,
    opacity: 0,
  },
  animate: {
    y: 0,
    opacity: 1,
    transition: transitions.spring,
  },
  exit: {
    y: 20,
    opacity: 0,
    transition: transitions.fast,
  },
};

// Backdrop variants
export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: transitions.normal },
  exit: { opacity: 0, transition: transitions.fast },
};

// Pod/Status animations
export const statusPulseVariants: Variants = {
  initial: {
    scale: 1,
  },
  pulse: {
    scale: [1, 1.15, 1],
    transition: {
      duration: 0.6,
      ease: "easeInOut",
    },
  },
};

export const statusChangeVariants: Variants = {
  initial: {
    scale: 1,
  },
  changed: {
    scale: [1, 1.2, 1],
    transition: {
      duration: 0.4,
      ease: "easeOut",
    },
  },
};

// Ripple effect helper
export const rippleVariants: Variants = {
  initial: {
    scale: 0,
    opacity: 0.5,
  },
  animate: {
    scale: 2.5,
    opacity: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

// Tooltip variants
export const tooltipVariants: Variants = {
  initial: {
    opacity: 0,
    y: 5,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: transitions.fast,
  },
  exit: {
    opacity: 0,
    y: 5,
    scale: 0.95,
    transition: { duration: 0.1 },
  },
};

// View toggle animation
export const viewSwitchVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: { duration: 0.3 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

// Topology node variants
export const topologyNodeVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: transitions.springBouncy,
  },
  exit: {
    opacity: 0,
    scale: 0,
    transition: transitions.fast,
  },
  hover: {
    scale: 1.1,
    transition: transitions.fast,
  },
  dragging: {
    scale: 1.15,
    zIndex: 100,
  },
  highlighted: {
    scale: 1.1,
    boxShadow: "0 0 20px rgba(22, 105, 232, 0.4)",
  },
  dimmed: {
    opacity: 0.3,
  },
};

// Edge/connection line variants
export const edgeVariants: Variants = {
  initial: {
    pathLength: 0,
    opacity: 0,
  },
  animate: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.5, ease: "easeOut" },
  },
  exit: {
    pathLength: 0,
    opacity: 0,
    transition: transitions.fast,
  },
  highlighted: {
    opacity: 1,
    strokeWidth: 3,
  },
  dimmed: {
    opacity: 0.15,
  },
};

// Quick filter overlay
export const quickFilterVariants: Variants = {
  initial: {
    opacity: 0,
    y: -20,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.98,
    transition: transitions.fast,
  },
};

// Filter chip variants
export const chipVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.8,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: transitions.springBouncy,
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: transitions.fast,
  },
};
