"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, CreditCard, Ticket, Bell, PlayCircle, LogOut, AlertTriangle, Check, Loader2, Trash2, Globe, Cpu, Package } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { RestartTourButton } from "./restart-tour-button";

interface UsageData {
  browsingPromptsUsed: number;
  browsingPromptsLimit: number;
  noBrowsingPromptsUsed: number;
  noBrowsingPromptsLimit: number;
  comparisonsUsed: number;
  comparisonsLimit: number;
  maxModels: number;
  extraBrowsingPrompts: number;
  extraNoBrowsingPrompts: number;
  extraComparisons: number;
}

interface PackageDef {
  id: string;
  name: string;
  description: string;
  price: number;
  plan_required: string;
  browsing_prompts: number;
  no_browsing_prompts: number;
  comparisons: number;
  max_per_month: number | null;
}

interface SettingsClientProps {
  userId: string;
  email: string;
  fullName: string;
  plan: string;
  notifyAnalysisComplete: boolean;
  usage: UsageData;
}

async function patchProfile(data: Record<string, unknown>) {
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.ok;
}

export function SettingsClient({
  userId,
  email,
  fullName: initialName,
  plan,
  notifyAnalysisComplete: initialNotifyAnalysis,
  usage,
}: SettingsClientProps) {
  const { t, locale } = useTranslation();
  const router = useRouter();

  const [fullName, setFullName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [notifyAnalysis, setNotifyAnalysis] = useState(initialNotifyAnalysis);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");

  // Voucher
  const [voucher, setVoucher] = useState("");
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherMsg, setVoucherMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [loggingOut, setLoggingOut] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  const isPro = plan === "pro" || plan === "agency";
  const isBase = plan === "base";
  const isDemo = !plan || plan === "demo" || plan === "free";

  // Subscription
  const [subscribing, setSubscribing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [subscriptionMsg, setSubscriptionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Packages
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [purchaseMsg, setPurchaseMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const PACKAGES: PackageDef[] = isBase ? [
    { id: "base_100", name: "100 Query Extra", description: "+100 query senza browsing", price: 19, plan_required: "base", browsing_prompts: 0, no_browsing_prompts: 100, comparisons: 0, max_per_month: 1 },
    { id: "base_300", name: "300 Query Extra", description: "+300 query senza browsing", price: 49, plan_required: "base", browsing_prompts: 0, no_browsing_prompts: 300, comparisons: 0, max_per_month: 1 },
  ] : isPro ? [
    { id: "pro_100", name: "100 Query Extra", description: "+100 query (browsing incluso)", price: 29, plan_required: "pro", browsing_prompts: 30, no_browsing_prompts: 70, comparisons: 0, max_per_month: null },
    { id: "pro_300", name: "300 Query Extra", description: "+300 query (browsing incluso)", price: 89, plan_required: "pro", browsing_prompts: 90, no_browsing_prompts: 210, comparisons: 0, max_per_month: null },
    { id: "pro_comp_3", name: "3 Confronti Extra", description: "+3 analisi competitive", price: 15, plan_required: "pro", browsing_prompts: 0, no_browsing_prompts: 0, comparisons: 3, max_per_month: null },
    { id: "pro_comp_5", name: "5 Confronti Extra", description: "+5 analisi competitive", price: 19, plan_required: "pro", browsing_prompts: 0, no_browsing_prompts: 0, comparisons: 5, max_per_month: null },
    { id: "pro_comp_10", name: "10 Confronti Extra", description: "+10 analisi competitive", price: 25, plan_required: "pro", browsing_prompts: 0, no_browsing_prompts: 0, comparisons: 10, max_per_month: null },
  ] : [];

  async function handleSubscribe(planId: string) {
    setSubscribing(true);
    setSubscriptionMsg(null);
    try {
      const res = await fetch("/api/paypal/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (res.ok && data.approvalUrl) {
        window.location.href = data.approvalUrl;
      } else {
        setSubscriptionMsg({ ok: false, text: data.error || "Errore nella creazione dell'abbonamento" });
        setSubscribing(false);
      }
    } catch {
      setSubscriptionMsg({ ok: false, text: "Errore di rete" });
      setSubscribing(false);
    }
  }

  async function handleCancelSubscription() {
    setCancelling(true);
    setSubscriptionMsg(null);
    try {
      const res = await fetch("/api/paypal/cancel-subscription", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSubscriptionMsg({ ok: true, text: "Abbonamento cancellato. Tornerai al piano Demo." });
        setShowCancelConfirm(false);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setSubscriptionMsg({ ok: false, text: data.error || "Errore nella cancellazione" });
      }
    } catch {
      setSubscriptionMsg({ ok: false, text: "Errore di rete" });
    } finally {
      setCancelling(false);
    }
  }

  async function purchasePackage(pkgId: string) {
    setPurchasingId(pkgId);
    setPurchaseMsg(null);
    try {
      const res = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkgId }),
      });
      const data = await res.json();
      if (res.ok && data.approvalUrl) {
        window.location.href = data.approvalUrl;
      } else {
        setPurchaseMsg({ ok: false, text: data.error || t("settings.packageError") });
        setPurchasingId(null);
      }
    } catch {
      setPurchaseMsg({ ok: false, text: t("settings.packageError") });
      setPurchasingId(null);
    }
  }

  const saveName = useCallback(async () => {
    setSavingName(true);
    setNameSaved(false);
    const ok = await patchProfile({ full_name: fullName });
    setSavingName(false);
    if (ok) {
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    }
  }, [fullName]);

  const toggleNotification = useCallback(async (field: string, value: boolean) => {
    if (field === "notify_analysis_complete") setNotifyAnalysis(value);
    await patchProfile({ [field]: value });
  }, []);

  async function redeemVoucher() {
    if (!voucher.trim()) return;
    setVoucherLoading(true);
    setVoucherMsg(null);
    try {
      const res = await fetch("/api/voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: voucher.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setVoucherMsg({ ok: true, text: data.message || t("settings.voucherSuccess") });
        setVoucher("");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setVoucherMsg({ ok: false, text: data.error || t("settings.voucherInvalid") });
      }
    } catch {
      setVoucherMsg({ ok: false, text: t("settings.voucherError") });
    } finally {
      setVoucherLoading(false);
    }
  }

  return (
    <>
      {/* 1. Profilo */}
      <div data-tour="settings-account" className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{t("settings.profile")}</h2>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-[2px] flex items-center justify-center text-primary font-display text-xl shrink-0" style={{ background: "var(--primary-glow)", border: "1px solid var(--primary-hover)" }}>
            {(fullName?.[0] ?? email?.[0] ?? "U").toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-foreground font-medium">{fullName || email}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">{t("settings.name")}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-base flex-1"
                placeholder={t("settings.namePlaceholder")}
              />
              <button
                onClick={saveName}
                disabled={savingName || fullName === initialName}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-[2px] text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : nameSaved ? <Check className="w-3.5 h-3.5" /> : null}
                {nameSaved ? t("common.saved") : t("common.save")}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">{t("auth.email")}</label>
            <p className="text-sm text-foreground bg-muted/30 rounded-[2px] px-3 py-2">{email}</p>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">{t("settings.userId")}</label>
          <p className="mt-1 text-sm text-foreground bg-muted/30 rounded-[2px] px-3 py-2 font-mono text-xs truncate">{userId}</p>
        </div>
      </div>

      {/* 2. Piano Abbonamento — Pricing Cards */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold text-foreground">{t("settings.subscription")}</h2>
          </div>

          {/* Monthly / Annual toggle */}
          <div className="flex items-center gap-1 bg-muted/30 rounded-[2px] p-0.5">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-[2px] transition-colors ${billingPeriod === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Mensile
            </button>
            <button
              onClick={() => setBillingPeriod("annual")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-[2px] transition-colors ${billingPeriod === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Annuale
            </button>
          </div>
        </div>

        {/* Current plan badge */}
        <div className="flex items-center gap-3">
          {isPro ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-[2px] bg-primary/10 border border-primary/30 text-primary">
              <Check className="w-4 h-4" />
              Pro attivo
            </span>
          ) : isBase ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-[2px] bg-primary/10 border border-primary/30 text-primary">
              <Check className="w-4 h-4" />
              Base attivo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-[2px] bg-muted/30 border border-border text-foreground">
              Demo gratuita
            </span>
          )}
        </div>

        {/* 3 Plan Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Demo */}
          <div className={`rounded-[2px] p-4 space-y-3 border ${isDemo ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"}`}>
            <div>
              <p className="font-semibold text-foreground text-sm">Demo Gratuita</p>
              <p className="text-2xl font-display font-bold text-foreground mt-1">Gratis</p>
            </div>
            <ul className="space-y-1.5 text-xs">
              <li className="text-foreground">40 prompt (senza browsing)</li>
              <li className="text-foreground">2 modelli fissi (GPT-5.4 Mini, Gemini 2.5 Flash)</li>
              <li className="text-muted-foreground/50">Nessun confronto</li>
              <li className="text-muted-foreground/50">Nessun dataset</li>
              <li className="text-muted-foreground/50">Nessun browsing</li>
            </ul>
            {isDemo && <p className="text-xs text-primary font-semibold">Piano attuale</p>}
          </div>

          {/* Base */}
          <div className={`rounded-[2px] p-4 space-y-3 border ${isBase ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"}`}>
            <div>
              <p className="font-semibold text-foreground text-sm">Base</p>
              {billingPeriod === "monthly" ? (
                <p className="text-2xl font-display font-bold text-foreground mt-1">&euro;59<span className="text-sm font-normal text-muted-foreground">/mese</span></p>
              ) : (
                <div className="mt-1">
                  <p className="text-2xl font-display font-bold text-foreground">&euro;54<span className="text-sm font-normal text-muted-foreground">/mese</span></p>
                  <p className="text-xs text-primary mt-0.5">&euro;649 fatturati annualmente &middot; Risparmia &euro;59/anno</p>
                </div>
              )}
            </div>
            <ul className="space-y-1.5 text-xs">
              <li className="text-foreground flex items-center gap-1"><Globe className="w-3 h-3" /> 30 prompt con browsing</li>
              <li className="text-foreground flex items-center gap-1"><Cpu className="w-3 h-3" /> 70 prompt senza browsing</li>
              <li className="text-foreground">Max 3 modelli/progetto</li>
              <li className="text-foreground">6 modelli base selezionabili</li>
              <li className="text-foreground">Generazione query AI</li>
              <li className="text-muted-foreground/50">Nessun confronto</li>
              <li className="text-muted-foreground/50">Nessun dataset</li>
            </ul>
            {isBase && <p className="text-xs text-primary font-semibold">Piano attuale</p>}
            {isDemo && (
              <button
                onClick={() => handleSubscribe(billingPeriod === "annual" ? (process.env.NEXT_PUBLIC_PAYPAL_PLAN_BASE_ANNUAL ?? "") : (process.env.NEXT_PUBLIC_PAYPAL_PLAN_BASE_MONTHLY ?? ""))}
                disabled={subscribing}
                className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-[2px] text-xs font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {subscribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Abbonati a Base
              </button>
            )}
          </div>

          {/* Pro */}
          <div className={`rounded-[2px] p-4 space-y-3 border-2 relative ${isPro ? "border-primary bg-primary/5" : "border-[#d4a817]/50 bg-[#d4a817]/5"}`}>
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 font-sans text-[0.6875rem] font-semibold tracking-wide text-[#d4a817] bg-background border border-[#d4a817]/40 px-3 py-1 rounded-full whitespace-nowrap shadow-sm">
              Più popolare
            </span>
            <div>
              <p className="font-semibold text-foreground text-sm">Pro</p>
              {billingPeriod === "monthly" ? (
                <p className="text-2xl font-display font-bold text-foreground mt-1">&euro;159<span className="text-sm font-normal text-muted-foreground">/mese</span></p>
              ) : (
                <div className="mt-1">
                  <p className="text-2xl font-display font-bold text-foreground">&euro;143<span className="text-sm font-normal text-muted-foreground">/mese</span></p>
                  <p className="text-xs text-primary mt-0.5">&euro;1.719 fatturati annualmente &middot; Risparmia &euro;191/anno</p>
                </div>
              )}
            </div>
            <ul className="space-y-1.5 text-xs">
              <li className="text-foreground flex items-center gap-1"><Globe className="w-3 h-3" /> 90 prompt con browsing</li>
              <li className="text-foreground flex items-center gap-1"><Cpu className="w-3 h-3" /> 210 prompt senza browsing</li>
              <li className="text-foreground">Max 5 modelli/progetto</li>
              <li className="text-foreground">Tutti i modelli sbloccati (11)</li>
              <li className="text-foreground">10 confronti AI/mese</li>
              <li className="text-foreground">Dataset sbloccato</li>
              <li className="text-foreground">Generazione query AI</li>
            </ul>
            {isPro && <p className="text-xs text-primary font-semibold">Piano attuale</p>}
            {!isPro && (
              <button
                onClick={() => handleSubscribe(billingPeriod === "annual" ? (process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO_ANNUAL ?? "") : (process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO_MONTHLY ?? ""))}
                disabled={subscribing}
                className="w-full px-3 py-2 bg-[#d4a817] text-background rounded-[2px] text-xs font-semibold hover:bg-[#d4a817]/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {subscribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Abbonati a Pro
              </button>
            )}
          </div>
        </div>

        {/* Subscription management */}
        {(isBase || isPro) && (
          <div className="pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Gestisci il tuo abbonamento
              </p>
              {!showCancelConfirm ? (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="px-4 py-2 border border-destructive/30 text-destructive rounded-[2px] text-xs font-medium hover:bg-destructive/10 transition-colors"
                >
                  Annulla abbonamento
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="px-3 py-2 border border-border text-foreground rounded-[2px] text-xs hover:bg-muted/30 transition-colors"
                  >
                    Indietro
                  </button>
                  <button
                    onClick={handleCancelSubscription}
                    disabled={cancelling}
                    className="px-3 py-2 bg-destructive text-white rounded-[2px] text-xs font-medium hover:bg-destructive/80 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Conferma cancellazione
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {subscriptionMsg && (
          <p className={`text-sm ${subscriptionMsg.ok ? "text-primary" : "text-destructive"}`}>{subscriptionMsg.text}</p>
        )}
      </div>

      {/* 2b. Utilizzo mensile */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{t("settings.monthlyUsage")}</h2>
        </div>

        {/* Browsing prompts usage */}
        {!isDemo && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Prompt con browsing</span>
              <span className="text-foreground font-medium">
                {usage.browsingPromptsUsed} / {usage.browsingPromptsLimit + usage.extraBrowsingPrompts}
                {usage.extraBrowsingPrompts > 0 && <span className="text-primary ml-1">(+{usage.extraBrowsingPrompts} extra)</span>}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(usage.browsingPromptsLimit + usage.extraBrowsingPrompts) > 0 ? Math.min(100, (usage.browsingPromptsUsed / (usage.browsingPromptsLimit + usage.extraBrowsingPrompts)) * 100) : 0}%`,
                  background: usage.browsingPromptsUsed >= (usage.browsingPromptsLimit + usage.extraBrowsingPrompts) ? "var(--destructive)" : "var(--primary)",
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {(usage.browsingPromptsLimit + usage.extraBrowsingPrompts) - usage.browsingPromptsUsed > 0
                ? `${(usage.browsingPromptsLimit + usage.extraBrowsingPrompts) - usage.browsingPromptsUsed} disponibili`
                : "Limite raggiunto"}
            </p>
          </div>
        )}

        {/* No-browsing prompts usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              {isDemo ? "Prompt demo" : "Prompt senza browsing"}
            </span>
            <span className="text-foreground font-medium">
              {usage.noBrowsingPromptsUsed} / {usage.noBrowsingPromptsLimit + usage.extraNoBrowsingPrompts}
              {usage.extraNoBrowsingPrompts > 0 && <span className="text-primary ml-1">(+{usage.extraNoBrowsingPrompts} extra)</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(usage.noBrowsingPromptsLimit + usage.extraNoBrowsingPrompts) > 0 ? Math.min(100, (usage.noBrowsingPromptsUsed / (usage.noBrowsingPromptsLimit + usage.extraNoBrowsingPrompts)) * 100) : 0}%`,
                background: usage.noBrowsingPromptsUsed >= (usage.noBrowsingPromptsLimit + usage.extraNoBrowsingPrompts) ? "var(--destructive)" : "var(--primary)",
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {(usage.noBrowsingPromptsLimit + usage.extraNoBrowsingPrompts) - usage.noBrowsingPromptsUsed > 0
              ? `${(usage.noBrowsingPromptsLimit + usage.extraNoBrowsingPrompts) - usage.noBrowsingPromptsUsed} disponibili`
              : "Limite raggiunto"}
          </p>
        </div>

        {/* Comparisons usage (only for Pro) */}
        {isPro && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("settings.compareDetections")}</span>
              <span className="text-foreground font-medium">
                {usage.comparisonsUsed} / {usage.comparisonsLimit + usage.extraComparisons}
                {usage.extraComparisons > 0 && <span className="text-primary ml-1">(+{usage.extraComparisons} extra)</span>}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(usage.comparisonsLimit + usage.extraComparisons) > 0 ? Math.min(100, (usage.comparisonsUsed / (usage.comparisonsLimit + usage.extraComparisons)) * 100) : 0}%`,
                  background: usage.comparisonsUsed >= (usage.comparisonsLimit + usage.extraComparisons) ? "var(--destructive)" : "var(--primary)",
                }}
              />
            </div>
          </div>
        )}

        {/* Models per project */}
        <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
          <span className="text-muted-foreground">{t("settings.maxModels").replace("{n}", String(usage.maxModels))}</span>
          <span className="text-foreground font-medium">Max {usage.maxModels}</span>
        </div>

        {/* Reset date */}
        <p className="text-xs text-muted-foreground">
          {t("settings.renewsOn")} 1 {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString(locale === "it" ? "it-IT" : locale === "en" ? "en-US" : locale === "fr" ? "fr-FR" : locale === "de" ? "de-DE" : "es-ES", { month: "long" })}
        </p>
      </div>

      {/* 2c. Pacchetti extra — only for Base and Pro */}
      {PACKAGES.length > 0 && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold text-foreground">{t("settings.extraPackages")}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{t("settings.extraPackagesDesc")}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                className="rounded-[2px] border border-border bg-muted/20 p-4 space-y-3 flex flex-col"
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{pkg.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-display font-bold text-foreground">&euro;{pkg.price}</p>
                  {pkg.max_per_month !== null && (
                    <span className="text-[0.625rem] font-mono text-muted-foreground uppercase tracking-wide">max {pkg.max_per_month}/mese</span>
                  )}
                </div>
                <button
                  onClick={() => purchasePackage(pkg.id)}
                  disabled={purchasingId !== null}
                  className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-[2px] text-xs font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {purchasingId === pkg.id ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("common.loading")}</>
                  ) : (
                    <>{t("settings.buyPackage")}</>
                  )}
                </button>
              </div>
            ))}
          </div>

          {purchaseMsg && (
            <p className={`text-sm ${purchaseMsg.ok ? "text-primary" : "text-destructive"}`}>{purchaseMsg.text}</p>
          )}

          {isDemo && (
            <p className="text-xs text-muted-foreground italic">{t("settings.upgradeForPackages")}</p>
          )}
        </div>
      )}

      {/* 3. Voucher */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Ticket className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Voucher</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t("settings.voucherDesc")}</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={voucher}
            onChange={(e) => setVoucher(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && redeemVoucher()}
            placeholder={t("settings.voucherPlaceholder")}
            className="input-base flex-1 font-mono uppercase tracking-wider"
          />
          <button
            onClick={redeemVoucher}
            disabled={voucherLoading || !voucher.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-[2px] text-sm font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {voucherLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ticket className="w-3.5 h-3.5" />}
            {t("settings.redeemVoucher")}
          </button>
        </div>
        {voucherMsg && (
          <p className={`text-sm ${voucherMsg.ok ? "text-primary" : "text-destructive"}`}>{voucherMsg.text}</p>
        )}
      </div>

      {/* 4. Notifiche */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{t("settings.notifications")}</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-muted/20 rounded-[2px] px-4 py-3">
            <div>
              <p className="text-sm text-foreground">{t("settings.emailOnComplete")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.receiveNotification")}</p>
            </div>
            <button
              onClick={() => toggleNotification("notify_analysis_complete", !notifyAnalysis)}
              className={`relative w-11 h-6 rounded-full transition-colors ${notifyAnalysis ? "bg-primary" : "bg-muted"}`}
            >
              <div className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${notifyAnalysis ? "translate-x-[22px]" : "translate-x-[2px]"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Tour guidato */}
      <div data-tour="settings-tour" className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <PlayCircle className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{t("settings.guidedTour")}</h2>
        </div>
        <div className="flex items-center justify-between bg-muted/20 rounded-[2px] px-4 py-3">
          <p className="text-sm text-muted-foreground">{t("settings.reviewTour")}</p>
          <RestartTourButton />
        </div>
      </div>

      {/* 6. Sessione */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <LogOut className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{t("settings.session")}</h2>
        </div>
        <div className="flex items-center justify-between bg-muted/20 rounded-[2px] px-4 py-3">
          <div>
            <p className="text-sm text-foreground">{t("settings.logoutDesc")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.logoutRedirect")}</p>
          </div>
          <button
            onClick={async () => {
              setLoggingOut(true);
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/login");
            }}
            disabled={loggingOut}
            className="px-4 py-2 border border-border text-foreground rounded-[2px] text-sm font-medium hover:bg-muted/30 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {loggingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            {loggingOut ? t("common.loggingOut") : t("common.logout")}
          </button>
        </div>
      </div>

      {/* 7. Zona pericolo */}
      <div className="card p-6 space-y-4 border-destructive/20">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h2 className="font-display font-semibold text-destructive">{t("settings.dangerZone")}</h2>
        </div>

        {/* Elimina progetti */}
        <div className="flex items-center justify-between bg-destructive/5 rounded-[2px] px-4 py-3 border border-destructive/20">
          <div className="flex items-center gap-3">
            <Trash2 className="w-4 h-4 text-destructive shrink-0" />
            <div>
              <p className="text-sm text-foreground font-medium">{t("settings.deletedProjects")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.restoreDeleted")}</p>
            </div>
          </div>
          <a
            href="/settings/deleted-projects"
            className="px-4 py-2 border border-destructive/30 text-destructive rounded-[2px] text-sm font-medium hover:bg-destructive/10 transition-colors shrink-0"
          >
            {t("common.manage")}
          </a>
        </div>

        {/* Elimina account */}
        <div className="flex items-center justify-between bg-destructive/5 rounded-[2px] px-4 py-3 border border-destructive/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <div>
              <p className="text-sm text-foreground font-medium">{t("settings.deleteAccount")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.deleteWarning")}</p>
            </div>
          </div>
          {!showDeleteAccount ? (
            <button
              onClick={() => setShowDeleteAccount(true)}
              className="px-4 py-2 bg-destructive text-white rounded-[2px] text-sm font-medium hover:bg-destructive/80 transition-colors shrink-0"
            >
              {t("common.delete")}
            </button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowDeleteAccount(false)}
                className="px-3 py-2 border border-border text-foreground rounded-[2px] text-sm hover:bg-muted/30 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                className="px-3 py-2 bg-destructive text-white rounded-[2px] text-sm font-medium opacity-50 cursor-not-allowed"
                disabled
                title={t("settings.comingSoon")}
              >
                {t("common.confirm")}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
