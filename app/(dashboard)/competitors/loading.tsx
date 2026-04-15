export default function CompetitorsLoading() {
  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center justify-end">
        <div className="h-9 w-48 rounded-[2px] bg-muted/40 animate-pulse" />
      </div>
      <div className="card p-5 h-28 animate-pulse bg-muted/30" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="card h-16 animate-pulse bg-muted/20" />
        ))}
      </div>
    </div>
  );
}
