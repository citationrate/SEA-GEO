"use client";

import { useState, useRef, useEffect } from "react";
import { Download, Loader2, ChevronDown, FileText, FileSpreadsheet, FolderDown } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

interface ExportButtonsProps {
  runId: string;
  projectId: string;
}

export function ExportButtons({ runId, projectId }: ExportButtonsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function downloadBlob(url: string, defaultFilename: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition");
    let filename = defaultFilename;
    if (disposition) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match) filename = match[1];
    }
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objUrl);
  }

  async function handleExport(type: string) {
    setLoading(type);
    setOpen(false);
    try {
      switch (type) {
        case "pdf":
          // Single run PDF — open in new tab for print
          window.open(`/api/export/${runId}/pdf`, "_blank");
          break;
        case "project-pdf":
          await downloadBlob(`/api/export/project/${projectId}/pdf`, `AVI-Project-Report.html`);
          break;
        case "excel":
          await downloadBlob(`/api/export/${runId}/excel`, `AVI-Export-${runId.slice(0, 8)}.xlsx`);
          break;
        case "project-excel":
          await downloadBlob(`/api/export/project/${projectId}/excel`, `AVI-Project-Export.xlsx`);
          break;
      }
    } catch {
      // silently fail
    } finally {
      setTimeout(() => setLoading(null), 500);
    }
  }

  const items = [
    { key: "pdf",           icon: FileText,        label: t("exportData.exportPdf") },
    { key: "excel",         icon: FileSpreadsheet, label: t("exportData.exportExcel") },
    { key: "divider" },
    { key: "project-pdf",   icon: FolderDown,      label: t("exportData.exportProjectPdf") },
    { key: "project-excel", icon: FileSpreadsheet, label: t("exportData.exportProjectExcel") },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        disabled={loading !== null}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-xs font-semibold border border-primary text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        {t("exportData.export")}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-[2px] border border-border bg-background shadow-lg py-1">
          {items.map((item) => {
            if (item.key === "divider") {
              return <div key="div" className="h-px bg-border my-1" />;
            }
            const Icon = item.icon!;
            return (
              <button
                key={item.key}
                onClick={() => handleExport(item.key)}
                disabled={loading !== null}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-surface-2 transition-colors disabled:opacity-50"
              >
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{item.label}</span>
                {loading === item.key && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
