"use client";

import { AVIRing, StatsRow, AVITrend, CompetitorBar, RecentRuns } from "@/components/dashboard/index";
import { ProjectSelector } from "@/components/project-selector";
import { ModelSelector } from "@/components/model-selector";

interface DashboardClientProps {
  aviScore: number | null;
  aviTrend: number | null;
  aviComponents?: { label: string; v: number | null }[];
  stats: { label: string; value: string; sub: string }[];
  trendData: { run: string; avi: number; prominence: number; sentiment: number }[];
  recentRuns: { id: string; project_id: string; project_name: string; version: number; status: string; avi_score: number | null; date: string }[];
  competitorBarData: { name: string; count: number }[];
  projects?: { id: string; name: string }[];
  availableModels?: string[];
}

export function DashboardClient({
  aviScore,
  aviTrend,
  aviComponents,
  stats,
  trendData,
  recentRuns,
  competitorBarData,
  projects,
  availableModels,
}: DashboardClientProps) {
  return (
    <div className="space-y-6 animate-fade-in max-w-[1400px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Panoramica della visibilita AI dei tuoi brand</p>
        </div>
        <div className="flex items-center gap-3">
          {availableModels && <ModelSelector models={availableModels} />}
          {projects && <ProjectSelector projects={projects} />}
        </div>
      </div>

      {/* Top row: AVI Ring + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <AVIRing score={aviScore} trend={aviTrend} components={aviComponents} />
        <StatsRow stats={stats} />
      </div>

      {/* Trend chart */}
      <AVITrend data={trendData} />

      {/* Bottom row: Competitors + Recent Runs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CompetitorBar data={competitorBarData} />
        <RecentRuns runs={recentRuns} />
      </div>
    </div>
  );
}
