import { createServerClient } from "@/lib/supabase/server";
import { Globe, ExternalLink, Shield, Link2 } from "lucide-react";

export const metadata = { title: "Fonti" };

interface DomainInfo {
  domain: string;
  citations: number;
  runsAppeared: Set<string>;
  brandOwned: boolean;
  urls: string[];
}

export default async function SourcesPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", user.id);

  const projectIds = (projects ?? []).map((p: any) => p.id);

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
  const domainMap = new Map<string, DomainInfo>();

  for (const s of (sources ?? []) as any[]) {
    const domain = s.domain ?? "sconosciuto";
    const existing = domainMap.get(domain);
    const runId = promptRunMap.get(s.prompt_executed_id) ?? "";

    if (existing) {
      existing.citations++;
      existing.runsAppeared.add(runId);
      if (s.brand_owned) existing.brandOwned = true;
      if (s.url && !existing.urls.includes(s.url)) existing.urls.push(s.url);
    } else {
      domainMap.set(domain, {
        domain,
        citations: 1,
        runsAppeared: new Set(runId ? [runId] : []),
        brandOwned: !!s.brand_owned,
        urls: s.url ? [s.url] : [],
      });
    }
  }

  const allDomains = Array.from(domainMap.values()).sort((a, b) => b.citations - a.citations);
  const brandDomains = allDomains.filter((d) => d.brandOwned);
  const externalDomains = allDomains.filter((d) => !d.brandOwned);

  function DomainTable({ domains, title, icon: Icon, emptyText }: {
    domains: DomainInfo[];
    title: string;
    icon: any;
    emptyText: string;
  }) {
    if (domains.length === 0) {
      return (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        </div>
      );
    }

    return (
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{title}</h2>
          <span className="badge badge-muted text-[10px]">{domains.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Dominio</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Citazioni</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Analisi</th>
                <th className="text-center py-3 px-4 text-muted-foreground font-medium">Brand Owned</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">URL trovati</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => (
                <tr key={d.domain} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-medium text-foreground">{d.domain}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="font-display font-bold text-foreground">{d.citations}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-muted-foreground">{d.runsAppeared.size}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {d.brandOwned ? (
                      <span className="badge badge-success text-[10px]">Brand Owned</span>
                    ) : (
                      <span className="badge badge-muted text-[10px]">Esterno</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1">
                      {d.urls.slice(0, 3).map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:text-primary/70 transition-colors truncate max-w-[300px]"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{url}</span>
                        </a>
                      ))}
                      {d.urls.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{d.urls.length - 3} altri</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] animate-fade-in">
      <div className="flex items-center gap-3">
        <Globe className="w-6 h-6 text-primary" />
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Fonti</h1>
          <p className="text-sm text-muted-foreground">Da dove le AI citano informazioni</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="font-display font-bold text-2xl text-foreground">{allDomains.length}</p>
          <p className="text-xs text-muted-foreground">Domini unici</p>
        </div>
        <div className="card p-4 text-center">
          <p className="font-display font-bold text-2xl text-foreground">{(sources ?? []).length}</p>
          <p className="text-xs text-muted-foreground">Citazioni totali</p>
        </div>
        <div className="card p-4 text-center">
          <p className="font-display font-bold text-2xl text-primary">{brandDomains.length}</p>
          <p className="text-xs text-muted-foreground">Domini Brand</p>
        </div>
        <div className="card p-4 text-center">
          <p className="font-display font-bold text-2xl text-foreground">{externalDomains.length}</p>
          <p className="text-xs text-muted-foreground">Domini Esterni</p>
        </div>
      </div>

      {/* Brand Owned Sources */}
      <DomainTable
        domains={brandDomains}
        title="Fonti del Brand"
        icon={Shield}
        emptyText="Nessuna fonte brand owned trovata"
      />

      {/* External Sources */}
      <DomainTable
        domains={externalDomains}
        title="Fonti Esterne"
        icon={Link2}
        emptyText="Nessuna fonte esterna trovata"
      />
    </div>
  );
}
