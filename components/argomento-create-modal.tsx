"use client";

import { useState } from "react";
import { X, Loader2, Bookmark } from "lucide-react";

interface Props {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (argomento: { id: string; name: string }) => void;
}

export function ArgomentoCreateModal({ projectId, open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleCreate() {
    if (!name.trim()) { setError("Inserisci un nome per l'argomento."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/argomenti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, name: name.trim(), description: description.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Errore nella creazione."); return;
      }
      const argomento = await res.json();
      onCreated({ id: argomento.id, name: argomento.name });
      setName(""); setDescription(""); onClose();
    } catch { setError("Errore di rete."); } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Nuovo argomento</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Ogni argomento raggruppa le query e le analisi per un topic specifico del tuo brand (es. &quot;Stivaletti Chelsea&quot;, &quot;Scarpe eleganti ufficio&quot;).
        </p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Es. Stivaletti Chelsea"
              className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-muted text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrizione (opzionale)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="Breve descrizione del topic che vuoi monitorare"
              className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-muted text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
          </div>
        </div>

        {error && <p className="text-sm text-destructive mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground">Annulla</button>
          <button onClick={handleCreate} disabled={loading || !name.trim()}
            className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Creo…" : "Crea argomento"}
          </button>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Dopo la creazione potrai aggiungere query specifiche e lanciare analisi per questo argomento. Consigliamo di ri-analizzare ogni 5-6 settimane dopo ottimizzazioni GEO.
        </p>
      </div>
    </div>
  );
}
