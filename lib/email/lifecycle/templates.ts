/**
 * Lifecycle email templates — IT + EN.
 * 11 funzioni: 1A/1B/1C (recovery one-shot) + D1/D2/D3/D4_CS/D4_AVI/D5_CS/D5_AVI/D6 (drip).
 * Ogni funzione → { subject, html, preview }.
 */

import type { SupportedLang } from "./lang-detect";
import { emailButton, emailLayout, escapeHtml, paragraph, scoreZone, statTable } from "./styles";

export type EmailType =
  | "1A"
  | "1B"
  | "1C"
  | "D1"
  | "D2"
  | "D3"
  | "D4_CS"
  | "D4_AVI"
  | "D5_CS"
  | "D5_AVI"
  | "D6";

interface BaseInput {
  name: string;
  lang?: SupportedLang;
}

function withUtm(url: string, emailType: EmailType): string {
  const u = new URL(url);
  u.searchParams.set("utm_source", "lifecycle");
  u.searchParams.set("utm_medium", "email");
  u.searchParams.set("utm_campaign", emailType.toLowerCase());
  return u.toString();
}

const URL_AUDIT = "https://suite.citationrate.com/audit/new";
const URL_AVI = "https://avi.citationrate.com";
const URL_UPGRADE_BASE_CS = "https://suite.citationrate.com/upgrade?plan=base";
const URL_UPGRADE_BASE_AVI = "https://avi.citationrate.com/upgrade?plan=base";

function nameOrDefault(name: string | null | undefined, lang: SupportedLang): string {
  if (name && name.trim()) return name.trim();
  return lang === "en" ? "there" : "ciao";
}

// ============================================================
// 1A — Iscritti zero azioni (recovery one-shot)
// ============================================================
export function tpl1A(input: BaseInput & { daysSinceSignup: number }) {
  const lang = input.lang || "it";
  const n = nameOrDefault(input.name, lang);
  const days = input.daysSinceSignup;

  if (lang === "en") {
    const subject = `Your free audit + 40 AVI prompts are waiting, ${n}`;
    const html = emailLayout({
      lang,
      preview: `Your free audit is ready, takes 30 seconds, no payment required.`,
      bodyInner: [
        paragraph(`Hi ${escapeHtml(n)},`),
        paragraph(
          `you signed up to CitationRate ${days} day${days === 1 ? "" : "s"} ago but haven't started your first audit yet. It's free, takes 30 seconds and requires no payment.`,
        ),
        paragraph(
          `More and more people are searching on AI engines before going to Google. If you're not there, you're losing leads in the channel that's growing fastest.`,
        ),
        paragraph(
          `With your free audit we check whether your business appears in answers from ChatGPT, Claude, Gemini, Perplexity, Copilot, AIMode and Grok.`,
        ),
        emailButton(withUtm(URL_AUDIT, "1A"), "Start your free audit"),
        paragraph(
          `If you'd rather try AVI (multi-LLM analysis on branded prompts), you have 40 free prompts ready: <a href="${escapeHtml(withUtm(URL_AVI, "1A"))}">Open AVI</a>.`,
        ),
      ].join(""),
    });
    return { subject, html };
  }

  const subject = `Hai 1 audit + 40 prompt AVI in attesa, ${n}`;
  const html = emailLayout({
    lang,
    preview: `Il tuo audit gratuito è pronto, dura 30 secondi e non richiede alcun pagamento.`,
    bodyInner: [
      paragraph(`Ciao ${escapeHtml(n)},`),
      paragraph(
        `ti sei registrato a CitationRate ${days} giorni fa ma non hai ancora avviato il tuo primo audit. È gratuito, dura 30 secondi e non richiede alcun pagamento.`,
      ),
      paragraph(
        `Sempre più persone cercano sui motori AI prima di passare a Google. Se non ci sei, perdi lead nel canale che cresce più velocemente.`,
      ),
      paragraph(
        `Con il tuo audit gratuito vediamo se la tua azienda compare nelle risposte di ChatGPT, Claude, Gemini, Perplexity, Copilot, AIMode e Grok.`,
      ),
      emailButton(withUtm(URL_AUDIT, "1A"), "Avvia il tuo audit gratuito"),
      paragraph(
        `Se preferisci AVI (analisi multi-LLM su prompt branded), hai 40 prompt gratuiti pronti: <a href="${escapeHtml(withUtm(URL_AVI, "1A"))}">Apri AVI</a>.`,
      ),
    ].join(""),
  });
  return { subject, html };
}

// ============================================================
// 1B — Demo CS esauriti, score basso (recovery one-shot)
// ============================================================
interface AuditScores {
  global: number;
  perEngine?: Partial<Record<"ChatGPT" | "Claude" | "Gemini" | "Perplexity" | "Copilot" | "AIMode" | "Grok", number>>;
}

export function tpl1B(input: BaseInput & { brand: string; scores: AuditScores; sector?: string }) {
  const lang = input.lang || "it";
  const n = nameOrDefault(input.name, lang);
  const { brand, scores } = input;
  const zone = scoreZone(scores.global, lang);

  const engineRows: Array<[string, string]> = [];
  const engines = ["ChatGPT", "Claude", "Gemini", "Perplexity", "Copilot", "AIMode", "Grok"] as const;
  for (const e of engines) {
    const v = scores.perEngine?.[e];
    if (v !== undefined && v !== null) engineRows.push([e, `${Math.round(v)}/100`]);
  }

  if (lang === "en") {
    const subject = `${brand}: your audit is ready`;
    const html = emailLayout({
      lang,
      preview: `Score ${Math.round(scores.global)}/100 — let's see how to make ${brand} more citable.`,
      bodyInner: [
        paragraph(`Hi ${escapeHtml(n)},`),
        paragraph(`your audit for <strong>${escapeHtml(brand)}</strong> is complete:`),
        statTable([
          ["Global score", `<strong>${Math.round(scores.global)}/100</strong> (${zone})`],
          ...engineRows,
        ]),
        paragraph(
          `In some areas ${escapeHtml(brand)} performs well, in others there's room for improvement. Without knowing exactly WHERE to act you make changes blindly, and the AI engines keep ignoring you — meaning lost visibility in the channel where buying decisions are migrating.`,
        ),
        paragraph(`With the Base plan we look together at what to fix to be more citable by AI engines:`),
        emailButton(withUtm(URL_UPGRADE_BASE_CS, "1B"), "Upgrade to Base"),
      ].join(""),
    });
    return { subject, html };
  }

  const subject = `${brand}: il tuo audit è pronto`;
  const html = emailLayout({
    lang,
    preview: `Score ${Math.round(scores.global)}/100 — vediamo come rendere ${brand} più citabile dai motori AI.`,
    bodyInner: [
      paragraph(`Ciao ${escapeHtml(n)},`),
      paragraph(`il tuo audit per <strong>${escapeHtml(brand)}</strong> è completo:`),
      statTable([
        ["Score globale", `<strong>${Math.round(scores.global)}/100</strong> (${zone})`],
        ...engineRows,
      ]),
      paragraph(
        `In alcune aree ${escapeHtml(brand)} se la cava bene, in altre c'è margine di miglioramento. Senza sapere esattamente DOVE intervenire si fanno modifiche alla cieca, e i motori AI continuano a non citarti — significa visibilità persa proprio nel canale dove la decisione di acquisto sta migrando.`,
      ),
      paragraph(`Con il piano Base scopriamo insieme cosa modificare per essere più citabili dai motori AI:`),
      emailButton(withUtm(URL_UPGRADE_BASE_CS, "1B"), "Passa a Base"),
    ].join(""),
  });
  return { subject, html };
}

// ============================================================
// 1C — AVI score basso (recovery one-shot)
// ============================================================
interface AviResult {
  aviScore: number;
  presence: number;
  sentiment: number;
  avgRank?: number | null;
}

export function tpl1C(input: BaseInput & { brand: string; country?: string | null; result: AviResult }) {
  const lang = input.lang || "it";
  const n = nameOrDefault(input.name, lang);
  const { brand, country, result } = input;
  const presenceRound = Math.round(result.presence);

  if (lang === "en") {
    const subject = `${brand} on AI engines: AVI ${Math.round(result.aviScore)}/100`;
    const html = emailLayout({
      lang,
      preview: `Presence ${presenceRound}% — competitors take the conversation in the rest.`,
      bodyInner: [
        paragraph(`Hi ${escapeHtml(n)},`),
        paragraph(`your AVI run for <strong>${escapeHtml(brand)}</strong>${country ? ` (${escapeHtml(country)})` : ""}:`),
        statTable([
          ["AVI", `<strong>${Math.round(result.aviScore)}/100</strong>`],
          ["Presence", `${presenceRound}%`],
          ["Sentiment", `${Math.round(result.sentiment)}/100`],
          ...(result.avgRank ? ([["Avg position when cited", String(result.avgRank.toFixed(1))]] as Array<[string, string]>) : []),
        ]),
        paragraph(
          `When a customer asks AI engines for advice in your industry, ${escapeHtml(brand)} appears only ${presenceRound}% of the time. Translation: in the remaining ${100 - presenceRound} requests out of 100, a competitor takes the conversation (and the lead).`,
        ),
        paragraph(`The free demo uses 40 fixed no-browsing prompts. With Base you have:`),
        paragraph(
          `&bull; 30 prompts with live web browsing<br>&bull; 100 no-browsing prompts (over 3x the demo)<br>&bull; 3 AI models you choose<br>&bull; Multiple runs to track delta over time`,
        ),
        emailButton(withUtm(URL_UPGRADE_BASE_AVI, "1C"), "Upgrade to Base"),
      ].join(""),
    });
    return { subject, html };
  }

  const subject = `${brand} sui motori AI: AVI ${Math.round(result.aviScore)}/100`;
  const html = emailLayout({
    lang,
    preview: `Presenza ${presenceRound}% — i competitor si prendono la conversazione nel resto.`,
    bodyInner: [
      paragraph(`Ciao ${escapeHtml(n)},`),
      paragraph(`il tuo run AVI per <strong>${escapeHtml(brand)}</strong>${country ? ` (${escapeHtml(country)})` : ""}:`),
      statTable([
        ["AVI complessivo", `<strong>${Math.round(result.aviScore)}/100</strong>`],
        ["Presenza", `${presenceRound}%`],
        ["Sentiment", `${Math.round(result.sentiment)}/100`],
        ...(result.avgRank ? ([["Posizione media quando citato", result.avgRank.toFixed(1)]] as Array<[string, string]>) : []),
      ]),
      paragraph(
        `Quando un cliente chiede consigli ai motori AI sul tuo settore, ${escapeHtml(brand)} appare solo nel ${presenceRound}% dei casi. Tradotto: nelle restanti ${100 - presenceRound} richieste su 100, è un competitor a prendersi la conversazione (e il lead).`,
      ),
      paragraph(`La demo gratuita usa 40 prompt no-browsing fissi. Con il piano Base hai a disposizione:`),
      paragraph(
        `&bull; 30 prompt con web browsing live (vedere come ChatGPT ti cerca davvero)<br>&bull; 100 prompt no-browsing (più del triplo della demo)<br>&bull; 3 modelli AI selezionabili<br>&bull; Run multipli per misurare il delta nel tempo`,
      ),
      emailButton(withUtm(URL_UPGRADE_BASE_AVI, "1C"), "Passa a Base"),
    ].join(""),
  });
  return { subject, html };
}

// ============================================================
// D1 — Signup +24h, zero azioni
// ============================================================
export function tplD1(input: BaseInput) {
  const lang = input.lang || "it";
  const n = nameOrDefault(input.name, lang);
  if (lang === "en") {
    const subject = `Ready for your first audit, ${n}?`;
    const html = emailLayout({
      lang,
      preview: `1 free audit + 40 AVI prompts in 30 seconds.`,
      bodyInner: [
        paragraph(`Hi ${escapeHtml(n)},`),
        paragraph(
          `yesterday you signed up to CitationRate. Just a reminder that you have 1 free audit + 40 AVI prompts ready to go.`,
        ),
        paragraph(`In 30 seconds you'll know whether your business exists for:`),
        paragraph(`&bull; ChatGPT<br>&bull; Claude<br>&bull; Gemini<br>&bull; Perplexity<br>&bull; Copilot<br>&bull; AIMode<br>&bull; Grok`),
        emailButton(withUtm(URL_AUDIT, "D1"), "Start now"),
        paragraph(`If you prefer AVI: <a href="${escapeHtml(withUtm(URL_AVI, "D1"))}">${escapeHtml(URL_AVI)}</a>`),
      ].join(""),
    });
    return { subject, html };
  }
  const subject = `Pronto per il tuo primo audit, ${n}?`;
  const html = emailLayout({
    lang,
    preview: `1 audit + 40 prompt AVI gratuiti, in 30 secondi.`,
    bodyInner: [
      paragraph(`Ciao ${escapeHtml(n)},`),
      paragraph(
        `ieri ti sei iscritto a CitationRate. Ti scriviamo solo per ricordarti che hai 1 audit + 40 prompt AVI gratuiti, pronti per essere usati.`,
      ),
      paragraph(`In 30 secondi capisci se la tua azienda esiste per:`),
      paragraph(`&bull; ChatGPT<br>&bull; Claude<br>&bull; Gemini<br>&bull; Perplexity<br>&bull; Copilot<br>&bull; AIMode<br>&bull; Grok`),
      emailButton(withUtm(URL_AUDIT, "D1"), "Avvia ora"),
      paragraph(`Se preferisci AVI: <a href="${escapeHtml(withUtm(URL_AVI, "D1"))}">${escapeHtml(URL_AVI)}</a>`),
    ].join(""),
  });
  return { subject, html };
}

// ============================================================
// D2 — Signup +72h, zero azioni
// ============================================================
export function tplD2(input: BaseInput & { sector?: string; city?: string }) {
  const lang = input.lang || "it";
  const n = nameOrDefault(input.name, lang);
  const sector = input.sector || (lang === "en" ? "your industry" : "il tuo settore");
  const city = input.city || (lang === "en" ? "your area" : "Italia");
  if (lang === "en") {
    const subject = `Does your business exist for ChatGPT?`;
    const html = emailLayout({
      lang,
      preview: `Try the test — for most brands the answer is no.`,
      bodyInner: [
        paragraph(`Hi ${escapeHtml(n)},`),
        paragraph(
          `try asking ChatGPT <em>"Who are the best ${escapeHtml(sector)} in ${escapeHtml(city)}?"</em>. Does your business appear in the answer?`,
        ),
        paragraph(`For most brands the answer is no — even brands with great SEO on Google.`),
        paragraph(
          `People searching on AI engines are typically already in the decision phase, ready to buy. If you're not there, that lead goes to a competitor.`,
        ),
        paragraph(
          `CitationRate measures exactly this, across the 7 main AI engines (ChatGPT, Claude, Gemini, Perplexity, Copilot, AIMode, Grok).`,
        ),
        paragraph(`You have 1 audit + 40 free prompts ready:`),
        emailButton(withUtm(URL_AUDIT, "D2"), "Start in 30 seconds"),
      ].join(""),
    });
    return { subject, html };
  }
  const subject = `La tua azienda esiste per ChatGPT?`;
  const html = emailLayout({
    lang,
    preview: `Prova il test — per la maggior parte dei brand la risposta è no.`,
    bodyInner: [
      paragraph(`Ciao ${escapeHtml(n)},`),
      paragraph(
        `prova a chiedere a ChatGPT <em>"Quali sono i migliori ${escapeHtml(sector)} in ${escapeHtml(city)}?"</em>. La tua azienda compare nella risposta?`,
      ),
      paragraph(`Per la maggior parte dei brand la risposta è no — anche per chi ha SEO ottimo su Google.`),
      paragraph(
        `Chi cerca sui motori AI tipicamente è già in fase decisionale e ha intenzione di comprare. Se non ci sei, quel lead va a un competitor.`,
      ),
      paragraph(
        `CitationRate misura esattamente questo, sui 7 motori AI principali (ChatGPT, Claude, Gemini, Perplexity, Copilot, AIMode, Grok).`,
      ),
      paragraph(`Hai 1 audit + 40 prompt gratuiti in attesa:`),
      emailButton(withUtm(URL_AUDIT, "D2"), "Inizia in 30 secondi"),
    ].join(""),
  });
  return { subject, html };
}

// ============================================================
// D3 — Signup +7gg, zero azioni
// ============================================================
export function tplD3(input: BaseInput) {
  const lang = input.lang || "it";
  const n = nameOrDefault(input.name, lang);
  if (lang === "en") {
    const subject = `Last reminder, ${n}`;
    const html = emailLayout({
      lang,
      preview: `Your free audit is still waiting, no expiration.`,
      bodyInner: [
        paragraph(`Hi ${escapeHtml(n)},`),
        paragraph(
          `you signed up to CitationRate a week ago and haven't started an audit yet. Happens — too many things to do, little time to try new tools.`,
        ),
        paragraph(`Your free audit (1 CS + 40 AVI prompts) is still waiting, no expiration:`),
        emailButton(withUtm(URL_AUDIT, "D3"), "Open CitationRate"),
      ].join(""),
    });
    return { subject, html };
  }
  const subject = `Ultimo promemoria, ${n}`;
  const html = emailLayout({
    lang,
    preview: `Il tuo audit gratuito resta in attesa senza scadenza.`,
    bodyInner: [
      paragraph(`Ciao ${escapeHtml(n)},`),
      paragraph(
        `ti sei registrato a CitationRate una settimana fa e non hai ancora avviato un audit. Capita: tante cose da fare, poco tempo per provare strumenti nuovi.`,
      ),
      paragraph(`Il tuo audit gratuito (1 CS + 40 prompt AVI) resta in attesa senza scadenza:`),
      emailButton(withUtm(URL_AUDIT, "D3"), "Apri CitationRate"),
    ].join(""),
  });
  return { subject, html };
}

// ============================================================
// D4 CS — Audit completato +1h
// ============================================================
export function tplD4_CS(input: BaseInput & { brand: string; auditId: string; scores: AuditScores }) {
  const lang = input.lang || "it";
  const n = nameOrDefault(input.name, lang);
  const { brand, auditId, scores } = input;
  const zone = scoreZone(scores.global, lang);
  const reportUrl = withUtm(`https://suite.citationrate.com/audit/${auditId}`, "D4_CS");

  const engineRows: Array<[string, string]> = [];
  const engines = ["ChatGPT", "Claude", "Gemini", "Perplexity", "Copilot", "AIMode", "Grok"] as const;
  for (const e of engines) {
    const v = scores.perEngine?.[e];
    if (v !== undefined && v !== null) engineRows.push([e, `${Math.round(v)}/100`]);
  }

  if (lang === "en") {
    return {
      subject: `${brand}: your report is ready`,
      html: emailLayout({
        lang,
        preview: `Score ${Math.round(scores.global)}/100 — open the full report.`,
        bodyInner: [
          paragraph(`Hi ${escapeHtml(n)},`),
          paragraph(`your audit for <strong>${escapeHtml(brand)}</strong> is complete:`),
          statTable([
            ["Global score", `<strong>${Math.round(scores.global)}/100</strong> (${zone})`],
            ...engineRows,
          ]),
          paragraph(
            `In some areas ${escapeHtml(brand)} performs well, in others less so. The demo shows the score but not the intervention details — the Base plan tells you exactly where and how to fix things to be more citable by AI engines.`,
          ),
          emailButton(reportUrl, "Open full report"),
          paragraph(
            `<a href="${escapeHtml(withUtm(URL_UPGRADE_BASE_CS, "D4_CS"))}">Upgrade to Base</a> to unlock the full breakdown.`,
          ),
        ].join(""),
      }),
    };
  }

  return {
    subject: `${brand}: il tuo report è pronto`,
    html: emailLayout({
      lang,
      preview: `Score ${Math.round(scores.global)}/100 — apri il report completo.`,
      bodyInner: [
        paragraph(`Ciao ${escapeHtml(n)},`),
        paragraph(`il tuo audit per <strong>${escapeHtml(brand)}</strong> è completo:`),
        statTable([
          ["Score globale", `<strong>${Math.round(scores.global)}/100</strong> (${zone})`],
          ...engineRows,
        ]),
        paragraph(
          `In alcune aree ${escapeHtml(brand)} si comporta bene, in altre meno. La demo ti mostra il punteggio ma non i dettagli di intervento — il piano Base ti dice esattamente dove e come correggere per essere più citabile dai motori AI.`,
        ),
        emailButton(reportUrl, "Apri il report completo"),
        paragraph(
          `<a href="${escapeHtml(withUtm(URL_UPGRADE_BASE_CS, "D4_CS"))}">Passa a Base</a> per sbloccare il dettaglio completo.`,
        ),
      ].join(""),
    }),
  };
}

// ============================================================
// D4 AVI — Run completato +1h
// ============================================================
export function tplD4_AVI(input: BaseInput & { brand: string; projectId: string; runId: string; result: AviResult }) {
  const lang = input.lang || "it";
  const n = nameOrDefault(input.name, lang);
  const { brand, projectId, runId, result } = input;
  const presenceRound = Math.round(result.presence);
  const resultsUrl = withUtm(
    `https://avi.citationrate.com/projects/${projectId}/runs/${runId}`,
    "D4_AVI",
  );

  if (lang === "en") {
    return {
      subject: `${brand}: your AVI run is ready`,
      html: emailLayout({
        lang,
        preview: `AVI ${Math.round(result.aviScore)}/100 — open the results.`,
        bodyInner: [
          paragraph(`Hi ${escapeHtml(n)},`),
          paragraph(`your first AVI run for <strong>${escapeHtml(brand)}</strong> is complete:`),
          statTable([
            ["AVI", `<strong>${Math.round(result.aviScore)}/100</strong>`],
            ["Presence", `${presenceRound}% on the 40 branded prompts`],
            ["Sentiment", `${Math.round(result.sentiment)}/100`],
            ...(result.avgRank ? ([["Avg position", result.avgRank.toFixed(1)]] as Array<[string, string]>) : []),
          ]),
          paragraph(
            `When a customer asks AI engines for advice in your industry, ${escapeHtml(brand)} appears in ${presenceRound}% of answers. The remaining ${100 - presenceRound}% goes to your competitors, and no traditional analytics tells you who they are or how often they outrank you.`,
          ),
          paragraph(`With the Base plan you get more prompts and models for the full picture:`),
          emailButton(resultsUrl, "Open results"),
          paragraph(`<a href="${escapeHtml(withUtm(URL_UPGRADE_BASE_AVI, "D4_AVI"))}">Upgrade to Base</a>`),
        ].join(""),
      }),
    };
  }

  return {
    subject: `${brand}: il tuo run AVI è pronto`,
    html: emailLayout({
      lang,
      preview: `AVI ${Math.round(result.aviScore)}/100 — apri i risultati.`,
      bodyInner: [
        paragraph(`Ciao ${escapeHtml(n)},`),
        paragraph(`il tuo primo run AVI per <strong>${escapeHtml(brand)}</strong> è completo:`),
        statTable([
          ["AVI", `<strong>${Math.round(result.aviScore)}/100</strong>`],
          ["Presenza", `${presenceRound}% sui 40 prompt branded`],
          ["Sentiment", `${Math.round(result.sentiment)}/100`],
          ...(result.avgRank ? ([["Posizione media", result.avgRank.toFixed(1)]] as Array<[string, string]>) : []),
        ]),
        paragraph(
          `Quando un cliente chiede consigli ai motori AI sul tuo settore, ${escapeHtml(brand)} appare nel ${presenceRound}% delle risposte. Significa che nel restante ${100 - presenceRound}% sono i tuoi competitor a guidare la conversazione, e nessun analytics tradizionale ti dice chi sono o quanto spesso ti superano.`,
        ),
        paragraph(`Con il piano Base hai più prompt e modelli per vedere il quadro completo:`),
        emailButton(resultsUrl, "Apri i risultati"),
        paragraph(`<a href="${escapeHtml(withUtm(URL_UPGRADE_BASE_AVI, "D4_AVI"))}">Passa a Base</a>`),
      ].join(""),
    }),
  };
}

// ============================================================
// D5 CS — Audit +3gg
// ============================================================
export function tplD5_CS(input: BaseInput & { brand: string; globalScore: number }) {
  const lang = input.lang || "it";
  const n = nameOrDefault(input.name, lang);
  const { brand, globalScore } = input;

  if (lang === "en") {
    return {
      subject: `What's in the Base plan, ${n}`,
      html: emailLayout({
        lang,
        preview: `The demo is a snapshot — Base shows what to fix.`,
        bodyInner: [
          paragraph(`Hi ${escapeHtml(n)},`),
          paragraph(
            `3 days ago you ran your first audit for ${escapeHtml(brand)}: ${Math.round(globalScore)}/100.`,
          ),
          paragraph(
            `The demo is a snapshot: it gives you the citability of ${escapeHtml(brand)}, but not WHAT to change to improve. Without that you make changes blindly and waste time.`,
          ),
          paragraph(`With Base we look together at some parameters and what to fix to be more citable by AI engines.`),
          emailButton(withUtm(URL_UPGRADE_BASE_CS, "D5_CS"), "Upgrade to Base"),
        ].join(""),
      }),
    };
  }

  return {
    subject: `Cosa c'è nel piano Base, ${n}`,
    html: emailLayout({
      lang,
      preview: `La demo è una fotografia — Base ti dice cosa modificare.`,
      bodyInner: [
        paragraph(`Ciao ${escapeHtml(n)},`),
        paragraph(
          `3 giorni fa hai fatto il tuo primo audit per ${escapeHtml(brand)}: ${Math.round(globalScore)}/100.`,
        ),
        paragraph(
          `La demo è una fotografia: ti fornisce la citabilità di ${escapeHtml(brand)}, ma non COSA modificare per migliorare. Senza questa indicazione si fanno cambi alla cieca e si perde tempo.`,
        ),
        paragraph(`Con Base vediamo insieme alcuni parametri e cosa correggere per essere più citabili dai motori AI.`),
        emailButton(withUtm(URL_UPGRADE_BASE_CS, "D5_CS"), "Passa a Base"),
      ].join(""),
    }),
  };
}

// ============================================================
// D5 AVI — Run +3gg
// ============================================================
export function tplD5_AVI(input: BaseInput & { brand: string; aviScore: number }) {
  const lang = input.lang || "it";
  const n = nameOrDefault(input.name, lang);
  const { brand, aviScore } = input;

  if (lang === "en") {
    return {
      subject: `What's beyond the 40 prompts, ${n}`,
      html: emailLayout({
        lang,
        preview: `Demo gives a general view — Base shows the real picture.`,
        bodyInner: [
          paragraph(`Hi ${escapeHtml(n)},`),
          paragraph(
            `3 days ago you ran your first AVI run for ${escapeHtml(brand)}: AVI ${Math.round(aviScore)}/100.`,
          ),
          paragraph(
            `The 40 demo prompts are no-browsing fixed: they give you a general overview. To see how AI engines actually search for you (with live web search), to compare with competitors and to use models in parallel, discover Base.`,
          ),
          paragraph(
            `Above all: with multiple runs you measure your AVI delta over time. If you don't monitor, you don't know whether your changes are working.`,
          ),
          emailButton(withUtm(URL_UPGRADE_BASE_AVI, "D5_AVI"), "Upgrade to Base"),
        ].join(""),
      }),
    };
  }

  return {
    subject: `Cosa c'è oltre i 40 prompt, ${n}`,
    html: emailLayout({
      lang,
      preview: `La demo dà una situazione generale — Base mostra il quadro reale.`,
      bodyInner: [
        paragraph(`Ciao ${escapeHtml(n)},`),
        paragraph(
          `3 giorni fa hai fatto il tuo primo run AVI per ${escapeHtml(brand)}: AVI ${Math.round(aviScore)}/100.`,
        ),
        paragraph(
          `I 40 prompt della demo sono no-browsing fissi, ti fornisce una situazione generale. Per vedere come i motori AI ti cercano DAVVERO (con web search live), per confrontarti con i competitor e per usare modelli in parallelo scopri Base.`,
        ),
        paragraph(
          `Soprattutto: con run multipli misuri il delta del tuo AVI nel tempo. Se non monitori, non sai se le modifiche che fai stanno funzionando.`,
        ),
        emailButton(withUtm(URL_UPGRADE_BASE_AVI, "D5_AVI"), "Passa a Base"),
      ].join(""),
    }),
  };
}

// ============================================================
// D6 — Pro/Base inattivo +5gg (timing dinamico)
// ============================================================
export function tplD6(input: BaseInput & { plan: "base" | "pro" | "enterprise"; daysSinceUpgrade: number; auditLimit: number }) {
  const lang = input.lang || "it";
  const n = nameOrDefault(input.name, lang);
  const planLabel = input.plan.charAt(0).toUpperCase() + input.plan.slice(1);

  if (lang === "en") {
    return {
      subject: `Everything ok with CitationRate, ${n}?`,
      html: emailLayout({
        lang,
        preview: `Quick check-in to make sure you're getting full value from your plan.`,
        bodyInner: [
          paragraph(`Hi ${escapeHtml(n)},`),
          paragraph(
            `${input.daysSinceUpgrade} days ago you subscribed to ${planLabel}, but we don't see any recent audits on your account. We want to make sure that:`,
          ),
          paragraph(
            `&bull; Nothing is blocking you<br>&bull; You know how to make the most of the ${input.auditLimit} audits in your cycle<br>&bull; You're aware of all the features`,
          ),
          paragraph(
            `Reply to this email to schedule a 15-minute call, or list your doubts or difficulties — we'll be happy to help!`,
          ),
        ].join(""),
      }),
    };
  }

  return {
    subject: `Tutto ok con CitationRate, ${n}?`,
    html: emailLayout({
      lang,
      preview: `Check rapido per assicurarci che stai sfruttando al meglio il tuo piano.`,
      bodyInner: [
        paragraph(`Ciao ${escapeHtml(n)},`),
        paragraph(
          `${input.daysSinceUpgrade} giorni fa hai sottoscritto ${planLabel}, ma non vediamo audit recenti dal tuo account. Vogliamo assicurarci che:`,
        ),
        paragraph(
          `&bull; Non ti si sia bloccato qualcosa<br>&bull; Tu sappia come sfruttare al meglio i ${input.auditLimit} audit del ciclo<br>&bull; Conosca tutte le features`,
        ),
        paragraph(
          `Rispondi a questa mail per organizzare una call di 15 minuti oppure elencaci i tuoi dubbi o difficoltà, saremo felici di aiutarti!`,
        ),
      ].join(""),
    }),
  };
}
