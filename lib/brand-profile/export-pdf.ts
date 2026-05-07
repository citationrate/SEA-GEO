/**
 * Client-side PDF export for the Brand Profile report.
 *
 * We render the existing on-screen report into a canvas via html2canvas and
 * paginate it into an A4 jsPDF. Cheaper than a backend Puppeteer roundtrip
 * and avoids the browser print dialog (which the user rejected as UX —
 * "deve avviare il download automaticamente").
 *
 * Notes:
 * - We use the same `[data-bp-print-area]` wrapper that the @media print
 *   stylesheet already targets, plus the `data-bp-no-print` attribute to
 *   hide chrome during capture (sidebar, top bar, the export button itself).
 * - `data-bp-print-expand` elements (e.g. raw AI responses) are forced
 *   visible in the cloned DOM so the PDF includes them even when collapsed
 *   on screen.
 * - SVG (Recharts radar) is rendered via foreignObjectRendering=false +
 *   useCORS=true; html2canvas reads the inline SVG correctly in modern
 *   Chromium-based browsers. Output quality at scale=2 is ~150 DPI on A4.
 */

export async function exportBrandProfilePdf(opts: {
  brandName: string;
  date: string | null; // ISO string or YYYY-MM-DD
}): Promise<void> {
  if (typeof window === "undefined") return;

  const root = document.querySelector<HTMLElement>("[data-bp-print-area]");
  if (!root) {
    console.error("[bp/export-pdf] data-bp-print-area not found");
    return;
  }

  // Lazy-load to keep the report bundle slim on first paint.
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(root, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
    onclone: (clonedDoc) => {
      // Hide everything tagged data-bp-no-print (sidebar, top bar, the
      // Export button, the CS deep-link CTA, the empty-state CTA banner).
      clonedDoc.querySelectorAll<HTMLElement>("[data-bp-no-print]").forEach((el) => {
        el.style.display = "none";
      });
      // Force-show collapsed-by-default sections so the PDF includes them.
      clonedDoc.querySelectorAll<HTMLElement>("[data-bp-print-expand]").forEach((el) => {
        el.style.display = "block";
      });
      // Strip dark-theme backgrounds from the cloned subtree so the export
      // is consistently white-on-dark-text regardless of the user's theme.
      const printArea = clonedDoc.querySelector<HTMLElement>("[data-bp-print-area]");
      if (printArea) {
        printArea.style.background = "#ffffff";
        printArea.style.color = "#111111";
      }
    },
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pdfWidth = pdf.internal.pageSize.getWidth(); // 210
  const pdfHeight = pdf.internal.pageSize.getHeight(); // 297
  const margin = 10;
  const imgWidth = pdfWidth - 2 * margin;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const imgData = canvas.toDataURL("image/png");

  if (imgHeight <= pdfHeight - 2 * margin) {
    pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
  } else {
    // Slice the long capture across A4 pages by translating the image
    // upward each page.
    const pageInnerHeight = pdfHeight - 2 * margin;
    let heightLeft = imgHeight;
    let position = margin;
    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
    heightLeft -= pageInnerHeight;
    while (heightLeft > 0) {
      position = margin + (imgHeight - heightLeft) - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= pageInnerHeight;
    }
  }

  const slug = opts.brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const dateStr = (opts.date ?? new Date().toISOString()).slice(0, 10);
  pdf.save(`brand-profile-${slug || "report"}-${dateStr}.pdf`);
}
