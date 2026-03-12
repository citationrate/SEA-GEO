"use client";

import { MessageSquare, Sparkles } from "lucide-react";

interface SuggestedQuery {
  text: string;
  stage: "tofu" | "mofu";
}

export type { SuggestedQuery };

/**
 * Suggested queries for the new project form.
 * Shows empty state with link to AI query generator.
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
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-3.5 h-3.5 text-primary" />
        <p className="text-sm font-medium text-foreground">Query</p>
      </div>
      <div className="border border-dashed border-border rounded-[2px] px-4 py-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Aggiungi le tue query personalizzate o usa il generatore AI
        </p>
        <p className="text-xs text-muted-foreground">
          Le query verranno aggiunte dopo la creazione del progetto
        </p>
      </div>
    </div>
  );
}

/**
 * Suggested queries for the edit project form.
 * Shows empty state with link to AI query generator.
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
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-3.5 h-3.5 text-primary" />
        <p className="text-sm font-medium text-foreground">Query suggerite</p>
      </div>
      <div className="border border-dashed border-border rounded-[2px] px-4 py-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Aggiungi le tue query personalizzate o usa il generatore AI
        </p>
        <a
          href={`/projects/${projectId}/queries/generate`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Genera Prompt con AI
          <span className="inline-flex items-center gap-0.5 font-mono text-[0.625rem] tracking-wide text-[#c4a882] border border-[#c4a882]/30 px-1 py-0.5 rounded-[2px]">&#10022; Pro</span>
          &rarr;
        </a>
      </div>
    </div>
  );
}
