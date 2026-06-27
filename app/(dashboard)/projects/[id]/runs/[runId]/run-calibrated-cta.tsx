"use client";

// Vista calibrata (azioni-libro: rinforzo variabile + endowed progress + upsell):
// - PRIMO run → coriandoli a tutto schermo = sensazione di vittoria.
// - Gancio "scopri le query dove non ci sei ancora" + bottone riavvia →
//   modale di upgrade tarato sul piano (demo→BASE, base→PRO, pro→ENTERPRISE)
//   con benefici VERI (allineati a /piano) + "guarda anche gli altri piani".
// Peso AVI fisso 50/50 (la calibrazione e' nella VISTA, non nel punteggio).

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Sparkles, Check, ArrowRight } from "lucide-react";

type Plan = "demo" | "base" | "pro" | "enterprise" | string;

const UPSELL: Record<string, { next: string; benefits: string[] }> = {
  demo: {
    next: "BASE",
    benefits: [
      "100 prompt al mese (invece di 8)",
      "Web search live: vedi cosa rispondono davvero le AI",
      "Confronto diretto con i competitor",
      "6 modelli AI selezionabili",
      "Monitoraggio del tuo AVI nel tempo",
    ],
  },
  base: {
    next: "PRO",
    benefits: [
      "300 prompt al mese, 90 con web search",
      "Tutti i modelli AI, inclusi quelli Pro",
      "10 confronti competitivi al mese",
      "Analisi degli URL e dei contesti AI",
      "Fino a 5 modelli per progetto",
    ],
  },
  pro: {
    next: "ENTERPRISE",
    benefits: [
      "Prompt e confronti senza limiti",
      "Fino a 10 modelli per progetto",
      "Analisi URL e contesti AI illimitate",
      "Consulenza dedicata",
    ],
  },
};

export function RunCalibratedCta({ plan, runCount }: { plan: Plan; runCount: number }) {
  const [open, setOpen] = useState(false);
  const isFirstRun = runCount <= 1;
  const upsell = UPSELL[plan];

  // Coriandoli al primo run (best-effort, client-only).
  useEffect(() => {
    if (!isFirstRun) return;
    let cancelled = false;
    (async () => {
      try {
        const confetti = (await import("canvas-confetti")).default;
        if (cancelled) return;
        const fire = (x: number) => confetti({ particleCount: 90, spread: 75, startVelocity: 45, origin: { x, y: 0.6 }, zIndex: 9999 });
        fire(0.2); fire(0.5); fire(0.8);
        setTimeout(() => { if (!cancelled) { fire(0.35); fire(0.65); } }, 350);
      } catch { /* canvas-confetti non disponibile → nessun coriandolo */ }
    })();
    return () => { cancelled = true; };
  }, [isFirstRun]);

  // Enterprise: nessun piano superiore da proporre.
  if (!upsell) return null;

  return (
    <>
      <div
        className="rounded-[3px] border p-5 flex items-start gap-4"
        style={{ borderColor: "rgba(126,184,154,0.3)", background: "rgba(126,184,154,0.06)" }}
      >
        <Sparkles className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#7eb89a" }} />
        <div className="flex-1">
          <h3 className="text-base font-medium text-foreground mb-1">
            {isFirstRun ? "Ottimo inizio. Ora scopri le query dove non ci sei ancora." : "Scopri le query dove non ci sei ancora."}
          </h3>
          <p className="text-sm text-muted-foreground mb-4" style={{ lineHeight: 1.6 }}>
            Questa analisi è solo l&apos;inizio. Riavviala con più domande per vedere in quali risposte delle AI i tuoi concorrenti compaiono e tu no.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-[2px] transition-colors"
            style={{ background: "#7eb89a", color: "#0d1a14" }}
          >
            <RefreshCw className="w-4 h-4" /> Riavvia l&apos;analisi
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="bg-ink border rounded-[3px] p-6 w-full max-w-[440px]" style={{ borderColor: "rgba(126,184,154,0.3)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Vuoi scoprire in quali risposte dell&apos;AI non compari?
            </h3>
            <p className="text-sm text-muted-foreground mb-4" style={{ lineHeight: 1.6 }}>
              Passa all&apos;abbonamento <strong className="text-foreground">{upsell.next}</strong> e analizza più a fondo la tua visibilità sulle AI.
            </p>
            <ul className="space-y-2 mb-5">
              {upsell.benefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#7eb89a" }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/piano#piani"
              className="flex items-center justify-center gap-2 text-sm font-semibold px-4 py-3 rounded-[2px] transition-colors w-full"
              style={{ background: "#7eb89a", color: "#0d1a14" }}
            >
              Passa a {upsell.next} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/piano#piani"
              className="block text-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-3"
            >
              Guarda anche gli altri piani
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
