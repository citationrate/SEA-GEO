"use client";

import { useState } from "react";
import { Activity, CheckCircle, XCircle, Clock, Loader2, Search } from "lucide-react";

interface Row {
  id: string; status: string; version: number; project_name: string; user_email: string;
  models_used: string[]; completed_prompts: number; total_prompts: number;
  avi_score: number | null; created_at: string;
}

const STATUS_CFG: Record<string, { icon: any; cls: string; label: string }> = {
  completed: { icon: CheckCircle, cls: "text-primary", label: "Completata" },
  running: { icon: Loader2, cls: "text-yellow-500", label: "In corso" },
  failed: { icon: XCircle, cls: "text-destructive", label: "Fallita" },
  pending: { icon: Clock, cls: "text-muted-foreground", label: "In attesa" },
};

export function AnalysisAdminClient({ rows }: { rows: Row[] }) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.project_name.toLowerCase().includes(q) || r.user_email.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-primary" />
          <h1 className="font-display font-bold text-2xl text-foreground">Analisi Runs ({rows.length})</h1>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca progetto o utente..." className="input-base pl-8 w-60" />
        </div>
      </div>

      <div className="flex gap-2">
        {["all", "completed", "running", "failed", "pending"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`text-xs px-3 py-1.5 rounded-[2px] border transition-colors ${statusFilter === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
            {s === "all" ? "Tutti" : STATUS_CFG[s]?.label ?? s}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">ID</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Stato</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Progetto</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Utente</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Prompt</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">AVI</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Modelli</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Data</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.pending;
              const Icon = cfg.icon;
              return (
                <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.id.slice(0, 8)}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1.5"><Icon className={`w-4 h-4 ${cfg.cls}`} /><span className="text-xs">{cfg.label}</span></div></td>
                  <td className="px-4 py-3 text-foreground">{r.project_name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.user_email}</td>
                  <td className="px-4 py-3 text-xs">{r.completed_prompts}/{r.total_prompts}</td>
                  <td className="px-4 py-3">{r.avi_score != null ? <span className="font-bold text-primary">{r.avi_score}</span> : "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.models_used.join(", ")}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("it-IT")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
