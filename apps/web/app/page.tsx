import type { ReactElement } from "react";

/**
 * Placeholder landing page. The Admin Application (Dashboard, Inbox, Customers,
 * Products, AI, Knowledge, Campaigns, Analytics, Settings) is built out starting
 * Phase 2 — see docs/architecture/roadmap.md. This page exists so the Phase 0
 * scaffold builds and runs end-to-end.
 */
export default function HomePage(): ReactElement {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Polar AI Commerce</h1>
      <p>Admin application — under construction. See docs/architecture/roadmap.md for the build plan.</p>
    </main>
  );
}
