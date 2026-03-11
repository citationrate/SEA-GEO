"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Sparkles, Loader2, Trash2, Plus, X, Users, AlertTriangle, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { generateQueries, calculateCost, type GenerationInputs, type GeneratedQuery, type Persona } from "@/lib/query-generator";

type Step = 1 | 2 | 3;

const SET_TYPE_COLORS: Record<string, string> = {
  generale: "border-muted-foreground/30 text-muted-foreground bg-muted-foreground/5",
  verticale: "border-blue-500/30 text-blue-400 bg-blue-500/5",
  persona: "border-purple-500/30 text-purple-400 bg-purple-500/5",
};

const FUNNEL_COLORS: Record<string, string> = {
  TOFU: "border-primary/30 text-primary",
  MOFU: "border-[#7eb89a]/30 text-[#7eb89a]",
};

export default function GenerateQueriesPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Inputs
  const [categoria, setCategoria] = useState("");
  const [mercato, setMercato] = useState("");
  const [useCases, setUseCases] = useState<string[]>([]);
  const [useCaseInput, setUseCaseInput] = useState("");
  const [criteri, setCriteri] = useState<string[]>([]);
  const [criteriInput, setCriteriInput] = useState("");
  const [mustHave, setMustHave] = useState<string[]>([]);
  const [mustHaveInput, setMustHaveInput] = useState("");
  const [vincoli, setVincoli] = useState("");
  const [obiezioni, setObiezioni] = useState("");
  const [linguaggioMercato, setLinguaggioMercato] = useState("");
  const [isB2B, setIsB2B] = useState(false);
  const [ruolo, setRuolo] = useState("");
  const [dimensioneAzienda, setDimensioneAzienda] = useState("");

  // Step 2: Personas
  const [personasEnabled, setPersonasEnabled] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);

  // Step 3: Preview
  const [generatedQueries, setGeneratedQueries] = useState<GeneratedQuery[]>([]);
  const [removedIndexes, setRemovedIndexes] = useState<Set<number>>(new Set());

  function buildInputs(): GenerationInputs {
    return {
      categoria,
      mercato: mercato || undefined,
      use_cases: useCases,
      criteri,
      must_have: mustHave,
      vincoli: vincoli || undefined,
      obiezioni: obiezioni || undefined,
      linguaggio_mercato: linguaggioMercato || undefined,
      ruolo: isB2B ? ruolo || undefined : undefined,
      dimensione_azienda: isB2B ? dimensioneAzienda || undefined : undefined,
      personas_enabled: personasEnabled,
      personas,
    };
  }

  function addTag(list: string[], setter: (v: string[]) => void, input: string, inputSetter: (v: string) => void) {
    const val = input.trim();
    if (val && !list.includes(val)) {
      setter([...list, val]);
    }
    inputSetter("");
  }

  function removeTag(list: string[], setter: (v: string[]) => void, idx: number) {
    setter(list.filter((_, i) => i !== idx));
  }

  function addPersona() {
    if (personas.length >= 3) return;
    setPersonas([...personas, {
      id: crypto.randomUUID(),
      mode: "demographic",
    }]);
  }

  function updatePersona(idx: number, updates: Partial<Persona>) {
    setPersonas(personas.map((p, i) => i === idx ? { ...p, ...updates } : p));
  }

  function removePersona(idx: number) {
    setPersonas(personas.filter((_, i) => i !== idx));
  }

  function goToStep2() {
    if (!categoria.trim()) {
      toast.error("Inserisci la categoria");
      return;
    }
    setStep(2);
  }

  function goToStep3() {
    const inputs = buildInputs();
    const queries = generateQueries(inputs);
    setGeneratedQueries(queries);
    setRemovedIndexes(new Set());
    setStep(3);
  }

  function toggleRemoveQuery(idx: number) {
    const next = new Set(removedIndexes);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setRemovedIndexes(next);
  }

  const activeQueries = generatedQueries.filter((_, i) => !removedIndexes.has(i));

  async function saveQueries() {
    setSaving(true);
    try {
      const inputs = buildInputs();
      const res = await fetch("/api/queries/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          queries: activeQueries,
          inputs,
        }),
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

  // Cost preview
  const inputs = buildInputs();
  const costInfo = step === 3 ? { total_queries: activeQueries.length, total_prompts: 0 } : calculateCost(inputs, 2, 3);

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
          { n: 1, label: "Descrivi il brand" },
          { n: 2, label: "Personas" },
          { n: 3, label: "Anteprima" },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-border" />}
            <div className={`flex items-center gap-2 text-sm ${step >= s.n ? "text-foreground" : "text-muted-foreground"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                step === s.n ? "border-primary bg-primary text-primary-foreground"
                  : step > s.n ? "border-primary text-primary"
                  : "border-border text-muted-foreground"
              }`}>{s.n}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Step 1: Input Form */}
      {step === 1 && (
        <div className="card p-6 space-y-5">
          <h2 className="font-display font-semibold text-foreground">Descrivi il tuo brand e mercato</h2>

          {/* Categoria */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Categoria *</label>
            <input
              type="text"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="es. crociere nel Mediterraneo"
              className="input-base w-full"
            />
          </div>

          {/* Mercato */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Mercato</label>
            <input
              type="text"
              value={mercato}
              onChange={(e) => setMercato(e.target.value)}
              placeholder="es. Italia"
              className="input-base w-full"
            />
          </div>

          {/* Use cases */}
          <TagInput
            label="Use cases"
            tags={useCases}
            input={useCaseInput}
            setInput={setUseCaseInput}
            onAdd={() => addTag(useCases, setUseCases, useCaseInput, setUseCaseInput)}
            onRemove={(i) => removeTag(useCases, setUseCases, i)}
            placeholder="es. vacanza famiglia"
          />

          {/* Criteri */}
          <TagInput
            label="Criteri di scelta"
            tags={criteri}
            input={criteriInput}
            setInput={setCriteriInput}
            onAdd={() => addTag(criteri, setCriteri, criteriInput, setCriteriInput)}
            onRemove={(i) => removeTag(criteri, setCriteri, i)}
            placeholder="es. prezzo, destinazioni"
          />

          {/* Must-have */}
          <TagInput
            label="Must-have"
            tags={mustHave}
            input={mustHaveInput}
            setInput={setMustHaveInput}
            onAdd={() => addTag(mustHave, setMustHave, mustHaveInput, setMustHaveInput)}
            onRemove={(i) => removeTag(mustHave, setMustHave, i)}
            placeholder="es. cabine per famiglie"
          />

          {/* Vincoli */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Vincoli / Rischi</label>
            <input
              type="text"
              value={vincoli}
              onChange={(e) => setVincoli(e.target.value)}
              placeholder="es. budget limitato, prima crociera"
              className="input-base w-full"
            />
          </div>

          {/* Obiezioni */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Obiezioni</label>
            <input
              type="text"
              value={obiezioni}
              onChange={(e) => setObiezioni(e.target.value)}
              placeholder="es. costi nascosti, qualità del servizio"
              className="input-base w-full"
            />
          </div>

          {/* Linguaggio mercato */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Linguaggio di mercato</label>
            <input
              type="text"
              value={linguaggioMercato}
              onChange={(e) => setLinguaggioMercato(e.target.value)}
              placeholder="es. crocieristi, armatore"
              className="input-base w-full"
            />
          </div>

          {/* B2B toggle */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setIsB2B(!isB2B)}
                className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${isB2B ? "bg-primary" : "bg-border"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${isB2B ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
              <span className="text-sm font-medium text-foreground">B2B</span>
            </label>
            {isB2B && (
              <div className="grid grid-cols-2 gap-4 pl-1">
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Ruolo</label>
                  <input type="text" value={ruolo} onChange={(e) => setRuolo(e.target.value)} placeholder="es. CFO" className="input-base w-full" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Dimensione azienda</label>
                  <input type="text" value={dimensioneAzienda} onChange={(e) => setDimensioneAzienda(e.target.value)} placeholder="es. PMI, Enterprise" className="input-base w-full" />
                </div>
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

      {/* Step 2: Personas */}
      {step === 2 && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-purple-400" />
            <h2 className="font-display font-semibold text-foreground">Personas</h2>
          </div>

          <div className="flex items-start gap-3 rounded-[2px] border border-[#c4a882]/30 bg-[#c4a882]/5 px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-[#c4a882] shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Le personas moltiplicano il numero di query generate. Ogni persona aggiunge 2-3 query aggiuntive.
              Massimo 3 personas attive.
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

                  <div className="flex gap-2">
                    <button
                      onClick={() => updatePersona(idx, { mode: "demographic" })}
                      className={`text-xs px-3 py-1.5 rounded-[2px] border transition-colors ${
                        p.mode === "demographic" ? "border-purple-500/40 bg-purple-500/10 text-purple-400" : "border-border text-muted-foreground"
                      }`}
                    >
                      Demografica
                    </button>
                    <button
                      onClick={() => updatePersona(idx, { mode: "decision_drivers" })}
                      className={`text-xs px-3 py-1.5 rounded-[2px] border transition-colors ${
                        p.mode === "decision_drivers" ? "border-purple-500/40 bg-purple-500/10 text-purple-400" : "border-border text-muted-foreground"
                      }`}
                    >
                      Decision Drivers
                    </button>
                  </div>

                  {p.mode === "demographic" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Zona</label>
                        <input type="text" value={p.zona || ""} onChange={(e) => updatePersona(idx, { zona: e.target.value })} placeholder="es. del Nord Italia" className="input-base w-full" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Contesto d&apos;uso</label>
                        <input type="text" value={p.contesto_uso || ""} onChange={(e) => updatePersona(idx, { contesto_uso: e.target.value })} placeholder="es. vacanza famiglia" className="input-base w-full" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Ruolo</label>
                        <input type="text" value={p.ruolo || ""} onChange={(e) => updatePersona(idx, { ruolo: e.target.value })} placeholder="es. travel manager" className="input-base w-full" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Priorità</label>
                        <input type="text" value={p.priorita || ""} onChange={(e) => updatePersona(idx, { priorita: e.target.value })} placeholder="es. rapporto qualità prezzo" className="input-base w-full" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Must-have</label>
                        <input type="text" value={p.must_have || ""} onChange={(e) => updatePersona(idx, { must_have: e.target.value })} placeholder="es. cabine per famiglie" className="input-base w-full" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">No-go</label>
                        <input type="text" value={p.no_go || ""} onChange={(e) => updatePersona(idx, { no_go: e.target.value })} placeholder="es. costi nascosti" className="input-base w-full" />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {personas.length < 3 && (
                <button
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
              Genera Anteprima
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview + Cost */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Cost preview */}
          <div className="card p-4 flex items-center justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Query attive: </span>
              <span className="font-bold text-foreground">{activeQueries.length}</span>
              <span className="text-muted-foreground"> / {generatedQueries.length} generate</span>
            </div>
            {removedIndexes.size > 0 && (
              <span className="text-xs text-muted-foreground">
                {removedIndexes.size} rimosse
              </span>
            )}
          </div>

          {/* Grouped queries */}
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
                    {groupQueries.filter((q) => !removedIndexes.has(q.originalIndex)).length} query
                  </span>
                </div>
                <div className="space-y-2">
                  {groupQueries.map((q) => {
                    const isRemoved = removedIndexes.has(q.originalIndex);
                    return (
                      <div
                        key={q.originalIndex}
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-[2px] border transition-all ${
                          isRemoved ? "border-border/30 opacity-40" : "border-border"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${isRemoved ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {q.text}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`font-mono text-[0.55rem] tracking-wide uppercase px-1.5 py-0.5 rounded-[2px] border ${FUNNEL_COLORS[q.funnel]}`}>
                            {q.funnel}
                          </span>
                          <span className="font-mono text-[0.55rem] tracking-wide text-muted-foreground border border-border px-1.5 py-0.5 rounded-[2px]">
                            {q.layer}
                          </span>
                          <button
                            onClick={() => toggleRemoveQuery(q.originalIndex)}
                            className={`p-1 rounded transition-colors ${
                              isRemoved ? "text-primary hover:text-primary/70" : "text-muted-foreground hover:text-destructive"
                            }`}
                            title={isRemoved ? "Ripristina" : "Rimuovi"}
                          >
                            {isRemoved ? <Plus className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
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
              Salva {activeQueries.length} Query nel Progetto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Tag input sub-component
function TagInput({
  label,
  tags,
  input,
  setInput,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string;
  tags: string[];
  input: string;
  setInput: (v: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
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
              <button onClick={() => onRemove(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
