"use client";

import { useState, useCallback, useMemo, Suspense } from "react";
import { ArgomentoSelector } from "@/components/argomento-selector";
import { ArgomentoCreateModal } from "@/components/argomento-create-modal";
import { useRouter } from "next/navigation";
import { Clock, CheckCircle, XCircle, Loader2, BarChart3 } from "lucide-react";

interface Argomento { id: string; name: string }
interface RunData {
  id: string;
  argomento_id: string;
  version: number;
  status: string;
  models_used: string[];
  completed_prompts: number;
  total_prompts: number;
  completed_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

interface Props {
  projectId: string;
  argomenti: Argomento[];
  allRuns: RunData[];
  aviMap: Record<string, number>; // run_id → avi_score
  dateLocale: string;
  children: (argomentoId: string, queryCount: number) => React.ReactNode;
}

/**
 * Client wrapper that manages Argomento selection and filters runs accordingly.
 * Receives all data from server, filters client-side.
 */
export function ProjectArgomentoBar({ projectId, argomenti: initial, allRuns, aviMap, dateLocale, children }: Props) {
  const router = useRouter();
  const [argomenti, setArgomenti] = useState<Argomento[]>(initial);
  const [selectedId, setSelectedId] = useState<string>(initial[0]?.id ?? "");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string>("");

  // Filter runs for selected argomento
  const filteredRuns = useMemo(() => {
    if (!selectedId) return allRuns.filter((r) => !r.deleted_at);
    return allRuns.filter((r) => !r.deleted_at && r.argomento_id === selectedId);
  }, [allRuns, selectedId]);

  // Count queries for selected argomento (approximate from runs, actual count comes from server)
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setSelectedRunId(""); // reset run selection on argomento change
  }, []);

  const handleCreated = useCallback((a: Argomento) => {
    setArgomenti((prev) => [...prev, a]);
    setSelectedId(a.id);
    router.refresh();
  }, [router]);

  return (
    <>
      {/* Header bar: Argomento selector + Run selector + Lancia analisi */}
      <div className="flex items-center gap-2 flex-wrap">
        <Suspense fallback={null}>
          <ArgomentoSelector
            argomenti={argomenti}
            projectId={projectId}
            onSelect={handleSelect}
            onCreateNew={() => setShowCreate(true)}
          />
        </Suspense>

        {/* Run selector dropdown */}
        {filteredRuns.length > 0 && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
              className="bg-muted border border-border rounded-[2px] px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
            >
              <option value="">Ultima run</option>
              {filteredRuns.map((run) => {
                const date = new Date(run.completed_at ?? run.created_at).toLocaleDateString(dateLocale);
                const avi = aviMap[run.id];
                return (
                  <option key={run.id} value={run.id}>
                    v{run.version} — {date}{avi != null ? ` (AVI ${avi})` : ""} — {run.status}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* AnalysisLauncher (passed via render prop with current argomentoId) */}
        {children(selectedId, filteredRuns.length)}
      </div>

      {/* Runs list filtered by argomento */}
      {filteredRuns.length > 0 && (
        <div className="card p-5 space-y-4 mt-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">Analisi eseguite</h2>
            <span className="badge badge-muted text-[12px]">{filteredRuns.length}</span>
          </div>
          <div className="space-y-2">
            {filteredRuns.map((run) => {
              const Icon = run.status === "completed" ? CheckCircle : run.status === "failed" ? XCircle : run.status === "running" ? Loader2 : Clock;
              const badgeClass = run.status === "completed"
                ? "bg-green-500/15 text-green-500 border-green-500/30"
                : run.status === "running"
                ? "bg-yellow-500/15 text-yellow-500 border-yellow-500/30"
                : run.status === "failed"
                ? "bg-red-500/15 text-red-500 border-red-500/30"
                : "badge-muted";
              const avi = aviMap[run.id];
              const date = new Date(run.completed_at ?? run.created_at).toLocaleDateString(dateLocale);
              return (
                <div key={run.id} className="space-y-1">
                  <a
                    href={`/projects/${projectId}/runs/${run.id}`}
                    className="flex items-center justify-between bg-muted rounded-[2px] px-4 py-3 border border-border hover:border-primary/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-display font-semibold text-foreground group-hover:text-primary transition-colors">v{run.version}</span>
                      {avi != null && <span className="font-display font-bold text-primary text-sm">AVI {avi}</span>}
                      <span className="text-xs text-muted-foreground">{run.models_used?.length ?? 0} modelli</span>
                      <span className="text-xs text-muted-foreground">{run.completed_prompts}/{run.total_prompts} prompt</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{date}</span>
                      <span className={`inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-0.5 rounded-[2px] border ${badgeClass}`}>
                        <Icon className={`w-3 h-3 ${run.status === "running" ? "animate-spin" : ""}`} />
                        {run.status}
                      </span>
                    </div>
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ArgomentoCreateModal
        projectId={projectId}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
