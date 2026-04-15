// Streaming skeleton — shown while the dashboard server component runs
// the parallel Supabase fetches. Without this the previous route stays on
// screen for the full SSR latency.
export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-fade-in max-w-[1400px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-[2px] bg-muted/40 animate-pulse" />
          <div className="h-4 w-64 rounded-[2px] bg-muted/30 animate-pulse" />
        </div>
        <div className="h-9 w-48 rounded-[2px] bg-muted/40 animate-pulse" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <div className="card p-5 h-[260px] animate-pulse bg-muted/30" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card p-4 h-24 animate-pulse bg-muted/20" />
          ))}
        </div>
      </div>

      <div className="card p-5 h-[230px] animate-pulse bg-muted/30" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5 h-[220px] animate-pulse bg-muted/30" />
        <div className="card p-5 h-[220px] animate-pulse bg-muted/30" />
      </div>
    </div>
  );
}
