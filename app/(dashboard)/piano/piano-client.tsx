"use client";

import { useState, useEffect } from "react";
import {
  CreditCard, Search, Globe, GitCompare, Link2, MessageSquareText,
  Check, X, Loader2, Zap, Crown, AlertTriangle, Sparkles, Wallet,
  Receipt, FileDown, Settings2, Download, Coins, CheckCircle2, AlertCircle,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { useUsage } from "@/lib/hooks/useUsage";
import { useConsultation } from "@/lib/consultation-context";
import ScrollToAcceptModal from "@/components/scroll-to-accept-modal";
import SaleTermsText from "@/components/sale-terms-text";

interface PianoClientProps {
  plan: string;
  subscriptionStatus: string;
  subscriptionPeriod: string | null;
  hasActiveSubscription: boolean;
  browsingUsed: number;
  noBrowsingUsed: number;
  comparisonsUsed: number;
  extraBrowsing: number;
  extraNoBrowsing: number;
  extraComparisons: number;
}

/* ─── Constants ─── */

const LIMITS: Record<string, { totalPrompts: number; browsing: number; comparisons: number; urlAnalyses: number; contextAnalyses: number }> = {
  demo:   { totalPrompts: 40, browsing: 0, comparisons: 0, urlAnalyses: 0, contextAnalyses: 0 },
  base:   { totalPrompts: 100, browsing: 30, comparisons: 0, urlAnalyses: 0, contextAnalyses: 0 },
  pro:    { totalPrompts: 300, browsing: 90, comparisons: 10, urlAnalyses: 50, contextAnalyses: 5 },
};

const PLAN_META: Record<string, { label: string; color: string }> = {
  demo: { label: "Demo", color: "var(--muted-foreground)" },
  base: { label: "Base", color: "#60a5fa" },
  pro:  { label: "Pro", color: "#c4a882" },
  enterprise: { label: "Enterprise", color: "#a78bfa" },
};

type FeatureValue = boolean | string;
interface PlanFeature {
  label: string;
  demo: FeatureValue;
  base: FeatureValue;
  pro: FeatureValue;
  enterprise: FeatureValue;
}

function getAviFeatures(t: (k: string) => string): PlanFeature[] {
  return [
    { label: t("piano.promptsMonth"),           demo: "40",                          base: "100",                       pro: "300",                        enterprise: t("piano.unlimited") },
    { label: t("piano.realtimeBrowsing"),       demo: false,                         base: `30 ${t("piano.prompt")}`,   pro: `90 ${t("piano.prompt")}`,    enterprise: t("piano.unlimitedM") },
    { label: t("piano.aiModels"),               demo: `2 ${t("piano.fixed")}`,       base: `6 ${t("piano.selectable")}`, pro: t("piano.allPlusPro"),       enterprise: t("piano.allPlusPro") },
    { label: t("piano.maxModelsProject"),       demo: "2",                           base: "3",                         pro: "5",                          enterprise: "10" },
    { label: t("piano.aiQueryGen"),             demo: true,                          base: true,                        pro: true,                         enterprise: true },
    { label: t("piano.competitiveComparisons"), demo: false,                         base: false,                       pro: `10${t("piano.perMonth")}`,   enterprise: t("piano.unlimited") },
    { label: t("piano.urlAnalyses"),            demo: false,                         base: false,                       pro: `50${t("piano.perMonth")}`,   enterprise: t("piano.unlimitedFem") },
    { label: t("piano.aiContextAnalyses"),      demo: false,                         base: false,                       pro: `5${t("piano.perMonth")}`,    enterprise: `20${t("piano.perMonth")}` },
  ];
}

function getCsFeatures(t: (k: string) => string): PlanFeature[] {
  return [
    { label: t("piano.csAudits"),             demo: "1",                             base: `10${t("piano.perMonth")}`,  pro: `50${t("piano.perMonth")}`,   enterprise: t("piano.unlimited") },
    { label: t("piano.csMaxUrls"),            demo: "1",                             base: "3",                         pro: "5",                          enterprise: t("piano.unlimited") },
    { label: t("piano.csScorePerAi"),         demo: t("piano.csScorePerAi7"),        base: true,                        pro: true,                         enterprise: true },
    { label: t("piano.csInsights"),           demo: false,                           base: "10",                        pro: t("piano.csInsightsAll"),     enterprise: t("piano.csInsightsAll") },
    { label: t("piano.csCompetitor"),         demo: false,                           base: true,                        pro: true,                         enterprise: true },
    { label: t("piano.csPdf"),                demo: false,                           base: t("piano.csPdfLimited"),     pro: t("piano.csPdfComplete"),     enterprise: t("piano.csPdfComplete") },
    { label: t("piano.csInsightsPerAi"),      demo: false,                           base: false,                       pro: true,                         enterprise: true },
    { label: t("piano.csWhatIf"),             demo: false,                           base: false,                       pro: true,                         enterprise: true },
    { label: t("piano.csDedicatedConsulting"),demo: false,                           base: false,                       pro: false,                        enterprise: true },
  ];
}

const BASE_PACKAGES = [
  { label: "100 Query Extra", desc: "+100 prompt per le tue analisi", price: 19, priceEnv: "STRIPE_PRICE_QUERIES_BASE_100", note: null, type: "query" as const },
  { label: "300 Query Extra", desc: "+300 prompt per le tue analisi", price: 49, priceEnv: "STRIPE_PRICE_QUERIES_BASE_300", note: "Max 1/mese", type: "query" as const },
];

const PRO_PACKAGES = [
  { label: "100 Query Extra", desc: "+100 prompt (browsing incluso)", price: 29, priceEnv: "STRIPE_PRICE_QUERIES_PRO_100", note: null, type: "query" as const },
  { label: "300 Query Extra", desc: "+300 prompt (browsing incluso)", price: 89, priceEnv: "STRIPE_PRICE_QUERIES_PRO_300", note: null, type: "query" as const },
  { label: "3 Confronti Extra", desc: "+3 analisi competitive", price: 15, priceEnv: "STRIPE_PRICE_CONFRONTI_3", note: null, type: "compare" as const },
  { label: "5 Confronti Extra", desc: "+5 analisi competitive", price: 19, priceEnv: "STRIPE_PRICE_CONFRONTI_5", note: null, type: "compare" as const },
  { label: "10 Confronti Extra", desc: "+10 analisi competitive", price: 25, priceEnv: "STRIPE_PRICE_CONFRONTI_10", note: null, type: "compare" as const },
];

/* ─── Helpers ─── */

function barColor(used: number, max: number) {
  if (max === 0) return "#6b7280";
  const pct = used / max;
  if (pct > 0.9) return "#ef4444";
  if (pct > 0.7) return "#f59e0b";
  return "#10b981";
}

/* ─── Component ─── */

export function PianoClient({
  plan, subscriptionStatus, subscriptionPeriod, hasActiveSubscription,
  browsingUsed, noBrowsingUsed, comparisonsUsed,
  extraBrowsing, extraNoBrowsing, extraComparisons,
}: PianoClientProps) {
  const [annual, setAnnual] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [showSaleTerms, setShowSaleTerms] = useState(false);
  const [pendingPriceEnv, setPendingPriceEnv] = useState<string | null>(null);
  const { t } = useTranslation();
  const { openModal: openConsultation } = useConsultation();

  const usage = useUsage();

  const limits = LIMITS[plan] || LIMITS.demo;
  const planMeta = PLAN_META[plan] || PLAN_META.demo;
  const isActive = subscriptionStatus === "active";
  const isDemo = plan === "demo";
  const isBase = plan === "base";
  const isPro = plan === "pro";
  const isEnterprise = plan === "enterprise";

  const liveBrowsingUsed = usage.loading ? browsingUsed : usage.browsingPromptsUsed;
  const liveNoBrowsingUsed = usage.loading ? noBrowsingUsed : usage.noBrowsingPromptsUsed;
  const liveComparisonsUsed = usage.loading ? comparisonsUsed : usage.comparisonsUsed;
  const liveExtraBrowsing = usage.loading ? extraBrowsing : usage.extraBrowsingPrompts;
  const liveExtraNoBrowsing = usage.loading ? extraNoBrowsing : usage.extraNoBrowsingPrompts;
  const liveExtraComparisons = usage.loading ? extraComparisons : usage.extraComparisons;
  const liveUrlAnalysesUsed = usage.loading ? 0 : usage.urlAnalysesUsed;
  const liveContextAnalysesUsed = usage.loading ? 0 : usage.contextAnalysesUsed;

  const totalUsed = liveBrowsingUsed + liveNoBrowsingUsed;
  const totalLimit = limits.totalPrompts + liveExtraBrowsing + liveExtraNoBrowsing;
  const browsingLimit = limits.browsing + liveExtraBrowsing;
  const comparisonsLimit = limits.comparisons + liveExtraComparisons;
  const packages = isBase ? BASE_PACKAGES : isPro ? PRO_PACKAGES : [];

  function handleSubscribe(priceEnv: string) {
    setPendingPriceEnv(priceEnv);
    setShowSaleTerms(true);
  }

  async function proceedToCheckout() {
    const priceEnv = pendingPriceEnv;
    if (!priceEnv) return;
    setShowSaleTerms(false);
    setSubscribing(priceEnv);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: priceEnv, mode: "subscription" }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || "Errore");
    } catch { alert("Errore di rete"); }
    finally { setSubscribing(null); setPendingPriceEnv(null); }
  }

  async function handleBuyPackage(priceEnv: string) {
    setPurchasingId(priceEnv);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: priceEnv, mode: "payment", quantity: 1 }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || "Errore");
    } catch { alert("Errore di rete"); }
    finally { setPurchasingId(null); }
  }

  async function handleCancel() {
    setCanceling(true);
    try {
      const res = await fetch("/api/stripe/cancel-subscription", { method: "POST" });
      const data = await res.json();
      if (data.ok) { alert(t("analysisLauncher.subscriptionCancelled")); window.location.reload(); }
      else alert(data.error || "Errore");
    } catch { alert("Errore di rete"); }
    finally { setCanceling(false); setShowCancelModal(false); }
  }

  const aviFeatures = getAviFeatures(t);
  const csFeatures = getCsFeatures(t);

  type PianoTab = "uso" | "piani" | "fatture";
  const [activeTab, setActiveTab] = useState<PianoTab>("uso");

  // Read tab from URL hash
  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash.replace("#", "") as PianoTab;
      if (["uso", "piani", "fatture"].includes(hash)) setActiveTab(hash);
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1" style={{ borderBottom: "1px solid var(--border)" }}>
        {([
          { key: "uso" as PianoTab, label: t("piano.usage") || "Uso" },
          { key: "piani" as PianoTab, label: t("piano.plansAndPackages") || "Piani e Pacchetti" },
          { key: "fatture" as PianoTab, label: t("piano.payments") || "Pagamenti" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); window.location.hash = tab.key; }}
            className="font-mono text-xs uppercase tracking-wider px-4 py-2.5 whitespace-nowrap transition-all"
            style={{
              color: activeTab === tab.key ? "var(--primary)" : "var(--muted-foreground)",
              borderBottom: activeTab === tab.key ? "2px solid var(--primary)" : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════ TAB: USO ══════════════ */}
      {activeTab === "uso" && (
        <div className="space-y-6 animate-fade-in">
          {/* Current plan banner */}
          <section className="rounded-[4px] border border-border overflow-hidden" style={{ background: "var(--surface)" }}>
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(122,184,154,0.12)" }}>
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("piano.activePlan")}</p>
                  <p className="font-display text-xl font-bold" style={{ color: planMeta.color }}>{planMeta.label}</p>
                </div>
              </div>
              {!isDemo && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t("piano.status")}</p>
                  <p className="text-sm font-semibold text-foreground capitalize">{subscriptionStatus}</p>
                </div>
              )}
            </div>
          </section>

          {/* Usage bars */}
          <section className="rounded-[4px] border border-border overflow-hidden" style={{ background: "var(--surface)" }}>
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(122,184,154,0.12)" }}>
                <Search className="w-4 h-4 text-primary" />
              </div>
              <h2 className="font-display font-semibold text-sm text-foreground">{t("piano.yourUsage")}</h2>
            </div>
            <div className="p-5 space-y-5">
              <UsageBar label={t("piano.promptsUsed")} used={totalUsed} max={totalLimit} extra={liveExtraBrowsing + liveExtraNoBrowsing > 0 ? `+${liveExtraBrowsing + liveExtraNoBrowsing} extra` : undefined} />
              {!isDemo && <UsageBar label={t("piano.withBrowsing")} used={liveBrowsingUsed} max={browsingLimit} extra={liveExtraBrowsing > 0 ? `+${liveExtraBrowsing} extra` : undefined} />}
              {isPro && (
                <>
                  <UsageBar label={t("piano.comparisons")} used={liveComparisonsUsed} max={comparisonsLimit} extra={liveExtraComparisons > 0 ? `+${liveExtraComparisons} extra` : undefined} />
                  <UsageBar label={t("piano.urlAnalysis")} used={liveUrlAnalysesUsed} max={50} />
                  <UsageBar label={t("piano.contextAnalysis")} used={liveContextAnalysesUsed} max={5} />
                </>
              )}
              {isDemo && (
                <div className="rounded-[4px] border border-dashed border-[#c4a882]/30 p-4 flex items-center gap-3" style={{ background: "rgba(196,168,130,0.03)" }}>
                  <Sparkles className="w-5 h-5 text-[#c4a882] shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t("piano.unlockMore")}</p>
                    <button onClick={() => { setActiveTab("piani"); window.location.hash = "piani"; }} className="text-xs font-semibold text-[#c4a882] hover:text-[#c4a882]/80 transition-colors">{t("piano.viewPlans")} &rarr;</button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Query Wallet */}
          {(usage.wallet.browsingQueries > 0 || usage.wallet.noBrowsingQueries > 0 || usage.wallet.confronti > 0) && (
            <section className="rounded-[4px] border border-border overflow-hidden" style={{ background: "var(--surface)" }}>
              <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(196,168,130,0.12)" }}>
                  <Wallet className="w-4 h-4 text-[#c4a882]" />
                </div>
                <div>
                  <h2 className="font-display font-semibold text-sm text-foreground">{t("piano.walletTitle")}</h2>
                  <p className="text-xs text-muted-foreground">{t("piano.walletNeverExpires")}</p>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {usage.wallet.browsingQueries > 0 && (
                    <div className="rounded-[4px] border border-[#c4a882]/30 p-4 space-y-1" style={{ background: "rgba(196,168,130,0.04)" }}>
                      <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-[#c4a882]" /><span className="text-sm font-medium text-foreground">{t("piano.walletBrowsing")}</span></div>
                      <p className="text-2xl font-display font-bold text-[#c4a882]">{usage.wallet.browsingQueries}</p>
                      <p className="text-xs text-muted-foreground">{t("piano.walletQueryAvailable")}</p>
                    </div>
                  )}
                  {usage.wallet.noBrowsingQueries > 0 && (
                    <div className="rounded-[4px] border border-[#c4a882]/30 p-4 space-y-1" style={{ background: "rgba(196,168,130,0.04)" }}>
                      <div className="flex items-center gap-2"><Search className="w-4 h-4 text-[#c4a882]" /><span className="text-sm font-medium text-foreground">{t("piano.walletNoBrowsing")}</span></div>
                      <p className="text-2xl font-display font-bold text-[#c4a882]">{usage.wallet.noBrowsingQueries}</p>
                      <p className="text-xs text-muted-foreground">{t("piano.walletQueryAvailable")}</p>
                    </div>
                  )}
                  {usage.wallet.confronti > 0 && (
                    <div className="rounded-[4px] border border-[#c4a882]/30 p-4 space-y-1" style={{ background: "rgba(196,168,130,0.04)" }}>
                      <div className="flex items-center gap-2"><GitCompare className="w-4 h-4 text-[#c4a882]" /><span className="text-sm font-medium text-foreground">{t("piano.walletConfronti")}</span></div>
                      <p className="text-2xl font-display font-bold text-[#c4a882]">{usage.wallet.confronti}</p>
                      <p className="text-xs text-muted-foreground">{t("piano.walletAvailable")}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

        </div>
      )}

      {/* ══════════════ TAB: PIANI ══════════════ */}
      {activeTab === "piani" && (
        <div className="space-y-6 animate-fade-in">
          <section className="rounded-[4px] border border-border overflow-hidden" style={{ background: "var(--surface)" }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[4px] border border-border" style={{ background: "var(--background)" }}>
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">{planMeta.label} {t("piano.active")}</span>
              </div>
              <div className="flex items-center rounded-[4px] p-0.5" style={{ background: "var(--background)" }}>
                <button onClick={() => setAnnual(false)} className="text-xs font-medium px-3 py-1.5 rounded-[3px] transition-all" style={{ background: !annual ? "var(--primary)" : "transparent", color: !annual ? "white" : "var(--muted-foreground)" }}>{t("piano.monthly")}</button>
                <button onClick={() => setAnnual(true)} className="text-xs font-medium px-3 py-1.5 rounded-[3px] transition-all" style={{ background: annual ? "var(--primary)" : "transparent", color: annual ? "white" : "var(--muted-foreground)" }}>{t("piano.annual")}</button>
              </div>
            </div>
            <div className="p-5 overflow-x-auto">
              {(() => {
                const PLAN_COLORS = { demo: "var(--muted-foreground)", base: "#3b82f6", pro: "#c4a882", enterprise: "#a78bfa" } as const;
                const ROW_GRID = "minmax(200px,1.6fr) repeat(4, minmax(120px, 1fr))";

                const renderVal = (v: FeatureValue, accent: string) =>
                  v === false
                    ? <X className="w-4 h-4 mx-auto text-muted-foreground/40" />
                    : v === true
                      ? <Check className="w-4 h-4 mx-auto" style={{ color: accent }} />
                      : <span className="text-sm text-foreground">{v}</span>;

                const headerCell = (planKey: "demo" | "base" | "pro" | "enterprise", label: string, price: React.ReactNode, subPrice: string | null, cta: React.ReactNode, active: boolean, recommended?: boolean) => (
                  <div className="flex flex-col items-center text-center p-4 relative" style={{ background: active ? `${PLAN_COLORS[planKey]}11` : "transparent", borderLeft: "1px solid var(--border)" }}>
                    {recommended && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 text-[10px] font-semibold rounded-full whitespace-nowrap" style={{ background: PLAN_COLORS[planKey], color: "#1a1a1a" }}>
                        {t("piano.recommended")}
                      </div>
                    )}
                    <p className="font-display text-base font-semibold text-foreground mb-1">{label}</p>
                    <div className="font-display text-xl font-bold text-foreground min-h-[2em] flex items-baseline">{price}</div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 min-h-[1.25em]">{subPrice || ""}</p>
                    <div className="mt-3 w-full">{cta}</div>
                  </div>
                );

                const featureRow = (label: string, demo: FeatureValue, base: FeatureValue, pro: FeatureValue, enterprise: FeatureValue) => (
                  <div className="grid items-center" style={{ gridTemplateColumns: ROW_GRID, borderTop: "1px solid var(--border)" }} key={label}>
                    <div className="px-4 py-3 text-sm text-foreground">{label}</div>
                    <div className="px-3 py-3 text-center" style={{ borderLeft: "1px solid var(--border)", background: isDemo ? `${PLAN_COLORS.demo}0A` : "transparent" }}>{renderVal(demo, PLAN_COLORS.demo)}</div>
                    <div className="px-3 py-3 text-center" style={{ borderLeft: "1px solid var(--border)", background: isBase ? `${PLAN_COLORS.base}14` : "transparent" }}>{renderVal(base, PLAN_COLORS.base)}</div>
                    <div className="px-3 py-3 text-center" style={{ borderLeft: "1px solid var(--border)", background: isPro ? `${PLAN_COLORS.pro}14` : "transparent" }}>{renderVal(pro, PLAN_COLORS.pro)}</div>
                    <div className="px-3 py-3 text-center" style={{ borderLeft: "1px solid var(--border)", background: isEnterprise ? `${PLAN_COLORS.enterprise}14` : "transparent" }}>{renderVal(enterprise, PLAN_COLORS.enterprise)}</div>
                  </div>
                );

                const sectionHeader = (title: string, accentColor: string) => (
                  <div className="grid" style={{ gridTemplateColumns: ROW_GRID, borderTop: "1px solid var(--border)" }}>
                    <div className="col-span-full px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: accentColor, background: `${accentColor}08`, gridColumn: "1 / -1" }}>
                      {title}
                    </div>
                  </div>
                );

                return (
                  <div className="min-w-[880px]" style={{ paddingTop: 14 }}>
                    {/* Header row */}
                    <div className="grid" style={{ gridTemplateColumns: ROW_GRID }}>
                      <div className="p-4" />
                      {headerCell("demo", "Demo", <span>{t("piano.free")}</span>, "40 prompt", isDemo ? <p className="text-xs font-medium" style={{ color: PLAN_COLORS.demo }}>{t("piano.activePlan")}</p> : <div className="h-[38px]" />, isDemo)}
                      {headerCell("base", "Base", <><span>€{annual ? "649" : "59"}</span><span className="text-xs font-normal text-muted-foreground">{annual ? t("piano.perYear") : t("piano.perMonth")}</span></>, annual ? `€54,08${t("piano.perMonth")} · ${t("piano.save")} €59` : t("piano.plusVat"), isBase ? <p className="text-xs font-medium" style={{ color: PLAN_COLORS.base }}>{t("piano.activePlan")}</p> : isDemo ? (
                        <button onClick={() => handleSubscribe(annual ? "STRIPE_PRICE_BASE_YEARLY" : "STRIPE_PRICE_BASE_MONTHLY")} disabled={!!subscribing} className="w-full py-2 text-xs font-semibold rounded-[2px] transition-all disabled:opacity-50" style={{ background: PLAN_COLORS.base, color: "#fff" }}>{subscribing?.includes("BASE") ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : t("piano.subscribe")}</button>
                      ) : <div className="h-[34px]" />, isBase)}
                      {headerCell("pro", "Pro", <><span>€{annual ? "1.719" : "159"}</span><span className="text-xs font-normal text-muted-foreground">{annual ? t("piano.perYear") : t("piano.perMonth")}</span></>, annual ? `€143,25${t("piano.perMonth")} · ${t("piano.save")} €189` : t("piano.plusVat"), isPro ? <p className="text-xs font-medium" style={{ color: PLAN_COLORS.pro }}>{t("piano.activePlan")}</p> : (
                        <button onClick={() => handleSubscribe(annual ? "STRIPE_PRICE_PRO_YEARLY" : "STRIPE_PRICE_PRO_MONTHLY")} disabled={!!subscribing} className="w-full py-2 text-xs font-semibold rounded-[2px] transition-all disabled:opacity-50" style={{ background: PLAN_COLORS.pro, color: "#1a1a1a" }}>{subscribing?.includes("PRO") ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : t("piano.subscribe")}</button>
                      ), isPro, true)}
                      {headerCell("enterprise", t("piano.enterprise"), <span>{t("piano.enterpriseCustom")}</span>, t("piano.enterpriseDesc"), isEnterprise ? <p className="text-xs font-medium" style={{ color: PLAN_COLORS.enterprise }}>{t("piano.activePlan")}</p> : (
                        <button onClick={openConsultation} className="w-full py-2 text-xs font-semibold rounded-[2px] transition-all" style={{ border: `1px solid ${PLAN_COLORS.enterprise}`, color: PLAN_COLORS.enterprise, background: "transparent" }}>{t("piano.contactUs")}</button>
                      ), isEnterprise)}
                    </div>

                    {/* AI VISIBILITY INDEX section */}
                    {sectionHeader(t("piano.aviHeader"), "var(--primary)")}
                    {aviFeatures.map((f) => featureRow(f.label, f.demo, f.base, f.pro, f.enterprise))}

                    {/* CITABILITY SCORE section */}
                    {sectionHeader(t("piano.csHeader"), "#c4a882")}
                    {csFeatures.map((f) => featureRow(f.label, f.demo, f.base, f.pro, f.enterprise))}
                  </div>
                );
              })()}
            </div>
          </section>

          {/* Extra packages */}
          {packages.length > 0 && (
            <section className="rounded-[4px] border border-border overflow-hidden" style={{ background: "var(--surface)" }}>
              <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(122,184,154,0.12)" }}>
                  <Download className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-display font-semibold text-sm text-foreground">{t("piano.extraPackages")}</h2>
                  <p className="text-xs text-muted-foreground">{t("piano.extraPackagesDesc")}</p>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {packages.map((pkg) => (
                    <div key={pkg.priceEnv} className="p-4 flex flex-col rounded-[2px]" style={{ border: "1px solid var(--border)" }}>
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-8 h-8 rounded-[3px] flex items-center justify-center" style={{ background: pkg.type === "query" ? "rgba(59,130,246,0.12)" : "rgba(196,168,130,0.12)" }}>
                          {pkg.type === "query" ? <Zap className="w-4 h-4 text-[#3b82f6]" /> : <GitCompare className="w-4 h-4 text-[#c4a882]" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{pkg.label}</p>
                          <p className="text-xs text-muted-foreground">{pkg.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-display text-lg font-bold text-foreground">€{pkg.price} <span className="text-xs font-normal text-muted-foreground">{t("piano.plusVat")}</span></p>
                        {pkg.note && <span className="font-mono text-[0.6rem] tracking-wider uppercase text-muted-foreground">{pkg.note}</span>}
                      </div>
                      <button onClick={() => handleBuyPackage(pkg.priceEnv)} disabled={purchasingId !== null} className="w-full py-2 text-sm font-medium rounded-[2px] transition-all disabled:opacity-50" style={{ background: "var(--primary)", color: "white" }}>
                        {purchasingId === pkg.priceEnv ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t("piano.buy")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

        </div>
      )}

      {/* ══════════════ TAB: PAGAMENTI E FATTURE ══════════════ */}
      {activeTab === "fatture" && (
        <div className="space-y-6 animate-fade-in">
          {/* Subscription management */}
          {!isDemo && (
            <section className="rounded-[4px] border border-border overflow-hidden" style={{ background: "var(--surface)" }}>
              <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(196,168,130,0.12)" }}>
                  <CreditCard className="w-4 h-4 text-[#c4a882]" />
                </div>
                <h2 className="font-display font-semibold text-sm text-foreground">{t("piano.subscriptionTitle")}</h2>
              </div>
              <div className="p-5 space-y-5">
                {/* Plan details grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("piano.activePlan")}</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{planMeta.label}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("piano.status")}</p>
                    <p className="text-sm font-semibold text-foreground mt-1 capitalize">{subscriptionStatus}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("piano.period")}</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{subscriptionPeriod === "yearly" ? t("piano.annual") : t("piano.monthly")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("piano.amount")}</p>
                    <p className="text-sm font-semibold text-foreground mt-1">
                      {plan === "base" ? (subscriptionPeriod === "yearly" ? "€649" : "€59") : plan === "pro" ? (subscriptionPeriod === "yearly" ? "€1.719" : "€159") : "—"}{subscriptionPeriod === "yearly" ? t("piano.perYear") : t("piano.perMonth")} {t("piano.plusVat")}
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <PortalButton />
                  <button onClick={() => setShowCancelModal(true)} className="px-4 py-2 rounded-[3px] border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors">
                    {t("piano.cancelSubscription")}
                  </button>
                </div>
              </div>
            </section>
          )}
          {/* <InvoiceHistory /> — temporarily hidden, invoices are issued manually */}
        </div>
      )}

      {/* Sale terms modal */}
      <ScrollToAcceptModal
        open={showSaleTerms}
        onAccept={proceedToCheckout}
        onClose={() => { setShowSaleTerms(false); setPendingPriceEnv(null); }}
      >
        <SaleTermsText />
      </ScrollToAcceptModal>

      {/* Cancel modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCancelModal(false)}>
          <div className="bg-ink border border-destructive/30 rounded-[4px] p-6 w-[420px] space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <h3 className="text-lg font-semibold text-foreground">{t("piano.cancelSubscription")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{t("piano.cancelModalDesc")}</p>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowCancelModal(false)} className="text-sm px-4 py-2 rounded-[3px] border border-border text-muted-foreground hover:text-foreground transition-colors">{t("piano.back")}</button>
              <button onClick={handleCancel} disabled={canceling} className="text-sm px-4 py-2 rounded-[3px] bg-destructive text-white hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-2">
                {canceling && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("piano.cancelConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════ */

function UsageBar({ label, used, max, extra }: { label: string; used: number; max: number; extra?: string }) {
  const pct = max > 0 ? (used / max) * 100 : 0;
  const color = barColor(used, max);
  const exhausted = max > 0 && used >= max;
  const almostOut = max > 0 && pct > 70 && !exhausted;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm font-mono">
          <span style={{ color: exhausted ? "#ef4444" : almostOut ? "#f59e0b" : "var(--foreground)", fontWeight: (exhausted || almostOut) ? 700 : 400 }}>{used}</span>
          <span className="text-muted-foreground"> / {max}</span>
          {extra && <span className="text-xs ml-1.5" style={{ color }}>({extra})</span>}
        </p>
      </div>
      <div className="w-full h-2.5 rounded-full" style={{ background: `${color}15` }}>
        <div
          className="h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, pct)}%`, background: color, minWidth: used > 0 && max > 0 ? "6px" : undefined }}
        />
      </div>
      {exhausted && (
        <p className="flex items-center gap-1.5 text-xs mt-1.5" style={{ color: "#ef4444" }}>
          <AlertCircle className="w-3 h-3" /> Limite raggiunto
        </p>
      )}
    </div>
  );
}

function PortalButton() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || "Errore");
    } catch { alert("Errore di rete"); }
    finally { setLoading(false); }
  }

  return (
    <button
      onClick={openPortal}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-[3px] border border-primary/40 text-primary text-sm font-semibold hover:bg-primary hover:text-white transition-all disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
      {t("piano.managePayment")}
    </button>
  );
}

function InvoiceHistory() {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<{ id: string; date: string | null; amount: number; currency: string; status: string; pdf_url: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stripe/invoices")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setInvoices(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="rounded-[4px] border border-border overflow-hidden" style={{ background: "var(--surface)" }}>
      <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(122,184,154,0.12)" }}>
          <Receipt className="w-4 h-4 text-primary" />
        </div>
        <h2 className="font-display font-semibold text-sm text-foreground">{t("piano.invoiceHistory")}</h2>
      </div>
      <div className="p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> {t("common.loading")}
          </div>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t("piano.noInvoices")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
                  <th className="text-left py-2 pr-4">{t("piano.invoiceDate")}</th>
                  <th className="text-left py-2 pr-4">{t("piano.amount")}</th>
                  <th className="text-left py-2 pr-4">{t("piano.status")}</th>
                  <th className="text-right py-2">PDF</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/50">
                    <td className="py-2.5 pr-4 text-foreground">
                      {inv.date ? new Date(inv.date).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-foreground font-medium">€{inv.amount.toFixed(2)}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inv.status === "paid" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {inv.status === "paid" ? t("piano.paid") : inv.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {inv.pdf_url && (
                        <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:text-primary/70 text-xs font-medium">
                          <FileDown className="w-3.5 h-3.5" /> {t("piano.download")}
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
