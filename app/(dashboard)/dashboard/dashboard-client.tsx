"use client";

import { AVIRing, StatsRow, AVITrend, CompetitorBar, RecentRuns } from "@/components/dashboard/index";
import { ProjectSelector } from "@/components/project-selector";
import { AnalysisLauncher } from "@/app/(dashboard)/projects/[id]/analysis-launcher";
import { useTranslation } from "@/lib/i18n/context";

interface DashboardClientProps {
  aviScore: number | null;
  aviTrend: number | null;
  aviComponents?: { labelKey: string; v: number | null }[];
  noBrandMentions?: boolean;
  stats: { labelKey: string; value: string; subKey: string }[];
  trendData: { run: string; avi: number | null; prominence: number | null; sentiment: number | null; [key: string]: any }[];
  recentRuns: { id: string; project_id: string; project_name: string; version: number; status: string; avi_score: number | null; date: string }[];
  competitorBarData: { name: string; avi: number }[];
  projects?: { id: string; name: string }[];
  models?: string[];
  activeProjectId?: string | null;
  projectQueryCount?: number;
  projectSegmentCount?: number;
  projectModelsConfig?: string[];
}

export function DashboardClient({
  aviScore,
  aviTrend,
  aviComponents,
  noBrandMentions,
  stats,
  trendData,
  recentRuns,
  competitorBarData,
  projects,
  models,
  activeProjectId,
  projectQueryCount,
  projectSegmentCount,
  projectModelsConfig,
}: DashboardClientProps) {
  const { t } = useTranslation();

  const translatedStats = stats.map(s => ({ label: t(s.labelKey), value: s.value, sub: t(s.subKey) }));
  const translatedComponents = aviComponents?.map(c => ({ label: t(c.labelKey), labelKey: c.labelKey, v: c.v }));

  return (
    <div className="space-y-6 animate-fade-in max-w-[1400px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {projects && <ProjectSelector projects={projects} />}
          {activeProjectId && (
            <AnalysisLauncher
              projectId={activeProjectId}
              hasQueries={(projectQueryCount ?? 0) > 0}
              queryCount={projectQueryCount ?? 0}
              segmentCount={projectSegmentCount ?? 0}
              modelsConfig={projectModelsConfig ?? ["gpt-4o-mini"]}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <AVIRing score={aviScore} trend={aviTrend} components={translatedComponents} noBrandMentions={noBrandMentions} />
        <StatsRow stats={translatedStats} />
      </div>

      <div data-tour="avi-trend">
        <AVITrend data={trendData} models={models} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CompetitorBar data={competitorBarData} />
        <div data-tour="recent-runs">
          <RecentRuns runs={recentRuns} />
        </div>
      </div>
    </div>
  );
}
