"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard, Search, Globe, GitCompare, Link2, MessageSquareText,
  Check, X, ArrowDown, Loader2, Zap, Crown, AlertTriangle, Sparkles, Wallet,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { useUsage } from "@/lib/hooks/useUsage";

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
  free:   { totalPrompts: 40, browsing: 0, comparisons: 0, urlAnalyses: 0, contextAnalyses: 0 },
  base:   { totalPrompts: 100, browsing: 30, comparisons: 0, urlAnalyses: 0, contextAnalyses: 0 },
  pro:    { totalPrompts: 300, browsing: 90, comparisons: 10, urlAnalyses: 50, contextAnalyses: 5 },
  agency: { totalPrompts: 300, browsing: 90, comparisons: 10, urlAnalyses: 50, contextAnalyses: 5 },
};

const PLAN_STYLE: Record<string, { label: string; descKey: string; gradient: string; border: string; text: string; bg: string }> = {
  demo: { label: "Demo", descKey: "piano.demoDesc", gradient: "linear-gradient(135deg, #6b7280, #9ca3af)", border: "rgba(107,114,128,0.3)", text: "#9ca3af", bg: "rgba(107,114,128,0.06)" },
  free: { label: "Demo", descKey: "piano.demoDesc", gradient: "linear-gradient(135deg, #6b7280, #9ca3af)", border: "rgba(107,114,128,0.3)", text: "#9ca3af", bg: "rgba(107,114,128,0.06)" },
  base: { label: "Base", descKey: "piano.baseDesc", gradient: "linear-gradient(135deg, #3b82f6, #60a5fa)", border: "rgba(59,130,246,0.3)", text: "#60a5fa", bg: "rgba(59,130,246,0.06)" },
  pro:  { label: "Pro", descKey: "piano.proDesc", gradient: "linear-gradient(135deg, #c4a882, #d4b896)", border: "rgba(196,168,130,0.3)", text: "#c4a882", bg: "rgba(196,168,130,0.06)" },
  agency: { label: "Pro", descKey: "piano.proDesc", gradient: "linear-gradient(135deg, #c4a882, #d4b896)", border: "rgba(196,168,130,0.3)", text: "#c4a882", bg: "rgba(196,168,130,0.06)" },
};

function getFeatures(t: (k: string) => string) {
  return [
    { label: t("piano.promptsMonth"),           demo: "40",              base: "100",            pro: "300" },
    { label: t("piano.realtimeBrowsing"),       demo: false,             base: `30 ${t("piano.prompt")}`, pro: `90 ${t("piano.prompt")}` },
    { label: t("piano.aiModels"),               demo: `2 ${t("piano.fixed")}`, base: `6 ${t("piano.selectable")}`, pro: t("piano.allPlusPro") },
    { label: t("piano.maxModelsProject"),       demo: "2",               base: "3",              pro: "5" },
    { label: t("piano.aiQueryGen"),             demo: true,              base: true,             pro: true },
    { label: t("piano.competitiveComparisons"), demo: false,             base: false,            pro: `10${t("piano.perMonth")}` },
    { label: t("piano.urlAnalyses"),            demo: false,             base: false,            pro: `50${t("piano.perMonth")}` },
    { label: t("piano.aiContextAnalyses"),      demo: false,             base: false,            pro: `5${t("piano.perMonth")}` },
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
  const { t } = useTranslation();

  const usage = useUsage();

  const limits = LIMITS[plan] || LIMITS.demo;
  const style = PLAN_STYLE[plan] || PLAN_STYLE.demo;
  const meta = { ...style, desc: t(style.descKey) };
  const isActive = subscriptionStatus === "active";
  const isDemo = plan === "demo" || plan === "free";
  const isBase = plan === "base";
  const isPro = plan === "pro" || plan === "agency";

  // Use live data from useUsage when loaded, fallback to server props
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

  async function handleSubscribe(priceEnv: string) {
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
    finally { setSubscribing(null); }
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
      if (data.ok) { alert("Abbonamento cancellato."); window.location.reload(); }
      else alert(data.error || "Errore");
    } catch { alert("Errore di rete"); }
    finally { setCanceling(false); setShowCancelModal(false); }
  }

  return (
    <div className="space-y-10 animate-fade-in">

      {/* ════════════════ 1. HERO CARD ════════════════ */}
      <div
        className="rounded-[4px] p-8 relative overflow-hidden"
        style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
      >
        {/* Decorative gradient orb */}
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-[0.07] blur-3xl" style={{ background: meta.gradient }} />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-[3px] flex items-center justify-center shadow-lg"
              style={{ background: meta.gradient }}
            >
              {isPro ? <Crown className="w-7 h-7 text-white" /> : isBase ? <Zap className="w-7 h-7 text-white" /> : <CreditCard className="w-7 h-7 text-white" />}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-display font-bold" style={{ color: style.text }}>{style.label}</h1>
                {!isDemo && (
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-semibold"
                    style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}
                  >
                    {t("piano.active")}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{meta.desc}</p>
              {subscriptionPeriod && isActive && (
                <p className="text-xs text-muted-foreground mt-1">
                  {subscriptionPeriod === "yearly" ? t("piano.annualSub") : t("piano.monthlySub")}
                </p>
              )}
            </div>
          </div>
          {plan !== "pro" && plan !== "agency" && (
            <a
              href="#piani"
              className="flex items-center gap-2 px-5 py-2.5 rounded-[3px] text-sm font-semibold transition-all hover:scale-[1.02] shrink-0"
              style={{ background: meta.gradient, color: "#fff", boxShadow: `0 4px 14px ${meta.border}` }}
            >
              {t("piano.changePlan")} <ArrowDown className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* ════════════════ 2. USAGE GRID ════════════════ */}
      <div>
        <h2 className="text-lg font-display font-semibold text-foreground mb-4">{t("piano.yourUsage")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* All plans: prompt totali */}
          <UsageCard icon={<Search className="w-5 h-5" />} label={t("piano.promptsUsed")} used={totalUsed} max={totalLimit} extra={liveExtraBrowsing + liveExtraNoBrowsing > 0 ? `+${liveExtraBrowsing + liveExtraNoBrowsing} extra` : undefined} />

          {/* Base+Pro: browsing */}
          {!isDemo && (
            <UsageCard icon={<Globe className="w-5 h-5" />} label={t("piano.withBrowsing")} used={liveBrowsingUsed} max={browsingLimit} extra={liveExtraBrowsing > 0 ? `+${liveExtraBrowsing} extra` : undefined} />
          )}

          {/* Pro: confronti, URL, contesti */}
          {isPro && (
            <>
              <UsageCard icon={<GitCompare className="w-5 h-5" />} label={t("piano.comparisons")} used={liveComparisonsUsed} max={comparisonsLimit} extra={liveExtraComparisons > 0 ? `+${liveExtraComparisons} extra` : undefined} />
              <UsageCard icon={<Link2 className="w-5 h-5" />} label={t("piano.urlAnalysis")} used={liveUrlAnalysesUsed} max={50} />
              <UsageCard icon={<MessageSquareText className="w-5 h-5" />} label={t("piano.contextAnalysis")} used={liveContextAnalysesUsed} max={5} />
            </>
          )}

          {/* Demo: single prompt card looks lonely, add an upgrade nudge */}
          {isDemo && (
            <div className="rounded-[4px] border border-dashed border-[#c4a882]/30 p-5 flex flex-col items-center justify-center text-center gap-2" style={{ background: "rgba(196,168,130,0.03)" }}>
              <Sparkles className="w-5 h-5 text-[#c4a882]" />
              <p className="text-sm text-muted-foreground">{t("piano.unlockMore")}</p>
              <a href="#piani" className="text-xs font-semibold text-[#c4a882] hover:text-[#c4a882]/80 transition-colors">{t("piano.viewPlans")} &darr;</a>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════ 2b. QUERY WALLET ════════════════ */}
      {(usage.wallet.browsingQueries > 0 || usage.wallet.noBrowsingQueries > 0 || usage.wallet.confronti > 0) && (
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#c4a882]" /> {t("piano.walletTitle")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {usage.wallet.browsingQueries > 0 && (
              <div className="rounded-[4px] border border-[#c4a882]/30 p-5 space-y-1" style={{ background: "rgba(196,168,130,0.04)" }}>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#c4a882]" />
                  <span className="text-sm font-medium text-foreground">{t("piano.walletBrowsing")}</span>
                </div>
                <p className="text-2xl font-display font-bold text-[#c4a882]">{usage.wallet.browsingQueries}</p>
                <p className="text-xs text-muted-foreground">{t("piano.walletQueryAvailable")}</p>
              </div>
            )}
            {usage.wallet.noBrowsingQueries > 0 && (
              <div className="rounded-[4px] border border-[#c4a882]/30 p-5 space-y-1" style={{ background: "rgba(196,168,130,0.04)" }}>
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#c4a882]" />
                  <span className="text-sm font-medium text-foreground">{t("piano.walletNoBrowsing")}</span>
                </div>
                <p className="text-2xl font-display font-bold text-[#c4a882]">{usage.wallet.noBrowsingQueries}</p>
                <p className="text-xs text-muted-foreground">{t("piano.walletQueryAvailable")}</p>
              </div>
            )}
            {usage.wallet.confronti > 0 && (
              <div className="rounded-[4px] border border-[#c4a882]/30 p-5 space-y-1" style={{ background: "rgba(196,168,130,0.04)" }}>
                <div className="flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-[#c4a882]" />
                  <span className="text-sm font-medium text-foreground">{t("piano.walletConfronti")}</span>
                </div>
                <p className="text-2xl font-display font-bold text-[#c4a882]">{usage.wallet.confronti}</p>
                <p className="text-xs text-muted-foreground">{t("piano.walletAvailable")}</p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t("piano.walletNeverExpires")}</p>
        </div>
      )}

      {/* ════════════════ 3. PLAN CARDS ════════════════ */}
      <div id="piani" className="scroll-mt-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <h2 className="text-lg font-display font-semibold text-foreground">{t("piano.comparePlans")}</h2>
          {/* Pill toggle */}
          <div className="flex items-center bg-surface-2 rounded-full p-1 border border-border">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${!annual ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t("piano.monthly")}
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${annual ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t("piano.annual")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Demo */}
          <PlanCard
            name="Demo"
            price={t("piano.free")}
            priceNote={null}
            color="#6b7280"
            gradient="linear-gradient(135deg, #6b7280, #9ca3af)"
            icon={<CreditCard className="w-5 h-5 text-white" />}
            isCurrent={isDemo}
            isRecommended={false}
            features={getFeatures(t).map(f => ({ label: f.label, value: f.demo }))}
            onSubscribe={null}
            subscribing={false}
            labels={{ recommended: t("piano.recommended"), activePlan: t("piano.activePlan"), subscribe: t("piano.subscribe") }}
          />
          {/* Base */}
          <PlanCard
            name="Base"
            price={annual ? "€649" : "€59"}
            priceNote={annual ? t("piano.perYear") : t("piano.perMonth")}
            annualDetails={annual ? { monthlyEquiv: "€54,08" } : undefined}
            color="#3b82f6"
            gradient="linear-gradient(135deg, #3b82f6, #60a5fa)"
            icon={<Zap className="w-5 h-5 text-white" />}
            isCurrent={isBase}
            isRecommended={false}
            features={getFeatures(t).map(f => ({ label: f.label, value: f.base }))}
            onSubscribe={!isBase && !isPro ? () => handleSubscribe(annual ? "STRIPE_PRICE_BASE_YEARLY" : "STRIPE_PRICE_BASE_MONTHLY") : null}
            subscribing={subscribing === (annual ? "STRIPE_PRICE_BASE_YEARLY" : "STRIPE_PRICE_BASE_MONTHLY")}
            labels={{ recommended: t("piano.recommended"), activePlan: t("piano.activePlan"), subscribe: t("piano.subscribe") }}
            t={t}
          />
          {/* Pro */}
          <PlanCard
            name="Pro"
            price={annual ? "€1.719" : "€159"}
            priceNote={annual ? t("piano.perYear") : t("piano.perMonth")}
            annualDetails={annual ? { monthlyEquiv: "€143,25" } : undefined}
            color="#c4a882"
            gradient="linear-gradient(135deg, #c4a882, #d4b896)"
            icon={<Crown className="w-5 h-5 text-white" />}
            isCurrent={isPro}
            isRecommended={true}
            features={getFeatures(t).map(f => ({ label: f.label, value: f.pro }))}
            onSubscribe={!isPro ? () => handleSubscribe(annual ? "STRIPE_PRICE_PRO_YEARLY" : "STRIPE_PRICE_PRO_MONTHLY") : null}
            subscribing={subscribing === (annual ? "STRIPE_PRICE_PRO_YEARLY" : "STRIPE_PRICE_PRO_MONTHLY")}
            labels={{ recommended: t("piano.recommended"), activePlan: t("piano.activePlan"), subscribe: t("piano.subscribe") }}
            t={t}
          />
        </div>
      </div>

      {/* ════════════════ 4. PACKAGES ════════════════ */}
      {packages.length > 0 && (
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground mb-1">{t("piano.extraPackages")}</h2>
          <p className="text-sm text-muted-foreground mb-5">{t("piano.extraPackagesDesc")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <div
                key={pkg.priceEnv}
                className="group rounded-[4px] border border-border p-5 flex flex-col justify-between hover:border-primary/30 hover:shadow-[0_0_20px_rgba(126,184,154,0.06)] transition-all"
                style={{ background: "var(--surface)" }}
              >
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-[3px] flex items-center justify-center" style={{ background: pkg.type === "query" ? "rgba(59,130,246,0.12)" : "rgba(196,168,130,0.12)" }}>
                      {pkg.type === "query" ? <Zap className="w-4 h-4 text-[#3b82f6]" /> : <GitCompare className="w-4 h-4 text-[#c4a882]" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{pkg.label}</p>
                      <p className="text-xs text-muted-foreground">{pkg.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-display font-bold text-foreground">&euro;{pkg.price}</span>
                    {pkg.note && (
                      <span className="text-[0.6rem] font-mono text-muted-foreground uppercase tracking-wider border border-border rounded px-1.5 py-0.5">{pkg.note}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleBuyPackage(pkg.priceEnv)}
                  disabled={purchasingId !== null}
                  className="mt-4 w-full py-2.5 rounded-[3px] text-sm font-semibold border border-primary/40 text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {purchasingId === pkg.priceEnv ? <Loader2 className="w-4 h-4 animate-spin" /> : t("piano.buy")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════ 5. CANCEL ════════════════ */}
      {hasActiveSubscription && (
        <div className="rounded-[4px] border border-destructive/20 p-5" style={{ background: "rgba(239,68,68,0.03)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive/60" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("piano.cancelQuestion")}</p>
                <p className="text-xs text-muted-foreground">{t("piano.cancelDesc")}</p>
              </div>
            </div>
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-4 py-2 rounded-[3px] border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors shrink-0"
            >
              {t("piano.cancelSubscription")}
            </button>
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCancelModal(false)}>
          <div className="bg-ink border border-destructive/30 rounded-[4px] p-6 w-[420px] space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <h3 className="text-lg font-semibold text-foreground">{t("piano.cancelSubscription")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("piano.cancelModalDesc")}
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowCancelModal(false)} className="text-sm px-4 py-2 rounded-[3px] border border-border text-muted-foreground hover:text-foreground transition-colors">
                {t("piano.back")}
              </button>
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

function UsageCard({ icon, label, used, max, extra }: {
  icon: React.ReactNode; label: string; used: number; max: number; extra?: string;
}) {
  const pct = max > 0 ? used / max : 0;
  const color = barColor(used, max);
  return (
    <div className="rounded-[4px] border border-border p-5 space-y-3" style={{ background: "var(--surface)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[3px] flex items-center justify-center" style={{ background: `${color}15` }}>
            <span style={{ color }}>{icon}</span>
          </div>
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <span className="text-xl font-display font-bold text-foreground">{used}<span className="text-sm font-normal text-muted-foreground">/{max}</span></span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: `${color}15` }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: max > 0 ? `${Math.min(100, pct * 100)}%` : "0%",
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            minWidth: used > 0 && max > 0 ? "6px" : undefined,
            boxShadow: pct > 0.5 ? `0 0 8px ${color}40` : undefined,
          }}
        />
      </div>
      {extra && <p className="text-xs font-medium" style={{ color }}>{extra}</p>}
    </div>
  );
}

function PlanCard({ name, price, priceNote, annualDetails, color, gradient, icon, isCurrent, isRecommended, features, onSubscribe, subscribing, labels, t }: {
  name: string; price: string; priceNote: string | null;
  annualDetails?: { monthlyEquiv: string };
  color: string; gradient: string; icon: React.ReactNode;
  isCurrent: boolean; isRecommended: boolean;
  features: { label: string; value: boolean | string }[];
  onSubscribe: (() => void) | null; subscribing: boolean;
  labels: { recommended: string; activePlan: string; subscribe: string };
  t?: (k: string) => string;
}) {
  return (
    <div
      className="relative rounded-[4px] flex flex-col overflow-hidden transition-all"
      style={{
        border: isCurrent ? `2px solid ${color}` : "1px solid var(--border)",
        background: "var(--surface)",
        boxShadow: isCurrent ? `0 0 24px ${color}15` : undefined,
      }}
    >
      {/* Recommended badge */}
      {isRecommended && (
        <div className="absolute top-0 right-0 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-white rounded-bl-[4px]" style={{ background: gradient }}>
          {labels.recommended}
        </div>
      )}

      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-[3px] flex items-center justify-center shadow-md" style={{ background: gradient }}>
            {icon}
          </div>
          <h3 className="text-xl font-display font-bold text-foreground">{name}</h3>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-display font-bold text-foreground">{price}</span>
          {priceNote && <span className="text-sm text-muted-foreground">{priceNote}</span>}
        </div>
        {annualDetails && (
          <p className="mt-1 text-sm text-muted-foreground">
            {annualDetails.monthlyEquiv}{t ? t("piano.perMonth") : "/mese"}
          </p>
        )}
      </div>

      {/* Features */}
      <div className="flex-1 px-6 pb-4 space-y-2.5">
        {features.map((f) => (
          <div key={f.label} className="flex items-center gap-2.5 text-xs">
            {f.value === true ? (
              <Check className="w-3.5 h-3.5 shrink-0" style={{ color }} />
            ) : f.value === false ? (
              <X className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
            ) : (
              <Check className="w-3.5 h-3.5 shrink-0" style={{ color }} />
            )}
            <span className={f.value === false ? "text-muted-foreground/50" : "text-foreground"}>
              {f.label}{typeof f.value === "string" ? `: ${f.value}` : ""}
            </span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="p-6 pt-2">
        {isCurrent ? (
          <div
            className="w-full py-2.5 rounded-[3px] text-center text-sm font-semibold"
            style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
          >
            {labels.activePlan}
          </div>
        ) : onSubscribe ? (
          <button
            onClick={onSubscribe}
            disabled={subscribing}
            className="w-full py-2.5 rounded-[3px] text-sm font-semibold text-white transition-all hover:scale-[1.01] hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: gradient, boxShadow: `0 4px 14px ${color}30` }}
          >
            {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : labels.subscribe}
          </button>
        ) : (
          <button disabled className="w-full py-2.5 rounded-[3px] text-sm font-medium text-muted-foreground border border-border opacity-50 cursor-not-allowed">
            {labels.activePlan}
          </button>
        )}
      </div>
    </div>
  );
}
