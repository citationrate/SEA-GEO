"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export function ExportButtons({ runId }: { runId: string }) {
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);

  async function downloadExcel() {
    setLoadingExcel(true);
    try {
      const res = await fetch(`/api/export/${runId}/excel`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `seageo-export-${runId.slice(0, 8)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setLoadingExcel(false);
    }
  }

  function openPdf() {
    setLoadingPdf(true);
    window.open(`/api/export/${runId}/pdf`, "_blank");
    setTimeout(() => setLoadingPdf(false), 1500);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={downloadExcel}
        disabled={loadingExcel}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-xs font-semibold border border-primary text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
      >
        {loadingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        Esporta Excel
      </button>
      <button
        onClick={openPdf}
        disabled={loadingPdf}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-xs font-semibold border border-primary text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
      >
        {loadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        Esporta PDF
      </button>
    </div>
  );
}
