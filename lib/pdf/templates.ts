import { marked } from "marked";
import { PALETTE, escapeHtml, scoreToColor, scoreVerdict } from "./styles";

const RESPONSE_CHAR_CAP = 8000;

function stripDangerousMarkup(text: string): string {
  return text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

export function renderMarkdown(text: string | null | undefined): string {
  if (!text) return "";
  const cleaned = stripDangerousMarkup(text);
  marked.setOptions({ breaks: true, gfm: true });
  return marked.parse(cleaned, { async: false }) as string;
}

export function truncateResponse(text: string | null | undefined): {
  body: string;
  truncated: boolean;
} {
  if (!text) return { body: "", truncated: false };
  if (text.length <= RESPONSE_CHAR_CAP) return { body: text, truncated: false };
  return { body: text.slice(0, RESPONSE_CHAR_CAP), truncated: true };
}

export function cleanPromptForDisplay(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/^\s*IMPORTANT:\s*You MUST respond ONLY in[^\n]*\.\s*\n+/i, "")
    .trim();
}

export interface KpiCell {
  val: string | number;
  label: string;
  color?: string;
}

export function renderKpiRow(kpis: KpiCell[]): string {
  return `
    <div class="kpi-row">
      ${kpis
        .map(
          (k) => `
        <div class="kpi-cell">
          <div class="kpi-val" ${k.color ? `style="color:${k.color}"` : ""}>${escapeHtml(k.val)}</div>
          <div class="kpi-lbl">${escapeHtml(k.label)}</div>
        </div>`
        )
        .join("")}
    </div>
  `;
}

export interface BarComponent {
  label: string;
  value: number;
  color: string;
  qualifier?: string | null;
}

export function renderBars(items: BarComponent[]): string {
  return items
    .map((c) => {
      const v = Math.max(0, Math.min(100, c.value));
      return `
      <div class="bar-row">
        <span class="bar-label">${escapeHtml(c.label)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${v}%;background:${c.color}"></div></div>
        <span class="bar-val">${Math.round(c.value)}${c.qualifier ? `<span class="bar-qualifier">· ${escapeHtml(c.qualifier)}</span>` : ""}</span>
      </div>`;
    })
    .join("");
}

export interface TableColumn {
  label: string;
  width?: string;
  align?: "left" | "right";
}

export function renderTable(
  columns: TableColumn[],
  rows: (string | number)[][],
  opts: { alternating?: boolean } = {}
): string {
  if (rows.length === 0) return "";
  return `
    <table>
      <thead>
        <tr>${columns.map((c) => `<th${c.width ? ` style="width:${c.width}"` : ""}${c.align === "right" ? ` style="text-align:right"` : ""}>${escapeHtml(c.label)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r, i) => `
          <tr${opts.alternating && i % 2 === 1 ? ' class="alt"' : ""}>
            ${r
              .map((cell, idx) => {
                const col = columns[idx];
                const isNum = col?.align === "right";
                return `<td${isNum ? ' class="num"' : ""}>${escapeHtml(cell)}</td>`;
              })
              .join("")}
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export function renderChips(
  items: { name: string; count?: number }[],
  max = 60
): string {
  return `<div class="chips">${items
    .slice(0, max)
    .map(
      (it) =>
        `<span class="chip">${escapeHtml(it.name)}${it.count != null ? `<span class="chip-count">(${it.count})</span>` : ""}</span>`
    )
    .join("")}</div>`;
}

export function renderEmpty(text: string): string {
  return `<p style="color:${PALETTE.textMuted};padding:8pt 0;font-size:9pt;font-style:italic">${escapeHtml(text)}</p>`;
}

export interface TranscriptItem {
  index: number;
  model: string;
  brand: string;
  rank: number | null;
  fullPrompt: string;
  rawResponse: string | null;
  errorText?: string | null;
  runVersion?: number | null;
  runDate?: string | null;
}

export interface TranscriptStrings {
  title: string;
  intro: string;
  promptLabel: string;
  responseLabel: string;
  truncatedNote: string;
  emptyResponse: string;
  emptySection: string;
  rankLabel: string;
  brandMentioned: string;
  brandNotMentioned: string;
}

export function renderTranscriptAppendix(
  items: TranscriptItem[],
  s: TranscriptStrings
): string {
  if (items.length === 0) {
    return `
      <div class="appendix-cover">
        <h2 class="section">${escapeHtml(s.title)}</h2>
        <p class="appendix-intro">${escapeHtml(s.emptySection)}</p>
      </div>`;
  }

  const body = items
    .map((it) => {
      const { body: respBody, truncated } = truncateResponse(it.rawResponse);
      const responseHtml = respBody
        ? renderMarkdown(respBody)
        : `<p class="transcript-empty">${escapeHtml(s.emptyResponse)}</p>`;

      const meta: string[] = [];
      meta.push(`<span class="badge">#${it.index}</span>`);
      meta.push(`<span class="badge badge-model">${escapeHtml(it.model)}</span>`);
      if (it.runVersion != null) {
        meta.push(`<span class="badge">v${it.runVersion}${it.runDate ? ` · ${escapeHtml(it.runDate)}` : ""}</span>`);
      }
      meta.push(
        `<span class="badge">${escapeHtml(it.brand ? s.brandMentioned : s.brandNotMentioned)}</span>`
      );
      if (it.rank != null && it.rank > 0) {
        meta.push(`<span class="badge">${escapeHtml(s.rankLabel)} ${it.rank}</span>`);
      }

      return `
        <div class="transcript-item">
          <div class="transcript-meta">${meta.join(" ")}</div>
          <div class="transcript-prompt">
            <span class="lbl">${escapeHtml(s.promptLabel)}</span>
            ${escapeHtml(cleanPromptForDisplay(it.fullPrompt))}
          </div>
          <div class="transcript-response">
            <span class="lbl">${escapeHtml(s.responseLabel)}</span>
            ${responseHtml}
            ${truncated ? `<div class="transcript-truncated">${escapeHtml(s.truncatedNote)}</div>` : ""}
          </div>
        </div>`;
    })
    .join("");

  return `
    <div class="appendix-cover">
      <h2 class="section">${escapeHtml(s.title)}</h2>
      <p class="appendix-intro">${escapeHtml(s.intro)}</p>
      ${body}
    </div>`;
}

export interface DocumentShellArgs {
  title: string;
  bodyHtml: string;
  styles: string;
  lang: string;
}

export function buildDocument(args: DocumentShellArgs): string {
  return `<!DOCTYPE html>
<html lang="${escapeHtml(args.lang)}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(args.title)}</title>
  <style>${args.styles}</style>
</head>
<body>
  <div style="padding: 14mm 14mm 14mm 14mm;">
    ${args.bodyHtml}
  </div>
</body>
</html>`;
}

export interface LocaleStrings {
  reportSubtitle: string;
  projectReportSubtitle: string;
  positionHigh: string;
  positionMid: string;
  positionLow: string;
  whenCitedRank: string;
  transcriptOmitted: string;
  latest: string;
  sector: string;
  positionLower: string;
}

export function getLocaleStrings(locale: string): LocaleStrings {
  const map: Record<string, LocaleStrings> = {
    it: {
      reportSubtitle: "Report di visibilità AI",
      projectReportSubtitle: "Project report di visibilità AI",
      positionHigh: "alta",
      positionMid: "media",
      positionLow: "bassa",
      whenCitedRank: "quando citato, sei mediamente al",
      transcriptOmitted: "trascrizioni omesse: usa l'export per singola analisi per ottenerle tutte",
      latest: "ultima",
      sector: "Settore",
      positionLower: "posizione",
    },
    en: {
      reportSubtitle: "AI visibility report",
      projectReportSubtitle: "AI visibility project report",
      positionHigh: "high",
      positionMid: "medium",
      positionLow: "low",
      whenCitedRank: "when cited, your average rank is",
      transcriptOmitted: "transcripts omitted: use the per-analysis export to retrieve them all",
      latest: "latest",
      sector: "Sector",
      positionLower: "position",
    },
    fr: {
      reportSubtitle: "Rapport de visibilité IA",
      projectReportSubtitle: "Rapport projet de visibilité IA",
      positionHigh: "haute",
      positionMid: "moyenne",
      positionLow: "basse",
      whenCitedRank: "quand cité, votre rang moyen est",
      transcriptOmitted: "transcriptions omises : utilisez l'export par analyse pour les obtenir toutes",
      latest: "dernière",
      sector: "Secteur",
      positionLower: "position",
    },
    de: {
      reportSubtitle: "KI-Sichtbarkeitsbericht",
      projectReportSubtitle: "KI-Sichtbarkeits-Projektbericht",
      positionHigh: "hoch",
      positionMid: "mittel",
      positionLow: "niedrig",
      whenCitedRank: "wenn erwähnt, ist Ihr Durchschnittsrang",
      transcriptOmitted: "Transkripte ausgelassen: Nutzen Sie den Per-Analyse-Export, um alle zu erhalten",
      latest: "neueste",
      sector: "Branche",
      positionLower: "Position",
    },
    es: {
      reportSubtitle: "Informe de visibilidad IA",
      projectReportSubtitle: "Informe de proyecto de visibilidad IA",
      positionHigh: "alta",
      positionMid: "media",
      positionLow: "baja",
      whenCitedRank: "cuando citado, tu posición media es",
      transcriptOmitted: "transcripciones omitidas: usa la exportación por análisis para obtenerlas todas",
      latest: "última",
      sector: "Sector",
      positionLower: "posición",
    },
  };
  return map[locale] ?? map.it;
}

export function getTranscriptStrings(locale: string): TranscriptStrings {
  const map: Record<string, TranscriptStrings> = {
    it: {
      title: "Trascrizione completa",
      intro:
        "Per ogni prompt eseguito durante l'analisi: query inviata al modello e risposta integrale generata dall'AI.",
      promptLabel: "Query",
      responseLabel: "Risposta",
      truncatedNote: "(testo tagliato dopo 8.000 caratteri — vedi UI per testo completo)",
      emptyResponse: "Nessuna risposta registrata.",
      emptySection: "Nessun prompt eseguito in questa analisi.",
      rankLabel: "Posizione",
      brandMentioned: "Brand citato",
      brandNotMentioned: "Brand non citato",
    },
    en: {
      title: "Full transcript",
      intro:
        "For each prompt executed during the analysis: query sent to the model and full AI-generated response.",
      promptLabel: "Query",
      responseLabel: "Response",
      truncatedNote: "(text truncated after 8,000 characters — see UI for full text)",
      emptyResponse: "No response recorded.",
      emptySection: "No prompts were executed in this analysis.",
      rankLabel: "Rank",
      brandMentioned: "Brand mentioned",
      brandNotMentioned: "Brand not mentioned",
    },
    fr: {
      title: "Transcription complète",
      intro:
        "Pour chaque requête exécutée lors de l'analyse : requête envoyée au modèle et réponse complète générée par l'IA.",
      promptLabel: "Requête",
      responseLabel: "Réponse",
      truncatedNote: "(texte tronqué après 8 000 caractères — voir l'interface pour le texte complet)",
      emptyResponse: "Aucune réponse enregistrée.",
      emptySection: "Aucune requête exécutée dans cette analyse.",
      rankLabel: "Position",
      brandMentioned: "Marque citée",
      brandNotMentioned: "Marque non citée",
    },
    de: {
      title: "Vollständige Transkription",
      intro:
        "Für jede während der Analyse ausgeführte Anfrage: an das Modell gesendete Anfrage und vollständige KI-Antwort.",
      promptLabel: "Anfrage",
      responseLabel: "Antwort",
      truncatedNote: "(Text nach 8.000 Zeichen gekürzt — vollständiger Text in der UI)",
      emptyResponse: "Keine Antwort aufgezeichnet.",
      emptySection: "Keine Anfragen in dieser Analyse ausgeführt.",
      rankLabel: "Position",
      brandMentioned: "Marke erwähnt",
      brandNotMentioned: "Marke nicht erwähnt",
    },
    es: {
      title: "Transcripción completa",
      intro:
        "Para cada prompt ejecutado durante el análisis: consulta enviada al modelo y respuesta completa generada por la IA.",
      promptLabel: "Consulta",
      responseLabel: "Respuesta",
      truncatedNote: "(texto truncado tras 8.000 caracteres — ver la interfaz para el texto completo)",
      emptyResponse: "No se ha registrado respuesta.",
      emptySection: "No se ejecutó ningún prompt en este análisis.",
      rankLabel: "Posición",
      brandMentioned: "Marca mencionada",
      brandNotMentioned: "Marca no mencionada",
    },
  };
  return map[locale] ?? map.it;
}

export { PALETTE, escapeHtml, scoreToColor, scoreVerdict };
