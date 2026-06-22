"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Radar, Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";

const COUNTRIES = ["IT", "US", "GB", "ES", "FR", "DE"] as const;

// Country → prompt locale mapping (auto-derived; the user no longer picks it).
const COUNTRY_TO_LOCALE: Record<(typeof COUNTRIES)[number], string> = {
  IT: "it",
  US: "en",
  GB: "en",
  ES: "es",
  FR: "fr",
  DE: "de",
};

type Step = 1 | 2 | 3;

export function BrandProfileWizard({
  plan,
  remaining,
  runLimit,
}: {
  plan: string;
  remaining: number;
  runLimit: number;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [brand, setBrand] = useState("");
  const [brandUrl, setBrandUrl] = useState("");
  const [sector, setSector] = useState("");
  const [country, setCountry] = useState<(typeof COUNTRIES)[number]>("IT");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill dal progetto canonico della suite (UX unificata): l'utente trova
  // brand, sito, settore e paese già compilati e clicca solo avanti.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/canonical-project", { cache: "no-store" });
        if (!r.ok) return;
        const proj = (await r.json())?.project;
        if (!proj || cancelled) return;
        if (proj.brand) setBrand((b) => b || proj.brand);
        if (proj.primary_url) setBrandUrl((u) => u || proj.primary_url);
        if (proj.sector_label) setSector((s) => s || proj.sector_label);
        if (proj.country && (COUNTRIES as readonly string[]).includes(proj.country)) {
          setCountry((c) => (c === "IT" ? (proj.country as (typeof COUNTRIES)[number]) : c));
        }
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const stepTitles: Record<Step, string> = {
    1: t("brandProfile.step1Title"),
    2: t("brandProfile.step2Title"),
    3: t("brandProfile.step4Title"), // confirm — keep i18n key for backward compat
  };

  function validateStep(s: Step): string | null {
    if (s === 1) {
      if (brand.trim().length < 2) return t("brandProfile.validateBrand");
      if (sector.trim().length < 2) return t("brandProfile.validateSector");
    }
    if (s === 2) {
      const u = brandUrl.trim();
      if (!u) return t("brandProfile.validateUrlRequired");
      if (!/^https?:\/\//i.test(u)) return t("brandProfile.validateUrl");
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) return setError(err);
    setError(null);
    setStep((s) => Math.min(3, s + 1) as Step);
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(1, s - 1) as Step);
  }

  async function submit() {
    const err = validateStep(1) || validateStep(2);
    if (err) return setError(err);
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/brand-profile/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: brand.trim(),
          brand_url: brandUrl.trim(),
          sector: sector.trim(),
          country,
          locale: COUNTRY_TO_LOCALE[country],
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? t("brandProfile.errorUnknown"));
        setSubmitting(false);
        return;
      }
      router.push(`/brand-profile/${json.runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("brandProfile.errorNetwork"));
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/brand-profile" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2">
            <ArrowLeft className="w-3 h-3" />
            {t("brandProfile.backToRuns")}
          </Link>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <Radar className="w-6 h-6 text-primary" />
            {t("brandProfile.newRun")}
          </h1>
        </div>
        <div className="text-right text-xs text-muted-foreground shrink-0">
          <div className="uppercase tracking-wide">{t("brandProfile.runsRemaining")}</div>
          <div className="text-sm font-display font-semibold text-foreground">
            {runLimit >= 999 ? t("brandProfile.unlimited") : `${remaining} / ${runLimit}`}
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between gap-2 px-1">
        {([1, 2, 3] as Step[]).map((idx, i) => {
          const done = step > idx;
          const active = step === idx;
          return (
            <div key={idx} className="flex items-center flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                done
                  ? "bg-primary border-primary text-primary-foreground"
                  : active
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-surface-2 border-border text-muted-foreground"
              }`}>
                {done ? <Check className="w-3.5 h-3.5" /> : idx}
              </div>
              <div className={`ml-2 text-xs ${active ? "text-foreground font-medium" : "text-muted-foreground"} hidden md:block`}>
                {stepTitles[idx]}
              </div>
              {i < 2 && (
                <div className={`flex-1 h-px mx-3 ${done ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="card p-6 space-y-5">
        {step === 1 && (
          <>
            <h2 className="font-display text-lg font-semibold text-foreground">{t("brandProfile.step1Title")}</h2>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("brandProfile.brandLabel")} *</label>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder={t("brandProfile.brandPlaceholder")}
                maxLength={120}
                className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-[2px] text-base md:text-sm text-foreground focus:outline-none focus:border-primary"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">{t("brandProfile.brandHelp")}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("brandProfile.sectorLabel")} *</label>
              <input
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder={t("brandProfile.sectorPlaceholder")}
                maxLength={120}
                className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-[2px] text-base md:text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">{t("brandProfile.sectorHelp")}</p>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-display text-lg font-semibold text-foreground">{t("brandProfile.step2Title")}</h2>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("brandProfile.urlLabel")} *</label>
              <input
                value={brandUrl}
                onChange={(e) => setBrandUrl(e.target.value)}
                placeholder={t("brandProfile.urlPlaceholder")}
                className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-[2px] text-base md:text-sm text-foreground focus:outline-none focus:border-primary"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">{t("brandProfile.urlHelp")}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("brandProfile.countryLabel")}</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value as typeof country)}
                className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-[2px] text-base md:text-sm text-foreground focus:outline-none focus:border-primary"
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-display text-lg font-semibold text-foreground">{t("brandProfile.step4Title")}</h2>
            <div className="space-y-3">
              <ReviewRow label={t("brandProfile.reviewBrand")} value={brand} />
              <ReviewRow label={t("brandProfile.reviewSector")} value={sector} />
              <ReviewRow label={t("brandProfile.reviewUrl")} value={brandUrl} />
              <ReviewRow label={t("brandProfile.reviewCountry")} value={country} />
            </div>
            <div className="rounded-[2px] border border-primary/30 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
              {t("brandProfile.consumeWarning")}
              {runLimit < 999 && (
                <> {t("brandProfile.consumeRemainingPrefix")} <span className="text-foreground font-semibold">{remaining - 1}</span> {t("brandProfile.consumeRemainingMid")} {runLimit}.</>
              )}
            </div>
          </>
        )}

        {error && (
          <div className="px-3 py-2 rounded-[2px] bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={back}
            disabled={step === 1 || submitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[2px] border border-border text-sm text-foreground hover:bg-surface-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("brandProfile.btnBack")}
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[2px] bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              {t("brandProfile.btnNext")}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[2px] bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
              {submitting ? t("brandProfile.btnLaunching") : t("brandProfile.btnLaunch")}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm border-b border-border/60 pb-2 last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-foreground text-right break-words max-w-[60%]">{value}</span>
    </div>
  );
}
