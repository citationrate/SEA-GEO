export const PALETTE = {
  bg: "#ffffff",
  text: "#3a3a3a",
  textMuted: "#888888",
  textFaint: "#bbbbbb",
  border: "#e8e8e0",
  borderSubtle: "#f0ede4",
  surfaceAlt: "#fafaf6",
  primary: "#7ab098",
  primaryDark: "#5a9a82",
  red: "#cc6655",
  amber: "#d4a817",
  blue: "#5a8fb8",
  sage: "#7ab098",
  green: "#2d5d4a",
  presence: "#e8956d",
  position: "#7eb3d4",
  sentiment: "#7eb89a",
};

export function scoreToColor(score: number): string {
  if (score <= 30) return PALETTE.red;
  if (score <= 50) return PALETTE.amber;
  if (score <= 70) return PALETTE.blue;
  if (score <= 85) return PALETTE.sage;
  return PALETTE.green;
}

export function scoreVerdict(score: number, locale: string): string {
  const labels: Record<string, string[]> = {
    it: ["Critico", "Da migliorare", "Discreto", "Buono", "Eccellente"],
    en: ["Critical", "Needs work", "Fair", "Good", "Excellent"],
    fr: ["Critique", "À améliorer", "Correct", "Bon", "Excellent"],
    de: ["Kritisch", "Verbesserungswürdig", "Akzeptabel", "Gut", "Ausgezeichnet"],
    es: ["Crítico", "Por mejorar", "Aceptable", "Bueno", "Excelente"],
  };
  const arr = labels[locale] ?? labels.it;
  if (score <= 30) return arr[0];
  if (score <= 50) return arr[1];
  if (score <= 70) return arr[2];
  if (score <= 85) return arr[3];
  return arr[4];
}

export const STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    background: ${PALETTE.bg};
    color: ${PALETTE.text};
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* HEADER */
  .header {
    margin-bottom: 14pt;
    padding-bottom: 12pt;
    border-bottom: 0.8pt solid ${PALETTE.primary};
  }
  .brand-title {
    font-size: 22pt;
    font-weight: 300;
    color: ${PALETTE.primary};
    letter-spacing: -0.4pt;
    margin-bottom: 1pt;
  }
  .brand-subtitle {
    font-size: 7pt;
    color: ${PALETTE.textMuted};
    text-transform: uppercase;
    letter-spacing: 1.6pt;
    font-weight: 500;
  }

  /* PROJECT BLOCK */
  .project-name {
    font-size: 22pt;
    font-weight: 300;
    color: ${PALETTE.text};
    letter-spacing: -0.4pt;
    margin-top: 22pt;
    margin-bottom: 4pt;
  }
  .project-meta {
    font-size: 8.5pt;
    color: ${PALETTE.textMuted};
    line-height: 1.5;
  }
  .project-meta a { color: ${PALETTE.textMuted}; text-decoration: none; }

  /* BIG SCORE */
  .big-score-row {
    display: flex;
    align-items: baseline;
    gap: 8pt;
    margin-top: 16pt;
  }
  .big-score-num {
    font-size: 52pt;
    font-weight: 300;
    line-height: 1;
    letter-spacing: -1.5pt;
  }
  .big-score-suffix {
    font-size: 17pt;
    color: ${PALETTE.textFaint};
    font-weight: 300;
  }
  .big-score-label {
    font-size: 9pt;
    margin-top: 6pt;
    color: ${PALETTE.textMuted};
  }
  .big-score-label .verdict { font-weight: 500; }

  /* KPI CELLS */
  .kpi-row {
    display: table;
    width: 100%;
    margin-top: 16pt;
    margin-bottom: 16pt;
    border: 0.6pt solid ${PALETTE.border};
    border-radius: 1pt;
    table-layout: fixed;
  }
  .kpi-cell {
    display: table-cell;
    padding: 11pt 6pt;
    text-align: center;
    border-right: 0.6pt solid ${PALETTE.borderSubtle};
    vertical-align: middle;
  }
  .kpi-cell:last-child { border-right: none; }
  .kpi-val {
    font-size: 16pt;
    font-weight: 400;
    line-height: 1;
    margin-bottom: 4pt;
    color: ${PALETTE.text};
  }
  .kpi-lbl {
    font-size: 7pt;
    color: ${PALETTE.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.7pt;
  }

  /* SECTION HEADINGS */
  h2.section {
    font-size: 8.5pt;
    font-weight: 500;
    color: ${PALETTE.primary};
    text-transform: uppercase;
    letter-spacing: 1.6pt;
    margin: 22pt 0 8pt;
  }
  h3.subsection {
    font-size: 11pt;
    font-weight: 400;
    color: ${PALETTE.text};
    margin: 16pt 0 6pt;
  }
  h3.subsection .square {
    color: ${PALETTE.text};
    margin-right: 5pt;
    font-size: 9pt;
  }
  h3.subsection .pct { font-weight: 500; margin-left: 6pt; }

  /* PANORAMA ROWS */
  .panorama-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 8pt 0;
    border-bottom: 0.5pt solid ${PALETTE.borderSubtle};
    font-size: 9.5pt;
  }
  .panorama-row .square { color: ${PALETTE.text}; margin-right: 6pt; }
  .panorama-pct { font-weight: 500; }

  /* AVI BARS */
  .bar-row {
    display: flex;
    align-items: center;
    gap: 12pt;
    padding: 6pt 0;
  }
  .bar-label {
    flex: 0 0 90pt;
    font-size: 8pt;
    color: ${PALETTE.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.7pt;
  }
  .bar-track {
    flex: 1;
    height: 4pt;
    background: ${PALETTE.borderSubtle};
    border-radius: 2pt;
    overflow: hidden;
  }
  .bar-fill { height: 100%; border-radius: 2pt; }
  .bar-val {
    flex: 0 0 auto;
    min-width: 32pt;
    white-space: nowrap;
    font-size: 9pt;
    text-align: right;
    color: ${PALETTE.text};
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .bar-qualifier {
    font-size: 8pt;
    color: ${PALETTE.textMuted};
    margin-left: 6pt;
    font-weight: 400;
  }

  /* TABLES */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 4pt;
    font-size: 9pt;
  }
  th {
    text-align: left;
    padding: 7pt 8pt;
    color: ${PALETTE.textMuted};
    font-weight: 500;
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 1pt;
    border-bottom: 0.6pt solid ${PALETTE.border};
    background: ${PALETTE.bg};
  }
  td {
    padding: 7pt 8pt;
    border-bottom: 0.4pt solid ${PALETTE.borderSubtle};
    color: ${PALETTE.text};
    vertical-align: top;
  }
  tr.alt td { background: ${PALETTE.surfaceAlt}; }
  td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: ${PALETTE.textMuted};
    width: 60pt;
  }
  td.muted { color: ${PALETTE.textMuted}; }

  /* CHIPS */
  .chips { display: block; }
  .chip {
    display: inline-block;
    padding: 3pt 8pt;
    margin: 0 4pt 4pt 0;
    border-radius: 2pt;
    border: 0.5pt solid ${PALETTE.border};
    background: ${PALETTE.bg};
    font-size: 8.5pt;
    color: ${PALETTE.text};
  }
  .chip-count {
    color: ${PALETTE.textMuted};
    font-size: 7.5pt;
    margin-left: 3pt;
  }

  /* VERDICT PILL */
  .verdict-pill {
    display: inline-block;
    padding: 3pt 10pt;
    border-radius: 2pt;
    font-size: 8.5pt;
    font-weight: 500;
    margin-top: 10pt;
    border: 0.5pt solid ${PALETTE.border};
    background: ${PALETTE.surfaceAlt};
  }

  /* TRANSCRIPT APPENDIX */
  .appendix-cover { page-break-before: always; }
  .appendix-intro {
    color: ${PALETTE.textMuted};
    font-size: 9.5pt;
    margin-top: 4pt;
    margin-bottom: 18pt;
  }
  .transcript-item {
    margin-bottom: 18pt;
    padding-bottom: 14pt;
    border-bottom: 0.5pt solid ${PALETTE.borderSubtle};
    page-break-inside: avoid;
  }
  .transcript-meta {
    display: block;
    margin-bottom: 8pt;
    font-size: 8pt;
    color: ${PALETTE.textMuted};
  }
  .transcript-meta .badge {
    display: inline-block;
    padding: 2pt 7pt;
    margin-right: 5pt;
    background: ${PALETTE.surfaceAlt};
    border-radius: 2pt;
    border: 0.5pt solid ${PALETTE.borderSubtle};
    color: ${PALETTE.text};
    font-size: 7.5pt;
  }
  .transcript-meta .badge-model {
    color: ${PALETTE.primaryDark};
    border-color: ${PALETTE.primary};
  }
  .transcript-prompt {
    background: ${PALETTE.surfaceAlt};
    border: 0.5pt solid ${PALETTE.borderSubtle};
    padding: 10pt 12pt;
    margin-bottom: 8pt;
    border-radius: 2pt;
    font-size: 9pt;
    line-height: 1.5;
    color: ${PALETTE.text};
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .transcript-prompt .lbl,
  .transcript-response .lbl {
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 1pt;
    color: ${PALETTE.textMuted};
    margin-bottom: 4pt;
    display: block;
    font-weight: 500;
  }
  .transcript-response {
    padding: 0 4pt;
    font-size: 9pt;
    line-height: 1.55;
  }
  .transcript-response p { margin: 5pt 0; }
  .transcript-response ul,
  .transcript-response ol { margin: 5pt 0 5pt 18pt; }
  .transcript-response li { margin: 2pt 0; }
  .transcript-response strong { font-weight: 600; color: ${PALETTE.text}; }
  .transcript-response em { font-style: italic; }
  .transcript-response code {
    font-family: "Menlo", "Monaco", monospace;
    font-size: 8pt;
    background: ${PALETTE.surfaceAlt};
    padding: 1pt 4pt;
    border-radius: 1pt;
  }
  .transcript-response pre {
    background: ${PALETTE.surfaceAlt};
    border: 0.5pt solid ${PALETTE.borderSubtle};
    padding: 8pt;
    margin: 5pt 0;
    border-radius: 2pt;
    font-size: 8pt;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .transcript-response h1,
  .transcript-response h2,
  .transcript-response h3,
  .transcript-response h4 {
    font-size: 10pt;
    font-weight: 600;
    margin: 9pt 0 3pt;
    color: ${PALETTE.text};
  }
  .transcript-response a { color: ${PALETTE.primaryDark}; text-decoration: none; }
  .transcript-response blockquote {
    border-left: 2pt solid ${PALETTE.borderSubtle};
    padding-left: 8pt;
    margin: 5pt 0;
    color: ${PALETTE.textMuted};
  }
  .transcript-truncated {
    margin-top: 4pt;
    font-size: 7.5pt;
    color: ${PALETTE.textMuted};
    font-style: italic;
  }
  .transcript-empty {
    color: ${PALETTE.textMuted};
    font-style: italic;
    font-size: 9pt;
  }

  @page {
    size: A4;
    margin: 0;
  }
  @media print {
    h2.section, h3.subsection { break-after: avoid; }
    tr { page-break-inside: avoid; }
  }
`;

export const PDF_FOOTER_HTML = (label: string, dateStr: string, host: string) => `
<style>
  .pf {
    font-family: -apple-system, "Helvetica Neue", sans-serif;
    font-size: 7pt;
    color: ${PALETTE.textFaint};
    width: 100%;
    text-align: center;
    padding: 0 14mm;
  }
  .pf .pageNumber, .pf .totalPages { color: ${PALETTE.textFaint}; }
</style>
<div class="pf">
  ${escapeHtml(label)} &middot; ${escapeHtml(dateStr)} &middot; ${escapeHtml(host)}
  &middot; <span class="pageNumber"></span>/<span class="totalPages"></span>
</div>
`;

export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
