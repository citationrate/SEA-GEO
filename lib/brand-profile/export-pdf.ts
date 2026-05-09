/**
 * Programmatic PDF export for the Brand Profile report.
 *
 * Inspired by the CS user-PDF (WeasyPrint, HTML→PDF on the backend) but
 * generated client-side with jsPDF text + shapes — no more html2canvas
 * screenshot of the live UI. Pros vs the previous version:
 *   - vector text (sharp at any zoom, no rasterization blur)
 *   - one pillar per page, no cramped layout
 *   - proper page numbers + footer on every page
 *   - clean header with brand identity (no overlapping logo/title)
 *
 * The radar pentagon is the one part we still capture from the DOM
 * (small SVG → canvas), because re-implementing recharts from scratch in
 * jsPDF is not worth it. The capture target is tagged with
 * `data-bp-print-radar` in report.tsx.
 */

import type { jsPDF as JsPdfType } from "jspdf";

export interface BpPdfPillar {
  /** Title displayed at top of the pillar section (e.g. "Notorietà") */
  title: string;
  /** One-line description shown under the title */
  description: string;
  /** 0–100 score for this pillar (rounded) */
  score: number;
  /** Optional sub-metrics (e.g. Position 60, Presence 45) — drawn as bars */
  subMetrics?: Array<{ label: string; value: number }>;
  /** "Cosa fare" bullets — short actionable items */
  insights: string[];
}

export interface BpPdfInput {
  brandName: string;
  /** Free-form sector label (e.g. "SaaS AI Visibility") */
  sector: string;
  /** Two-letter country code, displayed as-is (e.g. "IT") */
  country: string;
  /** Locale for date formatting (e.g. "it") */
  locale: string;
  /** Run completion date (ISO string). Falls back to today. */
  date: string | null;
  /** Overall 0–100 score */
  scoreTotal: number;
  /** The 5 pillars, in display order */
  pillars: BpPdfPillar[];
  /** Localized labels needed for the cover */
  labels: {
    productName: string;       // "Brand Profile" — banner
    overallScore: string;      // "Score complessivo"
    pillarsAtAGlance: string;  // "I 5 pilastri"
    cosaFare: string;          // "Cosa fare"
    page: string;              // "Pagina"
    of: string;                // "di"
    radarTitle: string;        // "Radar dei pilastri"
    scoreLabelCritical: string;
    scoreLabelLow: string;
    scoreLabelMedium: string;
    scoreLabelGood: string;
    scoreLabelExcellent: string;
  };
}

const A4_W = 210;
const A4_H = 297;
const MARGIN = 18;
const CONTENT_W = A4_W - 2 * MARGIN;

// Color tokens mirror scoreColor() in report.tsx so the PDF feels native.
function scoreColorRgb(score: number): [number, number, number] {
  if (score <= 30) return [192, 97, 74];   // red-ish
  if (score <= 50) return [232, 197, 109]; // amber
  if (score <= 70) return [91, 164, 207];  // sky
  if (score <= 85) return [126, 184, 154]; // sage (primary)
  return [63, 125, 91];                    // dark green
}

function scoreLabel(score: number, l: BpPdfInput["labels"]): string {
  if (score <= 30) return l.scoreLabelCritical;
  if (score <= 50) return l.scoreLabelLow;
  if (score <= 70) return l.scoreLabelMedium;
  if (score <= 85) return l.scoreLabelGood;
  return l.scoreLabelExcellent;
}

function fmtDate(iso: string | null, locale: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  try {
    return d.toLocaleDateString(`${locale}-${locale.toUpperCase()}`, {
      day: "2-digit", month: "long", year: "numeric",
    });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Captures only the BP radar pentagon and returns a PNG dataURL. */
async function captureRadar(): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const radarEl = document.querySelector<HTMLElement>("[data-bp-print-radar]");
  if (!radarEl) return null;
  try {
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(radarEl, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
    });
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("[bp/export-pdf] radar capture failed:", e);
    return null;
  }
}

function wrap(pdf: JsPdfType, text: string, maxW: number): string[] {
  return (pdf as any).splitTextToSize(text, maxW) as string[];
}

function drawFooter(
  pdf: JsPdfType, brand: string, date: string, page: number, total: number, l: BpPdfInput["labels"],
) {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(140, 140, 140);
  pdf.text(`${brand} · ${date}`, MARGIN, A4_H - 8);
  const right = `${l.page} ${page} ${l.of} ${total}`;
  pdf.text(right, A4_W - MARGIN, A4_H - 8, { align: "right" });
  pdf.setDrawColor(220);
  pdf.setLineWidth(0.2);
  pdf.line(MARGIN, A4_H - 14, A4_W - MARGIN, A4_H - 14);
}

function drawHeader(pdf: JsPdfType, brand: string, productName: string) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(126, 184, 154); // sage
  pdf.text(productName.toUpperCase(), MARGIN, 12);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  pdf.text(brand, A4_W - MARGIN, 12, { align: "right" });
  pdf.setDrawColor(220);
  pdf.setLineWidth(0.2);
  pdf.line(MARGIN, 14, A4_W - MARGIN, 14);
}

function drawBar(
  pdf: JsPdfType, x: number, y: number, width: number, height: number,
  value: number, color: [number, number, number],
) {
  const v = Math.max(0, Math.min(100, value));
  pdf.setFillColor(235, 235, 235);
  pdf.rect(x, y, width, height, "F");
  pdf.setFillColor(color[0], color[1], color[2]);
  pdf.rect(x, y, (width * v) / 100, height, "F");
}

export async function exportBrandProfilePdf(input: BpPdfInput): Promise<void> {
  if (typeof window === "undefined") return;

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const date = fmtDate(input.date, input.locale);
  const pageCountPlaceholders: number[] = [];

  const startPage = () => {
    drawHeader(pdf, input.brandName, input.labels.productName);
    pageCountPlaceholders.push(pageCountPlaceholders.length + 1);
  };

  // ─── Page 1 — Cover ─────────────────────────────────────────────────────
  startPage();

  let y = 38;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(120, 120, 120);
  pdf.text(`${input.sector.toUpperCase()} · ${input.country.toUpperCase()} · ${date}`, MARGIN, y);

  y += 14;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(28);
  pdf.setTextColor(20, 20, 20);
  const brandLines = wrap(pdf, input.brandName, CONTENT_W);
  for (const line of brandLines) {
    pdf.text(line, MARGIN, y);
    y += 12;
  }

  y += 8;
  const scoreColor = scoreColorRgb(input.scoreTotal);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(120, 120, 120);
  pdf.text(input.labels.overallScore.toUpperCase(), MARGIN, y);
  y += 4;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(72);
  pdf.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  pdf.text(String(Math.round(input.scoreTotal)), MARGIN, y + 24);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.text(scoreLabel(input.scoreTotal, input.labels), MARGIN + 60, y + 22);

  y += 38;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(60, 60, 60);
  pdf.text(input.labels.pillarsAtAGlance.toUpperCase(), MARGIN, y);
  y += 6;

  for (const p of input.pillars) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(40, 40, 40);
    pdf.text(p.title, MARGIN, y + 4);
    const sc = scoreColorRgb(p.score);
    pdf.setTextColor(sc[0], sc[1], sc[2]);
    pdf.setFont("helvetica", "bold");
    pdf.text(String(Math.round(p.score)), A4_W - MARGIN, y + 4, { align: "right" });
    drawBar(pdf, MARGIN, y + 6, CONTENT_W, 2, p.score, sc);
    y += 12;
  }

  drawFooter(pdf, input.brandName, date, 1, 1, input.labels);

  // ─── Page 2 — Radar capture ─────────────────────────────────────────────
  const radarPng = await captureRadar();
  if (radarPng) {
    pdf.addPage();
    startPage();

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(20, 20, 20);
    pdf.text(input.labels.radarTitle, MARGIN, 28);

    const maxW = CONTENT_W;
    const maxH = A4_H - 28 - 30;
    const img = new Image();
    img.src = radarPng;
    await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); });
    const aspect = (img.width || 1) / (img.height || 1);
    let imgW = maxW;
    let imgH = imgW / aspect;
    if (imgH > maxH) { imgH = maxH; imgW = imgH * aspect; }
    pdf.addImage(radarPng, "PNG", (A4_W - imgW) / 2, 36, imgW, imgH);

    drawFooter(pdf, input.brandName, date, 2, 2, input.labels);
  }

  // ─── One page per pillar ────────────────────────────────────────────────
  for (const p of input.pillars) {
    pdf.addPage();
    startPage();

    let py = 28;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.setTextColor(20, 20, 20);
    pdf.text(p.title, MARGIN, py);

    const sc = scoreColorRgb(p.score);
    pdf.setFontSize(36);
    pdf.setTextColor(sc[0], sc[1], sc[2]);
    pdf.text(String(Math.round(p.score)), A4_W - MARGIN, py + 2, { align: "right" });
    py += 6;

    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(10);
    pdf.setTextColor(110, 110, 110);
    const descLines = wrap(pdf, p.description, CONTENT_W - 25);
    for (const line of descLines) {
      pdf.text(line, MARGIN, py);
      py += 5;
    }

    py += 4;

    if (p.subMetrics && p.subMetrics.length > 0) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(80, 80, 80);
      pdf.text("BREAKDOWN", MARGIN, py);
      py += 4;
      for (const m of p.subMetrics) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(40, 40, 40);
        pdf.text(m.label, MARGIN, py + 4);
        const mc = scoreColorRgb(m.value);
        pdf.setTextColor(mc[0], mc[1], mc[2]);
        pdf.text(String(Math.round(m.value)), A4_W - MARGIN, py + 4, { align: "right" });
        drawBar(pdf, MARGIN, py + 6, CONTENT_W, 2, m.value, mc);
        py += 12;
      }
      py += 4;
    }

    if (p.insights.length > 0) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(126, 184, 154);
      pdf.text(input.labels.cosaFare.toUpperCase(), MARGIN, py);
      py += 6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(40, 40, 40);
      const bulletWidth = CONTENT_W - 4;
      for (const ins of p.insights) {
        const lines = wrap(pdf, ins, bulletWidth);
        pdf.text("•", MARGIN, py);
        for (const line of lines) {
          pdf.text(line, MARGIN + 4, py);
          py += 5;
        }
        py += 1;

        if (py > A4_H - 30) {
          drawFooter(pdf, input.brandName, date, pageCountPlaceholders.length, 0, input.labels);
          pdf.addPage();
          startPage();
          py = 28;
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(10);
          pdf.setTextColor(40, 40, 40);
        }
      }
    }

    drawFooter(pdf, input.brandName, date, pageCountPlaceholders.length, 0, input.labels);
  }

  // Repaint footers with the correct N now that we know the total.
  const total = pageCountPlaceholders.length;
  for (let i = 0; i < total; i++) {
    pdf.setPage(i + 1);
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, A4_H - 16, A4_W, 16, "F");
    drawFooter(pdf, input.brandName, date, i + 1, total, input.labels);
  }

  pdf.save(`brand-profile-${slug(input.brandName) || "report"}-${(input.date ?? new Date().toISOString()).slice(0, 10)}.pdf`);
}
