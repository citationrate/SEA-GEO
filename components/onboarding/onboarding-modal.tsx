"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, Globe, Tag, Building2, MessageSquare } from "lucide-react";
import confetti from "canvas-confetti";
import { SUGGESTED_QUERIES, type SuggestedQuery } from "@/components/suggested-queries";

const SECTORS = ["Turismo", "Alimentare", "Bevande", "Tech", "Moda", "Finance", "Automotive", "Pharma", "Energia", "Altro"];

const DEFAULT_MODELS = ["gpt-4o-mini", "gemini-2.5-flash"];

export function OnboardingModal() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 2 state
  const [brand, setBrand] = useState("");
  const [website, setWebsite] = useState("");
  const [sector, setSector] = useState("");

  // Step 3 state
  const [projectId, setProjectId] = useState<string | null>(null);
  const [selectedQueries, setSelectedQueries] = useState<SuggestedQuery[]>([]);

  const markComplete = useCallback(async () => {
    await fetch("/api/onboarding/complete", { method: "POST" }).catch(() => {});
  }, []);

  async function handleSkip() {
    await markComplete();
    router.push("/dashboard");
    router.refresh();
  }

  async function handleCreateProject() {
    if (!brand.trim() || !website.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: brand.trim(),
          target_brand: brand.trim(),
          website_url: website.trim(),
          sector: sector || null,
          language: "it",
          models_config: DEFAULT_MODELS,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setProjectId(data.id);
      setStep(3);
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunchAnalysis() {
    if (!projectId || selectedQueries.length === 0) return;
    setLoading(true);
    try {
      // Save selected queries
      for (const q of selectedQueries) {
        await fetch("/api/queries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            text: q.text,
            funnel_stage: q.stage,
          }),
        });
      }

      await markComplete();

      // Fire confetti
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#00d4ff", "#7eb3d4", "#e8956d", "#7eb89a", "#c4a882"],
      });

      // Redirect to project page — launcher will be opened via URL param
      setTimeout(() => {
        router.push(`/projects/${projectId}?launch=true`);
        router.refresh();
      }, 800);
    } finally {
      setLoading(false);
    }
  }

  const suggestions = SUGGESTED_QUERIES[sector] ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[#111416] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="flex items-center gap-1.5 px-6 pt-5 pb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1 h-1 rounded-full overflow-hidden bg-[rgba(255,255,255,0.06)]">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: step >= s ? "100%" : "0%" }}
              />
            </div>
          ))}
          <span className="text-[0.65rem] text-muted-foreground ml-2 shrink-0">
            {step}/3
          </span>
        </div>

        <div className="px-6 pb-6 pt-2">
          {/* ─── STEP 1: Welcome ─── */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-2">
                <h2 className="font-display font-bold text-2xl text-foreground">
                  Benvenuto in SeaGeo 👋
                </h2>
                <p className="text-base text-primary font-medium">
                  Misura quanto il tuo brand è visibile nelle risposte AI
                </p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                SeaGeo analizza come i principali modelli AI (ChatGPT, Gemini, Claude, Perplexity)
                parlano del tuo brand. Scopri il tuo <span className="text-foreground font-medium">AI Visibility Index</span>,
                monitora i competitor e identifica le aree dove migliorare la tua presenza nelle risposte AI.
              </p>
              <button
                onClick={() => setStep(2)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-[2px] text-sm font-semibold hover:bg-primary/80 transition-colors"
              >
                Inizia
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ─── STEP 2: Create Project ─── */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <h2 className="font-display font-bold text-xl text-foreground">
                  Crea il tuo primo progetto
                </h2>
                <p className="text-sm text-muted-foreground">
                  Inserisci il brand da monitorare nelle risposte AI
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-1">
                    <Tag className="w-3 h-3" /> Brand target
                  </label>
                  <input
                    type="text"
                    placeholder="es. Lumora"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/30 border border-border rounded-[2px] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-1">
                    <Globe className="w-3 h-3" /> Sito web
                  </label>
                  <input
                    type="text"
                    placeholder="es. lumora.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/30 border border-border rounded-[2px] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-1">
                    <Building2 className="w-3 h-3" /> Settore
                  </label>
                  <select
                    value={sector}
                    onChange={(e) => {
                      setSector(e.target.value);
                      setSelectedQueries([]);
                    }}
                    className="w-full px-3 py-2 bg-muted/30 border border-border rounded-[2px] text-sm text-foreground focus:outline-none focus:border-primary/50"
                  >
                    <option value="">Seleziona settore</option>
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">
                    Modelli AI
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_MODELS.map((m) => (
                      <span key={m} className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-[2px] text-xs text-primary font-medium">
                        {m === "gpt-4o-mini" ? "GPT-4o Mini" : "Gemini 2.5 Flash"}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreateProject}
                disabled={!brand.trim() || !website.trim() || loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-[2px] text-sm font-semibold hover:bg-primary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Crea Progetto
              </button>
            </div>
          )}

          {/* ─── STEP 3: Add Queries ─── */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <h2 className="font-display font-bold text-xl text-foreground">
                  Aggiungi le prime query
                </h2>
                <p className="text-sm text-muted-foreground">
                  Seleziona le domande che le AI ricevono nel tuo settore
                </p>
              </div>

              {suggestions.length > 0 ? (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {suggestions.map((q) => {
                    const isSelected = selectedQueries.some((s) => s.text === q.text);
                    return (
                      <button
                        key={q.text}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedQueries(selectedQueries.filter((s) => s.text !== q.text));
                          } else {
                            setSelectedQueries([...selectedQueries, q]);
                          }
                        }}
                        className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-[2px] border text-left transition-all ${
                          isSelected
                            ? "border-primary/40 bg-primary/5"
                            : "border-border hover:border-primary/20 bg-muted/30"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-[2px] border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </div>
                        <p className="text-sm text-foreground flex-1">{q.text}</p>
                        <span className={`font-mono text-[0.55rem] tracking-wide uppercase px-1.5 py-0.5 rounded-[2px] border shrink-0 mt-0.5 ${
                          q.stage === "tofu"
                            ? "border-primary/30 text-primary"
                            : "border-[#7eb89a]/30 text-[#7eb89a]"
                        }`}>
                          {q.stage}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nessuna query suggerita per questo settore.
                    <br />Potrai aggiungerle manualmente nella pagina progetto.
                  </p>
                </div>
              )}

              <button
                onClick={handleLaunchAnalysis}
                disabled={selectedQueries.length === 0 || loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-[2px] text-sm font-semibold hover:bg-primary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Lancia la tua prima analisi
              </button>

              {suggestions.length === 0 && (
                <button
                  onClick={async () => {
                    await markComplete();
                    router.push(`/projects/${projectId}`);
                    router.refresh();
                  }}
                  className="w-full text-center text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Vai al progetto senza query
                </button>
              )}
            </div>
          )}

          {/* Skip link */}
          <button
            onClick={handleSkip}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-4"
          >
            Salta
          </button>
        </div>
      </div>
    </div>
  );
}
