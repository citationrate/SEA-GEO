export type Pillar =
  | "recognition"
  | "clarity"
  | "authority"
  | "relevance"
  | "sentiment";

export const PILLARS: Pillar[] = [
  "recognition",
  "clarity",
  "authority",
  "relevance",
  "sentiment",
];

export interface PromptContext {
  brand: string;
  sector: string;
  country: string;
  locale: string;
}

export interface BrandProfilePrompt {
  pillar: Pillar;
  index: number;
  text: string;
}

const COUNTRY_NAME_IT: Record<string, string> = {
  IT: "Italia",
  US: "Stati Uniti",
  GB: "Regno Unito",
  ES: "Spagna",
  FR: "Francia",
  DE: "Germania",
};

const COUNTRY_NAME_EN: Record<string, string> = {
  IT: "Italy",
  US: "United States",
  GB: "United Kingdom",
  ES: "Spain",
  FR: "France",
  DE: "Germany",
};

function countryName(code: string, locale: string): string {
  const map = locale === "it" ? COUNTRY_NAME_IT : COUNTRY_NAME_EN;
  return map[code.toUpperCase()] ?? code;
}

const TEMPLATES_IT: Record<Pillar, string[]> = {
  recognition: [
    "Quali sono i principali brand del settore {sector} in {country}? Elenca i primi che ti vengono in mente con una breve descrizione di ciascuno.",
    "Stila una top 10 dei brand più riconosciuti nel settore {sector} in {country}, in ordine di notorietà.",
    "Chi sono i leader di mercato nel settore {sector} in {country}? Indica nome, posizione approssimativa e perché sono leader.",
  ],
  clarity: [
    "Chi è {brand}? Descrivilo in 3-5 frasi indicando settore, sede e attività principale.",
    "Per il brand {brand}, indica: sede principale, CEO o fondatore e anno di fondazione. Se non sei certo di un dato, dichiaralo.",
    "Qual è il settore esatto in cui opera {brand} e in cosa si differenzia dai competitor diretti?",
  ],
  authority: [
    "Chi sono gli esperti più riconosciuti nel settore {sector} in {country}? Indica nomi e affiliazioni.",
    "Quali sono le fonti più affidabili (testate, istituti, blog di settore) che coprono il mercato {sector} in {country}?",
    "Chi ha pubblicato analisi o ricerche di rilievo sul mercato {sector} in {country} negli ultimi due anni?",
  ],
  relevance: [
    "Quali prodotti o servizi offre {brand}? Elencali con una breve descrizione di ciascuno.",
    "Per cosa è conosciuto {brand} nel settore {sector}? Quali sono i suoi punti di forza distintivi?",
    "Se cercassi una soluzione professionale nel settore {sector} in {country}, quali brand mi consiglieresti? Motiva la risposta.",
  ],
  sentiment: [
    "Consiglieresti {brand} a un amico o collega che cerca un partner nel settore {sector}? Spiega perché.",
    "Qual è la reputazione attuale di {brand} sul mercato? Cita aspetti positivi e negativi.",
    "Confronta {brand} con i principali competitor del settore {sector}: indica pro e contro per ciascuno.",
  ],
};

const TEMPLATES_EN: Record<Pillar, string[]> = {
  recognition: [
    "Which are the main brands in the {sector} sector in {country}? List the first ones that come to mind with a brief description of each.",
    "Compile a top 10 of the most recognized brands in the {sector} sector in {country}, ordered by notoriety.",
    "Who are the market leaders in the {sector} sector in {country}? Provide name, approximate ranking and why they are leaders.",
  ],
  clarity: [
    "Who is {brand}? Describe it in 3-5 sentences mentioning sector, headquarters and main activity.",
    "For the brand {brand}, provide: main headquarters, CEO or founder, and year of foundation. If you are unsure of any data point, state so.",
    "In which exact sector does {brand} operate and how does it differ from its direct competitors?",
  ],
  authority: [
    "Who are the most recognized experts in the {sector} sector in {country}? Provide names and affiliations.",
    "Which are the most reliable sources (publications, institutes, sector blogs) covering the {sector} market in {country}?",
    "Who has published notable analyses or research on the {sector} market in {country} in the last two years?",
  ],
  relevance: [
    "Which products or services does {brand} offer? List them with a brief description of each.",
    "What is {brand} known for in the {sector} sector? What are its distinctive strengths?",
    "If I were looking for a professional solution in the {sector} sector in {country}, which brands would you recommend? Motivate your answer.",
  ],
  sentiment: [
    "Would you recommend {brand} to a friend or colleague looking for a partner in the {sector} sector? Explain why.",
    "What is the current reputation of {brand} in the market? Mention positive and negative aspects.",
    "Compare {brand} with the main competitors in the {sector} sector: indicate pros and cons for each.",
  ],
};

function fill(template: string, ctx: PromptContext): string {
  return template
    .replaceAll("{brand}", ctx.brand)
    .replaceAll("{sector}", ctx.sector)
    .replaceAll("{country}", countryName(ctx.country, ctx.locale));
}

export function buildPrompts(ctx: PromptContext): BrandProfilePrompt[] {
  const templates = ctx.locale === "it" ? TEMPLATES_IT : TEMPLATES_EN;
  const out: BrandProfilePrompt[] = [];
  for (const pillar of PILLARS) {
    templates[pillar].forEach((tpl, index) => {
      out.push({ pillar, index, text: fill(tpl, ctx) });
    });
  }
  return out;
}
