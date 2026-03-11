"use client";

import { useState } from "react";
import { Archive, ChevronDown, ChevronRight } from "lucide-react";

interface ArchivedRun {
  id: string;
  version: number;
  status: string;
  models_used: string[];
  completed_prompts: number;
  total_prompts: number;
  date: string;
}

export function ArchivedRunsSection({
  runs,
  projectId,
}: {
  runs: ArchivedRun[];
  projectId: string;
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="card overflow-hidden opacity-60">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Archive className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-display font-semibold text-foreground text-sm">Archivio Run</h2>
          <span className="badge badge-muted text-[10px]">{runs.length}</span>
        </div>
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="px-5 pb-4 space-y-2">
          {runs.map((run) => (
            <a
              key={run.id}
              href={`/projects/${projectId}/runs/${run.id}`}
              className="flex items-center justify-between bg-muted/50 rounded-[2px] px-4 py-2.5 border border-border/50 hover:border-primary/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-display font-semibold text-foreground text-sm">v{run.version}</span>
                <span className="badge badge-muted text-[10px]">ARCHIVIATA</span>
                <span className="text-xs text-muted-foreground">{run.models_used?.join(", ")}</span>
                <span className="text-xs text-muted-foreground">
                  {run.completed_prompts}/{run.total_prompts} prompt
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{run.date}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
