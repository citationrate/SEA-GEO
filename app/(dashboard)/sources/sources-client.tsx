"use client";

import { useState, useEffect } from "react";
import {
  Globe, X, Loader2, ExternalLink, Search,
  Lightbulb, Newspaper, Star, ShoppingCart,
  MessageCircle, BookOpen, HelpCircle, Swords,
  Crown, Lock,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { useUsage } from "@/lib/hooks/useUsage";

/* ─── Types ─── */
interface SourceDomain {
  domain: string;
  sourceType: string;
  citations: number;
  analysisCount: number;
  isBrandOwned: boolean;
  contexts: string[];
  urls: string[];
}

interface DomainAnalysis {
  why_cited: string;
  authority: string;
  brand_impact?: string;
}

interface Insight {
  title: string;
  description: string;
}

/* ─── Type config ─── */
const TYPE_CONFIG: Record<string, { label: string; cls: string; icon: any }> = {
  competitor:  { label: "Competitor",  cls: "bg-destructive/15 text-destructive border-destructive/25", icon: Swords },
  media:       { label: "Media",       cls: "bg-purple-500/15 text-purple-400 border-purple-500/25", icon: Newspaper },
  review:      { label: "review",  cls: "bg-amber-500/15 text-amber-400 border-amber-500/25", icon: Star },
  social:      { label: "Social",      cls: "bg-pink-500/15 text-pink-400 border-pink-500/25", icon: MessageCircle },
  ecommerce:   { label: "E-commerce",  cls: "bg-success/15 text-success border-success/25", icon: ShoppingCart },
  wikipedia:   { label: "Wikipedia",   cls: "bg-blue-500/15 text-blue-400 border-blue-500/25", icon: BookOpen },
  other:       { label: "other",       cls: "bg-muted text-muted-foreground border-border", icon: HelpCircle },
};

const ALL_TYPES = ["competitor", "media", "review", "social", "ecommerce", "wikipedia", "other"];

/* ─── Main Client ─── */
export function SourcesClient({
  domains,
  totalCitations,
  mediaPct,
  brand,
}: {
  domains: SourceDomain[];
  totalCitations: number;
  mediaPct: number;
  brand: string;
}) {
  const { t, locale } = useTranslation();
  const usage = useUsage();
  const [filter, setFilter] = useState<string | null>(null);
  const [drawerDomain, setDrawerDomain] = useState<SourceDomain | null>(null);
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const filtered = filter ? domains.filter((d) => d.sourceType === filter) : domains;

  // Load insights on mount if we have domains
  useEffect(() => {
    if (domains.length === 0 || !brand) return;
    setLoadingInsights(true);
    fetch("/api/sources/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domains: domains.slice(0, 30).map((d) => ({
          domain: d.domain,
          source_type: d.sourceType,
          citations: d.citations,
        })),
        brand,
        lang: locale,
      }),
    })
      .then((r) => r.json())
      .then((data) => setInsights(data.insights ?? []))
      .catch(() => setInsights(null))
      .finally(() => setLoadingInsights(false));
  }, [domains.length, brand]);

  // Type counts for filter badges
  const typeCounts = new Map<string, number>();
  for (const d of domains) {
    typeCounts.set(d.sourceType, (typeCounts.get(d.sourceType) ?? 0) + 1);
  }

  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Globe className="w-6 h-6 text-primary" />
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">{t("sources.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("sources.subtitle")}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={String(domains.length)} label={t("sources.uniqueDomains")} />
        <StatCard value={String(totalCitations)} label={t("sources.totalCitations")} />
        <StatCard value={`${mediaPct}%`} label={t("sources.mediaStatLabel")} />
      </div>

      {/* AI Insights */}
      {(loadingInsights || (insights && insights.length > 0)) && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-primary flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5" /> AI Insights
          </h2>
          {loadingInsights ? (
            <div className="card p-6 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">{t("sources.generatingInsights")}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(insights ?? []).map((ins, i) => (
                <div key={i} className="card p-4 border-primary/20 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-primary shrink-0" />
                    <h3 className="text-sm font-semibold text-foreground">{ins.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{ins.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilter(null)}
          className={`px-3 py-1.5 rounded-[2px] text-xs font-medium border transition-all ${
            filter === null
              ? "border-primary text-primary bg-primary/15"
              : "border-border text-muted-foreground hover:border-foreground/40"
          }`}
        >
          {t("common.all")} ({domains.length})
        </button>
        {ALL_TYPES.map((type) => {
          const count = typeCounts.get(type) ?? 0;
          if (count === 0) return null;
          const cfg = TYPE_CONFIG[type];
          return (
            <button
              key={type}
              onClick={() => setFilter(filter === type ? null : type)}
              className={`px-3 py-1.5 rounded-[2px] text-xs font-medium border transition-all ${
                filter === type
                  ? "border-primary text-primary bg-primary/15"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              }`}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Domain cards */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Globe className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{t("sources.noSourceFound")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((d) => (
            <DomainCard key={d.domain} domain={d} onAnalyze={() => setDrawerDomain(d)} isPro={usage.isPro} isDemo={usage.isDemo} />
          ))}
        </div>
      )}

      {/* Drawer */}
      {drawerDomain && (
        <AnalyzeDrawer
          domain={drawerDomain}
          brand={brand}
          onClose={() => setDrawerDomain(null)}
          isPro={usage.isPro}
          urlAnalysesRemaining={usage.urlAnalysesRemaining}
          urlAnalysesLimit={usage.urlAnalysesLimit}
        />
      )}
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <div className="card p-4 text-center">
      <p className={`font-display font-bold text-2xl ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/* ─── Domain Card ─── */
function DomainCard({ domain: d, onAnalyze, isPro, isDemo }: { domain: SourceDomain; onAnalyze: () => void; isPro: boolean; isDemo: boolean }) {
  const { t } = useTranslation();
  const cfg = TYPE_CONFIG[d.sourceType] ?? TYPE_CONFIG.other;
  const Icon = cfg.icon;

  return (
    <div className="card p-4 space-y-3 hover:border-primary/30 transition-colors">
      {/* Header: favicon + domain + type badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=32`}
            alt=""
            width={20}
            height={20}
            className="rounded shrink-0"
          />
          <h3 className="font-display font-bold text-foreground truncate">{d.domain}</h3>
        </div>
        <span className={`badge border text-[12px] shrink-0 ${cfg.cls}`}>
          <Icon className="w-3 h-3" />
          {cfg.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs">
        <span className="font-display font-bold text-foreground">
          {d.citations} <span className="font-normal text-muted-foreground">{t("sources.citations")}</span>
        </span>
        <span className="text-muted-foreground">
          {d.analysisCount} {t("sources.analyses")}
        </span>
      </div>

      {/* Context preview */}
      {d.contexts.length > 0 && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 font-mono text-[0.75rem] tracking-wide">
          {d.contexts[0]}
        </p>
      )}

      {/* Analyze button (hidden for demo) */}
      {!isDemo && (
        isPro ? (
          <button
            onClick={onAnalyze}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/70 transition-colors"
          >
            <Search className="w-3 h-3" /> {t("sources.analyzeUrl")}
          </button>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-[#c4a882]">
            <Lock className="w-3 h-3" /> {t("sources.analyzeUrl")}
            <span className="inline-flex items-center gap-0.5 font-mono text-[0.625rem] tracking-wide text-[#c4a882] border border-[#c4a882]/30 px-1 py-0.5 rounded-[2px]">
              <Crown className="w-2.5 h-2.5" /> PRO
            </span>
          </span>
        )
      )}
    </div>
  );
}

/* ─── Analyze Drawer ─── */
function AnalyzeDrawer({
  domain: d,
  brand,
  onClose,
  isPro,
  urlAnalysesRemaining,
  urlAnalysesLimit,
}: {
  domain: SourceDomain;
  brand: string;
  onClose: () => void;
  isPro: boolean;
  urlAnalysesRemaining: number;
  urlAnalysesLimit: number;
}) {
  const { t, locale } = useTranslation();
  const [analysis, setAnalysis] = useState<DomainAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cfg = TYPE_CONFIG[d.sourceType] ?? TYPE_CONFIG.other;
  const Icon = cfg.icon;

  function runAnalysis() {
    setLoading(true);
    setError("");
    fetch("/api/sources/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: d.domain,
        contexts: d.contexts,
        citations: d.citations,
        brand,
        lang: locale,
      }),
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => setAnalysis(data))
      .catch(() => setError(t("sources.analysisError")))
      .finally(() => setLoading(false));
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-[#111416] border-l border-[rgba(255,255,255,0.08)] z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.08)] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=32`}
              alt=""
              width={24}
              height={24}
              className="rounded shrink-0"
            />
            <div className="min-w-0">
              <h2 className="font-display font-bold text-lg text-foreground truncate">{d.domain}</h2>
              <span className={`badge border text-[12px] ${cfg.cls}`}>
                <Icon className="w-3 h-3" /> {cfg.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Stats */}
          <div className="flex gap-4">
            <div className="card p-3 flex-1 text-center">
              <p className="font-display font-bold text-lg text-foreground">{d.citations}</p>
              <p className="text-[12px] text-muted-foreground">{t("sources.citationsLabel")}</p>
            </div>
            <div className="card p-3 flex-1 text-center">
              <p className="font-display font-bold text-lg text-foreground">{d.analysisCount}</p>
              <p className="text-[12px] text-muted-foreground">{t("sources.analysesLabel")}</p>
            </div>
          </div>

          {/* URLs */}
          {d.urls.length > 0 && (
            <div>
              <h4 className="font-mono text-[0.69rem] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{t("sources.urlFound")}</h4>
              <div className="space-y-1">
                {d.urls.slice(0, 5).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/70 transition-colors truncate">
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="truncate">{url}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Contexts */}
          {d.contexts.length > 0 && (
            <div>
              <h4 className="font-mono text-[0.69rem] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                {t("sources.citationContexts")} ({d.contexts.length})
              </h4>
              <div className="space-y-2">
                {d.contexts.map((ctx, i) => (
                  <div key={i} className="pl-3 border-l-2 border-primary/30">
                    <p className="font-mono text-[0.75rem] tracking-wide text-muted-foreground leading-relaxed">{ctx}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Analysis */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
              <Lightbulb className="w-3 h-3" /> {t("sources.whatAISay")}
            </h4>

            {!analysis && !loading && isPro && urlAnalysesRemaining > 0 && (
              <div className="space-y-2">
                <button
                  onClick={runAnalysis}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors"
                >
                  <Search className="w-4 h-4" /> {t("sources.analyzeWithAI")}
                </button>
                <p className="text-xs text-muted-foreground text-center">
                  {urlAnalysesRemaining}/{urlAnalysesLimit} {t("sources.analysesRemaining")}
                </p>
              </div>
            )}

            {!analysis && !loading && isPro && urlAnalysesRemaining <= 0 && (
              <div className="card p-4 border-[#c4a882]/20 text-center space-y-1.5">
                <p className="text-sm text-[#c4a882] font-medium">{t("sources.urlLimitReached")}</p>
                <p className="text-xs text-muted-foreground">{t("sources.urlLimitDesc")}</p>
              </div>
            )}

            {!analysis && !loading && !isPro && (
              <div className="card p-4 border-[#c4a882]/20 text-center space-y-1.5">
                <div className="flex items-center justify-center gap-1.5">
                  <Crown className="w-4 h-4 text-[#c4a882]" />
                  <p className="text-sm text-[#c4a882] font-medium">{t("sources.proRequiredUrl")}</p>
                </div>
                <p className="text-xs text-muted-foreground">{t("sources.proRequiredUrlDesc")}</p>
                <a href="/settings" className="inline-block text-xs font-semibold text-[#c4a882] hover:text-[#c4a882]/80 transition-colors mt-1">{t("settings.upgradePro")} &rarr;</a>
              </div>
            )}

            {loading && (
              <div className="card p-6 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">{t("sources.analysisInProgress")}</span>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {analysis && (
              <div className="space-y-3">
                <AnalysisBlock title={t("sources.whyCited")} text={analysis.why_cited} />
                <AnalysisBlock title={t("sources.sectorAuthority")} text={analysis.authority} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function AnalysisBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="card p-3 space-y-1">
      <h5 className="text-xs font-semibold text-foreground">{title}</h5>
      <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}
