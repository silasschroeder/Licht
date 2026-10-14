"use client";

import styles from "./HealthView.module.css";

// Placeholder for the full health page. The home page's "what's broken" panel
// is the reduced view; this will show the complete diagnostics later.
export function HealthView() {
  return (
    <div className={styles.placeholder}>
      <h2 className={styles.title}>Health</h2>
      <p className={styles.body}>
        The full health view is coming soon. For now, the cluster&apos;s current
        problems are summarized on the Home page.
      </p>
    </div>
  );
}
