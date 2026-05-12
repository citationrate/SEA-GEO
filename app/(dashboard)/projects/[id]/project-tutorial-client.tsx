"use client";

import { ContextualCoachmark } from "@/components/contextual-coachmark";

/**
 * Tutorial iniziale sulla project page AVI, stile Citability Score.
 *
 * Niente checklist persistente: il primo utente vede solo piccoli
 * coachmark contestuali che si armano dopo ~30s di inattività e puntano
 * all'azione successiva piu' rilevante in base allo stato del progetto.
 *
 * Sequenza implicita:
 *   - 0 query → punta alla card Query ("aggiungi/genera le prime")
 *   - >=1 query e 0 run → punta a "Lancia Analisi"
 *   - >=1 run → nessun coachmark (utente operativo)
 *
 * Ogni coachmark e' dismissibile e ricorda la dismissal in localStorage,
 * coerentemente con il pattern CS in src/components/ContextualCoachmark.
 */
export function ProjectTutorialClient({
  hasQueries,
  hasRuns,
}: {
  hasQueries: boolean;
  hasRuns: boolean;
}) {
  // Utente operativo → niente coachmark
  if (hasRuns) return null;

  if (!hasQueries) {
    return (
      <ContextualCoachmark
        id="avi-project-add-queries"
        anchorSelector='[data-coachmark="add-query-btn"]'
        idleSeconds={20}
        title="Aggiungi le tue prime query"
        description="Genera query con AI o inseriscile a mano. Sono le domande che faremo ai modelli per misurare la tua visibilita'."
        ctaLabel="Apri Gestione Query"
        position="bottom"
      />
    );
  }

  // Ha query ma non ha mai lanciato un'analisi
  return (
    <ContextualCoachmark
      id="avi-project-launch-first-run"
      anchorSelector='[data-tour="launch-analysis-btn"]'
      idleSeconds={20}
      title="Lancia la tua prima analisi"
      description="Tutto pronto. Avvia l'analisi: i provider AI selezionati risponderanno alle tue query e calcoleremo l'AVI score."
      ctaLabel="Capito"
      position="bottom"
    />
  );
}
