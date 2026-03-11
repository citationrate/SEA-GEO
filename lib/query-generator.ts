/**
 * Deterministic query generation engine.
 * Generates 3 families of queries: Generali, Verticali, Personas.
 * Each family uses layers A/B/C × TOFU/MOFU.
 */

export interface GenerationInputs {
  categoria: string;
  mercato?: string;
  use_cases: string[];
  criteri: string[];
  must_have: string[];
  vincoli?: string;
  obiezioni?: string;
  linguaggio_mercato?: string;
  ruolo?: string;
  dimensione_azienda?: string;
  personas_enabled: boolean;
  personas: Persona[];
}

export interface Persona {
  id: string;
  mode: "demographic" | "decision_drivers";
  zona?: string;
  contesto_uso?: string;
  ruolo?: string;
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
  const criterio1 = inputs.criteri[0] || "qualità e affidabilità";
  const criterio2 = inputs.criteri[1] || "rapporto qualità prezzo";
  const mustHave = inputs.must_have[0] || "";
  const vincolo = inputs.vincoli || "";
  const obiezione = inputs.obiezioni || "";

  // --- Family 1: GENERALI (Benchmark) ---
  queries.push({
    text: `Quali aziende sono considerate le migliori in ${cat}?`,
    set_type: "generale", layer: "A", funnel: "TOFU",
  });
  queries.push({
    text: `Se cerco ${cat} con ${criterio1}, quali realtà dovrei valutare?`,
    set_type: "generale", layer: "B", funnel: "TOFU",
  });
  queries.push({
    text: `Come si confrontano le principali aziende di ${cat}?`,
    set_type: "generale", layer: "A", funnel: "MOFU",
  });
  queries.push({
    text: `Per scegliere tra le opzioni di ${cat}, cosa conta di più su ${criterio1} e ${criterio2}?`,
    set_type: "generale", layer: "B", funnel: "MOFU",
  });

  // --- Family 2: VERTICALI (Use case + criteri) ---
  const useCases = inputs.use_cases.length > 0 ? inputs.use_cases : [cat];

  for (const uc of useCases) {
    queries.push({
      text: `Chi mi consiglieresti per ${uc} in ${cat}?`,
      set_type: "verticale", layer: "A", funnel: "TOFU",
    });
    queries.push({
      text: mustHave
        ? `Per ${uc}, quali aziende sono forti su ${mustHave}?`
        : `Per ${uc}, quali aziende sono forti su ${criterio1}?`,
      set_type: "verticale", layer: "B", funnel: "TOFU",
    });
    if (vincolo) {
      queries.push({
        text: `Sto cercando ${cat} per ${uc}: quali opzioni sono più adatte se ${vincolo}?`,
        set_type: "verticale", layer: "C", funnel: "TOFU",
      });
    }
    queries.push({
      text: `Come scelgo tra le opzioni di ${cat} per ${uc}?`,
      set_type: "verticale", layer: "A", funnel: "MOFU",
    });
    queries.push({
      text: obiezione
        ? `Per ${uc}, quali realtà eccellono su ${criterio1} senza ${obiezione}?`
        : `Per ${uc}, quali realtà eccellono su ${criterio1}?`,
      set_type: "verticale", layer: "B", funnel: "MOFU",
    });
    if (mustHave && vincolo) {
      queries.push({
        text: `Ho bisogno di ${cat} per ${uc}: quali aziende soddisfano ${mustHave} anche con ${vincolo}?`,
        set_type: "verticale", layer: "C", funnel: "MOFU",
      });
    }
  }

  // --- Family 3: PERSONAS (opt-in only) ---
  if (inputs.personas_enabled && inputs.personas.length > 0) {
    const activePersonas = inputs.personas.slice(0, 3);

    for (const p of activePersonas) {
      if (p.mode === "demographic") {
        const zona = slot(p.zona, "nella mia zona");
        const contesto = slot(p.contesto_uso, cat);

        queries.push({
          text: `Sono ${zona}, cerco ${cat} per ${contesto}: chi mi consiglieresti?`,
          set_type: "persona", layer: "B", funnel: "TOFU",
          persona_mode: "demographic", persona_id: p.id,
        });
        queries.push({
          text: `Per ${contesto} in ${zona}, quali aziende di ${cat} sono migliori su ${criterio1}?`,
          set_type: "persona", layer: "B", funnel: "MOFU",
          persona_mode: "demographic", persona_id: p.id,
        });
      } else {
        // decision_drivers
        const ruolo = slot(p.ruolo, "decisore");
        const priorita = slot(p.priorita, criterio1);
        const pMustHave = slot(p.must_have, mustHave || criterio1);
        const noGo = slot(p.no_go, "");

        queries.push({
          text: `Come ${ruolo}, cerco ${cat} con priorità su ${priorita}: quali aziende valutare?`,
          set_type: "persona", layer: "B", funnel: "TOFU",
          persona_mode: "decision_drivers", persona_id: p.id,
        });
        queries.push({
          text: vincolo
            ? `Come ${ruolo} con budget ${vincolo} e must-have ${pMustHave}, quale ${cat} scelgo?`
            : `Come ${ruolo} con must-have ${pMustHave}, quale ${cat} scelgo?`,
          set_type: "persona", layer: "B", funnel: "MOFU",
          persona_mode: "decision_drivers", persona_id: p.id,
        });
        if (noGo) {
          queries.push({
            text: `Come ${ruolo}, devo scegliere ${cat}: chi esclude ${noGo} e garantisce ${pMustHave}?`,
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
