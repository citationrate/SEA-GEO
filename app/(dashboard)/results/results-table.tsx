"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

const STATUS_ICON: Record<string, any> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: XCircle,
};

const STATUS_BADGE: Record<string, string> = {
  pending: "badge-muted",
  running: "badge-primary",
  completed: "badge-success",
  failed: "badge-muted text-destructive border-destructive/20 bg-destructive/10",
  cancelled: "badge-muted",
};

interface RunRow {
  id: string;
  project_id: string;
  version: number;
  models_used: string[];
  completed_prompts: number;
  total_prompts: number;
  status: string;
  completed_at: string | null;
  created_at: string;
  projectName: string;
  projectBrand: string;
  aviScore: number | null;
}

export function ResultsTable({ rows }: { rows: RunRow[] }) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const STATUS_LABEL: Record<string, string> = {
    pending: t("results.pending"),
    running: t("results.running"),
    completed: t("results.completed"),
    failed: t("results.failed"),
    cancelled: t("results.cancelled"),
  };

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.projectName.toLowerCase().includes(q) ||
      r.projectBrand.toLowerCase().includes(q) ||
      r.models_used?.some((m) => m.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <div className="flex items-center gap-2 border border-border rounded-[2px] px-3 py-1.5 w-72 focus-within:border-primary/30 transition-colors" style={{ background: "var(--surface)" }}>
        <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <input
          placeholder={t("results.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      <div className="overflow-hidden">
        <table className="w-full text-sm border-separate border-spacing-y-2">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="text-left py-2 px-4 font-medium">{t("results.project")}</th>
              <th className="text-left py-2 px-4 font-medium">{t("results.version")}</th>
              <th className="text-left py-2 px-4 font-medium">{t("results.models")}</th>
              <th className="text-left py-2 px-4 font-medium">{t("results.prompt")}</th>
              <th className="text-left py-2 px-4 font-medium">{t("results.avi")}</th>
              <th className="text-left py-2 px-4 font-medium">{t("results.status")}</th>
              <th className="text-left py-2 px-4 font-medium">{t("results.date")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const Icon = STATUS_ICON[r.status] ?? Clock;
              const href = `/projects/${r.project_id}/runs/${r.id}`;
              return (
                <tr
                  key={r.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(href)}
                  onMouseEnter={() => router.prefetch(href)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(href);
                    }
                  }}
                  className="bg-surface border border-border hover:border-primary hover:bg-primary/[0.06] hover:shadow-[0_0_0_1px_rgb(var(--primary-rgb,123_184_154)/0.5)] transition-all cursor-pointer focus:outline-none focus:bg-primary/[0.08] focus:border-primary group"
                >
                  <td className="py-3 px-4 rounded-l-[3px]">
                    <p className="font-medium text-foreground group-hover:text-primary transition-colors">{r.projectName}</p>
                    <p className="text-xs text-muted-foreground">{r.projectBrand}</p>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">v{r.version}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {r.models_used?.map((m: string) => (
                        <span key={m} className="badge badge-muted text-[12px]">{m}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{r.completed_prompts}/{r.total_prompts}</td>
                  <td className="py-3 px-4">
                    {r.aviScore != null ? (
                      <span className="font-display font-bold text-primary">{r.aviScore}</span>
                    ) : (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge ${STATUS_BADGE[r.status] ?? "badge-muted"} flex items-center gap-1 w-fit`}>
                      <Icon className={`w-3 h-3 ${r.status === "running" ? "animate-spin" : ""}`} />
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-xs rounded-r-[3px]">
                    {new Date(r.completed_at ?? r.created_at).toLocaleString(locale)}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground border border-border bg-surface rounded-[3px]">
                  {t("results.noResultFound")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
