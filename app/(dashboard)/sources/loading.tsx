export default function SourcesLoading() {
  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center justify-end">
        <div className="h-9 w-48 rounded-[2px] bg-muted/40 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 h-24 animate-pulse bg-muted/20" />
        ))}
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="card h-14 animate-pulse bg-muted/20" />
        ))}
      </div>
    </div>
  );
}
