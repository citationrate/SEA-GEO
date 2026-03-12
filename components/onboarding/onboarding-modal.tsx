"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Globe, Tag, Building2, MessageSquare } from "lucide-react";
import confetti from "canvas-confetti";

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

  async function handleGoToProject() {
    if (!projectId) return;
    await markComplete();

    // Fire confetti
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#00d4ff", "#7eb3d4", "#e8956d", "#7eb89a", "#c4a882"],
    });

    setTimeout(() => {
      router.push(`/projects/${projectId}`);
      router.refresh();
    }, 800);
  }

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
                    <Tag className="w-3 h-3" /> Brand rilevato
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
                    onChange={(e) => setSector(e.target.value)}
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

          {/* ─── STEP 3: Go to project ─── */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <h2 className="font-display font-bold text-xl text-foreground">
                  Progetto creato! 🎉
                </h2>
                <p className="text-sm text-muted-foreground">
                  Ora aggiungi le query personalizzate o usa il generatore AI nella pagina del progetto
                </p>
              </div>

              <div className="border border-dashed border-border rounded-[2px] px-4 py-6 text-center space-y-2">
                <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Aggiungi le tue query personalizzate o usa il generatore AI
                </p>
              </div>

              <button
                onClick={handleGoToProject}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-[2px] text-sm font-semibold hover:bg-primary/80 transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
                Vai al progetto
              </button>
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
