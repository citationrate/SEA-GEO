/**
 * Deterministic query generation engine.
 * Generates 3 families of queries: Generali, Verticali, Personas.
 * Each family uses layers A/B/C × TOFU/MOFU.
 */

export interface GenerationInputs {
  categoria: string;
  mercato?: string;
  luogo?: string;
  punti_di_forza: string[];
  competitor: string[];
  obiezioni: string[];
  ai_answers?: string[];
  personas_enabled: boolean;
  personas: Persona[];
  // Legacy fields (kept for backward compat with existing DB records)
  use_cases?: string[];
  criteri?: string[];
  must_have?: string[];
  vincoli?: string;
  linguaggio_mercato?: string;
  ruolo?: string;
  dimensione_azienda?: string;
}

export interface Persona {
  id: string;
  nome?: string;
  mode: "demographic" | "decision_drivers";
  // B2C
  zona?: string;
  contesto_uso?: string;
  eta?: string;
  sesso?: string;
  situazione?: string;
  // B2B
  ruolo?: string;
  settore?: string;
  problema?: string;
  priorita?: string;
  must_have?: string;
  no_go?: string;
}

export interface GeneratedQuery {
  text: string;
  set_type: "generale" | "verticale" | "persona";
  layer: "A" | "B" | "C";
  funnel: "TOFU" | "MOFU";
  persona_mode?: "demographic" | "decision_drivers";
  persona_id?: string;
}

function slot(val: string | undefined, fallback: string): string {
  return val?.trim() || fallback;
}

export function generateQueries(inputs: GenerationInputs): GeneratedQuery[] {
  const queries: GeneratedQuery[] = [];
  const cat = inputs.categoria;
  const forza1 = inputs.punti_di_forza[0] || "qualità e affidabilità";
  const forza2 = inputs.punti_di_forza[1] || "rapporto qualità prezzo";
  const comp1 = inputs.competitor[0] || "";
  const comp2 = inputs.competitor[1] || "";
  const obiezione1 = inputs.obiezioni[0] || "";
  const luogo = inputs.luogo || "";
  const mercato = inputs.mercato || "";

  // --- Family 1: GENERALI (Benchmark) ---
  queries.push({
    text: `Quali aziende sono considerate le migliori in ${cat}?`,
    set_type: "generale", layer: "A", funnel: "TOFU",
  });
  queries.push({
    text: `Se cerco ${cat} con ${forza1}, quali realtà dovrei valutare?`,
    set_type: "generale", layer: "B", funnel: "TOFU",
  });
  queries.push({
    text: `Come si confrontano le principali aziende di ${cat}?`,
    set_type: "generale", layer: "A", funnel: "MOFU",
  });
  queries.push({
    text: `Per scegliere tra le opzioni di ${cat}, cosa conta di più su ${forza1} e ${forza2}?`,
    set_type: "generale", layer: "B", funnel: "MOFU",
  });

  // --- Family 2: VERTICALI ---
  // Geo-localized queries
  if (luogo) {
    queries.push({
      text: `Chi mi consiglieresti per ${cat} a ${luogo}?`,
      set_type: "verticale", layer: "A", funnel: "TOFU",
    });
    queries.push({
      text: `Quali sono i migliori servizi di ${cat} disponibili a ${luogo}?`,
      set_type: "verticale", layer: "B", funnel: "TOFU",
    });
  }

  // Strength-based queries
  if (inputs.punti_di_forza.length > 0) {
    queries.push({
      text: `Chi eccelle in ${cat} per ${forza1}?`,
      set_type: "verticale", layer: "A", funnel: "TOFU",
    });
    if (inputs.punti_di_forza.length > 1) {
      queries.push({
        text: `Quale azienda di ${cat} combina meglio ${forza1} e ${forza2}?`,
        set_type: "verticale", layer: "B", funnel: "MOFU",
      });
    }
  }

  // Competitor comparison queries
  if (comp1) {
    queries.push({
      text: `Come si posiziona ${comp1} rispetto alle alternative in ${cat}?`,
      set_type: "verticale", layer: "A", funnel: "MOFU",
    });
    if (comp2) {
      queries.push({
        text: `Sto valutando ${comp1} e ${comp2} per ${cat}: quale scegliere?`,
        set_type: "verticale", layer: "B", funnel: "MOFU",
      });
    }
  }

  // Objection-based queries
  if (obiezione1) {
    queries.push({
      text: `${cat}: è vero che ${obiezione1}? Quali alternative risolvono questo problema?`,
      set_type: "verticale", layer: "B", funnel: "TOFU",
    });
    queries.push({
      text: `Cerco ${cat} ma mi preoccupa ${obiezione1}: chi affronta meglio questo aspetto?`,
      set_type: "verticale", layer: "C", funnel: "MOFU",
    });
  }

  // Market-specific
  if (mercato) {
    queries.push({
      text: `Qual è il panorama di ${cat} nel mercato ${mercato}?`,
      set_type: "verticale", layer: "A", funnel: "TOFU",
    });
  }

  // --- Family 3: PERSONAS (opt-in only) ---
  if (inputs.personas_enabled && inputs.personas.length > 0) {
    const activePersonas = inputs.personas.slice(0, 3);

    for (const p of activePersonas) {
      if (p.mode === "demographic") {
        const situazione = slot(p.situazione, "");
        const eta = slot(p.eta, "");
        const contesto = situazione || (eta ? `${eta} anni` : cat);

        queries.push({
          text: situazione
            ? `Sono una persona che ${situazione}: quale ${cat} mi consigli?`
            : `Cerco ${cat} per ${contesto}: chi mi consiglieresti?`,
          set_type: "persona", layer: "B", funnel: "TOFU",
          persona_mode: "demographic", persona_id: p.id,
        });
        queries.push({
          text: `Per qualcuno che ${contesto}, quali aziende di ${cat} sono migliori su ${forza1}?`,
          set_type: "persona", layer: "B", funnel: "MOFU",
          persona_mode: "demographic", persona_id: p.id,
        });
      } else {
        // decision_drivers (B2B)
        const ruolo = slot(p.ruolo, "decisore");
        const problema = slot(p.problema, "");
        const settore = slot(p.settore, "");

        queries.push({
          text: problema
            ? `Come ${ruolo}${settore ? ` nel settore ${settore}` : ""}, cerco ${cat} per risolvere ${problema}: quali aziende valutare?`
            : `Come ${ruolo}${settore ? ` nel settore ${settore}` : ""}, cerco ${cat}: quali aziende valutare?`,
          set_type: "persona", layer: "B", funnel: "TOFU",
          persona_mode: "decision_drivers", persona_id: p.id,
        });
        queries.push({
          text: `Come ${ruolo}, devo scegliere ${cat}: chi eccelle su ${forza1}?`,
          set_type: "persona", layer: "B", funnel: "MOFU",
          persona_mode: "decision_drivers", persona_id: p.id,
        });
        if (p.no_go) {
          queries.push({
            text: `Come ${ruolo}, devo scegliere ${cat}: chi evita ${p.no_go} e garantisce ${slot(p.must_have, forza1)}?`,
            set_type: "persona", layer: "C", funnel: "MOFU",
            persona_mode: "decision_drivers", persona_id: p.id,
          });
        }
      }
    }
  }

  return queries;
}

export function calculateCost(
  inputs: GenerationInputs,
  modelsCount: number,
  runsPerPrompt: number,
): { total_queries: number; total_prompts: number } {
  const generated = generateQueries(inputs);
  const total_queries = generated.length;
  const total_prompts = total_queries * modelsCount * runsPerPrompt;
  return { total_queries, total_prompts };
}
