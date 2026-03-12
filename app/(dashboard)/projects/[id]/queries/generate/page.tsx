"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Sparkles, Loader2, Plus, X, Users,
  ChevronLeft, Lock, MessageCircleQuestion, Check,
} from "lucide-react";
import { toast } from "sonner";
import { generateQueries, type GenerationInputs, type GeneratedQuery, type Persona } from "@/lib/query-generator";
import { InfoTooltip } from "@/components/ui/info-tooltip";

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
  { value: 5, label: "5 query", desc: "rapido", pro: false },
  { value: 10, label: "10 query", desc: "consigliato", pro: false },
  { value: 20, label: "20 query", desc: "approfondito", pro: false },
  { value: 50, label: "50 query", desc: "completo", pro: true },
];

export default function GenerateQueriesPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [isPro, setIsPro] = useState(false);
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

  // Step 3: Query count
  const [queryCount, setQueryCount] = useState(10);
  const [customCount, setCustomCount] = useState(30);

  // Step 4: Preview
  const [generatedQueries, setGeneratedQueries] = useState<GeneratedQuery[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());

  // Fetch pro status & existing queries on mount
  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((p) => {
      setIsPro(p?.plan === "pro" || p?.plan === "agency");
    }).catch(() => {});

    fetch(`/api/queries?project_id=${projectId}`).then((r) => r.json()).then((qs) => {
      if (Array.isArray(qs)) setExistingQueryCount(qs.length);
    }).catch(() => {});
  }, [projectId]);

  const monthlyLimit = isPro ? 500 : 100;
  const usedThisMonth = existingQueryCount;

  function buildInputs(): GenerationInputs {
    return {
      categoria,
      mercato: mercato || undefined,
      luogo: (isPro && luogo) ? luogo : undefined,
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

  function addPersona() {
    if (personas.length >= 3) return;
    setPersonas([...personas, { id: crypto.randomUUID(), mode: "demographic" }]);
  }

  function updatePersona(idx: number, updates: Partial<Persona>) {
    setPersonas(personas.map((p, i) => i === idx ? { ...p, ...updates } : p));
  }

  function removePersona(idx: number) {
    setPersonas(personas.filter((_, i) => i !== idx));
  }

  function goToStep2() {
    if (!categoria.trim()) { toast.error("Inserisci la categoria"); return; }
    setStep(2);
  }

  function goToStep3() { setStep(3); }

  function goToStep4() {
    const inputs = buildInputs();
    let allQueries = generateQueries(inputs);

    // Limit to selected queryCount
    const targetCount = queryCount === -1 ? (isPro ? customCount : 30) : queryCount;
    if (allQueries.length > targetCount) {
      allQueries = allQueries.slice(0, targetCount);
    }

    // If we need more queries, duplicate with variations
    // (In practice the template engine handles this based on inputs)

    setGeneratedQueries(allQueries);
    setSelectedIndexes(new Set(allQueries.map((_, i) => i)));
    setStep(4);
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
        throw new Error(data.error || "Errore");
      }
      toast.success(`${activeQueries.length} query generate e salvate`);
      router.push(`/projects/${projectId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore nel salvataggio");
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
        }),
      });
      if (!res.ok) throw new Error("Errore");
      const data = await res.json();
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        setAiQuestions(data.questions.slice(0, 3));
        setAiAnswers(["", "", ""]);
        setShowAiIntake(true);
      }
    } catch {
      toast.error("Impossibile generare le domande AI");
    } finally {
      setAiQuestionsLoading(false);
    }
  }

  // Remaining quota check
  const wouldExceed = usedThisMonth + queryCount > monthlyLimit;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <a
          href={`/projects/${projectId}/queries`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna alle query
        </a>
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Genera Query</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Generazione strutturata con famiglie, layer e personas
            </p>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: "Contesto Brand" },
          { n: 2, label: "Personas & Pubblico" },
          { n: 3, label: "Quante query" },
          { n: 4, label: "Anteprima" },
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
          <h2 className="font-display font-semibold text-foreground">Contesto Brand</h2>

          {/* Categoria */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              Categoria *
              <InfoTooltip text="La categoria di prodotto o servizio del tuo brand, es. 'pasta artigianale', 'skincare naturale'" />
            </label>
            <input
              type="text"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="es. pasta artigianale"
              className="input-base w-full"
            />
          </div>

          {/* Mercato */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              Mercato *
              <InfoTooltip text="Il mercato di riferimento del tuo brand, es. 'Italia', 'Europa', 'B2B internazionale'" />
            </label>
            <input
              type="text"
              value={mercato}
              onChange={(e) => setMercato(e.target.value)}
              placeholder="es. Italia"
              className="input-base w-full"
            />
          </div>

          {/* Luogo — Pro only */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              Luogo
              {!isPro ? (
                <span className="inline-flex items-center gap-1 font-mono text-[0.55rem] tracking-wide text-[#c4a882] border border-[#c4a882]/30 px-1.5 py-0.5 rounded-[2px]">
                  <Lock className="w-2.5 h-2.5" /> PRO
                </span>
              ) : (
                <InfoTooltip text="Specifica una città, regione o paese per generare query geolocalizzate. Aumenta la rilevanza per brand con presenza locale." />
              )}
            </label>
            <input
              type="text"
              value={luogo}
              onChange={(e) => setLuogo(e.target.value)}
              placeholder="es. Milano, Nord Italia, Europa"
              disabled={!isPro}
              className={`input-base w-full ${!isPro ? "opacity-50 cursor-not-allowed" : ""}`}
            />
          </div>

          {/* Punti di forza */}
          <TagInput
            label="Punti di forza"
            tooltip="Cosa rende unico il tuo brand? L'AI userà questi elementi per costruire query in cui il tuo brand emerge positivamente."
            tags={puntiDiForza}
            input={puntiInput}
            setInput={setPuntiInput}
            onAdd={() => addTag(puntiDiForza, setPuntiDiForza, puntiInput, setPuntiInput)}
            onRemove={(i) => removeTag(puntiDiForza, setPuntiDiForza, i)}
            placeholder="es. qualità artigianale, spedizione veloce"
          />

          {/* Principali competitor */}
          <TagInput
            label="Principali competitor"
            tooltip="I competitor che vuoi monitorare nelle query MOFU comparative."
            tags={competitor}
            input={competitorInput}
            setInput={setCompetitorInput}
            onAdd={() => addTag(competitor, setCompetitor, competitorInput, setCompetitorInput)}
            onRemove={(i) => removeTag(competitor, setCompetitor, i)}
            placeholder="es. Barilla, De Cecco"
          />

          {/* Obiezioni comuni */}
          <TagInput
            label="Obiezioni comuni"
            tooltip="Le obiezioni tipiche dei clienti. Aiuta l'AI a generare query che riflettono dubbi reali del mercato."
            tags={obiezioni}
            input={obiezioniInput}
            setInput={setObiezioniInput}
            onAdd={() => addTag(obiezioni, setObiezioni, obiezioniInput, setObiezioniInput)}
            onRemove={(i) => removeTag(obiezioni, setObiezioni, i)}
            placeholder="es. troppo costoso, scarsa reperibilità"
          />

          {/* AI Conversational Intake */}
          <div className="border-t border-border pt-5 space-y-3">
            {!showAiIntake ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground font-medium">
                    Vuoi che l&apos;AI ti faccia alcune domande per capire meglio il tuo brand?
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Opzionale — migliora la qualità delle query generate</p>
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
                  Sì, rispondi a 3 domande &rarr;
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MessageCircleQuestion className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">Domande dall&apos;AI</p>
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
                      placeholder="La tua risposta (opzionale)"
                      className="input-base w-full"
                    />
                  </div>
                ))}
                <button
                  onClick={() => { setShowAiIntake(false); setAiQuestions([]); setAiAnswers(["", "", ""]); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Chiudi domande
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={goToStep2}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors"
            >
              Avanti
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Step 2: Personas & Pubblico Target */}
      {/* ═══════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-purple-400" />
            <h2 className="font-display font-semibold text-foreground">Personas &amp; Pubblico Target</h2>
            <InfoTooltip text="Ogni persona attiva moltiplica le query generate. Con 2 personas ottieni query da 2 prospettive diverse — utile per brand con target eterogeneo." />
          </div>

          <div className="rounded-[2px] border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Le personas definiscono il tipo di utente che fa le domande all&apos;AI.
              Ogni persona genera un set di query con prospettiva diversa,
              aumentando la copertura dell&apos;analisi.
            </p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => {
                setPersonasEnabled(!personasEnabled);
                if (personasEnabled) setPersonas([]);
              }}
              className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${personasEnabled ? "bg-purple-500" : "bg-border"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${personasEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm font-medium text-foreground">Attiva Personas</span>
            <span className="text-xs text-muted-foreground">(max 3)</span>
          </label>

          {personasEnabled && (
            <div className="space-y-4">
              {personas.map((p, idx) => (
                <div key={p.id} className="card border border-purple-500/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">Persona {idx + 1}</span>
                    <button onClick={() => removePersona(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Nome persona */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Nome persona</label>
                    <input
                      type="text"
                      value={p.nome || ""}
                      onChange={(e) => updatePersona(idx, { nome: e.target.value })}
                      placeholder='es. "Mamma attenta alla salute"'
                      className="input-base w-full"
                    />
                  </div>

                  {/* B2C / B2B toggle */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updatePersona(idx, { mode: "demographic" })}
                      className={`text-xs px-3 py-1.5 rounded-[2px] border transition-colors ${
                        p.mode === "demographic" ? "border-purple-500/40 bg-purple-500/10 text-purple-400" : "border-border text-muted-foreground"
                      }`}
                    >
                      B2C (demografico)
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePersona(idx, { mode: "decision_drivers" })}
                      className={`text-xs px-3 py-1.5 rounded-[2px] border transition-colors ${
                        p.mode === "decision_drivers" ? "border-purple-500/40 bg-purple-500/10 text-purple-400" : "border-border text-muted-foreground"
                      }`}
                    >
                      B2B (decisore aziendale)
                    </button>
                  </div>

                  {p.mode === "demographic" ? (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Età</label>
                        <input type="text" value={p.eta || ""} onChange={(e) => updatePersona(idx, { eta: e.target.value })} placeholder="es. 30-45" className="input-base w-full" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Sesso</label>
                        <select value={p.sesso || ""} onChange={(e) => updatePersona(idx, { sesso: e.target.value })} className="input-base w-full">
                          <option value="">—</option>
                          <option value="M">Uomo</option>
                          <option value="F">Donna</option>
                          <option value="altro">Altro</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Situazione</label>
                        <input type="text" value={p.situazione || ""} onChange={(e) => updatePersona(idx, { situazione: e.target.value })} placeholder="es. cucina per la famiglia" className="input-base w-full" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Ruolo</label>
                        <input type="text" value={p.ruolo || ""} onChange={(e) => updatePersona(idx, { ruolo: e.target.value })} placeholder="es. responsabile acquisti" className="input-base w-full" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Settore</label>
                        <input type="text" value={p.settore || ""} onChange={(e) => updatePersona(idx, { settore: e.target.value })} placeholder="es. ristorazione" className="input-base w-full" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Problema principale</label>
                        <input type="text" value={p.problema || ""} onChange={(e) => updatePersona(idx, { problema: e.target.value })} placeholder="es. costi di approvvigionamento" className="input-base w-full" />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {personas.length < 3 && (
                <button
                  type="button"
                  onClick={addPersona}
                  className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Aggiungi Persona
                </button>
              )}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Indietro
            </button>
            <button
              onClick={goToStep3}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors"
            >
              Avanti
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Step 3: Quante query generare */}
      {/* ═══════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="card p-6 space-y-5">
          <h2 className="font-display font-semibold text-foreground">Quante query vuoi generare?</h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUERY_COUNT_OPTIONS.map((opt) => {
              const locked = opt.pro && !isPro;
              const isSelected = queryCount === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => !locked && setQueryCount(opt.value)}
                  disabled={locked}
                  className={`relative p-3 rounded-[2px] border text-center transition-all ${
                    locked
                      ? "opacity-50 cursor-not-allowed border-border"
                      : isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/30"
                  }`}
                >
                  <p className={`text-lg font-display font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  {locked && (
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 font-mono text-[0.5rem] tracking-wide text-[#c4a882] border border-[#c4a882]/30 px-1 py-0.5 rounded-[2px]">
                      <Lock className="w-2 h-2" /> PRO
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom count — Pro only */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => isPro && setQueryCount(-1)}
              disabled={!isPro}
              className={`flex items-center gap-2 text-sm px-3 py-2 rounded-[2px] border transition-all ${
                !isPro
                  ? "opacity-50 cursor-not-allowed border-border"
                  : queryCount === -1
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              Personalizzato
              {!isPro && (
                <span className="inline-flex items-center gap-0.5 font-mono text-[0.5rem] tracking-wide text-[#c4a882] border border-[#c4a882]/30 px-1 py-0.5 rounded-[2px]">
                  <Lock className="w-2 h-2" /> PRO
                </span>
              )}
            </button>
            {queryCount === -1 && isPro && (
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

          {/* Usage bar */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Hai utilizzato <span className="text-foreground font-bold">{usedThisMonth}</span> / {monthlyLimit} query questo mese
              </span>
              <span className={`font-mono ${wouldExceed ? "text-destructive" : "text-muted-foreground"}`}>
                {isPro ? "Piano Pro" : "Piano Starter"}
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
              <p className="text-xs text-destructive">
                Hai superato il limite mensile. Riduci il numero di query o passa al piano Pro.
              </p>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Indietro
            </button>
            <button
              onClick={goToStep4}
              disabled={wouldExceed}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
            >
              Genera Anteprima
              <ArrowRight className="w-4 h-4" />
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
              <span className="text-muted-foreground"> query selezionate su </span>
              <span className="text-foreground">{generatedQueries.length}</span>
              <span className="text-muted-foreground"> generate</span>
            </div>
            <button
              onClick={toggleAll}
              className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
            >
              {selectedIndexes.size === generatedQueries.length ? "Deseleziona tutte" : "Seleziona tutte"}
            </button>
          </div>

          {/* Grouped queries with checkboxes */}
          {(["generale", "verticale", "persona"] as const).map((setType) => {
            const groupQueries = generatedQueries
              .map((q, i) => ({ ...q, originalIndex: i }))
              .filter((q) => q.set_type === setType);
            if (groupQueries.length === 0) return null;

            const label = setType === "generale" ? "Generali" : setType === "verticale" ? "Verticali" : "Personas";

            return (
              <div key={setType} className="card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-[2px] border ${SET_TYPE_COLORS[setType]}`}>
                    {label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {groupQueries.filter((q) => selectedIndexes.has(q.originalIndex)).length}/{groupQueries.length} selezionate
                  </span>
                </div>
                <div className="space-y-1.5">
                  {groupQueries.map((q) => {
                    const isSelected = selectedIndexes.has(q.originalIndex);
                    return (
                      <button
                        key={q.originalIndex}
                        type="button"
                        onClick={() => toggleQuery(q.originalIndex)}
                        className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-[2px] border text-left transition-all ${
                          isSelected ? "border-primary/30 bg-primary/5" : "border-border/50 opacity-50"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-[2px] border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </div>
                        <p className={`text-sm flex-1 ${isSelected ? "text-foreground" : "text-muted-foreground line-through"}`}>
                          {q.text}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`font-mono text-[0.55rem] tracking-wide uppercase px-1.5 py-0.5 rounded-[2px] border ${FUNNEL_COLORS[q.funnel]}`}>
                            {q.funnel}
                          </span>
                          <span className="font-mono text-[0.55rem] tracking-wide text-muted-foreground border border-border px-1.5 py-0.5 rounded-[2px]">
                            {q.layer}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Indietro
            </button>
            <button
              onClick={saveQueries}
              disabled={saving || activeQueries.length === 0}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-[2px] hover:bg-primary/85 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Salva {activeQueries.length} query selezionate &rarr;
            </button>
          </div>
        </div>
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
