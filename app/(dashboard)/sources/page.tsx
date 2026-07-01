import { createServerClient, createDataClient } from "@/lib/supabase/server";
import { ProjectSelector } from "@/components/project-selector";

import { getActiveProjectId } from "@/lib/utils/active-project";
import { SourcesClient } from "./sources-client";

export const metadata = { title: "Fonti" };

export interface SourceDomain {
  domain: string;
  sourceType: string;
  sourceOrigin: "ai_consulted" | "text_mention";
  citations: number;
  analysisCount: number;
  isBrandOwned: boolean;
  contexts: string[];
  urls: string[];
}

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: { projectId?: string; model?: string };
}) {
  const auth = createServerClient();
  // Cookie-only auth — middleware already gates this route.
  // SECURITY: getUser() validates the JWT with Supabase Auth; getSession() reads only
  // the cookie and can return a stale identity (cross-account contamination from
  // chunked-cookie remnants after Suite->AVI handoff).
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;

  const supabase = createDataClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, target_brand")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const projectsList = (projects ?? []) as any[];
  const projectIds = projectsList.map((p: any) => p.id);

  // Default landing project = the one holding the user's most recently COMPLETED
  // analysis — mirrors the dashboard so "Fonti" lands on the same project the user
  // was looking at, not projects[0] (newest-created, often an empty project).
  // Only needed when the URL doesn't already pin a project.
  let lastCompletedProjectId: string | null = null;
  if (!searchParams.projectId && projectIds.length > 0) {
    const { data: lastDone } = await supabase
      .from("analysis_runs")
      .select("project_id")
      .in("project_id", projectIds)
      .eq("status", "completed")
      .is("deleted_at", null)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastCompletedProjectId = (lastDone as any)?.project_id ?? null;
  }

  const selectedId = getActiveProjectId(searchParams, projectIds, lastCompletedProjectId);

  const targetIds = selectedId ? [selectedId] : projectIds;
  const selectedProject = projectsList.find((p: any) => p.id === selectedId);
  const brand = selectedProject?.target_brand ?? projectsList[0]?.target_brand ?? "";

  const selectedModel = searchParams.model || null;

  // ── Phase 1: active runs in scope (drives both available-models list and source filter) ──
  const { data: allRunsRaw } = targetIds.length > 0
    ? await supabase.from("analysis_runs").select("id, models_used").in("project_id", targetIds).is("deleted_at", null)
    : { data: [] as any[] };
  const allRuns = (allRunsRaw ?? []) as any[];
  const activeRunIds = allRuns.map((r: any) => r.id);

  // Models available for the chip selector = union of every active run's models_used.
  const availableModels = Array.from(
    new Set(allRuns.flatMap((r: any) => (r.models_used as string[] | null) ?? [])),
  );

  // ── Phase 2: sources fetch — model filter applied directly on the row, not via runs ──
  let sourcesList: any[] = [];
  if (activeRunIds.length > 0) {
    let q = supabase
      .from("sources")
      .select("*")
      .in("project_id", targetIds)
      .in("run_id", activeRunIds);
    if (selectedModel) q = q.eq("model", selectedModel);
    const { data: sources } = await q;
    sourcesList = (sources ?? []) as any[];
  }

  // ── Group by domain ──
  const domainMap = new Map<string, SourceDomain>();

  for (const s of sourcesList) {
    const domain = s.domain ?? "sconosciuto";
    const existing = domainMap.get(domain);
    const context = s.context ?? null;
    const sourceType = s.source_type ?? "other";

    if (existing) {
      existing.citations += (s.citation_count ?? 1);
      if (s.is_brand_owned) existing.isBrandOwned = true;
      if (s.source_origin === "ai_consulted") existing.sourceOrigin = "ai_consulted";
      if (s.url && !existing.urls.includes(s.url)) existing.urls.push(s.url);
      if (context && !existing.contexts.includes(context)) existing.contexts.push(context);
    } else {
      domainMap.set(domain, {
        domain,
        sourceType,
        sourceOrigin: s.source_origin === "ai_consulted" ? "ai_consulted" : "text_mention",
        citations: s.citation_count ?? 1,
        analysisCount: 0,
        isBrandOwned: !!s.is_brand_owned,
        contexts: context ? [context] : [],
        urls: s.url ? [s.url] : [],
      });
    }
  }

  // Count analysis per domain via run_id on source rows
  const domainRuns = new Map<string, Set<string>>();
  for (const s of sourcesList) {
    const domain = s.domain ?? "sconosciuto";
    const runId = s.run_id ?? "";
    if (!runId) continue;
    if (!domainRuns.has(domain)) domainRuns.set(domain, new Set());
    domainRuns.get(domain)!.add(runId);
  }
  for (const [domain, runSet] of Array.from(domainRuns.entries())) {
    const d = domainMap.get(domain);
    if (d) d.analysisCount = runSet.size;
  }

  const allDomains = Array.from(domainMap.values()).sort((a, b) => b.citations - a.citations);

  // Compute stats
  const totalCitations = allDomains.reduce((s, d) => s + d.citations, 0);
  const mediaPct = allDomains.length > 0
    ? Math.round((allDomains.filter((d) => d.sourceType === "media").length / allDomains.length) * 100)
    : 0;
  const aiConsultedCount = allDomains.filter((d) => d.sourceOrigin === "ai_consulted").length;
  const brandConsultedPct = aiConsultedCount > 0
    ? Math.round((allDomains.filter((d) => d.sourceOrigin === "ai_consulted" && d.isBrandOwned).length / aiConsultedCount) * 100)
    : 0;

  return (
    <div data-tour="sources-page" className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div />
        <div className="flex items-center gap-3">
          <ProjectSelector projects={projectsList.map((p: any) => ({ id: p.id, name: p.name }))} />
        </div>
      </div>
      <SourcesClient
        domains={allDomains}
        totalCitations={totalCitations}
        mediaPct={mediaPct}
        aiConsultedCount={aiConsultedCount}
        brandConsultedPct={brandConsultedPct}
        brand={brand}
        projectId={selectedId ?? projectIds[0] ?? null}
        availableModels={availableModels}
        selectedModel={selectedModel}
      />
    </div>
  );
}
