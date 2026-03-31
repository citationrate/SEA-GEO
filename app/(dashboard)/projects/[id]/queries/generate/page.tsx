"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Sparkles, Loader2, Plus, X, Users,
  ChevronLeft, MessageCircleQuestion, Check, Eye,
  ToggleLeft, ToggleRight, Trash2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { type GenerationInputs, type GeneratedQuery, type Persona, type PersonaAttributes } from "@/lib/query-generator";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useTranslation } from "@/lib/i18n/context";

/* ─── Persona Templates (same as segments page) ─── */
const SESSO_OPTIONS = ["Maschile", "Femminile", "Non specificato"];
const ETA_OPTIONS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const ZONA_OPTIONS = ["Nord Italia", "Centro Italia", "Sud Italia", "Italia intera", "Europa", "Globale"];
const OCCUPAZIONE_OPTIONS = ["Dipendente", "Libero Professionista", "Imprenditore", "Manager", "Studente", "Pensionato"];
const TITOLO_OPTIONS = ["Tutti i livelli", "Scuola Secondaria", "Diploma", "Laurea Triennale", "Master / Dottorato"];
const REDDITO_OPTIONS = ["< 1.500\u20AC", "1.500-3.000\u20AC", "3.000-5.000\u20AC", "> 5.000\u20AC"];
const INTERESSI_OPTIONS = ["Sport", "Tecnologia", "Finanza", "Salute", "Viaggi", "Moda", "Casa", "Famiglia", "Automotive", "Gaming", "Arte", "Alimentazione"];
const VALORI_OPTIONS = ["Risparmio", "Qualit\u00E0", "Sostenibilit\u00E0", "Innovazione", "Tradizione", "Comodit\u00E0", "Status"];
const STILE_OPTIONS = ["Molto attivo", "Attivo", "Sedentario", "Digitale", "Ibrido"];

const PERSONA_TEMPLATES: { emoji: string; label: string; description: string; attrs: PersonaAttributes }[] = [
  { emoji: "\uD83E\uDDD1\u200D\uD83D\uDCBC", label: "Professionista Urbano", description: "30-44 anni, dipendente/manager, reddito medio-alto, Nord Italia, tech e finanza", attrs: { sesso: "Maschile", eta: ["30-44"], zona: ["Nord Italia"], occupazione: ["Dipendente", "Manager"], reddito: "3.000-5.000\u20AC", interessi: ["Tecnologia", "Finanza"], valori: ["Qualit\u00E0", "Innovazione"] } },
  { emoji: "\uD83D\uDC74", label: "Pensionato Attivo", description: "55-65+ anni, pensionato, reddito basso, Centro/Sud, salute e famiglia", attrs: { sesso: "Maschile", eta: ["55-64", "65+"], zona: ["Centro Italia", "Sud Italia"], occupazione: ["Pensionato"], reddito: "< 1.500\u20AC", interessi: ["Salute", "Famiglia"], valori: ["Tradizione", "Risparmio"] } },
  { emoji: "\uD83C\uDF93", label: "Giovane Professionista", description: "Donna 25-34, libera professionista, viaggi e moda, sostenibilit\u00E0", attrs: { sesso: "Femminile", eta: ["25-34"], zona: ["Italia intera"], occupazione: ["Libero Professionista"], titolo_studio: "Laurea", reddito: "1.500-3.000\u20AC", interessi: ["Viaggi", "Moda"], valori: ["Sostenibilit\u00E0"] } },
  { emoji: "\uD83D\uDC69\u200D\uD83D\uDC67", label: "Genitore Pratico", description: "Donna 35-44, dipendente, Sud Italia, casa e famiglia, risparmio", attrs: { sesso: "Femminile", eta: ["35-44"], zona: ["Sud Italia"], occupazione: ["Dipendente"], reddito: "1.500-3.000\u20AC", interessi: ["Casa", "Famiglia"], valori: ["Risparmio", "Comodit\u00E0"] } },
  { emoji: "\uD83D\uDE80", label: "Imprenditore Digitale", description: "Uomo 30-44, imprenditore, reddito alto, tech e automotive, innovazione", attrs: { sesso: "Maschile", eta: ["30-44"], zona: ["Nord Italia"], occupazione: ["Imprenditore"], reddito: "> 5.000\u20AC", interessi: ["Tecnologia", "Automotive"], valori: ["Innovazione", "Status"] } },
  { emoji: "\uD83C\uDFAE", label: "Giovane Studente", description: "18-24, studente, gaming e tech, risparmio, occasionale", attrs: { eta: ["18-24"], occupazione: ["Studente"], reddito: "< 1.500\u20AC", zona: ["Italia intera"], interessi: ["Gaming", "Tecnologia"], valori: ["Risparmio"] } },
];

function generatePromptContext(name: string, a: PersonaAttributes): string {
  const parts: string[] = [];
  const sessoLabel = a.sesso === "Maschile" ? "un uomo" : a.sesso === "Femminile" ? "una donna" : null;
  const etaStr = a.eta?.length ? `di ${a.eta.join("/")} anni` : null;
  if (sessoLabel && etaStr) parts.push(`Sono ${sessoLabel} ${etaStr}`);
  else if (sessoLabel) parts.push(`Sono ${sessoLabel}`);
  else if (etaStr) parts.push(`Ho ${a.eta!.join("/")} anni`);
  if (a.occupazione?.length) parts.push(`lavoro come ${a.occupazione.join("/").toLowerCase()}`);
  if (a.titolo_studio) parts.push(`con titolo di studio: ${a.titolo_studio.toLowerCase()}`);
  if (a.reddito) parts.push(`con un reddito ${a.reddito}`);
  if (a.zona?.length) parts.push(`e vivo in ${a.zona.join(", ")}`);
  if (a.interessi?.length) parts.push(`Mi interessano ${a.interessi.join(", ").toLowerCase()}`);
  if (a.valori?.length) parts.push(`do valore a ${a.valori.join(", ").toLowerCase()}`);
  if (a.stile_vita?.length) parts.push(`il mio stile di vita \u00E8 ${a.stile_vita.join(", ").toLowerCase()}`);
  if (parts.length === 0) return "";
  return parts.join(". ").replace(/\.\./g, ".") + ".";
}

function summarizeAttrs(a: PersonaAttributes | undefined): string {
  if (!a) return "";
  const bits: string[] = [];
  if (a.sesso) bits.push(a.sesso);
  if (a.eta?.length) bits.push(a.eta.join(", "));
  if (a.zona?.length) bits.push(a.zona.join(", "));
  if (a.occupazione?.length) bits.push(a.occupazione.join(", "));
  if (a.reddito) bits.push(a.reddito);
  return bits.join(" \u2022 ");
}

type Step = 1 | 2 | 3 | 4;

const SET_TYPE_COLORS: Record<string, string> = {
  generale: "border-muted-foreground/30 text-muted-foreground bg-muted-foreground/5",
  verticale: "border-blue-500/30 text-blue-400 bg-blue-500/5",
  persona: "border-purple-500/30 text-purple-400 bg-purple-500/5",
};

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
  const projectId = params.id as string;

  const { t, locale } = useTranslation();

  const OPTION_LABELS: Record<string, string> = {
    // Gender
    "Maschile": t("generateQueries.genderMale"),
    "Femminile": t("generateQueries.genderFemale"),
    "Non specificato": t("generateQueries.genderUnspecified"),
    // Zona
    "Nord Italia": t("generateQueries.zonaNorth"),
    "Centro Italia": t("generateQueries.zonaCenter"),
    "Sud Italia": t("generateQueries.zonaSouth"),
    "Italia intera": t("generateQueries.zonaAll"),
    "Europa": t("generateQueries.zonaEurope"),
    "Globale": t("generateQueries.zonaGlobal"),
    // Occupazione
    "Dipendente": t("generateQueries.occEmployee"),
    "Libero Professionista": t("generateQueries.occFreelance"),
    "Imprenditore": t("generateQueries.occEntrepreneur"),
    "Manager": t("generateQueries.occManager"),
    "Studente": t("generateQueries.occStudent"),
    "Pensionato": t("generateQueries.occRetired"),
    // Titolo studio
    "Tutti i livelli": t("generateQueries.eduAll"),
    "Scuola Secondaria": t("generateQueries.eduSecondary"),
    "Diploma": t("generateQueries.eduDiploma"),
    "Laurea Triennale": t("generateQueries.eduBachelor"),
    "Master / Dottorato": t("generateQueries.eduMaster"),
    // Interessi
    "Sport": t("generateQueries.intSport"),
    "Tecnologia": t("generateQueries.intTech"),
    "Finanza": t("generateQueries.intFinance"),
    "Salute": t("generateQueries.intHealth"),
    "Viaggi": t("generateQueries.intTravel"),
    "Moda": t("generateQueries.intFashion"),
    "Casa": t("generateQueries.intHome"),
    "Famiglia": t("generateQueries.intFamily"),
    "Automotive": t("generateQueries.intAutomotive"),
    "Gaming": t("generateQueries.intGaming"),
    "Arte": t("generateQueries.intArt"),
    "Alimentazione": t("generateQueries.intFood"),
    // Valori
    "Risparmio": t("generateQueries.valSaving"),
    "Qualità": t("generateQueries.valQuality"),
    "Sostenibilità": t("generateQueries.valSustainability"),
    "Innovazione": t("generateQueries.valInnovation"),
    "Tradizione": t("generateQueries.valTradition"),
    "Comodità": t("generateQueries.valComfort"),
    "Status": t("generateQueries.valStatus"),
    // Stile vita
    "Molto attivo": t("generateQueries.styleVeryActive"),
    "Attivo": t("generateQueries.styleActive"),
    "Sedentario": t("generateQueries.styleSedentary"),
    "Digitale": t("generateQueries.styleDigital"),
    "Ibrido": t("generateQueries.styleHybrid"),
  };
  const optLabel = (v: string) => OPTION_LABELS[v] || v;

  const PERSONA_TEMPLATE_LABELS: Record<string, { label: string; description: string }> = {
    "Professionista Urbano": { label: t("generateQueries.tplUrbanProf"), description: t("generateQueries.tplUrbanProfDesc") },
    "Pensionato Attivo": { label: t("generateQueries.tplActiveRetiree"), description: t("generateQueries.tplActiveRetireeDesc") },
    "Giovane Professionista": { label: t("generateQueries.tplYoungProf"), description: t("generateQueries.tplYoungProfDesc") },
    "Genitore Pratico": { label: t("generateQueries.tplPracticalParent"), description: t("generateQueries.tplPracticalParentDesc") },
    "Imprenditore Digitale": { label: t("generateQueries.tplDigitalEntrepreneur"), description: t("generateQueries.tplDigitalEntrepreneurDesc") },
    "Giovane Studente": { label: t("generateQueries.tplYoungStudent"), description: t("generateQueries.tplYoungStudentDesc") },
  };

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [planId, setPlanId] = useState<string>("demo");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [existingQueryCount, setExistingQueryCount] = useState(0);

  // Step 1: Inputs
  const [categoria, setCategoria] = useState("");
  const [mercato, setMercato] = useState("");
  const [luogo, setLuogo] = useState("");
  const [puntiDiForza, setPuntiDiForza] = useState<string[]>([]);
  const [puntiInput, setPuntiInput] = useState("");
  const [competitor, setCompetitor] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState("");
  const [obiezioni, setObiezioni] = useState<string[]>([]);
  const [obiezioniInput, setObiezioniInput] = useState("");

  // AI conversational intake
  const [aiQuestionsLoading, setAiQuestionsLoading] = useState(false);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [aiAnswers, setAiAnswers] = useState<string[]>(["", "", ""]);
  const [showAiIntake, setShowAiIntake] = useState(false);

  // Step 2: Personas
  const [personasEnabled, setPersonasEnabled] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);

  // Step 3: Query count & TOFU/MOFU split
  const [queryCount, setQueryCount] = useState(10);
  const [customCount, setCustomCount] = useState(30);
  const [tofuPercent, setTofuPercent] = useState(60);

  // Step 4: Preview
  const [generatedQueries, setGeneratedQueries] = useState<GeneratedQuery[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());

  // Fetch pro status & existing queries on mount
  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((p) => {
      const plan = p?.plan ?? "demo";
      setPlanId(plan === "demo" ? "demo" : plan === "base" ? "base" : plan === "pro" ? "pro" : "demo");
      setIsPro(plan === "pro");
    }).catch(() => {}).finally(() => setProfileLoaded(true));

    fetch(`/api/queries?project_id=${projectId}`).then((r) => r.json()).then((qs) => {
      if (Array.isArray(qs)) setExistingQueryCount(qs.length);
    }).catch(() => {});
  }, [projectId]);

  const monthlyLimit = planId === "pro" ? 500 : planId === "base" ? 100 : 40;
  const usedThisMonth = existingQueryCount;

  function buildInputs(): GenerationInputs {
    return {
      categoria,
      mercato: mercato || undefined,
      luogo: luogo || undefined,
      punti_di_forza: puntiDiForza,
      competitor,
      obiezioni,
      ai_answers: aiAnswers.filter((a) => a.trim()),
      personas_enabled: personasEnabled,
      personas,
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

  const [personaDrawerOpen, setPersonaDrawerOpen] = useState(false);

  function addPersonaFromTemplate(tpl: typeof PERSONA_TEMPLATES[number]) {
    if (personas.length >= 3) return;
    const attrs = tpl.attrs;
    const prompt = generatePromptContext(tpl.label, attrs);
    setPersonas([...personas, {
      id: crypto.randomUUID(),
      nome: tpl.label,
      prompt_context: prompt,
      persona_attributes: attrs,
    }]);
    if (!personasEnabled) setPersonasEnabled(true);
  }

  function addCustomPersona(nome: string, attrs: PersonaAttributes) {
    if (personas.length >= 3) return;
    const prompt = generatePromptContext(nome, attrs);
    setPersonas([...personas, {
      id: crypto.randomUUID(),
      nome,
      prompt_context: prompt,
      persona_attributes: attrs,
    }]);
    if (!personasEnabled) setPersonasEnabled(true);
  }

  function removePersona(idx: number) {
    setPersonas(personas.filter((_, i) => i !== idx));
  }

  function goToStep2() {
    if (!categoria.trim()) { toast.error(t("generateQueries.insertCategory")); return; }
    setStep(2);
  }

  function goToStep3() { setStep(3); }

  const [generating, setGenerating] = useState(false);

  async function goToStep4() {
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
          categoria: categoria.trim() || undefined,
          mercato: mercato.trim() || undefined,
          luogo: luogo.trim() || undefined,
          punti_di_forza: puntiDiForza.length > 0 ? puntiDiForza : undefined,
          competitor: competitor.length > 0 ? competitor : undefined,
          obiezioni: obiezioni.length > 0 ? obiezioni : undefined,
          personas: personasEnabled && personas.length > 0 ? personas : undefined,
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
      setStep(4);
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
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("common.error"));
      }
      toast.success(`${activeQueries.length} ${t("generateQueries.queriesSaved")}`);
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
          categoria,
          mercato,
          punti_di_forza: puntiDiForza,
          competitor,
          obiezioni,
          lang: locale,
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
          { n: 2, label: t("generateQueries.stepPersonas") },
          { n: 3, label: t("generateQueries.stepHowMany") },
          { n: 4, label: t("generateQueries.stepPreview") },
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

          {/* Mercato */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              {t("generateQueries.market")} *
              <InfoTooltip text={t("generateQueries.marketTooltip")} />
            </label>
            <input
              type="text"
              value={mercato}
              onChange={(e) => setMercato(e.target.value)}
              placeholder={t("generateQueries.marketPlaceholder")}
              className="input-base w-full"
            />
          </div>

          {/* Luogo */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              {t("generateQueries.place")}
              <InfoTooltip text={t("generateQueries.placeTooltip")} />
            </label>
            <input
              type="text"
              value={luogo}
              onChange={(e) => setLuogo(e.target.value)}
              placeholder={t("generateQueries.placePlaceholder")}
              className="input-base w-full"
            />
          </div>

          {/* Punti di forza */}
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

          {/* Principali competitor */}
          <TagInput
            label={t("generateQueries.mainCompetitors")}
            tooltip={t("generateQueries.competitorsTooltip")}
            tags={competitor}
            input={competitorInput}
            setInput={setCompetitorInput}
            onAdd={() => addTag(competitor, setCompetitor, competitorInput, setCompetitorInput)}
            onRemove={(i) => removeTag(competitor, setCompetitor, i)}
            placeholder={t("generateQueries.competitorsFieldPlaceholder")}
          />

          {/* Obiezioni comuni */}
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

          {/* AI Conversational Intake */}
          <div className="border-t border-border pt-5 space-y-3">
            {!showAiIntake ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground font-medium">
                    {t("generateQueries.aiIntakeQuestion")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("generateQueries.aiIntakeOptional")}</p>
                </div>
                <button
                  onClick={generateAiQuestions}
                  disabled={aiQuestionsLoading || !categoria.trim()}
                  className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50 shrink-0"
                >
                  {aiQuestionsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MessageCircleQuestion className="w-4 h-4" />
                  )}
                  {t("generateQueries.aiIntakeYes")} &rarr;
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MessageCircleQuestion className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">{t("generateQueries.aiIntakeTitle")}</p>
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
                <button
                  onClick={() => { setShowAiIntake(false); setAiQuestions([]); setAiAnswers(["", "", ""]); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("generateQueries.aiIntakeClose")}
                </button>
              </div>
            )}
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
      {/* Step 2: Personas & Pubblico Target */}
      {/* ═══════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-purple-400" />
              <h2 className="font-display font-semibold text-foreground">{t("generateQueries.personasTitle")}</h2>
              <InfoTooltip text={t("generateQueries.personasTooltip")} />
            </div>

            <div className="rounded-[2px] border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("generateQueries.personasDesc")}
              </p>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => {
                  setPersonasEnabled(!personasEnabled);
                  if (personasEnabled) setPersonas([]);
                }}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${personasEnabled ? "bg-purple-500" : "bg-border"}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-1/2 -translate-y-1/2 transition-transform duration-200 ${personasEnabled ? "translate-x-[22px]" : "translate-x-[2px]"}`} />
              </div>
              <span className="text-sm font-medium text-foreground">{t("generateQueries.activatePersonas")}</span>
              <span className="text-xs text-muted-foreground">(max 3)</span>
            </label>
          </div>

          {personasEnabled && (
            <>
              {/* Template cards */}
              {personas.length < 3 && (
                <div className="card p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    {t("segments.templates")}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PERSONA_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => addPersonaFromTemplate(tpl)}
                        disabled={personas.length >= 3}
                        className="card p-3 flex flex-col gap-1.5 hover:border-primary/40 transition-colors text-left disabled:opacity-40"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{tpl.emoji}</span>
                          <span className="font-display font-semibold text-xs text-foreground leading-tight">{PERSONA_TEMPLATE_LABELS[tpl.label]?.label ?? tpl.label}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">{PERSONA_TEMPLATE_LABELS[tpl.label]?.description ?? tpl.description}</p>
                      </button>
                    ))}
                  </div>
                  {personas.length < 3 && (
                    <button
                      type="button"
                      onClick={() => setPersonaDrawerOpen(true)}
                      className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      {t("segments.createCustom")}
                    </button>
                  )}
                </div>
              )}

              {/* Selected personas */}
              {personas.length > 0 && (
                <div className="card p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    {t("segments.myPersonas")} <span className="text-xs text-muted-foreground">({personas.length}/3)</span>
                  </h3>
                  <div className="space-y-2">
                    {personas.map((p, idx) => (
                      <div key={p.id} className="flex items-center gap-3 bg-muted rounded-[2px] px-4 py-3 border border-purple-500/20">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{p.nome || `Persona ${idx + 1}`}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {summarizeAttrs(p.persona_attributes)}
                          </p>
                          {p.prompt_context && (
                            <p className="text-xs text-foreground/60 italic mt-1 line-clamp-2">{p.prompt_context}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removePersona(idx)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
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
              className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors"
            >
              {t("common.next")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Custom persona drawer */}
          {personaDrawerOpen && (
            <PersonaBuilderDrawer
              onClose={() => setPersonaDrawerOpen(false)}
              onSave={(nome, attrs) => { addCustomPersona(nome, attrs); setPersonaDrawerOpen(false); }}
            />
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Step 3: Quante query generare */}
      {/* ═══════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="card p-6 space-y-5">
          <h2 className="font-display font-semibold text-foreground">{t("generateQueries.howManyQueries")}</h2>

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

          {/* Custom count */}
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

          {/* TOFU / MOFU split selector */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              {t("generateQueries.tofuMofuDistribution")}
              <InfoTooltip text={t("generateQueries.tofuMofuTooltip")} />
            </label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-primary">TOFU</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={tofuPercent}
                  onChange={(e) => setTofuPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="input-base w-16 text-center"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#7eb89a]">MOFU</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={100 - tofuPercent}
                  onChange={(e) => setTofuPercent(100 - Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="input-base w-16 text-center"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            {/* Visual bar */}
            <div className="h-2.5 rounded-full overflow-hidden flex bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${tofuPercent}%` }}
              />
              <div
                className="h-full bg-[#7eb89a] transition-all duration-300"
                style={{ width: `${100 - tofuPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[12px] text-muted-foreground">
              <span>{Math.round((queryCount === -1 ? customCount : queryCount) * tofuPercent / 100)} query TOFU</span>
              <span>{(queryCount === -1 ? customCount : queryCount) - Math.round((queryCount === -1 ? customCount : queryCount) * tofuPercent / 100)} query MOFU</span>
            </div>
          </div>

          {/* Usage bar */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {t("generateQueries.usedQueries")} <span className="text-foreground font-bold">{usedThisMonth}</span> / {monthlyLimit} {t("generateQueries.queriesThisMonth")}
              </span>
              <span className={`font-mono ${wouldExceed ? "text-destructive" : "text-muted-foreground"}`}>
                {planId === "pro" ? t("generateQueries.planPro") : planId === "base" ? t("generateQueries.planBase") : "DEMO"}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (usedThisMonth / monthlyLimit) * 100)}%`,
                  backgroundColor: wouldExceed ? "hsl(var(--destructive))" : "#7eb89a",
                }}
              />
            </div>
            {wouldExceed && (
              <div className="flex items-start gap-2 rounded-[2px] border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs text-destructive space-y-1">
                  <p className="font-semibold">Generazione bloccata — limite raggiunto</p>
                  <p>Hai utilizzato {usedThisMonth} / {monthlyLimit} query. Riduci il numero o passa a un piano superiore.</p>
                  {planId !== "pro" && (
                    <a href="/settings" className="inline-flex items-center gap-1 text-[#c4a882] hover:underline font-medium">
                      {planId === "demo" ? "Passa a Base o Pro →" : "Passa a Pro →"}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {t("common.back")}
            </button>
            <button
              onClick={goToStep4}
              disabled={wouldExceed || generating}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? "Generazione AI in corso..." : t("generateQueries.generatePreview")}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Step 4: Preview before saving */}
      {/* ═══════════════════════════════════════════════════════ */}
      {step === 4 && (
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

          {/* TOFU queries */}
          {(() => {
            const tofuQueries = generatedQueries.map((q, i) => ({ ...q, idx: i })).filter((q) => q.funnel_stage === "TOFU");
            const mofuQueries = generatedQueries.map((q, i) => ({ ...q, idx: i })).filter((q) => q.funnel_stage === "MOFU");
            return (
              <>
                {tofuQueries.length > 0 && (
                  <div className="card p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-[0.69rem] tracking-wide uppercase px-2 py-0.5 rounded-[2px] border ${FUNNEL_COLORS.TOFU}`}>TOFU</span>
                      <span className="text-xs text-muted-foreground">{tofuQueries.filter((q) => selectedIndexes.has(q.idx)).length}/{tofuQueries.length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {tofuQueries.map((q) => (
                        <QueryPreviewRow key={q.idx} query={q} idx={q.idx} selected={selectedIndexes.has(q.idx)} onToggle={toggleQuery} onEdit={(idx, text) => {
                          setGeneratedQueries((prev) => prev.map((p, i) => i === idx ? { ...p, text } : p));
                        }} />
                      ))}
                    </div>
                  </div>
                )}
                {mofuQueries.length > 0 && (
                  <div className="card p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-[0.69rem] tracking-wide uppercase px-2 py-0.5 rounded-[2px] border ${FUNNEL_COLORS.MOFU}`}>MOFU</span>
                      <span className="text-xs text-muted-foreground">{mofuQueries.filter((q) => selectedIndexes.has(q.idx)).length}/{mofuQueries.length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {mofuQueries.map((q) => (
                        <QueryPreviewRow key={q.idx} query={q} idx={q.idx} selected={selectedIndexes.has(q.idx)} onToggle={toggleQuery} onEdit={(idx, text) => {
                          setGeneratedQueries((prev) => prev.map((p, i) => i === idx ? { ...p, text } : p));
                        }} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(3)}
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

/* ─── Query preview row with inline edit ─── */
function QueryPreviewRow({
  query,
  idx,
  selected,
  onToggle,
  onEdit,
}: {
  query: { text: string; funnel_stage: string };
  idx: number;
  selected: boolean;
  onToggle: (idx: number) => void;
  onEdit: (idx: number, text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(query.text);

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
          <button type="button" onClick={() => { onEdit(idx, editText); setEditing(false); }} className="text-primary text-xs font-semibold shrink-0">OK</button>
          <button type="button" onClick={() => { setEditText(query.text); setEditing(false); }} className="text-muted-foreground text-xs shrink-0">Annulla</button>
        </div>
      ) : (
        <p
          className={`text-sm flex-1 cursor-pointer hover:text-primary transition-colors ${selected ? "text-foreground" : "text-muted-foreground line-through"}`}
          onClick={() => setEditing(true)}
          title="Clicca per modificare"
        >
          {query.text}
        </p>
      )}
    </div>
  );
}

/* ─── Chip sub-component ─── */
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-[2px] text-xs font-medium transition-all ${
        active
          ? "border border-primary text-primary bg-primary/15"
          : "border border-border text-muted-foreground bg-transparent hover:border-foreground/40"
      }`}
    >
      {label}
    </button>
  );
}

/* ─── Persona Builder Drawer ─── */
function PersonaBuilderDrawer({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (nome: string, attrs: PersonaAttributes) => void;
}) {
  const [name, setName] = useState("");
  const [attrs, setAttrs] = useState<PersonaAttributes>({});
  const { t } = useTranslation();

  const OPTION_LABELS: Record<string, string> = {
    "Maschile": t("generateQueries.genderMale"),
    "Femminile": t("generateQueries.genderFemale"),
    "Non specificato": t("generateQueries.genderUnspecified"),
    "Nord Italia": t("generateQueries.zonaNorth"),
    "Centro Italia": t("generateQueries.zonaCenter"),
    "Sud Italia": t("generateQueries.zonaSouth"),
    "Italia intera": t("generateQueries.zonaAll"),
    "Europa": t("generateQueries.zonaEurope"),
    "Globale": t("generateQueries.zonaGlobal"),
    "Dipendente": t("generateQueries.occEmployee"),
    "Libero Professionista": t("generateQueries.occFreelance"),
    "Imprenditore": t("generateQueries.occEntrepreneur"),
    "Manager": t("generateQueries.occManager"),
    "Studente": t("generateQueries.occStudent"),
    "Pensionato": t("generateQueries.occRetired"),
    "Tutti i livelli": t("generateQueries.eduAll"),
    "Scuola Secondaria": t("generateQueries.eduSecondary"),
    "Diploma": t("generateQueries.eduDiploma"),
    "Laurea Triennale": t("generateQueries.eduBachelor"),
    "Master / Dottorato": t("generateQueries.eduMaster"),
    "Sport": t("generateQueries.intSport"),
    "Tecnologia": t("generateQueries.intTech"),
    "Finanza": t("generateQueries.intFinance"),
    "Salute": t("generateQueries.intHealth"),
    "Viaggi": t("generateQueries.intTravel"),
    "Moda": t("generateQueries.intFashion"),
    "Casa": t("generateQueries.intHome"),
    "Famiglia": t("generateQueries.intFamily"),
    "Automotive": t("generateQueries.intAutomotive"),
    "Gaming": t("generateQueries.intGaming"),
    "Arte": t("generateQueries.intArt"),
    "Alimentazione": t("generateQueries.intFood"),
    "Risparmio": t("generateQueries.valSaving"),
    "Qualità": t("generateQueries.valQuality"),
    "Sostenibilità": t("generateQueries.valSustainability"),
    "Innovazione": t("generateQueries.valInnovation"),
    "Tradizione": t("generateQueries.valTradition"),
    "Comodità": t("generateQueries.valComfort"),
    "Status": t("generateQueries.valStatus"),
    "Molto attivo": t("generateQueries.styleVeryActive"),
    "Attivo": t("generateQueries.styleActive"),
    "Sedentario": t("generateQueries.styleSedentary"),
    "Digitale": t("generateQueries.styleDigital"),
    "Ibrido": t("generateQueries.styleHybrid"),
  };
  const optLabel = (v: string) => OPTION_LABELS[v] || v;

  function setSingle(key: keyof PersonaAttributes, val: string) {
    setAttrs((prev) => ({ ...prev, [key]: prev[key] === val ? undefined : val }));
  }

  function toggleMulti(key: keyof PersonaAttributes, val: string) {
    setAttrs((prev) => {
      const arr = (prev[key] as string[] | undefined) ?? [];
      return { ...prev, [key]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val] };
    });
  }

  const prompt = useMemo(() => generatePromptContext(name, attrs), [name, attrs]);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg border-l border-border z-50 flex flex-col animate-slide-in-right" style={{ background: "var(--ink-2)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-display font-bold text-lg text-foreground">{t("segments.createPersona")}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-foreground mb-1.5">{t("segments.personaName")} *</p>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Manager Milanese" className="input-base w-full" />
          </div>

          {/* Demographics */}
          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">{t("segments.demographics")}</h4>

            <p className="text-xs font-medium text-foreground mb-1.5">Sesso</p>
            <div className="flex flex-wrap gap-2">
              {SESSO_OPTIONS.map((o) => <Chip key={o} label={optLabel(o)} active={attrs.sesso === o} onClick={() => setSingle("sesso", o)} />)}
            </div>

            <p className="text-xs font-medium text-foreground mb-1.5 mt-3">Et&agrave;</p>
            <div className="flex flex-wrap gap-2">
              {ETA_OPTIONS.map((o) => <Chip key={o} label={o} active={attrs.eta?.includes(o) ?? false} onClick={() => toggleMulti("eta", o)} />)}
            </div>

            <p className="text-xs font-medium text-foreground mb-1.5 mt-3">Zona</p>
            <div className="flex flex-wrap gap-2">
              {ZONA_OPTIONS.map((o) => <Chip key={o} label={optLabel(o)} active={attrs.zona?.includes(o) ?? false} onClick={() => toggleMulti("zona", o)} />)}
            </div>

            <p className="text-xs font-medium text-foreground mb-1.5 mt-3">Occupazione</p>
            <div className="flex flex-wrap gap-2">
              {OCCUPAZIONE_OPTIONS.map((o) => <Chip key={o} label={optLabel(o)} active={attrs.occupazione?.includes(o) ?? false} onClick={() => toggleMulti("occupazione", o)} />)}
            </div>

            <p className="text-xs font-medium text-foreground mb-1.5 mt-3">Titolo di studio</p>
            <div className="flex flex-wrap gap-2">
              {TITOLO_OPTIONS.map((o) => <Chip key={o} label={optLabel(o)} active={attrs.titolo_studio === o} onClick={() => setSingle("titolo_studio", o)} />)}
            </div>

            <p className="text-xs font-medium text-foreground mb-1.5 mt-3">Reddito</p>
            <div className="flex flex-wrap gap-2">
              {REDDITO_OPTIONS.map((o) => <Chip key={o} label={o} active={attrs.reddito === o} onClick={() => setSingle("reddito", o)} />)}
            </div>
          </div>

          {/* Psychographics */}
          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">{t("segments.psychographics")}</h4>

            <p className="text-xs font-medium text-foreground mb-1.5">Interessi</p>
            <div className="flex flex-wrap gap-2">
              {INTERESSI_OPTIONS.map((o) => <Chip key={o} label={optLabel(o)} active={attrs.interessi?.includes(o) ?? false} onClick={() => toggleMulti("interessi", o)} />)}
            </div>

            <p className="text-xs font-medium text-foreground mb-1.5 mt-3">Valori</p>
            <div className="flex flex-wrap gap-2">
              {VALORI_OPTIONS.map((o) => <Chip key={o} label={optLabel(o)} active={attrs.valori?.includes(o) ?? false} onClick={() => toggleMulti("valori", o)} />)}
            </div>

            <p className="text-xs font-medium text-foreground mb-1.5 mt-3">Stile di vita</p>
            <div className="flex flex-wrap gap-2">
              {STILE_OPTIONS.map((o) => <Chip key={o} label={optLabel(o)} active={attrs.stile_vita?.includes(o) ?? false} onClick={() => toggleMulti("stile_vita", o)} />)}
            </div>
          </div>

          {/* Prompt preview */}
          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-semibold uppercase tracking-widest text-primary mb-2">{t("segments.promptPreview")}</h4>
            <div className="card p-3 border-primary/20">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Eye className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">Preview</span>
              </div>
              <p className="text-sm text-foreground/80 italic leading-relaxed">
                {prompt || t("segments.selectForPreview")}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0" style={{ background: "var(--ink-2)" }}>
          <button
            type="button"
            onClick={() => { if (name.trim()) onSave(name.trim(), attrs); }}
            disabled={!name.trim()}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-3 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {t("generateQueries.addPersona")}
          </button>
        </div>
      </div>
    </>
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
