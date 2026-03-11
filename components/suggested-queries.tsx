"use client";

import { useState } from "react";
import { Check, Plus, Loader2, MessageSquare } from "lucide-react";

interface SuggestedQuery {
  text: string;
  stage: "tofu" | "mofu";
}

const SUGGESTED_QUERIES: Record<string, SuggestedQuery[]> = {
  Turismo: [
    { text: "quali compagnie di crociere scegliere per una vacanza nel Mediterraneo?", stage: "tofu" },
    { text: "vacanze in crociera: cosa considerare prima di prenotare?", stage: "tofu" },
    { text: "Costa Crociere o MSC: quale scegliere per una crociera?", stage: "mofu" },
    { text: "migliori compagnie di crociere per famiglie con bambini", stage: "mofu" },
  ],
  Alimentare: [
    { text: "quali sono i migliori prodotti da colazione italiani?", stage: "tofu" },
    { text: "biscotti e merendine: quali scegliere per i bambini?", stage: "tofu" },
    { text: "Barilla o De Cecco: quale pasta scegliere?", stage: "mofu" },
    { text: "prodotti lattiero-caseari italiani: quali marchi sono i migliori?", stage: "mofu" },
  ],
  Bevande: [
    { text: "quali bibite analcoliche scegliere per una festa?", stage: "tofu" },
    { text: "migliori acque minerali italiane: quale comprare?", stage: "tofu" },
    { text: "Coca-Cola o Pepsi: quale scegliere?", stage: "mofu" },
    { text: "succhi di frutta: quale marca è la più naturale?", stage: "mofu" },
  ],
  Tech: [
    { text: "quale smartphone comprare nel 2025 qualità prezzo?", stage: "tofu" },
    { text: "migliori laptop per lavoro e studio", stage: "tofu" },
    { text: "iPhone o Samsung: quale scegliere nel 2025?", stage: "mofu" },
    { text: "Apple MacBook o Dell XPS: quale laptop è meglio?", stage: "mofu" },
  ],
  Moda: [
    { text: "migliori brand di abbigliamento italiano di qualità", stage: "tofu" },
    { text: "scarpe casual italiane: quali marchi scegliere?", stage: "tofu" },
    { text: "Zara o H&M: quale scegliere per il rapporto qualità prezzo?", stage: "mofu" },
    { text: "Nike o Adidas: quale brand di sneaker è meglio?", stage: "mofu" },
  ],
  Finance: [
    { text: "migliori banche online italiane nel 2025", stage: "tofu" },
    { text: "quale conto corrente aprire in Italia?", stage: "tofu" },
    { text: "Fineco o Directa: quale broker scegliere?", stage: "mofu" },
    { text: "N26 o Revolut: quale conto digitale è meglio?", stage: "mofu" },
  ],
};

export { SUGGESTED_QUERIES };
export type { SuggestedQuery };

/**
 * Suggested queries for the new project form.
 * Tracks selected queries in local state — parent reads via onSelectionChange.
 */
export function SuggestedQueriesNew({
  sector,
  selectedQueries,
  onSelectionChange,
}: {
  sector: string;
  selectedQueries: SuggestedQuery[];
  onSelectionChange: (queries: SuggestedQuery[]) => void;
}) {
  const suggestions = SUGGESTED_QUERIES[sector];
  if (!suggestions) return null;

  function toggle(q: SuggestedQuery) {
    const exists = selectedQueries.some((s) => s.text === q.text);
    if (exists) {
      onSelectionChange(selectedQueries.filter((s) => s.text !== q.text));
    } else {
      onSelectionChange([...selectedQueries, q]);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-3.5 h-3.5 text-primary" />
        <p className="text-sm font-medium text-foreground">Query suggerite</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Clicca per selezionare le query da aggiungere al progetto
      </p>
      <div className="grid grid-cols-1 gap-2">
        {suggestions.map((q) => {
          const isSelected = selectedQueries.some((s) => s.text === q.text);
          return (
            <button
              key={q.text}
              type="button"
              onClick={() => toggle(q)}
              className={`flex items-start gap-3 px-3 py-2.5 rounded-[2px] border text-left transition-all ${
                isSelected
                  ? "border-primary/40 bg-primary/5"
                  : "border-border hover:border-primary/20 bg-muted/30"
              }`}
            >
              <div className={`w-4 h-4 rounded-[2px] border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                isSelected ? "border-primary bg-primary" : "border-muted-foreground"
              }`}>
                {isSelected && (
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{q.text}</p>
              </div>
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
    </div>
  );
}

/**
 * Suggested queries for the edit project form.
 * Saves queries immediately via API since the project already exists.
 */
export function SuggestedQueriesEdit({
  sector,
  projectId,
  existingQueries,
  onQueryAdded,
}: {
  sector: string;
  projectId: string;
  existingQueries: { text: string; funnel_stage: string }[];
  onQueryAdded: () => void;
}) {
  const suggestions = SUGGESTED_QUERIES[sector];
  const [saving, setSaving] = useState<string | null>(null);

  if (!suggestions) return null;

  function isAlreadyAdded(q: SuggestedQuery): boolean {
    return existingQueries.some(
      (eq) => eq.text.toLowerCase().trim() === q.text.toLowerCase().trim()
    );
  }

  async function addQuery(q: SuggestedQuery) {
    if (isAlreadyAdded(q)) return;
    setSaving(q.text);
    try {
      const res = await fetch("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, text: q.text, funnel_stage: q.stage }),
      });
      if (res.ok) onQueryAdded();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-3.5 h-3.5 text-primary" />
        <p className="text-sm font-medium text-foreground">Query suggerite</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Clicca per aggiungere una query al progetto
      </p>
      <div className="grid grid-cols-1 gap-2">
        {suggestions.map((q) => {
          const added = isAlreadyAdded(q);
          const isSaving = saving === q.text;
          return (
            <button
              key={q.text}
              type="button"
              onClick={() => addQuery(q)}
              disabled={added || isSaving}
              className={`flex items-start gap-3 px-3 py-2.5 rounded-[2px] border text-left transition-all ${
                added
                  ? "border-primary/30 bg-primary/5 opacity-60 cursor-default"
                  : "border-border hover:border-primary/20 bg-muted/30"
              }`}
            >
              <div className={`w-4 h-4 rounded-[2px] border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                added ? "border-primary bg-primary" : "border-muted-foreground"
              }`}>
                {added && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                {isSaving && <Loader2 className="w-2.5 h-2.5 text-muted-foreground animate-spin" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{q.text}</p>
              </div>
              <span className={`font-mono text-[0.55rem] tracking-wide uppercase px-1.5 py-0.5 rounded-[2px] border shrink-0 mt-0.5 ${
                q.stage === "tofu"
                  ? "border-primary/30 text-primary"
                  : "border-[#7eb89a]/30 text-[#7eb89a]"
              }`}>
                {q.stage}
              </span>
              {!added && !isSaving && (
                <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
