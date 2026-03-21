"use client";

import { GitCompare, Plus, Clock, CheckCircle, XCircle, Loader2, Swords, Lock } from "lucide-react";
import { ProjectSelector } from "@/components/project-selector";
import { useTranslation } from "@/lib/i18n/context";

export function ComparePaywall() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center gap-3">
        <GitCompare className="w-6 h-6 text-muted-foreground" />
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">{t("compare.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("compare.subtitle")}</p>
        </div>
      </div>
      <div className="card p-16 text-center border border-dashed border-[#c4a882]/30 space-y-4">
        <Lock className="w-12 h-12 text-[#c4a882]/40 mx-auto" />
        <h2 className="font-display font-semibold text-xl text-foreground">{t("compare.proFeature")}</h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">{t("compare.proDescription")}</p>
        <p className="text-muted-foreground text-sm">Disponibile dal piano Pro — €159/mese</p>
        <a href="/settings" className="inline-flex items-center gap-2 bg-[#c4a882] text-background font-semibold text-sm px-6 py-2.5 rounded-[2px] hover:bg-[#c4a882]/85 transition-colors mt-2">
          {t("settings.upgradePro")}
        </a>
      </div>
    </div>
  );
}

interface CompareListProps {
  list: any[];
  projectsList: { id: string; name: string }[];
}

export function CompareList({ list, projectsList }: CompareListProps) {
  const { t, locale } = useTranslation();

  const projectMap = new Map(projectsList.map((p) => [p.id, p.name]));

  function scoreLabel(score: number | null): { text: string; cls: string } {
    if (score == null) return { text: "—", cls: "text-muted-foreground" };
    if (score >= 60) return { text: t("compare.dominant"), cls: "text-primary" };
    if (score >= 40) return { text: t("compare.competitive"), cls: "text-[#c4a882]" };
    return { text: t("compare.disadvantaged"), cls: "text-destructive" };
  }

  return (
    <div data-tour="confronto-page" className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitCompare className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">{t("compare.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {list.length} {t("compare.analysesCount")} &middot; {t("compare.compareSubtitle")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ProjectSelector projects={projectsList} />
          <a href="/compare/new" data-tour="new-comparison-btn" className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-[2px] hover:bg-primary/85 transition-colors">
            <Plus className="w-4 h-4" />
            {t("compare.newAnalysis")}
          </a>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card p-12 text-center">
          <Swords className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{t("compare.noAnalysis")}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("compare.comparison")}</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("compare.driver")}</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("compare.project")}</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("compare.compScore")}</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("compare.status")}</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("compare.date")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a: any) => {
                  const label = scoreLabel(a.comp_score_a);
                  const StatusIcon = a.status === "completed" ? CheckCircle
                    : a.status === "failed" ? XCircle
                    : a.status === "running" ? Loader2
                    : Clock;
                  const statusCls = a.status === "completed" ? "text-primary"
                    : a.status === "failed" ? "text-destructive"
                    : a.status === "running" ? "text-yellow-500 animate-spin"
                    : "text-muted-foreground";

                  return (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <a href={`/compare/${a.id}`} className="text-foreground font-medium hover:text-primary transition-colors">
                          {a.brand_a} vs {a.brand_b}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.driver}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {projectMap.get(a.project_id) ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {a.comp_score_a != null ? (
                          <span className={`font-bold ${label.cls}`}>
                            {Math.round(a.comp_score_a)} — {label.text}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusIcon className={`w-4 h-4 ${statusCls}`} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString(locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
