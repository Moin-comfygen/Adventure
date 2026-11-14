export function DashboardSkeleton() {
  return (
    <div
      className="app dashboard-skeleton"
      aria-busy="true"
      role="status"
      aria-label="Loading dashboard"
    >
      <span className="sr-only">Loading dashboard, please wait.</span>
      <aside className="sidebar" aria-hidden="true">
        <div className="skeleton skeleton-brand" />
        {Array.from({ length: 9 }, (_, index) => (
          <div className="skeleton skeleton-nav" key={index} />
        ))}
      </aside>
      <main>
        <div className="skeleton-header" aria-hidden="true">
          <div className="skeleton skeleton-line" />
        </div>
        <div className="content" aria-hidden="true">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-period" />
          <div className="skeleton skeleton-greeting" />
          <div className="stats-grid dashboard-kpis">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="stat" key={index}>
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-value" />
                <div className="skeleton skeleton-line" />
              </div>
            ))}
          </div>
          <div className="dashboard-grid">
            <div className="card">
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-chart" />
            </div>
            <div className="card">
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-chart" />
            </div>
          </div>
          <div className="dashboard-grid lower">
            {[1, 2].map((index) => (
              <div className="card" key={index}>
                <div className="skeleton skeleton-line" />
                {[1, 2, 3].map((row) => (
                  <div key={row} className="skeleton skeleton-list" />
                ))}
              </div>
            ))}
          </div>
          <div className="card">
            <div className="skeleton skeleton-line" />
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="skeleton skeleton-row" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
