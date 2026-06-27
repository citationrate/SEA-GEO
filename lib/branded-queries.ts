// Famiglia query BRANDED (sul nome del brand) = la "vittoria": l'AI quasi sempre
// ti cita. Entra nell'AVI col blend 50/50. Template per lingua, niente trattini.
// Usato dal wizard "genera con AI" (il seed di onboarding ha la sua copia inline).

export type BrandedQuery = { text: string; funnel_stage: "TOFU" | "MOFU"; set_type: "branded" };

const TEMPLATES: Record<string, (b: string) => Array<{ text: string; funnel_stage: "TOFU" | "MOFU" }>> = {
  it: (b) => [
    { text: `Cosa offre ${b} e per cosa si distingue?`, funnel_stage: "TOFU" },
    { text: `${b} è affidabile? Cosa dicono le recensioni?`, funnel_stage: "MOFU" },
  ],
  en: (b) => [
    { text: `What does ${b} offer and what makes it stand out?`, funnel_stage: "TOFU" },
    { text: `Is ${b} reliable? What do reviews say about it?`, funnel_stage: "MOFU" },
  ],
  fr: (b) => [
    { text: `Que propose ${b} et qu'est-ce qui le distingue ?`, funnel_stage: "TOFU" },
    { text: `${b} est-il fiable ? Que disent les avis ?`, funnel_stage: "MOFU" },
  ],
  de: (b) => [
    { text: `Was bietet ${b} und wodurch hebt es sich ab?`, funnel_stage: "TOFU" },
    { text: `Ist ${b} zuverlässig? Was sagen die Bewertungen?`, funnel_stage: "MOFU" },
  ],
  es: (b) => [
    { text: `¿Qué ofrece ${b} y en qué se distingue?`, funnel_stage: "TOFU" },
    { text: `¿${b} es fiable? ¿Qué dicen las reseñas?`, funnel_stage: "MOFU" },
  ],
};

export function brandedQueries(brand: string, lang?: string): BrandedQuery[] {
  const b = (brand || "").trim();
  if (!b) return [];
  const make = TEMPLATES[lang || "it"] || TEMPLATES.it;
  return make(b).map((q) => ({ ...q, set_type: "branded" as const }));
}
