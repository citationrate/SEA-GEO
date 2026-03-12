import { createServerClient } from "@/lib/supabase/server";
import { ProjectSelector } from "@/components/project-selector";

import { resolveProjectId } from "@/lib/utils/resolve-project";
import { SourcesClient } from "./sources-client";

export const metadata = { title: "Fonti" };

export interface SourceDomain {
  domain: string;
  sourceType: string;
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
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, target_brand")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const projectsList = (projects ?? []) as any[];
  const projectIds = projectsList.map((p: any) => p.id);
  const selectedId = resolveProjectId(searchParams, projectIds);

  const targetIds = selectedId ? [selectedId] : projectIds;
  const selectedProject = projectsList.find((p: any) => p.id === selectedId);
  const brand = selectedProject?.target_brand ?? projectsList[0]?.target_brand ?? "";

  // Get runs to extract available models + filter (exclude archived)
  const { data: allRuns } = targetIds.length > 0
    ? await supabase.from("analysis_runs").select("id, models_used").in("project_id", targetIds).is("deleted_at", null)
    : { data: [] };


  const selectedModel = searchParams.model || null;

  // Filter runs by model at DB level if selected
  let filteredRunIds: string[];
  if (selectedModel && targetIds.length > 0) {
    const { data: filtered } = await supabase
      .from("analysis_runs")
      .select("id")
      .in("project_id", targetIds)
      .is("deleted_at", null)
      .contains("models_used", [selectedModel]);
    filteredRunIds = (filtered ?? []).map((r: any) => r.id);
  } else {
    filteredRunIds = (allRuns ?? []).map((r: any) => r.id);
  }

  // Get sources filtered by active run IDs only
  const activeRunIds = (allRuns ?? []).map((r: any) => r.id);
  let sourcesList: any[] = [];
  if (filteredRunIds.length > 0) {
    const { data: sources } = await supabase
      .from("sources")
      .select("*")
      .in("project_id", targetIds)
      .in("run_id", filteredRunIds);
    sourcesList = (sources ?? []) as any[];
  } else if (!selectedModel && activeRunIds.length > 0) {
    // No model filter — show sources from active runs only
    const { data: sources } = await supabase
      .from("sources")
      .select("*")
      .in("project_id", targetIds)
      .in("run_id", activeRunIds);
    sourcesList = (sources ?? []) as any[];
  }

  // Group by domain
  const domainMap = new Map<string, SourceDomain>();

  for (const s of sourcesList) {
    const domain = s.domain ?? "sconosciuto";
    const existing = domainMap.get(domain);
    const context = s.context ?? null;
    const sourceType = s.source_type ?? "other";

    if (existing) {
      existing.citations += (s.citation_count ?? 1);
      if (s.is_brand_owned) existing.isBrandOwned = true;
      if (s.url && !existing.urls.includes(s.url)) existing.urls.push(s.url);
      if (context && !existing.contexts.includes(context)) existing.contexts.push(context);
    } else {
      domainMap.set(domain, {
        domain,
        sourceType,
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
  const brandOwnedPct = allDomains.length > 0
    ? Math.round((allDomains.filter((d) => d.isBrandOwned).length / allDomains.length) * 100)
    : 0;
  const mediaPct = allDomains.length > 0
    ? Math.round((allDomains.filter((d) => d.sourceType === "media").length / allDomains.length) * 100)
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
        brandOwnedPct={brandOwnedPct}
        mediaPct={mediaPct}
        brand={brand}
      />
    </div>
  );
}
