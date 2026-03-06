import { createServerClient } from "@/lib/supabase/server";
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

export default async function SourcesPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, target_brand")
    .eq("user_id", user.id);

  const projectIds = (projects ?? []).map((p: any) => p.id);
  const brand = ((projects ?? []) as any[])[0]?.target_brand ?? "";

  // Get runs → prompts → sources
  const { data: runs } = projectIds.length > 0
    ? await supabase.from("analysis_runs").select("id, project_id").in("project_id", projectIds)
    : { data: [] };

  const runIds = (runs ?? []).map((r: any) => r.id);

  const { data: prompts } = runIds.length > 0
    ? await supabase.from("prompts_executed").select("id, run_id").in("run_id", runIds)
    : { data: [] };

  const promptRunMap = new Map((prompts ?? []).map((p: any) => [p.id, p.run_id]));
  const promptIds = (prompts ?? []).map((p: any) => p.id);

  const { data: sources } = promptIds.length > 0
    ? await supabase
        .from("sources")
        .select("*")
        .in("prompt_executed_id", promptIds)
    : { data: [] };

  // Group by domain
  const domainMap = new Map<string, SourceDomain>();

  for (const s of (sources ?? []) as any[]) {
    const domain = s.domain ?? "sconosciuto";
    const existing = domainMap.get(domain);
    const runId = promptRunMap.get(s.prompt_executed_id) ?? "";
    const context = s.context ?? null;
    const sourceType = s.source_type ?? "other";

    if (existing) {
      existing.citations += (s.citation_count ?? 1);
      if (runId && !existing.urls.includes(runId)) {
        // Use a set-like approach for analysis count
      }
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

  // Count analysis per domain via run tracking
  const domainRuns = new Map<string, Set<string>>();
  for (const s of (sources ?? []) as any[]) {
    const domain = s.domain ?? "sconosciuto";
    const runId = promptRunMap.get(s.prompt_executed_id) ?? "";
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
    <SourcesClient
      domains={allDomains}
      totalCitations={totalCitations}
      brandOwnedPct={brandOwnedPct}
      mediaPct={mediaPct}
      brand={brand}
    />
  );
}
