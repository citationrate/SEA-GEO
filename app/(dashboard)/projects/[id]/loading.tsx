export default function ProjectDetailLoading() {
  return (
    <div className="space-y-6 max-w-[1400px] animate-fade-in">
      <div>
        <div className="h-4 w-28 rounded-[2px] bg-muted/30 animate-pulse mb-3" />
        <div className="h-8 w-72 rounded-[2px] bg-muted/40 animate-pulse" />
        <div className="h-4 w-48 rounded-[2px] bg-muted/30 animate-pulse mt-2" />
      </div>
      <div className="card p-5 h-28 animate-pulse bg-muted/30" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5 h-48 animate-pulse bg-muted/20" />
        <div className="card p-5 h-48 animate-pulse bg-muted/20" />
      </div>
      <div className="card p-5 h-32 animate-pulse bg-muted/20" />
    </div>
  );
}
