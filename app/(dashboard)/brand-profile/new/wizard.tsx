"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radar, Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";

const COUNTRIES = ["IT", "US", "GB", "ES", "FR", "DE"] as const;
const LOCALES = [
  { value: "it", label: "Italiano" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
] as const;

const AVAILABLE_MODELS = [
  { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", provider: "OpenAI" },
  { id: "gpt-5.5", label: "GPT-5.5", provider: "OpenAI" },
  { id: "claude-haiku", label: "Claude Haiku 4.5", provider: "Anthropic" },
  { id: "claude-sonnet", label: "Claude Sonnet 4.6", provider: "Anthropic" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google" },
  { id: "perplexity-sonar", label: "Perplexity Sonar", provider: "Perplexity" },
  { id: "grok-3-mini", label: "Grok 3 Mini", provider: "xAI" },
] as const;

type Step = 1 | 2 | 3 | 4;

export function BrandProfileWizard({
  plan,
  modelCap,
  remaining,
  runLimit,
}: {
  plan: string;
  modelCap: number;
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
  const [locale, setLocale] = useState<string>("it");
  const [models, setModels] = useState<string[]>(["claude-haiku"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepTitles: Record<Step, string> = {
    1: t("brandProfile.step1Title"),
    2: t("brandProfile.step2Title"),
    3: t("brandProfile.step3Title"),
    4: t("brandProfile.step4Title"),
  };

  function toggleModel(id: string) {
    setModels((curr) => {
      if (curr.includes(id)) return curr.filter((m) => m !== id);
      if (curr.length >= modelCap) return curr;
      return [...curr, id];
    });
  }

  function validateStep(s: Step): string | null {
    if (s === 1) {
      if (brand.trim().length < 2) return t("brandProfile.validateBrand");
      if (sector.trim().length < 2) return t("brandProfile.validateSector");
    }
    if (s === 2) {
      if (brandUrl && !/^https?:\/\//i.test(brandUrl.trim())) {
        return t("brandProfile.validateUrl");
      }
    }
    if (s === 3) {
      if (models.length === 0) return t("brandProfile.validateModelsMin");
      if (models.length > modelCap) {
        return `${t("brandProfile.validateModelsMaxPrefix")} ${modelCap} ${t("brandProfile.validateModelsMaxSuffix")} ${plan}.`;
      }
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) return setError(err);
    setError(null);
    setStep((s) => Math.min(4, s + 1) as Step);
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(1, s - 1) as Step);
  }

  async function submit() {
    const err = validateStep(1) || validateStep(2) || validateStep(3);
    if (err) return setError(err);
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/brand-profile/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: brand.trim(),
          brand_url: brandUrl.trim() || null,
          sector: sector.trim(),
          country,
          locale,
          models,
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
          <p className="text-sm text-muted-foreground mt-1">
            {t("brandProfile.wizardSubtitle")}
          </p>
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
        {([1, 2, 3, 4] as Step[]).map((idx, i) => {
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
              {i < 3 && (
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
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-[2px] text-sm text-foreground focus:outline-none focus:border-primary"
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
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-[2px] text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">{t("brandProfile.sectorHelp")}</p>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-display text-lg font-semibold text-foreground">{t("brandProfile.step2Title")}</h2>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("brandProfile.urlLabel")}</label>
              <input
                value={brandUrl}
                onChange={(e) => setBrandUrl(e.target.value)}
                placeholder={t("brandProfile.urlPlaceholder")}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-[2px] text-sm text-foreground focus:outline-none focus:border-primary"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">{t("brandProfile.urlHelp")}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("brandProfile.countryLabel")}</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value as typeof country)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-[2px] text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("brandProfile.localeLabel")}</label>
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-[2px] text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  {LOCALES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-display text-lg font-semibold text-foreground">{t("brandProfile.step3Title")}</h2>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {t("brandProfile.planLabel")} <span className="text-foreground font-medium uppercase">{plan}</span> — {t("brandProfile.maxModelsLabel")} {modelCap}
              </span>
              <span>{models.length} / {modelCap} {t("brandProfile.selectedLabel")}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {AVAILABLE_MODELS.map((m) => {
                const selected = models.includes(m.id);
                const disabled = !selected && models.length >= modelCap;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleModel(m.id)}
                    disabled={disabled}
                    className={`px-3 py-3 rounded-[2px] border text-left transition-colors flex items-center justify-between ${
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : disabled
                          ? "border-border bg-surface-2 text-muted-foreground/50 cursor-not-allowed"
                          : "border-border bg-surface-2 text-foreground hover:border-primary/50"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium">{m.label}</div>
                      <div className="text-[11px] text-muted-foreground">{m.provider}</div>
                    </div>
                    {selected && <Check className="w-4 h-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="font-display text-lg font-semibold text-foreground">{t("brandProfile.step4Title")}</h2>
            <div className="space-y-3">
              <ReviewRow label={t("brandProfile.reviewBrand")} value={brand} />
              <ReviewRow label={t("brandProfile.reviewSector")} value={sector} />
              <ReviewRow label={t("brandProfile.reviewUrl")} value={brandUrl || "—"} />
              <ReviewRow label={t("brandProfile.reviewCountry")} value={country} />
              <ReviewRow label={t("brandProfile.reviewLocale")} value={LOCALES.find((l) => l.value === locale)?.label ?? locale} />
              <ReviewRow
                label={t("brandProfile.reviewModels")}
                value={
                  AVAILABLE_MODELS.filter((m) => models.includes(m.id))
                    .map((m) => m.label)
                    .join(", ")
                }
              />
              <ReviewRow label={t("brandProfile.reviewPrompts")} value={`${15 * models.length}`} />
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
          {step < 4 ? (
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
