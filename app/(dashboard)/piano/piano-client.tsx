"use client";

import { useState } from "react";
import { CreditCard, Search, Globe, GitCompare, Link2, MessageSquareText, Check, X, ArrowDown, Loader2, Package } from "lucide-react";

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

/* ─── Plan limits ─── */

const LIMITS = {
  demo:   { totalPrompts: 40, browsing: 0, noBrowsing: 40, comparisons: 0, urlAnalyses: 0, contextAnalyses: 0 },
  free:   { totalPrompts: 40, browsing: 0, noBrowsing: 40, comparisons: 0, urlAnalyses: 0, contextAnalyses: 0 },
  base:   { totalPrompts: 100, browsing: 30, noBrowsing: 70, comparisons: 0, urlAnalyses: 0, contextAnalyses: 0 },
  pro:    { totalPrompts: 300, browsing: 90, noBrowsing: 210, comparisons: 10, urlAnalyses: 50, contextAnalyses: 5 },
  agency: { totalPrompts: 300, browsing: 90, noBrowsing: 210, comparisons: 10, urlAnalyses: 50, contextAnalyses: 5 },
} as Record<string, { totalPrompts: number; browsing: number; noBrowsing: number; comparisons: number; urlAnalyses: number; contextAnalyses: number }>;

const PLAN_LABEL: Record<string, string> = { demo: "Demo", free: "Demo", base: "Base", pro: "Pro", agency: "Pro" };

/* ─── Comparison table data ─── */

const TABLE_FEATURES = [
  { label: "Prompt/mese", demo: "40 totali", base: "100", pro: "300" },
  { label: "Browsing in tempo reale", demo: false, base: "30 prompt", pro: "90 prompt" },
  { label: "Modelli AI", demo: "2 fissi", base: "6 selezionabili", pro: "Tutti + Pro" },
  { label: "Max modelli per progetto", demo: "2", base: "3", pro: "5" },
  { label: "Generazione query AI", demo: true, base: true, pro: true },
  { label: "Confronti competitivi", demo: false, base: false, pro: "10/mese" },
  { label: "Analisi URL", demo: false, base: false, pro: "50/mese" },
  { label: "Analisi Contesti AI", demo: false, base: false, pro: "5/mese" },
];

/* ─── Packages ─── */

const BASE_PACKAGES = [
  { label: "100 Query Extra", price: 19, priceEnv: "STRIPE_PRICE_QUERIES_BASE_100", note: null },
  { label: "300 Query Extra", price: 49, priceEnv: "STRIPE_PRICE_QUERIES_BASE_300", note: "max 1/mese" },
];

const PRO_PACKAGES = [
  { label: "100 Query Extra", price: 29, priceEnv: "STRIPE_PRICE_QUERIES_PRO_100", note: null },
  { label: "300 Query Extra", price: 89, priceEnv: "STRIPE_PRICE_QUERIES_PRO_300", note: null },
  { label: "3 Confronti Extra", price: 15, priceEnv: "STRIPE_PRICE_CONFRONTI_3", note: null },
  { label: "5 Confronti Extra", price: 19, priceEnv: "STRIPE_PRICE_CONFRONTI_5", note: null },
  { label: "10 Confronti Extra", price: 25, priceEnv: "STRIPE_PRICE_CONFRONTI_10", note: null },
];

/* ─── Helpers ─── */

function barColor(used: number, max: number): string {
  if (max === 0) return "var(--muted-foreground)";
  const pct = used / max;
  if (pct > 0.9) return "#ef4444";
  if (pct > 0.7) return "#f59e0b";
  return "#10b981";
}

function barWidth(used: number, max: number): string {
  if (max === 0) return "0%";
  return `${Math.min(100, (used / max) * 100)}%`;
}

function FeatureCell({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="w-4 h-4 text-primary mx-auto" />;
  if (value === false) return <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />;
  return <span className="text-foreground text-xs">{value}</span>;
}

/* ─── Main component ─── */

export function PianoClient({
  plan,
  subscriptionStatus,
  subscriptionPeriod,
  hasActiveSubscription,
  browsingUsed,
  noBrowsingUsed,
  comparisonsUsed,
  extraBrowsing,
  extraNoBrowsing,
  extraComparisons,
}: PianoClientProps) {
  const [annual, setAnnual] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  const limits = LIMITS[plan] || LIMITS.demo;
  const label = PLAN_LABEL[plan] || "Demo";
  const isActive = subscriptionStatus === "active";
  const isDemo = plan === "demo" || plan === "free";
  const isBase = plan === "base";
  const isPro = plan === "pro" || plan === "agency";

  const totalUsed = browsingUsed + noBrowsingUsed;
  const totalLimit = limits.totalPrompts + extraBrowsing + extraNoBrowsing;
  const browsingLimit = limits.browsing + extraBrowsing;
  const comparisonsLimit = limits.comparisons + extraComparisons;

  async function handleCancelSubscription() {
    setCanceling(true);
    try {
      const res = await fetch("/api/stripe/cancel-subscription", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        alert("Abbonamento cancellato. Rimarrà attivo fino alla fine del periodo corrente.");
        window.location.reload();
      } else {
        alert(data.error || "Errore nella cancellazione");
      }
    } catch {
      alert("Errore di rete");
    } finally {
      setCanceling(false);
      setShowCancelModal(false);
    }
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
      else alert(data.error || "Errore nella creazione del checkout");
    } catch {
      alert("Errore di rete");
    } finally {
      setPurchasingId(null);
    }
  }

  const packages = isBase ? BASE_PACKAGES : isPro ? PRO_PACKAGES : [];

  return (
    <div className="max-w-[800px] space-y-8 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-display tracking-tight text-foreground" style={{ fontWeight: 300 }}>
          Il tuo piano
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Gestisci il tuo abbonamento e monitora i tuoi utilizzi.</p>
      </div>

      {/* ─── Current plan card ─── */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-[2px] flex items-center justify-center"
              style={{ background: isDemo ? "var(--surface-2)" : "rgba(126,184,154,0.15)" }}
            >
              <CreditCard className={`w-5 h-5 ${isDemo ? "text-muted-foreground" : "text-primary"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium text-foreground">{label}</span>
                {!isDemo && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full border font-medium"
                    style={
                      isActive
                        ? { color: "#10b981", background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.2)" }
                        : { color: "var(--muted-foreground)", background: "var(--surface-2)", borderColor: "var(--border)" }
                    }
                  >
                    {isActive ? "Attivo" : "Inattivo"}
                  </span>
                )}
              </div>
              {isDemo && (
                <p className="text-xs text-muted-foreground mt-0.5">Piano gratuito di prova</p>
              )}
              {subscriptionPeriod && isActive && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Abbonamento {subscriptionPeriod === "yearly" ? "annuale" : "mensile"}
                </p>
              )}
            </div>
          </div>

          <a
            href="#piani"
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
          >
            Cambia piano <ArrowDown className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* ─── Usage bars ─── */}
      <div className="card p-6 space-y-5">
        <h2 className="text-sm font-semibold text-foreground font-mono uppercase tracking-wider">I tuoi utilizzi</h2>

        {/* Demo: prompt totali */}
        {isDemo && (
          <UsageBar
            icon={<Search className="w-4 h-4" />}
            label="Prompt utilizzati"
            used={totalUsed}
            max={40}
          />
        )}

        {/* Base: prompt totali + con browsing */}
        {isBase && (
          <>
            <UsageBar
              icon={<Search className="w-4 h-4" />}
              label="Prompt totali"
              used={totalUsed}
              max={totalLimit}
              extra={extraBrowsing + extraNoBrowsing > 0 ? `+${extraBrowsing + extraNoBrowsing} extra` : undefined}
            />
            <UsageBar
              icon={<Globe className="w-4 h-4" />}
              label="Con browsing"
              used={browsingUsed}
              max={browsingLimit}
              extra={extraBrowsing > 0 ? `+${extraBrowsing} extra` : undefined}
            />
          </>
        )}

        {/* Pro: prompt totali + browsing + confronti + URL + contesti */}
        {isPro && (
          <>
            <UsageBar
              icon={<Search className="w-4 h-4" />}
              label="Prompt totali"
              used={totalUsed}
              max={totalLimit}
              extra={extraBrowsing + extraNoBrowsing > 0 ? `+${extraBrowsing + extraNoBrowsing} extra` : undefined}
            />
            <UsageBar
              icon={<Globe className="w-4 h-4" />}
              label="Con browsing"
              used={browsingUsed}
              max={browsingLimit}
              extra={extraBrowsing > 0 ? `+${extraBrowsing} extra` : undefined}
            />
            <UsageBar
              icon={<GitCompare className="w-4 h-4" />}
              label="Confronti"
              used={comparisonsUsed}
              max={comparisonsLimit}
              extra={extraComparisons > 0 ? `+${extraComparisons} extra` : undefined}
            />
            <UsageBar
              icon={<Link2 className="w-4 h-4" />}
              label="Analisi URL"
              used={0}
              max={50}
            />
            <UsageBar
              icon={<MessageSquareText className="w-4 h-4" />}
              label="Analisi Contesti AI"
              used={0}
              max={5}
            />
          </>
        )}
      </div>

      {/* ─── Extra packages (Base & Pro only) ─── */}
      {packages.length > 0 && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground font-mono uppercase tracking-wider">Pacchetti extra</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {packages.map((pkg) => (
              <div
                key={pkg.priceEnv}
                className="flex flex-col justify-between p-4 rounded-[3px] border border-border"
                style={{ background: "var(--surface)" }}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{pkg.label}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-lg font-display font-bold text-foreground">&euro;{pkg.price}</p>
                    {pkg.note && <span className="text-[0.6rem] font-mono text-muted-foreground uppercase">{pkg.note}</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleBuyPackage(pkg.priceEnv)}
                  disabled={purchasingId !== null}
                  className="mt-3 w-full text-xs font-medium px-3 py-2 rounded-[2px] text-primary border border-primary/30 hover:bg-primary/5 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {purchasingId === pkg.priceEnv ? <Loader2 className="w-3 h-3 animate-spin" /> : "Acquista"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Plan comparison table ─── */}
      <div id="piani" className="scroll-mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-display tracking-tight text-foreground" style={{ fontWeight: 300 }}>
            Confronta i piani
          </h2>
          {/* Period toggle */}
          <div className="flex items-center gap-2">
            <span className={`text-xs transition-colors ${!annual ? "text-foreground font-medium" : "text-muted-foreground"}`}>Mensile</span>
            <button
              onClick={() => setAnnual(!annual)}
              className="relative w-10 h-5 rounded-full transition-colors"
              style={{ background: annual ? "var(--primary)" : "var(--border)" }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                style={{ left: annual ? "22px" : "2px" }}
              />
            </button>
            <span className={`text-xs transition-colors ${annual ? "text-foreground font-medium" : "text-muted-foreground"}`}>Annuale</span>
          </div>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-muted-foreground w-[40%]">Funzionalità</th>
                <th className="text-center px-4 py-3 w-[20%]">
                  <p className="text-foreground font-medium">Demo</p>
                  <p className="text-xs text-muted-foreground">Gratuito</p>
                </th>
                <th className="text-center px-4 py-3 w-[20%]" style={{ background: isBase ? "rgba(126,184,154,0.04)" : undefined }}>
                  <p className="text-foreground font-medium">Base</p>
                  <p className="text-xs text-primary font-medium">{annual ? "€649/anno" : "€59/mese"}</p>
                </th>
                <th className="text-center px-4 py-3 w-[20%]" style={{ background: isPro ? "rgba(126,184,154,0.04)" : undefined }}>
                  <p className="text-foreground font-medium">Pro</p>
                  <p className="text-xs text-primary font-medium">{annual ? "€1.719/anno" : "€159/mese"}</p>
                </th>
              </tr>
            </thead>
            <tbody>
              {TABLE_FEATURES.map((row, i) => (
                <tr key={row.label} className={i < TABLE_FEATURES.length - 1 ? "border-b border-border/50" : ""}>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{row.label}</td>
                  <td className="px-4 py-3 text-center"><FeatureCell value={row.demo} /></td>
                  <td className="px-4 py-3 text-center" style={{ background: isBase ? "rgba(126,184,154,0.02)" : undefined }}><FeatureCell value={row.base} /></td>
                  <td className="px-4 py-3 text-center" style={{ background: isPro ? "rgba(126,184,154,0.02)" : undefined }}><FeatureCell value={row.pro} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Current plan indicator */}
          <div className="border-t border-border px-4 py-3 flex items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">Piano attuale:</span>
            <span className="text-xs font-medium text-primary">{label}</span>
          </div>
        </div>
      </div>

      {/* ─── Cancel subscription ─── */}
      {hasActiveSubscription && (
        <div className="text-center py-4">
          <button
            onClick={() => setShowCancelModal(true)}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2"
          >
            Vuoi cancellare il tuo abbonamento?
          </button>
        </div>
      )}

      {/* Cancel modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCancelModal(false)}>
          <div className="bg-ink border border-destructive/30 rounded-[3px] p-6 w-[400px] space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium text-foreground">Cancella abbonamento</h3>
            <p className="text-sm text-muted-foreground">
              Sei sicuro di voler cancellare il tuo abbonamento? Rimarrà attivo fino alla fine del periodo di fatturazione corrente, dopodiché tornerai al piano Demo.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-sm px-4 py-2 rounded-[2px] border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                Indietro
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={canceling}
                className="text-sm px-4 py-2 rounded-[2px] bg-destructive text-white hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {canceling && <Loader2 className="w-4 h-4 animate-spin" />}
                Conferma cancellazione
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Usage bar ─── */

function UsageBar({ icon, label, used, max, extra }: {
  icon: React.ReactNode;
  label: string;
  used: number;
  max: number;
  extra?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm text-foreground">{label}</span>
        </div>
        <span className="text-sm text-foreground font-medium">{used} / {max}</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted/60 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: max > 0 ? `${Math.min(100, (used / max) * 100)}%` : "0%",
            background: barColor(used, max),
            minWidth: used > 0 && max > 0 ? "4px" : undefined,
          }}
        />
      </div>
      {extra && <p className="text-xs text-primary">{extra}</p>}
    </div>
  );
}
