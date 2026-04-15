export default function CompareLoading() {
  return (
    <div className="space-y-6 max-w-[1400px] animate-fade-in">
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-[2px] bg-muted/40 animate-pulse" />
        <div className="h-4 w-72 rounded-[2px] bg-muted/30 animate-pulse" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card h-20 animate-pulse bg-muted/20" />
        ))}
      </div>
    </div>
  );
}
