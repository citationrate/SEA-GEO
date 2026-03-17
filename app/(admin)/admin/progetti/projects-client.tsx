"use client";

import { useState } from "react";
import { FolderOpen, Search } from "lucide-react";

interface Row {
  id: string; name: string; target_brand: string; user_email: string;
  sector: string | null; country: string | null; runs: number;
  avi_score: number | null; created_at: string; deleted: boolean;
}

export function ProjectsAdminClient({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "deleted">("all");

  const filtered = rows.filter((r) => {
    if (filter === "active" && r.deleted) return false;
    if (filter === "deleted" && !r.deleted) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.target_brand.toLowerCase().includes(q) || r.user_email.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-[1200px] animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-6 h-6 text-primary" />
          <h1 className="font-display font-bold text-2xl text-foreground">Progetti ({rows.length})</h1>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca brand, progetto, utente..." className="input-base pl-8 w-64" />
        </div>
      </div>

      <div className="flex gap-2">
        {(["all", "active", "deleted"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded-[2px] border transition-colors ${filter === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
            {f === "all" ? "Tutti" : f === "active" ? "Attivi" : "Eliminati"}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Progetto / Brand</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Utente</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Settore</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Analisi</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">AVI</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Creato</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Stato</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-foreground font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.target_brand}</p>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.user_email}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.sector ?? "—"}</td>
                <td className="px-4 py-3 text-foreground">{r.runs}</td>
                <td className="px-4 py-3">
                  {r.avi_score != null ? <span className="font-bold text-primary">{r.avi_score}</span> : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("it-IT")}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-[2px] border ${r.deleted ? "border-destructive/30 text-destructive bg-destructive/10" : "border-primary/30 text-primary bg-primary/10"}`}>
                    {r.deleted ? "Eliminato" : "Attivo"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
