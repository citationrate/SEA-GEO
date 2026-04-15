export default function TopicsLoading() {
  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="h-7 w-40 rounded-[2px] bg-muted/40 animate-pulse" />
        <div className="h-9 w-48 rounded-[2px] bg-muted/40 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="card p-3 h-20 animate-pulse bg-muted/20" />
        ))}
      </div>
    </div>
  );
}
