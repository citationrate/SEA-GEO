import { GitCompare } from "lucide-react";

export const metadata = { title: "Confronto" };

export default function ComparePage() {
  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center gap-3">
        <GitCompare className="w-6 h-6 text-accent" />
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Confronto</h1>
          <p className="text-sm text-muted-foreground">Confronta i risultati tra run diverse</p>
        </div>
      </div>
      <div className="card p-16 text-center border border-dashed border-border/50">
        <GitCompare className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
        <h2 className="font-display font-semibold text-xl text-foreground mb-2">Coming Soon</h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Confronto side-by-side tra analisi: seleziona due run e visualizza le differenze in AVI, competitor, fonti e topic.
        </p>
      </div>
    </div>
  );
}
