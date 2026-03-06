import { createServerClient } from "@/lib/supabase/server";
import { AVIRing }       from "@/components/dashboard/avi-ring";
import { StatsRow }      from "@/components/dashboard/stats-row";
import { AVITrend }      from "@/components/dashboard/avi-trend";
import { CompetitorBar } from "@/components/dashboard/competitor-bar";
import { RecentRuns }    from "@/components/dashboard/recent-runs";
import { Plus }          from "lucide-react";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = createServerClient();
  const { data: projects } = await supabase
    .from("projects").select("id").limit(1);

  const hasData = (projects?.length ?? 0) > 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Panoramica AI Visibility</p>
        </div>
        {hasData && (
          <a
            href="/analysis"
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/85 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuova Analisi
          </a>
        )}
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* AVI + Stats */}
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-3"><AVIRing score={null} trend={null} /></div>
            <div className="col-span-9"><StatsRow /></div>
          </div>

          {/* Trend chart full width */}
          <AVITrend />

          {/* Recent runs + Competitors */}
          <div className="grid grid-cols-2 gap-4">
            <RecentRuns />
            <CompetitorBar />
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center">
      <div className="w-20 h-20 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center mb-5">
        <svg className="w-9 h-9 text-primary/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <h2 className="font-display font-semibold text-xl text-foreground mb-2">Nessun progetto ancora</h2>
      <p className="text-muted-foreground text-sm max-w-xs mb-7 leading-relaxed">
        Crea il tuo primo progetto per iniziare a misurare la visibilità del tuo brand nelle risposte AI.
      </p>
      <a
        href="/projects/new"
        className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/85 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Crea il primo progetto
      </a>
    </div>
  );
}
