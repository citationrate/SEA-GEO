"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Sparkles, Loader2, Plus, X,
  ChevronLeft, MessageCircleQuestion, Check,
  AlertTriangle, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { type GenerationInputs, type GeneratedQuery } from "@/lib/query-generator";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useTranslation } from "@/lib/i18n/context";

type Step = 1 | 2 | 3;

const FUNNEL_COLORS: Record<string, string> = {
  TOFU: "border-primary/30 text-primary",
  MOFU: "border-[#7eb89a]/30 text-[#7eb89a]",
};

const QUERY_COUNT_OPTIONS = [
  { value: 5, label: "5 query", descKey: "generateQueries.quick" },
  { value: 10, label: "10 query", descKey: "generateQueries.recommended" },
  { value: 20, label: "20 query", descKey: "generateQueries.detailed" },
  { value: 50, label: "50 query", descKey: "generateQueries.complete" },
];

export default function GenerateQueriesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  // Luogo della rilevazione passato come URL param dalla pagina /queries.
  // Pre-popola il campo luogo (gia' nello state) cosi' le query AI sono
  // circoscritte al territorio scelto.
  const luogoParam = searchParams.get("luogo")?.trim() || "";

  const { t, locale } = useTranslation();

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [planId, setPlanId] = useState<string>("demo");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [existingQueryCount, setExistingQueryCount] = useState(0);

  // Step 1: Inputs
  const [genMode, setGenMode] = useState<"generali" | "specifiche">("generali");
  const [theme, setTheme] = useState("");
  const [themeContext, setThemeContext] = useState("");
  const [categoria, setCategoria] = useState("");
  const [mercato, setMercato] = useState("");
  const [luogo, setLuogo] = useState("");
  const [puntiDiForza, setPuntiDiForza] = useState<string[]>([]);
  const [puntiInput, setPuntiInput] = useState("");
  const [obiezioni, setObiezioni] = useState<string[]>([]);
  const [obiezioniInput, setObiezioniInput] = useState("");

  // AI conversational intake
  const [aiQuestionsLoading, setAiQuestionsLoading] = useState(false);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [aiAnswers, setAiAnswers] = useState<string[]>(["", "", ""]);
  const [showAiIntake, setShowAiIntake] = useState(false);

  // Step 2: Query count & TOFU/MOFU split
  const [queryCount, setQueryCount] = useState(10);
  const [customCount, setCustomCount] = useState(30);
  const [tofuPercent, setTofuPercent] = useState(60);
  const isDemoPlan = planId === "demo";

  // Step 3: Preview
  const [generatedQueries, setGeneratedQueries] = useState<GeneratedQuery[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);

  // Fetch pro status & existing queries on mount
  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((p) => {
      const plan = p?.plan ?? "demo";
      setPlanId(plan === "demo" ? "demo" : plan === "base" ? "base" : plan === "pro" ? "pro" : plan === "enterprise" ? "enterprise" : "demo");
      setIsPro(plan === "pro" || plan === "enterprise");
      // Demo plan: le query sono FISSE a 2 (set da /demo-setup auto-flow).
      // Le opzioni 5/10/20/50/custom della UI valgono per Base/Pro/Enterprise;
      // se un demo user atterra qui, vede comunque le 4 opzioni ma tutte
      // mostrano "Limite raggiunto" perché monthlyLimit demo = 2 → segnale
      // chiaro che la rigenerazione manuale è gated dietro l'upgrade.
      if (plan === "demo") setQueryCount(2);
    }).catch(() => {}).finally(() => setProfileLoaded(true));

    fetch(`/api/queries?project_id=${projectId}`).then((r) => r.json()).then((qs) => {
      if (Array.isArray(qs)) setExistingQueryCount(qs.filter((q: any) => q.is_active !== false).length);
    }).catch(() => {});

    // Prefill della categoria dal sector del progetto: snellisce un campo
    // perché l'utente di solito ripete quello che gia' c'è nel progetto.
    fetch(`/api/projects/${projectId}`).then((r) => r.json()).then((proj) => {
      if (proj?.sector && !categoria) setCategoria(proj.sector);
    }).catch(() => {});

    // Luogo passato dalla pagina /queries (input "Luogo della rilevazione"):
    // pre-popola il campo. Se gia' valorizzato, non sovrascrivere.
    if (luogoParam && !luogo) setLuogo(luogoParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, luogoParam]);

  // Auto-AI-intake: appena il trigger (categoria in "generali", tema in
  // "specifiche") e' stabile (>=3 char, debounce 1500ms), chiama
  // generateAiQuestions in modo che le 3 domande appaiano da sole.
  // In "specifiche" anche themeContext influenza la generazione, ma solo
  // se le 3 domande non sono ancora apparse — non re-triggera dopo.
  useEffect(() => {
    const trigger = genMode === "specifiche" ? theme.trim() : categoria.trim();
    if (trigger.length < 3 || showAiIntake || aiQuestionsLoading || aiQuestions.length > 0) return;
    const t = setTimeout(() => { generateAiQuestions(); }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoria, theme, themeContext, genMode]);

  // Cambio di modalita': reset delle 3 domande AI per rigenerarle sul nuovo
  // contesto (brand-360 vs theme-focused).
  useEffect(() => {
    setShowAiIntake(false);
    setAiQuestions([]);
    setAiAnswers(["", "", ""]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genMode]);

  // Enterprise: effectively unlimited per Piano table ("Generazione query AI" = ✓).
  // Cap at 9999 just to keep the math finite (backend has no monthly limit).
  // Demo: query fisse a 2 (auto-flow /demo-setup), no rigenerazione manuale.
  const monthlyLimit = planId === "enterprise" ? 9999 : planId === "pro" ? 500 : planId === "base" ? 100 : 2;
  const usedThisMonth = existingQueryCount;

  function buildInputs(): GenerationInputs & { mode?: "generali" | "specifiche"; theme?: string; theme_context?: string } {
    // In "specifiche" la categoria non è in UI: lasciamo che sia il server a
    // fare fallback su project.sector / site_analysis (vedi
    // app/api/queries/generate/route.ts). Qui mandiamo quel che abbiamo.
    return {
      categoria: categoria || (genMode === "specifiche" ? theme.trim() : ""),
      mode: genMode,
      theme: genMode === "specifiche" ? (theme.trim() || undefined) : undefined,
      theme_context: genMode === "specifiche" ? (themeContext.trim() || undefined) : undefined,
      mercato: mercato || undefined,
      luogo: luogo || undefined,
      punti_di_forza: puntiDiForza,
      competitor: [],
      obiezioni,
      ai_answers: aiAnswers.filter((a) => a.trim()),
      personas_enabled: false,
      personas: [],
    };
  }

  function addTag(list: string[], setter: (v: string[]) => void, input: string, inputSetter: (v: string) => void) {
    const val = input.trim();
    if (val && !list.includes(val)) setter([...list, val]);
    inputSetter("");
  }

  function removeTag(list: string[], setter: (v: string[]) => void, idx: number) {
    setter(list.filter((_, i) => i !== idx));
  }

  function goToStep2() {
    if (genMode === "specifiche") {
      if (!theme.trim()) { toast.error(t("generateQueries.insertCategory")); return; }
    } else if (!categoria.trim()) { toast.error(t("generateQueries.insertCategory")); return; }
    setStep(2);
  }

  const [generating, setGenerating] = useState(false);

  async function goToStep3() {
    const targetCount = queryCount === -1 ? customCount : queryCount;
    setGenerating(true);
    try {
      const res = await fetch("/api/queries/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          count: targetCount,
          tofu_pct: tofuPercent,
          mode: genMode,
          theme: genMode === "specifiche" ? (theme.trim() || undefined) : undefined,
          theme_context: genMode === "specifiche" ? (themeContext.trim() || undefined) : undefined,
          categoria: categoria.trim() || undefined,
          mercato: mercato.trim() || undefined,
          luogo: luogo.trim() || undefined,
          punti_di_forza: puntiDiForza.length > 0 ? puntiDiForza : undefined,
          obiezioni: obiezioni.length > 0 ? obiezioni : undefined,
          lang: locale,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("common.error"));
      }
      const data = await res.json();
      const aiQueries: GeneratedQuery[] = (data.queries ?? []).map((q: any) => ({
        text: q.text,
        set_type: "generale" as const,
        funnel_stage: q.funnel_stage === "MOFU" ? "MOFU" as const : "TOFU" as const,
      }));

      setGeneratedQueries(aiQueries);
      setSelectedIndexes(new Set(aiQueries.map((_: any, i: number) => i)));
      setStep(3);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("generateQueries.saveError"));
    } finally {
      setGenerating(false);
    }
  }

  function toggleQuery(idx: number) {
    const next = new Set(selectedIndexes);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedIndexes(next);
  }

  async function regenerateOne(idx: number) {
    if (regeneratingIdx !== null) return;
    const current = generatedQueries[idx];
    if (!current) return;
    setRegeneratingIdx(idx);
    try {
      const excludeTexts = generatedQueries.map((q) => q.text);
      const res = await fetch("/api/queries/ai-regenerate-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          funnel_stage: current.funnel_stage,
          exclude_texts: excludeTexts,
          mode: genMode,
          theme: genMode === "specifiche" ? (theme.trim() || undefined) : undefined,
          theme_context: genMode === "specifiche" ? (themeContext.trim() || undefined) : undefined,
          categoria: categoria.trim() || undefined,
          mercato: mercato.trim() || undefined,
          luogo: luogo.trim() || undefined,
          punti_di_forza: puntiDiForza.length > 0 ? puntiDiForza : undefined,
          obiezioni: obiezioni.length > 0 ? obiezioni : undefined,
          lang: locale,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("common.error"));
      }
      const data = await res.json();
      if (data?.query?.text) {
        setGeneratedQueries((prev) => prev.map((p, i) => i === idx ? {
          ...p,
          text: data.query.text,
          funnel_stage: data.query.funnel_stage === "MOFU" ? "MOFU" : "TOFU",
        } : p));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setRegeneratingIdx(null);
    }
  }

  function toggleAll() {
    if (selectedIndexes.size === generatedQueries.length) {
      setSelectedIndexes(new Set());
    } else {
      setSelectedIndexes(new Set(generatedQueries.map((_, i) => i)));
    }
  }

  const activeQueries = generatedQueries.filter((_, i) => selectedIndexes.has(i));

  async function saveQueries() {
    if (activeQueries.length === 0) return;
    setSaving(true);
    try {
      const inputs = buildInputs();
      const res = await fetch("/api/queries/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, queries: activeQueries, inputs }),
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || t("common.error"));
      }
      const skipped = resData.skipped ?? 0;
      const saved = resData.count ?? activeQueries.length;
      const msg = skipped > 0
        ? `${saved} ${t("generateQueries.queriesSaved")} (${skipped} duplicati saltati)`
        : `${saved} ${t("generateQueries.queriesSaved")}`;
      toast.success(msg);
      router.push(`/projects/${projectId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("generateQueries.saveError"));
    } finally {
      setSaving(false);
    }
  }

  // AI conversational intake
  async function generateAiQuestions() {
    setAiQuestionsLoading(true);
    try {
      const res = await fetch("/api/ai/brand-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          categoria,
          mercato,
          punti_di_forza: puntiDiForza,
          obiezioni,
          lang: locale,
          mode: genMode,
          theme: genMode === "specifiche" ? theme : undefined,
          theme_context: genMode === "specifiche" ? themeContext : undefined,
        }),
      });
      if (!res.ok) throw new Error(t("common.error"));
      const data = await res.json();
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        setAiQuestions(data.questions.slice(0, 3));
        setAiAnswers(["", "", ""]);
        setShowAiIntake(true);
      }
    } catch {
      toast.error(t("generateQueries.aiQuestionsError"));
    } finally {
      setAiQuestionsLoading(false);
    }
  }

  // Remaining quota check
  const effectiveCount = queryCount === -1 ? customCount : queryCount;
  const wouldExceed = usedThisMonth + effectiveCount > monthlyLimit;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <a
          href={`/projects/${projectId}/queries`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("nav.backToQueries")}
        </a>
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-primary" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-2xl text-foreground">{t("settings.generatePromptAI")}</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("generateQueries.subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Wizard content */}
      <div className="space-y-6">

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: t("generateQueries.stepBrandContext") },
          { n: 2, label: t("generateQueries.stepHowMany") },
          { n: 3, label: t("generateQueries.stepPreview") },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            {i > 0 && <div className="w-6 h-px bg-border" />}
            <div className={`flex items-center gap-1.5 text-sm ${step >= s.n ? "text-foreground" : "text-muted-foreground"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                step === s.n ? "border-primary bg-primary text-primary-foreground"
                  : step > s.n ? "border-primary text-primary"
                  : "border-border text-muted-foreground"
              }`}>{s.n}</span>
              <span className="hidden sm:inline text-xs">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Step 1: Contesto Brand */}
      {/* ═══════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div data-tour="query-wizard-step1" className="card p-6 space-y-5">
          <h2 className="font-display font-semibold text-foreground">{t("generateQueries.stepBrandContext")}</h2>

          {/* Mode selector: Generali (360°) vs Specifiche (single theme) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {([
              { key: "generali" as const, labelKey: "generateQueries.modeGeneraliLabel", descKey: "generateQueries.modeGeneraliDesc" },
              { key: "specifiche" as const, labelKey: "generateQueries.modeSpecificheLabel", descKey: "generateQueries.modeSpecificheDesc" },
            ]).map((m) => {
              const isSelected = genMode === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setGenMode(m.key)}
                  className={`text-left px-4 py-3 rounded-sm border transition-all ${
                    isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                  }`}
                >
                  <p className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>{t(m.labelKey)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t(m.descKey)}</p>
                </button>
              );
            })}
          </div>

          {genMode === "specifiche" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  {t("generateQueries.themeLabel")} *
                  <InfoTooltip text={t("generateQueries.themeInfo")} />
                </label>
                <input
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder={t("generateQueries.themePlaceholder")}
                  className="input-base w-full"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  {t("generateQueries.themeContextLabel")}
                  <InfoTooltip text={t("generateQueries.themeContextInfo")} />
                </label>
                <textarea
                  value={themeContext}
                  onChange={(e) => setThemeContext(e.target.value)}
                  placeholder={t("generateQueries.themeContextPlaceholder")}
                  rows={3}
                  className="input-base w-full resize-y"
                />
              </div>
            </div>
          ) : (
          <>
          {/* Luogo della rilevazione */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              {t("generateQueries.placeOfDetectionLabel")}
              <InfoTooltip text={t("generateQueries.placeOfDetectionTooltip")} />
            </label>
            <input
              type="text"
              value={luogo}
              onChange={(e) => setLuogo(e.target.value)}
              placeholder={t("generateQueries.placeOfDetectionPlaceholder")}
              className="input-base w-full"
            />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              {t("generateQueries.category")} *
              <InfoTooltip text={t("generateQueries.categoryTooltip")} />
            </label>
            <input
              type="text"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder={t("generateQueries.categoryPlaceholder")}
              className="input-base w-full"
            />
          </div>

          {/* Caratteristiche distintive (ex Punti di forza) */}
          <TagInput
            label={t("generateQueries.strengths")}
            tooltip={t("generateQueries.strengthsTooltip")}
            tags={puntiDiForza}
            input={puntiInput}
            setInput={setPuntiInput}
            onAdd={() => addTag(puntiDiForza, setPuntiDiForza, puntiInput, setPuntiInput)}
            onRemove={(i) => removeTag(puntiDiForza, setPuntiDiForza, i)}
            placeholder={t("generateQueries.strengthsPlaceholder")}
          />

          {/* Considerazioni dei clienti (ex Obiezioni comuni) */}
          <TagInput
            label={t("generateQueries.objections")}
            tooltip={t("generateQueries.objectionsTooltip")}
            tags={obiezioni}
            input={obiezioniInput}
            setInput={setObiezioniInput}
            onAdd={() => addTag(obiezioni, setObiezioni, obiezioniInput, setObiezioniInput)}
            onRemove={(i) => removeTag(obiezioni, setObiezioni, i)}
            placeholder={t("generateQueries.objectionsPlaceholder")}
          />
          </>
          )}

          {/* AI Conversational Intake */}
          <div className="border-t border-border pt-5 space-y-3">
            {aiQuestionsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>{t("generateQueries.aiIntakeTitle")}…</span>
              </div>
            ) : showAiIntake && aiQuestions.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MessageCircleQuestion className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">{t("generateQueries.aiIntakeTitle")}</p>
                </div>
                <div className="rounded-[3px] border border-primary/20 bg-primary/5 px-3 py-2.5 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("generateQueries.aiIntakeBanner")}
                  </p>
                </div>
                {aiQuestions.map((q, i) => (
                  <div key={i} className="space-y-1.5 animate-fade-in" style={{ animationDelay: `${i * 150}ms` }}>
                    <p className="text-sm text-foreground italic">&ldquo;{q}&rdquo;</p>
                    <input
                      type="text"
                      value={aiAnswers[i] || ""}
                      onChange={(e) => {
                        const next = [...aiAnswers];
                        next[i] = e.target.value;
                        setAiAnswers(next);
                      }}
                      placeholder={t("generateQueries.yourAnswer")}
                      className="input-base w-full"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={goToStep2}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors"
            >
              {t("common.next")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Step 2: Quante query generare */}
      {/* ═══════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="card p-6 space-y-5">
          <h2 className="font-display font-semibold text-foreground">{t("generateQueries.howManyQueries")}</h2>

          {/* Demo plan: locked at 2 queries — la demo è pensata come assaggio,
              il volume cresce con Base/Pro. Mostriamo un'unica tile bloccata
              così l'utente non viene illuso di poter scegliere 5/10/20/50. */}
          {isDemoPlan ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative p-3 rounded-[2px] border border-primary bg-primary/10 text-center">
                <p className="text-lg font-display font-bold text-primary">2 query</p>
                <p className="text-xs text-muted-foreground">{t("generateQueries.quick")}</p>
              </div>
              <a
                href="/piano#piani"
                className="relative p-3 rounded-[2px] border border-dashed border-[#c4a882]/40 text-center hover:border-[#c4a882] transition-colors flex flex-col items-center justify-center"
              >
                <p className="text-sm font-display font-semibold text-[#c4a882]">
                  {t("generateQueries.upgradeBaseOrPro")}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">5 / 10 / 20 / 50 query</p>
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUERY_COUNT_OPTIONS.map((opt) => {
                const isSelected = queryCount === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setQueryCount(opt.value)}
                    className={`relative p-3 rounded-[2px] border text-center transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <p className={`text-lg font-display font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{t(opt.descKey)}</p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Custom count — non disponibile per il piano demo (query fisse a 2) */}
          {!isDemoPlan && (

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQueryCount(-1)}
              className={`flex items-center gap-2 text-sm px-3 py-2 rounded-[2px] border transition-all ${
                queryCount === -1
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              {t("generateQueries.custom")}
            </button>
            {queryCount === -1 && (
              <input
                type="number"
                min={1}
                max={500}
                value={customCount}
                onChange={(e) => setCustomCount(Math.min(500, Math.max(1, Number(e.target.value))))}
                className="input-base w-24"
              />
            )}
          </div>
          )}

          {/* Split TOFU/MOFU mantenuto internamente a 60/40 (default sensato per
              coprire awareness + comparison). Nascosto dalla UI: l'utente non
              deve pensare al funnel, l'engine ci pensa per coprire panoramica. */}

          {/* Limit warning (only if exceeded) */}
          {wouldExceed && (
            <div className="flex items-start gap-2 rounded-[2px] border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="text-xs text-destructive space-y-1">
                <p className="font-semibold">{t("generateQueries.limitReached")}</p>
                <p>{t("generateQueries.reduceOrUpgrade")}</p>
                {planId !== "pro" && planId !== "enterprise" && (
                  <a href="/piano#piani" className="inline-flex items-center gap-1 text-[#c4a882] hover:underline font-medium">
                    {planId === "demo" ? t("generateQueries.upgradeBaseOrPro") : t("generateQueries.upgradeProArrow")}
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {t("common.back")}
            </button>
            <button
              onClick={goToStep3}
              disabled={wouldExceed || generating}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? t("generateQueries.generationInProgress") : t("generateQueries.generatePreview")}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Step 3: Preview before saving */}
      {/* ═══════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Header with select all */}
          <div className="card p-4 flex items-center justify-between">
            <div className="text-sm">
              <span className="font-bold text-foreground">{selectedIndexes.size}</span>
              <span className="text-muted-foreground"> {t("generateQueries.queriesSelected")} </span>
              <span className="text-foreground">{generatedQueries.length}</span>
              <span className="text-muted-foreground"> {t("generateQueries.generated")}</span>
            </div>
            <button
              onClick={toggleAll}
              className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
            >
              {selectedIndexes.size === generatedQueries.length ? t("generateQueries.deselectAll") : t("generateQueries.selectAll")}
            </button>
          </div>

          {/* Lista unica delle query AI: TOFU/MOFU non sono piu' visibili in UI
              (rimangono nei dati per l'engine, ordinati TOFU prima poi MOFU). */}
          {generatedQueries.length > 0 && (
            <div className="card p-5 space-y-1.5">
              {generatedQueries
                .map((q, i) => ({ ...q, idx: i }))
                .sort((a, b) => {
                  // TOFU prima, MOFU dopo — mantiene ordine senza esporre la categoria
                  if (a.funnel_stage === b.funnel_stage) return a.idx - b.idx;
                  return a.funnel_stage === "TOFU" ? -1 : 1;
                })
                .map((q) => (
                  <QueryPreviewRow
                    key={q.idx}
                    query={q}
                    idx={q.idx}
                    selected={selectedIndexes.has(q.idx)}
                    regenerating={regeneratingIdx === q.idx}
                    regenDisabled={regeneratingIdx !== null && regeneratingIdx !== q.idx}
                    onToggle={toggleQuery}
                    onEdit={(idx, text) => {
                      setGeneratedQueries((prev) => prev.map((p, i) => i === idx ? { ...p, text } : p));
                    }}
                    onRegenerate={regenerateOne}
                  />
                ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {t("common.back")}
            </button>
            <button
              onClick={saveQueries}
              disabled={saving || activeQueries.length === 0}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {t("generateQueries.saveQueries")} {activeQueries.length} {t("generateQueries.queriesSelectedSuffix")} &rarr;
            </button>
          </div>
        </div>
      )}

      </div>{/* end wizard content wrapper */}
    </div>
  );
}

/* ─── Query preview row with inline edit + single-query regen ─── */
function QueryPreviewRow({
  query,
  idx,
  selected,
  regenerating,
  regenDisabled,
  onToggle,
  onEdit,
  onRegenerate,
}: {
  query: { text: string; funnel_stage: string };
  idx: number;
  selected: boolean;
  regenerating: boolean;
  regenDisabled: boolean;
  onToggle: (idx: number) => void;
  onEdit: (idx: number, text: string) => void;
  onRegenerate: (idx: number) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(query.text);

  // Keep the local edit buffer in sync if the query gets rigenerated upstream.
  useEffect(() => { setEditText(query.text); }, [query.text]);

  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-[2px] border transition-all ${
      selected ? "border-primary/30 bg-primary/5" : "border-border/50 opacity-50"
    }`}>
      <button type="button" onClick={() => onToggle(idx)} className="shrink-0 mt-0.5">
        <div className={`w-4 h-4 rounded-[2px] border-2 flex items-center justify-center transition-colors ${
          selected ? "border-primary bg-primary" : "border-muted-foreground"
        }`}>
          {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
        </div>
      </button>
      {editing ? (
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { onEdit(idx, editText); setEditing(false); }
              if (e.key === "Escape") { setEditText(query.text); setEditing(false); }
            }}
            className="input-base flex-1 text-sm"
            autoFocus
          />
          <button type="button" onClick={() => { onEdit(idx, editText); setEditing(false); }} className="text-primary text-xs font-semibold shrink-0">{t("common.ok")}</button>
          <button type="button" onClick={() => { setEditText(query.text); setEditing(false); }} className="text-muted-foreground text-xs shrink-0">{t("common.cancel")}</button>
        </div>
      ) : (
        <>
          <p
            className={`text-sm flex-1 cursor-pointer hover:text-primary transition-colors ${selected ? "text-foreground" : "text-muted-foreground line-through"} ${regenerating ? "opacity-50" : ""}`}
            onClick={() => !regenerating && setEditing(true)}
            title={t("queries.editTooltip")}
          >
            {query.text}
          </p>
          <button
            type="button"
            onClick={() => onRegenerate(idx)}
            disabled={regenerating || regenDisabled}
            title={t("generateQueries.regenerateTooltip")}
            className="shrink-0 mt-0.5 p-1 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
        </>
      )}
    </div>
  );
}

/* ─── Tag input sub-component ─── */
function TagInput({
  label,
  tooltip,
  tags,
  input,
  setInput,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string;
  tooltip?: string;
  tags: string[];
  input: string;
  setInput: (v: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
          placeholder={placeholder}
          className="input-base flex-1"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!input.trim()}
          className="bg-surface border border-border text-foreground p-2.5 rounded-[2px] hover:border-primary/30 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted border border-border rounded-[2px] px-2 py-1 text-foreground">
              {tag}
              <button type="button" onClick={() => onRemove(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
